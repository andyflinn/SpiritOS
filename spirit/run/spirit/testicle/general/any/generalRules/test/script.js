'use strict';
const SPIRIT = require('../../../../../script.js');

// spirit/run/spirit/testicle/general/any/generalRules/test/script.js
// THE GENERAL RULES MODULE ON A TREE OF ITS OWN (goal/G49.27, step 2a; spec: ./script.md). The box: "Each module has its own
// test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red." Two
// product scripts are planted in a scratch run, one that holds the shape (use strict, spirit first) and one that starts with
// a plain require; ../script.js judges each, its tests kept here and not reported, and the verdict of the rule's title is
// read. Only that title's body runs, so no test of it starts a node.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const test = SPIRIT.requireScript('spirit/testicle/testReport/script.js');
const RULE = SPIRIT.requireScript('spirit/testicle/general/any/generalRules/script.js');
// ITS TEMP FOLDER FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"), removed when the suite ends.
const tempFolder = SPIRIT.requireScript('spirit/tempFolder/script.js').tempFolder;
const ROUTE = 'spirit/testicle/general/generalRules/test/script';
const PLANT = path.join(tempFolder(ROUTE), 'spirit', 'run');
test.after(function () { try { fs.rmSync(tempFolder.path(ROUTE), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
function plant(rel, text) { const at = path.join(PLANT, rel); fs.mkdirSync(path.dirname(at), { recursive: true }); fs.writeFileSync(at, text); return at; }

const KEEPS = plant('spirit/zz/keeps/script.js', "'use strict';\nrequire('../../script.js');\nconst fs = require('fs');\nmodule.exports = { fs: fs };\n");
const BREAKS = plant('spirit/zz/breaks/script.js', "const fs = require('fs');\nmodule.exports = { fs: fs };\n");

// What checks says for one path, kept and not reported; the verdict of one title, true, false, or null when it was not said.
const RULE_TITLE = 'it starts with \'use strict\', takes spirit first, and loads the tree only through spirit.requireScript';
async function verdict(scriptPath, title) {
  const kept = [];
  const T = { limit: test.limit, run: function (t, severity, body) { kept.push({ title: t, body: body }); }, after: function () {}, forScript: function (s, fn) { fn(); }, hold: function () {}, release: function () {}, comment: function () {} };
  RULE.checks(scriptPath, { test: T, run: PLANT, spirit: SPIRIT, node: { node: null } });
  const one = kept.filter(function (t) { return t.title === title; })[0];
  if (!one) return null;
  try { return (await one.body()) === true; } catch (e) { return null; }
}

test.run('it hands out appliesTo, its resource node, own false, its forbids and checks', 0.4, function () {
  return (typeof RULE.appliesTo === 'function' && RULE.resource === 'node' && RULE.own === false && Array.isArray(RULE.forbids) && typeof RULE.checks === 'function') || false;
}, test.limit.quick);
test.run('a planted script with use strict that takes spirit first keeps the shape', 0.4, async function () {
  return (await verdict(KEEPS, RULE_TITLE)) === true;
}, test.limit.quick);
test.run('a planted script that starts with a plain require is red', 0.4, async function () {
  return (await verdict(BREAKS, RULE_TITLE)) === false;
}, test.limit.quick);

// THE RUNNER JUDGING THE GENERAL RULES IN A SCRATCH TREE (goal/G47.1). Folded here from spirit/test/test/spirit-sibling-general.js
// (goal/G49.27: one test file per module): a scratch copy of the tracked files of spirit/run, in a git index of its own,
// with planted scripts; its runner, spirit/testicle/run/node/script.js (this module alone: SPIRIT_RULE_MODULES), runs there
// as its own process, handed one planted script, and
// the verdict of one of this module's titles is read from what it prints. With no environment.json its reporter reports
// to no node.
const { execSync, execFileSync } = require('child_process');
const REPO = path.resolve(RUN, '..', '..');
const TREE_ROUTE = 'spirit/testicle/general/generalRules/test/tree';
test.after(function () { try { fs.rmSync(tempFolder.path(TREE_ROUTE), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
const TREE_PLANT = {};
// A module whose first require is not spirit.js (goal/G47.1; moved from spirit/test/script.js: Andy, "11. is
// script-sibling-general"). Planted inside the tree, where the general test judges.
const LATE = 'spirit/zzGarbage/late.js';
TREE_PLANT[LATE] = '\'use strict\';\nconst fs = require(\'fs\');\nrequire(\'../spirit.js\');\n';
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
  try { out = execFileSync(process.execPath, [path.join(run, 'spirit', 'testicle', 'run', 'node', 'script.js')].concat(arg ? [arg] : []), { cwd: run, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, { SPIRIT_RULE_MODULES: 'spirit/testicle/general/any/generalRules' }, env || {}) }); } catch (e) { out = String((e && e.stdout) || ''); }
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
  const listed = execSync('git ls-files -- spirit/run/spirit/zzGarbage spirit/run/spirit/element/zzListen spirit/run/spirit/zzGlobal', { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  return listed.length === Object.keys(TREE_PLANT).length || false;
}, test.limit.long);

// the module rule (spirit.md, "A module whose first require is not spirit.js goes red"): handed spirit.js, green; handed a
// module that requires fs first, red, naming that require
test.run('the general rules pass spirit.js itself: it sets the global spirit before its first require', 0.2, function () {
  if (!run) return false;
  const l = lineOf('spirit/script.js', 'it sets the global spirit before its first require');
  return (!!l && !l.red) || false;
}, test.limit.slow);
test.run('a module whose first require is not spirit.js goes red', 0.2, function () {
  if (!run) return false;
  const l = lineOf(LATE, 'it requires spirit.js first');
  return (!!l && l.red && l.script.indexOf(LATE) !== -1) || false;
}, test.limit.slow);

test.run('an element that writes and mounts a child on a branch, the child searching it, listens: the check is green', 0.2, function () {
  if (!run) return false;
  const l = lineOf(LISTENS, WRITES);
  return (!!l && !l.red) || false;
}, test.limit.slow);
test.run('an element that writes and listens to nothing, no watch, no search, no child on a branch: the check is red', 0.2, function () {
  if (!run) return false;
  const l = lineOf(DEAF, WRITES);
  return (!!l && l.red) || false;
}, test.limit.slow);
// Loaded in the scratch tree itself, handed to the rule as testicle hands its run (SPIRIT_MOUNT_RUN).
test.run('a node script that assigns a name onto global is red on the global object check', 0.4, function () {
  if (!run) return false;
  const l = lineOf(LEAKY, GLOBALS, { SPIRIT_MOUNT_BASE: 'http://127.0.0.1:9', SPIRIT_MOUNT_RUN: run });
  return (!!l && l.red && l.script.indexOf(LEAKY) !== -1) || false;
}, test.limit.slow);
test.run('a node script that hands out its value through module.exports alone is green on the global object check', 0.4, function () {
  if (!run) return false;
  const l = lineOf(CLEAN, GLOBALS, { SPIRIT_MOUNT_BASE: 'http://127.0.0.1:9', SPIRIT_MOUNT_RUN: run });
  return (!!l && !l.red) || false;
}, test.limit.slow);
// The box: "nothing else builds a temp path. Guard: the general test is red on a product script or test that calls the
// system temp folder directly."
test.run('a script that calls the system temp folder directly is red on the temp check', 0.4, function () {
  if (!run) return false;
  const l = lineOf(OWN_TEMP, TEMP_CHECK);
  return (!!l && l.red && l.script.indexOf(OWN_TEMP) !== -1) || false;
}, test.limit.slow);
test.run('a script that builds no temp path is green on the temp check', 0.4, function () {
  if (!run) return false;
  const l = lineOf(CLEAN, TEMP_CHECK);
  return (!!l && !l.red) || false;
}, test.limit.slow);
