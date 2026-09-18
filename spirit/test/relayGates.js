'use strict';

// Exercises what the relay's public routes actually gate, as opposed to
// what a comment claims they gate.
//
//   1. claim is signature-gated in keys mode;
//   2. so is POST — a packet is proved against the key the peer claimed
//      with, and refused outright if the target is not there to take it;
//   3. rate limiting is keyed on the CALLER, not on the name the caller
//      supplies, so rotating the name does not buy a fresh budget;
//   4. a relay whose allow.json is missing runs fully open — any name,
//      any claimer — and says so at startup.
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
//   "rotating the sender name does not    was send, is now claim alone —
//    buy a fresh budget"                  `sendHits` went with `send`,
//                                         and `claimHits` is the only
//                                         caller-keyed bucket left.
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
const auth = require('../run/js/relayAuth.js');
const { setupRelayFakes } = require('./setupRelayFakes');

const ROTATION_CLAIMS = 50;
const BOOT_TIMEOUT_MS = 10000;

test.startTest('Relay route gates (relay.js / relayAuth.js)');

const targets = setupRelayFakes();
const relayNode = targets.relay;
const RELAY_STATE = path.join(relayNode, 'relay-state');
const createRelay = require(path.join(relayNode, 'js', 'relay.js')).createRelay;

// createRelay() reads both files at construction, so each phase below gets
// a clean slate written before it builds its own relay.
function resetState(allowJson) {
  fs.rmSync(RELAY_STATE, { recursive: true, force: true });
  fs.mkdirSync(RELAY_STATE, { recursive: true });
  if (allowJson) {
    fs.writeFileSync(path.join(RELAY_STATE, 'allow.json'), JSON.stringify(allowJson), 'utf8');
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
    id.publicKey,
    auth.sign(id.privateKey, auth.streamMessage(id.publicKey)),
    sink
  );
}

// ---- 1 & 2: signature gating in keys mode ----
test.subHeading('Keys mode: what a signature is actually required for');
{
  const andy = auth.generateIdentity('andy');
  const mallory = auth.generateIdentity('mallory');
  resetState({ keys: [{ name: andy.name, publicKey: andy.publicKey }] });
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

// ---- 3: rate limiting is per caller, not per claimed name ----
test.subHeading('Rate limiting survives a rotating claimer name');
{
  // Fifty identities, every one of them ALLOWED, so the first refusal is
  // the rate limit and not the invite lock. That distinction is the whole
  // point: this assertion used to pass for exactly the wrong reason, with
  // every claim refused for a missing key while the limit itself was
  // broken.
  //
  // It used a names-mode allow.json to arrange that until 2026-09-15.
  // Keys mode does the same job — a key already in allow.json is not a
  // NEW key and needs no invite (relay.js, claim) — and does it without
  // depending on a mode nothing in the tree writes.
  const squatters = [];
  for (let i = 0; i < ROTATION_CLAIMS; i++) {
    squatters.push(auth.generateIdentity('squatter' + i));
  }
  resetState({
    keys: squatters.map(function (s, i) {
      return { name: 'squatter' + i, publicKey: s.publicKey };
    }),
  });
  const claimRelay = createRelay();

  let claimsAccepted = 0;
  let claimRefusal = null;
  for (let i = 0; i < ROTATION_CLAIMS; i++) {
    const r = claimRelay.claim(
      'squatter' + i,
      auth.sign(squatters[i].privateKey, auth.claimMessage('squatter' + i)),
      squatters[i].publicKey,
      '203.0.113.9'
    );
    if (r.ok) claimsAccepted++;
    else if (claimRefusal === null) claimRefusal = r;
  }
  if (claimsAccepted >= ROTATION_CLAIMS) {
    test.fail('all ' + ROTATION_CLAIMS + ' name claims succeeded from one caller — ' +
      'a squatter can take the whole namespace');
  } else if (claimRefusal && claimRefusal.status === 429) {
    test.check('a rotating-name claim flood was rate-limited after ' + claimsAccepted + ' claims');
  } else {
    test.fail('claim flood stopped after ' + claimsAccepted +
      ' but not by the rate limit: ' + JSON.stringify(claimRefusal));
  }

  // AND THE BUCKET IS THE CALLER'S. Same relay, a different clientKey: the
  // budget it gets is its own, which is what "keyed on the caller" means
  // and what rotating a NAME must not achieve.
  const nextFree = 'squatter' + (ROTATION_CLAIMS - 1);
  const other = claimRelay.claim(
    nextFree,
    auth.sign(squatters[ROTATION_CLAIMS - 1].privateKey, auth.claimMessage(nextFree)),
    squatters[ROTATION_CLAIMS - 1].publicKey,
    '198.51.100.7'
  );
  if (!other || other.status !== 429) {
    test.check('and a different caller is not spending the flooder budget');
  } else {
    test.fail('a fresh caller inherited the refusal: ' + JSON.stringify(other));
  }
}

// ---- 4: an open relay should say so ----
test.subHeading('A relay with no allow.json announces that it is open');

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
    return get(port, '/api/relay/key').then(function (r) {
      if (r.status === 200) return true;
      if (Date.now() - startedAt > BOOT_TIMEOUT_MS) throw new Error('relay did not boot on ' + port);
      return new Promise(function (r2) { setTimeout(r2, 150); }).then(poll);
    });
  }());
}

let child = null;

resetState(null); // no allow.json — loadAllow falls through to mode 'open'

freePort()
  .then(function (port) {
    let output = '';
    child = spawn(process.execPath, ['js/server.js', '--relay', '--port', String(port)], {
      cwd: relayNode,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', function (c) { output += c; });
    child.stderr.on('data', function (c) { output += c; });

    return waitForBoot(port).then(function () {
      // Prove it really is open before asking whether it admitted as much,
      // so this can never pass by testing a relay that wasn't open at all.
      return get(port, '/api/relay/key').then(function () {
        if (/open|unrestricted|no allow|anyone/i.test(output)) {
          test.check('the relay announced open mode at startup');
        } else {
          test.fail('the relay started fully open and said nothing about it. Startup output was: ' +
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
