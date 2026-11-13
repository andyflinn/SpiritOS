'use strict';

// spirit/run/spirit/relay/test/data.js
// The tests of spirit/relay/data.js, and of no other module (spec: ./data.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// What a client knows of its node's relays (goal/G41.28): what relay.get answered, kept by spirit.relay.status.
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
  const F = D['relay'];
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
  const F = D['relay'];
  return { D: D, X: F && F.data, job: function (job, from) { D.takeJob(job, from || SENDER); }, nodes: function () { return Object.keys((F && F.cache) || {}); } };
}

// What the tests make, each in order, read by the tests after it.
let w = null;
const NO_WORLD = 'no world: the file did not run beside spirit.data';

test.run('in node, found by the family\'s name (spirit.cacheManager), it stands at spirit.data.relay.data', 0.2, async function () {
  require(path.join(RUN, 'spirit', 'spirit.js'));
  const S = globalThis.spirit;
  let threw = null;
  try { await S.cacheManager('relay'); } catch (e) { threw = e; }
  const X = S.data && S.data['relay'] && S.data['relay'].data;
  return (!threw && !!X && typeof X === 'object') || 'cacheManager(\'relay\') ' + (threw ? 'refused: ' + threw.message : 'answered, and spirit.data.relay.data is ' + short(X));
}, test.limit.quick);
test.run('the world: run beside spirit.data, it makes its family there', 0.2, function () {
  try { w = world(); } catch (e) { w = null; return 'it threw as it ran: ' + e.message; }
  return (!!w.X && typeof w.X === 'object') || 'spirit.data.relay.data is ' + short(w.X);
}, test.limit.quick);


// A process knows its node by the rows it took; here, as a page knows it from node.card, it is told.
test.run('the world: its home node is known', 0.2, function () {
  if (!w) return NO_WORLD;
  return w.D.homeNode(SENDER) === w.D.nodeId(SENDER) || 'homeNode ' + short(w.D.homeNode());
}, test.limit.quick);
const A = 'https://a.relay.example';
const B = 'https://b.relay.example';

test.run('it translates nothing: the node publishes no relay.get answer', 0.2, function () {
  if (!w) return NO_WORLD;
  return w.translators.length === 0 || w.translators.length + ' translators added';
}, test.limit.quick);
test.run('keep keeps a relay.get answer by its key: its relay and its report', 0.2, function () {
  if (!w) return NO_WORLD;
  w.X.keep({ ok: true, key: A, relay: { url: A, owned: true }, report: { up: true } });
  return (same(w.X.relay(A), { url: A, owned: true }) && same(w.X.report(A), { up: true })) || short([w.X.relay(A), w.X.report(A)]);
}, test.limit.quick);
test.run('an answer that carried no report keeps none', 0.2, function () {
  if (!w) return NO_WORLD;
  w.X.keep({ ok: true, key: B, relay: { url: B } });
  return (same(w.X.relay(B), { url: B }) && w.X.report(B) === null) || short(w.X.report(B));
}, test.limit.quick);
test.run('a refusal, or an answer with no key or no relay, keeps nothing', 0.2, function () {
  if (!w) return NO_WORLD;
  const C = 'https://c.relay.example';
  w.X.keep({ ok: false, key: C, relay: { url: C } });
  w.X.keep({ ok: true, key: C });
  w.X.keep({ ok: true, relay: { url: C } });
  w.X.keep(null);
  return (w.X.relay(C) === null && w.X.report(C) === null) || short(w.X.relay(C));
}, test.limit.quick);
test.run('relay() and report() of no key answer null', 0.2, function () {
  if (!w) return NO_WORLD;
  return (w.X.relay('') === null && w.X.report(undefined) === null) || short(w.X.relay(''));
}, test.limit.quick);
test.run('a relay got again replaces what was kept', 0.2, function () {
  if (!w) return NO_WORLD;
  w.X.keep({ ok: true, key: A, relay: { url: A, owned: false } });
  return (same(w.X.relay(A), { url: A, owned: false }) && w.X.report(A) === null) || short([w.X.relay(A), w.X.report(A)]);
}, test.limit.quick);
test.run('watch(fn) hears the relay\'s key and what was kept, and nothing once released', 0.2, function () {
  if (!w) return NO_WORLD;
  const heard = [];
  const off = w.X.watch(function (key, kept) { heard.push([key, kept && kept.relay && kept.relay.url]); });
  w.X.keep({ ok: true, key: B, relay: { url: B, claimed: true } });
  off();
  w.X.keep({ ok: true, key: A, relay: { url: A } });
  return same(heard, [[B, B]]) || 'heard ' + short(heard);
}, test.limit.quick);
test.run('branch is the rows\' whole path, in the relay family', 0.2, function () {
  if (!w) return NO_WORLD;
  return (typeof w.X.branch === 'string' && w.X.branch.indexOf('/relay/') !== -1) || short(w.X.branch);
}, test.limit.quick);
