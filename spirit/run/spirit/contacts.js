'use strict';

// spirit/run/spirit/contacts.js — the owner's acts on the one table.
//
// ── IT WAS contacts.json UNTIL goal/G40.11 ──────────────────────────
//
//   Andy's box, v24: "seen, the shadow in node.db, is the one table. contacts.json, the relays table and the peers
//   table move into it and go."
//
// A contact is a row of seen flagged `keep`: "a chosen contact, never shed". Somebody waiting for the owner's yes is
// `held`, somebody refused is `blocked`, a node whose signed card names this one its owner is `mine`. The file is
// gone (nodeStore moved it in on the first start); this module keeps the rules the book had, as acts on those flags.
// Perception only. Lives on a personal node, never on a --relay.
//
// A contact row, as every reader here gets it:
//
//   { publicKey, publicLabel, myLabel, card, keep, mine, held, blocked, relay, seated, ignored, present, lastSeen }
//
// Identity = publicKey. publicLabel = their caption on a relay (may collide, may change). myLabel = your caption
// (never uploaded). acquiredVia, the ladder of how a key arrived, went with the box ("Gone: acquiredVia"): kept is
// the one question the front door asks, and a row's history is not a reason to hear somebody.
//
// A MAILBOX ROLL IS NOT AN ADDRESS BOOK. A row in the table is somebody this node has heard of; only a kept one is
// somebody it listens to. A search finds people, and only the owner's act (Add, accept, a claim on a relay this node
// owns, an invite) keeps them.

const nodeCard = require('./nodeCard');
const auth = require('./relayAuth');
const ownerBadge = require('./ownerBadge');

function seen(rootDir) { return require('./nodeStore').open(rootDir).seen; }

// A table row as a contact row; null for no row.
function shaped(r) {
  if (!r) return null;
  return {
    publicKey: r.publicKey, publicLabel: r.label || '', myLabel: r.myLabel || '', card: r.card || '',
    keep: r.keep, mine: r.mine, held: r.held, blocked: r.blocked, relay: r.relay, seated: r.seated, ignored: r.ignored,
    present: r.present, lastSeen: r.lastSeen,
  };
}

// Blocked is a flag, not a rank: it outranks every way of arriving, including a key confirmed by phone, and it must
// not erase whether somebody was kept, or unblocking would have to invent an answer. So it sits beside keep.
function isBlocked(row) {
  return !!(row && row.blocked);
}

// Whether this node listens to that row: kept or owned, and not blocked. The one question the inbox asks.
function listens(row) {
  return !!(row && (row.keep || row.mine) && !row.blocked);
}

// Everyone the owner's list shows: the kept and owned it listens to, the held waiting to be accepted, and the
// blocked, who have to stay visible to be unblocked. A row you cannot see is a decision you cannot reverse.
function load(rootDir) {
  const S = seen(rootDir);
  const out = [];
  const have = Object.create(null);
  S.listed().concat(S.flagged('blocked')).forEach(function (r) {
    if (have[r.publicKey]) return;
    have[r.publicKey] = true;
    out.push(shaped(r));
  });
  return out;
}
function addressBook(rootDir) { return load(rootDir); }

// Who this node listens to. What the inbox is filtered against.
function contacts(rootDir) {
  return load(rootDir).filter(listens);
}

// Any row of the table for that key, kept or not: the front door asks it whether a key is blocked, a post asks it
// for the card to seal to.
function byPublicKey(rootDir, publicKey) {
  return shaped(seen(rootDir).get(String(publicKey == null ? '' : publicKey)));
}

function byMyLabel(rootDir, myLabel) {
  const want = String(myLabel || '').trim();
  return load(rootDir).filter(function (r) { return r.myLabel === want; });
}

// What they call themselves, as the caller heard it: written greedily by the shadow's rule (a name is kept unless a
// better-sourced one arrives), at hearsay, since a caller here names somebody rather than proving them. NOT A
// SIGHTING: naming a key is not seeing it, so lastSeen stays what it was (0 for a key never seen), and shedding is
// not skewed by a pasted name.
function noteLabel(rootDir, publicKey, publicLabel) {
  const label = String(publicLabel || '').trim();
  if (!label) return;
  const was = seen(rootDir).get(publicKey);
  seen(rootDir).put(publicKey, { label: label, labelRank: 4, labelAt: Date.now(), seen: was ? was.lastSeen : 0 });
}

// The relay they were met on, as a route to them through it: at hearsay, since nobody has proved it yet. A better
// route outranks it the moment one arrives.
function noteRelay(rootDir, publicKey, relayUrl) {
  const url = String(relayUrl || '').replace(/\/+$/, '');
  if (!url) return;
  const at = require('./relayKeys').pinned(rootDir, url);
  if (at) seen(rootDir).putRoute(publicKey, { via: at, at: at, url: url, rank: 4, told: Date.now() });
}

// Coming to know somebody: they wrote to you, they consumed an invite of yours, a human confirmed the key, or they
// took a seat on a relay you own. Kept, and no longer held. One row per key: identity is the key.
function acquire(rootDir, peer) {
  if (!peer || !peer.publicKey) throw new Error('acquire needs publicKey');
  noteLabel(rootDir, peer.publicKey, peer.publicLabel);
  noteRelay(rootDir, peer.publicKey, peer.relay);
  return shaped(seen(rootDir).set(peer.publicKey, { keep: true, held: false }));
}

// Somebody wrote and this node is holding them: a row so a human can see there is somebody there, and nothing more.
// Never a downgrade — a contact who writes again is still a contact.
function hold(rootDir, peer) {
  if (!peer || !peer.publicKey) throw new Error('hold needs publicKey');
  noteLabel(rootDir, peer.publicKey, peer.publicLabel);
  noteRelay(rootDir, peer.publicKey, peer.relay);
  const was = seen(rootDir).get(peer.publicKey);
  if (was && (was.keep || was.mine)) return shaped(was);
  return shaped(seen(rootDir).set(peer.publicKey, { held: true }));
}

// Block silences a row without forgetting it. Unblock is the same call, which is why this takes the value rather than
// being two functions: the row has to stay visible either way, or there is no way back. Any key can be blocked, a
// relay as well as a node (box v24): the row is made when there is none.
function setBlocked(rootDir, publicKey, blocked) {
  if (!publicKey) return null;
  return shaped(seen(rootDir).set(publicKey, { blocked: !!blocked }));
}

// Saying yes to somebody who was waiting: kept, unblocked. An already-kept row keeps its place and only loses the
// block.
function accept(rootDir, publicKey) {
  const was = seen(rootDir).get(publicKey);
  if (!was) return null;
  return shaped(seen(rootDir).set(publicKey, { keep: true, held: false, blocked: false }));
}

function setMyLabel(rootDir, publicKey, myLabel) {
  if (!seen(rootDir).get(publicKey)) return null;
  return shaped(seen(rootDir).set(publicKey, { myLabel: String(myLabel || '').trim() }));
}

// What YOU call that key. myLabel if you have one, else the caption the mailbox shows, else the key itself — a peer
// is never nameless, because a row with no caption is a row nobody can pick.
function labelForKey(rootDir, publicKey, fallbackPublicLabel) {
  const row = byPublicKey(rootDir, publicKey);
  const mine = row && String(row.myLabel || '').trim();
  if (mine) return mine;
  const theirs = String((row && row.publicLabel) || fallbackPublicLabel || '').trim();
  if (theirs) return theirs;
  return String(publicKey || '');
}

// ── FORGETTING SOMEBODY, WHICH IS NOT BLOCKING THEM ──────────────────
//
//   Andy: "i also have no method of removing sonny from my contacts so i
//   could re-test easily."
//
// Forget takes YOUR side of a relationship: not kept, not held, no name of yours. The row stays in the table, routes
// and card with it — Andy: "a shadow route must not be dropped when a contact is deleted" — so re-adding somebody
// gets their route back without a search.
//
// IT DOES NOT UNBLOCK THEM. A blocked row loses the acquaintance and keeps the block, because the flag IS the
// refusal: clearing it would readmit the person the moment they wrote.
function forget(rootDir, publicKey) {
  const was = seen(rootDir).get(publicKey);
  if (!was || !(was.keep || was.held || was.blocked || was.myLabel)) return null;
  const row = seen(rootDir).set(publicKey, { keep: false, held: false, myLabel: '' });
  if (row.blocked) return shaped(row);
  return { publicKey: publicKey, forgotten: true };
}

// ── THE CARD ON THE ROW (cycle 10, R3) ───────────────────────────────
//
// A card is kept on the row so that sealing a message needs no second fetch: the key everything is sealed to is on
// the row beside the key everything is verified against.
//
// THE SIGNED BLOB IS STORED, NOT THE TWO KEYS READ OUT OF IT (C3): accountability exists only if somebody can
// produce the contradiction, and a few hundred bytes per row turns a deterrent into evidence.
//
// ── THIS IS TRUST ON FIRST USE, AND IT IS NAMED AS THAT ──────────────
//
// A card signed by the key it introduces proves only INTERNAL CONSISTENCY. If the first card a node ever sees for a
// peer comes from the relay, a hostile relay hands over its own keys for both sides and every signature verifies.
// What is detected is a key CHANGING afterwards.

// What a row's card SAYS, verified from its own bytes every time it is read. Nothing in the tree may read a field
// off a stored card except through here: a blob checked when written and trusted blindly afterwards is a blob anybody
// who can write the disc can edit.
function cardOf(row) {
  if (!row || !row.card) return null;
  const fields = nodeCard.verify(row.card);
  // Shown only signed by the row's ID (box v24).
  return fields && fields.publicKey === row.publicKey ? fields : null;
}

// The key a message to this contact is sealed to, or null — which is the sender's refusal (cycle 10's R5): no card,
// no post.
function sealKeyOf(row) {
  const card = cardOf(row);
  return (card && card.sealKey) || null;
}

// ── AND THE ONE DOOR THAT WRITES IT ──────────────────────────────────
//
//   { ok: true, first }                stored
//   { ok: false, why: 'not a card' }   the signature does not hold
//   { ok: false, why: 'wrong key' }    A CARD FOR SOMEBODY ELSE
//   { ok: false, why: 'not newer' }    a rollback (cycle 10's R13, condition C1)
//
// "A card is valid only signed by the row's ID; any other is refused and nothing of it kept" (box v24). The row is
// made when there is none: a card this node asked for is its own act about a key it chose to look up, and a row of
// the table is not a contact (only keep is).
function setCard(rootDir, publicKey, cardText) {
  const fields = nodeCard.verify(cardText);
  if (!fields) return { ok: false, why: 'not a card' };
  if (fields.publicKey !== publicKey) return { ok: false, why: 'wrong key', signedBy: fields.publicKey };
  const held = cardOf(byPublicKey(rootDir, publicKey));
  // A COUNTER THAT ONLY GOES UP (C1). A validly signed OLD card can be re-served after a rotation and it will verify —
  // a downgrade needing no forgery, only a copy. Strictly greater, so replaying the card we hold is refused too.
  if (held && !(fields.at > held.at)) {
    return { ok: false, why: 'not newer', held: held.at, offered: fields.at };
  }
  // OWNED, BY THE RULE A RELAY IS OWNED BY (goal/G19.8): mine, from the newest verified card. Andy, 2026-10-12:
  // "puppet is just a flag in the contact list", "so the relays owner code and the puppets owner code should be the
  // same." Only a newer card naming another owner, or none, sets it false.
  seen(rootDir).set(publicKey, {
    card: String(cardText),
    mine: ownerBadge.ownedBy(fields.owner, auth.loadIdentity(rootDir).publicKey),
  });
  return { ok: true, first: !held, at: fields.at };
}

module.exports = {
  forget: forget,
  load: load,
  contacts: contacts,
  addressBook: addressBook,
  listens: listens,
  isBlocked: isBlocked,
  hold: hold,
  setBlocked: setBlocked,
  accept: accept,
  acquire: acquire,
  noteLabel: noteLabel,
  setCard: setCard,
  cardOf: cardOf,
  sealKeyOf: sealKeyOf,
  setMyLabel: setMyLabel,
  byMyLabel: byMyLabel,
  byPublicKey: byPublicKey,
  labelForKey: labelForKey,
};
