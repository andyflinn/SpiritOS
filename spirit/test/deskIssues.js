'use strict';

// goal/G2.1: Desk issues, one item — eight of Andy's notes in his words (the box). Red on today's tree.
// Note 2 (musings visually separated) is his to judge on sight and carries no assertion here.
// The contract the builder follows (shapes fixed by this red, argued in goal/G2.1 before building):
//   1. The box at the top of the dialog folds again: the dialog paints it with a data-fold="item" toggle
//      and its folded state (ddFolded) survives a repaint, as before desk/G2.7 ("BIG complaint: the text
//      bubble no longer folds.").
//   3. No red mark on his own lines ("when I'm the originator of a chat entry, no red mark should appear in the
//      list."). goal/G4.20 point 8 took the star out altogether ("ha ha, the red star has no function anymore.
//      take it out."), so neither line leaves one: the facts carry no star.
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
      // The desk's verbs by name (desk.<verb>, goal/G30.6), folded back to {desk: {verb: args}}.
      const ask = (test.foldAsk(Object.assign({}, body, { verb: name })) || {}).desk;
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
const lab = function (o) { return Object.assign({ goal: 'goal/G100', status: '', with: '', buttons: [], blocking: [], blocked: [] }, o); };

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
  // goal/G29.21: an agent's session creates no goal, so he writes the world; since goal/G33.7 (session.set went) it is
  // seeded before the desk starts, which takes it in at start.
  test.seedDesk(state, { goal: { id: 'goal/G100', title: 'Round' }, items: [
    { id: 'goal/G100.1', title: 'A', blocks: ['goal/G100'] }, { id: 'goal/G100.2', title: 'B', blocks: ['goal/G100'] }] });
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-job', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + callback.address().port + '/' }),
  });
  try {
    for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ } }
    const set = await call('item.get', { id: 'goal/G100.2' }, ANDY);
    if (set.status !== 200) { test.fail(OWED + 'the seeded world was not taken: ' + JSON.stringify(set.body)); return; }
    await call('press', { id: 'goal/G100', what: 'end-design' }, ANDY);

    test.subHeading('3. no star after an agent line or his answer (the star is gone, goal/G4.20)');
    await call('press', { id: 'goal/G100.1', what: 'seen' }, ANDY);
    await call('chat.add', { id: 'goal/G100.1', text: 'an agent asks' }, CW);
    const starred = await factsOf('goal/G100.1');
    await call('chat.add', { id: 'goal/G100.1', text: 'and he answers' }, ANDY);
    const answered = await factsOf('goal/G100.1');
    const noStar = function (f) { return f && f.id && !Object.prototype.hasOwnProperty.call(f, 'star'); };
    if (noStar(starred) && noStar(answered)) test.check('neither the agent line nor his answer puts a star in the facts');
    else test.fail(OWED + 'star after the agent line ' + starred.star + ', after his own line ' + answered.star);

    test.subHeading('5. a goal offers Done once every item is done, no claim needed');
    // Was "once every item is closed" here; goal/G2.10 moved the line to done (Andy: "the goal should only offer a
    // done button when all items are done"), and deskGoalDone.js holds the whole rule. SINCE goal/G33.6 it holds in the
    // List: the desk offers a goal's Done at any time for the detail panel, and the List holds it back while the goal's
    // blocked (its items still open) is not empty. Asserted here as the List reads it: one item done and one open
    // offers nothing; both done offers Done with no claim; closing them keeps it.
    const inList = function (f) { return (f.buttons || []).filter(function (b) { return !((f.blocked || []).length && (b === 'done' || b === 'close')); }); };
    await call('press', { id: 'goal/G100', what: 'go-all' }, ANDY);
    await call('press', { id: 'goal/G100.1', what: 'claim-done' }, CW);
    await call('press', { id: 'goal/G100.1', what: 'done' }, ANDY);
    const halfway = await factsOf('goal/G100');
    await call('press', { id: 'goal/G100.2', what: 'claim-done' }, CW);
    await call('press', { id: 'goal/G100.2', what: 'done' }, ANDY);
    const allDone = await factsOf('goal/G100');
    await call('press', { id: 'goal/G100.1', what: 'close' }, ANDY);
    await call('press', { id: 'goal/G100.2', what: 'close' }, ANDY);
    const allClosed = await factsOf('goal/G100');
    if (inList(halfway).indexOf('done') === -1 && inList(allDone).indexOf('done') !== -1 && inList(allClosed).indexOf('done') !== -1) {
      test.check('no Done while an item is open; Done on the goal once all are done, with no claim; still offered once closed');
    } else test.fail(OWED + 'goal buttons with one item done ' + JSON.stringify(halfway.buttons) + ', all done ' + JSON.stringify(allDone.buttons) + ', all closed ' + JSON.stringify(allClosed.buttons));

    test.subHeading('6. a brought-back item pops into view with an attention mark');
    published.length = 0;
    await call('press', { id: 'goal/G100.1', what: 'bring-back' }, CW);
    await sleep(400);
    const back = await factsOf('goal/G100.1');
    // The publish carries the item's facts as an object (desk.js write: out.item = facts(...)), a string only
    // in older shapes; both are read.
    const idOf = function (p) { try { return (typeof p.item === 'string' ? JSON.parse(p.item) : p.item || {}).id || ''; } catch (e) { return ''; } };
    const pub = published.filter(function (p) { return p.verb === 'press' && idOf(p) === 'goal/G100.1'; }).pop() || {};
    if (pub.listed === true && back.alert === true) {
      await call('press', { id: 'goal/G100.1', what: 'seen' }, ANDY);
      const seen = await factsOf('goal/G100.1');
      if (seen.alert === false) test.check('bring-back publishes the row listed with alert: true, and his seen clears it');
      else test.fail(OWED + 'alert stayed ' + seen.alert + ' after his seen');
    } else test.fail(OWED + 'after bring-back the publish said listed ' + pub.listed + ' and the facts carry alert ' + JSON.stringify(back.alert));

    test.subHeading('7. an older update changes nothing');
    const list = mount(DESK, { 'items.search': { items: [
      { key: 'goal/G100', label: JSON.stringify(lab({ id: 'goal/G100', title: 'Round', goal: '' })) },
      { key: 'goal/G100.1', label: JSON.stringify(lab({ id: 'goal/G100.1', title: 'Alpha' })) }], more: false } });
    await settled();
    list.publish({ change: 10, verb: 'press', item: lab({ id: 'goal/G100.1', title: 'Alpha', status: 'running' }), listed: true });
    await settled();
    list.publish({ change: 9, verb: 'press', item: lab({ id: 'goal/G100.1', title: 'Alpha', status: 'closed' }), listed: true });
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

  // SUPERSEDED BY goal/G30.8 (Andy, 2026-10-20: "the box no longer needs to be foldable, it is now space-limited and
  // contained"): the box fills its panel in the fixed upper half, and the fold is gone.
  test.subHeading('1. the box no longer folds: it fills its panel');
  const details = fs.readFileSync(DETAILS, 'utf8').replace(/^\s*\/\/.*$/gm, '');
  if (!/data-fold="item"/.test(details) && !/ddFolded/.test(details) && /id="dd-box-input" style="[^"]*height:calc\(30vh/.test(details)) test.check('the box paints no fold toggle; its textarea fills the panel');
  else test.fail(OWED + 'deskDetails.js still folds the box, or the textarea does not fill the panel');

  test.subHeading('4. the two top lines stick below the title bar, not at the top');
  const desk = fs.readFileSync(DESK, 'utf8');
  // SINCE goal/G6.1 the shell's app header sticks the block under the title bar (spirit/test/appHeader.js proves the
  // offset): desk-bars carries no sticking of its own, and desk.js hands it to createAppHeader().
  const bars = (/id="desk-bars"[^>]*style="([^"]*)"/.exec(desk) || [])[1] || '';
  if (!/sticky/.test(bars) && /\.createAppHeader\(\)/.test(desk)) test.check('desk-bars is pinned by the shell\'s app header, below the title bar');
  else test.fail(OWED + 'desk-bars reads ' + JSON.stringify(bars) + ' and desk.js ' + (/createAppHeader/.test(desk) ? 'uses' : 'does not use') + ' createAppHeader');

  test.subHeading('8. Desk writes no voice.jsonl of its own');
  const server = fs.readFileSync(SERVER, 'utf8');
  const app = fs.readFileSync(DESK, 'utf8');
  if (!/voice\.jsonl/.test(server) && !/'voice\.add'/.test(server) && !/voice\.add/.test(app)) test.check('no voice.jsonl writer, no voice.add verb, no voice.add call');
  else test.fail(OWED + 'still there: ' + [/voice\.jsonl/.test(server) ? 'the writer' : '', /'voice\.add'/.test(server) ? 'the verb' : '', /voice\.add/.test(app) ? 'the call' : ''].filter(Boolean).join(', '));

  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 200);
});
