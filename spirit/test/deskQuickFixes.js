'use strict';

// spirit/test/deskQuickFixes.js
// goal/G29.10: quick desk fixes. Red on today's tree; claude-windows writes it and builds it (one agent). The item's box:
//   1. The limbo posts go.
//   2. A write an agent makes while holding a phase answers with Andy's lines typed since it took the phase.
//   3. An item stays in the code phase from its Go until Andy presses Done; the agent's own claim that it is done (a
//      verify pass) leaves it in code; within it red, build and verify run as often as needed, Andy's lines reach it
//      without the hold, and the desk sends no JOB offer to take a red while the item is being worked on.
// Point 4 (Levant's take landing) is deskAgent's and is asserted in its own suite.
//
// WHAT IS ASSERTED
//   1  an item going into limbo is still marked limbo, but the desk posts no line under it.
//   2  a phase holder's write answers with `andy`: his lines under the item since its phase take, and none before it.
//   3  after a verify pass and before his Done: work.open offers no red (no JOB), and the red is taken again without a
//      line of his; Done is not offered while the new cycle runs.
// rule/11: through testSupport only; its own folders; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G29.10: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskQuickFixesCWAAAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const UBI = { key: 'MCowBQYDK2VwAyEAdeskQuickFixesUbiAAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-ubuntu' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskQuickFixesOwnerAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }

test.startTest('goal/G29.10: no limbo posts, a phase holder hears his lines, code from Go to Done');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskquickfixes-'));
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
async function facts(id) { const r = await call('item.get', { id: id }, ANDY); try { return JSON.parse(r.body.item); } catch (e) { return {}; } }
async function limboLines(id) {
  const r = await call('item.chat', { id: id }, ANDY);
  return ((r.body && r.body.chat) || []).filter(function (l) { return l.by === 'desk' && /^limbo:/.test(String(l.text)); }).length;
}
function ok(r) { return r && r.status === 200; }
async function open(caller) {
  const r = await call('work.open', {}, caller);
  const l = (r.body && (r.body.items || r.body.jobs)) || [];
  return l.map(function (j) { try { return typeof j.label === 'string' ? JSON.parse(j.label) : j; } catch (e) { return j; } })
    .map(function (j) { return (j.id || j.key) + ':' + j.phase; });
}
function heard(r) { return ((r.body && r.body.andy) || []).map(function (l) { return String(l && l.text); }); }

(async function () {
  if (!await start()) { test.fail('the desk server did not start'); return; }
  await call('session.set', { json: JSON.stringify({ goal: { id: 'q/G1', title: 'Quick fixes' }, items: [
    { id: 'q/G1.1', title: 'Limbo, quietly', blocks: ['q/G1'], code: true },
    { id: 'q/G1.2', title: 'A code item', blocks: ['q/G1'], code: true },
    { id: 'q/G1.3', title: 'A decision', blocks: ['q/G1'] },
  ] }) }, CW);
  const ended = await call('press', { id: 'q/G1', what: 'end-design' }, ANDY);
  const go3 = await call('press', { id: 'q/G1.3', what: 'go' }, ANDY);
  if (!ok(ended) || !ok(go3)) { test.fail('the world: end-design ' + ended.status + ', Go ' + go3.status); return; }
  // Two agents live, so the desk does not waive the phase rules itself (deskPhases.js).
  await call('item.take', { id: 'q/G1.3' }, UBI);
  await call('chat.add', { id: 'q/G1.3', text: 'claude-ubuntu: here, so the phase rules apply.' }, UBI);
  await call('item.release', { id: 'q/G1.3' }, UBI);

  test.subHeading('1. the limbo posts go');
  const go1 = await call('press', { id: 'q/G1.1', what: 'go' }, ANDY);
  await call('chat.add', { id: 'q/G1.3', text: 'any write, so the desk looks again' }, ANDY);
  const f1 = await facts('q/G1.1');
  const lines1 = await limboLines('q/G1.1');
  if (ok(go1) && f1.limbo === true) test.check('the world: q/G1.1 has his Go, nobody on it, and is marked limbo');
  else test.fail('the world: Go ' + go1.status + ', limbo ' + short(f1.limbo));
  if (lines1 === 0) test.check('the desk posted no limbo line under it');
  else test.fail(OWED + 'the desk posted ' + lines1 + ' limbo line(s) under q/G1.1');

  test.subHeading('2. a phase holder\'s write answers with his lines since its phase take');
  const go2 = await call('press', { id: 'q/G1.2', what: 'go' }, ANDY);
  await call('chat.add', { id: 'q/G1.2', text: 'before the take' }, ANDY);
  await sleep(5);
  const red = await call('phase.take', { id: 'q/G1.2', phase: 'red' }, CW);
  if (!ok(go2) || !ok(red)) { test.fail('the world: Go ' + go2.status + ', red take ' + short(red.body || red.status)); return; }
  await sleep(5);
  await call('chat.add', { id: 'q/G1.2', text: 'make the button blue' }, ANDY);
  await call('chat.add', { id: 'q/G1.2', text: 'and the frame thinner' }, ANDY);
  const files = await call('item.files.add', { id: 'q/G1.2', paths: ['spirit/test/zzQuickFixes.js'] }, CW);
  const said = heard(files);
  if (ok(files) && said.indexOf('make the button blue') !== -1 && said.indexOf('and the frame thinner') !== -1) test.check('its item.files.add answers with both lines he typed since the take');
  else test.fail(OWED + 'item.files.add answered ' + short(files.body || files.status));
  if (said.indexOf('before the take') === -1) test.check('and not the line he typed before it');
  else test.fail(OWED + 'the answer carries a line from before the phase take: ' + short(said));
  const chat = await call('chat.add', { id: 'q/G1.2', text: 'blue it is' }, CW);
  if (ok(chat) && heard(chat).indexOf('make the button blue') !== -1) test.check('its chat.add answers with them too');
  else test.fail(OWED + 'chat.add answered ' + short(chat.body || chat.status));

  test.subHeading('3. from his Go to his Done the item stays in code');
  const steps = [];
  steps.push((await call('phase.done', { id: 'q/G1.2', phase: 'red' }, CW)).status);
  steps.push((await call('phase.take', { id: 'q/G1.2', phase: 'build' }, UBI)).status);
  steps.push((await call('phase.done', { id: 'q/G1.2', phase: 'build' }, UBI)).status);
  steps.push((await call('phase.take', { id: 'q/G1.2', phase: 'verify' }, CW)).status);
  steps.push((await call('phase.done', { id: 'q/G1.2', phase: 'verify', pass: true, why: 'green' }, CW)).status);
  const v0 = await facts('q/G1.2');
  if (steps.every(function (s) { return s === 200; }) && (v0.buttons || []).indexOf('done') !== -1) test.check('the world: one cycle ran to a verify pass, and Done is offered');
  else { test.fail('the world: the cycle answered ' + short(steps) + ', buttons ' + short(v0.buttons)); return; }
  const offered = await open(CW);
  if (offered.indexOf('q/G1.2:red') === -1) test.check('work.open offers no red for it: no JOB while it waits for his Done');
  else test.fail(OWED + 'work.open offers ' + short(offered));
  const again = await call('phase.take', { id: 'q/G1.2', phase: 'red' }, CW);
  const v1 = await facts('q/G1.2');
  if (ok(again) && v1.phase === 'red' && v1.with === 'claude-windows') test.check('its red is taken again without a line of his: the item is in red, with claude-windows');
  else test.fail(OWED + 'red after the verify pass, with no line of his, answered ' + short(again.body || again.status) + '; phase ' + short(v1.phase));
  if ((v1.buttons || []).indexOf('done') === -1) test.check('while the new cycle runs Done is not offered');
  else test.fail(OWED + 'Done is still offered while the item is back in red: ' + short(v1.buttons));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { kid && kid.kill(); } catch (e) { /* gone */ }
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
