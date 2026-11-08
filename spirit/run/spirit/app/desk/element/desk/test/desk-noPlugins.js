'use strict';

// spirit/run/spirit/app/desk/element/desk/test/desk-noPlugins.js
// THE DESK PAGE WITHOUT APPS, PLUGINS AND TEAM CHAT (goal/G43.22; spec: ./desk-noPlugins.md): spirit/app/desk/element/desk/desk.js.
// Andy, the box: "the apps and plugin system goes.", "there will only be goals, items and rules left, plus the verifier stuff
// can stay for now.". Q5: "G0 goes, from ui and server, kept in database.". The tree read as it is, comments left out.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, ''); } catch (e) { return ''; } }
const DESK = path.join(RUN, 'spirit', 'app', 'desk');

test.startTest('desk-noPlugins.js: the desk page draws no Apps tab, no plugin and no team chat (goal/G43.22)');

test.subHeading('Andy: "removal of plugin support.", and "G0 goes, from ui and server"');
const page = code(path.join(DESK, 'element', 'desk', 'desk.js'));
ok(!!page && !/goal\/G0['"]/.test(page) && !/data-tab="apps"/.test(page) && !/plugin/i.test(page), 'the desk page draws no Apps tab, no plugin tab and no team chat', 'spirit/app/desk/element/desk/desk.js still names Apps, a plugin or goal/G0');

test.reportSuccessFailureCount();
process.exit(0);
