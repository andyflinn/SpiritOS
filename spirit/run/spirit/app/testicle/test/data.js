'use strict';

// spirit/run/spirit/app/testicle/test/data.js
// The tests of spirit/app/testicle/data.js, and of no other module (spec: ./data.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
// What a client knows of testicle's server (goal/G41.28, goal/G47.1): its three tables, script, suite and testicle, each
// a branch under the node that served it, the rows the server publishes merged in, every suite made once from its rows,
// and the monitor's one row. It runs as a page runs it: in a window of its own beside the real spirit.data
// (spirit/data.js), which it writes into; the rows are handed in as the stream hands them, jobs of module
// spirit.app.testicle. In node it is asked through spirit.cacheManager. One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'data.js');
const SPIRIT_DATA = path.join(RUN, 'spirit', 'data.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const HOME_KEY = 'Ab+c/DeF0123456789abcdefghijklmnopqrstuvwxy=';
const OTHER_KEY = 'Zz+y/XwV9876543210zyxwvutsrqponmlkjihgfedcba=';
const TABLES = ['script', 'suite', 'testicle'];

const W = {};
let n = 0;
// A row as the stream hands it: a job of module spirit.app.testicle whose app is testicle's publish (testicle.js).
const job = function (app, module, from) { W.D.takeJob({ id: 'j' + (++n), module: module || 'spirit.app.testicle', data: {}, app: app }, from || HOME_KEY); };
const at = function (table, key, from) { return W.D.getPath(W.D.nodeId(from || HOME_KEY) + '/testicle/' + table + '/' + key); };
const NO_WORLD = 'no spirit.data.testicle.data: the world failed';
const suiteRow = function (script, suite, more) { return Object.assign({ key: script + '|' + suite, script: script, suite: suite, test: false, status: 'green', deleted: false, outcome: 'green', changed: 1 }, more || {}); };

test.run('the world: in a window, beside the real spirit.data, it stands at spirit.data.testicle.data', 0.2, function () {
  const win = { JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Map: Map, Math: Math, Date: Date, unescape: unescape, encodeURIComponent: encodeURIComponent };
  win.window = win;
  // A page's window: the data set knows it is on a page, so its home is the page's node, whatever node a row came from.
  win.spirit = { isBrowser: function () { return true; } };
  try {
    vm.createContext(win);
    vm.runInContext(fs.readFileSync(SPIRIT_DATA, 'utf8'), win, { filename: SPIRIT_DATA });
    win.spirit.data.homeNode(HOME_KEY);
    vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  } catch (e) { return 'it threw: ' + short(e && e.message); }
  W.D = win.spirit.data;
  W.T = ((W.D || {}).testicle || {}).data;
  return !!W.T || 'spirit.data.testicle is ' + short(W.D && W.D.testicle);
}, test.limit.quick);
test.run('its tables are script, suite and testicle', 0.2, function () {
  if (!W.T) return NO_WORLD;
  return JSON.stringify(W.T.tables) === JSON.stringify(TABLES) || 'tables ' + short(W.T.tables);
}, test.limit.quick);
test.run('branch(table) is the table\'s whole path, <node>/testicle/<table>; \'\' for any other', 0.2, function () {
  if (!W.T) return NO_WORLD;
  const wrong = TABLES.filter(function (t) { return W.T.branch(t) !== W.D.nodeId(HOME_KEY) + '/testicle/' + t; });
  return (wrong.length === 0 && W.T.branch('monitor') === '') || 'wrong: ' + short(wrong) + ', monitor ' + short(W.T.branch('monitor'));
}, test.limit.quick);
test.run('before the stream has said anything, monitor.get() is {}', 0.2, function () {
  if (!W.T || !W.T.monitor) return NO_WORLD;
  return JSON.stringify(W.T.monitor.get()) === '{}' || 'monitor ' + short(W.T.monitor.get());
}, test.limit.quick);

// ── the translator (goal/G47.1, the UI cycle: "the server, of course, publishes changes") ──
test.run('a script row published is kept at script/<its name>', 0.2, function () {
  if (!W.T) return NO_WORLD;
  job({ testicle: { table: 'script', row: { name: 'spirit/seal.js', hash: 'h1', deleted: false, changed: 5 } } });
  const r = at('script', 'spirit/seal.js');
  return (!!r && r.hash === 'h1') || 'kept ' + short(r);
}, test.limit.quick);
test.run('a suite row is kept at suite/<its key>, or script|suite when it carries no key', 0.2, function () {
  if (!W.T) return NO_WORLD;
  job({ testicle: { table: 'suite', row: suiteRow('spirit/seal.js', 'spirit/test/seal.js') } });
  const keyless = suiteRow('spirit/router.js', 'spirit/test/router.js'); delete keyless.key;
  job({ testicle: { table: 'suite', row: keyless } });
  return (!!at('suite', 'spirit/seal.js|spirit/test/seal.js') && !!at('suite', 'spirit/router.js|spirit/test/router.js')) || 'kept ' + short(W.D.branchAt(W.T.branch('suite')));
}, test.limit.quick);
// The box: "The script column and the suite column show the file name only, no path".
test.run('a test row is kept with scriptName and suiteName, the last part of each path', 0.2, function () {
  if (!W.T) return NO_WORLD;
  const key = 'spirit/seal.js|spirit/test/seal.js|it seals|0';
  job({ testicle: { table: 'testicle', row: { key: key, script: 'spirit/seal.js', suite: 'spirit/test/seal.js', test: 'it seals', flipped: 0, current: true, verified: true, severity: 0.2 } } });
  const r = at('testicle', key);
  return (!!r && r.scriptName === 'seal.js' && r.suiteName === 'seal.js' && r.test === 'it seals') || 'kept ' + short(r);
}, test.limit.quick);
test.run('a row published again is merged: the fields it did not carry stay', 0.2, function () {
  if (!W.T) return NO_WORLD;
  job({ testicle: { table: 'script', row: { name: 'spirit/seal.js', changed: 6 } } });
  const r = at('script', 'spirit/seal.js');
  return (!!r && r.hash === 'h1' && r.changed === 6) || 'kept ' + short(r);
}, test.limit.quick);
test.run('another module\'s rows, another table\'s, and a row with no key write nothing', 0.2, function () {
  if (!W.T) return NO_WORLD;
  const before = JSON.stringify(W.D.branchAt(W.D.nodeId(HOME_KEY) + '/testicle'));
  job({ testicle: { table: 'script', row: { name: 'spirit/x.js' } } }, 'spirit.app.desk');
  job({ testicle: { table: 'bundle', row: { name: 'b' } } });
  job({ testicle: { table: 'script', row: { hash: 'nameless' } } });
  const after = JSON.stringify(W.D.branchAt(W.D.nodeId(HOME_KEY) + '/testicle'));
  return after === before || 'the family\'s branches changed: ' + short(after);
}, test.limit.quick);

// ── every suite, each once, kept from the stream (the box: "Every element of testicle's face updates itself") ──
test.run('a suite row with its script makes the suite\'s own row, keyed |<suite>, with no script', 0.2, function () {
  if (!W.T) return NO_WORLD;
  const r = at('suite', '|spirit/test/seal.js');
  return (!!r && r.script === '' && r.suite === 'spirit/test/seal.js' && r.key === '|spirit/test/seal.js') || 'kept ' + short(r);
}, test.limit.quick);
test.run('every suite\'s row is green when all its rows are green', 0.2, function () {
  if (!W.T) return NO_WORLD;
  const r = at('suite', '|spirit/test/seal.js');
  return (!!r && r.outcome === 'green' && r.status === 'green' && r.test === false) || 'kept ' + short(r);
}, test.limit.quick);
test.run('red, and still red, when any of its rows is red', 0.2, function () {
  if (!W.T) return NO_WORLD;
  job({ testicle: { table: 'suite', row: suiteRow('spirit/other.js', 'spirit/test/seal.js', { outcome: 'red', status: 'still red', changed: 9 }) } });
  const r = at('suite', '|spirit/test/seal.js');
  return (!!r && r.outcome === 'red' && r.status === 'still red' && r.changed === 9) || 'kept ' + short(r);
}, test.limit.quick);
test.run('needs running if any of its rows is flagged', 0.2, function () {
  if (!W.T) return NO_WORLD;
  job({ testicle: { table: 'suite', row: suiteRow('spirit/seal.js', 'spirit/test/seal.js', { test: true }) } });
  const r = at('suite', '|spirit/test/seal.js');
  return (!!r && r.test === true && r.status === 'needs running') || 'kept ' + short(r);
}, test.limit.quick);
test.run('deleted only when all its rows are', 0.2, function () {
  if (!W.T) return NO_WORLD;
  job({ testicle: { table: 'suite', row: suiteRow('spirit/seal.js', 'spirit/test/seal.js', { deleted: true }) } });
  const one = at('suite', '|spirit/test/seal.js').deleted;
  job({ testicle: { table: 'suite', row: suiteRow('spirit/other.js', 'spirit/test/seal.js', { deleted: true }) } });
  const all = at('suite', '|spirit/test/seal.js').deleted;
  return (one === false && all === true) || 'deleted with one ' + short(one) + ', with all ' + short(all);
}, test.limit.quick);

// ── the monitor (the box: busy "as the server streams it", and "the last change") ──
test.run('the monitor\'s busy is what the stream last said of it', 0.2, function () {
  if (!W.T) return NO_WORLD;
  job({ testicle: { busy: true } });
  const one = W.T.monitor.get().busy;
  job({ testicle: { busy: false } });
  return (one === true && W.T.monitor.get().busy === false) || 'busy ' + short([one, W.T.monitor.get().busy]);
}, test.limit.quick);
test.run('its last change is the last row published: its table, its key, the change, and when', 0.2, function () {
  if (!W.T) return NO_WORLD;
  const before = Date.now();
  job({ testicle: { table: 'script', row: { name: 'spirit/gone.js', deleted: true }, change: 'deleted' } });
  const last = W.T.monitor.get().last || {};
  return (last.table === 'script' && last.key === 'spirit/gone.js' && last.change === 'deleted' && last.at >= before && W.T.monitor.get().busy === false) || 'monitor ' + short(W.T.monitor.get());
}, test.limit.quick);
test.run('a change not named is \'updated\'', 0.2, function () {
  if (!W.T) return NO_WORLD;
  job({ testicle: { table: 'script', row: { name: 'spirit/seal.js', changed: 7 } } });
  return (W.T.monitor.get().last || {}).change === 'updated' || 'monitor ' + short(W.T.monitor.get());
}, test.limit.quick);
test.run('monitor.watch(fn) is told the monitor on every change, and answers its release', 0.2, function () {
  if (!W.T) return NO_WORLD;
  const heard = [];
  const release = W.T.monitor.watch(function (m) { heard.push(m.busy); });
  job({ testicle: { busy: true } });
  release();
  job({ testicle: { busy: false } });
  return JSON.stringify(heard) === '[true]' || 'heard ' + short(heard);
}, test.limit.quick);

// ── the reads and the writes ──
test.run('keep(table, rows) merges what a verb answered into that table\'s branch, a test row with its names', 0.2, function () {
  if (!W.T) return NO_WORLD;
  W.T.keep('suite', [suiteRow('spirit/kept.js', 'spirit/test/kept.js')]);
  W.T.keep('testicle', [{ key: 'k|1', script: 'spirit/a/kept.js', suite: 'spirit/a/test/kept.js', test: 't' }]);
  const t = at('testicle', 'k|1');
  return (!!at('suite', 'spirit/kept.js|spirit/test/kept.js') && !!t && t.scriptName === 'kept.js') || 'kept ' + short(t);
}, test.limit.quick);
test.run('keep of a table it has not, or of rows that are no list, writes nothing', 0.2, function () {
  if (!W.T) return NO_WORLD;
  const before = JSON.stringify(W.D.branchAt(W.D.nodeId(HOME_KEY) + '/testicle'));
  W.T.keep('bundle', [{ name: 'b' }]);
  W.T.keep('script', 'not a list');
  W.T.keep('script', [null, { hash: 'no name' }]);
  return JSON.stringify(W.D.branchAt(W.D.nodeId(HOME_KEY) + '/testicle')) === before || 'the family\'s branches changed';
}, test.limit.quick);
test.run('suite.watch(fn) is told fn(key, row) on every change of the suite table, and of no other', 0.2, function () {
  if (!W.T || !W.T.suite) return NO_WORLD;
  const heard = [];
  const release = W.T.suite.watch(function (key, row) { heard.push(key); });
  job({ testicle: { table: 'script', row: { name: 'spirit/not-a-suite.js' } } });
  W.T.keep('suite', [suiteRow('spirit/w.js', 'spirit/test/w.js', { script: '' , key: '|lonely' })]);
  release();
  W.T.keep('suite', [suiteRow('spirit/w2.js', 'spirit/test/w2.js')]);
  return JSON.stringify(heard) === '["|lonely"]' || 'heard ' + short(heard);
}, test.limit.quick);
test.run('script.watch and testicle.watch are each table\'s own watch', 0.2, function () {
  if (!W.T || !W.T.script || !W.T.testicle) return NO_WORLD;
  const heard = [];
  const r1 = W.T.script.watch(function (key) { heard.push('script ' + key); });
  const r2 = W.T.testicle.watch(function (key) { heard.push('testicle ' + key); });
  W.T.keep('script', [{ name: 'spirit/s.js' }]);
  W.T.keep('testicle', [{ key: 'tk', script: 's', suite: 'u' }]);
  r1(); r2();
  return JSON.stringify(heard) === JSON.stringify(['script spirit/s.js', 'testicle tk']) || 'heard ' + short(heard);
}, test.limit.quick);
test.run('a row from another node is kept under that node', 0.2, function () {
  if (!W.T) return NO_WORLD;
  job({ testicle: { table: 'script', row: { name: 'spirit/far.js' } } }, null, OTHER_KEY);
  const r = at('script', 'spirit/far.js', OTHER_KEY);
  return (!!r && at('script', 'spirit/far.js') === undefined) || 'under the other node ' + short(r);
}, test.limit.quick);

// ── in node, found by the family's name ──
test.run('in node, spirit.cacheManager(\'testicle\') loads it, and it stands at spirit.data.testicle.data', 0.2, async function () {
  require(path.join(RUN, 'spirit', 'spirit.js'));
  const s = globalThis.spirit;
  try { await s.cacheManager('testicle'); } catch (e) { return 'cacheManager(testicle) refused: ' + short(e && e.message); }
  const T = s.data && s.data.testicle && s.data.testicle.data;
  return (!!T && typeof T.keep === 'function' && !!T.monitor) || 'spirit.data.testicle is ' + short(s.data && s.data.testicle);
}, test.limit.quick);
