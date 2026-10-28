'use strict';

// spirit/run/shell/js/test/bundleSelector.js
// The tests of shell/js/bundleSelector.js, and of no other module (spec: ./bundleSelector.md; goal/G41.13). The browser
// file runs in node on a window of its own: the shared list (shellCreateListSearch) is a stub that keeps what it was
// handed, and the node's auth family is the spirit object's, answering auth.bundle as spirit/apiAuth.js does.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'bundleSelector.js');
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

function element(tag) {
  const heard = {};
  const n = { tag: tag, className: '', children: [], value: '', innerHTML: '',
    appendChild: function (c) { n.children.push(c); return c; },
    addEventListener: function (type, fn) { (heard[type] = heard[type] || []).push(fn); },
    removeEventListener: function () {},
    dispatchEvent: function (e) { n.events.push(e); (heard[e.type] || []).forEach(function (fn) { fn(e); }); return true; },
    events: [] };
  return n;
}

test.startTest('bundleSelector.js: the bundle picker');

(async function () {
  test.subHeading('its file');
  if (!fs.existsSync(FILE)) { test.fail('shell/js/bundleSelector.js is not there'); return; }
  const lists = [];
  const asked = [];
  const B1 = { id: 'KB1', label: 'Reader', description: 'reads files', paths: ['files.read', 'files.list'] };
  global.Event = function (type, o) { this.type = type; this.bubbles = !!(o && o.bubbles); };
  global.document = { createElement: element, addEventListener: function () {}, removeEventListener: function () {} };
  const auth = { bundle: function (a) { asked.push(a); return Promise.resolve({ items: [{ key: 'KB1', label: JSON.stringify(B1) }], more: false }); } };
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); }, ready: Promise.resolve({ auth: auth }), elements: {
    shellCreateListSearch: function (host, o) { const l = { host: host, o: o, refreshed: 0, redrawn: 0, refresh: function () { l.refreshed += 1; }, redraw: function () { l.redrawn += 1; } }; lists.push(l); return l; },
  } } };
  global.spirit = global.window.spirit;
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  const make = global.window.spirit.elements.createBundleSelector;
  ok(typeof make === 'function', 'it registers spirit.elements.createBundleSelector, beside the shell\'s other selectors', 'elements: ' + short(Object.keys(global.window.spirit.elements)));
  if (typeof make !== 'function') return;

  test.subHeading('one selector on the shared list');
  const root = make({});
  ok(root && root.value === '' && root.row === null && /\bbundle-selector\b/.test(root.className), 'it answers its root, class bundle-selector, nothing chosen: value \'\', row null', 'root: ' + short(root && { value: root.value, row: root.row, className: root.className }));
  const list = lists[0];
  ok(list && list.o.mode === 'dropdown' && list.refreshed >= 1, 'it is the shared list (shellCreateListSearch), a dropdown by default, searched as it is made', 'list: ' + short(list && { mode: list.o.mode, refreshed: list.refreshed }));
  make({ face: 'pane' });
  ok(lists[1] && lists[1].o.mode === 'pane', 'face pane makes it the list itself', 'mode: ' + short(lists[1] && lists[1].o.mode));
  if (!list) return;

  test.subHeading('its rows are the node\'s bundles');
  const answer = await list.o.api.verb(list.o.verb, list.o.args('rea', {}));
  ok(asked.length === 1 && asked[0].op === 'search' && asked[0].text === 'rea', 'a search asks auth.bundle { op: search, text } through the spirit object', 'asked: ' + short(asked));
  const item = answer && answer.body && answer.body.items && answer.body.items[0];
  let row = null; try { row = JSON.parse(item.label); } catch (e) { row = null; }
  ok(answer && answer.status === 200 && item && item.key === 'KB1' && row && row.label === 'Reader', 'and hands the list each bundle, keyed by its id, with its label', 'answer: ' + short(answer));
  const cells = list.o.paint(Object.assign({ key: 'KB1' }, B1));
  ok(String(cells).indexOf('Reader') !== -1, 'a row shows the bundle\'s label', 'paint: ' + short(cells));
  ok(String(list.o.paint({ key: 'KX', label: '<b>' })).indexOf('<b>') === -1, 'and escapes it', 'paint: ' + short(list.o.paint({ key: 'KX', label: '<b>' })));

  test.subHeading('a pick');
  list.o.pick(Object.assign({ key: 'KB1' }, B1));
  const e = root.events[root.events.length - 1];
  ok(root.value === 'KB1' && root.row && root.row.label === 'Reader' && root.row.paths.length === 2, 'a pick sets .value to the bundle\'s id and .row to the bundle, its paths with it', 'root: ' + short({ value: root.value, row: root.row }));
  ok(e && e.type === 'change' && e.bubbles === true, 'and says so with one bubbling change', 'events: ' + short(root.events));
  list.o.pick(null);
  ok(root.value === '' && root.row === null, 'a clear picks nothing: value \'\' again', 'root: ' + short({ value: root.value, row: root.row }));
  const before = list.refreshed;
  root.refresh();
  ok(list.refreshed === before + 1, 'refresh() asks again', 'refreshed: ' + list.refreshed);
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
