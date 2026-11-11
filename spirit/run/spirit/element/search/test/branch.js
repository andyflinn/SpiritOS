'use strict';

// spirit/run/spirit/element/search/test/branch.js
// The tests of spirit/element/search/branch.js, and of no other module (spec: ./branch.md; goal/G41.14). The browser
// file runs in node on a BARE window (rule/26: "every shell element loads its own elements dynamically through the ...
// spirit.require functionality"): no element is on the page until the selector requires it. Its list,
// search/branch/listElement.js, is a stand-in that keeps what it was handed; it is tested in its own folder.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'branch.js');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

function element(tag) {
  const n = { tag: tag, className: '', children: [], value: '', innerHTML: '', events: [], style: {},
    appendChild: function (c) { n.children.push(c); return c; },
    addEventListener: function () {}, removeEventListener: function () {},
    dispatchEvent: function (e) { n.events.push(e); return true; } };
  return n;
}

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
// An element that counts on what it did not load throws inside a promise: the reporter fails the test it ran in.
let SRC, code, lists, required, E, made, box, root, list;
const NO_MADE = 'no branch selector with a create: the world failed';
const NO_LIST = 'no list was drawn';

test.run('the world: the selector runs on a bare window', 0.2, async function () {
  if (!fs.existsSync(FILE)) return 'spirit/element/search/branch.js is not there';
  SRC = fs.readFileSync(FILE, 'utf8');
  code = SRC.replace(/\/\/.*$/gm, '');
  lists = [];
  required = [];
  const STANDS = {
    'spirit/element/search/branch/listElement.js': function (E) { require(path.join(RUN, 'spirit', 'element', 'installSpiritElement.js'))(global.window.spirit, 'spirit/element/search/branch/listElement.js', { create: function (host, o) {
      const l = { host: host, o: o, refreshed: 0, refresh: function () { l.refreshed += 1; }, destroy: function () {} };
      lists.push(l); return { list: l, refresh: l.refresh, destroy: l.destroy };
    } }); },
  };
  global.Event = function (type, o) { this.type = type; this.bubbles = !!(o && o.bubbles); };
  global.document = { createElement: element, addEventListener: function () {}, removeEventListener: function () {} };
  global.window = { spirit: { escapeHtml: function (s) { return String(s); }, ready: Promise.resolve({}), element: {} } };
  // goal/G43.32: the element places itself by installSpiritElement, as it runs (spirit/test/headLessChrome.js pageSpirit).
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
  global.spirit = global.window.spirit;
  global.window.spirit.require = function (p) {
    required.push(String(p));
    if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](((global.window.spirit.element.spirit = global.window.spirit.element.spirit || {}).element = global.window.spirit.element.spirit.element || {})); }
    return Promise.resolve(true);
  };
  vm.runInThisContext(SRC, { filename: FILE });
  // goal/G43.32: it places itself once installSpiritElement is in hand.
  await settle();
  E = ((global.window.spirit.element || {}).spirit || {}).element || {};
  made = E.search.branch;
  return true;
}, 1000);
// goal/G40.8: the old shell's list search is forbidden on the face.
test.run('it names nothing of the old shell\'s list search (goal/G40.8)', 0.2, function () {
  if (!code) return 'no branch.js read: the world failed';
  const names = /shellCreateListSearch|listSearch\.js/.test(code);
  return !names ? true : 'branchSelector.js names shellCreateListSearch or listSearch.js';
}, 1000);
test.run('it registers spirit.element.spirit.element.search.branch with a create, beside the shell\'s other selectors, and createBranchSelector no more', 0.2, function () {
  if (!E) return 'the selector never ran: the world failed';
  return made && typeof made.create === 'function' && !('createBranchSelector' in E) ? true : 'elements: ' + short(Object.keys(E));
}, 1000);

// a thin selector over its own list (rule/26; the contactSelector's pattern)
// Box v23: "every element gets a container and appends itself".
test.run('create(container, options) appends its root to its container and answers it', 0.2, async function () {
  if (!made || typeof made.create !== 'function') return NO_MADE;
  box = element('div');
  root = made.create(box, { bundle: 7, placeholder: 'choose a branch…' });
  await settle();
  list = lists[0];
  return box.children.length === 1 && box.children[0] === root ? true : 'container holds ' + box.children.length + (box.children[0] === root ? ', the root' : ', not the root');
}, 1000);
test.run('on a bare page it requires its list, spirit/element/search/branch/listElement.js', 0.2, function () {
  if (!required) return 'the selector never ran: the world failed';
  return required.indexOf('spirit/element/search/branch/listElement.js') !== -1 ? true : 'required: ' + short(required);
}, 1000);
test.run('it answers its root at once, class branch-selector, nothing chosen: value \'\', row null', 0.2, function () {
  if (!box) return NO_MADE;
  return root && root.value === '' && root.row === null && /\bbranch-selector\b/.test(root.className) ? true : 'root: ' + short(root && { value: root.value, row: root.row, className: root.className });
}, 1000);
test.run('its list is drawn into its root, a dropdown by default, its bundle and placeholder handed on', 0.2, function () {
  if (!box) return NO_MADE;
  return list && list.host === root && list.o.face === 'dropdown' && list.o.placeholder === 'choose a branch…' && list.o.bundle === 7 ? true : 'list: ' + short(list && { face: list.o.face, placeholder: list.o.placeholder, inRoot: list.host === root });
}, 1000);
test.run('face pane is the list itself; columns are handed to it', 0.2, async function () {
  if (!list) return NO_LIST;
  made.create(element('div'), { bundle: 7, face: 'pane', columns: ['family', 'verb', 'delete'] }); await settle();
  const pane = lists[1] && lists[1].o;
  return pane && pane.face === 'pane' && JSON.stringify(pane.columns) === '["family","verb","delete"]' ? true : 'pane: ' + short(pane);
}, 1000);

// a pick
test.run('a pick sets .value to the branch\'s id, a number, and .row to the branch', 0.2, function () {
  if (!list) return NO_LIST;
  list.o.pick({ id: 3, bundle: 7, family: 'desk', verb: '' }, '3');
  return root.value === 3 && root.row && root.row.id === 3 && root.row.bundle === 7 && root.row.family === 'desk' && root.row.verb === '' ? true : 'root: ' + short({ value: root.value, row: root.row });
}, 1000);
test.run('and says so with one bubbling change', 0.2, function () {
  if (!list) return NO_LIST;
  const e = root.events[root.events.length - 1];
  return e && e.type === 'change' && e.bubbles === true ? true : 'events: ' + short(root.events);
}, 1000);
test.run('a clear picks nothing: value \'\' again', 0.2, function () {
  if (!list) return NO_LIST;
  list.o.pick(null, '');
  return root.value === '' && root.row === null ? true : 'root: ' + short({ value: root.value, row: root.row });
}, 1000);
test.run('refresh() asks again', 0.2, function () {
  if (!list) return NO_LIST;
  const before = list.refreshed;
  root.refresh();
  return list.refreshed === before + 1 ? true : 'refreshed: ' + list.refreshed;
}, 1000);
