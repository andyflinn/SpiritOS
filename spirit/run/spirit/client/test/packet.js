'use strict';

// spirit/run/spirit/client/test/packet.js
// The tests of spirit/client/packet.js, and of no other module (spec: ./packet.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
//
// One door for every app: the envelope { app, v, id, body, re } lives inside the relay's `text`, so the wire does not
// change. Encode, decode, decorate, isEnvelope, randomId; the bound it enforces is asked of spirit/limits.js, never
// restated. Pure and dual target: driven in node, and loaded in a window of its own (vm) as a page loads it.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'client', 'packet.js');
const P = require(FILE);
const limits = require(path.join(RUN, 'spirit', 'limits.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function bytes(s) { return Buffer.byteLength(String(s), 'utf8'); }
// What the composer measures: the text as the node will escape it before sealing.
function sealedBytes(text) { return bytes(JSON.stringify(text)); }

// ── what it says about itself ──
test.run('VERSION is 1 and an id is 16 bytes', 0.2, function () {
  return (P.VERSION === 1 && P.ID_BYTES === 16) || 'VERSION ' + short(P.VERSION) + ', ID_BYTES ' + short(P.ID_BYTES);
}, test.limit.quick);
test.run('MAX_TEXT is the bound it enforces, asked of limits.js: SEALED_MAX, never restated', 0.2, function () {
  return (typeof limits.SEALED_MAX === 'number' && P.MAX_TEXT === limits.SEALED_MAX) || 'MAX_TEXT ' + short(P.MAX_TEXT) + ', SEALED_MAX ' + short(limits.SEALED_MAX);
}, test.limit.quick);

// ── randomId ──
test.run('randomId: 128 bits from a secure source, as 32 hex characters, each its own', 0.2, function () {
  const ids = [P.randomId(), P.randomId(), P.randomId()];
  const hex = ids.every(function (x) { return /^[0-9a-f]{32}$/.test(x); });
  return (hex && ids[0] !== ids[1] && ids[1] !== ids[2]) || 'ids: ' + short(ids);
}, test.limit.quick);
test.run('randomId with the test seam: a predictable 32-character string', 0.2, function () {
  const a = P.randomId(function () { return 0.5; });
  const b = P.randomId(function () { return 0.5; });
  return (a === b && a.length === 32) || 'seamed: ' + short([a, b]);
}, test.limit.quick);

// ── encode ──
test.run('encode wraps a body as the text { app, v, id, body }, exactly', 0.2, function () {
  const r = P.encode('relay-chat', 'hello', { id: 'ID1' });
  return (r.ok === true && r.text === '{"app":"relay-chat","v":1,"id":"ID1","body":"hello"}' && r.envelope.body === 'hello') || 'encode: ' + short(r);
}, test.limit.quick);
test.run('encode mints a fresh secure id when none is given', 0.2, function () {
  const a = P.encode('chat', 'x'); const b = P.encode('chat', 'x');
  return (/^[0-9a-f]{32}$/.test(a.envelope.id) && a.envelope.id !== b.envelope.id) || 'ids: ' + short([a.envelope, b.envelope]);
}, test.limit.quick);
test.run('an app is optional: a packet for a box has no app at all, omitted, not emptied', 0.2, function () {
  const r = [P.encode('', { search: 1 }, { id: 'I' }), P.encode(null, { search: 1 }, { id: 'I' }), P.encode('  ', { search: 1 }, { id: 'I' })];
  return r.every(function (x) { return x.ok && x.text === '{"v":1,"id":"I","body":{"search":1}}'; }) || 'encode: ' + short(r.map(function (x) { return x.text; }));
}, test.limit.quick);
test.run('re, the request hash a packet regards, rides in the envelope when given', 0.2, function () {
  const r = P.encode('chat', 'x', { id: 'I', re: 'hash1' });
  return r.text === '{"app":"chat","v":1,"id":"I","body":"x","re":"hash1"}' || 'encode: ' + short(r.text);
}, test.limit.quick);
test.run('a packet that regards nothing is byte-for-byte what it was before re existed: no re field', 0.2, function () {
  const r = [P.encode('chat', 'x', { id: 'I' }), P.encode('chat', 'x', { id: 'I', re: '' }), P.encode('chat', 'x', { id: 'I', re: null })];
  return r.every(function (x) { return x.text === '{"app":"chat","v":1,"id":"I","body":"x"}'; }) || 'encode: ' + short(r.map(function (x) { return x.text; }));
}, test.limit.quick);
test.run('encode refuses a missing body, and a body with a cycle in it', 0.2, function () {
  const cyc = {}; cyc.self = cyc;
  const r = [P.encode('chat', undefined), P.encode('chat', cyc)];
  return (r[0].ok === false && r[0].error === 'body required' && r[1].ok === false && r[1].error === 'body is not serialisable') || 'encode: ' + short(r);
}, test.limit.quick);
// JSON.stringify drops a function body without a word; answered ok, its text would have no body, which isEnvelope says
// is no envelope (it would arrive as a legacy chat line). The code's own comment names
// the refusal: "A body with a cycle in it, or something JSON cannot express" is "body is not serialisable".
test.run('encode refuses a body JSON cannot express (a function): never a text its own isEnvelope rejects', 0.2, function () {
  const r = P.encode('chat', function () {});
  return (r.ok === false && r.error === 'body is not serialisable') || 'encode: ' + short(r) + ', isEnvelope of its text: ' + short(P.isEnvelope(r.text));
}, test.limit.quick);

// ── the bound that decides: sealed bytes ──
test.run('a packet whose sealed bytes are exactly the limit is taken; one byte more is refused', 0.2, function () {
  const base = sealedBytes(P.encode('chat', '', { id: 'I' }).text);
  const n = P.MAX_TEXT - base;
  const at = P.encode('chat', 'a'.repeat(n), { id: 'I' });
  const over = P.encode('chat', 'a'.repeat(n + 1), { id: 'I' });
  return (at.ok === true && sealedBytes(at.text) === P.MAX_TEXT && over.ok === false) || 'at ' + short([at.ok, sealedBytes(at.text || '')]) + ', over ' + short(over.ok);
}, test.limit.quick);
test.run('the refusal says the byte figures: "packet too long: <n> sealed bytes of <limit>", with length and limit', 0.2, function () {
  const r = P.encode('chat', 'a'.repeat(P.MAX_TEXT), { id: 'I' });
  const n = sealedBytes(JSON.stringify({ app: 'chat', v: 1, id: 'I', body: 'a'.repeat(P.MAX_TEXT) }));
  return (r.ok === false && r.error === 'packet too long: ' + n + ' sealed bytes of ' + P.MAX_TEXT && r.length === n && r.limit === P.MAX_TEXT) || 'refusal: ' + short(r);
}, test.limit.quick);
test.run('measured in bytes, not characters: CJK the same length as an ASCII body that fits is refused', 0.2, function () {
  const chars = Math.floor(P.MAX_TEXT / 2);
  const ascii = P.encode('chat', 'a'.repeat(chars), { id: 'I' });
  const cjk = P.encode('chat', '漢'.repeat(chars), { id: 'I' });
  return (ascii.ok === true && cjk.ok === false && /sealed bytes/.test(cjk.error)) || 'ascii ' + short(ascii.ok) + ', cjk ' + short(cjk);
}, test.limit.quick);
test.run('measured as the node escapes it: newlines and quotes count twice', 0.2, function () {
  const chars = Math.floor(P.MAX_TEXT * 0.7);
  const plain = P.encode('chat', 'a'.repeat(chars), { id: 'I' });
  const lines = P.encode('chat', '\n'.repeat(chars), { id: 'I' });
  return (plain.ok === true && lines.ok === false) || 'plain ' + short(plain.ok) + ', newlines ' + short(lines.ok);
}, test.limit.quick);

// ── isEnvelope ──
test.run('isEnvelope: our text is one, with or without an app', 0.2, function () {
  return (P.isEnvelope(P.encode('chat', 'x').text) === true && P.isEnvelope(P.encode('', { a: 1 }).text) === true) || 'not an envelope';
}, test.limit.quick);
test.run('isEnvelope: a chat line, a number, an array, JSON of another version, and half a packet are not', 0.2, function () {
  const no = ['hello', 42, null, '[1,2]', '{"app":"chat","v":2,"id":"I","body":"x"}', '{"app":"chat","v":1,"id":"I"}', '{"app":"chat","v":1', '{"hand":"typed"}'];
  const got = no.map(P.isEnvelope);
  return got.every(function (x) { return x === false; }) || 'isEnvelope: ' + short(got);
}, test.limit.quick);
test.run('isEnvelope: an app that is named must be a non-empty string', 0.2, function () {
  const got = [P.isEnvelope('{"app":"","v":1,"id":"I","body":"x"}'), P.isEnvelope('{"app":7,"v":1,"id":"I","body":"x"}')];
  return got.every(function (x) { return x === false; }) || 'isEnvelope: ' + short(got);
}, test.limit.quick);

// ── decode ──
test.run('decode reads an envelope: app, v, id, re and body', 0.2, function () {
  const d = P.decode(P.encode('chat', { t: 'hi' }, { id: 'I', re: 'h' }).text);
  return (d.legacy === false && d.app === 'chat' && d.v === 1 && d.id === 'I' && d.re === 'h' && short(d.body) === short({ t: 'hi' })) || 'decode: ' + short(d);
}, test.limit.quick);
test.run('decode: a packet that regards nothing has re \'\', and one for a box has app null', 0.2, function () {
  const d = P.decode(P.encode('', 'x', { id: 'I' }).text);
  return (d.re === '' && d.app === null) || 'decode: ' + short(d);
}, test.limit.quick);
test.run('decode never fails: a string that is no envelope is legacy, its text the body; a non-string is an empty body', 0.2, function () {
  const a = P.decode('a chat line from before packets');
  const b = P.decode(undefined);
  return (a.legacy === true && a.app === null && a.body === 'a chat line from before packets' && b.legacy === true && b.body === '') || 'decode: ' + short([a, b]);
}, test.limit.quick);

// ── decorate ──
test.run('decorate keeps every field the message had and adds packet beside them', 0.2, function () {
  const text = P.encode('chat', 'hi', { id: 'I', re: 'h' }).text;
  const m = { from: 'k1', to: 'k2', text: text, sentAt: 5 };
  const d = P.decorate(m);
  return (d.from === 'k1' && d.to === 'k2' && d.text === text && d.sentAt === 5 && short(d.packet) === short({ legacy: false, app: 'chat', id: 'I', re: 'h', body: 'hi' }) && !m.packet) || 'decorate: ' + short(d);
}, test.limit.quick);
test.run('decorate of a plain chat line: packet legacy, no app, no id, the line as its body', 0.2, function () {
  const d = P.decorate({ from: 'k', text: 'hi there' });
  return short(d.packet) === short({ legacy: true, app: null, id: null, re: '', body: 'hi there' }) || 'decorate: ' + short(d);
}, test.limit.quick);

// ── in a page ──
test.run('in a page, with limits loaded first, it is window.spirit.packet', 0.2, function () {
  const win = { spirit: { limits: { PAYLOAD_MAX: limits.PAYLOAD_MAX, PLAINTEXT_MAX: limits.PLAINTEXT_MAX, SEALED_MAX: limits.SEALED_MAX } } };
  const ctx = { window: win, TextEncoder: TextEncoder, globalThis: null };
  ctx.globalThis = { crypto: require('crypto').webcrypto };
  try { vm.runInNewContext(fs.readFileSync(FILE, 'utf8'), ctx, { filename: FILE }); }
  catch (e) { return 'the page load threw: ' + short(e.message); }
  const p = win.spirit.packet;
  if (!p) return 'no window.spirit.packet';
  const r = p.encode('chat', 'x');
  return (p.MAX_TEXT === limits.SEALED_MAX && r.ok === true && /^[0-9a-f]{32}$/.test(r.envelope.id)) || 'in the page: ' + short(r);
}, test.limit.quick);
// WHAT IT NEEDS, IT LOADS ITSELF (goal/G47.1, Andy: "cw, FIX IT!"): in a page with no limits yet it asks spirit.require for
// spirit/limits.js, and is window.spirit.packet once that is in.
test.run('in a page without limits.js loaded it asks for spirit/limits.js itself, and is window.spirit.packet once it is in', 0.2, async function () {
  const asked = [];
  const win = { spirit: {} };
  win.spirit.require = function (p) {
    asked.push(p);
    return Promise.resolve().then(function () { win.spirit.limits = { PAYLOAD_MAX: limits.PAYLOAD_MAX, PLAINTEXT_MAX: limits.PLAINTEXT_MAX, SEALED_MAX: limits.SEALED_MAX }; return {}; });
  };
  const ctx = { window: win, TextEncoder: TextEncoder, globalThis: { crypto: require('crypto').webcrypto } };
  try { vm.runInNewContext(fs.readFileSync(FILE, 'utf8'), ctx, { filename: FILE }); }
  catch (e) { return 'the page load threw: ' + short(e.message); }
  const before = !!win.spirit.packet;
  await new Promise(function (r) { setTimeout(r, 50); });
  const p = win.spirit.packet;
  return (asked.join() === 'spirit/limits.js' && !before && !!p && p.MAX_TEXT === limits.SEALED_MAX && p.encode('chat', 'x').ok === true) ||
    'asked ' + short(asked) + ', defined before the limits ' + before + ', after ' + short(p && p.MAX_TEXT);
}, test.limit.quick);
