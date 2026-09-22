'use strict';

// spirit/test/presenceWire.js
// The only suite in this repo that uses a real socket.
//
// Everything else drives objects in process, which is right for logic and
// is why the harness is fast. It is also why nothing here had ever proved
// that the relay's SSE route and the node's hand-rolled reader agree —
// two halves written a day apart, each tested against a fake of the
// other, which is exactly how two mocks come to agree about a protocol
// neither implements (design/cleanup/2026-09-11-live-surface-tests.md).
//
// So: a real relay process, real HTTP, real sockets, real socket deaths.
//
// What it still does NOT cover, and the doc above says so: TLS, and a
// proxy in the path. Those need a Caddy in the lab.

const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const { claimOwner } = require('./ownerClaim');
const invites = require('../run/js/invites');
// The device page's URL spelling, from the module that defines it rather
// than from a copy in this file — see theDevicePageIsServed.
const deviceAuth = require('../run/js/deviceAuth');
// The node's own record of where it holds a seat — see nodeFor.
const relayKeys = require('../run/js/relayKeys');
const hub = require('../run/js/hub');
const presenceNode = require('../run/js/presenceNode');
const { createPeerPost } = require('../run/js/peerPost');
const buildStamp = require('../run/js/buildStamp');
const plantRun = require('./plantRun');
const { createRelay } = require('../run/js/relay');
const rollOf = require('./rollOf');

// A port is CHOSEN AT RUN TIME, not written down, and the server is
// waited for rather than slept at.
//
// It was a constant, 65435, and that is inside Windows' ephemeral range
// (49152-65535) — where any outbound connection this machine makes can
// take it first. It did: a browser's socket to Google held it, the spawn
// failed to bind, `stdio: 'ignore'` swallowed the error, and the suite
// reported five product failures for a server that was never listening.
//
// A test that can fail for a reason it does not name is worse than no
// test, because it teaches you to distrust the ones that are telling the
// truth.
let PORT = 0;
let BASE = '';
const PORT_CANDIDATES = [48731, 48732, 48733, 48734, 48735];

let child = null;
const opened = [];

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function buildRelayHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-wire-relay-'));
  const box = createRelay(home);
  const house = auth.generateIdentity('andy');
  auth.saveIdentity(home, house);
  // The first claim takes the owner invite, minted in process (cycle 3,
  // Part B; ownerClaim.js). allow.json is written by the claim itself.
  claimOwner(box, house, 'andy');
  const bert = auth.generateIdentity('bert');
  const minted = box.mint('andy', 'bert', 7);
  box.claim('bert', auth.sign(bert.privateKey, auth.claimMessage('bert')),
    bert.publicKey, '10.0.0.1', minted.invite.token, 'bert');

  // server.js insists on running from a spirit/run, so it gets one of
  // its own with this mailbox in it. A copy rather than the repo tree:
  // a test must never start a server on the working directory.
  const runDir = path.join(home, 'spirit', 'run');
  plantRun.plantRunTree(runDir);
  fs.rmSync(path.join(runDir, 'relay-state'), { recursive: true, force: true });
  fs.cpSync(path.join(home, 'relay-state'), path.join(runDir, 'relay-state'), { recursive: true });

  // A COPY IS A TREE, NOT A REPOSITORY, so it cannot answer "which
  // commit am I" by itself — it reported `unknown`, honestly, until this
  // line. Stamped the way labMaster stamps its fakes, which is what lets
  // the assertion below be the strong one: not "it said a commit" but
  // "it is running the commit I am testing".
  const mine = buildStamp.fromGit(path.join(__dirname, '..', '..'));
  if (mine) buildStamp.write(runDir, mine);

  return { runDir: runDir, house: house, bert: bert, stamp: mine };
}

// A personal node, driven through its REAL entry point — start(), the
// real probe over real HTTP, the real claimedUrls discovery, the real
// openTo with its real signature and headers.
//
// An earlier version of this helper opened the stream by hand, and it
// looked equivalent. It was not: openTo is where onClose is wired to
// forget(), so hand-rolling it silently dropped the one behaviour the
// last section of this suite exists to check, and the suite reported a
// product bug that was really a gap in itself. A test that reimplements
// the thing it is testing agrees with its own version and nothing else.
function nodeFor(id) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-wire-node-'));
  auth.saveIdentity(home, id);
  fs.mkdirSync(path.join(home, 'app', 'natter'), { recursive: true });
  fs.writeFileSync(
    path.join(home, 'app', 'natter', 'relays.json'),
    JSON.stringify([{ label: 'wire', url: BASE }])
  );
  // AND THE SEAT. The claims above are made straight on the relay object
  // (`box.claim(...)`), which is the RELAY's half of a bind. A node keeps
  // its own record of where it holds one and reads that at boot
  // (relayKeys.seat, written by hub.handleClaim on a real claim), so a
  // fixture that claims around the node has to write the node's half —
  // otherwise `claimedUrls` is empty and nothing dials anything.
  relayKeys.seat(home, BASE, id.name || 'wire');
  const jobs = {
    job: null,
    createJob: function (k, t, d) { jobs.job = { id: 'j', kind: k, type: t, data: d }; return jobs.job; },
    updateJob: function (i, p) { if (p.data) Object.assign(jobs.job.data, p.data); return jobs.job; },
  };
  // THE REAL POST HALF, not a stub. This suite already probes with
  // hub.relayRequest rather than a stand-in, and the pairing is the same
  // kind of claim: a reply arriving on the stream has to settle in the
  // table the post opened, so the two halves are wired here exactly as
  // server.js wires them.
  const P = presenceNode.createPresence({
    rootDir: home,
    jobs: jobs,
    router: createPeerPost({ rootDir: home, request: hub.relayRequest }),
  });
  opened.push({ close: function () { P.stop(); } });
  // hub.relayRequest is the node's own outbound helper, so the probe is
  // the one production uses rather than a stand-in for it.
  return { P: P, jobs: jobs, started: P.start(hub.relayRequest) };
}

// Every exit path closes the streams and kills the child. A suite that
// leaves a socket open does not fail — it HANGS, and the runner reports
// the last green line before it (natterBind.js, 618 seconds).
function cleanup() {
  opened.forEach(function (s) { try { s.close(); } catch (e) { /* gone */ } });
  if (child) { try { child.kill(); } catch (e) { /* gone */ } child = null; }
}

test.startTest('Presence wire — a real socket, end to end');

// Answers when the relay is actually serving, or null if it never does.
// TWELVE SECONDS, NOT FIVE, AND THE CHILD'S OWN WORDS IF IT NEVER COMES.
//
// The restart below reuses the port the killed relay had, so this waits
// out both the old socket's lingering and the new process's start. Five
// seconds was enough for one suite alone and not for the same suite in a
// full harness run, where the box is doing a hundred other things —
// cycle 9, where two more suites tipped it over.
//
// `stdio: 'ignore'` hid the only thing worth knowing when it fails: a
// relay that REFUSED to start looked exactly like a port that was held.
// The output is kept and printed with the failure instead.
async function awaitRelay(runDir, port) {
  const said = [];
  const kid = spawn(process.execPath, ['js/server.js', '--port', String(port), '--relay'],
    { cwd: runDir, stdio: ['ignore', 'pipe', 'pipe'] });
  kid.stdout.on('data', function (b) { said.push(String(b)); });
  kid.stderr.on('data', function (b) { said.push(String(b)); });
  const base = 'http://127.0.0.1:' + port;
  for (let n = 0; n < 60; n += 1) {
    await sleep(200);
    try {
      const res = await fetch(base + '/api/relay/key');
      if (res.ok) return { kid: kid, base: base, port: port };
    } catch (e) { /* not up yet, or this port was taken */ }
  }
  try { kid.kill(); } catch (e) { /* gone */ }
  lastRelaySaid = said.join('').trim();
  return null;
}

// What the last relay that would not come up printed, so a refusal to
// start is reported as a refusal rather than as a held port.
let lastRelaySaid = '';

async function run() {
  const lab = buildRelayHome();

  let up = null;
  for (const candidate of PORT_CANDIDATES) {
    up = await awaitRelay(lab.runDir, candidate);
    if (up) break;
  }
  if (!up) {
    test.fail('no relay came up on any of ' + PORT_CANDIDATES.join(', ') +
      ' — this suite needs one free port and says so rather than timing out');
    return;
  }
  child = up.kid;
  PORT = up.port;
  BASE = up.base;

  test.subHeading('The box will say what it is made of');

  // Public on purpose: the question a deploy check asks must not need a
  // private key, or it can only be asked from the owner's own machine.
  const v1 = await (await fetch(BASE + '/api/version')).json();
  const expected = lab.stamp && lab.stamp.commit;
  if (v1 && v1.relay === true && expected && v1.commit === expected) {
    test.check('the relay under test is running the commit under test: ' + v1.commit);
  } else {
    test.fail('version: ' + JSON.stringify(v1) + ' expected ' + expected);
  }

  // THE property, and the only one worth a spawned server to prove. The
  // answer must describe the code that was LOADED, not the code on disk
  // now — a process that re-read git per request would report a new
  // commit the instant somebody pulled, without restarting, which is
  // exactly the lie this exists to catch. A startedAt that never moves
  // is that promise, observable from outside.
  await sleep(400);
  const v2 = await (await fetch(BASE + '/api/version')).json();
  if (v2.startedAt === v1.startedAt && v2.commit === v1.commit) {
    test.check('and the answer is taken once, at load — startedAt does not drift');
  } else {
    test.fail('answer moved: ' + JSON.stringify(v1) + ' -> ' + JSON.stringify(v2));
  }

  test.subHeading('The route and the reader agree about the protocol');

  const A = nodeFor(lab.bert);
  const claimed = await A.started;
  if (claimed.length === 1 && claimed[0] === BASE) {
    test.check('the node discovered the relay it holds a row on, over real HTTP');
  } else {
    test.fail('claimedUrls: ' + JSON.stringify(claimed));
  }
  await sleep(1000);
  let seen = A.P.table();

  // No roster since cycle 3 (0012 widened). The node seeds itself and the
  // relay from the pinned relay key when the stream opens, so seeing
  // itself green is the proof that a real socket opened.
  if (seen[lab.bert.publicKey] === true) {
    test.check('the stream opens over a real socket and the node sees itself');
  } else {
    test.fail('stream never opened: ' + JSON.stringify(seen));
  }

  // This asserted the opposite until cycle 3: that the roster carried the
  // absent owner, marked absent. The relay names nobody who has not moved;
  // an absent member is simply not asserted present.
  if (seen[lab.house.publicKey] !== true) {
    test.check('and an absent member is not asserted present — no roll is served');
  } else {
    test.fail('absent member shown present: ' + JSON.stringify(seen));
  }

  test.subHeading('Arrivals and departures travel');

  const B = nodeFor(lab.house);
  await B.started;
  await sleep(1000);
  seen = A.P.table();
  if (seen[lab.house.publicKey] === true) {
    test.check('a second node connecting reaches the first as a change');
  } else {
    test.fail('arrival not seen: ' + JSON.stringify(seen));
  }

  // The one the dual close/error teardown exists for. Not a fake sink
  // being told to close — an actual socket destroyed.
  B.P.stop();
  await sleep(1200);
  seen = A.P.table();
  if (seen[lab.house.publicKey] === false) {
    test.check('and a real socket dying is seen as an absence, not silence');
  } else {
    test.fail('departure not seen: ' + JSON.stringify(seen));
  }

  // While the relay is still alive, and before it is killed below.
  await theDevicePageIsServed(up, lab.house.publicKey);

  test.subHeading('The relay going away does not take the node with it');

  child.kill();
  child = null;
  await sleep(1500);
  // Surviving is the assertion: a client that threw on the relay dying
  // would have taken the whole node down with it, and a node must
  // outlive any relay it talks to.
  test.check('the node is still running after the relay died');

  // A relay that is gone knows nothing, so its answers must stop
  // standing — the node would otherwise be the liar.
  seen = A.P.table();
  if (Object.keys(seen).length === 0) {
    test.check('and the dead relay stopped asserting anything at all');
  } else {
    test.fail('stale presence outlived the relay: ' + JSON.stringify(seen));
  }

  // ── AND IT COMES BACK BY ITSELF ─────────────────────────────────────
  //
  //   Andy: "have we built and verified that relays can restart and
  //   re-establish connections? does this run properly through
  //   sseClient?" ... "the relay re-attachment is vital."
  //
  // It was not. Three things were separately true and the gap between
  // them was invisible: sseClient's retry loop is asserted against a fake
  // fetch (presenceNode.js), a relay keeping its state across a restart is
  // asserted with real processes (labPersistence.js), and the suite you
  // are reading proved a relay DYING without a node dying with it — then
  // stopped. Nothing had ever watched a node re-attach to a relay that
  // came back.
  //
  // WHY IT IS VITAL RATHER THAN TIDY. `bash/update` restarts a relay every
  // time it takes a tag, so this is a routine Tuesday and not an outage.
  // And since the partner gate landed, a PARTNERSHIP is two long-lived
  // streams between two machines that both get updated — so a reconnect
  // that silently did not happen would leave a partnership that looks
  // established and carries nothing.
  //
  // NOBODY ASKS IT TO. The node is not told the relay is back and has no
  // poll: sseClient's own backoff wakes up, the GET succeeds, and presence
  // arrives. That is the whole assertion.
  test.subHeading('And the node re-attaches to a relay that came back');

  const again = await awaitRelay(lab.runDir, PORT);
  if (!again) {
    test.fail('the relay did not come back on ' + PORT + ' — the port may still be held' +
      (lastRelaySaid ? '; it said: ' + lastRelaySaid : '; it said nothing at all'));
    return;
  }
  child = again.kid;

  // Long enough for the backoff to have tried: 1s, then 2s, then 4s.
  // Polled rather than slept flat, so a fast reconnect does not pay for
  // the slow case.
  let refilled = {};
  for (let n = 0; n < 20; n += 1) {
    await sleep(500);
    refilled = A.P.table();
    if (Object.keys(refilled).length) break;
  }

  if (Object.keys(refilled).length) {
    test.check('the stream re-opened on its own and presence came back: ' +
      Object.keys(refilled).length + ' known');
  } else {
    test.fail('the node never re-attached — sseClient gave up, or presence did not resume');
  }

  // RE-ATTACHED IS NOT THE SAME AS USABLE. A stream that reconnects but
  // whose node never re-enrols is a socket with nothing behind it, which
  // reads as healthy from every angle except asking it something.
  // ── ASKED OF THE FILE, NOT A ROUTE (2026-09-18) ──────────────────
  //
  // This read `GET /api/relay/who` and counted the rows. That route was a
  // public, unsigned read of every member — named a cheat in 0010 and
  // deleted the next day — and the claim being made here is about the
  // relay's MEMORY, which is on disk.
  //
  // It has to answer as well, or a file on disk proves nothing about a
  // process: the key door is what says the box came back up.
  const said = await hub.relayRequest(BASE, 'GET', '/api/relay/key', null);
  // relay.db since cycle 3, read through the store the way suites read
  // the roll (rollOf.js), and closed so the tree can be removed on Windows.
  let rows = [];
  try { rows = rollOf(lab.runDir); } catch (e) { rows = []; }
  try { require('../run/js/relayStore').closeAll(); } catch (e) { /* none open */ }

  if (said.status === 200 && rows.length) {
    test.check('and the relay that came back still knows who its members are: ' +
      rows.length + ' rows');
  } else {
    test.fail('after restart — key door ' + said.status +
      ', relay.db rows ' + rows.length);
  }
}

// ── THE DEVICE PAGE IS SERVED, not merely allowed ────────────────────
//
// This suite already spawns a real --relay over a real socket, which is
// the only place in the harness that can ask a relay for a URL and see
// what comes back. It is put here for that reason and no other.
//
// THE BUG IT EXISTS FOR. `devicePageKey` decides which paths look like a
// device page, and `isRelayPublicPath` uses it to let them through the
// relay's 404-everything gate. The HANDLER that answers them was deleted
// by accident on 2026-09-12, in the same commit that removed the poll:
// the cut ran from the `device-pending` route to the next one and this
// sat between them.
//
// So every keyed device URL 404'd from that moment, and NOTHING NOTICED.
// No suite asked a relay for the page; relayProbe's surface list does not
// name it; and `isRelayPublicPath` still said yes, so the gate was intact
// and only the answer was missing. Andy found it by clicking the link in
// natterDetails.
//
// ALLOWED IS NOT SERVED, and that is the general shape worth guarding: a
// permission with nothing behind it looks exactly like a working route
// from every angle except a request.
async function theDevicePageIsServed(up, ownerKey) {
  test.subHeading('The device page is served, not merely permitted');

  // `segOf` STOOD HERE — a fourth hand-rolled copy of the same three
  // replacements. A suite that spells the rule itself cannot catch the
  // rule changing, which is the one thing it is here to do: this asserts
  // the URL the product builds, so it has to be built the product's way.
  const mine = await fetch(up.base + '/' + deviceAuth.keyToUrl(ownerKey) + '/device');
  const body = mine.ok ? await mine.text() : '';
  if (mine.status === 200 && /<html/i.test(body)) {
    test.check('an identity this relay holds is handed the page, over a real socket');
  } else {
    test.fail('own key: ' + mine.status + ' ' + body.slice(0, 80));
  }

  // The page carries no per-person anything: one file for everybody, and
  // the key lives only in the URL. If this ever became templated, the
  // relay would be generating something about a person.
  if (body.indexOf(ownerKey) === -1) {
    test.check('and the page is the same file for everybody — the key is in the address, not the body');
  } else {
    test.fail('the served page embedded the identity key');
  }

  // AN IDENTITY NOBODY HOLDS IS A 404, rather than a working-looking form
  // that can never succeed. It leaks nothing: /api/relay/who already
  // hands every key to anyone who asks.
  const stranger = 'MCowBQYDK2VwAyEA' + 'x'.repeat(43);
  const nope = await fetch(up.base + '/' + stranger + '/device');
  if (nope.status === 404) {
    test.check('while a key this relay never heard of is 404, not an unusable form');
  } else {
    test.fail('stranger key: ' + nope.status);
  }

  // And it is the KEYED path that is served. A bare /device is not a
  // page: every enrolment names whose it is, which is what lets one relay
  // hold a device per identity rather than one for the box.
  const bare = await fetch(up.base + '/device');
  if (bare.status === 404) {
    test.check('and a bare /device names nobody, so it is nothing');
  } else {
    test.fail('bare /device answered ' + bare.status);
  }
}

run()
  .catch(function (e) { test.fail(String(e && e.stack ? e.stack : e)); })
  .then(function () {
    cleanup();
    test.reportSuccessFailureCount();
  });
