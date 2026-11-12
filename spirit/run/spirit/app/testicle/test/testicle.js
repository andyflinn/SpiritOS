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
// A real node on a scratch copy of the tracked files, planted files of its own under spirit/zzTesticle/, testicle
// turned on there. Every change is made on disc by this test, and testicle.db is read exactly one second later.
// Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync, execFileSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const RUN = path.resolve(__dirname, '../../../..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { freePort, until, sleep } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }

const APP = path.join(RUN, 'spirit', 'app', 'testicle');
// THE PLANTED FILES, under one folder of their own. alpha has its own test; beta has none; gamma has its own test and
// is touched only through it; epsilon and its test are never touched; notes.md is no script.
const Z = 'spirit/zzTesticle/';
// A planted suite's head: the product reporter, from spirit/zzTesticle/test/.
const SUITE_HEAD = '\'use strict\';\nconst path = require(\'path\');\nconst test = require(path.join(__dirname, \'..\', \'..\', \'test\', \'testReport.js\'));\n';
const PLANT = {
  'spirit/zzTesticle/alpha.js': '\'use strict\';\n// alpha\n',
  'spirit/zzTesticle/test/alpha.js': '\'use strict\';\n// the test of alpha\n',
  'spirit/zzTesticle/beta.js': '\'use strict\';\n// beta, no test of its own\n',
  'spirit/zzTesticle/gamma.js': '\'use strict\';\n// gamma\n',
  'spirit/zzTesticle/test/gamma.js': '\'use strict\';\n// the test of gamma\n',
  'spirit/zzTesticle/epsilon.js': '\'use strict\';\n// epsilon, never touched\n',
  'spirit/zzTesticle/test/epsilon.js': '\'use strict\';\n// the test of epsilon, never touched\n',
  'spirit/zzTesticle/notes.md': '# no script\n',
  // zeta and its test are never changed: asked by testicle.script.get alone (goal/G47.1, the verbs cycle).
  'spirit/zzTesticle/zeta.js': '\'use strict\';\n// zeta, asked for, never changed\n',
  'spirit/zzTesticle/test/zeta.js': '\'use strict\';\n// the test of zeta\n',
  // theta and its test: no row until a test of it is set (goal/G47.1, the test cycle).
  'spirit/zzTesticle/theta.js': '\'use strict\';\n// theta\n',
  'spirit/zzTesticle/test/theta.js': '\'use strict\';\n// the test of theta\n',
  // kappa, lambda and mu, with suites that really run and report (goal/G47.1, the cycle "run a suite from the script tab"):
  // kappa's own test waits three seconds before its tests, lambda's has three tests in a row, mu's general test judges mu.
  'spirit/zzTesticle/kappa.js': '\'use strict\';\n// kappa\n',
  'spirit/zzTesticle/test/kappa.js': SUITE_HEAD + [
    "test.run('the world: kappa waits a moment', 0.2, function () { return new Promise(function (r) { setTimeout(function () { r(true); }, 3000); }); }, test.limit.quick);",
    "test.run('kappa answers its first', 0.2, function () { return true; }, test.limit.quick);",
    "test.run('kappa fails its second', 0.2, function () { return 'it fails, as planted'; }, test.limit.quick);",
    "test.run('kappa was started with no argument', 0.2, function () { return process.argv.length === 2 || 'started with ' + process.argv.slice(2).join(' '); }, test.limit.quick);",
  ].join('\n') + '\n',
  'spirit/zzTesticle/lambda.js': '\'use strict\';\n// lambda\n',
  'spirit/zzTesticle/test/lambda.js': SUITE_HEAD + [
    "test.run('lambda answers its first', 0.2, function () { return true; }, test.limit.quick);",
    "test.run('lambda answers its second', 0.2, function () { return true; }, test.limit.quick);",
    "test.run('lambda answers its third', 0.2, function () { return true; }, test.limit.quick);",
  ].join('\n') + '\n',
  'spirit/zzTesticle/mu.js': '\'use strict\';\n// mu\n',
  'spirit/zzTesticle/test/mu-child-zzRule.js': SUITE_HEAD + [
    "test.run('mu holds its rule', 0.2, function () { return process.argv[2] === 'spirit/zzTesticle/mu.js' || 'started with ' + process.argv.slice(2).join(' '); }, test.limit.quick);",
  ].join('\n') + '\n',
};
// The kept rows of an older testicle.db, for a script not on disc, so no change of this test's touches them.
const OLD = { name: 'spirit/zzTesticle/older.js', suite: 'spirit/zzTesticle/test/older.js', hash: 'an older hash', changed: 1700000000000 };
// The general test changed in the scratch copy: its entries name every file of its reach.
const GENERAL = 'spirit/test/spirit-sibling-titleRules.js';

function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-testicle-server-'));
  execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); })
    .forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
  const run = path.join(root, 'spirit', 'run');
  Object.keys(PLANT).forEach(function (f) { fs.mkdirSync(path.dirname(path.join(run, f)), { recursive: true }); fs.writeFileSync(path.join(run, f), PLANT[f]); });
  // testicle turned on there, as an owner turns a server on (spirit/test/headLessChrome.js scratchNode).
  const on = path.join(run, 'spirit', 'state', 'testicle');
  fs.mkdirSync(on, { recursive: true });
  fs.writeFileSync(path.join(on, 'node.json'), JSON.stringify({ active: true }));
  // AN OLDER testicle.db (goal/G47.1, the rename: "an existing testicle.db is renamed in place, its rows kept"): its first
  // table still named file, the suite table's key column file, one row in each.
  fs.mkdirSync(path.join(on, 'data'), { recursive: true });
  const old = new DatabaseSync(path.join(on, 'data', 'testicle.db'));
  old.exec('CREATE TABLE file (name TEXT PRIMARY KEY, hash TEXT NOT NULL DEFAULT \'\', deleted INTEGER NOT NULL DEFAULT 0, changed INTEGER NOT NULL)');
  old.exec('CREATE TABLE suite (file TEXT NOT NULL, suite TEXT NOT NULL, test INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0, hash TEXT NOT NULL DEFAULT \'\', outcome TEXT NOT NULL DEFAULT \'\', changed INTEGER NOT NULL, PRIMARY KEY (file, suite))');
  old.prepare('INSERT INTO file (name, hash, deleted, changed) VALUES (?, ?, 0, ?)').run(OLD.name, OLD.hash, OLD.changed);
  old.prepare('INSERT INTO suite (file, suite, test, deleted, hash, outcome, changed) VALUES (?, ?, 1, 0, ?, \'\', ?)').run(OLD.name, OLD.suite, OLD.hash, OLD.changed);
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
  const child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: run, stdio: 'ignore' });
  const base = 'http://127.0.0.1:' + port;
  const up = await until(function () { return call(base, 'api').then(function (r) { return r.status === 200; }); }, 60000);
  return { child: child, base: base, up: !!up };
}
function stop(c) { return new Promise(function (r) { if (!c || c.exitCode !== null) return r(); c.once('exit', function () { r(); }); c.kill(); setTimeout(r, 6000); }); }

// THE TABLES, read as they stand, the database opened read only each time.
function tables(dbFile) {
  let db = null;
  try {
    db = new DatabaseSync(dbFile, { readOnly: true });
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
  lines.forEach(function (l) { const p = l.split(' '); if (p[1] === name && out.indexOf(p[0]) === -1) out.push(p[0]); });
  return out.sort();
}
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
  try { if (s) fs.rmSync(s.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
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
  await sleep(1000);
  const idle = await call(N.base, 'testicle.busy', {});
  return (idle.status === 200 && (idle.body === false || (idle.body && idle.body.busy === false))) || 'busy, idle: ' + idle.status + ' ' + short(idle.text);
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
test.run('the older file row is kept in script, as it was', 0.2, function () {
  if (!start) return NONODE;
  const kept = scriptRow(start, OLD.name);
  return (!!kept && kept.hash === OLD.hash && Number(kept.changed) === OLD.changed) || 'the row: ' + short(kept);
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

// the box: "nothing is read at start"
test.run('at start the script table holds no row beyond those kept', 0.2, function () {
  if (!start) return NONODE;
  const fresh = start.script.filter(function (r) { return r.name !== OLD.name; });
  return (!start.error && fresh.length === 0) || 'rows at start: ' + short(start.error || fresh.slice(0, 5));
}, test.limit.quick);
test.run('at start the suite table holds no row beyond those kept', 0.2, function () {
  if (!start) return NONODE;
  const freshSuites = start.suite.filter(function (r) { return r.script !== OLD.name; });
  return (!start.error && freshSuites.length === 0) || 'rows at start: ' + short(start.error || freshSuites.slice(0, 5));
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
  const unflagged = suiteRows(a1, Z + 'alpha.js').filter(function (r) { return !yes(r.test); });
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
test.run('the world: zeta.js, never changed, has no row before it is asked for', 0.2, function () {
  if (!up()) return NONODE;
  return !scriptRow(tables(DB), Z + 'zeta.js') || 'zeta.js has a row already';
}, test.limit.quick);
test.run('script.get of a production script with no rows makes its file row', 0.2, async function () {
  if (!up()) return NONODE;
  tz = Date.now();
  zeta = await call(N.base, 'testicle.script.get', { name: Z + 'zeta.js' });
  zt = tables(DB);
  zrow = scriptRow(zt, Z + 'zeta.js');
  return (zeta.status === 200 && !!zrow) || 'script.get zeta.js: ' + zeta.status + ' ' + short(zeta.text) + '; its row ' + short(zrow);
}, test.limit.quick);
test.run('and answers that file row', 0.2, function () {
  if (!zeta) return NONODE;
  return (!!zrow && !!zeta.body && zeta.body.name === zrow.name && zeta.body.hash === zrow.hash && Number(zeta.body.changed) === Number(zrow.changed) && no(zrow.deleted) && Number(zrow.changed) >= tz - 1000) || 'answered ' + short(zeta.body) + ', the row ' + short(zrow);
}, test.limit.quick);
test.run('it makes a suite row for every suite that concerns the file', 0.2, function () {
  if (!zt) return NONODE;
  wantZeta = concerning(s.run, Z + 'zeta.js');
  return (wantZeta.indexOf(Z + 'test/zeta.js') !== -1 && JSON.stringify(names(suiteRows(zt, Z + 'zeta.js'))) === JSON.stringify(wantZeta)) || 'rows ' + short(names(suiteRows(zt, Z + 'zeta.js'))) + ', wanted ' + short(wantZeta);
}, test.limit.quick);
test.run('every suite row it makes is flagged needs testing', 0.2, function () {
  if (!zt) return NONODE;
  const zunflagged = suiteRows(zt, Z + 'zeta.js').filter(function (r) { return !yes(r.test); });
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
  return (got.length > 0 && got.every(function (i) { return yes(i.row.test) || i.row.status === 'needs running'; })) || 'rows: ' + short(got.map(function (i) { return i.row; }).slice(0, 3));
}, test.limit.quick);
test.run('the words narrow among the file\'s suites', 0.2, async function () {
  if (!up()) return NONODE;
  const narrow = items(await call(N.base, 'testicle.suite.search', { script: Z + 'zeta.js', text: 'titleRules' })).map(suiteOf);
  return (narrow.indexOf(GENERAL) !== -1 && narrow.indexOf(Z + 'test/zeta.js') === -1) || 'searched titleRules: ' + short(narrow);
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
  const names = items(await call(N.base, 'testicle.suite.search', { text: 'titleRules' })).map(suiteOf);
  return names.filter(function (n) { return n === GENERAL; }).length === 1 || 'searched titleRules: ' + short(names);
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
// searches", "This cycle does not clear a suite's needs-testing flag", "The verb red is testicle.red". G45.1's columns:
// script (file until the rename), suite, test, flipped, current, verified, tested, judged, severity.
test.run('the world: theta.js has no row before a test of it is set', 0.2, function () {
  if (!up()) return NONODE;
  return !scriptRow(tables(DB), TH) || 'theta.js has a row already';
}, test.limit.quick);
test.run('testicle.set is served, and testicle.db holds the table testicle', 0.2, async function () {
  if (!up()) return NONODE;
  ts0 = Date.now();
  set1 = await call(N.base, 'testicle.testicle.set', { script: TH, suite: THS, test: 'theta answers its first question', verified: true, severity: 0.2 });
  k1 = tables(DB);
  return (set1.status === 200 && Array.isArray(k1.test)) || 'test.set: ' + set1.status + ' ' + short(set1.text) + '; table test ' + short(k1.test === null ? 'missing' : 'there');
}, test.limit.quick);
test.run('a set for a script with no row makes its script row', 0.2, function () {
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

// the box: "This cycle does not clear a suite's needs-testing flag"
test.run('with every test of the suite passing, its needs-testing flag stays', 0.2, async function () {
  if (!up()) return NONODE;
  await call(N.base, 'testicle.testicle.set', { script: TH, suite: THS, test: 'theta answers its first question', verified: true, severity: 0.6 });
  const k5 = tables(DB);
  const flag5 = suiteRow(k5, TH, THS);
  return (!!flag5 && yes(flag5.test)) || 'the suite row: ' + short(flag5);
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
test.run('testicle.search answers the most severe first', 0.2, function () {
  const sev = srRows.map(function (r) { return Number(r.severity); });
  return (sev.length === 3 && sev[0] >= sev[1] && sev[1] >= sev[2]) || 'severities in order: ' + short(sev);
}, test.limit.quick);
test.run('with no script it searches that suite\'s tests for any script', 0.2, async function () {
  if (!up()) return NONODE;
  const anyScript = found(await call(N.base, 'testicle.testicle.search', { suite: THS, text: '' }));
  return (anyScript.length === 3 && anyScript.every(function (r) { return r.suite === THS && yes(r.current); })) || 'rows: ' + short(anyScript);
}, test.limit.quick);
test.run('with no suite it searches that script\'s tests in any suite', 0.2, async function () {
  if (!up()) return NONODE;
  const anySuite = found(await call(N.base, 'testicle.testicle.search', { script: Z + 'gamma.js', text: '' }));
  return (anySuite.length === 1 && anySuite[0].test === 'gamma answers') || 'rows: ' + short(anySuite);
}, test.limit.quick);
test.run('with neither it searches every current test', 0.2, async function () {
  if (!up()) return NONODE;
  const everyOne = found(await call(N.base, 'testicle.testicle.search', { text: '' }));
  return (everyOne.length === 4 && everyOne.every(function (r) { return yes(r.current); })) || 'rows: ' + short(everyOne);
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

// the box: "The verb red is testicle.red"
test.run('testicle.red answers every failed current test, and no other', 0.2, async function () {
  if (!up()) return NONODE;
  red = found(await call(N.base, 'testicle.red', {}));
  return (red.length === 3 && red.every(function (r) { return no(r.verified) && yes(r.current); })) || 'rows: ' + short(red);
}, test.limit.quick);
test.run('testicle.red answers the most severe first', 0.2, function () {
  const redSev = red.map(function (r) { return Number(r.severity); });
  return JSON.stringify(redSev) === JSON.stringify([0.9, 0.7, 0.3]) || 'severities in order: ' + short(redSev);
}, test.limit.quick);

// Before the general test changes: that one judges every product file, the untouched among them.
// the box: "A product file or a suite that has not changed has no row"
test.run('a changed file that is no product script gets no row', 0.2, async function () {
  if (!up()) return NONODE;
  append(Z + 'notes.md', 'no script\n');
  n1 = await after();
  return !scriptRow(n1, Z + 'notes.md') || 'a row for notes.md: ' + short(scriptRow(n1, Z + 'notes.md'));
}, test.limit.slow);
test.run('a product file never changed, its suite never changed, has no row', 0.2, function () {
  if (!n1) return NONODE;
  return (!scriptRow(n1, Z + 'epsilon.js') && !suiteRows(n1, Z + 'epsilon.js').length) || 'rows for epsilon.js: ' + short([scriptRow(n1, Z + 'epsilon.js'), suiteRows(n1, Z + 'epsilon.js')]);
}, test.limit.quick);

// the box: "When a suite ... is changed": a general test
test.run('the world: the changed general test judges every product file', 0.2, function () {
  if (!up()) return NONODE;
  reach = judgedBy(s.run, GENERAL);
  return reach.length > 100 || 'it judges ' + reach.length;
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
  await sleep(1000);
  const done = await call(N.base, 'testicle.busy', {});
  return (done.status === 200 && (done.body === false || (done.body && done.body.busy === false))) || 'busy after: ' + done.status + ' ' + short(done.text);
}, test.limit.slow);
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
  const ok = await until(function () { return Promise.resolve(names0.every(function (n) { return !!rowOf(KA, KAS, n); })); }, 40000);
  return !!ok || 'rows: ' + short(names0.map(function (n) { return [n, !!rowOf(KA, KAS, n)]; }));
}, test.limit.slow);
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
  const r = await call(N.base, 'testicle.run', { script: LA, suite: LAS, testicle: 'lambda answers its second' });
  if (r.status !== 200) return 'run: ' + r.status + ' ' + short(r.text);
  const ok = await until(function () { return Promise.resolve(!!rowOf(LA, LAS, 'lambda answers its second')); }, 40000);
  await sleep(3000);
  const one = rowOf(LA, LAS, 'lambda answers its first'), three = rowOf(LA, LAS, 'lambda answers its third');
  return (!!ok && !!one && !three) || 'second ' + !!ok + ', first ' + short(one) + ', third ' + short(three);
}, test.limit.slow);
test.run('a general test is started with the script as its argument, and reports for that script', 0.2, async function () {
  if (!up()) return NONODE;
  const r = await call(N.base, 'testicle.run', { script: MU, suite: MUS });
  if (r.status !== 200) return 'run: ' + r.status + ' ' + short(r.text);
  await until(function () { return Promise.resolve(!!rowOf(MU, MUS, 'mu holds its rule')); }, 40000);
  const m = rowOf(MU, MUS, 'mu holds its rule');
  return (!!m && yes(m.verified)) || 'its row: ' + short(m);
}, test.limit.slow);
