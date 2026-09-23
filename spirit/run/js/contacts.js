'use strict';

// spirit/run/js/contacts.js — the contact storage.
//
// ── IT WAS whoBook.js UNTIL 2026-09-18 ──────────────────────────────
//
//   Andy: "i want to erase the whole whoBook nonsense — it's like: what
//   the hell is that. It's the contacts.json, the contact storage."
//
// `who` was the ROLL's word: GET /api/relay/who, everyone who ever
// claimed on a relay. This file's first paragraph below is an argument
// that it is NOT that — "a mailbox roll is not an address book" — and
// it was named after the thing it exists to keep out.
//
// That is not a cosmetic complaint. `peer.list` spent as long as the two
// wore one name pouring the roll into this file on every Contacts
// refresh, as roll-rank rows, for people the node would then refuse to
// hear from. A name that argues with its own purpose is how that goes
// unnoticed.
//
// The store it writes was renamed the same day (who.json -> contacts.json,
// see bookPath); callers bind it as `contactBook`, because the module
// exports `contacts()` — who this node listens to — and a binding of the
// same name would shadow it.
//
// Perception only. Lives on a personal node, never on a --relay.
// File: <rootDir>/relay-state/contacts.json (was who.json until
//       2026-09-18 — see bookPath)
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
// A mailbox roll is not an address book. Everyone who ever claimed on
// a public relay appears in `who`, and copying that into the To list
// makes "people I talk to" mean "people who exist" — which is how a
// friend ends up picking a stranger's john out of a list.
//
// So a row carries how it arrived, and only some ways count as knowing:
//
//   roll    — seen in `who`. Not a contact. The default for a row with
//             no field at all, which is every row written before this,
//             since that is exactly what those rows were.
//   message — they wrote to you and the mailbox carried their key. Weak:
//             anyone the mailbox admits can write. Enough to reply to.
//   invite  — a token this node minted was consumed by that key.
//   handle  — a human confirmed the key out of band (cut 2).
//   member  — they hold a seat on a relay THIS NODE OWNS.
//
// Ranks never fall. A roll sync may correct a publicLabel on a row you
// already know, and can never demote it back to a stranger.
//
// ── WHY `member` IS A RANK AND NOT A FLAG ────────────────────────────
//
//   Andy: "when someone binds to a peer i own, it's because i want them
//   in my network, so i want a contact auto-generated."
//
// It has to be a rank because ACQUIRED_LISTENING is what decides whether
// this node accepts somebody's mail at all. A member auto-added as
// `roll` would be a contact this node refuses to hear from, which is
// the opposite of the point — the owner let them onto the box.
//
// TOP OF THE LADDER, above `handle`: a human confirming a key out of band
// is somebody's word about who they are; a seat on your own relay is your
// own act, recorded on a ledger you keep. And because ranks never fall,
// evicting somebody later leaves them an ordinary contact this node still
// listens to — which is right. You did let them in once.

const fs = require('fs');
const path = require('path');

// ── IT WAS `census` UNTIL 2026-09-23 (cycle 10, R18) ─────────────────
//
//   Andy: "i hate the word census now, but for the relay it's true. so
//   the relay is the keeper of cards, in the database, on disc... and the
//   relay can't falsify the record in the member roll (not census)?" —
//   then, deciding it: "we loose census from the dictionary."
//
// A census is something a counter performs on a population. A roll is a
// list a body keeps of its own members, and that is what a relay has: the
// members are enrolled, the relay is answerable for the list, and cycle
// 10 makes it answerable in writing — a roll entry now introduces the key
// everything sent to that member is sealed to.
//
// Renamed INSIDE this flag day on purpose (wsl-claude's sequencing): the
// break is already being spent, and a vocabulary change that slips a week
// becomes a second one.
const ACQUIRED_ROLL = 'roll';
const ACQUIRED_HOLD = 'hold';
const ACQUIRED_MEMBER = 'member';
const ACQUIRED_RANK = {
  roll: 0, hold: 1, message: 2, invite: 3, handle: 4, member: 5,
};
// The ways of arriving that mean this node will listen. `hold` is not one
// of them: a held row exists so a human can see who is waiting and say
// yes, and until they do it is a name, not a correspondent.
const ACQUIRED_LISTENING = ['message', 'invite', 'handle', 'member'];

// A row with no field predates the field, and what it was is a roll row:
// it was written by handshake (deleted 2026-09-19) from `who`.
//
// AND THIS IS ALSO THE RENAME'S MIGRATION, which is why it is said out
// loud rather than left to work by accident. Every live node — Andy's,
// both agents', every member of spirit-3 — has rows on disc reading
// `acquiredVia: "census"`. That string is no longer in ACQUIRED_RANK, so
// it falls through here to `roll`, which is the rank and the meaning it
// always had. Nothing is rewritten on disc; the next write to a row
// stores the new word (normalize keeps named fields only).
//
// So the old value is CAUGHT, not merely unrecognised. If a later hand
// turns this fallback into a refusal, it must migrate these rows first,
// or every contact a node ever met through a roll silently becomes a
// stranger it will not hear from.
function acquiredVia(row) {
  var via = row && row.acquiredVia;
  return Object.prototype.hasOwnProperty.call(ACQUIRED_RANK, via) ? via : ACQUIRED_ROLL;
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

// `memberOf` AND `isMember` STOOD HERE (2026-09-19): the seats a key held
// on relays this node owns, written only by a roster sweep. No relay may
// return a roster any more (0012 widened, PAYLOAD_MAX), so the field was a
// belief about a list we no longer receive — and a contact records what
// this node knows about a person, not what a vanished list once said.
// Andy: "email addresses change, contacts go stale. Deal with it." A row
// written by older code may still carry `memberOf`; nothing reads it, and
// the next write drops it (normalize below keeps named fields only).

// Whether this node listens to that row: acquired one of the ways that
// count, and not blocked. The one question the inbox asks.
function listens(row) {
  return ACQUIRED_LISTENING.indexOf(acquiredVia(row)) !== -1 && !isBlocked(row);
}

// Who this node listens to. What the inbox is filtered against.
function contacts(rootDir) {
  return load(rootDir).filter(listens);
}

// Everyone this node has a row for beyond the roll: the people it
// listens to, plus the ones waiting to be accepted and the ones it has
// blocked. What the To list is built from — a held row that cannot be
// seen cannot be accepted, and a blocked row that vanishes cannot be
// unblocked.
function addressBook(rootDir) {
  return load(rootDir).filter(function (row) { return acquiredVia(row) !== ACQUIRED_ROLL; });
}

// ── IT WAS who.json UNTIL 2026-09-18 ────────────────────────────────
//
//   Andy: "who.json should be contacts.json."
//
// `who` is the ROLL'S word — `GET /api/relay/who`, everyone who ever
// claimed on that box. This file's first paragraph is an argument that it
// is not that, and it was named after the thing it exists to keep out.
// That is how the confusion got in: `peer.list` spent two years pouring
// the roll into the address book because the two wore one name.
function bookPath(rootDir) {
  return path.join(rootDir, 'relay-state', 'contacts.json');
}

// ── AND A NODE THAT ALREADY HAS ONE KEEPS ITS CONTACTS ───────────────
//
// A ONE-TIME MOVE, not a fallback. Nothing reads `who.json` after this:
// it is renamed on the first load that finds it and is never consulted
// again, so there is no second path to rot and no second place a contact
// can live. The distinction matters — a permanent fallback is what was
// deleted from answerRelay this same week, for being a reader that keeps
// the old thing alive.
//
// It renames rather than copies, deliberately. Two files holding contacts
// is the failure worth avoiding; losing somebody's book is the other, and
// a rename risks neither.
// DEPRECATED(D2, expires: alpha) — the book under its old name,
// relay-state/who.json, renamed on first read. See design/DEPRECATIONS.md (decision 0014).
function migrateOldName(rootDir) {
  const now = bookPath(rootDir);
  if (fs.existsSync(now)) return;
  const was = path.join(rootDir, 'relay-state', 'who.json');
  if (!fs.existsSync(was)) return;
  try { fs.renameSync(was, now); }
  catch (e) { /* a book that cannot be moved is read where it is, below */ }
}

function load(rootDir) {
  migrateOldName(rootDir);
  try {
    const parsed = JSON.parse(fs.readFileSync(bookPath(rootDir), 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    // DEPRECATED(D2, expires: alpha) — the fallback read of who.json.
    // THE OLD NAME, ONCE, only if the rename above could not run — a
    // read-only mount, a permission, a file held open. Not a fallback
    // anybody relies on: it exists so a migration that fails is still not
    // a node that has forgotten its contacts.
    try {
      const old = JSON.parse(fs.readFileSync(
        path.join(rootDir, 'relay-state', 'who.json'), 'utf8'));
      return Array.isArray(old) ? old : [];
    } catch (e2) { return []; }
  }
}

function save(rootDir, rows) {
  fs.mkdirSync(path.join(rootDir, 'relay-state'), { recursive: true });
  // So a save that lands before any read still leaves one file, not two.
  migrateOldName(rootDir);
  fs.writeFileSync(bookPath(rootDir), JSON.stringify(rows, null, 2));
  syncMarks(rootDir, rows);
}

// ── THE BOOK IS A MARK ON WHAT THE MACHINE REMEMBERS (0021) ───────────
//
//   Andy: "it's the chosen-mark that gives protection from eviction, if
//   the memory overflows."
//
// Every save hands the node's memory the whole book as marks, so no
// writer of this file can forget to: somebody added is protected, somebody
// held or blocked is in line after the strangers, and somebody who left
// the book is unprotected in the same instant. Written HERE, at the one
// place the book is written, rather than by each caller.
//
// Where the marks live is the node's business and no app's (0021, rule 4):
// apps reach the book through `peer.list` and `contact.*`, as before.
function markOf(row) {
  var via = acquiredVia(row);
  var choice = ACQUIRED_LISTENING.indexOf(via) !== -1 ? 'added'
    : (via === ACQUIRED_HOLD ? 'held' : '');
  return { publicKey: row.publicKey, choice: choice, blocked: isBlocked(row) };
}

// A memory that will not take the marks is not a reason to lose the book:
// the file is written first, and the next save tries again. The node
// refuses to start without its store (server.js), so this is a suite's
// temp home or a disc error, not a mode.
function syncMarks(rootDir, rows) {
  try {
    require('./nodeStore').open(rootDir).seen.markBook(
      (rows || load(rootDir)).filter(function (r) { return r && r.publicKey; }).map(markOf));
    return true;
  } catch (e) { return false; }
}

// A contact's routes: relay keys, newest first, no duplicates, and a
// bounded few — a route is only worth keeping while it might be the one a
// post needs, and the relay reads at most HINTS_PER_POST of them anyway.
//
// ── DUE FOR REMOVAL (0018, decided 2026-09-21) ───────────────────────
//
//   Andy: "the hints are removed from the users contacts. (let's admit
//   it: they [are] not human-readable, in reality)"
//
// These are base64 Ed25519 relay keys and nobody has ever read one:
// machine data in the one file that is meant to be the digitisation of a
// person's spirit, claiming a rule it never satisfied. They are also a
// second copy — seenPeers.js holds every route a row here could hold,
// plus the ones for people who are not contacts, so the two can disagree
// and this is the one that goes stale.
//
// IT LANDS WITH THE STORE AND NOT BEFORE (gap cycle R26). hub.handlePost
// reads these for hints whenever no relay of this node names the target,
// which is the foreign-peer case, and the shadow lives in RAM — so
// removing them today would leave a foreign contact unreachable after
// every restart until something re-taught the route.
// ── REMOVED 2026-09-21, cycle R1 ──────────────────────────
//
// R26 built the store, so the condition above is met: the shadow survives
// a restart and a foreign contact stays reachable. `routes` is gone from
// the row, `learnRoute` with it, and `hub.handlePost` takes its hints from
// `shadow(rootDir).routes(key)` — best-ranked first, which this list could
// never do, because it was newest-first and had no idea who had said what.
//
// WHAT A NODE THAT ALREADY HAS THEM DOES: server.js imports them into the
// shadow once at boot, at HEARSAY, because nothing here recorded who said
// them. Then they stop being written and fall away on the next upsert.
//
// `normalizeRoutes` stays for that import and for reading an old file.
var ROUTES_KEPT = 8;
function normalizeRoutes(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  list.forEach(function (key) {
    const k = String(key || '').trim();
    if (k && out.indexOf(k) === -1) out.push(k);
  });
  return out.slice(0, ROUTES_KEPT);
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
  // stranger because the roll mentioned it again.
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
    // WHERE THIS CONTACT IS REACHED, by relay ID (cycle 2). Location, not
    // identity: the key above says who they are, these say which relays
    // they are enrolled at — Andy: "they are always the ID of the relay it
    // is enrolled at." Sent as route hints when they are not on a relay
    // this node holds. Relay KEYS only; `relays` above holds URLs and is
    // left as it was.
    // `memberOf` and `missingSince` were carried here, both written by the
    // roster sweep that went on 2026-09-19. Not carried any more, so a row
    // written by older code loses them on its next write.
  };
  if (i === -1) rows.push(next);
  else rows[i] = next;
  save(rootDir, rows);
  return next;
}

// setMemberOf, setMissing AND missingSince STOOD HERE — the roster
// sweep's writers and the "on no roll since" mark. Gone with the sweep
// (2026-09-19): what is not found cannot influence decisions (Andy), and a
// key's absence from a list no relay may return is not a finding.

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

// handshake STOOD HERE — "seeing somebody in a roll": it refreshed a
// row's public caption and relays from a roll list, and wrote a
// stranger in as `roll`. Its one caller was hub.buildPeople's roll
// walk, fed [] since the roll went (2026-09-18); both deleted
// 2026-09-19 with the other roster readers. Old rows still read
// `roll` (acquiredVia above) — that is history, not a source.

// Coming to know somebody: they wrote to you, they consumed an invite of
// yours, or a human confirmed the key out of band. Upgrades a roll row
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

// -- A ROUTE LEARNED FROM A RELAY, STASHED ON A ROW THAT ALREADY EXISTS -
//
//   Andy: "they just miraculously get stashed on the correct contact-row."
//
// A relay announces a route it has PROVEN -- it carried a packet to that
// key through that partner and a reply came back signed by it -- and any
// member holding a row for that key writes it down.
//
// IT NEVER CREATES A ROW, and that boundary is the whole of the safety
// here. A relay may improve what this node knows about its own contacts;
// it may never add to them, or "my book is mine" stops being true and a
// relay can put people in it. A route for somebody not in the book is
// dropped, which is also what makes an announcement cheap to receive:
// most of them are about people you do not know, and cost one lookup.
//
// Returns the row it updated, or null when there was nothing to update --
// so a caller can tell "stashed" from "ignored" without asking twice.
//
// ~~THE ROUTE IS A RELAY KEY (cycle 2).~~ — **`learnRoute` was deleted on
// 2026-09-21 (cycle R1, decision 0018).** A route is the machine's, not
// the owner's, and it lives in the shadow now. `routesOf` is what is left:
// a reader for an old file, so the one-time import can find them.
function routesOf(rootDir, publicKey) {
  var key = String(publicKey == null ? '' : publicKey).trim();
  if (!key) return [];
  var row = load(rootDir).find(function (r) { return r.publicKey === key; });
  return row ? normalizeRoutes(row.routes || []) : [];
}

function everyRouteHeld(rootDir) {
  var out = [];
  load(rootDir).forEach(function (r) {
    normalizeRoutes(r.routes || []).forEach(function (at) {
      out.push({ publicKey: r.publicKey, at: at });
    });
  });
  return out;
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
// node is on, they are in its roll, and the next search will show them
// again as somebody you could add. That is correct and worth saying: this
// forgets YOUR side of a relationship, and a relay's roll is not yours
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
      acquiredVia: ACQUIRED_ROLL,
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
  syncMarks: syncMarks,
  markOf: markOf,
  forget: forget,
  ROLL: ACQUIRED_ROLL,
  HOLD: ACQUIRED_HOLD,
  MEMBER: ACQUIRED_MEMBER,
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
  routesOf: routesOf,
  everyRouteHeld: everyRouteHeld,
  labelForKey: labelForKey,
  addRoute: addRoute,
};
