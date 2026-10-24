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
// What a green run proves (since goal/G22.6 counted the slot per sender —
// Andy's decision, taking M5 of the review of 2026-10-10):
//   1. a relay a person would actually run — no configuration at all —
//      allows one request per sender at a member at a time
//   2. one request reaches the target and a second, from somebody else,
//      reaches it too: no sender can keep a member busy for anybody else
//   3. the sender's own next request is refused 429 while its first waits
//   4. a refusal that says when to come back keeps its marker and
//      `retryAfterMs` across the wire (the address table's, now that a
//      member never meets the target-busy one)
//   5. when the target answers, the sender gets in again

const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const auth = require('../run/spirit/relayAuth');
const { claimOwner, ownHome } = require('./ownerClaim');
const hub = require('../run/spirit/hub');
const buildStamp = require('../run/spirit/buildStamp');
const plantRun = require('./plantRun');
const sseClient = require('../run/spirit/sseClient');
const { createRelay } = require('../run/spirit/relay');

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
  const owner = auth.generateIdentity('owner');
  ownHome(home, owner);
  const box = createRelay(home);
  auth.saveIdentity(home, auth.generateIdentity('relay'));
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
  const kid = spawn(process.execPath, ['spirit/server.js', '--port', String(port), '--relay'],
    { cwd: w.runDir, stdio: ['ignore', 'ignore', 'pipe'] });
  kids.push(kid);
  w.why = '';
  kid.stderr.on('data', function (b) { w.why += String(b); });
  const base = 'http://127.0.0.1:' + port;
  for (let n = 0; n < 40; n += 1) {
    await sleep(200);
    try {
      const r = await require('./relayDoor').keyStatus(base);
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
        'X-Spirit-Sig': auth.sign(identity.privateKey, auth.streamMessage(identity.publicKey, w.box.relayPublicKey())),
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
    sig: auth.sign(target.privateKey, auth.receiptMessage(hash, 'ok')),
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
  // NO CONFIGURATION. The cap of 1 is a constant in router.js as of
  // 2026-09-21 (R6/R7), so this suite no longer has to arrange the thing
  // it is testing — which is the better state for it to be in: it now
  // observes the relay a person would actually run.
  plant(W, null);
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

  // ── THE SLOT IS PER SENDER (goal/G22.6) ───────────────────────────
  //
  // Andy's decision (goal/G22.6, taking M5 of the review of 2026-10-10):
  // "the member's one slot in flight counted per sender ... so no stranger
  // can keep a member busy". Carol is not held by alice's request to bob.
  const second = await post(W, carol, bob.publicKey, 'second');
  if (second.status === 202) {
    test.check('and carol reaches bob too, while alice\'s request waits: the slot is alice\'s, not bob\'s');
  } else {
    test.fail('second sender to bob: ' + JSON.stringify(second));
  }

  // WHAT HOLDS A SENDER is its own one request in flight (0016): alice's
  // next request, to anybody, is refused 429 while bob has not answered.
  const again = await post(W, alice, dave.publicKey, 'alice again');
  if (again.status === 429 && again.body && again.body.code === 'too-many-in-flight') {
    test.check('while alice\'s next request is refused 429: one in flight per sender, wherever it is aimed');
  } else {
    test.fail('alice\'s second request: ' + JSON.stringify(again));
  }

  test.subHeading('A refusal that says when to come back survives the trip');

  // relayServer builds the failure body by whitelist, and `busy` and
  // `retryAfterMs` were once dropped there while the router's own tests
  // passed. With the slot per sender a member never meets the target-busy
  // refusal (its own cap of one refuses it first), so the marker is proved
  // on the refusal a relay does send: the strangers' address table, a
  // second card ask from this one address inside its ban.
  const door = require('./relayDoor');
  const asker = auth.generateIdentity('stranger-asker');
  await sleep(door.GAP_MS);
  await door.postDoor(W.base, door.signedPost(asker, '', door.CARD_ASK).body);
  const early = await door.postDoor(W.base, door.signedPost(asker, '', door.CARD_ASK).body);
  if (early.status === 429 && early.json && typeof early.json.retryAfterMs === 'number' &&
      early.json.retryAfterMs > 0 && early.json.code === 'address-too-early') {
    test.check('the address table\'s refusal arrives marked (address-too-early) with retryAfterMs ' +
      early.json.retryAfterMs + ' — not a bare status a scheduler must guess at');
  } else {
    test.fail('the refusal lost its marker on the wire: ' + JSON.stringify(early));
  }

  // UNREACHABLE IS TOLD APART: refused without `busy`.
  const stranger = auth.generateIdentity('stranger');
  const absent = await post(W, dave, stranger.publicKey, 'nobody');
  if (absent.status !== 202 && !(absent.body && absent.body.busy)) {
    test.check('while an unreachable peer is refused WITHOUT `busy` — the two are told apart');
  } else {
    test.fail('unreachable looked busy: ' + JSON.stringify(absent));
  }

  test.subHeading('The answer frees the sender\'s slot');

  // bob answers alice, which is what releases her route — the reply is the
  // normal release and the timeout is only the fallback.
  const got = atBob.requests[0];
  // The node derives the hash from the bytes it holds; here the suite does
  // the same, from what arrived on bob's stream.
  const verified = got && auth.postSignatureFor(got.from, got.from, got.to, got.text, got.sig);
  if (verified) {
    await reply(W, bob, auth.requestHash(verified));
    const third = await post(W, alice, dave.publicKey, 'third');
    if (third.status === 202) {
      test.check('once bob answers, alice gets in again — the refusal was a wait, not a wall');
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
