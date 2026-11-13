'use strict';

// spirit/run/spirit/app/backup/test/api.js
// The tests of spirit/app/backup/api.js, and of no other module (spec: ./api.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// The backup server's family interface (goal/G32.3), where spirit.familyPath('backup') finds it (goal/G41.12): one verb,
// status.get, taking nothing. Required as the node reads it; the verb is checked by spirit.js's own check (spirit.check).
// The server's source (backup.js) is read as text only, to find the handler. One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'api.js');
require(path.join(RUN, 'spirit', 'spirit.js'));
const spirit = globalThis.spirit;

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const isPlain = function (v) { return v !== null && typeof v === 'object' && !Array.isArray(v); };

const W = { api: null, verbs: {}, names: [] };
const refusedAs = function (verb, args) { if (!W.verbs[verb]) return 'no verb ' + verb; const r = spirit.check('backup.' + verb, W.verbs[verb], args); return r ? r.code : ''; };
const NO_API = 'api.js did not load: the world failed';

test.run('the world: api.js loads', 0.2, function () {
  try { W.api = require(FILE); } catch (e) { return 'api.js threw: ' + short(e && e.message); }
  W.verbs = W.api.verbs || {};
  W.names = Object.keys(W.verbs);
  return true;
}, test.limit.quick);
test.run('spirit.familyPath(\'backup\') finds it here', 0.2, function () {
  return path.join(RUN, spirit.familyPath('backup')) === FILE || 'familyPath(backup) is ' + short(spirit.familyPath('backup'));
}, test.limit.quick);
// "The node answers this text to api {family} without the server hearing of it, and maps it to its name: it names no family of its own."
test.run('it exports a table of verbs and nothing else: it names no family of its own', 0.2, function () {
  if (!W.api) return NO_API;
  return (Object.keys(W.api).join() === 'verbs' && isPlain(W.verbs)) || 'exports ' + short(Object.keys(W.api));
}, test.limit.quick);
test.run('its one verb is status.get', 0.2, function () {
  if (!W.api) return NO_API;
  return W.names.join() === 'status.get' || 'verbs ' + short(W.names);
}, test.limit.quick);
// "A verb added to the server is added here, in the same commit."
test.run('each verb it lists is a handler of backup.js, and backup.js serves no verb it does not list', 0.2, function () {
  if (!W.api) return NO_API;
  const src = fs.readFileSync(path.join(RUN, 'spirit', 'app', 'backup', 'backup.js'), 'utf8');
  const at = src.indexOf('appServer.serve(');
  if (at === -1) return 'backup.js serves nothing: nothing to compare with';
  const served = []; const re = /\n {2}'?([a-zA-Z.]+)'?:\s*\{\s*\n\s*request:/g; let m;
  const block = src.slice(at);
  while ((m = re.exec(block))) served.push(m[1]);
  return served.length > 0 && served.slice().sort().join() === W.names.slice().sort().join() ? true : 'served ' + short(served) + ', listed ' + short(W.names);
}, test.limit.quick);
// "The last check, copy and error; it takes nothing."
test.run('status.get takes nothing: {} passes, any argument is refused before it leaves', 0.2, function () {
  if (!W.api) return NO_API;
  return (refusedAs('status.get', {}) === '' && refusedAs('status.get', { since: 1 }) === 'no-such-argument') || 'status.get {} ' + refusedAs('status.get', {}) + ', {since} ' + refusedAs('status.get', { since: 1 });
}, test.limit.quick);
