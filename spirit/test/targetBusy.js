'use strict';

// spirit/test/targetBusy.js
// ONE MEMBER, TWO PEOPLE ASKING — AND THE REFUSAL THAT SAYS SO, ON THE WIRE.
//
//   Andy: "also: cap the requests for a specific target at one, respond
//   with (not available), if this causes the calling node to keep the
//   request queued, nothing is lost."
//   Andy: "two nodes overloading request to a third node will cover
//   rejections by the relay."
//
// Decision 0016. The per-target cap is the one that needs no cooperation
// from anybody: a per-requester cap is defeated by being many requesters,
// and a Sybil farm can be — but it cannot be many TARGETS, because the
// target is the person being bothered and there is only one of them.
//
// ── WHY THIS SUITE RUNS A PROCESS AND router.js DOES NOT SUFFICE ─────
//
// router.js tests the cap in memory and passes. It would have passed with
// this shipped broken, because the bug was not in the router.
//
// relayServer.js builds a refusal body BY WHITELIST — `{ error, inFlight }`
// — and a whitelist is right (a relay must not spray its internals at
// anybody who can provoke an error) but it means a new field is invisible
// until somebody adds it. The router refuses with `{ busy, retryAfterMs }`
// and both were dropped on the floor. Over the wire that is 503 "target is
// busy" reaching a node as a bare 503, indistinguishable from 503 "peer
// not reachable" — the same status and the opposite situation.
//
// So the claim this file makes is exactly the one a unit test cannot: the
// marker SURVIVES THE TRIP. Every byte crosses a loopback socket.
//
// What a green run proves:
//   1. a relay honours `maxPerTarget` from relay-state/config.json
//   2. one request reaches the target and a second, from somebody else,
//      is refused 503
//   3. the refusal is marked `busy` and carries `retryAfterMs` — so a
//      scheduler can tell contention from a broken peer without reading
//      error strings
//   4. a different target is unaffected: the cap is the target's, not the
//      table's
//   5. when the target answers, the next asker gets in

const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const { claimOwner } = require('./ownerClaim');
const hub = require('../run/js/hub');
const buildStamp = require('../run/js/buildStamp');
const plantRun = require('./plantRun');
const sseClient = require('../run/js/sseClient');
const { createRelay } = require('../run/js/relay');

// Below 49152, outside Windows' ephemeral range — see partnerWire.js and
// presenceWire.js:41 for what a port inside it costs.
const PORT = 48781;

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

function buildRelay(memberNames) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-tb-'));
  const box = createRelay(home);
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const owner = auth.generateIdentity('owner');
  claimOwner(box, owner, 'owner', 'fx-owner');
  const members = {};
  memberNames.forEach(function (name) {
    const id = auth.generateIdentity(name);
    const minted = box.mint('owner', name, 7, '');
    box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)),
      id.publicKey, 'fx-' + name, minted.invite.token, name);
    members[name] = id;
  });
  return { home: home, box: box, owner: owner, members: members };
}

function plant(w, config) {
  const runDir = path.join(w.home, 'spirit', 'run');
  plantRun.plantRunTree(runDir);
  fs.rmSync(path.join(runDir, 'relay-state'), { recursive: true, force: true });
  fs.cpSync(path.join(w.home, 'relay-state'), path.join(runDir, 'relay-state'),
    { recursive: true });
  // THE CAP ARRIVES THE WAY AN OWNER WOULD SET IT: in the config file,
  // which "is only ever written by a person with a shell"
  // (NODE-AND-RELAY:318). There is deliberately no verb for it.
  if (config) {
    fs.writeFileSync(path.join(runDir, 'relay-state', 'config.json'), JSON.stringify(config));
  }
  const mine = buildStamp.fromGit(path.join(__dirname, '..', '..'));
  if (mine) buildStamp.write(runDir, mine);
  w.runDir = runDir;
}

// stderr is kept, not ignored — see partnerWire.js for what discarding it
// cost. The server names its own refusal; this hands that to the failure.
async function startRelay(w, port) {
  const kid = spawn(process.execPath, ['js/server.js', '--port', String(port), '--relay'],
    { cwd: w.runDir, stdio: ['ignore', 'ignore', 'pipe'] });
  kids.push(kid);
  w.why = '';
  kid.stderr.on('data', function (b) { w.why += String(b); });
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

// A MEMBER WHO IS PRESENT AND SAYS NOTHING, which is the whole fixture.
// An absent target is refused before the router is ever consulted (0006,
// "peer not reachable"), so proving a per-target cap needs somebody who
// is unquestionably there and simply has not answered yet. The stream is
// held and every request on it is ignored.
function hold(w, identity) {
  const seen = { requests: [] };
  const s = sseClient.connect({
    url: w.base + '/api/relay/stream?key=' + encodeURIComponent(identity.publicKey),
    headers: function () {
      return {
        'X-Spirit-Sig': auth.sign(identity.privateKey, auth.streamMessage(identity.publicKey)),
      };
    },
    onEvent: function (msg) { if (msg.event === 'request') seen.requests.push(msg.data); },
  });
  seen.close = function () { try { s.close(); } catch (e) { /* gone */ } };
  streams.push(seen);
  return seen;
}

function post(w, from, toKey, what) {
  const text = JSON.stringify({ v: 1, body: { note: what } });
  const sig = auth.sign(from.privateKey, auth.postMessage(from.publicKey, toKey, text));
  return hub.relayRequest(w.base, 'POST', '/api/relay/post',
    { from: from.publicKey, to: toKey, text: text, sig: sig }
  ).then(function (r) {
    let body = {};
    try { body = JSON.parse(r.text); } catch (e) { body = {}; }
    return { status: r.status, body: body };
  });
}

// The target answering, which is what frees its slot. Signed over the
// hash, exactly as answerCard does on a node.
function reply(w, target, hash) {
  return hub.relayRequest(w.base, 'POST', '/api/relay/reply', {
    from: target.publicKey,
    hash: hash,
    text: 'ok',
    sig: auth.sign(target.privateKey, auth.receiptMessage(hash)),
  });
}

async function until(fn, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return true; await sleep(100); }
  return !!fn();
}

test.startTest('One target, two askers — the busy refusal on the wire');

async function run() {
  test.subHeading('A relay that allows one request per member at a time');

  const W = buildRelay(['alice', 'carol', 'bob', 'dave']);
  plant(W, { maxPerTarget: 1 });
  if (!(await startRelay(W, PORT))) {
    test.fail('the relay did not come up on ' + PORT +
      (String(W.why || '').trim()
        ? ' — it said: ' + String(W.why).trim()
        : ' — and said nothing on stderr'));
    cleanup();
    test.reportSuccessFailureCount();
    return;
  }

  const alice = W.members.alice;
  const carol = W.members.carol;
  const bob = W.members.bob;
  const dave = W.members.dave;

  // All four present. bob and dave answer nothing; they are here to be
  // asked.
  const atBob = hold(W, bob);
  hold(W, dave);
  hold(W, alice);
  hold(W, carol);
  await sleep(1200);

  const first = await post(W, alice, bob.publicKey, 'first');
  if (first.status === 202) {
    test.check('alice reaches bob: 202, and the route is open');
  } else {
    test.fail('first post: ' + JSON.stringify(first));
  }
  await until(function () { return atBob.requests.length > 0; }, 3000);

  const second = await post(W, carol, bob.publicKey, 'second');
  if (second.status === 503) {
    test.check('and carol is refused while bob is occupied: 503');
  } else {
    test.fail('second post: ' + JSON.stringify(second));
  }

  test.subHeading('The refusal survives the trip, which is the whole point');

  // relayServer builds the failure body by whitelist. Both of these were
  // dropped there before this suite existed, and the router's own tests
  // passed throughout.
  if (second.body && second.body.busy === true) {
    test.check('it is marked `busy` — not a bare 503 a scheduler must guess at');
  } else {
    test.fail('busy marker lost on the wire: ' + JSON.stringify(second.body));
  }

  if (second.body && typeof second.body.retryAfterMs === 'number'
      && second.body.retryAfterMs > 0) {
    test.check('and it says when to come back, in ms, rather than leaving it to a guess');
  } else {
    test.fail('retryAfterMs lost or zero: ' + JSON.stringify(second.body));
  }

  // BUSY AND UNREACHABLE ARE THE SAME STATUS AND OPPOSITE SITUATIONS, so
  // a node that could only read the status would back off a healthy peer.
  // This is the comparison that makes the marker worth carrying.
  const stranger = auth.generateIdentity('stranger');
  const absent = await post(W, alice, stranger.publicKey, 'nobody');
  if (absent.status !== 202 && !(absent.body && absent.body.busy)) {
    test.check('while an unreachable peer is refused WITHOUT `busy` — the two are told apart');
  } else {
    test.fail('unreachable looked busy: ' + JSON.stringify(absent));
  }

  test.subHeading('The cap belongs to the target, and the answer frees it');

  const elsewhere = await post(W, carol, dave.publicKey, 'to dave');
  if (elsewhere.status === 202) {
    test.check('carol reaches dave meanwhile: one busy member does not make the relay look full');
  } else {
    test.fail('other target: ' + JSON.stringify(elsewhere));
  }

  // bob answers, which is what releases the route — the reply is the
  // normal release and the timeout is only the fallback.
  const got = atBob.requests[0];
  // The node derives the hash from the bytes it holds; here the suite does
  // the same, from what arrived on bob's stream.
  const verified = got && auth.postSignatureFor(got.from, got.from, got.to, got.text, got.sig);
  if (verified) {
    await reply(W, bob, auth.requestHash(verified));
    const third = await post(W, carol, bob.publicKey, 'third');
    if (third.status === 202) {
      test.check('once bob answers, carol gets in — the refusal was a wait, not a wall');
    } else {
      test.fail('after reply: ' + JSON.stringify(third));
    }
  } else {
    test.fail('bob never received a verifiable request: ' + JSON.stringify(got));
  }

  cleanup();
  test.reportSuccessFailureCount();
}

run().catch(function (e) {
  test.fail('threw: ' + (e && e.stack ? e.stack : e));
  cleanup();
  test.reportSuccessFailureCount();
});
