'use strict';

// spirit/run/spirit/contact/test/script.js
// The tests of spirit/contact/script.js, and of no other module (spec: ./script.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
// The contact family: the node's book of peers, people and relays in one table (goal/G32.1, goal/G40.11).
// The interface is run as spirit.js runs the text api {family} answers (loadInterface: the text, with module and exports
// alone), each call checked by spirit.js's own check (spirit.checkArgs, its rules spirit.ruleNames), the one the spirit object
// runs before a call leaves. The table the node mounts is the one
// server's, spirit/server/script.js, its loadBranches run as the node boots (goal/G49.25).

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/testicle/testReport/script.js');
const FILE = path.join(__dirname, '..', 'script.js');
require(path.join(RUN, 'spirit', 'script.js'));
const spirit = globalThis.spirit;

const isPlain = function (v) { return v !== null && typeof v === 'object' && !Array.isArray(v); };
// A peer's public key as the key rule takes one, and one it does not.
// A key the node of this tree knows, its own, ID's default (goal/G48.4, Q14: a spirit.type.string.ID is a key the node
// knows; one made up here would be refused).
const KEY = LOADER.requireScript('spirit/type/string/ID/script.js').defaultValue();
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

// THE NODE TAKES EACH VERB'S ARGUMENTS FROM THIS SCRIPT (goal/G49.15, box v23: "the node must use this same script as require to
// validate incoming requests."; goal/G49.25: the one server's loadBranches hands a new-shape branch's verbs to its check with
// the branch's own script.js): the check is handed this script, its node work declares no request of its own, or this
// script's, and the node's check, checkedVerbs in spirit/server/script.js, sets each verb's request to the script's entry and runs
// its handler behind spirit.checkArgs against it.
const CHECKED_VERBS = [
  "request: (branch.verbs && branch.verbs[v]) || verbs[v].request, handler: checkedBy(v, verbs[v].handler)",
  "spirit.checkArgs(name + '.' + verb, branch.verbs[verb],",
];
function takenFromScript(name) {
  const c = W.loaded && W.loaded.checked[name];
  // The branch the check is handed is this script as the loader binds it: its verbs this text's, every one.
  if (!c || !c.branch || !isPlain(c.branch.verbs) || !isPlain(c.verbs)) return false;
  if (JSON.stringify(Object.keys(c.branch.verbs).sort()) !== JSON.stringify(W.names.slice().sort())) return false;
  const src = fs.readFileSync(SERVER, 'utf8');
  if (CHECKED_VERBS.some(function (s) { return src.indexOf(s) === -1; })) return false;
  if (!W.names.length) return false;
  const off = W.names.filter(function (v) {
    const own = c.verbs[v] && c.verbs[v].request;
    // The script the check is handed declares the verb as this text does, and the node work names no other arguments.
    if (!c.verbs[v] || !c.branch.verbs || JSON.stringify(c.branch.verbs[v]) !== JSON.stringify(W.verbs[v])) return true;
    return own !== undefined && JSON.stringify(Object.keys(own).sort()) !== JSON.stringify(Object.keys(W.verbs[v]).sort());
  });
  return off.length === 0 || false;
}

// What the world loads, read by every test after it.
const W = { api: null, verbs: {}, names: [], mounted: null };
// goal/G49.22: the branch's calls are spirit.contact.<verb>, mounted under spirit.contact (was contact).
const call = function (verb, args) { return spirit.checkArgs('spirit.contact.' + verb, W.verbs[verb], args); };
const passes = function (verb, args) { return !!W.verbs[verb] && call(verb, args) === null; };
const refusedAs = function (verb, args) { if (!W.verbs[verb]) return ''; const r = call(verb, args); return r ? r.code : ''; };

// goal/G49.22: spirit/contact/api.js is spirit/contact/script.js, its data.js spirit/contact/client/script.js.
test.run('script.js loads as spirit.js runs it on a page: its text run with module, exports and spirit.requireScript of the page', 0.2, function () {
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
test.run('it asks for its companion client, spirit/contact/client/script.js, and for nothing else', 0.2, function () {
  if (!W.asked) return false;
  return W.asked.length === 1 && W.asked[0] === 'spirit/contact/client/script.js' ? true : false;
}, test.limit.quick);
// goal/G49.25: the one server mounts every trunk branch the fs cache marks; spirit/server/node/script.js is gone.
test.run('the one server, spirit/server/script.js, mounts the contact branch it finds in the fs cache as spirit.contact', 0.2, function () {
  return mounted('spirit.contact').then(function (m) { W.mounted = m; return !!W.mounted || false; }, function () { return false; });
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
// goal/G49.25: the handler's request is no longer its own; the node sets it from this script (takenFromScript, above).
test.run('each verb the node mounts takes its arguments from this script, and checks them', 0.2, function () {
  if (!W.api) return false;
  if (!W.mounted) return false;
  return takenFromScript('spirit.contact');
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
