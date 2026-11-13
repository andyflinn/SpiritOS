'use strict';

// spirit/run/spirit/test/answerRelay.js
// The tests of spirit/answerRelay.js, and of no other module (spec: ./answerRelay.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
//
// createAnswerer(opts): what this node knows about the relays it talks to: each one's key, from its signed key
// statement, pinned on first use (relayKeys.js) and refused when it changes, and the key a post to it is sealed to.
// The relay's answer is planted (askKey), the pin lives in a scratch folder, and the statements are signed in process.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { createAnswerer } = require(path.join(RUN, 'spirit', 'answerRelay.js'));
const auth = require(path.join(RUN, 'spirit', 'relayAuth.js'));
const relayKeys = require(path.join(RUN, 'spirit', 'relayKeys.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// A relay's key statement, signed by the identity it names, over both keys and the label (cycle 10, R9).
function statement(id, label) {
  return { relayPublicKey: id.publicKey, relaySealKey: id.sealPublicKey, relayLabel: label, keySig: auth.sign(id.privateKey, auth.relayKeyMessage(id.publicKey, id.sealPublicKey, label)) };
}
// An answerer on root whose relay answers what `answers[url]` holds (a function may reject), counting each ask.
function answerer(root, answers, extra) {
  const said = { asked: [], changed: [] };
  said.a = createAnswerer(Object.assign({
    rootDir: root,
    askKey: function (url) { said.asked.push(url); const a = answers[url]; return typeof a === 'function' ? a() : Promise.resolve(a); },
    onKeyChanged: function (url, was, now) { said.changed.push({ url: url, was: was, now: now }); },
  }, extra || {}));
  return said;
}
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-answerrelay-'));
const URL_A = 'https://relay-a.example';
const URL_B = 'https://relay-b.example';
const A = auth.generateIdentity('relay-a');
const A2 = auth.generateIdentity('relay-a-rebuilt');
const B = auth.generateIdentity('relay-b');

// ── first use: the key, pinned ──
let W = null;
let got = null;
test.run('the world: a relay never met answers its signed key statement', 0.2, async function () {
  W = answerer(ROOT, { [URL_A]: statement(A, 'a'), [URL_B]: statement(B, 'b') });
  got = await W.a.relayKey(URL_A);
  return W.asked.length === 1 || 'asked ' + short(W.asked);
}, test.limit.quick);
test.run('relayKey answers the relay\'s own public key', 0.2, function () {
  if (!W) return 'no answerer: the world failed';
  return got === A.publicKey || 'relayKey: ' + short(got);
}, test.limit.quick);
test.run('trust on first use: a relay nobody has met is accepted and its key pinned on disc', 0.2, function () {
  if (!W) return 'no answerer: the world failed';
  return relayKeys.pinned(ROOT, URL_A) === A.publicKey || 'pinned: ' + short(relayKeys.pinned(ROOT, URL_A));
}, test.limit.quick);
test.run('one fetch per run: asked again, it answers the same key without asking the relay', 0.2, async function () {
  if (!W) return 'no answerer: the world failed';
  const again = await W.a.relayKey(URL_A);
  return (again === A.publicKey && W.asked.length === 1) || 'answered ' + short(again) + ', asked ' + W.asked.length + ' times';
}, test.limit.quick);
test.run('relaySealKey answers the key a post to that relay is sealed to, from the same signed answer', 0.2, function () {
  if (!W) return 'no answerer: the world failed';
  return W.a.relaySealKey(URL_A) === A.sealPublicKey || 'relaySealKey: ' + short(W.a.relaySealKey(URL_A));
}, test.limit.quick);
test.run('relaySealKeyByKey answers the same seal key, asked by the relay\'s identity', 0.2, function () {
  if (!W) return 'no answerer: the world failed';
  return W.a.relaySealKeyByKey(A.publicKey) === A.sealPublicKey || 'relaySealKeyByKey: ' + short(W.a.relaySealKeyByKey(A.publicKey));
}, test.limit.quick);
test.run('a seal key is never learned on its own: a relay not yet asked, an unknown key and no key answer nothing', 0.2, function () {
  if (!W) return 'no answerer: the world failed';
  const r = [W.a.relaySealKey(URL_B), W.a.relaySealKeyByKey(B.publicKey), W.a.relaySealKeyByKey(''), W.a.relaySealKeyByKey(null)];
  return r.every(function (x) { return x === ''; }) || 'answered ' + short(r);
}, test.limit.quick);

// ── an answer that does not verify yields no key at all ──
test.run('a statement whose seal key was swapped after signing yields no key, no pin and no seal key', 0.2, async function () {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-answerrelay-'));
  const forged = Object.assign(statement(A, 'a'), { relaySealKey: B.sealPublicKey });
  const s = answerer(root, { [URL_A]: forged });
  const k = await s.a.relayKey(URL_A);
  return (k === '' && !relayKeys.pinned(root, URL_A) && s.a.relaySealKey(URL_A) === '' && s.a.relaySealKeyByKey(A.publicKey) === '') || 'key ' + short(k) + ', pinned ' + short(relayKeys.pinned(root, URL_A)) + ', seal ' + short(s.a.relaySealKey(URL_A));
}, test.limit.quick);
test.run('an unsigned statement, one with its label changed, and one with no key each yield no key', 0.2, async function () {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-answerrelay-'));
  const unsigned = statement(A, 'a'); delete unsigned.keySig;
  const relabelled = Object.assign(statement(A, 'a'), { relayLabel: 'not-a' });
  const s = answerer(root, { 'https://u.example': unsigned, 'https://l.example': relabelled, 'https://n.example': { ok: true } });
  const r = [await s.a.relayKey('https://u.example'), await s.a.relayKey('https://l.example'), await s.a.relayKey('https://n.example')];
  return r.every(function (x) { return x === ''; }) || 'keys: ' + short(r);
}, test.limit.quick);
test.run('a relay that does not answer (askKey rejects or throws) yields no key, and relayKey never rejects', 0.2, async function () {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-answerrelay-'));
  const s = answerer(root, { 'https://down.example': function () { return Promise.reject(new Error('ECONNREFUSED')); }, 'https://boom.example': function () { throw new Error('boom'); } });
  let r;
  try { r = [await s.a.relayKey('https://down.example'), await s.a.relayKey('https://boom.example')]; }
  catch (e) { return 'relayKey rejected: ' + short(e && e.message); }
  return r.every(function (x) { return x === ''; }) || 'keys: ' + short(r);
}, test.limit.quick);

// ── a restart: the pin outlives the process, and is re-checked ──
test.run('after a restart the relay is asked again, though its key is pinned: the re-check is once per process', 0.2, async function () {
  if (!W) return 'no answerer: the world failed';
  const s = answerer(ROOT, { [URL_A]: statement(A, 'a') });
  const k = await s.a.relayKey(URL_A);
  return (k === A.publicKey && s.asked.length === 1) || 'key ' + short(k) + ', asked ' + s.asked.length + ' times';
}, test.limit.quick);
let R = null;
let rk = null;
test.run('a relay answering with another key than the pin is refused: no key', 0.2, async function () {
  if (!W) return 'no answerer: the world failed';
  R = answerer(ROOT, { [URL_A]: statement(A2, 'a') });
  rk = await R.a.relayKey(URL_A);
  return rk === '' || 'the changed key was answered: ' + short(rk);
}, test.limit.quick);
test.run('the refusal is said out loud: onKeyChanged(url, the pinned key, the key answered)', 0.2, function () {
  if (!R) return 'no answerer: the world failed';
  const c = R.changed[0] || {};
  return (R.changed.length === 1 && c.url === URL_A && c.was === A.publicKey && c.now === A2.publicKey) || 'onKeyChanged: ' + short(R.changed);
}, test.limit.quick);
test.run('a refusal never moves the pin: only a deliberate accept does', 0.2, function () {
  if (!R) return 'no answerer: the world failed';
  return relayKeys.pinned(ROOT, URL_A) === A.publicKey || 'pinned: ' + short(relayKeys.pinned(ROOT, URL_A));
}, test.limit.quick);
test.run('a refused relay stays refused: asked again, still no key, and nothing to seal to by its key', 0.2, async function () {
  if (!R) return 'no answerer: the world failed';
  const again = await R.a.relayKey(URL_A);
  const seal = [R.a.relaySealKeyByKey(A2.publicKey), R.a.relaySealKeyByKey(A.publicKey)];
  return (again === '' && seal.every(function (x) { return x === ''; })) || 'key ' + short(again) + ', seal keys ' + short(seal);
}, test.limit.quick);
// Red on the code as it stands: fetchKey records sealOf[url] before relayKey's pin check, so a relay refused for a
// changed key still has the substitute's seal key answered by url (answerRelay.js, fetchKey: "sealOf[url] = ...").
test.run('a refused relay has nothing to seal to by its url either: relaySealKey answers no key for it', 0.2, function () {
  if (!R) return 'no answerer: the world failed';
  const k = R.a.relaySealKey(URL_A);
  return k === '' || 'relaySealKey answers the refused relay\'s seal key: ' + short(k);
}, test.limit.quick);
test.run('onKeyChanged is a witness, never a participant: one that throws changes nothing', 0.2, async function () {
  if (!W) return 'no answerer: the world failed';
  const s = answerer(ROOT, { [URL_A]: statement(A2, 'a') }, { onKeyChanged: function () { throw new Error('the panel broke'); } });
  let k;
  try { k = await s.a.relayKey(URL_A); } catch (e) { return 'relayKey rejected: ' + short(e && e.message); }
  return (k === '' && relayKeys.pinned(ROOT, URL_A) === A.publicKey) || 'key ' + short(k);
}, test.limit.quick);
test.run('with no onKeyChanged given, a changed key is still refused', 0.2, async function () {
  if (!W) return 'no answerer: the world failed';
  const s = answerer(ROOT, { [URL_A]: statement(A2, 'a') }, { onKeyChanged: undefined });
  const k = await s.a.relayKey(URL_A);
  return k === '' || 'key ' + short(k);
}, test.limit.quick);
