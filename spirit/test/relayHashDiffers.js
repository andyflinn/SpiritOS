'use strict';

// spirit/test/relayHashDiffers.js
// THE RELAY'S HASH MUST DIFFER FROM A HASH OF THE WORDS.
//
//   Andy, 2026-09-23: "which adds another test, a passing payload in the
//   relay must hash DIFFERENTLY from the endpoint hashes" — and, on
//   where it is checked: "the payload on the monitor MUST be different
//   from the endpoint hash."
//
// cycle 10's R12. A CANARY FOR THE FAILURE THAT LOOKS LIKE SUCCESS: if
// sealing were skipped, misconfigured or silently bypassed on one code
// path, everything else in that cycle still passes — the post routes,
// the signature verifies, the receipt returns. The single thing that
// changes is that the bytes the relay hashes become the bytes the
// endpoints hold.
//
// ── IT NEEDS NO INSTRUMENT, WHICH IS WHY IT IS WRITTEN FIRST ─────────
//
// design/relay/PROVING-IT-CANNOT-READ.md is approved and its DEBUG
// switch is being built by the other agent. THIS PROOF DOES NOT WAIT FOR
// IT: the monitor row already carries the relay's own hash
// (relay.js:2756, :2894, :4166), so the canary reads a stream that
// exists today. Written before the instrument so that the fixture every
// later proof depends on is exercised before anything depends on it.
//
// ── THE COMPARISON IS THE SAME FUNCTION ON DIFFERENT BYTES ──────────
//
// Hashing the plaintext with some other function would differ trivially
// and prove nothing. So this computes the hash THE RELAY WOULD HAVE
// REGISTERED IF NOTHING HAD BEEN SEALED — `requestHash(postMessage(from,
// to, plaintext))` — and asserts the real one is not that. A match means
// the words travelled in clear, whatever else passed.
//
// The minute is not transmitted (relayAuth.js:60-65), so the check walks
// ±1 exactly as `postSignatureFor` does, and a match at ANY minute is a
// failure.

const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const { world, post, events, askMonitor } = require('./monitorWorld.js');

test.startTest('The relay\'s hash differs from a hash of the words');

function unsealedHashes(from, to, text, atMs) {
  const now = atMs == null ? Date.now() : atMs;
  const out = [];
  for (let step = -1; step <= 1; step += 1) {
    out.push(auth.requestHash(auth.postMessage(from, to, text, now + step * 60000)));
  }
  return out;
}

function hashesFor(w) {
  return events(w.heard.andy)
    .map(function (m) { return m.data && m.data.hash; })
    .filter(Boolean);
}

const SAID = 'the kettle is broken and the cat knows';

// ── 1. THE CANARY ────────────────────────────────────────────────────
test.subHeading('a sealed post does not hash as its own words');
{
  // CARL POSTS TO BELLA, not the other way round: the shared world opens
  // streams for the owner and bella only, and a post to a member with no
  // stream is REFUSED before it is ever hashed — which the first run of
  // this suite reported as "no monitor row carried a hash", correctly
  // blaming the fixture rather than the relay.
  const w = world();
  askMonitor(w, w.owner, true);
  const before = hashesFor(w).length;
  post(w, w.carl, w.bella, SAID);
  const got = hashesFor(w).slice(before);

  if (!got.length) {
    test.fail('no monitor row carried a hash, so there is nothing to compare — the fixture, ' +
      'not the relay');
  } else {
    const wouldBe = unsealedHashes(w.carl.publicKey, w.bella.publicKey, SAID);
    const matched = got.filter(function (h) { return wouldBe.indexOf(h) !== -1; });
    if (!matched.length) {
      test.check('the relay registered a hash over what travelled, and it is not the hash the ' +
        'same function gives over the words — so the words did not travel');
    } else {
      test.fail('THE RELAY\'S HASH IS THE HASH OF THE PLAINTEXT. The payload travelled in clear, ' +
        'whatever else in this cycle passed: ' + matched[0]);
    }
  }
}

// ── 2. THE PAIRED POSITIVE, AND WITHOUT IT THE CANARY IS DECORATION ──
//
// "The two hashes differ" is true of a comparison that can never match —
// a typo in the field name, the wrong minute, a hash over the wrong
// parties. So: an UNSEALED post must match, proving the comparison can
// find an equality when one exists.
test.subHeading('the control — an unsealed post DOES hash as its words');
{
  const w = world();
  askMonitor(w, w.owner, true);
  // A CARD ASK IS AN ENVELOPE WITH NO APP AND `card` IN THE BODY —
  // nodeCard.asks() at :68-74 is the definition, and this is the shape it
  // recognises. Built here rather than imported, because nodeCard
  // exports the RECOGNISER and not a builder.
  const card = JSON.stringify({ v: 1, body: { card: true } });
  const before = hashesFor(w).length;
  w.box.routePost(w.carl.publicKey, w.bella.publicKey, card,
    // SIGNED BY THE SENDER. The first version signed as bella for a post
    // FROM carl — a rename applied to the arguments and not to the key,
    // so the signature did not verify, the post was refused, and the
    // control reported "no monitor row" instead of "bad signature".
    auth.sign(w.carl.privateKey,
      auth.postMessage(w.carl.publicKey, w.bella.publicKey, card)));
  const got = hashesFor(w).slice(before);

  if (!got.length) {
    test.fail('no monitor row for the card post, so the control cannot run');
  } else {
    const wouldBe = unsealedHashes(w.carl.publicKey, w.bella.publicKey, card);
    if (got.some(function (h) { return wouldBe.indexOf(h) !== -1; })) {
      test.check('a card travels unsealed by design (peerPost.js:725) and its relay hash IS the ' +
        'hash of its bytes — so the comparison above can find an equality, and its absence means ' +
        'something');
    } else {
      test.fail('THE CONTROL FAILED: even an unsealed post does not match, so the comparison in ' +
        'the canary proves nothing. Either the minute walk, the parties or the field is wrong');
    }
  }
}

// ── 3. THE SAME WORDS TWICE MUST NOT HASH ALIKE ──────────────────────
//
// Sealing is randomised — a fresh ephemeral key and nonce per message —
// so identical plaintext must never give identical ciphertext. EQUAL
// HASHES WOULD HAND THE RELAY THE ABILITY TO TELL THAT TWO MESSAGES ARE
// THE SAME MESSAGE, which is a fact about the words it is not allowed to
// have.
test.subHeading('the same words twice do not hash alike');
{
  const w = world();
  askMonitor(w, w.owner, true);
  const before = hashesFor(w).length;
  post(w, w.carl, w.bella, SAID);
  post(w, w.carl, w.bella, SAID);
  const got = hashesFor(w).slice(before);

  if (got.length < 2) {
    test.fail('two posts produced ' + got.length + ' hashed monitor row(s), so they cannot be ' +
      'compared — the fixture, not the relay');
  } else if (got[0] !== got[1]) {
    test.check('the same words sent twice registered two different hashes — sealing is randomised, ' +
      'so the relay cannot tell that two messages are the same message');
  } else {
    test.fail('THE SAME WORDS HASHED ALIKE. Sealing is deterministic, and the relay can now tell ' +
      'that two messages are the same message without reading either: ' + got[0]);
  }
}

// ── 4. AND THE WORDS' HASH IS NOWHERE ON THE WIRE ────────────────────
//
// An endpoint may hash its own plaintext for its own log. IT MUST NOT
// SEND IT. A plaintext hash beside a sealed payload is a confirmation
// oracle: anybody who can guess the message can check the guess.
test.subHeading('and the hash of the words appears nowhere the relay can see');
{
  const w = world();
  askMonitor(w, w.owner, true);
  post(w, w.carl, w.bella, SAID);
  const wouldBe = unsealedHashes(w.carl.publicKey, w.bella.publicKey, SAID);
  const wire = JSON.stringify(events(w.heard.andy));
  const leaked = wouldBe.filter(function (h) { return wire.indexOf(h) !== -1; });
  if (!leaked.length) {
    test.check('no hash of the plaintext appears anywhere in what the relay streamed — so nobody ' +
      'holding a guess at the message can check the guess against the feed');
  } else {
    test.fail('A HASH OF THE PLAINTEXT IS ON THE WIRE, which is a confirmation oracle: ' + leaked[0]);
  }
}

test.reportSuccessFailureCount();
