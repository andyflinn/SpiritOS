'use strict';

// goal/G21.2: AN AGENT'S QUESTION IN CHAT RAISES NO Q CHECK. Andy, in G21.2's box: "A question mark in a chat line
// never makes a red Q; only a deliberate Q check does."
//
// WHAT THE DESK DOES (spirit/run/process/js/desk/desk.js): chat.add stores the line as it came, with no Q number; a Q
// check exists only when somebody calls check.add, and an item waits on him (asks) for open Q checks alone.
//
// WHAT IS ASSERTED: 1-4, a line ending in a question mark, by one agent or two, raises no Q and is stored untouched;
// 5, his own line raises nothing, and a deliberate check.add Q makes the item wait on him until check.set answers it;
// 6, a question under a rule (rule/N) is stored as a rule line and raises nothing.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/spirit/appClient.js');

const OWED = 'OWED by goal/G2.21: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskChatQTestCWAAAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskChatQTestWSLAAAAAAAAAAAAAAAAAAAAAAA=', label: 'wsl-claude' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskChatQTestOwnerAAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }

test.startTest('goal/G2.21, since goal/G21.2: an agent\'s question in chat raises no Q check');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskchatq-'));
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
async function checksOf(id) { const r = await call('item.checks', { id: id }, ANDY); return ((r.body && r.body.checks) || []); }
async function chatOf(id) { const r = await call('item.chat', { id: id }, ANDY); return ((r.body && r.body.chat) || []); }
async function qsOf(id) { return (await checksOf(id)).filter(function (c) { return c.kind === 'Q'; }); }
async function asksOf(id) { const r = await call('item.get', { id: id }, ANDY); return Number((parse(r.body && r.body.item) || {}).asks || 0); }

const QUESTION = 'wsl: should the keys stay in the owner row, or move to the whoBook?';
const PLAIN = 'wsl: the keys stay in the owner row for now.';

(async function () {
  // goal/G29.21: an agent's session creates no goal, so the owner writes the world.
  // goal/G33.7: session.set went; the world is seeded before the desk starts, which takes it in at start.
  test.seedDesk(state, { goal: { id: 'goal/G100', title: 'Questions' }, items: [
    { id: 'goal/G100.1', title: 'Asked', blocks: ['goal/G100'] },
    { id: 'goal/G100.2', title: 'Not asked', blocks: ['goal/G100'] },
    { id: 'goal/G100.3', title: 'Twice', blocks: ['goal/G100'] },
    { id: 'goal/G100.4', title: 'His own', blocks: ['goal/G100'] },
  ] });
  if (!await start()) { test.fail('the desk server did not start'); return; }
  // SINCE goal/G18.8 AN AGENT WRITES ONLY WHERE IT HOLDS THE ITEM OR THE TAKE OF HIS LINE: wsl-claude holds the items
  // it asks under; on goal/G100.3 claude-windows answers a line of his it has taken.
  // Since goal/G21.4 an agent holds one task at a time: wsl-claude takes each item as it gets to it (hold), letting the
  // one before go.
  let holding = '';
  const hold = async function (id) { if (holding) await call('item.release', { id: holding }, WSL); await call('item.take', { id: id }, WSL); holding = id; };
  await hold('goal/G100.1');

  // SINCE goal/G21.2 A QUESTION MARK IN CHAT RAISES NOTHING. Andy, in G21.2's box: "A question mark in a chat line
  // never makes a red Q; only a deliberate Q check does." Sections 1-4 assert the conversion is gone; 5 and 6 stand.
  test.subHeading('1. since goal/G21.2 an agent\'s line ending in a question mark raises no Q');
  const said = await call('chat.add', { id: 'goal/G100.1', text: QUESTION }, WSL);
  const qs = await qsOf('goal/G100.1');
  if (!took(said)) test.fail('chat.add answered ' + said.status + ' ' + short(said.body));
  else if (qs.length === 0) test.check('the question line raises no Q check');
  else test.fail('the question line raised ' + short(qs));
  if (await asksOf('goal/G100.1') === 0) test.check('the item is not waiting on him for a chat line');
  else test.fail('the item\'s asks reads ' + short(await asksOf('goal/G100.1')));

  test.subHeading('2. the line itself stays in chat, as written, with no Q number');
  const lines = await chatOf('goal/G100.1');
  const mine = lines.filter(function (l) { return l.by === 'wsl-claude'; });
  if (mine.length === 1 && mine[0].text === QUESTION) test.check('the line is still there with its text untouched');
  else test.fail('the chat holds ' + short(lines));
  if (mine.length === 1 && mine[0].q === undefined) test.check('the line carries no Q number');
  else test.fail('the line reads ' + short(mine.length ? mine[0] : null));

  test.subHeading('3. a line that asks nothing passes as before');
  await hold('goal/G100.2');
  await call('chat.add', { id: 'goal/G100.2', text: PLAIN }, WSL);
  const none = await qsOf('goal/G100.2');
  const plainLine = (await chatOf('goal/G100.2'))[0] || {};
  if (!none.length && plainLine.text === PLAIN) test.check('a statement raises no Q and is stored as it came');
  else test.fail(OWED + 'the plain line raised ' + short(none) + '; stored ' + short(plainLine));
  // A question mark inside a line that ends otherwise is a sentence, not the ask: the box says ends in one.
  await call('chat.add', { id: 'goal/G100.2', text: 'wsl: he asked "what now?" and I answered him.' }, WSL);
  const stillNone = await qsOf('goal/G100.2');
  if (!stillNone.length) test.check('a question mark inside the line, not at its end, raises nothing');
  else test.fail(OWED + 'a mid-line question mark raised ' + short(stillNone));
  // Since goal/G21.2: a question mark followed by blanks raises nothing either.
  await call('chat.add', { id: 'goal/G100.2', text: 'wsl: and the second row, does it go too?   ' }, WSL);
  const trailing = await qsOf('goal/G100.2');
  if (trailing.length === 0) test.check('a question mark followed by blanks raises nothing');
  else test.fail('the line ending in a question mark and blanks raised ' + short(trailing));

  test.subHeading('4. since goal/G21.2 two question lines by two agents raise nothing');
  await hold('goal/G100.3');
  await call('chat.add', { id: 'goal/G100.3', text: 'wsl: first, does the owner row survive a restore?' }, WSL);
  await call('chat.add', { id: 'goal/G100.3', text: 'and the whoBook?' }, ANDY);
  await call('line.take', { id: 'goal/G100.3' }, CW);
  await call('chat.add', { id: 'goal/G100.3', text: 'cw: second, and does the whoBook travel with it?' }, CW);
  const two = await qsOf('goal/G100.3');
  if (two.length === 0) test.check('two question lines raise no Q');
  else test.fail('two question lines raised ' + short(two.map(function (c) { return { n: c.number, by: c.by }; })));

  test.subHeading('5. his own line is never converted, and his answer closes the Q as ever');
  const his = await call('chat.add', { id: 'goal/G100.4', text: 'and what do you two make of this?' }, ANDY);
  const hisQs = await qsOf('goal/G100.4');
  if (took(his) && !hisQs.length) test.check('his own question raises nothing: the checks are what waits on HIM');
  else test.fail(OWED + 'his question answered ' + his.status + ' and raised ' + short(hisQs));
  // Since goal/G9.16 an answered Q leaves the panel item.checks answers with (it stays in the record), so the item
  // answers no Q at all once it is answered; before that it was listed with state answered.
  // Since goal/G21.2 the Q is placed on purpose, by check.add, as the only way there is.
  await call('check.add', { id: 'goal/G100.1', kind: 'Q', words: 'Should the keys stay in the owner row?', test: '' }, WSL);
  if (await asksOf('goal/G100.1') > 0) test.check('a deliberate Q makes the item wait on him');
  else test.fail('after check.add the item\'s asks reads ' + short(await asksOf('goal/G100.1')));
  const closed =await call('check.set', { id: 'goal/G100.1', check: 'Q1', state: 'answered' }, WSL);
  const after = await qsOf('goal/G100.1');
  if (took(closed) && after.length === 0 && await asksOf('goal/G100.1') === 0) test.check('answered through check.set as any Q, the Q leaves the panel and the item stops waiting');
  else test.fail(OWED + 'check.set answered ' + closed.status + ' ' + short(closed.body) + '; checks ' + short(after));

  test.subHeading('6. a rule\'s chat is untouched: a rule has no checks');
  const added = await call('rule.add', { type: 'desk', label: 'Questions as checks', text: 'An agent question goes on its item as a Q check at once.' }, CW);
  const key = added.body && added.body.key;
  const onRule = key ? await call('chat.add', { id: key, text: 'wsl: should this cover the group chat too?' }, WSL) : {};
  const ruleChat = key ? await chatOf(key) : [];
  if (took(onRule) && ruleChat.some(function (l) { return /group chat/.test(String(l.text)); })) test.check('a question under a rule is stored as a rule line and raises nothing');
  else test.fail(OWED + 'the rule line answered ' + onRule.status + ' ' + short(onRule.body) + '; the rule chat holds ' + short(ruleChat));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
