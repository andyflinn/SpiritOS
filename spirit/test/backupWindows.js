'use strict';

// spirit/test/backupWindows.js
// THE WINDOWS BACKUP HOLDS node.db AND THE KEYS (goal/G43.23, item 5; spec: ./backupWindows.md). The box: "the Windows
// backup misses node.db and the keys." This tree's backup.js, copied into a scratch SpiritOS tree under /tmp shaped as a
// node keeps it now (node.db and identity.json in spirit/run/spirit/state/, relay-state/ holding only process/ and
// shell/), run as run.cmd runs it (no --from), its sealed file opened with the passphrase and unpacked. Its temp folder,
// its target and its passphrase are all in the scratch.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync, execFileSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const test = require(path.join(REPO, 'spirit', 'run', 'test', 'testReport.js'));
const SCRIPT = path.join(REPO, 'install', 'backup-windows', 'backup.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function filesUnder(dir) {
  const out = [];
  (function walk(d) {
    let es = [];
    try { es = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    es.forEach(function (e) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.isFile()) out.push(p); });
  })(dir);
  return out;
}
function readText(f) { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } }
function dbMark(file) {
  const { DatabaseSync } = require('node:sqlite');
  let db = null;
  try { db = new DatabaseSync(file, { readOnly: true }); const r = db.prepare('SELECT v FROM mark').get(); return r ? String(r.v) : ''; }
  catch (e) { return ''; } finally { try { if (db) db.close(); } catch (e) { /* closed */ } }
}
// The sealed file's layout is backup.js's own: MAGIC, salt 16, iv 12, tag 16, body (seal()).
function unseal(buf, pass, SCRYPT, MAGIC) {
  let at = MAGIC.length;
  const salt = buf.subarray(at, at += 16), iv = buf.subarray(at, at += 12), tag = buf.subarray(at, at += 16);
  const key = crypto.scryptSync(pass, salt, 32, SCRYPT);
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(buf.subarray(at)), d.final()]);
}

test.startTest('backupWindows.js: the Windows backup, run as run.cmd runs it, holds node.db and the keys of spirit/state/ (goal/G43.23, item 5)');

(function () {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'bkw-'));
  try {
    const tree = path.join(scratch, 'SpiritOS');
    const script = path.join(tree, 'install', 'backup-windows', 'backup.js');
    const state = path.join(tree, 'spirit', 'run', 'spirit', 'state');
    const relayState = path.join(tree, 'spirit', 'run', 'relay-state');
    fs.mkdirSync(path.dirname(script), { recursive: true });
    fs.copyFileSync(SCRIPT, script);
    fs.mkdirSync(state, { recursive: true });
    fs.mkdirSync(path.join(relayState, 'process', 'desk'), { recursive: true });
    fs.mkdirSync(path.join(relayState, 'shell'), { recursive: true });
    fs.writeFileSync(path.join(relayState, 'process', 'desk', 'desk.js.sidecar.json'), '{}');
    const NODE_MARK = 'node.db row ' + process.pid + ' ' + Date.now();
    const KEY_MARK = 'scratch-private-key-' + process.pid + '-' + Date.now();
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(state, 'node.db'));
    db.exec('PRAGMA journal_mode = DELETE'); db.exec('CREATE TABLE mark (v TEXT)'); db.prepare('INSERT INTO mark (v) VALUES (?)').run(NODE_MARK); db.close();
    fs.writeFileSync(path.join(state, 'identity.json'), JSON.stringify({ name: 'scratch', publicKey: 'scratch-public', privateKey: KEY_MARK }));
    const pass = 'scratch passphrase ' + process.pid;
    const passFile = path.join(scratch, 'pass');
    fs.writeFileSync(passFile, pass);
    const to = path.join(scratch, 'out');
    const tmp = path.join(scratch, 'tmp');
    fs.mkdirSync(tmp);
    ok(dbMark(path.join(state, 'node.db')) === NODE_MARK && readText(path.join(state, 'identity.json')).indexOf(KEY_MARK) !== -1,
      'the world: the scratch node keeps node.db and identity.json in spirit/run/spirit/state/, relay-state/ only process/ and shell/',
      'the scratch tree was not planted: nothing judged');

    const r = spawnSync(process.execPath, [script, '--to', to, '--passphrase-file', passFile], { cwd: scratch, encoding: 'utf8', env: Object.assign({}, process.env, { TMPDIR: tmp, TMP: tmp, TEMP: tmp }), timeout: 60000 });
    const said = String(r.stdout || '') + String(r.stderr || '');
    const sealed = filesUnder(to).filter(function (f) { return /\.tgz\.enc$/.test(f); });
    ok(r.status === 0 && sealed.length === 1, 'the world: a run with no --from, as run.cmd runs it, wrote one sealed file: ' + short(said.trim()),
      'the run wrote no sealed file (exit ' + r.status + '): nothing judged. It said: ' + short(said));
    if (sealed.length !== 1) return;
    const { MAGIC, SCRYPT } = require(script);
    const unpacked = path.join(scratch, 'unpacked');
    fs.mkdirSync(unpacked);
    fs.writeFileSync(path.join(scratch, 'plain.tgz'), unseal(fs.readFileSync(sealed[0]), pass, SCRYPT, MAGIC));
    execFileSync('tar', ['-xzf', path.join(scratch, 'plain.tgz'), '-C', unpacked]);
    const inside = filesUnder(unpacked);
    const top = fs.readdirSync(unpacked);
    ok(top.length > 0, 'the world: the sealed file opens with the passphrase and unpacks: ' + short(top) + ', ' + inside.length + ' files',
      'the sealed file opened but unpacked to nothing: nothing judged');
    const names = short(inside.map(function (f) { return path.relative(unpacked, f); }));

    test.subHeading('The box: "the Windows backup misses node.db and the keys."');
    const ndb = inside.filter(function (f) { return dbMark(f) === NODE_MARK; });
    ok(ndb.length > 0, 'node.db of spirit/state/ is in the backup, its row in the copy: ' + short(path.relative(unpacked, ndb[0] || '')),
      'node.db of spirit/state/ is not in the backup; it holds ' + names);
    const keys = inside.filter(function (f) { return readText(f).indexOf(KEY_MARK) !== -1; });
    ok(keys.length > 0, 'the keys, identity.json of spirit/state/, are in the backup: ' + short(path.relative(unpacked, keys[0] || '')),
      'the keys, identity.json of spirit/state/, are not in the backup; it holds ' + names);
  } finally {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}());
test.reportSuccessFailureCount();
process.exit(0);
