'use strict';

// goal/G9.3: the user takes the text box on focus and releases it on blur or close. Red on today's tree;
// claude-windows wrote it from G9.3's box and does not build it.
//   Andy, 2026-10-07: "the text box in item/goal detail must be an input area for the user. When the user activates
//   that input area, the area is \"taken\" by the user, and not modifiable for agents. When the user clicks outside of
//   that text box, and deactivates the input, also by leaving the details dialog, the box input is released from the
//   take. When a details dialog is opened, the text box is never taken."
//   Andy, on Q1: "yes. so it shoule be among agents as well, the box is taken, and released after edit. it also helps
//   agents stay out of each others way." So one take rule for everybody.
//
// WHAT IS TRUE TODAY (read in the tree at 7cd6d633): box.take refuses andy by name; a take is freed only by the
// taker's box.write; his own box.write is never refused; the dialog draws the box as text, with no input.
//
// THE SHAPE ASSERTED (G9.3's box): box.take accepts him; box.release {id} frees the caller's own take without a write;
// while a take stands every other writer, he included, is refused taken. The dialog draws the box as a textarea,
// id dd-box-input (the red writer's name for it), sends box.take when it gets focus, and on blur either writes the
// changed text (box.write, which frees the take) or sends box.release. Opening the dialog takes nothing. The dialog
// cannot hear the shell's Back (shell.js setDialogResult); leaving the dialog by any click blurs the box first, so
// blur is the release on close.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G9.3: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskBoxTakeTestCWAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskBoxTakeTestWSLAAAAAAAAAAAAAAAAAAAAA=', label: 'wsl-claude' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskBoxTakeTestOwnerAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }

test.startTest('goal/G9.3: the user takes the text box on focus, releases on blur or close');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskboxtake-'));
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
function took(r) { return r.status === 200 && r.body && r.body.ok !== false; }
function refusedTaken(r) { return !took(r) && r.body && r.body.code === 'taken'; }
async function taker(id) { const r = await call('item.get', { id: id }, ANDY); return String((parse(r.body && r.body.item) || {}).boxTaken || ''); }
async function version(id) { const r = await call('item.box', { id: id }, ANDY); return Number(r.body && r.body.version) || 0; }

async function server() {
  if (!await start()) { test.fail('the desk server did not start'); return; }
  await call('session.set', { json: JSON.stringify({ goal: { id: 'bt/G1', title: 'Boxes' }, items: [{ id: 'bt/G1.1', title: 'One', blocks: ['bt/G1'] }] }) }, CW);
  const first = await call('box.write', { id: 'bt/G1.1', text: 'First text.', version: 0 }, CW);
  if (took(first)) test.check('the world: bt/G1.1 has a box, version 1');
  else { test.fail('the world: the first box.write answered ' + first.status + ' ' + short(first.body)); return; }

  test.subHeading('1. he takes the box, and while he holds it nobody else writes or takes');
  const his = await call('box.take', { id: 'bt/G1.1' }, ANDY);
  if (took(his) && await taker('bt/G1.1') === 'andy') test.check('his box.take is accepted and the box reads taken by andy');
  else test.fail(OWED + 'his box.take answered ' + his.status + ' ' + short(his.body) + '; taken by ' + short(await taker('bt/G1.1')));
  const agentWrite = await call('box.write', { id: 'bt/G1.1', text: 'An agent writes.', version: await version('bt/G1.1') }, CW);
  if (refusedTaken(agentWrite)) test.check('an agent\'s box.write is refused taken while he holds it');
  else test.fail(OWED + 'an agent\'s box.write while he holds the box answered ' + agentWrite.status + ' ' + short(agentWrite.body));
  const agentTake = await call('box.take', { id: 'bt/G1.1' }, CW);
  if (refusedTaken(agentTake)) test.check('an agent\'s box.take is refused taken while he holds it');
  else test.fail(OWED + 'an agent\'s box.take while he holds the box answered ' + agentTake.status + ' ' + short(agentTake.body));

  test.subHeading('2. box.release frees a take without a write, and only the holder\'s does');
  const notHis = await call('box.release', { id: 'bt/G1.1' }, CW);
  if (!took(notHis) && notHis.body && notHis.body.code !== 'no-such-verb' && await taker('bt/G1.1') === 'andy') test.check('an agent cannot release his take');
  else test.fail(OWED + 'an agent\'s box.release of his take answered ' + notHis.status + ' ' + short(notHis.body) + '; taken by ' + short(await taker('bt/G1.1')));
  const v1 = await version('bt/G1.1');
  const rel = await call('box.release', { id: 'bt/G1.1' }, ANDY);
  if (took(rel) && await taker('bt/G1.1') === '' && await version('bt/G1.1') === v1) test.check('his box.release frees the box and writes nothing');
  else test.fail(OWED + 'his box.release answered ' + rel.status + ' ' + short(rel.body) + '; taken by ' + short(await taker('bt/G1.1')) + ', version ' + (await version('bt/G1.1')) + ' (was ' + v1 + ')');
  const after = await call('box.write', { id: 'bt/G1.1', text: 'Written after the release.', version: await version('bt/G1.1') }, CW);
  if (took(after)) test.check('released, an agent writes again');
  else test.fail(OWED + 'after his release an agent\'s write answered ' + after.status + ' ' + short(after.body));

  test.subHeading('3. one rule for everybody: an agent\'s take refuses him too, and its release frees it');
  const cwTake = await call('box.take', { id: 'bt/G1.1' }, CW);
  if (took(cwTake)) test.check('the world: claude-windows takes the box');
  else test.fail('claude-windows could not take a free box: ' + cwTake.status + ' ' + short(cwTake.body));
  const hisWrite = await call('box.write', { id: 'bt/G1.1', text: 'He writes over a take.', version: await version('bt/G1.1') }, ANDY);
  if (refusedTaken(hisWrite)) test.check('his box.write is refused taken while an agent holds the box');
  else test.fail(OWED + 'his box.write while claude-windows holds the box answered ' + hisWrite.status + ' ' + short(hisWrite.body));
  const wslWrite = await call('box.write', { id: 'bt/G1.1', text: 'The other agent writes.', version: await version('bt/G1.1') }, WSL);
  if (refusedTaken(wslWrite)) test.check('the other agent\'s box.write is refused taken, as today');
  else test.fail('wsl-claude\'s write over claude-windows\'s take answered ' + wslWrite.status + ' ' + short(wslWrite.body));
  const cwRel = await call('box.release', { id: 'bt/G1.1' }, CW);
  if (took(cwRel) && await taker('bt/G1.1') === '') test.check('claude-windows\'s box.release frees its own take');
  else test.fail(OWED + 'claude-windows\'s box.release answered ' + cwRel.status + ' ' + short(cwRel.body) + '; taken by ' + short(await taker('bt/G1.1')));
}

// ── THE DIALOG ─────────────────────────────────────────────────────────
function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {}, placeholder: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
    appendChild: function () {}, removeChild: function () {}, replaceChild: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
const label = function (o) { return Object.assign({ goal: 'bt/G1', status: 'running', with: '', buttons: [], blocking: [], blocked: [], star: false, asks: 0, boxTaken: '' }, o); };

async function dialog() {
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  const calls = [];
  let dd = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DETAILS, 'utf8'))(
    { shell: { activateApp: function (x) { dd = x; } }, core: kernel.core }, doc, { addEventListener: function () {} });
  dd.mount(fakeElement('dd'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      const v = ask && Object.keys(ask)[0];
      calls.push({ verb: v, args: ask && ask[v] });
      if (v === 'item.get') return Promise.resolve({ status: 200, body: { item: JSON.stringify(label({ id: 'bt/G1.1', title: 'One' })), box: 'The box as it stands.', version: 3, change: 1, chatMore: false, checks: [], chat: [] } });
      if (v === 'item.box') return Promise.resolve({ status: 200, body: { box: 'The box as it stands.', version: 3 } });
      return Promise.resolve({ status: 200, body: { change: 2, version: 4, items: [], more: false, checks: [], chat: [] } });
    },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); }, armUntilElsewhere: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  dd.open({ id: 'bt/G1.1', agents: {} });
  for (let i = 0; i < 10; i++) await new Promise(function (r) { setImmediate(r); });
  const of = function (verb) { return calls.filter(function (c) { return c.verb === verb; }); };
  const html = Object.keys(byId).map(function (k) { return byId[k].innerHTML; }).join('\n');

  test.subHeading('4. the dialog draws the box as an input, and opening it takes nothing');
  if (/<textarea[^>]*id="dd-box-input"/.test(html)) test.check('the box is a textarea, dd-box-input');
  else test.fail(OWED + 'the dialog draws no textarea dd-box-input');
  if (/The box as it stands\./.test(html)) test.check('it holds the box\'s text');
  else test.fail('the dialog does not show the box text at all');
  if (!of('box.take').length) test.check('opening the dialog sent no box.take');
  else test.fail(OWED + 'opening the dialog sent ' + short(of('box.take')));

  // Focus and blur reach the box itself and the dialog's body, whichever listens; the target is the textarea.
  const input = doc.getElementById('dd-box-input');
  const target = { id: 'dd-box-input', getAttribute: function (n) { return n === 'id' ? 'dd-box-input' : null; }, closest: function () { return null; }, value: '' };
  Object.defineProperty(target, 'value', { get: function () { return input.value; } });
  const fire = function (types) { ['dd-box-input', 'dd-body', 'dd'].forEach(function (id) { types.forEach(function (t) { doc.getElementById(id).fire(t, { target: target, currentTarget: doc.getElementById(id) }); }); }); };
  const settled = async function () { for (let i = 0; i < 10; i++) await new Promise(function (r) { setImmediate(r); }); };

  test.subHeading('5. focus takes; blur unchanged releases; blur changed writes');
  input.value = 'The box as it stands.';
  fire(['focus', 'focusin']);
  await settled();
  if (of('box.take').length >= 1 && of('box.take')[0].args.id === 'bt/G1.1') test.check('focus sent box.take {id: bt/G1.1}');
  else test.fail(OWED + 'focus sent ' + short(of('box.take')));
  fire(['blur', 'focusout']);
  await settled();
  if (of('box.release').length >= 1 && of('box.release')[0].args.id === 'bt/G1.1' && !of('box.write').length) test.check('a blur with nothing changed sent box.release and no write');
  else test.fail(OWED + 'an unchanged blur sent release ' + short(of('box.release')) + ', write ' + short(of('box.write')));
  fire(['focus', 'focusin']);
  await settled();
  input.value = 'The box as he changed it.';
  fire(['blur', 'focusout']);
  await settled();
  const w = of('box.write')[0];
  if (w && w.args.id === 'bt/G1.1' && w.args.text === 'The box as he changed it.' && w.args.version === 3) test.check('a blur after a change sent box.write with his text and the version read');
  else test.fail(OWED + 'a changed blur sent ' + short(of('box.write')));
}

(async function () {
  await server();
  await dialog();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
