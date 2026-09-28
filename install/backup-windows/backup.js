// A crude, periodic, ENCRYPTED backup of a node's relay-state folder.
//
// transport/R19.1. Andy: "it's required to pull this off safely and keep my
// node safer" — the node log moves into node.db, and losing node.db is
// covered by backups, not by a rebuild (his decision, 2026-09-28: "i'm ok
// with that risk, i'd rather rely on backups, and not worry about it").
//
// Machine-side, not part of the product: nothing in spirit/run calls this.
// Run it by hand or from Windows Task Scheduler (see README.txt).
//
// ENCRYPTED BECAUSE THE TARGET SYNCS. Andy: "i want it synced for extra
// backup for now" — the default target is his Google Drive folder, and
// relay-state holds the node's private keys and every opened message. So
// each run writes ONE sealed file (AES-256-GCM, key from scrypt over a
// passphrase only he holds), and Google keeps a blob it cannot read.
//
// CONSISTENT WHILE THE NODE RUNS. A .db file is not copied byte for byte:
// it is written out with SQLite's `VACUUM INTO`, which reads one consistent
// snapshot even while the node is writing. Journal files are skipped.
//
//   node backup.js [--from <relay-state>] [--to <folder>] [--keep <n>]
//                  [--passphrase-file <file>]

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

// Windows' own tar (bsdtar). A Git-for-Windows tar earlier on PATH reads 'D:' as a remote host.
const TAR = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
const MAGIC = Buffer.from('SPBK1');      // format tag: version 1
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const FROM = path.resolve(arg('from', path.join(__dirname, '..', '..', 'spirit', 'run', 'relay-state')));
const TO = path.resolve(arg('to', 'D:\\countinn@google.com\\SpiritOS-data-backup'));
const KEEP = Math.max(1, Number(arg('keep', 24)) || 24);
// OUTSIDE ANY SYNCED FOLDER, on purpose: the passphrase must never travel
// with the files it unlocks.
const PASS_FILE = path.resolve(arg('passphrase-file', path.join(os.homedir(), '.spirit-backup-passphrase')));

function stamp(d) {
  const p = function (n) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

function readPassphrase() {
  let pass = '';
  try { pass = fs.readFileSync(PASS_FILE, 'utf8').trim(); } catch (e) { /* said below */ }
  if (pass.length < 12) {
    throw new Error('no passphrase: put one of 12 or more characters in ' + PASS_FILE +
      ' (and keep a copy somewhere safe: without it the backups cannot be opened)');
  }
  return pass;
}

function snapshot(into) {
  const { DatabaseSync } = require('node:sqlite');
  fs.mkdirSync(into, { recursive: true });
  const names = fs.readdirSync(FROM).filter(function (n) { return !/-(journal|wal|shm)$/.test(n); });
  names.forEach(function (n) {
    const src = path.join(FROM, n);
    if (!fs.statSync(src).isFile()) return;
    const dst = path.join(into, n);
    if (/\.db$/.test(n)) {
      const db = new DatabaseSync(src, { readOnly: true });
      // node.db runs a rollback journal (nodeStore.js:192): while the node
      // holds its write lock a reader is refused at once, so wait for it
      // rather than fail an hourly run now and then (wsl-claude's review).
      try { db.exec('PRAGMA busy_timeout = 5000'); db.exec("VACUUM INTO '" + dst.replace(/'/g, "''") + "'"); } finally { db.close(); }
    } else {
      fs.copyFileSync(src, dst);
    }
  });
  return names.length;
}

function seal(plain, pass) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(pass, salt, 32, SCRYPT);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([MAGIC, salt, iv, c.getAuthTag(), body]);
}

function prune() {
  const mine = fs.readdirSync(TO).filter(function (n) { return /^spirit-backup-\d{8}-\d{6}\.tgz\.enc$/.test(n); }).sort();
  const gone = mine.slice(0, Math.max(0, mine.length - KEEP));
  gone.forEach(function (n) { fs.unlinkSync(path.join(TO, n)); });
  return gone.length;
}

// A run killed half-way never reaches its `finally`, and would leave an
// UNENCRYPTED copy of relay-state (private key included) in the temp
// folder. So every run first clears what an earlier one left behind: any
// spirit-backup-* working folder older than an hour.
function clearStale() {
  const tmp = os.tmpdir();
  let gone = 0;
  fs.readdirSync(tmp).forEach(function (n) {
    if (!/^spirit-backup-/.test(n)) return;
    const p = path.join(tmp, n);
    try {
      if (Date.now() - fs.statSync(p).mtimeMs > 60 * 60 * 1000) { fs.rmSync(p, { recursive: true, force: true }); gone += 1; }
    } catch (e) { /* somebody else's, or already gone */ }
  });
  return gone;
}

function main() {
  clearStale();
  const pass = readPassphrase();
  if (!fs.existsSync(FROM)) throw new Error('no relay-state at ' + FROM);
  fs.mkdirSync(TO, { recursive: true });
  const name = 'spirit-backup-' + stamp(new Date()) + '.tgz.enc';
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-backup-'));
  try {
    const count = snapshot(path.join(work, 'relay-state'));
    const tgz = path.join(work, 'relay-state.tgz');
    execFileSync(TAR, ['-czf', tgz, '-C', work, 'relay-state']);
    const sealed = seal(fs.readFileSync(tgz), pass);
    // Written under a temporary name and renamed, so a syncing folder never
    // uploads half a file.
    const part = path.join(TO, name + '.part');
    fs.writeFileSync(part, sealed);
    fs.renameSync(part, path.join(TO, name));
    const pruned = prune();
    console.log(new Date().toISOString() + ' backed up ' + count + ' files, ' + sealed.length + ' bytes -> ' +
      path.join(TO, name) + (pruned ? ' (' + pruned + ' old removed, ' + KEEP + ' kept)' : ''));
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

if (require.main === module) {
  try { main(); } catch (e) { console.error(new Date().toISOString() + ' backup FAILED: ' + e.message); process.exit(1); }
}

module.exports = { seal: seal, MAGIC: MAGIC, SCRYPT: SCRYPT, TAR: TAR };
