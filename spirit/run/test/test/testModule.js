'use strict';

// spirit/run/test/test/testModule.js
// THE GENERAL RULES JUDGE THE PRODUCT MODULES (goal/G43.23, item 4; spec: ./testModule.md). The box: "the general rules
// judge no module: testModule.js looks for ./spirit.js."
//
// testsFor() of ../testModule.js, on this tree as it stands, read only: the general rule tests of the run root's test
// folder (spirit-<child|sibling>-<x>Rules.js, named after spirit.js, which is at spirit/spirit.js since goal/G43.18) are
// handed a module under spirit/run/spirit/ as the file they judge, on the module's blast radius and on the whole list.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { testsFor } = require(path.join(RUN, 'test', 'testModule.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }

// The general rule tests at the run root's test folder.
const GENERAL = fs.readdirSync(path.join(RUN, 'test')).filter(function (n) { return /^spirit-(child|sibling)-\w+Rules\.js$/.test(n); })
  .map(function (n) { return 'test/' + n; }).sort();
// The module judged: an opted-in product module under spirit/run/spirit/ (it has its own spirit/test/<name>.js).
const MODULE = 'spirit/apiDoor.js';

test.startTest('test/testModule.js: testsFor() gives a module under spirit/run/spirit/ the general rules that judge it (goal/G43.23 item 4)');

test.subHeading('the world');
ok(GENERAL.length === 4, 'the world: the run root holds the general rule tests ' + GENERAL.join(', '), 'the general rule tests found: ' + short(GENERAL));
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
const byName = radius.filter(function (e) { return e.test === 'spirit/test/apiDoor-familyGate.js' && !e.file; });
ok(byName.length === 1, MODULE + '\'s blast radius holds spirit/test/apiDoor-familyGate.js, its test by name, once', 'its blast radius: ' + short(radius.map(function (e) { return e.test; })));
ok(!radius.some(function (e) { return /\/test\/apiDoorX|\/test\/apiDoo-/.test(e.test); }) && !testsFor('spirit/apiAuth.js').some(function (e) { return e.test === 'spirit/test/apiDoor-familyGate.js'; }),
  'a test by name runs with its own module only: spirit/apiAuth.js does not get apiDoor-familyGate.js', 'apiDoor-familyGate.js runs with spirit/apiAuth.js too');
const below = testsFor('spirit/element/search/contact/relayPanel.js').map(function (e) { return e.test; });
ok(below.indexOf('spirit/element/search/contact/test/relayPanel-rowStream.js') !== -1 && below.indexOf('spirit/element/test/search-bubble.js') !== -1,
  'a module below runs its own tests by name and those of the module above it (search.js: search-bubble.js)', 'relayPanel.js\'s blast radius: ' + short(below));

test.subHeading('the whole list');
const all = testsFor('');
ok(all.length > 0, 'the world: the whole list names ' + all.length + ' entries', 'the whole list is empty: nothing judged');
GENERAL.forEach(function (g) {
  const judged = all.filter(function (e) { return e.test === g && e.file; });
  ok(judged.some(function (e) { return e.file === MODULE; }), g + ' judges ' + judged.length + ' modules, ' + MODULE + ' among them',
    g + ' judges no module on the whole list; its entries: ' + short(all.filter(function (e) { return e.test === g; })));
});

test.reportSuccessFailureCount();
process.exit(0);
