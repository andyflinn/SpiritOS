'use strict';

// spirit/run/spirit/config/test/api.js
// The tests of spirit/config/api.js, and of no other module (spec: ./api.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// The config family, kept empty for later use (goal/G30.20).
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
const KEY = 'MCowBQYDK2VwAyEA' + 'configApiTest'.padEnd(43, 'A') + '=';
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
const call = function (verb, args) { return spirit.check('config.' + verb, W.verbs[verb], args); };
const passes = function (verb, args) { return !!W.verbs[verb] && call(verb, args) === null; };
const refusedAs = function (verb, args) { if (!W.verbs[verb]) return 'no verb ' + verb; const r = call(verb, args); return r ? r.code : 'passed'; };
const NO_API = 'api.js did not load: the world failed';
const NO_MOUNT = 'no table the node mounts for config was read: the world failed';

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
test.run('the world: server.js mounts the config family', 0.2, function () {
  try { W.mounted = mounted('config'); } catch (e) { return 'server.js could not be read: ' + e.message; }
  return !!W.mounted || 'server.js holds no loopbackVerbs.mount(\'config\', ...)';
}, test.limit.quick);

// its shape: verbs, each argument with its rule, no family name of its own (goal/G32.3: the node maps it)
test.run('it exports its table of verbs and nothing else: it names no family of its own', 0.2, function () {
  if (!W.api) return NO_API;
  return Object.keys(W.api).join() === 'verbs' || 'exports ' + short(Object.keys(W.api));
}, test.limit.quick);

// goal/G30.20, Andy: "keep the config family for later use."
test.run('it declares no verb: the family is kept empty for later use', 0.2, function () {
  if (!W.api) return NO_API;
  return (isPlain(W.verbs) && W.names.length === 0) || 'verbs ' + short(W.names);
}, test.limit.quick);
test.run('and the node mounts none for it', 0.2, function () {
  if (!W.mounted) return NO_MOUNT;
  return Object.keys(W.mounted).length === 0 || 'mounted ' + short(Object.keys(W.mounted));
}, test.limit.quick);
// slim/G1.3: "Its two verbs, config.searchModules and config.setModules, went with the include list they read and set"
test.run('searchModules and setModules went with the include list they read and set', 0.2, function () {
  if (!W.api) return NO_API;
  const left = ['searchModules', 'setModules'].filter(function (v) { return Object.prototype.hasOwnProperty.call(W.verbs, v); });
  return left.length === 0 || 'still declared: ' + short(left);
}, test.limit.quick);
