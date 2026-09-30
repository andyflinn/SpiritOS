'use strict';

// spirit/test/deskFresh.js
// DESK KEEPS ITS DISPLAYS FRESH BY ITSELF — slim/G1.6, written FIRST, red on
// today's code (claude-windows tests, wsl-claude builds).
//
//   Andy, after an explanation kept a line its item had dropped: "no use if
//   these displays go stale", "is this programatically or do i have to rely
//   on agents to remember?", "File this as an item, it affect us all
//   immediately." His go on the wording: when an item's text changes, Desk
//   marks its explanation stale and asks for a fresh one; when an item's
//   status changes, Desk puts an update request on the items it blocks and
//   that block it. And: "the blocked and blocks lists link to the
//   respective items."
//
// THE CONTRACT (agreed with wsl-claude before the build):
//   The desk server's fresh.get (S1, S2) was retired by desk/G2.1 for items.search.
//   DESK (shell/desk/desk.js) marks no row 'update?' (L1),
//   and its blocks and waits-on cells are links, data-open="<id>", as the
//   dialog's lists are (L2).
//   The dialog's half (D1 to D7) went with desk/G2.7 (spirit/test/deskDialog.js).

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by slim/G1.6: ';
const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const LEAD = 'MCowBQYDK2VwAyEAleadleadleadleadleadleadleadleadleadl=';
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }

let n = 0;
function at(min) { return new Date(Date.UTC(2026, 8, 30, 8, min, 0)).toISOString(); }
function line(min, from, kind, text, todo) {
  n += 1;
  const dir = from === 'andy' ? 'out' : 'in';
  return { key: 'f' + String(n).padStart(4, '0'), at: at(min), dir: dir, peer: LEAD,
    outcome: dir === 'in' ? 'received' : 'sent', from: from, kind: kind, text: text, todo: todo };
}
function session(items) { return JSON.stringify({ goal: { id: 't/G1', title: 'The goal' }, rules: [], items: items }); }
const A = { id: 't/G1.1', title: 'Alpha', description: 'first words', blocks: ['t/G1'] };
const B = { id: 't/G1.2', title: 'Beta', description: 'beta', blocks: ['t/G1'], inPlace: [{ what: 'x', where: 'a.js:1' }] };
const C = { id: 't/G1.3', title: 'Gamma', description: 'gamma', blocks: ['t/G1.1'] };

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {}, placeholder: '',
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

test.startTest('slim/G1.6: Desk keeps its displays fresh by itself');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskfresh-'));

(async function () {
  // THE DESK SERVER'S HALF (S1, S2) WENT WITH fresh.get: desk/G2.1 retired it for items.search
  // (spirit/test/deskState.js).

  // ── THE LIST ────────────────────────────────────────────────────────
  const listLog = [line(1, 'claude-windows', 'session', session([A, B, C]), 'team/chat')];
  const fake = require('./deskFake.js').fromFiles({ 'log/log.json': JSON.stringify(listLog) });
  // The rows are the desk server's labels (desk/G2.6).
  const lab = function (o) { return Object.assign({ goal: 't/G1', status: '', with: '', buttons: [], blocking: [], blocked: [], star: false }, o); };
  fake.items = [lab({ id: 't/G1.1', title: 'Alpha', blocked: ['t/G1.3'] }), lab({ id: 't/G1.3', title: 'Gamma', blocking: ['t/G1.1'] })];
  // Even a server that still answered one: the List draws no 'update?'.
  const answerFresh = { items: [{ key: 't/G1.3', label: JSON.stringify({ id: 't/G1.3', changedAt: at(1), updateRequested: true }) },
    { key: 't/G1.2', label: JSON.stringify({ id: 't/G1.2', changedAt: at(1) }) }], more: false };
  const verb = function (name, body) {
    const ask = body && body.ask && body.ask.desk;
    if (ask && ask['fresh.get']) return Promise.resolve({ status: 200, body: answerFresh });
    return fake.verb(name, body);
  };
  const doc = fakeDocument();
  load(DESK, doc).mount(fakeElement('container'), {
    fs: { loadFile: function (f) { return f === 'log/log.json' ? JSON.stringify(listLog) : null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: verb,
    onPublished: function () {}, onPacket: function () {}, peerPost: function () { return Promise.resolve({ ok: true }); }, callDialog: function () { return new Promise(function () {}); },
  });
  for (let i = 0; i < 6; i++) await settle();
  const list = ['desk-top', 'desk-session', 'desk-goal'].map(function (id) { return doc.getElementById(id).innerHTML; }).join(' ');
  const rowOf = function (title) { return list.split('<tr').filter(function (s) { return s.indexOf(title) !== -1; })[0] || ''; };

  test.subHeading('L1: the List marks no row for an update');
  if (!/update\?/.test(list)) test.check('no row shows update?');
  else test.fail(OWED + 'the List still shows update?: ' + JSON.stringify(rowOf('Gamma').replace(/\s+/g, ' ').slice(0, 200)));

  test.subHeading('L2: the List\'s blocks and waits-on cells link to their items');
  if (rowOf('Gamma').indexOf('data-open="t/G1.1"') !== -1 && rowOf('Alpha').indexOf('data-open="t/G1.3"') !== -1) {
    test.check('Gamma\'s blocks cell links t/G1.1; Alpha\'s waits-on cell links t/G1.3');
  } else test.fail(OWED + 'Gamma row ' + JSON.stringify(rowOf('Gamma').replace(/\s+/g, ' ').slice(0, 160)) +
    ' | Alpha row ' + JSON.stringify(rowOf('Alpha').replace(/\s+/g, ' ').slice(0, 160)));

  // THE DIALOG'S HALF (D1 to D7: stale explanations, folds and acks, the Go decision handed over) went with
  // desk/G2.7: one box, and the buttons are the desk server's (spirit/test/deskDialog.js).
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
