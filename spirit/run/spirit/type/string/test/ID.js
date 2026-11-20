'use strict';

// spirit/run/spirit/type/string/test/ID.js
// The tests of spirit/type/string/ID.js, and of no other module (spec: ./ID.md). goal/G48.4, the box: "a type script.js
// is an object containing static functions ... defaultValue() returns a default value that passes validation, and
// isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."
// spirit.type.string.ID: an ID, a public key (the box: "spirit/type/string/ID.js (public keys)").

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'type', 'string/ID.js');

let T = null;
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };

test.run('spirit/type/string/ID.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { require(path.join(RUN, 'spirit', 'spirit.js')); T = require(FILE); } catch (e) { T = null; }
  return (!!T && typeof T === 'object') || false;
}, test.limit.quick);
test.run('isValid answers true, the boolean, for "MCowBQYDK2VwAyEANrNqPPaIac2/NlIHC7C+LoalDe0ub7RvS7U4c6P+lzQ="', 0.4, function () {
  if (!T) return false;
  try { return ['MCowBQYDK2VwAyEANrNqPPaIac2/NlIHC7C+LoalDe0ub7RvS7U4c6P+lzQ='].every(function (v) { return T.isValid(v) === true; }) || false; } catch (e) { return false; }
}, test.limit.quick);
// Its title in words, not the cut key itself: a title is bounded by spirit.type.string.description's 128 bytes.
test.run('isValid throws an error for "goal/G48", "", a key cut short at either end, 5 and null', 0.4, function () {
  if (!T) return false;
  return ['goal/G48', '', 'MCowBQYDK2VwAyEA', 'MCowBQYDK2VwAyEANrNqPPaIac2/NlIHC7C+LoalDe0ub7RvS7U4c6P+lz', 5, null].every(throws) || false;
}, test.limit.quick);
// goal/G48.4, the box v33: "spirit/type/string/ID.js (public keys), default: \"the nodes own public key\"".
test.run('its default is the node\'s own public key, once the node is known', 0.4, function () {
  if (!T) return false;
  const S = globalThis.spirit; const was = S.node && S.node.key;
  const own = 'MCowBQYDK2VwAyEA' + 'B'.repeat(43) + '=';
  S.node = S.node || {}; S.node.key = own;
  try { return T.defaultValue() === own || false; } finally { S.node.key = was; }
}, test.limit.quick);
// THE TIGHT CHECK AT THE NODE (goal/G48.4, Q12; Andy: "the validity check for an ID must either check in the browser data, or
// node side the shadow roll and the own ID"; cw: "ID's tight check would run where the node lets a call in"): on a scratch
// node of its own, contact.get, whose key is a spirit.type.string.ID, takes the node's own key past its argument check, and
// refuses a well-formed key nobody there has seen, naming key.
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const N = {};
async function call(verb, args) {
  try {
    const r = await fetch(N.node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
    return { status: r.status, body: await r.json() };
  } catch (e) { return { status: 0, body: null }; }
}
const typeRefused = function (r) { return !!r && r.status === 400 && !!r.body && r.body.code === 'bad-request' && (r.body.argument === 'key' || (r.body.extra && r.body.extra.argument === 'key') || /\bkey\b/.test(String(r.body.error || ''))); };
test.run('a scratch node comes up and answers its card', 0.2, async function () {
  N.node = await H.scratchNode({});
  if (!N.node || !N.node.up) return false;
  N.card = await call('node.card');
  return (N.card.status === 200 && typeof N.card.body.publicKey === 'string') || false;
}, test.limit.slow);
test.after(async function () {
  try { if (N.node) await N.node.release(); } catch (e) { /* gone */ }
  try { if (N.node) H.freeTree(N.node); } catch (e) { /* left */ }
});
test.run('at the node, contact.get takes the node\'s own key past its argument check', 0.4, async function () {
  if (!N.card || N.card.status !== 200) return false;
  const r = await call('contact.get', { key: N.card.body.publicKey });
  return (r.status !== 0 && !typeRefused(r)) || false;
}, test.limit.slow);
test.run('at the node, contact.get refuses a well-formed key nobody there has seen, naming key', 0.4, async function () {
  if (!N.card || N.card.status !== 200) return false;
  let fresh = '';
  try { fresh = spirit.require('spirit/relayAuth.js').generateIdentity('zz-stranger').publicKey; } catch (e) { return false; }
  const r = await call('contact.get', { key: fresh });
  return typeRefused(r) || false;
}, test.limit.slow);
