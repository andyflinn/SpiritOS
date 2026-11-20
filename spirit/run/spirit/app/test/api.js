'use strict';

// spirit/run/spirit/app/test/api.js
// The tests of spirit/app/api.js, and of no other module (spec: ./api.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// The app family on the spirit object (goal/G43.2): the node's apps, four verbs, and the page's functions that implement them
// (goal/G43.7). Required as the node reads it; every verb is checked by spirit.js's own check (spirit.check), the one the
// spirit object runs before a call leaves. The node's mount of the family (server.js) is read as text only.
// One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'api.js');
require(path.join(RUN, 'spirit', 'spirit.js'));
const spirit = globalThis.spirit;

const isPlain = function (v) { return v !== null && typeof v === 'object' && !Array.isArray(v); };

// What the world test loads, read by the tests after it.
const W = { api: null, verbs: {}, names: [], functions: {} };
const call = function (verb, args) { return spirit.check('app.' + verb, W.verbs[verb], args); };
const passes = function (verb, args) { return !!W.verbs[verb] && call(verb, args) === null; };
const refusedAs = function (verb, args) { if (!W.verbs[verb]) return ''; const r = call(verb, args); return r ? r.code : ''; };

test.run('the app family\'s api.js loads', 0.2, function () {
  try { W.api = require(FILE); } catch (e) { return false; }
  W.verbs = W.api.verbs || {};
  W.names = Object.keys(W.verbs);
  W.functions = W.api.functions || {};
  return true;
}, test.limit.quick);

// ── its shape ──
// "It names no family of its own: the node maps it (goal/G32.3)".
test.run('it exports its verbs and their functions, and nothing else: it names no family of its own', 0.2, function () {
  if (!W.api) return false;
  return Object.keys(W.api).sort().join() === 'functions,verbs' || false;
}, test.limit.quick);
test.run('every argument rule is one of spirit.js\'s standard rules, a trailing question mark making it optional', 0.2, function () {
  if (!W.api) return false;
  if (!W.names.length) return false;
  const bad = [];
  W.names.forEach(function (v) {
    if (!isPlain(W.verbs[v])) { bad.push(v); return; }
    Object.keys(W.verbs[v]).forEach(function (arg) {
      const raw = String(W.verbs[v][arg]);
      const rule = raw.charAt(raw.length - 1) === '?' ? raw.slice(0, -1) : raw;
      // A rule may also name a type by its path (goal/G48.4, the box: "a type identifier is ALWAYS spirit.type.*").
      if ((spirit.rules.indexOf(rule) === -1 && !/^spirit\.type(\.[A-Za-z][A-Za-z0-9]*)+$/.test(rule))) bad.push(v);
    });
  });
  return bad.length === 0 || false;
}, test.limit.quick);
test.run('its verbs are search, active, label and icon', 0.2, function () {
  if (!W.api) return false;
  return W.names.slice().sort().join() === 'active,icon,label,search' || false;
}, test.limit.quick);
// "A verb added to the family is added here, in the same commit": the node mounts what this file lists, and no more.
test.run('each verb is one the node mounts for the app family in server.js, with the same arguments', 0.2, function () {
  if (!W.api) return false;
  const src = fs.readFileSync(path.join(RUN, 'spirit', 'server.js'), 'utf8');
  const at = src.indexOf('loopbackVerbs.mount(\'app\'');
  if (at === -1) return false;
  const block = src.slice(at, src.indexOf('}, { wire', at));
  const mounted = {};
  const re = /'([a-z.]+)':\s*\{\s*request:\s*\{([^}]*)\}/g; let m;
  while ((m = re.exec(block))) mounted[m[1]] = m[2].split(',').map(function (s) { return s.split(':')[0].trim(); }).filter(Boolean).sort().join();
  const wrong = W.names.filter(function (v) { return mounted[v] !== Object.keys(W.verbs[v]).sort().join(); })
    .concat(Object.keys(mounted).filter(function (v) { return W.names.indexOf(v) === -1; }));
  return Object.keys(mounted).length > 0 && wrong.length === 0 ? true : false;
}, test.limit.quick);

// ── each verb's arguments ──
// Andy, box: "it's minimum, no filters, just a search string."
test.run('search takes an optional search string and nothing else, so no filters', 0.2, function () {
  if (!W.api) return false;
  return (passes('search', {}) && passes('search', { q: 'desk' }) && refusedAs('search', { q: 1 }) === 'bad-request'
    && refusedAs('search', { q: '', active: true }) === 'no-such-argument') || false;
}, test.limit.quick);
// goal/G43.9, Andy's yes on Q1: "spirit.app gains a verb: "active"."
test.run('active takes the app\'s key and active, a true or false, both required', 0.2, function () {
  if (!W.api) return false;
  return (passes('active', { key: 'desk', active: false }) && refusedAs('active', { key: 'desk' }) === 'bad-request'
    && refusedAs('active', { active: true }) === 'bad-request' && refusedAs('active', { key: 'desk', active: 'yes' }) === 'bad-request')
    || false;
}, test.limit.quick);
// Q4, Andy: "yes.": the node's choices, over what <name>.json says.
test.run('label takes the app\'s key and its label, both texts, both required', 0.2, function () {
  if (!W.api) return false;
  return (passes('label', { key: 'desk', label: 'Desk' }) && refusedAs('label', { key: 'desk' }) === 'bad-request' && refusedAs('label', { key: 'desk', label: 1 }) === 'bad-request')
    || false;
}, test.limit.quick);
test.run('icon takes the app\'s key and its icon, both texts, both required', 0.2, function () {
  if (!W.api) return false;
  return (passes('icon', { key: 'desk', icon: '🗂' }) && refusedAs('icon', { icon: '🗂' }) === 'bad-request' && refusedAs('icon', { key: 'desk', icon: 1 }) === 'bad-request')
    || false;
}, test.limit.quick);

// ── the page's functions are not the verbs (goal/G43.7) ──
// Andy: "spirit.app.searchApp() which IMPLEMENTS the verb search, but isn't the verb itself."
test.run('each verb is implemented by its own function: searchApp, activeApp, labelApp, iconApp', 0.2, function () {
  if (!W.api) return false;
  return JSON.stringify(W.functions) === JSON.stringify({ search: 'searchApp', active: 'activeApp', label: 'labelApp', icon: 'iconApp' }) || false;
}, test.limit.quick);
test.run('no function is named as its verb, and every verb has one: spirit.app holds no word of its own', 0.2, function () {
  if (!W.api) return false;
  if (!W.names.length) return false;
  const bad = W.names.filter(function (v) { return typeof W.functions[v] !== 'string' || !W.functions[v] || W.functions[v] === v || W.names.indexOf(W.functions[v]) !== -1; })
    .concat(Object.keys(W.functions).filter(function (v) { return W.names.indexOf(v) === -1; }));
  return bad.length === 0 || false;
}, test.limit.quick);
