'use strict';

// spirit/test/deskStatus.js
// A LIVE ONE-WORD STATUS PER ITEM, AND A TYPE ICON PER ROW — desk/G1.11,
// written FIRST, red on today's code.
//
//   Andy, 2026-09-29: "the "status" column must also reflect "queued",
//   "suite", "coding", ie. as long as an item is owned, the owner should
//   indicate in status a one word description of what's going on", "all
//   real-time updated", "the first icon column should reflect job type",
//   and "the ERROR for anything i NEED to deal with", "wherever i block".
//
// THE CONTRACT (claude-windows' marker, wsl-claude's tests):
//   - A status is a note under the item whose text is 'STATUS: <word>'. The
//     newest one shows in the row's state cell, until a READY TO CLOSE claim
//     under the item (or his done.) clears it.
//   - The first cell carries the row's icon from spirit.core.const.ICON
//     (kernel.js): ICON.ERROR wherever Andy blocks (an open point, a Go! he
//     can press, a Done both agents claimed), ICON.CODE on any other item.
//   - An arriving status redraws the List at once.
//   Desk still mounts where spirit.core is absent (the other Desk suites).

const fs = require('fs');
const path = require('path');
const kernel = require('../run/js/kernel.js');
const test = require('./testSupport.js');

const DESK = path.join(__dirname, '..', 'run', 'app', 'desk', 'desk.js');
const LEAD = 'MCowBQYDK2VwAyEAleadleadleadleadleadleadleadleadleadl=';
const WSL = 'MCowBQYDK2VwAyEAwslwslwslwslwslwslwslwslwslwslwslwsl=';
const ICON = kernel.core.const.ICON;
const OWED = 'OWED by desk/G1.11: ';

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {},
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
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }

let n = 0;
function row(from, kind, text, todo) {
  n += 1;
  const dir = from === 'andy' ? 'out' : 'in';
  return { key: 'k' + n, at: new Date(Date.now() - 3600000 + n * 1000).toISOString(), dir: dir, peer: from === 'wsl-claude' ? WSL : LEAD,
    outcome: dir === 'in' ? 'received' : 'sent', from: from, kind: kind, text: text, todo: todo };
}
const SESSION = JSON.stringify({ goal: { id: 't/G1', title: 'Goal' }, rules: [], items: [
  { id: 't/G1.1', title: 'Go waits on Andy' },
  { id: 't/G1.2', title: 'Done waits on Andy' },
  { id: 't/G1.O1', title: 'Open point', open: true },
  { id: 't/G1.3', title: 'Being coded' },
  { id: 't/G1.4', title: 'Claimed after a status' },
  { id: 't/G1.5', title: 'Quiet' },
] });
const log = [
  row('claude-windows', 'session', SESSION, 'team/chat'),
  row('wsl-claude', 'note', 'IN PLACE VERIFIED', 't/G1.1'),
  row('claude-windows', 'ask', 'ready: go?', 't/G1.1'),
  row('claude-windows', 'note', 'READY TO CLOSE', 't/G1.2'),
  row('wsl-claude', 'note', 'READY TO CLOSE', 't/G1.2'),
  row('claude-windows', 'ask', 'ready: go?', 't/G1.3'),
  row('andy', 'answer', 'go.', 't/G1.3'),
  row('wsl-claude', 'note', 'STATUS: queued', 't/G1.3'),
  row('wsl-claude', 'note', 'STATUS: coding', 't/G1.3'),
  row('claude-windows', 'note', 'STATUS: suite', 't/G1.4'),
  row('claude-windows', 'note', 'READY TO CLOSE', 't/G1.4'),
];

const doc = fakeDocument();
const handlers = [];
let behavior = null;
new Function('spirit', 'document', 'window', fs.readFileSync(DESK, 'utf8'))(
  { shell: { activateApp: function (b) { behavior = b; } }, core: kernel.core }, doc, {});
behavior.mount(fakeElement('container'), {
  fs: { loadFile: function (f) { return f === 'log/log.json' ? JSON.stringify(log) : null; }, saveFile: function () { return Promise.resolve(); } },
  escapeHtml: kernel.core.util.escapeHtml,
  verb: function () { return Promise.resolve({ status: 200, body: {} }); },
  onPacket: function (app, fn) { handlers.push(fn); },
  peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h' }); },
  callDialog: function () { return new Promise(function () {}); },
});

// The List's rows: id -> { first: the type icon's cell, state: last cell },
// as text. Since desk/G1.12 (Andy: "the red stars should be in a separage
// first column, the task-type icons in the second column") the icon is the
// second cell.
function rows() {
  const out = {};
  const html = doc.getElementById('desk-top').innerHTML;
  (html.match(/<tr data-id="[^"]*"[\s\S]*?<\/tr>/g) || []).forEach(function (tr) {
    const id = tr.match(/data-id="([^"]*)"/)[1];
    const cells = (tr.match(/<td[^>]*>[\s\S]*?<\/td>/g) || []).map(function (c) { return c.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); });
    out[id] = { first: cells[1] || '', state: cells[cells.length - 1] || '' };
  });
  return out;
}

test.startTest('desk/G1.11: a live one-word status per item, and a type icon per row');
settle().then(function () {
  const r = rows();

  test.subHeading('T1: the newest STATUS: word shows in the state cell');
  if (r['t/G1.3'] && /\bcoding\b/.test(r['t/G1.3'].state) && !/\bqueued\b/.test(r['t/G1.3'].state)) test.check('t/G1.3 reads coding, its newest status, not queued');
  else test.fail(OWED + 't/G1.3 state reads ' + JSON.stringify(r['t/G1.3']));

  // Judged only where statuses show at all, or a Desk that shows none
  // would pass it (found writing it: it passed on today's code).
  test.subHeading('T2: a claim clears it');
  if (r['t/G1.3'] && /\bcoding\b/.test(r['t/G1.3'].state) && r['t/G1.4'] && !/\bsuite\b/.test(r['t/G1.4'].state)) {
    test.check('t/G1.4 was claimed after STATUS: suite and shows no word, while t/G1.3 still reads coding');
  } else test.fail(OWED + 't/G1.3 ' + JSON.stringify(r['t/G1.3']) + ', t/G1.4 ' + JSON.stringify(r['t/G1.4']));

  test.subHeading('T3: ERROR wherever Andy blocks, CODE on any other item');
  const blocks = ['t/G1.1', 't/G1.2', 't/G1.O1'].filter(function (id) { return r[id] && r[id].first.indexOf(ICON.ERROR) !== -1; });
  const code = ['t/G1.3', 't/G1.4', 't/G1.5'].filter(function (id) { return r[id] && r[id].first.indexOf(ICON.CODE) !== -1 && r[id].first.indexOf(ICON.ERROR) === -1; });
  if (blocks.length === 3) test.check('the Go!, the claimed Done and the open point carry ' + ICON.ERROR);
  else test.fail(OWED + 'ERROR on ' + JSON.stringify(blocks) + '; first cells ' + JSON.stringify(Object.keys(r).map(function (k) { return k + ':' + r[k].first; })));
  if (code.length === 3) test.check('the three items where Andy blocks nothing carry ' + ICON.CODE + ' and no ' + ICON.ERROR);
  else test.fail(OWED + 'CODE on ' + JSON.stringify(code));

  test.subHeading('T4: a status arriving redraws at once');
  handlers.forEach(function (fn) { fn({ from: 'wsl-claude', kind: 'note', text: 'STATUS: suite', todo: 't/G1.5' }, { hash: 'live-1', fromKey: WSL, sentAt: new Date().toISOString() }); });
  return settle().then(function () {
    const r2 = rows();
    const shown = r2['t/G1.5'] && /\bsuite\b/.test(r2['t/G1.5'].state);
    if (shown) test.check('STATUS: suite under t/G1.5 showed as soon as it arrived');
    else test.fail(OWED + 'after the arrival t/G1.5 reads ' + JSON.stringify(r2['t/G1.5']));
    handlers.forEach(function (fn) { fn({ from: 'wsl-claude', kind: 'note', text: 'READY TO CLOSE', todo: 't/G1.5' }, { hash: 'live-2', fromKey: WSL, sentAt: new Date().toISOString() }); });
    return settle().then(function () {
      const r3 = rows();
      if (shown && r3['t/G1.5'] && !/\bsuite\b/.test(r3['t/G1.5'].state)) test.check('T2, live: a claim arriving after it cleared it at once');
      else test.fail(OWED + 'T2 live: after the claim t/G1.5 reads ' + JSON.stringify(r3['t/G1.5']));
    });
  });
}).catch(function (e) { test.fail('the run broke: ' + e.message); }).then(function () { test.reportSuccessFailureCount(); });
