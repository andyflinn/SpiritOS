'use strict';

// spirit/test/deskLayout.js
// DESK LAYOUT AND BUTTONS — desk/G1.12, written FIRST, red on today's code.
//
//   Andy's UI notes of 2026-09-29, agreed as one item ("the rest of your
//   list i agree to"), his go on desk/G1.12.
//
// THE CONTRACT (claude-windows, for wsl-claude's build):
//   T1 #desk-tabs and #desk-agent-tabs are position: sticky, top: 0; the
//      design-mode button is the last button in #desk-tabs.
//   T2 Start/End design mode fire only on the SECOND press: the first
//      press arms it (its label asks 'sure?') and posts nothing.
//   T3 a dialog's screen title starts with the item's id, then its title.
//   T4 in a dialog, the buttons offered to Andy (here Go! and No) sit in
//      #dd-name-row before #dd-rename; the 'How you can check' line is the
//      next thing after that row, outside #dd-item.
//   T5 a group with nothing in it draws no heading ('Blocked by' with no
//      blockers); every foldable box starts folded: Desk's bubble with no
//      seen.json, a dialog's item box, and the rules box.
//   T6 chat boxes are <textarea>s, and Return in one sends nothing.
//   T7 Desk's state cell reads 'blocked' for an item waiting on an open
//      one and 'blocking' for an item an open one waits on.
//
// NOTE FOR THE BUILD: deskFold.js assumes a box starts open; with T5 it
// starts folded, so that suite's first check changes with this item.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const DESK = path.join(__dirname, '..', 'run', 'app', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'app', 'deskDetails', 'deskDetails.js');
const LEAD = 'MCowBQYDK2VwAyEAleadleadleadleadleadleadleadleadleadl=';
const OWED = 'OWED by desk/G1.12: ';

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, style: {}, listeners: {}, placeholder: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function fakeDocument() {
  const byId = {};
  return { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
}
function load(script, doc) {
  let b = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(script, 'utf8'))(
    { shell: { activateApp: function (x) { b = x; } }, core: kernel.core }, doc, {});
  return b;
}
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
function clickTarget(el, attrs) {
  return { id: attrs.id || '', getAttribute: function (n) { return attrs[n] || null; }, closest: function () { return null; }, parentNode: null };
}

let n = 0;
function row(from, kind, text, todo) {
  n += 1;
  const dir = from === 'andy' ? 'out' : 'in';
  return { key: 'k' + n, at: new Date(Date.now() - 3600000 + n * 1000).toISOString(), dir: dir, peer: LEAD,
    outcome: dir === 'in' ? 'received' : 'sent', from: from, kind: kind, text: text, todo: todo };
}
const SESSION = JSON.stringify({ goal: { id: 't/G1', title: 'Goal', description: 'GOAL-TEXT' },
  rules: [{ id: 't/G1.rule1', text: 'RULE-TEXT' }],
  items: [
    { id: 't/G1.1', title: 'First', blocks: ['t/G1', 't/G1.2'] },
    { id: 't/G1.2', title: 'Second' },
  ] });
const log = [row('claude-windows', 'session', SESSION, 'team/chat'), row('andy', 'answer', 'start design mode.', 'team/chat')];

const posted = [];
const files = { 'log/log.json': JSON.stringify(log) };
const doc = fakeDocument();
const root = fakeElement('container');
load(DESK, doc).mount(root, {
  fs: { loadFile: function (f) { return Object.prototype.hasOwnProperty.call(files, f) ? files[f] : null; }, saveFile: function (f, c) { files[f] = c; return Promise.resolve(); } },
  escapeHtml: kernel.core.util.escapeHtml,
  verb: function () { return Promise.resolve({ status: 200, body: {} }); },
  onPacket: function () {},
  peerPost: function (app, key, body) { posted.push(body); return Promise.resolve({ ok: true, status: 200, hash: 'h' + posted.length }); },
  callDialog: function () { return new Promise(function () {}); },
});

function stateOf(id) {
  const html = doc.getElementById('desk-top').innerHTML;
  const tr = (html.match(new RegExp('<tr data-id="' + id.replace(/[/.]/g, '\\$&') + '"[\\s\\S]*?</tr>')) || [''])[0];
  const cells = (tr.match(/<td[^>]*>[\s\S]*?<\/td>/g) || []).map(function (c) { return c.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); });
  return cells[cells.length - 1] || '';
}

test.startTest('desk/G1.12: Desk layout and buttons');
settle().then(function () {
  const tabs = doc.getElementById('desk-tabs');
  tabs.fire('click', { target: clickTarget(tabs, { 'data-tab': 'team' }), currentTarget: tabs });

  test.subHeading('T1: the tab rows are pinned, and the design button is last');
  const shell = root.innerHTML;
  const sticky = function (id) { const tag = (shell.match(new RegExp('<div[^>]*id="' + id + '"[^>]*>')) || [''])[0]; return /position:\s*sticky/.test(tag) && /top:\s*0/.test(tag); };
  const buttons = tabs.innerHTML.match(/<button[^>]*>/g) || [];
  const last = buttons[buttons.length - 1] || '';
  if (sticky('desk-tabs') && sticky('desk-agent-tabs') && /desk-(end|start)-design/.test(last)) test.check('both tab rows are sticky at top: 0, and the design button closes the row');
  else test.fail(OWED + 'sticky tabs ' + sticky('desk-tabs') + ', agent tabs ' + sticky('desk-agent-tabs') + ', last button ' + last);

  test.subHeading('T2: design mode ends only on the second press');
  posted.length = 0;
  const press = function () { tabs.fire('click', { target: clickTarget(tabs, { id: 'desk-end-design' }), currentTarget: tabs }); };
  press();
  return settle().then(function () {
    const afterOne = posted.length;
    const armed = /sure\?/i.test(tabs.innerHTML);
    press();
    return settle().then(function () {
      const ended = posted.some(function (b) { return b.text === 'end design mode.'; });
      if (afterOne === 0 && armed && ended) test.check('the first press armed it (sure?) and sent nothing; the second ended design mode');
      else test.fail(OWED + 'after one press ' + afterOne + ' sent, armed ' + armed + '; after two, ended ' + ended);
    });
  });
}).then(function () {
  test.subHeading("T7: Desk works out blocked and blocking");
  // Design mode is on in this log, so no Go! interferes.
  const s1 = stateOf('t/G1.1');
  const s2 = stateOf('t/G1.2');
  if (/\bblocking\b/.test(s1) && /\bblocked\b/.test(s2)) test.check('t/G1.1 reads blocking, t/G1.2 (waiting on it) reads blocked');
  else test.fail(OWED + 't/G1.1 reads ' + JSON.stringify(s1) + ', t/G1.2 reads ' + JSON.stringify(s2));

  test.subHeading('T5 in Desk: the bubble starts folded, rules included, with no seen.json');
  const bubble = doc.getElementById('desk-session').innerHTML;
  if (/Goal/.test(bubble) && !/GOAL-TEXT/.test(bubble) && !/RULE-TEXT/.test(bubble)) test.check('on a first open the top box shows its title line only');
  else test.fail(OWED + 'the bubble on first open: ' + bubble.replace(/\s+/g, ' ').slice(0, 200));

  // Andy, while G1.12 was being built: "this 'Upgrading Desk with deeper
  // integration onto SpiritOS (desk/G1)' is also a large text block. it
  // should be foldable."
  test.subHeading('T8: the goal banner at the top folds too, and starts folded to its id');
  const banner = doc.getElementById('desk-goal');
  const shown = banner.innerHTML + ' ' + banner.textContent;
  if (/data-fold="goal"/.test(shown) && /t\/G1/.test(shown) && !/\bGoal\b/.test(shown.replace(/data-fold="goal"/g, ''))) {
    test.check('the banner carries a goal fold toggle and, folded, shows the id only');
  } else test.fail(OWED + 'the goal banner shows ' + JSON.stringify(shown.slice(0, 160)));

  test.subHeading('T6: chat boxes take several lines, and Return sends nothing');
  const shell = root.innerHTML;
  const say = doc.getElementById('desk-team-say');
  const areas = ['desk-team-say', 'desk-muse'].filter(function (id) { return new RegExp('<textarea[^>]*id="' + id + '"').test(shell); });
  posted.length = 0;
  say.value = 'first thought';
  say.fire('keydown', { key: 'Enter', repeat: false, preventDefault: function () {} });
  return settle().then(function () {
    if (areas.length === 2 && posted.length === 0) test.check('the Team and Musings boxes are textareas; Return in one sent nothing');
    else test.fail(OWED + 'textareas ' + JSON.stringify(areas) + ', sent on Return ' + posted.length);
  });
}).then(function () {
  // ── The dialog ──────────────────────────────────────────────────────
  const ddDoc = fakeDocument();
  const dd = load(DETAILS, ddDoc);
  let screenTitle = '';
  const session = [
    { id: 't/G1.2', title: 'Second', description: 'ITEM-TEXT', check: 'CHECK-TEXT', tests: [], inPlace: [], blocks: ['t/G1'], waitsOn: [], verified: true, done: false },
  ];
  dd.mount(fakeElement('dd'), { escapeHtml: kernel.core.util.escapeHtml, onPacket: function () {}, setScreenTitle: function (t) { screenTitle = String(t); },
    peerPost: function () { return Promise.resolve({ ok: true }); }, closeDialog: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } } });
  dd.open({ id: 't/G1.2', row: session[0], agents: {}, session: session, rules: [],
    thread: [row('claude-windows', 'note', 'IN PLACE VERIFIED', 't/G1.2'), row('claude-windows', 'ask', 'ready: go?', 't/G1.2')] });
  return settle().then(function () {
    test.subHeading("T3: a dialog's title starts with the item's id");
    if (/^\s*t\/G1\.2\b|^\s*G1\.2\b/.test(screenTitle) && /Second/.test(screenTitle)) test.check('the screen title reads ' + JSON.stringify(screenTitle));
    else test.fail(OWED + 'the screen title is ' + JSON.stringify(screenTitle));

    test.subHeading('T4: your buttons sit before Rename, the check line right under them');
    const body = ddDoc.getElementById('dd-body').innerHTML;
    // The Rename row is drawn inside #dd-body's frame, or into its own
    // element when repainted: read whichever holds it.
    const ownRow = ddDoc.getElementById('dd-name-row').innerHTML;
    const nameRow = ownRow || (body.match(/<div[^>]*id="dd-name-row"[^>]*>[\s\S]*?<\/div>/) || [''])[0];
    const goAt = nameRow.search(/id="dd-go"/);
    const renameAt = nameRow.search(/id="dd-rename"/);
    const item = ddDoc.getElementById('dd-item').innerHTML;
    const rowEnd = body.indexOf('id="dd-name-row"');
    const checkAt = body.indexOf('CHECK-TEXT');
    if (goAt !== -1 && renameAt !== -1 && goAt < renameAt && !/CHECK-TEXT/.test(item) && checkAt > rowEnd) {
      test.check('Go! stands before Rename on one line; How you can check follows it, outside the item box');
    } else test.fail(OWED + 'name row ' + nameRow.slice(0, 160) + ' | check in item box ' + /CHECK-TEXT/.test(item));

    test.subHeading("T5 in the dialog: the item box starts folded, and empty groups draw nothing");
    if (!/ITEM-TEXT/.test(item) && /Second/.test(item) && !/Blocked by/.test(body)) test.check('the item box opens folded, and no Blocked by heading shows for an item nothing blocks');
    else test.fail(OWED + 'item box ' + item.replace(/\s+/g, ' ').slice(0, 160) + ' | Blocked by shown ' + /Blocked by/.test(body));
  });
}).catch(function (e) { test.fail('the run broke: ' + e.message); }).then(function () { test.reportSuccessFailureCount(); });
