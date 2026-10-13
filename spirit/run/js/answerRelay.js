'use strict';

// spirit/run/js/answerRelay.js
// What this node knows about the RELAYS it talks to: each one's own public
// key, fetched from the relay, checked against the pin (relayKeys.js), and
// the key a post to it is sealed to.
//
// It once also answered the relay's device-offer request; that went with
// the device enrolment, removed by goal/G16.2. The name stays.

const relayKeys = require('./relayKeys');
const auth = require('./relayAuth');

// opts: { rootDir, askKey, onKeyChanged }
//
// `askKey(url)` resolves the relay's signed key statement — peerPost's
// relayKey, the card ask on the relay's one door (goal/G22.6: GET
// /api/relay/key is closed, and a node reaches a relay only through
// peerPost). A rejection is a relay that did not answer.
function createAnswerer(opts) {
  opts = opts || {};
  var rootDir = opts.rootDir;
  // Told when a relay answers with a key other than the one on record.
  // Optional, and unwired today: refusing is the safety property and
  // surfacing it to a person is a panel that does not exist yet. The hook
  // is here so that when it does, nothing in this file has to change.
  var onKeyChanged = typeof opts.onKeyChanged === 'function' ? opts.onKeyChanged : null;

  // Named rather than a bare falsy: an answer nobody can read and no
  // answer at all are both "this did not work", and a caller that cannot
  // tell them apart reports the reassuring one.
  function askKey(url) {
    return Promise.resolve()
      .then(function () { return opts.askKey(url); })
      .catch(function () { return { ok: false, error: 'unreachable' }; });
  }

  // relayUrl -> that relay's own public key, for this process. A relay's
  // key is made on its first --relay boot and does not change while it is
  // the same relay, so one fetch per run is enough.
  //
  // A wrong answer here fails CLOSED — an unknown key matches nothing,
  // so the request is treated as a stranger's and receipted rather than
  // acted on. That is the safe direction for a lookup that can fail.
  var keyOf = Object.create(null);
  // And what a post to that relay is sealed to (cycle 10, R9), learned
  // in the same answer as the identity above and never on its own.
  var sealOf = Object.create(null);

  // AND THE PIN THAT OUTLIVES THE PROCESS. This cache used to be the
  // whole of it: forgotten on restart, believing whatever answered next
  // time, so a relay swapped underneath this node was accepted in
  // silence. relayKeys.js writes the same pin down.
  //
  // Trust on FIRST use, and only first: a relay nobody has met is
  // accepted and recorded, because requiring a human before the first
  // word would mean no first word. A relay that ANSWERS DIFFERENTLY than
  // the one on record is refused, and stays refused until somebody
  // accepts the change on purpose — which is the one thing this cannot
  // decide for itself, since a rebuilt relay and a substituted one look
  // identical from here.
  //
  // The re-check happens once per process rather than per request, which
  // is exactly where the old gap was: a restart is when a substitution
  // used to become invisible, and a restart is now when it is caught.
  // ── THE KEY ITSELF, FROM THE ONE THING THAT ANSWERS IT ─────────────
  //
  // The relay's card — a card ask on its one door since goal/G22.6, which
  // replaced `GET /api/relay/key` — answers its key statement and nothing
  // about its members.
  //
  // THERE IS NO FALLBACK TO THE ROLL, and that is the decision rather
  // than an omission.
  //
  //   Andy: "why not: the suite asserts the order — small door first, or
  //   else fail."
  //
  // One was written, on the usual discipline that a relay which has not
  // been updated should keep working while one side migrates. It was cut
  // within the hour for two reasons, and the second is the one that
  // settles it:
  //
  //   1. A fallback is a path nobody exercises. Four things were deleted
  //      on 2026-09-17 for exactly that — peer.candidates, peer.find,
  //      relay.roster, pinnedRelayKey — each kept for a caller that never
  //      came, each rotting in place while looking alive.
  //
  //   2. **A fallback is a reader.** While this reaches for `who`, `who`
  //      has a caller that is not a list, and the roll cannot be
  //      demoted to a signed post. The fallback would have preserved the
  //      exact thing the door was built to remove.
  //
  // WHAT IT COSTS, said out loud: deploys are now relay-before-node. A
  // node updated first cannot pin that relay, so the relay drops out of
  // search (listed `silent`) and off the front door's "this sender is a
  // relay" list. That is visible rather than
  // quiet, which is the right shape for a version skew. `liveRelay.js`
  // will say so first, being the one suite that talks to a real box.
  // ── AND IT IS SIGNED NOW (cycle 10, R9) ────────────────────────────
  //
  // The paragraph above admits what this answer used to be worth: the
  // re-check "compares against an UNSIGNED answer and so catches nothing
  // an attacker could not forge". That was a fair trade while the answer
  // was an identity to pin — the case it exists for is a REBUILT relay
  // answering honestly, not an attacker.
  //
  // It stops being a fair trade in this cycle, because the same answer
  // now carries the key every post to that box is sealed to. Hand over
  // your own cipher key here and you read every owner verb that follows,
  // invite tokens included. So the statement is signed by the identity
  // key it names, over both keys and the label together, and an answer
  // that does not verify yields NO KEY AT ALL — which lands in the same
  // place a missing door does: the relay drops out, visibly, rather than
  // being used on weaker terms.
  //
  // Self-signed, so it settles tampering and not introduction — the same
  // honest limit a node's card has. The PIN is what gives it teeth: a
  // substitution after first sighting is the case that happens, and that
  // is the one this catches.
  function fetchKey(url) {
    return Promise.resolve()
      .then(function () { return askKey(url); })
      .then(function (answer) {
        var key = answer && answer.relayPublicKey;
        if (typeof key !== 'string' || !key) return '';
        if (!auth.relayKeySigned(key, answer.relaySealKey, answer.relayLabel, answer.keySig)) return '';
        sealOf[url] = String(answer.relaySealKey);
        return key;
      });
  }

  // What a post addressed to this relay is sealed to, learned in the same
  // breath as its identity and never separately — a cipher key fetched on
  // its own is a cipher key somebody could answer for.
  function relaySealKey(url) {
    return sealOf[url] || '';
  }

  // The same answer, asked the other way round: a post is addressed by
  // KEY, not by URL, so the one thing sealing needs is "what does the box
  // with this identity seal to". Both halves came from one signed
  // statement, so a match here means that relay said both about itself.
  //
  // Only relays this node has already pinned are in here, which is the
  // right bound: a relay nobody has spoken to is a relay with no stream,
  // and there is nothing to address a post to.
  function relaySealKeyByKey(publicKey) {
    if (!publicKey) return '';
    var urls = Object.keys(keyOf);
    for (var i = 0; i < urls.length; i += 1) {
      if (keyOf[urls[i]] === publicKey) return sealOf[urls[i]] || '';
    }
    return '';
  }

  function relayKey(url) {
    if (keyOf[url]) return Promise.resolve(keyOf[url]);

    // A PIN-FIRST SHORT-CIRCUIT STOOD HERE FOR ABOUT TEN MINUTES on
    // 2026-09-18 and was backed out. It returned `relayKeys.pinned()`
    // without asking, making steady state zero requests, on the argument
    // that the re-check compares against an UNSIGNED answer and so
    // catches nothing an attacker could not forge.
    //
    // True of an attacker, who can echo the pinned key back and be
    // believed. NOT true of the case that actually happens: a relay
    // REBUILT with a new key answers honestly, and the check below is
    // what notices. Skipping it made a rebuilt relay simply go quiet —
    // every signed exchange failing, with nobody able to say why.
    //
    // `answerRelay.js`'s own suite caught it, which is the check earning
    // its place: "onKeyChanged: []".
    //
    // The saving that mattered was the DOOR, not the skip: 97 bytes
    // against 30 KB at 201 members, and the re-check kept intact.

    return fetchKey(url)
      .then(function (key) {
        if (typeof key !== 'string' || !key) return '';

        var verdict = relayKeys.check(rootDir, url, key);
        if (verdict === 'changed') {
          // Refused, and said out loud rather than merely failing. A
          // silent fail-closed here would look exactly like a relay
          // being down, and the two want very different answers from a
          // person.
          if (onKeyChanged) {
            try { onKeyChanged(url, relayKeys.pinned(rootDir, url), key); }
            catch (e) { /* a witness, never a participant */ }
          }
          return '';
        }
        if (verdict === 'new') relayKeys.accept(rootDir, url, key);

        keyOf[url] = key;
        return key;
      })
      .catch(function () { return ''; });
  }

  return { relayKey: relayKey, relaySealKey: relaySealKey, relaySealKeyByKey: relaySealKeyByKey };
}

module.exports = { createAnswerer: createAnswerer };
