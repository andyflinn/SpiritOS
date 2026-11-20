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

const isPlain = function (v) { return v !== null && typeof v === 'object' && !Array.isArray(v); };
// A key the node of this tree knows, its own, ID's default (goal/G48.4, Q14: a spirit.type.string.ID is a key the node
// knows; one made up here would be refused).
const KEY = require(path.join(RUN, 'spirit', 'type', 'string', 'ID.js')).defaultValue();

// What the world test loads, read by the tests after it.
const W = { api: null, verbs: {}, names: [] };
const call = function (verb, args) { return spirit.check(verb, W.verbs[verb], args); };
const passes = function (verb, args) { return call(verb, args) === null; };
const refusedAs = function (verb, args) { const r = call(verb, args); return r ? r.code : ''; };

test.run('api.js loads', 0.2, function () {
  W.api = require(FILE);
  W.verbs = W.api.verbs || {};
  W.names = Object.keys(W.verbs);
  return true;
}, test.limit.quick);

// its shape: verbs, each argument with its rule, no family name of its own
test.run('it exports a table of verbs, with at least one verb in it', 0.2, function () {
  if (!W.api) return false;
  return (isPlain(W.verbs) && W.names.length > 0) || false;
}, test.limit.quick);
test.run('it exports nothing but verbs: it names no family of its own', 0.2, function () {
  if (!W.api) return false;
  return Object.keys(W.api).join() === 'verbs' || false;
}, test.limit.quick);
test.run('every rule is one of spirit.js\'s standard rules, a trailing question mark making it optional', 0.2, function () {
  if (!W.api) return false;
  const badRule = [];
  W.names.forEach(function (v) {
    if (!isPlain(W.verbs[v])) { badRule.push(v); return; }
    Object.keys(W.verbs[v]).forEach(function (arg) {
      const raw = String(W.verbs[v][arg]);
      const rule = raw.charAt(raw.length - 1) === '?' ? raw.slice(0, -1) : raw;
      // A rule may also name a type by its path (goal/G48.4, the box: "a type identifier is ALWAYS spirit.type.*").
      if ((spirit.rules.indexOf(rule) === -1 && !/^spirit\.type(\.[A-Za-z][A-Za-z0-9]*)+$/.test(rule))) badRule.push(v);
    });
  });
  return badRule.length === 0 || false;
}, test.limit.quick);

// every verb it lists is one the server serves
test.run('each verb is a handler of deskClient.js, or appServer\'s listener, since deskClient follows the desk\'s stream', 0.2, function () {
  if (!W.api) return false;
  const source = ['spirit/app/deskClient/deskClient.js', 'spirit/server/app.js'].map(function (f) { return fs.readFileSync(path.join(RUN, f), 'utf8'); }).join('\n');
  const esc = function (s) { return s.replace(/[.$]/g, '\\$&'); };
  const unserved = W.names.filter(function (v) { return !new RegExp('[\'"]' + esc(v) + '[\'"]\\s*:|^\\s*' + esc(v) + '\\s*:|\\ball\\.' + esc(v) + '\\s*=', 'm').test(source); });
  return unserved.length === 0 || false;
}, test.limit.quick);
test.run('deskClient serves with a stream, so appServer adds its listener', 0.2, function () {
  return (/\bstream\s*:\s*\{/).test(fs.readFileSync(path.join(RUN, 'spirit/app/deskClient/deskClient.js'), 'utf8')) || false;
}, test.limit.quick);

// each verb's arguments, as the handlers take them
test.run('next takes an optional read, the key of the wake the agent last read, as text', 0.2, function () {
  if (!W.api) return false;
  return (passes('next', {}) && passes('next', { read: 'w-1' }) && refusedAs('next', { read: 1 }) === 'bad-request') || false;
}, test.limit.quick);
test.run('next refuses any argument but read', 0.2, function () {
  if (!W.api) return false;
  return refusedAs('next', { wait: 1 }) === 'no-such-argument' || false;
}, test.limit.quick);
test.run('cache.dump takes no path: it is refused before it leaves', 0.2, function () {
  if (!W.api) return false;
  return (passes('cache.dump', {}) && refusedAs('cache.dump', { path: '../x.json' }) === 'no-such-argument') || false;
}, test.limit.quick);
test.run('desk takes an optional kept, true or false', 0.2, function () {
  if (!W.api) return false;
  return (passes('desk', { name: 'item.get', json: '{}', kept: true }) && refusedAs('desk', { name: 'item.get', kept: 'yes' }) === 'bad-request') || false;
}, test.limit.quick);
test.run('desk takes the desk verb by name, with its json optional and {} when left out', 0.2, function () {
  if (!W.api) return false;
  return (passes('desk', { name: 'item.get', json: '{"id":"goal/G1.1"}' }) && passes('desk', { name: 'work.open' })) || false;
}, test.limit.quick);
test.run('a desk ask with no verb named is refused', 0.2, function () {
  if (!W.api) return false;
  return (refusedAs('desk', { name: '' }) === 'bad-request' && refusedAs('desk', { json: '{}' }) === 'bad-request') || false;
}, test.limit.quick);
test.run('the json of a desk ask is a JSON text, not an object', 0.2, function () {
  if (!W.api) return false;
  return refusedAs('desk', { name: 'item.get', json: { id: 'x' } }) === 'bad-request' || false;
}, test.limit.quick);
test.run('setDesk takes the desk node\'s key, a peer\'s public key, and needs it', 0.2, function () {
  if (!W.api) return false;
  return (passes('setDesk', { key: KEY }) && refusedAs('setDesk', { key: 'not-a-key' }) === 'bad-request' && refusedAs('setDesk', {}) === 'bad-request') || false;
}, test.limit.quick);
test.run('signoff and clearSignoff take an optional agent', 0.2, function () {
  if (!W.api) return false;
  return (passes('signoff', {}) && passes('signoff', { agent: 'claude-windows' }) && passes('clearSignoff', {}) && passes('clearSignoff', { agent: '' })) || false;
}, test.limit.quick);
test.run('there is no history.search: no record of asks is kept', 0.2, function () {
  if (!W.api) return false;
  return !('history.search' in W.verbs) || false;
}, test.limit.quick);
test.run('listener needs its one row, as JSON text', 0.2, function () {
  if (!W.api) return false;
  return (passes('listener', { json: '{"verb":"x"}' }) && refusedAs('listener', {}) === 'bad-request') || false;
}, test.limit.quick);
