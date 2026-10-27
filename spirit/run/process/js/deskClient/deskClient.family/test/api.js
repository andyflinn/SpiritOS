'use strict';

// spirit/run/process/js/deskClient/deskClient.family/test/api.js
// The tests of process/js/deskClient/deskClient.family/api.js, and of no other module (spec: ./api.md; goal/G41.11).
// The interface is required as the node reads it, and every verb is checked by spirit.js's own check (spirit.check, its
// rules list spirit.rules), the one the spirit object runs before a call leaves. The server's source is read as text
// only, to find each verb's handler.

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
const KEY = 'MCowBQYDK2VwAyEA' + 'deskClientApiTest'.padEnd(43, 'A') + '=';

test.startTest('deskClient.family/api.js: the deskClient server\'s interface');

(function () {
  let api = null;
  try { api = require(FILE); } catch (e) { test.fail('api.js threw as it loaded: ' + e.message); }
  if (!api) return;
  const verbs = api.verbs || {};
  const names = Object.keys(verbs);
  const call = function (verb, args) { return spirit.check(verb, verbs[verb], args); };
  const passes = function (verb, args) { return call(verb, args) === null; };
  const refusedAs = function (verb, args) { const r = call(verb, args); return r ? r.code : ''; };

  test.subHeading('its shape: verbs, each argument with its rule, no family name of its own');
  ok(isPlain(verbs) && names.length > 0, 'it exports { verbs } with ' + names.length + ' verbs: ' + names.join(', '), 'exports ' + short(Object.keys(api)));
  ok(Object.keys(api).join() === 'verbs', 'it exports nothing but verbs: it names no family of its own', 'exports ' + short(Object.keys(api)));
  const badRule = [];
  names.forEach(function (v) {
    if (!isPlain(verbs[v])) { badRule.push(v + ': not an object'); return; }
    Object.keys(verbs[v]).forEach(function (arg) {
      const raw = String(verbs[v][arg]);
      const rule = raw.charAt(raw.length - 1) === '?' ? raw.slice(0, -1) : raw;
      if (spirit.rules.indexOf(rule) === -1) badRule.push(v + '.' + arg + ': ' + raw);
    });
  });
  ok(badRule.length === 0, 'every rule is one of spirit.js\'s standard, \'?\' optional', 'unknown rules: ' + short(badRule));

  test.subHeading('every verb it lists is one the server serves');
  const source = ['process/js/deskClient/deskClient.js', 'spirit/appServer.js'].map(function (f) { return fs.readFileSync(path.join(RUN, f), 'utf8'); }).join('\n');
  const esc = function (s) { return s.replace(/[.$]/g, '\\$&'); };
  const unserved = names.filter(function (v) { return !new RegExp('[\'"]' + esc(v) + '[\'"]\\s*:|^\\s*' + esc(v) + '\\s*:|\\ball\\.' + esc(v) + '\\s*=', 'm').test(source); });
  ok(unserved.length === 0, 'each is a handler of deskClient.js, or appServer\'s streamListener (deskClient follows the desk\'s stream)', 'no handler for: ' + short(unserved));
  ok(/\bstream\s*:\s*\{/.test(fs.readFileSync(path.join(RUN, 'process/js/deskClient/deskClient.js'), 'utf8')), 'deskClient serves with a stream, so appServer adds its streamListener', 'deskClient.js names no stream for appServer.serve');

  test.subHeading('each verb\'s arguments, as the handlers take them');
  ok(passes('next', {}) && passes('next', { read: 'w-1' }) && refusedAs('next', { read: 1 }) === 'bad-request', 'next: read optional, the key of the wake the agent last read, a text', 'next {read: 1} ' + refusedAs('next', { read: 1 }));
  ok(refusedAs('next', { wait: 1 }) === 'no-such-argument', 'and next refuses anything else', 'next {wait} ' + refusedAs('next', { wait: 1 }));
  ok(passes('cache.dump', {}) && refusedAs('cache.dump', { path: '../x.json' }) === 'no-such-argument', 'cache.dump takes no path: it is refused before it leaves', 'cache.dump {path} ' + refusedAs('cache.dump', { path: '../x.json' }));
  ok(passes('desk', { name: 'item.get', json: '{}', kept: true }) && refusedAs('desk', { name: 'item.get', kept: 'yes' }) === 'bad-request', 'desk: kept optional, true or false', 'kept \'yes\' ' + refusedAs('desk', { name: 'item.get', kept: 'yes' }));
  ok(passes('desk', { name: 'item.get', json: '{"id":"goal/G1.1"}' }) && passes('desk', { name: 'work.open' }), 'desk: the desk verb by name, its json optional (\'{}\' when left out)', short(call('desk', { name: 'work.open' })));
  ok(refusedAs('desk', { name: '' }) === 'bad-request' && refusedAs('desk', { json: '{}' }) === 'bad-request', 'a desk ask with no verb named is refused', 'name \'\' ' + refusedAs('desk', { name: '' }));
  ok(refusedAs('desk', { name: 'item.get', json: { id: 'x' } }) === 'bad-request', 'its json is a JSON text, not an object', 'json object: ' + refusedAs('desk', { name: 'item.get', json: { id: 'x' } }));
  ok(passes('setDesk', { key: KEY }) && refusedAs('setDesk', { key: 'not-a-key' }) === 'bad-request' && refusedAs('setDesk', {}) === 'bad-request', 'setDesk takes the desk node\'s key, a peer\'s public key, and needs it', 'a bad key: ' + refusedAs('setDesk', { key: 'not-a-key' }));
  ok(passes('signoff', {}) && passes('signoff', { agent: 'claude-windows' }) && passes('clearSignoff', {}) && passes('clearSignoff', { agent: '' }), 'signoff and clearSignoff: agent optional', short(call('signoff', {})));
  ok(passes('history.search', {}) && passes('history.search', { text: 'x' }) && refusedAs('history.search', { text: 3 }) === 'bad-request', 'history.search: text optional, a text when sent', 'text 3: ' + refusedAs('history.search', { text: 3 }));
  ok(passes('streamListener', { json: '{"verb":"x"}' }) && refusedAs('streamListener', {}) === 'bad-request', 'streamListener needs its one row, as JSON text', 'streamListener {}: ' + refusedAs('streamListener', {}));
}());

test.reportSuccessFailureCount();
