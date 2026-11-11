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

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }

const APP = path.join(RUN, 'spirit', 'app', 'testicle');
// THE PLANTED FILES, under one folder of their own. alpha has its own test; beta has none; gamma has its own test and
// is touched only through it; epsilon and its test are never touched; notes.md is no script.
const Z = 'spirit/zzTesticle/';
const PLANT = {
  'spirit/zzTesticle/alpha.js': '\'use strict\';\n// alpha\n',
  'spirit/zzTesticle/test/alpha.js': '\'use strict\';\n// the test of alpha\n',
  'spirit/zzTesticle/beta.js': '\'use strict\';\n// beta, no test of its own\n',
  'spirit/zzTesticle/gamma.js': '\'use strict\';\n// gamma\n',
  'spirit/zzTesticle/test/gamma.js': '\'use strict\';\n// the test of gamma\n',
  'spirit/zzTesticle/epsilon.js': '\'use strict\';\n// epsilon, never touched\n',
  'spirit/zzTesticle/test/epsilon.js': '\'use strict\';\n// the test of epsilon, never touched\n',
  'spirit/zzTesticle/notes.md': '# no script\n',
  // zeta and its test are never changed: asked by testicle.file.get alone (goal/G47.1, the verbs cycle).
  'spirit/zzTesticle/zeta.js': '\'use strict\';\n// zeta, asked for, never changed\n',
  'spirit/zzTesticle/test/zeta.js': '\'use strict\';\n// the test of zeta\n',
};
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
    const file = db.prepare('SELECT * FROM file').all();
    const suite = db.prepare('SELECT * FROM suite').all();
    return { file: file, suite: suite };
  } catch (e) { return { error: String(e && e.message || e), file: [], suite: [] }; }
  finally { try { if (db) db.close(); } catch (e) { /* closed */ } }
}
function fileRow(t, name) { return t.file.filter(function (r) { return r.name === name; })[0] || null; }
function suiteRows(t, name) { return t.suite.filter(function (r) { return r.file === name; }); }
function suiteRow(t, name, suite) { return t.suite.filter(function (r) { return r.file === name && r.suite === suite; })[0] || null; }
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

test.startTest('testicle/testicle.js: testicle\'s server keeps file and suite in sync with run:// (goal/G47.1)');

(async function () {
  test.subHeading('the box: "The server mounts beside the face (testicle.json: node.mount true)"');
  const own = readJson(path.join(APP, 'testicle.json'));
  ok(!!own && !!own.node && own.node.mount === true, 'its manifest mounts a server: node.mount true', 'node: ' + short(own && own.node));
  ok(!!own && !!own.mount && own.mount['testicle.js'] === true && own.mount['element.js'] === true, 'its mount names testicle.js beside element.js', 'mount: ' + short(own && own.mount));
  ok(fs.existsSync(path.join(APP, 'testicle.js')), 'spirit/app/testicle/testicle.js is there', 'no spirit/app/testicle/testicle.js');

  const s = scratch();
  const live = [];
  const DB = path.join(s.run, 'spirit', 'state', 'testicle', 'data', 'testicle.db');
  const put = function (rel, text) { fs.mkdirSync(path.dirname(path.join(s.run, rel)), { recursive: true }); fs.writeFileSync(path.join(s.run, rel), text); };
  const append = function (rel, text) { fs.appendFileSync(path.join(s.run, rel), text); };
  // EXACTLY ONE SECOND after a change (the box), then the tables as they stand.
  const after = async function () { await sleep(1000); return tables(DB); };
  try {
    const N = await boot(s.run); live.push(N.child);
    ok(N.up, 'the world: a scratch node comes up', 'the scratch node did not come up: nothing judged');
    if (!N.up) return;

    test.subHeading('the box: "testicle.db sits in testicle\'s state folder"');
    ok(!!(await until(function () { return Promise.resolve(fs.existsSync(DB) && !tables(DB).error); }, 30000)), 'testicle.db is made in its state folder, spirit/state/testicle/data/, with its tables file and suite', 'no readable testicle.db at ' + DB + ': ' + short(fs.existsSync(DB) ? tables(DB).error : 'no file'));
    if (!fs.existsSync(DB)) return;

    // goal/G47.1, the box: "The testicle server will serve one first verb, \"busy\": it returns true if it is doing any
    // work, false if it is idle."
    test.subHeading('the box: "one first verb, busy"');
    const api = await call(N.base, 'api', { family: 'testicle' });
    // api {family} answers { family, interface }, the interface the text of its api.js.
    const iface = String((api.body && api.body.interface) || '');
    ok(api.status === 200 && /\bverbs\s*:/.test(iface) && /['"]?busy['"]?\s*:/.test(iface), 'the node lists the verb testicle.busy', 'testicle\'s api: ' + short(api.body || api.text));
    await sleep(1000);
    const idle = await call(N.base, 'testicle.busy', {});
    ok(idle.status === 200 && (idle.body === false || (idle.body && idle.body.busy === false)), 'with nothing changing, busy answers false', 'busy, idle: ' + idle.status + ' ' + short(idle.text));

    test.subHeading('the box: "nothing is read at start"');
    const start = tables(DB);
    ok(!start.error && start.file.length === 0, 'at start the file table holds no row', 'rows at start: ' + short(start.error || start.file.slice(0, 5)));
    ok(!start.error && start.suite.length === 0, 'at start the suite table holds no row', 'rows at start: ' + short(start.error || start.suite.slice(0, 5)));

    test.subHeading('the box: "on any change of a product file it makes sure that file has its row"');
    const t0 = Date.now();
    append(Z + 'alpha.js', '// changed once\n');
    const a1 = await after();
    const alpha = fileRow(a1, Z + 'alpha.js');
    ok(!!alpha, 'one second after a product file changes, it has its row in file', 'no row for ' + Z + 'alpha.js: ' + short(a1.error || a1.file));
    ok(!!alpha && typeof alpha.hash === 'string' && alpha.hash !== '', 'the row holds the file\'s hash', 'hash: ' + short(alpha && alpha.hash));
    ok(!!alpha && no(alpha.deleted), 'the row is not marked deleted', 'deleted: ' + short(alpha && alpha.deleted));
    ok(!!alpha && Number(alpha.changed) >= t0 - 1000 && Number(alpha.changed) <= Date.now(), 'the row\'s changed is a numeric UTC timestamp of that change', 'changed: ' + short(alpha && alpha.changed) + ', the change at ' + t0);

    test.subHeading('the box: "and a suite row for every suite that concerns it"');
    const wantAlpha = concerning(s.run, Z + 'alpha.js');
    ok(wantAlpha.indexOf(Z + 'test/alpha.js') !== -1 && wantAlpha.length > 1, 'the world: alpha.js is concerned by its own test and by general tests', 'testModule.js names ' + short(wantAlpha));
    ok(JSON.stringify(names(suiteRows(a1, Z + 'alpha.js'))) === JSON.stringify(wantAlpha), 'its suite rows are exactly its own test and the general tests that name it', 'rows ' + short(names(suiteRows(a1, Z + 'alpha.js'))) + ', wanted ' + short(wantAlpha));
    const ownRow = suiteRow(a1, Z + 'alpha.js', Z + 'test/alpha.js');
    const unflagged = suiteRows(a1, Z + 'alpha.js').filter(function (r) { return !yes(r.test); });
    ok(suiteRows(a1, Z + 'alpha.js').length > 0 && !unflagged.length, 'every one of its suite rows is flagged test', 'not flagged: ' + short(names(unflagged)));
    ok(!!ownRow && typeof ownRow.hash === 'string' && ownRow.hash !== '' && ownRow.hash !== alpha.hash, 'a suite row holds the suite file\'s own hash', 'suite hash ' + short(ownRow && ownRow.hash) + ', file hash ' + short(alpha && alpha.hash));
    ok(!!ownRow && no(ownRow.deleted), 'a suite row is not marked deleted', 'deleted: ' + short(ownRow && ownRow.deleted));
    ok(!!ownRow && empty(ownRow.outcome), 'a suite row\'s outcome is empty: nothing runs a suite this cycle', 'outcome: ' + short(ownRow && ownRow.outcome));
    ok(!!ownRow && Number(ownRow.changed) >= t0 - 1000 && Number(ownRow.changed) <= Date.now(), 'a suite row\'s changed is a numeric UTC timestamp', 'changed: ' + short(ownRow && ownRow.changed));

    test.subHeading('the box: "When a suite or a product file is changed ... the server adjusts the two tables"');
    const t1 = Date.now();
    append(Z + 'alpha.js', '// changed twice\n');
    const a2 = await after();
    const alpha2 = fileRow(a2, Z + 'alpha.js');
    ok(!!alpha2 && !!alpha && alpha2.hash !== alpha.hash, 'a product file changed again gets its new hash', 'hash before ' + short(alpha && alpha.hash) + ', after ' + short(alpha2 && alpha2.hash));
    ok(!!alpha2 && Number(alpha2.changed) >= t1, 'and its changed moves to that change', 'changed: ' + short(alpha2 && alpha2.changed) + ', the change at ' + t1);
    ok(a2.file.filter(function (r) { return r.name === Z + 'alpha.js'; }).length === 1, 'a file keeps one row', 'rows for alpha.js: ' + a2.file.filter(function (r) { return r.name === Z + 'alpha.js'; }).length);

    const t2 = Date.now();
    append(Z + 'test/alpha.js', '// the suite changed\n');
    const a3 = await after();
    const ownRow3 = suiteRow(a3, Z + 'alpha.js', Z + 'test/alpha.js');
    ok(!!ownRow3 && !!ownRow && ownRow3.hash !== ownRow.hash, 'a suite changed gets its new hash on its rows', 'suite hash before ' + short(ownRow && ownRow.hash) + ', after ' + short(ownRow3 && ownRow3.hash));
    ok(!!ownRow3 && yes(ownRow3.test) && Number(ownRow3.changed) >= t2, 'and its rows are flagged test, changed at that change', 'row: ' + short(ownRow3));

    test.subHeading('the box: "When a suite ... is changed or added": a suite of a file with no row yet');
    append(Z + 'test/gamma.js', '// the suite of gamma changed\n');
    const g1 = await after();
    ok(!!suiteRow(g1, Z + 'gamma.js', Z + 'test/gamma.js'), 'a changed suite makes its row for the file it concerns', 'suite rows of gamma.js: ' + short(suiteRows(g1, Z + 'gamma.js')));
    ok(!!fileRow(g1, Z + 'gamma.js'), 'and that file has its row in file', 'no row for ' + Z + 'gamma.js');

    test.subHeading('the box: "changed or added": a new product file');
    put(Z + 'delta.js', '\'use strict\';\n// delta, new\n');
    const d1 = await after();
    const wantDelta = concerning(s.run, Z + 'delta.js');
    ok(!!fileRow(d1, Z + 'delta.js'), 'a product file added has its row one second later', 'no row for ' + Z + 'delta.js');
    ok(wantDelta.length > 0 && JSON.stringify(names(suiteRows(d1, Z + 'delta.js'))) === JSON.stringify(wantDelta), 'with a suite row for every general test that names it', 'rows ' + short(names(suiteRows(d1, Z + 'delta.js'))) + ', wanted ' + short(wantDelta));

    test.subHeading('the box: "changed or added": a new suite');
    put(Z + 'test/beta.js', '\'use strict\';\n// the new test of beta\n');
    const b1 = await after();
    ok(!!suiteRow(b1, Z + 'beta.js', Z + 'test/beta.js') && !!fileRow(b1, Z + 'beta.js'), 'a suite added makes its row, and its file\'s row', 'rows of beta.js: ' + short(suiteRows(b1, Z + 'beta.js')));

    // goal/G47.1, the verbs cycle: testicle.file.get. The box: "If the argument (a filename, scoped to run://) is not a
    // production script, it returns the error \"not a production script\"", "If the file does not exist, it returns the
    // error \"no such file\"", "If the file does not have its file and suite rows, they are created automatically", "It
    // creates them with the same code the server uses when it discovers a file change and no record exists: the suites are
    // flagged \"needs testing\"", "The server then returns the file row." Its argument is the file row's key, name.
    test.subHeading('the box: "testicle.file.get"');
    const failed = function (r, words) { return !!r.body && r.body.ok === false && new RegExp(words).test(String(r.body.error || '')); };
    const md = await call(N.base, 'testicle.file.get', { name: Z + 'notes.md' });
    ok(failed(md, 'not a production script'), 'file.get of a file that is no script answers the error "not a production script"', 'file.get notes.md: ' + md.status + ' ' + short(md.text));
    const asTest = await call(N.base, 'testicle.file.get', { name: Z + 'test/zeta.js' });
    ok(failed(asTest, 'not a production script'), 'file.get of a script in a test folder answers the error "not a production script"', 'file.get test/zeta.js: ' + asTest.status + ' ' + short(asTest.text));
    const nowhere = await call(N.base, 'testicle.file.get', { name: Z + 'nowhere.js' });
    ok(failed(nowhere, 'no such file'), 'file.get of a production script that is not there answers the error "no such file"', 'file.get nowhere.js: ' + nowhere.status + ' ' + short(nowhere.text));
    ok(!fileRow(tables(DB), Z + 'zeta.js'), 'the world: zeta.js, never changed, has no row before it is asked for', 'zeta.js has a row already');
    const tz = Date.now();
    const zeta = await call(N.base, 'testicle.file.get', { name: Z + 'zeta.js' });
    const zt = tables(DB);
    const zrow = fileRow(zt, Z + 'zeta.js');
    ok(zeta.status === 200 && !!zrow, 'file.get of a production script with no rows makes its file row', 'file.get zeta.js: ' + zeta.status + ' ' + short(zeta.text) + '; its row ' + short(zrow));
    ok(!!zrow && !!zeta.body && zeta.body.name === zrow.name && zeta.body.hash === zrow.hash && Number(zeta.body.changed) === Number(zrow.changed) && no(zrow.deleted) && Number(zrow.changed) >= tz - 1000,
      'and answers that file row', 'answered ' + short(zeta.body) + ', the row ' + short(zrow));
    const wantZeta = concerning(s.run, Z + 'zeta.js');
    ok(wantZeta.indexOf(Z + 'test/zeta.js') !== -1 && JSON.stringify(names(suiteRows(zt, Z + 'zeta.js'))) === JSON.stringify(wantZeta), 'it makes a suite row for every suite that concerns the file', 'rows ' + short(names(suiteRows(zt, Z + 'zeta.js'))) + ', wanted ' + short(wantZeta));
    const zunflagged = suiteRows(zt, Z + 'zeta.js').filter(function (r) { return !yes(r.test); });
    ok(suiteRows(zt, Z + 'zeta.js').length > 0 && !zunflagged.length, 'every suite row it makes is flagged needs testing', 'not flagged: ' + short(names(zunflagged)));
    const known = await call(N.base, 'testicle.file.get', { name: Z + 'gamma.js' });
    const grow = fileRow(tables(DB), Z + 'gamma.js');
    ok(known.status === 200 && !!grow && !!known.body && known.body.name === grow.name && known.body.hash === grow.hash, 'file.get of a file with rows answers its row as it stands', 'answered ' + short(known.body) + ', the row ' + short(grow));

    // goal/G47.1, the verbs cycle: testicle.suite.search. The box: "A standard table search response", "The file row owns
    // its suite rows: the suite table's key is file and suite. So suite.search takes the production file and answers that
    // file's suite rows only, each suite once, with its filename and its status; the words narrow among them", "the suite
    // files, each with test as the final folder it is in", "The suite search returns both: the filename AND its status
    // \"needs running\"". The standard answer: {items: [{key, label}], more}, each label the row as JSON.
    test.subHeading('the box: "testicle.suite.search"');
    const items = function (r) { return ((r.body && r.body.items) || []).map(function (i) { return { key: i.key, row: parsed(i.label) || {} }; }); };
    const suiteOf = function (i) { return String(i.row.suite || i.key || ''); };
    const all = await call(N.base, 'testicle.suite.search', { file: Z + 'zeta.js', text: '' });
    const got = items(all);
    ok(all.status === 200 && !!all.body && Array.isArray(all.body.items) && typeof all.body.more === 'boolean', 'suite.search answers a standard table search: items and more', 'suite.search: ' + all.status + ' ' + short(all.text));
    const gotNames = got.map(suiteOf).sort();
    ok(JSON.stringify(gotNames) === JSON.stringify(wantZeta), 'with no words it answers the file\'s suites, each once, and no other', 'answered ' + short(gotNames) + ', wanted ' + short(wantZeta));
    ok(got.length > 0 && got.every(function (i) { return i.row.file === Z + 'zeta.js'; }), 'every row it answers is the given file\'s', 'files: ' + short(got.map(function (i) { return i.row.file; })));
    ok(got.length > 0 && got.every(function (i) { return path.posix.basename(path.posix.dirname(suiteOf(i))) === 'test'; }), 'every suite it answers is a file whose final folder is test', 'suites: ' + short(gotNames));
    ok(got.length > 0 && got.every(function (i) { return yes(i.row.test) || i.row.status === 'needs running'; }), 'every suite it answers carries its status: needs running', 'rows: ' + short(got.map(function (i) { return i.row; }).slice(0, 3)));
    const narrow = items(await call(N.base, 'testicle.suite.search', { file: Z + 'zeta.js', text: 'titleRules' })).map(suiteOf);
    ok(narrow.indexOf(GENERAL) !== -1 && narrow.indexOf(Z + 'test/zeta.js') === -1, 'the words narrow among the file\'s suites', 'searched titleRules: ' + short(narrow));
    const other = items(await call(N.base, 'testicle.suite.search', { file: Z + 'gamma.js', text: '' }));
    ok(other.length > 0 && other.every(function (i) { return i.row.file === Z + 'gamma.js'; }) && other.map(suiteOf).indexOf(Z + 'test/zeta.js') === -1, 'another file\'s search answers that file\'s rows, none of the first', 'gamma.js: ' + short(other.map(function (i) { return i.row.file + ' ' + suiteOf(i); }).slice(0, 5)));

    // Before the general test changes: that one judges every product file, the untouched among them.
    test.subHeading('the box: "A product file or a suite that has not changed has no row"');
    append(Z + 'notes.md', 'no script\n');
    const n1 = await after();
    ok(!fileRow(n1, Z + 'notes.md'), 'a changed file that is no product script gets no row', 'a row for notes.md: ' + short(fileRow(n1, Z + 'notes.md')));
    ok(!fileRow(n1, Z + 'epsilon.js') && !suiteRows(n1, Z + 'epsilon.js').length, 'a product file never changed, its suite never changed, has no row', 'rows for epsilon.js: ' + short([fileRow(n1, Z + 'epsilon.js'), suiteRows(n1, Z + 'epsilon.js')]));

    test.subHeading('the box: "When a suite ... is changed": a general test');
    const reach = judgedBy(s.run, GENERAL);
    ok(reach.length > 100, 'the world: the changed general test judges every product file', 'it judges ' + reach.length);
    append(GENERAL, '// a general test changed\n');
    // While it does that work, busy answers true; asked over and over in that second, it says so at least once.
    const seen = [];
    const stopAt = Date.now() + 1000;
    while (Date.now() < stopAt) { const b = await call(N.base, 'testicle.busy', {}); seen.push(b.body === true || (b.body && b.body.busy === true)); }
    const r1 = tables(DB);
    ok(seen.indexOf(true) !== -1, 'while it works on a changed general test, busy answers true', 'busy asked ' + seen.length + ' times in that second, never true');
    await sleep(1000);
    const done = await call(N.base, 'testicle.busy', {});
    ok(done.status === 200 && (done.body === false || (done.body && done.body.busy === false)), 'once that work is done, busy answers false again', 'busy after: ' + done.status + ' ' + short(done.text));
    const missing = reach.filter(function (f) { return !suiteRow(r1, f, GENERAL); });
    ok(reach.length > 0 && !missing.length, 'one second after a general test changes, every file it judges has its suite row for it', missing.length + ' of ' + reach.length + ' have none, the first: ' + short(missing.slice(0, 5)));
    const unfiled = reach.filter(function (f) { return !fileRow(r1, f); });
    ok(reach.length > 0 && !unfiled.length, 'and every one of those files has its row in file', unfiled.length + ' of ' + reach.length + ' have none, the first: ' + short(unfiled.slice(0, 5)));

    test.subHeading('the box: "A removed file\'s row is marked deleted"');
    fs.rmSync(path.join(s.run, Z + 'alpha.js'));
    const x1 = await after();
    const gone = fileRow(x1, Z + 'alpha.js');
    ok(!!gone && yes(gone.deleted), 'one second after a product file is removed, its row is marked deleted', 'row: ' + short(gone));
    const left = suiteRows(x1, Z + 'alpha.js').filter(function (r) { return !yes(r.deleted); });
    ok(suiteRows(x1, Z + 'alpha.js').length > 0 && !left.length, 'and its suite rows are marked deleted', 'not deleted: ' + short(names(left)));
  } finally {
    for (const k of live) await stop(k);
    try { fs.rmSync(s.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
