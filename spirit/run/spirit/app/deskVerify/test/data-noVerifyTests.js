'use strict';

// spirit/run/spirit/app/deskVerify/test/data-noVerifyTests.js
// deskVerify's data.js KEEPS NO verifyTests BRANCH (goal/G43.23, item 10, after goal/G43.22; spec: ./data-noVerifyTests.md).
// The box: "plugin leftovers (G43.22): ... deskVerify's data.js keeps a verifyTests branch." Its only reader, the fallout
// plugin, went with G43.22. The family is loaded as a page's spirit.data would hold it, and its code read with comments
// left out. No node, no port.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'data.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('data-noVerifyTests.js: deskVerify\'s data.js keeps no verifyTests branch (goal/G43.23 item 10)');

test.subHeading('the family, loaded');
let reads = null;
try {
  const D = require(path.join(RUN, 'spirit', 'data.js'));
  require(FILE);
  reads = D.deskVerify && D.deskVerify.data;
} catch (e) { test.fail('deskVerify\'s data.js did not load: ' + (e && e.message) + ': nothing judged'); }
ok(reads && typeof reads.state === 'function' && typeof reads.flips === 'function', 'the world: the deskVerify family loads, with its state and flips reads', 'the deskVerify family gave ' + short(reads && Object.getOwnPropertyNames(reads)) + ': nothing judged');
if (reads) ok(!Object.getOwnPropertyNames(reads).some(function (k) { return /tests/i.test(k) && k !== 'flips'; }), 'its reads offer no tests branch (no testsBranch)', 'its reads still offer ' + short(Object.getOwnPropertyNames(reads).filter(function (k) { return /tests/i.test(k); })));

test.subHeading('its code');
const c = fs.readFileSync(FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
ok(/verifyFlips/.test(c), 'the world: its code, comments left out, still names the verifyFlips branch', 'its code holds no verifyFlips: the read saw no code, nothing judged');
const h = c.split('\n').filter(function (l) { return /verifyTests|\btestsBranch\b|\bTESTS\b/.test(l); }).map(function (l) { return l.trim().slice(0, 100); });
ok(!h.length, 'its code names no verifyTests branch', 'its code still keeps the verifyTests branch: ' + short(h));

test.reportSuccessFailureCount();
process.exit(0);
