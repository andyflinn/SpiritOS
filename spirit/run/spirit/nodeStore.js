'use strict';

// spirit/run/spirit/nodeStore.js
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
// CONTACTS ARE HERE SINCE goal/G40.11 (Andy's box, v24: "contacts.json, the relays table and the peers table move
// into it and go"): one table for every known ID, the owner's chosen ones flagged keep. NOT identity.json, allow.json or
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

// ONE RECORD ROW AS relay.record ANSWERS IT: a report's figures, or an
// edge ('started', 'stopped', ...) as `was`. Shared by series (oldest first
// from a start) and window (newest first, puppets/G2).
function seriesRow(r) {
  if (r.kind !== 'report') return { at: r.at, was: r.kind };
  let seats = null;
  try { seats = (JSON.parse(r.rest || '{}') || {}).seats || null; }
  catch (e) { seats = null; }
  return {
    at: r.at,
    members: r.members,
    connected: r.connected,
    allowance: r.allowance,
    routes: r.routes,
    rssMB: r.rssMB,
    // cycle 11's R7: the seat figures are the series every
    // tightening lever reads from, so they cross as answers
    // rather than being dug out of `rest` by a caller.
    free: seats && typeof seats.free === 'number' ? seats.free : null,
    outstanding: seats && typeof seats.outstanding === 'number' ? seats.outstanding : null,
  };
}

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

// The node log's fields, in the order trafficLog.js writes them, each with
// the type it has held on Andy's node (traffic.jsonl surveyed 2026-09-28):
// text, a number, or true/false stored as 1/0. Typed, so an index on hash or
// at holds the plain value and a lookup compares it plainly (wsl-claude,
// before transport/R19.4). A value that does not have its column's type,
// and any field not named here, goes to `extra` as JSON: nothing is lost
// and nothing is reshaped.
const TRAFFIC_TYPES = {
  at: 'text', dir: 'text', kind: 'text', peer: 'text', relay: 'text', hash: 'text', outcome: 'text',
  admitted: 'bool', status: 'int', code: 'text', ms: 'int', payload: 'text', bytes: 'int',
  event: 'text', label: 'text', invite: 'text', key: 'text', why: 'text', owner: 'bool',
  revoked: 'int', invitesRevoked: 'int', expiresAt: 'text', cause: 'text', mark: 'text',
};
const TRAFFIC_COLUMNS = Object.keys(TRAFFIC_TYPES);
const SQL_TYPE = { text: 'TEXT', int: 'INTEGER', bool: 'INTEGER' };
function trafficFits(type, v) {
  if (type === 'text') return typeof v === 'string';
  if (type === 'int') return typeof v === 'number' && isFinite(v);
  return typeof v === 'boolean';
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
// THE WHOLE FILE'S CAP, and what goes past it (goal/G30.19; Andy: "cap in to 16 MB"): see shedToCap.
const MAX_DB_BYTES = 16 * 1024 * 1024;
const SHED_CHUNK = 256;
// The backlog a page is handed when it opens: the untaken packets of the last day (Andy: "one day.").
const BACKLOG_MS = 24 * 60 * 60 * 1000;

// ── WHAT IS NEVER KEPT (cycle 11's R5) ────────────────────────────
//
// THIS IS D1, THE CYCLE'S ONE DIVERGENCE, RESOLVED. The suite's author
// and the implementer read this cycle's R5 differently, and neither
// had misread it:
// this cycle's R1 says keep any figure nobody thought to name, so a
// later question has something to ask of; R5 in the same cycle says
// never keep
// people. A name arriving as a plain STRING is exactly where those two
// meet, and the document did not say which yields.
//
// The first version filtered BY SHAPE — arrays and objects became
// counts — which handles how people arrive today (invites, partners, a
// roll) and let a plain string through. Measured against spirit-3's real
// report, that kept `"owner":"Andy Flinn"` and the relay's public key
// verbatim, in every row, in a tier the same cycle never deletes.
//
// ── AN ALLOW-LIST, AND WHY: IT FAILS IN THE SAFE DIRECTION ────────
//
// wsl-claude's argument, and it is better than the one that was offered
// for it: if somebody adds a figure and nobody classifies it, an
// allow-list simply DROPS it — a lost column, and a column can be added
// back. A deny-list that forgets keeps a person's name for ever in the
// tier that is never deleted, and that cannot be taken back. One mistake
// costs a column; the other is permanent.
//
// So: numbers and booleans always, plus a short NAMED list of strings
// that are facts about the BOX rather than about people.
//
// A PUBLIC KEY IS NOT ON THE LIST, and that is his too. A key identifies
// a person as reliably as a name and worse — it is exact, and it is
// permanent.
const KEEP_STRINGS = [
  'mode',      // which mode the relay is in
  'version',   // which code was running when a figure moved
];

// ── AND THE RECORD ADMITS WHAT IT WITHHELD ──────────────────────────
//
// wsl-claude's second addition: keep the NAMES of the fields that were
// dropped, never their contents. `owner` is a field name; "Andy Flinn"
// is a person. Without this the record looks like a report that never
// carried those fields, and whoever maintains the list above cannot see
// what is actually arriving to be classified.
function keptFigures(report) {
  const out = {};
  const dropped = [];
  Object.keys(report || {}).forEach(function (k) {
    const v = report[k];
    if (typeof v === 'number' || typeof v === 'boolean') { out[k] = v; return; }
    if (typeof v === 'string') {
      if (KEEP_STRINGS.indexOf(k) !== -1) out[k] = v;
      else dropped.push(k);
      return;
    }
    if (Array.isArray(v)) { out[k] = v.length; return; }
    if (v && typeof v === 'object') { out[k] = keptFigures(v).kept; return; }
    if (v != null) dropped.push(k);
  });
  return { kept: out, dropped: dropped };
}

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

  // ── ONE TABLE FOR ALL KNOWN IDS (goal/G40.11) ────────────────────────
  //
  //   Andy, 2026-10-25 and 26, box v24: seen "is the one table. contacts.json, the relays table and the peers table
  //   move into it and go. The grants table stays its own, keyed by ID."
  //
  // One row per ID other than the node itself. Keyed by ID, so somebody seen a thousand times is one row and growth
  // is bounded by distinct IDs rather than by traffic. Every row: label (with how sure, labelRank, and when, labelAt),
  // myLabel, card, present, firstSeen, lastSeen, and seven booleans:
  //
  //   keep     a chosen contact, never shed       mine     owned (puppets, owned relays), never shed
  //   relay    the ID is a relay                  held     waits for the owner's yes
  //   ignored  politely refused, never shown      blocked  refused, a relay as well as a node
  //   seated   that ID holds this node: a relay its seat, a node its chosen contacts
  //
  // A CARD IS KEPT ONLY SIGNED BY THE ROW'S ID (contacts.setCard checks it); any other is refused and nothing of it
  // kept. TIMES ARE MILLISECONDS, unlike relay.db's ISO strings: they are compared and ordered on the shedding path.
  // `present` is three-valued: -1 nobody has said, 0 said absent, 1 said present.
  //
  // THE OLD SHAPE IS SET ASIDE FIRST, so the table below is made new and the move (moveIn, after every table exists)
  // copies the old rows in: a seen with no `keep` is the shadow before this item, whichever earlier shape it has.
  const SEEN_FLAGS = ['keep', 'mine', 'relay', 'held', 'ignored', 'blocked', 'seated'];
  const GRANT_NAME = "COALESCE(NULLIF(s.myLabel, ''), s.label, '')";
  const oldSeen = (function () {
    const cols = db.prepare('PRAGMA table_info(seen)').all().map(function (c) { return c.name; });
    if (!cols.length || cols.indexOf('keep') !== -1) return null;
    db.exec('DROP INDEX IF EXISTS seen_when; DROP INDEX IF EXISTS seen_chosen; ALTER TABLE seen RENAME TO seen_old');
    return cols;
  }());
  db.exec(`
    CREATE TABLE IF NOT EXISTS seen (
      publicKey TEXT PRIMARY KEY,
      label     TEXT    NOT NULL DEFAULT '',
      labelRank INTEGER NOT NULL DEFAULT 4,
      labelAt   INTEGER NOT NULL DEFAULT 0,
      present   INTEGER NOT NULL DEFAULT -1,
      myLabel   TEXT    NOT NULL DEFAULT '',
      card      TEXT    NOT NULL DEFAULT '',
      face      TEXT    NOT NULL DEFAULT '',
      firstSeen INTEGER NOT NULL DEFAULT 0,
      lastSeen  INTEGER NOT NULL DEFAULT 0,
      ${SEEN_FLAGS.map(function (f) { return f + ' INTEGER NOT NULL DEFAULT 0'; }).join(',\n      ')}
    );
  `);
  // THE FACE NAME THIS NODE HOLDS ON A RELAY, on that relay's row (Andy, 2026-10-26, goal/G40.11: "keep it, on the
  // relay's row, as the node's own fact, like myLabel"): the node set it itself (relay.face, the relay said yes). Added
  // to a table made before it.
  if (db.prepare('PRAGMA table_info(seen)').all().every(function (c) { return c.name !== 'face'; })) {
    db.exec("ALTER TABLE seen ADD COLUMN face TEXT NOT NULL DEFAULT ''");
  }
  // A PARTIAL INDEX PER FLAG, holding only the rows where it is true, and one over the rows with neither keep nor mine,
  // by lastSeen: the line shedding takes. A query uses a partial index only when it repeats its WHERE, which is why
  // the statements below spell those conditions out again.
  db.exec(SEEN_FLAGS.map(function (f) {
    return 'CREATE INDEX IF NOT EXISTS seen_' + f + ' ON seen (lastSeen) WHERE ' + f + ' = 1;';
  }).join('\n') + '\nCREATE INDEX IF NOT EXISTS seen_shed ON seen (lastSeen) WHERE keep = 0 AND mine = 0;');

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
  // A URL IS A ROUTE (goal/G40.11): an ID's own address, a relay's or a node's on a LAN, is a direct route through no
  // relay — via empty, at the ID itself, url the address. The route is the pin: answerRelay's check asks which ID a
  // url's direct route belongs to, one lookup on this index.
  db.exec("CREATE INDEX IF NOT EXISTS seen_routes_url ON seen_routes (url) WHERE url <> ''");

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

  // ── THE RECIPIENT'S REPLAY INDEX (cycle 10's R17 and C2) ───────────
  //
  // A sealed blob replayed to the same recipient THROUGH A DIFFERENT
  // RELAY meets a registered-hash guard that has never seen it — the
  // relay is deliberately not in the associated data (cycle 10's R4),
  // because binding a message to a road would make store-and-forward a
  // routing promise. The gap that leaves is closed here, by the one party
  // who can tell: the recipient.
  //
  // `at` IS THE SENDER'S TIMESTAMP FROM INSIDE THE SEAL, not the hour it
  // arrived. C2: the index is bounded by disc like every dataset here, so
  // it WILL be trimmed — and a row leaving must not silently make an old
  // message replayable again. Keeping the sealed timestamp means a hash
  // can only be dropped once a message bearing it would be refused for
  // age anyway.
  //
  // Not in the envelope, where it would leak and be forgeable. Inside the
  // seal, stamped by `seal()` rather than by each caller.
  //
  // DERIVED, AND REBUILDABLE — FROM THE LOG IN THIS SAME FILE, SINCE
  // transport/R19. Every hash here is also in the node log, and the log now
  // lives in node.db's `traffic` table, so losing node.db loses both: the
  // rebuild no longer covers that case. Andy decided it knowingly, 2026-09-28:
  // "i'm ok with that risk, i'd rather rely on backups, and not worry about
  // it". A rebuild still restores the index from the table if only the index
  // is damaged.
  db.exec(`
    CREATE TABLE IF NOT EXISTS replay (
      hash TEXT PRIMARY KEY,
      at   INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS replay_at ON replay (at);
  `);

  // ── THE OWNER'S RELAY RECORD (cycle 11's R1) ───────────────────────
  //
  //   Andy: "relay record is in the alpha" — kept "node-side app issue",
  //   in a database because "this is not user-stuff, its machine and
  //   network maintenance".
  //
  // Decision 0015 left this open in as many words: a monitor draws the
  // CURRENT report, and the analysis Andy describes needs a SERIES —
  // every move, its capture time, kept. Nothing kept one. The node holds
  // exactly one report per relay, in memory, overwritten
  // (presenceNode.js, `statusByRelay[url] = msg.data`), so a restart lost
  // a history that never existed.
  //
  // WHY THE NODE AND NOT THE RELAY. Only an owner receives a relay's
  // reports at all, and the node already holds the stream they arrive on
  // around the clock. A relay keeping its own history would be a relay
  // storing something for somebody (0006), and a job would be a second
  // writer on a file the node owns.
  //
  // NAMED COLUMNS ARE THE ONES ORDERED AND QUERIED ON. `rest` is the
  // remainder of the report as JSON, so a new figure in relayStatus needs
  // no schema change — a figure nobody thought to name is exactly what a
  // later question wants, and losing it to a migration nobody ran is how
  // a series becomes useless.
  //
  // `kind` SEPARATES A REPORT FROM AN EDGE. Reports arrive on events and
  // never on a timer, so a quiet stretch and an outage are the same
  // absence unless the stream's open and close are written too (cycle 11's R3).
  //
  // `at` IS MILLISECONDS, like `replay` above and unlike relay.db's ISO
  // strings: this one is compared, ordered and swept on, and a
  // millisecond count is what that path wants.
  db.exec(`
    CREATE TABLE IF NOT EXISTS relay_record (
      relay     TEXT    NOT NULL,
      at        INTEGER NOT NULL,
      kind      TEXT    NOT NULL DEFAULT 'report',
      members   INTEGER NOT NULL DEFAULT 0,
      connected INTEGER NOT NULL DEFAULT 0,
      allowance INTEGER NOT NULL DEFAULT 0,
      routes    INTEGER NOT NULL DEFAULT 0,
      rssMB     INTEGER NOT NULL DEFAULT 0,
      rest      TEXT    NOT NULL DEFAULT '',
      PRIMARY KEY (relay, at, kind)
    );
    CREATE INDEX IF NOT EXISTS relay_record_when ON relay_record (relay, at);
  `);

  // ── THE NODE LOG (transport/R19.3) ────────────────────────────────────
  //
  //   Andy, 2026-09-28: the goal is "Moving the node log into machine-side
  //   database"; on the table, "i agree to the keys as well".
  //
  // trafficLog.js owns what a row MEANS and still is the only reader and
  // writer; this file owns where it lives, as it does for every table in
  // node.db. Decided and not to be revisited without him:
  //   - seq INTEGER PRIMARY KEY AUTOINCREMENT: the order rows were written,
  //     never reused, not even after the newest row is deleted;
  //   - a column for every field a row carries, all allowed empty, and
  //     `extra` for any field this list does not name, so nothing is lost;
  //   - every row kept ("the log should be permanent. period."), which is
  //     why it is NOT in the cache cap above: cacheBytes counts only `seen`
  //     and `seen_routes`, so this table can grow without evicting anyone.
  //
  // EACH VALUE IN ITS OWN TYPE, NULL when absent (TRAFFIC_TYPES above), so a
  // row reads back exactly as it was written (true stays true, 3 stays 3)
  // and a reader cannot tell a table row from a file row.
  db.exec(`
    CREATE TABLE IF NOT EXISTS traffic (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      ${TRAFFIC_COLUMNS.map(function (c) { return '"' + c + '" ' + SQL_TYPE[TRAFFIC_TYPES[c]]; }).join(',\n      ')},
      extra TEXT
    );
  `);

  // ── ITS INDEXES (transport/R19.4) ─────────────────────────────────────
  //
  //   Decided with the keys (Andy: "i agree to the keys as well"): one per
  //   reader that asks for a few rows, each PARTIAL so it holds only the rows
  //   that reader can want. read() returns everything, so nothing helps it.
  //   A partial index is used only by a query that repeats its WHERE, which
  //   is why the statements below spell those conditions out again.
  db.exec(`
    CREATE INDEX IF NOT EXISTS traffic_hash ON traffic (hash) WHERE hash <> '';
    CREATE INDEX IF NOT EXISTS traffic_owner_at ON traffic (at) WHERE kind = 'owner';
    CREATE INDEX IF NOT EXISTS traffic_arrivals_at ON traffic (at) WHERE dir = 'in' AND admitted = 1;
  `);

  // ── WHO MAY CALL WHICH API (apiAuth/G1.3) ───────────────────────────
  //
  //   Andy: "the lookup table is in node.db", "grants: peer_id and path, one row per grant; issue inserts it, revoke
  //   deletes it.", "yes we neeed doulbe keyed for selective delete", and on the last revoke: "it disappears." Only
  //   authorization is stored; an empty table is no access for anybody but the owner. "the peer never sees our apiAuth
  //   data": nothing here travels to a member.
  //
  // THE GRANTS TABLE STAYS ITS OWN, KEYED BY ID (goal/G40.11); its peers table moved into seen, so the name a grant
  // shows is that ID's row's.
  db.exec(`
    CREATE TABLE IF NOT EXISTS grants (
      peer_id TEXT NOT NULL,
      path    TEXT NOT NULL,
      PRIMARY KEY (peer_id, path)
    );
  `);

  // ── THE MOVE, ON EACH NODE'S FIRST START ON THIS CODE (goal/G40.11) ──
  //
  //   Andy, 2026-10-26: "yes." to "on each node's first start on the new code, its old stores go into the table, then
  //   are deleted."
  //
  // Four old stores, one table. In one transaction, and contacts.json is deleted only after it commits: a crash leaves
  // the old stores in place and the next start moves them again, and a row already here only gains what it lacked.
  //
  //   the old seen   its rows as they were: choice 'added' is keep, 'held' held, 'ignored' ignored; kind 'relay' is
  //                  relay; `seen` is lastSeen, and the best date there is for firstSeen.
  //   relays         each a relay row: listed is keep, a seat with no refusal is seated, the list's label is myLabel,
  //                  the face name is face, and its url a direct route. The rest of that row is gone with the box
  //                  (seat label, email, refusal: the relay holds what the node gave it).
  //   peers          apiAuth's names, as myLabel where the row has none.
  //   contacts.json  each a kept row, a held one held; owned is mine, the card kept; a relay it was seen on is a route
  //                  to that relay, at hearsay. Shown only signed by its ID: contacts.cardOf verifies on every read.
  (function moveIn() {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(function (r) { return r.name; });
    const has = function (name) { return tables.indexOf(name) !== -1; };
    const bookFile = path.join(rootDir, 'relay-state', 'contacts.json');
    const haveBook = fs.existsSync(bookFile);
    if (!oldSeen && !has('relays') && !has('peers') && !haveBook) return;
    let book = [];
    if (haveBook) {
      try { const parsed = JSON.parse(fs.readFileSync(bookFile, 'utf8')); if (Array.isArray(parsed)) book = parsed; }
      catch (e) { book = []; }
    }
    // A row already here keeps what it has and gains what it lacked; a flag set by any old store stays set.
    const put = db.prepare(`INSERT INTO seen (publicKey, label, labelRank, labelAt, present, myLabel, card, face, firstSeen,
        lastSeen, ${SEEN_FLAGS.join(', ')})
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${SEEN_FLAGS.map(function () { return '?'; }).join(', ')})
      ON CONFLICT(publicKey) DO UPDATE SET
        label     = CASE WHEN seen.label = '' THEN excluded.label ELSE seen.label END,
        labelRank = CASE WHEN seen.label = '' THEN excluded.labelRank ELSE seen.labelRank END,
        labelAt   = CASE WHEN seen.label = '' THEN excluded.labelAt ELSE seen.labelAt END,
        present   = CASE WHEN seen.present < 0 THEN excluded.present ELSE seen.present END,
        myLabel   = CASE WHEN seen.myLabel = '' THEN excluded.myLabel ELSE seen.myLabel END,
        card      = CASE WHEN seen.card = '' THEN excluded.card ELSE seen.card END,
        face      = CASE WHEN seen.face = '' THEN excluded.face ELSE seen.face END,
        firstSeen = CASE WHEN seen.firstSeen = 0 OR (excluded.firstSeen > 0 AND excluded.firstSeen < seen.firstSeen)
                         THEN excluded.firstSeen ELSE seen.firstSeen END,
        lastSeen  = MAX(seen.lastSeen, excluded.lastSeen),
        ${SEEN_FLAGS.map(function (f) { return f + ' = MAX(seen.' + f + ', excluded.' + f + ')'; }).join(',\n        ')}`);
    const route = db.prepare(`INSERT OR IGNORE INTO seen_routes (publicKey, via, at, url, rank, told)
      VALUES (?, ?, ?, ?, ?, ?)`);
    function row(key, r) {
      const f = r.flags || {};
      put.run(String(key), String(r.label || ''), Number(r.labelRank) || 4, Number(r.labelAt) || 0,
        typeof r.present === 'number' ? r.present : -1, String(r.myLabel || ''), String(r.card || ''), String(r.face || ''),
        Number(r.firstSeen) || 0, Number(r.lastSeen) || 0,
        ...SEEN_FLAGS.map(function (k) { return f[k] ? 1 : 0; }));
    }
    const ms = function (iso) { const t = Date.parse(String(iso || '')); return t > 0 ? t : 0; };
    const now = Date.now();
    const relayKeyAt = Object.create(null);
    const self = (function () {
      try { return JSON.parse(fs.readFileSync(path.join(rootDir, 'relay-state', 'identity.json'), 'utf8')).publicKey || ''; }
      catch (e) { return ''; }
    }());

    db.exec('BEGIN');
    try {
      if (oldSeen) {
        db.prepare('SELECT * FROM seen_old').all().forEach(function (r) {
          if (!r.publicKey || r.publicKey === self) return;
          // THE FIRST SHAPE OF ALL (cycle R29) had one route on the row, `at` and `url`: it becomes a route at rank 4
          // with no `via`, since nothing recorded which door proved it, told when the row was seen.
          if (r.at) route.run(r.publicKey, '', r.at, String(r.url || ''), 4, Number(r.seen) || 0);
          row(r.publicKey, {
            label: r.label, labelRank: r.labelRank, labelAt: r.labelAt, present: r.present,
            firstSeen: r.seen, lastSeen: r.seen,
            flags: { keep: r.choice === 'added', held: r.choice === 'held', ignored: r.choice === 'ignored',
              blocked: !!r.blocked, relay: r.kind === 'relay' },
          });
        });
        db.exec('DROP TABLE seen_old');
      }
      if (has('relays')) {
        db.prepare('SELECT * FROM relays').all().forEach(function (r) {
          if (!r.key || !r.url) return;
          relayKeyAt[String(r.url).replace(/\/+$/, '')] = r.key;
          row(r.key, {
            myLabel: r.label && r.label !== r.url ? r.label : '', face: r.faceName || '',
            firstSeen: ms(r.firstSeen) || ms(r.acceptedAt), lastSeen: ms(r.acceptedAt) || ms(r.firstSeen),
            flags: { relay: true, keep: !!r.listed, seated: !!r.seatClaimedAt && !r.refusal },
          });
          route.run(r.key, '', r.key, String(r.url).replace(/\/+$/, ''), 1, now);
        });
        db.exec('DROP TABLE relays');
      }
      if (has('peers')) {
        db.prepare('SELECT * FROM peers').all().forEach(function (r) {
          if (r.peer_id && r.peer_id !== self) row(r.peer_id, { myLabel: r.label });
        });
        db.exec('DROP TABLE peers');
      }
      book.forEach(function (b) {
        if (!b || typeof b.publicKey !== 'string' || !b.publicKey || b.publicKey === self) return;
        const held = b.acquiredVia === 'hold';
        // A blocked row the book had forgotten (contacts.forget kept it as a roll row) is blocked and not kept.
        const forgotten = b.acquiredVia === 'roll' && b.blocked === true;
        row(b.publicKey, {
          label: b.publicLabel, myLabel: b.myLabel, card: typeof b.card === 'string' ? b.card : '',
          flags: { keep: !held && !forgotten, held: held, blocked: b.blocked === true, mine: b.owned === true },
        });
        (Array.isArray(b.relays) ? b.relays : []).forEach(function (u) {
          const url = String(u || '').replace(/\/+$/, '');
          const at = relayKeyAt[url];
          if (at) route.run(b.publicKey, '', at, url, 4, now);
        });
      });
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    if (haveBook) { try { fs.unlinkSync(bookFile); } catch (e) { /* the rows are in; a later start finds no new ones */ } }
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
    dropRoute: db.prepare('DELETE FROM seen_routes WHERE publicKey = ? AND via = ? AND at = ?'),
    // THE PIN'S ONE LOOKUP (goal/G40.11): whose direct route a url is, on seen_routes_url (its WHERE repeated).
    routeByUrl: db.prepare("SELECT * FROM seen_routes WHERE url = ? AND url <> '' AND via = '' AND at = publicKey"),
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
    rSeen: db.prepare('SELECT at FROM replay WHERE hash = ?'),
    rPut: db.prepare('INSERT OR IGNORE INTO replay (hash, at) VALUES (?, ?)'),
    rSweep: db.prepare('DELETE FROM replay WHERE at < ?'),
    rCount: db.prepare('SELECT COUNT(*) AS n FROM replay'),
    recPut: db.prepare(`INSERT OR REPLACE INTO relay_record
      (relay, at, kind, members, connected, allowance, routes, rssMB, rest)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    recSince: db.prepare(`SELECT * FROM relay_record
      WHERE relay = ? AND at >= ? ORDER BY at ASC LIMIT ?`),
    // Newest first, within a window: relay.record reads what fits from the
    // present backwards (puppets/G2), where recSince reads from a start.
    recWindow: db.prepare(`SELECT * FROM relay_record
      WHERE relay = ? AND at >= ? AND at <= ? ORDER BY at DESC LIMIT ?`),
    recCount: db.prepare('SELECT COUNT(*) AS n FROM relay_record'),
    recLastAt: db.prepare(`SELECT MAX(at) AS at FROM relay_record
      WHERE relay = ? AND kind = 'report'`),
    recRelays: db.prepare('SELECT DISTINCT relay FROM relay_record ORDER BY relay'),
    // Everything older than the fine window except the LAST report of
    // each day, per relay. Edges are excluded by `kind`, deliberately.
    recCoarsen: db.prepare(`DELETE FROM relay_record
      WHERE kind = 'report' AND at < ? AND at NOT IN (
        SELECT MAX(at) FROM relay_record
        WHERE kind = 'report' AND at < ?
        GROUP BY relay, at / 86400000
      )`),
    bPut: db.prepare(`INSERT INTO queue_backoff (relayUrl, toKey, untilWall, lastWait)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(relayUrl, toKey) DO UPDATE SET untilWall = excluded.untilWall,
        lastWait = excluded.lastWait`),
    bDel: db.prepare('DELETE FROM queue_backoff WHERE relayUrl = ? AND toKey = ?'),
    bAll: db.prepare('SELECT * FROM queue_backoff'),
    // A backoff that has run out is not worth carrying into a new process.
    bExpired: db.prepare('DELETE FROM queue_backoff WHERE untilWall <= ?'),
    // apiAuth/G1.3: the two exact lookups are the double key's; search walks the joined rows. The name a grant shows
    // is its ID's row's (goal/G40.11: the peers table moved into seen): what I call them, else what they call
    // themselves, '' when the table has no row for them.
    aHas: db.prepare('SELECT 1 FROM grants WHERE peer_id = ? AND path = ?'),
    aPaths: db.prepare('SELECT path FROM grants WHERE peer_id = ? ORDER BY path'),
    aPeer: db.prepare(`SELECT g.peer_id AS key, ${GRANT_NAME} AS label, g.path AS path FROM grants g
      LEFT JOIN seen s ON s.publicKey = g.peer_id WHERE g.peer_id = ? ORDER BY g.path`),
    aAll: db.prepare(`SELECT g.peer_id AS key, ${GRANT_NAME} AS label, g.path AS path FROM grants g
      LEFT JOIN seen s ON s.publicKey = g.peer_id ORDER BY label, g.path`),
    aKnownPath: db.prepare('SELECT 1 FROM grants WHERE path = ? LIMIT 1'),
    aGranted: db.prepare('SELECT 1 FROM grants WHERE peer_id = ? LIMIT 1'),
    aGrantPut: db.prepare('INSERT INTO grants (peer_id, path) VALUES (?, ?)'),
    aGrantDel: db.prepare('DELETE FROM grants WHERE peer_id = ? AND path = ?'),
    // GREEDY, IN ONE STATEMENT. A field is written when the caller has one
    // and left alone when it does not — the callers do not all know the
    // same things, and a search that taught a label must not have it
    // blanked by the next packet that arrives. `excluded` is the row being
    // inserted; `seen.label` is what is already there.
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
    //
    // firstSeen is written once, by the insert; `relay` only ever goes from 0 to 1 here (a caller that knows the ID
    // is a relay says so; one that does not leaves it).
    put: db.prepare(`INSERT INTO seen (publicKey, label, labelRank, labelAt, present, firstSeen, lastSeen, relay)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(publicKey) DO UPDATE SET
        label     = CASE WHEN excluded.label <> '' AND excluded.labelRank <= seen.labelRank
                         THEN excluded.label ELSE seen.label END,
        labelRank = CASE WHEN excluded.label <> '' AND excluded.labelRank <= seen.labelRank
                         THEN excluded.labelRank ELSE seen.labelRank END,
        labelAt   = CASE WHEN excluded.label <> '' AND excluded.labelRank <= seen.labelRank
                         THEN excluded.labelAt ELSE seen.labelAt END,
        present   = CASE WHEN excluded.present < 0 THEN seen.present ELSE excluded.present END,
        firstSeen = CASE WHEN seen.firstSeen = 0 THEN excluded.firstSeen ELSE seen.firstSeen END,
        lastSeen  = excluded.lastSeen,
        relay     = MAX(seen.relay, excluded.relay)`),
    // A ROW THE OWNER'S OWN ACT MAKES (keep, block, a name, a card) has never been SEEN — a contact added by pasting a
    // key — so its dates are 0 and its presence unknown, which is the truth rather than a guess. set() then writes the
    // fields it was given on it.
    make: db.prepare('INSERT OR IGNORE INTO seen (publicKey) VALUES (?)'),
    del: db.prepare('DELETE FROM seen WHERE publicKey = ?'),
    count: db.prepare('SELECT COUNT(*) AS n FROM seen'),
    // ── ONE SHEDDING, AND THE FLAGS DECIDE WHO IS IN LINE (0021, goal/G40.11) ─
    //
    //   Andy: "it's the chosen-mark that gives protection from eviction,
    //   if the memory overflows. the shedded rows will first be ignored,
    //   then held, once the memory is full with 'added' statuses no more
    //   can be chosen/added until eviction by blocking or ignoring...."
    //
    // The box (v24): "lastSeen is the staleness: it orders shedding once the cap is reached, never age alone. Shedding
    // takes unflagged rows first, then ignored or blocked, then held, oldest first in each; keep and mine never." A
    // kept or owned row is not in the line at all — that is the protection, and it is a WHERE (seen_shed's own), not
    // a weight, so no amount of pressure reaches it.
    shedCount: db.prepare('SELECT COUNT(*) AS n FROM seen WHERE keep = 0 AND mine = 0'),
    overflow: db.prepare(`DELETE FROM seen WHERE publicKey IN (
      SELECT publicKey FROM seen WHERE keep = 0 AND mine = 0
      ORDER BY CASE WHEN ignored = 1 OR blocked = 1 THEN 1 WHEN held = 1 THEN 2 ELSE 0 END ASC, lastSeen ASC
      LIMIT ?)`),
    // WHO A SEARCH READS (R39, goal/G40.11): the kept, the owned and the held, all of them ("the search lists kept and
    // held rows only"), each flag through its own partial index. Nobody else is listed: a stranger is shown only once
    // the network search has made it held.
    listed: db.prepare('SELECT * FROM seen WHERE keep = 1 UNION SELECT * FROM seen WHERE mine = 1 ' +
      'UNION SELECT * FROM seen WHERE held = 1'),
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
  // Every row with one flag true, newest first, through that flag's partial index (its WHERE is the statement's).
  const byFlag = {};
  SEEN_FLAGS.forEach(function (f) {
    byFlag[f] = db.prepare('SELECT * FROM seen WHERE ' + f + ' = 1 ORDER BY lastSeen DESC');
  });
  // The fields set() may write, beside the flags: what the owner calls them and their card.
  const SET_TEXT = ['myLabel', 'card', 'face'];

  // A ROW AS EVERY READER GETS IT: the flags as booleans, presence as null when nobody has said, so a caller cannot
  // paint somebody red on the strength of never having heard.
  function row(r) {
    if (!r) return null;
    const out = {
      publicKey: r.publicKey, label: r.label, labelRank: r.labelRank, labelAt: r.labelAt,
      present: r.present < 0 ? null : !!r.present,
      myLabel: r.myLabel || '', card: r.card || '', face: r.face || '', firstSeen: r.firstSeen, lastSeen: r.lastSeen,
    };
    SEEN_FLAGS.forEach(function (f) { out[f] = !!r[f]; });
    return out;
  }
  function routeRow(r) {
    return { via: r.via, at: r.at, url: r.url, rank: r.rank, told: r.told };
  }

  // ── THE SHADOW STREAM'S SOURCE (goal/G40.11) ─────────────────────────
  //
  //   Andy, 2026-10-26: "yes." to "The stream: one job for the table, one changed row per update."
  //
  // Every write of a row hands the row, as it now reads, to whoever listens (server.js: the shadow job), when it
  // reads differently from before the write. One row per call, as it changed; nothing held back or gathered. The cost,
  // stated: one read before each write, and one job update for every row that changed — every presence word and every
  // arrival moves lastSeen, so one update per arrival.
  const listeners = [];
  function changed(publicKey, before) {
    if (!listeners.length) return;
    const after = q.get.get(publicKey);
    if (JSON.stringify(after || null) === JSON.stringify(before || null)) return;
    const shown = after ? row(after) : { publicKey: publicKey, gone: true };
    listeners.slice().forEach(function (fn) { try { fn(shown); } catch (e) { /* a listener's fault is its own */ } });
  }
  function writing(publicKey, fn) {
    const before = listeners.length ? q.get.get(publicKey) : null;
    const out = fn();
    changed(publicKey, before);
    return out;
  }

  const tq = {
    add: db.prepare('INSERT INTO traffic (' + TRAFFIC_COLUMNS.map(function (c) { return '"' + c + '"'; }).join(', ') +
      ', extra) VALUES (' + TRAFFIC_COLUMNS.map(function () { return '?'; }).join(', ') + ', ?)'),
    all: db.prepare('SELECT * FROM traffic ORDER BY seq'),
    count: db.prepare('SELECT COUNT(*) AS n FROM traffic'),
    byHash: db.prepare("SELECT * FROM traffic WHERE hash = ? AND hash <> '' ORDER BY seq"),
    owner: db.prepare("SELECT * FROM traffic WHERE kind = 'owner' AND at > ? ORDER BY at LIMIT ?"),
    arrivals: db.prepare("SELECT * FROM traffic WHERE dir = 'in' AND admitted = 1 AND at > ? ORDER BY at LIMIT ?"),
    // THE ARRIVALS NOT YET TAKEN (goal/G4.31), every one, oldest first: what a stream replays when it opens. Both
    // partial indexes' WHEREs are repeated (traffic_arrivals_at for the rows, traffic_hash for each one's mark), so it
    // never reads the whole log, which cost about a second per desk ask on a long-lived node.
    // THE LAST DAY'S ONLY (goal/G30.19): an untaken packet older than BACKLOG_MS is not work still waiting (Andy: "I
    // don't go clean a room my mother tld me to clean 60 years ago"); `at > ?` keeps the read to the index's newest rows.
    untaken: db.prepare("SELECT t.* FROM traffic t WHERE t.dir = 'in' AND t.admitted = 1 AND t.at > ? AND NOT EXISTS " +
      "(SELECT 1 FROM traffic m WHERE m.hash = t.hash AND m.hash <> '' AND m.mark = 'taken') ORDER BY t.at"),
    // The oldest rows, a chunk at a time, for the shedding below.
    // The oldest rows below the one just written: a packet is never shed in the moment it is written.
    shed: db.prepare('DELETE FROM traffic WHERE seq IN (SELECT seq FROM traffic WHERE seq < ? ORDER BY seq LIMIT ?)'),
    // The highest stamp written. NOT the last seq's: the migration
    // (transport/R19.5) appends a node's older history after rows it wrote
    // since, so seq order and time order part there. Read once per process.
    lastAt: db.prepare('SELECT MAX(at) AS at FROM traffic'),
    maxSeq: db.prepare('SELECT COALESCE(MAX(seq), 0) AS n FROM traffic'),
    delAbove: db.prepare('DELETE FROM traffic WHERE seq > ?'),
    bytes: db.prepare(`SELECT COALESCE(SUM(pgsize), 0) AS n FROM dbstat
      WHERE name IN (SELECT name FROM sqlite_schema WHERE tbl_name = 'traffic')`),
  };

  // A table row back into the object trafficLog.js wrote.
  function trafficRow(r) {
    const out = {};
    TRAFFIC_COLUMNS.forEach(function (c) {
      if (r[c] === null || r[c] === undefined) return;
      out[c] = TRAFFIC_TYPES[c] === 'bool' ? r[c] === 1 : TRAFFIC_TYPES[c] === 'int' ? Number(r[c]) : r[c];
    });
    if (r.extra) {
      try {
        const x = JSON.parse(r.extra);
        Object.keys(x).forEach(function (k) { out[k] = x[k]; });
      } catch (e) { /* a damaged extra costs itself only */ }
    }
    return out;
  }

  // ── THE FILE NEVER GROWS PAST MAX_DB_BYTES (goal/G30.19) ─────────────
  //
  // Andy, 2026-10-21: "cap in to 16 MB", "learn to throw out shit, or else my box is gonna grind to a hold very soon",
  // "make sure the code doesn't allow it to grow anymore". Every packet written asks the file's size (page_count, no
  // read); past the cap the packet log's oldest rows go, a chunk at a time, and their pages are given back to the disc,
  // until it fits or the log is empty. The log is what grows; everything else here has its own bound.
  function fileBytes() { return q.pages.get().page_count * q.pageSize.get().page_size; }
  // WHAT IS PAST ITS WINDOW GOES FIRST (found on Andy's node, 2026-10-22: a store whose replay memory alone was over the
  // cap shed every packet the moment it was written, and compacted the file on each one). The replay memory older than
  // its window, then the packet log's oldest rows below the one just written; when nothing more may go, nothing is tried.
  function shedToCap(newest) {
    if (fileBytes() <= MAX_DB_BYTES) return;
    if (q.rSweep.run(Date.now() - BACKLOG_MS).changes) db.exec('PRAGMA incremental_vacuum');
    for (let pass = 0; pass < 64 && fileBytes() > MAX_DB_BYTES; pass += 1) {
      if (!tq.shed.run(Number(newest) || 0, SHED_CHUNK).changes) break;
      db.exec('PRAGMA incremental_vacuum');
    }
  }

  const store = {
    path: dbPath(rootDir),
    // The file's size, the number the cap is on.
    fileBytes: fileBytes,

    // THE NODE LOG'S TABLE (transport/R19.3). A row goes in as the object
    // trafficLog.js built and comes out as the same object, in seq order.
    traffic: {
      add: function (row) {
        const extra = {};
        Object.keys(row || {}).forEach(function (k) {
          if (!TRAFFIC_TYPES[k] || !trafficFits(TRAFFIC_TYPES[k], row[k])) extra[k] = row[k];
        });
        const vals = TRAFFIC_COLUMNS.map(function (c) {
          const v = row ? row[c] : undefined;
          if (v === undefined || !trafficFits(TRAFFIC_TYPES[c], v)) return null;
          return TRAFFIC_TYPES[c] === 'bool' ? (v ? 1 : 0) : v;
        });
        vals.push(Object.keys(extra).length ? JSON.stringify(extra) : null);
        const seq = Number(tq.add.run.apply(tq.add, vals).lastInsertRowid);
        shedToCap(seq);
        return seq;
      },
      all: function () { return tq.all.all().map(trafficRow); },
      // The indexed reads (transport/R19.4). `since` is an ISO time, '' for all.
      byHash: function (hash) { return tq.byHash.all(String(hash || '')).map(trafficRow); },
      owner: function (since, limit) { return tq.owner.all(String(since || ''), Number(limit) || 200).map(trafficRow); },
      arrivals: function (since, limit) { return tq.arrivals.all(String(since || ''), Number(limit) || 200).map(trafficRow); },
      untaken: function () { return tq.untaken.all(new Date(Date.now() - BACKLOG_MS).toISOString()).map(trafficRow); },
      lastAt: function () { const r = tq.lastAt.get(); return (r && r.at) || ''; },
      // For the migration's way back (transport/R19.5).
      maxSeq: function () { return tq.maxSeq.get().n; },
      removeAbove: function (seq) { return tq.delAbove.run(Number(seq) || 0).changes; },
      count: function () { return tq.count.get().n; },
      bytes: function () { return tq.bytes.get().n; },
    },

    // ── THE ONE TABLE, AS ITS READERS ASK IT (goal/G40.11) ────────────────
    //
    // seenPeers.js keeps the rules of what is learned and when a row goes, contacts.js and relayKeys.js the owner's
    // acts on a row; this is where the rows live. A row comes out as row() above.
    SEEN_FLAGS: SEEN_FLAGS,
    seen: {
      get: function (publicKey) { return row(q.get.get(String(publicKey || ''))); },
      // `present` is three-valued in both directions: true, false, or
      // nothing said. A search answer knows presence; an arriving route
      // announcement does not — and a caller with nothing to say must not
      // be able to mark somebody away by staying silent.
      put: function (publicKey, what) {
        const w = what || {};
        const key = String(publicKey || '');
        const present = w.present === true ? 1 : (w.present === false ? 0 : -1);
        const when = Number(w.seen || 0);
        writing(key, function () {
          q.put.run(key, String(w.label || ''), Number(w.labelRank || 4), Number(w.labelAt || w.seen || 0),
            present, when, when, w.relay === true ? 1 : 0);
        });
        return row(q.get.get(key));
      },
      // THE OWNER'S ACTS ON A ROW: any of the flags and myLabel or card, written as given, the row made when there is
      // none. Fields not named are left alone. firstSeen, when given, is written only on a row that has none (a relay
      // accepted is first known then). Answers the row as it now reads.
      set: function (publicKey, fields) {
        const key = String(publicKey || '').trim();
        const f = fields || {};
        if (!key) return null;
        const cols = [];
        const vals = [];
        SEEN_FLAGS.forEach(function (k) { if (typeof f[k] === 'boolean') { cols.push(k + ' = ?'); vals.push(f[k] ? 1 : 0); } });
        SET_TEXT.forEach(function (k) { if (typeof f[k] === 'string') { cols.push(k + ' = ?'); vals.push(f[k]); } });
        if (typeof f.firstSeen === 'number' && f.firstSeen > 0) { cols.push('firstSeen = CASE WHEN firstSeen = 0 THEN ? ELSE firstSeen END'); vals.push(f.firstSeen); }
        writing(key, function () {
          q.make.run(key);
          if (cols.length) db.prepare('UPDATE seen SET ' + cols.join(', ') + ' WHERE publicKey = ?').run(...vals, key);
        });
        return row(q.get.get(key));
      },
      // Every row with that flag, newest first (its partial index).
      flagged: function (flag) {
        return byFlag[flag] ? byFlag[flag].all().map(row) : [];
      },
      // The rows a search lists: kept, owned and held (see q.listed).
      listed: function () { return q.listed.all().map(row); },
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
      dropRoute: function (publicKey, via, at) {
        return q.dropRoute.run(String(publicKey || ''), String(via || ''), String(at || '')).changes > 0;
      },
      // Whose direct route a url is: { publicKey, url, ... } of that ID, or null (the pin's one lookup).
      byUrl: function (url) {
        const r = q.routeByUrl.get(String(url || ''));
        return r ? Object.assign({ publicKey: r.publicKey }, routeRow(r)) : null;
      },
      forget: function (publicKey) {
        // The routes go with the peer: a row in `seen_routes` for somebody
        // no longer in `seen` is unreachable by every reader here.
        const key = String(publicKey || '');
        q.dropRoutes.run(key);
        return writing(key, function () { return q.del.run(key).changes > 0; });
      },
      size: function () { return q.count.get().n; },
      // Every row write, as the row now reads ({publicKey, gone: true} when it went), to fn (the shadow stream).
      // Answers a function that stops it.
      onChange: function (fn) {
        if (typeof fn !== 'function') return function () {};
        listeners.push(fn);
        return function () { const i = listeners.indexOf(fn); if (i !== -1) listeners.splice(i, 1); };
      },
      // Rows the sweep may still take. Zero, with the cache over its cap,
      // is what "full" means: only kept and owned rows are left.
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
    // ── THE REPLAY INDEX, AS THE RECEIVE PATH ASKS ABOUT IT ────────
    //
    // Three verbs and no more: has this been heard, remember it, and drop
    // what is too old to matter. Everything a caller needs to decide is in
    // the answer to `seen`, so no caller has to reason about the window.
    replay: {
      // WINDOW: how long a hash is remembered, and therefore how old a
      // message may be before it is refused for age. The two ARE the same
      // number — C2 — and separating them would create the silent hole
      // the condition exists to close.
      //
      // ONE DAY (goal/G30.19, Andy: "learn to throw out shit"): at a packet a second the seven days below cost 56 MB,
      // three times the whole file's cap. A sealed packet older than a day is refused as old.
      //
      // It was SEVEN DAYS, and it is a figure to rule rather than a discovery.
      // The argument for it: a relay does not queue, so a legitimate post
      // today is seconds old and a window of minutes would do — but the
      // seal was deliberately built without a session so a message CAN
      // sit and still open, which is what store-and-forward will need.
      // Sizing the window for the mechanism rather than for today's
      // traffic means the protection does not have to be revisited when
      // queueing arrives. It costs almost nothing: a hash and an integer
      // is about 80 bytes, so a thousand messages a day for a week is
      // under 600 KB.
      //
      // The future tolerance is for CLOCK SKEW, not for the sender's
      // convenience: a node an hour fast would otherwise have every
      // message refused as being from the future, which reads as a
      // network fault and is not one.
      WINDOW_MS: 24 * 60 * 60 * 1000,
      SKEW_MS: 60 * 60 * 1000,

      // Answers what the caller must decide, rather than a boolean it
      // would have to interpret:
      //   'new'   — never heard, and within the window
      //   'again' — heard before
      //   'old'   — outside the window, so the index cannot vouch either
      //             way and the message must be refused for age
      //   'ahead' — further in the future than clock skew explains
      // ── THE TIMESTAMP ARRIVES AS AN ISO STRING, NOT A NUMBER ─────
      //
      // `seal()` stamps `at` with an ISO string, and this table stores
      // milliseconds because it is compared and swept on. `Number(iso)`
      // is NaN, which fell to 0, which read as 1970 — so EVERY sealed
      // post would have been refused as "older than this node
      // remembers". Caught by replayIndex.js before it shipped; the
      // suite's end-to-end block is the only one that used a real seal.
      //
      // Converted HERE, at the one boundary, rather than by each caller:
      // two callers doing it is two places to get it wrong, and this one
      // already got it wrong once.
      ms: function (at) {
        if (typeof at === 'number') return at;
        const parsed = Date.parse(String(at || ''));
        return parsed > 0 ? parsed : 0;
      },
      seen: function (hash, at, now) {
        const key = String(hash || '');
        const when = this.ms(at);
        const n = now == null ? Date.now() : now;
        if (!key) return 'old';
        if (when > n + this.SKEW_MS) return 'ahead';
        if (when < n - this.WINDOW_MS) return 'old';
        return q.rSeen.get(key) ? 'again' : 'new';
      },
      remember: function (hash, at) {
        q.rPut.run(String(hash || ''), this.ms(at));
      },
      // Called on the ordinary sweep, never on the receive path: trimming
      // inside a delivery would make one message pay for the whole index.
      sweep: function (now) {
        const n = now == null ? Date.now() : now;
        return q.rSweep.run(n - this.WINDOW_MS).changes;
      },
      count: function () { return q.rCount.get().n; },
      // ── REBUILT FROM THE LOG, BECAUSE IT IS DERIVED ───────────────
      //
      // Every hash here is also in the node log. That once meant losing
      // node.db cost only a rebuild; since transport/R19 the log is in
      // node.db too, so a lost node.db takes both, by Andy's decision
      // (see the replay table above). A damaged index still rebuilds.
      //
      // IT TAKES ROWS RATHER THAN READING THE LOG. The log belongs to
      // trafficLog and this file reads no file it does not own; a store
      // that learned to parse another module's format would be a second
      // reader to keep in step. The caller walks the log and hands over
      // {hash, at} pairs.
      //
      // INSERT OR IGNORE, so a rebuild over a partly-populated index is
      // safe to run twice — which is the state a crash leaves and the
      // state an operator will actually be in.
      rebuild: function (rows) {
        // `self`, because `this` is lost inside the callback and the
        // conversion must not be duplicated to avoid saying so.
        const self = this;
        let n = 0;
        (Array.isArray(rows) ? rows : []).forEach(function (r) {
          if (!r || !r.hash) return;
          q.rPut.run(String(r.hash), self.ms(r.at));
          n += 1;
        });
        return n;
      },
    },

    // ── THE OWNER'S RELAY RECORD (cycle 11) ────────────────────────
    record: {
      // ── ONE ROW A MINUTE, AND THE COARSENING (cycle 11) ───────────────
      //
      // A busy relay reports on every claim and every stream that opens,
      // which on a stress run is hundreds a minute. Keeping all of them
      // would make the record a traffic log of the owner's own box, and
      // cycle 9 bounds every persisted dataset by disc.
      //
      // So a report is written at most once a minute per relay. The LAST
      // one in a minute wins rather than the first — INSERT OR REPLACE on
      // the minute-truncated key — because the newest figures are the
      // ones a reader wants and the earlier ones in the same minute
      // differ by a claim or two.
      //
      // The figures are proposed and NOT ruled: Andy has not named them.
      MINUTE_MS: 60 * 1000,
      FINE_MS: 90 * 24 * 60 * 60 * 1000,

      // A REPORT, as it arrives. The named figures are pulled out; the
      // rest of the report is kept whole, so a reader in a year can ask a
      // question nobody thought of today.
      put: function (relay, report, now) {
        const r = report || {};
        const at = Math.floor((now == null ? Date.now() : now) / this.MINUTE_MS) * this.MINUTE_MS;
        const named = ['peers', 'present', 'routes', 'memory', 'seats'];
        const sifted = keptFigures(r);
        const rest = {};
        Object.keys(sifted.kept).forEach(function (k) {
          if (named.indexOf(k) === -1) rest[k] = sifted.kept[k];
        });
        // The names of what was withheld, never the contents — so the
        // record says it held something back rather than looking like a
        // report that never carried it (cycle 11's D1).
        if (sifted.dropped.length) rest.withheld = sifted.dropped;
        q.recPut.run(
          String(relay || ''), at, 'report',
          Number(r.peers) || 0,
          Number(r.present) || 0,
          Number(r.seats && r.seats.allowance) || 0,
          Number(r.routes) || 0,
          Math.round((Number(r.memory && r.memory.rss) || 0) / 1048576),
          JSON.stringify(Object.assign({ seats: r.seats }, rest))
        );
      },

      // ── AN EDGE, WHICH IS WHAT MAKES A GAP READABLE (cycle 11) ─────────
      //
      // Reports arrive on events and never on a timer, so a quiet relay
      // and a dead one produce the same silence. The stream opening and
      // closing are the two moments the node knows for certain, and they
      // are the only marks that let a reader tell those apart.
      //
      // NOT truncated to the minute: an edge is an instant and two of
      // them in one minute is a flap, which is exactly the thing worth
      // seeing.
      // FOUR KINDS SINCE cycle-11/C3: the stream's open and close, and the
      // NODE's own started and stopped, the one state the record could not
      // mark because the node is what writes it. Anything else is still a
      // close, as before.
      edge: function (relay, kind, now, why) {
        const known = kind === 'open' || kind === 'started' || kind === 'stopped';
        q.recPut.run(String(relay || ''), now == null ? Date.now() : now,
          known ? kind : 'close', 0, 0, 0, 0, 0,
          JSON.stringify(why ? { why: String(why) } : {}));
      },

      // ── WHAT CROSSES TO A CALLER (cycle 11's R6) ──────────────────
      //
      // 0020: "A value may cross. A structure may not" — and its own test
      // for which is which: "whether the node has already DECIDED the
      // thing. A decided value is an answer; a row, a depth or a timer is
      // the working-out."
      //
      // A SERIES IS A STRUCTURE BY SHAPE AND AN ANSWER BY THAT TEST, and
      // the cycle document flags this sentence as one two readers may
      // take differently. The reading built here: what crosses is a list
      // of ANSWERS — at this minute, this many members, this many
      // connected, this many seats free — and not the row. No `rest`, no
      // `kind` column, no primary key, nothing a caller could use to
      // reconstruct the table or to ask a second question of it.
      //
      // The difference is not cosmetic. A caller holding rows will
      // eventually filter them, and then the shape of this table is a
      // client surface that cannot be changed. A caller holding answers
      // has what it needs to draw a curve and nothing else.
      //
      // An EDGE crosses as a moment with a kind, because "the stream
      // closed at 14:02" is an answer too, and without it the curve has
      // gaps a reader cannot interpret (cycle 11's R3).
      series: function (relay, from, limit) {
        return this.since(relay, from, limit).map(seriesRow);
      },
      // The same rows, newest first, between two times (puppets/G2).
      window: function (relay, from, to, limit) {
        return q.recWindow.all(String(relay || ''), Number(from) || 0,
          Number(to) > 0 ? Number(to) : Number.MAX_SAFE_INTEGER,
          Number(limit) > 0 ? Number(limit) : 5000).map(seriesRow);
      },

      // ── THE GAPS, AND WHICH KIND EACH IS (cycle-11/C3) ────────────────
      //
      //   Andy: "a re-start row documents the downtime?", "...
      //   the end-of-a-downtime", "and the stopped row can't be guaranteed.",
      //   "... but should be part of \"graceful shutdown\"".
      //
      // Every `started` after the first ends a gap. A `stopped` right
      // before it makes the gap a RESTART, a deliberate stop with both ends
      // known. Anything else before it makes it a DEATH, whose start is only
      // bounded by the last row written, because a crash writes nothing.
      // The first `started` in the record is a first boot, not a gap.
      //
      // Answers about THE NODE, never about the relay: an interval while the
      // node was down says nothing about what the relay did in it.
      gaps: function (relay, from, limit) {
        const out = [];
        let prev = null;
        this.since(relay, from, limit).forEach(function (r) {
          if (r.kind === 'started' && prev) {
            out.push({
              kind: prev.kind === 'stopped' ? 'restart' : 'death',
              from: prev.at,
              to: r.at,
            });
          }
          prev = r;
        });
        return out;
      },

      since: function (relay, from, limit) {
        return q.recSince.all(String(relay || ''), Number(from) || 0,
          Number(limit) > 0 ? Number(limit) : 5000);
      },
      relays: function () { return q.recRelays.all().map(function (r) { return r.relay; }); },
      lastAt: function (relay) { return (q.recLastAt.get(String(relay || '')) || {}).at || 0; },
      count: function () { return q.recCount.get().n; },

      // ── THE SECOND TIER (cycle 11's R4) ───────────────────────────
      //
      // Minute rows are kept 90 days; past that, one row a day survives
      // and the rest go. The daily curve is the thing a growth argument
      // is made from and it costs a row a day, so it is never pruned —
      // C1 says this record is NOT derived and cannot be rebuilt, which
      // argues for the cheap tier being permanent rather than for a
      // recovery that cannot exist.
      //
      // THE LAST ROW OF EACH DAY SURVIVES, not the first: the same reason
      // the last report of a minute wins. A day's final figures are what
      // that day ended at.
      //
      // EDGES ARE NEVER COARSENED. An open and a close are instants, two
      // in a day is a flap, and a flap is exactly what somebody reading a
      // year later wants to see. They are the cheapest rows here and the
      // least replaceable.
      //
      // The figures are proposed and NOT ruled — Andy has not named them.
      coarsen: function (now) {
        const n = now == null ? Date.now() : now;
        const before = n - this.FINE_MS;
        // BOTH placeholders. Bound once, the subquery compared `at` to
        // NULL, returned nothing, and `NOT IN (empty)` is true — so the
        // sweep deleted EVERY old report instead of keeping one a day.
        // node:sqlite did not complain about the missing parameter; the
        // row counts did.
        return q.recCoarsen.run(before, before).changes;
      },
    },

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

    // apiAuth/G1.3's table, for apiAuth.js alone. The name a grant shows is its ID's row in seen (goal/G40.11): a
    // grant given under a name writes it as myLabel when the row has none, and a relabel is that row's myLabel.
    auth: {
      has: function (key, p) { return !!q.aHas.get(String(key), String(p)); },
      paths: function (key) { return q.aPaths.all(String(key)).map(function (r) { return r.path; }); },
      peer: function (key) { return q.aPeer.all(String(key)).map(function (r) { return { key: r.key, label: r.label, path: r.path }; }); },
      all: function () { return q.aAll.iterate(); },
      knownPath: function (p) { return !!q.aKnownPath.get(String(p)); },
      // The name for a key that holds a grant, '' when its row has none; null when it holds no grant.
      label: function (key) {
        if (!q.aGranted.get(String(key))) return null;
        const r = row(q.get.get(String(key)));
        return r ? (r.myLabel || r.label || '') : '';
      },
      grant: function (key, p, label) {
        store.transaction(function () {
          q.aGrantPut.run(String(key), String(p));
          const was = row(q.get.get(String(key)));
          if (label && !(was && was.myLabel)) store.seen.set(String(key), { myLabel: String(label) });
        });
      },
      revoke: function (key, p) { return q.aGrantDel.run(String(key), String(p)).changes > 0; },
      relabel: function (key, label) {
        if (!q.aGranted.get(String(key))) return false;
        store.seen.set(String(key), { myLabel: String(label) });
        return true;
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
  MAX_DB_BYTES: MAX_DB_BYTES,
  MAX_ROUTES: MAX_ROUTES,
  available: available,
  dbPath: dbPath,
};
