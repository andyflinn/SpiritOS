'use strict';

// spirit/run/spirit/relay/test/api.js
// The tests of spirit/relay/api.js, and of no other module (spec: ./api.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// The relay family: the relays this node is a member of (goal/G32.1), and his relays as a screen wants them (names: status, puppets/G2).
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
const KEY = 'MCowBQYDK2VwAyEA' + 'relayApiTest'.padEnd(43, 'A') + '=';
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
const call = function (verb, args) { return spirit.check('relay.' + verb, W.verbs[verb], args); };
const passes = function (verb, args) { return !!W.verbs[verb] && call(verb, args) === null; };
const refusedAs = function (verb, args) { if (!W.verbs[verb]) return 'no verb ' + verb; const r = call(verb, args); return r ? r.code : 'passed'; };
const NO_API = 'api.js did not load: the world failed';
const NO_MOUNT = 'no table the node mounts for relay was read: the world failed';

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
test.run('the world: server.js mounts the relay family', 0.2, function () {
  try { W.mounted = mounted('relay'); } catch (e) { return 'server.js could not be read: ' + e.message; }
  return !!W.mounted || 'server.js holds no loopbackVerbs.mount(\'relay\', ...)';
}, test.limit.quick);

// its shape: verbs, each argument with its rule, no family name of its own (goal/G32.3: the node maps it)
test.run('it exports its table of verbs and its names, and nothing else: it names no family of its own', 0.2, function () {
  if (!W.api) return NO_API;
  return (Object.keys(W.api).sort().join() === 'names,verbs' && typeof W.api.names === 'function') || 'exports ' + short(Object.keys(W.api));
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

test.run('claim takes the relay\'s address and a name; an invite and its label may be left out', 0.2, function () {
  if (!W.api) return NO_API;
  return (passes('claim', { url: 'https://relay.example', name: 'andy' }) && passes('claim', { url: 'https://relay.example', name: 'andy', invite: 'abc', inviteLabel: 'Bob' }) && refusedAs('claim', { url: 'relay.example', name: 'andy' }) === 'bad-request' && refusedAs('claim', { url: 'https://relay.example' }) === 'bad-request') || 'claim no address ' + refusedAs('claim', { url: 'relay.example', name: 'andy' });
}, test.limit.quick);
test.run('partnerCheck takes a key and an address', 0.2, function () {
  if (!W.api) return NO_API;
  return (passes('partnerCheck', { publicKey: KEY, url: 'https://relay.example' }) && refusedAs('partnerCheck', { publicKey: NOT_KEY, url: 'https://relay.example' }) === 'bad-request') || 'partnerCheck no key ' + refusedAs('partnerCheck', { publicKey: NOT_KEY, url: 'https://relay.example' });
}, test.limit.quick);
test.run('get and remove name the relay by its key, a text', 0.2, function () {
  if (!W.api) return NO_API;
  return (passes('get', { key: 'https://relay.example' }) && passes('remove', { key: 'https://relay.example' }) && refusedAs('get', {}) === 'bad-request' && refusedAs('remove', { key: 1 }) === 'bad-request') || 'get {} ' + refusedAs('get', {});
}, test.limit.quick);
test.run('add takes an address and a label it may be given; face an address and a name', 0.2, function () {
  if (!W.api) return NO_API;
  return (passes('add', { url: 'https://relay.example' }) && passes('add', { url: 'https://relay.example', label: 'home' }) && passes('face', { url: 'https://relay.example', name: 'andy' }) && refusedAs('face', { url: 'https://relay.example' }) === 'bad-request') || 'face without a name ' + refusedAs('face', { url: 'https://relay.example' });
}, test.limit.quick);
// goal/G40.10, Andy: "{email, URL, card}": the caller's link the relay mails, its code and key added
test.run('join takes the relay\'s address and an email; a code, and the link the relay mails, may be given', 0.2, function () {
  if (!W.api) return NO_API;
  return (passes('join', { url: 'https://relay.example', email: 'a@b.c' }) && passes('join', { url: 'https://relay.example', email: 'a@b.c', code: '123', link: 'https://node.example/join' }) && refusedAs('join', { url: 'https://relay.example' }) === 'bad-request' && refusedAs('join', { url: 'https://relay.example', email: 'a@b.c', link: 'node.example/join' }) === 'bad-request') || 'join without an email ' + refusedAs('join', { url: 'https://relay.example' }) + ', a link with no scheme ' + refusedAs('join', { url: 'https://relay.example', email: 'a@b.c', link: 'node.example/join' });
}, test.limit.quick);
// goal/G40.10, Andy: "add the leave verb to node": the seat given up, the relay kept on the list
test.run('leave names the relay by its key alone', 0.2, function () {
  if (!W.api) return NO_API;
  return (passes('leave', { key: 'https://relay.example' }) && refusedAs('leave', {}) === 'bad-request' && refusedAs('leave', { key: 'https://relay.example', url: 'https://relay.example' }) === 'no-such-argument') || 'leave {} ' + refusedAs('leave', {});
}, test.limit.quick);
test.run('record names the relay; from and to are numbers it may be given', 0.2, function () {
  if (!W.api) return NO_API;
  return (passes('record', { relay: 'https://relay.example' }) && passes('record', { relay: 'https://relay.example', from: 1, to: 2 }) && refusedAs('record', { relay: 'https://relay.example', from: '1' }) === 'bad-request') || 'record from \'1\' ' + refusedAs('record', { relay: 'https://relay.example', from: '1' });
}, test.limit.quick);
// goal/G40.11: relay.search went, a relay is a row of the one table
test.run('it has no search: a relay is a row of the one table, contact.search', 0.2, function () {
  if (!W.api) return NO_API;
  return !Object.prototype.hasOwnProperty.call(W.verbs, 'search') || 'relay.search is declared';
}, test.limit.quick);

// ── names: status(name), his relays as a screen wants them (puppets/G2) ──
// A planted spirit object stands as the global while status runs (it asks the one spirit object, never its own family,
// for the search): its contact.search, its cacheManager and the relay family's keep are recorded.
function plant(search) {
  const P = { asked: [], kept: [], manager: [], calls: [] };
  P.spirit = {
    contact: { search: function (a) { P.asked.push(a); return typeof search === 'function' ? search() : Promise.resolve(search); } },
    cacheManager: function (n) { P.manager.push(n); return Promise.resolve({}); },
    data: { relay: { data: { keep: function (got) { P.kept.push(got); } } } },
  };
  return P;
}
async function status(P, gets, name) {
  const was = globalThis.spirit;
  globalThis.spirit = P.spirit;
  try {
    const names = W.api.names(function (verb, args) {
      P.calls.push([verb, args]);
      const got = gets[args && args.key];
      return got instanceof Error ? Promise.reject(got) : Promise.resolve(got);
    });
    return await names.status(name);
  } finally { globalThis.spirit = was; }
}
const A = 'https://a.relay.example';
const B = 'https://b.relay.example';
const C = 'https://c.relay.example';
const GETS = {};
GETS[A] = { ok: true, key: A, relay: { url: A, owned: true }, report: { up: true } };
GETS[B] = { ok: true, key: B, relay: { url: B, claimed: true } };
GETS[C] = new Error('refused');
const S = {};

test.run('the world: status of four relays listed, one owned, one claimed, one whose get is refused, one not ok', 0.2, async function () {
  if (!W.api || typeof W.api.names !== 'function') return NO_API;
  const P = S.P = plant({ ok: true, items: [{ key: A }, { key: B }, { key: C }, { key: 'https://d.relay.example' }], more: true });
  const gets = Object.assign({}, GETS); gets['https://d.relay.example'] = { ok: false, error: 'gone' };
  try { S.out = await status(P, gets, 'andy'); } catch (e) { return 'status threw: ' + e.message; }
  return (!!S.out && !!S.out.body) || 'status answered ' + short(S.out);
}, test.limit.quick);
const NO_STATUS = 'status answered nothing: the world failed';
test.run('status lists the relays with contact.search, relay and keep yes, asked of the one spirit object', 0.2, function () {
  if (!S.out) return NO_STATUS;
  return JSON.stringify(S.P.asked) === JSON.stringify([{ q: '*', relay: 'yes', keep: 'yes' }]) || 'asked ' + short(S.P.asked);
}, test.limit.quick);
test.run('then gets each relay listed by its key, through the family\'s own call, and asks it nothing else', 0.2, function () {
  if (!S.out) return NO_STATUS;
  const verbs = S.P.calls.map(function (c) { return c[0]; });
  const keys = S.P.calls.map(function (c) { return c[1] && c[1].key; });
  return (verbs.every(function (v) { return v === 'get'; }) && JSON.stringify(keys) === JSON.stringify([A, B, C, 'https://d.relay.example'])) || 'called ' + short(S.P.calls);
}, test.limit.quick);
// goal/G41.28: each relay got is kept by the family's own cache manager, spirit.data.relay.data
test.run('each relay got is handed to the relay family\'s cache manager to keep', 0.2, function () {
  if (!S.out) return NO_STATUS;
  return (S.P.manager.indexOf('relay') !== -1 && S.P.kept.indexOf(GETS[A]) !== -1 && S.P.kept.indexOf(GETS[B]) !== -1) || 'manager ' + short(S.P.manager) + ', kept ' + short(S.P.kept);
}, test.limit.quick);
test.run('it answers status 200, the body as its text, under the name it was given', 0.2, function () {
  if (!S.out) return NO_STATUS;
  return (S.out.status === 200 && S.out.text === JSON.stringify(S.out.body) && S.out.body.name === 'andy') || short(S.out);
}, test.limit.quick);
test.run('its rows are the relays got, a refused or not-ok get left out', 0.2, function () {
  if (!S.out) return NO_STATUS;
  return JSON.stringify(S.out.body.rows) === JSON.stringify([GETS[A].relay, GETS[B].relay]) || 'rows ' + short(S.out.body.rows);
}, test.limit.quick);
test.run('ownedUrls are the owned ones, claimedUrls the owned and the claimed', 0.2, function () {
  if (!S.out) return NO_STATUS;
  return (JSON.stringify(S.out.body.ownedUrls) === JSON.stringify([A]) && JSON.stringify(S.out.body.claimedUrls) === JSON.stringify([A, B])) || 'owned ' + short(S.out.body.ownedUrls) + ', claimed ' + short(S.out.body.claimedUrls);
}, test.limit.quick);
test.run('relayStatus holds each report by its relay\'s key, more says the search had more', 0.2, function () {
  if (!S.out) return NO_STATUS;
  return (JSON.stringify(S.out.body.relayStatus) === JSON.stringify({ 'https://a.relay.example': { up: true } }) && S.out.body.more === true) || 'relayStatus ' + short(S.out.body.relayStatus) + ', more ' + S.out.body.more;
}, test.limit.quick);
// "One fact about this node, never a row: it owns more than one relay and has to pick which one it is known by"
test.run('one relay owned: there is nothing to pick', 0.2, function () {
  if (!S.out) return NO_STATUS;
  return S.out.body.mustPick === false || 'mustPick ' + short(S.out.body.mustPick);
}, test.limit.quick);
test.run('two owned: it must pick which one it is known by', 0.2, async function () {
  if (!W.api || typeof W.api.names !== 'function') return NO_API;
  const gets = {}; gets[A] = GETS[A]; gets[B] = { ok: true, key: B, relay: { url: B, owned: true } };
  const out = await status(plant({ ok: true, items: [{ key: A }, { key: B }] }), gets, 'andy');
  return (out && out.body && out.body.mustPick === true && JSON.stringify(out.body.ownedUrls) === JSON.stringify([A, B])) || short(out);
}, test.limit.quick);
test.run('a refused search answers its own status and body', 0.2, async function () {
  if (!W.api || typeof W.api.names !== 'function') return NO_API;
  const e = new Error('off the face'); e.status = 403; e.body = { ok: false, error: 'not-from-the-face' };
  const P = plant(function () { return Promise.reject(e); });
  const out = await status(P, {}, 'andy');
  return (out && out.status === 403 && out.body === e.body && P.calls.length === 0) || short(out);
}, test.limit.quick);
test.run('a search that answers not ok is handed on as it came', 0.2, async function () {
  if (!W.api || typeof W.api.names !== 'function') return NO_API;
  const said = { ok: false, error: 'no-such-family' };
  const P = plant(said);
  const out = await status(P, {}, 'andy');
  return (out && out.status === 200 && out.body === said && out.text === JSON.stringify(said) && P.calls.length === 0) || short(out);
}, test.limit.quick);
