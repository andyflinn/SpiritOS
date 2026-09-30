'use strict';

// desk/G3.10: a press repaints every row it changes.
//   Andy: "i just pressed the Go-All button in the list. and the G3.9 go button didn't disarm."
// The contract the builder follows (claude-windows's and wsl-claude's picks, agreed under desk/G3.10):
//   Server  every write publishes one object: {change, verb, item, listed, ...} as before, plus `rows`, the facts of
//           every row of the item's goal whose facts that write changed (the item itself included, the goal row too).
//           One object, since appServer.publish keeps only the last object per 100 ms.
//   List    replaces each row in `rows` (a row with listed false leaves). It keeps the last change number it saw; a
//           publish whose change is not the last + 1 means one was dropped, so it asks items.search once.
//   Dialog  the same gap asks item.get once.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by desk/G3.10: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
async function settled() { for (let i = 0; i < 6; i++) await settle(); }

// The node's job callback, on a raw socket: every jobs.update the desk server reports, its `app` kept.
const published = [];
const callback = net.createServer(function (sock) {
  let buf = '';
  sock.on('error', function () {});
  sock.on('data', function (c) {
    buf += c;
    const head = buf.indexOf('\r\n\r\n');
    if (head === -1) return;
    const len = Number((/content-length:\s*(\d+)/i.exec(buf.slice(0, head)) || [0, 0])[1]);
    if (buf.length - head - 4 < len) return;
    try { const b = JSON.parse(buf.slice(head + 4, head + 4 + len)); if (b.app) published.push(b.app); } catch (e) { /* not ours */ }
    buf = '';
    sock.end('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}');
  });
});

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, style: {}, listeners: {}, placeholder: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function mount(file, answers) {
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); }, all: byId };
  let b = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(file, 'utf8'))(
    { shell: { activateApp: function (x) { b = x; } }, core: kernel.core }, doc, {});
  const asked = [];
  const subs = [];
  b.mount(fakeElement('c'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      const v = ask && Object.keys(ask)[0];
      if (v) asked.push(v);
      return Promise.resolve({ status: 200, body: answers[v] || { change: 1 } });
    },
    onPublished: function (fn) { subs.push(fn); return function () {}; }, onPacket: function () { return function () {}; },
    peerPost: function () { return Promise.resolve({ ok: true }); }, callDialog: function () { return new Promise(function () {}); },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {}, armUntilElsewhere: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  return { b: b, doc: doc, asked: asked, publish: function (o) { subs.forEach(function (fn) { fn(o); }); },
    page: function () { return Object.keys(byId).map(function (k) { return byId[k].innerHTML; }).join('\n'); } };
}
const lab = function (o) { return Object.assign({ goal: 'g/G1', status: '', with: '', buttons: [], blocking: [], blocked: [], star: false }, o); };

test.startTest('desk/G3.10: a press repaints every row it changes');

callback.listen(0, '127.0.0.1', async function () {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskrows-'));
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('desk', pipe);
  const call = function (verb, args) { const q = {}; q[verb] = args; return client.ask({ desk: q }).then(function (r) { return r || {}; }, function () { return {}; }); };
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-job', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + callback.address().port + '/' }),
  });
  try {
    for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk) break; } catch (e) { /* not yet */ } }

    test.subHeading('the server: one publish carries every row the press changed');
    // A blocks B; B blocks the goal.
    await call('session.set', { json: JSON.stringify({ goal: { id: 'g/G1', title: 'Round' }, items: [
      { id: 'g/G1.1', title: 'A', blocks: ['g/G1.2'] }, { id: 'g/G1.2', title: 'B', blocks: ['g/G1'] }] }), by: 'claude-windows' });
    await call('press', { id: 'g/G1', what: 'end-design', by: 'andy' });
    await sleep(300);
    published.length = 0;
    await call('press', { id: 'g/G1', what: 'go-all', by: 'andy' });
    await sleep(400);
    const goAll = published[published.length - 1] || {};
    const rowsOf = function (o) { const by = {}; (o.rows || []).forEach(function (r) { by[r.id] = r; }); return by; };
    const r1 = rowsOf(goAll);
    if (r1['g/G1.1'] && r1['g/G1.1'].status === 'running' && r1['g/G1'] && (r1['g/G1'].buttons || []).indexOf('go-all') === -1) {
      test.check('go-all on the goal publishes rows: A running, and the goal without go-all');
    } else test.fail(OWED + 'the go-all publish carried rows ' + JSON.stringify(Object.keys(r1)) + ' of ' + JSON.stringify(goAll).slice(0, 200));
    await call('press', { id: 'g/G1.1', what: 'claim-done', by: 'wsl-claude' });
    await sleep(300);
    published.length = 0;
    await call('press', { id: 'g/G1.1', what: 'done', by: 'andy' });
    await sleep(400);
    const r2 = rowsOf(published[published.length - 1] || {});
    if (r2['g/G1.2'] && (r2['g/G1.2'].buttons || []).indexOf('go') !== -1) test.check('done on A publishes B too, now unblocked and offering Go!');
    else test.fail(OWED + 'the done publish carried rows ' + JSON.stringify(Object.keys(r2)));

    test.subHeading('the List replaces every row in rows, and asks again after a dropped publish');
    const list = mount(DESK, { 'items.search': { items: [
      { key: 'g/G1', label: JSON.stringify(lab({ id: 'g/G1', title: 'Round', goal: '', buttons: ['go-all'] })) },
      { key: 'g/G1.1', label: JSON.stringify(lab({ id: 'g/G1.1', title: 'Alpha', buttons: ['go'] })) },
      { key: 'g/G1.2', label: JSON.stringify(lab({ id: 'g/G1.2', title: 'Beta', buttons: ['go'] })) }], more: false } });
    await settled();
    list.publish({ change: 10, verb: 'press', item: lab({ id: 'g/G1', title: 'Round', goal: '' }), listed: true,
      rows: [lab({ id: 'g/G1', title: 'Round', goal: '' }), lab({ id: 'g/G1.1', title: 'Alpha', status: 'running' }), lab({ id: 'g/G1.2', title: 'Beta', status: 'running' })] });
    await settled();
    const rowOf = function (t) { return list.doc.getElementById('desk-top').innerHTML.split('<tr').filter(function (s) { return s.indexOf(t) !== -1; })[0] || ''; };
    if (!/data-press="go"/.test(rowOf('Alpha')) && !/data-press="go"/.test(rowOf('Beta')) && /running/.test(rowOf('Beta'))) test.check('a publish with rows repaints Alpha and Beta, neither offering Go! any more');
    else test.fail(OWED + 'after rows, Beta reads ' + JSON.stringify(rowOf('Beta').slice(0, 200)));
    const searchesBefore = list.asked.filter(function (v) { return v === 'items.search'; }).length;
    list.publish({ change: 11, verb: 'chat.add', item: lab({ id: 'g/G1.1', title: 'Alpha', status: 'running' }), listed: true });
    await settled();
    const afterNext = list.asked.filter(function (v) { return v === 'items.search'; }).length;
    list.publish({ change: 13, verb: 'chat.add', item: lab({ id: 'g/G1.1', title: 'Alpha', status: 'running' }), listed: true });
    await settled();
    const afterGap = list.asked.filter(function (v) { return v === 'items.search'; }).length;
    if (afterNext === searchesBefore && afterGap === searchesBefore + 1) test.check('change 11 after 10 asks nothing; 13 after 11 asks items.search once');
    else test.fail(OWED + 'items.search asked: before ' + searchesBefore + ', after 11 ' + afterNext + ', after 13 ' + afterGap);

    test.subHeading('the dialog asks item.get again after a dropped publish');
    const facts = JSON.stringify(lab({ id: 'g/G1.1', title: 'Alpha', status: 'running' }));
    const dlg = mount(DETAILS, { 'item.get': { item: facts, box: 'BOX', version: 1, change: 20, chatMore: false, checks: [], chat: [] } });
    dlg.b.open({ id: 'g/G1.1', agents: {} });
    await settled();
    const gets = function () { return dlg.asked.filter(function (v) { return v === 'item.get'; }).length; };
    const g0 = gets();
    dlg.publish({ change: 21, verb: 'chat.add', item: JSON.parse(facts), listed: true, chat: { by: 'wsl-claude', at: '2026-09-30T20:00:00Z', text: 'hi' } });
    await settled();
    const g1 = gets();
    dlg.publish({ change: 23, verb: 'chat.add', item: JSON.parse(facts), listed: true, chat: { by: 'wsl-claude', at: '2026-09-30T20:01:00Z', text: 'again' } });
    await settled();
    const g2 = gets();
    if (g1 === g0 && g2 === g0 + 1) test.check('change 21 after item.get\'s 20 asks nothing; 23 after 21 asks item.get once');
    else test.fail(OWED + 'item.get asked: at open ' + g0 + ', after 21 ' + g1 + ', after 23 ' + g2);
  } catch (e) {
    test.fail('the run broke: ' + (e && e.stack || e));
  }
  kid.kill();
  callback.close();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
