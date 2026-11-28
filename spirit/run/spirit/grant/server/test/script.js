'use strict';

// spirit/run/spirit/grant/server/test/script.js
// The tests of spirit/grant/server/script.js, the spirit.grant branch's node work, and of no other module (spec: ./script.md).
// Its own test, owed since the rule "every production script has its own test" (goal/G47.1, box v72); the file is goal/G49.25's
// (Q5, Andy: "WHY THE FUCK WOULD IT NOT???" to "Does a branch's node work live at spirit/<branch>/server/script.js").
// verbs(node) -> { <verb>: { reply, handler } }: an answer for each verb the branch's script declares, none on a relay. What
// it hands is judged in this process against spirit/grant/script.js's verbs, read from it; what each answer does, on a scratch
// node at its one door, against that verb's own description, spirit/grant/<verb>.json. The member is a key made here, the
// paths it is granted the node's own branches, read from the scripts that declare them.

// spirit.js, the loader, first and alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require('../../../script.js');
const test = LOADER.requireScript('spirit/testicle/testReport/script.js');
const { scratchNode } = LOADER.requireScript('spirit/testicle/headLessChrome/script.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6), and its branch.
const SUBJECT = 'spirit/grant/server/script.js';
const BRANCH = 'spirit/grant/script.js';
const NAME = 'spirit.grant';

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
const refusedAs = function (r, status, code) { return !!r && r.status === status && !!r.body && r.body.ok === false && r.body.code === code; };
async function verbsOf(script) { try { const b = await Promise.resolve(LOADER.requireScript(script)); return Object.keys((b && b.verbs) || {}); } catch (e) { return []; } }

// A member's key nobody here knows yet, and the path it is granted: this branch's first verb.
const MEMBER = LOADER.requireScript('spirit/relayAuth/script.js').generateIdentity('zzMember').publicKey;
const W = { declared: [], node: null, path: '', own: '' };
test.after(async function () { try { if (W.node) await W.node.release(); } catch (e) { /* gone */ } });

// ── WHAT IT HANDS ──
test.run('spirit.requireScript of its path hands back verbs, and nothing else', 0.2, function () {
  return (!!M && typeof M.verbs === 'function' && same(Object.keys(M), ['verbs'])) || false;
}, test.limit.quick);
test.run('on a node it hands an answer for each verb spirit/grant/script.js declares, and for no other', 0.2, async function () {
  W.declared = (await verbsOf(BRANCH)).sort();
  const got = handed(false);
  return (!!got && W.declared.length > 0 && same(Object.keys(got).sort(), W.declared)) || false;
}, test.limit.quick);
test.run('each answer it hands holds its reply, an object, and its handler, a function', 0.2, function () {
  const got = handed(false) || {};
  const verbs = Object.keys(got);
  return (verbs.length > 0 && verbs.every(function (v) { return !!got[v] && !!got[v].reply && typeof got[v].reply === 'object' && typeof got[v].handler === 'function'; })) || false;
}, test.limit.quick);
test.run('on a relay it hands no answer', 0.2, function () {
  const got = handed(true);
  return (!!got && same(Object.keys(got), []) && Object.keys(handed(false) || {}).length > 0) || false;
}, test.limit.quick);

// ── WHAT EACH ANSWER DOES, ON A SCRATCH NODE ──
test.run('a scratch node comes up, its own key read from its card', 0.2, async function () {
  W.node = await scratchNode();
  if (!W.node || !W.node.up) return false;
  W.own = String(((await ask('spirit.card', {})).body || {}).publicKey || '');
  W.path = W.declared.length ? NAME + '.' + W.declared[0] : '';
  return (!!W.own && !!W.path) || false;
}, test.limit.long, { why: 'it starts a scratch node and asks its card' });
// get.json: "Whether a member's key is granted one api path ...: {allowed}."
test.run('get of a path the key is not granted answers {allowed: false}', 0.2, async function () {
  const r = await ask(NAME + '.get', { key: MEMBER, path: W.path });
  return (r.status === 200 && same(r.body, { allowed: false })) || false;
}, test.limit.quick);
// add.json: "Grant one member's key one api path ...: {key, label, path}. The label is the name the table already holds for
// that key, or else what your contacts call it, or else empty."
test.run('add grants the key the path, answering {key, label, path}, the label empty for a key nobody named', 0.2, async function () {
  const r = await ask(NAME + '.add', { key: MEMBER, path: W.path });
  return (r.status === 200 && same(r.body, { key: MEMBER, label: '', path: W.path })) || false;
}, test.limit.quick);
test.run('get of the path granted answers {allowed: true}', 0.2, async function () {
  const r = await ask(NAME + '.get', { key: MEMBER, path: W.path });
  return (r.status === 200 && same(r.body, { allowed: true })) || false;
}, test.limit.quick);
test.run('add of a path the key holds already is refused 409 already-granted', 0.2, async function () {
  return refusedAs(await ask(NAME + '.add', { key: MEMBER, path: W.path }), 409, 'already-granted') || false;
}, test.limit.quick);
// goal/G49.25: no path is hard-coded ungrantable (Andy: "the only thing i'd hard-code protect from is ownership change, and the
// node has no verbs for that", "they go now"). spirit.fs, a verb of it and spirit.contact.faceable are granted as any path: add
// answers {key, label, path}, get answers allowed, and delete takes each back so the table is as before.
async function grantedAndTaken(p) {
  const r = await ask(NAME + '.add', { key: MEMBER, path: p });
  const held = await ask(NAME + '.get', { key: MEMBER, path: p });
  const del = await ask(NAME + '.delete', { key: MEMBER, path: p });
  return r.status === 200 && same(r.body, { key: MEMBER, label: '', path: p }) && held.status === 200 && same(held.body, { allowed: true }) && del.status === 200;
}
test.run('add of spirit.fs, or a verb of it, grants it as any path', 0.8, async function () {
  const fsVerbs = await verbsOf('spirit/fs/script.js');
  if (!fsVerbs.length) return false;
  return ((await grantedAndTaken('spirit.fs')) && (await grantedAndTaken('spirit.fs.' + fsVerbs[0]))) || false;
}, test.limit.quick);
test.run('add of contact.faceable grants it as any path', 0.8, async function () {
  const contact = await verbsOf('spirit/contact/script.js');
  if (contact.indexOf('faceable') === -1) return false;
  return (await grantedAndTaken('spirit.contact.faceable')) || false;
}, test.limit.quick);
test.run('add of a path no server serves and no grant names is refused 404 unknown-path', 0.2, async function () {
  return refusedAs(await ask(NAME + '.add', { key: MEMBER, path: 'spirit.zzNoSuchBranch' }), 404, 'unknown-path') || false;
}, test.limit.quick);
// search.json: "every grant ranked by the words (text) ...; no words is every grant in the table's order: {ok, items: [{key:
// the key, a newline and the path, label: {name, key, path} as JSON}], more}."
test.run('search with no words answers every grant as {ok, items, more}', 0.2, async function () {
  const r = await ask(NAME + '.search', {});
  const keys = ((r.body && r.body.items) || []).map(function (i) { return i.key; });
  return (r.status === 200 && r.body.ok === true && typeof r.body.more === 'boolean' && same(keys, [MEMBER + '\n' + W.path])) || false;
}, test.limit.quick);
test.run('search by words answers the grant they name, its key the key, a newline and the path, its label {name, key, path}', 0.2, async function () {
  const r = await ask(NAME + '.search', { text: W.declared[0] || 'zz' });
  const items = (r.body && r.body.items) || [];
  return (r.status === 200 && items.length === 1 && items[0].key === MEMBER + '\n' + W.path && same(parsed(items[0].label), { name: '', key: MEMBER, path: W.path })) || false;
}, test.limit.quick);
// delete.json: "Take one grant of an api path back from a member's key: {revoked: true} ... not-granted (403) when that key
// does not hold that path."
test.run('delete takes the grant back, answering {revoked: true}: get then answers {allowed: false}', 0.2, async function () {
  const r = await ask(NAME + '.delete', { key: MEMBER, path: W.path });
  const g = await ask(NAME + '.get', { key: MEMBER, path: W.path });
  return (r.status === 200 && same(r.body, { revoked: true }) && g.status === 200 && same(g.body, { allowed: false })) || false;
}, test.limit.quick);
test.run('delete of a path a known key does not hold is refused 403 not-granted', 0.2, async function () {
  if (!W.own) return false;
  return refusedAs(await ask(NAME + '.delete', { key: W.own, path: W.path }), 403, 'not-granted') || false;
}, test.limit.quick);
