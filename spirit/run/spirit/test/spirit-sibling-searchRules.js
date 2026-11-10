'use strict';

// spirit/run/spirit/test/spirit-sibling-searchRules.js <file>
// THE SEARCH RULE OF A MODULE (goal/G41.28), run once per file it judges, the file its argument, as
// ./spirit-child-generalRules.js is for a module (spec: ./spirit-sibling-searchRules.md). Its name is its reach
// (./TEST_SYSTEM.md): a -sibling- test beside spirit.js judges every module in spirit/run/ and below that has its own
// test, a server and a page alike.
//
// THE WHOLE ROW, NEVER A FEW FIELDS. Andy, box v15: "a probability search of a dataBase table must ALWAYS search the
// whole bloody ROW, as it is served through a single-row \"get\", using a probabilityStringObjectMatch.", and "the
// ServerSide of probability Search is NOT searching the whole row of the object." A module that hands
// probabilityStringObjectMatch an object it writes out on the spot, { id, title, box }, picks the fields it searches; one
// that hands it the row searches the row. Judged in its code, comments left out: no call of probabilityStringObjectMatch
// whose object is an object literal. Each call that breaks it is named by its line.
//
// Given no file, it judges every module testModule.js gives it, each its own check, named by its path.
// It stands in spirit/test/ beside spirit/spirit.js since goal/G43.32, so testModule.js hands it every module in spirit/
// and below with its own test (./TEST_SYSTEM.md).

const fs = require('fs');
const path = require('path');
// The product test system's own reporter (goal/G40.13).
const test = require(path.join(__dirname, 'testReport.js'));

const RUN = path.join(__dirname, '..', '..');
const REPO = path.join(RUN, '..', '..');
const ARGS = process.argv.slice(2).filter(function (a, i, all) { return a !== '--verify-port' && all[i - 1] !== '--verify-port'; });
const arg = String(ARGS[0] || '');
let full = '';
for (const p of [path.resolve(arg), path.join(RUN, arg), path.join(REPO, arg)]) {
  if (arg && fs.existsSync(p) && fs.statSync(p).isFile()) { full = p; break; }
}

// The code without its comments, kept line for line so a call is named by its line.
function code(file) {
  return fs.readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, function (c) { return c.replace(/[^\n]/g, ' '); })
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
}
// Every call of probabilityStringObjectMatch whose second argument is an object literal: the fields picked by hand.
function picked(file) {
  const src = code(file);
  const out = [];
  const re = /\bprobabilityStringObjectMatch\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    // Past the first argument: the comma at depth 0 after the opening parenthesis.
    let depth = 0; let i = re.lastIndex; let comma = -1;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') { if (depth === 0) break; depth--; }
      else if (c === ',' && depth === 0) { comma = i; break; }
    }
    if (comma === -1) continue;
    const rest = src.slice(comma + 1).replace(/^\s+/, '');
    if (rest[0] === '{') out.push(src.slice(0, m.index).split('\n').length);
  }
  return out;
}
function judge(rel, file) {
  const lines = picked(file);
  if (!lines.length) test.check(rel + ': it hands every search the row whole');
  else test.fail(rel + ': it hands probabilityStringObjectMatch fields it picks, at line' + (lines.length > 1 ? 's ' : ' ') + lines.join(', ') + ', in place of the row as its get serves it');
}

test.startTest('spirit-sibling-searchRules: ' + (full ? path.relative(REPO, full).split(path.sep).join('/') : arg || 'every module'));

if (arg && !full) test.fail('no module to judge: ' + JSON.stringify(arg));
else if (full) {
  test.subHeading(path.relative(RUN, full).split(path.sep).join('/') + ': its searches match the whole row');
  judge(path.relative(RUN, full).split(path.sep).join('/'), full);
} else {
  const reach = require(path.join(RUN, 'spirit', 'test', 'testModule.js')).testsFor('').filter(function (t) { return t.test === 'spirit/test/spirit-sibling-searchRules.js' && t.file; }).map(function (t) { return t.file; });
  test.comment('every module in its reach: ' + reach.length);
  if (!reach.length) test.fail('testModule.js gives it no file to judge');
  reach.forEach(function (f) { test.subHeading(f); judge(f, path.join(RUN, f)); });
}
test.reportSuccessFailureCount();
