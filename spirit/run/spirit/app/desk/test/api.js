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
test.run('api.js exports nothing but verbs: it names no branch of its own', 0.2, function () {
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
  const source = ['spirit/app/desk/server/server.js', 'spirit/server/app.js']
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
test.run('unsubscribe takes nothing', 0.2, function () {
  if (!W.api) return false;
  return passes('unsubscribe', {}) || false;
}, test.limit.quick);
test.run('unsubscribe refuses anything given', 0.2, function () {
  if (!W.api) return false;
  return (refusedAs('unsubscribe', { why: 'x' }) === 'no-such-argument') ? true : false;
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
const filters = { id: 'goal/G1', text: '', by: '', since: 0, before: 0, scope: '' };
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
test.run('press takes an empty id, as start-design with nothing open does, but never an empty what', 0.2, function () {
  if (!W.api) return false;
  return (passes('press', { id: '', what: 'start-design' }) && refusedAs('press', { id: 'goal/G1', what: '' }) === 'bad-request') ? true : false;
}, test.limit.quick);

// THE PLUNGER (goal/G49; Andy: "put the plunger back with one rowForm: ➕ \"Add blocking item\" [title-input]
// [Add-button], which will add an item with <Title> blocking the goal/item it was created from."): item.add names what the new
// item blocks, and may leave it out.
test.run('item.add takes a goal and a title, and blocks, the goal or item the new one blocks, left out or given', 0.2, function () {
  if (!W.api) return false;
  return (passes('item.add', { goal: 'goal/G1', title: 'a title' }) && passes('item.add', { goal: 'goal/G1', title: 'a title', blocks: 'goal/G1.2' })) ? true : false;
}, test.limit.quick);
test.run('the title of item.add passes the label rule: a title too long is refused', 0.2, function () {
  if (!W.api) return false;
  return (refusedAs('item.add', { goal: 'goal/G1', title: 'x'.repeat(200) }) === 'bad-request') ? true : false;
}, test.limit.quick);
test.run('item.status takes tone as optional, which the deskClient\'s file report sends', 0.2, function () {
  if (!W.api) return false;
  return (passes('item.status', { id: 'goal/G1.1', word: 'working' }) && passes('item.status', { id: 'goal/G1.1', word: 'w', tone: 'test' })) ? true : false;
}, test.limit.quick);
test.run('items.search needs all three of its flags sent, each true or false', 0.2, function () {
  if (!W.api) return false;
  return (refusedAs('items.search', { text: '', currentGoalOnly: 'true', goalsOnly: false, includeClosed: false }) === 'bad-request' && passes('items.search', { text: '', currentGoalOnly: true, goalsOnly: false, includeClosed: false })) ? true : false;
}, test.limit.quick);
// RULES GO OUT OF DESK (goal/G47.4, box v36: "The seven rule verbs go: rule.add, rule.draft, rule.get, rule.version,
// rules.search, item.rules.add, item.rules.remove."; Andy: "go!").
test.run('none of the seven rule verbs is declared', 0.2, function () {
  if (!W.api) return false;
  return !['rule.add', 'rule.draft', 'rule.get', 'rule.version', 'rules.search', 'item.rules.add', 'item.rules.remove'].some(function (v) { return v in W.verbs; }) || false;
}, test.limit.quick);

// A CHAT LINE IS A PARAGRAPH (goal/G48.4, Q21; Andy, of "should a chat line take emoji joiners (U+200D) and be a paragraph,
// 2048 bytes with line breaks, instead of a line of 1024?": "DAMN FCUKING RIGHT: spirit/type/string/paragraph.js").
test.run('chat.add takes its text as spirit.type.string.paragraph', 0.4, function () {
  if (!W.api) return false;
  return ((W.verbs['chat.add'] || {}).text === 'spirit.type.string.paragraph') || false;
}, test.limit.quick);
test.run('chat.add takes a pasted block: two lines, a runner emoji with its joiner, 2048 bytes', 0.4, function () {
  if (!W.api) return false;
  const runner = '\u{1F3C3}‍♂️';
  const block = 'red: ' + runner + ' a test\nand its next line';
  return (passes('chat.add', { id: 'goal/G1.1', text: block }) && passes('chat.add', { id: 'goal/G1.1', text: 'a'.repeat(2048) })) || false;
}, test.limit.quick);

// THE DESK CUT (goal/G48.8; Andy: "get rid of the fucking bubbles", "all signoff logic goes", the profiles: "no, they go",
// "get rid of all item.files logic", "get rid of all item.checks verbs and their logic", "get rid of \"seen\" verbs",
// "get rid of all phase logic", "get rid of block unblock", "get rid of claim", and of the gates, "get rid of all the fake
// regulation in desk"; Q7: check.add and check.set "fine, keep those").
const CUT = ['agent.state', 'agents.search', 'signoff', 'profile.get', 'profile.set', 'box.take', 'box.release', 'item.take',
  'item.release', 'line.take', 'item.files', 'item.files.add', 'item.files.remove', 'item.files.search',
  'item.checks.search', 'seen.get', 'seen.set', 'phase.take', 'phase.may', 'phase.done', 'claim', 'work.open',
  'item.claims.search', 'block', 'block.targets', 'unblock'];
// item.checks stays (Q8 of goal/G48.8, Andy: "whatever you want"): the details dialog's one read of an item's red Qs.
test.run('none of the 26 verbs the desk cut is declared', 0.4, function () {
  if (!W.api) return false;
  return !CUT.some(function (v) { return v in W.verbs; }) || false;
}, test.limit.quick);
test.run('check.add and check.set are still declared, for the red Qs', 0.4, function () {
  if (!W.api) return false;
  return ('check.add' in W.verbs && 'check.set' in W.verbs) || false;
}, test.limit.quick);
