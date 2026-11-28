'use strict';

// spirit/run/spirit/net/test/api.js
// The tests of spirit/net/api.js, and of no other module (spec: ./api.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// The net family: a fetch the node makes for the page (goal/G32.1).
// The interface is run as spirit.js runs the text api {family} answers (loadInterface: the text, with module and exports
// alone), each call checked by spirit.js's own check (spirit.checkArgs, its rules spirit.ruleNames), the one the spirit object
// runs before a call leaves. The table the node mounts is the one
// server's, spirit/server/script.js, its loadBranches run as the node boots (goal/G49.25).

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
const KEY = 'MCowBQYDK2VwAyEA' + 'netApiTest'.padEnd(43, 'A') + '=';
const NOT_KEY = 'not-a-key';

// THE TABLE THE ONE SERVER MOUNTS (goal/G49.25, box v10: "serveCommon will load the spirit.fs branch explicitly, then load all
// trunk branches, using the fs-cache"): spirit/server/script.js, required, starts nothing and hands out its helpers, among them
// the two the node boots through, loadFs (the fs cache seeded from this tree) and loadBranches (every trunk branch the cache
// marks, each with its node work's verbs, spirit/<branch>/server/script.js). They are run here as the node runs them, with this
// test's own mount and check catching what is handed over, by the name it is mounted under: mounted { <verb>: [<argument>, ...]
// or null when the handler names no request }, and checked { branch, verbs }, what a new-shape branch's check is given. The
// node's own call of loadBranches is read from the server's text (BOOT). The cache's watcher is stopped once all is read.
const SERVER = path.join(RUN, 'spirit', 'server', 'script.js');
const BOOT = 'common.loadBranches({ rootDir: ROOT_DIR, node: branchNode, mount: loopbackVerbs.mount, check: checkedVerbs, root: rootVerbs });';
function loadMounts() {
  const common = spirit.requireScript('spirit/server/script.js');
  const watcher = common.loadFs(RUN, null);
  const out = { names: [], mounted: {}, checked: {} };
  // What the node hands each branch's node work (branchNode): nothing of it is called while the verbs are only declared.
  const node = new Proxy({ rootDir: RUN }, { get: function (o, k) { return typeof k !== 'string' || k === 'then' ? undefined : (k in o ? o[k] : function () { return null; }); } });
  return common.loadBranches({
    rootDir: RUN,
    node: node,
    check: function (name, branch, verbs) { out.checked[name] = { branch: branch, verbs: verbs }; return verbs; },
    mount: function (name, dir, verbs) {
      const table = {};
      Object.keys(verbs || {}).forEach(function (v) { const r = verbs[v] && verbs[v].request; table[v] = isPlain(r) ? Object.keys(r) : null; });
      out.mounted[name] = table;
    },
  }).then(function (names) { out.names = names; return out; }).finally(function () { if (watcher && typeof watcher._stop === 'function') watcher._stop(); });
}
// mounted(name): the table the one server mounts under that name, or null; and the node boots its branches so.
function mounted(name) {
  return loadMounts().then(function (m) {
    W.loaded = m;
    if (fs.readFileSync(SERVER, 'utf8').indexOf(BOOT) === -1) return null;
    return m.names.indexOf(name) !== -1 && isPlain(m.mounted[name]) ? m.mounted[name] : null;
  });
}

// What the world loads, read by every test after it.
const W = { api: null, verbs: {}, names: [], mounted: null };
const call = function (verb, args) { return spirit.checkArgs('net.' + verb, W.verbs[verb], args); };
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
test.run('it asks for its companion data.js, spirit/net/data.js, and for nothing else', 0.2, function () {
  if (!W.asked) return false;
  return W.asked.length === 1 && W.asked[0] === 'spirit/net/data.js' ? true : false;
}, test.limit.quick);
// goal/G49.25: the one server mounts every trunk branch the fs cache marks; spirit/server/node/script.js is gone.
test.run('the one server, spirit/server/script.js, mounts the net branch it finds in the fs cache', 0.2, function () {
  return mounted('net').then(function (m) { W.mounted = m; return !!W.mounted || false; }, function () { return false; });
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
  const bad = [];
  W.names.forEach(function (v) {
    if (!isPlain(W.verbs[v])) { bad.push(v); return; }
    Object.keys(W.verbs[v]).forEach(function (arg) {
      const raw = String(W.verbs[v][arg]);
      const rule = raw.charAt(raw.length - 1) === '?' ? raw.slice(0, -1) : raw;
      // A rule may also name a type by its path (goal/G48.4, the box: "a type identifier is ALWAYS spirit.type.*").
      if ((spirit.ruleNames.indexOf(rule) === -1 && !/^spirit\/type(\/[A-Za-z][A-Za-z0-9]*)+\/script\.js$/.test(rule))) bad.push(v);
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

test.run('fetch takes an http or https address, and nothing else', 0.2, function () {
  if (!W.api) return false;
  return (passes('fetch', { url: 'https://example.com/a' }) && passes('fetch', { url: 'http://example.com' }) && refusedAs('fetch', { url: 'file:///etc/passwd' }) === 'bad-request' && refusedAs('fetch', {}) === 'bad-request') || false;
}, test.limit.quick);
test.run('its method, headers, body and timeoutMs may be left out, each of its kind when given', 0.2, function () {
  if (!W.api) return false;
  const all = { url: 'https://example.com', method: 'POST', headers: { a: 'b' }, body: 'x', timeoutMs: 5000 };
  return (passes('fetch', all) && refusedAs('fetch', { url: 'https://example.com', timeoutMs: '5000' }) === 'bad-request' && refusedAs('fetch', { url: 'https://example.com', headers: [] }) === 'bad-request') || false;
}, test.limit.quick);
