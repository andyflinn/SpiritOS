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
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

function element(tag) {
  const n = { tag: tag, className: '', children: [], parentNode: null,
    appendChild: function (c) { n.children.push(c); c.parentNode = n; return c; },
    removeChild: function (c) { n.children = n.children.filter(function (x) { return x !== c; }); c.parentNode = null; return c; } };
  return n;
}

test.startTest('search/job.js: the job selector, the job branch\'s search (goal/G43.32)');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('spirit/element/search/job.js is not there'); return; }
  const SRC = fs.readFileSync(FILE, 'utf8');
  const lists = [];
  const required = [];
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
  const made = E.search && E.search.job;
  ok(made && typeof made.create === 'function', 'it places itself at spirit.element.spirit.element.search.job, with a create', 'elements: ' + short(Object.keys(E.search || {})));
  if (!made || typeof made.create !== 'function') return;

  test.subHeading('a thin selector over its own list (rule/26; the bundle selector\'s pattern)');
  const box = element('div');
  const open = function () {};
  const root = made.create(box, { open: open });
  await settle();
  ok(box.children.length === 1 && box.children[0] === root, 'create(container, options) appends its root to its container and answers it', 'container holds ' + box.children.length);
  ok(required.indexOf('spirit/element/search/job/listElement.js') !== -1, 'on a bare page it requires its list, spirit/element/search/job/listElement.js', 'required: ' + short(required));
  const list = lists[0];
  ok(!!list && list.host === root && list.o.open === open, 'its list is drawn into its root, the mounter\'s open handed on, where a job\'s detail opens', 'list: ' + short(list && { inRoot: list.host === root, open: list.o.open === open }));
  if (!list) return;

  test.subHeading('destroy');
  root.destroy();
  ok(list.destroyed === 1 && box.children.length === 0, 'destroy lets its list go and takes itself out of its container', 'destroyed ' + list.destroyed + ', container holds ' + box.children.length);
  const late = made.create(element('div'), {});
  late.destroy();
  await settle();
  ok(lists.length === 1, 'a selector destroyed before its list is here draws no list', lists.length + ' lists drawn');
}()).then(function () { test.reportSuccessFailureCount(); }, function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); });
