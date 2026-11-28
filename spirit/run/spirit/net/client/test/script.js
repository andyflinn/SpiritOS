'use strict';

// spirit/run/spirit/net/client/test/script.js
// The tests of spirit/net/client/script.js, and of no other module (spec: ./data.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// What a client knows of the net family (goal/G41.28): nothing, net.fetch answering one fetch, not a row read again.
// It runs as it does: in a window of its own beside the real spirit.client (spirit/client/script.js), which it writes into, the
// stream's events handed in as spirit.client hands them (takeJob, takeRename), each from the node that served it. In node
// it comes with its branch's interface, spirit/net/script.js, the one script that requires it. The reads alone are read,
// never a branch.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/net/client/script.js';
const FILE = path.join(RUN, SUBJECT);
const SPIRIT_DATA = path.join(RUN, 'spirit', 'client', 'script.js');

const same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };
// The nodes a family keeps rows for (goal/G49.23: the store hands no family, and so no cache, out by name): read off every
// branch it holds, <node>/<family>/<branch>.
const nodesOf = function (D, fam) { const out = []; D.allBranches().forEach(function (p) { const s = p.split('/'); if (s[1] === fam && out.indexOf(s[0]) < 0) out.push(s[0]); }); return out; };
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
  // goal/G49.23: the store hands no family out by name; the reads stand at the branch's path, spirit.net.client, and its rows
  // are the store's under the family spirit.net.
  const X = win.spirit.net && win.spirit.net.client;
  return { win: win, D: D, X: X, translators: translators,
    job: function (job, from) { D.takeJob(job, from || SENDER); },
    nodes: function () { return nodesOf(D, 'spirit.net'); } };
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
  // goal/G49.23: the reads at the branch's path, the rows under the family spirit.net.
  const X = win.spirit.net && win.spirit.net.client;
  return { D: D, X: X, job: function (job, from) { D.takeJob(job, from || SENDER); }, nodes: function () { return nodesOf(D, 'spirit.net'); } };
}

// What the tests make, each in order, read by the tests after it.
let w = null;

test.run('in node, requiring the interface spirit/net/script.js brings it, and it stands at spirit.net.client', 0.2, async function () {
  require(path.join(RUN, 'spirit', 'script.js'));
  const S = globalThis.spirit;
  let threw = null;
  try { await Promise.resolve(S.requireScript('spirit/net/script.js')); } catch (e) { threw = e; }
  // goal/G49.23, box v22 Part 1: a new-shape client stands at <branch path>.client, spirit.net.client; goal/G49.24 made net new-shape.
  const X = S.net && S.net.client;
  return (!threw && !!X && typeof X === 'object') || false;
}, test.limit.quick);
test.run('run beside spirit.client, it makes its branch there', 0.2, function () {
  try { w = world(); } catch (e) { w = null; return false; }
  return (!!w.X && typeof w.X === 'object') || false;
}, test.limit.quick);

// IT KEEPS NOTHING: net.fetch answers one fetch the node made for the caller, not a row anyone reads again.
test.run('it has no reads yet', 0.2, function () {
  if (!w) return false;
  return Object.keys(w.X).length === 0 || false;
}, test.limit.quick);
test.run('it translates nothing, so it adds no translator to spirit.client', 0.2, function () {
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
