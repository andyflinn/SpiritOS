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
  verb: require('./deskFake.js').fromFiles(files).verb,
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
  // ONE STICKY BLOCK HOLDING BOTH ROWS (claude-windows' review of the build):
  // two rows each stuck at top 0 slid the agent row under the main one. So
  // exactly one sticky tag at top 0, and both rows follow it, before any pane.
  const stickies = shell.match(/<div[^>]*position:\s*sticky[^>]*>/g) || [];
  const at = stickies.length === 1 && /top:\s*0/.test(stickies[0]) ? shell.indexOf(stickies[0]) : -1;
  const tabsAt = shell.indexOf('id="desk-tabs"');
  const agentAt = shell.indexOf('id="desk-agent-tabs"');
  const paneAt = shell.indexOf('data-pane=');
  const pinned = at !== -1 && at < tabsAt && tabsAt < agentAt && agentAt < paneAt;
  const buttons = tabs.innerHTML.match(/<button[^>]*>/g) || [];
  const last = buttons[buttons.length - 1] || '';
  if (pinned && /desk-(end|start)-design/.test(last)) test.check('one sticky block at top: 0 holds both tab rows, and the design button closes the row');
  else test.fail(OWED + 'sticky tags ' + JSON.stringify(stickies) + ', rows inside it ' + pinned + ', last button ' + last);

  // Andy: "this part of the list page should be attached below the title
  // bar, and not scroll away. Upgrading Desk ... (desk/G1) List (1) Team
  // Musings": the goal line rides in the same pinned block as the tabs.
  test.subHeading('T12: the goal line is pinned with the tabs, in one sticky block');
  const barsAt = shell.search(/<div[^>]*id="desk-bars"[^>]*position:\s*sticky/);
  const goalAt = shell.indexOf('id="desk-goal"');
  if (barsAt !== -1 && goalAt > barsAt && goalAt < tabsAt) test.check('#desk-goal sits inside the sticky #desk-bars, above the tabs');
  else test.fail(OWED + 'sticky block at ' + barsAt + ', goal line at ' + goalAt + ', tabs at ' + tabsAt);

  // Andy: "this button row on the main screen [All] [claude-windows (lead)]
  // [wsl-claude] should only appear when [team] is the active button". The
  // hidden attribute alone loses to .start-job-form's display:flex
  // (index.html), so it must be display none, not only hidden.
  test.subHeading('T14: the agent row is not displayed off Team, and is on Team');
  const agentRow = doc.getElementById('desk-agent-tabs');
  const tabTo = function (name) { tabs.fire('click', { target: clickTarget(tabs, { 'data-tab': name }), currentTarget: tabs }); return agentRow.style.display; };
  const onList = tabTo('list');
  const onMusings = tabTo('musings');
  const onTeam = tabTo('team');
  if (onList === 'none' && onMusings === 'none' && onTeam !== 'none') test.check('List and Musings: display none; Team: shown');
  else test.fail(OWED + 'display on List ' + JSON.stringify(onList) + ', Musings ' + JSON.stringify(onMusings) + ', Team ' + JSON.stringify(onTeam));

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

  // T8 (the goal banner folding) was dropped by O3's answer: the banner stays
  // one line, and the goal overview lives only in the goal's dialog (G1.14).
  // Andy: "the red stars should be in a separage first column, the
  // task-type icons in the second column."
  test.subHeading('T9: the unseen star has the first column to itself, the type icon the second');
  const list = doc.getElementById('desk-top').innerHTML;
  const firstRow = (list.match(/<tr data-id="t\/G1\.2"[\s\S]*?<\/tr>/) || [''])[0];
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

    // Andy, after looking: "the titles the right of the done button and in
    // the always-visible part of the large text fold ar still to small, not
    // Title-style yet", and "the yellow part is not separate from the the
    // large text block, it should be right below the offered Done button".
    // Andy: "same for this part Done Rename How you can check: ...": in a
    // dialog, his buttons and the check line stay pinned at the top too.
    test.subHeading('T13: in a dialog, his buttons and the check line are pinned in one sticky block');
    const stickyTag = (body.match(/<div[^>]*position:\s*sticky[^>]*>/) || [''])[0];
    const stickyAt = stickyTag ? body.indexOf(stickyTag) : -1;
    const nameAt = body.indexOf('id="dd-name-row"');
    const checkLineAt = body.indexOf('How you can check');
    const blurbAt = body.indexOf('id="dd-blurb"');
    if (stickyAt !== -1 && /top:\s*0/.test(stickyTag) && stickyAt < nameAt && nameAt < checkLineAt && checkLineAt < blurbAt) {
      test.check('one sticky block at top: 0 holds the button row and the check line, above the explanation');
    } else test.fail(OWED + 'sticky block at ' + stickyAt + ', buttons at ' + nameAt + ', check at ' + checkLineAt + ', explanation at ' + blurbAt);

    test.subHeading('T10: the item title in its fold head is title-sized');
    const size = function (html, text) {
      const at = html.indexOf(text);
      if (at === -1) return 0;
      const before = html.slice(0, at);
      const m = before.match(/font-size:\s*([\d.]+)em[^>]*>[^<]*$/) || before.match(/font-size:\s*([\d.]+)em(?![\s\S]*font-size)[\s\S]*$/);
      return m ? Number(m[1]) : 1;
    };
    const titleSize = size(item, 'Second');
    if (titleSize >= 1.2) test.check('the item title reads at ' + titleSize + 'em');
    else test.fail(OWED + 'the item title in its fold head is ' + titleSize + 'em, not title-sized');

    // Andy: "the line above the text fold, which reads: Desk layout and
    // buttons, ... (desk/G1.12) is basically the Title of this here item.
    // it's still in tiny font, must be Title style/size as well."
    test.subHeading('T15: the title line above the explanation is title-sized too');
    const titleTag = (body.match(/<div[^>]*id="dd-title"[^>]*>/) || [''])[0];
    const tagSize = Number((titleTag.match(/font-size:\s*([\d.]+)em/) || [0, 0])[1]);
    const lineSize = Math.max(tagSize, size(ddDoc.getElementById('dd-title').innerHTML, 'Second') === 1 ? 0 : size(ddDoc.getElementById('dd-title').innerHTML, 'Second'));
    if (lineSize >= 1.2) test.check('the title line reads at ' + lineSize + 'em');
    else test.fail(OWED + 'the title line (#dd-title) is ' + (lineSize || 'the small label size') + ', not title-sized: ' + titleTag);

    test.subHeading('T11: the yellow check stands apart, with clear space around it');
    const yellow = (body.match(/<div[^>]*background:#fff3c4[^>]*>(?:(?!<\/div>)[\s\S])*How you can check/) || [''])[0];
    const tag = (yellow.match(/<div[^>]*>/) || [''])[0];
    const margin = (tag.match(/margin:\s*(\d+)px/) || [0, 0])[1];
    if (Number(margin) >= 12) test.check('the check line keeps ' + margin + 'px clear above and below');
    else test.fail(OWED + 'the check line has ' + margin + 'px of space around it: ' + tag.slice(0, 120));
  });
}).catch(function (e) { test.fail('the run broke: ' + e.message); }).then(function () { test.reportSuccessFailureCount(); });
