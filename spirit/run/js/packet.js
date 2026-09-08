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

function packetRandomId(random) {
  var pick = typeof random === 'function' ? random : Math.random;
  var out = '';
  while (out.length < 16) {
    out += Math.floor(pick() * 0x100000000).toString(16);
  }
  return out.slice(0, 16);
}

// Wraps a body for the wire. `opts.id` and `opts.random` are injectable
// so a test can assert an exact string instead of a shape.
function packetEncode(app, body, opts) {
  var options = opts || {};
  var appId = String(app || '').trim();
  if (!appId) return { ok: false, error: 'app required' };
  if (body === undefined) return { ok: false, error: 'body required' };

  var envelope = {
    app: appId,
    v: PACKET_VERSION,
    id: options.id || packetRandomId(options.random),
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
  encode: packetEncode,
  decode: packetDecode,
  isEnvelope: packetIsEnvelope,
};

if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  module.exports = packetApi;
} else if (typeof window !== 'undefined') {
  window.spiritPacket = packetApi;
}
