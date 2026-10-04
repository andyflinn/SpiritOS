'use strict';

// spirit/run/process/js/deskClient/deskClient.js
// THE DESK CLIENT — goal/G3.3, G3.4, G3.5. A server on an agent's own node: it passes one ask to Andy's desk and counts
// it, and while its agent waits it reads what changed at the desk and holds what is meant for that agent.
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
//   - WHO IT IS, name and key, is what its node hands a server it starts (--node, jobs.js): no ask and no file.
//   - IT ASKS THE DESK ONLY WHILE ITS AGENT WAITS on next: at once when the last ask is pollMs old, then every
//     pollMs. Nobody waiting, nothing asked.
//   - THE DESK NUDGES IT, SERVER TO SERVER (goal/G3.5): changed, from the desk's key alone. A nudge makes a wait
//     ask at once; with nobody waiting it asks nothing and is remembered, so the next wait asks at once. The
//     node's own door lets the desk's key in only once the node's owner granted it deskClient.changed.
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
const POLL_MS = Number(values.pollMs) > 0 ? Number(values.pollMs) : 60000;
const HISTORY_MAX = Number(values.historyMax) > 0 ? Math.floor(Number(values.historyMax)) : 1000;
// Who this agent is: its node's name and key, to tell what is its own from what is meant for it.
const NODE = parsed(arg('--node'), {});
const SELF = String(NODE.name || '');
const SELF_KEY = String(NODE.publicKey || '');

// The asker is answered inside the node's 12 s; the desk is waited for as long as a held post may take to land
// and be answered (the node holds a busy post for PATIENCE_MS, peer.post's own patienceMs).
const HOLD_MS = 10000;
const PATIENCE_MS = 60000;
const WAIT_MS = PATIENCE_MS + 30000;
const ANSWER_ROOM = appClient.ANSWER_MAX - 512;
// A hand-over waits this long for "working" to reach the desk, never past the node's 12 s.
const SAY_MS = 3000;
const LEAVE_BY_MS = 11000;
const BIG = Number.MAX_SAFE_INTEGER;

// The node this server runs on, as the node itself named it; its port goes into every record, and its door answers
// who is blocked there (goal/G3.9).
let PORT = 0;
let NODE_URL = '';
try { const u = new URL(String(process.env.SPIRIT_CALLBACK_URL || '')); PORT = Number(u.port) || 0; NODE_URL = u.origin; } catch (e) { PORT = 0; NODE_URL = ''; }

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
const addDone = db.prepare('INSERT INTO asks (at, verb, ms, outcome, bytes, port, count) VALUES (?, ?, ?, ?, ?, ?, ?)');
const newestAsk = db.prepare('SELECT id, verb, outcome FROM asks ORDER BY id DESC LIMIT 1');
const growRun = db.prepare('UPDATE asks SET ms = ms + ?, bytes = bytes + ?, count = count + 1 WHERE id = ?');
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
// A record opened as pending, to be ended; or written whole. Either way the oldest rows past historyMax go.
function begin(verb) {
  const id = Number(addAsk.run(new Date().toISOString(), verb, PORT).lastInsertRowid);
  trimAsks.run(HISTORY_MAX);
  return id;
}
function record(verb, outcome, ms, bytes, count) {
  addDone.run(new Date().toISOString(), verb, ms, outcome, bytes, PORT, count);
  trimAsks.run(HISTORY_MAX);
}
// A poll that brought nothing joins the run it continues: the newest record, when that is an empty one.
function recordEmptyPoll(ms, bytes) {
  const top = newestAsk.get();
  if (top && top.verb === 'changes' && top.outcome === 'empty') growRun.run(ms, bytes, top.id);
  else record('changes', 'empty', ms, bytes, 1);
}

// One ask of the desk, as the kernel posts it: {desk: {verb: args}} in an api packet to the desk's node.
function askDesk(to, verb, args) {
  const ask = { desk: {} };
  ask.desk[verb] = args;
  return kernel.peerPost(to, 'api', ask, { waitMs: WAIT_MS, patienceMs: PATIENCE_MS });
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

// ── WHAT THE DESK HOLDS FOR THIS AGENT (goal/G3.4) ───────────────────
// place: how far the agent has been HANDED things, kept in the state so a restart repeats and misses nothing.
// fetched: how far the desk has been read; ahead of place only while lines wait to be handed over.
// waiting: those lines, each with the place that stands once it is handed over.
function savedPlace() {
  const n = getSetting.get('n');
  const line = getSetting.get('line');
  if (!n || !line || isNaN(Number(n.value)) || isNaN(Number(line.value))) return null;
  return { n: Number(n.value), line: Number(line.value) };
}
let place = savedPlace();
let fetched = place;
const waiting = [];
let lastAskAt = 0;
let turn = null;
let said = '';
// nudged: the desk said something changed, and no poll has started since. wakers: the waits a nudge ends early.
let nudged = false;
const wakers = [];

function keepPlace(p) {
  place = p;
  putSetting.run('n', String(p.n));
  putSetting.run('line', String(p.line));
}

function changes(to, n, line) {
  const t0 = Date.now();
  return askDesk(to, 'changes', { n: n, line: line }).then(function (got) {
    return { got: got, ms: Date.now() - t0, bytes: bytesOf(got), ok: !!(got && Array.isArray(got.records) && Array.isArray(got.lines)) };
  });
}

// HIS "publish" STARTS A PUBLISH (goal/G4.33). Andy, to what starts it: "\"publish\"", his group-chat line exactly
// that; to N: "that's a fine number" (20); "it will be done as a SpiritOS process, that will be cleaned-up/deleted
// from jobs when it's done." So the line asks this agent's own node for a publishData job, removed from Jobs once it
// exited cleanly (goal/G4.34); any other line starts nothing. The job runs from the node's own tree, so publishData
// finds the agent's clone, measures, commits agents/<agent>/ under the standing grant, and says so in Desk.
const PUBLISH_ASKS = 20;
function publishOn(body) {
  let b = null;
  try { b = JSON.parse(body); } catch (e) { return; }
  if (!b || b.id !== 'desk/G0.0' || String(b.text || '').trim() !== 'publish' || !NODE_URL || !PORT) return;
  kernel.core.ask('jobs.create', { command: process.execPath, args: [path.join(__dirname, 'publishData.js'), String(PORT), '--asks', String(PUBLISH_ASKS)],
    type: 'publishData', removeWhenDone: true }, NODE_URL).then(function (r) {
    if (!r || r.status >= 300) console.error('deskClient: the node refused the publish job: ' + (r ? r.text : 'no answer'));
  }, function (e) { console.error('deskClient: the publish job was not asked: ' + ((e && e.message) || e)); });
}

// What one answer of changes holds for this agent, in the order the desk gave it, each with the place after it.
function meantForAgent(got, from) {
  const out = [];
  const cur = { n: from.n, line: from.line };
  got.records.forEach(function (r) {
    cur.n = r.n;
    // ITS OWN RECORDS ARE KNOWN BY THEIR KEY. At the desk an agent goes by the label Andy's node holds for its
    // key, which he may change and which need not be its node's name (claude-windows's review of goal/G3.4); the
    // name decides only where no key was handed over.
    const mine = SELF_KEY ? r.key === SELF_KEY : r.by === SELF;
    if (r.key && !mine && r.by && r.by !== 'andy' && r.by !== 'desk') rememberOther(r.key, r.by);
    if (r.by === 'andy') {
      if (r.verb === 'press' && /"what":"seen"/.test(r.body)) return;
      if (r.verb === 'chat.add') publishOn(r.body);
      out.push({ text: 'DESK andy ' + r.verb + ' ' + String(r.body).slice(0, 4000), n: cur.n, line: cur.line });
    } else if (r.by && !mine && r.by !== 'desk' && r.verb === 'chat.add') {
      // The desk's own busy replies are for Andy; they wake no agent (Andy: "it won't bother you").
      out.push({ text: 'DESK ' + r.by + ' chat.add ' + String(r.body).slice(0, 4000), n: cur.n, line: cur.line });
    }
  });
  got.lines.forEach(function (l) {
    cur.line = l.line;
    const sender = String(l.from || '');
    // Its own line: the name it sent it under, or a line Desk took in from its own key.
    if (sender === SELF || (l.dir === 'in' && SELF_KEY && l.peer === SELF_KEY)) return;
    // His direct line to the other agent is not this agent's: the peer on the line says who it was for.
    if (sender === 'andy' && SELF_KEY && l.peer && l.peer !== SELF_KEY) return;
    if (sender === 'andy' || /claude/.test(sender)) {
      out.push({ text: 'LINE ' + sender + ' ' + (l.kind || '') + (l.todo ? ' todo ' + l.todo : '') + ': ' + String(l.text || '').slice(0, 4000), n: cur.n, line: cur.line });
    }
  });
  return out;
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
  if (!NODE_URL) return Promise.resolve(false);
  return kernel.core.ask('contact.get', { key: key }, NODE_URL).then(function (r) {
    const p = r && r.body && r.body.person;
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

// A FIRST RUN STARTS AT NOW, not at the beginning: each cursor is found by halving, the smallest value after
// which the desk answers nothing more. One record for the whole search, its count the asks it took.
function findNow(to) {
  let asks = 0;
  let ms = 0;
  let bytes = 0;
  function after(which, v) {
    return changes(to, which === 'n' ? v : BIG, which === 'n' ? BIG : v).then(function (r) {
      asks += 1; ms += r.ms; bytes += r.bytes;
      if (!r.ok) { const e = new Error('changes'); e.got = r.got; throw e; }
      return (which === 'n' ? r.got.records : r.got.lines).length > 0;
    });
  }
  function lastOf(which) {
    let lo = 0;
    let hi = 1;
    function grow() { return after(which, hi).then(function (more) { if (!more) return null; lo = hi; hi = hi * 2; return grow(); }); }
    function halve() {
      if (lo >= hi) return Promise.resolve(hi);
      const mid = Math.floor((lo + hi) / 2);
      return after(which, mid).then(function (more) { if (more) lo = mid + 1; else hi = mid; return halve(); });
    }
    return grow().then(halve);
  }
  return Promise.all([lastOf('n'), lastOf('line')]).then(function (c) {
    fetched = { n: c[0], line: c[1] };
    keepPlace(fetched);
    record('changes', 'answered', ms, bytes, asks);
  }, function (e) {
    // The desk could not be read: no place is taken, and the next poll searches again.
    record('changes', outcomeOf(e && e.got), ms, bytes, Math.max(1, asks));
  });
}

// One poll: everything after fetched, page by page while the desk says more.
function readOn(to) {
  let ms = 0;
  let bytes = 0;
  let raw = 0;
  let at = fetched;
  const found = [];
  function page() {
    return changes(to, at.n, at.line).then(function (r) {
      ms += r.ms; bytes += r.bytes;
      // A poll the desk did not answer moves nothing: what it had read is read again next time.
      if (!r.ok) { record('changes', outcomeOf(r.got), ms, bytes, 1); return null; }
      raw += r.got.records.length + r.got.lines.length;
      meantForAgent(r.got, at).forEach(function (x) { found.push(x); });
      at = { n: r.got.n, line: r.got.line };
      if (r.got.more) return page();
      fetched = at;
      found.forEach(function (x) { waiting.push(x); });
      // Nothing waits to be handed over, so nothing can be lost: the place moves at once.
      if (!waiting.length) keepPlace(fetched);
      if (raw === 0) recordEmptyPoll(ms, bytes);
      else record('changes', 'answered', ms, bytes, 1);
      return null;
    });
  }
  return page();
}

// The one poll under way, or a new one. Never two at once: two would read the same things twice.
function poll(to) {
  if (turn) return turn;
  // A nudge that lands while this poll is under way stands: what it tells of may be written after the read.
  nudged = false;
  lastAskAt = Date.now();
  turn = Promise.resolve().then(function () { return fetched ? readOn(to) : findNow(to); })
    .catch(function () { /* the next poll tries again */ })
    .then(function () { turn = null; });
  return turn;
}

// THE AGENT'S WORD AT THE DESK (goal/G2.3): listening when its agent starts to wait, working when it is handed
// lines. Said on the change only, never on every wait, and said again next time if it did not land.
function say(to, word) {
  said = word;
  return countedAsk(to, 'agent.state', { word: word }).answer.then(function (got) {
    if (outcomeOf(got) !== 'answered' && said === word) said = '';
  }, function () { if (said === word) said = ''; });
}

// As many waiting lines as one answer holds, oldest first; the place moves to the last one handed over.
function handOver(to, t0) {
  const lines = [];
  let last = null;
  while (waiting.length) {
    const next = waiting[0];
    if (Buffer.byteLength(JSON.stringify({ lines: lines.concat([next.text]) }), 'utf8') > ANSWER_ROOM) {
      if (lines.length) break;
      // One line too big for an answer on its own is cut to fit, never held back for ever.
      let text = next.text;
      while (text.length > 1 && Buffer.byteLength(JSON.stringify({ lines: [text] }), 'utf8') > ANSWER_ROOM) text = text.slice(0, Math.floor(text.length / 2));
      next.text = text;
    }
    lines.push(next.text);
    last = waiting.shift();
  }
  keepPlace(waiting.length ? { n: last.n, line: last.line } : fetched);
  return within(say(to, 'working'), Math.min(SAY_MS, t0 + LEAVE_BY_MS - Date.now())).then(function () { return { lines: lines }; });
}

appServer.serve({
  // ONE ASK OF ANDY'S DESK. What comes back is the answer, a refusal of the desk's included: it is the desk's to
  // say no. THE ANSWER ITSELF, NOT A JSON STRING (goal/G4.19, issue 4): the reply is declared {} and may carry more
  // (appServer.js), so a big desk read is not escaped once more past the travel limit. Andy: "4. a MAX_PAYLOAD pop
  // is serious."
  'desk': {
    request: { verb: '', json: '' }, reply: {},
    handler: function (a, caller) {
      ownerOnly(caller);
      const to = deskKey();
      let args = null;
      try { args = JSON.parse(a.json || '{}'); } catch (e) { args = null; }
      if (!a.verb || !args || typeof args !== 'object' || Array.isArray(args)) throw refused('bad-request');
      const one = countedAsk(to, a.verb, args);
      // An answer that is no object (an unopenable sealed answer resolves empty) is no answer.
      const answer = one.answer.then(function (got) {
        if (got === null || typeof got !== 'object' || Array.isArray(got)) throw refused('no-answer', { id: String(one.id) });
        return got;
      });
      let timer = null;
      const held = new Promise(function (resolve, reject) {
        timer = setTimeout(function () { reject(refused('no-answer', { id: String(one.id) })); }, HOLD_MS);
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
  // THE AGENT WAITS HERE. What is waiting for it is handed over at once; else the desk is asked while the wait
  // lasts, and the wait ends with nothing inside the node's 12 s. The agent's listener asks again.
  'next': {
    request: {}, reply: { lines: [''] },
    handler: function (a, caller) {
      ownerOnly(caller);
      const to = deskKey();
      const t0 = Date.now();
      const deadline = t0 + HOLD_MS;
      if (said !== 'listening') say(to, 'listening');
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
        if (now >= deadline) return ending(function () { return { lines: [] }; });
        if (turn || nudged || now - lastAskAt >= POLL_MS) return within(poll(to), deadline - now).then(wait);
        // Nothing to ask yet: the time ends this, or a nudge does.
        let wake = null;
        const woken = new Promise(function (resolve) { wake = resolve; wakers.push(resolve); });
        return within(woken, Math.min(deadline, lastAskAt + POLL_MS) - now).then(function () {
          const i = wakers.indexOf(wake);
          if (i !== -1) wakers.splice(i, 1);
          return wait();
        });
      }
      return wait();
    },
  },
  // THE DESK'S NUDGE (goal/G3.5): something changed there. The desk's alone, by the key setDesk named. It asks
  // nothing itself: a waiting agent's wait does, at once, and with nobody waiting the next wait will.
  'changed': {
    request: {}, reply: { heard: true },
    handler: function (a, caller) {
      const to = getSetting.get('desk');
      if (!caller || !to || !to.value || caller.key !== to.value) throw refused('not-granted');
      nudged = true;
      wakers.splice(0).forEach(function (wake) { wake(); });
      return { heard: true };
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
        const label = JSON.stringify({ at: r.at, verb: r.verb, ms: r.ms, outcome: r.outcome, bytes: r.bytes, port: r.port, count: r.count });
        if (!bucket.offer({ key: String(r.id), label: label })) break;
      }
      const r = bucket.getResult();
      return { items: r.items, more: r.more };
    },
  },
// What a peer needs granted here (apiAuth/G1.10): the desk's node, the one verb it nudges with.
}, { dependencies: ['deskClient.changed'] });
