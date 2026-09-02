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

// Reads ANTHROPIC_API_KEY from the environment — this must be YOUR OWN key
// from console.anthropic.com (separate from any claude.ai subscription, and
// separate from whatever credential a Claude Code session might have), with
// billing configured on that account. Set it in your own environment before
// running this script; nothing here hardcodes or assumes a key.
const client = new Anthropic();

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
    return { caption: raw, tags: '' }; // model didn't follow the JSON format — keep the raw text rather than losing it
  }
}

async function captionImage(fullPath) {
  const ext = path.extname(fullPath).toLowerCase();
  const base64 = fs.readFileSync(fullPath).toString('base64');

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: MEDIA_TYPE_BY_EXT[ext], data: base64 } },
        { type: 'text', text: PROMPT },
      ],
    }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  return parseCaption((textBlock ? textBlock.text : '').trim());
}

async function main() {
  let args = {};
  try { args = JSON.parse(process.argv[2] || '{}'); } catch (e) { /* fall through to defaults */ }
  const maxFiles = args.maxFiles ? Number(args.maxFiles) : null;

  const rootDir = spirit.core.node.const.ROOT_DIR;
  const mediaDir = path.join(rootDir, 'media');
  let images = findImages(mediaDir);
  if (maxFiles) images = images.slice(0, maxFiles); // cheap way to test against real API cost before committing to the whole folder

  await spirit.core.jobs.log('found ' + images.length + ' image(s) under media/' + (maxFiles ? ' (limited to first ' + maxFiles + ')' : ''));

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

    // Skip anything already captioned and unchanged since — this is a
    // paid API call per image, so this check matters more here than
    // anywhere else it's used. See spirit.core.node.util.checkStaleness
    // (kernel.js).
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
      await spirit.core.jobs.log('skipping (already up to date) ' + (i + 1) + '/' + images.length + ': ' + relativePath);
      continue;
    }

    await spirit.core.jobs.log(percent + '% done, processing ' + relativePath);

    try {
      const result = await captionImage(fullPath);

      sidecar.spiritImageCaptionClaude = {
        caption: result.caption,
        tags: result.tags,
        model: MODEL,
        computedAt: Date.now(),
        mtimeMs: staleness.newRecord.mtimeMs,
        contentHash: staleness.newRecord.contentHash,
      };

      const saveResult = spirit.core.fs.saveFile(sidecarPath, JSON.stringify(sidecar, null, 2));
      if (!saveResult.ok) throw new Error('saveFile failed: ' + saveResult.reason);

      processed++;
      await spirit.core.jobs.log('processed ' + processed + '/' + images.length + ': ' + relativePath);
    } catch (err) {
      failed++;
      if (err instanceof Anthropic.AuthenticationError) {
        await spirit.core.jobs.log('AUTH FAILED — check that your own ANTHROPIC_API_KEY (with billing set up at console.anthropic.com) is set in this process\'s environment.');
      } else {
        await spirit.core.jobs.log('FAILED on ' + relativePath + ': ' + err.message);
      }
    }
  }

  await spirit.core.jobs.log('Completed: ' + processed + ' processed, ' + skipped + ' skipped (already up to date), ' + failed + ' failed, ' + images.length + ' total');
  await spirit.core.jobs.complete({ total: images.length, processed: processed, skipped: skipped, failed: failed });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    spirit.core.jobs.fail(err).finally(() => process.exit(1));
  });
