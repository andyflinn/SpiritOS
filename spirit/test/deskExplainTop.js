'use strict';

// spirit/test/deskExplainTop.js
// THE EXPLANATION ON TOP, OPENING ITSELF; THE GOAL OVERVIEW ONLY IN THE
// GOAL — desk/G1.14, written FIRST, red on today's code.
//
//   O3's answer (Andy): "the goal overview i only want to see in the goal
//   item, and the text an agent provided to me because he saw me looking at
//   the item, that one belongs into the upper position", and "when it's
//   filled by the agent (changed) it should open automatically".
//
// THE CONTRACT (wsl-claude's tests, claude-windows' build):
//   - Team draws no goal overview: #desk-session holds neither the goal's
//     description nor its items. The goal's own dialog still has them (its
//     record, unfolded).
//   - In a dialog the explanation's box (#dd-blurb, with #dd-title) sits
//     above the item record (#dd-item) in the frame, and folds with a
//     toggle data-fold="explain".
//   - An explanation that arrives while the dialog is open, or replaces the
//     one shown, is drawn unfolded, even after he folded the box.
//   - The frame's order: his buttons (#dd-name-row), the yellow 'How you
//     can check' line, the explanation, the record (folded).
// NOT held here: whether an explanation he has already read opens folded.
// NOTE FOR THE BUILD: deskFold.js (T1, T3) and deskLayout.js (T5 in Desk)
// test the Team bubble; with it gone they move to the goal's dialog.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const DESK = path.join(__dirname, '..', 'run', 'app', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'app', 'deskDetails', 'deskDetails.js');
const LEAD = 'MCowBQYDK2VwAyEAleadleadleadleadleadleadleadleadleadl=';
const OWED = 'OWED by desk/G1.14: ';

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
function clickFold(el, name) {
  el.fire('click', { target: { id: '', getAttribute: function (n) { return n === 'data-fold' ? name : null; }, closest: function () { return null; }, parentNode: null },
    currentTarget: el, preventDefault: function () {} });
}

let n = 0;
function row(from, kind, text, todo) {
  n += 1;
  const dir = from === 'andy' ? 'out' : 'in';
  return { key: 'k' + n, at: new Date(Date.now() - 3600000 + n * 1000).toISOString(), dir: dir, peer: LEAD,
    outcome: dir === 'in' ? 'received' : 'sent', from: from, kind: kind, text: text, todo: todo };
}
const SESSION = JSON.stringify({ goal: { id: 't/G1', title: 'The goal', description: 'GOAL-OVERVIEW-TEXT' }, rules: [],
  items: [{ id: 't/G1.1', title: 'ITEM-ONE-TITLE', description: 'ITEM-RECORD-TEXT', check: 'CHECK-TEXT' }] });

// A dialog, opened on `id` with `rows` as its record and `thread` as what was said.
function dialog(id, rows, thread) {
  const doc = fakeDocument();
  const dd = load(DETAILS, doc);
  const packets = [];
  dd.mount(fakeElement('dd'), { escapeHtml: kernel.core.util.escapeHtml, onPacket: function (app, fn) { packets.push(fn); },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); },
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } } });
  dd.open({ id: id, row: rows.filter(function (r) { return r.id === id; })[0], agents: {}, session: rows, rules: [], thread: thread });
  return {
    doc: doc,
    arrive: function (text, hash) {
      packets.forEach(function (fn) { fn({ from: 'claude-windows', kind: 'explain', text: text, todo: id }, { hash: hash, fromKey: LEAD, sentAt: new Date().toISOString() }); });
    },
  };
}
const ROWS = [
  { id: 't/G1.1', title: 'ITEM-ONE-TITLE', description: 'ITEM-RECORD-TEXT', check: 'CHECK-TEXT', tests: [], inPlace: [], blocks: ['t/G1'], waitsOn: [], verified: true, done: false },
  { id: 't/G1', title: 'The goal', goal: true, description: 'GOAL-OVERVIEW-TEXT', check: '', tests: [], blocks: [], waitsOn: ['t/G1.1'], done: false },
];

test.startTest('desk/G1.14: the explanation on top and opening itself; the goal overview only in the goal');

(async function () {
  // ── T1 ──────────────────────────────────────────────────────────────
  test.subHeading('T1: Team draws no goal overview; the goal\'s own dialog still shows it');
  const doc = fakeDocument();
  load(DESK, doc).mount(fakeElement('container'), {
    fs: { loadFile: function (f) { return f === 'log/log.json' ? JSON.stringify([row('claude-windows', 'session', SESSION, 'team/chat')]) : null; },
      saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: function () { return Promise.resolve({ status: 200, body: {} }); },
    onPacket: function () {}, peerPost: function () { return Promise.resolve({ ok: true }); }, callDialog: function () { return new Promise(function () {}); },
  });
  await settle();
  const tabs = doc.getElementById('desk-tabs');
  tabs.fire('click', { target: { id: '', getAttribute: function (a) { return a === 'data-tab' ? 'team' : null; }, parentNode: null }, currentTarget: tabs });
  // Unfolded too, in case a folded bubble merely hides it.
  clickFold(doc.getElementById('desk-session'), 'session');
  const team = doc.getElementById('desk-session').innerHTML;
  const goalDlg = dialog('t/G1', ROWS, [row('claude-windows', 'session', SESSION, 't/G1')]);
  await settle();
  clickFold(goalDlg.doc.getElementById('dd-body'), 'item');
  const goalRecord = goalDlg.doc.getElementById('dd-item').innerHTML;
  if (!/GOAL-OVERVIEW-TEXT/.test(team) && !/ITEM-ONE-TITLE/.test(team) && /GOAL-OVERVIEW-TEXT/.test(goalRecord) && /ITEM-ONE-TITLE/.test(goalRecord)) {
    test.check('Team shows neither the goal\'s description nor its items; the goal\'s dialog shows both');
  } else test.fail(OWED + 'Team bubble ' + team.replace(/\s+/g, ' ').slice(0, 140) + ' | goal record has overview ' + /GOAL-OVERVIEW-TEXT/.test(goalRecord));

  // ── T2 and T4 ───────────────────────────────────────────────────────
  const d = dialog('t/G1.1', ROWS, [row('claude-windows', 'explain', 'EXPLAIN-OLD', 't/G1.1')]);
  await settle();
  const frame = d.doc.getElementById('dd-body').innerHTML;
  const at = function (s) { return frame.indexOf(s); };

  test.subHeading('T2: the explanation sits above the item record');
  if (at('id="dd-blurb"') !== -1 && at('id="dd-item"') !== -1 && at('id="dd-blurb"') < at('id="dd-item"') &&
      /EXPLAIN-OLD/.test(d.doc.getElementById('dd-blurb').innerHTML)) {
    test.check('#dd-blurb comes before #dd-item, and holds the explanation');
  } else test.fail(OWED + 'blurb at ' + at('id="dd-blurb"') + ', item at ' + at('id="dd-item"'));

  test.subHeading('T4: the order: his buttons, the yellow check, the explanation, the folded record');
  const order = [at('id="dd-name-row"'), at('How you can check'), at('id="dd-blurb"'), at('id="dd-item"')];
  const rising = order.every(function (x, i) { return x !== -1 && (i === 0 || x > order[i - 1]); });
  if (rising && !/ITEM-RECORD-TEXT/.test(d.doc.getElementById('dd-item').innerHTML)) test.check('buttons, check, explanation, record, in that order, the record folded');
  else test.fail(OWED + 'positions ' + JSON.stringify(order) + ', record folded ' + !/ITEM-RECORD-TEXT/.test(d.doc.getElementById('dd-item').innerHTML));

  // ── T3 ──────────────────────────────────────────────────────────────
  test.subHeading('T3: a new or changed explanation shows unfolded, even after he folded the box');
  const blurbHtml = function () { return d.doc.getElementById('dd-blurb').innerHTML + d.doc.getElementById('dd-title').innerHTML; };
  const hasToggle = /data-fold="explain"/.test(frame + blurbHtml());
  clickFold(d.doc.getElementById('dd-body'), 'explain');
  const foldedOld = !/EXPLAIN-OLD/.test(blurbHtml());
  d.arrive('EXPLAIN-NEW', 'x-new');
  await settle();
  const shownNew = /EXPLAIN-NEW/.test(blurbHtml());
  if (hasToggle && foldedOld && shownNew) test.check('the box folds (data-fold="explain"), and a changed explanation opened it with the new text');
  else test.fail(OWED + 'toggle ' + hasToggle + ', folded by him ' + foldedOld + ', new text shown ' + shownNew);
})().catch(function (e) { test.fail('the run broke: ' + e.message); }).then(function () { test.reportSuccessFailureCount(); });
