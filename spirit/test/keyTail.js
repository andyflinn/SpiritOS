'use strict';

// apiAuth/G1.11: one function labels a key, everywhere.
//   Andy: "and that ugly default label must be procured by one and the same function across out entire system",
//   "why not kernel.js ? it carries common functions to shell and node modules.", "the relocation of this function
//   precedes all other items in this goal."
// The contract the builder follows:
//   1. kernel.js carries keyTail: a key's last 6 characters (the practice hub.keyTail had, hub.js:542), '' for none.
//      kernel.js is the one file both sides load (module.exports for node, window.spirit for the page).
//   2. hub.js no longer has its own: it calls the kernel's.
//   3. Nothing else in spirit/run cuts a key for a label: no negative slice of a key outside kernel.js.
//      Today's copies: relayDump.js (first 12 + last 6), natterDetails.js (last 8, in the page),
//      monitorDrill.js and drillVerify.js (last 10).

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const RUN = path.join(__dirname, '..', 'run');
const OWED = 'OWED by apiAuth/G1.11: ';

test.startTest('apiAuth/G1.11: one function labels a key, everywhere');

test.subHeading('kernel.js carries keyTail');
const spirit = require('../run/js/kernel.js');
const KEY = 'MCowBQYDK2VwAyEAMP7RU9Q6++SG+UPagCp1uOYQFtJM/kr1b+76Fj+AtJ0=';
if (typeof spirit.keyTail !== 'function') {
  test.fail(OWED + 'kernel.js exports no keyTail');
} else {
  const got = spirit.keyTail(KEY);
  if (got === KEY.slice(-6)) test.check('spirit.keyTail gives a key\'s last 6 characters (' + got + ')');
  else test.fail(OWED + 'spirit.keyTail gave ' + JSON.stringify(got) + ', not the last 6 characters');
  if (spirit.keyTail(null) === '' && spirit.keyTail(undefined) === '' && spirit.keyTail('') === '') test.check('and \'\' for no key');
  else test.fail(OWED + 'spirit.keyTail of no key is not \'\'');
}

test.subHeading('hub.js has no keyTail of its own');
const hubSource = fs.readFileSync(path.join(RUN, 'js', 'hub.js'), 'utf8');
if (/function\s+keyTail\s*\(/.test(hubSource)) test.fail(OWED + 'hub.js still defines its own keyTail');
else test.check('hub.js defines no keyTail');

test.subHeading('Nothing else cuts a key');
// A negative slice whose line, or one of the three lines above it, speaks of a key. kernel.js is the one home.
const SKIP = ['relay-state', 'node_modules', 'brains'];
function walk(dir, out) {
  let names = [];
  try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  names.forEach(function (d) {
    if (SKIP.indexOf(d.name) !== -1) return;
    const p = path.join(dir, d.name);
    if (d.isDirectory()) walk(p, out);
    else if (/\.js$/.test(d.name)) out.push(p);
  });
  return out;
}
const cuts = [];
walk(RUN, []).forEach(function (file) {
  if (path.resolve(file) === path.resolve(RUN, 'js', 'kernel.js')) return;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach(function (line, i) {
    if (!/\.slice\(\s*-\d+\s*\)/.test(line)) return;
    const near = lines.slice(Math.max(0, i - 3), i + 1).join('\n');
    if (/key/i.test(near)) cuts.push(path.relative(RUN, file).replace(/\\/g, '/') + ':' + (i + 1) + '  ' + line.trim());
  });
});
if (!cuts.length) test.check('no code under spirit/run cuts a key but kernel.js');
else cuts.forEach(function (c) { test.fail(OWED + 'a key is cut outside kernel.js: ' + c); });

test.reportSuccessFailureCount();
