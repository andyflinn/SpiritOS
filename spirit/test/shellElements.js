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
// AMENDED, the same day (Andy, verbatim, on the one elements.js the first build made): "why all in one?" — no
// good reason, said back — "i can guarantee you: there will be many". So one file per element.
// The contract the builder follows (the shape in goal/G2.12's box):
//   1. One file per element in spirit/run/shell/js/: iconSelector.js, contactSelector.js, appServerSelector.js,
//      apiBranchSelector.js. Each defines its one factory and adds it to window.spiritElements (created by
//      whichever loads first), on the globals every shell script has (spirit, window.spiritIconIndex,
//      window.spiritApiTreeIndex, document) and nothing inside shell.js or another element's closure; the
//      api-branch selector reaches the app-server one through window.spiritElements. elements.js is gone.
//   2. index.html loads the four before /js/client/shell.js, appServerSelector.js before apiBranchSelector.js,
//      and no longer loads elements.js.
//   3. shell.js defines none of the four and hands spiritElements.createXSelector under api.ui.elements — the api
//      an app sees is unchanged.
//   4. Loaded together the four expose four functions, and a contact selector still works as a control (root.value,
//      one bubbling change on the root).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('./testSupport.js');
const spirit = require('../run/js/kernel.js');

// The split was ruled after G2.12 closed on the one-file build; it is goal/G2.14's.
const OWED = 'OWED by goal/G2.14: ';
const RUN = path.join(__dirname, '..', 'run');
const DIR = path.join(RUN, 'shell', 'js');
const FILES = { createIconSelector: 'iconSelector.js', createContactSelector: 'contactSelector.js', createAppServerSelector: 'appServerSelector.js', createApiBranchSelector: 'apiBranchSelector.js' };
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

test.startTest('goal/G2.12: one file per element factory in shell/js/, handed to apps as before');

const shell = fs.readFileSync(SHELL, 'utf8');
const index = fs.readFileSync(INDEX, 'utf8');
const src = {};
FOUR.forEach(function (n) { try { src[n] = fs.readFileSync(path.join(DIR, FILES[n]), 'utf8'); } catch (e) { src[n] = null; } });

test.subHeading('1. one file per element, each adding itself to spiritElements');
const missing = FOUR.filter(function (n) { return !src[n]; });
const wrong = FOUR.filter(function (n) { return src[n] && (src[n].indexOf('function ' + n) === -1 || !/spiritElements/.test(src[n]) || FOUR.some(function (o) { return o !== n && src[n].indexOf('function ' + o) !== -1; })); });
if (!missing.length && !wrong.length) test.check('iconSelector.js, contactSelector.js, appServerSelector.js and apiBranchSelector.js each define their one factory and add it to spiritElements');
else test.fail(OWED + (missing.length ? 'missing files: ' + missing.map(function (n) { return FILES[n]; }).join(', ') : '') + (wrong.length ? ' wrong contents: ' + wrong.map(function (n) { return FILES[n]; }).join(', ') : ''));
if (!fs.existsSync(path.join(DIR, 'elements.js'))) test.check('and the all-in-one elements.js is gone');
else test.fail(OWED + 'shell/js/elements.js still exists');

test.subHeading('2. loaded by index.html before the shell, app-server before api-branch');
const at = {}; FOUR.forEach(function (n) { at[n] = index.indexOf('src="/shell/js/' + FILES[n] + '"'); });
const atShell = index.indexOf('src="/js/client/shell.js"');
if (FOUR.every(function (n) { return at[n] !== -1 && at[n] < atShell; }) && at.createAppServerSelector < at.createApiBranchSelector && index.indexOf('/shell/js/elements.js') === -1) {
  test.check('index.html loads the four before /js/client/shell.js, app-server before api-branch, and no elements.js');
} else test.fail(OWED + 'index.html positions ' + JSON.stringify(at) + ', shell at ' + atShell + ', elements.js tag ' + (index.indexOf('/shell/js/elements.js') !== -1));

test.subHeading('3. the shell defines none of them and hands them out as before');
const stillDefined = FOUR.filter(function (n) { return shell.indexOf('function ' + n) !== -1; });
if (stillDefined.length === 0) test.check('shell.js defines none of the four');
else test.fail(OWED + 'shell.js still defines ' + stillDefined.join(', '));
const flat = shell.replace(/\s+/g, ' ');
const handed = FOUR.filter(function (n) { return new RegExp('elements: \\{[^}]*' + n + ': spiritElements\\.' + n).test(flat); });
if (handed.length === 4) test.check('and hands all four to apps under api.ui.elements from spiritElements');
else test.fail(OWED + 'handed from spiritElements under ui.elements: ' + handed.join(', ') + ' — missing ' + FOUR.filter(function (n) { return handed.indexOf(n) === -1; }).join(', '));

// The contact selector paints from a search that answers later (goal/G4.14), so the report waits for it.
let pending = Promise.resolve();
test.subHeading('4. loaded together, the factories still work as controls');
if (missing.length) {
  test.fail(OWED + 'not every element file exists — the behaviour is owed with them');
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
  try { vm.createContext(ctx); ['createIconSelector', 'createContactSelector', 'createAppServerSelector', 'createApiBranchSelector'].forEach(function (n) { vm.runInContext(src[n], ctx); }); } catch (e) { tripped = e; }
  const E = window.spiritElements;
  if (!tripped && E && FOUR.every(function (n) { return typeof E[n] === 'function'; })) test.check('the four files load on the shell\'s globals alone and expose four functions');
  else test.fail(OWED + (tripped ? 'an element file tripped on load: ' + tripped.message : 'spiritElements exposes ' + JSON.stringify(E && Object.keys(E))));
  if (E && typeof E.createContactSelector === 'function') {
    // goal/G4.14: the contact selector is a drawn list now, the dropdown the same pane under a button (its own suite,
    // contactSelectorPane.js); what this suite keeps is that it still works as a control on the shell's globals.
    let root = null; let err = null;
    try { root = E.createContactSelector({ contacts: [{ key: 'k1', label: 'Bert' }, { key: 'k2', label: 'Carol' }], placeholder: 'who?' }); } catch (e) { err = e; }
    const everything = function (n) { return [n].concat((n.children || []).reduce(function (a, c) { return a.concat(everything(c)); }, [])); };
    pending = Promise.resolve().then(function () { return new Promise(function (r) { setImmediate(r); }); }).then(function () {
      const rowsFor = function (key) { return root ? everything(root).filter(function (n) { return n.getAttribute && n.getAttribute('data-key') === key; }) : []; };
      const named = root && everything(root).some(function (n) { return n.textContent === 'Bert'; });
      if (!err && root && /contact-selector/.test(root.className) && named && rowsFor('k1').length && root.value === '') {
        test.check('a contact selector from given rows paints them, and answers nothing until a pick');
      } else test.fail(OWED + 'contact selector: ' + (err ? 'threw ' + err.message : 'className ' + JSON.stringify(root && root.className) + ', Bert drawn ' + named + ', value ' + JSON.stringify(root && root.value)));
      const row = rowsFor('k1')[0];
      if (row) {
        let bubbled = 0;
        root.addEventListener('change', function () { bubbled += 1; });
        row.dispatchEvent(new FakeEvent('click', { bubbles: true }));
        if (root.value === 'k1' && root.row && root.row.label === 'Bert' && bubbled === 1) test.check('a pick sets root.value to the key and fires one bubbling change on the root');
        else test.fail(OWED + 'after a pick: value ' + JSON.stringify(root.value) + ', row ' + JSON.stringify(root.row) + ', changes on the root ' + bubbled);
      }
    });
  }
}

pending.then(function () { test.reportSuccessFailureCount(); });
