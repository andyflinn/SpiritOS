'use strict';

// spirit/run/spirit/testicle/general/any/generalRules/test/script.js
// THE GENERAL RULES MODULE ON A TREE OF ITS OWN (goal/G49.27, step 2a; spec: ./script.md). The box: "Each module has its own
// test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red." Two
// product scripts are planted in a scratch run, one that holds the shape (use strict, spirit first) and one that starts with
// a plain require; ../script.js judges each, its tests kept here and not reported, and the verdict of the rule's title is
// read. Only that title's body runs, so no test of it starts a node.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
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
