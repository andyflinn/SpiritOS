'use strict';

// goal/G9.1: a sword marks make-current in the List; the button lives in the goal's Details. Red on today's tree;
// claude-windows wrote it from G9.1's box and does not build it.
//   Andy, 2026-10-07: "the [make-current] button will not be displayed in the List, only in the goals Details. in the
//   list, an item that has a [make-current] button, the item will be marked with an ICON.SWORD (⚔️), indicating:
//   \"There is a battle to be fought\"."
//
// WHAT IS TRUE TODAY (read in the tree at 7cd6d633): the List draws every button the row's facts offer except Go all
// and Reopen (shell/desk/desk.js deskInRow), so make-current is drawn as a button labelled with its own name. The
// kernel's ICON already holds SWORD, and the Details dialog already draws "Make current goal" (deskDetails.js).
// THE SHAPE (G9.1's box): UI only. The row draws ICON.SWORD where buttons contains make-current; the press stays in
// the goal's Details. No desk server change.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G9.1: ';
const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
const SWORD = '⚔️';

function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 8; i++) await settle(); }
function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {}, placeholder: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
    appendChild: function () {}, removeChild: function () {}, replaceChild: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function fakeDocument() {
  const byId = {};
  return { byId: byId, getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
}
function load(script, doc) {
  let b = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(script, 'utf8'))(
    { shell: { activateApp: function (x) { b = x; } }, core: kernel.core }, doc, { addEventListener: function () {} });
  return b;
}
// One row of the List, as painted anywhere on the page: its <tr data-row="id"> ... </tr>.
function rowHtml(doc, id) {
  const all = Object.keys(doc.byId).map(function (k) { return doc.byId[k].innerHTML; }).join('\n');
  const at = all.indexOf('<tr data-row="' + id + '"');
  if (at === -1) return '';
  return all.slice(at, all.indexOf('</tr>', at) + 5);
}
const label = function (o) { return Object.assign({ goal: '', status: '', with: '', buttons: [], blocking: [], blocked: [], star: false, asks: 0 }, o); };

test.startTest('goal/G9.1: a sword marks make-current in the List; the button lives in the goal\'s Details');

(async function () {
  test.subHeading('1. the kernel names the sword');
  const icon = kernel.core.const.ICON || {};
  if (icon.SWORD === SWORD) test.check('ICON.SWORD is ' + SWORD);
  else test.fail(OWED + 'ICON.SWORD reads ' + JSON.stringify(icon.SWORD));

  // THE LIST: the current goal (no make-current), another open goal (make-current offered), and an item.
  const fake = require('./deskFake.js').create([]);
  fake.items = [
    label({ id: 'sw/G1', title: 'Current', status: 'running', buttons: ['close'] }),
    label({ id: 'sw/G2', title: 'Another', status: 'running', buttons: ['close', 'make-current'] }),
    label({ id: 'sw/G1.1', title: 'An item', goal: 'sw/G1', status: 'running', buttons: ['go'] }),
  ];
  const doc = fakeDocument();
  load(DESK, doc).mount(fakeElement('container'), {
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: fake.verb,
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    peerPost: function () { return Promise.resolve({ ok: true, status: 200 }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  await settled();
  const g2 = rowHtml(doc, 'sw/G2');
  if (!g2) { test.fail('the world: the List drew no row for sw/G2'); return; }
  test.check('the world: the List drew the row of sw/G2');

  test.subHeading('2. a row offering make-current shows the sword, and no make-current button');
  if (g2.indexOf(SWORD) !== -1) test.check('sw/G2\'s row carries ' + SWORD);
  else test.fail(OWED + 'sw/G2\'s row has no sword: ' + g2.replace(/\s+/g, ' ').slice(0, 300));
  if (!/data-press="make-current"/.test(g2) && !/>\s*make-current\s*</i.test(g2)) test.check('and no make-current button in the List');
  else test.fail(OWED + 'the List still draws a make-current button on sw/G2');
  if (/data-press="close"/.test(g2)) test.check('the goal row keeps its Close (goal/G6.6)');
  else test.fail('the goal row lost its Close: ' + g2.replace(/\s+/g, ' ').slice(0, 300));

  test.subHeading('3. no sword where make-current is not offered');
  const g1 = rowHtml(doc, 'sw/G1');
  const i1 = rowHtml(doc, 'sw/G1.1');
  if (g1 && g1.indexOf(SWORD) === -1) test.check('the current goal sw/G1 has no sword');
  else test.fail('sw/G1 reads ' + g1.replace(/\s+/g, ' ').slice(0, 300));
  if (i1 && i1.indexOf(SWORD) === -1) test.check('the item sw/G1.1 has no sword');
  else test.fail('sw/G1.1 reads ' + i1.replace(/\s+/g, ' ').slice(0, 300));

  test.subHeading('4. the press itself stays in the goal\'s Details');
  const ddoc = fakeDocument();
  const dd = load(DETAILS, ddoc);
  dd.mount(fakeElement('dd'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      const v = ask && Object.keys(ask)[0];
      if (v === 'item.get') return Promise.resolve({ status: 200, body: { item: JSON.stringify(label({ id: 'sw/G2', title: 'Another', status: 'running', buttons: ['close', 'make-current'] })), box: 'BOX', version: 1, change: 1, chatMore: false, checks: [], chat: [] } });
      return Promise.resolve({ status: 200, body: { items: [], more: false, checks: [], chat: [], box: '', version: 1 } });
    },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); }, armUntilElsewhere: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  dd.open({ id: 'sw/G2', agents: {} });
  await settled();
  const ddHtml = Object.keys(ddoc.byId).map(function (k) { return ddoc.byId[k].innerHTML; }).join('\n');
  if (/id="dd-make-current"/.test(ddHtml)) test.check('the goal\'s Details draws Make current goal');
  else test.fail('the Details of sw/G2 drew no make-current button (it does today; the List change must not take it): ' + ddHtml.replace(/\s+/g, ' ').slice(0, 200));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
