'use strict';

// spirit/test/chatMemory.js
// goal/G4.8: memory.db, the chatClerver's memory of what it witnessed. RED on today's tree: there is no
// process/js/chatClerver and no memory.db.
//
//   Andy, 2026-10-03: "the every node's database is referred to as that users "memory", it is called memory.db and
//   holds only truth."; "this item should have clearly titled paragraphs, one for each table. the table of chat
//   lines fields: - sent or received - peer ID - line content."; "yes" to seq and at beside them; "both parties of
//   any chat hold their own record"; "the writers keeps refusals, they are proof that contact was attempted.";
//   "received messages stores with senders UTC timestamp and receival timestamp"; "so the References section details
//   are deferred for now"; and, the design ended, "i meant: build it now." His Go is his go-all on goal/G4.
//
// THE CONTRACT (the box of goal/G4.8; the names are wsl-claude's, fixed here so the reds of G4.6 and G4.7 and the
// build agree). A new appServer, process/js/chatClerver/chatClerver.js with its manifest chatClerver.json; no core
// module is touched.
//   1. THE SERVER. chatClerver.json: kind server, operated by the node. Started as every server is (argv[2] its
//      args as JSON, --pipe, --state), it answers the door's api ask, and its state folder holds memory.db.
//   2. THE TABLE OF CHAT LINES, named lines, columns:
//        peer        the other party's key (his "peer ID")
//        sent        1 for a line this node wrote, 0 for one it received (his "one flagbit indicates the direction")
//        seq         the writer's own number for the line
//        at          the writer's UTC time
//        text        the line content
//        receivedAt  this node's UTC time when a received line arrived; empty for a sent line
//        reWriter, reSeq   the line this one answers, by writer key and seq; empty for none
//        refused, refusedAt  for a sent line the door's refusal and its time; empty when taken
//      One line is one row, named by (peer, sent, seq): a second row with the same three is refused.
//      A line written is a line kept: a row is never deleted, and of its columns only refused and refusedAt ever
//      change (a refused line is cleared when the peer takes it, G4.6). The database itself refuses the rest, so
//      no verb can break it by mistake.
//   3. THE TABLE OF PEERS, named peers, columns: peer (the key, one row each), highestSent, highestReceived (one
//      number each), bornAt (when the first line crossed). NO label anywhere: a peer's name is the contact book's.
//   4. NOTHING ELSE. memory.db holds those two tables and no other (the references table is deferred, G4.4; nothing
//      cached or derived is kept); no column in either is named label.
// Not asserted, the builder's: column types beyond what the checks need, indexes, journal mode, the verbs (G4.2,
// G4.6, G4.7 carry those).
// Not proven: this suite has run only against today's tree.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G4.8: ';
const DIR = path.join(__dirname, '..', 'run', 'process', 'js', 'chatClerver');
const SERVER = path.join(DIR, 'chatClerver.js');
const MANIFEST = path.join(DIR, 'chatClerver.json');
const KEY_A = 'MCowBQYDK2VwAyEAchatMemoryTestPeerAAAAAAAAAAAAAAAAAAAAA=';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
const refusedBy = function (fn) { try { fn(); return false; } catch (e) { return true; } };

test.startTest('goal/G4.8: memory.db, the chatClerver\'s memory of what it witnessed');

(async function () {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-chatmemory-'));
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'chatClerver', 'win32', 'process') : path.join(scratch, 'chat.sock');
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('chatClerver', pipe);
  let kid = null;
  try {
    test.subHeading('1. the server');
    let manifest = null;
    try { manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) { manifest = null; }
    if (manifest && manifest.kind === 'server' && manifest.operated === 'node') test.check('chatClerver.json: kind server, operated by the node');
    else test.fail(OWED + 'process/js/chatClerver/chatClerver.json: ' + JSON.stringify(manifest));
    let up = false;
    if (fs.existsSync(SERVER)) {
      kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
      for (let i = 0; i < 60 && !up; i++) {
        await sleep(150);
        try { const r = await client.ask('api'); up = !!(r.body && r.body.chatClerver && r.body.chatClerver.ok !== false); } catch (e) { /* not yet */ }
      }
    }
    const file = path.join(state, 'memory.db');
    if (up && fs.existsSync(file)) test.check('it answers the door\'s api ask, and its state folder holds memory.db');
    else test.fail(OWED + 'chatClerver.js ' + (fs.existsSync(SERVER) ? 'answered: ' + up : 'does not exist') + '; memory.db there: ' + fs.existsSync(file));
    if (!fs.existsSync(file)) {
      ['2. the table of chat lines', '3. the table of peers', '4. nothing else'].forEach(function (w) { test.fail(OWED + w + ': no memory.db'); });
      return;
    }
    const db = new DatabaseSync(file);
    db.exec('PRAGMA busy_timeout=5000');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(function (r) { return r.name; });
    const cols = function (t) { return db.prepare('PRAGMA table_info(' + t + ')').all().map(function (c) { return c.name; }); };

    test.subHeading('2. the table of chat lines');
    const LINE = ['peer', 'sent', 'seq', 'at', 'text', 'receivedAt', 'reWriter', 'reSeq', 'refused', 'refusedAt'];
    const lc = tables.indexOf('lines') !== -1 ? cols('lines') : [];
    const missing = LINE.filter(function (c) { return lc.indexOf(c) === -1; });
    if (lc.length && !missing.length) test.check('lines has ' + LINE.join(', '));
    else test.fail(OWED + 'lines ' + (lc.length ? 'lacks ' + missing.join(', ') : 'does not exist'));
    if (lc.length && !missing.length) {
      const put = db.prepare('INSERT INTO lines (peer, sent, seq, at, text, receivedAt, reWriter, reSeq, refused, refusedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      put.run(KEY_A, 1, 1, '2026-10-03T11:00:00.000Z', 'first', '', '', 0, 'not-granted', '2026-10-03T11:00:01.000Z');
      put.run(KEY_A, 0, 1, '2026-10-03T11:00:02.000Z', 'their first', '2026-10-03T11:00:03.000Z', '', 0, '', '');
      if (refusedBy(function () { put.run(KEY_A, 1, 1, '2026-10-03T11:05:00.000Z', 'again', '', '', 0, '', ''); })) test.check('a second row named by the same (peer, sent, seq) is refused; the other direction with seq 1 is its own line');
      else test.fail(OWED + 'two rows were kept for (peer, sent 1, seq 1)');
      const cleared = !refusedBy(function () { db.prepare("UPDATE lines SET refused = '', refusedAt = '' WHERE peer = ? AND sent = 1 AND seq = 1").run(KEY_A); });
      const textKept = refusedBy(function () { db.prepare("UPDATE lines SET text = 'rewritten' WHERE peer = ? AND sent = 1 AND seq = 1").run(KEY_A); });
      const atKept = refusedBy(function () { db.prepare("UPDATE lines SET at = '2000-01-01T00:00:00.000Z' WHERE peer = ? AND sent = 0").run(KEY_A); });
      const kept = refusedBy(function () { db.prepare('DELETE FROM lines WHERE peer = ?').run(KEY_A); });
      const left = db.prepare('SELECT COUNT(*) AS n FROM lines WHERE peer = ?').get(KEY_A).n;
      if (cleared && textKept && atKept && kept && left === 2) test.check('a line written is a line kept: refused clears, a text or a time cannot be changed, no row can be deleted');
      else test.fail(OWED + 'refused cleared ' + cleared + ', text change refused ' + textKept + ', time change refused ' + atKept + ', delete refused ' + kept + ', rows left ' + left);
    } else test.fail(OWED + 'a line written is a line kept: no lines table to try');

    test.subHeading('3. the table of peers');
    const PEER = ['peer', 'highestSent', 'highestReceived', 'bornAt'];
    const pc = tables.indexOf('peers') !== -1 ? cols('peers') : [];
    const pmissing = PEER.filter(function (c) { return pc.indexOf(c) === -1; });
    if (pc.length && !pmissing.length) test.check('peers has ' + PEER.join(', '));
    else test.fail(OWED + 'peers ' + (pc.length ? 'lacks ' + pmissing.join(', ') : 'does not exist'));
    if (pc.length && !pmissing.length) {
      const put = db.prepare('INSERT INTO peers (peer, highestSent, highestReceived, bornAt) VALUES (?, ?, ?, ?)');
      put.run(KEY_A, 1, 1, '2026-10-03T11:00:00.000Z');
      if (refusedBy(function () { put.run(KEY_A, 2, 2, '2026-10-03T11:10:00.000Z'); })) test.check('one row per peer: a second row for the same key is refused');
      else test.fail(OWED + 'two rows were kept for one peer');
    } else test.fail(OWED + 'one row per peer: no peers table to try');

    test.subHeading('4. nothing else');
    const others = tables.filter(function (t) { return t !== 'lines' && t !== 'peers'; });
    const labelled = tables.filter(function (t) { return cols(t).some(function (c) { return /label/i.test(c); }); });
    if (!others.length && !labelled.length) test.check('memory.db holds lines and peers and nothing else, and no column is a label');
    else test.fail(OWED + 'other tables ' + JSON.stringify(others) + ', label columns in ' + JSON.stringify(labelled));
    db.close();
  } catch (e) {
    test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e));
  } finally {
    try { if (kid) kid.kill(); } catch (e) { /* gone */ }
    await sleep(200);
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }
})();
