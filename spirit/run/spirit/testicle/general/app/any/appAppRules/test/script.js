'use strict';
const SPIRIT = require('../../../../../../script.js');

// spirit/run/spirit/testicle/general/app/any/appAppRules/test/script.js
// THE APP APP MODULE ON A TREE OF ITS OWN (goal/G49.27, step 2b; spec: ./script.md). The box: "Each module has its own test ...
// planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red." A scratch run, a git
// tree of its own (the module reads the tree from git), is planted with what keeps the rule, then with what breaks it;
// ../script.js judges it each time, its tests kept here and not reported, and the verdict of the rule's title is read.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..', '..');
const test = SPIRIT.requireScript('spirit/testicle/testReport/script.js');
const RULE = SPIRIT.requireScript('spirit/testicle/general/app/any/appAppRules/script.js');
// ITS TEMP FOLDER FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"), removed when the suite ends.
const tempFolder = SPIRIT.requireScript('spirit/tempFolder/script.js').tempFolder;
const ROUTE = 'spirit/testicle/general/app/any/appAppRules/test/script';
const PLANT = path.join(tempFolder(ROUTE), 'spirit', 'run');
test.after(function () { try { fs.rmSync(tempFolder.path(ROUTE), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
function plant(rel, text) { const at = path.join(PLANT, rel); fs.mkdirSync(path.dirname(at), { recursive: true }); fs.writeFileSync(at, text); }
const GIT = { made: false };
fs.mkdirSync(PLANT, { recursive: true });
try { require('child_process').execFileSync('git', ['init', '-q'], { cwd: PLANT, stdio: 'ignore' }); GIT.made = true; } catch (e) { GIT.made = false; }

// What checks says for one path, kept and not reported; the verdict of one title, true, false, or null when it was not said.
const RULE_TITLE = 'the shell app, spirit/app/appSelector.js and spirit/app/appSelector/ are gone';
async function verdict(scriptPath, title) {
  const kept = [];
  const T = { limit: test.limit, run: function (t, severity, body) { kept.push({ title: t, body: body }); }, over: function (t, severity, files, judge) { kept.push({ title: t, body: async function () { const l = typeof files === 'function' ? await files() : files; if (!Array.isArray(l)) return false; for (const f of l) { let v = false; try { v = await judge(f); } catch (e) { v = false; } if (v !== true) return false; } return true; } }); }, after: function () {}, forScript: function (s, fn) { fn(); }, hold: function () {}, release: function () {}, comment: function () {} };
  RULE.checks(scriptPath, { test: T, run: PLANT, spirit: SPIRIT, forbids: {} });
  const one = kept.filter(function (t) { return t.title === title; })[0];
  if (!one) return null;
  try { return (await one.body()) === true; } catch (e) { return null; }
}

test.run('it hands out appliesTo, its resource none, own false, its forbids and checks', 0.4, function () {
  return (typeof RULE.appliesTo === 'function' && RULE.resource === 'none' && RULE.own === false && Array.isArray(RULE.forbids) && typeof RULE.checks === 'function') || false;
}, test.limit.quick);
test.run('the planted run is a git tree', 0.2, function () {
  return GIT.made || false;
}, test.limit.quick);
test.run('a planted tree with no spirit/app/appSelector.js keeps the rule', 0.4, async function () {
  plant('spirit/app/zz/zz.json', '{}\n');
  return (await verdict('', RULE_TITLE)) === true;
}, test.limit.quick);
test.run('a planted tree that holds spirit/app/appSelector.js is red', 0.4, async function () {
  plant('spirit/app/appSelector.js', "'use strict';\nmodule.exports = {};\n");
  return (await verdict('', RULE_TITLE)) === false;
}, test.limit.quick);
