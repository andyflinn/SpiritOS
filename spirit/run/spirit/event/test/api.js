'use strict';

// spirit/run/spirit/event/test/api.js
// The tests of spirit/event/api.js, and of no other module (spec: ./api.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// The event family: the node's one dispatcher of events, subscribe and publish (goal/G40.6).
// The interface is run as spirit.js runs the text api {family} answers (loadInterface: the text, with module and exports
// alone), each call checked by spirit.js's own check (spirit.check, its rules spirit.rules), the one the spirit object
// runs before a call leaves. server.js is read as text only, to find the table the node mounts for the family.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'api.js');
require(path.join(RUN, 'spirit', 'spirit.js'));
const spirit = globalThis.spirit;

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const isPlain = function (v) { return v !== null && typeof v === 'object' && !Array.isArray(v); };
// A peer's public key as the key rule takes one, and one it does not.
const KEY = 'MCowBQYDK2VwAyEA' + 'eventApiTest'.padEnd(43, 'A') + '=';
const NOT_KEY = 'not-a-key';

// THE TABLE THE NODE MOUNTS, read from server.js's text: loopbackVerbs.mount('<family>', <folder>, { '<verb>': { request:
// { <argument>: ... }, ... } }). Strings and comments are stepped over, so a brace in them counts for nothing.
function skip(src, i) {
  const c = src[i];
  if (c === '/' && src[i + 1] === '/') { const n = src.indexOf('\n', i); return n === -1 ? src.length : n; }
  if (c === '/' && src[i + 1] === '*') { const n = src.indexOf('*/', i); return n === -1 ? src.length : n + 1; }
  if (c === '\'' || c === '"' || c === '`') { let j = i + 1; while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; j++; } return j; }
  return i;
}
// The keys of the object literal whose { is at open, each with where its value starts.
function keysAt(src, open) {
  const out = [];
  let depth = 0; let expect = false;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (depth === 1 && expect && !/\s/.test(c)) {
      if (c === '/' && (src[i + 1] === '/' || src[i + 1] === '*')) { i = skip(src, i); continue; }
      const m = /^(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*:\s*/.exec(src.slice(i, i + 200));
      expect = false;
      if (m) { out.push({ key: m[1] || m[2] || m[3], at: i + m[0].length }); i += m[0].length - 1; continue; }
    }
    const k = skip(src, i);
    if (k !== i) { i = k; continue; }
    if (c === '{' || c === '[' || c === '(') { depth++; if (depth === 1) expect = true; } else if (c === '}' || c === ']' || c === ')') { depth--; if (depth === 0) return out; } else if (c === ',' && depth === 1) expect = true;
  }
  return null;
}
function mounted(family) {
  const src = fs.readFileSync(path.join(RUN, 'spirit', 'server.js'), 'utf8');
  const head = 'loopbackVerbs.mount(\'' + family + '\',';
  let at = src.indexOf(head);
  if (at === -1) return null;
  const verbs = {};
  for (; at !== -1; at = src.indexOf(head, at + 1)) {
    // The third argument: the first { after the folder's path.join(...).
    const open = src.indexOf('{', src.indexOf(')', at + head.length));
    (keysAt(src, open) || []).forEach(function (v) {
      const req = (keysAt(src, v.at) || []).filter(function (k) { return k.key === 'request'; })[0];
      verbs[v.key] = req && src[req.at] === '{' ? (keysAt(src, req.at) || []).map(function (k) { return k.key; }) : null;
    });
  }
  return verbs;
}

// What the world loads, read by every test after it.
const W = { api: null, verbs: {}, names: [], mounted: null };
const call = function (verb, args) { return spirit.check('event.' + verb, W.verbs[verb], args); };
const passes = function (verb, args) { return !!W.verbs[verb] && call(verb, args) === null; };
const refusedAs = function (verb, args) { if (!W.verbs[verb]) return 'no verb ' + verb; const r = call(verb, args); return r ? r.code : 'passed'; };
const NO_API = 'api.js did not load: the world failed';
const NO_MOUNT = 'no table the node mounts for event was read: the world failed';

test.run('the world: api.js loads as the node hands it, its text run with module and exports alone', 0.2, function () {
  try {
    const m = { exports: {} };
    new Function('module', 'exports', fs.readFileSync(FILE, 'utf8'))(m, m.exports);
    W.api = m.exports;
  } catch (e) { return 'api.js threw as it ran: ' + e.message; }
  W.verbs = (W.api && W.api.verbs) || {};
  W.names = Object.keys(W.verbs);
  return true;
}, test.limit.quick);
test.run('the world: server.js mounts the event family', 0.2, function () {
  try { W.mounted = mounted('event'); } catch (e) { return 'server.js could not be read: ' + e.message; }
  return !!W.mounted || 'server.js holds no loopbackVerbs.mount(\'event\', ...)';
}, test.limit.quick);

// its shape: verbs, each argument with its rule, no family name of its own (goal/G32.3: the node maps it)
test.run('it exports its table of verbs and nothing else: it names no family of its own', 0.2, function () {
  if (!W.api) return NO_API;
  return Object.keys(W.api).join() === 'verbs' || 'exports ' + short(Object.keys(W.api));
}, test.limit.quick);
test.run('every verb\'s arguments are a plain object, each rule one of spirit.js\'s standard rules, \'?\' optional', 0.2, function () {
  if (!W.api) return NO_API;
  if (!isPlain(W.verbs)) return 'verbs is ' + short(W.verbs);
  if (!W.names.length) return 'no verb declared: nothing judged';
  const bad = [];
  W.names.forEach(function (v) {
    if (!isPlain(W.verbs[v])) { bad.push(v + ': not an object'); return; }
    Object.keys(W.verbs[v]).forEach(function (arg) {
      const raw = String(W.verbs[v][arg]);
      const rule = raw.charAt(raw.length - 1) === '?' ? raw.slice(0, -1) : raw;
      if (spirit.rules.indexOf(rule) === -1) bad.push(v + '.' + arg + ': ' + raw);
    });
  });
  return bad.length === 0 || 'not standard: ' + short(bad) + '; the standard: ' + spirit.rules.join(', ');
}, test.limit.quick);

// "every verb the node mounts for this family, each argument with its rule": the declaration and the table are one
test.run('it declares every verb the node mounts for the family, and no other', 0.2, function () {
  if (!W.api) return NO_API;
  if (!W.mounted) return NO_MOUNT;
  const node = Object.keys(W.mounted).sort();
  const here = W.names.slice().sort();
  if (!node.length) return 'the node mounts no verb for the family: nothing judged';
  return JSON.stringify(node) === JSON.stringify(here) || 'mounted ' + short(node) + ', declared ' + short(here);
}, test.limit.quick);
test.run('each verb takes the arguments its handler\'s request carries, and no other', 0.2, function () {
  if (!W.api) return NO_API;
  if (!W.mounted) return NO_MOUNT;
  const judged = W.names.filter(function (v) { return Array.isArray(W.mounted[v]); });
  if (!judged.length) return 'no mounted verb names its request: nothing judged';
  const off = judged.filter(function (v) { return JSON.stringify(W.mounted[v].slice().sort()) !== JSON.stringify(Object.keys(W.verbs[v]).sort()); });
  return off.length === 0 || off.map(function (v) { return v + ': request ' + short(W.mounted[v]) + ', declared ' + short(Object.keys(W.verbs[v])); }).join('; ');
}, test.limit.quick);

// goal/G40.6: spirit.event.subscribe(handlers) on the page's one stream, spirit.event.publish(obj) on this process's job
test.run('it declares subscribe and publish', 0.2, function () {
  if (!W.api) return NO_API;
  return JSON.stringify(W.names.slice().sort()) === JSON.stringify(['publish', 'subscribe']) || 'verbs ' + short(W.names);
}, test.limit.quick);
test.run('subscribe takes nothing', 0.2, function () {
  if (!W.api) return NO_API;
  return (passes('subscribe', {}) && refusedAs('subscribe', { since: 1 }) === 'no-such-argument') || 'subscribe {since} ' + refusedAs('subscribe', { since: 1 });
}, test.limit.quick);
test.run('publish needs the job\'s id; status, data, logMessage and app may be left out', 0.2, function () {
  if (!W.api) return NO_API;
  return (refusedAs('publish', {}) === 'bad-request' && refusedAs('publish', { id: '' }) === 'bad-request' && passes('publish', { id: 'my.job' }) && passes('publish', { id: 'my.job', status: 'running', data: { n: 1 }, logMessage: 'up', app: { rows: [] } })) || 'publish {} ' + refusedAs('publish', {}) + ', with all ' + short(call('publish', { id: 'my.job', status: 'running', data: { n: 1 }, logMessage: 'up', app: { rows: [] } }));
}, test.limit.quick);
test.run('its data and app are objects, never a list', 0.2, function () {
  if (!W.api) return NO_API;
  return (refusedAs('publish', { id: 'my.job', data: [1] }) === 'bad-request' && refusedAs('publish', { id: 'my.job', app: 'x' }) === 'bad-request') || 'data [1] ' + refusedAs('publish', { id: 'my.job', data: [1] });
}, test.limit.quick);
