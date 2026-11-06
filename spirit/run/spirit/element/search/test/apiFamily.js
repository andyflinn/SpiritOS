'use strict';

// spirit/run/spirit/element/search/test/apiFamily.js
// The tests of spirit/element/search/api.js, and of no other module (spec: ./apiFamilySelector.md; goal/G41.14). It was
// apiBranchSelector.js, renamed (Andy: "apiBranchSelector.js will be RENAMED apiFamilySelector.js, which is the proper
// name for it"), its verb half kept (Andy: "apiFamiliySelector.js will use apiVerbSelector as part of itself, because
// the verb selector NEEDs the family selector to have any meaning at all."). The browser file runs in node on a BARE
// window (rule/26): its two halves, appServerSelector.js and apiVerbSelector.js, are put there real once required;
// probabilitySearch is a stand-in that keeps every list it was asked to make; the node's api tree is the spirit
// object's answer, kept by the node family's data.js (goal/G41.28), loaded as a page's
// spirit.cacheManager('node') loads it, the page's node known as spirit.start makes it known (spirit.node.key, then
// data.home).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const JS = path.join(__dirname, '..', '..');
const FILE = path.join(JS, 'apiFamilySelector.js');
const OLD = path.join(JS, 'apiBranchSelector.js');

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
  const real = function (file) { return function (win) { vm.runInContext(fs.readFileSync(path.join(JS, file), 'utf8'), win, { filename: file }); }; };
  const STANDS = {
    'spirit/element/search.js': function (win) { win.spirit.element.probabilitySearch = { create: function (host, opts) { const l = { host: host, opts: opts, redrawn: 0, value: '', row: null,
      redraw: function () { l.redrawn += 1; }, refresh: function () {}, destroy: function () {} }; w.lists.push(l); return l; } }; },
    'spirit/element/search/api.js': real('appServerSelector.js'),
    'spirit/element/search/api/verb.js': real('apiVerbSelector.js'),
  };
  const win = {
    spirit: { element: {}, escapeHtml: function (s) { return String(s); },
      ready: Promise.resolve({ tree: function () { return Promise.resolve(TREE); } }) },
    document: { createElement: function (t) { return node(t); } },
    Event: function (type) { this.type = type; },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object,
    console: { log: function () {}, error: function () {} },
  };
  win.spirit.require = function (p) { w.required.push(String(p)); if (STANDS[p] && !w['done' + p]) { w['done' + p] = true; STANDS[p](win); } return Promise.resolve(true); };
  win.window = win;
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
  w.E = win.spirit.element;
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

test.startTest('apiFamilySelector.js: the family selector, its verb half with it');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  test.subHeading('renamed, the old name gone');
  ok(fs.existsSync(FILE), 'spirit/element/search/api.js is there', 'there is no spirit/element/search/api.js');
  ok(!fs.existsSync(OLD), 'spirit/element/apiBranchSelector.js is not: the rename leaves no copy', 'spirit/element/apiBranchSelector.js is still there');
  if (!fs.existsSync(FILE)) return;
  ok(!/shellCreateListSearch/.test(fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '')), 'it names no shellCreateListSearch (goal/G40.8)', 'it names shellCreateListSearch');
  const w = world();
  await settle();
  const made = w.E.apiFamilySelector;
  ok(made && typeof made.create === 'function' && !('createApiFamilySelector' in w.E) && !('createApiBranchSelector' in w.E),
    'it registers apiFamilySelector with a create, and createApiFamilySelector and createApiBranchSelector no more', 'elements: ' + short(Object.keys(w.E)));
  if (!made || typeof made.create !== 'function') return;
  ok(w.required.indexOf('spirit/element/search/api.js') !== -1 && w.required.indexOf('spirit/element/search/api/verb.js') !== -1,
    'it loads its two halves itself (rule/26): the family dropdown, appServerSelector, and the verb selector', 'required: ' + short(w.required));

  test.subHeading('the family, then its verb, side by side');
  // Box v23: "every element gets a container and appends itself".
  const box = node('div');
  const fam = made.create(box, { all: 'every family' });
  ok(box.kids.length === 1 && box.kids[0] === fam, 'create(container, options) appends the control to its container and answers it', 'container holds ' + box.kids.length + (box.kids[0] === fam ? ', the control' : ', not the control'));
  const seen = [];
  fam.addEventListener('change', function () { seen.push(fam.value); });
  await settle();
  ok(w.lists.length === 2 && w.lists.every(function (l) { return l.opts.face === 'dropdown'; }), 'it draws two probabilitySearch dropdowns', 'lists: ' + short(w.lists.map(function (l) { return l.opts.face; })));
  if (w.lists.length < 2) return;
  const vl = w.lists.filter(function (l) { return l.opts.all === 'All Verbs'; })[0];
  const fl = w.lists.filter(function (l) { return l !== vl; })[0];
  if (!vl || !fl) { test.fail('no family half and verb half: ' + short(w.lists.map(function (l) { return l.opts.all; }))); return; }
  ok(fl.opts.all === 'every family', 'options.all is what the family half reads unchosen', 'all: ' + short(fl.opts.all));
  ok(short(names(fl)) === short(['fs', 'jobs']), 'its families are the tree\'s, one that did not answer left out', 'families: ' + short(names(fl)));
  const verbBox = vl.host;
  ok(verbBox.hidden === true && fam.family === '' && fam.verb === '' && fam.value === '', 'nothing chosen: the verb half hidden; family, verb and value \'\'', 'hidden ' + verbBox.hidden + ', ' + short({ family: fam.family, verb: fam.verb, value: fam.value }));
  fl.opts.pick({ key: 'fs', name: 'fs' }, 'fs');
  ok(fam.family === 'fs' && fam.verb === '' && fam.value === 'fs' && seen[seen.length - 1] === 'fs', 'a family pick: family is it, value the family alone, one change', 'family ' + fam.family + ', value ' + fam.value);
  ok(verbBox.hidden === false && short(names(vl)) === short(['loadFile', 'search']), 'and the verb half shows its verbs, DEBUG never offered', 'hidden ' + verbBox.hidden + ', verbs ' + short(names(vl)));
  vl.opts.pick({ key: 'search', name: 'search' }, 'search');
  ok(fam.verb === 'search' && fam.value === 'fs.search', 'a verb pick: verb is it, value family.verb', 'verb ' + fam.verb + ', value ' + fam.value);
  vl.opts.pick(null, '');
  ok(fam.verb === '' && fam.value === 'fs', 'All Verbs: the empty verb, value the family again', 'verb ' + short(fam.verb) + ', value ' + fam.value);
  fl.opts.pick({ key: 'jobs', name: 'jobs' }, 'jobs');
  ok(fam.family === 'jobs' && fam.verb === '' && short(names(vl)) === short(['list']), 'another family clears the verb and lists its own verbs', 'family ' + fam.family + ', verb ' + short(fam.verb) + ', verbs ' + short(names(vl)));
  await fam.load(function () { return Promise.resolve(OTHER); }); await settle();
  ok(fam.family === '' && fam.value === '' && verbBox.hidden === true && short(names(fl)) === short(['relay']), 'load lists another party\'s tree, clears the choice and hides the verb half', 'family ' + fam.family + ', hidden ' + verbBox.hidden + ' (introSpector\'s deferral, the box: "the only exception is introspector, deferred for network-scope design reasons.")');
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
