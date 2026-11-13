'use strict';

// spirit/run/spirit/test/seal.js
// The tests of spirit/seal.js, and of no other module (spec: ./seal.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v71, 8: seal was red in the garbage rule because it had none).
//
// What the relay carries and cannot read (cycle 10, R4): seal, open, isSealed. Pure: keys and bytes in and out, so each
// test makes its own X25519 keys in process.

const path = require('path');
const crypto = require('crypto');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const S = require(path.join(RUN, 'spirit', 'seal.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// A seal keypair as identity.json holds one: spki and pkcs8 DER, base64.
function sealKeys() {
  const k = crypto.generateKeyPairSync('x25519');
  return { pub: k.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'), priv: k.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64') };
}
const BOB = sealKeys();
const EVE = sealKeys();
const FROM = 'alice-signing-key';
const TO = 'bob-signing-key';
const TEXT = 'meet me at the quokka, 9 sharp';
const AT = new Date('2026-11-13T09:00:00.000Z');
const W = S.seal(BOB.pub, FROM, TO, TEXT, AT);

// ── sealed, opened ──
test.run('seal answers the wire object: sealed 1, the throwaway key, the nonce, the ciphertext', 0.2, function () {
  return (!!W && W.sealed === 1 && typeof W.e === 'string' && typeof W.n === 'string' && typeof W.c === 'string' && Buffer.from(W.n, 'base64').length === 12) || 'sealed: ' + short(W);
}, test.limit.quick);
test.run('what is carried does not hold the text', 0.2, function () {
  const wire = JSON.stringify(W) + Buffer.from(W.c, 'base64').toString('latin1');
  return (wire.indexOf(TEXT) === -1 && wire.indexOf('quokka') === -1) || 'the text is readable on the wire';
}, test.limit.quick);
test.run('the recipient opens it: the text, and the time it was sealed', 0.2, function () {
  const o = S.open(BOB.priv, FROM, TO, W);
  return (!!o && o.text === TEXT && o.at === AT.toISOString()) || 'opened: ' + short(o);
}, test.limit.quick);
test.run('it opens from its JSON text as well', 0.2, function () {
  const o = S.open(BOB.priv, FROM, TO, JSON.stringify(W));
  return (!!o && o.text === TEXT) || 'opened: ' + short(o);
}, test.limit.quick);
test.run('with no time given, the time sealed is now', 0.2, function () {
  const before = Date.now();
  const o = S.open(BOB.priv, FROM, TO, S.seal(BOB.pub, FROM, TO, 'x'));
  const at = o ? Date.parse(o.at) : NaN;
  return (at >= before - 1000 && at <= Date.now() + 1000) || 'at ' + short(o && o.at);
}, test.limit.quick);
test.run('each seal is its own: the same text twice gives another throwaway key, nonce and ciphertext', 0.2, function () {
  const again = S.seal(BOB.pub, FROM, TO, TEXT, AT);
  return (again.e !== W.e && again.n !== W.n && again.c !== W.c) || 'the second seal repeats the first';
}, test.limit.quick);

// ── refused: null, for every failure ──
test.run('another key cannot open it', 0.2, function () {
  return S.open(EVE.priv, FROM, TO, W) === null || 'eve opened it';
}, test.limit.quick);
test.run('re-addressed, it does not open: another sender, or another recipient', 0.2, function () {
  const got = [S.open(BOB.priv, 'eve-signing-key', TO, W), S.open(BOB.priv, FROM, 'eve-signing-key', W)];
  return (got[0] === null && got[1] === null) || 'opened: ' + short(got);
}, test.limit.quick);
test.run('a ciphertext changed by one byte does not open', 0.2, function () {
  const raw = Buffer.from(W.c, 'base64');
  raw[0] ^= 1;
  return S.open(BOB.priv, FROM, TO, Object.assign({}, W, { c: raw.toString('base64') })) === null || 'a changed ciphertext opened';
}, test.limit.quick);
test.run('a changed nonce or throwaway key does not open', 0.2, function () {
  const n = Buffer.from(W.n, 'base64'); n[0] ^= 1;
  const got = [S.open(BOB.priv, FROM, TO, Object.assign({}, W, { n: n.toString('base64') })), S.open(BOB.priv, FROM, TO, Object.assign({}, W, { e: sealKeys().pub }))];
  return (got[0] === null && got[1] === null) || 'opened: ' + short(got);
}, test.limit.quick);
test.run('a ciphertext too short to hold its tag does not open', 0.2, function () {
  return S.open(BOB.priv, FROM, TO, Object.assign({}, W, { c: Buffer.alloc(16).toString('base64') })) === null || 'opened';
}, test.limit.quick);
test.run('no key, nothing sealed, or bad JSON opens nothing', 0.2, function () {
  const got = [S.open('', FROM, TO, W), S.open(BOB.priv, FROM, TO, { text: TEXT }), S.open(BOB.priv, FROM, TO, '{not json')];
  return got.every(function (x) { return x === null; }) || 'opened: ' + short(got);
}, test.limit.quick);
test.run('seal refuses, null, with no recipient key, a bad one, or no sender or recipient named: never a plaintext', 0.2, function () {
  const got = [S.seal('', FROM, TO, TEXT), S.seal('bm90IGEga2V5', FROM, TO, TEXT), S.seal(BOB.pub, '', TO, TEXT), S.seal(BOB.pub, FROM, '', TEXT)];
  return got.every(function (x) { return x === null; }) || 'sealed: ' + short(got);
}, test.limit.quick);

// ── isSealed ──
test.run('isSealed: a seal, as an object or its JSON, is sealed', 0.2, function () {
  return (S.isSealed(W) === true && S.isSealed(JSON.stringify(W)) === true) || 'isSealed: ' + short([S.isSealed(W), S.isSealed(JSON.stringify(W))]);
}, test.limit.quick);
test.run('isSealed: a plain text, a card-like object, a seal missing a part, and bad JSON are not', 0.2, function () {
  const got = ['hello', { card: 1 }, { sealed: 1, e: W.e, n: W.n }, { sealed: 2, e: W.e, n: W.n, c: W.c }, '{x', null].map(S.isSealed);
  return got.every(function (x) { return x === false; }) || 'isSealed: ' + short(got);
}, test.limit.quick);
test.run('LABEL names the construction and its version', 0.2, function () {
  return S.LABEL === 'spirit-seal-v1' || 'LABEL: ' + short(S.LABEL);
}, test.limit.quick);
