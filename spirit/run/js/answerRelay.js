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
// census key of the socket it came down, fetched from that relay and
// compared. A request from anyone else is somebody else's traffic and
// gets the plain receipt every request gets.
//
// THE SENDER IS THE DISCRIMINATOR, not an app name. There is no `app`
// field in what the relay sends and there must not be: the app envelope
// lives inside `text` so no relay ever learns it (spirit/test/packet.js).
// A relay is not an app. What identifies its traffic is that the relay
// signed it.

const deviceTick = require('./deviceTick');

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

  // relayUrl -> that relay's own public key. Fetched once and kept: a
  // relay's key is made on its first --relay boot and does not change
  // while it is the same relay.
  //
  // A wrong answer here fails CLOSED — an unknown key matches nothing,
  // so the request is treated as a stranger's and receipted rather than
  // acted on. That is the safe direction for a lookup that can fail.
  var keyOf = Object.create(null);

  function relayKey(url) {
    if (keyOf[url]) return Promise.resolve(keyOf[url]);
    return Promise.resolve()
      .then(function () { return request(url, 'GET', '/api/relay/who'); })
      .then(function (answer) {
        // The census is public and already carries it — no new endpoint,
        // and nothing here the relay did not already publish to anyone
        // who asked.
        var key = answer && answer.mailboxPublicKey;
        if (typeof key === 'string' && key) keyOf[url] = key;
        return keyOf[url] || '';
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

      return deviceTick.answerOffer(
        rootDir, urlsFn(), asked, request, item.relay
      ).then(function (decided) {
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

  return { answer: answer, relayKey: relayKey };
}

module.exports = { createAnswerer: createAnswerer };
