'use strict';

// spirit/run/spirit/bundle/client/test/script.js
// The tests of spirit/bundle/client/script.js, and of no other module (spec: ./script.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
// What a client knows of a node's bundles (goal/G49.21, box v24): the rows of node.db's bundle table, from the node's job
// spirit.bundle, each changed row, gone when deleted.
// It runs as it does: in a window of its own beside the real spirit.client (spirit/client/script.js), which it writes into, the
// stream's events handed in as spirit.client hands them (takeJob), each from the node that served it. In node it comes with
// its branch's script (spirit.requireScript('spirit/bundle/script.js')), the one script that requires it. The reads alone are read.

// spirit.js, the loader, first and alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require('../../../script.js');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = LOADER.requireScript('spirit/test/testReport.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/bundle/client/script.js';

const same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };
// The nodes a family keeps rows for: read off every branch the store holds, <node>/<family>/<branch>.
const nodesOf = function (D, fam) { const out = []; D.allBranches().forEach(function (p) { const s = p.split('/'); if (s[1] === fam && out.indexOf(s[0]) < 0) out.push(s[0]); }); return out; };
// Two nodes' public keys, base64 with a + and a / in them, as a node's key is.
const SENDER = 'Ab+c/DeF0123456789abcdefghijklmnopqrstuvwxy=';
const OTHER = 'Zy+x/WvU9876543210zyxwvutsrqponmlkjihgfedcb=';

// A window of its own: the real spirit.client, then the file, as a page loads them. page true: spirit.isBrowser() true and
// the page's node known (spirit.nodeFacts.key), so a row another node served is filed under that node.
function world(page) {
  const win = { JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Map: Map, Math: Math, Date: Date, unescape: unescape, encodeURIComponent: encodeURIComponent };
  win.window = win;
  win.spirit = page ? { isBrowser: function () { return true; }, nodeFacts: { key: SENDER } } : {};
  vm.createContext(win);
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(win.spirit, null, { window: win, real: ['spirit/client/script.js', SUBJECT] });
  win.spirit.requireScript('spirit/client/script.js');
  win.spirit.requireScript(SUBJECT);
  const D = win.spirit.client;
  // goal/G49.23: the reads stand at the client's path, spirit.bundle.client; its rows are the store's under the family spirit.bundle.
  const X = win.spirit.bundle && win.spirit.bundle.client;
  return { D: D, X: X, job: function (job, from) { D.takeJob(job, from || SENDER); }, nodes: function () { return nodesOf(D, 'spirit.bundle'); } };
}
const job = function (data) { return { id: 'spirit.bundle', data: data }; };

// What the tests make, each in order, read by the tests after it.
let w = null;

test.run('in node, requiring spirit/bundle/script.js brings the bundle table\'s client, at spirit.bundle.client', 0.2, async function () {
  const S = globalThis.spirit;
  let threw = null;
  try { await Promise.resolve(S.requireScript('spirit/bundle/script.js')); } catch (e) { threw = e; }
  const X = S.bundle && S.bundle.client;
  return (!threw && !!X && typeof X.row === 'function') || false;
}, test.limit.quick);
test.run('run beside spirit.client, it makes its reads there', 0.2, function () {
  try { w = world(false); } catch (e) { w = null; return false; }
  return (!!w.X && typeof w.X.row === 'function' && typeof w.X.rows === 'function' && typeof w.X.watch === 'function') || false;
}, test.limit.quick);
// goal/G41.25: the owner as the node said it.
test.run('a row of the spirit.bundle job is kept by its id, as { id, label, owner }', 0.2, function () {
  if (!w) return false;
  w.job(job({ row: { id: '3', label: 'friends', owner: 42, extra: 'dropped' } }));
  return same(w.X.row(3), { id: 3, label: 'friends', owner: '42' }) || false;
}, test.limit.quick);
test.run('a row that names no owner keeps none, and no label keeps it empty', 0.2, function () {
  if (!w) return false;
  w.job(job({ row: { id: 4 } }));
  const r = w.X.row(4);
  return (same(r, { id: 4, label: '' }) && !('owner' in r)) || false;
}, test.limit.quick);
test.run('a row changed replaces the one kept', 0.2, function () {
  if (!w) return false;
  w.job(job({ row: { id: 4, label: 'family', owner: 'node' } }));
  return same(w.X.row(4), { id: 4, label: 'family', owner: 'node' }) || false;
}, test.limit.quick);
test.run('a row gone is let go', 0.2, function () {
  if (!w) return false;
  w.job(job({ row: { id: 5, label: 'gone soon' } }));
  const had = !!w.X.row(5);
  w.job(job({ row: { id: 5 }, gone: true }));
  return (had && w.X.row(5) === null) || false;
}, test.limit.quick);
test.run('a row with no id, or a job of another id, keeps nothing', 0.2, function () {
  if (!w) return false;
  w.job(job({ row: { label: 'no id' } }));
  w.job({ id: 'spirit.branch', data: { row: { id: 6, label: 'not mine' } } });
  return (same(Object.keys(w.X.rows()).sort(), ['3', '4']) && w.X.row(6) === null) || false;
}, test.limit.quick);
test.run('row of no id answers null', 0.2, function () {
  if (!w) return false;
  return (w.X.row(null) === null && w.X.row('') === null && w.X.row(404) === null) || false;
}, test.limit.quick);
test.run('watch hears each change by the row\'s id, undefined once gone, and nothing once released', 0.2, function () {
  if (!w) return false;
  const heard = [];
  const off = w.X.watch(function (id, r) { heard.push([id, r ? r.label : r]); });
  w.job(job({ row: { id: 7, label: 'heard' } }));
  w.job(job({ row: { id: 7 }, gone: true }));
  off();
  w.job(job({ row: { id: 8, label: 'not heard' } }));
  return (typeof off === 'function' && same(heard, [['7', 'heard'], ['7', undefined]])) || false;
}, test.limit.quick);
test.run('branch is the rows\' whole path, under the node that served them', 0.2, function () {
  if (!w) return false;
  const pre = w.D.nodeId(SENDER) + '/spirit.bundle/';
  return (typeof w.X.branch === 'string' && w.X.branch.indexOf(pre) === 0 && w.X.branch.length > pre.length) || false;
}, test.limit.quick);
// In a process the reads are of the node whose rows it last took (spirit/client/script.js, homeNode; the reads are a view of node null).
test.run('in a process, a row from another node is filed under that node, never among the first node\'s rows', 0.2, function () {
  if (!w) return false;
  w.job(job({ row: { id: 13, label: 'theirs' } }), OTHER);
  const there = w.X.row(13);
  w.job(job({ row: { id: 14, label: 'mine' } }), SENDER);
  return (same(w.nodes().sort(), [w.D.nodeId(SENDER), w.D.nodeId(OTHER)].sort()) && !!there && w.X.row(13) === null && !!w.X.row(3)) || false;
}, test.limit.quick);
test.run('on a page, a row another node served is filed under that node, never among the page\'s own node\'s rows', 0.2, function () {
  let p; try { p = world(true); } catch (e) { return false; }
  p.job(job({ row: { id: 1, label: 'mine' } }));
  p.job(job({ row: { id: 2, label: 'theirs' } }), OTHER);
  return (same(p.nodes().sort(), [p.D.nodeId(SENDER), p.D.nodeId(OTHER)].sort()) && p.X.row(2) === null && !!p.X.row(1)) || false;
}, test.limit.quick);
