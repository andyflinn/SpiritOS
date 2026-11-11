'use strict';

// spirit/run/spirit/app/agent/test/api.js
// The tests of spirit/app/agent/api.js, and of no other module (spec: ./api.md): the agent's family at the app's top, one
// <verb>.json beside it for each verb, and no file naming the folder it left (goal/G43.27, requirements 1, 3 and 4). Andy:
// "spirit/app/<name>/ folders are now ALMOST the same shape as spirit/jobs/ and other system api-branches, EXCEPT, api.js
// sits in a folder ./api.js", "i think the shape needs alignment.". The tree read as it is, comments stripped.
// One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
// The tree before the move: the commit the red was written on, which holds the agent's api.js one folder down.
const BASE = '8baa09c3';
const SELF = /spirit\/app\/agent\/test\/api\.(js|md)$/;

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
// Line ends aside: a Windows checkout (autocrlf) holds CRLF where git holds LF.
function read(rel) { const f = path.join(RUN, rel); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : ''; }

const VERBS = ['provider', 'model', 'persona', 'job'];
// What the tests make, for the tests after them.
const X = { tracked: null, verbs: [] };
const NO_TREE = 'no tracked files read: the world failed';

// ── the world ──
test.run('the world: before the move, the agent\'s api.js one folder down declares provider, model, persona and job', 0.2, function () {
  const was = execSync('git show ' + BASE + ':spirit/run/spirit/app/agent/api/api.js', { cwd: REPO, encoding: 'utf8' });
  return VERBS.every(function (v) { return new RegExp('\\n\\s+' + v + ':').test(was); }) ? true : 'the agent\'s api.js at ' + BASE + ' is not as read: nothing to compare with';
}, test.limit.quick);
test.run('the world: the tracked files on disk are read', 0.2, function () {
  X.tracked = execSync('git ls-files', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean).filter(function (f) { return fs.existsSync(path.join(REPO, f)); });
  return X.tracked.length > 100 ? true : 'only ' + X.tracked.length + ' tracked files read: nothing judged';
}, test.limit.quick);

// ── 1. the agent's family at the app's top ──
const top = path.join(RUN, 'spirit', 'app', 'agent', 'api.js');
// The four tables' verbs, and the publisher's subscribe and unsubscribe (goal/G43.32; Andy: "for now, it needs to declare
// them in api.js").
const NOW = VERBS.concat(['subscribe', 'unsubscribe']);
test.run('spirit/app/agent/api.js is there, in git, with provider, model, persona and job, subscribe and unsubscribe', 0.2, function () {
  if (!X.tracked) return NO_TREE;
  try { delete require.cache[top]; X.verbs = Object.keys(require(top).verbs || {}); } catch (e) { X.verbs = []; }
  return X.tracked.indexOf('spirit/run/spirit/app/agent/api.js') !== -1 && JSON.stringify(X.verbs) === JSON.stringify(NOW)
    ? true : 'spirit/app/agent/api.js: in git ' + (X.tracked.indexOf('spirit/run/spirit/app/agent/api.js') !== -1) + ', verbs ' + short(X.verbs);
}, test.limit.quick);
test.run('spirit/app/agent/api/ is gone', 0.2, function () {
  return !fs.existsSync(path.join(RUN, 'spirit', 'app', 'agent', 'api')) ? true : 'spirit/app/agent/api/ is still there';
}, test.limit.quick);
test.run('no app keeps an ./api/ folder', 0.2, function () {
  if (!X.tracked) return NO_TREE;
  const sub = X.tracked.filter(function (f) { return (/^spirit\/run\/spirit\/app\/[^/]+\/api\//).test(f); });
  return !sub.length ? true : sub.length + ' files still sit in one: ' + short(sub);
}, test.limit.quick);

// ── 3. one <verb>.json for each of the agent's verbs, as spirit/job/ has ──
test.run('the world: spirit/job/get.json is the shape', 0.2, function () {
  return fs.existsSync(path.join(RUN, 'spirit', 'job', 'get.json')) ? true : 'no spirit/job/get.json to compare with';
}, test.limit.quick);
// One check per verb, each its own plain title (goal/G45.6).
function verbJson(v) { let d = null; try { d = JSON.parse(read('spirit/app/agent/' + v + '.json')); } catch (e) { d = null; } return d; }
function describes(d) { return !!d && typeof d.description === 'string' && d.description.trim().length > 0; }
function whyNot(v) { const d = verbJson(v); return 'spirit/app/agent/' + v + '.json: ' + (d ? 'no description' : 'not there, or no json'); }
test.run('provider.json describes the provider verb', 0.2, function () { return describes(verbJson('provider')) ? true : whyNot('provider'); }, test.limit.quick);
test.run('model.json describes the model verb', 0.2, function () { return describes(verbJson('model')) ? true : whyNot('model'); }, test.limit.quick);
test.run('persona.json describes the persona verb', 0.2, function () { return describes(verbJson('persona')) ? true : whyNot('persona'); }, test.limit.quick);
test.run('job.json describes the job verb', 0.2, function () { return describes(verbJson('job')) ? true : whyNot('job'); }, test.limit.quick);

// ── 4. no file names spirit/app/agent/api/ ──
test.run('no file names spirit/app/agent/api/', 0.2, function () {
  if (!X.tracked) return NO_TREE;
  const naming = X.tracked.filter(function (f) { return !SELF.test(f) && /\.(js|md|json|html|txt)$/.test(f); })
    .filter(function (f) { return (/spirit\/app\/agent\/api\/|app\/agent\/api\b(?!\.js)|'agent', 'api'/).test(fs.readFileSync(path.join(REPO, f), 'utf8')); });
  return !naming.length ? true : naming.length + ' still do: ' + short(naming);
}, test.limit.quick);
