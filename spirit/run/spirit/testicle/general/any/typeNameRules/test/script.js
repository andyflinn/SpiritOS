'use strict';
const SPIRIT = require('../../../../../script.js');

// spirit/run/spirit/testicle/general/any/typeNameRules/test/script.js
// THE TYPE NAME RULES MODULE ON A TREE OF ITS OWN (goal/G49.27; spec: ./script.md). The box: "Each module has its own test ... planting a
// tiny script breaking a rule and one keeping it, so a module that passes everything is red." ../script.js judges what
// is planted, its tests kept here and not reported, and the verdict of the rule's title is read. Its checks came from the
// one general rules module, spirit/testicle/general/any/generalRules/script.js, with the checks of its own test that judge them.

const fs = require('fs');
const path = require('path');
const test = SPIRIT.requireScript('spirit/testicle/testReport/script.js');
const RULE = SPIRIT.requireScript('spirit/testicle/general/any/typeNameRules/script.js');
// ITS TEMP FOLDER FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"), removed when the suite ends.
const tempFolder = SPIRIT.requireScript('spirit/tempFolder/script.js').tempFolder;
const ROUTE = 'spirit/testicle/general/typeNameRules/test/script';
const ROOT = tempFolder(ROUTE);
test.after(function () { try { fs.rmSync(tempFolder.path(ROUTE), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });

// A planted repository each side, <root>/<side>/, its run <root>/<side>/spirit/run: plant(side, rel, text) writes rel under
// that run, plantRepo(side, rel, text) under the repository.
function runOf(side) { return path.join(ROOT, side, 'spirit', 'run'); }
function write(at, text) { fs.mkdirSync(path.dirname(at), { recursive: true }); fs.writeFileSync(at, text); return at; }
function plant(side, rel, text) { return write(path.join(runOf(side), rel), text); }
function plantRepo(side, rel, text) { return write(path.join(ROOT, side, rel), text); }
// What checks says for one path, kept and not reported; the verdict of one title, true, false, or null when it was not said.
async function verdict(side, scriptPath, title) {
  const kept = [];
  const T = { limit: test.limit, run: function (t, severity, body) { kept.push({ title: t, body: body }); }, after: function () {}, forScript: function (s, fn) { fn(); }, hold: function () {}, release: function () {}, comment: function () {} };
  RULE.checks(scriptPath, { test: T, run: runOf(side), spirit: SPIRIT, node: { node: null }, forbids: {} });
  const one = kept.filter(function (t) { return t.title === title; })[0];
  if (!one) return null;
  try { return (await one.body()) === true; } catch (e) { return null; }
}
// The planted repository made a git tree, its files in its index: the rule reads the tree from git.
function gitTree(side) {
  try { require('child_process').execFileSync('git', ['init', '-q'], { cwd: path.join(ROOT, side), stdio: 'ignore' }); require('child_process').execFileSync('git', ['add', '-A'], { cwd: path.join(ROOT, side), stdio: 'ignore' }); return true; } catch (e) { return false; }
}

// Three branches, each a folder holding script.js and client/script.js, their verbs' arguments type scripts by their paths;
// on the side that breaks it, one argument is a word of its own.
['zzA', 'zzB', 'zzC'].forEach(function (b) {
  ['keeps', 'breaks'].forEach(function (side) {
    const arg = side === 'breaks' && b === 'zzC' ? 'text?' : 'spirit/type/zz/script.js';
    plant(side, 'spirit/' + b + '/script.js', "'use strict';\nmodule.exports = { verbs: { get: { id: '" + arg + "' } } };\n");
    plant(side, 'spirit/' + b + '/client/script.js', "'use strict';\nmodule.exports = {};\n");
  });
});
const MADE = { keeps: gitTree('keeps'), breaks: gitTree('breaks') };

test.run('it hands out appliesTo, its resource none, own false, its forbids and checks', 0.4, function () {
  return (typeof RULE.appliesTo === 'function' && RULE.resource === 'none' && RULE.own === false && Array.isArray(RULE.forbids) && typeof RULE.checks === 'function') || false;
}, test.limit.quick);
test.run('the planted runs are git trees', 0.2, function () {
  return (MADE.keeps && MADE.breaks) || false;
}, test.limit.quick);
const RULE_TITLE = 'every argument of every branch\'s verbs is a type script by its path';
test.run('three planted branches whose every argument is a type script by its path keep the rule', 0.4, async function () {
  return (await verdict('keeps', '', RULE_TITLE)) === true;
}, test.limit.quick);
test.run('the same with one argument named by a word of its own is red', 0.4, async function () {
  return (await verdict('breaks', '', RULE_TITLE)) === false;
}, test.limit.quick);
