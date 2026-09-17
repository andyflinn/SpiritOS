'use strict';

// Perception only. Lives on a personal node, never on a --relay.
// File: <rootDir>/relay-state/who.json
//
// [
//   {
//     "publicKey": "...",
//     "publicLabel": "john",
//     "myLabel": "lovelyJohn",
//     "relays": ["http://127.0.0.1:65410"]
//   }
// ]
//
// Identity = publicKey.
// publicLabel = their caption on a mailbox (may collide, may change).
// myLabel = your caption (never uploaded).
// relays = mailboxes where you have seen this key.
// acquiredVia = HOW this key got here, which is the difference between
//   somebody this node knows and somebody who merely claimed on the same
//   mailbox (CYCLE-CONTACTS-IMPL.md).
//
// A mailbox census is not an address book. Everyone who ever claimed on
// a public relay appears in `who`, and copying that into the To list
// makes "people I talk to" mean "people who exist" — which is how a
// friend ends up picking a stranger's john out of a list.
//
// So a row carries how it arrived, and only some ways count as knowing:
//
//   census  — seen in `who`. Not a contact. The default for a row with
//             no field at all, which is every row written before this,
//             since that is exactly what those rows were.
//   message — they wrote to you and the mailbox carried their key. Weak:
//             anyone the mailbox admits can write. Enough to reply to.
//   invite  — a token this node minted was consumed by that key.
//   handle  — a human confirmed the key out of band (cut 2).
//   member  — they hold a seat on a relay THIS NODE OWNS.
//
// Ranks never fall. A census sync may correct a publicLabel on a row you
// already know, and can never demote it back to a stranger.
//
// ── WHY `member` IS A RANK AND NOT A FLAG ────────────────────────────
//
//   Andy: "when someone binds to a peer i own, it's because i want them
//   in my network, so i want a contact auto-generated."
//
// It has to be a rank because ACQUIRED_LISTENING is what decides whether
// this node accepts somebody's mail at all. A member auto-added as
// `census` would be a contact this node refuses to hear from, which is
// the opposite of the point — the owner let them onto the box.
//
// TOP OF THE LADDER, above `handle`: a human confirming a key out of band
// is somebody's word about who they are; a seat on your own relay is your
// own act, recorded on a ledger you keep. And because ranks never fall,
// evicting somebody later leaves them an ordinary contact this node still
// listens to — which is right. You did let them in once.

const fs = require('fs');
const path = require('path');

const ACQUIRED_CENSUS = 'census';
const ACQUIRED_HOLD = 'hold';
const ACQUIRED_MEMBER = 'member';
const ACQUIRED_RANK = {
  census: 0, hold: 1, message: 2, invite: 3, handle: 4, member: 5,
};
// The ways of arriving that mean this node will listen. `hold` is not one
// of them: a held row exists so a human can see who is waiting and say
// yes, and until they do it is a name, not a correspondent.
const ACQUIRED_LISTENING = ['message', 'invite', 'handle', 'member'];

// A row with no field predates the field, and what it was is a census
// row: it was written by handshake from `who`.
function acquiredVia(row) {
  var via = row && row.acquiredVia;
  return Object.prototype.hasOwnProperty.call(ACQUIRED_RANK, via) ? via : ACQUIRED_CENSUS;
}

function acquiredRank(via) {
  return ACQUIRED_RANK[via] === undefined ? 0 : ACQUIRED_RANK[via];
}

// Blocked is a flag, not a rank. Blocking somebody must not erase HOW
// they were acquired — unblocking would otherwise have to invent a new
// answer — and it must outrank every way of arriving, including a key
// confirmed by phone. So it sits beside the rank rather than in it.
function isBlocked(row) {
  return !!(row && row.blocked);
}

// ── WHICH RELAYS OF MINE THIS KEY HOLDS A SEAT ON ────────────────────
//
//   Andy: "i may acquire the same contact through multiple relays i own.
//   the contact record must hold a LIST of relays i own and the contact
//   has a slot on them. the whoBook should have to reflect that."
//
// A LIST, for the reason he gives, and it is the whole boundary of this
// feature in one field:
//
//   non-empty  auto-created, and Forget must evict the seats first
//   empty      an ordinary contact, exactly as today
//
// So a peer reached through a PARTNER relay needs no special case: it is
// not a member of anything this node owns, so the list is empty and it
// behaves like every other contact —
//
//   Andy: "a peer who connects with me through a partner node behaves
//   independently as contact, same as non-relay-owners experience all
//   their contacts."
//
// And a node that owns no relay never has a non-empty one, so nothing in
// this feature is reachable for anybody who is not a relay owner.
//
// NOT THE SAME FIELD AS `relays`, which is "mailboxes where this key has
// been SEEN" and includes relays somebody else owns. This is a statement
// about seats on boxes that are mine, and only the reconcile writes it.
function memberOf(row) {
  var list = row && row.memberOf;
  return Array.isArray(list) ? list.slice() : [];
}

// Is this row here because of a seat I granted? The one question Forget
// asks, and it asks it of a LOCAL field — no network inside a permission
// check, which is the trap ownerBadge.canRemoveRelay documents at length.
function isMember(row) {
  return memberOf(row).length > 0;
}

// Whether this node listens to that row: acquired one of the ways that
// count, and not blocked. The one question the inbox asks.
function listens(row) {
  return ACQUIRED_LISTENING.indexOf(acquiredVia(row)) !== -1 && !isBlocked(row);
}

// Who this node listens to. What the inbox is filtered against.
function contacts(rootDir) {
  return load(rootDir).filter(listens);
}

// Everyone this node has a row for beyond the census: the people it
// listens to, plus the ones waiting to be accepted and the ones it has
// blocked. What the To list is built from — a held row that cannot be
// seen cannot be accepted, and a blocked row that vanishes cannot be
// unblocked.
function addressBook(rootDir) {
  return load(rootDir).filter(function (row) { return acquiredVia(row) !== ACQUIRED_CENSUS; });
}

function bookPath(rootDir) {
  return path.join(rootDir, 'relay-state', 'who.json');
}

function load(rootDir) {
  try {
    const parsed = JSON.parse(fs.readFileSync(bookPath(rootDir), 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function save(rootDir, rows) {
  fs.mkdirSync(path.join(rootDir, 'relay-state'), { recursive: true });
  fs.writeFileSync(bookPath(rootDir), JSON.stringify(rows, null, 2));
}

function normalizeRelays(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  list.forEach(function (url) {
    const u = String(url || '').replace(/\/+$/, '');
    if (u && out.indexOf(u) === -1) out.push(u);
  });
  return out;
}

function upsert(rootDir, row) {
  if (!row || !row.publicKey) throw new Error('publicKey required');
  const publicLabel = String(row.publicLabel || '').trim();
  const rows = load(rootDir);
  const i = rows.findIndex(function (r) { return r.publicKey === row.publicKey; });
  const prev = i === -1 ? { relays: [], myLabel: '' } : rows[i];
  const myLabel = String(
    row.myLabel != null ? row.myLabel : (prev.myLabel || publicLabel)
  ).trim();
  // Never downgrade: a key you confirmed by phone does not become a
  // stranger because the census mentioned it again.
  const wanted = row.acquiredVia === undefined ? acquiredVia(prev) : row.acquiredVia;
  const via = acquiredRank(wanted) >= acquiredRank(acquiredVia(prev)) ? wanted : acquiredVia(prev);

  const next = {
    publicKey: row.publicKey,
    publicLabel: publicLabel,
    myLabel: myLabel,
    acquiredVia: via,
    // Carried, never quietly cleared: a message from somebody you
    // blocked must not unblock them, and that is exactly the path that
    // would do it if this were dropped on every upsert.
    blocked: row.blocked === undefined ? isBlocked(prev) : !!row.blocked,
    relays: normalizeRelays(row.relays != null ? row.relays : prev.relays),
    // Carried like `blocked`, and set by the reconcile alone. Unlike the
    // rank above it CAN fall, and must: evicting somebody empties it, and
    // that is what turns them back into an ordinary deletable contact.
    memberOf: normalizeRelays(row.memberOf != null ? row.memberOf : prev.memberOf),
    // Carried like the rest, and cleared by the sweep the moment the key
    // turns up on a census again — a row that came back must not keep
    // wearing a warning.
    missingSince: String(
      row.missingSince != null ? row.missingSince : (prev.missingSince || '')
    ),
  };
  if (i === -1) rows.push(next);
  else rows[i] = next;
  save(rootDir, rows);
  return next;
}

// ── WHAT THE RECONCILE WRITES ────────────────────────────────────────
//
// The seats this key holds on relays I own, as the census last answered.
// Whole-list, never additive: a key that left a relay must lose that url,
// and an add-only field would keep somebody undeletable for ever on the
// strength of a seat they no longer have.
//
// Returns the row, or null for a key not in the book — the caller
// acquires first and sets this second, so a missing row is a bug rather
// than a state to paper over.
function setMemberOf(rootDir, publicKey, urls) {
  const rows = load(rootDir);
  const row = rows.find(function (r) { return r.publicKey === publicKey; });
  if (!row) return null;
  row.memberOf = normalizeRelays(urls);
  save(rootDir, rows);
  return row;
}

// ── WHEN THIS NODE FIRST FOUND THE KEY ON NO CENSUS ──────────────────
//
//   Andy: "show a warning bubble at the top of contact details if the
//   contact is an obvious dud... the bubble will show the reason."
//
// An ISO stamp, or '' for a key that is on a census somewhere. It is the
// date this node first CONCLUDED it was missing, not the date it went —
// the difference matters and the wording that reads it has to say so,
// because nothing here watched before the conclusion was possible.
//
// WHY A DATE AND NOT A FLAG. "Not on any census" is worth acting on in
// proportion to how long it has been true: a key that vanished an hour
// ago may be an owner mid-edit, and one that has been gone since March is
// a lab node somebody wiped. A boolean cannot tell those apart, and the
// person deciding whether to delete a row needs to.
function setMissing(rootDir, publicKey, whenIso) {
  const rows = load(rootDir);
  const row = rows.find(function (r) { return r.publicKey === publicKey; });
  if (!row) return null;
  const next = String(whenIso || '');
  if (String(row.missingSince || '') === next) return row;
  row.missingSince = next;
  save(rootDir, rows);
  return row;
}

function missingSince(row) {
  return String((row && row.missingSince) || '');
}

function setMyLabel(rootDir, publicKey, myLabel) {
  const rows = load(rootDir);
  const row = rows.find(function (r) { return r.publicKey === publicKey; });
  if (!row) return null;
  row.myLabel = String(myLabel || '').trim();
  save(rootDir, rows);
  return row;
}

function byMyLabel(rootDir, myLabel) {
  const want = String(myLabel || '').trim();
  return load(rootDir).filter(function (r) { return r.myLabel === want; });
}

function byPublicKey(rootDir, publicKey) {
  return load(rootDir).find(function (r) { return r.publicKey === publicKey; }) || null;
}

// Seeing somebody in a census. This keeps a row's public caption and its
// routes current and NOTHING else: it never promotes a stranger into the
// address book, and it never touches how an existing row was acquired.
function handshake(rootDir, peer) {
  if (!peer || !peer.publicKey) throw new Error('handshake needs publicKey');
  const publicLabel = peer.publicLabel || '';
  const existing = byPublicKey(rootDir, peer.publicKey);
  if (existing) {
    existing.publicLabel = publicLabel || existing.publicLabel;
    if (peer.relay) {
      existing.relays = normalizeRelays((existing.relays || []).concat([peer.relay]));
    }
    const rows = load(rootDir).map(function (r) {
      return r.publicKey === existing.publicKey ? existing : r;
    });
    save(rootDir, rows);
    return existing;
  }
  return upsert(rootDir, {
    publicKey: peer.publicKey,
    publicLabel: publicLabel,
    myLabel: publicLabel,
    acquiredVia: ACQUIRED_CENSUS,
    relays: peer.relay ? [peer.relay] : [],
  });
}

// Coming to know somebody: they wrote to you, they consumed an invite of
// yours, or a human confirmed the key out of band. Upgrades a census row
// in place rather than making a second one — identity is the key, and
// there is only ever one row per key.
function acquire(rootDir, peer, via) {
  if (!peer || !peer.publicKey) throw new Error('acquire needs publicKey');
  const existing = byPublicKey(rootDir, peer.publicKey);
  return upsert(rootDir, {
    publicKey: peer.publicKey,
    publicLabel: peer.publicLabel || (existing && existing.publicLabel) || '',
    acquiredVia: via,
    relays: peer.relay
      ? normalizeRelays(((existing && existing.relays) || []).concat([peer.relay]))
      : (existing && existing.relays),
  });
}

// Somebody wrote and this node is holding them: a row so a human can
// see there is somebody there, and nothing more. Never a downgrade — a
// contact who writes again is still a contact.
function hold(rootDir, peer) {
  return acquire(rootDir, peer, ACQUIRED_HOLD);
}

// Block silences a row without forgetting it. Unblock is the same call,
// which is why this takes the value rather than being two functions: the
// row has to stay visible either way, or there is no way back.
function setBlocked(rootDir, publicKey, blocked) {
  const rows = load(rootDir);
  const row = rows.find(function (r) { return r.publicKey === publicKey; });
  if (!row) return null;
  row.blocked = !!blocked;
  save(rootDir, rows);
  return row;
}

// Saying yes to somebody who was waiting. They wrote to this node and a
// human agreed to hear them, which is exactly what `message` means — so
// accepting does not inflate into `handle`, which is reserved for a key
// confirmed out of band. An already-acquired row keeps its rank and only
// loses the block.
function accept(rootDir, publicKey) {
  const existing = byPublicKey(rootDir, publicKey);
  if (!existing) return null;
  setBlocked(rootDir, publicKey, false);
  if (acquiredVia(existing) === ACQUIRED_HOLD) {
    return acquire(rootDir, { publicKey: publicKey, publicLabel: existing.publicLabel }, 'message');
  }
  return byPublicKey(rootDir, publicKey);
}

// What YOU call that key. myLabel if you have one, else the caption the
// mailbox shows, else the key itself — a peer is never nameless, because
// a row with no caption is a row nobody can pick.
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
// There was none. Block silences a row and KEEPS it — deliberately, so
// unblocking is the same call with the other value — and that is the right
// shape for "not from this person". It is the wrong shape for "I added the
// wrong one", which until now had no answer at all.
//
// WHAT IT DOES NOT DO is make them unfindable. If they are on a relay this
// node is on, they are in its census, and the next search will show them
// again as somebody you could add. That is correct and worth saying: this
// forgets YOUR side of a relationship, and a relay's census is not yours
// to edit.
//
// WHAT IT ALSO DOES NOT DO is unblock them. A blocked row that is simply
// deleted comes back the moment they write, admitted, because the thing
// that refused them was the row. So a blocked row is kept and only
// DOWNGRADED — the block survives, the acquaintance does not.
function forget(rootDir, publicKey) {
  const rows = load(rootDir);
  const at = rows.findIndex(function (r) { return r.publicKey === publicKey; });
  if (at === -1) return null;

  if (isBlocked(rows[at])) {
    rows[at] = {
      publicKey: rows[at].publicKey,
      publicLabel: rows[at].publicLabel || '',
      acquiredVia: ACQUIRED_CENSUS,
      blocked: true,
    };
    save(rootDir, rows);
    return rows[at];
  }

  rows.splice(at, 1);
  save(rootDir, rows);
  return { publicKey: publicKey, forgotten: true };
}

function addRoute(rootDir, publicKey, relayUrl) {
  const url = String(relayUrl || '').replace(/\/+$/, '');
  if (!url) return null;
  const rows = load(rootDir);
  const row = rows.find(function (r) { return r.publicKey === publicKey; });
  if (!row) return null;
  row.relays = normalizeRelays((row.relays || []).concat([url]));
  save(rootDir, rows);
  return row;
}

module.exports = {
  forget: forget,
  CENSUS: ACQUIRED_CENSUS,
  HOLD: ACQUIRED_HOLD,
  MEMBER: ACQUIRED_MEMBER,
  memberOf: memberOf,
  isMember: isMember,
  setMemberOf: setMemberOf,
  missingSince: missingSince,
  setMissing: setMissing,
  load: load,
  contacts: contacts,
  addressBook: addressBook,
  listens: listens,
  isBlocked: isBlocked,
  hold: hold,
  setBlocked: setBlocked,
  accept: accept,
  acquiredVia: acquiredVia,
  acquire: acquire,
  upsert: upsert,
  setMyLabel: setMyLabel,
  byMyLabel: byMyLabel,
  byPublicKey: byPublicKey,
  handshake: handshake,
  labelForKey: labelForKey,
  addRoute: addRoute,
};
