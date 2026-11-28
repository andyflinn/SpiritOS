'use strict';

// spirit/run/spirit/type/string/signature/test/script.js
// The tests of spirit/type/string/signature/script.js, and of no other module (spec: ./script.md). goal/G49.25, Q13 (cw: "a new
// type spirit/type/string/signature for a signature"; Andy: "does not the node also check signatures for incoming peer
// requests?", then "i agree to a signature type."): one type for every signed argument, node and relay alike. A signature is
// what the tree signs with, spirit/relayAuth/script.js's sign(): its signatures pass; what is no signature throws. The type
// contract (goal/G48.4): "defaultValue() returns a default value that passes validation, and isValid(something) return boolean
// true if something is valid and throws and error if something is NOT valid."

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/type/string/signature/script.js';
const FILE = path.join(RUN, SUBJECT);
const auth = LOADER.requireScript('spirit/relayAuth/script.js');

let T = null;
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };
// Real signatures, made as the tree makes them: two identities, three texts.
const SIGNED = (function () {
  const out = [];
  ['zzA', 'zzB'].forEach(function (n) {
    const id = auth.generateIdentity(n);
    ['', 'a text', JSON.stringify({ call: 'spirit.relay.post', args: { to: 'x' } })].forEach(function (t) { out.push(auth.sign(id.privateKey, t)); });
  });
  return out;
}());

test.run('spirit/type/string/signature/script.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { T = LOADER.requireScript(SUBJECT); } catch (e) { T = null; }
  return (!!T && typeof T === 'object' && typeof T.isValid === 'function' && typeof T.defaultValue === 'function') || false;
}, test.limit.quick);
test.run('isValid answers true, the boolean, for six signatures spirit/relayAuth/script.js signed', 0.4, function () {
  if (!T || SIGNED.length !== 6) return false;
  try { return SIGNED.every(function (v) { return T.isValid(v) === true; }) || false; } catch (e) { return false; }
}, test.limit.quick);
test.run('its defaultValue passes isValid', 0.2, function () {
  if (!T) return false;
  try { return T.isValid(T.defaultValue()) === true || false; } catch (e) { return false; }
}, test.limit.quick);
test.run('isValid throws for what is no string: undefined, null, 7, an object', 0.2, function () {
  if (!T) return false;
  return [undefined, null, 7, { sig: SIGNED[0] }].every(throws) || false;
}, test.limit.quick);
test.run('isValid throws for an empty string and for words: "", "not a signature"', 0.2, function () {
  if (!T) return false;
  return ['', 'not a signature'].every(throws) || false;
}, test.limit.quick);
test.run('isValid throws for a signature cut short, one grown longer, and one with a character that is no base64', 0.2, function () {
  if (!T) return false;
  const s = SIGNED[1];
  return [s.slice(0, -4), s + 'AAAA', s.slice(0, 10) + '!' + s.slice(11)].every(throws) || false;
}, test.limit.quick);
test.run('isValid throws for a public key, which is no signature', 0.2, function () {
  if (!T) return false;
  return throws(auth.generateIdentity('zzKey').publicKey) || false;
}, test.limit.quick);
