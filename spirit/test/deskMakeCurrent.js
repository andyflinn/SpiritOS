'use strict';

// goal/G2.19: a press makes any open goal the current one. Red on today's tree; wsl-claude wrote it from G2.19's
// box and does not build it.
//   Andy, 2026-10-06, under goal/G2.18: "i want to switch between goals at will, so the goals detail should give me
//   re-open and and on any open goal i want a button \"make current goal\"", opening it after he reopened goal/G2
//   by hand and an agent had to write a session to make it current again.
//
// WHAT IS TRUE TODAY (G2.19's box, read in the tree at 9ece24a8): the current goal moves for one reason only, a
// session.set (process/js/desk/desk.js, the session.set branch of the walk: `s.current = gid`). Reopen takes a
// closed goal back onto the List and leaves the current goal where it was. So switching goals needs an agent to
// write a session, which is the thing he asked to stop doing.
//
// THE SHAPE (G2.19's box): a press value, `make-current`, his alone (OWNER_PRESSES), taken on an open goal and
// refused anywhere else; it sets the current goal and nothing else about either goal. The goal's `buttons` offers
// it while the goal is open and not already current, so the dialog draws it as it draws every button
// (desk/G2.7: "Buttons come from item.buttons only"). The dialog's own button is the builder's to add and is not
// asserted here; what the page needs is the button in `buttons`.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G2.19: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskMakeCurrentTestCWAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskMakeCurrentTestOwnerAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }

test.startTest('goal/G2.19: a press makes any open goal the current one');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskmakecurrent-'));
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
// WHICH GOAL THE DESK CALLS CURRENT, read the way the List reads it: a currentGoalOnly search answers that goal and
// its items and no other goal's.
async function currentGoal() {
  const r = await call('items.search', { text: '', currentGoalOnly: true, goalsOnly: true, includeClosed: false }, ANDY);
  const rows = ((r.body && r.body.items) || []).map(function (i) { return parse(i.label) || {}; });
  return rows.length ? String(rows[0].id) : '';
}

(async function () {
  if (!await start()) { test.fail('the desk server did not start'); return; }
  // TWO GOALS, the second written last, so it is the current one by today's only rule.
  await call('session.set', { json: JSON.stringify({ goal: { id: 'mc/G1', title: 'First' }, items: [{ id: 'mc/G1.1', title: 'One', blocks: ['mc/G1'] }] }) }, CW);
  await call('session.set', { json: JSON.stringify({ goal: { id: 'mc/G2', title: 'Second' }, items: [{ id: 'mc/G2.1', title: 'Two', blocks: ['mc/G2'] }] }) }, CW);
  const opened = await currentGoal();
  if (opened === 'mc/G2') test.check('the goal written last is the current one, as session.set leaves it');
  else { test.fail('the world: the current goal reads ' + short(opened) + ', expected mc/G2'); return; }

  test.subHeading('1. the older goal offers make-current, the current one does not');
  const f1 = await factsOf('mc/G1');
  if ((f1.buttons || []).indexOf('make-current') !== -1) test.check('mc/G1, open and not current, offers make-current');
  else test.fail(OWED + 'mc/G1 offers ' + short(f1.buttons));
  const f2 = await factsOf('mc/G2');
  if ((f2.buttons || []).indexOf('make-current') === -1) test.check('mc/G2, already current, does not offer it');
  else test.fail(OWED + 'the current goal offers make-current: ' + short(f2.buttons));
  const fi = await factsOf('mc/G1.1');
  if ((fi.buttons || []).indexOf('make-current') === -1) test.check('an item never offers it');
  else test.fail(OWED + 'the item mc/G1.1 offers make-current: ' + short(fi.buttons));

  test.subHeading('2. his press moves the current goal, and an agent\'s is refused');
  const byAgent = await call('press', { id: 'mc/G1', what: 'make-current' }, CW);
  if (!took(byAgent) && await currentGoal() === 'mc/G2') test.check('an agent\'s make-current is refused and moves nothing');
  else test.fail(OWED + 'an agent\'s make-current answered ' + byAgent.status + ' ' + short(byAgent.body) + '; current ' + short(await currentGoal()));
  const byHim = await call('press', { id: 'mc/G1', what: 'make-current' }, ANDY);
  const now = await currentGoal();
  if (took(byHim) && now === 'mc/G1') test.check('his make-current on mc/G1 makes it the current goal');
  else test.fail(OWED + 'his make-current answered ' + byHim.status + ' ' + short(byHim.body) + '; current reads ' + short(now));
  const back = await factsOf('mc/G2');
  if ((back.buttons || []).indexOf('make-current') !== -1) test.check('mc/G2 now offers it instead');
  else test.fail(OWED + 'after the switch mc/G2 offers ' + short(back.buttons));

  test.subHeading('3. it switches the goal and changes nothing else about either');
  const a1 = await factsOf('mc/G1');
  const a2 = await factsOf('mc/G2');
  if (a1.status !== 'closed' && a2.status !== 'closed' && a1.design === f1.design && a2.design === f2.design) test.check('neither goal is closed by the switch, and neither design mode moved');
  else test.fail(OWED + 'after the switch mc/G1 ' + short({ status: a1.status, design: a1.design }) + ', mc/G2 ' + short({ status: a2.status, design: a2.design }));
  const listed = await call('items.search', { text: '', currentGoalOnly: true, goalsOnly: false, includeClosed: false }, ANDY);
  const ids = (((listed.body && listed.body.items) || []).map(function (i) { return (parse(i.label) || {}).id; }));
  if (ids.indexOf('mc/G1.1') !== -1 && ids.indexOf('mc/G2.1') === -1) test.check('the List now answers mc/G1\'s items and not mc/G2\'s');
  else test.fail(OWED + 'the current List answers ' + short(ids));

  test.subHeading('4. a closed goal is not made current; Reopen first, as his words have it');
  await call('press', { id: 'mc/G2', what: 'close' }, ANDY);
  const onClosed = await call('press', { id: 'mc/G2', what: 'make-current' }, ANDY);
  if (!took(onClosed) && await currentGoal() === 'mc/G1') test.check('make-current on a closed goal is refused');
  else test.fail(OWED + 'make-current on the closed mc/G2 answered ' + onClosed.status + ' ' + short(onClosed.body) + '; current ' + short(await currentGoal()));
  await call('press', { id: 'mc/G2', what: 'reopen' }, ANDY);
  const afterReopen = await call('press', { id: 'mc/G2', what: 'make-current' }, ANDY);
  if (took(afterReopen) && await currentGoal() === 'mc/G2') test.check('reopened, it takes make-current and becomes current');
  else test.fail(OWED + 'after Reopen make-current answered ' + afterReopen.status + ' ' + short(afterReopen.body) + '; current ' + short(await currentGoal()));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
