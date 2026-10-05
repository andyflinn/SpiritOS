'use strict';

// goal/G5.9: the commit check: the red writer's build raises a red grant request. Red on today's tree; wsl-claude
// wrote it from G5.9's box and does not build it.
//   Andy, in goal/G5.7, to Q7 (should the commit check refuse a build commit from the agent who wrote that item's red?):
//   "it should trigger a red GRANT request for me."; in goal/G5: "new item to build it"; his Go on goal/G5.9, read as
//   covering the desk verb phase.may the box names (reviewed by wsl-claude and claude-ubuntu; he may rule on it alone).
//
// THE SHAPES (G5.9's box; its names: phase.may {id} -> { allowed, why }, the G check "red writer builds"):
//   A  phase.may, on the desk server, for the caller by its key: not allowed when the item is marked code, is in build,
//      the caller wrote its red, and no waive; allowed in every other case (no phases, the red phase, the builder in
//      build, another agent, after his waive). A refusal says why.
//   B  the commit check asks phase.may for the item its message names: not allowed, the commit is refused and a G
//      check "red writer builds" goes on the item, open, once; his grant lets the same commit through.

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

const OWED = 'OWED by goal/G5.9: ';
const REPO = path.join(__dirname, '..', '..');
const DESK_DIR = path.join(REPO, 'spirit', 'run', 'process', 'js', 'desk');
const DESK = path.join(DESK_DIR, 'desk.js');
const EAR = path.join(DESK_DIR, 'deskEar.js');
const ONBOARD = path.join(DESK_DIR, 'onboard.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskRedWriterTestCWAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const UBI = { key: 'MCowBQYDK2VwAyEAdeskRedWriterTestUbiAAAAAAAAAAAAAAAAAAAA=', label: 'claude-ubuntu' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskRedWriterTestOwnerAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
function waitFor(fn, ms) { const until = Date.now() + (ms || 15000); return (function again() { return Promise.resolve().then(fn).catch(function () { return false; }).then(function (ok) { if (ok || Date.now() > until) return ok; return sleep(200).then(again); }); })(); }
function freePort() { return new Promise(function (resolve) { const s = net.createServer().listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); }); }); }
function verb(port, body) {
  const once = function () { return relayRequest('http://127.0.0.1:' + port, 'POST', '/api/spirit', body).then(function (r) { let b = {}; try { b = JSON.parse(r.text); } catch (e) { b = {}; } return { status: r.status, body: b }; }, function () { return { status: 0, body: {} }; }); };
  return once().then(function (r) { return r.status ? r : sleep(200).then(once); });
}

test.startTest('goal/G5.9: the red writer\'s build raises a red grant request');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-redwriterbuild-'));
const kids = [];

// ── A. phase.may on the desk server itself ──
async function partA() {
  test.subHeading('A. phase.may: the desk answers for the caller, by its key');
  const state = path.join(scratch, 'a-state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'a.sock');
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('desk', pipe);
  const call = function (v, args, caller) { const q = {}; q[v] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
  kids.push(spawn(process.execPath, [DESK, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }));
  for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ } }
  await call('session.set', { json: JSON.stringify({ goal: { id: 'm/G1', title: 'May' }, items: [
    { id: 'm/G1.1', title: 'Code', blocks: ['m/G1'], code: true },
    { id: 'm/G1.2', title: 'Decision', blocks: ['m/G1'] },
  ] }) }, CW);
  await call('press', { id: 'm/G1', what: 'end-design' }, ANDY);
  await call('press', { id: 'm/G1.1', what: 'go' }, ANDY);
  await call('press', { id: 'm/G1.2', what: 'go' }, ANDY);
  const may = async function (id, caller) { const r = await call('phase.may', { id: id }, caller); return { status: r.status, allowed: r.body && r.body.allowed, why: r.body && r.body.why }; };

  const inRed = await may('m/G1.1', CW);
  await call('phase.take', { id: 'm/G1.1', phase: 'red' }, CW);
  const redHolder = await may('m/G1.1', CW);
  await call('phase.done', { id: 'm/G1.1', phase: 'red' }, CW);
  const redWriter = await may('m/G1.1', CW);
  const other = await may('m/G1.1', UBI);
  const noPhases = await may('m/G1.2', CW);
  if (inRed.allowed === true && redHolder.allowed === true && noPhases.allowed === true && other.allowed === true) test.check('allowed before anyone holds a phase, to the red\'s holder in red, on an item with no phases, and to another agent in build');
  else test.fail(OWED + 'phase.may answered ' + short({ beforeRed: inRed, redHolder: redHolder, noPhases: noPhases, otherInBuild: other }));
  if (redWriter.status === 200 && redWriter.allowed === false && /red/i.test(String(redWriter.why))) test.check('in build, the red\'s writer is not allowed, and the answer says why (' + short(redWriter.why) + ')');
  else test.fail(OWED + 'in build, phase.may to the red\'s writer answered ' + short(redWriter));
  await call('press', { id: 'm/G1.1', what: 'waive' }, ANDY);
  const waived = await may('m/G1.1', CW);
  if (waived.allowed === true) test.check('after his waive the red\'s writer is allowed');
  else test.fail(OWED + 'after his waive phase.may answered ' + short(waived));
}

// ── B. the commit check, in a world as publishData's red builds it ──
async function partB() {
  test.subHeading('B. the commit check refuses the red writer\'s build and raises a red grant request');
  const plant = function (name) { const h = path.join(scratch, name, 'spirit', 'run'); plantRun.plantRunTree(h); return h; };
  const pointAt = function (home, url) { fs.mkdirSync(path.join(home, 'shell', 'natter'), { recursive: true }); fs.writeFileSync(path.join(home, 'shell', 'natter', 'relays.json'), JSON.stringify([{ label: 'spirit', url: url }])); };
  const startNode = function (home, port, extra) { const k = spawn(process.execPath, ['js/server.js', '--port', String(port)].concat(extra || []), { cwd: home, stdio: ['ignore', 'ignore', 'ignore'] }); kids.push(k); return k; };

  const relayHome = plant('relay');
  fs.rmSync(path.join(relayHome, 'relay-state'), { recursive: true, force: true });
  const relayPort = await freePort();
  startNode(relayHome, relayPort, ['--relay']);
  const relayUrl = 'http://127.0.0.1:' + relayPort;
  await waitFor(function () { return fetch(relayUrl + '/api/relay/key').then(function (r) { return r.ok; }); });
  const andyHome = plant('andy');
  includeList.add(andyHome, 'process/js/desk');
  pointAt(andyHome, relayUrl);
  const andyPort = await freePort();
  startNode(andyHome, andyPort);
  await waitFor(function () { return verb(andyPort, { verb: 'device.info' }).then(function (r) { return r.status === 200; }); });
  const oi = mintOwnerInvite(relayHome, 'andy');
  await verb(andyPort, { verb: 'relay.claim', url: relayUrl, name: 'andy', invite: oi.token, inviteLabel: 'andy' });
  const deskPipe = appClient.createAppClient({ rootDir: andyHome });
  deskPipe.register('desk', appClient.pipePathFor(andyHome, 'desk', process.platform, 'process'));
  const deskAsk = function (v, a) { const q = {}; q[v] = a; return deskPipe.ask({ desk: q }, ANDY).then(function (r) { return r || {}; }, function () { return {}; }); };
  await waitFor(function () { return deskAsk('state.get', {}).then(function (r) { return r.status === 200; }); });
  await deskAsk('session.set', { json: JSON.stringify({ goal: { id: 'b/G1', title: 'Build' }, items: [{ id: 'b/G1.1', title: 'Code', blocks: ['b/G1'], code: true }] }) });
  await deskAsk('press', { id: 'b/G1', what: 'end-design' });
  await deskAsk('press', { id: 'b/G1.1', what: 'go' });

  const clone = path.join(scratch, 'clone');
  const agentHome = path.join(clone, 'spirit', 'run');
  plantRun.plantRunTree(agentHome);
  spawnSync('git', ['init', '-q'], { cwd: clone });
  pointAt(agentHome, relayUrl);
  const agentPort = await freePort();
  startNode(agentHome, agentPort);
  await waitFor(function () { return verb(agentPort, { verb: 'device.info' }).then(function (r) { return r.status === 200; }); });
  spawnSync('git', ['config', 'user.email', 'test@example'], { cwd: clone });
  spawnSync('git', ['config', 'user.name', 'test'], { cwd: clone });
  const mi = invites.add(relayHome, { label: 'gemma', days: 1 });
  relayStore.open(relayHome).close();
  spawnSync(process.execPath, [ONBOARD, String(agentPort), 'gemma:' + mi.token], { cwd: clone, timeout: 180000 });
  const agentKey = (await verb(agentPort, { verb: 'node.card' })).body.publicKey || '';
  await verb(andyPort, { verb: 'jobs.authGrant', key: agentKey, path: 'desk' });
  const joined = spawnSync(process.execPath, [ONBOARD, String(agentPort), 'gemma:' + mi.token], { cwd: clone, encoding: 'utf8', timeout: 180000 });
  await waitFor(function () { return deskAsk('profile.set', { agent: agentKey, name: 'gemma', nick: 'gemma' }).then(function (r) { return r.status === 200; }); });
  await waitFor(function () { return deskAsk('scope.set', { agent: agentKey, folder: 'src/' }).then(function (r) { return r.status === 200; }); });
  if (joined.status !== 0) { test.fail('the world: onboard.js exited ' + joined.status + ': ' + short(String(joined.stdout) + String(joined.stderr))); return; }

  // The agent writes the red and finishes it, through its own node, as a real agent does.
  const ear = function (v, json) { return spawnSync(process.execPath, [EAR, String(agentPort), v, JSON.stringify(json)], { cwd: clone, encoding: 'utf8', timeout: 60000 }); };
  const took = ear('phase.take', { id: 'b/G1.1', phase: 'red' });
  const done = ear('phase.done', { id: 'b/G1.1', phase: 'red' });
  if (took.status !== 0 || done.status !== 0) { test.fail(OWED + 'the agent\'s red take and done answered ' + short(String(took.stdout) + String(took.stderr) + String(done.stdout) + String(done.stderr))); return; }

  const commit = function (msg) {
    fs.mkdirSync(path.join(clone, 'src'), { recursive: true });
    fs.writeFileSync(path.join(clone, 'src', 'build.js'), '// built ' + Date.now() + '\n');
    spawnSync('git', ['add', 'src/build.js'], { cwd: clone });
    const r = spawnSync('git', ['commit', '-q', '-m', msg], { cwd: clone, encoding: 'utf8', timeout: 120000 });
    if (r.status !== 0) spawnSync('git', ['reset', '-q', 'HEAD', 'src/build.js'], { cwd: clone });
    return { code: r.status, said: String(r.stdout) + String(r.stderr) };
  };
  const gChecks = async function () {
    const r = await deskAsk('item.checks', { id: 'b/G1.1' });
    return ((r.body && r.body.checks) || []).map(function (c, i) { return { n: i + 1, kind: c.kind, state: c.state, words: String(c.words || '') }; })
      .filter(function (c) { return c.kind === 'G' && /red writer builds/i.test(c.words); });
  };

  const first = commit('b/G1.1: the build, by the red writer');
  const raised = await gChecks();
  if (first.code !== 0 && raised.length === 1 && raised[0].state === 'open') test.check('the red writer\'s build commit is refused, and one open G check "red writer builds" is on the item');
  else test.fail(OWED + 'the red writer\'s build commit exited ' + first.code + '; G checks ' + short(raised) + '; it said ' + short(first.said));
  const again = commit('b/G1.1: the build, tried again');
  const still = await gChecks();
  if (again.code !== 0 && still.length === 1) test.check('tried again, it is refused again, and the G check is not added twice');
  else test.fail(OWED + 'a second try exited ' + again.code + ' with G checks ' + short(still));
  if (still.length) await deskAsk('check.set', { id: 'b/G1.1', check: 'G' + still[0].n, state: 'granted' });
  const granted = commit('b/G1.1: the build, granted');
  if (still.length && granted.code === 0) test.check('his grant lets the same commit through');
  else test.fail(OWED + 'after his grant the commit exited ' + granted.code + ': ' + short(granted.said));
}

partA().then(partB).catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
