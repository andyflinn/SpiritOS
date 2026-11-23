'use strict';

// spirit/run/spirit/app/testicle/server/test/server.js
// The tests of spirit/app/testicle/testicle.js, testicle's server, and of no other module (spec: ./testicle.md;
// goal/G47.1, the server cycle). The box: "This cycle builds testicle's server, which keeps the first two tables of
// testicle.db, file and suite, in sync with run:// by itself", "The server mounts beside the face (testicle.json:
// node.mount true); testicle.db sits in testicle's state folder", "on any change of a product file it makes sure that
// file has its row, and a suite row for every suite that concerns it", "When a suite or a product file is changed or
// added, the server adjusts the two tables file and suite by itself", "A product file or a suite that has not changed
// has no row in the database yet: nothing is read at start", "A removed file's row is marked deleted", "Any change in
// files is reflected in the database 1 second after it occurs; the tests ensure it", "The server has no verb this
// cycle", "The suites that concern a file: its own test/<name>.js, and the general tests that would include that
// production file if they were run without a file argument". The tables' columns are goal/G45.1's box.
//
// A real node on a scratch copy of the tracked files, planted files of its own under spirit/app/testicle/temp/zzTesticle/, testicle
// turned on there. Every change is made on disc by this test, and testicle.db is read exactly one second later.
// Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync, execFileSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const RUN = path.resolve(__dirname, '../../../../..');
// Every node this test uses is one of lab's (goal/G47.3): its tree by scratchTree, its node by startNodeOn.
const LABH = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { freePort, until, sleep } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }

const APP = path.join(RUN, 'spirit', 'app', 'testicle');
// THE PLANTED FILES, under one folder of their own. alpha has its own test; beta has none; gamma has its own test and
// is touched only through it; epsilon and its test are never touched; notes.md is no script.
const Z = 'spirit/app/testicle/temp/zzTesticle/';
// A planted suite's head: the product reporter, from spirit/app/testicle/temp/zzTesticle/test/.
const SUITE_HEAD = '\'use strict\';\nconst path = require(\'path\');\nconst test = require(path.join(__dirname, \'..\', \'..\', \'..\', \'..\', \'..\', \'test\', \'testReport.js\'));\n';
// A planted suite that logs: 'start' when it begins, after a wait of ms its tests, 'end' when they are all done. Its start
// carries its pid, and `alive`: the suites started before it that logged no end and whose process is still there.
function LOGGED(name, ms, tests) {
  return SUITE_HEAD + "const LOG = path.join(__dirname, '..', '..', '..', '..', '..', '..', '..', '..', 'runlog.txt');\n" +
    "function log(ev, more) { require('fs').appendFileSync(LOG, JSON.stringify(Object.assign({ suite: '" + name + "', ev: ev, at: Date.now(), pid: process.pid }, more || {})) + '\\n'); }\n" +
    "function alive() { let ls = []; try { ls = require('fs').readFileSync(LOG, 'utf8').split('\\n').filter(Boolean).map(function (l) { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean); } catch (e) { return []; }\n" +
    "  const ended = {}; ls.forEach(function (l) { if (l.ev === 'end' && l.pid) ended[l.pid] = true; });\n" +
    "  return ls.filter(function (l) { if (l.ev !== 'start' || !l.pid || l.pid === process.pid || ended[l.pid]) return false; try { process.kill(l.pid, 0); return true; } catch (e) { return false; } }).map(function (l) { return l.suite; }); }\n" +
    "log('start', { alive: alive() });\n" +
    (ms ? "test.run('" + name + " waits a moment before its checks', 0.2, function () { return new Promise(function (r) { setTimeout(function () { r(true); }, " + ms + "); }); }, test.limit.quick);\n" : '') +
    tests.join('\n') + "\ntest.after(function () { log('end'); });\n";
}
const PLANT = {
  'spirit/app/testicle/temp/zzTesticle/alpha.js': '\'use strict\';\n// alpha\n',
  'spirit/app/testicle/temp/zzTesticle/test/alpha.js': '\'use strict\';\n// the test of alpha\n',
  'spirit/app/testicle/temp/zzTesticle/beta.js': '\'use strict\';\n// beta, no test of its own\n',
  'spirit/app/testicle/temp/zzTesticle/gamma.js': '\'use strict\';\n// gamma\n',
  'spirit/app/testicle/temp/zzTesticle/test/gamma.js': '\'use strict\';\n// the test of gamma\n',
  'spirit/app/testicle/temp/zzTesticle/epsilon.js': '\'use strict\';\n// epsilon, never touched\n',
  'spirit/app/testicle/temp/zzTesticle/test/epsilon.js': '\'use strict\';\n// the test of epsilon, never touched\n',
  'spirit/app/testicle/temp/zzTesticle/notes.md': '# no script\n',
  // zeta and its test are never changed: asked by testicle.script.get alone (goal/G47.1, the verbs cycle).
  'spirit/app/testicle/temp/zzTesticle/zeta.js': '\'use strict\';\n// zeta, asked for, never changed\n',
  'spirit/app/testicle/temp/zzTesticle/test/zeta.js': '\'use strict\';\n// the test of zeta\n',
  // theta and its test: no row until a test of it is set (goal/G47.1, the test cycle).
  'spirit/app/testicle/temp/zzTesticle/theta.js': '\'use strict\';\n// theta\n',
  'spirit/app/testicle/temp/zzTesticle/test/theta.js': '\'use strict\';\n// the test of theta\n',
  // kappa, lambda and mu, with suites that really run and report (goal/G47.1, the cycle "run a suite from the script tab"):
  // kappa's own test waits three seconds before its tests, lambda's has three tests in a row, mu's general test judges mu.
  'spirit/app/testicle/temp/zzTesticle/kappa.js': '\'use strict\';\n// kappa\n',
  'spirit/app/testicle/temp/zzTesticle/test/kappa.js': SUITE_HEAD + [
    "test.run('kappa waits a moment before its checks', 0.2, function () { return new Promise(function (r) { setTimeout(function () { r(true); }, 3000); }); }, test.limit.quick);",
    "test.run('kappa answers its first', 0.2, function () { return true; }, test.limit.quick);",
    "test.run('kappa fails its second', 0.2, function () { return false; }, test.limit.quick);",
    "test.run('kappa was started with no argument', 0.2, function () { return process.argv.length === 2 || false; }, test.limit.quick);",
  ].join('\n') + '\n',
  'spirit/app/testicle/temp/zzTesticle/lambda.js': '\'use strict\';\n// lambda\n',
  'spirit/app/testicle/temp/zzTesticle/test/lambda.js': SUITE_HEAD + [
    "test.run('lambda answers its first', 0.2, function () { return true; }, test.limit.quick);",
    "test.run('lambda answers its second', 0.2, function () { return true; }, test.limit.quick);",
    "test.run('lambda answers its third', 0.2, function () { return true; }, test.limit.quick);",
  ].join('\n') + '\n',
  // goal/G47.1, the queue cycle: suites that log their start and end to runlog.txt in the scratch root, outside the tree the
  // server watches, so the order, the overlap and the timing of the runs the server starts can be read back.
  // early's own suite sorts before every general suite by name (spirit/app/testicle/temp/aaTesticle/ before spirit/test/), so only the runner's
  // general-first order puts its general suites ahead of it.
  'spirit/app/testicle/temp/aaTesticle/early.js': '\'use strict\';\n// early\n',
  'spirit/app/testicle/temp/aaTesticle/test/early.js': LOGGED('early', 0, ["test.run('early answers', 0.2, function () { return true; }, test.limit.quick);"]),
  'spirit/app/testicle/temp/zzTesticle/nu.js': '\'use strict\';\n// nu\n',
  'spirit/app/testicle/temp/zzTesticle/test/nu.js': LOGGED('nu', 3000, ["test.run('nu answers', 0.2, function () { return true; }, test.limit.quick);"]),
  'spirit/app/testicle/temp/zzTesticle/xi.js': '\'use strict\';\n// xi\n',
  'spirit/app/testicle/temp/zzTesticle/test/xi.js': LOGGED('xi', 3000, ["test.run('xi answers', 0.2, function () { return true; }, test.limit.quick);"]),
  'spirit/app/testicle/temp/zzTesticle/pi.js': '\'use strict\';\n// pi\n',
  'spirit/app/testicle/temp/zzTesticle/test/pi.js': LOGGED('pi', 3000, ["test.run('pi answers', 0.2, function () { return true; }, test.limit.quick);"]),
  // goal/G48.4, the run times (Andy: "do we time a test or a suite record the runtime?", "go! test and build."): a slow green
  // suite, a quick green one and a red one; zzFresh comes later, never timed. zzAslow sorts before zzFresh and zzQuick by name,
  // so only the order by time puts them ahead of it.
  'spirit/app/testicle/temp/zzTesticle/zzAslow.js': '\'use strict\';\n// zzAslow\n',
  'spirit/app/testicle/temp/zzTesticle/test/zzAslow.js': LOGGED('zzAslow', 3000, ["test.run('zzAslow answers', 0.2, function () { return true; }, test.limit.quick);"]),
  'spirit/app/testicle/temp/zzTesticle/zzQuick.js': '\'use strict\';\n// zzQuick\n',
  'spirit/app/testicle/temp/zzTesticle/test/zzQuick.js': LOGGED('zzQuick', 0, ["test.run('zzQuick answers', 0.2, function () { return true; }, test.limit.quick);"]),
  'spirit/app/testicle/temp/zzTesticle/zzRedSuite.js': '\'use strict\';\n// zzRedSuite\n',
  'spirit/app/testicle/temp/zzTesticle/test/zzRedSuite.js': LOGGED('zzRedSuite', 3000, ["test.run('zzRedSuite fails', 0.2, function () { return false; }, test.limit.quick);"]),
  'spirit/app/testicle/temp/zzTesticle/omicron.js': '\'use strict\';\n// omicron\n',
  'spirit/app/testicle/temp/zzTesticle/test/omicron.js': LOGGED('omicron', 0, ["test.run('omicron answers', 0.2, function () { return true; }, test.limit.quick);"]),
  'spirit/app/testicle/temp/zzTesticle/tau.js': '\'use strict\';\n// tau\n',
  'spirit/app/testicle/temp/zzTesticle/test/tau.js': LOGGED('tau', 0, ["test.run('tau answers', 0.2, function () { return true; }, test.limit.quick);"]),
  'spirit/app/testicle/temp/zzTesticle/upsilon.js': '\'use strict\';\n// upsilon\n',
  'spirit/app/testicle/temp/zzTesticle/test/upsilon.js': LOGGED('upsilon', 0, ["test.run('upsilon answers', 0.2, function () { return true; }, test.limit.quick);"]),
  // rho answers its first test, then hangs; sigma's first test hangs, its process kept alive. Each hang has the quick
  // limit, so the reporter fails it there (Andy: "a single test still has the same limit!").
  'spirit/app/testicle/temp/zzTesticle/rho.js': '\'use strict\';\n// rho\n',
  'spirit/app/testicle/temp/zzTesticle/test/rho.js': LOGGED('rho', 0, ["test.run('rho answers its first', 0.2, function () { return true; }, test.limit.quick);", "test.run('rho hangs', 0.2, function () { return new Promise(function () { setInterval(function () {}, 1000); }); }, test.limit.quick);"]),
  'spirit/app/testicle/temp/zzTesticle/sigma.js': '\'use strict\';\n// sigma\n',
  'spirit/app/testicle/temp/zzTesticle/test/sigma.js': SUITE_HEAD + "setInterval(function () {}, 1000);\ntest.run('sigma hangs', 0.2, function () { return new Promise(function () {}); }, test.limit.quick);\n",
  'spirit/app/testicle/temp/zzTesticle/phi.js': '\'use strict\';\n// phi, its suite never run\n',
  'spirit/app/testicle/temp/zzTesticle/test/phi.js': '\'use strict\';\n// the test of phi\n',
  // litter's own suite leaves a folder in the run folder and reports green (goal/G47.1, the box, no pollution: "The run folder
  // holds spirit and nothing else. Guard: after each suite, testicle finds nothing new in the run folder; red on the suite
  // that made it").
  'spirit/app/testicle/temp/zzTesticle/litter.js': '\'use strict\';\n// litter\n',
  'spirit/app/testicle/temp/zzTesticle/test/litter.js': SUITE_HEAD + [
    "require('fs').mkdirSync(path.join(__dirname, '..', '..', '..', '..', '..', '..', 'zzLitter'), { recursive: true });",
    "test.run('litter answers', 0.2, function () { return true; }, test.limit.quick);",
  ].join('\n') + '\n',
  // stray's own suite takes a temp folder from the helper and leaves it there (goal/G47.1, the box, no pollution: "A temp
  // folder is cleaned by its owner: ... a test's in its own after. Guard: after each suite, testicle finds its temp folder
  // gone; red if not").
  'spirit/app/testicle/temp/zzTesticle/stray.js': '\'use strict\';\n// stray\n',
  'spirit/app/testicle/temp/zzTesticle/test/stray.js': SUITE_HEAD + [
    "require(path.join(__dirname, '..', '..', '..', '..', '..', 'tempFolder.js'))('spirit/app/testicle/temp/zzTesticle/test/stray/kept');",
    "test.run('stray answers', 0.2, function () { return true; }, test.limit.quick);",
  ].join('\n') + '\n',
  'spirit/app/testicle/temp/zzTesticle/mu.js': '\'use strict\';\n// mu\n',
  'spirit/app/testicle/temp/zzTesticle/test/mu-child-zzRule.js': SUITE_HEAD + [
    "test.run('mu holds its rule', 0.2, function () { return process.argv[2] === 'spirit/app/testicle/temp/zzTesticle/mu.js' || false; }, test.limit.quick);",
  ].join('\n') + '\n',
};
// The general test changed in the scratch copy: its entries name every file of its reach.
// In debug mode (box v143) the general tests testicle sees are its own three, beside testicle.js.
const GENERAL = 'spirit/app/testicle/test/testicle-sibling-general.js';

function scratch() {
  const root = LABH.scratchTree().root;
  const run = path.join(root, 'spirit', 'run');
  Object.keys(PLANT).forEach(function (f) { fs.mkdirSync(path.dirname(path.join(run, f)), { recursive: true }); fs.writeFileSync(path.join(run, f), PLANT[f]); });
  // testicle turned on there, as an owner turns a server on (spirit/test/headLessChrome.js scratchNode).
  const on = path.join(run, 'spirit', 'state', 'testicle');
  fs.mkdirSync(on, { recursive: true });
  fs.writeFileSync(path.join(on, 'node.json'), JSON.stringify({ active: true }));
  fs.mkdirSync(path.join(on, 'data'), { recursive: true });
  // DEBUG MODE, written before the node starts (goal/G47.1, box v143: "testicle has a debug mode, set only by
  // ./test/testicle.js (a preference it writes on its scratch node, no verb)"): its preferences.json holds debug and nothing
  // else, so the default, interactive, is still judged first; then auto is set by the verb for the runner's checks (goal/G47.1,
  // box v79, 2 and 4), and interactive again at the end, on chi and psi.
  fs.writeFileSync(path.join(on, 'data', 'preferences.json'), JSON.stringify({ debug: true }));
  return { root: root, run: run };
}
async function call(base, verb, args) {
  try {
    const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
    const text = await r.text();
    return { status: r.status, text: text, body: parsed(text) };
  } catch (e) { return { status: 0, text: '', body: null }; }
}
async function boot(run) {
  const port = await freePort();
  // The node's error output kept beside the scratch tree, node.err, so a failure inside the server is there to read.
  const err = fs.openSync(path.join(run, '..', '..', 'node.err'), 'a');
  const child = LABH.startNodeOn(run, port, { stdio: ['ignore', 'ignore', err] });
  const base = 'http://127.0.0.1:' + port;
  // UP MEANS TESTICLE ANSWERS, not only the node (goal/G47.1, Andy's flipping 0.8s on the run-limit world: the node answered,
  // testicle was not mounted yet on a busy machine, the world's one ask for auto mode was refused, and aOk.js never ran).
  // Asked without arguments, testicle.preferences only reads.
  const up = await until(function () { return call(base, 'api').then(function (r) { return r.status === 200; }); }, 60000) &&
    await until(function () { return call(base, 'testicle.preferences', {}).then(function (r) { return r.status === 200; }); }, 60000);
  return { child: child, base: base, up: !!up };
}
function stop(c) { return new Promise(function (r) { if (!c || c.exitCode !== null || c.signalCode !== null) return r(); c.once('exit', function () { r(); }); c.kill(); setTimeout(r, 6000); }); }

// THE TABLES, read as they stand, the database opened read only each time.
function tables(dbFile) {
  for (let i = 0; i < 20; i++) { const t = tablesOnce(dbFile); if (!t.error) return t; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250); }
  return tablesOnce(dbFile);
}
function tablesOnce(dbFile) {
  let db = null;
  try {
    db = new DatabaseSync(dbFile, { readOnly: true });
    // The runner writes while the tests read (goal/G47.1, the queue cycle): a read waits for its write, never fails on it.
    db.exec('PRAGMA busy_timeout = 5000');
    const file = db.prepare('SELECT * FROM script').all();
    const suite = db.prepare('SELECT * FROM suite').all();
    let tests = [];
    try { tests = db.prepare('SELECT * FROM testicle').all(); } catch (e) { tests = null; }
    return { script: file, suite: suite, test: tests };
  } catch (e) { return { error: true, script: [], suite: [], test: null }; }
  finally { try { if (db) db.close(); } catch (e) { /* closed */ } }
}
function scriptRow(t, name) { return t.script.filter(function (r) { return r.name === name; })[0] || null; }
function suiteRows(t, name) { return t.suite.filter(function (r) { return r.script === name; }); }
function suiteRow(t, name, suite) { return t.suite.filter(function (r) { return r.script === name && r.suite === suite; })[0] || null; }
function yes(v) { return v === 1 || v === true || v === '1' || v === 'true'; }
function no(v) { return v === 0 || v === false || v === '0' || v === 'false'; }
function empty(v) { return v === null || v === undefined || v === ''; }

// THE SUITES THAT CONCERN A FILE, by the box: its own test/<name>.js, and the general tests whose run with no file
// argument includes it, as the scratch tree's own testModule.js lists them, run as its own process.
function concerning(run, name) {
  const lines = execFileSync(process.execPath, [path.join(run, 'spirit', 'test', 'testModule.js')], { cwd: run, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean);
  const own = path.posix.join(path.posix.dirname(name), 'test', path.posix.basename(name));
  const out = [];
  if (fs.existsSync(path.join(run, own))) out.push(own);
  // IN DEBUG MODE (box v143: "testicle operates as if run://spirit/app/testicle/ were ALL the testables of the whole node",
  // "in debug mode these are the only general tests testicle sees"): only suites under spirit/app/testicle/ concern a file.
  lines.forEach(function (l) { const p = l.split(' '); if (p[1] === name && out.indexOf(p[0]) === -1 && /^spirit\/app\/testicle\//.test(p[0])) out.push(p[0]); });
  // Every product script has a suite row of the classifier too (box v94, 1: "a \"special\" general test under its own name,
  // with its suite row").
  if (out.indexOf('spirit/test/scriptClassify.js') === -1) out.push('spirit/test/scriptClassify.js');
  return out.sort();
}
// The classifier's suite row is no test run: it is judged by classifying, never flagged "needs running".
const notClassifier = function (r) { return r.suite !== 'spirit/test/scriptClassify.js'; };
function judgedBy(run, suite) {
  return execFileSync(process.execPath, [path.join(run, 'spirit', 'test', 'testModule.js')], { cwd: run, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .map(function (l) { return l.split(' '); }).filter(function (p) { return p[0] === suite && p[1]; }).map(function (p) { return p[1]; });
}
function names(rows) { return rows.map(function (r) { return r.suite; }).sort(); }

// What the tests share, made by the tests in order: the scratch tree, its node, and what each step read.
let own = null, s = null, N = null, DB = '';
const live = [];
const up = function () { return !!(N && N.up); };
const put = function (rel, text) { fs.mkdirSync(path.dirname(path.join(s.run, rel)), { recursive: true }); fs.writeFileSync(path.join(s.run, rel), text); };
const append = function (rel, text) { fs.appendFileSync(path.join(s.run, rel), text); };
// IDLE: busy false twice, two seconds apart, so a gap between two of the runner's jobs is not taken for idle.
async function idle(ms) {
  const no = function () { return call(N.base, 'testicle.busy', {}).then(function (r) { return r.status === 200 && (r.body === false || (r.body && r.body.busy === false)); }); };
  return until(function () { return no().then(function (a) { return a ? sleep(2000).then(no) : false; }); }, ms);
}
// EXACTLY ONE SECOND after a change (the box), then the tables as they stand.
const after = async function () { await sleep(1000); return tables(DB); };
const failed = function (r, words) { return !!r.body && r.body.ok === false && new RegExp(words).test(String(r.body.error || '')); };
const items = function (r) { return ((r.body && r.body.items) || []).map(function (i) { return { key: i.key, row: parsed(i.label) || {} }; }); };
const suiteOf = function (i) { return String(i.row.suite || i.key || ''); };
const TH = Z + 'theta.js';
const THS = Z + 'test/theta.js';
const testRows = function (t, script, suite, name) { return (t.test || []).filter(function (r) { return r.script === script && r.suite === suite && r.test === name; }); };
const currentOf = function (t, script, suite, name) { return testRows(t, script, suite, name).filter(function (r) { return yes(r.current); }); };
const found = function (r) { return ((r.body && r.body.items) || []).map(function (i) { return parsed(i.label) || {}; }); };
let start = null, t0 = 0, a1 = null, alpha = null, wantAlpha = [], ownRow = null, t1 = 0, a2 = null, alpha2 = null, t2 = 0, a3 = null, ownRow3 = null;
let g1 = null, d1 = null, wantDelta = [], b1 = null, tz = 0, zeta = null, zt = null, zrow = null, wantZeta = [], got = [], all = null;
let ts0 = 0, set1 = null, k1 = null, wantTheta = [], tr1 = null, ts1 = 0, k2 = null, tr2 = null, k3 = null, tr3 = null, ts2 = 0, k4 = null, all4 = [], cur4 = [];
let sr = null, srRows = [], red = [], n1 = null, reach = [], seen = [], r1 = null, x1 = null;

// THE PLANTED SUITES' LOG GOES WHEN THE TEST STARTS AND WHEN IT ENDS (goal/G48.4; Andy: "you better delete that fucking log
// when the test starts AND especially when it ends.... NO POLLUTION! NO LITTERING!!!!"): a lab copy is released, not removed.
const dropRunlog = function () { try { if (s) fs.rmSync(path.join(s.root, 'runlog.txt'), { force: true }); } catch (e) { /* gone */ } };
test.after(async function () {
  for (const k of live) await stop(k);
  dropRunlog();
  try { if (s) LABH.freeTree(s); } catch (e) { /* scratch */ }
});

// the box: "The server mounts beside the face (testicle.json: node.mount true)"
test.run('testicle\'s manifest mounts a server, with node.mount true', 0.2, function () {
  own = readJson(path.join(APP, 'testicle.json'));
  return (!!own && !!own.node && own.node.mount === true) || false;
}, test.limit.quick);
test.run('testicle\'s mount names testicle.js beside element.js', 0.2, function () {
  return (!!own && !!own.mount && own.mount['testicle.js'] === true && own.mount['element.js'] === true) || false;
}, test.limit.quick);
test.run('spirit/app/testicle/testicle.js is there', 0.2, function () {
  return fs.existsSync(path.join(APP, 'testicle.js')) || false;
}, test.limit.quick);

test.run('a scratch node comes up', 0.2, async function () {
  s = scratch();
  dropRunlog();
  DB = path.join(s.run, 'spirit', 'state', 'testicle', 'data', 'testicle.db');
  N = await boot(s.run); live.push(N.child);
  return N.up || false;
}, test.limit.long);

// ── DEBUG MODE (goal/G47.1, box v143): "in it testicle operates as if run://spirit/app/testicle/ were ALL the testables of the
// whole node", "its general tests there: spirit/app/testicle/test/testicle-sibling-general.js, testicle-sibling-node.js and
// testicle-sibling-browser.js, each with a dumb test or two; in debug mode these are the only general tests testicle sees",
// "the classifier (spirit/test/scriptClassify.js) is still used, but in debug mode only called with scripts in
// spirit/app/testicle/", "the planted scripts go to a .gitignored run://spirit/app/testicle/temp/". Andy: "that sounds to
// my like an almost 10x speedup....".
const DEBUG_GENERALS = ['general', 'node', 'browser'].map(function (k) { return 'spirit/app/testicle/test/testicle-sibling-' + k + '.js'; });
test.run('testicle\'s three general tests are there, testicle-sibling-general.js, -node.js and -browser.js, each with a test', 0.4, function () {
  const bad = DEBUG_GENERALS.filter(function (g) { let c = ''; try { c = fs.readFileSync(path.join(RUN, g), 'utf8'); } catch (e) { return true; } return !/test\.run\(/.test(c); });
  return !bad.length || false;
}, test.limit.quick);
test.run('.gitignore keeps spirit/app/testicle/temp/ out of git, and git holds nothing under it', 0.4, function () {
  let ignored = false;
  try { execFileSync('git', ['check-ignore', '-q', 'spirit/run/spirit/app/testicle/temp/zzProbe/x.js'], { cwd: REPO }); ignored = true; } catch (e) { ignored = false; }
  const held = execFileSync('git', ['ls-files', '--', 'spirit/run/spirit/app/testicle/temp'], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
  return (ignored && !held.length) || false;
}, test.limit.quick);
test.run('no zz folder is in the tree: git holds no spirit/zz... and no spirit/aa... folder', 0.4, function () {
  const held = execFileSync('git', ['ls-files', '--', 'spirit/run/spirit'], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(function (f) { return /^spirit\/run\/spirit\/(zz|aa)[A-Za-z]*\//.test(f); });
  return !held.length || false;
}, test.limit.quick);
test.run('in debug mode, once the start is worked off, testicle\'s scripts are only those under spirit/app/testicle/', 0.4, async function () {
  if (!up()) return false;
  await idle(280000);
  const out = tables(DB).script.filter(function (r) { return no(r.deleted) && !/^spirit\/app\/testicle\//.test(r.name); });
  return !out.length || false;
}, test.limit.long);
test.run('in debug mode, testicle runs only its own three sibling general suites and those of its planted worlds', 0.4, function () {
  if (!up()) return false;
  const gens = Array.from(new Set(tables(DB).suite.filter(function (r) { return no(r.deleted) && /-(child|sibling)-(general|node|browser)\.js$/.test(r.suite); }).map(function (r) { return r.suite; })));
  const out = gens.filter(function (g) { return DEBUG_GENERALS.indexOf(g) === -1 && !/^spirit\/app\/testicle\/temp\//.test(g); });
  return (gens.length > 0 && !out.length) || false;
}, test.limit.quick);
test.run('in debug mode, the classifier judged only scripts under spirit/app/testicle/', 0.4, function () {
  if (!up()) return false;
  const rows = (tables(DB).test || []).filter(function (r) { return r.suite === 'spirit/test/scriptClassify.js' && yes(r.current); });
  const out = rows.filter(function (r) { return !/^spirit\/app\/testicle\//.test(r.script); });
  return (rows.length > 0 && !out.length) || false;
}, test.limit.quick);

// the box: "testicle.db sits in testicle's state folder"
test.run('testicle.db is made in its state folder, spirit/state/testicle/data/, with its tables script and suite', 0.2, async function () {
  if (!up()) return false;
  return !!(await until(function () { return Promise.resolve(fs.existsSync(DB) && !tables(DB).error); }, 30000)) || false;
}, test.limit.long);

// goal/G47.1, the box: "The testicle server will serve one first verb, \"busy\": it returns true if it is doing any
// work, false if it is idle."
test.run('the node lists the verb testicle.busy', 0.2, async function () {
  if (!up()) return false;
  const api = await call(N.base, 'api', { branch: 'testicle' });
  // api {branch} answers { branch, interface }, the interface the text of its api.js.
  const iface = String((api.body && api.body.interface) || '');
  return (api.status === 200 && /\bverbs\s*:/.test(iface) && /['"]?busy['"]?\s*:/.test(iface)) || false;
}, test.limit.quick);
test.run('with nothing changing, busy answers false', 0.2, async function () {
  if (!up()) return false;
  // Nothing changes once the start is worked off; idle is busy false twice, two seconds apart (idle(), above).
  const quiet = await idle(50000);
  const r = await call(N.base, 'testicle.busy', {});
  return (!!quiet && r.status === 200 && (r.body === false || (r.body && r.body.busy === false))) || false;
}, test.limit.slow);

// The start's tables, read once testicle.db holds the table script (goal/G47.1, the rename: "the table script").
test.run('testicle.db holds the table script', 0.2, function () {
  if (!up()) return false;
  start = tables(DB);
  return !start.error || false;
}, test.limit.quick);

// goal/G47.1, the rename cycle, the box: "The testicle test table is renamed \"testicle\": the table in testicle.db, its
// index, and the branch data.js keeps it under".
const sqlNames = function (type) {
  try { const d = new DatabaseSync(DB, { readOnly: true }); const r = d.prepare('SELECT name, tbl_name FROM sqlite_master WHERE type = ?').all(type); d.close(); return r; } catch (e) { return []; }
};
test.run('testicle.db holds the table testicle', 0.2, function () {
  if (!up()) return false;
  const t = sqlNames('table').map(function (r) { return r.name; });
  return t.indexOf('testicle') !== -1 || false;
}, test.limit.quick);
test.run('the index over the current rows is on the table testicle', 0.2, function () {
  if (!up()) return false;
  const ix = sqlNames('index').filter(function (r) { return !/^sqlite_autoindex/.test(r.name); });
  return ix.some(function (r) { return r.tbl_name === 'testicle'; }) || false;
}, test.limit.quick);
test.run('the node lists the verbs testicle.set and testicle.search', 0.2, async function () {
  if (!up()) return false;
  const api = await call(N.base, 'api', { branch: 'testicle' });
  const iface = String((api.body && api.body.interface) || '');
  return (/['"]testicle\.set['"]\s*:/.test(iface) && /['"]testicle\.search['"]\s*:/.test(iface)) || false;
}, test.limit.quick);

// goal/G47.1, box v95, 5: "the server on start, before even classifying, must make sure that script, suite and testicle
// tables reflect the current state" (it replaces "nothing is read at start"). Read once the start has done its work.
const VENDORED = require(path.join(RUN, 'spirit', 'fs', 'fileSystem.js')).VENDORED_FOLDERS;
test.run('at start every product script on disc has its row in script', 0.2, async function () {
  if (!start) return false;
  // The scratch tree holds no git of its own: its files are the repo's list, as scratch() copied them, plus the planted.
  const want = execSync('git ls-files -- spirit/run/spirit', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').map(function (f) { return f.replace(/^spirit\/run\//, ''); })
    // In debug mode (box v143) "as if run://spirit/app/testicle/ were ALL the testables of the whole node": only those.
    .filter(function (f) { return /^spirit\/app\/testicle\//.test(f) && /\.js$/.test(f) && !/(^|\/)test\//.test(f) && !VENDORED.holds(f) && fs.existsSync(path.join(s.run, f)); }).concat(Object.keys(PLANT).filter(function (f) { return !/(^|\/)test\//.test(f) && /\.js$/.test(f); }));
  let missing = [];
  await until(function () { const t = tables(DB); missing = want.filter(function (f) { const r = scriptRow(t, f); return !r || !no(r.deleted); }); return Promise.resolve(missing.length === 0); }, 120000);
  return missing.length === 0 || false;
}, test.limit.long);
test.run('at start a planted script\'s own suite has its suite row', 0.2, function () {
  if (!start) return false;
  const r = suiteRow(tables(DB), Z + 'zeta.js', Z + 'test/zeta.js');
  return (!!r && no(r.deleted)) || false;
}, test.limit.quick);

// ── goal/G47.1, box v79, 3: three fields on the script table ──
// "reClassify, boolean: \"this script needs re-classification.\"", "browserOnly, boolean", "nodeOnly, boolean".
const scriptColumns = function () {
  try { const d = new DatabaseSync(DB, { readOnly: true }); const c = d.prepare('PRAGMA table_info(script)').all().map(function (r) { return r.name; }); d.close(); return c; } catch (e) { return []; }
};
test.run('the script table has the columns reClassify, browserOnly and nodeOnly', 0.2, function () {
  if (!up()) return false;
  const c = scriptColumns();
  return ['reClassify', 'browserOnly', 'nodeOnly'].every(function (n) { return c.indexOf(n) !== -1; }) || false;
}, test.limit.quick);

// ── goal/G47.1, box v79, 4: the verb preferences ──
// "preferences {} answers them all; preferences {interactive: false} sets that one and answers them all. An unknown name
// or a wrong type is refused." "For now it supports testicle.preferences.interactive (true by default)."
const classifyRowAt = function (t, name) { return (t.test || []).filter(function (r) { return r.script === name && r.suite === 'spirit/test/scriptClassify.js' && r.test === 'it loads, so it can be classified' && yes(r.current); })[0] || null; };
const PREFS = function () { return path.join(s.run, 'spirit', 'state', 'testicle', 'data', 'preferences.json'); };
const prefsOf = function (r) { const b = r && r.body; return (b && typeof b.preferences === 'object' && b.preferences) || b || {}; };
let p0 = null;
test.run('the node lists the verb testicle.preferences', 0.2, async function () {
  if (!up()) return false;
  const api = await call(N.base, 'api', { branch: 'testicle' });
  const iface = String((api.body && api.body.interface) || '');
  return /['"]?preferences['"]?\s*:/.test(iface) || false;
}, test.limit.quick);
test.run('preferences asked with nothing answers them all: interactive, true by default', 0.2, async function () {
  if (!up()) return false;
  p0 = await call(N.base, 'testicle.preferences', {});
  return (p0.status === 200 && prefsOf(p0).interactive === true) || false;
}, test.limit.quick);
test.run('a preference testicle does not know is refused, and sets nothing', 0.2, async function () {
  if (!up()) return false;
  const r = await call(N.base, 'testicle.preferences', { zzNoSuchPreference: true });
  const after1 = await call(N.base, 'testicle.preferences', {});
  return ((r.status !== 200 || (r.body && r.body.ok === false)) && prefsOf(after1).zzNoSuchPreference === undefined && prefsOf(after1).interactive === true) || false;
}, test.limit.quick);
test.run('interactive given a wrong type is refused, and sets nothing', 0.2, async function () {
  if (!up()) return false;
  const r = await call(N.base, 'testicle.preferences', { interactive: 'no' });
  const after1 = await call(N.base, 'testicle.preferences', {});
  return ((r.status !== 200 || (r.body && r.body.ok === false)) && prefsOf(after1).interactive === true) || false;
}, test.limit.quick);

// A START, INTERACTIVE, NOTHING PRESSED (Andy: "wsl, make double sure you catch this with a test."): the start classifies
// every script by itself.
test.run('at a start, interactive and nothing pressed, every live script is classified', 0.2, async function () {
  if (!start) return false;
  let left = [];
  const ok = await until(function () { const t = tables(DB); left = t.script.filter(function (r) { return no(r.deleted) && !no(r.reClassify); }); return Promise.resolve(t.script.filter(function (r) { return no(r.deleted); }).length > 0 && left.length === 0); }, 280000);
  // In debug mode (box v143) the live scripts are those under spirit/app/testicle/, a few dozen, never the whole tree's hundreds.
  return !!ok || false;
}, test.limit.long);

// The checks that follow judge the server as it ran until now, auto (goal/G47.1, box v79, 2: "auto: the default mode until
// now"); interactive is judged at the end of this file, on chi and psi.
test.run('auto is set for the checks that follow, by preferences with interactive false', 0.2, async function () {
  if (!up()) return false;
  const r = await call(N.base, 'testicle.preferences', { interactive: false });
  return (r.status === 200 && prefsOf(r).interactive === false) || false;
}, test.limit.quick);


// the box: "on any change of a product file it makes sure that file has its row"
test.run('one second after a product file changes, the file has its row in script', 0.2, async function () {
  if (!up()) return false;
  t0 = Date.now();
  append(Z + 'alpha.js', '// changed once\n');
  a1 = await after();
  alpha = scriptRow(a1, Z + 'alpha.js');
  return !!alpha || false;
}, test.limit.slow);
test.run('the row holds the file\'s hash', 0.2, function () {
  return (!!alpha && typeof alpha.hash === 'string' && alpha.hash !== '') || false;
}, test.limit.quick);
test.run('the row is not marked deleted', 0.2, function () {
  return (!!alpha && no(alpha.deleted)) || false;
}, test.limit.quick);
test.run('the row\'s changed is a numeric UTC timestamp of that change', 0.2, function () {
  return (!!alpha && Number(alpha.changed) >= t0 - 1000 && Number(alpha.changed) <= Date.now()) || false;
}, test.limit.quick);

// the box: "and a suite row for every suite that concerns it"
test.run('alpha.js is concerned by its own test and by general tests', 0.2, function () {
  if (!up()) return false;
  wantAlpha = concerning(s.run, Z + 'alpha.js');
  return (wantAlpha.indexOf(Z + 'test/alpha.js') !== -1 && wantAlpha.length > 1) || false;
}, test.limit.quick);
test.run('alpha.js\'s suite rows are exactly its own test and the general tests that name it', 0.2, function () {
  if (!a1) return false;
  return JSON.stringify(names(suiteRows(a1, Z + 'alpha.js'))) === JSON.stringify(wantAlpha) || false;
}, test.limit.quick);
test.run('every one of alpha.js\'s suite rows is flagged test', 0.2, function () {
  if (!a1) return false;
  ownRow = suiteRow(a1, Z + 'alpha.js', Z + 'test/alpha.js');
  const unflagged = suiteRows(a1, Z + 'alpha.js').filter(notClassifier).filter(function (r) { return !yes(r.test); });
  return (suiteRows(a1, Z + 'alpha.js').length > 0 && !unflagged.length) || false;
}, test.limit.quick);
test.run('a suite row holds the suite file\'s own hash', 0.2, function () {
  return (!!ownRow && typeof ownRow.hash === 'string' && ownRow.hash !== '' && ownRow.hash !== alpha.hash) || false;
}, test.limit.quick);
test.run('a suite row is not marked deleted', 0.2, function () {
  return (!!ownRow && no(ownRow.deleted)) || false;
}, test.limit.quick);
test.run('a suite row\'s outcome is empty: nothing runs a suite this cycle', 0.2, function () {
  return (!!ownRow && empty(ownRow.outcome)) || false;
}, test.limit.quick);
test.run('a suite row\'s changed is a numeric UTC timestamp', 0.2, function () {
  return (!!ownRow && Number(ownRow.changed) >= t0 - 1000 && Number(ownRow.changed) <= Date.now()) || false;
}, test.limit.quick);

// the box: "When a suite or a product file is changed ... the server adjusts the two tables"
test.run('a product file changed again gets its new hash', 0.2, async function () {
  if (!up()) return false;
  t1 = Date.now();
  append(Z + 'alpha.js', '// changed twice\n');
  a2 = await after();
  alpha2 = scriptRow(a2, Z + 'alpha.js');
  return (!!alpha2 && !!alpha && alpha2.hash !== alpha.hash) || false;
}, test.limit.slow);
test.run('the changed product file\'s changed time moves to that change', 0.2, function () {
  return (!!alpha2 && Number(alpha2.changed) >= t1) || false;
}, test.limit.quick);
test.run('a file keeps one row', 0.2, function () {
  if (!a2) return false;
  return a2.script.filter(function (r) { return r.name === Z + 'alpha.js'; }).length === 1 || false;
}, test.limit.quick);
test.run('a suite changed gets its new hash on its rows', 0.2, async function () {
  if (!up()) return false;
  t2 = Date.now();
  append(Z + 'test/alpha.js', '// the suite changed\n');
  a3 = await after();
  ownRow3 = suiteRow(a3, Z + 'alpha.js', Z + 'test/alpha.js');
  return (!!ownRow3 && !!ownRow && ownRow3.hash !== ownRow.hash) || false;
}, test.limit.slow);
test.run('the changed suite\'s rows are flagged test, changed at that change', 0.2, function () {
  return (!!ownRow3 && yes(ownRow3.test) && Number(ownRow3.changed) >= t2) || false;
}, test.limit.quick);

// the box: "When a suite ... is changed or added": a suite of a file with no row yet
test.run('a changed suite makes its row for the file it concerns', 0.2, async function () {
  if (!up()) return false;
  append(Z + 'test/gamma.js', '// the suite of gamma changed\n');
  g1 = await after();
  return !!suiteRow(g1, Z + 'gamma.js', Z + 'test/gamma.js') || false;
}, test.limit.slow);
test.run('the file a changed suite concerns has its row in script', 0.2, function () {
  if (!g1) return false;
  return !!scriptRow(g1, Z + 'gamma.js') || false;
}, test.limit.quick);

// the box: "changed or added": a new product file
test.run('a product file added has its row one second later', 0.2, async function () {
  if (!up()) return false;
  put(Z + 'delta.js', '\'use strict\';\n// delta, new\n');
  d1 = await after();
  return !!scriptRow(d1, Z + 'delta.js') || false;
}, test.limit.slow);
test.run('a product file added has a suite row for every general test that names it', 0.2, function () {
  if (!d1) return false;
  wantDelta = concerning(s.run, Z + 'delta.js');
  return (wantDelta.length > 0 && JSON.stringify(names(suiteRows(d1, Z + 'delta.js'))) === JSON.stringify(wantDelta)) || false;
}, test.limit.quick);

// the box: "changed or added": a new suite
test.run('a suite added makes its row, and its file\'s row', 0.2, async function () {
  if (!up()) return false;
  put(Z + 'test/beta.js', '\'use strict\';\n// the new test of beta\n');
  b1 = await after();
  return (!!suiteRow(b1, Z + 'beta.js', Z + 'test/beta.js') && !!scriptRow(b1, Z + 'beta.js')) || false;
}, test.limit.slow);

// goal/G47.1, the verbs cycle: testicle.script.get. The box: "If the argument (a filename, scoped to run://) is not a
// production script, it returns the error \"not a production script\"", "If the file does not exist, it returns the
// error \"no such file\"", "If the file does not have its file and suite rows, they are created automatically", "It
// creates them with the same code the server uses when it discovers a file change and no record exists: the suites are
// flagged \"needs testing\"", "The server then returns the file row." Its argument is the file row's key, name.
test.run('script.get of a file that is no script answers the error "not a production script"', 0.2, async function () {
  if (!up()) return false;
  const md = await call(N.base, 'testicle.script.get', { name: Z + 'notes.md' });
  return failed(md, 'not a production script') || false;
}, test.limit.quick);
test.run('script.get of a script in a test folder answers the error "not a production script"', 0.2, async function () {
  if (!up()) return false;
  const asTest = await call(N.base, 'testicle.script.get', { name: Z + 'test/zeta.js' });
  return failed(asTest, 'not a production script') || false;
}, test.limit.quick);
test.run('script.get of a production script that is not there answers the error "no such file"', 0.2, async function () {
  if (!up()) return false;
  const nowhere = await call(N.base, 'testicle.script.get', { name: Z + 'nowhere.js' });
  return failed(nowhere, 'no such file') || false;
}, test.limit.quick);
// Since box v95, 5 every script on disc has its row from the start, zeta.js among them: script.get answers it.
test.run('script.get of a production script never changed answers with its file row there', 0.2, async function () {
  if (!up()) return false;
  tz = Date.now();
  zeta = await call(N.base, 'testicle.script.get', { name: Z + 'zeta.js' });
  zt = tables(DB);
  zrow = scriptRow(zt, Z + 'zeta.js');
  return (zeta.status === 200 && !!zrow) || false;
}, test.limit.quick);
test.run('script.get answers exactly that file row', 0.2, function () {
  if (!zeta) return false;
  return (!!zrow && !!zeta.body && zeta.body.name === zrow.name && zeta.body.hash === zrow.hash && Number(zeta.body.changed) === Number(zrow.changed) && no(zrow.deleted)) || false;
}, test.limit.quick);
test.run('script.get makes a suite row for every suite that concerns the file', 0.2, function () {
  if (!zt) return false;
  wantZeta = concerning(s.run, Z + 'zeta.js');
  return (wantZeta.indexOf(Z + 'test/zeta.js') !== -1 && JSON.stringify(names(suiteRows(zt, Z + 'zeta.js'))) === JSON.stringify(wantZeta)) || false;
}, test.limit.quick);
test.run('every suite row script.get makes is flagged needs testing', 0.2, function () {
  if (!zt) return false;
  const zunflagged = suiteRows(zt, Z + 'zeta.js').filter(notClassifier).filter(function (r) { return !yes(r.test); });
  return (suiteRows(zt, Z + 'zeta.js').length > 0 && !zunflagged.length) || false;
}, test.limit.quick);
test.run('script.get of a file with rows answers its row as it stands', 0.2, async function () {
  if (!up()) return false;
  const known = await call(N.base, 'testicle.script.get', { name: Z + 'gamma.js' });
  const grow = scriptRow(tables(DB), Z + 'gamma.js');
  return (known.status === 200 && !!grow && !!known.body && known.body.name === grow.name && known.body.hash === grow.hash) || false;
}, test.limit.quick);

// goal/G47.1, the verbs cycle: testicle.suite.search. The box: "A standard table search response", "The file row owns
// its suite rows: the suite table's key is file and suite. So suite.search takes the production file and answers that
// file's suite rows only, each suite once, with its filename and its status; the words narrow among them", "the suite
// files, each with test as the final folder it is in", "The suite search returns both: the filename AND its status
// \"needs running\"". The standard answer: {items: [{key, label}], more}, each label the row as JSON.
test.run('suite.search answers a standard table search: items and more', 0.2, async function () {
  if (!up()) return false;
  all = await call(N.base, 'testicle.suite.search', { script: Z + 'zeta.js', text: '' });
  got = items(all);
  return (all.status === 200 && !!all.body && Array.isArray(all.body.items) && typeof all.body.more === 'boolean') || false;
}, test.limit.quick);
test.run('with no words, suite.search answers the file\'s suites, each once, and no other', 0.2, function () {
  const gotNames = got.map(suiteOf).sort();
  return JSON.stringify(gotNames) === JSON.stringify(wantZeta) || false;
}, test.limit.quick);
test.run('every row suite.search answers is the given script\'s', 0.2, function () {
  return (got.length > 0 && got.every(function (i) { return i.row.script === Z + 'zeta.js'; })) || false;
}, test.limit.quick);
test.run('every suite that suite.search answers is a file whose final folder is test', 0.2, function () {
  return (got.length > 0 && got.every(function (i) { return path.posix.basename(path.posix.dirname(suiteOf(i))) === 'test'; })) || false;
}, test.limit.quick);
test.run('every suite that suite.search answers carries its status: needs running', 0.2, function () {
  return (got.length > 0 && got.filter(function (i) { return notClassifier(i.row); }).every(function (i) { return yes(i.row.test) || i.row.status === 'needs running'; })) || false;
}, test.limit.quick);
test.run('the words narrow among the file\'s suites', 0.2, async function () {
  if (!up()) return false;
  const narrow = items(await call(N.base, 'testicle.suite.search', { script: Z + 'zeta.js', text: 'sibling' })).map(suiteOf);
  return (narrow.indexOf(GENERAL) !== -1 && narrow.indexOf(Z + 'test/zeta.js') === -1) || false;
}, test.limit.quick);
test.run('another file\'s search answers that file\'s rows, none of the first', 0.2, async function () {
  if (!up()) return false;
  const other = items(await call(N.base, 'testicle.suite.search', { script: Z + 'gamma.js', text: '' }));
  return (other.length > 0 && other.every(function (i) { return i.row.script === Z + 'gamma.js'; }) && other.map(suiteOf).indexOf(Z + 'test/zeta.js') === -1) || false;
}, test.limit.quick);
// goal/G47.1, the box: "with the script selector blank (all scripts), the suite selector lists every suite, each once, and
// suite.search given no script answers that list". It replaces "suite.search keeps needing a script" (Andy: "There's
// NOTHING wrong with searching for testicle records that only must match a suite and not a file."). GENERAL judges both
// zeta and gamma, so it is one suite of two scripts.
test.run('given no script, suite.search answers the suites of every script', 0.2, async function () {
  if (!up()) return false;
  const r = await call(N.base, 'testicle.suite.search', { text: 'zzTesticle' });
  const names = items(r).map(suiteOf);
  return (r.status === 200 && names.indexOf(Z + 'test/zeta.js') !== -1 && names.indexOf(Z + 'test/gamma.js') !== -1) || false;
}, test.limit.quick);
test.run('given no script, suite.search answers each suite once', 0.2, async function () {
  if (!up()) return false;
  const names = items(await call(N.base, 'testicle.suite.search', { text: '' })).map(suiteOf);
  const twice = names.filter(function (n, i) { return names.indexOf(n) !== i; });
  return (names.length > 0 && twice.length === 0) || false;
}, test.limit.quick);
test.run('given no script, a suite of two scripts is answered once', 0.2, async function () {
  if (!up()) return false;
  const names = items(await call(N.base, 'testicle.suite.search', { text: 'sibling' })).map(suiteOf);
  return names.filter(function (n) { return n === GENERAL; }).length === 1 || false;
}, test.limit.quick);

// goal/G47.1, the test cycle. The box: "The testicle.test table now needs a \"set\" verb, and a \"search\" verb", "When
// a test row is set, and a script row is missing, the server needs to auto-create the script/suite rows for that test",
// "The test table is as goal/G45.1's box specifies it", "Every test.set happens by itself, no bundling", "test.set MUST
// carry severity: {script, suite, test, verified, severity}. The server applies the severity to the row only if the new
// severity is higher than the old one", "If the test does not flip, the current row is only updated with the last
// checked date, and, if it exists, the hash of the product file", "If the test flips, a new active row is created; this
// will keep change history", "test.search will only return \"current\" test rows for the script/suite combination
// supplied ... no script in the search query searches tests for any script; the same for suite", "The new verb \"red\"
// is shorthand for: search all failed, current tests, most severe first", "Most severe first applies to all test
// searches", "The verb red is testicle.red". G45.1's columns:
// script (file until the rename), suite, test, flipped, current, verified, tested, judged, severity. Since goal/G48.4 (Andy:
// "FLIPPED IS KILLED NOW", "the \"date\" is changed on every report, if the test flips a new row is made current"): no flipped;
// one date, tested, and a row's own number, id, in its key.
test.run('testicle.set is served, and testicle.db holds the table testicle', 0.2, async function () {
  if (!up()) return false;
  ts0 = Date.now();
  set1 = await call(N.base, 'testicle.testicle.set', { script: TH, suite: THS, test: 'theta answers its first question', verified: true, severity: 0.2 });
  k1 = tables(DB);
  return (set1.status === 200 && Array.isArray(k1.test)) || false;
}, test.limit.quick);
test.run('a set\'s script has its script row', 0.2, function () {
  if (!k1) return false;
  return !!scriptRow(k1, TH) || false;
}, test.limit.quick);
test.run('a set\'s script has a suite row for every suite that concerns it', 0.2, function () {
  if (!k1) return false;
  wantTheta = concerning(s.run, TH);
  return JSON.stringify(names(suiteRows(k1, TH))) === JSON.stringify(wantTheta) || false;
}, test.limit.quick);
test.run('a test set for the first time has one row, current', 0.2, function () {
  if (!k1) return false;
  tr1 = currentOf(k1, TH, THS, 'theta answers its first question')[0];
  return (testRows(k1, TH, THS, 'theta answers its first question').length === 1 && !!tr1) || false;
}, test.limit.quick);
test.run('the row holds its result and its severity', 0.2, function () {
  return (!!tr1 && yes(tr1.verified) && Number(tr1.severity) === 0.2) || false;
}, test.limit.quick);
test.run('the row holds one date, when it was tested, a numeric UTC timestamp, and no flipped', 0.2, function () {
  return (!!tr1 && !('flipped' in tr1) && Number(tr1.tested) >= ts0 - 1000 && Number(tr1.tested) <= Date.now()) || false;
}, test.limit.quick);
test.run('the row is judged at the script\'s hash', 0.2, function () {
  if (!k1) return false;
  return (!!tr1 && tr1.judged === (scriptRow(k1, TH) || {}).hash && typeof tr1.judged === 'string' && tr1.judged !== '') || false;
}, test.limit.quick);

// the box: "If the test does not flip, the current row is only updated"
test.run('the same result again makes no new row', 0.2, async function () {
  if (!up()) return false;
  await sleep(20);
  ts1 = Date.now();
  await call(N.base, 'testicle.testicle.set', { script: TH, suite: THS, test: 'theta answers its first question', verified: true, severity: 0.1 });
  k2 = tables(DB);
  tr2 = currentOf(k2, TH, THS, 'theta answers its first question')[0];
  return (testRows(k2, TH, THS, 'theta answers its first question').length === 1 && !!tr2) || false;
}, test.limit.quick);
test.run('the current row\'s tested moves, and it stays the same row', 0.2, function () {
  return (!!tr2 && !!tr1 && Number(tr2.tested) >= ts1 && tr2.id !== undefined && tr2.id === tr1.id) || false;
}, test.limit.quick);
test.run('a lower severity leaves the row\'s severity as it was', 0.2, function () {
  return (!!tr2 && Number(tr2.severity) === 0.2) || false;
}, test.limit.quick);
test.run('with the script changed, the row is judged at its new hash', 0.2, async function () {
  if (!up()) return false;
  fs.appendFileSync(path.join(s.run, TH), '// theta changed\n');
  await sleep(1000);
  await call(N.base, 'testicle.testicle.set', { script: TH, suite: THS, test: 'theta answers its first question', verified: true, severity: 0.5 });
  k3 = tables(DB);
  tr3 = currentOf(k3, TH, THS, 'theta answers its first question')[0];
  return (!!tr3 && !!tr1 && tr3.judged === (scriptRow(k3, TH) || {}).hash && tr3.judged !== tr1.judged) || false;
}, test.limit.slow);
test.run('a higher severity is applied to the row', 0.2, function () {
  return (!!tr3 && Number(tr3.severity) === 0.5) || false;
}, test.limit.quick);

// the box: "If the test flips, a new active row is created"
test.run('a flip makes a second row, and one row alone is current', 0.2, async function () {
  if (!up()) return false;
  ts2 = Date.now();
  await call(N.base, 'testicle.testicle.set', { script: TH, suite: THS, test: 'theta answers its first question', verified: false, severity: 0.6 });
  k4 = tables(DB);
  all4 = testRows(k4, TH, THS, 'theta answers its first question');
  cur4 = currentOf(k4, TH, THS, 'theta answers its first question');
  return (all4.length === 2 && cur4.length === 1) || false;
}, test.limit.quick);
test.run('the new current row holds the new result, tested now, a row of its own', 0.2, function () {
  return (cur4.length === 1 && !!tr1 && no(cur4[0].verified) && Number(cur4[0].tested) >= ts2 && cur4[0].id !== tr1.id) || false;
}, test.limit.quick);
test.run('the row it replaces is kept, current no longer: the history', 0.2, function () {
  const old4 = all4.filter(function (r) { return !yes(r.current); })[0];
  return (!!old4 && !!tr1 && yes(old4.verified) && old4.id === tr1.id) || false;
}, test.limit.quick);
// theta's first question passes again: a third row of it, the history the searches below read. (Its old check, that the
// needs-testing flag stays, went with the struck line "This cycle does not clear a suite's needs-testing flag".)
test.run('theta\'s first question passes again', 0.2, async function () {
  if (!up()) return false;
  const r = await call(N.base, 'testicle.testicle.set', { script: TH, suite: THS, test: 'theta answers its first question', verified: true, severity: 0.6 });
  return r.status === 200 || false;
}, test.limit.quick);

// the box: "test.search will only return current test rows"
test.run('testicle.search answers a standard table search: items and more', 0.2, async function () {
  if (!up()) return false;
  await call(N.base, 'testicle.testicle.set', { script: TH, suite: THS, test: 'theta answers its second question', verified: false, severity: 0.9 });
  await call(N.base, 'testicle.testicle.set', { script: TH, suite: THS, test: 'theta answers its third question', verified: false, severity: 0.3 });
  await call(N.base, 'testicle.testicle.set', { script: Z + 'gamma.js', suite: Z + 'test/gamma.js', test: 'gamma answers', verified: false, severity: 0.7 });
  sr = await call(N.base, 'testicle.testicle.search', { script: TH, suite: THS, text: '' });
  srRows = found(sr);
  return (sr.status === 200 && !!sr.body && Array.isArray(sr.body.items) && typeof sr.body.more === 'boolean') || false;
}, test.limit.quick);
test.run('for a script and suite, testicle.search answers their current tests only, one row each', 0.2, function () {
  return (srRows.length === 3 && srRows.every(function (r) { return yes(r.current) && r.script === TH && r.suite === THS; })) || false;
}, test.limit.quick);
// goal/G47.1, the box: "Every test search answers its failed tests first, then by severity." theta's three: the second
// failed at 0.9, the third failed at 0.3, the first passed at 0.6.
test.run('testicle.search answers the failed tests first, then the most severe first', 0.2, function () {
  const got = srRows.map(function (r) { return (yes(r.verified) ? 'green ' : 'red ') + Number(r.severity); });
  return JSON.stringify(got) === JSON.stringify(['red 0.9', 'red 0.3', 'green 0.6']) || false;
}, test.limit.quick);
// the box: "Red, green, the script and the suite go to the server with the words, so the server narrows before it cuts".
test.run('result red answers the failed tests alone', 0.2, async function () {
  if (!up()) return false;
  const r = found(await call(N.base, 'testicle.testicle.search', { script: TH, suite: THS, result: 'red', text: '' }));
  return (r.length === 2 && r.every(function (x) { return no(x.verified); })) || false;
}, test.limit.quick);
test.run('result green answers the passed tests alone', 0.2, async function () {
  if (!up()) return false;
  const r = found(await call(N.base, 'testicle.testicle.search', { script: TH, suite: THS, result: 'green', text: '' }));
  return (r.length === 1 && yes(r[0].verified)) || false;
}, test.limit.quick);
test.run('a result neither red nor green is refused', 0.2, async function () {
  if (!up()) return false;
  const r = await call(N.base, 'testicle.testicle.search', { result: 'blue', text: '' });
  return r.status === 400 || false;
}, test.limit.quick);
// goal/G47.1, Andy: "MAKE SURE THE MOTHERFUCKING TESTING ASSERTS NO FUCKING PAGING, AND THAT THAT SHIT IS GOOD AND GONE!":
// a search is one answer of the newest that fit, never a list handed out in parts.
test.run('testicle.search declares no from, in its interface or its verb file: it answers in one part only', 0.2, function () {
  const api = fs.readFileSync(path.join(RUN, 'spirit', 'app', 'testicle', 'api.js'), 'utf8');
  const verb = JSON.parse(fs.readFileSync(path.join(RUN, 'spirit', 'app', 'testicle', 'testicle.search.json'), 'utf8'));
  const line = (/'testicle\.search'\s*:\s*\{[^}]*\}/.exec(api) || [''])[0];
  return line !== '' && !/\bfrom\s*:/.test(line) && !Object.prototype.hasOwnProperty.call(verb.request || {}, 'from') ? true : false;
}, test.limit.quick);
test.run('testicle.search asked with a from is refused', 0.2, async function () {
  if (!up()) return false;
  const r = await call(N.base, 'testicle.testicle.search', { script: TH, suite: THS, from: 1, text: '' });
  return r.status === 400 || false;
}, test.limit.quick);
test.run('with no script, testicle.search searches that suite\'s tests for any script', 0.2, async function () {
  if (!up()) return false;
  const anyScript = found(await call(N.base, 'testicle.testicle.search', { suite: THS, text: '' }));
  return (anyScript.length === 3 && anyScript.every(function (r) { return r.suite === THS && yes(r.current); })) || false;
}, test.limit.quick);
test.run('with no suite, testicle.search searches that script\'s tests in any suite', 0.2, async function () {
  if (!up()) return false;
  const anySuite = found(await call(N.base, 'testicle.testicle.search', { script: Z + 'gamma.js', text: '' }));
  // gamma's tests in any suite: its own test's, and the classifier's classifyable row beside it (box v94, 1).
  return (anySuite.length >= 1 && anySuite.every(function (r) { return r.script === Z + 'gamma.js'; }) && anySuite.some(function (r) { return r.test === 'gamma answers'; }) && anySuite.every(function (r) { return r.test === 'gamma answers' || r.suite === 'spirit/test/scriptClassify.js'; })) || false;
}, test.limit.quick);
test.run('with neither, testicle.search searches every current test', 0.2, async function () {
  if (!up()) return false;
  const ans = await call(N.base, 'testicle.testicle.search', { text: '' });
  const everyOne = found(ans);
  // The runner adds rows of its own runs (goal/G47.1, the queue cycle): the four set here are among them, and every one is current.
  const mine = everyOne.filter(function (r) { return ['theta answers its first question', 'theta answers its second question', 'theta answers its third question', 'gamma answers'].indexOf(r.test) !== -1; });
  // The answer fits its room (more: true when cut): cut, it holds current rows, as many as fit, the failed first (Andy:
  // "the empty search string with no script or suite selected should already fill up with more that 20 reds").
  if (ans.body && ans.body.more) {
    const cur = (tables(DB).test || []).filter(function (r) { return yes(r.current); }).length;
    const redFirst = everyOne.every(function (r, i) { return i === 0 || yes(r.verified) || no(everyOne[i - 1].verified); });
    return (everyOne.length > 0 && everyOne.length < cur && redFirst && everyOne.every(function (r) { return yes(r.current); })) || false;
  }
  return (mine.length === 4 && everyOne.every(function (r) { return yes(r.current); })) || false;
}, test.limit.quick);

// goal/G47.1, the cycle "the testicle search", the old ruling amended (Andy: "test.search will return only current test rows
// by default, unless a valid test-Title is supplied, in which case all rows will be show that match: \"script, suite AND
// title\""): given a test, every row of it, current or not, newest first. theta's first question was set passing, then
// failing, then passing again: three rows, one current.
let hist = [];
test.run('given a test title, testicle.search answers every row of that test, current or not', 0.2, async function () {
  if (!up()) return false;
  hist = found(await call(N.base, 'testicle.testicle.search', { script: TH, suite: THS, test: 'theta answers its first question', text: '' }));
  const all = testRows(tables(DB), TH, THS, 'theta answers its first question');
  return (all.length === 3 && hist.length === 3 && hist.filter(function (r) { return yes(r.current); }).length === 1) || false;
}, test.limit.quick);
test.run('the rows of a given test title come newest first', 0.2, function () {
  if (!up()) return false;
  const f = hist.map(function (r) { return Number(r.id); });
  return (f.length === 3 && f[0] > f[1] && f[1] > f[2]) || false;
}, test.limit.quick);
test.run('given a test title, testicle.search answers only rows of that script, suite and title', 0.2, function () {
  if (!up()) return false;
  const other = hist.filter(function (r) { return r.script !== TH || r.suite !== THS || r.test !== 'theta answers its first question'; });
  return (hist.length > 0 && !other.length) || false;
}, test.limit.quick);
test.run('without a test title it still answers the current rows alone', 0.2, async function () {
  if (!up()) return false;
  const cur = found(await call(N.base, 'testicle.testicle.search', { script: TH, suite: THS, text: '' }));
  const mine = cur.filter(function (r) { return r.test === 'theta answers its first question'; });
  return (mine.length === 1 && yes(mine[0].current)) || false;
}, test.limit.quick);

// goal/G47.1, the box, the search fix (Andy: "the empty search string with no script or suite selected should already fill
// up with more that 20 reds when i open the app!, and typing in the search bar sends requests and returns NOTHING$!",
// "ALL, GO BOX IT, FIX IT!!!!!!!!!!"): "Every test search answers its failed tests first, then by severity. Red, green,
// the script and the suite go to the server with the words, so the server narrows before it cuts an answer". result is
// the field cw named for red and green ("it gains one optional field, result, red or green, left out for both").
// THE WORLD: 40 passing tests of gamma at severity 1, with titles long enough that one answer cannot hold them all; beneath
// them theta's quiet pass (the word quokka) and theta's quiet failure (the word wombat), both at severity 0.
const LOUD = function (i) { return 'gamma passes loudly, number ' + i + ', with a title long enough that one answer of the search cannot hold forty of them'; };
const QUOKKA = 'theta passes quietly, the quokka';
const WOMBAT = 'theta fails quietly, the wombat';
const has = function (rows, title) { return rows.some(function (r) { return r.test === title; }); };
const ask = function (args) { return call(N.base, 'testicle.testicle.search', Object.assign({ text: '' }, args)); };
let loud = false;
test.run('there are 40 passing tests of gamma at severity 1, and theta\'s quiet pass and quiet failure at severity 0', 0.2, async function () {
  if (!up()) return false;
  const out = [];
  for (let i = 0; i < 40; i++) out.push(await call(N.base, 'testicle.testicle.set', { script: Z + 'gamma.js', suite: Z + 'test/gamma.js', test: LOUD(i), verified: true, severity: 1 }));
  out.push(await call(N.base, 'testicle.testicle.set', { script: TH, suite: THS, test: QUOKKA, verified: true, severity: 0 }));
  out.push(await call(N.base, 'testicle.testicle.set', { script: TH, suite: THS, test: WOMBAT, verified: false, severity: 0 }));
  loud = out.every(function (r) { return r.status === 200; });
  return loud || false;
}, test.limit.slow);
test.run('with nothing chosen, the answer is cut', 0.2, async function () {
  if (!loud) return false;
  const r = await ask({});
  return (r.status === 200 && !!r.body && r.body.more === true) || false;
}, test.limit.quick);
test.run('with nothing chosen, a cut answer holds no passed test before a failed one', 0.2, async function () {
  if (!loud) return false;
  const rows = found(await ask({}));
  const firstPass = rows.findIndex(function (r) { return yes(r.verified); });
  const lateFail = firstPass === -1 ? -1 : rows.slice(firstPass).findIndex(function (r) { return no(r.verified); });
  return (rows.length > 0 && no(rows[0].verified) && lateFail === -1) || false;
}, test.limit.quick);
// The runner's own runs add failures of their own: the answer is judged against every failed current row of the table.
test.run('with nothing chosen, the quiet failure at severity 0 comes before 40 passed tests of severity 1', 0.2, async function () {
  if (!loud) return false;
  const rows = found(await ask({}));
  const reds = (tables(DB).test || []).filter(function (r) { return yes(r.current) && no(r.verified); }).length;
  const at = rows.findIndex(function (r) { return r.test === WOMBAT; });
  const firstPass = rows.findIndex(function (r) { return yes(r.verified); });
  if (firstPass === -1 && at === -1) return false;
  return (at !== -1 && (firstPass === -1 || at < firstPass)) || false;
}, test.limit.quick);
test.run('result red answers failed tests only', 0.2, async function () {
  if (!loud) return false;
  const r = await ask({ result: 'red' });
  const rows = found(r);
  return (r.status === 200 && rows.length > 0 && rows.every(function (x) { return no(x.verified) && yes(x.current); })) || false;
}, test.limit.quick);
test.run('result green answers passed tests only', 0.2, async function () {
  if (!loud) return false;
  const r = await ask({ result: 'green' });
  const rows = found(r);
  return (r.status === 200 && rows.length > 0 && rows.every(function (x) { return yes(x.verified) && yes(x.current); })) || false;
}, test.limit.quick);
test.run('result left out answers failed and passed tests both', 0.2, async function () {
  if (!loud) return false;
  const rows = found(await ask({ script: TH }));
  return (rows.some(function (x) { return no(x.verified); }) && rows.some(function (x) { return yes(x.verified); })) || false;
}, test.limit.quick);
test.run('result green narrows before the cut: theta chosen, its quiet pass is found beneath 40 louder passes', 0.2, async function () {
  if (!loud) return false;
  const r = await ask({ script: TH, result: 'green' });
  const rows = found(r);
  return (r.status === 200 && has(rows, QUOKKA) && rows.every(function (x) { return x.script === TH && yes(x.verified); })) || false;
}, test.limit.quick);
test.run('result green narrows before the cut: theta\'s suite chosen with no script, its quiet pass is found', 0.2, async function () {
  if (!loud) return false;
  const r = await ask({ suite: THS, result: 'green' });
  const rows = found(r);
  return (r.status === 200 && has(rows, QUOKKA) && rows.every(function (x) { return x.suite === THS && yes(x.verified); })) || false;
}, test.limit.quick);
test.run('with green alone, nothing chosen, the answer is all passes and none of them failed', 0.2, async function () {
  if (!loud) return false;
  const rows = found(await ask({ result: 'green' }));
  return (rows.length > 0 && !has(rows, WOMBAT) && rows.every(function (x) { return yes(x.verified); })) || false;
}, test.limit.quick);
test.run('typed words narrow before the cut: "quokka" finds theta\'s quiet pass beneath 40 louder passes', 0.2, async function () {
  if (!loud) return false;
  const rows = found(await ask({ text: 'quokka' }));
  return has(rows, QUOKKA) || false;
}, test.limit.quick);
test.run('typed words and result together: "quokka" with result red finds no passed test', 0.2, async function () {
  if (!loud) return false;
  const r = await ask({ text: 'quokka', result: 'red' });
  const rows = found(r);
  return (r.status === 200 && !has(rows, QUOKKA) && rows.every(function (x) { return no(x.verified); })) || false;
}, test.limit.quick);
test.run('typed words and result together: "wombat" with result red finds theta\'s quiet failure', 0.2, async function () {
  if (!loud) return false;
  const r = await ask({ text: 'wombat', result: 'red' });
  return (r.status === 200 && has(found(r), WOMBAT)) || false;
}, test.limit.quick);

// EVERY VARIATION OF EVERY SEARCH, ALL ITS ROWS OR A FULL ANSWER (Andy, to wsl: "You BETTER check that every variation of
// search returns ALL matching records, or AT LEAST abucket full!! FOR ALL SEARCHES. - ALL RECORDS if they don't fill a
// bucket - ALL MATCHING RECORDS, if they don't fill a bucked, - AND all returned searches are FULL, if there's enough record
// in the fucking table, - AND the string matching is either fuckings useless or used in THE MOST BRAINDEAD WAY."). The
// rows that match are read from testicle.db itself, the runner idle so the table holds still: a test row matches when it
// is current, of the script, the suite and the result asked, and each typed word is in its title, its script or its suite,
// in any case. An answer is full when the room one answer has (limits.ANSWER_MAX) left after it cannot hold one more of
// its rows. For each: not cut, it holds every matching row; cut, it is full and holds matching rows only.
const limits = require(path.join(RUN, 'spirit', 'limits.js'));
const ROOM = limits.ANSWER_MAX - Buffer.byteLength(JSON.stringify({ items: [], more: false }), 'utf8');
const bytes = function (x) { return Buffer.byteLength(JSON.stringify(x), 'utf8'); };
// next: the item the server held back, the first of the following answer (from), when the search takes from; without it,
// the largest item the answer holds stands in for it.
const fullAnswer = function (body, next) {
  const its = (body && body.items) || [];
  if (!its.length) return false;
  const used = bytes(its) - 2;
  const after = next ? bytes(next) : Math.max.apply(null, its.map(bytes));
  return ROOM - used < after + 1;
};
const wordsIn = function (row, text) {
  const hay = [row.test, row.script, row.suite].map(function (x) { return String(x || '').toLowerCase(); }).join(' ');
  return String(text || '').toLowerCase().split(/\s+/).filter(Boolean).every(function (w) { return hay.indexOf(w) !== -1; });
};
const matchingTests = function (a) {
  return (tables(DB).test || []).filter(function (r) {
    return yes(r.current) && (a.script === undefined || r.script === a.script) && (a.suite === undefined || r.suite === a.suite) &&
      (a.result === undefined || (a.result === 'red' ? no(r.verified) : yes(r.verified))) && wordsIn(r, a.text);
  });
};
const tkey = function (r) { return r.script + '|' + r.suite + '|' + r.test; };
// One search judged: its answer against the rows that match.
// allowed: the rows an answer may hold at all, the narrowing without the words (the box names no rule on what else the
// words may find; Andy's ask is that every row they match is found).
const judged = function (r, want, keyOf2, allowed, next) {
  if (r.status !== 200 || !r.body || !Array.isArray(r.body.items)) return false;
  const rows = found(r);
  const got = {};
  rows.forEach(function (x) { got[keyOf2(x)] = true; });
  const may = {};
  (allowed || want).forEach(function (x) { may[keyOf2(x)] = true; });
  const stray = rows.filter(function (x) { return !may[keyOf2(x)]; });
  if (stray.length) return false;
  if (!r.body.more) {
    const missing = want.filter(function (x) { return !got[keyOf2(x)]; });
    return !missing.length || false;
  }
  const missing = want.filter(function (x) { return !got[keyOf2(x)]; });
  if (!fullAnswer(r.body, next)) return false;
  // Cut and full: of the rows that match, as many as the answer holds are in it, never fewer.
  return (want.length - missing.length >= Math.min(rows.length, want.length)) || false;
};
const VARIATIONS = [
  ['nothing chosen, no words', {}],
  ['a script', { script: TH }],
  ['a suite', { suite: THS }],
  ['a script and a suite', { script: TH, suite: THS }],
  ['result red', { result: 'red' }],
  ['result green', { result: 'green' }],
  ['a script, result red', { script: TH, result: 'red' }],
  ['a script, result green', { script: TH, result: 'green' }],
  ['a suite, result green', { suite: THS, result: 'green' }],
  ['a script and a suite, result red', { script: TH, suite: THS, result: 'red' }],
  ['the script of 40 louder passes', { script: Z + 'gamma.js' }],
  ['the script of 40 louder passes, result green', { script: Z + 'gamma.js', result: 'green' }],
  ['the words "quokka"', { text: 'quokka' }],
  ['the word "loudly", in 40 titles', { text: 'loudly' }],
  ['the word "theta", in a script name', { text: 'theta' }],
  ['the words "theta quietly"', { text: 'theta quietly' }],
  ['the word "QUOKKA" in capitals', { text: 'QUOKKA' }],
  ['the word "wombat", result red', { text: 'wombat', result: 'red' }],
  ['the word "loudly", result red', { text: 'loudly', result: 'red' }],
  ['the word "question", a script and a suite', { text: 'question', script: TH, suite: THS }],
];
test.run('the runner is idle, so the table holds still while every variation is asked', 0.2, async function () {
  if (!loud) return false;
  return (await idle(240000)) || false;
}, test.limit.long);
// One test, its answer naming each variation that breaks (titles are fixed words, goal/G47.2).
const eachOf = async function (list, one) {
  let bad = 0;
  for (const v of list) { const r = await one(v); if (r !== true) bad++; }
  return bad === 0 || false;
};
test.run('testicle.search, in each of its variations, answers every matching test, or a full answer of matching tests', 0.2, async function () {
  if (!loud) return false;
  return eachOf(VARIATIONS, async function (v) {
    const a = Object.assign({ text: '' }, v[1]);
    const r = await call(N.base, 'testicle.testicle.search', a);
    return judged(r, matchingTests(a), tkey, matchingTests(Object.assign({}, a, { text: '' })), null);
  });
}, test.limit.slow);
test.run('testicle.red answers every failed current test, or a full answer of them', 0.2, async function () {
  if (!loud) return false;
  return judged(await call(N.base, 'testicle.red', {}), matchingTests({ result: 'red' }), tkey);
}, test.limit.quick);
// suite.search: a script's suite rows, or every suite once with no script; the words in the suite's or the script's name.
const matchingSuites = function (script, text) {
  const rows = (tables(DB).suite || []).filter(function (r) { return !script || r.script === script; });
  const once = {};
  return rows.filter(function (r) { const k = script ? r.script + '|' + r.suite : r.suite; if (once[k]) return false; once[k] = true; return wordsIn({ test: '', script: script ? r.script : '', suite: r.suite }, text); });
};
const SUITE_ASKS = [
  ['no script, no words', '', ''],
  ['a script', TH, ''],
  ['no script, the word "theta"', '', 'theta'],
  ['a script, the word "theta"', TH, 'theta'],
];
test.run('suite.search, with and without a script and words, answers every matching suite, or a full answer of them', 0.2, async function () {
  if (!loud) return false;
  return eachOf(SUITE_ASKS, async function (v) {
    const a = v[1] ? { script: v[1], text: v[2] } : { text: v[2] };
    const r = await call(N.base, 'testicle.suite.search', a);
    return judged(r, matchingSuites(v[1], v[2]), function (x) { return v[1] ? x.script + '|' + x.suite : x.suite; }, matchingSuites(v[1], ''));
  });
}, test.limit.slow);

// the box: "The verb red is testicle.red"
test.run('testicle.red answers every failed current test, and no other', 0.2, async function () {
  if (!up()) return false;
  // The runner's own runs write while it works: red is asked once it is idle, so the table it is compared with holds still.
  await idle(240000);
  const redAns = await call(N.base, 'testicle.red', {});
  red = found(redAns);
  // The runner adds failures of its own runs (goal/G47.1, the queue cycle): every failed current row of the table, no other.
  const want = (tables(DB).test || []).filter(function (r) { return yes(r.current) && no(r.verified); }).length;
  // The answer fits its room (more: true when cut): cut, every row of it failed and current, fewer than the table holds.
  if (redAns.body && redAns.body.more) return (red.length > 0 && red.length < want && red.every(function (r) { return no(r.verified) && yes(r.current); })) || false;
  return (red.length === want && red.length >= 3 && red.every(function (r) { return no(r.verified) && yes(r.current); })) || false;
}, test.limit.long);
test.run('testicle.red answers the most severe first', 0.2, function () {
  const redSev = red.map(function (r) { return Number(r.severity); });
  return (redSev.length >= 3 && redSev.every(function (v, i) { return i === 0 || redSev[i - 1] >= v; })) || false;
}, test.limit.quick);

// Before the general test changes: that one judges every product file, the untouched among them.
// the box: "A product file or a suite that has not changed has no row"
test.run('a changed file that is no product script gets no row', 0.2, async function () {
  if (!up()) return false;
  append(Z + 'notes.md', 'no script\n');
  n1 = await after();
  return !scriptRow(n1, Z + 'notes.md') || false;
}, test.limit.slow);

// the box: "When a suite ... is changed": a general test
test.run('the changed general test judges every product file', 0.2, function () {
  if (!up()) return false;
  reach = judgedBy(s.run, GENERAL);
  // In debug mode (box v143) every product file is every product script under spirit/app/testicle/, the planted among them.
  const walk = function (rel) { let out = []; fs.readdirSync(path.join(s.run, rel), { withFileTypes: true }).forEach(function (e) { const r = rel + '/' + e.name; if (e.isDirectory()) { if (e.name !== 'test') out = out.concat(walk(r)); } else if (/\.js$/.test(e.name)) out.push(r); }); return out; };
  const want = walk('spirit/app/testicle');
  const missed = want.filter(function (f) { return reach.indexOf(f) === -1; });
  return (want.length > 0 && !missed.length) || false;
}, test.limit.quick);
test.run('while testicle works on a changed general test, busy answers true', 0.2, async function () {
  if (!up()) return false;
  append(GENERAL, '// a general test changed\n');
  // While it does that work, busy answers true; asked over and over in that second, it says so at least once.
  seen = [];
  const stopAt = Date.now() + 1000;
  while (Date.now() < stopAt) { const b = await call(N.base, 'testicle.busy', {}); seen.push(b.body === true || (b.body && b.body.busy === true)); }
  r1 = tables(DB);
  return seen.indexOf(true) !== -1 || false;
}, test.limit.slow);
test.run('once that work is done, busy answers false again', 0.2, async function () {
  if (!up()) return false;
  // The runner works off what the changes flagged before it is idle (goal/G47.1, the queue cycle).
  let done = null;
  const ok = await until(function () { return call(N.base, 'testicle.busy', {}).then(function (r) { done = r; return r.status === 200 && (r.body === false || (r.body && r.body.busy === false)); }); }, 240000);
  return !!ok || false;
}, test.limit.long);
test.run('one second after a general test changes, every file it judges has its suite row for it', 0.2, function () {
  if (!r1) return false;
  const missing = reach.filter(function (f) { return !suiteRow(r1, f, GENERAL); });
  return (reach.length > 0 && !missing.length) || false;
}, test.limit.quick);
test.run('every file a changed general test judges has its row in script', 0.2, function () {
  if (!r1) return false;
  const unfiled = reach.filter(function (f) { return !scriptRow(r1, f); });
  return (reach.length > 0 && !unfiled.length) || false;
}, test.limit.quick);

// the box: "A removed file's row is marked deleted"
test.run('one second after a product file is removed, its row is marked deleted', 0.2, async function () {
  if (!up()) return false;
  fs.rmSync(path.join(s.run, Z + 'alpha.js'));
  x1 = await after();
  const gone = scriptRow(x1, Z + 'alpha.js');
  return (!!gone && yes(gone.deleted)) || false;
}, test.limit.slow);
test.run('a removed product file\'s suite rows are marked deleted', 0.2, function () {
  if (!x1) return false;
  const left = suiteRows(x1, Z + 'alpha.js').filter(function (r) { return !yes(r.deleted); });
  return (suiteRows(x1, Z + 'alpha.js').length > 0 && !left.length) || false;
}, test.limit.quick);
// A RESULT ARRIVING AFTER THE FILE IS GONE (found on wsl's node, 2026-11-13: a classifier run that began before zzList's two
// files were removed reported 2 s after, and their classifier rows stood live and red in his list for hours): the box's "A
// removed file's row is marked deleted" holds for a late result too.
let late = null;
test.run('a result reported for a removed file is refused "no such file"', 0.2, async function () {
  if (!x1) return false;
  late = await call(N.base, 'testicle.testicle.set', { script: Z + 'alpha.js', suite: 'spirit/test/scriptClassify.js', test: 'it loads, so it can be classified', verified: false, severity: 0.8 });
  return (late.status !== 200 && /no such file/.test(late.text)) || false;
}, test.limit.quick);
test.run('every suite row of the removed file stays deleted', 0.2, async function () {
  if (!late) return false;
  const t = await after();
  const live = suiteRows(t, Z + 'alpha.js').filter(function (r) { return !yes(r.deleted); });
  return (suiteRows(t, Z + 'alpha.js').length > 0 && !live.length) || false;
}, test.limit.slow);

// goal/G47.1, the cycle "run a suite from the script tab", the box: "A new testicle verb, run {script, suite, testicle}", "For
// this cycle the server answers run at once, and does not wait for the suite to complete", "testicle given: the suite runs up
// to that test, the tests before it with it, by the reporter's --test <title>. testicle missing, as from the button: the
// server runs the whole suite", "A general test is started with the script as its argument; a script's own test with none",
// "Each test reports itself to testicle.testicle.set".
const KA = Z + 'kappa.js', KAS = Z + 'test/kappa.js', LA = Z + 'lambda.js', LAS = Z + 'test/lambda.js', MU = Z + 'mu.js', MUS = Z + 'test/mu-child-zzRule.js';
const rowOf = function (script, suite, name) { return currentOf(tables(DB), script, suite, name)[0] || null; };
let run1 = null;
test.run('the node lists the verb testicle.run', 0.2, async function () {
  if (!up()) return false;
  const api = await call(N.base, 'api', { branch: 'testicle' });
  const iface = String((api.body && api.body.interface) || '');
  return /['"]?\brun['"]?\s*:/.test(iface) || false;
}, test.limit.quick);
test.run('run answers at once, before its suite has ended', 0.2, async function () {
  if (!up()) return false;
  const t0 = Date.now();
  run1 = await call(N.base, 'testicle.run', { script: KA, suite: KAS });
  const took = Date.now() - t0;
  // A row of THIS run, tested after the press (as the lambda check tells them): planted at the start, kappa's own suite has
  // already run once by itself in auto, and that earlier row is no sign the answer waited for this run.
  const mine = rowOf(KA, KAS, 'kappa answers its first');
  const early = mine && Number(mine.tested) >= t0 ? mine : null;
  return (run1.status === 200 && took < 2500 && !early) || false;
}, test.limit.quick);
test.run('without testicle, the whole suite runs: every test of it reports to testicle', 0.2, async function () {
  if (!up()) return false;
  const names0 = ['kappa waits a moment before its checks', 'kappa answers its first', 'kappa fails its second', 'kappa was started with no argument'];
  // A press waits behind the running job, which may take up to its 2-minute limit (the queue cycle).
  const ok = await until(function () { return Promise.resolve(names0.every(function (n) { return !!rowOf(KA, KAS, n); })); }, 240000);
  return !!ok || false;
}, test.limit.long);
test.run('each row holds the result its test gave', 0.2, function () {
  if (!up()) return false;
  const a = rowOf(KA, KAS, 'kappa answers its first'), b = rowOf(KA, KAS, 'kappa fails its second');
  return (!!a && !!b && yes(a.verified) && no(b.verified)) || false;
}, test.limit.quick);
test.run('a script\'s own test is started with no argument', 0.2, function () {
  if (!up()) return false;
  const r = rowOf(KA, KAS, 'kappa was started with no argument');
  return (!!r && yes(r.verified)) || false;
}, test.limit.quick);
test.run('with testicle given, the suite runs up to that test and no test after it', 0.2, async function () {
  if (!up()) return false;
  // A first report of lambda makes its rows, flagged, and the runner then runs its whole suite (the queue cycle): lambda's rows
  // are made and its whole suite run first, so nothing of lambda is flagged when the run up to a test is asked. Then this run is told
  // by when each row was tested: its second and its first after the press, its third not.
  // script.get makes lambda's rows, flagged, and the flag wakes the runner, which runs lambda's suites, its own whole. (A whole
  // run asked before the rows are there makes them during that run, so they stay flagged and it comes round again.)
  const g = await call(N.base, 'testicle.script.get', { name: LA });
  if (g.status !== 200) return false;
  // Its rows there, its whole run is put at the head of the queue, ahead of every general suite still flagged.
  const tw = Date.now();
  const w = await call(N.base, 'testicle.run', { script: LA, suite: LAS });
  if (w.status !== 200) return false;
  // Other suites may run meanwhile; what matters is that lambda's own suite is no longer flagged, so no whole run of it follows.
  // THIS whole run's third (goal/G47.1): planted at the start, lambda's suite has already run once by itself in auto, so a
  // third row from then let the wait end at once, and the whole run asked here landed after the run up to a test.
  const settled = await until(function () { const u = suiteRow(tables(DB), LA, LAS); const third = rowOf(LA, LAS, 'lambda answers its third'); return Promise.resolve(!!third && Number(third.tested) >= tw && !!u && !yes(u.test)); }, 150000);
  if (!settled) return false;
  const t0 = Date.now();
  const r = await call(N.base, 'testicle.run', { script: LA, suite: LAS, testicle: 'lambda answers its second' });
  if (r.status !== 200) return false;
  const since = function (name) { const x = rowOf(LA, LAS, name); return !!x && Number(x.tested) >= t0; };
  const ok = await until(function () { return Promise.resolve(since('lambda answers its second')); }, 90000);
  await sleep(5000);
  const three = rowOf(LA, LAS, 'lambda answers its third');
  return (!!ok && since('lambda answers its first') && !since('lambda answers its third')) || false;
}, test.limit.long);
test.run('a general test is started with the script as its argument, and reports for that script', 0.2, async function () {
  if (!up()) return false;
  const r = await call(N.base, 'testicle.run', { script: MU, suite: MUS });
  if (r.status !== 200) return false;
  await until(function () { return Promise.resolve(!!rowOf(MU, MUS, 'mu holds its rule')); }, 240000);
  const m = rowOf(MU, MUS, 'mu holds its rule');
  return (!!m && yes(m.verified)) || false;
}, test.limit.slow);

// THE RUN FOLDER HOLDS SPIRIT AND NOTHING ELSE (goal/G47.1, the box, no pollution: "Guard: after each suite, testicle finds
// nothing new in the run folder; red on the suite that made it"; Andy: "name-space pollution is 0.7"): litter's suite leaves
// zzLitter in the run folder and reports green; testicle sets its test "it leaves nothing new in the run folder" red, 0.7.
// lambda's suite, run above, left nothing: the same test of it is green.
const LITTER = 'it leaves nothing new in the run folder';
const LI = Z + 'litter.js';
const LIS = Z + 'test/litter.js';
test.run('a suite that leaves a folder in the run folder is red on "it leaves nothing new in the run folder", at 0.7', 0.4, async function () {
  if (!up()) return false;
  const r = await call(N.base, 'testicle.run', { script: LI, suite: LIS });
  if (r.status !== 200) return false;
  await until(function () { return Promise.resolve(!!rowOf(LI, LIS, LITTER)); }, 150000);
  const x = rowOf(LI, LIS, LITTER);
  return (!!x && no(x.verified) && Number(x.severity) === 0.7) || false;
}, test.limit.long);
test.run('a suite that leaves nothing in the run folder is green on it', 0.4, function () {
  if (!up()) return false;
  const x = rowOf(LA, LAS, LITTER);
  return (!!x && yes(x.verified)) || false;
}, test.limit.quick);
// A TEST'S TEMP FOLDER IS GONE AFTER IT (goal/G47.1, the box, no pollution: "A temp folder is cleaned by its owner: ... a
// test's in its own after. Guard: after each suite, testicle finds its temp folder gone; red if not"): stray's suite leaves
// its folder under its route; testicle sets its test "it leaves no temp folder behind" red, 0.7. lambda's leaves none: green.
const STRAY_TEST = 'it leaves no temp folder behind';
const ST = Z + 'stray.js';
const STS = Z + 'test/stray.js';
test.run('a suite that leaves its temp folder behind is red on "it leaves no temp folder behind", at 0.7', 0.4, async function () {
  if (!up()) return false;
  const r = await call(N.base, 'testicle.run', { script: ST, suite: STS });
  if (r.status !== 200) return false;
  await until(function () { return Promise.resolve(!!rowOf(ST, STS, STRAY_TEST)); }, 150000);
  const x = rowOf(ST, STS, STRAY_TEST);
  return (!!x && no(x.verified) && Number(x.severity) === 0.7) || false;
}, test.limit.long);
test.run('a suite that leaves no temp folder is green on it', 0.4, function () {
  if (!up()) return false;
  const x = rowOf(LA, LAS, STRAY_TEST);
  return (!!x && yes(x.verified)) || false;
}, test.limit.quick);

// goal/G47.1, the box (v57): a suite's status, the server's alone, from its own table: "needs running" when it never ran
// (Andy: "it shows "needs running" when it never ran"), "still red" when it ran with a failed test for the script, "green" when
// every test of it passed; a changed script shows "needs running" again (Andy: "if the script changed, then it shows "needs
// running" again, and the flag on the row is changed"); no suite touches the flag (Andy: "the suites have NO business changing
// the "needs running" flag on the suite rows!"). Read as suite.search serves the row.
async function statusOf(script, suite) {
  const all = items(await call(N.base, 'testicle.suite.search', { script: script, text: '' }));
  const r = all.filter(function (i) { return suiteOf(i) === suite; })[0];
  return r ? String(r.row.status) : '';
}
test.run('a suite that never ran shows "needs running"', 0.2, async function () {
  if (!up()) return false;
  // The runner runs every flagged suite a second after the last change (the queue cycle): a suite never run is one just
  // flagged, read inside that second. phi and its own test are planted and touched here first.
  append(Z + 'phi.js', '// phi, changed\n');
  let st = null;
  const ok = await until(function () { return statusOf(Z + 'phi.js', Z + 'test/phi.js').then(function (x) { st = x; return x === 'needs running'; }); }, 900);
  return !!ok || false;
}, test.limit.quick);
test.run('a suite whose every test passed shows "green"', 0.2, async function () {
  if (!up()) return false;
  let st = null;
  const ok = await until(function () { return statusOf(MU, MUS).then(function (x) { st = x; return x === 'green'; }); }, 10000);
  return !!ok || false;
}, test.limit.slow);
test.run('a suite that ran with a failed test for the script shows "still red"', 0.2, async function () {
  if (!up()) return false;
  let st = null;
  const ok = await until(function () { return statusOf(KA, KAS).then(function (x) { st = x; return x === 'still red'; }); }, 10000);
  return !!ok || false;
}, test.limit.slow);
test.run('the script changed, its suite shows "needs running" again', 0.2, async function () {
  if (!up()) return false;
  append(MU, '// mu, changed\n');
  let st = null;
  const ok = await until(function () { return statusOf(MU, MUS).then(function (x) { st = x; return x === 'needs running'; }); }, 10000);
  return !!ok || false;
}, test.limit.slow);
// goal/G47.1, Andy: "if any suite that reaches spirit.js is changed then spirit.js MUST be retested", "AND? WHAT THE FUCK ARE
// YOU DOING NOTHING FOR???": the general test judges the whole tree, so its answer for a script stands on files that are
// neither that script nor the suite; spirit.js stayed "still red" after three own tests of other scripts came in
// (851963cf). A file new in the tree flags again every general test that is red for a script; omega, planted with no
// 'use strict', is red in the general test.
let omegaRed = false;
test.run('a script planted with no \'use strict\' shows "still red" in the general test', 0.2, async function () {
  if (!up()) return false;
  fs.writeFileSync(path.join(s.run, Z + 'omega.js'), '// omega, with no use strict, red in the general test\n');
  await idle(240000);
  omegaRed = (await statusOf(Z + 'omega.js', GENERAL)) === 'still red';
  return omegaRed;
}, test.limit.long);
test.run('a file added to the tree flags the general test again for a script it judged red', 0.2, async function () {
  if (!omegaRed) return false;
  fs.writeFileSync(path.join(s.run, Z + 'omega-new.md'), 'a file new in the tree\n');
  const ok = await until(function () { return statusOf(Z + 'omega.js', GENERAL).then(function (x) { return x === 'needs running'; }); }, 900);
  return !!ok || false;
}, test.limit.long);

// goal/G47.1, the queue cycle, the box: "The flags are the queue: every suite row flagged "needs running" is owed one run,
// and there is no second list, so nothing is queued twice", "One runner: one suite process at a time, never two. It starts 1
// second after the last file change event; a new event pushes the start back", "A job is one suite for one script, one
// process each", "General tests first", "A testicle row carries both hashes it ran against, the script's and the suite's.
// When a run starts, the server remembers the two hashes as they stand, and until that run ends tags every result of it with
// them", "A file changed during a run flags again; the running job is not killed, the suite comes round again behind it", "A
// job that runs past 2 minutes is killed, and every test of that suite and script the server knows is failed ... killed, it
// shows "still red" in the script tab, so a suite that hangs before any test reported fails too", "A press of 🏃‍♂️ puts its
// suite and script at the head of the queue, never a second run beside the running one", "Rows already flagged when the server
// starts: the runner starts 1 second after the server starts". The planted suites log to runlog.txt (LOGGED, above).
const EARLY = 'spirit/app/testicle/temp/aaTesticle/early.js', EARLYS = 'spirit/app/testicle/temp/aaTesticle/test/early.js';
const NU = Z + 'nu.js', NUS = Z + 'test/nu.js', XI = Z + 'xi.js', XIS = Z + 'test/xi.js', PI = Z + 'pi.js', PIS = Z + 'test/pi.js';
const OM = Z + 'omicron.js', OMS = Z + 'test/omicron.js', TAU = Z + 'tau.js', TAUS = Z + 'test/tau.js', UP = Z + 'upsilon.js', UPS = Z + 'test/upsilon.js';
const RHO = Z + 'rho.js', RHOS = Z + 'test/rho.js', SIG = Z + 'sigma.js', SIGS = Z + 'test/sigma.js';
function runlog() { try { return fs.readFileSync(path.join(s.root, 'runlog.txt'), 'utf8').split('\n').filter(Boolean).map(parsed).filter(Boolean); } catch (e) { return []; } }
const starts = function (name) { return runlog().filter(function (l) { return l.suite === name && l.ev === 'start'; }); };
const ends = function (name) { return runlog().filter(function (l) { return l.suite === name && l.ev === 'end'; }); };
// A row's values, for the hashes it carries, whatever its columns are named.
const holds = function (row, v) { return !!row && !!v && Object.keys(row).some(function (k) { return row[k] === v; }); };
let lastChange = 0;
// Every flagged suite of what came before is worked off first: the queue checks start from an idle server.
test.run('the queue is worked off and the server is idle', 0.2, async function () {
  if (!up()) return false;
  const ok = await idle(280000);
  return !!ok || false;
}, test.limit.long);
test.run('nu.js and xi.js change, nu.js twice, 600 ms apart', 0.2, async function () {
  if (!up()) return false;
  // THE LOG STARTS HERE (goal/G47.1): the planted suites are written at the start, so in auto each has run once by itself
  // before this world; what the checks below judge is only what these changes start.
  try { fs.rmSync(path.join(s.root, 'runlog.txt'), { force: true }); } catch (e) { return false; }
  append(NU, '// nu, changed\n'); append(XI, '// xi, changed\n'); append(EARLY, '// early, changed\n');
  await sleep(600);
  append(NU, '// nu, changed again\n');
  lastChange = Date.now();
  return !runlog().length || false;
}, test.limit.quick);
test.run('a flagged suite runs by itself, with no run asked: nu\'s and xi\'s own suites start', 0.2, async function () {
  if (!up()) return false;
  const ok = await until(function () { return Promise.resolve(ends('nu').length > 0 && ends('xi').length > 0); }, 240000);
  return !!ok || false;
}, test.limit.long);
test.run('the runner starts no sooner than 1 second after the last change: the second change pushed the start back', 0.2, function () {
  if (!up()) return false;
  const t = tables(DB);
  const first = (t.test || []).filter(function (r) { return (r.script === NU || r.script === XI) && Number(r.tested) >= lastChange - 600; }).map(function (r) { return Number(r.tested); }).sort()[0];
  return (!!first && first >= lastChange + 1000) || false;
}, test.limit.quick);
test.run('there is one runner: nu\'s and xi\'s runs never overlap', 0.2, function () {
  const a = [starts('nu')[0], ends('nu')[0]], b = [starts('xi')[0], ends('xi')[0]];
  if (!a[0] || !a[1] || !b[0] || !b[1]) return false;
  return (a[1].at <= b[0].at || b[1].at <= a[0].at) || false;
}, test.limit.quick);
test.run('a suite flagged twice is owed one run: nu\'s own suite ran once', 0.2, async function () {
  await sleep(3000);
  return starts('nu').length === 1 || false;
}, test.limit.slow);
test.run('general tests run first: every general result for nu.js came before nu\'s own suite started', 0.2, function () {
  if (!up()) return false;
  const own0 = (starts('nu')[0] || {}).at;
  const gen = (tables(DB).test || []).filter(function (r) { return r.script === NU && r.suite !== NUS && Number(r.tested) >= lastChange; });
  return (!!own0 && gen.length > 0 && gen.every(function (r) { return Number(r.tested) < own0; })) || false;
}, test.limit.quick);
test.run('general suites run before a script\'s own suite, even when the own suite sorts first by name', 0.2, async function () {
  if (!up()) return false;
  await until(function () { return Promise.resolve(starts('early').length > 0); }, 120000);
  const own0 = (starts('early')[0] || {}).at;
  const gen = (tables(DB).test || []).filter(function (r) { return r.script === EARLY && r.suite !== EARLYS && Number(r.tested) >= lastChange; });
  return (!!own0 && gen.length > 0 && gen.every(function (r) { return Number(r.tested) < own0; })) || false;
}, test.limit.long);
test.run('a result carries both hashes it ran against, the script\'s and the suite\'s', 0.2, function () {
  if (!up()) return false;
  const t = tables(DB);
  const r = currentOf(t, NU, NUS, 'nu answers')[0], sc = scriptRow(t, NU), su = suiteRow(t, NU, NUS);
  return (!!r && !!sc && !!su && holds(r, sc.hash) && holds(r, su.hash)) || false;
}, test.limit.quick);

// THE RUN TIME ON THE SUITE ROW, AND THE ORDER IT GIVES (goal/G48.4; Andy: "we want the most results as quickly as possible",
// "do we time a test or a suite record the runtime?", "if we to, can those measurements contribute to returning more results
// faster?", "first we gather the date on a new suite-field (no testicle.db delete required?)", "we adjust prioritization at the
// same time?", then "go! test and build."; agreed under it: one column on the suite row, its last run's time; among suites
// owed alike, a red suite first, then the quickest; a suite never timed counts as quick). The column is read as the one number
// the suite row holds beside the ones it held before (cw's ms, 0 while never timed).
const OLD_SUITE_COLUMNS = ['script', 'suite', 'test', 'deleted', 'hash', 'outcome', 'changed', 'reason'];
const ranMs = function (row) { const k = row ? Object.keys(row).filter(function (c) { return OLD_SUITE_COLUMNS.indexOf(c) === -1; }) : []; return k.length === 1 && row[k[0]] !== null && row[k[0]] !== '' && Number.isFinite(Number(row[k[0]])) ? Number(row[k[0]]) : null; };
const SLOW = Z + 'zzAslow.js', SLOWS = Z + 'test/zzAslow.js', QUICK = Z + 'zzQuick.js', QUICKS = Z + 'test/zzQuick.js', REDS_ = Z + 'zzRedSuite.js', REDSS = Z + 'test/zzRedSuite.js';
const FRESH = Z + 'zzFresh.js', FRESHS = Z + 'test/zzFresh.js';
let orderFrom = 0;
test.run('a suite run keeps its time on its suite row: zzAslow\'s, which waits 3 s, holds 3000 ms or more, zzQuick\'s less', 0.4, async function () {
  if (!up()) return false;
  let t = null;
  const ok = await until(function () { t = tables(DB); const a = ranMs(suiteRow(t, SLOW, SLOWS)), b = ranMs(suiteRow(t, QUICK, QUICKS)); return Promise.resolve(a > 0 && b > 0); }, 280000);
  if (!ok) return false;
  const slow = ranMs(suiteRow(t, SLOW, SLOWS)), quick = ranMs(suiteRow(t, QUICK, QUICKS));
  return (slow >= 3000 && quick > 0 && quick < slow) || false;
}, test.limit.long);
test.run('zzRedSuite\'s own suite is red, and testicle is idle', 0.2, async function () {
  if (!up()) return false;
  const ok = await idle(280000);
  return (!!ok && (suiteRow(tables(DB), REDS_, REDSS) || {}).outcome === 'red') || false;
}, test.limit.long);
test.run('zzAslow, zzQuick and zzRedSuite change at once, and zzFresh, never run, is planted with them', 0.2, function () {
  if (!up()) return false;
  orderFrom = runlog().length;
  fs.mkdirSync(path.dirname(path.join(s.run, FRESHS)), { recursive: true });
  fs.writeFileSync(path.join(s.run, FRESH), "'use strict';\n// zzFresh\n");
  fs.writeFileSync(path.join(s.run, FRESHS), LOGGED('zzFresh', 0, ["test.run('zzFresh answers', 0.2, function () { return true; }, test.limit.quick);"]));
  append(SLOW, '// zzAslow, changed\n'); append(QUICK, '// zzQuick, changed\n'); append(REDS_, '// zzRedSuite, changed\n');
  return true;
}, test.limit.quick);
let order = [];
test.run('the four own suites each start once', 0.2, async function () {
  if (!up()) return false;
  const names = ['zzAslow', 'zzQuick', 'zzRedSuite', 'zzFresh'];
  const ok = await until(function () { const st = runlog().slice(orderFrom).filter(function (l) { return l.ev === 'start' && names.indexOf(l.suite) !== -1; }); order = st.map(function (l) { return l.suite; }); return Promise.resolve(names.every(function (n) { return order.indexOf(n) !== -1; })); }, 280000);
  return !!ok || false;
}, test.limit.long);
test.run('among suites owed alike, the red one runs first: zzRedSuite before zzAslow, zzQuick and zzFresh', 0.4, function () {
  return (order.length >= 4 && order.indexOf('zzRedSuite') === 0) || false;
}, test.limit.quick);
test.run('among green suites owed alike, the quicker runs first: zzQuick before zzAslow', 0.4, function () {
  return (order.indexOf('zzQuick') !== -1 && order.indexOf('zzAslow') !== -1 && order.indexOf('zzQuick') < order.indexOf('zzAslow')) || false;
}, test.limit.quick);
test.run('a suite never timed counts as quick: zzFresh runs before zzAslow', 0.4, function () {
  return (order.indexOf('zzFresh') !== -1 && order.indexOf('zzAslow') !== -1 && order.indexOf('zzFresh') < order.indexOf('zzAslow')) || false;
}, test.limit.quick);

// A change during a run: the run keeps the hashes it started with, and the suite comes round again behind it.
let piHash = '';
test.run('pi.js changes, and changes again while its own suite runs', 0.2, async function () {
  if (!up()) return false;
  append(PI, '// pi, changed\n');
  const ok = await until(function () { return Promise.resolve(starts('pi').length > 0); }, 240000);
  piHash = (scriptRow(tables(DB), PI) || {}).hash || '';
  append(PI, '// pi, changed during its run\n');
  return (!!ok && !!piHash) || false;
}, test.limit.long);
test.run('the running job is not killed by a change: pi\'s first run ends', 0.2, async function () {
  const ok = await until(function () { return Promise.resolve(ends('pi').length > 0); }, 30000);
  return !!ok || false;
}, test.limit.slow);
test.run('a result of that run carries the script\'s hash as it stood when the run started', 0.2, async function () {
  if (!up()) return false;
  let rows = [];
  await until(function () { rows = testRows(tables(DB), PI, PIS, 'pi answers'); return Promise.resolve(rows.some(function (r) { return holds(r, piHash); })); }, 20000);
  return rows.some(function (r) { return holds(r, piHash); }) || false;
}, test.limit.slow);
test.run('the suite comes round again behind it: pi\'s own suite runs a second time, after the first ended', 0.2, async function () {
  const ok = await until(function () { return Promise.resolve(starts('pi').length >= 2); }, 240000);
  const e1 = (ends('pi')[0] || {}).at, s2 = (starts('pi')[1] || {}).at;
  return (!!ok && !!e1 && s2 >= e1) || false;
}, test.limit.long);

// The 🏃‍♂️'s verb puts its suite at the head of the queue: tau, asked while omicron's suites wait, runs before omicron's own.
test.run('omicron.js changes, and tau\'s own suite is asked by testicle.run', 0.2, async function () {
  if (!up()) return false;
  append(OM, '// omicron, changed\n');
  await sleep(1500);
  const r = await call(N.base, 'testicle.run', { script: TAU, suite: TAUS });
  return r.status === 200 || false;
}, test.limit.slow);
test.run('a suite asked by testicle.run goes to the head of the queue: tau runs before omicron\'s own suite', 0.2, async function () {
  const ok = await until(function () { return Promise.resolve(ends('tau').length > 0 && starts('omicron').length > 0); }, 240000);
  const t = (starts('tau')[0] || {}).at, o = (starts('omicron')[0] || {}).at;
  return (!!ok && t < o) || false;
}, test.limit.long);
// A RUN THE PRESS STOPPED ENDED TOO (goal/G47.1, run.json: the press "stop[s] the run going unless it is that one"): a stopped
// suite never logs its end, so tau's start says which runs before it had logged no end and still had a process
// (LOGGED, `alive`); the pressed suite starts only once that run's process has exited.
test.run('there is never a second run beside the running one: tau started after every run before it ended', 0.2, function () {
  const t = starts('tau')[0];
  return (!!t && Array.isArray(t.alive) && !t.alive.length) || false;
}, test.limit.quick);

// Rows flagged when the server starts: upsilon.js flagged, the node stopped before the runner reached it, started again.
test.run('upsilon.js is flagged, and the node stops before upsilon\'s suite runs', 0.2, async function () {
  if (!up()) return false;
  append(UP, '// upsilon, changed\n');
  const ok = await until(function () { return Promise.resolve(yes((suiteRow(tables(DB), UP, UPS) || {}).test)); }, 5000);
  await stop(N.child);
  return (!!ok && !starts('upsilon').length) || false;
}, test.limit.slow);
// goal/G47.1, box v95, 5: the server is not always on, and its tables must not be stale for it. While the node is down: a
// new script and its own test written, a script changed, a suite removed, a script removed.
const NEWS = Z + 'zzsNew.js', NEWSS = Z + 'test/zzsNew.js';
let down = null;
test.run('while the node is down, a script and its suite are added, one changed, a suite and a script removed', 0.2, function () {
  // DOWN IS ENDED BY ANY MEANS (goal/G47.1): a process ended by a signal, as stop() ends it, keeps exitCode null and sets
  // signalCode, so exitCode alone read the stopped node as up and failed this world every time.
  if (!N || !N.child || (N.child.exitCode === null && N.child.signalCode === null)) return false;
  const t = tables(DB);
  const changed = scriptRow(t, LA), goneSuite = suiteRow(t, KA, KAS), goneScript = scriptRow(t, Z + 'gamma.js');
  if (!changed || !goneSuite || !goneScript) return false;
  put(NEWSS, SUITE_HEAD + "test.run('zzsNew answers', 0.2, function () { return true; }, test.limit.quick);\n");
  put(NEWS, '\'use strict\';\n// written while the node was down\n');
  append(LA, '// changed while the node was down\n');
  fs.rmSync(path.join(s.run, KAS));
  fs.rmSync(path.join(s.run, Z + 'gamma.js'));
  // The classifier itself changed while the node was down (Andy: "ON STARTUP THAT IS. IT MUST FUCKING START FUCKING
  // CLASSIFYING IN ANY MODE, RIGHT AT STARTUP"): at the start every script is classified again.
  append('spirit/test/scriptClassify.js', '// the classifier, changed while the node was down\n');
  down = { laHash: changed.hash, at: Date.now() };
  return true;
}, test.limit.quick);
test.run('with rows flagged when the server starts, the runner runs them by itself', 0.2, async function () {
  N = await boot(s.run); live.push(N.child);
  if (!up()) return false;
  const ok = await until(function () { return Promise.resolve(ends('upsilon').length > 0); }, 240000);
  return !!ok || false;
}, test.limit.long);
test.run('after the start, the classifier having changed while down, every live script is classified again, right away', 0.2, async function () {
  if (!down) return false;
  let left = [];
  const ok = await until(function () { const t = tables(DB); left = t.script.filter(function (r) { if (!no(r.deleted)) return false; const c = classifyRowAt(t, r.name); return !c || Number(c.tested) < down.at; }); return Promise.resolve(left.length === 0); }, 280000);
  return !!ok || false;
}, test.limit.long);
test.run('after the start, a script written while it was down has its row, and its own suite its suite row', 0.2, async function () {
  if (!down) return false;
  const ok = await until(function () { const t = tables(DB); return Promise.resolve(!!scriptRow(t, NEWS) && !!suiteRow(t, NEWS, NEWSS)); }, 60000);
  const t = tables(DB);
  return !!ok || false;
}, test.limit.long);
test.run('after the start, a script changed while it was down holds its new hash', 0.2, function () {
  if (!down) return false;
  const r = scriptRow(tables(DB), LA);
  return (!!r && r.hash !== down.laHash) || false;
}, test.limit.quick);
test.run('after the start, a suite removed while it was down is marked deleted, and none of its results is current', 0.2, function () {
  if (!down) return false;
  const t = tables(DB);
  const r = suiteRow(t, KA, KAS);
  const cur = (t.test || []).filter(function (x) { return x.script === KA && x.suite === KAS && yes(x.current); });
  return (!!r && yes(r.deleted) && cur.length === 0) || false;
}, test.limit.quick);
test.run('after the start, the search shows the removed suite\'s results no more', 0.2, async function () {
  if (!down) return false;
  const r = await call(N.base, 'testicle.testicle.search', { script: KA, suite: KAS, text: '' });
  const rows = found(r);
  return (r.status === 200 && rows.length === 0) || false;
}, test.limit.quick);
test.run('after the start, a script removed while it was down is marked deleted', 0.2, function () {
  if (!down) return false;
  const r = scriptRow(tables(DB), Z + 'gamma.js');
  return (!!r && yes(r.deleted)) || false;
}, test.limit.quick);

// A HANG FAILS AT ITS TEST'S OWN LIMIT (goal/G47.1: testicle's job limit is 120 minutes, cw's 3cf0379b on Andy's "make the
// limit 120 minutes"; Andy: "a single test still has the same limit!"): rho reports its first test, then hangs; sigma's
// first test hangs while its process is kept alive. Each hang has the quick limit (10 s): the reporter fails it there, long
// before testicle's own limit.
test.run('rho.js and sigma.js change', 0.2, async function () {
  if (!up()) return false;
  append(RHO, '// rho, changed\n');
  append(SIG, '// sigma, changed\n');
  const ok = await until(function () { return Promise.resolve(starts('rho').length > 0); }, 240000);
  return !!ok || false;
}, test.limit.long);
test.run('a test that hangs fails at its own limit: rho hangs is red, rho answers its first green', 0.2, async function () {
  if (!up()) return false;
  const ok = await until(function () { const t = tables(DB); const h = currentOf(t, RHO, RHOS, 'rho hangs')[0], f = currentOf(t, RHO, RHOS, 'rho answers its first')[0]; return Promise.resolve(!!h && no(h.verified) && !!f && yes(f.verified)); }, 120000);
  return !!ok || false;
}, test.limit.long);
test.run('rho\'s suite shows "still red"', 0.2, async function () {
  if (!up()) return false;
  // The hang fails at its limit, then the reporter ends the run and the job is judged: the status follows a moment later.
  let st = null;
  await until(function () { return statusOf(RHO, RHOS).then(function (x) { st = x; return x === 'still red'; }); }, 20000);
  return st === 'still red' || false;
}, test.limit.slow);
test.run('a suite whose only test hangs, its process kept alive, fails too: sigma\'s suite shows "still red"', 0.2, async function () {
  if (!up()) return false;
  let st = null;
  // sigma's own job comes after rho's; its hang fails at the quick limit, its process kept alive by an interval ended.
  const ok = await until(function () { return statusOf(SIG, SIGS).then(function (x) { st = x; return x === 'still red'; }); }, 180000);
  return !!ok || false;
}, test.limit.long);

// ── goal/G47.1, box v79, 2: interactive, the default ──
// "interactive: all actions and runs are controlled by the user through the UI or through api calls." "the server will
// flag changed suites AND scripts always, in both modes." 3: "a script seen for the first time starts with reClassify true".
const CHI = Z + 'chi.js', CHIS = Z + 'test/chi.js', PSI = Z + 'psi.js', PSIS = Z + 'test/psi.js';
let i1 = null;
test.run('interactive is set again, by preferences with interactive true', 0.2, async function () {
  if (!up()) return false;
  await idle(280000);
  const r = await call(N.base, 'testicle.preferences', { interactive: true });
  return (r.status === 200 && prefsOf(r).interactive === true) || false;
}, test.limit.long);
// goal/G47.1, box v94, 1: the server classifies a second after the last change, interactive or not; so reClassify true is
// read inside that quiet second, before the classifier clears it.
const SC = 'spirit/test/scriptClassify.js';
const quietRow = async function (name, notHash) { let row = null; await until(function () { row = scriptRow(tables(DB), name); return Promise.resolve(!!row && yes(row.reClassify) && (notHash === undefined || row.hash !== notHash)); }, 900); return row; };
test.run('in interactive mode, within a second of a script being written, it has its row, reClassify true, seen for the first time', 0.2, async function () {
  if (!up()) return false;
  // chi and psi, with their own tests, written now, while the server is interactive: chi's suite is run by a press, psi's
  // once the server is auto.
  put(CHIS, SUITE_HEAD + "test.run('chi answers', 0.2, function () { return true; }, test.limit.quick);\n");
  put(PSIS, SUITE_HEAD + "test.run('psi answers', 0.2, function () { return true; }, test.limit.quick);\n");
  put(CHI, '\'use strict\';\n// chi, written while interactive\n');
  put(PSI, '\'use strict\';\n// psi, written while interactive\n');
  const row = await quietRow(CHI);
  i1 = await after();
  return (!!row && yes(row.reClassify)) || false;
}, test.limit.slow);
test.run('in interactive mode, the new script\'s own suite is flagged needs running', 0.2, function () {
  if (!i1) return false;
  const r = suiteRow(i1, CHI, CHIS);
  return (!!r && yes(r.test)) || false;
}, test.limit.quick);
// Andy: "we specified that classification and file updates happen REGARDLESS of interactive or NOT."
test.run('in interactive mode, the server classifies by itself with no press: chi\'s reClassify turns false', 0.2, async function () {
  if (!i1) return false;
  const ok = await until(function () { const r = scriptRow(tables(DB), CHI); return Promise.resolve(!!r && no(r.reClassify)); }, 120000);
  return !!ok || false;
}, test.limit.long);
// WAITED FOR, NOT READ ONCE (goal/G47.1, Andy: "i don't need flaky things. FIX IT."): chi's reClassify clears when its class is
// set, and the classifier's suite row a moment later, when its suite.success lands; read at once, a busy machine showed it
// still flagged.
test.run('in interactive mode, the classifier\'s own suite row is no longer flagged for chi', 0.2, async function () {
  if (!i1) return false;
  const ok = await until(function () { const r = suiteRow(tables(DB), CHI, SC); return Promise.resolve(!!r && no(r.test)); }, 30000);
  return !!ok || false;
}, test.limit.slow);
test.run('in interactive mode, classification never sets both browserOnly and nodeOnly', 0.2, function () {
  if (!i1) return false;
  const both = i1.script.filter(function (r) { return yes(r.browserOnly) && yes(r.nodeOnly); });
  return both.length === 0 || false;
}, test.limit.quick);
test.run('in interactive mode, nothing runs by itself: five seconds on, the server is idle and no suite of chi or psi was run', 0.2, async function () {
  if (!i1) return false;
  await sleep(5000);
  const busy = await call(N.base, 'testicle.busy', {});
  const t = tables(DB);
  // The classifier runs by itself in both modes (box v94, 1); its own rows are not a run of chi's or psi's suites.
  const ran = (t.test || []).filter(function (r) { return (r.script === CHI || r.script === PSI) && r.suite !== SC; });
  const still = [suiteRow(t, CHI, CHIS), suiteRow(t, PSI, PSIS)].every(function (r) { return !!r && yes(r.test); });
  return ((busy.body === false || (busy.body && busy.body.busy === false)) && ran.length === 0 && still) || false;
}, test.limit.slow);
test.run('in interactive mode, a press of testicle.run runs that suite, and only it', 0.2, async function () {
  if (!i1) return false;
  const r = await call(N.base, 'testicle.run', { script: CHI, suite: CHIS });
  const done = await until(function () { return Promise.resolve(currentOf(tables(DB), CHI, CHIS, 'chi answers').length === 1); }, 60000);
  const psiRan = (tables(DB).test || []).filter(function (x) { return x.script === PSI && x.suite !== SC; }).length;
  return (r.status === 200 && !!done && psiRan === 0) || false;
}, test.limit.long);
test.run('in interactive mode, a script whose hash changes is flagged reClassify true again', 0.2, async function () {
  if (!i1) return false;
  const was = (scriptRow(tables(DB), CHI) || {}).hash;
  append(CHI, '// changed again\n');
  const row = await quietRow(CHI, was);
  return (!!row && row.hash !== was && yes(row.reClassify)) || false;
}, test.limit.slow);

// AFTER A START, STILL INTERACTIVE, WITH SUITES WAITING (Andy, after his node classified nothing until he turned interactive
// off: "wsl, make double sure you catch this with a test."; cw reproduced it from a copy of his tables: after a start
// nothing got classified). chi's and psi's suites are flagged and unrun; the node restarts, interactive kept; a script
// changed while it was down, and one changed after, are each classified with no press.
test.run('in interactive mode, with suites still waiting, the node stops, and chi changes while it is down', 0.2, async function () {
  if (!i1) return false;
  const waiting = [suiteRow(tables(DB), PSI, PSIS)].filter(function (r) { return !!r && yes(r.test); }).length;
  await stop(N.child);
  append(CHI, '// changed while the node was down, interactive\n');
  return waiting === 1 || false;
}, test.limit.slow);
// AS LONG AS THE REPORTER'S LONGEST LIMIT ALLOWS (goal/G47.1, Andy: "i don't need flaky things. FIX IT."): after a start the
// classifier boots a scratch node and Chrome before it judges anything; 120 s was too short for that on a busy machine, and
// turned this red with nothing wrong. 280 s, inside test.limit.long.
test.run('after the start, interactive still, a script changed while down is classified with no press', 0.2, async function () {
  N = await boot(s.run); live.push(N.child);
  if (!up()) return false;
  const p = prefsOf(await call(N.base, 'testicle.preferences', {}));
  if (p.interactive !== true) return false;
  const ok = await until(function () { const r = scriptRow(tables(DB), CHI); return Promise.resolve(!!r && no(r.reClassify)); }, 280000);
  return !!ok || false;
}, test.limit.long);
test.run('a script changed after the start is also classified with no press, within 30 seconds', 0.2, async function () {
  if (!up()) return false;
  append(PSI, '// changed after the start, interactive\n');
  await quietRow(PSI);
  const ok = await until(function () { const r = scriptRow(tables(DB), PSI); return Promise.resolve(!!r && no(r.reClassify)); }, 30000);
  return !!ok || false;
}, test.limit.slow);

// ── auto, set by the verb ──
let pAuto = null;
test.run('preferences with interactive false sets it, and answers them all', 0.2, async function () {
  if (!up()) return false;
  pAuto = await call(N.base, 'testicle.preferences', { interactive: false });
  return (pAuto.status === 200 && prefsOf(pAuto).interactive === false) || false;
}, test.limit.quick);
test.run('the interactive preference is kept in spirit/state/testicle/data/preferences.json', 0.2, function () {
  if (!pAuto) return false;
  const kept = readJson(PREFS());
  return (!!kept && kept.interactive === false) || false;
}, test.limit.quick);
test.run('preferences asked with nothing now answers interactive false', 0.2, async function () {
  if (!pAuto) return false;
  const r = await call(N.base, 'testicle.preferences', {});
  return prefsOf(r).interactive === false || false;
}, test.limit.quick);
test.run('in auto mode, the server processes everything by itself: psi\'s flagged suite is run', 0.2, async function () {
  if (!pAuto) return false;
  const done = await until(function () { return Promise.resolve(currentOf(tables(DB), PSI, PSIS, 'psi answers').length === 1); }, 240000);
  return !!done || false;
}, test.limit.long);
test.run('in auto mode, a changed script is still flagged reClassify true', 0.2, async function () {
  if (!pAuto) return false;
  append(PSI, '// changed while auto\n');
  const row = await quietRow(PSI);
  return (!!row && yes(row.reClassify)) || false;
}, test.limit.slow);
// The runs chi and psi queued (their general suites among them) are done before the checks after these begin.
test.run('the server is idle again after chi and psi', 0.2, async function () {
  if (!up()) return false;
  return !!(await idle(280000)) || false;
}, test.limit.long);

// ── goal/G47.1, box v94, 1: classification ──
// "every script is loaded twice, once as a node script and once in a page: a crash on the node for lack of a browser
// function (window, document): browser-only; a crash in the page for lack of a node function (require, fs, http, crypto,
// process): node-only; no crash in either: it runs on both, neither flag; a crash in both: unclassifyable, the red
// classifyable row." "the node side counts only a thrown error, by its reason; an exit with nothing thrown has loaded."
// "a load that is not complete in 3 seconds counts as crash/hang -> not classifyable." "its severity is 0.8." "the runner
// starts no other suite for a script whose classifyable row is red." "the testicle server continues classifying until all
// scripts are classified before moving to actual testing." 2: "node only scripts are tested by -general AND -node general
// tests. browser only scripts are tested by -general and -browser general tests. if a script is NOT browser only AND NOT
// node only, it will be tested by all 3 categories."
const ZC = {
  node: Z + 'zzcNode.js', page: Z + 'zzcPage.js', both: Z + 'zzcBoth.js',
  broken: Z + 'zzcBroken.js', hang: Z + 'zzcHang.js', exit: Z + 'zzcExit.js',
};
const ZC_SRC = {
  node: "'use strict';\nrequire('../../../../spirit.js');\nconst fs = require('fs');\nmodule.exports = { fs: typeof fs.readFileSync };\n",
  page: "'use strict';\ndocument.title = String(document.title);\nwindow.zzcPage = true;\n",
  both: "'use strict';\n(function (root) { var v = { both: true }; if (typeof module === 'object' && module && module.exports) module.exports = v; else root.zzcBoth = v; }(this));\n",
  broken: "'use strict';\nfunction ( {\n",
  hang: "'use strict';\nwhile (true) { /* never done */ }\n",
  exit: "'use strict';\nrequire('../../../../spirit.js');\nconsole.error('zzcExit: no --state; the node that starts this names its state folder');\nprocess.exit(2);\n",
};
const ownOf = function (rel) { return path.posix.join(path.posix.dirname(rel), 'test', path.posix.basename(rel)); };
const ownSuite = function (k) { return SUITE_HEAD + "test.run('" + k + " answers', 0.2, function () { return true; }, test.limit.quick);\n"; };
const classifyRow = function (t, name) { return currentOf(t, name, SC, 'it loads, so it can be classified')[0] || null; };
let zc = null, zcCleared = {};

test.run('the node lists the verb testicle.script.classify', 0.2, async function () {
  if (!up()) return false;
  const api = await call(N.base, 'api', { branch: 'testicle' });
  const iface = String((api.body && api.body.interface) || '');
  return /['"]script\.classify['"]\s*:/.test(iface) || false;
}, test.limit.quick);
test.run('testicle.script.classify sets a script\'s browserOnly and nodeOnly', 0.2, async function () {
  if (!up()) return false;
  // kappa.js: on disc, its row made long before, unchanged since (alpha.js was deleted by an earlier check).
  const r = await call(N.base, 'testicle.script.classify', { script: KA, browserOnly: true, nodeOnly: false });
  const row = scriptRow(tables(DB), KA);
  return (r.status === 200 && !!row && yes(row.browserOnly) && no(row.nodeOnly)) || false;
}, test.limit.quick);
// goal/G48.4, Q6, Andy: lists are "spirit.type.string.json": what a load pulled in comes as a list in JSON, and is taken.
test.run('testicle.script.classify takes what the load pulled in as a list in JSON', 0.4, async function () {
  if (!up()) return false;
  const r = await call(N.base, 'testicle.script.classify', { script: KA, browserOnly: true, nodeOnly: false, requires: JSON.stringify(['spirit/limits.js']) });
  return r.status === 200 || false;
}, test.limit.quick);
test.run('six scripts are written, each with its own test: node, page, both, broken, hang and exit', 0.2, async function () {
  if (!up()) return false;
  Object.keys(ZC).forEach(function (k) { put(ownOf(ZC[k]), ownSuite(k)); put(ZC[k], ZC_SRC[k]); });
  // Each one's classification seen as it happens: the moment its reClassify reads false.
  const t0c = Date.now();
  await until(function () {
    const t = tables(DB);
    Object.keys(ZC).forEach(function (k) { const r = scriptRow(t, ZC[k]); if (r && no(r.reClassify) && !zcCleared[k]) zcCleared[k] = Date.now(); });
    return Promise.resolve(Object.keys(ZC).every(function (k) { return !!zcCleared[k]; }));
  }, 120000, 100);
  zc = tables(DB);
  return Object.keys(zcCleared).length === 6 || false;
}, test.limit.long);
test.run('every one is classified by the server by itself: reClassify false on each', 0.2, function () {
  if (!zc) return false;
  const left = Object.keys(ZC).filter(function (k) { const r = scriptRow(zc, ZC[k]); return !r || !no(r.reClassify); });
  return left.length === 0 || false;
}, test.limit.quick);
test.run('a script that loads on the node and crashes in the page for lack of require is node-only', 0.2, function () {
  if (!zc) return false;
  const r = scriptRow(zc, ZC.node);
  return (!!r && yes(r.nodeOnly) && no(r.browserOnly)) || false;
}, test.limit.quick);
test.run('a script that crashes on the node for lack of document and loads in the page is browser-only', 0.2, function () {
  if (!zc) return false;
  const r = scriptRow(zc, ZC.page);
  return (!!r && yes(r.browserOnly) && no(r.nodeOnly)) || false;
}, test.limit.quick);
test.run('a script that loads in both runs on both: neither flag', 0.2, function () {
  if (!zc) return false;
  const r = scriptRow(zc, ZC.both);
  return (!!r && no(r.browserOnly) && no(r.nodeOnly)) || false;
}, test.limit.quick);
test.run('a script that exits on the node with nothing thrown has loaded there: an app server comes out node-only', 0.2, function () {
  if (!zc) return false;
  const r = scriptRow(zc, ZC.exit);
  return (!!r && yes(r.nodeOnly) && no(r.browserOnly)) || false;
}, test.limit.quick);
test.run('a script that crashes in both is not classifyable: its classifyable row is red, severity 0.8', 0.2, function () {
  if (!zc) return false;
  const r = classifyRow(zc, ZC.broken);
  return (!!r && no(r.verified) && Number(r.severity) === 0.8) || false;
}, test.limit.quick);
test.run('a load not complete in 3 seconds counts as a hang: not classifyable, its row red, severity 0.8', 0.2, function () {
  if (!zc) return false;
  const r = classifyRow(zc, ZC.hang);
  return (!!r && no(r.verified) && Number(r.severity) === 0.8) || false;
}, test.limit.quick);
test.run('a script classified has no red classifyable row', 0.2, function () {
  if (!zc) return false;
  const red = ['node', 'page', 'both', 'exit'].filter(function (k) { const r = classifyRow(zc, ZC[k]); return !zcCleared[k] || (!!r && no(r.verified)); });
  return red.length === 0 || false;
}, test.limit.quick);
test.run('each of the six scripts has a suite row of spirit/test/scriptClassify.js', 0.2, function () {
  if (!zc) return false;
  const none = Object.keys(ZC).filter(function (k) { return !suiteRow(zc, ZC[k], SC); });
  return none.length === 0 || false;
}, test.limit.quick);
// SHOWN ONLY WHERE THEY APPLY (Andy: "WSL, MAKE SURE SUITES DON'T SHOW UP WHEN THEY'RE NO APPLICATBLE TO A SCRIPT. NOW!!!!"):
// read as the script tab reads them, suite.search for the script, at once after it is classified, not after a run or a
// change. A -node general test applies to no browser-only script, a -browser one to no node-only script.
const shownKinds = async function (name) { return items(await call(N.base, 'testicle.suite.search', { script: name, text: '' })).map(function (i) { return (/-(general|node|browser)\.js$/.exec(suiteOf(i)) || [])[1]; }).filter(Boolean); };
test.run('at once after it is classified, a browser-only script\'s suite search shows no -node suite', 0.2, async function () {
  if (!zc) return false;
  const k = await shownKinds(ZC.page);
  return (k.indexOf('node') === -1 && k.indexOf('browser') !== -1) || false;
}, test.limit.quick);
test.run('at once after it is classified, a node-only script\'s suite search shows no -browser suite', 0.2, async function () {
  if (!zc) return false;
  const k = await shownKinds(ZC.node);
  return (k.indexOf('browser') === -1 && k.indexOf('node') !== -1) || false;
}, test.limit.quick);
test.run('after a restart, a classified script still shows only the suites that apply', 0.2, async function () {
  if (!zc) return false;
  await stop(N.child);
  N = await boot(s.run); live.push(N.child);
  if (!up()) return false;
  await sleep(3000);
  const kp = await shownKinds(ZC.page), kn = await shownKinds(ZC.node);
  return (kp.indexOf('node') === -1 && kn.indexOf('browser') === -1) || false;
}, test.limit.long);
// A RESULT OF A SUITE THAT DOES NOT APPLY (Andy: "MAKE SURE SUITES DON'T SHOW UP WHEN THEY'RE NO APPLICATBLE TO A SCRIPT";
// found on wsl's node, 2026-11-14: a -browser suite run by hand on two node-only scripts, relayServer.js and sseClient.js,
// reported to testicle, and their red rows stood current there for a day, though testicle never runs that suite on them):
// a result sent for a classified node-only script under a -browser suite is refused, and leaves no row.
test.run('a -browser result for a node-only script is refused, and no current row of it stands', 0.4, async function () {
  if (!zc) return false;
  const browserSuite = 'spirit/app/testicle/test/testicle-sibling-browser.js';
  const r = await call(N.base, 'testicle.testicle.set', { script: ZC.node, suite: browserSuite, test: 'zzc not applicable', verified: false, severity: 0.8 });
  await sleep(1000);
  const t = tables(DB);
  const rows = currentOf(t, ZC.node, browserSuite, 'zzc not applicable');
  const srow = suiteRow(t, ZC.node, browserSuite);
  const shown = (await shownKinds(ZC.node)).indexOf('browser') !== -1;
  return (r.status !== 200 && !rows.length && !(srow && no(srow.deleted)) && !shown) || false;
}, test.limit.slow);

test.run('classified first, tested after: each one\'s own suite reports only after its reClassify cleared', 0.2, async function () {
  if (!zc) return false;
  await until(function () { return Promise.resolve(['node', 'both', 'exit'].every(function (k) { return currentOf(tables(DB), ZC[k], ownOf(ZC[k]), k + ' answers').length === 1; })); }, 240000);
  const t = tables(DB);
  const early = ['node', 'both', 'exit'].filter(function (k) { const r = currentOf(t, ZC[k], ownOf(ZC[k]), k + ' answers')[0]; return !r || !zcCleared[k] || Number(r.tested) < zcCleared[k] - 500; });
  return early.length === 0 || false;
}, test.limit.long);
test.run('a script whose classifyable row is red is tested in no other way: no suite of broken or hang reports', 0.2, async function () {
  if (!zc) return false;
  await idle(240000);
  const t = tables(DB);
  const ran = (t.test || []).filter(function (r) { return (r.script === ZC.broken || r.script === ZC.hang) && r.suite !== SC; });
  return ran.length === 0 || false;
}, test.limit.long);

// THE CLASSIFIER CHANGED, EVERY SCRIPT CLASSIFIED AGAIN (Andy, on a script left not classifyable by the classifier before
// its fix: "wsl, note that and make sure this doesn't happen again."; cw: "when the classifier itself changes, every script
// is classified again"). A script that failed is tried again then, though it did not change itself.
let reTold = 0;
test.run('when the classifier changes, a script classified before reads reClassify true again', 0.2, async function () {
  if (!zc) return false;
  await idle(240000);
  reTold = Date.now();
  append(SC, '// the classifier, changed\n');
  const ok = await until(function () { const r = scriptRow(tables(DB), ZC.node); return Promise.resolve(!!r && yes(r.reClassify)); }, 2000);
  return !!ok || false;
}, test.limit.slow);
test.run('when the classifier changes, a script that failed is tried again, though it did not change: its classifyable row is tested anew', 0.2, async function () {
  if (!reTold) return false;
  const ok = await until(function () { const r = classifyRow(tables(DB), ZC.broken); return Promise.resolve(!!r && Number(r.tested) >= reTold); }, 240000);
  return !!ok || false;
}, test.limit.long);
// Switched to interactive while that classifying goes on (Andy: "AND IT FUCKING STOPS CLASSIFYING WHEN I GO BACK TO FUCKING
// ITERACTIVE MODE!!!!!!!!!!!!!!!!!!!"): it goes on, and ends, interactive.
test.run('testicle is switched to interactive while the classifying goes on', 0.2, async function () {
  if (!reTold) return false;
  const r = await call(N.base, 'testicle.preferences', { interactive: true });
  return (r.status === 200 && prefsOf(r).interactive === true) || false;
}, test.limit.quick);
test.run('each one is classified again in interactive mode with nothing pressed: reClassify is false on every one of the six', 0.2, async function () {
  if (!reTold) return false;
  let left = [];
  await until(function () { const t = tables(DB); left = Object.keys(ZC).filter(function (k) { const r = scriptRow(t, ZC[k]); return !r || !no(r.reClassify); }); return Promise.resolve(left.length === 0); }, 240000);
  return left.length === 0 || false;
}, test.limit.long);
test.run('auto is set again for the checks after', 0.2, async function () {
  if (!up()) return false;
  const r = await call(N.base, 'testicle.preferences', { interactive: false });
  return (r.status === 200 && prefsOf(r).interactive === false) || false;
}, test.limit.quick);

// 2: which general tests concern which scripts, by the flags.
const kinds = function (t, name) { return suiteRows(t, name).filter(function (r) { return !yes(r.deleted); }).map(function (r) { return (/-(general|node|browser)\.js$/.exec(r.suite) || [])[1]; }).filter(Boolean); };
test.run('a node-only script is tested by -general and -node general tests, and no -browser one', 0.2, function () {
  if (!zc) return false;
  const k = kinds(tables(DB), ZC.node);
  return (k.indexOf('general') !== -1 && k.indexOf('node') !== -1 && k.indexOf('browser') === -1) || false;
}, test.limit.quick);
test.run('a browser-only script is tested by -general and -browser general tests, and no -node one', 0.2, function () {
  if (!zc) return false;
  const k = kinds(tables(DB), ZC.page);
  return (k.indexOf('general') !== -1 && k.indexOf('browser') !== -1 && k.indexOf('node') === -1) || false;
}, test.limit.quick);
test.run('a script neither browser-only nor node-only is tested by all three kinds', 0.2, function () {
  if (!zc) return false;
  const k = kinds(tables(DB), ZC.both);
  return ['general', 'node', 'browser'].every(function (x) { return k.indexOf(x) !== -1; }) || false;
}, test.limit.quick);

// ── TESTICLE TURNED OFF AND ON, ITS TABLES OUT OF STEP WITH THE TREE (Andy: "WSL, make sure that testicle related test take
// into account that testicle can be de-activated and restarted with a database out of sync with the file-tree, this affect
// not only scriptClassifier, it affects every single table in testicle."; box v95, 5) ──
// Three planted scripts with their own tests, run while testicle is on. Then testicle is turned off (app.active, the node
// staying up), and while it is off: zzdA's own suite edited, one of its two tests gone; zzdB and its suite written; zzdC
// removed with its suite. Turned on again: script, suite and testicle tables each follow the tree.
const DA = Z + 'zzdA.js', DAS = Z + 'test/zzdA.js', DB_ = Z + 'zzdB.js', DBS = Z + 'test/zzdB.js', DC = Z + 'zzdC.js', DCS = Z + 'test/zzdC.js';
const twoTests = SUITE_HEAD + "test.run('zzdA answers one', 0.2, function () { return true; }, test.limit.quick);\ntest.run('zzdA answers two', 0.2, function () { return true; }, test.limit.quick);\n";
const askedUp = async function () { const r = await call(N.base, 'testicle.busy', {}); return r.status === 200; };
let off = null;
test.run('zzdA, zzdC and their own tests run while testicle is on', 0.2, async function () {
  if (!up()) return false;
  put(DAS, twoTests); put(DA, '\'use strict\';\n// zzdA\n');
  put(DCS, SUITE_HEAD + "test.run('zzdC answers', 0.2, function () { return true; }, test.limit.quick);\n"); put(DC, '\'use strict\';\n// zzdC\n');
  const ok = await until(function () { const t = tables(DB); return Promise.resolve(currentOf(t, DA, DAS, 'zzdA answers two').length === 1 && currentOf(t, DC, DCS, 'zzdC answers').length === 1); }, 280000);
  return !!ok || false;
}, test.limit.long);
test.run('testicle is turned off, the node staying up, and the tree changes under it', 0.2, async function () {
  if (!up()) return false;
  const r = await call(N.base, 'app.active', { key: 'testicle', active: false });
  const gone = await until(function () { return askedUp().then(function (a) { return !a; }); }, 30000);
  if (!gone) return false;
  off = { aSuite: (suiteRow(tables(DB), DA, DAS) || {}).hash };
  put(DAS, SUITE_HEAD + "test.run('zzdA answers one', 0.2, function () { return true; }, test.limit.quick);\n// its second test gone, while testicle was off\n");
  put(DBS, SUITE_HEAD + "test.run('zzdB answers', 0.2, function () { return true; }, test.limit.quick);\n"); put(DB_, '\'use strict\';\n// zzdB, written while testicle was off\n');
  fs.rmSync(path.join(s.run, DCS)); fs.rmSync(path.join(s.run, DC));
  return true;
}, test.limit.slow);
test.run('turned on again, testicle answers', 0.2, async function () {
  if (!off) return false;
  await call(N.base, 'app.active', { key: 'testicle', active: true });
  return !!(await until(askedUp, 60000)) || false;
}, test.limit.slow);
test.run('the script table follows: zzdB written while off has its row, zzdC removed while off is deleted', 0.2, async function () {
  if (!off) return false;
  const ok = await until(function () { const t = tables(DB); const b = scriptRow(t, DB_), c = scriptRow(t, DC); return Promise.resolve(!!b && no(b.deleted) && !!c && yes(c.deleted)); }, 120000);
  const t = tables(DB);
  return !!ok || false;
}, test.limit.long);
test.run('the suite table follows: zzdB\'s own suite has its row, zzdA\'s edited suite its new hash, zzdC\'s removed suite is deleted', 0.2, function () {
  if (!off) return false;
  const t = tables(DB);
  const b = suiteRow(t, DB_, DBS), a = suiteRow(t, DA, DAS), c = suiteRow(t, DC, DCS);
  return (!!b && no(b.deleted) && !!a && a.hash !== off.aSuite && !!c && yes(c.deleted)) || false;
}, test.limit.quick);
test.run('the testicle table follows: zzdC\'s results are no longer current', 0.2, function () {
  if (!off) return false;
  const cur = (tables(DB).test || []).filter(function (r) { return r.script === DC && r.suite === DCS && yes(r.current); });
  return cur.length === 0 || false;
}, test.limit.quick);
test.run('once zzdA\'s edited suite has run again, the test it lost is no longer current', 0.2, async function () {
  if (!off) return false;
  const ok = await until(function () { const t = tables(DB); const one = currentOf(t, DA, DAS, 'zzdA answers one')[0]; return Promise.resolve(!!one && String(one.suiteHash || '') === String((suiteRow(t, DA, DAS) || {}).hash) && currentOf(t, DA, DAS, 'zzdA answers two').length === 0); }, 280000);
  const t = tables(DB);
  return !!ok || false;
}, test.limit.long);

// ── EVERY GENERAL TEST TAKES A LIST (box v94, 2: "with no script-argument, they will process all applicable scripts. else it
// will process all scripts listed in the arguments that fit"; Andy: "general tests ALL must accept a list as an argument,
// RIGHT?"). In the scratch tree, two scripts that each break the rules; each general test is handed both, and its answer
// names both: the second is judged as the first is.
const LA1 = Z + 'zzlOne.js', LA2 = Z + 'zzlTwo.js';
const BROKEN = "// no 'use strict', a plain require before spirit.js, and a throw at load\nconst zzFs = require('fs');\nthrow new Error('zzl broken at load ' + typeof zzFs);\n";
const generalRun = function (suite, files) {
  try { return execFileSync(process.execPath, [suite].concat(files), { cwd: s.run, encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { return String((e && e.stdout) || '') + String((e && e.stderr) || ''); }
};
// A script red in the run's print: a red line (its title and ❌) under that script's heading (spirit/test/testReport.js).
const redUnder = function (out, name) { let under = false; return String(out).split('\n').some(function (l) { if (!/[✅❌]\s*$/.test(l)) { under = l.indexOf(name) !== -1; return false; } return under && /❌\s*$/.test(l); }); };
const namesBoth = function (out) { return { one: redUnder(out, 'zzlOne.js'), two: redUnder(out, 'zzlTwo.js') }; };
let listed = false;
test.run('two broken scripts are written in the scratch tree', 0.2, function () {
  if (!s) return false;
  put(LA1, BROKEN); put(LA2, BROKEN);
  listed = true;
  return true;
}, test.limit.quick);
const bothNamed = function (suite) {
  if (!listed) return false;
  const out = generalRun(suite, [LA1, LA2]);
  const b = namesBoth(out);
  return (b.one && b.two) || false;
};
test.run('testicle-sibling-general.js, handed both broken scripts, names both', 0.4, function () { return bothNamed('spirit/app/testicle/test/testicle-sibling-general.js'); }, test.limit.long);
test.run('testicle-sibling-node.js, handed both broken scripts, names both', 0.4, function () { return bothNamed('spirit/app/testicle/test/testicle-sibling-node.js'); }, test.limit.long);
test.run('testicle-sibling-browser.js, handed both broken scripts, names both', 0.4, function () { return bothNamed('spirit/app/testicle/test/testicle-sibling-browser.js'); }, test.limit.long);

// ── THE SERVER HANDS A GENERAL TEST A LIST (Andy: "WSL, write the reds for the server half of passing a list to general
// tests."; box v94, 2: "else it will process all scripts listed in the arguments that fit"): one run of a general test for
// every script of it that is owed one, not one run per script. A planted folder, spirit/app/testicle/temp/zzBatch/, with its own general tests
// of the three kinds, each logging the scripts it was handed, and three scripts: one browser-only, one node-only, one both.
const BZ = 'spirit/app/testicle/temp/zzBatch/';
const BA = BZ + 'zzbPage.js', BB = BZ + 'zzbNode.js', BC = BZ + 'zzbBoth.js';
const BATCH_SUITE = function (kind) {
  return "'use strict';\nconst path = require('path');\nconst test = require(path.join(__dirname, '..', '..', '..', '..', '..', 'test', 'testReport.js'));\n" +
    "const LOG = path.join(__dirname, '..', '..', '..', '..', '..', '..', '..', '..', 'runlog.txt');\n" +
    "const given = process.argv.slice(2).filter(function (a, i, all) { return a.indexOf('--') !== 0 && all[i - 1] !== '--test'; });\n" +
    "require('fs').appendFileSync(LOG, JSON.stringify({ suite: 'zzBatch-" + kind + "', ev: 'start', given: given, at: Date.now() }) + '\\n');\n" +
    "test.run('zzBatch " + kind + " answers', 0.2, function () { return true; }, test.limit.quick);\n";
};
const batchRuns = function (kind) { return runlog().filter(function (l) { return l.suite === 'zzBatch-' + kind && l.ev === 'start'; }); };
const sameSet = function (a, b) { return JSON.stringify((a || []).slice().sort()) === JSON.stringify((b || []).slice().sort()); };
let batched = false, batchFrom = 0;
test.run('spirit/app/testicle/temp/zzBatch/ is planted with its three kinds of general test and three scripts, classified and run once', 0.2, async function () {
  if (!up()) return false;
  put(BZ + 'zzBatch.js', '\'use strict\';\n// zzBatch\n');
  put(BA, '\'use strict\';\ndocument.title = String(document.title);\n');
  put(BB, '\'use strict\';\nrequire(\'../../../../spirit.js\');\nconst fs = require(\'fs\');\nmodule.exports = { fs: typeof fs.readFileSync };\n');
  put(BC, '\'use strict\';\n(function (root) { var v = { both: true }; if (typeof module === \'object\' && module && module.exports) module.exports = v; else root.zzbBoth = v; }(this));\n');
  ['general', 'node', 'browser'].forEach(function (k) { put(BZ + 'test/zzBatch-sibling-' + k + '.js', BATCH_SUITE(k)); });
  const ok = await until(function () { const t = tables(DB); return Promise.resolve([BA, BB, BC].every(function (f) { const r = scriptRow(t, f); return !!r && no(r.reClassify); })); }, 280000);
  await idle(280000);
  batched = !!ok;
  return batched || false;
}, test.limit.long);
test.run('with three scripts changed in one quiet second, the -general test runs once, handed all three', 0.4, async function () {
  if (!batched) return false;
  batchFrom = runlog().length;
  [BA, BB, BC].forEach(function (f) { append(f, '// changed together\n'); });
  await until(function () { return Promise.resolve(runlog().slice(batchFrom).some(function (l) { return l.suite === 'zzBatch-general'; })); }, 280000);
  await idle(280000);
  const runs = runlog().slice(batchFrom).filter(function (l) { return l.suite === 'zzBatch-general' && l.ev === 'start'; });
  return (runs.length === 1 && sameSet(runs[0].given, [BA, BB, BC])) || false;
}, test.limit.long);
test.run('the -node test then runs once, handed the two that run on the node, never the browser-only one', 0.4, function () {
  if (!batched) return false;
  const runs = runlog().slice(batchFrom).filter(function (l) { return l.suite === 'zzBatch-node' && l.ev === 'start'; });
  return (runs.length === 1 && sameSet(runs[0].given, [BB, BC])) || false;
}, test.limit.quick);
test.run('the -browser test then runs once, handed the two that run in a page, never the node-only one', 0.4, function () {
  if (!batched) return false;
  const runs = runlog().slice(batchFrom).filter(function (l) { return l.suite === 'zzBatch-browser' && l.ev === 'start'; });
  return (runs.length === 1 && sameSet(runs[0].given, [BA, BC])) || false;
}, test.limit.quick);
test.run('with one script changed later, the -general test runs once, handed that one', 0.4, async function () {
  if (!batched) return false;
  const from = runlog().length;
  append(BC, '// changed alone\n');
  await until(function () { return Promise.resolve(runlog().slice(from).some(function (l) { return l.suite === 'zzBatch-general'; })); }, 280000);
  await idle(280000);
  const runs = runlog().slice(from).filter(function (l) { return l.suite === 'zzBatch-general' && l.ev === 'start'; });
  return (runs.length === 1 && sameSet(runs[0].given, [BC])) || false;
}, test.limit.long);
test.run('a press in a script tab still runs a general test for that one script', 0.4, async function () {
  if (!batched) return false;
  const from = runlog().length;
  const press = await call(N.base, 'testicle.run', { script: BB, suite: BZ + 'test/zzBatch-sibling-general.js' });
  await until(function () { return Promise.resolve(runlog().slice(from).some(function (l) { return l.suite === 'zzBatch-general'; })); }, 120000);
  const runs = runlog().slice(from).filter(function (l) { return l.suite === 'zzBatch-general' && l.ev === 'start'; });
  return (press.status === 200 && runs.length === 1 && sameSet(runs[0].given, [BB])) || false;
}, test.limit.long);

// ── A FIX OF A TOP RED RUNS FIRST (goal/G47.1, box v128: "a change to one of the 10 scripts holding the most severe current
// reds (each script counted once, not each test row) stops the running suite and runs that script's red suites first; the
// stopped run goes back flagged, its results untouched; any other change waits its turn"; Andy: "if the changed file is not
// a top 10 fix, the run may as well continue...."). A planted folder, spirit/app/testicle/temp/zzTop/: zzLong's own suite waits 40 s before its
// one test; zzRed's own suite fails at 0.9, the most severe red of the scratch world; zzCalm's passes, no red. Each logs its
// start and end to runlog.txt. A STOPPED RUN CLEANS UP (goal/G48.4; Andy: "WHY THE FUCK ARE TEST RUNS STILL LITTERING
// SHIT ALL OVER THE PLACE"): testicle asks it to stop, so it runs its test.after and logs its end at once, long before its
// 40 s are up; once it was killed outright and logged none.
const TZ = 'spirit/app/testicle/temp/zzTop/';
const TLONG = TZ + 'zzLong.js', TLONGS = TZ + 'test/zzLong.js', TRED = TZ + 'zzRed.js', TREDS = TZ + 'test/zzRed.js', TCALM = TZ + 'zzCalm.js', TCALMS = TZ + 'test/zzCalm.js';
const TOP_LOG = "const LOG = path.join(__dirname, '..', '..', '..', '..', '..', '..', '..', '..', 'runlog.txt');\n" +
  "function log(name, ev) { require('fs').appendFileSync(LOG, JSON.stringify({ suite: name, ev: ev, at: Date.now() }) + '\\n'); }\n";
let topWorld = false, longBefore = null, redChanged = 0, longStart = 0;
test.run('spirit/app/testicle/temp/zzTop/ is planted with a long suite, a suite red at 0.9 and a green one, each run once', 0.2, async function () {
  if (!up()) return false;
  put(TLONG, '\'use strict\';\n// zzLong\n');
  put(TRED, '\'use strict\';\n// zzRed\n');
  put(TCALM, '\'use strict\';\n// zzCalm\n');
  put(TLONGS, SUITE_HEAD + TOP_LOG + "log('zzLong', 'start');\n" +
    "test.run('zzLong waits 40 s before its checks', 0.2, function () { return new Promise(function (r) { setTimeout(function () { r(true); }, 40000); }); }, test.limit.slow);\n" +
    "test.run('zzLong answers', 0.2, function () { return true; }, test.limit.quick);\ntest.after(function () { log('zzLong', 'end'); });\n");
  put(TREDS, SUITE_HEAD + TOP_LOG + "log('zzRed', 'start');\n" +
    "test.run('zzRed fails', 0.9, function () { return false; }, test.limit.quick);\ntest.after(function () { log('zzRed', 'end'); });\n");
  put(TCALMS, SUITE_HEAD + TOP_LOG + "log('zzCalm', 'start');\n" +
    "test.run('zzCalm answers', 0.2, function () { return true; }, test.limit.quick);\ntest.after(function () { log('zzCalm', 'end'); });\n");
  const ok = await until(function () { const t = tables(DB); return Promise.resolve(currentOf(t, TRED, TREDS, 'zzRed fails').length > 0 && currentOf(t, TLONG, TLONGS, 'zzLong answers').length > 0 && currentOf(t, TCALM, TCALMS, 'zzCalm answers').length > 0); }, 280000);
  await idle(280000);
  const red = currentOf(tables(DB), TRED, TREDS, 'zzRed fails')[0];
  topWorld = !!ok && !!red && no(red.verified) && Number(red.severity) === 0.9;
  return topWorld || false;
}, test.limit.long);
test.run('zzLong.js changes, and zzRed.js changes while zzLong\'s own suite runs', 0.2, async function () {
  if (!topWorld) return false;
  longBefore = currentOf(tables(DB), TLONG, TLONGS, 'zzLong answers')[0] || null;
  const from = starts('zzLong').length;
  append(TLONG, '// zzLong, changed\n');
  const ok = await until(function () { return Promise.resolve(starts('zzLong').length > from); }, 280000);
  longStart = (starts('zzLong')[from] || {}).at || 0;
  await sleep(2000);
  append(TRED, '// zzRed, fixed\n');
  redChanged = Date.now();
  return (!!ok && !!longStart) || false;
}, test.limit.long);
test.run('stopped for a top red, zzLong\'s suite cleans up: its end is logged before its 40 s and before zzRed starts', 0.4, async function () {
  if (!redChanged) return false;
  await until(function () { return Promise.resolve(runlog().some(function (l) { return l.suite === 'zzRed' && l.ev === 'start' && l.at >= redChanged; })); }, 120000);
  const done = ends('zzLong').filter(function (l) { return l.at >= longStart; })[0];
  const redAt = (runlog().filter(function (l) { return l.suite === 'zzRed' && l.ev === 'start' && l.at >= redChanged; })[0] || {}).at;
  return (!!done && !!redAt && done.at >= redChanged && done.at < longStart + 39000 && done.at <= redAt) || false;
}, test.limit.long);
test.run('the changed script\'s red suite runs first: zzRed\'s own suite starts within 30 s of its change, before zzLong\'s 40 s were up', 0.4, function () {
  if (!redChanged) return false;
  const redAt = (runlog().filter(function (l) { return l.suite === 'zzRed' && l.ev === 'start' && l.at >= redChanged; })[0] || {}).at;
  return (!!redAt && redAt - redChanged <= 30000 && redAt < longStart + 40000) || false;
}, test.limit.quick);
test.run('the stopped run\'s results are untouched: zzLong\'s current row is the one from before', 0.4, function () {
  if (!longBefore) return false;
  const now = currentOf(tables(DB), TLONG, TLONGS, 'zzLong answers')[0] || null;
  const redAt = (runlog().filter(function (l) { return l.suite === 'zzRed' && l.ev === 'start' && l.at >= redChanged; })[0] || {}).at || Date.now();
  const touched = !!now && Number(now.tested) !== Number(longBefore.tested) && Number(now.tested) < redAt;
  return (!!now && !touched) || false;
}, test.limit.quick);
test.run('the stopped run goes back flagged: zzLong\'s own suite runs again, after zzRed\'s', 0.4, async function () {
  if (!redChanged) return false;
  // The stopped run logs an end of its own as it cleans up (the check above), so the wait is for a start after zzRed's.
  const redAt = function () { return (runlog().filter(function (l) { return l.suite === 'zzRed' && l.ev === 'start' && l.at >= redChanged; })[0] || {}).at; };
  const again = await until(function () { const r = redAt(); return Promise.resolve(!!r && runlog().some(function (l) { return l.suite === 'zzLong' && l.ev === 'start' && l.at > r; })); }, 280000);
  return !!again || false;
}, test.limit.long);
let calmChanged = 0, longStart2 = 0;
test.run('zzLong.js changes again, and zzCalm.js, holding no red, changes while zzLong\'s own suite runs', 0.2, async function () {
  if (!topWorld) return false;
  await idle(280000);
  const from = starts('zzLong').length;
  append(TLONG, '// zzLong, changed again\n');
  const ok = await until(function () { return Promise.resolve(starts('zzLong').length > from); }, 280000);
  longStart2 = (starts('zzLong')[from] || {}).at || 0;
  await sleep(2000);
  append(TCALM, '// zzCalm, changed\n');
  calmChanged = Date.now();
  return (!!ok && !!longStart2) || false;
}, test.limit.long);
test.run('any other change waits its turn: zzLong\'s run ends with its end, and zzCalm\'s own suite starts after it', 0.4, async function () {
  if (!calmChanged) return false;
  const ok = await until(function () { return Promise.resolve(runlog().some(function (l) { return l.suite === 'zzCalm' && l.ev === 'start' && l.at >= calmChanged; })); }, 280000);
  const done = ends('zzLong').filter(function (l) { return l.at >= longStart2; })[0];
  const calmAt = (runlog().filter(function (l) { return l.suite === 'zzCalm' && l.ev === 'start' && l.at >= calmChanged; })[0] || {}).at;
  return (!!ok && !!done && !!calmAt && calmAt >= done.at) || false;
}, test.limit.long);

// ── A TEST A WHOLE RUN NO LONGER REPORTS STOPS BEING CURRENT (goal/G47.1, cleaning; cw, reading Andy's testicle: backup/api.js's
// -browser rerun reported 3 tests green and skipped the 17 element checks, "but their red rows from 19:07 stay current, nobody
// retires them, and the suite stays \"still red\"", "after a whole run (no title, not stopped, not killed), a test of that
// script and suite the run did not report is no longer current"). A planted spirit/app/testicle/temp/zzStale/: its own suite reports "stale
// one" green and "stale two" red; then it is rewritten to report "stale one" alone.
const SZ = 'spirit/app/testicle/temp/zzStale/zzStale.js', SZS = 'spirit/app/testicle/temp/zzStale/test/zzStale.js';
let staleWorld = false;
test.run('spirit/app/testicle/temp/zzStale/ is planted, its own suite reporting one test green and one red, and run once', 0.2, async function () {
  if (!up()) return false;
  put(SZ, '\'use strict\';\n// zzStale\n');
  put(SZS, SUITE_HEAD + "test.run('stale one', 0.2, function () { return true; }, test.limit.quick);\ntest.run('stale two', 0.2, function () { return false; }, test.limit.quick);\n");
  const ok = await until(function () { const t = tables(DB); return Promise.resolve(currentOf(t, SZ, SZS, 'stale one').length > 0 && currentOf(t, SZ, SZS, 'stale two').length > 0); }, 280000);
  await idle(280000);
  staleWorld = !!ok;
  return staleWorld || false;
}, test.limit.long);
test.run('a run with a title retires nothing: after testicle.run of "stale one" alone, "stale two" is still current', 0.4, async function () {
  if (!staleWorld) return false;
  const before = currentOf(tables(DB), SZ, SZS, 'stale one')[0];
  const r = await call(N.base, 'testicle.run', { script: SZ, suite: SZS, testicle: 'stale one' });
  await until(function () { const now = currentOf(tables(DB), SZ, SZS, 'stale one')[0]; return Promise.resolve(!!now && !!before && Number(now.tested) > Number(before.tested)); }, 120000);
  await idle(120000);
  return (r.status === 200 && currentOf(tables(DB), SZ, SZS, 'stale two').length > 0) || false;
}, test.limit.long);
// A CRASHED RUN ERASES NOTHING (goal/G47.4, the box: "killed or crashed run of a script/suite deletes no testicle rows"):
// rewritten to report "stale one" and then a test whose body throws, so the run ends crashed, "stale two" unreported.
test.run('zzStale\'s suite is rewritten to report "stale one", then crash, and run whole', 0.2, async function () {
  if (!staleWorld) return false;
  const before = currentOf(tables(DB), SZ, SZS, 'stale one')[0];
  put(SZS, SUITE_HEAD + "test.run('stale one', 0.2, function () { return true; }, test.limit.quick);\ntest.run('stale boom', 0.2, function () { throw new Error('boom'); }, test.limit.quick);\n");
  const ok = await until(function () { const now = currentOf(tables(DB), SZ, SZS, 'stale one')[0]; return Promise.resolve(!!now && !!before && Number(now.tested) > Number(before.tested)); }, 280000);
  await idle(280000);
  return !!ok || false;
}, test.limit.long);
test.run('after a crashed run, a test it did not report keeps its rows: "stale two" is still there', 0.4, function () {
  if (!staleWorld) return false;
  return (tables(DB).test || []).some(function (r) { return r.script === SZ && r.suite === SZS && r.test === 'stale two'; }) || false;
}, test.limit.quick);
// A COMPLETED RUN ERASES WHAT IT DID NOT REPORT (goal/G47.4, the box: "titles that did not report for a completed run of a
// script/suite combination, will be completely erased from the data base"): every row of them, history too.
test.run('zzStale\'s suite is rewritten to report "stale one" alone, and run whole', 0.2, async function () {
  if (!staleWorld) return false;
  const before = currentOf(tables(DB), SZ, SZS, 'stale one')[0];
  put(SZS, SUITE_HEAD + "test.run('stale one', 0.2, function () { return true; }, test.limit.quick);\n");
  const ok = await until(function () { const now = currentOf(tables(DB), SZ, SZS, 'stale one')[0]; return Promise.resolve(!!now && !!before && Number(now.tested) > Number(before.tested)); }, 280000);
  await idle(280000);
  return !!ok || false;
}, test.limit.long);
test.run('after a completed run, a test it did not report has no row at all: "stale two" and "stale boom" are erased', 0.4, function () {
  if (!staleWorld) return false;
  const left = (tables(DB).test || []).filter(function (r) { return r.script === SZ && r.suite === SZS && (r.test === 'stale two' || r.test === 'stale boom'); });
  return !left.length || false;
}, test.limit.quick);
test.run('the suite\'s status follows the tests it now has: zzStale\'s own suite shows "green"', 0.4, async function () {
  if (!staleWorld) return false;
  const st = await statusOf(SZ, SZS);
  return st === 'green' || false;
}, test.limit.quick);

// ── testicle.suite.success (goal/G47.1, box v129: "the reporter reports a suite's success or failure for a script through
// the new verb testicle.suite.success {script, suite, success} ... the server sets that suite row from it at once (outcome,
// flag cleared), no summing of test rows"; Andy: "cw, replace the last tweark with the reporter reporting fucking
// success/failure of the suite through a new verb testicle.suite.success"). A planted spirit/app/testicle/temp/zzSucc/ whose suite is
// flagged by a change, then told by the verb, inside the runner's quiet second.
const SUC = 'spirit/app/testicle/temp/zzSucc/zzSucc.js', SUCS = 'spirit/app/testicle/temp/zzSucc/test/zzSucc.js';
let succWorld = false;
test.run('the node lists the verb testicle.suite.success', 0.4, async function () {
  if (!up()) return false;
  const api = await call(N.base, 'api', { branch: 'testicle' });
  const iface = String((api.body && api.body.interface) || '');
  return /['"]suite\.success['"]\s*:/.test(iface) || false;
}, test.limit.quick);
test.run('spirit/app/testicle/temp/zzSucc/ is planted with its own suite and run once', 0.2, async function () {
  if (!up()) return false;
  put(SUC, '\'use strict\';\n// zzSucc\n');
  put(SUCS, SUITE_HEAD + "test.run('zzSucc answers', 0.2, function () { return true; }, test.limit.quick);\n");
  const ok = await until(function () { return Promise.resolve(currentOf(tables(DB), SUC, SUCS, 'zzSucc answers').length > 0); }, 280000);
  await idle(280000);
  succWorld = !!ok;
  return succWorld || false;
}, test.limit.long);
test.run('testicle.suite.success with success false sets that suite row at once: its outcome red, its flag cleared', 0.4, async function () {
  if (!succWorld) return false;
  append(SUCS, '// changed, so flagged\n');
  await until(function () { return Promise.resolve(yes((suiteRow(tables(DB), SUC, SUCS) || {}).test)); }, 900);
  const r = await call(N.base, 'testicle.suite.success', { script: SUC, suite: SUCS, success: false });
  const row = suiteRow(tables(DB), SUC, SUCS);
  return (r.status === 200 && !!row && row.outcome === 'red' && no(row.test)) || false;
}, test.limit.quick);
test.run('testicle.suite.success with success true sets it green, at once, whatever its test rows say', 0.4, async function () {
  if (!succWorld) return false;
  const r = await call(N.base, 'testicle.suite.success', { script: SUC, suite: SUCS, success: true });
  const row = suiteRow(tables(DB), SUC, SUCS);
  return (r.status === 200 && !!row && row.outcome === 'green' && no(row.test)) || false;
}, test.limit.quick);
// goal/G48.4, Q6: what the suite pulled in comes as a list in JSON, and is taken.
test.run('testicle.suite.success takes what the suite pulled in as a list in JSON', 0.4, async function () {
  if (!succWorld) return false;
  const r = await call(N.base, 'testicle.suite.success', { script: SUC, suite: SUCS, success: true, requires: JSON.stringify(['spirit/limits.js']) });
  return r.status === 200 || false;
}, test.limit.quick);

// ── AN ABORTED RUN RE-ASSEMBLED (goal/G47.1, box v130: "a run aborted (stopped or killed): the server RE-ASSEMBLES a new run
// at once, fresh from the flags as they stand: every script that reported its success is done and left out, the new run
// holds only the rest"). A planted spirit/app/testicle/temp/zzRe/ with a -general test of its own that logs the scripts it is handed and judges
// them in turn: zzReA at once, zzReB after 20 s. The batch is stopped while it waits on zzReB, by a press of another suite.
const RZ = 'spirit/app/testicle/temp/zzRe/';
const RA = RZ + 'zzReA.js', RB = RZ + 'zzReB.js', RC = RZ + 'zzReC.js', RGEN = RZ + 'test/zzRe-sibling-general.js';
const RE_SUITE = "'use strict';\nconst path = require('path');\nconst test = require(path.join(__dirname, '..', '..', '..', '..', '..', 'test', 'testReport.js'));\n" +
  "const LOG = path.join(__dirname, '..', '..', '..', '..', '..', '..', '..', '..', 'runlog.txt');\n" +
  "const given = process.argv.slice(2).filter(function (a, i, all) { return a.indexOf('--') !== 0 && all[i - 1] !== '--test'; });\n" +
  "require('fs').appendFileSync(LOG, JSON.stringify({ suite: 'zzRe-general', ev: 'start', given: given, at: Date.now() }) + '\\n');\n" +
  "given.forEach(function (f) { test.forScript(f, function () { test.run('zzRe holds', 0.2, function () { return /zzReB/.test(f) ? new Promise(function (r) { setTimeout(function () { r(true); }, 20000); }) : true; }, test.limit.slow); }); });\n";
const reRuns = function () { return runlog().filter(function (l) { return l.suite === 'zzRe-general' && l.ev === 'start'; }); };
let reWorld = false, reFrom = 0;
test.run('spirit/app/testicle/temp/zzRe/ is planted with its own -general test and three scripts, and run once', 0.2, async function () {
  if (!up()) return false;
  put(RZ + 'zzRe.js', '\'use strict\';\n// zzRe\n');
  [RA, RB, RC].forEach(function (f) { put(f, '\'use strict\';\n// ' + f + '\n'); });
  put(RGEN, RE_SUITE);
  const ok = await until(function () { return Promise.resolve(reRuns().length > 0); }, 280000);
  await idle(280000);
  reWorld = !!ok;
  return reWorld || false;
}, test.limit.long);
test.run('zzReA, zzReB and zzReC change, and while the batch waits on zzReB, another suite is pressed', 0.2, async function () {
  if (!reWorld) return false;
  reFrom = reRuns().length;
  [RA, RB, RC].forEach(function (f) { append(f, '// changed together\n'); });
  const ok = await until(function () { return Promise.resolve(reRuns().length > reFrom); }, 280000);
  await sleep(5000);
  const r = await call(N.base, 'testicle.run', { script: LA, suite: LAS });
  return (!!ok && r.status === 200) || false;
}, test.limit.long);
test.run('a run stopped is re-assembled fresh from the flags: the next run is handed zzReB and zzReC, not zzReA', 0.4, async function () {
  if (!reWorld) return false;
  const ok = await until(function () { return Promise.resolve(reRuns().length > reFrom + 1); }, 280000);
  const runs = reRuns().slice(reFrom);
  const first = runs[0] || {}, next = runs[1] || {};
  return (!!ok && sameSet(first.given, [RA, RB, RC]) && sameSet(next.given, [RB, RC])) || false;
}, test.limit.long);
test.run('zzReA, which reported before the stop, is done: its suite row green, its flag cleared', 0.4, function () {
  if (!reWorld) return false;
  const row = suiteRow(tables(DB), RA, RGEN);
  return (!!row && row.outcome === 'green' && no(row.test)) || false;
}, test.limit.quick);
// Box v131: "a suite's result is NEVER assembled from testicle rows, anywhere: testicle.suite.success is the only thing that
// writes a suite row's outcome. the old summing of test rows goes." zzSucc's suite row, set green by the verb above, is sent
// a failing test row and a passing one by testicle.set alone: its outcome stays as the verb left it.
test.run('a failing test row sent alone leaves the suite row\'s outcome as testicle.suite.success left it: zzSucc stays green', 0.4, async function () {
  if (!succWorld) return false;
  const r = await call(N.base, 'testicle.testicle.set', { script: SUC, suite: SUCS, test: 'zzSucc answers', verified: false, severity: 0.2 });
  await sleep(1500);
  const row = suiteRow(tables(DB), SUC, SUCS);
  return (r.status === 200 && !!row && row.outcome === 'green') || false;
}, test.limit.slow);
test.run('testicle.suite.success with success false is what turns zzSucc red', 0.4, async function () {
  if (!succWorld) return false;
  await call(N.base, 'testicle.testicle.set', { script: SUC, suite: SUCS, test: 'zzSucc answers', verified: true, severity: 0.2 });
  const r = await call(N.base, 'testicle.suite.success', { script: SUC, suite: SUCS, success: false });
  await sleep(1500);
  const row = suiteRow(tables(DB), SUC, SUCS);
  return (r.status === 200 && !!row && row.outcome === 'red') || false;
}, test.limit.slow);

// ONE NODE AND ONE CHROME HANDED TO THE SUITES IT RUNS (goal/G47.1, Q10, wsl: "For testicle's 10 UI test files, shall each
// stay its own file and share one node and one Chrome that testicle hands them (1) ...?" Andy: "i pick 10.1: \"one test per
// file\"."). Two planted suites that open their pages as a UI test does (spirit/test/headLessChrome.js), each pressed, write
// down what they were handed (SPIRIT_MOUNT_BASE and SPIRIT_CHROME_PORT): a node that answers and a Chrome that answers, the
// same for both.
const ENVA = Z + 'zzEnvA.js', ENVAS = Z + 'test/zzEnvA.js', ENVB = Z + 'zzEnvB.js', ENVBS = Z + 'test/zzEnvB.js';
const envSuite = function (name) {
  return SUITE_HEAD + "require(path.join(__dirname, '..', '..', '..', '..', '..', 'test', 'headLessChrome.js'));\n" +
    "require('fs').writeFileSync(path.join(__dirname, '" + name + ".env.json'), JSON.stringify({ base: process.env.SPIRIT_MOUNT_BASE || '', chrome: process.env.SPIRIT_CHROME_PORT || '' }));\n" +
    "test.run('" + name + " answers', 0.2, function () { return true; }, test.limit.quick);\n";
};
const envOf = function (name) { try { return JSON.parse(fs.readFileSync(path.join(s.run, Z, 'test', name + '.env.json'), 'utf8')); } catch (e) { return null; } };
let handed = null;
test.run('two planted UI suites, each pressed, write down what testicle handed them', 0.2, async function () {
  if (!up()) return false;
  put(ENVA, '\'use strict\';\n// zzEnvA\n'); put(ENVAS, envSuite('zzEnvA'));
  put(ENVB, '\'use strict\';\n// zzEnvB\n'); put(ENVBS, envSuite('zzEnvB'));
  await until(function () { const t = tables(DB); return Promise.resolve(!!suiteRow(t, ENVA, ENVAS) && !!suiteRow(t, ENVB, ENVBS)); }, 30000);
  await call(N.base, 'testicle.run', { script: ENVA, suite: ENVAS });
  await until(function () { return Promise.resolve(!!envOf('zzEnvA')); }, 60000);
  await call(N.base, 'testicle.run', { script: ENVB, suite: ENVBS });
  await until(function () { return Promise.resolve(!!envOf('zzEnvB')); }, 60000);
  handed = { a: envOf('zzEnvA'), b: envOf('zzEnvB') };
  return (!!handed.a && !!handed.b) || false;
}, test.limit.long);
test.run('testicle hands the suites it runs a node that answers, and a Chrome that answers', 0.4, async function () {
  if (!handed || !handed.a) return false;
  const node = !!handed.a.base && await fetch(handed.a.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'api', args: {} }) }).then(function (r) { return r.status === 200; }, function () { return false; });
  const chrome = !!handed.a.chrome && await fetch('http://127.0.0.1:' + handed.a.chrome + '/json/version').then(function (r) { return r.status === 200; }, function () { return false; });
  return (node && chrome) || false;
}, test.limit.slow);
test.run('testicle hands the same node and the same Chrome to the next suite it runs', 0.4, function () {
  if (!handed || !handed.a || !handed.b) return false;
  return (!!handed.a.base && !!handed.a.chrome && handed.a.base === handed.b.base && handed.a.chrome === handed.b.chrome) || false;
}, test.limit.quick);

// LAST, SO THE REST OF THIS FILE JUDGES SUITES NOT RUN YET (goal/G47.1): set to auto and waited for, every flagged suite in its
// scope runs first, alpha's empty own suite with it, and the checks after it found their suites already run.
// goal/G47.1, Q8, Andy: "Shall a testicle in debug mode never run testicle's own tests, only the planted temp/ worlds and its
// three general tests?" "testicle MUST not recurse... and not run it's own tests just the dummies...". Set to auto, every
// flagged suite in its scope runs; testicle's own tests, under spirit/app/testicle/ but not temp/, are none of them: no row
// of theirs reaches it, and it comes to rest (a run of testicle.js would hold it busy for an hour, a lab node with it).
const OWN_TEST = function (suite) { return /^spirit\/app\/testicle\//.test(suite) && !/^spirit\/app\/testicle\/temp\//.test(suite) && /(^|\/)test\//.test(suite) && DEBUG_GENERALS.indexOf(suite) === -1; };
test.run('in debug mode, set to auto, it never runs testicle\'s own tests, only the dummies: none reports, and it comes to rest', 0.8, async function () {
  if (!up()) return false;
  await call(N.base, 'testicle.preferences', { interactive: false });
  const rest = await idle(280000);
  const own = (tables(DB).test || []).filter(function (r) { return OWN_TEST(r.suite) && r.suite !== 'spirit/test/scriptClassify.js'; });
  const suites = Array.from(new Set(own.map(function (r) { return r.suite; })));
  return (!!rest && !suites.length) || false;
}, test.limit.long);

// ── A RUN KILLED AT ITS TIME LIMIT (goal/G47.1, box v154, "testicle: a run killed at its time limit") ──
// Andy: "make sure that a run aborted due to time-limit does not mark ALL assiciated suites as failed, andmust recompute the
// run.", "I was talking about the 120 minute RUN limit. that is NOT the same as a hang in a test", "I'd agree to failing the
// suite currently running", and "A suite that succeeds against a script and it's hash, MUST remain as success in the suite
// table. otherwise the run exceeding 120 minutes will NEVER pass". A world of its own: a scratch copy whose testicle.js has a
// run limit of 60 s in place of 120 minutes (the one line, JOB_LIMIT_MS, changed in the copy alone), three planted scripts
// that one general run is handed in their order, and a copy of testicle's own -general test in which the second, bHang.js,
// has a test that works on, inside its own test limit (test.limit.long, 5 minutes), past the run's 60 s: the run limit fires
// first, so it is no hang in a test (cw). aOk.js reports before it; cLater.js is never reached.
{
  const LIMIT_LINE = 'const JOB_LIMIT_MS = 120 * 60 * 1000;';
  const SHORT_LIMIT_MS = 60000;
  const GENERAL_LINE = 'else GIVEN.forEach(function (rel) { test.forScript(rel, function () { one(rel); two(rel); }); });';
  const AOK = 'spirit/app/testicle/temp/zzLimit/aOk.js';
  const BHANG = 'spirit/app/testicle/temp/zzLimit/bHang.js';
  const CLATER = 'spirit/app/testicle/temp/zzLimit/cLater.js';
  const L = { s: null, N: null, DB: '', planted: '', aOkBefore: null, killed: false };
  const limitUp = function () { return !!L.N && L.N.up; };
  const generalRow = function (t, script) { return suiteRow(t, script, GENERAL); };
  const testRows = function (t, script) { return (t.test || []).filter(function (r) { return r.script === script && r.suite === GENERAL && yes(r.current); }); };
  // Let go in its own last test (goal/G47.6: held to the suite's end, the worlds after it found the lab's six nodes taken).
  const letGoL = async function () {
    if (L.N) await stop(L.N.child);
    try { if (L.s) LABH.freeTree(L.s); } catch (e) { /* scratch */ }
    L.N = null; L.s = null;
  };
  test.after(letGoL);
  test.run('a scratch copy is set up with a 60-second run limit and a general test running past it on the second of three scripts', 0.2, async function () {
    const root = LABH.scratchTree().root;
    const run = path.join(root, 'spirit', 'run');
    L.s = { root: root, run: run };
    const server = path.join(run, 'spirit', 'app', 'testicle', 'server', 'server.js');
    const serverSrc = fs.readFileSync(server, 'utf8');
    if (serverSrc.indexOf(LIMIT_LINE) === -1) return false;
    fs.writeFileSync(server, serverSrc.replace(LIMIT_LINE, 'const JOB_LIMIT_MS = ' + SHORT_LIMIT_MS + ';'));
    const general = path.join(run, GENERAL);
    const generalSrc = fs.readFileSync(general, 'utf8');
    if (generalSrc.indexOf(GENERAL_LINE) === -1) return false;
    fs.writeFileSync(general, generalSrc.replace(GENERAL_LINE, "else GIVEN.forEach(function (rel) { test.forScript(rel, function () { if (/zzLimit\\/bHang\\.js$/.test(rel)) test.run('it works on past the run limit', 0.2, function () { return new Promise(function (r) { setTimeout(function () { r(true); }, 240000); }); }, test.limit.long); else { one(rel); two(rel); } }); });"));
    [AOK, BHANG, CLATER].forEach(function (f) { fs.mkdirSync(path.dirname(path.join(run, f)), { recursive: true }); fs.writeFileSync(path.join(run, f), '\'use strict\';\n// ' + path.basename(f) + ', planted for the run limit\n'); });
    const on = path.join(run, 'spirit', 'state', 'testicle');
    fs.mkdirSync(path.join(on, 'data'), { recursive: true });
    fs.writeFileSync(path.join(on, 'node.json'), JSON.stringify({ active: true }));
    fs.writeFileSync(path.join(on, 'data', 'preferences.json'), JSON.stringify({ debug: true }));
    L.DB = path.join(on, 'data', 'testicle.db');
    L.N = await boot(run);
    if (!L.N.up) return false;
    const auto = await call(L.N.base, 'testicle.preferences', { interactive: false });
    return auto.status === 200 || false;
  }, test.limit.long);
  test.run('aOk.js reports its success in the run before the limit', 0.2, async function () {
    if (!limitUp()) return false;
    const done = await until(function () { const r = generalRow(tables(L.DB), AOK); return Promise.resolve(!!r && r.outcome === 'green' && no(r.test)); }, 240000);
    const t = tables(L.DB);
    L.aOkBefore = { row: generalRow(t, AOK), tests: testRows(t, AOK) };
    return (!!done && L.aOkBefore.tests.length > 0 && L.aOkBefore.tests.every(function (r) { return yes(r.verified); })) || false;
  }, test.limit.long);
  test.run('the run is killed at its limit while bHang.js works on', 0.2, async function () {
    if (!L.aOkBefore || !L.aOkBefore.row) return false;
    // Past the 60 s limit from the run's start, with a margin: bHang.js's test answers only after 240 s, so the run is
    // still on it when the limit fires. bHang.js reported no success before that.
    await sleep(SHORT_LIMIT_MS + 15000);
    const r = generalRow(tables(L.DB), BHANG);
    L.killed = !(r && r.outcome === 'green');
    return L.killed || false;
  }, test.limit.long);
  test.run('a suite that succeeded against a script and its hash stays a success in the suite table: aOk.js still green', 0.8, function () {
    if (!L.killed) return false;
    const r = generalRow(tables(L.DB), AOK);
    return (!!r && r.outcome === 'green' && r.hash === L.aOkBefore.row.hash) || false;
  }, test.limit.quick);
  test.run('the tests aOk.js\'s suite reported keep their results: every one of aOk.js\'s rows still passed', 0.8, function () {
    if (!L.killed) return false;
    const rows = testRows(tables(L.DB), AOK);
    return (rows.length > 0 && rows.every(function (r) { return yes(r.verified); })) || false;
  }, test.limit.quick);
  test.run('the suite running at the kill fails: bHang.js red', 0.4, function () {
    if (!L.killed) return false;
    const r = generalRow(tables(L.DB), BHANG);
    return (!!r && r.outcome === 'red') || false;
  }, test.limit.quick);
  test.run('a suite the run never reached is not failed by the kill: cLater.js\'s suite row is not red, and none of its test rows', 0.8, function () {
    if (!L.killed) return false;
    const t = tables(L.DB);
    const r = generalRow(t, CLATER);
    const reds = testRows(t, CLATER).filter(function (x) { return no(x.verified); });
    // Its suite row is there (the run was handed it); red would be the kill's verdict on a suite that never ran.
    return (!!r && r.outcome !== 'red' && !reds.length) || false;
  }, test.limit.quick);
  test.run('the run is computed again: cLater.js runs in a new run and its suite row turns green', 0.8, async function () {
    try {
      if (!L.killed) return false;
      const ran = await until(function () { const r = generalRow(tables(L.DB), CLATER); return Promise.resolve(!!r && r.outcome === 'green' && no(r.test)); }, 180000);
      return !!ran || false;
    } finally { await letGoL(); }
  }, test.limit.long);
}

// A RED THAT REACHED NO VERDICT SAYS SO (goal/G47.6, box point 1: "A crash or a hang stays a red on the script. The suite
// table is not mended; it gains one field, reason, shown as the explanation of a suite's red: crashed or hung when no verdict
// was reached."). A world of its own: a scratch copy, three planted scripts, and a copy of testicle's own -general test in
// which aCrash.js's test throws, bHung.js's test never answers within its limit, and cFalse.js's test answers false. In auto
// mode the run takes the three; each suite row ends red, and its reason says which.
{
  const GENERAL_LINE = 'else GIVEN.forEach(function (rel) { test.forScript(rel, function () { one(rel); two(rel); }); });';
  const ACRASH = 'spirit/app/testicle/temp/zzReason/aCrash.js';
  const BHUNG = 'spirit/app/testicle/temp/zzReason/bHung.js';
  const CFALSE = 'spirit/app/testicle/temp/zzReason/cFalse.js';
  // goal/G49.6; Andy: "that refusal has to be a suite level failure. then you can have a new status for suites \"duplicate
  // titles\"": dDup.js's general test runs two tests of the same title, both answering true.
  const DDUP = 'spirit/app/testicle/temp/zzReason/dDup.js';
  // Andy: "a title over 128 bytes, cut it at the reporter, and only an error if cuts result in duplicates?", "cut before the
  // character that causes overflow", "i approve of cw cutting scheme": eLong.js's one title is 127 a's, then a ü (two bytes,
  // past 128), then more; fCut.js's two titles are the same in their first 128 bytes.
  const ELONG = 'spirit/app/testicle/temp/zzReason/eLong.js';
  const FCUT = 'spirit/app/testicle/temp/zzReason/fCut.js';
  const LONG_CUT = 'a'.repeat(127);
  const R = { s: null, N: null, DB: '', ended: false };
  const reasonUp = function () { return !!R.N && R.N.up; };
  const rowOf = function (script) { return suiteRow(tables(R.DB), script, GENERAL); };
  const letGoR = async function () {
    if (R.N) await stop(R.N.child);
    try { if (R.s) LABH.freeTree(R.s); } catch (e) { /* scratch */ }
    R.N = null; R.s = null;
  };
  test.after(letGoR);
  test.run('a scratch copy is made with three planted scripts whose general test crashes, hangs and answers false', 0.2, async function () {
    const root = LABH.scratchTree().root;
    const run = path.join(root, 'spirit', 'run');
    R.s = { root: root, run: run };
    const general = path.join(run, GENERAL);
    const generalSrc = fs.readFileSync(general, 'utf8');
    if (generalSrc.indexOf(GENERAL_LINE) === -1) return false;
    fs.writeFileSync(general, generalSrc.replace(GENERAL_LINE, "else GIVEN.forEach(function (rel) { test.forScript(rel, function () {" +
      " if (/zzReason\\/aCrash\\.js$/.test(rel)) test.run('it crashes', 0.2, function () { throw new Error('zzReason crash'); }, test.limit.quick);" +
      " else if (/zzReason\\/bHung\\.js$/.test(rel)) test.run('it never answers', 0.2, function () { return new Promise(function () {}); }, test.limit.quick);" +
      " else if (/zzReason\\/cFalse\\.js$/.test(rel)) test.run('it answers false', 0.2, function () { return false; }, test.limit.quick);" +
      " else if (/zzReason\\/dDup\\.js$/.test(rel)) { test.run('it is twice', 0.2, function () { return true; }, test.limit.quick); test.run('it is twice', 0.2, function () { return true; }, test.limit.quick); }" +
      " else if (/zzReason\\/eLong\\.js$/.test(rel)) test.run('" + LONG_CUT + "ü and the rest of a long title', 0.2, function () { return true; }, test.limit.quick);" +
      " else if (/zzReason\\/fCut\\.js$/.test(rel)) { test.run('" + 'b'.repeat(130) + " one', 0.2, function () { return true; }, test.limit.quick); test.run('" + 'b'.repeat(130) + " two', 0.2, function () { return true; }, test.limit.quick); }" +
      " else { one(rel); two(rel); } }); });"));
    [ACRASH, BHUNG, CFALSE, DDUP, ELONG, FCUT].forEach(function (f) { fs.mkdirSync(path.dirname(path.join(run, f)), { recursive: true }); fs.writeFileSync(path.join(run, f), '\'use strict\';\n// ' + path.basename(f) + ', planted for the reason of a red\n'); });
    const on = path.join(run, 'spirit', 'state', 'testicle');
    fs.mkdirSync(path.join(on, 'data'), { recursive: true });
    fs.writeFileSync(path.join(on, 'node.json'), JSON.stringify({ active: true }));
    fs.writeFileSync(path.join(on, 'data', 'preferences.json'), JSON.stringify({ debug: true }));
    R.DB = path.join(on, 'data', 'testicle.db');
    R.N = await boot(run);
    if (!R.N.up) return false;
    // Asked again until testicle takes it: it may come up a moment after the node answers.
    const auto = await until(function () { return call(R.N.base, 'testicle.preferences', { interactive: false }).then(function (r) { return r.status === 200; }); }, 30000);
    return !!auto || false;
  }, test.limit.long);
  test.run('the run judges the three planted scripts\' general suite: each suite row ends red', 0.2, async function () {
    if (!reasonUp()) return false;
    R.ended = !!(await until(function () {
      return Promise.resolve([ACRASH, BHUNG, CFALSE].every(function (f) { const r = rowOf(f); return !!r && r.outcome === 'red' && no(r.test); }));
    }, 280000));
    return R.ended || false;
  }, test.limit.long);
  test.run('a suite whose test threw is red with the reason crashed', 0.8, function () {
    if (!R.ended) return false;
    const r = rowOf(ACRASH);
    return (!!r && r.outcome === 'red' && r.reason === 'crashed') || false;
  }, test.limit.quick);
  test.run('a suite whose test never answered within its limit is red with the reason hung', 0.8, function () {
    if (!R.ended) return false;
    const r = rowOf(BHUNG);
    return (!!r && r.outcome === 'red' && r.reason === 'hung') || false;
  }, test.limit.quick);
  test.run('a suite with two tests of one title is red with the reason duplicate titles', 0.8, async function () {
    if (!reasonUp()) return false;
    const r = await until(function () { const x = rowOf(DDUP); return Promise.resolve(!!x && no(x.test) && x.outcome ? x : null); }, 280000);
    return (!!r && r.outcome === 'red' && r.reason === 'duplicate titles') || false;
  }, test.limit.long);
  test.run('a suite failed as duplicate titles reports none of its tests', 0.6, function () {
    if (!reasonUp()) return false;
    const r = rowOf(DDUP);
    return (!!r && r.reason === 'duplicate titles' && currentOf(tables(R.DB), DDUP, GENERAL, 'it is twice').length === 0) || false;
  }, test.limit.quick);
  test.run('a title past 128 bytes is stored cut before the character that overflows, and judged', 0.6, async function () {
    if (!reasonUp()) return false;
    const r = await until(function () { const x = currentOf(tables(R.DB), ELONG, GENERAL, LONG_CUT)[0]; return Promise.resolve(x || null); }, 280000);
    return (!!r && yes(r.verified) && Buffer.byteLength(r.test) === 127) || false;
  }, test.limit.long);
  test.run('two titles the same once cut make the suite red with the reason duplicate titles', 0.6, async function () {
    if (!reasonUp()) return false;
    const r = await until(function () { const x = rowOf(FCUT); return Promise.resolve(!!x && no(x.test) && x.outcome ? x : null); }, 280000);
    return (!!r && r.outcome === 'red' && r.reason === 'duplicate titles') || false;
  }, test.limit.long);
  test.run('a suite whose test answered false is red with no reason: its verdict was reached', 0.8, async function () {
    try {
      if (!R.ended) return false;
      const r = rowOf(CFALSE);
      return (!!r && r.outcome === 'red' && 'reason' in r && !r.reason) || false;
    } finally { await letGoR(); }
  }, test.limit.slow);
}

// THE CLASSIFIER COMPILES FIRST (goal/G47.6, box point 3: "The classifier compiles a changed script first, before it boots a
// scratch node; a script that does not compile is a red on the script."; cw: "'not charged' must leave the compiling script
// waiting to run, not green, since nothing judged it"). A world of its own: a scratch copy whose classifier can get no
// scratch node (the one line that boots it, in the copy alone), and two planted scripts, one that does not compile and one
// that does. In auto mode the classifier runs on both.
{
  const BOOT_LINE = '  W.node = await ownScratch();';
  const BAD = 'spirit/app/testicle/temp/zzCompile/bad.js';
  const GOOD = 'spirit/app/testicle/temp/zzCompile/good.js';
  const C = { s: null, N: null, DB: '', judged: false };
  const compileUp = function () { return !!C.N && C.N.up; };
  const letGoC = async function () {
    if (C.N) await stop(C.N.child);
    try { if (C.s) LABH.freeTree(C.s); } catch (e) { /* scratch */ }
    C.N = null; C.s = null;
  };
  test.after(letGoC);
  test.run('a scratch copy is made whose classifier gets no scratch node, with a planted script that does not compile and one that does', 0.2, async function () {
    const root = LABH.scratchTree().root;
    const run = path.join(root, 'spirit', 'run');
    C.s = { root: root, run: run };
    const classifier = path.join(run, SC);
    const src = fs.readFileSync(classifier, 'utf8');
    if (src.indexOf(BOOT_LINE) === -1) return false;
    fs.writeFileSync(classifier, src.replace(BOOT_LINE, '  W.node = { up: false };'));
    fs.mkdirSync(path.dirname(path.join(run, BAD)), { recursive: true });
    fs.writeFileSync(path.join(run, BAD), '\'use strict\';\nfunction ( {\n');
    fs.writeFileSync(path.join(run, GOOD), '\'use strict\';\nmodule.exports = { good: true };\n');
    const on = path.join(run, 'spirit', 'state', 'testicle');
    fs.mkdirSync(path.join(on, 'data'), { recursive: true });
    fs.writeFileSync(path.join(on, 'node.json'), JSON.stringify({ active: true }));
    fs.writeFileSync(path.join(on, 'data', 'preferences.json'), JSON.stringify({ debug: true }));
    C.DB = path.join(on, 'data', 'testicle.db');
    C.N = await boot(run);
    if (!C.N.up) return false;
    // Asked again until testicle takes it: it may come up a moment after the node answers.
    const auto = await until(function () { return call(C.N.base, 'testicle.preferences', { interactive: false }).then(function (r) { return r.status === 200; }); }, 30000);
    return !!auto || false;
  }, test.limit.long);
  test.run('with no scratch node to be had, the classifier judges the script that does not compile', 0.2, async function () {
    if (!compileUp()) return false;
    C.judged = !!(await until(function () { return Promise.resolve(currentOf(tables(C.DB), BAD, SC, 'it loads, so it can be classified').length > 0); }, 180000));
    return C.judged || false;
  }, test.limit.long);
  test.run('a script that does not compile is red on the script, though no scratch node came up', 0.8, function () {
    if (!C.judged) return false;
    const r = currentOf(tables(C.DB), BAD, SC, 'it loads, so it can be classified')[0];
    return (!!r && no(r.verified)) || false;
  }, test.limit.quick);
  test.run('a script that compiles is not charged when no scratch node came up: not red, not green, still waiting to be classified', 0.8, async function () {
    try {
      if (!C.judged) return false;
      await sleep(5000);
      const t = tables(C.DB);
      const rows = currentOf(t, GOOD, SC, 'it loads, so it can be classified');
      const row = scriptRow(t, GOOD);
      return (rows.length === 0 && !!row && yes(row.reClassify)) || false;
    } finally { await letGoC(); }
  }, test.limit.slow);
}

// DEPENDENCIES ARE WATCHED, NOT PARSED, AND A CHANGE RE-RUNS WHAT DEPENDS ON IT (goal/G47.6, box point 3: "a changed file re-runs
// the own suites of every script that depends on it, at any depth", "the classifier loads each script alone in its own
// process and records everything that load pulled in, the whole chain; a require that happens only later, inside a function,
// is recorded while the script's own suite runs. They are kept in a new table of testicle's, dependency, one row per script
// and each file in its chain"). A world of its own: a scratch copy in auto mode, and four planted scripts, each with its own
// test: user.js requires lib.js as it loads; lazy.js requires lazyLib.js only inside a function its own test calls.
{
  const D0 = 'spirit/app/testicle/temp/zzDep/';
  const DEP = { lib: D0 + 'lib.js', user: D0 + 'user.js', lazyLib: D0 + 'lazyLib.js', lazy: D0 + 'lazy.js' };
  const DEP_SRC = {
    lib: "'use strict';\nmodule.exports = { v: 1 };\n",
    user: "'use strict';\nrequire('../../../../spirit.js').require('" + D0 + "lib.js');\nmodule.exports = { user: true };\n",
    lazyLib: "'use strict';\nmodule.exports = { lazy: 1 };\n",
    lazy: "'use strict';\nconst spirit = require('../../../../spirit.js');\nmodule.exports = { use: function () { return spirit.require('" + D0 + "lazyLib.js'); } };\n",
  };
  const DEP_TEST = {
    lib: "test.run('lib answers', 0.2, function () { return true; }, test.limit.quick);\n",
    user: "test.run('user answers', 0.2, function () { return true; }, test.limit.quick);\n",
    lazyLib: "test.run('lazyLib answers', 0.2, function () { return true; }, test.limit.quick);\n",
    lazy: "const lazy = require(path.join(__dirname, '..', 'lazy.js'));\ntest.run('lazy uses its lazyLib', 0.2, function () { return !!lazy.use(); }, test.limit.quick);\n",
  };
  const ownOfDep = function (rel) { return path.posix.join(path.posix.dirname(rel), 'test', path.posix.basename(rel)); };
  const DP = { s: null, N: null, DB: '', ran: false, before: 0 };
  const depUp = function () { return !!DP.N && DP.N.up; };
  const ownGreen = function (k) { const r = suiteRow(tables(DP.DB), DEP[k], ownOfDep(DEP[k])); return !!r && r.outcome === 'green' && no(r.test); };
  // The dependency table's rows, as they stand; [] when there is no such table.
  const depRows = function () {
    let db = null;
    try { db = new DatabaseSync(DP.DB, { readOnly: true }); db.exec('PRAGMA busy_timeout = 5000'); return db.prepare('SELECT * FROM dependency').all(); } catch (e) { return []; }
    finally { try { if (db) db.close(); } catch (e) { /* closed */ } }
  };
  const links = function (script, file) { return depRows().some(function (r) { const v = Object.keys(r).map(function (k) { return String(r[k]); }); return v.indexOf(script) !== -1 && v.indexOf(file) !== -1; }); };
  const letGoDP = async function () {
    if (DP.N) await stop(DP.N.child);
    try { if (DP.s) LABH.freeTree(DP.s); } catch (e) { /* scratch */ }
    DP.N = null; DP.s = null;
  };
  test.after(letGoDP);
  test.run('a scratch copy in auto mode is set up with four scripts: one requires another as it loads, one only inside a function', 0.2, async function () {
    const root = LABH.scratchTree().root;
    const run = path.join(root, 'spirit', 'run');
    DP.s = { root: root, run: run };
    Object.keys(DEP).forEach(function (k) {
      fs.mkdirSync(path.join(run, D0, 'test'), { recursive: true });
      fs.writeFileSync(path.join(run, DEP[k]), DEP_SRC[k]);
      fs.writeFileSync(path.join(run, ownOfDep(DEP[k])), SUITE_HEAD + DEP_TEST[k]);
    });
    const on = path.join(run, 'spirit', 'state', 'testicle');
    fs.mkdirSync(path.join(on, 'data'), { recursive: true });
    fs.writeFileSync(path.join(on, 'node.json'), JSON.stringify({ active: true }));
    fs.writeFileSync(path.join(on, 'data', 'preferences.json'), JSON.stringify({ debug: true }));
    DP.DB = path.join(on, 'data', 'testicle.db');
    DP.N = await boot(run);
    if (!DP.N.up) return false;
    // Asked again until testicle takes it: it may come up a moment after the node answers.
    const auto = await until(function () { return call(DP.N.base, 'testicle.preferences', { interactive: false }).then(function (r) { return r.status === 200; }); }, 30000);
    return !!auto || false;
  }, test.limit.long);
  test.run('the four are classified and their own suites run green', 0.2, async function () {
    if (!depUp()) return false;
    DP.ran = !!(await until(function () { return Promise.resolve(Object.keys(DEP).every(ownGreen)); }, 280000));
    return DP.ran || false;
  }, test.limit.long);
  // Waited for, not read once (goal/G47.1, Andy: "FIX IT."): the classifier records what a load pulled in, and on a busy
  // machine its report can land after the own suites already ran green.
  test.run('testicle keeps a dependency table, and it records that user.js pulls in lib.js as it loads', 0.8, async function () {
    if (!DP.ran) return false;
    return !!(await until(function () { return Promise.resolve(links(DEP.user, DEP.lib)); }, 120000)) || false;
  }, test.limit.long);
  test.run('a require inside a function, made only when lazy.js\'s own suite runs, is recorded too: lazy.js pulls in lazyLib.js', 0.8, async function () {
    if (!DP.ran) return false;
    return !!(await until(function () { return Promise.resolve(links(DEP.lazy, DEP.lazyLib)); }, 120000)) || false;
  }, test.limit.long);
  test.run('a change to lib.js re-runs the own suite of user.js, which depends on it, and it ends green again', 0.8, async function () {
    try {
      if (!DP.ran) return false;
      const r0 = suiteRow(tables(DP.DB), DEP.user, ownOfDep(DEP.user));
      DP.before = Number(r0 && r0.changed) || 0;
      fs.appendFileSync(path.join(DP.s.run, DEP.lib), '// changed\n');
      const again = await until(function () {
        const r = suiteRow(tables(DP.DB), DEP.user, ownOfDep(DEP.user));
        return Promise.resolve(!!r && Number(r.changed) > DP.before && r.outcome === 'green' && no(r.test));
      }, 180000);
      return !!again || false;
    } finally { await letGoDP(); }
  }, test.limit.long);
}

// A SUITE LEAVES NO PROCESS BEHIND (goal/G47.6; Andy: "what about having reds for proccesses that are def dangling by aborted
// suites????", "wsl, where are those reds?"; cw: "once a suite run has ended, killed or not, testicle looks for processes that
// run started that are still alive a few seconds later; if there are any, the suite is red on a test like 'it leaves no
// process behind', and they are ended", "The kill itself takes the whole tree"). A world of its own: a scratch copy, two
// planted scripts with their own suites. aLeft.js's suite starts a process of its own, detached, that would sleep 120 s,
// and answers at once; bKilled.js's suite starts one too and then never answers, and is stopped by a press of another
// suite. Each started process writes its pid beside the scratch tree, outside the run folder.
{
  const L0 = 'spirit/app/testicle/temp/zzLeak/';
  const LEFT = L0 + 'aLeft.js', KILLED = L0 + 'bKilled.js';
  const ownOfLeak = function (rel) { return path.posix.join(path.posix.dirname(rel), 'test', path.posix.basename(rel)); };
  // From the suite's folder, run/spirit/app/testicle/temp/zzLeak/test, eight up is the scratch tree's root.
  const pidAt = function (name) { return "path.join(__dirname, '..', '..', '..', '..', '..', '..', '..', '..', 'zzLeak-" + name + ".pid')"; };
  const sleeper = function (name, detached) {
    return "const kid = require('child_process').spawn(process.execPath, ['-e', 'setTimeout(function () {}, 120000)'], { stdio: 'ignore'" + (detached ? ", detached: true" : '') + " });" +
      (detached ? " kid.unref();" : '') + " require('fs').writeFileSync(" + pidAt(name) + ", String(kid.pid));\n";
  };
  const LEAK_TEST = {
    left: sleeper('left', true) + "test.run('aLeft answers', 0.2, function () { return true; }, test.limit.quick);\n",
    killed: sleeper('killed', false) + "test.run('bKilled never answers', 0.2, function () { return new Promise(function () {}); }, test.limit.long);\n",
  };
  const LK = { s: null, N: null, DB: '', ran: false, pressed: false };
  const leakUp = function () { return !!LK.N && LK.N.up; };
  const pidOf = function (name) { try { return Number(fs.readFileSync(path.join(LK.s.root, 'zzLeak-' + name + '.pid'), 'utf8')) || 0; } catch (e) { return 0; } };
  const alive = function (pid) { if (!pid) return false; try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
  const letGoLK = async function () {
    ['left', 'killed'].forEach(function (n) { const p = LK.s ? pidOf(n) : 0; if (alive(p)) { try { process.kill(p); } catch (e) { /* gone */ } } });
    if (LK.N) await stop(LK.N.child);
    try { if (LK.s) LABH.freeTree(LK.s); } catch (e) { /* scratch */ }
    LK.N = null; LK.s = null;
  };
  test.after(letGoLK);
  test.run('a scratch copy is made with a planted suite that leaves a process running and one that starts a process and never answers', 0.2, async function () {
    const root = LABH.scratchTree().root;
    const run = path.join(root, 'spirit', 'run');
    LK.s = { root: root, run: run };
    fs.mkdirSync(path.join(run, L0, 'test'), { recursive: true });
    fs.writeFileSync(path.join(run, LEFT), "'use strict';\n// aLeft\n");
    fs.writeFileSync(path.join(run, KILLED), "'use strict';\n// bKilled\n");
    fs.writeFileSync(path.join(run, ownOfLeak(LEFT)), SUITE_HEAD + LEAK_TEST.left);
    fs.writeFileSync(path.join(run, ownOfLeak(KILLED)), SUITE_HEAD + LEAK_TEST.killed);
    const on = path.join(run, 'spirit', 'state', 'testicle');
    fs.mkdirSync(path.join(on, 'data'), { recursive: true });
    fs.writeFileSync(path.join(on, 'node.json'), JSON.stringify({ active: true }));
    fs.writeFileSync(path.join(on, 'data', 'preferences.json'), JSON.stringify({ debug: true }));
    LK.DB = path.join(on, 'data', 'testicle.db');
    LK.N = await boot(run);
    return LK.N.up || false;
  }, test.limit.long);
  test.run('aLeft.js\'s own suite is pressed, runs, and its suite row ends', 0.2, async function () {
    if (!leakUp()) return false;
    await until(function () { return call(LK.N.base, 'testicle.suite.search', { script: LEFT, text: '' }).then(function (r) { return r.status === 200 && !!(r.body && (r.body.items || []).length); }); }, 120000);
    const r = await until(function () { return call(LK.N.base, 'testicle.run', { script: LEFT, suite: ownOfLeak(LEFT) }).then(function (x) { return !!(x.body && x.body.started === true); }); }, 120000);
    if (!r) return false;
    LK.ran = !!(await until(function () { const row = suiteRow(tables(LK.DB), LEFT, ownOfLeak(LEFT)); return Promise.resolve(!!row && no(row.test) && (row.outcome === 'green' || row.outcome === 'red') && !!pidOf('left')); }, 120000));
    return LK.ran || false;
  }, test.limit.long);
  test.run('a suite whose process is still running after it ended is red on "it leaves no process behind"', 0.8, async function () {
    if (!LK.ran) return false;
    const red = await until(function () {
      const rows = currentOf(tables(LK.DB), LEFT, ownOfLeak(LEFT), 'it leaves no process behind');
      return Promise.resolve(rows.length > 0 && no(rows[0].verified));
    }, 30000);
    return !!red || false;
  }, test.limit.long);
  test.run('the process a suite left running is ended', 0.8, async function () {
    if (!LK.ran) return false;
    return (await until(function () { return Promise.resolve(!alive(pidOf('left'))); }, 30000)) || false;
  }, test.limit.long);
  test.run('a suite stopped while it runs takes the process it started with it', 0.8, async function () {
    try {
      if (!leakUp()) return false;
      await until(function () { return call(LK.N.base, 'testicle.suite.search', { script: KILLED, text: '' }).then(function (r) { return r.status === 200 && !!(r.body && (r.body.items || []).length); }); }, 120000);
      const r = await call(LK.N.base, 'testicle.run', { script: KILLED, suite: ownOfLeak(KILLED) });
      if (!(r.body && r.body.started === true)) return false;
      const started = await until(function () { return Promise.resolve(alive(pidOf('killed'))); }, 60000);
      if (!started) return false;
      // The process this run started, held by its id: the stopped run is queued again and its next run writes a new one.
      const pid = pidOf('killed');
      // A press of another suite stops the running one.
      await call(LK.N.base, 'testicle.run', { script: LEFT, suite: ownOfLeak(LEFT) });
      return (await until(function () { return Promise.resolve(!alive(pid)); }, 30000)) || false;
    } finally { await letGoLK(); }
  }, test.limit.long);
}

// CLASSIFYING RECONCILES ALL FOUR TABLES WITH THE TREE (goal/G47.1; Andy: "classification must bring with it a complete
// reconciliation of the dataset in its tables.", "yes. that's what i say." to cw's reading: "whenever testicle classifies,
// at start and on each change, all four tables are brought into line with the tree, nothing left behind. Script table: only
// files that exist are live. Suite table: only pairs of a live script and a suite that exists and applies to it. Test
// results: current only under a live suite row. Dependencies: only between files that exist, and a script's list replaced
// whole each time it is learned, never added to."). A world of its own, in auto mode: aR.js and cR.js each pull in bR.js
// as they load, each with its own test; once all three ran green, cR.js and its test are deleted and aR.js stops pulling in
// bR.js.
{
  const R0 = 'spirit/app/testicle/temp/zzRecon/';
  const RC = { a: R0 + 'aR.js', b: R0 + 'bR.js', c: R0 + 'cR.js' };
  const pulls = function (what) { return "'use strict';\nrequire('../../../../spirit.js').require('" + R0 + "bR.js');\nmodule.exports = { " + what + ": true };\n"; };
  const RC_SRC = { a: pulls('a'), b: "'use strict';\nmodule.exports = { b: true };\n", c: pulls('c') };
  const ownOfR = function (rel) { return path.posix.join(path.posix.dirname(rel), 'test', path.posix.basename(rel)); };
  const RR = { s: null, N: null, DB: '', ran: false, moved: false };
  const reconUp = function () { return !!RR.N && RR.N.up; };
  const ownGreenR = function (k) { const r = suiteRow(tables(RR.DB), RC[k], ownOfR(RC[k])); return !!r && r.outcome === 'green' && no(r.test); };
  const depRowsR = function () {
    let db = null;
    try { db = new DatabaseSync(RR.DB, { readOnly: true }); db.exec('PRAGMA busy_timeout = 5000'); return db.prepare('SELECT * FROM dependency').all(); } catch (e) { return []; }
    finally { try { if (db) db.close(); } catch (e) { /* closed */ } }
  };
  const namesR = function (r) { return Object.keys(r).map(function (k) { return String(r[k]); }); };
  const linksR = function (script, file) { return depRowsR().some(function (r) { const v = namesR(r); return v.indexOf(script) !== -1 && v.indexOf(file) !== -1; }); };
  const letGoRC = async function () {
    if (RR.N) await stop(RR.N.child);
    try { if (RR.s) LABH.freeTree(RR.s); } catch (e) { /* scratch */ }
    RR.N = null; RR.s = null;
  };
  test.after(letGoRC);
  test.run('a scratch copy in auto mode is set up with three scripts, two of which require the third as they load', 0.2, async function () {
    const root = LABH.scratchTree().root;
    const run = path.join(root, 'spirit', 'run');
    RR.s = { root: root, run: run };
    fs.mkdirSync(path.join(run, R0, 'test'), { recursive: true });
    Object.keys(RC).forEach(function (k) {
      fs.writeFileSync(path.join(run, RC[k]), RC_SRC[k]);
      fs.writeFileSync(path.join(run, ownOfR(RC[k])), SUITE_HEAD + "test.run('" + k + "R answers', 0.2, function () { return true; }, test.limit.quick);\n");
    });
    const on = path.join(run, 'spirit', 'state', 'testicle');
    fs.mkdirSync(path.join(on, 'data'), { recursive: true });
    fs.writeFileSync(path.join(on, 'node.json'), JSON.stringify({ active: true }));
    fs.writeFileSync(path.join(on, 'data', 'preferences.json'), JSON.stringify({ debug: true }));
    RR.DB = path.join(on, 'data', 'testicle.db');
    RR.N = await boot(run);
    if (!RR.N.up) return false;
    const auto = await until(function () { return call(RR.N.base, 'testicle.preferences', { interactive: false }).then(function (r) { return r.status === 200; }); }, 30000);
    return !!auto || false;
  }, test.limit.long);
  test.run('the three are classified, their own suites run green, and the table links aR.js and cR.js to bR.js', 0.2, async function () {
    if (!reconUp()) return false;
    RR.ran = !!(await until(function () { return Promise.resolve(Object.keys(RC).every(ownGreenR) && linksR(RC.a, RC.b) && linksR(RC.c, RC.b)); }, 280000));
    return RR.ran || false;
  }, test.limit.long);
  test.run('cR.js and its test are deleted, and aR.js stops pulling in bR.js; testicle takes both changes', 0.2, async function () {
    if (!RR.ran) return false;
    fs.rmSync(path.join(RR.s.run, RC.c), { force: true });
    fs.rmSync(path.join(RR.s.run, ownOfR(RC.c)), { force: true });
    fs.writeFileSync(path.join(RR.s.run, RC.a), "'use strict';\nmodule.exports = { a: 'alone' };\n");
    RR.moved = !!(await until(function () { const r = scriptRow(tables(RR.DB), RC.c); const a = scriptRow(tables(RR.DB), RC.a); return Promise.resolve(!!r && yes(r.deleted) && !!a && no(a.reClassify)); }, 280000));
    return RR.moved || false;
  }, test.limit.long);
  test.run('a deleted script\'s suite rows are deleted with it, and none of its test results is current', 0.8, function () {
    if (!RR.moved) return false;
    const t = tables(RR.DB);
    const live = t.suite.filter(function (r) { return r.script === RC.c && no(r.deleted); });
    const current = (t.test || []).filter(function (r) { return r.script === RC.c && yes(r.current); });
    return (live.length === 0 && current.length === 0) || false;
  }, test.limit.quick);
  test.run('no dependency row names a deleted script, on either side', 0.8, async function () {
    if (!RR.moved) return false;
    return !!(await until(function () { return Promise.resolve(!depRowsR().some(function (r) { return namesR(r).indexOf(RC.c) !== -1; })); }, 60000)) || false;
  }, test.limit.slow);
  test.run('a script learned again has its dependency list replaced whole: aR.js no longer lists bR.js', 0.8, async function () {
    if (!RR.moved) return false;
    return !!(await until(function () { return Promise.resolve(!linksR(RC.a, RC.b)); }, 60000)) || false;
  }, test.limit.slow);
  test.run('what still exists stays: bR.js and aR.js keep their live script and suite rows', 0.8, async function () {
    try {
      if (!RR.moved) return false;
      const t = tables(RR.DB);
      return ['a', 'b'].every(function (k) { const r = scriptRow(t, RC[k]); const s = suiteRow(t, RC[k], ownOfR(RC[k])); return !!r && no(r.deleted) && !!s && no(s.deleted); }) || false;
    } finally { await letGoRC(); }
  }, test.limit.slow);
}

// TESTICLE CLEANS ITS LAB BEFORE A RUN (goal/G47.1; Andy: "there ONE test process, it can bloody well clean up after itself and
// if neccessary before itself, it's NOT fucking negotiating with any other process for fucking lab nodes", "testicle can double
// ensure that no fucking lab nodes or headless chromes are loitering about before AND after ever fucking run."). A world of its
// own: a scratch copy with one planted script and its own test; a stray process is left running on one of the copy's lab
// nodes, as an aborted run leaves one. A press of the suite ends it before the suite runs, and the suite runs green.
{
  const S0 = 'spirit/app/testicle/temp/zzStray/';
  const SA = S0 + 'sA.js';
  const ownOfS = function (rel) { return path.posix.join(path.posix.dirname(rel), 'test', path.posix.basename(rel)); };
  const ST = { s: null, N: null, DB: '', stray: 0, pressed: false };
  const strayUp = function () { return !!ST.N && ST.N.up; };
  const aliveS = function (pid) { if (!pid) return false; try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
  // THE START MARKS GO, BEFORE THE SUITES ARE WRITTEN AND WHEN THE TEST ENDS (goal/G48.4; Andy: "this one flips too much",
  // and "NO POLLUTION! NO LITTERING!!!!"): the lab copy is reused, so a mark the last run left would read as the second suite
  // already running, before any sweep.
  const dropMarks = function () { if (!ST.s) return; ['sB', 'sC'].forEach(function (n) { try { fs.rmSync(path.join(ST.s.root, 'started-' + n), { force: true }); } catch (e) { /* none */ } }); };
  const letGoST = async function () {
    dropMarks();
    if (aliveS(ST.stray)) { try { process.kill(ST.stray); } catch (e) { /* gone */ } }
    if (ST.N) await stop(ST.N.child);
    try { if (ST.s) LABH.freeTree(ST.s); } catch (e) { /* scratch */ }
    ST.N = null; ST.s = null;
  };
  test.after(letGoST);
  test.run('a scratch copy is made with a planted script and its own test, and a stray process left running on one of its lab nodes', 0.2, async function () {
    const root = LABH.scratchTree().root;
    const run = path.join(root, 'spirit', 'run');
    ST.s = { root: root, run: run };
    fs.mkdirSync(path.join(run, S0, 'test'), { recursive: true });
    fs.writeFileSync(path.join(run, SA), "'use strict';\n// sA\n");
    fs.writeFileSync(path.join(run, ownOfS(SA)), SUITE_HEAD + "test.run('sA answers', 0.2, function () { return true; }, test.limit.quick);\n");
    const on = path.join(run, 'spirit', 'state', 'testicle');
    fs.mkdirSync(path.join(on, 'data'), { recursive: true });
    fs.writeFileSync(path.join(on, 'node.json'), JSON.stringify({ active: true }));
    fs.writeFileSync(path.join(on, 'data', 'preferences.json'), JSON.stringify({ debug: true }));
    ST.DB = path.join(on, 'data', 'testicle.db');
    ST.N = await boot(run);
    if (!ST.N.up) return false;
    // The copy's own lab, as its testicle's runs use it: a node folder there with a process still running in it.
    const nodeDir = path.join(root, 'lab', 'node', 'personal1', 'spirit', 'run');
    fs.mkdirSync(nodeDir, { recursive: true });
    const kid = require('child_process').spawn(process.execPath, ['-e', 'setTimeout(function () {}, 600000)'], { cwd: nodeDir, stdio: 'ignore', detached: true });
    kid.unref();
    ST.stray = kid.pid;
    // Written down as the lab writes down a node it starts (lab/labNodes.js noteNode, <name>.pid), which is how an aborted
    // run's node is left: a process's working folder cannot be read on Windows, so the lab's own record is what names it (cw).
    fs.writeFileSync(path.join(root, 'lab', 'node', 'personal1.pid'), String(kid.pid));
    return aliveS(ST.stray) || false;
  }, test.limit.long);
  test.run('a press of a suite ends a process left running on a lab node before the run goes on', 0.8, async function () {
    if (!strayUp() || !ST.stray) return false;
    await until(function () { return call(ST.N.base, 'testicle.suite.search', { script: SA, text: '' }).then(function (r) { return r.status === 200 && !!(r.body && (r.body.items || []).length); }); }, 120000);
    const r = await until(function () { return call(ST.N.base, 'testicle.run', { script: SA, suite: ownOfS(SA) }).then(function (x) { return !!(x.body && x.body.started === true); }); }, 120000);
    ST.pressed = !!r;
    if (!ST.pressed) return false;
    return !!(await until(function () { return Promise.resolve(!aliveS(ST.stray)); }, 60000)) || false;
  }, test.limit.long);
  test.run('the pressed suite then runs green', 0.2, async function () {
    if (!ST.pressed) return false;
    return !!(await until(function () { const r = suiteRow(tables(ST.DB), SA, ownOfS(SA)); return Promise.resolve(!!r && r.outcome === 'green' && no(r.test)); }, 120000)) || false;
  }, test.limit.long);
  // BEFORE EVERY SUITE'S RUN, NOT ONLY A BUSY STRETCH'S FIRST (goal/G47.1; Andy's lab on 2026-11-19: classifiers stopped
  // mid-run at 08:36-08:46 held four of its six nodes until past noon, because the runner, busy all along, never swept again,
  // and testicle's own suite starved on the lab). Auto, two planted suites of 25 seconds each run one after the other, the
  // runner busy throughout; a stray left on a lab node while the first runs is ended before the second goes on.
  const SB = S0 + 'sB.js', SC = S0 + 'sC.js';
  // Each marks its start in the copy's root, outside its run folder (run/spirit/app/testicle/temp/zzStray/test is eight
  // folders below the root); no verb says which suite runs now.
  const STARTED = function (rel) { return 'started-' + path.posix.basename(rel, '.js'); };
  const SLOW = function (rel) {
    return "require('fs').writeFileSync(path.join(__dirname, '..', '..', '..', '..', '..', '..', '..', '..', '" + STARTED(rel) + "'), '');\n" +
      "test.run('it waits 25 seconds', 0.2, function () { return new Promise(function (r) { setTimeout(function () { r(true); }, 25000); }); }, test.limit.long);\n";
  };
  const running = function (rel) { return fs.existsSync(path.join(ST.s.root, STARTED(rel))); };
  test.run('while the runner stays busy, a stray left on a lab node during one suite is ended before the next suite runs', 0.8, async function () {
    try {
      if (!strayUp()) return false;
      const set = await call(ST.N.base, 'testicle.preferences', { interactive: false });
      if (set.status !== 200) return false;
      dropMarks();
      [SB, SC].forEach(function (rel) {
        fs.writeFileSync(path.join(ST.s.run, rel), "'use strict';\n// " + path.posix.basename(rel) + '\n');
        fs.writeFileSync(path.join(ST.s.run, ownOfS(rel)), SUITE_HEAD + SLOW(rel));
      });
      let first = '';
      if (!(await until(function () { first = running(SB) ? SB : running(SC) ? SC : ''; return Promise.resolve(!!first); }, 240000))) return false;
      const second = first === SB ? SC : SB;
      const nodeDir = path.join(ST.s.root, 'lab', 'node', 'personal2', 'spirit', 'run');
      fs.mkdirSync(nodeDir, { recursive: true });
      const kid = require('child_process').spawn(process.execPath, ['-e', 'setTimeout(function () {}, 600000)'], { cwd: nodeDir, stdio: 'ignore', detached: true });
      kid.unref();
      ST.stray = kid.pid;
      fs.writeFileSync(path.join(ST.s.root, 'lab', 'node', 'personal2.pid'), String(kid.pid));
      if (!(await until(function () { return Promise.resolve(running(second)); }, 120000))) return false;
      return !!(await until(function () { return Promise.resolve(!aliveS(ST.stray) && running(second)); }, 10000)) || false;
    } finally { await letGoST(); }
  }, test.limit.long);
}

// ── testicle reads the common file/folder cache (goal/G49.2) ──
// Andy: "go on the five!"; G49.1's box: "testicle's and backup's watchers go as each moves" onto spirit/fs/script.js, and "each
// disc scan goes in the same commit that moves its client onto spirit/fs/script.js". The server's code, comments left out, keeps
// no chokidar watcher of its own and reaches the tree through spirit/fs/script.js; treeScripts, its listing of the tree's scripts
// at start, walks no folder on the disc. Its reads of /proc and of its own lab folders stay: they are no part of the tree.
const TESTICLE_CODE = (function () {
  try { return fs.readFileSync(path.join(RUN, 'spirit', 'app', 'testicle', 'server', 'server.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); } catch (e) { return ''; }
})();
test.run('testicle\'s server keeps no chokidar watcher of its own', 0.2, function () {
  return (TESTICLE_CODE.length > 0 && !/chokidar/.test(TESTICLE_CODE)) || false;
}, test.limit.quick);
test.run('testicle\'s server reaches the tree through spirit/fs/script.js', 0.2, function () {
  return /require\(\s*['"][^'"]*spirit\/fs\/script\.js['"]\s*\)/.test(TESTICLE_CODE) || false;
}, test.limit.quick);
test.run('testicle\'s treeScripts walks no folder on the disc', 0.2, function () {
  const at = TESTICLE_CODE.indexOf('function treeScripts(');
  if (at === -1) return false;
  const open = TESTICLE_CODE.indexOf('{', at);
  let depth = 0, end = open;
  for (let i = open; i < TESTICLE_CODE.length; i++) { if (TESTICLE_CODE[i] === '{') depth++; else if (TESTICLE_CODE[i] === '}') { depth--; if (depth === 0) { end = i; break; } } }
  return !/\breaddirSync\b|\breaddir\(|\bstatSync\b/.test(TESTICLE_CODE.slice(open, end + 1)) || false;
}, test.limit.quick);

// ── A RUN JUDGES THE TREE AS IT IS (goal/G49.5) ──
// Andy: "you're doing nothing! could it be possible that you might fix a few of those 2000 bugs on linux/wsl????". Those reds
// were testicle's world: the node and Chrome it hands every run (SPIRIT_MOUNT_BASE, SPIRIT_MOUNT_RUN) stand on a copy of the
// tree made when the world starts, and the world is let go only when the runner has nothing left to choose. While the tree
// changed all evening the runner was never idle, so every run judged new tests against the old copy. A planted script,
// zzWorld.js, and its suite, which writes what the world's copy of zzWorld.js holds; a 60 s suite keeps the runner busy
// while zzWorld.js changes; the run after the change must find the changed text in the world it is handed.
const WZ = 'spirit/app/testicle/temp/zzWorld/';
const WPROD = WZ + 'zzWorld.js', WSUITE = WZ + 'test/zzWorld.js', WBUSY = WZ + 'zzBusy.js', WBUSYS = WZ + 'test/zzBusy.js';
const WSEEN = "const SEEN = path.join(__dirname, '..', '..', '..', '..', '..', '..', '..', '..', 'worldSeen.txt');\n";
const seenWorld = function () { try { return fs.readFileSync(path.join(s.root, 'worldSeen.txt'), 'utf8').trim().split('\n').filter(Boolean).map(function (l) { return JSON.parse(l); }); } catch (e) { return []; } };
let worldOne = false;
test.run('spirit/app/testicle/temp/zzWorld/ is planted, and its run reads "v1" from the world it is handed', 0.2, async function () {
  if (!up()) return false;
  try { fs.rmSync(path.join(s.root, 'worldSeen.txt'), { force: true }); } catch (e) { /* none */ }
  put(WPROD, "'use strict';\n// v1\n");
  put(WBUSY, "'use strict';\n// zzBusy\n");
  put(WSUITE, SUITE_HEAD + WSEEN +
    "test.run('zzWorld reads its script through the world', 0.2, function () {\n" +
    "  let text = ''; try { text = require('fs').readFileSync(path.join(process.env.SPIRIT_MOUNT_RUN || '', 'spirit', 'app', 'testicle', 'temp', 'zzWorld', 'zzWorld.js'), 'utf8'); } catch (e) { text = ''; }\n" +
    "  require('fs').appendFileSync(SEEN, JSON.stringify({ v: (/\\/\\/ (v\\d+)/.exec(text) || [])[1] || '', run: process.env.SPIRIT_MOUNT_RUN || '', at: Date.now() }) + '\\n');\n" +
    "  return true;\n}, test.limit.quick);\n");
  put(WBUSYS, SUITE_HEAD + "test.run('zzBusy keeps the runner busy for 60 s', 0.2, function () { return new Promise(function (r) { setTimeout(function () { r(true); }, 60000); }); }, test.limit.slow);\n");
  worldOne = !!(await until(function () { return Promise.resolve(seenWorld().some(function (x) { return x.v === 'v1'; })); }, 240000));
  return worldOne || false;
}, test.limit.long);
test.run('with the runner kept busy, zzWorld.js changes to "v2", and the run after it reads "v2" from its world', 0.4, async function () {
  if (!worldOne) return false;
  await idle(280000);
  const before = seenWorld().length;
  // The busy suite first, so the runner is at work when the script changes and has something left to choose after.
  append(WBUSYS, '// again ' + Date.now() + '\n');
  await sleep(3000);
  put(WPROD, "'use strict';\n// v2\n");
  const later = await until(function () { return Promise.resolve(seenWorld().length > before); }, 240000);
  const fresh = seenWorld().slice(before);
  return (!!later && fresh.length > 0 && fresh.every(function (x) { return x.v === 'v2'; })) || false;
}, test.limit.long);

// ── testicle.analyze: one red, its analysis in one payload (goal/G49.6, box v7) ──
// Andy: "i proposed the friggin verb! GO!"; the box: "testicle.analyze(red-testicle)", "the red testicle row itself, as
// testicle.red hands it", answering "1. the red itself: script, suite, test, severity, reason (crashed, hung or a plain fail),
// when it ran", "2. flip or never green: its last green from the history rows ... and whether that green had the same script
// hash and suite hash as the red", "5. what to fix first: ... then the script's other current reds, to fix together", "9. what
// it does not know, said plainly". The field names are wsl's proposal (red, lastGreen, fixFirst, unknown), cw's to settle in
// the build. A planted script and its suite: "zzFlip holds" green while the script says v1, red once it says v2; "zzFlip
// neighbour fails" always red, a sibling.
const AZ = 'spirit/app/testicle/temp/zzFlip/';
const AFLIP = AZ + 'zzFlip.js', AFLIPS = AZ + 'test/zzFlip.js';
const FLIP_SUITE = SUITE_HEAD +
  "test.run('zzFlip holds', 0.6, function () { return /v1/.test(require('fs').readFileSync(path.join(__dirname, '..', 'zzFlip.js'), 'utf8')); }, test.limit.quick);\n" +
  "test.run('zzFlip neighbour fails', 0.3, function () { return false; }, test.limit.quick);\n";
const A = {};
test.run('spirit/app/testicle/temp/zzFlip/ is planted, "zzFlip holds" green, then red once its script changes', 0.2, async function () {
  if (!up()) return false;
  put(AFLIP, "'use strict';\n// v1\n");
  put(AFLIPS, FLIP_SUITE);
  const green = await until(function () { const r = currentOf(tables(DB), AFLIP, AFLIPS, 'zzFlip holds')[0]; return Promise.resolve(!!r && yes(r.verified)); }, 240000);
  if (!green) return false;
  await idle(280000);
  put(AFLIP, "'use strict';\n// v2\n");
  A.red = await until(function () { const r = currentOf(tables(DB), AFLIP, AFLIPS, 'zzFlip holds')[0]; return Promise.resolve(!!r && no(r.verified) ? r : null); }, 240000);
  return !!A.red || false;
}, test.limit.long);
test.run('testicle.red hands its row, and testicle.analyze answers it', 0.2, async function () {
  if (!A.red) return false;
  const reds = await call(N.base, 'testicle.red', {});
  const item = ((reds.body && reds.body.items) || []).map(function (i) { return i.label; }).filter(function (l) { const r = parsed(l) || {}; return r.script === AFLIP && r.suite === AFLIPS && r.test === 'zzFlip holds'; })[0];
  if (!item) return false;
  const r = await call(N.base, 'testicle.analyze', { red: item });
  A.answer = r.status === 200 && r.body && typeof r.body === 'object' ? r.body : null;
  return !!A.answer || false;
}, test.limit.quick);
test.run('analyze answers the red itself: its script, suite, test, severity, reason and when it ran', 0.2, function () {
  const x = A.answer && A.answer.red;
  return (!!x && x.script === AFLIP && x.suite === AFLIPS && x.test === 'zzFlip holds' && Number(x.severity) === 0.6 && typeof x.reason === 'string' && Number(x.tested) > 0) || false;
}, test.limit.quick);
test.run('analyze answers its last green, which ran against another script hash', 0.2, function () {
  const g = A.answer && A.answer.lastGreen;
  return (!!g && Number(g.tested) > 0 && Number(g.tested) < Number(A.answer.red.tested) && g.sameHashes === false) || false;
}, test.limit.quick);
test.run('analyze names the script\'s other current red among what to fix with it: "zzFlip neighbour fails"', 0.2, function () {
  const f = (A.answer && A.answer.fixFirst) || [];
  return (Array.isArray(f) && f.some(function (x) { return x && x.test === 'zzFlip neighbour fails'; })) || false;
}, test.limit.quick);
test.run('analyze says plainly what it does not know, as a list', 0.2, function () {
  return (!!A.answer && Array.isArray(A.answer.unknown)) || false;
}, test.limit.quick);
