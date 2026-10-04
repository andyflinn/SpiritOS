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
  const s = { change: 0, goals: Object.create(null), items: Object.create(null), agentsAt: Object.create(null), agentWord: Object.create(null), agentKey: Object.create(null), current: '' };
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
  return { id: id, title: title, goal: !goalId, goalId: goalId || '', blocks: [], status: '', with: '',
    went: false, go: false, claims: Object.create(null), done: false, alone: false, closed: false, designComplete: false,
    alert: false, takenBy: '', boxTakenBy: '',
    box: '', version: 0, boxHistory: [], checks: [], chat: [], at: '' };
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
      const g = s.goals[gid] || (s.goals[gid] = { id: gid, design: true, abandoned: false, members: [] });
      const goalItem = s.items[gid] || (s.items[gid] = blank(gid, '', ''));
      goalItem.title = String(sess.goal.title || goalItem.title);
      goalItem.at = r.at;
      const ids = [];
      (sess.items || []).forEach(function (x) {
        const id = String(x.id || '');
        if (!id) return;
        const one = s.items[id] || (s.items[id] = blank(id, '', gid));
        one.title = String(x.title || one.title);
        one.goalId = gid;
        one.blocks = (Array.isArray(x.blocks) ? x.blocks : [x.blocks || gid]).map(String);
        one.at = r.at;
        one.leftOut = false;
        ids.push(id);
      });
      // LEFT OUT IS CLOSED, NEVER DELETED (goal/G4.24). Andy: "1. sounds dumb that the \"archive\" is not
      // searchable.", "if deleted is just a flag in the database, we can just ignore it from now on". An item a new
      // session leaves out stays a member, after the session's own, closed, with its box, checks and chat, so
      // [Include Closed] finds it; the records replay to the same, so items left out before this come back too.
      // It blocks nothing any more (blockers skips it), as it blocked nothing while it was deleted.
      const kept = g.members.filter(function (id) { return ids.indexOf(id) === -1 && s.items[id]; });
      kept.forEach(function (id) { s.items[id].closed = true; s.items[id].leftOut = true; });
      g.members = ids.concat(kept);
      s.current = gid;
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
      it.checks.push({ number: number, kind: kind, words: String(b.words), test: String(b.test || ''), state: 'open', by: '', at: '' });
      return;
    }
    case 'check.set': {
      const c = it.checks.filter(function (x) { return x.number === String(b.check); })[0];
      if (c) { c.state = String(b.state); c.by = r.by; c.at = r.at; }
      return;
    }
    case 'chat.add':
      it.chat.push({ by: r.by, at: r.at, text: String(b.text), taken: '' });
      // THE TAKER'S ANSWER FREES THE ITEM (goal/G2.2 note 2): after it, any agent may write again.
      if (it.takenBy && r.by === it.takenBy) it.takenBy = '';
      return;
    case 'item.rename': it.title = String(b.title); return;
    case 'item.status': it.status = String(b.word); return;
    case 'item.take': it.with = r.by; return;
    // TAKING THE BOX (goal/G4.20 point 9). Andy: "anybody that takes somethings that affects the box, and the box
    // is red. cap also." The handler refuses a take while another stands, so what reaches here always lands.
    case 'box.take': it.boxTakenBy = r.by; return;
    case 'press': press(s, it, String(b.what), r, goalOf); return;
    // THE LISTENER'S WORD (goal/G2.3). Andy: "it starts, when the agent stops listening to do a task, and it
    // stops when the agent goes back to listening. the listening script can toggle those two?"
    case 'agent.state': s.agentWord[r.by] = String(b.word); return;
    // TAKING HIS LINE (goal/G2.2 note 2). Andy: "an item can 'take' my message and be the only one to answer after
    // that, i then can solicit an answer from others." The taker's name goes on his latest line under the item,
    // and the item is the taker's to answer until it does; the handler refuses a take with no line or one already
    // taken, so what reaches here always lands.
    case 'line.take': {
      for (let i = it.chat.length - 1; i >= 0; i--) {
        if (it.chat[i].by !== 'andy') continue;
        if (!it.chat[i].taken) { it.chat[i].taken = r.by; it.takenBy = r.by; }
        return;
      }
      return;
    }
    default: return;
  }
}

function press(s, it, what, r, goalOf) {
  const g = goalOf(it.id);
  if (what === 'start-design' && g) g.design = true;
  else if (what === 'end-design' && g) g.design = false;
  else if (what === 'abandon' && g) g.abandoned = true;
  else if (what === 'design-complete') { it.designComplete = true; it.status = 'ready'; }
  // HIS GO IS ON RECORD (goal/G3.9): `go` is set by his go and go-all alone and by nothing else; `went` stays the
  // state of the item, which older records set in other ways.
  else if (what === 'go') { it.went = true; it.go = true; it.status = 'running'; }
  else if (what === 'go-all' && g) goable(s, g).forEach(function (m) { m.went = true; m.go = true; m.status = 'running'; });
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
  if (!it.goal && !claimed && g && !g.design && !it.went && !blockers(s, it).length) out.push('go');
  // A GOAL OFFERS DONE ONLY WHEN EVERY ITEM IS DONE OR CLOSED, AND NEVER ON A CLAIM (goal/G2.10). Andy: "the goal
  // should only offer a done button when all items are done", and "the goals done button should be tied to the
  // condition that all visible items are done" — so an item added open takes it away again, and a claim-done
  // pressed against the goal id offers nothing by itself. An item's own rule is unchanged: a claim offers Done.
  if (it.goal) {
    const allDone = g && g.members.length > 0 && g.members.every(function (id) { const m = s.items[id]; return m && (m.done || m.closed); });
    if (allDone) out.push('done');
  } else if (Object.keys(it.claims).length) out.push('done');
  if (it.goal && g && goable(s, g).length) out.push('go-all');
  if (!it.goal && !it.went && !claimed) out.push('close');
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
  return !!g && !g.abandoned && !it.closed;
}

// WHAT WAITS ON HIM (goal/G4.20 points 10-11): open grants, open questions, and open checks of his while Done is
// offered. Andy: "if those two things would match at all times, id know exactly where i need to navigate to."
// The List's ICON.ERROR is drawn from this alone.
function asksOf(s, it) {
  const doneOffered = buttons(s, it).indexOf('done') !== -1;
  return it.checks.filter(function (c) {
    return c.state === 'open' && (c.kind === 'G' || c.kind === 'Q' || (c.kind === 'C' && doneOffered));
  }).length;
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
    boxTaken: it.boxTakenBy || '' };
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
    f.live = Object.keys(s.agentsAt).filter(function (a) { return now - Date.parse(s.agentsAt[a]) < LIVE_MS; }).sort();
    // WHO IS WORKING (goal/G2.3): the live agents whose last word is working. A stale working clears with
    // liveness, since an ear killed by its limit or a node restart says nothing (Andy: "while an agent is
    // working, i should leave it alone.").
    f.working = f.live.filter(function (a) { return s.agentWord[a] === 'working'; });
    // ITS LIVE AGENTS' KEYS (goal/G2.2 note 6): the page draws the Team tabs from live and sends to these keys,
    // so an agent working only through item chat keeps its tab (found live: "still can't see you on desk").
    f.agents = {};
    f.live.forEach(function (a) { if (s.agentKey[a]) f.agents[a] = s.agentKey[a]; });
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
  const now = it ? after.items[it.id] : null;
  // THE CHANGE ITSELF TRAVELS (desk/G2.7, "no pulling"): the item's facts and
  // whether it is still on the List; a box write adds the box, a chat line the
  // line, a check its item's checks. The page paints from this.
  const out = { change: Number(r.lastInsertRowid), verb: verb, item: now ? facts(after, now) : null };
  if (now) out.listed = listed(after, now);
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
  writeGoalFile(after, verb, a, Number(r.lastInsertRowid));
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
  const his = verb === 'press' && ['go', 'go-all', 'done', 'reopen', 'close'].indexOf(a.what) !== -1;
  if (!his && verb !== 'session.set') return;
  const g = s.goals[s.current];
  const items = [s.current].concat(g.members).map(function (id) { return s.items[id]; }).filter(Boolean).map(function (it) {
    return Object.assign(facts(s, it), { box: it.box, version: it.version, checks: it.checks,
      chat: it.chat.map(function (l) { return { by: l.by, at: l.at, text: l.text }; }) });
  });
  const doc = { change: change, line: Number(newestLine.get().rid) || 0, goal: s.current, writtenAt: new Date().toISOString(), items: items };
  try { fs.writeFileSync(GOAL_STATE_FILE, JSON.stringify(doc, null, 1) + '\n'); } catch (e) { console.error('desk: the goal file was not written: ' + ((e && e.message) || e)); return; }
  shareGoalFile();
}
// The node runs goalShare.js as a job: asked at the node's door, SPIRIT_CALLBACK_URL (the one every spawned process
// speaks through), through the kernel as the nudge is (goal/G3.5), with the verb the shell's Start Job uses.
function shareGoalFile() {
  const url = process.env.SPIRIT_CALLBACK_URL;
  if (!url) { console.error('desk: no SPIRIT_CALLBACK_URL, so the goal file is not shared'); return; }
  let base = '';
  try { base = new URL(url).origin; } catch (e) { console.error('desk: SPIRIT_CALLBACK_URL is no URL: ' + url); return; }
  Promise.resolve().then(function () {
    return require('../../../js/kernel.js').core.ask('jobs.create', { command: process.execPath,
      args: [path.join(__dirname, 'goalShare.js'), '--repo', GOAL_REPO, '--path', GOAL_PATH, '--from', GOAL_STATE_FILE] }, base);
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

const PRESSES = ['go', 'go-all', 'claim-done', 'done', 'reopen', 'close', 'bring-back', 'abandon', 'start-design', 'end-design', 'design-complete', 'seen'];
// Andy's alone (G2.1 review). His presses carry the owner's caller (the
// mark the door forwards, apiAuth/G1.13); a member's are refused. The
// agents keep claim-done, design-complete and bring-back.
const OWNER_PRESSES = ['go', 'go-all', 'done', 'reopen', 'close', 'abandon', 'start-design', 'end-design', 'seen'];
function ownerOnly(caller) { if (!caller || caller.owner !== true) throw refused('not-owner'); }

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
      const it = walkState().items[String(a.id)];
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
      const s = write('box.write', Object.assign({}, a, { by: w.by, key: w.key }), function (st, it) {
        // ONLY THE TAKER WRITES while a box take stands (goal/G4.20 point 9); his writes are never refused.
        if (it.boxTakenBy && w.by !== it.boxTakenBy && w.by !== 'andy') throw refused('taken');
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
      return { change: after.change };
    },
  },
  // "rename (you)": Andy's alone.
  'item.rename': { request: { id: '', title: '' }, reply: { change: 0 }, handler: function (a, caller) { ownerOnly(caller); const w = writerOf(caller); return { change: write('item.rename', Object.assign({}, a, { by: w.by, key: w.key })).change }; } },
  // THE LISTENER'S WORD (goal/G2.3): listening when its ear arms, working when the ear hands a line over. From
  // the caller the door hands over, never an argument; any other word is refused. The write publishes the goal
  // row with its working list, so the Team tab paints from the publish (goal/G2.4).
  'agent.state': {
    request: { word: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      const w = writerOf(caller);
      if (a.word !== 'listening' && a.word !== 'working') throw refused('bad-request');
      return { change: write('agent.state', { word: a.word, by: w.by, key: w.key }).change };
    },
  },
  'item.status': { request: { id: '', word: '' }, reply: { change: 0 }, handler: function (a, caller) { const w = writerOf(caller); return { change: write('item.status', Object.assign({}, a, { by: w.by, key: w.key })).change }; } },
  'item.take': { request: { id: '' }, reply: { change: 0 }, handler: function (a, caller) { const w = writerOf(caller); return { change: write('item.take', Object.assign({}, a, { by: w.by, key: w.key })).change }; } },
  // TAKING THE BOX (goal/G4.20 point 9): an agent takes the box before a change it will write (cap, split, an
  // update), and the box is drawn red until its write. First wins; another agent's take is refused taken; Andy
  // takes nothing, as with line.take. A desk verb, not a node verb.
  'box.take': {
    request: { id: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      const w = writerOf(caller);
      if (w.by === 'andy') throw refused('bad-request');
      const it = walkState().items[String(a.id)];
      if (!it) throw refused('no-such-item');
      if (it.boxTakenBy && it.boxTakenBy !== w.by) throw refused('taken');
      return { change: write('box.take', { id: a.id, by: w.by, key: w.key }).change };
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
      return { change: write('press', Object.assign({}, a, { by: w.by, key: w.key }), function (st, it) {
        const offered = buttons(st, it);
        if ((a.what === 'go' || a.what === 'go-all' || a.what === 'close' || a.what === 'reopen') && offered.indexOf(a.what) === -1) throw refused('not-offered');
        if (a.what === 'bring-back' && !it.closed) throw refused('not-offered');
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
