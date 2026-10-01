'use strict';

// goal/G2.1: Desk issues, one item — eight of Andy's notes in his words (the box). Red on today's tree.
// Note 2 (musings visually separated) is his to judge on sight and carries no assertion here.
// The contract the builder follows (shapes fixed by this red, argued in goal/G2.1 before building):
//   1. The box at the top of the dialog folds again: the dialog paints it with a data-fold="item" toggle
//      and its folded state (ddFolded) survives a repaint, as before desk/G2.7 ("BIG complaint: the text
//      bubble no longer folds.").
//   3. No red mark on his own lines: his chat line acknowledges everything before it, so a row whose
//      newest agent line he just answered has no star ("when I'm the originator of a chat entry, no red
//      mark should appear in the list.").
//   4. The two top lines stay sticky BELOW the app or dialog title bar, not at top 0, so close and back
//      stay visible ("stay sticky below those title bars").
//   5. A goal offers Done once every item of it is closed, with no agent claim ("the done button should
//      appear on the goal as soon as it is no longer blocked").
//   6. A brought-back item pops into view with an attention mark: after bring-back the row is listed, its
//      publish says so, and its facts carry alert: true until he presses seen ("the row should immediately
//      pop back into visibility, with the attention-grabbing error icon").
//   7. Desk ignores an older update: a publish whose change is lower than the one shown changes nothing in
//      the List, and the dialog guards the same ("let desk worry about its problems").
//   8. Desk's own voice.jsonl writer goes: no voice.jsonl in desk.js, no voice.add verb, no voice.add call
//      in the Desk app; its replacement (claude/voiceFromDesk.js) lives in the vault, outside this tree.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G2.1: ';
const RUN = path.join(__dirname, '..', 'run');
const SERVER = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const DESK = path.join(RUN, 'shell', 'desk', 'desk.js');
const DETAILS = path.join(RUN, 'shell', 'deskDetails', 'deskDetails.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
async function settled() { for (let i = 0; i < 6; i++) await settle(); }

// The node's job callback on a raw socket, every publish's `app` kept (as deskRows.js does).
const published = [];
const callback = net.createServer(function (sock) {
  let buf = Buffer.alloc(0);
  sock.on('error', function () {});
  sock.on('data', function (c) {
    buf = Buffer.concat([buf, c]);
    for (;;) {
      const head = buf.indexOf('\r\n\r\n');
      if (head === -1) return;
      const len = Number((/content-length:\s*(\d+)/i.exec(buf.slice(0, head).toString('utf8')) || [0, 0])[1]);
      if (buf.length - head - 4 < len) return;
      try { const b = JSON.parse(buf.slice(head + 4, head + 4 + len).toString('utf8')); if (b.app) published.push(b.app); } catch (e) { /* not ours */ }
      buf = buf.slice(head + 4 + len);
      sock.write('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 2\r\n\r\n{}');
    }
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
  const subs = [];
  b.mount(fakeElement('c'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      const v = ask && Object.keys(ask)[0];
      return Promise.resolve({ status: 200, body: answers[v] || { change: 1 } });
    },
    onPublished: function (fn) { subs.push(fn); return function () {}; }, onPacket: function () { return function () {}; },
    peerPost: function () { return Promise.resolve({ ok: true }); }, callDialog: function () { return new Promise(function () {}); },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {}, armUntilElsewhere: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  return { doc: doc, publish: function (o) { subs.forEach(function (fn) { fn(o); }); } };
}
const lab = function (o) { return Object.assign({ goal: 'g/G1', status: '', with: '', buttons: [], blocking: [], blocked: [], star: false }, o); };

const CW = { key: 'MCowBQYDK2VwAyEAdeskIssuesTestPeerCWAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskIssuesTestOwnerAAAAAAAAAAAAAAAAA=', label: 'Andy Flinn' };

test.startTest('goal/G2.1: Desk issues, one item');

callback.listen(0, '127.0.0.1', async function () {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskissues-'));
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('desk', pipe);
  const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
  const factsOf = async function (id) { const r = await call('item.get', { id: id }, ANDY); try { return JSON.parse((r.body || {}).item); } catch (e) { return {}; } };
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-job', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + callback.address().port + '/' }),
  });
  try {
    for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ } }
    const set = await call('session.set', { json: JSON.stringify({ goal: { id: 'g/G1', title: 'Round' }, items: [
      { id: 'g/G1.1', title: 'A', blocks: ['g/G1'] }, { id: 'g/G1.2', title: 'B', blocks: ['g/G1'] }] }) }, CW);
    if (set.status !== 200) { test.fail(OWED + 'the session was not taken: ' + JSON.stringify(set.body)); return; }
    await call('press', { id: 'g/G1', what: 'end-design' }, ANDY);

    test.subHeading('3. his own line is his acknowledgement: no star after he answers');
    await call('press', { id: 'g/G1.1', what: 'seen' }, ANDY);
    await call('chat.add', { id: 'g/G1.1', text: 'an agent asks' }, CW);
    const starred = await factsOf('g/G1.1');
    await call('chat.add', { id: 'g/G1.1', text: 'and he answers' }, ANDY);
    const answered = await factsOf('g/G1.1');
    if (starred.star === true && answered.star === false) test.check('the agent line starred the row; his answer cleared it');
    else test.fail(OWED + 'star after the agent line ' + starred.star + ', after his own line ' + answered.star);

    test.subHeading('5. a goal offers Done once every item is closed, no claim needed');
    await call('press', { id: 'g/G1', what: 'go-all' }, ANDY);
    for (const id of ['g/G1.1', 'g/G1.2']) {
      await call('press', { id: id, what: 'claim-done' }, CW);
      await call('press', { id: id, what: 'done' }, ANDY);
    }
    const halfway = await factsOf('g/G1');
    await call('press', { id: 'g/G1.1', what: 'close' }, ANDY);
    await call('press', { id: 'g/G1.2', what: 'close' }, ANDY);
    const allClosed = await factsOf('g/G1');
    if ((halfway.buttons || []).indexOf('done') === -1 && (allClosed.buttons || []).indexOf('done') !== -1) {
      test.check('no Done while an item is open; Done on the goal once all are closed, with no claim');
    } else test.fail(OWED + 'goal buttons with items done ' + JSON.stringify(halfway.buttons) + ', all closed ' + JSON.stringify(allClosed.buttons));

    test.subHeading('6. a brought-back item pops into view with an attention mark');
    published.length = 0;
    await call('press', { id: 'g/G1.1', what: 'bring-back' }, CW);
    await sleep(400);
    const back = await factsOf('g/G1.1');
    const idOf = function (p) { try { return JSON.parse(p.item).id; } catch (e) { return ''; } };
    const pub = published.filter(function (p) { return p.verb === 'press' && idOf(p) === 'g/G1.1'; }).pop() || {};
    if (pub.listed === true && back.alert === true) {
      await call('press', { id: 'g/G1.1', what: 'seen' }, ANDY);
      const seen = await factsOf('g/G1.1');
      if (seen.alert === false) test.check('bring-back publishes the row listed with alert: true, and his seen clears it');
      else test.fail(OWED + 'alert stayed ' + seen.alert + ' after his seen');
    } else test.fail(OWED + 'after bring-back the publish said listed ' + pub.listed + ' and the facts carry alert ' + JSON.stringify(back.alert));

    test.subHeading('7. an older update changes nothing');
    const list = mount(DESK, { 'items.search': { items: [
      { key: 'g/G1', label: JSON.stringify(lab({ id: 'g/G1', title: 'Round', goal: '' })) },
      { key: 'g/G1.1', label: JSON.stringify(lab({ id: 'g/G1.1', title: 'Alpha' })) }], more: false } });
    await settled();
    list.publish({ change: 10, verb: 'press', item: lab({ id: 'g/G1.1', title: 'Alpha', status: 'running' }), listed: true });
    await settled();
    list.publish({ change: 9, verb: 'press', item: lab({ id: 'g/G1.1', title: 'Alpha', status: 'closed' }), listed: true });
    await settled();
    const row = list.doc.getElementById('desk-top').innerHTML.split('<tr').filter(function (s) { return s.indexOf('Alpha') !== -1; })[0] || '';
    const dialogGuards = /change\s*<\s*ddLastChange/.test(fs.readFileSync(DETAILS, 'utf8'));
    if (/running/.test(row) && !/closed/.test(row) && dialogGuards) test.check('the List kept change 10 over a late change 9, and the dialog guards the same');
    else test.fail(OWED + (!/running/.test(row) || /closed/.test(row) ? 'the List painted the older update' : 'the dialog has no older-change guard'));
  } catch (e) {
    test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e));
  } finally {
    try { kid.kill(); } catch (e) { /* gone */ }
    callback.close();
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
  }

  test.subHeading('1. the box folds again, and the fold survives a repaint');
  const details = fs.readFileSync(DETAILS, 'utf8');
  if (/data-fold="item"/.test(details) && /ddFolded/.test(details)) test.check('the dialog paints the box with a data-fold="item" toggle whose state (ddFolded) is kept');
  else test.fail(OWED + 'deskDetails.js paints no data-fold="item" toggle with a kept ddFolded (lost in desk/G2.7)');

  test.subHeading('4. the two top lines stick below the title bar, not at the top');
  const desk = fs.readFileSync(DESK, 'utf8');
  const bars = (/id="desk-bars"[^>]*style="([^"]*)"/.exec(desk) || [])[1] || '';
  if (/sticky/.test(bars) && !/\btop:\s*0\b/.test(bars)) test.check('desk-bars is sticky at an offset that is not 0: below the title bar');
  else test.fail(OWED + 'desk-bars reads ' + JSON.stringify(bars) + ' — stuck at top 0, so a title bar scrolls over it');

  test.subHeading('8. Desk writes no voice.jsonl of its own');
  const server = fs.readFileSync(SERVER, 'utf8');
  const app = fs.readFileSync(DESK, 'utf8');
  if (!/voice\.jsonl/.test(server) && !/'voice\.add'/.test(server) && !/voice\.add/.test(app)) test.check('no voice.jsonl writer, no voice.add verb, no voice.add call');
  else test.fail(OWED + 'still there: ' + [/voice\.jsonl/.test(server) ? 'the writer' : '', /'voice\.add'/.test(server) ? 'the verb' : '', /voice\.add/.test(app) ? 'the call' : ''].filter(Boolean).join(', '));

  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 200);
});
