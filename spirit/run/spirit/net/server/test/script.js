'use strict';

// spirit/run/spirit/net/server/test/script.js
// The tests of spirit/net/server/script.js, the net branch's node work, and of no other module (spec: ./script.md). Its own
// test, owed since the rule "every production script has its own test" (goal/G47.1, box v72); the file is goal/G49.25's (Q5,
// Andy: "WHY THE FUCK WOULD IT NOT???" to "Does a branch's node work live at spirit/<branch>/server/script.js").
// verbs(node) -> { fetch: { request, reply, handler } }: an answer for each verb the old-shape branch's api.js declares, none on
// a relay. What it hands is judged in this process against spirit/net/script.js's verbs, read from it; what the answer does, on a
// scratch node at its one door, against the verb's own description, spirit/net/fetch.json. The target it must never reach is
// a server of this test's own on this machine.

// spirit.js, the loader, first and alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require('../../../script.js');
const http = require('http');
const os = require('os');
const test = LOADER.requireScript('spirit/test/testReport.js');
const { scratchNode } = LOADER.requireScript('spirit/test/headLessChrome.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6), and its branch, by its old word.
const SUBJECT = 'spirit/net/server/script.js';
const BRANCH = 'spirit/net/script.js';
const NAME = 'spirit.net'; // the branch's path since goal/G49.24 made net new-shape

const same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };
const parsed = function (t) { try { return JSON.parse(t); } catch (e) { return null; } };
// What the node server hands every branch's node work (spirit/server/script.js, branchNode): here anything asked of it a
// function that makes a handler, its reply shapes objects.
const HAND = new Proxy({}, { get: function (t, k) { return k === 'LIST' || k === 'JOB' ? { shape: true } : function () { return function () {}; }; } });
let M = null;
try { M = LOADER.requireScript(SUBJECT); } catch (e) { M = null; }
function handed(relay) {
  const S = globalThis.spirit;
  const was = S.IS_RELAY;
  try { S.IS_RELAY = relay; return M.verbs(HAND); } catch (e) { return null; } finally { S.IS_RELAY = was; }
}
async function ask(call, args) {
  if (!W.node || !W.node.up) return { status: 0, body: null };
  try {
    const r = await fetch(W.node.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) });
    return { status: r.status, body: parsed(await r.text()) };
  } catch (e) { return { status: 0, body: null }; }
}
const thisMachine = function (r) { return !!r && r.status === 403 && !!r.body && r.body.code === 'this-machine'; };

// A server of this test's own on this machine, counting what reaches it: net.fetch must reach none of it.
const W = { declared: [], node: null, target: null, port: 0, reached: 0 };
test.after(async function () {
  try { if (W.node) await W.node.release(); } catch (e) { /* gone */ }
  try { if (W.target) W.target.close(); } catch (e) { /* gone */ }
});

// ── WHAT IT HANDS ──
test.run('spirit.requireScript of its path hands back verbs, and nothing else', 0.2, function () {
  return (!!M && typeof M.verbs === 'function' && same(Object.keys(M), ['verbs'])) || false;
}, test.limit.quick);
test.run('on a node it hands an answer for each verb spirit/net/script.js declares, and for no other', 0.2, async function () {
  let branch = null;
  try { branch = await Promise.resolve(LOADER.requireScript(BRANCH)); } catch (e) { branch = null; }
  W.declared = Object.keys((branch && branch.verbs) || {}).sort();
  const got = handed(false);
  return (!!got && W.declared.length > 0 && same(Object.keys(got).sort(), W.declared)) || false;
}, test.limit.quick);
test.run('each answer it hands holds its request and its reply, objects, and its handler, a function', 0.2, function () {
  const got = handed(false) || {};
  const verbs = Object.keys(got);
  return (verbs.length > 0 && verbs.every(function (v) {
    return !!got[v] && !!got[v].request && typeof got[v].request === 'object' && !!got[v].reply && typeof got[v].reply === 'object' && typeof got[v].handler === 'function';
  })) || false;
}, test.limit.quick);
test.run('on a relay it hands no answer', 0.2, function () {
  const got = handed(true);
  return (!!got && same(Object.keys(got), []) && Object.keys(handed(false) || {}).length > 0) || false;
}, test.limit.quick);

// ── WHAT THE ANSWER DOES, ON A SCRATCH NODE ──
test.run('a scratch node comes up, and a server of the test\'s own on this machine', 0.2, async function () {
  W.node = await scratchNode();
  W.target = http.createServer(function (q, s) { W.reached += 1; s.end('reached'); });
  await new Promise(function (r) { W.target.listen(0, '0.0.0.0', r); });
  W.port = W.target.address().port;
  return (!!W.node && W.node.up && W.port > 0) || false;
}, test.limit.long);
// fetch.json: "It never reaches this machine: a url on loopback, localhost, 0.0.0.0, :: or one of this machine's own interface
// addresses (or a name that resolves to one) is refused 403, code this-machine, and nothing is sent."
test.run('fetch of a loopback address is refused 403 this-machine, and nothing is sent', 0.8, async function () {
  const before = W.reached;
  const r = await ask(NAME + '.fetch', { url: 'http://127.0.0.1:' + W.port + '/' });
  return (thisMachine(r) && W.reached === before) || false;
}, test.limit.quick);
test.run('fetch of localhost is refused 403 this-machine, and nothing is sent', 0.8, async function () {
  const before = W.reached;
  const r = await ask(NAME + '.fetch', { url: 'http://localhost:' + W.port + '/' });
  return (thisMachine(r) && W.reached === before) || false;
}, test.limit.quick);
test.run('fetch of 0.0.0.0 and of :: is refused 403 this-machine, and nothing is sent', 0.8, async function () {
  const before = W.reached;
  const a = await ask(NAME + '.fetch', { url: 'http://0.0.0.0:' + W.port + '/' });
  const b = await ask(NAME + '.fetch', { url: 'http://[::]:' + W.port + '/' });
  return (thisMachine(a) && thisMachine(b) && W.reached === before) || false;
}, test.limit.quick);
test.run('fetch of one of this machine\'s own interface addresses is refused 403 this-machine, and nothing is sent', 0.8, async function () {
  const own = [];
  Object.values(os.networkInterfaces()).forEach(function (list) { (list || []).forEach(function (a) { if (a.family === 'IPv4' && !a.internal) own.push(a.address); }); });
  if (!own.length) return false;
  const before = W.reached;
  const r = await ask(NAME + '.fetch', { url: 'http://' + own[0] + ':' + W.port + '/' });
  return (thisMachine(r) && W.reached === before) || false;
}, test.limit.quick);
test.run('fetch with no url is refused 400', 0.2, async function () {
  const r = await ask(NAME + '.fetch', {});
  return (r.status === 400 && !!r.body && !!r.body.error) || false;
}, test.limit.quick);
test.run('fetch of a url that is neither http nor https is refused 400', 0.2, async function () {
  const r = await ask(NAME + '.fetch', { url: 'ftp://zz.example/' });
  return (r.status === 400 && !!r.body && !!r.body.error) || false;
}, test.limit.quick);
