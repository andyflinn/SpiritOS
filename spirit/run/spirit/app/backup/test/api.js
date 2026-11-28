'use strict';

// spirit/run/spirit/app/backup/test/api.js
// The tests of spirit/app/backup/api.js, and of no other module (spec: ./api.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// The backup server's family interface (goal/G32.3), where 'spirit/app/backup/api.js' finds it (goal/G41.12): one verb,
// status.get, taking nothing. Required as the node reads it; the verb is checked by spirit.js's own check (spirit.checkArgs).
// The server's source (backup.js) is read as text only, to find the handler. One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const S = require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/testicle/testReport/script.js');
const FILE = path.join(__dirname, '..', 'api.js');
require(path.join(RUN, 'spirit', 'script.js'));
const spirit = globalThis.spirit;

const isPlain = function (v) { return v !== null && typeof v === 'object' && !Array.isArray(v); };

const W = { api: null, verbs: {}, names: [] };
const refusedAs = function (verb, args) { if (!W.verbs[verb]) return null; const r = spirit.checkArgs('backup.' + verb, W.verbs[verb], args); return r ? r.code : ''; };

test.run('the backup branch\'s api.js loads', 0.2, function () {
  try { W.api = require(FILE); } catch (e) { return false; }
  W.verbs = W.api.verbs || {};
  W.names = Object.keys(W.verbs);
  return true;
}, test.limit.quick);
test.run('the spirit object\'s branch path for backup finds this api.js', 0.2, function () {
  return path.join(RUN, 'spirit/app/backup/api.js') === FILE || false;
}, test.limit.quick);
// "The node answers this text to api {family} without the server hearing of it, and maps it to its name: it names no family of its own."
test.run('it exports a table of verbs and nothing else: it names no branch of its own', 0.2, function () {
  if (!W.api) return false;
  return (Object.keys(W.api).join() === 'verbs' && isPlain(W.verbs)) || false;
}, test.limit.quick);
test.run('its one verb is status.get', 0.2, function () {
  if (!W.api) return false;
  return W.names.join() === 'status.get' || false;
}, test.limit.quick);
// "A verb added to the server is added here, in the same commit."
test.run('each verb it lists is a handler of backup.js, and backup.js serves no verb it does not list', 0.2, function () {
  if (!W.api) return false;
  const src = fs.readFileSync(path.join(RUN, 'spirit', 'app', 'backup', 'backup.js'), 'utf8');
  const at = src.indexOf('appServer.serve(');
  if (at === -1) return false;
  const served = []; const re = /\n {2}'?([a-zA-Z.]+)'?:\s*\{\s*\n\s*request:/g; let m;
  const block = src.slice(at);
  while ((m = re.exec(block))) served.push(m[1]);
  return served.length > 0 && served.slice().sort().join() === W.names.slice().sort().join() ? true : false;
}, test.limit.quick);
// "The last check, copy and error; it takes nothing."
test.run('status.get takes nothing, so an empty call passes and any argument is refused before it leaves', 0.2, function () {
  if (!W.api) return false;
  return (refusedAs('status.get', {}) === '' && refusedAs('status.get', { since: 1 }) === 'no-such-argument') || false;
}, test.limit.quick);
