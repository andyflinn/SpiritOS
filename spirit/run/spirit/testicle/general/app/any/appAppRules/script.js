'use strict';
// spirit/run/spirit/testicle/general/app/any/appAppRules/script.js
// A RULE MODULE OF THE APP GENERAL TEST (goal/G49.27, step 2b; box v5, Andy's Go: "spirit/testicle/ is the faceless test system",
// the general rules become modules, one rule set one module). Its checks are the part "THE APP APP" (appApp), and the two checks "NO APP IS A SHELL ANY MORE" that stood after it at the file's top level of the old app -general runner of spirit/test/,
// moved here unchanged in what they check and in their titles; its runner now, which loads this module and calls it, is spirit/testicle/run/none/script.js.
// Its own test: ./test/script.js. A rule module hands out { appliesTo, resource, own, forbids, checks }
// (spirit/testicle/general/any/typeRules/script.js says each). The two after it never ran there: they stood outside the function that defines test, so the file threw before saying them (goal/G49.27: said here).
// Judged on disc, from the files and the code (comments left out): no node is started (goal/G43.32, the box: "rules for
// sub-folders of run://spirit/app/"; spec: ./test/script.md).
const SPIRIT = require('../../../../../script.js');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Every path handed: a file of an app judges its app, any other path every app, as the file it came from did.
function appliesTo(scriptPath) {
  // Its reach (goal/G49.27, step 3): spirit/app/script.js and everything under spirit/app/, as the reach of the runner it
  // stood in (spirit/app/'s -child- general test, testModule's rule); given nothing, every app.
  const p = String(scriptPath || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^spirit\/run\//, '');
  return !p || p.indexOf('spirit/app/') === 0;
}

// checks(scriptPath, tools): tools { test, run, spirit }; scriptPath '' judges every sub-folder of spirit/app/.
function checks(scriptPath, tools) {
const ARGS = scriptPath ? [scriptPath] : [];
const test = tools.test;
const RUN = tools.run;
function isFile(rel) { try { return fs.statSync(path.join(RUN, rel)).isFile(); } catch (e) { return false; } }
function isDir(rel) { try { return fs.statSync(path.join(RUN, rel)).isDirectory(); } catch (e) { return false; } }

// The tree: every file git keeps and every file not yet added that git does not ignore, so a new app is judged before it
// is committed. A file tracked but deleted on disc is not there.
const TREE = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: RUN, encoding: 'utf8' })
  .split('\n').filter(Boolean).map(function (f) { return f.replace(/^spirit\/run\//, ''); }).filter(isFile);

// OVER THE WHOLE TREE, A CHECK OVER ITS FILES (goal/G49.27, testReport's test.over; Andy: "why cannot a "whole-tree-red" set a
// testicle row for the failing script and itself as the suite?"): a red row under each file that breaks the rule. Handed a
// file, the same check as one test, its red under the file handed, as before. files() answers the list, or null when there is
// too little to judge.
function overTree(title, severity, files, judge, limit) {
  if (!ARGS[0]) return test.over(title, severity, files, judge, limit);
  return test.run(title, severity, function () { const list = files(); return (!!list && list.every(judge)) || false; }, limit);
}

// ── THE APP APP (the box, decided) ──────────────────────────────────────────────────────────────────────────────────
function appApp() {
  // Since goal/G49.4 (box v15: "spirit/app/app will be deleted", "spirit/element/script.js becomes the hard-coded only shell")
  // there is no shell app: its manifest, its element and the node's default shell went with it.
  test.run('the shell app, spirit/app/appSelector.js and spirit/app/appSelector/ are gone', 0.4, function () {
    const gone = ['spirit/app/shell', 'spirit/app/appSelector', 'spirit/app/appSelector.js'].filter(function (p) { return isDir(p) || isFile(p) || TREE.some(function (f) { return f.indexOf(p + '/') === 0; }); });
    return !gone.length ? true : false;
  }, test.limit.quick);
  test.run('the app branch is intrinsic, its six parts (changeAppIcon to serverDEBUG) standing in spirit/element/search/app/', 0.4, function () {
    const parts = ['changeAppIcon', 'changeAppLabel', 'detail', 'rowFormAppActive', 'rowFormToggle', 'serverDEBUG'];
    // goal/G49.23: each part is a folder of its own now, its script at <part>/script.js.
    const missing = parts.filter(function (p) { return !isFile('spirit/element/search/app/' + p + '/script.js'); });
    return !missing.length ? true : false;
  }, test.limit.quick);
}
appApp();

// NO APP IS A SHELL ANY MORE (goal/G49.4, box v15; Andy: "the app manifests shell:true goes, and all the logic that goes
// with it"): no app's <name>.json carries shell.true. Its shell.mount and shell.tile stay, which give an app its face and
// its tile; and spirit/app/app/, the shell app, is gone (Andy: "spirit/app/app will be deleted.").
overTree('no app manifest carries shell.true; mount and tile stay its own', 0.2, function () {
  const apps = path.join(RUN, 'spirit', 'app');
  let names = [];
  try { names = fs.readdirSync(apps, { withFileTypes: true }).filter(function (d) { return d.isDirectory(); }).map(function (d) { return d.name; }); } catch (e) { return null; }
  const manifests = names.filter(function (n) { return fs.existsSync(path.join(apps, n, n + '.json')); }).map(function (n) { return path.relative(RUN, path.join(apps, n, n + '.json')).split(path.sep).join('/'); });
  return manifests.length > 10 ? manifests : null;
}, function (f) {
  try { const j = JSON.parse(fs.readFileSync(path.join(RUN, f), 'utf8')); return !(!!j.shell && Object.prototype.hasOwnProperty.call(j.shell, 'true')); } catch (e) { return false; }
}, test.limit.quick);
test.run('spirit/app/app/, the shell app, is gone: the one shell is spirit/element/script.js', 0.2, function () {
  return (!fs.existsSync(path.join(RUN, 'spirit', 'app', 'app')) && fs.existsSync(path.join(RUN, 'spirit', 'element', 'script.js'))) || false;
}, test.limit.quick);
}

// The names its checks look for: none (goal/G49.27, Andy: "All, cw's way").
const FORBIDS_NAMES = [];
module.exports = { appliesTo: appliesTo, resource: 'none', own: false, forbids: FORBIDS_NAMES, checks: checks };
