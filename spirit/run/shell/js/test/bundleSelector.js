'use strict';

// spirit/run/shell/js/test/bundleSelector.js
// The tests of shell/js/bundleSelector.js, and of no other module (spec: ./bundleSelector.md; goal/G41.14). The browser
// file runs in node on a BARE window (rule/26: "every shell element loads its own elements dynamically through the ...
// spirit.require functionality"): no element is on the page until the selector requires it. Its list,
// bundleSelector/listElement.js, is a stand-in that keeps what it was handed; it is tested in its own folder.

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
// An element that counts on what it did not load throws inside a promise: that is a failure said, not a silent exit.
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('shell/js/bundleSelector.js is not there'); return; }
  const SRC = fs.readFileSync(FILE, 'utf8');
  const code = SRC.replace(/\/\/.*$/gm, '');
  // goal/G40.8: the old shell's list search is forbidden on the face.
  ok(!/shellCreateListSearch|listSearch\.js/.test(code), 'it names nothing of the old shell\'s list search (goal/G40.8)', 'bundleSelector.js names shellCreateListSearch or listSearch.js');
  const lists = [];
  const required = [];
  const STANDS = {
    'shell/js/bundleSelector/listElement.js': function (E) { E.bundleList = { create: function (host, o) {
      const l = { host: host, o: o, refreshed: 0, refresh: function () { l.refreshed += 1; }, destroy: function () {} };
      lists.push(l); return { list: l, refresh: l.refresh, destroy: l.destroy };
    } }; },
  };
  global.Event = function (type, o) { this.type = type; this.bubbles = !!(o && o.bubbles); };
  global.document = { createElement: element, addEventListener: function () {}, removeEventListener: function () {} };
  global.window = { spirit: { escapeHtml: function (s) { return String(s); }, ready: Promise.resolve({}), elements: {} } };
  global.spirit = global.window.spirit;
  global.window.spirit.require = function (p) {
    required.push(String(p));
    if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](global.window.spirit.elements); }
    return Promise.resolve(true);
  };
  vm.runInThisContext(SRC, { filename: FILE });
  const E = global.window.spirit.elements;
  const made = E.bundleSelector;
  ok(made && typeof made.create === 'function' && !('createBundleSelector' in E), 'it registers spirit.elements.bundleSelector with a create, beside the shell\'s other selectors, and createBundleSelector no more', 'elements: ' + short(Object.keys(E)));
  if (!made || typeof made.create !== 'function') return;

  test.subHeading('a thin selector over its own list (rule/26; the contactSelector\'s pattern)');
  // Box v23: "every element gets a container and appends itself".
  const box = element('div');
  const root = made.create(box, { placeholder: 'choose a bundle…' });
  await settle();
  ok(box.children.length === 1 && box.children[0] === root, 'create(container, options) appends its root to its container and answers it', 'container holds ' + box.children.length + (box.children[0] === root ? ', the root' : ', not the root'));
  ok(required.indexOf('shell/js/bundleSelector/listElement.js') !== -1, 'on a bare page it requires its list, shell/js/bundleSelector/listElement.js', 'required: ' + short(required));
  ok(root && root.value === '' && root.row === null && /\bbundle-selector\b/.test(root.className), 'it answers its root at once, class bundle-selector, nothing chosen: value \'\', row null',
    'root: ' + short(root && { value: root.value, row: root.row, className: root.className }));
  const list = lists[0];
  ok(list && list.host === root && list.o.face === 'dropdown' && list.o.placeholder === 'choose a bundle…', 'its list is drawn into its root, a dropdown by default, its placeholder handed on', 'list: ' + short(list && { face: list.o.face, placeholder: list.o.placeholder, inRoot: list.host === root }));
  if (!list) return;
  made.create(element('div'), { face: 'pane', columns: ['label', 'edit', 'delete'], editable: true }); await settle();
  const pane = lists[1] && lists[1].o;
  ok(pane && pane.face === 'pane' && JSON.stringify(pane.columns) === '["label","edit","delete"]' && pane.editable === true,
    'face pane is the list itself; columns and editable are handed to it', 'pane: ' + short(pane));

  test.subHeading('goal/G41.25: mounted for an app server');
  // Andy, box: "the bundleSelector can be optionally configured with an <AppServerName> (family) at mount-time", and "if
  // the bundleSelector IS configured for an appServer, then it will only list bundles \"owned\" by that Appserver". The
  // listing is its list's (./bundleSelector/listElement.js), so the family is handed to it.
  made.create(element('div'), { family: 'agent' }); await settle();
  const forAgent = lists[2] && lists[2].o;
  ok(forAgent && forAgent.family === 'agent', 'create(container, { family }) hands the family to its list', 'list: ' + short(forAgent));
  ok(!('family' in list.o) || list.o.family === undefined || list.o.family === '', 'mounted for no app server, it hands its list no family', 'list: ' + short(list.o));

  test.subHeading('a pick');
  list.o.pick({ id: 7, label: 'Reader' }, '7');
  const e = root.events[root.events.length - 1];
  ok(root.value === 7 && root.row && root.row.id === 7 && root.row.label === 'Reader', 'a pick sets .value to the bundle\'s id, a number, and .row to the bundle', 'root: ' + short({ value: root.value, row: root.row }));
  ok(e && e.type === 'change' && e.bubbles === true, 'and says so with one bubbling change', 'events: ' + short(root.events));
  list.o.pick(null, '');
  ok(root.value === '' && root.row === null, 'a clear picks nothing: value \'\' again', 'root: ' + short({ value: root.value, row: root.row }));
  const before = list.refreshed;
  root.refresh();
  ok(list.refreshed === before + 1, 'refresh() asks again', 'refreshed: ' + list.refreshed);
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
