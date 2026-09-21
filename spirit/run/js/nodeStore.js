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
// BUSINESS THIS NODE HAS BEEN DOING (seenPeers.js). A row swept for space
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

// What a row may be marked (0021). Empty is "nobody chose": the default,
// and the first in line when space runs out.
const CHOICES = ['', 'ignored', 'held', 'added'];

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
  // path, and a millisecond count is what that path wants: the one
  // eviction orders by it within each tier of the mark (0021).
  db.exec(`
    CREATE TABLE IF NOT EXISTS seen (
      publicKey TEXT PRIMARY KEY,
      label     TEXT    NOT NULL DEFAULT '',
      labelRank INTEGER NOT NULL DEFAULT 4,
      labelAt   INTEGER NOT NULL DEFAULT 0,
      present   INTEGER NOT NULL DEFAULT 0,
      seen      INTEGER NOT NULL DEFAULT 0,
      choice    TEXT    NOT NULL DEFAULT '',
      blocked   INTEGER NOT NULL DEFAULT 0
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

  // ── THE POST QUEUE, SO AN INTENT OUTLIVES THE PROCESS (cycle R16) ───
  //
  //   Andy: patience "could be days for a text message".
  //
  // One row per message this node has promised to send and not yet
  // settled, keyed by its hash. `body` is the signed wire body, text and
  // all — and that was the gate this cycle had to clear first: it is
  // correspondence, and correspondence belongs on the readable side
  // (A-CORRESPONDENT-NODE).
  //
  // IT IS ALREADY THERE. peerPost writes the outgoing message, payload
  // included, to the traffic log BEFORE it is queued ("written before the
  // transport is touched"). The readable, permanent copy exists first;
  // this is the working duplicate the machine needs in order to send it,
  // and `secure_delete` takes it off the disc when it settles.
  //
  // TIMES ARE WALL-CLOCK HERE AND MONOTONIC IN THE QUEUE. A monotonic
  // reading means nothing to the next process, so peerPost converts on
  // the way out and back again on the way in.
  db.exec(`
    CREATE TABLE IF NOT EXISTS queue (
      hash      TEXT    PRIMARY KEY,
      seq       INTEGER NOT NULL,
      relayUrl  TEXT    NOT NULL DEFAULT '',
      toKey     TEXT    NOT NULL DEFAULT '',
      kind      TEXT    NOT NULL DEFAULT '',
      body      TEXT    NOT NULL,
      bytes     INTEGER NOT NULL DEFAULT 0,
      attempts  INTEGER NOT NULL DEFAULT 0,
      atWall    INTEGER NOT NULL DEFAULT 0,
      untilWall INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS queue_order ON queue (seq);
    CREATE TABLE IF NOT EXISTS queue_backoff (
      relayUrl  TEXT    NOT NULL,
      toKey     TEXT    NOT NULL,
      untilWall INTEGER NOT NULL DEFAULT 0,
      lastWait  INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (relayUrl, toKey)
    );
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
    // THE MARK (0021, R38). Nothing to copy: a row that predates it was
    // chosen by nobody, which is what the defaults say. The book writes
    // its marks on its next save, and the node saves it at boot.
    if (cols.indexOf('choice') === -1) db.exec("ALTER TABLE seen ADD COLUMN choice TEXT NOT NULL DEFAULT ''");
    if (cols.indexOf('blocked') === -1) db.exec("ALTER TABLE seen ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0");

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

  // ── THE CHOSEN, BY INDEX (0021) ──────────────────────────────────────
  //
  //   Andy: "so there might be a index in the shadow row, that only
  //   return the "chosen" ones...."
  //
  // Partial, so a node that remembers thirty thousand strangers and
  // chose forty people keeps an index of forty. Created after the
  // migration because it names columns an old file gains only there.
  db.exec("CREATE INDEX IF NOT EXISTS seen_chosen ON seen (choice) WHERE choice <> '' OR blocked = 1");

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
    qPut: db.prepare(`INSERT INTO queue
      (hash, seq, relayUrl, toKey, kind, body, bytes, attempts, atWall, untilWall)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(hash) DO UPDATE SET attempts = excluded.attempts,
        untilWall = excluded.untilWall`),
    qAttempts: db.prepare('UPDATE queue SET attempts = ? WHERE hash = ?'),
    qDel: db.prepare('DELETE FROM queue WHERE hash = ?'),
    qAll: db.prepare('SELECT * FROM queue ORDER BY seq ASC'),
    qMaxSeq: db.prepare('SELECT COALESCE(MAX(seq), 0) AS n FROM queue'),
    bPut: db.prepare(`INSERT INTO queue_backoff (relayUrl, toKey, untilWall, lastWait)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(relayUrl, toKey) DO UPDATE SET untilWall = excluded.untilWall,
        lastWait = excluded.lastWait`),
    bDel: db.prepare('DELETE FROM queue_backoff WHERE relayUrl = ? AND toKey = ?'),
    bAll: db.prepare('SELECT * FROM queue_backoff'),
    // A backoff that has run out is not worth carrying into a new process.
    bExpired: db.prepare('DELETE FROM queue_backoff WHERE untilWall <= ?'),
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
    // ── ONE EVICTION, AND THE MARK DECIDES WHO IS IN LINE (0021) ─────
    //
    //   Andy: "it's the chosen-mark that gives protection from eviction,
    //   if the memory overflows. the shedded rows will first be ignored,
    //   then held, once the memory is full with 'added' statuses no more
    //   can be chosen/added until eviction by blocking or ignoring...."
    //
    // Unchosen first, then ignored and blocked, then held; last seen
    // orders each tier. An added, unblocked row is not in the queue at all
    // — that is the protection, and it is a WHERE, not a weight, so no
    // amount of pressure reaches it. Blocking someone puts them back in
    // line: "what's the point of storing ignored rows when all the space
    // is used by chosen ones?"
    //
    // THE AGE EVICTION STOOD BESIDE THIS, and is gone (0021): "I don't see
    // why the node should throw away memories when the 20 Megabyte cap is
    // not exhausted yet." Age still orders the line; it no longer starts it.
    shedCount: db.prepare(`SELECT COUNT(*) AS n FROM seen WHERE NOT (choice = 'added' AND blocked = 0)`),
    overflow: db.prepare(`DELETE FROM seen WHERE publicKey IN (
      SELECT publicKey FROM seen WHERE NOT (choice = 'added' AND blocked = 0)
      ORDER BY CASE WHEN choice = 'held' AND blocked = 0 THEN 2
                    WHEN choice = 'ignored' OR blocked = 1 THEN 1
                    ELSE 0 END ASC,
               seen ASC
      LIMIT ?)`),
    // The mark alone. A row the mark creates has never been SEEN — a
    // contact added by pasting a key — so its date is 0 and its presence
    // unknown, which is the truth rather than a guess.
    mark: db.prepare(`INSERT INTO seen (publicKey, present, seen, choice, blocked)
      VALUES (?, -1, 0, ?, ?)
      ON CONFLICT(publicKey) DO UPDATE SET choice = excluded.choice, blocked = excluded.blocked`),
    unmarkBook: db.prepare(`UPDATE seen SET choice = '', blocked = 0
      WHERE choice IN ('held', 'added') OR blocked = 1`),
    chosen: db.prepare(`SELECT publicKey, choice, blocked FROM seen
      WHERE choice <> '' OR blocked = 1`),
    // WHO A SEARCH OF MEMORY READS (R39), in two halves.
    //
    // The chosen, all of them, through the partial index: the owner's own
    // people are always compared ("chosen ones should always be
    // included"), and their name may live only in the book.
    //
    // Everybody else, NEWEST FIRST AND CAPPED — Andy: "we'll run those
    // searches down a newest-first key and cap at 1000 rows compared".
    // `seen_when` is that key; a row with no name cannot match what a
    // person types and is not read.
    // The first clause is the partial index's own condition, repeated
    // word for word: SQLite uses a partial index only when the query
    // states its WHERE, and without it this scanned every row.
    recallChosen: db.prepare(`SELECT publicKey, label, present, seen, choice, blocked FROM seen
      WHERE (choice <> '' OR blocked = 1) AND (choice IN ('held', 'added') OR blocked = 1)`),
    recallRecent: db.prepare(`SELECT publicKey, label, present, seen, choice, blocked FROM seen
      WHERE label <> '' AND choice NOT IN ('held', 'added') AND blocked = 0
      ORDER BY seen DESC LIMIT ?`),
    clear: db.prepare('DELETE FROM seen'),
    pages: db.prepare('PRAGMA page_count'),
    pageSize: db.prepare('PRAGMA page_size'),
    // THE CACHE'S OWN PAGES, AND ONLY THOSE (cycle R16). This file holds
    // the post queue too now, and the owner's cap is on "maximum cache
    // size" — not on messages waiting to be sent. Measuring the whole file
    // would let a backed-up queue evict the shadow to make room for
    // itself, and at the 1 MB floor could empty it entirely. `dbstat`
    // counts the b-tree pages of the named tables and their indexes.
    cacheBytes: db.prepare(`SELECT COALESCE(SUM(pgsize), 0) AS n FROM dbstat
      WHERE name IN (SELECT name FROM sqlite_schema WHERE tbl_name IN ('seen', 'seen_routes'))`),
  };

  function row(r) {
    if (!r) return null;
    return {
      label: r.label, labelRank: r.labelRank, labelAt: r.labelAt,
      // null rather than false when nobody has said, so a caller cannot
      // paint somebody red on the strength of never having heard.
      present: r.present < 0 ? null : !!r.present,
      seen: r.seen,
      choice: r.choice || '',
      blocked: !!r.blocked,
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
      // ── THE MARK (0021) ──────────────────────────────────────────
      //
      // One of '', 'ignored', 'held', 'added', with blocked beside it
      // rather than in it — the same shape contacts.js keeps, where a
      // block must not erase how somebody arrived.
      mark: function (publicKey, choice, blocked) {
        const key = String(publicKey || '').trim();
        const c = CHOICES.indexOf(choice) === -1 ? '' : choice;
        if (!key) return false;
        q.mark.run(key, c, blocked ? 1 : 0);
        return true;
      },
      // THE BOOK'S MARKS, WHOLE. Everything the book said last time is
      // taken off and what it says now is put on, in one transaction, so
      // a key that left the book loses its protection in the same instant.
      // 'ignored' is not the book's to clear: the door wrote it.
      markBook: function (marks) {
        store.transaction(function () {
          q.unmarkBook.run();
          (marks || []).forEach(function (m) {
            if (m && m.publicKey) q.mark.run(String(m.publicKey), CHOICES.indexOf(m.choice) === -1 ? '' : m.choice, m.blocked ? 1 : 0);
          });
        });
      },
      chosen: function () {
        return q.chosen.all().map(function (r) {
          return { publicKey: r.publicKey, choice: r.choice, blocked: !!r.blocked };
        });
      },
      recall: function (strangerRows) {
        const limit = Math.max(0, Math.floor(Number(strangerRows)));
        const rows = q.recallChosen.all().concat(
          isFinite(limit) ? q.recallRecent.all(limit) : []);
        return rows.map(function (r) {
          return {
            publicKey: r.publicKey, label: r.label,
            present: r.present < 0 ? null : !!r.present, seen: r.seen,
            choice: r.choice || '', blocked: !!r.blocked,
          };
        });
      },
      // Rows the sweep may still take. Zero, with the cache over its cap,
      // is what "full" means: only added people are left.
      sheddable: function () { return q.shedCount.get().n; },
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
      // MEASURED, NOT ESTIMATED. The cache's own pages, read from `dbstat`,
      // not an assumption about what a row costs — which matters because a
      // label is free-form and a row is not a fixed size. (This read the
      // whole file until the queue moved in beside it; see `cacheBytes`.)
      // What the CACHE occupies, not the file: see `cacheBytes` above. The
      // file's own size is still what `fileBytes` answers, and what the
      // vacuum below keeps honest.
      bytes: function () { return q.cacheBytes.get().n; },
      fileBytes: function () { return q.pages.get().page_count * q.pageSize.get().page_size; },
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
          const left = q.shedCount.get().n;
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

    // ── THE QUEUE, AS ROWS ────────────────────────────────────────
    //
    // Written through by peerPost as entries change, read once when a node
    // starts. `seq` here is only an ORDER — the queue hands out its own
    // numbers in a new process — so it is assigned from the table rather
    // than trusted from a queue that may have restarted from 1.
    queue: {
      put: function (row) {
        const seq = row.seq || (q.qMaxSeq.get().n + 1);
        q.qPut.run(String(row.hash), seq, String(row.relayUrl || ''), String(row.toKey || ''),
          String(row.kind || ''), String(row.body || ''), Number(row.bytes) || 0,
          Number(row.attempts) || 0, Number(row.atWall) || 0, Number(row.untilWall) || 0);
        return seq;
      },
      attempts: function (hash, n) { q.qAttempts.run(Number(n) || 0, String(hash)); },
      del: function (hash) { return q.qDel.run(String(hash)).changes > 0; },
      all: function () { return q.qAll.all(); },
    },
    backoff: {
      put: function (relayUrl, toKey, untilWall, lastWait) {
        q.bPut.run(String(relayUrl), String(toKey), Number(untilWall) || 0, Number(lastWait) || 0);
      },
      del: function (relayUrl, toKey) { q.bDel.run(String(relayUrl), String(toKey)); },
      all: function (nowWall) {
        if (nowWall) q.bExpired.run(Number(nowWall));
        return q.bAll.all();
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
  CHOICES: CHOICES,
  available: available,
  dbPath: dbPath,
};
