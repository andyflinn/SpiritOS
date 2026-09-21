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

// How many ways to reach one person are worth keeping. Three, because a
// peer on several relays is normal and the fourth-best way to reach
// somebody has never been the one that worked.
const MAX_ROUTES = 3;

function open(rootDir, opts) {
  const key = path.resolve(rootDir);
  if (open_.has(key)) return open_.get(key);
  const maxRoutes = (opts && opts.maxRoutes) || MAX_ROUTES;

  fs.mkdirSync(path.join(rootDir, 'relay-state'), { recursive: true });
  const db = new (driver().DatabaseSync)(dbPath(rootDir));
  db.exec('PRAGMA journal_mode = DELETE');
  db.exec('PRAGMA synchronous = FULL');
  db.exec('PRAGMA secure_delete = ON');
  // ── THE FILE HAS TO SHRINK, OR A BYTE CAP CANNOT BE HONOURED ────
  //
  // SQLite keeps a deleted row's pages on a free list and the file stays
  // the size it reached. A cap measured in bytes would then evict for
  // ever after one busy week, because the number it reads never comes
  // back down.
  //
  // INCREMENTAL rather than FULL: FULL vacuums at every commit, and this
  // store is written on every presence broadcast. Incremental leaves the
  // pages until somebody asks, and the only caller that asks is the
  // eviction that just freed them.
  //
  // SET BEFORE THE FIRST TABLE, because that is the only moment SQLite
  // accepts it on a new database. A file made before this line existed
  // would need a VACUUM to change it; none exists outside this repo's own
  // fixtures, so no migration is written for a case that cannot happen.
  db.exec('PRAGMA auto_vacuum = INCREMENTAL');

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
      label     TEXT    NOT NULL DEFAULT '',
      labelRank INTEGER NOT NULL DEFAULT 4,
      labelAt   INTEGER NOT NULL DEFAULT 0,
      present   INTEGER NOT NULL DEFAULT 0,
      seen      INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS seen_when ON seen (seen);
  `);

  // ── A ROUTE IS A PAIR OF DOORS, NOT AN ADDRESS (cycle R1, R29) ────
  //
  //   Andy: "peer-key / A-key / B-key — that the key?" — yes.
  //
  // A route is not "this peer lives at B". It is **through MY relay A, to
  // THEIR relay B**, and the difference is operational rather than
  // pedantic: if this node is a member of A and C, and A partners with B
  // while C does not, then posting through C fails and through A works.
  // Keyed by the destination alone, the working door and the useless one
  // would be the same row and one would overwrite the other.
  //
  // So the key is the triple, and `via` is half the route rather than a
  // note about where it came from. R1 said this from the start — "a route
  // becomes { via, at, seen }" — and a later summary lost it.
  //
  // `via` MAY BE EMPTY, for a route learned before anything recorded which
  // door proved it. That is a real state and not a defect: an empty `via`
  // means "somebody told me they are at B", which is worth keeping and
  // worth ranking below a route that names the door.
  db.exec(`
    CREATE TABLE IF NOT EXISTS seen_routes (
      publicKey TEXT    NOT NULL,
      via       TEXT    NOT NULL DEFAULT '',
      at        TEXT    NOT NULL,
      url       TEXT    NOT NULL DEFAULT '',
      rank      INTEGER NOT NULL DEFAULT 4,
      told      INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (publicKey, via, at)
    );
    CREATE INDEX IF NOT EXISTS seen_routes_peer ON seen_routes (publicKey, rank, told DESC);
  `);

  // ── THE MIGRATION FROM THE MORNING'S SHAPE ───────────────────
  //
  // `node.db` shipped a few hours before this with `at` and `url` on the
  // peer row — one route, no `via`, no rank. Any node that has run since
  // has one, so this is a real migration and not a hypothetical.
  //
  // Asked of the table rather than guarded by a version number: a schema
  // that answers what it has needs no second place to record what it had.
  (function migrate() {
    let cols;
    try {
      cols = db.prepare('PRAGMA table_info(seen)').all().map(function (c) { return c.name; });
    } catch (e) { return; }

    // The new columns first, so the copy below can be read back.
    if (cols.indexOf('labelRank') === -1) db.exec("ALTER TABLE seen ADD COLUMN labelRank INTEGER NOT NULL DEFAULT 4");
    if (cols.indexOf('labelAt') === -1) db.exec("ALTER TABLE seen ADD COLUMN labelAt INTEGER NOT NULL DEFAULT 0");
    if (cols.indexOf('present') === -1) db.exec("ALTER TABLE seen ADD COLUMN present INTEGER NOT NULL DEFAULT -1");

    // THE OLD SINGLE ROUTE BECOMES A ROW IN THE NEW TABLE, at rank 4 and
    // with no `via`: nothing recorded which door proved it, and claiming
    // otherwise would be inventing provenance. Its `told` is the row's own
    // `seen`, which is the best date anybody has for it.
    if (cols.indexOf('at') !== -1) {
      db.exec(`INSERT OR IGNORE INTO seen_routes (publicKey, via, at, url, rank, told)
        SELECT publicKey, '', at, ${cols.indexOf('url') !== -1 ? 'url' : "''"}, 4, seen
        FROM seen WHERE at <> ''`);
      db.exec('ALTER TABLE seen DROP COLUMN at');
    }
    if (cols.indexOf('url') !== -1) db.exec('ALTER TABLE seen DROP COLUMN url');
  }());

  const q = {
    get: db.prepare('SELECT * FROM seen WHERE publicKey = ?'),
    // ── RANK FIRST, RECENCY SECOND ─────────────────────────
    //
    // The third appearance of one pattern: the post scheduler's "class
    // outranks age", the partner roll's "keyed outranks unkeyed", and
    // this. A cheap claim never displaces a proven one.
    //
    // 1 the relay that HOLDS the peer said so   — label and route
    // 2 proved by a signature this node checked — route
    // 3 a packet arrived from there             — route
    // 4 second-hand, carried by a partner       — both, weakly
    routesFor: db.prepare(
      'SELECT * FROM seen_routes WHERE publicKey = ? ORDER BY rank ASC, told DESC'),
    putRoute: db.prepare(`INSERT INTO seen_routes (publicKey, via, at, url, rank, told)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(publicKey, via, at) DO UPDATE SET
        url  = CASE WHEN excluded.url <> '' THEN excluded.url ELSE seen_routes.url END,
        rank = MIN(excluded.rank, seen_routes.rank),
        told = excluded.told`),
    // WORST FIRST WHEN THERE IS NO ROOM. The opposite order from the peer
    // table's eviction, and deliberately: rows there are bounded by how
    // many people exist, rows here by how many ways there are to reach
    // ONE person — and the ways worth keeping are the best-ranked, not the
    // newest.
    trimRoutes: db.prepare(`DELETE FROM seen_routes WHERE publicKey = ? AND rowid NOT IN (
      SELECT rowid FROM seen_routes WHERE publicKey = ? ORDER BY rank ASC, told DESC LIMIT ?)`),
    dropRoutes: db.prepare('DELETE FROM seen_routes WHERE publicKey = ?'),
    orphanRoutes: db.prepare(
      'DELETE FROM seen_routes WHERE publicKey NOT IN (SELECT publicKey FROM seen)'),
    clearRoutes: db.prepare('DELETE FROM seen_routes'),
    // GREEDY, IN ONE STATEMENT. A field is written when the caller has one
    // and left alone when it does not — the callers do not all know the
    // same things, and a search that taught a label must not have it
    // blanked by the next packet that arrives. `excluded` is the row being
    // inserted; `seen.at` is what is already there.
    // GREEDY, AND NOW ALSO REFUSING A DOWNGRADE. The old statement kept a
    // field when the caller had none; this one additionally keeps it when
    // the caller HAS one but is less entitled to be believed.
    //
    // `<=` on the rank, not `<`: an equally entitled source that spoke
    // more recently wins, which is recency doing its job underneath rank.
    //
    // PRESENCE IS THREE STATES, NOT TWO, and the column stores all three:
    // -1 nobody has said, 0 said absent, 1 said present.
    //
    // This started as a two-state column with -1 as a "no opinion"
    // sentinel that the CASE below would swallow. It did not survive a
    // first INSERT — ON CONFLICT does not fire then, so -1 landed in the
    // column and `!!(-1)` reported a stranger as present. Clamping it to 0
    // on insert then broke the other half: `excluded.present` became 0, so
    // a silent caller marked a present peer absent.
    //
    // The bug was pointing at the model. contacts.js has had three marks
    // all along — "WHITE is NOT a dimmer red. A contact we share no relay
    // with is not offline, they are UNSEEN" — and 0019 rests on the same
    // distinction. Two states could not hold it.
    put: db.prepare(`INSERT INTO seen (publicKey, label, labelRank, labelAt, present, seen)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(publicKey) DO UPDATE SET
        label     = CASE WHEN excluded.label <> '' AND excluded.labelRank <= seen.labelRank
                         THEN excluded.label ELSE seen.label END,
        labelRank = CASE WHEN excluded.label <> '' AND excluded.labelRank <= seen.labelRank
                         THEN excluded.labelRank ELSE seen.labelRank END,
        labelAt   = CASE WHEN excluded.label <> '' AND excluded.labelRank <= seen.labelRank
                         THEN excluded.labelAt ELSE seen.labelAt END,
        present   = CASE WHEN excluded.present < 0 THEN seen.present ELSE excluded.present END,
        seen      = excluded.seen`),
    del: db.prepare('DELETE FROM seen WHERE publicKey = ?'),
    count: db.prepare('SELECT COUNT(*) AS n FROM seen'),
    // Both evictions, as queries rather than as a scan of every row into
    // memory — which is the whole reason 0018 licensed a store.
    older: db.prepare('DELETE FROM seen WHERE seen < ?'),
    overflow: db.prepare(`DELETE FROM seen WHERE publicKey IN (
      SELECT publicKey FROM seen ORDER BY seen ASC LIMIT ?)`),
    clear: db.prepare('DELETE FROM seen'),
    pages: db.prepare('PRAGMA page_count'),
    pageSize: db.prepare('PRAGMA page_size'),
  };

  function row(r) {
    if (!r) return null;
    return {
      label: r.label, labelRank: r.labelRank, labelAt: r.labelAt,
      // null rather than false when nobody has said, so a caller cannot
      // paint somebody red on the strength of never having heard.
      present: r.present < 0 ? null : !!r.present,
      seen: r.seen,
    };
  }
  function routeRow(r) {
    return { via: r.via, at: r.at, url: r.url, rank: r.rank, told: r.told };
  }

  const store = {
    path: dbPath(rootDir),

    seen: {
      get: function (publicKey) { return row(q.get.get(String(publicKey || ''))); },
      // `present` is three-valued in both directions: true, false, or
      // nothing said. A search answer knows presence; an arriving route
      // announcement does not — and a caller with nothing to say must not
      // be able to mark somebody away by staying silent.
      put: function (publicKey, what) {
        const w = what || {};
        const present = w.present === true ? 1 : (w.present === false ? 0 : -1);
        q.put.run(String(publicKey || ''),
          String(w.label || ''), Number(w.labelRank || 4), Number(w.labelAt || w.seen || 0),
          present, Number(w.seen || 0));
        return row(q.get.get(String(publicKey || '')));
      },
      // ── ROUTES ───────────────────────────────────────
      //
      // Best-ranked first, and capped: a peer on several relays is normal
      // and a node on several relays is normal, but the tail of a list of
      // ways to reach one person is worth less than the head.
      routes: function (publicKey) {
        return q.routesFor.all(String(publicKey || '')).map(routeRow);
      },
      // A route with no destination teaches nothing. `via` may be empty —
      // that is "somebody told me they are at B" and is worth keeping.
      putRoute: function (publicKey, what) {
        const w = what || {};
        const key = String(publicKey || '');
        const at = String(w.at || '').trim();
        if (!key || !at) return false;
        q.putRoute.run(key, String(w.via || '').trim(), at,
          String(w.url || ''), Number(w.rank || 4), Number(w.told || 0));
        if (maxRoutes > 0) q.trimRoutes.run(key, key, maxRoutes);
        return true;
      },
      forget: function (publicKey) {
        // The routes go with the peer: a row in `seen_routes` for somebody
        // no longer in `seen` is unreachable by every reader here.
        q.dropRoutes.run(String(publicKey || ''));
        return q.del.run(String(publicKey || '')).changes > 0;
      },
      size: function () { return q.count.get().n; },
      // ── R4'S TWO EVICTIONS ───────────────────────────────────────
      //
      //   Andy: "route expiry has two evictions: cache-limit, and last
      //   seen."
      //
      // Neither does the other's job (0016): a space bound alone leaves a
      // cache frozen while there is room, and an age bound alone leaves it
      // unbounded while there is not.
      // ── PAGES GO BACK WHEN ROWS DO ─────────────────────────
      //
      // `auto_vacuum = INCREMENTAL` frees a deleted row's pages to a list
      // and leaves the file the size it reached until somebody asks. So
      // every bulk delete asks — but ONLY when it actually deleted
      // something, because the age sweep runs on every note() and
      // vacuuming a file nothing was removed from is pure cost.
      sweepOlderThan: function (cutoffMs) {
        const gone = q.older.run(Number(cutoffMs)).changes;
        // EVERY EVICTION TAKES THE ROUTES WITH IT. Swept by what is left
        // rather than by what went, so an eviction that happens any other
        // way cannot leave orphans behind either.
        if (gone) { q.orphanRoutes.run(); db.exec('PRAGMA incremental_vacuum'); }
        return gone;
      },
      // ── THE SPACE BOUND IS BYTES, BECAUSE THAT IS WHAT AN OWNER HAS ──
      //
      //   Andy: "why is the max for nodeStore not in Megabytes: it's say
      //   20 MBytes = 10 jpeg images from a modern cell phone?"
      //
      // It was a row count, which is a unit nobody thinks in and which
      // said nothing about the thing being spent. Measured at 225 bytes a
      // row on a real file including its index, the old `MAX_ENTRIES =
      // 500` was 110 KB — about a five-hundredth of what a person would
      // consider reasonable, and unknowably so from the number itself.
      //
      // MEASURED, NOT ESTIMATED. `page_count × page_size` is the file, not
      // an assumption about what a row costs — which matters because a
      // label is free-form and a row is not a fixed size.
      bytes: function () { return q.pages.get().page_count * q.pageSize.get().page_size; },
      sweepToBytes: function (maxBytes) {
        const cap = Number(maxBytes);
        if (!(cap > 0) || store.seen.bytes() <= cap) return 0;
        let gone = 0;
        // A CHUNK AT A TIME, oldest first, re-measuring between. One row
        // per pass would be one vacuum per row; all-at-once would need to
        // know the answer in advance, which is the estimate this replaced.
        // The guard is against a cap so small that nothing empties it —
        // an empty store still has a page.
        for (let pass = 0; pass < 64; pass += 1) {
          const left = q.count.get().n;
          if (!left || store.seen.bytes() <= cap) break;
          gone += q.overflow.run(Math.max(1, Math.ceil(left / 8))).changes;
          q.orphanRoutes.run();
          db.exec('PRAGMA incremental_vacuum');
        }
        return gone;
      },
      clear: function () {
        q.clearRoutes.run();
        const gone = q.clear.run().changes;
        if (gone) db.exec('PRAGMA incremental_vacuum');
        return gone;
      },
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
  MAX_ROUTES: MAX_ROUTES,
  available: available,
  dbPath: dbPath,
};
