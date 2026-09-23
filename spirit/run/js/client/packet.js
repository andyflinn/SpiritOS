'use strict';

// One door for every app (ARCHITECTURAL-CONCERNS.md, packet 1).
//
// The relay carries `{ from, to, text }` and signs
// `send\n<from>\n<to>\n<text>`. None of that changes here, and that is
// the whole point of this file: the envelope lives INSIDE `text`, so a
// relay running today's code stores and returns it without knowing what
// it is. No relay.js change, no spirit-3 update, no version skew — which
// is exactly what the inbox-signature cycle just cost when the wire did
// have to move.
//
//   text = JSON.stringify({ app: "relay-chat", v: 1, id: "…", body: … })
//
// …and optionally `re`, the request hash of the packet this one is
// about: the protocol's "regarding", added 2026-09-13. Omitted entirely
// when there is nothing to regard, so an ordinary packet is byte-for-byte
// what it was before the field existed.
//
// `app` is the packet name of the app that sent it, not a shell app id
// and not a path. `body` is whatever that app wants to say: a string for
// chat, an object for anything with structure. `id` is unique per send —
// the relay assigns its own message id, but that one belongs to the
// relay, and an app that wants to recognise its own traffic across a
// re-read needs one it minted itself.
//
// What is deliberately NOT in here: a second signature (the send is
// already signed end to end), a timestamp (the relay's `sentAt` is the
// only clock two peers share), and any label (labels are display; a peer
// is a key).

// limits.js IS dual target — the relay and server.js read it too, which is
// why it stays up in js/ while this file does not. Required from one
// directory up on the node, read off `window.spiritLimits` in the page.
// index.html loads limits.js before packet.js for exactly that reason.
var limits = (typeof process !== 'undefined' && process.versions && process.versions.node)
  ? require('../limits.js')
  : (typeof window !== 'undefined' ? window.spiritLimits : null);

// SAY WHICH SCRIPT IS MISSING, rather than dying on `undefined.PAYLOAD_MAX`.
//
// A page holding a cached index.html from before limits.js existed loads
// this file with no global to read, and the bare property access throws a
// TypeError at parse-adjacent time — which kills packet.js, and with it
// every app that sends anything, with a message naming neither file.
//
// The page is then simply broken in a way that looks like the node
// forgetting things rather than like a script failing to load.
if (!limits || typeof limits.PAYLOAD_MAX !== 'number') {
  throw new Error(
    'packet.js needs js/limits.js loaded first — ' +
    'index.html must have <script src="/js/limits.js"> before this file. ' +
    'A hard reload usually fixes it: the page is running a cached index.html.'
  );
}

var PACKET_VERSION = 1;

// The relay's own limit, checked there against the encoded string. An
// envelope that would be refused is refused here instead, so an app
// learns its packet is too big without a round trip and without the
// relay counting it against a rate limit.
//
// IT SAID 1024 AND THE RELAY SAID 16384 — the same measurement of the
// same string, disagreeing by 16×, with this comment claiming to mirror
// a number it undercut. Every app was capped at a sixteenth of what the
// relay would take. One rule, one place: js/limits.js.
// PLAINTEXT_MAX since cycle 10's R6: an app composes a packet and the node
// seals it afterwards, so what an app may build is the plaintext bound.
// Against the wire figure every app would be told it has 22 KB and be
// refused at about 16.
var PACKET_MAX_TEXT = limits.PLAINTEXT_MAX;

// 128 bits. It was 64, from Math.random, and both halves were wrong for
// what this field is about to become (design/relay/ROUTER.md §6).
//
// Math.random is not a CSPRNG — V8's is xorshift128+, seeded per context,
// and its future output is recoverable from enough of its past. That was
// harmless while `id` was only an app-level tag for recognising your own
// traffic across a re-read. It stops being harmless the moment the hash
// of an envelope becomes a ROUTING KEY: a predictable id is a predictable
// hash, the id becomes a nonce in a construction that depends on
// unpredictability, and a guessable sequence lets an observer count and
// correlate somebody's traffic.
//
// (The old one lost entropy a second way, quietly: it built the string
// from `.toString(16)` of each draw, so any value with leading zeros
// contributed fewer than its 32 bits.)
//
// 128 bits rather than 64 because it is the same line of code and the
// envelope has a cap far larger than this (js/limits.js), so sixteen more
// characters cost nothing. That cap was 1024 when this was written and is
// 16384 now; the sentence was true of the number rather than of the
// reason, which is why it is stated as the reason here.
// The collision odds were never the argument — unpredictability was.
var PACKET_ID_BYTES = 16;

// Isomorphic, the way ownerBadge.js is: the rule is shared, the source of
// randomness is not. Required lazily because this file is also loaded by
// a <script> tag, where a top-level require would be a syntax error at
// the wrong moment.
function packetSecureHex(bytes) {
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try { return require('crypto').randomBytes(bytes).toString('hex'); }
    catch (e) { return ''; }
  }
  var webcrypto = (typeof globalThis !== 'undefined' && globalThis.crypto) || null;
  if (webcrypto && typeof webcrypto.getRandomValues === 'function') {
    var buf = new Uint8Array(bytes);
    webcrypto.getRandomValues(buf);
    var out = '';
    for (var i = 0; i < buf.length; i += 1) {
      out += (buf[i] < 16 ? '0' : '') + buf[i].toString(16);
    }
    return out;
  }
  // NO FALLBACK TO Math.random. A silent downgrade to a predictable
  // source is the exact bug this replaced, and it would be invisible
  // afterwards. Nothing here can sign without crypto.subtle anyway, so a
  // context without randomness was never going to get a packet sent.
  return '';
}

// `random` stays a TEST SEAM and nothing else: a function returning 0..1,
// used only where a suite needs a predictable string. Production never
// passes it, and anything that does has opted out of the paragraph above.
function packetRandomId(random) {
  if (typeof random === 'function') {
    var out = '';
    while (out.length < PACKET_ID_BYTES * 2) {
      out += Math.floor(random() * 0x100000000).toString(16);
    }
    return out.slice(0, PACKET_ID_BYTES * 2);
  }
  return packetSecureHex(PACKET_ID_BYTES);
}

// Wraps a body for the wire. `opts.id` and `opts.random` are injectable
// so a test can assert an exact string instead of a shape.
function packetEncode(app, body, opts) {
  var options = opts || {};
  // ── AN APP IS OPTIONAL, BECAUSE NOT EVERY PACKET IS FOR ONE ─────────
  //
  //   Andy: "nothing in node and relay should know about apps."
  //
  // `app` says which app ON THE RECIPIENT NODE a packet is for, and the
  // shell is the only thing that reads it — `deliverPackets` begins "no
  // envelope: addressed to no app". A packet addressed to a RELAY has no
  // such app, and requiring one made the node and the box each invent the
  // string `relay` and write it into bytes neither of them ever parses.
  //
  // It also left `relay` impersonatable: while every packet had to name
  // an app, an app could name itself that. A system packet is now the one
  // with NO app, which nothing claiming to be an app can forge.
  var appId = String(app || '').trim();
  if (body === undefined) return { ok: false, error: 'body required' };

  var newId = options.id || packetRandomId(options.random);
  // Refused rather than sent with a weak one. An envelope without a
  // unique, unguessable id is one the router cannot key on safely, and
  // "probably random enough" is not a thing this can report later.
  if (!newId) {
    return { ok: false, error: 'no secure randomness available for a packet id' };
  }

  // OMITTED, NOT EMPTIED. A packet with no app is one addressed to a box
  // rather than to somebody behind it; writing `app: ""` would be the
  // node inventing a value for a question that does not apply to it.
  var envelope = {};
  if (appId) envelope.app = appId;
  envelope.v = PACKET_VERSION;
  envelope.id = newId;
  envelope.body = body;

  // REGARDING. The request hash of the packet this one is about — an
  // email Re:, with proof attached.
  //
  //   Andy: "this has nothing to do with chat. it's a protocol feature,
  //   similar to an email's Re: (regarding) field in meaning but much
  //   more specific."
  //
  // It is a HASH and not the `id` above, and the difference is the whole
  // value of it: `id` is a number the sender picked, so a reference to it
  // is merely asserted. The request hash is taken over the exact bytes
  // that were signed, so anyone holding the original can recompute it and
  // check. Both ends already have it without being told — the sender gets
  // it back from its own post, the receiver derives it from what arrived
  // (ROUTER.md §2: no hash is ever sent).
  //
  // NOT the route table's key in any live sense. That entry is swept
  // after 20 seconds (router.js DEFAULT_TTL_MS), which is the window a
  // sender stands waiting for a reply. This outlives it by as long as
  // somebody keeps the packet: "regarding the thing you said on Tuesday"
  // is a new post that NAMES an old one, not an answer to a request still
  // in flight. Those are different mechanisms and conflating them would
  // give threading a twenty-second memory.
  //
  // OMITTED WHEN ABSENT, so a packet that regards nothing is byte-for-byte
  // what it was before this field existed.
  var re = options.re === undefined || options.re === null ? '' : String(options.re);
  if (re) envelope.re = re;

  var text;
  try {
    text = JSON.stringify(envelope);
  } catch (e) {
    // A body with a cycle in it, or something JSON cannot express.
    return { ok: false, error: 'body is not serialisable' };
  }
  if (typeof text !== 'string') return { ok: false, error: 'body is not serialisable' };

  if (text.length > PACKET_MAX_TEXT) {
    return {
      ok: false,
      error: 'packet too long: ' + text.length + ' of ' + PACKET_MAX_TEXT,
      length: text.length,
      limit: PACKET_MAX_TEXT,
    };
  }
  return { ok: true, text: text, envelope: envelope };
}

// Is this string one of ours? Deliberately strict: an object with the
// three fields and the version we know. Anything else — a plain chat
// line, a number, JSON somebody else wrote, half a packet — is not an
// envelope, and the caller decides what that means.
function packetIsEnvelope(text) {
  if (typeof text !== 'string') return false;
  var trimmed = text.trim();
  if (trimmed.charAt(0) !== '{') return false; // cheap, and most lines are chat
  var parsed;
  try { parsed = JSON.parse(trimmed); }
  catch (e) { return false; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  if (parsed.v !== PACKET_VERSION) return false;
  // AN APP IS OPTIONAL. It says which app on the recipient NODE a packet
  // is for; a packet addressed to a relay has none, and demanding one
  // made the box write a name it never reads. What still makes this an
  // envelope rather than a chat line is the SHAPE: a version we know and
  // a body. A plain string is not JSON, and hand-typed JSON has neither.
  if (parsed.app !== undefined && (typeof parsed.app !== 'string' || !parsed.app)) return false;
  if (!Object.prototype.hasOwnProperty.call(parsed, 'body')) return false;
  return true;
}

// Every relay in existence already holds plain strings, and so does
// every peerfile. So decode never fails: a string that is not an
// envelope comes back as legacy, which is what "this is a chat line
// somebody sent before packets existed" means. The reader decides.
function packetDecode(text) {
  if (!packetIsEnvelope(text)) {
    return { legacy: true, app: null, body: typeof text === 'string' ? text : '' };
  }
  var parsed = JSON.parse(String(text).trim());
  return {
    legacy: false,
    app: typeof parsed.app === 'string' && parsed.app ? parsed.app : null,
    v: parsed.v,
    id: parsed.id,
    // '' rather than undefined for a packet that regards nothing, so a
    // reader never has to know whether the field was absent or empty.
    re: typeof parsed.re === 'string' ? parsed.re : '',
    body: parsed.body,
  };
}

// A MESSAGE, WITH ITS ENVELOPE READ. Every field the message already had
// is kept untouched and `packet` is added beside them — the reader of a
// decorated message can still see the raw `text`, which is what makes
// this additive rather than a translation.
//
// It lives here, and not where it was born (hub.decorateWithPacket, on
// the `inbox` path), because the router grew a second arrival path in
// 2026-09-13 and two transports building `message.packet` in two files
// is one drift away from an app seeing a different shape depending on
// which road a line travelled. One function, both callers.
function packetDecorate(message) {
  var decoded = packetDecode(message && message.text);
  var out = {};
  Object.keys(message || {}).forEach(function (key) { out[key] = message[key]; });
  out.packet = {
    legacy: !!decoded.legacy,
    app: decoded.app,
    id: decoded.id || null,
    // What this packet is about, if anything. Every app gets it and most
    // will ignore it — which is the point of a protocol field rather than
    // a convention each app invents in its own body.
    re: decoded.re || '',
    body: decoded.body,
  };
  return out;
}

var packetApi = {
  VERSION: PACKET_VERSION,
  MAX_TEXT: PACKET_MAX_TEXT,
  ID_BYTES: PACKET_ID_BYTES,
  randomId: packetRandomId,
  encode: packetEncode,
  decode: packetDecode,
  decorate: packetDecorate,
  isEnvelope: packetIsEnvelope,
};

if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  module.exports = packetApi;
} else if (typeof window !== 'undefined') {
  window.spiritPacket = packetApi;
}
