'use strict';

// spirit/run/spirit/peer/server/test/script.js
// The tests of spirit/peer/server/script.js, the peer branch's node work, and of no other module (spec: ./script.md). Its own
// test, owed since the rule "every production script has its own test" (goal/G47.1, box v72); the file is goal/G49.25's (Q5,
// Andy: "WHY THE FUCK WOULD IT NOT???" to "Does a branch's node work live at spirit/<branch>/server/script.js").
// verbs(node) -> { <verb>: { request, reply, handler } }: an answer for each verb the old-shape branch's api.js declares, none on
// a relay. What it hands is judged in this process against spirit/peer/script.js's verbs, read from it; what each answer does, on
// a scratch node at its one door, against that verb's own description, spirit/peer/<verb>.json. The peers are keys made here;
// the relays the scratch node's own list, read from its contact search.

// spirit.js, the loader, first and alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require('../../../script.js');
const test = LOADER.requireScript('spirit/test/testReport.js');
const { scratchNode } = LOADER.requireScript('spirit/test/headLessChrome.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6), and its branch, by its old word.
const SUBJECT = 'spirit/peer/server/script.js';
const BRANCH = 'spirit/peer/script.js';
const NAME = 'spirit.peer'; // the branch's path since goal/G49.26 made peer new-shape

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
const auth = LOADER.requireScript('spirit/relayAuth/script.js');
// A peer nobody here knows, found and added; one no relay can reach, posted to.
const FOUND = auth.generateIdentity('zzFound').publicKey;
const AWAY = auth.generateIdentity('zzAway').publicKey;

const W = { declared: [], node: null, own: '', relays: [] };
test.after(async function () { try { if (W.node) await W.node.release(); } catch (e) { /* gone */ } });

// ── WHAT IT HANDS ──
test.run('spirit.requireScript of its path hands back verbs, and nothing else', 0.2, function () {
  return (!!M && typeof M.verbs === 'function' && same(Object.keys(M), ['verbs'])) || false;
}, test.limit.quick);
test.run('on a node it hands an answer for each verb spirit/peer/script.js declares, and for no other', 0.2, async function () {
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
test.run('a scratch node comes up, its own key read from its card and its relays from its contact search', 0.2, async function () {
  W.node = await scratchNode();
  if (!W.node || !W.node.up) return false;
  W.own = String(((await ask('spirit.card', {})).body || {}).publicKey || '');
  const r = await ask('spirit.contact.search', { relay: true });
  W.relays = ((r.body && r.body.items) || []).map(function (i) { return (parsed(i.label) || {}).url; }).filter(Boolean);
  return (!!W.own && W.relays.length > 0) || false;
}, test.limit.long);
// acquire.json: "Add a key to your contacts (publicKey), with the label it came with (publicLabel) or none, recording where it
// was found (url, or else this node's first listed relay); the relay is asked nothing. Answers 201 {publicKey, publicLabel,
// keep}. Refused 400 without a publicKey, for a publicLabel that breaks the name rule, or for this node's own key".
test.run('acquire adds a key to the contacts with its label, answering 201 {publicKey, publicLabel, keep: true}', 0.2, async function () {
  const r = await ask(NAME + '.acquire', { publicKey: FOUND, publicLabel: 'Zz Found' });
  return (r.status === 201 && same(r.body, { publicKey: FOUND, publicLabel: 'Zz Found', keep: true })) || false;
}, test.limit.quick);
test.run('a key acquired is then a contact: contact.get shows it kept, under the label it came with', 0.2, async function () {
  const g = await ask('spirit.contact.get', { key: FOUND });
  return (g.status === 200 && !!g.body.person && g.body.person.keep === true && g.body.person.publicLabel === 'Zz Found') || false;
}, test.limit.quick);
test.run('acquire without a publicKey is refused 400', 0.2, async function () {
  return ((await ask(NAME + '.acquire', {})).status === 400) || false;
}, test.limit.quick);
test.run('acquire with a publicLabel that breaks the name rule is refused 400', 0.2, async function () {
  return ((await ask(NAME + '.acquire', { publicKey: auth.generateIdentity('zzBad').publicKey, publicLabel: 'zz\u0000bad' })).status === 400) || false;
}, test.limit.quick);
test.run('acquire of this node\'s own key is refused 400', 0.8, async function () {
  if (!W.own) return false;
  return ((await ask(NAME + '.acquire', { publicKey: W.own, publicLabel: 'Zz Me' })).status === 400) || false;
}, test.limit.quick);
// post.json: "Refused 503 when this node is not connected to a relay or the peer cannot be reached (also when via does not
// name it)".
test.run('post to a peer no relay can reach is refused 503', 0.2, async function () {
  const r = await ask(NAME + '.post', { to: AWAY, text: JSON.stringify({ zz: 1 }) });
  return (r.status === 503 && !!r.body && !!r.body.error) || false;
}, test.limit.long);
test.run('post via a relay that does not name the peer is refused 503', 0.2, async function () {
  const r = await ask(NAME + '.post', { to: AWAY, text: JSON.stringify({ zz: 1 }), via: W.relays[0] || 'https://zz.example' });
  return (r.status === 503 && !!r.body && !!r.body.error) || false;
}, test.limit.long);
