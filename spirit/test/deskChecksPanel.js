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
// SINCE goal/G21.2 no chat line makes a Q, a Q is one sentence of at most 200 bytes, and one is open per agent per
// item: section 1 fills the record one question at a time, and section 2 asserts the one sentence at check.add.

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

// One Q's words. Since goal/G21.2 a red Q is one sentence of at most 200 bytes, and one open per agent per item, so
// the panel can no longer be filled with open questions: the record is filled instead, one question placed and
// answered at a time, until the questions ever asked outweigh one answer.
const LONG = 'A question that is one sentence and close to the two hundred bytes a red Q may hold, ';
function words(n) { return 'Q' + n + ': ' + LONG + LONG.slice(0, 80) + ' is it not?'; }
const WSL = { key: 'MCowBQYDK2VwAyEAdeskChecksPanelTestWSLAAAAAAAAAAAAAAAAAA=', label: 'wsl-claude' };

async function suite() {
  if (!await start()) { test.fail('the desk server did not start'); return; }
  await call('session.set', { json: JSON.stringify({ goal: { id: 'cp/G1', title: 'Checks' }, items: [{ id: 'cp/G1.1', title: 'One', blocks: ['cp/G1'] }] }) }, CW);
  const first = await call('check.add', { id: 'cp/G1.1', kind: 'Q', words: 'A first question?', test: '' }, CW);
  if (took(first) && (await checks('cp/G1.1')).length === 1) test.check('the world: cp/G1.1 has one open Q');
  else { test.fail('the world: the first check.add answered ' + first.status + ' ' + short(first.body)); return; }

  test.subHeading('1. answered checks leave the panel, so the item keeps taking checks');
  // Since goal/G21.2: place and answer one question at a time until all of them ever asked outweigh one answer.
  const firstQ = (await checks('cp/G1.1'))[0];
  await call('check.set', { id: 'cp/G1.1', check: firstQ.number, state: 'answered' }, CW);
  let added = 1;
  let weight = Buffer.byteLength(JSON.stringify({ checks: [firstQ] }), 'utf8');
  for (let n = 2; n <= 80 && weight <= ROOM + 400; n++) {
    const r = await call('check.add', { id: 'cp/G1.1', kind: 'Q', words: words(n), test: '' }, CW);
    if (!took(r)) { test.fail('the world: check.add Q' + n + ' answered ' + r.status + ' ' + short(r.body)); return; }
    const c = (await checks('cp/G1.1')).filter(function (x) { return x.state === 'open'; })[0];
    weight += Buffer.byteLength(JSON.stringify(c), 'utf8') + 1;
    const a = await call('check.set', { id: 'cp/G1.1', check: c.number, state: 'answered' }, CW);
    if (!took(a)) { test.fail('the world: answering ' + c.number + ' answered ' + a.status + ' ' + short(a.body)); return; }
    added = n;
  }
  if (weight > ROOM && added >= 4) test.check('the world: ' + added + ' questions asked and answered, together over one answer');
  else { test.fail('the world: ' + added + ' questions weigh ' + weight + ' of ' + ROOM + ' bytes'); return; }
  const open = (await checks('cp/G1.1')).filter(function (c) { return c.state === 'open'; });
  if (!open.length) test.check('the world: every question is answered');
  else { test.fail('the world: ' + open.length + ' questions still open'); return; }

  const more = await call('check.add', { id: 'cp/G1.1', kind: 'Q', words: words(added + 1), test: '' }, CW);
  if (took(more)) test.check('with every question answered, a new question is taken although all of them together outweigh one answer');
  else test.fail(OWED + 'with ' + added + ' answered questions stored, check.add is refused ' + short(more.body));
  // Since goal/G21.2 one open red Q per agent per item: the second new one is another agent's.
  const again = await call('check.add', { id: 'cp/G1.1', kind: 'Q', words: words(added + 2), test: '' }, WSL);
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

  // SINCE goal/G21.2 NO CHAT LINE MAKES A Q, and the one sentence is asked of the Q itself: a check.add holding more
  // than one sentence is refused (deskRedQOnPurpose.js holds the rest).
  test.subHeading('2. since goal/G21.2 a chat line makes no Q, and a Q of more than one sentence is refused');
  await call('session.set', { json: JSON.stringify({ goal: { id: 'cp/G2', title: 'Lines' }, items: [{ id: 'cp/G2.1', title: 'Two', blocks: ['cp/G2'] }] }) }, CW);
  const line = 'cw: the first sentence states a fact. The second states another, at some length, so that the whole line is long. Is this the question?';
  // Since goal/G18.8 an agent writes only where it holds the item or the take of his line.
  await call('item.take', { id: 'cp/G2.1' }, CW);
  const chat = await call('chat.add', { id: 'cp/G2.1', text: line }, CW);
  if (!took(chat)) { test.fail('the world: chat.add answered ' + chat.status + ' ' + short(chat.body)); return; }
  const made = (await checks('cp/G2.1')).filter(function (c) { return c.kind === 'Q'; });
  if (made.length === 0) test.check('the line with a question mark made no Q');
  else test.fail('the line became ' + made.length + ' Q checks');
  const twoSentences = await call('check.add', { id: 'cp/G2.1', kind: 'Q', words: 'The first sentence states a fact. Is this the question?', test: '' }, CW);
  if (!took(twoSentences) && twoSentences.body && twoSentences.body.extra && twoSentences.body.extra.why) test.check('a Q of two sentences is refused with a why');
  else test.fail('a Q of two sentences answered ' + twoSentences.status + ' ' + short(twoSentences.body));
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
