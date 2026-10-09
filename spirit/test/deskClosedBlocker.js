'use strict';

// goal/G9.17, change 1: a closed item blocks nothing. Red on today's tree; wsl-claude wrote it from G9.17's box and
// does not build it.
//   Found by the review of goal/G10 on 2026-10-09: the goal read blocked by Configuration manager (goal/G10.4)
//   after Andy had closed it. Andy: "fine. add it."
//
// WHAT IS TRUE TODAY (read in the tree at d6e9df7d): blockers() drops a member only when it is done or left out of a
// session (desk.js:750, `!o.done && !o.leftOut`), so a merely closed item still counts. Both readers inherit it: the
// facts an item answers with (blocked, desk.js:1002) and the Go rule, which offers Go only on an item nothing blocks
// (desk.js:810).
//
// WHAT IS ASSERTED: a closed blocker leaves the blockers as a done one does, in the facts and in the Go rule alike;
// a done blocker is unchanged; and a reopened one blocks again.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G9.17: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const AGENT = { key: 'MCowBQYDK2VwAyEAdeskClosedBlockerTestAgentAAAAAAAAAA=', label: 'wsl-claude' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskClosedBlockerTestOwnerAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }
function same(a, b) { return JSON.stringify((a || []).slice().sort()) === JSON.stringify((b || []).slice().sort()); }

test.startTest('goal/G9.17: a closed item blocks nothing');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskclosedblocker-'));
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
async function facts(id) { const r = await call('item.get', { id: id }, ANDY); return parse(r.body && r.body.item) || {}; }
async function press(id, what, who) { return call('press', { id: id, what: what }, who || ANDY); }

(async function () {
  if (!await start()) { test.fail('the desk server did not start'); return; }
  const g = await call('goal.add', { title: 'Closed blockers' }, AGENT);
  const gid = g.body && g.body.id;
  if (!gid) { test.fail('the goal was not minted: ' + short(g.body)); return; }
  const a = await call('item.add', { goal: gid, title: 'The one that waits' }, AGENT);
  const A = a.body && a.body.id;
  const b = await call('item.add', { goal: gid, title: 'The blocker to close', blocks: A }, AGENT);
  const B = b.body && b.body.id;
  const c = await call('item.add', { goal: gid, title: 'The blocker to finish', blocks: A }, AGENT);
  const C = c.body && c.body.id;
  if (!A || !B || !C) { test.fail('the items were not minted: ' + short([a.body, b.body, c.body])); return; }

  // A GOAL IS BORN IN DESIGN MODE, and no item offers Go while it lasts (desk.js:810), so design ends here: this
  // suite is about blockers, not about design mode.
  const ended = await press(gid, 'end-design');
  const gf = await facts(gid);
  if (gf.design !== true) test.check('the world: design mode is off on the goal, so Go turns on blockers alone');
  else { test.fail('the suite could not end design on ' + gid + ': ' + short(ended.body) + '; ' + short(gf)); return; }

  const a0 = await facts(A);
  if (same(a0.blocked, [B, C])) test.check('the world: ' + A + ' waits on both blockers');
  else { test.fail('the world: ' + A + ' waits on ' + short(a0.blocked) + ', not on ' + B + ' and ' + C); return; }
  if ((a0.buttons || []).indexOf('go') === -1) test.check('the world: ' + A + ' offers no Go while it is blocked');
  else { test.fail('the world: ' + A + ' already offers Go with two blockers open: ' + short(a0.buttons)); return; }

  test.subHeading('1. a done blocker leaves the blockers, as it does today');
  await press(C, 'go');
  await press(C, 'claim-done', AGENT);
  const cDone = await press(C, 'done');
  const cf = await facts(C);
  if (cf.status === 'done') test.check(C + ' is done');
  else { test.fail('the suite could not get ' + C + ' done: ' + short(cDone.body) + '; ' + short(cf)); return; }
  const a1 = await facts(A);
  if (same(a1.blocked, [B])) test.check(A + ' waits on the open blocker alone once the other is done');
  else test.fail('the world moved: ' + A + ' waits on ' + short(a1.blocked) + ' with ' + C + ' done');

  test.subHeading('2. a closed blocker leaves them too');
  const closed = await press(B, 'close');
  const bf = await facts(B);
  if (bf.status === 'closed') test.check(B + ' is closed');
  else { test.fail('the suite could not close ' + B + ': ' + short(closed.body) + '; ' + short(bf)); return; }
  const a2 = await facts(A);
  if (same(a2.blocked, [])) test.check(A + ' waits on nothing: a closed blocker counts as gone');
  else test.fail(OWED + A + ' still waits on ' + short(a2.blocked) + ' with ' + B + ' closed');

  test.subHeading('3. and the Go rule reads it the same way');
  if ((a2.buttons || []).indexOf('go') !== -1) test.check(A + ' offers Go with its blockers done and closed');
  else test.fail(OWED + A + ' offers ' + short(a2.buttons) + ', no Go, although nothing open blocks it');

  test.subHeading('4. a reopened blocker blocks again');
  const back = await press(B, 'reopen');
  const bf2 = await facts(B);
  if (bf2.status !== 'closed') test.check(B + ' is open again');
  else { test.fail('the suite could not reopen ' + B + ': ' + short(back.body) + '; ' + short(bf2)); return; }
  const a3 = await facts(A);
  if (same(a3.blocked, [B])) test.check(A + ' waits on ' + B + ' again');
  else test.fail(OWED + 'after the reopen ' + A + ' waits on ' + short(a3.blocked));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
