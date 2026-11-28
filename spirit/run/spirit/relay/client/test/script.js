'use strict';

// spirit/run/spirit/relay/client/test/script.js
// The tests of spirit/relay/client/script.js, and of no other module (spec: ./script.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
// What a client knows of a relay's branch (goal/G49.25, box v25: spirit.relay "implemented properly as a system branch in the
// tree"): a relay's rows travel on its members' stream and in sealed answers, never on a node's job stream, so it keeps none; it
// is the branch's other half, the family spirit.relay in the client's store, with the handle and the remote every client has.
// It runs as it does: in a window of its own beside the real spirit.client (spirit/client/script.js), the stream's events
// handed in as spirit.client hands them (takeJob). In node it comes with its branch's script, the one script that requires it.

// spirit.js, the loader, first and alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require('../../../script.js');
const vm = require('vm');
const test = LOADER.requireScript('spirit/test/testReport.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/relay/client/script.js';
const FAMILY = 'spirit.relay';

const same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };
// A node's public key, base64 with a + and a / in it, as a node's key is.
const SENDER = 'Ab+c/DeF0123456789abcdefghijklmnopqrstuvwxy=';

// A window of its own: the real spirit.client, then the file, as a page loads them; on a page, the page's node known.
function world() {
  const win = { JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Map: Map, Math: Math, Date: Date, unescape: unescape, encodeURIComponent: encodeURIComponent };
  win.window = win;
  win.spirit = { isBrowser: function () { return true; }, nodeFacts: { key: SENDER } };
  vm.createContext(win);
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(win.spirit, null, { window: win, real: ['spirit/client/script.js', SUBJECT] });
  win.spirit.requireScript('spirit/client/script.js');
  win.spirit.requireScript(SUBJECT);
  const D = win.spirit.client;
  const X = win.spirit.relay && win.spirit.relay.client;
  return { D: D, X: X, job: function (job) { D.takeJob(job, SENDER); }, mine: function () { return D.allBranches().filter(function (p) { return p.split('/')[1] === FAMILY; }); } };
}

let w = null;

test.run('in node, requiring spirit/relay/script.js brings the relay branch\'s client, at spirit.relay.client', 0.2, async function () {
  const S = globalThis.spirit;
  let threw = null;
  try { await Promise.resolve(S.requireScript('spirit/relay/script.js')); } catch (e) { threw = e; }
  const X = S.relay && S.relay.client;
  return (!threw && !!X && typeof X === 'object' && typeof X.handle === 'function') || false;
}, test.limit.quick);
test.run('run beside spirit.client, it puts out no reads of its own', 0.2, function () {
  try { w = world(); } catch (e) { w = null; return false; }
  return (!!w.X && typeof w.X === 'object' && same(Object.keys(w.X), [])) || false;
}, test.limit.quick);
// Its rows travel on no job of a node: a job named after its family, or one of its module, keeps nothing in its family.
test.run('it keeps no rows: a job named spirit.relay writes nothing into the family', 0.2, function () {
  if (!w) return false;
  w.job({ id: FAMILY, data: { row: { id: 1, key: 'k' } } });
  w.job({ id: 'zzOther', module: FAMILY, data: { row: { id: 2 } } });
  return (same(w.mine(), []) && same(w.X.handle('rows').rows(), [])) || false;
}, test.limit.quick);
test.run('handle(branch) is that branch of the family spirit.relay under the page\'s node, and seats and reads its rows there', 0.2, function () {
  if (!w) return false;
  const h = w.X.handle('zzSeen');
  const pre = w.D.nodeId(SENDER) + '/' + FAMILY + '/zzSeen';
  h.seat([{ key: 'a', label: JSON.stringify({ n: 1 }) }]);
  return (h.path === pre && same(h.rows(), [{ key: 'a', n: 1 }]) && same(w.mine(), [pre])) || false;
}, test.limit.quick);
test.run('remote is the row a job of the module spirit.relay last published, and watchRemote hears each, and nothing once released', 0.2, function () {
  if (!w) return false;
  const heard = [];
  const off = w.X.watchRemote(function (r) { heard.push(r); });
  w.job({ id: 'zzA', module: FAMILY, app: { remote: { at: 1 } } });
  const first = w.X.remote;
  off();
  w.job({ id: 'zzB', module: FAMILY, app: { remote: { at: 2 } } });
  return (typeof off === 'function' && same(first, { at: 1 }) && same(w.X.remote, { at: 2 }) && same(heard, [{ at: 1 }])) || false;
}, test.limit.quick);
