'use strict';

// spirit/run/js/relayStore.js
// THE RELAY'S DATA, ON DISC. RAM IS ITS CLIENT.
//
//   Andy: "storage is actually moved from RAM to DISC, and RAM must become
//   a DISC-client." — cycle 3, design/cycles/2026-09-19-disc-and-owner-
//   token-cycle-3.md; design/principles/NODE-AND-RELAY.md, Build sequence.
//
// Until cycle 3 the relay held its whole roll in a map, read it whole at
// boot, and rewrote routingTable.json whole on every change. Now disc is
// the only copy: every question is a query, and nothing is resident that
// current activity does not need (standing rule: RAM, the most expensive
// resource, managed with utmost care).
//
// ONE DATABASE, THREE TABLES — only what grows (§8: every persisted dataset
// is bounded by disc; only what grows needs a table of its own):
//
//   members    the roll, by key. Labels are indexed for SEARCH AND DISPLAY
//              only — every operation is by key (Andy, cycle 3).
//   invites    the waiting room: live tokens, deleted when spent.
//   partners   the partner roll in the shape NODE-AND-RELAY §5 gives it:
//              by relay key, with a status. Today's partnerships are
//              `partnered`; cycle 5 adds `injected` and `requested`, the
//              minting cycle and the partner verbs. (Seam: rule 6.)
//
// identity.json, allow.json and config.json stay files: constant, tiny,
// and the ones an owner may have to read or restore over SSH.
//
// ROLLBACK JOURNAL, NOT WAL. After every commit the data is in relay.db
// and nowhere else, so a file-copy backup — or a test fixture copying
// relay-state/ — cannot catch it half-written. WAL buys concurrent readers,
// and a relay is one process.
//
// `node:sqlite` is core from Node 22.5 and unflagged from 22.13. Only the
// relay loads this module; relayServer.js refuses to start, saying why,
// when it cannot be loaded.

const fs = require('fs');
const path = require('path');

let sqlite = null;
function driver() {
  if (!sqlite) sqlite = require('node:sqlite');
  return sqlite;
}

// One store per relay home, shared by relay.js and invites.js so both
// read the same connection. Keyed by the resolved path.
const open_ = new Map();

function dbPath(rootDir) {
  return path.join(rootDir, 'relay-state', 'relay.db');
}

// Labels are stored as the relay normalised them at claim (labelRule), and
// compared exactly — a lookup here must answer what `labelOf(p) === n`
// answered before cycle 3, no more loosely. The index is on this column so
// a label lookup is one seek.
function normLabel(label) {
  return String(label == null ? '' : label).trim();
}

// READ-ONLY, for the SSH dump tool (relayDump.js): no schema is created,
// nothing is imported, nothing is cached, and a write throws. Null when
// there is no database to read. The caller closes it.
function openReadOnly(rootDir) {
  if (!fs.existsSync(dbPath(rootDir))) return null;
  const db = new (driver().DatabaseSync)(dbPath(rootDir), { readOnly: true });
  return build(rootDir, db, null);
}

function open(rootDir) {
  const key = path.resolve(rootDir);
  if (open_.has(key)) return open_.get(key);

  fs.mkdirSync(path.join(rootDir, 'relay-state'), { recursive: true });
  const db = new (driver().DatabaseSync)(dbPath(rootDir));
  db.exec('PRAGMA journal_mode = DELETE');
  db.exec('PRAGMA synchronous = FULL');
  // DELETED MEANS GONE FROM THE DISC. By default SQLite leaves a deleted
  // row's bytes in a free page until something reuses it — so a spent
  // invite's label (a phone number, say) or a removed member would still be
  // readable in relay.db. "The relay forgets" (NODE-AND-RELAY §2) has to be
  // true of the file, not only of the queries: this zeroes what is deleted.
  db.exec('PRAGMA secure_delete = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      publicKey   TEXT PRIMARY KEY,
      publicLabel TEXT NOT NULL DEFAULT '',
      labelNorm   TEXT NOT NULL DEFAULT '',
      claimedAt   TEXT NOT NULL DEFAULT '',
      owner       INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS members_label ON members (labelNorm);
    CREATE TABLE IF NOT EXISTS invites (
      token     TEXT PRIMARY KEY,
      label     TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      invitedBy TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS invites_label ON invites (label);
    CREATE TABLE IF NOT EXISTS partners (
      relayKey TEXT PRIMARY KEY,
      url      TEXT NOT NULL,
      ownerKey TEXT NOT NULL DEFAULT '',
      status   TEXT NOT NULL,
      since    TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS partners_owner ON partners (ownerKey);
  `);

  const store = build(rootDir, db, key);
  try { importLegacy(rootDir, store); }
  catch (e) { try { db.close(); } catch (e2) { /* closed */ } throw e; }
  open_.set(key, store);
  return store;
}

// The statements and the API over one connection. `key` is the cache slot
// a read-write store occupies (null for a read-only one).
function build(rootDir, db, key) {
  const q = {
    memberGet: db.prepare('SELECT * FROM members WHERE publicKey = ?'),
    memberByLabel: db.prepare('SELECT * FROM members WHERE labelNorm = ? LIMIT ?'),
    memberByKeys: null,
    memberCount: db.prepare('SELECT COUNT(*) AS n FROM members'),
    memberAll: db.prepare('SELECT * FROM members ORDER BY claimedAt'),
    memberPage: db.prepare('SELECT * FROM members WHERE publicKey > ? ORDER BY publicKey LIMIT ?'),
    memberPut: db.prepare(`INSERT INTO members (publicKey, publicLabel, labelNorm, claimedAt, owner)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(publicKey) DO UPDATE SET publicLabel = excluded.publicLabel,
        labelNorm = excluded.labelNorm, claimedAt = excluded.claimedAt, owner = excluded.owner`),
    memberDel: db.prepare('DELETE FROM members WHERE publicKey = ?'),
    inviteAll: db.prepare('SELECT * FROM invites ORDER BY expiresAt'),
    inviteGet: db.prepare('SELECT * FROM invites WHERE token = ?'),
    inviteByLabel: db.prepare('SELECT * FROM invites WHERE label = ?'),
    invitePut: db.prepare('INSERT INTO invites (token, label, expiresAt, invitedBy) VALUES (?, ?, ?, ?)'),
    inviteDel: db.prepare('DELETE FROM invites WHERE token = ?'),
    inviteDelLabel: db.prepare('DELETE FROM invites WHERE label = ?'),
    inviteSweep: db.prepare('DELETE FROM invites WHERE expiresAt < ?'),
    partnerAll: db.prepare('SELECT * FROM partners ORDER BY since'),
    partnerGet: db.prepare('SELECT * FROM partners WHERE relayKey = ?'),
    partnerByOwner: db.prepare('SELECT * FROM partners WHERE ownerKey = ?'),
    partnerPut: db.prepare(`INSERT INTO partners (relayKey, url, ownerKey, status, since)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(relayKey) DO UPDATE SET url = excluded.url, ownerKey = excluded.ownerKey,
        status = excluded.status, since = excluded.since`),
    partnerDel: db.prepare('DELETE FROM partners WHERE relayKey = ?'),
    partnerDelOwner: db.prepare('DELETE FROM partners WHERE ownerKey = ?'),
  };

  function member(row) {
    if (!row) return null;
    return {
      publicKey: row.publicKey,
      publicLabel: row.publicLabel,
      claimedAt: row.claimedAt,
      owner: !!row.owner,
    };
  }

  function invite(row) {
    if (!row) return null;
    return { token: row.token, label: row.label, expiresAt: row.expiresAt, invitedBy: row.invitedBy };
  }

  function partner(row) {
    if (!row) return null;
    return { relayKey: row.relayKey, url: row.url, ownerKey: row.ownerKey, status: row.status, since: row.since };
  }

  const store = {
    path: dbPath(rootDir),

    members: {
      get: function (publicKey) { return member(q.memberGet.get(String(publicKey || ''))); },
      // Labels duplicate by design, so this answers every holder up to
      // `limit` — search and display decide what to do with more than one.
      byLabel: function (label, limit) {
        return q.memberByLabel.all(normLabel(label), limit || 2).map(member);
      },
      byKeys: function (keys) {
        return (keys || []).map(function (k) { return member(q.memberGet.get(String(k || ''))); })
          .filter(Boolean);
      },
      count: function () { return q.memberCount.get().n; },
      // ONE PAGE OF THE ROLL, by key: the rows after `afterKey`, at most
      // `limit`. How the relay walks the roll — a page, then the event loop,
      // then the next — because a walk in one go blocks every other request
      // for as long as it takes (Andy: "the nature of all wire comms is
      // asynchronous, and blocking hurts the resources of relays"). Keyed,
      // not an open cursor, so nothing is held between pages.
      page: function (afterKey, limit) {
        return q.memberPage.all(String(afterKey || ''), limit).map(member);
      },
      // The whole roll in one go, row by row. For suites and tools only:
      // it blocks for as long as the walk takes, so the relay never calls
      // it (it walks by `page`).
      each: function (fn) {
        for (const row of q.memberAll.iterate()) {
          if (fn(member(row)) === false) break;
        }
      },
      put: function (row) {
        q.memberPut.run(String(row.publicKey), String(row.publicLabel || ''),
          normLabel(row.publicLabel), String(row.claimedAt || ''), row.owner ? 1 : 0);
        return member(q.memberGet.get(String(row.publicKey)));
      },
      remove: function (publicKey) {
        return q.memberDel.run(String(publicKey || '')).changes > 0;
      },
    },

    invites: {
      // The waiting room is bounded by its own rules (a lifetime, and
      // spent means gone), so reading it whole is reading a small thing.
      all: function () { return q.inviteAll.all().map(invite); },
      get: function (token) { return invite(q.inviteGet.get(String(token || ''))); },
      byLabel: function (label) { return q.inviteByLabel.all(String(label || '')).map(invite); },
      add: function (row) {
        q.invitePut.run(String(row.token), String(row.label), String(row.expiresAt), String(row.invitedBy || ''));
        return invite(q.inviteGet.get(String(row.token)));
      },
      remove: function (token) { return q.inviteDel.run(String(token || '')).changes > 0; },
      removeLabel: function (label) { return q.inviteDelLabel.run(String(label || '')).changes; },
      sweepExpired: function (nowIso) { return q.inviteSweep.run(String(nowIso)).changes; },
    },

    partners: {
      all: function () { return q.partnerAll.all().map(partner); },
      get: function (relayKey) { return partner(q.partnerGet.get(String(relayKey || ''))); },
      byOwner: function (ownerKey) { return q.partnerByOwner.all(String(ownerKey || '')).map(partner); },
      put: function (row) {
        q.partnerPut.run(String(row.relayKey), String(row.url || ''), String(row.ownerKey || ''),
          String(row.status || 'partnered'), String(row.since || ''));
        return partner(q.partnerGet.get(String(row.relayKey)));
      },
      remove: function (relayKey) { return q.partnerDel.run(String(relayKey || '')).changes > 0; },
      removeOwner: function (ownerKey) { return q.partnerDelOwner.run(String(ownerKey || '')).changes; },
    },

    // Several writes as one: all of them land or none do.
    transaction: function (fn) {
      db.exec('BEGIN');
      try { const out = fn(); db.exec('COMMIT'); return out; }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },

    close: function () {
      try { db.close(); } catch (e) { /* already closed */ }
      if (key) open_.delete(key);
    },
  };

  return store;
}

// ── DEPRECATED(D8, expires: alpha) — THE ONE-TIME IMPORT ──────────────
// See design/DEPRECATIONS.md (decision 0014).
//
// A relay that ran before cycle 3 holds routingTable.json and invites.json.
// On the first open they are read into the store in one transaction, then
// renamed to *.imported — kept, never deleted, so nothing is lost if the
// import is ever doubted. A file that is already renamed is never read
// again, so this runs once.
//
// It absorbs what the old readers carried (D1, D4), so the live code does
// not: a row's `name` becomes its `publicLabel`; the ring's `messages` and
// `nextId` are not carried; an invite stamped `consumedAt` by the old
// `consume` was spent, and is not imported. A member row's `partner` flag
// becomes a `partnered` row in the partner roll, keyed by relay key.
function importLegacy(rootDir, store) {
  const state = path.join(rootDir, 'relay-state');
  const roll = path.join(state, 'routingTable.json');
  const inv = path.join(state, 'invites.json');
  const hasRoll = fs.existsSync(roll);
  const hasInv = fs.existsSync(inv);
  if (!hasRoll && !hasInv) return { members: 0, invites: 0, partners: 0 };

  // AN UNREADABLE FILE STOPS THE IMPORT, AND THE RELAY WITH IT. Reading a
  // torn routingTable.json as empty would open a relay that has quietly
  // forgotten its members — the same failure B4 refuses to start over
  // (a relay with members but no allow.json). Nothing is renamed, so the
  // owner finds the file where it was, over SSH.
  let peers = {};
  let invites = [];
  function readOrRefuse(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (e) {
      throw new Error(path.basename(file) + ' cannot be read, so it cannot be imported: ' +
        e.message + ' — fix or move it, then start again');
    }
  }
  if (hasRoll) {
    const parsed = readOrRefuse(roll);
    if (parsed && parsed.peers && typeof parsed.peers === 'object') peers = parsed.peers;
  }
  if (hasInv) {
    const parsed = readOrRefuse(inv);
    if (Array.isArray(parsed)) invites = parsed;
  }

  const counts = { members: 0, invites: 0, partners: 0 };
  store.transaction(function () {
    Object.keys(peers).forEach(function (k) {
      const row = peers[k];
      if (!row || typeof row !== 'object') return;
      const key = String(row.publicKey || '').trim();
      if (!key) return;   // a keyless row was never addressable
      store.members.put({
        publicKey: key,
        publicLabel: String(row.publicLabel || row.name || ''),
        claimedAt: String(row.claimedAt || ''),
        owner: !!row.owner,
      });
      counts.members += 1;
      if (row.partner && row.partner.relayKey) {
        store.partners.put({
          relayKey: String(row.partner.relayKey),
          url: String(row.partner.url || ''),
          ownerKey: key,
          status: 'partnered',
          since: String(row.partner.since || ''),
        });
        counts.partners += 1;
      }
    });
    invites.forEach(function (row) {
      if (!row || !row.token || !row.label || row.consumedAt) return;
      if (store.invites.get(row.token)) return;
      store.invites.add({
        token: String(row.token), label: String(row.label),
        expiresAt: String(row.expiresAt || ''), invitedBy: String(row.invitedBy || ''),
      });
      counts.invites += 1;
    });
  });

  if (hasRoll) fs.renameSync(roll, roll + '.imported');
  if (hasInv) fs.renameSync(inv, inv + '.imported');
  return counts;
}

// For relayServer.js: can this Node load the driver at all?
function available() {
  try { driver(); return true; } catch (e) { return false; }
}

function closeAll() {
  Array.from(open_.values()).forEach(function (s) { s.close(); });
}

module.exports = {
  open: open,
  openReadOnly: openReadOnly,
  available: available,
  closeAll: closeAll,
  normLabel: normLabel,
};
