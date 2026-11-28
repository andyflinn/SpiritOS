'use strict';
// spirit/run/spirit/testicle/run/none/script.js [<script or folder> ...]
// THE RUNNER OF THE RESOURCE none (goal/G49.27, step 3; the box, Andy's Go: "one runner per resource starts it once and runs
// every module needing it, each pulled in by spirit.requireScript"; "the runner of a resource requires every module naming it,
// asks each appliesTo, and runs its checks"). Its contract: ./test/script.md.
//
// No central list: every rule module is found by walking spirit/testicle/general/, a folder holding script.js (its test/ left
// out), and each is pulled in by spirit.requireScript by its full path. A module hands out { appliesTo, resource, own,
// forbids, checks } (spirit/testicle/general/any/typeRules/script.js says each); this runner runs those whose resource is
// 'none', the cheapest (the box: "cheapest first: modules needing nothing, then a node, then the browser"), and needs nothing
// set up. The node and the browser runners (../node/script.js, ../browser/script.js) take what is shared from here.
// "with no script-argument, they will process all applicable scripts. else it will process all scripts listed in the
// arguments that fit": no argument, each module judges all it applies to; each argument, each module it applies to judges
// that one, its results reported for it (testReport's test.forScript).
const SPIRIT = require('../../../script.js');
const fs = require('fs');
const path = require('path');

const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const GENERAL = 'spirit/testicle/general';
// The reporter every module is handed (goal/G40.13: nothing of spirit/run/ reaches into the old test system).
const test = SPIRIT.requireScript('spirit/testicle/testReport/script.js');

// A path as given, absolute or not, scoped to run:// (the verifier hands absolute ones).
function runRel(a) {
  const abs = path.isAbsolute(String(a)) ? String(a) : path.resolve(String(a));
  const r = path.relative(RUN, abs).split(path.sep).join('/');
  if (r && r.indexOf('..') !== 0 && !path.isAbsolute(r) && fs.existsSync(abs)) return r;
  return String(a).split(path.sep).join('/').replace(/^\.?\//, '').replace(/^spirit\/run\//, '');
}
// The scripts handed: every argument but a flag and the title after --test.
function givenOf(argv) {
  return argv.filter(function (a, i) { return a.indexOf('--') !== 0 && argv[i - 1] !== '--test'; }).map(runRel);
}

// EVERY RULE MODULE, FOUND BY WALKING spirit/testicle/general/ (goal/G49.27, the box: "No central list"): each folder holding
// script.js, outside a test/ folder, is one module, by its folder run-relative, in the order of their paths. root is the run
// folder walked (this one by default); load(rel) pulls a module in (spirit.requireScript by default). A module that does not
// load, or hands out no checks and no appliesTo, is found with module null: a part that throws (threw, below).
// SPIRIT_RULE_MODULES, when set, is a folder under spirit/testicle/general/: only the modules in it run (a page script judged
// in a run of its own by spirit/testicle/general/browser/placeRules/script.js runs the page rules alone, as it did before).
function found(root, load) {
  const at = root || RUN;
  const pull = load || function (rel) { return SPIRIT.requireScript(rel); };
  const dirs = [];
  (function into(rel) {
    let names = [];
    try { names = fs.readdirSync(path.join(at, rel), { withFileTypes: true }); } catch (e) { return; }
    if (rel !== GENERAL && names.some(function (d) { return d.isFile() && d.name === 'script.js'; })) dirs.push(rel);
    names.filter(function (d) { return d.isDirectory() && d.name !== 'test'; }).map(function (d) { return d.name; }).sort()
      .forEach(function (n) { into(rel + '/' + n); });
  }(GENERAL));
  const only = String(process.env.SPIRIT_RULE_MODULES || '').replace(/\/+$/, '');
  return dirs.sort().filter(function (dir) { return !only || dir === only || dir.indexOf(only + '/') === 0; }).map(function (dir) {
    let m = null;
    try { m = pull(dir + '/script.js'); } catch (e) { m = null; }
    return { dir: dir, module: m && typeof m.checks === 'function' && typeof m.appliesTo === 'function' ? m : null };
  });
}
// EACH MODULE'S FORBIDDEN NAMES, BY ITS FOLDER (goal/G49.27; Andy: "All, cw's way"): the name rules skip exactly these, and only
// in that module's own files (its script.js and its test/); a module that does not load forbids nothing. Every module found
// hands its own, whichever runner runs the name rules.
function forbidsOf(list) {
  const out = {};
  list.forEach(function (r) { if (r.module && Array.isArray(r.module.forbids)) out[r.dir] = r.module.forbids.map(String); });
  return out;
}

// A PART THAT THROWS IS RED, NEVER SILENT: a module that does not load, or whose checks throw, reaches no running test, so it
// is said here, one fixed title a module (goal/G49.6: no title assembled at run time; the titles the old runners said).
function threw(dir, t) {
  const fail = function () { return false; };
  if (dir === 'spirit/testicle/general/any/generalRules') t.run('its general rules make their tests without throwing', 0.2, fail, t.limit.quick);
  else if (dir === 'spirit/testicle/general/any/branchRules') t.run('its branch rules make their tests without throwing', 0.2, fail, t.limit.quick);
  else if (dir === 'spirit/testicle/general/any/titleRules') t.run('its title rules make their tests without throwing', 0.2, fail, t.limit.quick);
  else if (dir === 'spirit/testicle/general/any/noFuckingGarbage') t.run('its garbage rules make their tests without throwing', 0.2, fail, t.limit.quick);
  else if (dir === 'spirit/testicle/general/any/searchRules') t.run('its search rules make their tests without throwing', 0.2, fail, t.limit.quick);
  else if (dir === 'spirit/testicle/general/any/testReachRules') t.run('its test reach rules make their tests without throwing', 0.2, fail, t.limit.quick);
  else if (dir === 'spirit/testicle/general/any/typeRules') t.run('its type rules make their tests without throwing', 0.2, fail, t.limit.quick);
  else if (dir === 'spirit/testicle/general/app/any/folderRules') t.run('its app folder rules make their tests without throwing', 0.2, fail, t.limit.quick);
  else if (dir === 'spirit/testicle/general/app/any/singularRules') t.run('its job and event singular rules make their tests without throwing', 0.2, fail, t.limit.quick);
  else if (dir === 'spirit/testicle/general/app/any/appAppRules') t.run('its app app rules make their tests without throwing', 0.2, fail, t.limit.quick);
  else if (dir === 'spirit/testicle/general/node/placeRules') t.run('its node place rules make their tests without throwing', 0.2, fail, t.limit.quick);
  else if (dir === 'spirit/testicle/general/browser/placeRules') t.run('its browser place rules make their tests without throwing', 0.2, fail, t.limit.quick);
  else if (dir === 'spirit/testicle/general/browser/pageRules') t.run('its page rules make their tests without throwing', 0.2, fail, t.limit.quick);
  else if (dir === 'spirit/testicle/general/app/browser/mountRules') t.run('its app mount rules make their tests without throwing', 0.2, fail, t.limit.quick);
  else t.run('a general part of it makes its tests without throwing', 0.2, fail, t.limit.quick);
}

// EACH RED SHOWN THE MOMENT IT HAPPENS, WITH ITS MODULE AND ITS CHECK (goal/G49.27, the box: "each red is shown the moment it
// happens, with its module and its check, not in a report at the end"): each module is handed a reporter of its own, the
// run's with its module named on every test (opts.module), and the reporter says a red on stderr as it ends.
function reporterFor(dir, t) {
  const own = Object.create(t);
  own.run = function (title, severity, body, limit, opts) { return t.run(title, severity, body, limit, Object.assign({}, opts || {}, { module: dir })); };
  // A whole-tree check over a list of files (goal/G49.27, testReport's test.over), its module named the same way.
  own.over = function (title, severity, files, judge, limit, opts) { return t.over(title, severity, files, judge, limit, Object.assign({}, opts || {}, { module: dir })); };
  return own;
}

// THE MODULES OF ONE RESOURCE, RUN (goal/G49.27, the box: "a module that changes its node (grants, files, contacts) says so
// (own: true), and gets a node of its own; every other module shares one"): list as found() gives it, given the scripts
// handed ([] for none), tools what every module is handed: { test, run, spirit, node, forbids, ... }. A module sharing the
// node gets tools.node, the run's one holder ({ node }); one with own: true a holder of its own, empty, so it starts its own.
// Each module is handed one tools object for the whole run, so what it keeps there for the run (a copy of the tree, a world)
// is made once. Handed nothing, each module judges all it applies to; handed scripts, each module it applies to judges each,
// reported for that script (test.forScript). order 'script' (the default): each script judged by every module before the next
// script, so its success goes out once its tests are all said (testReport); order 'module': each module over every script, a
// module's checks that answer a promise (a page drawn) waited for before its next call. Answers a promise, done when every
// module's checks have answered.
function runModules(resource, list, given, tools, order) {
  const t = tools.test;
  const mine = list.filter(function (r) { return !r.module || r.module.resource === resource; });
  const toolsOf = {};
  const toolsFor = function (r) {
    if (!toolsOf[r.dir]) toolsOf[r.dir] = Object.assign({}, tools, { test: reporterFor(r.dir, t), node: r.module.own === true ? { node: null, own: true } : tools.node });
    return toolsOf[r.dir];
  };
  // One module on one script ('' for all): its checks' answer, a red said for it when they throw or reject.
  const part = function (r, one) {
    const said = function () { if (one) t.forScript(one, function () { threw(r.dir, t); }); else threw(r.dir, t); };
    try {
      if (!r.module) throw new Error(r.dir + ' hands out no rule module');
      // Asked handed nothing too: a module that judges only a file handed says no to '' (the page rules).
      if (!r.module.appliesTo(one || '')) return null;
      return Promise.resolve(r.module.checks(one || '', toolsFor(r))).then(null, said);
    } catch (e) { said(); return null; }
  };
  if (order === 'module') {
    return (async function () {
      for (const r of mine) {
        if (!given.length) { await part(r, ''); continue; }
        for (const one of given) { let answer = null; t.forScript(one, function () { answer = part(r, one); }); await answer; }
      }
    }());
  }
  const answers = [];
  if (!given.length) mine.forEach(function (r) { answers.push(part(r, '')); });
  else given.forEach(function (one) { t.forScript(one, function () { mine.forEach(function (r) { answers.push(part(r, one)); }); }); });
  return Promise.all(answers);
}
// The modules of one resource the scripts handed need: those whose appliesTo takes one of them, or takes '' handed nothing.
function needed(resource, list, given, own) {
  return list.some(function (r) {
    return !!r.module && r.module.resource === resource && (own === undefined || (r.module.own === true) === own) &&
      (given.length ? given.some(function (one) { return r.module.appliesTo(one); }) : r.module.appliesTo(''));
  });
}
// SETUP IS ITS OWN TIMED STEP WITH ITS OWN LIMIT (goal/G49.27, the box: "a node or Chrome that does not come up is red as
// that, by name"): boot() answers whether it came up; past limitMs it did not.
function timed(boot, limitMs) {
  let timer = null;
  const late = new Promise(function (resolve) { timer = setTimeout(function () { resolve(false); }, limitMs); });
  return Promise.race([Promise.resolve().then(boot).then(function (up) { return up === true; }, function () { return false; }), late])
    .then(function (up) { clearTimeout(timer); return up; });
}

module.exports = { RUN: RUN, GENERAL: GENERAL, runRel: runRel, givenOf: givenOf, found: found, forbidsOf: forbidsOf, threw: threw, reporterFor: reporterFor, runModules: runModules, needed: needed, timed: timed };

if (require.main === module) {
  const list = found();
  const given = givenOf(process.argv.slice(2));
  runModules('none', list, given, { test: test, run: RUN, spirit: SPIRIT, node: { node: null }, forbids: forbidsOf(list) });
}
