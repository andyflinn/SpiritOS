'use strict';

// spirit/test/deskPhaseRestart.js
// goal/G27.19: phases remain re-takable until done is pressed by the user. Red on today's tree; claude-windows writes it
// and builds it (one agent). The item's box:
//   An item's phases remain re-takable until the user presses Done: a verify pass does not end the cycle, and while Done
//   is not pressed red is offered again, so a complaint about an item is answered inside that item, not with new items.
//   Today mayTake in spirit/run/process/js/desk/desk.js offers red only while the phase is red or verify; after a verify
//   pass the phase is empty and every phase.take is refused as not offered, even after Reopen or close and reopen.
//   A new red on a verified item starts a fresh red, build, verify cycle under the same item, its Go standing.
// Andy, 2026-10-17, in goal/G27.2's chat: "the desk should allow any restart of phases as long as 'done' is not
// pressed", and "Just because 'Done' is offered doesn't mean it's fucking done....".
//
// WHAT IS ASSERTED
//   1  after a verify pass, before Done, red is taken again (no job in work.open since goal/G29.10): phase red, its
//      taker recorded, the item no longer verified, so Done is not offered while the new cycle runs.
//   2  the new cycle runs to its end under the same item: build, then verify, then Done is offered again.
//   3  once he presses Done no phase is offered or taken.
//   4  his Reopen of a done item lets red be taken again.
// Two agents, so the who-may-take rules of goal/G5.7 stay in force (deskPhases.js); the world is that suite's.
// rule/11: through testSupport only; its own folders; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G27.19: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskPhaseRestartCWAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const UBI = { key: 'MCowBQYDK2VwAyEAdeskPhaseRestartUbiAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-ubuntu' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskPhaseRestartOwnerAAAAAAAAAAAAAAAAAA=', label: 'andy' };
const ID = 'goal/G100.1';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }

test.startTest('goal/G27.19: phases remain re-takable until done is pressed');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskphaserestart-'));
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
function ok(r) { return r && r.status === 200; }
async function open(caller) {
  const r = await call('work.open', {}, caller);
  const l = (r.body && (r.body.items || r.body.jobs)) || [];
  return l.map(function (j) { try { return typeof j.label === 'string' ? JSON.parse(j.label) : j; } catch (e) { return j; } })
    .map(function (j) { return (j.id || j.key) + ':' + j.phase; });
}
// One whole cycle: red by claude-windows, build by claude-ubuntu, verify by claude-windows with a pass.
async function cycle(redTaken) {
  const steps = [];
  if (!redTaken) steps.push((await call('phase.take', { id: ID, phase: 'red' }, CW)).status);
  // A red finishes only after its red claim with suites (goal/G33.11).
  await call('claim', { id: ID, phase: 'red', commit: 'abcdef1', suites: ['spirit/test/deskPhaseRestart.js'] }, CW);
  steps.push((await call('phase.done', { id: ID, phase: 'red' }, CW)).status);
  steps.push((await call('phase.take', { id: ID, phase: 'build' }, UBI)).status);
  steps.push((await call('phase.done', { id: ID, phase: 'build' }, UBI)).status);
  steps.push((await call('phase.take', { id: ID, phase: 'verify' }, CW)).status);
  steps.push((await call('phase.done', { id: ID, phase: 'verify', pass: true, why: 'green' }, CW)).status);
  return steps;
}

(async function () {
  // goal/G29.21: an agent's session creates no goal, so the owner writes the world. goal/G33.7: session.set went; it is
  // seeded before the desk starts, which takes it in at start.
  test.seedDesk(state, { goal: { id: 'goal/G100', title: 'Restart' }, items: [
    { id: ID, title: 'Code item', blocks: ['goal/G100'], code: true },
    { id: 'goal/G100.2', title: 'A decision', blocks: ['goal/G100'] },
  ] });
  if (!await start()) { test.fail('the desk server did not start'); return; }
  const ended = await call('press', { id: 'goal/G100', what: 'end-design' }, ANDY);
  const go1 = await call('press', { id: ID, what: 'go' }, ANDY);
  const go2 = await call('press', { id: 'goal/G100.2', what: 'go' }, ANDY);
  if (!ok(ended) || !ok(go1) || !ok(go2)) { test.fail('the world: end-design ' + ended.status + ', Gos ' + go1.status + ' ' + go2.status); return; }
  // Two agents live, so the desk does not waive the phase rules itself (deskPhases.js).
  await call('item.take', { id: 'goal/G100.2' }, UBI);
  await call('chat.add', { id: 'goal/G100.2', text: 'claude-ubuntu: here, so the phase rules apply.' }, UBI);
  await call('item.release', { id: 'goal/G100.2' }, UBI);

  const first = await cycle(false);
  const v0 = await facts(ID);
  if (first.some(function (s) { return s !== 200; }) || (v0.buttons || []).indexOf('done') === -1) { test.fail('the world: the first cycle answered ' + short(first) + ', buttons ' + short(v0.buttons)); return; }
  test.check('the world: one cycle ran to a verify pass, and Done is offered');

  // goal/G29.10 replaced the hold of goal/G27.20: the item stays in code from his Go to his Done, so after a verify
  // pass its red is no job (work.open) and is taken again with no line of his (deskQuickFixes.js).
  test.subHeading('1. after a verify pass, before Done, red is taken again');
  const offered = await open(CW);
  const again = await call('phase.take', { id: ID, phase: 'red' }, CW);
  const v1 = await facts(ID);
  if (offered.indexOf(ID + ':red') === -1) test.check('work.open does not list it: no listener is handed it as a job');
  else test.fail('OWED by goal/G29.10: after the verify pass work.open offers ' + short(offered));
  if (ok(again) && v1.phase === 'red' && v1.with === 'claude-windows') test.check('the red take lands: the item is in red again, with claude-windows');
  else test.fail(OWED + 'red after the verify pass answered ' + short(again.body || again.status) + '; phase ' + short(v1.phase) + ', with ' + short(v1.with));
  if ((v1.buttons || []).indexOf('done') === -1) test.check('while the new cycle runs Done is not offered');
  else test.fail(OWED + 'Done is still offered while the item is back in red: ' + short(v1.buttons));

  test.subHeading('2. the new cycle runs to its end under the same item');
  const second = ok(again) ? await cycle(true) : ['red not taken'];
  const v2 = await facts(ID);
  if (second.every(function (s) { return s === 200; }) && (v2.buttons || []).indexOf('done') !== -1 && v2.id === ID) test.check('red, build and verify ran again under ' + ID + ', and Done is offered again');
  else test.fail(OWED + 'the second cycle answered ' + short(second) + ', buttons ' + short(v2.buttons));

  test.subHeading('3. once he presses Done, no phase is taken');
  const done = await call('press', { id: ID, what: 'done' }, ANDY);
  const afterDone = await call('phase.take', { id: ID, phase: 'red' }, CW);
  const openDone = await open(CW);
  if (ok(done) && !ok(afterDone) && openDone.indexOf(ID + ':red') === -1) test.check('after his Done the red take is refused and not offered');
  else test.fail((ok(done) ? OWED : 'the world: ') + 'Done answered ' + done.status + ', red after it ' + afterDone.status + ', offered ' + short(openDone));

  test.subHeading('4. his Reopen lets red be taken again');
  const reopen = await call('press', { id: ID, what: 'reopen' }, ANDY);
  const afterReopen = await call('phase.take', { id: ID, phase: 'red' }, CW);
  const v4 = await facts(ID);
  if (ok(reopen) && ok(afterReopen) && v4.phase === 'red') test.check('after his Reopen red is taken again');
  else test.fail(OWED + 'Reopen answered ' + reopen.status + ', red after it ' + short(afterReopen.body || afterReopen.status) + ', phase ' + short(v4.phase));

  // goal/G27.2, D11. Andy, 2026-10-17: "make that press queue it.": the verify pass sets the item back to waiting for
  // deskVerify, so the desk writes the item's claimed commit on the pass's record, and deskVerify queues its check at
  // that commit (deskClaimCommit.js asserts deskVerify's half).
  test.subHeading('5. a verify pass carries the item\'s claimed commit');
  const COMMIT = 'abcdef1234567890abcdef1234567890abcdef12';
  const s5 = [];
  // A red finishes only after its red claim with suites (goal/G33.11).
  await call('claim', { id: ID, phase: 'red', commit: 'abcdef1', suites: ['spirit/test/deskPhaseRestart.js'] }, CW);
  s5.push((await call('phase.done', { id: ID, phase: 'red' }, CW)).status);
  s5.push((await call('phase.take', { id: ID, phase: 'build' }, UBI)).status);
  s5.push((await call('claim', { id: ID, phase: 'build', commit: COMMIT }, UBI)).status);
  s5.push((await call('phase.done', { id: ID, phase: 'build' }, UBI)).status);
  s5.push((await call('phase.take', { id: ID, phase: 'verify' }, CW)).status);
  s5.push((await call('phase.done', { id: ID, phase: 'verify', pass: true }, CW)).status);
  // goal/G33.4: no log of writes to read the pass record from; the item itself keeps the claimed commit through its
  // verify pass, and the run his Verify hands over carries it (desk.js handOver).
  let lastPass = {};
  try { lastPass = JSON.parse(((await call('item.get', { id: ID }, ANDY)).body || {}).item) || {}; } catch (e) { lastPass = {}; }
  if (s5.every(function (x) { return x === 200; }) && lastPass.claimCommit === COMMIT && lastPass.verified !== undefined) test.check('after the verify pass the item still carries the claimed commit ' + COMMIT.slice(0, 8));
  else test.fail('OWED by goal/G27.2: the steps answered ' + short(s5) + '; after the verify pass the item reads ' + short({ claimCommit: lastPass.claimCommit }));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { kid && kid.kill(); } catch (e) { /* gone */ }
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
