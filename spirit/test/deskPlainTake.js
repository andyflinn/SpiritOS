'use strict';

// goal/G6.9: a plain take never holds a phase, and the status shows the phase being worked. Red on today's tree;
// wsl-claude wrote it from G6.9's box and does not build it.
//   Andy, to G6 Q5 ("add an item to G6 so a plain item take never holds a phase (it blocked G6.1 and G6.6)?"): "add
//   item to fix it."; then "add to this item: when an agent is with an item, update its status with the phase that is
//   running at the time. the desk should do it, since it arbitrase phase-taking."; his Go.
//   What went wrong (the box): item.take sets "with" (desk.js 464), the name phase.take sets (desk.js 467), and
//   mayTake refuses every phase take while "with" is set (desk.js 658); the stale-holder Q fired on a plain taker.
//
// THE SHAPES (the box's):
//   1  after a plain item.take on a code item, phase.take is open to whoever the phase rules allow.
//   2  the phase holder is only what phase.take recorded: the stale-holder Q is raised for a real phase holder, never
//      for a plain taker.
//   3  while an agent holds a phase, the item's status says which: red, build or verify, set by the desk on the take.
// LEFT OPEN, not asserted: the status once a phase is done and nobody holds the next; the box says only "while an agent
// holds a phase".

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G6.9: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskPlainTakeTestCWAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const UBI = { key: 'MCowBQYDK2VwAyEAdeskPlainTakeTestUbiAAAAAAAAAAAAAAAAAAA=', label: 'claude-ubuntu' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskPlainTakeTestWslAAAAAAAAAAAAAAAAAAA=', label: 'wsl-claude' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskPlainTakeTestOwnerAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }

test.startTest('goal/G6.9: a plain take never holds a phase; the status shows the phase');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskplaintake-'));
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

(async function () {
  if (!await start()) { test.fail('the desk server did not start'); return; }
  await call('session.set', { json: JSON.stringify({ goal: { id: 't/G1', title: 'Takes' }, items: [
    { id: 't/G1.1', title: 'Taken plainly, then phased', blocks: ['t/G1'], code: true },
    { id: 't/G1.2', title: 'Taken plainly, then left', blocks: ['t/G1'], code: true },
  ] }) }, CW);
  const ended = await call('press', { id: 't/G1', what: 'end-design' }, ANDY);
  const gos = [];
  for (const id of ['t/G1.1', 't/G1.2']) gos.push((await call('press', { id: id, what: 'go' }, ANDY)).status);
  if (ended.status !== 200 || gos.some(function (s) { return s !== 200; })) { test.fail('the world: end-design answered ' + ended.status + ', his Gos ' + short(gos)); return; }

  test.subHeading('1. a plain take leaves the phases open');
  const plain = await call('item.take', { id: 't/G1.1' }, CW);
  const red = await call('phase.take', { id: 't/G1.1', phase: 'red' }, UBI);
  const a1 = await facts('t/G1.1');
  if (ok(plain) && ok(red) && a1.red === 'claude-ubuntu') test.check('after claude-windows\' plain take, claude-ubuntu takes the red (facts.red claude-ubuntu)');
  else test.fail(OWED + 'plain take ' + plain.status + ', then the red take ' + red.status + ' ' + short(red.body && red.body.code) + '; facts.red ' + short(a1.red));

  test.subHeading('2. the status says the phase being held');
  const statusRed = a1.status;
  await call('phase.done', { id: 't/G1.1', phase: 'red' }, UBI);
  await call('phase.take', { id: 't/G1.1', phase: 'build' }, WSL);
  const statusBuild = (await facts('t/G1.1')).status;
  await call('phase.done', { id: 't/G1.1', phase: 'build' }, WSL);
  await call('phase.take', { id: 't/G1.1', phase: 'verify' }, UBI);
  const a2 = await facts('t/G1.1');
  if (ok(red) && statusRed === 'red' && statusBuild === 'build' && a2.status === 'verify' && a2.verifier === 'claude-ubuntu') test.check('the status reads red, then build, then verify, as each phase is taken');
  else test.fail(OWED + 'status while held: ' + short({ red: statusRed, build: statusBuild, verify: a2.status, verifier: a2.verifier }));

  test.subHeading('3. no stale-holder question for a plain taker');
  await call('item.take', { id: 't/G1.2' }, CW);
  await stop();
  // TWENTY MINUTES AGO for every record of claude-windows': past LIVE_MS (desk.js, 10 minutes), as deskPhases does.
  const db = new DatabaseSync(path.join(state, 'desk.db'));
  db.prepare('UPDATE records SET at = ? WHERE by = ?').run(new Date(Date.now() - 20 * 60 * 1000).toISOString(), CW.label);
  db.close();
  if (!await start()) { test.fail('the desk server did not start again'); return; }
  await call('chat.add', { id: 't/G1.1', text: 'a write, so the desk walks its state' }, WSL);
  await sleep(500);
  const checks = ((await call('item.checks', { id: 't/G1.2' }, ANDY)).body || {}).checks || [];
  const stale = checks.filter(function (c) { return c.kind === 'Q' && /^stale:/.test(String(c.words)); });
  const b = await facts('t/G1.2');
  if (!stale.length && !b.red && !b.builder && !b.verifier) test.check('claude-windows took t/G1.2 plainly and went silent: no stale-holder question, nobody holds a phase');
  else test.fail(OWED + 'a plain taker gone silent: stale questions ' + short(stale.map(function (c) { return c.words; })) + '; phases ' + short({ red: b.red, builder: b.builder, verifier: b.verifier }));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
