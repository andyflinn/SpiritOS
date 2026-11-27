'use strict';

// spirit/run/spirit/config/test/data.js
// The tests of spirit/config/data.js, and of no other module (spec: ./data.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// What a client knows of the config family (goal/G41.28): nothing, the family having no verb yet (goal/G30.20).
// It runs as it does: in a window of its own beside the real spirit.client (spirit/client/script.js), which it writes into, the
// stream's events handed in as spirit.client hands them (takeJob, takeRename), each from the node that served it. In node
// it is loaded as every client loads it, by requiring its branch's api.js, the one script that requires it. The reads
// alone are read, never a branch.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/config/data.js';
const FILE = path.join(RUN, SUBJECT);
const SPIRIT_DATA = path.join(RUN, 'spirit', 'client', 'script.js');

const same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };
// Two nodes' public keys, base64 with a + and a / in them, as a node's key is.
const SENDER = 'Ab+c/DeF0123456789abcdefghijklmnopqrstuvwxy=';
const OTHER = 'Zy+x/WvU9876543210zyxwvutsrqponmlkjihgfedcb=';

// The store at its place since goal/G49.23, spirit.client (no spirit.required).
// A window of its own: the real spirit.client, then the file, as a page loads them. Each translator the file adds is kept,
// so an event spirit.client hands no suite (a job gone) can be handed as spirit.client hands it.
function world() {
  const win = { JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Map: Map, Math: Math, Date: Date, unescape: unescape, encodeURIComponent: encodeURIComponent };
  win.window = win;
  win.spirit = {};
  vm.createContext(win);
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(win.spirit, null, { window: win, real: ['spirit/client/script.js', SUBJECT] });
  win.spirit.requireScript('spirit/client/script.js');
  const D = win.spirit.client;
  const translators = [];
  const add = D.addTranslator;
  D.addTranslator = function (t) { translators.push(t); return add(t); };
  win.spirit.requireScript(SUBJECT);
  const F = D['config'];
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
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(win.spirit, null, { window: win, real: ['spirit/client/script.js', SUBJECT] });
  win.spirit.requireScript('spirit/client/script.js');
  win.spirit.requireScript(SUBJECT);
  const D = win.spirit.client;
  const F = D['config'];
  return { D: D, X: F && F.data, job: function (job, from) { D.takeJob(job, from || SENDER); }, nodes: function () { return Object.keys((F && F.cache) || {}); } };
}

// What the tests make, each in order, read by the tests after it.
let w = null;

test.run('in node, requiring its branch\'s api.js, spirit/config/api.js, puts it at spirit.client.config.data', 0.2, async function () {
  require(path.join(RUN, 'spirit', 'script.js'));
  const S = globalThis.spirit;
  let threw = null;
  try { await Promise.resolve(S.requireScript('spirit/config/api.js')); } catch (e) { threw = e; }
  const X = S.client && S.client['config'] && S.client['config'].data;
  return (!threw && !!X && typeof X === 'object') || false;
}, test.limit.quick);
test.run('run beside spirit.client, it makes its branch there', 0.2, function () {
  try { w = world(); } catch (e) { w = null; return false; }
  return (!!w.X && typeof w.X === 'object') || false;
}, test.limit.quick);

// IT KEEPS NOTHING, AND NAMES NO BRANCH: the branch has no verb yet (kept empty for later use, goal/G30.20).
test.run('it has no reads yet', 0.2, function () {
  if (!w) return false;
  return Object.keys(w.X).length === 0 || false;
}, test.limit.quick);
test.run('it translates nothing, since it adds no translator to spirit.client', 0.2, function () {
  if (!w) return false;
  return w.translators.length === 0 || false;
}, test.limit.quick);
test.run('a job of every kind the node streams, and a rename, leave its branch\'s cache empty', 0.2, function () {
  if (!w) return false;
  w.job({ id: 'spirit.fs', data: { command: { op: 'createFile', path: 'a.txt' } } });
  w.job({ id: 'spirit.auth', data: { table: 'bundle', row: { id: 1, label: 'b' } } });
  w.job({ id: 'spirit.contact', data: { presence: { k: { present: true } } } });
  w.job({ id: 'spirit', kind: 'permanent', data: { stats: {} } });
  w.job({ id: 'j1', kind: 'transient', status: 'running', app: { rows: [1] }, data: { row: { id: 1, publicKey: 'k' } } });
  w.D.takeRename({ key: 'k', caption: 'Bob' }, SENDER);
  return w.nodes().length === 0 || false;
}, test.limit.quick);
