'use strict';

// goal/G9.13: adding an item never changes the current goal. Red on today's tree; claude-windows wrote it from
// G9.13's box and does not build it.
//   Andy, 2026-10-09, under goal/G9: "An item added to another goal should NOT change a goal." and "cw: Add an item to
//   this goal to that effect.", after cw added goal/G8.8 through session.set and his current goal moved from G9 to G8.
//
// WHAT IS TRUE TODAY (read in the tree at 7cd6d633): the session.set branch of the walk ends `s.current = gid`
// (process/js/desk/desk.js), so writing a goal's items makes that goal current, whichever goal was current before.
//
// WHAT IS ASSERTED, and only that: with a current goal standing, an add to ANOTHER goal leaves the current one where
// it is, and the add itself still lands. Whether the very first goal on an empty desk becomes current is not his
// ruling and is not asserted here. item.add (goal/G9.9) is held to the same in deskIds.js.
//
// FOR THE BUILDER: deskMakeCurrent.js opens with "the goal written last is the current one, as session.set leaves
// it", the behaviour this item removes; that world line moves with the build.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/spirit/appClient.js');

const OWED = 'OWED by goal/G9.13: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskAddKeepsCurrentTestCWAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskAddKeepsCurrentTestOwnerAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }

test.startTest('goal/G9.13: adding an item never changes the current goal');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskaddkeepscurrent-'));
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
async function factsOf(id) { const r = await call('item.get', { id: id }, ANDY); return parse(r.body && r.body.item) || {}; }
// The current goal, read the way the List reads it (as deskMakeCurrent.js does).
async function currentGoal() {
  const r = await call('items.search', { text: '', currentGoalOnly: true, goalsOnly: true, includeClosed: false }, ANDY);
  const rows = ((r.body && r.body.items) || []).map(function (i) { return parse(i.label) || {}; });
  return rows.length ? String(rows[0].id) : '';
}
// goal/G33.7: session.set went; a session is seeded before the desk starts (test.seedDesk), or its effect written
// through goal.add and item.add (test.deskSession).
function session(goal, title, items) {
  return { goal: { id: goal, title: title }, items: items.map(function (x) { return { id: x[0], title: x[1], blocks: [goal] }; }) };
}
const ask = function (verb, args, caller) { return call(verb, args, caller); };

(async function () {
  // THE WORLD: two goals, and his press making the first one current, so the current goal is his choice and not the
  // order things were written in.
  // goal/G29.21: an agent's session creates no goal, so Andy writes the world.
  test.seedDesk(state, [session('goal/G100', 'Current', [['goal/G100.1', 'One']]), session('goal/G101', 'Other', [['goal/G101.1', 'Two']])]);
  if (!await start()) { test.fail('the desk server did not start'); return; }
  const press = await call('press', { id: 'goal/G100', what: 'make-current' }, ANDY);
  const before = await currentGoal();
  if (took(press) && before === 'goal/G100') test.check('the world: his make-current leaves goal/G100 current');
  else { test.fail('the world: make-current answered ' + press.status + ' ' + short(press.body) + '; current reads ' + short(before)); return; }

  test.subHeading('1. an item added to another goal leaves the current goal where it is');
  // goal/G29.21: cw's add needs his "add item", written in goal/G101.
  await call('chat.add', { id: 'goal/G101', text: 'add item' }, ANDY);
  const add = await test.deskSession(ask, session('goal/G101', 'Other', [['goal/G101.1', 'Two'], ['goal/G101.2', 'Added']]), CW);
  const added = await factsOf('goal/G101.2');
  if (add.ok && added.id === 'goal/G101.2' && added.goal === 'goal/G101') test.check('the add itself lands: goal/G101.2 is an item of goal/G101');
  else test.fail('the add did not land, so nothing below means anything: ' + short(add.why) + '; goal/G101.2 reads ' + short(added));
  const after = await currentGoal();
  if (after === 'goal/G100') test.check('goal/G100 is still the current goal after the add to goal/G101');
  else test.fail(OWED + 'the add to goal/G101 moved the current goal to ' + short(after));

  test.subHeading('2. the goal added to does not take make-current away from him');
  const f2 = await factsOf('goal/G101');
  if ((f2.buttons || []).indexOf('make-current') !== -1) test.check('goal/G101, not current, still offers him make-current');
  else test.fail(OWED + 'after the add goal/G101 offers ' + short(f2.buttons) + ', as if it were current');

  test.subHeading('3. an add to the current goal itself keeps it current');
  // goal/G29.21: cw's add needs his "add item", written in goal/G100.
  await call('chat.add', { id: 'goal/G100', text: 'add item' }, ANDY);
  await test.deskSession(ask, session('goal/G100', 'Current', [['goal/G100.1', 'One'], ['goal/G100.2', 'Also added']]), CW);
  const same = await currentGoal();
  const g12 = await factsOf('goal/G100.2');
  if (same === 'goal/G100' && g12.id === 'goal/G100.2') test.check('goal/G100.2 lands and goal/G100 stays current');
  else test.fail('an add to the current goal: current reads ' + short(same) + ', goal/G100.2 reads ' + short(g12));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
