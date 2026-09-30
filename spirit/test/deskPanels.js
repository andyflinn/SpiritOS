'use strict';

// EACH PANEL ITS OWN ANSWER, LOADED WHEN IT OPENS.
//   Andy, when a 3 KB box pushed his answers off the top of a dialog: "what kind of app doesn't measure the sum of
//   its packets?", "why would you sent all that shit at once? lazy load the panels when thy open".
// The contract:
//   item.get {id} answers the item's facts only: {item, version, change}.
//   item.box {id} -> {box, version}; item.checks {id} -> {checks}; item.chat {id} -> {chat, chatMore}, the chat's
//   newest lines in a whole answer of its own. Each fits one answer on its own.
//   box.write refuses a box too long to come back in one answer (line-too-large), as chat.add does for a line.
//   The item dialog asks item.get, then item.box, item.checks and item.chat, each on its own.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const kernel = require('../run/js/kernel.js');

const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }

test.startTest('each panel of an item its own answer');

(async function () {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskpanels-'));
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('desk', pipe);
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  try {
    for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ } }
    const call = function (verb, args) { const q = {}; q[verb] = args; return client.ask({ desk: q }).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; }); };
    await call('session.set', { json: JSON.stringify({ goal: { id: 'p/G1', title: 'Panels' }, items: [] }), by: 'claude-windows' });
    await call('box.write', { id: 'p/G1', text: 'B'.repeat(6000), version: 0, by: 'claude-windows' });
    await call('check.add', { id: 'p/G1', kind: 'C', words: 'look', test: '', by: 'claude-windows' });
    for (let i = 0; i < 30; i++) await call('chat.add', { id: 'p/G1', text: 'LINE-' + String(i).padStart(2, '0') + ' ' + 'x'.repeat(300), by: 'wsl-claude' });

    test.subHeading('item.get answers the facts alone');
    const g = await call('item.get', { id: 'p/G1' });
    const gk = Object.keys(g.body || {}).sort().join(',');
    if (g.status === 200 && gk === 'change,item,version') test.check('item.get answers {item, version, change}');
    else test.fail('item.get answered keys ' + gk);

    test.subHeading('each panel is its own answer, and each fits');
    const b = await call('item.box', { id: 'p/G1' });
    const k = await call('item.checks', { id: 'p/G1' });
    const c = await call('item.chat', { id: 'p/G1' });
    if (b.status === 200 && (b.body || {}).box === 'B'.repeat(6000) && typeof b.body.version === 'number') test.check('item.box answers the whole 6 KB box and its version');
    else test.fail('item.box answered ' + b.status + ' ' + JSON.stringify(b.body || {}).slice(0, 120));
    if (k.status === 200 && ((k.body || {}).checks || []).length === 1) test.check('item.checks answers the checks');
    else test.fail('item.checks answered ' + k.status + ' ' + JSON.stringify(k.body || {}).slice(0, 120));
    const lines = ((c.body || {}).chat || []);
    if (c.status === 200 && lines.length >= 15 && /LINE-29/.test(lines[lines.length - 1].text) && (c.body || {}).chatMore === true) test.check('item.chat answers ' + lines.length + ' of 30 lines on its own, newest last, and says more');
    else test.fail('item.chat answered ' + c.status + ', ' + lines.length + ' lines, chatMore ' + JSON.stringify((c.body || {}).chatMore));
    const sizes = [g, b, k, c].map(function (r) { return Buffer.byteLength(JSON.stringify(r.body || {}), 'utf8'); });
    if ([g, b, k, c].every(function (r) { return r.status === 200; }) && sizes.every(function (n) { return n <= appClient.ANSWER_MAX; })) test.check('each answer fits one answer: ' + sizes.join(', ') + ' bytes');
    else test.fail('answers ' + sizes.join(', ') + ' bytes against ' + appClient.ANSWER_MAX);

    test.subHeading('a box too long to come back is refused when written');
    const cur = (await call('item.box', { id: 'p/G1' })).body || {};
    const tooLong = await call('box.write', { id: 'p/G1', text: 'C'.repeat(appClient.ANSWER_MAX), version: cur.version, by: 'claude-windows' });
    if (tooLong.status === 413 && tooLong.body && tooLong.body.code === 'line-too-large') test.check('box.write refuses it as line-too-large');
    else test.fail('a too-long box answered ' + JSON.stringify({ status: tooLong.status, code: tooLong.body && tooLong.body.code }));
  } catch (e) {
    test.fail('the run broke: ' + (e && e.stack || e));
  }
  kid.kill();

  test.subHeading('the dialog asks each panel on its own');
  function el(id) {
    let html = '';
    const e = { id: id, value: '', textContent: '', hidden: false, style: {}, listeners: {},
      addEventListener: function (t, fn) { (e.listeners[t] = e.listeners[t] || []).push(fn); },
      querySelectorAll: function () { return []; }, querySelector: function () { return null; }, getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {} };
    Object.defineProperty(e, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); } });
    return e;
  }
  const byId = {};
  let dd = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DETAILS, 'utf8'))({ shell: { activateApp: function (x) { dd = x; } }, core: kernel.core },
    { getElementById: function (id) { return byId[id] || (byId[id] = el(id)); } }, {});
  const asked = [];
  const answers = {
    'item.get': { item: JSON.stringify({ id: 'p/G1', title: 'Panels', goal: '', status: '', with: '', buttons: [], blocking: [], blocked: [], star: false }), version: 1, change: 5 },
    'item.box': { box: 'BOX-TEXT', version: 1 },
    'item.checks': { checks: [] },
    'item.chat': { chat: [{ by: 'wsl-claude', at: '2026-09-30T21:00:00Z', text: 'CHAT-LINE' }], chatMore: false },
  };
  dd.mount(el('dd'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) { const a = body.ask.desk; const v = Object.keys(a)[0]; asked.push(v); return Promise.resolve({ status: 200, body: answers[v] || { change: 1 } }); },
    onPublished: function () {}, onPacket: function () {}, setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); }, fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  dd.open({ id: 'p/G1', agents: {} });
  for (let i = 0; i < 8; i++) await settle();
  const page = Object.keys(byId).map(function (k) { return byId[k].innerHTML; }).join('\n');
  if (['item.get', 'item.box', 'item.checks', 'item.chat'].every(function (v) { return asked.indexOf(v) !== -1; }) && /BOX-TEXT/.test(page) && /CHAT-LINE/.test(page)) test.check('it asked item.get, item.box, item.checks and item.chat, and painted box and chat');
  else test.fail('the dialog asked ' + JSON.stringify(asked) + '; box shown ' + /BOX-TEXT/.test(page) + ', chat shown ' + /CHAT-LINE/.test(page));

  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
