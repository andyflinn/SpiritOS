'use strict';

// spirit/test/shutdownWire.js
// A RELAY THAT IS TOLD TO STOP SAYS GOODBYE, AND IT IS HEARD.
//
//   Andy: "Did we implement clean-as-possible shutdown on sseClient/server
//   and test the effect of that?"
//
// The pieces were each tested alone — goingAway on fake sinks
// (presenceStream.js), sseClient reading `retry:` from a fake body
// (presenceNode.js) — and the EFFECT never was: a real relay process
// taking a real SIGTERM, with real clients and a real partner on the other
// end. This is that.
//
// LINUX ONLY, AND IT SAYS SO. On Windows `child.kill()` is TerminateProcess:
// the handler under test never runs, so a pass there would be a pass for
// the unclean path. It runs under WSL on the workstation (Andy chose that
// over a test-only trigger in relayServer.js, 2026-09-19) and on any Linux
// box — which is where systemd sends the same signal on spirit-3.
//
// Through the interface only (oneDoor): hub.relayRequest and sseClient.
// The hint is observed through sseClient's own published timer seam: the
// delay it schedules after the stream ends IS whether it honoured `retry:`.

const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const { claimOwner } = require('./ownerClaim');
const hub = require('../run/js/hub');
const buildStamp = require('../run/js/buildStamp');
const sseClient = require('../run/js/sseClient');
const relayStore = require('../run/js/relayStore');
const { createRelay } = require('../run/js/relay');

const REPO_RUN = path.join(__dirname, '..', 'run');
// Below 49152, outside Windows' ephemeral range — see partnerWire.js and
// presenceWire.js:41 for what a port inside it costs. This suite was
// still green on 65485/65486 when the other three went red, which is
// luck rather than a difference: the same reservation covers it.
const PORTS = [48771, 48772];
// What relayServer.js's goodbye asks for. The floor sseClient would use
// without it is FLOOR_MS, so the two cannot be confused.
const HINT_MS = 3000;
const FLOOR_MS = 100;

let kids = [];
let streams = [];
function cleanup() {
  streams.forEach(function (s) { try { s.close(); } catch (e) { /* gone */ } });
  streams = [];
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  kids = [];
}
process.on('exit', cleanup);

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function until(fn, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return true; await sleep(50); }
  return !!fn();
}

function buildRelay(tag, memberNames) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-bye-' + tag + '-'));
  const box = createRelay(home);
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const owner = auth.generateIdentity('owner' + tag);
  // The first claim takes the owner invite, minted in process (cycle 3,
  // Part B; ownerClaim.js). allow.json is written by the claim itself.
  claimOwner(box, owner, 'owner' + tag, 'fx-owner' + tag);
  const members = {};
  (memberNames || []).forEach(function (name) {
    const id = auth.generateIdentity(name);
    const minted = box.mint('owner' + tag, name, 7, '');
    box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)),
      id.publicKey, 'fx-' + name, minted.invite.token, name);
    members[name] = id;
  });
  return { tag: tag, home: home, box: box, owner: owner, members: members };
}

function plant(w) {
  const runDir = path.join(w.home, 'spirit', 'run');
  fs.cpSync(REPO_RUN, runDir, { recursive: true });
  fs.rmSync(path.join(runDir, 'relay-state'), { recursive: true, force: true });
  fs.cpSync(path.join(w.home, 'relay-state'), path.join(runDir, 'relay-state'), { recursive: true });
  const mine = buildStamp.fromGit(path.join(__dirname, '..', '..'));
  if (mine) buildStamp.write(runDir, mine);
  w.runDir = runDir;
}

// Spawned with its output piped, so the goodbye line can be read and the
// exit code seen.
async function startRelay(w, port) {
  const kid = spawn(process.execPath, ['js/relayServer.js', '--port', String(port)],
    { cwd: w.runDir, stdio: ['ignore', 'pipe', 'pipe'] });
  kids.push(kid);
  w.kid = kid;
  w.out = '';
  kid.stdout.on('data', function (d) { w.out += d; });
  kid.stderr.on('data', function (d) { w.out += d; });
  w.exited = null;
  kid.on('exit', function (code, signal) { w.exited = { code: code, signal: signal }; });
  const base = 'http://127.0.0.1:' + port;
  for (let n = 0; n < 40; n += 1) {
    await sleep(200);
    try {
      const r = await hub.relayRequest(base, 'GET', '/api/relay/key', null);
      if (r.status === 200) { w.base = base; return base; }
    } catch (e) { /* not up yet */ }
  }
  return null;
}

test.startTest('A relay told to stop says goodbye — and it is heard');

async function run() {
  if (process.platform === 'win32') {
    test.comment('The wire half is SKIPPED on Windows: child.kill() there is TerminateProcess, ' +
      'so the SIGTERM handler under test never runs. Run under WSL or Linux.');
    // What Windows CAN say, and it is weaker on purpose: the handler the
    // Linux run exercises is registered in both startup files. A guard
    // against it being deleted, not proof that it works.
    ['relayServer.js', 'server.js'].forEach(function (f) {
      const src = fs.readFileSync(path.join(REPO_RUN, 'js', f), 'utf8');
      if (/process\.on\('SIGTERM'/.test(src) && /goingAway|sayGoingAway/.test(src)) {
        test.check(f + ' registers its SIGTERM goodbye (proven on the wire only under Linux)');
      } else {
        test.fail(f + ' no longer registers a SIGTERM goodbye');
      }
    });
    return;
  }

  test.subHeading('Two relays, partnered; amy on A, bella on B');

  const A = buildRelay('a', ['amy']);
  const B = buildRelay('b', ['bella']);
  // The old model, as a fixture, as hintWire uses it: each owner a member
  // of the other's relay, then promoted. Acquisition is cycle 5.
  [[B, A.owner, 'ownera'], [A, B.owner, 'ownerb']].forEach(function (p) {
    const minted = p[0].box.mint('owner' + p[0].tag, p[2], 7, '');
    p[0].box.claim(p[2], auth.sign(p[1].privateKey, auth.claimMessage(p[2])),
      p[1].publicKey, 'fx-x-' + p[2], minted.invite.token, p[2]);
  });
  const urlA = 'http://127.0.0.1:' + PORTS[0];
  const urlB = 'http://127.0.0.1:' + PORTS[1];
  const okA = A.box.setPartner(A.owner, B.owner.publicKey, urlB, B.box.relayPublicKey(), 'h1');
  const okB = B.box.setPartner(B.owner, A.owner.publicKey, urlA, A.box.relayPublicKey(), 'h2');
  if (!okA.ok || !okB.ok) {
    test.fail('partnership fixture: ' + JSON.stringify(okA) + ' / ' + JSON.stringify(okB));
    return;
  }
  const aKey = A.box.relayPublicKey();
  const rollOnA = relayStore.open(A.home).members.count();
  relayStore.closeAll();
  plant(A); plant(B);
  if (!(await startRelay(A, PORTS[0])) || !(await startRelay(B, PORTS[1]))) {
    test.fail('a relay did not come up: ' + (A.out || '') + (B.out || ''));
    return;
  }
  await sleep(1500);   // each dials the other at boot
  test.check('both relays up, partnered, dialled');

  // amy's client, with sseClient's published seams: the timer records the
  // reconnect delay it schedules, and no jitter, so the delay is exact.
  const amy = A.members.amy;
  const delays = [];
  const closes = [];
  let opens = 0;
  let openedAgainAt = 0;
  streams.push(sseClient.connect({
    url: A.base + '/api/relay/stream?key=' + encodeURIComponent(amy.publicKey),
    headers: function () {
      return { 'X-Spirit-Sig': auth.sign(amy.privateKey, auth.streamMessage(amy.publicKey)) };
    },
    retryMs: FLOOR_MS,
    randomImpl: function () { return 1; },
    setTimeoutImpl: function (fn, ms) { delays.push(ms); return setTimeout(fn, ms); },
    onOpen: function () { opens += 1; if (opens === 2) openedAgainAt = Date.now(); },
    onClose: function (reason) { closes.push(reason); },
    onEvent: function () {},
  }));

  // bella on B, listening for what B says about A.
  const bella = B.members.bella;
  const bellaHeard = [];
  streams.push(sseClient.connect({
    url: B.base + '/api/relay/stream?key=' + encodeURIComponent(bella.publicKey),
    headers: function () {
      return { 'X-Spirit-Sig': auth.sign(bella.privateKey, auth.streamMessage(bella.publicKey)) };
    },
    onEvent: function (msg) { if (msg.event === 'presence') bellaHeard.push(msg.data); },
  }));

  if (await until(function () { return opens === 1; }, 3000)) {
    test.check('amy holds a stream on A');
  } else {
    test.fail('amy never opened a stream on A');
    return;
  }
  await sleep(300);

  test.subHeading('SIGTERM');

  const signalledAt = Date.now();
  A.kid.kill('SIGTERM');
  await until(function () { return !!A.exited; }, 5000);

  const bye = /SIGTERM — told (\d+) stream\(s\) to come back in 3s/.exec(A.out);
  if (A.exited && A.exited.code === 0 && bye && Number(bye[1]) >= 2) {
    test.check('A exits 0 and says it told ' + bye[1] + ' stream(s) to come back in 3s (amy, and B\'s link)');
  } else {
    test.fail('exit=' + JSON.stringify(A.exited) + ' out=' + JSON.stringify(A.out.slice(-300)));
  }

  await until(function () { return closes.length > 0; }, 3000);
  if (closes[0] === 'ended') {
    test.check('amy\'s stream ENDED — the relay closed it, rather than the socket failing');
  } else {
    test.fail('amy saw: ' + JSON.stringify(closes));
  }

  const scheduled = delays[delays.length - 1];
  if (scheduled === HINT_MS) {
    test.check('and her client waits ' + HINT_MS + 'ms before coming back — the `retry:` hint, honoured ' +
      '(without it: ' + FLOOR_MS + 'ms)');
  } else {
    test.fail('reconnect delays scheduled: ' + JSON.stringify(delays));
  }

  // THE PARTNER LINK. A stopping its partner links is a stream closing on
  // B; B registering it is what R10's streamClose fix made possible, and
  // B says so to its members as the partner key going absent.
  await until(function () {
    return bellaHeard.some(function (p) { return p && p.key === aKey && p.present === false; });
  }, 3000);
  if (bellaHeard.some(function (p) { return p && p.key === aKey && p.present === false; })) {
    test.check('B saw A\'s partner link close, and told its members A is gone');
  } else {
    test.fail('bella heard about A: ' + JSON.stringify(bellaHeard.filter(function (p) {
      return p && p.key === aKey;
    })));
  }

  test.subHeading('The disc is clean');

  const state = path.join(A.runDir, 'relay-state');
  if (!fs.existsSync(path.join(state, 'relay.db-journal'))) {
    test.check('no rollback journal left beside relay.db');
  } else {
    test.fail('relay.db-journal left behind');
  }
  let count = -1;
  try {
    count = relayStore.open(A.runDir).members.count();
  } catch (e) { count = -1; }
  relayStore.closeAll();
  if (count === rollOnA) {
    test.check('relay.db reopens with the whole roll: ' + count + ' member(s)');
  } else {
    test.fail('roll after shutdown: ' + count + ', expected ' + rollOnA);
  }

  test.subHeading('And the client comes back when it was told to');

  // Restarted at once, well inside the three seconds: the client must
  // still wait out the hint rather than rushing in on its floor.
  if (!(await startRelay(A, PORTS[0]))) {
    test.fail('A did not come back up: ' + A.out.slice(-300));
    return;
  }
  await until(function () { return opens >= 2; }, 8000);
  const after = openedAgainAt - signalledAt;
  if (opens >= 2 && after >= HINT_MS) {
    test.check('amy re-attached ' + after + 'ms after the signal — not before the ' + HINT_MS + 'ms she was asked to wait');
  } else {
    test.fail('opens=' + opens + ' after=' + after + 'ms');
  }
}

run()
  .catch(function (e) { test.fail(String(e && e.stack ? e.stack : e)); })
  .then(function () { cleanup(); test.reportSuccessFailureCount(); });
