'use strict';

// spirit/run/spirit/app/desk/server/server.js (the node half of desk.js, goal/G43.27)
// THE DESK SERVER — desk/G1.3.
//
//   Andy, 2026-09-29: "i might want a process that serves the data through
//   desk.db", and, on where its state lives, "appServer states ARE a subset
//   of the nodes state" and "any appServer state is none of git's business".
//
// DECIDED in Desk (desk/G1), not this file's to undo:
//   D5  its state is the folder the node names, spirit/state/desk/data/
//       (goal/G43.10): desk.db, never in git. The node hands it over as
//       --state, beside --pipe; this process never works it out itself, so
//       a test hands it a temp folder and the live record is never touched.
//   D4  the local shell reaches it by its verbs (desk.<verb>) on the loopback door, a known
//       member by an 'api' packet; both end in appClient.ask.
//   D12 no reply carries 'ok': that key is an error's (appServer.js).
//
// Free-form documents travel as JSON text (a desk verb's json, an item's
// facts as item.get answers them): the helper matches keys exactly (appPair
// D8), so an open object could never match its prototype.
//
// NEVER A LIST (Andy: every list is a search). Every *.search verb answers
// what matches, ranked, newest first among equals, cut to fit one answer by
// the probability bucket, and says so with more (tableSearch, below).

// The spirit object first, as the global spirit (goal/G40.1).
require('../../../spirit.js');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const appServer = spirit.requireScript('spirit/server/app.js');
const limits = spirit.requireScript('spirit/limits.js');

const argv = process.argv;
const at = argv.indexOf('--state');
const STATE = at !== -1 ? argv[at + 1] : '';
// THE MANIFEST'S VALUES, as the node hands them (job.js: one JSON object, name -> value, as the first argument).
let values = {};
try { values = JSON.parse(argv[2] || '{}') || {}; } catch (e) { values = {}; }
if (!STATE) {
  console.error('desk: no --state; the node that starts this names its state folder');
  process.exit(2);
}
fs.mkdirSync(STATE, { recursive: true });

const db = new DatabaseSync(path.join(STATE, 'desk.db'));
// WRITING WHILE THE BACKUP READS. Andy, 2026-09-29: "Desk could not keep its
// log: the handler failed": in the default journal a reader copying the file
// holds it against this writer. In WAL a reader never blocks the writer; the
// wait covers what is left (a checkpoint). deskWhileBackup.js holds it.
db.exec('PRAGMA busy_timeout=5000');
db.exec('PRAGMA journal_mode=WAL');
// NO TABLE MADE BEFORE IS MENDED: none is renamed, carried over or dropped, and no column is added (Andy, goal/G47.1:
// "old files or tables should not be mended, THE SHOULD BE FUCKING KILLED AND ELIMINATED FOREVER!"). An old desk.db is
// deleted by hand, on his word.

// One answer must travel back as one packet (limits.ANSWER_MAX); the
// wrapper around the lines is small, and this leaves it room.
const ANSWER_ROOM = limits.ANSWER_MAX - 512;

// ── ONE MEASURE OF "FITS" (slim/G1.2) ───────────────────────────────
//
//   Andy: "Desk must adhere to standards as well.", and
//   "from now on the MAX_PAYLOAD applies".
//
// A line fits when an answer holding it alone fits the room, measured as
// one answer is measured ({items: [{key, label}], more}). chat.add's
// refusal and the searches' skip use this one test: a line the bucket could
// not send first would stop a read with nothing in it.
function oneAnswerBytes(key, line) {
  return Buffer.byteLength(JSON.stringify({ items: [{ key: String(key), label: String(line) }], more: false }), 'utf8');
}
// A REFUSAL SAYS HOW LARGE, AND THE LIMIT (Andy: "why can't the system cleanly reject oversized stuff?").
function tooLarge(bytes, max) {
  const e = new Error('line too large to come back in one answer');
  e.refusal = 'line-too-large';
  e.extra = { bytes: Number(bytes) || 0, max: Number(max) || ANSWER_ROOM };
  return e;
}
// The room item.chat fills, measured the way it fills it: so a line chat.add takes always comes back whole.
const CHAT_ROOM = ANSWER_ROOM - Buffer.byteLength(JSON.stringify({ chatMore: false }), 'utf8');
function chatLineBytes(index, line) { return oneAnswerBytes(String(index), JSON.stringify(line)); }
// A RED Q IS ONE CONCISE SENTENCE (goal/G21.2). Andy, in the item's box: "A Q longer than one sentence, or over about
// 200 bytes, is refused with a why." Mechanically: no line break, no sentence end (. ! ?) with more text after it, and
// at most Q_MAX_BYTES counted in bytes (Andy's rule of 2026-10-10: every size check in bytes). Returns the why, or ''.
const Q_MAX_BYTES = 200;
function qWhy(words) {
  const t = String(words).trim();
  if (!t) return 'a red Q needs its question';
  const bytes = Buffer.byteLength(t, 'utf8');
  if (bytes > Q_MAX_BYTES) return 'a red Q is one concise sentence of at most ' + Q_MAX_BYTES + ' bytes; this one is ' + bytes;
  if (/[\r\n]/.test(t) || /[.!?]+["')\]]*\s+\S/.test(t)) return 'a red Q is one sentence; this one holds more: put the rest in the chat';
  return '';
}
// HIS CLEAR (goal/G21.2): "Q:clear deletes every red Q on the item; Q<n>:clear deletes only that one." His chat line
// typed so, case and blanks ignored. Returns null for any other line, else { number: 'Q<n>' or '' for all }.
function clearOf(text) {
  const m = /^\s*q\s*(\d*)\s*:\s*clear\s*$/i.exec(String(text));
  return m ? { number: m[1] ? 'Q' + Number(m[1]) : '' } : null;
}
// Who placed a Q, by key: the record's key, '' for a record from before keys.
function placerOf(s, c) { return c.placedKey || ''; }
// AN AGENT STAYS WITH ITS OPEN RED Q (goal/G41.2). Andy: "when i repond to a red Q, the agent must enter remain with the
// red Q and me, until it is resolved, so that you won't go of making red Q decisions without me", and on resolving it:
// "if you feel a Q answered usefully, then fucking remove the Q with an appropriate remark". The writer's own open Q on
// the item, or null.
function ownOpenQ(s, it, w) {
  return (it.checks || []).filter(function (c) {
    return c.kind === 'Q' && c.state === 'open' && (w.key ? placerOf(s, c) === w.key : c.placedBy === w.by);
  })[0] || null;
}
// The room chat.search fills (goal/G3.11): half an answer. An agent's deskClient packs the desk's answer once more
// as text, where every quote and backslash gains one byte, so at most the answer doubles; half the room is what
// still arrives in one piece. Andy: "what's the problem with having to be brief?", "none of this joing shit."
const SEARCH_ROOM = Math.floor(ANSWER_ROOM / 2);
// THE CHECKS AN ITEM ANSWERS WITH (goal/G9.16): an answered question leaves the panel and stays in the record. Andy:
// "questions are red-text that disappears when you feel i answered usefully"; a grant "turn[s] green and [is] logged",
// so a granted one stays, with its tick. On 2026-10-09 the retrofit item held fourteen answered questions, each the
// whole chat line it came from, and the panel measured below outweighed one answer: every write to it was rolled
// back, and the two open questions could not even be closed. The record keeps every check; the panel is the open and
// the decided ones, never the answered.
function shownChecks(it) {
  // A Q he cleared (goal/G21.2) leaves the panel as an answered one does. A VOIDED GRANT LEAVES IT TOO (goal/G41.27; Andy:
  // "cw, make that fix."): every core file added voided the core grant and opened a new one, while there were core grants,
  // so voided grants piled up on the panel until one more no longer fit an answer. The record keeps them.
  return (it.checks || []).filter(function (c) { return c.state !== 'answered' && c.state !== 'cleared' && c.state !== 'voided'; });
}
// Every panel an item answers with, each measured as one answer: its facts (item.get, and its label in a search),
// its box (item.box) and its checks (item.checks). The largest, against the room.
function largestPanel(s, id) {
  const it = s.items[id];
  if (!it) return 0;
  return Math.max(
    oneAnswerBytes(id, JSON.stringify(facts(s, it))),
    Buffer.byteLength(JSON.stringify({ box: it.box, version: it.version }), 'utf8'),
    Buffer.byteLength(JSON.stringify({ checks: shownChecks(it) }), 'utf8'));
}

function parsed(json) {
  const v = JSON.parse(String(json));
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('not a JSON object');
  return v;
}
// Offers each object of `walk`, in its order, to the probability bucket at
// probability 0, so the walk's order stands (an equal one seats behind), and
// answers what fits `room` (ANSWER_ROOM unless said). One too big to be sent
// alone is never offered: it would stop the walk with nothing sent (slim/G1.2
// T2); skipping it says `more`. The walk stops once the room is passed.
function walked(walk, pairOf, room) {
  const limit = room || ANSWER_ROOM;
  const bucket = createProbabilityBucket(Infinity);
  let skipped = false;
  let bytes = 0;
  for (const obj of walk) {
    if (bytes > limit) { skipped = true; break; }
    const pair = pairOf(obj);
    const one = oneAnswerBytes(pair.key, pair.label);
    if (one > limit) { skipped = true; continue; }
    bucket.seatFor(0, pair);
    bytes += Buffer.byteLength(JSON.stringify(pair), 'utf8') + 1;
  }
  const r = bucket.serialize(null, limit);
  return { items: r.items, more: !!r.more || skipped };
}

// ── THE DESK'S SEARCHES RANK BY PROBABILITY (goal/G18.5) ──────────────
//
//   Andy, 2026-10-12 (goal/G18): "i have a strong dislike for the search system right now", and the three probabilit
//   modules built for it (G18.2 to G18.4). In G18.5: the desk searches move onto them ("your points accepted.");
//   nothing is dropped: "The bucket solves this. if all items are probability 0, that is equal to the old searches
//   "*""; "the item search must probability search the chat-lines, and weigh the chat lines in the item result as 50%
//   overall."; "the chat lines have all equal weight within their 50%"; and "chat lines are 50% of the weight, if there
//   is no chat lines the rule still applies, meaning that half is going to default to a probability of 0."
// How it is used, his words for the bucket: "the desk reads items, newest to oldest, up to MAX_SCANNED_ITEMS, compares
// every item against the search string, gets a probability as result, then drops the (probability,item) combination
// into the bucket. at the end calls serialize, done."
//
// With no text every probability is 0 and the bucket keeps the walk's order.
const probabilityStringMatch = spirit.requireScript('spirit/search/string.js').probabilityStringMatch;
const probabilityStringObjectMatch = spirit.requireScript('spirit/search/object.js').probabilityStringObjectMatch;
const createProbabilityBucket = spirit.requireScript('spirit/listLimiter.js').createProbabilityBucket;
const MAX_SCANNED_ITEMS = 1000;
function lineProbability(text, line) { return text ? probabilityStringMatch(text, String(line.text)) : 0; }
// THE WHOLE ROW, AS ITS GET SERVES IT (goal/G41.28; Andy, box v15: "a probability search of a dataBase table must ALWAYS
// search the whole bloody ROW, as it is served through a single-row \"get\", using a probabilityStringObjectMatch."):
// row is the item's facts, what item.get answers, so its goal, its status and its numbers are searched too.
function itemProbability(text, row, lines) {
  if (!text) return 0;
  const fields = probabilityStringObjectMatch(text, row);
  const chat = lines.length ? lines.reduce(function (n, l) { return n + lineProbability(text, l); }, 0) / lines.length : 0;
  return 0.5 * fields + 0.5 * chat;
}
// The walk offers {probability, pair} in its own order, newest or session first; the bucket seats them, an equal
// probability behind those already in, so that order stands among equals. One pair too big for the room alone is
// skipped and said by more, as walked() does; past MAX_SCANNED_ITEMS the walk stops, and that is said by more too.
function ranked(walk, room) {
  // The bucket's one limit is bytes (goal/G49.8); the scan stops at MAX_SCANNED_ITEMS itself, and serialize cuts at room.
  const bucket = createProbabilityBucket(Infinity);
  let scanned = 0;
  let more = false;
  for (const one of walk) {
    if (scanned >= MAX_SCANNED_ITEMS) { more = true; break; }
    scanned += 1;
    if (oneAnswerBytes(one.pair.key, one.pair.label) > room) { more = true; continue; }
    bucket.seatFor(one.probability, one.pair);
  }
  const r = bucket.serialize(null, room);
  return { items: r.items, more: r.more || more };
}

// ── EVERY TABLE'S SEARCH, FROM ONE COMPONENT (goal/G33.7) ──────────────
//
//   The box: "Every desk table's interface has its probability search, mandatory and made by one shared component
//   rather than written per table".
//
// tableSearch(spec) makes the verb: spec.request (the arguments beside text, each '' or its kind), spec.rows(a, st,
// caller) -> [{ key, label, row?, probability? }] in the walk's order (newest first where there is an order), and
// spec.room (ANSWER_ROOM unless said). Each row ranks by text against the whole row (probabilityStringObjectMatch):
// row, the row as its table's get serves it, when the answer's label carries less than that, else the label; unless
// it brings its own probability; every row goes through ranked(), so the answer fills one room and says more. With no
// text every probability is 0 and the walk's order stands. A table's verb is this and nothing else.
function tableSearch(spec) {
  return {
    request: Object.assign({ text: '' }, spec.request || {}), reply: { items: [{ key: '', label: '' }], more: false },
    accepts: spec.accepts,
    handler: function (a, caller) {
      const text = String((a && a.text) || '').trim();
      const rows = spec.rows(a || {}, walkState(), caller, text);
      // THE WHOLE ROW, AS IT IS SERVED (goal/G41.28; Andy, box v15: "a probability search of a dataBase table must ALWAYS
      // search the whole bloody ROW, as it is served through a single-row \"get\""): the words are matched against the
      // row the answer carries, its label, never against fields picked from it.
      return ranked(rows.map(function (r) {
        let row = r.row !== undefined ? r.row : r.label;
        if (typeof row === 'string') { try { row = JSON.parse(row); } catch (e) { row = { text: row }; } }
        const p = typeof r.probability === 'number' ? r.probability : text ? probabilityStringObjectMatch(text, row && typeof row === 'object' && !Array.isArray(row) ? row : { value: String(row) }) : 0;
        return { probability: p, pair: { key: String(r.key), label: typeof r.label === 'string' ? r.label : JSON.stringify(r.label) } };
      }), spec.room || ANSWER_ROOM);
    },
  };
}
function itemFor(st, a) {
  const it = st.items[String((a && a.id) || '')];
  if (!it) throw refused('no-such-item');
  return it;
}

// ── THE STATE, IN TABLES KEYED BY GOAL AND ITEM (goal/G33.4) ─────────
//
//   Andy, in the item's box: "there is a need for two numberic MAIN key fields for desk goals and items.", "Tables keyed
//   by goal number and item number: goals and items, chat, and files; each file row holds its grant status.", "The box
//   is a side table of its own, keyed by goal, item and version", "Checks (the Q and G lines) and claims are side tables
//   keyed by goal and item like the others.", "Every row in the desk database carries a creator reference: who wrote
//   it.", and "The desk keeps state only: the keyed tables are the store, and the log of writes goes."
//
// DECIDED BY ANDY, not this file's to undo: there is no log of writes (`records` went with goal/G33.4), an agent's word
// was one current value per agent, and an id is two numbers, goal and item (0 for the goal itself), rendered goal/G<n>
// or goal/G<n>.<m>. No sub-goals: an item never becomes a goal.
//
// HOW (this build's plainest reading): the tables are read once at start into the state every rule below reads (S);
// each write is applied to S and written through, in the same step, to exactly the rows it changed, which are then
// pushed (goal/G33.4: "the desk pushes each changed sub-element of a goal or item ... separately"). Nothing is replayed.
//   items    (goal, item)                  the item's own fields as JSON; a goal's row (item 0) also its goal's (design,
//                                          members, special); special marks a standing goal kept in the data
//   chat     (goal, item, seq)             one line, with at and creator (goal/G33.4: "keyed by goal, item, timestamp and
//                                          the writer's id"; seq keeps two lines of one millisecond apart)
//   box      (goal, item, version)         one row per version
//   checks   (goal, item, number)          one Q, G, C or T check
//   desk_state (k)                         the desk's own few values: the change number, the current goal, the grants
// THE CHANGE NUMBER stays: one per write, stamped on every row the write changed and on every row the write publishes,
// so a client that hears a number skip knows it missed a row.
const GOAL_RE = /^goal\/G(\d+)(?:\.(\d+))?$/;
// goal/G33.4 -> [33, 4]; goal/G33 -> [33, 0]; anything else -> null.
function numbersOf(id) { const m = GOAL_RE.exec(String(id || '')); return m ? [Number(m[1]), Number(m[2] || 0)] : null; }
function idOf(goal, item) { return 'goal/G' + goal + (item ? '.' + item : ''); }

db.exec(
  // THE RULES ARE GONE FROM THE DESK (goal/G47.4, box v36; Andy: "Next we kill rules from desk. nobody observes them",
  // "box the rule tables auto-kill"): their three tables are not made, and an old desk.db's are dropped here at start.
  'DROP TABLE IF EXISTS rules; DROP TABLE IF EXISTS rule_drafts; DROP TABLE IF EXISTS rule_chat;' +
  // THE KEYED TABLES (goal/G33.4).
  "CREATE TABLE IF NOT EXISTS items (goal INTEGER NOT NULL, item INTEGER NOT NULL, creator TEXT NOT NULL, special INTEGER NOT NULL DEFAULT 0, at TEXT NOT NULL DEFAULT '', data TEXT NOT NULL," +
  " change INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (goal, item));" +
  'CREATE INDEX IF NOT EXISTS items_change ON items (change);' +
  'CREATE TABLE IF NOT EXISTS chat (goal INTEGER NOT NULL, item INTEGER NOT NULL, seq INTEGER NOT NULL, at TEXT NOT NULL, creator TEXT NOT NULL, data TEXT NOT NULL,' +
  ' change INTEGER NOT NULL DEFAULT 0, born INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (goal, item, seq));' +
  'CREATE INDEX IF NOT EXISTS chat_born ON chat (born);' +
  'CREATE INDEX IF NOT EXISTS chat_at ON chat (goal, item, at, creator);' +
  'CREATE TABLE IF NOT EXISTS box (goal INTEGER NOT NULL, item INTEGER NOT NULL, version INTEGER NOT NULL, creator TEXT NOT NULL, at TEXT NOT NULL, text TEXT NOT NULL, PRIMARY KEY (goal, item, version));' +
  'CREATE TABLE IF NOT EXISTS checks (goal INTEGER NOT NULL, item INTEGER NOT NULL, number TEXT NOT NULL, pos INTEGER NOT NULL, creator TEXT NOT NULL, data TEXT NOT NULL, change INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (goal, item, number));' +
  'CREATE TABLE IF NOT EXISTS desk_state (k TEXT PRIMARY KEY, v TEXT NOT NULL);'
);

// Whether an id is a goal's or one of its items, by the id alone: an item's id is goal/G<n>.<m>.
function inGoalOf(goal, id) { const g = numbersOf(goal); const x = numbersOf(id); return !!g && !!x && g[0] === x[0]; }

// ── S: THE STATE AS THE TABLES HOLD IT ────────────────────────────────
function newState() {
  return { change: 0, goals: Object.create(null), items: Object.create(null), current: '', addGrant: 0, addGrantGoal: '', goalGrant: 0 };
}
let S = null;
function walkState() { return S; }

// THE FIELDS OF AN ITEM THAT ARE ROWS OF THEIR OWN, never in its items row.
const SIDE_FIELDS = ['chat', 'checks', 'box', 'boxBy', 'boxKey', 'boxAt', 'boxHistory'];
const NULL_PROTO = ['checkHigh'];
function goalData(g) { const o = Object.assign({}, g); delete o.id; return o; }
// Who made it: the key it was written with, else the label (the desk's own rows: desk).
function madeBy(r) { return String((r && (r.key || r.by)) || 'desk'); }
// A chat line's JSON, kept per line while its Q mark, the one field a line can change after it is written, stays as it
// was: an item's whole chat is compared at each write, and its lines are rarely changed.
const LINE_JSON = new WeakMap();
function lineJson(l) {
  const sig = String(l.q);
  const kept = LINE_JSON.get(l);
  if (kept && kept.sig === sig) return kept.json;
  const json = JSON.stringify(l);
  LINE_JSON.set(l, { sig: sig, json: json });
  return json;
}
// Every row an item is, by a key unique within the item: [{ key, table, cols, out }]; cols in the table's column
// order after (goal, item), out the row as it is pushed.
function rowsOf(s, it) {
  const k = numbersOf(it.id);
  if (!k) return [];
  const out = [];
  const data = {};
  Object.keys(it).forEach(function (f) { if (SIDE_FIELDS.indexOf(f) === -1) data[f] = it[f]; });
  const gs = it.goal ? s.goals[it.id] : null;
  if (gs) data.goalState = goalData(gs);
  out.push({ key: 'items', table: 'items', cols: [String(it.made || it.creatorKey || it.creator || 'desk'), gs && gs.special ? 1 : 0, String(it.at || ''), JSON.stringify(data)] });
  it.chat.forEach(function (l, i) {
    out.push({ key: 'chat|' + i, table: 'chat', id: i, cols: [i, String(l.at || ''), String(l.key || l.by || 'desk'), lineJson(l)], out: function () { return shownLine(l); } });
  });
  if (it.version > 0) out.push({ key: 'box', table: 'box', cols: [it.version, String(it.boxKey || it.boxBy || 'desk'), String(it.boxAt || ''), String(it.box)],
    out: function () { return { version: it.version, text: String(it.box), by: String(it.boxBy || ''), at: String(it.boxAt || '') }; } });
  it.checks.forEach(function (c, i) {
    out.push({ key: 'checks|' + c.number, table: 'checks', id: c.number, cols: [c.number, i, String(c.made || c.placedKey || c.placedBy || c.by || 'desk'), JSON.stringify(c)], out: function () { return c; } });
  });
  return out;
}
const UPSERT = {
  items: db.prepare('INSERT INTO items (goal, item, creator, special, at, data, change) VALUES (?, ?, ?, ?, ?, ?, ?)' +
    ' ON CONFLICT(goal, item) DO UPDATE SET creator = excluded.creator, special = excluded.special, at = excluded.at, data = excluded.data, change = excluded.change'),
  chat: db.prepare('INSERT INTO chat (goal, item, seq, at, creator, data, change, born) VALUES (?, ?, ?, ?, ?, ?, ?, ?)' +
    ' ON CONFLICT(goal, item, seq) DO UPDATE SET at = excluded.at, creator = excluded.creator, data = excluded.data, change = excluded.change'),
  box: db.prepare('INSERT OR REPLACE INTO box (goal, item, version, creator, at, text) VALUES (?, ?, ?, ?, ?, ?)'),
  // ONLY THE NEWEST BOX IS KEPT (goal/G47.1, Q16; Andy, of the old box versions among the unread logs: "ALL OF THEM.
  // KILL THEM. NOBODY READ THAT SHIT, THEY SHOULD NOT EXIST."): a box written deletes its item's older versions in the
  // same write. The version number keeps counting: the kept row carries it, and loadState reads it back.
  olderBoxes: db.prepare('DELETE FROM box WHERE goal = ? AND item = ? AND version < ?'),
  checks: db.prepare('INSERT INTO checks (goal, item, number, pos, creator, data, change) VALUES (?, ?, ?, ?, ?, ?, ?)' +
    ' ON CONFLICT(goal, item, number) DO UPDATE SET pos = excluded.pos, creator = excluded.creator, data = excluded.data, change = excluded.change'),
};
const DELETE = {
  items: db.prepare('DELETE FROM items WHERE goal = ? AND item = ?'),
  chat: db.prepare('DELETE FROM chat WHERE goal = ? AND item = ? AND seq = ?'),
  box: db.prepare('DELETE FROM box WHERE goal = ? AND item = ?'),
  checks: db.prepare('DELETE FROM checks WHERE goal = ? AND item = ? AND number = ?'),
};
// The rows last written, per item: key -> the row's cols as JSON. A write compares against it, so it writes and pushes
// exactly what changed.
const ROWS = new Map();
// What a row is compared by: its columns as JSON; a chat line by its kept JSON alone (lineJson), the same string while
// the line is unchanged, so a long chat costs no new text at each write.
function rowSig(x) { return x.table === 'chat' ? x.cols[3] : JSON.stringify(x.cols); }
function writeRow(k, x, r) {
  const c = x.cols;
  if (x.table === 'items') UPSERT.items.run(k[0], k[1], c[0], c[1], c[2], c[3], r.n);
  else if (x.table === 'chat') UPSERT.chat.run(k[0], k[1], c[0], c[1], c[2], c[3], r.n, r.n);
  else if (x.table === 'box') { UPSERT.box.run(k[0], k[1], c[0], c[1], c[2], c[3]); UPSERT.olderBoxes.run(k[0], k[1], c[0]); }
  else if (x.table === 'checks') UPSERT.checks.run(k[0], k[1], c[0], c[1], c[2], c[3], r.n);
}
function deleteRow(k, key) {
  const parts = key.split('|');
  const table = parts[0];
  if (table === 'items') DELETE.items.run(k[0], k[1]);
  else if (table === 'chat') DELETE.chat.run(k[0], k[1], Number(parts[1]));
  else if (table === 'box') { /* a box goes only with its item */ }
  else if (table === 'checks') DELETE.checks.run(k[0], k[1], parts.slice(1).join('|'));
}
// One item written through: every row of it that changed is written, every row it no longer has deleted. Answers what
// changed, as { table, key, x (the row), removed } in row order. written: the item the write named, whose items row is
// written even when unchanged, so it carries the write's change number.
function persistItem(s, it, r, written, body) {
  const k = numbersOf(it.id);
  if (!k) return [];
  const old = ROWS.get(it.id) || new Map();
  const now = new Map();
  const changed = [];
  rowsOf(s, it).forEach(function (x) {
    const j = rowSig(x);
    now.set(x.key, j);
    if (old.get(x.key) === j && !(written && x.table === 'items')) return;
    writeRow(k, x, r);
    if (old.get(x.key) !== j) changed.push({ table: x.table, key: x.key, x: x, removed: false });
  });
  old.forEach(function (j, key) {
    if (now.has(key)) return;
    deleteRow(k, key);
    changed.push({ table: key.split('|')[0], key: key, x: null, removed: true });
  });
  ROWS.set(it.id, now);
  return changed;
}
// ITS GOAL GONE (shedding): every row of every item of it.
function dropGoalRows(n) {
  ['items', 'chat', 'box', 'checks'].forEach(function (t) { db.prepare('DELETE FROM ' + t + ' WHERE goal = ?').run(n); });
}

const putDeskState = db.prepare('INSERT INTO desk_state (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v');
const DESK_STATE_KEYS = ['change', 'current', 'addGrant', 'addGrantGoal', 'goalGrant'];
function persistDeskState(s) { DESK_STATE_KEYS.forEach(function (k) { putDeskState.run(k, JSON.stringify(s[k] === undefined ? null : s[k])); }); }

// THE STATE, READ ONCE FROM THE TABLES.
function loadState() {
  const s = newState();
  db.prepare('SELECT k, v FROM desk_state').all().forEach(function (row) {
    if (DESK_STATE_KEYS.indexOf(row.k) === -1) return;
    try { const v = JSON.parse(row.v); if (v !== null) s[row.k] = v; } catch (e) { /* left at its default */ }
  });
  for (const row of db.prepare('SELECT goal, item, data FROM items ORDER BY goal, item').iterate()) {
    const id = idOf(row.goal, row.item);
    let d = {};
    try { d = JSON.parse(row.data) || {}; } catch (e) { d = {}; }
    const gs = d.goalState;
    delete d.goalState;
    const it = Object.assign(blank(id, '', ''), d);
    NULL_PROTO.forEach(function (f) { it[f] = Object.assign(Object.create(null), d[f] || {}); });
    it.chat = []; it.checks = []; it.box = ''; it.version = 0;
    s.items[id] = it;
    if (row.item === 0) s.goals[id] = Object.assign({ design: false, abandoned: false, members: [] }, gs || {}, { id: id });
  }
  const at = function (g, i) { return s.items[idOf(g, i)] || null; };
  for (const row of db.prepare('SELECT goal, item, data FROM chat ORDER BY goal, item, seq').iterate()) {
    const it = at(row.goal, row.item);
    if (it) { try { it.chat.push(JSON.parse(row.data)); } catch (e) { /* a broken line is left out */ } }
  }
  for (const row of db.prepare('SELECT goal, item, data FROM checks ORDER BY goal, item, pos').iterate()) {
    const it = at(row.goal, row.item);
    if (it) { try { it.checks.push(JSON.parse(row.data)); } catch (e) { /* a broken check is left out */ } }
  }
  for (const row of db.prepare('SELECT b.goal, b.item, b.version, b.creator, b.at, b.text FROM box b WHERE b.version = (SELECT MAX(version) FROM box WHERE goal = b.goal AND item = b.item)').iterate()) {
    const it = at(row.goal, row.item);
    if (it) { it.box = row.text; it.version = row.version; it.boxKey = row.creator; it.boxAt = row.at; it.boxBy = String(it.boxBy || ''); }
  }
  ROWS.clear();
  Object.keys(s.items).forEach(function (id) {
    const m = new Map();
    rowsOf(s, s.items[id]).forEach(function (x) { m.set(x.key, rowSig(x)); });
    ROWS.set(id, m);
  });
  return s;
}

// AT START: the state read.
function startState() {
  S = loadState();
}

// ── SHEDDING (goal/G33.4) ─────────────────────────────────────────────
//
//   Andy, in the item's box: "The desk database sheds by itself past a boundary size, one constant set in a single place,
//   16 MB. It sheds in whole goal chunks: first the goal untouched the longest, with all its items and every row of
//   theirs (chat, box, checks), since nothing could reach them any more; then the next. The current goal
//   is never shed. Special goals are exempt. Shedding is goal by goal, nothing finer."
//
// THE ONE CONSTANT: SHED_BYTES, 16 MB; the manifest value shedBytes is the knob a suite turns (deskTables.js), as
// boxHoldMs is. The size is the database's own: its pages in use (page_count less the free list) times the page size.
const SHED_BYTES = Number(values.shedBytes) > 0 ? Number(values.shedBytes) : 16 * 1024 * 1024;
function usedBytes() {
  const pc = Number(db.prepare('PRAGMA page_count').get().page_count);
  const fl = Number(db.prepare('PRAGMA freelist_count').get().freelist_count);
  return (pc - fl) * Number(db.prepare('PRAGMA page_size').get().page_size);
}
// When a goal was last touched: the newest write to it or any item of it.
function touchedAt(s, gid) {
  const g = s.goals[gid];
  return [gid].concat(g ? g.members : []).reduce(function (t, id) { const x = s.items[id]; return x && String(x.at || '') > t ? String(x.at || '') : t; }, '');
}
function shed() {
  const s = S;
  const gone = [];
  while (usedBytes() > SHED_BYTES) {
    const open = Object.keys(s.goals).filter(function (gid) { return gid !== s.current && !s.goals[gid].special; });
    if (!open.length) break;
    open.sort(function (a, b) { const x = touchedAt(s, a); const y = touchedAt(s, b); return x < y ? -1 : x > y ? 1 : 0; });
    const gid = open[0];
    const ids = [gid].concat(s.goals[gid].members);
    db.exec('BEGIN');
    try { dropGoalRows(numbersOf(gid)[0]); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); console.error('desk: shedding ' + gid + ' failed: ' + e.message); break; }
    ids.forEach(function (id) { delete s.items[id]; ROWS.delete(id); });
    delete s.goals[gid];
    gone.push(gid);
    // Each row it held leaves every client, as a row does (goal/G33.4).
    ids.forEach(function (id) {
      const k = numbersOf(id);
      publishOne({ change: s.change, verb: 'goal.shed', item: { id: id, goal: id === gid ? '' : gid }, listed: false, key: { goal: k[0], item: k[1] }, removed: true });
    });
  }
  if (gone.length) console.log('desk: shed ' + gone.join(', ') + ' past ' + SHED_BYTES + ' bytes (goal/G33.4)');
  return gone;
}
// AN AGENT ADDS ITEMS ONLY UNDER HIS WORDS (goal/G29.21). Andy, 2026-10-18, decided, in the item's box: Desk lets an
// agent add items only while his newest Desk line holds "add item" (one item) or "add items" (several) in sequence, and
// the grant ends with his next line. Proposing items stays free. What his line grants: -1 several, 1 one, 0 none; and
// only in the goal the line was written in (decided by Andy, 2026-10-19: the items go to THAT goal), kept as
// addGrantGoal.
function addGrantOf(text) {
  if (/\badd\s+items\b/i.test(String(text))) return -1;
  return /\badd\s+item\b/i.test(String(text)) ? 1 : 0;
}
// His "add goal" grants an agent one goal and no items (goal/G29.21, decided by Andy), until his next line.
function goalGrantOf(text) { return /\badd\s+goal\b/i.test(String(text)) ? 1 : 0; }
// How many items a session brings that the desk does not hold yet.
function newItemsOf(s, sess) {
  return (Array.isArray(sess.items) ? sess.items : []).filter(function (x) { const id = String((x && x.id) || ''); return id && !s.items[id]; }).length;
}
// WHOM A LINE IS FOR, BY ITS FIRST WORD (goal/G48.8; Andy: "all desk needs to do is scan for a line starting with a \"word\"
// ... and throw it into a \"to\" field, that your wait can check", "desk doesn't need to know", "agreed, no punctuation."):
// the line's first word, lowercased, whatever follows it, checked against nothing; '' for a line with no word first. Each
// agent's wait asks for its own (to=cw, to=all); a word nobody asks for wakes nobody.
function toOf(text) {
  const m = /^\s*([\p{L}\p{N}]+)/u.exec(String(text || ''));
  return m ? m[1].toLowerCase() : '';
}
// A chat line as it is answered: what a line written before goal/G48.8 kept of takes and addresses stays inside, its
// list of keys in to among them; a line's to of its first word (toOf) is shown.
function shownLine(l) {
  const o = Object.assign({}, l, { key: String(l.key || '') });
  ['taken', 'takenKey', 'answered', 'bound', 'took', 'all', 'name'].forEach(function (k) { delete o[k]; });
  if (typeof o.to !== 'string') delete o.to;
  return o;
}
function blank(id, title, goalId) {
  return { id: id, title: title, goal: !goalId, goalId: goalId || '', status: '', went: false, go: false, done: false,
    closed: false, designComplete: false, alert: false, checkHigh: Object.create(null), box: '', version: 0, checks: [], chat: [], at: '' };
}

// One record applied to the state. A record that no longer fits (an item gone
// from its session) changes nothing; the refusals happen before it is written.
function apply(s, r, b, item, goalOf) {
  const it = b.id ? item(String(b.id)) : null;
  if (it) it.at = r.at;
  switch (r.verb) {
    case 'session.set': {
      const sess = b.session;
      const gid = String(sess.goal.id);
      const fresh = !s.goals[gid];
      // goal/G29.21: an agent's new items spend his "add item" grant.
      if (r.by !== 'andy' && r.by !== 'desk' && s.addGrant > 0 && newItemsOf(s, sess)) s.addGrant = 0;
      const g = s.goals[gid] || (s.goals[gid] = { id: gid, design: true, abandoned: false, members: [] });
      const goalItem = s.items[gid] || (s.items[gid] = blank(gid, '', ''));
      if (!goalItem.made) goalItem.made = madeBy(r);
      goalItem.title = String(sess.goal.title || goalItem.title);
      goalItem.at = r.at;
      const ids = [];
      (sess.items || []).forEach(function (x) {
        const id = String(x.id || '');
        if (!id) return;
        // A NEW ITEM ARRIVES IN DESIGN MODE (goal/G33.4, the box: "A new item always arrives in design mode.").
        if (!s.items[id]) { s.items[id] = blank(id, '', gid); s.items[id].design = true; s.items[id].made = madeBy(r); }
        const one = s.items[id];
        one.title = String(x.title || one.title);
        one.goalId = gid;
        one.at = r.at;
        one.leftOut = false;
        ids.push(id);
      });
      // LEFT OUT IS CLOSED, NEVER DELETED (goal/G4.24). Andy: "1. sounds dumb that the \"archive\" is not
      // searchable.", "if deleted is just a flag in the database, we can just ignore it from now on". An item a new
      // session leaves out stays a member, after the session's own, closed, with its box, checks and chat, so
      // [Include Closed] finds it; the records replay to the same, so items left out before this come back too.
      // NO SUB-GOALS (goal/G33.4, replacing goal/G6.8's split mark). Andy, in the item's box: "No sub-goals and no goal
      // tree: an item never becomes a goal, so two numbers always suffice; the sub-goal mechanism is removed."
      const kept = g.members.filter(function (id) { return ids.indexOf(id) === -1 && s.items[id]; });
      kept.forEach(function (id) { s.items[id].closed = true; s.items[id].leftOut = true; });
      g.members = ids.concat(kept);
      // AN ADD NEVER MOVES THE CURRENT GOAL (goal/G9.13). Andy, 2026-10-09: "An item added to another goal should NOT
      // change a goal.", after cw's add to goal/G8 moved his current goal off goal/G9. So a session that writes into a
      // goal the desk already holds leaves the current goal alone; setting up a goal the desk has never seen still
      // makes it current, as it always did (deskMakeCurrent.js), and his make-current press is the only other way it
      // moves. His decision: do not widen this back so a bulk write lands where its writer expects.
      if (fresh || !s.current || !s.items[s.current]) s.current = gid;
      return;
    }
    case 'box.write':
      // EACH VERSION A ROW (goal/G33.4): the item holds its newest, and who wrote it; persistItem adds the row.
      it.box = String(b.text);
      it.version += 1;
      it.boxBy = String(r.by || ''); it.boxKey = madeBy(r); it.boxAt = String(r.at || '');
      return;
    case 'check.add': {
      const kind = String(b.kind);
      const number = nextCheckNumber(it, kind);
      const c = { number: number, kind: kind, words: String(b.words), test: String(b.test || ''), state: 'open', by: String(b.asked || ''), at: String(b.asked ? r.at : ''), made: madeBy(r) };
      // WHO PLACED A RED Q (goal/G21.2), from the record, so a replay of records written before it knows too: "one
      // open red Q per agent per item", and his clear notifies "the agent that placed it".
      if (kind === 'Q') { c.placedBy = String(r.by); c.placedKey = String(r.key || ''); }
      it.checks.push(c);
      // A QUESTION RAISED BY A CHAT LINE (goal/G2.21) marks that line with this number, so the chat shows which line
      // the red question came from while the line's own text stays exactly as the agent wrote it. Since goal/G21.2 no
      // line raises one; this stays for the records written before, whose open checks stay as they are.
      if (typeof b.forLine === 'number' && it.chat[b.forLine]) it.chat[b.forLine].q = number;
      return;
    }
    case 'check.set': {
      // GRANT-ALL (goal/G32.2): check 'all' grants every open G check of the item in this one record.
      const set = String(b.check) === 'all' && String(b.state) === 'granted'
        ? it.checks.filter(function (x) { return x.kind === 'G' && x.state === 'open'; })
        : it.checks.filter(function (x) { return x.number === String(b.check); }).slice(0, 1);
      set.forEach(function (c) { c.state = String(b.state); c.by = r.by; c.at = r.at; });
      return;
    }
    case 'chat.add': {
      // EVERY LINE CARRIES ITS WRITER'S KEY (goal/G21.1); the label stays for showing where no name is set.
      const line = { by: r.by, at: r.at, text: String(b.text), key: String(r.key || '') };
      const to = toOf(b.text);
      if (to) line.to = to;
      it.chat.push(line);
      // HIS NEWEST LINE GRANTS ITEM ADDS, OR ENDS THE GRANT (goal/G29.21).
      // The item grant holds only for the goal his line is in: under the goal itself or one of its items.
      if (r.by === 'andy') { s.addGrant = addGrantOf(b.text); s.addGrantGoal = it.goal ? it.id : it.goalId; s.goalGrant = goalGrantOf(b.text); }
      return;
    }
    case 'item.rename': it.title = String(b.title); return;
    // A FILE THE AGENT'S CHECKOUT CHANGED (goal/G33.11): a word that is a path is kept as its file name only, and its
    // tone (test or code) holds while the status is still that word; any other write of the status drops it.
    case 'item.status': {
      const word = String(b.word);
      it.status = /[\\/]/.test(word) ? word.split(/[\\/]/).pop() : word;
      it.statusTone = b.tone === 'test' || b.tone === 'code' ? b.tone : '';
      it.toneWord = it.status;
      return;
    }
    // THE GOAL IS EMPTY (goal/G8.12): written once per emptying, by the press that empties it. No run starts from it.
    case 'goal.emptied': {
      const g = s.goals[String(b.id)];
      if (g) g.emptied = true;
      return;
    }
    // THE DESK OWNS THE IDS (goal/G9.9). Andy, 2026-10-07: "the desk owns (is in charge of) goal and item ID's.", and
    // on who uses the verbs: "why should the agents need to, they can use the same api's the user needs to create
    // them." The id is minted at the write and kept in the record as `minted`, so a walk of the records never mints
    // again. Neither add moves the current goal (goal/G9.13).
    case 'goal.add': {
      const gid = String(b.minted || '');
      if (!gid) return;
      if (!s.goals[gid]) s.goals[gid] = { id: gid, design: true, abandoned: false, members: [] };
      const gi = s.items[gid] || (s.items[gid] = blank(gid, '', ''));
      if (!gi.made) gi.made = madeBy(r);
      gi.title = String(b.title || gi.title);
      gi.at = r.at;
      // goal/G29.21: an agent's goal spends his "add goal".
      if (r.by !== 'andy' && r.by !== 'desk' && s.goalGrant > 0) s.goalGrant -= 1;
      return;
    }
    case 'item.add': {
      const gid = String(b.goal || '');
      const id = String(b.minted || '');
      const g = s.goals[gid];
      if (!id || !g) return;
      // A NEW ITEM ARRIVES IN DESIGN MODE (goal/G33.4).
      if (!s.items[id]) { s.items[id] = blank(id, '', gid); s.items[id].design = true; s.items[id].made = madeBy(r); }
      const one = s.items[id];
      one.title = String(b.title || one.title);
      one.goalId = gid;
      // goal/G49: the item it blocks, its goal when none was named.
      one.blocks = [String(b.blocks || gid)];
      one.at = r.at;
      // WHO CREATED IT (goal/G27.10, R2): its creator posts under it at any time; the first add names it.
      if (!one.creator) { one.creator = r.by; one.creatorKey = String(r.key || ''); }
      if (g.members.indexOf(id) === -1) g.members.push(id);
      // goal/G29.21: an agent's add spends one of an "add item" grant.
      if (r.by !== 'andy' && r.by !== 'desk' && s.addGrant > 0) s.addGrant -= 1;
      return;
    }
    // HIS DELETE CLOSES IT AS A LEFT-OUT ONE IS CLOSED (goal/G9.7). Andy, 2026-10-07: "the button bar of items will
    // offer an arm-able [delete] while in design mode.", and on whether it erases: "close is enough. that essentially
    // leaves them as \"musings\" on the record." So the item keeps its box, checks and chat, Include Closed finds it,
    // exactly as goal/G4.24 decided for a session's leavings.
    case 'item.delete': {
      if (!it || it.goal) return;
      it.closed = true;
      it.leftOut = true;
      return;
    }
    case 'press': press(s, it, String(b.what), r, goalOf, b); return;
    default: return;
  }
}

// A CHECK NUMBER IS NEVER LENT TWICE (goal/G19.5). Andy, 2026-10-12, to "Should check numbers never repeat": "yes."
// Numbers were count + 1, so a check raised again after one was removed took the number of the one removed and a press
// meant for one could land on the other. Each item remembers the highest number
// it ever gave, kind by kind, in the walk (so a replay gives the same numbers), and the next is one above it.
function nextCheckNumber(it, kind) {
  let high = it.checkHigh[kind] || 0;
  it.checks.forEach(function (c) { if (c.kind === kind) { const n = Number(String(c.number).slice(kind.length)) || 0; if (n > high) high = n; } });
  it.checkHigh[kind] = high + 1;
  return kind + (high + 1);
}

function press(s, it, what, r, goalOf, b) {
  const g = goalOf(it.id);
  // DESIGN MODE ON GOAL LEVEL AND ON ITEM LEVEL (goal/G33.4). Andy, in the item's box: "Design mode on goal level AND on
  // item level, so further items can be designed while other items of the same goal already go through their
  // implementation phases." Pressed on an item it is that item's alone. Pressed on a goal it is the goal's, and his End
  // design on the goal ends it for every item of the goal as it stands then (this build's reading: the goal's End
  // design is the one he has always pressed); an item added after it arrives in design all the same.
  if (what === 'start-design' && !it.goal) it.design = true;
  else if (what === 'end-design' && !it.goal) it.design = false;
  else if (what === 'start-design' && g) g.design = true;
  else if (what === 'end-design' && g) { g.design = false; g.members.forEach(function (id) { if (s.items[id]) s.items[id].design = false; }); }
  else if (what === 'abandon' && g) g.abandoned = true;
  // MAKE CURRENT (goal/G2.19). Andy, 2026-10-06: "i want to switch between goals at will, so the goals detail should
  // give me re-open and and on any open goal i want a button \"make current goal\"". It moves the goal and nothing
  // else: no item's state, neither goal's design mode, nothing closed or opened.
  else if (what === 'make-current' && it.goal) s.current = it.id;
  else if (what === 'design-complete') { it.designComplete = true; it.status = 'ready'; }
  // HIS GO IS ON RECORD (goal/G3.9): `go` is set by his go and go-all alone and by nothing else; `went` stays the
  // state of the item, which older records set in other ways.
  else if (what === 'go') { it.went = true; it.go = true; it.status = 'running'; }
  else if (what === 'go-all' && g) goable(s, g).forEach(function (m) { m.went = true; m.go = true; m.status = 'running'; });
  else if (what === 'done') it.done = true;
  // REOPEN TAKES BACK DONE AS WELL AS CLOSE (goal/G4.20 point 2). Andy: "agreed: \"Reopen takes back Done as well
  // as Close\"". His Go stays on record.
  else if (what === 'reopen') {
    it.done = false; it.closed = false;
    // REOPEN IS DESIGN AGAIN (goal/G40.3; Andy: "oh, re-open should put an item back to design mode."): it waits for his
    // End design and a fresh Go.
    if (!it.goal) {
      it.design = true; it.go = false; it.went = false;
    }
    // A REOPENED GOAL WAITS AFRESH (goal/G19.2). Its emptied mark survived the reopen, so Done came straight back.
    // Andy, 2026-10-12, to the four fixes that hold back an unearned Done: "yes. with my addendum." It goes here, in the
    // walk, so a replay agrees; with the mark gone the press below writes a new goal.emptied when every item is still
    // done or closed.
    // A REOPENED GOAL IS IN DESIGN AGAIN (goal/G40.12, box v7, first set 7).
    if (it.goal && g) { g.emptied = false; g.design = true; }
  }
  else if (what === 'close') it.closed = true;
  // A BROUGHT-BACK ITEM DRAWS HIS EYE (goal/G2.1 note 6). Andy: "the row should immediately pop back into
  // visibility, with the attention-grabbing error icon, to draw my attention." The alert stands until his seen.
  else if (what === 'bring-back') { it.closed = false; it.alert = true; }
}

// THE GOAL THAT HAS JUST EMPTIED (goal/G8.12): every item of it done, closed or left out, and no goal.emptied on the
// record yet. Called after a press lands, so the state it reads is the state his press produced; it writes one record
// as the desk itself. No run starts from it.
function emptiedByPress(a) {
  const st = walkState();
  const it = st.items[String(a && a.id)];
  if (!it) return false;
  const gid = it.goal ? it.id : it.goalId;
  const g = st.goals[gid];
  if (!g || g.emptied) return false;
  const members = g.members.filter(function (id) { const m = st.items[id]; return m && !m.leftOut; });
  if (!members.length) return false;
  if (!members.every(function (id) { const m = st.items[id]; return m.done || m.closed; })) return false;
  write('goal.emptied', { id: gid, by: 'desk', key: '' });
  return true;
}

// The buttons, decided here once for the List and the dialog alike.
//   Go!    after design ends (Andy's "end design mode."), not yet gone
//   Done   on an item once it has had his Go (goal/G48.8: no phases and no claims, he presses it when he judges it
//          finished); on a goal once it has items (goal/G33.6)
//   Close and Reopen once done
//   Close also on an item before his Go (goal/G3.9; Andy, 2026-10-03: "A close - with arm-button is available ...
//          before an item has received a 'go' or a 'done', so the user can get it off the desk, since close is
//          more of an 'visibility' issue than a process issue"); the List hides it, the dialog arms it
//   Go all on a goal while any of its items offers Go! (desk/G3.4, Andy: "i should
//          have a go-all button for fixing rounds")
//   Reopen alone once closed (goal/G4.20 point 2: Reopen takes back Done as well as Close)
// The List, the dialog and the press read this one list. Delete is the verb item.delete, every other button a press.
function buttons(s, it) {
  const g = s.goals[it.goal ? it.id : it.goalId];
  if (it.closed) return ['reopen'];
  if (it.done) return ['close', 'reopen'];
  const out = [];
  // A GOAL NEVER OFFERS GO! (desk/G3.7): its items are gone, not the goal itself.
  // DONE WAITS ON EVERY GRANT (goal/G8.5). Andy, 2026-10-09: "'Done' needs all grants approved." On every item and
  // goal: while any G check is open, no Done is offered, and his red mark on the row says why.
  const grantsOpen = it.checks.some(function (c) { return c.kind === 'G' && c.state === 'open'; });
  // goal/G33.4: no Go while the item itself is in design, nor while its goal is. An item in its own design while its
  // goal is out of it offers its End design (his alone, as the goal's is), so a new item can be built.
  if (!it.goal && it.design && g && !g.design) out.push('end-design');
  // DESIGN AT ANY TIME (goal/G40.12, box v7, first set 1: "You can turn design on for an item at any time.").
  if (!it.goal && !it.design) out.push('start-design');
  if (!it.goal && g && !g.design && !it.design && !it.went) out.push('go');
  // A GOAL OFFERS DONE AT ANY TIME, AND NEVER ON A CLAIM (goal/G33.6, replacing goal/G2.10's "only when all items are
  // done"). Andy: "just in the list, a goal offers no done or closed while items are not done or closed, the goal
  // offers those only in the detail panel anytime". So the facts offer it; the List holds it back while the goal's
  // blocked (its items still open) is not empty, and the detail panel shows it. The desk keeps no arming.
  if (it.goal) {
    if (!grantsOpen && g && g.members.length > 0) out.push('done');
  } else if (!grantsOpen && it.go === true) out.push('done');
  if (it.goal && g && goable(s, g).length) out.push('go-all');
  if (!it.goal && !it.went) out.push('close');
  // A GOAL OFFERS CLOSE ALWAYS (goal/G5.6), open items or not. Andy, to "a goal gets a Close like an item's (off the
  // List, still searchable, Reopen brings it back)": "yes. if it has items still open it can ask me: are you sure?"
  // The asking is the face's; the press is taken either way, and the items keep their state.
  if (it.goal) out.push('close');
  // MAKE CURRENT (goal/G2.19): on an open goal that is not the current one, so the dialog draws it as it draws every
  // button. Never on an item, which has no List of its own, and never on an abandoned goal, which is invisible. A
  // closed goal returns above with Reopen alone, which is the order his words give: "re-open and ... make current goal".
  // A special goal is never the current goal (goal/G27.2, D6).
  if (it.goal && g && !g.abandoned && !g.special && s.current !== it.id) out.push('make-current');
  // DELETE, IN DESIGN MODE OR OUT OF IT (goal/G24.9; it was design mode only under goal/G9.7). Andy, 2026-10-14: "i have
  // no delete option for this item". So any item that is not a goal offers it whatever the goal's design mode.
  // A closed or done item returned above and offers none. G9.7's ruling stands: delete
  // closes and leaves out, it erases nothing. The dialog draws it from here, and item.delete refuses what is not here.
  if (!it.goal && g) out.push('delete');
  return out;
}
// The items of a goal that offer Go!, decided by the same rule as their own button.
function goable(s, g) {
  return g.members.map(function (id) { return s.items[id]; }).filter(function (m) {
    return m && !m.closed && !m.done && buttons(s, m).indexOf('go') !== -1;
  });
}

function listed(s, it) {
  const g = s.goals[it.goal ? it.id : it.goalId];
  // A closed goal takes its items off the List with it (goal/G5.6); Include Closed still finds them.
  const goalItem = g && !it.goal ? s.items[g.id] : null;
  return !!g && !g.abandoned && !it.closed && !(goalItem && goalItem.closed);
}

// WHAT WAITS ON HIM (goal/G4.20 points 10-11): open grants, open questions, and open checks of his while Done is
// offered. Andy: "if those two things would match at all times, id know exactly where i need to navigate to."
// The List's ICON.ERROR is drawn from this alone.
function asksOf(s, it) {
  const doneOffered = buttons(s, it).indexOf('done') !== -1;
  const open = it.checks.filter(function (c) {
    return c.state === 'open' && (c.kind === 'G' || c.kind === 'Q' || (c.kind === 'C' && doneOffered));
  }).length;
  return open;
}

// AN OPEN RED QUESTION (goal/G6.8). Andy: "i want mechanical tracking of design-greens. Yes i want opens to light up my
// list with ERROR icons." An item is design-green when none is open; his End design and a Go wait for green.
function openQ(it) { return !!it && it.checks.some(function (c) { return c.kind === 'Q' && c.state === 'open'; }); }
// Why an item is not green, or '' when it is.
function redWhy(it) {
  if (openQ(it)) return 'carries an open red question; answer or close it first';
  return '';
}
function notGreen(s, ids) {
  return ids.filter(function (id) { const m = s.items[id]; return m && !m.closed && !m.done && !!redWhy(m); });
}

function facts(s, it) {
  const f = { id: it.id, title: it.title, goal: it.goal ? '' : it.goalId, status: it.closed ? 'closed' : it.done ? 'done' : it.status,
    // goal/G33.11: the kind of file the status names, 'test' or 'code', '' when the status is not a file report.
    statusTone: !it.closed && !it.done && it.statusTone && it.toneWord === it.status ? it.statusTone : '',
    // goal/G33.4 (box v46): the box's version, so a client answers item.get from the facts the push brought.
    version: Number(it.version) || 0, buttons: buttons(s, it),
    // His Go on record (goal/G3.9): true once he pressed go or go-all on it.
    go: it.go === true, alert: it.alert === true,
    // goal/G33.4: design mode on item level, as a goal's row has carried it (a goal's is set below).
    design: it.design === true,
    // DESIGN-GREEN (goal/G6.8): no open red question on it (redWhy).
    green: !redWhy(it),
    // goal/G27.10: who created it, '' for an item from a session or before the creator was recorded.
    creator: it.creator || '' };
  // goal/G49: what an item blocks, the goal or an item of it, as item.add named it; none on a goal, or on an item added
  // before goal/G49.
  if (!it.goal && Array.isArray(it.blocks) && it.blocks.length) f.blocks = it.blocks.slice();
  f.asks = asksOf(s, it);
  if (it.goal) {
    const g = s.goals[it.id];
    f.design = g.design;
    // goal/G33.4: a special goal's row is marked special.
    if (g.special) f.special = true;
    f.waiting = g.members.map(function (id) { return s.items[id]; }).concat([it]).filter(function (o) {
      // goal/G24.9: delete is on offer on running items now, and offering it is not Andy being waited on.
      return o && listed(s, o) && (buttons(s, o).filter(function (b) { return b !== 'delete'; }).length > 0 || asksOf(s, o) > 0);
    }).length;
  }
  return f;
}
const FACTS_ROOM = ANSWER_ROOM - 512;

// The goal first, then its items in session order; the newest goal first.
// WHAT THE LIST'S ROW HOLDS (goal/G43.3; Andy, the box: "the search needs only those fields of a row that it actually
// displays."): what its cells, its presses and its filters read (spirit/app/desk/element/desk/desk.js). A word is still matched against the
// whole row and the chat here, on the server (goal/G41.28); a page merges this into the row it keeps.
const LIST_FIELDS = ['id', 'goal', 'title', 'status', 'statusTone', 'buttons', 'asks', 'alert'];
// A GOAL'S ROW DRAWS MORE: the page reads the waiting count and the design state from it (spirit/app/desk/element/desk/desk.js
// deskWaitingOnAndy, deskDesignOn), and at open this is all it has. These stay even when empty, so a goal's design going
// off clears what the page holds.
const GOAL_FIELDS = ['waiting', 'design'];
function listRow(row) {
  const out = {};
  if (row.goal === '') GOAL_FIELDS.forEach(function (k) { if (row[k] !== undefined) out[k] = row[k]; });
  // An empty value stays out too, so a goal of 25 fits one answer; goal stays, since '' is what says a row is a goal. The
  // page reads each of these as optional, and the stream's rows, always whole, are what clear a value it holds.
  LIST_FIELDS.forEach(function (k) {
    const v = row[k];
    const empty = v === undefined || v === '' || v === false || v === 0 || (Array.isArray(v) && !v.length) || (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
    if (k === 'goal' || !empty) out[k] = v;
  });
  return out;
}
function searchItems(a) {
  const s = walkState();
  const rawText = String(a.text || '').trim();
  const text = rawText.toLowerCase();
  const out = [];
  // THE LATEST STATE AT STARTUP (desk/G3.2, Andy: "and at startup, it should show the
  // latest state"): with the current goal closed, the empty current-goal search shows
  // it and its items as they were left, closed ones included. An open goal still hides
  // its closed items ("Close makes item invisible"); an abandoned one stays invisible.
  const cur = s.current && s.items[s.current];
  const latest = !!(a.currentGoalOnly && !text && cur && cur.closed && s.goals[s.current] && !s.goals[s.current].abandoned);
  // NO SPECIAL GOAL ON THE LIST (goal/G41.2; Andy: "plugin/special goals must never be show in the main list").
  const goals = Object.keys(s.goals).filter(function (gid) { return (!a.currentGoalOnly || gid === s.current) && !s.goals[gid].special; });
  goals.sort(function (x, y) { return x === s.current ? -1 : y === s.current ? 1 : 0; });
  goals.forEach(function (gid) {
    const ids = [gid].concat(a.goalsOnly ? [] : s.goals[gid].members);
    ids.forEach(function (id) {
      const it = s.items[id];
      // [INCLUDE CLOSED] (goal/G4.20 point 1). Andy: "the search should search the database, and return matches, one
      // extra search filter toggle [include closed] would do the trick on my side." An abandoned goal's stay out.
      const closedToo = (latest || a.includeClosed === true) && !s.goals[gid].abandoned;
      if (!it || !(listed(s, it) || closedToo)) return;
      // THE SEARCH READS THE LINES TOO (goal/G4.24 point 2). Andy: "same principle as the agent search, it searches the
      // lines server-side, but only brings back handle/key and title, i'll have to go to details to fetch the rest."
      // The item's row as item.get serves it, and every chat line, case ignored; the answer is that row, never the box or
      // the chat. RANKED, NOT FILTERED (goal/G18.5): every listed item goes in with its probability; the bucket orders them.
      const row = facts(s, it);
      out.push({ probability: itemProbability(rawText, row, it.chat), closed: row.status === 'closed', json: JSON.stringify(listRow(row)) });
    });
  });
  // OPEN ROWS FIRST (goal/G43.3; Andy, the box: "the search filter [include closed] doesn't mean "exclude open ones"!!!!"):
  // equal rows keep this order and an answer is cut when full, so old closed rows no longer push the open ones out.
  return out.filter(function (x) { return !x.closed; }).concat(out.filter(function (x) { return x.closed; }));
}


function refused(code) { const e = new Error(code); e.refusal = code; return e; }
// A REFUSAL SAYS WHY (goal/G10.10). Andy, 2026-10-12: "all refusals everywhere should say why." A bare bad-request
// reached his dialog as "text required", the code's first wording, for an 81-byte title. The reason rides in
// extra.why, as a refused press's does (notOffered below), in words a person can act on.
function refusedWhy(code, why) { const e = refused(code); e.extra = { why: String(why) }; return e; }
// A FIELD RULE'S ANSWER IN WORDS: what was wrong with which field, and its bytes against the limit when it is the size.
function fieldWhy(what, value, paragraph) {
  const fr = spirit.requireScript('spirit/fieldRules.js');
  const p = paragraph ? fr.paragraphProblem(value) : fr.problem(value);
  if (!p) return '';
  const max = paragraph ? fr.PARAGRAPH_MAX_BYTES : fr.MAX_BYTES;
  const bytes = fr.byteLength(paragraph ? fr.normalizeParagraph(value) : fr.normalize(value));
  return what + ': ' + p + (bytes > max ? ' (' + bytes + ' bytes, the limit is ' + max + ')' : '');
}
// A REFUSED PRESS NAMES WHAT BLOCKS IT (goal/G9.17, change 3). Andy, 2026-10-09, on "Not pressed: not-offered (that
// press is not offered for this item now)": "and it doesn't tell me why either." The code stays not-offered; the
// reason rides in extra.why, as line-too-large carries its bytes and its room.
function notOffered(why) { const e = refused('not-offered'); e.extra = { why: String(why) }; return e; }
function whyNotOffered(st, it, what, offered) {
  const g = st.goals[it.goal ? it.id : it.goalId];
  if (what === 'go' || what === 'go-all') {
    if (g && g.design) return 'the goal ' + g.id + ' is in design mode; End design comes first';
    if (it.design) return it.id + ' is in design mode; End design on it comes first';
    if (it.went) return 'Go is already on record for ' + it.id;
  }
  if (what === 'make-current' && it.closed) return it.id + ' is closed; Reopen comes first';
  return what + ' is not among the buttons of ' + it.id + ' now (' + (offered.length ? offered.join(', ') : 'none') + ')';
}

// Every write: checked against the state as it stands, applied, written through to exactly the rows it changed, then
// published, each changed row on its own ("no pulling"). goal/G33.4, in the item's box: "Mirror distribution is push:
// the desk pushes each changed sub-element of a goal or item (a row of a side table) separately, each under
// PAYLOAD_MAX, so a desk client never grabs anything." Every row fits one publish: the box, the one row that could
// grow, is refused past one answer (box.write, box v31), so no row is ever pushed in pieces.
// What a write publishes, every object with this write's change number:
//   { change, verb, item: <facts>|null, listed, key: {goal, item} }   the written item's facts (its List row), always
//   the same for every other row of the goal whose facts this write changed, one publish each
//   { change, table, goal, item, id, row }                            each side row it changed: chat (the line as
//                                                                     item.chat gives it), box (the newest version),
//                                                                     checks (one check)
//   { change, table, goal, item, id, removed: true, at }              a side row it removed
// A goal that becomes current is pushed whole (pushGoalWhole).
// One object onto the desk's stream, as it is: THE ONE PUBLISH (box v43, Andy: "the desk server publishes its changes
// to the browser with the same function that it publishes its changes to the deskClients"). appServer.publish hands it to
// the node's pages and to every subscriber (goal/G33.8); the desk has no second send path.
function publishOne(o) {
  return appServer.publish(o);
}

// ── THE DESK ONLY PUBLISHES (goal/G33.8, box v8) ──────────────────────
//
//   Andy: "What this replaces goes: the desk naming its own recipients (opts.streamTo.recipients, from the agents it
//   knows) and deskClient being wired to the desk by hand at setDesk. A client subscribes; the desk only publishes."
//
// appServer's streamPublisher (spirit/server/app.js, opts.publisher) keeps the subscribers: a deskClient subscribes as family
// deskClient, the node's grants deciding who may; every publish goes to each of them, a line his to some agents to those
// alone (the row's to, goal/G21.1). A new subscriber is handed the desk's bootstrap set: the current goal's row and its
// items' rows, their facts alone; everything published afterwards has a home in its data set
// (box v8: "for the desk that may be no more than the bare goal row"). The desk never acts as a client of its clients
// and keeps nothing from them; it follows no stream itself (box v42).
const CLIENT_WAIT_MS = 10000;
function deskBootstrap() {
  if (!S || !S.current || !S.goals[S.current]) return [];
  const ids = [S.current].concat(S.goals[S.current].members).filter(function (id) { return !!S.items[id]; });
  // goal/G41.12: one row each; appServer bundles what it hands. The current selection first (goal/G49.8, currentRow).
  return [currentRow(S)].concat(ids.map(function (id) { return rowPublish(S, id, 'goal.whole', S.change); }));
}
// An item's facts as a List row publish.
function rowPublish(s, id, verb, change) {
  const it = s.items[id];
  const k = numbersOf(id);
  const o = { change: change, verb: verb, item: it ? facts(s, it) : null, listed: it ? listed(s, it) : false, key: { goal: k ? k[0] : -1, item: k ? k[1] : -1 } };
  if (inSpecialGoal(s, k)) o.special = true;
  return o;
}
// A ROW OF A SPECIAL GOAL (goal/G33.11): its rows say so, so a deskClient takes what happens there as news, beside the
// current goal's. Goal 0 is never one.
function inSpecialGoal(s, k) {
  if (!k || !k[0]) return false;
  const g = s.goals[idOf(k[0], 0)];
  return !!g && g.special === true;
}
function sidePublish(s, id, ch, change) {
  const k = numbersOf(id);
  const o = { change: change, table: ch.table, goal: k[0], item: k[1], id: id };
  if (inSpecialGoal(s, k)) o.special = true;
  if (ch.removed) { o.removed = true; o.at = ch.key.split('|').slice(1).join('|'); } else o.row = ch.x.out();
  // A CHAT ROW SAYS WHOM ITS LINE IS FOR (goal/G48.8, toOf): its first word, on the row itself, which an agent's wait
  // asks for (to=cw, to=all). The app server reads none of it.
  if (o.row && o.table === 'chat' && typeof o.row.to === 'string') o.to = o.row.to;
  return o;
}
// A GOAL BECOMING CURRENT IS PUSHED (goal/G33.4). Andy, in the item's box: "when a goal becomes current, the desk pushes
// it whole onto every desk client; from then on it pushes only that goal's updates." Since box v46 that is the goal's and
// its items' facts, one publish each, and no part of an item. Andy: "getting it all at once, hmmm sounds like a bad idea,
// maybe a new deskClient connect should start a stream-push of the goal, and the items, the box and other parts will come
// when needed and stay". An item's box, chat, checks and files are each read by the client that needs them, each its own
// answer under the payload, and kept current by the side rows every write pushes. Also at start, the current goal: every
// client was away from a desk that was not there.
// THE CURRENT SELECTION, ONE ROW OF THE DESK'S STATE (goal/G49.8, box v4; Andy: "the \"current\" selection is just another
// streamed item, that part of the apps (desks) state....that's all."): {current, change}, published as the current goal
// changes and handed with the bootstrap, so a client's cache, keeping its newest, always names the current goal and a page in
// client mode draws its List from the cache alone.
function currentRow(s) { return { current: String(s.current || ''), change: s.change }; }
function pushGoalWhole(gid) {
  const s = S;
  const g = s.goals[gid];
  if (!g) return;
  publishOne(currentRow(s));
  [gid].concat(g.members).filter(function (id) { return !!s.items[id]; })
    .forEach(function (id) { publishOne(rowPublish(s, id, 'goal.whole', s.change)); });
}
// THE ROWS A WRITE MAY CHANGE: its goal's (the written item's, or the session's goal).
function goalIds(s, gid) { const g = s.goals[gid]; return g ? [gid].concat(g.members) : []; }
function write(verb, a, check) {
  const s = walkState();
  const it = a.id !== undefined ? s.items[String(a.id)] : null;
  if (a.id !== undefined && verb !== 'session.set' && !it) throw refused('no-such-item');
  if (check) check(s, it);
  const body = Object.assign({}, a);
  delete body.by;
  delete body.key;
  const by = String(a.by || '');
  const key = String(a.key || '');
  const sessGoal = verb === 'session.set' && body.session && body.session.goal ? String(body.session.goal.id) : '';
  // The row the write names: its item, the session's goal, or what goal.add and item.add minted (set by their check).
  const writtenId = it ? it.id : sessGoal || String(body.minted || '');
  const gidW = it ? (it.goal ? it.id : it.goalId) : sessGoal || (verb === 'item.add' ? String(body.goal || '') : verb === 'goal.add' ? String(body.minted || '') : '');
  // The goals whose List rows may change: the written one's.
  const shownGoals = [gidW].filter(function (g) { return !!g; });
  const seen = function (id) { const x = s.items[id]; return x ? JSON.stringify([facts(s, x), listed(s, x)]) : ''; };
  const before = Object.create(null);
  shownGoals.forEach(function (g) { goalIds(s, g).forEach(function (id) { before[id] = seen(id); }); });
  const currentBefore = s.current;
  s.change += 1;
  const r = { n: s.change, at: new Date().toISOString(), verb: verb, by: by, key: key };
  const item = function (id) { return s.items[id] || null; };
  const goalOf = function (id) { const x = item(id); return x ? (x.goal ? s.goals[x.id] : s.goals[x.goalId]) : null; };
  apply(s, r, body, item, goalOf);
  // KEPT ONLY IF IT CAN COME BACK (the oversize suite; Andy: "why can't the system cleanly reject oversized stuff?").
  // Every panel it touched is measured as the answer that would carry it; one that no longer fits is refused by name,
  // and the state is read again from the tables, which the write never reached.
  const touched = sessGoal ? [sessGoal].concat((body.session.items || []).map(function (x) { return String(x.id || ''); })) : writtenId ? [writtenId] : [];
  try {
    touched.forEach(function (id) {
      const bytes = largestPanel(s, id);
      if (bytes > ANSWER_ROOM) throw tooLarge(bytes, ANSWER_ROOM);
    });
  } catch (e) { S = loadState(); throw e; }
  // WRITTEN THROUGH, in one transaction: every row of the goal's items that changed, and the desk's own.
  const dirty = goalIds(s, gidW);
  const side = [];
  db.exec('BEGIN');
  try {
    dirty.forEach(function (id) {
      const x = s.items[id];
      if (!x) return;
      persistItem(s, x, r, id === writtenId, body).forEach(function (ch) { if (ch.table !== 'items') side.push(sidePublish(s, id, ch, r.n)); });
    });
    persistDeskState(s);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    S = loadState();
    throw e;
  }
  // THE CHANGE ITSELF TRAVELS (desk/G2.7, "no pulling"), one row at a time (goal/G33.4): the written item's facts and
  // whether it is still on the List, always; then every other row whose facts changed (desk/G3.10: a press changes more
  // than its own row), each its own publish; then each side row it changed.
  const now = writtenId ? s.items[writtenId] || null : null;
  const out = rowPublish(s, now ? now.id : '', verb, r.n);
  if (!now) { out.item = null; delete out.listed; delete out.key; }
  // WHICH PRESS IT WAS (goal/G41.2), so a client wakes its agent on his Go, his End design, a new current goal.
  if (verb === 'press') out.what = String(body.what || '');
  // WHO WROTE IT (goal/G33.9, box v4): every row a write publishes names its writer, label and key, so a client tells a
  // change its own agent made from one made by Andy, another agent or the desk.
  const byWriter = function (o) { o.by = String(r.by || ''); o.byKey = String(r.key || ''); return o; };
  publishOne(byWriter(out));
  shownGoals.forEach(function (g) {
    goalIds(s, g).forEach(function (id) {
      if (now && id === now.id) return;
      if (s.items[id] && seen(id) !== before[id]) publishOne(byWriter(rowPublish(s, id, verb, r.n)));
    });
  });
  side.forEach(function (o) { publishOne(byWriter(o)); });
  // A GOAL BECOMING CURRENT IS PUSHED WHOLE (goal/G33.4).
  if (s.current && s.current !== currentBefore) pushGoalWhole(s.current);
  shed();
  return s;
}

// HIS VOICE IS NOT WRITTEN HERE (goal/G2.1 note 8): no voice file of what he typed; the brain reads his Desk lines
// through this server's api. No app writes into the vault.

// A goal is open while it is on the List. With none open, start-design (no id) makes goal/G<n>, n the next free.
function newGoal(w) {
  const st = walkState();
  // A special goal is no goal of his work: it never holds a new goal back.
  const open = Object.keys(st.goals).some(function (gid) { const g = st.items[gid]; return g && !st.goals[gid].special && listed(st, g) && !g.closed; });
  if (open) throw refusedWhy('bad-request', 'a goal is open already; close it before a new one starts');
  const id = nextGoalId(st);
  return write('session.set', { session: { goal: { id: id, title: 'New goal' }, items: [] }, by: w.by, key: w.key });
}

const PRESSES = ['go', 'go-all', 'done', 'reopen', 'close', 'bring-back', 'abandon', 'start-design', 'end-design', 'design-complete', 'make-current'];
// Andy's alone (G2.1 review). His presses carry the owner's caller (the
// mark the door forwards, apiAuth/G1.13); a member's are refused. The
// agents keep design-complete and bring-back.
const OWNER_PRESSES = ['go', 'go-all', 'done', 'reopen', 'close', 'abandon', 'start-design', 'end-design', 'make-current'];
function ownerOnly(caller) { if (!caller || caller.owner !== true) throw refused('not-owner'); }

// THE NEXT ID THE DESK HANDS OUT (goal/G9.9), minted inside the write, from the state the write walked.
// An item: one past the highest item number of its goal, closed and left-out ones counted, so an id is never handed
// out twice.
// SINCE goal/G33.4 A GOAL IS A NUMBER: one past the highest goal number the desk holds, special goals counted (Andy, in
// the box: a special goal's number is "minted like any goal").
function nextGoalId(s) {
  let top = 0;
  Object.keys(s.goals).forEach(function (id) { const k = numbersOf(id); if (k) top = Math.max(top, k[0]); });
  return idOf(top + 1, 0);
}
function nextItemId(s, gid) {
  // goal/G33.4: the goal's own items (closed and left-out ones are members too), its number and one past the highest.
  const k = numbersOf(gid);
  let top = 0;
  ((s.goals[gid] || {}).members || []).forEach(function (id) { const x = numbersOf(id); if (x && k && x[0] === k[0]) top = Math.max(top, x[1]); });
  return idOf(k ? k[0] : 0, top + 1);
}

// WHO WRITES (apiAuth/G1.13): the caller appServer hands the handler,
// never an argument — Andy: "yes. the label will only be used for
// labeling in chat, and for referencing members, internally desk server
// will use keys for tracking." The owner shows as andy; a member shows
// its label, the key's tail when the door knew no name; a write with no
// caller has no writer and is refused.
function writerOf(caller) {
  if (!caller || typeof caller !== 'object') throw refusedWhy('bad-request', 'the write came with no caller, so it has no writer');
  if (caller.owner === true) return { by: 'andy', key: String(caller.key || '') };
  if (typeof caller.key !== 'string' || !caller.key) throw refusedWhy('bad-request', 'the caller carries no key, so it has no writer');
  const label = String(caller.label || '').trim();
  // A caller with no name is written by its key whole: no key's tail is shown anywhere (Andy, 2026-10-24, goal/G40.1).
  return { by: label || caller.key, key: caller.key };
}

// HIS LINES ARE NOT JOINED TO A PHASE HOLDER'S ANSWERS (goal/G33.7). Andy: "why? my lines are
// streamed to deskClient without any further assistance", and "the desk should answer what it was asked. period.
// don't get fancy, it always backfires." Every verb answers what it was asked; his lines reach the agent on the stream.

// AT START (goal/G33.4): the state read from its tables, the database shed to its size; the
// current goal is pushed whole once the desk serves (below).
startState();
shed();

appServer.serve({
  // NO log.add, log.search, pending.get OR changes (goal/G33.4; Andy: "log.add, log.search and pending.get: delete
  // them.", and of changes: "isn't that what this item does? implement the push/broadcast concept?"): the desk streams
  // each changed row to its subscribers (appServer.publish), and nothing is read back by a cursor.
  // ── WHAT THE LIST AND THE DIALOG READ (desk/G2.1) ─────────────────
  // Andy: "nice verb names! can use them an many seaches. aprooved."
  // Each label is one item's facts as JSON; the goal's row also carries
  // design mode, the waiting-on-you count and the live agents.
  'items.search': tableSearch({
    request: { currentGoalOnly: false, goalsOnly: false, includeClosed: false },
    rows: function (a) { return searchItems(a).map(function (x) { return { key: JSON.parse(x.json).id, label: x.json, probability: x.probability }; }); },
  }),
  // EACH PANEL ITS OWN ANSWER. Andy: "what kind of app doesn't measure the sum of its packets?" and "lazy load the
  // panels when thy open". item.get is the item's facts; its box, checks and chat are asked for each on its own, so
  // no answer carries the sum of them and each fits one answer by itself.
  // No items.find (goal/G33.7, the approved verb list: "agents only; items.search covers it").
  'item.get': {
    request: { id: '' }, reply: { item: '', version: 0, change: 0 },
    handler: function (a) {
      const s = walkState();
      const it = s.items[String(a.id)];
      if (!it) throw refused('no-such-item');
      return { item: JSON.stringify(facts(s, it)), version: it.version, change: s.change };
    },
  },
  'item.box': {
    request: { id: '' }, reply: { box: '', version: 0 },
    handler: function (a) {
      const it = walkState().items[String(a.id)];
      if (!it) throw refused('no-such-item');
      return { box: it.box, version: it.version };
    },
  },
  // goal/G33.7 (the approved list: "item.checks (more flag)"): the panel's checks in their order, as many as fill one
  // answer, and checksMore when some were left out. Kept by Andy's word on goal/G48.8 Q8 ("whatever you want"): the one read
  // the details dialog loads an item's red Qs and grants with.
  'item.checks': {
    request: { id: '' }, reply: { checks: [{ number: '', kind: '', words: '', test: '', state: '', by: '', at: '' }], checksMore: false },
    handler: function (a) {
      const it = walkState().items[String(a.id)];
      if (!it) throw refused('no-such-item');
      const shown = shownChecks(it);
      const room = ANSWER_ROOM - Buffer.byteLength(JSON.stringify({ checksMore: true }), 'utf8');
      const found = walked(shown.map(function (c, i) { return i; }), function (i) { return { key: String(i), label: JSON.stringify(shown[i]) }; }, room);
      const checks = found.items.map(function (p) { return JSON.parse(p.label); });
      return { checks: checks, checksMore: checks.length < shown.length };
    },
  },
  // THE CHAT IS A SEARCH (desk/G3.3). Andy: "why would the server not use bucket to give me the most recent
  // stuff?" Its newest lines, through the same bucket, in a whole answer of its own; oldest first.
  'item.chat': {
    // goal/G21.1: each line carries its writer's key beside its label (by).
    request: { id: '' }, reply: { chat: [{ by: '', at: '', text: '', key: '' }], chatMore: false },
    handler: function (a) {
      const st = walkState();
      let it = st.items[String(a.id)];
      if (!it) throw refused('no-such-item');
      it = { chat: it.chat.map(shownLine) };
      // goal/G29.21: newest first through walked() in CHAT_ROOM; a line too big for the room on its own is never
      // offered: it would close the answer with nothing in it (claude-windows's review).
      const newest = [];
      for (let i = it.chat.length - 1; i >= 0; i--) newest.push(i);
      const found = walked(newest, function (i) { return { key: String(i), label: JSON.stringify(it.chat[i]) }; }, CHAT_ROOM);
      const chat = found.items.map(function (p) { return JSON.parse(p.label); }).reverse();
      return { chat: chat, chatMore: chat.length < it.chat.length };
    },
  },
  // A SEARCH ON AN ITEM'S CHAT LINES (goal/G3.11), for the agents. Andy: "with time boundaries etc.... just for you
  // agents", then "why dont you generalize the search so you can do it to the chat lines for any item in desk?" — so
  // id names the item.
  // The filters are the four he asked wsl-claude to name: text (found in the line, whatever the case), by (who
  // wrote it), since (from that time on), before (earlier than that time); one left empty filters nothing.
  // The newest lines that match, through the same bucket, in half an answer (SEARCH_ROOM). NOTHING PAGES AND
  // NOTHING IS JOINED: more says there were more, and the agent narrows (before = the oldest time it got).
  // A read: it writes no record.
  // goal/G29.21: scope '' or 'goal' searches the id's own chat; 'items' on a goal searches the goal's chat and every
  // one of its items' chats, ranked together. Each line's label carries item, the id it was said in, which the goal
  // dialog draws as a link to that item; across chats the key is item#index, so keys stay unique.
  'chat.search': tableSearch({
    // since and before are UTC times, milliseconds since 1970, 0 for no limit (goal/G48.4, Q5, Andy: "times are fucking
    // numbers ... spirit.type.number.UTC"); a line's own time stays as the desk writes it, read as a time to compare.
    request: { id: '', by: '', since: 0, before: 0, scope: '' },
    room: SEARCH_ROOM,
    rows: function (a, st) {
      const id = String(a.id);
      const it = st.items[id];
      if (!it) throw refused('no-such-item');
      const scope = String(a.scope || '');
      if (scope && scope !== 'goal' && scope !== 'items') throw refusedWhy('bad-request', 'scope is goal, items or empty');
      const g = st.goals[id];
      const chats = [id].concat(scope === 'items' && g ? (g.members || []).filter(function (m) { return m !== id && st.items[m]; }) : []);
      const across = chats.length > 1;
      // SINCE goal/G18.5 THE TEXT RANKS THE LINES (probabilityStringMatch), the filters still filter; newest first
      // among equals.
      const text = String(a.text || '').trim();
      const lines = [];
      chats.forEach(function (c) {
        const chat = st.items[c].chat;
        for (let i = chat.length - 1; i >= 0; i--) {
          const l = chat[i];
          if (a.by && l.by !== a.by) continue;
          if (a.since && !(Date.parse(l.at) >= a.since)) continue;
          if (a.before && !(Date.parse(l.at) < a.before)) continue;
          lines.push({ item: c, i: i, l: l });
        }
      });
      if (across) lines.sort(function (x, y) { return x.l.at < y.l.at ? 1 : x.l.at > y.l.at ? -1 : 0; });
      // goal/G21.1: the writer's key rides with its label; with a scope, the item it was said in too.
      return lines.map(function (x) {
        const l = x.l;
        const label = { by: l.by, key: String(l.key || ''), at: l.at, text: l.text };
        if (scope) label.item = x.item;
        return { key: across ? x.item + '#' + x.i : String(x.i), label: label, probability: lineProbability(text, l) };
      });
    },
  }),
  // ── THE WRITES: no verb takes `by` any more (apiAuth/G1.13) — the
  // writer is the caller the door forwarded and appServer handed in,
  // so nobody names their own writer. A by argument fails the request
  // shape and is refused no-such-argument, which is the point.
  // NO session.set VERB (goal/G33.7, the approved verb list: "writes a whole goal at once; its callers use goal.add and
  // item.add"); only start-design with nothing open writes one inside the desk (newGoal). A goal is made by goal.add,
  // its items by item.add (a split: item.add blocking the parent), one each.
  // ONE GOAL, ONE ITEM, AND THE DESK NAMES IT (goal/G9.9). Andy, 2026-10-07: "the desk owns (is in charge of) goal and
  // item ID's.", and "why should the agents need to, they can use the same api's the user needs to create them." So the
  // same two verbs serve him and the agents, the id comes back in the answer, and nobody sends one: an `id` argument is
  // refused by the door as no-such-argument. Decided by Andy.
  // An add never moves the current goal (goal/G9.13).
  'goal.add': {
    request: { title: '' }, reply: { id: '', change: 0 },
    handler: function (a, caller) {
      const w = writerOf(caller);
      const title = String(a.title || '').trim();
      if (!title) throw refusedWhy('bad-request', 'a goal needs a title');
      const args = { title: title, by: w.by, key: w.key };
      const r = write('goal.add', args, function (st) {
        // goal/G29.21, decided by Andy: an agent creates a goal only under his "add goal": one goal, no items.
        if (w.by !== 'andy' && !(st.goalGrant > 0)) throw refusedWhy('not-granted', 'an agent creates a goal only while Andy\'s newest line says "add goal"; propose it to him instead');
        args.minted = nextGoalId(st);
      });
      return { id: args.minted, change: r.change };
    },
  },
  // WHAT IT BLOCKS, NAMED (goal/G9.10). Andy, 2026-10-07: "When the user presses the [add-button], The desk will add a
  // blocking item with the entered title and a blank text box." So item.add takes one more argument, optional: the id
  // the new item blocks, the goal itself or an item of that goal, and the goal when it is left out (goal/G9.9's case).
  // The title obeys the label rules, as every label does (spirit/fieldRules.js).
  // WHAT IT BLOCKS (goal/G49; Andy: "put the plunger back with one rowForm: ➕ \"Add blocking item\" [title-input]
  // [Add-button], which will add an item with <Title> blocking the goal/item it was created from."): blocks, left out or
  // '', is its goal; else an item of that goal, kept on the new item as its blocks. Nothing else of the G48.8 cut's
  // blocks comes back: no block, unblock or block.targets.
  'item.add': {
    request: { goal: '', title: '', blocks: '' }, reply: { id: '', change: 0 },
    accepts: function (x) {
      if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
      return Object.keys(x).every(function (k) { return k === 'goal' || k === 'title' || k === 'blocks'; }) &&
        typeof x.goal === 'string' && typeof x.title === 'string' && (x.blocks === undefined || typeof x.blocks === 'string');
    },
    handler: function (a, caller) {
      const w = writerOf(caller);
      const gid = String(a.goal || '');
      const title = String(a.title || '').trim();
      if (!title) throw refusedWhy('bad-request', 'an item needs a title');
      if (fieldWhy('title', title)) throw refusedWhy('bad-request', fieldWhy('title', title));
      const args = { goal: gid, title: title, by: w.by, key: w.key };
      if (a.blocks !== undefined && String(a.blocks) && String(a.blocks) !== gid) args.blocks = String(a.blocks);
      const r = write('item.add', args, function (st) {
        if (!st.goals[gid] || !st.items[gid]) throw refused('no-such-item');
        // An item of its own goal: an item never blocks across goals.
        if (args.blocks && !(st.items[args.blocks] && st.items[args.blocks].goalId === gid)) throw refusedWhy('no-such-item', args.blocks + ' is no item of ' + gid);
        // AN AGENT ADDS UNDER HIS WORDS (goal/G29.21), decided by Andy: see addGrantOf.
        if (w.by !== 'andy' && !(st.addGrant && st.addGrantGoal === gid)) throw refusedWhy('not-granted', 'an agent adds an item only while Andy\'s newest line, written in this goal, says "add item" (one) or "add items" (several); propose it to him instead');
        args.minted = nextItemId(st, gid);
      });
      return { id: args.minted, change: r.change };
    },
  },
  // Andy: "the FIRST text wins, all subsequent actions are alterations and
  // corrections." An alteration names the version it was written against and
  // is refused if the box has moved on, so nothing is silently overwritten.
  'box.write': {
    request: { id: '', text: '', version: 0 }, reply: { change: 0, version: 0 },
    handler: function (a, caller) {
      const w = writerOf(caller);
      // A BOX STAYS UNDER THE PAYLOAD (goal/G33.4, the box v31: a larger box write is refused, so a box is always read
      // and pushed in one piece; Andy: "Why would you let box past MAX_PAYLOAD?????"). Its bound is the one answer
      // item.box carries it back in, which is under PAYLOAD_MAX, so its pushed row is too. Counted in bytes, never
      // characters; the refusal says its bytes and the limit, and to split the item (box v33, Andy: "if the items is to big
      // for a fucking box NOW, then motherfucking split it."). No row of the desk travels in pieces.
      const boxBytes = Buffer.byteLength(JSON.stringify({ box: String(a.text), version: 0 }), 'utf8');
      if (boxBytes > ANSWER_ROOM) {
        const e = tooLarge(boxBytes, ANSWER_ROOM);
        e.extra.why = 'the box is ' + boxBytes + ' bytes, the limit is ' + ANSWER_ROOM + ': split the item into items';
        throw e;
      }
      // AN OPEN POINT IS A RED QUESTION, NEVER BOX TEXT (goal/G6.8). Andy: "in design mode as well, OPEN is help in
      // red-questions". A line starting with OPEN in capitals is refused, his own too.
      if (/^OPEN(?:\b|:)/m.test(String(a.text))) throw refusedWhy('bad-request', 'a line starting OPEN is not box text: an open point is a Q check');
      const s = write('box.write', Object.assign({}, a, { by: w.by, key: w.key }), function (st, it) {
        if (a.version !== it.version) throw refused('box-moved');
      });
      return { change: s.change, version: s.items[a.id].version };
    },
  },
  'check.add': {
    request: { id: '', kind: '', words: '', test: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      const w = writerOf(caller);
      // G (a grant) and Q (a question) are the waiting list (goal/G4.20 points 10-11), beside C and T.
      if (['C', 'T', 'G', 'Q'].indexOf(a.kind) === -1) throw refusedWhy('bad-request', 'a check is C, T, G or Q');
      // A RED Q IS PLACED ON PURPOSE (goal/G21.2). Andy, in the item's box: "A red Q is a concise question placed with
      // deliberation, to block an item until it is resolved." One sentence within Q_MAX_BYTES (qWhy), and "One open
      // red Q per agent per item: a second is refused until the first is answered or cleared." Decided by Andy.
      if (a.kind === 'Q' && qWhy(a.words)) throw refusedWhy('bad-request', qWhy(a.words));
      return { change: write('check.add', Object.assign({}, a, { by: w.by, key: w.key }), function (st, it) {
        if (a.kind !== 'Q') return;
        const mine = it.checks.filter(function (c) {
          return c.kind === 'Q' && c.state === 'open' && (w.key ? placerOf(st, c) === w.key : c.placedBy === w.by);
        })[0];
        if (mine) throw refusedWhy('bad-request', 'one open red Q per agent per item: ' + mine.number + ' of yours is still open on ' + it.id + '; it must be answered or cleared first');
      }).change };
    },
  },
  'check.set': {
    request: { id: '', check: '', state: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      const w = writerOf(caller);
      if (['open', 'passed', 'failed', 'granted', 'answered'].indexOf(a.state) === -1) throw refusedWhy('bad-request', 'a check is open, passed, failed, granted or answered');
      // A GRANT IS HIS ALONE (goal/G4.20 points 10-11). Andy: "the Grants are red arm-buttons that turn green and are
      // logged, and questions are red-text that disappears when you feel i answered usefully." So granted is his,
      // answered the agent's; each fits only its own kind.
      if (a.state === 'granted') ownerOnly(caller);
      return { change: write('check.set', Object.assign({}, a, { by: w.by, key: w.key }), function (st, it) {
        // GRANT-ALL (goal/G32.2). Andy, 2026-10-22: "gimme a Grant-All, too". His alone, as every grant is.
        if (a.check === 'all') {
          if (a.state !== 'granted') throw refusedWhy('bad-request', 'check all is for granted only');
          if (!it.checks.some(function (x) { return x.kind === 'G' && x.state === 'open'; })) throw refusedWhy('bad-request', 'no open grant on ' + it.id);
          return;
        }
        const c = it.checks.filter(function (x) { return x.number === a.check; })[0];
        if (!c) throw refused('no-row');
        if ((a.state === 'granted' && c.kind !== 'G') || (a.state === 'answered' && c.kind !== 'Q')) throw refusedWhy('bad-request', a.check + ' is a ' + c.kind + ' check: ' + a.state + ' is for ' + (a.state === 'granted' ? 'a G' : 'a Q') + ' check');
      }).change };
    },
  },
  'chat.add': {
    request: { id: '', text: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      const w = writerOf(caller);
      // MAX_PAYLOAD AT THE DOOR (desk/G3.3). Andy: "in the db yes, but in the sent messages ther MUST be a MAX_PAYLOAD".
      // A line that could not come back whole in one answer is refused here; the sender slices it.
      const st0 = walkState();
      const it0 = st0.items[String(a.id)];
      // Measured as it is stored and answered, with the key it is answered with (goal/G21.1), else the largest line
      // that passes here would not come back whole (oversize.js caught the ten bytes).
      const bytes = chatLineBytes(it0 ? it0.chat.length : 0, { by: w.by, at: new Date().toISOString(), text: String(a.text), key: w.key, to: toOf(a.text) });
      if (bytes > CHAT_ROOM) throw tooLarge(bytes, CHAT_ROOM);
      // HIS CLEAR OF RED QS (goal/G21.2, clearOf): which open Qs it names, refused with a why when it names none.
      const clear = caller.owner === true && it0 ? clearOf(a.text) : null;
      const cleared = clear ? it0.checks.filter(function (c) { return c.kind === 'Q' && c.state === 'open' && (!clear.number || c.number === clear.number); }) : [];
      if (clear && !cleared.length) throw refusedWhy('bad-request', clear.number ? clear.number + ' is not an open red Q on ' + a.id : 'there is no open red Q on ' + a.id + ' to clear');
      const after = write('chat.add', Object.assign({}, a, { by: w.by, key: w.key }));
      // Andy, in the item's box: "Andy clears them himself", and "When Andy clears a Q, the agent that placed it is
      // notified; a clear is a form of reply, so the agent updates its position on that question." So each Q goes to
      // cleared (it holds nothing any more and leaves the panel) by a record of his. Decided by Andy, not by this file:
      // an agent's own "Q:clear" clears nothing.
      cleared.forEach(function (c) { write('check.set', { id: a.id, check: c.number, state: 'cleared', by: w.by, key: w.key }); });
      // A QUESTION MARK IN CHAT RAISES NOTHING (goal/G21.2), ending goal/G2.21's conversion of an agent's line that
      // ended in one. Andy, in the item's box: "A question mark in a chat line never makes a red Q; only a deliberate Q
      // check does." Decided by Andy: do not bring the conversion back. Open checks it raised before stay as they are.
      return { change: after.change };
    },
  },
  // "rename (you)": Andy's alone.
  'item.rename': { request: { id: '', title: '' }, reply: { change: 0 }, handler: function (a, caller) { ownerOnly(caller); const w = writerOf(caller); return { change: write('item.rename', Object.assign({}, a, { by: w.by, key: w.key })).change }; } },
  // HIS DELETE (goal/G9.7, widened by goal/G24.9): his alone, never a goal, in design mode or out of it. It is offered in the item's buttons, so the refusal and the button cannot drift
  // apart.
  // A VERB AND NOT A PRESS, BY HIS WORD. Asked which, Andy answered "press." on 2026-10-09 and then, on the same
  // question: "make it a verb, plus the arm able delete button." The later word is the one in force. Do not turn it
  // back into a press without asking him again.
  'item.delete': {
    request: { id: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      ownerOnly(caller);
      const w = writerOf(caller);
      return { change: write('item.delete', Object.assign({}, a, { by: w.by, key: w.key }), function (st, it) {
        if (buttons(st, it).indexOf('delete') === -1) throw refused('not-offered');
      }).change };
    },
  },
  // tone (goal/G33.11), optional: 'test' or 'code' when the word is a file the agent's checkout changed (its deskClient).
  'item.status': {
    request: { id: '', word: '', tone: '' }, reply: { change: 0 },
    accepts: function (x) {
      if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
      return Object.keys(x).every(function (k) { return ['id', 'word', 'tone'].indexOf(k) !== -1; }) &&
        typeof x.id === 'string' && typeof x.word === 'string' && (x.tone === undefined || x.tone === '' || x.tone === 'test' || x.tone === 'code');
    },
    handler: function (a, caller) { const w = writerOf(caller); return { change: write('item.status', Object.assign({}, a, { by: w.by, key: w.key })).change }; } },
  // Presses are records, not lines (Andy: "a press shouldn't post a line, it
  // is not textual information"). Go!, Close and Reopen only when offered;
  // done also by Andy alone ("completions ... can be forced by the user"),
  // marked alone.
  'press': {
    request: { id: '', what: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      if (PRESSES.indexOf(a.what) === -1) throw refusedWhy('bad-request', 'no press is called ' + JSON.stringify(String(a.what)));
      if (OWNER_PRESSES.indexOf(a.what) !== -1) ownerOnly(caller);
      const w = writerOf(caller);
      // START DESIGN WITH NOTHING OPEN STARTS A NEW GOAL (desk/G3.1). Andy: "start design mode should start a new
      // project if nothing is in the list". It arrives in design mode; he names it.
      if (a.what === 'start-design' && a.id === '') return { change: newGoal(w).change };
      const body = Object.assign({}, a, { by: w.by, key: w.key });
      const landed = write('press', body, pressCheck(a));
      // THE PRESS THAT EMPTIES THE GOAL WRITES IT (goal/G8.12), once, right after it has landed. His Done posts no line
      // under the item (goal/G33.11).
      emptiedByPress(a);
      return { change: landed.change };
    },
  },
},

// ── THE DESK'S OWN REFUSALS (goal/G16.11) ───────────────────────────
//
// Andy, 2026-10-11: "yes. get the bloody app error codes out of the core."
// They are declared here, beside the verbs that raise them, not in the
// shared register the node and the relay load; appServer puts "desk: " in
// front of each text, so the origin of a refusal is plain and no other app
// can wear this name.
// goal/G33.8: the desk publishes (opts.publisher: each subscriber handed deskBootstrap first), and no opts.stream: the
// desk follows no stream (box v42). It names no subscriber's branch (goal/G47.5; Andy: "so desk hard-codes the deskClient
// app as listener? how can that be if it is the appServer.js that does the publishing???"): each subscriber names its
// own, and appServer keeps it (clientListeners.json).
{ publisher: { bootstrap: function () { return deskBootstrap(); }, waitMs: CLIENT_WAIT_MS }, codes: {
  // An alteration written against a box version that has moved on (desk/G2.1).
  'box-moved': { status: 409, text: 'the box has changed since that version' },
  'not-offered': { status: 409, text: 'that press is not offered for this item now' },
  'no-such-item': { status: 404, text: 'no such item' },
} });

// THE PRESS'S CHECKS (goal/G19.13): what the press handler refuses, as a write() check.
function pressCheck(a) {
  return function (st, it) {
    const offered = buttons(st, it);
    // goal/G2.19 puts make-current on the same leash: offered or refused, so a closed goal takes Reopen first.
    // Every refusal below names what blocked it (goal/G9.17, change 3), the code staying not-offered.
    if ((a.what === 'go' || a.what === 'go-all' || a.what === 'close' || a.what === 'reopen' || a.what === 'make-current') && offered.indexOf(a.what) === -1) throw notOffered(whyNotOffered(st, it, a.what, offered));
    if (a.what === 'bring-back' && !it.closed) throw notOffered(it.id + ' is not closed, so there is nothing to bring back');
    // DESIGN-GREEN GATES THEM (goal/G6.8): his End design while any item of the goal has an open red question, a Go
    // on an item with one, a go-all while any item of the goal has one: refused.
    const gOf = st.goals[it.goal ? it.id : it.goalId];
    const members = gOf ? gOf.members : [];
    // goal/G33.4: an item's own End design waits for its own green alone.
    const red = a.what === 'end-design' && !it.goal ? notGreen(st, [it.id])
      : (a.what === 'end-design' || a.what === 'go-all') ? notGreen(st, members.concat(it.goal ? [it.id] : [])) : [];
    // Each one named with its own why (redWhy).
    if (red.length) throw notOffered(red.map(function (id) { return id + ' ' + redWhy(st.items[id]); }).join('; '));
    if (a.what === 'go' && redWhy(it)) throw notOffered(it.id + ' ' + redWhy(it));
  };
}

// THE CURRENT GOAL, WHOLE, ONCE THE DESK SERVES (goal/G33.4). Andy, in the item's box: "a client that was away gets the
// current goal pushed whole again"; after this desk's own start every client is one that was away from it.
if (S.current) setImmediate(function () { pushGoalWhole(S.current); });
