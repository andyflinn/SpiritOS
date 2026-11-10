'use strict';

// spirit/run/spirit/element/test/grantsPanel-noWarning.js
// NO WARNING ON A GRANT (goal/G43.27, requirement 7; spec: ./grantsPanel-noWarning.md). Andy: "compare that to giving a linux
// user root authority, he then can fuck up the whole system, not our problem.": grantsPanel reads no <verb>.warning.txt, and
// none is left, spirit/auth/grant.warning.txt among them. The tree read as it is, comments stripped.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
function code(text) { return String(text).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); }
// Line ends aside: a Windows checkout (autocrlf) holds CRLF where git holds LF.
function read(rel) { const f = path.join(RUN, rel); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : ''; }

test.startTest('grantsPanel-noWarning.js: no warning on a grant (goal/G43.27)');

test.subHeading('7. no warning on a grant');
const tracked = execSync('git ls-files', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean).filter(function (f) { return fs.existsSync(path.join(REPO, f)); });
ok(tracked.length > 100, 'the world: ' + tracked.length + ' tracked files on disk are read', 'only ' + tracked.length + ' tracked files read: nothing judged');
ok(!fs.existsSync(path.join(RUN, 'spirit', 'auth', 'grant.warning.txt')), 'spirit/auth/grant.warning.txt is gone', 'spirit/auth/grant.warning.txt is still there');
const gp = code(read('spirit/element/grantsPanel.js'));
ok(gp.length > 1000, 'the world: grantsPanel.js is read', 'no grantsPanel.js: nothing judged');
ok(!/warning\.txt|\.FS\.loadFile/.test(gp), 'grantsPanel reads no <verb>.warning.txt', 'grantsPanel still reads one');
const warns = tracked.filter(function (f) { return /\.warning\.txt$/.test(f); });
ok(!warns.length, 'no <verb>.warning.txt is left', warns.length + ' are: ' + short(warns));

test.reportSuccessFailureCount();
process.exit(0);
