'use strict';

// spirit/run/process/js/desk/: the test of the desk server's family interface (test/api.js in its family folder)
// The tests of the desk server's family interface, spirit.familyPath('desk'), and of no other module (spec: ./api.md; goal/G41.11). The interface
// is required as the node reads it, and every verb is checked by spirit.js's own check (spirit.check, its rules list
// spirit.rules), the one the spirit object runs before a call leaves. The server's source is read as text only, to find
// each verb's handler.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'api.js');
require(path.join(RUN, 'spirit.js'));
const spirit = globalThis.spirit;

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const isPlain = function (v) { return v !== null && typeof v === 'object' && !Array.isArray(v); };

test.startTest('the desk family api.js: the desk server\'s interface');

(function () {
  let api = null;
  try { api = require(FILE); } catch (e) { test.fail('api.js threw as it loaded: ' + e.message); }
  if (!api) return;
  const verbs = api.verbs || {};
  const names = Object.keys(verbs);
  // spirit.check answers null when the call passes, else a refusal carrying its code.
  const call = function (verb, args) { return spirit.check(verb, verbs[verb], args); };
  const passes = function (verb, args) { return call(verb, args) === null; };
  const refusedAs = function (verb, args) { const r = call(verb, args); return r ? r.code : ''; };

  test.subHeading('its shape: verbs, each argument with its rule, no family name of its own');
  ok(isPlain(verbs) && names.length > 0, 'it exports { verbs } with ' + names.length + ' verbs', 'exports ' + short(Object.keys(api)));
  ok(Object.keys(api).join() === 'verbs', 'it exports nothing but verbs: it names no family of its own', 'exports ' + short(Object.keys(api)));
  const badSpec = names.filter(function (v) { return !isPlain(verbs[v]); });
  ok(badSpec.length === 0, 'every verb\'s arguments are a plain object', 'not an object: ' + short(badSpec));
  const badRule = [];
  names.forEach(function (v) {
    Object.keys(verbs[v] || {}).forEach(function (arg) {
      const raw = String(verbs[v][arg]);
      const rule = raw.charAt(raw.length - 1) === '?' ? raw.slice(0, -1) : raw;
      if (spirit.rules.indexOf(rule) === -1) badRule.push(v + '.' + arg + ': ' + raw);
    });
  });
  ok(badRule.length === 0, 'every rule is one of spirit.js\'s standard (' + spirit.rules.join(', ') + '), \'?\' optional', 'unknown rules: ' + short(badRule));
  ok(names.indexOf('DEBUG') === -1, 'DEBUG is appServer\'s, not listed', 'listed: ' + short(names.filter(function (v) { return v === 'DEBUG'; })));

  test.subHeading('every verb it lists is one the server serves');
  const source = ['process/js/desk/desk.js', 'process/js/desk/plugins/js/stackFrameChecks/stackFrameChecks.js', 'spirit/appServer.js']
    .map(function (f) { return fs.readFileSync(path.join(RUN, f), 'utf8'); }).join('\n');
  const esc = function (s) { return s.replace(/[.$]/g, '\\$&'); };
  // A handler is a key of the verb table ('box.write': {, block: {), or appServer's all.<verb> = {.
  const unserved = names.filter(function (v) { return !new RegExp('[\'"]' + esc(v) + '[\'"]\\s*:|^\\s*' + esc(v) + '\\s*:|\\ball\\.' + esc(v) + '\\s*=', 'm').test(source); });
  ok(unserved.length === 0, 'each is a handler of desk.js, of its stackFrameChecks plugin, or appServer\'s streamPublisher (subscribe, unsubscribe)', 'no handler for: ' + short(unserved));

  test.subHeading('a call is checked before it leaves');
  ok(refusedAs('item.get', { id: 'goal/G1.1', extra: 1 }) === 'no-such-argument', 'an argument the verb does not take is refused (no-such-argument)', 'answered ' + short(call('item.get', { id: 'goal/G1.1', extra: 1 })));
  ok(refusedAs('item.get', {}) === 'bad-request' && refusedAs('item.get', { id: '' }) === 'bad-request', 'an id left out or empty is refused', 'item.get {} ' + refusedAs('item.get', {}) + ', id \'\' ' + refusedAs('item.get', { id: '' }));
  ok(passes('signoff', {}) && passes('work.open', {}) && passes('unsubscribe', {}), 'signoff, work.open and unsubscribe take nothing', 'signoff ' + short(call('signoff', {})));
  ok(refusedAs('signoff', { why: 'x' }) === 'no-such-argument', 'and refuse anything given', 'signoff {why} ' + refusedAs('signoff', { why: 'x' }));

  test.subHeading('where \'\' is a real value it passes');
  ok(passes('box.write', { id: 'goal/G1.1', text: '', version: 3 }), 'an empty box is a box: box.write takes text \'\'', short(call('box.write', { id: 'goal/G1.1', text: '', version: 3 })));
  ok(refusedAs('box.write', { id: 'goal/G1.1', text: 'x', version: '3' }) === 'bad-request' && refusedAs('box.write', { id: 'goal/G1.1', text: 'x' }) === 'bad-request', 'its version is a number, and needed', 'version \'3\' ' + refusedAs('box.write', { id: 'goal/G1.1', text: 'x', version: '3' }));
  const filters = { id: 'goal/G1', text: '', by: '', since: '', before: '', scope: '' };
  ok(passes('chat.search', filters), 'chat.search: each filter \'\' filters nothing', short(call('chat.search', filters)));
  ok(refusedAs('chat.search', { id: 'goal/G1', text: '' }) === 'bad-request', 'but every filter is sent', 'chat.search without by: ' + refusedAs('chat.search', { id: 'goal/G1', text: '' }));
  ok(passes('check.add', { id: 'goal/G1.1', kind: 'C', words: '', test: '' }), 'check.add takes words and test \'\' (commitCheck sends test \'\')', short(call('check.add', { id: 'goal/G1.1', kind: 'C', words: '', test: '' })));
  ok(passes('claim', { id: 'goal/G1.1', phase: 'build', commit: '' }), 'claim takes commit \'\' (a plain item\'s build claim)', short(call('claim', { id: 'goal/G1.1', phase: 'build', commit: '' })));
  ok(passes('press', { id: '', what: 'start-design' }) && refusedAs('press', { id: 'goal/G1', what: '' }) === 'bad-request', 'press takes id \'\' (start-design with nothing open), never an empty what', 'press id \'\' ' + short(call('press', { id: '', what: 'start-design' })));
  ok(passes('profile.get', { agent: '' }), 'profile.get takes agent \'\' (the caller)', short(call('profile.get', { agent: '' })));
  ok(passes('item.files', { id: 'goal/G1.1', under: '' }) && passes('item.files', { id: 'goal/G1.1' }), 'item.files: under is optional, \'\' keeps every path', short(call('item.files', { id: 'goal/G1.1' })));

  test.subHeading('optional where the handler lets it be left out, and only there');
  ok(passes('item.add', { goal: 'goal/G1', title: 'a title' }) && passes('item.add', { goal: 'goal/G1', title: 'a title', blocks: '' }), 'item.add: blocks may be left out, or \'\'', short(call('item.add', { goal: 'goal/G1', title: 'a title' })));
  ok(refusedAs('item.add', { goal: 'goal/G1', title: 'x'.repeat(200) }) === 'bad-request', 'its title passes the label rule: a title too long is refused', 'answered ' + refusedAs('item.add', { goal: 'goal/G1', title: 'x'.repeat(200) }));
  ok(passes('item.status', { id: 'goal/G1.1', word: 'working' }) && passes('item.status', { id: 'goal/G1.1', word: 'w', tone: 'test' }), 'item.status: tone optional (the deskClient\'s file report sends it)', short(call('item.status', { id: 'goal/G1.1', word: 'w', tone: 'test' })));
  ok(passes('phase.done', { id: 'goal/G1.1', phase: 'red' }) && passes('phase.done', { id: 'goal/G1.1', phase: 'verify', pass: true, why: '' }), 'phase.done: pass and why only for a verify', short(call('phase.done', { id: 'goal/G1.1', phase: 'red' })));
  ok(refusedAs('phase.done', { id: 'goal/G1.1', phase: 'verify', pass: 'yes' }) === 'bad-request', 'and pass, when sent, is true or false', 'pass \'yes\' ' + refusedAs('phase.done', { id: 'goal/G1.1', phase: 'verify', pass: 'yes' }));
  ok(passes('profile.set', { agent: 'K', name: '', nick: '' }) && passes('profile.set', { agent: 'K', name: 'n', nick: 'x', included: true, cap: false }), 'profile.set: name and nick \'\' are no name and no nick; included and cap optional', short(call('profile.set', { agent: 'K', name: '', nick: '' })));
  ok(refusedAs('items.search', { text: '', currentGoalOnly: 'true', goalsOnly: false, includeClosed: false }) === 'bad-request' && passes('items.search', { text: '', currentGoalOnly: true, goalsOnly: false, includeClosed: false }), 'items.search: its three flags are true or false, all sent', 'a string flag ' + refusedAs('items.search', { text: '', currentGoalOnly: 'true', goalsOnly: false, includeClosed: false }));

  test.subHeading('one row a write (goal/G40.3)');
  ['item.files.add', 'item.files.remove', 'item.suites.add', 'item.suites.remove', 'stackFrameChecks.paths.add', 'stackFrameChecks.suites.add'].forEach(function (v) {
    ok(passes(v, { id: 'goal/G1.1', path: 'spirit/run/a.js' }) && refusedAs(v, { id: 'goal/G1.1', path: ['a', 'b'] }) === 'bad-request', v + ' takes one path, never a list', v + ' with a list: ' + refusedAs(v, { id: 'goal/G1.1', path: ['a', 'b'] }));
  });
  ok(passes('rules.search', { text: '', types: [], statuses: [] }) && refusedAs('rules.search', { text: '', types: 'a', statuses: [] }) === 'bad-request', 'rules.search: types and statuses are lists', 'types \'a\' ' + refusedAs('rules.search', { text: '', types: 'a', statuses: [] }));
  ok(refusedAs('rule.add', { type: 't', label: 'l', text: 'x'.repeat(100000) }) === 'bad-request', 'rule.add: its text passes the paragraph rule', 'a text too long: ' + refusedAs('rule.add', { type: 't', label: 'l', text: 'x'.repeat(100000) }));
}());

test.reportSuccessFailureCount();
