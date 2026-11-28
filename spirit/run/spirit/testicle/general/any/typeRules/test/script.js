'use strict';

// spirit/run/spirit/testicle/general/any/typeRules/test/script.js
// THE TYPE RULES MODULE ON A TREE OF ITS OWN (goal/G49.27, step 2a; spec: ./script.md). The box: "Each module has its own
// test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red." Two type
// files are planted in a scratch run, one that keeps the rule and one that breaks it; ../script.js judges each, its tests
// kept here and not reported, and the verdict of the rule's title is read.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
const test = SPIRIT.requireScript('spirit/testicle/testReport/script.js');
const RULE = SPIRIT.requireScript('spirit/testicle/general/any/typeRules/script.js');
// ITS TEMP FOLDER FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"), removed when the suite ends.
const tempFolder = SPIRIT.requireScript('spirit/tempFolder/script.js').tempFolder;
const ROUTE = 'spirit/testicle/general/typeRules/test/script';
const PLANT = path.join(tempFolder(ROUTE), 'spirit', 'run');
test.after(function () { try { fs.rmSync(tempFolder.path(ROUTE), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
function plant(rel, text) { const at = path.join(PLANT, rel); fs.mkdirSync(path.dirname(at), { recursive: true }); fs.writeFileSync(at, text); }

const KEEPS = 'spirit/type/zz/keeps/script.js';
const BREAKS = 'spirit/type/zz/breaks/script.js';
plant(KEEPS, "'use strict';\nmodule.exports = { defaultValue: function () { return 'a'; }, isValid: function (v) { if (v === null || v === undefined) throw new Error('none'); return typeof v === 'string'; }, ruleDescription: function () { return 'a string'; } };\n");
// It answers false for null and undefined, never throws.
plant(BREAKS, "'use strict';\nmodule.exports = { defaultValue: function () { return 'a'; }, isValid: function (v) { return typeof v === 'string'; }, ruleDescription: function () { return 'a string'; } };\n");
// The planted run's loader: its type files by their run path.
const LOADER = { requireScript: function (rel) { return require(path.join(PLANT, rel)); } };

// What checks says for one path, kept and not reported; the verdict of one title, true, false, or null when it was not said.
const RULE_TITLE = 'for every type file, isValid throws an error for null and for undefined';
async function verdict(scriptPath, title, forbids) {
  const kept = [];
  const T = { limit: test.limit, run: function (t, severity, body) { kept.push({ title: t, body: body }); }, after: function () {}, forScript: function (s, fn) { fn(); }, hold: function () {}, release: function () {}, comment: function () {} };
  RULE.checks(scriptPath, { test: T, run: PLANT, spirit: LOADER, node: { node: null }, forbids: forbids || {} });
  const one = kept.filter(function (t) { return t.title === title; })[0];
  if (!one) return null;
  try { return (await one.body()) === true; } catch (e) { return null; }
}

test.run('it hands out appliesTo, its resource none, own false, its forbids and checks', 0.4, function () {
  return (typeof RULE.appliesTo === 'function' && RULE.resource === 'none' && RULE.own === false && Array.isArray(RULE.forbids) && typeof RULE.checks === 'function') || false;
}, test.limit.quick);
test.run('it applies to a type file and to no script outside spirit/type/', 0.4, function () {
  return (RULE.appliesTo(KEEPS) === true && RULE.appliesTo('spirit/fs/script.js') === false) || false;
}, test.limit.quick);
test.run('a planted type file whose isValid throws for null and undefined keeps the rule', 0.4, async function () {
  return (await verdict(KEEPS, RULE_TITLE)) === true;
}, test.limit.quick);
test.run('a planted type file whose isValid answers false for null is red', 0.4, async function () {
  return (await verdict(BREAKS, RULE_TITLE)) === false;
}, test.limit.quick);

// A MODULE'S OWN FORBIDDEN NAME IS SKIPPED, ONLY IN ITS OWN FILES (goal/G49.27; Andy: "All, cw's way"): a planted rule module
// that names the gone type, handed out as its forbids, keeps the name rule; the same name in another script is red. The
// planted run is made a git tree, since the rule reads the tree from git.
const NAME_TITLE = 'no script of the tree names spirit.type.string.line or spirit.type.string.lineSelect';
const OWN = { dir: 'spirit/testicle/general/zzRule' };
const GIT = { made: false };
try { require('child_process').execFileSync('git', ['init', '-q'], { cwd: PLANT, stdio: 'ignore' }); GIT.made = true; } catch (e) { GIT.made = false; }
test.run('the planted run is a git tree', 0.2, function () {
  return GIT.made || false;
}, test.limit.quick);
test.run('a planted rule module that names a type it forbids, in its forbids, keeps the name rule', 0.4, async function () {
  plant(OWN.dir + '/script.js', "'use strict';\n// it forbids spirit.type.string.line\nmodule.exports = {};\n");
  const forbids = {}; forbids[OWN.dir] = ['spirit.type.string.line'];
  return (await verdict('', NAME_TITLE, forbids)) === true;
}, test.limit.quick);
test.run('the same name in a script outside that module is red', 0.4, async function () {
  plant('spirit/zz/other/script.js', "'use strict';\n// it names spirit.type.string.line\nmodule.exports = {};\n");
  const forbids = {}; forbids[OWN.dir] = ['spirit.type.string.line'];
  return (await verdict('', NAME_TITLE, forbids)) === false;
}, test.limit.quick);
