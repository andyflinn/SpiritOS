const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const spirit = require('../../../js/kernel.js');

// Promise-wrapped, non-blocking — see lmStudioLoadModel.js for why: a
// synchronous execSync call here froze this process's event loop for the
// whole load and caused a real, reproducible ECONNRESET on this script's
// own stdio pipe to its parent in this nested-spawn context.
function execAsync(command, options) {
  return new Promise((resolve, reject) => {
    exec(command, options, (err, stdout, stderr) => {
      if (err) { reject(err); return; }
      resolve({ stdout, stderr });
    });
  });
}

// LM Studio's local OpenAI-compatible server. Edit directly here if your
// setup differs — no manifest arg for the URL itself, just the model.
const LM_STUDIO_URL = 'http://localhost:1234/v1/chat/completions';
const DEFAULT_MODEL = 'prism-ml/bonsai-27b'; // used if this script is run without the args JSON (e.g. directly from the command line)

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const MIME_BY_EXT = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp',
};

const PROMPT =
  'Describe this image for use as AI image-generation training data. ' +
  'Respond with ONLY a JSON object, no other text, in exactly this shape: ' +
  '{"caption": "<one or two sentence natural-language description of the image>", ' +
  '"tags": "<comma-separated list of short lowercase descriptive tags, using underscores instead of spaces within a tag>"}';

function findImages(rootDir) {
  const entries = spirit.core.node.util.scanFolder(rootDir);
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter((fullPath) => IMAGE_EXTENSIONS.has(path.extname(fullPath).toLowerCase()));
}

async function captionImage(fullPath, model) {
  const ext = path.extname(fullPath).toLowerCase();
  const base64 = fs.readFileSync(fullPath).toString('base64');
  const dataUrl = 'data:' + MIME_BY_EXT[ext] + ';base64,' + base64;

  const response = await fetch(LM_STUDIO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      temperature: 0.2,
      // Generous budget on purpose: some local vision models (confirmed with
      // Bonsai-27B) spend a large, unpredictable number of tokens on hidden
      // chain-of-thought before writing an answer at all. Too low a
      // max_tokens produces a silently empty response, not truncated text —
      // this matters even more here since you may be trying models whose
      // reasoning behavior you don't know yet.
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

  if (!response.ok) {
    throw new Error('LM Studio returned ' + response.status + ': ' + (await response.text()));
  }

  const body = await response.json();
  const choice = body.choices[0];
  if (choice.finish_reason === 'length') {
    await spirit.core.jobs.log('warning: response for ' + path.basename(fullPath) + ' was cut off (finish_reason=length) — max_tokens may still be too low for this model');
  }
  const raw = (choice.message.content || '').trim();

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/); // tolerate stray text around the JSON object
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    return { caption: parsed.caption || '', tags: parsed.tags || '', raw: null };
  } catch (e) {
    return { caption: raw, tags: '', raw: raw }; // model didn't follow the JSON format — keep the raw text rather than losing it
  }
}

async function main() {
  let args = {};
  try { args = JSON.parse(process.argv[2] || '{}'); } catch (e) { /* fall through to defaults */ }
  const model = args.model || DEFAULT_MODEL;

  // This LM Studio setup doesn't auto-load a model on request (confirmed
  // live — an unloaded model errors instantly rather than loading), so
  // ensure it's actually loaded before running the batch, instead of
  // silently depending on undocumented behavior.
  await spirit.core.jobs.log('ensuring model "' + model + '" is loaded...');
  await execAsync('lms load "' + model + '"', { timeout: 300000 });

  const rootDir = spirit.core.node.const.ROOT_DIR;
  const mediaDir = path.join(rootDir, 'media');
  const images = findImages(mediaDir);

  await spirit.core.jobs.log('using model "' + model + '", found ' + images.length + ' image(s) under media/');

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < images.length; i++) {
    const fullPath = images[i];
    const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
    const sidecarPath = relativePath.replace(/\.[^.]+$/, '.json');
    const percent = Math.round((i / images.length) * 100);

    const existingRaw = spirit.core.fs.loadFile(sidecarPath);
    let sidecar = {};
    if (existingRaw != null) {
      try { sidecar = JSON.parse(existingRaw); } catch (e) { sidecar = {}; }
    }

    // Staleness is checked per MODEL, not just per file — results are
    // keyed by model specifically so trying a different model on an
    // unchanged image still runs; only re-running the SAME model against
    // an unchanged image is skipped. See spirit.core.node.util.checkStaleness
    // (kernel.js).
    const existingForModel = sidecar.spiritImageCaptionLmStudio && sidecar.spiritImageCaptionLmStudio[model];
    const priorRecord = (existingForModel && existingForModel.mtimeMs != null)
      ? { mtimeMs: existingForModel.mtimeMs, contentHash: existingForModel.contentHash }
      : null;
    const staleness = spirit.core.node.util.checkStaleness(fullPath, priorRecord);

    if (!staleness.stale) {
      if (staleness.refreshRecord) {
        existingForModel.mtimeMs = staleness.refreshRecord.mtimeMs;
        existingForModel.contentHash = staleness.refreshRecord.contentHash;
        spirit.core.fs.saveFile(sidecarPath, JSON.stringify(sidecar, null, 2));
      }
      skipped++;
      await spirit.core.jobs.log('skipping (already captioned by ' + model + ') ' + (i + 1) + '/' + images.length + ': ' + relativePath);
      continue;
    }

    await spirit.core.jobs.log(percent + '% done, processing ' + relativePath);

    try {
      const result = await captionImage(fullPath, model);

      // Keyed by model id under one shared key, so trying several models
      // while you search for one that fits your machine leaves every
      // attempt's result available for comparison, rather than each new
      // model overwriting the last one's output.
      sidecar.spiritImageCaptionLmStudio = sidecar.spiritImageCaptionLmStudio || {};
      sidecar.spiritImageCaptionLmStudio[model] = {
        caption: result.caption,
        tags: result.tags,
        computedAt: Date.now(),
        mtimeMs: staleness.newRecord.mtimeMs,
        contentHash: staleness.newRecord.contentHash,
      };

      const saveResult = spirit.core.fs.saveFile(sidecarPath, JSON.stringify(sidecar, null, 2));
      if (!saveResult.ok) throw new Error('saveFile failed: ' + saveResult.reason);

      processed++;
      await spirit.core.jobs.log('processed ' + processed + '/' + images.length + ': ' + relativePath +
        (result.raw ? ' (model did not return valid JSON, stored raw text as caption)' : ''));
    } catch (err) {
      failed++;
      await spirit.core.jobs.log('FAILED on ' + relativePath + ': ' + err.message);
    }
  }

  await spirit.core.jobs.log('Completed: ' + processed + ' processed, ' + skipped + ' skipped (already up to date), ' + failed + ' failed, ' + images.length + ' total (model: ' + model + ')');
  await spirit.core.jobs.complete({ total: images.length, processed: processed, skipped: skipped, failed: failed, model: model });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    spirit.core.jobs.fail(err).finally(() => process.exit(1));
  });
