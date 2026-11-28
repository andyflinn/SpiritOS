'use strict';
const SPIRIT = require('../../../../../script.js');

// spirit/run/spirit/testicle/general/any/moduleRules/test/script.js
// THE MODULE RULES ON A TREE OF ITS OWN (goal/G49.27; spec: ./script.md). The box: "Each module has its own test ... planting a
// tiny script breaking a rule and one keeping it, so a module that passes everything is red." ../script.js judges what
// is planted, its tests kept here and not reported, and the verdict of the rule's title is read. Its checks came from the
// one general rules module, spirit/testicle/general/any/generalRules/script.js, with the checks of its own test that judge them.

const fs = require('fs');
const path = require('path');
const test = SPIRIT.requireScript('spirit/testicle/testReport/script.js');
const RULE = SPIRIT.requireScript('spirit/testicle/general/any/moduleRules/script.js');
// ITS TEMP FOLDER FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"), removed when the suite ends.
const tempFolder = SPIRIT.requireScript('spirit/tempFolder/script.js').tempFolder;
const ROUTE = 'spirit/testicle/general/moduleRules/test/script';
const ROOT = tempFolder(ROUTE);
test.after(function () { try { fs.rmSync(tempFolder.path(ROUTE), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
const PLANT = path.join(ROOT, 'spirit', 'run');
function plant(rel, text) { const at = path.join(PLANT, rel); fs.mkdirSync(path.dirname(at), { recursive: true }); fs.writeFileSync(at, text); return at; }

const KEEPS = plant('spirit/zz/keeps/script.js', "'use strict';\nrequire('../../script.js');\nconst fs = require('fs');\nmodule.exports = { fs: fs };\n");
const BREAKS = plant('spirit/zz/breaks/script.js', "const fs = require('fs');\nmodule.exports = { fs: fs };\n");

// What checks says for one path, kept and not reported; the verdict of one title, true, false, or null when it was not said.
const RULE_TITLE = 'it starts with \'use strict\', takes spirit first, and loads the tree only through spirit.requireScript';
async function verdict(scriptPath, title) {
  const kept = [];
  const T = { limit: test.limit, run: function (t, severity, body) { kept.push({ title: t, body: body }); }, after: function () {}, forScript: function (s, fn) { fn(); }, hold: function () {}, release: function () {}, comment: function () {} };
  RULE.checks(scriptPath, { test: T, run: PLANT, spirit: SPIRIT, node: { node: null }, forbids: {} });
  const one = kept.filter(function (t) { return t.title === title; })[0];
  if (!one) return null;
  try { return (await one.body()) === true; } catch (e) { return null; }
}

test.run('it hands out appliesTo, its resource none, own false, its forbids and checks', 0.4, function () {
  return (typeof RULE.appliesTo === 'function' && RULE.resource === 'none' && RULE.own === false && Array.isArray(RULE.forbids) && typeof RULE.checks === 'function') || false;
}, test.limit.quick);
test.run('it hands out codeOf and moduleRulesAt, the code reader and the module reading the other rule modules ask', 0.4, function () {
  if (typeof RULE.codeOf !== 'function' || typeof RULE.moduleRulesAt !== 'function') return false;
  const blanked = RULE.codeOf("var a = 'require(1)'; // b\n", true);
  return (blanked === "var a = '          ';     \n" && RULE.moduleRulesAt(PLANT, KEEPS).early === false && RULE.moduleRulesAt(PLANT, BREAKS).early === true) || false;
}, test.limit.quick);
test.run('a planted script with use strict that takes spirit first keeps the shape', 0.4, async function () {
  return (await verdict(KEEPS, RULE_TITLE)) === true;
}, test.limit.quick);
test.run('a planted script that starts with a plain require is red', 0.4, async function () {
  return (await verdict(BREAKS, RULE_TITLE)) === false;
}, test.limit.quick);

// THE RUNNER JUDGING THESE RULES IN A SCRATCH TREE (goal/G47.1; folded into the general rules' own test from
// spirit/test/test/spirit-sibling-general.js, moved here with the checks they judge, goal/G49.27): a scratch copy of the tracked
// files of spirit/run, in a git index of its own, with planted scripts; its runner, spirit/testicle/run/none/script.js (this
// module alone: SPIRIT_RULE_MODULES), runs there as its own process, handed one planted script, and the verdict of one of this
// module's titles is read from what it prints. With no environment.json its reporter reports to no node.
const { execSync, execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const TREE_ROUTE = 'spirit/testicle/general/moduleRules/test/tree';
test.after(function () { try { fs.rmSync(tempFolder.path(TREE_ROUTE), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
const TREE_PLANT = {};
// A module whose first require is not spirit.js (goal/G47.1; moved from spirit/test/script.js: Andy, "11. is
// script-sibling-general"). Planted inside the tree, where the general test judges.
const LATE = 'spirit/zzGarbage/late.js';
TREE_PLANT[LATE] = '\'use strict\';\nconst fs = require(\'fs\');\nrequire(\'../spirit.js\');\n';

let root = null, run = null;
// The runner run in the scratch tree, handed arg: its check as printed (spirit/testicle/testReport/script.js prints each test
// as its title and its mark, under its script's heading), { red, script }, or null when the check printed nothing.
function lineOf(arg, check, env) {
  let out = '';
  try { out = execFileSync(process.execPath, [path.join(run, 'spirit', 'testicle', 'run', 'none', 'script.js')].concat(arg ? [arg] : []), { cwd: run, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, { SPIRIT_RULE_MODULES: 'spirit/testicle/general/any/moduleRules' }, env || {}) }); } catch (e) { out = String((e && e.stdout) || ''); }
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

// the module rule (spirit.md, "A module whose first require is not spirit.js goes red"): handed spirit.js, green; handed a
// module that requires fs first, red, naming that require
test.run('the general rules pass spirit.js itself: it sets the global spirit before its first require', 0.2, function () {
  if (!run) return false;
  const l = lineOf('spirit/script.js', 'it sets the global spirit before its first require');
  return (!!l && !l.red) || false;
}, test.limit.slow, { why: 'it runs the none runner in the scratch tree' });
test.run('a module whose first require is not spirit.js goes red', 0.2, function () {
  if (!run) return false;
  const l = lineOf(LATE, 'it requires spirit.js first');
  return (!!l && l.red && l.script.indexOf(LATE) !== -1) || false;
}, test.limit.slow, { why: 'it runs the none runner in the scratch tree' });
