'use strict';

// spirit/run/spirit/auth/test/data.js
// The tests of spirit/auth/data.js, and of no other module (spec: ./data.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// What a client knows of a node's bundles, branches and grants (goal/G41.28), from the node's job spirit.auth (goal/G43.20).
// It runs as it does: in a window of its own beside the real spirit.required.spirit.data (spirit/data/script.js), which it writes into, the
// stream's events handed in as spirit.required.spirit.data hands them (takeJob, takeRename), each from the node that served it. In node
// it comes with its branch's interface, spirit/auth/api.js, the one script that requires it. The reads alone are read,
// never a branch.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/auth/data.js';
const FILE = path.join(RUN, SUBJECT);
const SPIRIT_DATA = path.join(RUN, 'spirit', 'data', 'script.js');

const same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };
// Two nodes' public keys, base64 with a + and a / in them, as a node's key is.
const SENDER = 'Ab+c/DeF0123456789abcdefghijklmnopqrstuvwxy=';
const OTHER = 'Zy+x/WvU9876543210zyxwvutsrqponmlkjihgfedcb=';

// A window of its own: the real spirit.required.spirit.data, then the file, as a page loads them. Each translator the file adds is kept,
// so an event spirit.required.spirit.data hands no suite (a job gone) can be handed as spirit.required.spirit.data hands it.
function world() {
  const win = { JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Map: Map, Math: Math, Date: Date, unescape: unescape, encodeURIComponent: encodeURIComponent };
  win.window = win;
  win.spirit = {};
  vm.createContext(win);
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(win.spirit, null, { window: win, real: ['spirit/data/script.js', SUBJECT] });
  win.spirit.requireScript('spirit/data/script.js');
  const D = win.spirit.required.spirit.data;
  const translators = [];
  const add = D.addTranslator;
  D.addTranslator = function (t) { translators.push(t); return add(t); };
  win.spirit.requireScript(SUBJECT);
  const F = D['auth'];
  return { win: win, D: D, F: F, X: F && F.data, translators: translators,
    job: function (job, from) { D.takeJob(job, from || SENDER); },
    nodes: function () { return Object.keys((F && F.cache) || {}); } };
}

// The same on a page: spirit.isBrowser() true and the page's node known (spirit.nodeFacts.key, as node.card answered it), so
// a row another node served is filed under the node that served it while the reads stay the page's own node's.
function pageWorld() {
  const win = { JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Map: Map, Math: Math, Date: Date, unescape: unescape, encodeURIComponent: encodeURIComponent };
  win.window = win;
  win.spirit = { isBrowser: function () { return true; }, nodeFacts: { key: SENDER } };
  vm.createContext(win);
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(win.spirit, null, { window: win, real: ['spirit/data/script.js', SUBJECT] });
  win.spirit.requireScript('spirit/data/script.js');
  win.spirit.requireScript(SUBJECT);
  const D = win.spirit.required.spirit.data;
  const F = D['auth'];
  return { D: D, X: F && F.data, job: function (job, from) { D.takeJob(job, from || SENDER); }, nodes: function () { return Object.keys((F && F.cache) || {}); } };
}

// What the tests make, each in order, read by the tests after it.
let w = null;

test.run('in node, requiring the interface spirit/auth/api.js brings the auth data, and it stands at spirit.required.spirit.data.auth.data', 0.2, async function () {
  require(path.join(RUN, 'spirit', 'script.js'));
  const S = globalThis.spirit;
  let threw = null;
  try { await Promise.resolve(S.requireScript('spirit/auth/api.js')); } catch (e) { threw = e; }
  const X = S.required.spirit.data && S.required.spirit.data['auth'] && S.required.spirit.data['auth'].data;
  return (!threw && !!X && typeof X === 'object') || false;
}, test.limit.quick);
test.run('run beside spirit.required.spirit.data, the auth data makes its branch there', 0.2, function () {
  try { w = world(); } catch (e) { w = null; return false; }
  return (!!w.X && typeof w.X === 'object') || false;
}, test.limit.quick);

const K = 'MCowBQYDK2VwAyEA' + 'authDataTest'.padEnd(43, 'A') + '=';
const row = function (table, r, gone) { return { id: 'spirit.auth', data: gone ? { table: table, row: r, gone: true } : { table: table, row: r } }; };

// a row of each of the three tables, kept by its id
test.run('a bundle row is kept by its id, with its owner as the node said it', 0.2, function () {
  if (!w) return false;
  w.job(row('bundle', { id: '4', label: 'friends', owner: 'node', extra: 1 }));
  return same(w.X.bundles.row(4), { id: 4, label: 'friends', owner: 'node' }) || false;
}, test.limit.quick);
// goal/G41.25: "The owner as the node said it (it always says one); a row that names none keeps none."
test.run('a bundle row that names no owner keeps none', 0.2, function () {
  if (!w) return false;
  w.job(row('bundle', { id: 5, label: 'work' }));
  const r = w.X.bundles.row(5);
  return (!!r && !('owner' in r) && r.label === 'work') || false;
}, test.limit.quick);
test.run('a branch row is kept by its id, with its bundle, branch and verb', 0.2, function () {
  if (!w) return false;
  w.job(row('branch', { id: '7', bundle: '4', family: 'fs', verb: 'load', extra: 1 }));
  return same(w.X.branches.row(7), { id: 7, bundle: 4, family: 'fs', verb: 'load' }) || false;
}, test.limit.quick);
test.run('a grant row is kept whole, by its key and its path', 0.2, function () {
  if (!w) return false;
  const g = { key: K, path: 'spirit/fs', label: 'Bob' };
  w.job(row('grant', g));
  return (w.X.grantKey(K, 'spirit/fs') === K + '\n' + 'spirit/fs' && same(w.X.grants.row(w.X.grantKey(K, 'spirit/fs')), g)) || false;
}, test.limit.quick);
test.run('rows answers every kept row of its table', 0.2, function () {
  if (!w) return false;
  return (same(Object.keys(w.X.bundles.rows()).sort(), ['4', '5']) && same(Object.keys(w.X.branches.rows()), ['7']) && Object.keys(w.X.grants.rows()).length === 1) || false;
}, test.limit.quick);
test.run('a row with no id, or a job of another id, keeps nothing', 0.2, function () {
  if (!w) return false;
  w.job(row('bundle', { label: 'no id' }));
  w.job({ id: 'spirit.fs', data: { table: 'bundle', row: { id: 99, label: 'x' } } });
  w.job(row('grant', { key: K }));
  return (Object.keys(w.X.bundles.rows()).length === 2 && w.X.bundles.row(99) === null && Object.keys(w.X.grants.rows()).length === 1) || false;
}, test.limit.quick);
test.run('row of no id answers null', 0.2, function () {
  if (!w) return false;
  return (w.X.bundles.row('') === null && w.X.branches.row(null) === null && w.X.grants.row(undefined) === null && w.X.bundles.row(42) === null) || false;
}, test.limit.quick);
test.run('a function handed to watch hears each change by the row\'s id, and nothing once released', 0.2, function () {
  if (!w) return false;
  const heard = [];
  const off = w.X.bundles.watch(function (id, r) { heard.push([id, r && r.label]); });
  w.job(row('bundle', { id: 6, label: 'six' }));
  off();
  w.job(row('bundle', { id: 9, label: 'nine' }));
  return same(heard, [['6', 'six']]) || false;
}, test.limit.quick);
test.run('a row gone is let go, in each table', 0.2, function () {
  if (!w) return false;
  const heard = [];
  const off = w.X.branches.watch(function (id, r) { heard.push([id, r]); });
  w.job(row('bundle', { id: 6 }, true));
  w.job(row('branch', { id: 7 }, true));
  w.job(row('grant', { key: K, path: 'spirit/fs' }, true));
  off();
  return (w.X.bundles.row(6) === null && w.X.branches.row(7) === null && w.X.grants.row(w.X.grantKey(K, 'spirit/fs')) === null && same(heard, [['7', undefined]])) || false;
}, test.limit.quick);
test.run('branch is the table\'s whole path, under the node that served its rows', 0.2, function () {
  if (!w) return false;
  const pre = w.D.nodeId(SENDER) + '/auth/';
  return [w.X.bundles.branch, w.X.branches.branch, w.X.grants.branch].every(function (b) { return typeof b === 'string' && b.indexOf(pre) === 0 && b.length > pre.length; }) || false;
}, test.limit.quick);
// goal/G41.28: under the node that served the rows
test.run('on a page, a row another node served is filed under that node, never among the page\'s own node\'s rows', 0.2, function () {
  let p; try { p = pageWorld(); } catch (e) { return false; }
  p.job(row('bundle', { id: 4, label: 'mine' }));
  p.job(row('bundle', { id: 8, label: 'theirs' }), OTHER);
  return (same(p.nodes().sort(), [p.D.nodeId(SENDER), p.D.nodeId(OTHER)].sort()) && p.X.bundles.row(8) === null && (p.X.bundles.row(4) || {}).label === 'mine') || false;
}, test.limit.quick);
test.run('in a process, a row from another node is filed under that node, never among the first node\'s rows', 0.2, function () {
  if (!w) return false;
  w.job(row('bundle', { id: 8, label: 'theirs' }), OTHER);
  const there = w.X.bundles.row(8);
  w.job(row('bundle', { id: 1000 }, true));
  const here = w.X.bundles.row(8);
  return (same(w.nodes().sort(), [w.D.nodeId(SENDER), w.D.nodeId(OTHER)].sort()) && !!there && there.label === 'theirs' && here === null && !!w.X.bundles.row(4)) || false;
}, test.limit.quick);

// EVERY GRANT ITS OWN ROW, A KEY WITH A SLASH TOO (goal/G47.4; Andy: "i want to see every single fucking grant row that
// matches the fucking search, and not only one of many for a fucking family when the fucking verbs were fucking granted
// separetely."). Found by cw on his node: a contact's key is base64, which holds slashes, and claude-ubuntu's 69 desk
// grants showed as one row. Here a key with a slash in it holds three grants, of one branch and of another.
const SLASH_KEY = 'MCowBQYDK2VwAyEA/slash+key/0123456789abcdefghijklmnopq=';
let sw = null;
test.run('a key with a slash in it, holding three grants, keeps three grant rows', 0.2, function () {
  sw = world();
  if (!sw.X) return false;
  ['desk.chat', 'desk.item', 'jobs.list'].forEach(function (p) { sw.job(row('grant', { key: SLASH_KEY, path: p, label: 'Ubu' })); });
  return Object.keys(sw.X.grants.rows()).length === 3 || false;
}, test.limit.quick);
test.run('each of them is read whole by its grant key', 0.2, function () {
  if (!sw || !sw.X) return false;
  return ['desk.chat', 'desk.item', 'jobs.list'].every(function (p) { return same(sw.X.grants.row(sw.X.grantKey(SLASH_KEY, p)), { key: SLASH_KEY, path: p, label: 'Ubu' }); }) || false;
}, test.limit.quick);
test.run('one of them gone, the other two stay', 0.2, function () {
  if (!sw || !sw.X) return false;
  sw.job(row('grant', { key: SLASH_KEY, path: 'desk.chat' }, true));
  return (Object.keys(sw.X.grants.rows()).length === 2 && sw.X.grants.row(sw.X.grantKey(SLASH_KEY, 'desk.chat')) === null && !!sw.X.grants.row(sw.X.grantKey(SLASH_KEY, 'jobs.list'))) || false;
}, test.limit.quick);
