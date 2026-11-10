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
ok(GENERAL.length === 4, 'the world: spirit/test/ holds the general rule tests ' + GENERAL.join(', '), 'the general rule tests found: ' + short(GENERAL));
ok(fs.existsSync(path.join(RUN, 'spirit', 'spirit.js')) && !fs.existsSync(path.join(RUN, 'spirit.js')),
  'the world: spirit.js, the module they are named after, is spirit/spirit.js, and none is at the run root', 'spirit.js is not where goal/G43.18 put it');
ok(fs.existsSync(path.join(RUN, MODULE)) && fs.existsSync(path.join(RUN, 'spirit', 'test', 'apiDoor.js')),
  'the world: ' + MODULE + ' is a product module with its own test, so it is opted in', MODULE + ' or its own test is missing: nothing judged');

test.subHeading('a module\'s blast radius');
const radius = testsFor(MODULE);
ok(radius.some(function (e) { return e.test === 'spirit/test/apiDoor.js'; }), 'the world: its blast radius holds its own test', 'its blast radius: ' + short(radius));
GENERAL.forEach(function (g) {
  const hit = radius.filter(function (e) { return e.test === g && e.file === MODULE; });
  ok(hit.length === 1, g + ' judges ' + MODULE + ' on its blast radius', g + ' is not given ' + MODULE + ' to judge; its entries: ' + short(radius.filter(function (e) { return e.test === g; })));
});

// ITS TESTS BY NAME (goal/G43.27; Andy: "every test must be directly (by name) or indirectly (by general rule) be associated
// with a production file"): ./test/<name>-<what>.js runs with ./<name>.js, and with every module below it, as its own test does.
test.subHeading('a module\'s tests by name');
// spirit/server.js and its test by name, server-garbage.js (apiDoor.js's, apiDoor-familyGate.js, went into
// spirit-branches.js in goal/G43.32, Q6).
const BY_NAME_OF = 'spirit/server.js';
const byNameRadius = testsFor(BY_NAME_OF);
const byName = byNameRadius.filter(function (e) { return e.test === 'spirit/test/server-garbage.js' && !e.file; });
ok(byName.length === 1, BY_NAME_OF + '\'s blast radius holds spirit/test/server-garbage.js, its test by name, once', 'its blast radius: ' + short(byNameRadius.map(function (e) { return e.test; })));
ok(!byNameRadius.some(function (e) { return /\/test\/serverX|\/test\/serve-/.test(e.test); }) && !testsFor('spirit/apiAuth.js').some(function (e) { return e.test === 'spirit/test/server-garbage.js'; }),
  'a test by name runs with its own module only: spirit/apiAuth.js does not get server-garbage.js', 'server-garbage.js runs with spirit/apiAuth.js too');
const below = testsFor('spirit/element/search/contact/detailElement.js').map(function (e) { return e.test; });
ok(below.indexOf('spirit/element/search/contact/test/detailElement-relayRowStream.js') !== -1 && below.indexOf('spirit/element/test/search-bubble.js') !== -1,
  'a module below runs its own tests by name and those of the module above it (search.js: search-bubble.js)', 'detailElement.js\'s blast radius: ' + short(below));

test.subHeading('the whole list');
const all = testsFor('');
ok(all.length > 0, 'the world: the whole list names ' + all.length + ' entries', 'the whole list is empty: nothing judged');
GENERAL.forEach(function (g) {
  const judged = all.filter(function (e) { return e.test === g && e.file; });
  ok(judged.some(function (e) { return e.file === MODULE; }), g + ' judges ' + judged.length + ' modules, ' + MODULE + ' among them',
    g + ' judges no module on the whole list; its entries: ' + short(all.filter(function (e) { return e.test === g; })));
});

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
  'the world: ' + branches.length + ' branch folders, read by both patterns, an app by its manifest since goal/G43.32 (spirit/app/test/ and spirit/test/ are none)', 'branchesOf: ' + short(branches) + ', the disc by both patterns: ' + short(onDisc));
const brAll = all.filter(function (e) { return e.test === BRANCH_RULES; }).map(function (e) { return e.file; });
ok(brAll.length === branches.length && brAll.slice().sort().join() === branches.slice().sort().join(), 'on the whole list it has one entry per branch folder, ' + brAll.length, 'its entries: ' + short(brAll));
const brDesk = testsFor('spirit/app/desk/desk.js').filter(function (e) { return e.test === BRANCH_RULES; }).map(function (e) { return e.file; });
ok(brDesk.join() === 'spirit/app/desk', 'on spirit/app/desk/desk.js\'s blast radius, the one branch holding it, spirit/app/desk, not spirit/app', 'its entries there: ' + short(brDesk));
const brNone = testsFor('spirit/apiAuth.js').filter(function (e) { return e.test === BRANCH_RULES; });
ok(!brNone.length, 'a module in no branch (spirit/apiAuth.js) gets no entry of it', 'spirit/apiAuth.js gets ' + short(brNone));

// THE TOOLS OF spirit/test/ (goal/G43.32, Q2): tools, not tests, and judged as no module; their own tests are listed.
test.subHeading('spirit/test/\'s tools are not tests');
const TOOLS = ['spirit/test/testReport.js', 'spirit/test/testModule.js', 'spirit/test/headLessChrome.js'];
ok(TOOLS.every(function (t) { return fs.existsSync(path.join(RUN, t)); }), 'the world: the three tools are in spirit/test/', 'a tool is missing from spirit/test/: ' + short(TOOLS.filter(function (t) { return !fs.existsSync(path.join(RUN, t)); })));
const asTest = all.filter(function (e) { return TOOLS.indexOf(e.test) !== -1; });
ok(all.length > 0 && !asTest.length, 'none of ' + TOOLS.join(', ') + ' is listed as a test', 'listed as tests: ' + short(asTest));
const asModule = all.filter(function (e) { return TOOLS.indexOf(e.file) !== -1; });
ok(all.length > 0 && !asModule.length, 'and none is handed to a general test as a module', 'judged as modules: ' + short(asModule));
ok(all.some(function (e) { return e.test === 'spirit/test/test/testModule.js'; }) && all.some(function (e) { return e.test === 'spirit/test/test/testReport.js'; }),
  'their own tests in spirit/test/test/ are listed', 'spirit/test/test/ is not listed: ' + short(all.filter(function (e) { return /^spirit\/test\/test\//.test(e.test); })));

test.reportSuccessFailureCount();
process.exit(0);
