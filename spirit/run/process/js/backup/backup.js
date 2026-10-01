'use strict';

// spirit/run/process/js/backup/backup.js
// THE BACKUP SERVER — desk/G1.7.
//
//   Andy, on G1.7: "how can i trust the copy mechanist when i cant see it
//   working", then "copies follow changes only; closes no longer matter",
//   "we just decided: 1", and "agreed on the short hash".
//
// DECIDED in Desk (desk/G1, O2 and O5-O8), not this file's to undo:
//   - it copies relay-state/process/ and nothing else under relay-state:
//     never identity.json, never a key. The node's name and public key are
//     handed over as --node (jobs.startNodeServers); identity.json holds the
//     private keys, so this process never opens it.
//   - the copy lands in <spiritHome>/backups/<12 hex of sha256(publicKey)>/,
//     mirroring the checkout's paths, with node.json naming the node.
//     spiritHome is relay-state/config.json's, else <home>/.SpiritOS.
//   - it runs once at start, then after each change under relay-state/
//     process/ once quiet for quietMs. Its own state folder is neither
//     watched nor copied, or it would start itself.
//   - ONE copy of each file (O8). A run compares first (size, then hash);
//     unchanged copies nothing but still says it checked.
//   - a database goes through SQLite's own backup, never as a plain file,
//     and a new copy that does not open never replaces the last good one.
//   - every run prints one line, here, in its Jobs console: what it wrote,
//     with full paths and sizes (Andy: "any export can report the location
//     of the exported file", "in jobs if it is a server").

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const sqlite = require('node:sqlite');
const appServer = require('../../../js/appServer.js');

const argv = process.argv;
function arg(name) { const at = argv.indexOf(name); return at !== -1 ? argv[at + 1] : ''; }
function parsed(text, fallback) { try { return JSON.parse(text); } catch (e) { return fallback; } }

const STATE = arg('--state');
if (!STATE) {
  console.error('backup: no --state; the node that starts this names its state folder');
  process.exit(2);
}
const NODE = parsed(arg('--node'), null);
if (!NODE || !NODE.publicKey) {
  console.error('backup: no --node; the node that starts this hands over its name and public key');
  process.exit(2);
}
const values = parsed(argv[2], {}) || {};
const QUIET = Number(values.quietMs) > 0 ? Number(values.quietMs) : 5000;

// relay-state is the state folder's grandparent: relay-state/process/backup.
const SOURCE = path.dirname(STATE);
const RELAY_STATE = path.dirname(SOURCE);
const OWN = path.basename(STATE);
fs.mkdirSync(STATE, { recursive: true });

function spiritHome() {
  const cfg = parsed(readText(path.join(RELAY_STATE, 'config.json')), {}) || {};
  return cfg.spiritHome ? String(cfg.spiritHome) : path.join(os.homedir(), '.SpiritOS');
}
function readText(file) { try { return fs.readFileSync(file, 'utf8'); } catch (e) { return ''; } }
const TAG = crypto.createHash('sha256').update(String(NODE.publicKey)).digest('hex').slice(0, 12);

// What each source looked like when it was last copied: size and hash,
// kept in its own state so a restart does not copy everything again.
const SEEN_FILE = path.join(STATE, 'seen.json');
let seen = parsed(readText(SEEN_FILE), {}) || {};
const status = { lastCheck: '', lastCopy: seen['.lastCopy'] || '', lastError: '' };

// A database's companions are part of it: its -wal holds rows not yet in
// the file, so it counts in the hash; none of them is copied on its own.
const COMPANION = /-(wal|shm|journal)$/;
function isDb(name) { return /\.(db|sqlite|sqlite3)$/i.test(name); }

function sourceFiles() {
  const out = [];
  (function walk(dir, rel) {
    let es = [];
    try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    es.forEach(function (e) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (!rel && e.name === OWN) return;
      // NEVER A KEY (Andy: "don't include my private key in the backup"). A
      // face keeps its own node identity in a relay-state/ of its own inside
      // its state folder (slim/G1.4, wsl-claude's finding): no nested
      // relay-state/ is walked, and no identity.json is copied wherever it is.
      if (e.isDirectory()) { if (e.name !== 'relay-state') walk(path.join(dir, e.name), r); }
      else if (e.isFile() && !COMPANION.test(e.name) && e.name !== 'identity.json') out.push(r);
    });
  })(SOURCE, '');
  return out.sort();
}
function fingerprint(file) {
  const parts = [file].concat(isDb(file) ? [file + '-wal'] : []);
  const h = crypto.createHash('sha256');
  let size = 0;
  parts.forEach(function (p) {
    let b = null;
    try { b = fs.readFileSync(p); } catch (e) { b = null; }
    if (b) { size += b.length; h.update(b); }
    h.update('\0');
  });
  return size + ':' + h.digest('hex');
}

function copyPlain(src, dest) {
  const part = dest + '.part';
  fs.copyFileSync(src, part);
  fs.renameSync(part, dest);
}
// Through SQLite, so rows still in the -wal are in the copy and a write in
// flight never tears it; then made one self-contained file, and opened to
// prove it opens before it replaces the last good copy.
async function copyDb(src, dest) {
  const part = dest + '.part';
  try { fs.rmSync(part, { force: true }); } catch (e) { /* none */ }
  const from = new sqlite.DatabaseSync(src, { readOnly: true });
  try { await sqlite.backup(from, part); } finally { from.close(); }
  const check = new sqlite.DatabaseSync(part);
  try {
    check.exec('PRAGMA journal_mode=DELETE');
    const ok = check.prepare('PRAGMA quick_check').get();
    if (!ok || Object.values(ok)[0] !== 'ok') throw new Error('quick_check failed');
  } finally { check.close(); }
  fs.renameSync(part, dest);
}

async function run() {
  const home = spiritHome();
  const dest = path.join(home, 'backups', TAG);
  const now = new Date().toISOString();
  const said = [];
  const errors = [];
  fs.mkdirSync(dest, { recursive: true });
  const nodeJson = JSON.stringify({ name: String(NODE.name || ''), publicKey: String(NODE.publicKey) }, null, 2) + '\n';
  if (readText(path.join(dest, 'node.json')) !== nodeJson) fs.writeFileSync(path.join(dest, 'node.json'), nodeJson);
  for (const rel of sourceFiles()) {
    const src = path.join(SOURCE, rel);
    const to = path.join(dest, 'relay-state', 'process', ...rel.split('/'));
    const print = fingerprint(src);
    // A missing destination is a change (Andy, O5), so a new home copies all.
    if (seen[rel] === print && fs.existsSync(to)) continue;
    try {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      if (isDb(rel)) await copyDb(src, to);
      else copyPlain(src, to);
      seen[rel] = print;
      said.push('wrote ' + to + ' ' + fs.statSync(to).size);
    } catch (e) {
      try { fs.rmSync(to + '.part', { force: true }); } catch (e2) { /* none */ }
      const what = 'kept ' + to + ': new copy did not open';
      said.push(what);
      errors.push(what + ' (' + ((e && e.message) || e) + ')');
    }
  }
  status.lastCheck = now;
  if (said.some(function (s) { return s.indexOf('wrote ') === 0; })) { status.lastCopy = now; seen['.lastCopy'] = now; }
  status.lastError = errors.join('; ');
  try { fs.writeFileSync(SEEN_FILE, JSON.stringify(seen)); } catch (e) { /* the next run copies again */ }
  console.log(now + ' ' + (said.length ? said.join(', ') : 'checked, unchanged since ' + (status.lastCopy || 'never')));
}

// ONE RUN AT A TIME; a change during a run starts one more after it.
let running = false;
let again = false;
let timer = null;
function kick() {
  if (running) { again = true; return; }
  running = true;
  run().catch(function (e) {
    status.lastError = 'the run broke: ' + ((e && e.message) || e);
    console.log(new Date().toISOString() + ' ' + status.lastError);
  }).then(function () {
    running = false;
    if (again) { again = false; soon(); }
  });
}
function soon() { clearTimeout(timer); timer = setTimeout(kick, QUIET); }

fs.watch(SOURCE, { recursive: true }, function (type, name) {
  const rel = String(name || '').split(path.sep).join('/');
  if (!rel || rel === OWN || rel.indexOf(OWN + '/') === 0) return;
  if (/-shm$/.test(rel)) return;
  soon();
});

appServer.serve({
  'status.get': {
    request: {}, reply: { lastCheck: '', lastCopy: '', lastError: '' },
    handler: function () { return { lastCheck: status.lastCheck, lastCopy: status.lastCopy, lastError: status.lastError }; },
  },
// No peer user: backup is the owner's housekeeping (apiAuth/G1.10).
}, { dependencies: [] });
kick();
