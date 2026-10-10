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


// ── THE ONE DECODER IN THE NODE LAYER (N1, goal/G16.5) ───────────────
//
// NODE-AND-RELAY.md's rule is that the node reads the ENVELOPE and
// nothing inside it. The rule held; the arithmetic did not. Six node
// files each held a decoder — server.js handed `wire.decode` as a VALUE
// to the api door, the puppet door, ownerPost and boxes, and each of them
// opened every admitted arrival itself — and three more parsed an
// arrival's text by hand. So the envelope was opened up to five times per
// packet, in five places that could drift, and the guard suite that was
// supposed to forbid this (nodeKnowsNoApps.js) matched one literal call
// and saw none of it.
//
// ONE FILE REQUIRES client/packet NOW, and it is this one: the file that
// already admits, witnesses and holds every arrival. kernel.js keeps its
// own, which is a different thing — the shared decode every loopback
// client uses (Andy, 2026-10-02).
//
// Andy's ruling on the three hand-rolled parses, 2026-10-10: "yes. we fix
// redundant code now."
var packet = require('./client/packet.js');

// THE ENVELOPE, READ ONCE. For a packet: { app, re, body }, with `app` ''
// when it carries none — '' rather than null so a reader never has to
// know whether the field was absent or empty, which is packet.js's own
// practice for `re`. For anything that is not a packet — a chat line from
// before packets existed, the relay's own protocol word, junk — null,
// which is the reader's cue that there is no envelope here rather than an
// envelope that is empty.
// `id` rides along because it is part of what an owner's command signs
// (relayAuth.commandMessage, read by puppetMode.ownerCommandIn): a reader
// that had to go back to the text for it would be a second decoder.
function envelopeOf(text) {
  if (!packet.isEnvelope(text)) return null;
  var decoded = packet.decode(text);
  return { app: decoded.app || '', re: decoded.re || '', id: decoded.id || null, body: decoded.body };
}

// ── AND THE RELAY'S OWN WORD, WHICH IS NOT AN ENVELOPE ───────────────
//
// A relay speaks to a node about the node's own enrolment in the relay's
// shape, not an app's: `{relay: 'device-offer', password, devicePublicKey}`
// (relay.js, and the comment there is a rule — "a relay that could parse
// one would have made the envelope part of the relay protocol"). It
// carries no `v` and no `body`, so it is not a packet and `envelopeOf`
// says null about it, correctly.
//
// It still has to be READ, by answerRelay, and that reading belongs here
// for the same reason the envelope does: one file in the node layer opens
// what arrives. Answers the top-level object, or null when the text is
// not a JSON object — never a packet's insides, because a packet goes
// through `envelopeOf` above.
function relayWordOf(text) {
  if (typeof text !== 'string' || text.charAt(0) !== '{') return null;
  var parsed = null;
  try { parsed = JSON.parse(text); } catch (e) { return null; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return parsed;
}

// opts: { traffic } — the log, as an api block. Without one this runs
// entirely in memory and holds nothing back, which is what the
// seam-level checks want and what a relay would get if one ever built it.
// SUBSCRIBERS, AND NOTHING ELSE. The bookkeeping every live channel to an
// open page needs: hold the handlers, hand each of them the same thing,
// contain one that throws.
//
// Split out when a relay's activity needed the same seam and did not fit
// through createArrivals — that one decodes a packet envelope and drops
// anything without `text`, so a monitor row would have vanished silently.
// A fan-out that quietly discards what it does not recognise is worse
// than no fan-out.
function createFanOut() {
  var subscribers = [];

  function subscribe(fn) {
    if (typeof fn !== 'function') return function () {};
    subscribers.push(fn);
    return function unsubscribe() {
      subscribers = subscribers.filter(function (other) { return other !== fn; });
    };
  }

  // Returns how many took it, so a caller can tell "nobody is watching"
  // from "it went out" — which is the whole question a monitor asks.
  function note(row) {
    var delivered = 0;
    subscribers.slice().forEach(function (fn) {
      try { fn(row); delivered += 1; }
      catch (e) { /* one bad page does not rob the others */ }
    });
    return delivered;
  }

  return { note: note, subscribe: subscribe, count: function () { return subscribers.length; } };
}

function createArrivals(opts) {
  var o = opts || {};
  var traffic = o.traffic || null;

  // An array rather than a map: subscribers are anonymous (one per open
  // browser connection) and there is never a reason to address one.
  var subscribers = [];

  // ── WITNESSES: THE NODE'S OWN LISTENERS, WHICH ARE NOT READERS ────────
  //
  // The owner door, peerOwnerPost's reply matcher and the box reports
  // (server.js) each need to see every arrival. They were subscribers,
  // and a subscriber that took a packet counted as its delivery, so every
  // arrival was marked taken within milliseconds with no page open, and
  // the backlog below never had anything to replay (wsl-claude measured
  // 200 arrivals, 0 untaken). Worse, each took the whole backlog at
  // startup. Andy's pages, and Desk's own log (AGENTS-UI.md, "they must
  // keep their own logs"), lost everything that arrived while no browser
  // was open.
  //
  // So a witness sees each arrival as it lands, is never handed the
  // backlog, and never counts as the page that took it. Only a page (a
  // subscriber) marks a row taken.
  var witnesses = [];
  function witness(fn) {
    if (typeof fn !== 'function') return function () {};
    witnesses.push(fn);
    return function unwitness() {
      witnesses = witnesses.filter(function (other) { return other !== fn; });
    };
  }

  // What the log is still holding for a page that has not opened. Asked
  // for on demand rather than cached: another process could have marked
  // rows, and a stale copy here would replay what somebody already read.
  //
  // EVERY UNTAKEN ROW, NOT THE FIRST PAGE. This read `traffic.arrivals({})`,
  // which is oldest first and cut at 200, so once a node had taken in 200
  // packets nothing newer could ever be replayed: every long-lived node,
  // Andy's included (found live by wsl-claude, 573 rows, the newest
  // returned from two days earlier). It was hidden while the node's own
  // listeners marked everything taken at once. The same filter arrivals
  // applies (inbound and admitted), over the whole log, in arrival order.
  //
  // NOT THE WHOLE LOG (goal/G4.31). Reading every row to find these few cost about a second on each open, on a node
  // whose log runs back weeks; traffic.untaken() asks for just these rows, the same answer. read() stays only for a
  // log that offers nothing else.
  function waiting() {
    if (traffic && typeof traffic.untaken === 'function') {
      try { return traffic.untaken(); } catch (e) { return []; }
    }
    if (!traffic || typeof traffic.read !== 'function') return [];
    try {
      return traffic.read().filter(function (row) {
        return row && row.dir === 'in' && row.admitted && !row.takenAt;
      }).sort(function (a, b) { return Date.parse(a.at) - Date.parse(b.at); });
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

    // ── NOT DECORATED ─────────────────────────────────────────────
    //
    //   Andy: "nothing in node and relay should know about apps."
    //
    // This called packet.decorate, which parses the envelope and hangs
    // `message.packet` on the row so a reader could tell whose traffic
    // it is without parsing. That reader is the SHELL, and the shell
    // already loads packet.js — so the node was decoding an app
    // envelope on behalf of a layer that can do it itself.
    //
    // `text` travels exactly as signed, which was always true; what
    // stops now is the node having an opinion about what is in it.
    var message = ({
      id: item.item,
      hash: item.hash,
      from: item.from,
      fromKey: item.from,
      text: item.text,
      sentAt: item.at,
      relay: item.relay,
    });

    // ── THE WITNESSES GET THE ENVELOPE; A PAGE DOES NOT (N1) ──────
    //
    // A witness is the NODE looking at its own arrivals — the api door,
    // the puppet door, the owner post, boxes — and each of them used to
    // open the envelope itself with a decoder server.js handed it. They
    // are handed what this file read instead, once, so there is one
    // reading of one packet and no way for two of them to disagree.
    //
    // A SUBSCRIBER IS A PAGE and gets no envelope: `text` travels exactly
    // as signed and the shell decodes it with its own copy of packet.js,
    // which is the half of "nothing in node and relay should know about
    // apps" that was already right.
    var witnessed = Object.assign({}, message, { envelope: envelopeOf(item.text) });

    // Every subscriber gets it, and one that throws does not stop the
    // rest or reach back into peerPost — which calls this while it still
    // owes the sender a receipt. A browser's bad handler must not be
    // able to turn an arrival into a refusal.
    witnesses.slice().forEach(function (fn) {
      try { fn(witnessed); } catch (e) { /* a witness is not a gate */ }
    });

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
    // Plain, for the reason above: the node does not read the payload.
    return ({
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

  return { note: note, subscribe: subscribe, witness: witness, count: count, pending: pending };
}

module.exports = {
  createArrivals: createArrivals,
  createFanOut: createFanOut,
  // The node layer's one reading of what arrived (N1, goal/G16.5). A
  // reader that is not a witness — answerRelay, nodeCard, peerPost's
  // refusal check — asks here instead of parsing the text itself.
  envelopeOf: envelopeOf,
  relayWordOf: relayWordOf,
};
