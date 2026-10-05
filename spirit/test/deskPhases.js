'use strict';

// goal/G5.7: the job queue on the desk server, so Desk keeps all agents working in parallel. Red on today's tree;
// wsl-claude wrote it from G5.7's capped box and does not build it.
//   Andy, 2026-10-05 (the box holds every line verbatim): "shouldn't a coding item track on deskServer who took the red,
//   when the red is done, the agent doing the red is removed from the with field, then the item becomes takeable for
//   coding, by somebody who didn't do the red, when the coding is done, the verifying can be taken by someone who didn't
//   do the coding."; "each claude can first check for available jobs."; Q3 "an item marked code is the only one i see
//   this for right now."; Q4 "yes."; Q5 "absolutely. with only one agent this must be waved."; Q6 "the deskServer throws
//   a red question."; Q8 "it's the verifier that extends the red"; "the red writer may be the verifier, no rule against
//   that."; "ok:" to "the red's writer may never build that item"; his Go on goal/G5.7.
//
// THE NAMES are wsl-claude's picks (the box names none); the builder may argue them in Desk first:
//   an item is marked code by code: true in session.set; facts carry phase ('red' | 'build' | 'verify' | ''), red,
//   builder, verifier (who did each); phase.take {id, phase}; phase.done {id, phase, pass, why} (pass only for verify);
//   work.open {} answers the open phases the caller may take, [{ id, phase }]; press {id, what: 'waive'}, his alone,
//   lifts the who-may-take rule on that item.
// THE SHAPES (the box's):
//   1  only an item marked code has phases; after his Go it is in red, open.
//   2  a phase take is refused while the phase is held; the taker is recorded and is the item's with.
//   3  finishing a phase clears with and opens the next; the red's writer may not take build; work.open shows each agent
//      only what it may take.
//   4  the builder may not verify; the red's writer may.
//   5  a failed verify goes back to build, to the same builder; nobody else may take that build.
//   6  after an all-green build the verifier may take red again to extend it, never the builder.
//   7  the verifier's pass offers his Done, with no claim-done from the takers.
//   8  his waive lets one agent take every phase of that item.
//   9  a holder gone stale (no word for 10 minutes, the desk's LIVE_MS) puts a red question on the item.
// LEFT OPEN, with the reason, not asserted here:
//   - the commit check's red grant request when an item's red writer commits its build (Q7: "it should trigger a red
//     GRANT request for me."): its shape rides on the verbs above; a section follows once they are built.
//   - a divergence is a red question by the agent who finds it (Q1), which check.add already does: nothing new to test.
//   - past items joining at their phase, the red writer named by hand: how it is named is not shaped yet.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G5.7: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskPhasesTestCWAAAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const UBI = { key: 'MCowBQYDK2VwAyEAdeskPhasesTestUbiAAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-ubuntu' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskPhasesTestWslAAAAAAAAAAAAAAAAAAAAAAA=', label: 'wsl-claude' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskPhasesTestOwnerAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }

test.startTest('goal/G5.7: the job queue, phases red, build and verify');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskphases-'));
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
async function facts(id) { const r = await call('item.get', { id: id }, ANDY); try { return JSON.parse(r.body.item); } catch (e) { return {}; } }
function ok(r) { return r && r.status === 200; }
async function open(caller) {
  const r = await call('work.open', {}, caller);
  const l = (r.body && (r.body.items || r.body.jobs)) || [];
  return l.map(function (j) { try { return typeof j.label === 'string' ? JSON.parse(j.label) : j; } catch (e) { return j; } })
    .map(function (j) { return (j.id || j.key) + ':' + j.phase; });
}

(async function () {
  if (!await start()) { test.fail('the desk server did not start'); return; }
  await call('session.set', { json: JSON.stringify({ goal: { id: 'q/G1', title: 'Queue' }, items: [
    { id: 'q/G1.1', title: 'Code item', blocks: ['q/G1'], code: true },
    { id: 'q/G1.2', title: 'A decision', blocks: ['q/G1'] },
    { id: 'q/G1.3', title: 'One agent alone', blocks: ['q/G1'], code: true },
    { id: 'q/G1.4', title: 'Goes stale', blocks: ['q/G1'], code: true },
  ] }) }, CW);
  for (const id of ['q/G1.1', 'q/G1.2', 'q/G1.3', 'q/G1.4']) await call('press', { id: id, what: 'go' }, ANDY);

  test.subHeading('1. only an item marked code has phases');
  const a0 = await facts('q/G1.1');
  const b0 = await facts('q/G1.2');
  if (a0.phase === 'red' && !b0.phase) test.check('after his Go the code item is in red; the decision item has no phase');
  else test.fail(OWED + 'phases after Go: code item ' + short(a0.phase) + ', decision item ' + short(b0.phase));

  test.subHeading('2. one holder per phase');
  const redCw = await call('phase.take', { id: 'q/G1.1', phase: 'red' }, CW);
  const redUbi = await call('phase.take', { id: 'q/G1.1', phase: 'red' }, UBI);
  const a1 = await facts('q/G1.1');
  if (ok(redCw) && !ok(redUbi) && a1.red === 'claude-windows' && a1.with === 'claude-windows') test.check('claude-windows holds the red; claude-ubuntu\'s take is refused (' + short(redUbi.body && redUbi.body.code) + ')');
  else test.fail(OWED + 'red takes answered ' + redCw.status + ' and ' + redUbi.status + '; facts ' + short({ red: a1.red, with: a1.with }));

  test.subHeading('3. a finished phase opens the next, for those who may take it');
  const redDone = await call('phase.done', { id: 'q/G1.1', phase: 'red' }, CW);
  const a2 = await facts('q/G1.1');
  const openCw = await open(CW);
  const openUbi = await open(UBI);
  const buildCw = await call('phase.take', { id: 'q/G1.1', phase: 'build' }, CW);
  if (ok(redDone) && a2.phase === 'build' && !a2.with && openUbi.indexOf('q/G1.1:build') !== -1 && openCw.indexOf('q/G1.1:build') === -1 && !ok(buildCw)) test.check('red done: build opens, with is cleared; work.open offers it to claude-ubuntu, not to the red\'s writer, whose take is refused');
  else test.fail(OWED + 'after red done: ' + short({ done: redDone.status, phase: a2.phase, with: a2.with, openCw: openCw, openUbi: openUbi, cwBuild: buildCw.status }));

  test.subHeading('4. the builder may not verify; the red\'s writer may');
  await call('phase.take', { id: 'q/G1.1', phase: 'build' }, UBI);
  await call('phase.done', { id: 'q/G1.1', phase: 'build' }, UBI);
  const verUbi = await call('phase.take', { id: 'q/G1.1', phase: 'verify' }, UBI);
  const verCw = await call('phase.take', { id: 'q/G1.1', phase: 'verify' }, CW);
  const a3 = await facts('q/G1.1');
  if (!ok(verUbi) && ok(verCw) && a3.builder === 'claude-ubuntu' && a3.verifier === 'claude-windows') test.check('the builder\'s verify take is refused; the red\'s writer verifies');
  else test.fail(OWED + 'verify takes: builder ' + verUbi.status + ', red writer ' + verCw.status + '; facts ' + short({ phase: a3.phase, builder: a3.builder, verifier: a3.verifier }));

  test.subHeading('5. a failed verify goes back to the same builder');
  const failed = await call('phase.done', { id: 'q/G1.1', phase: 'verify', pass: false, why: 'the retry is not inside' }, CW);
  const a4 = await facts('q/G1.1');
  const buildWsl = await call('phase.take', { id: 'q/G1.1', phase: 'build' }, WSL);
  if (ok(failed) && a4.phase === 'build' && a4.builder === 'claude-ubuntu' && !ok(buildWsl)) test.check('back in build, its builder still claude-ubuntu; another agent\'s build take is refused');
  else test.fail(OWED + 'after a failed verify: ' + short({ done: failed.status, phase: a4.phase, builder: a4.builder, wslBuild: buildWsl.status }));

  test.subHeading('6. after an all-green build the verifier may grow the red, never the builder');
  await call('phase.take', { id: 'q/G1.1', phase: 'build' }, UBI);
  await call('phase.done', { id: 'q/G1.1', phase: 'build' }, UBI);
  const growUbi = await call('phase.take', { id: 'q/G1.1', phase: 'red' }, UBI);
  const growCw = await call('phase.take', { id: 'q/G1.1', phase: 'red' }, CW);
  const a5 = await facts('q/G1.1');
  if (!ok(growUbi) && ok(growCw) && a5.phase === 'red') test.check('the builder\'s red take is refused; the verifier takes the red to extend it');
  else test.fail(OWED + 'growing the red: builder ' + growUbi.status + ', verifier ' + growCw.status + '; phase ' + short(a5.phase));

  test.subHeading('7. the verifier\'s pass offers his Done, no claims needed');
  await call('phase.done', { id: 'q/G1.1', phase: 'red' }, CW);
  await call('phase.take', { id: 'q/G1.1', phase: 'build' }, UBI);
  await call('phase.done', { id: 'q/G1.1', phase: 'build' }, UBI);
  await call('phase.take', { id: 'q/G1.1', phase: 'verify' }, CW);
  const passed = await call('phase.done', { id: 'q/G1.1', phase: 'verify', pass: true }, CW);
  const a6 = await facts('q/G1.1');
  if (ok(passed) && (a6.buttons || []).indexOf('done') !== -1 && a6.claims === 0) test.check('verify passed: Done is offered with no claim-done pressed');
  else test.fail(OWED + 'after a passing verify: ' + short({ done: passed.status, buttons: a6.buttons, claims: a6.claims, phase: a6.phase }));

  test.subHeading('8. his waive lets one agent take every phase');
  const refusedBefore = await (async function () {
    await call('phase.take', { id: 'q/G1.3', phase: 'red' }, WSL);
    await call('phase.done', { id: 'q/G1.3', phase: 'red' }, WSL);
    return call('phase.take', { id: 'q/G1.3', phase: 'build' }, WSL);
  }());
  const waived = await call('press', { id: 'q/G1.3', what: 'waive' }, ANDY);
  const agentWaive = await call('press', { id: 'q/G1.4', what: 'waive' }, CW);
  const buildAfter = await call('phase.take', { id: 'q/G1.3', phase: 'build' }, WSL);
  await call('phase.done', { id: 'q/G1.3', phase: 'build' }, WSL);
  const verifyAfter = await call('phase.take', { id: 'q/G1.3', phase: 'verify' }, WSL);
  if (!ok(refusedBefore) && ok(waived) && !ok(agentWaive) && ok(buildAfter) && ok(verifyAfter)) test.check('before his waive the red\'s writer may not build; after it, one agent builds and verifies; an agent\'s waive is refused');
  else test.fail(OWED + 'waive: ' + short({ before: refusedBefore.status, waive: waived.status, agentWaive: agentWaive.status, build: buildAfter.status, verify: verifyAfter.status }));

  test.subHeading('9. a holder gone stale raises a red question');
  await call('phase.take', { id: 'q/G1.4', phase: 'red' }, UBI);
  await stop();
  // TWENTY MINUTES AGO for every record of claude-ubuntu's: past LIVE_MS (desk.js, 10 minutes), as deskKnownAgents does.
  const db = new DatabaseSync(path.join(state, 'desk.db'));
  db.prepare('UPDATE records SET at = ? WHERE by = ?').run(new Date(Date.now() - 20 * 60 * 1000).toISOString(), UBI.label);
  db.close();
  await start();
  await call('chat.add', { id: 'q/G1.1', text: 'a write, so the desk walks its state' }, CW);
  await sleep(500);
  const checks = ((await call('item.checks', { id: 'q/G1.4' }, ANDY)).body || {}).checks || [];
  const raised = checks.some(function (c) { return c.kind === 'Q' && c.state === 'open'; });
  if (raised) test.check('claude-ubuntu silent for 20 minutes while holding the red: an open red question is on the item');
  else test.fail(OWED + 'a stale holder left no red question; checks ' + short(checks));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
