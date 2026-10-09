'use strict';

// goal/G9.15: a goal or item box is always visible and ready to edit by user or agents. Red on today's tree;
// claude-windows wrote it from G9.15's box and does not build it.
//   Andy, 2026-10-09, under goal/G10: "First Thing: I don't get to edit the box here so i can't lay out a first cut
//   design"; under goal/G9.16: "a goal or item box is always visible and ready to edit by user or agents."
//
// WHAT IS TRUE TODAY (read in the tree at ffcbbfe2): the details dialog draws a box that has text as a textarea,
// id dd-box-input (goal/G9.3), but an EMPTY box as the note "No text yet: an agent writes it." with no input at
// all, so the first text of a goal or item he just made cannot be his.
//
// THE SHAPE ASSERTED (G9.15's box): the box is the same textarea whether it has text or not; an empty one is an
// empty textarea, taken on focus and written on blur as a filled one is. The take and the release stay as G9.3
// built them.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G9.15: ';
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');

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
  return JSON.stringify(Object.assign({ id: 'eb/G1.1', title: 'Fresh', goal: 'eb/G1', status: '', with: '', buttons: ['close'],
    blocking: ['eb/G1'], blocked: [], alone: false, boxTaken: '', half: false, full: false }, over || {}));
}
function dialog(box) {
  const doc = fakeDocument();
  const dd = load(doc);
  const asked = [];
  dd.mount(fakeElement('dd'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      if (name === 'jobs.api' && ask) {
        const v = Object.keys(ask)[0];
        asked.push({ verb: v, args: ask[v] });
        if (v === 'item.get') return Promise.resolve({ status: 200, body: { item: facts(), version: 0, change: 1 } });
        if (v === 'item.box') return Promise.resolve({ status: 200, body: { box: box, version: box ? 1 : 0 } });
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
  const of = function (verb) { return asked.filter(function (a) { return a.verb === verb; }); };
  return { dd: dd, doc: doc, page: page, of: of };
}

test.startTest('goal/G9.15: a goal or item box is always visible and ready to edit');

(async function () {
  test.subHeading('1. an empty box is drawn as the textarea, as a filled one is');
  const filled = dialog('Some text already.');
  filled.dd.open({ id: 'eb/G1.1' });
  await settled();
  if (filled.page().indexOf('id="dd-box-input"') !== -1) test.check('the world: a filled box is the textarea dd-box-input (goal/G9.3)');
  else { test.fail('the world: a filled box is not drawn as dd-box-input; the shape of goal/G9.3 moved'); return; }

  const empty = dialog('');
  empty.dd.open({ id: 'eb/G1.1' });
  await settled();
  const p = empty.page();
  if (p.indexOf('id="dd-box-input"') !== -1) test.check('an empty box is the same textarea, ready for the first text');
  else test.fail(OWED + 'an empty box is drawn without dd-box-input; the page says: ' + p.replace(/\s+/g, ' ').slice(0, 160));
  if (p.indexOf('No text yet') === -1) test.check('no note stands in for the box');
  else test.fail(OWED + 'the page still shows the note "No text yet: an agent writes it." instead of an input');

  test.subHeading('2. the empty textarea is taken on focus and written on blur, as a filled one is');
  if (p.indexOf('id="dd-box-input"') === -1) { test.fail(OWED + 'no textarea to focus'); return; }
  const input = empty.doc.getElementById('dd-box-input');
  const fire = function (types) { types.forEach(function (t) { empty.doc.getElementById('dd-body').fire(t, { target: input }); input.fire(t, { target: input }); }); };
  input.value = '';
  fire(['focus', 'focusin']);
  await settled();
  if (empty.of('box.take').length >= 1 && empty.of('box.take')[0].args.id === 'eb/G1.1') test.check('focus on the empty box sent box.take');
  else test.fail(OWED + 'focus on the empty box sent ' + JSON.stringify(empty.of('box.take')));
  input.value = 'The first text, his.';
  fire(['blur', 'focusout']);
  await settled();
  const w = empty.of('box.write')[0];
  if (w && w.args.id === 'eb/G1.1' && w.args.text === 'The first text, his.' && w.args.version === 0) test.check('blur after typing sent box.write with his text at version 0');
  else test.fail(OWED + 'blur sent ' + JSON.stringify(empty.of('box.write')));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
