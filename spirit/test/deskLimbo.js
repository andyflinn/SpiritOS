'use strict';

// goal/G5.4: an item whose Go is on record, with no Done offered, no open red
// G or Q, and nobody working on it, sits in LIMBO — a state the desk marks and
// agents are supposed to take. And a split (an agent writing new items that
// block an existing one) makes that parent a SUB-GOAL: it offers Go once any
// of its blockers does, and pressing Go on it is go-all over those blockers.
//   Andy, 2026-10-05, under goal/G5.4: "limbo, when detected must be taken by
//   an agent."; "items that are no-code branches, they really are sub-goals,
//   and must offer 'Done' when it's blockers are done."; "when i say split,
//   that becomes implicit/obvious and the item should be marked as sub-goal";
//   "pressing 'Go' on a sub-goal presses go on it's blockers, where
//   appropriate."; "it's like a scoped goal." claude-ubuntu wrote this red,
//   claude-windows builds it.
//
// SHAPES (ubi's picks; argue them in Desk first if the build disagrees):
//   1  facts.limbo === true on an item that: has go on record, offers no
//      Done, has no open G or Q check, and no live agent is working on it
//      (nobody has item.take without having since answered); facts.limbo
//      === false otherwise. The desk writes a line by 'desk' under the
//      item on the transition, so changes carries it.
//   2  A split sets facts.subGoal === true on the parent: a session.set
//      that names the parent in split: [id] (goal/G6.8; before it, any
//      new item blocking the parent marked it). The mark survives on
//      later sessions as long as the parent still has non-done blockers.
//   3  A sub-goal offers 'go' in facts.buttons once at least one blocker
//      offers 'go' (today the server refuses, blockers.length > 0 kills
//      Go in buttons()). Pressing 'go' on a sub-goal cascades: every
//      blocker that itself offers 'go' is pressed (as goable does for a
//      goal under 'go-all'); nothing else is touched.
//
// DRY-RUN NOTE: against today's tree the three sections fail by shape (no
// limbo field, no subGoal field, Go refused on an item with blockers). The
// first assertion of each section asks for the field by name, so the suite
// is a clean red today and turns green on the build.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G5.4: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskLimboTestCWAAAAAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskLimboTestWSLAAAAAAAAAAAAAAAAAAAAAAAAA=', label: 'wsl-claude' };
const UBI = { key: 'MCowBQYDK2VwAyEAdeskLimboTestUBIAAAAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-ubuntu' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskLimboTestOwnerAAAAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(JSON.stringify(x)).slice(0, 220); }

test.startTest('goal/G5.4: limbo marker, sub-goal mark on split, sub-goal Go cascades to blockers');

(async function () {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desklimbo-'));
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('desk', pipe);
  const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
  const factsOf = async function (id) { const r = await call('item.get', { id: id }, ANDY); try { return JSON.parse((r.body || {}).item) || {}; } catch (e) { return {}; } };
  const chatOf = async function (id) { const r = await call('item.chat', { id: id }, ANDY); return ((r.body || {}).chat) || []; };
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  try {
    for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ } }

    test.subHeading('1. limbo marker: go on record, no Done, no open G/Q, nobody working');
    await call('session.set', { json: JSON.stringify({ goal: { id: 'L/G1', title: 'Limbo' }, items: [
      { id: 'L/G1.1', title: 'Sits in limbo', blocks: ['L/G1'] },
      { id: 'L/G1.2', title: 'Taken and working', blocks: ['L/G1'] },
      { id: 'L/G1.3', title: 'Has an open Q', blocks: ['L/G1'] }] }) }, CW);
    await call('press', { id: 'L/G1', what: 'end-design' }, ANDY);
    await call('press', { id: 'L/G1.1', what: 'go' }, ANDY);

    const nobody = await factsOf('L/G1.1');
    if (nobody.limbo === true) test.check('L/G1.1: facts.limbo === true (go on record, nothing taken, no asks, no Done)');
    else test.fail(OWED + 'L/G1.1: facts has no limbo field or it is not true: ' + short({ limbo: nobody.limbo, go: nobody.go, buttons: nobody.buttons, asks: nobody.asks, with: nobody.with }));

    // The desk writes a line the moment limbo begins, by 'desk', so changes carries it.
    const limChat = await chatOf('L/G1.1');
    const deskLine = limChat.filter(function (l) { return l.by === 'desk' && /limbo/i.test(l.text || ''); })[0];
    if (deskLine) test.check('the desk wrote a limbo line under L/G1.1 by `desk`');
    else test.fail(OWED + 'no limbo line by `desk` on L/G1.1 chat (' + limChat.length + ' lines total)');

    // Negative case: an item an agent took and whose last word is 'working' is NOT in limbo.
    await call('press', { id: 'L/G1.2', what: 'go' }, ANDY);
    await call('item.take', { id: 'L/G1.2' }, CW);
    await call('agent.state', { word: 'working' }, CW);
    await sleep(50);
    const taken = await factsOf('L/G1.2');
    if (taken.limbo === false) test.check('L/G1.2 taken and worked: facts.limbo === false');
    else test.fail(OWED + 'L/G1.2 is not limbo but facts.limbo is ' + short(taken.limbo));

    // Negative case: an open red Q keeps an item out of limbo.
    await call('press', { id: 'L/G1.3', what: 'go' }, ANDY);
    await call('check.add', { id: 'L/G1.3', kind: 'Q', words: 'open question', test: '' }, CW);
    const qItem = await factsOf('L/G1.3');
    if (qItem.limbo === false) test.check('L/G1.3 with open Q: facts.limbo === false');
    else test.fail(OWED + 'L/G1.3 has an open Q but limbo is ' + short(qItem.limbo));

    test.subHeading('2. sub-goal mark: a split sets subGoal on the parent');
    await call('session.set', { json: JSON.stringify({ goal: { id: 'S/G1', title: 'Split' }, items: [
      { id: 'S/G1.1', title: 'Parent, soon to be split', blocks: ['S/G1'] }] }) }, CW);
    await call('press', { id: 'S/G1', what: 'end-design' }, ANDY);
    const parentBefore = await factsOf('S/G1.1');
    if (parentBefore.subGoal === false) test.check('S/G1.1 before the split: facts.subGoal === false');
    else test.fail(OWED + 'parent before any split: subGoal is ' + short(parentBefore.subGoal));

    // The split: a session.set keeps the parent, adds new items that block it, and names it in split (goal/G6.8:
    // "an item becomes a sub-goal only when i say split"; a new blocker alone marks nothing, deskSplitGreen asserts).
    await call('session.set', { json: JSON.stringify({ goal: { id: 'S/G1', title: 'Split' }, split: ['S/G1.1'], items: [
      { id: 'S/G1.1', title: 'Parent, soon to be split', blocks: ['S/G1'] },
      { id: 'S/G1.2', title: 'First blocker', blocks: ['S/G1.1'] },
      { id: 'S/G1.3', title: 'Second blocker', blocks: ['S/G1.1'] }] }) }, CW);
    const parentAfter = await factsOf('S/G1.1');
    if (parentAfter.subGoal === true) test.check('S/G1.1 after the split (two blockers added): facts.subGoal === true');
    else test.fail(OWED + 'parent after the split: subGoal is ' + short(parentAfter.subGoal) + ' and blocked ' + short(parentAfter.blocked));

    test.subHeading('3. sub-goal Go cascades: Go on a sub-goal presses Go on blockers that offer Go');
    // The sub-goal must offer `go` in its buttons once a blocker offers one.
    if (parentAfter.buttons && parentAfter.buttons.indexOf('go') !== -1) test.check('S/G1.1 as a sub-goal offers `go` (today buttons would hide it under blockers)');
    else test.fail(OWED + 'S/G1.1 sub-goal buttons: ' + short(parentAfter.buttons));

    // Press Go on the sub-goal; both blockers that themselves offer Go are pressed.
    const pressed = await call('press', { id: 'S/G1.1', what: 'go' }, ANDY);
    if (pressed.status === 200) test.check('press go on sub-goal S/G1.1 is accepted');
    else test.fail(OWED + 'press go on S/G1.1 refused: ' + short(pressed.text));

    const b1 = await factsOf('S/G1.2');
    const b2 = await factsOf('S/G1.3');
    if (b1.go === true && b2.go === true) test.check('both blockers S/G1.2 and S/G1.3 now carry go on record');
    else test.fail(OWED + 'blockers after sub-goal Go: ' + short({ 'S/G1.2.go': b1.go, 'S/G1.3.go': b2.go }));

    // Scope: a sibling in the goal that does NOT block the sub-goal must not be pressed by
    // the sub-goal's Go. This assertion only has signal once the cascade works at all — today's
    // tree refuses the press and nothing moves, so the check would pass vacuously. We require
    // b1 and b2 to carry go first, so a build that silently cascades to every goal member is
    // caught, and today's refused tree reports it as owed, not as a pass.
    await call('session.set', { json: JSON.stringify({ goal: { id: 'S/G1', title: 'Split' }, items: [
      { id: 'S/G1.1', title: 'Parent, soon to be split', blocks: ['S/G1'] },
      { id: 'S/G1.2', title: 'First blocker', blocks: ['S/G1.1'] },
      { id: 'S/G1.3', title: 'Second blocker', blocks: ['S/G1.1'] },
      { id: 'S/G1.4', title: 'Unrelated sibling', blocks: ['S/G1'] }] }) }, CW);
    // S/G1.4 is brand new, so its go starts false; the earlier press on S/G1.1 ran before
    // it existed. Press again to see whether the cascade reaches it under the new session.
    await call('press', { id: 'S/G1.1', what: 'go' }, ANDY);
    const b1Scope = await factsOf('S/G1.2');
    const b2Scope = await factsOf('S/G1.3');
    const sibling = await factsOf('S/G1.4');
    if (b1Scope.go === true && b2Scope.go === true && sibling.go === false) test.check('sub-goal Go reaches the two blockers and nothing else (S/G1.4 untouched)');
    else test.fail(OWED + 'sub-goal Go scope: ' + short({ 'S/G1.2.go': b1Scope.go, 'S/G1.3.go': b2Scope.go, 'S/G1.4.go': sibling.go }));

    test.subHeading('4. sub-goal offers Done once every blocker is done or closed');
    // Andy, 2026-10-05: "items that are no-code branches, they really are sub-goals, and must offer 'Done' when it's
    // blockers are done." Walk S/G1.2 and S/G1.3 through claim-done and done so the parent sub-goal unblocks.
    await call('item.take', { id: 'S/G1.2' }, CW);
    await call('press', { id: 'S/G1.2', what: 'claim-done' }, CW);
    await call('press', { id: 'S/G1.2', what: 'done' }, ANDY);
    await call('item.take', { id: 'S/G1.3' }, CW);
    await call('press', { id: 'S/G1.3', what: 'claim-done' }, CW);
    await call('press', { id: 'S/G1.3', what: 'done' }, ANDY);

    const subUnblocked = await factsOf('S/G1.1');
    const doneOffered = subUnblocked.buttons && subUnblocked.buttons.indexOf('done') !== -1;
    if (doneOffered) test.check('S/G1.1 sub-goal offers `done` once every blocker is done');
    else test.fail(OWED + 'S/G1.1 sub-goal with both blockers done: ' + short({ buttons: subUnblocked.buttons, blocked: subUnblocked.blocked }));

    // Signal only once Done is actually offered: Andy's press done bypasses the offered gate today,
    // so this would pass vacuously on the pre-build tree without the guard.
    const donePressed = await call('press', { id: 'S/G1.1', what: 'done' }, ANDY);
    const subDone = await factsOf('S/G1.1');
    if (doneOffered && donePressed.status === 200 && subDone.status === 'done') test.check('press done on sub-goal S/G1.1 is accepted and the item is done');
    else test.fail(OWED + 'press done on sub-goal S/G1.1 (needs Done to be offered first): ' + short({ offered: doneOffered, pressStatus: donePressed.status, factStatus: subDone.status }));
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
