'use strict';

// spirit/run/js/nodeStore.js
// THE NODE'S MACHINE STATE, ON DISC.
//
//   Andy: "the route cache belongs to the machine, not the human."
//   Andy: "we need no peer review for allowing a database to be used for
//   the shadow roll. That's a decision."
//
// Decision 0018. A node's human-readability rule covers what its OWNER
// acquired — contacts, writing, media, the traffic log. It does not cover
// what the NETWORK produced, and `server.js` is the proof the exemption
// always existed: it sits on a node's disc, it is text, and nobody has
// ever argued it owes anybody prose.
//
// So the question to ask of anything here is not "can a human read this"
// but "did the owner acquire it, and would they care?" Everything in this
// file answers no.
//
// ── WHAT LIVES HERE, AND WHAT MUST NOT ───────────────────────────────
//
//   relay-state/node.db     the shadow roll (this cycle). The post queue
//                           (R16) and the owner's cache cap (R31) join it.
//
// NOT contacts, NOT the traffic log, NOT identity.json, allow.json or
// config.json. 0018 is explicit that it licenses the route cache and
// "everything else on a node's disk" stays as it is — and relayStore.js
// gives the reason for the last three: they are "constant, tiny, and the
// ones an owner may have to read or restore over SSH".
//
// A CORPUS IS THE OWNER'S; A ROUTING TABLE IS NOT. The traffic log stays
// permanent and readable — Andy: "the log should be permanent. period."
//
// ── SEPARATE FROM relay.db, AND NOT A LAYER OVER IT ──────────────────
//
// A relay's store answers for a box's members, invites and partners; this
// answers for one person's node. They are never the same process —
// server.js hands off to relayServer.js on `--relay` and loads no node
// code — so sharing a file would only mean two schemas in one place with
// nothing able to open both.
//
// ── THE SAME DURABILITY CHOICES, FOR THE SAME REASONS ────────────────
//
// Rollback journal rather than WAL: after every commit the data is in
// node.db and nowhere else, so a file copy cannot catch it half-written.
// WAL buys concurrent readers and a node is one process.
//
// `secure_delete` is ON, and it matters more here than it looks. A deleted
// row's bytes would otherwise sit in a free page until something reused
// them — and what this file holds is not a membership list: it is WHOSE
// BUSINESS THIS NODE HAS BEEN DOING (seenPeers.js). A row swept for age
// has to leave the disc, not just the index.
//
// ── THE FLOOR THIS MOVES ─────────────────────────────────────────────
//
// `node:sqlite` is core from Node 22.5 and unflagged from 22.13, so an
// indexed store on the NODE raises every user's minimum to 22.13 — on a
// machine they own and install themselves. That follows from Andy's grant
// rather than being a second ruling (0018), and `package.json` says so.
//
// The guard is at the caller, the way relayServer.js does it: a node
// refuses to start and says why, rather than degrading to a second
// in-memory code path that nothing exercises.

const fs = require('fs');
const path = require('path');

let sqlite = null;
function driver() {
  if (!sqlite) sqlite = require('node:sqlite');
  return sqlite;
}

// One store per node home, so every caller reads the same connection —
// the shadow today, the queue and the settings later. Keyed by the
// resolved path, exactly as relayStore does it.
const open_ = new Map();

function dbPath(rootDir) {
  return path.join(rootDir, 'relay-state', 'node.db');
}

// Whether this node can have a store at all. Asked rather than assumed, so
// the caller can refuse with a sentence instead of a stack trace.
function available() {
  try { driver(); return true; }
  catch (e) { return false; }
}

function open(rootDir) {
  const key = path.resolve(rootDir);
  if (open_.has(key)) return open_.get(key);

  fs.mkdirSync(path.join(rootDir, 'relay-state'), { recursive: true });
  const db = new (driver().DatabaseSync)(dbPath(rootDir));
  db.exec('PRAGMA journal_mode = DELETE');
  db.exec('PRAGMA synchronous = FULL');
  db.exec('PRAGMA secure_delete = ON');

  // ── THE SHADOW ─────────────────────────────────────────────────────
  //
  // Keyed by peer, so somebody seen a thousand times is one row and
  // growth is bounded by distinct people rather than by traffic.
  //
  // `seen` IS AN INTEGER, unlike relay.db's ISO strings. Those are read by
  // a person over SSH; this one is compared and ordered on the eviction
  // path, and a millisecond count is what that path wants. It is also what
  // R4's two evictions both read — the age bound directly, and the space
  // bound through "oldest first".
  db.exec(`
    CREATE TABLE IF NOT EXISTS seen (
      publicKey TEXT PRIMARY KEY,
      at        TEXT NOT NULL DEFAULT '',
      url       TEXT NOT NULL DEFAULT '',
      label     TEXT NOT NULL DEFAULT '',
      seen      INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS seen_when ON seen (seen);
  `);

  const q = {
    get: db.prepare('SELECT * FROM seen WHERE publicKey = ?'),
    // GREEDY, IN ONE STATEMENT. A field is written when the caller has one
    // and left alone when it does not — the callers do not all know the
    // same things, and a search that taught a label must not have it
    // blanked by the next packet that arrives. `excluded` is the row being
    // inserted; `seen.at` is what is already there.
    put: db.prepare(`INSERT INTO seen (publicKey, at, url, label, seen)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(publicKey) DO UPDATE SET
        at    = CASE WHEN excluded.at    <> '' THEN excluded.at    ELSE seen.at    END,
        url   = CASE WHEN excluded.url   <> '' THEN excluded.url   ELSE seen.url   END,
        label = CASE WHEN excluded.label <> '' THEN excluded.label ELSE seen.label END,
        seen  = excluded.seen`),
    del: db.prepare('DELETE FROM seen WHERE publicKey = ?'),
    count: db.prepare('SELECT COUNT(*) AS n FROM seen'),
    // Both evictions, as queries rather than as a scan of every row into
    // memory — which is the whole reason 0018 licensed a store.
    older: db.prepare('DELETE FROM seen WHERE seen < ?'),
    overflow: db.prepare(`DELETE FROM seen WHERE publicKey IN (
      SELECT publicKey FROM seen ORDER BY seen ASC LIMIT ?)`),
    clear: db.prepare('DELETE FROM seen'),
  };

  function row(r) {
    if (!r) return null;
    return { at: r.at, url: r.url, label: r.label, seen: r.seen };
  }

  const store = {
    path: dbPath(rootDir),

    seen: {
      get: function (publicKey) { return row(q.get.get(String(publicKey || ''))); },
      put: function (publicKey, what) {
        q.put.run(String(publicKey || ''),
          String((what && what.at) || ''), String((what && what.url) || ''),
          String((what && what.label) || ''), Number((what && what.seen) || 0));
        return row(q.get.get(String(publicKey || '')));
      },
      forget: function (publicKey) { return q.del.run(String(publicKey || '')).changes > 0; },
      size: function () { return q.count.get().n; },
      // ── R4'S TWO EVICTIONS ───────────────────────────────────────
      //
      //   Andy: "route expiry has two evictions: cache-limit, and last
      //   seen."
      //
      // Neither does the other's job (0016): a space bound alone leaves a
      // cache frozen while there is room, and an age bound alone leaves it
      // unbounded while there is not.
      sweepOlderThan: function (cutoffMs) { return q.older.run(Number(cutoffMs)).changes; },
      sweepToSize: function (maxEntries) {
        const over = q.count.get().n - Number(maxEntries);
        if (over <= 0) return 0;
        return q.overflow.run(over).changes;
      },
      clear: function () { return q.clear.run().changes; },
    },

    transaction: function (fn) {
      db.exec('BEGIN');
      try { const out = fn(); db.exec('COMMIT'); return out; }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },

    close: function () {
      try { db.close(); } catch (e) { /* already closed */ }
      open_.delete(key);
    },
  };

  open_.set(key, store);
  return store;
}

module.exports = {
  open: open,
  available: available,
  dbPath: dbPath,
};
