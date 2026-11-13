'use strict';

// spirit/run/spirit/test/limits.js
// The tests of spirit/limits.js, and of no other module (spec: ./limits.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
//
// How big a thing may be, in one place (Andy: "the redundant package-size limits must be collapsed to one PAYLOAD_MAX").
// The chosen constants, the derived ones checked by their formula, and the derived seal ceiling checked against what
// spirit/seal.js really puts on the wire (Andy, 2026-09-26: "figure out the correct formula, and test it."). In process.

const path = require('path');
const crypto = require('crypto');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const L = require(path.join(RUN, 'spirit', 'limits.js'));
const seal = require(path.join(RUN, 'spirit', 'seal.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const K = crypto.generateKeyPairSync('x25519');
const PUB = K.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const KEY = 'MCowBQYDK2VwAyEA+4mt2XtbJHPmiyCri6HRaA/PyH4EPGYE/ez+YpE72Ls=';
// What a text costs on the wire once sealed, measured off the real seal.
function wire(text) { return JSON.stringify(seal.seal(PUB, KEY, KEY, text)).length; }

// ── the chosen constants ──
test.run('the chosen bounds: PLAINTEXT_MAX 16384, PAYLOAD_MAX 22528, overhead measured 246, headroom 512 (Andy: "let\'s say 512 bytes")', 0.2, function () {
  const got = [L.PLAINTEXT_MAX, L.PAYLOAD_MAX, L.WIRE_OVERHEAD, L.WIRE_HEADROOM, L.SEAL_ENVELOPE];
  return short(got) === short([16384, 22528, 246, 512, 185]) || 'constants: ' + short(got);
}, test.limit.quick);

// ── the derived ones, by their formula ──
test.run('BODY_MAX is PAYLOAD_MAX plus the headroom, with no room for route hints (goal/G47.1, box v69)', 0.2, function () {
  return L.BODY_MAX === L.PAYLOAD_MAX + L.WIRE_HEADROOM || 'BODY_MAX ' + L.BODY_MAX;
}, test.limit.quick);
test.run('STREAM_EVENT_MAX is six times the payload plus headroom; the backlog two of them (R35)', 0.2, function () {
  return (L.STREAM_EVENT_MAX === 6 * L.PAYLOAD_MAX + L.WIRE_HEADROOM && L.STREAM_BACKLOG_MAX === 2 * L.STREAM_EVENT_MAX) || 'stream: ' + short([L.STREAM_EVENT_MAX, L.STREAM_BACKLOG_MAX]);
}, test.limit.quick);
test.run('SEALED_MAX is derived from PAYLOAD_MAX, floor outside the multiply; ANSWER_MAX half of it', 0.2, function () {
  return (L.SEALED_MAX === 3 * Math.floor((L.PAYLOAD_MAX - L.SEAL_ENVELOPE) / 4) && L.ANSWER_MAX === Math.floor(L.SEALED_MAX / 2)) || 'sealed ' + L.SEALED_MAX + ', answer ' + L.ANSWER_MAX;
}, test.limit.quick);

// ── the formula against the real seal ──
test.run('the seal formula holds on real seal output: wire = 4 * ceil(utf8(JSON text) / 3) + SEAL_ENVELOPE', 0.2, function () {
  const texts = ['', 'a', 'ab', 'abc', 'abcd', 'quote " back \\ line \n tab \t', 'accentué', '日本語', '😀😀', 'x'.repeat(5000)];
  const off = texts.filter(function (t) { return wire(t) !== 4 * Math.ceil(Buffer.byteLength(JSON.stringify(t), 'utf8') / 3) + L.SEAL_ENVELOPE; });
  return off.length === 0 || 'the formula is off for ' + short(off.map(function (t) { return t.slice(0, 20); }));
}, test.limit.quick);
test.run('SEALED_MAX is the exact ceiling: the largest text it allows seals within PAYLOAD_MAX, one byte more does not', 0.2, function () {
  const fits = 'x'.repeat(L.SEALED_MAX - 2);     // its JSON is SEALED_MAX bytes
  const over = 'x'.repeat(L.SEALED_MAX - 1);
  return (wire(fits) <= L.PAYLOAD_MAX && wire(over) > L.PAYLOAD_MAX) || 'sealed ' + wire(fits) + ' and ' + wire(over) + ' against ' + L.PAYLOAD_MAX;
}, test.limit.quick);
test.run('fitsSealed measures escaped UTF-8 bytes, not characters: at the ceiling yes, one more no', 0.2, function () {
  const got = [L.fitsSealed('x'.repeat(L.SEALED_MAX - 2)), L.fitsSealed('x'.repeat(L.SEALED_MAX - 1)), L.fitsSealed('日'.repeat(6000)), L.fitsSealed(undefined)];
  return short(got) === short([true, false, false, true]) || 'fitsSealed: ' + short(got);
}, test.limit.quick);
test.run('a PLAINTEXT_MAX of ASCII seals within PAYLOAD_MAX: the promise apps were written against still travels', 0.2, function () {
  const w = wire('x'.repeat(L.PLAINTEXT_MAX));
  return w <= L.PAYLOAD_MAX || 'sealed to ' + w;
}, test.limit.quick);

// ── fitsWrapped, fitsWrappedReply ──
test.run('fitsWrapped: the forward wrapper is built and measured against PAYLOAD_MAX, escaping counted', 0.2, function () {
  const wrap = JSON.stringify({ v: 1, body: { forward: { from: 'f', to: 't', text: '', sig: 's' } } }).length;
  const room = L.PAYLOAD_MAX - wrap;
  const got = [L.fitsWrapped('x'.repeat(room), 'f', 't', 's'), L.fitsWrapped('x'.repeat(room + 1), 'f', 't', 's'), L.fitsWrapped('"'.repeat(Math.ceil(room / 2) + 1), 'f', 't', 's')];
  return short(got) === short([true, false, false]) || 'fitsWrapped: ' + short(got);
}, test.limit.quick);
test.run('fitsWrappedReply: the reply wrapper, the same', 0.2, function () {
  const wrap = JSON.stringify({ v: 1, body: { ok: true, status: 200, forwarded: { from: 'f', text: '', sig: 's' } } }).length;
  const room = L.PAYLOAD_MAX - wrap;
  const got = [L.fitsWrappedReply('x'.repeat(room), 'f', 's'), L.fitsWrappedReply('x'.repeat(room + 1), 'f', 's')];
  return short(got) === short([true, false]) || 'fitsWrappedReply: ' + short(got);
}, test.limit.quick);

// ── boundedGet (goal/G29.22: "Everything, everywhere that goes out, is bounded by MAX_PAYLOAD") ──
test.run('boundedGet answers an entry that fits unchanged', 0.2, function () {
  const a = { ok: true, value: 'small' };
  return L.boundedGet(a, 100) === a || 'boundedGet changed a fitting answer';
}, test.limit.quick);
test.run('boundedGet refuses one too big by name, with its size in bytes, never cut', 0.2, function () {
  const a = { value: 'é'.repeat(60) };
  const bytes = Buffer.byteLength(JSON.stringify(a), 'utf8');
  const r = L.boundedGet(a, 100);
  return (r.ok === false && r.status === 413 && r.code === 'answer-too-large' && r.bytes === bytes && !('value' in r)) || 'boundedGet: ' + short(r);
}, test.limit.quick);
test.run('boundedGet with no cap given bounds at PLAINTEXT_MAX', 0.2, function () {
  const under = { v: 'x'.repeat(L.PLAINTEXT_MAX - 20) };
  const over = { v: 'x'.repeat(L.PLAINTEXT_MAX) };
  return (L.boundedGet(under) === under && L.boundedGet(over).code === 'answer-too-large') || 'boundedGet: ' + short(L.boundedGet(over));
}, test.limit.quick);
