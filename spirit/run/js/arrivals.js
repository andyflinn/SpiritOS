'use strict';

// spirit/run/js/arrivals.js
// WHAT HAPPENS TO A PACKET THAT ARRIVES OVER THE ROUTER.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────
//
// Until 2026-09-13 the answer was: nothing. peerPost has had an
// `onArrival` hook since the router landed, and its only caller in the
// whole tree was a test — server.js built createPeerPost with `answer`,
// `admit`, `remember` and `traffic`, and no `onArrival`. So a packet
// posted by a peer was admitted at the front door, written to the
// traffic log, answered with a bare receipt, and dropped. Nothing above
// the node boundary could ever see it.
//
// That is why Relay Chat still polled a 200-entry ring: not caution, and
// not a half-finished migration. There was nowhere for it to move to.
//
// This is the missing seam, and it is deliberately the smallest thing
// that can be one: hold the subscribers, decode the envelope once, hand
// each of them the same decorated message. It decides nothing about who
// may be heard — peerPost's front door has already done that, and a
// packet only reaches `note` once this node has agreed to hear the
// sender.
//
// ── WHAT IT DOES NOT DO, SAID PLAINLY ────────────────────────────────
//
// **A packet that arrives with no subscriber is dropped.** Not held, not
// queued, not counted as pending. If no browser is open, the packet is
// gone as far as any app is concerned.
//
// That is a real gap and it is named rather than papered over, because
// the ring it replaces did not have it — the relay held 200 messages and
// the far end collected them whenever it next looked. The shell says the
// same thing one level up, about a packet for an app nobody is listening
// to, and says why: "there is no hold store yet, and inventing one
// quietly would be inventing the part that has to be designed."
//
// The same applies here. What exists today is trafficLog, which keeps
// every packet that crossed the WAN for 24 hours, payload included — so
// the bytes are not lost, they are simply not delivered. Turning that
// into catch-up is a design question (what counts as already-seen, and
// by whom) and it belongs to the cycle, not to this file.
//
// Until it is answered, THE RING MUST NOT BE DELETED. A live push with
// no catch-up is strictly less than a poll against a buffer, and would
// be the one migration that makes the system worse.

const packet = require('./packet.js');

function createArrivals() {
  // An array rather than a map: subscribers are anonymous (one per open
  // browser connection) and there is never a reason to address one.
  var subscribers = [];

  // Returns its own unsubscribe, so a caller cannot leak one by holding
  // the wrong handle. The SSE route takes this and calls it from the
  // same teardown that clears its heartbeat — a subscriber that outlives
  // its socket writes to a dead response for ever.
  function subscribe(fn) {
    if (typeof fn !== 'function') return function () {};
    subscribers.push(fn);
    return function unsubscribe() {
      subscribers = subscribers.filter(function (other) { return other !== fn; });
    };
  }

  // `item` is peerPost's arrival record: { item, hash, from, text, at,
  // relay }. `from` is a public key, always — labels are display and a
  // label is not an identity.
  //
  // `fromKey` is added because the ring's messages carry one and the
  // inbox path's readers reach for it. The two transports must present
  // the same identity field or every reader grows a branch for which
  // road the line came down, which is exactly the seam this cycle is
  // removing.
  function note(item) {
    if (!item || typeof item.text !== 'string') return 0;

    var message = packet.decorate({
      id: item.item,
      hash: item.hash,
      from: item.from,
      fromKey: item.from,
      text: item.text,
      sentAt: item.at,
      relay: item.relay,
    });

    // Every subscriber gets it, and one that throws does not stop the
    // rest or reach back into peerPost — which calls this while it still
    // owes the sender a receipt. A browser's bad handler must not be
    // able to turn an arrival into a refusal.
    var delivered = 0;
    subscribers.slice().forEach(function (fn) {
      try { fn(message); delivered += 1; }
      catch (e) { /* not ours */ }
    });
    return delivered;
  }

  // For the suite and for a future monitor: how many connections are
  // listening. Never a reason to act on it here — a packet is delivered
  // to whoever is there, including nobody.
  function count() { return subscribers.length; }

  return { note: note, subscribe: subscribe, count: count };
}

module.exports = { createArrivals: createArrivals };
