'use strict';

// goal/G8.1: deskVerify's dataset - verify.db, one row per test, and what identifies a test. Red on today's tree;
// claude-windows wrote it from G8.1's box and does not build it.
//   Andy, 2026-10-06 (G8.1's box): a row per test, "suite, title, outcome, commit, dirty tree, UTC time"; "A record is
//   written when that test has none yet, or when its outcome changes"; "An outcome is red or green, nothing else";
//   "verify.db lives in deskVerify's process folder and is .gitignored"; the records arrive by its own verb, "the verb
//   \"record\" that supplies candidates for the database"; and "records are never sent together".
//   His rulings of 2026-10-09 (goal/G8.3): it runs in his clone and measures every incoming change.
//
// WHAT IS TRUE TODAY (read at c32427af): there is no process/js/deskVerify; testSupport's check(str) and fail(str) take
// one string, and a failing assertion's sentence carries its runtime values, so its red and its green share no key.
//
// THE SHAPE ASSERTED. The box fixes the behaviour; these names are the red writer's, for the builder to argue:
//   process/js/deskVerify/deskVerify.js, a node-run server; its argument `db` names the database file, verify.db in its
//   own folder by default, and git ignores that file. Table `results`: suite, title, outcome, commit, dirty, at.
//   record {suite, title, outcome} -> {written}: a row only for a test's first record or a change of outcome; commit,
//   dirty tree and time stamped by deskVerify itself, never sent.
//   testSupport: fail(title, detail) and check(title, detail) print both, but the title alone is the key. Given
//   `--verify-port <port>`, every check and fail posts one record, {suite: the suite's file name, title, outcome}, to
//   that node's jobs.api as {deskVerify: {record: ...}}, one post each, landing even when the suite exits right after
//   its report. Run without the argument, a suite posts nothing, as today.
// NOT ASSERTED: retitling the harness's existing assertions so their titles stop carrying runtime values (wsl-claude
// counted about 9,000 check and fail sites). This red asserts the mechanism; the retitling is its own work.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G8.1: ';
const REPO = path.join(__dirname, '..', '..');
const DIR = path.join(__dirname, '..', 'run', 'process', 'js', 'deskVerify');
const SERVER = path.join(DIR, 'deskVerify.js');
const MANIFEST = path.join(DIR, 'deskVerify.json');
const SUPPORT = path.join(__dirname, 'testSupport.js');
const CALLER = { owner: true, key: 'MCowBQYDK2VwAyEAdeskVerifyDatasetOwnerAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function git(args) { const r = spawnSync('git', args, { cwd: REPO, encoding: 'utf8' }); return { status: r.status, out: String(r.stdout || '').trim() }; }

test.startTest('goal/G8.1: deskVerify\'s dataset - verify.db, one row per test');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskverify-'));

async function dataset() {
  test.subHeading('1. deskVerify is a node-run server, and its database is not in git');
  let m = null;
  try { m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) { m = null; }
  if (fs.existsSync(SERVER) && m && m.kind === 'server' && m.operated === 'node') test.check('process/js/deskVerify holds a node-run server');
  else { test.fail(OWED + 'no node-run deskVerify: script ' + fs.existsSync(SERVER) + ', manifest ' + short(m)); return; }
  const ignored = git(['check-ignore', '-q', 'spirit/run/process/js/deskVerify/verify.db']);
  if (ignored.status === 0) test.check('git ignores spirit/run/process/js/deskVerify/verify.db');
  else test.fail(OWED + 'verify.db in its own folder is not ignored by git');

  const db = path.join(scratch, 'verify.db');
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'deskVerify', 'win32', 'process') : path.join(scratch, 'door.sock');
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('deskVerify', pipe);
  const kid = spawn(process.execPath, [SERVER, JSON.stringify({ db: db }), '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.deskVerify && r.body.deskVerify.ok !== false); } catch (e) { /* not yet */ } }
  const record = function (a) { return client.ask({ deskVerify: { record: a } }, CALLER).then(function (r) { return r || {}; }, function () { return {}; }); };
  try {
    if (up) test.check('the world: deskVerify answers its api');
    else { test.fail(OWED + 'deskVerify did not come up'); return; }

    test.subHeading('2. a row for a test\'s first record and for each change of outcome, and none in between');
    const a = await record({ suite: 'mini.js', title: 'it holds', outcome: 'green' });
    const b = await record({ suite: 'mini.js', title: 'it holds', outcome: 'green' });
    const c = await record({ suite: 'mini.js', title: 'it holds', outcome: 'red' });
    const d = await record({ suite: 'other.js', title: 'it holds', outcome: 'green' });
    const written = [a, b, c, d].map(function (r) { return r.body && r.body.written; });
    if (JSON.stringify(written) === JSON.stringify([true, false, true, true])) test.check('first record written, a repeat not, a flip written, the same title in another suite its own test');
    else test.fail(OWED + 'written answered ' + short(written));
    const bad = await record({ suite: 'mini.js', title: 'it holds', outcome: 'yellow' });
    if (bad.status !== 200 || (bad.body && bad.body.ok === false)) test.check('an outcome other than red or green is refused');
    else test.fail(OWED + 'outcome yellow answered ' + short(bad.body));

    test.subHeading('3. the rows carry what deskVerify stamps itself');
    let rows = [];
    try {
      const { DatabaseSync } = require('node:sqlite');
      const conn = new DatabaseSync(db);
      rows = conn.prepare('SELECT suite, title, outcome, "commit" AS c, dirty, at FROM results ORDER BY rowid').all();
      conn.close();
    } catch (e) { test.fail(OWED + 'no table results with suite, title, outcome, commit, dirty, at in ' + db + ': ' + short(e.message)); }
    if (rows.length === 3) test.check('three rows, as written');
    else test.fail(OWED + 'rows read ' + short(rows));
    const head = git(['rev-parse', 'HEAD']).out;
    const clean = git(['status', '--porcelain']).out === '';
    const r0 = rows[0] || {};
    if (head && r0.c === head) test.check('commit is this checkout\'s HEAD');
    else test.fail(OWED + 'commit reads ' + short(r0.c) + ', HEAD is ' + head);
    if (typeof r0.dirty === 'string' && (r0.dirty === '') === clean) test.check('dirty is the modified files, empty exactly when the tree is clean');
    else test.fail(OWED + 'dirty reads ' + short(r0.dirty) + ' on a ' + (clean ? 'clean' : 'dirty') + ' tree');
    if (/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/.test(String(r0.at || ''))) test.check('at is a UTC time');
    else test.fail(OWED + 'at reads ' + short(r0.at));
  } finally {
    await new Promise(function (r) { kid.once('exit', r); kid.kill(); setTimeout(r, 3000); });
  }
}

// A suite of two assertions, run as a real one is: it reports, then exits at once. With `linger`, it waits a second
// before reporting, as a long suite does between its assertions and its end, so its own posts land before the exit.
function miniSuite(linger) {
  const f = path.join(scratch, 'mini.js');
  const body = [
    "test.check('alpha holds');",
    "test.fail('beta holds', 'detail 42');",
    'test.reportSuccessFailureCount();',
    'process.exit(0);',
  ];
  fs.writeFileSync(f, [
    "'use strict';",
    'const test = require(' + JSON.stringify(SUPPORT) + ');',
    "test.startTest('mini');",
  ].concat(linger ? ["test.check('alpha holds');", "test.fail('beta holds', 'detail 42');", 'setTimeout(function () {', 'test.reportSuccessFailureCount();', 'process.exit(0);', '}, 1000);'] : body).join('\n'));
  return f;
}
function runMini(args, linger) {
  return new Promise(function (resolve) {
    const out = [];
    const kid = spawn(process.execPath, [miniSuite(linger)].concat(args), { stdio: ['ignore', 'pipe', 'pipe'] });
    kid.stdout.on('data', function (d) { out.push(String(d)); });
    kid.on('exit', function () { resolve(out.join('')); });
  });
}
function fakeNode() {
  return new Promise(function (resolve) {
    const bodies = [];
    const s = http.createServer(function (req, res) {
      let b = '';
      req.on('data', function (c) { b += c; });
      req.on('end', function () { bodies.push(b); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"written":true}'); });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, bodies: bodies, close: function () { s.close(); } }); });
  });
}
// GROWN IN THE VERIFY (claude-windows): a record counts only as a real node would take it, with verb jobs.api, as
// kernel.core.ask sends it; a node answers a body without a verb "no such verb", so such a record never arrives.
function recordsIn(bodies) {
  return bodies.map(function (b) { try { const j = JSON.parse(b); return j && j.verb === 'jobs.api' && j.ask && j.ask.deskVerify && j.ask.deskVerify.record; } catch (e) { return null; } }).filter(Boolean);
}

async function sender() {
  test.subHeading('4. a suite started with --verify-port posts one record per assertion, the title alone as key');
  const node = await fakeNode();
  try {
    const printed = await runMini(['--verify-port', String(node.port)]);
    await sleep(300);
    const recs = recordsIn(node.bodies);
    const want = [{ suite: 'mini.js', title: 'alpha holds', outcome: 'green' }, { suite: 'mini.js', title: 'beta holds', outcome: 'red' }];
    const got = recs.map(function (r) { return { suite: r.suite, title: r.title, outcome: r.outcome }; });
    if (JSON.stringify(got) === JSON.stringify(want)) test.check('two posts, {suite, title, outcome}, landing though the suite exits right after its report');
    else test.fail(OWED + 'the fake node received ' + short(node.bodies.slice(0, 3)));
    if (node.bodies.length === 2) test.check('one post per assertion, never grouped');
    else test.fail(OWED + node.bodies.length + ' posts for two assertions');
    if (/beta holds/.test(printed) && /detail 42/.test(printed) && !recs.some(function (r) { return /detail 42/.test(JSON.stringify(r)); })) {
      test.check('the detail is printed beside the title and kept out of the record');
    } else test.fail(OWED + 'printed ' + short(printed.replace(/[*✅❌]+/g, '').replace(/[\r\n]+/g, ' | ').replace(/ {2,}/g, ' ')) + '; records ' + short(recs));

    // GROWN IN THE VERIFY (claude-windows): the quick suite above exits before its own posts land, so only the
    // helper's re-sends reach the node. A suite that lingers lands its own posts first, and those must carry the verb.
    test.subHeading('4b. a suite that lingers: its own posts land, each as a real node takes it');
    const lingerNode = await fakeNode();
    try {
      await runMini(['--verify-port', String(lingerNode.port)], true);
      await sleep(300);
      const got2 = recordsIn(lingerNode.bodies).map(function (r) { return r.title + ':' + r.outcome; });
      if (lingerNode.bodies.length >= 2 && JSON.stringify(got2.slice(0, 2)) === JSON.stringify(['alpha holds:green', 'beta holds:red'])) test.check('its two posts arrive while it runs, with verb jobs.api');
      else test.fail(OWED + 'a lingering suite\'s posts read ' + short(lingerNode.bodies.slice(0, 3)));
    } finally { lingerNode.close(); }

    test.subHeading('5. run by hand, a suite posts nothing');
    const before = node.bodies.length;
    await runMini([]);
    await sleep(300);
    if (node.bodies.length === before) test.check('no --verify-port, no post');
    else test.fail('a suite run without the port posted ' + (node.bodies.length - before) + ' time(s)');
  } finally { node.close(); }
}

(async function () {
  await dataset();
  await sender();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
