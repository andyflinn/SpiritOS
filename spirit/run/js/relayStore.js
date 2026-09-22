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

// ── WAS THAT THE DISC, OR A BUG? (cycle 9) ──────────────────────────
//
// The store owns this question, because the answer is SQLite's and
// nobody else should be reading its English.
//
// FOUND THE HARD WAY. The first guard matched on the message, and
// wsl-claude then staged a GENUINELY full filesystem — an unprivileged
// user namespace with a 1 MB tmpfs — and watched it miss: SQLite's
// sentence for a full disc is **"database or disk is full"**, which
// contains none of `SQLITE_FULL`, `ENOSPC` or `no space`. Those are the
// NAME of the code, not the text of the message. So the relay still died
// on the one case Andy asked about.
//
// SO: THE CODE, NOT THE SENTENCE. `node:sqlite` puts `errcode` on the
// error, and the low byte is the primary result code, with the extended
// codes above it — which is why a read-only DIRECTORY reports 1544
// (`READONLY_DIRECTORY`) and must be read as 8.
//
//   13  SQLITE_FULL     the disc is full
//    8  SQLITE_READONLY the file, or the directory the journal needs
//   10  SQLITE_IOERR    the write failed underneath us
//   14  SQLITE_CANTOPEN no handle, which a full disc also produces
//
// The message test stays as a second line, for a driver that one day
// reports no code — but it is no longer what this rests on. A match on
// English drifts with an upgrade; a match on a code does not.
function isDiscFailure(e) {
  const code = e && typeof e.errcode === 'number' ? (e.errcode & 0xff) : null;
  if (code === 13 || code === 8 || code === 10 || code === 14) return true;
  const said = String((e && e.message) || e);
  return /database or disk is full|readonly database|attempt to write|disk I\/O|unable to open database|no space|ENOSPC|EROFS|EACCES|EPERM/i.test(said);
}

// ── COMPACTING, AT A RESTART AND NOWHERE ELSE (cycle 9) ─────────────
//
//   Andy, 2026-09-22: "since disc space is such a cheap resource compared
//   to the expected needs, compacting at restart sound like a good
//   stop-gap-measure."
//
// WHY IT IS NEEDED AT ALL. A deleted row frees a page and does not
// shorten the file, so a relay whose owner removes members keeps
// reporting the size it had. Cycle 9 bounds the roll by `bytes()`, so
// that stale figure would refuse the very shrink the owner just made room
// for — the rule "evict before shrinkage" defeated at the moment somebody
// follows it. Measured: 20,000 members is 3.5 MB; removing 15,000 leaves
// the file at 3.5 MB; a VACUUM takes 20 ms and leaves 0.9 MB.
//
// WHY AT A RESTART. `node:sqlite` is synchronous and a relay is one
// process: a VACUUM while serving is dead air for everybody, not merely
// slow writes. At startup the socket is not listening yet, so the pause
// costs nobody anything.
//
// WHY IT MAY REFUSE. A VACUUM writes a fresh copy before it frees
// anything, so it needs about twice the file in free space — which is to
// say it cannot run on the disc that is actually full, the day you most
// want it. It checks first and says so rather than failing.
//
// STOP-GAP, in Andy's word. What it does not do is keep the file honest
// BETWEEN restarts; that wants `auto_vacuum = INCREMENTAL` (set only at
// creation) and bounded `incremental_vacuum` steps after removals. Both
// are cheap and neither is built, because disc is the resource we are
// least short of and a restart is not rare.
function compact(rootDir, freeMB) {
  const file = dbPath(rootDir);
  let before = 0;
  try { before = fs.statSync(file).size; } catch (e) { return { ok: false, why: 'no database yet' }; }

  const needMB = (before * 2) / (1024 * 1024);
  if (typeof freeMB === 'number' && isFinite(freeMB) && freeMB < needMB) {
    return {
      ok: false,
      before: before,
      why: 'a VACUUM needs about twice the file (' + needMB.toFixed(1) + ' MB) and ' +
        Math.floor(freeMB) + ' MB is free — freeing space is the owner\'s to do',
    };
  }

  // Through a connection of its own, closed straight after: VACUUM cannot
  // run inside a transaction, and the cached handle is shared with
  // everything that holds the store.
  const started = Date.now();
  try {
    closeAll();
    const db = new (driver().DatabaseSync)(file);
    try { db.exec('VACUUM'); } finally { db.close(); }
  } catch (e) {
    return { ok: false, before: before, why: String((e && e.message) || e) };
  }
  let after = before;
  try { after = fs.statSync(file).size; } catch (e) { after = before; }
  return { ok: true, before: before, after: after, ms: Date.now() - started };
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
      claimedAt   TEXT NOT NULL DEFAULT ''
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
      since    TEXT NOT NULL DEFAULT '',
      last     TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS partners_owner ON partners (ownerKey);
  `);

  // ── `last` ON A RELAY THAT ALREADY HAS A partners TABLE (cycle R12) ──
  //
  // `CREATE TABLE IF NOT EXISTS` does nothing to a table that exists, so a
  // relay that ran before this column was added would never get it — and
  // would fail on the first write rather than the first read, which is the
  // worse end to find out.
  //
  // ADD COLUMN is the one schema change SQLite does cheaply and without
  // rewriting the table. Guarded by asking what is there rather than by
  // catching the error: an exception swallowed here would hide the next
  // migration too.
  try {
    const cols = db.prepare('PRAGMA table_info(partners)').all()
      .map(function (c) { return c.name; });
    if (cols.indexOf('last') === -1) {
      db.exec("ALTER TABLE partners ADD COLUMN last TEXT NOT NULL DEFAULT ''");
    }
  } catch (e) { /* a brand-new database already has it, from the CREATE above */ }

  // ── A ROW DOES NOT KNOW WHO OWNS THE RELAY (2026-09-19) ──────────────
  //
  //   Andy: "only one thing determines ownership of a relay. First claim.
  //   No fleeting roll with automatic memory loss can mark a row as
  //   'owner'." — "a row in the roll doesn't know who the owner is.
  //   Ownership is only determined by one identified key. The relay knows
  //   it."
  //
  // That key is allow.json's (auth.ownerName), served at /api/relay/key.
  // Cycle 3 created `members` with an `owner` column copied from it at
  // claim time; a relay.db that has one loses it here, once. Idempotent:
  // asked of the table, not assumed.
  const hasOwnerColumn = db.prepare('PRAGMA table_info(members)').all()
    .some(function (c) { return c.name === 'owner'; });
  if (hasOwnerColumn) db.exec('ALTER TABLE members DROP COLUMN owner');

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
    memberPut: db.prepare(`INSERT INTO members (publicKey, publicLabel, labelNorm, claimedAt)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(publicKey) DO UPDATE SET publicLabel = excluded.publicLabel,
        labelNorm = excluded.labelNorm, claimedAt = excluded.claimedAt`),
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
    partnerPut: db.prepare(`INSERT INTO partners (relayKey, url, ownerKey, status, since, last)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(relayKey) DO UPDATE SET url = excluded.url, ownerKey = excluded.ownerKey,
        status = excluded.status, since = excluded.since, last = excluded.last`),
    // WHEN A PARTNERSHIP LAST WORKED, written on its own (cycle R12).
    // Separate from `put` because the two are different events with
    // different authors: `put` is somebody deciding a partnership exists,
    // this is the wire saying it still does. Touching one must not rewrite
    // the other's fields.
    partnerTouch: db.prepare('UPDATE partners SET last = ? WHERE relayKey = ?'),
    partnerDel: db.prepare('DELETE FROM partners WHERE relayKey = ?'),
    partnerDelOwner: db.prepare('DELETE FROM partners WHERE ownerKey = ?'),
  };

  function member(row) {
    if (!row) return null;
    return {
      publicKey: row.publicKey,
      publicLabel: row.publicLabel,
      claimedAt: row.claimedAt,
    };
  }

  function invite(row) {
    if (!row) return null;
    return { token: row.token, label: row.label, expiresAt: row.expiresAt, invitedBy: row.invitedBy };
  }

  function partner(row) {
    if (!row) return null;
    return {
      relayKey: row.relayKey, url: row.url, ownerKey: row.ownerKey,
      status: row.status, since: row.since,
      // '' rather than null for a partnership that has never answered, so
      // a caller ordering by it sorts rather than throws.
      last: row.last || '',
    };
  }

  const store = {
    path: dbPath(rootDir),

    // ── WHAT THIS RELAY'S STATE OCCUPIES, IN BYTES (cycle 9) ─────────
    //
    //   Andy, 2026-09-22: "DISC boundaries must be set also."
    //
    // The database and its rollback journal, which is the whole of what a
    // relay writes that grows: members, invites and the partner roll. No
    // traffic, no payloads (relayServer.js, NO TRAFFIC LOG), so this
    // number moves only when membership does.
    //
    // MEASURED, NOT ESTIMATED. A per-member byte estimate would be a
    // guess that drifts with a schema change; the file on disc is the
    // thing the owner's disc limit is actually about. Claims are rate
    // limited (CLAIM_PER_MIN), so a stat on that path costs nothing.
    bytes: function () {
      let total = 0;
      [dbPath(rootDir), dbPath(rootDir) + '-journal'].forEach(function (p) {
        try { total += fs.statSync(p).size; } catch (e) { /* absent is zero */ }
      });
      return total;
    },

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
      // `page` STOOD HERE: the roll a page at a time, which was how search
      // walked it. Search answers from the connected members only
      // (relay.js walkRoll, 2026-09-19), so nothing on the relay walks the
      // roll, and an enumerator with no caller is an invitation.
      //
      // The whole roll in one go, row by row. For suites and tools only
      // (relayDump): it blocks for as long as the walk takes, so the relay
      // never calls it.
      each: function (fn) {
        for (const row of q.memberAll.iterate()) {
          if (fn(member(row)) === false) break;
        }
      },
      put: function (row) {
        q.memberPut.run(String(row.publicKey), String(row.publicLabel || ''),
          normLabel(row.publicLabel), String(row.claimedAt || ''));
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
          String(row.status || 'partnered'), String(row.since || ''), String(row.last || ''));
        return partner(q.partnerGet.get(String(row.relayKey)));
      },
      // ── THE PARTNERSHIP ANSWERED (cycle R12) ──────────────────
      //
      // `since` says when a partnership began and nothing said when it
      // last worked — so the only liveness a relay had was the partner
      // STREAM, which R13 removes. This is what replaces it: the column
      // that orders a search, so the partners most likely to answer are
      // asked first.
      //
      // IT DOES NOT EVICT. Andy: the roll is the reach. A partner silent
      // for a month is still the only route to its members, and a row
      // dropped for quietness is connectivity thrown away to tidy a
      // column.
      //
      // False when the row is not there, rather than creating one: a
      // partnership is made deliberately, never by having answered.
      touch: function (relayKey, atIso) {
        return q.partnerTouch.run(
          String(atIso || new Date().toISOString()), String(relayKey || '')
        ).changes > 0;
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
  compact: compact,
  isDiscFailure: isDiscFailure,
  openReadOnly: openReadOnly,
  available: available,
  closeAll: closeAll,
  normLabel: normLabel,
};
