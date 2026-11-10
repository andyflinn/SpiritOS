'use strict';

// spirit/run/spirit/test/appServer-agentsFile.js
// THE AGENT'S AGENTS.md THROUGH spirit.fs.loadFile AT ITS PATH (goal/G43.27, requirement 8; spec: ./appServer-agentsFile.md),
// not through the family's FS: appServer.js's AGENTS paragraph. Andy: "easily changed, no?". appServer.js read as it is.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
// Line ends aside: a Windows checkout (autocrlf) holds CRLF where git holds LF.
function read(rel) { const f = path.join(RUN, rel); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : ''; }

test.startTest('appServer-agentsFile.js: the agent\'s AGENTS.md through spirit.fs.loadFile at its path (goal/G43.27)');

test.subHeading('8. the agent\'s AGENTS.md through spirit.fs.loadFile at its path');
const as = read('spirit/appServer.js');
const block = (as.match(/AGENTS: AN APP'S RULES FOR AGENTS[\s\S]*?\n\n/) || [''])[0];
ok(block.length > 100, 'the world: appServer.js\'s AGENTS paragraph is read', 'no AGENTS paragraph in appServer.js: nothing judged');
ok(/spirit\.fs\.loadFile/.test(block) && !/family's FS|FS\.loadFile \{path: "AGENTS\.md"\}/.test(block), 'it says AGENTS.md is read with spirit.fs.loadFile at its path', 'it still says: ' + short((block.match(/.*FS.*/g) || []).join(' / ')));

test.reportSuccessFailureCount();
process.exit(0);
