'use strict';

// spirit/run/spirit/testicle/general/app/any/singularRules/test/script.js
// THE JOB AND EVENT SINGULAR MODULE ON A TREE OF ITS OWN (goal/G49.27, step 2b; spec: ./script.md). The box: "Each module has its own test ...
// planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red." A scratch run, a git
// tree of its own (the module reads the tree from git), is planted with what keeps the rule, then with what breaks it;
// ../script.js judges it each time, its tests kept here and not reported, and the verdict of the rule's title is read.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..', '..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
const test = SPIRIT.requireScript('spirit/testicle/testReport/script.js');
const RULE = SPIRIT.requireScript('spirit/testicle/general/app/any/singularRules/script.js');
// ITS TEMP FOLDER FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"), removed when the suite ends.
const tempFolder = SPIRIT.requireScript('spirit/tempFolder/script.js').tempFolder;
const ROUTE = 'spirit/testicle/general/app/any/singularRules/test/script';
const PLANT = path.join(tempFolder(ROUTE), 'spirit', 'run');
test.after(function () { try { fs.rmSync(tempFolder.path(ROUTE), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
function plant(rel, text) { const at = path.join(PLANT, rel); fs.mkdirSync(path.dirname(at), { recursive: true }); fs.writeFileSync(at, text); }
const GIT = { made: false };
fs.mkdirSync(PLANT, { recursive: true });
try { require('child_process').execFileSync('git', ['init', '-q'], { cwd: PLANT, stdio: 'ignore' }); GIT.made = true; } catch (e) { GIT.made = false; }

// What checks says for one path, kept and not reported; the verdict of one title, true, false, or null when it was not said.
const RULE_TITLE = 'no product file calls a verb by its old name, jobs.* or events.*, nor spirit.jobs or spirit.events';
async function verdict(scriptPath, title) {
  const kept = [];
  const T = { limit: test.limit, run: function (t, severity, body) { kept.push({ title: t, body: body }); }, after: function () {}, forScript: function (s, fn) { fn(); }, hold: function () {}, release: function () {}, comment: function () {} };
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
test.run('a planted product file that calls a verb by its new name keeps the rule', 0.4, async function () {
  plant('spirit/zz/keeps/script.js', "'use strict';\nmodule.exports = { go: function () { return spirit.job.search({}); } };\n");
  return (await verdict('', RULE_TITLE)) === true;
}, test.limit.quick);
test.run('a planted product file that calls spirit.jobs is red', 0.4, async function () {
  plant('spirit/zz/breaks/script.js', "'use strict';\nmodule.exports = { go: function () { return spirit.jobs.search({}); } };\n");
  return (await verdict('', RULE_TITLE)) === false;
}, test.limit.quick);

// A MODULE'S OWN FORBIDDEN NAME IS SKIPPED, ONLY IN ITS OWN FILES (goal/G49.27; Andy: "All, cw's way"): a planted rule module that
// names the old name, handed out as its forbids, keeps the rule; the same name elsewhere stays red (above).
test.run('a planted rule module that names spirit.jobs, in its forbids, keeps the rule once the breaking file is gone', 0.4, async function () {
  fs.rmSync(path.join(PLANT, 'spirit', 'zz', 'breaks'), { recursive: true, force: true });
  plant('spirit/testicle/general/zzRule/script.js', "'use strict';\nmodule.exports = { title: 'no spirit.jobs' };\n");
  const kept = [];
  const T = { limit: test.limit, run: function (t, severity, body) { kept.push({ title: t, body: body }); }, after: function () {}, forScript: function (s, fn) { fn(); }, hold: function () {}, release: function () {}, comment: function () {} };
  RULE.checks('', { test: T, run: PLANT, spirit: SPIRIT, forbids: { 'spirit/testicle/general/zzRule': ['spirit.jobs'] } });
  const one = kept.filter(function (t) { return t.title === RULE_TITLE; })[0];
  return (!!one && (await one.body()) === true) || false;
}, test.limit.quick);
