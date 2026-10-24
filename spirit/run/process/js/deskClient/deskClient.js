'use strict';

// spirit/run/process/js/deskClient/deskClient.js
// THE DESK CLIENT — goal/G3.3, G3.4, G3.5. A server on an agent's own node: it passes one ask to Andy's desk and counts
// it, and while its agent waits it reads what changed at the desk and holds what is meant for that agent.
//
//   Andy, 2026-10-02 (goal/G3.1): "i am ready to accept completely alternative design, if it achieves what todays
//   deskAgentEar does, and statistics are kept somewhere you can access them easily.", then "accepted." to a deskClient
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
//   - WHO IT IS, name and key, is what its node hands a server it starts (--node, jobs.js): no ask and no file.
//   - IT FOLLOWS THE DESK'S STREAM (goal/G33.4): the desk sends each changed row of its current goal to the deskClient
//     of every agent it knows (appServer streamListener), so deskClient asks the desk nothing to learn what changed.
//     changed, the desk's old nudge (goal/G3.5), went with goal/G33.7.
//   - What is meant for its agent is selected and worded as the listener it replaces did (goal/G3.4, 5): Andy's
//     records but his seen presses, another agent's chat, and the lines Desk keeps from Andy or an agent; never
//     its own, never the desk's busy replies, never Andy's direct line to the other agent.
//
// WHAT A RECORD SAYS: {at, verb, ms, outcome, bytes, port, count} — when, the desk verb, the milliseconds until it
// ended, how it ended, the bytes of the answer, the port of the node it went through (Andy: "the portnumber you
// call will be an implicit identification of the relay you used."), and how many asks the record stands for: 1,
// but for a run of empty polls and for the first run's search for "now", where ms and bytes are their sums.
// The outcomes:
//   answered    the desk said yes            refused     the desk said no ({ok: false, code})
//   pending     still waited for             not-posted  the node could not post it
//   no-answer   the desk never answered      lost        this process ended while it waited
//   empty       a poll that brought nothing; a run of them is ONE record (Andy: "empty polls can contribute
//               statistically and discarded.")
// THE RECORD IS BOUNDED: the newest historyMax rows are kept, the oldest fall off.
//
// NEVER A LIST (Andy: every list is a search). history.search answers what matches best, newest first among equals,
// cut to fit one answer by the probability bucket, and says so with more.

// The spirit object first, as the global spirit (goal/G40.1).
require('../../../spirit.js');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const appServer = require('../../../spirit/appServer.js');
const appClient = require('../../../spirit/appClient.js');
const createProbabilityBucket = require('../../../spirit/probabilityBucket.js').createProbabilityBucket;
const probabilityStringObjectMatch = require('../../../spirit/probabilityStringObjectMatch.js').probabilityStringObjectMatch;

const argv = process.argv;
function arg(name) { const i = argv.indexOf(name); return i !== -1 ? String(argv[i + 1] || '') : ''; }
function parsed(text, fallback) {
  try { const v = JSON.parse(text); return v && typeof v === 'object' && !Array.isArray(v) ? v : fallback; } catch (e) { return fallback; }
}
const STATE = arg('--state');
if (!STATE) {
  console.error('deskClient: no --state; the node that starts this names its state folder');
  process.exit(2);
}
fs.mkdirSync(STATE, { recursive: true });

// Its manifest's args, as the node hands their values over (jobs.js): the first argument, a JSON object.
const values = parsed(argv[2], {});
const HISTORY_MAX = Number(values.historyMax) > 0 ? Math.floor(Number(values.historyMax)) : 1000;
// Who this agent is: its node's name and key, to tell what is its own from what is meant for it.
const NODE = parsed(arg('--node'), {});
const SELF = String(NODE.name || '');
const SELF_KEY = String(NODE.publicKey || '');

// The asker is answered inside the node's 12 s; the desk is waited for as long as a held post may take to land
// and be answered (the node holds a busy post for PATIENCE_MS, peer.post's own patienceMs).
const HOLD_MS = 10000;
// How long a silent stream is trusted before a wait subscribes again (goal/G33.8); the manifest value resubscribeMs.
const RESUBSCRIBE_MS = Number(values.resubscribeMs) > 0 ? Number(values.resubscribeMs) : 60000;
let heardAt = Date.now();
const PATIENCE_MS = 60000;
const WAIT_MS = PATIENCE_MS + 30000;
const ANSWER_ROOM = appClient.ANSWER_MAX - 512;
// A hand-over waits this long for "working" to reach the desk, never past the node's 12 s.
const SAY_MS = 3000;
const LEAVE_BY_MS = 11000;
const BIG = Number.MAX_SAFE_INTEGER;

// The port of the node this server runs on, as the node itself named it: it goes into every record. The node itself is
// reached through the one spirit object (goal/G40.6).
let PORT = 0;
try { PORT = Number(new URL(String(process.env.SPIRIT_CALLBACK_URL || '')).port) || 0; } catch (e) { PORT = 0; }

const db = new DatabaseSync(path.join(STATE, 'deskClient.db'));
// The backup copies this file while it is written, as it does desk.db: in WAL a reader never blocks the writer.
db.exec('PRAGMA busy_timeout=5000');
db.exec('PRAGMA journal_mode=WAL');
db.exec(
  'CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT NOT NULL);' +
  'CREATE TABLE IF NOT EXISTS asks (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, verb TEXT NOT NULL,' +
  ' ms INTEGER NOT NULL, outcome TEXT NOT NULL, bytes INTEGER NOT NULL, port INTEGER NOT NULL, count INTEGER NOT NULL DEFAULT 1);'
);
// A record file written before records had a count (goal/G3.3) gains the column once.
if (!db.prepare('PRAGMA table_info(asks)').all().some(function (c) { return c.name === 'count'; })) {
  db.exec('ALTER TABLE asks ADD COLUMN count INTEGER NOT NULL DEFAULT 1');
}
// An ask this process was still waiting on when it ended has no one waiting any more.
db.exec("UPDATE asks SET outcome = 'lost' WHERE outcome = 'pending'");
const getSetting = db.prepare('SELECT value FROM settings WHERE name = ?');
const putSetting = db.prepare('INSERT INTO settings (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value');
const addAsk = db.prepare("INSERT INTO asks (at, verb, ms, outcome, bytes, port, count) VALUES (?, ?, 0, 'pending', 0, ?, 1)");
const endAsk = db.prepare('UPDATE asks SET ms = ?, outcome = ?, bytes = ? WHERE id = ?');
const trimAsks = db.prepare('DELETE FROM asks WHERE id NOT IN (SELECT id FROM asks ORDER BY id DESC LIMIT ?)');
const findAsks = db.prepare(
  "SELECT id, at, verb, ms, outcome, bytes, port, count FROM asks WHERE (? = '' OR verb LIKE '%' || ? || '%' OR outcome LIKE '%' || ? || '%') ORDER BY id DESC"
);

function refused(code, extra) { const e = new Error(code); e.refusal = code; if (extra) e.extra = extra; return e; }
// The agent itself, on its own node's loopback door. Speaking to Andy's desk as this node is the owner's alone.
function ownerOnly(caller) { if (!caller || caller.owner !== true) throw refused('not-owner'); }
// The desk's key, as the owner set it; none set, nobody to ask.
function deskKey() {
  const to = getSetting.get('desk');
  if (!to || !to.value) throw refused('no-such-peer');
  return to.value;
}

// How an ask ended, from what the kernel handed back: its two transport outcomes by their own names, a desk
// refusal as refused, anything else as answered.
function outcomeOf(got) {
  if (got && got.ok === false && (got.code === 'not-posted' || got.code === 'no-answer')) return got.code;
  return got && got.ok === false ? 'refused' : 'answered';
}
function bytesOf(got) { return Buffer.byteLength(JSON.stringify(got === undefined ? null : got), 'utf8'); }

// ── THE RECORD ───────────────────────────────────────────────────────
// A record opened as pending, to be ended. Either way the oldest rows past historyMax go.
function begin(verb) {
  const id = Number(addAsk.run(new Date().toISOString(), verb, PORT).lastInsertRowid);
  trimAsks.run(HISTORY_MAX);
  return id;
}

// ONE ASK OF THE DESK, THROUGH ITS FAMILY INTERFACE (goal/G33.4, box v38). Andy: the family interface takes ANY
// transport. The desk node's desk family, bound by the one spirit object under the desk's key (spirit.require with a
// key, goal/G40.6), over peerPost with this server's waiting; the call is checked against the desk's own api.js and goes
// as the packet the far apiDoor takes; nothing here builds one. Answers the desk's body as before, its refusal included,
// and the kernel's own outcomes (not-posted, no-answer).
const DESK_HOW = { waitMs: WAIT_MS, patienceMs: PATIENCE_MS };
function askDesk(to, verb, args) {
  return spirit.require('process/js/desk/desk.family/api.js', to, DESK_HOW).then(function (desk) {
    return spirit.outcome(Promise.resolve().then(function () {
      if (typeof desk[verb] !== 'function') { const e = new Error('the desk serves no verb ' + verb); e.code = 'no-such-verb'; throw e; }
      return desk[verb](args);
    })).then(function (r) {
      return r.body || { ok: false, code: 'no-answer', error: 'the desk did not answer' };
    });
  }, function () { return { ok: false, code: 'no-answer', error: 'the desk family did not answer' }; });
}
// The same ask, with its own record: opened as it leaves, ended by what came back.
function countedAsk(to, verb, args) {
  const id = begin(verb);
  const t0 = Date.now();
  return {
    id: id,
    answer: askDesk(to, verb, args).then(function (got) {
      endAsk.run(Date.now() - t0, outcomeOf(got), bytesOf(got), id);
      return got;
    }),
  };
}
// A promise, or the time running out, whichever is first; the promise itself goes on.
function within(promise, ms) {
  let timer = null;
  const out = new Promise(function (resolve) { timer = setTimeout(resolve, Math.max(0, ms)); });
  return Promise.race([promise, out]).finally(function () { clearTimeout(timer); });
}

// ── WHAT THE DESK STREAMS TO THIS AGENT (goal/G33.4, box v38-40) ─────
//
//   Andy: "the desk is the server and simply pushes a stream via peerPost to its deskClients", "the streamListener verb
//   is approved", and the box: the desk's stream "updates their cache data set (spirit.data + translator). A client's
//   own change lands only via that stream." The purpose (box v37): less load on the desk, up-to-date information at the
//   agents' fingertips, "without constantly waking agents to read irrelevant messages".
//
// DECIDED, not this file's to undo: deskClient never asks the desk what changed (`changes` is gone); it follows the
// desk's stream (appServer's streamListener, granted to the desk's key by setDesk) and keeps the current goal from it
// alone, in spirit.data through the desk's translator, the same block the Desk page uses. Its agent's reads of rows the
// stream brought are answered from there; its agent's own writes go to the desk and come back on the stream.
// waiting: the lines meant for its agent, handed over by its next wait.
const waiting = [];
let said = '';
// The waits a line or a nudge ends early.
const wakers = [];
// Whether a job may have opened since the last ask of work.open: set by a row the stream brought that holds a phase
// nobody holds, and by a nudge; a wait asks work.open only then, so a quiet wait asks nothing.
let jobsMaybe = true;

// The data set: the server's spirit.data, which appServer fills from the stream through the desk's translator (box v41).
const dataSet = appServer.data;
const KEPT_READS = ['item.get', 'item.box', 'item.checks', 'item.chat', 'item.files'];
// Known by its key (goal/G3.9: Andy may relabel an agent), by its name only where the row names no key.
function heldByMe(row) {
  if (!row || !row.with) return false;
  return row.withKey && SELF_KEY ? row.withKey === SELF_KEY : row.with === SELF;
}
// The answer the desk would give, from what the stream brought, or null when it is not all there. Any item of the
// current goal the stream brought whole answers, held or not (box v37: "up-to-date information at the agents'
// fingertips").
function fromKept(name, args) {
  const id = String((args && args.id) || '');
  const row = id ? dataSet.get('deskItems/' + id) : null;
  const whole = id ? dataSet.get('deskItem/' + id) : null;
  // The facts came with the push (goal/G33.4, box v46); a part only once it was read (took, below).
  if (name === 'item.get' && row && typeof row.version === 'number') return { item: JSON.stringify(row), version: row.version, change: Number(dataSet.get('desk/change')) || 0 };
  if (!row || !whole) return null;
  if (name === 'item.box' && typeof whole.box === 'string') return { box: whole.box, version: Number(whole.version) || 0 };
  if (name === 'item.checks' && Array.isArray(whole.checks)) return { checks: whole.checks };
  if (name === 'item.chat' && Array.isArray(whole.chat)) {
    // Newest first into one answer, as the desk's item.chat fills its room; more says some were left out.
    const out = [];
    for (let i = whole.chat.length - 1; i >= 0; i--) {
      if (Buffer.byteLength(JSON.stringify({ chat: [whole.chat[i]].concat(out), chatMore: true }), 'utf8') > ANSWER_ROOM) break;
      out.unshift(whole.chat[i]);
    }
    return { chat: out, chatMore: out.length < whole.chat.length };
  }
  // goal/G33.7 (the approved list: "deskClient's kept file list (filled to one answer)"): as many as fit one answer, in
  // the desk's order, and filesMore when some were left out; the push only ever adds to what is kept.
  if (name === 'item.files' && Array.isArray(whole.files) && !whole.filesMore) {
    const under = typeof args.under === 'string' ? args.under : '';
    const all = whole.files.filter(function (f) { return !under || String(f.path).indexOf(under) === 0; });
    const out = [];
    for (const f of all) {
      if (Buffer.byteLength(JSON.stringify({ files: out.concat([f]), filesMore: true }), 'utf8') > ANSWER_ROOM) break;
      out.push(f);
    }
    return { files: out, filesMore: out.length < all.length };
  }
  return null;
}

// ONE ROW OF THE DESK'S STREAM, as appServer hands it after it took it into spirit.data (onRow): if it is a line meant
// for this agent, into what its next wait hands over; a row that holds a phase nobody holds may mean a job.
// The lines of the goal in view since the agent's last wake (handOver), each once: { key, text }.
// ALL THE NEWS SINCE THE LAST WAKE (goal/G33.8, box v15-16; Andy: "the desk client, when it wakes its agent, hands it
// all the news since the last agent-wake, this is also why you never know about status changes etc... in the items or
// goals"): every line of the goal in view and the group chat, whoever wrote it and wherever, and every change of an
// item's or the goal's state (its phase, holder, Go, claims, verified, done, closed, a check), as the stream brought
// them, each once, in order. They are handed with the next wake (handOver) and wake nothing by themselves. A line or
// change meant for the agent is handed as DESK (it is the agent's to act on); the rest as NEWS. Nothing is asked of
// the desk.
const sinceWake = [];
const SINCE_WAKE_MAX = 200;
function inView(goal) {
  const cur = /^goal\/G(\d+)$/.exec(String(dataSet.get('desk/current') || ''));
  return goal === 0 || (!!cur && goal === Number(cur[1]));
}
function lineKeyOf(id, l) { return String(id) + '#' + String(l.at) + '#' + String(l.key || l.by); }
function news(key, text) {
  if (sinceWake.some(function (x) { return x.key === key; })) return;
  sinceWake.push({ key: key, text: text });
  // Bounded while nobody waits: only the newest that could ever fill one answer are kept.
  while (sinceWake.length > SINCE_WAKE_MAX) sinceWake.shift();
}
// Which state of a row is news: these fields, as the facts carry them.
const STATE_FIELDS = ['status', 'phase', 'with', 'go', 'claims', 'verified', 'verifyRed', 'design', 'limbo'];
const STATE_QUIET = ['chat.add', 'agent.state', 'seen.set', 'line.take'];
// Each item's state as last heard, so only a change of it is news (the first heard, a bootstrap's, is only noted).
const lastState = {};
function keepSinceWake(row) {
  if (row.table === 'chat') {
    if (!row.row || row.removed) return;
    const l = row.row;
    if (!l.at || String(l.at) <= sinceNow || !(inView(row.goal) || row.special === true)) return;
    if (SELF_KEY ? l.key === SELF_KEY : l.by === SELF) return;
    if (Array.isArray(row.to) && row.to.length && row.to.indexOf(SELF_KEY) === -1) return;
    news(lineKeyOf(row.id, l), 'NEWS ' + l.by + ' chat.add ' + JSON.stringify({ id: String(row.id), text: String(l.text) }));
    return;
  }
  if (row.table === 'checks') {
    if (!row.row || row.removed || !(inView(row.goal) || row.special === true)) return;
    const c = row.row;
    const checkKey = 'check#' + row.id + '#' + c.number + '#' + c.state;
    const checkText = 'check.set ' + JSON.stringify({ id: String(row.id), check: String(c.number), kind: String(c.kind || ''), state: String(c.state || '') });
    news(checkKey, 'NEWS ' + checkText);
    return { id: String(row.id), key: checkKey, text: checkText };
  }
  const f = row.item && typeof row.item === 'object' ? row.item : null;
  if (!f || !f.id || STATE_QUIET.indexOf(String(row.verb || '')) !== -1) return;
  const k = /^goal\/G(\d+)/.exec(String(f.id));
  if (!k || !(inView(Number(k[1])) || row.special === true)) return;
  const state = {};
  STATE_FIELDS.forEach(function (n) { if (f[n] !== undefined && f[n] !== '' && f[n] !== false && f[n] !== 0) state[n] = f[n]; });
  // Only a change of its state is news: a write that leaves those fields as they were (a box taken, a rename) is not.
  const print = JSON.stringify(state);
  if (lastState[f.id] === undefined) { lastState[f.id] = print; return; }
  if (lastState[f.id] === print) return;
  lastState[f.id] = print;
  // ITS OWN FILE REPORTS ARE NOT NEWS TO IT (goal/G33.11): the status its watch wrote is what its agent just did.
  if (String(row.verb || '') === 'item.status' && (SELF_KEY ? row.byKey === SELF_KEY : row.by === SELF)) return;
  const stateKey = 'state#' + f.id + '#' + print;
  const stateText = String(row.verb || 'change') + ' ' + JSON.stringify(Object.assign({ id: String(f.id) }, state));
  news(stateKey, 'NEWS ' + stateText);
  return { id: String(f.id), key: stateKey, text: stateText };
}
// ITS OWN ITEM'S CHANGES WAKE IT (goal/G33.9, box v4; Andy: "my issuing the grant didn't reach/wake the phase-holder",
// and "your deskClient knows that you hold the current phase of the item, and wakes you [on] that item's status
// changes"): a change of the state or the checks of an item this agent holds (its holder or its phase holder, now or
// just before the change) wakes it as its own (DESK), whoever made it, Andy, another agent or the desk, but itself.
const heldIds = {};
function holdsItem(f) { return !!f && (heldByMe(f) || (!!f.phaseWith && f.phaseWith === SELF)); }
function wakeOnHeld(row, change) {
  const f = row.item && typeof row.item === 'object' ? row.item : null;
  const id = String((f && f.id) || row.id || '');
  const now = f ? holdsItem(f) : holdsItem(dataSet.get('deskItems/' + id));
  const mine = now || heldIds[id] === true;
  if (f) heldIds[id] = now;
  if (!change || !mine) return;
  if (SELF_KEY ? row.byKey === SELF_KEY : row.by === SELF) return;
  wakeWith({ text: 'DESK ' + String(row.by || 'desk') + ' ' + change.text, key: change.key });
}
function streamed(row) {
  if (!row || typeof row !== 'object') return;
  heardAt = Date.now();
  wakeOnHeld(row, keepSinceWake(row));
  const facts = row.item && typeof row.item === 'object' ? row.item : null;
  // The row wakes a wait too: since box v43 the desk sends nothing but its stream, so no nudge comes beside it.
  if (facts && facts.phase && !facts.phaseWith && facts.go && !facts.done) { jobsMaybe = true; wakers.splice(0).forEach(function (wake) { wake(); }); }
  const line = meantForAgent(row);
  if (!line) return;
  const hand = function () { wakeWith(line); };
  if (!line.take) { hand(); return; }
  // TAKE FIRST, THEN WAKE (goal/G27.12, reopened). Andy, 2026-10-17: "when an agent's deskClient takes a chat line for
  // him, all other deskClients should be refused a take, and thus NOT notify their agent." So his line is taken at the
  // desk (line.take, the desk's own rule of who may) before it is handed over; a take the desk refuses drops it, and its
  // agent is not woken; a take that got no answer hands it over, so nothing is lost to a slow desk.
  let to = '';
  try { to = deskKey(); } catch (e) { return; }
  countedAsk(to, 'line.take', { id: line.take }).answer.then(function (got) {
    if (outcomeOf(got) !== 'refused') hand();
  }, hand);
}

// WHAT IS MEANT FOR ITS AGENT (box v37: "without constantly waking agents to read irrelevant messages"). A new line of
// the stream's chat rows:
//   - Andy's line addressed to its own agent (a line addressed to others is never taken here); or addressed to nobody, on the item it holds, on an item nobody holds or in
//     the group chat (taken first: line.take, the desk's own rule of who may answer, goal/G27.12);
//   - another agent's line, or the desk's, on the item it holds; the desk's in the group chat (a rule change, goal/G5.8);
//   - never its own line, never the desk's busy replies, and never chat between others on an item another agent holds.
// A commit line of another agent's pulls this clone beside the hand-over (goal/G5.8), and Andy's "publish" in the group
// chat starts a publish (goal/G4.33), whichever agent it is meant for.
const seenLines = new Set();
// WHAT IS OLD (goal/G3.4: a first run starts at now; nothing is handed twice, a restart included). A line or box
// version written at or before `since` is old, however often the stream brings it again (a goal pushed whole, to a
// client new to the desk or back from away). since is kept in the settings: set to now on the very first run, and
// moved to the newest line seen whenever a wait ends, so a burst of rows pushed out of time order is judged whole.
let newestSeen = '';
function since() {
  const row = getSetting.get('since');
  if (row && row.value) return row.value;
  const now = new Date().toISOString();
  putSetting.run('since', now);
  return now;
}
const SINCE_AT_START = since();
let sinceNow = SINCE_AT_START;
function isOld(at) {
  const a = String(at || '');
  if (a > newestSeen) newestSeen = a;
  return !!a && a <= sinceNow;
}
function moveSince() {
  if (newestSeen > sinceNow) { sinceNow = newestSeen; putSetting.run('since', sinceNow); }
}
function meantForAgent(row) {
  if (!row.row || row.removed) return null;
  // ONE GOAL IN VIEW (goal/G33.8): the desk publishes every goal's rows to its subscribers now, so what is meant for the
  // agent is of the current goal or the group chat, or his line addressed to it, or on the item it holds.
  const cur = /^goal\/G(\d+)$/.exec(String(dataSet.get('desk/current') || ''));
  // WHAT HAPPENS IN A SPECIAL GOAL (goal/G33.11): a plugin's goal, such as Stacks, is in view too; the desk marks its
  // rows special.
  const inView = row.goal === 0 || (!!cur && row.goal === Number(cur[1])) || (Array.isArray(row.to) && row.to.indexOf(SELF_KEY) !== -1) ||
    row.special === true || heldByMe(dataSet.get('deskItems/' + String(row.id || '')));
  if (!inView) return null;
  if ((row.table === 'chat' || row.table === 'box') && isOld(row.row.at)) return null;
  // HIS BOX WRITE ON THE ITEM IT HOLDS reaches it, as it did (goal/G27.12: "His box.write still reaches the agents").
  if (row.table === 'box') {
    const f = dataSet.get('deskItems/' + String(row.id || ''));
    return row.row.by === 'andy' && heldByMe(f) ? { text: 'DESK andy box.write ' + JSON.stringify({ id: String(row.id), version: row.row.version }) } : null;
  }
  // HIS CLEAR OF A RED Q THIS AGENT PLACED reaches it (goal/G21.2: "the agent that placed it is notified").
  if (row.table === 'checks') {
    const c = row.row;
    const placed = SELF_KEY ? c.placedKey === SELF_KEY : c.placedBy === SELF;
    const seen = 'check#' + String(row.id) + '#' + String(c.number) + '#' + String(c.state);
    if (!placed || c.state !== 'cleared' || seenLines.has(seen)) return null;
    seenLines.add(seen);
    return { text: 'DESK andy check.set ' + JSON.stringify({ id: String(row.id), check: String(c.number), state: 'cleared' }) };
  }
  if (row.table !== 'chat') return null;
  const l = row.row;
  const id = String(row.id || '');
  const lineKey = id + '#' + String(l.at) + '#' + String(l.key || l.by) + '#' + String(l.text).length;
  if (seenLines.has(lineKey)) return null;    // a change to a line it has seen (a take) is no new line
  seenLines.add(lineKey);
  const mine = SELF_KEY ? l.key === SELF_KEY : l.by === SELF;
  if (mine) return null;
  if (l.key && l.by !== 'andy' && l.by !== 'desk') rememberOther(String(l.key), String(l.by));
  const body = JSON.stringify({ id: id, text: String(l.text) });
  const facts = dataSet.get('deskItems/' + id) || null;
  const held = heldByMe(facts);
  const nobodyHolds = !facts || !facts.with;
  const group = id === 'goal/G0';
  if (l.by === 'andy') {
    if (group) publishOn(body);
    // His line addressed to agents comes only to them, its row naming them (desk.js streamToClients).
    // His line addressed to this agent wakes it as its own with no take (the desk bound a nick line's take already; his
    // "all" line needs none, goal/G33.2), and entitles it to answer there (mayChat).
    if (Array.isArray(row.to) && row.to.length) {
      if (row.to.indexOf(SELF_KEY) === -1) return null;
      entitled[id] = true;
      return { text: 'DESK andy chat.add ' + body, key: lineKeyOf(id, l) };
    }
    if (held || nobodyHolds || group) return { text: 'DESK andy chat.add ' + body, take: id, key: lineKeyOf(id, l) };
    return null;
  }
  const said = String(l.text || '');
  const m = /^commit ([0-9a-f]{7,40})\b/.exec(said);
  if (m) queuePull(m[1]);
  if (l.by === 'desk' && /^message delivered, /.test(said)) return null;
  if (held || (group && l.by === 'desk')) return { text: 'DESK ' + l.by + ' chat.add ' + body, key: lineKeyOf(id, l) };
  return null;
}
// THE AGENT'S STATUS, KEPT IN RAM AND KEPT ALIVE WITH DESK (goal/G27.12): connected, busy, idle, or signed off.
let agentState = 'connected';

// HIS "publish" STARTS A PUBLISH (goal/G4.33). Andy, to what starts it: "\"publish\"", his group-chat line exactly
// that; to N: "that's a fine number" (20); "it will be done as a SpiritOS process, that will be cleaned-up/deleted
// from jobs when it's done." So the line asks this agent's own node for a publishData job, removed from Jobs once it
// exited cleanly (goal/G4.34); any other line starts nothing. The job runs from the node's own tree, so publishData
// finds the agent's clone, measures, commits agents/<agent>/ under the standing grant, and says so in Desk.
const PUBLISH_ASKS = 20;
function publishOn(body) {
  let b = null;
  try { b = JSON.parse(body); } catch (e) { return; }
  // goal/G33.4: the group chat is goal 0.
  if (!b || b.id !== 'goal/G0' || String(b.text || '').trim() !== 'publish' || !PORT) return;
  // Through the one spirit object (goal/G32.3, goal/G40.6).
  spirit.require('spirit/jobs/api.js').then(function (jobs) {
    return jobs.create({ command: process.execPath, args: [path.join(__dirname, 'publishData.js'), String(PORT), '--asks', String(PUBLISH_ASKS)], type: 'publishData' });
  }).then(null, function (e) { console.error('deskClient: the node refused the publish job: ' + ((e && e.message) || e)); });
}

// THE PULL (goal/G5.8): the clone this deskClient runs from, fast-forwarded onto its origin only when it holds no
// unsaved edit; with one, nothing is touched and the agent is told. A rebase that clashes is undone. '' when pulled
// or already there.
// BESIDE next, NEVER INSIDE IT (goal/G19.6; Andy, 2026-10-12: "agreed to the whole thing as stated", the box:
// "deskClient pulls beside the call that hands an agent its lines, never inside it, and never aborts a rebase it did
// not start."). The pull was a synchronous git pull with a 60 s timeout run while next read the desk, so a slow pull
// held next past the node's 12 s door and the agent's listener timed out. Now a commit line only queues its hash; the
// pulls run one at a time, as child processes, after the line is handed over, and what a pull has to tell joins the
// lines waiting for the agent, handed over by the next wait (or the one under way). Its place is the desk's as read
// so far, so handing it over moves the cursor no further back than it stood; a restart before it is handed over
// loses that one note, never a desk line.
// NOT INTO THE AGENT'S OWN REBASE: with a rebase already in progress in the clone it neither pulls nor aborts, and
// says so; it aborts only a rebase its own pull left behind.
function gitIn(args, cwd) {
  return new Promise(function (resolve) {
    require('child_process').execFile('git', args, { cwd: cwd, encoding: 'utf8', timeout: 60000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, function (e, stdout, stderr) {
      resolve({ status: e ? (typeof e.code === 'number' ? e.code : 1) : 0, out: String(stdout || '').trim(), err: String(stderr || '').trim() });
    });
  });
}
function rebaseInProgress(root) {
  return Promise.all(['rebase-merge', 'rebase-apply'].map(function (d) {
    return gitIn(['rev-parse', '--git-path', d], root).then(function (r) { return !!r.out && fs.existsSync(path.resolve(root, r.out)); });
  })).then(function (found) { return found.indexOf(true) !== -1; });
}
async function pullClone(hash) {
  const top = await gitIn(['rev-parse', '--show-toplevel'], __dirname);
  if (top.status !== 0 || !top.out) return '';
  const root = top.out;
  if ((await gitIn(['cat-file', '-e', hash + '^{commit}'], root)).status === 0 && (await gitIn(['merge-base', '--is-ancestor', hash, 'HEAD'], root)).status === 0) return '';
  if (await rebaseInProgress(root)) return 'commit ' + hash + ' landed; a rebase is in progress in your clone, so it was not pulled.';
  if ((await gitIn(['status', '--porcelain', '--untracked-files=no'], root)).out) return 'commit ' + hash + ' landed; your clone has unsaved edits, so it was not pulled.';
  const pulled = await gitIn(['pull', '-q', '--rebase'], root);
  if (pulled.status === 0) return '';
  const why = (pulled.err || pulled.out).slice(0, 300);
  // No rebase was in progress before the pull, so one standing now is the pull's own.
  if (!await rebaseInProgress(root)) return 'commit ' + hash + ' landed; the pull failed, so your clone was not pulled: ' + why;
  await gitIn(['rebase', '--abort'], root);
  return 'commit ' + hash + ' landed; the pull clashed and was undone, so your clone was not pulled: ' + why;
}
const pulls = [];
let pulling = false;
function queuePull(hash) {
  if (pulls.indexOf(hash) === -1) pulls.push(hash);
  // After the answer under way has gone: the queue is worked from the next turn of the event loop.
  setImmediate(pumpPulls);
}
function pumpPulls() {
  if (pulling || !pulls.length) return;
  pulling = true;
  pullClone(pulls.shift()).then(function (told) {
    if (!told) return;
    wakeWith({ text: told });
  }).catch(function (e) { console.error('deskClient: the pull failed: ' + ((e && e.message) || e)); })
    .then(function () { pulling = false; pumpPulls(); });
}

// RULE 1 AT THIS NODE (goal/G3.9). Andy, 2026-10-02: "Agants will NOT speak to each other behind the users back."
// Each agent's node blocks the other agent's key (contact.block; contacts.js: a blocked key is not heard). Every
// other agent seen writing at the desk — a record under a key not this agent's, not andy's, not the desk's — is
// kept here, and before a wait hands anything over the node is asked whether each is blocked; one that is not
// has the wait refused, unblocked, naming it, until it holds. Andy's writes name no agent.
function others() {
  const row = getSetting.get('others');
  try { const o = row ? JSON.parse(row.value) : null; return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; }
}
function rememberOther(key, name) {
  const o = others();
  if (o[key] === name) return;
  o[key] = name;
  putSetting.run('others', JSON.stringify(o));
}
function blockedHere(key) {
  // Through the one spirit object (goal/G32.3, goal/G40.6).
  return spirit.require('spirit/contact/api.js').then(function (contact) { return contact.get({ key: key }); }).then(function (body) {
    const p = body && body.person;
    return !!(p && p.blocked === true);
  }, function () { return false; });
}
function unblockedOther() {
  const o = others();
  const keys = Object.keys(o);
  function one(i) {
    if (i >= keys.length) return Promise.resolve(null);
    return blockedHere(keys[i]).then(function (blocked) { return blocked ? one(i + 1) : { name: o[keys[i]], key: keys[i] }; });
  }
  return one(0);
}

// THE AGENT'S WORD AT THE DESK (goal/G2.3): listening when its agent starts to wait, working when it is handed
// lines. Said on the change only, never on every wait, and said again next time if it did not land.
function say(to, word) {
  said = word;
  return countedAsk(to, 'agent.state', { word: word }).answer.then(function (got) {
    if (outcomeOf(got) !== 'answered' && said === word) said = '';
  }, function () { if (said === word) said = ''; });
}

// As many waiting lines as one answer holds, oldest first.
// EVERY LINE SINCE THE LAST WAKE (goal/G33.8, box v15; Andy: "your desk client, when it wakes you, should give you all
// the lines that happened since your last wake"): the wake hands over the current goal's and the group chat's lines the
// stream brought since the agent's last wake, whoever wrote them and wherever, newest last, together with what was meant
// for it (the waking line among them, once); as many as fill one answer, the oldest left out first, and more says so.
// Nothing is asked of the desk: they are the rows the stream brought. A line not meant for the agent wakes nothing.
// THE ONE WAKE (goal/G33.2, box v3; Andy: "it's the actual 'wake' that must gather the news and attach it to the wake
// trigger"). Every trigger, a line meant for the agent, a general line its deskClient took, a change on an item it holds,
// a job or a Go, a pull's word, calls wakeWith with itself; the wait it ends hands over what the wake gathers
// (handOver): all the news since the last wake from what the stream brought, then the triggers, last. No trigger
// gathers news of its own.
function wakeWith(trigger) {
  waiting.push(trigger);
  wakers.splice(0).forEach(function (wake) { wake(); });
}
function handOver(to, t0) {
  moveSince();
  const triggers = waiting.splice(0);
  // A trigger's own NEWS copy goes: it comes once, as the trigger.
  const items = sinceWake.splice(0).filter(function (x) { return !triggers.some(function (w) { return w.key && w.key === x.key; }); });
  triggers.forEach(function (w) { items.push({ key: w.key || '', text: w.text }); });
  const all = items.map(function (x) { return x.text; });
  const lines = [];
  for (let i = all.length - 1; i >= 0; i--) {
    let text = all[i];
    if (!lines.length) {
      // One line too big for an answer on its own is cut to fit, never held back for ever.
      while (text.length > 1 && Buffer.byteLength(JSON.stringify({ lines: [text], more: true }), 'utf8') > ANSWER_ROOM) text = text.slice(0, Math.floor(text.length / 2));
    } else if (Buffer.byteLength(JSON.stringify({ lines: [text].concat(lines), more: true }), 'utf8') > ANSWER_ROOM) break;
    lines.unshift(text);
  }
  agentState = 'busy';
  const answer = lines.length < all.length ? { lines: lines, more: true } : { lines: lines };
  return within(say(to, 'working'), Math.min(SAY_MS, t0 + LEAVE_BY_MS - Date.now())).then(function () { return answer; });
}

// THE CHAT GATE (goal/G27.6): a chat write is allowed on an item the agent holds, or where it took a line. The desk's
// answer decides; no answer refuses.
// THE BOX IS GATED THE SAME WAY (goal/G27.12, reopened): Andy, 2026-10-17, to gating box.take and box.write in deskClient
// as chat is gated: "yes, add that". An agent that neither holds the item nor took his line there leaves its box alone.
const GATED = ['chat.add', 'box.take', 'box.write'];
// The items where a line of his addressed to this agent entitles it to answer (goal/G33.2, box v6).
const entitled = {};
function mayChat(to, verb, args) {
  if (GATED.indexOf(verb) === -1 || !args || !args.id) return Promise.resolve(true);
  const id = String(args.id);
  if (entitled[id]) return Promise.resolve(true);
  return askDesk(to, 'item.get', { id: id }).then(function (r) {
    let it = {};
    try { it = JSON.parse((r && r.item) || '{}'); } catch (e) { it = {}; }
    // THE DESK KEEPS HOLDS AND TAKES BY LABEL; ITS NAMES MAP GIVES THE NAME (goal/G27.6: Levant's label is not his name).
    const names = it.names || {};
    const nameOf = function (label) { return names[label] || label; };
    if (it.with && nameOf(it.with) === SELF) return true;
    // AN EARLIER PHASE HOLDER, OR ITS CREATOR (goal/G27.10, R2 and R5): the desk lets them post at any time, so this gate
    // does too.
    if ([it.red, it.builder, it.verifier, it.creator].some(function (l) { return l && nameOf(l) === SELF; })) return true;
    return askDesk(to, 'item.chat', { id: id }).then(function (c) {
      const lines = (c && Array.isArray(c.chat)) ? c.chat : [];
      return lines.some(function (l) { return l && l.taken && nameOf(l.taken) === SELF; });
    });
  }).catch(function () { return false; });
}

const server = appServer.serve({
  // ONE ASK OF ANDY'S DESK. What comes back is the answer, a refusal of the desk's included: it is the desk's to
  // say no. THE ANSWER ITSELF, NOT A JSON STRING (goal/G4.19, issue 4): the reply is declared {} and may carry more
  // (appServer.js), so a big desk read is not escaped once more past the travel limit. Andy: "4. a MAX_PAYLOAD pop
  // is serious."
  'desk': {
    // {name, json}: the desk verb's name and its arguments as JSON. The argument was verb until goal/G30.6, when calls
    // went flat on /api/spirit and a verb argument collided with the name of the call (Andy, 2026-10-20: "yes").
    request: { name: '', json: '' }, reply: {},
    handler: function (a, caller) {
      ownerOnly(caller);
      // A SIGNED-OFF AGENT WRITES NOTHING (goal/G27.12): the desk's signoff holds here too, not only on the desk's list (Andy 2026-10-16).
      if (agentState === 'signed off') throw refused('signed-off', { why: 'this agent is signed off' });
      const to = deskKey();
      let args = null;
      try { args = JSON.parse(a.json || '{}'); } catch (e) { args = null; }
      // A REFUSAL SAYS WHY (goal/G10.10; Andy, 2026-10-12: "all refusals everywhere should say why.").
      if (!a.name) throw refused('bad-request', { why: 'desk needs the name of the desk verb to ask' });
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw refused('bad-request', { why: 'desk needs json: the arguments as a JSON object' });
      // CHAT IS GATED (goal/G27.6; Andy 2026-10-16): on an item this agent holds, or where it has taken a line, its chat may
      // be written; anywhere else it may only reply to lines it successfully took. If the desk cannot say, it is refused.
      // A READ OF THE HELD ITEM, FROM WHAT IS KEPT (goal/G33.3): nothing asked of the desk.
      const reading = KEPT_READS.indexOf(a.name) !== -1;
      if (reading) { const ready = fromKept(a.name, args); if (ready) return ready; }
      // ITS AGENT'S OWN WRITE LEAVES WHAT IS KEPT ALONE (goal/G33.4, box v38: "an agent's own change lands in its cache
      // ONLY via the desk's push"): the change comes back from the desk like anybody's; nothing is written or dropped here.
      return mayChat(to, a.name, args).then(function (ok) {
        if (!ok) throw refused('not-taken', { why: 'this agent holds neither the item nor a line it took here' });
        const one = countedAsk(to, a.name, args);
        // An answer that is no object (an unopenable sealed answer resolves empty) is no answer.
        const answer = one.answer.then(function (got) {
          if (got === null || typeof got !== 'object' || Array.isArray(got)) throw refused('no-answer', { id: String(one.id) });
          // A PART READ WHEN NEEDED STAYS (goal/G33.4, box v46: "the box and other parts will come when needed and stay"):
          // into spirit.data through the desk's translator, which the push keeps current from now on.
          if (reading && got.ok !== false && globalThis.spirit && globalThis.spirit.deskData) globalThis.spirit.deskData.took(a.name, args, got);
          return got;
        });
        let timer = null;
        const held = new Promise(function (resolve, reject) {
          timer = setTimeout(function () { reject(refused('no-answer', { id: String(one.id) })); }, HOLD_MS);
        });
        return Promise.race([answer, held]).finally(function () { clearTimeout(timer); });
      });
    },
  },
  // WHICH NODE IS THE DESK, told once by the node's owner and kept.
  'setDesk': {
    request: { key: '' }, reply: { set: true },
    handler: function (a, caller) {
      ownerOnly(caller);
      if (!a.key) throw refused('bad-request', { why: 'setDesk needs the key of the node that runs the desk' });
      putSetting.run('desk', a.key);
      // IT SUBSCRIBES TO THE DESK'S STREAM (goal/G33.8, box v8: "A client subscribes; the desk only publishes").
      subscribeDesk(a.key);
      return { set: true };
    },
  },
  // THE AGENT WAITS HERE. What is waiting for it is handed over at once; else the desk is asked while the wait
  // lasts, and the wait ends with nothing inside the node's 12 s. The agent's listener asks again.
  'next': {
    request: {}, reply: { lines: [''] },
    handler: function (a, caller) {
      ownerOnly(caller);
      if (agentState === 'signed off') throw refused('signed-off', { why: 'this agent is signed off' });
      // ONLY WHEN IDLE: the agent asks here when it waits, so it is idle; a line is handed over only then.
      agentState = 'idle';
      const to = deskKey();
      const t0 = Date.now();
      const deadline = t0 + HOLD_MS;
      // A STREAM SILENT FOR LONG MAY HAVE DROPPED IT (goal/G33.8, box v8: the desk "stops sending to a client that has
      // disappeared (unreachable) until that client subscribes again"): a wait after RESUBSCRIBE_MS of silence subscribes
      // again, behind the wait, asking nothing else.
      if (Date.now() - heardAt > RESUBSCRIBE_MS) { heardAt = Date.now(); subscribeDesk(to); }
      // Its first word makes it known to the desk, which then streams it the current goal whole (goal/G33.4).
      if (said !== 'listening') say(to, 'listening');
      // A JOB AT ONCE (goal/G5.8). Andy: "will the deskAgentEar return immediately with a job to do if one is available?"
      // One read first, so lines waiting are handed before a job; then a job open to this agent comes back as a JOB
      // line, with the rules recorded on its item at his Go; else the wait goes on as before.
      // Asked only when a job may have opened since the last ask (jobsMaybe): a quiet wait asks the desk nothing.
      function firstJob() {
        if (!jobsMaybe) return Promise.resolve('');
        jobsMaybe = false;
        return countedAsk(to, 'work.open', {}).answer.then(function (got) {
          const jobs = ((got && got.items) || []).map(function (x) { try { return JSON.parse(x.label); } catch (e) { return null; } }).filter(Boolean);
          if (!jobs.length) return '';
          const j = jobs[0];
          return countedAsk(to, 'item.get', { id: j.id }).answer.then(function (g) {
            let fx = {};
            try { fx = JSON.parse(g.item); } catch (e) { fx = {}; }
            const keys = (Array.isArray(fx.rules) ? fx.rules : []).map(function (r) { return r.key + '@' + r.version; });
            return 'JOB ' + j.id + ' ' + j.phase + (keys.length ? ' rules: ' + keys.join(' ') : '');
          });
        }).catch(function () { return ''; });
      }
      // The wait ends, with lines or with none, only once every other agent is blocked here (goal/G3.9).
      function ending(answer) {
        return unblockedOther().then(function (bad) {
          if (bad) throw refused('unblocked', bad);
          return answer();
        });
      }
      function wait() {
        if (waiting.length) return ending(function () { return handOver(to, t0); });
        const now = Date.now();
        if (now >= deadline) return ending(function () { moveSince(); return { lines: [] }; });
        // NOTHING IS ASKED (goal/G33.4): the desk's stream brings what is meant for its agent; the time ends this, or a
        // line the stream brought does.
        let wake = null;
        const woken = new Promise(function (resolve) { wake = resolve; wakers.push(resolve); });
        return within(woken, deadline - now).then(function () {
          const i = wakers.indexOf(wake);
          if (i !== -1) wakers.splice(i, 1);
          return jobOrWait();
        });
      }
      // A JOB WAKES IT TOO (goal/G33.7, found live at G33.7's Go: "the agent was not woken"): a row the stream brought
      // that may open a job (jobsMaybe) has work.open asked at once, mid-wait as at its start, and a job ends the wait.
      function jobOrWait() {
        if (!jobsMaybe) return wait();
        return within(firstJob(), Math.max(0, deadline - Date.now())).then(function (job) {
          // A wake already waiting (a line, its own item's change) goes on without a job; with one, the job comes last.
          if (!job) return wait();
          // A job is a trigger like any other (goal/G33.2, box v3): the one wake.
          wakeWith({ text: job });
          return ending(function () { return handOver(to, t0); });
        });
      }
      return Promise.resolve().then(jobOrWait);
    },
  },
  // SIGNOFF (goal/G27.12). Desk sends the order; deskClient persists signed off and confirms it back to desk, whatever
  // the agent or model thinks. Only the signoff is written to disk.
  'signoff': {
    request: { agent: '' }, reply: { signedOff: true, status: '' },
    handler: function (a, caller) {
      ownerOnly(caller);
      agentState = 'signed off';
      try { fs.writeFileSync(path.join(STATE, 'status.json'), JSON.stringify({ status: agentState, signedOff: true, at: new Date().toISOString() })); }
      catch (e) { throw refused('not-saved', { why: 'could not persist the signoff' }); }
      return { signedOff: true, status: agentState };
    },
  },
  // CLEAR SIGNOFF (goal/G27.6, approved by Andy 2026-10-16). Owner-only: the desk lifts a signoff it gave, and the agent
  // is connected again. The cleared state is written to STATE/status.json, the same file the signoff uses.
  'clearSignoff': {
    request: { agent: '' }, reply: { cleared: true, status: '' },
    handler: function (a, caller) {
      ownerOnly(caller);
      agentState = 'connected';
      try { fs.writeFileSync(path.join(STATE, 'status.json'), JSON.stringify({ status: agentState, signedOff: false, at: new Date().toISOString() })); }
      catch (e) { throw refused('not-saved', { why: 'could not persist the cleared signoff' }); }
      return { cleared: true, status: agentState };
    },
  },
  // changed, the desk's nudge (goal/G3.5), WENT WITH goal/G33.7 (the approved verb list: "nothing sends it since the
  // push"): the stream's own rows wake a wait.
  // THE STATISTICS. Each label is one record as JSON; the walk is ours (newest first), the text ranks each record by
  // its verb and outcome (goal/G29.21, probabilityStringObjectMatch), newest first among equals; the cut and `more`
  // are the probability bucket's. The record is bounded (historyMax), so every row is weighed.
  'history.search': {
    request: { text: '' }, reply: { items: [{ key: '', label: '' }], more: false },
    handler: function (a) {
      const text = String(a.text || '').trim();
      const bucket = createProbabilityBucket(Infinity);
      for (const r of findAsks.iterate('', '', '')) {
        const label = JSON.stringify({ at: r.at, verb: r.verb, ms: r.ms, outcome: r.outcome, bytes: r.bytes, port: r.port, count: r.count });
        const probability = text ? probabilityStringObjectMatch(text, { verb: String(r.verb), outcome: String(r.outcome) }) : 0;
        bucket.seatFor(probability, { key: String(r.id), label: label });
      }
      const r = bucket.serialize(null, ANSWER_ROOM);
      return { items: r.items, more: !!r.more };
    },
  },
// What a peer needs granted here (apiAuth/G1.10): the desk's node, the one verb it nudges with.
//
// ITS OWN REFUSAL (goal/G16.11): declared here rather than in the shared
// register the node and the relay load. appServer puts "deskClient: " in
// front of the text.
}, {
  // THE DESK'S STREAM (goal/G33.4, box v40-41): appServer's streamListener takes each row into spirit.data through the
  // desk's translator, then hands it to streamed (above), which picks out what is meant for its agent.
  stream: { module: 'process/js/desk', translator: path.join(__dirname, '..', '..', '..', 'shell', 'js', 'desk', 'data.js'), onRow: streamed },
  dependencies: ['deskClient.streamListener'], codes: {
  // Rule 1 at this node (goal/G3.9): the agent's wait is refused while another agent's key is not blocked here.
  'unblocked': { status: 409, text: 'another agent is not blocked on this node' },
  // The chat and box gate (goal/G27.6, goal/G27.12): undeclared, both reached the agent as handler-failed.
  'not-taken': { status: 409, text: 'this agent holds neither the item nor a line it took here' },
  // A signed-off agent (goal/G27.12): deskAgentEar reads this code to say so.
  'signed-off': { status: 409, text: 'this agent is signed off' },
} });

// SUBSCRIBED TO THE DESK (goal/G33.8): appServer's client half (js/appServer.js server.subscribe): the desk setDesk
// named, from the start and whenever setDesk names one, as family deskClient of the desk's family.
function subscribeDesk(key) { return server.subscribe(key, 'desk').catch(function () { return false; }); }
(function () { const d = getSetting.get('desk'); if (d && d.value) subscribeDesk(d.value); }());

// THE CHECKOUT, WATCHED (goal/G33.11). Andy, in the box: "While its agent holds the red or the build of an item, the
// agent's deskClient watches its checkout and reports each change to the item's status column only, never to the chat.
// The status shows the changed file's name only, without its path; its colour says which kind: red a test file, white a
// production file." Each change is one item.status, as the agent; the desk keeps the file name and counts the write as
// activity, so a hold whose files move is never stale. A file git ignores (logs, node state, this server's own db) is
// no change to the work. A path under spirit/test/ is tone test, any other code.
function heldPhase() {
  const items = dataSet.branch('deskItems') || {};
  for (const id of Object.keys(items)) {
    const f = dataSet.get('deskItems/' + id);
    if (!f || f.done || f.status === 'closed' || !heldByMe(f)) continue;
    if ((f.phase === 'red' && f.red === SELF) || (f.phase === 'build' && f.builder === SELF)) return String(f.id);
  }
  return '';
}
const ignoredPaths = new Map();
function ignored(root, rel) {
  if (ignoredPaths.has(rel)) return Promise.resolve(ignoredPaths.get(rel));
  return gitIn(['check-ignore', '-q', '--', rel], root).then(function (r) {
    const is = r.status === 0;
    if (ignoredPaths.size > 1000) ignoredPaths.clear();
    ignoredPaths.set(rel, is);
    return is;
  });
}
// THE NODE'S OWN WATCHER COMPONENT (goal/G40.3). Andy: "you hand-rolled shit again!", "use that chokidar component then
// on the whole repo.", and "you may as well add to the filename in the status (changed, deleted, added)". chokidar, as
// the node's fs-watcher job uses it (js/jobs.js), on the whole checkout; the status word is the path and what happened
// to it, which the desk keeps as the file's name and that word.
const WHAT = { add: 'added', change: 'changed', unlink: 'deleted' };
function watchCheckout(root) {
  try {
    const skip = function (full) {
      const rel = path.relative(root, String(full)).split(path.sep).join('/');
      return rel.split('/').some(function (part) { return part === '.git' || part === 'node_modules'; });
    };
    require('chokidar').watch(root, { ignored: skip, ignoreInitial: true, persistent: true }).on('all', function (event, full) {
      if (!WHAT[event] || !full) return;
      const rel = path.relative(root, String(full)).split(path.sep).join('/');
      const id = heldPhase();
      if (!id) return;
      ignored(root, rel).then(function (skipped) {
        if (skipped) return;
        let to = '';
        try { to = deskKey(); } catch (e) { return; }
        countedAsk(to, 'item.status', { id: id, word: rel + ' ' + WHAT[event], tone: rel.indexOf('spirit/test/') === 0 ? 'test' : 'code' }).answer.catch(function () {});
      });
    }).on('error', function (e) { console.error('deskClient: the checkout watch stopped: ' + ((e && e.message) || e)); });
  } catch (e) { console.error('deskClient: the checkout cannot be watched: ' + ((e && e.message) || e)); }
}
gitIn(['rev-parse', '--show-toplevel'], __dirname).then(function (top) { if (top.status === 0 && top.out) watchCheckout(top.out); });
