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

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
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
const oneRowWhy = function (v) { return v + ' with a list: ' + refusedAs(v, { id: 'goal/G1.1', path: ['a', 'b'] }); };

test.run('the world: api.js loads', 0.2, function () {
  try { W.api = require(FILE); } catch (e) { return 'api.js threw as it loaded: ' + e.message; }
  if (!W.api) return 'api.js exports nothing';
  W.verbs = W.api.verbs || {};
  W.names = Object.keys(W.verbs);
  return true;
}, test.limit.quick);

// its shape: verbs, each argument with its rule, no family name of its own
test.run('it exports a table of verbs, with at least one verb in it', 0.2, function () {
  return (!!W.api && isPlain(W.verbs) && W.names.length > 0) || 'exports ' + short(Object.keys(W.api || {})) + ', verbs ' + short(W.names);
}, test.limit.quick);
test.run('it exports nothing but verbs: it names no family of its own', 0.2, function () {
  return (!!W.api && Object.keys(W.api).join() === 'verbs') || 'exports ' + short(Object.keys(W.api || {}));
}, test.limit.quick);
test.run('every verb\'s arguments are a plain object', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  const badSpec = W.names.filter(function (v) { return !isPlain(W.verbs[v]); });
  return badSpec.length === 0 || 'not an object: ' + short(badSpec);
}, test.limit.quick);
test.run('every rule is one of spirit.js\'s standard rules, \'?\' optional', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  const badRule = [];
  W.names.forEach(function (v) {
    Object.keys(W.verbs[v] || {}).forEach(function (arg) {
      const raw = String(W.verbs[v][arg]);
      const rule = raw.charAt(raw.length - 1) === '?' ? raw.slice(0, -1) : raw;
      if (spirit.rules.indexOf(rule) === -1) badRule.push(v + '.' + arg + ': ' + raw);
    });
  });
  return badRule.length === 0 || 'unknown rules: ' + short(badRule) + '; the standard: ' + spirit.rules.join(', ');
}, test.limit.quick);
test.run('DEBUG is appServer\'s, not listed', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return W.names.indexOf('DEBUG') === -1 || 'listed: ' + short(W.names.filter(function (v) { return v === 'DEBUG'; }));
}, test.limit.quick);

// every verb it lists is one the server serves
test.run('each is a handler of desk.js or appServer\'s streamPublisher (subscribe, unsubscribe)', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  const source = ['spirit/app/desk/nodeDesk.js', 'spirit/appServer.js']
    .map(function (f) { return fs.readFileSync(path.join(RUN, f), 'utf8'); }).join('\n');
  // A handler is a key of the verb table ('box.write': {, block: {), or appServer's all.<verb> = {.
  const unserved = W.names.filter(function (v) { return !new RegExp('[\'"]' + esc(v) + '[\'"]\\s*:|^\\s*' + esc(v) + '\\s*:|\\ball\\.' + esc(v) + '\\s*=', 'm').test(source); });
  return unserved.length === 0 || 'no handler for: ' + short(unserved);
}, test.limit.quick);

// a call is checked before it leaves
test.run('an argument the verb does not take is refused (no-such-argument)', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return (refusedAs('item.get', { id: 'goal/G1.1', extra: 1 }) === 'no-such-argument') ? true : 'answered ' + short(call('item.get', { id: 'goal/G1.1', extra: 1 }));
}, test.limit.quick);
test.run('an id left out or empty is refused', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return (refusedAs('item.get', {}) === 'bad-request' && refusedAs('item.get', { id: '' }) === 'bad-request') ? true : 'item.get {} ' + refusedAs('item.get', {}) + ', id \'\' ' + refusedAs('item.get', { id: '' });
}, test.limit.quick);
test.run('signoff, work.open and unsubscribe take nothing', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return (passes('signoff', {}) && passes('work.open', {}) && passes('unsubscribe', {})) ? true : 'signoff ' + short(call('signoff', {}));
}, test.limit.quick);
test.run('and refuse anything given', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return (refusedAs('signoff', { why: 'x' }) === 'no-such-argument') ? true : 'signoff {why} ' + refusedAs('signoff', { why: 'x' });
}, test.limit.quick);

// where '' is a real value it passes
test.run('an empty box is a box: box.write takes text \'\'', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return (passes('box.write', { id: 'goal/G1.1', text: '', version: 3 })) ? true : short(call('box.write', { id: 'goal/G1.1', text: '', version: 3 }));
}, test.limit.quick);
test.run('its version is a number, and needed', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return (refusedAs('box.write', { id: 'goal/G1.1', text: 'x', version: '3' }) === 'bad-request' && refusedAs('box.write', { id: 'goal/G1.1', text: 'x' }) === 'bad-request') ? true : 'version \'3\' ' + refusedAs('box.write', { id: 'goal/G1.1', text: 'x', version: '3' });
}, test.limit.quick);
const filters = { id: 'goal/G1', text: '', by: '', since: '', before: '', scope: '' };
test.run('chat.search: each filter \'\' filters nothing', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return (passes('chat.search', filters)) ? true : short(call('chat.search', filters));
}, test.limit.quick);
test.run('but every filter is sent', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return (refusedAs('chat.search', { id: 'goal/G1', text: '' }) === 'bad-request') ? true : 'chat.search without by: ' + refusedAs('chat.search', { id: 'goal/G1', text: '' });
}, test.limit.quick);
test.run('check.add takes words and test \'\'', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return (passes('check.add', { id: 'goal/G1.1', kind: 'C', words: '', test: '' })) ? true : short(call('check.add', { id: 'goal/G1.1', kind: 'C', words: '', test: '' }));
}, test.limit.quick);
test.run('claim takes commit \'\' (a plain item\'s build claim)', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return (passes('claim', { id: 'goal/G1.1', phase: 'build', commit: '' })) ? true : short(call('claim', { id: 'goal/G1.1', phase: 'build', commit: '' }));
}, test.limit.quick);
test.run('press takes id \'\' (start-design with nothing open), never an empty what', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return (passes('press', { id: '', what: 'start-design' }) && refusedAs('press', { id: 'goal/G1', what: '' }) === 'bad-request') ? true : 'press id \'\' ' + short(call('press', { id: '', what: 'start-design' }));
}, test.limit.quick);
test.run('profile.get takes agent \'\' (the caller)', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return (passes('profile.get', { agent: '' })) ? true : short(call('profile.get', { agent: '' }));
}, test.limit.quick);
test.run('item.files: under is optional, \'\' keeps every path', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return (passes('item.files', { id: 'goal/G1.1', under: '' }) && passes('item.files', { id: 'goal/G1.1' })) ? true : short(call('item.files', { id: 'goal/G1.1' }));
}, test.limit.quick);

// optional where the handler lets it be left out, and only there
test.run('item.add: blocks may be left out, or \'\'', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return (passes('item.add', { goal: 'goal/G1', title: 'a title' }) && passes('item.add', { goal: 'goal/G1', title: 'a title', blocks: '' })) ? true : short(call('item.add', { goal: 'goal/G1', title: 'a title' }));
}, test.limit.quick);
test.run('its title passes the label rule: a title too long is refused', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return (refusedAs('item.add', { goal: 'goal/G1', title: 'x'.repeat(200) }) === 'bad-request') ? true : 'answered ' + refusedAs('item.add', { goal: 'goal/G1', title: 'x'.repeat(200) });
}, test.limit.quick);
test.run('item.status: tone optional (the deskClient\'s file report sends it)', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return (passes('item.status', { id: 'goal/G1.1', word: 'working' }) && passes('item.status', { id: 'goal/G1.1', word: 'w', tone: 'test' })) ? true : short(call('item.status', { id: 'goal/G1.1', word: 'w', tone: 'test' }));
}, test.limit.quick);
test.run('phase.done: pass and why only for a verify', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return (passes('phase.done', { id: 'goal/G1.1', phase: 'red' }) && passes('phase.done', { id: 'goal/G1.1', phase: 'verify', pass: true, why: '' })) ? true : short(call('phase.done', { id: 'goal/G1.1', phase: 'red' }));
}, test.limit.quick);
test.run('and pass, when sent, is true or false', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return (refusedAs('phase.done', { id: 'goal/G1.1', phase: 'verify', pass: 'yes' }) === 'bad-request') ? true : 'pass \'yes\' ' + refusedAs('phase.done', { id: 'goal/G1.1', phase: 'verify', pass: 'yes' });
}, test.limit.quick);
test.run('profile.set: name and nick \'\' are no name and no nick; included and cap optional', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return (passes('profile.set', { agent: 'K', name: '', nick: '' }) && passes('profile.set', { agent: 'K', name: 'n', nick: 'x', included: true, cap: false })) ? true : short(call('profile.set', { agent: 'K', name: '', nick: '' }));
}, test.limit.quick);
test.run('items.search: its three flags are true or false, all sent', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return (refusedAs('items.search', { text: '', currentGoalOnly: 'true', goalsOnly: false, includeClosed: false }) === 'bad-request' && passes('items.search', { text: '', currentGoalOnly: true, goalsOnly: false, includeClosed: false })) ? true : 'a string flag ' + refusedAs('items.search', { text: '', currentGoalOnly: 'true', goalsOnly: false, includeClosed: false });
}, test.limit.quick);
// one row a write (goal/G40.3)
test.run('item.files.add takes one path, never a list', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return (oneRow('item.files.add')) ? true : oneRowWhy('item.files.add');
}, test.limit.quick);
test.run('item.files.remove takes one path, never a list', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return (oneRow('item.files.remove')) ? true : oneRowWhy('item.files.remove');
}, test.limit.quick);
test.run('item.suites.add takes one path, never a list', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return (oneRow('item.suites.add')) ? true : oneRowWhy('item.suites.add');
}, test.limit.quick);
test.run('item.suites.remove takes one path, never a list', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return (oneRow('item.suites.remove')) ? true : oneRowWhy('item.suites.remove');
}, test.limit.quick);
test.run('rules.search: types and statuses are lists', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return (passes('rules.search', { text: '', types: [], statuses: [] }) && refusedAs('rules.search', { text: '', types: 'a', statuses: [] }) === 'bad-request') ? true : 'types \'a\' ' + refusedAs('rules.search', { text: '', types: 'a', statuses: [] });
}, test.limit.quick);
test.run('rule.add: its text passes the paragraph rule', 0.2, function () {
  if (!W.api) return 'no api.js: the world failed';
  return (refusedAs('rule.add', { type: 't', label: 'l', text: 'x'.repeat(100000) }) === 'bad-request') ? true : 'a text too long: ' + refusedAs('rule.add', { type: 't', label: 'l', text: 'x'.repeat(100000) });
}, test.limit.quick);

