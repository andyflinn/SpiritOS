'use strict';

// cleanup/G1.11: every button of Andy's in Desk is judged from one state, by one piece of code.
// Andy: "i keep saying that the buttons MUST be synchronized and use the same data to judge state." "and the same code"
// The contract the builder follows:
//   shell/desk/desk.js decides a row's buttons once, and hands them with the row: row.buttons, a list of
//   'go' | 'done' | 'reopen' | 'close'. The List draws its Go! and Close from that list.
//   shell/deskDetails/deskDetails.js draws Go!, Done and Reopen from row.buttons and from nothing else:
//   no ready flag and no go rule of its own, and a press never marks the row done on its own.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by cleanup/G1.11: ';
const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
const LEAD = 'MCowBQYDK2VwAyEAleadleadleadleadleadleadleadleadleadl=';
const WSL = 'MCowBQYDK2VwAyEAwslwslwslwslwslwslwslwslwslwslwslwslwsl=';

function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
let n = 0;
function at(min) { return new Date(Date.UTC(2026, 8, 30, 9, min, 0)).toISOString(); }
function line(min, from, kind, text, todo) {
  n += 1;
  const dir = from === 'andy' ? 'out' : 'in';
  return { key: 'b' + String(n).padStart(4, '0'), at: at(min), dir: dir, peer: from === 'wsl-claude' ? WSL : LEAD,
    outcome: dir === 'in' ? 'received' : 'sent', from: from, kind: kind, text: text, todo: todo };
}
const A = { id: 't/G1.1', title: 'Alpha', description: 'alpha', blocks: ['t/G1'] };
const B = { id: 't/G1.2', title: 'Beta', description: 'beta', blocks: ['t/G1'] };
const C = { id: 't/G1.3', title: 'Gamma', description: 'gamma', blocks: ['t/G1'] };
function session() { return JSON.stringify({ goal: { id: 't/G1', title: 'The goal' }, rules: [], items: [A, B, C] }); }

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
function code(file) {
  return fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');
}

test.startTest('cleanup/G1.11: Desk judges every button from one state, by one piece of code');

(async function () {
  const log = [
    line(1, 'claude-windows', 'session', session(), 'team/chat'),
    line(2, 'claude-windows', 'ask', 'Go! = build Alpha', 't/G1.1'),
    line(3, 'claude-windows', 'note', 'VERIFIED: Alpha in place', 't/G1.1'),
    line(4, 'claude-windows', 'note', 'READY TO CLOSE: Beta', 't/G1.2'),
    line(5, 'wsl-claude', 'note', 'READY TO CLOSE: Beta', 't/G1.2'),
    line(6, 'claude-windows', 'note', 'READY TO CLOSE: Gamma', 't/G1.3'),
    line(7, 'wsl-claude', 'note', 'READY TO CLOSE: Gamma', 't/G1.3'),
    line(8, 'andy', 'answer', 'done.', 't/G1.3'),
  ];
  const fake = require('./deskFake.js').fromFiles({ 'log/log.json': JSON.stringify(log) });
  const doc = fakeDocument();
  const opened = [];
  const desk = load(DESK, doc);
  desk.mount(fakeElement('container'), {
    fs: { loadFile: function (f) { return f === 'log/log.json' ? JSON.stringify(log) : null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: fake.verb,
    onPacket: function () {}, peerPost: function () { return Promise.resolve({ ok: true }); },
    callDialog: function (name, params) { opened.push(params); return new Promise(function () {}); },
  });
  for (let i = 0; i < 6; i++) await settle();
  const list = ['desk-top', 'desk-session', 'desk-goal'].map(function (id) { return doc.getElementById(id).innerHTML; }).join(' ');
  const rowOf = function (title) { return list.split('<tr').filter(function (s) { return s.indexOf(title) !== -1; })[0] || ''; };

  test.subHeading('the List');
  if (rowOf('Alpha').indexOf('data-go=') !== -1) test.check('Alpha, asked and verified, shows Go!');
  else test.fail('Alpha row: ' + JSON.stringify(rowOf('Alpha').replace(/\s+/g, ' ').slice(0, 200)));
  if (rowOf('Gamma').indexOf('data-close=') !== -1) test.check('Gamma, both claims then his done., shows Close');
  else test.fail(OWED + 'Gamma row: ' + JSON.stringify(rowOf('Gamma').replace(/\s+/g, ' ').slice(0, 200)));

  test.subHeading('the List hands each row its buttons, decided once');
  const rowFor = typeof desk.rowOf === 'function' ? desk.rowOf : null;
  if (!rowFor) {
    test.fail(OWED + 'desk.js exposes no rowOf(id), the row the dialog is opened with');
  } else {
    const want = { 't/G1.1': ['go'], 't/G1.2': ['done'], 't/G1.3': ['close', 'reopen'] };
    Object.keys(want).forEach(function (id) {
      const r = rowFor(id) || {};
      const got = Array.isArray(r.buttons) ? r.buttons.slice().sort() : null;
      if (got && JSON.stringify(got) === JSON.stringify(want[id].slice().sort())) test.check(id + ' carries buttons ' + JSON.stringify(want[id]));
      else test.fail(OWED + id + ' carries buttons ' + JSON.stringify(r.buttons) + ', want ' + JSON.stringify(want[id]));
    });
  }

  function dialog(row, thread) {
    const ddoc = fakeDocument();
    const dd = load(DETAILS, ddoc);
    const sent = [];
    dd.mount(fakeElement('dd'), { escapeHtml: kernel.core.util.escapeHtml, onPacket: function () {},
      setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
      peerPost: function (to, app, body) { sent.push(body); return Promise.resolve({ ok: true }); },
      fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } } });
    dd.open({ id: row.id, row: row, agents: { 'claude-windows': LEAD, 'wsl-claude': WSL }, session: [row], rules: [], thread: thread });
    return { buttons: function () { return ddoc.getElementById('dd-name-row').innerHTML; }, doc: ddoc, sent: sent };
  }
  const base = function (id, buttons, done) { return { id: id, title: 'Row', description: 'row', blocks: ['t/G1'], waitsOn: [], verified: true, done: !!done, buttons: buttons }; };
  const claims = function (id) { return [line(20, 'claude-windows', 'note', 'READY TO CLOSE: x', id), line(21, 'wsl-claude', 'note', 'READY TO CLOSE: x', id)]; };

  test.subHeading('the dialog draws from row.buttons and nothing else');
  await settle();
  const d1 = dialog(base('t/G1.4', ['done']), []);
  for (let i = 0; i < 4; i++) await settle();
  if (d1.buttons().indexOf('id="dd-done"') !== -1) test.check('buttons [done], no claims in its thread: Done shows');
  else test.fail(OWED + 'row.buttons [done] drew ' + JSON.stringify(d1.buttons().slice(0, 160)));
  const d2 = dialog(base('t/G1.5', []), claims('t/G1.5'));
  for (let i = 0; i < 4; i++) await settle();
  if (d2.buttons().indexOf('id="dd-done"') === -1) test.check('buttons [], both claims in its thread: no Done');
  else test.fail(OWED + 'the dialog drew Done from its own thread, not from row.buttons');
  const d3 = dialog(base('t/G1.6', ['go']), []);
  for (let i = 0; i < 4; i++) await settle();
  if (d3.buttons().indexOf('id="dd-go"') !== -1) test.check('buttons [go], no ask in its thread: Go! shows');
  else test.fail(OWED + 'row.buttons [go] drew ' + JSON.stringify(d3.buttons().slice(0, 160)));
  const d4 = dialog(base('t/G1.7', ['close', 'reopen'], true), []);
  for (let i = 0; i < 4; i++) await settle();
  if (d4.buttons().indexOf('id="dd-reopen"') !== -1 && d4.buttons().indexOf('id="dd-done"') === -1) test.check('buttons [close, reopen]: Reopen shows, Done does not');
  else test.fail(OWED + 'row.buttons [close, reopen] drew ' + JSON.stringify(d4.buttons().slice(0, 160)));

  test.subHeading('one piece of code: the dialog keeps no rule of its own');
  const dd = code(DETAILS);
  const own = [];
  if (/\.ready\b/.test(dd)) own.push('a ready flag');
  if (/mine\.done\s*=/.test(dd)) own.push('marks a row done on its own press');
  if (/openAsk/.test(dd)) own.push('a go rule from its own open ask');
  if (!own.length) test.check('deskDetails.js has no ready flag, no go rule and no local done');
  else test.fail(OWED + 'deskDetails.js still decides: ' + own.join(', '));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
});
