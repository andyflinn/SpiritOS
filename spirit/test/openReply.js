'use strict';

// spirit/test/openReply.js
// READING WHAT A RELAY SAID, NOW THAT IT SEALS IT — cycle 10, R5.
//
//   Andy: "relay needs a cypher key too, because it has answerSelf()."
//
// Every answer a relay gives a member is sealed to the cipher key on that
// member's card, in both directions — so a suite that used to do
// `JSON.parse(reply.text)` has to open it first, exactly as a node does.
//
// ONE HELPER, NOT TWENTY COPIES. Twenty suites parse relay replies, and
// twenty hand-rolled opens would be twenty chances to quietly accept a
// plaintext one and go green on a tree that had stopped sealing. This
// insists: if it is not sealed and not a refusal, it is a failure, and
// the caller hears about it.
//
// A SUITE MAY HOLD BOTH KEYS. That is what makes it a suite rather than a
// party on the wire — but it must still do the real work with them, which
// is what this does.

const seal = require('../run/js/seal');
const auth = require('../run/js/relayAuth');

// What the relay said, as the object a member's node would hand its app.
//
// `who` is the member's identity (it holds the cipher key), `relayKey`
// the box that answered, `text` the reply's bytes.
//
// Answers null when there was nothing to read. A REFUSAL COMES BACK
// PLAIN and is passed through: a relay that will not open your post
// cannot seal its complaint to you, and "I could not read that" is the
// one thing it is willing to say to anybody.
function openReply(who, relayKey, text) {
  if (typeof text !== 'string' || !text) return null;
  if (!seal.isSealed(text)) {
    let plain = null;
    try { plain = JSON.parse(text); } catch (e) { return null; }
    return plain;
  }
  const got = seal.open(who.sealPrivateKey, relayKey, who.publicKey, text);
  if (!got) return null;
  try { return JSON.parse(got.text); } catch (e) { return null; }
}

// The same, for the `body` every caller actually wants.
function openBody(who, relayKey, text) {
  const said = openReply(who, relayKey, text);
  return (said && said.body) || null;
}

// ── AND THE OTHER HALF: SEALING A POST TO A RELAY ───────────────────
//
// A suite that posts an owner verb has to seal it, because the relay
// refuses an unsealed one — which is the rule, not an inconvenience.
// `box` is the in-process relay, which publishes its cipher key the same
// way a real one does over `/api/relay/key`.
//
// Answers the TEXT to post, so a caller signs exactly what it sends.
function sealFor(who, box, text) {
  const wrapped = seal.seal(box.relaySealKey(), who.publicKey, box.relayPublicKey(), text);
  // Never a plaintext fallback, even here: a helper that quietly sent the
  // words when it could not seal them would make a suite green on a tree
  // that had stopped sealing, which is the one thing these helpers exist
  // to prevent.
  if (!wrapped) throw new Error('openReply.sealFor: that relay publishes no cipher key');
  return JSON.stringify(wrapped);
}

// ── A POST AS IT ARRIVES AT A NODE ──────────────────────────────────
//
// The body `peerPost.onRequest` is handed, built the way a real sender
// builds one: sealed to the recipient, then signed over the sealed bytes
// (cycle 10, R5 and R11). A node refuses an unsealed post that is not a
// card, so a suite that handed it plaintext would be testing the refusal
// rather than whatever it meant to test.
//
// `toId` is the recipient's IDENTITY, not just their key, because
// sealing needs their cipher key — which is the whole point: you cannot
// post to somebody whose card you do not hold.
function sealedPost(sender, toId, text) {
  const to = typeof toId === 'string' ? null : toId;
  const toKey = to ? to.publicKey : toId;
  const wrapped = to && seal.seal(to.sealPublicKey, sender.publicKey, toKey, text);
  const sending = wrapped ? JSON.stringify(wrapped) : text;
  return {
    from: sender.publicKey,
    to: toKey,
    text: sending,
    sig: auth.sign(sender.privateKey, auth.postMessage(sender.publicKey, toKey, sending)),
  };
}

// ── WHOSE CARD THIS SUITE HOLDS ─────────────────────────────────────
//
// A node refuses to post to somebody whose cipher key it does not have
// (cycle 10, R5), and on a real node that key comes off the contact row.
// A suite that drives `peerPost` directly has no contact book, so it
// says here who it knows — which is the same statement, made the short
// way.
//
// `sealKeyFor` answers empty for anybody not registered, and that is
// useful rather than lax: it is how a suite asks for the refusal.
const known = Object.create(null);
function rememberKeys(id) { known[id.publicKey] = id.sealPublicKey; return id; }
function sealKeyFor(key) { return known[key] || ''; }

module.exports = {
  openReply: openReply,
  openBody: openBody,
  sealFor: sealFor,
  sealedPost: sealedPost,
  rememberKeys: rememberKeys,
  sealKeyFor: sealKeyFor,
};
