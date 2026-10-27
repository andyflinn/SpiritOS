'use strict';

// spirit/run/shell/desk/test/desk.js
// The tests of shell/desk/desk.js (spec: ./desk.md; goal/G41.1): every icon it draws is a glyph written as it is, with
// no icon table and no lookup of a name into one. Read from the module's own code.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'desk.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }

test.startTest('desk.js: its icons are glyphs');

const code = fs.readFileSync(FILE, 'utf8').replace(/\/\/[^\n]*/g, '');
test.subHeading('no icon table, no lookup into one');
ok(!/iconIndex|\bICON\b/.test(code), 'desk.js names no icon table', 'desk.js still names iconIndex or ICON');
ok(!/deskIcon\(/.test(code), 'it looks no icon up by name (deskIcon is gone)', 'desk.js still calls deskIcon');
test.subHeading('the glyphs it draws, written as they are');
['📁', '❌', '💻', '⚔️'].forEach(function (g) { ok(code.indexOf(g) !== -1, 'it draws ' + g + ' as written', g + ' is not in desk.js'); });
const rule = /var DESK_RULE_ICON = (\{[^}]*\});/.exec(code);
let icons = null;
try { icons = rule ? (new Function('return ' + rule[1]))() : null; } catch (e) { icons = null; }
ok(icons && icons.proposed === '✏️' && icons.active === '🔒' && icons.deleted === '💀', 'a rule\'s status is drawn as its glyph: proposed ✏️, active 🔒, deleted 💀',
  'DESK_RULE_ICON: ' + JSON.stringify(icons));
test.reportSuccessFailureCount();
