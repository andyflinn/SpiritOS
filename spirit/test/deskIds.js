'use strict';

// goal/G9.9: the desk owns goal and item ids. Red on today's tree; claude-windows wrote it from G9.9's box and does
// not build it.
//   Andy, 2026-10-07: "the desk owns (is in charge of) goal and item ID's.", and on Q1 (do agents keep naming ids):
//   "why should the agents need to, they can use the same api's the user needs to create them."
//
// WHAT IS TRUE TODAY (read in the tree at 7cd6d633): the only way to create a goal or an item is session.set, and the
// caller names every id in its json. There is no goal.add and no item.add.
//
// THE SHAPE ASSERTED, the red writer's reading of the box, for the builder to hold:
//   goal.add {title}         -> {id, change}   the next goal/G<n>, n one past the highest goal/G number the desk holds
//   item.add {goal, title}   -> {id, change}   the next <goal>.<n>, n one past the highest member, closed ones counted
// Nobody names an id: an `id` argument is refused. A new item blocks its goal (the List's plain case; G9.10 adds the
// blocking-item form). The same verbs serve him and the agents. An add never moves the current goal (goal/G9.13).
// Not asserted: whether session.set mints too; G9.9's box leaves the bulk call to rule/9.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G9.9: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskIdsTestCWAAAAAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskIdsTestOwnerAAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }

test.startTest('goal/G9.9: the desk owns goal and item ids');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskids-'));
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
// A refusal counts only once the verb exists: today's no-such-verb refuses everything and proves nothing.
function refusedByVerb(r) { return !took(r) && !(r.body && r.body.code === 'no-such-verb'); }
async function facts(id) { const r = await call('item.get', { id: id }, ANDY); return parse(r.body && r.body.item) || {}; }
async function currentGoal() {
  const r = await call('items.search', { text: '', currentGoalOnly: true, goalsOnly: true, includeClosed: false }, ANDY);
  const rows = ((r.body && r.body.items) || []).map(function (i) { return parse(i.label) || {}; });
  return rows.length ? String(rows[0].id) : '';
}

(async function () {
  if (!await start()) { test.fail('the desk server did not start'); return; }
  // THE WORLD, written the old way: goal/G3 with two items, and a goal of another area that must not count.
  await call('session.set', { json: JSON.stringify({ goal: { id: 'other/G7', title: 'Another area' }, items: [] }) }, CW);
  await call('session.set', { json: JSON.stringify({ goal: { id: 'goal/G3', title: 'Old' }, items: [
    { id: 'goal/G3.1', title: 'One', blocks: ['goal/G3'] }, { id: 'goal/G3.2', title: 'Two', blocks: ['goal/G3'] }] }) }, CW);
  if ((await facts('goal/G3.2')).id === 'goal/G3.2' && await currentGoal() === 'goal/G3') test.check('the world: goal/G3 with two items, current');
  else { test.fail('the world did not land: ' + short(await facts('goal/G3.2'))); return; }

  test.subHeading('1. goal.add mints the next goal id and answers it');
  const g = await call('goal.add', { title: 'Made by him' }, ANDY);
  const gid = g.body && g.body.id;
  if (took(g) && gid === 'goal/G4') test.check('his goal.add answers goal/G4, one past goal/G3');
  else test.fail(OWED + 'goal.add answered ' + g.status + ' ' + short(g.body));
  const gf = await facts('goal/G4');
  if (gf.id === 'goal/G4' && gf.title === 'Made by him' && gf.goal === '') test.check('goal/G4 is a goal, with his title');
  else test.fail(OWED + 'goal/G4 reads ' + short(gf));
  const g2 = await call('goal.add', { title: 'Made by an agent' }, CW);
  if (took(g2) && g2.body.id === 'goal/G5') test.check('an agent\'s goal.add answers goal/G5: the same verb, the next id');
  else test.fail(OWED + 'the agent\'s goal.add answered ' + g2.status + ' ' + short(g2.body));

  test.subHeading('2. item.add mints the next item id in that goal and answers it');
  const i1 = await call('item.add', { goal: 'goal/G3', title: 'Third' }, ANDY);
  if (took(i1) && i1.body.id === 'goal/G3.3') test.check('item.add in goal/G3 answers goal/G3.3');
  else test.fail(OWED + 'item.add answered ' + i1.status + ' ' + short(i1.body));
  const f3 = await facts('goal/G3.3');
  if (f3.goal === 'goal/G3' && f3.title === 'Third' && (f3.blocking || []).join() === 'goal/G3') test.check('goal/G3.3 is goal/G3\'s, titled, and blocks its goal');
  else test.fail(OWED + 'goal/G3.3 reads ' + short({ goal: f3.goal, title: f3.title, blocking: f3.blocking }));
  const i2 = await call('item.add', { goal: 'goal/G4', title: 'First of the new goal' }, CW);
  if (took(i2) && i2.body.id === 'goal/G4.1') test.check('the first item of goal/G4 is goal/G4.1, added by an agent');
  else test.fail(OWED + 'item.add in goal/G4 answered ' + i2.status + ' ' + short(i2.body));

  test.subHeading('3. a closed member still counts, so an id is never handed out twice');
  await call('press', { id: 'goal/G3.3', what: 'close' }, ANDY);
  const i3 = await call('item.add', { goal: 'goal/G3', title: 'After a close' }, ANDY);
  if (took(i3) && i3.body.id === 'goal/G3.4') test.check('after goal/G3.3 is closed the next add is goal/G3.4');
  else test.fail(OWED + 'after the close item.add answered ' + i3.status + ' ' + short(i3.body));

  test.subHeading('4. nobody names an id');
  const named = await call('item.add', { goal: 'goal/G3', title: 'Named', id: 'goal/G3.99' }, CW);
  if (refusedByVerb(named) && !(await facts('goal/G3.99')).id) test.check('item.add with an id is refused, and goal/G3.99 does not exist');
  else test.fail(OWED + 'item.add with an id answered ' + named.status + ' ' + short(named.body));
  const namedGoal = await call('goal.add', { title: 'Named', id: 'goal/G99' }, ANDY);
  if (refusedByVerb(namedGoal) && !(await facts('goal/G99')).id) test.check('goal.add with an id is refused');
  else test.fail(OWED + 'goal.add with an id answered ' + namedGoal.status + ' ' + short(namedGoal.body));
  const nowhere = await call('item.add', { goal: 'goal/G42', title: 'Orphan' }, CW);
  if (refusedByVerb(nowhere)) test.check('item.add to a goal the desk does not hold is refused');
  else test.fail(OWED + 'item.add to goal/G42 answered ' + nowhere.status + ' ' + short(nowhere.body));

  test.subHeading('5. an add moves nothing he chose (goal/G9.13)');
  const cur = await currentGoal();
  if (cur === 'goal/G3' && took(i1)) test.check('after every add above, goal/G3 is still the current goal');
  else test.fail(OWED + (took(i1) ? 'the adds moved the current goal to ' + short(cur) : 'no add landed, so nothing was held to it'));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
