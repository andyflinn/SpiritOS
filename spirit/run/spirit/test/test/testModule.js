'use strict';

// spirit/run/spirit/test/test/testModule.js
// THE GENERAL RULES JUDGE THE PRODUCT MODULES (goal/G43.23, item 4; spec: ./testModule.md). The box: "the general rules
// judge no module: testModule.js looks for ./spirit.js."
//
// testsFor() of ../testModule.js, on this tree as it stands, read only: the general rule tests of spirit/test/
// folder (spirit-<child|sibling>-<x>Rules.js, named after spirit.js, which is at spirit/spirit.js since goal/G43.18) are
// handed a module under spirit/run/spirit/ as the file they judge, on the module's blast radius and on the whole list.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { testsFor } = require(path.join(RUN, 'spirit', 'test', 'testModule.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }

// The general rule tests in spirit/test/, beside spirit/spirit.js (goal/G43.32).
// The branch rules (spirit-sibling-branchRules.js) judge branch folders, not modules: judged below, apart.
const GENERAL = fs.readdirSync(path.join(RUN, 'spirit', 'test')).filter(function (n) { return /^spirit-(child|sibling)-\w+Rules\.js$/.test(n) && n !== 'spirit-sibling-branchRules.js'; })
  .map(function (n) { return 'spirit/test/' + n; }).sort();
const BRANCH_RULES = 'spirit/test/spirit-sibling-branchRules.js';
// The module judged: an opted-in product module under spirit/run/spirit/ (it has its own spirit/test/<name>.js).
const MODULE = 'spirit/apiDoor.js';
// What testsFor answers, asked once by the test that first needs it.
const W = { radius: null, all: null };
function radius() { return W.radius || (W.radius = testsFor(MODULE)); }
function all() { return W.all || (W.all = testsFor('')); }

// the world
test.run('the world: spirit/test/ holds four general rule tests, spirit-child-generalRules.js folded into spirit-sibling-generalRules.js', 0.2, function () {
  return GENERAL.length === 4 || 'the general rule tests found: ' + short(GENERAL);
}, 1000);
test.run('the world: spirit.js, the module they are named after, is spirit/spirit.js, and none is at the run root', 0.2, function () {
  return (fs.existsSync(path.join(RUN, 'spirit', 'spirit.js')) && !fs.existsSync(path.join(RUN, 'spirit.js'))) || 'spirit.js is not where goal/G43.18 put it';
}, 1000);
test.run('the world: spirit/apiDoor.js is a product module with its own test, so it is opted in', 0.2, function () {
  return (fs.existsSync(path.join(RUN, MODULE)) && fs.existsSync(path.join(RUN, 'spirit', 'test', 'apiDoor.js'))) || MODULE + ' or its own test is missing: nothing judged';
}, 1000);

// a module's blast radius
test.run('the world: its blast radius holds its own test', 0.2, function () {
  return radius().some(function (e) { return e.test === 'spirit/test/apiDoor.js'; }) || 'its blast radius: ' + short(radius());
}, 1000);
// Each general rule test written out, so that each check has a plain title of its own.
function onRadius(g) {
  const hit = radius().filter(function (e) { return e.test === g && e.file === MODULE; });
  return hit.length === 1 || g + ' is not given ' + MODULE + ' to judge; its entries: ' + short(radius().filter(function (e) { return e.test === g; }));
}
test.run('spirit/test/spirit-sibling-generalRules.js judges spirit/apiDoor.js on its blast radius', 0.2, function () { return onRadius('spirit/test/spirit-sibling-generalRules.js'); }, 1000);
test.run('spirit/test/spirit-sibling-searchRules.js judges spirit/apiDoor.js on its blast radius', 0.2, function () { return onRadius('spirit/test/spirit-sibling-searchRules.js'); }, 1000);
test.run('spirit/test/spirit-sibling-testReachRules.js judges spirit/apiDoor.js on its blast radius', 0.2, function () { return onRadius('spirit/test/spirit-sibling-testReachRules.js'); }, 1000);
test.run('spirit/test/spirit-sibling-titleRules.js judges spirit/apiDoor.js on its blast radius', 0.2, function () { return onRadius('spirit/test/spirit-sibling-titleRules.js'); }, 1000);

// ONE TEST FILE PER SCRIPT (goal/G45.1; spirit/run/spirit/test/TEST_SYSTEM.md; Andy: "there is ONE FUCKING test file in the
// test folder per script file, and every fucking test that applies to that file must be inserted in the that one file"):
// testsFor reads ./test/<name>.js for a script, and never a ./test/<name>-<what>.js. Judged on a planted tree of its own.
// one test file per script: no <name>-<what>.js is read
const ONE = { zz: null, part: null };
test.run('the world: a script\'s one test file runs with it, and with the scripts below it', 0.2, function () {
  const planted = fs.mkdtempSync(path.join(require('os').tmpdir(), 'spirit-onefile-'));
  try {
    const put = function (rel, text) { const f = path.join(planted, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text || '\n'); };
    put('spirit/zz.js'); put('spirit/test/zz.js'); put('spirit/test/zz-extra.js'); put('spirit/zz/part.js'); put('spirit/zz/test/part.js'); put('spirit/zz/test/part-more.js');
    ONE.zz = testsFor('spirit/zz.js', { root: planted }).map(function (e) { return e.test; });
    ONE.part = testsFor('spirit/zz/part.js', { root: planted }).map(function (e) { return e.test; });
  } finally { try { fs.rmSync(planted, { recursive: true, force: true }); } catch (e) { /* scratch */ } }
  const zz = ONE.zz; const part = ONE.part;
  return (zz.indexOf('spirit/test/zz.js') !== -1 && part.indexOf('spirit/zz/test/part.js') !== -1 && part.indexOf('spirit/test/zz.js') !== -1) || 'zz: ' + short(zz) + ', part: ' + short(part);
}, 1000);
test.run('no <name>-<what>.js is read, on its own script or below it', 0.2, function () {
  if (!ONE.zz || !ONE.part) return 'no planted tree read: the world failed';
  const zz = ONE.zz; const part = ONE.part;
  return (zz.indexOf('spirit/test/zz-extra.js') === -1 && part.indexOf('spirit/test/zz-extra.js') === -1 && part.indexOf('spirit/zz/test/part-more.js') === -1) ||
    'read: ' + short(zz.concat(part).filter(function (t) { return /-(extra|more)\.js$/.test(t); }));
}, 1000);

// NO OPTING IN (goal/G47.1; Andy: "all general test will auto-opt in ANY applicable file."): a general test judges every
// module in its reach, with its own test or without one. Judged on a planted tree of its own.
// a general test judges a module with no test of its own
const OPT = { whole: null, lone: null };
test.run('the world: a general test judges a module with its own test', 0.2, function () {
  const planted = fs.mkdtempSync(path.join(require('os').tmpdir(), 'spirit-optin-'));
  try {
    const put = function (rel) { const f = path.join(planted, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, '\n'); };
    put('spirit/spirit.js'); put('spirit/test/spirit-sibling-zzRules.js'); put('spirit/lone.js'); put('spirit/sub/deep.js'); put('spirit/owned.js'); put('spirit/test/owned.js');
    OPT.whole = testsFor('', { root: planted }).filter(function (e) { return e.test === 'spirit/test/spirit-sibling-zzRules.js'; }).map(function (e) { return e.file; });
    OPT.lone = testsFor('spirit/lone.js', { root: planted }).filter(function (e) { return e.test === 'spirit/test/spirit-sibling-zzRules.js'; }).map(function (e) { return e.file; });
  } finally { try { fs.rmSync(planted, { recursive: true, force: true }); } catch (e) { /* scratch */ } }
  return OPT.whole.indexOf('spirit/owned.js') !== -1 || 'its entries: ' + short(OPT.whole);
}, 1000);
test.run('on the whole list a general test judges every module in its reach that has no test of its own', 0.2, function () {
  if (!OPT.whole) return 'no planted tree read: the world failed';
  return (OPT.whole.indexOf('spirit/lone.js') !== -1 && OPT.whole.indexOf('spirit/sub/deep.js') !== -1) || 'its entries: ' + short(OPT.whole);
}, 1000);
test.run('on the blast radius of a module with no test of its own the general test judges it', 0.2, function () {
  if (!OPT.lone) return 'no planted tree read: the world failed';
  return OPT.lone.join() === 'spirit/lone.js' || 'its entries there: ' + short(OPT.lone);
}, 1000);

// the whole list
test.run('the world: the whole list names entries', 0.2, function () {
  return all().length > 0 || 'the whole list is empty: nothing judged';
}, 1000);
function onWhole(g) {
  const judged = all().filter(function (e) { return e.test === g && e.file; });
  return judged.some(function (e) { return e.file === MODULE; }) || g + ' judges no module on the whole list; its entries: ' + short(all().filter(function (e) { return e.test === g; }));
}
test.run('spirit/test/spirit-sibling-generalRules.js judges modules on the whole list, spirit/apiDoor.js among them', 0.2, function () { return onWhole('spirit/test/spirit-sibling-generalRules.js'); }, 1000);
test.run('spirit/test/spirit-sibling-searchRules.js judges modules on the whole list, spirit/apiDoor.js among them', 0.2, function () { return onWhole('spirit/test/spirit-sibling-searchRules.js'); }, 1000);
test.run('spirit/test/spirit-sibling-testReachRules.js judges modules on the whole list, spirit/apiDoor.js among them', 0.2, function () { return onWhole('spirit/test/spirit-sibling-testReachRules.js'); }, 1000);
test.run('spirit/test/spirit-sibling-titleRules.js judges modules on the whole list, spirit/apiDoor.js among them', 0.2, function () { return onWhole('spirit/test/spirit-sibling-titleRules.js'); }, 1000);

// THE BRANCH RULES JUDGE EACH BRANCH FOLDER ONCE (goal/G43.32; Andy: "app-branches are easily identified using the
// patterns: spirit/app/<name>/<name>.js, spirit/app/<name>/<name>.json", "and system branches by: spirit.<name>.api.js &&
// spirit.<name>.data.js", to Q7: "branch test only needs to associate a failure with either spirit/<name>/ or
// spirit/app/<name>/").
// the branch rules: one entry per branch folder
const { branchesOf } = require(path.join(RUN, 'spirit', 'test', 'testModule.js'));
let branches = null;
test.run('the world: twenty or more branch folders, read by both patterns, an app by its manifest since goal/G43.32 (spirit/app/test/ and spirit/test/ are none)', 0.2, function () {
  branches = branchesOf(RUN).map(function (b) { return b.dir; });
  const onDisc = [];
  fs.readdirSync(path.join(RUN, 'spirit'), { withFileTypes: true }).forEach(function (d) { if (d.isDirectory() && fs.existsSync(path.join(RUN, 'spirit', d.name, 'api.js')) && fs.existsSync(path.join(RUN, 'spirit', d.name, 'data.js'))) onDisc.push('spirit/' + d.name); });
  fs.readdirSync(path.join(RUN, 'spirit', 'app'), { withFileTypes: true }).forEach(function (d) { if (d.isDirectory() && fs.existsSync(path.join(RUN, 'spirit', 'app', d.name, d.name + '.json'))) onDisc.push('spirit/app/' + d.name); });
  return (fs.existsSync(path.join(RUN, BRANCH_RULES)) && branches.length >= 20 && branches.slice().sort().join() === onDisc.sort().join() && branches.indexOf('spirit/app/test') === -1 && branches.indexOf('spirit/test') === -1) ||
    'branchesOf: ' + short(branches) + ', the disc by both patterns: ' + short(onDisc);
}, 1000);
test.run('on the whole list it has one entry per branch folder', 0.2, function () {
  if (!branches) return 'no branch folders read: the world failed';
  const brAll = all().filter(function (e) { return e.test === BRANCH_RULES; }).map(function (e) { return e.file; });
  return (brAll.length === branches.length && brAll.slice().sort().join() === branches.slice().sort().join()) || 'its entries: ' + short(brAll);
}, 1000);
test.run('on spirit/app/desk/desk.js\'s blast radius, the one branch holding it, spirit/app/desk, not spirit/app', 0.2, function () {
  const brDesk = testsFor('spirit/app/desk/desk.js').filter(function (e) { return e.test === BRANCH_RULES; }).map(function (e) { return e.file; });
  return brDesk.join() === 'spirit/app/desk' || 'its entries there: ' + short(brDesk);
}, 1000);
test.run('a module in no branch (spirit/apiAuth.js) gets no entry of it', 0.2, function () {
  const brNone = testsFor('spirit/apiAuth.js').filter(function (e) { return e.test === BRANCH_RULES; });
  return !brNone.length || 'spirit/apiAuth.js gets ' + short(brNone);
}, 1000);

// THE TOOLS OF spirit/test/ (goal/G43.32, Q2): tools, not tests, and judged as no module; their own tests are listed.
// spirit/test/'s tools are not tests
const TOOLS = ['spirit/test/testReport.js', 'spirit/test/testModule.js', 'spirit/test/headLessChrome.js'];
test.run('the world: the three tools are in spirit/test/', 0.2, function () {
  return TOOLS.every(function (t) { return fs.existsSync(path.join(RUN, t)); }) || 'a tool is missing from spirit/test/: ' + short(TOOLS.filter(function (t) { return !fs.existsSync(path.join(RUN, t)); }));
}, 1000);
test.run('none of the three tools, testReport.js, testModule.js and headLessChrome.js, is listed as a test', 0.2, function () {
  const asTest = all().filter(function (e) { return TOOLS.indexOf(e.test) !== -1; });
  return (all().length > 0 && !asTest.length) || 'listed as tests: ' + short(asTest);
}, 1000);
test.run('and none is handed to a general test as a module', 0.2, function () {
  const asModule = all().filter(function (e) { return TOOLS.indexOf(e.file) !== -1; });
  return (all().length > 0 && !asModule.length) || 'judged as modules: ' + short(asModule);
}, 1000);
test.run('their own tests in spirit/test/test/ are listed', 0.2, function () {
  return (all().some(function (e) { return e.test === 'spirit/test/test/testModule.js'; }) && all().some(function (e) { return e.test === 'spirit/test/test/testReport.js'; })) ||
    'spirit/test/test/ is not listed: ' + short(all().filter(function (e) { return String(e.test).indexOf('spirit/test/test/') === 0; }));
}, 1000);
