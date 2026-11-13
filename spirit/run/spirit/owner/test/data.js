'use strict';

// spirit/run/spirit/owner/test/data.js
// The tests of spirit/owner/data.js, and of no other module (spec: ./data.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// What a client knows of the owner family (goal/G41.28): nothing yet, no page reading his boxes.
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
  const F = D['owner'];
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
  const F = D['owner'];
  return { D: D, X: F && F.data, job: function (job, from) { D.takeJob(job, from || SENDER); }, nodes: function () { return Object.keys((F && F.cache) || {}); } };
}

// What the tests make, each in order, read by the tests after it.
let w = null;
const NO_WORLD = 'no world: the file did not run beside spirit.data';

test.run('in node, found by the family\'s name (spirit.cacheManager), it stands at spirit.data.owner.data', 0.2, async function () {
  require(path.join(RUN, 'spirit', 'spirit.js'));
  const S = globalThis.spirit;
  let threw = null;
  try { await S.cacheManager('owner'); } catch (e) { threw = e; }
  const X = S.data && S.data['owner'] && S.data['owner'].data;
  return (!threw && !!X && typeof X === 'object') || 'cacheManager(\'owner\') ' + (threw ? 'refused: ' + threw.message : 'answered, and spirit.data.owner.data is ' + short(X));
}, test.limit.quick);
test.run('the world: run beside spirit.data, it makes its family there', 0.2, function () {
  try { w = world(); } catch (e) { w = null; return 'it threw as it ran: ' + e.message; }
  return (!!w.X && typeof w.X === 'object') || 'spirit.data.owner.data is ' + short(w.X);
}, test.limit.quick);

// IT KEEPS NOTHING YET: no client reads the owner's boxes or sends his commands from a page.
test.run('it has no reads yet', 0.2, function () {
  if (!w) return NO_WORLD;
  return Object.keys(w.X).length === 0 || 'reads ' + short(Object.keys(w.X));
}, test.limit.quick);
test.run('it translates nothing: it adds no translator to spirit.data', 0.2, function () {
  if (!w) return NO_WORLD;
  return w.translators.length === 0 || w.translators.length + ' translators added';
}, test.limit.quick);
test.run('a job of every kind the node streams, and a rename, leave its family\'s cache empty', 0.2, function () {
  if (!w) return NO_WORLD;
  w.job({ id: 'spirit.fs', data: { command: { op: 'createFile', path: 'a.txt' } } });
  w.job({ id: 'spirit.auth', data: { table: 'bundle', row: { id: 1, label: 'b' } } });
  w.job({ id: 'spirit.contact', data: { presence: { k: { present: true } } } });
  w.job({ id: 'spirit', kind: 'permanent', data: { stats: {} } });
  w.job({ id: 'j1', kind: 'transient', status: 'running', app: { rows: [1] }, data: { row: { id: 1, publicKey: 'k' } } });
  w.D.takeRename({ key: 'k', caption: 'Bob' }, SENDER);
  return w.nodes().length === 0 || 'kept under ' + short(w.nodes());
}, test.limit.quick);
