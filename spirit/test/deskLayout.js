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
const SESSION = JSON.stringify({ goal: { id: 't/G1', title: 'Goal', description: 'GOAL-TEXT' },
  rules: [{ id: 't/G1.rule1', text: 'RULE-TEXT' }],
  items: [
    { id: 't/G1.1', title: 'First', blocks: ['t/G1', 't/G1.2'] },
    { id: 't/G1.2', title: 'Second' },
  ] });
const log = [row('claude-windows', 'session', SESSION, 'team/chat'), row('andy', 'answer', 'start design mode.', 'team/chat')];

const posted = [];
const files = { 'log/log.json': JSON.stringify(log) };
// THE LIST IS THE DESK SERVER'S (desk/G2.6): the goal row says design mode,
// each row its status.
const fake = require('./deskFake.js').fromFiles(files);
const label = function (o) { return Object.assign({ goal: 't/G1', status: '', with: '', buttons: [], blocking: [], blocked: [], star: false }, o); };
fake.items = [
  label({ id: 't/G1', title: 'Goal', goal: '', design: true, waiting: 0, blocked: ['t/G1.1'] }),
  label({ id: 't/G1.1', title: 'First', status: 'blocking', blocking: ['t/G1', 't/G1.2'] }),
  label({ id: 't/G1.2', title: 'Second', status: 'blocked', blocked: ['t/G1.1'] }),
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
  tabs.fire('click', { target: clickTarget(tabs, { 'data-tab': 'team' }), currentTarget: tabs });

  test.subHeading('T1: the tab rows are pinned, and the design button is last');
  const shell = root.innerHTML;
  // ONE STICKY BLOCK HOLDING BOTH ROWS (claude-windows' review of the build):
  // two rows each stuck at top 0 slid the agent row under the main one. So
  // exactly one sticky tag, and both rows follow it, before any pane. It sticks BELOW the title bar, never at
  // top 0 (goal/G2.1 note 4; Andy: "stay sticky below those title bars"): the shell's #app-header is sticky at
  // the top of the same scroll. SINCE goal/G6.1 the sticking is the shell's app header (spirit/test/appHeader.js
  // proves the element): the block is #desk-bars, desk.js moves it into createAppHeader(), and no tag of its own
  // markup sticks any more.
  const stickies = shell.match(/<div[^>]*position:\s*sticky[^>]*>/g) || [];
  const deskCode = fs.readFileSync(DESK, 'utf8');
  const viaHeader = /createAppHeader/.test(deskCode) && stickies.length === 0;
  const at = viaHeader ? shell.indexOf('id="desk-bars"') : -1;
  const tabsAt = shell.indexOf('id="desk-tabs"');
  // ONE ROW SINCE goal/G3.12: the agent row inside Team went; the bubbles ride in #desk-tabs.
  const paneAt = shell.indexOf('data-pane=');
  const pinned = at !== -1 && at < tabsAt && tabsAt < paneAt && shell.indexOf('id="desk-agent-tabs"') === -1;
  const buttons = tabs.innerHTML.match(/<button[^>]*>/g) || [];
  const last = buttons[buttons.length - 1] || '';
  if (pinned && /desk-(end|start)-design/.test(last)) test.check('one block, pinned by the app header, holds the tab row, no agent row, and the design button closes the row');
  else test.fail(OWED + 'sticky tags ' + JSON.stringify(stickies) + ', row inside it ' + pinned + ', last button ' + last);

  // Andy: "this part of the list page should be attached below the title
  // bar, and not scroll away. Upgrading Desk ... (desk/G1) List (1) Team
  // Musings": the goal line rides in the same pinned block as the tabs.
  // SINCE goal/G9.6 there is no goal line in the header: "the desk is only about the current goal", and the List's
  // goal row opens it. What stays of T12 is the pinned block holding the tabs (deskHeaderArea.js holds the rest).
  test.subHeading('T12: the pinned block holds the tabs, and no goal line any more');
  const barsAt = at;
  const goalAt = shell.indexOf('id="desk-goal"');
  if (barsAt !== -1 && goalAt === -1 && tabsAt > barsAt) test.check('#desk-bars holds the tabs and no #desk-goal');
  else test.fail(OWED + 'sticky block at ' + barsAt + ', goal line at ' + goalAt + ', tabs at ' + tabsAt);

  // Andy: "this button row on the main screen [All] [claude-windows (lead)]
  // [wsl-claude] should only appear when [team] is the active button". The
  // hidden attribute alone loses to .start-job-form's display:flex
  // (index.html), so it must be display none, not only hidden.
  // T14 STOOD HERE: the agent row shown on Team alone. It went with goal/G3.12 (the bubbles show on every tab;
  // deskFrontPage.js asserts them on the List tab).
  test.subHeading('T14: the tab row is one row on every tab');
  const tabTo = function (name) { tabs.fire('click', { target: clickTarget(tabs, { 'data-tab': name }), currentTarget: tabs }); return tabs.innerHTML; };
  const rows = [tabTo('list'), tabTo('musings'), tabTo('team')];
  if (rows.every(function (h) { return /data-tab="team"/.test(h) && !/data-agent=/.test(h); })) test.check('List, Musings, Team: the one tab row, no agent tab on any');
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
      const ended = fake.calls.some(function (k) { return k.verb === 'press' && k.args.what === 'end-design' && k.args.id === 't/G1' && !('by' in k.args); });
      if (afterOne === 0 && armed && ended) test.check('the first press armed it (sure?) and sent nothing; the second ended design mode');
      else test.fail(OWED + 'after one press ' + afterOne + ' sent, armed ' + armed + '; after two, ended ' + ended);
    });
  });
}).then(function () {
  test.subHeading("T7: the status column reads what the desk server says");
  const s1 = stateOf('t/G1.1');
  const s2 = stateOf('t/G1.2');
  if (/\bblocking\b/.test(s1) && /\bblocked\b/.test(s2)) test.check('t/G1.1 reads blocking, t/G1.2 (waiting on it) reads blocked');
  else test.fail(OWED + 't/G1.1 reads ' + JSON.stringify(s1) + ', t/G1.2 reads ' + JSON.stringify(s2));

  test.subHeading('T5 in Desk: the bubble shows the goal by its title, nothing more');
  const bubble = doc.getElementById('desk-session').innerHTML;
  if (/Goal/.test(bubble) && !/GOAL-TEXT/.test(bubble) && !/RULE-TEXT/.test(bubble)) test.check('the bubble shows the goal\'s title line only');
  else test.fail(OWED + 'the bubble on first open: ' + bubble.replace(/\s+/g, ' ').slice(0, 200));

  // T8 (the goal banner folding) was dropped by O3's answer: the banner stays
  // one line, and the goal overview lives only in the goal's dialog (G1.14).
  // Andy: "the red stars should be in a separage first column, the
  // task-type icons in the second column."
  test.subHeading('T9: the unseen star has the first column to itself, the type icon the second');
  const list = doc.getElementById('desk-top').innerHTML;
  const firstRow = (list.match(/<tr data-row="t\/G1\.2"[\s\S]*?<\/tr>/) || [''])[0];
  const tds = firstRow.match(/<td[^>]*>[\s\S]*?<\/td>/g) || [];
  const icons = [kernel.core.const.ICON.ERROR, kernel.core.const.ICON.CODE];
  const hasIcon = function (c) { return icons.some(function (i) { return c.indexOf(i) !== -1; }); };
  if (tds.length > 2 && !hasIcon(tds[0]) && hasIcon(tds[1])) test.check('column 1 carries no type icon; column 2 carries it');
  else test.fail(OWED + 'first two cells ' + JSON.stringify(tds.slice(0, 2)));

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
  // Since desk/G2.7 the dialog paints the desk server's item.get: the rulings below stand, on the new parts
  // (#dd-name-row, #dd-strip, #dd-box, #dd-links).
  const ddDoc = fakeDocument();
  const dd = load(DETAILS, ddDoc);
  let screenTitle = '';
  const answer = { item: JSON.stringify({ id: 't/G1.2', title: 'Second', goal: 't/G1', status: 'running', with: '',
    buttons: ['go', 'done'], blocking: ['t/G1'], blocked: [], alone: false, star: false }),
    box: 'ITEM-TEXT', version: 1, change: 1, chat: [],
    checks: [{ number: 'C1', kind: 'C', words: 'CHECK-TEXT', test: '', state: 'open', by: '', at: '' }] };
  dd.mount(fakeElement('dd'), { escapeHtml: kernel.core.util.escapeHtml, onPacket: function () {}, onPublished: function () {},
    setScreenTitle: function (t) { screenTitle = String(t); }, closeDialog: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); },
    verb: function () { return Promise.resolve({ status: 200, body: answer }); } });
  dd.open({ id: 't/G1.2' });
  return settle().then(settle).then(function () {
    const body = ddDoc.getElementById('dd-body').innerHTML;
    const at = function (id) { return body.indexOf('id="' + id + '"'); };
    const nameRow = ddDoc.getElementById('dd-name-row').innerHTML;
    const strip = ddDoc.getElementById('dd-strip').innerHTML;
    const box = ddDoc.getElementById('dd-box').innerHTML;

    test.subHeading("T3: a dialog's title starts with the item's id");
    if (/^\s*t\/G1\.2\b/.test(screenTitle) && /Second/.test(screenTitle)) test.check('the screen title reads ' + JSON.stringify(screenTitle));
    else test.fail(OWED + 'the screen title is ' + JSON.stringify(screenTitle));

    test.subHeading('T4: your buttons sit before Rename, the check line right under them');
    const goAt = nameRow.search(/id="dd-go"/);
    const renameAt = nameRow.search(/id="dd-rename"/);
    if (goAt !== -1 && renameAt !== -1 && goAt < renameAt && /CHECK-TEXT/.test(strip) && !/CHECK-TEXT/.test(box) && at('dd-strip') > at('dd-name-row')) {
      test.check('Go! stands before Rename on one line; How you check it follows it, outside the box');
    } else test.fail(OWED + 'name row ' + nameRow.slice(0, 160) + ' | strip ' + strip.slice(0, 80));

    test.subHeading('T5 in the dialog: the box shows at once, and empty groups draw nothing');
    const links = ddDoc.getElementById('dd-links').innerHTML;
    // And each id a way there (Andy: "the blocked and blocks lists link to the respective items").
    if (/ITEM-TEXT/.test(box) && !/Blocked by/.test(links) && /data-open="t\/G1"/.test(links)) test.check('the box shows its text, no Blocked by heading shows for an item nothing blocks, and its blocking id is a link');
    else test.fail(OWED + 'box ' + box.slice(0, 120) + ' | Blocked by shown ' + /Blocked by/.test(links));

    test.subHeading('T13: in a dialog, his buttons and the check line are pinned in one sticky block');
    // SINCE goal/G6.1 the app header pins it, as the List's bars: the block is #dd-bars, deskDetails.js moves it into
    // createAppHeader(), and no tag of its own markup sticks.
    const ownSticky = /<div[^>]*position:\s*sticky[^>]*>/.test(body);
    const stickyAt = !ownSticky && /createAppHeader/.test(fs.readFileSync(DETAILS, 'utf8')) ? at('dd-bars') : -1;
    const closeAt = body.indexOf('</div>', at('dd-strip') + 1);
    if (stickyAt !== -1 && stickyAt < at('dd-name-row') && at('dd-name-row') < at('dd-strip') &&
        at('dd-strip') < at('dd-box') && closeAt < at('dd-box')) {
      test.check('one block, pinned by the app header, holds the button row and the check line, above the box');
    } else test.fail(OWED + 'sticky at ' + stickyAt + ', buttons at ' + at('dd-name-row') + ', strip at ' + at('dd-strip') + ', box at ' + at('dd-box'));

    // SINCE goal/G9.6 the title line is the shell's title bar itself ("the deskDetail has the title already in the
    // shells title bar"); #dd-head is gone, and the status it carried rides in the title.
    test.subHeading('T10 and T15: the title is the title bar, with the status, and no #dd-head');
    if (!/id="dd-head"/.test(body) && /Second/.test(screenTitle) && /running/.test(screenTitle)) test.check('the title bar reads ' + JSON.stringify(screenTitle) + ', and no #dd-head is drawn');
    else test.fail(OWED + 'the title bar reads ' + JSON.stringify(screenTitle) + '; #dd-head drawn ' + /id="dd-head"/.test(body));

    test.subHeading('T11: the yellow check stands apart, with clear space around it');
    const tag = (strip.match(/<div[^>]*background:#fff3c4[^>]*>/) || [''])[0];
    const margin = (tag.match(/margin:\s*(\d+)px/) || [0, 0])[1];
    if (Number(margin) >= 12) test.check('the check line keeps ' + margin + 'px clear above and below');
    else test.fail(OWED + 'the check line has ' + margin + 'px of space around it: ' + tag.slice(0, 120));
  });
}).catch(function (e) { test.fail('the run broke: ' + e.message); }).then(function () { test.reportSuccessFailureCount(); });
