'use strict';

// spirit/run/shell/js/test/apiVerbSelector.js
// The tests of shell/js/apiVerbSelector.js, and of no other module (spec: ./apiVerbSelector.md; goal/G41.5). The browser
// file runs in node on a window of its own: probabilitySearch is a stub that keeps every list it was asked to make; the
// tree index is the real one (spirit/client/apiTreeIndex.js).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'apiVerbSelector.js');

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

const TREE = { fs: { search: {}, loadFile: {}, DEBUG: {}, DEPENDENCIES: {} }, jobs: { list: {} } };

test.startTest('apiVerbSelector.js: the verb dropdown');

(async function () {
  ok(fs.existsSync(FILE), 'shell/js/apiVerbSelector.js exists', 'there is no shell/js/apiVerbSelector.js');
  if (!fs.existsSync(FILE)) return;
  const SRC = fs.readFileSync(FILE, 'utf8');
  ok(!/shellCreateListSearch/.test(SRC), 'it names no shellCreateListSearch (goal/G40.8)', 'it names shellCreateListSearch');

  const w = { lists: [], required: [] };
  const win = {
    spirit: { escapeHtml: function (s) { return String(s); },
      elements: { probabilitySearch: { create: function (host, opts) { const l = { host: host, opts: opts, redrawn: 0,
        redraw: function () { l.redrawn += 1; }, refresh: function () {}, destroy: function () {} }; w.lists.push(l); return l; } } },
      require: function (p) { w.required.push(String(p)); return Promise.resolve(true); } },
    document: { createElement: function (t) { return node(t); } },
    Event: function (type) { this.type = type; },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'client', 'apiTreeIndex.js'), 'utf8'), win, { filename: 'apiTreeIndex.js' });
  vm.runInContext(SRC, win, { filename: FILE });
  const E = win.spirit.elements;

  test.subHeading('a shell element of its own, on probabilitySearch');
  ok(typeof E.createApiVerbSelector === 'function', 'it adds createApiVerbSelector to window.spirit.elements', 'elements: ' + short(Object.keys(E)));
  if (typeof E.createApiVerbSelector !== 'function') return;
  ok(w.required.indexOf('shell/js/probabilitySearch.js') !== -1, 'it loads probabilitySearch itself (goal/G41.3)', 'required: ' + short(w.required));
  const verbs = E.createApiVerbSelector({});
  const seen = [];
  verbs.addEventListener('change', function () { seen.push(verbs.value); });
  await settle();
  const l = w.lists[0];
  ok(!!l && l.opts.face === 'dropdown', 'it draws one probabilitySearch dropdown', 'lists: ' + short(w.lists.map(function (x) { return x.opts.face; })));
  if (!l) return;
  ok(l.opts.all === 'all verbs', 'its None reads all verbs', 'all: ' + l.opts.all);
  const rows = function () { return (typeof l.opts.rows === 'function' ? l.opts.rows() : []).map(function (r) { return r.key; }); };

  test.subHeading('one server\'s verbs');
  ok(verbs.hidden === true && rows().length === 0, 'with no server it is hidden and lists nothing', 'hidden ' + verbs.hidden + ', rows ' + short(rows()));
  verbs.show(TREE, 'fs');
  ok(verbs.hidden === false && short(rows()) === short(['loadFile', 'search']), 'show(tree, server) lists that server\'s verbs, DEBUG and DEPENDENCIES never', 'hidden ' + verbs.hidden + ', rows ' + short(rows()));
  l.opts.pick({ key: 'search', name: 'search' }, 'search');
  ok(verbs.value === 'search' && seen[seen.length - 1] === 'search', 'a pick sets its value and fires change', 'value ' + verbs.value + ', seen ' + short(seen));
  l.opts.pick(null, '');
  ok(verbs.value === '', 'None means all verbs: its value is empty', 'value ' + verbs.value);
  l.opts.pick({ key: 'search', name: 'search' }, 'search');
  verbs.show(TREE, '');
  ok(verbs.hidden === true && verbs.value === '' && rows().length === 0, 'show with no server hides it and clears the choice', 'hidden ' + verbs.hidden + ', value ' + verbs.value);
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
