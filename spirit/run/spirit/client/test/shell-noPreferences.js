'use strict';

// spirit/run/spirit/client/test/shell-noPreferences.js
// PREFERENCES.JSON GONE, AND THE OLD SHELL'S MIGRATION OF IT (goal/G43.17, and goal/G43.23 item 6; spec: ./shell-noPreferences.md).
// Andy: "i want to remove that information and all the code that references it, gone.", "go do it!", and G43.17: "Didn't i
// say remove ALL code referencing "admit" and "hold". it was a hair-brained scheme, and it HAS TO GO." spirit/client/shell.js
// read and wrote preferences.json until 7bfb9514, so its absence is judged beside it (goal/G43.28; Andy: "you WILL FUCKING
// PLACE TESTS WHERE THEY FUCKING BELONG"; moved from spirit/test/nodeSettings-noPreferences.js and the last section of
// spirit/test/nodeStore-noAdmitHold.js). The tree read as it is. No node, no port.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// A file's code, comments blanked (line numbers kept); null when the file is not there.
function code(file) {
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, function (m) { return m.replace(/[^\n]/g, ' '); })
    .replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
}

test.startTest('shell-noPreferences.js: preferences.json and every line that reads or writes it gone, and client/shell.js migrates no preferences (goal/G43.17)');

test.subHeading('Andy: "i want to remove that information and all the code that references it, gone."');
const tracked = execSync('git ls-files', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(function (f) { return /(^|\/)preferences\.json$/.test(f); });
ok(!tracked.length, 'no preferences.json is tracked', 'still tracked: ' + short(tracked));
// Andy: "MAKE SURE the code referencing preferences.json will be gone from the codebase.": every tracked code file, tests,
// install scripts and comments included; only the suites that must name it aside.
const naming = execSync('git ls-files -- "*.js" "*.html" "*.css" "*.json"', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
  .filter(function (f) { return !/noPreferences\.(js|md)$/.test(f) && fs.existsSync(path.join(REPO, f)); })
  .filter(function (f) { return /preferences\.json|UNKNOWN_PREFS|unknownPolicy/.test(fs.readFileSync(path.join(REPO, f), 'utf8')); });
ok(!naming.length, 'no tracked code, tests and comments included, names preferences.json or the policy it held', naming.length + ' still do: ' + short(naming));

test.subHeading('client/shell.js migrates no preferences');
const sh = path.join(RUN, 'spirit', 'client', 'shell.js');
const c = code(sh);
ok(c !== null && /function renderDesktop\b/.test(c), 'the world: spirit/client/shell.js is read, its code holding /function renderDesktop\\b/',
  c === null ? 'spirit/client/shell.js is not there: nothing judged' : 'spirit/client/shell.js\'s code holds no renderDesktop: the comment stripper ate it, nothing judged');
if (c !== null) {
  const h = [];
  c.split('\n').forEach(function (l, i) { if (/\bmigrateAppIds\b|\bAPP_ID_RENAMES\b|\bwithShellIds\b/.test(l)) h.push('shell.js:' + (i + 1) + ' ' + l.trim().slice(0, 100)); });
  ok(!h.length, 'the old shell\'s code holds no preferences migration (migrateAppIds, APP_ID_RENAMES, withShellIds)', 'client/shell.js still migrates preferences: ' + short(h));
}

test.reportSuccessFailureCount();
process.exit(0);
