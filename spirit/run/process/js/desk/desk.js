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

function walkState() {
  // agentWord: each agent's last word about itself, listening or working (goal/G2.3); the ear says it, every time.
  const s = { change: 0, goals: Object.create(null), items: Object.create(null), agentsAt: Object.create(null), agentWord: Object.create(null), current: '' };
  const item = function (id) { return s.items[id] || null; };
  const goalOf = function (id) { const it = item(id); return it ? (it.goal ? s.goals[it.id] : s.goals[it.goalId]) : null; };
  for (const r of allRecords.iterate()) {
    s.change = r.n;
    let b = {};
    try { b = JSON.parse(r.body); } catch (e) { continue; }
    // Writers other than him and the desk itself are agents, and a write is their liveness.
    if (r.by !== 'andy' && r.by !== 'desk') s.agentsAt[r.by] = r.at;
    apply(s, r, b, item, goalOf);
  }
  return s;
}

function blank(id, title, goalId) {
  return { id: id, title: title, goal: !goalId, goalId: goalId || '', blocks: [], status: '', with: '',
    went: false, claims: Object.create(null), done: false, alone: false, closed: false, designComplete: false,
    agentLineN: 0, seenN: 0, alert: false,
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
        ids.push(id);
      });
      // Rows appear or go: an item left out of the new session leaves the goal.
      g.members.forEach(function (id) { if (ids.indexOf(id) === -1) delete s.items[id]; });
      g.members = ids;
      s.current = gid;
      return;
    }
    case 'box.write':
      it.boxHistory.push({ version: it.version + 1, by: r.by, at: r.at, text: String(b.text) });
      it.box = String(b.text);
      it.version += 1;
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
      it.chat.push({ by: r.by, at: r.at, text: String(b.text) });
      // HIS OWN LINE IS HIS SEEN (goal/G2.1 note 3). Andy: "when I'm the originator of a chat entry, no red
      // mark should appear in the list." His answer acknowledges every agent line before it.
      // The desk's own line (goal/G2.5, "message delivered, <agent> busy") is addressed to him and stars nothing.
      if (r.by === 'andy') it.seenN = r.n; else if (r.by !== 'desk') it.agentLineN = r.n;
      return;
    case 'item.rename': it.title = String(b.title); return;
    case 'item.status': it.status = String(b.word); return;
    case 'item.take': it.with = r.by; return;
    case 'press': press(s, it, String(b.what), r, goalOf); return;
    // THE LISTENER'S WORD (goal/G2.3). Andy: "it starts, when the agent stops listening to do a task, and it
    // stops when the agent goes back to listening. the listening script can toggle those two?"
    case 'agent.state': s.agentWord[r.by] = String(b.word); return;
    default: return;
  }
}

function press(s, it, what, r, goalOf) {
  const g = goalOf(it.id);
  if (what === 'start-design' && g) g.design = true;
  else if (what === 'end-design' && g) g.design = false;
  else if (what === 'abandon' && g) g.abandoned = true;
  else if (what === 'design-complete') { it.designComplete = true; it.status = 'ready'; }
  else if (what === 'go') { it.went = true; it.status = 'running'; }
  else if (what === 'go-all' && g) goable(s, g).forEach(function (m) { m.went = true; m.status = 'running'; });
  else if (what === 'claim-done') it.claims[r.by] = true;
  else if (what === 'done') { it.done = true; it.alone = !Object.keys(it.claims).length; }
  else if (what === 'reopen') { it.done = false; it.alone = false; it.claims = Object.create(null); }
  else if (what === 'close') it.closed = true;
  // A BROUGHT-BACK ITEM DRAWS HIS EYE (goal/G2.1 note 6). Andy: "the row should immediately pop back into
  // visibility, with the attention-grabbing error icon, to draw my attention." The alert stands until his seen.
  else if (what === 'bring-back') { it.closed = false; it.alert = true; }
  else if (what === 'seen') { it.seenN = r.n; it.alert = false; }
}

// What blocks an item: every open item of its goal that names it in `blocks`.
// Desk's meaning: "an item names what it blocks".
function blockers(s, it) {
  const g = s.goals[it.goal ? it.id : it.goalId];
  if (!g) return [];
  return g.members.filter(function (id) {
    const o = s.items[id];
    return o && o.id !== it.id && !o.done && o.blocks.indexOf(it.id) !== -1;
  });
}

// The buttons, decided here once for the List and the dialog alike.
//   Go!    after design ends (Andy's "end design mode."), not yet gone, nothing open blocks it
//   Done   once one agent has claimed ("1 agents consent will offer done buttons")
//   Close and Reopen once done
//   Go all on a goal while any of its items offers Go! (desk/G3.4, Andy: "i should
//          have a go-all button for fixing rounds")
//   none once closed
function buttons(s, it) {
  const g = s.goals[it.goal ? it.id : it.goalId];
  if (it.closed) return [];
  if (it.done) return ['close', 'reopen'];
  const out = [];
  // A GOAL NEVER OFFERS GO! (desk/G3.7): its items are gone, not the goal itself.
  if (!it.goal && g && !g.design && !it.went && !blockers(s, it).length) out.push('go');
  // A GOAL OFFERS DONE ONCE EVERY ITEM IS CLOSED, no claim needed (goal/G2.1 note 5). Andy: "the done button
  // should appear on the goal as soon as it is no longer blocked".
  const allClosed = it.goal && g && g.members.length > 0 && g.members.every(function (id) { const m = s.items[id]; return m && m.closed; });
  if (Object.keys(it.claims).length || allClosed) out.push('done');
  if (it.goal && g && goable(s, g).length) out.push('go-all');
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

function facts(s, it) {
  const f = { id: it.id, title: it.title, goal: it.goal ? '' : it.goalId, status: it.closed ? 'closed' : it.done ? 'done' : it.status,
    with: it.with, buttons: buttons(s, it), blocking: it.blocks.slice(), blocked: blockers(s, it),
    // A red star: an agent's line newer than his last seen ("seen, fold (you): stars clear").
    alone: it.alone, star: it.agentLineN > it.seenN, alert: it.alert === true };
  if (it.goal) {
    const g = s.goals[it.id];
    const now = Date.now();
    f.design = g.design;
    f.waiting = g.members.map(function (id) { return s.items[id]; }).concat([it]).filter(function (o) {
      return o && listed(s, o) && (buttons(s, o).length > 0 || o.star);
    }).length;
    f.live = Object.keys(s.agentsAt).filter(function (a) { return now - Date.parse(s.agentsAt[a]) < LIVE_MS; }).sort();
    // WHO IS WORKING (goal/G2.3): the live agents whose last word is working. A stale working clears with
    // liveness, since an ear killed by its limit or a node restart says nothing (Andy: "while an agent is
    // working, i should leave it alone.").
    f.working = f.live.filter(function (a) { return s.agentWord[a] === 'working'; });
  }
  return f;
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
      if (!it || !(listed(s, it) || (latest && !s.goals[gid].abandoned))) return;
      if (text && (it.id + ' ' + it.title).toLowerCase().indexOf(text) === -1) return;
      out.push(JSON.stringify(facts(s, it)));
    });
  });
  return out;
}

function refused(code) { const e = new Error(code); e.refusal = code; return e; }

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
  return after;
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
    request: { text: '', currentGoalOnly: false, goalsOnly: false }, reply: { items: [{ key: '', label: '' }], more: false },
    handler: function (a) {
      return walked(searchItems(a), function (item) { return { key: JSON.parse(item).id, label: item }; });
    },
  },
  // EACH PANEL ITS OWN ANSWER. Andy: "what kind of app doesn't measure the sum of its packets?" and "lazy load the
  // panels when thy open". item.get is the item's facts; its box, checks and chat are asked for each on its own, so
  // no answer carries the sum of them and each fits one answer by itself.
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
    request: { id: '' }, reply: { chat: [{ by: '', at: '', text: '' }], chatMore: false },
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
      const s = write('box.write', Object.assign({}, a, { by: w.by, key: w.key }), function (st, it) { if (a.version !== it.version) throw refused('box-moved'); });
      return { change: s.change, version: s.items[a.id].version };
    },
  },
  'check.add': {
    request: { id: '', kind: '', words: '', test: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      const w = writerOf(caller);
      if (a.kind !== 'C' && a.kind !== 'T') throw new Error('a check is C or T');
      return { change: write('check.add', Object.assign({}, a, { by: w.by, key: w.key })).change };
    },
  },
  'check.set': {
    request: { id: '', check: '', state: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      const w = writerOf(caller);
      if (['open', 'passed', 'failed'].indexOf(a.state) === -1) throw new Error('a check is open, passed or failed');
      return { change: write('check.set', Object.assign({}, a, { by: w.by, key: w.key }), function (st, it) {
        if (!it.checks.some(function (c) { return c.number === a.check; })) throw refused('no-row');
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
      const bytes = chatLineBytes(it0 ? it0.chat.length : 0, { by: w.by, at: new Date().toISOString(), text: String(a.text) });
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
