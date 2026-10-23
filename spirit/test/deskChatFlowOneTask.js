'use strict';

// spirit/test/deskChatFlowOneTask.js
// goal/G21.4: Desk: the chat flow, and one task per agent. Red on today's tree (81ae239b); claude-windows wrote it and
// builds it (one agent). The item's box, Andy's decisions:
//   "Each of Andy's lines is taken by one agent and answered by that agent alone; no other agent chimes in once it is
//   taken." "An agent's answer is never takeable: no agent answers another agent. A second answer comes only when Andy
//   asks for it by naming the agent." "An agent may post its own work notes (taking, built, claimed) on an item it
//   holds; they are valued work logs and are not answers, so the chat flow does not stop them."
//   "An agent holds one task, one item and one phase, at a time; taking a second is refused by the desk until the first
//   is released, claimed or done." "Excluding an agent releases what it holds: its task and phase are free for another
//   agent to take."
//
// THE RULES THIS BUILD CHOSE (the box names no mechanism; reported to Andy with the claim):
//   - The item an agent HOLDS is the one it is with now (item.take or phase.take): its posts there are work notes and
//     are always taken, a take of another agent's standing or not.
//   - An agent that took a phase of the item earlier (red, build, verify) and holds it no more posts its notes there
//     only while Andy's latest line under it is not taken by another agent; after that line is taken, its post would be
//     a second answer, and is refused.
//   - Anybody else writes only with the take of his latest line.
//   - line.take takes his latest line only; when that line is taken already, what follows it is an agent's answer, and
//     the refusal says so. An item with no line of his: the refusal says only his lines are taken.
//   - One task: item.take and phase.take are refused while the agent is with another open item. What frees it:
//     item.release (new desk verb), phase.done, its own claim (claim-done, or claim of the build), done or close of
//     that item, his exclusion of the agent, verify.reject / verify.regress (which already clear with).
//
// WHAT IS ASSERTED
//   1. the holder's work notes go while another agent holds the take of his line.
//   2. once his line is taken and answered, an earlier phase holder's post is refused; before that, it goes.
//   3. line.take on an answered line, and under an item with agents' lines only, is refused with a why.
//   4. a second item or phase is refused while the agent holds one; the same item again is no second.
//   5. item.release, a claim, a finished phase, his close and his done each free the agent for another.
//   6. his exclusion of an agent frees its item, its phase and its take of his line for another agent.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G21.4: ';
const DESK = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskChatFlowOneTaskCWAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const LEV = { key: 'MCowBQYDK2VwAyEAdeskChatFlowOneTaskLevantAAAAAAAAAAAAA=', label: 'ollama agent node' };
const UBI = { key: 'MCowBQYDK2VwAyEAdeskChatFlowOneTaskUbiAAAAAAAAAAAAAAAA=', label: 'claude-ubuntu' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskChatFlowOneTaskOwnerAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('goal/G21.4: the chat flow, and one task per agent');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskchatflow-'));

(async function () {
  const node = await new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = ''; req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        // A server's verb by name on the flat apiDoor (goal/G30.6), folded to {server: {verb: args}}; 'api' the tree.
        { const na = test.nodeApi(j); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
        const flatCall = test.foldAsk(j);
        const out = flatCall === 'api' ? { desk: {} } : { ok: true };
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
  const root = path.join(scratch, 'desk');
  const state = path.join(root, 'state');
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(root, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, 'desk', 'win32', 'process') : path.join(root, 'door.sock');
  const client = appClient.createAppClient({ rootDir: root });
  client.register('desk', pipe);
  const items = [
    { id: 'goal/G100.1', title: 'Asked, held' }, { id: 'goal/G100.2', title: 'Code, phases', code: true },
    { id: 'goal/G100.3', title: 'Agents only' }, { id: 'goal/G100.4', title: 'One' }, { id: 'goal/G100.5', title: 'Two' },
    { id: 'goal/G100.6', title: 'Code two', code: true }, { id: 'goal/G100.7', title: 'Claimed' }, { id: 'goal/G100.8', title: 'Closed' },
    { id: 'goal/G100.9', title: 'Done' }, { id: 'goal/G100.10', title: 'Excluded' }, { id: 'goal/G100.11', title: 'Code three', code: true },
    { id: 'goal/G100.12', title: 'Spare' },
  ].map(function (x) { return Object.assign({ blocks: ['goal/G100'] }, x); });
  // goal/G29.21: an agent's session creates no goal, so the owner writes the world; goal/G33.7: seeded before the desk
  // starts (session.set went), and the desk takes it in at start.
  test.seedDesk(state, { goal: { id: 'goal/G100', title: 'Chat flow' }, items: items });
  const kid = spawn(process.execPath, [DESK, '{}', '--pipe', pipe, '--state', state], { cwd: root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-job', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.port + '/api/spirit' }) });
  const call = function (verb, a, caller) { const q = {}; q[verb] = a || {}; return client.ask({ desk: q }, caller).then(function (r) { return (r && r.body) || {}; }, function () { return {}; }); };
  const say = function (id, text, who) { return call('chat.add', { id: id, text: text }, who); };
  const facts = async function (id) { const r = await call('item.get', { id: id }, ANDY); try { return JSON.parse(r.item); } catch (e) { return {}; } };
  const landed = function (r) { return !!(r && r.change); };
  const why = function (r) { return r && r.ok === false && r.extra && typeof r.extra.why === 'string' ? r.extra.why : ''; };
  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.desk && r.body.desk.ok !== false); } catch (e) { /* not yet */ } }
    if (!up) { test.fail('the world: the desk did not start'); return; }
    await sleep(500);
    await call('press', { id: 'goal/G100', what: 'end-design' }, ANDY);
    for (const id of ['goal/G100.2', 'goal/G100.6', 'goal/G100.7', 'goal/G100.11']) {
      const g = await call('press', { id: id, what: 'go' }, ANDY);
      if (!landed(g)) test.fail('the world: his Go on ' + id + ' answered ' + short(g));
    }
    // Three agents heard from, so the phase rules are not waived away (desk.js phase.done, goal/G2.22).
    await call('agent.state', { word: 'listening' }, CW);
    await call('agent.state', { word: 'listening' }, LEV);
    await call('agent.state', { word: 'listening' }, UBI);

    test.subHeading('1. the holder\'s work notes are not stopped by another agent\'s take');
    await call('item.take', { id: 'goal/G100.1' }, UBI);
    await say('goal/G100.1', 'what is the plan here?', ANDY);
    const tookLine = await call('line.take', { id: 'goal/G100.1' }, LEV);
    if (!landed(tookLine)) test.fail('the world: the ollama agent\'s take answered ' + short(tookLine));
    const note = await say('goal/G100.1', 'taking: building the first part', UBI);
    if (landed(note)) test.check('the agent holding the item posts its work note while another agent holds the take of his line');
    else test.fail(OWED + 'the holder\'s note was refused while another held the take: ' + short(note));
    const answer = await say('goal/G100.1', 'the plan is one part at a time', LEV);
    if (landed(answer)) test.check('the taker answers his line');
    else test.fail(OWED + 'the taker\'s answer answered ' + short(answer));

    // SUPERSEDED IN PART BY goal/G27.10, R2 (Andy, 2026-10-17, accepting the recommendation to keep R2): an agent that held
    // a phase of the item earlier posts its work notes and reports at any time, so the red writer is no longer refused
    // after another agent took and answered his line. The rest of this section stands.
    test.subHeading('2. an earlier phase holder posts its notes, before and after a take (goal/G27.10)');
    const red = await call('phase.take', { id: 'goal/G100.2', phase: 'red' }, CW);
    const redDone = await call('phase.done', { id: 'goal/G100.2', phase: 'red' }, CW);
    if (!landed(red) || !landed(redDone)) test.fail('the world: the red of goal/G100.2 answered ' + short([red, redDone]));
    await say('goal/G100.2', 'how far is it?', ANDY);
    const before = await say('goal/G100.2', 'red: written, waiting for a builder', CW);
    if (landed(before)) test.check('the red\'s writer posts its note while his latest line is not taken');
    else test.fail(OWED + 'the red writer\'s note before any take answered ' + short(before));
    const levTake = await call('line.take', { id: 'goal/G100.2' }, LEV);
    const levAnswer = await say('goal/G100.2', 'the red is done, build is open', LEV);
    if (!landed(levTake) || !landed(levAnswer)) test.fail('the world: the ollama agent\'s take and answer answered ' + short([levTake, levAnswer]));
    const chime = await say('goal/G100.2', 'to add to that: the red has four sections', CW);
    if (landed(chime)) test.check('after the ollama agent took and answered his line, the red\'s writer still posts its note (goal/G27.10, R2)');
    else test.fail('OWED by goal/G27.10: the red writer was refused its note after the take: ' + short(chime));
    const whileTaken = await say('goal/G100.1', 'an answer of mine too', CW);
    if (why(whileTaken)) test.check('an agent holding nothing on the item is refused there');
    else test.fail(OWED + 'a stranger to the item answered ' + short(whileTaken));

    test.subHeading('3. an agent\'s answer is never taken');
    const second = await call('line.take', { id: 'goal/G100.2' }, CW);
    if (second.ok === false && /answer/i.test(why(second)) && /nam/i.test(why(second))) test.check('a take after his line was answered is refused, and says a second answer comes when he names the agent: ' + why(second));
    else test.fail(OWED + 'a take of the answered line answered ' + short(second));
    await call('item.release', { id: 'goal/G100.1' }, UBI);
    await call('item.take', { id: 'goal/G100.3' }, UBI);
    await say('goal/G100.3', 'taking: a note of mine', UBI);
    const agentsOnly = await call('line.take', { id: 'goal/G100.3' }, LEV);
    if (agentsOnly.ok === false && /only/i.test(why(agentsOnly))) test.check('under an item with agents\' lines only, a take is refused: ' + why(agentsOnly));
    else test.fail(OWED + 'a take where only an agent wrote answered ' + short(agentsOnly));
    await call('item.release', { id: 'goal/G100.3' }, UBI);

    test.subHeading('4. one item and one phase at a time');
    const one = await call('item.take', { id: 'goal/G100.4' }, CW);
    const two = await call('item.take', { id: 'goal/G100.5' }, CW);
    if (landed(one) && two.ok === false && /goal\/G100\.4/.test(why(two))) test.check('a second item is refused while the first is held, naming it: ' + why(two));
    else test.fail(OWED + 'a second item.take answered ' + short(two) + ' (the first ' + short(one) + ')');
    const phase = await call('phase.take', { id: 'goal/G100.6', phase: 'red' }, CW);
    if (phase.ok === false && /goal\/G100\.4/.test(why(phase))) test.check('a phase of another item is refused while an item is held: ' + why(phase));
    else test.fail(OWED + 'a phase take while holding an item answered ' + short(phase));
    const again = await call('item.take', { id: 'goal/G100.4' }, CW);
    if (landed(again)) test.check('taking the item it holds again is no second task');
    else test.fail(OWED + 'taking its own item again answered ' + short(again));

    test.subHeading('5. what frees an agent');
    const released = await call('item.release', { id: 'goal/G100.4' }, CW);
    const f4 = await facts('goal/G100.4');
    const afterRelease = await call('item.take', { id: 'goal/G100.7' }, CW);
    if (landed(released) && !f4.with && landed(afterRelease)) test.check('item.release frees it: its with is empty and another item is taken');
    else test.fail(OWED + 'release: ' + short({ released: released, with: f4.with, next: afterRelease }));
    const claimed = await call('press', { id: 'goal/G100.7', what: 'claim-done' }, CW);
    const afterClaim = await call('phase.take', { id: 'goal/G100.6', phase: 'red' }, CW);
    if (landed(claimed) && landed(afterClaim)) test.check('its claim frees it: a phase of another item is taken');
    else test.fail(OWED + 'claim: ' + short({ claimed: claimed, next: afterClaim }));
    const phaseDone = await call('phase.done', { id: 'goal/G100.6', phase: 'red' }, CW);
    const afterPhase = await call('item.take', { id: 'goal/G100.8' }, CW);
    if (landed(phaseDone) && landed(afterPhase)) test.check('a finished phase frees it');
    else test.fail(OWED + 'phase done: ' + short({ done: phaseDone, next: afterPhase }));
    const closed = await call('press', { id: 'goal/G100.8', what: 'close' }, ANDY);
    const afterClose = await call('item.take', { id: 'goal/G100.9' }, CW);
    if (landed(closed) && landed(afterClose)) test.check('his close frees it');
    else test.fail(OWED + 'close: ' + short({ closed: closed, next: afterClose }));
    const done = await call('press', { id: 'goal/G100.9', what: 'done' }, ANDY);
    const afterDone = await call('item.take', { id: 'goal/G100.12' }, CW);
    if (landed(done) && landed(afterDone)) test.check('his done frees it');
    else test.fail(OWED + 'done: ' + short({ done: done, next: afterDone }));
    const notHeld = await call('item.release', { id: 'goal/G100.5' }, CW);
    if (notHeld.ok === false && why(notHeld)) test.check('a release of an item it does not hold is refused: ' + why(notHeld));
    else test.fail(OWED + 'a release of an item not held answered ' + short(notHeld));
    await call('item.release', { id: 'goal/G100.12' }, CW);

    test.subHeading('6. his exclusion frees what the agent holds');
    const uRed = await call('phase.take', { id: 'goal/G100.11', phase: 'red' }, UBI);
    await say('goal/G100.10', 'who looks at this?', ANDY);
    const uLine = await call('line.take', { id: 'goal/G100.10' }, UBI);
    if (!landed(uRed) || !landed(uLine)) test.fail('the world: claude-ubuntu\'s phase and line takes answered ' + short([uRed, uLine]));
    const off = await call('profile.set', { agent: UBI.key, name: '', nick: '', included: false }, ANDY);
    if (!landed(off)) test.fail('the world: his exclusion answered ' + short(off));
    const f11 = await facts('goal/G100.11');
    if (!f11.with) test.check('excluded: the item it held is with nobody');
    else test.fail(OWED + 'after his exclusion the item is still with ' + short(f11.with));
    const cwRed = await call('phase.take', { id: 'goal/G100.11', phase: 'red' }, CW);
    const levLine = await call('line.take', { id: 'goal/G100.10' }, LEV);
    if (landed(cwRed) && landed(levLine)) test.check('another agent takes the freed phase, and the freed line');
    else test.fail(OWED + 'after his exclusion the freed phase answered ' + short(cwRed) + ', the freed line ' + short(levLine));
  } finally {
    try { kid.kill(); } catch (e) { /* gone */ }
    node.close();
  }
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await sleep(300);
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
