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
// to testicle.test.set of the node of the checkout it runs in ... a checkout with no node running reports nowhere and still
// prints its lines".
//
// THE CALL, as this test asks it (goal/G47.2, the shapes the box leaves to the builder, wsl's):
//   test.run(title, severity, body, limitMs)   one test: body() returns true to pass; false, or a string saying what went
//                                              wrong, to fail; it may be async. limitMs is its time limit.
//   test.after(fn)                             run once every test has run, whatever they did: stopping what the tests started.
// The reporter runs the tests in the order they were given, one at a time, prints a line for each, reports each to the
// node, then prints the completion line and ends the process, its exit code 1 when any test failed.
//
// HOW IT IS TRIED: a scratch run tree under the system's temporary folder holds a copy of this tree's spirit/ (its state
// and test folders left out) and of spirit/test/testReport.js, with planted suites that use it. Its environment.json names
// the port of a fake node this test stands up, which answers api {family: testicle} with testicle's real api.js and keeps
// every testicle.test.set it is sent. Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }

// THE PLANTED SUITES, each a file of the scratch tree, its tests through test.run.
const REPORTER_FROM = function (depth) { return "require(require('path').join(__dirname, " + new Array(depth + 1).join("'..', ") + "'spirit', 'test', 'testReport.js'))"; };
const PROBE = [
  "'use strict';",
  "const fs = require('fs');",
  "const test = " + REPORTER_FROM(2) + ";",
  "test.run('it passes', 0.2, function () { return true; }, 1000);",
  "test.run('it fails with what went wrong', 0.2, function () { return 'the count was 3, not 4'; }, 1000);",
  "test.run('it fails with false', 0.2, function () { return false; }, 1000);",
  "test.run('it throws', 0.2, function () { throw new Error('a thrown boom'); }, 1000);",
  "test.run('it rejects', 0.2, async function () { await null; throw new Error('a rejected boom'); }, 1000);",
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
].join('\n');
const GENERAL = [
  "'use strict';",
  "const test = " + REPORTER_FROM(2) + ";",
  "test.run('a general rule holds', 0.4, function () { return 'it does not'; }, 1000);",
].join('\n');

function scratchTree(port) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'g472-report-'));
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
  // A general test is named <name>-sibling-<what>.js beside ./<name>.js: spirit/spirit.js is in the copy.
  put('spirit/test/spirit-sibling-zzProbeRules.js', GENERAL);
  return { root: root, run: run };
}

// The fake node: its door, /api/spirit, answering testicle's interface and keeping each testicle.test.set.
function fakeNode() {
  const sets = [];
  const asked = [];
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
      if (msg.call === 'api' && msg.args && msg.args.family === 'testicle') return send(200, { family: 'testicle', interface: iface });
      if (msg.call === 'testicle.test.set') { sets.push(msg.args); return send(200, { ok: true }); }
      return send(404, { ok: false, code: 'no-such-verb' });
    });
  });
  return new Promise(function (resolve) {
    server.listen(0, '127.0.0.1', function () { resolve({ port: server.address().port, sets: sets, asked: asked, close: function () { server.close(); } }); });
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
const W = { node: null, tree: null, probe: null, alone: null, twice: null, general: null, quiet: null, quietTree: null };
const setOf = function (title) { return ((W.node && W.node.sets) || []).filter(function (s) { return s && s.suite === 'probe/test/probe.js' && s.test === title; }); };
const printed = function (title) { return W.probe ? W.probe.out.split('\n').filter(function (l) { return l.indexOf(': ' + title) !== -1; }) : []; };

test.run('the world: a fake node and a scratch tree with planted suites stand up', 0.2, async function () {
  W.node = await fakeNode();
  W.tree = scratchTree(W.node.port);
  return fs.existsSync(path.join(W.tree.run, 'probe', 'test', 'probe.js')) && W.node.port > 0 || 'no scratch tree or no fake node';
}, 10000);

test.run('the world: the probe suite runs to its end', 0.2, async function () {
  W.probe = await runSuite(W.tree.run, 'probe/test/probe.js');
  return /Test completed\./.test(W.probe.out) || 'the probe did not end with its completion line: ' + short(W.probe.out.slice(-400));
}, 20000);

// ── A TEST'S RESULT ──
test.run('a body returning true passes, printed under its title', 0.2, function () {
  return printed('it passes').some(function (l) { return /SUCCESS/.test(l); }) || 'printed: ' + short(printed('it passes'));
}, 1000);
test.run('a body returning a string fails, its title printed with the string as detail', 0.2, function () {
  return printed('it fails with what went wrong').some(function (l) { return /FAILURE/.test(l) && /the count was 3, not 4/.test(l); }) || 'printed: ' + short(printed('it fails with what went wrong'));
}, 1000);
test.run('a body returning false fails under its title', 0.2, function () {
  return printed('it fails with false').some(function (l) { return /FAILURE/.test(l); }) || 'printed: ' + short(printed('it fails with false'));
}, 1000);

// ── A CRASH AND A HANG ──
test.run('a body that throws fails under its own title, the error as detail', 0.2, function () {
  return printed('it throws').some(function (l) { return /FAILURE/.test(l) && /a thrown boom/.test(l); }) || 'printed: ' + short(printed('it throws'));
}, 1000);
test.run('a body that rejects fails under its own title, the error as detail', 0.2, function () {
  return printed('it rejects').some(function (l) { return /FAILURE/.test(l) && /a rejected boom/.test(l); }) || 'printed: ' + short(printed('it rejects'));
}, 1000);
test.run('a body past its time limit fails under its own title as a hang', 0.2, function () {
  return printed('it never answers').some(function (l) { return /FAILURE/.test(l); }) || 'printed: ' + short(printed('it never answers'));
}, 1000);
test.run('the tests after a crash and a hang still run', 0.2, function () {
  return printed('it passes after a hang').some(function (l) { return /SUCCESS/.test(l); }) || 'printed: ' + short(printed('it passes after a hang'));
}, 1000);
test.run('test.after runs once every test has run', 0.2, function () {
  return fs.existsSync(path.join(W.tree.run, 'probe', 'test', 'after.txt')) || 'no after.txt';
}, 1000);
test.run('the completion line counts every test, and the exit code says a test failed', 0.2, function () {
  return (/✅:2\s+❌:6/.test(W.probe.out) && W.probe.code === 1) || 'completion: ' + short((W.probe.out.match(/Test completed[^\n]*/) || [''])[0]) + ', exit ' + W.probe.code;
}, 1000);

// ── THE REPORT ──
test.run('each test is reported to testicle.test.set of the node of its checkout, once', 0.2, function () {
  const titles = ['it passes', 'it fails with what went wrong', 'it fails with false', 'it throws', 'it rejects', 'it never answers', 'a security check', 'it passes after a hang'];
  const counts = titles.map(function (t) { return setOf(t).length; });
  return counts.every(function (n) { return n === 1; }) || 'sets per title ' + short(counts) + '; asked ' + short(W.node.asked.slice(0, 12));
}, 5000);
test.run('a report carries the tested script and the suite, scoped to run://', 0.2, function () {
  const s = setOf('it passes')[0] || {};
  return (s.script === 'probe/probe.js' && s.suite === 'probe/test/probe.js') || 'the report: ' + short(s);
}, 1000);
test.run('a report carries the title as the test, and the result', 0.2, function () {
  const p = setOf('it passes')[0] || {};
  const f = setOf('it fails with what went wrong')[0] || {};
  return (p.test === 'it passes' && p.verified === true && f.test === 'it fails with what went wrong' && f.verified === false) || 'reports: ' + short([p, f]);
}, 1000);
test.run('a failure\'s words stay out of its test title', 0.2, function () {
  return !((W.node && W.node.sets) || []).some(function (s) { return /the count was 3|boom/.test(String(s && s.test)); }) || 'a title holds failure words: ' + short(W.node.sets.map(function (s) { return s.test; }));
}, 1000);
test.run('a report carries the severity the test gives', 0.2, function () {
  const p = setOf('it passes')[0] || {};
  const sec = setOf('a security check')[0] || {};
  return (p.severity === 0.2 && sec.severity === 0.8) || 'severities: ' + short([p.severity, sec.severity]);
}, 1000);
test.run('a crash and a hang are reported at 0.7', 0.2, function () {
  const sev = ['it throws', 'it rejects', 'it never answers'].map(function (t) { return (setOf(t)[0] || {}).severity; });
  return JSON.stringify(sev) === JSON.stringify([0.7, 0.7, 0.7]) || 'severities: ' + short(sev);
}, 1000);

// ── A GENERAL TEST ──
test.run('the world: a general test runs with the file it judges', 0.2, async function () {
  W.general = await runSuite(W.tree.run, 'spirit/test/spirit-sibling-zzProbeRules.js', ['probe/probe.js']);
  return /Test completed\./.test(W.general.out) || 'it did not run: ' + short(W.general.out.slice(-300));
}, 20000);
test.run('a general test reports the file it judges as its script', 0.4, function () {
  const g = ((W.node && W.node.sets) || []).filter(function (s) { return s && s.suite === 'spirit/test/spirit-sibling-zzProbeRules.js'; });
  return (g.length === 1 && g[0].script === 'probe/probe.js' && g[0].test === 'a general rule holds' && g[0].severity === 0.4) || 'its reports: ' + short(g);
}, 5000);

// ── ONE TEST ALONE ──
test.run('the world: the probe suite runs with one test named', 0.2, async function () {
  const before = W.node.sets.length;
  W.alone = await runSuite(W.tree.run, 'probe/test/probe.js', ['--test', 'it fails with false']);
  W.alone.sets = W.node.sets.slice(before);
  return /Test completed\./.test(W.alone.out) || 'it did not run: ' + short(W.alone.out.slice(-300));
}, 20000);
test.run('one test named runs the sequence up to it, and no test after it', 0.2, function () {
  const ran = W.alone.sets.map(function (s) { return s.test; });
  return JSON.stringify(ran) === JSON.stringify(['it passes', 'it fails with what went wrong', 'it fails with false']) || 'it ran ' + short(ran);
}, 5000);

// ── A TITLE TWICE, A SEVERITY OUT OF RANGE ──
test.run('the world: a suite saying a title twice runs', 0.2, async function () {
  W.twice = await runSuite(W.tree.run, 'probe/test/twice.js');
  return /Test completed\./.test(W.twice.out) || 'it did not run: ' + short(W.twice.out.slice(-300));
}, 20000);
test.run('a title said twice in a suite fails the second time', 0.2, function () {
  const lines = W.twice.out.split('\n').filter(function (l) { return l.indexOf(': one title') !== -1; });
  return (lines.length === 2 && /SUCCESS/.test(lines[0]) && /FAILURE/.test(lines[1])) || 'printed: ' + short(lines);
}, 1000);
test.run('a severity outside 0.0 to 1.0 fails its test', 0.2, function () {
  return W.twice.out.split('\n').some(function (l) { return /FAILURE/.test(l) && l.indexOf(': a severity out of range') !== -1; }) || 'printed: ' + short(W.twice.out.slice(-400));
}, 1000);

// ── NO NODE ──
test.run('the world: a checkout with no node runs the probe suite', 0.2, async function () {
  W.quietTree = scratchTree(0);
  W.quiet = await runSuite(W.quietTree.run, 'probe/test/probe.js');
  return true;
}, 20000);
test.run('with no node a suite reports nowhere and still prints its lines', 0.2, function () {
  return (/SUCCESS[^\n]*: it passes/.test(W.quiet.out) && /Test completed\./.test(W.quiet.out)) || 'printed: ' + short(W.quiet.out.slice(-400));
}, 1000);

test.after(function () {
  try { if (W.node) W.node.close(); } catch (e) { /* closed */ }
  [W.tree, W.quietTree].forEach(function (t) { try { if (t) fs.rmSync(t.root, { recursive: true, force: true }); } catch (e) { /* scratch */ } });
});
