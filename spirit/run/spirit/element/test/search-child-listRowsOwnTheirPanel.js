'use strict';

// spirit/run/spirit/element/test/search-child-listRowsOwnTheirPanel.js [file]
// A LIST ROW'S PANEL OWNS ITS PARTS (goal/G43.19, spec: ./search-child-listRowsOwnTheirPanel.md). Andy: "all: cw just did an
// emergency fix for me, which could be asserted with a general test spirit/element/test/search-child-listRowsOwnTheirPanel.js",
// and "wsl? can you please add such a test now?". What cw fixed at 19329f1d: a second item's details, mounted in a layer
// of their own, found their parts with document.getElementById and drew into the first item's hidden layer. The rule:
// an element finds its parts inside its own container, never by id across the page.
// Its name is its reach (../../../test/TEST_SYSTEM.md): a -child- test beside spirit/element/search.js judges search.js
// and every module in spirit/element/search/ and below. Judged in the code, comments left out: no document.getElementById,
// document.querySelector, document.querySelectorAll or document.getElementsBy*: each one is its own red, by file and line.
//
// Given a file, it judges that one (as testModule.js hands it); given none, search.js and every tracked module below it.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..');
// The product test system's own reporter (goal/G40.13).
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

const ARGS = process.argv.slice(2).filter(function (a, i, all) { return a !== '--verify-port' && all[i - 1] !== '--verify-port'; });
const arg = String(ARGS[0] || '');
const MODULE = 'spirit/element/search.js';
const BELOW = 'spirit/element/search/';
const RULE = 'an element finds its parts inside its own container, never by id across the page';

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
// A lookup across the whole page: the document asked for an element, by id, selector, class, tag or name.
const ACROSS = /\bdocument\s*\.\s*(getElementById|querySelectorAll|querySelector|getElementsByClassName|getElementsByTagName|getElementsByName)\s*\(/g;
function across(rel) {
  const text = code(fs.readFileSync(path.join(RUN, rel), 'utf8'));
  const out = [];
  let m;
  ACROSS.lastIndex = 0;
  while ((m = ACROSS.exec(text))) out.push({ line: text.slice(0, m.index).split('\n').length, call: 'document.' + m[1] });
  return out;
}
function inReach(rel) { return rel === MODULE || (rel.indexOf(BELOW) === 0 && /\.js$/.test(rel) && !/(^|\/)test\//.test(rel)); }

test.startTest('search-child-listRowsOwnTheirPanel.js: ' + RULE + ' (goal/G43.19)');
let files = [];
if (arg) {
  files = [path.relative(RUN, path.resolve(fs.existsSync(path.resolve(arg)) ? arg : path.join(RUN, arg))).split(path.sep).join('/')];
} else {
  files = execFileSync('git', ['ls-files', '--', MODULE, BELOW], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(Boolean)
    .map(function (f) { return f.replace(/^spirit\/run\//, ''); }).filter(function (f) { return inReach(f) && fs.existsSync(path.join(RUN, f)); });
}
test.subHeading('every module of search.js and below, its code read');
const judged = files.filter(function (f) { return inReach(f) && fs.existsSync(path.join(RUN, f)); });
if (arg) ok(judged.length === 1, 'the world: the module asked is search.js or a module below it', arg + ' is not search.js or a module below it: nothing judged');
else ok(judged.length > 10, 'the world: more than ten modules read', 'only ' + judged.length + ' modules read: too little to judge');
let broken = 0;
judged.forEach(function (rel) {
  across(rel).forEach(function (a) {
    broken++;
    test.subHeading(rel);
    test.fail(rel + ':' + a.line + ' ' + a.call + '() finds a part across the whole page (' + RULE + ')');
  });
});
if (!broken && judged.length) ok(true, 'an element finds its parts inside its own container, never by id across the page: no module looks across the page', '');
test.reportSuccessFailureCount();
process.exit(0);

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
