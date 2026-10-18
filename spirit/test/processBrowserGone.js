'use strict';

// spirit/test/processBrowserGone.js
// goal/G29.13: the Job Selector (shell/process-browser) is gone. Red on today's tree; claude-windows writes it and
// builds it (one agent). The item's box, Andy's words first: "Nothing, absolutely NOTHING can be done with this shell
// app, that cannot be done through the "files" shell app. So this app need s to go. Completely. Utterly. Gone. dead."
//   WHAT GOES: the app itself (its script and manifest); every mention that keeps it alive: its place in the Spirit
//   group (index.html), its entry in the shell's intrinsic apps and its old-id rename (js/client/shell.js); its tests
//   turn into checks that it is gone.
//   WHAT STAYS: starting a program, from the file viewer's start form for a script under process/.
// rule/11: through testSupport only.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G29.13: ';
const RUN = path.join(__dirname, '..', 'run');

test.startTest('goal/G29.13: the Job Selector (shell/process-browser) is gone, completely');

// Every file the node serves or runs, outside relay-state and node_modules: none may name the app.
function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    if (e.name === 'node_modules' || e.name === 'relay-state' || e.name === '.git') return;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(js|json|html|md)$/.test(e.name)) out.push(full);
  });
  return out;
}

test.subHeading('1. the app itself');
if (!fs.existsSync(path.join(RUN, 'shell', 'process-browser'))) test.check('shell/process-browser is gone, script and manifest');
else test.fail(OWED + 'shell/process-browser still holds ' + fs.readdirSync(path.join(RUN, 'shell', 'process-browser')).join(', '));

test.subHeading('2. nothing keeps it alive');
const naming = walk(RUN, []).filter(function (f) { return /process-browser/.test(fs.readFileSync(f, 'utf8')); })
  .map(function (f) { return path.relative(RUN, f).split(path.sep).join('/'); });
if (!naming.length) test.check('no file under spirit/run names process-browser: not the Spirit group, not the shell\'s intrinsic apps or renames');
else test.fail(OWED + 'still named in ' + naming.join(', '));
const shell = fs.readFileSync(path.join(RUN, 'js', 'client', 'shell.js'), 'utf8');
const intrinsic = (/var INTRINSIC_APP_FOLDERS = \[([^\]]*)\]/.exec(shell) || [])[1] || '';
if (intrinsic && !/process-browser/.test(intrinsic)) test.check('the shell\'s intrinsic apps no longer list it: ' + intrinsic.replace(/\s+/g, ' ').trim());
else test.fail(OWED + 'INTRINSIC_APP_FOLDERS reads ' + intrinsic);

test.subHeading('3. its tests say it is gone');
const tests = ['natterIntrinsic.js', 'fsWatcherCommands.js'].filter(function (t) {
  const src = fs.readFileSync(path.join(__dirname, t), 'utf8');
  return /readRun\('shell\/process-browser|'shell\/process-browser\/process-browser\.js'\]|PROCESS_SCRIPT = 'shell\/process-browser/.test(src);
});
if (!tests.length) test.check('natterIntrinsic and fsWatcherCommands no longer read the app');
else test.fail(OWED + 'still reading the app: ' + tests.join(', '));

test.subHeading('4. what stays');
const index = fs.readFileSync(path.join(RUN, 'index.html'), 'utf8');
if (/function maybeRenderJobForm/.test(index) && /maybeRenderJobForm\(document\.getElementById\('cv-body'\)/.test(index)) test.check('the file viewer still offers the start form for a script under process/');
else test.fail(OWED + 'the file viewer\'s start form is gone');

test.reportSuccessFailureCount();
