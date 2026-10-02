'use strict';

// goal/G2.12: the shell's element factories move out of the shell program into spirit/run/shell/js/elements.js,
// still handed to apps as api.ui.elements. Red on today's tree.
//   RULING (Andy, 2026-10-02, verbatim, under goal/G2): "i want them to be available in the interface object that
//   the shell passes to apps, as tools to build their interfaces, as element-factories." ... "the shell-elements
//   are better of being in 'spirit/run/shell/js/' since they should be UI-component-factories supplied in the
//   interface passed to shell-apps during mount." — then "yes." to the move as an item.
//   In the tree: createIconSelector (js/client/shell.js:762), createContactSelector (:915), createAppServerSelector
//   (:963), createApiBranchSelector (:1002), closed over shell.js's helpers and handed out at shell.js:1634 as
//   api.ui.elements; index.html loads /js/client/shell.js last (index.html:1366). No shell/js/ folder exists.
// The contract the builder follows (the shape in goal/G2.12's box; the arguable parts fixed here by name):
//   1. spirit/run/shell/js/elements.js defines the four factories and exposes them as window.spiritElements
//      {createIconSelector, createContactSelector, createAppServerSelector, createApiBranchSelector} — the pattern
//      iconIndex.js set (window.spiritIconIndex). It takes what it needs from the globals every shell script has
//      (spirit, window.spiritIconIndex, window.spiritApiTreeIndex, document) and from nothing inside shell.js.
//   2. index.html loads /shell/js/elements.js before /js/client/shell.js, as it loads iconIndex.js.
//   3. shell.js defines none of the four any more (no `function createXSelector` in it) and hands apps
//      spiritElements.createXSelector under api.ui.elements — the api an app sees is unchanged.
//   4. The factories behave as they did: a contact selector built from given rows paints them and answers the
//      chosen row's key on change, as a control (root.value, a bubbling change).
// Suites asserting the old home (apiBranchSelector, appServerSelector, contactSelector: "shell.js defines ... and
// hands it") go red on the build and are flipped by the builder to the new home; their behaviour checks stand.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('./testSupport.js');
const spirit = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G2.12: ';
const RUN = path.join(__dirname, '..', 'run');
const ELEMENTS = path.join(RUN, 'shell', 'js', 'elements.js');
const SHELL = path.join(RUN, 'js', 'client', 'shell.js');
const INDEX = path.join(RUN, 'index.html');
const FOUR = ['createIconSelector', 'createContactSelector', 'createAppServerSelector', 'createApiBranchSelector'];

function fakeElement(tag) {
  const el = { tagName: String(tag).toUpperCase(), className: '', value: '', children: [], listeners: {}, dataset: {}, style: {}, attributes: {} };
  let html = '';
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  el.appendChild = function (c) { el.children.push(c); c.parentNode = el; return c; };
  el.addEventListener = function (ev, fn) { (el.listeners[ev] = el.listeners[ev] || []).push(fn); };
  el.dispatchEvent = function (event) {
    (el.listeners[event.type] || []).forEach(function (fn) { fn(event); });
    if (event.bubbles && !event.stopped && el.parentNode && el.parentNode.dispatchEvent) el.parentNode.dispatchEvent(event);
    return true;
  };
  el.setAttribute = function (n, v) { el.attributes[n] = String(v); };
  el.getAttribute = function (n) { return el.attributes[n] === undefined ? null : el.attributes[n]; };
  el.querySelector = function () { return null; };
  el.querySelectorAll = function () { return []; };
  el.focus = function () {};
  el.closest = function () { return null; };
  return el;
}
// stopPropagation stops the bubble, as a browser's does: the inner <select>'s change is stopped by the factory and
// the root fires its own, so a listener on the root hears one change, not two.
function FakeEvent(type, init) { const ev = this; ev.type = type; ev.bubbles = !!(init && init.bubbles); ev.stopped = false; ev.stopPropagation = function () { ev.stopped = true; }; ev.preventDefault = function () {}; }

test.startTest('goal/G2.12: the element factories live in shell/js/elements.js, handed to apps as before');

const shell = fs.readFileSync(SHELL, 'utf8');
const index = fs.readFileSync(INDEX, 'utf8');
let elements = null;
try { elements = fs.readFileSync(ELEMENTS, 'utf8'); } catch (e) { elements = null; }

test.subHeading('1. the file, and the four in it');
if (elements && FOUR.every(function (n) { return elements.indexOf('function ' + n) !== -1; }) && /spiritElements/.test(elements)) {
  test.check('shell/js/elements.js defines the four factories and exposes them as spiritElements');
} else if (!elements) test.fail(OWED + 'there is no spirit/run/shell/js/elements.js');
else test.fail(OWED + 'elements.js lacks: ' + FOUR.filter(function (n) { return elements.indexOf('function ' + n) === -1; }).join(', ') + (/spiritElements/.test(elements) ? '' : ', and does not expose spiritElements'));

test.subHeading('2. loaded by index.html before the shell');
const atElements = index.indexOf('src="/shell/js/elements.js"');
const atShell = index.indexOf('src="/js/client/shell.js"');
if (atElements !== -1 && atShell !== -1 && atElements < atShell) test.check('index.html loads /shell/js/elements.js, before /js/client/shell.js');
else test.fail(OWED + 'index.html: elements at ' + atElements + ', shell at ' + atShell);

test.subHeading('3. the shell defines none of them and hands them out as before');
const stillDefined = FOUR.filter(function (n) { return shell.indexOf('function ' + n) !== -1; });
if (stillDefined.length === 0) test.check('shell.js defines none of the four');
else test.fail(OWED + 'shell.js still defines ' + stillDefined.join(', '));
const flat = shell.replace(/\s+/g, ' ');
const handed = FOUR.filter(function (n) { return new RegExp('elements: \\{[^}]*' + n + ': spiritElements\\.' + n).test(flat); });
if (handed.length === 4) test.check('and hands all four to apps under api.ui.elements from spiritElements');
else test.fail(OWED + 'handed from spiritElements under ui.elements: ' + handed.join(', ') + ' — missing ' + FOUR.filter(function (n) { return handed.indexOf(n) === -1; }).join(', '));

test.subHeading('4. a factory still works as a control');
if (!elements) {
  test.fail(OWED + 'no elements.js to load — the behaviour is owed with the file');
} else {
  const window = { spiritIconIndex: { choices: function () { return []; }, keyFor: function () { return ''; } }, spiritApiTreeIndex: { servers: function () { return []; }, verbs: function () { return []; } } };
  const ctx = {
    window: window, document: { createElement: fakeElement, body: fakeElement('body'), addEventListener: function () {} }, Event: FakeEvent, console: console,
    spirit: { core: { util: { escapeHtml: spirit.core.util.escapeHtml }, const: { ICON: spirit.core.const.ICON },
      ask: function () { return Promise.resolve({ status: 200, body: { items: [] } }); },
      jobs: { api: function () { return Promise.resolve({ ok: true }); } } } },
  };
  ctx.self = ctx.window;
  let tripped = null;
  try { vm.runInNewContext(elements, ctx); } catch (e) { tripped = e; }
  const E = window.spiritElements;
  if (!tripped && E && FOUR.every(function (n) { return typeof E[n] === 'function'; })) test.check('elements.js loads on the shell\'s globals alone and exposes four functions');
  else test.fail(OWED + (tripped ? 'elements.js tripped on load: ' + tripped.message : 'spiritElements exposes ' + JSON.stringify(E && Object.keys(E))));
  if (E && typeof E.createContactSelector === 'function') {
    let root = null; let err = null;
    try { root = E.createContactSelector({ contacts: [{ key: 'k1', label: 'Bert' }, { key: 'k2', label: 'Carol' }], placeholder: 'who?' }); } catch (e) { err = e; }
    const select = root && root.children[0];
    if (!err && root && /contact-selector/.test(root.className) && select && /Bert/.test(select.innerHTML) && root.value === '') {
      test.check('a contact selector from given rows paints them, and answers nothing until a pick');
    } else test.fail(OWED + 'contact selector: ' + (err ? 'threw ' + err.message : 'className ' + JSON.stringify(root && root.className) + ', options ' + JSON.stringify(select && select.innerHTML) + ', value ' + JSON.stringify(root && root.value)));
    if (select) {
      let bubbled = 0;
      root.addEventListener('change', function () { bubbled += 1; });
      select.value = '0';
      select.dispatchEvent(new FakeEvent('change', { bubbles: true }));
      if (root.value === 'k1' && root.row && root.row.label === 'Bert' && bubbled === 1) test.check('a pick sets root.value to the key and fires one bubbling change on the root');
      else test.fail(OWED + 'after a pick: value ' + JSON.stringify(root.value) + ', row ' + JSON.stringify(root.row) + ', changes on the root ' + bubbled);
    }
  }
}

test.reportSuccessFailureCount();
