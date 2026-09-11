'use strict';

// One door for every app (ARCHITECTURAL-CONCERNS.md, packet 1).
//
// The mailbox carries `{ from, to, text }` and signs
// `send\n<from>\n<to>\n<text>`. None of that changes here, and that is
// the whole point of this file: the envelope lives INSIDE `text`, so a
// relay running today's code stores and returns it without knowing what
// it is. No relay.js change, no spirit-3 update, no version skew — which
// is exactly what the inbox-signature cycle just cost when the wire did
// have to move.
//
//   text = JSON.stringify({ app: "relay-chat", v: 1, id: "…", body: … })
//
// `app` is the packet name of the app that sent it, not a shell app id
// and not a path. `body` is whatever that app wants to say: a string for
// chat, an object for anything with structure. `id` is unique per send —
// the mailbox assigns its own message id, but that one belongs to the
// mailbox, and an app that wants to recognise its own traffic across a
// re-read needs one it minted itself.
//
// What is deliberately NOT in here: a second signature (the send is
// already signed end to end), a timestamp (the mailbox's `sentAt` is the
// only clock two peers share), and any label (labels are display; a peer
// is a key).

var PACKET_VERSION = 1;

// The relay's own limit, checked there against the encoded string. An
// envelope that would be refused is refused here instead, so an app
// learns its packet is too big without a round trip and without the
// mailbox counting it against a rate limit.
var PACKET_MAX_TEXT = 1024;

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
// envelope caps at 1024 bytes, so sixteen more characters cost nothing.
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
  var appId = String(app || '').trim();
  if (!appId) return { ok: false, error: 'app required' };
  if (body === undefined) return { ok: false, error: 'body required' };

  var newId = options.id || packetRandomId(options.random);
  // Refused rather than sent with a weak one. An envelope without a
  // unique, unguessable id is one the router cannot key on safely, and
  // "probably random enough" is not a thing this can report later.
  if (!newId) {
    return { ok: false, error: 'no secure randomness available for a packet id' };
  }

  var envelope = {
    app: appId,
    v: PACKET_VERSION,
    id: newId,
    body: body,
  };

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
  if (typeof parsed.app !== 'string' || !parsed.app) return false;
  if (!Object.prototype.hasOwnProperty.call(parsed, 'body')) return false;
  return true;
}

// Every mailbox in existence already holds plain strings, and so does
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
    app: parsed.app,
    v: parsed.v,
    id: parsed.id,
    body: parsed.body,
  };
}

var packetApi = {
  VERSION: PACKET_VERSION,
  MAX_TEXT: PACKET_MAX_TEXT,
  ID_BYTES: PACKET_ID_BYTES,
  randomId: packetRandomId,
  encode: packetEncode,
  decode: packetDecode,
  isEnvelope: packetIsEnvelope,
};

if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  module.exports = packetApi;
} else if (typeof window !== 'undefined') {
  window.spiritPacket = packetApi;
}
