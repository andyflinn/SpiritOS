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

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }

// The general rule tests in spirit/test/, beside spirit/spirit.js (goal/G43.32).
// The branch rules (spirit-sibling-branchRules.js) judge branch folders, not modules: judged below, apart.
const GENERAL = fs.readdirSync(path.join(RUN, 'spirit', 'test')).filter(function (n) { return /^spirit-(child|sibling)-\w+Rules\.js$/.test(n) && n !== 'spirit-sibling-branchRules.js'; })
  .map(function (n) { return 'spirit/test/' + n; }).sort();
const BRANCH_RULES = 'spirit/test/spirit-sibling-branchRules.js';
// The module judged: an opted-in product module under spirit/run/spirit/ (it has its own spirit/test/<name>.js).
const MODULE = 'spirit/apiDoor.js';

test.startTest('spirit/test/testModule.js: testsFor() gives a module under spirit/run/spirit/ the general rules that judge it (goal/G43.23 item 4)');

test.subHeading('the world');
ok(GENERAL.length === 4, 'the world: spirit/test/ holds four general rule tests', 'the general rule tests found: ' + short(GENERAL));
ok(fs.existsSync(path.join(RUN, 'spirit', 'spirit.js')) && !fs.existsSync(path.join(RUN, 'spirit.js')),
  'the world: spirit.js, the module they are named after, is spirit/spirit.js, and none is at the run root', 'spirit.js is not where goal/G43.18 put it');
ok(fs.existsSync(path.join(RUN, MODULE)) && fs.existsSync(path.join(RUN, 'spirit', 'test', 'apiDoor.js')),
  'the world: spirit/apiDoor.js is a product module with its own test, so it is opted in', MODULE + ' or its own test is missing: nothing judged');

test.subHeading('a module\'s blast radius');
const radius = testsFor(MODULE);
ok(radius.some(function (e) { return e.test === 'spirit/test/apiDoor.js'; }), 'the world: its blast radius holds its own test', 'its blast radius: ' + short(radius));
// Each general rule test written out, so that each check has a plain title of its own.
const onRadius = function (g) {
  const hit = radius.filter(function (e) { return e.test === g && e.file === MODULE; });
  return { fine: hit.length === 1, why: g + ' is not given ' + MODULE + ' to judge; its entries: ' + short(radius.filter(function (e) { return e.test === g; })) };
};
let rr;
rr = onRadius('spirit/test/spirit-child-generalRules.js'); ok(rr.fine, 'spirit/test/spirit-child-generalRules.js judges spirit/apiDoor.js on its blast radius', rr.why);
rr = onRadius('spirit/test/spirit-sibling-generalRules.js'); ok(rr.fine, 'spirit/test/spirit-sibling-generalRules.js judges spirit/apiDoor.js on its blast radius', rr.why);
rr = onRadius('spirit/test/spirit-sibling-searchRules.js'); ok(rr.fine, 'spirit/test/spirit-sibling-searchRules.js judges spirit/apiDoor.js on its blast radius', rr.why);
rr = onRadius('spirit/test/spirit-sibling-testReachRules.js'); ok(rr.fine, 'spirit/test/spirit-sibling-testReachRules.js judges spirit/apiDoor.js on its blast radius', rr.why);
rr = onRadius('spirit/test/spirit-sibling-titleRules.js'); ok(rr.fine, 'spirit/test/spirit-sibling-titleRules.js judges spirit/apiDoor.js on its blast radius', rr.why);

// ONE TEST FILE PER SCRIPT (goal/G45.1; spirit/run/spirit/test/TEST_SYSTEM.md; Andy: "there is ONE FUCKING test file in the
// test folder per script file, and every fucking test that applies to that file must be inserted in the that one file"):
// testsFor reads ./test/<name>.js for a script, and never a ./test/<name>-<what>.js. Judged on a planted tree of its own.
test.subHeading('one test file per script: no <name>-<what>.js is read');
{
  const planted = require('fs').mkdtempSync(path.join(require('os').tmpdir(), 'spirit-onefile-'));
  const put = function (rel, text) { const f = path.join(planted, rel); require('fs').mkdirSync(path.dirname(f), { recursive: true }); require('fs').writeFileSync(f, text || '\n'); };
  put('spirit/zz.js'); put('spirit/test/zz.js'); put('spirit/test/zz-extra.js'); put('spirit/zz/part.js'); put('spirit/zz/test/part.js'); put('spirit/zz/test/part-more.js');
  const zz = testsFor('spirit/zz.js', { root: planted }).map(function (e) { return e.test; });
  const part = testsFor('spirit/zz/part.js', { root: planted }).map(function (e) { return e.test; });
  ok(zz.indexOf('spirit/test/zz.js') !== -1 && part.indexOf('spirit/zz/test/part.js') !== -1 && part.indexOf('spirit/test/zz.js') !== -1,
    'the world: a script\'s one test file runs with it, and with the scripts below it', 'zz: ' + short(zz) + ', part: ' + short(part));
  ok(zz.indexOf('spirit/test/zz-extra.js') === -1 && part.indexOf('spirit/test/zz-extra.js') === -1 && part.indexOf('spirit/zz/test/part-more.js') === -1,
    'no <name>-<what>.js is read, on its own script or below it', 'read: ' + short(zz.concat(part).filter(function (t) { return /-(extra|more)\.js$/.test(t); })));
  try { require('fs').rmSync(planted, { recursive: true, force: true }); } catch (e) { /* scratch */ }
}

test.subHeading('the whole list');
const all = testsFor('');
ok(all.length > 0, 'the world: the whole list names entries', 'the whole list is empty: nothing judged');
const onWhole = function (g) {
  const judged = all.filter(function (e) { return e.test === g && e.file; });
  return { fine: judged.some(function (e) { return e.file === MODULE; }), why: g + ' judges no module on the whole list; its entries: ' + short(all.filter(function (e) { return e.test === g; })) };
};
let rw;
rw = onWhole('spirit/test/spirit-child-generalRules.js'); ok(rw.fine, 'spirit/test/spirit-child-generalRules.js judges modules on the whole list, spirit/apiDoor.js among them', rw.why);
rw = onWhole('spirit/test/spirit-sibling-generalRules.js'); ok(rw.fine, 'spirit/test/spirit-sibling-generalRules.js judges modules on the whole list, spirit/apiDoor.js among them', rw.why);
rw = onWhole('spirit/test/spirit-sibling-searchRules.js'); ok(rw.fine, 'spirit/test/spirit-sibling-searchRules.js judges modules on the whole list, spirit/apiDoor.js among them', rw.why);
rw = onWhole('spirit/test/spirit-sibling-testReachRules.js'); ok(rw.fine, 'spirit/test/spirit-sibling-testReachRules.js judges modules on the whole list, spirit/apiDoor.js among them', rw.why);
rw = onWhole('spirit/test/spirit-sibling-titleRules.js'); ok(rw.fine, 'spirit/test/spirit-sibling-titleRules.js judges modules on the whole list, spirit/apiDoor.js among them', rw.why);

// THE BRANCH RULES JUDGE EACH BRANCH FOLDER ONCE (goal/G43.32; Andy: "app-branches are easily identified using the
// patterns: spirit/app/<name>/<name>.js, spirit/app/<name>/<name>.json", "and system branches by: spirit.<name>.api.js &&
// spirit.<name>.data.js", to Q7: "branch test only needs to associate a failure with either spirit/<name>/ or
// spirit/app/<name>/").
test.subHeading('the branch rules: one entry per branch folder');
const { branchesOf } = require(path.join(RUN, 'spirit', 'test', 'testModule.js'));
const branches = branchesOf(RUN).map(function (b) { return b.dir; });
const onDisc = [];
fs.readdirSync(path.join(RUN, 'spirit'), { withFileTypes: true }).forEach(function (d) { if (d.isDirectory() && fs.existsSync(path.join(RUN, 'spirit', d.name, 'api.js')) && fs.existsSync(path.join(RUN, 'spirit', d.name, 'data.js'))) onDisc.push('spirit/' + d.name); });
fs.readdirSync(path.join(RUN, 'spirit', 'app'), { withFileTypes: true }).forEach(function (d) { if (d.isDirectory() && fs.existsSync(path.join(RUN, 'spirit', 'app', d.name, d.name + '.json'))) onDisc.push('spirit/app/' + d.name); });
ok(fs.existsSync(path.join(RUN, BRANCH_RULES)) && branches.length >= 20 && branches.slice().sort().join() === onDisc.sort().join() && branches.indexOf('spirit/app/test') === -1 && branches.indexOf('spirit/test') === -1,
  'the world: twenty or more branch folders, read by both patterns, an app by its manifest since goal/G43.32 (spirit/app/test/ and spirit/test/ are none)', 'branchesOf: ' + short(branches) + ', the disc by both patterns: ' + short(onDisc));
const brAll = all.filter(function (e) { return e.test === BRANCH_RULES; }).map(function (e) { return e.file; });
ok(brAll.length === branches.length && brAll.slice().sort().join() === branches.slice().sort().join(), 'on the whole list it has one entry per branch folder', 'its entries: ' + short(brAll));
const brDesk = testsFor('spirit/app/desk/desk.js').filter(function (e) { return e.test === BRANCH_RULES; }).map(function (e) { return e.file; });
ok(brDesk.join() === 'spirit/app/desk', 'on spirit/app/desk/desk.js\'s blast radius, the one branch holding it, spirit/app/desk, not spirit/app', 'its entries there: ' + short(brDesk));
const brNone = testsFor('spirit/apiAuth.js').filter(function (e) { return e.test === BRANCH_RULES; });
ok(!brNone.length, 'a module in no branch (spirit/apiAuth.js) gets no entry of it', 'spirit/apiAuth.js gets ' + short(brNone));

// THE TOOLS OF spirit/test/ (goal/G43.32, Q2): tools, not tests, and judged as no module; their own tests are listed.
test.subHeading('spirit/test/\'s tools are not tests');
const TOOLS = ['spirit/test/testReport.js', 'spirit/test/testModule.js', 'spirit/test/headLessChrome.js'];
ok(TOOLS.every(function (t) { return fs.existsSync(path.join(RUN, t)); }), 'the world: the three tools are in spirit/test/', 'a tool is missing from spirit/test/: ' + short(TOOLS.filter(function (t) { return !fs.existsSync(path.join(RUN, t)); })));
const asTest = all.filter(function (e) { return TOOLS.indexOf(e.test) !== -1; });
ok(all.length > 0 && !asTest.length, 'none of the three tools, testReport.js, testModule.js and headLessChrome.js, is listed as a test', 'listed as tests: ' + short(asTest));
const asModule = all.filter(function (e) { return TOOLS.indexOf(e.file) !== -1; });
ok(all.length > 0 && !asModule.length, 'and none is handed to a general test as a module', 'judged as modules: ' + short(asModule));
ok(all.some(function (e) { return e.test === 'spirit/test/test/testModule.js'; }) && all.some(function (e) { return e.test === 'spirit/test/test/testReport.js'; }),
  'their own tests in spirit/test/test/ are listed', 'spirit/test/test/ is not listed: ' + short(all.filter(function (e) { return /^spirit\/test\/test\//.test(e.test); })));

test.reportSuccessFailureCount();
process.exit(0);
