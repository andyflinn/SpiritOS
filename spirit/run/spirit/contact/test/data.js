'use strict';

// spirit/run/spirit/contact/test/data.js
// The tests of spirit/contact/data.js, and of no other module (spec: ./data.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// What a client knows of a node's contacts, people and relays in one table (goal/G41.28, goal/G40.11), from the node's job spirit.contact (goal/G43.20).
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
  const F = D['contact'];
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
  const F = D['contact'];
  return { D: D, X: F && F.data, job: function (job, from) { D.takeJob(job, from || SENDER); }, nodes: function () { return Object.keys((F && F.cache) || {}); } };
}

// What the tests make, each in order, read by the tests after it.
let w = null;
const NO_WORLD = 'no world: the file did not run beside spirit.data';

test.run('in node, found by the family\'s name (spirit.cacheManager), it stands at spirit.data.contact.data', 0.2, async function () {
  require(path.join(RUN, 'spirit', 'spirit.js'));
  const S = globalThis.spirit;
  let threw = null;
  try { await S.cacheManager('contact'); } catch (e) { threw = e; }
  const X = S.data && S.data['contact'] && S.data['contact'].data;
  return (!threw && !!X && typeof X === 'object') || 'cacheManager(\'contact\') ' + (threw ? 'refused: ' + threw.message : 'answered, and spirit.data.contact.data is ' + short(X));
}, test.limit.quick);
test.run('the world: run beside spirit.data, it makes its family there', 0.2, function () {
  try { w = world(); } catch (e) { w = null; return 'it threw as it ran: ' + e.message; }
  return (!!w.X && typeof w.X === 'object') || 'spirit.data.contact.data is ' + short(w.X);
}, test.limit.quick);

const k = function (n) { return 'MCowBQYDK2VwAyEA' + ('contactDataTest' + n).padEnd(43, 'A') + '='; };
const K1 = k(1), K2 = k(2), K3 = k(3), K4 = k(4);
const presence = function (table) { return { id: 'spirit.contact', data: { presence: table } }; };

test.run('the presence table sets each key\'s present', 0.2, function () {
  if (!w) return NO_WORLD;
  const t = {}; t[K1] = { present: true }; t[K2] = { present: false };
  w.job(presence(t));
  return (w.X.contact(K1).present === true && w.X.contact(K2).present === false) || short(w.X.contacts());
}, test.limit.quick);
test.run('a key the presence table drops goes back to not known', 0.2, function () {
  if (!w) return NO_WORLD;
  const t = {}; t[K2] = { present: true };
  w.job(presence(t));
  const r = w.X.contact(K1);
  return (!!r && r.present === undefined && w.X.contact(K2).present === true) || 'K1 ' + short(r);
}, test.limit.quick);
test.run('a search hit the network found is seated as a row', 0.2, function () {
  if (!w) return NO_WORLD;
  w.job({ id: 'spirit.contact', data: { item: { key: K3, label: JSON.stringify({ name: 'Carol', relay: true }) } } });
  const r = w.X.contact(K3);
  return (!!r && r.name === 'Carol' && r.relay === true) || short(r);
}, test.limit.quick);
// goal/G40.11: the one table, people and relays, each row as it changed, by its public key
test.run('a row of the one table is merged in by its public key', 0.2, function () {
  if (!w) return NO_WORLD;
  w.job({ id: 'spirit.contact', data: { row: { publicKey: K3, keep: true } } });
  const r = w.X.contact(K3);
  return (!!r && r.keep === true && r.name === 'Carol' && r.publicKey === K3) || short(r);
}, test.limit.quick);
test.run('a row gone is let go', 0.2, function () {
  if (!w) return NO_WORLD;
  w.job({ id: 'spirit.contact', data: { row: { publicKey: K4, keep: true } } });
  const had = !!w.X.contact(K4);
  w.job({ id: 'spirit.contact', data: { row: { publicKey: K4, gone: true } } });
  return (had && w.X.contact(K4) === null) || 'had ' + had + ', now ' + short(w.X.contact(K4));
}, test.limit.quick);
test.run('a contact renamed takes the caption as its name', 0.2, function () {
  if (!w) return NO_WORLD;
  w.D.takeRename({ key: K1, caption: 'Bobby' }, SENDER);
  return (w.X.contact(K1) || {}).name === 'Bobby' || short(w.X.contact(K1));
}, test.limit.quick);
test.run('a job of another id keeps nothing', 0.2, function () {
  if (!w) return NO_WORLD;
  w.job({ id: 'spirit.fs', data: { row: { publicKey: K4, keep: true } } });
  return w.X.contact(K4) === null || short(w.X.contact(K4));
}, test.limit.quick);
test.run('contacts() answers every contact kept, contact() of no key null', 0.2, function () {
  if (!w) return NO_WORLD;
  return (same(Object.keys(w.X.contacts()).sort(), [K1, K2, K3].sort()) && w.X.contact('') === null) || short(Object.keys(w.X.contacts()));
}, test.limit.quick);
test.run('watch(fn) hears each change by the contact\'s key, undefined once gone, and nothing once released', 0.2, function () {
  if (!w) return NO_WORLD;
  const heard = [];
  const off = w.X.watch(function (key, r) { heard.push([key, r ? r.myLabel : r]); });
  w.job({ id: 'spirit.contact', data: { row: { publicKey: K2, myLabel: 'Dee' } } });
  w.job({ id: 'spirit.contact', data: { row: { publicKey: K2, gone: true } } });
  off();
  w.job({ id: 'spirit.contact', data: { row: { publicKey: K4, keep: true } } });
  return same(heard, [[K2, 'Dee'], [K2, undefined]]) || 'heard ' + short(heard);
}, test.limit.quick);
test.run('branch is the contacts\' whole path, under the node that served them', 0.2, function () {
  if (!w) return NO_WORLD;
  const pre = w.D.nodeId(SENDER) + '/contact/';
  return (typeof w.X.branch === 'string' && w.X.branch.indexOf(pre) === 0 && w.X.branch.length > pre.length) || short(w.X.branch);
}, test.limit.quick);
test.run('on a page, a row another node served is filed under that node, never among the page\'s own node\'s contacts', 0.2, function () {
  let p; try { p = pageWorld(); } catch (e) { return 'no page world: ' + e.message; }
  p.job({ id: 'spirit.contact', data: { row: { publicKey: K1, keep: true } } });
  p.job({ id: 'spirit.contact', data: { row: { publicKey: K2, keep: true } } }, OTHER);
  return (same(p.nodes().sort(), [p.D.nodeId(SENDER), p.D.nodeId(OTHER)].sort()) && p.X.contact(K2) === null && !!p.X.contact(K1)) || 'nodes ' + short(p.nodes()) + ', read on the page: ' + short(Object.keys(p.X.contacts()));
}, test.limit.quick);
test.run('in a process, a row from another node is filed under that node, never among the first node\'s contacts', 0.2, function () {
  if (!w) return NO_WORLD;
  const K5 = k(5);
  w.job({ id: 'spirit.contact', data: { row: { publicKey: K5, keep: true } } }, OTHER);
  const there = w.X.contact(K5);
  w.D.takeRename({ key: K1, caption: 'Bobby' }, SENDER);
  return (same(w.nodes().sort(), [w.D.nodeId(SENDER), w.D.nodeId(OTHER)].sort()) && !!there && w.X.contact(K5) === null) || 'nodes ' + short(w.nodes()) + ', read from the first node: ' + short(w.X.contact(K5));
}, test.limit.quick);
