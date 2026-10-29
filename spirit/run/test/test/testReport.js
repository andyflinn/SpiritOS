'use strict';

// spirit/run/test/test/testReport.js
// The tests of test/testReport.js, and of no other module (spec: ./testReport.md; goal/G41.19): the name a test is sent
// to the verifier by. Each case runs a child as if it were the test file named, under a stand-in spirit.js whose
// deskVerify.record prints what it was given.

const path = require('path');
const { spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const REPORTER = path.join(RUN, 'test', 'testReport.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }

// What the reporter sends when run as <file> (relative to spirit/run), with the arguments given: the records, or [].
function sent(file, args, verify) {
  const child = [
    'const path = require("path");',
    'const spiritJs = path.join(' + JSON.stringify(RUN) + ', "spirit.js");',
    'require.cache[spiritJs] = { id: spiritJs, filename: spiritJs, loaded: true, exports: {',
    '  familyPath: function (n) { return n; },',
    '  require: function () { return Promise.resolve({ record: function (r) { console.log("REC " + JSON.stringify(r)); } }); },',
    '} };',
    'process.argv = [process.argv[0], ' + JSON.stringify(path.join(RUN, file)) + '].concat(' + JSON.stringify(args.concat(verify ? ['--verify-port', '45999'] : [])) + ');',
    'const t = require(' + JSON.stringify(REPORTER) + ');',
    't.startTest("a case"); t.check("one green"); t.fail("one red", "why");',
  ].join('\n');
  const r = spawnSync(process.execPath, ['-e', child], { encoding: 'utf8', timeout: 20000 });
  return String(r.stdout || '').split('\n').filter(function (l) { return l.indexOf('REC ') === 0; }).map(function (l) {
    try { return JSON.parse(l.slice(4)); } catch (e) { return null; }
  }).filter(Boolean);
}
function suitesOf(recs) { return recs.map(function (r) { return r.suite; }).filter(function (s, i, a) { return a.indexOf(s) === i; }); }
function short(x) { return JSON.stringify(x).slice(0, 300); }

test.startTest('test/testReport.js: a test is sent by the module it tests, /<path>/<module>');

test.subHeading('a test of a module');
const CASES = [
  ['shell/js/test/workBench.js', '/shell/js/workBench'],
  ['process/js/agent/table/model/test/rowElement.js', '/process/js/agent/table/model/rowElement'],
  ['process/js/agent/table/provider/test/rowElement.js', '/process/js/agent/table/provider/rowElement'],
  ['spirit/test/DEBUG.js', '/spirit/DEBUG'],
  ['test/spirit.js', '/spirit'],
];
CASES.forEach(function (c) {
  const recs = sent(c[0], [], true);
  const names = suitesOf(recs);
  ok(recs.length && names.length === 1 && names[0] === c[1], c[0] + ' is sent as ' + c[1], c[0] + ' was sent as ' + short(names) + (recs.length ? '' : ' (nothing sent)'));
});
const twins = CASES.slice(1, 3).map(function (c) { return suitesOf(sent(c[0], [], true))[0]; });
ok(twins[0] && twins[1] && twins[0] !== twins[1], 'two test files of one name, rowElement.js, are two names', 'both rowElement.js tests went by ' + short(twins));

test.subHeading('a general test, by the file it judges');
const general = suitesOf(sent('shell/test/boot-sibling-generalRules.js', ['shell/agent/agent.js'], true));
ok(general.length === 1 && general[0] === '/shell/agent/agent', 'boot-sibling-generalRules.js judging shell/agent/agent.js is sent as /shell/agent/agent', 'it was sent as ' + short(general));

test.subHeading('the rest of a record as before');
const recs = sent('shell/js/test/workBench.js', [], true);
const green = recs.filter(function (r) { return r.outcome === 'green'; })[0];
const red = recs.filter(function (r) { return r.outcome === 'red'; })[0];
// EVERY TEST NAME STARTS WITH THE PATH (Andy, box v13: "EVERY MOTHERFUCKING TEST NAME in the product three STARTS WITH
// THE MUTHERCUCKING PATH!!!!!!!!!!"): the title is "/<path>/<module> <section> #<n>", so a title read alone names its
// module.
ok(green && green.title === '/shell/js/workBench a case #1', 'a green\'s title starts with its path: "/<path>/<module> <section> #<n>"', 'the green record: ' + short(green));
ok(red && red.title === '/shell/js/workBench a case #2' && /one red/.test(String(red.failure)), 'a red\'s title starts with its path, and it carries its failure', 'the red record: ' + short(red));
const twinTitles = CASES.slice(1, 3).map(function (c) { return (sent(c[0], [], true)[0] || {}).title; });
ok(twinTitles[0] && twinTitles[1] && twinTitles[0] !== twinTitles[1] && twinTitles.every(function (t, i) { return t.indexOf(CASES[i + 1][1] + ' ') === 0; }),
  'the titles of the two rowElement.js tests start with their own paths', 'their titles: ' + short(twinTitles));
ok(!sent('shell/js/test/workBench.js', [], false).length, 'nothing is sent when the verifier did not start the run', 'a record was sent with no --verify-port');

test.reportSuccessFailureCount();
