'use strict';

// spirit/run/spirit/contact/test/api.js
// The tests of spirit/contact/api.js, and of no other module (spec: ./api.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// The contact family: the node's book of peers, people and relays in one table (goal/G32.1, goal/G40.11).
// The interface is run as spirit.js runs the text api {family} answers (loadInterface: the text, with module and exports
// alone), each call checked by spirit.js's own check (spirit.checkArgs, its rules spirit.ruleNames), the one the spirit object
// runs before a call leaves. server.js is read as text only, to find the table the node mounts for the family.

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
const KEY = LOADER.requireScript('spirit/type/string/ID.js').defaultValue();
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
  // The node's server code, spirit/server/node/script.js since goal/G48.5 ("the servers move into spirit/server/").
  const src = fs.readFileSync(path.join(RUN, 'spirit', 'server', 'node', 'script.js'), 'utf8');
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
const call = function (verb, args) { return spirit.checkArgs('contact.' + verb, W.verbs[verb], args); };
const passes = function (verb, args) { return !!W.verbs[verb] && call(verb, args) === null; };
const refusedAs = function (verb, args) { if (!W.verbs[verb]) return ''; const r = call(verb, args); return r ? r.code : ''; };

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
test.run('it asks for its companion data.js, spirit/contact/data.js, and for nothing else', 0.2, function () {
  if (!W.asked) return false;
  return W.asked.length === 1 && W.asked[0] === 'spirit/contact/data.js' ? true : false;
}, test.limit.quick);
test.run('server.js mounts the contact branch', 0.2, function () {
  try { W.mounted = mounted('contact'); } catch (e) { return false; }
  return !!W.mounted || false;
}, test.limit.quick);

// its shape: verbs, each argument with its rule, no family name of its own (goal/G32.3: the node maps it)
test.run('it exports its table of verbs and nothing else: it names no branch of its own', 0.2, function () {
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
      if ((spirit.ruleNames.indexOf(rule) === -1 && !/^spirit\.type(\.[A-Za-z][A-Za-z0-9]*)+$/.test(rule))) bad.push(v);
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

// goal/G40.11: the one table, people and relays, a filter per flag; goal/G48.4: '"flags" must be booleans'
test.run('search takes a true or false filter per flag: keep, mine, relay, seated and blocked', 0.2, function () {
  if (!W.api) return false;
  const flags = ['keep', 'mine', 'relay', 'seated', 'blocked'];
  const yes = {}; flags.forEach(function (f) { yes[f] = true; });
  const ok = passes('search', Object.assign({ q: '*' }, yes)) && passes('search', {}) && flags.every(function (f) { const a = {}; a[f] = false; return passes('search', a); });
  const no = flags.every(function (f) { const a = {}; a[f] = 'yes'; return refusedAs('search', a) === 'bad-request'; });
  return (ok && no) || false;
}, test.limit.quick);
test.run('get names the contact by its key', 0.2, function () {
  if (!W.api) return false;
  return (passes('get', { key: KEY }) && refusedAs('get', { key: NOT_KEY }) === 'bad-request') || false;
}, test.limit.quick);
test.run('block, unblock, accept, label and forget name the contact by its publicKey', 0.2, function () {
  if (!W.api) return false;
  const ok = passes('block', { publicKey: KEY }) && passes('unblock', { publicKey: KEY }) && passes('accept', { publicKey: KEY }) && passes('label', { publicKey: KEY, myLabel: 'Bob' }) && passes('forget', { publicKey: KEY });
  const no = ['block', 'unblock', 'accept', 'forget'].every(function (v) { return refusedAs(v, { publicKey: NOT_KEY }) === 'bad-request'; }) && refusedAs('label', { publicKey: NOT_KEY, myLabel: 'Bob' }) === 'bad-request';
  return (ok && no) || false;
}, test.limit.quick);
test.run('label\'s myLabel is needed and passes the name rule', 0.2, function () {
  if (!W.api) return false;
  return (refusedAs('label', { publicKey: KEY }) === 'bad-request' && refusedAs('label', { publicKey: KEY, myLabel: 'x'.repeat(300) }) === 'bad-request') || false;
}, test.limit.quick);
// goal/G47.4 (box v33): "😏 is the row field faceable, set by the new verb contact.faceable {key, faceable}", "contact.own
// goes"; Andy: "agreed to a new verb. \"faceable\"?", "\"faceable\" will do what \"own\" use to do.", "green? then go."
test.run('faceable sets 😏 on a key or takes it off: a key, and true or false', 0.2, function () {
  if (!W.api) return false;
  return (passes('faceable', { key: KEY, faceable: true }) && passes('faceable', { key: KEY, faceable: false }) && refusedAs('faceable', { key: KEY, faceable: 'yes' }) === 'bad-request' && refusedAs('faceable', { key: KEY }) === 'bad-request' && refusedAs('faceable', { key: NOT_KEY, faceable: true }) === 'bad-request') || false;
}, test.limit.quick);
test.run('own is gone', 0.2, function () {
  if (!W.api) return false;
  return !('own' in W.verbs) || false;
}, test.limit.quick);

// THE RELAY VERBS ARE CONTACT VERBS (goal/G49.11, box v9: "each one becomes a contact verb and names the relay by its row's
// public key, as every contact verb does (today they name it by its url)"; Andy: "Get rid of the fucking relay branch").
// The relay is named by key, as get and faceable name a row today; add alone takes the url, since it makes the row.
test.run('add takes a relay\'s address, and a label it may be given', 0.4, function () {
  if (!W.api) return false;
  return (passes('add', { url: 'https://relay.example', label: 'Mine' }) && passes('add', { url: 'https://relay.example' }) && refusedAs('add', { url: 'not a url' }) === 'bad-request' && refusedAs('add', {}) === 'bad-request') || false;
}, test.limit.quick);
test.run('claim names the relay by its key and takes a name; an invite and its label may be left out', 0.4, function () {
  if (!W.api) return false;
  return (passes('claim', { key: KEY, name: 'andy' }) && passes('claim', { key: KEY, name: 'andy', invite: 'abc', inviteLabel: 'Bob' }) && refusedAs('claim', { key: NOT_KEY, name: 'andy' }) === 'bad-request' && !!refusedAs('claim', { url: 'https://relay.example', name: 'andy' })) || false;
}, test.limit.quick);
test.run('face names the relay by its key and takes a face name', 0.4, function () {
  if (!W.api) return false;
  return (passes('face', { key: KEY, name: 'andy' }) && refusedAs('face', { key: NOT_KEY, name: 'andy' }) === 'bad-request' && !!refusedAs('face', { url: 'https://relay.example', name: 'andy' })) || false;
}, test.limit.quick);
test.run('join names the relay by its key and takes an email; a code, and the link the relay mails, may be given', 0.4, function () {
  if (!W.api) return false;
  return (passes('join', { key: KEY, email: 'a@b.example' }) && passes('join', { key: KEY, email: 'a@b.example', code: '123456', link: 'https://relay.example/j' }) && refusedAs('join', { key: NOT_KEY, email: 'a@b.example' }) === 'bad-request' && !!refusedAs('join', { url: 'https://relay.example', email: 'a@b.example' })) || false;
}, test.limit.quick);
test.run('leave names the relay by its key alone', 0.4, function () {
  if (!W.api) return false;
  return (passes('leave', { key: KEY }) && refusedAs('leave', { key: NOT_KEY }) === 'bad-request' && refusedAs('leave', {}) === 'bad-request') || false;
}, test.limit.quick);
// spirit/relay/ holds the relay's own program since goal/G49.12 (box v17: "spirit/relay.js --> spirit/relay/processor/script.js"), so
// the node's relay branch being gone is its api.js and data.js gone, never the folder.
test.run('the node\'s relay branch is gone: no spirit/relay/api.js or data.js, and no product script names them', 0.4, function () {
  const files = require('child_process').execFileSync('git', ['ls-files', '--', '.'], { cwd: RUN, encoding: 'utf8' }).split('\n').filter(Boolean);
  if (files.length < 100) return false;
  const inRelay = files.filter(function (f) { return f === 'spirit/relay/api.js' || f === 'spirit/relay/data.js'; });
  const naming = files.filter(function (f) { return /\.(js|html)$/.test(f) && !/(^|\/)test\//.test(f) && fs.existsSync(path.join(RUN, f)); })
    .filter(function (f) { return /spirit\/relay\/(api|data)\.js/.test(fs.readFileSync(path.join(RUN, f), 'utf8')); });
  return (!inRelay.length && !naming.length) || false;
}, test.limit.quick);
