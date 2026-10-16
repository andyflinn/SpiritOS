'use strict';

// spirit/test/deviceGone.js
// goal/G28.2: GET RID OF THE LAST "DEVICE" REMNANTS. Andy, 2026-10-16: "KILL it. COMPLETELY." (the folder
// spirit/run/js/device and every "device" reference in code, comments, tests and documentation).
//
// Scope, as posted on the item: media and published content are Andy's and are left alone, and so are brains and
// the suite itself, which names the word to find it.
//
// WHAT IS ASSERTED (red on today's code)
//   1. the folder spirit/run/js/device is absent.
//   2. no file in the code, shell, process, test or documentation trees mentions "device" (case-insensitive).

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G28.2: ';
const RUN = path.join(__dirname, '..', 'run');
const SPIRIT = path.join(__dirname, '..');
const SELF = path.resolve(__filename);
const SKIP_DIRS = new Set(['node_modules', '.git', 'brains', 'media', 'published']);
const TEXT = /\.(js|json|md|html|css|txt|sh|ps1|cmd)$/i;

function walk(dir, out) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  entries.forEach(function (e) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(p, out); }
    else if (TEXT.test(e.name) && path.resolve(p) !== SELF) out.push(p);
  });
  return out;
}

test.startTest('goal/G28.2: no "device" remnants');

test.subHeading('1. the device folder is gone');
{
  const dir = path.join(RUN, 'js', 'device');
  if (!fs.existsSync(dir)) test.check('spirit/run/js/device is absent');
  else test.fail(OWED + 'spirit/run/js/device still exists, with: ' + fs.readdirSync(dir).join(', '));
}

test.subHeading('2. no reference to "device" in code, shell, process, tests or documentation');
{
  const hits = walk(SPIRIT, []).filter(function (f) {
    return /device/i.test(fs.readFileSync(f, 'utf8'));
  }).map(function (f) { return path.relative(path.join(SPIRIT, '..', '..'), f).replace(/\\/g, '/'); });
  if (!hits.length) test.check('no file in the code, shell, process, test or documentation trees says "device"');
  else test.fail(OWED + hits.length + ' file(s) still say "device", first: ' + hits.slice(0, 5).join(', '));
}

test.reportSuccessFailureCount();

module.exports = test;
