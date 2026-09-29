'use strict';

// spirit/test/deskFresh.js
// DESK KEEPS ITS DISPLAYS FRESH BY ITSELF — slim/G1.6, written FIRST, red on
// today's code (claude-windows tests, wsl-claude builds).
//
//   Andy, after an explanation kept a line its item had dropped: "no use if
//   these displays go stale", "is this programatically or do i have to rely
//   on agents to remember?", "File this as an item, it affect us all
//   immediately." His go on the wording: when an item's text changes, Desk
//   marks its explanation stale and asks for a fresh one; when an item's
//   status changes, Desk puts an update request on the items it blocks and
//   that block it. And: "the blocked and blocks lists link to the
//   respective items."
//
// THE CONTRACT (agreed with wsl-claude before the build):
//   THE DESK SERVER (process/js/desk/desk.js) walks every line, as pending()
//   does, so it folds what Desk alone cannot see (it loads only the newest
//   session):
//     fresh.get {} -> {items: [{key: id, label: JSON {id, changedAt,
//     updateRequested}}], more}, one per item of the newest session, the goal
//     too.
//     - changedAt: the `at` of the newest session in which the item's text
//       (title, description, check, tests, inPlace) differs from the session
//       before, or of the one it first appeared in (S1).
//     - NO update requests (S2): Andy dropped them, 2026-09-30, since the
//       lists are Desk's data and update at once; only prose an agent wrote
//       goes stale, and that is changedAt's job.
//   DESK (shell/desk/desk.js) asks fresh.get, marks no row 'update?' (L1),
//   and its blocks and waits-on cells are links, data-open="<id>", as the
//   dialog's lists are (L2).
//   THE DIALOG draws blocking and blocked-by in a foldable block of their
//   own, #dd-links (data-fold="links"), between the explanation and the item
//   record, never inside the explanation (D5).
//   THE DIALOG (shell/deskDetails) reads row.changedAt:
//     - an explanation older than it shows 'stale' in #dd-blurb, and the
//       open sends one explain request, unless he already asked after
//       changedAt (D1); a fresh explanation clears 'stale' (D2).
//     - its facts' 'waits on' and the 'No Go yet: it waits on' line link
//       each id, data-open="<id>" (D3).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by slim/G1.6: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
const LEAD = 'MCowBQYDK2VwAyEAleadleadleadleadleadleadleadleadleadl=';
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }

let n = 0;
function at(min) { return new Date(Date.UTC(2026, 8, 30, 8, min, 0)).toISOString(); }
function line(min, from, kind, text, todo) {
  n += 1;
  const dir = from === 'andy' ? 'out' : 'in';
  return { key: 'f' + String(n).padStart(4, '0'), at: at(min), dir: dir, peer: LEAD,
    outcome: dir === 'in' ? 'received' : 'sent', from: from, kind: kind, text: text, todo: todo };
}
function session(items) { return JSON.stringify({ goal: { id: 't/G1', title: 'The goal' }, rules: [], items: items }); }
const A = { id: 't/G1.1', title: 'Alpha', description: 'first words', blocks: ['t/G1'] };
const B = { id: 't/G1.2', title: 'Beta', description: 'beta', blocks: ['t/G1'], inPlace: [{ what: 'x', where: 'a.js:1' }] };
const C = { id: 't/G1.3', title: 'Gamma', description: 'gamma', blocks: ['t/G1.1'] };
const A2 = Object.assign({}, A, { description: 'changed words' });
const B2 = Object.assign({}, B, { inPlace: [{ what: 'x', where: 'a.js:2' }] });

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

test.startTest('slim/G1.6: Desk keeps its displays fresh by itself');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskfresh-'));
const kids = [];

(async function () {
  // ── THE DESK SERVER ─────────────────────────────────────────────────
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  const rows = [
    line(1, 'claude-windows', 'session', session([A, B, C]), 'team/chat'),
    line(2, 'claude-windows', 'note', 'on A', 't/G1.1'),
    line(3, 'claude-windows', 'session', session([A, B, C]), 'team/chat'),   // nothing changed
    line(5, 'claude-windows', 'session', session([A2, B2, C]), 'team/chat'), // A's words, B's inPlace
    line(6, 'wsl-claude', 'note', 'on the goal', 't/G1'),
    line(7, 'claude-windows', 'note', 'on C', 't/G1.3'),
    line(8, 'andy', 'answer', 'done.', 't/G1.1'),                            // A's status changes
  ];
  const db = new DatabaseSync(path.join(state, 'desk.db'));
  db.exec('CREATE TABLE IF NOT EXISTS lines (key TEXT PRIMARY KEY, at TEXT, todo TEXT, sender TEXT, kind TEXT, body TEXT, line TEXT NOT NULL);' +
    'CREATE TABLE IF NOT EXISTS docs (name TEXT PRIMARY KEY, json TEXT NOT NULL);');
  const ins = db.prepare('INSERT OR REPLACE INTO lines (key, at, todo, sender, kind, body, line) VALUES (?, ?, ?, ?, ?, ?, ?)');
  rows.forEach(function (m) { ins.run(m.key, m.at, m.todo, m.from, m.kind, m.text, JSON.stringify(m)); });
  db.close();

  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('desk', pipe);
  const call = function (verb, args) { const b = {}; b[verb] = args; return client.ask({ desk: b }).then(function (r) { return r.body || {}; }); };
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  kids.push(kid);
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ }
  }
  async function fresh() {
    const r = await call('fresh.get', {});
    const by = {};
    ((r && r.items) || []).forEach(function (i) { try { const o = JSON.parse(i.label); by[o.id] = o; } catch (e) { /* not one */ } });
    return { raw: r, by: by };
  }

  test.subHeading('S1: changedAt is when an item\'s text last changed, inPlace included');
  const f1 = await fresh();
  const a = f1.by['t/G1.1'] || {}, b = f1.by['t/G1.2'] || {}, c = f1.by['t/G1.3'] || {};
  if (a.changedAt === at(5) && b.changedAt === at(5) && c.changedAt === at(1)) {
    test.check('A (words) and B (inPlace) changed at the third session; C, unchanged, dates from its first');
  } else test.fail(OWED + 'fresh.get answered ' + JSON.stringify(f1.raw).slice(0, 240));

  // NO UPDATE REQUESTS (Andy, 2026-09-30): what goes stale on a status
  // change is only lists an agent copied into prose; the lists are Desk's
  // data, drawn at once ("So there's no reason to queue update requests when
  // an item closes etc..?", "that would save me lots of agent-work that can
  // be done programatically"). A's done at 8 asks nothing of anyone.
  test.subHeading('S2: a status change asks nobody for an update');
  const asking = Object.keys(f1.by).filter(function (id) { return f1.by[id].updateRequested; });
  if (Object.keys(f1.by).length && !asking.length) test.check('after A\'s done, no item carries an update request');
  else test.fail(OWED + 'update requests are gone from G1.6, yet ' + JSON.stringify(asking) + ' carry one');

  // ── THE LIST ────────────────────────────────────────────────────────
  const listLog = [line(1, 'claude-windows', 'session', session([A, B, C]), 'team/chat')];
  const fake = require('./deskFake.js').fromFiles({ 'log/log.json': JSON.stringify(listLog) });
  // Even a server that still answered one: the List draws no 'update?'.
  const answerFresh = { items: [{ key: 't/G1.3', label: JSON.stringify({ id: 't/G1.3', changedAt: at(1), updateRequested: true }) },
    { key: 't/G1.2', label: JSON.stringify({ id: 't/G1.2', changedAt: at(1) }) }], more: false };
  const verb = function (name, body) {
    const ask = body && body.ask && body.ask.desk;
    if (ask && ask['fresh.get']) return Promise.resolve({ status: 200, body: answerFresh });
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

  test.subHeading('L1: the List marks no row for an update');
  if (!/update\?/.test(list)) test.check('no row shows update?');
  else test.fail(OWED + 'the List still shows update?: ' + JSON.stringify(rowOf('Gamma').replace(/\s+/g, ' ').slice(0, 200)));

  test.subHeading('L2: the List\'s blocks and waits-on cells link to their items');
  if (rowOf('Gamma').indexOf('data-open="t/G1.1"') !== -1 && rowOf('Alpha').indexOf('data-open="t/G1.3"') !== -1) {
    test.check('Gamma\'s blocks cell links t/G1.1; Alpha\'s waits-on cell links t/G1.3');
  } else test.fail(OWED + 'Gamma row ' + JSON.stringify(rowOf('Gamma').replace(/\s+/g, ' ').slice(0, 160)) +
    ' | Alpha row ' + JSON.stringify(rowOf('Alpha').replace(/\s+/g, ' ').slice(0, 160)));

  // ── THE DIALOG ──────────────────────────────────────────────────────
  function dialog(row, thread) {
    const ddoc = fakeDocument();
    const dd = load(DETAILS, ddoc);
    const packets = [];
    const sent = [];
    dd.mount(fakeElement('dd'), { escapeHtml: kernel.core.util.escapeHtml, onPacket: function (app, fn) { packets.push(fn); },
      setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
      peerPost: function (to, app, body) { sent.push(body); return Promise.resolve({ ok: true }); },
      fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } } });
    const others = { id: 't/G1.1', title: 'Alpha', blocks: ['t/G1'], waitsOn: [], done: false };
    dd.open({ id: row.id, row: row, agents: { 'claude-windows': LEAD }, session: [row, others], rules: [], thread: thread });
    return {
      doc: ddoc, sent: sent,
      arrive: function (text, when) {
        packets.forEach(function (fn) { fn({ from: 'claude-windows', kind: 'explain', text: text, todo: row.id }, { hash: 'h-' + when, fromKey: LEAD, sentAt: when }); });
      },
    };
  }
  const explainAsks = function (sent) { return sent.filter(function (b) { return b && /^explain\b/.test(String(b.text || '')); }).length; };
  const staleRow = { id: 't/G1.3', title: 'Gamma', description: 'gamma', blocks: ['t/G1.1'], waitsOn: ['t/G1.1'], verified: true, done: false, changedAt: at(5) };

  test.subHeading('D1: an explanation older than the item\'s change shows stale, and one fresh one is asked for');
  const d1 = dialog(staleRow, [line(2, 'claude-windows', 'explain', 'OLD-EXPLAIN', 't/G1.3')]);
  for (let i = 0; i < 4; i++) await settle();
  const blurb1 = d1.doc.getElementById('dd-blurb').innerHTML + d1.doc.getElementById('dd-title').innerHTML;
  if (/stale/i.test(blurb1) && /OLD-EXPLAIN/.test(blurb1) && explainAsks(d1.sent) === 1) {
    test.check('the old explanation is shown, marked stale, and the open sent one explain request');
  } else test.fail(OWED + 'stale shown ' + /stale/i.test(blurb1) + ', explain requests sent ' + explainAsks(d1.sent));
  const d1b = dialog(staleRow, [line(2, 'claude-windows', 'explain', 'OLD-EXPLAIN', 't/G1.3'),
    line(6, 'andy', 'ask', 'explain this to me: what is it, and why is it where it is?', 't/G1.3')]);
  for (let i = 0; i < 4; i++) await settle();
  if (explainAsks(d1b.sent) === 0) test.check('already asked after the change: the open asks again for nothing');
  else test.fail(OWED + 'asked again, ' + explainAsks(d1b.sent) + ' request(s), after he had already asked');

  test.subHeading('D2: a fresh explanation clears stale');
  d1.arrive('NEW-EXPLAIN', at(10));
  for (let i = 0; i < 4; i++) await settle();
  const blurb2 = d1.doc.getElementById('dd-blurb').innerHTML + d1.doc.getElementById('dd-title').innerHTML;
  if (/NEW-EXPLAIN/.test(blurb2) && !/stale/i.test(blurb2)) test.check('the new explanation shows, not marked stale');
  else test.fail(OWED + 'after a fresh one: ' + JSON.stringify(blurb2.replace(/\s+/g, ' ').slice(0, 160)));
  const freshRow = Object.assign({}, staleRow, { changedAt: at(1) });
  const d2 = dialog(freshRow, [line(2, 'claude-windows', 'explain', 'CURRENT-EXPLAIN', 't/G1.3')]);
  for (let i = 0; i < 4; i++) await settle();
  const blurb3 = d2.doc.getElementById('dd-blurb').innerHTML + d2.doc.getElementById('dd-title').innerHTML;
  if (/CURRENT-EXPLAIN/.test(blurb3) && !/stale/i.test(blurb3) && explainAsks(d2.sent) === 0) test.check('an explanation newer than the change is not stale, and nothing is asked');
  else test.fail(OWED + 'a current explanation: stale ' + /stale/i.test(blurb3) + ', requests ' + explainAsks(d2.sent));

  // THE LISTS ARE DESK'S, IN A BLOCK OF THEIR OWN (Andy: "so they just need
  // to be displayed outside of the agent-supplied explanation, and they can
  // be updated instantly/programmatically?", "two separate foldable
  // blocks?"). Today they sit inside the folded item record.
  test.subHeading('D5: blocking and blocked-by are a foldable block of their own, outside the explanation');
  const d5 = dialog(Object.assign({}, staleRow, { changedAt: at(1) }), [line(2, 'claude-windows', 'explain', 'WHAT-AND-WHY', 't/G1.3')]);
  for (let i = 0; i < 4; i++) await settle();
  const frame5 = d5.doc.getElementById('dd-body').innerHTML;
  const links5 = d5.doc.getElementById('dd-links').innerHTML;
  const pos = function (s) { return frame5.indexOf(s); };
  if (pos('id="dd-links"') !== -1 && pos('id="dd-blurb"') < pos('id="dd-links"') && pos('id="dd-links"') < pos('id="dd-item"') &&
      links5.indexOf('data-open="t/G1.1"') !== -1 && /data-fold="links"/.test(frame5 + links5) &&
      d5.doc.getElementById('dd-blurb').innerHTML.indexOf('data-open') === -1) {
    test.check('#dd-links sits between the explanation and the record, folds on its own, and links t/G1.1; the explanation holds no list');
  } else test.fail(OWED + 'links block at ' + pos('id="dd-links"') + ' (blurb ' + pos('id="dd-blurb"') + ', item ' + pos('id="dd-item"') +
    '), holds the link ' + (links5.indexOf('data-open="t/G1.1"') !== -1) + ', folds ' + /data-fold="links"/.test(frame5 + links5));

  test.subHeading('D3: the dialog\'s waits-on fact and its No Go line link each id');
  const d3 = dialog(staleRow, [line(2, 'claude-windows', 'explain', 'E', 't/G1.3'), line(3, 'claude-windows', 'ask', 'ready: go?', 't/G1.3')]);
  for (let i = 0; i < 4; i++) await settle();
  const facts = d3.doc.getElementById('dd-facts').innerHTML;
  const decide = d3.doc.getElementById('dd-decide').innerHTML + d3.doc.getElementById('dd-name-row').innerHTML;
  if (facts.indexOf('data-open="t/G1.1"') !== -1 && /waits on/.test(decide) && decide.indexOf('data-open="t/G1.1"') !== -1) {
    test.check('both the waits-on fact and "No Go yet: it waits on" link t/G1.1');
  } else test.fail(OWED + 'facts link ' + (facts.indexOf('data-open="t/G1.1"') !== -1) + ', No Go line ' + JSON.stringify(decide.replace(/\s+/g, ' ').slice(0, 160)));

  // ── D4: ONE DECISION FOR THE GO! BUTTON ─────────────────────────────
  //
  // Andy, 2026-09-30: "Why is't the appearance and disappearance of the go
  // button synced between a lit item and it's panel?", then "they obviously
  // need to work it out from the same data." Shape (wsl-claude): desk.js puts
  // its own decision on the row it hands the dialog, row.goState
  // (unverified | held | go | none), and the dialog draws Go! from that and
  // from nothing else.
  test.subHeading('D4: the List hands its Go! decision to the dialog with the row');
  const goLog = [line(1, 'claude-windows', 'session', session([A, B, C]), 'team/chat'),
    line(2, 'claude-windows', 'note', 'IN PLACE VERIFIED', 't/G1.2'), line(3, 'claude-windows', 'ask', 'ready: go?', 't/G1.2'),
    line(2, 'claude-windows', 'note', 'IN PLACE VERIFIED', 't/G1.3'), line(3, 'claude-windows', 'ask', 'ready: go?', 't/G1.3')];
  const opened = [];
  const gdoc = fakeDocument();
  load(DESK, gdoc).mount(fakeElement('container'), {
    fs: { loadFile: function (f) { return f === 'log/log.json' ? JSON.stringify(goLog) : null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: require('./deskFake.js').fromFiles({ 'log/log.json': JSON.stringify(goLog) }).verb,
    onPacket: function () {}, peerPost: function () { return Promise.resolve({ ok: true }); },
    callDialog: function (name, params) { opened.push(params); return new Promise(function () {}); },
  });
  for (let i = 0; i < 6; i++) await settle();
  const goList = ['desk-top', 'desk-session', 'desk-goal'].map(function (id) { return gdoc.getElementById(id).innerHTML; }).join(' ');
  const openRow = function (id) {
    const box = gdoc.getElementById('desk-session');
    box.fire('click', { target: { getAttribute: function (a) { return a === 'data-open' ? id : null; }, parentNode: null }, currentTarget: box });
    return opened[opened.length - 1] || {};
  };
  // Beta waits on nothing, is verified and asks: Go! in the List.
  const listGo = function (id) { return goList.indexOf('data-go="' + id + '"') !== -1; };
  const pBeta = (openRow('t/G1.2') || {}).row || {};
  if (listGo('t/G1.2') && pBeta.goState === 'go') test.check('Beta shows Go! in the List, and the dialog is handed goState go');
  else test.fail(OWED + 'Beta: List Go! ' + listGo('t/G1.2') + ', handed goState ' + JSON.stringify(pBeta.goState));

  function goDialog(goState, thread) {
    const row = Object.assign({}, { id: 't/G1.2', title: 'Beta', blocks: ['t/G1'], waitsOn: [], verified: true, done: false, changedAt: at(1) }, { goState: goState });
    const d = dialog(row, thread);
    return d;
  }
  const askThen = [line(2, 'claude-windows', 'explain', 'E', 't/G1.2'), line(3, 'claude-windows', 'ask', 'ready: go?', 't/G1.2'),
    line(4, 'andy', 'answer', 'retitle: Beta renamed', 't/G1.2')];
  const dGo = goDialog('go', askThen);
  const dHeld = goDialog('held', askThen.slice(0, 2));
  for (let i = 0; i < 4; i++) await settle();
  const hasGo = function (d) { return /id="dd-go"/.test(d.doc.getElementById('dd-name-row').innerHTML + d.doc.getElementById('dd-decide').innerHTML); };
  if (hasGo(dGo) && !hasGo(dHeld)) {
    test.check('goState go draws Go! even after his retitle answer; goState held draws none though the thread has an open ask');
  } else test.fail(OWED + 'dialog Go! with goState go (after a retitle) ' + hasGo(dGo) + ', with goState held ' + hasGo(dHeld));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
