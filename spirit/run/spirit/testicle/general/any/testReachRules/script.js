'use strict';
// spirit/run/spirit/testicle/general/any/testReachRules/script.js
// A RULE MODULE OF THE GENERAL TEST (goal/G49.27, step 2a; box v5, Andy's Go: "spirit/testicle/ is the faceless test system",
// the general rules become modules, one rule set one module). Its checks are the part testReachRules(ARGS) of
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
  // A production file: a file in a test folder is no module this rule judges (checks says the same).
  return !/(^|\/)test\//.test(String(scriptPath || '').replace(/\\/g, '/'));
}

function checks(scriptPath, tools) {
const ARGS = scriptPath ? [scriptPath] : [];
const test = tools.test;

// spirit/run/spirit/test/script-sibling-testReachRules.js [file]
// NO PRODUCTION MODULE LOADS A TEST FILE (goal/G41.30, spec: ./script-sibling-testReachRules.md). The box: "1) no
// production module loads or requires any test file, with the exception of DEBUG.js." Its name is its reach
// (./TEST_SYSTEM.md): a -sibling- test beside spirit.js judges every production module in spirit/run/ and below.
//
// Judged in the code, comments left out: no require(), import(), spirit.requireScript(), readFileSync() or createReadStream()
// of a path into a test/ folder. A path is read from the call's own text, its string pieces joined as path.join joins
// them, so path.join(__dirname, '..', '..', 'testReachRules', 'test', 'x.js') is caught as 'test/x.js' is. Running a suite as its own process (spawn,
// execFile, fork) loads nothing into the module, and is not asked: the desk and its verifier run suites by their path.
// DEBUG.js (spirit/DEBUG/script.js and spirit/DEBUG/) is the one exception. Each call that breaks it is its own check, named
// by its file and line.
//
// Given a file, it judges that one; given none, every tracked production .js file under spirit/run. It stands in
// spirit/test/ beside spirit/script.js since goal/G43.32 (./TEST_SYSTEM.md).

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RUN = tools.run;
// A script's source with LF line endings, read from the run judged (the runner's readSource, goal/G47.1).
function readSource(rel) { return fs.readFileSync(path.join(RUN, rel), 'utf8').replace(/\r\n?/g, '\n'); }
const REPO = path.join(RUN, '..', '..');
const VENDORED_FOLDERS = SPIRIT.requireScript('spirit/fs/fileSystem/script.js').VENDORED_FOLDERS;
const arg = String(ARGS[0] || '');
// WHAT FITS (box v94, 2): a production file; a file in a test folder is no module this rule judges.
if (/(^|\/)test\//.test(arg.replace(/\\/g, '/'))) return;

// A production file: tracked, .js, not inside a test folder (spirit/test/'s tools included), no vendor code.
function production(rel) {
  return /\.js$/.test(rel) && !/(^|\/)test\//.test(rel) && !VENDORED_FOLDERS.holds(rel);
}
// THE ONE EXCEPTION (the box: "with the exception of DEBUG.js"): its test routes serve a test folder's pages.
function excepted(rel) { return rel === 'spirit/DEBUG/script.js' || rel.indexOf('spirit/DEBUG/') === 0; }

// The code with its comments blanked, line breaks kept, so a line number stays a line number. Strings are kept whole.
function code(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '/' && n === '*') { while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; } out += '  '; i += 2; continue; }
    if (c === '\'' || c === '"' || c === '`') {
      const q = c; out += c; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') { out += src[i]; i++; } out += src[i]; i++; }
      out += q; i++; continue;
    }
    out += c; i++;
  }
  return out;
}
// The text of a call's parentheses, from the ( after its name, balanced, at most 400 characters.
function argsAt(text, open) {
  let depth = 0;
  for (let i = open; i < text.length && i < open + 400; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') { depth--; if (depth === 0) return text.slice(open + 1, i); }
  }
  return text.slice(open + 1, open + 400);
}
// The path a call's arguments name: its string pieces joined with '/', as path.join joins them.
function pathIn(args) {
  const pieces = [];
  const re = /'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\])*)`/g;
  let m;
  while ((m = re.exec(args))) pieces.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
  return pieces.join('/').replace(/\/+/g, '/');
}
const LOADS = /\b(require|import|readFileSync|createReadStream|readFile)\s*\(/g;
// The calls of one file that load a path into a test folder: [{ line, call, path }].
function reaches(rel) {
  const text = code(readSource(rel));
  const out = [];
  let m;
  LOADS.lastIndex = 0;
  while ((m = LOADS.exec(text))) {
    const named = pathIn(argsAt(text, m.index + m[0].length - 1));
    if (/(^|\/)test(\/|$)/.test(named)) out.push({ line: text.slice(0, m.index).split('\n').length, call: m[1], path: named });
  }
  return out;
}

let judged = null;
function read() {
  let files = [];
  if (arg) {
    const rel = path.relative(RUN, path.resolve(fs.existsSync(path.resolve(arg)) ? arg : path.join(RUN, arg))).split(path.sep).join('/');
    files = [rel];
  } else {
    files = execFileSync('git', ['ls-files', '--', '.'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(Boolean)
      .filter(function (f) { return production(f) && fs.existsSync(path.join(RUN, f)); });
  }
  judged = files.filter(function (f) { return !excepted(f); });
  return judged;
}
// every production module, its code read
if (!arg) {
  test.run('the scan read every production module, more than a hundred files', 0.2, function () {
    return read().length > 100 || false;
  }, test.limit.quick);
}
// A WHOLE-TREE CHECK OVER ITS FILES (goal/G49.27, testReport's test.over; Andy: "why cannot a "whole-tree-red" set a testicle
// row for the failing script and itself as the suite?"): a red row under each file that breaks the rule.
test.over('no production module loads or requires a test file', 0.4, function () {
  if (!judged) read();
  return judged;
}, function (rel) { return reaches(rel).length === 0; }, test.limit.quick);
}

// No name its checks look for is skipped in its files (goal/G49.27, Andy: "All, cw's way"): it forbids none by name.
const FORBIDS_NAMES = [];
module.exports = { appliesTo: appliesTo, resource: 'none', own: false, forbids: FORBIDS_NAMES, checks: checks };
