'use strict';

// spirit/run/shell/js/test/apiBranchSelector.js
// The tests of shell/js/apiBranchSelector.js, and of no other module (spec: ./apiBranchSelector.md; goal/G41.5). Its
// halves (shell/js/appServerSelector.js and shell/js/apiVerbSelector.js, each tested on its own) are loaded real. Both browser files run in node on a window of their own: probabilitySearch is a
// stub that keeps every list it was asked to make, and the node's api tree is the spirit object's answer.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const SERVER_FILE = path.join(__dirname, '..', 'appServerSelector.js');
const VERB_FILE = path.join(__dirname, '..', 'apiVerbSelector.js');
const BRANCH_FILE = path.join(__dirname, '..', 'apiBranchSelector.js');
const SERVER_SRC = fs.readFileSync(SERVER_FILE, 'utf8');
const BRANCH_SRC = fs.readFileSync(BRANCH_FILE, 'utf8');

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
  if (fs.existsSync(VERB_FILE)) vm.runInContext(fs.readFileSync(VERB_FILE, 'utf8'), win, { filename: VERB_FILE });
  vm.runInContext(BRANCH_SRC, win, { filename: BRANCH_FILE });
  w.E = win.spirit.elements;
  return w;
}
const names = function (l) { return (typeof l.opts.rows === 'function' ? l.opts.rows() : []).map(function (r) { return r.key; }); };

test.startTest('apiBranchSelector.js: the api-branch selector');

(async function () {
  test.subHeading('built on probabilitySearch, nothing of the old shell\'s list search (goal/G40.8)');
  ok(!/shellCreateListSearch/.test(BRANCH_SRC), 'apiBranchSelector.js names no shellCreateListSearch', 'apiBranchSelector.js still names it');
  const w = world();
  ok(w.required.indexOf('shell/js/probabilitySearch.js') !== -1, 'it loads probabilitySearch itself (goal/G41.3)', 'required: ' + short(w.required));
  ok(w.required.indexOf('shell/js/appServerSelector.js') !== -1, 'the branch selector loads its server half itself', 'required: ' + short(w.required));
  ok(w.required.indexOf('shell/js/apiVerbSelector.js') !== -1, 'and its verb half, apiVerbSelector, itself', 'required: ' + short(w.required));

  test.subHeading('the branch: server, then verb, side by side');
  const w2 = world();
  const branch = w2.E.createApiBranchSelector({ all: 'all servers' });
  const seen = [];
  branch.addEventListener('change', function () { seen.push(branch.value); });
  await settle();
  ok(w2.lists.length === 2 && w2.lists.every(function (l) { return l.opts.face === 'dropdown'; }), 'it draws two probabilitySearch dropdowns', 'lists: ' + short(w2.lists.map(function (l) { return l.opts.face; })));
  if (w2.lists.length < 2) return;
  const vl = w2.lists.filter(function (l) { return l.opts.all === 'all verbs'; })[0];
  const sv = w2.lists.filter(function (l) { return l !== vl; })[0];
  if (!vl || !sv) { test.fail('no server half and verb half: ' + short(w2.lists.map(function (l) { return l.opts.all; }))); return; }
  const verbBox = vl.host;
  ok(verbBox.hidden === true, 'the verb half hides until a server is chosen', 'verb half hidden: ' + verbBox.hidden);
  sv.opts.pick({ key: 'fs', name: 'fs' }, 'fs');
  ok(branch.server === 'fs' && branch.value === 'fs' && seen[seen.length - 1] === 'fs', 'a server pick: value is the server', 'server ' + branch.server + ', value ' + branch.value);
  ok(verbBox.hidden === false, 'and the verb half shows', 'verb half hidden: ' + verbBox.hidden);
  ok(short(names(vl)) === short(['loadFile', 'search']), 'its verbs, DEBUG never offered', 'verbs: ' + short(names(vl)));
  vl.opts.pick({ key: 'search', name: 'search' }, 'search');
  ok(branch.verb === 'search' && branch.value === 'fs.search', 'a verb pick: value is server.verb', 'value ' + branch.value);
  vl.opts.pick(null, '');
  ok(branch.verb === '' && branch.value === 'fs', 'all verbs: value is the server again', 'value ' + branch.value);
  await branch.load(function () { return Promise.resolve(OTHER); }); await settle();
  ok(branch.server === '' && branch.value === '' && verbBox.hidden === true, 'load clears the choice and hides the verb half', 'server ' + branch.server + ', hidden ' + verbBox.hidden);
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
