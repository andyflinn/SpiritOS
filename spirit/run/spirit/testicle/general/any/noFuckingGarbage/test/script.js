'use strict';
const SPIRIT = require('../../../../../script.js');

// spirit/run/spirit/testicle/general/any/noFuckingGarbage/test/script.js
// THE GARBAGE RULES MODULE ON A TREE OF ITS OWN (goal/G49.27, step 2a; spec: ./script.md). The box: "Each module has its own
// test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red." A module
// with its test and spec, and a test named after no module, are planted in a scratch run; ../script.js judges each, its
// tests kept here and not reported, and the verdict of the rule's title is read.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const test = SPIRIT.requireScript('spirit/testicle/testReport/script.js');
const RULE = SPIRIT.requireScript('spirit/testicle/general/any/noFuckingGarbage/script.js');
// ITS TEMP FOLDER FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"), removed when the suite ends.
const tempFolder = SPIRIT.requireScript('spirit/tempFolder/script.js').tempFolder;
const ROUTE = 'spirit/testicle/general/noFuckingGarbage/test/script';
const PLANT = path.join(tempFolder(ROUTE), 'spirit', 'run');
test.after(function () { try { fs.rmSync(tempFolder.path(ROUTE), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
function plant(rel, text) { const at = path.join(PLANT, rel); fs.mkdirSync(path.dirname(at), { recursive: true }); fs.writeFileSync(at, text); return at; }

plant('spirit/zz/script.js', "'use strict';\nmodule.exports = {};\n");
plant('spirit/zz/test/script.md', '# zz\n');
const KEEPS = plant('spirit/zz/test/script.js', "'use strict';\n");
// A test named after no module beside its folder.
const BREAKS = plant('spirit/zz/test/orphan.js', "'use strict';\n");

// What checks says for one path, kept and not reported; the verdict of one title, every title before it run first (they
// read the files it judges), true, false, or null when it was not said.
const RULE_TITLE = 'every file in a test folder matches a production file: none is garbage';
async function verdict(scriptPath, title) {
  const kept = [];
  const T = { limit: test.limit, run: function (t, severity, body) { kept.push({ title: t, body: body }); }, after: function () {}, forScript: function (s, fn) { fn(); }, hold: function () {}, release: function () {}, comment: function () {} };
  RULE.checks(scriptPath, { test: T, run: PLANT, spirit: SPIRIT, node: { node: null } });
  for (const t of kept) {
    let v = null;
    try { v = (await t.body()) === true; } catch (e) { v = null; }
    if (t.title === title) return v;
  }
  return null;
}

test.run('it hands out appliesTo, its resource none, own false, its forbids and checks', 0.4, function () {
  return (typeof RULE.appliesTo === 'function' && RULE.resource === 'none' && RULE.own === false && Array.isArray(RULE.forbids) && typeof RULE.checks === 'function') || false;
}, test.limit.quick);
test.run('a planted test of the module beside its folder, its spec with it, keeps the rule', 0.4, async function () {
  return (await verdict(KEEPS, RULE_TITLE)) === true;
}, test.limit.quick);
test.run('a planted test named after no module is red', 0.4, async function () {
  return (await verdict(BREAKS, RULE_TITLE)) === false;
}, test.limit.quick);

// THE RUNNER JUDGING THE GARBAGE RULE IN A SCRATCH TREE (goal/G47.1, the cycle "missing tests reported", the box:
// "script-sibling-noFuckingGarbage also reports missing tests, in one check, "every production script has its own test",
// severity 0.2: red while any production script has no own test, test/<name>.js beside it, its answer naming every script
// missing one. Over the whole tree (handed nothing, or spirit.js) it judges every production script; handed one script, that
// one, by the same check. One check, not one per script", "Vendored scripts are left out of the check"; Andy: "damn right,
// every missing script-companion-suite is a red at 0.2", and "it is ok to exclude the vendored scripts."). Folded here from
// spirit/test/test/spirit-sibling-general.js (goal/G49.27: one test file per module). A scratch copy of the tracked files of
// spirit/run, in a git index of its own (the rule asks git which files are tracked), with planted scripts: has.js with its
// own test, lacks.js with none, and a script in a vendored folder with none. Its runner, spirit/testicle/run/none/script.js, runs
// there as its own process; with no environment.json, its reporter reports to no node.
const { execSync, execFileSync } = require('child_process');
const REPO = path.resolve(RUN, '..', '..');
const TREE_ROUTE = 'spirit/testicle/general/noFuckingGarbage/test/tree';
test.after(function () { try { fs.rmSync(tempFolder.path(TREE_ROUTE), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
const RULE_FILE = path.join(RUN, 'spirit', 'testicle', 'general', 'any', 'noFuckingGarbage', 'script.js');
const CHECK = 'every production script has its own test';
const HAS = 'spirit/zzGarbage/has.js';
const LACKS = 'spirit/zzGarbage/lacks.js';
const VENDORED = 'spirit/element/codeMirror/zzVendored.js';
const TREE_PLANT = {};
TREE_PLANT[HAS] = '\'use strict\';\n// has, with its own test\n';
TREE_PLANT['spirit/zzGarbage/test/has.js'] = '\'use strict\';\n// the test of has\n';
TREE_PLANT['spirit/zzGarbage/test/has.md'] = '# the test of has\n';
TREE_PLANT[LACKS] = '\'use strict\';\n// lacks, no test of its own\n';
TREE_PLANT[VENDORED] = '\'use strict\';\n// a vendored script, no test of its own\n';

let root = null, run = null;
// The runner run in the scratch tree, handed arg or nothing: its check as printed (spirit/testicle/testReport/script.js
// prints each test as its title and its mark, under its script's heading), { red, script }, or null when the check printed
// nothing.
function lineOf(arg, check, env) {
  let out = '';
  try { out = execFileSync(process.execPath, [path.join(run, 'spirit', 'testicle', 'run', 'none', 'script.js')].concat(arg ? [arg] : []), { cwd: run, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, env || {}) }); } catch (e) { out = String((e && e.stdout) || ''); }
  let script = '';
  let found = null;
  out.split('\n').forEach(function (l) {
    const t = l.replace(/^\*+\s*/, '').trim();
    const m = /^(.*) ([✅❌])$/.exec(t);
    if (!m) { if (t && !/^\*|Test completed/.test(t)) script = t; return; }
    if (!found && m[1] === (check || CHECK)) found = { red: m[2] === '❌', script: script };
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
  const listed = execSync('git ls-files -- spirit/run/spirit/zzGarbage', { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  const planted = Object.keys(TREE_PLANT).filter(function (f) { return f.indexOf('spirit/zzGarbage/') === 0; });
  return (planted.length === 4 && listed.length === planted.length) || false;
}, test.limit.long);

// the box: "in one check, "every production script has its own test", severity 0.2"; the check is this module's since
// goal/G49.27, step 2a.
test.run('the rule holds the check "every production script has its own test", at severity 0.2', 0.2, function () {
  const src = fs.readFileSync(RULE_FILE, 'utf8');
  return /test\.run\(\s*'every production script has its own test'\s*,\s*0\.2\s*,/.test(src) || false;
}, test.limit.quick);

// the box: "Over the whole tree (handed nothing, or spirit.js) it judges every production script", "red while any
// production script has no own test ... its answer naming every script missing one", "Vendored scripts are left out"
// A test's one string is its title (goal/G47.1): the check answers red or green, and names no script in a text.
test.run('over the whole tree, with a script missing its own test, the check is red', 0.2, function () {
  if (!run) return false;
  const l = lineOf('');
  return (!!l && l.red) || false;
}, test.limit.slow);
test.run('handed spirit.js, it judges the whole tree the same', 0.2, function () {
  if (!run) return false;
  const l = lineOf('spirit/script.js');
  return (!!l && l.red) || false;
}, test.limit.slow);

// the box: "handed one script, that one, by the same check"
test.run('handed a script with its own test, the check is green', 0.2, function () {
  if (!run) return false;
  const l = lineOf(HAS);
  return (!!l && !l.red) || false;
}, test.limit.slow);
test.run('handed a script with no own test, the check is red, under that script', 0.2, function () {
  if (!run) return false;
  const l = lineOf(LACKS);
  return (!!l && l.red && l.script.indexOf(LACKS) !== -1) || false;
}, test.limit.slow);
