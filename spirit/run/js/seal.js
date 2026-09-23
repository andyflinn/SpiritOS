'use strict';

// spirit/run/js/seal.js
// WHAT THE RELAY CARRIES AND CANNOT READ — cycle 10, R4.
//
//   Andy, 2026-09-23: "developper-nerds wouldn't be happy about a product
//   where the carrier(relay) can decipher any payload....."
//
// That is the whole cycle, and this file is where it becomes true. One
// sealing function and one opening function, and `oneDoor.js` counts them
// — two of either is how the associated data gets dropped on one path.
//
// PURE. Keys and bytes in, keys and bytes out: no identity loaded, no
// file read, no clock but the one stamped into the plaintext. It is
// correct in a node, in a relay and in a test, and it can be reasoned
// about without standing a box up.
//
// ── THE CONSTRUCTION ─────────────────────────────────────────────────
//
//   ephemeral-static X25519  →  HKDF-SHA256  →  AES-256-GCM
//
// The sender makes a THROWAWAY keypair for every message and discards the
// private half immediately. The packet carries the throwaway public key,
// the nonce and the ciphertext; the recipient's static seal key is the
// other half.
//
// NO SESSION AND NO HANDSHAKE, which is not a simplification but a
// requirement: a message may sit queued for days — Andy, on patience,
// *"could be days for a text message"* — and must still open when it
// arrives. Anything with a session would have to survive both ends
// restarting, and would turn store-and-forward into a liveness problem.
//
// ── WHAT THIS IS NOT: IT IS NOT FORWARD SECRECY ──────────────────────
//
// Said plainly because ephemeral-static reads like forward secrecy to
// somebody skimming, and this cycle exists for the developer skimming it.
//
// The SENDER discards its ephemeral, so a sender whose node is stolen
// later cannot read what it sent. The RECIPIENT's key is static, so a
// recipient whose node is stolen — or whose `identity.json` is copied —
// can be made to read **everything ever sent to them**, including
// messages still sitting in a queue. Rotating the seal key (cycle 10's R13) limits
// that to one key's worth of history and does not undo it.
//
// Andy's framing, on the limit of all of this: the spy thriller where the
// lover reads the screen over his shoulder. Sealing protects what leaves
// the machine. Past that line your key is a file your account can read.

const crypto = require('crypto');

// ── THE DOMAIN SEPARATOR ─────────────────────────────────────────────
//
// A constant that says what this key was derived FOR. Two protocols
// deriving from the same X25519 secret and differing only in how they use
// it is the classic way one becomes an oracle for the other; the label is
// free now and impossible to add later without a second flag day.
//
// The version rides in it on purpose: changing the construction changes
// this string, and every old message then fails to open LOUDLY rather
// than opening into something subtly wrong.
const LABEL = 'spirit-seal-v1';

const NONCE_BYTES = 12;   // GCM's own size; anything else is a footgun
const KEY_BYTES = 32;     // AES-256

function pubFrom(b64) {
  return crypto.createPublicKey({ key: Buffer.from(String(b64 || ''), 'base64'), format: 'der', type: 'spki' });
}
function privFrom(b64) {
  return crypto.createPrivateKey({ key: Buffer.from(String(b64 || ''), 'base64'), format: 'der', type: 'pkcs8' });
}

// ── WHAT THE OPENING IS BOUND TO ─────────────────────────────────────
//
//   Andy, on where the seal sits: "the hashing must sit outside of the
//   cyphering."
//
// A sealed blob that names nobody can be RE-ADDRESSED: lift it off the
// wire, sign it as yourself, send it to a third party, and their node
// opens it, because the maths works. Signing the ciphertext does not stop
// that — the signature is yours and it is valid. So sender and recipient
// are bound into the AEAD as associated data, and opening fails if either
// differs from the envelope that carried it. That is the difference
// between "this decrypts" and "this was sent to me, by them".
//
// THE RELAY IS DELIBERATELY NOT IN HERE, and this is the one line most
// likely to be "fixed" by a later session, so it is argued rather than
// asserted. Putting the carrying relay in the AAD would bind a message to
// one route — and a message may legitimately arrive by another: a partner
// carries it, a peer is reached on a different relay, a queued post goes
// out after the sender's relay list changed. It would make store-and-
// forward a routing promise, which is exactly what this design refuses to
// make.
//
// The gap that leaves — the same sealed blob replayed to the same
// recipient through a DIFFERENT relay, where the registered-hash guard
// has never seen it — is closed by the recipient's own replay index and
// the timestamp below (cycle 10's R17 and condition C2), which is where a
// replay defence belongs: with the one party who can tell.
function associated(fromKey, toKey) {
  return Buffer.from(LABEL + '\n' + String(fromKey || '') + '\n' + String(toKey || ''), 'utf8');
}

// The secret both sides reach, and the key derived from it. Derived
// rather than used raw: a raw X25519 output is not a uniformly
// distributed key, and HKDF is the one line that makes it one.
//
// The ephemeral public key and the recipient's static key go into the
// salt, so the derived key is bound to this exchange before the AEAD's
// associated data is even consulted. Belt and braces, and both free.
function derive(secret, ephemeralPub, toSealKey, fromKey, toKey) {
  const salt = Buffer.concat([
    Buffer.from(String(ephemeralPub), 'base64'),
    Buffer.from(String(toSealKey), 'base64'),
  ]);
  const info = associated(fromKey, toKey);
  return Buffer.from(crypto.hkdfSync('sha256', secret, salt, info, KEY_BYTES));
}

// ── THE SEALED DOCUMENT ──────────────────────────────────────────────
//
// What is encrypted is not the caller's bytes alone but `{ at, text }`,
// and the timestamp is put here rather than left to each caller for the
// reason C2 gives: a replay index must be BOUNDED by disc (cycle 9), so
// it will be trimmed, and at that moment old messages become replayable
// again — silently. A sender timestamp inside the seal lets anything
// older than the retention window be refused for age, so a hash may only
// leave the index once a message bearing it would be refused anyway.
//
// INSIDE THE SEAL, NOT IN THE ENVELOPE, which is the whole point: in the
// envelope it would leak when the message was written and be forgeable by
// whoever carried it. Here it is neither.
//
// A timestamp every caller has to remember is a timestamp that goes
// missing, so no caller is asked to.
function sealedDocument(text, at) {
  return JSON.stringify({ at: at, text: String(text) });
}

// ── SEAL ─────────────────────────────────────────────────────────────
//
// Answers the wire object, or null if the recipient's key is unusable —
// which is the sender's refusal (cycle 10's R5): no card, no key, no post. Never a
// plaintext fallback. A fallback would hand everything to an attacker who
// can withhold a card.
function seal(toSealKey, fromKey, toKey, text, now) {
  if (!toSealKey || !fromKey || !toKey) return null;
  let recipient;
  try { recipient = pubFrom(toSealKey); }
  catch (e) { return null; }

  const ephemeral = crypto.generateKeyPairSync('x25519');
  const ephemeralPub = ephemeral.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

  let secret;
  try { secret = crypto.diffieHellman({ privateKey: ephemeral.privateKey, publicKey: recipient }); }
  catch (e) { return null; }

  const key = derive(secret, ephemeralPub, toSealKey, fromKey, toKey);
  // Random, not a counter. A counter would have to survive restarts and be
  // per-recipient, and a nonce reused under one key is the one mistake
  // GCM does not forgive. With a fresh key per message the nonce is
  // carrying almost nothing anyway.
  const nonce = crypto.randomBytes(NONCE_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(associated(fromKey, toKey));
  const at = (now instanceof Date ? now : new Date()).toISOString();
  const body = Buffer.concat([
    cipher.update(Buffer.from(sealedDocument(text, at), 'utf8')),
    cipher.final(),
  ]);

  return {
    sealed: 1,
    e: ephemeralPub,
    n: nonce.toString('base64'),
    // Tag appended rather than carried beside: one field cannot be
    // separated from the bytes it authenticates by anything on the path.
    c: Buffer.concat([body, cipher.getAuthTag()]).toString('base64'),
  };
}

// Whether a packet's text is a sealed one. Deliberately structural and
// cheap: cycle 10's R5 refuses anything that is not sealed and is not a card, and a
// predicate that had to try decrypting to answer would be a predicate
// nobody could call on the receiving path.
function isSealed(value) {
  let v = value;
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch (e) { return false; }
  }
  return !!(v && v.sealed === 1 && v.e && v.n && v.c);
}

// ── OPEN ─────────────────────────────────────────────────────────────
//
// Answers `{ at, text }`, or null. Null for every failure and with no
// reason attached, because the reasons are indistinguishable to anybody
// who should be told: a tampered ciphertext, a blob addressed to somebody
// else, and a wrong key all mean the same thing here — this is not a
// message for you from them.
//
// NEVER OPENED BEFORE IT IS AUTHENTICATED. This function is third on the
// way in, after the hash is checked and the signature verified (cycle 10's R11), and
// it must stay there: opening first would mean doing cryptography on
// bytes nobody has vouched for.
function open(mySealPrivate, fromKey, toKey, value) {
  let v = value;
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch (e) { return null; }
  }
  if (!isSealed(v) || !mySealPrivate) return null;

  try {
    const secret = crypto.diffieHellman({
      privateKey: privFrom(mySealPrivate),
      publicKey: pubFrom(v.e),
    });
    // The recipient's own public half is what the sender salted with, and
    // it is recovered from the private key rather than taken from the
    // packet — taking it from the packet would let the sender choose it.
    const myPublic = crypto.createPublicKey(privFrom(mySealPrivate))
      .export({ type: 'spki', format: 'der' }).toString('base64');
    const key = derive(secret, v.e, myPublic, fromKey, toKey);

    const raw = Buffer.from(String(v.c), 'base64');
    if (raw.length < 17) return null;      // a tag and at least one byte
    const tag = raw.slice(raw.length - 16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(String(v.n), 'base64'));
    decipher.setAAD(associated(fromKey, toKey));
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([
      decipher.update(raw.slice(0, raw.length - 16)),
      decipher.final(),
    ]).toString('utf8');

    const doc = JSON.parse(plain);
    if (!doc || typeof doc.text !== 'string') return null;
    return { at: String(doc.at || ''), text: doc.text };
  } catch (e) {
    // `final()` throws when the tag does not hold, which is the check
    // doing its job. Swallowed to one answer, because a caller that
    // branches on WHY a seal failed is a caller leaking the difference.
    return null;
  }
}

module.exports = {
  LABEL: LABEL,
  seal: seal,
  open: open,
  isSealed: isSealed,
};
