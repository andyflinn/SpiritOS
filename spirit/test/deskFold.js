'use strict';

// spirit/test/deskFold.js
// LARGE TEXT BOXES FOLD — desk/G1.8, written FIRST, red on today's code.
//
//   Andy, 2026-09-29: "the large text containers, especially the one at the
//   top, should be foldable, in desk and details."
//
// THE CONTRACT (claude-windows, for wsl-claude's build):
//   - Desk's session bubble (#desk-session) carries a toggle with
//     data-fold="session". Folded, it shows its first line only (the goal's
//     id and title) and the toggle: no description, no rules, no items.
//   - The fold is remembered in seen.json as folds.session (per viewer, as
//     what he has seen is), so it survives reopening Desk.
//   The dialog's folded item record went with desk/G2.7 (one box).

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const spirit = require('../run/js/kernel.js');

const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const LEAD = 'MCowBQYDK2VwAyEAleadleadleadleadleadleadleadleadleadl=';

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, style: {}, listeners: {},
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {},
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
  new Function('spirit', 'document', 'window', fs.readFileSync(script, 'utf8'))({ shell: { activateApp: function (x) { b = x; } } }, doc, {});
  return b;
}
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }

const SESSION = JSON.stringify({ goal: { id: 't/G1', title: 'The goal title', description: 'GOAL-DESCRIPTION-TEXT' }, rules: [],
  items: [{ id: 't/G1.1', title: 'ITEM-ONE-TITLE', description: 'ITEM-DESCRIPTION-TEXT', check: 'ITEM-CHECK-TEXT', tests: ['ITEM-TEST-T1'] }] });
const log = [{ key: 'k1', at: new Date(Date.now() - 60000).toISOString(), dir: 'in', peer: LEAD, outcome: 'received', from: 'claude-windows', kind: 'session', text: SESSION, todo: 'team/chat' }];

// The goal row is the desk server's (desk/G2.6).
function withGoal(fake) {
  fake.items = [{ id: 't/G1', title: 'The goal title', goal: '', status: '', with: '', buttons: [], blocking: [], blocked: [], star: false, design: false, waiting: 0 }];
  return fake;
}
function mountDesk(files) {
  const doc = fakeDocument();
  load(DESK, doc).mount(fakeElement('container'), {
    fs: { loadFile: function (f) { return Object.prototype.hasOwnProperty.call(files, f) ? files[f] : null; },
      saveFile: function (f, c) { files[f] = c; return Promise.resolve(); } },
    escapeHtml: spirit.core.util.escapeHtml,
    verb: withGoal(require('./deskFake.js').fromFiles(files)).verb,
    onPublished: function () {}, onPacket: function () {}, peerPost: function () { return Promise.resolve({ ok: true }); },
    callDialog: function () { return new Promise(function () {}); },
  });
  return doc;
}

test.startTest('desk/G1.8: large text boxes fold, in Desk and its dialogs');
const files = { 'log/log.json': JSON.stringify(log) };
const doc = mountDesk(files);
settle().then(function () {
  // SINCE desk/G1.14 THE TOP OF TEAM IS ONE LINE (Andy, O3: "the goal
  // overview i only want to see in the goal item"). Nothing there is long
  // enough to fold, so T1 and T3 hold that instead; the goal's overview and
  // its fold live in the goal's own dialog (deskExplainTop.js).
  test.subHeading('T1: the top of Team is the goal line alone, which opens the goal');
  const bubble = doc.getElementById('desk-session').innerHTML;
  if (/The goal title/.test(bubble) && /data-open="t\/G1"/.test(bubble) && !/GOAL-DESCRIPTION-TEXT/.test(bubble) && !/ITEM-ONE-TITLE/.test(bubble)) {
    test.check('one line, the goal id and title, and a click opens the goal');
  } else test.fail('the top of Team: ' + bubble.slice(0, 160));

  test.subHeading('T3: reopening Desk shows the same one line');
  const again = mountDesk(files);
  return settle().then(function () {
    const b2 = again.getElementById('desk-session').innerHTML;
    if (/The goal title/.test(b2) && !/GOAL-DESCRIPTION-TEXT/.test(b2)) test.check('a fresh Desk opens with the same goal line, and no overview');
    else test.fail('reopened: ' + b2.slice(0, 160));
  });
  // T2 (the dialog's item record folds) went with desk/G2.7: the dialog has one box and no folded record.
}).catch(function (e) { test.fail('the run broke: ' + e.message); }).then(function () { test.reportSuccessFailureCount(); });
