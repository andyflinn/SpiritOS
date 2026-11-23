'use strict';

// spirit/run/spirit/app/testicle/test/api.js
// The tests of spirit/app/testicle/api.js, and of no other module (spec: ./api.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// The testicle server's family interface (goal/G32.3), where 'spirit/app/testicle/api.js' finds it: every verb it serves,
// each argument with its rule. Required as the node reads it; every verb is checked by spirit.js's own check
// (spirit.checkArgs). The server's source (testicle.js) and appServer.js are read as text only, to find each verb's handler.
// One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const S = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = S.requireScript('spirit/test/testReport.js');
const FILE = path.join(__dirname, '..', 'api.js');
require(path.join(RUN, 'spirit', 'spirit.js'));
const spirit = globalThis.spirit;

const isPlain = function (v) { return v !== null && typeof v === 'object' && !Array.isArray(v); };

const W = { api: null, verbs: {}, names: [] };
const passes = function (verb, args) { return !!W.verbs[verb] && spirit.checkArgs('testicle.' + verb, W.verbs[verb], args) === null; };
const refusedAs = function (verb, args) { if (!W.verbs[verb]) return null; const r = spirit.checkArgs('testicle.' + verb, W.verbs[verb], args); return r ? r.code : ''; };
// suite.success since box v129-131 (Andy: "the reporter reporting fucking success/failure of the suite through a new verb
// testicle.suite.success").
const VERBS = ['busy', 'preferences', 'script.get', 'script.classify', 'suite.search', 'testicle.set', 'testicle.title', 'suite.success', 'testicle.search', 'red', 'run', 'subscribe', 'unsubscribe'];
// No analyze among them (goal/G49.6, box v15; Andy: "analyze, the verb goes, and analyze becomes a tool script at
// spirit/app/testicle/job/analyze/script.js"): the list above is the whole interface, judged by its names below.
const SET = { script: 'spirit/seal.js', suite: 'spirit/test/seal.js', test: 'a title', verified: true, severity: 0.2 };

test.run('testicle\'s api.js loads', 0.2, function () {
  try { W.api = require(FILE); } catch (e) { return false; }
  W.verbs = W.api.verbs || {};
  W.names = Object.keys(W.verbs);
  return true;
}, test.limit.quick);
test.run('testicle\'s api.js is spirit/app/testicle/api.js', 0.2, function () {
  return path.join(RUN, 'spirit/app/testicle/api.js') === FILE || false;
}, test.limit.quick);

// ── its shape ──
test.run('api.js exports a table of verbs and nothing else: it names no BRANCH of its own', 0.2, function () {
  if (!W.api) return false;
  return (Object.keys(W.api).join() === 'verbs' && isPlain(W.verbs)) || false;
}, test.limit.quick);
test.run('every rule is one of spirit.js\'s standard rules, a trailing question mark making it optional', 0.2, function () {
  if (!W.api) return false;
  if (!W.names.length) return false;
  let bad = 0;
  W.names.forEach(function (v) {
    if (!isPlain(W.verbs[v])) { bad++; return; }
    Object.keys(W.verbs[v]).forEach(function (arg) {
      const raw = String(W.verbs[v][arg]);
      const rule = raw.charAt(raw.length - 1) === '?' ? raw.slice(0, -1) : raw;
      // A rule may also name a type by its path (goal/G48.4, the box: "a type identifier is ALWAYS spirit.type.*").
      if ((spirit.ruleNames.indexOf(rule) === -1 && !/^spirit\.type(\.[A-Za-z][A-Za-z0-9]*)+$/.test(rule))) bad++;
    });
  });
  return bad === 0 || false;
}, test.limit.quick);
test.run('api.js names exactly testicle\'s verbs, no more and no fewer', 0.2, function () {
  if (!W.api) return false;
  return W.names.slice().sort().join() === VERBS.slice().sort().join() || false;
}, test.limit.quick);
// "Written by hand from the handlers in testicle.js; a verb added to the server is added here, in the same commit."
// subscribe and unsubscribe are appServer's streamPublisher, which testicle.js asks for by its publisher.
test.run('each verb is a handler of testicle.js, or of appServer\'s streamPublisher, which testicle.js asks for', 0.2, function () {
  if (!W.api) return false;
  const own = fs.readFileSync(path.join(RUN, 'spirit', 'app', 'testicle', 'server', 'server.js'), 'utf8');
  const app = fs.readFileSync(path.join(RUN, 'spirit', 'server', 'app.js'), 'utf8');
  if (!/\n {2}publisher:\s*\{/.test(own)) return false;
  const esc = function (s) { return s.replace(/[.$]/g, '\\$&'); };
  const unserved = W.names.filter(function (v) {
    if (v === 'subscribe' || v === 'unsubscribe') return !new RegExp('\\ball\\.' + v + '\\s*=\\s*\\{').test(app);
    return !new RegExp('\\n {2}[\'"]?' + esc(v) + '[\'"]?:\\s*\\{\\s*\\n\\s*request:').test(own);
  });
  return unserved.length === 0 || false;
}, test.limit.quick);
test.run('testicle.js serves no verb that api.js does not list', 0.2, function () {
  if (!W.api) return false;
  const own = fs.readFileSync(path.join(RUN, 'spirit', 'app', 'testicle', 'server', 'server.js'), 'utf8');
  const served = []; const re = /\n {2}'?([a-zA-Z.]+)'?:\s*\{\s*\n\s*request:/g; let m;
  while ((m = re.exec(own))) served.push(m[1]);
  const unlisted = served.filter(function (v) { return W.names.indexOf(v) === -1; });
  return served.length > 0 && unlisted.length === 0 ? true : false;
}, test.limit.quick);

// ── each verb's arguments ──
// goal/G47.1, the box: "busy": true if it is doing any work, false if it is idle. It takes nothing.
test.run('busy takes nothing', 0.2, function () {
  if (!W.api) return false;
  return (passes('busy', {}) && refusedAs('busy', { now: true }) === 'no-such-argument') || false;
}, test.limit.quick);
// goal/G47.1, box v79, 4: preferences, multiplexed: {} answers them all; interactive, a boolean, sets it; nothing else.
test.run('preferences takes nothing, or interactive as a boolean, and no other name', 0.2, function () {
  if (!W.api) return false;
  return (passes('preferences', {}) && passes('preferences', { interactive: false }) && refusedAs('preferences', { interactive: 'no' }) !== '' && refusedAs('preferences', { auto: true }) === 'no-such-argument') || false;
}, test.limit.quick);
test.run('red takes nothing', 0.2, function () {
  if (!W.api) return false;
  return (passes('red', {}) && refusedAs('red', { script: 'x' }) === 'no-such-argument') || false;
}, test.limit.quick);
test.run('script.get takes a name, which is a text and required', 0.2, function () {
  if (!W.api) return false;
  return (passes('script.get', { name: 'spirit/seal.js' }) && refusedAs('script.get', {}) === 'bad-request' && refusedAs('script.get', { name: 1 }) === 'bad-request') || false;
}, test.limit.quick);
test.run('suite.search takes its words, required, and a script, optional', 0.2, function () {
  if (!W.api) return false;
  return (passes('suite.search', { text: '' }) && passes('suite.search', { script: 'spirit/seal.js', text: '' }) && refusedAs('suite.search', { script: 'spirit/seal.js' }) === 'bad-request') || false;
}, test.limit.quick);
// goal/G47.1, the test-table cycle: one test's result, by itself (no bundling).
test.run('testicle.set takes one test\'s result, with script, suite, test, verified as true or false and severity as a number, all required', 0.2, function () {
  if (!W.api) return false;
  const without = Object.keys(SET).filter(function (k) { const a = Object.assign({}, SET); delete a[k]; return refusedAs('testicle.set', a) !== 'bad-request'; });
  return (passes('testicle.set', SET) && without.length === 0 && refusedAs('testicle.set', Object.assign({}, SET, { verified: 'yes' })) === 'bad-request'
    && refusedAs('testicle.set', Object.assign({}, SET, { severity: '0.2' })) === 'bad-request') || false;
}, test.limit.quick);
test.run('testicle.set takes one test only and refuses a list of results', 0.2, function () {
  if (!W.api) return false;
  return refusedAs('testicle.set', Object.assign({}, SET, { tests: [] })) === 'no-such-argument' || false;
}, test.limit.quick);
test.run('testicle.search requires its words, takes script, suite, test and result as optional, and takes no from', 0.2, function () {
  if (!W.api) return false;
  return (passes('testicle.search', { text: '' }) && passes('testicle.search', { script: 'a', suite: 'b', test: 'c', result: 'red', text: '' })
    && refusedAs('testicle.search', { script: 'a' }) === 'bad-request' && refusedAs('testicle.search', { text: '', from: 10 }) === 'no-such-argument') || false;
}, test.limit.quick);
// goal/G47.1, box v129-131: {script, suite, success}, a suite's success or failure for one script.
test.run('suite.success takes script, suite and success as true or false, all required', 0.2, function () {
  if (!W.api) return false;
  const ok = { script: 'spirit/seal.js', suite: 'spirit/test/seal.js', success: true };
  const without = Object.keys(ok).filter(function (k) { const a = Object.assign({}, ok); delete a[k]; return refusedAs('suite.success', a) !== 'bad-request'; });
  return (passes('suite.success', ok) && without.length === 0 && refusedAs('suite.success', Object.assign({}, ok, { success: 'yes' })) === 'bad-request') || false;
}, test.limit.quick);
// goal/G47.1, the run cycle: one suite run for one script, testicle (a test's title) to run up to it.
test.run('run takes a script and a suite, required, and a test\'s title, optional', 0.2, function () {
  if (!W.api) return false;
  return (passes('run', { script: 'spirit/seal.js', suite: 'spirit/test/seal.js' }) && passes('run', { script: 'spirit/seal.js', suite: 'spirit/test/seal.js', testicle: 'a title' })
    && refusedAs('run', { script: 'spirit/seal.js' }) === 'bad-request') || false;
}, test.limit.quick);
test.run('subscribe takes the branch, a non-empty id, and optional run and since, and unsubscribe takes nothing', 0.2, function () {
  if (!W.api) return false;
  return (passes('subscribe', { branch: 'testicle' }) && passes('subscribe', { branch: 'testicle', run: 'r', since: 3 }) && refusedAs('subscribe', { branch: '' }) === 'bad-request'
    && passes('unsubscribe', {}) && refusedAs('unsubscribe', { branch: 'testicle' }) === 'no-such-argument') || false;
}, test.limit.quick);

// goal/G47.1, box v94, 1: "a new verb testicle.script.classify (arguments: script, browserOnly and nodeOnly)".
test.run('script.classify takes script, browserOnly and nodeOnly, and refuses one missing or of a wrong type', 0.2, function () {
  if (!W.api) return false;
  const ok = { script: 'spirit/seal.js', browserOnly: false, nodeOnly: true };
  const bad = [{ browserOnly: false, nodeOnly: true }, { script: 'spirit/seal.js', nodeOnly: true }, { script: 'spirit/seal.js', browserOnly: false }, { script: 'spirit/seal.js', browserOnly: 'no', nodeOnly: true }];
  return (passes('script.classify', ok) && bad.every(function (b) { return !passes('script.classify', b); })) || false;
}, test.limit.quick);
