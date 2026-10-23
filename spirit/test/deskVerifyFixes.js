'use strict';

// spirit/test/deskVerifyFixes.js
// goal/G21.3: the Verifier's fixes. Red first on aa748c2a; claude-windows wrote it and builds it (one agent). Reshaped
// by goal/G33.3, where deskVerify became a runner that knows nothing of the desk (Andy: "deskVerify has no fucking
// clue about desk, desk goals or desk items", "the verifier only is busy or not."): a run is handed to it with
// run {suites, commit}, its outcome is read through search, and its idle hour is its own clock.
//
// THE ITEM'S BOX, Andy's decisions, asserted one by one:
//   1. The Verifier tab stays once the page has loaded; only the first ask at load decides whether a verifier runs
//      here. A later missed answer keeps the tab and shows "not answering".
//   2. Every press in the tab shows at once that it was sent, then what deskVerify answered.
//   3. A Stop is kept for the whole run, whenever it is pressed (a suite running, pulling, between suites), and
//      deskVerify checks it before each suite; the tab shows "stop asked" until the run ends.
//   4. deskVerify answers at once even mid-run: the git work that blocked it (pull, ancestry checks) no longer freezes it.
//   5. deskVerify keeps, beside each failing test's outcome, its failure text (capped), so the why is in the record.
//   6. One search verb, bucket-bounded with the partial flag, over tests (the latest state of each: outcome, commit,
//      time, failure text; filters suite, test words, outcome, commit, since) and runs (each suite's outcome and
//      failure lines, the commit, the dirty mark, the line; filters suite, outcome, commit, since); a verb file, so
//      agents may call it.
//   7. The idle hour and its chores (goal/G8.4, its own clock since goal/G33.3): an hour with no run handed to it, then
//      the chores its manifest names, each handed the node's port, once per quiet stretch. The tab's countdown counts
//      to that hour and shows what the chores did.
//   And through all of it deskVerify asks the desk nothing.
//
// HOW: rule/11, through testSupport only. deskVerify is pointed at a scratch git repo (its `repo` argument), so its
// suites, its pull and its chores never touch a real checkout; the pull is a probe that sleeps, the chore a probe that
// writes a log line. A fake node stands in for the node; deskFake for the face.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G21.3: ';
const VERIFY = path.join(__dirname, '..', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js');
const FACE = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const SUPPORT = path.join(__dirname, 'testSupport.js');
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskVerifyFixesTestOwnerAAAAAAAAAAAAAAAAAAA=', label: 'andy' };
const CAP = 1024;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 10; i++) await settle(); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function took(r) { return r && r.status === 200 && r.body && r.body.ok !== false; }
function labels(r) { return ((r && r.body && r.body.items) || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return null; } }).filter(Boolean); }
async function waitFor(fn, ms) { const t = Date.now() + ms; while (Date.now() < t) { if (await fn()) return true; await sleep(150); } return fn(); }

test.startTest('goal/G21.3: the Verifier stays, answers, stops, remembers why, searches, and does its idle chores');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskverifyfixes-'));

// ── THE SCRATCH REPO: its own spirit/test, committed, so the tree is clean and the pull runs ──────────────────────
function git(cwd, args) { return spawnSync('git', args, { cwd: cwd, encoding: 'utf8' }); }
function scratchRepo(name, files) {
  const repo = path.join(scratch, name);
  fs.mkdirSync(path.join(repo, 'spirit', 'test'), { recursive: true });
  Object.keys(files).forEach(function (f) { fs.writeFileSync(path.join(repo, f), files[f]); });
  git(repo, ['init', '-q']);
  git(repo, ['config', 'user.email', 'fixes@example.invalid']);
  git(repo, ['config', 'user.name', 'fixes']);
  git(repo, ['config', 'commit.gpgsign', 'false']);
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '--no-verify', '-m', 'probes']);
  return repo;
}
const MARK = path.join(scratch, 'marks');
fs.mkdirSync(MARK, { recursive: true });
function probe(name, body) {
  return "'use strict';\nconst fs = require('fs');\nconst test = require(" + JSON.stringify(SUPPORT) + ");\n" +
    "test.startTest('fixes probe " + name + "');\nfs.appendFileSync(" + JSON.stringify(path.join(MARK, name)) + ", 'ran\\n');\n" +
    body + "\ntest.reportSuccessFailureCount();\nprocess.exit(0);\n";
}
function marks(name) { try { return fs.readFileSync(path.join(MARK, name), 'utf8').split('\n').filter(Boolean).length; } catch (e) { return 0; } }

// ── A FAKE NODE: its tree, the records forwarded to deskVerify, what deskVerify publishes, and any desk ask ──────────
function fakeNode(opts) {
  return new Promise(function (resolve) {
    const st = { asks: [], published: [], forward: null, apps: opts.apps };
    const s = http.createServer(function (req, res) {
      let b = '';
      req.on('data', function (c) { b += c; });
      req.on('end', async function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        { const na = test.nodeApi(j); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
        const flatCall = test.foldAsk(j);
        let out = {};
        if (j && j.verb === 'jobs.update') { if (j.app) st.published.push(j.app); }
        else if (flatCall === 'api') { out = {}; st.apps.forEach(function (a) { out[a] = {}; }); }
        else if (flatCall && (flatCall.desk || flatCall.deskClient)) st.asks.push(flatCall);
        else if (flatCall && flatCall.deskVerify && flatCall.deskVerify.record) {
          // A suite's record, handed on to the deskVerify under test, as the node's door would.
          try { const r = st.forward ? await st.forward(flatCall.deskVerify) : null; out = (r && r.body) || { written: false }; } catch (e) { out = { written: false }; }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () {
      st.port = s.address().port;
      st.close = function () { s.close(); };
      resolve(st);
    });
  });
}

function startVerify(name, node, args, nodeFacts) {
  const root = path.join(scratch, name);
  const state = path.join(root, 'state');
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(root, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, 'deskVerify', 'win32', 'process') : path.join(root, 'door.sock');
  const client = appClient.createAppClient({ rootDir: root });
  client.register('deskVerify', pipe);
  const env = Object.assign({}, process.env, { SPIRIT_JOB_ID: 'deskverify-fixes-' + name, SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.port + '/api/spirit' });
  const kid = spawn(process.execPath, [VERIFY, JSON.stringify(args), '--pipe', pipe, '--state', state, '--node', JSON.stringify(nodeFacts || { name: '', publicKey: '', ownerKey: '' })],
    { cwd: root, env: env, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const call = function (verb, a) { const q = {}; q[verb] = a || {}; return client.ask({ deskVerify: q }, ANDY).then(function (r) { return r || {}; }, function () { return {}; }); };
  node.forward = function (ask) { return client.ask({ deskVerify: ask }, ANDY); };
  return {
    call: call,
    up: async function () { for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.deskVerify && r.body.deskVerify.ok !== false) return true; } catch (e) { /* not yet */ } } return false; },
    idle: function () { return waitFor(async function () { return ((await call('now')).body || {}).busy === false; }, 20000); },
    stop: function () { return new Promise(function (r) { kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); },
  };
}

// The dataset as it stood before: results without a failure column, so the guarded ALTER is exercised; and enough rows
// that one answer cannot hold them all. Runs are seeded in today's shape, as many, for the same reason.
function seed(dbPath, results, runs) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('CREATE TABLE IF NOT EXISTS results (rowid INTEGER PRIMARY KEY AUTOINCREMENT, suite TEXT NOT NULL, title TEXT NOT NULL,' +
    ' outcome TEXT NOT NULL, "commit" TEXT NOT NULL, dirty TEXT NOT NULL, at TEXT NOT NULL);' +
    'CREATE TABLE IF NOT EXISTS runs (rowid INTEGER PRIMARY KEY AUTOINCREMENT, state TEXT NOT NULL, outcome TEXT NOT NULL,' +
    ' startedAt TEXT NOT NULL, endedAt TEXT NOT NULL, "commit" TEXT NOT NULL, dirty INTEGER NOT NULL, suites TEXT NOT NULL, line TEXT NOT NULL);');
  const r = db.prepare('INSERT INTO results (suite, title, outcome, "commit", dirty, at) VALUES (?, ?, ?, ?, ?, ?)');
  results.forEach(function (x) { r.run(x.suite, x.title, x.outcome, x.commit || 'seedcommit', '', x.at || '2026-10-01T00:00:00.000Z'); });
  const q = db.prepare('INSERT INTO runs (state, outcome, startedAt, endedAt, "commit", dirty, suites, line) VALUES (\'ended\', ?, ?, ?, \'seedcommit\', 0, ?, ?)');
  runs.forEach(function (x) { q.run(x.outcome, '2026-10-01T00:00:01.000Z', '2026-10-01T00:00:02.000Z', JSON.stringify([{ path: x.path, outcome: x.outcome, failures: [] }]), x.line); });
  db.close();
}

// ── 1. THE SERVER: stop kept, answers mid-pull, failure text, search ────────────────────────────────────────────
async function serverHalf() {
  test.subHeading('1. deskVerify: stop kept, answers mid-pull, the why kept, one search verb');
  const repo = scratchRepo('repo1', {
    'spirit/test/zzA.js': probe('zzA.js', "test.check('probe A green');"),
    'spirit/test/zzB.js': probe('zzB.js', "test.check('probe B green');"),
    'spirit/test/zzRed.js': probe('zzRed.js', "test.fail('long red', 'x'.repeat(5000));\ntest.fail('short red', 'because of y');\ntest.check('a green beside the reds');"),
  });
  const head = String(git(repo, ['rev-parse', 'HEAD']).stdout || '').trim();
  // THE SLOW PULL: sleeps while its flag file stands, and says each time it ran. Outside the repo, so the tree stays clean.
  const slowFlag = path.join(scratch, 'slowPull.flag');
  const pullLog = path.join(scratch, 'pull.log');
  const pullJs = path.join(scratch, 'slowPull.js');
  fs.writeFileSync(pullJs, "const fs = require('fs');\nfs.appendFileSync(" + JSON.stringify(pullLog) + ", 'pull\\n');\n" +
    "setTimeout(function () {}, fs.existsSync(" + JSON.stringify(slowFlag) + ") ? 3500 : 0);\n");
  fs.writeFileSync(slowFlag, 'slow');
  const pulls = function () { try { return fs.readFileSync(pullLog, 'utf8').split('\n').filter(Boolean).length; } catch (e) { return 0; } };

  const node = await fakeNode({ apps: ['desk', 'deskVerify'] });
  const dbPath = path.join(scratch, 'v1', 'verify.db');
  const bulk = [];
  for (let i = 0; i < 300; i++) bulk.push({ suite: 'zzBulk.js', title: 'bulk test number ' + i + ' ' + 'with a long title to fill the answer room '.repeat(2), outcome: i % 2 ? 'green' : 'red' });
  const seedRuns = [];
  for (let i = 0; i < 300; i++) seedRuns.push({ path: 'spirit/test/zzSeed.js', outcome: 'green', line: 'a run of long ago to fill the answer room '.repeat(4) + i });
  seed(dbPath, bulk, seedRuns);
  const v = startVerify('v1', node, { db: dbPath, suiteMs: 20000, pull: '"' + process.execPath + '" "' + pullJs + '"', repo: repo, idleMs: 3600000, idleCheckMs: 3600000 });
  // The newest run that ran a suite, by its row's key. Not by time: the server's clock and this one's differ by
  // milliseconds on Windows, so a since taken here can fall after the run's start.
  const runOf = function (rel) {
    return v.call('search', { over: 'runs', suite: rel }).then(function (r) {
      const items = ((r && r.body && r.body.items) || []).slice().sort(function (x, y) { return Number(y.key) - Number(x.key); });
      try { return items.length ? JSON.parse(items[0].label) : null; } catch (e) { return null; }
    });
  };
  try {
    if (!await v.up()) { test.fail('the world: deskVerify did not start'); return; }
    await sleep(500);

    // 6. AN AGENT TOOL: the verb file is there, so the family folder's FS.search lists it.
    const intro = await v.call('FS.search', { q: '' });
    const told = took(intro) && ((intro.body.items || []).some(function (i) { return i.key === 'search.json'; }));
    if (told) test.check('search has a verb file: FS.search lists search.json, so an agent may call it');
    else test.fail(OWED + 'FS.search answered ' + short(intro.body));

    const idleStop = await v.call('stop');
    if (took(idleStop) && idleStop.body.stopped === false) test.check('a Stop with nothing running answers stopped: false');
    else test.fail(OWED + 'stop while idle answered ' + short(idleStop.body));

    // 3 and 4: A STOP DURING THE PULL. A run pulls first; while the slow pull runs, now answers at once and a Stop is
    // kept, so no suite of the run is measured.
    const pullsBefore = pulls();
    const handed = await v.call('run', { suites: ['spirit/test/zzA.js'], commit: '' });
    await waitFor(function () { return pulls() > pullsBefore; }, 5000);
    await sleep(300);
    const t0 = Date.now();
    const mid = await v.call('now');
    const ms = Date.now() - t0;
    if (took(handed) && handed.body.taken === true && pulls() > pullsBefore) test.check('the world: the run was taken and pulled the scratch repo with the slow probe');
    else test.fail(OWED + 'the run answered ' + short(handed.body) + ' and the slow pull ran ' + (pulls() - pullsBefore) + ' time(s)');
    if (took(mid) && ms < 1500 && mid.body.busy === true) test.check('now answers in ' + ms + ' ms while the pull runs, saying busy');
    else test.fail(OWED + 'now during the pull took ' + ms + ' ms and answered ' + short(mid.body));
    const st = await v.call('stop');
    if (took(st) && st.body.stopped === true) test.check('a Stop pressed during the pull is taken');
    else test.fail(OWED + 'stop during the pull answered ' + short(st.body));
    const asked = await v.call('now');
    if (took(asked) && asked.body.stopAsked === true) test.check('and now says the stop is asked until the run ends');
    else test.fail(OWED + 'now after the stop answered ' + short(asked.body));
    const pubAsked = node.published.some(function (p) { return p && p.stopAsked === true; });
    if (pubAsked) test.check('the published run says stop asked too, for the tab');
    else test.fail(OWED + 'nothing published carried stopAsked: ' + short(node.published.slice(-2)));
    fs.unlinkSync(slowFlag);
    await v.idle();
    const r1 = await runOf('spirit/test/zzA.js');
    if (r1 && r1.outcome === 'stopped' && r1.suites[0].outcome === 'stopped') test.check('the stopped run is kept as stopped, never green');
    else test.fail(OWED + 'the stopped run reads ' + short(r1));
    if (marks('zzA.js') === 0) test.check('and no suite of it ran: the stop was checked before the first suite');
    else test.fail(OWED + 'zzA.js ran ' + marks('zzA.js') + ' time(s) after the stop');
    const after = await v.call('now');
    if (took(after) && after.body.stopAsked === false && after.body.busy === false) test.check('once the run ended, the stop is cleared');
    else test.fail(OWED + 'now after the stopped run answered ' + short(after.body));

    // THE NEXT RUN IS NOT STOPPED: both suites run, green.
    await v.call('run', { suites: ['spirit/test/zzA.js', 'spirit/test/zzB.js'], commit: '' });
    await sleep(300);
    await v.idle();
    const r2 = await runOf('spirit/test/zzB.js');
    if (r2 && r2.outcome === 'green' && marks('zzA.js') === 1 && marks('zzB.js') === 1) test.check('the next run is not stopped: both its suites ran, green');
    else test.fail(OWED + 'the run after a stop: ' + short({ row: r2, A: marks('zzA.js'), B: marks('zzB.js') }));
    if (r2 && r2.started && r2.ended && head.indexOf(String(r2.commit).slice(0, 7)) === 0 && String(r2.commit) && r2.dirty === false) test.check('the run\'s row: started, ended, its commit and a clean tree');
    else test.fail(OWED + 'the green run reads ' + short(r2));

    // 5. THE FAILURE TEXT, KEPT AND CAPPED.
    await v.call('run', { suites: ['spirit/test/zzRed.js'], commit: '' });
    await sleep(300);
    await v.idle();
    await sleep(500);
    const r3 = await runOf('spirit/test/zzRed.js');
    if (r3 && r3.outcome === 'red' && r3.suites[0].outcome === 'red' && r3.suites[0].failures.some(function (f) { return /short red/.test(f); })) test.check('the red run\'s row: red, with the FAILURE lines the suite printed');
    else test.fail(OWED + 'the red run reads ' + short(r3));
    const reds = await v.call('search', { over: 'tests', suite: 'zzRed.js', outcome: 'red' });
    const rows = labels(reds);
    const longRow = rows.filter(function (r) { return /^long red/.test(String(r.failure)); })[0];
    const shortRow = rows.filter(function (r) { return /^short red/.test(String(r.failure)); })[0];
    if (took(reds) && rows.length === 2 && rows.every(function (r) { return r.suite === 'zzRed.js' && r.outcome === 'red'; })) test.check('search over tests, suite and outcome red: the two reds of zzRed.js');
    else test.fail(OWED + 'search over zzRed.js reds answered ' + short(reds.body));
    if (shortRow && /because of y/.test(String(shortRow.failure))) test.check('a red keeps its failure text: "' + shortRow.failure + '"');
    else test.fail(OWED + 'the short red\'s failure text is ' + short(shortRow));
    const longBytes = longRow ? Buffer.byteLength(String(longRow.failure || ''), 'utf8') : -1;
    if (longRow && longBytes > 0 && longBytes <= CAP) test.check('a long failure text is capped: ' + longBytes + ' bytes of a 5000-byte why');
    else test.fail(OWED + 'the long red\'s failure text is ' + longBytes + ' bytes');
    if (shortRow && shortRow.commit && head.indexOf(String(shortRow.commit).slice(0, 7)) === 0 && shortRow.at) test.check('each test answers its commit and time');
    else test.fail(OWED + 'the row carries ' + short(shortRow));

    // 6. THE FILTERS.
    const q = function (a) { return v.call('search', Object.assign({ over: 'tests' }, a)); };
    const greenA = labels(await q({ suite: 'zzA.js', outcome: 'green' }));
    if (greenA.length === 1 && greenA[0].suite === 'zzA.js' && greenA[0].failure === '') test.check('filter suite + outcome green: the one green of zzA.js, no failure text');
    else test.fail(OWED + 'zzA.js greens: ' + short(greenA));
    const byWords = labels(await q({ test: 'short red' }));
    if (byWords.length && /^short red/.test(String(byWords[0].failure))) test.check('filter test words: the matching test comes first');
    else test.fail(OWED + 'by words: ' + short(byWords));
    const byCommit = labels(await q({ commit: head.slice(0, 8), suite: 'zzB.js' }));
    const noCommit = labels(await q({ commit: 'ffffffff' }));
    if (byCommit.length === 1 && !noCommit.length) test.check('filter commit: by its prefix');
    else test.fail(OWED + 'by commit: ' + short({ head: byCommit, none: noCommit }));
    const future = labels(await q({ since: '2999-01-01T00:00:00.000Z' }));
    if (!future.length) test.check('filter since: nothing newer than the future');
    else test.fail(OWED + 'since the future: ' + short(future));
    const bulkR = await q({ suite: 'zzBulk.js' });
    if (took(bulkR) && labels(bulkR).length > 0 && bulkR.body.more === true) test.check('three hundred tests do not fit one answer: some come, and more says partial');
    else test.fail(OWED + 'the bulk search answered ' + short(bulkR.body));

    const runsOf = function (a) { return v.call('search', Object.assign({ over: 'runs' }, a)); };
    const rRed = labels(await runsOf({ outcome: 'red' }));
    if (rRed.length === 1 && rRed[0].suites[0].path === 'spirit/test/zzRed.js') test.check('runs filtered by outcome: the one red run');
    else test.fail(OWED + 'red runs: ' + short(rRed));
    const rName = labels(await runsOf({ suite: 'zzB.js' }));
    if (rName.length === 1) test.check('runs filtered by a suite\'s file name: the run that ran it');
    else test.fail(OWED + 'runs of zzB.js: ' + short(rName));
    const rSince = labels(await runsOf({ since: '2999-01-01T00:00:00.000Z' }));
    const rCommit = labels(await runsOf({ commit: 'ffffffff' }));
    if (!rSince.length && !rCommit.length) test.check('runs filtered by since and commit: nothing that does not match');
    else test.fail(OWED + 'runs since the future / at ffffffff: ' + short({ since: rSince, commit: rCommit }));
    const rBulk = await runsOf({ suite: 'spirit/test/zzSeed.js' });
    if (took(rBulk) && labels(rBulk).length > 0 && rBulk.body.more === true) test.check('three hundred runs: some come, and more says partial');
    else test.fail(OWED + 'the bulk runs search answered ' + short(rBulk.body));
    if (!node.asks.length) test.check('and in all of it deskVerify asked the desk nothing');
    else test.fail(OWED + 'deskVerify asked the desk: ' + short(node.asks.slice(0, 4)));
  } finally {
    try { fs.unlinkSync(slowFlag); } catch (e) { /* gone */ }
    await v.stop();
    node.close();
  }
}

// ── 2. THE IDLE HOUR AND ITS CHORES: its own clock, the chores its manifest names ───────────────────────────────
async function idleHalf() {
  test.subHeading('2. the idle hour: no run handed to it for the hour, then the chores its manifest names');
  const repo = scratchRepo('repo2', { 'spirit/test/zzIdle.js': probe('zzIdle.js', "test.check('idle probe green');") });
  const choreLog = path.join(scratch, 'chore.log');
  const choreJs = path.join(scratch, 'fakeChore.js');
  // The fake chore: says it ran, with the port it was given.
  fs.writeFileSync(choreJs, "const fs = require('fs');\nfs.appendFileSync(" + JSON.stringify(choreLog) + ", 'ran ' + process.argv[2] + '\\n');\n");
  const chored = function () { try { return fs.readFileSync(choreLog, 'utf8').split('\n').filter(Boolean); } catch (e) { return []; } };
  const node = await fakeNode({ apps: ['desk', 'deskClient', 'deskVerify'] });
  const dbPath = path.join(scratch, 'v2', 'verify.db');
  const v = startVerify('v2', node, { db: dbPath, suiteMs: 20000, pull: '', repo: repo, idleMs: 4000, idleCheckMs: 300, chores: '"' + process.execPath + '" "' + choreJs + '"' },
    { name: 'zznode', publicKey: '', ownerKey: '' });
  try {
    if (!await v.up()) { test.fail('the world: deskVerify did not start'); return; }
    await sleep(1500);
    // A run handed to it starts the hour again.
    const handedAt = Date.now();
    await v.call('run', { suites: ['spirit/test/zzIdle.js'], commit: '' });
    await v.idle();
    await sleep(1500);
    const idles = function () { return node.published.filter(function (p) { return p && p.doing === 'idle'; }); };
    const lastIdle = function () { return idles().slice(-1)[0] || null; };
    if (!chored().length) test.check('a run handed to it inside the hour: not idle yet, no chore');
    else test.fail(OWED + 'the chores ran a moment after a run: ' + short(chored()));
    const counting = lastIdle();
    if (counting && Math.abs(Date.parse(counting.since) - handedAt) < 1500 && Number(counting.idleMs) === 4000) test.check('the countdown counts from the last run handed to it, to the server\'s own hour (idleMs)');
    else test.fail(OWED + 'the newest idle object: ' + short(counting));
    await waitFor(function () { return chored().length > 0; }, 12000);
    await sleep(1500);
    const runs = chored();
    if (runs.length === 1 && runs[0] === 'ran ' + node.port) test.check('idle: the chore ran once, handed its node\'s port');
    else test.fail(OWED + 'chore runs: ' + short(runs) + ' (port ' + node.port + ')');
    const done = lastIdle();
    if (done && /fakeChore/.test(String(done.chores))) test.check('the published idle state says what the chores did: ' + short(done.chores));
    else test.fail(OWED + 'the newest idle object: ' + short(done));
    await sleep(1500);
    if (chored().length === 1) test.check('once per idle stretch: no second chore while no new run was handed to it');
    else test.fail(OWED + 'the chore ran ' + chored().length + ' times');
    if (!node.asks.length) test.check('and its idle hour asked the desk nothing, nor any deskClient');
    else test.fail(OWED + 'deskVerify asked: ' + short(node.asks.slice(0, 4)));
  } finally {
    await v.stop();
    node.close();
  }
  // A manifest that names no chore: the hour passes and nothing runs.
  const node3 = await fakeNode({ apps: ['deskVerify'] });
  const v3 = startVerify('v3', node3, { db: path.join(scratch, 'v3', 'verify.db'), pull: '', repo: repo, idleMs: 500, idleCheckMs: 200 });
  try {
    if (!await v3.up()) { test.fail('the world: the second deskVerify did not start'); return; }
    const before = chored().length;
    await sleep(2000);
    const n = (await v3.call('now')).body || {};
    if (chored().length === before && n.busy === false) test.check('a node whose manifest names no chore runs none');
    else test.fail(OWED + 'with no chores named: ' + short({ chores: chored().length - before, now: n }));
  } finally {
    await v3.stop();
    node3.close();
  }
}

// ── 3. THE FACE ────────────────────────────────────────────────────────────────────────────────────────────────
function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, style: {}, listeners: {}, placeholder: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function target(attrs) { return { id: attrs.id || '', getAttribute: function (n) { return attrs[n] || null; }, closest: function () { return null; }, parentNode: null }; }
async function mount(fake) {
  const byId = {};
  const handlers = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(FACE, 'utf8'))({ shell: { activateApp: function (x) { behavior = x; } }, core: kernel.core }, doc, {});
  behavior.mount(fakeElement('container'), {
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: fake.verb,
    onPublished: function (fn, server) { (handlers[server || 'desk'] = handlers[server || 'desk'] || []).push(fn); }, onPacket: function () {},
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h' }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  await settled();
  return { doc: doc, emit: function (obj) { (handlers.deskVerify || []).forEach(function (fn) { fn(obj); }); } };
}

async function faceHalf() {
  test.subHeading('3. the face: the tab stays, every press says sent then the answer, stop asked, the chores');
  const goal = { id: 'goal/G100', title: 'Fixes', goal: '', design: false, status: '', with: '', buttons: [], blocking: [], blocked: [], live: [], working: [], waiting: 0 };
  const fake = require('./deskFake.js').create([]);
  fake.items = [goal];
  let stopAnswer = { stopped: true };
  const nowRunning = function () { return { busy: true, running: { suite: 'spirit/test/zzRun.js', since: new Date().toISOString() }, stopAsked: false }; };
  fake.verifier = { now: nowRunning, stop: function () { return stopAnswer; } };
  const m = await mount(fake);
  const tabs = m.doc.getElementById('desk-tabs');
  for (let i = 0; i < 20 && tabs.innerHTML.indexOf('data-tab="verifier"') === -1; i++) { await sleep(50); await settled(); }
  tabs.fire('click', { target: target({ 'data-tab': 'verifier' }), currentTarget: tabs });
  await settled(); await sleep(30); await settled();
  const body = m.doc.getElementById('desk-verifier');

  // 1. A LATER MISSED ANSWER KEEPS THE TAB.
  delete fake.verifier.now;
  tabs.fire('click', { target: target({ 'data-tab': 'verifier' }), currentTarget: tabs });
  await settled(); await sleep(30); await settled();
  if (tabs.innerHTML.indexOf('data-tab="verifier"') !== -1) test.check('a later missed now keeps the Verifier tab');
  else test.fail(OWED + 'the tab vanished on a missed answer: ' + short(tabs.innerHTML));
  if (/not answering/i.test(body.innerHTML)) test.check('and the tab says deskVerify is not answering');
  else test.fail(OWED + '#desk-verifier reads ' + short(body.innerHTML));
  fake.verifier.now = nowRunning;
  tabs.fire('click', { target: target({ 'data-tab': 'verifier' }), currentTarget: tabs });
  await settled(); await sleep(30); await settled();
  if (!/not answering/i.test(body.innerHTML)) test.check('an answer again clears "not answering"');
  else test.fail(OWED + 'still "not answering" after an answer: ' + short(body.innerHTML));

  // 2. THE STOP: SENT AT ONCE, THEN THE ANSWER.
  fake.hold(function (c) { return c.server === 'deskVerify' && c.verb === 'stop'; });
  body.fire('click', { target: target({ id: 'desk-verify-stop' }), currentTarget: body });
  await settled();
  const sent = body.innerHTML;
  fake.release();
  await settled(); await sleep(30); await settled();
  if (/sent/i.test(sent)) test.check('Stop: shown as sent at once');
  else test.fail(OWED + 'Stop showed nothing while its answer was out: ' + short(sent));
  if (/stop asked/i.test(body.innerHTML)) test.check('Stop: then what came back');
  else test.fail(OWED + 'Stop after the answer: ' + short(body.innerHTML));
  stopAnswer = { stopped: false };
  body.fire('click', { target: target({ id: 'desk-verify-stop' }), currentTarget: body });
  await settled(); await sleep(30); await settled();
  if (/nothing.*to stop|nothing running/i.test(body.innerHTML)) test.check('a Stop with nothing running says so');
  else test.fail(OWED + 'stop answered stopped false shows ' + short(body.innerHTML));

  // 3. STOP ASKED, UNTIL THE RUN ENDS.
  m.emit({ doing: 'run', suite: 'spirit/test/zzRun.js', index: 1, of: 2, tests: 3, expected: 9, line: 'running', since: new Date().toISOString(), stopAsked: true });
  await settled();
  if (/stop asked/i.test(body.innerHTML)) test.check('a run published with stopAsked reads "stop asked"');
  else test.fail(OWED + 'the tab during an asked stop: ' + short(body.innerHTML));
  m.emit({ doing: 'idle', suite: '', index: 0, of: 0, tests: 0, expected: 0, line: 'idle, nothing running', since: new Date().toISOString(), stopAsked: false, idleMs: 3600000, chores: '' });
  await settled();
  const cleared = body.innerHTML.replace(/<button[^>]*>[^<]*<\/button>/g, '');
  if (!/stop asked/i.test(cleared)) test.check('and no longer once the run has ended');
  else test.fail(OWED + 'still "stop asked" when idle: ' + short(cleared));

  // 7. THE COUNTDOWN COUNTS TO THE SERVER'S HOUR AND SHOWS WHAT THE CHORES DID.
  m.emit({ doing: 'idle', suite: '', index: 0, of: 0, tests: 0, expected: 0, line: 'idle', since: new Date(Date.now() - 60000).toISOString(), stopAsked: false, idleMs: 600000, chores: '', hasChores: true });
  await settled();
  if (/Idle in 9 min/.test(body.innerHTML)) test.check('the countdown counts to the hour deskVerify published (10 min here: 9 left)');
  else test.fail(OWED + 'the countdown with idleMs 600000 reads ' + short(body.innerHTML));
  const CH = 'node spirit/run/process/js/deskClient/publishData.js: done';
  m.emit({ doing: 'idle', suite: '', index: 0, of: 0, tests: 0, expected: 0, line: 'idle', since: new Date(Date.now() - 7200000).toISOString(), stopAsked: false, idleMs: 3600000, chores: CH });
  await settled();
  if (body.innerHTML.indexOf(CH) !== -1) test.check('past the hour, the tab shows what the chores did');
  else test.fail(OWED + 'past the hour the tab reads ' + short(body.innerHTML));

  // 1, again: THE FIRST ASK DECIDES. A page whose first now fails has no tab.
  const none = require('./deskFake.js').create([]);
  none.items = [goal];
  const m2 = await mount(none);
  if (m2.doc.getElementById('desk-tabs').innerHTML.indexOf('data-tab="verifier"') === -1) test.check('a first now that fails: no Verifier tab, as before');
  else test.fail(OWED + 'a tab with no verifier answering at load');
}

(async function () {
  await serverHalf();
  await idleHalf();
  await faceHalf();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
