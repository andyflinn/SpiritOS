'use strict';
const SPIRIT = require('../../../../../script.js');

// spirit/run/spirit/testicle/general/any/elementCodeRules/test/script.js
// THE ELEMENT CODE RULES ON A TREE OF ITS OWN (goal/G49.27; spec: ./script.md). The box: "Each module has its own test ... planting a
// tiny script breaking a rule and one keeping it, so a module that passes everything is red." ../script.js judges what
// is planted, its tests kept here and not reported, and the verdict of the rule's title is read. Its checks came from the
// one general rules module, spirit/testicle/general/any/generalRules/script.js, with the checks of its own test that judge them.

const fs = require('fs');
const path = require('path');
const test = SPIRIT.requireScript('spirit/testicle/testReport/script.js');
const RULE = SPIRIT.requireScript('spirit/testicle/general/any/elementCodeRules/script.js');
// ITS TEMP FOLDER FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"), removed when the suite ends.
const tempFolder = SPIRIT.requireScript('spirit/tempFolder/script.js').tempFolder;
const ROUTE = 'spirit/testicle/general/elementCodeRules/test/script';
const ROOT = tempFolder(ROUTE);
test.after(function () { try { fs.rmSync(tempFolder.path(ROUTE), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });

test.run('it hands out appliesTo, its resource none, own false, its forbids and checks', 0.4, function () {
  return (typeof RULE.appliesTo === 'function' && RULE.resource === 'none' && RULE.own === false && Array.isArray(RULE.forbids) && typeof RULE.checks === 'function') || false;
}, test.limit.quick);

// THE RUNNER JUDGING THESE RULES IN A SCRATCH TREE (goal/G47.1; folded into the general rules' own test from
// spirit/test/test/spirit-sibling-general.js, moved here with the checks they judge, goal/G49.27): a scratch copy of the tracked
// files of spirit/run, in a git index of its own, with planted scripts; its runner, spirit/testicle/run/none/script.js (this
// module alone: SPIRIT_RULE_MODULES), runs there as its own process, handed one planted script, and the verdict of one of this
// module's titles is read from what it prints. With no environment.json its reporter reports to no node.
const { execSync, execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const TREE_ROUTE = 'spirit/testicle/general/elementCodeRules/test/tree';
test.after(function () { try { fs.rmSync(tempFolder.path(TREE_ROUTE), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
const TREE_PLANT = {};
// WHAT IT CHANGES, IT LISTENS FOR, THROUGH A CHILD ON A BRANCH (goal/G47.1; wsl, of the model table: "the list it mounts ... is
// what shows the result, so it does listen, through its child"; cw: "A child it mounts on a branch counts as its listening"):
// an element that writes and mounts a child it requires, handed a branch by name, the child searching that branch; and one
// that writes and listens to nothing. goal/G49.23: an element is known by its place under spirit/element/ and the create its
// module.exports holds, so the plants stand there and set module.exports; the loader places them.
const LISTENS = 'spirit/element/zzListen/writer.js';
const DEAF = 'spirit/element/zzListen/deaf.js';
// Its check's title since goal/G49.23 names the store, no spirit.required.
const WRITES = 'it sends writes and watches the store';
TREE_PLANT['spirit/element/zzListen/child.js'] = '\'use strict\';\nwindow.spirit.requireScript(\'spirit/element/search/script.js\');\nfunction branchOf(n) { return \'zz/\' + n; }\nvar made = function (o) { return { data: branchOf(o.table) }; };\nmodule.exports = { create: made };\n';
TREE_PLANT[LISTENS] = '\'use strict\';\nwindow.spirit.requireScript(\'spirit/element/zzListen/child.js\');\nvar ask = { op: \'set\', table: \'zz\' };\nmodule.exports = { create: function () { return ask; } };\n';
TREE_PLANT[DEAF] = '\'use strict\';\nvar ask = { op: \'set\', id: \'zz\' };\nmodule.exports = { create: function () { return ask; } };\n';

let root = null, run = null;
// The runner run in the scratch tree, handed arg: its check as printed (spirit/testicle/testReport/script.js prints each test
// as its title and its mark, under its script's heading), { red, script }, or null when the check printed nothing.
function lineOf(arg, check, env) {
  let out = '';
  try { out = execFileSync(process.execPath, [path.join(run, 'spirit', 'testicle', 'run', 'none', 'script.js')].concat(arg ? [arg] : []), { cwd: run, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, { SPIRIT_RULE_MODULES: 'spirit/testicle/general/any/elementCodeRules' }, env || {}) }); } catch (e) { out = String((e && e.stdout) || ''); }
  let script = '';
  let found = null;
  out.split('\n').forEach(function (l) {
    const t = l.replace(/^\*+\s*/, '').trim();
    const m = /^(.*) ([✅❌])$/.exec(t);
    if (!m) { if (t && !/^\*|Test completed/.test(t)) script = t; return; }
    if (!found && m[1] === check) found = { red: m[2] === '❌', script: script };
  });
  return found;
}

test.run('a scratch tree is made of the tracked files and the planted scripts, in a git index of its own', 0.2, function () {
  root = tempFolder(TREE_ROUTE);
  execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); })
    .forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
  run = path.join(root, 'spirit', 'run');
  Object.keys(TREE_PLANT).forEach(function (f) { fs.mkdirSync(path.dirname(path.join(run, f)), { recursive: true }); fs.writeFileSync(path.join(run, f), TREE_PLANT[f]); });
  execSync('git init -q && git add -A', { cwd: root, stdio: 'ignore' });
  const listed = Object.keys(TREE_PLANT).filter(function (f) { return execSync('git ls-files -- ' + JSON.stringify('spirit/run/' + f), { cwd: root, encoding: 'utf8' }).trim() !== ''; });
  return listed.length === Object.keys(TREE_PLANT).length || false;
}, test.limit.long, { why: 'it copies every tracked file into a scratch tree' });

test.run('an element that writes and mounts a child on a branch, the child searching it, listens: the check is green', 0.2, function () {
  if (!run) return false;
  const l = lineOf(LISTENS, WRITES);
  return (!!l && !l.red) || false;
}, test.limit.slow, { why: 'it runs the none runner in the scratch tree' });
test.run('an element that writes and listens to nothing, no watch, no search, no child on a branch: the check is red', 0.2, function () {
  if (!run) return false;
  const l = lineOf(DEAF, WRITES);
  return (!!l && l.red) || false;
}, test.limit.slow, { why: 'it runs the none runner in the scratch tree' });
