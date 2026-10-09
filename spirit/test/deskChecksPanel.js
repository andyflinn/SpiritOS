'use strict';

// goal/G9.16: answered checks leave the panel, a Q keeps one sentence. Red on today's tree; claude-windows wrote it
// from G9.16's box and does not build it.
//   Andy, 2026-10-09, under goal/G10.5, when the retrofit item stopped taking any write: "remove the red-questions and
//   we look for the next item to argue.", "there are only TWO (2) red questions.", "how do we fix that? in very
//   simple, enumerated steps."
//
// WHAT IS TRUE TODAY (read in the tree at ffcbbfe2): after every write the desk walks the state and measures each
// touched item's facts, box and checks panels as one answer each (largestPanel); a panel over ANSWER_ROOM undoes the
// write and refuses it line-too-large. Every check ever added stays in the panel, answered and granted ones included,
// so an item whose answered checks weigh more than one answer takes no check.set and no check.add any more. A chat
// line ending in a question mark becomes a Q check whose words are the whole line.
//
// THE SHAPE ASSERTED (G9.16's box): an answered or granted check leaves the panel item.checks answers with and the
// panel the desk measures (it stays in the record), so an item with many answered checks still takes check.set and
// check.add; and a Q made from a chat line keeps one sentence, the one that ends in the question mark.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G9.16: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskChecksPanelTestCWAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskChecksPanelTestOwnerAAAAAAAAAAAAAAA=', label: 'andy' };
const ROOM = appClient.ANSWER_MAX - 512;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('goal/G9.16: answered checks leave the panel, a Q keeps one sentence');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskcheckspanel-'));
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
async function checks(id) { const r = await call('item.checks', { id: id }, ANDY); return (r.body && r.body.checks) || []; }

// One Q's words, long enough that a dozen of them outweigh one answer: the room is a few thousand bytes.
const LONG = 'A question that carries a whole long chat line with it, as every question made from a line did today, ';
function words(n) { let s = ''; while (s.length < 600) s += LONG; return 'Q' + n + ': ' + s + 'is it not?'; }

async function suite() {
  if (!await start()) { test.fail('the desk server did not start'); return; }
  await call('session.set', { json: JSON.stringify({ goal: { id: 'cp/G1', title: 'Checks' }, items: [{ id: 'cp/G1.1', title: 'One', blocks: ['cp/G1'] }] }) }, CW);
  const first = await call('check.add', { id: 'cp/G1.1', kind: 'Q', words: 'A first question?', test: '' }, CW);
  if (took(first) && (await checks('cp/G1.1')).length === 1) test.check('the world: cp/G1.1 has one open Q');
  else { test.fail('the world: the first check.add answered ' + first.status + ' ' + short(first.body)); return; }

  test.subHeading('1. answered checks leave the panel, so the item keeps taking checks');
  // Fill the panel to just under the room with open questions, then answer them all.
  let added = 1;
  for (let n = 2; n <= 40; n++) {
    const probe = Buffer.byteLength(JSON.stringify({ checks: (await checks('cp/G1.1')).concat([{ number: 'Q' + n, kind: 'Q', words: words(n), test: '', state: 'open', by: CW.label, at: new Date().toISOString() }]) }), 'utf8');
    if (probe > ROOM - 200) break;
    const r = await call('check.add', { id: 'cp/G1.1', kind: 'Q', words: words(n), test: '' }, CW);
    if (!took(r)) { test.fail('the world: check.add Q' + n + ' answered ' + r.status + ' ' + short(r.body)); return; }
    added = n;
  }
  const before = await checks('cp/G1.1');
  if (before.length === added && added >= 4) test.check('the world: the panel holds ' + added + ' open questions, just under one answer');
  else { test.fail('the world: expected ' + added + ' checks, got ' + before.length); return; }
  for (const c of before) {
    const r = await call('check.set', { id: 'cp/G1.1', check: c.number, state: 'answered' }, CW);
    if (!took(r)) { test.fail('the world: answering ' + c.number + ' answered ' + r.status + ' ' + short(r.body)); return; }
  }
  const open = (await checks('cp/G1.1')).filter(function (c) { return c.state === 'open'; });
  if (!open.length) test.check('the world: every question is answered');
  else { test.fail('the world: ' + open.length + ' questions still open'); return; }

  const more = await call('check.add', { id: 'cp/G1.1', kind: 'Q', words: words(added + 1), test: '' }, CW);
  if (took(more)) test.check('with every question answered, a new question is taken although all of them together outweigh one answer');
  else test.fail(OWED + 'with ' + added + ' answered questions stored, check.add is refused ' + short(more.body));
  const again = await call('check.add', { id: 'cp/G1.1', kind: 'Q', words: words(added + 2), test: '' }, CW);
  if (took(again)) test.check('and a second new question too');
  else test.fail(OWED + 'the second new question is refused ' + short(again.body));

  const panel = await checks('cp/G1.1');
  const listedOpen = panel.filter(function (c) { return c.state === 'open'; }).length;
  const listedAnswered = panel.filter(function (c) { return c.state !== 'open'; }).length;
  if (listedOpen === (took(more) ? 1 : 0) + (took(again) ? 1 : 0) && listedAnswered === 0) test.check('item.checks answers the open questions only; the answered ones stay in the record and leave the panel');
  else test.fail(OWED + 'item.checks answers ' + panel.length + ' checks, ' + listedAnswered + ' of them answered');
  const bytes = Buffer.byteLength(JSON.stringify({ checks: panel }), 'utf8');
  if (bytes <= ROOM) test.check('the checks panel fits one answer', bytes + ' of ' + ROOM + ' bytes');
  else test.fail(OWED + 'the checks panel is ' + bytes + ' bytes, over the room of ' + ROOM);

  if (took(more)) {
    const num = panel.filter(function (c) { return c.state === 'open'; })[0];
    const set = num ? await call('check.set', { id: 'cp/G1.1', check: num.number, state: 'answered' }, CW) : { status: 0, body: null };
    if (took(set)) test.check('check.set still works on the item');
    else test.fail(OWED + 'check.set on the item answered ' + set.status + ' ' + short(set.body));
  }

  test.subHeading('2. a question made from a chat line keeps one sentence');
  await call('session.set', { json: JSON.stringify({ goal: { id: 'cp/G2', title: 'Lines' }, items: [{ id: 'cp/G2.1', title: 'Two', blocks: ['cp/G2'] }] }) }, CW);
  const line = 'cw: the first sentence states a fact. The second states another, at some length, so that the whole line is long. Is this the question?';
  const chat = await call('chat.add', { id: 'cp/G2.1', text: line }, CW);
  if (!took(chat)) { test.fail('the world: chat.add answered ' + chat.status + ' ' + short(chat.body)); return; }
  const made = (await checks('cp/G2.1')).filter(function (c) { return c.kind === 'Q'; });
  if (made.length === 1) test.check('the world: the line with a question mark became one Q');
  else { test.fail('the world: the line became ' + made.length + ' Q checks'); return; }
  if (made[0].words.trim() === 'Is this the question?') test.check('the Q holds the sentence that ends in the question mark, not the whole line');
  else test.fail(OWED + 'the Q holds ' + JSON.stringify(made[0].words.slice(0, 80)) + (made[0].words.length > 80 ? '...' : ''));
}

(async function () {
  await suite();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
