'use strict';
const SPIRIT = require('../../../../../script.js');

// spirit/run/spirit/testicle/general/node/placeRules/test/script.js
// THE NODE PLACE RULES MODULE ON SCRIPTS OF ITS OWN (goal/G49.27, step 2b; spec: ./script.md). The box: "Each module has its
// own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red." Two
// scripts are planted, in a scratch run of their own and in the copy of the tree the module requires them in (its before):
// one that answers at once with its value and one that answers with a promise; ../script.js judges both in one run, its
// tests kept here and not reported, and the verdict of the rule's title for each is read.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const test = SPIRIT.requireScript('spirit/testicle/testReport/script.js');
const RULE = SPIRIT.requireScript('spirit/testicle/general/node/placeRules/script.js');
// ITS TEMP FOLDER FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"), removed when the suite ends.
const tempFolder = SPIRIT.requireScript('spirit/tempFolder/script.js').tempFolder;
const ROUTE = 'spirit/testicle/general/node/placeRules/test/script';
const PLANT = path.join(tempFolder(ROUTE), 'spirit', 'run');
test.after(function () { try { fs.rmSync(tempFolder.path(ROUTE), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
function plantIn(root, rel, text) { const at = path.join(root, rel); fs.mkdirSync(path.dirname(at), { recursive: true }); fs.writeFileSync(at, text); }

const KEEPS = 'spirit/zz/keeps/script.js';
const BREAKS = 'spirit/zz/breaks/script.js';
const FILES = {};
FILES[KEEPS] = "'use strict';\nrequire('../../script.js');\nmodule.exports = { kept: true };\n";
// It answers with a promise: not at once.
FILES[BREAKS] = "'use strict';\nrequire('../../script.js');\nmodule.exports = Promise.resolve({ kept: false });\n";
Object.keys(FILES).forEach(function (rel) { plantIn(PLANT, rel, FILES[rel]); });

// What checks says for the two scripts in one run, kept and not reported, each body run in the order said; the verdict of
// the rule's title for each script, true, false, or null when it was not said.
const RULE_TITLE = 'on the node, the script loads, answers at once and stands at spirit.<path minus spirit>';
const V = {};
test.run('the module judges the two planted scripts in one copy of the tree', 0.4, async function () {
  const kept = [];
  const afters = [];
  const T = { limit: test.limit, run: function (t, severity, body, limit, opts) { kept.push({ title: t, body: body, script: (opts && opts.script) || '' }); }, after: function (fn) { afters.push(fn); }, forScript: function (s, fn) { fn(); }, hold: function () {}, release: function () {}, comment: function () {} };
  const tools = { test: T, run: PLANT, spirit: SPIRIT, before: function (run) { Object.keys(FILES).forEach(function (rel) { plantIn(run, rel, FILES[rel]); }); } };
  RULE.checks(KEEPS, tools);
  RULE.checks(BREAKS, tools);
  try {
    for (const k of kept) {
      let v = null;
      try { v = (await k.body()) === true; } catch (e) { v = null; }
      if (k.title === RULE_TITLE) V[k.script] = v;
      else V.copy = v;
    }
  } finally { for (const fn of afters) { try { await fn(); } catch (e) { /* scratch */ } } }
  return kept.filter(function (k) { return k.title !== RULE_TITLE; }).length === 1 || false;
}, test.limit.long, { why: 'it starts a scratch node and requires two scripts' });

test.run('it hands out appliesTo, its resource node, own true, its forbids and checks', 0.4, function () {
  return (typeof RULE.appliesTo === 'function' && RULE.resource === 'node' && RULE.own === true && Array.isArray(RULE.forbids) && typeof RULE.checks === 'function') || false;
}, test.limit.quick);
test.run('a copy of the tree with a node of its own is made, once for both scripts', 0.4, function () {
  return V.copy === true;
}, test.limit.quick);
test.run('a planted script that answers at once with its value keeps the rule', 0.4, function () {
  return V[KEEPS] === true;
}, test.limit.quick);
test.run('a planted script that answers with a promise is red', 0.4, function () {
  return V[BREAKS] === false;
}, test.limit.quick);
