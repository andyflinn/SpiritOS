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
// ── WHAT HAPPENS WHEN NOBODY IS HOME ─────────────────────────────────
//
// A packet that arrives with no page open is HELD, not dropped. The
// first page to open gets it, and only then is it forgotten.
//
// That was not true when this file was written, and it mattered: the
// ring being retired held 200 messages on the relay and the far end
// collected them whenever it next looked, so a live push with no
// catch-up would have been strictly less than the poll it replaced —
// the one migration that makes the system worse.
//
// ── WHERE THE BACKLOG LIVES ──────────────────────────────────────────
//
// In the traffic log, with everything else. This file keeps NOTHING on
// disk.
//
// It had its own store for a few hours — relay-state/pendingArrivals.json
// — because the traffic log could not be read back safely: it records
// ARRIVAL, not ADMISSION, and a packet the front door HELD is in it with
// its payload, deliberately never handed to an app. Replaying from it
// would have walked the front door back.
//
// That is fixed at the source rather than worked around here: rows now
// carry `admitted`, and `trafficLog.arrivals()` returns only those. So
// there is one store, keyed by hash and ordered by arrival, holding both
// what crossed the WAN and what is still waiting to be seen.
//
//   Andy: "The node will provide client(s) with an api block that treats
//   the log like a database file with the primary keys being hash,
//   arrival-date."
//
// And this file reaches it through that api block and never through the
// file, which is the rule for everything in run/:
//
//   Andy: "tests can read what they need to read, production code MUST
//   read through the API."
//
// ── THE MARK ─────────────────────────────────────────────────────────
//
// The node keeps it, not the browser. A row is `takenAt` once a live page
// has actually been handed it; until then it is undelivered mail and
// outlives the retention window. The first page to open drains what is
// waiting; a second opening after it gets nothing, because the message
// already reached the person.
//
// A tab that opens and closes at once therefore consumes what it was
// handed — the same failure a poll that read and then crashed always had,
// and the price of keeping no per-browser state.

const packet = require('./packet.js');

// opts: { traffic } — the log, as an api block. Without one this runs
// entirely in memory and holds nothing back, which is what the
// seam-level checks want and what a relay would get if one ever built it.
function createArrivals(opts) {
  var o = opts || {};
  var traffic = o.traffic || null;

  // An array rather than a map: subscribers are anonymous (one per open
  // browser connection) and there is never a reason to address one.
  var subscribers = [];

  // What the log is still holding for a page that has not opened. Asked
  // for on demand rather than cached: another process could have marked
  // rows, and a stale copy here would replay what somebody already read.
  function waiting() {
    if (!traffic || typeof traffic.arrivals !== 'function') return [];
    try {
      return traffic.arrivals({}).filter(function (row) { return !row.takenAt; });
    } catch (e) {
      return [];
    }
  }

  // Returns its own unsubscribe, so a caller cannot leak one by holding
  // the wrong handle. The SSE route takes this and calls it from the
  // same teardown that clears its heartbeat — a subscriber that outlives
  // its socket writes to a dead response for ever.
  function subscribe(fn) {
    if (typeof fn !== 'function') return function () {};
    subscribers.push(fn);

    // WHAT THIS PAGE MISSED, before anything new can arrive for it.
    // Marked FIRST and handed over second: a handler that throws
    // partway must not leave half the backlog delivered and half of it
    // still marked as waiting, which would replay those rows to the next
    // page as if they were new.
    var backlog = waiting();
    if (backlog.length) {
      try {
        traffic.taken(backlog.map(function (row) { return row.hash; }));
      } catch (e) { /* the push below still happens */ }
      backlog.forEach(function (row) {
        try { fn(asMessage(row)); } catch (e) { /* not ours */ }
      });
    }

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

    // NOBODY HOME, SO IT WAITS — and nothing is written here to make
    // that true. peerPost logged the row before calling this, and a row
    // that is admitted and not yet `takenAt` IS the backlog. One store,
    // one fact, no second copy to drift.
    //
    // Counted as delivered only when a page actually took it: a
    // subscriber that threw did not receive anything, and treating a
    // broken page as a reader would lose the packet exactly when
    // something is already wrong.
    if (delivered && traffic && typeof traffic.taken === 'function') {
      try { traffic.taken(message.hash); } catch (e) { /* the push happened */ }
    }
    return delivered;
  }

  // A stored row, in the shape a live push sends. The same conversion
  // hub.rowAsMessage does for the read route — one shape for a client to
  // merge, whichever door it came through.
  function asMessage(row) {
    return packet.decorate({
      id: String((row && row.hash) || ''),
      hash: String((row && row.hash) || ''),
      from: String((row && row.peer) || ''),
      fromKey: String((row && row.peer) || ''),
      text: typeof (row && row.payload) === 'string' ? row.payload : '',
      sentAt: String((row && row.at) || ''),
      relay: String((row && row.relay) || ''),
    });
  }

  // How many packets are waiting for a page to open. For the suite, and
  // for anything that ever wants to say so out loud.
  function pending() { return waiting().length; }

  // For the suite and for a future monitor: how many connections are
  // listening. Never a reason to act on it here — a packet is delivered
  // to whoever is there, including nobody.
  function count() { return subscribers.length; }

  return { note: note, subscribe: subscribe, count: count, pending: pending };
}

module.exports = { createArrivals: createArrivals };
