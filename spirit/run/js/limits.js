'use strict';

// spirit/run/js/limits.js
// HOW BIG A THING MAY BE, in one place.
//
//   Andy: "the redundant package-size limits must be collapsed to one
//   PAYLOAD_MAX, and the max post and reply sizes must be PAYLOAD_MAX +
//   OVERHEAD (with headroom)."
//
// ── WHY THIS FILE EXISTS ─────────────────────────────────────────────
//
// There were two limits on the same bytes, and they disagreed by 16×.
//
//   packet.js   PACKET_MAX_TEXT  1024   checked in the browser
//   relay.js    MAX_ROUTED_TEXT  16384  checked on the relay
//
// Both measured `JSON.stringify(envelope).length` — the same string, the
// same unit — and packet.js's own comment said it existed to pre-refuse
// what the relay would refuse, "so an app learns its packet is too big
// without a round trip". It did not mirror the relay. It undercut it by
// a factor of sixteen, so every app was capped at 1 KB for a relay that
// would have taken 16, and nothing anywhere said why.
//
// Two numbers for one rule is the bug. This is the rule.
//
// ── AND THE OVERHEAD IS NOT THE SENDER'S FAULT ───────────────────────
//
//   Andy: "at 1 Kb actual package text, the overhead to content ratio
//   looks rather ugly."
//
// Measured, at the wire: a post carries `from`, `to`, `sig` and JSON
// scaffolding around them. Two Ed25519 public keys at 60 base64 chars,
// one signature at 88, brackets and field names —
//
//   from(60) + to(60) + sig(88) + JSON scaffolding = 246 bytes
//
// — and that is FIXED. Not an average: there is no variable part. The
// app name lives inside the envelope, which the relay never parses and
// therefore counts as payload, exactly as decision 0006's
// payload-agnostic rule requires.
//
// At 940 bytes of body that fixed cost is 26% of the wire. At 140 bytes
// — one line of chat — it is 70%. At 16 KB it is 1.5%. The ratio is not
// improved by tuning; it is dissolved by the payload being big enough to
// dwarf a constant.
//
// ── THE HEADROOM IS DELIBERATE ───────────────────────────────────────
//
// 246 is exact today and an exact constant is the fragile kind: a longer
// key format, a different signature scheme, or one more field on the
// wire object would each breach it and produce 413s on traffic that is
// perfectly legal. That failure looks like an outage rather than a
// limit, which is the worst shape available here.
//
//   Andy: "i'd give the overhead a bit of headroom, let's say 512 bytes,
//   avoids edge cases."
//
// So 512, and the measured 246 stays written down beside it — otherwise
// somebody eventually "tightens" it back to the exact figure and
// reintroduces the brittleness on purpose, believing they are tidying.
//
// The cost of the extra 266 bytes is 68 KB at the router's full
// concurrency of 256. It buys a class of outage that nobody would
// diagnose quickly.

// What a sender may put on the wire: the encoded envelope, measured as
// `JSON.stringify(envelope).length`. The browser refuses it before the
// round trip; the relay refuses it because the browser's check is a
// courtesy and not a limit — a client-side cap binds only honest clients.
var PAYLOAD_MAX = 16384;

// Measured, not estimated. See above; kept so the headroom below reads
// as a decision rather than a guess.
var WIRE_OVERHEAD = 246;

// Slack over the measured overhead, so a format change costs a re-measure
// rather than an incident.
var WIRE_HEADROOM = 512;

// ── WHAT A SOCKET MAY ACCEPT, WHICH IS THE ONE THAT WAS MISSING ──────
//
// The payload caps above are checked AFTER the whole body has been read
// and parsed. So they bounded what got ROUTED and never what got
// ACCEPTED: `readJsonBody` did `body += chunk` with no cap at all, on a
// public relay, on every POST including /claim and /device.
//
// The memory arithmetic everyone reasoned from —
//
//   router table: 256 concurrent, 16 per requester, no bodies held
//   256 × 16 KB ≈ 4 MB in flight, ~12 MB peak through parse
//
// — was therefore describing an intention. Real exposure was concurrent
// sockets times whatever they chose to send.
//
// This is the number that makes the arithmetic true, and it belongs on
// EVERY public POST rather than on the routed ones: /claim, /device and
// /reply are equally reachable and were equally unbounded. One shared
// cap sized for the largest legitimate body is simpler than four, and
// four numbers that must agree are four numbers that can drift.
// ── ROUTE HINTS SIT BESIDE THE PACKET, AND SO DOES THEIR BOUND (cycle 2)
//
//   Andy: "the MAX_PAYLOAD_SIZE excludes signatures, hashes and
//   route-hints."
//
// Hints are siblings of the signed packet, dropped at the first relay
// (design/relay/SURFACE.md §8), so they must never eat the payload. Their
// room is added to what a socket accepts instead.
//
// HINTS_PER_POST is a declared number, not a measured one — Andy: "the
// number is not vital". HINTS_MAX is measured: four 60-character keys and
// an 88-character signature serialise to 364 bytes; 512 leaves headroom
// for a format change without an incident.
var HINTS_PER_POST = 4;
var HINTS_MAX = 512;

var BODY_MAX = PAYLOAD_MAX + WIRE_HEADROOM + HINTS_MAX;

// ── WILL IT STILL FIT IF IT IS TUNNELLED? (cycle 2) ──────────────────
//
// A post forwarded to a partner is re-wrapped whole — `{from,to,text,sig}`
// becomes the `text` of a new post — and escaped on the way, so a packet
// that fits at the first hop can 413 at the far one, AFTER signing, where
// nothing can trim it (SURFACE.md §8: "works locally, fails only across a
// partnership, only for large payloads"). The cost is proportional to how
// quote-dense the packet is, so the reservation cannot be a constant.
//
// Exact rather than estimated: build the wrapper the relay would build and
// measure it. A node checks this at compose, on every route, because it
// cannot know whether it will be tunnelled; the relay checks it again
// before carrying.
function fitsWrapped(text, from, to, sig) {
  return JSON.stringify({
    v: 1,
    body: { forward: { from: String(from || ''), to: String(to || ''), text: String(text || ''), sig: String(sig || '') } },
  }).length <= PAYLOAD_MAX;
}

// AND THE SAME ON THE WAY BACK. A reply to a tunnelled post is re-wrapped
// too: the far relay hands it to its partner as its own answer,
// `{ v, body: { ok, status, forwarded: { from, text, sig } } }`
// (relay.js, routeReply → sendAnswer). So a reply that fits one hop can
// fail on the return exactly as a post can on the way out — and the asker
// hears nothing. Same discipline: build the wrapper, measure it.
function fitsWrappedReply(text, from, sig) {
  return JSON.stringify({
    v: 1,
    body: { ok: true, status: 200, forwarded: { from: String(from || ''), text: String(text || ''), sig: String(sig || '') } },
  }).length <= PAYLOAD_MAX;
}

var limitsApi = {
  PAYLOAD_MAX: PAYLOAD_MAX,
  WIRE_OVERHEAD: WIRE_OVERHEAD,
  WIRE_HEADROOM: WIRE_HEADROOM,
  HINTS_PER_POST: HINTS_PER_POST,
  HINTS_MAX: HINTS_MAX,
  BODY_MAX: BODY_MAX,
  fitsWrapped: fitsWrapped,
  fitsWrappedReply: fitsWrappedReply,
};

// Dual target, the same idiom packet.js uses: this file is required by
// the relay and the node AND served to the page, because the limit a
// browser pre-checks has to be the limit the relay enforces or the
// pre-check is a lie.
if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  module.exports = limitsApi;
} else if (typeof window !== 'undefined') {
  window.spiritLimits = limitsApi;
}
