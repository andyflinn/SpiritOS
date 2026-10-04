'use strict';

// goal/G4.17: the onboarding script, one run in the new agent's clone that joins it to Desk. Red on today's tree;
// wsl-claude wrote it, claude-windows builds it.
//   Andy, 2026-10-04, under goal/G4.17: "onboarding was painful, running form room to room, emailing output between
//   computers etc.."; "input argument the relay claim: name:token ?"; to Q1, the onboarding script: "if that works,
//   nice!"; his Go on goal/G4.17 stands (item.get answers go true, status running).
//   The box, TO BUILD 1: claims the agent's seat on the relay (hub.js handleClaim), Andy's node adopts it as a
//   contact (adoptClaim); takes the relay's owner as the desk node, setDesk, acquires it as a contact; switches
//   deskClient on, blocks the other agents, installs the commit hooks; tries one desk read, and if it fails says in
//   plain words what is missing (the desk grant is Andy's to give).
//
// THE WORLD: three real nodes in scratch homes, no labMaster. A relay; Andy's node, which owns it and runs the desk;
// the new agent's node, seated on nothing, with deskClient off. Another agent has already written at the desk.
//
// THE SHAPES, NAMED HERE where the box names none (wsl-claude's picks; the builder may argue them in Desk first):
//   1  node spirit/run/process/js/desk/onboard.js <port of the agent's own node> <name:token>, run in the agent's
//      clone (the port as commitCheck install takes it; posted in Desk 2026-10-04). name is the invite's label and
//      the seat's name. The relay is the one row of the node's shell/natter/relays.json.
//   2  Exit 0 only when the desk read answered. Without Andy's desk grant: a non-zero exit, and its words name the
//      grant. Run again after the grant, it finishes: a second run is not refused for the seat it already holds.
//   3  The desk node's key is the relay's owner key (GET /api/relay/key answers ownerKey).
//   4  Removal is two scripts beside it. Andy, 2026-10-04, to Q9 ("the agent's script undoes its side (hooks,
//      deskClient, its relay seat). Your side (desk grant, contact, scope) as a second script you run on your
//      node?"): "yes". offboard.js <agent's port>, in the clone: the commitCheck hooks gone, deskClient off the
//      include list, the seat gone from the relay. removeAgent.js <port of Andy's node> <agent key>: desk grant
//      revoked, contact gone from his book, scope ''. The profile is not cleared: profile.set refuses an empty
//      name and no verb deletes one (desk.js 1162-1171).
//
// IN THE TREE, CHECKED FOR THIS RED (a1f8b805): relay.claim takes {url, name, invite, inviteLabel} (hub.js 1073-1079);
//   adoptClaim on the owner's node acquires a claimant as MEMBER (hub.js 2017-2029); setDesk takes {key}
//   (deskClient.js 409); a fresh deskClient starts at now (findNow, deskClient.js 279-281), so the agents that wrote
//   before it joined are not in its "others"; the desk's changes verb carries each record's key (desk.js 913-916),
//   readable only once granted, so the other agents are blocked by the run that follows the grant.
// LEFT OPEN, not asserted: a fresh clone has no shell/natter/relays.json (it is not tracked), so the relay's url must
//   come from somewhere; this suite writes the row as a configured node would have it. No verb releases a seat from
//   a node: a member leaves by an owner-verb post of {removePeer: {key: its own}} to the relay (relay.js 3599-3604);
//   how offboard.js sends it is the builder's.

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

const OWED = 'OWED by goal/G4.17: ';
const DESK_DIR = path.join(__dirname, '..', 'run', 'process', 'js', 'desk');
const SCRIPT = path.join(DESK_DIR, 'onboard.js');
const OFFBOARD = path.join(DESK_DIR, 'offboard.js');
const REMOVE = path.join(DESK_DIR, 'removeAgent.js');
const EAR = path.join(DESK_DIR, 'deskEar.js');
const OTHER = { key: 'MCowBQYDK2VwAyEAagentOnboardTestOtherAgentAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAagentOnboardTestOwnerAAAAAAAAAAAAAAAAA=', label: 'andy' };

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
      return sleep(200).then(again);
    });
  })();
}
// ONE RETRY ON NO ANSWER AT ALL. claude-windows, building against this suite: after a script run of 5 s or more the
// next request got status 0 within 3 ms and the node then answered normally, a reused connection gone stale; a node
// that is really down answers 0 twice.
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
function run(file, args, cwd) {
  const r = spawnSync(process.execPath, [file].concat(args), { cwd: cwd, encoding: 'utf8', timeout: 180000 });
  return { code: r.status, said: String(r.stdout || '') + String(r.stderr || '') };
}

test.startTest('goal/G4.17: one onboarding run joins a new agent to Desk');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-agentonboard-'));
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

(async function () {
  if (!fs.existsSync(SCRIPT)) {
    test.fail(OWED + 'there is no ' + path.relative(path.join(__dirname, '..', '..'), SCRIPT) + '; nothing below can run');
    return;
  }

  // THE RELAY, unclaimed, and ANDY'S NODE, which takes it with the owner invite and runs the desk.
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
  const andyCard = await verb(andyPort, { verb: 'node.card' });
  const andyKey = andyCard.body.publicKey || '';
  if (owned.status >= 200 && owned.status < 300 && andyKey) test.check('the world: Andy\'s node owns the scratch relay');
  else { test.fail('the world: the owner claim answered ' + owned.status + ' ' + short(owned.body)); return; }

  // ANOTHER AGENT HAS ALREADY WRITTEN AT THE DESK, under its own key.
  const deskClient = appClient.createAppClient({ rootDir: andyHome });
  deskClient.register('desk', appClient.pipePathFor(andyHome, 'desk', process.platform, 'process'));
  const deskAsk = function (v, a, caller) { const q = {}; q[v] = a; return deskClient.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
  await waitFor(function () { return deskAsk('state.get', {}, OTHER).then(function (r) { return r.status === 200; }); }, 15000);
  await deskAsk('session.set', { json: JSON.stringify({ goal: { id: 'o/G1', title: 'Onboarding' }, items: [{ id: 'o/G1.1', title: 'Work', blocks: ['o/G1'] }] }) }, OTHER);
  const wrote = await deskAsk('chat.add', { id: 'o/G1.1', text: 'claude-windows was here first' }, OTHER);
  if (wrote.status === 200) test.check('the world: another agent has written at the desk');
  else { test.fail('the world: the other agent\'s line answered ' + short(wrote)); return; }

  // THE NEW AGENT: its own node, its relays.json, deskClient off; its clone a scratch git repository.
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

  test.subHeading('1. the first run, before Andy grants desk');
  const first = run(SCRIPT, [String(agentPort), 'gemma:' + memberInvite.token], clone);
  if (first.code !== 0 && /grant/i.test(first.said)) test.check('without his grant it exits non-zero and names the grant');
  else test.fail(OWED + 'the first run exited ' + first.code + ', saying ' + short(first.said));
  const agentCard = await verb(agentPort, { verb: 'node.card' });
  const agentKey = agentCard.body.publicKey || '';
  if (agentKey) test.check('the agent\'s node has a key: its seat was claimed');
  else test.fail(OWED + 'the agent\'s node.card answered ' + agentCard.status + ' ' + short(agentCard.body));
  const adopted = agentKey && await waitFor(function () {
    return verb(andyPort, { verb: 'contact.get', key: agentKey }).then(function (r) { return !!(r.body.person && !r.body.person.blocked); });
  }, 15000);
  if (adopted) test.check('Andy\'s node holds the agent as a contact (adoptClaim)');
  else test.fail(OWED + 'Andy\'s node does not hold the agent\'s key');
  const knowsDesk = await verb(agentPort, { verb: 'contact.get', key: andyKey });
  if (knowsDesk.body.person && !knowsDesk.body.person.blocked) test.check('the agent\'s node holds the desk node (the relay\'s owner) as a contact');
  else test.fail(OWED + 'the agent\'s contact.get of the desk node answered ' + knowsDesk.status + ' ' + short(knowsDesk.body));
  let hook = '';
  try { hook = fs.readFileSync(path.join(clone, '.git', 'hooks', 'commit-msg'), 'utf8'); } catch (e) { hook = ''; }
  if (/commitCheck\.js/.test(hook) && hook.indexOf(String(agentPort)) !== -1) test.check('the clone\'s commit hooks are installed for the agent\'s port');
  else test.fail(OWED + 'the clone\'s commit-msg hook reads ' + short(hook || '(none)'));

  test.subHeading('2. Andy grants desk; the second run finishes');
  if (!agentKey) { test.fail(OWED + 'no agent key, so there is nothing for Andy to grant'); return; }
  const granted = await verb(andyPort, { verb: 'jobs.authGrant', key: agentKey, path: 'desk' });
  if (granted.status === 200) test.check('the world: Andy\'s node grants the agent desk');
  else test.fail('the world: jobs.authGrant answered ' + granted.status + ' ' + short(granted.body));
  const second = run(SCRIPT, [String(agentPort), 'gemma:' + memberInvite.token], clone);
  if (second.code === 0) test.check('the second run exits 0');
  else test.fail(OWED + 'the second run exited ' + second.code + ', saying ' + short(second.said));
  // The other agents are known only from the desk's own records (changes carries each record's key), which the
  // agent can read once granted; so the block is asserted after the second run, not the first.
  const blocked = await verb(agentPort, { verb: 'contact.get', key: OTHER.key });
  if (blocked.body.person && blocked.body.person.blocked === true) test.check('the agent that wrote at the desk before is blocked on the agent\'s node');
  else test.fail(OWED + 'the other agent on the agent\'s node: ' + blocked.status + ' ' + short(blocked.body));
  const read = run(EAR, [String(agentPort), 'items.search', JSON.stringify({ text: 'Work', currentGoalOnly: false, goalsOnly: false, includeClosed: false })], clone);
  if (read.code === 0 && /o\/G1\.1/.test(read.said)) test.check('the agent reads the desk through its own node: o/G1.1 is found');
  else test.fail(OWED + 'deskEar on the agent\'s node exited ' + read.code + ', saying ' + short(read.said));

  test.subHeading('3. the agent\'s removal script undoes its own side');
  if (!fs.existsSync(OFFBOARD)) { test.fail(OWED + 'there is no ' + path.basename(OFFBOARD) + ' beside onboard.js'); }
  else {
    const off = run(OFFBOARD, [String(agentPort)], clone);
    if (off.code === 0) test.check('offboard.js exits 0');
    else test.fail(OWED + 'offboard.js exited ' + off.code + ', saying ' + short(off.said));
    const left = ['commit-msg', 'post-commit', 'pre-push'].filter(function (h) {
      try { return /commitCheck\.js/.test(fs.readFileSync(path.join(clone, '.git', 'hooks', h), 'utf8')); } catch (e) { return false; }
    });
    if (left.length === 0) test.check('no commit hook of commitCheck is left in the clone');
    else test.fail(OWED + 'hooks still calling commitCheck: ' + left.join(', '));
    const mods = await verb(agentPort, { verb: 'config.searchModules', query: 'deskClient' });
    const still = (mods.body.items || []).some(function (r) { return r.key === 'process/js/deskClient'; });
    if (mods.status === 200 && !still) test.check('deskClient is off the agent node\'s include list');
    else test.fail(OWED + 'config.searchModules answered ' + mods.status + ' ' + short(mods.body));
    const seated = await waitFor(function () {
      const store = relayStore.open(relayHome);
      try { return !store.members.get(agentKey); } finally { store.close(); }
    }, 15000);
    if (seated) test.check('the relay no longer holds the agent\'s seat');
    else test.fail(OWED + 'the relay still lists the agent as a member');
  }

  test.subHeading('4. Andy\'s removal script undoes his side');
  await deskAsk('scope.set', { agent: agentKey, folder: '/' }, ANDY);
  if (!fs.existsSync(REMOVE)) { test.fail(OWED + 'there is no ' + path.basename(REMOVE) + ' beside onboard.js'); }
  else {
    const rm = run(REMOVE, [String(andyPort), agentKey], clone);
    if (rm.code === 0) test.check('removeAgent.js exits 0');
    else test.fail(OWED + 'removeAgent.js exited ' + rm.code + ', saying ' + short(rm.said));
    const q = await verb(andyPort, { verb: 'jobs.authQuery', key: agentKey, path: 'desk' });
    if (q.status === 200 && q.body.allowed === false) test.check('the agent\'s desk grant is revoked');
    else test.fail(OWED + 'jobs.authQuery answered ' + q.status + ' ' + short(q.body));
    const c = await verb(andyPort, { verb: 'contact.get', key: agentKey });
    if (!(c.body.person)) test.check('Andy\'s node no longer holds the agent as a contact');
    else test.fail(OWED + 'Andy\'s contact.get of the agent answered ' + c.status + ' ' + short(c.body));
    const s = await deskAsk('scope.get', { agent: agentKey }, ANDY);
    if (s.status === 200 && (s.body || {}).folder === '') test.check('the agent\'s scope is cleared');
    else test.fail(OWED + 'scope.get answered ' + short(s));
  }
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
