'use strict';

// spirit/run/spirit/element/search/api/test/list.js
// The tests of spirit/element/search/api/list.js, the family list, the app-server selector of search/api.js until
// goal/G43.32, and of no other module (spec: ./list.md; goal/G41.5). The browser file runs in node on a window of their own: probabilitySearch is a
// stub that keeps every list it was asked to make, and the node's api tree is the spirit object's answer.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const SERVER_FILE = path.join(__dirname, '..', 'list.js');
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
      // A branch's api.js, as a page's: its real companion data.js run on this window, attaching itself to the data set, as
      // the real api.js requires it (goal/G47.1); the api tree is the node branch's (spirit.required.spirit.data.node.data).
      require: function (p) {
        w.required.push(String(p));
        const m = /^spirit\/(.+)\/api\.js$/.exec(String(p));
        const companion = m ? 'spirit/' + m[1] + '/data.js' : '';
        if (companion && fs.existsSync(path.join(RUN, companion))) vm.runInContext(fs.readFileSync(path.join(RUN, companion), 'utf8'), win, { filename: companion });
        return Promise.resolve(true);
      } },
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
  pageData = win.spirit.required.spirit.data;
  // THE PAGE KNOWS ITS NODE (goal/G41.28): spirit.start asks node.card, keeps the key and hands it to the data set.
  win.spirit.node = { key: 'nOdE+key/one==' };
  pageData.homeNode('nOdE+key/one==');
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'client', 'apiTreeIndex.js'), 'utf8'), win, { filename: 'apiTreeIndex.js' });
  vm.runInContext(SERVER_SRC, win, { filename: SERVER_FILE });
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

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let w, made, box, servers, sl;
const changes = [];

// built on probabilitySearch, nothing of the old shell's list search (goal/G40.8)
test.run('list.js names no shellCreateListSearch', 0.2, function () {
  return !/shellCreateListSearch/.test(SERVER_SRC) || false;
}, test.limit.quick);
test.run('it loads probabilitySearch itself', 0.2, function () {
  w = world();
  return w.required.indexOf('spirit/element/search.js') !== -1 ? true : false;
}, test.limit.quick);

// the server half: a probabilitySearch dropdown of the node's families
test.run('it places itself at spirit.element.spirit.element.search.api.list, with a create, and createAppServerSelector no more', 0.2, function () {
  if (!w) return false;
  made = w.E.search.api.list;
  return made && typeof made.create === 'function' && !('createAppServerSelector' in w.E) ? true : false;
}, test.limit.quick);
// Box v23: "every element gets a container and appends itself".
test.run('create appends the control to the container it is given and answers it', 0.2, function () {
  if (!made || typeof made.create !== 'function') return false;
  box = node('div');
  servers = made.create(box, { all: 'all servers' });
  return box.kids.length === 1 && box.kids[0] === servers ? true : false;
}, test.limit.quick);
test.run('it draws one probabilitySearch dropdown', 0.2, async function () {
  if (!servers) return false;
  servers.addEventListener('change', function () { changes.push(servers.value); });
  await settle();
  sl = w.lists[0];
  return !w.old && !!sl && sl.opts.face === 'dropdown' ? true : false;
}, test.limit.quick);
test.run('its None reads what the app names', 0.2, function () {
  if (!sl) return false;
  return sl.opts.all === 'all servers' ? true : false;
}, test.limit.quick);
test.run('its rows are the families that answered, sorted', 0.2, function () {
  if (!sl) return false;
  return short(names(sl)) === short(['fs', 'jobs']) ? true : false;
}, test.limit.quick);
test.run('a pick sets its value and fires change', 0.2, function () {
  if (!sl) return false;
  sl.opts.pick({ key: 'fs', name: 'fs' }, 'fs');
  return servers.value === 'fs' && changes[changes.length - 1] === 'fs' ? true : false;
}, test.limit.quick);
test.run('picking None clears its value', 0.2, function () {
  if (!sl) return false;
  sl.opts.pick(null, '');
  return servers.value === '' ? true : false;
}, test.limit.quick);
// introSpector's deferral, the box: "the only exception is introspector, deferred for network-scope design reasons."
test.run('load lists another party\'s families', 0.2, async function () {
  if (!sl) return false;
  await servers.load(function () { return Promise.resolve(OTHER); }); await settle();
  // The list is made again for the party's source (its rows, not the node's branch); the newest one is the one drawn.
  const now = w.lists[w.lists.length - 1];
  return short(names(now)) === short(['relay']) ? true : false;
}, test.limit.quick);

// THE ELEMENT NAMES SINCE goal/G43.18: a stand-in keyed by its place, 'search.contact' and so on, nested where the page has it.
function nestSearch(o) { Object.keys(o).forEach(function (k) { if (k !== 'search' && k.indexOf('search.') !== 0) return; var v = o[k]; delete o[k]; var ks = k.split('.'); var at = o; ks.slice(0, -1).forEach(function (p) { at = at[p] = at[p] || {}; }); var last = ks[ks.length - 1]; at[last] = Object.assign(at[last] || {}, v); }); return o; }
