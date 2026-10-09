'use strict';

// goal/G9.17, change 2: a box opens with all of its text visible. Red on today's tree; wsl-claude wrote it from
// G9.17's box and does not build it.
//   Andy, 2026-10-09, under goal/G10: "First Thing: I don't get to edit the box here so i can't lay out a first cut
//   design"; and the ruling, under goal/G9.17: "it always should open so all text is visible."
//
// WHAT IS TRUE TODAY (read in the tree at d6e9df7d): the details dialog draws every box as the textarea dd-box-input
// (goal/G9.15), but ddFolded is true at each open (deskDetails.js:201) and the folded textarea is one row tall
// (:229), so a box of many lines shows one of them. The arrow (data-fold="item", :460) unfolds it to twelve, and a
// close puts the fold back (:549), so every open starts over at one row.
//
// WHAT IS ASSERTED: on every open the textarea is tall enough for all the text the box holds; the arrow still
// shrinks it afterwards; and the next open is sized again, not folded.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G9.17: ';
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
// A box with more lines than the twelve the unfolded textarea used to give, so "all of it" cannot be met by a
// fixed height that happens to be larger than one.
const LINES = 20;
const BOX = Array.from({ length: LINES }, function (x, i) { return 'line ' + (i + 1) + ' of the design, as he would lay it out'; }).join('\n');

function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
async function settled() { for (let i = 0; i < 6; i++) await settle(); }

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
  return { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); }, all: byId };
}
function load(doc) {
  let b = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DETAILS, 'utf8'))(
    { shell: { activateApp: function (x) { b = x; } }, core: kernel.core }, doc, {});
  return b;
}
function facts(over) {
  return JSON.stringify(Object.assign({ id: 'bh/G1.1', title: 'Tall', goal: 'bh/G1', status: '', with: '', buttons: ['close'],
    blocking: ['bh/G1'], blocked: [], alone: false, boxTaken: '', half: false, full: false }, over || {}));
}
function dialog(box) {
  const doc = fakeDocument();
  const dd = load(doc);
  dd.mount(fakeElement('dd'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      if (name === 'jobs.api' && ask) {
        const v = Object.keys(ask)[0];
        if (v === 'item.get') return Promise.resolve({ status: 200, body: { item: facts(), version: 0, change: 1 } });
        if (v === 'item.box') return Promise.resolve({ status: 200, body: { box: box, version: 1 } });
        if (v === 'item.checks') return Promise.resolve({ status: 200, body: { checks: [] } });
        if (v === 'item.chat') return Promise.resolve({ status: 200, body: { chat: [], chatMore: false } });
        return Promise.resolve({ status: 200, body: { change: 2 } });
      }
      return Promise.resolve({ status: 200, body: {} });
    },
    onPublished: function () { return function () {}; },
    onPacket: function () { return function () {}; },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); },
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  const page = function () { return Object.keys(doc.all).map(function (k) { return doc.all[k].innerHTML; }).join('\n'); };
  // The fold's own button, as the body hears a click on it.
  const fold = function () {
    doc.getElementById('dd-body').fire('click', { target: { getAttribute: function (n) { return n === 'data-fold' ? 'item' : null; }, closest: function () { return null; } } });
  };
  return { dd: dd, doc: doc, page: page, fold: fold };
}
function rowsOn(page) {
  const m = /<textarea[^>]*id="dd-box-input"[^>]*>/.exec(page) || /<textarea[^>]*>/.exec(page);
  if (!m) return null;
  const r = /rows="(\d+)"/.exec(m[0]);
  return r ? Number(r[1]) : null;
}

test.startTest('goal/G9.17: a box opens with all of its text visible');

(async function () {
  test.subHeading('1. the open draws the box tall enough for all its text');
  const d = dialog(BOX);
  d.dd.open({ id: 'bh/G1.1' });
  await settled();
  const first = d.page();
  if (first.indexOf('id="dd-box-input"') !== -1) test.check('the world: the box is the textarea dd-box-input (goal/G9.15)');
  else { test.fail('the world: no dd-box-input in the dialog; the shape of goal/G9.15 moved'); return; }
  const rows = rowsOn(first);
  if (rows === null) { test.fail('the world: the textarea carries no rows to read'); return; }
  if (rows > 1) test.check('the open is not one row tall');
  else test.fail(OWED + 'the open draws the textarea at rows="' + rows + '", one line of a ' + LINES + '-line box');
  if (rows >= LINES) test.check('the open shows all ' + LINES + ' lines at once (rows="' + rows + '")');
  else test.fail(OWED + 'the open draws rows="' + rows + '" for a box of ' + LINES + ' lines, so not all of it is visible');

  test.subHeading('2. the arrow still shrinks it afterwards');
  d.fold();
  await settled();
  const folded = rowsOn(d.page());
  if (folded !== null && folded < rows) test.check('the arrow folds the box back (rows="' + folded + '")');
  else test.fail(OWED + 'after the arrow the textarea is rows="' + folded + '", not smaller than the ' + rows + ' it opened with');

  test.subHeading('3. the next open is sized again, never folded');
  const again = dialog(BOX);
  again.dd.open({ id: 'bh/G1.1' });
  await settled();
  const re = rowsOn(again.page());
  if (re !== null && re >= LINES) test.check('a fresh open is sized to the text again (rows="' + re + '")');
  else test.fail(OWED + 'a fresh open draws rows="' + re + '" for a box of ' + LINES + ' lines');
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
