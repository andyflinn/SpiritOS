'use strict';

// goal/G24.9: Andy deletes an item that no longer serves him from its item details, without switching the goal into
// design mode. Red on today's tree; claude-windows wrote it from G24.9's box.
//
// WHAT IS TRUE TODAY: buttons() in desk.js offers delete only while the item's goal is in design mode (goal/G9.7), and
// item.delete is refused whenever the button is not offered. So out of design mode nothing can be deleted.
//
// THE SHAPE ASSERTED (G24.9's box): delete is offered on any item that is not a goal, whatever the goal's design mode,
// except while an agent holds a phase on it (red, build or verify), and except on an item claimed done and not yet
// closed. The button and the verb share one rule. Delete erases nothing (goal/G9.7): the item is closed and left out,
// keeps its box, checks and chat, blocks nothing, and Include Closed finds it. The armed button in the dialog exists
// already (spirit/test/deskDelete.js covers it); only the server's rule changes.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G24.9: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskDelOutDesignTestCWAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const UBI = { key: 'MCowBQYDK2VwAyEAdeskDelOutDesignTestUbiAAAAAAAAAAAAAAAA=', label: 'claude-ubuntu' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskDelOutDesignTestOwnerAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }

test.startTest('goal/G24.9: delete an item out of design mode, never while a phase is held or a claim is open');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskdeloutdesign-'));
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
function refused(r) { return !took(r) && !(r.body && r.body.code === 'no-such-verb'); }
async function facts(id) { const r = await call('item.get', { id: id }, ANDY); return parse(r.body && r.body.item) || {}; }
async function offers(id) { return ((await facts(id)).buttons || []).indexOf('delete') !== -1; }
async function listed(includeClosed) {
  const r = await call('items.search', { text: '', currentGoalOnly: true, goalsOnly: false, includeClosed: includeClosed }, ANDY);
  return ((r.body && r.body.items) || []).map(function (i) { return (parse(i.label) || {}).id; });
}

async function server() {
  if (!await start()) { test.fail('the desk server did not start'); return; }
  // x/G1.1 a plain item never gone, x/G1.2 a code item whose red claude-windows will hold, x/G1.3 a plain item an
  // agent claims done, x/G1.4 a code item whose red is done and whose build nobody holds yet. x/G1.1 blocks x/G1.5.
  await call('session.set', { json: JSON.stringify({ goal: { id: 'x/G1', title: 'Deletes out of design' }, items: [
    { id: 'x/G1.1', title: 'No longer serves', blocks: ['x/G1', 'x/G1.5'] },
    { id: 'x/G1.2', title: 'Red held', blocks: ['x/G1'], code: true },
    { id: 'x/G1.3', title: 'Claimed done', blocks: ['x/G1'] },
    { id: 'x/G1.4', title: 'Build open, unheld', blocks: ['x/G1'], code: true },
    { id: 'x/G1.5', title: 'Waits on x/G1.1', blocks: ['x/G1'] },
  ] }) }, CW);
  await call('box.write', { id: 'x/G1.1', text: 'Its own words.', version: 0 }, CW);
  await call('item.take', { id: 'x/G1.1' }, CW);
  await call('chat.add', { id: 'x/G1.1', text: 'claude-windows: a line under it.' }, CW);
  await call('item.release', { id: 'x/G1.1' }, CW);
  const ended = await call('press', { id: 'x/G1', what: 'end-design' }, ANDY);
  const gos = [];
  for (const id of ['x/G1.2', 'x/G1.3', 'x/G1.4']) gos.push((await call('press', { id: id, what: 'go' }, ANDY)).status);
  // x/G1.4: claude-ubuntu writes the red and finishes it, so the build is open and nobody holds a phase.
  await call('phase.take', { id: 'x/G1.4', phase: 'red' }, UBI);
  await call('phase.done', { id: 'x/G1.4', phase: 'red' }, UBI);
  // x/G1.2: claude-windows holds its red.
  await call('phase.take', { id: 'x/G1.2', phase: 'red' }, CW);
  // x/G1.3: claude-ubuntu claims it done.
  await call('item.take', { id: 'x/G1.3' }, UBI);
  await call('press', { id: 'x/G1.3', what: 'claim-done' }, UBI);
  await call('item.release', { id: 'x/G1.3' }, UBI);

  const g = await facts('x/G1');
  const i2 = await facts('x/G1.2');
  const i3 = await facts('x/G1.3');
  const i4 = await facts('x/G1.4');
  const world = {
    ended: ended.status, gos: gos, design: g.design, i2: { phase: i2.phase, with: i2.with }, i3: { claims: i3.claims, status: i3.status, closed: i3.closed },
    i4: { phase: i4.phase, with: i4.with },
  };
  const i3claimed = (typeof i3.claims === 'number' ? i3.claims > 0 : !!(i3.claims && Object.keys(i3.claims).length));
  if (ended.status === 200 && g.design === false && gos.every(function (s) { return s === 200; }) &&
    i2.phase === 'red' && /claude-windows/.test(String(i2.with)) && i3claimed && i4.phase === 'build' && !i4.with) {
    test.check('the world: x/G1 out of design; x/G1.2 red held by claude-windows; x/G1.3 claimed done; x/G1.4 build open, unheld');
  } else { test.fail('the world: ' + short(world)); return; }

  test.subHeading('1. out of design mode a plain item offers delete and is deleted, erasing nothing');
  if (await offers('x/G1.1')) test.check('x/G1.1 offers delete with the goal out of design mode');
  else test.fail(OWED + 'x/G1.1 offers ' + short((await facts('x/G1.1')).buttons));
  const del = await call('item.delete', { id: 'x/G1.1' }, ANDY);
  if (took(del)) test.check('his item.delete {id: x/G1.1} is taken');
  else test.fail(OWED + 'his item.delete answered ' + del.status + ' ' + short(del.body));
  const open = await listed(false);
  const all = await listed(true);
  if (open.indexOf('x/G1.1') === -1 && all.indexOf('x/G1.1') !== -1) test.check('x/G1.1 leaves the List and Include Closed finds it');
  else test.fail(OWED + 'open list ' + short(open) + ', with closed ' + short(all));
  const box = await call('item.box', { id: 'x/G1.1' }, ANDY);
  const chat = JSON.stringify(((await call('item.chat', { id: 'x/G1.1' }, ANDY)).body || {}).chat || []);
  if (box.body && box.body.box === 'Its own words.' && /a line under it/.test(chat)) test.check('its box and chat stay on the record');
  else test.fail('after the delete: box ' + short(box.body && box.body.box) + ', chat ' + short(chat));
  if (((await facts('x/G1.5')).blocked || []).indexOf('x/G1.1') === -1) test.check('x/G1.5 no longer waits on it');
  else test.fail(OWED + 'x/G1.5 still waits on ' + short((await facts('x/G1.5')).blocked));

  test.subHeading('2. an item with a phase held offers no delete, and item.delete is refused');
  if (!await offers('x/G1.2')) test.check('x/G1.2 (red held) offers no delete');
  else test.fail('x/G1.2 offers delete while its red is held');
  const held = await call('item.delete', { id: 'x/G1.2' }, ANDY);
  if (refused(held) && (await listed(false)).indexOf('x/G1.2') !== -1) test.check('item.delete on x/G1.2 is refused and it stays open');
  else test.fail('item.delete on a held phase answered ' + held.status + ' ' + short(held.body));

  test.subHeading('3. an item claimed done and not yet closed offers no delete, and item.delete is refused');
  if (!await offers('x/G1.3')) test.check('x/G1.3 (claimed done) offers no delete');
  else test.fail('x/G1.3 offers delete while claimed done');
  const claimed = await call('item.delete', { id: 'x/G1.3' }, ANDY);
  if (refused(claimed) && (await listed(false)).indexOf('x/G1.3') !== -1) test.check('item.delete on x/G1.3 is refused and it stays open');
  else test.fail('item.delete on a claimed item answered ' + claimed.status + ' ' + short(claimed.body));

  test.subHeading('4. a goal never offers delete, in design mode or out of it');
  if (!await offers('x/G1')) test.check('x/G1 out of design offers no delete');
  else test.fail('x/G1 offers delete');
  const onGoal = await call('item.delete', { id: 'x/G1' }, ANDY);
  if (refused(onGoal) && (await facts('x/G1')).status !== 'closed') test.check('item.delete on the goal is refused');
  else test.fail('item.delete on the goal answered ' + onGoal.status + ' ' + short(onGoal.body));
  await call('press', { id: 'x/G1', what: 'start-design' }, ANDY);
  if ((await facts('x/G1')).design !== true) test.fail('the world: start-design did not take');
  else if (!await offers('x/G1')) test.check('x/G1 in design offers no delete');
  else test.fail('x/G1 in design offers delete');
  await call('press', { id: 'x/G1', what: 'end-design' }, ANDY);

  test.subHeading('5. a gone code item with no phase held offers delete and is deleted');
  if (await offers('x/G1.4')) test.check('x/G1.4 (build open, nobody holding) offers delete');
  else test.fail(OWED + 'x/G1.4 offers ' + short((await facts('x/G1.4')).buttons));
  const free = await call('item.delete', { id: 'x/G1.4' }, ANDY);
  if (took(free) && (await listed(false)).indexOf('x/G1.4') === -1 && (await listed(true)).indexOf('x/G1.4') !== -1) test.check('his item.delete on x/G1.4 closes it and Include Closed finds it');
  else test.fail(OWED + 'item.delete on x/G1.4 answered ' + free.status + ' ' + short(free.body));
}

(async function () {
  await server();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
