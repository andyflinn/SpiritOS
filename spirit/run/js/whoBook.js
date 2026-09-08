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
//
// Ranks never fall. A census sync may correct a publicLabel on a row you
// already know, and can never demote it back to a stranger.

const fs = require('fs');
const path = require('path');

const ACQUIRED_CENSUS = 'census';
const ACQUIRED_RANK = { census: 0, message: 1, invite: 2, handle: 3 };

// A row with no field predates the field, and what it was is a census
// row: it was written by handshake from `who`.
function acquiredVia(row) {
  var via = row && row.acquiredVia;
  return Object.prototype.hasOwnProperty.call(ACQUIRED_RANK, via) ? via : ACQUIRED_CENSUS;
}

function acquiredRank(via) {
  return ACQUIRED_RANK[via] === undefined ? 0 : ACQUIRED_RANK[via];
}

// Who this node actually knows: everything but the census. What the To
// list is built from, and never `who`.
function contacts(rootDir) {
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
    relays: normalizeRelays(row.relays != null ? row.relays : prev.relays),
  };
  if (i === -1) rows.push(next);
  else rows[i] = next;
  save(rootDir, rows);
  return next;
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
  const publicLabel = peer.publicLabel || peer.name || '';
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
    publicLabel: peer.publicLabel || peer.name || (existing && existing.publicLabel) || '',
    acquiredVia: via,
    relays: peer.relay
      ? normalizeRelays(((existing && existing.relays) || []).concat([peer.relay]))
      : (existing && existing.relays),
  });
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
  CENSUS: ACQUIRED_CENSUS,
  load: load,
  contacts: contacts,
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
