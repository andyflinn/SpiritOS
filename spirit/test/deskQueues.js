'use strict';

// spirit/test/deskQueues.js
// EACH AGENT'S QUEUE, IN ITS TAB — desk/G1.5 T4, written FIRST, red on
// today's code.
//
//   Andy, 2026-09-29 (D1): "ah, it can visualize job-queues for agents and
//   me. yes." pending.get answers what waits on each party (deskPending.js);
//   nothing draws it yet. His own queue is the List itself: what waits on
//   him carries the ERROR icon and is counted in List (n) (D7).
//
// THE CONTRACT (claude-windows' test, wsl-claude's build): with Team open on
// an agent's tab, Desk asks pending.get {who: <that agent>} and draws the
// answer in #desk-queue, one line per item: its id, its title and why it
// waits ('claim'), each opening that item as a List row does
// (data-open="<id>"). An empty queue says so; All draws no queue.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const deskFake = require('./deskFake.js');

const OWED = 'OWED by desk/G1.5: ';
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
async function settleLong() { for (let i = 0; i < 12; i++) await settle(); }
function clickOn(el, attrs) {
  const target = { id: attrs.id || '', getAttribute: function (n) { return attrs[n] || null; }, closest: function () { return null; }, parentNode: null };
  el.fire('click', { target: target, currentTarget: el, preventDefault: function () {} });
}

let n = 0;
function row(from, kind, text, todo) {
  n += 1;
  const dir = from === 'andy' ? 'out' : 'in';
  return { key: 'q' + n, at: new Date(Date.now() - 3600000 + n * 1000).toISOString(), dir: dir, peer: from === 'wsl-claude' ? WSL : LEAD,
    outcome: dir === 'in' ? 'received' : 'sent', from: from, kind: kind, text: text, todo: todo };
}
const SESSION = JSON.stringify({ goal: { id: 't/G1', title: 'Goal' }, rules: [], items: [
  { id: 't/G1.1', title: 'WAITS-ON-WSL' }, { id: 't/G1.2', title: 'WAITS-ON-LEAD' }] });

test.startTest('desk/G1.5 T4: each agent\'s queue, in its tab');
(async function () {
  const fake = deskFake.create([
    row('claude-windows', 'session', SESSION, 'team/chat'),
    row('wsl-claude', 'note', 'hello from wsl', 'team/chat'),
    row('claude-windows', 'note', 'hello from the lead', 'team/chat'),
  ]);
  fake.pending = {
    'wsl-claude': [{ id: 't/G1.1', title: 'WAITS-ON-WSL', why: 'claim' }],
    'claude-windows': [],
  };
  const doc = fakeDocument();
  let b = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DESK, 'utf8'))({ shell: { activateApp: function (x) { b = x; } }, core: kernel.core }, doc, {});
  b.mount(fakeElement('container'), {
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: fake.verb, onPublished: function () {}, onPacket: function () {},
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h' }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  await settleLong();
  clickOn(doc.getElementById('desk-tabs'), { 'data-tab': 'team' });
  await settleLong();

  test.subHeading('T4: an agent\'s tab shows what waits on it, from pending.get');
  clickOn(doc.getElementById('desk-agent-tabs'), { 'data-agent': 'wsl-claude' });
  await settleLong();
  const asked = fake.calls.filter(function (c) { return c.verb === 'pending.get'; }).map(function (c) { return c.args.who; });
  const q = doc.getElementById('desk-queue').innerHTML;
  if (asked.indexOf('wsl-claude') !== -1 && /WAITS-ON-WSL/.test(q) && /t\/G1\.1/.test(q) && /claim/.test(q) && /data-open="t\/G1\.1"/.test(q) && !/WAITS-ON-LEAD/.test(q)) {
    test.check('wsl-claude\'s tab: t/G1.1 — WAITS-ON-WSL (claim), opening its row');
  } else test.fail(OWED + 'pending.get asked for ' + JSON.stringify(asked) + '; #desk-queue: ' + JSON.stringify(q.slice(0, 200)));

  test.subHeading('T4: an empty queue says so; All draws none');
  clickOn(doc.getElementById('desk-agent-tabs'), { 'data-agent': 'claude-windows' });
  await settleLong();
  const empty = doc.getElementById('desk-queue').innerHTML;
  clickOn(doc.getElementById('desk-agent-tabs'), { 'data-agent': '*' });
  await settleLong();
  const all = doc.getElementById('desk-queue').innerHTML;
  if (/nothing/i.test(empty) && !/WAITS-ON/.test(empty) && !/WAITS-ON/.test(all) && !/nothing/i.test(all)) test.check('the lead\'s tab says nothing waits on it; All shows no queue');
  else test.fail(OWED + 'lead\'s tab: ' + JSON.stringify(empty.slice(0, 120)) + '; All: ' + JSON.stringify(all.slice(0, 120)));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
