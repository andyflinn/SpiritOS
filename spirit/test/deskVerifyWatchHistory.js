'use strict';

// goal/G8.10: the watcher's first walk is history, every page of it.
//
// FOUND ON HIS NODE at b5ea0779, minutes after the build landed: his desk answers `changes` a page at a time, and the
// watcher judged "is this history?" inside the page loop. Page one moved the cursor, so from page two on every old
// verify pass on the record triggered a check, and items of goal/G6 - verified long ago, with no test file on their
// lists - were rejected one after another. A restart must trigger nothing, however many pages the record takes.
//
// claude-windows wrote the red for the watcher itself (deskVerifyWatch.js); this one is wsl-claude's, written for the
// bug its fake desk could not see, because that one answers every record in a single page.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G8.10: ';
const VERIFY = path.join(__dirname, '..', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js');
const GREEN = 'zzWatchHistoryGreen.js';
const PAGE = 2; // the record is walked in pages of two, as his desk pages its own.

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('goal/G8.10: the watcher treats its whole first walk as history, page after page');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-watchhistory-'));

(async function () {
  fs.writeFileSync(path.join(__dirname, GREEN), "'use strict';\nconst test = require('./testSupport.js');\ntest.startTest('watch history probe');\ntest.check('green');\ntest.reportSuccessFailureCount();\nprocess.exit(0);\n");
  const files = [{ path: 'spirit/test/' + GREEN, by: 'wsl-claude', core: false }];
  const records = [];
  const rec = function (verb, body) { records.push({ n: records.length + 1, at: new Date().toISOString(), verb: verb, by: 'claude-windows', key: '', body: JSON.stringify(body) }); };
  const asks = [];
  // THE WORLD: six verify passes already on the record, so the first walk takes three pages.
  ['wh/G1.1', 'wh/G1.2', 'wh/G1.3', 'wh/G1.4', 'wh/G1.5', 'wh/G1.6'].forEach(function (id) { rec('phase.done', { id: id, phase: 'verify', pass: true }); });

  const node = await new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = '';
      req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        let out = {};
        if (j && j.ask === 'api') out = { desk: {}, deskVerify: {} };
        else if (j && j.ask && j.ask.desk) {
          const verb = Object.keys(j.ask.desk)[0];
          const a = j.ask.desk[verb] || {};
          if (verb === 'changes') {
            // ONE PAGE AT A TIME, as his desk answers: `more` says another page follows, and `n` is the newest record
            // this page carries - not the end of the record.
            const from = Number(a.n) || 0;
            const recs = records.filter(function (r) { return r.n > from; }).slice(0, PAGE);
            const last = recs.length ? recs[recs.length - 1].n : from;
            out = { records: recs, lines: [], n: last, line: 0, more: last < records.length };
          } else {
            asks.push({ verb: verb, args: a });
            if (verb === 'item.get') out = { item: JSON.stringify({ id: a.id, goal: 'wh/G1', code: true, go: true, files: files }), version: 1, change: 1 };
            else out = { change: 1 };
          }
        } else if (j && j.ask && j.ask.deskVerify && j.ask.deskVerify.record) out = { written: true };
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });

  const root = path.join(scratch, 'verify');
  const state = path.join(root, 'state');
  fs.mkdirSync(state, { recursive: true });
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(root, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, 'deskVerify', 'win32', 'process') : path.join(root, 'door.sock');
  const client = appClient.createAppClient({ rootDir: root });
  client.register('deskVerify', pipe);
  const args = { db: path.join(root, 'verify.db'), watchMs: 300, suiteMs: 4000 };
  const kid = spawn(process.execPath, [VERIFY, JSON.stringify(args), '--pipe', pipe, '--state', state], { cwd: root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const up = async function () { for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.deskVerify && r.body.deskVerify.ok !== false) return true; } catch (e) { /* not yet */ } } return false; };
  const spoke = function () { return asks.filter(function (x) { return x.verb === 'verify.pass' || x.verb === 'verify.reject'; }); };
  try {
    if (!await up()) { test.fail('deskVerify did not start'); return; }
    await sleep(2500);
    // The control: it did read the record, so silence is a decision and not a dead watcher.
    if (asks.length === 0 || spoke().length === 0) test.check('the world: six old passes, three pages, and not a word to the desk');
    else test.fail(OWED + 'the watcher re-checked its history: ' + short(spoke()));
    if (!spoke().length) test.check('a restart triggers nothing, however many pages the record takes');
    else test.fail(OWED + 'it spoke about ' + short(spoke().map(function (x) { return x.args.id; })));

    // AND IT IS WATCHING: the next pass, after the walk, is checked - so the silence above is history alone.
    rec('phase.done', { id: 'wh/G1.7', phase: 'verify', pass: true });
    const t = Date.now() + 8000;
    while (Date.now() < t && !asks.some(function (x) { return x.verb === 'verify.pass' && x.args.id === 'wh/G1.7'; })) await sleep(200);
    if (asks.some(function (x) { return x.verb === 'verify.pass' && x.args.id === 'wh/G1.7'; })) test.check('and a pass written after the walk is checked, so the watcher is alive');
    else test.fail(OWED + 'the new pass was not checked: ' + short(asks));
    if (!spoke().some(function (x) { return x.args.id !== 'wh/G1.7'; })) test.check('and it still said nothing about the six old ones');
    else test.fail(OWED + 'it spoke about an old pass: ' + short(spoke().map(function (x) { return x.args.id; })));
  } finally {
    await new Promise(function (r) { kid.once('exit', r); kid.kill(); setTimeout(r, 3000); });
    node.close();
  }
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.unlinkSync(path.join(__dirname, GREEN)); } catch (e) { /* gone */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
