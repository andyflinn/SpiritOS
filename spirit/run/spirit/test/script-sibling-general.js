'use strict';
// spirit/run/spirit/test/script-sibling-general.js [<script or folder> ...]
// THE -general GENERAL TEST BESIDE spirit.js (goal/G47.1, box v94, 2: "there will be, from now on only 3 types of general
// tests, at any level of the tree: <file>-<child | sibling>-general.js, <file>-<child | sibling>-node.js,
// <file>-<child | sibling>-browser.js", "existing general tests fold into the appropriate of the 3 new general test
// name-formats"). Its contract: ./script-sibling-general.md.
//
// THE RUNNER OF THE RULE MODULES (goal/G49.27, step 2a; box v5, Andy's Go: "spirit/testicle/ is the faceless test system",
// the general rules become modules, one rule set one module): its seven parts, branchRules, titleRules, noFuckingGarbage,
// searchRules, testReachRules, generalRules (its tree rules with it) and typeRules, are each a module of
// spirit/testicle/general/<rule>/script.js now, every title kept. A module hands out { appliesTo, resource, own, forbids, checks }; this
// file loads each by its full path, asks appliesTo of the path handed and runs checks, the modules whose resource is 'none'
// and those on a node, which share the one scratch node below. "with no script-argument, they will process all applicable
// scripts. else it will process all scripts listed in the arguments that fit": no argument, each module judges all it
// applies to; each argument, each module it applies to judges that one, its results reported for it (testReport's
// test.forScript).
require('../script.js');
const test = require('../testicle/testReport/script.js');
// A path as given, absolute or not, scoped to run:// (the verifier hands absolute ones).
const RUN_DIR = require('path').join(__dirname, '..', '..');
const SPIRIT = require(require('path').join(RUN_DIR, 'spirit', 'script.js'));
function runRel(a) {
  const p = require('path');
  const abs = p.isAbsolute(String(a)) ? String(a) : p.resolve(String(a));
  const r = p.relative(RUN_DIR, abs).split(p.sep).join('/');
  if (r && r.indexOf('..') !== 0 && !p.isAbsolute(r) && require('fs').existsSync(abs)) return r;
  return String(a).split(p.sep).join('/').replace(/^\.?\//, '').replace(/^spirit\/run\//, '');
}
const GIVEN = process.argv.slice(2).filter(function (a, i, all) { return a.indexOf('--') !== 0 && all[i - 1] !== '--test'; }).map(runRel);
// ONE SCRATCH NODE FOR THE WHOLE RUN (goal/G47.1; Andy: "are the tests not ordered in the general test so that all tests
// requiring a scratch node can use the same one?"): handed a list, the node part runs once a script, and each asked lab for
// a node of its own, kept until the run ended; lab holds a few, so past them every node part and every node global check
// after it went red. The first one asked is the run's, for every script; the one testicle hands is the same for all anyway.
const ONE_NODE = { node: null };
// What every module is handed: the reporter, the run root it judges, that run's spirit object and the run's one node.
const TOOLS = { test: test, run: RUN_DIR, spirit: SPIRIT, node: ONE_NODE };

// THE RULE MODULES, IN THE ORDER THE PARTS RAN, EACH BY ITS FULL PATH (goal/G49.13: every requireScript a full path written
// out). A module that fails to load or to hand out its checks is a part that throws (below).
const RULES = [
  { name: 'generalRules', dir: 'spirit/testicle/general/generalRules', load: function () { return SPIRIT.requireScript('spirit/testicle/general/generalRules/script.js'); } },
  { name: 'branchRules', dir: 'spirit/testicle/general/branchRules', load: function () { return SPIRIT.requireScript('spirit/testicle/general/branchRules/script.js'); } },
  { name: 'titleRules', dir: 'spirit/testicle/general/titleRules', load: function () { return SPIRIT.requireScript('spirit/testicle/general/titleRules/script.js'); } },
  { name: 'noFuckingGarbage', dir: 'spirit/testicle/general/noFuckingGarbage', load: function () { return SPIRIT.requireScript('spirit/testicle/general/noFuckingGarbage/script.js'); } },
  { name: 'searchRules', dir: 'spirit/testicle/general/searchRules', load: function () { return SPIRIT.requireScript('spirit/testicle/general/searchRules/script.js'); } },
  { name: 'testReachRules', dir: 'spirit/testicle/general/testReachRules', load: function () { return SPIRIT.requireScript('spirit/testicle/general/testReachRules/script.js'); } },
  { name: 'typeRules', dir: 'spirit/testicle/general/typeRules', load: function () { return SPIRIT.requireScript('spirit/testicle/general/typeRules/script.js'); } },
];
// The resources this runner stands on: none, and the one shared node (box v5); a module on a browser or a relay is another's.
const RUNS_HERE = ['none', 'node'];
function moduleOf(rule) {
  if (!('module' in rule)) {
    let m = null;
    try { m = rule.load(); } catch (e) { m = null; }
    rule.module = m && typeof m.checks === 'function' && typeof m.appliesTo === 'function' ? m : null;
  }
  return rule.module;
}
// EACH MODULE'S FORBIDDEN NAMES, BY ITS FOLDER (goal/G49.27; Andy: "All, cw's way"): the name rules skip exactly these, and only
// in that module's own files (its script.js and its test/); a module that does not load forbids nothing.
TOOLS.forbids = {};
RULES.forEach(function (rule) { const m = moduleOf(rule); if (m && Array.isArray(m.forbids)) TOOLS.forbids[rule.dir] = m.forbids.map(String); });

// A PART THAT THROWS IS RED, NEVER SILENT: a throw while a part makes its tests reaches no running test, so testReport
// let it go and every part after it never ran (de889b3e: part 2 threw, and no test on a node ran for a branch with data).
function runPart(rule, given) {
  try {
    const m = moduleOf(rule);
    if (!m) throw new Error(rule.name + ' hands out no rule module');
    if (RUNS_HERE.indexOf(m.resource) === -1) return;
    if (given && !m.appliesTo(given)) return;
    m.checks(given || '', TOOLS);
  } catch (e) {
    // One fixed title per part (goal/G49.6: no title assembled at run time).
    const fail = function () { return false; };
    if (rule.name === 'generalRules') test.run('its general rules make their tests without throwing', 0.2, fail, test.limit.quick);
    else if (rule.name === 'branchRules') test.run('its branch rules make their tests without throwing', 0.2, fail, test.limit.quick);
    else if (rule.name === 'titleRules') test.run('its title rules make their tests without throwing', 0.2, fail, test.limit.quick);
    else if (rule.name === 'noFuckingGarbage') test.run('its garbage rules make their tests without throwing', 0.2, fail, test.limit.quick);
    else if (rule.name === 'searchRules') test.run('its search rules make their tests without throwing', 0.2, fail, test.limit.quick);
    else if (rule.name === 'testReachRules') test.run('its test reach rules make their tests without throwing', 0.2, fail, test.limit.quick);
    else if (rule.name === 'typeRules') test.run('its type rules make their tests without throwing', 0.2, fail, test.limit.quick);
    else test.run('a general part of it makes its tests without throwing', 0.2, fail, test.limit.quick);
  }
}
if (!GIVEN.length) RULES.forEach(function (rule) { runPart(rule, ''); });
else GIVEN.forEach(function (one) { test.forScript(one, function () { RULES.forEach(function (rule) { runPart(rule, one); }); }); });
