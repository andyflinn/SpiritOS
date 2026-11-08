'use strict';

// spirit/run/spirit/app/agent/test/api.js
// The tests of spirit/app/agent/api.js, and of no other module (spec: ./api.md): the agent's family at the app's top, one
// <verb>.json beside it for each verb, and no file naming the folder it left (goal/G43.27, requirements 1, 3 and 4). Andy:
// "spirit/app/<name>/ folders are now ALMOST the same shape as spirit/jobs/ and other system api-branches, EXCEPT, api.js
// sits in a folder ./api.js", "i think the shape needs alignment.". The tree read as it is, comments stripped.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
// The tree before the move: the commit the red was written on, which holds the agent's api.js one folder down.
const BASE = '8baa09c3';
const SELF = /spirit\/app\/agent\/test\/api\.(js|md)$/;

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
// Line ends aside: a Windows checkout (autocrlf) holds CRLF where git holds LF.
function read(rel) { const f = path.join(RUN, rel); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : ''; }

test.startTest('api.js: the agent\'s family at the app\'s top, a <verb>.json for each verb (goal/G43.27)');

test.subHeading('the world');
const was = execSync('git show ' + BASE + ':spirit/run/spirit/app/agent/api/api.js', { cwd: REPO, encoding: 'utf8' });
const VERBS = ['provider', 'model', 'persona', 'job'];
ok(VERBS.every(function (v) { return new RegExp('\\n\\s+' + v + ':').test(was); }), 'the world: at ' + BASE + ' the agent\'s api.js one folder down declares provider, model, persona and job', 'the agent\'s api.js at ' + BASE + ' is not as read: nothing to compare with');
const tracked = execSync('git ls-files', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean).filter(function (f) { return fs.existsSync(path.join(REPO, f)); });
ok(tracked.length > 100, 'the world: ' + tracked.length + ' tracked files on disk are read', 'only ' + tracked.length + ' tracked files read: nothing judged');

test.subHeading('1. the agent\'s family at the app\'s top');
const top = path.join(RUN, 'spirit', 'app', 'agent', 'api.js');
let verbs = [];
try { delete require.cache[top]; verbs = Object.keys(require(top).verbs || {}); } catch (e) { verbs = []; }
ok(tracked.indexOf('spirit/run/spirit/app/agent/api.js') !== -1 && JSON.stringify(verbs) === JSON.stringify(VERBS), 'spirit/app/agent/api.js is there, in git, with provider, model, persona and job', 'spirit/app/agent/api.js: in git ' + (tracked.indexOf('spirit/run/spirit/app/agent/api.js') !== -1) + ', verbs ' + short(verbs));
ok(!fs.existsSync(path.join(RUN, 'spirit', 'app', 'agent', 'api')), 'spirit/app/agent/api/ is gone', 'spirit/app/agent/api/ is still there');
const sub = tracked.filter(function (f) { return /^spirit\/run\/spirit\/app\/[^/]+\/api\//.test(f); });
ok(!sub.length, 'no app keeps an ./api/ folder', sub.length + ' files still sit in one: ' + short(sub));

test.subHeading('3. one <verb>.json for each of the agent\'s verbs, as spirit/jobs/ has');
ok(fs.existsSync(path.join(RUN, 'spirit', 'jobs', 'get.json')), 'the world: spirit/jobs/get.json is the shape', 'no spirit/jobs/get.json to compare with');
VERBS.forEach(function (v) {
  let d = null;
  try { d = JSON.parse(read('spirit/app/agent/' + v + '.json')); } catch (e) { d = null; }
  ok(!!d && typeof d.description === 'string' && d.description.trim().length > 0, 'spirit/app/agent/' + v + '.json describes ' + v, 'spirit/app/agent/' + v + '.json: ' + (d ? 'no description' : 'not there, or no json'));
});

test.subHeading('4. no file names spirit/app/agent/api/');
const naming = tracked.filter(function (f) { return !SELF.test(f) && f.indexOf('spirit/run/spirit/app/desk/currentGoal.json') !== 0 && /\.(js|md|json|html|txt)$/.test(f); })
  .filter(function (f) { return /spirit\/app\/agent\/api\/|app\/agent\/api\b(?!\.js)|'agent', 'api'/.test(fs.readFileSync(path.join(REPO, f), 'utf8')); });
ok(!naming.length, 'no file names spirit/app/agent/api/', naming.length + ' still do: ' + short(naming));

test.reportSuccessFailureCount();
process.exit(0);
