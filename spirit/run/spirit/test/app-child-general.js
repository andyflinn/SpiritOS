'use strict';

// spirit/run/spirit/test/app-child-general.js [file]
// THE RULES FOR THE SUB-FOLDERS OF spirit/app/ (goal/G43.32; spec: ./app-child-general.md). Andy, the box: "rules for
// sub-folders of run://spirit/app/", 0 to 6, and of its name: "if app-child-general.js works that is my decision." A
// -child- general test beside spirit/app/manager/script.js (./TEST_SYSTEM.md): it judges spirit/app/manager/script.js and spirit/app/ and below.
//
//   node spirit/test/app-child-general.js spirit/app/desk/desk.js     the app the file is in
//   node spirit/test/app-child-general.js                             every sub-folder of spirit/app/
//
// THE RUNNER OF ITS RULE MODULES (goal/G49.27, step 2b; box v5, Andy's Go: "spirit/testicle/ is the faceless test system", the
// general rules become modules, one rule set one module): its parts are each a module of spirit/testicle/general/app/any/ now,
// every title kept: folderRules (1 to 6, for each sub-folder), singularRules (0, job and event singular) and appAppRules (the
// app app, no app a shell). This file loads each by its full path, asks appliesTo of the path handed and runs checks.
// A LIST OF SCRIPTS (goal/G47.1, box v94, 2: "with no script-argument, they will process all applicable scripts. else it
// will process all scripts listed in the arguments that fit"): its rules judge each argument in turn, its results reported for
// that argument (testReport's test.forScript); none given, every sub-folder.
require('../script.js');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
const test = SPIRIT.requireScript('spirit/testicle/testReport/script.js');
const GIVEN = process.argv.slice(2).filter(function (a, i, all) { return a.indexOf('--') !== 0 && all[i - 1] !== '--test'; });
// What every module is handed: the reporter, the run root it judges and its spirit object.
const TOOLS = { test: test, run: RUN, spirit: SPIRIT };
// THE RULE MODULES, EACH BY ITS FULL PATH (goal/G49.13: every requireScript a full path written out).
const RULES = [
  { name: 'folderRules', dir: 'spirit/testicle/general/app/any/folderRules', load: function () { return SPIRIT.requireScript('spirit/testicle/general/app/any/folderRules/script.js'); } },
  { name: 'singularRules', dir: 'spirit/testicle/general/app/any/singularRules', load: function () { return SPIRIT.requireScript('spirit/testicle/general/app/any/singularRules/script.js'); } },
  { name: 'appAppRules', dir: 'spirit/testicle/general/app/any/appAppRules', load: function () { return SPIRIT.requireScript('spirit/testicle/general/app/any/appAppRules/script.js'); } },
];
function moduleOf(rule) {
  if (!('module' in rule)) {
    let m = null;
    try { m = rule.load(); } catch (e) { m = null; }
    rule.module = m && typeof m.checks === 'function' && typeof m.appliesTo === 'function' ? m : null;
  }
  return rule.module;
}
// EACH MODULE'S FORBIDDEN NAMES, BY ITS FOLDER (goal/G49.27; Andy: "All, cw's way"): the name rules skip exactly these, and only
// in that module's own files; a module that does not load forbids nothing.
TOOLS.forbids = {};
RULES.forEach(function (rule) { const m = moduleOf(rule); if (m && Array.isArray(m.forbids)) TOOLS.forbids[rule.dir] = m.forbids.map(String); });
// A PART THAT THROWS IS RED, NEVER SILENT (goal/G49.27, as spirit/test/script-sibling-general.js says its parts): a module that
// does not load, or whose checks throw, reaches no running test, so it is said here, one fixed title a module (goal/G49.6: no
// title assembled at run time).
function runPart(rule, given) {
  try {
    const m = moduleOf(rule);
    if (!m) throw new Error(rule.name + ' hands out no rule module');
    if (given && !m.appliesTo(given)) return;
    m.checks(given || '', TOOLS);
  } catch (e) {
    const fail = function () { return false; };
    if (rule.name === 'folderRules') test.run('its app folder rules make their tests without throwing', 0.2, fail, test.limit.quick);
    else if (rule.name === 'singularRules') test.run('its job and event singular rules make their tests without throwing', 0.2, fail, test.limit.quick);
    else test.run('its app app rules make their tests without throwing', 0.2, fail, test.limit.quick);
  }
}
if (!GIVEN.length) RULES.forEach(function (rule) { runPart(rule, ''); });
else GIVEN.forEach(function (one) { test.forScript(one, function () { RULES.forEach(function (rule) { runPart(rule, one); }); }); });
