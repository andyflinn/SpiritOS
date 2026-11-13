'use strict';

// spirit/run/spirit/fs/test/data.js
// The tests of spirit/fs/data.js, and of no other module (spec: ./data.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// What a client knows of a node's files (goal/G41.28): the tree the spirit.fs job streams (goal/G30.18), and the icon set.
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
  const F = D['fs'];
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
  const F = D['fs'];
  return { D: D, X: F && F.data, job: function (job, from) { D.takeJob(job, from || SENDER); }, nodes: function () { return Object.keys((F && F.cache) || {}); } };
}

// What the tests make, each in order, read by the tests after it.
let w = null;
const NO_WORLD = 'no world: the file did not run beside spirit.data';

test.run('in node, found by the family\'s name (spirit.cacheManager), it stands at spirit.data.fs.data', 0.2, async function () {
  require(path.join(RUN, 'spirit', 'spirit.js'));
  const S = globalThis.spirit;
  let threw = null;
  try { await S.cacheManager('fs'); } catch (e) { threw = e; }
  const X = S.data && S.data['fs'] && S.data['fs'].data;
  return (!threw && !!X && typeof X === 'object') || 'cacheManager(\'fs\') ' + (threw ? 'refused: ' + threw.message : 'answered, and spirit.data.fs.data is ' + short(X));
}, test.limit.quick);
test.run('the world: run beside spirit.data, it makes its family there', 0.2, function () {
  try { w = world(); } catch (e) { w = null; return 'it threw as it ran: ' + e.message; }
  return (!!w.X && typeof w.X === 'object') || 'spirit.data.fs.data is ' + short(w.X);
}, test.limit.quick);

const cmd = function (c) { return { id: 'spirit.fs', data: { command: c } }; };
const W = { quiet: [] };

// goal/G30.18: a connecting page is handed the tree as create commands, then treeComplete
test.run('the world: a tree handed over, a folder and two files in it, a watcher listening', 0.2, function () {
  if (!w) return NO_WORLD;
  W.ready0 = w.X.ready();
  W.off = w.X.watch(function (p, r) { W.quiet.push([p, r ? r.kind : r]); });
  w.job(cmd({ op: 'createDirectory', path: 'media' }));
  w.job(cmd({ op: 'createFile', path: 'media/a.txt', size: 3, modified: 100, core: true }));
  w.job(cmd({ op: 'createFile', path: 'media/b.txt', size: 4, modified: 200, core: 'yes' }));
  W.before = W.quiet.slice();
  w.job({ id: 'spirit.fs', data: { treeComplete: true } });
  return true;
}, test.limit.quick);
test.run('the tree fills quietly, and its watchers hear one word at the end', 0.2, function () {
  if (!w) return NO_WORLD;
  return (W.before.length === 0 && same(W.quiet, [['', undefined]])) || 'heard before the end ' + short(W.before) + ', in all ' + short(W.quiet);
}, test.limit.quick);
test.run('ready() is true once the whole tree has come, never before', 0.2, function () {
  if (!w) return NO_WORLD;
  return (W.ready0 === false && w.X.ready() === true) || 'before ' + W.ready0 + ', after ' + w.X.ready();
}, test.limit.quick);
test.run('a folder is kept as a folder, a file as a file with its size and modified time', 0.2, function () {
  if (!w) return NO_WORLD;
  return (w.X.file('media').kind === 'folder' && same(w.X.file('media/a.txt'), { kind: 'file', size: 3, modified: 100, core: true })) || short(w.X.files());
}, test.limit.quick);
// goal/G30.21: core, the node's word that the file is core, painted yellow by its row
test.run('core is true only where the node says true', 0.2, function () {
  if (!w) return NO_WORLD;
  return (w.X.file('media/b.txt').core === false && w.X.file('media').core === false) || short(w.X.file('media/b.txt'));
}, test.limit.quick);
test.run('after the tree each change is told by its path', 0.2, function () {
  if (!w) return NO_WORLD;
  W.quiet.length = 0;
  w.job(cmd({ op: 'createFile', path: 'c.txt', size: 1, modified: 300 }));
  return same(W.quiet, [['c.txt', 'file']]) || 'heard ' + short(W.quiet);
}, test.limit.quick);
test.run('a file changed keeps its kind', 0.2, function () {
  if (!w) return NO_WORLD;
  w.job(cmd({ op: 'changeFile', path: 'media', size: 0, modified: 400 }));
  return w.X.file('media').kind === 'folder' || short(w.X.file('media'));
}, test.limit.quick);
test.run('watch(path, fn) hears that one file alone, and nothing once released', 0.2, function () {
  if (!w) return NO_WORLD;
  const heard = [];
  const off = w.X.watch('c.txt', function (r) { heard.push(r ? r.size : r); });
  w.job(cmd({ op: 'changeFile', path: 'c.txt', size: 2, modified: 500 }));
  w.job(cmd({ op: 'changeFile', path: 'media/a.txt', size: 9, modified: 500 }));
  off();
  w.job(cmd({ op: 'changeFile', path: 'c.txt', size: 3, modified: 600 }));
  return same(heard, [2]) || 'heard ' + short(heard);
}, test.limit.quick);
test.run('a file deleted goes', 0.2, function () {
  if (!w) return NO_WORLD;
  w.job(cmd({ op: 'deleteFile', path: 'c.txt' }));
  return w.X.file('c.txt') === null || short(w.X.file('c.txt'));
}, test.limit.quick);
test.run('a folder deleted goes with everything under it, and nothing beside it', 0.2, function () {
  if (!w) return NO_WORLD;
  w.job(cmd({ op: 'createFile', path: 'media2/x.txt', size: 1, modified: 1 }));
  w.job(cmd({ op: 'deleteDirectory', path: 'media' }));
  return (same(Object.keys(w.X.files()), ['media2/x.txt'])) || short(Object.keys(w.X.files()));
}, test.limit.quick);
test.run('a command without a path, or a job of another id, keeps nothing', 0.2, function () {
  if (!w) return NO_WORLD;
  w.job(cmd({ op: 'createFile' }));
  w.job({ id: 'spirit.job', data: { command: { op: 'createFile', path: 'y.txt' } } });
  return (same(Object.keys(w.X.files()), ['media2/x.txt']) && w.X.file('') === null) || short(Object.keys(w.X.files()));
}, test.limit.quick);
test.run('branch is the tree\'s whole path, under the node that served it', 0.2, function () {
  if (!w) return NO_WORLD;
  const pre = w.D.nodeId(SENDER) + '/fs/';
  return (typeof w.X.branch === 'string' && w.X.branch.indexOf(pre) === 0 && w.X.branch.length > pre.length) || short(w.X.branch);
}, test.limit.quick);
test.run('on a page, a tree another node served is filed under that node, never among the page\'s own node\'s files', 0.2, function () {
  let p; try { p = pageWorld(); } catch (e) { return 'no page world: ' + e.message; }
  p.job(cmd({ op: 'createFile', path: 'mine.txt', size: 1, modified: 1 }));
  p.job(cmd({ op: 'createFile', path: 'theirs.txt', size: 1, modified: 1 }), OTHER);
  return (same(p.nodes().sort(), [p.D.nodeId(SENDER), p.D.nodeId(OTHER)].sort()) && p.X.file('theirs.txt') === null && !!p.X.file('mine.txt')) || 'nodes ' + short(p.nodes()) + ', read on the page: ' + short(Object.keys(p.X.files()));
}, test.limit.quick);
test.run('in a process, a tree from another node is filed under that node, never among the first node\'s files', 0.2, function () {
  if (!w) return NO_WORLD;
  w.job(cmd({ op: 'createFile', path: 'theirs.txt', size: 1, modified: 1 }), OTHER);
  const there = w.X.file('theirs.txt');
  w.job(cmd({ op: 'deleteFile', path: 'none.txt' }));
  return (same(w.nodes().sort(), [w.D.nodeId(SENDER), w.D.nodeId(OTHER)].sort()) && !!there && w.X.file('theirs.txt') === null) || 'nodes ' + short(w.nodes()) + ', read from the first node: ' + short(w.X.file('theirs.txt'));
}, test.limit.quick);

// the icon set (goal/G41.28): a set read again replaces it whole
test.run('icons.keep keeps each glyph with its keywords', 0.2, function () {
  if (!w) return NO_WORLD;
  w.X.icons.keep({ star: ['favourite', 'own'], bin: 'not a list' });
  return (same(w.X.icons.row('star'), { glyph: 'star', keywords: ['favourite', 'own'] }) && same(w.X.icons.row('bin'), { glyph: 'bin', keywords: [] })) || short([w.X.icons.row('star'), w.X.icons.row('bin')]);
}, test.limit.quick);
test.run('a set kept again replaces it whole', 0.2, function () {
  if (!w) return NO_WORLD;
  const heard = [];
  const off = w.X.icons.watch('bin', function (r) { heard.push(r); });
  w.X.icons.keep({ star: ['sky'] });
  off();
  return (w.X.icons.row('bin') === null && same(w.X.icons.row('star').keywords, ['sky']) && same(heard, [undefined])) || 'bin ' + short(w.X.icons.row('bin')) + ', heard ' + short(heard);
}, test.limit.quick);
test.run('icons.branch is the set\'s whole path, apart from the tree\'s', 0.2, function () {
  if (!w) return NO_WORLD;
  return (typeof w.X.icons.branch === 'string' && w.X.icons.branch.indexOf('/fs/') !== -1 && w.X.icons.branch !== w.X.branch && w.X.icons.row('') === null) || short(w.X.icons.branch);
}, test.limit.quick);
