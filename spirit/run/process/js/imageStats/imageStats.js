const path = require('path');
const sharp = require('sharp');
const spirit = require('../../../js/kernel.js');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const HISTOGRAM_BUCKETS = 16; // 256 intensity values / 16 = 16 buckets per channel

function findImages(rootDir) {
  const entries = spirit.core.node.util.scanFolder(rootDir);
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter((fullPath) => IMAGE_EXTENSIONS.has(path.extname(fullPath).toLowerCase()));
}

function buildHistogram(raw, info) {
  const channelNames = info.channels >= 3 ? ['r', 'g', 'b'] : ['gray'];
  const histogram = {};
  channelNames.forEach((name) => { histogram[name] = new Array(HISTOGRAM_BUCKETS).fill(0); });

  const bucketWidth = 256 / HISTOGRAM_BUCKETS;
  for (let i = 0; i < raw.length; i += info.channels) {
    channelNames.forEach((name, channelIndex) => {
      const value = raw[i + channelIndex];
      const bucket = Math.min(HISTOGRAM_BUCKETS - 1, Math.floor(value / bucketWidth));
      histogram[name][bucket]++;
    });
  }
  return histogram;
}

async function computeStatsForImage(fullPath) {
  const image = sharp(fullPath);
  const metadata = await image.metadata();
  const stats = await image.stats();
  const { data: raw, info } = await image.raw().toBuffer({ resolveWithObject: true });

  const averageColor = {};
  const channelNames = info.channels >= 3 ? ['r', 'g', 'b'] : ['gray'];
  channelNames.forEach((name, i) => { averageColor[name] = Math.round(stats.channels[i].mean); });

  return {
    width: metadata.width,
    height: metadata.height,
    averageColor: averageColor,
    histogram: buildHistogram(raw, info),
    computedAt: Date.now(),
  };
}

async function main() {
  const rootDir = spirit.core.node.const.ROOT_DIR;
  const mediaDir = path.join(rootDir, 'media');
  const images = findImages(mediaDir);

  await spirit.core.jobs.log('found ' + images.length + ' image(s) under media/');

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < images.length; i++) {
    const fullPath = images[i];
    const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
    const sidecarPath = relativePath.replace(/\.[^.]+$/, '.json');
    const percent = Math.round((i / images.length) * 100);

    await spirit.core.jobs.log(percent + '% done, processing ' + relativePath);

    try {
      const imageStats = await computeStatsForImage(fullPath);

      const existingRaw = spirit.core.fs.loadFile(sidecarPath);
      let sidecar = {};
      if (existingRaw != null) {
        try { sidecar = JSON.parse(existingRaw); } catch (e) { sidecar = {}; }
      }
      sidecar.spiritImageStats = imageStats; // this tool's own key — every other key is left untouched

      const result = spirit.core.fs.saveFile(sidecarPath, JSON.stringify(sidecar, null, 2));
      if (!result.ok) throw new Error('saveFile failed: ' + result.reason);

      processed++;
      await spirit.core.jobs.log('processed ' + processed + '/' + images.length + ': ' + relativePath);
    } catch (err) {
      failed++;
      await spirit.core.jobs.log('FAILED on ' + relativePath + ': ' + err.message);
    }
  }

  await spirit.core.jobs.log('Completed: ' + processed + ' processed, ' + failed + ' failed, ' + images.length + ' total');
  await spirit.core.jobs.complete({ total: images.length, processed: processed, failed: failed });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    spirit.core.jobs.fail(err).finally(() => process.exit(1));
  });
