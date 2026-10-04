'use strict';

// goal/G4.24, point 1: an item left out of a session is closed, never deleted. Red on today's tree; wsl-claude wrote
// it, claude-windows builds it.
//   Andy, 2026-10-04, under goal/G4.23 and goal/G4.24: "damn, my search still doesn't show old, closed items. i can't
//   find it either."; "1. sounds dumb that the \"archive\" is not searchable."; "if deleted is just a flag in the
//   database, we can just ignore it from now on"; "if it's that simple, lets do it quick"; then his Go on goal/G4.24.
//   In the tree: session.set deletes from the state every member its new session leaves out, "g.members.forEach(
//   function (id) { if (ids.indexOf(id) === -1) delete s.items[id]; });" (desk.js 360), while desk.db keeps every
//   record; so goal/G2 holds no items at all, and goal/G2.16 cannot be found with [Include Closed].
//
// THE SHAPES, NAMED HERE where the box names none (wsl-claude's picks; the builder may argue them in Desk first):
//   1  A member a new session leaves out is closed (closed true, as his close press leaves it), never deleted: it
//      keeps its box, checks and chat, and it stays a member of its goal (listed after the session's own items), so
//      items.search with includeClosed finds it and without it does not.
//   2  Nothing else moves: the session's own items keep their order and state, as today.
//   3  The state is rebuilt from the records, so this holds for sessions written before the fix: a desk restarted on
//      the same desk.db shows the left-out item closed.
//
// LEFT OPEN, not asserted: what a later session that names a closed left-out item again does to it (reopen it, or
// keep it closed until his Reopen); point 2 of the box, the List searching lines, whose shape is still argued (it may
// reuse items.find).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G4.24: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskArchiveTestPeerCWAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskArchiveTestOwnerAAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(JSON.stringify(x)).slice(0, 220); }

test.startTest('goal/G4.24: an item left out of a session is closed, never deleted');

(async function () {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskarchive-'));
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('desk', pipe);
  const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
  const factsOf = async function (id) { const r = await call('item.get', { id: id }, ANDY); try { return JSON.parse((r.body || {}).item) || null; } catch (e) { return null; } };
  const keys = async function (includeClosed) {
    const r = await call('items.search', { text: '', currentGoalOnly: false, goalsOnly: false, includeClosed: includeClosed }, ANDY);
    return ((r.body || {}).items || []).map(function (x) { return x.key; });
  };
  let kid = null;
  const start = async function () {
    kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) return; } catch (e) { /* not yet */ } }
  };
  const session = function (ids) {
    return call('session.set', { json: JSON.stringify({ goal: { id: 'a/G1', title: 'Archive' }, items: ids.map(function (id) { return { id: id, title: 'Item ' + id, blocks: ['a/G1'] }; }) }) }, CW);
  };
  try {
    await start();
    await session(['a/G1.1', 'a/G1.2', 'a/G1.3']);
    await call('press', { id: 'a/G1', what: 'end-design' }, ANDY);
    await call('press', { id: 'a/G1.1', what: 'go' }, ANDY);
    await call('chat.add', { id: 'a/G1.2', text: 'a line that must survive' }, CW);
    await call('box.write', { id: 'a/G1.2', text: 'BOX OF G1.2', version: 0 }, CW);

    test.subHeading('1. left out of the next session, it is closed, not deleted');
    const set = await session(['a/G1.1', 'a/G1.3']);
    if (set.status !== 200) test.fail('the second session was not taken: ' + short(set.body));
    const two = await factsOf('a/G1.2');
    if (two && two.status === 'closed') test.check('a/G1.2, left out, is still on the desk and closed');
    else test.fail(OWED + 'a/G1.2 after the session that left it out: ' + short(two));
    const box = await call('item.box', { id: 'a/G1.2' }, ANDY);
    const chat = await call('chat.search', { id: 'a/G1.2', text: 'survive', by: '', since: '', before: '' }, ANDY);
    if ((box.body || {}).box === 'BOX OF G1.2' && ((chat.body || {}).items || []).length === 1) test.check('it keeps its box and its chat');
    else test.fail(OWED + 'a/G1.2 box ' + short((box.body || {}).box || box.body) + ', chat ' + short(chat.body));
    const open = await keys(false);
    const all = await keys(true);
    if (open.indexOf('a/G1.2') === -1 && all.indexOf('a/G1.2') !== -1) test.check('items.search finds it with includeClosed, and not without');
    else test.fail(OWED + 'items.search without includeClosed ' + short(open) + ', with ' + short(all));

    test.subHeading('2. nothing else moves');
    const one = await factsOf('a/G1.1');
    const three = await factsOf('a/G1.3');
    if (one && one.go === true && one.status !== 'closed' && three && three.status !== 'closed' && open.indexOf('a/G1.1') !== -1 && open.indexOf('a/G1.3') !== -1 && open.indexOf('a/G1.1') < open.indexOf('a/G1.3')) {
      test.check('the session\'s own items keep their state and order');
    } else test.fail('the kept items moved: ' + short({ one: one && one.status, go: one && one.go, three: three && three.status, open: open }));

    test.subHeading('3. the same holds after a restart, rebuilt from the records');
    try { kid.kill(); } catch (e) { /* gone */ }
    await sleep(300);
    await start();
    const again = await factsOf('a/G1.2');
    if (again && again.status === 'closed') test.check('restarted on the same desk.db, a/G1.2 is still there and closed');
    else test.fail(OWED + 'after a restart a/G1.2 is ' + short(again));
  } catch (e) {
    test.fail('the suite threw: ' + (e && e.stack || e));
  } finally {
    try { kid.kill(); } catch (e) { /* gone */ }
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
  }
})().then(function () {
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 200);
});
