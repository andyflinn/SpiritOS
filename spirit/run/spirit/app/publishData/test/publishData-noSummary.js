'use strict';

// spirit/run/spirit/app/publishData/test/publishData-noSummary.js
// publishData POSTS NOTHING TO THE DESK (goal/G43.22; spec: ./publishData-noSummary.md): spirit/app/publishData/publishData.js.
// Andy, the box: "the apps and plugin system goes.", "there will only be goals, items and rules left, plus the verifier stuff
// can stay for now.". "publishData summary is no longer needed, i only check on github.". The tree read as it is, comments left out.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, ''); } catch (e) { return ''; } }
const DESK = path.join(RUN, 'spirit', 'app', 'desk');

test.startTest('publishData-noSummary.js: publishData posts nothing to the desk (goal/G43.22)');

test.subHeading('Andy: "publishData summary is no longer needed, i only check on github."');
const pub = code(path.join(RUN, 'spirit', 'app', 'publishData', 'publishData.js'));
ok(!!pub && !/chat\.add/.test(pub), 'publishData posts nothing to the desk', 'publishData.js still posts a chat.add');

test.reportSuccessFailureCount();
process.exit(0);
