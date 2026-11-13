'use strict';

// spirit/run/spirit/test/ownerPost.js
// The tests of spirit/ownerPost.js, and of no other module (spec: ./ownerPost.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
//
// peerOwnerPost(), the owner door's sending end (puppets/G4): one signed command to one puppet, and the puppet's answer
// taken only if it names a command still waiting, comes from that puppet, is the first, and arrives in time. Its
// identity, signing, packing, route, post, timers and clock are handed in: each test plants them, and a timer is kept,
// not run, so the wait is fired by the test.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { createOwnerPost, DEFAULT_WAIT_MS } = require(path.join(RUN, 'spirit', 'ownerPost.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = function () { return new Promise(function (r) { setTimeout(r, 20); }); };
const PUPPET = 'puppet-key';
const SIBLING = 'sibling-key';
// An owner door on planted parts: what it signed, packed and posted is recorded, every timer kept.
function door(extra) {
  const said = { signed: [], packed: [], posted: [], timers: [], cleared: [], t: 1000 };
  const o = Object.assign({
    identity: function () { return { publicKey: 'owner-pub', privateKey: 'owner-priv' }; },
    randomId: function () { return 'id-1'; },
    auth: {
      commandMessage: function (from, to, id, cmd) { return [from, to, id, cmd].join('|'); },
      sign: function (priv, msg) { said.signed.push({ priv: priv, msg: msg }); return 'sig(' + msg + ')'; },
    },
    encode: function (app, body, meta) { said.packed.push({ app: app, body: body, meta: meta }); return { text: 'packet:' + meta.id }; },
    route: function (to) { return { relayUrl: 'https://relay.example' }; },
    post: function (url, to, text) { said.posted.push({ url: url, to: to, text: text }); return Promise.resolve({ ok: true, hash: 'H1' }); },
    setTimeout: function (fn, ms) { said.timers.push({ fn: fn, ms: ms }); return said.timers.length; },
    clearTimeout: function (id) { said.cleared.push(id); },
    now: function () { return said.t; },
  }, extra || {});
  said.door = createOwnerPost(o);
  return said;
}
function answer(re, from, body) { return { fromKey: from, envelope: { app: '', re: re, body: body } }; }

// ── the command sent ──
let A = null, A_GOT = null;
test.run('the world: one command sent to a puppet, and its answer', 0.2, async function () {
  A = door();
  const p = A.door.send(PUPPET, 'fs.search', { q: 'x' });
  await settle();
  A.door.onArrival(answer('H1', PUPPET, { ok: true, items: [1] }));
  A_GOT = await p;
  return A.posted.length === 1 || 'posted ' + A.posted.length;
}, test.limit.quick);
test.run('the command is signed with the owner\'s identity key over the recipient key and envelope id', 0.2, function () {
  if (!A) return 'no command: the world failed';
  const s = A.signed[0] || {};
  return (s.priv === 'owner-priv' && s.msg === 'owner-pub|' + PUPPET + '|id-1|' + JSON.stringify({ verb: 'fs.search', body: { q: 'x' } })) || 'signed: ' + short(s);
}, test.limit.quick);
test.run('it is packed as a system packet, addressed to no app, carrying the command and its signature', 0.2, function () {
  if (!A) return 'no command: the world failed';
  const k = A.packed[0] || {};
  return (k.app === '' && k.meta && k.meta.id === 'id-1' && k.body && k.body.sig && JSON.parse(k.body.cmd).verb === 'fs.search') || 'packed: ' + short(k);
}, test.limit.quick);
test.run('it is posted through the route to that puppet', 0.2, function () {
  if (!A) return 'no command: the world failed';
  const p = A.posted[0] || {};
  return (p.url === 'https://relay.example' && p.to === PUPPET && p.text === 'packet:id-1') || 'posted: ' + short(p);
}, test.limit.quick);
test.run('the puppet\'s answer is handed back as it came, with the command\'s hash, and the wait cleared', 0.2, function () {
  if (!A_GOT) return 'no answer: the world failed';
  return (A_GOT.ok === true && A_GOT.hash === 'H1' && short(A_GOT.items) === '[1]' && A.cleared.length === 1) || 'answer ' + short(A_GOT) + ', cleared ' + short(A.cleared);
}, test.limit.quick);
test.run('a refusal the puppet answered passes through as it came', 0.2, async function () {
  const d = door();
  const p = d.door.send(PUPPET, 'no.such', {});
  await settle();
  d.door.onArrival(answer('H1', PUPPET, { ok: false, status: 404, code: 'no-such-verb' }));
  const got = await p;
  return (got.ok === false && got.code === 'no-such-verb' && got.status === 404) || 'answer: ' + short(got);
}, test.limit.quick);

// ── only the right answer is taken ──
test.run('an answer from a sibling puppet is not taken; the puppet\'s own still is', 0.2, async function () {
  const d = door();
  let done = null;
  const p = d.door.send(PUPPET, 'v', {}).then(function (r) { done = r; return r; });
  await settle();
  d.door.onArrival(answer('H1', SIBLING, { ok: true, from: 'sibling' }));
  await settle();
  if (done) return 'the sibling\'s answer was taken: ' + short(done);
  d.door.onArrival(answer('H1', PUPPET, { ok: true, from: 'puppet' }));
  const got = await p;
  return got.from === 'puppet' || 'answer: ' + short(got);
}, test.limit.quick);
test.run('a reply answers once: a second answer to the same hash is not handed to the next command', 0.2, async function () {
  let n = 0;
  const d = door({ post: function () { n += 1; return Promise.resolve({ ok: true, hash: 'H' + n }); } });
  const p1 = d.door.send(PUPPET, 'v', {});
  await settle();
  d.door.onArrival(answer('H1', PUPPET, { ok: true, n: 1 }));
  d.door.onArrival(answer('H1', PUPPET, { ok: true, n: 'again' }));
  await p1;
  if (d.cleared.length !== 1) return 'the first command was settled ' + d.cleared.length + ' times';
  const p2 = d.door.send(PUPPET, 'v', {});
  await settle();
  d.door.onArrival(answer('H2', PUPPET, { ok: true, n: 2 }));
  const got = await p2;
  return got.n === 2 || 'second command got: ' + short(got);
}, test.limit.quick);
test.run('an app\'s packet, or one naming no command, passes by untouched', 0.2, async function () {
  const d = door();
  let done = null;
  d.door.send(PUPPET, 'v', {}).then(function (r) { done = r; });
  await settle();
  d.door.onArrival({ fromKey: PUPPET, envelope: { app: 'natter', re: 'H1', body: { ok: true } } });
  d.door.onArrival({ fromKey: PUPPET, envelope: { app: '', body: { ok: true } } });
  d.door.onArrival(null);
  await settle();
  return done === null || 'taken: ' + short(done);
}, test.limit.quick);

// ── the wait ──
test.run('the wait is 20 s unless one is given', 0.2, async function () {
  const a = door(), b = door({ waitMs: 1500 });
  a.door.send(PUPPET, 'v', {}); b.door.send(PUPPET, 'v', {});
  await settle();
  return (DEFAULT_WAIT_MS === 20000 && (a.timers[0] || {}).ms === 20000 && (b.timers[0] || {}).ms === 1500) || 'waits: ' + short([DEFAULT_WAIT_MS, a.timers, b.timers]);
}, test.limit.quick);
test.run('no answer in time is a named timeout, 504 no-reply-from-puppet, and a late reply is dropped', 0.2, async function () {
  let n = 0;
  const d = door({ post: function () { n += 1; return Promise.resolve({ ok: true, hash: 'H' + n }); } });
  const p = d.door.send(PUPPET, 'v', {});
  await settle();
  if (!d.timers[0]) return 'no wait was set';
  d.timers[0].fn();
  const got = await p;
  d.door.onArrival(answer('H1', PUPPET, { ok: true, late: true }));
  const p2 = d.door.send(PUPPET, 'v', {});
  await settle();
  d.timers[1].fn();
  const got2 = await p2;
  return (got.ok === false && got.status === 504 && got.code === 'no-reply-from-puppet' && got.hash === 'H1' && got2.code === 'no-reply-from-puppet' && got2.hash === 'H2') || 'answers: ' + short([got, got2]);
}, test.limit.quick);

// ── an answer that beats its own question ──
test.run('an answer arriving before the wait is registered is held, and taken', 0.2, async function () {
  let d = null;
  d = door({ post: function () { d.door.onArrival(answer('H1', PUPPET, { ok: true, early: true })); return Promise.resolve({ ok: true, hash: 'H1' }); } });
  const got = await d.door.send(PUPPET, 'v', {});
  return (got.ok === true && got.early === true) || 'answer: ' + short(got);
}, test.limit.quick);
test.run('an early answer from a sibling, or one held past its time, is not taken', 0.2, async function () {
  let a = null, b = null;
  a = door({ post: function () { a.door.onArrival(answer('H1', SIBLING, { ok: true })); return Promise.resolve({ ok: true, hash: 'H1' }); } });
  b = door({ earlyMs: 100, post: function () { b.door.onArrival(answer('H1', PUPPET, { ok: true })); b.t += 500; return Promise.resolve({ ok: true, hash: 'H1' }); } });
  let doneA = null, doneB = null;
  a.door.send(PUPPET, 'v', {}).then(function (r) { doneA = r; });
  b.door.send(PUPPET, 'v', {}).then(function (r) { doneB = r; });
  await settle();
  return (doneA === null && doneB === null) || 'taken: ' + short([doneA, doneB]);
}, test.limit.quick);

// ── refused on the way there ──
test.run('no puppet or no verb is 400 to required, and nothing is posted', 0.2, async function () {
  const d = door();
  const got = [await d.door.send('', 'v', {}), await d.door.send(PUPPET, '', {})];
  return (got.every(function (g) { return g.ok === false && g.status === 400; }) && d.posted.length === 0) || 'answers: ' + short(got);
}, test.limit.quick);
test.run('a command that cannot be packed says so, with the factory\'s own words', 0.2, async function () {
  const d = door({ encode: function () { return { error: 'too big' }; } });
  const got = await d.door.send(PUPPET, 'v', {});
  return (got.ok === false && got.code === 'command-not-packed' && got.error === 'too big' && d.posted.length === 0) || 'answer: ' + short(got);
}, test.limit.quick);
test.run('no route, or an unreachable one, is 503 peer not reachable', 0.2, async function () {
  const got = [await door({ route: function () { return null; } }).door.send(PUPPET, 'v', {}), await door({ route: function () { return { unreachable: true, relayUrl: 'x' }; } }).door.send(PUPPET, 'v', {})];
  return got.every(function (g) { return g.status === 503 && g.error === 'peer not reachable'; }) || 'answers: ' + short(got);
}, test.limit.quick);
test.run('a post refused on the way keeps its own answer, and no wait is set', 0.2, async function () {
  const d = door({ post: function () { return Promise.resolve({ ok: false, status: 502, error: 'relay said no' }); } });
  const got = await d.door.send(PUPPET, 'v', {});
  return (got.status === 502 && got.error === 'relay said no' && d.timers.length === 0) || 'answer ' + short(got) + ', timers ' + d.timers.length;
}, test.limit.quick);
