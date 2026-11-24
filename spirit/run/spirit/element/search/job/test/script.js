'use strict';

// spirit/run/spirit/element/search/job/test/script.js
// The tests of spirit/element/search/job/script.js, and of no other module (spec: ./script.md; goal/G43.32). The browser file runs
// in node on a BARE window (rule/26): no element is on the page until the selector requires it. Its list,
// search/job/list.js, is a stand-in that keeps what it was handed; it is tested in its own folder.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'spirit.js')).requireScript('spirit/test/headLessChrome.js');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
// ITS STAND-INS ARE requireScript's ANSWERS (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers";
// Andy: "spirit.requireScript must allways return either an object or a function... or fail/throw"): a script answers what
// stands at its place (a folder's script.js at its folder's name), a stand-in or a real file loaded; nothing there is refused.
function placedAnswer(p, w) {
  const keys = String(p).replace(/\.js$/, '').split('/');
  if (keys.length > 1 && keys[keys.length - 1] === 'script') keys.pop();
  const at = keys.reduce(function (o, k) { return o == null ? undefined : o[k]; }, ((w || global.window).spirit || {}).required);
  if (at && (typeof at === 'object' || typeof at === 'function')) return Promise.resolve(at);
  const no = Promise.reject(new Error('no stand-in for ' + p));
  no.catch(function () {});
  return no;
}

const FILE = path.join(__dirname, '..', 'script.js');
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

function element(tag) {
  const n = { tag: tag, className: '', style: {}, children: [], parentNode: null,
    appendChild: function (c) { n.children.push(c); c.parentNode = n; return c; },
    removeChild: function (c) { n.children = n.children.filter(function (x) { return x !== c; }); c.parentNode = null; return c; } };
  return n;
}

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let lists, required, made, box, open, root, list;

test.run('the selector runs on a bare window', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  const SRC = fs.readFileSync(FILE, 'utf8');
  lists = [];
  required = [];
  const STANDS = {
    'spirit/element/search/job/list/script.js': function () { LOADER.requireScript('spirit/element/installSpiritElement/script.js')(global.window.spirit, 'spirit/element/search/job/list/script.js', { create: function (host, o) {
      const l = { host: host, o: o, destroyed: 0 };
      lists.push(l); return { destroy: function () { l.destroyed += 1; } };
    } }); },
  };
  global.document = { createElement: element };
  global.window = { spirit: { escapeHtml: function (s) { return String(s); }, readyPromise: Promise.resolve({}), element: {} } };
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(window.spirit);
  global.spirit = global.window.spirit;
  global.window.spirit.requireScript = function (p) {
    required.push(String(p));
    if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](); }
    return placedAnswer(p);
  };
  PAGE_LOAD.runAsPage(FILE, null, SRC);
  await settle();
  const E = ((global.window.spirit.required || {}).spirit || {}).element || {};
  made = E.search && E.search.job;
  return true;
}, test.limit.quick);
test.run('it places itself at spirit.required.spirit.element.search.job, with a create', 0.2, function () {
  if (!lists) return false;
  return made && typeof made.create === 'function' ? true : false;
}, test.limit.quick);

// a thin selector over its own list (rule/26; the bundle selector's pattern)
test.run('create appends its root to its container and answers it', 0.2, async function () {
  if (!made || typeof made.create !== 'function') return false;
  box = element('div');
  open = function () {};
  root = made.create(box, { open: open });
  await settle();
  list = lists[0];
  return box.children.length === 1 && box.children[0] === root ? true : false;
}, test.limit.quick);
test.run('on a bare page it requires its list, spirit/element/search/job/list/script.js', 0.2, function () {
  if (!required) return false;
  return required.indexOf('spirit/element/search/job/list/script.js') !== -1 ? true : false;
}, test.limit.quick);
test.run('its list is drawn into its root, the mounter\'s open handed on, where a job\'s detail opens', 0.2, function () {
  if (!box) return false;
  return !!list && list.host === root && list.o.open === open ? true : false;
}, test.limit.quick);

// destroy
test.run('destroy lets its list go and takes itself out of its container', 0.2, function () {
  if (!list) return false;
  root.destroy();
  return list.destroyed === 1 && box.children.length === 0 ? true : false;
}, test.limit.quick);
test.run('a selector destroyed before its list is here draws no list', 0.2, async function () {
  if (!list) return false;
  const late = made.create(element('div'), {});
  late.destroy();
  await settle();
  return lists.length === 1 ? true : false;
}, test.limit.quick);
