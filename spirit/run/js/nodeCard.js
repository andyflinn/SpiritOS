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
  const id = auth.loadIdentity(rootDir);
  if (!id) return '';
  return JSON.stringify({
    v: 1,
    body: {
      ok: true,
      name: String(id.name || ''),
      description: String(id.description || ''),
    },
  });
}

module.exports = {
  asks: asks,
  describe: describe,
};
