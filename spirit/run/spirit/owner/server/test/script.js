'use strict';

// spirit/run/spirit/owner/server/test/script.js
// The tests of spirit/owner/server/script.js, the owner branch's node work, and of no other module (spec: ./script.md). Its own
// test, owed since the rule "every production script has its own test" (goal/G47.1, box v72); the file is goal/G49.25's (Q5,
// Andy: "WHY THE FUCK WOULD IT NOT???" to "Does a branch's node work live at spirit/<branch>/server/script.js").
// verbs(node) -> { <verb>: { request, reply, handler } }: an answer for each verb the old-shape branch's api.js declares, none on
// a relay. What it hands is judged in this process against spirit/owner/api.js's verbs, read from it; what each answer does,
// on a scratch node at its one door, against that verb's own description, spirit/owner/<verb>.json. The puppet is a key made
// here, which no relay of the scratch node can reach.

// spirit.js, the loader, first and alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require('../../../script.js');
const test = LOADER.requireScript('spirit/test/testReport.js');
const { scratchNode } = LOADER.requireScript('spirit/test/headLessChrome.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6), and its branch, by its old word.
const SUBJECT = 'spirit/owner/server/script.js';
const BRANCH = 'spirit/owner/api.js';
const NAME = 'owner';

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
// A puppet's key nobody can reach.
const PUPPET = LOADER.requireScript('spirit/relayAuth/script.js').generateIdentity('zzPuppet').publicKey;

const W = { declared: [], node: null };
test.after(async function () { try { if (W.node) await W.node.release(); } catch (e) { /* gone */ } });

// ── WHAT IT HANDS ──
test.run('spirit.requireScript of its path hands back verbs, and nothing else', 0.2, function () {
  return (!!M && typeof M.verbs === 'function' && same(Object.keys(M), ['verbs'])) || false;
}, test.limit.quick);
test.run('on a node it hands an answer for each verb spirit/owner/api.js declares, and for no other', 0.2, async function () {
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

// ── WHAT EACH ANSWER DOES, ON A SCRATCH NODE ──
test.run('a scratch node comes up', 0.2, async function () {
  W.node = await scratchNode();
  return (!!W.node && W.node.up) || false;
}, test.limit.long);
// boxSearch.json: "The boxes the owner's servers have reported ... as a bounded list of {key: fingerprint, label}". None has.
test.run('boxSearch answers the boxes reported, none on a new node, as {ok, items, more}', 0.2, async function () {
  const r = await ask(NAME + '.boxSearch', {});
  const all = await ask(NAME + '.boxSearch', { q: '*' });
  return (r.status === 200 && same(r.body, { ok: true, items: [], more: false }) && all.status === 200 && same(all.body, r.body)) || false;
}, test.limit.quick);
// boxGet.json: "One box by its fingerprint (key) ...; 404 when there is none."
test.run('boxGet of a fingerprint no box has is refused 404', 0.2, async function () {
  const r = await ask(NAME + '.boxGet', { key: 'zzNoSuchBox' });
  return (r.status === 404 && !!r.body && !!r.body.error) || false;
}, test.limit.quick);
// command.json: "Refused 400 without a puppet or a command, 503 when this node is not connected to a relay or the puppet cannot
// be reached".
test.run('command without a puppet is refused 400', 0.2, async function () {
  return ((await ask(NAME + '.command', { command: 'card' })).status === 400) || false;
}, test.limit.quick);
test.run('command without a command is refused 400', 0.2, async function () {
  return ((await ask(NAME + '.command', { to: PUPPET })).status === 400) || false;
}, test.limit.quick);
test.run('command to a puppet no relay can reach is refused 503', 0.2, async function () {
  const r = await ask(NAME + '.command', { to: PUPPET, command: 'card', body: {} });
  return (r.status === 503 && !!r.body && r.body.ok === false && !!r.body.error) || false;
}, test.limit.long);
