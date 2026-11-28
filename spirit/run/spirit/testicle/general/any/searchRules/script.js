'use strict';
// spirit/run/spirit/testicle/general/any/searchRules/script.js
// A RULE MODULE OF THE GENERAL TEST (goal/G49.27, step 2a; box v5, Andy's Go: "spirit/testicle/ is the faceless test system",
// the general rules become modules, one rule set one module). Its checks are the part searchRules(ARGS) of
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
  // Every path: a file is judged, a path that is no file is red ('there is a module to judge').
  return true;
}

function checks(scriptPath, tools) {
const ARGS = scriptPath ? [scriptPath] : [];
const test = tools.test;

// spirit/run/spirit/test/script-sibling-searchRules.js <file>
// THE SEARCH RULE OF A MODULE (goal/G41.28), run once per file it judges, the file its argument, as
// ./script-sibling-generalRules.js is for a module (spec: ./script-sibling-searchRules.md). Its name is its reach
// (./TEST_SYSTEM.md): a -sibling- test beside spirit.js judges every module in spirit/run/ and below, a server and a
// page alike (goal/G47.1: no opting in).
//
// THE WHOLE ROW, NEVER A FEW FIELDS. Andy, box v15: "a probability search of a dataBase table must ALWAYS search the
// whole bloody ROW, as it is served through a single-row \"get\", using a probabilityStringObjectMatch.", and "the
// ServerSide of probability Search is NOT searching the whole row of the object." A module that hands
// probabilityStringObjectMatch an object it writes out on the spot, { id, title, box }, picks the fields it searches; one
// that hands it the row searches the row. Judged in its code, comments left out: no call of probabilityStringObjectMatch
// whose object is an object literal. Each call that breaks it is named by its line.
//
// Given no file, it judges every module testModule.js gives it, each its own check, named by its path.
// It stands in spirit/test/ beside spirit/script.js since goal/G43.32, so testModule.js hands it every module in spirit/
// and below (./TEST_SYSTEM.md).

const fs = require('fs');
const path = require('path');

const RUN = tools.run;
const REPO = path.join(RUN, '..', '..');
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
// Whether one module keeps the rule: true when every search it makes takes the row whole.
function judge(file) {
  return !picked(file).length;
}

// The modules it judges: the one handed, or every module testModule.js gives it.
let reach = null;
test.run('there is a module to judge', 0.2, function () {
  if (arg && !full) return false;
  if (full) { reach = [path.relative(RUN, full).split(path.sep).join('/')]; return true; }
  reach = SPIRIT.requireScript('spirit/testicle/testModule/script.js').testsFor('').filter(function (t) { return t.test === 'spirit/testicle/run/none/script.js' && t.file; }).map(function (t) { return t.file; });
  return reach.length > 0 || false;
}, test.limit.quick);
// <file>: its searches match the whole row.
test.run('it hands every search the row whole', 0.4, function () {
  if (!reach || !reach.length) return false;
  return reach.every(function (f) { return judge(path.join(RUN, f)); });
}, test.limit.quick);
}

// No name its checks look for is skipped in its files (goal/G49.27, Andy: "All, cw's way"): it forbids none by name.
const FORBIDS_NAMES = [];
module.exports = { appliesTo: appliesTo, resource: 'none', own: false, forbids: FORBIDS_NAMES, checks: checks };
