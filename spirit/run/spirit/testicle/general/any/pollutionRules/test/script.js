'use strict';
const SPIRIT = require('../../../../../script.js');

// spirit/run/spirit/testicle/general/any/pollutionRules/test/script.js
// THE POLLUTION RULES ON A TREE OF ITS OWN (goal/G49.27; spec: ./script.md). The box: "Each module has its own test ... planting a
// tiny script breaking a rule and one keeping it, so a module that passes everything is red." ../script.js judges what
// is planted, its tests kept here and not reported, and the verdict of the rule's title is read. Its checks came from the
// one general rules module, spirit/testicle/general/any/generalRules/script.js, with the checks of its own test that judge them.

const fs = require('fs');
const path = require('path');
const test = SPIRIT.requireScript('spirit/testicle/testReport/script.js');
const RULE = SPIRIT.requireScript('spirit/testicle/general/any/pollutionRules/script.js');
// ITS TEMP FOLDER FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"), removed when the suite ends.
const tempFolder = SPIRIT.requireScript('spirit/tempFolder/script.js').tempFolder;
const ROUTE = 'spirit/testicle/general/pollutionRules/test/script';
const ROOT = tempFolder(ROUTE);
test.after(function () { try { fs.rmSync(tempFolder.path(ROUTE), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });

test.run('it hands out appliesTo, its resource node, own false, its forbids and checks', 0.4, function () {
  return (typeof RULE.appliesTo === 'function' && RULE.resource === 'node' && RULE.own === false && Array.isArray(RULE.forbids) && typeof RULE.checks === 'function') || false;
}, test.limit.quick);

// THE RUNNER JUDGING THESE RULES IN A SCRATCH TREE (goal/G47.1; folded into the general rules' own test from
// spirit/test/test/spirit-sibling-general.js, moved here with the checks they judge, goal/G49.27): a scratch copy of the tracked
// files of spirit/run, in a git index of its own, with planted scripts; its runner, spirit/testicle/run/node/script.js (this
// module alone: SPIRIT_RULE_MODULES), runs there as its own process, handed one planted script, and the verdict of one of this
// module's titles is read from what it prints. With no environment.json its reporter reports to no node.
const { execSync, execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const TREE_ROUTE = 'spirit/testicle/general/pollutionRules/test/tree';
test.after(function () { try { fs.rmSync(tempFolder.path(TREE_ROUTE), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
const TREE_PLANT = {};
// NOTHING ON THE NODE'S GLOBAL OBJECT OR ON process BUT spirit (goal/G47.1; Andy: "no developer will want to use a system that
// pollutes global name-spaces.", "go on this"): a node script that assigns a name onto global, and one that hands out its
// value through module.exports alone.
const LEAKY = 'spirit/zzGlobal/leaky.js';
const CLEAN = 'spirit/zzGlobal/clean.js';
const GLOBALS = 'loaded in a node, it adds nothing to the global object or to process but spirit';
TREE_PLANT[LEAKY] = ["'use strict';", "require('../script.js');", 'global.zzLeaked = 1;', 'module.exports = {};', ''].join('\n');
TREE_PLANT[CLEAN] = ["'use strict';", "require('../script.js');", 'const zzKept = 1;', 'module.exports = { zzKept: zzKept };', ''].join('\n');
// A script that builds a temp path of its own (goal/G47.1, the box: "nothing else builds a temp path").
const OWN_TEMP = 'spirit/zzGlobal/ownTemp.js';
const TEMP_CHECK = 'it builds no temp path of its own: its temp folder comes from spirit/tempFolder/script.js';
TREE_PLANT[OWN_TEMP] = ["'use strict';", "require('../script.js');", "const os = require('os');", "module.exports = { where: os.tmpdir() };", ''].join('\n');

let root = null, run = null;
// The runner run in the scratch tree, handed arg: its check as printed (spirit/testicle/testReport/script.js prints each test
// as its title and its mark, under its script's heading), { red, script }, or null when the check printed nothing.
function lineOf(arg, check, env) {
  let out = '';
  try { out = execFileSync(process.execPath, [path.join(run, 'spirit', 'testicle', 'run', 'node', 'script.js')].concat(arg ? [arg] : []), { cwd: run, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, { SPIRIT_RULE_MODULES: 'spirit/testicle/general/any/pollutionRules' }, env || {}) }); } catch (e) { out = String((e && e.stdout) || ''); }
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

// Loaded in the scratch tree itself, handed to the rule as testicle hands its run (SPIRIT_MOUNT_RUN).
test.run('a node script that assigns a name onto global is red on the global object check', 0.4, function () {
  if (!run) return false;
  const l = lineOf(LEAKY, GLOBALS, { SPIRIT_MOUNT_BASE: 'http://127.0.0.1:9', SPIRIT_MOUNT_RUN: run });
  return (!!l && l.red && l.script.indexOf(LEAKY) !== -1) || false;
}, test.limit.slow, { why: 'it runs the node runner in the scratch tree' });
test.run('a node script that hands out its value through module.exports alone is green on the global object check', 0.4, function () {
  if (!run) return false;
  const l = lineOf(CLEAN, GLOBALS, { SPIRIT_MOUNT_BASE: 'http://127.0.0.1:9', SPIRIT_MOUNT_RUN: run });
  return (!!l && !l.red) || false;
}, test.limit.slow, { why: 'it runs the node runner in the scratch tree' });
// The box: "nothing else builds a temp path. Guard: the general test is red on a product script or test that calls the
// system temp folder directly."
test.run('a script that calls the system temp folder directly is red on the temp check', 0.4, function () {
  if (!run) return false;
  const l = lineOf(OWN_TEMP, TEMP_CHECK);
  return (!!l && l.red && l.script.indexOf(OWN_TEMP) !== -1) || false;
}, test.limit.slow, { why: 'it runs the node runner in the scratch tree' });
test.run('a script that builds no temp path is green on the temp check', 0.4, function () {
  if (!run) return false;
  const l = lineOf(CLEAN, TEMP_CHECK);
  return (!!l && !l.red) || false;
}, test.limit.slow, { why: 'it runs the node runner in the scratch tree' });
