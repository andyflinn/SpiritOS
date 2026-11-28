'use strict';

// spirit/run/spirit/grant/client/test/script.js
// The tests of spirit/grant/client/script.js, and of no other module (spec: ./script.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
// What a client knows of a node's grants (goal/G49.21, box v24): the rows of node.db's grant table, from the node's job
// spirit.grant, each grant given or taken back, gone when taken back, by its key and path.
// It runs as it does: in a window of its own beside the real spirit.client (spirit/client/script.js), which it writes into, the
// stream's events handed in as spirit.client hands them (takeJob), each from the node that served it. In node it comes with
// its branch's script (spirit.requireScript('spirit/grant/script.js')), the one script that requires it. The reads alone are read.

// spirit.js, the loader, first and alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require('../../../script.js');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = LOADER.requireScript('spirit/testicle/testReport/script.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/grant/client/script.js';

const same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };
// The nodes a family keeps rows for: read off every branch the store holds, <node>/<family>/<branch>.
const nodesOf = function (D, fam) { const out = []; D.allBranches().forEach(function (p) { const s = p.split('/'); if (s[1] === fam && out.indexOf(s[0]) < 0) out.push(s[0]); }); return out; };
// Two nodes' public keys, base64 with a + and a / in them, as a node's key is.
const SENDER = 'Ab+c/DeF0123456789abcdefghijklmnopqrstuvwxy=';
const OTHER = 'Zy+x/WvU9876543210zyxwvutsrqponmlkjihgfedcb=';
// Two users' keys a grant is given to.
const U1 = 'MCowBQYDK2VwAyEAgrantClientTest1AAAAAAAAAAAAAAAAAAAAAAAAA=';
const U2 = 'MCowBQYDK2VwAyEAgrantClientTest2AAAAAAAAAAAAAAAAAAAAAAAAA=';

// A window of its own: the real spirit.client, then the file, as a page loads them. page true: spirit.isBrowser() true and
// the page's node known (spirit.nodeFacts.key), so a row another node served is filed under that node.
function world(page) {
  const win = { JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Map: Map, Math: Math, Date: Date, unescape: unescape, encodeURIComponent: encodeURIComponent };
  win.window = win;
  win.spirit = page ? { isBrowser: function () { return true; }, nodeFacts: { key: SENDER } } : {};
  vm.createContext(win);
  LOADER.requireScript('spirit/testicle/headLessChrome/script.js').pageSpirit(win.spirit, null, { window: win, real: ['spirit/client/script.js', SUBJECT] });
  win.spirit.requireScript('spirit/client/script.js');
  win.spirit.requireScript(SUBJECT);
  const D = win.spirit.client;
  // goal/G49.23: the reads stand at the client's path, spirit.grant.client; its rows are the store's under the family spirit.grant.
  const X = win.spirit.grant && win.spirit.grant.client;
  return { D: D, X: X, job: function (job, from) { D.takeJob(job, from || SENDER); }, nodes: function () { return nodesOf(D, 'spirit.grant'); } };
}
const job = function (data) { return { id: 'spirit.grant', data: data }; };

// What the tests make, each in order, read by the tests after it.
let w = null;

test.run('in node, requiring spirit/grant/script.js brings the grant table\'s client, at spirit.grant.client', 0.2, async function () {
  const S = globalThis.spirit;
  let threw = null;
  try { await Promise.resolve(S.requireScript('spirit/grant/script.js')); } catch (e) { threw = e; }
  const X = S.grant && S.grant.client;
  return (!threw && !!X && typeof X.row === 'function') || false;
}, test.limit.quick);
test.run('run beside spirit.client, it makes its reads there', 0.2, function () {
  try { w = world(false); } catch (e) { w = null; return false; }
  return (!!w.X && typeof w.X.row === 'function' && typeof w.X.rows === 'function' && typeof w.X.watch === 'function' && typeof w.X.grantKey === 'function') || false;
}, test.limit.quick);
test.run('grantKey is the key, a newline, and the path', 0.2, function () {
  if (!w) return false;
  return (w.X.grantKey(U1, 'spirit.desk') === U1 + '\nspirit.desk' && w.X.grantKey(7, 8) === '7\n8') || false;
}, test.limit.quick);
test.run('a grant given is kept whole, by its key and path', 0.2, function () {
  if (!w) return false;
  w.job(job({ row: { key: U1, path: 'spirit.desk', bundle: 3, by: 'node' } }));
  return same(w.X.row(w.X.grantKey(U1, 'spirit.desk')), { key: U1, path: 'spirit.desk', bundle: 3, by: 'node' }) || false;
}, test.limit.quick);
test.run('the same key on another path is another grant', 0.2, function () {
  if (!w) return false;
  w.job(job({ row: { key: U1, path: 'spirit.fs' } }));
  return (!!w.X.row(w.X.grantKey(U1, 'spirit.fs')) && w.X.row(w.X.grantKey(U1, 'spirit.desk')).bundle === 3) || false;
}, test.limit.quick);
test.run('a grant given again replaces the one kept', 0.2, function () {
  if (!w) return false;
  w.job(job({ row: { key: U1, path: 'spirit.desk', bundle: 4 } }));
  return same(w.X.row(w.X.grantKey(U1, 'spirit.desk')), { key: U1, path: 'spirit.desk', bundle: 4 }) || false;
}, test.limit.quick);
test.run('a grant taken back is let go', 0.2, function () {
  if (!w) return false;
  w.job(job({ row: { key: U2, path: 'spirit.job' } }));
  const had = !!w.X.row(w.X.grantKey(U2, 'spirit.job'));
  w.job(job({ row: { key: U2, path: 'spirit.job' }, gone: true }));
  return (had && w.X.row(w.X.grantKey(U2, 'spirit.job')) === null) || false;
}, test.limit.quick);
test.run('a row with no key or no path, or a job of another id, keeps nothing', 0.2, function () {
  if (!w) return false;
  w.job(job({ row: { path: 'spirit.app' } }));
  w.job(job({ row: { key: U2 } }));
  w.job({ id: 'spirit.bundle', data: { row: { key: U2, path: 'spirit.app' } } });
  return same(Object.keys(w.X.rows()).sort(), [w.X.grantKey(U1, 'spirit.desk'), w.X.grantKey(U1, 'spirit.fs')].sort()) || false;
}, test.limit.quick);
test.run('row of no id answers null', 0.2, function () {
  if (!w) return false;
  return (w.X.row(null) === null && w.X.row('') === null && w.X.row(w.X.grantKey(U2, 'nowhere')) === null) || false;
}, test.limit.quick);
test.run('watch hears each change by the grant\'s id, undefined once gone, and nothing once released', 0.2, function () {
  if (!w) return false;
  const heard = [];
  const off = w.X.watch(function (id, r) { heard.push([id, r ? r.path : r]); });
  w.job(job({ row: { key: U2, path: 'spirit.app' } }));
  w.job(job({ row: { key: U2, path: 'spirit.app' }, gone: true }));
  off();
  w.job(job({ row: { key: U2, path: 'spirit.icon' } }));
  const id = w.X.grantKey(U2, 'spirit.app');
  return (typeof off === 'function' && same(heard, [[id, 'spirit.app'], [id, undefined]])) || false;
}, test.limit.quick);
test.run('branch is the grants\' whole path, under the node that served them', 0.2, function () {
  if (!w) return false;
  const pre = w.D.nodeId(SENDER) + '/spirit.grant/';
  return (typeof w.X.branch === 'string' && w.X.branch.indexOf(pre) === 0 && w.X.branch.length > pre.length) || false;
}, test.limit.quick);
// In a process the reads are of the node whose rows it last took (spirit/client/script.js, homeNode; the reads are a view of node null).
test.run('in a process, a grant from another node is filed under that node, never among the first node\'s grants', 0.2, function () {
  if (!w) return false;
  w.job(job({ row: { key: U2, path: 'theirs' } }), OTHER);
  const there = w.X.row(w.X.grantKey(U2, 'theirs'));
  w.job(job({ row: { key: U2, path: 'mine' } }), SENDER);
  return (same(w.nodes().sort(), [w.D.nodeId(SENDER), w.D.nodeId(OTHER)].sort()) && !!there && w.X.row(w.X.grantKey(U2, 'theirs')) === null && !!w.X.row(w.X.grantKey(U1, 'spirit.fs'))) || false;
}, test.limit.quick);
test.run('on a page, a grant another node served is filed under that node, never among the page\'s own node\'s grants', 0.2, function () {
  let p; try { p = world(true); } catch (e) { return false; }
  p.job(job({ row: { key: U1, path: 'mine' } }));
  p.job(job({ row: { key: U1, path: 'theirs' } }), OTHER);
  return (same(p.nodes().sort(), [p.D.nodeId(SENDER), p.D.nodeId(OTHER)].sort()) && p.X.row(p.X.grantKey(U1, 'theirs')) === null && !!p.X.row(p.X.grantKey(U1, 'mine'))) || false;
}, test.limit.quick);
