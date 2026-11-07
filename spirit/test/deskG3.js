'use strict';

// desk/G3.1 and desk/G3.3: what Andy met on the new Desk after the switch.
//   G3.1  Andy: "start design mode should start a new project if nothing is in the list".
//   G3.3  Andy: "why would the server not use bucket to give me the most recent stuff?" and "for these chats the
//         server should search for "*" and find the most recent few entries easily".
// The contract (the agents' picks where the box names no shape):
//   G3.1  press {what: 'start-design', id: ''} from the owner while no goal is open creates a goal `goal/G<n>` (n the
//         next free number), titled 'New goal', in design mode, and makes it the current goal; Andy renames it.
//         With a goal open, an empty id is refused (bad-request). An agent's is refused like any owner press.
//   G3.3  item.chat walks the chat newest first through the server's bucket, in the room the answer has left after
//         the box and the facts: `chat` holds the newest lines that fit, oldest first as before, and `chatMore` is
//         true when older lines were left out. The whole answer fits one answer (appClient.ANSWER_MAX).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/spirit/appClient.js');

const G31 = 'OWED by desk/G3.1: ';
const G33 = 'OWED by desk/G3.3: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test.startTest('desk/G3: start design from nothing, and a long chat that still opens');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskg3-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const kids = [];
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', pipe);
// Writers are CALLERS (apiAuth/G1.13): desk refuses a by argument.
const CW = { key: 'MCowBQYDK2VwAyEAdeskG3TestPeerCWAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskG3TestPeerWSAAAAAAAAAAAAAAAAAA=', label: 'wsl-claude' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskG3TestOwnerAAAAAAAAAAAAAAAAAAA=', label: 'andy' };
const call = function (verb, args, caller) { const b = {}; b[verb] = args; return client.ask({ desk: b }, caller).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; }); };
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
// The item as the dialog sees it: its facts and each panel, asked each on its own (lazy panels).
async function whole(id) {
  const parts = await Promise.all(['item.get', 'item.box', 'item.checks', 'item.chat'].map(function (v) { return call(v, { id: id }); }));
  return { status: parts.every(function (p) { return p.status === 200; }) ? 200 : (parts.filter(function (p) { return p.status !== 200; })[0] || {}).status,
    body: Object.assign({}, parts[0].body, parts[1].body, parts[2].body, parts[3].body) };
}
async function items(args) {
  const r = await call('items.search', Object.assign({ text: '', currentGoalOnly: false, goalsOnly: false, includeClosed: false }, args || {}));
  return (((r.body || {}).items) || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return null; } }).filter(Boolean);
}


(async function () {
  test.subHeading('G3.1: Start design with nothing open starts a new goal');
  await start();
  const made = await call('press', { id: '', what: 'start-design' }, ANDY);
  const after = await items({ currentGoalOnly: true });
  const goal = after.filter(function (i) { return i.goal === ''; })[0];
  if (made.status === 200 && goal && /^goal\/G\d+$/.test(goal.id) && goal.title === 'New goal' && goal.design === true) {
    test.check('with nothing open, start-design created ' + goal.id + ' "New goal" in design mode, the current goal');
  } else test.fail(G31 + 'start-design with no id answered ' + JSON.stringify(made.body || made) + '; current goal ' + JSON.stringify(goal || null));
  const second = await call('press', { id: '', what: 'start-design' }, ANDY);
  if (second.status === 400 && second.body && second.body.code === 'bad-request') test.check('with a goal open, an empty id is refused as bad-request');
  else test.fail(G31 + 'with a goal open, start-design with no id answered ' + JSON.stringify(second.body || second));
  const agent = await call('press', { id: '', what: 'start-design' }, WSL);
  if (agent.status >= 400) test.check('an agent cannot start a goal that way');
  else test.fail('an agent\'s start-design with no id was taken');


  test.subHeading('G3.3: an item with a long chat still opens, with its newest lines');
  // An agent creates no goal (goal/G29.21), so the owner writes the world through goal.add and item.add, the desk
  // naming the ids.
  const G1 = String(((await call('goal.add', { title: 'The goal' }, ANDY)).body || {}).id || '');
  const I1 = String(((await call('item.add', { goal: G1, title: 'Talky' }, ANDY)).body || {}).id || '');
  if (!G1 || !I1) test.fail('the world: goal.add/item.add named no ids');
  await call('box.write', { id: I1, text: 'the box', version: 0 }, CW);
  const n = Math.ceil((appClient.ANSWER_MAX * 3) / 1000);
  // An agent writes only where it holds the item or the take of his line (goal/G18.8).
  for (const id of [I1, G1]) await call('item.take', { id: id }, WSL);
  for (let i = 0; i < n; i++) await call('chat.add', { id: I1, text: 'LINE-' + String(i).padStart(3, '0') + ' ' + 'x'.repeat(1000) }, i % 2 ? ANDY : WSL);
  const got = await whole(I1);
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
  const short = await whole(G1);
  if (short.status === 200 && (short.body || {}).chatMore === false) test.check('a short chat says chatMore false');
  else test.fail(G33 + 'a short chat answered chatMore ' + JSON.stringify((short.body || {}).chatMore));
  // Andy: "in the db yes, but in the sent messages ther MUST be a MAX_PAYLOAD". A line too long to come back whole in
  // an item.get is refused when it is written (line-too-large), and the sender slices it; the chat keeps what it had.
  await call('chat.add', { id: G1, text: 'SMALL-OLDER' }, WSL);
  const tooLong = await call('chat.add', { id: G1, text: 'HUGE ' + 'y'.repeat(appClient.ANSWER_MAX - 400) }, WSL);
  const huge = await whole(G1);
  const hc = (huge.body || {}).chat || [];
  if (tooLong.status === 413 && tooLong.body && tooLong.body.code === 'line-too-large') test.check('chat.add refuses a line too long to be sent back, as line-too-large');
  else test.fail(G33 + 'a too-long chat line answered ' + JSON.stringify({ status: tooLong.status, code: tooLong.body && tooLong.body.code }));
  if (huge.status === 200 && hc.length && hc[hc.length - 1].text === 'SMALL-OLDER' && (huge.body || {}).chatMore === false) test.check('the refused line was not kept: the chat ends with the line before it, whole');
  else test.fail(G33 + 'after the refused line item.get answered ' + JSON.stringify({ status: huge.status, chat: hc.map(function (l) { return String(l.text).slice(0, 12); }), more: (huge.body || {}).chatMore }));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(async function () {
  for (const k of kids) await stop(k);
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
