'use strict';

// spirit/run/spirit/auth/test/data.js
// The tests of spirit/auth/data.js, and of no other module (spec: ./data.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// What a client knows of a node's bundles, branches and grants (goal/G41.28), from the node's job spirit.auth (goal/G43.20).
// It runs as it does: in a window of its own beside the real spirit.data (spirit/data.js), which it writes into, the
// stream's events handed in as spirit.data hands them (takeJob, takeRename), each from the node that served it. In node
// it is found as a page finds it, by the family's name (spirit.cacheManager). The reads alone are read, never a branch.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'data.js');
const SPIRIT_DATA = path.join(RUN, 'spirit', 'data.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };
// Two nodes' public keys, base64 with a + and a / in them, as a node's key is.
const SENDER = 'Ab+c/DeF0123456789abcdefghijklmnopqrstuvwxy=';
const OTHER = 'Zy+x/WvU9876543210zyxwvutsrqponmlkjihgfedcb=';

// A window of its own: the real spirit.data, then the file, as a page loads them. Each translator the file adds is kept,
// so an event spirit.data hands no suite (a job gone) can be handed as spirit.data hands it.
function world() {
  const win = { JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Map: Map, Math: Math, Date: Date, unescape: unescape, encodeURIComponent: encodeURIComponent };
  win.window = win;
  win.spirit = {};
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(SPIRIT_DATA, 'utf8'), win, { filename: SPIRIT_DATA });
  const D = win.spirit.data;
  const translators = [];
  const add = D.addTranslator;
  D.addTranslator = function (t) { translators.push(t); return add(t); };
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  const F = D['auth'];
  return { win: win, D: D, F: F, X: F && F.data, translators: translators,
    job: function (job, from) { D.takeJob(job, from || SENDER); },
    nodes: function () { return Object.keys((F && F.cache) || {}); } };
}

// The same on a page: spirit.isBrowser() true and the page's node known (spirit.node.key, as node.card answered it), so
// a row another node served is filed under the node that served it while the reads stay the page's own node's.
function pageWorld() {
  const win = { JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Map: Map, Math: Math, Date: Date, unescape: unescape, encodeURIComponent: encodeURIComponent };
  win.window = win;
  win.spirit = { isBrowser: function () { return true; }, node: { key: SENDER } };
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(SPIRIT_DATA, 'utf8'), win, { filename: SPIRIT_DATA });
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  const D = win.spirit.data;
  const F = D['auth'];
  return { D: D, X: F && F.data, job: function (job, from) { D.takeJob(job, from || SENDER); }, nodes: function () { return Object.keys((F && F.cache) || {}); } };
}

// What the tests make, each in order, read by the tests after it.
let w = null;
const NO_WORLD = 'no world: the file did not run beside spirit.data';

test.run('in node, found by the family\'s name (spirit.cacheManager), it stands at spirit.data.auth.data', 0.2, async function () {
  require(path.join(RUN, 'spirit', 'spirit.js'));
  const S = globalThis.spirit;
  let threw = null;
  try { await S.cacheManager('auth'); } catch (e) { threw = e; }
  const X = S.data && S.data['auth'] && S.data['auth'].data;
  return (!threw && !!X && typeof X === 'object') || 'cacheManager(\'auth\') ' + (threw ? 'refused: ' + threw.message : 'answered, and spirit.data.auth.data is ' + short(X));
}, test.limit.quick);
test.run('the world: run beside spirit.data, it makes its family there', 0.2, function () {
  try { w = world(); } catch (e) { w = null; return 'it threw as it ran: ' + e.message; }
  return (!!w.X && typeof w.X === 'object') || 'spirit.data.auth.data is ' + short(w.X);
}, test.limit.quick);

const K = 'MCowBQYDK2VwAyEA' + 'authDataTest'.padEnd(43, 'A') + '=';
const row = function (table, r, gone) { return { id: 'spirit.auth', data: gone ? { table: table, row: r, gone: true } : { table: table, row: r } }; };

// a row of each of the three tables, kept by its id
test.run('a bundle row is kept by its id, its owner as the node said it', 0.2, function () {
  if (!w) return NO_WORLD;
  w.job(row('bundle', { id: '4', label: 'friends', owner: 'node', extra: 1 }));
  return same(w.X.bundles.row(4), { id: 4, label: 'friends', owner: 'node' }) || short(w.X.bundles.row(4));
}, test.limit.quick);
// goal/G41.25: "The owner as the node said it (it always says one); a row that names none keeps none."
test.run('a bundle row that names no owner keeps none', 0.2, function () {
  if (!w) return NO_WORLD;
  w.job(row('bundle', { id: 5, label: 'work' }));
  const r = w.X.bundles.row(5);
  return (!!r && !('owner' in r) && r.label === 'work') || short(r);
}, test.limit.quick);
test.run('a branch row is kept by its id: its bundle, family and verb', 0.2, function () {
  if (!w) return NO_WORLD;
  w.job(row('branch', { id: '7', bundle: '4', family: 'fs', verb: 'load', extra: 1 }));
  return same(w.X.branches.row(7), { id: 7, bundle: 4, family: 'fs', verb: 'load' }) || short(w.X.branches.row(7));
}, test.limit.quick);
test.run('a grant row is kept whole, by its key and its path', 0.2, function () {
  if (!w) return NO_WORLD;
  const g = { key: K, path: 'spirit/fs', label: 'Bob' };
  w.job(row('grant', g));
  return (w.X.grantKey(K, 'spirit/fs') === K + '\n' + 'spirit/fs' && same(w.X.grants.row(w.X.grantKey(K, 'spirit/fs')), g)) || short(w.X.grants.rows());
}, test.limit.quick);
test.run('rows() answers every row of its table kept', 0.2, function () {
  if (!w) return NO_WORLD;
  return (same(Object.keys(w.X.bundles.rows()).sort(), ['4', '5']) && same(Object.keys(w.X.branches.rows()), ['7']) && Object.keys(w.X.grants.rows()).length === 1) || 'bundles ' + short(Object.keys(w.X.bundles.rows()));
}, test.limit.quick);
test.run('a row with no id, or a job of another id, keeps nothing', 0.2, function () {
  if (!w) return NO_WORLD;
  w.job(row('bundle', { label: 'no id' }));
  w.job({ id: 'spirit.fs', data: { table: 'bundle', row: { id: 99, label: 'x' } } });
  w.job(row('grant', { key: K }));
  return (Object.keys(w.X.bundles.rows()).length === 2 && w.X.bundles.row(99) === null && Object.keys(w.X.grants.rows()).length === 1) || 'bundles ' + short(w.X.bundles.rows());
}, test.limit.quick);
test.run('row() of no id answers null', 0.2, function () {
  if (!w) return NO_WORLD;
  return (w.X.bundles.row('') === null && w.X.branches.row(null) === null && w.X.grants.row(undefined) === null && w.X.bundles.row(42) === null) || short(w.X.bundles.row(''));
}, test.limit.quick);
test.run('watch(fn) hears each change by the row\'s id, and nothing once released', 0.2, function () {
  if (!w) return NO_WORLD;
  const heard = [];
  const off = w.X.bundles.watch(function (id, r) { heard.push([id, r && r.label]); });
  w.job(row('bundle', { id: 6, label: 'six' }));
  off();
  w.job(row('bundle', { id: 9, label: 'nine' }));
  return same(heard, [['6', 'six']]) || 'heard ' + short(heard);
}, test.limit.quick);
test.run('a row gone is let go, in each table', 0.2, function () {
  if (!w) return NO_WORLD;
  const heard = [];
  const off = w.X.branches.watch(function (id, r) { heard.push([id, r]); });
  w.job(row('bundle', { id: 6 }, true));
  w.job(row('branch', { id: 7 }, true));
  w.job(row('grant', { key: K, path: 'spirit/fs' }, true));
  off();
  return (w.X.bundles.row(6) === null && w.X.branches.row(7) === null && w.X.grants.row(w.X.grantKey(K, 'spirit/fs')) === null && same(heard, [['7', undefined]])) || 'branch 7 ' + short(w.X.branches.row(7)) + ', heard ' + short(heard);
}, test.limit.quick);
test.run('branch is the table\'s whole path, under the node that served its rows', 0.2, function () {
  if (!w) return NO_WORLD;
  const pre = w.D.nodeId(SENDER) + '/auth/';
  return [w.X.bundles.branch, w.X.branches.branch, w.X.grants.branch].every(function (b) { return typeof b === 'string' && b.indexOf(pre) === 0 && b.length > pre.length; }) || short([w.X.bundles.branch, w.X.branches.branch]);
}, test.limit.quick);
// goal/G41.28: under the node that served the rows
test.run('on a page, a row another node served is filed under that node, never among the page\'s own node\'s rows', 0.2, function () {
  let p; try { p = pageWorld(); } catch (e) { return 'no page world: ' + e.message; }
  p.job(row('bundle', { id: 4, label: 'mine' }));
  p.job(row('bundle', { id: 8, label: 'theirs' }), OTHER);
  return (same(p.nodes().sort(), [p.D.nodeId(SENDER), p.D.nodeId(OTHER)].sort()) && p.X.bundles.row(8) === null && (p.X.bundles.row(4) || {}).label === 'mine') || 'nodes ' + short(p.nodes()) + ', read on the page: ' + short(p.X.bundles.rows());
}, test.limit.quick);
test.run('in a process, a row from another node is filed under that node, never among the first node\'s rows', 0.2, function () {
  if (!w) return NO_WORLD;
  w.job(row('bundle', { id: 8, label: 'theirs' }), OTHER);
  const there = w.X.bundles.row(8);
  w.job(row('bundle', { id: 1000 }, true));
  const here = w.X.bundles.row(8);
  return (same(w.nodes().sort(), [w.D.nodeId(SENDER), w.D.nodeId(OTHER)].sort()) && !!there && there.label === 'theirs' && here === null && !!w.X.bundles.row(4)) || 'nodes ' + short(w.nodes()) + ', read from the first node: ' + short(here);
}, test.limit.quick);
