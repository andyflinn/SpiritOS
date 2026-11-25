'use strict';
// spirit/run/spirit/app/testicle/job/analyze/test/script.js
// THE ANALYSIS OF ONE RED, A TOOL SCRIPT (goal/G49.6, box v15; Andy: "analyze, the verb goes, and analyze becomes a tool
// script at spirit/app/testicle/job/analyze/script.js", "analyze is a developer tool and maybe can be invoked directly by
// agents, so no waiting for or interrupting the server"). The box: "its checks are its own suite ... run on a copied
// database". A scratch run root holds a planted testicle.db; the script is started in it, as an agent starts it in its own
// node's tree, handed a red or none, and what it prints is judged against the box's own words.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const S = require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/test/testReport.js');
const tempFolder = S.requireScript('spirit/tempFolder/script.js').tempFolder;
const SUBJECT = path.join(RUN, 'spirit', 'app', 'testicle', 'job', 'analyze', 'script.js');

// The planted world (box points 1-7): the red is "it holds" of a general suite on x.js, green at T0 against script hash h1 and
// red at T2 against h2; x.js's other current reds are a plain one and the setup check; the same test is red on 25 other
// scripts; z.js's test went from red to green in the same run as the red's flip; f.js's test is green and red with the same
// hashes, nothing changed.
const TM = 1000000000000 - 60000, T0 = 1000000000000, T1 = T0 + 60000, T2 = T0 + 120000;
const GEN = 'spirit/test/zzRule.js';
const X = 'spirit/zz/x.js';
const RED = 'it holds';
const SETUP = 'a scratch node with its DEBUG on and a Chrome page are ready';
const NEIGHBOUR = 'it says no error';
const Z = 'spirit/zz/z.js', ZS = 'spirit/zz/test/z.js', ZT = 'z works';
const WS = 'spirit/zz/w.js', WSS = 'spirit/zz/test/w.js', WT = 'w turns green once';
const U = 'spirit/zz/u.js', US = 'spirit/zz/test/u.js', UT = 'u takes turns, sharing nothing';
const Q = 'spirit/zz/q.js', QS = 'spirit/zz/test/q.js', QT = 'q, whose own block changed';
const R = 'spirit/zz/r.js', RS = 'spirit/zz/test/r.js', RT = 'r, whose required file changed';
const D = 'spirit/zz/d.js';
const HS = 'spirit/zz/h.js', HSS = 'spirit/zz/test/h.js', HT = 'h, whose run hung';
const N = 'spirit/zz/n.js', NS = 'spirit/zz/test/n.js', NT = 'n, never green';
const C = ['spirit/zz/c1.js', 'spirit/zz/c2.js', 'spirit/zz/c3.js'], CS = 'spirit/test/zzClassify.js', CT = 'it loads, so it can be classified';
const E = ['spirit/zz/e1.js', 'spirit/zz/e2.js', 'spirit/zz/e3.js'], ES = 'spirit/test/zzApart.js', ET = 'it is red, apart';
const F = 'spirit/zz/f.js', FS_ = 'spirit/zz/test/f.js', FT = 'f wobbles';
const OTHERS = Array.from({ length: 25 }, function (v, i) { return 'spirit/zz/y' + i + '.js'; });
const SCHEMA = [
  "CREATE TABLE script (name TEXT PRIMARY KEY, hash TEXT NOT NULL DEFAULT '', deleted INTEGER NOT NULL DEFAULT 0, changed INTEGER NOT NULL, reClassify INTEGER NOT NULL DEFAULT 1, browserOnly INTEGER NOT NULL DEFAULT 0, nodeOnly INTEGER NOT NULL DEFAULT 0)",
  "CREATE TABLE suite (script TEXT NOT NULL, suite TEXT NOT NULL, test INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0, hash TEXT NOT NULL DEFAULT '', outcome TEXT NOT NULL DEFAULT '', changed INTEGER NOT NULL, reason TEXT NOT NULL DEFAULT '', ms INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (script, suite))",
  'CREATE TABLE dependency (script TEXT NOT NULL, requires TEXT NOT NULL, PRIMARY KEY (script, requires))',
  "CREATE TABLE testicle (id INTEGER PRIMARY KEY, script TEXT NOT NULL, suite TEXT NOT NULL, test TEXT NOT NULL, current INTEGER NOT NULL DEFAULT 1, verified INTEGER NOT NULL, tested INTEGER NOT NULL, judged TEXT NOT NULL DEFAULT '', severity REAL NOT NULL DEFAULT 0, suiteHash TEXT NOT NULL DEFAULT '', testHash TEXT NOT NULL DEFAULT '')"
];
// What requires what (the dependency table): x.js requires z.js, so z.js shares a file with the red; r.js and n.js require d.js.
const DEPS = [[X, Z], [R, D], [N, D]];
function plant(root, rows) {
  const dir = path.join(root, 'spirit', 'state', 'testicle', 'data');
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, 'testicle.db'));
  SCHEMA.forEach(function (s) { db.exec(s); });
  const put = db.prepare('INSERT INTO testicle (script, suite, test, current, verified, tested, judged, severity, suiteHash, testHash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  rows.forEach(function (r) { put.run(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9] || ''); });
  // d.js, required by r.js, changed at T1, after r.js's green at T0; every other script last changed at T0.
  [X, Z, WS, U, Q, R, D, HS, N, F].concat(C, E, OTHERS).forEach(function (n) { db.prepare('INSERT INTO script (name, hash, changed) VALUES (?, ?, ?)').run(n, n === X ? 'h2' : 'h', n === D ? T1 : T0); });
  DEPS.forEach(function (d) { db.prepare('INSERT INTO dependency (script, requires) VALUES (?, ?)').run(d[0], d[1]); });
  [[X, GEN, ''], [Q, QS, ''], [R, RS, ''], [HS, HSS, 'hung'], [N, NS, '']].forEach(function (x) { db.prepare('INSERT INTO suite (script, suite, outcome, changed, reason) VALUES (?, ?, ?, ?, ?)').run(x[0], x[1], 'red', T2, x[2]); });
  db.close();
}
const WORLD = [
  // x.js's red: since its green the script's hash changed (h1 to h2) and the suite's (s1 to s2), its own test's did not (t1)
  [X, GEN, RED, 0, 0, TM, 'h0', 0.6, 's1', 't1'],
  [X, GEN, RED, 0, 1, T0, 'h1', 0.6, 's1', 't1'],
  [X, GEN, RED, 1, 0, T2, 'h2', 0.6, 's2', 't1'],
  [X, GEN, NEIGHBOUR, 1, 0, T2, 'h2', 0.3, 's1'],
  [X, GEN, SETUP, 1, 0, T2, 'h2', 0.2, 's1'],
  [Z, ZS, ZT, 0, 1, TM, 'hz', 0.4, 'sz'],
  [Z, ZS, ZT, 0, 0, T1, 'hz', 0.4, 'sz'],
  [Z, ZS, ZT, 1, 1, T2, 'hz', 0.4, 'sz'],
  // u.js took turns with the red twice too, but shares no file with it
  [U, US, UT, 0, 1, TM, 'hu', 0.4, 'su'],
  [U, US, UT, 0, 0, T1, 'hu', 0.4, 'su'],
  [U, US, UT, 1, 1, T2, 'hu', 0.4, 'su'],
  // q.js: its own test's hash changed (tq1 to tq2), its script's did not
  [Q, QS, QT, 0, 1, T0, 'hq', 0.35, 'sq1', 'tq1'],
  [Q, QS, QT, 1, 0, T2, 'hq', 0.35, 'sq2', 'tq2'],
  // r.js: neither its script's nor its test's hash changed, and d.js, which it requires, changed after its green
  [R, RS, RT, 0, 1, T0, 'hr', 0.35, 'sr1', 'tr'],
  [R, RS, RT, 1, 0, T2, 'hr', 0.35, 'sr2', 'tr'],
  // h.js: red in a run that hung
  [HS, HSS, HT, 0, 1, T0, 'hh1', 0.35, 'sh', 'th'],
  [HS, HSS, HT, 1, 0, T2, 'hh2', 0.35, 'sh', 'th'],
  // n.js: never green, requiring d.js
  [N, NS, NT, 1, 0, T2, 'hn', 0.35, 'sn', 'tn'],
  [WS, WSS, WT, 0, 0, T1, 'hw', 0.4, 'sw'],
  [WS, WSS, WT, 1, 1, T2, 'hw', 0.4, 'sw'],
  [F, FS_, FT, 0, 1, T0, 'hf', 0.4, 'sf'],
  [F, FS_, FT, 1, 0, T2, 'hf', 0.4, 'sf']
// The 25 others red each 5 s apart, before x.js, so none falls within a second of it: no one run cut off (box v20).
].concat(OTHERS.map(function (n, i) { return [n, GEN, RED, 1, 0, T2 - (i + 1) * 5000, 'h', 0.5, 's1']; }))
// box v20: "the same test red on 2 or more other scripts within a second of it is one run cut off (a classifier's has no
// reason): not in this test: one run red on all". c1.js went red with c2.js and c3.js within 400 ms, its script hash changed;
// e1.js went red with e2.js and e3.js 5 s apart, its script hash changed too, and that is no one run.
  .concat([
    [C[0], CS, CT, 0, 1, T0, 'hc1', 0.35, 'sc', 'tc'], [C[0], CS, CT, 1, 0, T2, 'hc2', 0.35, 'sc', 'tc'],
    [C[1], CS, CT, 1, 0, T2 + 200, 'h', 0.35, 'sc', 'tc'], [C[2], CS, CT, 1, 0, T2 + 400, 'h', 0.35, 'sc', 'tc'],
    [E[0], ES, ET, 0, 1, T0, 'he1', 0.35, 'se', 'te'], [E[0], ES, ET, 1, 0, T2, 'he2', 0.35, 'se', 'te'],
    [E[1], ES, ET, 1, 0, T2 + 5000, 'h', 0.35, 'se', 'te'], [E[2], ES, ET, 1, 0, T2 + 10000, 'h', 0.35, 'se', 'te']
  ]);

const W = {};
// The tool stands in the scratch run root, a copy of it at its own path, and is started there: its run root is that root,
// whether read from where it stands or where it is started, and its database the planted one, never this node's.
const REL = 'spirit/app/testicle/job/analyze/script.js';
function run(root, args) {
  const copy = path.join(root, REL);
  if (!fs.existsSync(copy) && fs.existsSync(SUBJECT)) { fs.mkdirSync(path.dirname(copy), { recursive: true }); fs.copyFileSync(SUBJECT, copy); }
  const r = spawnSync(process.execPath, [copy].concat(args || []), { cwd: root, encoding: 'utf8', timeout: 60000 });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch (e) { json = null; }
  return { code: r.status, out: r.stdout || '', err: r.stderr || '', json: json };
}
test.after(function () { try { fs.rmSync(tempFolder.path('spirit/app/testicle/job'), { recursive: true, force: true }); } catch (e) { /* gone */ } });

test.run('the tool script spirit/app/testicle/job/analyze/script.js is there', 0.2, function () {
  return fs.existsSync(SUBJECT);
}, test.limit.quick);
test.run('a scratch run root holds a planted testicle.db, and the tool is started in it with no red', 0.2, function () {
  W.root = tempFolder('spirit/app/testicle/job/analyze/test/world');
  plant(W.root, WORLD);
  W.a = run(W.root, []);
  W.b = run(W.root, []);
  return !!W.a && !!W.b;
}, test.limit.slow);
// "one JSON object on stdout, nothing else printed there"
test.run('it prints one JSON object on stdout and nothing else there', 0.6, function () {
  return !!W.a && W.a.code === 0 && !!W.a.json && typeof W.a.json === 'object' && !Array.isArray(W.a.json);
}, test.limit.quick);
// "its keys in the order of the answers above: said, red, lastGreen, blame, suspects, fixFirst, sameTestElsewhere, flaky,
// contradicts, world, unknown" (a list's count of what was left out stands beside it, so only these are in order)
const KEYS = ['said', 'red', 'lastGreen', 'blame', 'suspects', 'fixFirst', 'sameTestElsewhere', 'flaky', 'contradicts', 'world', 'unknown'];
test.run('its keys come in the box order: said, red, lastGreen, blame, suspects, fixFirst, sameTestElsewhere, flaky, contradicts, world, unknown', 0.4, function () {
  if (!W.a || !W.a.json) return false;
  const keys = Object.keys(W.a.json).filter(function (k) { return KEYS.indexOf(k) !== -1; });
  return keys.join() === KEYS.join();
}, test.limit.quick);
// "handed none, it analyzes the most severe red ... in testicle.red's own order, read from testicle.db itself"
test.run('handed none, it analyzes the most severe red: it holds on x.js, severity 0.6', 0.6, function () {
  const r = W.a && W.a.json && W.a.json.red;
  return !!r && r.script === X && r.suite === GEN && r.test === RED && Number(r.severity) === 0.6;
}, test.limit.quick);
// "1. the red itself: script, suite, test, severity, reason (crashed, hung or a plain fail), when it ran"
test.run('the red itself carries its reason and when it ran', 0.4, function () {
  const r = W.a && W.a.json && W.a.json.red;
  return !!r && typeof r.reason === 'string' && r.reason.length > 0 && Number(r.tested) === T2;
}, test.limit.quick);
// "2. ... its last green ... and whether that green had the same script hash and suite hash as the red"
test.run('its last green is the one at T0, which had another script hash', 0.4, function () {
  const g = W.a && W.a.json && W.a.json.lastGreen;
  return !!g && Number(g.tested) === T0 && g.sameHashes === false;
}, test.limit.quick);
// box v18, 5: "a setup check of the same run that is red too ... is the only thing to fix first ...; the script's other current
// reds are a count beside it, never a list, so no red points at another in a circle"
test.run('what to fix first is the setup check of the same run alone, never the script\'s other red', 0.6, function () {
  const f = W.a && W.a.json && W.a.json.fixFirst;
  if (!Array.isArray(f) || !f.length) return false;
  return f.every(function (x) { return x && x.test === SETUP; });
}, test.limit.quick);
// "and the same test red on other scripts"; box v17: "every list at most 5 by default, --all for the rest", with a count of what was left out beside it
test.run('the same test red on 25 other scripts is listed 5, with 20 counted as left out', 0.4, function () {
  const j = W.a && W.a.json;
  return !!j && Array.isArray(j.sameTestElsewhere) && j.sameTestElsewhere.length === 5 && Number(j.sameTestElsewhereMore) === 20;
}, test.limit.quick);
// "7. contradictory tests: ... that take turns, one green whenever the other is red"; box v17: they count only when they took turns
// at least twice. z.js was green while x.js was red (TM), red while x.js was green (T0, T1), and green again as x.js turned red
// (T2): it took turns twice. w.js only turned green at T2, once: a fix, never a contradiction.
// box v18: "and when it shares a file with the red: the same script, or one in the red script's dependency rows": x.js requires
// z.js; u.js took turns twice too but shares nothing.
test.run('z.js, sharing a file with the red and taking turns twice, contradicts it; w.js, green once, and u.js, sharing nothing, do not', 0.4, function () {
  const c = W.a && W.a.json && W.a.json.contradicts;
  return Array.isArray(c) && c.some(function (x) { return x && x.script === Z && x.test === ZT; }) && !c.some(function (x) { return x && (x.script === WS || x.script === U); });
}, test.limit.quick);
// "6. flaky: the same test, with the same script hash and suite hash, has both green and red in its history"
test.run('the red, whose script hash changed, is not flaky', 0.4, function () {
  return !!W.a && !!W.a.json && W.a.json.flaky === false;
}, test.limit.quick);
// "9. what it does not know, said plainly"
test.run('what it does not know is a list of plain sentences', 0.2, function () {
  const u = W.a && W.a.json && W.a.json.unknown;
  return Array.isArray(u) && u.every(function (x) { return typeof x === 'string' && x.length > 0; });
}, test.limit.quick);
// "said first: two or three plain sentences ...; made from the fields by fixed sentences, so the same red always gives the same words"
test.run('said is plain words, the same both times the same red is analyzed', 0.4, function () {
  const a = W.a && W.a.json, b = W.b && W.b.json;
  return !!a && !!b && typeof a.said === 'string' && a.said.length > 0 && a.said === b.said;
}, test.limit.quick);
// box v18, 3, the hashes, the test's own hash (testHash) in place of the suite's: "in the script (the script's hash changed, the
// test's did not)"; x.js's suite hash changed too, which no longer makes it not known.
test.run('x.js\'s red, its script changed and its own test not, is blamed on the script', 0.6, function () {
  const b = W.a && W.a.json && W.a.json.blame;
  return !!b && b.where === 'in the script';
}, test.limit.quick);
function handed(script, suite, title) {
  const db = new DatabaseSync(path.join(W.root, 'spirit', 'state', 'testicle', 'data', 'testicle.db'), { readOnly: true });
  try { return db.prepare('SELECT * FROM testicle WHERE current = 1 AND script = ? AND suite = ? AND test = ?').get(script, suite, title); } finally { db.close(); }
}
function verdictOf(script, suite, title) {
  if (!W.root) return null;
  const r = run(W.root, [JSON.stringify(handed(script, suite, title))]);
  return r.code === 0 && r.json ? r.json : null;
}
// "in the test (the test's hash changed, the script's did not)"
test.run('q.js\'s red, its own test changed and its script not, is blamed on the test', 0.6, function () {
  const j = verdictOf(Q, QS, QT);
  return !!j && !!j.blame && j.blame.where === 'in the test';
}, test.limit.slow);
// "in a script it requires (neither changed, and a file it requires changed after the green, named ...)"
test.run('r.js\'s red, neither changed and d.js it requires changed after the green, is blamed on a script it requires, d.js named', 0.6, function () {
  const j = verdictOf(R, RS, RT);
  return !!j && !!j.blame && j.blame.where === 'in a script it requires' && JSON.stringify(j.blame).indexOf(D) !== -1;
}, test.limit.slow);
// "First the run: a run that hung, crashed or never started (the suite row's reason) is its own verdict, not in this test: the
// run hung, ahead of every check below": h.js's script hash changed too, and the run's reason still comes first.
test.run('h.js\'s red, in a run that hung, is not in this test, ahead of its changed script hash', 0.6, function () {
  const j = verdictOf(HS, HSS, HT);
  return !!j && !!j.blame && /^not in this test/.test(String(j.blame.where)) && /hung/.test(JSON.stringify(j.blame));
}, test.limit.slow);
// box v18, 4: "never green, none, since there is no green to be after"
test.run('n.js\'s red, never green, has no suspects though it requires d.js', 0.4, function () {
  const j = verdictOf(N, NS, NT);
  return !!j && Array.isArray(j.suspects) && j.suspects.length === 0;
}, test.limit.slow);
// "handed its id alone, it reads the rest of the row from testicle.db"
test.run('handed x.js\'s red by its id alone, it analyzes that red', 0.4, function () {
  if (!W.root) return false;
  const row = handed(X, GEN, RED);
  const r = run(W.root, [JSON.stringify({ id: row && row.id })]);
  return r.code === 0 && !!r.json && !!r.json.red && r.json.red.script === X && r.json.red.test === RED;
}, test.limit.slow);
test.run('c1.js\'s red, red with c2.js and c3.js within a second, is not in this test: one run red on all', 0.6, function () {
  const j = verdictOf(C[0], CS, CT);
  return !!j && !!j.blame && /^not in this test/.test(String(j.blame.where)) && /one run/.test(String(j.blame.where) + ' ' + String(j.blame.because));
}, test.limit.slow);
test.run('e1.js\'s red, red with e2.js and e3.js 5 s apart, is no one run: blamed on its changed script', 0.4, function () {
  const j = verdictOf(E[0], ES, ET);
  return !!j && !!j.blame && j.blame.where === 'in the script';
}, test.limit.slow);
// box v20: "it opens testicle.db with a busy timeout of 5 s, so a server write makes it wait, never fail". The suite holds a write on
// the planted database for 2 s while the tool starts; the tool waits and answers.
test.run('started while testicle.db is held by a write for 2 s, it waits and answers, never failing on a lock', 0.6, async function () {
  if (!W.root) return false;
  const copy = path.join(W.root, REL);
  if (!fs.existsSync(copy)) return false;
  const db = new DatabaseSync(path.join(W.root, 'spirit', 'state', 'testicle', 'data', 'testicle.db'));
  // A write inside it, as the server's are: an exclusive transaction that has written keeps every reader out until it ends.
  db.exec('BEGIN EXCLUSIVE');
  db.exec('UPDATE testicle SET severity = severity WHERE id = (SELECT min(id) FROM testicle)');
  const kid = require('child_process').spawn(process.execPath, [copy], { cwd: W.root });
  let out = '';
  kid.stdout.on('data', function (d) { out += d; });
  const ended = new Promise(function (r) { kid.on('close', function (code) { r(code); }); });
  await new Promise(function (r) { setTimeout(r, 2000); });
  db.exec('ROLLBACK');
  db.close();
  const code = await ended;
  let j = null;
  try { j = JSON.parse(out); } catch (e) { j = null; }
  return code === 0 && !!j && !!j.red;
}, test.limit.slow);
// "handed a red-testicle: the red testicle row itself"
test.run('handed f.js\'s red row, it analyzes that one, and finds it flaky: green and red with the same hashes', 0.6, function () {
  if (!W.root) return false;
  const row = JSON.stringify({ script: F, suite: FS_, test: FT, current: 1, verified: 0, tested: T2, judged: 'hf', severity: 0.4, suiteHash: 'sf' });
  const r = run(W.root, [row]);
  const j = r.json;
  return r.code === 0 && !!j && !!j.red && j.red.script === F && j.red.test === FT && j.flaky === true;
}, test.limit.slow);
// "--all lifts the per-list and per-diff bounds"
test.run('with --all, the same test on other scripts is listed whole: 25', 0.2, function () {
  if (!W.root) return false;
  const r = run(W.root, ['--all']);
  return r.code === 0 && !!r.json && Array.isArray(r.json.sameTestElsewhere) && r.json.sameTestElsewhere.length === 25;
}, test.limit.slow);
// "nothing red: { "red": null }, exit code 0"
test.run('on a testicle.db with nothing red it answers { red: null } and exits 0', 0.4, function () {
  W.empty = tempFolder('spirit/app/testicle/job/analyze/test/empty');
  plant(W.empty, [[X, GEN, RED, 1, 1, T2, 'h2', 0.6, 's1']]);
  const r = run(W.empty, []);
  return r.code === 0 && !!r.json && r.json.red === null;
}, test.limit.slow);
// "a failure of the tool itself (no database, a red handed that is not there) goes to stderr with exit code 1"
test.run('with no testicle.db it says why on stderr, prints nothing on stdout, and exits 1', 0.6, function () {
  W.none = tempFolder('spirit/app/testicle/job/analyze/test/none');
  const r = run(W.none, []);
  return r.code === 1 && r.out.trim() === '' && r.err.trim().length > 0 && !/Cannot find module/.test(r.err);
}, test.limit.slow);
test.run('handed a red that is not in testicle.db it says why on stderr and exits 1', 0.4, function () {
  if (!W.root) return false;
  const r = run(W.root, [JSON.stringify({ script: 'spirit/zz/gone.js', suite: 'spirit/zz/test/gone.js', test: 'not there' })]);
  return r.code === 1 && r.out.trim() === '' && r.err.trim().length > 0 && !/Cannot find module/.test(r.err);
}, test.limit.slow);
// "it reads testicle.db directly, read only"
test.run('it leaves testicle.db as it found it', 0.4, function () {
  if (!W.root || !W.a || W.a.code !== 0) return false;
  const db = new DatabaseSync(path.join(W.root, 'spirit', 'state', 'testicle', 'data', 'testicle.db'), { readOnly: true });
  try { return db.prepare('SELECT count(*) n FROM testicle').get().n === WORLD.length; } finally { db.close(); }
}, test.limit.quick);
