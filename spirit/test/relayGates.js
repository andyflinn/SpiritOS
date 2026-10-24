'use strict';

// Exercises what the relay's public routes actually gate, as opposed to
// what a comment claims they gate.
//
//   1. claim is signature-gated in keys mode;
//   2. so is POST — a packet is proved against the key the peer claimed
//      with, and refused outright if the target is not there to take it;
//   3. rate limiting is keyed on the CALLER, not on the name the caller
//      supplies, so rotating the name does not buy a fresh budget;
//   4. a relay whose allow.json is missing says so at startup. It ran
//      fully open until cycle 3 (any name, any claimer); since goal/G16.8
//      it takes no claim at all, because the owner is written at install,
//      and the announcement says UNOWNED and names install-units
//      (firstOwner.js asserts the refusal).
//
// All four were audit findings, fixed in 5c64b17/a1bbac6. 2 and 3 then
// regressed when peers became key-addressed, and this file is the
// regression guard, so it asserts the fixed behaviour rather than the bug.
//
// ── WHAT R8 CHANGED HERE (2026-09-15) ────────────────────────────────
//
// Points 2 and 3 were written against `send` and `inbox`, which are gone
// with the ring. The QUESTIONS survive the transport and are asked of the
// router instead:
//
//   "an unsigned write is refused"        was send, is now post
//   "a forged signature is refused"       was send, is now post
//   "a bare ?name= does not drain a       CANNOT BE ASKED ANY MORE.
//    mailbox"                             There is no mailbox to drain.
//                                         The finding it guarded is
//                                         answered by deletion, which is
//                                         the strongest form of a fix.
//   "rotating the sender name does not    was send, then claim alone, and
//    buy a fresh budget"                  since goal/G22.6 the relay's
//                                         address table at its one door:
//                                         `claimHits` went with it.
//
// Recorded rather than quietly re-pointed: a regression guard that
// changes what it guards without saying so is how a closed finding gets
// re-opened by somebody who trusts the file name.
//
// Runs relay.js out of an isolated fake node under the OS temp dir, never
// the live checkout: createRelay() persists to
// relay-state/routingTable.json on every claim, and loadAllow reads
// relay-state/allow.json — this test writes both.
const fs = require('fs');
const net = require('net');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const auth = require('../run/spirit/relayAuth.js');
const { setupRelayFakes } = require('./setupRelayFakes');

const ROTATION_CLAIMS = 50;
const BOOT_TIMEOUT_MS = 10000;

test.startTest('Relay route gates (relay.js / relayAuth.js)');

const targets = setupRelayFakes();
const relayNode = targets.relay;
const RELAY_STATE = path.join(relayNode, 'relay-state');
const createRelay = require(path.join(relayNode, 'spirit', 'relay.js')).createRelay;

// createRelay() reads both files at construction, so each phase below gets
// a clean slate written before it builds its own relay.
function resetState(ownerKey) {
  // The relay's data is a SQLite file since cycle 3, and Windows will not
  // delete a directory holding an open one: release it first.
  // The relay's own copy of the module — it runs out of the fake tree.
  require(path.join(relayNode, 'spirit', 'relayStore.js')).closeAll();
  fs.rmSync(RELAY_STATE, { recursive: true, force: true });
  fs.mkdirSync(RELAY_STATE, { recursive: true });
  // The relay's own identity, which lives in this folder: a stream header
  // names it (goal/G16.12), and a real relay always has one.
  auth.saveIdentity(relayNode, auth.generateIdentity('relay'));
  if (ownerKey) {
    fs.writeFileSync(path.join(RELAY_STATE, 'owner.json'), JSON.stringify({ owner: ownerKey }), 'utf8');
  }
}

// A sink that records what the relay wrote at it. Enough to tell "the
// packet was delivered" from "the relay said yes and dropped it".
function fakeSink() {
  const sink = { lines: [] };
  sink.write = function (chunk) { sink.lines.push(chunk); };
  sink.close = function () {};
  sink.sawRequest = function () {
    return sink.lines.some(function (c) { return /event: request/.test(c); });
  };
  return sink;
}

function openStream(relay, id, sink) {
  return relay.streamOpen(
    id.publicKey, auth.sign(id.privateKey, auth.streamMessage(id.publicKey, relay.relayPublicKey())),
    sink
  );
}

// ---- 1 & 2: signature gating in keys mode ----
test.subHeading('Keys mode: what a signature is actually required for');
{
  const andy = auth.generateIdentity('andy');
  const mallory = auth.generateIdentity('mallory');
  resetState(andy.publicKey);
  const relay = createRelay();

  const unsigned = relay.claim('andy', null, null);
  if (!unsigned.ok && (unsigned.status === 400 || unsigned.status === 403)) {
    test.check('claim without a signature is refused (' + unsigned.status + ')');
  } else {
    test.fail('claim without a signature returned ' + JSON.stringify(unsigned));
  }

  const forged = relay.claim(
    'andy',
    auth.sign(mallory.privateKey, auth.claimMessage('andy')),
    andy.publicKey
  );
  if (!forged.ok && forged.status === 403) {
    test.check('claim signed by the wrong key is refused (403)');
  } else {
    test.fail('claim signed by the wrong key returned ' + JSON.stringify(forged));
  }

  const signed = relay.claim(
    'andy',
    auth.sign(andy.privateKey, auth.claimMessage('andy')),
    andy.publicKey
  );
  if (signed.ok) {
    test.check('claim with a correct signature is accepted');
  } else {
    test.fail('claim with a correct signature returned ' + JSON.stringify(signed));
  }

  // A second row to post AT, so "refused" is never "there was nobody
  // there anyway". Invited, because keys mode is invite-locked after the
  // first owner — which is what claiming costs here, and not this file's
  // subject.
  const bert = auth.generateIdentity('bert');
  const minted = relay.mint('andy', 'bert', 7);
  relay.claim(
    'bert',
    auth.sign(bert.privateKey, auth.claimMessage('bert')),
    bert.publicKey,
    '10.0.0.2',
    minted && minted.invite && minted.invite.token
  ,
    'bert');

  const bertSink = fakeSink();
  openStream(relay, bert, bertSink);

  const TEXT = '{"app":"gate-probe","v":1,"body":"hello"}';

  const unsignedPost = relay.routePost(andy.publicKey, bert.publicKey, TEXT, null);
  if (!unsignedPost.ok && unsignedPost.status === 403) {
    test.check('post without a signature is refused (403)');
  } else {
    test.fail('post without a signature returned ' + JSON.stringify(unsignedPost));
  }

  const forgedPost = relay.routePost(
    andy.publicKey, bert.publicKey, TEXT,
    auth.sign(mallory.privateKey, auth.postMessage(andy.publicKey, bert.publicKey, TEXT))
  );
  if (!forgedPost.ok && forgedPost.status === 403) {
    test.check('post signed by the wrong key is refused (403)');
  } else {
    test.fail('post signed by the wrong key returned ' + JSON.stringify(forgedPost));
  }

  // NOTHING LEAKED ON THE WAY TO A REFUSAL. The failure shape this guards
  // against is a gate that runs after the payload has been handed on.
  if (!bertSink.sawRequest()) {
    test.check('and neither refused packet reached the target at all');
  } else {
    test.fail('a refused packet was delivered anyway');
  }

  const goodPost = relay.routePost(
    andy.publicKey, bert.publicKey, TEXT,
    auth.sign(andy.privateKey, auth.postMessage(andy.publicKey, bert.publicKey, TEXT))
  );
  if (goodPost.ok && goodPost.status === 202 && bertSink.sawRequest()) {
    test.check('andy reaches bert with his own signature, and it arrives');
  } else {
    test.fail('signed post returned ' + JSON.stringify(goodPost) +
      ', delivered=' + bertSink.sawRequest());
  }

  // THE GATE THE RING COULD NOT HAVE. `send` answered 201 for a peer who
  // was not there, into a store that dropped it on overflow. A correctly
  // signed post to somebody holding no stream is refused, at once, with a
  // reason (decision 0006).
  const john = auth.generateIdentity('john');
  const mintedJohn = relay.mint('andy', 'john', 7);
  relay.claim(
    'john',
    auth.sign(john.privateKey, auth.claimMessage('john')),
    john.publicKey,
    '10.0.0.3',
    mintedJohn && mintedJohn.invite && mintedJohn.invite.token
  ,
    'john');
  const absent = relay.routePost(
    andy.publicKey, john.publicKey, TEXT,
    auth.sign(andy.privateKey, auth.postMessage(andy.publicKey, john.publicKey, TEXT))
  );
  if (!absent.ok && absent.status === 503) {
    test.check('and a signed post to a peer who is not there is refused (503), not stored');
  } else {
    test.fail('post to an absent peer returned ' + JSON.stringify(absent));
  }
}

// ---- 3: claims are held by the caller's ADDRESS, not by name or key ----
//
// The per-address claim limit (ten a minute) stood here. Andy's decision,
// goal/G22.6: strangers are held by one table of requesting addresses at
// the relay's one door, and it "replaces the per-address claim limit". So
// the flood is driven through the door, as claims from keys this relay does
// not hold, rotating both the name and the key, all from one address.
test.subHeading('A claim flood from one address is held, whatever names and keys it rotates');
{
  const seal = require(path.join(relayNode, 'spirit', 'seal.js'));
  const owner = auth.generateIdentity('owner');
  const squatters = [];
  for (let i = 0; i < ROTATION_CLAIMS; i++) {
    squatters.push(auth.generateIdentity('squatter' + i));
  }
  resetState(owner.publicKey);
  const relayInvites = require(path.join(relayNode, 'spirit', 'invites.js'));
  const tokens = squatters.map(function (s, i) {
    return relayInvites.add(relayNode, { label: 'squatter' + i, days: 1 }).token;
  });
  const claimRelay = createRelay();
  // The owner holds a row, so the table has room for two addresses once the
  // first squatter is in (as many entries as members).
  claimRelay.claim('owner', auth.sign(owner.privateKey, auth.claimMessage('owner')), owner.publicKey, '', '', '');

  function claimOnDoor(i, address) {
    const id = squatters[i];
    const name = 'squatter' + i;
    const text = JSON.stringify(seal.seal(claimRelay.relaySealKey(), id.publicKey, claimRelay.relayPublicKey(),
      JSON.stringify({ v: 1, body: { claim: {
        name: name, publicKey: id.publicKey, sig: auth.sign(id.privateKey, auth.claimMessage(name)),
        invite: tokens[i], inviteLabel: name,
      } } })));
    return claimRelay.routePost(id.publicKey, '', text,
      auth.sign(id.privateKey, auth.postMessage(id.publicKey, '', text)), undefined, address);
  }

  let claimsTaken = 0;
  let claimRefusal = null;
  for (let i = 0; i < ROTATION_CLAIMS - 1; i++) {
    const r = claimOnDoor(i, '203.0.113.9');
    if (r && r.ok) claimsTaken++;
    else if (claimRefusal === null) claimRefusal = r;
  }
  if (claimsTaken >= ROTATION_CLAIMS - 1) {
    test.fail('all ' + (ROTATION_CLAIMS - 1) + ' claims were taken from one address — ' +
      'a squatter can take the whole namespace');
  } else if (claimsTaken === 1 && claimRefusal && claimRefusal.status === 429) {
    test.check('a rotating-name, rotating-key claim flood from one address is held after ' + claimsTaken +
      ' claim: the address asked again inside its ban');
  } else {
    test.fail('the claim flood stopped after ' + claimsTaken +
      ' but not by the address table: ' + JSON.stringify(claimRefusal));
  }

  // AND THE ENTRY IS THE ADDRESS'S. A different address is not spending the
  // flooder's ban, which is what "keyed on the caller" means and what
  // rotating a NAME or a KEY must not achieve.
  const other = claimOnDoor(ROTATION_CLAIMS - 1, '198.51.100.7');
  if (other && other.ok) {
    test.check('and a different address is not held by the flooder\'s ban');
  } else {
    test.fail('a fresh address inherited the refusal: ' + JSON.stringify(other));
  }
}

// ---- 4: an open relay should say so ----
test.subHeading('A relay with no owner.json announces that it is open');

function freePort() {
  return new Promise(function (resolve, reject) {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', function () {
      const port = probe.address().port;
      probe.close(function () { resolve(port); });
    });
  });
}

function get(port, rawPath) {
  return new Promise(function (resolve) {
    const req = http.request({ hostname: '127.0.0.1', port: port, path: rawPath, method: 'GET' }, function (res) {
      let chunks = '';
      res.on('data', function (c) { chunks += c; });
      res.on('end', function () { resolve({ status: res.statusCode, text: chunks }); });
    });
    req.on('error', function () { resolve({ status: 0, text: '' }); });
    req.end();
  });
}

function waitForBoot(port) {
  const startedAt = Date.now();
  return (function poll() {
    // Booted when it answers a card ask on its one door (goal/G22.6).
    return require('./relayDoor').keyStatus('http://127.0.0.1:' + port).then(function (r) {
      if (r.status === 200) return true;
      if (Date.now() - startedAt > BOOT_TIMEOUT_MS) throw new Error('relay did not boot on ' + port);
      return new Promise(function (r2) { setTimeout(r2, 150); }).then(poll);
    });
  }());
}

let child = null;

resetState(null); // no owner.json: unowned, refuses every claim (goal/G16.8)

freePort()
  .then(function (port) {
    let output = '';
    child = spawn(process.execPath, ['spirit/server.js', '--relay', '--port', String(port)], {
      cwd: relayNode,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', function (c) { output += c; });
    child.stderr.on('data', function (c) { output += c; });

    return waitForBoot(port).then(function () {
      // Prove it is really up before asking what it announced, so this can
      // never pass by testing a relay that never booted.
      return require('./relayDoor').keyStatus('http://127.0.0.1:' + port).then(function () {
        if (/UNOWNED/.test(output) && /install-units/.test(output) && !/this relay is OPEN/.test(output)) {
          test.check('the relay announced it is UNOWNED, and named install-units — not open mode');
        } else {
          test.fail('the relay started without an owner and did not say UNOWNED / install-units. Startup output was: ' +
            JSON.stringify(output.trim()));
        }
      });
    });
  })
  .catch(function (err) {
    test.fail('harness error: ' + (err && err.message || err));
  })
  .then(function () {
    if (child) { try { child.kill(); } catch (e) { /* already gone */ } }
    test.reportSuccessFailureCount();
    process.exit(test.failureCount > 0 ? 1 : 0);
  });
