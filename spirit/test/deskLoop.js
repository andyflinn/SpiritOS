'use strict';

// goal/G4.28: gemma's Desk loop, a script that does the waiting for a model with no harness. Red on today's tree;
// wsl-claude wrote it, claude-windows builds it.
//   Andy, 2026-10-04, in Team chat: "how do we git it to stick to that loop that you are in when working over desk?";
//   to "New code, so it needs an item: open one, with your Go?": "yes. open one"; then his Go on goal/G4.28.
//   The box, SHAPE: one small script in process/js/desk waits on deskEar <port>; when lines come, it hands them to the
//   model with opencode run --session <one session>; the model answers in Desk with deskEar chat.add; the script
//   waits again. Nothing in gemma's model or opencode changes.
//
// THE WORLD: agentOnboard's three real nodes in scratch homes (a relay; Andy's node owning it and running the desk; the
// agent's node), the agent joined by the real onboard.js. The model is a stand-in script: it logs what it was handed
// and prints what opencode run --format json prints.
//
// THE SHAPES, NAMED HERE where the box leaves them open (wsl-claude's picks; the builder may argue them in Desk first):
//   1  node spirit/run/process/js/desk/deskLoop.js <port> <command> [args...]. Each time the listener (deskEar <port>)
//      hands over lines, the command runs with its args plus one more: the lines exactly as deskEar printed them. The
//      loop waits for it to end, then listens again. For gemma: deskLoop.js 11111 opencode run --format json --session <id>, so the
//      session is given, not found.
//   2  It never ends by itself: each line is handed over once, and a quiet Desk only means another wait.
//   3  THE FIX ROUND. Andy, 2026-10-04, after gemma was handed our lines and its thinking stayed in its window: to Q1
//      (the loop posting what gemma prints) "not it's internal thought process. claude's don't print to me what you
//      print in your vscode window"; to the round claude-windows put (only his "gemma:" lines; one standing order;
//      gemma answers in Desk itself, reading A) "yes, like it needs a manual pre-loaded......"; then, to A or B, "can
//      you? then do it." and "it's only valuable if that can be extracted mechanically", which is B. So: only his
//      lines that start with the agent's nick (profile.get, goal/G4.23) are handed over, the one argument starting
//      with a standing order before the lines; the command prints opencode run --format json's events, and the loop
//      posts the text of the last step under the line's id, nothing of the steps before it.
// LEFT OPEN, not asserted: what it does on a refusal from deskEar (unblocked, no-answer) beyond waiting again; on
//   Windows, opencode is a .cmd, so the command may need a shell there.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const test = require('./testSupport.js');
const plantRun = require('./plantRun.js');
const { mintOwnerInvite } = require('./ownerClaim.js');
const { relayRequest } = require('../run/js/relayRequest.js');
const invites = require('../run/js/invites.js');
const relayStore = require('../run/js/relayStore.js');
const includeList = require('../run/js/includeList.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G4.28: ';
const DESK_DIR = path.join(__dirname, '..', 'run', 'process', 'js', 'desk');
const LOOP = path.join(DESK_DIR, 'deskLoop.js');
const ONBOARD = path.join(DESK_DIR, 'onboard.js');
const EAR = path.join(DESK_DIR, 'deskEar.js');
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskLoopTestOwnerAAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function freePort() {
  return new Promise(function (resolve) {
    const s = net.createServer().listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); });
  });
}
function waitFor(fn, ms) {
  const until = Date.now() + (ms || 15000);
  return (function again() {
    return Promise.resolve().then(fn).catch(function () { return false; }).then(function (ok) {
      if (ok || Date.now() > until) return ok;
      return sleep(300).then(again);
    });
  })();
}
// One retry on no answer at all: a reused connection can go stale while a script runs (agentOnboard, 45fae7fa).
function verb(port, body) {
  const once = function () {
    return relayRequest('http://127.0.0.1:' + port, 'POST', '/api/spirit', body).then(function (r) {
      let b = null;
      try { b = JSON.parse(r.text); } catch (e) { b = null; }
      return { status: r.status, body: b || {} };
    }, function () { return { status: 0, body: {} }; });
  };
  return once().then(function (r) { return r.status ? r : sleep(200).then(once); });
}

test.startTest('goal/G4.28: a script keeps a model with no harness on Desk');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskloop-'));
const kids = [];
function startNode(home, port, extra) {
  const kid = spawn(process.execPath, ['js/server.js', '--port', String(port)].concat(extra || []), { cwd: home, stdio: ['ignore', 'ignore', 'ignore'] });
  kids.push(kid);
  return kid;
}
function plant(name) {
  const home = path.join(scratch, name, 'spirit', 'run');
  plantRun.plantRunTree(home);
  return home;
}
function pointAt(home, relayUrl) {
  fs.mkdirSync(path.join(home, 'shell', 'natter'), { recursive: true });
  fs.writeFileSync(path.join(home, 'shell', 'natter', 'relays.json'), JSON.stringify([{ label: 'spirit', url: relayUrl }], null, 2));
}
function handed(log) {
  try { return fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map(function (l) { return JSON.parse(l); }); } catch (e) { return []; }
}

(async function () {
  if (!fs.existsSync(LOOP)) {
    test.fail(OWED + 'there is no ' + path.relative(path.join(__dirname, '..', '..'), LOOP) + '; nothing below can run');
    return;
  }

  // THE WORLD, as agentOnboard builds it.
  const relayHome = plant('relay');
  fs.rmSync(path.join(relayHome, 'relay-state'), { recursive: true, force: true });
  const relayPort = await freePort();
  startNode(relayHome, relayPort, ['--relay']);
  const relayUrl = 'http://127.0.0.1:' + relayPort;
  const relayUp = await waitFor(function () { return fetch(relayUrl + '/api/relay/key').then(function (r) { return r.ok; }); }, 15000);
  if (!relayUp) { test.fail('the scratch relay never answered /api/relay/key'); return; }
  const andyHome = plant('andy');
  includeList.add(andyHome, 'process/js/desk');
  pointAt(andyHome, relayUrl);
  const andyPort = await freePort();
  startNode(andyHome, andyPort);
  await waitFor(function () { return verb(andyPort, { verb: 'device.info' }).then(function (r) { return r.status === 200; }); }, 15000);
  const ownerInvite = mintOwnerInvite(relayHome, 'andy');
  const owned = await verb(andyPort, { verb: 'relay.claim', url: relayUrl, name: 'andy', invite: ownerInvite.token, inviteLabel: 'andy' });
  if (!(owned.status >= 200 && owned.status < 300)) { test.fail('the world: the owner claim answered ' + owned.status + ' ' + short(owned.body)); return; }
  const deskPipe = appClient.createAppClient({ rootDir: andyHome });
  deskPipe.register('desk', appClient.pipePathFor(andyHome, 'desk', process.platform, 'process'));
  const deskAsk = function (v, a, caller) { const q = {}; q[v] = a; return deskPipe.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
  await waitFor(function () { return deskAsk('state.get', {}, ANDY).then(function (r) { return r.status === 200; }); }, 15000);
  await deskAsk('session.set', { json: JSON.stringify({ goal: { id: 'l/G1', title: 'Loop' }, items: [{ id: 'l/G1.1', title: 'Talk', blocks: ['l/G1'] }] }) }, ANDY);

  const agentHome = plant('gemma');
  pointAt(agentHome, relayUrl);
  const agentPort = await freePort();
  startNode(agentHome, agentPort);
  await waitFor(function () { return verb(agentPort, { verb: 'device.info' }).then(function (r) { return r.status === 200; }); }, 15000);
  const clone = path.join(scratch, 'clone');
  fs.mkdirSync(clone, { recursive: true });
  spawnSync('git', ['init', '-q'], { cwd: clone });
  const memberInvite = invites.add(relayHome, { label: 'gemma', days: 1 });
  relayStore.open(relayHome).close();
  spawnSync(process.execPath, [ONBOARD, String(agentPort), 'gemma:' + memberInvite.token], { cwd: clone, encoding: 'utf8', timeout: 180000 });
  const agentKey = (await verb(agentPort, { verb: 'node.card' })).body.publicKey || '';
  await verb(andyPort, { verb: 'jobs.authGrant', key: agentKey, path: 'desk' });
  const joined = spawnSync(process.execPath, [ONBOARD, String(agentPort), 'gemma:' + memberInvite.token], { cwd: clone, encoding: 'utf8', timeout: 180000 });
  if (joined.status === 0) test.check('the world: the agent joined Desk through onboard.js');
  else { test.fail('the world: onboard.js exited ' + joined.status + ': ' + short(String(joined.stdout || '') + String(joined.stderr || ''))); return; }

  // THE STAND-IN MODEL: logs the argument it was handed and prints what opencode run --format json prints, events as
  // claude-windows pasted from a real gemma run under goal/G4.28 (cut to the fields that matter): a step that thinks
  // aloud and calls a tool, then the step that answers. It posts nothing itself.
  const log = path.join(scratch, 'handed.jsonl');
  const model = path.join(scratch, 'model.js');
  fs.writeFileSync(model, [
    "'use strict';",
    "const fs = require('fs');",
    'const log = process.argv[2];',
    'const lines = process.argv[process.argv.length - 1];',
    "fs.appendFileSync(log, JSON.stringify(lines) + '\\n');",
    "const n = fs.readFileSync(log, 'utf8').split('\\n').filter(Boolean).length;",
    'const ev = function (o) { console.log(JSON.stringify(Object.assign({ timestamp: Date.now(), sessionID: "ses_test" }, o))); };',
    "ev({ type: 'step_start', part: { type: 'step-start' } });",
    "ev({ type: 'text', part: { type: 'text', text: 'thinking aloud ' + n } });",
    "ev({ type: 'tool_use', part: { type: 'tool', tool: 'read', state: { status: 'completed', input: { filePath: 'AGENT_ONBOARDING.md' }, output: '(cut)' } } });",
    "ev({ type: 'step_finish', part: { reason: 'tool-calls', type: 'step-finish' } });",
    "ev({ type: 'step_start', part: { type: 'step-start' } });",
    "ev({ type: 'text', part: { type: 'text', text: 'model heard ' + n } });",
    "ev({ type: 'step_finish', part: { reason: 'stop', type: 'step-finish' } });",
  ].join('\n'));

  // HIS NICK FOR IT (goal/G4.23): a line of his that starts "gemma:" is the agent's.
  // Asked until it answers: the desk's door answered app-not-running once here, right after the onboard runs.
  let nicked = {};
  await waitFor(function () { return deskAsk('profile.set', { agent: agentKey, name: 'ollama-gemma', nick: 'gemma' }, ANDY).then(function (r) { nicked = r; return r.status === 200; }); }, 15000);
  const nickRead = spawnSync(process.execPath, [EAR, String(agentPort), 'profile.get', '{"agent":""}'], { encoding: 'utf8', timeout: 60000 });
  if (nicked.status === 200 && /"nick":"gemma"/.test(String(nickRead.stdout))) test.check('the world: Andy gave the agent the nick gemma, and it reads it back');
  else { test.fail('the world: profile.set answered ' + short(nicked) + '; the agent reads ' + short(String(nickRead.stdout) + String(nickRead.stderr))); return; }

  test.subHeading('1. his "gemma:" line reaches the model under the standing order, and the model answers in Desk');
  const loop = spawn(process.execPath, [LOOP, String(agentPort), process.execPath, model, log], { cwd: clone, stdio: ['ignore', 'ignore', 'pipe'] });
  kids.push(loop);
  let loopSaid = '';
  loop.stderr.on('data', function (b) { loopSaid = (loopSaid + b).slice(-1000); });
  await sleep(3000);
  await deskAsk('chat.add', { id: 'l/G1.1', text: 'a line for the claudes, not for gemma' }, ANDY);
  await deskAsk('chat.add', { id: 'l/G1.1', text: 'gemma: first question from andy' }, ANDY);
  const one = await waitFor(function () { return handed(log).length >= 1; }, 60000);
  const first = handed(log)[0] || '';
  if (one && /gemma: first question from andy/.test(first)) test.check('the model was handed his "gemma:" line, as deskEar printed it');
  else test.fail(OWED + 'the model was handed ' + short(handed(log)) + (loopSaid ? '; the loop said ' + short(loopSaid) : ''));
  if (one && !/a line for the claudes/.test(first)) test.check('his line without "gemma:" was not handed over');
  else test.fail(OWED + 'the hand-over carries his line for the claudes: ' + short(first));
  // THE MANUAL (Andy, 2026-10-04: "yes, like it needs a manual pre-loaded......"): text of its own before the lines.
  const at = first.indexOf('DESK ');
  if (one && at > 0 && first.slice(0, at).trim().length > 0) test.check('a standing order comes before the lines');
  else test.fail(OWED + 'nothing stands before the lines: ' + short(first));
  // THE LOOP POSTS THE ANSWER (B). Andy: "it's only valuable if that can be extracted mechanically"; claude-windows:
  // "the answer is the text of the last step".
  let chat = [];
  const answered = await waitFor(function () {
    return deskAsk('item.chat', { id: 'l/G1.1' }, ANDY).then(function (r) {
      chat = ((r.body || {}).chat) || [];
      return chat.some(function (l) { return l.text === 'model heard 1'; });
    });
  }, 30000);
  const poster = (chat.filter(function (l) { return l.text === 'model heard 1'; })[0] || {}).by || '';
  if (answered && poster && poster !== 'andy') test.check('the loop posted the model\'s final text under the line\'s item, as the agent (' + poster + ')');
  else test.fail(OWED + 'no "model heard 1" under l/G1.1 from the agent: ' + short(chat.slice(-3)));
  if (!chat.some(function (l) { return /thinking aloud/.test(l.text) || /AGENT_ONBOARDING/.test(l.text); })) test.check('nothing of its thinking or tool calls reached Desk');
  else test.fail(OWED + 'its thinking or a tool call reached Desk: ' + short(chat.slice(-3)));

  test.subHeading('2. the loop listens again; each line is handed over once');
  await deskAsk('chat.add', { id: 'l/G1.1', text: 'gemma: second question from andy' }, ANDY);
  const two = await waitFor(function () { return handed(log).length >= 2; }, 60000);
  const second = handed(log)[1] || '';
  if (two && /second question from andy/.test(second)) test.check('his second line reached the model: the loop waited again');
  else test.fail(OWED + 'after his second line the model was handed ' + short(handed(log)) + (loopSaid ? '; the loop said ' + short(loopSaid) : ''));
  if (two && !/first question from andy/.test(second) && !/model heard/.test(second.slice(second.indexOf('gemma: second')))) test.check('the second hand-over carries neither his first line again nor the model\'s own answer');
  else test.fail(OWED + 'the second hand-over reads ' + short(second));
  if (loop.exitCode === null) test.check('the loop is still running');
  else test.fail(OWED + 'the loop ended with ' + loop.exitCode + (loopSaid ? ': ' + short(loopSaid) : ''));
})().catch(function (e) {
  test.fail('the suite threw: ' + (e && e.stack || e));
}).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy: the OS clears tmp */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
