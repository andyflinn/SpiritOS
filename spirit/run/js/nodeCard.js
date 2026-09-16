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

// Recognises the ask. An app-less system packet — the shape a relay's
// `answerSelf` already takes, so a node and a relay are asked the same way
// and neither had to grow a vocabulary for it.
function asks(text) {
  let parsed = null;
  try { parsed = JSON.parse(String(text || '')); }
  catch (e) { return false; }
  if (!parsed || parsed.app) return false;   // an app's packet is an app's
  const body = parsed.body;
  return !!(body && body.describe);
}

// The card. Answers a STRING, because that is what peerPost sends as the
// reply text, and the same envelope a relay answers in.
//
// `name` is what the identity was minted with and is not a public label:
// labels belong to relays, one each, and a node has as many as it has
// enrolments (R1). It is here because it is often the only word a fresh
// node has, and an empty card is worse than a weak one.
function describe(rootDir) {
  const card = read(rootDir);
  if (!card) return '';
  return JSON.stringify({
    v: 1,
    body: { ok: true, name: card.name, description: card.description },
  });
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
  read: read,
  setName: setName,
  setDescription: setDescription,
};
