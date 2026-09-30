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
//     description nor its items.
// The explanation box and its place in the dialog went with desk/G2.7 ("I
// want one box only"); the dialog's order is deskDialog.js's.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
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

// The dialog halves (the goal's record, T2, T3, T4) went with desk/G2.7: one box, no explanation box
// (spirit/test/deskDialog.js).
test.startTest('desk/G1.14: the explanation on top and opening itself; the goal overview only in the goal');

(async function () {
  // ── T1 ──────────────────────────────────────────────────────────────
  test.subHeading('T1: Team draws no goal overview');
  const doc = fakeDocument();
  load(DESK, doc).mount(fakeElement('container'), {
    fs: { loadFile: function (f) { return f === 'log/log.json' ? JSON.stringify([row('claude-windows', 'session', SESSION, 'team/chat')]) : null; },
      saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: require('./deskFake.js').fromFiles({ 'log/log.json': JSON.stringify([row('claude-windows', 'session', SESSION, 'team/chat')]) }).verb,
    onPublished: function () {}, onPacket: function () {}, peerPost: function () { return Promise.resolve({ ok: true }); }, callDialog: function () { return new Promise(function () {}); },
  });
  await settle();
  const tabs = doc.getElementById('desk-tabs');
  tabs.fire('click', { target: { id: '', getAttribute: function (a) { return a === 'data-tab' ? 'team' : null; }, parentNode: null }, currentTarget: tabs });
  // Unfolded too, in case a folded bubble merely hides it.
  clickFold(doc.getElementById('desk-session'), 'session');
  const team = doc.getElementById('desk-session').innerHTML;
  if (!/GOAL-OVERVIEW-TEXT/.test(team) && !/ITEM-ONE-TITLE/.test(team)) {
    test.check('Team shows neither the goal\'s description nor its items');
  } else test.fail(OWED + 'Team bubble ' + team.replace(/\s+/g, ' ').slice(0, 140));
})().catch(function (e) { test.fail('the run broke: ' + e.message); }).then(function () { test.reportSuccessFailureCount(); });
