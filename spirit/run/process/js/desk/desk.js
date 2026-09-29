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
const hasKey = db.prepare('SELECT 1 AS n FROM lines WHERE key = ?');
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

// ── WHAT DESK KEPT IN ITS OWN FOLDER, IMPORTED ONCE (desk/G1.4) ─────
//
//   Andy: "desk creates a lot of file-clutter". D5: its state is this
//   server's. So at start, what the Desk app kept in <run>/shell/desk (<run>
//   being --state's great-grandparent) comes in, and only then goes: every
//   row of log/log*.json, state.json and seen.json (taken only while the
//   server has none, so an old file never overwrites newer state), and every
//   voice/voice*.jsonl appended to <state>/voice.jsonl (a line already there
//   is not added twice). Nothing is deleted unless every row it read is in
//   desk.db; a file that does not parse stops the import and deletes nothing.
//   Only those data files go; desk.js, desk.json and anything else stay.
function importFromApp() {
  const app = path.join(path.resolve(STATE), '..', '..', '..', 'shell', 'desk');
  const logDir = path.join(app, 'log');
  const voiceDir = path.join(app, 'voice');
  const listed = function (dir, re) { try { return fs.readdirSync(dir).filter(function (n) { return re.test(n); }); } catch (e) { return []; } };
  const number = function (n) { const m = /-(\d+)\./.exec(n); return m ? Number(m[1]) : 0; };
  const logs = listed(logDir, /^log(-\d+)?\.json$/).sort(function (a, b) { return number(a) - number(b); });
  const voices = listed(voiceDir, /^voice(-\d+)?\.jsonl$/).sort(function (a, b) { return number(a) - number(b); });
  const docs = ['state', 'seen'].filter(function (d) { return fs.existsSync(path.join(app, d + '.json')); });
  if (!logs.length && !voices.length && !docs.length) return;
  const rows = [];
  try {
    logs.forEach(function (n) {
      const held = JSON.parse(fs.readFileSync(path.join(logDir, n), 'utf8'));
      if (!Array.isArray(held)) throw new Error(n + ' is not a list');
      held.forEach(function (m) { if (m && typeof m.key === 'string' && m.key) rows.push(m); });
    });
    docs.forEach(function (d) { parsed(fs.readFileSync(path.join(app, d + '.json'), 'utf8')); });
  } catch (e) {
    console.error('desk: the import from ' + app + ' stopped, nothing deleted: ' + e.message);
    return;
  }
  // One transaction: thousands of rows committed one by one took seconds.
  db.exec('BEGIN');
  try {
    rows.forEach(function (m) {
      addLine.run(m.key, String(m.at || ''), String(m.todo || ''), String(m.from || ''), String(m.kind || ''), String(m.text || ''), JSON.stringify(m));
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    console.error('desk: the import from ' + app + ' failed, nothing deleted: ' + e.message);
    return;
  }
  docs.forEach(function (d) { if (!getDoc.get(d)) putDoc.run(d, fs.readFileSync(path.join(app, d + '.json'), 'utf8')); });
  const voiceFile = path.join(STATE, 'voice.jsonl');
  const have = new Set((function () { try { return fs.readFileSync(voiceFile, 'utf8'); } catch (e) { return ''; } })().split('\n').filter(Boolean));
  voices.forEach(function (n) {
    fs.readFileSync(path.join(voiceDir, n), 'utf8').split('\n').filter(Boolean).forEach(function (l) {
      if (!have.has(l)) { fs.appendFileSync(voiceFile, l + '\n'); have.add(l); }
    });
  });
  if (!rows.every(function (m) { return !!hasKey.get(m.key); })) {
    console.error('desk: the import from ' + app + ' did not land whole, nothing deleted');
    return;
  }
  logs.forEach(function (n) { fs.rmSync(path.join(logDir, n), { force: true }); });
  voices.forEach(function (n) { fs.rmSync(path.join(voiceDir, n), { force: true }); });
  docs.forEach(function (d) { fs.rmSync(path.join(app, d + '.json'), { force: true }); });
  [logDir, voiceDir].forEach(function (dir) { try { fs.rmdirSync(dir); } catch (e) { /* not empty, or none */ } });
  console.log('desk: imported ' + rows.length + ' lines, ' + docs.join(' and ') + (docs.length ? ', ' : '') + voices.length + ' voice files from ' + app + ', and removed them there');
}
importFromApp();

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

// ── WHAT HAS GONE STALE (slim/G1.6) ─────────────────────────────────
//
//   Andy: "no use if these displays go stale", "is this programatically or
//   do i have to rely on agents to remember?" His go on: when an item's text
//   changes, Desk marks its explanation stale and asks for a fresh one.
//   Update requests on a status change he dropped (2026-09-30): the lists
//   are Desk's own data and redraw at once, "lots of agent-work that can be
//   done programatically".
//
// Folded here because only this server sees every session (Desk loads the
// newest). For each item of the newest session, and its goal:
//   changedAt        the at of the newest session in which its text (title,
//                    description, check, tests, inPlace) differed from the
//                    session before, or of the one it first appeared in
function textOf(it) {
  return JSON.stringify([it.title || '', it.description || '', it.check || '', it.tests || [], it.inPlace || []]);
}
function freshness() {
  let session = null;
  const seen = Object.create(null);
  const changedAt = Object.create(null);
  for (const row of allLines.iterate()) {
    let m;
    try { m = JSON.parse(row.line); } catch (e) { continue; }
    const at = String(m.at || '');
    if (m.dir === 'in' && m.kind === 'session') {
      let sess = null;
      try { sess = JSON.parse(String(m.text || '')); } catch (e) { sess = null; }
      if (!sess || !Array.isArray(sess.items)) continue;
      session = sess;
      const all = sess.items.concat(sess.goal && sess.goal.id ? [sess.goal] : []);
      all.forEach(function (it) {
        const id = String(it.id || '');
        if (!id) return;
        const t = textOf(it);
        if (seen[id] !== t) { seen[id] = t; changedAt[id] = at; }
      });
    }
  }
  if (!session) return [];
  const items = session.items.concat(session.goal && session.goal.id ? [session.goal] : []);
  return items.filter(function (it) { return it && it.id; }).map(function (it) {
    const id = String(it.id);
    return JSON.stringify({ id: id, changedAt: changedAt[id] || '' });
  });
}

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
  // What has gone stale (slim/G1.6), one item per row of the newest session.
  'fresh.get': {
    request: {}, reply: { items: [{ key: '', label: '' }], more: false },
    handler: function () {
      return walked(freshness(), function (item) { return { key: JSON.parse(item).id, label: item }; });
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
      fs.appendFileSync(path.join(STATE, 'voice.jsonl'), JSON.stringify({ text: a.text, day: a.day }) + '\n');
      return { added: true };
    },
  },
});
