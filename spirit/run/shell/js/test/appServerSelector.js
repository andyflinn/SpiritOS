'use strict';

// spirit/run/shell/js/test/appServerSelector.js
// The tests of shell/js/appServerSelector.js, and of no other module (spec: ./appServerSelector.md; goal/G41.5). The browser file runs in node on a window of their own: probabilitySearch is a
// stub that keeps every list it was asked to make, and the node's api tree is the spirit object's answer.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const SERVER_FILE = path.join(__dirname, '..', 'appServerSelector.js');
const SERVER_SRC = fs.readFileSync(SERVER_FILE, 'utf8');

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

const TREE = { fs: { search: {}, loadFile: {}, DEBUG: {} }, jobs: { list: {} }, broken: { ok: false } };
const OTHER = { relay: { card: {} } };

function world() {
  const w = { lists: [], required: [] };
  const E = {
    probabilitySearch: { create: function (host, opts) { const l = { host: host, opts: opts, redrawn: 0, value: '', row: null,
      redraw: function () { l.redrawn += 1; }, refresh: function () {}, destroy: function () {} }; w.lists.push(l); return l; } },
    shellCreateListSearch: function (host, opts) { w.old = true; return { redraw: function () {}, refresh: function () {} }; },
  };
  const win = {
    spirit: { elements: E, escapeHtml: function (s) { return String(s); },
      ready: Promise.resolve({ tree: function () { return Promise.resolve(TREE); } }),
      require: function (p) { w.required.push(String(p)); return Promise.resolve(true); } },
    document: { createElement: function (t) { return node(t); } },
    Event: function (type) { this.type = type; },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'client', 'apiTreeIndex.js'), 'utf8'), win, { filename: 'apiTreeIndex.js' });
  vm.runInContext(SERVER_SRC, win, { filename: SERVER_FILE });
  w.E = win.spirit.elements;
  return w;
}
const names = function (l) { return (typeof l.opts.rows === 'function' ? l.opts.rows() : []).map(function (r) { return r.key; }); };

test.startTest('appServerSelector.js: the app-server selector');

(async function () {
  test.subHeading('built on probabilitySearch, nothing of the old shell\'s list search (goal/G40.8)');
  ok(!/shellCreateListSearch/.test(SERVER_SRC), 'appServerSelector.js names no shellCreateListSearch', 'appServerSelector.js still names it');
  const w = world();
  ok(w.required.indexOf('shell/js/probabilitySearch.js') !== -1, 'it loads probabilitySearch itself (goal/G41.3)', 'required: ' + short(w.required));

  test.subHeading('the server half: a probabilitySearch dropdown of the node\'s families');
  const changes = [];
  const servers = w.E.createAppServerSelector({ all: 'all servers' });
  servers.addEventListener('change', function () { changes.push(servers.value); });
  await settle();
  const sl = w.lists[0];
  ok(!w.old && !!sl && sl.opts.face === 'dropdown', 'it draws one probabilitySearch dropdown', 'lists: ' + w.lists.length + (w.old ? ', and an old one' : ''));
  if (!sl) return;
  ok(sl.opts.all === 'all servers', 'its None reads what the app names', 'all: ' + sl.opts.all);
  ok(short(names(sl)) === short(['fs', 'jobs']), 'its rows are the families that answered, sorted', 'rows: ' + short(names(sl)));
  sl.opts.pick({ key: 'fs', name: 'fs' }, 'fs');
  ok(servers.value === 'fs' && changes[changes.length - 1] === 'fs', 'a pick sets its value and fires change', 'value ' + servers.value + ', changes ' + short(changes));
  sl.opts.pick(null, '');
  ok(servers.value === '', 'None clears it', 'value ' + servers.value);
  await servers.load(function () { return Promise.resolve(OTHER); }); await settle();
  ok(short(names(sl)) === short(['relay']), 'load(fn) lists another party\'s families', 'rows: ' + short(names(sl)));

}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
