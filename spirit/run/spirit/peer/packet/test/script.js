'use strict';

// spirit/run/spirit/peer/packet/test/script.js
// The tests of spirit/peer/packet/script.js, and of no other module (spec: ./script.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
//
// One door for every app: the envelope { app, v, id, body, re } lives inside the relay's `text`, so the wire does not
// change. Encode, decode, decorate, isEnvelope, randomId; the bound it enforces is asked of spirit/limits/script.js, never
// restated. Pure and dual target: driven in node, and loaded in a window of its own (vm) as a page loads it.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/peer/packet/script.js';
const FILE = path.join(RUN, SUBJECT);
const P = LOADER.requireScript(SUBJECT);
const limits = LOADER.requireScript('spirit/limits/script.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function bytes(s) { return Buffer.byteLength(String(s), 'utf8'); }
// What the composer measures: the text as the node will escape it before sealing.
function sealedBytes(text) { return bytes(JSON.stringify(text)); }

// ── what it says about itself ──
test.run('VERSION is 1 and an id is 16 bytes', 0.2, function () {
  return (P.VERSION === 1 && P.ID_BYTES === 16) || false;
}, test.limit.quick);
test.run('the text bound it exports, MAX_TEXT, is the bound it enforces, asked of limits.js as SEALED_MAX and never restated', 0.2, function () {
  return (typeof limits.SEALED_MAX === 'number' && P.MAX_TEXT === limits.SEALED_MAX) || false;
}, test.limit.quick);

// ── randomId ──
test.run('randomId gives 128 bits from a secure source as 32 hex characters, each id its own', 0.2, function () {
  const ids = [P.randomId(), P.randomId(), P.randomId()];
  const hex = ids.every(function (x) { return /^[0-9a-f]{32}$/.test(x); });
  return (hex && ids[0] !== ids[1] && ids[1] !== ids[2]) || false;
}, test.limit.quick);
test.run('randomId with the test seam gives a predictable 32-character string', 0.2, function () {
  const a = P.randomId(function () { return 0.5; });
  const b = P.randomId(function () { return 0.5; });
  return (a === b && a.length === 32) || false;
}, test.limit.quick);

// ── encode ──
test.run('encode wraps a body as a text holding exactly app, v, id and body', 0.2, function () {
  const r = P.encode('relay-chat', 'hello', { id: 'ID1' });
  return (r.ok === true && r.text === '{"app":"relay-chat","v":1,"id":"ID1","body":"hello"}' && r.envelope.body === 'hello') || false;
}, test.limit.quick);
test.run('encode mints a fresh secure id when none is given', 0.2, function () {
  const a = P.encode('chat', 'x'); const b = P.encode('chat', 'x');
  return (/^[0-9a-f]{32}$/.test(a.envelope.id) && a.envelope.id !== b.envelope.id) || false;
}, test.limit.quick);
test.run('an app is optional: a packet for a box has no app at all, omitted, not emptied', 0.2, function () {
  const r = [P.encode('', { search: 1 }, { id: 'I' }), P.encode(null, { search: 1 }, { id: 'I' }), P.encode('  ', { search: 1 }, { id: 'I' })];
  return r.every(function (x) { return x.ok && x.text === '{"v":1,"id":"I","body":{"search":1}}'; }) || false;
}, test.limit.quick);
test.run('re, the request hash a packet regards, rides in the envelope when given', 0.2, function () {
  const r = P.encode('chat', 'x', { id: 'I', re: 'hash1' });
  return r.text === '{"app":"chat","v":1,"id":"I","body":"x","re":"hash1"}' || false;
}, test.limit.quick);
test.run('a packet that regards nothing is byte-for-byte what it was before re existed: no re field', 0.2, function () {
  const r = [P.encode('chat', 'x', { id: 'I' }), P.encode('chat', 'x', { id: 'I', re: '' }), P.encode('chat', 'x', { id: 'I', re: null })];
  return r.every(function (x) { return x.text === '{"app":"chat","v":1,"id":"I","body":"x"}'; }) || false;
}, test.limit.quick);
test.run('encode refuses a missing body, and a body with a cycle in it', 0.2, function () {
  const cyc = {}; cyc.self = cyc;
  const r = [P.encode('chat', undefined), P.encode('chat', cyc)];
  return (r[0].ok === false && r[0].error === 'body required' && r[1].ok === false && r[1].error === 'body is not serialisable') || false;
}, test.limit.quick);
// JSON.stringify drops a function body without a word; answered ok, its text would have no body, which isEnvelope says
// is no envelope (it would arrive as a legacy chat line). The code's own comment names
// the refusal: "A body with a cycle in it, or something JSON cannot express" is "body is not serialisable".
test.run('encode refuses a body JSON cannot express, such as a function, so it never makes a text its own isEnvelope rejects', 0.2, function () {
  const r = P.encode('chat', function () {});
  return (r.ok === false && r.error === 'body is not serialisable') || false;
}, test.limit.quick);

// ── the bound that decides: sealed bytes ──
test.run('a packet whose sealed bytes are exactly the limit is taken; one byte more is refused', 0.2, function () {
  const base = sealedBytes(P.encode('chat', '', { id: 'I' }).text);
  const n = P.MAX_TEXT - base;
  const at = P.encode('chat', 'a'.repeat(n), { id: 'I' });
  const over = P.encode('chat', 'a'.repeat(n + 1), { id: 'I' });
  return (at.ok === true && sealedBytes(at.text) === P.MAX_TEXT && over.ok === false) || false;
}, test.limit.quick);
test.run('the refusal says the byte figures: "packet too long: <n> sealed bytes of <limit>", with length and limit', 0.2, function () {
  const r = P.encode('chat', 'a'.repeat(P.MAX_TEXT), { id: 'I' });
  const n = sealedBytes(JSON.stringify({ app: 'chat', v: 1, id: 'I', body: 'a'.repeat(P.MAX_TEXT) }));
  return (r.ok === false && r.error === 'packet too long: ' + n + ' sealed bytes of ' + P.MAX_TEXT && r.length === n && r.limit === P.MAX_TEXT) || false;
}, test.limit.quick);
test.run('the limit is measured in bytes, not characters, so a CJK body the same length as an ASCII body that fits is refused', 0.2, function () {
  const chars = Math.floor(P.MAX_TEXT / 2);
  const ascii = P.encode('chat', 'a'.repeat(chars), { id: 'I' });
  const cjk = P.encode('chat', '漢'.repeat(chars), { id: 'I' });
  return (ascii.ok === true && cjk.ok === false && /sealed bytes/.test(cjk.error)) || false;
}, test.limit.quick);
test.run('the limit is measured as the node escapes the text, so newlines and quotes count twice', 0.2, function () {
  const chars = Math.floor(P.MAX_TEXT * 0.7);
  const plain = P.encode('chat', 'a'.repeat(chars), { id: 'I' });
  const lines = P.encode('chat', '\n'.repeat(chars), { id: 'I' });
  return (plain.ok === true && lines.ok === false) || false;
}, test.limit.quick);

// ── isEnvelope ──
test.run('isEnvelope accepts our text, with or without an app', 0.2, function () {
  return (P.isEnvelope(P.encode('chat', 'x').text) === true && P.isEnvelope(P.encode('', { a: 1 }).text) === true) || false;
}, test.limit.quick);
test.run('isEnvelope rejects a chat line, a number, an array, JSON of another version and half a packet', 0.2, function () {
  const no = ['hello', 42, null, '[1,2]', '{"app":"chat","v":2,"id":"I","body":"x"}', '{"app":"chat","v":1,"id":"I"}', '{"app":"chat","v":1', '{"hand":"typed"}'];
  const got = no.map(P.isEnvelope);
  return got.every(function (x) { return x === false; }) || false;
}, test.limit.quick);
test.run('isEnvelope requires an app that is named to be a non-empty string', 0.2, function () {
  const got = [P.isEnvelope('{"app":"","v":1,"id":"I","body":"x"}'), P.isEnvelope('{"app":7,"v":1,"id":"I","body":"x"}')];
  return got.every(function (x) { return x === false; }) || false;
}, test.limit.quick);

// ── decode ──
test.run('decode reads an envelope: app, v, id, re and body', 0.2, function () {
  const d = P.decode(P.encode('chat', { t: 'hi' }, { id: 'I', re: 'h' }).text);
  return (d.legacy === false && d.app === 'chat' && d.v === 1 && d.id === 'I' && d.re === 'h' && short(d.body) === short({ t: 'hi' })) || false;
}, test.limit.quick);
test.run('decode gives a packet that regards nothing an empty re, and one for a box a null app', 0.2, function () {
  const d = P.decode(P.encode('', 'x', { id: 'I' }).text);
  return (d.re === '' && d.app === null) || false;
}, test.limit.quick);
test.run('decode never fails: a string that is no envelope is legacy, its text the body; a non-string is an empty body', 0.2, function () {
  const a = P.decode('a chat line from before packets');
  const b = P.decode(undefined);
  return (a.legacy === true && a.app === null && a.body === 'a chat line from before packets' && b.legacy === true && b.body === '') || false;
}, test.limit.quick);

// ── decorate ──
test.run('decorate keeps every field the message had and adds packet beside them', 0.2, function () {
  const text = P.encode('chat', 'hi', { id: 'I', re: 'h' }).text;
  const m = { from: 'k1', to: 'k2', text: text, sentAt: 5 };
  const d = P.decorate(m);
  return (d.from === 'k1' && d.to === 'k2' && d.text === text && d.sentAt === 5 && short(d.packet) === short({ legacy: false, app: 'chat', id: 'I', re: 'h', body: 'hi' }) && !m.packet) || false;
}, test.limit.quick);
test.run('decorate marks a plain chat line as a legacy packet, with no app, no id and the line as its body', 0.2, function () {
  const d = P.decorate({ from: 'k', text: 'hi there' });
  return short(d.packet) === short({ legacy: true, app: null, id: null, re: '', body: 'hi there' }) || false;
}, test.limit.quick);

// ── in a page ──
test.run('in a page, with limits loaded first, it is window.spirit.required.spirit.peer.packet', 0.2, function () {
  const win = { spirit: { required: { spirit: { limits: { PAYLOAD_MAX: limits.PAYLOAD_MAX, PLAINTEXT_MAX: limits.PLAINTEXT_MAX, SEALED_MAX: limits.SEALED_MAX } } } } };
  const ctx = { window: win, TextEncoder: TextEncoder, globalThis: null };
  ctx.globalThis = { crypto: require('crypto').webcrypto };
  try { vm.runInNewContext(fs.readFileSync(FILE, 'utf8'), ctx, { filename: FILE }); }
  catch (e) { return false; }
  const p = win.spirit.required.spirit.peer.packet;
  if (!p) return false;
  const r = p.encode('chat', 'x');
  return (p.MAX_TEXT === limits.SEALED_MAX && r.ok === true && /^[0-9a-f]{32}$/.test(r.envelope.id)) || false;
}, test.limit.quick);
// WHAT IT NEEDS, IT LOADS ITSELF (goal/G47.1, Andy: "cw, FIX IT!"): in a page with no limits yet it asks spirit.requireScript for
// spirit/limits/script.js, and is window.spirit.required.spirit.peer.packet once that is in.
test.run('in a page without limits.js it asks for spirit/limits/script.js itself, and is spirit.required.spirit.peer.packet once it is in', 0.2, async function () {
  const asked = [];
  const win = { spirit: {} };
  win.spirit.requireScript = function (p) {
    asked.push(p);
    return Promise.resolve().then(function () { ((win.spirit.required = win.spirit.required || {}).spirit = win.spirit.required.spirit || {}); win.spirit.required.spirit.limits = { PAYLOAD_MAX: limits.PAYLOAD_MAX, PLAINTEXT_MAX: limits.PLAINTEXT_MAX, SEALED_MAX: limits.SEALED_MAX }; return {}; });
  };
  const ctx = { window: win, TextEncoder: TextEncoder, globalThis: { crypto: require('crypto').webcrypto } };
  try { vm.runInNewContext(fs.readFileSync(FILE, 'utf8'), ctx, { filename: FILE }); }
  catch (e) { return false; }
  const before = !!(((win.spirit.required || {}).spirit || {}).client || {}).packet;
  await new Promise(function (r) { setTimeout(r, 50); });
  const p = win.spirit.required.spirit.peer.packet;
  return (asked.join() === 'spirit/limits/script.js' && !before && !!p && p.MAX_TEXT === limits.SEALED_MAX && p.encode('chat', 'x').ok === true) || false;
}, test.limit.quick);
