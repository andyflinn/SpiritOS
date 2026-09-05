// Builds the "microscopic" installer: a plain .zip of the shippable
// product (spirit/, minus spirit/test/) that needs nothing but Node.js
// to run — spirit/run's core (kernel.js/server.js/jobs.js) has zero
// external npm dependencies, so a zip + Node really is a complete
// install path, with git only needed for developing, not running.
//
// File list comes from `git ls-files`, not a raw directory walk — that
// gets test/ exclusion AND every gitignored runtime file (media/,
// preferences.json, aiStatus.json, logs...) excluded for free, with no
// duplicated exclusion list to maintain. As a side effect the zip ends
// up containing exactly what a fresh `git clone` would give you, plus
// one install-specific file (README.txt) injected from this same
// install/microscopic/ folder rather than tracked inside spirit/ itself
// — a README describing an already-installed, standalone product would
// be lying about its surroundings if it lived in the source tree.
//
// Zip writer is hand-rolled (fs/path/zlib/child_process only, no npm
// package, no shelling out to zip/tar/Compress-Archive) — consistent
// with spirit/run's own zero-dependency core. This is a build-time tool
// run on the maintainer's machine (git required there), unrelated to
// what an end user installing the product needs.

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..', '..');
const RELEASE_DIR = path.join(REPO_ROOT, 'release');

// CRC-32 (IEEE 802.3), standard table-based implementation — ZIP local/
// central headers both require it, computed over the UNCOMPRESSED bytes.
const CRC_TABLE = (function () {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// MS-DOS date/time packing, as the ZIP local/central headers require —
// 5/6/5-bit hours/minutes/(seconds/2), 7/4/5-bit (year-1980)/month/day.
function toDosDateTime(date) {
  const time = ((date.getHours() & 0x1F) << 11) | ((date.getMinutes() & 0x3F) << 5) | (Math.floor(date.getSeconds() / 2) & 0x1F);
  const dateEnc = (((date.getFullYear() - 1980) & 0x7F) << 9) | (((date.getMonth() + 1) & 0xF) << 5) | (date.getDate() & 0x1F);
  return { time, date: dateEnc };
}

// Builds a full .zip buffer: one local file header + deflated data per
// file, then the central directory, then the End Of Central Directory
// record. No directory entries — extractors create parent directories
// implicitly from each entry's path. Each entry is { fullPath, zipPath }
// — zipPath (e.g. "spirit/run/js/kernel.js") is what an extractor
// writes to disk, so extracting reproduces a top-level spirit/ folder
// wrapping run/ — exactly what server.js's verifyStartupCwd() requires
// (cwd's parent must be literally named "spirit"). fullPath is where
// this build actually reads the bytes from, which isn't always the
// same place — e.g. install/microscopic/README.txt is injected at
// spirit/README.txt, since a README describing an already-installed,
// standalone product would be inaccurate sitting inside the source
// tree itself (it's only true once it's the top level of an unzipped
// copy).
function buildZip(entries) {
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const entry of entries) {
    const data = fs.readFileSync(entry.fullPath);
    const stat = fs.statSync(entry.fullPath);
    const crc = crc32(data);
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const { time, date } = toDosDateTime(stat.mtime);
    const nameBuf = Buffer.from(entry.zipPath, 'utf8');

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version needed to extract
    localHeader.writeUInt16LE(0x0800, 6); // flags: UTF-8 filename
    localHeader.writeUInt16LE(8, 8); // compression method: deflate
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(date, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length
    localChunks.push(localHeader, nameBuf, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed to extract
    centralHeader.writeUInt16LE(0x0800, 8); // flags
    centralHeader.writeUInt16LE(8, 10); // compression method
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(date, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra field length
    centralHeader.writeUInt16LE(0, 32); // file comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal file attributes
    centralHeader.writeUInt32LE(0o644 << 16, 38); // external attrs (unix perms, for cross-platform extractors)
    centralHeader.writeUInt32LE(offset, 42); // offset of local header
    centralChunks.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralDirBuf = Buffer.concat(centralChunks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk where central directory starts
  eocd.writeUInt16LE(entries.length, 8); // central dir records on this disk
  eocd.writeUInt16LE(entries.length, 10); // total central dir records
  eocd.writeUInt32LE(centralDirBuf.length, 12);
  eocd.writeUInt32LE(offset, 16); // offset of start of central directory
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localChunks, centralDirBuf, eocd]);
}

function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  const relativePaths = execSync('git ls-files -- spirit ":!spirit/test"', { cwd: REPO_ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);

  const entries = [
    // Install-specific, not part of the tracked spirit/ tree (it would
    // describe an already-installed, standalone product while sitting
    // inside the source repo, which is only true once it's actually
    // the top level of an unzipped copy) — injected here instead.
    { fullPath: path.join(__dirname, 'start.cmd'), zipPath: 'start.cmd' },
    { fullPath: path.join(__dirname, 'start.ps1'), zipPath: 'start.ps1' },
    { fullPath: path.join(__dirname, 'README.txt'), zipPath: 'README.txt' },
  ].concat(relativePaths.map((relPath) => ({ fullPath: path.join(REPO_ROOT, relPath), zipPath: relPath })));

  const zipBuffer = buildZip(entries);

  fs.mkdirSync(RELEASE_DIR, { recursive: true });
  const outputPath = path.join(RELEASE_DIR, `chat-windows_v${pkg.version}.zip`);
  fs.writeFileSync(outputPath, zipBuffer);
  console.log(`Wrote ${outputPath} — ${entries.length} files, ${(zipBuffer.length / 1024).toFixed(1)} KB`);
}

main();
