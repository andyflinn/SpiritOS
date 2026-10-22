'use strict';

// spirit/run/process/js/desk/desk.js
// THE DESK SERVER — desk/G1.3.
//
//   Andy, 2026-09-29: "i might want a process that serves the data through
//   desk.db", and, on where its state lives, "appServer states ARE a subset
//   of the nodes state" and "any appServer state is none of git's business".
//
// DECIDED in Desk (desk/G1), not this file's to undo:
//   D5  its state is relay-state/process/desk/: desk.db, never in git (his
//       voice file lived there too until goal/G2.1). The node names that folder and hands it over as
//       --state, beside --pipe; this process never works it out itself, so
//       a test hands it a temp folder and the live record is never touched.
//   D4  the local shell reaches it by its verbs (desk.<verb>) on the loopback door, a known
//       member by an 'api' packet; both end in appClient.ask.
//   D12 no reply carries 'ok': that key is an error's (appServer.js).
//
// Free-form documents (the state, what Andy has seen, a log line) travel
// as JSON text: the helper matches keys exactly (appPair D8), so an open
// object could never match its prototype. A log line's searchable columns
// are copied out of its text; the text itself is kept whole.
//
// NEVER A LIST (Andy: every list is a search). log.search answers what
// matches, ranked, newest first among equals, cut to fit one answer by the
// probability bucket, and says so with more.

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const appServer = require('../../../js/appServer.js');
const spiritObject = require('../../../face/spirit.js');
const appClient = require('../../../js/appClient.js');

const argv = process.argv;
const at = argv.indexOf('--state');
const STATE = at !== -1 ? argv[at + 1] : '';
// THE MANIFEST'S VALUES, as the node hands them (jobs.js: one JSON object, name -> value, as the first argument).
let values = {};
try { values = JSON.parse(argv[2] || '{}') || {}; } catch (e) { values = {}; }
// THE CURRENT GOAL IN THE REPO (goal/G3.14). Andy, 2026-10-03: "The desk server will produce a file
// \"spirit/run/process/js/desk/currentGoal.json\" it will contain the complete data set of the current goal, including
// the commit-level agains which the file was generated. the file re-generation is triggered by 'Go' and 'Done
// events' and the data includes items not visible to the user.", "it's the truth scoped by commit level." The path
// SINCE goal/G4.21 THE DESK SHARES IT ITSELF, and never writes into the checkout again (Andy: "i generally only read
// the repo. i think we should make this automatic? agree?", "do it", "yes, that's the shape."). goalRepo is the repo to
// share into (default: the checkout holding this file), goalPath the file's path in it; with neither (a server spawned
// with {}, as every suite spawns one) nothing is shared, so no test pushes anywhere.
const GOAL_SHARED = !!(values.goalRepo || values.goalPath);
const GOAL_PATH = String(values.goalPath || 'spirit/run/process/js/desk/currentGoal.json');
const GOAL_REPO = values.goalRepo ? path.resolve(String(values.goalRepo)) : (function () {
  for (let d = __dirname; ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, '.git'))) return d;
    if (path.dirname(d) === d) return '';
  }
}());
// THE ONE MINUTE OF A BOX HOLD (goal/G21.1). Andy, in the item's box: "the hold ends when the write lands or after one
// minute." The manifest value boxHoldMs is the clock a suite injects (deskBindingNick.js); left out, one minute.
const BOX_HOLD_MS = Number(values.boxHoldMs) > 0 ? Number(values.boxHoldMs) : 60000;
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
db.exec(
  'CREATE TABLE IF NOT EXISTS lines (key TEXT PRIMARY KEY, at TEXT, todo TEXT, sender TEXT, kind TEXT, body TEXT, line TEXT NOT NULL);' +
  'CREATE INDEX IF NOT EXISTS lines_at ON lines (at);' +
  'CREATE INDEX IF NOT EXISTS lines_todo_at ON lines (todo, at);' +
  'CREATE TABLE IF NOT EXISTS docs (name TEXT PRIMARY KEY, json TEXT NOT NULL);'
);
const addLine = db.prepare('INSERT OR IGNORE INTO lines (key, at, todo, sender, kind, body, line) VALUES (?, ?, ?, ?, ?, ?, ?)');
// kind and before joined with desk/G1.4, so Desk reads what it shows and no
// more: a todo of '-' means lines under no todo (an agent's direct chat).
const findLines = db.prepare(
  "SELECT key, line FROM lines WHERE (? = '' OR todo = ?) AND (? = '' OR kind = ?) AND (? = '' OR at >= ?) AND (? = '' OR at < ?)" +
  " AND (? = '' OR body LIKE '%' || ? || '%') ORDER BY at DESC, key DESC"
);
const getDoc = db.prepare('SELECT json FROM docs WHERE name = ?');
const putDoc = db.prepare('INSERT INTO docs (name, json) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET json = excluded.json');

// One answer must travel back as one packet (appClient.ANSWER_MAX); the
// wrapper around the lines is small, and this leaves it room.
const ANSWER_ROOM = appClient.ANSWER_MAX - 512;

// ── ONE MEASURE OF "FITS" (slim/G1.2) ───────────────────────────────
//
//   Andy: "Desk must adhere to standards as well.", and
//   "from now on the MAX_PAYLOAD applies".
//
// A line fits when an answer holding it alone fits the room, measured as
// one answer is measured ({items: [{key, label}], more}). The
// split at start, log.add's refusal and the searches' skip all use this one
// test: a line the bucket could not send first would stop a read with
// nothing in it, the stall found on Andy's desk.db (182 such lines).
function oneAnswerBytes(key, line) {
  return Buffer.byteLength(JSON.stringify({ items: [{ key: String(key), label: String(line) }], more: false }), 'utf8');
}
function fitsOneAnswer(key, line) { return oneAnswerBytes(key, line) <= ANSWER_ROOM; }
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
// Who placed a Q, by key: the record's key, else (a record from before keys) the key its label wrote with.
function placerOf(s, c) { return c.placedKey || (c.placedBy && s.agentKey[c.placedBy]) || ''; }
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
  // A Q he cleared (goal/G21.2) leaves the panel as an answered one does.
  return (it.checks || []).filter(function (c) { return c.state !== 'answered' && c.state !== 'cleared'; });
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

// ── THE LINES TOO BIG FOR ONE ANSWER, SPLIT ONCE (slim/G1.2 T3) ──────
//
//   Andy: "the 182 too-big lines already stored get split once, so their
//   history shows again, but from now on the MAX_PAYLOAD applies."
//
// Each becomes parts keyed <key>#1, <key>#2 ..., the same line but for its
// key, its at (a millisecond apart, the last keeping the old one) and a run
// of its text, each fitting one answer; the text is cut on
// whole characters (never inside a surrogate pair), so the parts joined in
// order are the old text. One transaction per line; the old line goes only
// with its parts in. Nothing new can be too big (log.add refuses it), so a
// later start finds nothing to do.
function splitTooLarge() {
  const big = [];
  for (const row of db.prepare('SELECT key, line FROM lines').iterate()) {
    if (!fitsOneAnswer(row.key, row.line)) big.push(row.key);
  }
  if (!big.length) return;
  const getLine = db.prepare('SELECT line FROM lines WHERE key = ?');
  const dropLine = db.prepare('DELETE FROM lines WHERE key = ?');
  let parts = 0;
  big.forEach(function (key) {
    let m;
    try { m = parsed(getLine.get(key).line); } catch (e) { console.error('desk: ' + key + ' does not parse; left as it is'); return; }
    const chars = Array.from(String(m.text || ''));
    const pieces = [];
    let at = 0;
    while (at < chars.length) {
      // As many characters as fit, found by halving: escaping makes a
      // character cost one to six bytes, so no count is right for every text.
      let lo = 1;
      let hi = chars.length - at;
      const n = pieces.length + 1;
      const fits = function (count) {
        const part = Object.assign({}, m, { key: key + '#' + n, text: chars.slice(at, at + count).join('') });
        return fitsOneAnswer(part.key, JSON.stringify(part));
      };
      if (!fits(1)) { pieces.length = 0; break; }
      while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (fits(mid)) lo = mid; else hi = mid - 1; }
      pieces.push(chars.slice(at, at + lo).join(''));
      at += lo;
    }
    if (!pieces.length) { console.error('desk: ' + key + ' cannot be split to fit; left as it is'); return; }
    db.exec('BEGIN');
    try {
      // Each part a millisecond before the next, the last at the old time:
      // parts sharing one at could not be paged (before cuts by at).
      const when = Date.parse(m.at);
      pieces.forEach(function (text, i) {
        const at = isNaN(when) ? m.at : new Date(when - (pieces.length - 1 - i)).toISOString();
        const part = Object.assign({}, m, { key: key + '#' + (i + 1), at: at, text: text });
        addLine.run(part.key, String(part.at || ''), String(part.todo || ''), String(part.from || ''), String(part.kind || ''), text, JSON.stringify(part));
      });
      dropLine.run(key);
      db.exec('COMMIT');
      parts += pieces.length;
    } catch (e) {
      db.exec('ROLLBACK');
      console.error('desk: splitting ' + key + ' failed, left as it is: ' + e.message);
    }
  });
  console.log('desk: split ' + big.length + ' lines too big for one answer into ' + parts + ' parts');
}
splitTooLarge();

function parsed(json) {
  const v = JSON.parse(String(json));
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('not a JSON object');
  return v;
}
// ── WHAT WAITS ON WHOM (desk/G1.5, D1) ─────────────────────────────
//
//   Andy: "ah, it can visualize job-queues for agents and me. yes."
//
// Worked out from the log alone: the newest session gives the items, the
// lines under each what happened to it, in time order. The rules are the
// contract in spirit/test/deskPending.js. Who took what (the tests writer,
// the builder) is not in the log, so those waits come with take, next goal.
// A claim is read as Desk reads it (desk.js DESK_READY_CLAIM): a note that
// opens with READY TO CLOSE, from two different agents before his done.
// counts (Andy: "so i get a done button and the two of you haven't even
// both tested it yet?").
const READY_CLAIM = /^(?:[\w.-]+[,:]\s*)?(?:[\w.\/-]+\s+is\s+)?READY TO CLOSE\b/;
const allLines = db.prepare('SELECT line FROM lines ORDER BY at, key');

function pending(who) {
  let session = null;
  const agents = Object.create(null);
  const items = Object.create(null);
  const of = function (id) {
    return items[id] || (items[id] = { asked: false, went: false, claims: {}, ready: {}, done: false, last: '' });
  };
  for (const row of allLines.iterate()) {
    let m;
    try { m = JSON.parse(row.line); } catch (e) { continue; }
    const text = String(m.text || '');
    if (m.dir === 'in' && m.from && m.from !== 'andy') agents[m.from] = true;
    if (m.dir === 'in' && m.kind === 'session') {
      try { const s = JSON.parse(text); if (s && Array.isArray(s.items)) session = s; } catch (e) { /* not a session */ }
      continue;
    }
    if (!m.todo) continue;
    const it = of(m.todo);
    it.last = String(m.at || it.last);
    if (m.dir === 'in' && m.kind === 'ask') it.asked = true;
    if (m.dir === 'in' && READY_CLAIM.test(text)) { it.ready[m.from] = true; if (it.went) it.claims[m.from] = true; }
    if (m.dir !== 'out' || m.kind !== 'answer') continue;
    if (text === 'go.' || text === 'no.') it.asked = false;
    if (text === 'go.') { it.went = true; it.claims = {}; }
    if (text === 'done.' && Object.keys(it.ready).length >= 2) it.done = true;
    if (text === 'closed.') it.done = true;
    if (text === 'reopen.') { it.done = false; it.ready = {}; it.claims = {}; }
  }
  if (!session) return [];
  const waits = [];
  // THE GOAL IS AN ITEM TOO (desk/G1.5 T5): claimed by both, it waits on
  // his done like any row.
  const goal = session.goal && session.goal.id ? [{ id: session.goal.id, title: session.goal.title, done: session.goal.done }] : [];
  session.items.concat(goal).forEach(function (s) {
    const id = String(s.id || '');
    const it = of(id);
    if (!id || s.done || it.done) return;
    let why = '';
    if (who === 'andy') {
      why = Object.keys(it.ready).length >= 2 ? 'done' : it.asked ? 'go' : s.open ? 'answer' : '';
    } else if (agents[who] && it.went && !it.claims[who] && Object.keys(it.ready).length < 2) {
      why = 'claim';
    }
    if (why) waits.push({ at: it.last, item: JSON.stringify({ id: id, title: String(s.title || ''), why: why }) });
  });
  return waits.sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : 0; }).map(function (w) { return w.item; });
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
// Until this the desk's searches graded nothing: a substring filter, then the graded bucket in the walk's order. With no
// text every probability is 0 and the bucket keeps the walk's order, so the List reads as it did.
const probabilityStringMatch = require('../../../js/probabilityStringMatch.js').probabilityStringMatch;
const probabilityStringObjectMatch = require('../../../js/probabilityStringObjectMatch.js').probabilityStringObjectMatch;
const createProbabilityBucket = require('../../../js/probabilityBucket.js').createProbabilityBucket;
const MAX_SCANNED_ITEMS = 1000;
function lineProbability(text, line) { return text ? probabilityStringMatch(text, String(line.text)) : 0; }
function itemProbability(text, it, lines) {
  if (!text) return 0;
  const fields = probabilityStringObjectMatch(text, { id: String(it.id), title: String(it.title || ''), box: String(it.box || '') });
  const chat = lines.length ? lines.reduce(function (n, l) { return n + lineProbability(text, l); }, 0) / lines.length : 0;
  return 0.5 * fields + 0.5 * chat;
}
// The walk offers {probability, pair} in its own order, newest or session first; the bucket seats them, an equal
// probability behind those already in, so that order stands among equals. One pair too big for the room alone is
// skipped and said by more, as walked() does; past MAX_SCANNED_ITEMS the walk stops, and that is said by more too.
function ranked(walk, room) {
  const bucket = createProbabilityBucket(MAX_SCANNED_ITEMS);
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

// ── THE STATE: RECORDS IN TIME ORDER (desk/G2.1) ─────────────────────
//
//   Andy: "The server determines all the content to be drawn. buttons, the
//   text in the one text box, the status of items, the title of items etc."
//
// Every write is one row of `records`, numbered in the order it arrived; that
// number is the change number. The state is those rows walked in order, and
// nothing else: the old `lines` stay as they are and feed no item (Andy: "the
// new Server will not give deprecated items to agents either").
db.exec('CREATE TABLE IF NOT EXISTS records (n INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, verb TEXT NOT NULL, by TEXT NOT NULL, body TEXT NOT NULL);');
// THE WRITER'S KEY, BESIDE THE NAME (apiAuth/G1.13). Andy: "internally
// desk server will use keys for tracking" — the label is for showing and
// a relabel must never orphan who wrote what. Older files lack the
// column; rows written before it carry ''.
if (!db.prepare('PRAGMA table_info(records)').all().some(function (c) { return c.name === 'key'; })) {
  db.exec("ALTER TABLE records ADD COLUMN key TEXT NOT NULL DEFAULT ''");
}
const addRecord = db.prepare('INSERT INTO records (at, verb, by, key, body) VALUES (?, ?, ?, ?, ?)');

// ── THE RULES, A TABLE OF THEIR OWN (goal/G5.5) ─────────────────────
//
//   Andy: "rules remain static and apply to all items. ... so rules don't worry about items, items need to worry
//   about rules.", and on keeping the old texts: "might be a good idea to have a history of legal standards, it's a
//   form of proof, too." So no goal's replay touches them: every version is a row of `rules`, never overwritten,
//   the newest row per key is the rule and the older ones its history; his draft between versions is one row per
//   rule in `rule_drafts`, which writes no history. A rule's chat lines are records ('rule.chat'), so the changes
//   carry them to the agents; walkState passes them by.
db.exec('CREATE TABLE IF NOT EXISTS rules (n INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL, at TEXT NOT NULL, by TEXT NOT NULL, type TEXT NOT NULL, label TEXT NOT NULL, status TEXT NOT NULL, text TEXT NOT NULL);' +
  'CREATE TABLE IF NOT EXISTS rule_drafts (key TEXT PRIMARY KEY, at TEXT NOT NULL, text TEXT NOT NULL);');
const RULE_TYPES = ['ui', 'code', 'design', 'desk'];
const RULE_STATUSES = ['proposed', 'active', 'deleted'];
const addRuleRow = db.prepare('INSERT INTO rules (key, at, by, type, label, status, text) VALUES (?, ?, ?, ?, ?, ?, ?)');
const ruleCount = db.prepare('SELECT COUNT(DISTINCT key) AS c FROM rules');
const newestRule = db.prepare('SELECT n, key, at, by, type, label, status, text FROM rules WHERE key = ? ORDER BY n DESC LIMIT 1');
const newestRules = db.prepare('SELECT n, key, at, by, type, label, status, text FROM rules WHERE n IN (SELECT MAX(n) FROM rules GROUP BY key) ORDER BY n DESC');
const ruleRows = db.prepare('SELECT n, key, at, by, type, label, status, text FROM rules WHERE key = ? ORDER BY n DESC');
const getDraft = db.prepare('SELECT text FROM rule_drafts WHERE key = ?');
const putDraft = db.prepare('INSERT INTO rule_drafts (key, at, text) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET at = excluded.at, text = excluded.text');
const ruleChatRows = db.prepare("SELECT at, by, key, body FROM records WHERE verb = 'rule.chat' ORDER BY n");

// EVERY RULE CHANGE IS PUSHED, BOTH WAYS (goal/G5.8). Andy: "then lets have deskServer push active rules upon every
// rule-change.", and to a repo file, an ear line, or both: "both". The active rules, grouped by type, are written to
// rules.md in this server's state and shared into the repo as currentGoal.json is; one line by desk in the group chat
// names the rule, so every agent's ear hears it.
const RULES_STATE_FILE = path.join(STATE, 'rules.md');
const RULES_PATH = 'spirit/run/process/js/desk/rules.md';
function rulesChanged(key, what) {
  const active = newestRules.all().filter(function (r) { return r.status === 'active'; });
  const text = ['# Desk rules, active (written by the desk server on every rule change, goal/G5.8)', ''].concat(
    RULE_TYPES.map(function (type) {
      const mine = active.filter(function (r) { return r.type === type; });
      return mine.length ? ['## ' + type, ''].concat(mine.map(function (r) { return '### ' + r.key + ' (version ' + r.n + '): ' + r.label + '\n\n' + r.text + '\n'; })).join('\n') : '';
    }).filter(Boolean)).join('\n') + '\n';
  try { fs.writeFileSync(RULES_STATE_FILE, text); } catch (e) { console.error('desk: the rules file was not written: ' + ((e && e.message) || e)); }
  if (GOAL_SHARED && GOAL_REPO) shareFile(RULES_PATH, RULES_STATE_FILE, 'rules.md, shared by the desk (goal/G5.8)');
  try { write('chat.add', { id: GROUP_CHAT, text: 'rule ' + key + ' ' + what + '; the active rules are in ' + RULES_PATH, by: 'desk', key: '' }); } catch (e) { /* no group chat yet */ }
}
const allRecords = db.prepare('SELECT n, at, verb, by, key, body FROM records ORDER BY n');

// An agent counts as live for ten minutes after its last write (Andy: "fine.").
const LIVE_MS = 10 * 60 * 1000;

// ── THE GROUP CHAT'S ANCHOR (goal/G3.10) ─────────────────────────────
//
//   Andy, 2026-10-02: "This looks like a perfect team chat. Is it because it has a coal/item to anchor it?",
//   then "when deskServer Starts up, it makes sure there is a closed goal with the id 'desk/G0.0', instead of
//   the team-chat box, the 'all' tab displays the chat box for 'desk/G0.0'", and of its box: "the description
//   box for that chat are the 6 rules i stated a while back. the chat there may change those rules over time."
//
// A goal the server holds from its start, as its own state: no record makes it, so a session (which would make
// it the current goal) never does, and a fresh desk has it. It is closed, so it is on no List, offers no button
// and is not an open goal; and it stays closed. Its chat and its box are an item's like any other: the lines
// and writes are records, replayed onto it at every walk.
const GROUP_CHAT = 'desk/G0.0';

// ── THE MOUNTED PLUGINS, AND THE GOALS THEY GOVERN (goal/G22.3) ──────
//
//   Andy, 2026-10-13, in the item's box: "A gg plugin is a goal-governance plugin: for its type of goal it is the first
//   to handle every desk event, and the mechanical controls it implements live there, not in desk.js.", "desk scans its
//   plugin folder and mounts every plugin it finds", and "On its first mount the plugin gets its own private goal with a
//   fixed key, and from then on that goal and the plugin live hand in hand".
//
// Filled by mountPlugins() before the desk serves, in mount order: { name, goal, refuses, handles, verbs }. The goal's
// key is fixed: plugin/<name>. A goal of a plugin is a pluggable goal/G0 (his words: "a special goal that is always open
// while actually closed"): the desk holds it like any goal, and its plugin decides what may happen to it.
const PLUGINS = [];
const PLUGIN_GOAL = Object.create(null);
// ITS TAB UNDER APPS (goal/G22.3). Andy, 2026-10-13, in the item's box: a main desk tab Apps whose inner tabs are the
// special goals, each plugin's private UI its inner tab. Named by the tab field of its .json, short (Stacks), else its
// label, else its name; keyed by its goal, as PLUGIN_GOAL is.
const PLUGIN_TAB = Object.create(null);
function pluginGoalKey(name) { return 'plugin/' + name; }
// Whether an id is a plugin's goal or one of its items, by the id alone: an item's id is minted <goal>.<n> (nextItemId),
// and a plugin refuses a session over its goal, so nothing else lands under that prefix. No walk of the records.
function inGoalOf(goal, id) { const s = String(id || ''); return s === goal || s.indexOf(goal + '.') === 0; }

function walkState() {
  // agentWord: each agent's last word about itself, listening or working (goal/G2.3); the ear says it, every time.
  // agentKey: the key each agent last wrote with (goal/G2.2 note 6), so the goal row can name its live agents' keys.
  const s = { change: 0, goals: Object.create(null), items: Object.create(null), agentsAt: Object.create(null), agentWord: Object.create(null), agentKey: Object.create(null), profiles: Object.create(null), current: '' };
  s.goals[GROUP_CHAT] = { id: GROUP_CHAT, design: false, abandoned: false, members: [] };
  s.items[GROUP_CHAT] = blank(GROUP_CHAT, 'Group chat', '');
  s.items[GROUP_CHAT].closed = true;
  const item = function (id) { return s.items[id] || null; };
  const goalOf = function (id) { const it = item(id); return it ? (it.goal ? s.goals[it.id] : s.goals[it.goalId]) : null; };
  for (const r of allRecords.iterate()) {
    s.change = r.n;
    let b = {};
    try { b = JSON.parse(r.body); } catch (e) { continue; }
    // Writers other than him and the desk itself are agents, and a write is their liveness.
    if (r.by !== 'andy' && r.by !== 'desk') { s.agentsAt[r.by] = r.at; if (r.key) s.agentKey[r.by] = String(r.key); }
    apply(s, r, b, item, goalOf);
  }
  // A BOX HOLD RUNS OUT (goal/G21.1): a hold his nick request or a cap take started is over after its minute, written
  // or not, so the box is anybody's again.
  const now = Date.now();
  Object.keys(s.items).forEach(function (id) {
    const it = s.items[id];
    if (it.boxHoldUntil && now >= it.boxHoldUntil) { it.boxTakenBy = ''; it.boxTakenKey = ''; it.boxHoldUntil = 0; }
  });
  return s;
}

// ── NAMES AND KEYS (goal/G21.1) ──────────────────────────────────────
//
//   Andy, in the item's box: "The page shows the agent's name everywhere it shows the agent ... The name is looked up
//   by the agent's key; the node's label is shown only when no name is set. Keys are never shown on the page.", and
//   "every decision about who goes by key: take, nick address, block, the one box write."
// The profile is his, by key (profile.set); a profile never set reads included and cap on.
function profileOf(s, key) {
  const p = key ? s.profiles[String(key)] : null;
  return { name: p ? p.name : '', nick: p ? p.nick : '', included: !p || p.included !== false, cap: !p || p.cap !== false };
}
function nameOfKey(s, key) { return profileOf(s, key).name; }
// The label an agent writes with, by its key ('' for a key never heard from).
function labelOfKey(s, key) {
  return Object.keys(s.agentKey).filter(function (l) { return s.agentKey[l] === String(key); }).pop() || '';
}
// Every label given, mapped to its name where its key has one: the page shows the name and falls back to the label.
function namesFor(s, labels) {
  const out = {};
  labels.forEach(function (l) {
    if (!l || out[l]) return;
    const name = nameOfKey(s, s.agentKey[l]);
    if (name) out[l] = name;
  });
  return out;
}
// NOT INCLUDED (goal/G21.1). Andy: "Off: the agent still reads everything, every write of it is refused, and its bubble
// shows absent. It is the desk's own signoff and overrules the agent's own connect (deskAgent cannot bring an
// excluded agent back)." So the refusal is here, by key, at every write, whatever the agent's node does.
function excludedKey(s, key) { return !!key && !profileOf(s, key).included; }
function mayWrite(s, w) {
  if (w.by === 'andy' || w.by === 'desk' || !excludedKey(s, w.key)) return;
  throw refusedWhy('not-included', w.by + ' is not included at the desk: Andy turned it off in its pane, so it reads but writes nothing');
}
// WHO HOLDS IT, BY KEY: a take or hold recorded with a key is that key's; one recorded before keys, its label's.
function holdsBox(it, w) { return it.boxTakenKey ? it.boxTakenKey === w.key : it.boxTakenBy === w.by; }
// TAKES ARE PER LINE (goal/G21.6). Andy's decision, in the item's box: line.take takes the newest of his lines under the
// item that is addressed to the taking agent or to nobody and not yet taken, and taking it lets the agent answer it once,
// even when he has written to someone else below it. So each of his lines carries its own take (taken, takenKey) and
// whether its taker has answered it (answered); several agents hold open takes on different lines of one item at once.
// A take is OPEN from the take until its agent's next post under the item. There is no take of the item as a whole.
function tookLine(l, w) { return !!l.taken && (l.takenKey ? l.takenKey === w.key : l.taken === w.by); }
function openTakes(it) { return it.chat.filter(function (l) { return l.by === 'andy' && l.taken && !l.answered; }); }
function holdsTake(it, w) { return openTakes(it).some(function (l) { return tookLine(l, w); }); }
// THE LINE A TAKE LANDS ON (goal/G21.6): the newest of his lines not taken and addressed to the agent or to nobody. A
// line carrying a to list is addressed to exactly those keys (his nick line, his cap to the agents with cap on), even
// an empty one; only a line with no to list is addressed to nobody (goal/G21.1). The handler and the replay both call
// this, so a replayed take lands where it landed.
function takeableLine(it, key) {
  for (let i = it.chat.length - 1; i >= 0; i--) {
    const l = it.chat[i];
    if (l.by !== 'andy' || l.taken) continue;
    if (Array.isArray(l.to) && l.to.indexOf(key) === -1) continue;
    return l;
  }
  return null;
}
// goal/G21.4: the item it is with, and the phase it holds, by key where the record carried one.
function holdsWith(it, w) { return !!it.with && (it.withKey ? it.withKey === w.key : it.with === w.by); }
function holdsPhase(it, w) { return !!it.phaseWith && (it.phaseWithKey ? it.phaseWithKey === w.key : it.phaseWith === w.by); }

// ONE TASK AT A TIME (goal/G21.4). Andy, in the item's box: "An agent holds one task, one item and one phase, at a time;
// taking a second is refused by the desk until the first is released, claimed or done. Seen: an agent holding two reds
// blocked another agent from working." What the agent holds: every item it is with (item.take) or whose phase it holds
// (phase.take) that is still on his List (listed: not done, not closed, its goal neither closed nor abandoned) and that
// it has not claimed. So what frees it: item.release, phase.done, its own claim (claim-done, or the claim of a build),
// his done or close, his exclusion of it, and verify.reject / verify.regress, which take with away themselves.
// Decided by Andy, not by this file: do not let an agent hold a second task again.
function heldBy(s, w) {
  return Object.keys(s.items).filter(function (id) {
    const m = s.items[id];
    if (!m || m.goal || m.done || m.closed || m.leftOut || !listed(s, m) || m.claims[w.by]) return false;
    return holdsWith(m, w) || holdsPhase(m, w);
  });
}
// A goal's row is no task (this build's reading: the box speaks of items and phases): taking it is never refused here
// and never counts as held, so an agent with an item still takes its goal's row to post in the goal's chat.
function oneTask(s, w, id) {
  if (s.items[String(id)] && s.items[String(id)].goal) return;
  const other = heldBy(s, w).filter(function (x) { return x !== String(id); })[0];
  if (!other) return;
  const m = s.items[other];
  const what = holdsPhase(m, w) ? 'the ' + (m.phase || 'phase') + ' phase of ' + other : other;
  throw refusedWhy('one-task', w.by + ' holds ' + what + ': one task at a time; release it (item.release), claim it or finish its phase first');
}
// HIS EXCLUSION RELEASES WHAT THE AGENT HOLDS (goal/G21.4). Andy, in the item's box: "Excluding an agent releases what
// it holds: its task and phase are free for another agent to take." In the walk, at his profile.set, so a replay agrees:
// the item it is with, the phase it holds, the take of his line it has not answered yet, its box hold and its share of
// an offered cap.
function releaseKey(s, key) {
  const mine = function (label, labelKey) { return !!label && (labelKey ? labelKey === key : s.agentKey[label] === key); };
  Object.keys(s.items).forEach(function (id) {
    const m = s.items[id];
    if (mine(m.phaseWith, m.phaseWithKey)) { m.phaseWith = ''; m.phaseWithKey = ''; if (m.code && !m.done && !m.closed) m.status = 'running'; }
    if (mine(m.with, m.withKey)) { m.with = ''; m.withKey = ''; }
    // goal/G21.6: its open takes alone go back to untaken; another agent's take on the same item stands.
    openTakes(m).forEach(function (l) { if (mine(l.taken, l.takenKey)) { l.taken = ''; l.takenKey = ''; } });
    if (mine(m.boxTakenBy, m.boxTakenKey)) { m.boxTakenBy = ''; m.boxTakenKey = ''; m.boxHoldUntil = 0; }
    if (Array.isArray(m.capOffer)) m.capOffer = m.capOffer.filter(function (k) { return k !== key; });
  });
}
// A chat line as it is answered: its writer's key and name beside its label; whom it was addressed to stays inside.
function shownLine(s, l) {
  const o = Object.assign({}, l, { key: String(l.key || ''), name: nameOfKey(s, l.key) });
  delete o.to;
  // goal/G21.4: the taker's key stays inside too; taken shows the taker's label as before.
  delete o.takenKey;
  // goal/G21.6: whether its take is answered is the desk's own bookkeeping, as the taker's key is.
  delete o.answered;
  return o;
}

// THE BINDING NICK (goal/G21.1). Andy, in the item's box: "A line of Andy's starting with a nick followed by any
// punctuation or a space is addressed to that agent alone: only it is notified, only it may take it.", "A nick request
// about the box hands the box to that agent for one write", and of cap: "On: a \"cap\" from Andy with no nick offers the
// box to every agent with cap on" / "Off: that agent gets a cap only when addressed by its nick."
// Decided at the write and kept in the record (to, nick, hold, cap), so a replay never decides again from profiles that
// changed since. A NICK REQUEST ABOUT THE BOX is his nick-addressed line holding the word box or cap: the plainest
// mechanical reading of "about the box" (this build's choice; the box names no wording). His "<nick>:" of goal/G4.23 is
// one case of the rule. Returns null for a line addressed to nobody.
function addressOf(s, text) {
  const t = String(text);
  const m = /^\s*([a-z0-9]{1,8})(?=[\s\p{P}\p{S}])/iu.exec(t);
  if (m) {
    const nick = m[1].toLowerCase();
    const key = Object.keys(s.profiles).filter(function (k) { return s.profiles[k].nick === nick; })[0];
    if (key) return { to: [key], nick: nick, hold: /\b(?:box|cap)\b/i.test(t) };
  }
  if (/^\s*cap\s*[.!]*\s*$/i.test(t)) {
    const known = Object.keys(s.agentKey).map(function (l) { return s.agentKey[l]; }).concat(Object.keys(s.profiles));
    const to = known.filter(function (k, i) { return k && known.indexOf(k) === i && profileOf(s, k).cap && profileOf(s, k).included; });
    return { to: to, cap: true };
  }
  return null;
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
function blank(id, title, goalId) {
  return { id: id, title: title, goal: !goalId, goalId: goalId || '', blocks: [], status: '', with: '', phaseWith: '',
    went: false, go: false, claims: Object.create(null), done: false, alone: false, closed: false, designComplete: false,
    alert: false, boxTakenBy: '', takers: Object.create(null), checkHigh: Object.create(null),
    // goal/G21.1: the key beside the box's label, the end of a box hold, and a cap offered to keys. The take of his
    // lines lives on each line since goal/G21.6 (openTakes).
    boxTakenKey: '', boxHoldUntil: 0, capOffer: null,
    // goal/G21.4: the keys beside with and phaseWith, so "one task per agent" and its release go by key.
    withKey: '', phaseWithKey: '',
    box: '', version: 0, boxHistory: [], checks: [], chat: [], at: '', checked: false, phaseAt: '',
    // FILES TOUCHED, PER ITEM (goal/G8.8). Andy, 2026-10-09: "the list should be owned by the item. so updates to it
    // are available to all participants." Each writer's own paths, by its name, so one agent's list never touches
    // another's: { '<agent>': ['<path>', ...] }.
    files: Object.create(null) };
}

// One record applied to the state. A record that no longer fits (an item gone
// from its session) changes nothing; the refusals happen before it is written.
// ── THE BLOCKS OF A GOAL (goal/G27.5) ─────────────────────────────────
//
//   Andy, 2026-10-14 to 17, in the item's box: block(A, B) and unblock(A, B); a circular block refused "error:
//   circular blocking was asked"; the blockageCompiler "is a grammatical gate": it refuses a block that would be
//   circular or is already implied, rewrites nothing stated, and only repairs what a delete or close leaves; a block
//   onto a running item is refused "error: too late! this is already happening"; an item blocking nothing else blocks
//   the goal. Decided by Andy, not by this file.
//
// Whether `from` reaches `to` through blocks, `from` itself excluded unless a path comes back to it.
function blockReaches(s, from, to) {
  const seen = Object.create(null);
  const stack = ((s.items[from] || {}).blocks || []).slice();
  while (stack.length) {
    const id = stack.pop();
    if (id === to) return true;
    if (seen[id]) continue;
    seen[id] = true;
    const x = s.items[id];
    if (x && !x.goal && !x.leftOut) (x.blocks || []).forEach(function (n) { stack.push(n); });
  }
  return false;
}
// Running: its Go is on record and it is neither done nor closed (R10).
function runningItem(it) { return !!(it && it.go === true && !it.done && !it.closed); }
// Why A may not block B, or '' when it may: the gate (R3, R5, R10).
function blockWhy(s, from, to) {
  const a = s.items[from];
  const b = s.items[to];
  if (!a || a.goal || !b || b.goal) return 'block links two items, not a goal';
  if (a.goalId !== b.goalId) return 'block links two items of one goal; ' + from + ' and ' + to + ' are in different goals';
  if (from === to) return 'an item does not block itself';
  if (a.closed || a.leftOut || b.closed || b.leftOut) return 'block links open items';
  if (runningItem(b)) return 'error: too late! this is already happening';
  if (blockReaches(s, to, from)) return 'error: circular blocking was asked';
  if (blockReaches(s, from, to)) return from + ' already blocks ' + to + ', directly or through others: the block is implied';
  return '';
}
// THE REPAIR (R5): when B goes, every item that blocked B blocks what B blocked, instead; one left blocking nothing
// blocks the goal (R4). Nothing else is rewritten.
function repairBlocks(s, gone) {
  const onward = (gone.blocks || []).filter(function (x) { return x !== gone.goalId && x !== gone.id; });
  Object.keys(s.items).forEach(function (id) {
    const x = s.items[id];
    if (!x || x.goal || x.id === gone.id || (x.blocks || []).indexOf(gone.id) === -1) return;
    let next = x.blocks.filter(function (n) { return n !== gone.id; });
    onward.forEach(function (n) { if (next.indexOf(n) === -1 && n !== x.id) next.push(n); });
    const real = next.filter(function (n) { return n !== x.goalId; });
    x.blocks = real.length ? real : [x.goalId];
  });
}
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
      goalItem.title = String(sess.goal.title || goalItem.title);
      goalItem.at = r.at;
      const ids = [];
      // A SPLIT ADDS ONLY THE EXPLICIT RELATION (goal/G9.4). Andy, 2026-10-07: "when splitting an item, only the new
      // explicit blocking relationship is automatically added, the implicit blocking will not need to be specified, it
      // clutters the list display with confusing \"blocks\" and \"waits on\" columns, and is not needed for a dependency
      // graph.", and "the new split-items always block the item from which they were split, items blocked by the current
      // item are still blocked by the newly split item, because if theyre blocked by me, they are implicitly blocked by
      // the newly created/split item." So in a session that names a split, an item NEW in that session blocks the parent
      // and nothing else, whatever the session sent for it; the parent keeps its own blocks, and what the parent blocks
      // hears of the new ones through the parent alone. Decided by Andy, not by this code: do not widen it back.
      const splits = (Array.isArray(sess.split) ? sess.split : []).map(String);
      const existed = {};
      Object.keys(s.items).forEach(function (k) { existed[k] = true; });
      (sess.items || []).forEach(function (x) {
        const id = String(x.id || '');
        if (!id) return;
        const one = s.items[id] || (s.items[id] = blank(id, '', gid));
        one.title = String(x.title || one.title);
        one.goalId = gid;
        one.blocks = (Array.isArray(x.blocks) ? x.blocks : [x.blocks || gid]).map(String);
        if (splits.length && !existed[id]) {
          // Which parent: the split one this item named, else the only split there is. With several splits named and
          // none of them this item's, the session's own blocks stand, because nothing says which parent it came from.
          const named = one.blocks.filter(function (bk) { return splits.indexOf(bk) !== -1; });
          const parent = named.length ? named[0] : (splits.length === 1 ? splits[0] : '');
          if (parent) one.blocks = [parent];
        }
        one.at = r.at;
        one.leftOut = false;
        // AN ITEM MARKED CODE (goal/G5.7) walks the phases. Andy: "an item marked code is the only one i see this for
        // right now."
        // A sub-goal is never a code item (goal/G6.8): a later session's code: true does not bring the mark back.
        if (x.code === true && !one.subGoal) one.code = true;
        ids.push(id);
      });
      // LEFT OUT IS CLOSED, NEVER DELETED (goal/G4.24). Andy: "1. sounds dumb that the \"archive\" is not
      // searchable.", "if deleted is just a flag in the database, we can just ignore it from now on". An item a new
      // session leaves out stays a member, after the session's own, closed, with its box, checks and chat, so
      // [Include Closed] finds it; the records replay to the same, so items left out before this come back too.
      // It blocks nothing any more (blockers skips it), as it blocked nothing while it was deleted.
      // ONLY HIS SPLIT MAKES A SUB-GOAL (goal/G6.8). Andy: "an item becomes a sub-goal only when i say split, the box of
      // that item must then only contain references to it's blockers, and it can no longer be marked as a coding item."
      // The session names the item split; a new blocking item alone marks nothing (goal/G5.4 had inferred it).
      (Array.isArray(sess.split) ? sess.split : []).map(String).forEach(function (id) {
        const it = s.items[id];
        if (it && !it.goal) { it.subGoal = true; it.code = false; }
      });
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
      it.boxHistory.push({ version: it.version + 1, by: r.by, at: r.at, text: String(b.text) });
      it.box = String(b.text);
      it.version += 1;
      // THE TAKER'S WRITE FREES THE BOX (goal/G4.20 point 9), by key since goal/G21.1: that is the one write of a hold.
      if (it.boxTakenBy && holdsBox(it, { by: r.by, key: String(r.key || '') })) { it.boxTakenBy = ''; it.boxTakenKey = ''; it.boxHoldUntil = 0; }
      // A written box ends a cap still offered (goal/G21.1): the cap was for this text.
      it.capOffer = null;
      return;
    case 'check.add': {
      const kind = String(b.kind);
      const number = nextCheckNumber(it, kind);
      const c = { number: number, kind: kind, words: String(b.words), test: String(b.test || ''), state: 'open', by: String(b.asked || ''), at: String(b.asked ? r.at : '') };
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
      const line = { by: r.by, at: r.at, text: String(b.text), taken: '', key: String(r.key || '') };
      it.chat.push(line);
      // HIS NEWEST LINE GRANTS ITEM ADDS, OR ENDS THE GRANT (goal/G29.21).
      // The item grant holds only for the goal his line is in: under the goal itself or one of its items.
      if (r.by === 'andy') { s.addGrant = addGrantOf(b.text); s.addGrantGoal = it.goal ? it.id : it.goalId; s.goalGrant = goalGrantOf(b.text); }
      if (r.by === 'andy' && Array.isArray(b.to)) {
        // THE BINDING NICK (goal/G21.1): addressed at the write (addressOf), replayed from the record.
        line.to = b.to.map(String);
        if (b.nick && line.to[0]) {
          const key = line.to[0];
          const known = labelOfKey(s, key);
          // An agent never heard from has no label yet: the take stands under its key, shown by its nick.
          const label = known || String(b.nick);
          // goal/G21.6: an open take of this line by its addressee; other agents' takes under the item stand.
          line.taken = label; line.takenKey = key;
          if (known) it.takers[known] = true;
          // HIS NICK REQUEST ABOUT THE BOX: the box is that agent's for one write, red at once, for one minute.
          if (b.hold === true) { it.boxTakenBy = label; it.boxTakenKey = key; it.boxHoldUntil = Date.parse(r.at) + BOX_HOLD_MS; it.capOffer = null; }
        } else if (b.cap === true) {
          it.capOffer = line.to.slice();
        }
      } else if (r.by === 'andy') {
        // HIS "<nick>:" LINE AS IT WAS READ BEFORE goal/G21.1 (goal/G4.23), for the records written then, which carry no
        // address: the agent with that nick takes it under the label it writes with.
        const m = /^\s*([a-z0-9]{1,8})\s*:/i.exec(String(b.text));
        const key = m && Object.keys(s.profiles).filter(function (k) { return s.profiles[k].nick === m[1].toLowerCase(); })[0];
        const label = key && Object.keys(s.agentKey).filter(function (l) { return s.agentKey[l] === key; })[0];
        if (label) { line.taken = label; it.takers[label] = true; }
      }
      // THE TAKER'S ANSWER CLOSES ITS TAKE (goal/G2.2 note 2, goal/G21.4): it answers once. By key (goal/G21.1). Since
      // goal/G21.6 a take is per line: an agent's post closes its own open takes under the item, never another agent's.
      if (r.by !== 'andy') {
        const writer = { by: r.by, key: String(r.key || '') };
        openTakes(it).forEach(function (l) { if (tookLine(l, writer)) l.answered = true; });
      }
      return;
    }
    case 'item.rename': it.title = String(b.title); return;
    case 'item.status': it.status = String(b.word); return;
    case 'item.take': it.with = r.by; it.withKey = String(r.key || ''); it.takers[r.by] = true; return;
    // LETTING AN ITEM GO (goal/G21.4): the caller's with, and its phase if it holds one there; the handler refused a
    // caller holding neither. A phase let go goes back to nobody's, as at phase.done, without moving on.
    case 'item.release': {
      const w = { by: r.by, key: String(r.key || '') };
      if (holdsPhase(it, w)) { it.phaseWith = ''; it.phaseWithKey = ''; it.status = 'running'; }
      if (holdsWith(it, w)) { it.with = ''; it.withKey = ''; }
      return;
    }
    // THE PHASES (goal/G5.7): the handler checked who may; the replay records it.
    // THE PHASE HOLDER IS ITS OWN (goal/G6.9): only phase.take holds a phase; a plain item.take sets "with" and nothing
    // the phase rules read. Andy, to G6 Q5: "add item to fix it." THE STATUS SAYS THE PHASE while it is held: Andy,
    // "when an agent is with an item, update its status with the phase that is running at the time. the desk should
    // do it, since it arbitrase phase-taking."
    case 'phase.take':
      it.with = r.by; it.phaseWith = r.by; it.status = String(b.phase); it.takers[r.by] = true; it.verified = false;
      it.withKey = String(r.key || ''); it.phaseWithKey = String(r.key || '');
      // goal/G29.10: when it took the phase, so its writes answer with his lines typed since (heardSince).
      it.phaseAt = String(r.at || '');
      // The key beside the label (goal/G5.9): a label he may rename, a key that stays.
      if (b.phase === 'red') { it.red = r.by; it.redKey = String(r.key || ''); it.phase = 'red'; }
      else if (b.phase === 'build') { it.builder = r.by; it.builderKey = String(r.key || ''); }
      else if (b.phase === 'verify') { it.verifier = r.by; it.verifierKey = String(r.key || ''); }
      return;
    case 'phase.done':
      it.with = ''; it.phaseWith = ''; it.withKey = ''; it.phaseWithKey = '';
      // Nobody holds the next phase yet: the status goes back to what his Go made it.
      it.status = 'running';
      // deskVerify's word is about ONE verify (goal/G8.3), so every step that starts the work again takes it away and
      // Done waits for deskVerify afresh.
      it.checked = false;
      if (b.phase === 'red') it.phase = 'build';
      else if (b.phase === 'build') it.phase = 'verify';
      // A pass waits for his Done, the item still in code (goal/G29.10): red may be taken again (mayTake).
      else if (b.phase === 'verify') { if (b.pass === true) { it.verified = true; it.phase = ''; } else it.phase = 'build'; }
      // THE DESK WRITES THE STATUS WORD ITSELF (goal/G8.12). Andy, 2026-10-09: "the desk should update status in every
      // change it manages....", and "yes" to its being the word on the List rows. An agent's verify pass does not
      // finish a code item: it waits for deskVerify, and the row says so instead of reading like any running item.
      if (b.phase === 'verify' && b.pass === true && it.code && !it.done && !it.closed) it.status = 'waiting for deskVerify';
      return;
    // AND ONLY deskVerify BRINGS THE BUTTON (goal/G8.3). Andy, 2026-10-09: "best is, if the done button doesn't show up
    // until deskVerify allows it.", and "the builders claim is registered, but only deskVerify brings the button." So
    // the agent's verify still records verified, and this is deskVerify's own word on top of it. A rejection, a new
    // build or a new red takes it away again, since what it was given for is gone.
    case 'verify.pass':
      // On an item it is deskVerify's word over the verifier's (goal/G8.3); on a GOAL it is the full run's word
      // (goal/G8.12), which is why a goal takes it although it carries no code mark.
      if (!it || it.done || it.closed) return;
      // A PLAIN ITEM TAKES IT TOO (goal/G16.13). It used to be dropped here, so a
      // plain item's Done could never come from the verifier and came from the claim
      // instead. Andy, 2026-10-11: "only the verifier should give me a done button,
      // that's one way of knowing that the 'Done' offered went through the verifier."
      if (!it.goal && !it.code && !Object.keys(it.claims).length) return;
      it.checked = true;
      // goal/G8.12: the word on the row, written by the desk - on an item deskVerify has passed it, on a goal the full
      // run has.
      // goal/G14.3: an emptied goal's run is its own items' suites, no longer the full harness, and the word says so.
      it.status = it.goal ? 'goal run passed' : 'deskVerify passed';
      return;
    // A VERIFY TAKEN BACK (goal/G8.3). Andy, 2026-10-09: "deskVerify only reject a done claim. this should prompt an
    // agent to pick the item up, raise red-questions if neccessary." It is the one thing deskVerify may do on his
    // node, and it writes as him; a rejected item goes back to build with the builder it had, so the agent who built
    // it picks it up, and Done is no longer offered. It presses nothing: "deskVerify will NOT press done or closed on
    // my behalf". The line naming the reds is written beside this record by the verb.
    // NOT A WORD ON A DONE OR CLOSED ITEM (goal/G8.10, found by claude-windows on the flood of 2026-10-09): a settled
    // item is nobody's to re-open from the verifier's side. The guard is here as well as at the verb, and it is
    // time-correct on a replay: a record written while the item was open still applies, and the thirty-four rejects
    // that hit already-closed items apply to nothing, which takes their stray phase off his desk.
    case 'verify.reject':
      if (!it || !it.code || it.verified !== true || it.done || it.closed) return;
      it.verified = false;
      it.checked = false;
      it.phase = 'build';
      it.phaseWith = '';
      it.with = '';
      it.phaseWithKey = ''; it.withKey = '';
      // goal/G8.12: the row says it was rejected, not merely that it runs again.
      it.status = 'deskVerify rejected it';
      return;
    // THE GOAL IS EMPTY (goal/G8.12). Andy, 2026-10-09: "why, the run-all should be triggered by: \"no items left in
    // the goal\", by the desk itself." Ruled already in goal/G8.3's box: "When the last item of the goal closes, every
    // copy starts its full run." The record is written once per goal, by the press that empties it, and deskVerify's
    // watcher reads it; the flag here is what makes it once.
    case 'goal.emptied': {
      const g = s.goals[String(b.id)];
      if (g) g.emptied = true;
      // goal/G8.12: and the goal's own row says what it is waiting for, written here and by nobody by hand.
      const row = s.items[String(b.id)];
      if (row && !row.done && !row.closed) row.status = 'goal run started';
      return;
    }
    // AN AGENT'S RE-VERIFY (goal/G8.10). Andy, 2026-10-09: "an agent should be able to trigger a re-verify." It changes
    // nothing of the item - not its phase, not its verified mark, not its buttons: the record itself is the word, and
    // deskVerify's watcher reads it and runs the item's suites again.
    // (Since goal/G19.2 the record on a goal carries goal: true, which is how the watcher knows to run the goal run;
    // it still changes nothing here.)
    case 'verify.again': return;
    // A DONE TAKEN BACK BY A REGRESSION (goal/G19.2). Andy, 2026-10-12: "i said the verifier can not press done, i
    // never said that the verifier cannot undo a done/close...", "a done becomes unsettles when an associated suite
    // shows regression.", and "a regression must come back as a red." The verifier still presses nothing: this is its
    // own word, as verify.reject is, written as him. When it is written (a red on a clean, pulled tree holding the
    // item's commit) is deskVerify's to judge; what it does is here, so a replay agrees. On an item: done and closed
    // go, with its pass, its verify and its claims, so Done waits for the work again and an agent's new claim starts
    // the check; a code item goes back to build as a rejected one does. On a goal: done and closed go, with its pass
    // and its emptied mark, so the item's next Done asks a new goal run. Nothing that was not settled is touched.
    case 'verify.regress': {
      if (!it) return;
      const word = 'regressed: ' + String(b.why || 'a suite it lists went red').slice(0, 200);
      if (it.goal) {
        const rg = s.goals[it.id];
        if (!it.done && !it.closed && !it.checked && !(rg && rg.emptied)) return;
        it.done = false; it.closed = false; it.alone = false; it.checked = false;
        if (rg) rg.emptied = false;
        it.status = word;
        return;
      }
      if ((!it.done && !it.closed) || it.leftOut) return;
      it.done = false; it.closed = false; it.alone = false;
      it.verified = false; it.checked = false; it.claims = Object.create(null);
      if (it.code) { it.phase = 'build'; it.phaseWith = ''; it.with = ''; it.phaseWithKey = ''; it.withKey = ''; }
      it.status = word;
      return;
    }
    // TAKING THE BOX (goal/G4.20 point 9). Andy: "anybody that takes somethings that affects the box, and the box
    // is red. cap also." The handler refuses a take while another stands, so what reaches here always lands.
    // goal/G21.1: a take of an offered cap (hold) is a hold under the one-write rule, its minute from the take.
    case 'box.take':
      it.boxTakenBy = r.by; it.boxTakenKey = String(r.key || ''); it.takers[r.by] = true;
      it.boxHoldUntil = b.hold === true ? Date.parse(r.at) + BOX_HOLD_MS : 0;
      if (b.hold === true) it.capOffer = null;
      return;
    // goal/G9.3: the holder lets the box go without writing it; the refusals are at the verb, so a replay only clears.
    case 'box.release': if (holdsBox(it, { by: r.by, key: String(r.key || '') })) { it.boxTakenBy = ''; it.boxTakenKey = ''; it.boxHoldUntil = 0; } return;
    // THE DESK OWNS THE IDS (goal/G9.9). Andy, 2026-10-07: "the desk owns (is in charge of) goal and item ID's.", and
    // on who uses the verbs: "why should the agents need to, they can use the same api's the user needs to create
    // them." The id is minted at the write and kept in the record as `minted`, so a walk of the records never mints
    // again. Neither add moves the current goal (goal/G9.13).
    case 'goal.add': {
      const gid = String(b.minted || '');
      if (!gid) return;
      if (!s.goals[gid]) s.goals[gid] = { id: gid, design: true, abandoned: false, members: [] };
      const gi = s.items[gid] || (s.items[gid] = blank(gid, '', ''));
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
      const one = s.items[id] || (s.items[id] = blank(id, '', gid));
      one.title = String(b.title || one.title);
      one.goalId = gid;
      // A plain add blocks its goal, as a session's item with no blocks does; with `blocks` named (goal/G9.10) it
      // blocks that item alone.
      one.blocks = [String(b.blocks || gid)];
      one.at = r.at;
      // WHO CREATED IT (goal/G27.10, R2): its creator posts under it at any time; the first add names it.
      if (!one.creator) { one.creator = r.by; one.creatorKey = String(r.key || ''); }
      if (g.members.indexOf(id) === -1) g.members.push(id);
      // goal/G29.21: code from the record (the handler decided it); an agent's add spends one of an "add item" grant.
      if (b.code === true && !one.subGoal) one.code = true;
      if (r.by !== 'andy' && r.by !== 'desk' && s.addGrant > 0) s.addGrant -= 1;
      return;
    }
    // HIS DELETE CLOSES IT AS A LEFT-OUT ONE IS CLOSED (goal/G9.7). Andy, 2026-10-07: "the button bar of items will
    // offer an arm-able [delete] while in design mode.", and on whether it erases: "close is enough. that essentially
    // leaves them as \"musings\" on the record." So the item keeps its box, checks and chat, Include Closed finds it,
    // and it blocks nothing (blockers skips a left-out one), exactly as goal/G4.24 decided for a session's leavings.
    case 'item.delete': {
      if (!it || it.goal) return;
      it.closed = true;
      it.leftOut = true;
      repairBlocks(s, it);
      return;
    }
    // BLOCK AND UNBLOCK (goal/G27.5, R1 and R2): A blocks B, between items of one goal. The gate (blockWhy) refused what
    // is wrong before the record was written, so the walk only links: the goal fallback goes once the item blocks
    // something else (R4: it is then implied), and comes back when it blocks nothing.
    case 'block': {
      if (!it || it.goal) return;
      const to = String(b.blocks);
      it.blocks = it.blocks.filter(function (x) { return x !== it.goalId; });
      if (it.blocks.indexOf(to) === -1) it.blocks.push(to);
      return;
    }
    case 'unblock': {
      if (!it || it.goal) return;
      const to = String(b.blocks);
      it.blocks = it.blocks.filter(function (x) { return x !== to; });
      if (!it.blocks.length) it.blocks = [it.goalId];
      return;
    }
    // FILES TOUCHED (goal/G8.8). Andy, 2026-10-09: "ideally written by the claiming agent. the coding agent and the
    // testing agent should be adding files they test/touch in a list that can be fetched per item." A write carries
    // that agent's WHOLE list for the item and replaces its own entries, leaving every other agent's alone, so a
    // wrong path is corrected by writing the list again and nothing has to be deleted.
    case 'item.files.add': {
      if (!it) return;
      if (!it.files) it.files = Object.create(null);
      it.files[r.by] = (Array.isArray(b.paths) ? b.paths : []).map(String);
      // ONE GRANT FOR ALL THE CORE FILES (goal/G8.8). Andy, 2026-10-09: "all files that need a grant should get one
      // 'grant' button together." So there is at most one open core grant on an item: its words are rewritten when the
      // core set changes, and it goes when no core file is left. commitCheck raised one grant per file until today.
      // ONLY A CHANGED SET ASKS HIM AGAIN (goal/G8.8, found by claude-windows verifying e4818ee9): every agent re-sends
      // its whole list as it works, so a grant he has already given must not be asked for twice - a core grant whose
      // words he granted already stands for that set, and nothing new is raised until the set itself changes.
      const core = filesOf(it).filter(function (e) { return e.core; }).map(function (e) { return e.path; });
      const isCoreGrant = function (c) { return c.kind === 'G' && String(c.words).indexOf('core grant: ') === 0; };
      const open = it.checks.filter(function (c) { return isCoreGrant(c) && c.state === 'open'; });
      if (core.length) {
        const words = 'core grant: ' + core.join(', ');
        const settled = it.checks.some(function (c) { return isCoreGrant(c) && c.state !== 'open' && c.words === words; });
        if (settled) { it.checks = it.checks.filter(function (c) { return !(isCoreGrant(c) && c.state === 'open'); }); return; }
        if (open.length) { open[0].words = words; open[0].at = r.at; it.checks = it.checks.filter(function (c) { return !(isCoreGrant(c) && c.state === 'open') || c === open[0]; }); }
        else it.checks.push({ number: nextCheckNumber(it, 'G'), kind: 'G', words: words, test: '', state: 'open', by: 'desk', at: r.at });
      } else if (open.length) {
        it.checks = it.checks.filter(function (c) { return !(isCoreGrant(c) && c.state === 'open'); });
      }
      return;
    }
    case 'press': press(s, it, String(b.what), r, goalOf, b); return;
    // A CLAIM CARRIES ITS COMMIT (goal/G19.13). Andy, 2026-10-12: "these push things, when you report a claim on code,
    // it should be accompanied by the commit id, that way desk verify won't check something that hasn't arrived yet...
    // ?", and to one verb carrying both: "better. that closes the door on half-ass claims." A build claim IS the
    // claim-done, applied by the same press() so the two can never drift, and the item keeps the commit it was claimed
    // at; a red claim changes nothing but the commit kept ("they should be red. at the time"). The refusals are at the
    // verb, so a replay only records.
    case 'claim':
      if (!it) return;
      if (String(b.phase) === 'build') { press(s, it, 'claim-done', r, goalOf, b); it.claimCommit = String(b.commit || ''); }
      else if (String(b.phase) === 'red') it.redCommit = String(b.commit || '');
      return;
    // THE LISTENER'S WORD (goal/G2.3). Andy: "it starts, when the agent stops listening to do a task, and it
    // stops when the agent goes back to listening. the listening script can toggle those two?"
    case 'agent.state': s.agentWord[r.by] = String(b.word); return;
    // SIGNOFF (goal/G8.5). Andy, 2026-10-06: "the signoff verb is \"signoff\"", so a leaving agent is not waited out for
    // ten minutes; and, 2026-10-09, of an agent that is gone: "consider it gone. it would have taken up the task
    // otherwise, wouldn't it?" So it is gone at once and every phase it holds is freed for the other to take. The write
    // that carried it counted as liveness above; this takes that back. Its next write makes it live again.
    case 'signoff':
      delete s.agentsAt[r.by];
      delete s.agentWord[r.by];
      Object.keys(s.items).forEach(function (id) { const m = s.items[id]; if (m.phaseWith === r.by) { m.phaseWith = ''; m.phaseWithKey = ''; if (m.with === r.by) { m.with = ''; m.withKey = ''; } } });
      return;
    // AN AGENT'S SCOPE (goal/G4.23), by its key, as he set it last; the handler refused anything malformed.
    // AN AGENT'S PROFILE (goal/G4.23), his, as he set it last: its name and its nick.
    // (Agent scopes went with goal/G10.8, every agent being /: an old scope.set record falls to the default and changes
    // nothing.)
    // goal/G21.1 adds included and cap, on unless his record says off (records before it carry neither).
    case 'profile.set':
      s.profiles[String(b.agent)] = { name: String(b.name), nick: String(b.nick), included: b.included !== false, cap: b.cap !== false };
      // goal/G21.4: his exclusion releases everything the agent holds (releaseKey).
      if (b.included === false) releaseKey(s, String(b.agent));
      return;
    // TAKING HIS LINE (goal/G2.2 note 2). Andy: "an item can 'take' my message and be the only one to answer after
    // that, i then can solicit an answer from others." Since goal/G21.6 the taker's name goes on the newest of his
    // lines that is not taken and is addressed to it or to nobody (takeableLine, the handler's own rule, by the
    // record's key), and that line is the taker's to answer once. The handler refused a take with no such line, so
    // what reaches here lands; a record written before goal/G21.6 took his latest line, which is that same line.
    case 'line.take': {
      const l = takeableLine(it, String(r.key || ''));
      if (l) { l.taken = r.by; l.takenKey = String(r.key || ''); it.takers[r.by] = true; }
      return;
    }
    default: return;
  }
}

// A CHECK NUMBER IS NEVER LENT TWICE (goal/G19.5). Andy, 2026-10-12, to "Should check numbers never repeat": "yes."
// Numbers were count + 1, and item.files.add removes a grant that is no longer owed, so a grant raised again took the
// number of the one removed and a press meant for one could land on the other. Each item remembers the highest number
// it ever gave, kind by kind, in the walk (so a replay gives the same numbers), and the next is one above it.
function nextCheckNumber(it, kind) {
  let high = it.checkHigh[kind] || 0;
  it.checks.forEach(function (c) { if (c.kind === kind) { const n = Number(String(c.number).slice(kind.length)) || 0; if (n > high) high = n; } });
  it.checkHigh[kind] = high + 1;
  return kind + (high + 1);
}

function press(s, it, what, r, goalOf, b) {
  // THE RULES IN FORCE AT HIS GO (goal/G5.8), recorded in the press itself, so a rule changed later never moves under
  // work already running.
  const rulesAtGo = function (m) { if (b && b.rules && Array.isArray(b.rules[m.id])) m.rules = b.rules[m.id]; };
  const g = goalOf(it.id);
  if (what === 'start-design' && g) g.design = true;
  else if (what === 'end-design' && g) g.design = false;
  else if (what === 'abandon' && g) g.abandoned = true;
  // MAKE CURRENT (goal/G2.19). Andy, 2026-10-06: "i want to switch between goals at will, so the goals detail should
  // give me re-open and and on any open goal i want a button \"make current goal\"". Until now the current goal moved
  // for one reason only, a session.set, so switching meant an agent writing a session for him. It moves the goal and
  // nothing else: no item's state, neither goal's design mode, nothing closed or opened.
  else if (what === 'make-current' && it.goal) s.current = it.id;
  // HIS CODE TOGGLE (goal/G9.5). Andy, 2026-10-07: "the item Detail dialog has a check/toggle button, [Code✓], in it's
  // button bar, where the user can set the Code-state of an item". Never on a goal, never on a sub-goal (goal/G6.8:
  // "it can no longer be marked as a coding item"); the handler refuses both, and the walk holds it too.
  // CODE MARKED AFTER HIS GO (goal/G8.10). His Go starts the red phase only on an item that is already a coding item,
  // so an item marked as code afterwards sat with no phase at all: nobody could take it, no Done was offered, and no
  // Close either (Close is offered before a Go alone), which held its goal's Done as well. Andy, 2026-10-09, "go" to
  // this line: marking the item starts its red, exactly as his Go would have.
  else if (what === 'code' && !it.goal && !it.subGoal) {
    it.code = !it.code;
    if (it.code && it.go && !it.phase) it.phase = 'red';
  }
  else if (what === 'design-complete') { it.designComplete = true; it.status = 'ready'; }
  // HIS GO IS ON RECORD (goal/G3.9): `go` is set by his go and go-all alone and by nothing else; `went` stays the
  // state of the item, which older records set in other ways.
  // His Go on a sub-goal is a go-all over its blockers (goal/G5.4); the sub-goal itself carries no Go.
  else if (what === 'go' && it.subGoal && !it.goal) subGoalGoable(s, it).forEach(function (m) { m.went = true; m.go = true; m.status = 'running'; rulesAtGo(m); });
  else if (what === 'go') { it.went = true; it.go = true; it.status = 'running'; if (it.code && !it.phase) it.phase = 'red'; rulesAtGo(it); }
  else if (what === 'go-all' && g) goable(s, g).forEach(function (m) { m.went = true; m.go = true; m.status = 'running'; if (m.code && !m.phase) m.phase = 'red'; rulesAtGo(m); });
  // HIS WAIVE (goal/G5.7). Andy: "absolutely. with only one agent this must be waved." One agent may take every phase.
  else if (what === 'waive') it.waived = true;
  // A CLAIM CONSUMES THE GO (goal/G2.13). Andy: "When Done is offered, Go will be considered pressed/consumed",
  // and "ok, too." to a Reopen without a Go: an item claimed before his Go counts as gone, as his Go would make it.
  // SINCE goal/G3.9 NO SUCH CLAIM IS TAKEN: the press refuses a claim-done on an item without his Go (Andy,
  // 2026-10-03: "yes, the desk may refuse a claim-done, on an item without 'go' on record", "the actual contract
  // is consumed between 'go' and 'done'"). The line below replays the records taken before that day as they were.
  else if (what === 'claim-done') {
    it.claims[r.by] = true;
    if (!it.goal && !it.went) { it.went = true; it.status = 'running'; }
  }
  else if (what === 'done') { it.done = true; it.alone = !Object.keys(it.claims).length; }
  // REOPEN TAKES BACK DONE AS WELL AS CLOSE (goal/G4.20 point 2). Andy: "agreed: \"Reopen takes back Done as well
  // as Close\"". His Go stays on record; the claims go, so Done is not offered again until an agent claims anew.
  else if (what === 'reopen') {
    it.done = false; it.closed = false; it.alone = false; it.claims = Object.create(null);
    // A REOPENED GOAL WAITS FOR A FRESH RUN (goal/G19.2). Its deskVerify pass and its emptied mark survived the reopen,
    // so Done came straight back on the old run's word. Andy, 2026-10-12, to the four fixes that hold back an unearned
    // Done: "yes. with my addendum." Both go here, in the walk, so a replay agrees; with the mark gone the press below
    // writes a new goal.emptied when every item is still done or closed, and that is the fresh run.
    if (it.goal) { it.checked = false; if (g) g.emptied = false; }
  }
  else if (what === 'close') { it.closed = true; if (!it.goal) repairBlocks(s, it); }
  // A BROUGHT-BACK ITEM DRAWS HIS EYE (goal/G2.1 note 6). Andy: "the row should immediately pop back into
  // visibility, with the attention-grabbing error icon, to draw my attention." The alert stands until his seen.
  else if (what === 'bring-back') { it.closed = false; it.alert = true; }
  else if (what === 'seen') it.alert = false;
}

// What blocks an item: every open item of its goal that names it in `blocks`.
// Desk's meaning: "an item names what it blocks".
function blockers(s, it) {
  const g = s.goals[it.goal ? it.id : it.goalId];
  if (!g) return [];
  // A CLOSED ITEM BLOCKS NOTHING (goal/G9.17): closed leaves the blockers as done does. Until then goal/G10 read
  // blocked by its closed Configuration manager, and a Go would have stayed off behind a closed blocker.
  return g.members.filter(function (id) {
    const o = s.items[id];
    return o && o.id !== it.id && !o.done && !o.closed && !o.leftOut && o.blocks.indexOf(it.id) !== -1;
  });
}

// THE GOAL THAT HAS JUST EMPTIED (goal/G8.12): every item of it done, closed or left out, and no goal.emptied on the
// record yet. Called after a press lands, so the state it reads is the state his press produced; it writes one record
// as the desk itself, which is what deskVerify's watcher takes for "run the full harness now".
function emptiedByPress(a) {
  const st = walkState();
  const it = st.items[String(a && a.id)];
  if (!it) return false;
  const gid = it.goal ? it.id : it.goalId;
  const g = st.goals[gid];
  if (!g || g.emptied || gid === GROUP_CHAT) return false;
  const members = g.members.filter(function (id) { const m = st.items[id]; return m && !m.leftOut; });
  if (!members.length) return false;
  if (!members.every(function (id) { const m = st.items[id]; return m.done || m.closed; })) return false;
  write('goal.emptied', { id: gid, by: 'desk', key: '' });
  return true;
}

// The buttons, decided here once for the List and the dialog alike.
//   Go!    after design ends (Andy's "end design mode."), not yet gone, nothing open blocks it
//   Done   on an item once one agent has claimed ("1 agents consent will offer done buttons");
//          on a goal once every item is done or closed (goal/G2.10)
//   Close and Reopen once done
//   Close also on an item before his Go (goal/G3.9; Andy, 2026-10-03: "A close - with arm-button is available ...
//          before an item has received a 'go' or a 'done', so the user can get it off the desk, since close is
//          more of an 'visibility' issue than a process issue"); the List hides it, the dialog arms it
//   Go all on a goal while any of its items offers Go! (desk/G3.4, Andy: "i should
//          have a go-all button for fixing rounds")
//   Reopen alone once closed (goal/G4.20 point 2: Reopen takes back Done as well as Close); the group chat's
//          anchor none, as it refuses bring-back (goal/G3.10)
// A PLUGIN'S GOAL OFFERS NO BUTTON ITS PLUGIN REFUSES (goal/G22.3): the List, the dialog and the press read this one
// list, so a refused press is never drawn. Delete is the verb item.delete, every other button a press.
function buttons(s, it) {
  const out = buttonsOf(s, it);
  if (!PLUGINS.length) return out;
  return out.filter(function (what) {
    const verb = what === 'delete' ? 'item.delete' : 'press';
    const a = what === 'delete' ? { id: it.id } : { id: it.id, what: what };
    return !PLUGINS.some(function (p) { return !!pluginRefusal(p, verb, a); });
  });
}
function buttonsOf(s, it) {
  const g = s.goals[it.goal ? it.id : it.goalId];
  if (it.closed) return it.id === GROUP_CHAT ? [] : ['reopen'];
  if (it.done) return ['close', 'reopen'];
  const out = [];
  // A GOAL NEVER OFFERS GO! (desk/G3.7): its items are gone, not the goal itself.
  // AND NO ITEM OFFERS GO BESIDE DONE (goal/G2.13). Andy: "when Done is offered, Go may no longer be displayed."
  // A claimed item offers Done, so it offers no Go; the press below refuses a Go that is not offered.
  const claimed = !it.goal && Object.keys(it.claims).length > 0;
  // DONE WAITS ON EVERY GRANT (goal/G8.5). Andy, 2026-10-09: "'Done' needs all grants approved." On every item and
  // goal: while any G check is open, no Done is offered, and his red mark on the row says why.
  const grantsOpen = it.checks.some(function (c) { return c.kind === 'G' && c.state === 'open'; });
  // A SUB-GOAL IS A SCOPED GOAL (goal/G5.4). Andy: "items that are no-code branches, they really are sub-goals, and
  // must offer 'Done' when it's blockers are done.", "pressing 'Go' on a sub-goal presses go on it's blockers, where
  // appropriate.", "it's like a scoped goal." So it offers Go while a blocker offers Go, Done once every item that
  // blocks it is done or closed, and nothing else.
  if (it.subGoal && !it.goal) {
    if (g && !g.design && subGoalGoable(s, it).length) out.push('go');
    const under = splitOf(s, it);
    if (!grantsOpen && under.length && under.every(function (m) { return m.done || m.closed; })) out.push('done');
    return out;
  }
  if (!it.goal && !claimed && g && !g.design && !it.went && !blockers(s, it).length) out.push('go');
  // A GOAL OFFERS DONE ONLY WHEN EVERY ITEM IS DONE OR CLOSED, AND NEVER ON A CLAIM (goal/G2.10). Andy: "the goal
  // should only offer a done button when all items are done", and "the goals done button should be tied to the
  // condition that all visible items are done" — so an item added open takes it away again, and a claim-done
  // pressed against the goal id offers nothing by itself. An item's own rule is unchanged: a claim offers Done.
  if (it.goal) {
    const allDone = g && g.members.length > 0 && g.members.every(function (id) { const m = s.items[id]; return m && (m.done || m.closed); });
    // AND THE GOAL'S DONE WAITS FOR THE FULL RUN WHERE ONE CAN RUN IT (goal/G8.12). Andy, 2026-10-09: "the run-all
    // should be triggered by: \"no items left in the goal\", by the desk itself." The run is deskVerify's, so where a
    // deskVerify answers on this node the goal's Done comes with its verify.pass on the goal and not before; where
    // none runs, nothing changes and the Done comes as it always did.
    if (allDone && !grantsOpen && (it.checked === true || !hasDeskVerify())) out.push('done');
  // A CODE ITEM OFFERS DONE ON THE VERIFIER'S PASS ALONE (goal/G5.7), no claims needed.
  // AND DONE WAITS FOR deskVerify WHERE ONE RUNS (goal/G8.3). Andy, 2026-10-09: "best is, if the done button doesn't
  // show up until deskVerify allows it.", and "the builders claim is registered, but only deskVerify brings the
  // button." So a code item needs the verifier's pass AND deskVerify's own word (verify.pass) - but only while a
  // deskVerify runs on this node: on a box without one, Done follows the pass as it always has, or nothing there could
  // ever be done.
  // AND A PLAIN ITEM WAITS FOR THE VERIFIER TOO (goal/G16.13). Andy, 2026-10-11:
  // "only the verifier should give me a done button, that's one way of knowing that the
  // 'Done' offered went through the verifier." A claim is still what a plain item needs
  // — it has no verify phase to pass — but the claim alone no longer brings the button.
  //
  // AND WITH NO deskVerify ON THE BOX IT STILL WAITS, unlike a code item. That looks
  // like the harsher rule and is the plainer one: `verify.pass` is offered on a claimed
  // plain item now, so Done is still reachable where no verifier runs, and the button
  // then means the same thing everywhere — somebody or something said the item holds.
  // A code item keeps its own escape, which predates this and is not this item's to move.
  } else if (!grantsOpen && (it.code ? (it.verified === true && (it.checked === true || !hasDeskVerify()))
    : (Object.keys(it.claims).length && it.checked === true))) out.push('done');
  // WAIVE (goal/G2.22). Andy, 2026-10-06: "there is no Waive in the G2.18 dialog", the server having had the press
  // since goal/G5.7 and the face never a button. On when it shows, asked which of two readings he meant: "only when
  // it's blocked on me" — so only while the build is his to unblock: its red written, nobody holding the build, not
  // yet waived. A build somebody holds is not blocked on him, and nor is a red still being written. Never a goal: a
  // goal has no phases. Counted in the waiting number like any button ("count it."), which is why it is this narrow.
  if (!it.goal && it.code && it.go === true && it.waived !== true && it.phase === 'build' && !it.phaseWith) out.push('waive');
  if (it.goal && g && goable(s, g).length) out.push('go-all');
  if (!it.goal && !it.went && !claimed) out.push('close');
  // A GOAL OFFERS CLOSE ALWAYS (goal/G5.6), open items or not. Andy, to "a goal gets a Close like an item's (off the
  // List, still searchable, Reopen brings it back)": "yes. if it has items still open it can ask me: are you sure?"
  // The asking is the face's; the press is taken either way, and the items keep their state.
  if (it.goal) out.push('close');
  // MAKE CURRENT (goal/G2.19): on an open goal that is not the current one, so the dialog draws it as it draws every
  // button. Never on an item, which has no List of its own, and never on an abandoned goal, which is invisible. A
  // closed goal returns above with Reopen alone, which is the order his words give: "re-open and ... make current goal".
  // A PLUGIN GOAL IS NEVER THE CURRENT GOAL (goal/G27.2, D6). Andy, 2026-10-17: Stacks, like Team, is a standing scope of
  // the desk, never the current goal, and "that current goal change must be stopped for ALL plugin-goals", in the code
  // common to plugins, not inside one.
  if (it.goal && g && !g.abandoned && s.current !== it.id && !PLUGIN_GOAL[it.id]) out.push('make-current');
  // DELETE, IN DESIGN MODE OR OUT OF IT (goal/G24.9; it was design mode only under goal/G9.7). Andy, 2026-10-14: "i have
  // no delete option for this item". So any item that is not a goal offers it whatever the goal's design mode, with two
  // exceptions: none while an agent holds a phase on it (red, build or verify), and none on an item claimed done and
  // not yet closed (his "no." to Q1). A closed or done item returned above and offers none. G9.7's ruling stands: delete
  // closes and leaves out, it erases nothing. The dialog draws it from here, and item.delete refuses what is not here.
  if (!it.goal && g && !it.phaseWith && !claimed) out.push('delete');
  return out;
}
// The items that block a sub-goal (its split), closed or done ones included; and those of them offering Go!.
function splitOf(s, it) {
  const g = s.goals[it.goalId];
  if (!g) return [];
  return g.members.map(function (id) { return s.items[id]; }).filter(function (o) {
    return o && o.id !== it.id && !o.leftOut && o.blocks.indexOf(it.id) !== -1;
  });
}
function subGoalGoable(s, it) {
  return splitOf(s, it).filter(function (m) { return !m.closed && !m.done && buttons(s, m).indexOf('go') !== -1; });
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
// AN OFFERED DONE WAITS ON HIM ONCE EVERY TAKER HAS CLAIMED IT (goal/G4.26). Andy: "only if all agents involved in
// that item consider it done.", involved being those that "took it", and "i see the go." (an offered Go counts
// nothing). The takers are those that wrote item.take, line.take (his "<nick>:" take included) or box.take; an item
// nobody took counts from its first claim.
function asksOf(s, it) {
  const doneOffered = buttons(s, it).indexOf('done') !== -1;
  const open = it.checks.filter(function (c) {
    return c.state === 'open' && (c.kind === 'G' || c.kind === 'Q' || (c.kind === 'C' && doneOffered));
  }).length;
  const allClaimed = !it.goal && doneOffered && (it.code ? it.verified === true : Object.keys(it.claims).length > 0 &&
    Object.keys(it.takers).every(function (t) { return it.claims[t]; }));
  return open + (allClaimed ? 1 : 0);
}

// WHO MAY TAKE A PHASE (goal/G5.7), '' when the agent may, else the refusal. Andy: the red's writer may not build ("ok:"
// to wsl-claude's line), the builder writes no red and does not verify, "the red writer may be the verifier", a failed
// verify goes back to the same builder, after an all-green build "it's the verifier that extends the red", and his
// waive lifts all of it ("with only one agent this must be waved").
function mayTake(s, it, phase, who) {
  if (!it || it.goal || !it.code || it.go !== true || it.done || it.closed) return 'not-offered';
  // NO PHASE WHILE DESIGN IS ON (goal/G6.8). Andy: "no phases can be taken in an item while design mode is on."; an
  // earlier Go does not lift it.
  const gd = s.goals[it.goalId];
  if (gd && gd.design) return 'not-offered';
  if (it.phaseWith) return 'taken';
  const w = it.waived === true;
  if (phase === 'red') {
    if (it.phase === 'red') return w || who !== it.builder ? '' : 'not-offered';
    // PHASES STAY RE-TAKABLE UNTIL HIS DONE (goal/G27.19). Andy, 2026-10-17: "the desk should allow any restart of
    // phases as long as 'done' is not pressed", "Just because 'Done' is offered doesn't mean it's fucking done....". A
    // verify pass leaves the phase empty; while the item is not done (checked above) red opens a fresh cycle under the
    // same item, its Go standing, never to the builder unless waived, as the verifier's extension of the red below.
    // THE ITEM STAYS IN CODE FROM HIS GO TO HIS DONE (goal/G29.10, point 3, which replaced the hold of goal/G27.20):
    // "The agent's own claim that it is done (a verify pass) leaves it in code", and his lines reach it without a hold.
    // So red is taken again with no line of his; work.open offers it to nobody (no JOB while it is being worked on).
    if (!it.phase) return w || who !== it.builder ? '' : 'not-offered';
    if (it.phase === 'verify' && it.verifier && who === it.verifier) return w || who !== it.builder ? '' : 'not-offered';
    return 'not-offered';
  }
  if (phase === 'build') {
    if (it.phase !== 'build') return 'not-offered';
    if (!w && who === it.red) return 'not-offered';
    if (!w && it.builder && who !== it.builder) return 'not-offered';
    return '';
  }
  if (phase === 'verify') return it.phase === 'verify' && (w || who !== it.builder) ? '' : 'not-offered';
  return 'bad-request';
}

// WHICH RULES APPLY (goal/G5.8). Andy: "if a job involves ui, there are rules of that type to considered", "is there a
// mechanical way to attach applicable rules to an item before or when it's given a go?". The desk rules always, plus
// the types the item's box names paths of: spirit/run/js/ and process/js/ are code, spirit/run/shell/ is ui.
// AND THE DESIGN RULES ALWAYS (goal/G2.20). Asked what the type design should attach to, Andy, 2026-10-06: "every
// item". Until this, a design rule matched no item at all, whatever its box said, and his Go stamped nothing of it:
// the kind of rule that governs how the work is done belongs on every item, like a desk rule.
function typesOf(it) {
  const box = String(it.box || '');
  const types = ['desk', 'design'];
  if (/spirit\/run\/js\/|process\/js\//.test(box)) types.push('code');
  if (/spirit\/run\/shell\//.test(box)) types.push('ui');
  return types;
}
function rulesFor(it) {
  const types = typesOf(it);
  return newestRules.all().filter(function (r) { return r.status === 'active' && types.indexOf(r.type) !== -1; })
    .map(function (r) { return { key: r.key, version: r.n }; });
}
// The items his Go starts, each with its rules, as the press records them.
function rulesForGo(s, id, what) {
  const it = s.items[String(id)];
  if (!it) return {};
  const g = s.goals[it.goal ? it.id : it.goalId];
  const going = what === 'go-all' ? (g ? goable(s, g) : []) : it.subGoal && !it.goal ? subGoalGoable(s, it) : [it];
  const out = {};
  going.forEach(function (m) { out[m.id] = rulesFor(m); });
  return out;
}

// AN OPEN RED QUESTION (goal/G6.8). Andy: "i want mechanical tracking of design-greens. Yes i want opens to light up my
// list with ERROR icons." An item is design-green when none is open; his End design and a Go wait for green.
function openQ(it) { return !!it && it.checks.some(function (c) { return c.kind === 'Q' && c.state === 'open'; }); }
function notGreen(s, ids) {
  return ids.filter(function (id) { const m = s.items[id]; return m && !m.closed && !m.done && openQ(m); });
}

// LIMBO (goal/G5.4). Andy (andy/NOFACE.md): "when 'go' was pressed/consumed on an item, and no agent is working on
// that item, (all agents idle, ) and no 'Done' button is visible, no grants or red questions pending, then the item
// sits in 'limbo'. this limbo-state is actionable for agents.", and "limbo, when detected must be taken by an
// agent." Working on it: an agent that took it, live, whose last word is working. At once, with no grace time:
// Andy, to how long nobody must be working first: "it counts al limbo immediately."
function limboOf(s, it) {
  if (!it || it.goal || it.subGoal || it.go !== true || it.done || it.closed) return false;
  if (buttons(s, it).indexOf('done') !== -1) return false;
  if (it.checks.some(function (c) { return c.state === 'open' && (c.kind === 'G' || c.kind === 'Q'); })) return false;
  // A HELD PHASE IS NOT LIMBO (goal/G9.14). Andy, 2026-10-09, to "Open an item to have limbo read the phase holder
  // instead?": "yes". Until this, limbo read each taker's word, and an agent that arms its listener says listening, so
  // every item it held fell back into limbo and the desk posted the line again on the next write. So the phase holder
  // decides; a holder gone silent is the desk's stale question (10 minutes), not this.
  if (it.phaseWith) return false;
  // A CLAIM WAITING ON THE VERIFIER IS NOT LIMBO (goal/G18.5). Somebody finished it and deskVerify is checking it; the
  // taker's word flipping between working and listening while it waits brought the limbo line again on every flip.
  // Andy, 2026-10-12, accepting "no limbo line while a claim waits on deskVerify": "your points accepted."
  if (Object.keys(it.claims).length && !it.checked) return false;
  // On a code item the phase holder is the whole answer: a phase nobody holds is limbo however its earlier takers are
  // marked, which is what makes a finished red visible to the agent that must build it.
  if (it.code) return true;
  const now = Date.now();
  return !Object.keys(it.takers).some(function (t) {
    return s.agentWord[t] === 'working' && s.agentsAt[t] && now - Date.parse(s.agentsAt[t]) < LIVE_MS;
  });
}

// THE AGENTS HERE NOW: every agent whose last write is inside LIVE_MS, sorted. The goal's facts say it, and the
// waive of goal/G2.22 is decided by it.
function liveAgents(s) {
  const now = Date.now();
  return Object.keys(s.agentsAt).filter(function (a) { return now - Date.parse(s.agentsAt[a]) < LIVE_MS; }).sort();
}

// THE ITEM'S FILE LIST, FLATTENED (goal/G8.8): every writer's paths as one list of { path, by, core }, sorted by path
// so the Details draws it the same way twice. core is coreFiles.isCore, never a second list of its own.
function filesOf(it) {
  const core = require('../../../js/coreFiles.js');
  const held = it.files || {};
  const out = [];
  Object.keys(held).forEach(function (by) {
    (Array.isArray(held[by]) ? held[by] : []).forEach(function (p) {
      out.push({ path: String(p), by: by, core: core.isCore(String(p)) === true });
    });
  });
  return out.sort(function (a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : (a.by < b.by ? -1 : 1); });
}

function facts(s, it) {
  const f = { id: it.id, title: it.title, goal: it.goal ? '' : it.goalId, status: it.closed ? 'closed' : it.done ? 'done' : it.status,
    with: it.with, buttons: buttons(s, it), blocking: it.blocks.slice(), blocked: blockers(s, it),
    // THE CODE TOGGLE, OFFERED OR NOT (goal/G27.3). Andy, 2026-10-17: "The code button should not be available in vision
    // items." The dialog draws its Code toggle from this: an item (never a goal or sub-goal) whose plugin, if any, does
    // not refuse the code press.
    codeOffered: !it.goal && !it.subGoal && !PLUGINS.some(function (p) { return !!pluginRefusal(p, 'press', { id: it.id, what: 'code' }); }),
    // His Go on record (goal/G3.9): true once he pressed go or go-all on it; an agent's claim never sets it.
    go: it.go === true,
    // THE STAR IS GONE (goal/G4.20 point 8). Andy: "ha ha, the red star has no function anymore. take it out."
    alone: it.alone, alert: it.alert === true,
    // DONE (n) (goal/G4.20 point 3): how many agents claimed done.
    claims: Object.keys(it.claims).length,
    // WHO HOLDS THE BOX (goal/G4.20 point 9), '' when nobody.
    boxTaken: it.boxTakenBy || '',
    // goal/G5.4: in limbo, and marked a sub-goal by a split.
    limbo: limboOf(s, it), subGoal: it.subGoal === true,
    // THE FILES TOUCHED (goal/G8.8) are item.files' own answer since goal/G32.2: a 142-file list in the facts made
    // every write to the item too large to come back. The facts say only how many.
    fileCount: filesOf(it).length,
    // DESIGN-GREEN (goal/G6.8): no open red question on it.
    green: !openQ(it),
    // goal/G5.7: the phase it is in, and who did each.
    code: it.code === true, phase: it.phase || '', red: it.red || '', builder: it.builder || '', verifier: it.verifier || '',
    // goal/G27.10: who created it, '' for an item from a session or before the creator was recorded.
    creator: it.creator || '',
    // goal/G19.13: the commits it was claimed at, the build's and the red's, '' while none was claimed with one.
    claimCommit: it.claimCommit || '', redCommit: it.redCommit || '',
    // goal/G2.22: whether the phase rules are lifted on it, so the dialog knows to stop offering Waive.
    waived: it.waived === true,
    // goal/G5.8: the rules in force at his Go, each { key, version }.
    rules: Array.isArray(it.rules) ? it.rules : [] };
  // ITS AGENTS BY NAME (goal/G21.1): every label these facts show, mapped to its name where its key has one.
  // goal/G21.6: every agent with an open take of one of his lines.
  f.names = namesFor(s, [it.with, it.boxTakenBy, it.red, it.builder, it.verifier, it.phaseWith]
    .concat(openTakes(it).map(function (l) { return l.taken; }), Object.keys(it.takers), Object.keys(it.files || {}), it.goal ? Object.keys(s.agentKey) : []));
  f.asks = asksOf(s, it);
  // THE BOX CAP (goal/G2.2 note 1). Andy: "there will be no second box per item. absolutely not.", "orange at 50%,
  // red at 75%". The box measured as its one answer against appClient.ANSWER_MAX: half from 50%, full from 75%;
  // nothing is refused below the answer limit, and the split is negotiated, never automated.
  const boxBytes = Buffer.byteLength(JSON.stringify({ box: it.box, version: it.version }), 'utf8');
  f.half = boxBytes >= appClient.ANSWER_MAX * 0.5;
  f.full = boxBytes >= appClient.ANSWER_MAX * 0.75;
  if (it.goal) {
    const g = s.goals[it.id];
    const now = Date.now();
    // THE PLUGIN THAT GOVERNS IT (goal/G22.3), by name, on a plugin's private goal alone, and the name of its inner tab
    // under Apps (pluginTab): the face gives each plugin it finds that tab. Since Andy's Apps ruling (2026-10-13) the
    // List draws the goal's title as plain text; "Apps replaces the label button".
    if (PLUGIN_GOAL[it.id]) { f.plugin = PLUGIN_GOAL[it.id]; f.pluginTab = PLUGIN_TAB[it.id] || f.plugin; }
    f.design = g.design;
    f.waiting = g.members.map(function (id) { return s.items[id]; }).concat([it]).filter(function (o) {
      // goal/G24.9: delete is on offer on running items now, and offering it is not Andy being waited on.
      return o && listed(s, o) && (buttons(s, o).filter(function (b) { return b !== 'delete'; }).length > 0 || asksOf(s, o) > 0);
    }).length;
    // AN AGENT NOT INCLUDED IS ABSENT (goal/G21.1), whatever it last wrote: out of live, named in excluded.
    f.excluded = Object.keys(s.agentKey).filter(function (l) { return excludedKey(s, s.agentKey[l]); }).sort();
    f.live = liveAgents(s).filter(function (l) { return f.excluded.indexOf(l) === -1; });
    // WHO IS WORKING (goal/G2.3): the live agents whose last word is working. A stale working clears with
    // liveness, since an ear killed by its limit or a node restart says nothing (Andy: "while an agent is
    // working, i should leave it alone.").
    f.working = f.live.filter(function (a) { return s.agentWord[a] === 'working'; });
    // ITS LIVE AGENTS' KEYS (goal/G2.2 note 6): the page draws the Team tabs from live and sends to these keys,
    // so an agent working only through item chat keeps its tab (found live: "still can't see you on desk").
    // SINCE goal/G4.29 EVERY AGENT THE DESK HAS SEEN, live or not (Andy: "can't reach it because ollama is gone", then
    // "yes" to the pane opening for every agent the desk knows), so an agent with no listener keeps its pane; live
    // still says who is here now.
    f.agents = {};
    Object.keys(s.agentKey).sort().forEach(function (a) { f.agents[a] = s.agentKey[a]; });
  }
  return f;
}

// (matchesText, the substring filter of items.search, went with goal/G18.5: items are ranked, not filtered.)

// The goal first, then its items in session order; the newest goal first.
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
  const goals = Object.keys(s.goals).filter(function (gid) { return !a.currentGoalOnly || gid === s.current; });
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
      // id, title, box and every chat line, case ignored; the answer is the row as before, never the box or the chat.
      // RANKED, NOT FILTERED (goal/G18.5): every listed item goes in with its probability; the bucket orders them.
      out.push({ probability: itemProbability(rawText, it, it.chat), json: JSON.stringify(facts(s, it)) });
    });
  });
  return out;
}

// ITEMS FOUND BY THEIR LINES (goal/G3.13), for the agents. Andy, 2026-10-03: "items can be searched with filters
// akin to the ones the current chat-search has", "the item search should consider searching chat items, on the
// deskServer side, and the resulting item titles (or keys) should be returned", "Server-Side searches can expand
// to chat-lines without cost to the wire", and "items.find" when asked for a second verb beside items.search.
// by, since and before are chat.search's filters on a line; text is found in a line, or, with no line filter set,
// in the item's id or title. Every goal's items and the goals, closed ones too (a search is not the List; Andy:
// "close is more of an 'visibility' issue than a process issue"), an abandoned goal's never. Ordered by the newest
// line that matched, newest first; an item matched by id or title alone comes after those, newest written first.
// SINCE goal/G18.5 THE TEXT RANKS, THE FILTERS STAY FILTERS: by, since and before still choose which lines count, and an
// item with none of them left is not offered while a line filter is set; the text gives each item its probability, the
// chat half over the lines the filters let through. Offered newest first, so among equal probabilities the newest leads.
function findItems(a) {
  const s = walkState();
  const text = String(a.text || '').trim();
  const lineFilter = !!(a.by || a.since || a.before);
  const lineMatches = function (l) {
    if (a.by && l.by !== a.by) return false;
    if (a.since && !(String(l.at) >= a.since)) return false;
    if (a.before && !(String(l.at) < a.before)) return false;
    return true;
  };
  const found = [];
  Object.keys(s.goals).forEach(function (gid) {
    if (s.goals[gid].abandoned) return;
    [gid].concat(s.goals[gid].members).forEach(function (id) {
      const it = s.items[id];
      if (!it) return;
      const lines = it.chat.filter(lineMatches);
      if (lineFilter && !lines.length) return;
      const newest = lines.length ? String(lines[lines.length - 1].at) : String(it.at || '');
      found.push({ at: newest, it: it, probability: itemProbability(text, it, lines) });
    });
  });
  const newestFirst = function (x, y) { return x.at < y.at ? 1 : x.at > y.at ? -1 : 0; };
  return found.sort(newestFirst).map(function (w) { return { probability: w.probability, json: JSON.stringify(facts(s, w.it)) }; });
}

function refused(code) { const e = new Error(code); e.refusal = code; return e; }
// A REFUSAL SAYS WHY (goal/G10.10). Andy, 2026-10-12: "all refusals everywhere should say why." A bare bad-request
// reached his dialog as "text required", the code's first wording, for an 81-byte title. The reason rides in
// extra.why, as a refused press's does (notOffered below), in words a person can act on.
function refusedWhy(code, why) { const e = refused(code); e.extra = { why: String(why) }; return e; }
// A FIELD RULE'S ANSWER IN WORDS: what was wrong with which field, and its bytes against the limit when it is the size.
function fieldWhy(what, value, paragraph) {
  const fr = require('../../../js/fieldRules.js');
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
    const held = blockers(st, it);
    if (held.length) return it.id + ' is blocked by ' + held.join(', ');
    if (it.went) return 'Go is already on record for ' + it.id;
    if (!it.goal && Object.keys(it.claims).length) return it.id + ' is claimed, so it offers Done, not Go';
  }
  if (what === 'make-current' && it.closed) return it.id + ' is closed; Reopen comes first';
  if (what === 'make-current' && PLUGIN_GOAL[it.id]) return it.id + ' is a plugin goal, a standing scope of the desk, and is never made the current goal';
  return what + ' is not among the buttons of ' + it.id + ' now (' + (offered.length ? offered.join(', ') : 'none') + ')';
}

// ── THE NUDGE, SERVER TO SERVER (goal/G3.5) ──────────────────────────
//
//   Andy, 2026-10-02: "so the desk server would nudge the deskClient server?" — and "accepted." to the design
//   that holds it. Until this the Desk page sent the nudge, after a press, and had to be open.
//
// One api packet {deskClient: {changed: {}}}, through the kernel, to the node of each agent a write is meant for;
// that agent's deskClient then asks what changed. Meant for: a write of Andy's, every agent (but his seen press,
// which no agent is handed); an agent's chat line, every other agent; a kept line of his, the agent it was for.
// An agent's own word (agent.state) nudges nobody: it would wake every other agent at every wait.
// NEVER HELD BY IT: the write has answered before the post leaves, and an agent whose node does not answer costs
// nothing but the wait below. A nudge that does not land is not repeated; the agent's own poll is the net.
// WHOM: an agent heard from in the last day, not only a live one (ten minutes): an agent that has waited quietly
// for longer than that is exactly the one a nudge is for.
const NUDGE_WAIT_MS = 10000;
const NUDGE_FOR_MS = 24 * 60 * 60 * 1000;
function nudgeKeys(s) {
  const now = Date.now();
  return Object.keys(s.agentsAt).filter(function (a) { return s.agentKey[a] && now - Date.parse(s.agentsAt[a]) < NUDGE_FOR_MS; })
    .map(function (a) { return s.agentKey[a]; });
}
function nudge(keys) {
  keys.filter(function (k, i) { return k && keys.indexOf(k) === i; }).forEach(function (key) {
    Promise.resolve().then(function () {
      return require('../../../js/kernel.js').peerPost(key, 'api', { deskClient: { changed: {} } }, { waitMs: NUDGE_WAIT_MS });
    }).catch(function () { /* the agent reads the state when it next asks */ });
  });
}
function nudgeForWrite(s, verb, a) {
  if (a.by === 'andy') {
    if (verb === 'press' && a.what === 'seen') return;
    // HIS ADDRESSED LINE NUDGES ITS ADDRESSEES ALONE (goal/G21.1): "only it is notified". So does his clear of a red Q,
    // addressed to the agent that placed it (goal/G21.2).
    if (Array.isArray(a.to)) { nudge(nudgeKeys(s).filter(function (k) { return a.to.indexOf(k) !== -1; })); return; }
    nudge(nudgeKeys(s));
  } else if (a.by !== 'desk' && verb === 'chat.add') {
    nudge(nudgeKeys(s).filter(function (k) { return k !== String(a.key || ''); }));
  }
}

// Every write: checked against the state as it stands, then recorded, then
// published to the page with the change it made ("no pulling").
function write(verb, a, check) {
  const s = walkState();
  const it = a.id !== undefined ? s.items[String(a.id)] : null;
  if (a.id !== undefined && verb !== 'session.set' && !it) throw refused('no-such-item');
  // goal/G21.1: an agent he has not included writes nothing, whichever verb carries it.
  mayWrite(s, { by: String(a.by || ''), key: String(a.key || '') });
  if (check) check(s, it);
  const body = Object.assign({}, a);
  delete body.by;
  delete body.key;
  // KEPT ONLY IF IT CAN COME BACK (the oversize suite; Andy: "why can't the system cleanly reject oversized
  // stuff?"). The write is taken inside a transaction, the state walked, and every panel it touched measured as
  // the answer that would carry it; one that no longer fits undoes the write and is refused by name.
  db.exec('BEGIN');
  let r;
  let after;
  try {
    r = addRecord.run(new Date().toISOString(), verb, String(a.by || ''), String(a.key || ''), JSON.stringify(body));
    after = walkState();
    const touched = verb === 'session.set' && body.session && body.session.goal
      ? [String(body.session.goal.id)].concat((body.session.items || []).map(function (x) { return String(x.id || ''); }))
      : a.id !== undefined ? [String(a.id)] : [];
    touched.forEach(function (id) {
      const bytes = largestPanel(after, id);
      if (bytes > ANSWER_ROOM) throw tooLarge(bytes, ANSWER_ROOM);
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  // NO LIMBO LINE (goal/G29.10, point 1: "The limbo posts go."). Limbo stays a mark in the item's facts; the desk
  // posts nothing under the item when it enters it.
  const gidW = it ? (it.goal ? it.id : it.goalId)
    : verb === 'session.set' && body.session && body.session.goal ? String(body.session.goal.id) : after.current;
  const gW = after.goals[gidW];
  let saidLimbo = false;
  // A HOLDER GONE STALE (goal/G5.7). Andy: "the deskServer throws a red question." Once per hold: a holder silent past
  // LIVE_MS gets one open red question on its item.
  if (gW) gW.members.forEach(function (id) {
    const m = after.items[id];
    if (!m || !m.code || !m.phaseWith || m.closed || m.done) return;
    const at = after.agentsAt[m.phaseWith];
    if (at && Date.now() - Date.parse(at) < LIVE_MS) return;
    if (m.checks.some(function (c) { return c.kind === 'Q' && c.state === 'open' && String(c.words).indexOf('stale:') === 0; })) return;
    write('check.add', { id: id, kind: 'Q', words: 'stale: ' + m.phaseWith + ' holds the ' + m.phase + ' of this item and has said nothing for 10 minutes. Free the phase, or wait?', test: '', by: 'desk', key: '' });
    saidLimbo = true;
  });
  // Said before this write publishes and writes the goal file, so both carry the line and the newest cursor.
  if (saidLimbo) after = walkState();
  const now = it ? after.items[it.id] : null;
  // THE CHANGE ITSELF TRAVELS (desk/G2.7, "no pulling"): the item's facts and
  // whether it is still on the List; a box write adds the box, a chat line the
  // line, a check its item's checks. The page paints from this.
  const out = { change: Number(r.lastInsertRowid), verb: verb, item: now ? facts(after, now) : null };
  if (now) out.listed = listed(after, now);
  // A line under a rule names its rule, as rule.add, rule.draft and rule.version do: the open rule dialog repaints
  // on a publish naming its rule (goal/G2.18).
  if (verb === 'rule.chat') out.rule = String(a.rule);
  if (now && verb === 'box.write') { out.box = now.box; out.version = now.version; }
  if (now && verb === 'chat.add') out.chat = shownLine(after, now.chat[now.chat.length - 1]);
  // THE CHECKS TRAVEL WHENEVER THEY CHANGED (goal/G18.5), not only on check.add and check.set: item.files.add raises
  // the core grant itself, and an open dialog that never heard of it showed no red button until it was reopened. Andy,
  // 2026-10-12: "the red grant Buttons don't show up automatically in deskDetail, i'd like that as well".
  const was = it ? s.items[it.id] : null;
  if (now && (verb === 'check.add' || verb === 'check.set' || !was || JSON.stringify(was.checks) !== JSON.stringify(now.checks))) out.checks = now.checks;
  // EVERY ROW IT CHANGED (desk/G3.10). Andy: "i just pressed the Go-All button in the list. and the G3.9 go button
  // didn't disarm." A press changes more than its own row (go-all, a done that unblocks, the goal's waiting), so the
  // facts of every row of the goal that differ now ride along, in this one object: one press, one object, never a
  // half-painted press (fileTransfer goal/G1.4 removed the publish coalescing; this ride-along never depended on it).
  if (it) out.rows = changedRows(s, after, it.goal ? it.id : it.goalId);
  // An agent's word changes the current goal's row (its working list), and that row travels (goal/G2.3).
  if (verb === 'agent.state' && after.current) out.rows = changedRows(s, after, after.current);
  appServer.spirit.core.jobs.publish(out);
  nudgeForWrite(after, verb, a);
  writeGoalFile(after, verb, a, Math.max(Number(r.lastInsertRowid), after.change));
  return after;
}

// THE FILE (goal/G3.14): written whole on his status changes, go, go-all, done, reopen and close (goal/G4.21: "a
// re-open would be subject to the same rule?"), and on session.set (items appear and leave by it; his open point,
// taken as yes); a line, a box, a claim or any other press leave it as it was. One object:
// the two cursors as changes answers them at this moment (change, and line, the newest line's rowid), the current
// goal's id, and every item of that goal, the goal's row and the closed ones included, each with its facts as
// item.get gives them, its box and version, its checks and its chat lines {by, at, text}. The group chat desk/G0.0
// is no item of the goal and is not in it. Written at the end of the write, after the publish, into this server's
// own state folder, never the checkout; then goalShare.js commits it on the remote's master and pushes it, as a job
// the node runs (goal/G4.21: an automation beside its owner, started through its own node's jobs.create, so Jobs
// shows it under process/js/desk). A failure to write or to ask is said on stderr and fails no press.
const newestLine = db.prepare('SELECT COALESCE(MAX(rowid), 0) AS rid FROM lines');
const GOAL_STATE_FILE = path.join(STATE, 'currentGoal.json');
function writeGoalFile(s, verb, a, change) {
  if (!GOAL_SHARED || !GOAL_REPO || !s.current || !s.goals[s.current]) return;
  // goal/G2.19 adds make-current: the file names the current goal in `goal` and carries that goal's items alone, so a
  // switch that did not rewrite it would leave every reader, the agents and the brain, on the goal he just left.
  const his = verb === 'press' && ['go', 'go-all', 'done', 'reopen', 'close', 'make-current'].indexOf(a.what) !== -1;
  if (!his && verb !== 'session.set') return;
  // ONLY THE CURRENT GOAL'S PRESSES (goal/G27.2, D6): a press on another goal or its items, a plugin goal's above all,
  // leaves the file alone, so mucking about Stacks pushes no new currentGoal.json. A make-current is the switch itself.
  const pressed = his ? s.items[String(a.id)] : null;
  if (pressed && a.what !== 'make-current' && pressed.id !== s.current && pressed.goalId !== s.current) return;
  const g = s.goals[s.current];
  const items = [s.current].concat(g.members).map(function (id) { return s.items[id]; }).filter(Boolean).map(function (it) {
    return Object.assign(facts(s, it), { box: it.box, version: it.version, checks: it.checks,
      chat: it.chat.map(function (l) { return { by: l.by, key: String(l.key || ''), at: l.at, text: l.text }; }) });
  });
  // NO writtenAt (goal/G19.6; the box: "goalShare's shared file without writtenAt, so an unchanged goal is not
  // committed again"): a clock in the file made every share new bytes, so goalShare's "same" never held. Nothing read
  // it; the commit carries its own time, and change and line still name the desk's moment.
  const doc = { change: change, line: Number(newestLine.get().rid) || 0, goal: s.current, items: items };
  try { fs.writeFileSync(GOAL_STATE_FILE, JSON.stringify(doc, null, 1) + '\n'); } catch (e) { console.error('desk: the goal file was not written: ' + ((e && e.message) || e)); return; }
  shareFile(GOAL_PATH, GOAL_STATE_FILE, 'currentGoal.json, shared by the desk (goal/G4.21)');
}
// The node runs goalShare.js as a job: asked at the node's door, SPIRIT_CALLBACK_URL (the one every spawned process
// speaks through), through the kernel as the nudge is (goal/G3.5), with the verb the shell's Start Job uses.
function shareFile(repoPath, fromFile, message) {
  const url = process.env.SPIRIT_CALLBACK_URL;
  if (!url) { console.error('desk: no SPIRIT_CALLBACK_URL, so the goal file is not shared'); return; }
  let base = '';
  try { base = new URL(url).origin; } catch (e) { console.error('desk: SPIRIT_CALLBACK_URL is no URL: ' + url); return; }
  Promise.resolve().then(function () {
    // Through the spirit object (goal/G32.3), as {status, body}.
    return spiritObject.outcome(spiritObject.forNode(base, 'jobs').then(function (s) {
      return s.jobs.create({ command: process.execPath,
        // A transient job (goal/G29.16): it leaves Jobs once it exited cleanly; a failed share stays, to be seen.
        args: [path.join(__dirname, 'goalShare.js'), '--repo', GOAL_REPO, '--path', repoPath, '--from', fromFile, '--message', message] });
    }));
  }).then(function (r) {
    if (!r || r.status >= 300) console.error('desk: the node refused the goal share: ' + (r ? r.status + ' ' + JSON.stringify(r.body) : 'no answer'));
  }).catch(function (e) { console.error('desk: the goal share was not asked: ' + ((e && e.message) || e)); });
}

// The goal and its items whose facts differ between two states, each with whether it is still listed.
function changedRows(before, after, goalId) {
  const g = after.goals[goalId];
  if (!g) return [];
  const seen = function (st, id) { const x = st.items[id]; return x ? JSON.stringify([facts(st, x), listed(st, x)]) : ''; };
  return [goalId].concat(g.members).filter(function (id) {
    return after.items[id] && seen(before, id) !== seen(after, id);
  }).map(function (id) {
    return Object.assign(facts(after, after.items[id]), { listed: listed(after, after.items[id]) });
  });
}

// HIS VOICE IS NO LONGER WRITTEN HERE (goal/G2.1 note 8). The plain file of what he typed (D5, desk/G1.4) was
// the hack he named on 2026-09-27; since apiAuth/G1's close the brain reads his Desk lines through this
// server's api, and the vault's own tool (claude/voiceFromDesk.js) keeps his corpus. No app writes into the vault.

// A goal is open while it is on the List. With none open, start-design (no id) makes goal/G<n>, n the next free.
function newGoal(w) {
  const st = walkState();
  // A plugin's goal is always open (goal/G22.3) and is no goal of his work: it never holds a new goal back.
  const open = Object.keys(st.goals).some(function (gid) { const g = st.items[gid]; return g && !PLUGIN_GOAL[gid] && listed(st, g) && !g.closed; });
  if (open) throw refusedWhy('bad-request', 'a goal is open already; close it before a new one starts');
  const used = Object.keys(st.goals).map(function (gid) { const m = /^goal\/G(\d+)$/.exec(gid); return m ? Number(m[1]) : 0; });
  const id = 'goal/G' + (Math.max.apply(null, [0].concat(used)) + 1);
  return write('session.set', { session: { goal: { id: id, title: 'New goal' }, items: [] }, by: w.by, key: w.key });
}

// A RULE AS rule.get ANSWERS IT, and as its writes publish it (goal/G27.9, S1: "rule writes publish the rule row"); null
// when there is none.
function ruleRow(key) {
  const r = newestRule.get(String(key));
  if (!r) return null;
  const d = getDraft.get(r.key);
  return { key: r.key, label: r.label, type: r.type, status: r.status, text: r.text, draft: d ? d.text : '', at: r.at, by: r.by };
}
const PRESSES = ['go', 'go-all', 'claim-done', 'done', 'reopen', 'close', 'bring-back', 'abandon', 'start-design', 'end-design', 'design-complete', 'seen', 'waive', 'make-current', 'code'];
// Andy's alone (G2.1 review). His presses carry the owner's caller (the
// mark the door forwards, apiAuth/G1.13); a member's are refused. The
// agents keep claim-done, design-complete and bring-back.
const OWNER_PRESSES = ['go', 'go-all', 'done', 'reopen', 'close', 'abandon', 'start-design', 'end-design', 'seen', 'waive', 'make-current', 'code'];
function ownerOnly(caller) { if (!caller || caller.owner !== true) throw refused('not-owner'); }

// IS THERE A deskVerify ON THIS NODE (goal/G8.3), which decides whether Done waits for it. Asked of this node, the
// port appServer hands every app server (spirit.core.node.const.SPIRIT_PORT; Andy: "DO NOT RE-INVENT this
// mechanism!!!!"), and kept, because buttons() is synchronous and runs on every read: the answer is refreshed in the
// background, never awaited. Until the first answer arrives the desk says no deskVerify, so Done behaves as it always
// has - a box with none, and every test suite that spawns a desk with no node, is that case for good.
let VERIFY_SEEN = { at: 0, there: false };
function hasDeskVerify() { return VERIFY_SEEN.there === true; }
// ONLY A PORT ITS OWN NODE NAMED (goal/G8.3, found by claude-windows verifying 58326ac7): appServer leaves SPIRIT_PORT
// at the kernel default, 65432, when no environment file names one - which is Andy node on both our boxes. A desk
// spawned by a suite would then ask HIS node whether a deskVerify runs, and on his box it does, so the test desk hid
// Done and two suites went red there while passing here. So the probe happens only when this node named a port.
function nodeNamedPort() {
  try {
    const env = JSON.parse(fs.readFileSync(appServer.spirit.core.node.const.SPIRIT_ENVIRONMENT_FILE, "utf8"));
    const p = Number(env && env.PORT);
    return Number.isInteger(p) && p > 0 ? p : 0;
  } catch (e) { return 0; }
}
function lookForDeskVerify() {
  const port = nodeNamedPort();
  if (!port) return;
  // The node's api tree, through the spirit object (goal/G32.3).
  spiritObject.forNode('http://127.0.0.1:' + port).then(function (s) { return s.tree(); }).then(function (body) {
    const apps = body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body) : [];
    VERIFY_SEEN = { at: Date.now(), there: apps.indexOf('deskVerify') !== -1 };
  }, function () { /* asked again on the next turn of the clock */ });
}
lookForDeskVerify();
const verifyWatch = setInterval(lookForDeskVerify, 60000);
if (verifyWatch && typeof verifyWatch.unref === 'function') verifyWatch.unref();

// THE NEXT ID THE DESK HANDS OUT (goal/G9.9), minted inside the write, from the state the write walked.
// A goal: one past the highest G<n> of the current goal's area, so an add in `goal/` never counts `other/`; with no
// current goal, the area is `goal`. An item: one past the highest <goal>.<n> the desk holds, closed and left-out ones
// counted, so an id is never handed out twice.
function areaOf(id) { const at = String(id).indexOf('/'); return at > 0 ? String(id).slice(0, at) : ''; }
function nextGoalId(s) {
  const area = areaOf(s.current) || 'goal';
  let top = 0;
  Object.keys(s.goals).forEach(function (id) {
    const m = /^([^/]+)\/G(\d+)$/.exec(id);
    if (m && m[1] === area) top = Math.max(top, Number(m[2]));
  });
  return area + '/G' + (top + 1);
}
function nextItemId(s, gid) {
  const head = String(gid) + '.';
  let top = 0;
  Object.keys(s.items).forEach(function (id) {
    if (id.indexOf(head) !== 0) return;
    const tail = id.slice(head.length);
    if (/^\d+$/.test(tail)) top = Math.max(top, Number(tail));
  });
  return head + (top + 1);
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
  // The one cut of a key, everywhere (G1.11): kernel.keyTail.
  return { by: label || require('../../../js/kernel.js').keyTail(caller.key), key: caller.key };
}

function doc(name) { const row = getDoc.get(name); return row ? row.json : '{}'; }
function saveDoc(name, json) {
  parsed(json);
  const bytes = Buffer.byteLength(JSON.stringify({ json: String(json) }), 'utf8');
  if (bytes > ANSWER_ROOM) throw tooLarge(bytes, ANSWER_ROOM);
  putDoc.run(name, String(json));
  return { saved: true };
}

// The walk behind `changes`: records first, then lines, each taken while the answer still fits ANSWER_ROOM. A
// record too big to travel even alone goes with an empty body, so the cursor still passes it and the reader asks
// the item's panels instead.
const recordsAfter = db.prepare('SELECT n, at, verb, by, key, body FROM records WHERE n > ? ORDER BY n');
const linesAfter = db.prepare('SELECT rowid AS rid, line FROM lines WHERE rowid > ? ORDER BY rowid');
// ONLY THE ADDRESSED AGENT IS NOTIFIED (goal/G21.1): an agent reading changes (viewer, its key) is not handed his
// line addressed to other keys; the cursor passes it all the same. He reads everything. The line is still in the
// item's chat, for any agent that looks. His clear of a red Q (a check.set addressed to its placer, goal/G21.2) the same.
function addressedAway(r, viewer) {
  if (!viewer || (r.verb !== 'chat.add' && r.verb !== 'check.set') || r.by !== 'andy' || String(r.body).indexOf('"to":[') === -1) return false;
  try { const b = JSON.parse(r.body); return Array.isArray(b.to) && b.to.indexOf(viewer) === -1; } catch (e) { return false; }
}
function changesSince(n, line, viewer) {
  const out = { records: [], lines: [], n: n, line: line, more: false };
  const size = function () { return Buffer.byteLength(JSON.stringify(out), 'utf8'); };
  for (const r of recordsAfter.iterate(n)) {
    if (addressedAway(r, viewer)) { out.n = r.n; continue; }
    const rec = { n: r.n, at: r.at, verb: r.verb, by: r.by, key: r.key, body: r.body };
    out.records.push(rec);
    out.n = r.n;
    if (size() <= ANSWER_ROOM) continue;
    if (out.records.length === 1) { rec.body = ''; if (size() <= ANSWER_ROOM) continue; }
    out.records.pop();
    out.n = out.records.length ? out.records[out.records.length - 1].n : n;
    out.more = true;
    return out;
  }
  for (const l of linesAfter.iterate(line)) {
    let obj = {};
    try { obj = JSON.parse(l.line) || {}; } catch (e) { obj = {}; }
    obj.line = l.rid;
    out.lines.push(obj);
    out.line = l.rid;
    if (size() <= ANSWER_ROOM) continue;
    out.lines.pop();
    out.line = out.lines.length ? out.lines[out.lines.length - 1].line : line;
    out.more = true;
    return out;
  }
  return out;
}

// ── MOUNTING THE PLUGINS (goal/G22.3) ────────────────────────────────
//
//   Andy, 2026-10-13, in the item's box: "Mount every plugin in desk's plugin folder, organized with the same pattern as
//   shell apps and processes.", and "each plugin's server half at spirit/run/process/js/desk/plugins/js/<name>/<name>.js
//   with its .json beside it".
//
// A plugin is the folder plugins/js/<name>/ holding <name>.js and <name>.json, as a process is process/js/<name>/: no
// .json, no plugin. Mounted in name order, once, before the desk serves. A suite names a further folder in the
// suite-only value pluginsMore (as it injects boxHoldMs), mounted after the desk's own.
//
// THE CONTRACT. <name>.js exports function (desk) -> { refuses, handles, verbs }, every part optional:
//   refuses(verb, args, ids)        the plugin's word on a call, '' to let it pass, else why it is refused. Asked
//                                   first, before the desk's own handler, for EVERY verb, and asked again for every
//                                   button drawn (buttons()), so it must be quick and pure: ids are the item and goal
//                                   ids the call names (idsOfCall).
//   handles(verb, args, caller)     after no refusal: a reply to take the call itself, undefined to let the desk go on.
//   verbs                           its own verbs, each named <name>.<verb>, served by the desk beside its own.
// desk (pluginDesk) hands it its goal's key and the desk's own writes, never the database.
// On its first mount the desk gives it its private goal, plugin/<name>, by one goal.add record written as desk; the
// replay keeps it, so a later start finds it and mints nothing.
const PLUGIN_DIRS = [path.join(__dirname, 'plugins', 'js')].concat(values.pluginsMore ? [path.resolve(String(values.pluginsMore))] : []);
function pluginRefusal(p, verb, a, ids) {
  if (typeof p.refuses !== 'function') return '';
  return String(p.refuses(verb, a || {}, ids || idsOfCall(verb, a)) || '');
}
// The item and goal ids a call names: id, goal and blocks, and a session's goal and items.
function idsOfCall(verb, a) {
  const out = [];
  if (!a || typeof a !== 'object') return out;
  ['id', 'goal', 'blocks'].forEach(function (k) { if (typeof a[k] === 'string' && a[k]) out.push(a[k]); });
  if (verb === 'session.set') {
    try {
      const sess = JSON.parse(String(a.json));
      if (sess && sess.goal && sess.goal.id) out.push(String(sess.goal.id));
      (sess && Array.isArray(sess.items) ? sess.items : []).forEach(function (x) { if (x && x.id) out.push(String(x.id)); });
    } catch (e) { /* the handler refuses it */ }
  }
  return out;
}
// What a plugin is handed: its name and goal, and the desk's own writes and rules. write is the desk's write as the desk
// itself (as the limbo line is written); writeAs writes as the caller the door forwarded. A check given to either runs
// against the state as it stands, and may set fields of the body it was given before the record is kept (minted).
// SINCE goal/G22.3's "RUN the show" (Andy, 2026-10-13): stateDir, the plugin's own folder under the desk's --state
// (plugins/<name>/, never in git, as desk.db is not: D5 above), and publish(data), which says data on the desk's stream
// as { plugin: <name>, data }: no change, no item, no rows, so the face's List never paints it, and only the plugin's
// own UI, which subscribes itself, reads it.
function pluginDesk(name, manifest) {
  const goal = pluginGoalKey(name);
  return {
    name: name, goal: goal, manifest: manifest,
    stateDir: path.join(STATE, 'plugins', name),
    publish: function (data) { return appServer.spirit.core.jobs.publish({ plugin: name, data: data }); },
    state: walkState,
    inGoal: function (id) { return inGoalOf(goal, id); },
    write: function (verb, body, check) { body.by = 'desk'; body.key = ''; return write(verb, body, check); },
    writeAs: function (verb, body, caller, check) { const w = writerOf(caller); body.by = w.by; body.key = w.key; return write(verb, body, check); },
    writerOf: writerOf,
    refused: refusedWhy,
    fieldRules: require('../../../js/fieldRules.js'),
    fieldWhy: fieldWhy,
    nextItemId: nextItemId,
    // SINCE goal/G22.3 (Andy, 2026-10-13: "every run here should report to deskVerify."): one verb of this node's
    // deskVerify, by its verbs on the node's flat apiDoor, as lookForDeskVerify asks the node; only a port its own node named,
    // never the kernel default (goal/G8.3). Resolves deskVerify's answer, rejects with its why.
    verify: function (verb, args) {
      const port = nodeNamedPort();
      if (!port) return Promise.reject(refusedWhy('bad-request', 'this desk\'s node named no port, so no deskVerify can be asked'));
      // Through the spirit object (goal/G32.3), as {status, body}; made again when deskVerify came up after it.
      return spiritObject.outcome(spiritObject.forNode('http://127.0.0.1:' + port, 'deskVerify').then(function (s) { return s.call('deskVerify.' + verb, args || {}); })).then(function (r) {
        const b = r && r.body;
        if (r && r.status === 200 && b && typeof b === 'object' && b.ok !== false) return b;
        const why = b && b.extra && b.extra.why ? b.extra.why : (b && (b.error || b.code)) || ('status ' + (r && r.status));
        throw refusedWhy('bad-request', 'deskVerify did not take ' + verb + ': ' + why);
      }, function (e) { throw refusedWhy('bad-request', 'no deskVerify answers on this node: ' + ((e && e.message) || e)); });
    },
  };
}
function mountPlugins() {
  const seen = Object.create(null);
  PLUGIN_DIRS.forEach(function (dir) {
    let names = [];
    try { names = fs.readdirSync(dir).sort(); } catch (e) { return; }
    names.forEach(function (name) {
      const js = path.join(dir, name, name + '.js');
      const json = path.join(dir, name, name + '.json');
      if (seen[name] || !/^[A-Za-z][A-Za-z0-9_-]{0,47}$/.test(name) || !fs.existsSync(js) || !fs.existsSync(json)) return;
      let manifest = null;
      try { manifest = JSON.parse(fs.readFileSync(json, 'utf8')); } catch (e) { console.error('desk: plugin ' + name + ': its .json does not parse; not mounted'); return; }
      seen[name] = true;
      const goal = pluginGoalKey(name);
      try {
        // ITS PRIVATE GOAL, ON ITS FIRST MOUNT: the fixed key, the title its manifest gives.
        if (!walkState().goals[goal]) write('goal.add', { title: String((manifest && (manifest.goal || manifest.label)) || name), minted: goal, by: 'desk', key: '' });
        PLUGIN_GOAL[goal] = name;
        PLUGIN_TAB[goal] = String((manifest && (manifest.tab || manifest.label)) || name).slice(0, 32);
        const made = require(js)(pluginDesk(name, manifest)) || {};
        const verbs = made.verbs && typeof made.verbs === 'object' ? made.verbs : {};
        Object.keys(verbs).forEach(function (v) { if (v.indexOf(name + '.') !== 0) throw new Error('its verb ' + v + ' is not named ' + name + '.<verb>'); });
        PLUGINS.push({ name: name, goal: goal, refuses: made.refuses, handles: made.handles, verbs: verbs });
      } catch (e) {
        console.error('desk: plugin ' + name + ' was not mounted: ' + ((e && e.message) || e));
      }
    });
  });
}
// EVERY VERB SEEN FIRST BY THE PLUGINS (goal/G22.3), in mount order: a refusal names the plugin and its goal, and is
// the desk's not-offered with its why, as every refused press is; a plugin that takes the call answers it. Then the
// desk's own handler. The plugins' verbs join the table; one that would shadow a desk verb stops the start.
// HIS LINES IN A PHASE HOLDER'S REPLIES (goal/G29.10, point 2: "A write an agent makes while holding a phase answers
// with Andy's lines typed since it took the phase."). An agent at work does not listen, so every write it makes under
// the item whose phase it holds answers with `andy`, his lines there since its phase take, newest kept within
// HEARD_ROOM bytes. A write is an answer carrying its change.
const HEARD_ROOM = 8192;
function heard(a, caller, out) {
  if (!caller || !a || a.id === undefined) return out;
  return Promise.resolve(out).then(function (o) {
    if (!o || typeof o !== 'object' || typeof o.change !== 'number') return o;
    // The write is done: a caller the desk cannot name gets its answer as it is.
    let w = null;
    try { w = writerOf(caller); } catch (e) { return o; }
    if (w.by === 'andy') return o;
    const it = walkState().items[String(a.id)];
    if (!it || !holdsPhase(it, w)) return o;
    const lines = [];
    let room = HEARD_ROOM;
    for (let i = it.chat.length - 1; i >= 0; i--) {
      const l = it.chat[i];
      if (String(l.at || '') <= String(it.phaseAt || '')) break;
      if (l.by !== 'andy') continue;
      const one = { at: String(l.at), text: String(l.text) };
      room -= Buffer.byteLength(JSON.stringify(one), 'utf8');
      if (room < 0) break;
      lines.unshift(one);
    }
    o.andy = lines;
    return o;
  });
}
function withPlugins(verbs) {
  const all = {};
  Object.keys(verbs).forEach(function (verb) {
    const v = verbs[verb];
    all[verb] = Object.assign({}, v, { handler: function (a, caller) {
      const ids = idsOfCall(verb, a);
      for (const p of PLUGINS) {
        const no = pluginRefusal(p, verb, a, ids);
        if (no) throw refusedWhy('not-offered', 'the ' + p.name + ' plugin governs ' + p.goal + ': ' + no);
        const took = typeof p.handles === 'function' ? p.handles(verb, a, caller) : undefined;
        if (took !== undefined) return took;
      }
      return heard(a, caller, caller === undefined ? v.handler(a) : v.handler(a, caller));
    } });
  });
  PLUGINS.forEach(function (p) {
    Object.keys(p.verbs).forEach(function (v) {
      if (all[v]) throw new Error('desk: plugin ' + p.name + ' declares ' + v + ', which the desk has already');
      all[v] = p.verbs[v];
    });
  });
  return all;
}
mountPlugins();

appServer.serve(withPlugins({
  'log.add': {
    request: { json: '' }, reply: { added: true },
    handler: function (a) {
      const l = parsed(a.json);
      if (typeof l.key !== 'string' || !l.key) throw new Error('a line needs its key');
      // Refused, never stored to stall a read later (slim/G1.2 T4).
      if (!fitsOneAnswer(l.key, a.json)) throw tooLarge(oneAnswerBytes(l.key, a.json), ANSWER_ROOM);
      const r = addLine.run(l.key, String(l.at || ''), String(l.todo || ''), String(l.from || ''), String(l.kind || ''), String(l.text || ''), a.json);
      // A line of Andy's nudges the agent it was for, and nobody else (goal/G3.5).
      // THE LINE TRAVELS (goal/G27.9, S1): "log.add publishes its line", so a page shows it without asking again.
      if (r.changes === 1) appServer.spirit.core.jobs.publish({ log: { key: String(l.key), at: String(l.at || ''), todo: String(l.todo || ''), from: String(l.from || ''), kind: String(l.kind || ''), peer: String(l.peer || ''), text: String(l.text || '') } });
      if (r.changes === 1 && l.from === 'andy' && l.peer) {
        nudge(nudgeKeys(walkState()).filter(function (k) { return k === String(l.peer); }));
      }
      return { added: r.changes === 1 };
    },
  },
  // THROUGH THE BUCKET (slim/G1.2 T1): the walk is ours (SQL's filters,
  // newest first), the cut and `more` are the probability bucket's (ranked()).
  'log.search': {
    request: { text: '', todo: '', since: '', kind: '', before: '' }, reply: { items: [{ key: '', label: '' }], more: false },
    handler: function (a) {
      const todo = a.todo === '-' ? '' : a.todo;
      // SINCE goal/G18.5 THE TEXT RANKS THE LINES; the SQL keeps the other filters and gives newest first.
      const text = String(a.text || '').trim();
      const rows = findLines.iterate(a.todo, todo, a.kind, a.kind, a.since, a.since, a.before, a.before, '', '');
      const walk = (function* () {
        for (const row of rows) {
          let line = null;
          try { line = JSON.parse(row.line); } catch (e) { line = null; }
          yield { probability: text ? probabilityStringMatch(text, String((line && line.text) || row.line)) : 0, pair: { key: row.key, label: row.line } };
        }
      })();
      return ranked(walk, ANSWER_ROOM);
    },
  },
  // WHAT CHANGED SINCE (apiAuth/G1.12). Andy: "dsek needs an interface for that. desk can't serve agents at
  // different locations otherwise", and "yes on the verb". The records after change n and the lines after rowid
  // line, oldest first, as many as one answer holds; n and line come back as the cursors to resume from. Rowids,
  // not times: two lines can share one at, and a time cursor would re-read or miss them.
  'changes': {
    // A line is the object Desk stored, whatever keys it has, plus its rowid as line: so lines is an open list.
    request: { n: 0, line: 0 }, reply: { records: [{ n: 0, at: '', verb: '', by: '', key: '', body: '' }], lines: [], n: 0, line: 0, more: false },
    handler: function (a, caller) {
      const viewer = caller && caller.owner !== true && typeof caller.key === 'string' ? caller.key : '';
      return changesSince(Number(a.n) || 0, Number(a.line) || 0, viewer);
    },
  },
  // One party's queue, newest first, through the same bucket.
  'pending.get': {
    request: { who: '' }, reply: { items: [{ key: '', label: '' }], more: false },
    handler: function (a) {
      return walked(pending(String(a.who)), function (item) { return { key: JSON.parse(item).id, label: item }; });
    },
  },
  // ── WHAT THE LIST AND THE DIALOG READ (desk/G2.1) ─────────────────
  // Andy: "nice verb names! can use them an many seaches. aprooved."
  // Each label is one item's facts as JSON; the goal's row also carries
  // design mode, the waiting-on-you count and the live agents.
  'items.search': {
    request: { text: '', currentGoalOnly: false, goalsOnly: false, includeClosed: false }, reply: { items: [{ key: '', label: '' }], more: false },
    handler: function (a) {
      return ranked(searchItems(a).map(function (x) { return { probability: x.probability, pair: { key: JSON.parse(x.json).id, label: x.json } }; }), ANSWER_ROOM);
    },
  },
  // EACH PANEL ITS OWN ANSWER. Andy: "what kind of app doesn't measure the sum of its packets?" and "lazy load the
  // panels when thy open". item.get is the item's facts; its box, checks and chat are asked for each on its own, so
  // no answer carries the sum of them and each fits one answer by itself.
  // A SEARCH FOR THE AGENTS (goal/G3.13): items by their lines, half a room like chat.search, a read.
  'items.find': {
    request: { text: '', by: '', since: '', before: '' }, reply: { items: [{ key: '', label: '' }], more: false },
    handler: function (a) {
      return ranked(findItems(a).map(function (x) { return { probability: x.probability, pair: { key: JSON.parse(x.json).id, label: x.json } }; }), SEARCH_ROOM);
    },
  },
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
  // THE FILES TOUCHED, ITS OWN ANSWER (goal/G32.2), as item.chat is: { path, by, core } (goal/G8.8; core read from
  // js/coreFiles.js, the one list commitCheck locks), core files first, then by path; as many as fit one answer, and
  // filesMore says there were more. Nothing pages. under, when given, keeps the paths that start with it (deskVerify asks
  // spirit/test/ for an item's suites, which a long list of core files would push past the room).
  'item.files': {
    request: { id: '', under: '' }, reply: { files: [{ path: '', by: '', core: false }], filesMore: false },
    // under is optional: {id} alone answers the whole list, as the Details and deskAgent ask it.
    accepts: function (x) {
      return !!x && typeof x === 'object' && !Array.isArray(x) && typeof x.id === 'string' &&
        Object.keys(x).every(function (k) { return k === 'id' || (k === 'under' && typeof x.under === 'string'); });
    },
    handler: function (a) {
      const it = walkState().items[String(a.id)];
      if (!it) throw refused('no-such-item');
      const under = typeof a.under === 'string' ? a.under : '';
      const all = filesOf(it).filter(function (e) { return !under || e.path.indexOf(under) === 0; });
      const order = all.filter(function (e) { return e.core; }).concat(all.filter(function (e) { return !e.core; }));
      const room = ANSWER_ROOM - Buffer.byteLength(JSON.stringify({ filesMore: true }), 'utf8');
      const found = walked(order.map(function (e, i) { return i; }), function (i) { return { key: String(i), label: JSON.stringify(order[i]) }; }, room);
      const files = found.items.map(function (p) { return JSON.parse(p.label); });
      return { files: files, filesMore: files.length < order.length };
    },
  },
  'item.checks': {
    request: { id: '' }, reply: { checks: [{ number: '', kind: '', words: '', test: '', state: '', by: '', at: '' }] },
    handler: function (a) {
      const it = walkState().items[String(a.id)];
      if (!it) throw refused('no-such-item');
      return { checks: shownChecks(it) };
    },
  },
  // THE CHAT IS A SEARCH (desk/G3.3). Andy: "why would the server not use bucket to give me the most recent
  // stuff?" Its newest lines, through the same bucket, in a whole answer of its own; oldest first.
  'item.chat': {
    // goal/G21.1: each line carries its writer's key and name beside its label (by).
    request: { id: '' }, reply: { chat: [{ by: '', at: '', text: '', taken: '', key: '', name: '' }], chatMore: false },
    handler: function (a) {
      const st = walkState();
      let it = st.items[String(a.id)];
      // A rule's chat (goal/G5.5) is read the same way, from its records.
      if (!it && /^rule\/\d+$/.test(String(a.id)) && newestRule.get(String(a.id))) {
        const lines = ruleChatRows.all().map(function (r) { const b = JSON.parse(r.body); return b.rule === String(a.id) ? { by: r.by, at: r.at, text: String(b.text), taken: '', key: String(r.key || '') } : null; }).filter(Boolean);
        it = { chat: lines };
      }
      if (!it) throw refused('no-such-item');
      it = { chat: it.chat.map(function (l) { return shownLine(st, l); }) };
      // goal/G29.21: newest first through walked() in CHAT_ROOM; a line too big for the room on its own is never
      // offered: it would close the answer with nothing in it (claude-windows's review).
      const newest = [];
      for (let i = it.chat.length - 1; i >= 0; i--) newest.push(i);
      const found = walked(newest, function (i) { return { key: String(i), label: JSON.stringify(it.chat[i]) }; }, CHAT_ROOM);
      const chat = found.items.map(function (p) { return JSON.parse(p.label); }).reverse();
      return { chat: chat, chatMore: chat.length < it.chat.length };
    },
  },
  // A SEARCH ON AN ITEM'S CHAT LINES (goal/G3.11), for the agents. Andy: "a search on the chat lines of
  // 'desk/G0.0'", "with time boundaries etc.... just for you agents", then "why dont you generalize the search so
  // you can do it to the chat lines for any item in desk?" — so id names the item, the group chat among them.
  // The filters are the four he asked wsl-claude to name: text (found in the line, whatever the case), by (who
  // wrote it), since (from that time on), before (earlier than that time); one left empty filters nothing.
  // The newest lines that match, through the same bucket, in half an answer (SEARCH_ROOM). NOTHING PAGES AND
  // NOTHING IS JOINED: more says there were more, and the agent narrows (before = the oldest time it got).
  // A read: it writes no record.
  // goal/G29.21: scope '' or 'goal' searches the id's own chat; 'items' on a goal searches the goal's chat and every
  // one of its items' chats, ranked together. Each line's label carries item, the id it was said in, which the goal
  // dialog draws as a link to that item; across chats the key is item#index, so keys stay unique.
  'chat.search': {
    request: { id: '', text: '', by: '', since: '', before: '', scope: '' }, reply: { items: [{ key: '', label: '' }], more: false },
    handler: function (a) {
      const st = walkState();
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
          if (a.since && !(String(l.at) >= a.since)) continue;
          if (a.before && !(String(l.at) < a.before)) continue;
          lines.push({ item: c, i: i, l: l });
        }
      });
      if (across) lines.sort(function (x, y) { return x.l.at < y.l.at ? 1 : x.l.at > y.l.at ? -1 : 0; });
      // goal/G21.1: the writer's key and name ride with its label; with a scope, the item it was said in too.
      const walk = lines.map(function (x) {
        const l = x.l;
        const label = { by: l.by, key: String(l.key || ''), name: nameOfKey(st, l.key), at: l.at, text: l.text };
        if (scope) label.item = x.item;
        return { probability: lineProbability(text, l), pair: { key: across ? x.item + '#' + x.i : String(x.i), label: JSON.stringify(label) } };
      });
      return ranked(walk, SEARCH_ROOM);
    },
  },
  // ── THE WRITES: no verb takes `by` any more (apiAuth/G1.13) — the
  // writer is the caller the door forwarded and appServer handed in,
  // so nobody names their own writer. A by argument fails the request
  // shape and is refused no-such-argument, which is the point.
  'session.set': {
    request: { json: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      const w = writerOf(caller);
      const sess = parsed(a.json);
      if (!sess.goal || !sess.goal.id || !Array.isArray(sess.items)) throw new Error('a session needs its goal and items');
      return { change: write('session.set', { session: sess, by: w.by, key: w.key }, function (st) {
        // goal/G29.21, decided by Andy: an agent's session creates no goal, and the new items it brings need his
        // "add item" (one) or "add items" (several), as item.add does (addGrantOf).
        if (w.by === 'andy') return;
        if (!st.goals[String(sess.goal.id)]) throw refusedWhy('not-granted', 'an agent creates a goal only through goal.add, while Andy\'s newest line says "add goal"');
        const fresh = newItemsOf(st, sess);
        const here = st.addGrantGoal === String(sess.goal.id);
        if (fresh && !(here && (st.addGrant === -1 || (st.addGrant === 1 && fresh === 1)))) throw refusedWhy('not-granted', 'this session brings ' + fresh + ' new item(s); an agent adds items only while Andy\'s newest line, written in this goal, says "add item" (one) or "add items" (several)');
      }).change };
    },
  },
  // ONE GOAL, ONE ITEM, AND THE DESK NAMES IT (goal/G9.9). Andy, 2026-10-07: "the desk owns (is in charge of) goal and
  // item ID's.", and "why should the agents need to, they can use the same api's the user needs to create them." So the
  // same two verbs serve him and the agents, the id comes back in the answer, and nobody sends one: an `id` argument is
  // refused by the door as no-such-argument. Decided by Andy; rule/9 governs when the bulk session.set may be used
  // instead. An add never moves the current goal (goal/G9.13).
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
  // The title obeys the label rules, as every label does (js/fieldRules.js).
  'item.add': {
    request: { goal: '', title: '', blocks: '' }, reply: { id: '', change: 0 },
    accepts: function (x) {
      if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
      const known = ['goal', 'title', 'blocks'];
      return Object.keys(x).every(function (k) { return known.indexOf(k) !== -1; }) &&
        typeof x.goal === 'string' && typeof x.title === 'string' && (x.blocks === undefined || typeof x.blocks === 'string');
    },
    handler: function (a, caller) {
      const w = writerOf(caller);
      const gid = String(a.goal || '');
      const title = String(a.title || '').trim();
      if (!title) throw refusedWhy('bad-request', 'an item needs a title');
      if (fieldWhy('title', title)) throw refusedWhy('bad-request', fieldWhy('title', title));
      const args = { goal: gid, title: title, by: w.by, key: w.key };
      if (a.blocks !== undefined && String(a.blocks)) args.blocks = String(a.blocks);
      const r = write('item.add', args, function (st) {
        if (!st.goals[gid] || !st.items[gid]) throw refused('no-such-item');
        // AN AGENT ADDS UNDER HIS WORDS (goal/G29.21), decided by Andy: see addGrantOf.
        if (w.by !== 'andy' && !(st.addGrant && st.addGrantGoal === gid)) throw refusedWhy('not-granted', 'an agent adds an item only while Andy\'s newest line, written in this goal, says "add item" (one) or "add items" (several); propose it to him instead');
        // A NEW ITEM IS CODE (goal/G29.21), unless its plugin refuses the code press (a vision item). Carried in the
        // record, so the items added before this replay as they were.
        args.code = !PLUGINS.some(function (p) { return !!pluginRefusal(p, 'press', { id: gid, what: 'code' }); });
        if (args.blocks) {
          const b = st.items[args.blocks];
          // Its own goal, or one of that goal's items: an item never blocks across goals.
          if (!b || (args.blocks !== gid && b.goalId !== gid)) throw refused('no-such-item');
        }
        args.minted = nextItemId(st, gid);
      });
      return { id: args.minted, change: r.change };
    },
  },
  // BLOCK, UNBLOCK AND THEIR TARGETS (goal/G27.5). The gate refuses, saying why, before anything is written.
  'block': {
    request: { id: '', blocks: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      const w = writerOf(caller);
      const from = String(a.id || '');
      const to = String(a.blocks || '');
      const r = write('block', { id: from, blocks: to, by: w.by, key: w.key }, function (st) {
        mayWrite(st, w);
        const why = blockWhy(st, from, to);
        if (why) throw refusedWhy('bad-request', why);
      });
      return { change: r.change };
    },
  },
  'unblock': {
    request: { id: '', blocks: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      const w = writerOf(caller);
      const from = String(a.id || '');
      const to = String(a.blocks || '');
      const r = write('unblock', { id: from, blocks: to, by: w.by, key: w.key }, function (st, it) {
        mayWrite(st, w);
        if (!it || it.goal) throw refused('no-such-item');
        if (it.blocks.indexOf(to) === -1) throw refusedWhy('bad-request', from + ' does not block ' + to);
        if (to === it.goalId) throw refusedWhy('bad-request', 'blocking the goal is the fallback of an item blocking nothing else, and is not unblocked');
      });
      return { change: r.change };
    },
  },
  // What an item may block: the add drop-down's list (R7, R10), the gate's own rule, through the bucket.
  'block.targets': {
    request: { id: '' }, reply: { items: [{ key: '', label: '' }], more: false },
    handler: function (a) {
      const st = walkState();
      const from = String(a.id || '');
      const it = st.items[from];
      if (!it || it.goal) throw refused('no-such-item');
      const g = st.goals[it.goalId];
      // goal/G29.21: in goal order through the probability bucket (walked).
      const open = ((g && g.members) || []).filter(function (id) { return st.items[id] && !blockWhy(st, from, id); });
      return walked(open, function (id) { return { key: id, label: String(st.items[id].title || '') }; });
    },
  },
  // Andy: "the FIRST text wins, all subsequent actions are alterations and
  // corrections." An alteration names the version it was written against and
  // is refused if the box has moved on, so nothing is silently overwritten.
  'box.write': {
    request: { id: '', text: '', version: 0 }, reply: { change: 0, version: 0 },
    handler: function (a, caller) {
      const w = writerOf(caller);
      // A box that could not come back whole in item.box is refused here, as chat.add refuses such a line.
      const boxBytes = Buffer.byteLength(JSON.stringify({ box: String(a.text), version: 0 }), 'utf8');
      if (boxBytes > ANSWER_ROOM) throw tooLarge(boxBytes, ANSWER_ROOM);
      // AN OPEN POINT IS A RED QUESTION, NEVER BOX TEXT (goal/G6.8). Andy: "in design mode as well, OPEN is help in
      // red-questions". A line starting with OPEN in capitals is refused, his own too.
      if (/^OPEN(?:\b|:)/m.test(String(a.text))) throw refusedWhy('bad-request', 'a line starting OPEN is not box text: an open point is a Q check');
      const s = write('box.write', Object.assign({}, a, { by: w.by, key: w.key }), function (st, it) {
        // ONLY THE TAKER WRITES while a box take stands (goal/G4.20 point 9). ONE RULE FOR EVERYBODY SINCE goal/G9.3:
        // Andy, 2026-10-07, asked whether his own take refuses an agent until he leaves the box: "yes. so it shoule be
        // among agents as well, the box is taken, and released after edit. it also helps agents stay out of each others
        // way." So his write is refused over another's take as an agent's is; he was the exception until then.
        // By key since goal/G21.1: a hold his nick request started is that agent's one write, his own included.
        if (it.boxTakenBy && !holdsBox(it, w)) throw refused('taken');
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
      if (['C', 'T', 'G', 'Q'].indexOf(a.kind) === -1) throw new Error('a check is C, T, G or Q');
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
      if (['open', 'passed', 'failed', 'granted', 'answered'].indexOf(a.state) === -1) throw new Error('a check is open, passed, failed, granted or answered');
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
      // A RULE'S CHAT (goal/G5.5): Andy: "in this chat, the agents may propose alterations to parts of the rule, or
      // advocate for status changes for this rule." A record of its own, no item.
      if (/^rule\/\d+$/.test(String(a.id))) {
        if (!newestRule.get(String(a.id))) throw refused('no-such-item');
        const lineBytes = chatLineBytes(0, { by: w.by, at: new Date().toISOString(), text: String(a.text), taken: '' });
        if (lineBytes > CHAT_ROOM) throw tooLarge(lineBytes, CHAT_ROOM);
        return { change: write('rule.chat', { rule: String(a.id), text: String(a.text), by: w.by, key: w.key }).change };
      }
      // MAX_PAYLOAD AT THE DOOR (desk/G3.3). Andy: "in the db yes, but in the sent messages ther MUST be a MAX_PAYLOAD".
      // A line that could not come back whole in one answer is refused here, as log.add refuses one; the sender slices it.
      const st0 = walkState();
      const it0 = st0.items[String(a.id)];
      mayWrite(st0, w);
      // ONLY THE TAKER ANSWERS while a take stands (goal/G2.2 note 2); his own lines, and the desk's, are never refused.
      // By key since goal/G21.1, so an agent bound by his nick before the desk ever heard from it answers too.
      // Since goal/G21.6 a take is per line: mine is an open take of one of his lines under the item by this agent.
      const mine = !!(it0 && holdsTake(it0, w));
      // AN AGENT ANSWERS ONLY WHAT IT HAS TAKEN (goal/G18.8). Andy, 2026-10-12: "no agent should answer without taking.
      // too much chatter otherwise."; and, to its own work notes going under an item it holds: "yes."
      // THE CHAT FLOW (goal/G21.4). Andy, in the item's box: "Each of Andy's lines is taken by one agent and answered by
      // that agent alone; no other agent chimes in once it is taken.", "An agent's answer is never takeable", and "An
      // agent may post its own work notes (taking, built, claimed) on an item it holds; they are valued work logs and are
      // not answers, so the chat flow does not stop them." The desk cannot read a line for what it means, so it goes by
      // who writes, in this order:
      //   - the taker of a line of his answers it (once: the answer closes the take; goal/G21.6, any line it took, not
      //     only his latest, several agents each answering their own);
      //   - the agent the item is with now (item.take, phase.take) posts its work notes, a take of another's standing or
      //     not: the box exempts work notes from the flow;
      //   - an agent that took a phase of the item earlier (red, build, verify), or created it, posts its work notes and
      //     reports at any time (goal/G27.10, R2, Andy's Go 2026-10-17: "An agent that holds the item or a phase on it,
      //     held a phase on it earlier, or created it, posts its work notes and reports under it at any time."). Until
      //     then an earlier phase holder was refused once another agent took his line;
      //   - anybody else takes his line first.
      // Decided by Andy, not by this file: do not let a second agent answer a taken line.
      if (it0 && w.by !== 'andy' && w.by !== 'desk' && !mine) {
        const holder = holdsWith(it0, w) || holdsPhase(it0, w);
        const takerOf = function (l) { return nameOfKey(st0, l.takenKey) || l.taken; };
        const earlier = [[it0.red, it0.redKey], [it0.builder, it0.builderKey], [it0.verifier, it0.verifierKey], [it0.creator, it0.creatorKey]].some(function (p) {
          return !!p[0] && (p[1] ? p[1] === w.key : p[0] === w.by);
        });
        // goal/G21.6: another agent's open take of a line of his, whichever line.
        const other = openTakes(it0)[0];
        if (!holder && !earlier && other) {
          throw refusedWhy('taken', 'Andy\'s line under ' + a.id + ' is taken by ' + takerOf(other) + ', and only it answers; ' + w.by + ' may post here when it takes a line of his addressed to it or to nobody (line.take), or holds the item (item.take)');
        }
        if (!holder && !earlier) {
          throw refusedWhy('bad-request', 'take first: ' + w.by + ' holds neither the take of Andy\'s latest line under ' + a.id + ' (line.take) nor the item (item.take)');
        }
      }
      // Measured as it is stored and answered: with its taken field (goal/G2.2), else the largest line that passes
      // here would not come back whole (oversize.js caught the ten bytes).
      // goal/G21.1: and with the key and name it is answered with.
      const bytes = chatLineBytes(it0 ? it0.chat.length : 0, { by: w.by, at: new Date().toISOString(), text: String(a.text), taken: '', key: w.key, name: nameOfKey(st0, w.key) });
      if (bytes > CHAT_ROOM) throw tooLarge(bytes, CHAT_ROOM);
      // HIS CLEAR OF RED QS (goal/G21.2, clearOf): which open Qs it names, refused with a why when it names none.
      const clear = caller.owner === true && it0 ? clearOf(a.text) : null;
      const cleared = clear ? it0.checks.filter(function (c) { return c.kind === 'Q' && c.state === 'open' && (!clear.number || c.number === clear.number); }) : [];
      if (clear && !cleared.length) throw refusedWhy('bad-request', clear.number ? clear.number + ' is not an open red Q on ' + a.id : 'there is no open red Q on ' + a.id + ' to clear');
      // HIS LINE, ADDRESSED AT THE WRITE (goal/G21.1, addressOf): to whom, and whether it hands over the box or offers a cap.
      // A clear is addressed to nobody: its line is his action, for everyone; each Q's clear goes to its placer below.
      const address = caller.owner === true && it0 && !clear ? addressOf(st0, a.text) : null;
      const after = write('chat.add', Object.assign({}, a, address || {}, { by: w.by, key: w.key }));
      // A MESSAGE TO A BUSY AGENT IS ANSWERED (goal/G2.5). Andy: "the app sends an-auto reply after sending the
      // message the agents in-queue, saying 'message delivered, agents busy'", "after every message". His line
      // under an item an agent holds (item.take) while that agent's last word is working (goal/G2.3) gets the
      // desk's own line right after it, by desk — a record like any other, so changes lists it and a search
      // counts it ("if desk keeps count of those interactions, we can track them later").
      if (caller.owner === true) {
        const it = after.items[String(a.id)];
        const taker = it && it.with;
        if (taker && after.agentWord[taker] === 'working') {
          write('chat.add', { id: a.id, text: 'message delivered, ' + taker + ' busy', by: 'desk', key: '' });
        }
      }
      // Andy, in the item's box: "Andy clears them himself", and "When Andy clears a Q, the agent that placed it is
      // notified; a clear is a form of reply, so the agent updates its position on that question." So each Q goes to
      // cleared (it holds nothing any more and leaves the panel) by a record of his addressed to its placer's key: that
      // agent alone is nudged and handed it in changes (addressedAway), as with his nick-addressed line. A Q the desk
      // placed has no placer to tell. Decided by Andy, not by this file: an agent's own "Q:clear" clears nothing.
      cleared.forEach(function (c) {
        const placer = placerOf(st0, c);
        write('check.set', { id: a.id, check: c.number, state: 'cleared', to: placer ? [placer] : [], by: w.by, key: w.key });
      });
      // A QUESTION MARK IN CHAT RAISES NOTHING (goal/G21.2), ending goal/G2.21's conversion of an agent's line that
      // ended in one. Andy, in the item's box: "A question mark in a chat line never makes a red Q; only a deliberate Q
      // check does." Decided by Andy: do not bring the conversion back. Open checks it raised before stay as they are.
      return { change: after.change };
    },
  },
  // "rename (you)": Andy's alone.
  'item.rename': { request: { id: '', title: '' }, reply: { change: 0 }, handler: function (a, caller) { ownerOnly(caller); const w = writerOf(caller); return { change: write('item.rename', Object.assign({}, a, { by: w.by, key: w.key })).change }; } },
  // HIS DELETE (goal/G9.7, widened by goal/G24.9): his alone, never a goal, never while a phase is held or a claim is
  // open, in design mode or out of it. It is offered in the item's buttons, so the refusal and the button cannot drift
  // apart.
  // A VERB AND NOT A PRESS, BY HIS WORD. Asked which, Andy answered "press." on 2026-10-09 and then, on the same
  // question: "make it a verb, plus the arm able delete button." The later word is the one in force; it was built as a
  // press in between (417f150c) and reverted. Do not turn it back into a press without asking him again.
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
  // THE LISTENER'S WORD (goal/G2.3): listening when its ear arms, working when the ear hands a line over. From
  // the caller the door hands over, never an argument; any other word is refused. The write publishes the goal
  // row with its working list, so the Team tab paints from the publish (goal/G2.4).
  // ── THE JOB QUEUE (goal/G5.7) ────────────────────────────────────
  // Andy: "shouldn't a coding item track on deskServer who took the red, when the red is done, the agent doing the red
  // is removed from the with field, then the item becomes takeable for coding, by somebody who didn't do the red, when
  // the coding is done, the verifying can be taken by someone who didn't do the coding.", "each claude can first check
  // for available jobs." One holder per phase (first wins, as box.take); finishing clears with and opens the next.
  'phase.take': {
    request: { id: '', phase: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      const w = writerOf(caller);
      return { change: write('phase.take', { id: a.id, phase: String(a.phase), by: w.by, key: w.key }, function (st, it) {
        const why = mayTake(st, it, String(a.phase), w.by);
        if (why) throw refused(why);
        // ONE TASK AT A TIME (goal/G21.4, heldBy): no phase here while another item or phase is held.
        oneTask(st, w, a.id);
      }).change };
    },
  },
  // pass and why only for verify; a failed verify goes back to build, to the same builder, its why a line by desk.
  'phase.done': {
    request: { id: '', phase: '', pass: false, why: '' }, reply: { change: 0 },
    // pass and why may be left out (red and build send neither).
    accepts: function (x) {
      if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
      const known = ['id', 'phase', 'pass', 'why'];
      return Object.keys(x).every(function (k) { return known.indexOf(k) !== -1; }) && typeof x.id === 'string' && typeof x.phase === 'string' &&
        (x.pass === undefined || typeof x.pass === 'boolean') && (x.why === undefined || typeof x.why === 'string');
    },
    handler: function (a, caller) {
      const w = writerOf(caller);
      const body = { id: a.id, phase: String(a.phase), pass: a.pass === true, by: w.by, key: w.key };
      // A VERIFY PASS CARRIES THE ITEM'S CLAIMED COMMIT (goal/G27.2, D11). Andy, 2026-10-17: "make that press queue it.":
      // the pass sets the item back to waiting for deskVerify, so deskVerify's watcher queues a check at this commit,
      // never at whatever its tree holds (goal/G19.13's reason for dropping the pass as a trigger).
      const claimed = a.phase === 'verify' && a.pass === true ? String(((walkState().items[String(a.id)]) || {}).claimCommit || '') : '';
      if (claimed) body.commit = claimed;
      const change = write('phase.done', body, function (st, it) {
        if (!it || !it.code || it.phaseWith !== w.by || it.phase !== String(a.phase)) throw refused('not-offered');
      }).change;
      if (a.phase === 'verify' && a.pass !== true && a.why) write('chat.add', { id: a.id, text: 'verify failed (' + w.by + '): ' + String(a.why), by: 'desk', key: '' });
      // ONE AGENT ALONE NEEDS NO WAIVE (goal/G2.22). Andy, 2026-10-06: "add to 2.22 that the desk can waive the rule
      // if only one agent is present.", and asked why the desk cannot simply do it: "contradiction or not. autowaive
      // when only one agent is present. the other case already happened in a previous goal, and it worked." So at
      // EVERY handover, not the red's alone: the rules hand each phase to somebody else (mayTake), so alone the item
      // would stall at whichever one it reached. DECIDED HERE, AT THE WRITE, AND RECORDED AS A PRESS: who is live is
      // of this moment only, and a walk of the records must not re-decide it later, when everyone reads as stale.
      const st = walkState();
      const m = st.items[String(a.id)];
      const live = liveAgents(st);
      if (m && !m.done && !m.closed && m.waived !== true && live.length === 1 && live[0] === w.by) {
        write('press', { id: a.id, what: 'waive', by: 'desk', key: '' });
        write('chat.add', { id: a.id, text: 'waived: ' + w.by + ' is the only agent here, so it may take the next phase of this item itself.', by: 'desk', key: '' });
      }
      return { change: change };
    },
  },
  // MAY THE CALLER COMMIT ON THIS ITEM (goal/G5.9), for the commit check. Andy, to Q7: "it should trigger a red GRANT
  // request for me." The caller by its key at the door, never a name it sends; not allowed only when the item is marked
  // code, is in build, the caller wrote its red, and he has not waived it. A refusal says why.
  'phase.may': {
    request: { id: '' }, reply: { allowed: true, why: '' },
    handler: function (a, caller) {
      const w = writerOf(caller);
      const it = walkState().items[String(a.id)];
      if (!it) throw refused('no-such-item');
      if (!it.code || it.phase !== 'build' || it.waived === true) return { allowed: true, why: '' };
      const wrote = it.redKey ? it.redKey === w.key : it.red === w.by;
      return wrote ? { allowed: false, why: 'red writer: ' + w.by + ' wrote the red of ' + it.id + ', which is in build' } : { allowed: true, why: '' };
    },
  },
  // THE JOBS OPEN TO THE CALLER: every open phase of an item marked code it may take now, as { id, phase }.
  'work.open': {
    request: {}, reply: { items: [{ key: '', label: '' }], more: false },
    handler: function (a, caller) {
      const w = writerOf(caller);
      const s = walkState();
      const jobs = [];
      Object.keys(s.goals).forEach(function (gid) {
        const g = s.goals[gid];
        if (g.abandoned || (s.items[gid] && s.items[gid].closed)) return;
        g.members.forEach(function (id) {
          // goal/G29.10: a verified item waiting for his Done is still being worked on, so its red is no job.
          const m = s.items[id];
          ['red', 'build', 'verify'].forEach(function (p) { if ((p !== 'red' || (m && m.phase)) && !mayTake(s, m, p, w.by)) jobs.push({ id: id, phase: p }); });
        });
      });
      return walked(jobs, function (j) { return { key: j.id + ':' + j.phase, label: JSON.stringify(j) }; });
    },
  },
  // ── THE RULES' VERBS (goal/G5.5) ─────────────────────────────────
  // Andy: "only changes/upgrades in the faceless parts, so that the UI doesn't have to come back to the faceless
  // parts." Anyone may add a rule, proposed ("why not?"); a new version is his one button ("i prefer to negotiate,
  // and create an updated version with one button/verb that belongs to me."), activate and delete being versions
  // too; his draft is kept here ("yes to all of it").
  'rule.add': {
    request: { type: '', label: '', text: '' }, reply: { key: '' },
    handler: function (a, caller) {
      const w = writerOf(caller);
      mayWrite(walkState(), w);
      const fr = require('../../../js/fieldRules.js');
      if (RULE_TYPES.indexOf(a.type) === -1) throw refusedWhy('bad-request', 'a rule type is one of ' + RULE_TYPES.join(', '));
      if (fieldWhy('label', a.label)) throw refusedWhy('bad-request', fieldWhy('label', a.label));
      if (fieldWhy('text', a.text, true)) throw refusedWhy('bad-request', fieldWhy('text', a.text, true));
      const key = 'rule/' + (Number(ruleCount.get().c) + 1);
      addRuleRow.run(key, new Date().toISOString(), w.by, a.type, fr.normalize(a.label), 'proposed', fr.normalizeParagraph(a.text));
      appServer.spirit.core.jobs.publish({ rule: key, row: ruleRow(key) });
      rulesChanged(key, 'added, proposed');
      return { key: key };
    },
  },
  'rule.get': {
    request: { key: '' }, reply: { key: '', label: '', type: '', status: '', text: '', draft: '', at: '', by: '' },
    handler: function (a) {
      const row = ruleRow(String(a.key));
      if (!row) throw refused('no-such-item');
      return row;
    },
  },
  'rule.draft': {
    request: { key: '', text: '' }, reply: { key: '' },
    handler: function (a, caller) {
      ownerOnly(caller);
      const fr = require('../../../js/fieldRules.js');
      if (!newestRule.get(String(a.key))) throw refused('no-such-item');
      if (fr.paragraphProblem(a.text)) throw refusedWhy('bad-request', fieldWhy('text', a.text, true));
      putDraft.run(String(a.key), new Date().toISOString(), fr.normalizeParagraph(a.text));
      appServer.spirit.core.jobs.publish({ rule: String(a.key), row: ruleRow(String(a.key)) });
      return { key: String(a.key) };
    },
  },
  'rule.version': {
    request: { key: '', text: '', status: '' }, reply: { key: '' },
    handler: function (a, caller) {
      ownerOnly(caller);
      const fr = require('../../../js/fieldRules.js');
      const r = newestRule.get(String(a.key));
      if (!r) throw refused('no-such-item');
      if (RULE_STATUSES.indexOf(a.status) === -1) throw refusedWhy('bad-request', 'a rule status is one of ' + RULE_STATUSES.join(', '));
      if (fr.paragraphProblem(a.text)) throw refusedWhy('bad-request', fieldWhy('text', a.text, true));
      addRuleRow.run(r.key, new Date().toISOString(), 'andy', r.type, r.label, a.status, fr.normalizeParagraph(a.text));
      appServer.spirit.core.jobs.publish({ rule: r.key, row: ruleRow(r.key) });
      rulesChanged(r.key, 'versioned, ' + a.status);
      return { key: r.key };
    },
  },
  // Its older versions, newest first, through the bucket; more says there were more, nothing pages.
  'rule.history': {
    request: { key: '' }, reply: { items: [{ key: '', label: '' }], more: false },
    handler: function (a) {
      const rows = ruleRows.all(String(a.key));
      if (!rows.length) throw refused('no-such-item');
      const older = rows.slice(1);
      return walked(older, function (r) {
        return { key: String(r.n), label: JSON.stringify({ at: r.at, by: r.by, type: r.type, label: r.label, status: r.status, text: r.text }) };
      });
    },
  },
  // THE LIST'S SEARCH (FACE.md): "searchable for deskClient and UI, with the type and status values as filters,
  // and label and text being searched. search results with bring back key, label, type and status."
  'rules.search': {
    request: { text: '', types: [''], statuses: [''] }, reply: { items: [{ key: '', label: '' }], more: false },
    handler: function (a) {
      // goal/G29.21: the text ranks the rules by title and text (probabilityStringObjectMatch), the types and statuses
      // still filter; newest first among equals, so no words reads every rule newest first.
      const text = String(a.text || '').trim();
      const types = (Array.isArray(a.types) ? a.types : []).filter(Boolean);
      const statuses = (Array.isArray(a.statuses) ? a.statuses : []).filter(Boolean);
      const walk = newestRules.all().filter(function (r) {
        if (types.length && types.indexOf(r.type) === -1) return false;
        return !(statuses.length && statuses.indexOf(r.status) === -1);
      }).map(function (r) {
        return { probability: text ? probabilityStringObjectMatch(text, { label: String(r.label), text: String(r.text || '') }) : 0, pair: { key: r.key, label: JSON.stringify({ label: r.label, type: r.type, status: r.status }) } };
      });
      return ranked(walk, ANSWER_ROOM);
    },
  },
  'agent.state': {
    request: { word: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      const w = writerOf(caller);
      if (a.word !== 'listening' && a.word !== 'working') throw refusedWhy('bad-request', 'an agent word is listening or working');
      return { change: write('agent.state', { word: a.word, by: w.by, key: w.key }).change };
    },
  },
  // THE AGENT IS GOING (goal/G8.5): gone at once, its phases freed. A desk verb, not a node verb.
  'signoff': {
    request: {}, reply: { change: 0 },
    handler: function (a, caller) {
      const w = writerOf(caller);
      return { change: write('signoff', { by: w.by, key: w.key }).change };
    },
  },
  // A VERIFY TAKEN BACK (goal/G8.3). Andy, 2026-10-09: "deskVerify only reject a done claim. this should prompt an
  // agent to pick the item up, raise red-questions if neccessary." His alone, because deskVerify writes as him; it is
  // the one thing it may do, and it cannot go through phase.done, which refuses a caller that does not hold the phase
  // (deskVerify holds none, by his ruling). Only a verified code item: anything else is not-offered, so a second
  // rejection of the same item changes nothing. The why is kept as one line by desk under the item, which is how a
  // failed verify already reads, and it names the reds because his rule is that only reds are delivered.
  // deskVerify'S OWN WORD ON A VERIFY (goal/G8.3): the mirror of verify.reject, his alone as that is, and only on a
  // verified code item. It brings the Done button; the builder's claim was already on the record without it.
  'verify.pass': {
    request: { id: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      ownerOnly(caller);
      const w = writerOf(caller);
      return { change: write('verify.pass', { id: a.id, by: w.by, key: w.key }, function (st, it) {
        // A GOAL TAKES IT ONCE IT HAS EMPTIED (goal/G8.12): that is what the full run was started by, and the goal
        // carries no code mark of its own. An item still needs its verifier's pass first (goal/G8.3).
        if (!it || it.done || it.closed) throw refused('not-offered');
        if (it.goal) { if (!(st.goals[it.id] || {}).emptied) throw refused('not-offered'); }
        // A CODE ITEM NEEDS ITS VERIFIER'S PASS FIRST; A PLAIN ITEM NEEDS A CLAIM
        // (goal/G16.13). A plain item was refused outright, which is why the verifier
        // could say nothing about one and the claim alone had to bring Done.
        else if (it.code) { if (it.verified !== true) throw refused('not-offered'); }
        else if (!Object.keys(it.claims).length) throw refused('not-offered');
      }).change };
    },
  },
  'verify.reject': {
    request: { id: '', why: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      ownerOnly(caller);
      const w = writerOf(caller);
      const change = write('verify.reject', { id: a.id, by: w.by, key: w.key }, function (st, it) {
        // A DONE OR CLOSED ITEM TAKES NO VERIFY WORD (goal/G8.10): the flood of 2026-10-09 rejected thirty-four
        // settled items, and his desk carried the chat line for each. deskVerify is not the one to unsettle an item.
        if (!it || !it.code || it.verified !== true || it.done || it.closed) throw refused('not-offered');
      }).change;
      const why = String(a.why || '').trim();
      write('chat.add', { id: a.id, text: 'verify rejected: ' + (why || 'the item\'s suites did not hold'), by: 'desk', key: '' });
      return { change: change };
    },
  },
  // AN AGENT'S RE-VERIFY (goal/G8.10). Andy, 2026-10-09: "an agent should be able to trigger a re-verify." Any agent,
  // not his alone, and only on a verified code item - before a verify there is nothing to redo, and the refusal keeps a
  // stray call from sitting on the record as a trigger. It writes the record and touches no field of the item.
  'verify.again': {
    request: { id: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      const w = writerOf(caller);
      // A GOAL IS RUN AGAIN TOO (goal/G19.2). A deskVerify restarted while a goal emptied read that goal.emptied as
      // history, and verify.again refused a goal as "not a code item", so the goal's Done was out of reach for good.
      // On a goal it is taken, from him or an agent, and the record says goal: true: deskVerify's watcher reads that as
      // the goal run. The refusals below are an item's, unchanged.
      const st0 = walkState();
      const isGoal = !!(st0.items[String(a.id)] && st0.items[String(a.id)].goal);
      const rec = isGoal ? { id: a.id, goal: true, by: w.by, key: w.key } : { id: a.id, by: w.by, key: w.key };
      return { change: write('verify.again', rec, function (st, it) {
        if (it && it.goal) { if (it.id === GROUP_CHAT) throw refusedWhy('not-offered', 'the group chat has no suites: it is not a goal to verify'); return; }
        // Nor on a done or closed item (goal/G8.10): a re-verify of a settled item would only feed the watcher a word
        // the desk would then refuse.
        // EACH REFUSAL SAYS WHY (goal/G18.10): the Verifier tab's button was refused in silence, and Andy read it as
        // "verify, when idling, does not react to my attempts of pushing it's re-verify button."
        if (!it) throw refused('not-offered');
        if (it.done || it.closed) throw refusedWhy('not-offered', a.id + ' is ' + (it.closed ? 'closed' : 'done') + ': a settled item is not verified again');
        if (!it.code) throw refusedWhy('not-offered', a.id + ' is not a code item: its check comes from its claim, not from a re-verify');
        if (it.verified !== true) throw refusedWhy('not-offered', a.id + ' has no verify pass on record yet: its verifier passes it first, then it can be verified again');
      }).change };
    },
  },
  // THE UNDO OF A DONE (goal/G19.2). Andy, 2026-10-12: "i said the verifier can not press done, i never said that the
  // verifier cannot undo a done/close...", and "yes." to: any run showing a suite red unsettles every done or closed
  // item listing it, and its goal, counted only from a clean, pulled tree holding the item's commit. deskVerify judges
  // that and writes this as him, so it is his alone; what it does to the item is in the walk. Only a settled item takes
  // it (a goal also while its pass or its emptied mark stands, which is what would bring its Done back unearned), and
  // every refusal says why. verify.reject keeps refusing a settled item: the undo is this verb's, not that one's.
  'verify.regress': {
    request: { id: '', why: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      if (!caller || caller.owner !== true) throw refusedWhy('not-owner', 'verify.regress is the owner\'s: deskVerify writes it as Andy, and no agent takes back a Done');
      const w = writerOf(caller);
      const why = String(a.why || '').trim();
      return { change: write('verify.regress', { id: a.id, why: why, by: w.by, key: w.key }, function (st, it) {
        if (!it) throw refused('not-offered');
        if (it.goal) {
          if (it.id === GROUP_CHAT) throw refusedWhy('not-offered', 'the group chat is never settled, so nothing regresses there');
          if (!it.done && !it.closed && !it.checked && !(st.goals[it.id] || {}).emptied) throw refusedWhy('not-offered', a.id + ' is neither done, closed nor passed: a goal with nothing settled has nothing to take back');
          return;
        }
        if (it.leftOut) throw refusedWhy('not-offered', a.id + ' was deleted: a left-out item is not brought back by a regression');
        if (!it.done && !it.closed) throw refusedWhy('not-offered', a.id + ' is neither done nor closed: only a settled item is unsettled by a regression');
      }).change };
    },
  },
  'item.status': { request: { id: '', word: '' }, reply: { change: 0 }, handler: function (a, caller) { const w = writerOf(caller); return { change: write('item.status', Object.assign({}, a, { by: w.by, key: w.key })).change }; } },
  // ONE TASK AT A TIME (goal/G21.4, heldBy): a second item is refused while one is held; the item it holds, taken
  // again, is no second.
  'item.take': {
    request: { id: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      const w = writerOf(caller);
      return { change: write('item.take', Object.assign({}, a, { by: w.by, key: w.key }), function (st) { oneTask(st, w, a.id); }).change };
    },
  },
  // LETTING AN ITEM GO (goal/G21.4). Andy, in the item's box: "taking a second is refused by the desk until the first is
  // released, claimed or done." A plain item.take was let go by nothing until this verb: the caller's with on the item,
  // and its phase there if it holds one, go back to nobody. A caller holding neither is refused with a why.
  'item.release': {
    request: { id: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      const w = writerOf(caller);
      return { change: write('item.release', { id: a.id, by: w.by, key: w.key }, function (st, it) {
        if (!holdsWith(it, w) && !holdsPhase(it, w)) throw refusedWhy('not-offered', w.by + ' holds neither ' + a.id + ' nor a phase of it, so there is nothing to release');
      }).change };
    },
  },
  // NO AGENT SCOPES SINCE goal/G10.8. Andy, 2026-10-12: "all agents in desk have "/" file scope", the per-agent
  // setting removed from desk and commitCheck ("b"). What fences an agent is the desk itself: Go, its item, the core
  // grants.
  // AGENT PROFILES (goal/G4.23). Andy: "so two more fields for repo-root-agents: name <agent-name> nick: <wc | wsl |
  // ubi>", "build them now.", "the profiles are for me, in desk. a dataset that deskServer stores for me and let's you
  // see." profile.set is his alone; profile.get answers any agent's ('' the caller). A name passes the label rule
  // (fieldRules); a nick is 1-8 of a-z0-9, one agent's alone. Desk verbs, not node verbs.
  // THE PANE'S TWO TOGGLES (goal/G21.1). Andy, in the item's box: "Row two: the toggles included and cap ... Written by
  // Andy alone; every agent may read every pane." So profile.set takes included and cap, each optional (left out, it
  // keeps what the profile held, on for a profile never set), and profile.get answers them. A name or nick left empty
  // is no name or no nick (the label shows; nothing is addressed), so he can set a toggle before he names the agent.
  'profile.set': {
    request: { agent: '', name: '', nick: '', included: true, cap: true }, reply: { change: 0 },
    accepts: function (x) {
      if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
      const known = ['agent', 'name', 'nick', 'included', 'cap'];
      return Object.keys(x).every(function (k) { return known.indexOf(k) !== -1; }) &&
        typeof x.agent === 'string' && typeof x.name === 'string' && typeof x.nick === 'string' &&
        (x.included === undefined || typeof x.included === 'boolean') && (x.cap === undefined || typeof x.cap === 'boolean');
    },
    handler: function (a, caller) {
      ownerOnly(caller);
      const w = writerOf(caller);
      if (!a.agent) throw refusedWhy('bad-request', 'a profile names its agent by key');
      if (a.name !== '' && fieldWhy('name', a.name)) throw refusedWhy('bad-request', fieldWhy('name', a.name));
      if (a.nick !== '' && !/^[a-z0-9]{1,8}$/.test(a.nick)) throw refusedWhy('bad-request', 'a nick is 1 to 8 of a-z and 0-9');
      const st = walkState();
      const held = st.profiles;
      if (a.nick !== '' && Object.keys(held).some(function (k) { return k !== a.agent && held[k].nick === a.nick; })) throw refused('taken');
      const was = profileOf(st, a.agent);
      const included = typeof a.included === 'boolean' ? a.included : was.included;
      const cap = typeof a.cap === 'boolean' ? a.cap : was.cap;
      return { change: write('profile.set', { agent: a.agent, name: a.name, nick: a.nick, included: included, cap: cap, by: w.by, key: w.key }).change };
    },
  },
  'profile.get': {
    request: { agent: '' }, reply: { name: '', nick: '', included: true, cap: true },
    handler: function (a, caller) {
      return profileOf(walkState(), a.agent || writerOf(caller).key);
    },
  },
  // TAKING THE BOX (goal/G4.20 point 9): an agent takes the box before a change it will write (cap, split, an
  // update), and the box is drawn red until its write. First wins; another agent's take is refused taken.
  // SINCE goal/G9.3 HE TAKES IT TOO, and a take is freed by box.release as well as by the taker's write.
  // A desk verb, not a node verb.
  'box.take': {
    request: { id: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      const w = writerOf(caller);
      // HE TAKES IT TOO (goal/G9.3). Andy, 2026-10-07: "the text box in item/goal detail must be an input area for the
      // user. When the user activates that input area, the area is \"taken\" by the user, and not modifiable for
      // agents." Until then box.take refused him by name.
      const st = walkState();
      const it = st.items[String(a.id)];
      if (!it) throw refused('no-such-item');
      mayWrite(st, w);
      // A HOLD IS ONE AGENT'S (goal/G21.1): "nobody else takes it meanwhile, Andy included". By key.
      if (it.boxTakenBy && !holdsBox(it, w)) {
        if (it.boxHoldUntil) throw refusedWhy('taken', 'the box of ' + a.id + ' is held for ' + (nameOfKey(st, it.boxTakenKey) || it.boxTakenBy) + ' for one write, or until its minute is over');
        throw refused('taken');
      }
      // Its holder taking it again changes nothing: the hold and its minute stand.
      if (it.boxTakenBy && it.boxHoldUntil) return { change: st.change };
      // HIS CAP OFFERED (goal/G21.1): "the first to take it holds it under the one-write rule"; an agent with cap off
      // "gets a cap only when addressed by its nick". He is no agent: his own take is a plain take.
      const body = { id: a.id, by: w.by, key: w.key };
      if (it.capOffer && !it.boxTakenBy && w.by !== 'andy') {
        if (it.capOffer.indexOf(w.key) === -1) throw refusedWhy('taken', 'the cap on ' + a.id + ' is offered to the agents with cap on; ' + w.by + ' has cap off (or was not included) and gets a cap only by its nick');
        body.hold = true;
      }
      return { change: write('box.take', body).change };
    },
  },
  // THE FILES AN AGENT TOUCHED (goal/G8.8). Andy, 2026-10-09: "ideally written by the claiming agent. the coding agent
  // and the testing agent should be adding files they test/touch in a list that can be fetched per item.", "the list
  // should be owned by the item. so updates to it are available to all participants.", and "all files that need a
  // grant should get one 'grant' button together." So: the caller's whole list, replacing its own entries; the list
  // comes back in item.get; and if it holds core files, ONE open grant names them all. A desk verb, and his ruling of
  // 2026-10-09 is that a desk verb needs no grant of his "until i rule this app 'intrinsic'".
  'item.files.add': {
    request: { id: '', paths: [''] }, reply: { change: 0 },
    accepts: function (x) {
      return !!x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).length === 2 &&
        typeof x.id === 'string' && Array.isArray(x.paths) && x.paths.every(function (p) { return typeof p === 'string' && p; });
    },
    handler: function (a, caller) {
      const w = writerOf(caller);
      // NO .. IN A LISTED PATH (goal/G19.4): a path is a repository path, and one that climbs out of where it names is
      // refused here, before deskVerify could run it.
      const climbing = a.paths.filter(function (p) { return String(p).replace(/\\/g, '/').split('/').indexOf('..') !== -1; });
      if (climbing.length) throw refusedWhy('bad-request', 'a listed path may not contain a .. segment: ' + climbing.join(', '));
      // The grant is raised in the walk, beside the list it describes, so a replay of the records decides the same.
      return { change: write('item.files.add', { id: a.id, paths: a.paths.map(String), by: w.by, key: w.key }).change };
    },
  },
  // LETTING IT GO WITHOUT A WRITE (goal/G9.3). Andy, 2026-10-07: "When the user clicks outside of that text box, and
  // deactivates the input, also by leaving the details dialog, the box input is released from the take." A take was
  // freed only by its holder's box.write until then, so leaving the box unchanged held it for good. Only the holder
  // releases: another caller is refused taken, so nobody takes a box out of somebody's hands.
  'box.release': {
    request: { id: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      const w = writerOf(caller);
      const st = walkState();
      const it = st.items[String(a.id)];
      if (!it) throw refused('no-such-item');
      mayWrite(st, w);
      if (!it.boxTakenBy) return { change: st.change };
      if (!holdsBox(it, w)) throw refused('taken');
      return { change: write('box.release', { id: a.id, by: w.by, key: w.key }).change };
    },
  },
  // TAKING HIS LINE (goal/G2.2 note 2, goal/G21.6): an agent takes the newest line of Andy's under an item that is not
  // taken and is addressed to it or to nobody, and is the only one to answer that line, once. First wins; with no such
  // line the take is refused taken; an item with no line of his refuses no-row.
  'line.take': {
    request: { id: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      const w = writerOf(caller);
      if (w.by === 'andy') throw refusedWhy('bad-request', 'a line is taken by an agent, not by Andy');
      const st = walkState();
      const it = st.items[String(a.id)];
      if (!it) throw refused('no-such-item');
      mayWrite(st, w);
      // AN OPEN TAKE STANDS (goal/G21.1, goal/G21.6): a line its nick bound to it, or one it took and has not answered
      // yet. Nothing to write; its next post answers that take.
      if (holdsTake(it, w)) return { change: st.change };
      let his = null;
      for (let i = it.chat.length - 1; i >= 0; i--) { if (it.chat[i].by === 'andy') { his = it.chat[i]; break; } }
      // AN AGENT'S LINE IS NEVER TAKEN (goal/G21.4). Andy, in the item's box: "An agent's answer is never takeable: no
      // agent answers another agent. A second answer comes only when Andy asks for it by naming the agent." Decided by
      // Andy, not by this file.
      if (!his) throw refusedWhy('no-row', it.chat.length ? 'there is no line of Andy\'s under ' + a.id + ': only his lines are taken, an agent\'s line never is' : 'there is no line of Andy\'s under ' + a.id + ' to take');
      // THE NEWEST LINE OF HIS THAT IS THE AGENT'S TO TAKE (goal/G21.6, takeableLine). Andy's decision, in the item's
      // box: not only his latest line; one addressed to another agent stays never takeable (goal/G21.1), and one taken
      // already is its taker's, answered or not. With none left, the refusal says so and what his latest line is.
      if (!takeableLine(it, w.key)) {
        const none = 'no line of Andy\'s under ' + a.id + ' is left for ' + w.by + ' to take: every one is taken or addressed to another agent. ';
        if (Array.isArray(his.to) && his.to.indexOf(w.key) === -1) throw refusedWhy('taken', none + 'Andy\'s latest line under ' + a.id + ' is addressed to another agent');
        if (!his.answered) throw refusedWhy('taken', none + 'Andy\'s latest line under ' + a.id + ' is taken by ' + (nameOfKey(st, his.takenKey) || his.taken) + ', and it is theirs to answer');
        throw refusedWhy('taken', none + 'Andy\'s latest line under ' + a.id + ' was taken and answered by ' + (nameOfKey(st, his.takenKey) || his.taken) + ': what follows it is an agent\'s answer, and an agent\'s answer is never taken; a second answer comes only when Andy names the agent');
      }
      return { change: write('line.take', { id: a.id, by: w.by, key: w.key }).change };
    },
  },
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
      if (a.what === 'go' || a.what === 'go-all') body.rules = rulesForGo(walkState(), a.id, a.what);
      const landed = write('press', body, pressCheck(a));
      // THE PRESS THAT EMPTIES THE GOAL WRITES IT (goal/G8.12), once, right after it has landed.
      emptiedByPress(a);
      return { change: landed.change };
    },
  },
  // A CLAIM WITH ITS COMMIT (goal/G19.13). Andy, 2026-10-12: "these push things, when you report a claim on code, it
  // should be accompanied by the commit id, that way desk verify won't check something that hasn't arrived yet... ?";
  // to claim {id, commit} as one verb: "better. that closes the door on half-ass claims."; and "and why are the reds not
  // claimed as complete that way, so the verifier can check them, they should be red. at the time", "yes" to the red
  // phase ending with its own commit, checked red by deskVerify.
  //   phase build  the press claim-done, through the same checks (pressCheck), and the record carries the commit;
  //                deskVerify waits until its tree holds that commit before it checks the item.
  //   phase red    the red is claimed at that commit; deskVerify runs the item's suites and each must be red. No Done
  //                follows from it. Only on a code item with his Go.
  //   commit       7 to 40 hex characters; '' only for a plain item's build claim, which has no code to carry.
  // An agent verb, told to the agents by claim.json beside this file. press claim-done stays for his pages and the
  // callers that have no commit. Every refusal says why.
  'claim': {
    request: { id: '', phase: '', commit: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      const w = writerOf(caller);
      const id = String(a.id);
      const phase = String(a.phase);
      const commit = String(a.commit);
      if (phase !== 'build' && phase !== 'red') throw refusedWhy('bad-request', 'a claim\'s phase is build or red, not ' + JSON.stringify(phase));
      if (commit !== '' && !/^[0-9a-f]{7,40}$/.test(commit)) throw refusedWhy('bad-request', 'a commit is 7 to 40 hex characters (lower case), not ' + JSON.stringify(commit));
      const st0 = walkState();
      const it0 = st0.items[id];
      if (!it0) throw refusedWhy('no-such-item', 'there is no item ' + id + ' on the desk');
      if (commit === '' && (phase === 'red' || it0.code)) throw refusedWhy('bad-request', 'a ' + (phase === 'red' ? 'red' : 'code item\'s') + ' claim carries the commit it was made at; only a plain item\'s build claim may leave it empty');
      if (phase === 'red') {
        if (!it0.code) throw refusedWhy('not-offered', id + ' is not a code item: it has no red phase to claim');
        if (!it0.go) throw refusedWhy('not-offered', 'no Go is on record for ' + id + ', so its red is not claimable yet');
      }
      const body = { id: id, phase: phase, commit: commit, by: w.by, key: w.key };
      // THE SAME CHECKS AS THE PRESS (goal/G19.13): a build claim is refused exactly where press claim-done is.
      const landed = write('claim', body, phase === 'build' ? pressCheck({ id: id, what: 'claim-done' }) : null);
      if (phase === 'build') emptiedByPress({ id: id });
      return { change: landed.change };
    },
  },
  'state.get': { request: {}, reply: { json: '' }, handler: function () { return { json: doc('state') }; } },
  'state.set': { request: { json: '' }, reply: { saved: true }, handler: function (a) { return saveDoc('state', a.json); } },
  'seen.get': { request: {}, reply: { json: '' }, handler: function () { return { json: doc('seen') }; } },
  'seen.set': { request: { json: '' }, reply: { saved: true }, handler: function (a) { return saveDoc('seen', a.json); } },
// goal/G22.3: the table closes here, and withPlugins hands every verb of it to the plugins first.
}),

// The bundle a peer user needs (apiAuth/G1.10, DEPENDENCIES): the agents'
// protocol spans most of this table — searches, reads, writes, presses,
// changes — so the minimum is the app itself, one app-level grant-shape.
//
// ── THE DESK'S OWN REFUSALS (goal/G16.11) ───────────────────────────
//
// These four were defined in the shared register, which the node and the
// relay both load. Andy, 2026-10-11: "yes. get the bloody app error codes
// out of the core." They are declared here now, beside the verbs that
// raise them; appServer puts "desk: " in front of each text, so the origin
// of a refusal is plain and no other app can wear this name. The codes
// themselves are unchanged, so nothing on the wire moved.
{ dependencies: ['desk'], codes: {
  // A line of Andy's an agent has taken (goal/G2.2 note 2): a second take, or another agent's answer under that
  // item before the taker's. Andy: "an item can 'take' my message and be the only one to answer after that".
  'taken': { status: 409, text: 'taken by another agent' },
  // An alteration written against a box version that has moved on (desk/G2.1).
  'box-moved': { status: 409, text: 'the box has changed since that version' },
  'not-offered': { status: 409, text: 'that press is not offered for this item now' },
  'no-such-item': { status: 404, text: 'no such item' },
  // goal/G21.1: an agent Andy turned off in its pane (included) reads, and every write of it is refused.
  'not-included': { status: 403, text: 'that agent is not included at the desk' },
  // goal/G21.4: an agent already holding an item or a phase takes no second until the first is released, claimed or done.
  'one-task': { status: 409, text: 'that agent already holds another task' },
} });

// THE PRESS'S CHECKS, ONE COPY (goal/G19.13): what the press handler refuses, as a write() check, so the claim verb's
// build phase refuses exactly what press claim-done refuses and the two cannot drift apart.
function pressCheck(a) {
  return function (st, it) {
    const offered = buttons(st, it);
    // goal/G2.19 puts make-current on the same leash: offered or refused, so a closed goal takes Reopen first.
    // Every refusal below names what blocked it (goal/G9.17, change 3), the code staying not-offered.
    if ((a.what === 'go' || a.what === 'go-all' || a.what === 'close' || a.what === 'reopen' || a.what === 'make-current') && offered.indexOf(a.what) === -1) throw notOffered(whyNotOffered(st, it, a.what, offered));
    if (a.what === 'bring-back' && !it.closed) throw notOffered(it.id + ' is not closed, so there is nothing to bring back');
    if (a.what === 'code' && (it.goal || it.subGoal)) throw notOffered(it.id + ' is a goal, and a goal is never a code item');
    // DESIGN-GREEN GATES THEM (goal/G6.8): his End design while any item of the goal has an open red question, a Go
    // on an item with one, a go-all while any item of the goal has one: refused.
    const gOf = st.goals[it.goal ? it.id : it.goalId];
    const members = gOf ? gOf.members : [];
    const red = (a.what === 'end-design' || a.what === 'go-all') ? notGreen(st, members.concat(it.goal ? [it.id] : [])) : [];
    if (red.length) throw notOffered(red.join(', ') + (red.length === 1 ? ' carries' : ' carry') + ' an open red question; answer or close it first');
    if (a.what === 'go' && openQ(it)) throw notOffered(it.id + ' carries an open red question; answer or close it first');
    // NO CLAIM BEFORE HIS GO (goal/G3.9). Andy, 2026-10-03: "yes, the desk may refuse a claim-done, on an item
    // without 'go' on record", "the actual contract is consumed between 'go' and 'done'". It replaces
    // goal/G2.13's "a claim consumes the Go" for that case. A goal takes the press as before (goal/G2.10).
    if (a.what === 'claim-done' && !it.goal && !it.go) throw notOffered('no Go is on record for ' + it.id + ', so nothing is claimable');
    // The group chat's anchor stays closed (goal/G3.10): nobody brings it back onto the List.
    if (a.what === 'bring-back' && it.id === GROUP_CHAT) throw notOffered('the group chat never comes back onto the List');
  };
}
