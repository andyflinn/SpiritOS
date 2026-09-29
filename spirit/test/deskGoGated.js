'use strict';

// spirit/test/deskGoGated.js
// NO GO! ON A BLOCKED ROW, AND NONE IN DESIGN MODE.
//
//   Andy, 2026-09-29: "Desk: Two items in the list show a Go button, even
//   though they're blocked, And we're in design mode". A Go! starts work, so
//   it shows only on a row that waits on nothing, outside design mode. Held
//   on the List, drawn by the real desk.js.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const spirit = require('../run/js/kernel.js');

const RUN = path.join(__dirname, '..', 'run', 'app');
const DESK = path.join(RUN, 'desk', 'desk.js');
const DETAILS = path.join(RUN, 'deskDetails', 'deskDetails.js');
const LEAD = 'MCowBQYDK2VwAyEAleadleadleadleadleadleadleadleadleadl=';

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {},
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    querySelectorAll: function () { return []; },
    querySelector: function () { return null; },
    getAttribute: function () { return null; },
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function fakeDocument() {
  const byId = {};
  return { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
}
function load(script, doc) {
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(script, 'utf8'))({ shell: { activateApp: function (b) { behavior = b; } } }, doc, {});
  return behavior;
}
function settle() {
  return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); });
}

// G1.1 blocks G1.2; G1.3 waits on nothing. All three verified, all three asking.
const SESSION = JSON.stringify({
  goal: { id: 'test/G1', title: 'The goal' },
  rules: [],
  items: [
    { id: 'test/G1.1', title: 'First', blocks: ['test/G1', 'test/G1.2'] },
    { id: 'test/G1.2', title: 'Blocked', blocks: 'test/G1' },
    { id: 'test/G1.3', title: 'Free', blocks: 'test/G1' },
  ],
});
let n = 0;
function row(dir, kind, text, todo) {
  n += 1;
  return { key: 'k' + n, at: '2026-09-28T11:' + String(n).padStart(2, '0') + ':00.000Z', dir: dir, peer: LEAD,
    outcome: dir === 'in' ? 'received' : 'sent', from: dir === 'in' ? 'claude-windows' : 'andy', kind: kind, text: text, todo: todo };
}
// Design mode starts BEFORE the session is posted: starting it clears the board.
const designStart = row('out', 'answer', 'start design mode.', 'team/chat');
const base = [row('in', 'session', SESSION, 'team/chat')];
['test/G1.1', 'test/G1.2', 'test/G1.3'].forEach(function (id) {
  base.push(row('in', 'note', 'IN PLACE VERIFIED', id));
  base.push(row('in', 'ask', 'ready: go?', id));
});
const inDesign = [designStart].concat(base);

function mount(log) {
  const doc = fakeDocument();
  load(DESK, doc).mount(fakeElement('container'), {
    fs: { loadFile: function (f) { return f === 'log/log.json' ? JSON.stringify(log) : null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: spirit.core.util.escapeHtml,
    verb: require('./deskFake.js').fromFiles({ 'log/log.json': JSON.stringify(log) }).verb,
    onPacket: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); },
    callDialog: function () { return new Promise(function () {}); },
  });
  return doc;
}
function goOnList(doc) {
  const html = ['desk-top', 'desk-session', 'desk-goal'].map(function (id) { return doc.getElementById(id).innerHTML; }).join(' ');
  return ['test/G1.1', 'test/G1.2', 'test/G1.3'].filter(function (id) { return html.indexOf('data-go="' + id + '"') !== -1; });
}
test.startTest('Desk: no Go! on a blocked row, and none in design mode');
const free = mount(base);
settle().then(function () {
  test.subHeading('Outside design mode: Go! on rows that wait on nothing, not on a blocked one');
  const shown = goOnList(free);
  if (shown.join(',') === 'test/G1.1,test/G1.3') test.check('Go! on the free rows G1.1 and G1.3, none on G1.2, which waits on G1.1');
  else test.fail('Go! shows on ' + JSON.stringify(shown) + ', expected G1.1 and G1.3 only');

  test.subHeading('In design mode: no Go! on any row');
  const design = mount(inDesign);
  return settle().then(function () {
    const shown2 = goOnList(design);
    const drawn = /Blocked/.test(['desk-top', 'desk-session', 'desk-goal'].map(function (id) { return design.getElementById(id).innerHTML; }).join(' '));
    if (drawn && !shown2.length) test.check('with design mode on, no row shows Go!');
    else test.fail(drawn ? 'in design mode Go! still shows on ' + JSON.stringify(shown2) : 'the session rows were not drawn in design mode, so nothing was tested');
  });
}).then(function () { test.reportSuccessFailureCount(); });
