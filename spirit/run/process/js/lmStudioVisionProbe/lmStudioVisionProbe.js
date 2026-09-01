const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');
const spirit = require('../../../js/kernel.js');

// Promise-wrapped, non-blocking — used only for lms load below (a
// genuinely long-running, 7-13+ second call). execSync's short, fast calls
// elsewhere in this file (lms ls, nvidia-smi) are unaffected and left as-is
// — see lmStudioLoadModel.js for why: blocking the event loop for the
// whole duration of a long call caused a real, reproducible ECONNRESET on
// this script's own stdio pipe to its parent in this nested-spawn context.
function execAsync(command, options) {
  return new Promise((resolve, reject) => {
    exec(command, options, (err, stdout, stderr) => {
      if (err) { reject(err); return; }
      resolve({ stdout, stderr });
    });
  });
}

const LM_STUDIO_MODELS_URL = 'http://localhost:1234/v1/models';
const LM_STUDIO_CHAT_URL = 'http://localhost:1234/v1/chat/completions';
const TEST_IMAGE_PATH = path.join(__dirname, '..', 'imageCaptionLmStudio', 'testImage.jpg');
const RESULTS_PATH = path.join(__dirname, 'results.json');

const LIST_MODELS_TIMEOUT_MS = 3000;
// Local vision models have shown highly variable latency this session —
// large models can take well over 2 minutes between a cold load into
// VRAM/RAM and heavy hidden chain-of-thought before writing an answer
// (confirmed live: Bonsai-27B and Qwen3.8-27B both got misreported as
// "timed out" at 120s despite working fine earlier in the same session).
// Generous on purpose — a slow-but-working model must never get reported
// as broken.
const PER_MODEL_TIMEOUT_MS = 300000;

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp',
};

const PROMPT =
  'Describe this image for use as AI image-generation training data. ' +
  'Respond with ONLY a JSON object, no other text, in exactly this shape: ' +
  '{"caption": "<one or two sentence natural-language description of the image>", ' +
  '"tags": "<comma-separated list of short lowercase descriptive tags, using underscores instead of spaces within a tag>"}';

// LM Studio's own CLI (already installed, on PATH) reports real per-model
// facts neither HTTP API exposes: exact on-disk size (correctly summing
// multi-file models like a base weights file + its mmproj) and an
// authoritative vision-capability flag. Keyed by modelKey, which matches the
// chat API's model id exactly. If `lms` isn't available, this just returns
// an empty lookup — every model falls back to sizeBytes/vision: null, i.e.
// today's behavior, not a crash.
function getModelsInfo() {
  try {
    const raw = execSync('lms ls --json', { encoding: 'utf8' });
    const list = JSON.parse(raw);
    const byModelKey = {};
    list.forEach((entry) => {
      byModelKey[entry.modelKey] = { sizeBytes: entry.sizeBytes, vision: !!entry.vision };
    });
    return byModelKey;
  } catch (err) {
    return {};
  }
}

// NVIDIA-only for now (this machine's GPU) — a plain total-VRAM capacity
// check, not a true "will this load" prediction: it ignores KV-cache growth,
// other already-loaded models, and OS/display VRAM usage (observed live:
// several GB already in use before this probe even runs). If nvidia-smi
// isn't available, returns null and GPU-fit is simply omitted downstream.
function getGpuVramBytes() {
  try {
    const raw = execSync('nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits', { encoding: 'utf8' });
    const mib = parseInt(raw.trim().split('\n')[0], 10);
    if (!mib) return null;
    return mib * 1024 * 1024;
  } catch (err) {
    return null;
  }
}

async function fetchModelList() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LIST_MODELS_TIMEOUT_MS);
  try {
    const response = await fetch(LM_STUDIO_MODELS_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error('LM Studio returned ' + response.status);
    const body = await response.json();
    return (body.data || []).map((m) => m.id);
  } catch (err) {
    clearTimeout(timeoutId);
    throw new Error('could not reach LM Studio at ' + LM_STUDIO_MODELS_URL + ': ' + err.message);
  }
}

async function testModel(model, dataUrl) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PER_MODEL_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(LM_STUDIO_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: model,
        temperature: 0.2,
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        }],
      }),
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { success: false, reason: 'timed out after ' + Math.round(PER_MODEL_TIMEOUT_MS / 1000) + 's' };
    }
    return { success: false, reason: err.message };
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    return { success: false, reason: 'LM Studio returned ' + response.status };
  }

  const body = await response.json();
  const choice = body.choices && body.choices[0];
  const raw = ((choice && choice.message && choice.message.content) || '').trim();

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/); // tolerate stray text around the JSON object
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    const caption = (parsed.caption || '').trim();
    if (!caption) return { success: false, reason: 'empty caption' };
    return { success: true };
  } catch (e) {
    return { success: false, reason: 'invalid JSON response' };
  }
}

// Writes directly via fs, not spirit.core.fs.saveFile — process/ is
// deliberately excluded from the browser-facing writable-roots list to keep
// it browser-read-only, but that boundary guards the browser API, not a
// script's own OS-level access (already unrestricted by design). This is the
// script writing its own output next to itself, not a browser reaching into
// process/. Overwritten after every model so a cancelled run still leaves
// usable partial results.
function saveResults(results, gpuVramBytes) {
  const data = {
    testedAt: Date.now(),
    testImage: path.relative(path.join(__dirname, '..'), TEST_IMAGE_PATH).replace(/\\/g, '/'),
    gpuVramBytes: gpuVramBytes,
    results: results,
  };
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(data, null, 2));
}

async function main() {
  if (!fs.existsSync(TEST_IMAGE_PATH)) {
    throw new Error('test image not found at ' + TEST_IMAGE_PATH);
  }

  const ext = path.extname(TEST_IMAGE_PATH).toLowerCase();
  const base64 = fs.readFileSync(TEST_IMAGE_PATH).toString('base64');
  const dataUrl = 'data:' + (MIME_BY_EXT[ext] || 'image/jpeg') + ';base64,' + base64;

  const modelsInfo = getModelsInfo();
  const gpuVramBytes = getGpuVramBytes();
  await spirit.core.jobs.log('lms ls reports ' + Object.keys(modelsInfo).length + ' model(s) on disk' +
    (gpuVramBytes != null ? '; GPU VRAM: ' + Math.round(gpuVramBytes / (1024 * 1024 * 1024)) + ' GB' : '; GPU VRAM unknown (nvidia-smi unavailable)'));

  await spirit.core.jobs.log('fetching model list from LM Studio');
  const models = await fetchModelList();
  await spirit.core.jobs.log('found ' + models.length + ' model(s) to test');

  const results = [];
  let verified = 0;
  let failed = 0;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const percent = Math.round((i / models.length) * 100);
    const info = modelsInfo[model] || { sizeBytes: null, vision: null };
    const fitsInVram = (gpuVramBytes != null && info.sizeBytes != null) ? info.sizeBytes <= gpuVramBytes : null;

    if (info.vision === false) {
      // lms ls already tells us this model has no vision capability at all —
      // skip the HTTP round-trip entirely rather than repeat the wasted
      // 400-error requests observed testing every model blindly.
      failed++;
      results.push({ model: model, sizeBytes: info.sizeBytes, vision: false, fitsInVram: fitsInVram, success: false, reason: 'not a vision model (lms ls reports vision: false)' });
      await spirit.core.jobs.log('skipped ' + (i + 1) + '/' + models.length + ': ' + model + ' (not a vision model)');
      saveResults(results, gpuVramBytes);
      continue;
    }

    await spirit.core.jobs.log(percent + '% done, testing ' + model);

    // This LM Studio setup doesn't auto-load a model on request (confirmed
    // live — an unloaded model errors instantly rather than loading), so
    // ensure it's actually loaded before attempting a real test, instead of
    // silently depending on undocumented behavior.
    try {
      await execAsync('lms load "' + model + '"', { timeout: 300000 });
    } catch (err) {
      failed++;
      results.push({ model: model, sizeBytes: info.sizeBytes, vision: info.vision, fitsInVram: fitsInVram, success: false, reason: 'failed to load: ' + err.message });
      await spirit.core.jobs.log('failed to load ' + (i + 1) + '/' + models.length + ': ' + model);
      saveResults(results, gpuVramBytes);
      continue;
    }

    const outcome = await testModel(model, dataUrl);
    if (outcome.success) {
      verified++;
      results.push({ model: model, sizeBytes: info.sizeBytes, vision: info.vision, fitsInVram: fitsInVram, success: true });
      await spirit.core.jobs.log('verified ' + (i + 1) + '/' + models.length + ': ' + model);
    } else {
      failed++;
      results.push({ model: model, sizeBytes: info.sizeBytes, vision: info.vision, fitsInVram: fitsInVram, success: false, reason: outcome.reason });
      await spirit.core.jobs.log('failed ' + (i + 1) + '/' + models.length + ': ' + model + ' (' + outcome.reason + ')');
    }

    saveResults(results, gpuVramBytes);
  }

  await spirit.core.jobs.log('Completed: ' + verified + ' verified, ' + failed + ' failed, ' + models.length + ' total');
  await spirit.core.jobs.complete({ total: models.length, verified: verified, failed: failed });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    spirit.core.jobs.fail(err).finally(() => process.exit(1));
  });
