'use strict';

// spirit/run/spirit/peer/test/api.js
// The tests of spirit/peer/api.js, and of no other module (spec: ./api.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// The peer family: packets to peers, and acquiring one (goal/G32.1).
// The interface is run as spirit.js runs the text api {family} answers (loadInterface: the text, with module and exports
// alone), each call checked by spirit.js's own check (spirit.checkArgs, its rules spirit.ruleNames), the one the spirit object
// runs before a call leaves. The table the node mounts for the family is the one spirit/peer/server/script.js hands it.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const FILE = path.join(__dirname, '..', 'api.js');
require(path.join(RUN, 'spirit', 'script.js'));
const spirit = globalThis.spirit;

const isPlain = function (v) { return v !== null && typeof v === 'object' && !Array.isArray(v); };
// A peer's public key as the key rule takes one, and one it does not.
// A key the node of this tree knows, its own, ID's default (goal/G48.4, Q14: a spirit.type.string.ID is a key the node
// knows; one made up here would be refused).
const KEY = LOADER.requireScript('spirit/type/string/ID/script.js').defaultValue();
const NOT_KEY = 'not-a-key';

// THE TABLE THE NODE MOUNTS (goal/G49.25: the branches load themselves; the peer branch's node work, the table the node mounts
// under peer, is spirit/peer/server/script.js's verbs(node), where spirit/server/node/script.js's loopbackVerbs.mount('peer', ...)
// stood): the table it hands a node, each verb with its request's arguments. Its handlers are not run, so node is empty.
function mounted() {
  const table = LOADER.requireScript('spirit/peer/server/script.js').verbs({});
  if (!isPlain(table)) return null;
  const verbs = {};
  Object.keys(table).forEach(function (v) {
    const req = table[v] && table[v].request;
    verbs[v] = isPlain(req) ? Object.keys(req) : null;
  });
  return verbs;
}

// What the world loads, read by every test after it.
const W = { api: null, verbs: {}, names: [], mounted: null };
const call = function (verb, args) { return spirit.checkArgs('peer.' + verb, W.verbs[verb], args); };
const passes = function (verb, args) { return !!W.verbs[verb] && call(verb, args) === null; };
const refusedAs = function (verb, args) { if (!W.verbs[verb]) return null; const r = call(verb, args); return r ? r.code : null; };

test.run('api.js loads as spirit.js runs it on a page: its text run with module, exports and spirit.requireScript of the page', 0.2, function () {
  try {
    const m = { exports: {} };
    // AS SPIRIT.JS RUNS IT ON A PAGE (loadInterface): module and exports, and the page's window.spirit.requireScript, which it asks for
    // its companion data.js (goal/G47.1; Andy's rule: "every api.js requires it's companion data.js, and is the only script to
    // require that data.js"). What it asks is kept.
    W.asked = [];
    new Function('module', 'exports', 'window', fs.readFileSync(FILE, 'utf8'))(m, m.exports, { spirit: { requireScript: function (p) { W.asked.push(String(p)); return Promise.resolve({}); } } });
    W.api = m.exports;
  } catch (e) { return false; }
  W.verbs = (W.api && W.api.verbs) || {};
  W.names = Object.keys(W.verbs);
  return true;
}, test.limit.quick);
test.run('it asks for its companion data.js, spirit/peer/data.js, and for nothing else', 0.2, function () {
  if (!W.asked) return false;
  return W.asked.length === 1 && W.asked[0] === 'spirit/peer/data.js' ? true : false;
}, test.limit.quick);
test.run('the peer branch\'s node work, spirit/peer/server/script.js, hands the node a table of verbs', 0.2, function () {
  try { W.mounted = mounted(); } catch (e) { return false; }
  return !!W.mounted || false;
}, test.limit.quick);

// its shape: verbs, each argument with its rule, no family name of its own (goal/G32.3: the node maps it)
test.run('it exports its table of verbs and nothing else: it names no branch of its own', 0.2, function () {
  if (!W.api) return false;
  return Object.keys(W.api).join() === 'verbs' || false;
}, test.limit.quick);
test.run('every verb\'s arguments are a plain object, each rule one of spirit.js\'s standard rules, \'?\' optional', 0.2, function () {
  if (!W.api) return false;
  if (!isPlain(W.verbs)) return false;
  if (!W.names.length) return false;
  const bad = W.names.filter(function (v) {
    if (!isPlain(W.verbs[v])) return true;
    return Object.keys(W.verbs[v]).some(function (arg) {
      const raw = String(W.verbs[v][arg]);
      const rule = raw.charAt(raw.length - 1) === '?' ? raw.slice(0, -1) : raw;
      // A rule may also name a type by its path (goal/G48.4, the box: "a type identifier is ALWAYS spirit.type.*").
      return (spirit.ruleNames.indexOf(rule) === -1 && !/^spirit\/type(\/[A-Za-z][A-Za-z0-9]*)+\/script\.js$/.test(rule));
    });
  });
  return bad.length === 0 || false;
}, test.limit.quick);

// "every verb the node mounts for this family, each argument with its rule": the declaration and the table are one
test.run('it declares every verb the node mounts for the branch, and no other', 0.2, function () {
  if (!W.api) return false;
  if (!W.mounted) return false;
  const node = Object.keys(W.mounted).sort();
  const here = W.names.slice().sort();
  if (!node.length) return false;
  return JSON.stringify(node) === JSON.stringify(here) || false;
}, test.limit.quick);
test.run('each verb takes the arguments its handler\'s request carries, and no other', 0.2, function () {
  if (!W.api) return false;
  if (!W.mounted) return false;
  const judged = W.names.filter(function (v) { return Array.isArray(W.mounted[v]); });
  if (!judged.length) return false;
  const off = judged.filter(function (v) { return JSON.stringify(W.mounted[v].slice().sort()) !== JSON.stringify(Object.keys(W.verbs[v]).sort()); });
  return off.length === 0 || false;
}, test.limit.quick);

// goal/G48.4: its text is a spirit.type.string.json, JSON in a string; via a spirit.type.string.URL.
test.run('post names the peer by its key and carries JSON text; via, patienceMs and kind may be left out', 0.2, function () {
  if (!W.api) return false;
  const hi = JSON.stringify('hi');
  return (passes('post', { to: KEY, text: hi }) && passes('post', { to: KEY, text: '{}', via: 'https://relay.example', patienceMs: 3000, kind: 'background' }) && refusedAs('post', { to: NOT_KEY, text: hi }) === 'bad-request' && refusedAs('post', { to: KEY }) === 'bad-request' && refusedAs('post', { to: KEY, text: 'hi' }) === 'bad-request' && refusedAs('post', { to: KEY, text: hi, patienceMs: '3000' }) === 'bad-request') || false;
}, test.limit.quick);
test.run('acquire names the key, with a label and an address it may be given', 0.2, function () {
  if (!W.api) return false;
  return (passes('acquire', { publicKey: KEY }) && passes('acquire', { publicKey: KEY, publicLabel: 'Bob', url: 'https://relay.example' }) && refusedAs('acquire', { publicKey: NOT_KEY }) === 'bad-request' && refusedAs('acquire', { publicKey: KEY, url: 'relay.example' }) === 'bad-request') || false;
}, test.limit.quick);
// goal/G40.11: "No via since goal/G40.11: how a key arrived went with acquiredVia; acquiring keeps the row."
test.run('acquire takes no via: how a key arrived went with acquiredVia', 0.2, function () {
  if (!W.api) return false;
  return refusedAs('acquire', { publicKey: KEY, via: 'relay' }) === 'no-such-argument' || false;
}, test.limit.quick);
