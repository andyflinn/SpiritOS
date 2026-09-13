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
// ── WHERE THE MARK LIVES, AND WHY NOT IN THE TRAFFIC LOG ─────────────
//
// Andy chose: the node keeps one mark. A packet counts as seen once it
// reached at least one live page; everything after that mark is replayed
// to the next page that opens. No watermark in the browser, no new rule
// for apps.
//
// The obvious home for the backlog was trafficLog — it already keeps
// every packet that crossed the WAN for 24 hours, payload included. IT
// CANNOT BE USED, and the reason is worth writing down because it is not
// visible from that file:
//
//   peerPost logs a HELD packet as `outcome: delivered` WITH its payload,
//   and then deliberately does not hand it to any app — a stranger who is
//   waiting to be accepted or blocked is a decision a human makes, not a
//   line an app is given first and asked about after.
//
// So the traffic log records arrival, not admission. Replaying from it
// would hand an unaccepted stranger's packet straight to an app and walk
// the front door back. This file is the only place that sees both
// "admitted" and "delivered to a page", so the backlog lives here.
//
// ── WHAT IT STILL DOES NOT DO ────────────────────────────────────────
//
// The mark is one mark, not one per page. The first page to open drains
// the backlog; a second page opening after it gets nothing. A tab that
// opens and closes at once therefore consumes what it was handed —
// which is the same failure a poll that read and then crashed always
// had, and it is the price of not keeping per-browser state.
//
// The backlog is bounded by the same 24-hour window as the traffic log,
// for the same reason: a clock is a promise that can be stated exactly,
// and a count would be a guess about traffic.

const fs = require('fs');
const path = require('path');
const packet = require('./packet.js');

// Beside the traffic log, and for the same three reasons: relay-state/ is
// gitignored, it is unservable through every generic file route, and it
// is where this node keeps things that are its own business. Personal
// nodes only — a relay never builds a peerRouter and so never notes here.
const WINDOW_MS = 24 * 60 * 60 * 1000;

function backlogPath(rootDir) {
  return path.join(rootDir, 'relay-state', 'pendingArrivals.json');
}

// Unreadable or malformed reads as "nothing held" rather than throwing. A
// backlog that can crash the thing it serves is worse than an empty one.
function readBacklog(rootDir, nowMs) {
  var held = [];
  try {
    var parsed = JSON.parse(fs.readFileSync(backlogPath(rootDir), 'utf8'));
    held = Array.isArray(parsed && parsed.held) ? parsed.held : [];
  } catch (e) {
    return [];
  }
  var floor = nowMs - WINDOW_MS;
  return held.filter(function (m) {
    var at = Date.parse(m && m.sentAt);
    return !(at < floor);
  });
}

// TEMP FILE THEN RENAME, the same three lines trafficLog buys it with: a
// rename inside one directory is atomic, so a crash leaves either the old
// backlog or the new one and never half of either.
function writeBacklog(rootDir, held) {
  var dir = path.dirname(backlogPath(rootDir));
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* already there */ }
  var tmp = backlogPath(rootDir) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ held: held }));
  fs.renameSync(tmp, backlogPath(rootDir));
}

// opts: { rootDir, now }. Without a rootDir it runs entirely in memory —
// which is what the seam-level checks want, and what a relay would get if
// one ever built it.
function createArrivals(opts) {
  var o = opts || {};
  var rootDir = o.rootDir || null;
  var clock = typeof o.now === 'function' ? o.now : function () { return Date.now(); };

  // An array rather than a map: subscribers are anonymous (one per open
  // browser connection) and there is never a reason to address one.
  var subscribers = [];

  // In memory when there is no rootDir, on disk when there is. Held here
  // as well either way, so a page opening does not read a file to find
  // out there is nothing to read.
  var held = rootDir ? readBacklog(rootDir, clock()) : [];

  function persist() {
    if (!rootDir) return;
    try { writeBacklog(rootDir, held); }
    catch (e) { /* a backlog that cannot be written must not break delivery */ }
  }

  // Returns its own unsubscribe, so a caller cannot leak one by holding
  // the wrong handle. The SSE route takes this and calls it from the
  // same teardown that clears its heartbeat — a subscriber that outlives
  // its socket writes to a dead response for ever.
  function subscribe(fn) {
    if (typeof fn !== 'function') return function () {};
    subscribers.push(fn);

    // WHAT THIS PAGE MISSED, before anything new can arrive for it.
    // Drained on the way out rather than on the way in: a handler that
    // throws on the backlog must not leave the backlog half-delivered
    // and half-forgotten, so the whole lot is handed over and then the
    // mark advances once.
    if (held.length) {
      var backlog = held;
      held = [];
      persist();
      backlog.forEach(function (message) {
        try { fn(message); } catch (e) { /* not ours */ }
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

    // NOBODY HOME, SO IT WAITS. Counted as delivered only when a page
    // actually took it — a subscriber that threw did not receive
    // anything, and treating a broken page as a reader would lose the
    // packet exactly when something is already wrong.
    if (delivered === 0) {
      held = readBacklogInMemory().concat([message]);
      persist();
    }
    return delivered;
  }

  // The window is applied on the way in as well as on the way out, so a
  // node that ran for a week does not carry a week of backlog waiting for
  // somebody to open a page.
  function readBacklogInMemory() {
    var floor = clock() - WINDOW_MS;
    return held.filter(function (m) {
      var at = Date.parse(m && m.sentAt);
      return !(at < floor);
    });
  }

  // How many packets are waiting for a page to open. For the suite, and
  // for anything that ever wants to say so out loud.
  function pending() { return held.length; }

  // For the suite and for a future monitor: how many connections are
  // listening. Never a reason to act on it here — a packet is delivered
  // to whoever is there, including nobody.
  function count() { return subscribers.length; }

  return { note: note, subscribe: subscribe, count: count, pending: pending };
}

module.exports = { createArrivals: createArrivals, WINDOW_MS: WINDOW_MS };
