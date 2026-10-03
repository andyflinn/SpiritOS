'use strict';

// spirit/run/process/js/chatClerver/chatClerver.js
// THE CHAT SERVER — goal/G4. Faceless and p2p: every node that takes part runs one, and each holds its own record of
// the chats it is a party to. No server in the middle; no core module.
//
//   Andy, 2026-10-03: "this time, we design the faceless chatClerver only, with no regard to any user interface
//   design. the chatClerver is an appServer and absolutely p2p."; "the every node's database is referred to as that
//   users "memory", it is called memory.db and holds only truth."; and, the design ended, "i meant: build it now."
//
// DECIDED in Desk (goal/G4.1, G4.5, G4.8), not this file's to undo:
//   - memory.db is this node's memory of what it witnessed: the lines it wrote, the sealed lines it received, and
//     nothing it did not witness. Nothing cached or derived is kept; a search answers from the rows.
//   - A line is named by (peer, sent, seq): the other party's key, the direction, the writer's own number. The two
//     copies of a chat are equals; a difference between them is a gap, never a conflict.
//   - A line written is a line kept: no row is deleted, and of a line only its refusal mark ever changes (cleared
//     when the peer takes it, G4.6). The database itself refuses the rest, so no verb can break it by mistake.
//   - No label anywhere: a peer's name is the node's contact book's (G4.8, Andy: "our label for peers should be kept
//     globally"). The references table is deferred with goal/G4.4.
//
// Its verbs come with goal/G4.2 (line.receive, chat.read, the publish), G4.6 and G4.7 (line.write) and G4.3
// (peers.search).

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const appServer = require('../../../js/appServer.js');
const kernel = require('../../../js/kernel.js');
const packet = require('../../../js/client/packet.js');
const limits = require('../../../js/limits.js');
const appClient = require('../../../js/appClient.js');
const searchBucket = require('../../../js/searchBucket.js');

const argv = process.argv;
function arg(name) { const i = argv.indexOf(name); return i !== -1 ? String(argv[i + 1] || '') : ''; }
const STATE = arg('--state');
if (!STATE) {
  console.error('chatClerver: no --state; the node that starts this names its state folder');
  process.exit(2);
}
fs.mkdirSync(STATE, { recursive: true });

const db = new DatabaseSync(path.join(STATE, 'memory.db'));
// The backup copies this file while it is written, as it does desk.db: in WAL a reader never blocks the writer.
db.exec('PRAGMA busy_timeout=5000');
db.exec('PRAGMA journal_mode=WAL');
db.exec(
  // THE TABLE OF CHAT LINES (goal/G4.8). sent: 1 written here, 0 received ("one flagbit indicates the direction").
  // at: the writer's UTC time; receivedAt: this node's, for a received line. reWriter and reSeq: the line answered
  // (G4.5), empty for none. refused and refusedAt: a sent line the peer's door refused, "proof that contact was
  // attempted" (G4.6), empty once taken.
  'CREATE TABLE IF NOT EXISTS lines (peer TEXT NOT NULL, sent INTEGER NOT NULL, seq INTEGER NOT NULL, at TEXT NOT NULL,' +
  " text TEXT NOT NULL, receivedAt TEXT NOT NULL DEFAULT '', reWriter TEXT NOT NULL DEFAULT '', reSeq INTEGER NOT NULL DEFAULT 0," +
  " refused TEXT NOT NULL DEFAULT '', refusedAt TEXT NOT NULL DEFAULT '', PRIMARY KEY (peer, sent, seq));" +
  // A LINE WRITTEN IS A LINE KEPT.
  "CREATE TRIGGER IF NOT EXISTS lines_kept BEFORE DELETE ON lines BEGIN SELECT RAISE(ABORT, 'a line written is a line kept'); END;" +
  'CREATE TRIGGER IF NOT EXISTS lines_unchanged BEFORE UPDATE OF peer, sent, seq, at, text, receivedAt, reWriter, reSeq ON lines' +
  " BEGIN SELECT RAISE(ABORT, 'a line written is a line kept'); END;" +
  // THE TABLE OF PEERS (goal/G4.8, G4.5): one row per peer this node has a chat with, born by the first line that
  // crossed; the highest seq sent and received, so a gap and a resend are one comparison each.
  'CREATE TABLE IF NOT EXISTS peers (peer TEXT PRIMARY KEY, highestSent INTEGER NOT NULL DEFAULT 0,' +
  " highestReceived INTEGER NOT NULL DEFAULT 0, bornAt TEXT NOT NULL);"
);

// ── THE NODE THIS SERVER RUNS ON ─────────────────────────────────────
// Its own node, as the node named it at start: the contact book and the grants are asked there, on the loopback.
let NODE_URL = '';
try { NODE_URL = new URL(String(process.env.SPIRIT_CALLBACK_URL || '')).origin; } catch (e) { NODE_URL = ''; }
// A peer's answer is waited for as long as the desk's agents wait for theirs; a busy relay is retried by the node.
const PATIENCE_MS = 60000;
const WAIT_MS = PATIENCE_MS + 30000;

function refused(code) { const e = new Error(code); e.refusal = code; return e; }
function ownerOnly(caller) { if (!caller || caller.owner !== true) throw refused('not-owner'); }
function askNode(verb, args) {
  return kernel.core.ask(verb, args, NODE_URL).then(function (r) { return r || {}; }, function () { return {}; });
}

const getPeer = db.prepare('SELECT peer, highestSent, highestReceived, bornAt FROM peers WHERE peer = ?');
const addPeer = db.prepare('INSERT INTO peers (peer, highestSent, highestReceived, bornAt) VALUES (?, 0, 0, ?)');
const setSent = db.prepare('UPDATE peers SET highestSent = ? WHERE peer = ?');
const addLine = db.prepare('INSERT INTO lines (peer, sent, seq, at, text, receivedAt, reWriter, reSeq, refused, refusedAt) VALUES (?, 1, ?, ?, ?, \'\', ?, ?, \'\', \'\')');
const markRefused = db.prepare('UPDATE lines SET refused = ?, refusedAt = ? WHERE peer = ? AND sent = 1 AND seq = ?');
const unrefused = db.prepare("SELECT seq, at, text, reWriter, reSeq FROM lines WHERE peer = ? AND sent = 1 AND refused != '' ORDER BY seq");

// One line as it travels: the peer's chatClerver takes it with line.receive (goal/G4.2).
function bodyOf(l) {
  return { chatClerver: { 'line.receive': { seq: l.seq, at: l.at, text: l.text, re: { writer: l.reWriter, seq: l.reSeq } } } };
}
// One post of one line, and what came back: kept, or the peer's refusal (its door's, sealed) kept as proof that
// contact was attempted (goal/G4.6, Andy: "the writers keeps refusals, they are proof that contact was attempted.").
function post(to, l) {
  return kernel.peerPost(to, 'api', bodyOf(l), { waitMs: WAIT_MS, patienceMs: PATIENCE_MS }).then(function (got) {
    if (got && got.kept === true) { markRefused.run('', '', to, l.seq); return 'sent'; }
    markRefused.run(String((got && (got.code || got.error)) || 'no-answer'), new Date().toISOString(), to, l.seq);
    return 'refused';
  });
}

// ── THE PEER LIST'S ROWS (goal/G4.3) ─────────────────────────────────
// One answer's room, as every search; nothing pages, before brings older rows.
const ANSWER_ROOM = appClient.ANSWER_MAX - 512;
const allPeers = db.prepare('SELECT peer FROM peers');
const newestOf = db.prepare('SELECT sent, seq, at FROM lines WHERE peer = ? ORDER BY at DESC, sent ASC LIMIT 1');
const lastSentOf = db.prepare('SELECT MAX(at) AS at FROM lines WHERE peer = ? AND sent = 1');
const unansweredSince = db.prepare('SELECT COUNT(*) AS n FROM lines WHERE peer = ? AND sent = 0 AND receivedAt > ?');
const allReceived = db.prepare('SELECT COUNT(*) AS n FROM lines WHERE peer = ? AND sent = 0');
// A row is {peer, at, sent, seq, unanswered}: the newest line between this node and the peer by the writer's time,
// and how many of the peer's lines arrived after the newest line this node sent, by this node's own clock
// (receivedAt against the sent line's at, both written here), all of them when none was sent. A peer with no line
// is no row: a record is born by a line (G4.6). Filtered by text in the key, since and before on the row's at;
// newest first. Derived on each ask, nothing stored: memory.db holds only what was witnessed (G4.8).
function peerRows(a) {
  const text = String(a.text || '').toLowerCase();
  const out = [];
  allPeers.all().forEach(function (p) {
    const newest = newestOf.get(p.peer);
    if (!newest) return;
    if (text && String(p.peer).toLowerCase().indexOf(text) === -1) return;
    if (a.since && !(String(newest.at) >= a.since)) return;
    if (a.before && !(String(newest.at) < a.before)) return;
    const last = lastSentOf.get(p.peer).at;
    const unanswered = last ? unansweredSince.get(p.peer, last).n : allReceived.get(p.peer).n;
    out.push({ peer: p.peer, at: newest.at, sent: Number(newest.sent), seq: Number(newest.seq), unanswered: Number(unanswered) });
  });
  return out.sort(function (x, y) { return x.at < y.at ? 1 : x.at > y.at ? -1 : 0; });
}

appServer.serve({
  // THE OWNER WRITES A LINE TO A PEER (goal/G4.6, G4.7). Decided in Desk, not this file's to undo:
  //   - A peer is named by its key; the chatClerver matches no label (Andy: "matching labels to keys is the UI's
  //     problem").
  //   - The node's block is the one truth and outranks: a blocked key is refused peer-blocked, nothing granted or
  //     posted ("a node-level-block supersedes app level blocks").
  //   - A held key is released by the owner's first line to it, no are-you-sure (Andy: "release happens when the
  //     users sends a message to a held contact", "i prefer no are-you-sure.").
  //   - A line to K is also the grant to K to answer ("writing to a peer should automatically be a grant to accept
  //     an answer"), asked of this node before the line leaves.
  //   - Refused lines stay in the record and go again, in their order, before the next new one.
  //   - One line, one packet: a line too large to travel is refused before anything is kept or posted.
  'line.write': {
    request: { to: '', text: '', re: { writer: '', seq: 0 } }, reply: { seq: 0, outcome: '' },
    handler: function (a, caller) {
      ownerOnly(caller);
      const to = String(a.to);
      if (!to) throw refused('bad-request');
      const re = { writer: String((a.re && a.re.writer) || ''), seq: Number((a.re && a.re.seq) || 0) };
      const at = new Date().toISOString();
      const row = getPeer.get(to);
      const seq = (row ? Number(row.highestSent) : 0) + 1;
      const line = { seq: seq, at: at, text: String(a.text), reWriter: re.writer, reSeq: re.seq };
      const made = packet.encode('api', bodyOf(line));
      if (!made || !made.ok || !limits.fitsSealed(made.text)) throw refused('line-too-large');
      return askNode('contact.get', { key: to }).then(function (r) {
        const person = r.body && r.body.person;
        if (person && person.blocked === true) throw refused('peer-blocked');
        return person && person.held === true ? askNode('contact.accept', { publicKey: to }) : null;
      }).then(function () {
        return askNode('jobs.authGrant', { key: to, path: 'chatClerver.line.receive' });
      }).then(function () {
        // The record first: what was written is kept before it travels, so a crash loses nothing.
        if (!row) addPeer.run(to, at);
        addLine.run(to, seq, at, line.text, re.writer, re.seq);
        // Marked unsent until the peer keeps it: a line lost in flight or to a crash goes again like a refused one.
        markRefused.run('unsent', at, to, seq);
        setSent.run(seq, to);
        // Earlier refused lines go again first, in their order, each with its own seq and at.
        const queue = unrefused.all(to).map(function (l) { return { seq: Number(l.seq), at: l.at, text: l.text, reWriter: l.reWriter, reSeq: Number(l.reSeq) }; });
        let outcome = 'refused';
        function next(i) {
          if (i >= queue.length) return { seq: seq, outcome: outcome };
          return post(to, queue[i]).then(function (o) {
            if (queue[i].seq === seq) outcome = o;
            // A refusal stops the round: the rest wait for the next line, in order.
            if (o !== 'sent') return { seq: seq, outcome: queue[i].seq === seq ? o : 'refused' };
            return next(i + 1);
          });
        }
        return next(0);
      });
    },
  },
  // THE PEER LIST (goal/G4.3), bucket 1. Andy, on the suggestions in its box: "agreed."; "unanswered count (45) in
  // peer/contact row? yes."; (G4.7) "a blocked contact should not be offered to the chatter user at all." A search
  // over this node's memory, as every list is: one row per peer a line has crossed with, newest line first.
  'peers.search': {
    request: { text: '', since: '', before: '' }, reply: { items: [{ key: '', label: '' }], more: false },
    handler: function (a, caller) {
      ownerOnly(caller);
      const rows = peerRows(a);
      const bucket = searchBucket.createSearch({
        query: '**', maxBytes: ANSWER_ROOM,
        getLabelStringFromIncomingObject: function (pair) { return pair.label; },
        extractKeyAndLabelFromRow: function (pair) { return pair; },
      });
      // The node's block is the one truth (G4.6): each row is asked of the book before it is offered, and a book that
      // does not answer refuses the search rather than show somebody it may have blocked.
      function offerRow(i) {
        if (i >= rows.length) return Promise.resolve();
        return askNode('contact.get', { key: rows[i].peer }).then(function (r) {
          if (r.status !== 200 && r.status !== 404) throw refused('no-answer');
          const person = r.body && r.body.person;
          if (person && person.blocked === true) return offerRow(i + 1);
          if (!bucket.offer({ key: rows[i].peer, label: JSON.stringify(rows[i]) })) return null;
          return offerRow(i + 1);
        });
      }
      return offerRow(0).then(function () { const res = bucket.getResult(); return { items: res.items, more: res.more }; });
    },
  },
});
