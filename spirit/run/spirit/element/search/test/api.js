'use strict';

// spirit/run/spirit/element/search/test/api.js
// The tests of spirit/element/search/api.js, and of no other module (spec: ./api.md; goal/G41.14). It was
// apiBranchSelector.js, renamed (Andy: "apiBranchSelector.js will be RENAMED apiFamilySelector.js, which is the proper
// name for it"), its verb half kept (Andy: "apiFamiliySelector.js will use apiVerbSelector as part of itself, because
// the verb selector NEEDs the family selector to have any meaning at all."). The browser file runs in node on a BARE
// window (rule/26): its two halves, the family list search/api/list.js and the verb half search/api/verb.js, are put there real once required;
// probabilitySearch is a stand-in that keeps every list it was asked to make; the node's api tree is the spirit
// object's answer, kept by the node family's data.js (goal/G41.28), loaded with the node family's api.js, as a page's
// spirit.require('spirit/node/api.js') loads it, the page's node known as spirit.start makes it known (spirit.node.key, then
// data.homeNode). One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const JS = path.join(__dirname, '..', '..');
const FILE = path.join(JS, 'search', 'api.js');
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
  const real = function (file) { return function (win) { vm.runInContext(fs.readFileSync(path.join(JS, file), 'utf8'), win, { filename: file }); }; };
  const STANDS = {
    'spirit/element/search.js': function (win) { const at = win.spirit.element.spirit.element; at.search = Object.assign(at.search || {}, { create: function (host, opts) { const l = { host: host, opts: opts, redrawn: 0, value: '', row: null,
      redraw: function () { l.redrawn += 1; }, refresh: function () {}, destroy: function () {} }; w.lists.push(l); return l; } }); },
    // Its two halves (goal/G43.32): the family list, search/api/list.js, and the verb half, search/api/verb.js.
    'spirit/element/search/api/list.js': real('search/api/list.js'),
    'spirit/element/search/api/verb.js': real('search/api/verb.js'),
  };
  const win = {
    // goal/G43.32: an element stands at spirit.element.<its path>.
    spirit: { element: { spirit: { element: {} } }, escapeHtml: function (s) { return String(s); },
      ready: Promise.resolve({ tree: function () { return Promise.resolve(TREE); } }) },
    document: { createElement: function (t) { return node(t); } },
    Event: function (type) { this.type = type; },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object,
    console: { log: function () {}, error: function () {} },
  };
  // The node family's api.js requires its companion data.js, as the real one does: the real file run once, attaching
  // itself to the data set; the api tree is the node family's (spirit.required.spirit.data.node.data).
  let ran = false;
  win.spirit.require = function (p) { w.required.push(String(p)); if (p === 'spirit/node/api.js' && !ran) { ran = true; vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'node', 'data.js'), 'utf8'), win, { filename: 'spirit/node/data.js' }); } if (STANDS[p] && !w['done' + p]) { w['done' + p] = true; STANDS[p](win); } return Promise.resolve(true); };
  win.window = win;
  // The page's installSpiritElement, as spirit.js hands it (spirit/test/headLessChrome.js pageSpirit).
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(win.spirit);
  vm.createContext(win);
  // The tree index is one of the spirit object's own, there before any element.
  // The page's one data set, which spirit.js brings before any element runs (goal/G41.28: the api tree is kept there).
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), win, { filename: 'data.js' });
  pageData = win.spirit.required.spirit.data;
  // THE PAGE KNOWS ITS NODE (goal/G41.28): spirit.start asks node.card, keeps the key and hands it to the data set.
  win.spirit.node = { key: 'nOdE+key/one==' };
  pageData.homeNode('nOdE+key/one==');
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'client', 'apiTreeIndex.js'), 'utf8'), win, { filename: 'apiTreeIndex.js' });
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  w.E = win.spirit.element.spirit.element;
  return w;
}
// What a list offers, as the search element would draw it: the rows of its spirit.required.spirit.data branch (goal/G41.28), or for
// another party's tree, kept out of the node's, the rows it is handed; narrowed by its filters; each by its name.
let pageData = null;
const names = function (l) {
  const rows = l.opts.data ? (pageData ? pageData.rowsOf(l.opts.data) : []) : (typeof l.opts.rows === 'function' ? l.opts.rows() : []);
  return rows.filter(function (r) { return (l.opts.filters || []).every(function (f) { return typeof f.test !== 'function' || f.test(r, undefined) > 0; }); })
    .map(function (r) { return r.name != null ? r.name : r.key; }).sort();
};

// What the world and the tests make, for the tests after them.
let w, made, box, fam, seen, vl, fl, verbBox;

// renamed, the old name gone
test.run('spirit/element/search/api.js is there', 0.2, function () {
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
  return w.required.indexOf('spirit/element/search/api/list.js') !== -1 && w.required.indexOf('spirit/element/search/api/verb.js') !== -1 ? true : false;
}, test.limit.quick);
// goal/G47.1, Andy: "every api.js requires it's companion data.js, and is the only script to require that data.js".
test.run('its halves require the node branch\'s interface, spirit/node/api.js, and no data script', 0.2, function () {
  if (!made || typeof made.create !== 'function') return false;
  return w.required.indexOf('spirit/node/api.js') !== -1 && !w.required.some(function (p) { return /data\.js$/.test(p); }) ? true : false;
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
test.run('after a branch pick the verb half shows its verbs, and DEBUG is never offered', 0.2, function () {
  if (!vl || !fl) return false;
  return verbBox.hidden === false && short(names(vl)) === short(['loadFile', 'search']) ? true : false;
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
