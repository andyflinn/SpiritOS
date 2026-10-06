'use strict';

// goal/G2.22: the item dialog offers Waive, and the desk waives alone when one agent is present. Red on today's
// tree; claude-windows wrote it from G2.22's box and does not build it.
//   Andy, 2026-10-06, under goal/G2.18: "there is no Waive in the G2.18 dialog"; under goal/G2.22: "add to 2.22 that
//   the desk can waive the rule if only one agent is present." goal/G5.7 gave the server the press ("absolutely.
//   with only one agent this must be waved"); the face never got the button, so a code item with one agent in the
//   sitting stalls after its red: the red writer may not build, and nobody can press.
//
// WHEN THE BUTTON SHOWS IS HIS, answering Q2 on the item, 2026-10-06: "the waive shows whether the build runs or
// not. it shows when it's needed." So the build being taken makes no difference, and "needed" is the condition
// below: a waive before there is a red writer changes nothing, since the phase rule it lifts binds only the red
// writer and the builder (desk.js mayTake).
//
// THE SHAPE (G2.22's box, as settled while this red was written; the builder may argue names in Desk first):
//   1  item.get's facts carry `waived` (true|false). The item's `buttons` offers 'waive' when it is needed and not
//      before: a code item that has his Go, is not done or closed, is not yet waived, and whose red is written
//      (phase 'build' or 'verify'). Taken build or not makes no difference. Never on a goal, and not while the red
//      is still being written. Buttons come from the server, as every button does (desk/G2.7: "Buttons come from
//      item.buttons only"). His press {id, what: 'waive'} as before (goal/G5.7, OWNER_PRESSES); an agent's is
//      refused.
//   2  The desk waives by itself when one agent alone is live: at the moment a red is done (phase.done red), if the
//      goal's live agents (facts.live, LIVE_MS) are that one agent, the item is waived and the desk says so in the
//      item's chat, by desk. Two agents live: nothing, his press as before.
//   3  shell/deskDetails: with 'waive' among the buttons the dialog shows #dd-waive, armed like Close (the first
//      click arms, the second sends press {id, what: 'waive'}); without it, no such button.
//
// WHY THE ORDER OF THE SECTIONS MATTERS: liveness is ten minutes wide (desk.js LIVE_MS) and an agent counts as live
// from its first write, so the one-agent section runs before wsl-claude writes anything at all.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G2.22: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskWaiveTestCWAAAAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskWaiveTestWSLAAAAAAAAAAAAAAAAAAAAAAAA=', label: 'wsl-claude' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskWaiveTestOwnerAAAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }

test.startTest('goal/G2.22: the dialog offers Waive, and the desk waives alone when one agent is present');

// ── THE SERVER ──────────────────────────────────────────────────────
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskwaive-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', pipe);
const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
let kid = null;
async function start() {
  kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) return true; } catch (e) { /* not yet */ } }
  return false;
}
function stop() { return new Promise(function (r) { if (!kid) return r(); kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); }
async function factsOf(id) { const r = await call('item.get', { id: id }, ANDY); return parse(r.body && r.body.item) || {}; }
function took(r) { return r.status === 200 && r.body && r.body.ok !== false; }

// ── THE DIALOG (the harness of deskDialog.js, in brief) ─────────────
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
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
async function settled() { for (let i = 0; i < 6; i++) await settle(); }
function dialog(answer) {
  const doc = fakeDocument();
  let dd = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DETAILS, 'utf8'))({ shell: { activateApp: function (x) { dd = x; } }, core: kernel.core }, doc, {});
  const asked = [];
  dd.mount(fakeElement('dd'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      if (name === 'jobs.api' && ask) {
        const v = Object.keys(ask)[0];
        asked.push({ verb: v, args: ask[v] });
        if (v === 'item.get' || v === 'item.box' || v === 'item.checks' || v === 'item.chat') return Promise.resolve({ status: 200, body: answer });
        return Promise.resolve({ status: 200, body: { change: 1 } });
      }
      return Promise.resolve({ status: 200, body: {} });
    },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {}, armUntilElsewhere: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); },
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  const page = function () { return Object.keys(doc.all).map(function (k) { return doc.all[k].innerHTML; }).join('\n'); };
  const click = function (id) { doc.getElementById('dd-body').fire('click', { target: { id: id, getAttribute: function () { return null; }, closest: function () { return null; }, parentNode: null }, preventDefault: function () {} }); };
  return { dd: dd, asked: asked, page: page, click: click };
}
function answerFor(buttons) {
  return { item: JSON.stringify({ id: 't/G1.2', title: 'Beta', goal: 't/G1', status: 'running', with: 'claude-windows', buttons: buttons,
    blocking: ['t/G1'], blocked: [], go: true, code: true, phase: 'build', red: 'claude-windows', waived: false, claims: 0, asks: 0 }),
    box: 'BOX', version: 1, change: 3, checks: [], chat: [] };
}

(async function () {
  if (!await start()) { test.fail('the desk server did not start'); return; }
  await call('session.set', { json: JSON.stringify({ goal: { id: 'w/G1', title: 'Waive' }, items: [
    { id: 'w/G1.1', title: 'One agent', blocks: ['w/G1'], code: true },
    { id: 'w/G1.2', title: 'His press', blocks: ['w/G1'], code: true },
    { id: 'w/G1.3', title: 'While the build runs', blocks: ['w/G1'], code: true },
    { id: 'w/G1.4', title: 'No red yet', blocks: ['w/G1'], code: true }] }) }, CW);
  await call('press', { id: 'w/G1', what: 'end-design' }, ANDY);
  for (const id of ['w/G1.1', 'w/G1.2', 'w/G1.3', 'w/G1.4']) await call('press', { id: id, what: 'go' }, ANDY);

  test.subHeading('1. facts carry waived, and no waive before there is a red writer');
  const f4 = await factsOf('w/G1.4');
  if (f4.go === true && f4.code === true && f4.waived === false) test.check('w/G1.4 after Go: facts carry waived false');
  else test.fail(OWED + 'w/G1.4 after Go reads waived ' + short(f4.waived) + ' (go ' + short(f4.go) + ', code ' + short(f4.code) + ')');
  if (f4.phase === 'red' && (f4.buttons || []).indexOf('waive') === -1) test.check('while the red is still being written, no waive is offered');
  else test.fail(OWED + 'w/G1.4 in phase ' + short(f4.phase) + ' offers ' + short(f4.buttons));
  const fg = await factsOf('w/G1');
  if ((fg.buttons || []).indexOf('waive') === -1) test.check('the goal never offers waive');
  else test.fail(OWED + 'the goal offers waive: ' + short(fg.buttons));

  // FIRST, BEFORE wsl-claude HAS WRITTEN ANYTHING: liveness lasts ten minutes, so this is the only moment in the run
  // when one agent is alone.
  test.subHeading('2. one agent live: the desk waives when the red is done, and says so');
  await call('phase.take', { id: 'w/G1.1', phase: 'red' }, CW);
  const redDone = await call('phase.done', { id: 'w/G1.1', phase: 'red' }, CW);
  const f1 = await factsOf('w/G1.1');
  const live = (await factsOf('w/G1')).live || [];
  if (!took(redDone)) test.fail('phase.done red on w/G1.1 answered ' + redDone.status + ' ' + short(redDone.body));
  else if (live.length !== 1 || live[0] !== 'claude-windows') test.fail('the goal\'s live agents are ' + short(live) + ', expected claude-windows alone');
  else if (f1.waived === true) test.check('with claude-windows alone live, w/G1.1 is waived as its red is done');
  else test.fail(OWED + 'with one agent live, w/G1.1 after its red reads waived ' + short(f1.waived) + ' (phase ' + short(f1.phase) + ')');
  const chat1 = ((await call('item.chat', { id: 'w/G1.1' }, ANDY)).body || {}).chat || [];
  if (chat1.some(function (l) { return l.by === 'desk' && /waiv/i.test(String(l.text)); })) test.check('the desk says so in the item\'s chat');
  else test.fail(OWED + 'no desk line about the waive under w/G1.1: ' + short(chat1));
  if ((f1.buttons || []).indexOf('waive') === -1) test.check('an item the desk waived offers no waive');
  else test.fail(OWED + 'the waived w/G1.1 still offers waive: ' + short(f1.buttons));
  const build1 = await call('phase.take', { id: 'w/G1.1', phase: 'build' }, CW);
  if (took(build1)) test.check('the red writer may take the build now');
  else test.fail(OWED + 'the red writer\'s build take on w/G1.1 was refused: ' + short(build1.body));

  // FROM HERE ON BOTH AGENTS ARE LIVE, so nothing is waived but by his press.
  await call('chat.add', { id: 'w/G1.2', text: 'wsl: here.' }, WSL);

  test.subHeading('3. two agents live: the red done offers his waive, and nothing waives itself');
  await call('phase.take', { id: 'w/G1.2', phase: 'red' }, CW);
  await call('phase.done', { id: 'w/G1.2', phase: 'red' }, CW);
  const f2 = await factsOf('w/G1.2');
  const live2 = (await factsOf('w/G1')).live || [];
  const refused2 = await call('phase.take', { id: 'w/G1.2', phase: 'build' }, CW);
  if (live2.length === 2 && f2.waived === false && !took(refused2)) test.check('with two agents live, w/G1.2 stays unwaived and the red writer\'s build take is refused');
  else test.fail(OWED + 'with ' + short(live2) + ' live, w/G1.2 reads waived ' + short(f2.waived) + '; build take ' + (took(refused2) ? 'taken' : 'refused'));
  if (f2.phase === 'build' && (f2.buttons || []).indexOf('waive') !== -1) test.check('its red written and nobody building, w/G1.2 offers waive');
  else test.fail(OWED + 'w/G1.2 in phase ' + short(f2.phase) + ' offers ' + short(f2.buttons));

  test.subHeading('3b. his press waives; an agent\'s is refused');
  const byAgent = await call('press', { id: 'w/G1.2', what: 'waive' }, CW);
  const fA = await factsOf('w/G1.2');
  if (!took(byAgent) && fA.waived === false) test.check('an agent\'s waive is refused and changes nothing');
  else test.fail(OWED + 'an agent\'s waive answered ' + byAgent.status + ' ' + short(byAgent.body) + '; waived ' + short(fA.waived));
  const byHim = await call('press', { id: 'w/G1.2', what: 'waive' }, ANDY);
  const fB = await factsOf('w/G1.2');
  if (took(byHim) && fB.waived === true && (fB.buttons || []).indexOf('waive') === -1) test.check('his waive: waived true, the button gone');
  else test.fail(OWED + 'his waive answered ' + byHim.status + ' ' + short(byHim.body) + '; facts waived ' + short(fB.waived) + ', buttons ' + short(fB.buttons));
  const build2 = await call('phase.take', { id: 'w/G1.2', phase: 'build' }, CW);
  if (took(build2)) test.check('after his waive the red writer may build');
  else test.fail(OWED + 'after his waive the build take was refused: ' + short(build2.body));

  // HIS Q2 ANSWER: "the waive shows whether the build runs or not. it shows when it's needed."
  test.subHeading('4. the build running makes no difference, and verify still offers it');
  await call('phase.take', { id: 'w/G1.3', phase: 'red' }, CW);
  await call('phase.done', { id: 'w/G1.3', phase: 'red' }, CW);
  const tookBuild = await call('phase.take', { id: 'w/G1.3', phase: 'build' }, WSL);
  const f3 = await factsOf('w/G1.3');
  if (!took(tookBuild)) test.fail('wsl-claude\'s build take on w/G1.3 was refused: ' + short(tookBuild.body));
  else if (f3.builder === 'wsl-claude' && (f3.buttons || []).indexOf('waive') !== -1) test.check('while wsl-claude builds it, w/G1.3 still offers waive');
  else test.fail(OWED + 'w/G1.3 with builder ' + short(f3.builder) + ' offers ' + short(f3.buttons));
  await call('phase.done', { id: 'w/G1.3', phase: 'build' }, WSL);
  const f3v = await factsOf('w/G1.3');
  if (f3v.phase === 'verify' && (f3v.buttons || []).indexOf('waive') !== -1) test.check('in verify, w/G1.3 still offers waive');
  else test.fail(OWED + 'w/G1.3 in phase ' + short(f3v.phase) + ' offers ' + short(f3v.buttons));

  test.subHeading('5. the dialog: Waive armed like Close, sent as press {id, what: waive}');
  const d = dialog(answerFor(['waive', 'close']));
  d.dd.open({ id: 't/G1.2' });
  await settled();
  if (d.page().indexOf('id="dd-waive"') !== -1) test.check('with waive among the buttons the dialog shows #dd-waive');
  else test.fail(OWED + 'no #dd-waive with buttons [waive, close]');
  d.click('dd-waive');
  await settled();
  const presses = function () { return d.asked.filter(function (a) { return a.verb === 'press'; }); };
  if (!presses().length && d.page().indexOf('id="dd-waive"') !== -1) test.check('the first click arms: no press yet');
  else test.fail(OWED + 'the first click on Waive sent ' + short(presses().map(function (p) { return p.args; })));
  d.click('dd-waive');
  await settled();
  const sent = presses();
  if (sent.length === 1 && sent[0].args.id === 't/G1.2' && sent[0].args.what === 'waive') test.check('the second click sends press {id, what: waive}');
  else test.fail(OWED + 'the second click sent ' + short(sent.map(function (p) { return p.args; })));
  const e = dialog(answerFor(['close']));
  e.dd.open({ id: 't/G1.2' });
  await settled();
  if (e.page().indexOf('id="dd-waive"') === -1) test.check('without waive among the buttons there is no #dd-waive');
  else test.fail(OWED + '#dd-waive shows with buttons [close]');
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
