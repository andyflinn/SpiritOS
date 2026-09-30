'use strict';

// desk/G3.2 and desk/G3.4, the desk server's half.
//   G3.2  Andy: "and at startup, it should show the latest state" (the new Desk opened empty once every item and
//         the goal were closed).
//   G3.4  Andy: "i should have a go-all button for fixing rounds".
// The contract the builder follows (wsl-claude's picks where the box names no shape):
//   G3.2  items.search {text: '', currentGoalOnly: true} while the current goal is closed answers that goal and its
//         items, each marked status 'closed', with no buttons. While the current goal is open nothing changes: a
//         closed item stays off the List ("Close makes item invisible"). An abandoned goal stays invisible.
//   G3.4  The goal's buttons include 'go-all' while at least one of its items offers 'go'. press {id: <goal>,
//         what: 'go-all', by: 'andy'} does a go on each item that offers one, and no other; it is Andy's alone
//         (not-owner for an agent) and refused as not-offered when no item offers go.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const G32 = 'OWED by desk/G3.2: ';
const G34 = 'OWED by desk/G3.4: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test.startTest('desk/G3.2 and G3.4: the latest state at startup, and Go all');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desklatest-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', pipe);
const call = function (verb, args) { const b = {}; b[verb] = args; return client.ask({ desk: b }).then(function (r) { return r || {}; }, function () { return {}; }); };
let kid = null;
async function start() {
  kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) return true; } catch (e) { /* not yet */ }
  }
  return false;
}
async function items(args) {
  const r = await call('items.search', Object.assign({ text: '', currentGoalOnly: true, goalsOnly: false }, args || {}));
  const by = {};
  (((r.body || {}).items) || []).forEach(function (i) { try { const o = JSON.parse(i.label); by[o.id] = o; } catch (e) { /* not one */ } });
  return by;
}
const press = function (id, what, by) { return call('press', { id: id, what: what, by: by || 'andy' }); };
const has = function (it, b) { return !!(it && Array.isArray(it.buttons) && it.buttons.indexOf(b) !== -1); };

(async function () {
  if (!(await start())) { test.fail('the desk server did not start'); return; }

  // ── G3.4: Go all ──────────────────────────────────────────────────────
  // A goal with three items: A and B unblocked, C blocked by A.
  await call('session.set', { json: JSON.stringify({ goal: { id: 'g/G1', title: 'Fixing round' }, items: [
    { id: 'g/G1.1', title: 'A', blocks: ['g/G1.3'] }, { id: 'g/G1.2', title: 'B', blocks: ['g/G1'] }, { id: 'g/G1.3', title: 'C', blocks: ['g/G1'] },
  ] }), by: 'claude-windows' });
  test.subHeading('G3.4: the goal offers Go all only once design has ended');
  let by = await items();
  if (by['g/G1'] && !has(by['g/G1'], 'go-all')) test.check('in design mode the goal offers no Go all');
  else test.fail(G34 + 'in design mode the goal has ' + JSON.stringify(by['g/G1'] && by['g/G1'].buttons));
  await press('g/G1', 'end-design');
  by = await items();
  if (has(by['g/G1'], 'go-all')) test.check('after end-design, with A and B offering Go!, the goal offers go-all');
  else test.fail(G34 + 'after end-design the goal has ' + JSON.stringify(by['g/G1'] && by['g/G1'].buttons));

  test.subHeading('G3.4: Go all is Andy\'s alone');
  const agent = await press('g/G1', 'go-all', 'wsl-claude');
  by = await items();
  if (agent.body && agent.body.code === 'not-owner' && has(by['g/G1.1'], 'go') && has(by['g/G1.2'], 'go')) test.check('an agent\'s go-all is refused not-owner and changes nothing');
  else test.fail(G34 + 'an agent\'s go-all answered ' + agent.status + ', A ' + JSON.stringify(by['g/G1.1'] && by['g/G1.1'].buttons));

  test.subHeading('G3.4: Go all goes on every item that offers Go!, and no other');
  const all = await press('g/G1', 'go-all');
  by = await items();
  const a = by['g/G1.1'] || {};
  const b = by['g/G1.2'] || {};
  const c = by['g/G1.3'] || {};
  if (all.status === 200 && a.status === 'running' && b.status === 'running' && c.status !== 'running' && !has(a, 'go') && !has(b, 'go')) {
    test.check('A and B are running; C, blocked by A, is not');
  } else test.fail(G34 + 'after go-all: ' + JSON.stringify({ status: all.status, A: a.status, B: b.status, C: c.status }));
  if (a.status === 'running' && !has(by['g/G1'], 'go-all')) test.check('with nothing left offering Go!, the goal offers no Go all');
  else test.fail(G34 + 'the goal still offers go-all');
  const none = await press('g/G1', 'go-all');
  if (none.status === 409 && none.body && none.body.code === 'not-offered') test.check('a go-all with nothing to go is refused not-offered');
  else test.fail(G34 + 'a go-all with nothing to go answered ' + JSON.stringify({ status: none.status, body: none.body }));

  // ── G3.2: the latest state ─────────────────────────────────────────────
  test.subHeading('G3.2: an open goal still hides its closed items');
  await press('g/G1.2', 'claim-done', 'wsl-claude');
  await press('g/G1.2', 'done');
  await press('g/G1.2', 'close');
  by = await items();
  if (by['g/G1'] && !by['g/G1.2'] && by['g/G1.1']) test.check('with g/G1 open, closed B is off the List');
  else test.fail('with the goal open the List holds ' + JSON.stringify(Object.keys(by)));

  test.subHeading('G3.2: once the current goal is closed, Desk opens on it, marked closed');
  for (const id of ['g/G1.1', 'g/G1.3', 'g/G1']) {
    if (id !== 'g/G1') await press(id, 'go');
    await press(id, 'claim-done', 'wsl-claude');
    await press(id, 'done');
    await press(id, 'close');
  }
  by = await items();
  const ids = Object.keys(by).sort();
  const allClosed = ids.length === 4 && ids.every(function (id) { return by[id].status === 'closed' && Array.isArray(by[id].buttons) && by[id].buttons.length === 0; });
  if (allClosed) test.check('the closed goal and its three items are listed, each closed, with no buttons');
  else test.fail(G32 + 'with the current goal closed the List holds ' + JSON.stringify(ids.map(function (id) { return [id, by[id].status, by[id].buttons]; })));

  test.subHeading('G3.2: an abandoned goal stays invisible');
  await call('session.set', { json: JSON.stringify({ goal: { id: 'g/G2', title: 'Dropped' }, items: [{ id: 'g/G2.1', title: 'D', blocks: ['g/G2'] }] }), by: 'claude-windows' });
  await press('g/G2', 'abandon');
  by = await items();
  if (!by['g/G2'] && !by['g/G2.1']) test.check('the abandoned current goal and its item are not listed');
  else test.fail(G32 + 'an abandoned goal is listed: ' + JSON.stringify(Object.keys(by)));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  if (kid) kid.kill();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
