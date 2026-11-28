'use strict';

// spirit/run/spirit/contact/server/test/script.js
// The tests of spirit/contact/server/script.js, the spirit.contact branch's node work, and of no other module (spec: ./script.md).
// Its own test, owed since the rule "every production script has its own test" (goal/G47.1, box v72); the file is goal/G49.25's
// (Q5, Andy: "WHY THE FUCK WOULD IT NOT???" to "Does a branch's node work live at spirit/<branch>/server/script.js").
// verbs(node) -> { <verb>: { reply, handler } }: an answer for each verb the branch's script declares, none on a relay. What
// it hands is judged in this process against spirit/contact/script.js's verbs, read from it; what each answer does, on a
// scratch node at its one door, against that verb's own description, spirit/contact/<verb>.json. The people are keys made here;
// the relay a scratch relay, put on the node's list by the node's own contact.add.

// spirit.js, the loader, first and alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require('../../../script.js');
const test = LOADER.requireScript('spirit/testicle/testReport/script.js');
const { scratchNode, scratchRelay } = LOADER.requireScript('spirit/testicle/headLessChrome/script.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6), and its branch.
const SUBJECT = 'spirit/contact/server/script.js';
const BRANCH = 'spirit/contact/script.js';
const NAME = 'spirit.contact';

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
const has = function (o, keys) { return !!o && typeof o === 'object' && keys.every(function (k) { return Object.prototype.hasOwnProperty.call(o, k); }); };
const rowsOf = function (r) { return ((r && r.body && r.body.items) || []).map(function (i) { return { key: i.key, row: parsed(i.label) }; }); };
const standing = function (r, key, keep, blocked) { return !!r && r.status === 200 && same(r.body, { publicKey: key, keep: keep, blocked: blocked }); };
const auth = LOADER.requireScript('spirit/relayAuth/script.js');
// Two people nobody here knows yet.
const PERSON = auth.generateIdentity('zzPerson').publicKey;
const BLOCKED = auth.generateIdentity('zzBlocked').publicKey;
const FLAGS = ['keep', 'mine', 'relay', 'blocked', 'seated'];

const W = { declared: [], node: null, relay: null, own: '', relayKey: '' };
test.after(async function () {
  try { if (W.node) await W.node.release(); } catch (e) { /* gone */ }
  try { if (W.relay) await W.relay.release(); } catch (e) { /* gone */ }
});

// ── WHAT IT HANDS ──
test.run('spirit.requireScript of its path hands back verbs, and nothing else', 0.2, function () {
  return (!!M && typeof M.verbs === 'function' && same(Object.keys(M), ['verbs'])) || false;
}, test.limit.quick);
test.run('on a node it hands an answer for each verb spirit/contact/script.js declares, and for no other', 0.2, async function () {
  let branch = null;
  try { branch = await Promise.resolve(LOADER.requireScript(BRANCH)); } catch (e) { branch = null; }
  W.declared = Object.keys((branch && branch.verbs) || {}).sort();
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

// ── WHAT EACH ANSWER DOES, ON A SCRATCH NODE AND A SCRATCH RELAY ──
test.run('a scratch relay and a scratch node come up, the node\'s own key read from its card', 0.2, async function () {
  W.relay = await scratchRelay();
  W.node = await scratchNode();
  if (!W.relay || !W.relay.up || !W.node || !W.node.up) return false;
  W.own = String(((await ask('spirit.card', {})).body || {}).publicKey || '');
  return !!W.own || false;
}, test.limit.long, { why: 'it starts a scratch relay and a scratch node' });
// add.json: "Put a relay on this node's list by its url, under your own label for it, once its card answers: {ok, url,
// relayKey}. ... 502 when the relay gives no card".
test.run('add puts the scratch relay on the list by its url once its card answers, {ok, url, relayKey}, its key the relay\'s', 0.2, async function () {
  if (!W.relay || !W.relay.up) return false;
  const r = await ask(NAME + '.add', { url: W.relay.base, label: 'Zz Relay' });
  W.relayKey = String((r.body && r.body.relayKey) || '');
  const key = auth.loadIdentity(W.relay.run).publicKey;
  return (r.status === 200 && same(r.body, { ok: true, url: W.relay.base, relayKey: key })) || false;
}, test.limit.quick);
test.run('add of a url whose relay gives no card is refused 502', 0.2, async function () {
  const r = await ask(NAME + '.add', { url: 'http://127.0.0.1:1', label: 'Zz Nobody' });
  return (r.status === 502 && !!r.body && !!r.body.error) || false;
}, test.limit.quick);
// block.json: "A key with no row yet gets one, named by publicLabel ... Refused 400 ... for this node's own key".
test.run('block of a key with no row makes one, named by publicLabel, answering {publicKey, keep, blocked: true}', 0.2, async function () {
  const r = await ask(NAME + '.block', { publicKey: PERSON, publicLabel: 'Zz Person' });
  const g = await ask(NAME + '.get', { key: PERSON });
  return (standing(r, PERSON, false, true) && g.status === 200 && !!g.body.person && g.body.person.publicLabel === 'Zz Person' && g.body.person.blocked === true) || false;
}, test.limit.quick);
test.run('block of this node\'s own key is refused 400', 0.8, async function () {
  return ((await ask(NAME + '.block', { publicKey: W.own })).status === 400) || false;
}, test.limit.quick);
// get.json: "One row ... by public key (key): {ok, key, person: {publicKey, publicLabel, caption, myLabel, keep, mine, relay,
// blocked, seated, present, url, bytesHeld, ambiguous?}}; for a relay's row also relay ... and report ...; 404 when there is none."
test.run('get answers a row by its key, {ok, key, person}, the person with every field its description names', 0.2, async function () {
  const r = await ask(NAME + '.get', { key: PERSON });
  return (r.status === 200 && r.body.ok === true && r.body.key === PERSON &&
    has(r.body.person, ['publicKey', 'publicLabel', 'caption', 'myLabel', 'keep', 'mine', 'relay', 'blocked', 'seated', 'present', 'url', 'bytesHeld'])) || false;
}, test.limit.quick);
test.run('get of a relay\'s row also answers the relay\'s row and its report', 0.2, async function () {
  if (!W.relayKey) return false;
  const r = await ask(NAME + '.get', { key: W.relayKey });
  return (r.status === 200 && !!r.body.person && r.body.person.relay === true && !!r.body.relay && typeof r.body.relay === 'object' &&
    Object.prototype.hasOwnProperty.call(r.body, 'report')) || false;
}, test.limit.quick);
test.run('get of a key with no row is refused 404', 0.2, async function () {
  return ((await ask(NAME + '.get', { key: auth.generateIdentity('zzNobody').publicKey })).status === 404) || false;
}, test.limit.quick);
// search.json: "a bounded list of {key: publicKey, label}; a label is the row as JSON: its name, its flags keep, mine, relay,
// blocked and seated, its publicLabel, present, and a relay's url. keep, mine, relay, seated and blocked are yes-filters."
test.run('search with no q answers the one table as {ok, items, more}, each label the row as JSON, its name and flags', 0.2, async function () {
  const r = await ask(NAME + '.search', {});
  const rows = rowsOf(r);
  return (r.status === 200 && r.body.ok === true && typeof r.body.more === 'boolean' && rows.some(function (x) { return x.key === PERSON; }) &&
    rows.every(function (x) { return has(x.row, ['name', 'publicLabel', 'present'].concat(FLAGS)) && FLAGS.every(function (f) { return typeof x.row[f] === 'boolean'; }); })) || false;
}, test.limit.quick);
test.run('search with the relay yes-filter answers relay rows alone, the scratch relay among them with its url', 0.2, async function () {
  const rows = rowsOf(await ask(NAME + '.search', { relay: true }));
  const mine = rows.filter(function (x) { return x.key === W.relayKey; })[0];
  return (rows.length > 0 && rows.every(function (x) { return !!x.row && x.row.relay === true; }) && !!mine && mine.row.url === W.relay.base) || false;
}, test.limit.quick);
test.run('search with the blocked yes-filter answers blocked rows alone', 0.2, async function () {
  const rows = rowsOf(await ask(NAME + '.search', { blocked: true }));
  return (rows.length > 0 && rows.every(function (x) { return !!x.row && x.row.blocked === true; }) && rows.some(function (x) { return x.key === PERSON; })) || false;
}, test.limit.quick);
// unblock.json: "Take the block off a key ... and nothing more; a person blocked while still waiting goes back to waiting, not
// into your contacts: {publicKey, keep, blocked}."
test.run('unblock takes the block off and nothing more: a person never added stays out of the contacts', 0.2, async function () {
  return standing(await ask(NAME + '.unblock', { publicKey: PERSON }), PERSON, false, false) || false;
}, test.limit.quick);
test.run('unblock of this node\'s own key is refused 400', 0.2, async function () {
  return ((await ask(NAME + '.unblock', { publicKey: W.own })).status === 400) || false;
}, test.limit.quick);
// accept.json: "Add a key you already have a row for to your contacts ..., kept and unblocked".
test.run('accept adds a key with a row to the contacts, kept and unblocked', 0.2, async function () {
  return standing(await ask(NAME + '.accept', { publicKey: PERSON }), PERSON, true, false) || false;
}, test.limit.quick);
test.run('accept of this node\'s own key is refused 400', 0.2, async function () {
  return ((await ask(NAME + '.accept', { publicKey: W.own })).status === 400) || false;
}, test.limit.quick);
// label.json: "Set your own name for a key (myLabel) ...; an empty one clears it: {publicKey, myLabel, caption}, the caption
// being what the contact now shows".
test.run('label sets your own name for a key, answering {publicKey, myLabel, caption}, the caption that name', 0.2, async function () {
  const r = await ask(NAME + '.label', { publicKey: PERSON, myLabel: 'Zz Mine' });
  return (r.status === 200 && same(r.body, { publicKey: PERSON, myLabel: 'Zz Mine', caption: 'Zz Mine' })) || false;
}, test.limit.quick);
test.run('label empty clears your name, the caption back to the key\'s own label', 0.2, async function () {
  const r = await ask(NAME + '.label', { publicKey: PERSON, myLabel: '' });
  return (r.status === 200 && same(r.body, { publicKey: PERSON, myLabel: '', caption: 'Zz Person' })) || false;
}, test.limit.quick);
test.run('label of this node\'s own key is refused 400', 0.2, async function () {
  return ((await ask(NAME + '.label', { publicKey: W.own, myLabel: 'Zz' })).status === 400) || false;
}, test.limit.quick);
// faceable.json: "Answers {key, faceable}. ... only when switching it on, 403 not-a-relay for a row that is not a relay and
// 403 no-seat for a relay this node holds no seat on."
test.run('faceable on, for a row that is no relay, is refused 403 not-a-relay', 0.8, async function () {
  const r = await ask(NAME + '.faceable', { key: PERSON, faceable: true });
  return (r.status === 403 && !!r.body && r.body.code === 'not-a-relay') || false;
}, test.limit.quick);
test.run('faceable on, for a relay this node holds no seat on, is refused 403 no-seat', 0.8, async function () {
  if (!W.relayKey) return false;
  const r = await ask(NAME + '.faceable', { key: W.relayKey, faceable: true });
  return (r.status === 403 && !!r.body && r.body.code === 'no-seat') || false;
}, test.limit.quick);
test.run('faceable off answers {key, faceable: false}', 0.2, async function () {
  const r = await ask(NAME + '.faceable', { key: PERSON, faceable: false });
  return (r.status === 200 && same(r.body, { key: PERSON, faceable: false })) || false;
}, test.limit.quick);
// The relay row's verbs (claim.json, face.json, join.json, leave.json): each names the relay by its row's public key.
test.run('claim on the relay\'s row answers the relay\'s own answer under its status, with mine', 0.2, async function () {
  if (!W.relayKey) return false;
  const r = await ask(NAME + '.claim', { key: W.relayKey, name: 'zzseat' });
  return (!!r.status && r.status !== 404 && r.status !== 503 && !!r.body && typeof r.body.mine === 'boolean') || false;
}, test.limit.long, { why: 'the node asks the scratch relay and waits' });
test.run('claim with a key naming no relay row is refused 503', 0.2, async function () {
  return ((await ask(NAME + '.claim', { key: PERSON, name: 'zzseat' })).status === 503) || false;
}, test.limit.quick);
test.run('face on the relay\'s row is the relay\'s answer, a refusal for a node it holds no email of', 0.2, async function () {
  if (!W.relayKey) return false;
  const r = await ask(NAME + '.face', { key: W.relayKey, name: 'zzface' });
  return (r.status >= 400 && r.status !== 404 && !!r.body && !!r.body.error) || false;
}, test.limit.quick);
test.run('face with a key naming no relay on the list is refused 404', 0.2, async function () {
  return ((await ask(NAME + '.face', { key: PERSON, name: 'zzface' })).status === 404) || false;
}, test.limit.quick);
test.run('join by email at a relay that sends no mail is the relay\'s own refusal under its status', 0.2, async function () {
  if (!W.relayKey) return false;
  const r = await ask(NAME + '.join', { key: W.relayKey, email: 'zz@example.com' });
  return (r.status >= 400 && r.status !== 400 && r.status !== 404 && !!r.body && !!r.body.error) || false;
}, test.limit.long, { why: 'the node asks the scratch relay and waits' });
test.run('join with a key naming no relay row is refused 400', 0.2, async function () {
  return ((await ask(NAME + '.join', { key: PERSON, email: 'zz@example.com' })).status === 400) || false;
}, test.limit.quick);
test.run('leave of a relay this node holds no seat on is refused 404', 0.2, async function () {
  if (!W.relayKey) return false;
  return ((await ask(NAME + '.leave', { key: W.relayKey })).status === 404) || false;
}, test.limit.quick);
// forget.json: "Take a key out of your contacts ...: {publicKey, forgotten, stillBlocked}: a blocked key keeps its row and stays
// blocked. A relay's row is first taken off the node's list".
test.run('forget takes a person out, answering {publicKey, forgotten: true, stillBlocked: false}: get then refuses it 404', 0.2, async function () {
  const r = await ask(NAME + '.forget', { publicKey: PERSON });
  const g = await ask(NAME + '.get', { key: PERSON });
  return (r.status === 200 && same(r.body, { publicKey: PERSON, forgotten: true, stillBlocked: false }) && g.status === 404) || false;
}, test.limit.quick);
test.run('forget of a blocked key keeps its row, blocked, answering stillBlocked: true', 0.2, async function () {
  const b = await ask(NAME + '.block', { publicKey: BLOCKED, publicLabel: 'Zz Blocked' });
  const r = await ask(NAME + '.forget', { publicKey: BLOCKED });
  const g = await ask(NAME + '.get', { key: BLOCKED });
  return (b.status === 200 && r.status === 200 && !!r.body && r.body.stillBlocked === true && g.status === 200 && g.body.person.blocked === true) || false;
}, test.limit.quick);
test.run('forget of a relay\'s row takes it off the node\'s list: get then refuses it 404', 0.2, async function () {
  if (!W.relayKey) return false;
  const r = await ask(NAME + '.forget', { publicKey: W.relayKey });
  const g = await ask(NAME + '.get', { key: W.relayKey });
  const listed = rowsOf(await ask(NAME + '.search', { relay: true })).some(function (x) { return x.key === W.relayKey; });
  return (r.status === 200 && !!r.body && r.body.forgotten === true && g.status === 404 && !listed) || false;
}, test.limit.quick);
test.run('forget of this node\'s own key is refused 400', 0.8, async function () {
  return ((await ask(NAME + '.forget', { publicKey: W.own })).status === 400) || false;
}, test.limit.quick);
