'use strict';

// spirit/run/spirit/test/nodeSettings.js
// The tests of spirit/nodeSettings.js, and of no other module (spec: ./nodeSettings.md). Its own test, owed since the
// rule "every production script has its own test" (goal/G47.1, box v72).
//
// What the owner has decided about their own node: spirit/state/node.json, read once at startup and never written by
// the node. Each test writes node.json into a scratch home of its own.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const S = require(path.join(RUN, 'spirit', 'nodeSettings.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// A scratch home, holding node.json with the text given (or none).
function home(text) {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-nodesettings-'));
  if (text !== undefined) { fs.mkdirSync(path.join(h, 'spirit', 'state'), { recursive: true }); fs.writeFileSync(path.join(h, 'spirit', 'state', 'node.json'), text); }
  return h;
}
const MB = 1024 * 1024;

test.run('the file is spirit/state/node.json under the home', 0.2, function () {
  return S.filePath('/x') === path.join('/x', 'spirit', 'state', 'node.json') || 'filePath: ' + S.filePath('/x');
}, test.limit.quick);
test.run('the shipped default is Andy\'s 20 MB, and the floor 1 MB', 0.2, function () {
  return (S.DEFAULT_CACHE_MAX_MB === 20 && S.MIN_CACHE_MAX_MB === 1) || 'default ' + S.DEFAULT_CACHE_MAX_MB + ', floor ' + S.MIN_CACHE_MAX_MB;
}, test.limit.quick);
test.run('no node.json: the defaults, no problem, and no file grown saying so', 0.2, function () {
  const h = home();
  const s = S.load(h);
  return (s.cacheMaxMB === 20 && s.problems.length === 0 && !fs.existsSync(S.filePath(h))) || 'settings ' + short(s) + ', file ' + fs.existsSync(S.filePath(h));
}, test.limit.quick);
test.run('the owner\'s number is obeyed, in megabytes', 0.2, function () {
  const h = home('{ "cacheMaxMB": 7 }');
  const s = S.load(h);
  return (s.cacheMaxMB === 7 && s.problems.length === 0 && S.cacheMaxBytes(h) === 7 * MB) || 'settings ' + short(s) + ', bytes ' + S.cacheMaxBytes(h);
}, test.limit.quick);
test.run('a number below the floor is raised to it, and said', 0.2, function () {
  const s = S.load(home('{ "cacheMaxMB": 0.01 }'));
  return (s.cacheMaxMB === 1 && s.problems.length === 1 && /below the floor/.test(s.problems[0])) || 'settings ' + short(s);
}, test.limit.quick);
test.run('zero, a negative or no number: the default, and said', 0.2, function () {
  const got = ['0', '-5', '"lots"'].map(function (v) { return S.load(home('{ "cacheMaxMB": ' + v + ' }')); });
  return got.every(function (s) { return s.cacheMaxMB === 20 && s.problems.length === 1 && /positive number/.test(s.problems[0]); }) || 'settings ' + short(got);
}, test.limit.quick);
test.run('a node.json that is not JSON: the defaults, and said', 0.2, function () {
  const s = S.load(home('{ cacheMaxMB: 7'));
  return (s.cacheMaxMB === 20 && s.problems.length === 1 && /not valid JSON/.test(s.problems[0])) || 'settings ' + short(s);
}, test.limit.quick);
test.run('a field it does not read (searchMemoryRows, gone with goal/G40.11) is no problem', 0.2, function () {
  const s = S.load(home('{ "searchMemoryRows": 500, "cacheMaxMB": 3 }'));
  return (s.cacheMaxMB === 3 && s.problems.length === 0) || 'settings ' + short(s);
}, test.limit.quick);
test.run('read once per home: a change to node.json after the first read is not seen', 0.2, function () {
  const h = home('{ "cacheMaxMB": 4 }');
  S.load(h);
  fs.writeFileSync(S.filePath(h), '{ "cacheMaxMB": 9 }');
  return (S.load(h).cacheMaxMB === 4 && S.cacheMaxBytes(h) === 4 * MB) || 'read again: ' + short(S.load(h));
}, test.limit.quick);
test.run('two homes in one process do not see each other\'s settings', 0.2, function () {
  const a = home('{ "cacheMaxMB": 2 }'), b = home('{ "cacheMaxMB": 5 }');
  return (S.load(a).cacheMaxMB === 2 && S.load(b).cacheMaxMB === 5) || 'a ' + short(S.load(a)) + ', b ' + short(S.load(b));
}, test.limit.quick);
test.run('the node never writes node.json: the owner\'s text is left byte for byte', 0.2, function () {
  const text = '{ "cacheMaxMB": 0.5 }\n';
  const h = home(text);
  S.load(h); S.cacheMaxBytes(h);
  return fs.readFileSync(S.filePath(h), 'utf8') === text || 'node.json now: ' + short(fs.readFileSync(S.filePath(h), 'utf8'));
}, test.limit.quick);
