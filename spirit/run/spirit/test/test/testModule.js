'use strict';

// spirit/run/spirit/test/test/testModule.js
// THE GENERAL RULES JUDGE THE PRODUCT MODULES (goal/G43.23, item 4; spec: ./testModule.md). The box: "the general rules
// judge no module: testModule.js looks for ./spirit.js."
//
// testsFor() of ../testModule.js, on this tree as it stands, read only: the general rule tests of spirit/test/
// folder (spirit-<child|sibling>-<general|node|browser>.js, named after spirit.js, which is at spirit/spirit.js since goal/G43.18) are
// handed a module under spirit/run/spirit/ as the file they judge, on the module's blast radius and on the whole list.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { testsFor } = require(path.join(RUN, 'spirit', 'test', 'testModule.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }

// The general tests in spirit/test/, beside spirit/spirit.js (goal/G43.32), of the three kinds since goal/G47.1, box v94, 2:
// "there will be, from now on only 3 types of general tests, at any level of the tree: <file>-<child | sibling>-general.js,
// <file>-<child | sibling>-node.js, <file>-<child | sibling>-browser.js".
const KINDS = ['spirit/test/spirit-sibling-browser.js', 'spirit/test/spirit-sibling-general.js', 'spirit/test/spirit-sibling-node.js'];
const GENERAL = fs.readdirSync(path.join(RUN, 'spirit', 'test')).filter(function (n) { return /^spirit-(child|sibling)-/.test(n) && /.js$/.test(n); })
  .map(function (n) { return 'spirit/test/' + n; }).sort();
// The module judged: an opted-in product module under spirit/run/spirit/ (it has its own spirit/test/<name>.js).
const MODULE = 'spirit/apiDoor.js';
// What testsFor answers, asked once by the test that first needs it.
const W = { radius: null, all: null };
function radius() { return W.radius || (W.radius = testsFor(MODULE)); }
function all() { return W.all || (W.all = testsFor('')); }

// the world
test.run('the world: spirit/test/ holds the general tests of spirit.js, of the three kinds and no other', 0.2, function () {
  return GENERAL.join() === KINDS.join() || 'the general tests found: ' + short(GENERAL);
}, test.limit.quick);
test.run('the world: spirit.js, the module they are named after, is spirit/spirit.js, and none is at the run root', 0.2, function () {
  return (fs.existsSync(path.join(RUN, 'spirit', 'spirit.js')) && !fs.existsSync(path.join(RUN, 'spirit.js'))) || 'spirit.js is not where goal/G43.18 put it';
}, test.limit.quick);
test.run('the world: spirit/apiDoor.js is a product module with its own test, so it is opted in', 0.2, function () {
  return (fs.existsSync(path.join(RUN, MODULE)) && fs.existsSync(path.join(RUN, 'spirit', 'test', 'apiDoor.js'))) || MODULE + ' or its own test is missing: nothing judged';
}, test.limit.quick);

// a module's blast radius
test.run('the world: its blast radius holds its own test', 0.2, function () {
  return radius().some(function (e) { return e.test === 'spirit/test/apiDoor.js'; }) || 'its blast radius: ' + short(radius());
}, test.limit.quick);
// Each general rule test written out, so that each check has a plain title of its own.
function onRadius(g) {
  const hit = radius().filter(function (e) { return e.test === g && e.file === MODULE; });
  return hit.length === 1 || g + ' is not given ' + MODULE + ' to judge; its entries: ' + short(radius().filter(function (e) { return e.test === g; }));
}
test.run('spirit/test/spirit-sibling-general.js judges spirit/apiDoor.js on its blast radius', 0.2, function () { return onRadius('spirit/test/spirit-sibling-general.js'); }, test.limit.quick);
test.run('spirit/test/spirit-sibling-node.js judges spirit/apiDoor.js on its blast radius', 0.2, function () { return onRadius('spirit/test/spirit-sibling-node.js'); }, test.limit.quick);
test.run('spirit/test/spirit-sibling-browser.js judges spirit/apiDoor.js on its blast radius', 0.2, function () { return onRadius('spirit/test/spirit-sibling-browser.js'); }, test.limit.quick);

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
}, test.limit.quick);
test.run('no <name>-<what>.js is read, on its own script or below it', 0.2, function () {
  if (!ONE.zz || !ONE.part) return 'no planted tree read: the world failed';
  const zz = ONE.zz; const part = ONE.part;
  return (zz.indexOf('spirit/test/zz-extra.js') === -1 && part.indexOf('spirit/test/zz-extra.js') === -1 && part.indexOf('spirit/zz/test/part-more.js') === -1) ||
    'read: ' + short(zz.concat(part).filter(function (t) { return /-(extra|more)\.js$/.test(t); }));
}, test.limit.quick);

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
}, test.limit.quick);
test.run('on the whole list a general test judges every module in its reach that has no test of its own', 0.2, function () {
  if (!OPT.whole) return 'no planted tree read: the world failed';
  return (OPT.whole.indexOf('spirit/lone.js') !== -1 && OPT.whole.indexOf('spirit/sub/deep.js') !== -1) || 'its entries: ' + short(OPT.whole);
}, test.limit.quick);
test.run('on the blast radius of a module with no test of its own the general test judges it', 0.2, function () {
  if (!OPT.lone) return 'no planted tree read: the world failed';
  return OPT.lone.join() === 'spirit/lone.js' || 'its entries there: ' + short(OPT.lone);
}, test.limit.quick);

// the whole list
test.run('the world: the whole list names entries', 0.2, function () {
  return all().length > 0 || 'the whole list is empty: nothing judged';
}, test.limit.quick);
function onWhole(g) {
  const judged = all().filter(function (e) { return e.test === g && e.file; });
  return judged.some(function (e) { return e.file === MODULE; }) || g + ' judges no module on the whole list; its entries: ' + short(all().filter(function (e) { return e.test === g; }));
}
test.run('spirit/test/spirit-sibling-general.js judges modules on the whole list, spirit/apiDoor.js among them', 0.2, function () { return onWhole('spirit/test/spirit-sibling-general.js'); }, test.limit.quick);
test.run('spirit/test/spirit-sibling-node.js judges modules on the whole list, spirit/apiDoor.js among them', 0.2, function () { return onWhole('spirit/test/spirit-sibling-node.js'); }, test.limit.quick);
test.run('spirit/test/spirit-sibling-browser.js judges modules on the whole list, spirit/apiDoor.js among them', 0.2, function () { return onWhole('spirit/test/spirit-sibling-browser.js'); }, test.limit.quick);

// THE BRANCH RULES JUDGE A SCRIPT'S BRANCH FROM THE SCRIPT (goal/G47.1, box v94, 2: they are a part of
// spirit-sibling-general.js, which is one entry per module like every general test): no entry is a branch folder.
const { branchesOf } = require(path.join(RUN, 'spirit', 'test', 'testModule.js'));
test.run('no general test is handed a branch folder, on the whole list', 0.2, function () {
  const dirs = branchesOf(RUN).map(function (b) { return b.dir; });
  const folders = all().filter(function (e) { return e.file && dirs.indexOf(e.file) !== -1; });
  return (dirs.length >= 20 && !folders.length) || 'branch folders handed: ' + short(folders.slice(0, 5));
}, test.limit.quick);
test.run('on the blast radius of spirit/app/desk/desk.js, spirit-sibling-general.js judges desk.js itself', 0.2, function () {
  const desk = testsFor('spirit/app/desk/desk.js').filter(function (e) { return e.test === 'spirit/test/spirit-sibling-general.js'; }).map(function (e) { return e.file; });
  return desk.join() === 'spirit/app/desk/desk.js' || 'its entries there: ' + short(desk);
}, test.limit.quick);
// THE SPECIAL GENERAL TESTS (goal/G47.1, box v94, 1): testicle runs spirit/test/scriptClassify.js itself; it is no test here.
test.run('spirit/test/scriptClassify.js, the classifier, is listed as no test and handed no module', 0.2, function () {
  const listed = all().filter(function (e) { return e.test === 'spirit/test/scriptClassify.js' || e.file === 'spirit/test/scriptClassify.js'; });
  return (all().length > 0 && !listed.length) || 'listed: ' + short(listed);
}, test.limit.quick);

// THE TOOLS OF spirit/test/ (goal/G43.32, Q2): tools, not tests, and judged as no module; their own tests are listed.
// spirit/test/'s tools are not tests
const TOOLS = ['spirit/test/testReport.js', 'spirit/test/testModule.js', 'spirit/test/headLessChrome.js'];
test.run('the world: the three tools are in spirit/test/', 0.2, function () {
  return TOOLS.every(function (t) { return fs.existsSync(path.join(RUN, t)); }) || 'a tool is missing from spirit/test/: ' + short(TOOLS.filter(function (t) { return !fs.existsSync(path.join(RUN, t)); }));
}, test.limit.quick);
test.run('none of the three tools, testReport.js, testModule.js and headLessChrome.js, is listed as a test', 0.2, function () {
  const asTest = all().filter(function (e) { return TOOLS.indexOf(e.test) !== -1; });
  return (all().length > 0 && !asTest.length) || 'listed as tests: ' + short(asTest);
}, test.limit.quick);
test.run('and none is handed to a general test as a module', 0.2, function () {
  const asModule = all().filter(function (e) { return TOOLS.indexOf(e.file) !== -1; });
  return (all().length > 0 && !asModule.length) || 'judged as modules: ' + short(asModule);
}, test.limit.quick);
test.run('their own tests in spirit/test/test/ are listed', 0.2, function () {
  return (all().some(function (e) { return e.test === 'spirit/test/test/testModule.js'; }) && all().some(function (e) { return e.test === 'spirit/test/test/testReport.js'; })) ||
    'spirit/test/test/ is not listed: ' + short(all().filter(function (e) { return String(e.test).indexOf('spirit/test/test/') === 0; }));
}, test.limit.quick);
