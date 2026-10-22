'use strict';

// spirit/test/deskVerifyFixes.js
// goal/G21.3: the Verifier's fixes. Red first on aa748c2a; claude-windows wrote it and builds it (one agent).
//
// THE ITEM'S BOX, Andy's decisions, asserted one by one:
//   1. The Verifier tab stays once the page has loaded; only the first ask at load decides whether a verifier runs
//      here. A later missed answer keeps the tab and shows "not answering".
//   2. Every press in the tab shows at once that it was sent, then what deskVerify answered.
//   3. A Stop is kept for the whole run, whenever it is pressed (a suite running, pulling, between suites, waiting for a
//      commit), and deskVerify checks it before each suite; the tab shows "stop asked" until the run ends.
//   4. deskVerify answers at once even mid-run: the git work that blocked it (pull, ancestry checks) no longer freezes it.
//   5. deskVerify keeps, beside each failing test's outcome, its failure text (capped), so the why is in the record.
//   6. One search verb, bucket-bounded with the partial flag, over tests (the latest state of each: outcome, commit,
//      time, failure text; filters suite, test words, outcome, commit, item, since) and runs (kind, id, commit, queued,
//      started, ended, outcome, the line it posted; filters item, commit, kind, since); a verb file, so agents may call it.
//   7. The idle hour comes back and its chores are done (goal/G8.4): idle after an hour with no desk write and no phase
//      held by its agent; then the test-state report from its own dataset and publishData for its agent. The tab's
//      countdown counts to that hour and shows what the chores did.
//
// HOW: rule/11, through testSupport only. deskVerify is pointed at a scratch git repo (its `repo` argument), so its
// suites, its pull and its chores never touch a real checkout; the pull is a probe that sleeps, the publish a probe that
// writes a log line. Fake nodes stand in for the node, the desk and the deskClient; deskFake for the face.

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
async function waitFor(fn, ms) { const t = Date.now() + ms; while (Date.now() < t) { if (fn()) return true; await sleep(150); } return fn(); }

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

// ── A FAKE NODE: the desk, the deskClient's desk, the records forwarded to deskVerify, and what deskVerify publishes ──
function fakeNode(opts) {
  return new Promise(function (resolve) {
    const st = { asks: [], published: [], records: [], items: [], chats: {}, files: {}, viaClient: [], forward: null, apps: opts.apps };
    const deskAnswer = function (verb, a) {
      if (verb === 'changes') {
        const from = Number(a.n) || 0;
        const rest = st.records.filter(function (r) { return r.n > from; });
        return { records: rest, lines: [], n: rest.length ? rest[rest.length - 1].n : from, line: 0, more: false };
      }
      st.asks.push({ verb: verb, args: a });
      if (verb === 'item.files') return { files: (({ id: a.id, goal: 'fx/G1', code: true, go: true, files: (st.files[a.id] || []).map(function (p) { return { path: p, by: 'claude-windows', core: false }; }) }) || {}).files ? (({ id: a.id, goal: 'fx/G1', code: true, go: true, files: (st.files[a.id] || []).map(function (p) { return { path: p, by: 'claude-windows', core: false }; }) }).files || []).filter(function (f) { return !a.under || String((f && f.path) || '').indexOf(a.under) === 0; }) : [], filesMore: false }; // goal/G32.2: the file list is its own answer
      if (verb === 'item.get') return { item: JSON.stringify({ id: a.id, goal: 'fx/G1', code: true, go: true, files: (st.files[a.id] || []).map(function (p) { return { path: p, by: 'claude-windows', core: false }; }) }), version: 1, change: 1 };
      if (verb === 'item.chat') return { chat: (st.chats[a.id] || []).slice(), chatMore: false };
      if (verb === 'items.search') return { items: st.items.map(function (it) { return { key: it.id, label: JSON.stringify(it) }; }), more: false };
      if (verb === 'profile.get') return { name: opts.agent || '', nick: '' };
      return { change: 1 };
    };
    const s = http.createServer(function (req, res) {
      let b = '';
      req.on('data', function (c) { b += c; });
      req.on('end', async function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        // A server's verb by name on the flat apiDoor (goal/G30.6), folded to {server: {verb: args}}; 'api' the tree.
        { const na = test.nodeApi(j); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
        const flatCall = test.foldAsk(j);
        let out = {};
        if (j && j.verb === 'jobs.update') { if (j.app) st.published.push(j.app); }
        else if (flatCall === 'api') { out = {}; st.apps.forEach(function (a) { out[a] = {}; }); }
        else if (flatCall && flatCall.desk) {
          const verb = Object.keys(flatCall.desk)[0];
          out = deskAnswer(verb, flatCall.desk[verb] || {});
        } else if (flatCall && flatCall.deskClient && flatCall.deskClient.desk) {
          let a = {}; try { a = JSON.parse(flatCall.deskClient.desk.json || '{}'); } catch (e) { a = {}; }
          st.viaClient.push(flatCall.deskClient.desk.name);
          out = deskAnswer(String(flatCall.deskClient.desk.name), a);
        } else if (flatCall && flatCall.deskVerify && flatCall.deskVerify.record) {
          // A suite's record, handed on to the deskVerify under test, as the node's door would.
          try { const r = st.forward ? await st.forward(flatCall.deskVerify) : null; out = (r && r.body) || { written: false }; } catch (e) { out = { written: false }; }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () {
      st.port = s.address().port;
      st.close = function () { s.close(); };
      st.rec = function (verb, body, at) { st.records.push({ n: st.records.length + 1, at: at || new Date().toISOString(), verb: verb, by: 'andy', key: '', body: JSON.stringify(body) }); };
      st.said = function (verb, id) { return st.asks.filter(function (x) { return x.verb === verb && x.args.id === id; }); };
      st.lines = function (id) { return st.said('chat.add', id).map(function (x) { return String(x.args.text || ''); }); };
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
    stop: function () { return new Promise(function (r) { kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); },
  };
}

// The dataset as it stood before this item: results without a failure column, runs without a line, so the guarded
// ALTERs are exercised; and enough rows that one answer cannot hold them all.
function seed(dbPath, results, runs) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('CREATE TABLE IF NOT EXISTS results (rowid INTEGER PRIMARY KEY AUTOINCREMENT, suite TEXT NOT NULL, title TEXT NOT NULL,' +
    ' outcome TEXT NOT NULL, "commit" TEXT NOT NULL, dirty TEXT NOT NULL, at TEXT NOT NULL);' +
    'CREATE TABLE IF NOT EXISTS runs (rowid INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, id TEXT NOT NULL,' +
    ' state TEXT NOT NULL, outcome TEXT NOT NULL, queuedAt TEXT NOT NULL, startedAt TEXT NOT NULL, endedAt TEXT NOT NULL);');
  const r = db.prepare('INSERT INTO results (suite, title, outcome, "commit", dirty, at) VALUES (?, ?, ?, ?, ?, ?)');
  results.forEach(function (x) { r.run(x.suite, x.title, x.outcome, x.commit || 'seedcommit', '', x.at || '2026-10-01T00:00:00.000Z'); });
  const q = db.prepare('INSERT INTO runs (kind, id, state, outcome, queuedAt, startedAt, endedAt) VALUES (?, ?, \'ended\', ?, ?, ?, ?)');
  runs.forEach(function (x) { q.run(x.kind, x.id, x.outcome, '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:01.000Z', '2026-10-01T00:00:02.000Z'); });
  db.close();
}

// ── 1. THE SERVER, ON HIS NODE: stop kept, answers mid-pull, failure text, search ────────────────────────────────
async function serverHalf() {
  test.subHeading('1. deskVerify on the desk node: stop kept, answers mid-pull, the why kept, one search verb');
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
  node.files['fx/G1.1'] = ['spirit/test/zzA.js'];
  node.files['fx/G1.2'] = ['spirit/test/zzA.js', 'spirit/test/zzB.js'];
  node.files['fx/G1.3'] = ['spirit/test/zzRed.js'];
  const dbPath = path.join(scratch, 'v1', 'verify.db');
  const bulk = [];
  for (let i = 0; i < 300; i++) bulk.push({ suite: 'zzBulk.js', title: 'bulk test number ' + i + ' ' + 'with a long title to fill the answer room '.repeat(2), outcome: i % 2 ? 'green' : 'red' });
  const seedRuns = [];
  for (let i = 0; i < 300; i++) seedRuns.push({ kind: 'seed', id: 'fx/G0.' + i + '-' + 'a run of long ago to fill the answer room'.repeat(2), outcome: 'passed' });
  seed(dbPath, bulk, seedRuns);
  const v = startVerify('v1', node, { db: dbPath, watchMs: 300, waitMs: 60000, suiteMs: 20000, pull: '"' + process.execPath + '" "' + pullJs + '"', repo: repo, idleMs: 3600000, idleCheckMs: 3600000 });
  try {
    if (!await v.up()) { test.fail('the world: deskVerify did not start'); return; }
    await sleep(1500);

    // 6. AN AGENT TOOL: the verb file is there, so the family folder's FS.search lists it.
    // goal/G30.4: the AGENTS verbs are gone; FS.search {q} with no words lists every file of the folder, and the verb
    // file is what deskAgent reads (FS.loadJsonValue) before it offers the verb.
    const intro = await v.call('FS.search', { q: '' });
    const told = took(intro) && ((intro.body.items || []).some(function (i) { return i.key === 'search.json'; }));
    if (told) test.check('search has a verb file: FS.search lists search.json, so an agent may call it');
    else test.fail(OWED + 'FS.search answered ' + short(intro.body));

    const idleStop = await v.call('stop');
    if (took(idleStop) && idleStop.body.stopped === false) test.check('a Stop with nothing running answers stopped: false');
    else test.fail(OWED + 'stop while idle answered ' + short(idleStop.body));

    // 3 and 4: A STOP DURING THE PULL. The check pulls first; while the slow pull runs, now answers at once and a
    // Stop is kept, so no suite of the item runs.
    const pullsBefore = pulls();
    node.rec('verify.again', { id: 'fx/G1.1' });
    await waitFor(function () { return pulls() > pullsBefore; }, 5000);
    await sleep(300);
    const t0 = Date.now();
    const mid = await v.call('now');
    const ms = Date.now() - t0;
    if (pulls() > pullsBefore) test.check('the world: the item check pulled the scratch repo with the slow probe');
    else test.fail(OWED + 'the slow pull never ran: deskVerify does not measure the repo it is given (repo argument)');
    if (took(mid) && ms < 1500 && mid.body.running && mid.body.running.id === 'fx/G1.1') test.check('now answers in ' + ms + ' ms while the pull runs, naming the item');
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
    await waitFor(function () { return node.said('verify.reject', 'fx/G1.1').length || node.said('verify.pass', 'fx/G1.1').length; }, 12000);
    const rj = node.said('verify.reject', 'fx/G1.1');
    if (rj.length === 1 && /stop/i.test(String(rj[0].args.why)) && !node.said('verify.pass', 'fx/G1.1').length) test.check('the stopped run is rejected saying so, never passed');
    else test.fail(OWED + 'after the stop the desk was asked ' + short(node.asks.filter(function (x) { return x.args && x.args.id === 'fx/G1.1'; })));
    if (marks('zzA.js') === 0) test.check('and no suite of it ran: the stop was checked before the first suite');
    else test.fail(OWED + 'zzA.js ran ' + marks('zzA.js') + ' time(s) after the stop');
    await sleep(500);
    const after = await v.call('now');
    if (took(after) && after.body.stopAsked === false && after.body.running.id === '') test.check('once the run ended, the stop is cleared');
    else test.fail(OWED + 'now after the stopped run answered ' + short(after.body));

    // THE NEXT RUN IS NOT STOPPED: both suites run and it passes.
    node.rec('verify.again', { id: 'fx/G1.2' });
    await waitFor(function () { return node.said('verify.pass', 'fx/G1.2').length || node.said('verify.reject', 'fx/G1.2').length; }, 20000);
    if (node.said('verify.pass', 'fx/G1.2').length === 1 && marks('zzA.js') === 1 && marks('zzB.js') === 1) test.check('the next run is not stopped: both its suites ran and it passed');
    else test.fail(OWED + 'the run after a stop: ' + short({ pass: node.said('verify.pass', 'fx/G1.2').length, reject: node.said('verify.reject', 'fx/G1.2').map(function (x) { return x.args.why; }), A: marks('zzA.js'), B: marks('zzB.js') }));

    // 5. THE FAILURE TEXT, KEPT AND CAPPED.
    node.rec('verify.again', { id: 'fx/G1.3' });
    await waitFor(function () { return node.said('verify.reject', 'fx/G1.3').length || node.said('verify.pass', 'fx/G1.3').length; }, 20000);
    await sleep(800);
    const reds = await v.call('search', { over: 'tests', suite: 'zzRed.js', test: '', outcome: 'red', commit: '', item: '', kind: '', since: '' });
    const rows = labels(reds);
    // SINCE goal/G27.14 a test's key is its place; its words are in a red's failure text, so the rows are found by them.
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
    const q = function (a) { return v.call('search', Object.assign({ over: 'tests', suite: '', test: '', outcome: '', commit: '', item: '', kind: '', since: '' }, a)); };
    const greenA = labels(await q({ suite: 'zzA.js', outcome: 'green' }));
    if (greenA.length === 1 && greenA[0].suite === 'zzA.js' && greenA[0].failure === '') test.check('filter suite + outcome green: the one green of zzA.js, no failure text');
    else test.fail(OWED + 'zzA.js greens: ' + short(greenA));
    const byWords = labels(await q({ test: 'short red' }));
    if (byWords.length && /^short red/.test(String(byWords[0].failure))) test.check('filter test words: the matching test comes first');
    else test.fail(OWED + 'by words: ' + short(byWords));
    const byItem = labels(await q({ item: 'fx/G1.3' }));
    if (byItem.length === 3 && byItem.every(function (r) { return r.suite === 'zzRed.js'; })) test.check('filter item: every test of the item\'s suites, and nothing else');
    else test.fail(OWED + 'by item fx/G1.3: ' + short(byItem));
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

    const runsOf = function (a) { return v.call('search', Object.assign({ over: 'runs', suite: '', test: '', outcome: '', commit: '', item: '', kind: '', since: '' }, a)); };
    const r1 = labels(await runsOf({ item: 'fx/G1.1' }));
    if (r1.length === 1 && /stop/i.test(String(r1[0].outcome)) && /stop/i.test(String(r1[0].line)) && r1[0].queued && r1[0].ended) test.check('search over runs, by item: the stopped run, its outcome and the line it posted');
    else test.fail(OWED + 'runs of fx/G1.1: ' + short(r1));
    const r2 = labels(await runsOf({ item: 'fx/G1.2', kind: 'item' }));
    if (r2.length === 1 && r2[0].outcome === 'passed' && /passed/.test(String(r2[0].line)) && r2[0].started && head.indexOf(String(r2[0].commit).slice(0, 7)) === 0 && String(r2[0].commit)) test.check('the passed run: kind, started, its commit and its line');
    else test.fail(OWED + 'runs of fx/G1.2: ' + short(r2));
    const rSince = labels(await runsOf({ since: '2999-01-01T00:00:00.000Z' }));
    const rCommit = labels(await runsOf({ commit: 'ffffffff' }));
    if (!rSince.length && !rCommit.length) test.check('runs filtered by since and commit: nothing that does not match');
    else test.fail(OWED + 'runs since the future / at ffffffff: ' + short({ since: rSince, commit: rCommit }));
    const rBulk = await runsOf({ kind: 'seed' });
    if (took(rBulk) && labels(rBulk).length > 0 && rBulk.body.more === true) test.check('three hundred runs: some come, and more says partial');
    else test.fail(OWED + 'the bulk runs search answered ' + short(rBulk.body));
    const wrote = node.asks.filter(function (x) { return x.verb !== 'item.get' && x.verb !== 'item.chat' && x.verb !== 'items.search'; }).length;
    const before = wrote;
    await q({ suite: 'zzRed.js' }); await runsOf({ item: 'fx/G1.3' });
    if (node.asks.filter(function (x) { return x.verb !== 'item.get' && x.verb !== 'item.chat' && x.verb !== 'items.search'; }).length === before) test.check('nothing is written through search');
    else test.fail(OWED + 'search wrote to the desk');
  } finally {
    try { fs.unlinkSync(slowFlag); } catch (e) { /* gone */ }
    await v.stop();
    node.close();
  }
}

// ── 2. THE IDLE HOUR AND ITS CHORES, on an agent's node ─────────────────────────────────────────────────────────
async function idleHalf() {
  test.subHeading('2. the idle hour: no desk write and no phase held, then the report and publishData');
  const choresRepo = scratchRepo('repo2', { 'README.md': 'chores\n' });
  const pubLog = path.join(scratch, 'publish.log');
  const pubJs = path.join(scratch, 'fakePublish.js');
  // The fake publishData: says it ran, with the port it was given, and whether the report was already there.
  fs.writeFileSync(pubJs, "const fs = require('fs');\nconst path = require('path');\n" +
    "const there = fs.existsSync(path.join(process.cwd(), 'agents', 'zzagent', 'testState.json'));\n" +
    "fs.appendFileSync(" + JSON.stringify(pubLog) + ", 'ran ' + process.argv[2] + ' report=' + there + '\\n');\n");
  const published = function () { try { return fs.readFileSync(pubLog, 'utf8').split('\n').filter(Boolean); } catch (e) { return []; } };
  const node = await fakeNode({ apps: ['desk', 'deskClient', 'deskVerify'], agent: 'zzagent' });
  const old = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
  node.rec('press', { id: 'fx/G2.1', what: 'go' }, old);
  node.items = [{ id: 'fx/G2', goal: '', with: '' }, { id: 'fx/G2.1', goal: 'fx/G2', with: 'zzagent', status: 'build' }];
  const dbPath = path.join(scratch, 'v2', 'verify.db');
  seed(dbPath, [
    { suite: 'zzSeed.js', title: 'seeded red', outcome: 'red', commit: 'abc1234' },
    { suite: 'zzSeed.js', title: 'seeded green', outcome: 'green', commit: 'abc1234' },
    { suite: 'zzSeed.js', title: 'flipped', outcome: 'red', commit: 'abc1111' },
    { suite: 'zzSeed.js', title: 'flipped', outcome: 'green', commit: 'abc2222' },
  ], []);
  const v = startVerify('v2', node, { db: dbPath, watchMs: 300, suiteMs: 20000, pull: '', idleMs: 5000, idleCheckMs: 300, publish: '"' + process.execPath + '" "' + pubJs + '"', choresRepo: choresRepo },
    { name: 'zznode', publicKey: '', ownerKey: '' });
  const report = path.join(choresRepo, 'agents', 'zzagent', 'testState.json');
  try {
    if (!await v.up()) { test.fail('the world: deskVerify did not start'); return; }
    await sleep(2000);
    const idles = function () { return node.published.filter(function (p) { return p && p.doing === 'idle'; }); };
    const lastIdle = function () { return idles().slice(-1)[0] || null; };
    if (!published().length && !fs.existsSync(report)) test.check('a phase held by its agent: not idle, however old the last write');
    else test.fail(OWED + 'chores ran while zzagent held fx/G2.1: ' + short(published()));
    const held = lastIdle();
    if (held && Array.isArray(held.holding) && held.holding.indexOf('fx/G2.1') !== -1) test.check('and the published idle state names what is held');
    else test.fail(OWED + 'the newest idle object: ' + short(held));

    node.items = [{ id: 'fx/G2', goal: '', with: '' }, { id: 'fx/G2.1', goal: 'fx/G2', with: '', status: '' }];
    const fresh = new Date().toISOString();
    node.rec('chat.add', { id: 'fx/G2.1', text: 'a fresh write' }, fresh);
    await sleep(1800);
    if (!published().length) test.check('a desk write inside the hour: not idle yet');
    else test.fail(OWED + 'chores ran a moment after a desk write: ' + short(published()));
    const counting = lastIdle();
    if (counting && counting.since === fresh && Number(counting.idleMs) === 5000) test.check('the countdown counts from the newest write, to the server\'s own hour (idleMs)');
    else test.fail(OWED + 'the newest idle object: ' + short(counting));

    await waitFor(function () { return published().length > 0; }, 12000);
    await sleep(1500);
    const runs = published();
    if (runs.length === 1 && /^ran \d+ report=true$/.test(runs[0])) test.check('idle: publishData ran once, for its node\'s port, after the report was written');
    else test.fail(OWED + 'publish runs: ' + short(runs));
    let rep = null;
    try { rep = JSON.parse(fs.readFileSync(report, 'utf8')); } catch (e) { rep = null; }
    const seededRed = rep && Array.isArray(rep.reds) ? rep.reds.filter(function (r) { return r.title === 'seeded red'; })[0] : null;
    if (rep && rep.agent === 'zzagent' && rep.tests === 3 && rep.red === 1 && rep.green === 2 && seededRed && seededRed.commit === 'abc1234') test.check('the test-state report, from its own dataset: 3 tests, 1 red, 2 green, the red named with its commit');
    else test.fail(OWED + 'agents/zzagent/testState.json reads ' + short(rep));
    if (fs.existsSync(path.join(choresRepo, 'agents', 'zzagent', 'testState.md'))) test.check('and its readable page beside it, testState.md');
    else test.fail(OWED + 'no testState.md beside the report');
    const done = lastIdle();
    if (done && /testState/.test(String(done.chores)) && /publish/i.test(String(done.chores))) test.check('the published idle state says what the chores did: ' + short(done.chores));
    else test.fail(OWED + 'the newest idle object: ' + short(done));
    await sleep(1500);
    if (published().length === 1) test.check('once per idle stretch: no second publish while nothing new was written');
    else test.fail(OWED + 'publish ran ' + published().length + ' times');
    if (node.viaClient.indexOf('changes') !== -1 && node.viaClient.indexOf('items.search') !== -1) test.check('on an agent\'s node the desk is read through its deskClient');
    else test.fail(OWED + 'asked through the deskClient: ' + short(node.viaClient.slice(0, 6)));
  } finally {
    await v.stop();
    node.close();
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
  const goal = { id: 'fx/G3', title: 'Fixes', goal: '', design: false, status: '', with: '', buttons: [], blocking: [], blocked: [], live: [], working: [], waiting: 0 };
  const fake = require('./deskFake.js').create([]);
  fake.items = [goal];
  let stopAnswer = { stopped: true };
  fake.verifier = {
    now: function () { return { running: { id: 'fx/G3.1', suite: 'spirit/test/zzRun.js', since: new Date().toISOString() }, queued: [], stopAsked: false }; },
    stop: function () { return stopAnswer; },
    'full.run': function () { return { queued: true }; },
  };
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
  fake.verifier.now = function () { return { running: { id: 'fx/G3.1', suite: 'spirit/test/zzRun.js', since: new Date().toISOString() }, queued: [], stopAsked: false }; };
  tabs.fire('click', { target: target({ 'data-tab': 'verifier' }), currentTarget: tabs });
  await settled(); await sleep(30); await settled();
  if (!/not answering/i.test(body.innerHTML)) test.check('an answer again clears "not answering"');
  else test.fail(OWED + 'still "not answering" after an answer: ' + short(body.innerHTML));

  // 2. EVERY PRESS: SENT AT ONCE, THEN THE ANSWER.
  const press = async function (what, fire, held, answered) {
    fake.hold(held);
    fire();
    await settled();
    const sent = body.innerHTML;
    fake.release();
    await settled(); await sleep(30); await settled();
    const after = body.innerHTML;
    if (/sent/i.test(sent)) test.check(what + ': shown as sent at once');
    else test.fail(OWED + what + ' showed nothing while its answer was out: ' + short(sent));
    if (answered.test(after)) test.check(what + ': then what came back');
    else test.fail(OWED + what + ' after the answer: ' + short(after));
  };
  await press('Stop', function () { body.fire('click', { target: target({ id: 'desk-verify-stop' }), currentTarget: body }); },
    function (c) { return c.server === 'deskVerify' && c.verb === 'stop'; }, /stop asked/i);
  await press('Run the full harness', function () {
    body.fire('click', { target: target({ id: 'desk-verify-full' }), currentTarget: body });
    body.fire('click', { target: target({ id: 'desk-verify-full' }), currentTarget: body });
  }, function (c) { return c.server === 'deskVerify' && c.verb === 'full.run'; }, /queued/i);
  await press('Verify again', function () { body.fire('click', { target: target({ 'data-reverify': 'fx/G3.1' }), currentTarget: body }); },
    function (c) { return c.server === 'desk' && c.verb === 'verify.again'; }, /Asked to verify fx\/G3\.1 again/);
  stopAnswer = { stopped: false };
  body.fire('click', { target: target({ id: 'desk-verify-stop' }), currentTarget: body });
  await settled(); await sleep(30); await settled();
  if (/nothing.*to stop|nothing running/i.test(body.innerHTML)) test.check('a Stop with nothing running says so');
  else test.fail(OWED + 'stop answered stopped false shows ' + short(body.innerHTML));

  // 3. STOP ASKED, UNTIL THE RUN ENDS.
  m.emit({ doing: 'item', id: 'fx/G3.1', suite: 'spirit/test/zzRun.js', index: 1, of: 2, tests: 3, expected: 9, line: 'running', since: new Date().toISOString(), stopAsked: true });
  await settled();
  if (/stop asked/i.test(body.innerHTML)) test.check('a run published with stopAsked reads "stop asked"');
  else test.fail(OWED + 'the tab during an asked stop: ' + short(body.innerHTML));
  m.emit({ doing: 'idle', id: '', suite: '', index: 0, of: 0, tests: 0, expected: 0, line: 'idle, nothing running', since: new Date().toISOString(), stopAsked: false, idleMs: 3600000, holding: [], chores: '' });
  await settled();
  const cleared = body.innerHTML.replace(/<button[^>]*>[^<]*<\/button>/g, '');
  if (!/stop asked/i.test(cleared)) test.check('and no longer once the run has ended');
  else test.fail(OWED + 'still "stop asked" when idle: ' + short(cleared));

  // 7. THE COUNTDOWN COUNTS TO THE SERVER'S HOUR AND SHOWS WHAT THE CHORES DID.
  m.emit({ doing: 'idle', id: '', suite: '', index: 0, of: 0, tests: 0, expected: 0, line: 'idle', since: new Date(Date.now() - 60000).toISOString(), stopAsked: false, idleMs: 600000, holding: [], chores: '' });
  await settled();
  if (/Idle in 9 min/.test(body.innerHTML)) test.check('the countdown counts to the hour deskVerify published (10 min here: 9 left)');
  else test.fail(OWED + 'the countdown with idleMs 600000 reads ' + short(body.innerHTML));
  const CH = 'testState written: agents/zzagent/testState.json (3 tests, 1 red); publishData: published';
  m.emit({ doing: 'idle', id: '', suite: '', index: 0, of: 0, tests: 0, expected: 0, line: 'idle', since: new Date(Date.now() - 7200000).toISOString(), stopAsked: false, idleMs: 3600000, holding: [], chores: CH });
  await settled();
  if (body.innerHTML.indexOf(CH) !== -1 && !/no chores are ruled/i.test(body.innerHTML)) test.check('past the hour, the tab shows what the chores did');
  else test.fail(OWED + 'past the hour the tab reads ' + short(body.innerHTML));
  m.emit({ doing: 'idle', id: '', suite: '', index: 0, of: 0, tests: 0, expected: 0, line: 'idle', since: new Date(Date.now() - 7200000).toISOString(), stopAsked: false, idleMs: 3600000, holding: ['fx/G3.1'], chores: '' });
  await settled();
  if (/fx\/G3\.1/.test(body.innerHTML) && /held|holds|busy/i.test(body.innerHTML)) test.check('a phase held says why the hour does not count');
  else test.fail(OWED + 'with a phase held the tab reads ' + short(body.innerHTML));

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
