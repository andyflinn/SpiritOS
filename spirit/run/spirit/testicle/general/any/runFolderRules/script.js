'use strict';
// spirit/run/spirit/testicle/general/any/runFolderRules/script.js
// A RULE MODULE OF THE GENERAL TEST: run:// holds only spirit/: run://process named nowhere (goal/G43.20, G43.30),
// run://test/ moved into run://spirit/test/ and named nowhere, testModule.js listing no tool as a test, .gitignore covering
// the rest (goal/G43.32).
// goal/G49.27 (the box, Andy's Go: "the general file's seven parts ... each become such a module; generalRules is split
// further by topic"; "a new standard is a new folder, not a longer file"): its checks came from the one general rules
// module, spirit/testicle/general/any/generalRules/script.js, moved here unchanged in what they check and in their titles.
// Its runner is spirit/testicle/run/none/script.js. Its own test: ./test/script.js. A rule module hands out { appliesTo, resource, own, forbids, checks }:
//   appliesTo(scriptPath)      whether a path handed may be one this module judges (the runner asks it before checks)
//   resource                   'none' | 'node' | 'browser' | 'relay': what its checks stand on
//   own                        true when its checks change their node, which then is one of its own
//   forbids                    the names its checks look for, which the name rules skip in its own files (Andy: "All, cw's way")
//   checks(scriptPath, tools)  says its tests, each a test.run with its title; scriptPath '' judges every script it
//                              applies to. tools: { test, run, spirit, node, forbids }, the reporter, the run root judged, its
//                              spirit object, the run's one shared scratch node ({ node }) and every module's forbids by folder.
const SPIRIT = require('../../../../script.js');

function appliesTo(scriptPath) {
  // Every path: given no file, the tree; given a file, that file.
  return true;
}

function checks(scriptPath, tools) {
const ARGS = scriptPath ? [scriptPath] : [];
const test = tools.test;
// A MODULE'S OWN FORBIDDEN NAMES ARE NOT ITS FAULT (goal/G49.27; Andy: "All, cw's way"): a rule module names what it forbids,
// in its titles, its patterns and its comments. A name rule skips exactly the names a module hands out as forbids, and only
// in that module's own files (its script.js and its test/): each such name is blanked, its length kept, before the file is
// read; every other name in those files, and every other file, is judged as any product file. tools.forbids maps each
// module's folder (spirit/testicle/general/<rule>) to its forbids; the runner hands it.
const FORBIDS = tools.forbids || {};
function unforbidden(rel, text) {
  const r = String(rel || '').replace(/^spirit\/run\//, '');
  const own = Object.keys(FORBIDS).filter(function (dir) { return r === dir + '/script.js' || r.indexOf(dir + '/test/') === 0; })[0];
  if (!own) return text;
  let t = String(text);
  FORBIDS[own].forEach(function (n) { t = t.split(n).join(String(n).replace(/[^\n]/g, ' ')); });
  return t;
}
const fs = require('fs');
const path = require('path');
const RUN = tools.run;
// A SCRIPT'S SOURCE WITH LF LINE ENDINGS (goal/G47.1, Andy's red on spirit/app/icons/element.js, 'its code reaches no element
// through spirit.elements', for a comment): a Windows checkout writes CRLF, a line split at LF keeps its CR, and the pattern
// dropping a line's comment (.*$, which stops at a CR) left the comment in, read as code. Read from the run judged.
function readSource(rel) { return fs.readFileSync(path.join(RUN, rel), 'utf8').replace(/\r\n?/g, '\n'); }
const REPO = path.join(RUN, '..', '..');
const VENDORED_FOLDERS = SPIRIT.requireScript('spirit/fs/fileSystem/script.js').VENDORED_FOLDERS;
// Its arguments: the file it judges, if any.
const arg = String(ARGS[0] || '');
let full = '';
for (const p of [path.resolve(arg), path.join(RUN, arg), path.join(REPO, arg)]) {
  if (arg && fs.existsSync(p) && fs.statSync(p).isFile()) { full = p; break; }
}
const rel = full ? path.relative(RUN, full).split(path.sep).join('/') : arg;
// RUN://PROCESS IS NAMED NOWHERE (goal/G43.20, goal/G43.30). Andy, G43.20: "that whole run://process folder NEEDS killing
// with ALL references to it in code, test and documentation."; G43.30: "WSL, your tests make sure that none of the affected
// modules even mention "spirit/run/process/"". Even mention: the module's whole text is read, its comments too.
const PROCESS_NAMED = /spirit\/run\/process\b|run:\/\/?process\b/;
function namesProcess(f) { try { return PROCESS_NAMED.test(unforbidden(f, fs.readFileSync(path.join(RUN, f), 'utf8'))); } catch (e) { return false; } }
// The tracked files the process rule reads: code, tests and vendored code left out.
function processFiles() {
  const tracked = require('child_process').execFileSync('git', ['ls-files'], { cwd: RUN, encoding: 'utf8' }).split('\n');
  return tracked.filter(function (f) {
    return /\.(js|html|json)$/.test(f) && !/(^|\/)test\//.test(f) && !VENDORED_FOLDERS.holds(f) && fs.existsSync(path.join(RUN, f));
  });
}
// RUN://TEST/ MOVES INTO RUN://SPIRIT/TEST/ (goal/G43.32, the box). Andy: "we'll move the contents of run://test/   into
// run://spirit/test/ first.", on Q2: "We need special rules for run://spirit/test/  it will be where run://spirit/app/test/
// finds it's main tools.", and his concluding point: "this move will free the run:// folder namespace and SpiritOS will
// only take up 1 name ("spirit") in it. .gitignore will be updated to ignore the run:/ folder except for run://spirit/".
// The old folder's name is built, never written, so this file and its .md are the only ones that may name it, and the
// scan leaves those two out.
const OLD_TEST = 'spirit/run/' + 'test/';
const OLD_NAMED = new RegExp(OLD_TEST.replace(/\//g, '\\/') + '|run:\\/\\/?' + 'test\\/');
// The tools of run://spirit/test/: tools, not tests (Q2).
const TOOLS = ['testReport.js', 'testModule.js', 'headLessChrome.js'];
function gitIn(cwd, args) { return require('child_process').execFileSync('git', args, { cwd: cwd, encoding: 'utf8' }).split('\n').filter(Boolean); }
function ignoredByGit(rel) {
  try { require('child_process').execFileSync('git', ['check-ignore', '-q', '--no-index', rel], { cwd: REPO, stdio: 'ignore' }); return true; }
  catch (e) { return false; }
}
function every() {
  // no module of spirit/run/ mentions spirit/run/process/
  const E = {};
  test.run('the modules are read', 0.2, function () {
    E.tracked = require('child_process').execFileSync('git', ['ls-files'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(function (f) { return /\.(js|html|json)$/.test(f) && !/(^|\/)test\//.test(f); });
    return E.tracked.length > 0 || false;
  }, test.limit.quick);
  // EACH A WHOLE-TREE CHECK OVER ITS FILES (goal/G49.27, testReport's test.over; Andy: "why cannot a "whole-tree-red" set a
  // testicle row for the failing script and itself as the suite?"): a red row under each file that breaks the rule; nothing
  // read is no list, a red under the runner, as before.
  test.over('none of them names spirit/run/process or run://process, in code or comment', 0.4, function () {
    return E.tracked && E.tracked.length > 0 ? processFiles() : null;
  }, function (f) { return !namesProcess(f); }, test.limit.quick);

  // run://test/ is moved into run://spirit/test/
  test.run('run://test/ holds no tracked file', 0.4, function () {
    const left = gitIn(RUN, ['ls-files', '--', 'test/']);
    return !left.length || false;
  }, test.limit.quick);
  // nothing under spirit/run/ names run://test/
  test.run('the files are read, tests and documents included', 0.2, function () {
    E.files = gitIn(RUN, ['ls-files']).filter(function (f) {
      return /\.(js|md|html|json)$/.test(f) && !VENDORED_FOLDERS.holds(f) && fs.existsSync(path.join(RUN, f));
    });
    return E.files.length > 0 || false;
  }, test.limit.quick);
  test.over('none of them names the old run://test/, in code, comment or document', 0.4, function () {
    return E.files && E.files.length > 0 ? E.files : null;
  }, function (f) { try { return !OLD_NAMED.test(unforbidden(f, fs.readFileSync(path.join(RUN, f), 'utf8'))); } catch (e) { return true; } }, test.limit.quick);
  // run://spirit/test/'s tools are not tests
  test.run('testModule.js lists tests', 0.2, function () {
    const moduleAt = [path.join(RUN, 'spirit', 'testicle', 'testModule', 'script.js'), path.join(RUN, 'test', 'testModule.js')].filter(function (p) { return fs.existsSync(p); })[0];
    E.listed = moduleAt ? require(moduleAt).testsFor('').map(function (t) { return t.test; }) : [];
    return E.listed.length > 0 || false;
  }, test.limit.quick);
  test.run('testModule.js lists none of testReport.js, testModule.js and headLessChrome.js as a test', 0.4, function () {
    const all = E.listed || [];
    const toolsListed = all.filter(function (t) { return TOOLS.indexOf(path.posix.basename(t)) !== -1 && /^(spirit\/)?test\/[^/]+$/.test(t); });
    return (all.length > 0 && !toolsListed.length) || false;
  }, test.limit.quick);
  // git ignores run:// except run://spirit/
  function ignoreLines() { return fs.readFileSync(path.join(REPO, '.gitignore'), 'utf8').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l && l[0] !== '#'; }); }
  test.run('.gitignore holds /spirit/run/* and !/spirit/run/spirit/', 0.4, function () {
    const lines = ignoreLines();
    return (lines.indexOf('/spirit/run/*') !== -1 && lines.indexOf('!/spirit/run/spirit/') !== -1) || false;
  }, test.limit.quick);
  test.run('no other line names a path under run:// outside run://spirit/, since run://* covers it', 0.4, function () {
    const dead = ignoreLines().filter(function (l) {
      const p = l.replace(/^!/, '').replace(/^\//, '');
      return p.indexOf('spirit/run/') === 0 && p.indexOf('spirit/run/spirit/') !== 0 && l !== '/spirit/run/*';
    });
    return !dead.length || false;
  }, test.limit.quick);
  test.run('a new file in run:// outside spirit/ is ignored', 0.4, function () {
    const outside = 'spirit/run/zz-g4332-not-tracked.txt';
    return ignoredByGit(outside) || false;
  }, test.limit.quick);
  test.run('a new file in run://spirit/ is not ignored', 0.4, function () {
    const inside = 'spirit/run/spirit/zz-g4332-not-tracked.txt';
    return !ignoredByGit(inside) || false;
  }, test.limit.quick);
}

function oneFile() {
  // goal/G43.30: every file judged here, app, element or neither, mentions no spirit/run/process (noProcessAnywhere).
  // <address>: it mentions no spirit/run/process
  test.run('it names neither spirit/run/process nor run://process, in code or comment', 0.4, function () {
    return !namesProcess(rel) || false;
  }, test.limit.quick);
}

if (!arg) every();
else if (full) oneFile();
}

// The names its checks look for (goal/G49.27, Andy: "All, cw's way"): the name rules skip exactly these, in this module's own files.
const FORBIDS_NAMES = ['spirit/run/process', 'run://process', 'run:/process'];
module.exports = { appliesTo: appliesTo, resource: 'none', own: false, forbids: FORBIDS_NAMES, checks: checks };
