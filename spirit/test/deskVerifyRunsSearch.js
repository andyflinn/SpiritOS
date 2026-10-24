'use strict';

// spirit/test/deskVerifyRunsSearch.js
// goal/G33.7 (box v9): deskVerify's run search answers one suite's part per run. Found live at goal/G33.4's Done: the
// newest run (14, 111 suites at 5c11de1e) held 8,229 characters of suites, so its row could not come back in one answer;
// the search dropped it, and the desk read the older run 13 and wrote its "Done went over a red run" line from it.
// Andy, in the box: "The desk's interface itself prevents oversized answers", and "At every event the desk reads the
// newest run of each suite".
//
// WHAT IS ASSERTED, on a real deskVerify over a seeded verify.db (an old run of 3 suites, a newer run of 111 suites
// whose failure lines are long):
//   1. search {over: 'runs', suite} answers the newest run first, and each run's row carries only that suite's part:
//      the run's state, outcome, times, commit, dirty mark and line, and suites: [that one suite's entry].
//   2. every row it answers fits one answer.
//   4. a suite whose failure lines alone pass one answer still comes back: the lines that fit, and failuresMore.
//   3. search {over: 'runs'} with no suite still answers the newest run, its row bounded to one answer: as many suites
//      as fit, the rest counted (suitesTotal) and said (suitesMore).
// rule/11: through testSupport only; its own scratch folder, pipe and pretend node; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const test = require('./testSupport.js');
const appClient = require('../run/spirit/appClient.js');

const OWED = 'OWED by goal/G33.7 (runs search): ';
const VERIFY = path.join(__dirname, '..', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js');
const TARGET = 'spirit/test/zzRunsTarget.js';
// A suite whose own failure lines pass one answer by themselves.
const LOUD = 'spirit/test/zzRunsLoud.js';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { try { return JSON.parse(x); } catch (e) { return null; } }

test.startTest('goal/G33.7: deskVerify\'s run search answers one suite\'s part per run, every row in one answer');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskverifyrunssearch-'));
const dbPath = path.join(scratch, 'verify.db');
const repo = path.join(scratch, 'repo');
fs.mkdirSync(path.join(repo, 'spirit', 'test'), { recursive: true });
const pullProbe = path.join(scratch, 'pullProbe.js');
fs.writeFileSync(pullProbe, '// a pull that changes nothing\n');

// THE SEEDED RUNS, in the table deskVerify keeps (deskVerify.js, EVERY RUN IS A ROW).
function suiteEntry(p, outcome, lines) { return { path: p, outcome: outcome, failures: lines }; }
function seed() {
  const d = new DatabaseSync(dbPath);
  d.exec('CREATE TABLE IF NOT EXISTS runs (rowid INTEGER PRIMARY KEY AUTOINCREMENT, state TEXT NOT NULL, outcome TEXT NOT NULL,' +
    ' startedAt TEXT NOT NULL, endedAt TEXT NOT NULL, "commit" TEXT NOT NULL, dirty INTEGER NOT NULL, suites TEXT NOT NULL,' +
    ' line TEXT NOT NULL);');
  const ins = d.prepare('INSERT INTO runs (state, outcome, startedAt, endedAt, "commit", dirty, suites, line) VALUES (\'ended\', ?, ?, ?, ?, 0, ?, ?)');
  const old = [suiteEntry(TARGET, 'red', ['FAILURE #1.1: the old red of the target']), suiteEntry('spirit/test/zzRunsA.js', 'green', []), suiteEntry('spirit/test/zzRunsB.js', 'green', [])];
  ins.run('red', '2026-10-23T09:25:43.322Z', '2026-10-23T09:26:21.631Z', 'c50feb826f8240f0b986f5f4fb1e2af2614df950', JSON.stringify(old), 'red, 3 suites at c50feb82');
  const many = [];
  for (let i = 1; i <= 110; i++) {
    const lines = i % 3 === 0 ? ['FAILURE #1.' + i + ': ' + 'a long failure line of a suite that printed much, '.repeat(3)] : [];
    many.push(suiteEntry('spirit/test/zzRunsMany' + i + '.js', lines.length ? 'red' : 'green', lines));
  }
  many.splice(55, 0, suiteEntry(TARGET, 'green', []));
  ins.run('red', '2026-10-23T10:46:00.947Z', '2026-10-23T10:56:15.262Z', '5c11de1e51c4aa41f28f2475126c3609c44547ce', JSON.stringify(many), 'red, 111 suites at 5c11de1e');
  const loud = [];
  for (let i = 1; i <= 10; i++) loud.push('FAILURE #1.' + i + ': ' + 'x'.repeat(2000));
  ins.run('red', '2026-10-23T11:00:00.000Z', '2026-10-23T11:01:00.000Z', '5c11de1e51c4aa41f28f2475126c3609c44547ce', JSON.stringify([suiteEntry(LOUD, 'red', loud)]), 'red, 1 suite at 5c11de1e');
  d.close();
  return { manyChars: JSON.stringify(many).length };
}

// A PRETEND NODE for deskVerify's own asks: the family interfaces, and ok for the rest.
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw || '{}'); } catch (e) { b = {}; }
    const na = test.nodeApi(b);
    if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
  });
});

const root = path.join(scratch, 'verify');
const state = path.join(root, 'state');
fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
fs.mkdirSync(state, { recursive: true });
const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, 'deskVerify', 'win32', 'process') : path.join(root, 'door.sock');
const client = appClient.createAppClient({ rootDir: root });
client.register('deskVerify', pipe);
let kid = null;
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskVerifyRunsSearchOwnerAAAAAAAAAAAAAAAAAAA=', label: 'Andy' };
async function up() {
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body.deskVerify && r.body.deskVerify.ok !== false) return true; } catch (e) { /* not yet */ }
  }
  return false;
}
function search(args) {
  return client.ask({ deskVerify: { search: args } }, ANDY).then(function (r) { return r || {}; }, function (e) { return { status: 0, body: { error: e.message } }; });
}
const answerBytes = function (r) { return Buffer.byteLength(JSON.stringify(r.body || {}), 'utf8'); };

async function main() {
  const seeded = seed();
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  fs.writeFileSync(path.join(root, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.address().port }));
  kid = spawn(process.execPath, [VERIFY, JSON.stringify({ db: dbPath, repo: repo, suiteMs: 120000, idleCheckMs: 600000, pull: '"' + process.execPath + '" "' + pullProbe + '"' }),
    '--pipe', pipe, '--state', state], { cwd: root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'runs-search-verify', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.address().port + '/api/spirit' }) });
  if (!await up()) { test.fail('the world: deskVerify did not start'); return; }
  if (seeded.manyChars > appClient.ANSWER_MAX) test.check('the world: the newer run\'s suites take ' + seeded.manyChars + ' characters, past one answer (' + appClient.ANSWER_MAX + '), as run 14\'s did');
  else test.fail('the world: the newer run\'s suites take only ' + seeded.manyChars + ' characters');

  test.subHeading('1. a suite\'s runs: the newest first, each row only that suite\'s part');
  const one = await search({ over: 'runs', suite: TARGET });
  const rows = ((one.body || {}).items || []).map(function (i) { return { key: i.key, label: parse(i.label) || {} }; });
  const newest = rows[0] || { label: {} };
  const parts = rows.map(function (r) { return (r.label.suites || []).map(function (s) { return s.path; }).join(','); });
  if (one.status === 200 && rows.length === 2 && newest.key === '2' && newest.label.commit === '5c11de1e51c4aa41f28f2475126c3609c44547ce' && parts.every(function (p) { return p === TARGET; })) test.check('both runs came back, the newest (2, 111 suites) first, each row with only ' + TARGET + '\'s part');
  else test.fail(OWED + 'search for ' + TARGET + ' answered ' + one.status + ' with rows ' + short(rows.map(function (r) { return r.key + ':' + (r.label.suites || []).length + ' suites'; })) + ', more ' + short((one.body || {}).more));
  const part = (newest.label.suites || [])[0] || {};
  if (part.outcome === 'green' && newest.label.state === 'ended' && newest.label.outcome === 'red' && typeof newest.label.dirty === 'boolean' && /111 suites/.test(newest.label.line || '')) test.check('the newest row keeps the run\'s own state, outcome, commit, dirty mark and line, and the suite\'s own outcome (green)');
  else test.fail(OWED + 'the newest row reads ' + short(newest.label));

  test.subHeading('2. every row it answers fits one answer');
  if (one.status === 200 && answerBytes(one) <= appClient.ANSWER_MAX) test.check('the answer is ' + answerBytes(one) + ' bytes, under ' + appClient.ANSWER_MAX);
  else test.fail(OWED + 'the answer is ' + answerBytes(one) + ' bytes');

  test.subHeading('3. runs with no suite named: the newest still comes back, its row bounded');
  const all = await search({ over: 'runs' });
  const allRows = ((all.body || {}).items || []).map(function (i) { return { key: i.key, label: parse(i.label) || {} }; });
  const top = allRows.filter(function (r) { return r.key === '2'; })[0] || allRows.filter(function (r) { return r.label.suitesTotal === 111; })[0];
  if (all.status === 200 && top && answerBytes(all) <= appClient.ANSWER_MAX && top.label.suitesTotal === 111 && top.label.suitesMore === true && (top.label.suites || []).length < 111) test.check('the 111-suite run came back with ' + top.label.suites.length + ' of its ' + top.label.suitesTotal + ' suites and suitesMore, the answer ' + answerBytes(all) + ' bytes');
  else test.fail(OWED + 'search over runs answered ' + all.status + ', rows ' + short(allRows.map(function (r) { return r.key + ':' + (r.label.suites || []).length + '/' + r.label.suitesTotal; })) + ', ' + answerBytes(all) + ' bytes');

  test.subHeading('4. a suite whose failure lines alone pass one answer still comes back, cut, and says so');
  const loud = await search({ over: 'runs', suite: LOUD });
  const loudRow = (((loud.body || {}).items || [])[0]) || {};
  const loudPart = ((parse(loudRow.label || '') || {}).suites || [])[0] || {};
  if (loud.status === 200 && loudRow.key === '3' && answerBytes(loud) <= appClient.ANSWER_MAX && Array.isArray(loudPart.failures) && loudPart.failures.length >= 1 && loudPart.failuresMore === true) test.check('its run came back with ' + loudPart.failures.length + ' of its 10 lines and failuresMore, ' + answerBytes(loud) + ' bytes');
  else test.fail(OWED + 'search for ' + LOUD + ' answered ' + loud.status + ' ' + short(loud.body));
}

main().catch(function (e) { test.fail(OWED + 'the suite itself tripped: ' + (e && e.stack || e)); }).then(function () {
  try { if (kid && kid.exitCode === null) kid.kill(); } catch (e) { /* gone */ }
  try { node.close(); } catch (e) { /* closed */ }
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 500);
});
