'use strict';

// spirit/test/deskBackupFresh.js
// DESK'S BACKUP LINE STAYS CURRENT — found live on Andy's node, written
// FIRST, red on today's code.
//
//   Andy, 2026-09-29: "Backup: last check 12:55, last copy 12:55; something
//   was closed since the last check", while the backup had copied at 13:26.
//   Desk asked backup's status.get once, at load, and never again.
//
// THE CONTRACT: after Desk records a line (an arrival, or what he sends), it
// asks status.get again, so #desk-backup shows the backup's newest check.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const deskFake = require('./deskFake.js');

const OWED = 'OWED by the stale-backup-line finding: ';
const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const LEAD = 'MCowBQYDK2VwAyEAleadleadleadleadleadleadleadleadleadl=';

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
function fakeDocument() { const byId = {}; return { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } }; }
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
async function settleLong() { for (let i = 0; i < 15; i++) await settle(); }
function hhmm(iso) { const d = new Date(iso); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

test.startTest("Desk's backup line stays current");
(async function () {
  const session = JSON.stringify({ goal: { id: 't/G1', title: 'Goal' }, rules: [], items: [{ id: 't/G1.1', title: 'One' }] });
  const fake = deskFake.create([{ key: 'b1', at: new Date(Date.now() - 600000).toISOString(), dir: 'in', peer: LEAD, outcome: 'received',
    from: 'claude-windows', kind: 'session', text: session, todo: 'team/chat' }]);
  const first = new Date(Date.now() - 3 * 3600000).toISOString();
  const later = new Date(Date.now() - 60000).toISOString();
  fake.backup = { lastCheck: first, lastCopy: first, lastError: '' };
  const doc = fakeDocument();
  let b = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DESK, 'utf8'))({ shell: { activateApp: function (x) { b = x; } }, core: kernel.core }, doc, {});
  b.mount(fakeElement('container'), {
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: fake.verb, onPacket: function (app, fn) { doc.arrive = fn; },
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h' }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  await settleLong();
  const before = doc.getElementById('desk-backup').innerHTML;

  // The backup copies again; then a line arrives.
  fake.backup = { lastCheck: later, lastCopy: later, lastError: '' };
  if (doc.arrive) doc.arrive({ from: 'claude-windows', kind: 'note', text: 'a new line', todo: 't/G1.1' }, { hash: 'fresh-1', fromKey: LEAD, sentAt: new Date().toISOString() });
  await settleLong();
  const after = doc.getElementById('desk-backup').innerHTML;

  test.subHeading('After a line is recorded, #desk-backup shows the newest check');
  if (before.indexOf(hhmm(first)) !== -1 && after.indexOf(hhmm(later)) !== -1) test.check('it moved from ' + hhmm(first) + ' to ' + hhmm(later) + ' without a reload');
  else test.fail(OWED + 'before: ' + JSON.stringify(before.slice(0, 120)) + '; after a recorded line: ' + JSON.stringify(after.slice(0, 120)));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
