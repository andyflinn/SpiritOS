'use strict';

// spirit/run/spirit/test/spirit-sibling-noFuckingGarbage.js [file]
// NO GARBAGE IN A TEST FOLDER (goal/G43.27, spec: ./spirit-sibling-noFuckingGarbage.md). Andy: "fucking wsl now is
// starting to motherfucking put tests into the run:/ folder that are NOT bound by the fucking product test system: A NEW
// FUCKING WAY TO INTRODUCE GARBAGE AND STALE SHIT!!!!!!!!!!!!!!!!!", "wsl: add a general test:
// spirit-sibling-noFuckingGarbage tests.... thing...", and "wsl: every test in run:/ MUST MATCH a production file.". Its name is its reach (./TEST_SYSTEM.md): a -sibling- test named
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
//   spirit/spirit.js, the module it is named after, or none: every tracked file in a test/ folder under spirit/run, so
//     garbage named after no module is told once, under spirit.js;
//   another module: the files of the test/ folder beside it that are named after it (its test, its spec, its fixtures);
//   a file in a test folder: that one.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
// The product test system's own reporter (goal/G40.13).
const test = require(path.join(__dirname, 'testReport.js'));

const RUN = path.join(__dirname, '..', '..');
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;
const ARGS = process.argv.slice(2).filter(function (a, i, all) { return a !== '--verify-port' && all[i - 1] !== '--verify-port'; });
const arg = String(ARGS[0] || '');
const RULE = 'Andy: "every test in run:/ MUST MATCH a production file."';
// The tools of spirit/test/ are testModule.js's one list, and TEST_SYSTEM.md is their document.
// The special general tests (testModule.js's SPECIAL, goal/G47.1, box v94, 1) are kept too, each with its .md.
const TM = require(path.join(__dirname, 'testModule.js'));
const SPIRIT_TEST_KEEPS = TM.TOOLS.concat(['spirit/test/TEST_SYSTEM.md'], TM.SPECIAL || [], (TM.SPECIAL || []).map(function (f) { return f.replace(/\.js$/, '.md'); }));

function inTestFolder(rel) { return /(^|\/)test\/[^/]+$/.test(rel) && !VENDORED_FOLDERS.holds(rel); }
function exists(rel) { return fs.existsSync(path.join(RUN, rel)); }
// The .js modules a folder holds ('' is the run root).
function modulesIn(dir) {
  try { return fs.readdirSync(path.join(RUN, dir)).filter(function (n) { return /\.js$/.test(n) && fs.statSync(path.join(RUN, dir, n)).isFile(); }).map(function (n) { return n.slice(0, -3); }); } catch (e) { return []; }
}

// Why a file of a test folder is garbage, or '' when the test system binds it.
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
  const second = function () { return 'a second test file of ' + named + '.js: one test file per script, its tests go into test/' + named + '.js'; };
  // 2. spirit/test/'s tools and their document.
  if (SPIRIT_TEST_KEEPS.indexOf(rel) !== -1) return '';
  // 3. A test folder inside a test folder: the tests of the files beside it, nothing else.
  if (/(^|\/)test$/.test(dir)) {
    if (!m) return 'not a test: no .js or .md';
    if (!exists(dir + '/' + stem + '.js') && named && exists(dir + '/' + named + '.js')) return second();
    if (!exists(dir + '/' + stem + '.js')) return 'no ' + dir + '/' + stem + '.js beside this test folder: a test here tests a file of ' + dir + '/, and no other';
    return exists(twin) ? '' : (m[2] === 'js' ? 'no ' + path.basename(twin) + ' beside it: the test has no spec' : 'no ' + path.basename(twin) + ' beside it: a spec with no test');
  }
  // 1. A test folder belongs to a module.
  const modules = modulesIn(dir);
  if (!modules.length) return 'no module in ' + dir + '/: a test folder belongs to the module beside it';
  // 4. A test matches a production file; 5. a test and its spec, together.
  if (m) {
    if (!general && modules.indexOf(stem) === -1 && named && modules.indexOf(named) !== -1) return second();
    const of = general ? general[1] : stem;
    if (modules.indexOf(of) === -1) return 'no ' + (dir ? dir + '/' : '') + of + '.js: ' + (general ? 'a general test of a module that is not beside the folder' : 'a test that matches no production file');
    return exists(twin) ? '' : (m[2] === 'js' ? 'no ' + path.basename(twin) + ' beside it: the test has no spec' : 'no ' + path.basename(twin) + ' beside it: a spec with no test');
  }
  // 6. A laid page or a fixture, named after a module beside the folder.
  const owner = modules.filter(function (n) { return file.indexOf(n + '-') === 0; })[0];
  return owner ? '' : 'named after no module beside the folder: a fixture is <module>-<what>.<ext>';
}

const tracked = function () {
  return execFileSync('git', ['ls-files', '--', '.'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter(function (f) { return inTestFolder(f) && exists(f); });
};
const handed = arg ? path.relative(RUN, path.resolve(fs.existsSync(path.resolve(arg)) ? arg : path.join(RUN, arg))).split(path.sep).join('/') : '';
const WHOLE = !handed || handed === 'spirit/spirit.js';
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
  test.comment(judged.length + ' files in test folders read');
  return judged;
}
// every file in a test folder
// The world, as the file handed says what is judged: the whole tree, one module's test files, or one file.
if (WHOLE) {
  test.run('the scan read every test folder, more than a hundred files', 0.2, function () {
    return read().length > 100 || 'the scan read only ' + judged.length + ' files: it judged too little to say';
  }, test.limit.quick);
} else if (MODULE) {
  test.run('the module handed has test files of its own, and they are read', 0.2, function () {
    return read().length > 0 || handed + ' has no test of its own: nothing judged';
  }, test.limit.quick);
} else {
  test.run('the file handed is in a test folder', 0.2, function () {
    return read().length === 1 || arg + ' is neither a module nor a tracked file in a test folder: nothing judged';
  }, test.limit.quick);
}
// MISSING TESTS (goal/G47.1, the box: "spirit-sibling-noFuckingGarbage also reports missing tests, in one check, \"every
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
    if (!scripts.length) return 'no production script found: nothing judged';
    const missing = scripts.filter(function (rel) { return !exists(ownTestOf(rel)); });
    test.comment(scripts.length + ' production scripts judged, ' + missing.length + ' without their own test');
    return !missing.length || missing.length + ' of ' + scripts.length + ' have no own test: ' + missing.join(', ');
  }, test.limit.quick);
}

// THE THREE KINDS OF GENERAL TEST (goal/G47.1, box v94, 2: "there will be, from now on only 3 types of general tests, at any
// level of the tree: <file>-<child | sibling>-general.js, <file>-<child | sibling>-node.js, <file>-<child | sibling>-browser.js",
// "existing general tests fold into the appropriate of the 3 new general test name-formats"). A general test is a script in
// a test folder named <file>-child-... or <file>-sibling-...; each one read is one of the three, its .md beside it the same.
const KINDS = /^[^/]+-(child|sibling)-(general|node|browser)\.(js|md)$/;
test.run('every general test is <file>-<child | sibling>-<general | node | browser>.js, and no other', 0.4, function () {
  if (!judged || !judged.length) return 'no file in a test folder read: nothing judged';
  const general = judged.filter(function (rel) { return /-(child|sibling)-/.test(path.posix.basename(rel)); });
  const other = general.filter(function (rel) { return !KINDS.test(path.posix.basename(rel)); });
  return !other.length || other.length + ' general tests of another name: ' + other.join(', ');
}, test.limit.quick);

// Each file that is garbage named in the answer, by its path and why.
test.run('every file in a test folder matches a production file: none is garbage', 0.4, function () {
  if (!judged || !judged.length) return 'no file in a test folder read: nothing judged';
  const bad = judged.map(function (rel) { const why = garbage(rel); return why ? rel + ': garbage, ' + why + ' (' + RULE + ')' : ''; }).filter(Boolean);
  return !bad.length || bad.join('; ');
}, test.limit.quick);
