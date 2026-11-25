'use strict';

// spirit/run/spirit/limits/test/script.js
// The tests of spirit/limits/script.js, and of no other module (spec: ./script.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
//
// How big a thing may be, in one place (Andy: "the redundant package-size limits must be collapsed to one PAYLOAD_MAX").
// The chosen constants, the derived ones checked by their formula, and the derived seal ceiling checked against what
// spirit/seal/script.js really puts on the wire (Andy, 2026-09-26: "figure out the correct formula, and test it."). In process.

const path = require('path');
const crypto = require('crypto');
const RUN = path.resolve(__dirname, '..', '..', '..');
const S = require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/test/testReport.js');
const L = S.requireScript('spirit/limits/script.js');
const seal = S.requireScript('spirit/seal/script.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const K = crypto.generateKeyPairSync('x25519');
const PUB = K.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const KEY = 'MCowBQYDK2VwAyEA+4mt2XtbJHPmiyCri6HRaA/PyH4EPGYE/ez+YpE72Ls=';
// What a text costs on the wire once sealed, measured off the real seal.
function wire(text) { return JSON.stringify(seal.seal(PUB, KEY, KEY, text)).length; }

// ── the chosen constants ──
test.run('the chosen bounds are a plaintext maximum of 16384, a payload maximum of 22528, a measured overhead of 246 and a headroom of 512', 0.2, function () {
  const got = [L.PLAINTEXT_MAX, L.PAYLOAD_MAX, L.WIRE_OVERHEAD, L.WIRE_HEADROOM, L.SEAL_ENVELOPE];
  return short(got) === short([16384, 22528, 246, 512, 185]) || false;
}, test.limit.quick);

// ── the derived ones, by their formula ──
test.run('the body maximum is the payload maximum plus the headroom, with no room for route hints', 0.2, function () {
  return L.BODY_MAX === L.PAYLOAD_MAX + L.WIRE_HEADROOM || false;
}, test.limit.quick);
test.run('the stream event maximum is six times the payload maximum plus the headroom, and the stream backlog maximum is two of them', 0.2, function () {
  return (L.STREAM_EVENT_MAX === 6 * L.PAYLOAD_MAX + L.WIRE_HEADROOM && L.STREAM_BACKLOG_MAX === 2 * L.STREAM_EVENT_MAX) || false;
}, test.limit.quick);
test.run('the sealed maximum comes from the payload maximum, the floor taken outside the multiply; the answer maximum is half of it', 0.2, function () {
  return (L.SEALED_MAX === 3 * Math.floor((L.PAYLOAD_MAX - L.SEAL_ENVELOPE) / 4) && L.ANSWER_MAX === Math.floor(L.SEALED_MAX / 2)) || false;
}, test.limit.quick);

// ── the formula against the real seal ──
test.run('on real seal output the wire size is four times the rounded-up third of the JSON text\'s UTF-8 bytes, plus the seal envelope', 0.2, function () {
  const texts = ['', 'a', 'ab', 'abc', 'abcd', 'quote " back \\ line \n tab \t', 'accentué', '日本語', '😀😀', 'x'.repeat(5000)];
  const off = texts.filter(function (t) { return wire(t) !== 4 * Math.ceil(Buffer.byteLength(JSON.stringify(t), 'utf8') / 3) + L.SEAL_ENVELOPE; });
  return off.length === 0 || false;
}, test.limit.quick);
test.run('the sealed maximum is the exact ceiling: the largest text it allows seals within the payload maximum, one byte more does not', 0.2, function () {
  const fits = 'x'.repeat(L.SEALED_MAX - 2);     // its JSON is SEALED_MAX bytes
  const over = 'x'.repeat(L.SEALED_MAX - 1);
  return (wire(fits) <= L.PAYLOAD_MAX && wire(over) > L.PAYLOAD_MAX) || false;
}, test.limit.quick);
test.run('fitsSealed measures escaped UTF-8 bytes, not characters, saying yes at the ceiling and no one byte past it', 0.2, function () {
  const got = [L.fitsSealed('x'.repeat(L.SEALED_MAX - 2)), L.fitsSealed('x'.repeat(L.SEALED_MAX - 1)), L.fitsSealed('日'.repeat(6000)), L.fitsSealed(undefined)];
  return short(got) === short([true, false, false, true]) || false;
}, test.limit.quick);
test.run('a full plaintext maximum of ASCII seals within the payload maximum, so the promise apps were written against still travels', 0.2, function () {
  const w = wire('x'.repeat(L.PLAINTEXT_MAX));
  return w <= L.PAYLOAD_MAX || false;
}, test.limit.quick);

// ── fitsWrapped, fitsWrappedReply ──
test.run('fitsWrapped builds the forward wrapper and measures it against the payload maximum, counting escaping', 0.2, function () {
  const wrap = JSON.stringify({ v: 1, body: { forward: { from: 'f', to: 't', text: '', sig: 's' } } }).length;
  const room = L.PAYLOAD_MAX - wrap;
  const got = [L.fitsWrapped('x'.repeat(room), 'f', 't', 's'), L.fitsWrapped('x'.repeat(room + 1), 'f', 't', 's'), L.fitsWrapped('"'.repeat(Math.ceil(room / 2) + 1), 'f', 't', 's')];
  return short(got) === short([true, false, false]) || false;
}, test.limit.quick);
test.run('fitsWrappedReply builds the reply wrapper and measures it against the payload maximum the same way', 0.2, function () {
  const wrap = JSON.stringify({ v: 1, body: { ok: true, status: 200, forwarded: { from: 'f', text: '', sig: 's' } } }).length;
  const room = L.PAYLOAD_MAX - wrap;
  const got = [L.fitsWrappedReply('x'.repeat(room), 'f', 's'), L.fitsWrappedReply('x'.repeat(room + 1), 'f', 's')];
  return short(got) === short([true, false]) || false;
}, test.limit.quick);

// ── boundedGet (goal/G29.22: "Everything, everywhere that goes out, is bounded by MAX_PAYLOAD") ──
test.run('boundedGet answers an entry that fits unchanged', 0.2, function () {
  const a = { ok: true, value: 'small' };
  return L.boundedGet(a, 100) === a || false;
}, test.limit.quick);
test.run('boundedGet refuses an entry too big by name, with its size in bytes, and never cuts it', 0.2, function () {
  const a = { value: 'é'.repeat(60) };
  const bytes = Buffer.byteLength(JSON.stringify(a), 'utf8');
  const r = L.boundedGet(a, 100);
  return (r.ok === false && r.status === 413 && r.code === 'answer-too-large' && r.bytes === bytes && !('value' in r)) || false;
}, test.limit.quick);
test.run('boundedGet with no cap given bounds at the plaintext maximum', 0.2, function () {
  const under = { v: 'x'.repeat(L.PLAINTEXT_MAX - 20) };
  const over = { v: 'x'.repeat(L.PLAINTEXT_MAX) };
  return (L.boundedGet(under) === under && L.boundedGet(over).code === 'answer-too-large') || false;
}, test.limit.quick);
