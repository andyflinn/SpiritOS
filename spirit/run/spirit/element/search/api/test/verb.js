'use strict';

// spirit/run/spirit/element/search/api/test/verb.js
// The tests of spirit/element/search/api/verb.js, and of no other module (spec: ./apiVerbSelector.md; goal/G41.5). The browser
// file runs in node on a window of its own: probabilitySearch is a stub that keeps every list it was asked to make; the
// tree index is the real one (spirit/client/apiTreeIndex.js).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'verb.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
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

test.startTest('apiVerbSelector.js: the verb dropdown');

(async function () {
  ok(fs.existsSync(FILE), 'spirit/element/search/api/verb.js exists', 'there is no spirit/element/search/api/verb.js');
  if (!fs.existsSync(FILE)) return;
  const SRC = fs.readFileSync(FILE, 'utf8');
  ok(!/shellCreateListSearch/.test(SRC), 'it names no shellCreateListSearch (goal/G40.8)', 'it names shellCreateListSearch');

  // A BARE WINDOW (rule/26): probabilitySearch is on the page only once the selector requires it.
  const w = { lists: [], required: [] };
  const STAND = function (E) { E.probabilitySearch = { create: function (host, opts) { const l = { host: host, opts: opts, redrawn: 0,
    redraw: function () { l.redrawn += 1; }, refresh: function () {}, destroy: function () {} }; w.lists.push(l); return l; } }; };
  const win = {
    spirit: { escapeHtml: function (s) { return String(s); }, element: {},
      require: function (p) { w.required.push(String(p)); if (p === 'spirit/element/search.js' && !w.stood) { w.stood = true; STAND(win.spirit.element); } return Promise.resolve(true); },
      // A family's cache (goal/G41.28): the family's own manager, run on this window over the real data set.
      cacheManager: function (name) {
        w.managers = (w.managers || []).concat(name);
        vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', String(name), 'data.js'), 'utf8'), win, { filename: name + '/data.js' });
        return Promise.resolve(true);
      } },
    document: { createElement: function (t) { return node(t); } },
    Event: function (type) { this.type = type; },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'client', 'apiTreeIndex.js'), 'utf8'), win, { filename: 'apiTreeIndex.js' });
  // The page's one data set, its node known (goal/G41.28, Q10), as spirit.start leaves it before any element runs.
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), win, { filename: 'data.js' });
  win.spirit.node = { key: 'KEY+VERB/SELECTOR==' };
  win.spirit.data.homeNode(win.spirit.node.key);
  vm.runInContext(SRC, win, { filename: FILE });
  const E = win.spirit.element;

  test.subHeading('a shell element of its own, on probabilitySearch');
  const made = E.apiVerbSelector;
  ok(made && typeof made.create === 'function' && !('createApiVerbSelector' in E), 'it adds apiVerbSelector with a create to window.spirit.element, and createApiVerbSelector no more', 'elements: ' + short(Object.keys(E)));
  if (!made || typeof made.create !== 'function') return;
  ok(w.required.indexOf('spirit/element/search.js') !== -1, 'it loads probabilitySearch itself (goal/G41.3)', 'required: ' + short(w.required));
  // Box v23: "every element gets a container and appends itself".
  const box = node('div');
  const verbs = made.create(box, { own: false });
  ok(box.kids.length === 1 && box.kids[0] === verbs, 'create(container, options) appends the control to its container and answers it', 'container holds ' + box.kids.length + (box.kids[0] === verbs ? ', the control' : ', not the control'));
  const seen = [];
  verbs.addEventListener('change', function () { seen.push(verbs.value); });
  await settle();
  const l = w.lists[0];
  ok(!!l && l.opts.face === 'dropdown', 'it draws one probabilitySearch dropdown', 'lists: ' + short(w.lists.map(function (x) { return x.opts.face; })));
  if (!l) return;
  // Andy, goal/G41.14: "the apiVerbSelector element MUST offer a (valid) \"All Verbs\" option at the top, which results in an
  // empty string as \"value\"".
  ok(l.opts.all === 'All Verbs', 'its first option, at the top, reads All Verbs', 'all: ' + l.opts.all);
  const rows = function () { return (typeof l.opts.rows === 'function' ? l.opts.rows() : []).map(function (r) { return r.key; }); };

  test.subHeading('another party\'s tree (own: false), listed from that tree: introSpector\'s deferral (the box: "the only exception is introspector, deferred for network-scope design reasons.")');
  ok(verbs.hidden === true && rows().length === 0, 'with no server it is hidden and lists nothing', 'hidden ' + verbs.hidden + ', rows ' + short(rows()));
  verbs.show(TREE, 'fs');
  ok(verbs.hidden === false && short(rows()) === short(['loadFile', 'search']), 'show(tree, server) lists that server\'s verbs, DEBUG never', 'hidden ' + verbs.hidden + ', rows ' + short(rows()));
  l.opts.pick({ key: 'search', name: 'search' }, 'search');
  ok(verbs.value === 'search' && seen[seen.length - 1] === 'search', 'a pick sets its value and fires change', 'value ' + verbs.value + ', seen ' + short(seen));
  l.opts.pick(null, '');
  ok(verbs.value === '' && seen[seen.length - 1] === '', 'All Verbs is a valid choice: its value is the empty string, and change says so', 'value ' + verbs.value + ', seen ' + short(seen));
  l.opts.pick({ key: 'search', name: 'search' }, 'search');
  verbs.show(TREE, '');
  ok(verbs.hidden === true && verbs.value === '' && rows().length === 0, 'show with no server hides it and clears the choice', 'hidden ' + verbs.hidden + ', value ' + verbs.value);

  test.subHeading('this node\'s own verbs are the node family\'s cache (goal/G41.28; Andy, Q7: "the family, verb and app-server selectors draw from it")');
  const mine = made.create(node('div'), {});
  await settle();
  const m = w.lists[w.lists.length - 1];
  const N = ((win.spirit.data || {}).node || {}).data;
  ok((w.managers || []).indexOf('node') !== -1 && !!N && m.opts.data === N.verbsBranch && m.opts.rows === undefined, 'it loads the node manager, and its list is a view of ((spirit.data || {}).node || {}).data\'s verbs, no rows of its own', 'managers ' + short(w.managers) + ', data ' + short(m.opts.data) + ', rows ' + typeof m.opts.rows);
  N.keepTree(TREE, win.spirit.apiTreeIndex);
  mine.show(TREE, 'fs');
  const kept = win.spirit.data.getPath(N.verbsBranch) || {};
  const fam = (m.opts.filters || []).filter(function (x) { return x.name === 'family'; })[0];
  const shown = Object.keys(kept).filter(function (k) { return fam && fam.test(kept[k]); }).map(function (k) { return kept[k].name; }).sort();
  ok(!!fam && short(shown) === short(['loadFile', 'search']) && mine.hidden === false, 'show(tree, server) narrows the kept verbs to that family\'s, DEBUG never', 'shown ' + short(shown) + ', hidden ' + mine.hidden);
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
