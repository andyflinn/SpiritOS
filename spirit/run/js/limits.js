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

// ── TWO BOUNDS SINCE CYCLE 10, BECAUSE SEALING MADE THEM TWO ────────
//
// One number meant both of these until sealed posts arrived, and it was
// right to: what an app composed WAS what travelled. After cycle 10 a
// packet is sealed before it is signed, so the bytes on the wire are no
// longer the bytes the app wrote — and a single constant would have to be
// wrong for one of its two readers.
//
//   PLAINTEXT_MAX  what a composer may BUILD, before sealing
//   PAYLOAD_MAX    what may TRAVEL, after sealing
//
// Keeping one constant was tried on paper and fails in a way nothing
// would have caught: `MATCH_BUDGET` (relay.js) composes a search reply
// against it and then seals the result. Raise the single number to fit
// sealed bytes and that budget silently rises with it — the relay builds
// a 22 KB reply, seals it to ~29 KB, and the wire refuses a packet the
// relay itself composed. Every component test stays green.

// WHAT A COMPOSER MAY BUILD. Unchanged at 16 KB, deliberately: this is
// the promise apps were written against, and cycle 10 is not an occasion
// to move it. `natterDetails`, `gradedSearch` and every app that sizes a
// payload measure themselves against this.
var PLAINTEXT_MAX = 16384;

// WHAT MAY TRAVEL: the encoded envelope as it goes on the wire, measured
// as `JSON.stringify(envelope).length`. The browser refuses it before the
// round trip; the relay refuses it because the browser's check is a
// courtesy and not a limit — a client-side cap binds only honest clients.
//
// ── THE FIGURE, COMPUTED FROM THE REAL ENVELOPE (cycle 10's R6) ─────
//
// Andy's amendment asked for the number rather than the approximation.
// Measured 2026-09-23 by sealing a packet of exactly PLAINTEXT_MAX bytes
// through `seal.seal` and taking `JSON.stringify(...).length`:
//
//     16,384 bytes of packet  ->  22,049 bytes on the wire   (x1.3458)
//
// Base64 of the ciphertext is the whole of it — GCM adds a 16-byte tag
// and no block padding — plus the throwaway public key, the nonce and the
// JSON around them. It is DETERMINISTIC in the plaintext's length: the
// same 16,384 bytes of any content seal to the same 22,049.
//
// 22,528 is 22 KiB, which clears that by 479 bytes. The margin is for the
// envelope growing a field, not for the arithmetic being uncertain.
//
// ── AND IT IS A FLAG DAY, WHICH THE RELEASE NOTE MUST SAY ──────────
//
// A relay that has not been updated still refuses at 16,384, so a legal
// sealed post from an updated node is a 413 from an old box. THE SYMPTOM
// AN OPERATOR SEES: large messages fail to send to some peers and not
// others, with no pattern a user could describe. Before this, a 16 KB
// message could not be sent AT ALL once sealing landed — the ceiling and
// the seal were incompatible, which is why cycle 10's R6 blocks the flag day rather
// than tidying after it.
var PAYLOAD_MAX = 22528;

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

// ── WHAT ONE PACKET COSTS ON A STREAM, AND HOW MANY MAY WAIT (R35) ─────
//
//   Andy: "if the output buffer goes past 2x MAX_FULL_PACKET, shouldn't
//   the relay just send a disconnect, then cut the connection loose?"
//
// PAYLOAD_MAX counts UTF-16 units before the relay writes the packet into
// an event, and the event is JSON again: a text of control characters
// comes out as `\u0001`, six BYTES per unit, and nothing refuses such a
// text (the relay checks its length, not its alphabet). So the largest
// thing one packet can put in a socket's buffer is six times the payload,
// plus the scaffolding. Measured against a built worst case in
// test/stalledReader.js, so the six is checked rather than believed.
var STREAM_EVENT_MAX = 6 * PAYLOAD_MAX + WIRE_HEADROOM;

// TWO OF THEM, and the two are not arbitrary: one full packet may sit in
// the buffer while an honest, slow reader drains it, and the second is
// room for the heartbeats and presence events around it. Past that the
// reader is not slow, it has stopped. Counted in what NODE holds for the
// socket (`writableLength`), which fills only once the kernel's own send
// buffer is full — so an honest reader is cut only after it has fallen
// behind by the kernel's buffer AND two worst-case packets.
var STREAM_BACKLOG_MAX = 2 * STREAM_EVENT_MAX;

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

// ── THE SEALED CEILING, DERIVED RATHER THAN WRITTEN DOWN ─────────────
//
//   Andy, 2026-09-26: "the idea that certain fixed values ("constants")
//   must be derived from underlying constants. is a design principle.
//   figure out the correct formula, and test it."
//
// PAYLOAD_MAX is UNDERLYING: a chosen ceiling on the wire, and moving it is
// the flag day the comment above describes. What a composer may hand to
// `seal` is DERIVED from it, and until now it was not — it was measured by
// hand once and the ANSWER written down as PLAINTEXT_MAX. That is the break
// in the chain this principle closes: move one and the other stays put, and
// nothing goes red.
//
// THE GROWTH IS EXACT, and it is exact in ESCAPED UTF-8 BYTES:
//
//     wire = 4 * ceil( utf8(JSON.stringify(text)) / 3 ) + SEAL_ENVELOPE
//
// Base64 of the ciphertext is the whole of the variable part — GCM adds a
// 16-byte tag and no block padding — and the rest is the throwaway public
// key, the nonce, the `{at,text}` wrapper and the JSON around them, which
// together are constant. Verified against real `seal.seal` output by two
// agents working independently: 85 cases on one side, 18 plus 2,400
// algebraic pairs on the other, spanning empty through 20,000 bytes, quote,
// backslash, newline, tab, accented, CJK, emoji and mixed content, and the
// base64 boundaries at 1..4 bytes. No case deviates.
var SEAL_ENVELOPE = 185;

// The largest escaped-UTF-8 packet whose sealed form still fits the wire.
// `floor` OUTSIDE the multiply, not inside: base64 output is a multiple of
// four, so dividing first and scaling after is two bytes too generous at one
// alignment in three. Both agents got that wrong from opposite directions
// before the arithmetic was checked against real output.
var SEALED_MAX = 3 * Math.floor((PAYLOAD_MAX - SEAL_ENVELOPE) / 4);

// ── AND THE FORK HAS A STATED SIZE ───────────────────────────────────
//
//   Andy, 2026-09-26: "that is the requester's problem, if ou want to
//   encode in fance unicode or whatever, you better make sure the message
//   doesn't pop the limit, if you want to send an elephant, you better
//   slice it to pieces first." And: "the restaurant server a meal with a
//   fork, it's your problem if you overload the fork. not the restaurants."
//
// So the product does NOT grow to fit what a sender piles on, and this is
// not a forgiving check. What it is instead is a LEGIBLE one: a sender can
// only take that responsibility if the cap is knowable in the unit that
// actually binds. PLAINTEXT_MAX counts UTF-16 units; the wire counts bytes
// after escaping and sealing. A packet of 16,384 characters of ordinary
// French or Chinese obeys the documented promise and is refused anyway —
// measured, at PLAINTEXT_MAX: ASCII seals to 22,049 and fits, newlines to
// 32,945, quotes and accented to 43,841, CJK to 65,633.
//
// MEASURED, NOT COUNTED, for the same reason `fitsWrapped` above measures:
// escaping cost depends on content, so no character count can stand in for
// it. This is the fork's size, said in the units of the load.
function fitsSealed(text) {
  return Buffer.byteLength(JSON.stringify(String(text === undefined ? '' : text)), 'utf8')
    <= SEALED_MAX;
}

var limitsApi = {
  PAYLOAD_MAX: PAYLOAD_MAX,
  PLAINTEXT_MAX: PLAINTEXT_MAX,
  SEAL_ENVELOPE: SEAL_ENVELOPE,
  SEALED_MAX: SEALED_MAX,
  fitsSealed: fitsSealed,
  WIRE_OVERHEAD: WIRE_OVERHEAD,
  WIRE_HEADROOM: WIRE_HEADROOM,
  HINTS_PER_POST: HINTS_PER_POST,
  HINTS_MAX: HINTS_MAX,
  BODY_MAX: BODY_MAX,
  STREAM_EVENT_MAX: STREAM_EVENT_MAX,
  STREAM_BACKLOG_MAX: STREAM_BACKLOG_MAX,
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
