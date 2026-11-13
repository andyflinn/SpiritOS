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
//   test.run(title, severity, body, limitMs)   one test: body() returns true to pass; false, or a string saying what went
//                                              wrong, to fail; it may be async. limitMs is its time limit.
//   test.after(fn)                             run once every test has run, whatever they did: stopping what the tests started.
// The reporter runs the tests in the order they were given, one at a time, prints a line for each, reports each to the
// node, then prints the completion line and ends the process, its exit code 1 when any test failed.
//
// HOW IT IS TRIED: a scratch run tree under the system's temporary folder holds a copy of this tree's spirit/ (its state
// and test folders left out) and of spirit/test/testReport.js, with planted suites that use it. Its environment.json names
// the port of a fake node this test stands up, which answers api {family: testicle} with testicle's real api.js and keeps
// every testicle.testicle.set it is sent. Neither Andy's node nor an agent's is touched.

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
  // goal/G47.2: once a test is reported, a module loading the spirit object later still finds it the global it makes.
  "test.run('the spirit object stays global after a report', 0.2, function () { require(require('path').join(__dirname, '..', '..', 'spirit', 'spirit.js')); return (!!globalThis.spirit && typeof globalThis.spirit === 'object') || 'no global spirit after a report'; }, 1000);",
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

// A GENERAL TEST JUDGING TWO SCRIPTS (goal/G47.1, box v129, testicle.suite.success): the first passes, the second fails.
const GENERAL_TWO = [
  "'use strict';",
  "const test = " + REPORTER_FROM(2) + ";",
  "test.forScript('probe/probe.js', function () { test.run('a rule per script', 0.4, function () { return true; }, 1000); });",
  "test.forScript('probe/twice.js', function () { test.run('a rule per script', 0.4, function () { return 'it does not hold'; }, 1000); });",
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
      if (msg.call === 'api' && msg.args && msg.args.family === 'testicle') return send(200, { family: 'testicle', interface: iface });
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
const printed = function (title) { return W.probe ? W.probe.out.split('\n').filter(function (l) { return l.indexOf(': ' + title) !== -1; }) : []; };

test.run('the world: a fake node and a scratch tree with planted suites stand up', 0.2, async function () {
  W.node = await fakeNode();
  W.tree = scratchTree(W.node.port);
  return fs.existsSync(path.join(W.tree.run, 'probe', 'test', 'probe.js')) && W.node.port > 0 || 'no scratch tree or no fake node';
}, test.limit.slow);

test.run('the world: the probe suite runs to its end', 0.2, async function () {
  W.probe = await runSuite(W.tree.run, 'probe/test/probe.js');
  return /Test completed\./.test(W.probe.out) || 'the probe did not end with its completion line: ' + short(W.probe.out.slice(-400));
}, test.limit.slow);

// ── A TEST'S RESULT ──
test.run('a body returning true passes, printed under its title', 0.2, function () {
  return printed('it passes').some(function (l) { return /SUCCESS/.test(l); }) || 'printed: ' + short(printed('it passes'));
}, test.limit.quick);
test.run('a body returning a string fails, its title printed with the string as detail', 0.2, function () {
  return printed('it fails with what went wrong').some(function (l) { return /FAILURE/.test(l) && /the count was 3, not 4/.test(l); }) || 'printed: ' + short(printed('it fails with what went wrong'));
}, test.limit.quick);
test.run('a body returning false fails under its title', 0.2, function () {
  return printed('it fails with false').some(function (l) { return /FAILURE/.test(l); }) || 'printed: ' + short(printed('it fails with false'));
}, test.limit.quick);

// ── A CRASH AND A HANG ──
test.run('a body that throws fails under its own title, the error as detail', 0.2, function () {
  return printed('it throws').some(function (l) { return /FAILURE/.test(l) && /a thrown boom/.test(l); }) || 'printed: ' + short(printed('it throws'));
}, test.limit.quick);
test.run('a body that rejects fails under its own title, the error as detail', 0.2, function () {
  return printed('it rejects').some(function (l) { return /FAILURE/.test(l) && /a rejected boom/.test(l); }) || 'printed: ' + short(printed('it rejects'));
}, test.limit.quick);
test.run('a body past its time limit fails under its own title as a hang', 0.2, function () {
  return printed('it never answers').some(function (l) { return /FAILURE/.test(l); }) || 'printed: ' + short(printed('it never answers'));
}, test.limit.quick);
test.run('a module loading the spirit object after a report finds it global', 0.2, function () {
  return printed('the spirit object stays global after a report').some(function (l) { return /SUCCESS/.test(l); }) || 'printed: ' + short(printed('the spirit object stays global after a report'));
}, test.limit.quick);
test.run('the tests after a crash and a hang still run', 0.2, function () {
  return printed('it passes after a hang').some(function (l) { return /SUCCESS/.test(l); }) || 'printed: ' + short(printed('it passes after a hang'));
}, test.limit.quick);
test.run('test.after runs once every test has run', 0.2, function () {
  return fs.existsSync(path.join(W.tree.run, 'probe', 'test', 'after.txt')) || 'no after.txt';
}, test.limit.quick);
test.run('the completion line counts every test, and the exit code says a test failed', 0.2, function () {
  return (/✅:3\s+❌:6/.test(W.probe.out) && W.probe.code === 1) || 'completion: ' + short((W.probe.out.match(/Test completed[^\n]*/) || [''])[0]) + ', exit ' + W.probe.code;
}, test.limit.quick);

// ── THE REPORT ──
test.run('each test is reported to testicle.testicle.set of the node of its checkout, once', 0.2, function () {
  const titles = ['it passes', 'the spirit object stays global after a report', 'it fails with what went wrong', 'it fails with false', 'it throws', 'it rejects', 'it never answers', 'a security check', 'it passes after a hang'];
  const counts = titles.map(function (t) { return setOf(t).length; });
  return counts.every(function (n) { return n === 1; }) || 'sets per title ' + short(counts) + '; asked ' + short(W.node.asked.slice(0, 12));
}, test.limit.slow);
test.run('a report carries the tested script and the suite, scoped to run://', 0.2, function () {
  const s = setOf('it passes')[0] || {};
  return (s.script === 'probe/probe.js' && s.suite === 'probe/test/probe.js') || 'the report: ' + short(s);
}, test.limit.quick);
test.run('a report carries the title as the test, and the result', 0.2, function () {
  const p = setOf('it passes')[0] || {};
  const f = setOf('it fails with what went wrong')[0] || {};
  return (p.test === 'it passes' && p.verified === true && f.test === 'it fails with what went wrong' && f.verified === false) || 'reports: ' + short([p, f]);
}, test.limit.quick);
test.run('a failure\'s words stay out of its test title', 0.2, function () {
  return !((W.node && W.node.sets) || []).some(function (s) { return /the count was 3|boom/.test(String(s && s.test)); }) || 'a title holds failure words: ' + short(W.node.sets.map(function (s) { return s.test; }));
}, test.limit.quick);
test.run('a report carries the severity the test gives', 0.2, function () {
  const p = setOf('it passes')[0] || {};
  const sec = setOf('a security check')[0] || {};
  return (p.severity === 0.2 && sec.severity === 0.8) || 'severities: ' + short([p.severity, sec.severity]);
}, test.limit.quick);
test.run('a crash and a hang are reported at 0.7', 0.2, function () {
  const sev = ['it throws', 'it rejects', 'it never answers'].map(function (t) { return (setOf(t)[0] || {}).severity; });
  return JSON.stringify(sev) === JSON.stringify([0.7, 0.7, 0.7]) || 'severities: ' + short(sev);
}, test.limit.quick);

// ── A GENERAL TEST ──
test.run('the world: a general test runs with the file it judges', 0.2, async function () {
  W.general = await runSuite(W.tree.run, 'spirit/test/spirit-sibling-zzProbeRules.js', ['probe/probe.js']);
  return /Test completed\./.test(W.general.out) || 'it did not run: ' + short(W.general.out.slice(-300));
}, test.limit.slow);
test.run('a general test reports the file it judges as its script', 0.4, function () {
  const g = ((W.node && W.node.sets) || []).filter(function (s) { return s && s.suite === 'spirit/test/spirit-sibling-zzProbeRules.js'; });
  return (g.length === 1 && g[0].script === 'probe/probe.js' && g[0].test === 'a general rule holds' && g[0].severity === 0.4) || 'its reports: ' + short(g);
}, test.limit.slow);

// ── A SUITE'S SUCCESS (goal/G47.1, box v129: "the reporter reports a suite's success or failure for a script through the
// new verb testicle.suite.success {script, suite, success}, a general test once per script, at the time it knows"; Andy:
// "any suite, including general ones know at the TIME if it was a success") ──
const successOf = function (suite) { return ((W.node && W.node.successes) || []).filter(function (x) { return x && x.suite === suite; }); };
test.run('a suite reports its success or failure for its script once, through testicle.suite.success', 0.4, function () {
  const got = successOf('probe/test/probe.js');
  return (got.length === 1 && got[0].script === 'probe/probe.js' && got[0].success === false) || 'testicle.suite.success for the probe suite: ' + short(got) + '; asked ' + short(W.node.asked.filter(function (a) { return /success/.test(String(a)); }));
}, test.limit.quick);
test.run('the world: a general test judging two scripts runs, handed both', 0.2, async function () {
  W.two = await runSuite(W.tree.run, 'spirit/test/spirit-sibling-zzProbeTwo.js', ['probe/probe.js', 'probe/twice.js']);
  return /Test completed\./.test(W.two.out) || 'it did not run: ' + short(W.two.out.slice(-300));
}, test.limit.slow);
test.run('a general test reports success once per script: the one that held true, the one that failed false', 0.4, function () {
  const got = successOf('spirit/test/spirit-sibling-zzProbeTwo.js');
  const a = got.filter(function (x) { return x.script === 'probe/probe.js'; }), b = got.filter(function (x) { return x.script === 'probe/twice.js'; });
  return (a.length === 1 && a[0].success === true && b.length === 1 && b[0].success === false) || 'its successes: ' + short(got);
}, test.limit.quick);
test.run('at the time it knows: the first script\'s success comes before any result of the second script', 0.4, function () {
  const o = ((W.node && W.node.order) || []).filter(function (x) { return x.args && x.args.suite === 'spirit/test/spirit-sibling-zzProbeTwo.js'; });
  const first = o.findIndex(function (x) { return x.verb === 'success' && x.args.script === 'probe/probe.js'; });
  const second = o.findIndex(function (x) { return x.verb === 'set' && x.args.script === 'probe/twice.js'; });
  return (first !== -1 && second !== -1 && first < second) || 'the order: ' + short(o.map(function (x) { return x.verb + ' ' + x.args.script; }));
}, test.limit.quick);

// ── ONE TEST ALONE ──
test.run('the world: the probe suite runs with one test named', 0.2, async function () {
  const before = W.node.sets.length;
  W.alone = await runSuite(W.tree.run, 'probe/test/probe.js', ['--test', 'it fails with false']);
  W.alone.sets = W.node.sets.slice(before);
  return /Test completed\./.test(W.alone.out) || 'it did not run: ' + short(W.alone.out.slice(-300));
}, test.limit.slow);
test.run('one test named runs the sequence up to it, and no test after it', 0.2, function () {
  const ran = W.alone.sets.map(function (s) { return s.test; });
  return JSON.stringify(ran) === JSON.stringify(['it passes', 'the spirit object stays global after a report', 'it fails with what went wrong', 'it fails with false']) || 'it ran ' + short(ran);
}, test.limit.slow);

// ── A TITLE TWICE, A SEVERITY OUT OF RANGE ──
test.run('the world: a suite saying a title twice runs', 0.2, async function () {
  W.twice = await runSuite(W.tree.run, 'probe/test/twice.js');
  return /Test completed\./.test(W.twice.out) || 'it did not run: ' + short(W.twice.out.slice(-300));
}, test.limit.slow);
test.run('a title said twice in a suite fails the second time', 0.2, function () {
  const lines = W.twice.out.split('\n').filter(function (l) { return l.indexOf(': one title') !== -1; });
  return (lines.length === 2 && /SUCCESS/.test(lines[0]) && /FAILURE/.test(lines[1])) || 'printed: ' + short(lines);
}, test.limit.quick);
test.run('a severity outside 0.0 to 1.0 fails its test', 0.2, function () {
  return W.twice.out.split('\n').some(function (l) { return /FAILURE/.test(l) && l.indexOf(': a severity out of range') !== -1; }) || 'printed: ' + short(W.twice.out.slice(-400));
}, test.limit.quick);

// ── NO NODE ──
test.run('the world: a checkout with no node runs the probe suite', 0.2, async function () {
  W.quietTree = scratchTree(0);
  W.quiet = await runSuite(W.quietTree.run, 'probe/test/probe.js');
  return true;
}, test.limit.slow);
test.run('with no node a suite reports nowhere and still prints its lines', 0.2, function () {
  return (/SUCCESS[^\n]*: it passes/.test(W.quiet.out) && /Test completed\./.test(W.quiet.out)) || 'printed: ' + short(W.quiet.out.slice(-400));
}, test.limit.quick);

test.after(function () {
  try { if (W.node) W.node.close(); } catch (e) { /* closed */ }
  [W.tree, W.quietTree].forEach(function (t) { try { if (t) fs.rmSync(t.root, { recursive: true, force: true }); } catch (e) { /* scratch */ } });
});
