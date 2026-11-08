'use strict';

// spirit/run/spirit/app/desk/test/data-noTeamChat.js
// THE DESK PAGE CACHE TREATS NO TEAM CHAT GOAL APART (goal/G43.22; spec: ./data-noTeamChat.md): spirit/app/desk/data.js.
// Andy, the box: "the apps and plugin system goes.", "there will only be goals, items and rules left, plus the verifier stuff
// can stay for now.". Q5: "G0 goes, from ui and server, kept in database.". The tree read as it is, comments left out.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, ''); } catch (e) { return ''; } }
const DESK = path.join(RUN, 'spirit', 'app', 'desk');

test.startTest('data-noTeamChat.js: the desk page cache treats no goal/G0 apart (goal/G43.22)');

test.subHeading('Andy: "G0 goes, from ui and server"');
const cache = code(path.join(DESK, 'data.js'));
ok(!!cache && !/goal\/G0['"]/.test(cache), 'the desk page cache treats no goal/G0 apart', 'spirit/app/desk/data.js still names goal/G0');

test.reportSuccessFailureCount();
process.exit(0);
