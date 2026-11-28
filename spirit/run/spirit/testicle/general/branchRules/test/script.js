'use strict';

// spirit/run/spirit/testicle/general/branchRules/test/script.js
// THE BRANCH RULES MODULE ON A TREE OF ITS OWN (goal/G49.27, step 2a; spec: ./script.md). The box: "Each module has its own
// test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red." Two app
// branches are planted in a scratch run made a git tree (the module reads the tree from git), one whose manifest keeps the
// rule and one whose manifest names a kind; ../script.js judges each, its tests kept here and not reported, and the verdict
// of the rule's title is read. Neither branch has an api.js, so no test of it asks a node.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
const test = SPIRIT.requireScript('spirit/testicle/testReport/script.js');
const RULE = SPIRIT.requireScript('spirit/testicle/general/branchRules/script.js');
// ITS TEMP FOLDER FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"), removed when the suite ends.
const tempFolder = SPIRIT.requireScript('spirit/tempFolder/script.js').tempFolder;
const ROUTE = 'spirit/testicle/general/branchRules/test/script';
const PLANT = path.join(tempFolder(ROUTE), 'spirit', 'run');
test.after(function () { try { fs.rmSync(tempFolder.path(ROUTE), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
function plant(rel, text) { const at = path.join(PLANT, rel); fs.mkdirSync(path.dirname(at), { recursive: true }); fs.writeFileSync(at, text); return at; }

const KEEPS = 'spirit/app/zzkeeps';
const BREAKS = 'spirit/app/zzbreaks';
plant(KEEPS + '/zzkeeps.json', JSON.stringify({ identity: { icon: 'k', label: 'Keeps' } }));
plant(BREAKS + '/zzbreaks.json', JSON.stringify({ identity: { icon: 'b', label: 'Breaks' }, kind: 'server' }));
const GIT = { made: false };
try { execFileSync('git', ['init', '-q'], { cwd: PLANT, stdio: 'ignore' }); GIT.made = true; } catch (e) { GIT.made = false; }

// What checks says for one path, kept and not reported; the verdict of one title, true, false, or null when it was not said.
const RULE_TITLE = 'its manifest has no kind or operated: the node operates the server';
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
test.run('the planted run is a git tree', 0.2, function () {
  return GIT.made || false;
}, test.limit.quick);
test.run('a planted app branch whose manifest has no kind or operated keeps the rule', 0.4, async function () {
  return (await verdict(KEEPS, RULE_TITLE)) === true;
}, test.limit.quick);
test.run('a planted app branch whose manifest names a kind is red', 0.4, async function () {
  return (await verdict(BREAKS, RULE_TITLE)) === false;
}, test.limit.quick);
