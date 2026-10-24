'use strict';

// goal/G8.5: the two changes the desk owes deskVerify - signoff, and Done waiting on every grant. Red on today's
// tree; wsl-claude wrote it from G8.5's box and does not build it.
//   Andy, 2026-10-06: "the signoff verb is \"signoff\"", for an agent that is going instead of being waited out, since
//   absence is ten minutes of silence; and, 2026-10-09, when an agent is silent that long: "consider it gone. it would
//   have taken up the task otherwise, wouldn't it?"
//   Andy, 2026-10-09, under goal/G8.8: "'Done' needs all grants approved."
//
// WHAT IS TRUE TODAY (read at 7e4947f8): there is no signoff; an agent counts as live for ten minutes after its last
// write (desk.js liveAgents) whether it is still here or not, and a phase it holds stays held. Done is offered in
// buttons() with no regard for open grants, so an item with a core grant he has not pressed still offers Done.
//
// THE SHAPE ASSERTED:
//   signoff {} -> {change}: the caller is gone at once - the goal's facts stop naming it live and working, and any
//   phase it holds is freed, so the other agent may take that phase (his ruling: a gone agent holds no step). Its next
//   write brings it back, because liveness is what an agent's writes say.
//   Done: an item with any open G check offers no done, and offers it once every grant is granted. It reaches every
//   item, not only the ones deskVerify touches.
//
// SAID PLAINLY: two of the green checks pass today only because nothing happens - "a write after a signoff makes it
// live again" (it never stopped being live) and "granted, Done is offered again" (Done is always offered). They are
// here because they bite once the build lands, and they are not evidence of anything now; the six reds are the work.
//
// NOT ASSERTED, and why: the third change in the box, telling deskVerify when a status moves, needs nothing built.
// Since goal/G33.4 deskVerify follows no desk: it asks the desk nothing, and the desk reads the verifier's results
// through its search (`changes`, which this suite asserted here before, is gone). Nothing is owed, so this suite
// asserts that rather than owing it.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G8.5: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskSignoffGrantsTestCWAAAAAAAAAAAAAA=', label: 'claude-windows' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskSignoffGrantsTestWSLAAAAAAAAAAAAA=', label: 'wsl-claude' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskSignoffGrantsTestOwnerAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }
function took(r) { return r.status === 200 && r.body && r.body.ok !== false; }
// A refusal counts only once the verb exists: no-such-verb refuses everything and proves nothing.
function refusedByVerb(r) { return !took(r) && !(r.body && r.body.code === 'no-such-verb'); }

test.startTest('goal/G8.5: signoff, and Done waiting on every grant');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desksignoff-'));
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
async function facts(id) { const r = await call('item.get', { id: id }, ANDY); return parse(r.body && r.body.item) || {}; }

(async function () {
  // A goal with one code item, his Go on it, and both agents live by having written. goal/G33.7: session.set went; the
  // world is seeded before the desk starts, which takes it in at start.
  test.seedDesk(state, { goal: { id: 'goal/G100', title: 'Signoff' }, items: [
    { id: 'goal/G100.1', title: 'A code item', blocks: ['goal/G100'], code: true },
    { id: 'goal/G100.2', title: 'Another', blocks: ['goal/G100'], code: true }] });
  if (!await start()) { test.fail('the desk server did not start'); return; }
  await call('press', { id: 'goal/G100', what: 'end-design' }, ANDY);
  await call('press', { id: 'goal/G100.1', what: 'go' }, ANDY);
  await call('agent.state', { word: 'working' }, CW);
  await call('agent.state', { word: 'listening' }, WSL);
  const g0 = await facts('goal/G100');
  if ((g0.live || []).indexOf('claude-windows') !== -1 && (g0.live || []).indexOf('wsl-claude') !== -1) test.check('the world: both agents are live, and goal/G100.1 has his Go');
  else { test.fail('the world: live reads ' + short(g0.live)); return; }

  test.subHeading('1. signoff takes an agent out at once');
  await call('phase.take', { id: 'goal/G100.1', phase: 'red' }, CW);
  const held = await facts('goal/G100.1');
  if (held.with === 'claude-windows') test.check('the world: claude-windows holds the red of goal/G100.1');
  else { test.fail('the world: the phase reads ' + short({ with: held.with, phase: held.phase })); return; }
  const bye = await call('signoff', {}, CW);
  if (took(bye)) test.check('signoff is taken');
  else test.fail(OWED + 'signoff answered ' + bye.status + ' ' + short(bye.body));
  const g1 = await facts('goal/G100');
  if ((g1.live || []).indexOf('claude-windows') === -1) test.check('the goal stops naming it live, though it wrote a moment ago');
  else test.fail(OWED + 'live still reads ' + short(g1.live));
  if ((g1.working || []).indexOf('claude-windows') === -1) test.check('and stops naming it working');
  else test.fail(OWED + 'working still reads ' + short(g1.working));

  test.subHeading('2. a gone agent holds no step');
  const freed = await facts('goal/G100.1');
  if (!freed.with) test.check('the phase it held is free');
  else test.fail(OWED + 'the phase is still with ' + short(freed.with));
  const mine = await call('phase.take', { id: 'goal/G100.1', phase: 'red' }, WSL);
  if (took(mine) && (await facts('goal/G100.1')).with === 'wsl-claude') test.check('the other agent takes that phase');
  else test.fail(OWED + 'the take answered ' + mine.status + ' ' + short(mine.body));

  test.subHeading('3. its next write brings it back');
  await call('agent.state', { word: 'listening' }, CW);
  const g2 = await facts('goal/G100');
  if ((g2.live || []).indexOf('claude-windows') !== -1) test.check('a write after a signoff makes it live again');
  else test.fail(OWED + 'after writing again, live reads ' + short(g2.live));

  test.subHeading('4. Done waits on every grant');
  // goal/G100.2 gets his Go, a red, a build and a verify pass, so Done rests on nothing but the grant.
  await call('press', { id: 'goal/G100.2', what: 'go' }, ANDY);
  // Since goal/G21.4 an agent holds one task at a time: wsl-claude lets the red of goal/G100.1 (section 2) go first.
  await call('item.release', { id: 'goal/G100.1' }, WSL);
  await call('phase.take', { id: 'goal/G100.2', phase: 'red' }, CW);
  // A red finishes only after its red claim with suites (goal/G33.11). goal/G40.3: the suite is a row added first, the claim carries none.
  await call('item.suites.add', { id: 'goal/G100.2', path: 'spirit/test/deskSignoffGrants.js' }, CW); await call('claim', { id: 'goal/G100.2', phase: 'red', commit: 'abcdef1' }, CW);
  await call('phase.done', { id: 'goal/G100.2', phase: 'red' }, CW);
  await call('phase.take', { id: 'goal/G100.2', phase: 'build' }, WSL);
  await call('phase.done', { id: 'goal/G100.2', phase: 'build' }, WSL);
  await call('phase.take', { id: 'goal/G100.2', phase: 'verify' }, CW);
  await call('phase.done', { id: 'goal/G100.2', phase: 'verify', pass: true }, CW);
  const ready = await facts('goal/G100.2');
  if ((ready.buttons || []).indexOf('done') !== -1) test.check('the world: with its verify passed, goal/G100.2 offers Done');
  else { test.fail('the world: goal/G100.2 offers ' + short(ready.buttons)); return; }
  await call('check.add', { id: 'goal/G100.2', kind: 'G', words: 'core grant: spirit/run/js/kernel.js', test: '' }, CW);
  const withGrant = await facts('goal/G100.2');
  if ((withGrant.buttons || []).indexOf('done') === -1) test.check('an open grant takes Done away');
  else test.fail(OWED + 'with a grant open it still offers ' + short(withGrant.buttons));
  const g = await call('item.checks', { id: 'goal/G100.2' }, ANDY);
  const number = (((g.body && g.body.checks) || []).filter(function (c) { return c.kind === 'G'; })[0] || {}).number;
  await call('check.set', { id: 'goal/G100.2', check: number, state: 'granted' }, ANDY);
  const granted = await facts('goal/G100.2');
  if ((granted.buttons || []).indexOf('done') !== -1) test.check('granted, Done is offered again');
  else test.fail(OWED + 'after the grant it offers ' + short(granted.buttons));

  // goal/G33.4: `changes` is gone (the desk streams its rows), and deskVerify follows no desk at all: it asks the desk
  // nothing, and the desk reads the verifier's results through its search. So nothing is owed for following either.
  test.subHeading('5. deskVerify needs nothing to follow the desk');
  const ch = await call('changes', { n: 0, line: 0 }, ANDY);
  const verifier = fs.readFileSync(path.join(__dirname, '..', 'run', 'process', 'js', 'deskVerify', 'deskVerify.js'), 'utf8')
    .split(/\r?\n/).filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n');
  const asksDesk = /forNode\([^)]*['"]desk['"]|forPeer\([^)]*['"]desk['"]|\{\s*desk\s*:\s*\{/.test(verifier);
  if (!took(ch) && ch.body && ch.body.code === 'no-such-verb' && !asksDesk) test.check('changes is gone from the desk, and deskVerify asks the desk nothing');
  else test.fail('changes answered ' + ch.status + ' ' + short(ch.body) + '; deskVerify asks the desk: ' + asksDesk);
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
