'use strict';

// goal/G5.6: the desk server, a goal gets a Close. Red on today's tree; wsl-claude wrote it from G5.6's box and does
// not build it (claude-windows builds).
//   Andy, 2026-10-05, to goal/G5 Q1 ("a goal gets a Close like an item's (off the List, still searchable, Reopen brings
//   it back), so goal/G4 can close with its two deferred items still open?"): "yes. if it has items still open it can
//   ask me: are you sure?"; his Go on goal/G5.6.
//   In the tree: a goal offers Done only when every item is done or closed, and never Close (desk.js buttons(),
//   498-517).
//
// THE SHAPES (G5.6's box):
//   1  a goal offers Close always, even with items open; his press alone (an agent's is refused).
//   2  pressed, the goal is closed and offers Reopen; it leaves the List with its items, and Include Closed finds both.
//   3  its open items stay as they are (not closed, not done).
//   4  Reopen brings it back to the List, offering Close again.
// NOT HERE: the "are you sure?" while items are open is the face's (the box: "the server takes the press either way").

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G5.6: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskGoalCloseTestCWAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskGoalCloseTestOwnerAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }

test.startTest('goal/G5.6: a goal gets a Close');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskgoalclose-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', pipe);
const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
let kid = null;

async function facts(id) {
  const r = await call('item.get', { id: id }, ANDY);
  try { return JSON.parse(r.body.item); } catch (e) { return {}; }
}
async function listed(includeClosed) {
  const r = await call('items.search', { text: '', currentGoalOnly: false, goalsOnly: false, includeClosed: includeClosed }, ANDY);
  return ((r.body && r.body.items) || []).map(function (i) { return i.key; });
}

(async function () {
  kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ } }
  await call('session.set', { json: JSON.stringify({ goal: { id: 'c/G1', title: 'Closable' }, items: [
    { id: 'c/G1.1', title: 'Still open', blocks: ['c/G1'] },
    { id: 'c/G1.2', title: 'Also open', blocks: ['c/G1'] },
  ] }) }, CW);
  const g0 = await facts('c/G1');
  if (!g0.id) { test.fail('the world: the goal c/G1 was not made: ' + short(g0)); return; }

  test.subHeading('1. a goal with open items offers Close, his alone');
  if ((g0.buttons || []).indexOf('close') !== -1) test.check('the goal offers Close while its items are open');
  else test.fail(OWED + 'the goal with open items offers ' + short(g0.buttons));
  const byAgent = await call('press', { id: 'c/G1', what: 'close' }, CW);
  const stillOpen = await facts('c/G1');
  if (byAgent.status !== 200 && stillOpen.status !== 'closed') test.check('an agent\'s Close on the goal is refused (' + short(byAgent.body && byAgent.body.code) + ')');
  else test.fail('an agent closed the goal: ' + byAgent.status + ' ' + short(byAgent.body));

  test.subHeading('2. pressed, the goal is closed and leaves the List');
  const item0 = await facts('c/G1.1');
  const pressed = await call('press', { id: 'c/G1', what: 'close' }, ANDY);
  const g1 = await facts('c/G1');
  if (pressed.status === 200 && g1.status === 'closed' && JSON.stringify(g1.buttons) === JSON.stringify(['reopen'])) test.check('his Close closes the goal, which then offers Reopen alone');
  else test.fail(OWED + 'his Close answered ' + pressed.status + ' ' + short(pressed.body) + '; the goal reads ' + short({ status: g1.status, buttons: g1.buttons }));
  const plain = await listed(false);
  const all = await listed(true);
  if (pressed.status === 200 && plain.indexOf('c/G1') === -1 && plain.indexOf('c/G1.1') === -1 && all.indexOf('c/G1') !== -1 && all.indexOf('c/G1.1') !== -1) test.check('the closed goal and its items are off the List, and Include Closed finds both');
  else test.fail(OWED + 'after Close the List holds ' + short(plain) + '; with Include Closed ' + short(all));

  test.subHeading('3. its open items stay as they are');
  const item1 = await facts('c/G1.1');
  if (pressed.status === 200 && item1.status === item0.status && item1.status !== 'closed' && item1.status !== 'done') test.check('c/G1.1 keeps its status (' + short(item1.status) + ')');
  else test.fail(OWED + 'c/G1.1 went from ' + short(item0.status) + ' to ' + short(item1.status));

  test.subHeading('4. Reopen brings it back');
  const back = await call('press', { id: 'c/G1', what: 'reopen' }, ANDY);
  const g2 = await facts('c/G1');
  const again = await listed(false);
  if (pressed.status === 200 && back.status === 200 && g2.status !== 'closed' && (g2.buttons || []).indexOf('close') !== -1 && again.indexOf('c/G1') !== -1) test.check('Reopen puts the goal back on the List, offering Close again');
  else test.fail(OWED + 'Reopen answered ' + back.status + ' ' + short(back.body) + '; the goal reads ' + short({ status: g2.status, buttons: g2.buttons }) + '; listed ' + (again.indexOf('c/G1') !== -1));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { kid && kid.kill(); } catch (e) { /* gone */ }
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
