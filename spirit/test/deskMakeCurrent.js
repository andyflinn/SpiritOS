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
const appClient = require('../run/spirit/appClient.js');

const OWED = 'OWED by goal/G2.19: ';
const DESK_DIR = path.join(__dirname, '..', 'run', 'process', 'js', 'desk');
const SERVER = path.join(DESK_DIR, 'desk.js');
const MANIFEST = path.join(DESK_DIR, 'desk.json');
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
  // TWO GOALS, the second written last, so it is the current one by today's only rule.
  // goal/G29.21: an agent's session creates no goal, so the owner writes the world. goal/G33.7: session.set went; the
  // two sessions are seeded before the desk starts, and the desk takes them in at start, the last one current.
  test.seedDesk(state, [
    { goal: { id: 'goal/G100', title: 'First' }, items: [{ id: 'goal/G100.1', title: 'One', blocks: ['goal/G100'] }] },
    { goal: { id: 'goal/G101', title: 'Second' }, items: [{ id: 'goal/G101.1', title: 'Two', blocks: ['goal/G101'] }] },
  ]);
  if (!await start()) { test.fail('the desk server did not start'); return; }
  const opened = await currentGoal();
  if (opened === 'goal/G101') test.check('the goal written last is the current one, as the seeded sessions leave it');
  else { test.fail('the world: the current goal reads ' + short(opened) + ', expected goal/G101'); return; }

  test.subHeading('1. the older goal offers make-current, the current one does not');
  const f1 = await factsOf('goal/G100');
  if ((f1.buttons || []).indexOf('make-current') !== -1) test.check('goal/G100, open and not current, offers make-current');
  else test.fail(OWED + 'goal/G100 offers ' + short(f1.buttons));
  const f2 = await factsOf('goal/G101');
  if ((f2.buttons || []).indexOf('make-current') === -1) test.check('goal/G101, already current, does not offer it');
  else test.fail(OWED + 'the current goal offers make-current: ' + short(f2.buttons));
  const fi = await factsOf('goal/G100.1');
  if ((fi.buttons || []).indexOf('make-current') === -1) test.check('an item never offers it');
  else test.fail(OWED + 'the item goal/G100.1 offers make-current: ' + short(fi.buttons));

  test.subHeading('2. his press moves the current goal, and an agent\'s is refused');
  const byAgent = await call('press', { id: 'goal/G100', what: 'make-current' }, CW);
  if (!took(byAgent) && await currentGoal() === 'goal/G101') test.check('an agent\'s make-current is refused and moves nothing');
  else test.fail(OWED + 'an agent\'s make-current answered ' + byAgent.status + ' ' + short(byAgent.body) + '; current ' + short(await currentGoal()));
  const byHim = await call('press', { id: 'goal/G100', what: 'make-current' }, ANDY);
  const now = await currentGoal();
  if (took(byHim) && now === 'goal/G100') test.check('his make-current on goal/G100 makes it the current goal');
  else test.fail(OWED + 'his make-current answered ' + byHim.status + ' ' + short(byHim.body) + '; current reads ' + short(now));
  const back = await factsOf('goal/G101');
  if ((back.buttons || []).indexOf('make-current') !== -1) test.check('goal/G101 now offers it instead');
  else test.fail(OWED + 'after the switch goal/G101 offers ' + short(back.buttons));

  test.subHeading('3. it switches the goal and changes nothing else about either');
  const a1 = await factsOf('goal/G100');
  const a2 = await factsOf('goal/G101');
  if (a1.status !== 'closed' && a2.status !== 'closed' && a1.design === f1.design && a2.design === f2.design) test.check('neither goal is closed by the switch, and neither design mode moved');
  else test.fail(OWED + 'after the switch goal/G100 ' + short({ status: a1.status, design: a1.design }) + ', goal/G101 ' + short({ status: a2.status, design: a2.design }));
  const listed = await call('items.search', { text: '', currentGoalOnly: true, goalsOnly: false, includeClosed: false }, ANDY);
  const ids = (((listed.body && listed.body.items) || []).map(function (i) { return (parse(i.label) || {}).id; }));
  if (ids.indexOf('goal/G100.1') !== -1 && ids.indexOf('goal/G101.1') === -1) test.check('the List now answers goal/G100\'s items and not goal/G101\'s');
  else test.fail(OWED + 'the current List answers ' + short(ids));

  test.subHeading('4. a closed goal is not made current; Reopen first, as his words have it');
  await call('press', { id: 'goal/G101', what: 'close' }, ANDY);
  const onClosed = await call('press', { id: 'goal/G101', what: 'make-current' }, ANDY);
  if (!took(onClosed) && await currentGoal() === 'goal/G100') test.check('make-current on a closed goal is refused');
  else test.fail(OWED + 'make-current on the closed goal/G101 answered ' + onClosed.status + ' ' + short(onClosed.body) + '; current ' + short(await currentGoal()));
  await call('press', { id: 'goal/G101', what: 'reopen' }, ANDY);
  const afterReopen = await call('press', { id: 'goal/G101', what: 'make-current' }, ANDY);
  if (took(afterReopen) && await currentGoal() === 'goal/G101') test.check('reopened, it takes make-current and becomes current');
  else test.fail(OWED + 'after Reopen make-current answered ' + afterReopen.status + ' ' + short(afterReopen.body) + '; current ' + short(await currentGoal()));

  // GROWN IN THE VERIFY (goal/G5.7: "after an all-green build it's the verifier that extends the red"). The build
  // rewrote currentGoal.json on a make-current and claude-windows said so itself, the red never having asked for it;
  // removing that rewrite left this suite wholly green, so it was behaviour nobody held. It matters because the file
  // names the current goal and carries THAT goal's items alone (desk.js writeGoalFile), so the agents and the brain
  // would go on reading the goal he had just left.
  test.subHeading('5. the switch rewrites currentGoal.json, which every other reader goes by');
  const defaults = (function () {
    const m = (function () { try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) { return {}; } })();
    const out = {};
    (Array.isArray(m.args) ? m.args : []).forEach(function (x) { if (x && x.name) out[x.name] = x.default; });
    return out;
  }());
  // Sharing is on only when the argument naming the file is given (desk.js GOAL_SHARED), as deskGoalFile has it.
  const fileArg = Object.keys(defaults).filter(function (k) { return /currentGoal\.json$/.test(String(defaults[k])); })[0] || '';
  const shared = Object.assign({}, defaults);
  if (fileArg) shared[fileArg] = 'spirit/run/process/js/desk/currentGoal.json';
  const two = path.join(scratch, 'shared');
  const twoState = path.join(two, 'state');
  fs.mkdirSync(twoState, { recursive: true });
  const twoPipe = process.platform === 'win32' ? appClient.pipePathFor(two, 'desk', 'win32', 'process') : path.join(two, 'door.sock');
  const twoClient = appClient.createAppClient({ rootDir: two });
  twoClient.register('desk', twoPipe);
  // goal/G29.21: an agent's session creates no goal, so the owner writes the world; goal/G33.7: seeded (session.set went).
  test.seedDesk(twoState, [
    { goal: { id: 'goal/G102', title: 'First' }, items: [{ id: 'goal/G102.1', title: 'One', blocks: ['goal/G102'] }] },
    { goal: { id: 'goal/G103', title: 'Second' }, items: [{ id: 'goal/G103.1', title: 'Two', blocks: ['goal/G103'] }] },
  ]);
  const kid2 = spawn(process.execPath, [SERVER, JSON.stringify(shared), '--pipe', twoPipe, '--state', twoState], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await twoClient.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ } }
  const ask = function (verb, args, caller) { const q = {}; q[verb] = args; return twoClient.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
  const goalFile = path.join(twoState, 'currentGoal.json');
  const readFile = function () { try { return JSON.parse(fs.readFileSync(goalFile, 'utf8')); } catch (e) { return null; } };
  try {
    // The seeded sessions were taken in at start, before any write, so the file comes with his first switch; two of them
    // leave goal/G103 current again, the goal written last.
    await ask('press', { id: 'goal/G102', what: 'make-current' }, ANDY);
    await ask('press', { id: 'goal/G103', what: 'make-current' }, ANDY);
    await sleep(300);
    const before = readFile();
    if (before && before.goal === 'goal/G103') test.check('the file names the goal written last, goal/G103');
    else { test.fail('the world: the shared desk wrote ' + short(before)); throw new Error('no file'); }
    const press = await ask('press', { id: 'goal/G102', what: 'make-current' }, ANDY);
    await sleep(300);
    const after = readFile();
    if (!took(press)) test.fail(OWED + 'make-current on the sharing desk answered ' + press.status + ' ' + short(press.body));
    else if (after && after.goal === 'goal/G102') test.check('after the switch the file names goal/G102, not the goal he left');
    else test.fail(OWED + 'after make-current the file still says ' + short(after && after.goal) + ': ' + short(after));
    const ids = after && Array.isArray(after.items) ? after.items.map(function (x) { return x.id; }) : [];
    if (ids.indexOf('goal/G102.1') !== -1 && ids.indexOf('goal/G103.1') === -1) test.check('and it carries goal/G102\'s items alone');
    else test.fail(OWED + 'the file carries ' + short(ids));
  } catch (e) { if (!/no file/.test(String(e && e.message))) test.fail('the sharing desk threw: ' + (e && e.stack || e)); }
  await new Promise(function (r) { if (!kid2) return r(); kid2.once('exit', r); kid2.kill(); setTimeout(r, 3000); });
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
