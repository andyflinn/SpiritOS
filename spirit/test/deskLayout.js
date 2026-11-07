'use strict';

// spirit/test/deskLayout.js
// DESK LAYOUT AND BUTTONS — desk/G1.12.
//
//   Andy's UI notes of 2026-09-29, agreed as one item ("the rest of your
//   list i agree to").
//
// WHAT IS ASSERTED:
//   T1 one block, #desk-bars, pinned by the app header (createAppHeader),
//      holds the one tab row #desk-tabs, no agent row; the design-mode
//      button is the last button in #desk-tabs. T12: no #desk-goal in it.
//   T14 the tab row holds List and Rules on every tab, no Apps or Team.
//   T2 End design mode fires only on the SECOND press: the first press
//      arms it (its label asks 'sure?') and sends nothing.
//   T7 Desk's state cell reads 'blocked' for an item waiting on an open
//      one and 'blocking' for an item an open one waits on.
//   T9 the unseen star has the first column, the type icon the second.
//   In a dialog: T3 the screen title starts with the item's id, then its
//   title; T4 Go! sits before Rename and the C checks are in the red Qs'
//   panel; T5 the box shows at once and empty groups draw nothing; T13 the
//   button row is pinned above #dd-upper; T10/T15 the title is the title
//   bar, with the status; T11 no yellow check line.
// THIS SUITE NO LONGER RUNS ON TODAY'S PAGES: desk.js's mount asks
// spirit.require (deskNeed), which the fake spirit here does not give, so it
// throws "no spirit.require on this page" before T1; and the dialog parts
// it reads (#dd-upper, data-panel icons, createAppHeader) are gone since
// goal/G41.19 and G41.22.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/spirit/kernel.js');

const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
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
const SESSION = JSON.stringify({ goal: { id: 'goal/G100', title: 'Goal', description: 'GOAL-TEXT' },
  rules: [{ id: 'goal/G100.rule1', text: 'RULE-TEXT' }],
  items: [
    { id: 'goal/G100.1', title: 'First', blocks: ['goal/G100', 'goal/G100.2'] },
    { id: 'goal/G100.2', title: 'Second' },
  ] });
const log = [row('claude-windows', 'session', SESSION, 'team/chat'), row('andy', 'answer', 'start design mode.', 'team/chat')];

const posted = [];
const files = { 'log/log.json': JSON.stringify(log) };
// THE LIST IS THE DESK SERVER'S (desk/G2.6): the goal row says design mode,
// each row its status.
const fake = require('./deskFake.js').fromFiles(files);
const label = function (o) { return Object.assign({ goal: 'goal/G100', status: '', with: '', buttons: [], blocking: [], blocked: [], star: false }, o); };
fake.items = [
  label({ id: 'goal/G100', title: 'Goal', goal: '', design: true, waiting: 0, blocked: ['goal/G100.1'] }),
  label({ id: 'goal/G100.1', title: 'First', status: 'blocking', blocking: ['goal/G100', 'goal/G100.2'] }),
  label({ id: 'goal/G100.2', title: 'Second', status: 'blocked', blocked: ['goal/G100.1'] }),
];
const doc = fakeDocument();
const root = fakeElement('container');
load(DESK, doc).mount(root, {
  fs: { loadFile: function (f) { return Object.prototype.hasOwnProperty.call(files, f) ? files[f] : null; }, saveFile: function (f, c) { files[f] = c; return Promise.resolve(); } },
  escapeHtml: kernel.core.util.escapeHtml,
  verb: fake.verb,
  onPublished: function () {}, onPacket: function () {},
  peerPost: function (app, key, body) { posted.push(body); return Promise.resolve({ ok: true, status: 200, hash: 'h' + posted.length }); },
  callDialog: function () { return new Promise(function () {}); },
});

function stateOf(id) {
  const html = doc.getElementById('desk-top').innerHTML;
  const tr = (html.match(new RegExp('<tr data-row="' + id.replace(/[/.]/g, '\\$&') + '"[\\s\\S]*?</tr>')) || [''])[0];
  const cells = (tr.match(/<td[^>]*>[\s\S]*?<\/td>/g) || []).map(function (c) { return c.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); });
  return cells[cells.length - 1] || '';
}

test.startTest('desk/G1.12: Desk layout and buttons');
settle().then(function () {
  const tabs = doc.getElementById('desk-tabs');
  // The face is read as it opens, on the List.

  test.subHeading('T1: the tab rows are pinned, and the design button is last');
  const shell = root.innerHTML;
  // ONE PINNED BLOCK: two rows each stuck at top 0 would slide one under the other. It sticks BELOW the title
  // bar (goal/G2.1 note 4; Andy: "stay sticky below those title bars"). The sticking is the shell's app header
  // (goal/G6.1): the block is #desk-bars, desk.js is looked for moving it into createAppHeader(), and no tag of its
  // own markup sticks.
  const stickies = shell.match(/<div[^>]*position:\s*sticky[^>]*>/g) || [];
  const deskCode = fs.readFileSync(DESK, 'utf8');
  const viaHeader = /createAppHeader/.test(deskCode) && stickies.length === 0;
  const at = viaHeader ? shell.indexOf('id="desk-bars"') : -1;
  const tabsAt = shell.indexOf('id="desk-tabs"');
  // ONE ROW (goal/G3.12): no agent row; the bubbles ride in #desk-tabs.
  const paneAt = shell.indexOf('data-pane=');
  const pinned = at !== -1 && at < tabsAt && tabsAt < paneAt && shell.indexOf('id="desk-agent-tabs"') === -1;
  const buttons = tabs.innerHTML.match(/<button[^>]*>/g) || [];
  const last = buttons[buttons.length - 1] || '';
  if (pinned && /desk-(end|start)-design/.test(last)) test.check('one block, pinned by the app header, holds the tab row, no agent row, and the design button closes the row');
  else test.fail(OWED + 'sticky tags ' + JSON.stringify(stickies) + ', row inside it ' + pinned + ', last button ' + last);

  // There is no goal line in the header (goal/G9.6: "the desk is only about the current goal"), and the List's
  // goal row opens it. T12 is the pinned block holding the tabs (deskHeaderArea.js holds the rest).
  test.subHeading('T12: the pinned block holds the tabs, and no goal line any more');
  const barsAt = at;
  const goalAt = shell.indexOf('id="desk-goal"');
  if (barsAt !== -1 && goalAt === -1 && tabsAt > barsAt) test.check('#desk-bars holds the tabs and no #desk-goal');
  else test.fail(OWED + 'sticky block at ' + barsAt + ', goal line at ' + goalAt + ', tabs at ' + tabsAt);

  // The bubbles show on every tab (goal/G3.12; deskFrontPage.js asserts them on the List tab).
  test.subHeading('T14: the tab row is one row on every tab');
  const tabTo = function (name) { tabs.fire('click', { target: clickTarget(tabs, { 'data-tab': name }), currentTarget: tabs }); return tabs.innerHTML; };
  const rows = [tabTo('list'), tabTo('rules')];
  // goal/G43.22 ("the apps and plugin system goes."): the one row holds List and Rules, and no Apps or Team tab.
  if (rows.every(function (h) { return /data-tab="list"/.test(h) && /data-tab="rules"/.test(h) && !/data-tab="apps"/.test(h) && !/data-tab="team"/.test(h) && !/data-agent=/.test(h); })) test.check('List and Rules, no Apps or Team: the one tab row, no agent tab on any');
  else test.fail(OWED + 'the tab row across the tabs: ' + JSON.stringify(rows.map(function (h) { return h.slice(0, 80); })));

  test.subHeading('T2: design mode ends only on the second press');
  posted.length = 0;
  const press = function () { tabs.fire('click', { target: clickTarget(tabs, { id: 'desk-end-design' }), currentTarget: tabs }); };
  press();
  return settle().then(function () {
    const afterOne = posted.length;
    const armed = /sure\?/i.test(tabs.innerHTML);
    press();
    return settle().then(function () {
      // A press on the goal, not a line (desk/G2.6).
      const ended = fake.calls.some(function (k) { return k.verb === 'press' && k.args.what === 'end-design' && k.args.id === 'goal/G100' && !('by' in k.args); });
      if (afterOne === 0 && armed && ended) test.check('the first press armed it (sure?) and sent nothing; the second ended design mode');
      else test.fail(OWED + 'after one press ' + afterOne + ' sent, armed ' + armed + '; after two, ended ' + ended);
    });
  });
}).then(function () {
  test.subHeading("T7: the status column reads what the desk server says");
  const s1 = stateOf('goal/G100.1');
  const s2 = stateOf('goal/G100.2');
  if (/\bblocking\b/.test(s1) && /\bblocked\b/.test(s2)) test.check('goal/G100.1 reads blocking, goal/G100.2 (waiting on it) reads blocked');
  else test.fail(OWED + 'goal/G100.1 reads ' + JSON.stringify(s1) + ', goal/G100.2 reads ' + JSON.stringify(s2));

  // Andy: "the red stars should be in a separage first column, the
  // task-type icons in the second column."
  test.subHeading('T9: the unseen star has the first column to itself, the type icon the second');
  const list = doc.getElementById('desk-top').innerHTML;
  const firstRow = (list.match(/<tr data-row="goal\/G100\.2"[\s\S]*?<\/tr>/) || [''])[0];
  const tds = firstRow.match(/<td[^>]*>[\s\S]*?<\/td>/g) || [];
  const icons = [kernel.core.const.ICON.ERROR, kernel.core.const.ICON.CODE];
  const hasIcon = function (c) { return icons.some(function (i) { return c.indexOf(i) !== -1; }); };
  if (tds.length > 2 && !hasIcon(tds[0]) && hasIcon(tds[1])) test.check('column 1 carries no type icon; column 2 carries it');
  else test.fail(OWED + 'first two cells ' + JSON.stringify(tds.slice(0, 2)));

}).then(function () {
  // ── The dialog ──────────────────────────────────────────────────────
  // The dialog paints the desk server's item.get (desk/G2.7); looked for: #dd-name-row, then #dd-panel in #dd-upper
  // (goal/G30.8).
  const ddDoc = fakeDocument();
  const dd = load(DETAILS, ddDoc);
  let screenTitle = '';
  const answer = { item: JSON.stringify({ id: 'goal/G100.2', title: 'Second', goal: 'goal/G100', status: 'running', with: '',
    buttons: ['go', 'done'], blocking: ['goal/G100'], blocked: [], alone: false, star: false }),
    box: 'ITEM-TEXT', version: 1, change: 1, chat: [],
    checks: [{ number: 'C1', kind: 'C', words: 'CHECK-TEXT', test: '', state: 'open', by: '', at: '' }] };
  dd.mount(fakeElement('dd'), { escapeHtml: kernel.core.util.escapeHtml, onPacket: function () {}, onPublished: function () {},
    setScreenTitle: function (t) { screenTitle = String(t); }, closeDialog: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); },
    verb: function () { return Promise.resolve({ status: 200, body: answer }); } });
  dd.open({ id: 'goal/G100.2' });
  // goal/G30.8's shape, looked for: one upper half (#dd-upper) under the header, an icon strip pressed by data-panel
  // and one panel (#dd-panel) at a time, the box on open; the C checks are the red Qs' panel's (❌), Blocked by the
  // blocks panel's (🪠).
  const panelClick = function (key) { ddDoc.getElementById('dd-body').fire('click', { target: clickTarget(null, { 'data-panel': key }), preventDefault: function () {} }); return settle().then(settle); };
  const seen = {};
  return settle().then(settle).then(function () {
    seen.box = ddDoc.getElementById('dd-panel').innerHTML;
    return panelClick('qs');
  }).then(function () {
    seen.qs = ddDoc.getElementById('dd-panel').innerHTML;
    return panelClick('blocks');
  }).then(function () {
    seen.links = ddDoc.getElementById('dd-panel').innerHTML;
    const body = ddDoc.getElementById('dd-body').innerHTML;
    const at = function (id) { return body.indexOf('id="' + id + '"'); };
    const nameRow = ddDoc.getElementById('dd-name-row').innerHTML;
    const box = seen.box;

    test.subHeading("T3: a dialog's title starts with the item's id");
    if (/^\s*goal\/G100\.2\b/.test(screenTitle) && /Second/.test(screenTitle)) test.check('the screen title reads ' + JSON.stringify(screenTitle));
    else test.fail(OWED + 'the screen title is ' + JSON.stringify(screenTitle));

    test.subHeading('T4: your buttons sit before Rename; the checks are in the red Qs\' panel');
    const goAt = nameRow.search(/id="dd-go"/);
    const renameAt = nameRow.search(/id="dd-rename"/);
    if (goAt !== -1 && renameAt !== -1 && goAt < renameAt && /data-check="C1"[^>]*>C1<\/button> CHECK-TEXT/.test(seen.qs) && !/CHECK-TEXT/.test(box) && !/CHECK-TEXT/.test(nameRow) && at('dd-upper') > at('dd-name-row')) {
      test.check('Go! stands before Rename on one line; How you check it is in the red Qs\' panel below, outside the box');
    } else test.fail(OWED + 'name row ' + nameRow.slice(0, 160) + ' | red Qs\' panel ' + seen.qs.slice(0, 120));

    test.subHeading('T5 in the dialog: the box shows at once, and empty groups draw nothing');
    const links = seen.links;
    // And each id a way there (Andy: "the blocked and blocks lists link to the respective items").
    // No link to an item's own goal (goal/G33.8, box v12): a Done meant for the item went to the goal.
    if (/ITEM-TEXT/.test(box) && !/Blocked by/.test(links) && !/data-open="goal\/G100"/.test(links)) test.check('the box shows its text, no Blocked by heading shows for an item nothing blocks, and no link goes to its own goal (goal/G33.8, box v12)');
    else test.fail(OWED + 'box ' + box.slice(0, 120) + ' | Blocked by shown ' + /Blocked by/.test(links) + ' | blocks panel ' + links.slice(0, 120));

    test.subHeading('T13: in a dialog, his buttons are pinned in one sticky block, above the upper half');
    // The app header pins it, as the List's bars (goal/G6.1): the block is #dd-bars, deskDetails.js is looked for
    // moving it into createAppHeader(), and no tag of its own markup sticks.
    const ownSticky = /<div[^>]*position:\s*sticky[^>]*>/.test(body);
    const stickyAt = !ownSticky && /createAppHeader/.test(fs.readFileSync(DETAILS, 'utf8')) ? at('dd-bars') : -1;
    const header = stickyAt !== -1 && at('dd-upper') !== -1 ? body.slice(stickyAt, at('dd-upper')) : '';
    if (/id="dd-name-row"/.test(header) && !/id="dd-panel"/.test(header) && at('dd-upper') < at('dd-panel') && at('dd-panel') < at('dd-say')) {
      test.check('one block, pinned by the app header, holds the button row, above the upper half and its panel');
    } else test.fail(OWED + 'sticky at ' + stickyAt + ', buttons at ' + at('dd-name-row') + ', upper half at ' + at('dd-upper') + ', panel at ' + at('dd-panel'));

    // The title line is the shell's title bar itself (goal/G9.6: "the deskDetail has the title already in the
    // shells title bar"); no #dd-head, and the status rides in the title.
    test.subHeading('T10 and T15: the title is the title bar, with the status, and no #dd-head');
    if (!/id="dd-head"/.test(body) && /Second/.test(screenTitle) && /running/.test(screenTitle)) test.check('the title bar reads ' + JSON.stringify(screenTitle) + ', and no #dd-head is drawn');
    else test.fail(OWED + 'the title bar reads ' + JSON.stringify(screenTitle) + '; #dd-head drawn ' + /id="dd-head"/.test(body));

    // goal/G30.8 removed the yellow check line ("the yellow bubble gone").
    test.subHeading('T11, since goal/G30.8: the yellow check line is gone');
    const anywhere = body + nameRow + seen.box + seen.qs + seen.links;
    if (!/id="dd-strip"/.test(anywhere) && !/fff3c4/i.test(anywhere) && !/How you check it/.test(anywhere)) test.check('no yellow "How you check it" line is drawn');
    else test.fail('goal/G30.8: the yellow check line is still drawn');
  });
}).catch(function (e) { test.fail('the run broke: ' + e.message); }).then(function () { test.reportSuccessFailureCount(); });
