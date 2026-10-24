'use strict';

// goal/G33.11 "More Desk changes": the red, on today's tree. claude-windows writes it.
//   The box (v8), in short:
//   - The box, in goals and in items, cannot be sized by hand: it is sized only by the layout, a scroll bar inside.
//   - While its agent holds the red or the build of an item, the agent's deskClient watches its checkout and reports
//     each change to the item's status column only, never to the chat: the changed file's name only, without its path;
//     red a test file, white a production file. The desk counts those reports as activity; only when nothing moves for
//     10 minutes (no write, no file change) does it post a red Q to Andy.
//   - The desk does not wake or remind an agent about its hold.
//   - deskVerify posts no chat lines of its own, only status updates: "Done went over a red run" (or "a missing run")
//     and "verify failed" go.
//   - deskVerify gets a "chores now" button and one new verb for it, chores.run (Andy, 2026-10-24: "the deskVerifier
//     get a new verb: chores.run").
//   - An icon left of the box opens the item's suites list, read only.
//   - What happens in a special goal (a desk plugin's goal, such as Stacks) reaches the deskClients as news too.
// NAMED HERE where the box names none:
//   - item.status takes tone ('' | 'test' | 'code', optional) beside word; the item's facts carry it as statusTone; a
//     word that is a path is kept as its file name only. The List paints the status by statusTone.
//   - The deskClient's watch is fs.watch on its node's checkout; a path under spirit/test/ is tone 'test', any other
//     'code'.
//   - The verifier failing a verify sets the item's status (word 'verify failed'), not a chat line.
// Sections 1 to 3 drive a real desk server on seeded records; the rest read the code, where a unit's absence is the
// fault (the deskClient, deskVerify and the shell need a running node to show it). rule/11: through testSupport
// only; its own scratch folders.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G33.11: ';
const RUN = path.join(__dirname, '..', 'run');
const SERVER = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskStatusActivityTestCWAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const UBI = { key: 'MCowBQYDK2VwAyEAdeskStatusActivityTestUbiAAAAAAAAAAAAAAA=', label: 'claude-ubuntu' };
const LEV = { key: 'MCowBQYDK2VwAyEAdeskStatusActivityTestLevAAAAAAAAAAAAAAA=', label: 'levant-local' };
const BOB = { key: 'MCowBQYDK2VwAyEAdeskStatusActivityTestBobAAAAAAAAAAAAAAA=', label: 'bob-agent' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskStatusActivityTestWslAAAAAAAAAAAAAAA=', label: 'wsl-claude' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskStatusActivityTestOwnerAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }
const code = function (rel) { try { return fs.readFileSync(path.join(RUN, rel), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n'); } catch (e) { return ''; } };

test.startTest('goal/G33.11: the status shows the work, and the desk speaks only when nothing moves');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskstatusactivity-'));
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
async function chat(id) { return (((await call('item.chat', { id: id }, ANDY)).body || {}).chat) || []; }
async function staleQs(id) { return ((((await call('item.checks', { id: id }, ANDY)).body || {}).checks) || []).filter(function (c) { return c.kind === 'Q' && c.state === 'open' && /^stale:/.test(String(c.words)); }); }
function ok(r) { return r && r.status === 200; }

(async function () {
  test.seedDesk(state, { goal: { id: 'goal/G100', title: 'Status and activity' }, items: [
    { id: 'goal/G100.1', title: 'Reported by its files', blocks: ['goal/G100'], code: true },
    { id: 'goal/G100.2', title: 'Nothing moves', blocks: ['goal/G100'], code: true },
    { id: 'goal/G100.3', title: 'A verify that fails', blocks: ['goal/G100'], code: true },
    { id: 'goal/G100.4', title: 'A red without its suites', blocks: ['goal/G100'], code: true },
  ] });
  if (!await start()) { test.fail('the desk server did not start'); return; }
  const ended = await call('press', { id: 'goal/G100', what: 'end-design' }, ANDY);
  const gos = [];
  for (const id of ['goal/G100.1', 'goal/G100.2', 'goal/G100.3', 'goal/G100.4']) gos.push((await call('press', { id: id, what: 'go' }, ANDY)).status);
  if (ended.status !== 200 || gos.some(function (s) { return s !== 200; })) { test.fail('the world: end-design answered ' + ended.status + ', his Gos ' + short(gos)); return; }

  test.subHeading('1. a file change reaches the status: its name only, and its kind as a tone');
  const took = await call('phase.take', { id: 'goal/G100.1', phase: 'red' }, CW);
  const asTest = await call('item.status', { id: 'goal/G100.1', word: 'spirit/test/deskStatusActivity.js', tone: 'test' }, CW);
  const f1 = await facts('goal/G100.1');
  if (ok(took) && ok(asTest) && f1.status === 'deskStatusActivity.js' && f1.statusTone === 'test')
    test.check('a test file changed: the status reads deskStatusActivity.js, its tone test (painted red)');
  else test.fail(OWED + 'item.status with a test file answered ' + short(asTest.status + ' ' + JSON.stringify(asTest.body)) + '; facts ' + short({ status: f1.status, statusTone: f1.statusTone }));
  const asCode = await call('item.status', { id: 'goal/G100.1', word: 'spirit/run/process/js/desk/desk.js', tone: 'code' }, CW);
  const f2 = await facts('goal/G100.1');
  if (ok(asCode) && f2.status === 'desk.js' && f2.statusTone === 'code')
    test.check('a production file changed: the status reads desk.js, its tone code (painted white)');
  else test.fail(OWED + 'item.status with a code file answered ' + short(asCode.status) + '; facts ' + short({ status: f2.status, statusTone: f2.statusTone }));
  const chatAfter = await chat('goal/G100.1');
  if (!chatAfter.some(function (l) { return /deskStatusActivity\.js|desk\.js/.test(String(l.text)); })) test.check('the reports went to the status only: no chat line names the files');
  else test.fail(OWED + 'a file report reached the chat: ' + short(chatAfter.map(function (l) { return l.text; })));

  test.subHeading('2. the reports count as activity; a red Q to Andy only when nothing moves');
  await call('phase.take', { id: 'goal/G100.2', phase: 'red' }, WSL);
  await stop();
  // Twenty minutes ago for both agents' last writes: past LIVE_MS (desk.js, 10 minutes), as deskPlainTake does.
  const db = new DatabaseSync(path.join(state, 'desk.db'));
  db.prepare('UPDATE agents SET at = ? WHERE label = ?').run(new Date(Date.now() - 20 * 60 * 1000).toISOString(), CW.label);
  db.prepare('UPDATE agents SET at = ? WHERE label = ?').run(new Date(Date.now() - 20 * 60 * 1000).toISOString(), WSL.label);
  db.close();
  if (!await start()) { test.fail('the desk server did not start again'); return; }
  // claude-windows' deskClient reports a file change; wsl-claude says nothing. Then a write of Andy's walks the state.
  await call('item.status', { id: 'goal/G100.1', word: 'spirit/run/js/faceHome.js', tone: 'code' }, CW);
  await call('chat.add', { id: 'goal/G100.3', text: 'a write, so the desk walks its state' }, ANDY);
  await sleep(500);
  const moving = await staleQs('goal/G100.1');
  const still = await staleQs('goal/G100.2');
  if (!moving.length) test.check('a hold whose files changed is not stale: no red Q on goal/G100.1');
  else test.fail(OWED + 'a file report did not count as activity: ' + short(moving.map(function (c) { return c.words; })));
  if (still.length === 1) test.check('a hold where nothing moved for 10 minutes gets one red Q, for Andy: ' + short(still[0].words));
  else test.fail(OWED + 'the silent hold on goal/G100.2 has ' + still.length + ' stale red Qs');
  const nudged = (await chat('goal/G100.2')).filter(function (l) { return l.by === 'desk'; });
  if (!nudged.length) test.check('the desk woke and reminded nobody: no desk line under the silent hold');
  else test.fail(OWED + 'the desk spoke to the agent: ' + short(nudged.map(function (l) { return l.text; })));

  test.subHeading('3. a failed verify sets the status, never a chat line');
  // Two agents of its own: claude-windows and wsl-claude each hold a red above, and one agent holds one task at a time.
  await call('phase.take', { id: 'goal/G100.3', phase: 'red' }, UBI);
  // Since 3b a red finishes only after its red claim with suites (goal/G33.11).
  await call('claim', { id: 'goal/G100.3', phase: 'red', commit: 'abcdef1', suites: ['spirit/test/deskStatusActivity.js'] }, UBI);
  await call('phase.done', { id: 'goal/G100.3', phase: 'red' }, UBI);
  await call('phase.take', { id: 'goal/G100.3', phase: 'build' }, LEV);
  await call('phase.done', { id: 'goal/G100.3', phase: 'build' }, LEV);
  const vt = await call('phase.take', { id: 'goal/G100.3', phase: 'verify' }, UBI);
  const failed = await call('phase.done', { id: 'goal/G100.3', phase: 'verify', pass: false, why: 'deskStatusActivity.js: 2 red' }, UBI);
  if (!ok(vt)) test.fail('the world: claude-ubuntu could not take the verify: ' + short(vt.status + ' ' + JSON.stringify(vt.body)));
  const lines3 = (await chat('goal/G100.3')).filter(function (l) { return l.by === 'desk'; });
  const f3 = await facts('goal/G100.3');
  if (ok(failed) && !lines3.some(function (l) { return /verify failed/.test(String(l.text)); })) test.check('no "verify failed" line in the chat');
  else test.fail(OWED + 'the failed verify answered ' + short(failed.status) + ' and the desk said ' + short(lines3.map(function (l) { return l.text; })));
  if (/verify failed/.test(String(f3.status))) test.check('the status says it: ' + f3.status);
  else test.fail(OWED + 'after the failed verify the status reads ' + short(f3.status));

  // Andy, 2026-10-24, extending the item: "red cannot be claimed without delivering the list of suites to the item."
  test.subHeading('3b. no red without its suites');
  await call('phase.take', { id: 'goal/G100.4', phase: 'red' }, BOB);
  const bare = await call('claim', { id: 'goal/G100.4', phase: 'red', commit: 'abcdef1' }, BOB);
  const empty = await call('claim', { id: 'goal/G100.4', phase: 'red', commit: 'abcdef1', suites: [] }, BOB);
  if (!ok(bare) && !ok(empty) && /suite/.test(JSON.stringify(((bare.body || {}).extra || {}).why || (bare.body || {}).error || ''))) test.check('a red claim naming no suite is refused, saying why: ' + short(bare.body && ((bare.body.extra || {}).why || bare.body.error)));
  else test.fail(OWED + 'a red claim with no suites answered ' + short(bare.status + ' ' + JSON.stringify(bare.body)) + ', with suites [] ' + short(empty.status));
  const early = await call('phase.done', { id: 'goal/G100.4', phase: 'red' }, BOB);
  const f4 = await facts('goal/G100.4');
  if (!ok(early) && f4.phase === 'red') test.check('the red cannot be finished before a red claim with suites is on record');
  else test.fail(OWED + 'the red was finished with no suites delivered: ' + short(early.status) + ', phase now ' + short(f4.phase));
  const full = await call('claim', { id: 'goal/G100.4', phase: 'red', commit: 'abcdef1', suites: ['spirit/test/deskStatusActivity.js'] }, BOB);
  const done4 = await call('phase.done', { id: 'goal/G100.4', phase: 'red' }, BOB);
  const suites4 = ((((await call('item.suites.search', { id: 'goal/G100.4', text: '' }, ANDY)).body) || {}).items) || [];
  if (ok(full) && ok(done4) && suites4.length === 1) test.check('with its suite delivered, the red claim lands, the suite is on the item, and the red finishes');
  else test.fail(OWED + 'with its suite: the red claim ' + short(full.status) + ', its finish ' + short(done4.status) + ', suites ' + suites4.length);
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();

  test.subHeading('4. the desk itself posts no verifier chat lines');
  const desk = code('process/js/desk/desk.js');
  if (desk && !/Done went over/.test(desk)) test.check('"Done went over a red run" / "a missing run" is gone from the desk');
  else test.fail(OWED + 'the desk still posts "Done went over ..." under an item');
  if (desk && !/'verify failed \('/.test(desk)) test.check('"verify failed (...)" is gone from the desk');
  else test.fail(OWED + 'the desk still posts "verify failed (...)" under an item');

  test.subHeading('5. the List paints the status by its tone');
  const shellDesk = code('shell/desk/desk.js');
  if (/statusTone/.test(shellDesk)) test.check('the List reads statusTone to colour the status');
  else test.fail(OWED + 'the List does not read statusTone');

  test.subHeading('6. the deskClient watches its checkout and reports to the status');
  const dc = code('process/js/deskClient/deskClient.js');
  if (/fs\.watch\s*\(/.test(dc) && /'item\.status'/.test(dc) && /tone/.test(dc)) test.check('the deskClient watches with fs.watch and reports item.status with a tone');
  else test.fail(OWED + 'the deskClient has no watch reporting item.status with a tone (fs.watch ' + /fs\.watch\s*\(/.test(dc) + ', item.status ' + /'item\.status'/.test(dc) + ')');
  if (/spirit\/test\//.test(dc)) test.check('a path under spirit/test/ is told apart as a test file');
  else test.fail(OWED + 'the deskClient tells no test file from a production file');

  test.subHeading('7. what happens in a special goal reaches the deskClients as news');
  // The checkout's line ends may be CRLF.
  const meant = (/function meantForAgent[\s\S]*?\r?\n}\r?\n/.exec(dc) || [''])[0];
  if (/special|plugin/.test(meant)) test.check('meantForAgent lets the special goals\' rows through');
  else test.fail(OWED + 'meantForAgent drops every row of a special goal (it passes the current goal, the group chat, lines to the agent and its held item only)');

  test.subHeading('8. chores now');
  const dv = code('process/js/deskVerify/deskVerify.js');
  const dvApi = code('process/js/deskVerify/deskVerify.family/api.js');
  if (/'chores\.run'\s*:/.test(dv) && /'chores\.run'/.test(dvApi)) test.check('deskVerify serves chores.run, and its api.js lists it');
  else test.fail(OWED + 'chores.run: in deskVerify.js ' + /'chores\.run'\s*:/.test(dv) + ', in its api.js ' + /'chores\.run'/.test(dvApi));
  if (/deskVerifyAsk\(\s*'chores\.run'/.test(shellDesk) && /Chores now/i.test(shellDesk)) test.check('the verifier tab has a "Chores now" button that asks chores.run');
  else test.fail(OWED + 'the verifier tab has no "Chores now" button asking chores.run');

  test.subHeading('9. the box, and the suites icon beside it');
  const dd = code('shell/deskDetails/deskDetails.js');
  const boxTag = (/<textarea id="dd-box-input"[^>]*>/.exec(dd) || [''])[0];
  if (/resize\s*:\s*none/.test(boxTag)) test.check('the box cannot be sized by hand (resize: none)');
  else test.fail(OWED + 'the box can still be dragged to a size: ' + short(boxTag));
  if (/item\.suites\.search/.test(dd)) test.check('the details pane asks the item\'s suites for the icon beside the box');
  else test.fail(OWED + 'no suites icon: the details pane never asks item.suites.search');

  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
