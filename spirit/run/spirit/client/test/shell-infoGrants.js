'use strict';

// spirit/run/spirit/client/test/shell-infoGrants.js
// THE OLD SHELL'S INTRINSIC_APP_FOLDERS NAMES NEITHER INFO NOR GRANTS (goal/G43.24, requirement 2; spec:
// ./shell-infoGrants.md): both are intrinsic by their own <name>.json. Andy: "i just moved them, didn't fix the manifest.",
// "no i want those apps to basically be wrappers for spirit/element/ things....". client/shell.js read as it is, comments
// stripped.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }

test.startTest('shell-infoGrants.js: the old shell\'s INTRINSIC_APP_FOLDERS names neither Info nor Grants (goal/G43.24)');

test.subHeading('the box, 2: "both are intrinsic by their own <name>.json, as spirit/app apps say it"');
const oldShell = code(path.join(RUN, 'spirit', 'client', 'shell.js'));
const folders = /INTRINSIC_APP_FOLDERS\s*=\s*\[([^\]]*)\]/.exec(oldShell);
ok(!!folders, 'the world: the old shell\'s INTRINSIC_APP_FOLDERS is found in client/shell.js', 'no INTRINSIC_APP_FOLDERS in client/shell.js: nothing judged');
if (folders) {
  const listed = (folders[1].match(/['"]([^'"]*)['"]/g) || []).map(function (s) { return s.slice(1, -1); });
  ['info', 'grants'].forEach(function (f) {
    ok(listed.indexOf(f) === -1, f + ' leaves the old shell\'s INTRINSIC_APP_FOLDERS', 'INTRINSIC_APP_FOLDERS still names ' + f + ': ' + short(listed));
  });
}

test.reportSuccessFailureCount();
process.exit(0);
