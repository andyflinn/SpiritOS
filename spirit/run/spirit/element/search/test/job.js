'use strict';

// spirit/run/spirit/element/search/test/job.js
// The tests of spirit/element/search/job.js, and of no other module (spec: ./job.md; goal/G43.32). The browser file runs
// in node on a BARE window (rule/26): no element is on the page until the selector requires it. Its list,
// search/job/listElement.js, is a stand-in that keeps what it was handed; it is tested in its own folder.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'job.js');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

function element(tag) {
  const n = { tag: tag, className: '', children: [], parentNode: null,
    appendChild: function (c) { n.children.push(c); c.parentNode = n; return c; },
    removeChild: function (c) { n.children = n.children.filter(function (x) { return x !== c; }); c.parentNode = null; return c; } };
  return n;
}

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let lists, required, made, box, open, root, list;
const NO_MADE = 'no job selector with a create: the world failed';
const NO_LIST = 'no list was drawn';

test.run('the world: the selector runs on a bare window', 0.2, async function () {
  if (!fs.existsSync(FILE)) return 'spirit/element/search/job.js is not there';
  const SRC = fs.readFileSync(FILE, 'utf8');
  lists = [];
  required = [];
  const STANDS = {
    'spirit/element/search/job/listElement.js': function () { require(path.join(RUN, 'spirit', 'element', 'installSpiritElement.js'))(global.window.spirit, 'spirit/element/search/job/listElement.js', { create: function (host, o) {
      const l = { host: host, o: o, destroyed: 0 };
      lists.push(l); return { destroy: function () { l.destroyed += 1; } };
    } }); },
  };
  global.document = { createElement: element };
  global.window = { spirit: { escapeHtml: function (s) { return String(s); }, ready: Promise.resolve({}), element: {} } };
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
  global.spirit = global.window.spirit;
  global.window.spirit.require = function (p) {
    required.push(String(p));
    if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](); }
    return Promise.resolve(true);
  };
  vm.runInThisContext(SRC, { filename: FILE });
  await settle();
  const E = ((global.window.spirit.element || {}).spirit || {}).element || {};
  made = E.search && E.search.job;
  return true;
}, test.limit.quick);
test.run('it places itself at spirit.element.spirit.element.search.job, with a create', 0.2, function () {
  if (!lists) return 'the selector never ran: the world failed';
  const E = ((global.window.spirit.element || {}).spirit || {}).element || {};
  return made && typeof made.create === 'function' ? true : 'elements: ' + short(Object.keys(E.search || {}));
}, test.limit.quick);

// a thin selector over its own list (rule/26; the bundle selector's pattern)
test.run('create(container, options) appends its root to its container and answers it', 0.2, async function () {
  if (!made || typeof made.create !== 'function') return NO_MADE;
  box = element('div');
  open = function () {};
  root = made.create(box, { open: open });
  await settle();
  list = lists[0];
  return box.children.length === 1 && box.children[0] === root ? true : 'container holds ' + box.children.length;
}, test.limit.quick);
test.run('on a bare page it requires its list, spirit/element/search/job/listElement.js', 0.2, function () {
  if (!required) return 'the selector never ran: the world failed';
  return required.indexOf('spirit/element/search/job/listElement.js') !== -1 ? true : 'required: ' + short(required);
}, test.limit.quick);
test.run('its list is drawn into its root, the mounter\'s open handed on, where a job\'s detail opens', 0.2, function () {
  if (!box) return NO_MADE;
  return !!list && list.host === root && list.o.open === open ? true : 'list: ' + short(list && { inRoot: list.host === root, open: list.o.open === open });
}, test.limit.quick);

// destroy
test.run('destroy lets its list go and takes itself out of its container', 0.2, function () {
  if (!list) return NO_LIST;
  root.destroy();
  return list.destroyed === 1 && box.children.length === 0 ? true : 'destroyed ' + list.destroyed + ', container holds ' + box.children.length;
}, test.limit.quick);
test.run('a selector destroyed before its list is here draws no list', 0.2, async function () {
  if (!list) return NO_LIST;
  const late = made.create(element('div'), {});
  late.destroy();
  await settle();
  return lists.length === 1 ? true : lists.length + ' lists drawn';
}, test.limit.quick);
