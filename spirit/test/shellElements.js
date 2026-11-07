'use strict';

// goal/G2.12 and goal/G2.14: the shell's element factories, one file per element, handed to apps as api.ui.elements.
//   RULING (Andy, 2026-10-02, under goal/G2): "the shell-elements are better of being in 'spirit/run/spirit/element/'
//   since they should be UI-component-factories supplied in the interface passed to shell-apps during mount.", and on
//   one file for all: "i can guarantee you: there will be many". So one file per element.
// What this suite asserts:
//   1. spirit/run/spirit/element/ holds iconSelector.js, contactSelector.js, appServerSelector.js and
//      apiBranchSelector.js, each defining its one factory and adding it to window.spirit.elements; no elements.js.
//   2. index.html loads the four before /spirit/client/shell.js, appServerSelector.js before apiBranchSelector.js.
//   3. shell.js defines none of the four and hands each under api.ui.elements as shellElements.createXSelector.
//   4. Loaded with the probability modules and shell/shared/js/listSearch.js, the four expose four functions, and a
//      contact selector works as a control (root.value, one bubbling change on the root).
// IT READS WHAT THE TREE NO LONGER HAS: none of the four files, nor shell/shared/js/listSearch.js, exists. The
// selectors are in spirit/run/spirit/element/search/ (icon.js, contact.js, api.js, branch.js), and shell.js hands
// them as api.ui.elements.iconSelector, contactSelector, appServerSelector, apiFamilySelector. So it fails.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('./testSupport.js');
const spirit = require('../run/spirit/kernel.js');

// The one-file-per-element split is goal/G2.14's.
const OWED = 'OWED by goal/G2.14: ';
const RUN = path.join(__dirname, '..', 'run');
const DIR = path.join(RUN, 'spirit', 'element');
const FILES = { createIconSelector: 'iconSelector.js', createContactSelector: 'contactSelector.js', createAppServerSelector: 'appServerSelector.js', createApiBranchSelector: 'apiBranchSelector.js' };
const SHELL = path.join(RUN, 'spirit', 'client', 'shell.js');
const INDEX = path.join(RUN, 'spirit', 'shell', 'index.html');
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

test.startTest('goal/G2.12: one file per element factory in spirit/element/, handed to apps as before');

const shell = fs.readFileSync(SHELL, 'utf8');
const index = fs.readFileSync(INDEX, 'utf8');
const src = {};
FOUR.forEach(function (n) { try { src[n] = fs.readFileSync(path.join(DIR, FILES[n]), 'utf8'); } catch (e) { src[n] = null; } });

test.subHeading('1. one file per element, each adding itself to spirit.elements');
const missing = FOUR.filter(function (n) { return !src[n]; });
const wrong = FOUR.filter(function (n) { return src[n] && (src[n].indexOf('function ' + n) === -1 || !/spirit\.elements/.test(src[n]) || FOUR.some(function (o) { return o !== n && src[n].indexOf('function ' + o) !== -1; })); });
if (!missing.length && !wrong.length) test.check('iconSelector.js, contactSelector.js, appServerSelector.js and apiBranchSelector.js each define their one factory and add it to spirit.elements');
else test.fail(OWED + (missing.length ? 'missing files: ' + missing.map(function (n) { return FILES[n]; }).join(', ') : '') + (wrong.length ? ' wrong contents: ' + wrong.map(function (n) { return FILES[n]; }).join(', ') : ''));
if (!fs.existsSync(path.join(DIR, 'elements.js'))) test.check('and the all-in-one elements.js is gone');
else test.fail(OWED + 'spirit/element/elements.js still exists');

test.subHeading('2. loaded by index.html before the shell, app-server before api-branch');
const at = {}; FOUR.forEach(function (n) { at[n] = index.indexOf('src="/spirit/element/' + FILES[n] + '"'); });
const atShell = index.indexOf('src="/spirit/client/shell.js"');
if (FOUR.every(function (n) { return at[n] !== -1 && at[n] < atShell; }) && at.createAppServerSelector < at.createApiBranchSelector && index.indexOf('/spirit/element/elements.js') === -1) {
  test.check('index.html loads the four before /spirit/client/shell.js, app-server before api-branch, and no elements.js');
} else test.fail(OWED + 'index.html positions ' + JSON.stringify(at) + ', shell at ' + atShell + ', elements.js tag ' + (index.indexOf('/spirit/element/elements.js') !== -1));

test.subHeading('3. the shell defines none of them and hands them out as before');
const stillDefined = FOUR.filter(function (n) { return shell.indexOf('function ' + n) !== -1; });
if (stillDefined.length === 0) test.check('shell.js defines none of the four');
else test.fail(OWED + 'shell.js still defines ' + stillDefined.join(', '));
const flat = shell.replace(/\s+/g, ' ');
const handed = FOUR.filter(function (n) { return new RegExp('elements: \\{[^}]*' + n + ': shellElements\\.' + n).test(flat); });
if (handed.length === 4) test.check('and hands all four to apps under api.ui.elements from spirit.elements');
else test.fail(OWED + 'handed from spirit.elements under ui.elements: ' + handed.join(', ') + ' — missing ' + FOUR.filter(function (n) { return handed.indexOf(n) === -1; }).join(', '));

// The contact selector paints from a search that answers later (goal/G4.14), so the report waits for it.
let pending = Promise.resolve();
test.subHeading('4. loaded together, the factories still work as controls');
if (missing.length) {
  test.fail(OWED + 'not every element file exists — the behaviour is owed with them');
} else {
  const window = test.withSpirit({ 'spirit.iconIndex': { choices: function () { return []; }, keyFor: function () { return ''; } }, 'spirit.apiTreeIndex': { servers: function () { return []; }, verbs: function () { return []; } } });
  // goal/G29.6: the contact selector is a wrapper around the shared list, which finds its parts by id; the page hands
  // the same fake element for an id every time.
  const byId = {};
  const getElementById = function (id) { if (!byId[id]) { byId[id] = fakeElement('div'); byId[id].id = id; } return byId[id]; };
  const ctx = {
    window: window, document: { createElement: fakeElement, getElementById: getElementById, body: fakeElement('body'), addEventListener: function () {} }, Event: FakeEvent, console: console,
    spirit: { core: { util: { escapeHtml: spirit.core.util.escapeHtml }, const: { ICON: spirit.core.const.ICON },
      ask: function () { return Promise.resolve({ status: 200, body: { items: [] } }); },
      jobs: { api: function () { return Promise.resolve({ ok: true }); } } } },
  };
  ctx.self = ctx.window;
  let tripped = null;
  // goal/G29.6: as index.html loads them, the probability modules and the shared list (shell/shared/js/listSearch.js)
  // come before contactSelector.js, which builds on window.spirit.elements.shellCreateListSearch.
  const before = ['probabilityStringMatch.js', 'probabilityStringObjectMatch.js', 'probabilityBucket.js'].map(function (f) { return path.join(RUN, 'spirit', f); })
    .concat([path.join(RUN, 'shell', 'shared', 'js', 'listSearch.js')]);
  try {
    vm.createContext(ctx);
    before.forEach(function (f) { vm.runInContext(fs.readFileSync(f, 'utf8'), ctx); });
    ['createIconSelector', 'createContactSelector', 'createAppServerSelector', 'createApiBranchSelector'].forEach(function (n) { vm.runInContext(src[n], ctx); });
  } catch (e) { tripped = e; }
  const E = window.spirit.elements;
  if (!tripped && E && FOUR.every(function (n) { return typeof E[n] === 'function'; })) test.check('the four files load on the shell\'s globals alone and expose four functions');
  else test.fail(OWED + (tripped ? 'an element file tripped on load: ' + tripped.message : 'spirit.elements exposes ' + JSON.stringify(E && Object.keys(E))));
  if (E && typeof E.createContactSelector === 'function') {
    // goal/G4.14: the contact selector is a drawn list now, the dropdown the same pane under a button (its own suite,
    // contactSelectorPane.js); what this suite keeps is that it still works as a control on the shell's globals.
    let root = null; let err = null;
    try { root = E.createContactSelector({ contacts: [{ key: 'k1', label: 'Bert' }, { key: 'k2', label: 'Carol' }], placeholder: 'who?' }); } catch (e) { err = e; }
    // goal/G29.6: the rows are the shared list's markup, <tr data-key> strings in its list part (listsearch-<n>-list),
    // the name in its own cell; a press reaches the list's click handler on the pane, which finds the row by data-key.
    const paneOf = function () { return root ? (root.children || []).filter(function (c) { return /\bcontact-selector-pane\b/.test(c.className); })[0] : null; };
    pending = Promise.resolve().then(function () { return new Promise(function (r) { setImmediate(r); }); }).then(function () {
      const pane = paneOf();
      const pre = pane && /id="(listsearch-\d+-)list"/.exec(pane.innerHTML);
      const listHtml = pre ? getElementById(pre[1] + 'list').innerHTML : '';
      const rowHtml = function (key) { return (listHtml.match(new RegExp('<tr[^>]*data-key="' + key + '"[^>]*>[\\s\\S]*?</tr>')) || [''])[0]; };
      const named = /<td[^>]*>Bert<\/td>/.test(rowHtml('k1'));
      if (!err && root && /contact-selector/.test(root.className) && named && root.value === '') {
        test.check('a contact selector from given rows paints them, and answers nothing until a pick');
      } else test.fail(OWED + 'contact selector: ' + (err ? 'threw ' + err.message : 'className ' + JSON.stringify(root && root.className) + ', Bert drawn ' + named + ', value ' + JSON.stringify(root && root.value)));
      if (pane && rowHtml('k1')) {
        let bubbled = 0;
        root.addEventListener('change', function () { bubbled += 1; });
        const ev = new FakeEvent('click', { bubbles: true });
        ev.target = { getAttribute: function (k) { return k === 'data-key' ? 'k1' : null; }, closest: function () { return null; } };
        pane.dispatchEvent(ev);
        // goal/G29.6: root.row is the row's object, its name the row's (a label that is not json is the name).
        if (root.value === 'k1' && root.row && root.row.name === 'Bert' && bubbled === 1) test.check('a pick sets root.value to the key and fires one bubbling change on the root');
        else test.fail(OWED + 'after a pick: value ' + JSON.stringify(root.value) + ', row ' + JSON.stringify(root.row) + ', changes on the root ' + bubbled);
      } else test.fail(OWED + 'no row k1 drawn to pick');
    });
  }
}

pending.then(function () { test.reportSuccessFailureCount(); });
