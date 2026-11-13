'use strict';

// spirit/run/spirit/app/testicle/test/api.js
// The tests of spirit/app/testicle/api.js, and of no other module (spec: ./api.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// The testicle server's family interface (goal/G32.3), where spirit.familyPath('testicle') finds it: every verb it serves,
// each argument with its rule. Required as the node reads it; every verb is checked by spirit.js's own check
// (spirit.check). The server's source (testicle.js) and appServer.js are read as text only, to find each verb's handler.
// One test.run per test (goal/G47.2).

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
const passes = function (verb, args) { return !!W.verbs[verb] && spirit.check('testicle.' + verb, W.verbs[verb], args) === null; };
const refusedAs = function (verb, args) { if (!W.verbs[verb]) return 'no verb ' + verb; const r = spirit.check('testicle.' + verb, W.verbs[verb], args); return r ? r.code : ''; };
const NO_API = 'api.js did not load: the world failed';
const VERBS = ['busy', 'script.get', 'suite.search', 'testicle.set', 'testicle.search', 'red', 'run', 'subscribe', 'unsubscribe'];
const SET = { script: 'spirit/seal.js', suite: 'spirit/test/seal.js', test: 'a title', verified: true, severity: 0.2 };

test.run('the world: api.js loads', 0.2, function () {
  try { W.api = require(FILE); } catch (e) { return 'api.js threw: ' + short(e && e.message); }
  W.verbs = W.api.verbs || {};
  W.names = Object.keys(W.verbs);
  return true;
}, test.limit.quick);
test.run('spirit.familyPath(\'testicle\') finds it here', 0.2, function () {
  return path.join(RUN, spirit.familyPath('testicle')) === FILE || 'familyPath(testicle) is ' + short(spirit.familyPath('testicle'));
}, test.limit.quick);

// ── its shape ──
test.run('it exports a table of verbs and nothing else: it names no family of its own', 0.2, function () {
  if (!W.api) return NO_API;
  return (Object.keys(W.api).join() === 'verbs' && isPlain(W.verbs)) || 'exports ' + short(Object.keys(W.api));
}, test.limit.quick);
test.run('every rule is one of spirit.js\'s standard, \'?\' optional', 0.2, function () {
  if (!W.api) return NO_API;
  if (!W.names.length) return 'no verb to judge';
  const bad = [];
  W.names.forEach(function (v) {
    if (!isPlain(W.verbs[v])) { bad.push(v + ': not an object'); return; }
    Object.keys(W.verbs[v]).forEach(function (arg) {
      const raw = String(W.verbs[v][arg]);
      const rule = raw.charAt(raw.length - 1) === '?' ? raw.slice(0, -1) : raw;
      if (spirit.rules.indexOf(rule) === -1) bad.push(v + '.' + arg + ': ' + raw);
    });
  });
  return bad.length === 0 || 'unknown rules: ' + short(bad);
}, test.limit.quick);
test.run('its verbs are busy, script.get, suite.search, testicle.set, testicle.search, red, run, subscribe and unsubscribe', 0.2, function () {
  if (!W.api) return NO_API;
  return W.names.slice().sort().join() === VERBS.slice().sort().join() || 'verbs ' + short(W.names);
}, test.limit.quick);
// "Written by hand from the handlers in testicle.js; a verb added to the server is added here, in the same commit."
// subscribe and unsubscribe are appServer's streamPublisher, which testicle.js asks for by its publisher.
test.run('each verb is a handler of testicle.js, or of appServer\'s streamPublisher, which testicle.js asks for', 0.2, function () {
  if (!W.api) return NO_API;
  const own = fs.readFileSync(path.join(RUN, 'spirit', 'app', 'testicle', 'testicle.js'), 'utf8');
  const app = fs.readFileSync(path.join(RUN, 'spirit', 'appServer.js'), 'utf8');
  if (!/\n {2}publisher:\s*\{/.test(own)) return 'testicle.js asks for no publisher';
  const esc = function (s) { return s.replace(/[.$]/g, '\\$&'); };
  const unserved = W.names.filter(function (v) {
    if (v === 'subscribe' || v === 'unsubscribe') return !new RegExp('\\ball\\.' + v + '\\s*=\\s*\\{').test(app);
    return !new RegExp('\\n {2}[\'"]?' + esc(v) + '[\'"]?:\\s*\\{\\s*\\n\\s*request:').test(own);
  });
  return unserved.length === 0 || 'no handler for: ' + short(unserved);
}, test.limit.quick);
test.run('and testicle.js serves no verb it does not list', 0.2, function () {
  if (!W.api) return NO_API;
  const own = fs.readFileSync(path.join(RUN, 'spirit', 'app', 'testicle', 'testicle.js'), 'utf8');
  const served = []; const re = /\n {2}'?([a-zA-Z.]+)'?:\s*\{\s*\n\s*request:/g; let m;
  while ((m = re.exec(own))) served.push(m[1]);
  const unlisted = served.filter(function (v) { return W.names.indexOf(v) === -1; });
  return served.length > 0 && unlisted.length === 0 ? true : 'served ' + short(served) + ', not listed: ' + short(unlisted);
}, test.limit.quick);

// ── each verb's arguments ──
// goal/G47.1, the box: "busy": true if it is doing any work, false if it is idle. It takes nothing.
test.run('busy takes nothing', 0.2, function () {
  if (!W.api) return NO_API;
  return (passes('busy', {}) && refusedAs('busy', { now: true }) === 'no-such-argument') || 'busy {now} ' + refusedAs('busy', { now: true });
}, test.limit.quick);
test.run('red takes nothing', 0.2, function () {
  if (!W.api) return NO_API;
  return (passes('red', {}) && refusedAs('red', { script: 'x' }) === 'no-such-argument') || 'red {script} ' + refusedAs('red', { script: 'x' });
}, test.limit.quick);
test.run('script.get takes name, a text, required', 0.2, function () {
  if (!W.api) return NO_API;
  return (passes('script.get', { name: 'spirit/seal.js' }) && refusedAs('script.get', {}) === 'bad-request' && refusedAs('script.get', { name: 1 }) === 'bad-request')
    || 'script.get {} ' + refusedAs('script.get', {}) + ', {name: 1} ' + refusedAs('script.get', { name: 1 });
}, test.limit.quick);
test.run('suite.search takes its words, required, and a script, optional', 0.2, function () {
  if (!W.api) return NO_API;
  return (passes('suite.search', { text: '' }) && passes('suite.search', { script: 'spirit/seal.js', text: '' }) && refusedAs('suite.search', { script: 'spirit/seal.js' }) === 'bad-request')
    || 'suite.search {script} ' + refusedAs('suite.search', { script: 'spirit/seal.js' });
}, test.limit.quick);
// goal/G47.1, the test-table cycle: one test's result, by itself (no bundling).
test.run('testicle.set takes one test\'s result: script, suite, test, verified a true or false, severity a number, all required', 0.2, function () {
  if (!W.api) return NO_API;
  const without = Object.keys(SET).filter(function (k) { const a = Object.assign({}, SET); delete a[k]; return refusedAs('testicle.set', a) !== 'bad-request'; });
  return (passes('testicle.set', SET) && without.length === 0 && refusedAs('testicle.set', Object.assign({}, SET, { verified: 'yes' })) === 'bad-request'
    && refusedAs('testicle.set', Object.assign({}, SET, { severity: '0.2' })) === 'bad-request') || 'let through without: ' + short(without);
}, test.limit.quick);
test.run('and testicle.set takes one test only: a list of results is refused', 0.2, function () {
  if (!W.api) return NO_API;
  return refusedAs('testicle.set', Object.assign({}, SET, { tests: [] })) === 'no-such-argument' || 'testicle.set {tests} ' + refusedAs('testicle.set', Object.assign({}, SET, { tests: [] }));
}, test.limit.quick);
test.run('testicle.search takes its words, required; script, suite, test, result and from optional, from a number', 0.2, function () {
  if (!W.api) return NO_API;
  return (passes('testicle.search', { text: '' }) && passes('testicle.search', { script: 'a', suite: 'b', test: 'c', result: 'red', from: 10, text: '' })
    && refusedAs('testicle.search', { script: 'a' }) === 'bad-request' && refusedAs('testicle.search', { text: '', from: '10' }) === 'bad-request')
    || 'testicle.search {script} ' + refusedAs('testicle.search', { script: 'a' }) + ', {from: "10"} ' + refusedAs('testicle.search', { text: '', from: '10' });
}, test.limit.quick);
// goal/G47.1, the run cycle: one suite run for one script, testicle (a test's title) to run up to it.
test.run('run takes a script and a suite, required, and a test\'s title, optional', 0.2, function () {
  if (!W.api) return NO_API;
  return (passes('run', { script: 'spirit/seal.js', suite: 'spirit/test/seal.js' }) && passes('run', { script: 'spirit/seal.js', suite: 'spirit/test/seal.js', testicle: 'a title' })
    && refusedAs('run', { script: 'spirit/seal.js' }) === 'bad-request') || 'run {script} ' + refusedAs('run', { script: 'spirit/seal.js' });
}, test.limit.quick);
test.run('subscribe takes the family, a non-empty id, and run and since optional; unsubscribe takes nothing', 0.2, function () {
  if (!W.api) return NO_API;
  return (passes('subscribe', { family: 'testicle' }) && passes('subscribe', { family: 'testicle', run: 'r', since: 3 }) && refusedAs('subscribe', { family: '' }) === 'bad-request'
    && passes('unsubscribe', {}) && refusedAs('unsubscribe', { family: 'testicle' }) === 'no-such-argument')
    || 'subscribe {family: ""} ' + refusedAs('subscribe', { family: '' }) + ', unsubscribe {family} ' + refusedAs('unsubscribe', { family: 'testicle' });
}, test.limit.quick);
