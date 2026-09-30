'use strict';

// spirit/run/process/js/desk/desk.js
// THE DESK SERVER — desk/G1.3.
//
//   Andy, 2026-09-29: "i might want a process that serves the data through
//   desk.db", and, on where its state lives, "appServer states ARE a subset
//   of the nodes state" and "any appServer state is none of git's business".
//
// DECIDED in Desk (desk/G1), not this file's to undo:
//   D5  its state is relay-state/process/desk/: desk.db and Andy's voice
//       file, never in git. The node names that folder and hands it over as
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
function fitsOneAnswer(key, line) {
  return Buffer.byteLength(JSON.stringify({ items: [{ key: String(key), label: String(line) }], more: false }), 'utf8') <= ANSWER_ROOM;
}
function tooLarge() { const e = new Error('line too large to come back in one answer'); e.refusal = 'line-too-large'; return e; }

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
const addRecord = db.prepare('INSERT INTO records (at, verb, by, body) VALUES (?, ?, ?, ?)');
const allRecords = db.prepare('SELECT n, at, verb, by, body FROM records ORDER BY n');

// An agent counts as live for ten minutes after its last write (Andy: "fine.").
const LIVE_MS = 10 * 60 * 1000;

function walkState() {
  const s = { change: 0, goals: Object.create(null), items: Object.create(null), agentsAt: Object.create(null), current: '' };
  const item = function (id) { return s.items[id] || null; };
  const goalOf = function (id) { const it = item(id); return it ? (it.goal ? s.goals[it.id] : s.goals[it.goalId]) : null; };
  for (const r of allRecords.iterate()) {
    s.change = r.n;
    let b = {};
    try { b = JSON.parse(r.body); } catch (e) { continue; }
    if (r.by !== 'andy') s.agentsAt[r.by] = r.at;
    apply(s, r, b, item, goalOf);
  }
  return s;
}

function blank(id, title, goalId) {
  return { id: id, title: title, goal: !goalId, goalId: goalId || '', blocks: [], status: '', with: '',
    went: false, claims: Object.create(null), done: false, alone: false, closed: false, designComplete: false,
    agentLineN: 0, seenN: 0,
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
      if (r.by !== 'andy') it.agentLineN = r.n;
      return;
    case 'item.rename': it.title = String(b.title); return;
    case 'item.status': it.status = String(b.word); return;
    case 'item.take': it.with = r.by; return;
    case 'press': press(s, it, String(b.what), r, goalOf); return;
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
  else if (what === 'bring-back') it.closed = false;
  else if (what === 'seen') it.seenN = r.n;
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
  if (g && !g.design && !it.went && !blockers(s, it).length) out.push('go');
  if (Object.keys(it.claims).length) out.push('done');
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
    alone: it.alone, star: it.agentLineN > it.seenN };
  if (it.goal) {
    const g = s.goals[it.id];
    const now = Date.now();
    f.design = g.design;
    f.waiting = g.members.map(function (id) { return s.items[id]; }).concat([it]).filter(function (o) {
      return o && listed(s, o) && (buttons(s, o).length > 0 || o.star);
    }).length;
    f.live = Object.keys(s.agentsAt).filter(function (a) { return now - Date.parse(s.agentsAt[a]) < LIVE_MS; }).sort();
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
  const r = addRecord.run(new Date().toISOString(), verb, String(a.by || ''), JSON.stringify(body));
  const after = walkState();
  const now = it ? after.items[it.id] : null;
  // THE CHANGE ITSELF TRAVELS (desk/G2.7, "no pulling"): the item's facts and
  // whether it is still on the List; a box write adds the box, a chat line the
  // line, a check its item's checks. The page paints from this.
  const out = { change: Number(r.lastInsertRowid), verb: verb, item: now ? facts(after, now) : null };
  if (now) out.listed = listed(after, now);
  if (now && verb === 'box.write') { out.box = now.box; out.version = now.version; }
  if (now && verb === 'chat.add') out.chat = now.chat[now.chat.length - 1];
  if (now && (verb === 'check.add' || verb === 'check.set')) out.checks = now.checks;
  appServer.publish(out);
  return after;
}

// HIS VOICE, A PLAIN FILE (D5): one line per thing he typed, {text, day}.
function addVoice(text, day) {
  fs.appendFileSync(path.join(STATE, 'voice.jsonl'), JSON.stringify({ text: String(text), day: day || new Date().toISOString().slice(0, 10) }) + '\n');
}

// A goal is open while it is on the List. With none open, start-design (no id) makes goal/G<n>, n the next free.
function newGoal(a) {
  const st = walkState();
  const open = Object.keys(st.goals).some(function (gid) { const g = st.items[gid]; return g && listed(st, g) && !g.closed; });
  if (open) throw refused('bad-request');
  const used = Object.keys(st.goals).map(function (gid) { const m = /^goal\/G(\d+)$/.exec(gid); return m ? Number(m[1]) : 0; });
  const id = 'goal/G' + (Math.max.apply(null, [0].concat(used)) + 1);
  return write('session.set', { session: { goal: { id: id, title: 'New goal' }, items: [] }, by: a.by });
}

const PRESSES = ['go', 'go-all', 'claim-done', 'done', 'reopen', 'close', 'bring-back', 'abandon', 'start-design', 'end-design', 'design-complete', 'seen'];
// Andy's alone (G2.1 review). His presses come by jobs.api, and apiDoor refuses a
// member who says 'andy', so these are loopback-only. The agents keep claim-done,
// design-complete and bring-back.
const OWNER_PRESSES = ['go', 'go-all', 'done', 'reopen', 'close', 'abandon', 'start-design', 'end-design', 'seen'];
function ownerOnly(a) { if (a.by !== 'andy') throw refused('not-owner'); }

function doc(name) { const row = getDoc.get(name); return row ? row.json : '{}'; }
function saveDoc(name, json) { parsed(json); putDoc.run(name, String(json)); return { saved: true }; }

appServer.serve({
  'log.add': {
    request: { json: '' }, reply: { added: true },
    handler: function (a) {
      const l = parsed(a.json);
      if (typeof l.key !== 'string' || !l.key) throw new Error('a line needs its key');
      // Refused, never stored to stall a read later (slim/G1.2 T4).
      if (!fitsOneAnswer(l.key, a.json)) throw tooLarge();
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
  'item.get': {
    request: { id: '' },
    reply: { item: '', box: '', version: 0, change: 0, chatMore: false,
      checks: [{ number: '', kind: '', words: '', test: '', state: '', by: '', at: '' }], chat: [{ by: '', at: '', text: '' }] },
    handler: function (a) {
      const s = walkState();
      const it = s.items[String(a.id)];
      if (!it) throw refused('no-such-item');
      const out = { item: JSON.stringify(facts(s, it)), box: it.box, version: it.version, change: s.change, chatMore: false, checks: it.checks, chat: [] };
      // THE CHAT IS A SEARCH (desk/G3.3). Andy: "why would the server not use bucket to give me the most recent
      // stuff?" Its newest lines, through the same bucket, in the room the rest of the answer leaves; oldest first.
      const room = ANSWER_ROOM - Buffer.byteLength(JSON.stringify(out), 'utf8');
      const bucket = searchBucket.createSearch({
        query: '**', maxBytes: Math.max(0, room),
        getLabelStringFromIncomingObject: function (pair) { return pair.label; },
        extractKeyAndLabelFromRow: function (pair) { return pair; },
      });
      for (let i = it.chat.length - 1; i >= 0; i--) {
        if (!bucket.offer({ key: String(i), label: JSON.stringify(it.chat[i]) })) break;
      }
      const r = bucket.getResult();
      out.chat = r.items.map(function (p) { return JSON.parse(p.label); }).reverse();
      out.chatMore = out.chat.length < it.chat.length;
      return out;
    },
  },
  // ── THE WRITES (desk/G2.1): each carries `by`, an agent's name or 'andy'.
  // The server cannot see who asks; a member cannot say 'andy' (apiDoor.js).
  'session.set': {
    request: { json: '', by: '' }, reply: { change: 0 },
    handler: function (a) {
      const sess = parsed(a.json);
      if (!sess.goal || !sess.goal.id || !Array.isArray(sess.items)) throw new Error('a session needs its goal and items');
      return { change: write('session.set', { session: sess, by: a.by }).change };
    },
  },
  // Andy: "the FIRST text wins, all subsequent actions are alterations and
  // corrections." An alteration names the version it was written against and
  // is refused if the box has moved on, so nothing is silently overwritten.
  'box.write': {
    request: { id: '', text: '', version: 0, by: '' }, reply: { change: 0, version: 0 },
    handler: function (a) {
      const s = write('box.write', a, function (st, it) { if (a.version !== it.version) throw refused('box-moved'); });
      return { change: s.change, version: s.items[a.id].version };
    },
  },
  'check.add': {
    request: { id: '', kind: '', words: '', test: '', by: '' }, reply: { change: 0 },
    handler: function (a) {
      if (a.kind !== 'C' && a.kind !== 'T') throw new Error('a check is C or T');
      return { change: write('check.add', a).change };
    },
  },
  'check.set': {
    request: { id: '', check: '', state: '', by: '' }, reply: { change: 0 },
    handler: function (a) {
      if (['open', 'passed', 'failed'].indexOf(a.state) === -1) throw new Error('a check is open, passed or failed');
      return { change: write('check.set', a, function (st, it) {
        if (!it.checks.some(function (c) { return c.number === a.check; })) throw refused('no-row');
      }).change };
    },
  },
  // What he types is also his voice (desk/G1.4): kept here, once, for his chat and his names.
  'chat.add': { request: { id: '', text: '', by: '' }, reply: { change: 0 }, handler: function (a) { const c = write('chat.add', a).change; if (a.by === 'andy') addVoice(a.text); return { change: c }; } },
  // "rename (you)": Andy's alone.
  'item.rename': { request: { id: '', title: '', by: '' }, reply: { change: 0 }, handler: function (a) { ownerOnly(a); const c = write('item.rename', a).change; addVoice(a.title); return { change: c }; } },
  'item.status': { request: { id: '', word: '', by: '' }, reply: { change: 0 }, handler: function (a) { return { change: write('item.status', a).change }; } },
  'item.take': { request: { id: '', by: '' }, reply: { change: 0 }, handler: function (a) { return { change: write('item.take', a).change }; } },
  // Presses are records, not lines (Andy: "a press shouldn't post a line, it
  // is not textual information"). Go!, Close and Reopen only when offered;
  // done also by Andy alone ("completions ... can be forced by the user"),
  // marked alone.
  'press': {
    request: { id: '', what: '', by: '' }, reply: { change: 0 },
    handler: function (a) {
      if (PRESSES.indexOf(a.what) === -1) throw refused('bad-request');
      if (OWNER_PRESSES.indexOf(a.what) !== -1) ownerOnly(a);
      // START DESIGN WITH NOTHING OPEN STARTS A NEW GOAL (desk/G3.1). Andy: "start design mode should start a new
      // project if nothing is in the list". It arrives in design mode; he names it.
      if (a.what === 'start-design' && a.id === '') return { change: newGoal(a).change };
      return { change: write('press', a, function (st, it) {
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
  // A PLAIN FILE, NOT A ROW (D5): Andy moves it into his vault by hand.
  'voice.add': {
    request: { text: '', day: '' }, reply: { added: true },
    handler: function (a) {
      addVoice(a.text, a.day);
      return { added: true };
    },
  },
});
