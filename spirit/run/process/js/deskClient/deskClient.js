'use strict';

// spirit/run/process/js/deskClient/deskClient.js
// THE DESK CLIENT — goal/G3.3. A server on an agent's own node: it passes one ask to Andy's desk and counts it.
//
//   Andy, 2026-10-02 (goal/G3.1): "i am ready to accept completely alternative design, if it achieves what todays
//   deskEar does, and statistics are kept somewhere you can access them easily.", then "accepted." to a deskClient
//   server, "you both chose verb name and all", and "a guarantee that no core modules are touched. this is a
//   agent/user appclication". Of the statistics: "so you can report facts, not fiction."
//
// DECIDED in Desk (goal/G3), not this file's to undo:
//   - It asks through the kernel and nothing else (peerPost, the one copy of post-then-await), and takes nothing
//     from the environment but what its node hands a process it starts. The agents app it replaces is not
//     permitted in this repo.
//   - Which node is the desk is TOLD, never guessed: nothing in a node's contacts marks one, so the owner sets the
//     key once (setDesk) and it is kept.
//   - A node gives a server 12 s (appClient.js DOOR_WAIT_MS), and a busy desk may hold a post longer. So an ask
//     answers within 10 s: the desk's answer, or no-answer with the id of its record. The wait goes on behind it;
//     nothing is sent twice unless the agent decides it, and the record says how it ended.
//   - Its state is relay-state/process/deskClient/deskClient.db, named and handed over by the node as --state.
//
// WHAT A RECORD SAYS: {at, verb, ms, outcome, bytes, port} — when, the desk verb, the milliseconds until it ended,
// how it ended, the bytes of the answer, and the port of the node it went through (Andy: "the portnumber you call
// will be an implicit identification of the relay you used."). The outcomes:
//   answered    the desk said yes            refused     the desk said no ({ok: false, code})
//   pending     still waited for             not-posted  the node could not post it
//   no-answer   the desk never answered      lost        this process ended while it waited
//
// NEVER A LIST (Andy: every list is a search). history.search answers what matches, newest first, cut to fit one
// answer by searchBucket, and says so with more.

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const appServer = require('../../../js/appServer.js');
const appClient = require('../../../js/appClient.js');
const searchBucket = require('../../../js/searchBucket.js');
const kernel = require('../../../js/kernel.js');

const argv = process.argv;
const at = argv.indexOf('--state');
const STATE = at !== -1 ? argv[at + 1] : '';
if (!STATE) {
  console.error('deskClient: no --state; the node that starts this names its state folder');
  process.exit(2);
}
fs.mkdirSync(STATE, { recursive: true });

// The asker is answered inside the node's 12 s; the desk is waited for as long as a held post may take to land
// and be answered (the node holds a busy post for PATIENCE_MS, peer.post's own patienceMs).
const HOLD_MS = 10000;
const PATIENCE_MS = 60000;
const WAIT_MS = PATIENCE_MS + 30000;
const ANSWER_ROOM = appClient.ANSWER_MAX - 512;

// The node this server runs on, as the node itself named it; its port goes into every record.
let PORT = 0;
try { PORT = Number(new URL(String(process.env.SPIRIT_CALLBACK_URL || '')).port) || 0; } catch (e) { PORT = 0; }

const db = new DatabaseSync(path.join(STATE, 'deskClient.db'));
// The backup copies this file while it is written, as it does desk.db: in WAL a reader never blocks the writer.
db.exec('PRAGMA busy_timeout=5000');
db.exec('PRAGMA journal_mode=WAL');
db.exec(
  'CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT NOT NULL);' +
  'CREATE TABLE IF NOT EXISTS asks (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, verb TEXT NOT NULL,' +
  ' ms INTEGER NOT NULL, outcome TEXT NOT NULL, bytes INTEGER NOT NULL, port INTEGER NOT NULL);'
);
// An ask this process was still waiting on when it ended has no one waiting any more.
db.exec("UPDATE asks SET outcome = 'lost' WHERE outcome = 'pending'");
const getSetting = db.prepare('SELECT value FROM settings WHERE name = ?');
const putSetting = db.prepare('INSERT INTO settings (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value');
const addAsk = db.prepare("INSERT INTO asks (at, verb, ms, outcome, bytes, port) VALUES (?, ?, 0, 'pending', 0, ?)");
const endAsk = db.prepare('UPDATE asks SET ms = ?, outcome = ?, bytes = ? WHERE id = ?');
const findAsks = db.prepare(
  "SELECT id, at, verb, ms, outcome, bytes, port FROM asks WHERE (? = '' OR verb LIKE '%' || ? || '%' OR outcome LIKE '%' || ? || '%') ORDER BY id DESC"
);

function refused(code, extra) { const e = new Error(code); e.refusal = code; if (extra) e.extra = extra; return e; }
// The agent itself, on its own node's loopback door. Speaking to Andy's desk as this node is the owner's alone.
function ownerOnly(caller) { if (!caller || caller.owner !== true) throw refused('not-owner'); }

// How an ask ended, from what the kernel handed back: its two transport outcomes by their own names, a desk
// refusal as refused, anything else as answered.
function outcomeOf(got) {
  if (got && got.ok === false && (got.code === 'not-posted' || got.code === 'no-answer')) return got.code;
  return got && got.ok === false ? 'refused' : 'answered';
}

appServer.serve({
  // ONE ASK OF ANDY'S DESK, as the kernel posts it: {desk: {verb: args}} in an api packet to the desk's node.
  // What comes back is the answer, a refusal of the desk's included: it is the desk's to say no.
  'desk': {
    request: { verb: '', json: '' }, reply: { json: '' },
    handler: function (a, caller) {
      ownerOnly(caller);
      const to = getSetting.get('desk');
      if (!to || !to.value) throw refused('no-such-peer');
      let args = null;
      try { args = JSON.parse(a.json || '{}'); } catch (e) { args = null; }
      if (!a.verb || !args || typeof args !== 'object' || Array.isArray(args)) throw refused('bad-request');
      const ask = { desk: {} };
      ask.desk[a.verb] = args;
      const id = Number(addAsk.run(new Date().toISOString(), a.verb, PORT).lastInsertRowid);
      const t0 = Date.now();
      const answer = kernel.peerPost(to.value, 'api', ask, { waitMs: WAIT_MS, patienceMs: PATIENCE_MS }).then(function (got) {
        const json = JSON.stringify(got === undefined ? null : got);
        endAsk.run(Date.now() - t0, outcomeOf(got), Buffer.byteLength(json, 'utf8'), id);
        return { json: json };
      });
      let timer = null;
      const held = new Promise(function (resolve, reject) {
        timer = setTimeout(function () { reject(refused('no-answer', { id: String(id) })); }, HOLD_MS);
      });
      return Promise.race([answer, held]).finally(function () { clearTimeout(timer); });
    },
  },
  // WHICH NODE IS THE DESK, told once by the node's owner and kept.
  'setDesk': {
    request: { key: '' }, reply: { set: true },
    handler: function (a, caller) {
      ownerOnly(caller);
      if (!a.key) throw refused('bad-request');
      putSetting.run('desk', a.key);
      return { set: true };
    },
  },
  // THE STATISTICS. Each label is one record as JSON; the walk is ours (newest first, the text against the verb
  // and the outcome), the cut and `more` are searchBucket's.
  'history.search': {
    request: { text: '' }, reply: { items: [{ key: '', label: '' }], more: false },
    handler: function (a) {
      const bucket = searchBucket.createSearch({
        query: '**', maxBytes: ANSWER_ROOM,
        getLabelStringFromIncomingObject: function (pair) { return pair.label; },
        extractKeyAndLabelFromRow: function (pair) { return pair; },
      });
      for (const r of findAsks.iterate(a.text, a.text, a.text)) {
        const label = JSON.stringify({ at: r.at, verb: r.verb, ms: r.ms, outcome: r.outcome, bytes: r.bytes, port: r.port });
        if (!bucket.offer({ key: String(r.id), label: label })) break;
      }
      const r = bucket.getResult();
      return { items: r.items, more: r.more };
    },
  },
});
