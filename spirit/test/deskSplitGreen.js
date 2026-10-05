'use strict';

// goal/G6.8: a sub-goal only by his split, and design-green tracked by the desk. Red on today's tree; wsl-claude wrote
// it from G6.8's box and does not build it.
//   Andy, 2026-10-06, in goal/G6: "an item becomes a sub-goal only when i say split, the box of that item must then only
//   contain references to it's blockers, and it can no longer be marked as a coding item."; in goal/G6.8: "while you're
//   in DeskServer: can you also make sure that in design mode as well, OPEN is help in red-questions?", "i want
//   mechanical tracking of design-greens. Yes i want opens to light up my list with ERROR icons.", and "accepted." to
//   the box's shape.
//
// THE SHAPES (the box's):
//   1  a session that adds a new item blocking an existing one marks nothing; session.set takes split: [id], and only
//      the item it names is marked sub-goal.
//   2  the split clears that item's code mark, and a later session cannot mark it code again; the mark stays.
//   3  an item is design-green when it has no open red question: facts.green.
//   4  a box.write with an OPEN section is refused.
//   5  his End design is refused while any item of the goal is not design-green.
//   6  a Go, and a go-all, are refused while an item in that scope is not design-green.
// THE NAMES that are wsl-claude's picks (the box names none): the fact is green (true | false); "an OPEN section" is a
// line of the box that starts with the word OPEN in capitals (OPEN:, OPEN on its own line, OPEN followed by a space).
// LEFT OPEN, with the reason, not asserted here:
//   - "its box holds only references to its blockers": the box says the desk does not police that text.
//   - the ERROR on a goal's own row in the List: it is the face's (shell/desk/desk.js), not the desk server's.
//   - whether an item's Go is refused for an open question on ANOTHER item of the goal: "that scope" for a single Go
//     is read here as the item itself, and only go-all is asserted over the goal.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G6.8: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskSplitGreenTestCWAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskSplitGreenTestOwnerAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }

test.startTest('goal/G6.8: a sub-goal only by his split; design-green tracked by the desk');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desksplitgreen-'));
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
async function facts(id) { const r = await call('item.get', { id: id }, ANDY); try { return JSON.parse(r.body.item); } catch (e) { return {}; } }
async function boxOf(id) { const r = await call('item.box', { id: id }, ANDY); return r.body || {}; }
function ok(r) { return r && r.status === 200; }
function session(gid, items, split) {
  const s = { goal: { id: gid, title: gid }, items: items };
  if (split) s.split = split;
  return call('session.set', { json: JSON.stringify(s) }, CW);
}
async function ask(id, words) {
  await call('check.add', { id: id, kind: 'Q', words: words, test: '' }, CW);
  const checks = ((await call('item.checks', { id: id }, ANDY)).body || {}).checks || [];
  const q = checks.filter(function (c) { return c.kind === 'Q' && c.state === 'open'; }).pop();
  return q ? q.number : '';
}
function answer(id, check) { return call('check.set', { id: id, check: check, state: 'passed' }, ANDY); }

(async function () {
  if (!await start()) { test.fail('the desk server did not start'); return; }

  test.subHeading('1. a new blocker alone marks nothing; only the item named in split is a sub-goal');
  await session('S/G1', [{ id: 'S/G1.1', title: 'Gets a blocker in front', blocks: ['S/G1'] },
    { id: 'S/G1.5', title: 'He splits this one', blocks: ['S/G1'], code: true }]);
  const before = await facts('S/G1.5');
  await session('S/G1', [{ id: 'S/G1.1', title: 'Gets a blocker in front', blocks: ['S/G1'] },
    { id: 'S/G1.5', title: 'He splits this one', blocks: ['S/G1'], code: true },
    { id: 'S/G1.2', title: 'A blocker added, no split', blocks: ['S/G1.1'] }]);
  const front = await facts('S/G1.1');
  if (front.subGoal === false && (front.blocked || []).indexOf('S/G1.2') !== -1) test.check('S/G1.1 got a new blocker without a split: facts.subGoal === false');
  else test.fail(OWED + 'a blocker added without a split marked the item: ' + short({ subGoal: front.subGoal, blocked: front.blocked }));

  await session('S/G1', [{ id: 'S/G1.1', title: 'Gets a blocker in front', blocks: ['S/G1'] },
    { id: 'S/G1.5', title: 'He splits this one', blocks: ['S/G1'], code: true },
    { id: 'S/G1.2', title: 'A blocker added, no split', blocks: ['S/G1.1'] },
    { id: 'S/G1.6', title: 'Split part one', blocks: ['S/G1.5'] },
    { id: 'S/G1.7', title: 'Split part two', blocks: ['S/G1.5'] }], ['S/G1.5']);
  const split = await facts('S/G1.5');
  const stillPlain = await facts('S/G1.1');
  if (split.subGoal === true && stillPlain.subGoal === false) test.check('split: [S/G1.5] marks S/G1.5 a sub-goal and leaves S/G1.1 unmarked');
  else test.fail(OWED + 'after split: [S/G1.5]: ' + short({ 'S/G1.5': split.subGoal, 'S/G1.1': stillPlain.subGoal }));

  test.subHeading('2. the split clears the code mark, and it cannot come back');
  if (before.code === true && split.code === false) test.check('S/G1.5 was marked code before the split and is not after it');
  else test.fail(OWED + 'code mark across the split: ' + short({ before: before.code, after: split.code }));
  const again = await session('S/G1', [{ id: 'S/G1.1', title: 'Gets a blocker in front', blocks: ['S/G1'] },
    { id: 'S/G1.5', title: 'He splits this one', blocks: ['S/G1'], code: true },
    { id: 'S/G1.2', title: 'A blocker added, no split', blocks: ['S/G1.1'] },
    { id: 'S/G1.6', title: 'Split part one', blocks: ['S/G1.5'] },
    { id: 'S/G1.7', title: 'Split part two', blocks: ['S/G1.5'] }]);
  const later = await facts('S/G1.5');
  if (later.subGoal === true && later.code === false) test.check('a later session, without split and with code: true on it, leaves S/G1.5 a sub-goal and not code (session answered ' + again.status + ')');
  else test.fail(OWED + 'a later session on the split item: ' + short({ subGoal: later.subGoal, code: later.code, status: again.status }));

  test.subHeading('3. design-green: an item with an open red question is not green');
  await session('D/G1', [{ id: 'D/G1.1', title: 'Asks him', blocks: ['D/G1'] },
    { id: 'D/G1.2', title: 'Asks nothing', blocks: ['D/G1'] },
    { id: 'D/G1.3', title: 'Asked later', blocks: ['D/G1'] }]);
  const q1 = await ask('D/G1.1', 'an open point, as a red question');
  const asking = await facts('D/G1.1');
  const quiet = await facts('D/G1.2');
  if (q1 && asking.green === false && quiet.green === true) test.check('D/G1.1 with an open Q: green false; D/G1.2 with none: green true');
  else test.fail(OWED + 'facts.green: ' + short({ q: q1, 'D/G1.1': asking.green, 'D/G1.2': quiet.green }));

  test.subHeading('4. a box with an OPEN section is refused');
  const box0 = await boxOf('D/G1.2');
  const plain = await call('box.write', { id: 'D/G1.2', text: 'SHAPE\n- the open points are red questions; reopen stays a press\n', version: box0.version }, CW);
  const box1 = await boxOf('D/G1.2');
  const colon = await call('box.write', { id: 'D/G1.2', text: 'SHAPE\n- one thing\n\nOPEN: the shape; his Go.\n', version: box1.version }, CW);
  // His write, on the version the box has now (so a refusal is the OPEN, never box-moved).
  const alone = await call('box.write', { id: 'D/G1.2', text: 'SHAPE\n- one thing\n\nOPEN\n- the shape\n', version: (await boxOf('D/G1.2')).version }, ANDY);
  const box2 = await boxOf('D/G1.2');
  if (ok(plain) && !ok(colon) && !ok(alone) && box2.version === box1.version && !/^OPEN/m.test(String(box2.box))) test.check('a box naming open points in lower case is written; OPEN: and an OPEN heading are refused, his too, and the box is unchanged');
  else test.fail(OWED + 'box writes: ' + short({ plain: plain.status, colon: colon.status, alone: alone.status, versions: [box1.version, box2.version] }));

  test.subHeading('5. End design is refused while an item of the goal is not green');
  const endRefused = await call('press', { id: 'D/G1', what: 'end-design' }, ANDY);
  const stillDesign = await facts('D/G1.2');
  const goWhileDesign = (stillDesign.buttons || []).indexOf('go') !== -1;
  await answer('D/G1.1', q1);
  const endOk = await call('press', { id: 'D/G1', what: 'end-design' }, ANDY);
  const ended = await facts('D/G1.2');
  if (!ok(endRefused) && !goWhileDesign && ok(endOk) && (ended.buttons || []).indexOf('go') !== -1) test.check('End design with an open Q on D/G1.1 is refused (the goal stays in design); once answered it is accepted');
  else test.fail(OWED + 'End design: ' + short({ withOpenQ: endRefused.status, goOffered: goWhileDesign, afterAnswer: endOk.status, buttons: ended.buttons }));

  test.subHeading('6. a Go, and a go-all, are refused while their scope is not green');
  const q3 = await ask('D/G1.3', 'asked after design ended');
  const goRefused = await call('press', { id: 'D/G1.3', what: 'go' }, ANDY);
  const notGone = await facts('D/G1.3');
  const allRefused = await call('press', { id: 'D/G1', what: 'go-all' }, ANDY);
  const sibling = await facts('D/G1.2');
  await answer('D/G1.3', q3);
  const goOk = await call('press', { id: 'D/G1.3', what: 'go' }, ANDY);
  const gone = await facts('D/G1.3');
  if (q3 && !ok(goRefused) && notGone.go === false && ok(goOk) && gone.go === true) test.check('Go on D/G1.3 with an open Q is refused; once answered it is accepted');
  else test.fail(OWED + 'Go on a non-green item: ' + short({ q: q3, refused: goRefused.status, goBefore: notGone.go, afterAnswer: goOk.status, goAfter: gone.go }));
  const allOk = await call('press', { id: 'D/G1', what: 'go-all' }, ANDY);
  const sibling2 = await facts('D/G1.2');
  if (!ok(allRefused) && sibling.go === false && ok(allOk) && sibling2.go === true) test.check('go-all on D/G1 is refused while D/G1.3 has an open Q (D/G1.2 untouched); once green it is accepted');
  else test.fail(OWED + 'go-all over a non-green goal: ' + short({ refused: allRefused.status, siblingGo: sibling.go, afterAnswer: allOk.status, siblingAfter: sibling2.go }));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
