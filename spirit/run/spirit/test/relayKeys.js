'use strict';

// spirit/run/spirit/test/relayKeys.js
// The tests of spirit/relayKeys.js, and of no other module (spec: ./relayKeys.md). This file holds goal/G41.30: a relay's
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

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('relayKeys.js: a report does not set the star (goal/G41.30)');

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-relaykeys-'));
const URL_A = 'https://says-i-own-it.example';
const KEY_A = 'MCowBQYDK2VwAyEAKEYAKEYAKEYAKEYAKEYAKEYAKEYAKEYAKEYAKEYAKEYAKEY=';
const URL_B = 'https://starred.example';
const KEY_B = 'MCowBQYDK2VwAyEAKEYBKEYBKEYBKEYBKEYBKEYBKEYBKEYBKEYBKEYBKEYBKEY=';

test.subHeading('a report from a relay calling this node its owner');
ok(relayKeys.accept(home, URL_A, KEY_A) === true, 'a relay row is there to report on', 'the relay row could not be made');
relayKeys.ownerSeat(home, URL_A, 'andy');
const a = nodeStore.open(home).seen.get(KEY_A) || {};
ok(!!a.seated, 'it notes the seat the relay says this node holds', 'after the report: ' + short(a));
ok(!a.mine, 'and sets no star: a report is the relay\'s own word, and any relay can say it', 'the report set the star: ' + short(a));

test.subHeading('a star already on a row');
relayKeys.accept(home, URL_B, KEY_B);
nodeStore.open(home).seen.set(KEY_B, { mine: true });
relayKeys.ownerSeat(home, URL_B, 'andy');
const b = nodeStore.open(home).seen.get(KEY_B) || {};
ok(!!b.mine, 'a report takes no star away either', 'after the report: ' + short(b));
ok(!!b.seated, 'and still notes the seat', 'after the report: ' + short(b));

try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) { /* scratch */ }
test.reportSuccessFailureCount();
process.exit(0);
