'use strict';

// spirit/run/spirit/auth/test/api.js
// The tests of spirit/auth/api.js, and of no other module (spec: ./api.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// The auth family: who may call what on this node, the grants, and its bundles and branches (goal/G32.1, goal/G41.14).
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

const isPlain = function (v) { return v !== null && typeof v === 'object' && !Array.isArray(v); };
// A peer's public key as the key rule takes one, and one it does not.
// A key the node of this tree knows, its own, ID's default (goal/G48.4, Q14: a spirit.type.string.ID is a key the node
// knows; one made up here would be refused).
const KEY = require(path.join(RUN, 'spirit', 'type', 'string', 'ID.js')).defaultValue();
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
const call = function (verb, args) { return spirit.check('auth.' + verb, W.verbs[verb], args); };
const passes = function (verb, args) { return !!W.verbs[verb] && call(verb, args) === null; };
const refusedAs = function (verb, args) { if (!W.verbs[verb]) return null; const r = call(verb, args); return r ? r.code : null; };

test.run('api.js loads as spirit.js runs it on a page: its text run with module, exports and spirit.require of the page', 0.2, function () {
  try {
    const m = { exports: {} };
    // AS SPIRIT.JS RUNS IT ON A PAGE (loadInterface): module and exports, and the page's window.spirit.require, which it asks for
    // its companion data.js (goal/G47.1; Andy's rule: "every api.js requires it's companion data.js, and is the only script to
    // require that data.js"). What it asks is kept.
    W.asked = [];
    new Function('module', 'exports', 'window', fs.readFileSync(FILE, 'utf8'))(m, m.exports, { spirit: { require: function (p) { W.asked.push(String(p)); return Promise.resolve({}); } } });
    W.api = m.exports;
  } catch (e) { return false; }
  W.verbs = (W.api && W.api.verbs) || {};
  W.names = Object.keys(W.verbs);
  return true;
}, test.limit.quick);
test.run('it asks for its companion data.js, spirit/auth/data.js, and for nothing else', 0.2, function () {
  if (!W.asked) return false;
  return W.asked.length === 1 && W.asked[0] === 'spirit/auth/data.js' ? true : false;
}, test.limit.quick);
test.run('server.js mounts the auth family', 0.2, function () {
  try { W.mounted = mounted('auth'); } catch (e) { return false; }
  return !!W.mounted || false;
}, test.limit.quick);

// its shape: verbs, each argument with its rule, no family name of its own (goal/G32.3: the node maps it)
test.run('it exports its table of verbs and nothing else, so it names no family of its own', 0.2, function () {
  if (!W.api) return false;
  return Object.keys(W.api).join() === 'verbs' || false;
}, test.limit.quick);
test.run('every verb\'s arguments are a plain object, each rule one of spirit.js\'s standard rules, a trailing ? making it optional', 0.2, function () {
  if (!W.api) return false;
  if (!isPlain(W.verbs)) return false;
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

// "every verb the node mounts for this family, each argument with its rule": the declaration and the table are one
test.run('it declares every verb the node mounts for the family, and no other', 0.2, function () {
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

// a grant names a peer by its key and a path
test.run('query, grant, revoke and peer name the peer by its public key', 0.2, function () {
  if (!W.api) return false;
  // goal/G48.4: a grant's path is a spirit.type.string.word, a family or family.verb, as desk.chat.
  const ok = passes('query', { key: KEY, path: 'desk.chat' }) && passes('grant', { key: KEY, path: 'desk.chat' }) && passes('revoke', { key: KEY, path: 'desk.chat' }) && passes('peer', { key: KEY });
  const no = ['query', 'grant', 'revoke'].every(function (v) { return refusedAs(v, { key: NOT_KEY, path: 'desk.chat' }) === 'bad-request'; }) && refusedAs('peer', { key: NOT_KEY }) === 'bad-request';
  return (ok && no) || false;
}, test.limit.quick);
test.run('relabel takes a key and a label the name rule passes', 0.2, function () {
  if (!W.api) return false;
  return (passes('relabel', { key: KEY, label: 'Bob' }) && refusedAs('relabel', { key: KEY, label: 'x'.repeat(300) }) === 'bad-request') || false;
}, test.limit.quick);
test.run('search\'s text is optional', 0.2, function () {
  if (!W.api) return false;
  return (passes('search', {}) && passes('search', { text: 'bob' })) || false;
}, test.limit.quick);
// goal/G41.14: one flat verb per table, op one of add, set, delete, get and search; the node checks the rest per op
test.run('bundle and branch are one verb per table that needs its op and leaves the rest to the node per op', 0.2, function () {
  if (!W.api) return false;
  const ops = ['add', 'set', 'delete', 'get', 'search'];
  const ok = ops.every(function (op) { return passes('bundle', { op: op }) && passes('branch', { op: op }); });
  const no = refusedAs('bundle', {}) === 'bad-request' && refusedAs('branch', { op: '' }) === 'bad-request';
  return (ok && no) || false;
}, test.limit.quick);
test.run('a bundle and a branch are named by a number', 0.2, function () {
  if (!W.api) return false;
  return (passes('bundle', { op: 'get', id: 3 }) && refusedAs('bundle', { op: 'get', id: '3' }) === 'bad-request' && passes('branch', { op: 'add', bundle: 3, family: 'fs', verb: 'load' }) && refusedAs('branch', { op: 'add', bundle: '3' }) === 'bad-request') || false;
}, test.limit.quick);
// goal/G41.25: "changes to the auth.bundle verb for the addition of the \"owner\" field are approved by andy"
// goal/G48.4: the owner is a spirit.type.string.word (the box: "unlimited strings are forbidden in SpiritOS."), optional.
test.run('bundle takes an owner as a word, and the node reads one that is not valid as node', 0.2, function () {
  if (!W.api) return false;
  return (passes('bundle', { op: 'add', label: 'friends', owner: 'nosuchowner' }) && passes('bundle', { op: 'search' }) && refusedAs('bundle', { op: 'add', owner: 7 }) === 'bad-request' && refusedAs('bundle', { op: 'add', owner: 'two words' }) === 'bad-request') || false;
}, test.limit.quick);
