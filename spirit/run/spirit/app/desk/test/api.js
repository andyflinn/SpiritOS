'use strict';

// spirit/run/spirit/app/desk/: the test of the desk server's family interface (test/api.js in its family folder)
// The tests of the desk server's family interface, spirit/app/desk/api.js (goal/G43.27), and of no other module (spec: ./api.md; goal/G41.11). The interface
// is required as the node reads it, and every verb is checked by spirit.js's own check (spirit.check, its rules list
// spirit.rules), the one the spirit object runs before a call leaves. The server's source is read as text only, to find
// each verb's handler.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'api.js');
require(path.join(RUN, 'spirit', 'spirit.js'));
const spirit = globalThis.spirit;

const isPlain = function (v) { return v !== null && typeof v === 'object' && !Array.isArray(v); };

// What the world test loads, read by every test after it.
const W = { api: null, verbs: {}, names: [] };
// spirit.check answers null when the call passes, else a refusal carrying its code.
const call = function (verb, args) { return spirit.check(verb, W.verbs[verb], args); };
const passes = function (verb, args) { return call(verb, args) === null; };
const refusedAs = function (verb, args) { const r = call(verb, args); return r ? r.code : ''; };
const esc = function (s) { return s.replace(/[.$]/g, '\\$&'); };
// One row a write (goal/G40.3): one path passes, a list is refused.
const oneRow = function (v) { return passes(v, { id: 'goal/G1.1', path: 'spirit/run/a.js' }) && refusedAs(v, { id: 'goal/G1.1', path: ['a', 'b'] }) === 'bad-request'; };

test.run('the world: api.js loads', 0.2, function () {
  try { W.api = require(FILE); } catch (e) { return false; }
  if (!W.api) return false;
  W.verbs = W.api.verbs || {};
  W.names = Object.keys(W.verbs);
  return true;
}, test.limit.quick);

// its shape: verbs, each argument with its rule, no family name of its own
test.run('it exports a table of verbs, with at least one verb in it', 0.2, function () {
  return (!!W.api && isPlain(W.verbs) && W.names.length > 0) || false;
}, test.limit.quick);
test.run('it exports nothing but verbs: it names no family of its own', 0.2, function () {
  return (!!W.api && Object.keys(W.api).join() === 'verbs') || false;
}, test.limit.quick);
test.run('every verb\'s arguments are a plain object', 0.2, function () {
  if (!W.api) return false;
  const badSpec = W.names.filter(function (v) { return !isPlain(W.verbs[v]); });
  return badSpec.length === 0 || false;
}, test.limit.quick);
test.run('every rule is one of spirit.js\'s standard rules, \'?\' optional', 0.2, function () {
  if (!W.api) return false;
  let badRule = 0;
  W.names.forEach(function (v) {
    Object.keys(W.verbs[v] || {}).forEach(function (arg) {
      const raw = String(W.verbs[v][arg]);
      const rule = raw.charAt(raw.length - 1) === '?' ? raw.slice(0, -1) : raw;
      if (spirit.rules.indexOf(rule) === -1) badRule++;
    });
  });
  return badRule === 0 || false;
}, test.limit.quick);
test.run('DEBUG is appServer\'s, not listed', 0.2, function () {
  if (!W.api) return false;
  return W.names.indexOf('DEBUG') === -1 || false;
}, test.limit.quick);

// every verb it lists is one the server serves
test.run('each is a handler of desk.js or appServer\'s streamPublisher (subscribe, unsubscribe)', 0.2, function () {
  if (!W.api) return false;
  const source = ['spirit/app/desk/nodeDesk.js', 'spirit/appServer.js']
    .map(function (f) { return fs.readFileSync(path.join(RUN, f), 'utf8'); }).join('\n');
  // A handler is a key of the verb table ('box.write': {, block: {), or appServer's all.<verb> = {.
  const unserved = W.names.filter(function (v) { return !new RegExp('[\'"]' + esc(v) + '[\'"]\\s*:|^\\s*' + esc(v) + '\\s*:|\\ball\\.' + esc(v) + '\\s*=', 'm').test(source); });
  return unserved.length === 0 || false;
}, test.limit.quick);

// a call is checked before it leaves
test.run('an argument the verb does not take is refused (no-such-argument)', 0.2, function () {
  if (!W.api) return false;
  return (refusedAs('item.get', { id: 'goal/G1.1', extra: 1 }) === 'no-such-argument') ? true : false;
}, test.limit.quick);
test.run('an id left out or empty is refused', 0.2, function () {
  if (!W.api) return false;
  return (refusedAs('item.get', {}) === 'bad-request' && refusedAs('item.get', { id: '' }) === 'bad-request') ? true : false;
}, test.limit.quick);
test.run('signoff, work.open and unsubscribe take nothing', 0.2, function () {
  if (!W.api) return false;
  return (passes('signoff', {}) && passes('work.open', {}) && passes('unsubscribe', {})) ? true : false;
}, test.limit.quick);
test.run('and refuse anything given', 0.2, function () {
  if (!W.api) return false;
  return (refusedAs('signoff', { why: 'x' }) === 'no-such-argument') ? true : false;
}, test.limit.quick);

// where '' is a real value it passes
test.run('an empty box is a box: box.write takes text \'\'', 0.2, function () {
  if (!W.api) return false;
  return (passes('box.write', { id: 'goal/G1.1', text: '', version: 3 })) ? true : false;
}, test.limit.quick);
test.run('its version is a number, and needed', 0.2, function () {
  if (!W.api) return false;
  return (refusedAs('box.write', { id: 'goal/G1.1', text: 'x', version: '3' }) === 'bad-request' && refusedAs('box.write', { id: 'goal/G1.1', text: 'x' }) === 'bad-request') ? true : false;
}, test.limit.quick);
const filters = { id: 'goal/G1', text: '', by: '', since: '', before: '', scope: '' };
test.run('chat.search: each filter \'\' filters nothing', 0.2, function () {
  if (!W.api) return false;
  return (passes('chat.search', filters)) ? true : false;
}, test.limit.quick);
test.run('but every filter is sent', 0.2, function () {
  if (!W.api) return false;
  return (refusedAs('chat.search', { id: 'goal/G1', text: '' }) === 'bad-request') ? true : false;
}, test.limit.quick);
test.run('check.add takes words and test \'\'', 0.2, function () {
  if (!W.api) return false;
  return (passes('check.add', { id: 'goal/G1.1', kind: 'C', words: '', test: '' })) ? true : false;
}, test.limit.quick);
test.run('claim takes commit \'\' (a plain item\'s build claim)', 0.2, function () {
  if (!W.api) return false;
  return (passes('claim', { id: 'goal/G1.1', phase: 'build', commit: '' })) ? true : false;
}, test.limit.quick);
test.run('press takes id \'\' (start-design with nothing open), never an empty what', 0.2, function () {
  if (!W.api) return false;
  return (passes('press', { id: '', what: 'start-design' }) && refusedAs('press', { id: 'goal/G1', what: '' }) === 'bad-request') ? true : false;
}, test.limit.quick);
test.run('profile.get takes agent \'\' (the caller)', 0.2, function () {
  if (!W.api) return false;
  return (passes('profile.get', { agent: '' })) ? true : false;
}, test.limit.quick);
test.run('item.files: under is optional, \'\' keeps every path', 0.2, function () {
  if (!W.api) return false;
  return (passes('item.files', { id: 'goal/G1.1', under: '' }) && passes('item.files', { id: 'goal/G1.1' })) ? true : false;
}, test.limit.quick);

// optional where the handler lets it be left out, and only there
test.run('item.add: blocks may be left out, or \'\'', 0.2, function () {
  if (!W.api) return false;
  return (passes('item.add', { goal: 'goal/G1', title: 'a title' }) && passes('item.add', { goal: 'goal/G1', title: 'a title', blocks: '' })) ? true : false;
}, test.limit.quick);
test.run('its title passes the label rule: a title too long is refused', 0.2, function () {
  if (!W.api) return false;
  return (refusedAs('item.add', { goal: 'goal/G1', title: 'x'.repeat(200) }) === 'bad-request') ? true : false;
}, test.limit.quick);
test.run('item.status: tone optional (the deskClient\'s file report sends it)', 0.2, function () {
  if (!W.api) return false;
  return (passes('item.status', { id: 'goal/G1.1', word: 'working' }) && passes('item.status', { id: 'goal/G1.1', word: 'w', tone: 'test' })) ? true : false;
}, test.limit.quick);
test.run('phase.done: pass and why only for a verify', 0.2, function () {
  if (!W.api) return false;
  return (passes('phase.done', { id: 'goal/G1.1', phase: 'red' }) && passes('phase.done', { id: 'goal/G1.1', phase: 'verify', pass: true, why: '' })) ? true : false;
}, test.limit.quick);
test.run('and pass, when sent, is true or false', 0.2, function () {
  if (!W.api) return false;
  return (refusedAs('phase.done', { id: 'goal/G1.1', phase: 'verify', pass: 'yes' }) === 'bad-request') ? true : false;
}, test.limit.quick);
test.run('profile.set: name and nick \'\' are no name and no nick; included and cap optional', 0.2, function () {
  if (!W.api) return false;
  return (passes('profile.set', { agent: 'K', name: '', nick: '' }) && passes('profile.set', { agent: 'K', name: 'n', nick: 'x', included: true, cap: false })) ? true : false;
}, test.limit.quick);
test.run('items.search: its three flags are true or false, all sent', 0.2, function () {
  if (!W.api) return false;
  return (refusedAs('items.search', { text: '', currentGoalOnly: 'true', goalsOnly: false, includeClosed: false }) === 'bad-request' && passes('items.search', { text: '', currentGoalOnly: true, goalsOnly: false, includeClosed: false })) ? true : false;
}, test.limit.quick);
// one row a write (goal/G40.3)
test.run('item.files.add takes one path, never a list', 0.2, function () {
  if (!W.api) return false;
  return (oneRow('item.files.add')) ? true : false;
}, test.limit.quick);
test.run('item.files.remove takes one path, never a list', 0.2, function () {
  if (!W.api) return false;
  return (oneRow('item.files.remove')) ? true : false;
}, test.limit.quick);
test.run('rules.search: types and statuses are lists', 0.2, function () {
  if (!W.api) return false;
  return (passes('rules.search', { text: '', types: [], statuses: [] }) && refusedAs('rules.search', { text: '', types: 'a', statuses: [] }) === 'bad-request') ? true : false;
}, test.limit.quick);
test.run('rule.add: its text passes the paragraph rule', 0.2, function () {
  if (!W.api) return false;
  return (refusedAs('rule.add', { type: 't', label: 'l', text: 'x'.repeat(100000) }) === 'bad-request') ? true : false;
}, test.limit.quick);

