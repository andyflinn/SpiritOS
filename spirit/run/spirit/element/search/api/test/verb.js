'use strict';

// spirit/run/spirit/element/search/api/test/verb.js
// The tests of spirit/element/search/api/verb.js, and of no other module (spec: ./verb.md; goal/G41.5). The browser
// file runs in node on a window of its own: probabilitySearch is a stub that keeps every list it was asked to make; the
// tree index is the real one (spirit/client/apiTreeIndex.js).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'verb.js');

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

const TREE = { fs: { search: {}, loadFile: {}, DEBUG: {} }, jobs: { list: {} } };

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let SRC, w, win, E, made, box, verbs, l, mine, m, N;
const seen = [];
const rows = function () { return (l && typeof l.opts.rows === 'function' ? l.opts.rows() : []).map(function (r) { return r.key; }); };

test.run('spirit/element/search/api/verb.js exists', 0.2, function () {
  return fs.existsSync(FILE) || false;
}, test.limit.quick);
test.run('it names no shellCreateListSearch', 0.2, function () {
  SRC = fs.readFileSync(FILE, 'utf8');
  return !/shellCreateListSearch/.test(SRC) || false;
}, test.limit.quick);

// a shell element of its own, on probabilitySearch
test.run('it adds apiVerbSelector with a create to window.spirit.element, and createApiVerbSelector no more', 0.2, function () {
  if (!SRC) return false;
  // A BARE WINDOW (rule/26): probabilitySearch is on the page only once the selector requires it.
  w = { lists: [], required: [] };
  // goal/G43.32: the stand-in search stands where an element now finds it, spirit.element.spirit.element.search.
  const STAND = function (E) { E.search = Object.assign(E.search || {}, { create: function (host, opts) { const l = { host: host, opts: opts, redrawn: 0,
    redraw: function () { l.redrawn += 1; }, refresh: function () {}, destroy: function () {} }; w.lists.push(l); return l; } }); };
  win = {
    spirit: { escapeHtml: function (s) { return String(s); }, element: {},
      require: function (p) {
        w.required.push(String(p));
        if (p === 'spirit/element/search.js' && !w.stood) { w.stood = true; STAND(((win.spirit.element.spirit = win.spirit.element.spirit || {}).element = win.spirit.element.spirit.element || {})); }
        // A family's cache (goal/G41.28): the node branch's interface brings its data.js, as the real api.js does; it runs
        // on this window over the real data set, from its path.
        if (p === 'spirit/node/api.js') vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'node', 'data.js'), 'utf8'), win, { filename: 'spirit/node/data.js' });
        return Promise.resolve(true);
      } },
    document: { createElement: function (t) { return node(t); } },
    Event: function (type) { this.type = type; },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  // goal/G43.32: verb.js places itself by installSpiritElement; the recorder hands that helper to the page stand-in
  // (spirit/test/headLessChrome.js pageSpirit).
  const recorder = win.spirit.require;
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(win.spirit);
  const pageRequire = win.spirit.require;
  win.spirit.require = function (p) { return /installSpiritElement\.js$/.test(p) ? pageRequire(p) : recorder(p); };
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'client', 'apiTreeIndex.js'), 'utf8'), win, { filename: 'apiTreeIndex.js' });
  // The page's one data set, its node known (goal/G41.28, Q10), as spirit.start leaves it before any element runs.
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), win, { filename: 'data.js' });
  win.spirit.node = { key: 'KEY+VERB/SELECTOR==' };
  win.spirit.required.spirit.data.homeNode(win.spirit.node.key);
  vm.runInContext(SRC, win, { filename: FILE });
  // goal/G43.32: it stands at its path, spirit.element.spirit.element.search.api.verb.
  E = ((win.spirit.element.spirit || {}).element || {});
  made = E.search && E.search.api && E.search.api.verb;
  return made && typeof made.create === 'function' && !('createApiVerbSelector' in E) ? true : false;
}, test.limit.quick);
test.run('it loads probabilitySearch itself', 0.2, function () {
  if (!made || typeof made.create !== 'function') return false;
  return w.required.indexOf('spirit/element/search.js') !== -1 ? true : false;
}, test.limit.quick);
// Box v23: "every element gets a container and appends itself".
test.run('create appends the control to its container and answers it', 0.2, function () {
  if (!made || typeof made.create !== 'function') return false;
  box = node('div');
  verbs = made.create(box, { own: false });
  return box.kids.length === 1 && box.kids[0] === verbs ? true : false;
}, test.limit.quick);
test.run('it draws one probabilitySearch dropdown', 0.2, async function () {
  if (!verbs) return false;
  verbs.addEventListener('change', function () { seen.push(verbs.value); });
  await settle();
  l = w.lists[0];
  return !!l && l.opts.face === 'dropdown' ? true : false;
}, test.limit.quick);
// Andy, goal/G41.14: "the apiVerbSelector element MUST offer a (valid) \"All Verbs\" option at the top, which results in an
// empty string as \"value\"".
test.run('its first option, at the top, reads All Verbs', 0.2, function () {
  if (!l) return false;
  return l.opts.all === 'All Verbs' ? true : false;
}, test.limit.quick);

// another party's tree (own: false), listed from that tree: introSpector's deferral (the box: "the only exception is
// introspector, deferred for network-scope design reasons.")
test.run('with no server it is hidden and lists nothing', 0.2, function () {
  if (!l) return false;
  return verbs.hidden === true && rows().length === 0 ? true : false;
}, test.limit.quick);
test.run('show, given the tree and a server, lists that server\'s verbs and never DEBUG', 0.2, function () {
  if (!l) return false;
  verbs.show(TREE, 'fs');
  return verbs.hidden === false && short(rows()) === short(['loadFile', 'search']) ? true : false;
}, test.limit.quick);
test.run('a pick sets its value and fires change', 0.2, function () {
  if (!l) return false;
  l.opts.pick({ key: 'search', name: 'search' }, 'search');
  return verbs.value === 'search' && seen[seen.length - 1] === 'search' ? true : false;
}, test.limit.quick);
test.run('All Verbs is a valid choice: its value is the empty string, and change says so', 0.2, function () {
  if (!l) return false;
  l.opts.pick(null, '');
  return verbs.value === '' && seen[seen.length - 1] === '' ? true : false;
}, test.limit.quick);
test.run('show with no server hides it and clears the choice', 0.2, function () {
  if (!l) return false;
  l.opts.pick({ key: 'search', name: 'search' }, 'search');
  verbs.show(TREE, '');
  return verbs.hidden === true && verbs.value === '' && rows().length === 0 ? true : false;
}, test.limit.quick);

// this node's own verbs are the node family's cache (goal/G41.28; Andy, Q7: "the family, verb and app-server selectors
// draw from it")
test.run('it requires spirit/node/api.js and no data.js, and its list is a view of the node branch\'s verbs, no rows of its own', 0.2, async function () {
  if (!made || typeof made.create !== 'function') return false;
  mine = made.create(node('div'), {});
  await settle();
  m = w.lists[w.lists.length - 1];
  N = ((win.spirit.required.spirit.data || {}).node || {}).data;
  return w.required.indexOf('spirit/node/api.js') !== -1 && !w.required.some(function (p) { return /data\.js$/.test(p); }) && !!N && m.opts.data === N.verbsBranch && m.opts.rows === undefined ? true : false;
}, test.limit.quick);
test.run('show, given the tree and a server, narrows the kept verbs to that branch\'s and never DEBUG', 0.2, function () {
  if (!N || !m) return false;
  N.keepTree(TREE, win.spirit.required.spirit.client.apiTreeIndex);
  mine.show(TREE, 'fs');
  const kept = win.spirit.required.spirit.data.getPath(N.verbsBranch) || {};
  const fam = (m.opts.filters || []).filter(function (x) { return x.name === 'family'; })[0];
  const shown = Object.keys(kept).filter(function (k) { return fam && fam.test(kept[k]); }).map(function (k) { return kept[k].name; }).sort();
  return !!fam && short(shown) === short(['loadFile', 'search']) && mine.hidden === false ? true : false;
}, test.limit.quick);
