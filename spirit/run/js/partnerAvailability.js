'use strict';

// spirit/run/js/partnerAvailability.js
// WHAT A NODE HAS BEEN TOLD ABOUT ITS RELAYS' PARTNERS (R42, gap cycle).
//
//   Andy: "what if the member thinks partner is not available? ahh the
//   broadcast says "unavailable" (right now) it doesn't say "dead" ?" —
//   "understood. mechanism accepted, as just discussed." (2026-09-22)
//
// A relay broadcasts `partner { relayKey, live, at }` to its members when
// one of its partners changes between answering and not (relay.js,
// announcePartner). This keeps the latest word per relay, per partner, and
// nothing else: in RAM, bounded by how many partners the node's relays
// have, and gone on restart — which only means the next send tries.
//
// ── "UNAVAILABLE AS OF", NEVER "DEAD" ────────────────────────────────
//
// The word goes stale after QUIET_MS, the same fifteen minutes the relay
// benches a partner for (gap R13). After that a node sends as usual, and that
// send IS the relay's next try: a word that stopped members trying would
// starve the only thing that ever retries. So it never removes a hint. It
// only moves a partner said to be unavailable, recently, to the back.

// The one number both ends read. relay.js takes it from here, so the time
// a relay benches a partner and the time a node believes it cannot drift
// apart. Grok (review): "N = 15 minutes. Quiet is normal." Andy agreed.
var QUIET_MS = 15 * 60 * 1000;

function createAvailability(opts) {
  var o = opts || {};
  var now = typeof o.now === 'function' ? o.now : Date.now;
  // relay url -> { partner relay key -> { live, atMs } }
  var byRelay = Object.create(null);

  function note(url, body) {
    if (!url || !body || typeof body.relayKey !== 'string' || !body.relayKey) return false;
    var atMs = Date.parse(body.at);
    if (!isFinite(atMs)) atMs = now();
    var book = byRelay[url] || (byRelay[url] = Object.create(null));
    var had = book[body.relayKey];
    // An older word never overwrites a newer one: two broadcasts can cross.
    if (had && had.atMs > atMs) return false;
    book[body.relayKey] = { live: body.live === true, atMs: atMs };
    return true;
  }

  // Said unavailable by this relay, and said recently enough to believe.
  function unavailable(url, relayKey) {
    var book = byRelay[url];
    var w = book && book[relayKey];
    if (!w || w.live) return false;
    return now() - w.atMs < QUIET_MS;
  }

  // THE HINTS, REORDERED AND NEVER SHORTENED. Everything the node would
  // have sent is still sent; a partner this relay recently called
  // unavailable goes last, so the relay's first choice is one it thinks
  // is up. The relay orders live first itself (partnerFromHints) — this is
  // the node saying the same thing earlier, and costs nothing if it is
  // wrong.
  function order(url, hints) {
    if (!Array.isArray(hints) || hints.length < 2) return hints;
    var up = [];
    var down = [];
    hints.forEach(function (k) { (unavailable(url, k) ? down : up).push(k); });
    return up.concat(down);
  }

  // What this node was told, for a screen or a suite. Copies, never the map.
  function view(url) {
    var book = byRelay[url] || {};
    var out = {};
    Object.keys(book).forEach(function (k) {
      out[k] = { live: book[k].live, at: new Date(book[k].atMs).toISOString() };
    });
    return out;
  }

  return { note: note, unavailable: unavailable, order: order, view: view };
}

// ONE PER NODE PROCESS, the way seenPeers' cache is one: one node, one
// answer to "what have my relays told me about their partners".
var shared = null;
function shared_() { return shared || (shared = createAvailability()); }

module.exports = {
  QUIET_MS: QUIET_MS,
  createAvailability: createAvailability,
  shared: shared_,
};
