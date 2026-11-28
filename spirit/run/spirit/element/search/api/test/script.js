'use strict';

// spirit/run/spirit/element/search/api/test/script.js
// The tests of spirit/element/search/api/script.js, and of no other module (spec: ./script.md; goal/G41.14). It was
// apiBranchSelector.js, renamed (Andy: "apiBranchSelector.js will be RENAMED apiFamilySelector.js, which is the proper
// name for it"), its verb half kept (Andy: "apiFamiliySelector.js will use apiVerbSelector as part of itself, because
// the verb selector NEEDs the family selector to have any meaning at all."). The browser file runs in node on a BARE
// window (rule/26): its two halves, the family list search/api/list.js and the verb half search/api/verb.js, are put there real once required;
// probabilitySearch is a stand-in that keeps every list it was asked to make; the node's api tree is the spirit
// object's answer, kept by the spirit branch's client, spirit/client/script.js (goal/G41.28; goal/G49.23 Part 2: the node
// branch's reads are the spirit branch's), as a page's spirit.requireScript('spirit/script.js') hands it, the page's node known as spirit.startPage makes it known (spirit.nodeFacts.key, then
// data.homeNode). One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'script.js')).requireScript('spirit/testicle/headLessChrome/script.js');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/testicle/testReport/script.js');
// ITS STAND-INS ARE requireScript's ANSWERS (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers";
// Andy: "spirit.requireScript must allways return either an object or a function... or fail/throw"): a script answers what
// stands at its place (a folder's script.js at its folder's name), a stand-in or a real file loaded; nothing there is refused.
function placedAnswer(p, w) {
  const keys = String(p).replace(/\.js$/, '').split('/');
  if (keys.length > 1 && keys[keys.length - 1] === 'script') keys.pop();
  // goal/G49.23: on the spirit object itself, its first key spirit the object.
  const at = keys.slice(1).reduce(function (o, k) { return o == null ? undefined : o[k]; }, (w || global.window).spirit);
  if (at && (typeof at === 'object' || typeof at === 'function')) return Promise.resolve(at);
  const no = Promise.reject(new Error('no stand-in for ' + p));
  no.catch(function () {});
  return no;
}
const JS = path.join(__dirname, '..', '..', '..');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/element/search/api/script.js';
const FILE = path.join(RUN, SUBJECT);
const OLD = path.join(JS, 'apiBranchSelector.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

function node(tag) {
  const heard = {};
  const n = { tag: tag, kids: [], style: {}, hidden: false, className: '', innerHTML: '',
    appendChild: function (c) { n.kids.push(c); return c; },
    addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
    dispatchEvent: function (e) { (heard[e.type] || []).slice().forEach(function (fn) { fn(e); }); return true; },
  };
  return n;
}

const TREE = { fs: { search: {}, loadFile: {}, DEBUG: {} }, jobs: { list: {} }, broken: { ok: false } };
const OTHER = { relay: { card: {} } };

function world() {
  const w = { lists: [], required: [] };
  // The two halves run by this stand-in itself, not through spirit.requireScript (goal/G49.6): it records every path the page
  // asks, and a check below judges that no data.js is asked; through requireScript it would not see those asks.
  const real = function (file) { return function (win) { PAGE_LOAD.runAsPage(path.join(JS, file), win); }; };
  const STANDS = {
    'spirit/element/search/script.js': function (win) { const at = win.spirit.element; at.search = Object.assign(at.search || {}, { create: function (host, opts) { const l = { host: host, opts: opts, redrawn: 0, value: '', row: null,
      redraw: function () { l.redrawn += 1; }, refresh: function () {}, destroy: function () {} }; w.lists.push(l); return l; } }); },
    // Its two halves (goal/G43.32): the family list, search/api/list.js, and the verb half, search/api/verb.js.
    'spirit/element/search/api/list/script.js': real('search/api/list/script.js'),
    'spirit/element/search/api/verb/script.js': real('search/api/verb/script.js'),
  };
  const win = {
    // goal/G49.23: an element stands on the spirit object at its path (spirit.element.<...>).
    spirit: { element: {}, escapeHtml: function (s) { return String(s); },
      // What readyPromise answers is the spirit instance itself (goal/G49.6), whose apiTree reads the node's tree.
      readyPromise: Promise.resolve({ apiTree: function () { return Promise.resolve(TREE); } }) },
    document: { createElement: function (t) { return node(t); } },
    Event: function (type) { this.type = type; },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object,
    console: { log: function () {}, error: function () {} },
  };
  // goal/G49.23 Part 2: the api tree is the spirit branch's client's (the real spirit/client/script.js, loaded below).
  win.spirit.requireScript = function (p) { w.required.push(String(p)); if (STANDS[p] && !w['done' + p]) { w['done' + p] = true; STANDS[p](win); } if (Object.prototype.hasOwnProperty.call(ANSWERS, p)) return Promise.resolve(ANSWERS[p]); return placedAnswer(p, win); };
  // What the halves require and this world does not run, as requireScript answers them: the spirit branch (the api tree
  // comes through readyPromise), and the list's row and detail, which no check here opens.
  // goal/G49.23, box v22 Part 2: the spirit branch carries its client (the store, spirit.client) as client, as the loader's
  // branch does, read at each use.
  const ANSWERS = { 'spirit/script.js': Object.defineProperty({}, 'client', { get: function () { return win.spirit.client; } }), 'spirit/element/search/api/row/script.js': { create: function () { return {}; } }, 'spirit/element/search/api/detail/script.js': { create: function () { return {}; } } };
  win.window = win;
  // The page's spirit.requireScript, as spirit.js hands it (spirit/testicle/headLessChrome/script.js pageSpirit).
  LOADER.requireScript('spirit/testicle/headLessChrome/script.js').pageSpirit(win.spirit, null, { window: win, real: ['spirit/client/script.js', 'spirit/fuckingGarbage/apiTreeIndex.js', SUBJECT] });
  vm.createContext(win);
  // The tree index is one of the spirit object's own, there before any element.
  // The page's one data set, which spirit.js brings before any element runs (goal/G41.28: the api tree is kept there).
  win.spirit.requireScript('spirit/client/script.js');
  pageData = win.spirit.client;
  // THE PAGE KNOWS ITS NODE (goal/G41.28): spirit.startPage asks spirit.card, keeps the key and hands it to the data set.
  win.spirit.nodeFacts = { key: 'nOdE+key/one==' };
  pageData.homeNode('nOdE+key/one==');
  win.spirit.requireScript('spirit/fuckingGarbage/apiTreeIndex.js');
  win.spirit.requireScript(SUBJECT);
  w.E = win.spirit.element;
  return w;
}
// What a list offers, as the search element would draw it: the rows of its spirit.client branch (goal/G41.28), or for
// another party's tree, kept out of the node's, the rows it is handed; narrowed by its filters; each by its name.
let pageData = null;
const names = function (l) {
  // goal/G49.23: a list's branch is a handle; its rows are read through it.
  const rows = l.opts.data ? (typeof l.opts.data.rows === 'function' ? l.opts.data.rows() : []) : (typeof l.opts.rows === 'function' ? l.opts.rows() : []);
  return rows.filter(function (r) { return (l.opts.filters || []).every(function (f) { return typeof f.test !== 'function' || f.test(r, undefined) > 0; }); })
    .map(function (r) { return r.name != null ? r.name : r.key; }).sort();
};

// What the world and the tests make, for the tests after them.
let w, made, box, fam, seen, vl, fl, verbBox;

// renamed, the old name gone
test.run('spirit/element/search/api/script.js is there', 0.2, function () {
  return fs.existsSync(FILE) ? true : false;
}, test.limit.quick);
test.run('spirit/element/apiBranchSelector.js is gone, so the rename leaves no copy', 0.2, function () {
  return !fs.existsSync(OLD) ? true : false;
}, test.limit.quick);
test.run('it names no shellCreateListSearch', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  const names = /shellCreateListSearch/.test(fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, ''));
  return !names ? true : false;
}, test.limit.quick);
test.run('it registers apiBranchSelector with a create, and createApiBranchSelector and createApiBranchSelector no more', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  w = world();
  await settle();
  made = w.E.search.api;
  return made && typeof made.create === 'function' && !('createApiFamilySelector' in w.E) && !('createApiBranchSelector' in w.E) ? true : false;
}, test.limit.quick);
test.run('it loads its two halves itself, the branch list search/api/list.js and the verb selector', 0.2, function () {
  if (!made || typeof made.create !== 'function') return false;
  return w.required.indexOf('spirit/element/search/api/list/script.js') !== -1 && w.required.indexOf('spirit/element/search/api/verb/script.js') !== -1 ? true : false;
}, test.limit.quick);
// goal/G47.1, Andy: "every api.js requires it's companion data.js, and is the only script to require that data.js".
test.run('its halves require the spirit branch, spirit/script.js, and no data script', 0.2, function () {
  if (!made || typeof made.create !== 'function') return false;
  return w.required.indexOf('spirit/script.js') !== -1 && !w.required.some(function (p) { return /data\.js$/.test(p); }) ? true : false;
}, test.limit.quick);

// the family, then its verb, side by side
// Box v23: "every element gets a container and appends itself".
test.run('create appends the control to the container it is given and answers it', 0.2, function () {
  if (!made || typeof made.create !== 'function') return false;
  box = node('div');
  fam = made.create(box, { all: 'every family' });
  seen = [];
  fam.addEventListener('change', function () { seen.push(fam.value); });
  return box.kids.length === 1 && box.kids[0] === fam ? true : false;
}, test.limit.quick);
test.run('it draws two probabilitySearch dropdowns', 0.2, async function () {
  if (!fam) return false;
  await settle();
  return w.lists.length === 2 && w.lists.every(function (l) { return l.opts.face === 'dropdown'; }) ? true : false;
}, test.limit.quick);
test.run('it has BRANCH half and a verb half', 0.2, function () {
  if (!fam) return false;
  vl = w.lists.filter(function (l) { return l.opts.all === 'All Verbs'; })[0];
  fl = w.lists.filter(function (l) { return l !== vl; })[0];
  if (vl) verbBox = vl.host;
  return w.lists.length >= 2 && vl && fl ? true : false;
}, test.limit.quick);
test.run('the option all is what the branch half reads when nothing is chosen', 0.2, function () {
  if (!vl || !fl) return false;
  return fl.opts.all === 'every family' ? true : false;
}, test.limit.quick);
test.run('its branches are the tree\'s, one that did not answer left out', 0.2, function () {
  if (!vl || !fl) return false;
  return short(names(fl)) === short(['fs', 'jobs']) ? true : false;
}, test.limit.quick);
test.run('with nothing chosen, the verb half is hidden and branch, verb and value are empty', 0.2, function () {
  if (!vl || !fl) return false;
  return verbBox.hidden === true && fam.family === '' && fam.verb === '' && fam.value === '' ? true : false;
}, test.limit.quick);
test.run('a branch pick sets branch to it and value to the branch alone, with one change', 0.2, function () {
  if (!vl || !fl) return false;
  fl.opts.pick({ key: 'fs', name: 'fs' }, 'fs');
  return fam.family === 'fs' && fam.verb === '' && fam.value === 'fs' && seen[seen.length - 1] === 'fs' ? true : false;
}, test.limit.quick);
test.run('after a branch pick the verb half shows its verbs, DEBUG among them', 0.2, function () {
  if (!vl || !fl) return false;
  // goal/G49.25: DEBUG is offered as any verb (Andy: "the only thing i'd hard-code protect from is ownership change, and the node
  // has no verbs for that", "they go now"; spirit/fuckingGarbage/apiTreeIndex.js offers every verb).
  return verbBox.hidden === false && short(names(vl)) === short(['DEBUG', 'loadFile', 'search']) ? true : false;
}, test.limit.quick);
test.run('a verb pick sets verb to it and value to branch.verb', 0.2, function () {
  if (!vl || !fl) return false;
  vl.opts.pick({ key: 'search', name: 'search' }, 'search');
  return fam.verb === 'search' && fam.value === 'fs.search' ? true : false;
}, test.limit.quick);
test.run('All Verbs picks the empty verb, and value is the branch again', 0.2, function () {
  if (!vl || !fl) return false;
  vl.opts.pick(null, '');
  return fam.verb === '' && fam.value === 'fs' ? true : false;
}, test.limit.quick);
test.run('another branch clears the verb and lists its own verbs', 0.2, function () {
  if (!vl || !fl) return false;
  fl.opts.pick({ key: 'jobs', name: 'jobs' }, 'jobs');
  return fam.family === 'jobs' && fam.verb === '' && short(names(vl)) === short(['list']) ? true : false;
}, test.limit.quick);
// introSpector's deferral, the box: "the only exception is introspector, deferred for network-scope design reasons."
test.run('load lists another party\'s tree, clears the choice and hides the verb half', 0.2, async function () {
  if (!vl || !fl) return false;
  await fam.load(function () { return Promise.resolve(OTHER); }); await settle();
  // The family list is made again for the party's source (its rows, not the node's branch); the newest one is the one drawn.
  const flNow = w.lists.filter(function (l) { return l !== vl; }).pop();
  return fam.family === '' && fam.value === '' && verbBox.hidden === true && short(names(flNow)) === short(['relay']) ? true : false;
}, test.limit.quick);

// AND A PANE (box v123: "every search supports both pane and dropdown; a selector with only one is red (today testicle.js,
// pane only, and api.js, dropdown only)").
let pane, paneList, paneSeen;
test.run("given face pane, it draws the family list alone, as a pane filling its box, and no verb half", 0.2, async function () {
  if (!made || typeof made.create !== 'function') return false;
  const n = w.lists.length;
  const host = node('div');
  pane = made.create(host, { face: 'pane' });
  paneSeen = [];
  pane.addEventListener('change', function () { paneSeen.push(pane.value); });
  await settle();
  const mine = w.lists.slice(n);
  paneList = mine[0] || null;
  return host.kids[0] === pane && mine.length === 1 && paneList.opts.face === 'pane' && / fill( |$)/.test(pane.className) && pane.style.overflow === 'hidden' ? true : false;
}, test.limit.quick);
test.run("in the pane, a family pressed is its family and its value, with one change", 0.2, function () {
  if (!paneList) return false;
  paneList.opts.pick({ key: 'fs', name: 'fs' }, 'fs');
  return pane.family === 'fs' && pane.value === 'fs' && paneSeen.length === 1 && paneSeen[0] === 'fs' ? true : false;
}, test.limit.quick);
test.run("the pane, destroyed, leaves its box", 0.2, function () {
  if (!pane) return false;
  let removed = false;
  pane.parentNode = { removeChild: function (c) { removed = c === pane; } };
  pane.destroy();
  return removed ? true : false;
}, test.limit.quick);
