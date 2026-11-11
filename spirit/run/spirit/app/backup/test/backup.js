'use strict';

// spirit/run/spirit/app/backup/test/backup.js
// THE BACKUP SERVER COPIES THE NODE'S STATE (goal/G43.23, item 5; spec: ./backup.md). The box: "backup copies
// nothing: it copies only its own state folder and reads a config path that does not exist". The real backup.js of this
// tree, started as the node starts it (job.js runServer: --state spirit/state/backup/data, --node {name, publicKey}), on
// a scratch tree under /tmp: another process's state and a node.db planted in its spirit/state/, and a config.json
// naming a spiritHome. HOME points into the scratch too, so a fallback home never reaches a real one. No node runs.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const SCRIPT = path.join(RUN, 'spirit', 'app', 'backup', 'backup.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
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
// The planted row, read out of a database file; '' when it is no database or holds no such row.
function dbMark(file) {
  const { DatabaseSync } = require('node:sqlite');
  let db = null;
  try { db = new DatabaseSync(file, { readOnly: true }); const r = db.prepare('SELECT v FROM mark').get(); return r ? String(r.v) : ''; }
  catch (e) { return ''; } finally { try { if (db) db.close(); } catch (e) { /* closed */ } }
}

// backup.js: the backup server copies the node's state, to the spiritHome of spirit/state/config.json (goal/G43.23, item 5)
// One test.run per test (goal/G47.2). What the world made, for the tests after it.
const W = {};
W.scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-'));
W.run = path.join(W.scratch, 'run');
W.state = path.join(W.run, 'spirit', 'state');
W.own = path.join(W.state, 'backup', 'data');
W.homeCfg = path.join(W.scratch, 'homeCfg');
W.fakeHome = path.join(W.scratch, 'home');
const DESK_MARK = 'desk state ' + process.pid + ' ' + Date.now();
const NODE_MARK = 'node.db row ' + process.pid + ' ' + Date.now();
test.after(async function () {
  try { if (W.kid) W.kid.kill(); } catch (e) { /* gone */ }
  await sleep(200);
  try { fs.rmSync(W.scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});

test.run('the world: spirit/state/ holds node.db with its row, desk/data/marker.json, and config.json naming a spiritHome', 0.2, function () {
  const state = W.state;
  fs.mkdirSync(W.own, { recursive: true });
  fs.mkdirSync(path.join(state, 'desk', 'data'), { recursive: true });
  fs.mkdirSync(W.fakeHome, { recursive: true });
  fs.writeFileSync(path.join(state, 'desk', 'data', 'marker.json'), JSON.stringify({ mark: DESK_MARK }));
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(state, 'node.db'));
  db.exec('PRAGMA journal_mode = DELETE'); db.exec('CREATE TABLE mark (v TEXT)'); db.prepare('INSERT INTO mark (v) VALUES (?)').run(NODE_MARK); db.close();
  fs.writeFileSync(path.join(state, 'config.json'), JSON.stringify({ spiritHome: W.homeCfg }));
  return dbMark(path.join(state, 'node.db')) === NODE_MARK && readText(path.join(state, 'desk', 'data', 'marker.json')).indexOf(DESK_MARK) !== -1
    ? true : 'the scratch state was not planted: nothing judged';
}, 1000);

test.run('the world: the backup server ran once and said so', 0.2, async function () {
  // A named pipe on Windows, as the node names its servers' (appClient.js); a socket file elsewhere.
  const pipe = process.platform === 'win32' ? '\\\\.\\pipe\\spirit-backupCopies-' + process.pid : path.join(W.scratch, 'b.sock');
  const node = JSON.stringify({ name: 'scratch', publicKey: 'scratch-public-key-' + process.pid });
  const env = Object.assign({}, process.env, { HOME: W.fakeHome, USERPROFILE: W.fakeHome });
  let out = '';
  W.kid = spawn(process.execPath, [SCRIPT, JSON.stringify({ quietMs: 200 }), '--pipe', pipe, '--state', W.own, '--node', node], { cwd: W.run, env: env, stdio: ['ignore', 'pipe', 'pipe'] });
  W.kid.stdout.on('data', function (b) { out += b; });
  W.kid.stderr.on('data', function (b) { out += b; });
  const t0 = Date.now();
  while (Date.now() - t0 < 15000 && !/ (wrote |checked|kept |the run broke)/.test(out)) await sleep(100);
  await sleep(500);
  const homes = [W.homeCfg, path.join(W.fakeHome, '.SpiritOS')];
  W.copied = [].concat.apply([], homes.map(function (h) { return filesUnder(path.join(h, 'backups')); }));
  return / (wrote |checked)/.test(out) ? true : 'the backup server said no run in 15 s: nothing judged. It said: ' + short(out);
}, 3000);

// The box: "it copies only its own state folder"
test.run('another process\'s state, spirit/state/desk/data/marker.json, is copied', 0.2, function () {
  const copied = W.copied || [];
  const desk = copied.filter(function (f) { return readText(f).indexOf(DESK_MARK) !== -1; });
  return desk.length > 0 ? true : 'spirit/state/desk/data/marker.json is not copied anywhere; the backup wrote only ' + short(copied.map(function (f) { return path.relative(W.scratch, f); }));
}, 1000);
test.run('the node\'s node.db is copied, its row in the copy', 0.2, function () {
  const copied = W.copied || [];
  const ndb = copied.filter(function (f) { return dbMark(f) === NODE_MARK; });
  return ndb.length > 0 ? true : 'spirit/state/node.db is not copied anywhere; the backup wrote only ' + short(copied.map(function (f) { return path.relative(W.scratch, f); }));
}, 1000);

// The box: "reads a config path that does not exist"
test.run('the backup lands under the spiritHome of spirit/state/config.json, nothing under the fallback home', 0.2, function () {
  const inCfg = filesUnder(path.join(W.homeCfg, 'backups'));
  const inFallback = filesUnder(path.join(W.fakeHome, '.SpiritOS'));
  return inCfg.length > 0 && inFallback.length === 0 ? true
    : 'spirit/state/config.json\'s spiritHome is not used: ' + inCfg.length + ' files under it, ' + inFallback.length + ' under <home>/.SpiritOS (' + short(inFallback.map(function (f) { return path.relative(W.scratch, f); })) + ')';
}, 1000);
