'use strict';

// goal/G4.26: an offered Done lights his ❌ once every agent involved in the item has claimed it.
//   Andy, 2026-10-04, to "Should an offered Go or Done count as waiting on you (❌)?" — "only if all agents involved
//   in that item consider it done."; to "Who is involved?" — "took it."; to "An offered Go?" — "i see the go."
//   In the tree: facts.asks (asksOf, desk.js) counts open G and Q checks, open C checks while Done is offered, and one
//   more when Done is offered and every taker has claimed (a code item: once it is verified).
//
// THE SHAPES:
//   1  An item's involved agents are those that took it: item.take, line.take (his "<nick>:" take included) and
//      box.take, by the label they wrote with.
//   2  While Done is offered and every involved agent has claimed it, asks counts one more (so the List row shows
//      ICON.ERROR). An item nobody took counts it from its first claim.
//   3  An offered Go counts nothing (his "i see the go").

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/spirit/appClient.js');

const OWED = 'OWED by goal/G4.26: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskDoneAsksTestCWAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskDoneAsksTestWSLAAAAAAAAAAAAAAAAAAAAA=', label: 'wsl-claude' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskDoneAsksTestOwnerAAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(JSON.stringify(x)).slice(0, 220); }

test.startTest('goal/G4.26: an offered Done lights his ❌ once every agent involved has claimed it');

(async function () {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskdoneasks-'));
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('desk', pipe);
  const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
  const factsOf = async function (id) { const r = await call('item.get', { id: id }, ANDY); try { return JSON.parse((r.body || {}).item) || {}; } catch (e) { return {}; } };
  // The world is seeded before the desk starts, which takes it in at start (goal/G33.7).
  test.seedDesk(state, { goal: { id: 'goal/G100', title: 'Done' }, items: [
    { id: 'goal/G100.1', title: 'Two takers', blocks: ['goal/G100'] }, { id: 'goal/G100.2', title: 'Nobody took it', blocks: ['goal/G100'] },
    { id: 'goal/G100.3', title: 'Only Go', blocks: ['goal/G100'] }] });
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  try {
    for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ } }
    await call('press', { id: 'goal/G100', what: 'end-design' }, ANDY);

    test.subHeading('3. an offered Go counts nothing');
    const go = await factsOf('goal/G100.3');
    if (go.buttons && go.buttons.indexOf('go') !== -1 && go.asks === 0) test.check('goal/G100.3 offers Go and asks 0');
    else test.fail('goal/G100.3: ' + short({ buttons: go.buttons, asks: go.asks }));

    test.subHeading('1-2. two agents took it: Done counts once both have claimed');
    await call('press', { id: 'goal/G100.1', what: 'go' }, ANDY);
    await call('item.take', { id: 'goal/G100.1' }, CW);
    await call('chat.add', { id: 'goal/G100.1', text: 'his line' }, ANDY);
    await call('line.take', { id: 'goal/G100.1' }, WSL);
    await call('chat.add', { id: 'goal/G100.1', text: 'wsl-claude answers' }, WSL);
    await call('press', { id: 'goal/G100.1', what: 'claim-done' }, CW);
    // goal/G33.3: Done is offered as soon as an agent claims done.
    const one = await factsOf('goal/G100.1');
    if (one.buttons && one.buttons.indexOf('done') !== -1 && one.asks === 0) test.check('claimed by claude-windows alone: Done is offered, asks 0 (wsl-claude took it too)');
    else test.fail(OWED + 'after one of two claims: ' + short({ buttons: one.buttons, asks: one.asks }));
    await call('press', { id: 'goal/G100.1', what: 'claim-done' }, WSL);
    const both = await factsOf('goal/G100.1');
    if (both.asks === 1) test.check('claimed by both takers: asks 1, his ❌');
    else test.fail(OWED + 'after both claims asks is ' + short(both.asks));
    const list = await call('items.search', { text: 'Two takers', currentGoalOnly: false, goalsOnly: false, includeClosed: false }, ANDY);
    let row = null; try { row = JSON.parse(((list.body || {}).items || [])[0].label); } catch (e) { row = null; }
    if (row && row.asks === 1) test.check('the List row carries asks 1 too');
    else test.fail(OWED + 'the List row: ' + short(row && row.asks));

    test.subHeading('2. nobody took it: Done counts from its first claim');
    await call('press', { id: 'goal/G100.2', what: 'go' }, ANDY);
    await call('press', { id: 'goal/G100.2', what: 'claim-done' }, CW);
    // goal/G33.3: Done is offered as soon as an agent claims done.
    const lone = await factsOf('goal/G100.2');
    if (lone.asks === 1) test.check('goal/G100.2, claimed once and taken by nobody: asks 1');
    else test.fail(OWED + 'goal/G100.2 after one claim: asks ' + short(lone.asks));
    await call('press', { id: 'goal/G100.2', what: 'done' }, ANDY);
    const after = await factsOf('goal/G100.2');
    if (after.asks === 0) test.check('once he pressed Done, nothing waits: asks 0');
    else test.fail(OWED + 'after his Done asks is ' + short(after.asks));
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
