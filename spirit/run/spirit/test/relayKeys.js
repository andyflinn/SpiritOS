'use strict';

// spirit/run/spirit/test/relayKeys.js
// The tests of spirit/relayKeys.js, and of no other module, in this one file (spec: ./relayKeys.md). It holds
// goal/G41.30: a relay's
// report never sets the star (Andy: "NO signature. just the armingButton, with a precise documentation of the risk.";
// "so this button will put the star on relays and puppets. AND take it away."). A relay's report is that relay's own
// word; only the button, at home, sets or takes the star. On a scratch folder.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const relayKeys = require(path.join(RUN, 'spirit', 'relayKeys.js'));
const nodeStore = require(path.join(RUN, 'spirit', 'nodeStore.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

const URL_A = 'https://says-i-own-it.example';
const KEY_A = 'MCowBQYDK2VwAyEAKEYAKEYAKEYAKEYAKEYAKEYAKEYAKEYAKEYAKEYAKEYAKEY=';
const URL_B = 'https://starred.example';
const KEY_B = 'MCowBQYDK2VwAyEAKEYBKEYBKEYBKEYBKEYBKEYBKEYBKEYBKEYBKEYBKEYBKEY=';
const W = { home: null, a: null, b: null };

// a report from a relay calling this node its owner
test.run('a relay row is there to report on', 0.2, function () {
  W.home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-relaykeys-'));
  return relayKeys.accept(W.home, URL_A, KEY_A) === true || 'the relay row could not be made';
}, test.limit.quick);
test.run('it notes the seat the relay says this node holds', 0.2, function () {
  if (!W.home) return 'no scratch folder: the world failed';
  relayKeys.ownerSeat(W.home, URL_A, 'andy');
  W.a = nodeStore.open(W.home).seen.get(KEY_A) || {};
  return !!W.a.seated || 'after the report: ' + short(W.a);
}, test.limit.quick);
// A relay that could set the star by its own report would be trusted on its own word: 0.8.
test.run('and sets no star: a report is the relay\'s own word, and any relay can say it', 0.8, function () {
  if (!W.a) return 'no report made: the world failed';
  return !W.a.mine || 'the report set the star: ' + short(W.a);
}, test.limit.quick);

// a star already on a row
test.run('a report takes no star away either', 0.2, function () {
  if (!W.home) return 'no scratch folder: the world failed';
  relayKeys.accept(W.home, URL_B, KEY_B);
  nodeStore.open(W.home).seen.set(KEY_B, { mine: true });
  relayKeys.ownerSeat(W.home, URL_B, 'andy');
  W.b = nodeStore.open(W.home).seen.get(KEY_B) || {};
  return !!W.b.mine || 'after the report: ' + short(W.b);
}, test.limit.quick);
test.run('and still notes the seat', 0.2, function () {
  if (!W.b) return 'no report made: the world failed';
  return !!W.b.seated || 'after the report: ' + short(W.b);
}, test.limit.quick);

test.after(function () {
  if (W.home) { try { fs.rmSync(W.home, { recursive: true, force: true }); } catch (e) { /* scratch */ } }
});
