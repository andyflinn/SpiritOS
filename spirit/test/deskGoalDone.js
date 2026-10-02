'use strict';

// goal/G2.10: the goal offers Done only when every item is done. Red on today's tree.
//   Found by Andy, 2026-10-02 (Team line, verbatim): "right now my desk has a not-done item and the goal still offers
//   me a done..... the goal should only offer a done button when all items are done."
//   Checked live: goal/G2 answered buttons ["done"] with two items open. The rule (desk.js buttons()): a row offers
//   done when it has a claim OR, for a goal, when every member is closed — so a claim-done recorded against the goal
//   id offers Done on the goal whatever its items are doing.
// The contract the builder follows (the shape in goal/G2.10's box):
//   1. A goal ignores claims: a claim-done pressed against the goal id offers nothing by itself.
//   2. A goal offers Done once every member is done or closed, and none is open; close-and-reopen of an item takes
//      it away again. An item's own rule is unchanged (a claim offers Done).
//   3. The goal's Done press itself still works once offered (unchanged).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G2.10: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskGoalDoneTestPeerCWAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskGoalDoneTestOwnerAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test.startTest('goal/G2.10: the goal offers Done only when every item is done');

(async function () {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-goaldone-'));
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('desk', pipe);
  const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
  const buttonsOf = async function (id) { const r = await call('item.get', { id: id }, ANDY); try { return JSON.parse((r.body || {}).item).buttons || []; } catch (e) { return ['?']; } };
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  try {
    for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ } }
    const set = await call('session.set', { json: JSON.stringify({ goal: { id: 'g/G1', title: 'Round' }, items: [
      { id: 'g/G1.1', title: 'A', blocks: ['g/G1'] }, { id: 'g/G1.2', title: 'B', blocks: ['g/G1'] }] }) }, CW);
    if (set.status !== 200) { test.fail(OWED + 'the session was not taken: ' + JSON.stringify(set.body)); return; }
    // Out of design mode, so items offer Go and the goal's buttons are the ordinary ones.
    await call('press', { id: 'g/G1', what: 'end-design' }, ANDY);

    test.subHeading('1. a claim against the goal id offers nothing by itself');
    const b0 = await buttonsOf('g/G1');
    const claimed = await call('press', { id: 'g/G1', what: 'claim-done' }, CW);
    const b1 = await buttonsOf('g/G1');
    if (b0.indexOf('done') === -1 && b1.indexOf('done') === -1) {
      test.check('two open items: no Done before the claim, none after it (claim ' + claimed.status + ')');
    } else test.fail(OWED + 'goal buttons before a claim ' + JSON.stringify(b0) + ', after a claim against the goal id ' + JSON.stringify(b1));

    test.subHeading('2. Done once every item is done or closed, none open');
    await call('press', { id: 'g/G1.1', what: 'claim-done' }, CW);
    await call('press', { id: 'g/G1.1', what: 'done' }, ANDY);
    const oneDone = await buttonsOf('g/G1');
    await call('press', { id: 'g/G1.2', what: 'claim-done' }, CW);
    await call('press', { id: 'g/G1.2', what: 'done' }, ANDY);
    const bothDone = await buttonsOf('g/G1');
    if (oneDone.indexOf('done') === -1 && bothDone.indexOf('done') !== -1) {
      test.check('one item done, one open: no Done; both done: Done offered');
    } else test.fail(OWED + 'goal buttons with one item done ' + JSON.stringify(oneDone) + ', both done ' + JSON.stringify(bothDone));
    await call('press', { id: 'g/G1.1', what: 'close' }, ANDY);
    const oneClosed = await buttonsOf('g/G1');
    await call('press', { id: 'g/G1.2', what: 'reopen' }, ANDY);
    const reopened = await buttonsOf('g/G1');
    if (oneClosed.indexOf('done') !== -1 && reopened.indexOf('done') === -1) {
      test.check('one closed, one done: still offered; an item reopened: taken away again');
    } else test.fail(OWED + 'goal buttons with one closed and one done ' + JSON.stringify(oneClosed) + ', after a reopen ' + JSON.stringify(reopened));

    test.subHeading('3. a new open item takes the goal\'s Done away again');
    // Andy (Team line): "when all items are done and the done button appears on the goal, then a new item is
    // added, not done, the goals done button should disappear." — "tied to the condition that all visible items are done."
    await call('press', { id: 'g/G1.2', what: 'claim-done' }, CW);
    await call('press', { id: 'g/G1.2', what: 'done' }, ANDY);
    const beforeNew = await buttonsOf('g/G1');
    const grown = await call('session.set', { json: JSON.stringify({ goal: { id: 'g/G1', title: 'Round' }, items: [
      { id: 'g/G1.1', title: 'A', blocks: ['g/G1'] }, { id: 'g/G1.2', title: 'B', blocks: ['g/G1'] }, { id: 'g/G1.3', title: 'C', blocks: ['g/G1'] }] }) }, CW);
    const withNew = await buttonsOf('g/G1');
    if (beforeNew.indexOf('done') !== -1 && grown.status === 200 && withNew.indexOf('done') === -1) {
      test.check('Done offered with every item done; a third item added open: Done gone');
    } else test.fail(OWED + 'goal buttons with every item done ' + JSON.stringify(beforeNew) + ', after an open item was added ' + JSON.stringify(withNew) + ' (session.set ' + grown.status + ')');
    await call('press', { id: 'g/G1.3', what: 'claim-done' }, CW);
    await call('press', { id: 'g/G1.3', what: 'done' }, ANDY);

    test.subHeading('4. the goal\'s own Done still works once offered');
    const offered = await buttonsOf('g/G1');
    const pressed = await call('press', { id: 'g/G1', what: 'done' }, ANDY);
    const after = await buttonsOf('g/G1');
    if (offered.indexOf('done') !== -1 && pressed.status === 200 && after.indexOf('close') !== -1) {
      test.check('offered, pressed, and the goal is done (close offered)');
    } else test.fail('goal Done: offered ' + JSON.stringify(offered) + ', press ' + pressed.status + ', after ' + JSON.stringify(after));
  } catch (e) {
    test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e));
  } finally {
    try { kid.kill(); } catch (e) { /* gone */ }
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
  }
})().then(function () {
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 200);
});
