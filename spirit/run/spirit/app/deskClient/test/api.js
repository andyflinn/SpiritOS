'use strict';

// spirit/run/spirit/app/deskClient/: the test of the deskClient server's family interface (test/api.js in its family folder)
// The tests of the deskClient server's family interface, spirit.familyPath('deskClient'), and of no other module (spec: ./api.md; goal/G41.11).
// The interface is required as the node reads it, and every verb is checked by spirit.js's own check (spirit.check, its
// rules list spirit.rules), the one the spirit object runs before a call leaves. The server's source is read as text
// only, to find each verb's handler. One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'api.js');
require(path.join(RUN, 'spirit', 'spirit.js'));
const spirit = globalThis.spirit;

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const isPlain = function (v) { return v !== null && typeof v === 'object' && !Array.isArray(v); };
const KEY = 'MCowBQYDK2VwAyEA' + 'deskClientApiTest'.padEnd(43, 'A') + '=';

// What the world test loads, read by the tests after it.
const W = { api: null, verbs: {}, names: [] };
const call = function (verb, args) { return spirit.check(verb, W.verbs[verb], args); };
const passes = function (verb, args) { return call(verb, args) === null; };
const refusedAs = function (verb, args) { const r = call(verb, args); return r ? r.code : ''; };
const NO_API = 'api.js did not load: the world failed';

test.run('the world: api.js loads', 0.2, function () {
  W.api = require(FILE);
  W.verbs = W.api.verbs || {};
  W.names = Object.keys(W.verbs);
  return true;
}, 1000);

// its shape: verbs, each argument with its rule, no family name of its own
test.run('it exports a table of verbs, with at least one verb in it', 0.2, function () {
  if (!W.api) return NO_API;
  return (isPlain(W.verbs) && W.names.length > 0) || 'exports ' + short(Object.keys(W.api)) + ', verbs ' + short(W.names);
}, 1000);
test.run('it exports nothing but verbs: it names no family of its own', 0.2, function () {
  if (!W.api) return NO_API;
  return Object.keys(W.api).join() === 'verbs' || 'exports ' + short(Object.keys(W.api));
}, 1000);
test.run('every rule is one of spirit.js\'s standard, \'?\' optional', 0.2, function () {
  if (!W.api) return NO_API;
  const badRule = [];
  W.names.forEach(function (v) {
    if (!isPlain(W.verbs[v])) { badRule.push(v + ': not an object'); return; }
    Object.keys(W.verbs[v]).forEach(function (arg) {
      const raw = String(W.verbs[v][arg]);
      const rule = raw.charAt(raw.length - 1) === '?' ? raw.slice(0, -1) : raw;
      if (spirit.rules.indexOf(rule) === -1) badRule.push(v + '.' + arg + ': ' + raw);
    });
  });
  return badRule.length === 0 || 'unknown rules: ' + short(badRule);
}, 1000);

// every verb it lists is one the server serves
test.run('each is a handler of deskClient.js, or appServer\'s streamListener (deskClient follows the desk\'s stream)', 0.2, function () {
  if (!W.api) return NO_API;
  const source = ['spirit/app/deskClient/deskClient.js', 'spirit/appServer.js'].map(function (f) { return fs.readFileSync(path.join(RUN, f), 'utf8'); }).join('\n');
  const esc = function (s) { return s.replace(/[.$]/g, '\\$&'); };
  const unserved = W.names.filter(function (v) { return !new RegExp('[\'"]' + esc(v) + '[\'"]\\s*:|^\\s*' + esc(v) + '\\s*:|\\ball\\.' + esc(v) + '\\s*=', 'm').test(source); });
  return unserved.length === 0 || 'no handler for: ' + short(unserved);
}, 1000);
test.run('deskClient serves with a stream, so appServer adds its streamListener', 0.2, function () {
  return (/\bstream\s*:\s*\{/).test(fs.readFileSync(path.join(RUN, 'spirit/app/deskClient/deskClient.js'), 'utf8')) || 'deskClient.js names no stream for appServer.serve';
}, 1000);

// each verb's arguments, as the handlers take them
test.run('next: read optional, the key of the wake the agent last read, a text', 0.2, function () {
  if (!W.api) return NO_API;
  return (passes('next', {}) && passes('next', { read: 'w-1' }) && refusedAs('next', { read: 1 }) === 'bad-request') || 'next {read: 1} ' + refusedAs('next', { read: 1 });
}, 1000);
test.run('and next refuses anything else', 0.2, function () {
  if (!W.api) return NO_API;
  return refusedAs('next', { wait: 1 }) === 'no-such-argument' || 'next {wait} ' + refusedAs('next', { wait: 1 });
}, 1000);
test.run('cache.dump takes no path: it is refused before it leaves', 0.2, function () {
  if (!W.api) return NO_API;
  return (passes('cache.dump', {}) && refusedAs('cache.dump', { path: '../x.json' }) === 'no-such-argument') || 'cache.dump {path} ' + refusedAs('cache.dump', { path: '../x.json' });
}, 1000);
test.run('desk: kept optional, true or false', 0.2, function () {
  if (!W.api) return NO_API;
  return (passes('desk', { name: 'item.get', json: '{}', kept: true }) && refusedAs('desk', { name: 'item.get', kept: 'yes' }) === 'bad-request') || 'kept \'yes\' ' + refusedAs('desk', { name: 'item.get', kept: 'yes' });
}, 1000);
test.run('desk: the desk verb by name, its json optional (\'{}\' when left out)', 0.2, function () {
  if (!W.api) return NO_API;
  return (passes('desk', { name: 'item.get', json: '{"id":"goal/G1.1"}' }) && passes('desk', { name: 'work.open' })) || short(call('desk', { name: 'work.open' }));
}, 1000);
test.run('a desk ask with no verb named is refused', 0.2, function () {
  if (!W.api) return NO_API;
  return (refusedAs('desk', { name: '' }) === 'bad-request' && refusedAs('desk', { json: '{}' }) === 'bad-request') || 'name \'\' ' + refusedAs('desk', { name: '' });
}, 1000);
test.run('its json is a JSON text, not an object', 0.2, function () {
  if (!W.api) return NO_API;
  return refusedAs('desk', { name: 'item.get', json: { id: 'x' } }) === 'bad-request' || 'json object: ' + refusedAs('desk', { name: 'item.get', json: { id: 'x' } });
}, 1000);
test.run('setDesk takes the desk node\'s key, a peer\'s public key, and needs it', 0.2, function () {
  if (!W.api) return NO_API;
  return (passes('setDesk', { key: KEY }) && refusedAs('setDesk', { key: 'not-a-key' }) === 'bad-request' && refusedAs('setDesk', {}) === 'bad-request') || 'a bad key: ' + refusedAs('setDesk', { key: 'not-a-key' });
}, 1000);
test.run('signoff and clearSignoff: agent optional', 0.2, function () {
  if (!W.api) return NO_API;
  return (passes('signoff', {}) && passes('signoff', { agent: 'claude-windows' }) && passes('clearSignoff', {}) && passes('clearSignoff', { agent: '' })) || short(call('signoff', {}));
}, 1000);
test.run('history.search: text optional, a text when sent', 0.2, function () {
  if (!W.api) return NO_API;
  return (passes('history.search', {}) && passes('history.search', { text: 'x' }) && refusedAs('history.search', { text: 3 }) === 'bad-request') || 'text 3: ' + refusedAs('history.search', { text: 3 });
}, 1000);
test.run('streamListener needs its one row, as JSON text', 0.2, function () {
  if (!W.api) return NO_API;
  return (passes('streamListener', { json: '{"verb":"x"}' }) && refusedAs('streamListener', {}) === 'bad-request') || 'streamListener {}: ' + refusedAs('streamListener', {});
}, 1000);
