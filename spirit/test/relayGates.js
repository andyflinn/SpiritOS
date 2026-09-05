'use strict';

// Exercises what the relay's mailbox routes actually gate, as opposed to
// what server.js's comment claims they gate ("the mailbox routes
// themselves are gated by the allow list and signature checks in
// relayAuth.js"):
//
//   1. claim and send really are signature-gated in keys mode — the
//      baseline, and it holds today;
//   2. inbox is NOT. It takes a bare ?name= and hands over that peer's
//      messages to anyone who asks, in every mode. On a public relay every
//      mailbox is world-readable by name;
//   3. rate limiting is keyed on the caller-supplied name, so rotating the
//      name buys a fresh budget every time — 30/min is a limit on a
//      cooperative sender, not on an abuser. The per-name buckets are also
//      never pruned, which is the memory half of the same bug (not directly
//      assertable from outside, so only the bypass is checked here);
//   4. a relay whose allow.json is missing runs fully open — any name, any
//      sender, any reader — and says nothing about it at startup.
//
// Cases 2, 3 and 4 are EXPECTED TO FAIL until fixed. Case 1 documents the
// part that already works, so a fix to the rest can't quietly regress it.
//
// Runs relay.js out of an isolated fake node under the OS temp dir, never
// the live checkout: createRelay() persists to relay-state/mailbox.json on
// every send, and loadAllow reads relay-state/allow.json — this test writes
// both.
const fs = require('fs');
const net = require('net');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth.js');
const { setupRelayFakes } = require('./setupRelayFakes');

const ROTATION_SENDS = 100;
const BOOT_TIMEOUT_MS = 10000;

test.startTest('Relay mailbox gates (relay.js / relayAuth.js)');

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

// ---- 1 & 2: signature gating in keys mode ----
test.subHeading('Keys mode: what a signature is actually required for');
{
  const andy = auth.generateIdentity('andy');
  const mallory = auth.generateIdentity('mallory');
  resetState({ keys: [{ name: andy.name, publicKey: andy.publicKey }] });
  const relay = createRelay();

  const unsigned = relay.claim('andy', null);
  if (!unsigned.ok && unsigned.status === 403) {
    test.check('claim without a signature is refused (403)');
  } else {
    test.fail('claim without a signature returned ' + JSON.stringify(unsigned));
  }

  const forged = relay.claim('andy', auth.sign(mallory.privateKey, auth.claimMessage('andy')));
  if (!forged.ok && forged.status === 403) {
    test.check('claim signed by the wrong key is refused (403)');
  } else {
    test.fail('claim signed by the wrong key returned ' + JSON.stringify(forged));
  }

  const signed = relay.claim('andy', auth.sign(andy.privateKey, auth.claimMessage('andy')));
  if (signed.ok) {
    test.check('claim with a correct signature is accepted');
  } else {
    test.fail('claim with a correct signature returned ' + JSON.stringify(signed));
  }

  const unsignedSend = relay.send('andy', 'bert', 'hello', null);
  if (!unsignedSend.ok && unsignedSend.status === 403) {
    test.check('send without a signature is refused (403)');
  } else {
    test.fail('send without a signature returned ' + JSON.stringify(unsignedSend));
  }

  // Put one real message in andy's mailbox to read back below.
  relay.send('andy', 'andy', 'a private message', auth.sign(andy.privateKey, auth.sendMessage('andy', 'andy', 'a private message')));

  // The gap. Nothing about inbox() consults allow.json or a signature, so
  // in the mode where every write is cryptographically gated, every read
  // is still anonymous.
  const stolen = relay.inbox('andy');
  if (stolen.ok && stolen.messages.length > 0) {
    test.fail('inbox handed over ' + stolen.messages.length + " of andy's message(s) with no signature at all");
  } else if (!stolen.ok && stolen.status === 403) {
    test.check("inbox refuses an unsigned read of another peer's mailbox (403)");
  } else {
    test.fail('inbox returned ' + JSON.stringify(stolen));
  }
}

// ---- 3: rate limiting is per claimed name ----
test.subHeading('Rate limiting survives a rotating sender name');
{
  resetState(null); // open mode — no allow.json, the shipped default
  const relay = createRelay();

  let accepted = 0;
  let firstRefusalAt = null;
  for (let i = 0; i < ROTATION_SENDS; i++) {
    const result = relay.send('sender' + i, 'victim', 'flood', null);
    if (result.ok) {
      accepted++;
    } else if (firstRefusalAt === null) {
      firstRefusalAt = i + 1;
    }
  }

  // SEND_PER_MIN is 30. A limit that means anything has to bite well
  // before 100 sends arrive from one place, whatever names they claim.
  if (firstRefusalAt !== null && firstRefusalAt <= 40) {
    test.check('a rotating-name flood was refused after ' + firstRefusalAt + ' sends');
  } else {
    test.fail('all ' + accepted + ' of ' + ROTATION_SENDS +
      ' sends were accepted by rotating the name — the 30/min limit never applied');
  }

  // Same shape for claim: CLAIM_PER_MIN is also per name.
  let claimsAccepted = 0;
  for (let i = 0; i < 50; i++) {
    if (relay.claim('squatter' + i, null).ok) claimsAccepted++;
  }
  if (claimsAccepted >= 50) {
    test.fail('all 50 name claims succeeded from one caller — a squatter can take the whole namespace');
  } else {
    test.check('a rotating-name claim flood was refused after ' + claimsAccepted + ' claims');
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
    return get(port, '/api/relay/who').then(function (r) {
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
      return get(port, '/api/relay/who').then(function () {
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
