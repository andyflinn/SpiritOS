'use strict';

// spirit/run/spirit/test/spirit-sibling-testReachRules.js [file]
// NO PRODUCTION MODULE LOADS A TEST FILE (goal/G41.30, spec: ./spirit-sibling-testReachRules.md). The box: "1) no
// production module loads or requires any test file, with the exception of DEBUG.js." Its name is its reach
// (./TEST_SYSTEM.md): a -sibling- test beside spirit.js judges every production module in spirit/run/ and below.
//
// Judged in the code, comments left out: no require(), import(), spirit.require(), readFileSync() or createReadStream()
// of a path into a test/ folder. A path is read from the call's own text, its string pieces joined as path.join joins
// them, so path.join(__dirname, 'test', 'x.js') is caught as 'test/x.js' is. Running a suite as its own process (spawn,
// execFile, fork) loads nothing into the module, and is not asked: the desk and its verifier run suites by their path.
// DEBUG.js (spirit/DEBUG.js and spirit/DEBUG/) is the one exception. Each call that breaks it is its own check, named
// by its file and line.
//
// Given a file, it judges that one; given none, every tracked production .js file under spirit/run. It stands in
// spirit/test/ beside spirit/spirit.js since goal/G43.32 (./TEST_SYSTEM.md).

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
// The product test system's own reporter (goal/G40.13).
const test = require(path.join(__dirname, 'testReport.js'));

const RUN = path.join(__dirname, '..', '..');
const REPO = path.join(RUN, '..', '..');
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;
const ARGS = process.argv.slice(2).filter(function (a, i, all) { return a !== '--verify-port' && all[i - 1] !== '--verify-port'; });
const arg = String(ARGS[0] || '');

// A production file: tracked, .js, not inside a test folder (spirit/test/'s tools included), no vendor code.
function production(rel) {
  return /\.js$/.test(rel) && !/(^|\/)test\//.test(rel) && !VENDORED_FOLDERS.holds(rel);
}
// THE ONE EXCEPTION (the box: "with the exception of DEBUG.js"): its test routes serve a test folder's pages.
function excepted(rel) { return rel === 'spirit/DEBUG.js' || rel.indexOf('spirit/DEBUG/') === 0; }

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
  const text = code(fs.readFileSync(path.join(RUN, rel), 'utf8'));
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
  test.comment(judged.length + ' production files read; the exception: DEBUG.js (spirit/DEBUG.js, spirit/DEBUG/)');
  return judged;
}
// every production module, its code read
if (!arg) {
  test.run('the scan read every production module, more than a hundred files', 0.2, function () {
    return read().length > 100 || 'the scan read only ' + judged.length + ' files: it judged too little to say';
  }, 1000);
}
// Each call that breaks it named in the answer, by its file and line.
test.run('no production module loads or requires a test file', 0.4, function () {
  if (!judged) read();
  const bad = [];
  judged.forEach(function (rel) {
    reaches(rel).forEach(function (r) {
      bad.push(rel + ':' + r.line + ' ' + r.call + '() loads ' + r.path + ', a test file (the box: "no production module loads or requires any test file, with the exception of DEBUG.js.")');
    });
  });
  return !bad.length || bad.join('; ');
}, 1000);
