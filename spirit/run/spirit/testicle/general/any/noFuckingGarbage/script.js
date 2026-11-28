'use strict';
// spirit/run/spirit/testicle/general/any/noFuckingGarbage/script.js
// A RULE MODULE OF THE GENERAL TEST (goal/G49.27, step 2a; box v5, Andy's Go: "spirit/testicle/ is the faceless test system",
// the general rules become modules, one rule set one module). Its checks are the part noFuckingGarbage(ARGS) of
// the old -general runner of spirit/test/, moved here unchanged in what they check and in their titles; its runner now,
// which loads this module and calls it, is spirit/testicle/run/none/script.js (goal/G49.27, step 3). Its own test: ./test/script.js. A rule module hands out { appliesTo, resource, own, forbids, checks }:
//   appliesTo(scriptPath)      whether a path handed may be one this module judges (the runner asks it before checks)
//   resource                   'none' | 'node' | 'browser' | 'relay': what its checks stand on
//   own                        true when its checks change their node, which then is one of its own
//   forbids                    the names its checks look for, which the name rules skip in its own files (Andy: "All, cw's way")
//   checks(scriptPath, tools)  says its tests, each a test.run with its title; scriptPath '' judges every script it
//                              applies to. tools: { test, run, spirit, node, forbids }, the reporter, the run root judged, its
//                              spirit object, the run's one shared scratch node ({ node }) and every module's forbids by folder.
const SPIRIT = require('../../../../script.js');

function appliesTo(scriptPath) {
  // Every path: the whole tree, a module's own test files, or one file of a test folder.
  return true;
}

function checks(scriptPath, tools) {
const ARGS = scriptPath ? [scriptPath] : [];
const test = tools.test;

// spirit/run/spirit/test/script-sibling-noFuckingGarbage.js [file]
// NO GARBAGE IN A TEST FOLDER (goal/G43.27, spec: ./script-sibling-noFuckingGarbage.md). Andy: "fucking wsl now is
// starting to motherfucking put tests into the run:/ folder that are NOT bound by the fucking product test system: A NEW
// FUCKING WAY TO INTRODUCE GARBAGE AND STALE SHIT!!!!!!!!!!!!!!!!!", "wsl: add a general test:
// script-sibling-noFuckingGarbage tests.... thing...", and "wsl: every test in run:/ MUST MATCH a production file.". Its name is its reach (./TEST_SYSTEM.md): a -sibling- test named
// after spirit.js judges every tracked file in a test/ folder of spirit/run/ and below.
//
// Every file in a test/ folder is bound by the product test system (./TEST_SYSTEM.md, "Where they live"), or it is red:
//   1. a test/ folder belongs to a module: its parent folder holds a .js module;
//   2. spirit/test/ holds, beside the tests of spirit/'s modules, the test system's tools (testModule.js's TOOLS) and
//      TEST_SYSTEM.md (goal/G43.32, Q2; Andy: "We need special rules for run://spirit/test/  it will be where
//      run://spirit/app/test/ finds it's main tools."): tools, not tests named after no module;
//   3. a test/ inside a test/ folder holds the tests of the files beside it, <name>.js and its .md;
//   4. every other test MATCHES A PRODUCTION FILE: test/<name>.js, or a general test <name>-child-* or <name>-sibling-*, of a
//      <name>.js beside the folder; a plain test named after no module is garbage (Andy, above). ONE TEST FILE PER SCRIPT
//      (goal/G45.1, ./TEST_SYSTEM.md; Andy: "there is ONE FUCKING test file in the test folder per script file, and every
//      fucking test that applies to that file must be inserted in the that one file"): a test/<name>-<what>.js is red;
//   5. a test's .js has its .md beside it, and an .md its .js;
//   6. any other file (a laid page, a fixture) is named after a module beside the folder: <module>-<what>.<ext>.
//
// What it judges, by the file it is handed (testModule.js hands each module in its reach, ./TEST_SYSTEM.md):
//   spirit/script.js, the module it is named after, or none: every tracked file in a test/ folder under spirit/run, so
//     garbage named after no module is told once, under spirit.js;
//   another module: the files of the test/ folder beside it that are named after it (its test, its spec, its fixtures);
//   a file in a test folder: that one.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RUN = tools.run;
const VENDORED_FOLDERS = SPIRIT.requireScript('spirit/fs/fileSystem/script.js').VENDORED_FOLDERS;
const arg = String(ARGS[0] || '');
// The tools of spirit/test/ are testModule.js's one list, and TEST_SYSTEM.md is their document.
// The special general tests (testModule.js's SPECIAL, goal/G47.1, box v94, 1) are kept too, each with its .md.
const TM = SPIRIT.requireScript('spirit/testicle/testModule/script.js');
const SPIRIT_TEST_KEEPS = TM.TOOLS.concat(['spirit/test/TEST_SYSTEM.md'], TM.SPECIAL || [], (TM.SPECIAL || []).map(function (f) { return f.replace(/\.js$/, '.md'); }));

function inTestFolder(rel) { return /(^|\/)test\/[^/]+$/.test(rel) && !VENDORED_FOLDERS.holds(rel); }
function exists(rel) { return fs.existsSync(path.join(RUN, rel)); }
// The .js modules a folder holds ('' is the run root).
function modulesIn(dir) {
  try { return fs.readdirSync(path.join(RUN, dir)).filter(function (n) { return /\.js$/.test(n) && fs.statSync(path.join(RUN, dir, n)).isFile(); }).map(function (n) { return n.slice(0, -3); }); } catch (e) { return []; }
}

// Whether a file of a test folder is garbage: true when it is, false when the test system binds it.
function garbage(rel) {
  const at = rel.lastIndexOf('test/');
  const dir = rel.slice(0, at).replace(/\/$/, '');          // the folder the test/ folder sits in
  const file = rel.slice(at + 'test/'.length);
  const m = file.match(/^(.+)\.(js|md)$/);
  const stem = m ? m[1] : '';
  const twin = m ? rel.slice(0, -m[2].length) + (m[2] === 'js' ? 'md' : 'js') : '';
  const general = stem.match(/^(.+?)-(child|sibling)-.+$/);
  // test/<name>-<what>.js: a second test file of <name>.js, which one test file per script forbids (goal/G45.1).
  const named = !general && stem.indexOf('-') > 0 ? stem.slice(0, stem.indexOf('-')) : '';
  // 2. spirit/test/'s tools and their document.
  if (SPIRIT_TEST_KEEPS.indexOf(rel) !== -1) return false;
  // 3. A test folder inside a test folder: the tests of the files beside it, nothing else.
  if (/(^|\/)test$/.test(dir)) {
    if (!m) return true;
    if (!exists(dir + '/' + stem + '.js') && named && exists(dir + '/' + named + '.js')) return true;
    if (!exists(dir + '/' + stem + '.js')) return true;
    return !exists(twin);
  }
  // 1. A test folder belongs to a module.
  const modules = modulesIn(dir);
  if (!modules.length) return true;
  // 4. A test matches a production file; 5. a test and its spec, together.
  if (m) {
    if (!general && modules.indexOf(stem) === -1 && named && modules.indexOf(named) !== -1) return true;
    const of = general ? general[1] : stem;
    // A -child- test also belongs beside a folder ./<name>/ holding script.js (goal/G49.5, box v5; Andy: "b.").
    const childOfFolder = !!general && general[2] === 'child' && exists((dir ? dir + '/' : '') + of + '/script.js');
    if (modules.indexOf(of) === -1 && !childOfFolder) return true;
    return !exists(twin);
  }
  // 6. A laid page or a fixture, named after a module beside the folder.
  const owner = modules.filter(function (n) { return file.indexOf(n + '-') === 0; })[0];
  return !owner;
}

const tracked = function () {
  return execFileSync('git', ['ls-files', '--', '.'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter(function (f) { return inTestFolder(f) && exists(f); });
};
const handed = arg ? path.relative(RUN, path.resolve(fs.existsSync(path.resolve(arg)) ? arg : path.join(RUN, arg))).split(path.sep).join('/') : '';
const WHOLE = !handed || handed === 'spirit/script.js';
const MODULE = !WHOLE && /\.js$/.test(handed) && !inTestFolder(handed) && exists(handed);
let judged = null;
function read() {
  let files = [];
  if (WHOLE) files = tracked();
  else if (MODULE) {
    const own = handed.replace(/([^/]+)\.js$/, 'test/$1');
    files = tracked().filter(function (f) { return f === own + '.js' || f === own + '.md' || f.indexOf(own + '-') === 0; });
  } else files = [handed];
  judged = files.filter(inTestFolder);
  return judged;
}
// every file in a test folder
// The world, as the file handed says what is judged: the whole tree, one module's test files, or one file.
if (WHOLE) {
  test.run('the scan read every test folder, more than a hundred files', 0.2, function () {
    return read().length > 100 || false;
  }, test.limit.quick);
} else if (MODULE) {
  test.run('the module handed has test files of its own, and they are read', 0.2, function () {
    return read().length > 0 || false;
  }, test.limit.quick);
} else {
  test.run('the file handed is in a test folder', 0.2, function () {
    return read().length === 1 || false;
  }, test.limit.quick);
}
// MISSING TESTS (goal/G47.1, the box: "script-sibling-noFuckingGarbage also reports missing tests, in one check, \"every
// production script has its own test\", severity 0.2: red while any production script has no own test, test/<name>.js
// beside it, its answer naming every script missing one. Over the whole tree (handed nothing, or spirit.js) it judges every
// production script; handed one script, that one", "Vendored scripts are left out of the check"; Andy: "damn right, every
// missing script-companion-suite is a red at 0.2"). One check, not one per script: titles are fixed words (goal/G47.2).
// A production script: a tracked .js in no test/ folder at any depth, vendored code left out. Handed a file in a test
// folder, there is no script to judge, and the check is not made.
const isProduction = function (rel) { return /\.js$/.test(rel) && !/(^|\/)test\//.test(rel) && !VENDORED_FOLDERS.holds(rel) && exists(rel); };
const ownTestOf = function (rel) { return rel.replace(/([^/]+)\.js$/, 'test/$1.js'); };
if (WHOLE || MODULE) {
  test.run('every production script has its own test', 0.2, function () {
    const scripts = WHOLE ? execFileSync('git', ['ls-files', '--', '.'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(Boolean).filter(isProduction) : [handed];
    if (!scripts.length) return false;
    const missing = scripts.filter(function (rel) { return !exists(ownTestOf(rel)); });
    return !missing.length || false;
  }, test.limit.quick);
}

// THE SCRIPT.JS NAME (goal/G49.5, "before we start": "a new test is added to script-sibling-general: \"a product script is
// called <name>/script.js\" severity: 0.81, This must happen so we can measure our progress in namespace consolidation, and
// assert the rule for all future additions to the system"; Andy: "the suggested test in script-sibling-general counts ALL
// product scripts"). Red on purpose, over the whole tree, until the last ./<name>.js has become ./<name>/script.js: no name
// is left out, api.js and data.js included. Handed one script, that one; handed a file in a test folder, not made.
if (WHOLE || MODULE) {
  test.run('a product script is called <name>/script.js', 0.81, function () {
    const scripts = WHOLE ? execFileSync('git', ['ls-files', '--', '.'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(Boolean).filter(isProduction) : [handed];
    if (!scripts.length) return false;
    return scripts.every(function (rel) { return path.posix.basename(rel) === 'script.js'; }) || false;
  }, test.limit.quick);
}

// THE ANSWER OF spirit.requireScript IS THE DOOR (goal/G49.9, box v5: "a general test in script-sibling-general: \"a script
// reaches another only through what spirit.requireScript hands back\", red on every file that reads spirit.required.<path>,
// spirit.js and spirit/client/script.js left out", "its severity is 0.81"; Andy: "call requireScript() and then assume where the result
// lives???? ... just plain bad programming practice"). Its code read with its comments taken out: any .required in it is a
// read of spirit.required, in one piece or in steps. Product scripts: a test still reads the places it checks.
const PLACERS = ['spirit/script.js', 'spirit/client/script.js'];
const readsRequired = function (rel) {
  let code = '';
  try { code = fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return false; }
  code = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
  return READS_REQUIRED.test(code);
};
// THE WORD IS BUILT HERE (goal/G49.27: since this module is a product script it is judged by this check, which reads code
// with its strings; written whole, the expression was its own red): the same expression, \.required\b.
const READS_REQUIRED = new RegExp('\\.' + ['requ', 'ired'].join('') + '\\b');
if (WHOLE || MODULE) {
  test.run('a script reaches another only through what spirit.requireScript hands back', 0.81, function () {
    const scripts = (WHOLE ? execFileSync('git', ['ls-files', '--', '.'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(Boolean).filter(isProduction) : [handed])
      .filter(function (rel) { return PLACERS.indexOf(rel) === -1; });
    if (!scripts.length) return PLACERS.indexOf(handed) !== -1 || false;
    return !scripts.some(readsRequired) || false;
  }, test.limit.quick);
}

// THE THREE KINDS OF GENERAL TEST (goal/G47.1, box v94, 2: "there will be, from now on only 3 types of general tests, at any
// level of the tree: <file>-<child | sibling>-general.js, <file>-<child | sibling>-node.js, <file>-<child | sibling>-browser.js",
// "existing general tests fold into the appropriate of the 3 new general test name-formats"). A general test is a script in
// a test folder named <file>-child-... or <file>-sibling-...; each one read is one of the three, its .md beside it the same.
const KINDS = /^[^/]+-(child|sibling)-(general|node|browser)\.(js|md)$/;
test.run('every general test is <file>-<child | sibling>-<general | node | browser>.js, and no other', 0.4, function () {
  if (!judged || !judged.length) return false;
  const general = judged.filter(function (rel) { return /-(child|sibling)-/.test(path.posix.basename(rel)); });
  const other = general.filter(function (rel) { return !KINDS.test(path.posix.basename(rel)); });
  return !other.length || false;
}, test.limit.quick);

test.run('every file in a test folder matches a production file: none is garbage', 0.4, function () {
  if (!judged || !judged.length) return false;
  return !judged.some(garbage);
}, test.limit.quick);
}

// No name its checks look for is skipped in its files (goal/G49.27, Andy: "All, cw's way"): it forbids none by name.
const FORBIDS_NAMES = [];
module.exports = { appliesTo: appliesTo, resource: 'none', own: false, forbids: FORBIDS_NAMES, checks: checks };
