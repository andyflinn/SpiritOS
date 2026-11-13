'use strict';

// spirit/run/spirit/node/test/data.js
// The tests of spirit/node/data.js, and of no other module (spec: ./data.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// What a client knows of a node itself (goal/G41.28): its api tree and verbs as the selectors read them (Andy, Q7: "yes."), and its card.
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
  const F = D['node'];
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
  const F = D['node'];
  return { D: D, X: F && F.data, job: function (job, from) { D.takeJob(job, from || SENDER); }, nodes: function () { return Object.keys((F && F.cache) || {}); } };
}

// What the tests make, each in order, read by the tests after it.
let w = null;
const NO_WORLD = 'no world: the file did not run beside spirit.data';

test.run('in node, found by the family\'s name (spirit.cacheManager), it stands at spirit.data.node.data', 0.2, async function () {
  require(path.join(RUN, 'spirit', 'spirit.js'));
  const S = globalThis.spirit;
  let threw = null;
  try { await S.cacheManager('node'); } catch (e) { threw = e; }
  const X = S.data && S.data['node'] && S.data['node'].data;
  return (!threw && !!X && typeof X === 'object') || 'cacheManager(\'node\') ' + (threw ? 'refused: ' + threw.message : 'answered, and spirit.data.node.data is ' + short(X));
}, test.limit.quick);
test.run('the world: run beside spirit.data, it makes its family there', 0.2, function () {
  try { w = world(); } catch (e) { w = null; return 'it threw as it ran: ' + e.message; }
  return (!!w.X && typeof w.X === 'object') || 'spirit.data.node.data is ' + short(w.X);
}, test.limit.quick);


// A process knows its node by the rows it took; here, as a page knows it from node.card, it is told.
test.run('the world: its home node is known', 0.2, function () {
  if (!w) return NO_WORLD;
  return w.D.homeNode(SENDER) === w.D.nodeId(SENDER) || 'homeNode ' + short(w.D.homeNode());
}, test.limit.quick);
// A planted apiTreeIndex: servers(tree) and verbs(tree, name), read off the tree it is handed.
const INDEX = { servers: function (t) { return Object.keys(t.families || {}); }, verbs: function (t, n) { return t.families[n] || []; } };
const TREE = { families: { fs: ['load', 'save'], node: ['card'] } };

test.run('card.keep keeps node.card\'s answer: its name and description', 0.2, function () {
  if (!w) return NO_WORLD;
  w.X.card.keep({ ok: true, name: 'Andy', description: 'his box', publicKey: 'k', descriptionMax: 140 });
  return same(w.X.card.get(), { name: 'Andy', description: 'his box' }) || short(w.X.card.get());
}, test.limit.quick);
test.run('a field a save stored is merged into the card', 0.2, function () {
  if (!w) return NO_WORLD;
  w.X.card.keep({ description: 'his new box' });
  return same(w.X.card.get(), { name: 'Andy', description: 'his new box' }) || short(w.X.card.get());
}, test.limit.quick);
test.run('an answer that is not ok, or no object, keeps nothing', 0.2, function () {
  if (!w) return NO_WORLD;
  w.X.card.keep({ ok: false, name: 'Refused' });
  w.X.card.keep('Andy');
  w.X.card.keep(null);
  return same(w.X.card.get(), { name: 'Andy', description: 'his new box' }) || short(w.X.card.get());
}, test.limit.quick);
test.run('card.watch(fn) hears the card on every change, and nothing once released', 0.2, function () {
  if (!w) return NO_WORLD;
  const heard = [];
  const off = w.X.card.watch(function (c) { heard.push(c && c.name); });
  w.X.card.keep({ name: 'Andrew' });
  off();
  w.X.card.keep({ name: 'Drew' });
  return same(heard, ['Andrew']) || 'heard ' + short(heard);
}, test.limit.quick);
test.run('a name saved alone keeps the description', 0.2, function () {
  if (!w) return NO_WORLD;
  return same(w.X.card.get(), { name: 'Drew', description: 'his new box' }) || short(w.X.card.get());
}, test.limit.quick);
test.run('keepTree keeps each family the index reads, and each of its verbs as family.verb', 0.2, function () {
  if (!w) return NO_WORLD;
  w.X.keepTree(TREE, INDEX);
  return (same(Object.keys(w.X.families()).sort(), ['fs', 'node']) && same(w.X.families().fs, { name: 'fs' }) && same(Object.keys(w.X.verbs()).sort(), ['fs.load', 'fs.save', 'node.card']) && same(w.X.verbs()['fs.load'], { family: 'fs', name: 'load' })) || short([w.X.families(), w.X.verbs()]);
}, test.limit.quick);
test.run('the tree read again replaces both branches whole', 0.2, function () {
  if (!w) return NO_WORLD;
  w.X.keepTree({ families: { fs: ['load'] } }, INDEX);
  return (same(Object.keys(w.X.families()), ['fs']) && same(Object.keys(w.X.verbs()), ['fs.load'])) || short([Object.keys(w.X.families()), Object.keys(w.X.verbs())]);
}, test.limit.quick);
test.run('with no index it keeps nothing', 0.2, function () {
  if (!w) return NO_WORLD;
  w.X.keepTree(TREE);
  return same(Object.keys(w.X.verbs()), ['fs.load']) || short(Object.keys(w.X.verbs()));
}, test.limit.quick);
test.run('no tree is a tree with no families', 0.2, function () {
  if (!w) return NO_WORLD;
  w.X.keepTree(null, INDEX);
  return (Object.keys(w.X.families()).length === 0 && Object.keys(w.X.verbs()).length === 0) || short(w.X.families());
}, test.limit.quick);
test.run('treeBranch and verbsBranch are the two branches\' whole paths', 0.2, function () {
  if (!w) return NO_WORLD;
  const t = w.X.treeBranch, v = w.X.verbsBranch;
  return (typeof t === 'string' && typeof v === 'string' && t !== v && t.indexOf('/node/') !== -1 && v.indexOf('/node/') !== -1) || short([t, v]);
}, test.limit.quick);
