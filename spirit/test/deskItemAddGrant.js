'use strict';

// spirit/test/deskItemAddGrant.js
// goal/G29.21, its second part: an agent adds items only under Andy's words, and a new item is code. Red on today's
// tree; claude-windows writes it and builds it (one agent). The item's box (v3), DESK: ITEM ADDS NEED HIS WORDS:
//   - Desk lets an agent add items only while Andy's newest Desk line holds the words "add item" (one item) or "add
//     items" (several items) in sequence. The grant ends with his next line. Proposing items stays free.
//   - A new item is kind code unless said otherwise.
//   - The item grant holds only in the goal his line is in; "add goal" grants one more goal, no items; an agent's
//     session.set creates no goal, and its new items count against the item grant. Since goal/G33.7 there is no
//     session.set (the approved verb list: "its callers use goal.add and item.add"), so no bulk path goes around the
//     grant: every new item is an item.add, counted one by one.
// NAMED HERE where the box names none: his newest line is his newest chat line anywhere in Desk; the words match
// whatever the case; his own adds need no grant; "code" is the item's code mark (item.get's code), and an item whose
// plugin refuses the code press (codeOffered false) is not marked.
// rule/11: through testSupport only; its own scratch folder and pipe.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G29.21: ';
const DESK = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }

const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskItemAddGrantTestOwnerAAAAAAAAAAAA=', label: 'andy' };
const CW = { key: 'MCowBQYDK2VwAyEAdeskItemAddGrantTestCWAAAAAAAAAAAAAAAA=', label: 'claude-windows' };

test.startTest('goal/G29.21: an agent adds items only under his "add item" or "add items"; a new item is code');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskitemaddgrant-'));
const deskState = path.join(scratch, 'desk-state');
fs.mkdirSync(deskState, { recursive: true });
const deskPipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'desk.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', deskPipe);
const call = function (verb, args, caller) {
  const q = {}; q[verb] = args;
  return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; });
};
const took = function (r) { return r.status === 200 && r.body && typeof r.body.id === 'string' && r.body.id; };
const add = function (goal, title, caller) { return call('item.add', { goal: goal, title: title }, caller); };
const say = function (id, text) { return call('chat.add', { id: id, text: text }, ANDY); };

async function main() {
  const kid = spawn(process.execPath, [DESK, '{}', '--pipe', deskPipe, '--state', deskState], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); up = !!(r.body && r.body.desk && r.body.desk.ok !== false); } catch (e) { /* not yet */ }
  }
  try {
    if (!up) { test.fail('the desk server did not start'); return; }
    const g = await call('goal.add', { title: 'A goal' }, ANDY);
    const gid = g.body && g.body.id;
    if (!gid) { test.fail('the world: goal.add answered ' + g.status + ' ' + short(g.body)); return; }

    test.subHeading('1. no words, no add');
    const bare = await add(gid, 'Unasked', CW);
    if (bare.status >= 400 && !took(bare)) test.check('an agent\'s item.add with no grant is refused (' + bare.status + ' ' + short(bare.body && (bare.body.error || bare.body.why)) + ')');
    else test.fail(OWED + 'an agent added an item with no grant: ' + bare.status + ' ' + short(bare.body));
    const his = await add(gid, 'His own', ANDY);
    if (took(his)) test.check('his own item.add needs no grant');
    else test.fail('his own item.add answered ' + his.status + ' ' + short(his.body));

    test.subHeading('2. "add item" grants one');
    await say(gid, 'ok, Add Item for the harbour wall');
    const one = await add(gid, 'Harbour wall', CW);
    const two = await add(gid, 'One too many', CW);
    if (took(one)) test.check('after "Add Item" the agent adds one item');
    else test.fail(OWED + 'after "Add Item" the add answered ' + one.status + ' ' + short(one.body));
    if (two.status >= 400 && !took(two)) test.check('a second add under the same line is refused');
    else test.fail(OWED + 'a second add under one "add item" answered ' + two.status + ' ' + short(two.body));

    test.subHeading('3. "add items" grants several, until his next line');
    await say(gid, 'yes, add items for all three');
    const many = [await add(gid, 'First', CW), await add(gid, 'Second', CW), await add(gid, 'Third', CW)];
    if (many.every(took)) test.check('after "add items" the agent adds three items');
    else test.fail(OWED + 'after "add items" the adds answered ' + short(many.map(function (r) { return r.status; })));
    await say(gid, 'thanks');
    const after = await add(gid, 'Fourth', CW);
    if (after.status >= 400 && !took(after)) test.check('his next line ends the grant: the next add is refused');
    else test.fail(OWED + 'after his next line an add answered ' + after.status + ' ' + short(after.body));
    await say(gid, 'adding items is fine');
    const apart = await add(gid, 'Not in sequence', CW);
    if (apart.status >= 400 && !took(apart)) test.check('"add" and "item" not in sequence grant nothing');
    else test.fail(OWED + '"adding items" granted an add: ' + apart.status + ' ' + short(apart.body));

    test.subHeading('5. a goal only under "add goal": one goal, no items');
    await say(gid, 'add items, all of them');
    const noGoal = await call('goal.add', { title: 'Unasked goal' }, CW);
    if (noGoal.status >= 400 && !took(noGoal)) test.check('an agent\'s goal.add with no "add goal" is refused, even under "add items"');
    else test.fail(OWED + 'an agent added a goal with no grant: ' + noGoal.status + ' ' + short(noGoal.body));
    await say(gid, 'yes, Add Goal for the harbour');
    const goalOne = await call('goal.add', { title: 'Harbour' }, CW);
    const goalTwo = await call('goal.add', { title: 'Another' }, CW);
    if (took(goalOne)) test.check('after "Add Goal" the agent adds one goal');
    else test.fail(OWED + 'after "Add Goal" goal.add answered ' + goalOne.status + ' ' + short(goalOne.body));
    if (goalTwo.status >= 400 && !took(goalTwo)) test.check('a second goal under the same line is refused');
    else test.fail(OWED + 'a second goal under one "add goal" answered ' + goalTwo.status + ' ' + short(goalTwo.body));
    const noItem = took(goalOne) ? await add(took(goalOne), 'Into the new goal', CW) : { status: 0 };
    if (noItem.status >= 400 && !took(noItem)) test.check('"add goal" grants no item');
    else test.fail(OWED + 'under "add goal" an item add answered ' + noItem.status + ' ' + short(noItem.body));
    const hisGoal = await call('goal.add', { title: 'His goal' }, ANDY);
    if (took(hisGoal)) test.check('his own goal.add needs no grant');
    else test.fail('his own goal.add answered ' + hisGoal.status + ' ' + short(hisGoal.body));

    // goal/G33.7: session.set went, so no bulk write goes around the grant; the grant counts item.add one by one.
    test.subHeading('6. no bulk path around the grant: session.set is gone, and the grant counts each add');
    await say(gid, 'add items, all of them');
    const bulk = await call('session.set', { json: JSON.stringify({ goal: { id: 'goal/G100', title: 'Bulk' }, items: [{ id: 'goal/G100.1', title: 'Bulk', blocks: ['goal/G100'] }] }) }, CW);
    const stray = await call('item.get', { id: 'goal/G100' }, ANDY);
    if (bulk.body && bulk.body.code === 'no-such-verb' && stray.status !== 200) test.check('an agent\'s session.set is refused no-such-verb even under "add items", and no goal came of it');
    else test.fail(OWED + 'an agent\'s session.set answered ' + bulk.status + ' ' + short(bulk.body) + '; goal/G100 reads ' + stray.status);
    await say(gid, 'thanks');
    const ungranted = await add(gid, 'Bulk ninety', CW);
    if (ungranted.status >= 400 && !took(ungranted)) test.check('with no grant its new item is refused, the one way an item comes in');
    else test.fail(OWED + 'with no grant an item.add answered ' + ungranted.status + ' ' + short(ungranted.body));
    await say(gid, 'add item');
    const firstOne = await add(gid, 'Bulk ninety', CW);
    const secondOne = await add(gid, 'Bulk ninety-one', CW);
    if (took(firstOne) && secondOne.status >= 400 && !took(secondOne)) test.check('under "add item" one new item comes in, not two');
    else test.fail(OWED + 'under "add item" the adds answered ' + firstOne.status + ' then ' + secondOne.status);

    test.subHeading('7. the item grant holds only in the goal his line is in');
    const other = await call('goal.add', { title: 'Another goal of his' }, ANDY);
    const ogid = other.body && other.body.id;
    const oItem = ogid ? await add(ogid, 'His item there', ANDY) : {};
    await say(took(oItem) || ogid || gid, 'add items over here');
    const elsewhere = await add(gid, 'Into the first goal', CW);
    const there = ogid ? await add(ogid, 'Into his other goal', CW) : {};
    if (elsewhere.status >= 400 && !took(elsewhere) && took(there)) test.check('"add items" written under an item of one goal adds to that goal, and not to another');
    else test.fail(OWED + 'a grant in ' + ogid + ' answered ' + elsewhere.status + ' in ' + gid + ' and ' + there.status + ' in ' + ogid);

    test.subHeading('4. a new item is code');
    const fresh = parse(((await call('item.get', { id: took(one) || took(his) || '' }, ANDY)).body || {}).item) || {};
    const own = parse(((await call('item.get', { id: took(his) || '' }, ANDY)).body || {}).item) || {};
    if (fresh.code === true && own.code === true) test.check('an item added by item.add is code, his and the agent\'s');
    else test.fail(OWED + 'a new item reads code ' + short(fresh.code) + ' (agent\'s) and ' + short(own.code) + ' (his)');
  } finally {
    try { kid.kill(); } catch (e) { /* gone */ }
  }
}

main().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
