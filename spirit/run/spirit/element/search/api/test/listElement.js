'use strict';

// spirit/run/spirit/element/search/api/test/listElement.js
// The tests of spirit/element/search/api/listElement.js, the family list, the app-server selector of search/api.js until
// goal/G43.32, and of no other module (spec: ./listElement.md; goal/G41.5). The browser file runs in node on a window of their own: probabilitySearch is a
// stub that keeps every list it was asked to make, and the node's api tree is the spirit object's answer.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const SERVER_FILE = path.join(__dirname, '..', 'listElement.js');
const SERVER_SRC = fs.readFileSync(SERVER_FILE, 'utf8');

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
  const E = nestSearch({
    'search': { create: function (host, opts) { const l = { host: host, opts: opts, redrawn: 0, value: '', row: null,
      redraw: function () { l.redrawn += 1; }, refresh: function () {}, destroy: function () {} }; w.lists.push(l); return l; } },
    shellCreateListSearch: function (host, opts) { w.old = true; return { redraw: function () {}, refresh: function () {} }; },
  });
  const win = {
    // goal/G43.32: an element stands at spirit.element.<its path>, its parts there too.
    spirit: { element: { spirit: { element: E } }, escapeHtml: function (s) { return String(s); },
      ready: Promise.resolve({ tree: function () { return Promise.resolve(TREE); } }),
      require: function (p) { w.required.push(String(p)); return Promise.resolve(true); } },
    document: { createElement: function (t) { return node(t); } },
    Event: function (type) { this.type = type; },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  // The page's installSpiritElement, as spirit.js hands it (spirit/test/headLessChrome.js pageSpirit).
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(win.spirit);
  vm.createContext(win);
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
  vm.runInContext(SERVER_SRC, win, { filename: SERVER_FILE });
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

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let w, made, box, servers, sl;
const changes = [];
const NO_W = 'no window: the world failed';
const NO_MADE = 'no list element at spirit.element.spirit.element.search.api.listElement';
const NO_SL = 'the list drew no probabilitySearch';

// built on probabilitySearch, nothing of the old shell's list search (goal/G40.8)
test.run('listElement.js names no shellCreateListSearch', 0.2, function () {
  return !/shellCreateListSearch/.test(SERVER_SRC) || 'listElement.js still names it';
}, 1000);
test.run('it loads probabilitySearch itself (goal/G41.3)', 0.2, function () {
  w = world();
  return w.required.indexOf('spirit/element/search.js') !== -1 ? true : 'required: ' + short(w.required);
}, 1000);

// the server half: a probabilitySearch dropdown of the node's families
test.run('it places itself at spirit.element.spirit.element.search.api.listElement, with a create, and createAppServerSelector no more', 0.2, function () {
  if (!w) return NO_W;
  made = w.E.search.api.listElement;
  return made && typeof made.create === 'function' && !('createAppServerSelector' in w.E) ? true : 'elements: ' + short(Object.keys(w.E));
}, 1000);
// Box v23: "every element gets a container and appends itself".
test.run('create(container, options) appends the control to its container and answers it', 0.2, function () {
  if (!made || typeof made.create !== 'function') return NO_MADE;
  box = node('div');
  servers = made.create(box, { all: 'all servers' });
  return box.kids.length === 1 && box.kids[0] === servers ? true : 'container holds ' + box.kids.length + (box.kids[0] === servers ? ', the control' : ', not the control');
}, 1000);
test.run('it draws one probabilitySearch dropdown', 0.2, async function () {
  if (!servers) return NO_MADE;
  servers.addEventListener('change', function () { changes.push(servers.value); });
  await settle();
  sl = w.lists[0];
  return !w.old && !!sl && sl.opts.face === 'dropdown' ? true : 'lists: ' + w.lists.length + (w.old ? ', and an old one' : '');
}, 1000);
test.run('its None reads what the app names', 0.2, function () {
  if (!sl) return NO_SL;
  return sl.opts.all === 'all servers' ? true : 'all: ' + sl.opts.all;
}, 1000);
test.run('its rows are the families that answered, sorted', 0.2, function () {
  if (!sl) return NO_SL;
  return short(names(sl)) === short(['fs', 'jobs']) ? true : 'rows: ' + short(names(sl));
}, 1000);
test.run('a pick sets its value and fires change', 0.2, function () {
  if (!sl) return NO_SL;
  sl.opts.pick({ key: 'fs', name: 'fs' }, 'fs');
  return servers.value === 'fs' && changes[changes.length - 1] === 'fs' ? true : 'value ' + servers.value + ', changes ' + short(changes);
}, 1000);
test.run('None clears it', 0.2, function () {
  if (!sl) return NO_SL;
  sl.opts.pick(null, '');
  return servers.value === '' ? true : 'value ' + servers.value;
}, 1000);
test.run('load(fn) lists another party\'s families', 0.2, async function () {
  if (!sl) return NO_SL;
  await servers.load(function () { return Promise.resolve(OTHER); }); await settle();
  return short(names(sl)) === short(['relay']) ? true : 'rows: ' + short(names(sl)) + ' (introSpector\'s deferral, the box: "the only exception is introspector, deferred for network-scope design reasons.")';
}, 1000);

// THE ELEMENT NAMES SINCE goal/G43.18: a stand-in keyed by its place, 'search.contact' and so on, nested where the page has it.
function nestSearch(o) { Object.keys(o).forEach(function (k) { if (k !== 'search' && k.indexOf('search.') !== 0) return; var v = o[k]; delete o[k]; var ks = k.split('.'); var at = o; ks.slice(0, -1).forEach(function (p) { at = at[p] = at[p] || {}; }); var last = ks[ks.length - 1]; at[last] = Object.assign(at[last] || {}, v); }); return o; }
