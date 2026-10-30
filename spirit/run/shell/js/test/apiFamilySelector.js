'use strict';

// spirit/run/shell/js/test/apiFamilySelector.js
// The tests of shell/js/apiFamilySelector.js, and of no other module (spec: ./apiFamilySelector.md; goal/G41.14). It was
// apiBranchSelector.js, renamed (Andy: "apiBranchSelector.js will be RENAMED apiFamilySelector.js, which is the proper
// name for it"), its verb half kept (Andy: "apiFamiliySelector.js will use apiVerbSelector as part of itself, because
// the verb selector NEEDs the family selector to have any meaning at all."). The browser file runs in node on a BARE
// window (rule/26): its two halves, appServerSelector.js and apiVerbSelector.js, are put there real once required;
// probabilitySearch is a stand-in that keeps every list it was asked to make; the node's api tree is the spirit
// object's answer.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const JS = path.join(__dirname, '..');
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
    'shell/js/probabilitySearch.js': function (win) { win.spirit.elements.probabilitySearch = { create: function (host, opts) { const l = { host: host, opts: opts, redrawn: 0, value: '', row: null,
      redraw: function () { l.redrawn += 1; }, refresh: function () {}, destroy: function () {} }; w.lists.push(l); return l; } }; },
    'shell/js/appServerSelector.js': real('appServerSelector.js'),
    'shell/js/apiVerbSelector.js': real('apiVerbSelector.js'),
  };
  const win = {
    spirit: { elements: {}, escapeHtml: function (s) { return String(s); },
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
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'client', 'apiTreeIndex.js'), 'utf8'), win, { filename: 'apiTreeIndex.js' });
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  w.E = win.spirit.elements;
  return w;
}
const names = function (l) { return (typeof l.opts.rows === 'function' ? l.opts.rows() : []).map(function (r) { return r.key; }); };

test.startTest('apiFamilySelector.js: the family selector, its verb half with it');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  test.subHeading('renamed, the old name gone');
  ok(fs.existsSync(FILE), 'shell/js/apiFamilySelector.js is there', 'there is no shell/js/apiFamilySelector.js');
  ok(!fs.existsSync(OLD), 'shell/js/apiBranchSelector.js is not: the rename leaves no copy', 'shell/js/apiBranchSelector.js is still there');
  if (!fs.existsSync(FILE)) return;
  ok(!/shellCreateListSearch/.test(fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '')), 'it names no shellCreateListSearch (goal/G40.8)', 'it names shellCreateListSearch');
  const w = world();
  await settle();
  const made = w.E.apiFamilySelector;
  ok(made && typeof made.create === 'function' && !('createApiFamilySelector' in w.E) && !('createApiBranchSelector' in w.E),
    'it registers apiFamilySelector with a create, and createApiFamilySelector and createApiBranchSelector no more', 'elements: ' + short(Object.keys(w.E)));
  if (!made || typeof made.create !== 'function') return;
  ok(w.required.indexOf('shell/js/appServerSelector.js') !== -1 && w.required.indexOf('shell/js/apiVerbSelector.js') !== -1,
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
  ok(fam.family === '' && fam.value === '' && verbBox.hidden === true && short(names(fl)) === short(['relay']), 'load lists another party\'s tree, clears the choice and hides the verb half', 'family ' + fam.family + ', hidden ' + verbBox.hidden);
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
