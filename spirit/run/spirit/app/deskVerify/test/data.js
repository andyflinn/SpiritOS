'use strict';

// spirit/run/spirit/app/deskVerify/test/data.js
// deskVerify's data.js KEEPS NO verifyTests BRANCH (goal/G43.23, item 10, after goal/G43.22; spec: ./data.md).
// The box: "plugin leftovers (G43.22): ... deskVerify's data.js keeps a verifyTests branch." Its only reader, the fallout
// plugin, went with G43.22. The family is loaded as a page's spirit.data would hold it, and its code read with comments
// left out. No node, no port.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'data.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const W = {};

// the family, loaded
test.run('the world: the deskVerify family loads, with its state and flips reads', 0.2, function () {
  try {
    const D = require(path.join(RUN, 'spirit', 'data.js'));
    require(FILE);
    W.reads = D.deskVerify && D.deskVerify.data;
  } catch (e) { return 'deskVerify\'s data.js did not load: ' + (e && e.message) + ': nothing judged'; }
  const reads = W.reads;
  return (reads && typeof reads.state === 'function' && typeof reads.flips === 'function') || 'the deskVerify family gave ' + short(reads && Object.getOwnPropertyNames(reads)) + ': nothing judged';
}, 1000);
test.run('its reads offer no tests branch (no testsBranch)', 0.2, function () {
  const reads = W.reads;
  if (!reads) return 'no reads: the world failed';
  return !Object.getOwnPropertyNames(reads).some(function (k) { return /tests/i.test(k) && k !== 'flips'; }) || 'its reads still offer ' + short(Object.getOwnPropertyNames(reads).filter(function (k) { return /tests/i.test(k); }));
}, 1000);

// its code
test.run('the world: its code, comments left out, still names the verifyFlips branch', 0.2, function () {
  W.code = fs.readFileSync(FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
  return /verifyFlips/.test(W.code) || 'its code holds no verifyFlips: the read saw no code, nothing judged';
}, 1000);
test.run('its code names no verifyTests branch', 0.2, function () {
  if (typeof W.code !== 'string') return 'no code: the world failed';
  const h = W.code.split('\n').filter(function (l) { return /verifyTests|\btestsBranch\b|\bTESTS\b/.test(l); }).map(function (l) { return l.trim().slice(0, 100); });
  return !h.length || 'its code still keeps the verifyTests branch: ' + short(h);
}, 1000);
