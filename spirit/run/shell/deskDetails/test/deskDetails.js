'use strict';

// spirit/run/shell/deskDetails/test/deskDetails.js
// The tests of shell/deskDetails/deskDetails.js (spec: ./deskDetails.md; goal/G41.1): its panel icons are glyphs, drawn
// as they are, with no icon table. Read from the module's own code: DD_PANELS and the strip that draws them.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'deskDetails.js');
const KEY = /^[A-Z_]+$/;

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }

test.startTest('deskDetails.js: its panel icons are glyphs');

const raw = fs.readFileSync(FILE, 'utf8');
const code = raw.replace(/\/\/[^\n]*/g, '');
test.subHeading('the panels name their icons as glyphs');
const at = /var DD_PANELS = (\[[\s\S]*?\n\]);/.exec(code);
let panels = null;
try { panels = at ? (new Function('return ' + at[1]))() : null; } catch (e) { panels = null; }
ok(Array.isArray(panels) && panels.length >= 6, 'DD_PANELS lists its six panels', 'DD_PANELS not read: ' + (at ? 'not evaluable' : 'not found'));
const keyed = (panels || []).filter(function (p) { return !p.icon || KEY.test(p.icon); }).map(function (p) { return p.key + ':' + p.icon; });
ok(panels && !keyed.length, 'every panel names its icon as the glyph itself', 'panels naming a key: ' + keyed.join(', '));
test.subHeading('the strip draws them as they are, from no table');
ok(!/iconIndex|\bICON\b/.test(code), 'deskDetails.js names no icon table', 'deskDetails.js still names iconIndex or ICON');
ok(/\+ p\.icon \+/.test(code), 'the strip draws a panel\'s icon as it is (p.icon)', 'the strip does not draw p.icon as it is');
test.reportSuccessFailureCount();
