'use strict';

// spirit/test/deskFoldOrder.js
// AN ITEM READ IN PAGES IS FOLDED OLDEST FIRST — a desk/G1.4 finding,
// written FIRST, red on today's code.
//
//   Found by wsl-claude after Andy's desk/G1 read "open" following his
//   done.: Desk reads an item's lines newest page first (T5), and folded
//   each page as it arrived. A "done." counts only after both agents'
//   READY TO CLOSE (deskFold), so when the claims sat on an older page than
//   his done., the done. was folded first and ignored.
//
// THE CONTRACT: however many pages an item's lines take, the row's state is
// the one folding them oldest first gives. Here both claims are two pages
// back from Andy's done., and the row must show its Close button.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const deskFake = require('./deskFake.js');

const OWED = 'OWED by the desk/G1.4 fold-order finding: ';
const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const LEAD = 'MCowBQYDK2VwAyEAleadleadleadleadleadleadleadleadleadl=';
const WSL = 'MCowBQYDK2VwAyEAwslwslwslwslwslwslwslwslwslwslwslwslw=';

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, style: {}, listeners: {}, scrollTop: 0, scrollHeight: 0, clientHeight: 0,
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {}, scrollTo: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function fakeDocument() {
  const byId = {};
  return { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
}
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }

let n = 0;
const T0 = Date.UTC(2026, 8, 29, 8, 0, 0);
function row(from, kind, text, todo) {
  n += 1;
  const dir = from === 'andy' ? 'out' : 'in';
  return { key: 'f' + String(n).padStart(4, '0'), at: new Date(T0 + n * 60000).toISOString(), dir: dir, peer: from === 'wsl-claude' ? WSL : LEAD,
    outcome: dir === 'in' ? 'received' : 'sent', from: from, kind: kind, text: text, todo: todo };
}

test.startTest('An item read in pages is folded oldest first');
(async function () {
  const session = JSON.stringify({ goal: { id: 't/G1', title: 'Goal' }, rules: [], items: [{ id: 't/G1.1', title: 'LONG-THREAD' }] });
  const log = [
    row('claude-windows', 'session', session, 'team/chat'),
    row('claude-windows', 'note', 'READY TO CLOSE: built and checked', 't/G1.1'),
    row('wsl-claude', 'note', 'READY TO CLOSE: reviewed', 't/G1.1'),
  ];
  // More than two pages of talk under the item after the claims.
  for (let i = 0; i < 70; i++) log.push(row(i % 2 ? 'wsl-claude' : 'claude-windows', 'note', 'talk ' + i + ' ' + 'y'.repeat(280), 't/G1.1'));
  log.push(row('andy', 'answer', 'done.', 't/G1.1'));

  const fake = deskFake.create(log);
  const doc = fakeDocument();
  let b = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DESK, 'utf8'))({ shell: { activateApp: function (x) { b = x; } }, core: kernel.core }, doc, {});
  b.mount(fakeElement('container'), {
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: fake.verb, onPacket: function () {},
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h' }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  for (let i = 0; i < 30; i++) await settle();

  const pages = fake.searches().filter(function (c) { return (c.args || {}).todo === 't/G1.1'; }).length;
  test.subHeading('Both claims two pages back from his done.: the row is done, and offers Close');
  const html = doc.getElementById('desk-top').innerHTML;
  if (pages >= 3 && /data-close="t\/G1\.1"/.test(html)) test.check('read in ' + pages + ' pages, and the row shows its Close button');
  else test.fail(OWED + pages + ' pages read; the row: ' + ((html.match(/<tr data-id="t\/G1\.1"[\s\S]*?<\/tr>/) || [''])[0].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 160)));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
