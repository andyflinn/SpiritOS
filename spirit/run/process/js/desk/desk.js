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
//   D4  the local shell reaches it by jobs.api on the loopback door, a known
//       member by an 'api' packet; both end in appClient.ask.
//   D12 no reply carries 'ok': that key is an error's (appServer.js).
//
// Free-form documents (the state, what Andy has seen, a log line) travel
// as JSON text: the helper matches keys exactly (appPair D8), so an open
// object could never match its prototype. A log line's searchable columns
// are copied out of its text; the text itself is kept whole.
//
// NEVER A LIST (Andy: every list is a search). log.search answers what
// matches, newest first, cut to fit one answer by searchBucket, and says
// so with more.

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const appServer = require('../../../js/appServer.js');
const appClient = require('../../../js/appClient.js');
const searchBucket = require('../../../js/searchBucket.js');

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
//   Andy: "Desk must adhere to standards as well. use the bucket.js", and
//   "from now on the MAX_PAYLOAD applies".
//
// A line fits when an answer holding it alone fits the room, measured as
// searchBucket measures that answer ({items: [{key, label}], more}). The
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
// The room chat.search fills (goal/G3.11): half an answer. An agent's deskClient packs the desk's answer once more
// as text, where every quote and backslash gains one byte, so at most the answer doubles; half the room is what
// still arrives in one piece. Andy: "what's the problem with having to be brief?", "none of this joing shit."
const SEARCH_ROOM = Math.floor(ANSWER_ROOM / 2);
// Every panel an item answers with, each measured as one answer: its facts (item.get, and its label in a search),
// its box (item.box) and its checks (item.checks). The largest, against the room.
function largestPanel(s, id) {
  const it = s.items[id];
  if (!it) return 0;
  return Math.max(
    oneAnswerBytes(id, JSON.stringify(facts(s, it))),
    Buffer.byteLength(JSON.stringify({ box: it.box, version: it.version }), 'utf8'),
    Buffer.byteLength(JSON.stringify({ checks: it.checks }), 'utf8'));
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

// Offers each object of `walk`, in its order, to one bucket, and answers the
// bucket's result. One too big to be sent alone is never offered: it would
// stop the walk with nothing sent (slim/G1.2 T2); skipping it says `more`.
function walked(walk, pairOf) {
  const bucket = searchBucket.createSearch({
    query: '**', maxBytes: ANSWER_ROOM,
    getLabelStringFromIncomingObject: function (pair) { return pair.label; },
    extractKeyAndLabelFromRow: function (pair) { return pair; },
  });
  let skipped = false;
  for (const obj of walk) {
    const pair = pairOf(obj);
    if (!fitsOneAnswer(pair.key, pair.label)) { skipped = true; continue; }
    if (!bucket.offer(pair)) break;
  }
  const r = bucket.getResult();
  return { items: r.items, more: r.more || skipped };
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
const ruleChatRows = db.prepare("SELECT at, by, body FROM records WHERE verb = 'rule.chat' ORDER BY n");

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

function walkState() {
  // agentWord: each agent's last word about itself, listening or working (goal/G2.3); the ear says it, every time.
  // agentKey: the key each agent last wrote with (goal/G2.2 note 6), so the goal row can name its live agents' keys.
  const s = { change: 0, goals: Object.create(null), items: Object.create(null), agentsAt: Object.create(null), agentWord: Object.create(null), agentKey: Object.create(null), scopes: Object.create(null), profiles: Object.create(null), current: '' };
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
  return s;
}

function blank(id, title, goalId) {
  return { id: id, title: title, goal: !goalId, goalId: goalId || '', blocks: [], status: '', with: '', phaseWith: '',
    went: false, go: false, claims: Object.create(null), done: false, alone: false, closed: false, designComplete: false,
    alert: false, takenBy: '', boxTakenBy: '', takers: Object.create(null),
    box: '', version: 0, boxHistory: [], checks: [], chat: [], at: '', checked: false,
    // FILES TOUCHED, PER ITEM (goal/G8.8). Andy, 2026-10-09: "the list should be owned by the item. so updates to it
    // are available to all participants." Each writer's own paths, by its name, so one agent's list never touches
    // another's: { '<agent>': ['<path>', ...] }.
    files: Object.create(null) };
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
      // THE TAKER'S WRITE FREES THE BOX (goal/G4.20 point 9).
      if (it.boxTakenBy && r.by === it.boxTakenBy) it.boxTakenBy = '';
      return;
    case 'check.add': {
      const kind = String(b.kind);
      const number = kind + (it.checks.filter(function (c) { return c.kind === kind; }).length + 1);
      it.checks.push({ number: number, kind: kind, words: String(b.words), test: String(b.test || ''), state: 'open', by: String(b.asked || ''), at: String(b.asked ? r.at : '') });
      // A QUESTION RAISED BY A CHAT LINE (goal/G2.21) marks that line with this number, so the chat shows which line
      // the red question came from while the line's own text stays exactly as the agent wrote it.
      if (typeof b.forLine === 'number' && it.chat[b.forLine]) it.chat[b.forLine].q = number;
      return;
    }
    case 'check.set': {
      const c = it.checks.filter(function (x) { return x.number === String(b.check); })[0];
      if (c) { c.state = String(b.state); c.by = r.by; c.at = r.at; }
      return;
    }
    case 'chat.add':
      it.chat.push({ by: r.by, at: r.at, text: String(b.text), taken: '' });
      // HIS "<nick>:" LINE IS THAT AGENT'S (goal/G4.23). Andy: "the nicks as trigger for them to take a question | job".
      // A line of his starting with an agent's nick (case ignored) is taken for that agent, as its own line.take would
      // take it, under the label it writes with; a nick nobody holds, or an agent never heard from, takes nothing.
      if (r.by === 'andy') {
        const m = /^\s*([a-z0-9]{1,8})\s*:/i.exec(String(b.text));
        const key = m && Object.keys(s.profiles).filter(function (k) { return s.profiles[k].nick === m[1].toLowerCase(); })[0];
        const label = key && Object.keys(s.agentKey).filter(function (l) { return s.agentKey[l] === key; })[0];
        if (label) { it.chat[it.chat.length - 1].taken = label; it.takenBy = label; it.takers[label] = true; }
      }
      // THE TAKER'S ANSWER FREES THE ITEM (goal/G2.2 note 2): after it, any agent may write again.
      if (it.takenBy && r.by === it.takenBy) it.takenBy = '';
      return;
    case 'item.rename': it.title = String(b.title); return;
    case 'item.status': it.status = String(b.word); return;
    case 'item.take': it.with = r.by; it.takers[r.by] = true; return;
    // THE PHASES (goal/G5.7): the handler checked who may; the replay records it.
    // THE PHASE HOLDER IS ITS OWN (goal/G6.9): only phase.take holds a phase; a plain item.take sets "with" and nothing
    // the phase rules read. Andy, to G6 Q5: "add item to fix it." THE STATUS SAYS THE PHASE while it is held: Andy,
    // "when an agent is with an item, update its status with the phase that is running at the time. the desk should
    // do it, since it arbitrase phase-taking."
    case 'phase.take':
      it.with = r.by; it.phaseWith = r.by; it.status = String(b.phase); it.takers[r.by] = true; it.verified = false;
      // The key beside the label (goal/G5.9): a label he may rename, a key that stays.
      if (b.phase === 'red') { it.red = r.by; it.redKey = String(r.key || ''); it.phase = 'red'; }
      else if (b.phase === 'build') { it.builder = r.by; it.builderKey = String(r.key || ''); }
      else if (b.phase === 'verify') { it.verifier = r.by; it.verifierKey = String(r.key || ''); }
      return;
    case 'phase.done':
      it.with = ''; it.phaseWith = '';
      // Nobody holds the next phase yet: the status goes back to what his Go made it.
      it.status = 'running';
      // deskVerify's word is about ONE verify (goal/G8.3), so every step that starts the work again takes it away and
      // Done waits for deskVerify afresh.
      it.checked = false;
      if (b.phase === 'red') it.phase = 'build';
      else if (b.phase === 'build') it.phase = 'verify';
      else if (b.phase === 'verify') { if (b.pass === true) { it.verified = true; it.phase = ''; } else it.phase = 'build'; }
      return;
    // AND ONLY deskVerify BRINGS THE BUTTON (goal/G8.3). Andy, 2026-10-09: "best is, if the done button doesn't show up
    // until deskVerify allows it.", and "the builders claim is registered, but only deskVerify brings the button." So
    // the agent's verify still records verified, and this is deskVerify's own word on top of it. A rejection, a new
    // build or a new red takes it away again, since what it was given for is gone.
    case 'verify.pass':
      if (!it || !it.code) return;
      it.checked = true;
      return;
    // A VERIFY TAKEN BACK (goal/G8.3). Andy, 2026-10-09: "deskVerify only reject a done claim. this should prompt an
    // agent to pick the item up, raise red-questions if neccessary." It is the one thing deskVerify may do on his
    // node, and it writes as him; a rejected item goes back to build with the builder it had, so the agent who built
    // it picks it up, and Done is no longer offered. It presses nothing: "deskVerify will NOT press done or closed on
    // my behalf". The line naming the reds is written beside this record by the verb.
    case 'verify.reject':
      if (!it || !it.code || it.verified !== true) return;
      it.verified = false;
      it.checked = false;
      it.phase = 'build';
      it.phaseWith = '';
      it.with = '';
      it.status = 'running';
      return;
    // TAKING THE BOX (goal/G4.20 point 9). Andy: "anybody that takes somethings that affects the box, and the box
    // is red. cap also." The handler refuses a take while another stands, so what reaches here always lands.
    case 'box.take': it.boxTakenBy = r.by; it.takers[r.by] = true; return;
    // goal/G9.3: the holder lets the box go without writing it; the refusals are at the verb, so a replay only clears.
    case 'box.release': if (it.boxTakenBy === r.by) it.boxTakenBy = ''; return;
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
      if (g.members.indexOf(id) === -1) g.members.push(id);
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
        else it.checks.push({ number: 'G' + (it.checks.filter(function (c) { return c.kind === 'G'; }).length + 1), kind: 'G', words: words, test: '', state: 'open', by: 'desk', at: r.at });
      } else if (open.length) {
        it.checks = it.checks.filter(function (c) { return !(isCoreGrant(c) && c.state === 'open'); });
      }
      return;
    }
    case 'press': press(s, it, String(b.what), r, goalOf, b); return;
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
      Object.keys(s.items).forEach(function (id) { const m = s.items[id]; if (m.phaseWith === r.by) { m.phaseWith = ''; if (m.with === r.by) m.with = ''; } });
      return;
    // AN AGENT'S SCOPE (goal/G4.23), by its key, as he set it last; the handler refused anything malformed.
    // AN AGENT'S SCOPE (goal/G4.23), one field, as he set it last: '' nothing, '/' the repo root, else a folder. Records
    // written while it was a list replay to the same meaning: [] is '', [''] (the root) is '/', [f] is f.
    // AN AGENT'S PROFILE (goal/G4.23), his, as he set it last: its name and its nick.
    case 'profile.set': s.profiles[String(b.agent)] = { name: String(b.name), nick: String(b.nick) }; return;
    case 'scope.set': s.scopes[String(b.agent)] = typeof b.folder === 'string' ? b.folder
      : (Array.isArray(b.folders) && b.folders.length ? (String(b.folders[0]) === '' ? '/' : String(b.folders[0])) : ''); return;
    // TAKING HIS LINE (goal/G2.2 note 2). Andy: "an item can 'take' my message and be the only one to answer after
    // that, i then can solicit an answer from others." The taker's name goes on his latest line under the item,
    // and the item is the taker's to answer until it does; the handler refuses a take with no line or one already
    // taken, so what reaches here always lands.
    case 'line.take': {
      for (let i = it.chat.length - 1; i >= 0; i--) {
        if (it.chat[i].by !== 'andy') continue;
        if (!it.chat[i].taken) { it.chat[i].taken = r.by; it.takenBy = r.by; it.takers[r.by] = true; }
        return;
      }
      return;
    }
    default: return;
  }
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
  else if (what === 'code' && !it.goal && !it.subGoal) it.code = !it.code;
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
  else if (what === 'reopen') { it.done = false; it.closed = false; it.alone = false; it.claims = Object.create(null); }
  else if (what === 'close') it.closed = true;
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
  return g.members.filter(function (id) {
    const o = s.items[id];
    return o && o.id !== it.id && !o.done && !o.leftOut && o.blocks.indexOf(it.id) !== -1;
  });
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
function buttons(s, it) {
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
    if (allDone && !grantsOpen) out.push('done');
  // A CODE ITEM OFFERS DONE ON THE VERIFIER'S PASS ALONE (goal/G5.7), no claims needed.
  // AND DONE WAITS FOR deskVerify WHERE ONE RUNS (goal/G8.3). Andy, 2026-10-09: "best is, if the done button doesn't
  // show up until deskVerify allows it.", and "the builders claim is registered, but only deskVerify brings the
  // button." So a code item needs the verifier's pass AND deskVerify's own word (verify.pass) - but only while a
  // deskVerify runs on this node: on a box without one, Done follows the pass as it always has, or nothing there could
  // ever be done.
  } else if (!grantsOpen && (it.code ? (it.verified === true && (it.checked === true || !hasDeskVerify())) : Object.keys(it.claims).length)) out.push('done');
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
  if (it.goal && g && !g.abandoned && s.current !== it.id) out.push('make-current');
  // DELETE WHILE IN DESIGN (goal/G9.7). Andy, 2026-10-07: "the button bar of items will offer an arm-able [delete]
  // while in design mode." An item of a goal in design mode, never a goal itself; the dialog draws it from here, as it
  // draws every button of his.
  if (!it.goal && g && g.design) out.push('delete');
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
    // THE FILES TOUCHED (goal/G8.8), the whole item's, every writer's together: { path, by, core }. Andy: "that file
    // list should be visible in desk ui per item, core files market as requiring grants." Which paths are core is read
    // from js/coreFiles.js, the one list commitCheck already locks, so the mark and the grants cannot disagree.
    files: filesOf(it),
    // DESIGN-GREEN (goal/G6.8): no open red question on it.
    green: !openQ(it),
    // goal/G5.7: the phase it is in, and who did each.
    code: it.code === true, phase: it.phase || '', red: it.red || '', builder: it.builder || '', verifier: it.verifier || '',
    // goal/G2.22: whether the phase rules are lifted on it, so the dialog knows to stop offering Waive.
    waived: it.waived === true,
    // goal/G5.8: the rules in force at his Go, each { key, version }.
    rules: Array.isArray(it.rules) ? it.rules : [] };
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
    f.design = g.design;
    f.waiting = g.members.map(function (id) { return s.items[id]; }).concat([it]).filter(function (o) {
      return o && listed(s, o) && (buttons(s, o).length > 0 || asksOf(s, o) > 0);
    }).length;
    f.live = liveAgents(s);
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

function matchesText(it, text) {
  if ((it.id + ' ' + it.title).toLowerCase().indexOf(text) !== -1) return true;
  if (String(it.box || '').toLowerCase().indexOf(text) !== -1) return true;
  return it.chat.some(function (l) { return String(l.text).toLowerCase().indexOf(text) !== -1; });
}

// The goal first, then its items in session order; the newest goal first.
function searchItems(a) {
  const s = walkState();
  const text = String(a.text || '').toLowerCase();
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
      if (text && !matchesText(it, text)) return;
      out.push(JSON.stringify(facts(s, it)));
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
function findItems(a) {
  const s = walkState();
  const text = String(a.text || '').toLowerCase();
  const lineFilter = !!(a.by || a.since || a.before);
  const lineMatches = function (l) {
    if (a.by && l.by !== a.by) return false;
    if (a.since && !(String(l.at) >= a.since)) return false;
    if (a.before && !(String(l.at) < a.before)) return false;
    if (text && String(l.text).toLowerCase().indexOf(text) === -1) return false;
    return true;
  };
  const byLine = [];
  const byTitle = [];
  Object.keys(s.goals).forEach(function (gid) {
    if (s.goals[gid].abandoned) return;
    [gid].concat(s.goals[gid].members).forEach(function (id) {
      const it = s.items[id];
      if (!it) return;
      let newest = '';
      for (let i = it.chat.length - 1; i >= 0; i--) { if (lineMatches(it.chat[i])) { newest = String(it.chat[i].at); break; } }
      if (newest) byLine.push({ at: newest, it: it });
      else if (!lineFilter && (!text || (it.id + ' ' + it.title).toLowerCase().indexOf(text) !== -1)) byTitle.push({ at: String(it.at || ''), it: it });
    });
  });
  const newestFirst = function (x, y) { return x.at < y.at ? 1 : x.at > y.at ? -1 : 0; };
  return byLine.sort(newestFirst).concat(byTitle.sort(newestFirst)).map(function (w) { return JSON.stringify(facts(s, w.it)); });
}

function refused(code) { const e = new Error(code); e.refusal = code; return e; }

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
  // THE DESK SAYS SO WHEN AN ITEM ENTERS LIMBO (goal/G5.4), one line by desk under it, so every agent's listener
  // hears it and one takes it. An item that only slides into limbo as time passes (an agent going stale) is said
  // on the next write.
  const gidW = it ? (it.goal ? it.id : it.goalId)
    : verb === 'session.set' && body.session && body.session.goal ? String(body.session.goal.id) : after.current;
  const gW = after.goals[gidW];
  let saidLimbo = false;
  if (gW) gW.members.forEach(function (id) {
    if (limboOf(after, after.items[id]) && !limboOf(s, s.items[id])) {
      write('chat.add', { id: id, text: 'limbo: Go is on record, nobody is working on it, and no Done, grant or question is offered. An agent takes it and adds a red grant, a red question, or a Done.', by: 'desk', key: '' });
      saidLimbo = true;
    }
  });
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
  if (now && verb === 'chat.add') out.chat = now.chat[now.chat.length - 1];
  if (now && (verb === 'check.add' || verb === 'check.set')) out.checks = now.checks;
  // EVERY ROW IT CHANGED (desk/G3.10). Andy: "i just pressed the Go-All button in the list. and the G3.9 go button
  // didn't disarm." A press changes more than its own row (go-all, a done that unblocks, the goal's waiting), so the
  // facts of every row of the goal that differ now ride along, in this one object: one press, one object, never a
  // half-painted press (fileTransfer goal/G1.4 removed the publish coalescing; this ride-along never depended on it).
  if (it) out.rows = changedRows(s, after, it.goal ? it.id : it.goalId);
  // An agent's word changes the current goal's row (its working list), and that row travels (goal/G2.3).
  if (verb === 'agent.state' && after.current) out.rows = changedRows(s, after, after.current);
  appServer.publish(out);
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
  const g = s.goals[s.current];
  const items = [s.current].concat(g.members).map(function (id) { return s.items[id]; }).filter(Boolean).map(function (it) {
    return Object.assign(facts(s, it), { box: it.box, version: it.version, checks: it.checks,
      chat: it.chat.map(function (l) { return { by: l.by, at: l.at, text: l.text }; }) });
  });
  const doc = { change: change, line: Number(newestLine.get().rid) || 0, goal: s.current, writtenAt: new Date().toISOString(), items: items };
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
    return require('../../../js/kernel.js').core.ask('jobs.create', { command: process.execPath,
      args: [path.join(__dirname, 'goalShare.js'), '--repo', GOAL_REPO, '--path', repoPath, '--from', fromFile, '--message', message],
      // A UTILITY PROCESS (goal/G4.34): its job leaves Jobs once it exited cleanly; a failed share stays, to be seen.
      removeWhenDone: true }, base);
  }).then(function (r) {
    if (!r || r.status >= 300) console.error('desk: the node refused the goal share: ' + (r ? r.text : 'no answer'));
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
  const open = Object.keys(st.goals).some(function (gid) { const g = st.items[gid]; return g && listed(st, g) && !g.closed; });
  if (open) throw refused('bad-request');
  const used = Object.keys(st.goals).map(function (gid) { const m = /^goal\/G(\d+)$/.exec(gid); return m ? Number(m[1]) : 0; });
  const id = 'goal/G' + (Math.max.apply(null, [0].concat(used)) + 1);
  return write('session.set', { session: { goal: { id: id, title: 'New goal' }, items: [] }, by: w.by, key: w.key });
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
function lookForDeskVerify() {
  const port = Number(appServer.spirit.core.node.const.SPIRIT_PORT);
  if (!port) return;
  appServer.spirit.core.ask('jobs.api', { ask: 'api' }, 'http://127.0.0.1:' + port).then(function (r) {
    const body = r && r.status === 200 ? r.body : null;
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
  if (!caller || typeof caller !== 'object') throw refused('bad-request');
  if (caller.owner === true) return { by: 'andy', key: String(caller.key || '') };
  if (typeof caller.key !== 'string' || !caller.key) throw refused('bad-request');
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
function changesSince(n, line) {
  const out = { records: [], lines: [], n: n, line: line, more: false };
  const size = function () { return Buffer.byteLength(JSON.stringify(out), 'utf8'); };
  for (const r of recordsAfter.iterate(n)) {
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

appServer.serve({
  'log.add': {
    request: { json: '' }, reply: { added: true },
    handler: function (a) {
      const l = parsed(a.json);
      if (typeof l.key !== 'string' || !l.key) throw new Error('a line needs its key');
      // Refused, never stored to stall a read later (slim/G1.2 T4).
      if (!fitsOneAnswer(l.key, a.json)) throw tooLarge(oneAnswerBytes(l.key, a.json), ANSWER_ROOM);
      const r = addLine.run(l.key, String(l.at || ''), String(l.todo || ''), String(l.from || ''), String(l.kind || ''), String(l.text || ''), a.json);
      // A line of Andy's nudges the agent it was for, and nobody else (goal/G3.5).
      if (r.changes === 1 && l.from === 'andy' && l.peer) {
        nudge(nudgeKeys(walkState()).filter(function (k) { return k === String(l.peer); }));
      }
      return { added: r.changes === 1 };
    },
  },
  // THROUGH THE BUCKET (slim/G1.2 T1): the walk is ours (SQL's filters,
  // newest first), the cut and `more` are searchBucket's. '**' because a
  // single '*' never spans a '/' (gradedSearch.js), and every line holds one.
  'log.search': {
    request: { text: '', todo: '', since: '', kind: '', before: '' }, reply: { items: [{ key: '', label: '' }], more: false },
    handler: function (a) {
      const todo = a.todo === '-' ? '' : a.todo;
      const rows = findLines.iterate(a.todo, todo, a.kind, a.kind, a.since, a.since, a.before, a.before, a.text, a.text);
      return walked(rows, function (row) { return { key: row.key, label: row.line }; });
    },
  },
  // WHAT CHANGED SINCE (apiAuth/G1.12). Andy: "dsek needs an interface for that. desk can't serve agents at
  // different locations otherwise", and "yes on the verb". The records after change n and the lines after rowid
  // line, oldest first, as many as one answer holds; n and line come back as the cursors to resume from. Rowids,
  // not times: two lines can share one at, and a time cursor would re-read or miss them.
  'changes': {
    // A line is the object Desk stored, whatever keys it has, plus its rowid as line: so lines is an open list.
    request: { n: 0, line: 0 }, reply: { records: [{ n: 0, at: '', verb: '', by: '', key: '', body: '' }], lines: [], n: 0, line: 0, more: false },
    handler: function (a) { return changesSince(Number(a.n) || 0, Number(a.line) || 0); },
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
      return walked(searchItems(a), function (item) { return { key: JSON.parse(item).id, label: item }; });
    },
  },
  // EACH PANEL ITS OWN ANSWER. Andy: "what kind of app doesn't measure the sum of its packets?" and "lazy load the
  // panels when thy open". item.get is the item's facts; its box, checks and chat are asked for each on its own, so
  // no answer carries the sum of them and each fits one answer by itself.
  // A SEARCH FOR THE AGENTS (goal/G3.13): items by their lines, half a room like chat.search, a read.
  'items.find': {
    request: { text: '', by: '', since: '', before: '' }, reply: { items: [{ key: '', label: '' }], more: false },
    handler: function (a) {
      const bucket = searchBucket.createSearch({
        query: '**', maxBytes: SEARCH_ROOM,
        getLabelStringFromIncomingObject: function (pair) { return pair.label; },
        extractKeyAndLabelFromRow: function (pair) { return pair; },
      });
      let skipped = false;
      for (const item of findItems(a)) {
        const pair = { key: JSON.parse(item).id, label: item };
        if (oneAnswerBytes(pair.key, pair.label) > SEARCH_ROOM) { skipped = true; continue; }
        if (!bucket.offer(pair)) break;
      }
      const r = bucket.getResult();
      return { items: r.items, more: r.more || skipped };
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
  'item.checks': {
    request: { id: '' }, reply: { checks: [{ number: '', kind: '', words: '', test: '', state: '', by: '', at: '' }] },
    handler: function (a) {
      const it = walkState().items[String(a.id)];
      if (!it) throw refused('no-such-item');
      return { checks: it.checks };
    },
  },
  // THE CHAT IS A SEARCH (desk/G3.3). Andy: "why would the server not use bucket to give me the most recent
  // stuff?" Its newest lines, through the same bucket, in a whole answer of its own; oldest first.
  'item.chat': {
    request: { id: '' }, reply: { chat: [{ by: '', at: '', text: '', taken: '' }], chatMore: false },
    handler: function (a) {
      let it = walkState().items[String(a.id)];
      // A rule's chat (goal/G5.5) is read the same way, from its records.
      if (!it && /^rule\/\d+$/.test(String(a.id)) && newestRule.get(String(a.id))) {
        const lines = ruleChatRows.all().map(function (r) { const b = JSON.parse(r.body); return b.rule === String(a.id) ? { by: r.by, at: r.at, text: String(b.text), taken: '' } : null; }).filter(Boolean);
        it = { chat: lines };
      }
      if (!it) throw refused('no-such-item');
      const room = CHAT_ROOM;
      const bucket = searchBucket.createSearch({
        query: '**', maxBytes: room,
        getLabelStringFromIncomingObject: function (pair) { return pair.label; },
        extractKeyAndLabelFromRow: function (pair) { return pair; },
      });
      // A line too big for the room on its own is never offered, as walked() never offers one: it would close
      // the bucket with nothing in it (claude-windows's review).
      for (let i = it.chat.length - 1; i >= 0; i--) {
        const pair = { key: String(i), label: JSON.stringify(it.chat[i]) };
        if (chatLineBytes(i, it.chat[i]) > room) continue;
        if (!bucket.offer(pair)) break;
      }
      const chat = bucket.getResult().items.map(function (p) { return JSON.parse(p.label); }).reverse();
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
  'chat.search': {
    request: { id: '', text: '', by: '', since: '', before: '' }, reply: { items: [{ key: '', label: '' }], more: false },
    handler: function (a) {
      const it = walkState().items[String(a.id)];
      if (!it) throw refused('no-such-item');
      const text = String(a.text).toLowerCase();
      const bucket = searchBucket.createSearch({
        query: '**', maxBytes: SEARCH_ROOM,
        getLabelStringFromIncomingObject: function (pair) { return pair.label; },
        extractKeyAndLabelFromRow: function (pair) { return pair; },
      });
      // A line too big for the room on its own is never offered (as item.chat does): it is skipped, and said by more.
      let skipped = false;
      for (let i = it.chat.length - 1; i >= 0; i--) {
        const l = it.chat[i];
        if (a.by && l.by !== a.by) continue;
        if (a.since && !(String(l.at) >= a.since)) continue;
        if (a.before && !(String(l.at) < a.before)) continue;
        if (text && String(l.text).toLowerCase().indexOf(text) === -1) continue;
        const pair = { key: String(i), label: JSON.stringify({ by: l.by, at: l.at, text: l.text }) };
        if (oneAnswerBytes(pair.key, pair.label) > SEARCH_ROOM) { skipped = true; continue; }
        if (!bucket.offer(pair)) break;
      }
      const r = bucket.getResult();
      return { items: r.items, more: r.more || skipped };
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
      return { change: write('session.set', { session: sess, by: w.by, key: w.key }).change };
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
      if (!title) throw refused('bad-request');
      const args = { title: title, by: w.by, key: w.key };
      const r = write('goal.add', args, function (st) { args.minted = nextGoalId(st); });
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
      if (!title || require('../../../js/fieldRules.js').problem(title)) throw refused('bad-request');
      const args = { goal: gid, title: title, by: w.by, key: w.key };
      if (a.blocks !== undefined && String(a.blocks)) args.blocks = String(a.blocks);
      const r = write('item.add', args, function (st) {
        if (!st.goals[gid] || !st.items[gid]) throw refused('no-such-item');
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
      if (/^OPEN(?:\b|:)/m.test(String(a.text))) throw refused('bad-request');
      const s = write('box.write', Object.assign({}, a, { by: w.by, key: w.key }), function (st, it) {
        // ONLY THE TAKER WRITES while a box take stands (goal/G4.20 point 9). ONE RULE FOR EVERYBODY SINCE goal/G9.3:
        // Andy, 2026-10-07, asked whether his own take refuses an agent until he leaves the box: "yes. so it shoule be
        // among agents as well, the box is taken, and released after edit. it also helps agents stay out of each others
        // way." So his write is refused over another's take as an agent's is; he was the exception until then.
        if (it.boxTakenBy && w.by !== it.boxTakenBy) throw refused('taken');
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
      return { change: write('check.add', Object.assign({}, a, { by: w.by, key: w.key })).change };
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
        const c = it.checks.filter(function (x) { return x.number === a.check; })[0];
        if (!c) throw refused('no-row');
        if ((a.state === 'granted' && c.kind !== 'G') || (a.state === 'answered' && c.kind !== 'Q')) throw refused('bad-request');
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
      const it0 = walkState().items[String(a.id)];
      // ONLY THE TAKER ANSWERS while a take stands (goal/G2.2 note 2); his own lines, and the desk's, are never refused.
      if (it0 && it0.takenBy && w.by !== it0.takenBy && w.by !== 'andy' && w.by !== 'desk') throw refused('taken');
      // Measured as it is stored and answered: with its taken field (goal/G2.2), else the largest line that passes
      // here would not come back whole (oversize.js caught the ten bytes).
      const bytes = chatLineBytes(it0 ? it0.chat.length : 0, { by: w.by, at: new Date().toISOString(), text: String(a.text), taken: '' });
      if (bytes > CHAT_ROOM) throw tooLarge(bytes, CHAT_ROOM);
      const after = write('chat.add', Object.assign({}, a, { by: w.by, key: w.key }));
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
      // A QUESTION NEVER HIDES IN CHAT (goal/G2.21). Andy, 2026-10-06: "i want mechanical support in deskServer to
      // make agents add red-question to the design", after his own "i see no Q's and it really bugs me." when an
      // agent's question sat in chat and lit nothing: his List lights from open checks alone (asksOf), so an agent's
      // line that ENDS in a question mark raises one, with the line's own words and by that agent.
      // HIS OWN LINES AND THE DESK'S ARE NEVER CONVERTED: a check is what waits on HIM, not on us.
      // THE GROUP CHAT IS LEFT ALONE: it is closed, so the List never shows it, and a check there would be a red
      // nothing opens. A question for him that belongs to no item still belongs in a post under one.
      const asker = after.items[String(a.id)];
      if (asker && w.by !== 'andy' && w.by !== 'desk' && String(a.id) !== GROUP_CHAT && /\?[\s]*$/.test(String(a.text))) {
        write('check.add', { id: a.id, kind: 'Q', words: String(a.text), test: '', asked: w.by,
          forLine: asker.chat.length - 1, by: w.by, key: w.key });
      }
      return { change: after.change };
    },
  },
  // "rename (you)": Andy's alone.
  'item.rename': { request: { id: '', title: '' }, reply: { change: 0 }, handler: function (a, caller) { ownerOnly(caller); const w = writerOf(caller); return { change: write('item.rename', Object.assign({}, a, { by: w.by, key: w.key })).change }; } },
  // HIS DELETE (goal/G9.7): his alone, an item of a goal in design mode, never a goal. It is offered in the item's
  // buttons, so the refusal and the button cannot drift apart.
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
      const change = write('phase.done', { id: a.id, phase: String(a.phase), pass: a.pass === true, by: w.by, key: w.key }, function (st, it) {
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
          ['red', 'build', 'verify'].forEach(function (p) { if (!mayTake(s, s.items[id], p, w.by)) jobs.push({ id: id, phase: p }); });
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
      const fr = require('../../../js/fieldRules.js');
      if (RULE_TYPES.indexOf(a.type) === -1 || fr.problem(a.label) || fr.paragraphProblem(a.text)) throw refused('bad-request');
      const key = 'rule/' + (Number(ruleCount.get().c) + 1);
      addRuleRow.run(key, new Date().toISOString(), w.by, a.type, fr.normalize(a.label), 'proposed', fr.normalizeParagraph(a.text));
      appServer.publish({ rule: key });
      rulesChanged(key, 'added, proposed');
      return { key: key };
    },
  },
  'rule.get': {
    request: { key: '' }, reply: { key: '', label: '', type: '', status: '', text: '', draft: '', at: '', by: '' },
    handler: function (a) {
      const r = newestRule.get(String(a.key));
      if (!r) throw refused('no-such-item');
      const d = getDraft.get(r.key);
      return { key: r.key, label: r.label, type: r.type, status: r.status, text: r.text, draft: d ? d.text : '', at: r.at, by: r.by };
    },
  },
  'rule.draft': {
    request: { key: '', text: '' }, reply: { key: '' },
    handler: function (a, caller) {
      ownerOnly(caller);
      const fr = require('../../../js/fieldRules.js');
      if (!newestRule.get(String(a.key))) throw refused('no-such-item');
      if (fr.paragraphProblem(a.text)) throw refused('bad-request');
      putDraft.run(String(a.key), new Date().toISOString(), fr.normalizeParagraph(a.text));
      appServer.publish({ rule: String(a.key) });
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
      if (RULE_STATUSES.indexOf(a.status) === -1 || fr.paragraphProblem(a.text)) throw refused('bad-request');
      addRuleRow.run(r.key, new Date().toISOString(), 'andy', r.type, r.label, a.status, fr.normalizeParagraph(a.text));
      appServer.publish({ rule: r.key });
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
      const text = String(a.text || '').toLowerCase();
      const types = (Array.isArray(a.types) ? a.types : []).filter(Boolean);
      const statuses = (Array.isArray(a.statuses) ? a.statuses : []).filter(Boolean);
      const hits = newestRules.all().filter(function (r) {
        if (types.length && types.indexOf(r.type) === -1) return false;
        if (statuses.length && statuses.indexOf(r.status) === -1) return false;
        return !text || (r.label + '\n' + r.text).toLowerCase().indexOf(text) !== -1;
      });
      return walked(hits, function (r) { return { key: r.key, label: JSON.stringify({ label: r.label, type: r.type, status: r.status }) }; });
    },
  },
  'agent.state': {
    request: { word: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      const w = writerOf(caller);
      if (a.word !== 'listening' && a.word !== 'working') throw refused('bad-request');
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
        if (!it || !it.code || it.verified !== true) throw refused('not-offered');
      }).change };
    },
  },
  'verify.reject': {
    request: { id: '', why: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      ownerOnly(caller);
      const w = writerOf(caller);
      const change = write('verify.reject', { id: a.id, by: w.by, key: w.key }, function (st, it) {
        if (!it || !it.code || it.verified !== true) throw refused('not-offered');
      }).change;
      const why = String(a.why || '').trim();
      write('chat.add', { id: a.id, text: 'verify rejected: ' + (why || 'the item\'s suites did not hold'), by: 'desk', key: '' });
      return { change: change };
    },
  },
  'item.status': { request: { id: '', word: '' }, reply: { change: 0 }, handler: function (a, caller) { const w = writerOf(caller); return { change: write('item.status', Object.assign({}, a, { by: w.by, key: w.key })).change }; } },
  'item.take': { request: { id: '' }, reply: { change: 0 }, handler: function (a, caller) { const w = writerOf(caller); return { change: write('item.take', Object.assign({}, a, { by: w.by, key: w.key })).change }; } },
  // AGENT SCOPES (goal/G4.23). Andy: "i alone, i definitely will consult you", "ahh, the default: nothing.", and "you
  // set one field: '' = nothing '/' = repo-root all that are selectable from drop-down". scope.set is his alone: one
  // field per agent, by its key: '' nothing, '/' the repo root, or a repo folder ending in '/'. scope.get answers it,
  // agent '' being the caller; an agent never set answers ''. The commit check reads it (commitCheck.js). Desk verbs,
  // not node verbs.
  'scope.set': {
    request: { agent: '', folder: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      ownerOnly(caller);
      const w = writerOf(caller);
      if (!a.agent) throw refused('bad-request');
      const f = a.folder;
      const ok = f === '' || f === '/' || (/\/$/.test(f) && !/^\//.test(f) && !/(^|\/)\.\.(\/|$)/.test(f) && f.indexOf('\\') === -1);
      if (!ok) throw refused('bad-request');
      return { change: write('scope.set', { agent: a.agent, folder: f, by: w.by, key: w.key }).change };
    },
  },
  // AGENT PROFILES (goal/G4.23). Andy: "so two more fields for repo-root-agents: name <agent-name> nick: <wc | wsl |
  // ubi>", "build them now.", "the profiles are for me, in desk. a dataset that deskServer stores for me and let's you
  // see." profile.set is his alone; profile.get answers any agent's ('' the caller). A name passes the label rule
  // (fieldRules); a nick is 1-8 of a-z0-9, one agent's alone. Desk verbs, not node verbs.
  'profile.set': {
    request: { agent: '', name: '', nick: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      ownerOnly(caller);
      const w = writerOf(caller);
      if (!a.agent || require('../../../js/fieldRules.js').problem(a.name) || !/^[a-z0-9]{1,8}$/.test(a.nick)) throw refused('bad-request');
      const held = walkState().profiles;
      if (Object.keys(held).some(function (k) { return k !== a.agent && held[k].nick === a.nick; })) throw refused('taken');
      return { change: write('profile.set', { agent: a.agent, name: a.name, nick: a.nick, by: w.by, key: w.key }).change };
    },
  },
  'profile.get': {
    request: { agent: '' }, reply: { name: '', nick: '' },
    handler: function (a, caller) {
      const p = walkState().profiles[a.agent || writerOf(caller).key];
      return { name: p ? p.name : '', nick: p ? p.nick : '' };
    },
  },
  'scope.get': {
    request: { agent: '' }, reply: { folder: '' },
    handler: function (a, caller) {
      const key = a.agent || writerOf(caller).key;
      return { folder: walkState().scopes[key] || '' };
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
      const it = walkState().items[String(a.id)];
      if (!it) throw refused('no-such-item');
      if (it.boxTakenBy && it.boxTakenBy !== w.by) throw refused('taken');
      return { change: write('box.take', { id: a.id, by: w.by, key: w.key }).change };
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
      const it = walkState().items[String(a.id)];
      if (!it) throw refused('no-such-item');
      if (!it.boxTakenBy) return { change: walkState().change };
      if (it.boxTakenBy !== w.by) throw refused('taken');
      return { change: write('box.release', { id: a.id, by: w.by, key: w.key }).change };
    },
  },
  // TAKING HIS LINE (goal/G2.2 note 2): an agent takes Andy's latest line under an item and is the only one to
  // answer until it does. First wins; a second take is refused taken; an item with no line of his refuses no-row.
  'line.take': {
    request: { id: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      const w = writerOf(caller);
      if (w.by === 'andy') throw refused('bad-request');
      const it = walkState().items[String(a.id)];
      if (!it) throw refused('no-such-item');
      // ONE TAKER UNTIL IT ANSWERS (claude-windows's review): a take on a newer line of his while the first stands
      // would hand the item to a second agent and have the first's answer refused. The item is the taker's.
      if (it.takenBy) throw refused('taken');
      let his = null;
      for (let i = it.chat.length - 1; i >= 0; i--) { if (it.chat[i].by === 'andy') { his = it.chat[i]; break; } }
      if (!his) throw refused('no-row');
      if (his.taken) throw refused('taken');
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
      if (PRESSES.indexOf(a.what) === -1) throw refused('bad-request');
      if (OWNER_PRESSES.indexOf(a.what) !== -1) ownerOnly(caller);
      const w = writerOf(caller);
      // START DESIGN WITH NOTHING OPEN STARTS A NEW GOAL (desk/G3.1). Andy: "start design mode should start a new
      // project if nothing is in the list". It arrives in design mode; he names it.
      if (a.what === 'start-design' && a.id === '') return { change: newGoal(w).change };
      const body = Object.assign({}, a, { by: w.by, key: w.key });
      if (a.what === 'go' || a.what === 'go-all') body.rules = rulesForGo(walkState(), a.id, a.what);
      return { change: write('press', body, function (st, it) {
        const offered = buttons(st, it);
        // goal/G2.19 puts make-current on the same leash: offered or refused, so a closed goal takes Reopen first.
        if ((a.what === 'go' || a.what === 'go-all' || a.what === 'close' || a.what === 'reopen' || a.what === 'make-current') && offered.indexOf(a.what) === -1) throw refused('not-offered');
        if (a.what === 'bring-back' && !it.closed) throw refused('not-offered');
        if (a.what === 'code' && (it.goal || it.subGoal)) throw refused('not-offered');
        // DESIGN-GREEN GATES THEM (goal/G6.8): his End design while any item of the goal has an open red question, a Go
        // on an item with one, a go-all while any item of the goal has one: refused.
        const gOf = st.goals[it.goal ? it.id : it.goalId];
        const members = gOf ? gOf.members : [];
        if ((a.what === 'end-design' || a.what === 'go-all') && notGreen(st, members.concat(it.goal ? [it.id] : [])).length) throw refused('not-offered');
        if (a.what === 'go' && openQ(it)) throw refused('not-offered');
        // NO CLAIM BEFORE HIS GO (goal/G3.9). Andy, 2026-10-03: "yes, the desk may refuse a claim-done, on an item
        // without 'go' on record", "the actual contract is consumed between 'go' and 'done'". It replaces
        // goal/G2.13's "a claim consumes the Go" for that case. A goal takes the press as before (goal/G2.10).
        if (a.what === 'claim-done' && !it.goal && !it.go) throw refused('not-offered');
        // The group chat's anchor stays closed (goal/G3.10): nobody brings it back onto the List.
        if (a.what === 'bring-back' && it.id === GROUP_CHAT) throw refused('not-offered');
      }).change };
    },
  },
  'state.get': { request: {}, reply: { json: '' }, handler: function () { return { json: doc('state') }; } },
  'state.set': { request: { json: '' }, reply: { saved: true }, handler: function (a) { return saveDoc('state', a.json); } },
  'seen.get': { request: {}, reply: { json: '' }, handler: function () { return { json: doc('seen') }; } },
  'seen.set': { request: { json: '' }, reply: { saved: true }, handler: function (a) { return saveDoc('seen', a.json); } },
// The bundle a peer user needs (apiAuth/G1.10, DEPENDENCIES): the agents'
// protocol spans most of this table — searches, reads, writes, presses,
// changes — so the minimum is the app itself, one app-level grant-shape.
}, { dependencies: ['desk'] });
