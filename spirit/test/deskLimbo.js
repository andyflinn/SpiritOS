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
//      === false otherwise. Since goal/G29.10 the desk posts no line for
//      it ("The limbo posts go.").
//   2 and 3 WENT WITH goal/G33.4, which removed the sub-goal; their sections now hold that a split marks nothing.
//   (goal/G33.7: session.set went; a split is item.add naming the parent in blocks, and the world is seeded.)
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

test.startTest('goal/G5.4: limbo marker; since goal/G33.4 a split marks no sub-goal');

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
  // The world (goal/G33.7: session.set went), seeded before the desk starts: goal/G101 first, so goal/G100, the last
  // new goal, is the current one.
  test.seedDesk(state, [
    { goal: { id: 'goal/G101', title: 'Split' }, items: [{ id: 'goal/G101.1', title: 'Parent, soon to be split', blocks: ['goal/G101'] }] },
    { goal: { id: 'goal/G100', title: 'Limbo' }, items: [
      { id: 'goal/G100.1', title: 'Sits in limbo', blocks: ['goal/G100'] },
      { id: 'goal/G100.2', title: 'Taken and working', blocks: ['goal/G100'] },
      { id: 'goal/G100.3', title: 'Has an open Q', blocks: ['goal/G100'] }] }]);
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  try {
    for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ } }

    test.subHeading('1. limbo marker: go on record, no Done, no open G/Q, nobody working');
    await call('press', { id: 'goal/G100', what: 'end-design' }, ANDY);
    await call('press', { id: 'goal/G100.1', what: 'go' }, ANDY);

    const nobody = await factsOf('goal/G100.1');
    if (nobody.limbo === true) test.check('goal/G100.1: facts.limbo === true (go on record, nothing taken, no asks, no Done)');
    else test.fail(OWED + 'goal/G100.1: facts has no limbo field or it is not true: ' + short({ limbo: nobody.limbo, go: nobody.go, buttons: nobody.buttons, asks: nobody.asks, with: nobody.with }));

    // goal/G29.10, point 1: "The limbo posts go." Limbo is a mark in the facts; the desk posts no line for it.
    const limChat = await chatOf('goal/G100.1');
    const deskLine = limChat.filter(function (l) { return l.by === 'desk' && /limbo/i.test(l.text || ''); })[0];
    if (!deskLine) test.check('the desk wrote no limbo line under goal/G100.1');
    else test.fail('OWED by goal/G29.10: the desk posted a limbo line on goal/G100.1: ' + short(deskLine.text));

    // Negative case: an item an agent took and whose last word is 'working' is NOT in limbo.
    await call('press', { id: 'goal/G100.2', what: 'go' }, ANDY);
    await call('item.take', { id: 'goal/G100.2' }, CW);
    await call('agent.state', { word: 'working' }, CW);
    await sleep(50);
    const taken = await factsOf('goal/G100.2');
    if (taken.limbo === false) test.check('goal/G100.2 taken and worked: facts.limbo === false');
    else test.fail(OWED + 'goal/G100.2 is not limbo but facts.limbo is ' + short(taken.limbo));

    // Negative case: an open red Q keeps an item out of limbo.
    await call('press', { id: 'goal/G100.3', what: 'go' }, ANDY);
    await call('check.add', { id: 'goal/G100.3', kind: 'Q', words: 'open question', test: '' }, CW);
    const qItem = await factsOf('goal/G100.3');
    if (qItem.limbo === false) test.check('goal/G100.3 with open Q: facts.limbo === false');
    else test.fail(OWED + 'goal/G100.3 has an open Q but limbo is ' + short(qItem.limbo));

    // SECTIONS 2 TO 4 HELD THE SUB-GOAL (goal/G5.4, goal/G6.8). goal/G33.4 removed it (Andy, in its box: "No sub-goals and
    // no goal tree: an item never becomes a goal, so two numbers always suffice; the sub-goal mechanism is removed."), so
    // they hold that it is gone: a split item is an item like any other, blocked by its parts, its Go no cascade.
    test.subHeading('2. a split marks no sub-goal (goal/G33.4)');
    await call('press', { id: 'goal/G101', what: 'end-design' }, ANDY);
    // The split (goal/G33.7: session.set went): each part an item.add blocking the parent (goal/G9.10).
    await call('item.add', { goal: 'goal/G101', title: 'First blocker', blocks: 'goal/G101.1' }, ANDY);
    await call('item.add', { goal: 'goal/G101', title: 'Second blocker', blocks: 'goal/G101.1' }, ANDY);
    const parentAfter = await factsOf('goal/G101.1');
    if (parentAfter.id === 'goal/G101.1' && parentAfter.subGoal === undefined && (parentAfter.blocked || []).length === 2) test.check('goal/G101.1 after the split: an item blocked by its two parts, no sub-goal mark');
    else test.fail('goal/G33.4: parent after the split: subGoal is ' + short(parentAfter.subGoal) + ' and blocked ' + short(parentAfter.blocked));

    test.subHeading('3. his Go on the split item is an item\'s Go: refused while it is blocked, and no cascade');
    if ((parentAfter.buttons || []).indexOf('go') === -1) test.check('goal/G101.1, blocked, offers no Go');
    else test.fail('goal/G33.4: goal/G101.1 offers ' + short(parentAfter.buttons));
    const pressed = await call('press', { id: 'goal/G101.1', what: 'go' }, ANDY);
    // The new blockers arrived in design mode (goal/G33.4); his Go on the parent presses none of them.
    const b1 = await factsOf('goal/G101.2');
    const b2 = await factsOf('goal/G101.3');
    if (pressed.status !== 200 && b1.go === false && b2.go === false) test.check('press go on goal/G101.1 is refused, and its blockers carry no go');
    else test.fail('goal/G33.4: press go on goal/G101.1 answered ' + short(pressed.status) + '; blockers ' + short({ 'goal/G101.2.go': b1.go, 'goal/G101.3.go': b2.go }));
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
