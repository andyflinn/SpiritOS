'use strict';

// cleanup/G1.11: the desk server decides every button of Andy's; the List and the dialog only draw them.
// Andy: "the buttons MUST be synchronized and use the same data to judge state", "and the same code",
// "shouldnt that state determination be located in deskServer?", "there should be no lower box",
// "the upper box defines what the item is about", "and the other two boxes are useless, kill them".
// The contract the builder follows:
//   process/js/desk/desk.js: items.search {text:''} answers { items: [{ key: id, label: JSON {id, changedAt, buttons}] },
//     buttons among 'go' | 'done' | 'reopen' | 'close', folded from desk.db by at, then key. fresh.get is gone.
//   shell/desk/desk.js draws Go! and Close from item.buttons and hands buttons to the dialog with the row.
//   shell/deskDetails/deskDetails.js draws Go!, Done and Reopen from row.buttons; one box, at the top,
//     with the item's description; no explanation box, no #dd-decide; it redraws on a new session.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by cleanup/G1.11: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
const LEAD = 'MCowBQYDK2VwAyEAleadleadleadleadleadleadleadleadleadl=';
const WSL = 'MCowBQYDK2VwAyEAwslwslwslwslwslwslwslwslwslwslwslwslwsl=';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
let n = 0;
function at(min) { return new Date(Date.UTC(2026, 8, 30, 9, min, 0)).toISOString(); }
function line(min, from, kind, text, todo) {
  n += 1;
  const dir = from === 'andy' ? 'out' : 'in';
  return { key: 'b' + String(n).padStart(4, '0'), at: at(min), dir: dir, peer: from === 'wsl-claude' ? WSL : LEAD,
    outcome: dir === 'in' ? 'received' : 'sent', from: from, kind: kind, text: text, todo: todo };
}
const item = function (id, title, extra) { return Object.assign({ id: id, title: title, description: title + ' is about this', blocks: ['t/G1'] }, extra || {}); };
const GO = item('t/G1.1', 'Alpha');
const READY = item('t/G1.2', 'Beta');
const DONE = item('t/G1.3', 'Gamma');
const LATE = item('t/G1.4', 'Delta');
const HELD = item('t/G1.5', 'Epsilon');
const BLOCKER = item('t/G1.6', 'Zeta', { blocks: ['t/G1.5'] });
function session(items) { return JSON.stringify({ goal: { id: 't/G1', title: 'The goal', description: 'the goal text' }, rules: [], items: items }); }
const ITEMS = [GO, READY, DONE, LATE, HELD, BLOCKER];

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
function load(script, doc) {
  let b = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(script, 'utf8'))(
    { shell: { activateApp: function (x) { b = x; } }, core: kernel.core }, doc, {});
  return b;
}
function code(file) {
  return fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');
}
const same = function (a, b) { return JSON.stringify((a || []).slice().sort()) === JSON.stringify(b.slice().sort()); };

test.startTest('cleanup/G1.11: the desk server decides every button; the List and the dialog only draw');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskbuttons-'));
const kids = [];

(async function () {
  // ── THE DESK SERVER ─────────────────────────────────────────────────
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  const lateClaim = line(13, 'wsl-claude', 'note', 'READY TO CLOSE: Delta', 't/G1.4');
  const lateDone = line(14, 'andy', 'answer', 'done.', 't/G1.4');
  const rows = [
    line(1, 'claude-windows', 'session', session(ITEMS), 'team/chat'),
    line(2, 'claude-windows', 'ask', 'Go! = build Alpha', 't/G1.1'),
    line(3, 'claude-windows', 'note', 'VERIFIED: Alpha in place', 't/G1.1'),
    line(4, 'claude-windows', 'note', 'READY TO CLOSE: Beta', 't/G1.2'),
    line(5, 'wsl-claude', 'note', 'READY TO CLOSE: Beta', 't/G1.2'),
    line(6, 'claude-windows', 'note', 'READY TO CLOSE: Gamma', 't/G1.3'),
    line(7, 'wsl-claude', 'note', 'READY TO CLOSE: Gamma', 't/G1.3'),
    line(8, 'andy', 'answer', 'done.', 't/G1.3'),
    line(9, 'claude-windows', 'ask', 'Go! = build Epsilon', 't/G1.5'),
    line(10, 'claude-windows', 'note', 'VERIFIED: Epsilon in place', 't/G1.5'),
    line(12, 'claude-windows', 'note', 'READY TO CLOSE: Delta', 't/G1.4'),
  ];
  const db = new DatabaseSync(path.join(state, 'desk.db'));
  db.exec('CREATE TABLE IF NOT EXISTS lines (key TEXT PRIMARY KEY, at TEXT, todo TEXT, sender TEXT, kind TEXT, body TEXT, line TEXT NOT NULL);' +
    'CREATE TABLE IF NOT EXISTS docs (name TEXT PRIMARY KEY, json TEXT NOT NULL);');
  const ins = db.prepare('INSERT OR REPLACE INTO lines (key, at, todo, sender, kind, body, line) VALUES (?, ?, ?, ?, ?, ?, ?)');
  rows.forEach(function (m) { ins.run(m.key, m.at, m.todo, m.from, m.kind, m.text, JSON.stringify(m)); });
  // His done. inserted before the second claim, but stamped after it (wsl-claude): the record's time order decides.
  [lateDone, lateClaim].forEach(function (m) { ins.run(m.key, m.at, m.todo, m.from, m.kind, m.text, JSON.stringify(m)); });
  db.close();

  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('desk', pipe);
  const call = function (verb, args) { const b = {}; b[verb] = args; return client.ask({ desk: b }); };
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  kids.push(kid);
  let api = null;
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) { api = r.body.desk; break; } } catch (e) { /* not yet */ }
  }

  test.subHeading('the desk server answers each item\'s buttons');
  const verbs = JSON.stringify(api || {});
  if (/items\.search/.test(verbs) && !/fresh\.get/.test(verbs)) test.check('items.search is served and fresh.get is gone');
  else test.fail(OWED + 'the desk server\'s verbs: ' + verbs.slice(0, 200));
  const r = await call('items.search', { text: '' });
  const by = {};
  (((r && r.body) || {}).items || []).forEach(function (i) { try { const o = JSON.parse(i.label); by[o.id] = o; } catch (e) { /* not one */ } });
  const want = { 't/G1.1': ['go'], 't/G1.2': ['done'], 't/G1.3': ['close', 'reopen'], 't/G1.4': ['close', 'reopen'], 't/G1.5': [], 't/G1.6': [] };
  const why = { 't/G1.1': 'asked and verified', 't/G1.2': 'both claimed', 't/G1.3': 'both claimed, then his done.',
    't/G1.4': 'his done. inserted before the second claim but stamped after it', 't/G1.5': 'asked and verified, but it waits on open t/G1.6', 't/G1.6': 'nothing asked or claimed' };
  Object.keys(want).forEach(function (id) {
    const got = by[id] && by[id].buttons;
    if (Array.isArray(got) && same(got, want[id])) test.check(id + ' (' + why[id] + '): ' + JSON.stringify(want[id]));
    else test.fail(OWED + id + ' (' + why[id] + ') answered ' + JSON.stringify(by[id] || null) + ', want buttons ' + JSON.stringify(want[id]));
  });

  // ── THE LIST: it draws what the server says, even where its own log would say otherwise ──
  const listLog = [line(1, 'claude-windows', 'session', session(ITEMS), 'team/chat')];
  const answer = { items: ITEMS.map(function (it) {
    const b = it.id === 't/G1.1' ? ['go'] : it.id === 't/G1.3' ? ['close', 'reopen'] : [];
    return { key: it.id, label: JSON.stringify({ id: it.id, changedAt: at(1), buttons: b }) };
  }), more: false };
  const fake = require('./deskFake.js').fromFiles({ 'log/log.json': JSON.stringify(listLog) });
  const verb = function (name, body) {
    const ask = body && body.ask && body.ask.desk;
    if (ask && ask['items.search']) return Promise.resolve({ status: 200, body: answer });
    return fake.verb(name, body);
  };
  const doc = fakeDocument();
  load(DESK, doc).mount(fakeElement('container'), {
    fs: { loadFile: function (f) { return f === 'log/log.json' ? JSON.stringify(listLog) : null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: verb,
    onPacket: function () {}, peerPost: function () { return Promise.resolve({ ok: true }); }, callDialog: function () { return new Promise(function () {}); },
  });
  for (let i = 0; i < 6; i++) await settle();
  const list = ['desk-top', 'desk-session', 'desk-goal'].map(function (id) { return doc.getElementById(id).innerHTML; }).join(' ');
  const rowOf = function (title) { return list.split('<tr').filter(function (s) { return s.indexOf(title) !== -1; })[0] || ''; };

  test.subHeading('the List draws the server\'s buttons, and decides none');
  if (rowOf('Alpha').indexOf('data-go=') !== -1) test.check('Alpha: Go!, from buttons alone (its log holds no ask)');
  else test.fail(OWED + 'Alpha row: ' + JSON.stringify(rowOf('Alpha').replace(/\s+/g, ' ').slice(0, 200)));
  if (rowOf('Gamma').indexOf('data-close=') !== -1) test.check('Gamma: Close, from buttons alone (its log holds no done.)');
  else test.fail(OWED + 'Gamma row: ' + JSON.stringify(rowOf('Gamma').replace(/\s+/g, ' ').slice(0, 200)));
  const listCode = code(DESK);
  const listOwn = ['DESK_READY_CLAIM', 'DESK_VERIFIED_CLAIM', 'deskGoState', 'deskReady', 'fresh.get'].filter(function (w) { return listCode.indexOf(w) !== -1; });
  if (!listOwn.length) test.check('shell/desk/desk.js keeps no READY, VERIFIED or go rule, and no fresh.get');
  else test.fail(OWED + 'shell/desk/desk.js still has ' + listOwn.join(', '));

  // ── THE DIALOG ──────────────────────────────────────────────────────
  function dialog(row, thread) {
    const ddoc = fakeDocument();
    const dd = load(DETAILS, ddoc);
    const packets = [];
    dd.mount(fakeElement('dd'), { escapeHtml: kernel.core.util.escapeHtml, onPacket: function (app, fn) { packets.push(fn); },
      setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
      peerPost: function () { return Promise.resolve({ ok: true }); },
      verb: verb,
      fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } } });
    dd.open({ id: row.id, row: row, agents: { 'claude-windows': LEAD, 'wsl-claude': WSL }, session: [row], rules: [], thread: thread });
    const html = function () { return Object.keys(ddoc.all).map(function (k) { return ddoc.all[k].innerHTML; }).join(' ') + ' ' + ((ddoc.all.dd && ddoc.all.dd.innerHTML) || ''); };
    return { doc: ddoc, html: html, buttons: function () { return ddoc.getElementById('dd-name-row').innerHTML; },
      deliver: function (m) { packets.forEach(function (fn) { fn({ from: m.from, kind: m.kind, text: m.text, todo: m.todo }, { hash: 'h-' + m.key, fromKey: LEAD, sentAt: m.at }); }); } };
  }
  const row = function (id, buttons, done, extra) {
    return Object.assign({ id: id, title: 'Row', description: 'ROW-DEFINITION', check: 'ROW-CHECK', blocks: ['t/G1'], waitsOn: [], verified: true, done: !!done, buttons: buttons }, extra || {});
  };
  const claims = function (id) { return [line(20, 'claude-windows', 'note', 'READY TO CLOSE: x', id), line(21, 'wsl-claude', 'note', 'READY TO CLOSE: x', id)]; };

  test.subHeading('the dialog draws its buttons from row.buttons and nothing else');
  const d1 = dialog(row('t/G1.7', ['done']), []);
  for (let i = 0; i < 4; i++) await settle();
  if (d1.buttons().indexOf('id="dd-done"') !== -1) test.check('buttons [done], nobody claimed in its thread: Done');
  else test.fail(OWED + 'row.buttons [done] drew ' + JSON.stringify(d1.buttons().slice(0, 160)));
  const d2 = dialog(row('t/G1.8', []), claims('t/G1.8'));
  for (let i = 0; i < 4; i++) await settle();
  if (d2.buttons().indexOf('id="dd-done"') === -1) test.check('buttons [], both claims in its thread: no Done');
  else test.fail(OWED + 'the dialog drew Done from its own thread');
  const d3 = dialog(row('t/G1.9', ['go']), []);
  for (let i = 0; i < 4; i++) await settle();
  if (d3.buttons().indexOf('id="dd-go"') !== -1) test.check('buttons [go], no ask in its thread: Go!');
  else test.fail(OWED + 'row.buttons [go] drew ' + JSON.stringify(d3.buttons().slice(0, 160)));
  const d4 = dialog(row('t/G1.10', ['close', 'reopen'], true), []);
  for (let i = 0; i < 4; i++) await settle();
  if (d4.buttons().indexOf('id="dd-reopen"') !== -1 && d4.buttons().indexOf('id="dd-done"') === -1) test.check('buttons [close, reopen]: Reopen, no Done');
  else test.fail(OWED + 'row.buttons [close, reopen] drew ' + JSON.stringify(d4.buttons().slice(0, 160)));

  test.subHeading('one box, at the top: what the item is about');
  const d5 = dialog(row('t/G1.11', []), [line(22, 'claude-windows', 'explain', 'AN-EXPLANATION', 't/G1.11'),
    line(23, 'claude-windows', 'ask', 'AN-ASK-TEXT', 't/G1.11')]);
  for (let i = 0; i < 4; i++) await settle();
  const page = d5.html();
  const gone = ['id="dd-decide"', 'id="dd-blurb"'].filter(function (s) { return page.indexOf(s) !== -1; });
  if (!gone.length) test.check('no explanation box and no lower box (#dd-blurb, #dd-decide)');
  else test.fail(OWED + 'the dialog still has ' + gone.join(', '));
  if (page.indexOf('AN-EXPLANATION') === -1 || page.indexOf('AN-EXPLANATION') > page.indexOf('ROW-DEFINITION')) {
    if (page.indexOf('ROW-DEFINITION') !== -1) test.check('the item\'s description is in the box, and no explanation above it');
    else test.fail(OWED + 'the item\'s description is not drawn');
  } else test.fail(OWED + 'an explanation is drawn above the item\'s description');
  const chat = d5.doc.getElementById('dd-chat').innerHTML;
  if (chat.indexOf('AN-ASK-TEXT') !== -1) test.check('the ask is read in the chat log');
  else test.fail('the ask is not in the chat log: ' + JSON.stringify(chat.slice(0, 160)));

  test.subHeading('an open dialog redraws its item when a new session arrives');
  const d6 = dialog(row('t/G1.1', ['go'], false, { title: 'Alpha', description: 'OLD-WORDS' }), []);
  for (let i = 0; i < 4; i++) await settle();
  d6.deliver(line(30, 'claude-windows', 'session', session([Object.assign({}, GO, { description: 'NEW-WORDS' })]), 'team/chat'));
  for (let i = 0; i < 8; i++) await settle();
  if (d6.html().indexOf('NEW-WORDS') !== -1 && d6.html().indexOf('OLD-WORDS') === -1) test.check('the open dialog shows the new description');
  else test.fail(OWED + 'after a new session the open dialog shows ' + (d6.html().indexOf('OLD-WORDS') !== -1 ? 'the old words' : 'neither'));

  test.subHeading('one piece of code: the dialog keeps no rule of its own');
  const dd = code(DETAILS);
  const own = [];
  if (/\.ready\b/.test(dd)) own.push('a ready flag');
  if (/mine\.done\s*=/.test(dd)) own.push('marks a row done on its own press');
  if (/openAsk/.test(dd)) own.push('a go rule from its own open ask');
  if (!own.length) test.check('deskDetails.js has no ready flag, no go rule and no local done');
  else test.fail(OWED + 'deskDetails.js still decides: ' + own.join(', '));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  setTimeout(function () { try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ } }, 300);
  test.reportSuccessFailureCount();
});
