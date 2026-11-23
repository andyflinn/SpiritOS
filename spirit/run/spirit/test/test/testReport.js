'use strict';

// spirit/run/spirit/test/test/testReport.js
// The tests of spirit/test/testReport.js, the product test system's reporter, and of no other module (spec:
// ./testReport.md; goal/G47.2). The box: "Every test inside every suite has its unique (within the suite) title. Every test
// supplies its severity and reports itself to testicle, with the appropriate severity if the test hangs or crashes, else
// with the default severity. Every test holds on one single string, the title, which is supplied with the report, success
// or failure." Its report carries "the tested filename, scoped to run://", "the suite filename, scoped to run://", "the test
// title", "the result (success|fail)", "the severity". "One call per test, the reporter's", "test.run(title, severity,
// function)", "a throw or a rejection, that test fails at 0.7 under its own title, the error as detail, and the next runs",
// "each test raced against its own time limit set from its measured run time with a margin, 0.7 under its title", "each
// suite can run one test only, if that test is supplied as an extra argument, its title", "if a test depends on other tests
// running first, then the sequence is run up to the specified test", and from goal/G47.1: "the reporter reports every check
// to testicle.testicle.set of the node of the checkout it runs in ... a checkout with no node running reports nowhere and still
// prints its lines".
//
// THE CALL, as this test asks it (goal/G47.2, the shapes the box leaves to the builder, wsl's):
//   test.run(title, severity, body, limitMs)   one test: body() returns true to pass, false to fail; it may be async.
//                                              limitMs is its time limit.
//   test.after(fn)                             run once every test has run, whatever they did: stopping what the tests started.
// The reporter runs the tests in the order they were given, one at a time, prints a line for each, reports each to the
// node, then prints the completion line and ends the process, its exit code 1 when any test failed.
//
// HOW IT IS TRIED: a scratch run tree under the system's temporary folder holds a copy of this tree's spirit/ (its state
// and test folders left out) and of spirit/test/testReport.js, with planted suites that use it. Its environment.json names
// the port of a fake node this test stands up, which answers api {family: testicle} with testicle's real api.js and keeps
// every testicle.testicle.set it is sent. Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
// ITS TEMP FOLDERS FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"): one of its own for each
// it asks, under its suite's path, the whole of it removed when the suite ends.
const tempFolder = require('../../tempFolder.js');
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/test/test/testReport/' + name + tempAsked); }
test.after(function () { try { fs.rmSync(tempFolder.path('spirit/test/test/testReport'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fs', 'fileSystem.js')).VENDORED_FOLDERS;

// THE PLANTED SUITES, each a file of the scratch tree, its tests through test.run.
const REPORTER_FROM = function (depth) { return "require(require('path').join(__dirname, " + new Array(depth + 1).join("'..', ") + "'spirit', 'test', 'testReport.js'))"; };
const PROBE = [
  "'use strict';",
  "const fs = require('fs');",
  "const test = " + REPORTER_FROM(2) + ";",
  "test.run('it passes', 0.2, function () { return true; }, 1000);",
  // goal/G47.2: once a test is reported, a module loading the spirit object later still finds it the global it makes.
  "test.run('the spirit object stays global after a report', 0.2, function () { require(require('path').join(__dirname, '..', '..', 'spirit', 'spirit.js')); return (!!globalThis.spirit && typeof globalThis.spirit === 'object') || false; }, 1000);",
  "test.run('it fails with false', 0.2, function () { return false; }, 1000);",
  "test.run('it throws', 0.2, function () { throw new Error(); }, 1000);",
  "test.run('it rejects', 0.2, async function () { await null; throw new Error(); }, 1000);",
  "test.run('it never answers', 0.2, function () { return new Promise(function () {}); }, 300);",
  "test.run('a security check', 0.8, function () { return false; }, 1000);",
  "test.run('it passes after a hang', 0.2, async function () { await new Promise(function (r) { setTimeout(r, 10); }); return true; }, 1000);",
  "test.after(function () { fs.writeFileSync(require('path').join(__dirname, 'after.txt'), 'after ran'); });",
].join('\n');
const TWICE = [
  "'use strict';",
  "const test = " + REPORTER_FROM(2) + ";",
  "test.run('one title', 0.2, function () { return true; }, 1000);",
  "test.run('one title', 0.2, function () { return true; }, 1000);",
  "test.run('a severity out of range', 2, function () { return true; }, 1000);",
  // goal/G47.4: a title keeps the description rule, 128 bytes at most (an 'é' is two bytes).
  "test.run('" + 'é'.repeat(64) + "', 0.2, function () { return true; }, 1000);",
  "test.run('" + 'é'.repeat(64) + "x', 0.2, function () { return true; }, 1000);",
  // goal/G47.4, box v52: "that field rule will demand that desctiptions are NOT empty": an empty title, passing by its body.
  "test.run('', 0.2, function () { return true; }, 1000);",
].join('\n');
// Asked every 200 ms until it holds or the time is up.
const until = async function (fn, ms) { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch (e) { /* not yet */ } await new Promise(function (r) { setTimeout(r, 200); }); } return false; };
// A SUITE STOPPED WHILE IT RUNS (goal/G48.4; Andy: "WHY THE FUCK ARE TEST RUNS STILL LITTERING SHIT ALL OVER THE PLACE",
// "step 1 for now. and we continue."; the cause, testicle ending runs with SIGKILL, and testReport.js with no stop handler
// at all): its first test says it started and then waits; its test.after writes stopped-after.txt.
const STOPPED = [
  "'use strict';",
  "const fs = require('fs');",
  "const path = require('path');",
  "const test = " + REPORTER_FROM(2) + ";",
  "test.run('it waits to be stopped', 0.2, function () { fs.writeFileSync(path.join(__dirname, 'stopped-started.txt'), 'started'); return new Promise(function () {}); }, 60000);",
  "test.after(function () { fs.writeFileSync(path.join(__dirname, 'stopped-after.txt'), 'after ran'); });",
].join('\n');
const GENERAL = [
  "'use strict';",
  "const test = " + REPORTER_FROM(2) + ";",
  "test.run('a general rule holds', 0.4, function () { return false; }, 1000);",
].join('\n');

// A GENERAL TEST JUDGING TWO SCRIPTS (goal/G47.1, box v129, testicle.suite.success): the first passes, the second fails.
const GENERAL_TWO = [
  "'use strict';",
  "const test = " + REPORTER_FROM(2) + ";",
  "test.forScript('probe/probe.js', function () { test.run('a rule per script', 0.4, function () { return true; }, 1000); });",
  "test.forScript('probe/twice.js', function () { test.run('a rule per script', 0.4, function () { return false; }, 1000); });",
].join('\n');

function scratchTree(port) {
  const root = ownTemp('g472-report-');
  const run = path.join(root, 'run');
  const SKIP = ['state', 'test'];
  (function copy(from, to) {
    fs.mkdirSync(to, { recursive: true });
    fs.readdirSync(from, { withFileTypes: true }).forEach(function (d) {
      const f = path.join(from, d.name);
      if (SKIP.indexOf(d.name) !== -1 || VENDORED_FOLDERS.holds(f)) return;
      if (d.isDirectory()) copy(f, path.join(to, d.name));
      else if (d.isFile() && /\.(js|json)$/.test(d.name)) fs.copyFileSync(f, path.join(to, d.name));
    });
  }(path.join(RUN, 'spirit'), path.join(run, 'spirit')));
  fs.mkdirSync(path.join(run, 'spirit', 'test'), { recursive: true });
  fs.copyFileSync(path.join(RUN, 'spirit', 'test', 'testReport.js'), path.join(run, 'spirit', 'test', 'testReport.js'));
  if (port) {
    fs.mkdirSync(path.join(run, 'spirit', 'state'), { recursive: true });
    fs.writeFileSync(path.join(run, 'spirit', 'state', 'environment.json'), JSON.stringify({ PORT: port }));
  }
  const put = function (rel, text) { fs.mkdirSync(path.dirname(path.join(run, rel)), { recursive: true }); fs.writeFileSync(path.join(run, rel), text); };
  put('probe/probe.js', "'use strict';\n// the production script the probe tests\n");
  put('probe/test/probe.js', PROBE);
  put('probe/test/twice.js', TWICE);
  put('probe/twice.js', "'use strict';\n");
  put('probe/test/stopped.js', STOPPED);
  // A general test is named <name>-sibling-<what>.js beside ./<name>.js: spirit/spirit.js is in the copy.
  put('spirit/test/spirit-sibling-zzProbeRules.js', GENERAL);
  put('spirit/test/spirit-sibling-zzProbeTwo.js', GENERAL_TWO);
  return { root: root, run: run };
}

// The fake node: its door, /api/spirit, answering testicle's interface and keeping each testicle.testicle.set.
function fakeNode() {
  const sets = [];
  const asked = [];
  // goal/G47.1, box v129: testicle.suite.success {script, suite, success}, each kept, and every report in the order it came.
  const successes = [];
  const order = [];
  const iface = fs.readFileSync(path.join(RUN, 'spirit', 'app', 'testicle', 'api.js'), 'utf8');
  const server = http.createServer(function (req, res) {
    let body = '';
    req.on('data', function (c) { body += c; });
    req.on('end', function () {
      let msg = null;
      try { msg = JSON.parse(body); } catch (e) { msg = null; }
      asked.push(msg && msg.call);
      const send = function (status, obj) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
      if (req.method !== 'POST' || req.url !== '/api/spirit' || !msg) return send(404, { ok: false, code: 'not-found' });
      if (msg.call === 'api' && msg.args && msg.args.branch === 'testicle') return send(200, { branch: 'testicle', interface: iface });
      if (msg.call === 'testicle.testicle.set') { sets.push(msg.args); order.push({ verb: 'set', args: msg.args }); return send(200, { ok: true }); }
      if (msg.call === 'testicle.suite.success') { successes.push(msg.args); order.push({ verb: 'success', args: msg.args }); return send(200, { ok: true }); }
      return send(404, { ok: false, code: 'no-such-verb' });
    });
  });
  return new Promise(function (resolve) {
    server.listen(0, '127.0.0.1', function () { resolve({ port: server.address().port, sets: sets, asked: asked, successes: successes, order: order, close: function () { server.close(); } }); });
  });
}

function runSuite(run, rel, args) {
  return new Promise(function (resolve) {
    const env = Object.assign({}, process.env);
    Object.keys(env).forEach(function (k) { if (/^SPIRIT_/.test(k)) delete env[k]; });
    const file = path.join(run, rel);
    const kid = spawn(process.execPath, [file].concat(args || []), { cwd: run, env: env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    kid.stdout.on('data', function (c) { out += c; });
    kid.stderr.on('data', function (c) { out += c; });
    const timer = setTimeout(function () { kid.kill('SIGKILL'); }, 30000);
    kid.on('close', function (code) { clearTimeout(timer); resolve({ code: code, out: out }); });
  });
}

// What the scratch tree and its runs hold, shared by the tests below; each test reads it, the first ones make it.
const W = { node: null, tree: null, probe: null, alone: null, twice: null, general: null, two: null, quiet: null, quietTree: null };
const setOf = function (title) { return ((W.node && W.node.sets) || []).filter(function (s) { return s && s.suite === 'probe/test/probe.js' && s.test === title; }); };
// A TEST'S LINE IS ITS TITLE AND ITS MARK (goal/G47.1, Andy: "A TEST ANSWERS SUCCESS OR FAILURE WITH IT's FUCKING TITLE
// STRING, THE FUCKING FAILURE STRING GETS DELETED FROM EVERY FUCKING TEST"): the mark a run printed after a title, '' when none.
const markIn = function (out, title) {
  let mark = '';
  String(out || '').split('\n').forEach(function (l) { const t = l.replace(/^\*+\s*/, '').trim(); if (t === title + ' ✅' || t === title + ' ❌') mark = t.slice(-1); });
  return mark;
};
const passed = function (title) { return !!W.probe && markIn(W.probe.out, title) === '✅'; };
const failed = function (title) { return !!W.probe && markIn(W.probe.out, title) === '❌'; };

test.run('a fake node and a scratch tree with planted suites stand up', 0.2, async function () {
  W.node = await fakeNode();
  W.tree = scratchTree(W.node.port);
  return fs.existsSync(path.join(W.tree.run, 'probe', 'test', 'probe.js')) && W.node.port > 0 || false;
}, test.limit.slow);

test.run('the probe suite runs to its end', 0.2, async function () {
  W.probe = await runSuite(W.tree.run, 'probe/test/probe.js');
  return /Test completed\./.test(W.probe.out) || false;
}, test.limit.slow);

// ── A TEST'S RESULT ──
test.run('a body returning true passes, its title printed with ✅', 0.2, function () {
  return passed('it passes');
}, test.limit.quick);
test.run('a body returning false fails, its title printed with ❌', 0.2, function () {
  return failed('it fails with false');
}, test.limit.quick);

// ── A CRASH AND A HANG ──
test.run('a body that throws fails, its title printed with ❌', 0.2, function () {
  return failed('it throws');
}, test.limit.quick);
test.run('a body that rejects fails, its title printed with ❌', 0.2, function () {
  return failed('it rejects');
}, test.limit.quick);
test.run('a body past its time limit fails, its title printed with ❌', 0.2, function () {
  return failed('it never answers');
}, test.limit.quick);
test.run('a module loading the spirit object after a report finds it global', 0.2, function () {
  return passed('the spirit object stays global after a report');
}, test.limit.quick);
test.run('the tests after a crash and a hang still run', 0.2, function () {
  return passed('it passes after a hang');
}, test.limit.quick);
test.run('test.after runs once every test has run', 0.2, function () {
  return fs.existsSync(path.join(W.tree.run, 'probe', 'test', 'after.txt')) || false;
}, test.limit.quick);
// goal/G48.4: a suite asked to stop runs its test.after and ends by itself, so what it started is cleaned up and nothing
// of it is left to be killed. Asked by a stop message on its message channel, as testicle will ask on every system (cw: "on
// Windows a child cannot catch SIGTERM ... testicle starts each suite with a message channel to it (node's ipc) ... and
// asks it to stop by sending a stop message on that channel"), the message { stop: true }; and by SIGTERM where a system
// has one.
const stopProbe = async function (stop, file) {
  if (!W.tree) return false;
  const dir = path.join(W.tree.run, 'probe', 'test');
  ['stopped-started.txt', 'stopped-after.txt'].forEach(function (f) { try { fs.rmSync(path.join(dir, f), { force: true }); } catch (e) { /* none */ } });
  const env = Object.assign({}, process.env);
  Object.keys(env).forEach(function (k) { if (/^SPIRIT_/.test(k)) delete env[k]; });
  const kid = spawn(process.execPath, [path.join(dir, file)], { cwd: W.tree.run, env: env, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  let ended = false;
  kid.on('exit', function () { ended = true; });
  const started = await until(function () { return Promise.resolve(fs.existsSync(path.join(dir, 'stopped-started.txt'))); }, 20000);
  if (!started) { try { kid.kill('SIGKILL'); } catch (e) { /* gone */ } return false; }
  stop(kid);
  const gone = await until(function () { return Promise.resolve(ended); }, 10000);
  if (!gone) { try { kid.kill('SIGKILL'); } catch (e) { /* gone */ } }
  return !!gone && fs.existsSync(path.join(dir, 'stopped-after.txt'));
};
test.run('a suite sent the stop message while a test runs runs its test.after and ends by itself within 10 seconds', 0.4, async function () {
  return (await stopProbe(function (kid) { kid.send({ stop: true }); }, 'stopped.js')) || false;
}, test.limit.slow);
if (process.platform !== 'win32') {
  test.run('a suite sent SIGTERM while a test runs runs its test.after and ends by itself within 10 seconds', 0.4, async function () {
    return (await stopProbe(function (kid) { kid.kill('SIGTERM'); }, 'stopped.js')) || false;
  }, test.limit.slow);
}
test.run('the completion line counts every test, and the exit code says a test failed', 0.2, function () {
  return (/✅:3\s+❌:5/.test(W.probe.out) && W.probe.code === 1) || false;
}, test.limit.quick);

// ── THE REPORT ──
test.run('each test is reported to testicle.testicle.set of the node of its checkout, once', 0.2, function () {
  const titles = ['it passes', 'the spirit object stays global after a report', 'it fails with false', 'it throws', 'it rejects', 'it never answers', 'a security check', 'it passes after a hang'];
  const counts = titles.map(function (t) { return setOf(t).length; });
  return counts.every(function (n) { return n === 1; }) || false;
}, test.limit.slow);
test.run('a report carries the tested script and the suite, scoped to run://', 0.2, function () {
  const s = setOf('it passes')[0] || {};
  return (s.script === 'probe/probe.js' && s.suite === 'probe/test/probe.js') || false;
}, test.limit.quick);
test.run('a report carries the title as the test, and the result', 0.2, function () {
  const p = setOf('it passes')[0] || {};
  const f = setOf('it fails with false')[0] || {};
  return (p.test === 'it passes' && p.verified === true && f.test === 'it fails with false' && f.verified === false) || false;
}, test.limit.quick);
test.run('a report carries the severity the test gives', 0.2, function () {
  const p = setOf('it passes')[0] || {};
  const sec = setOf('a security check')[0] || {};
  return (p.severity === 0.2 && sec.severity === 0.8) || false;
}, test.limit.quick);
test.run('a crash and a hang are reported at 0.7', 0.2, function () {
  const sev = ['it throws', 'it rejects', 'it never answers'].map(function (t) { return (setOf(t)[0] || {}).severity; });
  return JSON.stringify(sev) === JSON.stringify([0.7, 0.7, 0.7]) || false;
}, test.limit.quick);

// ── A GENERAL TEST ──
test.run('a general test runs with the file it judges', 0.2, async function () {
  W.general = await runSuite(W.tree.run, 'spirit/test/spirit-sibling-zzProbeRules.js', ['probe/probe.js']);
  return /Test completed\./.test(W.general.out) || false;
}, test.limit.slow);
test.run('a general test reports the file it judges as its script', 0.4, function () {
  const g = ((W.node && W.node.sets) || []).filter(function (s) { return s && s.suite === 'spirit/test/spirit-sibling-zzProbeRules.js'; });
  return (g.length === 1 && g[0].script === 'probe/probe.js' && g[0].test === 'a general rule holds' && g[0].severity === 0.4) || false;
}, test.limit.slow);

// ── A SUITE'S SUCCESS (goal/G47.1, box v129: "the reporter reports a suite's success or failure for a script through the
// new verb testicle.suite.success {script, suite, success}, a general test once per script, at the time it knows"; Andy:
// "any suite, including general ones know at the TIME if it was a success") ──
const successOf = function (suite) { return ((W.node && W.node.successes) || []).filter(function (x) { return x && x.suite === suite; }); };
test.run('a suite reports its success or failure for its script once, through testicle.suite.success', 0.4, function () {
  const got = successOf('probe/test/probe.js');
  return (got.length === 1 && got[0].script === 'probe/probe.js' && got[0].success === false) || false;
}, test.limit.quick);
test.run('a general test judging two scripts runs, handed both', 0.2, async function () {
  W.two = await runSuite(W.tree.run, 'spirit/test/spirit-sibling-zzProbeTwo.js', ['probe/probe.js', 'probe/twice.js']);
  return /Test completed\./.test(W.two.out) || false;
}, test.limit.slow);
test.run('a general test reports success once per script: the one that held true, the one that failed false', 0.4, function () {
  const got = successOf('spirit/test/spirit-sibling-zzProbeTwo.js');
  const a = got.filter(function (x) { return x.script === 'probe/probe.js'; }), b = got.filter(function (x) { return x.script === 'probe/twice.js'; });
  return (a.length === 1 && a[0].success === true && b.length === 1 && b[0].success === false) || false;
}, test.limit.quick);
test.run('a general test reports the first script\'s success at the time it knows, before any result of the second script', 0.4, function () {
  const o = ((W.node && W.node.order) || []).filter(function (x) { return x.args && x.args.suite === 'spirit/test/spirit-sibling-zzProbeTwo.js'; });
  const first = o.findIndex(function (x) { return x.verb === 'success' && x.args.script === 'probe/probe.js'; });
  const second = o.findIndex(function (x) { return x.verb === 'set' && x.args.script === 'probe/twice.js'; });
  return (first !== -1 && second !== -1 && first < second) || false;
}, test.limit.quick);

// ── ONE TEST ALONE ──
test.run('the probe suite runs with one test named', 0.2, async function () {
  const before = W.node.sets.length;
  W.alone = await runSuite(W.tree.run, 'probe/test/probe.js', ['--test', 'it fails with false']);
  W.alone.sets = W.node.sets.slice(before);
  return /Test completed\./.test(W.alone.out) || false;
}, test.limit.slow);
test.run('one test named runs the sequence up to it, and no test after it', 0.2, function () {
  const ran = W.alone.sets.map(function (s) { return s.test; });
  return JSON.stringify(ran) === JSON.stringify(['it passes', 'the spirit object stays global after a report', 'it fails with false']) || false;
}, test.limit.slow);

// ── A TITLE TWICE, A SEVERITY OUT OF RANGE ──
test.run('a suite that says a title twice runs', 0.2, async function () {
  W.twice = await runSuite(W.tree.run, 'probe/test/twice.js');
  return /Test completed\./.test(W.twice.out) || false;
}, test.limit.slow);
// TWO TESTS OF ONE TITLE FAIL THE SUITE, NOT A TEST (goal/G49.6; Andy: "that refusal has to be a suite level failure", "rule
// one wins": every test is run and reported as it ends): both run, and the suite's success goes out false, duplicateTitles.
test.run('a title said twice in a suite runs both times, and the suite reports success false as duplicateTitles', 0.2, function () {
  const lines = W.twice.out.split('\n').map(function (l) { return l.replace(/^\*+\s*/, '').trim(); }).filter(function (t) { return t === 'one title ✅' || t === 'one title ❌'; });
  const said = ((W.node && W.node.successes) || []).filter(function (s) { return s && s.suite === 'probe/test/twice.js'; });
  return (lines.length === 2 && lines[0] === 'one title ✅' && lines[1] === 'one title ✅' && said.some(function (s) { return s.success === false && s.reason === 'duplicateTitles'; })) || false;
}, test.limit.quick);
test.run('a severity outside 0.0 to 1.0 fails its test', 0.2, function () {
  return markIn(W.twice.out, 'a severity out of range') === '❌';
}, test.limit.quick);
// A TITLE PAST THE DESCRIPTION RULE (goal/G47.4, the box: "test titles are constrained BY DESCRIPTION_MAX_BYTES, in
// spirit/fieldRules.js"), counted in bytes; since goal/G49.6 a longer one is cut before the character that overflows (Andy: "cut
// before the character that causes overflow"), never refused: at 128 it passes, and one byte past is cut to the same 128.
test.run('a title of 128 bytes passes, and one of 129 bytes is cut to its first 128 and run', 0.2, function () {
  return (markIn(W.twice.out, 'é'.repeat(64)) === '✅' && ((W.node && W.node.sets) || []).some(function (s) { return s && s.test === 'é'.repeat(64); })) || false;
}, test.limit.quick);
test.run('an empty title fails its test', 0.2, function () {
  const marks = W.twice.out.split('\n').map(function (l) { return l.replace(/^\*+\s*/, '').trim(); });
  return (marks.indexOf('❌') !== -1 && marks.indexOf('✅') === -1) || false;
}, test.limit.quick);

// ── NO NODE ──
test.run('a checkout with no node runs the probe suite', 0.2, async function () {
  W.quietTree = scratchTree(0);
  W.quiet = await runSuite(W.quietTree.run, 'probe/test/probe.js');
  return true;
}, test.limit.slow);
test.run('with no node a suite reports nowhere and still prints its lines', 0.2, function () {
  return (markIn(W.quiet.out, 'it passes') === '✅' && /Test completed\./.test(W.quiet.out)) || false;
}, test.limit.quick);

// EVERY RESULT REACHES TESTICLE THE MOMENT ITS TEST IS DONE (goal/G49.5; Andy: "write the red to ensure that the testicle
// server gets a report IMMEDIATELY after completion of a test"; box v144: "every result reaches testicle the moment the page
// knows it"; and "it is supposed to pick up there where it was interrupted", so nothing may wait in a queue). A planted
// suite of 100 quick tests, each printing when it ended, against a stand-in node that takes 60 ms to answer each report.
// Reports sent one after the other would land the last at about 6 s; sent as each test ends, each lands well inside a second.
const FLOOD = [
  "'use strict';",
  "const test = " + REPORTER_FROM(2) + ";",
  "for (let i = 0; i < 100; i++) test.run('flood ' + i, 0.2, function () { process.stdout.write('ENDED ' + i + ' ' + Date.now() + '\\n'); return true; }, 1000);",
].join('\n') + '\n';
function slowNode(ms) {
  const landed = {};
  const iface = fs.readFileSync(path.join(RUN, 'spirit', 'app', 'testicle', 'api.js'), 'utf8');
  const server = http.createServer(function (req, res) {
    let body = '';
    req.on('data', function (c) { body += c; });
    req.on('end', function () {
      let msg = null;
      try { msg = JSON.parse(body); } catch (e) { msg = null; }
      const send = function (status, obj) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
      if (!msg) return send(404, { ok: false });
      if (msg.call === 'api' && msg.args && msg.args.branch === 'testicle') return send(200, { branch: 'testicle', interface: iface });
      if (msg.call === 'testicle.testicle.set' && msg.args && /^flood \d+$/.test(String(msg.args.test))) {
        if (landed[msg.args.test] === undefined) landed[msg.args.test] = Date.now();
        return setTimeout(function () { send(200, { ok: true }); }, ms);
      }
      return setTimeout(function () { send(200, { ok: true }); }, ms);
    });
  });
  return new Promise(function (resolve) {
    server.listen(0, '127.0.0.1', function () { resolve({ port: server.address().port, landed: landed, close: function () { server.close(); } }); });
  });
}
const F = {};
test.run('a planted suite of 100 quick tests runs against a node that takes 60 ms to answer each report', 0.2, async function () {
  F.node = await slowNode(60);
  F.tree = scratchTree(F.node.port);
  fs.mkdirSync(path.join(F.tree.run, 'flood', 'test'), { recursive: true });
  fs.writeFileSync(path.join(F.tree.run, 'flood', 'flood.js'), "'use strict';\n");
  fs.writeFileSync(path.join(F.tree.run, 'flood', 'test', 'flood.js'), FLOOD);
  const r = await runSuite(F.tree.run, 'flood/test/flood.js');
  F.ended = {};
  String(r.out).split('\n').forEach(function (l) { const m = /^ENDED (\d+) (\d+)$/.exec(l.trim()); if (m) F.ended['flood ' + m[1]] = Number(m[2]); });
  return Object.keys(F.ended).length === 100 || false;
}, test.limit.slow);
test.run('every one of the 100 reports reaches the node within a second of its test ending', 0.4, function () {
  if (!F.ended || Object.keys(F.ended).length !== 100) return false;
  const late = Object.keys(F.ended).filter(function (t) { return !(F.node.landed[t] !== undefined && F.node.landed[t] - F.ended[t] < 1000); });
  return late.length === 0 || false;
}, test.limit.quick);
test.after(function () {
  try { if (F.node) F.node.close(); } catch (e) { /* closed */ }
  try { if (F.tree) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree({ root: F.tree.root }); } catch (e) { /* temp */ }
});

test.after(function () {
  try { if (W.node) W.node.close(); } catch (e) { /* closed */ }
  [W.tree, W.quietTree].forEach(function (t) { try { if (t) require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).freeTree(t); } catch (e) { /* scratch */ } });
});
