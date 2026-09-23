'use strict';

// spirit/run/js/answerRelay.js
// What this node answers when the RELAY is the one asking.
//
// Almost every request arriving on a node's stream comes from a peer and
// carries that peer's signature end to end — the relay is a road, not a
// party, and is never trusted with the contents.
//
// A device enrolment is the exception, and it has to be. The thing
// making the request is a browser that has no identity yet — that being
// precisely what it is enrolling — so there IS no end-to-end signature
// to carry. The relay takes the browser's POST, verifies what it can,
// and posts it on as itself. Its signature is the only attestation
// available.
//
// Andy: "the personal node didn't know to verify the origin of the
// request with the public key of the relay."
//
// It does now, and that check is the whole reason this file exists:
//
//   FROM MUST BE THE RELAY'S OWN KEY, and the relay's own key means the
//   one the relay this request ARRIVED ON publishes about itself.
//
// Not any relay. Not a key that was handed over in the request. The
// roll key of the socket it came down, fetched from that relay and
// compared. A request from anyone else is somebody else's traffic and
// gets the plain receipt every request gets.
//
// THE SENDER IS THE DISCRIMINATOR, not an app name. There is no `app`
// field in what the relay sends and there must not be: the app envelope
// lives inside `text` so no relay ever learns it (spirit/test/packet.js).
// A relay is not an app. What identifies its traffic is that the relay
// signed it.

const deviceTick = require('./deviceTick');
const relayKeys = require('./relayKeys');
const auth = require('./relayAuth');

// ── WHAT A RELAY MAY SPEND ON THIS NODE'S PASSWORD ───────────────────
//
// Grok, reviewing DEVICE.md: `DEVICE_PER_MIN` binds callers of the
// relay's own `deviceOffer` and does nothing about a crooked relay, while
// `deviceTick.answerOffer` had no counter, no backoff and no delay. So
// the only thing rate-limiting password guesses against a node was the
// box that benefits from not doing it.
//
// Andy's ruling settles the shape rather than moving the limit: "all
// servers, node and relay, must be designed to survive… it is the
// responsibility of the node-code to safeguard itself, same goes for the
// satellite." A SERVER DOES NOT DELEGATE ITS OWN SURVIVAL — so both
// sides keep a counter, defending different things. The relay's protects
// the relay from its callers. This one protects the node from its relays.
//
// FAILURES, NOT ATTEMPTS, and keyed by the relay it arrived on (Grok).
// Counting attempts would throttle somebody enrolling three devices in a
// minute, which is a thing people do; counting failures throttles
// guessing, which is the thing this is for. Five is generous for a
// mistyped paste and tight for a search.
//
// In RAM and per process: a guessing budget is not a thing to persist,
// and a restart resetting it costs nothing next to a password of 128 hex
// characters.
var ENROL_FAILS_PER_MIN = 5;
var ENROL_WINDOW_MS = 60000;

// opts: { rootDir, request, urls }
//
// `request` is the same primitive peerPost uses, so this reaches a relay
// exactly the way everything else does. `urls` is a function rather than
// a list, because which relays this node holds a row on is answered by
// presence and changes while the process runs.
function createAnswerer(opts) {
  opts = opts || {};
  var rootDir = opts.rootDir;
  var urlsFn = typeof opts.urls === 'function' ? opts.urls : function () { return []; };
  // Told when a relay answers with a key other than the one on record.
  // Optional, and unwired today: refusing is the safety property and
  // surfacing it to a person is a panel that does not exist yet. The hook
  // is here so that when it does, nothing in this file has to change.
  var onKeyChanged = typeof opts.onKeyChanged === 'function' ? opts.onKeyChanged : null;

  // relay url -> timestamps of refused enrolments. See the constants
  // above for why this is failures rather than attempts.
  var enrolFails = Object.create(null);
  function enrolBudgetLeft(url) {
    var cutoff = Date.now() - ENROL_WINDOW_MS;
    var list = (enrolFails[url] || []).filter(function (t) { return t > cutoff; });
    if (list.length) enrolFails[url] = list; else delete enrolFails[url];
    return list.length < ENROL_FAILS_PER_MIN;
  }
  function noteEnrolFail(url) {
    var list = enrolFails[url] || [];
    list.push(Date.now());
    enrolFails[url] = list;
  }

  // TWO CONVENTIONS WEAR THE SAME SIGNATURE, and mixing them is a bug
  // that looks like a refusal. `relayRequest` answers { status, text };
  // deviceTick and everything below want the text already parsed, and
  // hub wraps it for exactly that reason. Both are
  // (url, method, path, body, headers), so nothing catches the swap —
  // the first live enrolment came back "not now" in 126ms, which is the
  // round trip working perfectly and the answer being wrong.
  //
  // Converted once, here, so this file has one kind of request in it.
  function asJson(url, method, pathname, body, headers) {
    return Promise.resolve()
      .then(function () { return opts.request(url, method, pathname, body, headers); })
      .then(function (r) {
        try { return JSON.parse(r.text); }
        // Named rather than a bare falsy: an answer nobody can read and
        // no answer at all are both "this did not work", and a caller
        // that cannot tell them apart reports the reassuring one.
        catch (e) { return { ok: false, error: 'unreachable' }; }
      })
      .catch(function () { return { ok: false, error: 'unreachable' }; });
  }
  var request = asJson;

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
  // `GET /api/relay/key` answers `{ relayPublicKey, relayLabel }` and
  // nothing else.
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
  // search (listed `silent`), out of partner discovery, and off the front
  // door's "this sender is a relay" list. That is visible rather than
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
      .then(function () { return request(url, 'GET', '/api/relay/key'); })
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

  // Returns the reply text, or '' for "not mine" — which leaves the
  // plain receipt peerPost would have sent anyway.
  function answer(item) {
    if (!item || !item.from || !item.relay) return Promise.resolve('');

    var asked = null;
    try { asked = JSON.parse(item.text); }
    catch (e) { asked = null; }
    // Everything else on this wire is an app packet, and this node is
    // not the one that reads those.
    if (!asked || asked.relay !== 'device-offer') return Promise.resolve('');

    return relayKey(item.relay).then(function (key) {
      // THE CHECK. Without it, any peer could post a device offer and
      // drive this node's enrolment — the password would still have to
      // be right, but a stranger would be free to spend guesses against
      // it and to occupy the slot while doing so.
      if (!key || item.from !== key) return '';

      // AND THE BUDGET, before the password is compared. Over it, this
      // node stops answering that relay's enrolments for the rest of the
      // minute — which is the only thing a node can do about a relay
      // that will not limit itself.
      //
      // The empty answer is the same refusal a wrong password gets, on
      // purpose: telling a relay "you are being throttled" tells a
      // crooked one exactly when to resume.
      if (!enrolBudgetLeft(item.relay)) return '';

      return deviceTick.answerOffer(rootDir, asked).then(function (decided) {
        // A refusal is what gets counted. A successful enrolment spends
        // nothing, so somebody attaching several devices in a minute is
        // never throttled for it.
        if (!decided || !decided.accepted) noteEnrolFail(item.relay);
        // The reply is the relay's own shape, not a packet, for the same
        // reason the question was: this is protocol between a node and
        // its relay, and the relay must be able to read it without ever
        // learning what an app envelope looks like.
        return JSON.stringify({
          relay: 'device-answer',
          accepted: !!decided.accepted,
          devicePublicKey: decided.accepted ? decided.devicePublicKey : '',
        });
      });
    }).catch(function () {
      // A failure to decide is not a yes. Saying nothing leaves the bare
      // receipt, which the relay reads as a refusal — the browser is
      // told to try again rather than enrolled against a node that never
      // agreed.
      return '';
    });
  }

  return { answer: answer, relayKey: relayKey, relaySealKey: relaySealKey, relaySealKeyByKey: relaySealKeyByKey };
}

module.exports = { createAnswerer: createAnswerer };
