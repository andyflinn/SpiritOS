'use strict';

// spirit/run/shell/js/test/bundleSelector.js
// The tests of shell/js/bundleSelector.js, and of no other module (spec: ./bundleSelector.md; goal/G41.13). The browser
// file runs in node on a BARE window (rule/26: "every shell element loads its own elements dynamically through the ...
// spirit.require functionality", "there will be NOTHING pre-loaded after the relays-supplied boot scripts"): no element is
// on the page until the selector requires it, and only then is the stand-in for that file put there. The stand-in for
// probabilitySearch keeps what it was handed; the node's auth family is the spirit object's, answering auth.bundle as
// spirit/apiAuth.js does.

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
  const n = { tag: tag, className: '', children: [], value: '', innerHTML: '', events: [], style: {},
    appendChild: function (c) { n.children.push(c); return c; },
    addEventListener: function () {}, removeEventListener: function () {},
    dispatchEvent: function (e) { n.events.push(e); return true; } };
  return n;
}

test.startTest('bundleSelector.js: the bundle picker');

(async function () {
  test.subHeading('its file');
  if (!fs.existsSync(FILE)) { test.fail('shell/js/bundleSelector.js is not there'); return; }
  const SRC = fs.readFileSync(FILE, 'utf8');
  const code = SRC.replace(/\/\/.*$/gm, '');
  // goal/G40.8: the old shell's list search is forbidden on the face; the face loads only what is required.
  ok(!/shellCreateListSearch|listSearch\.js/.test(code), 'it names nothing of the old shell\'s list search (goal/G40.8)', 'bundleSelector.js names shellCreateListSearch or listSearch.js');
  const lists = [];
  const asked = [];
  const required = [];
  const B1 = { id: 'KB1', label: 'Reader', description: 'reads files', paths: ['files.read', 'files.list'] };
  const auth = { bundle: function (a) { asked.push(a); return Promise.resolve({ items: [{ key: 'KB1', label: JSON.stringify(B1) }], more: false }); } };
  const STANDS = {
    'shell/js/probabilitySearch.js': function (E) { E.probabilitySearch = { create: function (host, o) {
      const l = { host: host, o: o, refreshed: 0, value: '', row: null, refresh: function () { l.refreshed += 1; }, redraw: function () {}, destroy: function () { l.destroyed = true; } };
      lists.push(l); return l;
    } }; },
  };
  global.Event = function (type, o) { this.type = type; this.bubbles = !!(o && o.bubbles); };
  global.document = { createElement: element, addEventListener: function () {}, removeEventListener: function () {} };
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); }, ready: Promise.resolve({ auth: auth }), auth: auth, elements: {} } };
  global.spirit = global.window.spirit;
  // A file required is there once its promise settles, as spirit.require does it on a page.
  global.window.spirit.require = function (p) {
    required.push(String(p));
    if (STANDS[p]) STANDS[p](global.window.spirit.elements);
    return Promise.resolve(true);
  };
  vm.runInThisContext(SRC, { filename: FILE });
  const make = global.window.spirit.elements.createBundleSelector;
  ok(typeof make === 'function', 'it registers spirit.elements.createBundleSelector, beside the shell\'s other selectors', 'elements: ' + short(Object.keys(global.window.spirit.elements)));
  if (typeof make !== 'function') return;

  test.subHeading('it loads what it uses itself (rule/26)');
  const root = make({});
  await settle();
  ok(required.indexOf('shell/js/probabilitySearch.js') !== -1, 'on a bare page it requires shell/js/probabilitySearch.js through spirit.require', 'required: ' + short(required));
  ok(root && root.value === '' && root.row === null && /\bbundle-selector\b/.test(root.className), 'it answers its root at once, class bundle-selector, nothing chosen: value \'\', row null',
    'root: ' + short(root && { value: root.value, row: root.row, className: root.className }));
  const list = lists[0];
  ok(list && list.o.face === 'dropdown' && list.refreshed >= 1, 'then builds on probabilitySearch, a dropdown by default, searched as it is made', 'list: ' + short(list && { face: list.o.face, refreshed: list.refreshed }));
  make({ face: 'pane' }); await settle();
  ok(lists[1] && (lists[1].o.face === 'pane' || lists[1].o.face === undefined), 'face pane makes it the list itself', 'face: ' + short(lists[1] && lists[1].o.face));
  if (!list) return;

  test.subHeading('its rows are the node\'s bundles');
  const answer = await list.o.api.verb(list.o.server + '.' + list.o.verb, list.o.args('rea', {}));
  ok(asked.length === 1 && asked[0].op === 'search' && asked[0].text === 'rea', 'a search asks auth.bundle { op: search, text } through the spirit object', 'asked: ' + short(asked));
  const item = answer && answer.body && answer.body.items && answer.body.items[0];
  let row = null; try { row = JSON.parse(item.label); } catch (e) { row = null; }
  ok(answer && answer.status === 200 && item && item.key === 'KB1' && row && row.label === 'Reader', 'and hands the list each bundle, keyed by its id, with its label', 'answer: ' + short(answer));
  const nameOf = typeof list.o.name === 'function' ? list.o.name(Object.assign({ key: 'KB1' }, B1)) : '';
  const cols = (list.o.columns || []).map(function (c) { return c.field; });
  ok(nameOf === 'Reader' || cols.indexOf('label') !== -1, 'a row is shown by the bundle\'s label', 'name ' + short(nameOf) + ', columns ' + short(cols));

  test.subHeading('a pick');
  list.o.pick(Object.assign({ key: 'KB1' }, B1), 'KB1');
  const e = root.events[root.events.length - 1];
  ok(root.value === 'KB1' && root.row && root.row.label === 'Reader' && root.row.paths.length === 2, 'a pick sets .value to the bundle\'s id and .row to the bundle, its paths with it', 'root: ' + short({ value: root.value, row: root.row }));
  ok(e && e.type === 'change' && e.bubbles === true, 'and says so with one bubbling change', 'events: ' + short(root.events));
  list.o.pick(null, '');
  ok(root.value === '' && root.row === null, 'a clear picks nothing: value \'\' again', 'root: ' + short({ value: root.value, row: root.row }));
  const before = list.refreshed;
  root.refresh();
  ok(list.refreshed === before + 1, 'refresh() asks again', 'refreshed: ' + list.refreshed);
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
