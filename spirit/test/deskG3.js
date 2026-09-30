'use strict';

// desk/G3.1 and desk/G3.3: what Andy met on the new Desk after the switch.
//   G3.1  Andy: "start design mode should start a new project if nothing is in the list".
//   G3.3  Andy: "why would the server not use bucket to give me the most recent stuff?" and "for these chats the
//         server should search for "*" and find the most recent few entries easily".
// The contract the builder follows (claude-windows's picks where the box names no shape):
//   G3.1  press {what: 'start-design', id: '', by: 'andy'} while no goal is open creates a goal `goal/G<n>` (n the
//         next free number), titled 'New goal', in design mode, and makes it the current goal; Andy renames it.
//         With a goal open, an empty id is refused (bad-request). An agent's is refused like any owner press.
//         The List's Start design, with no goal row, sends that press.
//   G3.3  item.get walks the chat newest first through the server's bucket, in the room the answer has left after
//         the box and the facts: `chat` holds the newest lines that fit, oldest first as before, and `chatMore` is
//         true when older lines were left out. The whole answer fits one answer (appClient.ANSWER_MAX).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const kernel = require('../run/js/kernel.js');

const G31 = 'OWED by desk/G3.1: ';
const G33 = 'OWED by desk/G3.3: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }

test.startTest('desk/G3: start design from nothing, and a long chat that still opens');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskg3-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const kids = [];
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', pipe);
const call = function (verb, args) { const b = {}; b[verb] = args; return client.ask({ desk: b }).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; }); };
async function start() {
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  kids.push(kid);
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) return true; } catch (e) { /* not yet */ }
  }
  return false;
}
function stop(kid) { return new Promise(function (r) { if (kid.exitCode !== null || kid.signalCode !== null) return r(); kid.once('exit', r); kid.kill(); }); }
async function items(args) {
  const r = await call('items.search', Object.assign({ text: '', currentGoalOnly: false, goalsOnly: false }, args || {}));
  return (((r.body || {}).items) || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return null; } }).filter(Boolean);
}

// The List, mounted on a fake desk server that lists nothing.
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
function clickTarget(attrs) {
  return { id: attrs.id || '', getAttribute: function (n) { return attrs[n] || null; }, closest: function () { return null; }, parentNode: null };
}

(async function () {
  test.subHeading('G3.1: Start design with nothing open starts a new goal');
  await start();
  const made = await call('press', { id: '', what: 'start-design', by: 'andy' });
  const after = await items({ currentGoalOnly: true });
  const goal = after.filter(function (i) { return i.goal === ''; })[0];
  if (made.status === 200 && goal && /^goal\/G\d+$/.test(goal.id) && goal.title === 'New goal' && goal.design === true) {
    test.check('with nothing open, start-design created ' + goal.id + ' "New goal" in design mode, the current goal');
  } else test.fail(G31 + 'start-design with no id answered ' + JSON.stringify(made.body || made) + '; current goal ' + JSON.stringify(goal || null));
  const second = await call('press', { id: '', what: 'start-design', by: 'andy' });
  if (second.status === 400 && second.body && second.body.code === 'bad-request') test.check('with a goal open, an empty id is refused as bad-request');
  else test.fail(G31 + 'with a goal open, start-design with no id answered ' + JSON.stringify(second.body || second));
  const agent = await call('press', { id: '', what: 'start-design', by: 'wsl-claude' });
  if (agent.status >= 400) test.check('an agent cannot start a goal that way');
  else test.fail('an agent\'s start-design with no id was taken');

  // The List: no goal row, Start design pressed twice (it arms first).
  const fake = require('./deskFake.js').create([]);
  fake.items = [];
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DESK, 'utf8'))(
    { shell: { activateApp: function (x) { behavior = x; } }, core: kernel.core }, doc, {});
  behavior.mount(fakeElement('container'), {
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: fake.verb,
    onPublished: function () {}, onPacket: function () {}, peerPost: function () { return Promise.resolve({ ok: true }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  for (let i = 0; i < 6; i++) await settle();
  const tabs = doc.getElementById('desk-tabs');
  tabs.fire('click', { target: clickTarget({ 'data-tab': 'team' }), currentTarget: tabs });
  tabs.fire('click', { target: clickTarget({ id: 'desk-start-design' }), currentTarget: tabs });
  tabs.fire('click', { target: clickTarget({ id: 'desk-start-design' }), currentTarget: tabs });
  for (let i = 0; i < 6; i++) await settle();
  const pressed = fake.calls.filter(function (c) { return c.verb === 'press' && c.args.what === 'start-design'; })[0];
  if (pressed && pressed.args.id === '' && pressed.args.by === 'andy') test.check('with no goal row, the List\'s Start design sends start-design with no id');
  else test.fail(G31 + 'the List sent ' + JSON.stringify(fake.calls.filter(function (c) { return c.verb === 'press'; })));

  test.subHeading('G3.3: an item with a long chat still opens, with its newest lines');
  await call('session.set', { json: JSON.stringify({ goal: { id: 't/G1', title: 'The goal' }, rules: [], items: [{ id: 't/G1.1', title: 'Talky', blocks: ['t/G1'] }] }), by: 'claude-windows' });
  await call('box.write', { id: 't/G1.1', text: 'the box', version: 0, by: 'claude-windows' });
  const n = Math.ceil((appClient.ANSWER_MAX * 3) / 1000);
  for (let i = 0; i < n; i++) await call('chat.add', { id: 't/G1.1', text: 'LINE-' + String(i).padStart(3, '0') + ' ' + 'x'.repeat(1000), by: i % 2 ? 'andy' : 'wsl-claude' });
  const got = await call('item.get', { id: 't/G1.1' });
  const body = got.body || {};
  const chat = body.chat || [];
  const newest = 'LINE-' + String(n - 1).padStart(3, '0');
  if (got.status === 200 && chat.length && String(chat[chat.length - 1].text).indexOf(newest) === 0 && body.box === 'the box') {
    test.check('item.get answers, with the box and the newest line last (' + chat.length + ' of ' + n + ' lines)');
  } else test.fail(G33 + 'item.get on a chat of ' + n + ' long lines answered ' + JSON.stringify(got.body || got).slice(0, 200));
  if (body.chatMore === true && chat.length < n && String(chat[0] && chat[0].text).indexOf('LINE-000') !== 0) test.check('older lines are left out, and chatMore says so');
  else test.fail(G33 + 'chatMore ' + JSON.stringify(body.chatMore) + ', ' + chat.length + ' of ' + n + ' lines');
  if (got.status === 200 && Buffer.byteLength(JSON.stringify(body), 'utf8') <= appClient.ANSWER_MAX) test.check('the answer fits one answer');
  else test.fail(G33 + 'the answer is ' + Buffer.byteLength(JSON.stringify(body), 'utf8') + ' bytes');
  const short = await call('item.get', { id: 't/G1' });
  if (short.status === 200 && (short.body || {}).chatMore === false) test.check('a short chat says chatMore false');
  else test.fail(G33 + 'a short chat answered chatMore ' + JSON.stringify((short.body || {}).chatMore));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(async function () {
  for (const k of kids) await stop(k);
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
