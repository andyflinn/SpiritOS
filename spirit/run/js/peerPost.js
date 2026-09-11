'use strict';

// spirit/run/js/peerPost.js
// The personal node's half of the router: post to a peer, answer a peer.
//
// An app asks its own node to reach somebody and gets an answer back. It
// never signs anything, never learns what a relay is, and never sees a
// hash unless it asks — the node holds the key, which also means an app
// cannot forge a sender (design/relay/ROUTER.md).
//
// HOLD WHERE IT IS FREE, NEVER WHERE IT IS NOT. The relay never holds a
// connection; that was the whole 66-versus-60 lesson. But a browser
// talking to its own node is loopback — no proxy, no TLS, nothing to
// time it out — so the node CAN wait a moment for the round trip and
// hand back a real answer, which is what lets an app `await` this like
// any other call.
//
// Two clocks, and confusing them would be the bug. The wait below is how
// long we will make it LOOK synchronous. The relay's pending entry is how
// long the request actually lives. If the wait expires first nothing is
// lost — the answer arrives on the stream and is matched by hash — which
// is why the hash comes back even on the fast path.

const auth = require('./relayAuth');

// A UX number, not a protocol constant tuned against another machine's
// tick. It only decides how long a caller stares at a spinner.
var DEFAULT_WAIT_MS = 8000;

function createPeerPost(opts) {
  opts = opts || {};
  var rootDir = opts.rootDir;
  var request = opts.request;
  var waitMs = opts.waitMs || DEFAULT_WAIT_MS;
  var setT = opts.setTimeoutImpl || setTimeout;
  var clearT = opts.clearTimeoutImpl || clearTimeout;

  // hash -> { resolve, timer, relayUrl, at }
  var waiting = Object.create(null);
  // What arrived for us, in order, with an id an app can ask for again.
  var mailbox = [];
  var nextItem = 1;
  var onArrival = opts.onArrival || null;

  function me() {
    return auth.loadIdentity(rootDir);
  }

  function settle(hash, answer) {
    var slot = waiting[hash];
    if (!slot) return false;
    delete waiting[hash];
    if (slot.timer) clearT(slot.timer);
    slot.resolve(answer);
    return true;
  }

  // REGISTER BEFORE YOU FORWARD. The same rule the relay's table enforces
  // by shape, applied one hop earlier: nothing leaves this node until the
  // thing that will match its answer exists. A reply that arrives before
  // the waiter does is a reply with nowhere to go, and the symptom is
  // silence rather than an error.
  function post(relayUrl, toKey, text) {
    var id = me();
    if (!id || !id.privateKey) {
      return Promise.resolve({ ok: false, status: 500, error: 'this node has no identity' });
    }
    if (!toKey) return Promise.resolve({ ok: false, status: 400, error: 'to required' });
    if (typeof text !== 'string' || !text) {
      return Promise.resolve({ ok: false, status: 400, error: 'text required' });
    }

    var message = auth.postMessage(id.publicKey, toKey, text);
    var sig = auth.sign(id.privateKey, message);
    var hash = auth.requestHash(message);

    var answered = new Promise(function (resolve) {
      waiting[hash] = {
        resolve: resolve,
        relayUrl: relayUrl,
        at: Date.now(),
        timer: setT(function () {
          // Not a failure of the request — a failure to wait for it. The
          // request may still be alive at the relay, and its answer will
          // still arrive and still be matched; the caller simply stopped
          // holding the line.
          settle(hash, {
            ok: false, status: 504, hash: hash,
            error: 'no answer yet', stillOpen: true,
          });
        }, waitMs),
      };
    });

    return Promise.resolve()
      .then(function () {
        return request(relayUrl, 'POST', '/api/relay/post', {
          from: id.publicKey, to: toKey, text: text, sig: sig,
        });
      })
      .then(function (res) {
        var body = {};
        try { body = JSON.parse(res.text); } catch (e) { body = {}; }
        if (res.status >= 200 && res.status < 300) return answered;
        // The relay refused, so nothing is coming. Stop waiting rather
        // than leaving the caller to time out for a reason already known.
        settle(hash, {
          ok: false, status: res.status, hash: hash,
          error: (body && body.error) || 'refused',
          inFlight: !!(body && body.inFlight),
        });
        return answered;
      })
      .catch(function (e) {
        settle(hash, {
          ok: false, status: 0, hash: hash,
          error: String((e && e.message) || e),
        });
        return answered;
      });
  }

  // SOMEBODY ASKED US SOMETHING.
  //
  // The hash is derived here, from the bytes that actually arrived —
  // never taken from the wire. That is the whole proof: had the relay
  // supplied it and this echoed it back, the echo would say nothing. A
  // hash computed from bytes we hold, matching the one the sender
  // computed, IS the evidence that nothing was changed in between.
  function onRequest(relayUrl, body) {
    var id = me();
    if (!id || !id.privateKey || !body || !body.from || !body.sig) return null;

    // The message that VERIFIED, so the minute never had to travel.
    var verified = auth.postSignatureFor(
      body.from, body.from, body.to, body.text, body.sig
    );
    if (!verified) return null;
    if (body.to !== id.publicKey) return null;

    var hash = auth.requestHash(verified);

    // FILED FIRST, ANSWERED SECOND. A receipt says "this arrived", and
    // it must not be able to say so about something that was then
    // dropped on the floor.
    var item = {
      item: 'in_' + (nextItem++),
      hash: hash,
      from: body.from,
      text: body.text,
      at: new Date().toISOString(),
      relay: relayUrl,
    };
    mailbox.push(item);
    if (onArrival) { try { onArrival(item); } catch (e) { /* not ours */ } }

    // A RECEIPT IS NOT A REPLY. This node is always up and can always
    // say "received". Whether an app is home to compose an answer is a
    // different question, and answering it here would be a guess.
    var receipt = auth.sign(id.privateKey, auth.receiptMessage(hash));
    return Promise.resolve()
      .then(function () {
        return request(relayUrl, 'POST', '/api/relay/reply', {
          from: id.publicKey, hash: hash, text: '', sig: receipt,
        });
      })
      .then(function () { return item; })
      .catch(function () { return item; });
  }

  // AN ANSWER CAME BACK. Verified against the key of whoever signed it,
  // which the caller already has from the relay's public census — so the
  // relay cannot manufacture a receipt for a request nobody answered.
  function onReply(body) {
    if (!body || !body.hash || !body.from || !body.sig) return false;
    if (!auth.receiptSignatureOk(body.from, body.hash, body.sig)) return false;
    // The signature travels up to the caller as well as being checked
    // here. Not because anybody must check it twice, but because a
    // caller that CAN is a caller that does not have to take this
    // module's word for it either — and a test that cannot reach the
    // signature ends up asserting something weaker than it looks.
    return settle(body.hash, {
      ok: true, status: 200, hash: body.hash,
      from: body.from,
      text: typeof body.text === 'string' ? body.text : '',
      sig: body.sig,
      receipt: true,
    });
  }

  return {
    post: post,
    onRequest: onRequest,
    onReply: onReply,
    // What arrived while nobody was home, and what is still outstanding.
    inbox: function () { return mailbox.slice(); },
    outstanding: function () { return Object.keys(waiting); },
  };
}

module.exports = {
  createPeerPost: createPeerPost,
  DEFAULT_WAIT_MS: DEFAULT_WAIT_MS,
};
