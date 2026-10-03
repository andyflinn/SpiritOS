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

appServer.serve({});
