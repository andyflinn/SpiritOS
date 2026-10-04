'use strict';

// goal/G4.23, the rest: the scope pane — the agent bubbles become tab headers, each opening that agent's scope, edited
// with a path selector, a shell element on the shell's one file tree. Red on today's tree; wsl-claude wrote it,
// claude-windows builds it.
//   Andy, 2026-10-04 (box of goal/G4.23): "the red-bordered agent bubbles become tab-headers again, with their own pane
//   for scope-configuration. file/folder selector in it a shell element."; "i alone"; "so this one first, then we worry
//   about the pickers?" (G4.25, the shell's one tree, came first and is built); "i'll do the third when the ui arrives".
//
// THE SHAPES, NAMED HERE where the box names none (wsl-claude's picks; the builder may argue them in Desk first):
//   1  THE ELEMENT: spirit/run/shell/js/pathSelector.js adds window.spiritElements.createPathSelector(options), as
//      contactSelector.js adds its own. options.files() answers the shell's tree as it stands ([{relativePath, kind}],
//      shell.currentFiles(), goal/G4.25); options.foldersOnly hides files. Its root holds a text input and one row per
//      match, each a created element with data-path: a folder's path with a trailing '/', relative to spirit/run as the
//      tree is. Typing narrows the rows (case ignored); a click on a row sets root.value to its data-path and fires one
//      bubbling 'change'. Rows are bounded (at most 50), never the whole tree.
//   2  THE TABS: each live agent's bubble is also a tab button, data-tab="agent:<name>" beside its data-bubble. Opening
//      it shows the pane data-pane="agent" and asks scope.get {agent: <its key>}, the key from the goal row's agents
//      map (desk.js facts: f.agents). The pane, #desk-agent, lists each folder with a button data-scope-remove="<folder>"
//      ('' drawn as the repo root), and mounts a path selector (api.ui.elements.createPathSelector, foldersOnly) in
//      #desk-agent-picker.
//   3  THE EDITS: a pick in the selector sends scope.set {agent: key, folders: the folders shown plus 'spirit/run/' +
//      the picked path}; a click on data-scope-remove sends scope.set without that folder. The pane redraws from the
//      answer of a new scope.get, never from what it guessed.
//
// LEFT OPEN, not asserted: picking the repo root itself (the tree holds spirit/run only); styling; the pane for an
// agent that is not live.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G4.23: ';
const RUN = path.join(__dirname, '..', 'run');
const ELEMENT = path.join(RUN, 'shell', 'js', 'pathSelector.js');
const DESK = path.join(RUN, 'shell', 'desk', 'desk.js');
const CW_KEY = 'MCowBQYDK2VwAyEAdeskScopePaneTestCWAAAAAAAAAAAAAAAAAAAA=';

function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
async function settled() { for (let i = 0; i < 8; i++) await settle(); }
function short(x) { return String(JSON.stringify(x)).slice(0, 220); }

// A small DOM of created nodes, as contactSelectorPane.js has one.
function node(tag) {
  let html = '';
  const e = { tagName: String(tag || 'div').toUpperCase(), value: '', textContent: '', className: '', style: {}, dataset: {}, children: [], listeners: {}, parentNode: null, hidden: false, attrs: {}, id: '',
    appendChild: function (c) { if (c.parentNode) c.parentNode.removeChild(c); e.children.push(c); c.parentNode = e; return c; },
    insertBefore: function (c) { return e.appendChild(c); },
    removeChild: function (c) { e.children = e.children.filter(function (x) { return x !== c; }); c.parentNode = null; return c; },
    replaceChildren: function () { e.children.forEach(function (c) { c.parentNode = null; }); e.children = []; Array.from(arguments).forEach(function (c) { e.appendChild(c); }); },
    remove: function () { if (e.parentNode) e.parentNode.removeChild(e); },
    addEventListener: function (t, fn) { (e.listeners[t] = e.listeners[t] || []).push(fn); },
    removeEventListener: function (t, fn) { e.listeners[t] = (e.listeners[t] || []).filter(function (f) { return f !== fn; }); },
    dispatchEvent: function (ev) { bubble(e, ev); return true; },
    setAttribute: function (k, v) { e.attrs[k] = String(v); if (k.indexOf('data-') === 0) e.dataset[k.slice(5).replace(/-([a-z])/g, function (m, ch) { return ch.toUpperCase(); })] = String(v); if (k === 'class') e.className = String(v); if (k === 'hidden') e.hidden = true; },
    getAttribute: function (k) { if (k.indexOf('data-') === 0) { const d = e.dataset[k.slice(5).replace(/-([a-z])/g, function (m, ch) { return ch.toUpperCase(); })]; return d === undefined ? null : d; } return e.attrs[k] === undefined ? null : e.attrs[k]; },
    removeAttribute: function (k) { delete e.attrs[k]; if (k === 'hidden') e.hidden = false; },
    closest: function (sel) { for (let n = e; n; n = n.parentNode) { const a = /^\[([\w-]+)\]$/.exec(sel); if (a && n.getAttribute && n.getAttribute(a[1]) !== null) return n; } return null; },
    contains: function (x) { for (let n = x; n; n = n.parentNode) if (n === e) return true; return false; },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    focus: function () {}, select: function () {}, blur: function () {},
  };
  e.classList = { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } };
  Object.defineProperty(e, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); e.children = []; }, enumerable: true });
  return e;
}
function bubble(target, ev) {
  if (!ev.target) { try { Object.defineProperty(ev, 'target', { value: target, configurable: true }); } catch (x) { ev.target = target; } }
  for (let n = target; n; n = n.parentNode) (n.listeners[ev.type] || []).slice().forEach(function (fn) { fn.call(n, ev); });
}
function fire(n, type) { bubble(n, { type: type, bubbles: true, preventDefault: function () {}, stopPropagation: function () {} }); }
function all(root) { return [root].concat(root.children.reduce(function (acc, c) { return acc.concat(all(c)); }, [])); }
function visible(n, root) { for (let x = n; x; x = x.parentNode) { if (x.hidden || (x.style && x.style.display === 'none')) return false; if (x === root) return true; } return true; }
function rowsOf(root) { return all(root).filter(function (n) { return n.getAttribute && n.getAttribute('data-path') !== null && visible(n, root); }); }

const TREE = [
  { relativePath: 'shell', kind: 'folder' },
  { relativePath: 'shell/ticTacToe', kind: 'folder' },
  { relativePath: 'shell/ticTacToe/game.js', kind: 'file' },
  { relativePath: 'shell/chess', kind: 'folder' },
  { relativePath: 'js', kind: 'folder' },
  { relativePath: 'js/kernel.js', kind: 'file' },
];

test.startTest('goal/G4.23: the scope pane — agent tabs, and the path selector on the shell\'s tree');

(async function () {
  // ── 1. the element ──
  test.subHeading('1. the path selector: folders of the shell\'s tree, narrowed by typing, a pick fires change');
  let make = null;
  if (fs.existsSync(ELEMENT)) {
    const doc = { createElement: node, createTextNode: function (t) { const n = node('#text'); n.textContent = String(t); return n; }, addEventListener: function () {}, removeEventListener: function () {} };
    const win = { spiritElements: {} };
    const sp = { core: { util: { escapeHtml: kernel.core.util.escapeHtml }, const: { ICON: kernel.core.const.ICON } } };
    try { new Function('spirit', 'document', 'window', 'Event', 'CustomEvent', fs.readFileSync(ELEMENT, 'utf8'))(sp, doc, win, Event, CustomEvent); make = win.spiritElements.createPathSelector; } catch (e) { make = null; }
  }
  if (typeof make !== 'function') test.fail(OWED + 'no spirit/run/shell/js/pathSelector.js adding window.spiritElements.createPathSelector');
  else {
    const root = make({ files: function () { return TREE; }, foldersOnly: true });
    await settled();
    const paths = rowsOf(root).map(function (r) { return r.getAttribute('data-path'); }).sort();
    if (JSON.stringify(paths) === JSON.stringify(['js/', 'shell/', 'shell/chess/', 'shell/ticTacToe/'])) test.check('foldersOnly: one row per folder, its path with a trailing \'/\', no files');
    else test.fail(OWED + 'the rows were ' + short(paths));
    const input = all(root).filter(function (n) { return n.tagName === 'INPUT'; })[0];
    if (input) { input.value = 'TIC'; fire(input, 'input'); await settled(); }
    const narrowed = rowsOf(root).map(function (r) { return r.getAttribute('data-path'); });
    if (input && JSON.stringify(narrowed) === '["shell/ticTacToe/"]') test.check('typing "TIC" narrows to shell/ticTacToe/');
    else test.fail(OWED + 'after typing, the rows were ' + short(narrowed));
    let changes = 0;
    root.addEventListener('change', function () { changes += 1; });
    const row = rowsOf(root)[0];
    if (row) { fire(row, 'click'); await settled(); }
    if (row && root.value === 'shell/ticTacToe/' && changes === 1) test.check('a click on the row sets root.value and fires one change');
    else test.fail(OWED + 'after the click, value ' + short(root.value) + ', changes ' + changes);
    const big = [];
    for (let i = 0; i < 120; i++) big.push({ relativePath: 'many/f' + i, kind: 'folder' });
    const wide = make({ files: function () { return big; }, foldersOnly: true });
    await settled();
    if (rowsOf(wide).length > 0 && rowsOf(wide).length <= 50) test.check('a tree of 120 folders shows ' + rowsOf(wide).length + ' rows, never all');
    else test.fail(OWED + 'a tree of 120 folders showed ' + rowsOf(wide).length + ' rows');
  }

  // ── 2-3. the desk page ──
  await thePage();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 200);
});

async function thePage() {
  test.subHeading('2. the agent bubbles are tabs; a tab shows that agent\'s scope');
  const byId = {};
  const doc = { getElementById: function (id) { if (!byId[id]) { byId[id] = node('div'); byId[id].id = id; } return byId[id]; }, createElement: node, all: byId };
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DESK, 'utf8'))({ shell: { activateApp: function (x) { behavior = x; } }, core: kernel.core }, doc, {});
  const asked = [];
  let scope = ['spirit/run/shell/chess/'];
  const pickers = [];
  const goalRow = { id: 't/G1', title: 'The goal', goal: '', status: '', with: '', buttons: [], blocking: [], blocked: [], design: false, waiting: 0,
    live: ['claude-windows'], working: [], agents: { 'claude-windows': CW_KEY }, alone: false, alert: false, claims: 0, asks: 0, boxTaken: '' };
  const container = node('div');
  behavior.mount(container, {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      if (name !== 'jobs.api' || !ask) return Promise.resolve({ status: 200, body: {} });
      const v = Object.keys(ask)[0];
      asked.push({ verb: v, args: ask[v] });
      if (v === 'items.search') return Promise.resolve({ status: 200, body: { items: [{ key: 't/G1', label: JSON.stringify(goalRow) }], more: false } });
      if (v === 'scope.get') return Promise.resolve({ status: 200, body: { folders: scope.slice() } });
      if (v === 'scope.set') { scope = ask[v].folders.slice(); return Promise.resolve({ status: 200, body: { change: 9 } }); }
      return Promise.resolve({ status: 200, body: { items: [], more: false, json: '{}', chat: [], chatMore: false } });
    },
    ui: { elements: { createPathSelector: function (o) { const r = node('div'); r.options = o; pickers.push(r); return r; } } },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    peerPost: function () { return Promise.resolve({ ok: true }); }, callDialog: function () { return new Promise(function () {}); },
    armUntilElsewhere: function () {}, fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  await settled();
  const tabs = byId['desk-tabs'] ? byId['desk-tabs'].innerHTML : '';
  if (/data-tab="agent:claude-windows"/.test(tabs) && /data-bubble="claude-windows"/.test(tabs)) test.check('the bubble of claude-windows is a tab: data-tab="agent:claude-windows"');
  else test.fail(OWED + 'the tab strip: bubble ' + /data-bubble="claude-windows"/.test(tabs) + ', tab ' + /data-tab="agent:claude-windows"/.test(tabs));
  const t = node('button');
  t.setAttribute('data-tab', 'agent:claude-windows');
  doc.getElementById('desk-tabs').appendChild(t);
  bubble(t, { type: 'click', bubbles: true, currentTarget: doc.getElementById('desk-tabs'), preventDefault: function () {}, stopPropagation: function () {} });
  await settled();
  const got = asked.filter(function (a) { return a.verb === 'scope.get'; });
  if (got.length && got[got.length - 1].args.agent === CW_KEY) test.check('opening it asks scope.get with that agent\'s key, from the goal row\'s agents');
  else test.fail(OWED + 'scope.get asked ' + short(got));
  const pane = byId['desk-agent'] ? byId['desk-agent'].innerHTML + ' ' + all(byId['desk-agent']).map(function (n) { return n.innerHTML; }).join(' ') : '';
  if (/data-scope-remove="spirit\/run\/shell\/chess\/"/.test(pane)) test.check('#desk-agent lists its folder with a remove button');
  else test.fail(OWED + '#desk-agent held ' + short(pane));
  const picker = pickers[pickers.length - 1];
  if (picker && picker.options && picker.options.foldersOnly === true && picker.parentNode && picker.parentNode.id === 'desk-agent-picker') test.check('a path selector (foldersOnly) is mounted in #desk-agent-picker');
  else test.fail(OWED + 'path selectors made: ' + pickers.length + (picker ? ', options ' + short(picker.options) + ', in ' + short(picker.parentNode && picker.parentNode.id) : ''));

  test.subHeading('3. a pick adds a folder, a remove takes one away, each through scope.set');
  if (picker) { picker.value = 'shell/ticTacToe/'; fire(picker, 'change'); await settled(); }
  let sets = asked.filter(function (a) { return a.verb === 'scope.set'; });
  const added = sets[0] && sets[0].args;
  if (added && added.agent === CW_KEY && JSON.stringify(added.folders) === JSON.stringify(['spirit/run/shell/chess/', 'spirit/run/shell/ticTacToe/'])) test.check('picking shell/ticTacToe/ sends scope.set with spirit/run/shell/ticTacToe/ added');
  else test.fail(OWED + 'after the pick scope.set was ' + short(sets));
  const getsAfter = asked.filter(function (a) { return a.verb === 'scope.get'; }).length;
  if (getsAfter > got.length) test.check('and the pane asks scope.get again rather than guessing');
  else test.fail(OWED + 'no scope.get after the pick');
  const rm = node('button');
  rm.setAttribute('data-scope-remove', 'spirit/run/shell/chess/');
  doc.getElementById('desk-agent').appendChild(rm);
  bubble(rm, { type: 'click', bubbles: true, preventDefault: function () {}, stopPropagation: function () {} });
  await settled();
  sets = asked.filter(function (a) { return a.verb === 'scope.set'; });
  const removed = sets[sets.length - 1] && sets[sets.length - 1].args;
  if (sets.length >= 2 && removed.agent === CW_KEY && removed.folders.indexOf('spirit/run/shell/chess/') === -1 && removed.folders.indexOf('spirit/run/shell/ticTacToe/') !== -1) test.check('removing chess sends scope.set without it');
  else test.fail(OWED + 'after the remove scope.set was ' + short(sets));
}
