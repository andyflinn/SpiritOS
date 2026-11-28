'use strict';
const SPIRIT = require('../../../../../script.js');

// spirit/run/spirit/testicle/general/any/testReachRules/test/script.js
// THE TEST REACH RULES MODULE ON A TREE OF ITS OWN (goal/G49.27, step 2a; spec: ./script.md). The box: "Each module has its
// own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red." Two
// production scripts are planted in a scratch run, one that loads only a sibling and one that requires a test file;
// ../script.js judges each, its tests kept here and not reported, and the verdict of the rule's title is read.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const test = SPIRIT.requireScript('spirit/testicle/testReport/script.js');
const RULE = SPIRIT.requireScript('spirit/testicle/general/any/testReachRules/script.js');
// ITS TEMP FOLDER FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"), removed when the suite ends.
const tempFolder = SPIRIT.requireScript('spirit/tempFolder/script.js').tempFolder;
const ROUTE = 'spirit/testicle/general/testReachRules/test/script';
const PLANT = path.join(tempFolder(ROUTE), 'spirit', 'run');
test.after(function () { try { fs.rmSync(tempFolder.path(ROUTE), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
function plant(rel, text) { const at = path.join(PLANT, rel); fs.mkdirSync(path.dirname(at), { recursive: true }); fs.writeFileSync(at, text); return at; }

// Handed by their run path: the temp folder's own path holds a test/ folder, which the rule takes for a test file.
const KEEPS = 'spirit/zz/keeps/script.js';
const BREAKS = 'spirit/zz/breaks/script.js';
plant(KEEPS, "'use strict';\nconst helper = require('./helper.js');\nmodule.exports = { helper: helper };\n");
plant(BREAKS, "'use strict';\nconst own = require('./test/script.js');\nmodule.exports = { own: own };\n");

// What checks says for one path, kept and not reported; the verdict of one title, true, false, or null when it was not said.
const RULE_TITLE = 'no production module loads or requires a test file';
async function verdict(scriptPath, title) {
  const kept = [];
  const T = { limit: test.limit, run: function (t, severity, body) { kept.push({ title: t, body: body }); }, after: function () {}, forScript: function (s, fn) { fn(); }, hold: function () {}, release: function () {}, comment: function () {} };
  RULE.checks(scriptPath, { test: T, run: PLANT, spirit: SPIRIT, node: { node: null } });
  const one = kept.filter(function (t) { return t.title === title; })[0];
  if (!one) return null;
  try { return (await one.body()) === true; } catch (e) { return null; }
}

test.run('it hands out appliesTo, its resource none, own false, its forbids and checks', 0.4, function () {
  return (typeof RULE.appliesTo === 'function' && RULE.resource === 'none' && RULE.own === false && Array.isArray(RULE.forbids) && typeof RULE.checks === 'function') || false;
}, test.limit.quick);
test.run('it applies to a production script and to no file in a test folder', 0.4, function () {
  return (RULE.appliesTo('spirit/fs/script.js') === true && RULE.appliesTo('spirit/fs/test/script.js') === false) || false;
}, test.limit.quick);
test.run('a planted script that requires only a sibling keeps the rule', 0.4, async function () {
  return (await verdict(KEEPS, RULE_TITLE)) === true;
}, test.limit.quick);
test.run('a planted script that requires a file of its test folder is red', 0.4, async function () {
  return (await verdict(BREAKS, RULE_TITLE)) === false;
}, test.limit.quick);
