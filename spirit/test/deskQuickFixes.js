'use strict';

// spirit/test/deskQuickFixes.js
// goal/G29.10: quick desk fixes. Red on today's tree; claude-windows writes it and builds it (one agent). The item's box:
//   1. The limbo posts go.
//   2. A write an agent makes while holding a phase answered with Andy's lines typed since it took the phase; that join
//      WENT WITH goal/G33.7 (Andy: "why? my lines are streamed to deskClient without any further assistance"), so a
//      phase holder's writes now answer what was asked and nothing more.
//   3. An item stays in the code phase from its Go until Andy presses Done; the agent's own claim that it is done (a
//      verify pass) leaves it in code; within it red, build and verify run as often as needed, Andy's lines reach it
//      without the hold, and the desk sends no JOB offer to take a red while the item is being worked on.
// Point 4 (Levant's take landing) is deskAgent's and is asserted in its own suite.
//
// WHAT IS ASSERTED
//   1  an item going into limbo is still marked limbo, but the desk posts no line under it.
//   2  a phase holder's writes answer without any line of his (goal/G33.7; the stream brings them, deskClientPush.js).
//   3  after a verify pass and before his Done: work.open offers no red (no JOB), and the red is taken again without a
//      line of his; Done is not offered while the new cycle runs.
// rule/11: through testSupport only; its own folders; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G29.10: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskQuickFixesCWAAAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const UBI = { key: 'MCowBQYDK2VwAyEAdeskQuickFixesUbiAAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-ubuntu' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskQuickFixesOwnerAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }

test.startTest('goal/G29.10: no limbo posts, a phase holder hears his lines, code from Go to Done');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskquickfixes-'));
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
async function facts(id) { const r = await call('item.get', { id: id }, ANDY); try { return JSON.parse(r.body.item); } catch (e) { return {}; } }
async function limboLines(id) {
  const r = await call('item.chat', { id: id }, ANDY);
  return ((r.body && r.body.chat) || []).filter(function (l) { return l.by === 'desk' && /^limbo:/.test(String(l.text)); }).length;
}
function ok(r) { return r && r.status === 200; }
async function open(caller) {
  const r = await call('work.open', {}, caller);
  const l = (r.body && (r.body.items || r.body.jobs)) || [];
  return l.map(function (j) { try { return typeof j.label === 'string' ? JSON.parse(j.label) : j; } catch (e) { return j; } })
    .map(function (j) { return (j.id || j.key) + ':' + j.phase; });
}

(async function () {
  // goal/G29.21: an agent's session creates no goal, so the owner writes the world; seeded before the desk starts
  // (goal/G33.7: session.set went).
  test.seedDesk(state, { goal: { id: 'goal/G100', title: 'Quick fixes' }, items: [
    { id: 'goal/G100.1', title: 'Limbo, quietly', blocks: ['goal/G100'], code: true },
    { id: 'goal/G100.2', title: 'A code item', blocks: ['goal/G100'], code: true },
    { id: 'goal/G100.3', title: 'A decision', blocks: ['goal/G100'] },
  ] });
  if (!await start()) { test.fail('the desk server did not start'); return; }
  const ended = await call('press', { id: 'goal/G100', what: 'end-design' }, ANDY);
  const go3 = await call('press', { id: 'goal/G100.3', what: 'go' }, ANDY);
  if (!ok(ended) || !ok(go3)) { test.fail('the world: end-design ' + ended.status + ', Go ' + go3.status); return; }
  // Two agents live, so the desk does not waive the phase rules itself (deskPhases.js).
  await call('item.take', { id: 'goal/G100.3' }, UBI);
  await call('chat.add', { id: 'goal/G100.3', text: 'claude-ubuntu: here, so the phase rules apply.' }, UBI);
  await call('item.release', { id: 'goal/G100.3' }, UBI);

  test.subHeading('1. the limbo posts go');
  const go1 = await call('press', { id: 'goal/G100.1', what: 'go' }, ANDY);
  await call('chat.add', { id: 'goal/G100.3', text: 'any write, so the desk looks again' }, ANDY);
  const f1 = await facts('goal/G100.1');
  const lines1 = await limboLines('goal/G100.1');
  if (ok(go1) && f1.limbo === true) test.check('the world: goal/G100.1 has his Go, nobody on it, and is marked limbo');
  else test.fail('the world: Go ' + go1.status + ', limbo ' + short(f1.limbo));
  if (lines1 === 0) test.check('the desk posted no limbo line under it');
  else test.fail(OWED + 'the desk posted ' + lines1 + ' limbo line(s) under goal/G100.1');

  test.subHeading('2. a phase holder\'s writes answer without his lines (goal/G33.7)');
  const go2 = await call('press', { id: 'goal/G100.2', what: 'go' }, ANDY);
  await call('chat.add', { id: 'goal/G100.2', text: 'before the take' }, ANDY);
  await sleep(5);
  const red = await call('phase.take', { id: 'goal/G100.2', phase: 'red' }, CW);
  if (!ok(go2) || !ok(red)) { test.fail('the world: Go ' + go2.status + ', red take ' + short(red.body || red.status)); return; }
  await sleep(5);
  await call('chat.add', { id: 'goal/G100.2', text: 'make the button blue' }, ANDY);
  await call('chat.add', { id: 'goal/G100.2', text: 'and the frame thinner' }, ANDY);
  const files = await call('item.files.add', { id: 'goal/G100.2', paths: ['spirit/test/zzQuickFixes.js'] }, CW);
  const chat = await call('chat.add', { id: 'goal/G100.2', text: 'blue it is' }, CW);
  if (ok(files) && ok(chat) && !('andy' in files.body) && !('andy' in chat.body)) test.check('its item.files.add and chat.add answered what they were asked, no line of his');
  else test.fail('OWED by goal/G33.7: item.files.add answered ' + short(files.body || files.status) + ', chat.add ' + short(chat.body || chat.status));

  test.subHeading('3. from his Go to his Done the item stays in code');
  const steps = [];
  // A red finishes only after its red claim with suites (goal/G33.11).
  await call('claim', { id: 'goal/G100.2', phase: 'red', commit: 'abcdef1', suites: ['spirit/test/deskQuickFixes.js'] }, CW);
  steps.push((await call('phase.done', { id: 'goal/G100.2', phase: 'red' }, CW)).status);
  steps.push((await call('phase.take', { id: 'goal/G100.2', phase: 'build' }, UBI)).status);
  steps.push((await call('phase.done', { id: 'goal/G100.2', phase: 'build' }, UBI)).status);
  steps.push((await call('phase.take', { id: 'goal/G100.2', phase: 'verify' }, CW)).status);
  steps.push((await call('phase.done', { id: 'goal/G100.2', phase: 'verify', pass: true, why: 'green' }, CW)).status);
  const v0 = await facts('goal/G100.2');
  if (steps.every(function (s) { return s === 200; }) && (v0.buttons || []).indexOf('done') !== -1) test.check('the world: one cycle ran to a verify pass, and Done is offered');
  else { test.fail('the world: the cycle answered ' + short(steps) + ', buttons ' + short(v0.buttons)); return; }
  const offered = await open(CW);
  if (offered.indexOf('goal/G100.2:red') === -1) test.check('work.open offers no red for it: no JOB while it waits for his Done');
  else test.fail(OWED + 'work.open offers ' + short(offered));
  const again = await call('phase.take', { id: 'goal/G100.2', phase: 'red' }, CW);
  const v1 = await facts('goal/G100.2');
  if (ok(again) && v1.phase === 'red' && v1.with === 'claude-windows') test.check('its red is taken again without a line of his: the item is in red, with claude-windows');
  else test.fail(OWED + 'red after the verify pass, with no line of his, answered ' + short(again.body || again.status) + '; phase ' + short(v1.phase));
  if ((v1.buttons || []).indexOf('done') === -1) test.check('while the new cycle runs Done is not offered');
  else test.fail(OWED + 'Done is still offered while the item is back in red: ' + short(v1.buttons));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { kid && kid.kill(); } catch (e) { /* gone */ }
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
