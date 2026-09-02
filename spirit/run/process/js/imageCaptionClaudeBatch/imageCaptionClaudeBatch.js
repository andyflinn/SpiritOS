const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const spirit = require('../../../js/kernel.js');

// Cheap model, appropriate for bulk classification/captioning work — swap to
// 'claude-opus-5' for higher-quality captions at roughly 5x the cost.
const MODEL = 'claude-haiku-4-5';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const MEDIA_TYPE_BY_EXT = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp',
};

const PROMPT =
  'Describe this image for use as AI image-generation training data. ' +
  'Respond with ONLY a JSON object, no other text, in exactly this shape: ' +
  '{"caption": "<one or two sentence natural-language description of the image>", ' +
  '"tags": "<comma-separated list of short lowercase descriptive tags, using underscores instead of spaces within a tag>"}';

// See imageCaptionClaude.js — same credential requirement (your own key +
// billing from console.anthropic.com, not any Claude Code session's).
const client = new Anthropic();

// The Batch API runs fully async (most batches finish within an hour, up to
// 24h) at 50% of standard token cost — a strong fit for "process a folder of
// images overnight," better than a real-time per-image loop for this job.
const POLL_INTERVAL_MS = 30000;

function findImages(rootDir) {
  const entries = spirit.core.node.util.scanFolder(rootDir);
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter((fullPath) => IMAGE_EXTENSIONS.has(path.extname(fullPath).toLowerCase()));
}

function parseCaption(raw) {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    return { caption: parsed.caption || '', tags: parsed.tags || '' };
  } catch (e) {
    return { caption: raw, tags: '' };
  }
}

function buildBatchRequest(fullPath, customId) {
  const ext = path.extname(fullPath).toLowerCase();
  const base64 = fs.readFileSync(fullPath).toString('base64');
  return {
    custom_id: customId,
    params: {
      model: MODEL,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: MEDIA_TYPE_BY_EXT[ext], data: base64 } },
          { type: 'text', text: PROMPT },
        ],
      }],
    },
  };
}

async function main() {
  const rootDir = spirit.core.node.const.ROOT_DIR;
  const mediaDir = path.join(rootDir, 'media');
  const images = findImages(mediaDir);

  await spirit.core.jobs.log('found ' + images.length + ' image(s) under media/ — checking which need (re)captioning');

  // Filtered BEFORE anything is submitted — a batch request is paid for
  // the moment it's created, so this is the only place that matters for
  // cost: by the time requests exist below, every one of them is for a
  // genuinely stale image. See spirit.core.node.util.checkStaleness
  // (kernel.js). Each stale image's own sidecarPath/newRecord is carried
  // alongside it so the results loop (below) never needs to re-derive or
  // re-hash anything a second time.
  const staleImages = [];
  let skipped = 0;
  images.forEach((fullPath) => {
    const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
    const sidecarPath = relativePath.replace(/\.[^.]+$/, '.json');
    const existingRaw = spirit.core.fs.loadFile(sidecarPath);
    let sidecar = {};
    if (existingRaw != null) {
      try { sidecar = JSON.parse(existingRaw); } catch (e) { sidecar = {}; }
    }

    const priorRecord = (sidecar.spiritImageCaptionClaude && sidecar.spiritImageCaptionClaude.mtimeMs != null)
      ? { mtimeMs: sidecar.spiritImageCaptionClaude.mtimeMs, contentHash: sidecar.spiritImageCaptionClaude.contentHash }
      : null;
    const staleness = spirit.core.node.util.checkStaleness(fullPath, priorRecord);

    if (!staleness.stale) {
      if (staleness.refreshRecord) {
        sidecar.spiritImageCaptionClaude.mtimeMs = staleness.refreshRecord.mtimeMs;
        sidecar.spiritImageCaptionClaude.contentHash = staleness.refreshRecord.contentHash;
        spirit.core.fs.saveFile(sidecarPath, JSON.stringify(sidecar, null, 2));
      }
      skipped++;
      return;
    }

    staleImages.push({ fullPath: fullPath, relativePath: relativePath, sidecarPath: sidecarPath, newRecord: staleness.newRecord });
  });

  await spirit.core.jobs.log(skipped + ' already up to date (skipped), ' + staleImages.length + ' need (re)captioning');

  if (staleImages.length === 0) {
    await spirit.core.jobs.log('Completed: 0 processed, ' + skipped + ' skipped (already up to date), 0 failed, ' + images.length + ' total');
    await spirit.core.jobs.complete({ total: images.length, processed: 0, skipped: skipped, failed: 0 });
    return;
  }

  // custom_id must be unique per request; index into `staleImages` lets us
  // map results back to a file — batch results arrive in ANY order, never
  // rely on position, always key by custom_id.
  const requests = staleImages.map((img, i) => buildBatchRequest(img.fullPath, 'image-' + i));

  let batch = await client.messages.batches.create({ requests });
  await spirit.core.jobs.log('batch ' + batch.id + ' submitted, status: ' + batch.processing_status);

  while (batch.processing_status !== 'ended') {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    batch = await client.messages.batches.retrieve(batch.id);
    await spirit.core.jobs.log('batch status: ' + batch.processing_status +
      ' (processing: ' + batch.request_counts.processing + ', succeeded: ' + batch.request_counts.succeeded +
      ', errored: ' + batch.request_counts.errored + ')');
  }

  let processed = 0;
  let failed = 0;

  for await (const result of await client.messages.batches.results(batch.id)) {
    const index = Number(result.custom_id.replace('image-', ''));
    const img = staleImages[index];
    const relativePath = img.relativePath;
    const sidecarPath = img.sidecarPath;

    if (result.result.type !== 'succeeded') {
      failed++;
      await spirit.core.jobs.log('FAILED (' + result.result.type + ') on ' + relativePath);
      continue;
    }

    const textBlock = result.result.message.content.find((b) => b.type === 'text');
    const parsed = parseCaption((textBlock ? textBlock.text : '').trim());

    const existingRaw = spirit.core.fs.loadFile(sidecarPath);
    let sidecar = {};
    if (existingRaw != null) {
      try { sidecar = JSON.parse(existingRaw); } catch (e) { sidecar = {}; }
    }
    sidecar.spiritImageCaptionClaude = {
      caption: parsed.caption,
      tags: parsed.tags,
      model: MODEL,
      batchId: batch.id,
      computedAt: Date.now(),
      mtimeMs: img.newRecord.mtimeMs,
      contentHash: img.newRecord.contentHash,
    };

    const saveResult = spirit.core.fs.saveFile(sidecarPath, JSON.stringify(sidecar, null, 2));
    if (saveResult.ok) {
      processed++;
    } else {
      failed++;
      await spirit.core.jobs.log('FAILED to save sidecar for ' + relativePath + ': ' + saveResult.reason);
    }
  }

  await spirit.core.jobs.log('Completed: ' + processed + ' processed, ' + skipped + ' skipped (already up to date), ' + failed + ' failed, ' + images.length + ' total (batch ' + batch.id + ')');
  await spirit.core.jobs.complete({ total: images.length, processed: processed, skipped: skipped, failed: failed, batchId: batch.id });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    if (err instanceof Anthropic.AuthenticationError) {
      err = new Error('AUTH FAILED — check that your own ANTHROPIC_API_KEY (with billing set up at console.anthropic.com) is set in this process\'s environment.');
    }
    spirit.core.jobs.fail(err).finally(() => process.exit(1));
  });
