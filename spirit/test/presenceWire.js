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
const invites = require('../run/js/invites');
const hub = require('../run/js/hub');
const presenceNode = require('../run/js/presenceNode');
const buildStamp = require('../run/js/buildStamp');
const { createRelay } = require('../run/js/relay');

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
const REPO_RUN = path.join(__dirname, '..', 'run');
const PORT_CANDIDATES = [48731, 48732, 48733, 48734, 48735];

let child = null;
const opened = [];

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function buildRelayHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-wire-relay-'));
  const box = createRelay(home);
  const house = auth.generateIdentity('andy');
  auth.saveIdentity(home, house);
  box.claim('andy', auth.sign(house.privateKey, auth.claimMessage('andy')), house.publicKey);
  const bert = auth.generateIdentity('bert');
  const minted = box.mint('andy', 'bert', 7,
    auth.sign(house.privateKey, invites.mintMessage('bert', 7)));
  box.claim('bert', auth.sign(bert.privateKey, auth.claimMessage('bert')),
    bert.publicKey, '10.0.0.1', minted.invite.token);

  // server.js insists on running from a spirit/run, so it gets one of
  // its own with this mailbox in it. A copy rather than the repo tree:
  // a test must never start a server on the working directory.
  const runDir = path.join(home, 'spirit', 'run');
  fs.cpSync(REPO_RUN, runDir, { recursive: true });
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
  const jobs = {
    job: null,
    createJob: function (k, t, d) { jobs.job = { id: 'j', kind: k, type: t, data: d }; return jobs.job; },
    updateJob: function (i, p) { if (p.data) Object.assign(jobs.job.data, p.data); return jobs.job; },
  };
  const P = presenceNode.createPresence({ rootDir: home, jobs: jobs });
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
async function awaitRelay(runDir, port) {
  const kid = spawn(process.execPath, ['js/server.js', '--port', String(port), '--relay'],
    { cwd: runDir, stdio: 'ignore' });
  const base = 'http://127.0.0.1:' + port;
  for (let n = 0; n < 25; n += 1) {
    await sleep(200);
    try {
      const res = await fetch(base + '/api/relay/who');
      if (res.ok) return { kid: kid, base: base, port: port };
    } catch (e) { /* not up yet, or this port was taken */ }
  }
  try { kid.kill(); } catch (e) { /* gone */ }
  return null;
}

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

  if (seen[lab.bert.publicKey] === true) {
    test.check('a roster crosses a real socket and parses');
  } else {
    test.fail('no roster arrived: ' + JSON.stringify(seen));
  }

  // The half that cannot be faked into existence: an absent member has
  // to be IN the roster, or the node cannot tell red from white — and
  // that is a property of what the RELAY sends, not of the parser.
  if (seen[lab.house.publicKey] === false) {
    test.check('and carries the members who are NOT there, marked absent');
  } else {
    test.fail('absent member missing over the wire: ' + JSON.stringify(seen));
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
}

run()
  .catch(function (e) { test.fail(String(e && e.stack ? e.stack : e)); })
  .then(function () {
    cleanup();
    test.reportSuccessFailureCount();
  });
