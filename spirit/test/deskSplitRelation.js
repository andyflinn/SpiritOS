'use strict';

// goal/G9.4: a split adds only the explicit blocking relation. Red on today's tree; claude-windows wrote it from
// G9.4's box and does not build it.
//   Andy, 2026-10-07: "when splitting an item, only the new explicit blocking relationship is automatically added, the
//   implicit blocking will not need to be specified, it clutters the list display with confusing \"blocks\" and
//   \"waits on\" columns, and is not needed for a dependency graph."
//   Andy, 2026-10-07, on Q1: "the new split-items always block the item from which they were split, items blocked by
//   the current item are still blocked by the newly split item, because if theyre blocked by me, they are implicitly
//   blocked by the newly created/split item." (rule/6 says the same.)
//
// WHAT IS TRUE TODAY (read in the tree at 7cd6d633): a split is a session.set naming split: [parent]; each item's
// blocks are what the session sends, and an item sent without blocks blocks the goal (desk.js, the session.set
// branch: `[x.blocks || gid]`). Nothing adds new-blocks-parent, and nothing keeps the implicit ones out.
//
// WHAT IS ASSERTED: an item new in a split session blocks exactly the parent, whether the session named the parent,
// named nothing, or named the implicit ones too; the parent keeps what it blocked; what the parent blocks is not
// told about the new item.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G9.4: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskSplitRelationTestCWAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskSplitRelationTestOwnerAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }
function same(a, b) { return JSON.stringify((a || []).slice().sort()) === JSON.stringify((b || []).slice().sort()); }

test.startTest('goal/G9.4: a split adds only the explicit blocking relation');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desksplitrelation-'));
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

const G = 'sr/G1';
const P = 'sr/G1.1';       // the item he splits
const Q = 'sr/G1.2';       // an item the parent blocks
const BASE = [
  { id: P, title: 'He splits this one', blocks: [G, Q], code: true },
  { id: Q, title: 'Waits on the parent', blocks: [G], code: true },
];

(async function () {
  if (!await start()) { test.fail('the desk server did not start'); return; }
  await call('session.set', { json: JSON.stringify({ goal: { id: G, title: 'Split' }, items: BASE }) }, CW);
  const p0 = await facts(P);
  if (same(p0.blocking, [G, Q])) test.check('the world: ' + P + ' blocks the goal and ' + Q);
  else { test.fail('the world: ' + P + ' blocks ' + short(p0.blocking)); return; }

  // THE SPLIT: three new items, sent the three ways a session can send them.
  const res = await call('session.set', { json: JSON.stringify({ goal: { id: G, title: 'Split' }, split: [P], items: BASE.concat([
    { id: 'sr/G1.3', title: 'New, the parent named', blocks: [P] },
    { id: 'sr/G1.4', title: 'New, nothing named' },
    { id: 'sr/G1.5', title: 'New, the implicit ones named too', blocks: [P, G, Q] },
  ]) }) }, CW);
  const marked = await facts(P);
  if (res.status === 200 && marked.subGoal === true) test.check('the split lands: ' + P + ' is a sub-goal');
  else { test.fail('the split did not land: ' + res.status + ' ' + short(res.body) + '; ' + P + ' ' + short(marked)); return; }

  test.subHeading('1. each new item blocks the parent, and nothing else');
  for (const id of ['sr/G1.3', 'sr/G1.4', 'sr/G1.5']) {
    const f = await facts(id);
    if (same(f.blocking, [P])) test.check(id + ' blocks ' + P + ' alone');
    else test.fail(OWED + id + ' blocks ' + short(f.blocking) + ', not [' + P + '] alone');
  }

  test.subHeading('2. the parent keeps what it blocked, and is blocked by its new items');
  const p1 = await facts(P);
  if (same(p1.blocking, [G, Q])) test.check(P + ' still blocks the goal and ' + Q);
  else test.fail(OWED + 'after the split ' + P + ' blocks ' + short(p1.blocking));
  if (same(p1.blocked, ['sr/G1.3', 'sr/G1.4', 'sr/G1.5'])) test.check(P + ' waits on its three new items');
  else test.fail(OWED + P + ' waits on ' + short(p1.blocked));

  test.subHeading('3. what the parent blocks is not told about the new items');
  const q1 = await facts(Q);
  if (same(q1.blocked, [P])) test.check(Q + ' waits on ' + P + ' alone, the new items reaching it through the parent');
  else test.fail(OWED + Q + ' waits on ' + short(q1.blocked));
  const g1 = await facts(G);
  const strays = (g1.blocked || []).filter(function (id) { return ['sr/G1.3', 'sr/G1.4', 'sr/G1.5'].indexOf(id) !== -1; });
  if (!strays.length) test.check('the goal does not list the new items among its blockers');
  else test.fail(OWED + 'the goal waits on ' + short(strays) + ' directly');
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
