'use strict';

// spirit/run/spirit/app/testicle/test/testicle.js
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
const RUN = path.resolve(__dirname, '../../../..');
// Every node this test uses is one of lab's (goal/G47.3): its tree by scratchTree, its node by startNodeOn.
const LABH = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { freePort, until, sleep } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }

const APP = path.join(RUN, 'spirit', 'app', 'testicle');
// THE PLANTED FILES, under one folder of their own. alpha has its own test; beta has none; gamma has its own test and
// is touched only through it; epsilon and its test are never touched; notes.md is no script.
const Z = 'spirit/app/testicle/temp/zzTesticle/';
// A planted suite's head: the product reporter, from spirit/app/testicle/temp/zzTesticle/test/.
const SUITE_HEAD = '\'use strict\';\nconst path = require(\'path\');\nconst test = require(path.join(__dirname, \'..\', \'..\', \'..\', \'..\', \'..\', \'test\', \'testReport.js\'));\n';
// A planted suite that logs: 'start' when it begins, after a wait of ms its tests, 'end' when they are all done.
function LOGGED(name, ms, tests) {
  return SUITE_HEAD + "const LOG = path.join(__dirname, '..', '..', '..', '..', '..', '..', '..', '..', 'runlog.txt');\n" +
    "function log(ev) { require('fs').appendFileSync(LOG, JSON.stringify({ suite: '" + name + "', ev: ev, at: Date.now() }) + '\\n'); }\n" +
    "log('start');\n" +
    (ms ? "test.run('the world: " + name + " waits a moment', 0.2, function () { return new Promise(function (r) { setTimeout(function () { r(true); }, " + ms + "); }); }, test.limit.quick);\n" : '') +
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
    "test.run('the world: kappa waits a moment', 0.2, function () { return new Promise(function (r) { setTimeout(function () { r(true); }, 3000); }); }, test.limit.quick);",
    "test.run('kappa answers its first', 0.2, function () { return true; }, test.limit.quick);",
    "test.run('kappa fails its second', 0.2, function () { return 'it fails, as planted'; }, test.limit.quick);",
    "test.run('kappa was started with no argument', 0.2, function () { return process.argv.length === 2 || 'started with ' + process.argv.slice(2).join(' '); }, test.limit.quick);",
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
  // omega: an older classifier left it a red classifyable row in the older testicle.db (cw, after Andy's node classified
  // nothing at its start: "a red that starts on tables like these (classifier rows of an older classifier), please; empty
  // tables hid it").
  'spirit/app/testicle/temp/zzTesticle/omega.js': '\'use strict\';\n// omega\n',
  'spirit/app/testicle/temp/zzTesticle/test/omega.js': '\'use strict\';\n// the test of omega\n',
  'spirit/app/testicle/temp/zzTesticle/sigma.js': '\'use strict\';\n// sigma\n',
  'spirit/app/testicle/temp/zzTesticle/test/sigma.js': SUITE_HEAD + "setInterval(function () {}, 1000);\ntest.run('sigma hangs', 0.2, function () { return new Promise(function () {}); }, test.limit.quick);\n",
  'spirit/app/testicle/temp/zzTesticle/phi.js': '\'use strict\';\n// phi, its suite never run\n',
  'spirit/app/testicle/temp/zzTesticle/test/phi.js': '\'use strict\';\n// the test of phi\n',
  'spirit/app/testicle/temp/zzTesticle/mu.js': '\'use strict\';\n// mu\n',
  'spirit/app/testicle/temp/zzTesticle/test/mu-child-zzRule.js': SUITE_HEAD + [
    "test.run('mu holds its rule', 0.2, function () { return process.argv[2] === 'spirit/app/testicle/temp/zzTesticle/mu.js' || 'started with ' + process.argv.slice(2).join(' '); }, test.limit.quick);",
  ].join('\n') + '\n',
};
// The kept rows of an older testicle.db, for a script not on disc, so no change of this test's touches them.
const OLD = { name: 'spirit/app/testicle/temp/zzTesticle/older.js', suite: 'spirit/app/testicle/temp/zzTesticle/test/older.js', hash: 'an older hash', changed: 1700000000000 };
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
  // AN OLDER testicle.db (goal/G47.1, the rename: "an existing testicle.db is renamed in place, its rows kept"): its first
  // table still named file, the suite table's key column file, one row in each.
  fs.mkdirSync(path.join(on, 'data'), { recursive: true });
  // DEBUG MODE, written before the node starts (goal/G47.1, box v143: "testicle has a debug mode, set only by
  // ./test/testicle.js (a preference it writes on its scratch node, no verb)"): its preferences.json holds debug and nothing
  // else, so the default, interactive, is still judged first; then auto is set by the verb for the runner's checks (goal/G47.1,
  // box v79, 2 and 4), and interactive again at the end, on chi and psi.
  fs.writeFileSync(path.join(on, 'data', 'preferences.json'), JSON.stringify({ debug: true }));
  const old = new DatabaseSync(path.join(on, 'data', 'testicle.db'));
  old.exec('CREATE TABLE file (name TEXT PRIMARY KEY, hash TEXT NOT NULL DEFAULT \'\', deleted INTEGER NOT NULL DEFAULT 0, changed INTEGER NOT NULL)');
  old.exec('CREATE TABLE suite (file TEXT NOT NULL, suite TEXT NOT NULL, test INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0, hash TEXT NOT NULL DEFAULT \'\', outcome TEXT NOT NULL DEFAULT \'\', changed INTEGER NOT NULL, PRIMARY KEY (file, suite))');
  old.prepare('INSERT INTO file (name, hash, deleted, changed) VALUES (?, ?, 0, ?)').run(OLD.name, OLD.hash, OLD.changed);
  old.prepare('INSERT INTO suite (file, suite, test, deleted, hash, outcome, changed) VALUES (?, ?, 1, 0, ?, \'\', ?)').run(OLD.name, OLD.suite, OLD.hash, OLD.changed);
  // A TESTICLE TABLE OF AN OLDER CLASSIFIER: omega.js judged not classifyable by it, a row the start finds there.
  old.exec('CREATE TABLE testicle (script TEXT NOT NULL, suite TEXT NOT NULL, test TEXT NOT NULL, flipped INTEGER NOT NULL, current INTEGER NOT NULL DEFAULT 1, verified INTEGER NOT NULL, tested INTEGER NOT NULL, judged TEXT NOT NULL DEFAULT \'\', severity REAL NOT NULL DEFAULT 0, PRIMARY KEY (script, suite, test, flipped))');
  old.prepare('INSERT INTO testicle (script, suite, test, flipped, current, verified, tested, judged, severity) VALUES (?, ?, ?, ?, 1, 0, ?, ?, 0.8)').run('spirit/app/testicle/temp/zzTesticle/omega.js', 'spirit/test/scriptClassify.js', 'classifyable', OLD.changed, OLD.changed, 'an older classifier\'s hash');
  old.close();
  return { root: root, run: run };
}
async function call(base, verb, args) {
  try {
    const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
    const text = await r.text();
    return { status: r.status, text: text, body: parsed(text) };
  } catch (e) { return { status: 0, text: String(e && e.message), body: null }; }
}
async function boot(run) {
  const port = await freePort();
  // The node's error output kept beside the scratch tree, node.err, so a failure inside the server is there to read.
  const err = fs.openSync(path.join(run, '..', '..', 'node.err'), 'a');
  const child = LABH.startNodeOn(run, port, { stdio: ['ignore', 'ignore', err] });
  const base = 'http://127.0.0.1:' + port;
  const up = await until(function () { return call(base, 'api').then(function (r) { return r.status === 200; }); }, 60000);
  return { child: child, base: base, up: !!up };
}
function stop(c) { return new Promise(function (r) { if (!c || c.exitCode !== null) return r(); c.once('exit', function () { r(); }); c.kill(); setTimeout(r, 6000); }); }

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
  } catch (e) { return { error: String(e && e.message || e), script: [], suite: [], test: null }; }
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
const NONODE = 'no scratch node: the world failed';
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

test.after(async function () {
  for (const k of live) await stop(k);
  try { if (s) LABH.freeTree(s); } catch (e) { /* scratch */ }
});

// the box: "The server mounts beside the face (testicle.json: node.mount true)"
test.run('its manifest mounts a server: node.mount true', 0.2, function () {
  own = readJson(path.join(APP, 'testicle.json'));
  return (!!own && !!own.node && own.node.mount === true) || 'node: ' + short(own && own.node);
}, test.limit.quick);
test.run('its mount names testicle.js beside element.js', 0.2, function () {
  return (!!own && !!own.mount && own.mount['testicle.js'] === true && own.mount['element.js'] === true) || 'mount: ' + short(own && own.mount);
}, test.limit.quick);
test.run('spirit/app/testicle/testicle.js is there', 0.2, function () {
  return fs.existsSync(path.join(APP, 'testicle.js')) || 'no spirit/app/testicle/testicle.js';
}, test.limit.quick);

test.run('the world: a scratch node comes up', 0.2, async function () {
  s = scratch();
  DB = path.join(s.run, 'spirit', 'state', 'testicle', 'data', 'testicle.db');
  N = await boot(s.run); live.push(N.child);
  return N.up || 'the scratch node did not come up: nothing judged';
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
  return !bad.length || 'missing or with no test: ' + bad.join(', ');
}, test.limit.quick);
test.run('.gitignore keeps spirit/app/testicle/temp/ out of git, and git holds nothing under it', 0.4, function () {
  let ignored = false;
  try { execFileSync('git', ['check-ignore', '-q', 'spirit/run/spirit/app/testicle/temp/zzProbe/x.js'], { cwd: REPO }); ignored = true; } catch (e) { ignored = false; }
  const held = execFileSync('git', ['ls-files', '--', 'spirit/run/spirit/app/testicle/temp'], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
  return (ignored && !held.length) || (ignored ? '' : 'spirit/app/testicle/temp/ is not git-ignored') + (held.length ? ' git holds ' + held.length + ' files under it' : '');
}, test.limit.quick);
test.run('no zz folder is in the tree: git holds no spirit/zz... and no spirit/aa... folder', 0.4, function () {
  const held = execFileSync('git', ['ls-files', '--', 'spirit/run/spirit'], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(function (f) { return /^spirit\/run\/spirit\/(zz|aa)[A-Za-z]*\//.test(f); });
  return !held.length || held.length + ' tracked: ' + held.slice(0, 5).join(', ');
}, test.limit.quick);
test.run('in debug mode, once the start is worked off, testicle\'s scripts are only those under spirit/app/testicle/', 0.4, async function () {
  if (!up()) return NONODE;
  await idle(280000);
  const out = tables(DB).script.filter(function (r) { return no(r.deleted) && !/^spirit\/app\/testicle\//.test(r.name) && r.name !== OLD.name; });
  return !out.length || out.length + ' scripts outside it: ' + out.slice(0, 5).map(function (r) { return r.name; }).join(', ');
}, test.limit.long);
test.run('and its general suites are only testicle-sibling-general.js, -node.js and -browser.js, and the planted worlds\' own', 0.4, function () {
  if (!up()) return NONODE;
  const gens = Array.from(new Set(tables(DB).suite.filter(function (r) { return no(r.deleted) && /-(child|sibling)-(general|node|browser)\.js$/.test(r.suite); }).map(function (r) { return r.suite; })));
  const out = gens.filter(function (g) { return DEBUG_GENERALS.indexOf(g) === -1 && !/^spirit\/app\/testicle\/temp\//.test(g); });
  return (gens.length > 0 && !out.length) || (gens.length ? 'general suites outside it: ' + out.join(', ') : 'no general suite at all');
}, test.limit.quick);
test.run('and the classifier judged only scripts under spirit/app/testicle/', 0.4, function () {
  if (!up()) return NONODE;
  const rows = (tables(DB).test || []).filter(function (r) { return r.suite === 'spirit/test/scriptClassify.js' && yes(r.current); });
  const out = rows.filter(function (r) { return !/^spirit\/app\/testicle\//.test(r.script) && r.script !== 'spirit/app/testicle/temp/zzTesticle/omega.js'; });
  return (rows.length > 0 && !out.length) || (rows.length ? out.length + ' classified outside it: ' + out.slice(0, 5).map(function (r) { return r.script; }).join(', ') : 'nothing classified');
}, test.limit.quick);

// the box: "testicle.db sits in testicle's state folder"
test.run('testicle.db is made in its state folder, spirit/state/testicle/data/, with its tables file and suite', 0.2, async function () {
  if (!up()) return NONODE;
  return !!(await until(function () { return Promise.resolve(fs.existsSync(DB) && !tables(DB).error); }, 30000)) || 'no readable testicle.db at ' + DB + ': ' + short(fs.existsSync(DB) ? tables(DB).error : 'no file');
}, test.limit.long);

// goal/G47.1, the box: "The testicle server will serve one first verb, \"busy\": it returns true if it is doing any
// work, false if it is idle."
test.run('the node lists the verb testicle.busy', 0.2, async function () {
  if (!up()) return NONODE;
  const api = await call(N.base, 'api', { family: 'testicle' });
  // api {family} answers { family, interface }, the interface the text of its api.js.
  const iface = String((api.body && api.body.interface) || '');
  return (api.status === 200 && /\bverbs\s*:/.test(iface) && /['"]?busy['"]?\s*:/.test(iface)) || 'testicle\'s api: ' + short(api.body || api.text);
}, test.limit.quick);
test.run('with nothing changing, busy answers false', 0.2, async function () {
  if (!up()) return NONODE;
  // Nothing changes once the start is worked off; idle is busy false twice, two seconds apart (idle(), above).
  const quiet = await idle(50000);
  const r = await call(N.base, 'testicle.busy', {});
  return (!!quiet && r.status === 200 && (r.body === false || (r.body && r.body.busy === false))) || 'busy, idle: ' + r.status + ' ' + short(r.text);
}, test.limit.slow);

// goal/G47.1, the rename: "the table script; the suite table's key column script", "an existing testicle.db is renamed
// in place, its rows kept".
test.run('the older table file is now the table script, and no table file is left', 0.2, function () {
  if (!up()) return NONODE;
  start = tables(DB);
  let names0 = [];
  try { const d0 = new DatabaseSync(DB, { readOnly: true }); names0 = d0.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(function (r) { return r.name; }); d0.close(); } catch (e) { names0 = ['unreadable: ' + (e && e.message)]; }
  return (names0.indexOf('script') !== -1 && names0.indexOf('file') === -1) || 'tables: ' + short(names0);
}, test.limit.quick);
// Since box v95, 5 the start marks a row of a script no longer on disc deleted: the row is kept, its hash with it.
test.run('the older file row is kept in script, its hash as it was', 0.2, function () {
  if (!start) return NONODE;
  const kept = scriptRow(tables(DB), OLD.name);
  return (!!kept && kept.hash === OLD.hash) || 'the row: ' + short(kept);
}, test.limit.quick);
test.run('the older suite row is kept, its key column now script', 0.2, function () {
  if (!start) return NONODE;
  const keptSuite = suiteRow(start, OLD.name, OLD.suite);
  return (!!keptSuite && keptSuite.script === OLD.name && !('file' in keptSuite)) || 'the row: ' + short(keptSuite);
}, test.limit.quick);

// goal/G47.1, the rename cycle, the box: "The testicle test table is renamed \"testicle\": the table in testicle.db, its
// index, and the branch data.js keeps it under". No data rescue (Andy struck the box line on an older table test).
const sqlNames = function (type) {
  try { const d = new DatabaseSync(DB, { readOnly: true }); const r = d.prepare('SELECT name, tbl_name FROM sqlite_master WHERE type = ?').all(type); d.close(); return r; } catch (e) { return [{ name: 'unreadable: ' + (e && e.message), tbl_name: '' }]; }
};
test.run('testicle.db holds the table testicle, and no table test', 0.2, function () {
  if (!up()) return NONODE;
  const t = sqlNames('table').map(function (r) { return r.name; });
  return (t.indexOf('testicle') !== -1 && t.indexOf('test') === -1) || 'tables: ' + short(t);
}, test.limit.quick);
test.run('the index over the current rows is on the table testicle, and no index is on a table test', 0.2, function () {
  if (!up()) return NONODE;
  const ix = sqlNames('index').filter(function (r) { return !/^sqlite_autoindex/.test(r.name); });
  return (ix.some(function (r) { return r.tbl_name === 'testicle'; }) && !ix.some(function (r) { return r.tbl_name === 'test'; })) || 'indexes: ' + short(ix);
}, test.limit.quick);
test.run('the node lists the verbs testicle.set and testicle.search, and neither test.set nor test.search', 0.2, async function () {
  if (!up()) return NONODE;
  const api = await call(N.base, 'api', { family: 'testicle' });
  const iface = String((api.body && api.body.interface) || '');
  return (/['"]testicle\.set['"]\s*:/.test(iface) && /['"]testicle\.search['"]\s*:/.test(iface) && !/['"]test\.set['"]\s*:/.test(iface) && !/['"]test\.search['"]\s*:/.test(iface)) || 'testicle\'s api: ' + short(iface);
}, test.limit.quick);
test.run('the old verb testicle.test.set is no longer served', 0.2, async function () {
  if (!up()) return NONODE;
  // Asked for a script neither on disc nor in a row, so a verb still served refuses it for that and writes nothing.
  const r = await call(N.base, 'testicle.test.set', { script: Z + 'nowhere.js', suite: Z + 'test/nowhere.js', test: 'never set', verified: true, severity: 0.2 });
  return (!!r.body && r.body.code === 'no-such-verb') || 'testicle.test.set answered ' + r.status + ' ' + short(r.text);
}, test.limit.quick);

// goal/G47.1, box v95, 5: "the server on start, before even classifying, must make sure that script, suite and testicle
// tables reflect the current state" (it replaces "nothing is read at start"). Read once the start has done its work.
const VENDORED = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;
test.run('at start every product script on disc has its row in script', 0.2, async function () {
  if (!start) return NONODE;
  // The scratch tree holds no git of its own: its files are the repo's list, as scratch() copied them, plus the planted.
  const want = execSync('git ls-files -- spirit/run/spirit', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').map(function (f) { return f.replace(/^spirit\/run\//, ''); })
    // In debug mode (box v143) "as if run://spirit/app/testicle/ were ALL the testables of the whole node": only those.
    .filter(function (f) { return /^spirit\/app\/testicle\//.test(f) && /\.js$/.test(f) && !/(^|\/)test\//.test(f) && !VENDORED.holds(f) && fs.existsSync(path.join(s.run, f)); }).concat(Object.keys(PLANT).filter(function (f) { return !/(^|\/)test\//.test(f) && /\.js$/.test(f); }));
  let missing = [];
  await until(function () { const t = tables(DB); missing = want.filter(function (f) { const r = scriptRow(t, f); return !r || !no(r.deleted); }); return Promise.resolve(missing.length === 0); }, 120000);
  return missing.length === 0 || missing.length + ' of ' + want.length + ' on disc have no live row: ' + short(missing.slice(0, 8));
}, test.limit.long);
test.run('at start a planted script\'s own suite has its suite row', 0.2, function () {
  if (!start) return NONODE;
  const r = suiteRow(tables(DB), Z + 'zeta.js', Z + 'test/zeta.js');
  return (!!r && no(r.deleted)) || 'zeta\'s own suite row: ' + short(r);
}, test.limit.quick);
test.run('at start the older row of a script no longer on disc is marked deleted', 0.2, function () {
  if (!start) return NONODE;
  const r = scriptRow(tables(DB), OLD.name);
  return (!!r && yes(r.deleted)) || 'the older row: ' + short(r);
}, test.limit.quick);

// ── goal/G47.1, box v79, 3: three fields on the script table ──
// "reClassify, boolean: \"this script needs re-classification.\"", "browserOnly, boolean", "nodeOnly, boolean", "added as
// columns; an existing script table gains them, as the test table gained suiteHash."
const scriptColumns = function () {
  try { const d = new DatabaseSync(DB, { readOnly: true }); const c = d.prepare('PRAGMA table_info(script)').all().map(function (r) { return r.name; }); d.close(); return c; } catch (e) { return ['unreadable: ' + (e && e.message)]; }
};
test.run('the script table, made before, has gained the columns reClassify, browserOnly and nodeOnly', 0.2, function () {
  if (!up()) return NONODE;
  const c = scriptColumns();
  return ['reClassify', 'browserOnly', 'nodeOnly'].every(function (n) { return c.indexOf(n) !== -1; }) || 'columns: ' + short(c);
}, test.limit.quick);
test.run('the older row is kept, its hash as it was, when its table gained them', 0.2, function () {
  if (!up()) return NONODE;
  const kept = scriptRow(tables(DB), OLD.name);
  return (!!kept && kept.hash === OLD.hash) || 'the row: ' + short(kept);
}, test.limit.quick);

// ── goal/G47.1, box v79, 4: the verb preferences ──
// "preferences {} answers them all; preferences {interactive: false} sets that one and answers them all. An unknown name
// or a wrong type is refused." "For now it supports testicle.preferences.interactive (true by default)."
const classifyRowAt = function (t, name) { return (t.test || []).filter(function (r) { return r.script === name && r.suite === 'spirit/test/scriptClassify.js' && r.test === 'classifyable' && yes(r.current); })[0] || null; };
const PREFS = function () { return path.join(s.run, 'spirit', 'state', 'testicle', 'data', 'preferences.json'); };
const prefsOf = function (r) { const b = r && r.body; return (b && typeof b.preferences === 'object' && b.preferences) || b || {}; };
let p0 = null;
test.run('the node lists the verb testicle.preferences', 0.2, async function () {
  if (!up()) return NONODE;
  const api = await call(N.base, 'api', { family: 'testicle' });
  const iface = String((api.body && api.body.interface) || '');
  return /['"]?preferences['"]?\s*:/.test(iface) || 'testicle\'s api: ' + short(iface);
}, test.limit.quick);
test.run('preferences {} answers them all: interactive, true by default', 0.2, async function () {
  if (!up()) return NONODE;
  p0 = await call(N.base, 'testicle.preferences', {});
  return (p0.status === 200 && prefsOf(p0).interactive === true) || 'preferences {}: ' + p0.status + ' ' + short(p0.text);
}, test.limit.quick);
test.run('a preference it does not know is refused, and sets nothing', 0.2, async function () {
  if (!up()) return NONODE;
  const r = await call(N.base, 'testicle.preferences', { zzNoSuchPreference: true });
  const after1 = await call(N.base, 'testicle.preferences', {});
  return ((r.status !== 200 || (r.body && r.body.ok === false)) && prefsOf(after1).zzNoSuchPreference === undefined && prefsOf(after1).interactive === true) || 'an unknown name: ' + r.status + ' ' + short(r.text) + '; then ' + short(after1.text);
}, test.limit.quick);
test.run('interactive given a wrong type is refused, and sets nothing', 0.2, async function () {
  if (!up()) return NONODE;
  const r = await call(N.base, 'testicle.preferences', { interactive: 'no' });
  const after1 = await call(N.base, 'testicle.preferences', {});
  return ((r.status !== 200 || (r.body && r.body.ok === false)) && prefsOf(after1).interactive === true) || 'interactive "no": ' + r.status + ' ' + short(r.text) + '; then ' + short(after1.text);
}, test.limit.quick);

// A START ON TABLES OF AN OLDER CLASSIFIER, INTERACTIVE, NOTHING PRESSED (Andy: "wsl, make double sure you catch this with a
// test."): the start brings the tables up to date and classifies every script by itself; omega.js, left red by an older
// classifier, is tried again.
test.run('at a start on tables of an older classifier, interactive and nothing pressed, every live script is classified', 0.2, async function () {
  if (!start) return NONODE;
  let left = [];
  const ok = await until(function () { const t = tables(DB); left = t.script.filter(function (r) { return no(r.deleted) && !no(r.reClassify); }); return Promise.resolve(t.script.filter(function (r) { return no(r.deleted); }).length > 0 && left.length === 0); }, 280000);
  // In debug mode (box v143) the live scripts are those under spirit/app/testicle/, a few dozen, never the whole tree's hundreds.
  return !!ok || left.length + ' live scripts still to classify, nothing pressed: ' + short(left.slice(0, 5).map(function (r) { return r.name; }));
}, test.limit.long);
test.run('and the script an older classifier left red is tried again: its classifyable row tested at this start', 0.2, function () {
  if (!start) return NONODE;
  const r = classifyRowAt(tables(DB), Z + 'omega.js');
  return (!!r && Number(r.tested) > 1700000000000) || 'omega\'s classifyable row: ' + short(r);
}, test.limit.quick);

// The checks that follow judge the server as it ran until now, auto (goal/G47.1, box v79, 2: "auto: the default mode until
// now"); interactive is judged at the end of this file, on chi and psi.
test.run('the world: auto for the checks that follow, set by preferences {interactive: false}', 0.2, async function () {
  if (!up()) return NONODE;
  const r = await call(N.base, 'testicle.preferences', { interactive: false });
  return (r.status === 200 && prefsOf(r).interactive === false) || 'set: ' + r.status + ' ' + short(r.text);
}, test.limit.quick);


// the box: "on any change of a product file it makes sure that file has its row"
test.run('one second after a product file changes, it has its row in script', 0.2, async function () {
  if (!up()) return NONODE;
  t0 = Date.now();
  append(Z + 'alpha.js', '// changed once\n');
  a1 = await after();
  alpha = scriptRow(a1, Z + 'alpha.js');
  return !!alpha || 'no row for ' + Z + 'alpha.js: ' + short(a1.error || a1.script);
}, test.limit.slow);
test.run('the row holds the file\'s hash', 0.2, function () {
  return (!!alpha && typeof alpha.hash === 'string' && alpha.hash !== '') || 'hash: ' + short(alpha && alpha.hash);
}, test.limit.quick);
test.run('the row is not marked deleted', 0.2, function () {
  return (!!alpha && no(alpha.deleted)) || 'deleted: ' + short(alpha && alpha.deleted);
}, test.limit.quick);
test.run('the row\'s changed is a numeric UTC timestamp of that change', 0.2, function () {
  return (!!alpha && Number(alpha.changed) >= t0 - 1000 && Number(alpha.changed) <= Date.now()) || 'changed: ' + short(alpha && alpha.changed) + ', the change at ' + t0;
}, test.limit.quick);

// the box: "and a suite row for every suite that concerns it"
test.run('the world: alpha.js is concerned by its own test and by general tests', 0.2, function () {
  if (!up()) return NONODE;
  wantAlpha = concerning(s.run, Z + 'alpha.js');
  return (wantAlpha.indexOf(Z + 'test/alpha.js') !== -1 && wantAlpha.length > 1) || 'testModule.js names ' + short(wantAlpha);
}, test.limit.quick);
test.run('its suite rows are exactly its own test and the general tests that name it', 0.2, function () {
  if (!a1) return NONODE;
  return JSON.stringify(names(suiteRows(a1, Z + 'alpha.js'))) === JSON.stringify(wantAlpha) || 'rows ' + short(names(suiteRows(a1, Z + 'alpha.js'))) + ', wanted ' + short(wantAlpha);
}, test.limit.quick);
test.run('every one of its suite rows is flagged test', 0.2, function () {
  if (!a1) return NONODE;
  ownRow = suiteRow(a1, Z + 'alpha.js', Z + 'test/alpha.js');
  const unflagged = suiteRows(a1, Z + 'alpha.js').filter(notClassifier).filter(function (r) { return !yes(r.test); });
  return (suiteRows(a1, Z + 'alpha.js').length > 0 && !unflagged.length) || 'not flagged: ' + short(names(unflagged));
}, test.limit.quick);
test.run('a suite row holds the suite file\'s own hash', 0.2, function () {
  return (!!ownRow && typeof ownRow.hash === 'string' && ownRow.hash !== '' && ownRow.hash !== alpha.hash) || 'suite hash ' + short(ownRow && ownRow.hash) + ', file hash ' + short(alpha && alpha.hash);
}, test.limit.quick);
test.run('a suite row is not marked deleted', 0.2, function () {
  return (!!ownRow && no(ownRow.deleted)) || 'deleted: ' + short(ownRow && ownRow.deleted);
}, test.limit.quick);
test.run('a suite row\'s outcome is empty: nothing runs a suite this cycle', 0.2, function () {
  return (!!ownRow && empty(ownRow.outcome)) || 'outcome: ' + short(ownRow && ownRow.outcome);
}, test.limit.quick);
test.run('a suite row\'s changed is a numeric UTC timestamp', 0.2, function () {
  return (!!ownRow && Number(ownRow.changed) >= t0 - 1000 && Number(ownRow.changed) <= Date.now()) || 'changed: ' + short(ownRow && ownRow.changed);
}, test.limit.quick);

// the box: "When a suite or a product file is changed ... the server adjusts the two tables"
test.run('a product file changed again gets its new hash', 0.2, async function () {
  if (!up()) return NONODE;
  t1 = Date.now();
  append(Z + 'alpha.js', '// changed twice\n');
  a2 = await after();
  alpha2 = scriptRow(a2, Z + 'alpha.js');
  return (!!alpha2 && !!alpha && alpha2.hash !== alpha.hash) || 'hash before ' + short(alpha && alpha.hash) + ', after ' + short(alpha2 && alpha2.hash);
}, test.limit.slow);
test.run('and its changed moves to that change', 0.2, function () {
  return (!!alpha2 && Number(alpha2.changed) >= t1) || 'changed: ' + short(alpha2 && alpha2.changed) + ', the change at ' + t1;
}, test.limit.quick);
test.run('a file keeps one row', 0.2, function () {
  if (!a2) return NONODE;
  return a2.script.filter(function (r) { return r.name === Z + 'alpha.js'; }).length === 1 || 'rows for alpha.js: ' + a2.script.filter(function (r) { return r.name === Z + 'alpha.js'; }).length;
}, test.limit.quick);
test.run('a suite changed gets its new hash on its rows', 0.2, async function () {
  if (!up()) return NONODE;
  t2 = Date.now();
  append(Z + 'test/alpha.js', '// the suite changed\n');
  a3 = await after();
  ownRow3 = suiteRow(a3, Z + 'alpha.js', Z + 'test/alpha.js');
  return (!!ownRow3 && !!ownRow && ownRow3.hash !== ownRow.hash) || 'suite hash before ' + short(ownRow && ownRow.hash) + ', after ' + short(ownRow3 && ownRow3.hash);
}, test.limit.slow);
test.run('and its rows are flagged test, changed at that change', 0.2, function () {
  return (!!ownRow3 && yes(ownRow3.test) && Number(ownRow3.changed) >= t2) || 'row: ' + short(ownRow3);
}, test.limit.quick);

// the box: "When a suite ... is changed or added": a suite of a file with no row yet
test.run('a changed suite makes its row for the file it concerns', 0.2, async function () {
  if (!up()) return NONODE;
  append(Z + 'test/gamma.js', '// the suite of gamma changed\n');
  g1 = await after();
  return !!suiteRow(g1, Z + 'gamma.js', Z + 'test/gamma.js') || 'suite rows of gamma.js: ' + short(suiteRows(g1, Z + 'gamma.js'));
}, test.limit.slow);
test.run('and that file has its row in script', 0.2, function () {
  if (!g1) return NONODE;
  return !!scriptRow(g1, Z + 'gamma.js') || 'no row for ' + Z + 'gamma.js';
}, test.limit.quick);

// the box: "changed or added": a new product file
test.run('a product file added has its row one second later', 0.2, async function () {
  if (!up()) return NONODE;
  put(Z + 'delta.js', '\'use strict\';\n// delta, new\n');
  d1 = await after();
  return !!scriptRow(d1, Z + 'delta.js') || 'no row for ' + Z + 'delta.js';
}, test.limit.slow);
test.run('with a suite row for every general test that names it', 0.2, function () {
  if (!d1) return NONODE;
  wantDelta = concerning(s.run, Z + 'delta.js');
  return (wantDelta.length > 0 && JSON.stringify(names(suiteRows(d1, Z + 'delta.js'))) === JSON.stringify(wantDelta)) || 'rows ' + short(names(suiteRows(d1, Z + 'delta.js'))) + ', wanted ' + short(wantDelta);
}, test.limit.quick);

// the box: "changed or added": a new suite
test.run('a suite added makes its row, and its file\'s row', 0.2, async function () {
  if (!up()) return NONODE;
  put(Z + 'test/beta.js', '\'use strict\';\n// the new test of beta\n');
  b1 = await after();
  return (!!suiteRow(b1, Z + 'beta.js', Z + 'test/beta.js') && !!scriptRow(b1, Z + 'beta.js')) || 'rows of beta.js: ' + short(suiteRows(b1, Z + 'beta.js'));
}, test.limit.slow);

// goal/G47.1, the verbs cycle: testicle.script.get. The box: "If the argument (a filename, scoped to run://) is not a
// production script, it returns the error \"not a production script\"", "If the file does not exist, it returns the
// error \"no such file\"", "If the file does not have its file and suite rows, they are created automatically", "It
// creates them with the same code the server uses when it discovers a file change and no record exists: the suites are
// flagged \"needs testing\"", "The server then returns the file row." Its argument is the file row's key, name.
test.run('script.get of a file that is no script answers the error "not a production script"', 0.2, async function () {
  if (!up()) return NONODE;
  const md = await call(N.base, 'testicle.script.get', { name: Z + 'notes.md' });
  return failed(md, 'not a production script') || 'script.get notes.md: ' + md.status + ' ' + short(md.text);
}, test.limit.quick);
test.run('script.get of a script in a test folder answers the error "not a production script"', 0.2, async function () {
  if (!up()) return NONODE;
  const asTest = await call(N.base, 'testicle.script.get', { name: Z + 'test/zeta.js' });
  return failed(asTest, 'not a production script') || 'script.get test/zeta.js: ' + asTest.status + ' ' + short(asTest.text);
}, test.limit.quick);
test.run('script.get of a production script that is not there answers the error "no such file"', 0.2, async function () {
  if (!up()) return NONODE;
  const nowhere = await call(N.base, 'testicle.script.get', { name: Z + 'nowhere.js' });
  return failed(nowhere, 'no such file') || 'script.get nowhere.js: ' + nowhere.status + ' ' + short(nowhere.text);
}, test.limit.quick);
// Since box v95, 5 every script on disc has its row from the start, zeta.js among them: script.get answers it.
test.run('script.get of a production script never changed answers with its file row there', 0.2, async function () {
  if (!up()) return NONODE;
  tz = Date.now();
  zeta = await call(N.base, 'testicle.script.get', { name: Z + 'zeta.js' });
  zt = tables(DB);
  zrow = scriptRow(zt, Z + 'zeta.js');
  return (zeta.status === 200 && !!zrow) || 'script.get zeta.js: ' + zeta.status + ' ' + short(zeta.text) + '; its row ' + short(zrow);
}, test.limit.quick);
test.run('and answers that file row', 0.2, function () {
  if (!zeta) return NONODE;
  return (!!zrow && !!zeta.body && zeta.body.name === zrow.name && zeta.body.hash === zrow.hash && Number(zeta.body.changed) === Number(zrow.changed) && no(zrow.deleted)) || 'answered ' + short(zeta.body) + ', the row ' + short(zrow);
}, test.limit.quick);
test.run('it makes a suite row for every suite that concerns the file', 0.2, function () {
  if (!zt) return NONODE;
  wantZeta = concerning(s.run, Z + 'zeta.js');
  return (wantZeta.indexOf(Z + 'test/zeta.js') !== -1 && JSON.stringify(names(suiteRows(zt, Z + 'zeta.js'))) === JSON.stringify(wantZeta)) || 'rows ' + short(names(suiteRows(zt, Z + 'zeta.js'))) + ', wanted ' + short(wantZeta);
}, test.limit.quick);
test.run('every suite row it makes is flagged needs testing', 0.2, function () {
  if (!zt) return NONODE;
  const zunflagged = suiteRows(zt, Z + 'zeta.js').filter(notClassifier).filter(function (r) { return !yes(r.test); });
  return (suiteRows(zt, Z + 'zeta.js').length > 0 && !zunflagged.length) || 'not flagged: ' + short(names(zunflagged));
}, test.limit.quick);
test.run('script.get of a file with rows answers its row as it stands', 0.2, async function () {
  if (!up()) return NONODE;
  const known = await call(N.base, 'testicle.script.get', { name: Z + 'gamma.js' });
  const grow = scriptRow(tables(DB), Z + 'gamma.js');
  return (known.status === 200 && !!grow && !!known.body && known.body.name === grow.name && known.body.hash === grow.hash) || 'answered ' + short(known.body) + ', the row ' + short(grow);
}, test.limit.quick);

// goal/G47.1, the verbs cycle: testicle.suite.search. The box: "A standard table search response", "The file row owns
// its suite rows: the suite table's key is file and suite. So suite.search takes the production file and answers that
// file's suite rows only, each suite once, with its filename and its status; the words narrow among them", "the suite
// files, each with test as the final folder it is in", "The suite search returns both: the filename AND its status
// \"needs running\"". The standard answer: {items: [{key, label}], more}, each label the row as JSON.
test.run('suite.search answers a standard table search: items and more', 0.2, async function () {
  if (!up()) return NONODE;
  all = await call(N.base, 'testicle.suite.search', { script: Z + 'zeta.js', text: '' });
  got = items(all);
  return (all.status === 200 && !!all.body && Array.isArray(all.body.items) && typeof all.body.more === 'boolean') || 'suite.search: ' + all.status + ' ' + short(all.text);
}, test.limit.quick);
test.run('with no words it answers the file\'s suites, each once, and no other', 0.2, function () {
  const gotNames = got.map(suiteOf).sort();
  return JSON.stringify(gotNames) === JSON.stringify(wantZeta) || 'answered ' + short(gotNames) + ', wanted ' + short(wantZeta);
}, test.limit.quick);
test.run('every row it answers is the given script\'s', 0.2, function () {
  return (got.length > 0 && got.every(function (i) { return i.row.script === Z + 'zeta.js'; })) || 'scripts: ' + short(got.map(function (i) { return i.row.script; }));
}, test.limit.quick);
test.run('every suite it answers is a file whose final folder is test', 0.2, function () {
  return (got.length > 0 && got.every(function (i) { return path.posix.basename(path.posix.dirname(suiteOf(i))) === 'test'; })) || 'suites: ' + short(got.map(suiteOf).sort());
}, test.limit.quick);
test.run('every suite it answers carries its status: needs running', 0.2, function () {
  return (got.length > 0 && got.filter(function (i) { return notClassifier(i.row); }).every(function (i) { return yes(i.row.test) || i.row.status === 'needs running'; })) || 'rows: ' + short(got.map(function (i) { return i.row; }).slice(0, 3));
}, test.limit.quick);
test.run('the words narrow among the file\'s suites', 0.2, async function () {
  if (!up()) return NONODE;
  const narrow = items(await call(N.base, 'testicle.suite.search', { script: Z + 'zeta.js', text: 'sibling' })).map(suiteOf);
  return (narrow.indexOf(GENERAL) !== -1 && narrow.indexOf(Z + 'test/zeta.js') === -1) || 'searched sibling: ' + short(narrow);
}, test.limit.quick);
test.run('another file\'s search answers that file\'s rows, none of the first', 0.2, async function () {
  if (!up()) return NONODE;
  const other = items(await call(N.base, 'testicle.suite.search', { script: Z + 'gamma.js', text: '' }));
  return (other.length > 0 && other.every(function (i) { return i.row.script === Z + 'gamma.js'; }) && other.map(suiteOf).indexOf(Z + 'test/zeta.js') === -1) || 'gamma.js: ' + short(other.map(function (i) { return i.row.script + ' ' + suiteOf(i); }).slice(0, 5));
}, test.limit.quick);
// goal/G47.1, the box: "with the script selector blank (all scripts), the suite selector lists every suite, each once, and
// suite.search given no script answers that list". It replaces "suite.search keeps needing a script" (Andy: "There's
// NOTHING wrong with searching for testicle records that only must match a suite and not a file."). GENERAL judges both
// zeta and gamma, so it is one suite of two scripts.
test.run('given no script, suite.search answers the suites of every script', 0.2, async function () {
  if (!up()) return NONODE;
  const r = await call(N.base, 'testicle.suite.search', { text: 'zzTesticle' });
  const names = items(r).map(suiteOf);
  return (r.status === 200 && names.indexOf(Z + 'test/zeta.js') !== -1 && names.indexOf(Z + 'test/gamma.js') !== -1) || 'no script: ' + r.status + ' ' + short(names);
}, test.limit.quick);
test.run('given no script, it answers each suite once', 0.2, async function () {
  if (!up()) return NONODE;
  const names = items(await call(N.base, 'testicle.suite.search', { text: '' })).map(suiteOf);
  const twice = names.filter(function (n, i) { return names.indexOf(n) !== i; });
  return (names.length > 0 && twice.length === 0) || 'answered twice: ' + short(twice.slice(0, 5)) + ' of ' + names.length;
}, test.limit.quick);
test.run('given no script, a suite of two scripts is answered once', 0.2, async function () {
  if (!up()) return NONODE;
  const names = items(await call(N.base, 'testicle.suite.search', { text: 'sibling' })).map(suiteOf);
  return names.filter(function (n) { return n === GENERAL; }).length === 1 || 'searched sibling: ' + short(names);
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
// script (file until the rename), suite, test, flipped, current, verified, tested, judged, severity.
test.run('testicle.set is served, and testicle.db holds the table testicle', 0.2, async function () {
  if (!up()) return NONODE;
  ts0 = Date.now();
  set1 = await call(N.base, 'testicle.testicle.set', { script: TH, suite: THS, test: 'theta answers its first question', verified: true, severity: 0.2 });
  k1 = tables(DB);
  return (set1.status === 200 && Array.isArray(k1.test)) || 'test.set: ' + set1.status + ' ' + short(set1.text) + '; table test ' + short(k1.test === null ? 'missing' : 'there');
}, test.limit.quick);
test.run('a set\'s script has its script row', 0.2, function () {
  if (!k1) return NONODE;
  return !!scriptRow(k1, TH) || 'no script row for ' + TH;
}, test.limit.quick);
test.run('and a suite row for every suite that concerns it', 0.2, function () {
  if (!k1) return NONODE;
  wantTheta = concerning(s.run, TH);
  return JSON.stringify(names(suiteRows(k1, TH))) === JSON.stringify(wantTheta) || 'rows ' + short(names(suiteRows(k1, TH))) + ', wanted ' + short(wantTheta);
}, test.limit.quick);
test.run('a test set for the first time has one row, current', 0.2, function () {
  if (!k1) return NONODE;
  tr1 = currentOf(k1, TH, THS, 'theta answers its first question')[0];
  return (testRows(k1, TH, THS, 'theta answers its first question').length === 1 && !!tr1) || 'rows: ' + short(testRows(k1, TH, THS, 'theta answers its first question'));
}, test.limit.quick);
test.run('the row holds its result and its severity', 0.2, function () {
  return (!!tr1 && yes(tr1.verified) && Number(tr1.severity) === 0.2) || 'row: ' + short(tr1);
}, test.limit.quick);
test.run('the row holds when it flipped and when it was tested, numeric UTC timestamps', 0.2, function () {
  return (!!tr1 && Number(tr1.flipped) >= ts0 - 1000 && Number(tr1.tested) >= ts0 - 1000 && Number(tr1.tested) <= Date.now()) || 'row: ' + short(tr1);
}, test.limit.quick);
test.run('the row is judged at the script\'s hash', 0.2, function () {
  if (!k1) return NONODE;
  return (!!tr1 && tr1.judged === (scriptRow(k1, TH) || {}).hash && typeof tr1.judged === 'string' && tr1.judged !== '') || 'judged ' + short(tr1 && tr1.judged) + ', the script\'s hash ' + short((scriptRow(k1, TH) || {}).hash);
}, test.limit.quick);

// the box: "If the test does not flip, the current row is only updated"
test.run('the same result again makes no new row', 0.2, async function () {
  if (!up()) return NONODE;
  await sleep(20);
  ts1 = Date.now();
  await call(N.base, 'testicle.testicle.set', { script: TH, suite: THS, test: 'theta answers its first question', verified: true, severity: 0.1 });
  k2 = tables(DB);
  tr2 = currentOf(k2, TH, THS, 'theta answers its first question')[0];
  return (testRows(k2, TH, THS, 'theta answers its first question').length === 1 && !!tr2) || 'rows: ' + short(testRows(k2, TH, THS, 'theta answers its first question'));
}, test.limit.quick);
test.run('the current row\'s tested moves, its flipped stays', 0.2, function () {
  return (!!tr2 && !!tr1 && Number(tr2.tested) >= ts1 && Number(tr2.flipped) === Number(tr1.flipped)) || 'before ' + short(tr1) + ', after ' + short(tr2);
}, test.limit.quick);
test.run('a lower severity leaves the row\'s severity as it was', 0.2, function () {
  return (!!tr2 && Number(tr2.severity) === 0.2) || 'severity after a set of 0.1: ' + short(tr2 && tr2.severity);
}, test.limit.quick);
test.run('with the script changed, the row is judged at its new hash', 0.2, async function () {
  if (!up()) return NONODE;
  fs.appendFileSync(path.join(s.run, TH), '// theta changed\n');
  await sleep(1000);
  await call(N.base, 'testicle.testicle.set', { script: TH, suite: THS, test: 'theta answers its first question', verified: true, severity: 0.5 });
  k3 = tables(DB);
  tr3 = currentOf(k3, TH, THS, 'theta answers its first question')[0];
  return (!!tr3 && !!tr1 && tr3.judged === (scriptRow(k3, TH) || {}).hash && tr3.judged !== tr1.judged) || 'judged ' + short(tr3 && tr3.judged) + ', the script\'s hash ' + short((scriptRow(k3, TH) || {}).hash);
}, test.limit.slow);
test.run('a higher severity is applied to the row', 0.2, function () {
  return (!!tr3 && Number(tr3.severity) === 0.5) || 'severity after a set of 0.5: ' + short(tr3 && tr3.severity);
}, test.limit.quick);

// the box: "If the test flips, a new active row is created"
test.run('a flip makes a second row, and one row alone is current', 0.2, async function () {
  if (!up()) return NONODE;
  ts2 = Date.now();
  await call(N.base, 'testicle.testicle.set', { script: TH, suite: THS, test: 'theta answers its first question', verified: false, severity: 0.6 });
  k4 = tables(DB);
  all4 = testRows(k4, TH, THS, 'theta answers its first question');
  cur4 = currentOf(k4, TH, THS, 'theta answers its first question');
  return (all4.length === 2 && cur4.length === 1) || 'rows: ' + short(all4);
}, test.limit.quick);
test.run('the new current row holds the new result, flipped now', 0.2, function () {
  return (cur4.length === 1 && no(cur4[0].verified) && Number(cur4[0].flipped) >= ts2) || 'current: ' + short(cur4);
}, test.limit.quick);
test.run('the row it replaces is kept, current no longer: the history', 0.2, function () {
  const old4 = all4.filter(function (r) { return !yes(r.current); })[0];
  return (!!old4 && !!tr1 && yes(old4.verified) && Number(old4.flipped) === Number(tr1.flipped)) || 'the old row: ' + short(old4);
}, test.limit.quick);
// theta's first question passes again: a third row of it, the history the searches below read. (Its old check, that the
// needs-testing flag stays, went with the struck line "This cycle does not clear a suite's needs-testing flag".)
test.run('the world: theta\'s first question passes again', 0.2, async function () {
  if (!up()) return NONODE;
  const r = await call(N.base, 'testicle.testicle.set', { script: TH, suite: THS, test: 'theta answers its first question', verified: true, severity: 0.6 });
  return r.status === 200 || 'testicle.set: ' + r.status + ' ' + short(r.text);
}, test.limit.quick);

// the box: "test.search will only return current test rows"
test.run('testicle.search answers a standard table search: items and more', 0.2, async function () {
  if (!up()) return NONODE;
  await call(N.base, 'testicle.testicle.set', { script: TH, suite: THS, test: 'theta answers its second question', verified: false, severity: 0.9 });
  await call(N.base, 'testicle.testicle.set', { script: TH, suite: THS, test: 'theta answers its third question', verified: false, severity: 0.3 });
  await call(N.base, 'testicle.testicle.set', { script: Z + 'gamma.js', suite: Z + 'test/gamma.js', test: 'gamma answers', verified: false, severity: 0.7 });
  sr = await call(N.base, 'testicle.testicle.search', { script: TH, suite: THS, text: '' });
  srRows = found(sr);
  return (sr.status === 200 && !!sr.body && Array.isArray(sr.body.items) && typeof sr.body.more === 'boolean') || 'test.search: ' + sr.status + ' ' + short(sr.text);
}, test.limit.quick);
test.run('for a script and suite it answers their current tests only, one row each', 0.2, function () {
  return (srRows.length === 3 && srRows.every(function (r) { return yes(r.current) && r.script === TH && r.suite === THS; })) || 'rows: ' + short(srRows);
}, test.limit.quick);
// goal/G47.1, the box: "Every test search answers its failed tests first, then by severity." theta's three: the second
// failed at 0.9, the third failed at 0.3, the first passed at 0.6.
test.run('testicle.search answers the failed tests first, then the most severe first', 0.2, function () {
  const got = srRows.map(function (r) { return (yes(r.verified) ? 'green ' : 'red ') + Number(r.severity); });
  return JSON.stringify(got) === JSON.stringify(['red 0.9', 'red 0.3', 'green 0.6']) || 'in order: ' + short(got);
}, test.limit.quick);
// the box: "Red, green, the script and the suite go to the server with the words, so the server narrows before it cuts".
test.run('result red answers the failed tests alone', 0.2, async function () {
  if (!up()) return NONODE;
  const r = found(await call(N.base, 'testicle.testicle.search', { script: TH, suite: THS, result: 'red', text: '' }));
  return (r.length === 2 && r.every(function (x) { return no(x.verified); })) || 'rows: ' + short(r);
}, test.limit.quick);
test.run('result green answers the passed tests alone', 0.2, async function () {
  if (!up()) return NONODE;
  const r = found(await call(N.base, 'testicle.testicle.search', { script: TH, suite: THS, result: 'green', text: '' }));
  return (r.length === 1 && yes(r[0].verified)) || 'rows: ' + short(r);
}, test.limit.quick);
test.run('a result neither red nor green is refused', 0.2, async function () {
  if (!up()) return NONODE;
  const r = await call(N.base, 'testicle.testicle.search', { result: 'blue', text: '' });
  return r.status === 400 || 'answered ' + r.status + ' ' + short(r.text);
}, test.limit.quick);
// the box: "the page asks for the following answers while the server says there are more".
test.run('from starts the answer after the rows already held', 0.2, async function () {
  if (!up()) return NONODE;
  const r = found(await call(N.base, 'testicle.testicle.search', { script: TH, suite: THS, from: 1, text: '' }));
  const got = r.map(function (x) { return (yes(x.verified) ? 'green ' : 'red ') + Number(x.severity); });
  return JSON.stringify(got) === JSON.stringify(['red 0.3', 'green 0.6']) || 'from 1: ' + short(got);
}, test.limit.quick);
test.run('with no script it searches that suite\'s tests for any script', 0.2, async function () {
  if (!up()) return NONODE;
  const anyScript = found(await call(N.base, 'testicle.testicle.search', { suite: THS, text: '' }));
  return (anyScript.length === 3 && anyScript.every(function (r) { return r.suite === THS && yes(r.current); })) || 'rows: ' + short(anyScript);
}, test.limit.quick);
test.run('with no suite it searches that script\'s tests in any suite', 0.2, async function () {
  if (!up()) return NONODE;
  const anySuite = found(await call(N.base, 'testicle.testicle.search', { script: Z + 'gamma.js', text: '' }));
  // gamma's tests in any suite: its own test's, and the classifier's classifyable row beside it (box v94, 1).
  return (anySuite.length >= 1 && anySuite.every(function (r) { return r.script === Z + 'gamma.js'; }) && anySuite.some(function (r) { return r.test === 'gamma answers'; }) && anySuite.every(function (r) { return r.test === 'gamma answers' || r.suite === 'spirit/test/scriptClassify.js'; })) || 'rows: ' + short(anySuite);
}, test.limit.quick);
test.run('with neither it searches every current test', 0.2, async function () {
  if (!up()) return NONODE;
  const ans = await call(N.base, 'testicle.testicle.search', { text: '' });
  const everyOne = found(ans);
  // The runner adds rows of its own runs (goal/G47.1, the queue cycle): the four set here are among them, and every one is current.
  const mine = everyOne.filter(function (r) { return ['theta answers its first question', 'theta answers its second question', 'theta answers its third question', 'gamma answers'].indexOf(r.test) !== -1; });
  // The answer fits its room (more: true when cut): cut, it holds current rows, as many as fit, the failed first (Andy:
  // "the empty search string with no script or suite selected should already fill up with more that 20 reds").
  if (ans.body && ans.body.more) {
    const cur = (tables(DB).test || []).filter(function (r) { return yes(r.current); }).length;
    const redFirst = everyOne.every(function (r, i) { return i === 0 || yes(r.verified) || no(everyOne[i - 1].verified); });
    return (everyOne.length > 0 && everyOne.length < cur && redFirst && everyOne.every(function (r) { return yes(r.current); })) || 'cut at ' + everyOne.length + ' of ' + cur + ' current rows, the failed first ' + redFirst + ': ' + short(everyOne.map(function (r) { return r.test; }));
  }
  return (mine.length === 4 && everyOne.every(function (r) { return yes(r.current); })) || mine.length + ' of the four set here, ' + everyOne.filter(function (r) { return !yes(r.current); }).length + ' not current, of ' + everyOne.length + ': ' + short(mine.map(function (r) { return r.test; }));
}, test.limit.quick);

// goal/G47.1, the cycle "the testicle search", the old ruling amended (Andy: "test.search will return only current test rows
// by default, unless a valid test-Title is supplied, in which case all rows will be show that match: \"script, suite AND
// title\""): given a test, every row of it, current or not, newest first. theta's first question was set passing, then
// failing, then passing again: three rows, one current.
let hist = [];
test.run('given a test title, testicle.search answers every row of that test, current or not', 0.2, async function () {
  if (!up()) return NONODE;
  hist = found(await call(N.base, 'testicle.testicle.search', { script: TH, suite: THS, test: 'theta answers its first question', text: '' }));
  const all = testRows(tables(DB), TH, THS, 'theta answers its first question');
  return (all.length === 3 && hist.length === 3 && hist.filter(function (r) { return yes(r.current); }).length === 1) || 'rows answered ' + short(hist) + '; rows kept ' + all.length;
}, test.limit.quick);
test.run('those rows come newest first', 0.2, function () {
  if (!up()) return NONODE;
  const f = hist.map(function (r) { return Number(r.flipped); });
  return (f.length === 3 && f[0] > f[1] && f[1] > f[2]) || 'flipped in order ' + short(f);
}, test.limit.quick);
test.run('and only rows of that script, suite and title', 0.2, function () {
  if (!up()) return NONODE;
  const other = hist.filter(function (r) { return r.script !== TH || r.suite !== THS || r.test !== 'theta answers its first question'; });
  return (hist.length > 0 && !other.length) || 'rows of another test: ' + short(other);
}, test.limit.quick);
test.run('without a test title it still answers the current rows alone', 0.2, async function () {
  if (!up()) return NONODE;
  const cur = found(await call(N.base, 'testicle.testicle.search', { script: TH, suite: THS, text: '' }));
  const mine = cur.filter(function (r) { return r.test === 'theta answers its first question'; });
  return (mine.length === 1 && yes(mine[0].current)) || 'rows of theta\'s first question: ' + short(mine);
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
test.run('the world: 40 passing tests of gamma at severity 1, and theta\'s quiet pass and quiet failure at severity 0', 0.2, async function () {
  if (!up()) return NONODE;
  const out = [];
  for (let i = 0; i < 40; i++) out.push(await call(N.base, 'testicle.testicle.set', { script: Z + 'gamma.js', suite: Z + 'test/gamma.js', test: LOUD(i), verified: true, severity: 1 }));
  out.push(await call(N.base, 'testicle.testicle.set', { script: TH, suite: THS, test: QUOKKA, verified: true, severity: 0 }));
  out.push(await call(N.base, 'testicle.testicle.set', { script: TH, suite: THS, test: WOMBAT, verified: false, severity: 0 }));
  loud = out.every(function (r) { return r.status === 200; });
  return loud || 'testicle.set: ' + short(out.filter(function (r) { return r.status !== 200; }).map(function (r) { return r.status + ' ' + r.text; }));
}, test.limit.slow);
test.run('the world: with nothing chosen, the answer is cut', 0.2, async function () {
  if (!loud) return 'the tests were not set: the world failed';
  const r = await ask({});
  return (r.status === 200 && !!r.body && r.body.more === true) || 'answer: ' + r.status + ' more ' + short(r.body && r.body.more) + ', ' + found(r).length + ' rows';
}, test.limit.quick);
test.run('with nothing chosen, a cut answer holds no passed test before a failed one', 0.2, async function () {
  if (!loud) return 'the tests were not set: the world failed';
  const rows = found(await ask({}));
  const firstPass = rows.findIndex(function (r) { return yes(r.verified); });
  const lateFail = firstPass === -1 ? -1 : rows.slice(firstPass).findIndex(function (r) { return no(r.verified); });
  return (rows.length > 0 && no(rows[0].verified) && lateFail === -1) || 'results in order: ' + short(rows.map(function (r) { return yes(r.verified) ? 'passed' : 'failed'; }));
}, test.limit.quick);
// The runner's own runs add failures of their own: the answer is judged against every failed current row of the table.
test.run('with nothing chosen, the quiet failure at severity 0 comes before 40 passed tests of severity 1', 0.2, async function () {
  if (!loud) return 'the tests were not set: the world failed';
  const rows = found(await ask({}));
  const reds = (tables(DB).test || []).filter(function (r) { return yes(r.current) && no(r.verified); }).length;
  const at = rows.findIndex(function (r) { return r.test === WOMBAT; });
  const firstPass = rows.findIndex(function (r) { return yes(r.verified); });
  if (firstPass === -1 && at === -1) return 'the answer holds ' + rows.length + ' failed tests and no pass; ' + reds + ' failed current rows, more than one answer holds: the quiet failure was not judged';
  return (at !== -1 && (firstPass === -1 || at < firstPass)) || 'the quiet failure at ' + at + ', the first pass at ' + firstPass + ', of ' + rows.length + ' rows (' + reds + ' failed current rows)';
}, test.limit.quick);
test.run('result red answers failed tests only', 0.2, async function () {
  if (!loud) return 'the tests were not set: the world failed';
  const r = await ask({ result: 'red' });
  const rows = found(r);
  return (r.status === 200 && rows.length > 0 && rows.every(function (x) { return no(x.verified) && yes(x.current); })) || 'result red: ' + r.status + ' ' + short(rows.length ? rows.map(function (x) { return x.verified + ' ' + x.test; }) : r.text);
}, test.limit.quick);
test.run('result green answers passed tests only', 0.2, async function () {
  if (!loud) return 'the tests were not set: the world failed';
  const r = await ask({ result: 'green' });
  const rows = found(r);
  return (r.status === 200 && rows.length > 0 && rows.every(function (x) { return yes(x.verified) && yes(x.current); })) || 'result green: ' + r.status + ' ' + short(rows.length ? rows.map(function (x) { return x.verified + ' ' + x.test; }) : r.text);
}, test.limit.quick);
test.run('result left out answers failed and passed tests both', 0.2, async function () {
  if (!loud) return 'the tests were not set: the world failed';
  const rows = found(await ask({ script: TH }));
  return (rows.some(function (x) { return no(x.verified); }) && rows.some(function (x) { return yes(x.verified); })) || 'theta\'s rows: ' + short(rows.map(function (x) { return x.verified + ' ' + x.test; }));
}, test.limit.quick);
test.run('result green narrows before the cut: theta chosen, its quiet pass is found beneath 40 louder passes', 0.2, async function () {
  if (!loud) return 'the tests were not set: the world failed';
  const r = await ask({ script: TH, result: 'green' });
  const rows = found(r);
  return (r.status === 200 && has(rows, QUOKKA) && rows.every(function (x) { return x.script === TH && yes(x.verified); })) || 'theta, green: ' + r.status + ' ' + short(rows.length ? rows.map(function (x) { return x.script + ' ' + x.verified + ' ' + x.test; }) : r.text);
}, test.limit.quick);
test.run('result green narrows before the cut: theta\'s suite chosen with no script, its quiet pass is found', 0.2, async function () {
  if (!loud) return 'the tests were not set: the world failed';
  const r = await ask({ suite: THS, result: 'green' });
  const rows = found(r);
  return (r.status === 200 && has(rows, QUOKKA) && rows.every(function (x) { return x.suite === THS && yes(x.verified); })) || 'theta\'s suite, green: ' + r.status + ' ' + short(rows.length ? rows.map(function (x) { return x.suite + ' ' + x.verified + ' ' + x.test; }) : r.text);
}, test.limit.quick);
test.run('with green alone, nothing chosen, the answer is all passes and none of them failed', 0.2, async function () {
  if (!loud) return 'the tests were not set: the world failed';
  const rows = found(await ask({ result: 'green' }));
  return (rows.length > 0 && !has(rows, WOMBAT) && rows.every(function (x) { return yes(x.verified); })) || 'green alone: ' + short(rows.map(function (x) { return x.verified + ' ' + x.test; }));
}, test.limit.quick);
test.run('typed words narrow before the cut: "quokka" finds theta\'s quiet pass beneath 40 louder passes', 0.2, async function () {
  if (!loud) return 'the tests were not set: the world failed';
  const rows = found(await ask({ text: 'quokka' }));
  return has(rows, QUOKKA) || '"quokka" found ' + short(rows.map(function (x) { return x.test; }));
}, test.limit.quick);
test.run('typed words and result together: "quokka" with result red finds no passed test', 0.2, async function () {
  if (!loud) return 'the tests were not set: the world failed';
  const r = await ask({ text: 'quokka', result: 'red' });
  const rows = found(r);
  return (r.status === 200 && !has(rows, QUOKKA) && rows.every(function (x) { return no(x.verified); })) || '"quokka", red: ' + r.status + ' ' + short(rows.length ? rows.map(function (x) { return x.verified + ' ' + x.test; }) : r.text);
}, test.limit.quick);
test.run('typed words and result together: "wombat" with result red finds theta\'s quiet failure', 0.2, async function () {
  if (!loud) return 'the tests were not set: the world failed';
  const r = await ask({ text: 'wombat', result: 'red' });
  return (r.status === 200 && has(found(r), WOMBAT)) || '"wombat", red: ' + r.status + ' ' + short(found(r).map(function (x) { return x.test; }).concat(r.status === 200 ? [] : [r.text]));
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
// The first item of the following answer of a testicle.search, the rows already held skipped.
const nextItem = async function (args, held) {
  const r = await call(N.base, 'testicle.testicle.search', Object.assign({}, args, { from: held }));
  return (r.body && r.body.items && r.body.items[0]) || null;
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
  if (r.status !== 200 || !r.body || !Array.isArray(r.body.items)) return 'answer: ' + r.status + ' ' + short(r.text);
  const rows = found(r);
  const got = {};
  rows.forEach(function (x) { got[keyOf2(x)] = true; });
  const may = {};
  (allowed || want).forEach(function (x) { may[keyOf2(x)] = true; });
  const stray = rows.filter(function (x) { return !may[keyOf2(x)]; });
  if (stray.length) return stray.length + ' rows answered outside the script, suite or result asked: ' + short(stray.map(keyOf2));
  if (!r.body.more) {
    const missing = want.filter(function (x) { return !got[keyOf2(x)]; });
    return !missing.length || 'not cut, ' + rows.length + ' rows answered of ' + want.length + ' that match; missing ' + short(missing.map(keyOf2));
  }
  const missing = want.filter(function (x) { return !got[keyOf2(x)]; });
  if (!fullAnswer(r.body, next)) return 'cut at ' + rows.length + ' rows, ' + bytes(r.body.items) + ' bytes of a room of ' + ROOM + ': not full; ' + want.length + ' match';
  // Cut and full: of the rows that match, as many as the answer holds are in it, never fewer.
  return (want.length - missing.length >= Math.min(rows.length, want.length)) || 'cut and full at ' + rows.length + ' rows, but only ' + (want.length - missing.length) + ' of the ' + want.length + ' that match the words are among them';
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
test.run('the world: the runner idle, so the table holds still while every variation is asked', 0.2, async function () {
  if (!loud) return 'the tests were not set: the world failed';
  return (await idle(240000)) || 'the runner did not go idle';
}, test.limit.long);
// One test, its answer naming each variation that breaks (titles are fixed words, goal/G47.2).
const eachOf = async function (list, one) {
  const bad = [];
  for (const v of list) { const r = await one(v); if (r !== true) bad.push(v[0] + ': ' + r); }
  return bad.length === 0 || bad.length + ' of ' + list.length + ' break: ' + bad.join(' | ');
};
test.run('testicle.search, in each of its variations: every matching test, or a full answer of matching tests', 0.2, async function () {
  if (!loud) return 'the tests were not set: the world failed';
  return eachOf(VARIATIONS, async function (v) {
    const a = Object.assign({ text: '' }, v[1]);
    const r = await call(N.base, 'testicle.testicle.search', a);
    const next = r.body && r.body.more ? await nextItem(a, found(r).length) : null;
    return judged(r, matchingTests(a), tkey, matchingTests(Object.assign({}, a, { text: '' })), next);
  });
}, test.limit.slow);
// The following answers (from, the rows already held, cw's build): asked page after page, each page that says more is
// full, and the pages together hold every matching test, each once.
const PAGED = [
  ['nothing chosen', {}],
  ['result green', { result: 'green' }],
  ['the word "loudly"', { text: 'loudly' }],
];
test.run('testicle.search page after page, nothing chosen, result green and the word "loudly": each page full while there are more, every matching test once', 0.2, async function () {
  if (!loud) return 'the tests were not set: the world failed';
  return eachOf(PAGED, async function (v) {
    const a = Object.assign({ text: '' }, v[1]);
    const want = matchingTests(a);
    const seen = {};
    let from = 0, twice = [], pages = 0;
    for (;;) {
      const r = await call(N.base, 'testicle.testicle.search', Object.assign({ from: from }, a));
      if (r.status !== 200 || !r.body || !Array.isArray(r.body.items)) return 'page ' + pages + ': ' + r.status + ' ' + short(r.text);
      const rows = found(r);
      pages += 1;
      rows.forEach(function (x) { if (seen[tkey(x)]) twice.push(tkey(x)); seen[tkey(x)] = true; });
      if (!r.body.more) break;
      if (!fullAnswer(r.body, await nextItem(a, from + rows.length))) return 'page ' + pages + ' says more but is not full: ' + rows.length + ' rows, ' + bytes(r.body.items) + ' bytes of ' + ROOM;
      if (!rows.length || pages > 100) return 'page ' + pages + ' says more and holds ' + rows.length + ' rows';
      from += rows.length;
    }
    const missing = want.filter(function (x) { return !seen[tkey(x)]; });
    return (!missing.length && !twice.length) || pages + ' pages; missing ' + missing.length + ' of ' + want.length + ' ' + short(missing.map(tkey)) + '; twice ' + short(twice);
  });
}, test.limit.slow);
test.run('testicle.red: every failed current test, or a full answer of them', 0.2, async function () {
  if (!loud) return 'the tests were not set: the world failed';
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
test.run('suite.search, with and without a script and words: every matching suite, or a full answer of them', 0.2, async function () {
  if (!loud) return 'the tests were not set: the world failed';
  return eachOf(SUITE_ASKS, async function (v) {
    const a = v[1] ? { script: v[1], text: v[2] } : { text: v[2] };
    const r = await call(N.base, 'testicle.suite.search', a);
    return judged(r, matchingSuites(v[1], v[2]), function (x) { return v[1] ? x.script + '|' + x.suite : x.suite; }, matchingSuites(v[1], ''));
  });
}, test.limit.slow);

// the box: "The verb red is testicle.red"
test.run('testicle.red answers every failed current test, and no other', 0.2, async function () {
  if (!up()) return NONODE;
  // The runner's own runs write while it works: red is asked once it is idle, so the table it is compared with holds still.
  await idle(240000);
  const redAns = await call(N.base, 'testicle.red', {});
  red = found(redAns);
  // The runner adds failures of its own runs (goal/G47.1, the queue cycle): every failed current row of the table, no other.
  const want = (tables(DB).test || []).filter(function (r) { return yes(r.current) && no(r.verified); }).length;
  // The answer fits its room (more: true when cut): cut, every row of it failed and current, fewer than the table holds.
  if (redAns.body && redAns.body.more) return (red.length > 0 && red.length < want && red.every(function (r) { return no(r.verified) && yes(r.current); })) || 'cut at ' + red.length + ' of ' + want + ': ' + short(red.map(function (r) { return r.test; }));
  return (red.length === want && red.length >= 3 && red.every(function (r) { return no(r.verified) && yes(r.current); })) || want + ' failed current rows; red answered ' + short(red);
}, test.limit.long);
test.run('testicle.red answers the most severe first', 0.2, function () {
  const redSev = red.map(function (r) { return Number(r.severity); });
  return (redSev.length >= 3 && redSev.every(function (v, i) { return i === 0 || redSev[i - 1] >= v; })) || 'severities in order: ' + short(redSev);
}, test.limit.quick);

// Before the general test changes: that one judges every product file, the untouched among them.
// the box: "A product file or a suite that has not changed has no row"
test.run('a changed file that is no product script gets no row', 0.2, async function () {
  if (!up()) return NONODE;
  append(Z + 'notes.md', 'no script\n');
  n1 = await after();
  return !scriptRow(n1, Z + 'notes.md') || 'a row for notes.md: ' + short(scriptRow(n1, Z + 'notes.md'));
}, test.limit.slow);

// the box: "When a suite ... is changed": a general test
test.run('the world: the changed general test judges every product file', 0.2, function () {
  if (!up()) return NONODE;
  reach = judgedBy(s.run, GENERAL);
  // In debug mode (box v143) every product file is every product script under spirit/app/testicle/, the planted among them.
  const walk = function (rel) { let out = []; fs.readdirSync(path.join(s.run, rel), { withFileTypes: true }).forEach(function (e) { const r = rel + '/' + e.name; if (e.isDirectory()) { if (e.name !== 'test') out = out.concat(walk(r)); } else if (/\.js$/.test(e.name)) out.push(r); }); return out; };
  const want = walk('spirit/app/testicle');
  const missed = want.filter(function (f) { return reach.indexOf(f) === -1; });
  return (want.length > 0 && !missed.length) || 'it judges ' + reach.length + ' of ' + want.length + ', not ' + short(missed.slice(0, 5));
}, test.limit.quick);
test.run('while it works on a changed general test, busy answers true', 0.2, async function () {
  if (!up()) return NONODE;
  append(GENERAL, '// a general test changed\n');
  // While it does that work, busy answers true; asked over and over in that second, it says so at least once.
  seen = [];
  const stopAt = Date.now() + 1000;
  while (Date.now() < stopAt) { const b = await call(N.base, 'testicle.busy', {}); seen.push(b.body === true || (b.body && b.body.busy === true)); }
  r1 = tables(DB);
  return seen.indexOf(true) !== -1 || 'busy asked ' + seen.length + ' times in that second, never true';
}, test.limit.slow);
test.run('once that work is done, busy answers false again', 0.2, async function () {
  if (!up()) return NONODE;
  // The runner works off what the changes flagged before it is idle (goal/G47.1, the queue cycle).
  let done = null;
  const ok = await until(function () { return call(N.base, 'testicle.busy', {}).then(function (r) { done = r; return r.status === 200 && (r.body === false || (r.body && r.body.busy === false)); }); }, 240000);
  return !!ok || 'busy after: ' + (done && done.status) + ' ' + short(done && done.text);
}, test.limit.long);
test.run('one second after a general test changes, every file it judges has its suite row for it', 0.2, function () {
  if (!r1) return NONODE;
  const missing = reach.filter(function (f) { return !suiteRow(r1, f, GENERAL); });
  return (reach.length > 0 && !missing.length) || missing.length + ' of ' + reach.length + ' have none, the first: ' + short(missing.slice(0, 5));
}, test.limit.quick);
test.run('and every one of those files has its row in script', 0.2, function () {
  if (!r1) return NONODE;
  const unfiled = reach.filter(function (f) { return !scriptRow(r1, f); });
  return (reach.length > 0 && !unfiled.length) || unfiled.length + ' of ' + reach.length + ' have none, the first: ' + short(unfiled.slice(0, 5));
}, test.limit.quick);

// the box: "A removed file's row is marked deleted"
test.run('one second after a product file is removed, its row is marked deleted', 0.2, async function () {
  if (!up()) return NONODE;
  fs.rmSync(path.join(s.run, Z + 'alpha.js'));
  x1 = await after();
  const gone = scriptRow(x1, Z + 'alpha.js');
  return (!!gone && yes(gone.deleted)) || 'row: ' + short(gone);
}, test.limit.slow);
test.run('and its suite rows are marked deleted', 0.2, function () {
  if (!x1) return NONODE;
  const left = suiteRows(x1, Z + 'alpha.js').filter(function (r) { return !yes(r.deleted); });
  return (suiteRows(x1, Z + 'alpha.js').length > 0 && !left.length) || 'not deleted: ' + short(names(left));
}, test.limit.quick);
// A RESULT ARRIVING AFTER THE FILE IS GONE (found on wsl's node, 2026-11-13: a classifier run that began before zzList's two
// files were removed reported 2 s after, and their classifier rows stood live and red in his list for hours): the box's "A
// removed file's row is marked deleted" holds for a late result too.
let late = null;
test.run('a result reported for a removed file is refused "no such file"', 0.2, async function () {
  if (!x1) return NONODE;
  late = await call(N.base, 'testicle.testicle.set', { script: Z + 'alpha.js', suite: 'spirit/test/scriptClassify.js', test: 'classifyable', verified: false, severity: 0.8 });
  return (late.status !== 200 && /no such file/.test(late.text)) || 'testicle.set answered ' + late.status + ' ' + short(late.text);
}, test.limit.quick);
test.run('and every suite row of the removed file stays deleted', 0.2, async function () {
  if (!late) return NONODE;
  const t = await after();
  const live = suiteRows(t, Z + 'alpha.js').filter(function (r) { return !yes(r.deleted); });
  return (suiteRows(t, Z + 'alpha.js').length > 0 && !live.length) || 'live again: ' + short(names(live));
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
  if (!up()) return NONODE;
  const api = await call(N.base, 'api', { family: 'testicle' });
  const iface = String((api.body && api.body.interface) || '');
  return /['"]?\brun['"]?\s*:/.test(iface) || 'testicle\'s api: ' + short(iface);
}, test.limit.quick);
test.run('run answers at once, before its suite has ended', 0.2, async function () {
  if (!up()) return NONODE;
  const t0 = Date.now();
  run1 = await call(N.base, 'testicle.run', { script: KA, suite: KAS });
  const took = Date.now() - t0;
  const early = rowOf(KA, KAS, 'kappa answers its first');
  return (run1.status === 200 && took < 2500 && !early) || 'run: ' + run1.status + ' ' + short(run1.text) + ' after ' + took + ' ms; kappa\'s first already ' + short(early);
}, test.limit.quick);
test.run('without testicle, the whole suite runs: every test of it reports to testicle', 0.2, async function () {
  if (!up()) return NONODE;
  const names0 = ['the world: kappa waits a moment', 'kappa answers its first', 'kappa fails its second', 'kappa was started with no argument'];
  // A press waits behind the running job, which may take up to its 2-minute limit (the queue cycle).
  const ok = await until(function () { return Promise.resolve(names0.every(function (n) { return !!rowOf(KA, KAS, n); })); }, 240000);
  return !!ok || 'rows: ' + short(names0.map(function (n) { return [n, !!rowOf(KA, KAS, n)]; }));
}, test.limit.long);
test.run('each row holds the result its test gave', 0.2, function () {
  if (!up()) return NONODE;
  const a = rowOf(KA, KAS, 'kappa answers its first'), b = rowOf(KA, KAS, 'kappa fails its second');
  return (!!a && !!b && yes(a.verified) && no(b.verified)) || 'first ' + short(a) + ', second ' + short(b);
}, test.limit.quick);
test.run('a script\'s own test is started with no argument', 0.2, function () {
  if (!up()) return NONODE;
  const r = rowOf(KA, KAS, 'kappa was started with no argument');
  return (!!r && yes(r.verified)) || 'its row: ' + short(r);
}, test.limit.quick);
test.run('with testicle given, the suite runs up to that test and no test after it', 0.2, async function () {
  if (!up()) return NONODE;
  // A first report of lambda makes its rows, flagged, and the runner then runs its whole suite (the queue cycle): lambda's rows
  // are made and its whole suite run first, so nothing of lambda is flagged when the run up to a test is asked. Then this run is told
  // by when each row was tested: its second and its first after the press, its third not.
  // script.get makes lambda's rows, flagged, and the flag wakes the runner, which runs lambda's suites, its own whole. (A whole
  // run asked before the rows are there makes them during that run, so they stay flagged and it comes round again.)
  const g = await call(N.base, 'testicle.script.get', { name: LA });
  if (g.status !== 200) return 'script.get: ' + g.status + ' ' + short(g.text);
  // Its rows there, its whole run is put at the head of the queue, ahead of every general suite still flagged.
  const w = await call(N.base, 'testicle.run', { script: LA, suite: LAS });
  if (w.status !== 200) return 'the whole run: ' + w.status + ' ' + short(w.text);
  // Other suites may run meanwhile; what matters is that lambda's own suite is no longer flagged, so no whole run of it follows.
  const settled = await until(function () { const u = suiteRow(tables(DB), LA, LAS); return Promise.resolve(!!rowOf(LA, LAS, 'lambda answers its third') && !!u && !yes(u.test)); }, 150000);
  if (!settled) { const t = tables(DB); return 'lambda\'s own suite still flagged after its whole run: nothing judged; its row ' + short(suiteRow(t, LA, LAS)) + '; lambda.js\'s script row ' + short(scriptRow(t, LA)) + ', its suite rows ' + short(suiteRows(t, LA).map(function (r) { return r.suite + ' ' + r.test; })) + '; script.get answered ' + short(g.body); }
  const t0 = Date.now();
  const r = await call(N.base, 'testicle.run', { script: LA, suite: LAS, testicle: 'lambda answers its second' });
  if (r.status !== 200) return 'run: ' + r.status + ' ' + short(r.text);
  const since = function (name) { const x = rowOf(LA, LAS, name); return !!x && Number(x.tested) >= t0; };
  const ok = await until(function () { return Promise.resolve(since('lambda answers its second')); }, 90000);
  await sleep(5000);
  const three = rowOf(LA, LAS, 'lambda answers its third');
  return (!!ok && since('lambda answers its first') && !since('lambda answers its third')) || 'second ' + !!ok + ', first ' + short(rowOf(LA, LAS, 'lambda answers its first')) + ', third ' + short(three);
}, test.limit.long);
test.run('a general test is started with the script as its argument, and reports for that script', 0.2, async function () {
  if (!up()) return NONODE;
  const r = await call(N.base, 'testicle.run', { script: MU, suite: MUS });
  if (r.status !== 200) return 'run: ' + r.status + ' ' + short(r.text);
  await until(function () { return Promise.resolve(!!rowOf(MU, MUS, 'mu holds its rule')); }, 240000);
  const m = rowOf(MU, MUS, 'mu holds its rule');
  return (!!m && yes(m.verified)) || 'its row: ' + short(m);
}, test.limit.slow);

// goal/G47.1, the box (v57): a suite's status, the server's alone, from its own table: "needs running" when it never ran
// (Andy: "it shows "needs running" when it never ran"), "still red" when it ran with a failed test for the script, "green" when
// every test of it passed; a changed script shows "needs running" again (Andy: "if the script changed, then it shows "needs
// running" again, and the flag on the row is changed"); no suite touches the flag (Andy: "the suites have NO business changing
// the "needs running" flag on the suite rows!"). Read as suite.search serves the row.
async function statusOf(script, suite) {
  const all = items(await call(N.base, 'testicle.suite.search', { script: script, text: '' }));
  const r = all.filter(function (i) { return suiteOf(i) === suite; })[0];
  return r ? String(r.row.status) : 'no row of ' + suite + ' among ' + short(all.map(function (i) { return suiteOf(i) + ' ' + i.row.status; }));
}
test.run('a suite that never ran shows "needs running"', 0.2, async function () {
  if (!up()) return NONODE;
  // The runner runs every flagged suite a second after the last change (the queue cycle): a suite never run is one just
  // flagged, read inside that second. phi and its own test are planted and touched here first.
  append(Z + 'phi.js', '// phi, changed\n');
  let st = null;
  const ok = await until(function () { return statusOf(Z + 'phi.js', Z + 'test/phi.js').then(function (x) { st = x; return x === 'needs running'; }); }, 900);
  return !!ok || 'phi\'s own suite, within the quiet second: ' + short(st);
}, test.limit.quick);
test.run('a suite whose every test passed shows "green"', 0.2, async function () {
  if (!up()) return NONODE;
  let st = null;
  const ok = await until(function () { return statusOf(MU, MUS).then(function (x) { st = x; return x === 'green'; }); }, 10000);
  return !!ok || 'mu\'s suite: ' + short(st);
}, test.limit.slow);
test.run('a suite that ran with a failed test for the script shows "still red"', 0.2, async function () {
  if (!up()) return NONODE;
  let st = null;
  const ok = await until(function () { return statusOf(KA, KAS).then(function (x) { st = x; return x === 'still red'; }); }, 10000);
  return !!ok || 'kappa\'s suite: ' + short(st);
}, test.limit.slow);
test.run('the script changed, its suite shows "needs running" again', 0.2, async function () {
  if (!up()) return NONODE;
  append(MU, '// mu, changed\n');
  let st = null;
  const ok = await until(function () { return statusOf(MU, MUS).then(function (x) { st = x; return x === 'needs running'; }); }, 10000);
  return !!ok || 'mu\'s suite after mu changed: ' + short(st);
}, test.limit.slow);

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
test.run('the world: the queue is worked off, the server idle', 0.2, async function () {
  if (!up()) return NONODE;
  const ok = await idle(280000);
  return !!ok || 'still busy after 280 s';
}, test.limit.long);
test.run('the world: nu.js and xi.js change, nu.js twice, 600 ms apart', 0.2, async function () {
  if (!up()) return NONODE;
  append(NU, '// nu, changed\n'); append(XI, '// xi, changed\n'); append(EARLY, '// early, changed\n');
  await sleep(600);
  append(NU, '// nu, changed again\n');
  lastChange = Date.now();
  return !runlog().length || 'the run log is not empty before: ' + short(runlog());
}, test.limit.quick);
test.run('a flagged suite runs by itself, with no run asked: nu\'s and xi\'s own suites start', 0.2, async function () {
  if (!up()) return NONODE;
  const ok = await until(function () { return Promise.resolve(ends('nu').length > 0 && ends('xi').length > 0); }, 240000);
  return !!ok || 'the run log: ' + short(runlog());
}, test.limit.long);
test.run('the runner starts no sooner than 1 second after the last change: the second change pushed the start back', 0.2, function () {
  if (!up()) return NONODE;
  const t = tables(DB);
  const first = (t.test || []).filter(function (r) { return (r.script === NU || r.script === XI) && Number(r.tested) >= lastChange - 600; }).map(function (r) { return Number(r.tested); }).sort()[0];
  return (!!first && first >= lastChange + 1000) || 'the first result for nu or xi at ' + (first ? first - lastChange : 'none') + ' ms after the last change';
}, test.limit.quick);
test.run('one runner: nu\'s and xi\'s runs never overlap', 0.2, function () {
  const a = [starts('nu')[0], ends('nu')[0]], b = [starts('xi')[0], ends('xi')[0]];
  if (!a[0] || !a[1] || !b[0] || !b[1]) return 'the run log: ' + short(runlog());
  return (a[1].at <= b[0].at || b[1].at <= a[0].at) || 'nu ran ' + a[0].at + '-' + a[1].at + ', xi ' + b[0].at + '-' + b[1].at;
}, test.limit.quick);
test.run('a suite flagged twice is owed one run: nu\'s own suite ran once', 0.2, async function () {
  await sleep(3000);
  return starts('nu').length === 1 || 'nu started ' + starts('nu').length + ' times';
}, test.limit.slow);
test.run('general tests first: every general result for nu.js came before nu\'s own suite started', 0.2, function () {
  if (!up()) return NONODE;
  const own0 = (starts('nu')[0] || {}).at;
  const gen = (tables(DB).test || []).filter(function (r) { return r.script === NU && r.suite !== NUS && Number(r.tested) >= lastChange; });
  return (!!own0 && gen.length > 0 && gen.every(function (r) { return Number(r.tested) < own0; })) || gen.length + ' general results for nu.js, ' + gen.filter(function (r) { return Number(r.tested) >= own0; }).length + ' after its own suite started';
}, test.limit.quick);
test.run('general tests first, though the own suite sorts first by name: every general result for early.js came before early\'s own suite started', 0.2, async function () {
  if (!up()) return NONODE;
  await until(function () { return Promise.resolve(starts('early').length > 0); }, 120000);
  const own0 = (starts('early')[0] || {}).at;
  const gen = (tables(DB).test || []).filter(function (r) { return r.script === EARLY && r.suite !== EARLYS && Number(r.tested) >= lastChange; });
  return (!!own0 && gen.length > 0 && gen.every(function (r) { return Number(r.tested) < own0; })) || 'early started ' + own0 + '; ' + gen.length + ' general results for early.js, ' + gen.filter(function (r) { return Number(r.tested) >= own0; }).length + ' after its own suite started';
}, test.limit.long);
test.run('a result carries both hashes it ran against, the script\'s and the suite\'s', 0.2, function () {
  if (!up()) return NONODE;
  const t = tables(DB);
  const r = currentOf(t, NU, NUS, 'nu answers')[0], sc = scriptRow(t, NU), su = suiteRow(t, NU, NUS);
  return (!!r && !!sc && !!su && holds(r, sc.hash) && holds(r, su.hash)) || 'the row ' + short(r) + '; script hash ' + short(sc && sc.hash) + ', suite hash ' + short(su && su.hash);
}, test.limit.quick);

// A change during a run: the run keeps the hashes it started with, and the suite comes round again behind it.
let piHash = '';
test.run('the world: pi.js changes, and changes again while its own suite runs', 0.2, async function () {
  if (!up()) return NONODE;
  append(PI, '// pi, changed\n');
  const ok = await until(function () { return Promise.resolve(starts('pi').length > 0); }, 240000);
  piHash = (scriptRow(tables(DB), PI) || {}).hash || '';
  append(PI, '// pi, changed during its run\n');
  return (!!ok && !!piHash) || 'pi never started: ' + short(runlog());
}, test.limit.long);
test.run('the running job is not killed by a change: pi\'s first run ends', 0.2, async function () {
  const ok = await until(function () { return Promise.resolve(ends('pi').length > 0); }, 30000);
  return !!ok || 'the run log: ' + short(runlog().filter(function (l) { return l.suite === 'pi'; }));
}, test.limit.slow);
test.run('a result of that run carries the script\'s hash as it stood when the run started', 0.2, async function () {
  if (!up()) return NONODE;
  let rows = [];
  await until(function () { rows = testRows(tables(DB), PI, PIS, 'pi answers'); return Promise.resolve(rows.some(function (r) { return holds(r, piHash); })); }, 20000);
  return rows.some(function (r) { return holds(r, piHash); }) || 'pi\'s rows ' + short(rows) + ', the hash at its start ' + short(piHash) + '; all rows of pi.js: ' + short((tables(DB).test || []).filter(function (r) { return r.script === PI; }));
}, test.limit.slow);
test.run('the suite comes round again behind it: pi\'s own suite runs a second time, after the first ended', 0.2, async function () {
  const ok = await until(function () { return Promise.resolve(starts('pi').length >= 2); }, 240000);
  const e1 = (ends('pi')[0] || {}).at, s2 = (starts('pi')[1] || {}).at;
  return (!!ok && !!e1 && s2 >= e1) || 'the run log: ' + short(runlog().filter(function (l) { return l.suite === 'pi'; }));
}, test.limit.long);

// The 🏃‍♂️'s verb puts its suite at the head of the queue: tau, asked while omicron's suites wait, runs before omicron's own.
test.run('the world: omicron.js changes, and tau\'s own suite is asked by testicle.run', 0.2, async function () {
  if (!up()) return NONODE;
  append(OM, '// omicron, changed\n');
  await sleep(1500);
  const r = await call(N.base, 'testicle.run', { script: TAU, suite: TAUS });
  return r.status === 200 || 'run: ' + r.status + ' ' + short(r.text);
}, test.limit.slow);
test.run('a suite asked by testicle.run goes to the head of the queue: tau runs before omicron\'s own suite', 0.2, async function () {
  const ok = await until(function () { return Promise.resolve(ends('tau').length > 0 && starts('omicron').length > 0); }, 240000);
  const t = (starts('tau')[0] || {}).at, o = (starts('omicron')[0] || {}).at;
  return (!!ok && t < o) || 'tau started ' + t + ', omicron ' + o + ': ' + short(runlog().filter(function (l) { return l.suite === 'tau' || l.suite === 'omicron'; }));
}, test.limit.long);
test.run('never a second run beside the running one: tau started after every run before it ended', 0.2, function () {
  const t = (starts('tau')[0] || {}).at;
  const open = runlog().filter(function (l) { return l.ev === 'start' && l.suite !== 'tau' && l.at < t && !runlog().some(function (e) { return e.suite === l.suite && e.ev === 'end' && e.at >= l.at && e.at <= t; }); });
  return (!!t && !open.length) || 'running when tau started: ' + short(open);
}, test.limit.quick);

// Rows flagged when the server starts: upsilon.js flagged, the node stopped before the runner reached it, started again.
test.run('the world: upsilon.js is flagged, and the node stops before upsilon\'s suite runs', 0.2, async function () {
  if (!up()) return NONODE;
  append(UP, '// upsilon, changed\n');
  const ok = await until(function () { return Promise.resolve(yes((suiteRow(tables(DB), UP, UPS) || {}).test)); }, 5000);
  await stop(N.child);
  return (!!ok && !starts('upsilon').length) || 'upsilon flagged ' + !!ok + ', its suite already started ' + starts('upsilon').length;
}, test.limit.slow);
// goal/G47.1, box v95, 5: the server is not always on, and its tables must not be stale for it. While the node is down: a
// new script and its own test written, a script changed, a suite removed, a script removed.
const NEWS = Z + 'zzsNew.js', NEWSS = Z + 'test/zzsNew.js';
let down = null;
test.run('the world: while the node is down, a script and its suite are added, one changed, a suite and a script removed', 0.2, function () {
  if (!N || !N.child || N.child.exitCode === null) return 'the node is not down: the world failed';
  const t = tables(DB);
  const changed = scriptRow(t, LA), goneSuite = suiteRow(t, KA, KAS), goneScript = scriptRow(t, Z + 'gamma.js');
  if (!changed || !goneSuite || !goneScript) return 'rows missing before: lambda ' + !!changed + ', kappa\'s own suite ' + !!goneSuite + ', gamma ' + !!goneScript;
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
  if (!up()) return 'the scratch node did not come up again';
  const ok = await until(function () { return Promise.resolve(ends('upsilon').length > 0); }, 240000);
  return !!ok || 'upsilon after the restart: ' + short(runlog().filter(function (l) { return l.suite === 'upsilon'; }));
}, test.limit.long);
test.run('after the start, the classifier having changed while down, every live script is classified again, right away', 0.2, async function () {
  if (!down) return 'nothing changed while down: the world failed';
  let left = [];
  const ok = await until(function () { const t = tables(DB); left = t.script.filter(function (r) { if (!no(r.deleted)) return false; const c = classifyRowAt(t, r.name); return !c || Number(c.tested) < down.at; }); return Promise.resolve(left.length === 0); }, 280000);
  return !!ok || left.length + ' live scripts not classified again since the start: ' + short(left.slice(0, 5).map(function (r) { return r.name; }));
}, test.limit.long);
test.run('after the start, a script written while it was down has its row, and its own suite its suite row', 0.2, async function () {
  if (!down) return 'nothing changed while down: the world failed';
  const ok = await until(function () { const t = tables(DB); return Promise.resolve(!!scriptRow(t, NEWS) && !!suiteRow(t, NEWS, NEWSS)); }, 60000);
  const t = tables(DB);
  return !!ok || 'zzsNew: ' + short(scriptRow(t, NEWS)) + ', its suite ' + short(suiteRow(t, NEWS, NEWSS));
}, test.limit.long);
test.run('after the start, a script changed while it was down holds its new hash', 0.2, function () {
  if (!down) return 'nothing changed while down: the world failed';
  const r = scriptRow(tables(DB), LA);
  return (!!r && r.hash !== down.laHash) || 'lambda: ' + short(r) + ', its hash before ' + short(down.laHash);
}, test.limit.quick);
test.run('after the start, a suite removed while it was down is marked deleted, and none of its results is current', 0.2, function () {
  if (!down) return 'nothing changed while down: the world failed';
  const t = tables(DB);
  const r = suiteRow(t, KA, KAS);
  const cur = (t.test || []).filter(function (x) { return x.script === KA && x.suite === KAS && yes(x.current); });
  return (!!r && yes(r.deleted) && cur.length === 0) || 'kappa\'s own suite row ' + short(r) + ', its current results ' + cur.length;
}, test.limit.quick);
test.run('and the search shows its results no more', 0.2, async function () {
  if (!down) return 'nothing changed while down: the world failed';
  const r = await call(N.base, 'testicle.search', { script: KA, suite: KAS, text: '' });
  const rows = found(r);
  return (r.status === 200 && rows.length === 0) || 'testicle.search of kappa\'s own suite: ' + short(rows.slice(0, 3));
}, test.limit.quick);
test.run('after the start, a script removed while it was down is marked deleted', 0.2, function () {
  if (!down) return 'nothing changed while down: the world failed';
  const r = scriptRow(tables(DB), Z + 'gamma.js');
  return (!!r && yes(r.deleted)) || 'gamma: ' + short(r);
}, test.limit.quick);

// A HANG FAILS AT ITS TEST'S OWN LIMIT (goal/G47.1: testicle's job limit is 120 minutes, cw's 3cf0379b on Andy's "make the
// limit 120 minutes"; Andy: "a single test still has the same limit!"): rho reports its first test, then hangs; sigma's
// first test hangs while its process is kept alive. Each hang has the quick limit (10 s): the reporter fails it there, long
// before testicle's own limit.
test.run('the world: rho.js and sigma.js change', 0.2, async function () {
  if (!up()) return NONODE;
  append(RHO, '// rho, changed\n');
  append(SIG, '// sigma, changed\n');
  const ok = await until(function () { return Promise.resolve(starts('rho').length > 0); }, 240000);
  return !!ok || 'rho never started: ' + short(runlog());
}, test.limit.long);
test.run('a test that hangs fails at its own limit: rho hangs is red, rho answers its first green', 0.2, async function () {
  if (!up()) return NONODE;
  const ok = await until(function () { const t = tables(DB); const h = currentOf(t, RHO, RHOS, 'rho hangs')[0], f = currentOf(t, RHO, RHOS, 'rho answers its first')[0]; return Promise.resolve(!!h && no(h.verified) && !!f && yes(f.verified)); }, 120000);
  let errs = ''; try { errs = fs.readFileSync(path.join(s.run, 'spirit', 'state', 'testicle', 'testicle.err'), 'utf8').split('\n').filter(Boolean).slice(-8).join(' | '); } catch (e) { errs = 'no testicle.err'; }
  return !!ok || 'rho\'s rows after 2 minutes: ' + short(currentOf(tables(DB), RHO, RHOS, 'rho hangs').concat(currentOf(tables(DB), RHO, RHOS, 'rho answers its first'))) + '; testicle.err: ' + errs.slice(0, 1500) + '; the log ' + short(runlog().filter(function (l) { return l.suite === 'rho'; }));
}, test.limit.long);
test.run('its suite shows "still red"', 0.2, async function () {
  if (!up()) return NONODE;
  // The hang fails at its limit, then the reporter ends the run and the job is judged: the status follows a moment later.
  let st = null;
  await until(function () { return statusOf(RHO, RHOS).then(function (x) { st = x; return x === 'still red'; }); }, 20000);
  let errs = ''; try { errs = fs.readFileSync(path.join(s.run, 'spirit', 'state', 'testicle', 'testicle.err'), 'utf8').split('\n').filter(Boolean).slice(-8).join(' | '); } catch (e) { errs = 'no testicle.err'; }
  return st === 'still red' || 'rho\'s suite: ' + short(st) + '; testicle.err: ' + errs.slice(0, 1500) + '; its script row ' + short(scriptRow(tables(DB), RHO)) + '; the rows of its tests (test, current, verified, judged) ' + short(testRows(tables(DB), RHO, RHOS, 'rho answers its first').concat(testRows(tables(DB), RHO, RHOS, 'rho hangs')).map(function (r) { return [r.test, r.current, r.verified, String(r.judged).slice(0, 8), String(r.suiteHash).slice(0, 8), r.tested]; })) + '; its row ' + short(suiteRow(tables(DB), RHO, RHOS)) + '; its tests ' + short(testRows(tables(DB), RHO, RHOS, 'rho answers its first')) + '; the log ' + short(runlog().filter(function (l) { return l.suite === 'rho'; }));
}, test.limit.slow);
test.run('a suite whose only test hangs, its process kept alive, fails too: sigma\'s suite shows "still red"', 0.2, async function () {
  if (!up()) return NONODE;
  let st = null;
  // sigma's own job comes after rho's; its hang fails at the quick limit, its process kept alive by an interval ended.
  const ok = await until(function () { return statusOf(SIG, SIGS).then(function (x) { st = x; return x === 'still red'; }); }, 180000);
  return !!ok || 'sigma\'s suite: ' + short(st);
}, test.limit.long);

// ── goal/G47.1, box v79, 2: interactive, the default ──
// "interactive: all actions and runs are controlled by the user through the UI or through api calls." "the server will
// flag changed suites AND scripts always, in both modes." 3: "a script seen for the first time starts with reClassify true".
const CHI = Z + 'chi.js', CHIS = Z + 'test/chi.js', PSI = Z + 'psi.js', PSIS = Z + 'test/psi.js';
let i1 = null;
test.run('the world: interactive again, set by preferences {interactive: true}', 0.2, async function () {
  if (!up()) return NONODE;
  await idle(280000);
  const r = await call(N.base, 'testicle.preferences', { interactive: true });
  return (r.status === 200 && prefsOf(r).interactive === true) || 'set: ' + r.status + ' ' + short(r.text);
}, test.limit.long);
// goal/G47.1, box v94, 1: the server classifies a second after the last change, interactive or not; so reClassify true is
// read inside that quiet second, before the classifier clears it.
const SC = 'spirit/test/scriptClassify.js';
const quietRow = async function (name, notHash) { let row = null; await until(function () { row = scriptRow(tables(DB), name); return Promise.resolve(!!row && yes(row.reClassify) && (notHash === undefined || row.hash !== notHash)); }, 900); return row; };
test.run('interactive: within a second of a script being written, it has its row, reClassify true, seen for the first time', 0.2, async function () {
  if (!up()) return NONODE;
  // chi and psi, with their own tests, written now, while the server is interactive: chi's suite is run by a press, psi's
  // once the server is auto.
  put(CHIS, SUITE_HEAD + "test.run('chi answers', 0.2, function () { return true; }, test.limit.quick);\n");
  put(PSIS, SUITE_HEAD + "test.run('psi answers', 0.2, function () { return true; }, test.limit.quick);\n");
  put(CHI, '\'use strict\';\n// chi, written while interactive\n');
  put(PSI, '\'use strict\';\n// psi, written while interactive\n');
  const row = await quietRow(CHI);
  i1 = await after();
  return (!!row && yes(row.reClassify)) || 'chi\'s row within the quiet second: ' + short(row || scriptRow(i1, CHI));
}, test.limit.slow);
test.run('interactive: its own suite is flagged needs running', 0.2, function () {
  if (!i1) return NONODE;
  const r = suiteRow(i1, CHI, CHIS);
  return (!!r && yes(r.test)) || 'chi\'s suite row: ' + short(r);
}, test.limit.quick);
// Andy: "we specified that classification and file updates happen REGARDLESS of interactive or NOT."
test.run('interactive: the server classifies by itself, no press: chi\'s reClassify turns false', 0.2, async function () {
  if (!i1) return NONODE;
  const ok = await until(function () { const r = scriptRow(tables(DB), CHI); return Promise.resolve(!!r && no(r.reClassify)); }, 120000);
  return !!ok || 'chi\'s row, interactive, two minutes on: ' + short(scriptRow(tables(DB), CHI));
}, test.limit.long);
test.run('interactive: the classifier\'s own suite row is no longer flagged for chi', 0.2, function () {
  if (!i1) return NONODE;
  const r = suiteRow(tables(DB), CHI, SC);
  return (!!r && no(r.test)) || 'chi\'s classifier suite row: ' + short(r);
}, test.limit.quick);
test.run('interactive: classification never sets both browserOnly and nodeOnly', 0.2, function () {
  if (!i1) return NONODE;
  const both = i1.script.filter(function (r) { return yes(r.browserOnly) && yes(r.nodeOnly); });
  return both.length === 0 || 'both set on ' + short(both.map(function (r) { return r.name; }));
}, test.limit.quick);
test.run('interactive: nothing runs by itself: five seconds on, the server is idle and no suite of chi or psi was run', 0.2, async function () {
  if (!i1) return NONODE;
  await sleep(5000);
  const busy = await call(N.base, 'testicle.busy', {});
  const t = tables(DB);
  // The classifier runs by itself in both modes (box v94, 1); its own rows are not a run of chi's or psi's suites.
  const ran = (t.test || []).filter(function (r) { return (r.script === CHI || r.script === PSI) && r.suite !== SC; });
  const still = [suiteRow(t, CHI, CHIS), suiteRow(t, PSI, PSIS)].every(function (r) { return !!r && yes(r.test); });
  return ((busy.body === false || (busy.body && busy.body.busy === false)) && ran.length === 0 && still) || 'busy ' + short(busy.text) + ', test rows ' + ran.length + ', still flagged ' + still;
}, test.limit.slow);
test.run('interactive: a press (testicle.run) runs that suite, and only it', 0.2, async function () {
  if (!i1) return NONODE;
  const r = await call(N.base, 'testicle.run', { script: CHI, suite: CHIS });
  const done = await until(function () { return Promise.resolve(currentOf(tables(DB), CHI, CHIS, 'chi answers').length === 1); }, 60000);
  const psiRan = (tables(DB).test || []).filter(function (x) { return x.script === PSI && x.suite !== SC; }).length;
  return (r.status === 200 && !!done && psiRan === 0) || 'run: ' + r.status + ' ' + short(r.text) + ', chi reported ' + !!done + ', psi rows ' + psiRan;
}, test.limit.long);
test.run('interactive: a script whose hash changes is flagged reClassify true again', 0.2, async function () {
  if (!i1) return NONODE;
  const was = (scriptRow(tables(DB), CHI) || {}).hash;
  append(CHI, '// changed again\n');
  const row = await quietRow(CHI, was);
  return (!!row && row.hash !== was && yes(row.reClassify)) || 'chi\'s row: ' + short(row) + ', hash before ' + short(was);
}, test.limit.slow);

// AFTER A START, STILL INTERACTIVE, WITH SUITES WAITING (Andy, after his node classified nothing until he turned interactive
// off: "wsl, make double sure you catch this with a test."; cw reproduced it from a copy of his tables: after a start
// nothing got classified). chi's and psi's suites are flagged and unrun; the node restarts, interactive kept; a script
// changed while it was down, and one changed after, are each classified with no press.
test.run('the world: interactive, suites still waiting, the node stops; chi changes while it is down', 0.2, async function () {
  if (!i1) return NONODE;
  const waiting = [suiteRow(tables(DB), PSI, PSIS)].filter(function (r) { return !!r && yes(r.test); }).length;
  await stop(N.child);
  append(CHI, '// changed while the node was down, interactive\n');
  return waiting === 1 || 'psi\'s suite not waiting before the stop: ' + short(suiteRow(tables(DB), PSI, PSIS));
}, test.limit.slow);
test.run('after the start, interactive still, a script changed while down is classified with no press', 0.2, async function () {
  N = await boot(s.run); live.push(N.child);
  if (!up()) return 'the scratch node did not come up again';
  const p = prefsOf(await call(N.base, 'testicle.preferences', {}));
  if (p.interactive !== true) return 'not interactive after the start: ' + short(p);
  const ok = await until(function () { const r = scriptRow(tables(DB), CHI); return Promise.resolve(!!r && no(r.reClassify)); }, 120000);
  return !!ok || 'chi, two minutes after the start: ' + short(scriptRow(tables(DB), CHI));
}, test.limit.long);
test.run('and a script changed after the start is classified with no press, within 30 seconds', 0.2, async function () {
  if (!up()) return NONODE;
  append(PSI, '// changed after the start, interactive\n');
  await quietRow(PSI);
  const ok = await until(function () { const r = scriptRow(tables(DB), PSI); return Promise.resolve(!!r && no(r.reClassify)); }, 30000);
  return !!ok || 'psi, 30 seconds after its change: ' + short(scriptRow(tables(DB), PSI));
}, test.limit.slow);

// ── auto, set by the verb ──
let pAuto = null;
test.run('preferences {interactive: false} sets it, and answers them all', 0.2, async function () {
  if (!up()) return NONODE;
  pAuto = await call(N.base, 'testicle.preferences', { interactive: false });
  return (pAuto.status === 200 && prefsOf(pAuto).interactive === false) || 'set: ' + pAuto.status + ' ' + short(pAuto.text);
}, test.limit.quick);
test.run('it is kept in spirit/state/testicle/data/preferences.json', 0.2, function () {
  if (!pAuto) return NONODE;
  const kept = readJson(PREFS());
  return (!!kept && kept.interactive === false) || 'preferences.json: ' + short(kept);
}, test.limit.quick);
test.run('preferences {} now answers interactive false', 0.2, async function () {
  if (!pAuto) return NONODE;
  const r = await call(N.base, 'testicle.preferences', {});
  return prefsOf(r).interactive === false || 'preferences {}: ' + short(r.text);
}, test.limit.quick);
test.run('auto: the server processes everything by itself: psi\'s flagged suite is run', 0.2, async function () {
  if (!pAuto) return NONODE;
  const done = await until(function () { return Promise.resolve(currentOf(tables(DB), PSI, PSIS, 'psi answers').length === 1); }, 240000);
  return !!done || 'psi\'s suite was not run: ' + short(suiteRow(tables(DB), PSI, PSIS));
}, test.limit.long);
test.run('auto: a changed script is still flagged reClassify true', 0.2, async function () {
  if (!pAuto) return NONODE;
  append(PSI, '// changed while auto\n');
  const row = await quietRow(PSI);
  return (!!row && yes(row.reClassify)) || 'psi\'s row: ' + short(row);
}, test.limit.slow);
// The runs chi and psi queued (their general suites among them) are done before the checks after these begin.
test.run('the world: the server is idle again after chi and psi', 0.2, async function () {
  if (!up()) return NONODE;
  return !!(await idle(280000)) || 'still busy after chi and psi';
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
const classifyRow = function (t, name) { return currentOf(t, name, SC, 'classifyable')[0] || null; };
let zc = null, zcCleared = {};

test.run('the node lists the verb testicle.script.classify', 0.2, async function () {
  if (!up()) return NONODE;
  const api = await call(N.base, 'api', { family: 'testicle' });
  const iface = String((api.body && api.body.interface) || '');
  return /['"]script\.classify['"]\s*:/.test(iface) || 'testicle\'s api: ' + short(iface);
}, test.limit.quick);
test.run('testicle.script.classify sets a script\'s browserOnly and nodeOnly', 0.2, async function () {
  if (!up()) return NONODE;
  // kappa.js: on disc, its row made long before, unchanged since (alpha.js was deleted by an earlier check).
  const r = await call(N.base, 'testicle.script.classify', { script: KA, browserOnly: true, nodeOnly: false });
  const row = scriptRow(tables(DB), KA);
  return (r.status === 200 && !!row && yes(row.browserOnly) && no(row.nodeOnly)) || 'classify: ' + r.status + ' ' + short(r.text) + ', kappa\'s row ' + short(row);
}, test.limit.quick);
test.run('the world: six scripts written, each with its own test: node, page, both, broken, hang, exit', 0.2, async function () {
  if (!up()) return NONODE;
  Object.keys(ZC).forEach(function (k) { put(ownOf(ZC[k]), ownSuite(k)); put(ZC[k], ZC_SRC[k]); });
  // Each one's classification seen as it happens: the moment its reClassify reads false.
  const t0c = Date.now();
  await until(function () {
    const t = tables(DB);
    Object.keys(ZC).forEach(function (k) { const r = scriptRow(t, ZC[k]); if (r && no(r.reClassify) && !zcCleared[k]) zcCleared[k] = Date.now(); });
    return Promise.resolve(Object.keys(ZC).every(function (k) { return !!zcCleared[k]; }));
  }, 120000, 100);
  zc = tables(DB);
  return Object.keys(zcCleared).length === 6 || 'classified after ' + (Date.now() - t0c) + ' ms: ' + short(Object.keys(zcCleared));
}, test.limit.long);
test.run('every one is classified by the server by itself: reClassify false on each', 0.2, function () {
  if (!zc) return NONODE;
  const left = Object.keys(ZC).filter(function (k) { const r = scriptRow(zc, ZC[k]); return !r || !no(r.reClassify); });
  return left.length === 0 || 'not classified: ' + short(left.map(function (k) { return ZC[k] + ' ' + short(scriptRow(zc, ZC[k])); }));
}, test.limit.quick);
test.run('a script that loads on the node and crashes in the page for lack of require is node-only', 0.2, function () {
  if (!zc) return NONODE;
  const r = scriptRow(zc, ZC.node);
  return (!!r && yes(r.nodeOnly) && no(r.browserOnly)) || 'zzcNode: ' + short(r);
}, test.limit.quick);
test.run('a script that crashes on the node for lack of document and loads in the page is browser-only', 0.2, function () {
  if (!zc) return NONODE;
  const r = scriptRow(zc, ZC.page);
  return (!!r && yes(r.browserOnly) && no(r.nodeOnly)) || 'zzcPage: ' + short(r);
}, test.limit.quick);
test.run('a script that loads in both runs on both: neither flag', 0.2, function () {
  if (!zc) return NONODE;
  const r = scriptRow(zc, ZC.both);
  return (!!r && no(r.browserOnly) && no(r.nodeOnly)) || 'zzcBoth: ' + short(r);
}, test.limit.quick);
test.run('a script that exits on the node with nothing thrown has loaded there: an app server comes out node-only', 0.2, function () {
  if (!zc) return NONODE;
  const r = scriptRow(zc, ZC.exit);
  return (!!r && yes(r.nodeOnly) && no(r.browserOnly)) || 'zzcExit: ' + short(r);
}, test.limit.quick);
test.run('a script that crashes in both is not classifyable: its classifyable row is red, severity 0.8', 0.2, function () {
  if (!zc) return NONODE;
  const r = classifyRow(zc, ZC.broken);
  return (!!r && no(r.verified) && Number(r.severity) === 0.8) || 'zzcBroken\'s classifyable row: ' + short(r);
}, test.limit.quick);
test.run('a load not complete in 3 seconds counts as a hang: not classifyable, its row red, severity 0.8', 0.2, function () {
  if (!zc) return NONODE;
  const r = classifyRow(zc, ZC.hang);
  return (!!r && no(r.verified) && Number(r.severity) === 0.8) || 'zzcHang\'s classifyable row: ' + short(r);
}, test.limit.quick);
test.run('a script classified has no red classifyable row', 0.2, function () {
  if (!zc) return NONODE;
  const red = ['node', 'page', 'both', 'exit'].filter(function (k) { const r = classifyRow(zc, ZC[k]); return !zcCleared[k] || (!!r && no(r.verified)); });
  return red.length === 0 || 'red: ' + short(red);
}, test.limit.quick);
test.run('each has a suite row of spirit/test/scriptClassify.js', 0.2, function () {
  if (!zc) return NONODE;
  const none = Object.keys(ZC).filter(function (k) { return !suiteRow(zc, ZC[k], SC); });
  return none.length === 0 || 'no classifier suite row: ' + short(none);
}, test.limit.quick);
// SHOWN ONLY WHERE THEY APPLY (Andy: "WSL, MAKE SURE SUITES DON'T SHOW UP WHEN THEY'RE NO APPLICATBLE TO A SCRIPT. NOW!!!!"):
// read as the script tab reads them, suite.search for the script, at once after it is classified, not after a run or a
// change. A -node general test applies to no browser-only script, a -browser one to no node-only script.
const shownKinds = async function (name) { return items(await call(N.base, 'testicle.suite.search', { script: name, text: '' })).map(function (i) { return (/-(general|node|browser)\.js$/.exec(suiteOf(i)) || [])[1]; }).filter(Boolean); };
test.run('at once after it is classified, a browser-only script\'s suite search shows no -node suite', 0.2, async function () {
  if (!zc) return NONODE;
  const k = await shownKinds(ZC.page);
  return (k.indexOf('node') === -1 && k.indexOf('browser') !== -1) || 'zzcPage\'s suite search shows the kinds ' + short(k);
}, test.limit.quick);
test.run('at once after it is classified, a node-only script\'s suite search shows no -browser suite', 0.2, async function () {
  if (!zc) return NONODE;
  const k = await shownKinds(ZC.node);
  return (k.indexOf('browser') === -1 && k.indexOf('node') !== -1) || 'zzcNode\'s suite search shows the kinds ' + short(k);
}, test.limit.quick);
test.run('and after a restart, a classified script still shows only the suites that apply', 0.2, async function () {
  if (!zc) return NONODE;
  await stop(N.child);
  N = await boot(s.run); live.push(N.child);
  if (!up()) return 'the scratch node did not come up again';
  await sleep(3000);
  const kp = await shownKinds(ZC.page), kn = await shownKinds(ZC.node);
  return (kp.indexOf('node') === -1 && kn.indexOf('browser') === -1) || 'after the restart: zzcPage ' + short(kp) + ', zzcNode ' + short(kn);
}, test.limit.long);
// A RESULT OF A SUITE THAT DOES NOT APPLY (Andy: "MAKE SURE SUITES DON'T SHOW UP WHEN THEY'RE NO APPLICATBLE TO A SCRIPT";
// found on wsl's node, 2026-11-14: a -browser suite run by hand on two node-only scripts, relayServer.js and sseClient.js,
// reported to testicle, and their red rows stood current there for a day, though testicle never runs that suite on them):
// a result sent for a classified node-only script under a -browser suite is refused, and leaves no row.
test.run('a -browser result for a node-only script is refused, and no current row of it stands', 0.4, async function () {
  if (!zc) return NONODE;
  const browserSuite = 'spirit/app/testicle/test/testicle-sibling-browser.js';
  const r = await call(N.base, 'testicle.testicle.set', { script: ZC.node, suite: browserSuite, test: 'zzc not applicable', verified: false, severity: 0.8 });
  await sleep(1000);
  const t = tables(DB);
  const rows = currentOf(t, ZC.node, browserSuite, 'zzc not applicable');
  const srow = suiteRow(t, ZC.node, browserSuite);
  const shown = (await shownKinds(ZC.node)).indexOf('browser') !== -1;
  const bad = [];
  if (r.status === 200) bad.push('testicle.set answered 200');
  if (rows.length) bad.push('a current row stands: ' + short(rows[0]));
  if (srow && no(srow.deleted)) bad.push('a suite row of it stands: ' + short(srow));
  if (shown) bad.push('its suite search shows a -browser suite');
  return !bad.length || bad.join('; ');
}, test.limit.slow);

test.run('classified first, tested after: each one\'s own suite reports only after its reClassify cleared', 0.2, async function () {
  if (!zc) return NONODE;
  await until(function () { return Promise.resolve(['node', 'both', 'exit'].every(function (k) { return currentOf(tables(DB), ZC[k], ownOf(ZC[k]), k + ' answers').length === 1; })); }, 240000);
  const t = tables(DB);
  const early = ['node', 'both', 'exit'].filter(function (k) { const r = currentOf(t, ZC[k], ownOf(ZC[k]), k + ' answers')[0]; return !r || !zcCleared[k] || Number(r.tested) < zcCleared[k] - 500; });
  return early.length === 0 || 'run before classified, or never run: ' + short(early.map(function (k) { return k + ' ' + short(currentOf(t, ZC[k], ownOf(ZC[k]), k + ' answers')[0]); }));
}, test.limit.long);
test.run('a script whose classifyable row is red is tested in no other way: no suite of broken or hang reports', 0.2, async function () {
  if (!zc) return NONODE;
  await idle(240000);
  const t = tables(DB);
  const ran = (t.test || []).filter(function (r) { return (r.script === ZC.broken || r.script === ZC.hang) && r.suite !== SC; });
  return ran.length === 0 || 'reported: ' + short(ran.map(function (r) { return r.suite + ' ' + r.test; }));
}, test.limit.long);

// THE CLASSIFIER CHANGED, EVERY SCRIPT CLASSIFIED AGAIN (Andy, on a script left not classifyable by the classifier before
// its fix: "wsl, note that and make sure this doesn't happen again."; cw: "when the classifier itself changes, every script
// is classified again"). A script that failed is tried again then, though it did not change itself.
let reTold = 0;
test.run('when the classifier changes, a script classified before reads reClassify true again', 0.2, async function () {
  if (!zc) return NONODE;
  await idle(240000);
  reTold = Date.now();
  append(SC, '// the classifier, changed\n');
  const ok = await until(function () { const r = scriptRow(tables(DB), ZC.node); return Promise.resolve(!!r && yes(r.reClassify)); }, 2000);
  return !!ok || 'zzcNode after the classifier changed: ' + short(scriptRow(tables(DB), ZC.node));
}, test.limit.slow);
test.run('and a script that failed is tried again, though it did not change: its classifyable row tested anew', 0.2, async function () {
  if (!reTold) return 'the classifier was not changed: the world failed';
  const ok = await until(function () { const r = classifyRow(tables(DB), ZC.broken); return Promise.resolve(!!r && Number(r.tested) >= reTold); }, 240000);
  return !!ok || 'zzcBroken\'s classifyable row: ' + short(classifyRow(tables(DB), ZC.broken)) + ', the classifier changed at ' + reTold;
}, test.limit.long);
// Switched to interactive while that classifying goes on (Andy: "AND IT FUCKING STOPS CLASSIFYING WHEN I GO BACK TO FUCKING
// ITERACTIVE MODE!!!!!!!!!!!!!!!!!!!"): it goes on, and ends, interactive.
test.run('the world: switched to interactive while the classifying goes on', 0.2, async function () {
  if (!reTold) return 'the classifier was not changed: the world failed';
  const r = await call(N.base, 'testicle.preferences', { interactive: true });
  return (r.status === 200 && prefsOf(r).interactive === true) || 'set: ' + r.status + ' ' + short(r.text);
}, test.limit.quick);
test.run('and each one is classified again, interactive, nothing pressed: reClassify false on every one of the six', 0.2, async function () {
  if (!reTold) return 'the classifier was not changed: the world failed';
  let left = [];
  await until(function () { const t = tables(DB); left = Object.keys(ZC).filter(function (k) { const r = scriptRow(t, ZC[k]); return !r || !no(r.reClassify); }); return Promise.resolve(left.length === 0); }, 240000);
  return left.length === 0 || 'not classified again, interactive: ' + short(left);
}, test.limit.long);
test.run('the world: auto again, for the checks after', 0.2, async function () {
  if (!up()) return NONODE;
  const r = await call(N.base, 'testicle.preferences', { interactive: false });
  return (r.status === 200 && prefsOf(r).interactive === false) || 'set: ' + r.status + ' ' + short(r.text);
}, test.limit.quick);

// 2: which general tests concern which scripts, by the flags.
const kinds = function (t, name) { return suiteRows(t, name).filter(function (r) { return !yes(r.deleted); }).map(function (r) { return (/-(general|node|browser)\.js$/.exec(r.suite) || [])[1]; }).filter(Boolean); };
test.run('a node-only script is tested by -general and -node general tests, and no -browser one', 0.2, function () {
  if (!zc) return NONODE;
  const k = kinds(tables(DB), ZC.node);
  return (k.indexOf('general') !== -1 && k.indexOf('node') !== -1 && k.indexOf('browser') === -1) || 'zzcNode\'s general tests: ' + short(k);
}, test.limit.quick);
test.run('a browser-only script is tested by -general and -browser general tests, and no -node one', 0.2, function () {
  if (!zc) return NONODE;
  const k = kinds(tables(DB), ZC.page);
  return (k.indexOf('general') !== -1 && k.indexOf('browser') !== -1 && k.indexOf('node') === -1) || 'zzcPage\'s general tests: ' + short(k);
}, test.limit.quick);
test.run('a script neither browser-only nor node-only is tested by all three kinds', 0.2, function () {
  if (!zc) return NONODE;
  const k = kinds(tables(DB), ZC.both);
  return ['general', 'node', 'browser'].every(function (x) { return k.indexOf(x) !== -1; }) || 'zzcBoth\'s general tests: ' + short(k);
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
test.run('the world: zzdA, zzdC and their own tests run while testicle is on', 0.2, async function () {
  if (!up()) return NONODE;
  put(DAS, twoTests); put(DA, '\'use strict\';\n// zzdA\n');
  put(DCS, SUITE_HEAD + "test.run('zzdC answers', 0.2, function () { return true; }, test.limit.quick);\n"); put(DC, '\'use strict\';\n// zzdC\n');
  const ok = await until(function () { const t = tables(DB); return Promise.resolve(currentOf(t, DA, DAS, 'zzdA answers two').length === 1 && currentOf(t, DC, DCS, 'zzdC answers').length === 1); }, 280000);
  return !!ok || 'not run: zzdA ' + currentOf(tables(DB), DA, DAS, 'zzdA answers two').length + ', zzdC ' + currentOf(tables(DB), DC, DCS, 'zzdC answers').length;
}, test.limit.long);
test.run('the world: testicle is turned off, the node staying up, and the tree changes under it', 0.2, async function () {
  if (!up()) return NONODE;
  const r = await call(N.base, 'app.active', { key: 'testicle', active: false });
  const gone = await until(function () { return askedUp().then(function (a) { return !a; }); }, 30000);
  if (!gone) return 'testicle still answers after app.active false: ' + r.status + ' ' + short(r.text);
  off = { aSuite: (suiteRow(tables(DB), DA, DAS) || {}).hash };
  put(DAS, SUITE_HEAD + "test.run('zzdA answers one', 0.2, function () { return true; }, test.limit.quick);\n// its second test gone, while testicle was off\n");
  put(DBS, SUITE_HEAD + "test.run('zzdB answers', 0.2, function () { return true; }, test.limit.quick);\n"); put(DB_, '\'use strict\';\n// zzdB, written while testicle was off\n');
  fs.rmSync(path.join(s.run, DCS)); fs.rmSync(path.join(s.run, DC));
  return true;
}, test.limit.slow);
test.run('turned on again, testicle answers', 0.2, async function () {
  if (!off) return 'testicle was not turned off: the world failed';
  await call(N.base, 'app.active', { key: 'testicle', active: true });
  return !!(await until(askedUp, 60000)) || 'testicle does not answer after app.active true';
}, test.limit.slow);
test.run('the script table follows: zzdB written while off has its row, zzdC removed while off is deleted', 0.2, async function () {
  if (!off) return 'testicle was not turned off: the world failed';
  const ok = await until(function () { const t = tables(DB); const b = scriptRow(t, DB_), c = scriptRow(t, DC); return Promise.resolve(!!b && no(b.deleted) && !!c && yes(c.deleted)); }, 120000);
  const t = tables(DB);
  return !!ok || 'zzdB ' + short(scriptRow(t, DB_)) + ', zzdC ' + short(scriptRow(t, DC));
}, test.limit.long);
test.run('the suite table follows: zzdB\'s own suite has its row, zzdA\'s edited suite its new hash, zzdC\'s removed suite is deleted', 0.2, function () {
  if (!off) return 'testicle was not turned off: the world failed';
  const t = tables(DB);
  const b = suiteRow(t, DB_, DBS), a = suiteRow(t, DA, DAS), c = suiteRow(t, DC, DCS);
  return (!!b && no(b.deleted) && !!a && a.hash !== off.aSuite && !!c && yes(c.deleted)) || 'zzdB\'s suite ' + short(b) + '; zzdA\'s ' + short(a) + ' (before ' + short(off.aSuite) + '); zzdC\'s ' + short(c);
}, test.limit.quick);
test.run('the testicle table follows: zzdC\'s results are no longer current', 0.2, function () {
  if (!off) return 'testicle was not turned off: the world failed';
  const cur = (tables(DB).test || []).filter(function (r) { return r.script === DC && r.suite === DCS && yes(r.current); });
  return cur.length === 0 || 'zzdC\'s current results: ' + short(cur.map(function (r) { return r.test; }));
}, test.limit.quick);
test.run('and once zzdA\'s edited suite has run again, the test it lost is no longer current', 0.2, async function () {
  if (!off) return 'testicle was not turned off: the world failed';
  const ok = await until(function () { const t = tables(DB); const one = currentOf(t, DA, DAS, 'zzdA answers one')[0]; return Promise.resolve(!!one && String(one.suiteHash || '') === String((suiteRow(t, DA, DAS) || {}).hash) && currentOf(t, DA, DAS, 'zzdA answers two').length === 0); }, 280000);
  const t = tables(DB);
  return !!ok || 'zzdA\'s rows: one ' + short(currentOf(t, DA, DAS, 'zzdA answers one')) + ', two ' + short(currentOf(t, DA, DAS, 'zzdA answers two'));
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
const namesBoth = function (out) { const fails = String(out).split('\n').filter(function (l) { return /FAILURE/.test(l); }).join('\n'); return { one: fails.indexOf('zzlOne.js') !== -1, two: fails.indexOf('zzlTwo.js') !== -1 }; };
let listed = false;
test.run('the world: two broken scripts written in the scratch tree', 0.2, function () {
  if (!s) return NONODE;
  put(LA1, BROKEN); put(LA2, BROKEN);
  listed = true;
  return true;
}, test.limit.quick);
const bothNamed = function (suite) {
  if (!listed) return 'not written: the world failed';
  const out = generalRun(suite, [LA1, LA2]);
  const b = namesBoth(out);
  return (b.one && b.two) || 'names zzlOne ' + b.one + ', zzlTwo ' + b.two + ': ' + short(out.split('\n').filter(function (l) { return /FAILURE/.test(l); }).slice(0, 3));
};
test.run('testicle-sibling-general.js, handed both, names both', 0.4, function () { return bothNamed('spirit/app/testicle/test/testicle-sibling-general.js'); }, test.limit.long);
test.run('testicle-sibling-node.js, handed both, names both', 0.4, function () { return bothNamed('spirit/app/testicle/test/testicle-sibling-node.js'); }, test.limit.long);
test.run('testicle-sibling-browser.js, handed both, names both', 0.4, function () { return bothNamed('spirit/app/testicle/test/testicle-sibling-browser.js'); }, test.limit.long);

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
test.run('the world: spirit/app/testicle/temp/zzBatch/ with its three kinds of general test and three scripts, classified and run once', 0.2, async function () {
  if (!up()) return NONODE;
  put(BZ + 'zzBatch.js', '\'use strict\';\n// zzBatch\n');
  put(BA, '\'use strict\';\ndocument.title = String(document.title);\n');
  put(BB, '\'use strict\';\nrequire(\'../../../../spirit.js\');\nconst fs = require(\'fs\');\nmodule.exports = { fs: typeof fs.readFileSync };\n');
  put(BC, '\'use strict\';\n(function (root) { var v = { both: true }; if (typeof module === \'object\' && module && module.exports) module.exports = v; else root.zzbBoth = v; }(this));\n');
  ['general', 'node', 'browser'].forEach(function (k) { put(BZ + 'test/zzBatch-sibling-' + k + '.js', BATCH_SUITE(k)); });
  const ok = await until(function () { const t = tables(DB); return Promise.resolve([BA, BB, BC].every(function (f) { const r = scriptRow(t, f); return !!r && no(r.reClassify); })); }, 280000);
  await idle(280000);
  batched = !!ok;
  return batched || 'zzBatch\'s scripts not classified: ' + short([BA, BB, BC].map(function (f) { return scriptRow(tables(DB), f); }));
}, test.limit.long);
test.run('three scripts changed in one quiet second: the -general test runs once, handed all three', 0.4, async function () {
  if (!batched) return 'no zzBatch: the world failed';
  batchFrom = runlog().length;
  [BA, BB, BC].forEach(function (f) { append(f, '// changed together\n'); });
  await until(function () { return Promise.resolve(runlog().slice(batchFrom).some(function (l) { return l.suite === 'zzBatch-general'; })); }, 280000);
  await idle(280000);
  const runs = runlog().slice(batchFrom).filter(function (l) { return l.suite === 'zzBatch-general' && l.ev === 'start'; });
  return (runs.length === 1 && sameSet(runs[0].given, [BA, BB, BC])) || 'its runs: ' + short(runs.map(function (r) { return r.given; }));
}, test.limit.long);
test.run('and the -node test runs once, handed the two that run on the node, never the browser-only one', 0.4, function () {
  if (!batched) return 'no zzBatch: the world failed';
  const runs = runlog().slice(batchFrom).filter(function (l) { return l.suite === 'zzBatch-node' && l.ev === 'start'; });
  return (runs.length === 1 && sameSet(runs[0].given, [BB, BC])) || 'its runs: ' + short(runs.map(function (r) { return r.given; }));
}, test.limit.quick);
test.run('and the -browser test runs once, handed the two that run in a page, never the node-only one', 0.4, function () {
  if (!batched) return 'no zzBatch: the world failed';
  const runs = runlog().slice(batchFrom).filter(function (l) { return l.suite === 'zzBatch-browser' && l.ev === 'start'; });
  return (runs.length === 1 && sameSet(runs[0].given, [BA, BC])) || 'its runs: ' + short(runs.map(function (r) { return r.given; }));
}, test.limit.quick);
test.run('one script changed later: one run of the -general test, handed that one', 0.4, async function () {
  if (!batched) return 'no zzBatch: the world failed';
  const from = runlog().length;
  append(BC, '// changed alone\n');
  await until(function () { return Promise.resolve(runlog().slice(from).some(function (l) { return l.suite === 'zzBatch-general'; })); }, 280000);
  await idle(280000);
  const runs = runlog().slice(from).filter(function (l) { return l.suite === 'zzBatch-general' && l.ev === 'start'; });
  return (runs.length === 1 && sameSet(runs[0].given, [BC])) || 'its runs: ' + short(runs.map(function (r) { return r.given; }));
}, test.limit.long);
test.run('a press in a script tab still runs a general test for that one script', 0.4, async function () {
  if (!batched) return 'no zzBatch: the world failed';
  const from = runlog().length;
  const press = await call(N.base, 'testicle.run', { script: BB, suite: BZ + 'test/zzBatch-sibling-general.js' });
  await until(function () { return Promise.resolve(runlog().slice(from).some(function (l) { return l.suite === 'zzBatch-general'; })); }, 120000);
  const runs = runlog().slice(from).filter(function (l) { return l.suite === 'zzBatch-general' && l.ev === 'start'; });
  return (press.status === 200 && runs.length === 1 && sameSet(runs[0].given, [BB])) || 'press ' + press.status + ' ' + short(press.text) + '; its runs: ' + short(runs.map(function (r) { return r.given; }));
}, test.limit.long);

// ── A FIX OF A TOP RED RUNS FIRST (goal/G47.1, box v128: "a change to one of the 10 scripts holding the most severe current
// reds (each script counted once, not each test row) stops the running suite and runs that script's red suites first; the
// stopped run goes back flagged, its results untouched; any other change waits its turn"; Andy: "if the changed file is not
// a top 10 fix, the run may as well continue...."). A planted folder, spirit/app/testicle/temp/zzTop/: zzLong's own suite waits 40 s before its
// one test; zzRed's own suite fails at 0.9, the most severe red of the scratch world; zzCalm's passes, no red. Each logs its
// start and end to runlog.txt; a stopped run logs no end.
const TZ = 'spirit/app/testicle/temp/zzTop/';
const TLONG = TZ + 'zzLong.js', TLONGS = TZ + 'test/zzLong.js', TRED = TZ + 'zzRed.js', TREDS = TZ + 'test/zzRed.js', TCALM = TZ + 'zzCalm.js', TCALMS = TZ + 'test/zzCalm.js';
const TOP_LOG = "const LOG = path.join(__dirname, '..', '..', '..', '..', '..', '..', '..', '..', 'runlog.txt');\n" +
  "function log(name, ev) { require('fs').appendFileSync(LOG, JSON.stringify({ suite: name, ev: ev, at: Date.now() }) + '\\n'); }\n";
let topWorld = false, longBefore = null, redChanged = 0, longStart = 0;
test.run('the world: spirit/app/testicle/temp/zzTop/ with a long suite, a suite red at 0.9 and a green one, each run once', 0.2, async function () {
  if (!up()) return NONODE;
  put(TLONG, '\'use strict\';\n// zzLong\n');
  put(TRED, '\'use strict\';\n// zzRed\n');
  put(TCALM, '\'use strict\';\n// zzCalm\n');
  put(TLONGS, SUITE_HEAD + TOP_LOG + "log('zzLong', 'start');\n" +
    "test.run('the world: zzLong waits 40 s', 0.2, function () { return new Promise(function (r) { setTimeout(function () { r(true); }, 40000); }); }, test.limit.slow);\n" +
    "test.run('zzLong answers', 0.2, function () { return true; }, test.limit.quick);\ntest.after(function () { log('zzLong', 'end'); });\n");
  put(TREDS, SUITE_HEAD + TOP_LOG + "log('zzRed', 'start');\n" +
    "test.run('zzRed fails', 0.9, function () { return 'red, as planted'; }, test.limit.quick);\ntest.after(function () { log('zzRed', 'end'); });\n");
  put(TCALMS, SUITE_HEAD + TOP_LOG + "log('zzCalm', 'start');\n" +
    "test.run('zzCalm answers', 0.2, function () { return true; }, test.limit.quick);\ntest.after(function () { log('zzCalm', 'end'); });\n");
  const ok = await until(function () { const t = tables(DB); return Promise.resolve(currentOf(t, TRED, TREDS, 'zzRed fails').length > 0 && currentOf(t, TLONG, TLONGS, 'zzLong answers').length > 0 && currentOf(t, TCALM, TCALMS, 'zzCalm answers').length > 0); }, 280000);
  await idle(280000);
  const red = currentOf(tables(DB), TRED, TREDS, 'zzRed fails')[0];
  topWorld = !!ok && !!red && no(red.verified) && Number(red.severity) === 0.9;
  return topWorld || 'zzTop not run: zzRed ' + short(red) + '; zzLong ' + short(currentOf(tables(DB), TLONG, TLONGS, 'zzLong answers'));
}, test.limit.long);
test.run('the world: zzLong.js changes, and zzRed.js changes while zzLong\'s own suite runs', 0.2, async function () {
  if (!topWorld) return 'no zzTop: the world failed';
  longBefore = currentOf(tables(DB), TLONG, TLONGS, 'zzLong answers')[0] || null;
  const from = starts('zzLong').length;
  append(TLONG, '// zzLong, changed\n');
  const ok = await until(function () { return Promise.resolve(starts('zzLong').length > from); }, 280000);
  longStart = (starts('zzLong')[from] || {}).at || 0;
  await sleep(2000);
  append(TRED, '// zzRed, fixed\n');
  redChanged = Date.now();
  return (!!ok && !!longStart) || 'zzLong\'s own suite never started: ' + short(runlog().filter(function (l) { return l.suite === 'zzLong'; }));
}, test.limit.long);
test.run('a change to a script holding a top red stops the running suite: zzLong\'s run ends without its end', 0.4, async function () {
  if (!redChanged) return 'no change of zzRed: the world failed';
  await until(function () { return Promise.resolve(runlog().some(function (l) { return l.suite === 'zzRed' && l.ev === 'start' && l.at >= redChanged; })); }, 120000);
  const ended = ends('zzLong').some(function (l) { return l.at >= longStart && l.at <= longStart + 39000; });
  const done = ends('zzLong').filter(function (l) { return l.at >= longStart; })[0];
  const redAt = (runlog().filter(function (l) { return l.suite === 'zzRed' && l.ev === 'start' && l.at >= redChanged; })[0] || {}).at;
  return (!ended && !!redAt && (!done || done.at > redAt)) || 'zzLong started ' + longStart + ', ended ' + (done && done.at) + '; zzRed started ' + redAt;
}, test.limit.long);
test.run('and that script\'s red suite runs first: zzRed\'s own suite starts within 30 s of its change, before zzLong\'s 40 s were up', 0.4, function () {
  if (!redChanged) return 'no change of zzRed: the world failed';
  const redAt = (runlog().filter(function (l) { return l.suite === 'zzRed' && l.ev === 'start' && l.at >= redChanged; })[0] || {}).at;
  return (!!redAt && redAt - redChanged <= 30000 && redAt < longStart + 40000) || 'zzRed started ' + (redAt ? (redAt - redChanged) + ' ms after its change' : 'never') + '; zzLong started ' + longStart;
}, test.limit.quick);
test.run('the stopped run\'s results are untouched: zzLong\'s current row is the one from before', 0.4, function () {
  if (!longBefore) return 'no row of zzLong before: the world failed';
  const now = currentOf(tables(DB), TLONG, TLONGS, 'zzLong answers')[0] || null;
  const redAt = (runlog().filter(function (l) { return l.suite === 'zzRed' && l.ev === 'start' && l.at >= redChanged; })[0] || {}).at || Date.now();
  const touched = !!now && Number(now.tested) !== Number(longBefore.tested) && Number(now.tested) < redAt;
  return (!!now && !touched) || 'zzLong\'s row before ' + short(longBefore) + ', now ' + short(now);
}, test.limit.quick);
test.run('the stopped run goes back flagged: zzLong\'s own suite runs again, after zzRed\'s', 0.4, async function () {
  if (!redChanged) return 'no change of zzRed: the world failed';
  const ok = await until(function () { return Promise.resolve(runlog().some(function (l) { return l.suite === 'zzLong' && l.ev === 'end' && l.at > redChanged; })); }, 280000);
  const redAt = (runlog().filter(function (l) { return l.suite === 'zzRed' && l.ev === 'start' && l.at >= redChanged; })[0] || {}).at;
  const again = runlog().filter(function (l) { return l.suite === 'zzLong' && l.ev === 'start' && l.at > (redAt || Infinity); })[0];
  return (!!ok && !!again) || 'zzLong after zzRed: ' + short(runlog().filter(function (l) { return l.suite === 'zzLong' && l.at > redChanged; }));
}, test.limit.long);
let calmChanged = 0, longStart2 = 0;
test.run('the world: zzLong.js changes again, and zzCalm.js, holding no red, changes while zzLong\'s own suite runs', 0.2, async function () {
  if (!topWorld) return 'no zzTop: the world failed';
  await idle(280000);
  const from = starts('zzLong').length;
  append(TLONG, '// zzLong, changed again\n');
  const ok = await until(function () { return Promise.resolve(starts('zzLong').length > from); }, 280000);
  longStart2 = (starts('zzLong')[from] || {}).at || 0;
  await sleep(2000);
  append(TCALM, '// zzCalm, changed\n');
  calmChanged = Date.now();
  return (!!ok && !!longStart2) || 'zzLong\'s own suite never started again: ' + short(runlog().filter(function (l) { return l.suite === 'zzLong'; }));
}, test.limit.long);
test.run('any other change waits its turn: zzLong\'s run ends with its end, and zzCalm\'s own suite starts after it', 0.4, async function () {
  if (!calmChanged) return 'no change of zzCalm: the world failed';
  const ok = await until(function () { return Promise.resolve(runlog().some(function (l) { return l.suite === 'zzCalm' && l.ev === 'start' && l.at >= calmChanged; })); }, 280000);
  const done = ends('zzLong').filter(function (l) { return l.at >= longStart2; })[0];
  const calmAt = (runlog().filter(function (l) { return l.suite === 'zzCalm' && l.ev === 'start' && l.at >= calmChanged; })[0] || {}).at;
  return (!!ok && !!done && !!calmAt && calmAt >= done.at) || 'zzLong started ' + longStart2 + ', ended ' + (done && done.at) + '; zzCalm started ' + calmAt;
}, test.limit.long);

// ── A TEST A WHOLE RUN NO LONGER REPORTS STOPS BEING CURRENT (goal/G47.1, cleaning; cw, reading Andy's testicle: backup/api.js's
// -browser rerun reported 3 tests green and skipped the 17 element checks, "but their red rows from 19:07 stay current, nobody
// retires them, and the suite stays \"still red\"", "after a whole run (no title, not stopped, not killed), a test of that
// script and suite the run did not report is no longer current"). A planted spirit/app/testicle/temp/zzStale/: its own suite reports "stale
// one" green and "stale two" red; then it is rewritten to report "stale one" alone.
const SZ = 'spirit/app/testicle/temp/zzStale/zzStale.js', SZS = 'spirit/app/testicle/temp/zzStale/test/zzStale.js';
let staleWorld = false;
test.run('the world: spirit/app/testicle/temp/zzStale/ whose own suite reports one test green and one red, run once', 0.2, async function () {
  if (!up()) return NONODE;
  put(SZ, '\'use strict\';\n// zzStale\n');
  put(SZS, SUITE_HEAD + "test.run('stale one', 0.2, function () { return true; }, test.limit.quick);\ntest.run('stale two', 0.2, function () { return 'red, as planted'; }, test.limit.quick);\n");
  const ok = await until(function () { const t = tables(DB); return Promise.resolve(currentOf(t, SZ, SZS, 'stale one').length > 0 && currentOf(t, SZ, SZS, 'stale two').length > 0); }, 280000);
  await idle(280000);
  staleWorld = !!ok;
  return staleWorld || 'zzStale\'s rows: ' + short((tables(DB).test || []).filter(function (r) { return r.script === SZ; }));
}, test.limit.long);
test.run('a run with a title retires nothing: after testicle.run of "stale one" alone, "stale two" is still current', 0.4, async function () {
  if (!staleWorld) return 'no zzStale: the world failed';
  const before = currentOf(tables(DB), SZ, SZS, 'stale one')[0];
  const r = await call(N.base, 'testicle.run', { script: SZ, suite: SZS, testicle: 'stale one' });
  await until(function () { const now = currentOf(tables(DB), SZ, SZS, 'stale one')[0]; return Promise.resolve(!!now && !!before && Number(now.tested) > Number(before.tested)); }, 120000);
  await idle(120000);
  return (r.status === 200 && currentOf(tables(DB), SZ, SZS, 'stale two').length > 0) || 'run ' + r.status + ' ' + short(r.text) + '; stale two now ' + short(testRows(tables(DB), SZ, SZS, 'stale two'));
}, test.limit.long);
test.run('the world: zzStale\'s suite rewritten to report "stale one" alone, and run whole', 0.2, async function () {
  if (!staleWorld) return 'no zzStale: the world failed';
  const before = currentOf(tables(DB), SZ, SZS, 'stale one')[0];
  put(SZS, SUITE_HEAD + "test.run('stale one', 0.2, function () { return true; }, test.limit.quick);\n");
  const ok = await until(function () { const now = currentOf(tables(DB), SZ, SZS, 'stale one')[0]; return Promise.resolve(!!now && !!before && Number(now.tested) > Number(before.tested)); }, 280000);
  await idle(280000);
  return !!ok || 'stale one never ran again: ' + short(testRows(tables(DB), SZ, SZS, 'stale one'));
}, test.limit.long);
test.run('after a whole run, a test it did not report is no longer current: "stale two" has no current row', 0.4, function () {
  if (!staleWorld) return 'no zzStale: the world failed';
  const left = currentOf(tables(DB), SZ, SZS, 'stale two');
  return !left.length || 'stale two still current: ' + short(left);
}, test.limit.quick);
test.run('and the suite\'s status follows the tests it now has: zzStale\'s own suite shows "green"', 0.4, async function () {
  if (!staleWorld) return 'no zzStale: the world failed';
  const st = await statusOf(SZ, SZS);
  return st === 'green' || 'zzStale\'s suite: ' + short(st);
}, test.limit.quick);

// ── testicle.suite.success (goal/G47.1, box v129: "the reporter reports a suite's success or failure for a script through
// the new verb testicle.suite.success {script, suite, success} ... the server sets that suite row from it at once (outcome,
// flag cleared), no summing of test rows"; Andy: "cw, replace the last tweark with the reporter reporting fucking
// success/failure of the suite through a new verb testicle.suite.success"). A planted spirit/app/testicle/temp/zzSucc/ whose suite is
// flagged by a change, then told by the verb, inside the runner's quiet second.
const SUC = 'spirit/app/testicle/temp/zzSucc/zzSucc.js', SUCS = 'spirit/app/testicle/temp/zzSucc/test/zzSucc.js';
let succWorld = false;
test.run('the node lists the verb testicle.suite.success', 0.4, async function () {
  if (!up()) return NONODE;
  const api = await call(N.base, 'api', { family: 'testicle' });
  const iface = String((api.body && api.body.interface) || '');
  return /['"]suite\.success['"]\s*:/.test(iface) || 'testicle\'s api: ' + short(iface).slice(0, 200);
}, test.limit.quick);
test.run('the world: spirit/app/testicle/temp/zzSucc/ with its own suite, run once', 0.2, async function () {
  if (!up()) return NONODE;
  put(SUC, '\'use strict\';\n// zzSucc\n');
  put(SUCS, SUITE_HEAD + "test.run('zzSucc answers', 0.2, function () { return true; }, test.limit.quick);\n");
  const ok = await until(function () { return Promise.resolve(currentOf(tables(DB), SUC, SUCS, 'zzSucc answers').length > 0); }, 280000);
  await idle(280000);
  succWorld = !!ok;
  return succWorld || 'zzSucc never ran: ' + short(suiteRow(tables(DB), SUC, SUCS));
}, test.limit.long);
test.run('testicle.suite.success {success: false} sets that suite row at once: outcome red, its flag cleared', 0.4, async function () {
  if (!succWorld) return 'no zzSucc: the world failed';
  append(SUCS, '// changed, so flagged\n');
  await until(function () { return Promise.resolve(yes((suiteRow(tables(DB), SUC, SUCS) || {}).test)); }, 900);
  const r = await call(N.base, 'testicle.suite.success', { script: SUC, suite: SUCS, success: false });
  const row = suiteRow(tables(DB), SUC, SUCS);
  return (r.status === 200 && !!row && row.outcome === 'red' && no(row.test)) || 'suite.success answered ' + r.status + ' ' + short(r.text) + '; the row ' + short(row);
}, test.limit.quick);
test.run('testicle.suite.success {success: true} sets it green, at once, whatever its test rows say', 0.4, async function () {
  if (!succWorld) return 'no zzSucc: the world failed';
  const r = await call(N.base, 'testicle.suite.success', { script: SUC, suite: SUCS, success: true });
  const row = suiteRow(tables(DB), SUC, SUCS);
  return (r.status === 200 && !!row && row.outcome === 'green' && no(row.test)) || 'suite.success answered ' + r.status + ' ' + short(r.text) + '; the row ' + short(row);
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
test.run('the world: spirit/app/testicle/temp/zzRe/ with its own -general test and three scripts, run once', 0.2, async function () {
  if (!up()) return NONODE;
  put(RZ + 'zzRe.js', '\'use strict\';\n// zzRe\n');
  [RA, RB, RC].forEach(function (f) { put(f, '\'use strict\';\n// ' + f + '\n'); });
  put(RGEN, RE_SUITE);
  const ok = await until(function () { return Promise.resolve(reRuns().length > 0); }, 280000);
  await idle(280000);
  reWorld = !!ok;
  return reWorld || 'zzRe\'s general test never ran: ' + short(runlog().slice(-5));
}, test.limit.long);
test.run('the world: zzReA, zzReB and zzReC change; while the batch waits on zzReB, another suite is pressed', 0.2, async function () {
  if (!reWorld) return 'no zzRe: the world failed';
  reFrom = reRuns().length;
  [RA, RB, RC].forEach(function (f) { append(f, '// changed together\n'); });
  const ok = await until(function () { return Promise.resolve(reRuns().length > reFrom); }, 280000);
  await sleep(5000);
  const r = await call(N.base, 'testicle.run', { script: LA, suite: LAS });
  return (!!ok && r.status === 200) || 'the batch started ' + !!ok + '; the press answered ' + r.status + ' ' + short(r.text);
}, test.limit.long);
test.run('a run stopped is re-assembled fresh from the flags: the next run is handed zzReB and zzReC, not zzReA', 0.4, async function () {
  if (!reWorld) return 'no zzRe: the world failed';
  const ok = await until(function () { return Promise.resolve(reRuns().length > reFrom + 1); }, 280000);
  const runs = reRuns().slice(reFrom);
  const first = runs[0] || {}, next = runs[1] || {};
  return (!!ok && sameSet(first.given, [RA, RB, RC]) && sameSet(next.given, [RB, RC])) || 'its runs: ' + short(runs.map(function (x) { return x.given; }));
}, test.limit.long);
test.run('and zzReA, which reported before the stop, is done: its suite row green, its flag cleared', 0.4, function () {
  if (!reWorld) return 'no zzRe: the world failed';
  const row = suiteRow(tables(DB), RA, RGEN);
  return (!!row && row.outcome === 'green' && no(row.test)) || 'zzReA\'s row: ' + short(row);
}, test.limit.quick);
// Box v131: "a suite's result is NEVER assembled from testicle rows, anywhere: testicle.suite.success is the only thing that
// writes a suite row's outcome. the old summing of test rows goes." zzSucc's suite row, set green by the verb above, is sent
// a failing test row and a passing one by testicle.set alone: its outcome stays as the verb left it.
test.run('a failing test row sent alone leaves the suite row\'s outcome as testicle.suite.success left it: zzSucc stays green', 0.4, async function () {
  if (!succWorld) return 'no zzSucc: the world failed';
  const r = await call(N.base, 'testicle.testicle.set', { script: SUC, suite: SUCS, test: 'zzSucc answers', verified: false, severity: 0.2 });
  await sleep(1500);
  const row = suiteRow(tables(DB), SUC, SUCS);
  return (r.status === 200 && !!row && row.outcome === 'green') || 'testicle.set answered ' + r.status + '; the row ' + short(row);
}, test.limit.slow);
test.run('and testicle.suite.success {success: false} is what turns it red', 0.4, async function () {
  if (!succWorld) return 'no zzSucc: the world failed';
  await call(N.base, 'testicle.testicle.set', { script: SUC, suite: SUCS, test: 'zzSucc answers', verified: true, severity: 0.2 });
  const r = await call(N.base, 'testicle.suite.success', { script: SUC, suite: SUCS, success: false });
  await sleep(1500);
  const row = suiteRow(tables(DB), SUC, SUCS);
  return (r.status === 200 && !!row && row.outcome === 'red') || 'suite.success answered ' + r.status + '; the row ' + short(row);
}, test.limit.slow);

// LAST, SO THE REST OF THIS FILE JUDGES SUITES NOT RUN YET (goal/G47.1): set to auto and waited for, every flagged suite in its
// scope runs first, alpha's empty own suite with it, and the checks after it found their suites already run.
// goal/G47.1, Q8, Andy: "Shall a testicle in debug mode never run testicle's own tests, only the planted temp/ worlds and its
// three general tests?" "testicle MUST not recurse... and not run it's own tests just the dummies...". Set to auto, every
// flagged suite in its scope runs; testicle's own tests, under spirit/app/testicle/ but not temp/, are none of them: no row
// of theirs reaches it, and it comes to rest (a run of testicle.js would hold it busy for an hour, a lab node with it).
const OWN_TEST = function (suite) { return /^spirit\/app\/testicle\//.test(suite) && !/^spirit\/app\/testicle\/temp\//.test(suite) && /(^|\/)test\//.test(suite) && DEBUG_GENERALS.indexOf(suite) === -1; };
test.run('in debug mode, set to auto, it never runs testicle\'s own tests, only the dummies: none reports, and it comes to rest', 0.8, async function () {
  if (!up()) return NONODE;
  await call(N.base, 'testicle.preferences', { interactive: false });
  const rest = await idle(280000);
  const own = (tables(DB).test || []).filter(function (r) { return OWN_TEST(r.suite) && r.suite !== 'spirit/test/scriptClassify.js'; });
  const suites = Array.from(new Set(own.map(function (r) { return r.suite; })));
  return (!!rest && !suites.length) || (rest ? '' : 'still busy after 280 s; ') + (suites.length ? 'its own tests reported: ' + suites.join(', ') : 'none of its own reported yet');
}, test.limit.long);
