'use strict';

// spirit/run/process/js/backup/test/backupCopies.js
// THE BACKUP SERVER COPIES THE NODE'S STATE (goal/G43.23, item 5; spec: ./backupCopies.md). The box: "backup copies
// nothing: it copies only its own state folder and reads a config path that does not exist". The real backup.js of this
// tree, started as the node starts it (jobs.js runServer: --state spirit/state/backup/data, --node {name, publicKey}), on
// a scratch tree under /tmp: another process's state and a node.db planted in its spirit/state/, and a config.json
// naming a spiritHome. HOME points into the scratch too, so a fallback home never reaches a real one. No node runs.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const SCRIPT = path.join(RUN, 'process', 'js', 'backup', 'backup.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
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

test.startTest('backupCopies.js: the backup server copies the node\'s state, to the spiritHome of spirit/state/config.json (goal/G43.23, item 5)');

(async function () {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-'));
  const run = path.join(scratch, 'run');
  const state = path.join(run, 'spirit', 'state');
  const own = path.join(state, 'backup', 'data');
  const homeCfg = path.join(scratch, 'homeCfg');
  const fakeHome = path.join(scratch, 'home');
  const DESK_MARK = 'desk state ' + process.pid + ' ' + Date.now();
  const NODE_MARK = 'node.db row ' + process.pid + ' ' + Date.now();
  let kid = null;
  try {
    fs.mkdirSync(own, { recursive: true });
    fs.mkdirSync(path.join(state, 'desk', 'data'), { recursive: true });
    fs.mkdirSync(fakeHome, { recursive: true });
    fs.writeFileSync(path.join(state, 'desk', 'data', 'marker.json'), JSON.stringify({ mark: DESK_MARK }));
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(state, 'node.db'));
    db.exec('PRAGMA journal_mode = DELETE'); db.exec('CREATE TABLE mark (v TEXT)'); db.prepare('INSERT INTO mark (v) VALUES (?)').run(NODE_MARK); db.close();
    fs.writeFileSync(path.join(state, 'config.json'), JSON.stringify({ spiritHome: homeCfg }));
    ok(dbMark(path.join(state, 'node.db')) === NODE_MARK && readText(path.join(state, 'desk', 'data', 'marker.json')).indexOf(DESK_MARK) !== -1,
      'the world: spirit/state/ holds node.db with its row, desk/data/marker.json, and config.json naming a spiritHome',
      'the scratch state was not planted: nothing judged');

    const pipe = path.join(scratch, 'b.sock');
    const node = JSON.stringify({ name: 'scratch', publicKey: 'scratch-public-key-' + process.pid });
    const env = Object.assign({}, process.env, { HOME: fakeHome, USERPROFILE: fakeHome });
    let out = '';
    kid = spawn(process.execPath, [SCRIPT, JSON.stringify({ quietMs: 200 }), '--pipe', pipe, '--state', own, '--node', node], { cwd: run, env: env, stdio: ['ignore', 'pipe', 'pipe'] });
    kid.stdout.on('data', function (b) { out += b; });
    kid.stderr.on('data', function (b) { out += b; });
    const t0 = Date.now();
    while (Date.now() - t0 < 15000 && !/ (wrote |checked|kept |the run broke)/.test(out)) await sleep(100);
    await sleep(500);
    ok(/ (wrote |checked)/.test(out), 'the world: the backup server ran once and said so: ' + short(out.trim().split('\n').pop()),
      'the backup server said no run in 15 s: nothing judged. It said: ' + short(out));

    const homes = [homeCfg, path.join(fakeHome, '.SpiritOS')];
    const copied = [].concat.apply([], homes.map(function (h) { return filesUnder(path.join(h, 'backups')); }));

    test.subHeading('The box: "it copies only its own state folder"');
    const desk = copied.filter(function (f) { return readText(f).indexOf(DESK_MARK) !== -1; });
    ok(desk.length > 0, 'another process\'s state, spirit/state/desk/data/marker.json, is copied: ' + short(desk),
      'spirit/state/desk/data/marker.json is not copied anywhere; the backup wrote only ' + short(copied.map(function (f) { return path.relative(scratch, f); })));
    const ndb = copied.filter(function (f) { return dbMark(f) === NODE_MARK; });
    ok(ndb.length > 0, 'the node\'s node.db is copied, its row in the copy: ' + short(ndb),
      'spirit/state/node.db is not copied anywhere; the backup wrote only ' + short(copied.map(function (f) { return path.relative(scratch, f); })));

    test.subHeading('The box: "reads a config path that does not exist"');
    const inCfg = filesUnder(path.join(homeCfg, 'backups'));
    const inFallback = filesUnder(path.join(fakeHome, '.SpiritOS'));
    ok(inCfg.length > 0 && inFallback.length === 0, 'the backup lands under the spiritHome of spirit/state/config.json (' + inCfg.length + ' files), nothing under the fallback home',
      'spirit/state/config.json\'s spiritHome is not used: ' + inCfg.length + ' files under it, ' + inFallback.length + ' under <home>/.SpiritOS (' + short(inFallback.map(function (f) { return path.relative(scratch, f); })) + ')');
  } finally {
    try { if (kid) kid.kill(); } catch (e) { /* gone */ }
    await sleep(200);
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
