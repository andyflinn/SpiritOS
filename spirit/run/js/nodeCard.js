'use strict';

// spirit/run/js/nodeCard.js
// WHAT A NODE ANSWERS ABOUT ITSELF, TO ANYBODY WHO ASKS.
//
//   Andy: "the node should have a verb that is always answered like name
//   or description, that'll be the first two relay peerPost to test, the
//   description is what I want to replace the ugly end-of-key stuff with
//   in the UI."
//
// ── THIS OPENS A DOOR THAT WAS DELIBERATELY SHUT ─────────────────────
//
// design/relay/PARTNERS.md, tier three, recorded that a relay answers
// questions about itself (`answerSelf`) and a NODE answers nothing, and
// left it that way on purpose: crossing that line changes what a node is.
// Today it receives messages; afterwards it answers questions, and "what
// are you running" is the same shape as "who are you".
//
// It is opened here for the mildest case there is, and that is the whole
// argument for opening it at all: a description is the thing you WANT a
// stranger to read. It is what replaces a key ending in a list — six
// characters somebody reads down a telephone, which UI_DESIGN_STYLE §6
// only ever defended as the answer when there was nothing better.
//
// ── ALWAYS ANSWERED, WHICH IS THE POINT AND THE RISK ─────────────────
//
// Every other thing a node answers is gated on the front door's verdict:
// `peerPost` will not compose a reply for a sender it would not hear from,
// because that would put the door's judgement behind a verb. This one runs
// IN FRONT of that gate, because a card you only show to people you
// already know is not a card — the person asking is usually a stranger
// deciding whether to add you.
//
// What that costs, said plainly rather than discovered later:
//
//   - Anyone holding a valid key can confirm this node is awake. The relay
//     already publishes presence to its members, so this is not new.
//   - Anyone holding a valid key can make this node compose one small
//     reply. The relay rate-limits posts and the reply is bounded by the
//     description cap, so it is a poor amplifier.
//   - The description is PUBLIC. Not to the relay — this never leaves the
//     node except as an answer — but to anybody who asks, which is the
//     same reach as a public label and should be said in the words the
//     owner types it into.
//
// WHAT IT IS NOT. Not a general query surface. It answers `{describe:true}`
// and nothing else; every other system packet falls through to the gate it
// always had. Adding a second question here is a decision about what a
// node is, and deserves the argument this one got.

const auth = require('./relayAuth');
const labelRule = require('./labelRule');

// ── ONE NAME FOR ONE THING (cycle 10, R1) ────────────────────────────
//
//   Andy, 2026-09-23: "why have two calls for what could be one only?" —
//   and, on the answer: "card & description".
//
// It was one call wearing two names: the request said `describe`, the
// answer was composed by `answerCard`, and the module is `nodeCard.js`.
// Nothing was abandoned to fix that — **the description was always a
// FIELD of the card** — and the wire word is now `card` on both sides.
//
// Free to rename today only because of the flag day (cycle 10, R6): old
// nodes must update to stay in the game, so a word that disagrees with
// itself costs nothing to correct now and can never be corrected this
// cheaply again.
function asks(text) {
  let parsed = null;
  try { parsed = JSON.parse(String(text || '')); }
  catch (e) { return false; }
  if (!parsed || parsed.app) return false;   // an app's packet is an app's
  const body = parsed.body;
  return !!(body && body.card);
}

// ── WHAT A CARD CARRIES, AND WHY EACH FIELD IS IN THE SIGNATURE ─────
//
// The card introduces a node to somebody who has never met it, and after
// cycle 10 it introduces the key everything they ever send will be sealed
// to. So it is signed by the identity key, over every field, and it
// verifies FROM ITS OWN BYTES — no trust in whoever handed it over.
//
// The reason is measured rather than assumed: a reply's signature covers
// `receiptMessage(hash, minute)` — the hash and a clock minute, NOT the
// text (relayAuth.js). So a relay could rewrite a card in flight today
// without breaking anything: hand over its own cipher key, have the
// sender seal to it, read everything and re-seal onward. Encryption built
// on an unsigned card is encryption addressed to whoever forwards it.
//
//   name         what the identity was minted with, not a public label —
//                labels belong to relays, one each, and a node has as
//                many as it has enrolments. It is here because it is
//                often the only word a fresh node has, and an empty card
//                is worse than a weak one
//   description  the owner's own sentence about this node
//   publicKey    the identity — in the signed bytes on purpose, so the
//                blob is self-contained and can be checked without the
//                envelope that carried it
//   sealKey      what messages to this node are sealed to
//   at           a counter that only goes up (cycle 10, C1)
//
// `at` IS THE ONE THAT LOOKS OPTIONAL AND IS NOT. wsl-claude, reviewing:
// if newness were decided by arrival order or position in the roll, **the
// relay would decide which card is newer**, and could roll a peer back to
// a superseded cipher key — possibly the very key whose compromise caused
// the rotation. A number inside the signature is what takes that decision
// away from it. A receiver refuses anything not strictly greater than
// what it holds.
function cardFields(id) {
  return {
    name: String(id.name || ''),
    description: String(id.description || ''),
    publicKey: String(id.publicKey || ''),
    sealKey: String(id.sealPublicKey || ''),
    at: Number(id.cardAt || 1),
  };
}

// THE BYTES THAT ARE SIGNED, in one place, so the signer and the verifier
// cannot drift apart. Ordered explicitly rather than by JSON.stringify's
// key order, because that order is an implementation detail and this is a
// wire format.
function signable(fields) {
  return 'card\n' +
    fields.name + '\n' +
    fields.description + '\n' +
    fields.publicKey + '\n' +
    fields.sealKey + '\n' +
    fields.at;
}

// The card as it travels: the fields, and a signature over exactly those
// bytes. Answers a STRING, because that is what peerPost sends as the
// reply text, and the same envelope a relay answers in.
function describe(rootDir) {
  const id = auth.loadIdentity(rootDir);
  if (!id || !id.privateKey) return '';
  const fields = cardFields(id);
  return JSON.stringify({
    v: 1,
    body: Object.assign({ ok: true }, fields, {
      sig: auth.sign(id.privateKey, signable(fields)),
    }),
  });
}

// ── AND THE CHECK, WHICH IS THE WHOLE POINT ──────────────────────────
//
// Returns the card's fields when the signature holds over exactly those
// bytes, and null otherwise. A caller that skips this has a card that
// proves nothing — so nothing in the tree may read a field off a card
// without coming through here.
//
// It does NOT decide whether this card supersedes one already held: that
// is the shadow roll's, where both keys are protected (cycle 10, R13).
// This answers one question only — are these fields the ones their owner
// signed?
function verify(text) {
  let parsed = null;
  try { parsed = JSON.parse(String(text || '')); }
  catch (e) { return null; }
  const body = parsed && parsed.body;
  if (!body || !body.publicKey || !body.sig) return null;
  const fields = {
    name: String(body.name || ''),
    description: String(body.description || ''),
    publicKey: String(body.publicKey || ''),
    sealKey: String(body.sealKey || ''),
    at: Number(body.at || 0),
  };
  // A card with no counter is a card from before this cycle, and the flag
  // day says those do not travel. Refused rather than defaulted, because
  // a default would be a number the signer never chose.
  if (!(fields.at > 0)) return null;
  if (!auth.verify(fields.publicKey, signable(fields), body.sig)) return null;
  return fields;
}

// ── THE SAME CARD, READ AT HOME ──────────────────────────────────────
//
//   Andy: "i want an intrinsic app info, in which, for now the user can
//   maintain both fields in this file, more to come."
//
// The owner's own view of what strangers are told. It is deliberately the
// SAME function the wire answer is built from — an editor that reads the
// fields through a second path is an editor that can show you something
// other than what is being sent, and this is a file whose whole purpose
// is that somebody can see what their node says about them.
//
// `publicKey` rides along because it is the one field here nobody may
// edit, and a screen about your identity that cannot show it is coy about
// the only part that IS the identity.
function read(rootDir) {
  const id = auth.loadIdentity(rootDir);
  if (!id) return null;
  return {
    name: String(id.name || ''),
    description: String(id.description || ''),
    publicKey: String(id.publicKey || ''),
    descriptionMax: labelRule.DESCRIPTION_MAX_BYTES,
  };
}

// ── A NODE THAT HAS NEVER BEEN DESCRIBED DESCRIBES ITSELF ────────────
//
//   Andy: "lots of empty node-descriptions right now. the node assigns
//   the first name when redeeming an invite. but on boot: the node should
//   fill the description 'this node described for the first time [date /
//   time string].' this gives likely different strings by default."
//
// THE PROBLEM IS SAMENESS, NOT EMPTINESS. An empty description is honest
// — nobody has written one — but a list of strangers all saying nothing
// is a list you cannot read, which is the job key endings were doing and
// the job this was built to take over. A timestamp is not a description
// of anything; what it IS is different from the next node's, which is the
// entire property being asked for.
//
// ONCE, AND ONLY INTO A GAP. It runs on every boot and writes on the
// first: after that the field is non-empty and this does nothing, so a
// description somebody typed is never overwritten by a restart, and one
// they deliberately CLEARED is filled again on the next boot — which is
// the right way round. Blank is the state this exists to end.
//
// TO THE SECOND. Not milliseconds: this is read by a person, off a screen
// where it stands in for somebody's name, and two nodes minted in the
// same second is a collision worth having over a string with a decimal
// point in it. UTC and spelled out, because the reader may be anywhere.
//
// A RELAY DOES NOT GET ONE. Its identity.json holds its public label
// (relay.setRelayLabel) and it answers `answerSelf`, not a card — see the
// caller in server.js, which is inside the personal-node branch.
function firstDescription(now) {
  const at = (now instanceof Date ? now : new Date()).toISOString();
  // 2026-09-17T14:23:07.123Z -> 2026-09-17 14:23:07 UTC
  return 'this node described for the first time ' +
    at.slice(0, 10) + ' ' + at.slice(11, 19) + ' UTC';
}

function ensureDescription(rootDir, now) {
  const id = auth.loadIdentity(rootDir);
  if (!id) return '';
  if (String(id.description || '').trim()) return String(id.description);

  const said = firstDescription(now);
  // Through the ordinary setter, so the one thing written without a human
  // present obeys every rule a human's would — the cap, the normalising,
  // and whatever is added to them later.
  const saved = auth.setDescription(rootDir, said);
  return saved ? String(saved.description || '') : '';
}

// ── AND WRITTEN ──────────────────────────────────────────────────────
//
// Both fields go through labelRule, which is the rule the RELAY enforces
// on a rename (relay.setRelayLabel) — so a node names itself under the
// same law a mailbox does, rather than under whatever this file felt like.
//
// A NAME IS REQUIRED, and the refusal is not cosmetic: deviceTick declines
// enrolment outright when `id.name` is empty, so a node that let somebody
// clear this field would break phone attachment from a text box that said
// nothing about phones.
function setName(rootDir, text) {
  const id = auth.loadIdentity(rootDir);
  if (!id) return { ok: false, status: 409, error: 'this node has no key yet' };

  const bad = labelRule.problem(text);
  if (bad) return { ok: false, status: 400, error: bad };

  id.name = labelRule.normalize(text);
  try { auth.saveIdentity(rootDir, id); }
  catch (e) { return { ok: false, status: 500, error: 'could not write identity.json' }; }
  return { ok: true, status: 200, name: id.name };
}

// THE LENGTH IS NOT REFUSED HERE EITHER. relayAuth trims to fit and says
// why; this checks what is left — the invisible, which is the same
// impersonation in a description as in a name, and in the same row.
function setDescription(rootDir, text) {
  const bad = labelRule.describeProblem(text);
  if (bad) return { ok: false, status: 400, error: bad };

  const saved = auth.setDescription(rootDir, labelRule.normalize(text));
  if (!saved) return { ok: false, status: 409, error: 'this node has no key yet' };
  // WHAT WAS ACTUALLY STORED goes back, not what was sent. A caller that
  // echoes its own input is a caller that will draw 140 characters into a
  // field holding 128.
  return { ok: true, status: 200, description: String(saved.description || '') };
}

module.exports = {
  asks: asks,
  describe: describe,
  verify: verify,
  signable: signable,
  read: read,
  ensureDescription: ensureDescription,
  firstDescription: firstDescription,
  setName: setName,
  setDescription: setDescription,
};
