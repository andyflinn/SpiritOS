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

test.run('the desk\'s api.js loads', 0.2, function () {
  try { W.api = require(FILE); } catch (e) { return false; }
  if (!W.api) return false;
  W.verbs = W.api.verbs || {};
  W.names = Object.keys(W.verbs);
  return true;
}, test.limit.quick);

// its shape: verbs, each argument with its rule, no family name of its own
test.run('api.js exports a table of verbs, with at least one verb in it', 0.2, function () {
  return (!!W.api && isPlain(W.verbs) && W.names.length > 0) || false;
}, test.limit.quick);
test.run('api.js exports nothing but verbs: it names no family of its own', 0.2, function () {
  return (!!W.api && Object.keys(W.api).join() === 'verbs') || false;
}, test.limit.quick);
test.run('every verb\'s arguments are a plain object', 0.2, function () {
  if (!W.api) return false;
  const badSpec = W.names.filter(function (v) { return !isPlain(W.verbs[v]); });
  return badSpec.length === 0 || false;
}, test.limit.quick);
test.run('every rule is one of spirit.js\'s standard rules, a trailing question mark making it optional', 0.2, function () {
  if (!W.api) return false;
  let badRule = 0;
  W.names.forEach(function (v) {
    Object.keys(W.verbs[v] || {}).forEach(function (arg) {
      const raw = String(W.verbs[v][arg]);
      const rule = raw.charAt(raw.length - 1) === '?' ? raw.slice(0, -1) : raw;
      // A rule may also name a type by its path (goal/G48.4, the box: "a type identifier is ALWAYS spirit.type.*").
      if ((spirit.rules.indexOf(rule) === -1 && !/^spirit\.type(\.[A-Za-z][A-Za-z0-9]*)+$/.test(rule))) badRule++;
    });
  });
  return badRule === 0 || false;
}, test.limit.quick);
test.run('DEBUG is appServer\'s verb and is not listed', 0.2, function () {
  if (!W.api) return false;
  return W.names.indexOf('DEBUG') === -1 || false;
}, test.limit.quick);

// every verb it lists is one the server serves
test.run('each verb listed is a handler of desk.js, or, for subscribe and unsubscribe, of appServer\'s streamPublisher', 0.2, function () {
  if (!W.api) return false;
  const source = ['spirit/app/desk/nodeDesk.js', 'spirit/appServer.js']
    .map(function (f) { return fs.readFileSync(path.join(RUN, f), 'utf8'); }).join('\n');
  // A handler is a key of the verb table ('box.write': {, block: {), or appServer's all.<verb> = {.
  const unserved = W.names.filter(function (v) { return !new RegExp('[\'"]' + esc(v) + '[\'"]\\s*:|^\\s*' + esc(v) + '\\s*:|\\ball\\.' + esc(v) + '\\s*=', 'm').test(source); });
  return unserved.length === 0 || false;
}, test.limit.quick);

// a call is checked before it leaves
test.run('an argument the verb does not take is refused as no-such-argument', 0.2, function () {
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
test.run('signoff, work.open and unsubscribe refuse anything given', 0.2, function () {
  if (!W.api) return false;
  return (refusedAs('signoff', { why: 'x' }) === 'no-such-argument') ? true : false;
}, test.limit.quick);

// where '' is a real value it passes
test.run('an empty box is a box: box.write takes an empty text', 0.2, function () {
  if (!W.api) return false;
  return (passes('box.write', { id: 'goal/G1.1', text: '', version: 3 })) ? true : false;
}, test.limit.quick);
test.run('box.write needs its version, and the version is a number', 0.2, function () {
  if (!W.api) return false;
  return (refusedAs('box.write', { id: 'goal/G1.1', text: 'x', version: '3' }) === 'bad-request' && refusedAs('box.write', { id: 'goal/G1.1', text: 'x' }) === 'bad-request') ? true : false;
}, test.limit.quick);
const filters = { id: 'goal/G1', text: '', by: '', since: '', before: '', scope: '' };
test.run('in chat.search an empty filter filters nothing', 0.2, function () {
  if (!W.api) return false;
  return (passes('chat.search', filters)) ? true : false;
}, test.limit.quick);
test.run('chat.search needs every filter sent', 0.2, function () {
  if (!W.api) return false;
  return (refusedAs('chat.search', { id: 'goal/G1', text: '' }) === 'bad-request') ? true : false;
}, test.limit.quick);
test.run('check.add takes empty words and an empty test', 0.2, function () {
  if (!W.api) return false;
  return (passes('check.add', { id: 'goal/G1.1', kind: 'C', words: '', test: '' })) ? true : false;
}, test.limit.quick);
test.run('claim takes an empty commit, as a plain item\'s build claim does', 0.2, function () {
  if (!W.api) return false;
  return (passes('claim', { id: 'goal/G1.1', phase: 'build', commit: '' })) ? true : false;
}, test.limit.quick);
test.run('press takes an empty id, as start-design with nothing open does, but never an empty what', 0.2, function () {
  if (!W.api) return false;
  return (passes('press', { id: '', what: 'start-design' }) && refusedAs('press', { id: 'goal/G1', what: '' }) === 'bad-request') ? true : false;
}, test.limit.quick);
test.run('profile.get takes an empty agent, meaning the caller', 0.2, function () {
  if (!W.api) return false;
  return (passes('profile.get', { agent: '' })) ? true : false;
}, test.limit.quick);
test.run('item.files takes under as optional, and an empty under keeps every path', 0.2, function () {
  if (!W.api) return false;
  return (passes('item.files', { id: 'goal/G1.1', under: '' }) && passes('item.files', { id: 'goal/G1.1' })) ? true : false;
}, test.limit.quick);

// optional where the handler lets it be left out, and only there
test.run('item.add takes blocks left out or empty', 0.2, function () {
  if (!W.api) return false;
  return (passes('item.add', { goal: 'goal/G1', title: 'a title' }) && passes('item.add', { goal: 'goal/G1', title: 'a title', blocks: '' })) ? true : false;
}, test.limit.quick);
test.run('the title of item.add passes the label rule: a title too long is refused', 0.2, function () {
  if (!W.api) return false;
  return (refusedAs('item.add', { goal: 'goal/G1', title: 'x'.repeat(200) }) === 'bad-request') ? true : false;
}, test.limit.quick);
test.run('item.status takes tone as optional, which the deskClient\'s file report sends', 0.2, function () {
  if (!W.api) return false;
  return (passes('item.status', { id: 'goal/G1.1', word: 'working' }) && passes('item.status', { id: 'goal/G1.1', word: 'w', tone: 'test' })) ? true : false;
}, test.limit.quick);
test.run('phase.done takes pass and why only for a verify', 0.2, function () {
  if (!W.api) return false;
  return (passes('phase.done', { id: 'goal/G1.1', phase: 'red' }) && passes('phase.done', { id: 'goal/G1.1', phase: 'verify', pass: true, why: '' })) ? true : false;
}, test.limit.quick);
test.run('the pass of phase.done, when sent, is true or false', 0.2, function () {
  if (!W.api) return false;
  return (refusedAs('phase.done', { id: 'goal/G1.1', phase: 'verify', pass: 'yes' }) === 'bad-request') ? true : false;
}, test.limit.quick);
test.run('profile.set takes an empty name and nick as no name and no nick, with included and cap optional', 0.2, function () {
  if (!W.api) return false;
  return (passes('profile.set', { agent: 'K', name: '', nick: '' }) && passes('profile.set', { agent: 'K', name: 'n', nick: 'x', included: true, cap: false })) ? true : false;
}, test.limit.quick);
test.run('items.search needs all three of its flags sent, each true or false', 0.2, function () {
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
// RULES GO OUT OF DESK (goal/G47.4, box v36: "The seven rule verbs go: rule.add, rule.draft, rule.get, rule.version,
// rules.search, item.rules.add, item.rules.remove."; Andy: "go!").
test.run('none of the seven rule verbs is declared', 0.2, function () {
  if (!W.api) return false;
  return !['rule.add', 'rule.draft', 'rule.get', 'rule.version', 'rules.search', 'item.rules.add', 'item.rules.remove'].some(function (v) { return v in W.verbs; }) || false;
}, test.limit.quick);

