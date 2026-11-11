'use strict';

// spirit/run/spirit/element/search/test/api.js
// The tests of spirit/element/search/api.js, and of no other module (spec: ./api.md; goal/G41.14). It was
// apiBranchSelector.js, renamed (Andy: "apiBranchSelector.js will be RENAMED apiFamilySelector.js, which is the proper
// name for it"), its verb half kept (Andy: "apiFamiliySelector.js will use apiVerbSelector as part of itself, because
// the verb selector NEEDs the family selector to have any meaning at all."). The browser file runs in node on a BARE
// window (rule/26): its two halves, the family list search/api/listElement.js and the verb half search/api/verb.js, are put there real once required;
// probabilitySearch is a stand-in that keeps every list it was asked to make; the node's api tree is the spirit
// object's answer, kept by the node family's data.js (goal/G41.28), loaded as a page's
// spirit.cacheManager('node') loads it, the page's node known as spirit.start makes it known (spirit.node.key, then
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
    // Its two halves (goal/G43.32): the family list, search/api/listElement.js, and the verb half, search/api/verb.js.
    'spirit/element/search/api/listElement.js': real('search/api/listElement.js'),
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
  win.spirit.require = function (p) { w.required.push(String(p)); if (STANDS[p] && !w['done' + p]) { w['done' + p] = true; STANDS[p](win); } return Promise.resolve(true); };
  win.window = win;
  // The page's installSpiritElement, as spirit.js hands it (spirit/test/headLessChrome.js pageSpirit).
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(win.spirit);
  vm.createContext(win);
  // The tree index is one of the spirit object's own, there before any element.
  // The page's one data set, which spirit.js brings before any element runs (goal/G41.28: the api tree is kept there).
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), win, { filename: 'data.js' });
  pageData = win.spirit.data;
  // THE PAGE KNOWS ITS NODE (goal/G41.28): spirit.start asks node.card, keeps the key and hands it to the data set.
  win.spirit.node = { key: 'nOdE+key/one==' };
  pageData.homeNode('nOdE+key/one==');
  // spirit.cacheManager(name), as a page's: the family's manager loaded once, attaching itself to the data set; the api
  // tree is the node family's (spirit.data.node.data).
  w.managers = [];
  win.spirit.cacheManager = function (name) {
    w.managers.push(String(name));
    vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', String(name), 'data.js'), 'utf8'), win, { filename: name + '/data.js' });
    return Promise.resolve(true);
  };
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'client', 'apiTreeIndex.js'), 'utf8'), win, { filename: 'apiTreeIndex.js' });
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  w.E = win.spirit.element.spirit.element;
  return w;
}
// What a list offers, as the search element would draw it: the rows of its spirit.data branch (goal/G41.28), or for
// another party's tree, kept out of the node's, the rows it is handed; narrowed by its filters; each by its name.
let pageData = null;
const names = function (l) {
  const rows = l.opts.data ? (pageData ? pageData.rowsOf(l.opts.data) : []) : (typeof l.opts.rows === 'function' ? l.opts.rows() : []);
  return rows.filter(function (r) { return (l.opts.filters || []).every(function (f) { return typeof f.test !== 'function' || f.test(r, undefined) > 0; }); })
    .map(function (r) { return r.name != null ? r.name : r.key; }).sort();
};

// What the world and the tests make, for the tests after them.
let w, made, box, fam, seen, vl, fl, verbBox;
const NO_MADE = 'no apiFamilySelector with a create: the world failed';
const NO_HALVES = 'no family half and verb half';

// renamed, the old name gone
test.run('spirit/element/search/api.js is there', 0.2, function () {
  return fs.existsSync(FILE) ? true : 'there is no spirit/element/search/api.js';
}, 1000);
test.run('spirit/element/apiBranchSelector.js is not: the rename leaves no copy', 0.2, function () {
  return !fs.existsSync(OLD) ? true : 'spirit/element/apiBranchSelector.js is still there';
}, 1000);
test.run('it names no shellCreateListSearch (goal/G40.8)', 0.2, function () {
  if (!fs.existsSync(FILE)) return 'there is no spirit/element/search/api.js';
  const names = /shellCreateListSearch/.test(fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, ''));
  return !names ? true : 'it names shellCreateListSearch';
}, 1000);
test.run('it registers apiFamilySelector with a create, and createApiFamilySelector and createApiBranchSelector no more', 0.2, async function () {
  if (!fs.existsSync(FILE)) return 'there is no spirit/element/search/api.js';
  w = world();
  await settle();
  made = w.E.search.api;
  return made && typeof made.create === 'function' && !('createApiFamilySelector' in w.E) && !('createApiBranchSelector' in w.E) ? true : 'elements: ' + short(Object.keys(w.E));
}, 1000);
test.run('it loads its two halves itself (rule/26): the family list, search/api/listElement.js, and the verb selector', 0.2, function () {
  if (!made || typeof made.create !== 'function') return NO_MADE;
  return w.required.indexOf('spirit/element/search/api/listElement.js') !== -1 && w.required.indexOf('spirit/element/search/api/verb.js') !== -1 ? true : 'required: ' + short(w.required);
}, 1000);

// the family, then its verb, side by side
// Box v23: "every element gets a container and appends itself".
test.run('create(container, options) appends the control to its container and answers it', 0.2, function () {
  if (!made || typeof made.create !== 'function') return NO_MADE;
  box = node('div');
  fam = made.create(box, { all: 'every family' });
  seen = [];
  fam.addEventListener('change', function () { seen.push(fam.value); });
  return box.kids.length === 1 && box.kids[0] === fam ? true : 'container holds ' + box.kids.length + (box.kids[0] === fam ? ', the control' : ', not the control');
}, 1000);
test.run('it draws two probabilitySearch dropdowns', 0.2, async function () {
  if (!fam) return NO_MADE;
  await settle();
  return w.lists.length === 2 && w.lists.every(function (l) { return l.opts.face === 'dropdown'; }) ? true : 'lists: ' + short(w.lists.map(function (l) { return l.opts.face; }));
}, 1000);
test.run('the world: a family half and a verb half', 0.2, function () {
  if (!fam) return NO_MADE;
  vl = w.lists.filter(function (l) { return l.opts.all === 'All Verbs'; })[0];
  fl = w.lists.filter(function (l) { return l !== vl; })[0];
  if (vl) verbBox = vl.host;
  return w.lists.length >= 2 && vl && fl ? true : 'no family half and verb half: ' + short(w.lists.map(function (l) { return l.opts.all; }));
}, 1000);
test.run('options.all is what the family half reads unchosen', 0.2, function () {
  if (!vl || !fl) return NO_HALVES;
  return fl.opts.all === 'every family' ? true : 'all: ' + short(fl.opts.all);
}, 1000);
test.run('its families are the tree\'s, one that did not answer left out', 0.2, function () {
  if (!vl || !fl) return NO_HALVES;
  return short(names(fl)) === short(['fs', 'jobs']) ? true : 'families: ' + short(names(fl));
}, 1000);
test.run('nothing chosen: the verb half hidden; family, verb and value \'\'', 0.2, function () {
  if (!vl || !fl) return NO_HALVES;
  return verbBox.hidden === true && fam.family === '' && fam.verb === '' && fam.value === '' ? true : 'hidden ' + verbBox.hidden + ', ' + short({ family: fam.family, verb: fam.verb, value: fam.value });
}, 1000);
test.run('a family pick: family is it, value the family alone, one change', 0.2, function () {
  if (!vl || !fl) return NO_HALVES;
  fl.opts.pick({ key: 'fs', name: 'fs' }, 'fs');
  return fam.family === 'fs' && fam.verb === '' && fam.value === 'fs' && seen[seen.length - 1] === 'fs' ? true : 'family ' + fam.family + ', value ' + fam.value;
}, 1000);
test.run('and the verb half shows its verbs, DEBUG never offered', 0.2, function () {
  if (!vl || !fl) return NO_HALVES;
  return verbBox.hidden === false && short(names(vl)) === short(['loadFile', 'search']) ? true : 'hidden ' + verbBox.hidden + ', verbs ' + short(names(vl));
}, 1000);
test.run('a verb pick: verb is it, value family.verb', 0.2, function () {
  if (!vl || !fl) return NO_HALVES;
  vl.opts.pick({ key: 'search', name: 'search' }, 'search');
  return fam.verb === 'search' && fam.value === 'fs.search' ? true : 'verb ' + fam.verb + ', value ' + fam.value;
}, 1000);
test.run('All Verbs: the empty verb, value the family again', 0.2, function () {
  if (!vl || !fl) return NO_HALVES;
  vl.opts.pick(null, '');
  return fam.verb === '' && fam.value === 'fs' ? true : 'verb ' + short(fam.verb) + ', value ' + fam.value;
}, 1000);
test.run('another family clears the verb and lists its own verbs', 0.2, function () {
  if (!vl || !fl) return NO_HALVES;
  fl.opts.pick({ key: 'jobs', name: 'jobs' }, 'jobs');
  return fam.family === 'jobs' && fam.verb === '' && short(names(vl)) === short(['list']) ? true : 'family ' + fam.family + ', verb ' + short(fam.verb) + ', verbs ' + short(names(vl));
}, 1000);
test.run('load lists another party\'s tree, clears the choice and hides the verb half', 0.2, async function () {
  if (!vl || !fl) return NO_HALVES;
  await fam.load(function () { return Promise.resolve(OTHER); }); await settle();
  return fam.family === '' && fam.value === '' && verbBox.hidden === true && short(names(fl)) === short(['relay']) ? true
    : 'family ' + fam.family + ', hidden ' + verbBox.hidden + ' (introSpector\'s deferral, the box: "the only exception is introspector, deferred for network-scope design reasons.")';
}, 1000);
