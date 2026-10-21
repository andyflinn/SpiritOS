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
//      the seat's name. The relay is the one row of the node's relay-state/relays.json (goal/G16.3).
//   2  Exit 0 only when the desk read answered. Without Andy's desk grant: a non-zero exit, and its words name the
//      grant. Run again after the grant, it finishes: a second run is not refused for the seat it already holds.
//   3  The desk node's key is the relay's owner key (the relay's card, asked on its one door, answers ownerKey).
//   Since goal/G19.15 (Andy, 2026-10-12): onboard.js <port> <name:token> <desk label> [relay url]. The relay is the
//   url given ("what does it matter which relay an agent is a member of to participate in my team?"), and the desk
//   is the one node a search for the label finds, whoever owns the relay ("even if i don't own the relay my agents
//   use, still no difference.", "we'll just have to tell the agent what label to look for, when searching the
//   desk."). offboard.js takes the same optional relay url.
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
// LEFT OPEN, not asserted: a fresh clone has no relay-state/relays.json (it is not tracked), so the relay's url must
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
const { installOwner } = require('./ownerClaim.js');
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
const EAR = path.join(DESK_DIR, 'deskAgentEar.js');
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
// A stand-in node for goal/G19.15's label checks: it holds its seat, has a key, and answers contact.search with the
// matches given. Anything else is a 500, so a run that went past the desk search would say so.
function fakeNode(matches) {
  const server = require('http').createServer(function (req, res) {
    let body = '';
    req.on('data', function (c) { body += c; });
    req.on('end', function () {
      let b = {};
      try { b = JSON.parse(body); } catch (e) { b = {}; }
      const answers = {
        'relay.get': { ok: true, relay: { claimed: true } },
        'node.card': { publicKey: 'MCowBQYDK2VwAyEAagentOnboardStandInAAAAAAAAAAAAAAAAAAAAA=' },
        // contact.search since goal/G30.19 (peer.search is gone): the key beside the row as json.
        'contact.search': { ok: true, items: matches.map(function (m) { return { key: m.publicKey, label: JSON.stringify(m) }; }), more: false, selfTail: '' },
      };
      const a = answers[b.verb];
      res.writeHead(a ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(a || { error: 'not in the stand-in: ' + b.verb }));
    });
  });
  return server;
}
function runBeside(server, label) {
  return new Promise(function (resolve) {
    server.listen(0, '127.0.0.1', function () {
      const kid = spawn(process.execPath, [SCRIPT, String(server.address().port), 'gemma:token', label, 'http://127.0.0.1:1'],
        { cwd: os.tmpdir() });
      let said = '';
      kid.stdout.on('data', function (d) { said += d; });
      kid.stderr.on('data', function (d) { said += d; });
      kid.on('close', function (code) { server.close(); resolve({ code: code, said: said }); });
    });
  });
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
// Since goal/G19.15 the node's relay list is node.db's relays table, keyed by relay key: the scratch relay is
// listed under the key its door answers, before the node starts (which then adds the two seeds after it).
function pointAt(home, relayUrl, relayKey) {
  require('../run/js/relayKeys.js').list(home, relayUrl, 'spirit', relayKey);
  require('../run/js/nodeStore.js').open(home).close();
}

(async function () {
  if (!fs.existsSync(SCRIPT)) {
    test.fail(OWED + 'there is no ' + path.relative(path.join(__dirname, '..', '..'), SCRIPT) + '; nothing below can run');
    return;
  }

  // THE RELAY, installed for ANDY'S NODE, which claims it with no invite and runs the desk.
  const relayHome = plant('relay');
  fs.rmSync(path.join(relayHome, 'relay-state'), { recursive: true, force: true });
  // Andy's node's key goes into the relay's owner.json before the relay starts, as bash/install-units
  // writes it (goal/G16.8: a relay is owned at install, never over the wire); his node claims with no invite.
  const andyHome = plant('andy');
  installOwner(relayHome, andyHome, 'andy');
  const relayPort = await freePort();
  startNode(relayHome, relayPort, ['--relay']);
  const relayUrl = 'http://127.0.0.1:' + relayPort;
  const relayUp = await require('./relayDoor').awaitRelayDoor(relayUrl);
  if (!relayUp) { test.fail('the scratch relay never answered a card ask on its one door'); return; }
  const relayKey = relayUp.relayPublicKey || '';

  includeList.add(andyHome, 'process/js/desk');
  pointAt(andyHome, relayUrl, relayKey);
  const andyPort = await freePort();
  startNode(andyHome, andyPort);
  await waitFor(function () { return verb(andyPort, { verb: 'node.debug', debug: {} }).then(function (r) { return r.status === 200; }); }, 15000);
  const owned = await verb(andyPort, { verb: 'relay.claim', url: relayUrl, name: 'andy' });
  const andyCard = await verb(andyPort, { verb: 'node.card' });
  const andyKey = andyCard.body.publicKey || '';
  if (owned.status >= 200 && owned.status < 300 && andyKey) test.check('the world: Andy\'s node owns the scratch relay');
  else { test.fail('the world: the owner claim answered ' + owned.status + ' ' + short(owned.body)); return; }

  // ANOTHER AGENT HAS ALREADY WRITTEN AT THE DESK, under its own key.
  const deskClient = appClient.createAppClient({ rootDir: andyHome });
  deskClient.register('desk', appClient.pipePathFor(andyHome, 'desk', process.platform, 'process'));
  const deskAsk = function (v, a, caller) { const q = {}; q[v] = a; return deskClient.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
  await waitFor(function () { return deskAsk('state.get', {}, OTHER).then(function (r) { return r.status === 200; }); }, 15000);
  // goal/G29.21: an agent's session creates no goal, so Andy writes the world.
  await deskAsk('session.set', { json: JSON.stringify({ goal: { id: 'o/G1', title: 'Onboarding' }, items: [{ id: 'o/G1.1', title: 'Work', blocks: ['o/G1'] }] }) }, ANDY);
  // Since goal/G18.8 an agent writes only where it holds the item or the take of his line.
  await deskAsk('item.take', { id: 'o/G1.1' }, OTHER);
  const wrote = await deskAsk('chat.add', { id: 'o/G1.1', text: 'claude-windows was here first' }, OTHER);
  if (wrote.status === 200) test.check('the world: another agent has written at the desk');
  else { test.fail('the world: the other agent\'s line answered ' + short(wrote)); return; }

  // THE NEW AGENT: its own node, deskClient off; its clone a scratch git repository.
  // Since goal/G19.15 a fresh node lists noderoutes.net alone, and the agent is pointed at nothing: onboard.js takes
  // the scratch relay's url as its third argument and the claim lists it (Andy, 2026-10-12: "what does it matter
  // which relay an agent is a member of to participate in my team?").
  const agentHome = plant('gemma');
  const agentPort = await freePort();
  startNode(agentHome, agentPort);
  await waitFor(function () { return verb(agentPort, { verb: 'node.debug', debug: {} }).then(function (r) { return r.status === 200; }); }, 15000);
  const clone = path.join(scratch, 'clone');
  fs.mkdirSync(clone, { recursive: true });
  spawnSync('git', ['init', '-q'], { cwd: clone });
  const memberInvite = invites.add(relayHome, { label: 'gemma', days: 1 });
  relayStore.open(relayHome).close();

  test.subHeading('1. the first run, before Andy grants desk');
  // Since goal/G19.15: the desk's label (the desk is found by searching for it) and the relay url to claim on.
  const first = run(SCRIPT, [String(agentPort), 'gemma:' + memberInvite.token, 'andy', relayUrl], clone);
  if (first.code !== 0 && /grant/i.test(first.said)) test.check('without his grant it exits non-zero and names the grant');
  else test.fail(OWED + 'the first run exited ' + first.code + ', saying ' + short(first.said));
  // THE RELAY URL ARGUMENT IS HONOURED (goal/G19.15): the seat is claimed on the url given, which the fresh node did
  // not list, and not on the one relay it did list (noderoutes.net).
  // relay.get answers only for a relay on the node's list, so a claimed row there is the url listed and seated.
  const onGiven = await verb(agentPort, { verb: 'relay.get', key: relayUrl });
  const onRoutes = await verb(agentPort, { verb: 'relay.get', key: 'https://noderoutes.net' });
  const givenRow = (onGiven.body && onGiven.body.relay) || {};
  const routesRow = (onRoutes.body && onRoutes.body.relay) || {};
  if (first.said.indexOf('seat claimed on ' + relayUrl) !== -1 && onGiven.status === 200 && givenRow.claimed &&
      onRoutes.status === 200 && !routesRow.claimed && !routesRow.owned) {
    test.check('the relay url given is the one claimed on, and the claim listed it; noderoutes.net is listed and not claimed');
  } else {
    test.fail(OWED + 'the relay url argument was not honoured: relay.get ' + short(onGiven.body) + ' / noderoutes ' +
      short(onRoutes.body) + ' / said ' + short(first.said));
  }
  const agentCard = await verb(agentPort, { verb: 'node.card' });
  const agentKey = agentCard.body.publicKey || '';
  if (agentKey) test.check('the agent\'s node has a key: its seat was claimed');
  else test.fail(OWED + 'the agent\'s node.card answered ' + agentCard.status + ' ' + short(agentCard.body));
  const adopted = agentKey && await waitFor(function () {
    return verb(andyPort, { verb: 'contact.get', key: agentKey }).then(function (r) { return !!(r.body.person && !r.body.person.blocked); });
  }, 15000);
  if (adopted) test.check('Andy\'s node holds the agent as a contact (adoptClaim)');
  else test.fail(OWED + 'Andy\'s node does not hold the agent\'s key');
  // FOUND BY LABEL (goal/G19.15): Andy, "we'll just have to tell the agent what label to look for, when searching
  // the desk." The desk node is the one the search for 'andy' found, and it is Andy's node.
  if (/the desk node is a contact: andy/.test(first.said)) test.check('the desk node is found by searching for its label, andy');
  else test.fail(OWED + 'the desk was not found by its label: ' + short(first.said));
  const knowsDesk = await verb(agentPort, { verb: 'contact.get', key: andyKey });
  if (knowsDesk.body.person && !knowsDesk.body.person.blocked) test.check('the agent\'s node holds the desk node (the relay\'s owner) as a contact');
  else test.fail(OWED + 'the agent\'s contact.get of the desk node answered ' + knowsDesk.status + ' ' + short(knowsDesk.body));
  let hook = '';
  try { hook = fs.readFileSync(path.join(clone, '.git', 'hooks', 'commit-msg'), 'utf8'); } catch (e) { hook = ''; }
  if (/commitCheck\.js/.test(hook) && hook.indexOf(String(agentPort)) !== -1) test.check('the clone\'s commit hooks are installed for the agent\'s port');
  else test.fail(OWED + 'the clone\'s commit-msg hook reads ' + short(hook || '(none)'));

  // NONE, OR TWO, UNDER THE LABEL (goal/G19.15): the run ends and says so. Asked of a stand-in node that answers
  // the verbs onboard.js asks before the desk is chosen, because a relay does not seat two members under one label,
  // so two answers to one search cannot be made with real relays without a partner world.
  test.subHeading('1b. the desk label finds nobody, or two nodes: the run ends and says which');
  const nobody = await runBeside(fakeNode([]), 'andy');
  if (nobody.code === 1 && /no node is found under the desk label "andy"/.test(nobody.said)) {
    test.check('no node under the label: exit 1, and it says no node is found');
  } else {
    test.fail(OWED + 'with nobody under the label it exited ' + nobody.code + ', saying ' + short(nobody.said));
  }
  const twins = await runBeside(fakeNode([
    { publicKey: 'MCowBQYDK2VwAyEAagentOnboardTwinOneAAAAAAAAAAAAAAAAAAAAA=', publicLabel: 'andy', relay: relayUrl },
    { publicKey: 'MCowBQYDK2VwAyEAagentOnboardTwinTwoAAAAAAAAAAAAAAAAAAAAA=', publicLabel: 'andy', relay: relayUrl },
    { publicKey: 'MCowBQYDK2VwAyEAagentOnboardNotAndyAAAAAAAAAAAAAAAAAAAAA=', publicLabel: 'andy2', relay: relayUrl },
  ]), 'andy');
  if (twins.code === 1 && /2 nodes are found under the desk label "andy"/.test(twins.said)) {
    test.check('two nodes under the label (a third, andy2, not counted): exit 1, and it says two are found');
  } else {
    test.fail(OWED + 'with two under the label it exited ' + twins.code + ', saying ' + short(twins.said));
  }

  test.subHeading('2. Andy grants desk; the second run finishes');
  if (!agentKey) { test.fail(OWED + 'no agent key, so there is nothing for Andy to grant'); return; }
  const granted = await verb(andyPort, { verb: 'auth.grant', key: agentKey, path: 'desk' });
  if (granted.status === 200) test.check('the world: Andy\'s node grants the agent desk');
  else test.fail('the world: auth.grant answered ' + granted.status + ' ' + short(granted.body));
  const second = run(SCRIPT, [String(agentPort), 'gemma:' + memberInvite.token, 'andy', relayUrl], clone);
  if (second.code === 0) test.check('the second run exits 0');
  else test.fail(OWED + 'the second run exited ' + second.code + ', saying ' + short(second.said));
  // The other agents are known only from the desk's own records (changes carries each record's key), which the
  // agent can read once granted; so the block is asserted after the second run, not the first.
  const blocked = await verb(agentPort, { verb: 'contact.get', key: OTHER.key });
  if (blocked.body.person && blocked.body.person.blocked === true) test.check('the agent that wrote at the desk before is blocked on the agent\'s node');
  else test.fail(OWED + 'the other agent on the agent\'s node: ' + blocked.status + ' ' + short(blocked.body));
  const read = run(EAR, [String(agentPort), 'items.search', JSON.stringify({ text: 'Work', currentGoalOnly: false, goalsOnly: false, includeClosed: false })], clone);
  if (read.code === 0 && /o\/G1\.1/.test(read.said)) test.check('the agent reads the desk through its own node: o/G1.1 is found');
  else test.fail(OWED + 'deskAgentEar on the agent\'s node exited ' + read.code + ', saying ' + short(read.said));

  test.subHeading('3. the agent\'s removal script undoes its own side');
  if (!fs.existsSync(OFFBOARD)) { test.fail(OWED + 'there is no ' + path.basename(OFFBOARD) + ' beside onboard.js'); }
  else {
    // Since goal/G19.15 the node lists noderoutes.net beside the relay it joined, so offboard is told which.
    const off = run(OFFBOARD, [String(agentPort), relayUrl], clone);
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
  if (!fs.existsSync(REMOVE)) { test.fail(OWED + 'there is no ' + path.basename(REMOVE) + ' beside onboard.js'); }
  else {
    const rm = run(REMOVE, [String(andyPort), agentKey], clone);
    if (rm.code === 0) test.check('removeAgent.js exits 0');
    else test.fail(OWED + 'removeAgent.js exited ' + rm.code + ', saying ' + short(rm.said));
    const q = await verb(andyPort, { verb: 'auth.query', key: agentKey, path: 'desk' });
    if (q.status === 200 && q.body.allowed === false) test.check('the agent\'s desk grant is revoked');
    else test.fail(OWED + 'auth.query answered ' + q.status + ' ' + short(q.body));
    const c = await verb(andyPort, { verb: 'contact.get', key: agentKey });
    if (!(c.body.person)) test.check('Andy\'s node no longer holds the agent as a contact');
    else test.fail(OWED + 'Andy\'s contact.get of the agent answered ' + c.status + ' ' + short(c.body));
    // (Its third step, the agent's scope cleared, went with agent scopes in goal/G10.8.)
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
