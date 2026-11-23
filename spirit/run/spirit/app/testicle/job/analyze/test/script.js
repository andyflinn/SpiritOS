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
const S = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = S.requireScript('spirit/test/testReport.js');
const tempFolder = S.requireScript('spirit/tempFolder.js');
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
const F = 'spirit/zz/f.js', FS_ = 'spirit/zz/test/f.js', FT = 'f wobbles';
const OTHERS = Array.from({ length: 25 }, function (v, i) { return 'spirit/zz/y' + i + '.js'; });
const SCHEMA = [
  "CREATE TABLE script (name TEXT PRIMARY KEY, hash TEXT NOT NULL DEFAULT '', deleted INTEGER NOT NULL DEFAULT 0, changed INTEGER NOT NULL, reClassify INTEGER NOT NULL DEFAULT 1, browserOnly INTEGER NOT NULL DEFAULT 0, nodeOnly INTEGER NOT NULL DEFAULT 0)",
  "CREATE TABLE suite (script TEXT NOT NULL, suite TEXT NOT NULL, test INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0, hash TEXT NOT NULL DEFAULT '', outcome TEXT NOT NULL DEFAULT '', changed INTEGER NOT NULL, reason TEXT NOT NULL DEFAULT '', ms INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (script, suite))",
  'CREATE TABLE dependency (script TEXT NOT NULL, requires TEXT NOT NULL, PRIMARY KEY (script, requires))',
  "CREATE TABLE testicle (id INTEGER PRIMARY KEY, script TEXT NOT NULL, suite TEXT NOT NULL, test TEXT NOT NULL, current INTEGER NOT NULL DEFAULT 1, verified INTEGER NOT NULL, tested INTEGER NOT NULL, judged TEXT NOT NULL DEFAULT '', severity REAL NOT NULL DEFAULT 0, suiteHash TEXT NOT NULL DEFAULT '')"
];
function plant(root, rows) {
  const dir = path.join(root, 'spirit', 'state', 'testicle', 'data');
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, 'testicle.db'));
  SCHEMA.forEach(function (s) { db.exec(s); });
  const put = db.prepare('INSERT INTO testicle (script, suite, test, current, verified, tested, judged, severity, suiteHash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  rows.forEach(function (r) { put.run(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8]); });
  [X, Z, WS, F].concat(OTHERS).forEach(function (n) { db.prepare('INSERT INTO script (name, hash, changed) VALUES (?, ?, ?)').run(n, n === X ? 'h2' : 'h', T0); });
  db.prepare('INSERT INTO suite (script, suite, outcome, changed) VALUES (?, ?, ?, ?)').run(X, GEN, 'red', T2);
  db.close();
}
const WORLD = [
  [X, GEN, RED, 0, 0, TM, 'h0', 0.6, 's1'],
  [X, GEN, RED, 0, 1, T0, 'h1', 0.6, 's1'],
  [X, GEN, RED, 1, 0, T2, 'h2', 0.6, 's1'],
  [X, GEN, NEIGHBOUR, 1, 0, T2, 'h2', 0.3, 's1'],
  [X, GEN, SETUP, 1, 0, T2, 'h2', 0.2, 's1'],
  [Z, ZS, ZT, 0, 1, TM, 'hz', 0.4, 'sz'],
  [Z, ZS, ZT, 0, 0, T1, 'hz', 0.4, 'sz'],
  [Z, ZS, ZT, 1, 1, T2, 'hz', 0.4, 'sz'],
  [WS, WSS, WT, 0, 0, T1, 'hw', 0.4, 'sw'],
  [WS, WSS, WT, 1, 1, T2, 'hw', 0.4, 'sw'],
  [F, FS_, FT, 0, 1, T0, 'hf', 0.4, 'sf'],
  [F, FS_, FT, 1, 0, T2, 'hf', 0.4, 'sf']
].concat(OTHERS.map(function (n) { return [n, GEN, RED, 1, 0, T2, 'h', 0.5, 's1']; }));

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
// "5. what to fix first: a setup check of the same run that is red too ... comes first ...; then the script's other current reds"
test.run('what to fix first starts with the setup check of the same run, then the script\'s other red', 0.6, function () {
  const f = W.a && W.a.json && W.a.json.fixFirst;
  if (!Array.isArray(f) || !f.length) return false;
  const titles = f.map(function (x) { return x && x.test; });
  return titles[0] === SETUP && titles.indexOf(NEIGHBOUR) > 0;
}, test.limit.quick);
// "and the same test red on other scripts"; box v17: "every list at most 5 by default, --all for the rest", with a count of what was left out beside it
test.run('the same test red on 25 other scripts is listed 5, with 20 counted as left out', 0.4, function () {
  const j = W.a && W.a.json;
  return !!j && Array.isArray(j.sameTestElsewhere) && j.sameTestElsewhere.length === 5 && Number(j.sameTestElsewhereMore) === 20;
}, test.limit.quick);
// "7. contradictory tests: ... that take turns, one green whenever the other is red"; box v17: they count only when they took turns
// at least twice. z.js was green while x.js was red (TM), red while x.js was green (T0, T1), and green again as x.js turned red
// (T2): it took turns twice. w.js only turned green at T2, once: a fix, never a contradiction.
test.run('z.js\'s test, which took turns with the red twice, contradicts it; w.js\'s, green once, does not', 0.4, function () {
  const c = W.a && W.a.json && W.a.json.contradicts;
  return Array.isArray(c) && c.some(function (x) { return x && x.script === Z && x.test === ZT; }) && !c.some(function (x) { return x && x.script === WS; });
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
