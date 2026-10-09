'use strict';

// goal/G9.14: limbo reads the phase holder, not the agent's listening word. Red on today's tree; claude-windows wrote
// it from G9.14's box and does not build it.
//   Andy, 2026-10-09, under goal/G9.10, to "Open an item to have limbo read the phase holder instead?": "yes"
//
// WHAT IS TRUE TODAY (read in the tree at 603a39bd): limboOf (process/js/desk/desk.js) counts a Go'd item as limbo
// unless one of its takers has the word working; an agent that arms its listener says listening, so every item it
// holds falls back into limbo, and the desk posts its limbo line under it again on the next write.
//
// THE SHAPE ASSERTED (wsl-claude's proposal he said yes to): an item whose phase somebody holds (phaseWith) is not
// limbo, whatever that holder's word; an item whose phase nobody holds is, as before. The desk's limbo line follows
// the same rule. Not asserted: a holder gone silent; the desk's own stale question (10 minutes) already covers that.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G9.14: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskLimboHolderTestCWAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskLimboHolderTestOwnerAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }

test.startTest('goal/G9.14: limbo reads the phase holder, not the agent\'s listening word');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desklimboholder-'));
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
async function facts(id) { const r = await call('item.get', { id: id }, ANDY); return parse(r.body && r.body.item) || {}; }
async function limboLines(id) {
  const r = await call('item.chat', { id: id }, ANDY);
  return ((r.body && r.body.chat) || []).filter(function (l) { return l.by === 'desk' && /^limbo:/.test(String(l.text)); }).length;
}

(async function () {
  if (!await start()) { test.fail('the desk server did not start'); return; }
  await call('session.set', { json: JSON.stringify({ goal: { id: 'lh/G1', title: 'Limbo' }, items: [
    { id: 'lh/G1.1', title: 'Held', blocks: ['lh/G1'], code: true }, { id: 'lh/G1.2', title: 'Other', blocks: ['lh/G1'], code: true }] }) }, CW);
  await call('press', { id: 'lh/G1', what: 'end-design' }, ANDY);
  const go = await call('press', { id: 'lh/G1.1', what: 'go' }, ANDY);
  await call('agent.state', { word: 'working' }, CW);
  const take = await call('phase.take', { id: 'lh/G1.1', phase: 'red' }, CW);
  const f0 = await facts('lh/G1.1');
  if (took(go) && took(take) && f0.with === 'claude-windows' && f0.limbo === false) test.check('the world: Go on lh/G1.1, claude-windows holds its red and is working, so it is not limbo');
  else { test.fail('the world: go ' + go.status + ', take ' + take.status + ' ' + short(take.body) + ', facts ' + short({ with: f0.with, limbo: f0.limbo, phase: f0.phase })); return; }

  test.subHeading('1. the holder going back to listening leaves the item out of limbo');
  const before = await limboLines('lh/G1.1');
  await call('agent.state', { word: 'listening' }, CW);
  await call('chat.add', { id: 'lh/G1.2', text: 'any write, so the desk looks again' }, CW);
  const f1 = await facts('lh/G1.1');
  if (f1.limbo === false) test.check('lh/G1.1 is not limbo while claude-windows holds its red and listens');
  else test.fail(OWED + 'lh/G1.1 reads limbo ' + short(f1.limbo) + ' with its red held by ' + short(f1.with));
  const after = await limboLines('lh/G1.1');
  if (after === before) test.check('and the desk posted no limbo line under it');
  else test.fail(OWED + 'the desk posted ' + (after - before) + ' limbo line(s) under a held item');

  test.subHeading('2. nobody holding the phase is still limbo');
  await call('agent.state', { word: 'working' }, CW);
  const done = await call('phase.done', { id: 'lh/G1.1', phase: 'red' }, CW);
  const f2 = await facts('lh/G1.1');
  if (took(done) && f2.phase === 'build' && !f2.with && f2.limbo === true) test.check('once the red is done and its build is free, lh/G1.1 is limbo, its taker working or not');
  else test.fail(OWED + 'with nobody holding the build: ' + short({ done: done.status, phase: f2.phase, with: f2.with, limbo: f2.limbo }));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
