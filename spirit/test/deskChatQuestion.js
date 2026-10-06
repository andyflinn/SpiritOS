'use strict';

// goal/G2.21: a question never hides in chat. Red on today's tree; wsl-claude wrote it from G2.21's box and does
// not build it.
//   Andy, 2026-10-06, under goal/G2.18: "i want mechanical support in deskServer to make agents add red-question to
//   the design", and "add G2.21". It came out of his own complaint the same day, when an agent's question sat in
//   chat and lit nothing: "i see no Q's and it really bugs me."
//
// WHAT IS TRUE TODAY (read in the tree at 9ece24a8): chat.add stores the line and that is all (process/js/desk/
// desk.js, the chat.add branch of the walk pushes {by, at, text, taken}); a Q check exists only when somebody calls
// check.add, and his List's red icon is drawn from open checks alone (asksOf). So an agent's question in chat
// raises nothing, which is the hiding this item ends.
//
// THE SHAPE (G2.21's box): an agent's chat line under an ITEM whose text ends in a question mark is stored as it
// came AND the desk adds one open Q check on that item with the same words, by that agent. His own lines and the
// desk's own are never converted; a line that does not end in a question mark passes as before; a rule's chat
// (rule/N) is untouched, rules having no checks.
//
// ONE NAME IS THE BUILDER'S TO ARGUE, in Desk before building: the box says the line "stays in chat, marked with
// its Q number", and this suite reads that mark as a `q` field on the stored line carrying the check's number
// ('Q1'), because the line's own text must stay exactly as the agent wrote it for his quote-back to work. Whether
// the dialog then draws that mark is not asserted here; what the page needs is the number on the line.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G2.21: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskChatQTestCWAAAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskChatQTestWSLAAAAAAAAAAAAAAAAAAAAAAA=', label: 'wsl-claude' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskChatQTestOwnerAAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }

test.startTest('goal/G2.21: an agent\'s question in chat becomes a Q check on the item');

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
  if (!await start()) { test.fail('the desk server did not start'); return; }
  await call('session.set', { json: JSON.stringify({ goal: { id: 'cq/G1', title: 'Questions' }, items: [
    { id: 'cq/G1.1', title: 'Asked', blocks: ['cq/G1'] },
    { id: 'cq/G1.2', title: 'Not asked', blocks: ['cq/G1'] },
    { id: 'cq/G1.3', title: 'Twice', blocks: ['cq/G1'] },
    { id: 'cq/G1.4', title: 'His own', blocks: ['cq/G1'] },
  ] }) }, CW);

  test.subHeading('1. an agent\'s line ending in a question mark raises one open Q with those words');
  const said = await call('chat.add', { id: 'cq/G1.1', text: QUESTION }, WSL);
  const qs = await qsOf('cq/G1.1');
  if (!took(said)) test.fail('chat.add answered ' + said.status + ' ' + short(said.body));
  else if (qs.length === 1 && qs[0].state === 'open' && qs[0].words === QUESTION) test.check('one open Q check carries the line\'s own words');
  else test.fail(OWED + 'the question line raised ' + short(qs));
  if (qs.length === 1 && qs[0].by === 'wsl-claude') test.check('the Q is by the agent that asked, not by desk');
  else test.fail(OWED + 'the Q reads by ' + short(qs.length ? qs[0].by : null));
  // THE POINT OF THE ITEM: his List lights from open checks alone, so the question must count there.
  if (await asksOf('cq/G1.1') > 0) test.check('the item now counts as waiting on him');
  else test.fail(OWED + 'the item\'s asks reads ' + short(await asksOf('cq/G1.1')));

  test.subHeading('2. the line itself stays in chat, as written, marked with its Q number');
  const lines = await chatOf('cq/G1.1');
  const mine = lines.filter(function (l) { return l.by === 'wsl-claude'; });
  if (mine.length === 1 && mine[0].text === QUESTION) test.check('the line is still there with its text untouched');
  else test.fail(OWED + 'the chat holds ' + short(lines));
  if (mine.length === 1 && mine[0].q === (qs.length ? qs[0].number : 'Q1')) test.check('the line carries its Q number (' + short(mine[0].q) + ')');
  else test.fail(OWED + 'the line carries no Q number: ' + short(mine.length ? mine[0] : null));

  test.subHeading('3. a line that asks nothing passes as before');
  await call('chat.add', { id: 'cq/G1.2', text: PLAIN }, WSL);
  const none = await qsOf('cq/G1.2');
  const plainLine = (await chatOf('cq/G1.2'))[0] || {};
  if (!none.length && plainLine.text === PLAIN) test.check('a statement raises no Q and is stored as it came');
  else test.fail(OWED + 'the plain line raised ' + short(none) + '; stored ' + short(plainLine));
  // A question mark inside a line that ends otherwise is a sentence, not the ask: the box says ends in one.
  await call('chat.add', { id: 'cq/G1.2', text: 'wsl: he asked "what now?" and I answered him.' }, WSL);
  const stillNone = await qsOf('cq/G1.2');
  if (!stillNone.length) test.check('a question mark inside the line, not at its end, raises nothing');
  else test.fail(OWED + 'a mid-line question mark raised ' + short(stillNone));
  // Trailing blanks are not the agent saying something else.
  await call('chat.add', { id: 'cq/G1.2', text: 'wsl: and the second row, does it go too?   ' }, WSL);
  const trailing = await qsOf('cq/G1.2');
  if (trailing.length === 1) test.check('a question mark followed by blanks still raises one');
  else test.fail(OWED + 'the line ending in a question mark and blanks raised ' + short(trailing));

  test.subHeading('4. two questions raise two, each numbered, nothing merged');
  await call('chat.add', { id: 'cq/G1.3', text: 'wsl: first, does the owner row survive a restore?' }, WSL);
  await call('chat.add', { id: 'cq/G1.3', text: 'cw: second, and does the whoBook travel with it?' }, CW);
  const two = await qsOf('cq/G1.3');
  const numbers = two.map(function (c) { return c.number; });
  const authors = two.map(function (c) { return c.by; });
  if (two.length === 2 && numbers.join(',') === 'Q1,Q2' && authors.indexOf('wsl-claude') !== -1 && authors.indexOf('claude-windows') !== -1) test.check('two question lines raise Q1 and Q2, each by its own agent');
  else test.fail(OWED + 'two question lines raised ' + short(two.map(function (c) { return { n: c.number, by: c.by }; })));

  test.subHeading('5. his own line is never converted, and his answer closes the Q as ever');
  const his = await call('chat.add', { id: 'cq/G1.4', text: 'and what do you two make of this?' }, ANDY);
  const hisQs = await qsOf('cq/G1.4');
  if (took(his) && !hisQs.length) test.check('his own question raises nothing: the checks are what waits on HIM');
  else test.fail(OWED + 'his question answered ' + his.status + ' and raised ' + short(hisQs));
  const closed = await call('check.set', { id: 'cq/G1.1', check: 'Q1', state: 'answered' }, WSL);
  const after = await qsOf('cq/G1.1');
  if (took(closed) && after.length === 1 && after[0].state === 'answered' && await asksOf('cq/G1.1') === 0) test.check('answered through check.set as any Q, and the item stops waiting');
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
