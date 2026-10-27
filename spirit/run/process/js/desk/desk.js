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

// The spirit object first, as the global spirit (goal/G40.1).
require('../../../spirit.js');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const appServer = require('../../../spirit/appServer.js');
const limits = require('../../../spirit/limits.js');

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
// THE OLD LINES TABLE WENT WITH goal/G33.4 (Andy, in the item's box: "Records with no goal or item are dumped at
// migration: agent.state, scope.set and the old lines table."); migrate() below drops it. THE DOCS TABLE WENT WITH goal/G33.7:
// state had no reader, and seen is one value per item (seen.set), so nothing grows as one document.
db.exec('DROP TABLE IF EXISTS docs;');

// One answer must travel back as one packet (limits.ANSWER_MAX); the
// wrapper around the lines is small, and this leaves it room.
const ANSWER_ROOM = limits.ANSWER_MAX - 512;

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
// AN AGENT STAYS WITH ITS OPEN RED Q (goal/G41.2). Andy: "when i repond to a red Q, the agent must enter remain with the
// red Q and me, until it is resolved, so that you won't go of making red Q decisions without me", and on resolving it:
// "if you feel a Q answered usefully, then fucking remove the Q with an appropriate remark". The writer's own open Q on
// the item, or null: while there is one, nothing of the writer's lands on the item (phase.may) and its phase is not done.
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
// Until this the desk's searches graded nothing: a substring filter, then the graded bucket in the walk's order. With no
// text every probability is 0 and the bucket keeps the walk's order, so the List reads as it did.
const probabilityStringMatch = require('../../../spirit/probabilityStringMatch.js').probabilityStringMatch;
const probabilityStringObjectMatch = require('../../../spirit/probabilityStringObjectMatch.js').probabilityStringObjectMatch;
const createProbabilityBucket = require('../../../spirit/probabilityBucket.js').createProbabilityBucket;
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

// ── EVERY TABLE'S SEARCH, FROM ONE COMPONENT (goal/G33.7) ──────────────
//
//   The box: "Every desk table's interface has its probability search, mandatory and made by one shared component
//   rather than written per table; the suites table's is item.suites.search".
//
// tableSearch(spec) makes the verb: spec.request (the arguments beside text, each '' or its kind), spec.rows(a, st,
// caller) -> [{ key, fields, label, probability? }] in the walk's order (newest first where there is an order), and
// spec.room (ANSWER_ROOM unless said). Each row ranks by text against its fields (probabilityStringObjectMatch) unless
// it brings its own probability; every row goes through ranked(), so the answer fills one room and says more. With no
// text every probability is 0 and the walk's order stands. A table's verb is this and nothing else.
function tableSearch(spec) {
  return {
    request: Object.assign({ text: '' }, spec.request || {}), reply: { items: [{ key: '', label: '' }], more: false },
    accepts: spec.accepts,
    handler: function (a, caller) {
      const text = String((a && a.text) || '').trim();
      const rows = spec.rows(a || {}, walkState(), caller, text);
      return ranked(rows.map(function (r) {
        const p = typeof r.probability === 'number' ? r.probability : text ? probabilityStringObjectMatch(text, r.fields || {}) : 0;
        return { probability: p, pair: { key: String(r.key), label: typeof r.label === 'string' ? r.label : JSON.stringify(r.label) } };
      }), spec.room || ANSWER_ROOM);
    },
  };
}
// Every version of an item's box, newest first (the box table keeps them all).
const boxVersionsOf = { all: function (g, i) { return db.prepare('SELECT version, creator, at, text FROM box WHERE goal = ? AND item = ? ORDER BY version DESC').all(g, i); } };
// ONE ROW OF A LIST TABLE, ADDED OR REMOVED (goal/G40.3): {id, path}, one path a write. has(it, w, p) says whether the
// row is there; an add refuses one already there and a remove one not there, naming it. A path never climbs (..). A
// suite is a spirit/test/ .js path, or a product test, a .js in a test/ folder of the run tree (goal/G41.2: the verifier
// runs those since goal/G40.13), and only the item's red writer, or Andy, writes its suites.
const SUITE_PATH = /^spirit\/test\/[^/]+(\/[^/]+)*\.js$|^spirit\/run\/([^/]+\/)*test\/[^/]+\.js$/;
function listRowVerb(verb, has, adding, suite) {
  return {
    request: { id: '', path: '' }, reply: { change: 0 },
    accepts: function (x) {
      return !!x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).length === 2 && typeof x.id === 'string' && typeof x.path === 'string' && x.path !== '';
    },
    handler: function (a, caller) {
      const w = writerOf(caller);
      const p = String(a.path);
      const it = itemFor(walkState(), a);
      if (p.replace(/\\/g, '/').split('/').indexOf('..') !== -1) throw refusedWhy('bad-request', 'a listed path may not contain a .. segment: ' + p);
      if (suite && !SUITE_PATH.test(p)) throw refusedWhy('bad-request', 'a suite is a spirit/test/ .js path or a product test (a .js in a test/ folder of spirit/run/), not ' + JSON.stringify(p));
      if (suite && w.by !== 'andy' && it.red !== w.by && !(it.phase === 'red' && it.phaseWith === w.by)) throw refusedWhy('not-offered', 'the suites of ' + it.id + ' are its red writer\'s to add or remove');
      const there = has(it, w, p);
      if (adding && there) throw refusedWhy('bad-request', p + ' is on the list of ' + it.id + ' already');
      if (!adding && !there) throw refusedWhy('bad-request', p + ' is not on the list of ' + it.id);
      // The grant is kept in the walk, beside the list it describes, so the record decides the same everywhere.
      const body = { id: it.id, path: p, by: w.by, key: w.key };
      // THE FILE LIST BRINGS TESTS AND UI RULES (goal/G40.13, box v22, points 6 and 7), decided at the write and kept in
      // the record, so a replay brings the same: a file of the product tree with its own test beside it brings that
      // test into the item's suites; a file in spirit/run/shell/ brings every active auto-attach ui rule.
      if (verb === 'item.files.add') {
        const own = ownProductTest(p);
        if (own) body.test = own;
        if (/^spirit\/run\/shell\//.test(p.replace(/\\/g, '/'))) body.uiRules = autoAttachKeys('ui');
      }
      return { change: write(verb, body).change };
    },
  };
}
// A LIST OF PATHS IN ONE WRITE, FOR THE DESK ONLY (goal/G41.11). Andy: "agreed to publishing lists, FOR DESK ONLY, this
// is NOT a general rule". item.files.add {id, paths: [...]} beside the one row's {id, path}: the caller's list in its
// order, cut at one answer's room by a sized probability bucket (every path at probability 0, so the order stands);
// what fits lands on the caller's list in one write, each path checked as the one row's is, and the answer says how
// many landed (added) and whether the rest was cut (more), so the caller sends the rest again. Not a pattern for other
// verbs: his ruling names the desk alone.
function filesAddVerb(one) {
  return {
    request: { id: '', path: '' }, reply: { change: 0, added: 0, more: false },
    accepts: function (x) {
      if (!x || typeof x !== 'object' || Array.isArray(x) || typeof x.id !== 'string') return false;
      if (!Object.prototype.hasOwnProperty.call(x, 'paths')) return one.accepts(x);
      return Object.keys(x).length === 2 && Array.isArray(x.paths) && x.paths.length > 0 &&
        x.paths.every(function (p) { return typeof p === 'string' && p !== ''; });
    },
    handler: function (a, caller) {
      if (!Array.isArray(a.paths)) return { change: one.handler(a, caller).change, added: 1, more: false };
      const w = writerOf(caller);
      const it = itemFor(walkState(), a);
      const asked = a.paths.map(String).filter(function (p, i, all) { return all.indexOf(p) === i; });
      const bucket = createProbabilityBucket(asked.length);
      asked.forEach(function (p) { bucket.seatFor(0, p); });
      const cut = bucket.serialize(null, ANSWER_ROOM);
      const paths = cut.items;
      if (!paths.length) throw tooLarge(Buffer.byteLength(JSON.stringify(asked.slice(0, 1)), 'utf8'), ANSWER_ROOM);
      const mine = (it.files && Array.isArray(it.files[w.by])) ? it.files[w.by] : [];
      const climbs = paths.filter(function (p) { return p.replace(/\\/g, '/').split('/').indexOf('..') !== -1; });
      if (climbs.length) throw refusedWhy('bad-request', 'a listed path may not contain a .. segment: ' + climbs.join(', '));
      const there = paths.filter(function (p) { return mine.indexOf(p) !== -1; });
      if (there.length) throw refusedWhy('bad-request', there.join(', ') + (there.length === 1 ? ' is' : ' are') + ' on the list of ' + it.id + ' already');
      // goal/G40.13, as the one row's: each file's own test, and a shell file's ui rules, decided at the write.
      const body = { id: it.id, paths: paths, by: w.by, key: w.key };
      const tests = paths.map(ownProductTest).filter(function (t) { return !!t; });
      if (tests.length) body.tests = tests;
      if (paths.some(function (p) { return /^spirit\/run\/shell\//.test(p.replace(/\\/g, '/')); })) body.uiRules = autoAttachKeys('ui');
      return { change: write('item.files.add', body).change, added: paths.length, more: !!cut.truncated };
    },
  };
}
function ruleRowVerb(verb, adding) {
  return {
    request: { id: '', rule: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      // HIS ALONE (Andy, 2026-10-26: "it is I, the USER who controls auto-attach and the rules, NOT the agents").
      ownerOnly(caller);
      const w = writerOf(caller);
      const it = itemFor(walkState(), a);
      const key = String(a.rule || '');
      if (!newestRule.get(key)) throw refused('no-such-item');
      const there = Array.isArray(it.attached) && it.attached.indexOf(key) !== -1;
      if (adding && there) throw refusedWhy('bad-request', key + ' is attached to ' + it.id + ' already');
      if (!adding && !there) throw refusedWhy('bad-request', key + ' is not attached to ' + it.id);
      return { change: write(verb, { id: it.id, rule: key, by: w.by, key: w.key }).change };
    },
  };
}
// A file's own product test (spirit/run/test/TEST_SYSTEM.md: ./test/<name>.js beside ./<name>.js), as a repository
// path, or '' when the file is not in the product tree or has none: a module without its own test brings nothing.
function ownProductTest(p) {
  const rel = String(p || '').replace(/\\/g, '/');
  if (!/^spirit\/run\/.+\.js$/.test(rel) || rel.split('/').indexOf('test') !== -1) return '';
  const own = path.posix.join(path.posix.dirname(rel), 'test', path.posix.basename(rel));
  return fs.existsSync(path.join(__dirname, '..', '..', '..', '..', '..', own)) ? own : '';
}
// The item a table's search is about: by id, refused when there is none.
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
// is one current value per agent, and an id is two numbers, goal and item (0 for the goal itself), rendered goal/G<n>
// or goal/G<n>.<m>. No sub-goals: an item never becomes a goal.
//
// HOW (this build's plainest reading): the tables are read once at start into the state every rule below reads (S);
// each write is applied to S and written through, in the same step, to exactly the rows it changed, which are then
// pushed (goal/G33.4: "the desk pushes each changed sub-element of a goal or item ... separately"). Nothing is replayed.
//   items    (goal, item)                  the item's own fields as JSON; a goal's row (item 0) also its goal's (design,
//                                          members, special, plugin); special marks the group chat and plugin goals
//   chat     (goal, item, seq)             one line, with at and creator (goal/G33.4: "keyed by goal, item, timestamp and
//                                          the writer's id"; seq keeps two lines of one millisecond apart)
//   box      (goal, item, version)         one row per version
//   checks   (goal, item, number)          one Q, G, C or T check
//   files    (goal, item, holder, path)    one file an agent listed, with its grant status
//   claims   (goal, item, claimer)         one agent's claim
//   suites   (goal, item, path)            one suite a Verify of the item runs, supplied by its red writer with the red
//                                          claim (goal/G33.4, box v44-45), creator the claimer's key
//   agents   (agent)                       by key: its label, its last write, its word, his profile of it
//   desk_state (k)                         the desk's own few values: the change number, the current goal, the grants
// THE CHANGE NUMBER stays: one per write, stamped on every row the write changed and on every row the write publishes,
// so a client that hears a number skip knows it missed a row.
const GOAL_RE = /^goal\/G(\d+)(?:\.(\d+))?$/;
// goal/G33.4 -> [33, 4]; goal/G33 -> [33, 0]; anything else -> null.
function numbersOf(id) { const m = GOAL_RE.exec(String(id || '')); return m ? [Number(m[1]), Number(m[2] || 0)] : null; }
function idOf(goal, item) { return 'goal/G' + goal + (item ? '.' + item : ''); }

// THE RULES, A TABLE OF THEIR OWN (goal/G5.5), KEYED BY RULE NUMBER (goal/G33.4: "the desk rules by their rule number").
//   Andy: "rules remain static and apply to all items. ... so rules don't worry about items, items need to worry
//   about rules.", and on keeping the old texts: "might be a good idea to have a history of legal standards, it's a
//   form of proof, too." So every version is a row of `rules`, never overwritten, numbered n across all rules (the
//   version an item's Go recorded), the newest row per rule is the rule and the older ones its history; his draft
//   between versions is one row per rule in `rule_drafts`, which writes no history; a rule's chat lines are rows of
//   `rule_chat`. A rule's key stays rule/<number> at every verb.
function tableHas(name, column) {
  return db.prepare('PRAGMA table_info(' + name + ')').all().some(function (c) { return c.name === column; });
}
function tableExists(name) { return !!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name); }
// An old rules table (keyed by the string rule/<n>) is carried over once, its rows and drafts as they were.
if (tableExists('rules') && tableHas('rules', 'key')) {
  db.exec('BEGIN');
  db.exec('ALTER TABLE rules RENAME TO rules_old');
  db.exec('CREATE TABLE rules (n INTEGER PRIMARY KEY AUTOINCREMENT, rule INTEGER NOT NULL, at TEXT NOT NULL, by TEXT NOT NULL, type TEXT NOT NULL, label TEXT NOT NULL, status TEXT NOT NULL, text TEXT NOT NULL)');
  db.exec("INSERT INTO rules (n, rule, at, by, type, label, status, text) SELECT n, CAST(substr(key, 6) AS INTEGER), at, by, type, label, status, text FROM rules_old WHERE key LIKE 'rule/%'");
  db.exec('DROP TABLE rules_old');
  if (tableExists('rule_drafts') && tableHas('rule_drafts', 'key')) {
    db.exec('ALTER TABLE rule_drafts RENAME TO rule_drafts_old');
    db.exec('CREATE TABLE rule_drafts (rule INTEGER PRIMARY KEY, at TEXT NOT NULL, text TEXT NOT NULL)');
    db.exec("INSERT INTO rule_drafts (rule, at, text) SELECT CAST(substr(key, 6) AS INTEGER), at, text FROM rule_drafts_old WHERE key LIKE 'rule/%'");
    db.exec('DROP TABLE rule_drafts_old');
  }
  db.exec('COMMIT');
}
db.exec(
  'CREATE TABLE IF NOT EXISTS rules (n INTEGER PRIMARY KEY AUTOINCREMENT, rule INTEGER NOT NULL, at TEXT NOT NULL, by TEXT NOT NULL, type TEXT NOT NULL, label TEXT NOT NULL, status TEXT NOT NULL, text TEXT NOT NULL);' +
  'CREATE INDEX IF NOT EXISTS rules_rule ON rules (rule);' +
  'CREATE TABLE IF NOT EXISTS rule_drafts (rule INTEGER PRIMARY KEY, at TEXT NOT NULL, text TEXT NOT NULL);' +
  'CREATE TABLE IF NOT EXISTS rule_chat (rule INTEGER NOT NULL, seq INTEGER NOT NULL, at TEXT NOT NULL, by TEXT NOT NULL, creator TEXT NOT NULL, text TEXT NOT NULL, born INTEGER NOT NULL, PRIMARY KEY (rule, seq));' +
  'CREATE INDEX IF NOT EXISTS rule_chat_born ON rule_chat (born);' +
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
  'CREATE TABLE IF NOT EXISTS files (goal INTEGER NOT NULL, item INTEGER NOT NULL, holder TEXT NOT NULL, path TEXT NOT NULL, pos INTEGER NOT NULL, creator TEXT NOT NULL, core INTEGER NOT NULL, grant_status TEXT NOT NULL, change INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (goal, item, holder, path));' +
  'CREATE TABLE IF NOT EXISTS claims (goal INTEGER NOT NULL, item INTEGER NOT NULL, claimer TEXT NOT NULL, creator TEXT NOT NULL, at TEXT NOT NULL, change INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (goal, item, claimer));' +
  'CREATE TABLE IF NOT EXISTS suites (goal INTEGER NOT NULL, item INTEGER NOT NULL, path TEXT NOT NULL, pos INTEGER NOT NULL, creator TEXT NOT NULL, change INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (goal, item, path));' +
  "CREATE TABLE IF NOT EXISTS agents (agent TEXT PRIMARY KEY, label TEXT NOT NULL DEFAULT '', key TEXT NOT NULL DEFAULT '', at TEXT NOT NULL DEFAULT '', word TEXT NOT NULL DEFAULT ''," +
  " profile TEXT NOT NULL DEFAULT '');" +
  'CREATE TABLE IF NOT EXISTS desk_state (k TEXT PRIMARY KEY, v TEXT NOT NULL);'
);
// THE TEST TYPE AND autoAttach (goal/G40.12, box v7, first set 4): "the rules get a new \"test\" type. all rules get a
// field that indicates \"auto-attach-at-goal-creation-time\"". autoAttach is false until he sets it (Q1, Andy:
// "autoAttach is false by default.", "rule.version? carries the full rule.").
if (!tableHas('rules', 'autoAttach')) db.exec('ALTER TABLE rules ADD COLUMN autoAttach INTEGER NOT NULL DEFAULT 0');
const RULE_TYPES = ['ui', 'code', 'design', 'desk', 'test'];
const RULE_STATUSES = ['proposed', 'active', 'deleted'];
// A rule as the verbs answer it: key rule/<number>, as before goal/G33.4.
function ruleOut(r) { return r ? Object.assign({}, r, { key: 'rule/' + r.rule, autoAttach: r.autoAttach === 1 }) : r; }
function ruleNumber(key) { const m = /^rule\/(\d+)$/.exec(String(key)); return m ? Number(m[1]) : -1; }
const addRuleRowAt = db.prepare('INSERT INTO rules (rule, at, by, type, label, status, text, autoAttach) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
const addRuleRow = { run: function (key, at, by, type, label, status, text, autoAttach) { return addRuleRowAt.run(ruleNumber(key), at, by, type, label, status, text, autoAttach ? 1 : 0); } };
const ruleCount = db.prepare('SELECT COUNT(DISTINCT rule) AS c FROM rules');
const newestRuleRow = db.prepare('SELECT n, rule, at, by, type, label, status, text, autoAttach FROM rules WHERE rule = ? ORDER BY n DESC LIMIT 1');
const newestRulesRows = db.prepare('SELECT n, rule, at, by, type, label, status, text, autoAttach FROM rules WHERE n IN (SELECT MAX(n) FROM rules GROUP BY rule) ORDER BY n DESC');
const ruleRowsOf = db.prepare('SELECT n, rule, at, by, type, label, status, text, autoAttach FROM rules WHERE rule = ? ORDER BY n DESC');
const newestRule = { get: function (key) { return ruleOut(newestRuleRow.get(ruleNumber(key))); } };
const newestRules = { all: function () { return newestRulesRows.all().map(ruleOut); } };
const ruleRows = { all: function (key) { return ruleRowsOf.all(ruleNumber(key)).map(ruleOut); } };
const getDraftRow = db.prepare('SELECT text FROM rule_drafts WHERE rule = ?');
const putDraftRow = db.prepare('INSERT INTO rule_drafts (rule, at, text) VALUES (?, ?, ?) ON CONFLICT(rule) DO UPDATE SET at = excluded.at, text = excluded.text');
const getDraft = { get: function (key) { return getDraftRow.get(ruleNumber(key)); } };
const putDraft = { run: function (key, at, text) { return putDraftRow.run(ruleNumber(key), at, text); } };
const ruleChatOf = db.prepare('SELECT at, by, creator, text FROM rule_chat WHERE rule = ? ORDER BY seq');
const ruleChatNext = db.prepare('SELECT COALESCE(MAX(seq), -1) + 1 AS seq FROM rule_chat WHERE rule = ?');
const addRuleChat = db.prepare('INSERT INTO rule_chat (rule, seq, at, by, creator, text, born) VALUES (?, ?, ?, ?, ?, ?, ?)');

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

// An agent counts as live for ten minutes after its last write (Andy: "fine.").
const LIVE_MS = 10 * 60 * 1000;

// ── THE GROUP CHAT'S ANCHOR (goal/G3.10), GOAL 0 (goal/G33.4) ─────────
//
//   Andy, 2026-10-02: "This looks like a perfect team chat. Is it because it has a coal/item to anchor it?",
//   then "when deskServer Starts up, it makes sure there is a closed goal with the id 'desk/G0.0', instead of
//   the team-chat box, the 'all' tab displays the chat box for 'desk/G0.0'", and of its box: "the description
//   box for that chat are the 6 rules i stated a while back. the chat there may change those rules over time."
//   goal/G33.4, in the box: "Goal 0 is the group chat (desk/G0.0 today): chat that belongs to no other goal lives
//   there, so every chat line has a goal."
//
// A goal the server makes at its first start (startState), marked special: no session makes it current, it is closed,
// so it is on no List, offers no button and is not an open goal; and it stays closed. Its chat and box are an item's.
const GROUP_CHAT = 'goal/G0';

// ── THE MOUNTED PLUGINS, AND THE GOALS THEY GOVERN (goal/G22.3) ──────
//
//   Andy, 2026-10-13, in the item's box: "A gg plugin is a goal-governance plugin: for its type of goal it is the first
//   to handle every desk event, and the mechanical controls it implements live there, not in desk.js.", "desk scans its
//   plugin folder and mounts every plugin it finds", and "On its first mount the plugin gets its own private goal with a
//   fixed key, and from then on that goal and the plugin live hand in hand".
//   goal/G33.4, in the box: "Each special goal (each plugin goal such as Stacks, and the group chat) has a goal number of
//   its own, minted like any goal; its goal row marks it special." So the fixed key is the plugin's name on its goal's
//   row (plugin), and its id is goal/G<n> like any goal's.
//
// Filled by mountPlugins() before the desk serves, in mount order: { name, goal, refuses, handles, verbs }. A goal of a
// plugin is a pluggable goal/G0 (his words: "a special goal that is always open while actually closed"): the desk holds
// it like any goal, and its plugin decides what may happen to it.
const PLUGINS = [];
const PLUGIN_GOAL = Object.create(null);
// ITS TAB UNDER APPS (goal/G22.3). Andy, 2026-10-13, in the item's box: a main desk tab Apps whose inner tabs are the
// special goals, each plugin's private UI its inner tab. Named by the tab field of its .json, short (Stacks), else its
// label, else its name; keyed by its goal, as PLUGIN_GOAL is.
const PLUGIN_TAB = Object.create(null);
// Whether an id is a goal's or one of its items, by the id alone: an item's id is goal/G<n>.<m>.
function inGoalOf(goal, id) { const g = numbersOf(goal); const x = numbersOf(id); return !!g && !!x && g[0] === x[0]; }
// THE GOAL A PLUGIN'S NAME HAS, '' before its first mount.
function pluginGoalOf(s, name) { return Object.keys(s.goals).filter(function (gid) { return s.goals[gid].plugin === name; })[0] || ''; }

// ── S: THE STATE AS THE TABLES HOLD IT ────────────────────────────────
// agentWord: each agent's last word about itself, listening or working (goal/G2.3), one current value (goal/G33.4).
// agentKey: the key each agent last wrote with (goal/G2.2 note 6), so the goal row can name its live agents' keys.
function newState() {
  return { change: 0, goals: Object.create(null), items: Object.create(null), agentsAt: Object.create(null), agentWord: Object.create(null),
    agentKey: Object.create(null), profiles: Object.create(null), current: '', verifyAnswer: '', addGrant: 0, addGrantGoal: '', goalGrant: 0 };
}
let S = null;
function walkState() {
  // A BOX HOLD RUNS OUT (goal/G21.1): a hold his nick request or a cap take started is over after its minute, written
  // or not, so the box is anybody's again.
  const now = Date.now();
  Object.keys(S.items).forEach(function (id) {
    const it = S.items[id];
    if (it.boxHoldUntil && now >= it.boxHoldUntil) { it.boxTakenBy = ''; it.boxTakenKey = ''; it.boxHoldUntil = 0; }
  });
  return S;
}

// THE FIELDS OF AN ITEM THAT ARE ROWS OF THEIR OWN, never in its items row.
const SIDE_FIELDS = ['chat', 'checks', 'files', 'claims', 'suites', 'suitesKey', 'box', 'boxBy', 'boxKey', 'boxAt', 'boxHistory'];
const NULL_PROTO = ['claims', 'takers', 'checkHigh', 'files'];
function goalData(g) { const o = Object.assign({}, g); delete o.id; return o; }
// Who made it: the key it was written with, else the label (the desk's own rows: desk).
function madeBy(r) { return String((r && (r.key || r.by)) || 'desk'); }
// ONE GRANT FOR THE LIST (goal/G40.3). Andy, 2026-10-24: "i will get no single file grant checks anymore, just all
// in-one. and the grant request doesn't have to list them because i already have a visible list with the lock-icons
// next to them.... The grand will simply be for the current/updated list.", "the grant is not valid if core files are
// added after the grant is issued, if core files are added i must re-issue the grant for the whole list.", and "make
// sure that the grant lives until i click 'done'". So an item holds at most one live core grant, naming no path: open
// while it waits for his press, granted after it, for every core file on the list then. A core file added after it
// voids it (state voided, the record kept) and opens a fresh one; a non-core add, a remove and a phase change leave it.
// A list left with no core file drops an open one; a granted one stands.
const CORE_GRANT = 'core grant: every core file on this item\'s list';
function isCoreGrant(c) { return c.kind === 'G' && String(c.words).indexOf('core grant: ') === 0; }
function coreGrantAfter(it, r, added) {
  const hasCore = filesOf(it).some(function (e) { return e.core; });
  if (!hasCore) { it.checks = it.checks.filter(function (c) { return !(isCoreGrant(c) && c.state === 'open'); }); return; }
  const granted = it.checks.filter(function (c) { return isCoreGrant(c) && c.state === 'granted'; });
  if (granted.length) {
    if (!added || require('../../../spirit/coreFiles.js').isCore(added) !== true) return;
    granted.forEach(function (c) { c.state = 'voided'; c.at = r.at; });
  }
  if (it.checks.some(function (c) { return isCoreGrant(c) && c.state === 'open'; })) return;
  // A CORE GRANT NAMES WHO ASKED FOR IT (goal/G41.2). Andy, in the item's box: "file-core grants reference the agent who
  // requests them, when granted, the agent must be woken to notice". The agent whose list brought the core file is its
  // placer, as a red Q's is, so its deskClient knows the grant is its own.
  const asker = r.by && r.by !== 'andy' && r.by !== 'desk' ? { placedBy: String(r.by), placedKey: String(r.key || '') } : {};
  it.checks.push(Object.assign({ number: nextCheckNumber(it, 'G'), kind: 'G', words: CORE_GRANT, test: '', state: 'open', by: 'desk', at: r.at, made: 'desk' }, asker));
}
function grantOf(it, p, core) {
  if (!core) return 'none';
  const cg = it.checks.filter(isCoreGrant);
  if (cg.some(function (c) { return c.state === 'open'; })) return 'open';
  if (cg.some(function (c) { return c.state === 'granted'; })) return 'granted';
  return 'owed';
}
// A chat line's JSON, kept per line while the fields a line can change after it is written (its take, its answer, its
// Q mark) stay as they were: an item's whole chat is compared at each write, and its lines are rarely changed.
const LINE_JSON = new WeakMap();
function lineJson(l) {
  const sig = String(l.taken) + '|' + String(l.takenKey) + '|' + String(l.answered) + '|' + String(l.q);
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
    out.push({ key: 'chat|' + i, table: 'chat', id: i, cols: [i, String(l.at || ''), String(l.key || l.by || 'desk'), lineJson(l)], out: function () { return shownLine(s, l); },
      to: Array.isArray(l.to) ? l.to.slice() : null });
  });
  if (it.version > 0) out.push({ key: 'box', table: 'box', cols: [it.version, String(it.boxKey || it.boxBy || 'desk'), String(it.boxAt || ''), String(it.box)],
    out: function () { return { version: it.version, text: String(it.box), by: String(it.boxBy || ''), at: String(it.boxAt || '') }; } });
  it.checks.forEach(function (c, i) {
    out.push({ key: 'checks|' + c.number, table: 'checks', id: c.number, cols: [c.number, i, String(c.made || c.placedKey || c.placedBy || c.by || 'desk'), JSON.stringify(c)], out: function () { return c; } });
  });
  const core = require('../../../spirit/coreFiles.js');
  Object.keys(it.files || {}).forEach(function (holder) {
    (Array.isArray(it.files[holder]) ? it.files[holder] : []).forEach(function (p, i) {
      const isCore = core.isCore(String(p)) === true;
      const grant = grantOf(it, String(p), isCore);
      out.push({ key: 'files|' + holder + '|' + p, table: 'files', id: [holder, String(p)], cols: [holder, String(p), i, String(s.agentKey[holder] || holder), isCore ? 1 : 0, grant],
        out: function () { const o = { path: String(p), by: holder, core: isCore, grant: grant }; if (isLate(it, holder, p)) o.late = true; return o; } });
    });
  });
  Object.keys(it.claims || {}).forEach(function (label) {
    const at = String((it.claimAt && it.claimAt[label]) || it.at || '');
    out.push({ key: 'claims|' + label, table: 'claims', id: label, cols: [label, String(s.agentKey[label] || label), at], out: function () { return { by: label, at: at }; } });
  });
  (Array.isArray(it.suites) ? it.suites : []).forEach(function (p, i) {
    out.push({ key: 'suites|' + p, table: 'suites', id: String(p), cols: [String(p), i, String(it.suitesKey || 'desk')], out: function () { return { path: String(p) }; } });
  });
  return out;
}
const UPSERT = {
  items: db.prepare('INSERT INTO items (goal, item, creator, special, at, data, change) VALUES (?, ?, ?, ?, ?, ?, ?)' +
    ' ON CONFLICT(goal, item) DO UPDATE SET creator = excluded.creator, special = excluded.special, at = excluded.at, data = excluded.data, change = excluded.change'),
  chat: db.prepare('INSERT INTO chat (goal, item, seq, at, creator, data, change, born) VALUES (?, ?, ?, ?, ?, ?, ?, ?)' +
    ' ON CONFLICT(goal, item, seq) DO UPDATE SET at = excluded.at, creator = excluded.creator, data = excluded.data, change = excluded.change'),
  box: db.prepare('INSERT OR REPLACE INTO box (goal, item, version, creator, at, text) VALUES (?, ?, ?, ?, ?, ?)'),
  checks: db.prepare('INSERT INTO checks (goal, item, number, pos, creator, data, change) VALUES (?, ?, ?, ?, ?, ?, ?)' +
    ' ON CONFLICT(goal, item, number) DO UPDATE SET pos = excluded.pos, creator = excluded.creator, data = excluded.data, change = excluded.change'),
  files: db.prepare('INSERT INTO files (goal, item, holder, path, pos, creator, core, grant_status, change) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)' +
    ' ON CONFLICT(goal, item, holder, path) DO UPDATE SET pos = excluded.pos, creator = excluded.creator, core = excluded.core, grant_status = excluded.grant_status, change = excluded.change'),
  claims: db.prepare('INSERT INTO claims (goal, item, claimer, creator, at, change) VALUES (?, ?, ?, ?, ?, ?)' +
    ' ON CONFLICT(goal, item, claimer) DO UPDATE SET creator = excluded.creator, at = excluded.at, change = excluded.change'),
  suites: db.prepare('INSERT INTO suites (goal, item, path, pos, creator, change) VALUES (?, ?, ?, ?, ?, ?)' +
    ' ON CONFLICT(goal, item, path) DO UPDATE SET pos = excluded.pos, creator = excluded.creator, change = excluded.change'),
};
const DELETE = {
  items: db.prepare('DELETE FROM items WHERE goal = ? AND item = ?'),
  chat: db.prepare('DELETE FROM chat WHERE goal = ? AND item = ? AND seq = ?'),
  box: db.prepare('DELETE FROM box WHERE goal = ? AND item = ?'),
  checks: db.prepare('DELETE FROM checks WHERE goal = ? AND item = ? AND number = ?'),
  files: db.prepare('DELETE FROM files WHERE goal = ? AND item = ? AND holder = ? AND path = ?'),
  claims: db.prepare('DELETE FROM claims WHERE goal = ? AND item = ? AND claimer = ?'),
  suites: db.prepare('DELETE FROM suites WHERE goal = ? AND item = ? AND path = ?'),
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
  else if (x.table === 'box') UPSERT.box.run(k[0], k[1], c[0], c[1], c[2], c[3]);
  else if (x.table === 'checks') UPSERT.checks.run(k[0], k[1], c[0], c[1], c[2], c[3], r.n);
  else if (x.table === 'files') UPSERT.files.run(k[0], k[1], c[0], c[1], c[2], c[3], c[4], c[5], r.n);
  else if (x.table === 'claims') UPSERT.claims.run(k[0], k[1], c[0], c[1], c[2], r.n);
  else if (x.table === 'suites') UPSERT.suites.run(k[0], k[1], c[0], c[1], c[2], r.n);
}
function deleteRow(k, key) {
  const parts = key.split('|');
  const table = parts[0];
  if (table === 'items') DELETE.items.run(k[0], k[1]);
  else if (table === 'chat') DELETE.chat.run(k[0], k[1], Number(parts[1]));
  else if (table === 'box') { /* a box's versions go only with its item */ }
  else if (table === 'checks') DELETE.checks.run(k[0], k[1], parts.slice(1).join('|'));
  else if (table === 'files') DELETE.files.run(k[0], k[1], parts[1], parts.slice(2).join('|'));
  else if (table === 'claims') DELETE.claims.run(k[0], k[1], parts.slice(1).join('|'));
  else if (table === 'suites') DELETE.suites.run(k[0], k[1], parts.slice(1).join('|'));
}
// One item written through: every row of it that changed is written, every row it no longer has deleted. Answers what
// changed, as { table, key, x (the row), removed } in row order. written: the item the write named, whose row always
// takes the write's verb and writer, and, for a write of his that is no chat line, the record `changes` hands on.
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
  ['items', 'chat', 'box', 'checks', 'files', 'claims', 'suites'].forEach(function (t) { db.prepare('DELETE FROM ' + t + ' WHERE goal = ?').run(n); });
}

// THE AGENTS, BY KEY (goal/G33.4: "What is about an agent (its profile, signed off) is keyed by the agent"): one row
// each, its label, its last write, its one current word, and his profile of it. A label written before keys is its own
// agent.
const putAgent = db.prepare('INSERT INTO agents (agent, label, key, at, word) VALUES (?, ?, ?, ?, ?) ON CONFLICT(agent) DO UPDATE SET label = excluded.label, key = excluded.key, at = excluded.at, word = excluded.word');
const putProfile = db.prepare('INSERT INTO agents (agent, profile) VALUES (?, ?) ON CONFLICT(agent) DO UPDATE SET profile = excluded.profile');
function persistAgent(s, label) {
  if (!label || label === 'andy' || label === 'desk') return;
  const key = String(s.agentKey[label] || '');
  putAgent.run(key || label, label, key, String(s.agentsAt[label] || ''), String(s.agentWord[label] || ''));
}
function persistProfile(s, key) {
  const p = s.profiles[key];
  putProfile.run(key, p ? JSON.stringify(p) : '');
}
const putDeskState = db.prepare('INSERT INTO desk_state (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v');
const DESK_STATE_KEYS = ['change', 'current', 'verifyAnswer', 'addGrant', 'addGrantGoal', 'goalGrant'];
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
    it.files = Object.create(null); it.claims = Object.create(null); it.chat = []; it.checks = []; it.box = ''; it.version = 0; it.suites = [];
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
  for (const row of db.prepare('SELECT goal, item, holder, path FROM files ORDER BY goal, item, holder, pos').iterate()) {
    const it = at(row.goal, row.item);
    if (it) (it.files[row.holder] = it.files[row.holder] || []).push(row.path);
  }
  for (const row of db.prepare('SELECT goal, item, path, creator FROM suites ORDER BY goal, item, pos').iterate()) {
    const it = at(row.goal, row.item);
    if (it) { it.suites.push(row.path); it.suitesKey = row.creator; }
  }
  for (const row of db.prepare('SELECT goal, item, claimer, at FROM claims').iterate()) {
    const it = at(row.goal, row.item);
    if (it) { it.claims[row.claimer] = true; (it.claimAt = it.claimAt || {})[row.claimer] = row.at; }
  }
  for (const row of db.prepare('SELECT b.goal, b.item, b.version, b.creator, b.at, b.text FROM box b WHERE b.version = (SELECT MAX(version) FROM box WHERE goal = b.goal AND item = b.item)').iterate()) {
    const it = at(row.goal, row.item);
    if (it) { it.box = row.text; it.version = row.version; it.boxKey = row.creator; it.boxAt = row.at; it.boxBy = String(it.boxBy || ''); }
  }
  for (const row of db.prepare('SELECT agent, label, key, at, word, profile FROM agents').iterate()) {
    if (row.label) {
      if (row.key) s.agentKey[row.label] = row.key;
      if (row.at) s.agentsAt[row.label] = row.at;
      if (row.word) s.agentWord[row.label] = row.word;
    }
    if (row.profile) { try { s.profiles[row.agent] = JSON.parse(row.profile); } catch (e) { /* no profile */ } }
  }
  ROWS.clear();
  Object.keys(s.items).forEach(function (id) {
    const m = new Map();
    rowsOf(s, s.items[id]).forEach(function (x) { m.set(x.key, rowSig(x)); });
    ROWS.set(id, m);
  });
  return s;
}

// ── THE MIGRATION, ONCE (goal/G33.4) ──────────────────────────────────
//
//   Andy, in the item's box: "Migration: today's database is migrated into the tables once; each id string becomes its
//   two numbers (goal/G33.4 becomes 33 and 4).", and "Records with no goal or item are dumped at migration: agent.state,
//   scope.set and the old lines table."
//
// The old `records` are walked once, in order, by the same apply every write uses, and what they come to is written into
// the tables; then records and lines are dropped and the file compacted. goal/G<n> keeps n, desk/G0.0 becomes goal 0,
// and every goal of another area (desk/, apiAuth/, plugin/) gets the next free number, its items keeping theirs. Only
// the newest box version is kept. A rule's chat lines (rule.chat records) become rows of rule_chat.
const OLD_GROUP_CHAT = 'desk/G0.0';
function migrate() {
  if (!tableExists('records')) return false;
  const t0 = Date.now();
  const s = newState();
  s.goals[OLD_GROUP_CHAT] = { id: OLD_GROUP_CHAT, design: false, abandoned: false, members: [], special: true };
  s.items[OLD_GROUP_CHAT] = blank(OLD_GROUP_CHAT, 'Group chat', '');
  s.items[OLD_GROUP_CHAT].closed = true;
  const item = function (id) { return s.items[id] || null; };
  const goalOf = function (id) { const it = item(id); return it ? (it.goal ? s.goals[it.id] : s.goals[it.goalId]) : null; };
  const hasKey = tableHas('records', 'key');
  const ruleChat = [];
  let count = 0;
  for (const r of db.prepare('SELECT n, at, verb, by, ' + (hasKey ? 'key' : "'' AS key") + ', body FROM records ORDER BY n').iterate()) {
    s.change = r.n;
    count += 1;
    let b = {};
    try { b = JSON.parse(r.body); } catch (e) { continue; }
    // DUMPED: an agent's word and a scope are about no goal or item.
    if (r.verb === 'agent.state' || r.verb === 'scope.set') continue;
    if (r.verb === 'rule.chat') { ruleChat.push({ rule: ruleNumber(b.rule), at: r.at, by: r.by, creator: madeBy(r), text: String(b.text || '') }); continue; }
    // Writers other than him and the desk itself are agents, and a write is their liveness.
    if (r.by !== 'andy' && r.by !== 'desk') { s.agentsAt[r.by] = r.at; if (r.key) s.agentKey[r.by] = String(r.key); }
    try { apply(s, r, b, item, goalOf); } catch (e) { /* a record that no longer fits changes nothing */ }
  }
  // DESIGN ON ITEM LEVEL IS NEW (goal/G33.4): an item from before it is governed by its goal's design mode alone.
  Object.keys(s.items).forEach(function (id) { s.items[id].design = false; });
  // THE NEW IDS.
  const map = Object.create(null);
  let top = 0;
  Object.keys(s.goals).forEach(function (gid) { const m = /^goal\/G(\d+)$/.exec(gid); if (m) top = Math.max(top, Number(m[1])); });
  Object.keys(s.goals).forEach(function (gid) {
    if (gid === OLD_GROUP_CHAT) map[gid] = GROUP_CHAT;
    else if (/^goal\/G\d+$/.test(gid)) map[gid] = gid;
    else map[gid] = idOf(++top, 0);
    const p = /^plugin\/(.+)$/.exec(gid);
    if (p) { s.goals[gid].plugin = p[1]; s.goals[gid].special = true; }
  });
  Object.keys(s.goals).forEach(function (gid) {
    const ng = numbersOf(map[gid])[0];
    let itop = 0;
    const tails = [];
    s.goals[gid].members.forEach(function (id) {
      const tail = id.indexOf(gid + '.') === 0 ? id.slice(gid.length + 1) : '';
      if (/^\d+$/.test(tail)) { itop = Math.max(itop, Number(tail)); tails.push([id, Number(tail)]); } else tails.push([id, -1]);
    });
    tails.forEach(function (x) { map[x[0]] = idOf(ng, x[1] > 0 ? x[1] : ++itop); });
  });
  const re = function (id) { return map[id] || id; };
  const items = Object.create(null);
  const goals = Object.create(null);
  Object.keys(s.goals).forEach(function (gid) {
    const g = s.goals[gid];
    goals[re(gid)] = Object.assign({}, g, { id: re(gid), members: g.members.map(re) });
  });
  Object.keys(s.items).forEach(function (id) {
    const it = s.items[id];
    if (!map[id]) return;   // an item of no goal the desk held: nothing reaches it
    it.id = re(id);
    it.goalId = it.goalId ? re(it.goalId) : '';
    it.blocks = (it.blocks || []).map(re);
    items[it.id] = it;
  });
  s.goals = goals;
  s.items = items;
  s.current = s.current ? re(s.current) : '';
  s.addGrantGoal = s.addGrantGoal ? re(s.addGrantGoal) : '';
  s.agentWord = Object.create(null);
  // WRITTEN ONCE, in one transaction, then the old tables go.
  const r = { n: s.change, at: new Date().toISOString(), verb: 'migrate', by: 'desk', key: '' };
  db.exec('BEGIN');
  try {
    ROWS.clear();
    Object.keys(s.items).forEach(function (id) { persistItem(s, s.items[id], r, false); });
    Object.keys(s.agentsAt).concat(Object.keys(s.agentKey)).forEach(function (l) { persistAgent(s, l); });
    Object.keys(s.profiles).forEach(function (k) { persistProfile(s, k); });
    persistDeskState(s);
    const seqs = Object.create(null);
    ruleChat.forEach(function (c) {
      if (c.rule < 0) return;
      seqs[c.rule] = seqs[c.rule] === undefined ? Number(ruleChatNext.get(c.rule).seq) : seqs[c.rule] + 1;
      addRuleChat.run(c.rule, seqs[c.rule], c.at, c.by, c.creator, c.text, s.change);
    });
    db.exec('DROP TABLE records');
    if (tableExists('lines')) db.exec('DROP TABLE lines');
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  try { db.exec('VACUUM'); } catch (e) { console.error('desk: the migrated file was not compacted: ' + e.message); }
  console.log('desk: migrated ' + count + ' records into ' + Object.keys(s.items).length + ' items in ' + (Date.now() - t0) + ' ms (goal/G33.4)');
  return true;
}
// THE OLD LINES TABLE ALONE (a file that never held records) goes too.
if (!tableExists('records') && tableExists('lines')) db.exec('DROP TABLE lines');

// AT START: the migration if an old file is here, the state read, and the group chat made on a fresh desk.
function startState() {
  migrate();
  S = loadState();
  suitesFromFiles();
  if (!S.goals[GROUP_CHAT]) {
    S.goals[GROUP_CHAT] = { id: GROUP_CHAT, design: false, abandoned: false, members: [], special: true };
    S.items[GROUP_CHAT] = blank(GROUP_CHAT, 'Group chat', '');
    S.items[GROUP_CHAT].closed = true;
    db.exec('BEGIN');
    persistItem(S, S.items[GROUP_CHAT], { n: S.change, at: new Date().toISOString(), verb: 'start', by: 'desk', key: '' }, false);
    persistDeskState(S);
    db.exec('COMMIT');
  }
}

// THE SUITES TABLE'S MIGRATION (goal/G33.4, box v44-45: "existing items get their suites from today's file list"):
// once, on the first start that has the table, every item with none gets the spirit/test/ entries of its file list.
// From then on only a red claim supplies them; the file list never does.
function suitesFromFiles() {
  if (db.prepare("SELECT v FROM desk_state WHERE k = 'suitesMigrated'").get()) return;
  db.exec('BEGIN');
  const r = { n: S.change, at: new Date().toISOString(), verb: 'migrate', by: 'desk', key: '' };
  Object.keys(S.items).forEach(function (id) {
    const it = S.items[id];
    if (it.goal || (Array.isArray(it.suites) && it.suites.length)) return;
    const tests = testFilesOf(it);
    if (!tests.length) return;
    it.suites = tests;
    it.suitesKey = 'desk';
    persistItem(S, it, r, false);
  });
  putDeskState.run('suitesMigrated', JSON.stringify(true));
  db.exec('COMMIT');
}

// ── SHEDDING (goal/G33.4) ─────────────────────────────────────────────
//
//   Andy, in the item's box: "The desk database sheds by itself past a boundary size, one constant set in a single place,
//   16 MB. It sheds in whole goal chunks: first the goal untouched the longest, with all its items and every row of
//   theirs (file, chat, box, checks, claims), since nothing could reach them any more; then the next. The current goal
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
    const open = Object.keys(s.goals).filter(function (gid) { return gid !== s.current && !s.goals[gid].special && !PLUGIN_GOAL[gid] && gid !== GROUP_CHAT; });
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
// HIS "ALL" (goal/G33.2, box v5-6, approved by Andy): "all" as the address at the start of his line wakes every agent:
// it is addressed to every agent the desk knows and that is included, with no take, and "entitles them to a response":
// each may answer it under the item (chat.add below).
// HIS ANSWER TO A RED Q GOES TO ITS PLACER (goal/G41.2). Andy, in the item's box: "the desk allows each agent one red Q
// at the time, per item. when the user's chat time starts with Q<number> the desk must direct that line to the agent who
// posted the Q". A line starting Q<n>: on an item holding that Q is addressed to the key that placed it.
// AN ADDRESS ONLY WITH PUNCTUATION AFTER IT (goal/G41.11). Andy: "an address is an agents nick, or all followed by any
// punctuation ... so that a wake up is no accident". So "all" and a nick count only when punctuation (or a symbol)
// follows at once: "wsl, look" and "all: ..." are addressed, "wsl is here" and "all agents seem busy" are not. The
// space that goal/G21.1 allowed after a nick went with this ruling; do not bring it back.
function addressOf(s, text, it) {
  const t = String(text);
  const q = /^\s*(Q\d+)\s*:/i.exec(t);
  const asked = q && it ? (it.checks || []).filter(function (c) { return c.kind === 'Q' && String(c.number).toUpperCase() === q[1].toUpperCase(); })[0] : null;
  const placer = asked ? placerOf(s, asked) : '';
  if (placer) return { to: [placer], q: asked.number };
  if (/^\s*all(?=[\p{P}\p{S}])/iu.test(t)) {
    const known = Object.keys(s.agentKey).map(function (l) { return s.agentKey[l]; }).concat(Object.keys(s.profiles));
    return { to: known.filter(function (k, i) { return k && known.indexOf(k) === i && profileOf(s, k).included; }), all: true };
  }
  const m = /^\s*([a-z0-9]{1,8})(?=[\p{P}\p{S}])/iu.exec(t);
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
    box: '', version: 0, checks: [], chat: [], at: '', checked: false,
    // FILES TOUCHED, PER ITEM (goal/G8.8). Andy, 2026-10-09: "the list should be owned by the item. so updates to it
    // are available to all participants." Each writer's own paths, by its name, so one agent's list never touches
    // another's: { '<agent>': ['<path>', ...] }.
    files: Object.create(null),
    // goal/G33.4 (box v44-45): the suites a Verify of it runs, as its red claim supplied them, and the claimer's key.
    suites: [], suitesKey: '' };
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
      if (!goalItem.made) goalItem.made = madeBy(r);
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
        // A NEW ITEM ARRIVES IN DESIGN MODE (goal/G33.4, the box: "A new item always arrives in design mode.").
        if (!s.items[id]) { s.items[id] = blank(id, '', gid); s.items[id].design = true; s.items[id].made = madeBy(r); }
        const one = s.items[id];
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
        if (x.code === true) one.code = true;
        ids.push(id);
      });
      // LEFT OUT IS CLOSED, NEVER DELETED (goal/G4.24). Andy: "1. sounds dumb that the \"archive\" is not
      // searchable.", "if deleted is just a flag in the database, we can just ignore it from now on". An item a new
      // session leaves out stays a member, after the session's own, closed, with its box, checks and chat, so
      // [Include Closed] finds it; the records replay to the same, so items left out before this come back too.
      // It blocks nothing any more (blockers skips it), as it blocked nothing while it was deleted.
      // NO SUB-GOALS (goal/G33.4, replacing goal/G6.8's split mark). Andy, in the item's box: "No sub-goals and no goal
      // tree: an item never becomes a goal, so two numbers always suffice; the sub-goal mechanism is removed." A split
      // adds its blocking relation (above) and marks nothing.
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
      // THE TAKER'S WRITE FREES THE BOX (goal/G4.20 point 9), by key since goal/G21.1: that is the one write of a hold.
      if (it.boxTakenBy && holdsBox(it, { by: r.by, key: String(r.key || '') })) { it.boxTakenBy = ''; it.boxTakenKey = ''; it.boxHoldUntil = 0; }
      // A written box ends a cap still offered (goal/G21.1): the cap was for this text. goal/G41.11: unless the write
      // left it red, when the desk offers the cap anew (box.write's capOffer).
      it.capOffer = Array.isArray(b.capOffer) ? b.capOffer.map(String) : null;
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
      const line = { by: r.by, at: r.at, text: String(b.text), taken: '', key: String(r.key || '') };
      it.chat.push(line);
      // A LINE FROM THE PHASE HOLDER MARKS THE ITEM (goal/G33.2). Andy: "make an item go red in the list when the phase
      // holder posts a report or questions ..., so that my attention is caught", and "red until i open it": alert is
      // the mark his List draws red and his opening the item (press seen) clears.
      if (it.phaseWith && r.by === it.phaseWith && r.by !== 'andy') it.alert = true;
      // HIS NEWEST LINE GRANTS ITEM ADDS, OR ENDS THE GRANT (goal/G29.21).
      // The item grant holds only for the goal his line is in: under the goal itself or one of its items.
      if (r.by === 'andy') { s.addGrant = addGrantOf(b.text); s.addGrantGoal = it.goal ? it.id : it.goalId; s.goalGrant = goalGrantOf(b.text); }
      if (r.by === 'andy' && Array.isArray(b.to)) {
        // THE BINDING NICK (goal/G21.1): addressed at the write (addressOf), replayed from the record.
        line.to = b.to.map(String);
        // goal/G33.2 (box v5-6): his "all" line, each addressee entitled to answer it.
        if (b.all === true) line.all = true;
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
      } else if (r.by === 'desk' && Array.isArray(b.to)) {
        // THE DESK'S AUTO-CAP LINE (goal/G41.11): addressed as his cap line is, its to the keys the cap is offered to,
        // so each of them is woken and only they hear it.
        line.to = b.to.map(String);
        if (b.cap === true) it.capOffer = line.to.slice();
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
    // A FILE THE AGENT'S CHECKOUT CHANGED (goal/G33.11): a word that is a path is kept as its file name only, and its
    // tone (test or code) holds while the status is still that word; any other write of the status drops it.
    case 'item.status': {
      const word = String(b.word);
      it.status = /[\\/]/.test(word) ? word.split(/[\\/]/).pop() : word;
      it.statusTone = b.tone === 'test' || b.tone === 'code' ? b.tone : '';
      it.toneWord = it.status;
      return;
    }
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
      // A FAILED VERIFY IS A STATUS, NOT A CHAT LINE (goal/G33.11; Andy: "no auto-chat-lines from deskVerify, only
      // status updates.").
      if (b.phase === 'verify' && b.pass !== true) it.status = 'verify failed';
      return;
    // THE VERIFIER'S ANSWER TO A START REQUEST (goal/G33.3): the one switch, verify-busy, shows it (taken or busy) and
    // holds nothing back; a taken run is that item's verify under way, so it is not handed over again.
    case 'verify.answer':
      s.verifyAnswer = b.taken === true ? 'taken' : 'busy';
      if (it && b.taken === true && !it.done && !it.closed) { it.verifyRunning = true; if (it.status === 'waiting for deskVerify') it.status = 'handed to deskVerify'; }
      // ANY RUN HIS VERIFY STARTED IS READ BACK (goal/G33.4, Andy's word): the item is marked handed until a read sees the
      // run end, waiting for verification or not.
      if (it && b.taken === true) it.verifyHanded = true;
      return;
    // WHAT THE VERIFIER'S SEARCH SAYS OF ITS SUITES (goal/G33.3), read by the desk at each event: green, red with the
    // failure lines, or none (no run yet). The item's facts carry it, and Done's warning mark is drawn from it.
    case 'verify.state':
      if (!it) return;
      it.verifyState = String(b.verified || 'none');
      it.verifyFailures = Array.isArray(b.failures) ? b.failures.map(String) : [];
      it.verifyFailuresMore = b.failuresMore === true;
      // goal/G33.7 (box v10): how many suites the run ended red, the "red: N suites" the row and the dialog show.
      it.verifyRed = Number(b.redSuites) || 0;
      if (b.ended === true || (b.ended === undefined && it.verifyState !== 'none')) { it.verifyRunning = false; it.verifyHanded = false; }
      if (b.ran === true && !it.done && !it.closed && (it.status === 'waiting for deskVerify' || it.status === 'handed to deskVerify' || /^verified /.test(it.status))) {
        it.status = it.verifyState === 'green' ? 'verified green' : it.verifyState === 'red' ? 'verified red' : it.status;
      }
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
    // THE GOAL IS EMPTY (goal/G8.12): written once per emptying, by the press that empties it. Since goal/G33.3 no run
    // starts from it: the goal's run is his Verify on the goal.
    case 'goal.emptied': {
      const g = s.goals[String(b.id)];
      if (g) g.emptied = true;
      return;
    }
    // verify.pass, verify.reject, verify.regress and verify.again WENT WITH goal/G33.3 as verbs (Andy's yes, "box this
    // and continue"). Their records already written are replayed here as they were, so no stored item changes; nothing
    // writes new ones.
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
      // A PLUGIN'S GOAL IS SPECIAL (goal/G33.4): its row names the plugin and is marked special; it is always open.
      if (b.plugin) { s.goals[gid].plugin = String(b.plugin); s.goals[gid].special = true; s.goals[gid].design = false; }
      const gi = s.items[gid] || (s.items[gid] = blank(gid, '', ''));
      if (!gi.made) gi.made = madeBy(r);
      gi.title = String(b.title || gi.title);
      gi.at = r.at;
      // THE RULES IT WAS BORN WITH (goal/G40.12): every active autoAttach rule at its creation, by key, in the record, so
      // a replay attaches the same.
      if (Array.isArray(b.rules) && !Array.isArray(gi.attached)) gi.attached = b.rules.map(String);
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
      // A plain add blocks its goal, as a session's item with no blocks does; with `blocks` named (goal/G9.10) it
      // blocks that item alone.
      one.blocks = [String(b.blocks || gid)];
      one.at = r.at;
      // WHO CREATED IT (goal/G27.10, R2): its creator posts under it at any time; the first add names it.
      if (!one.creator) { one.creator = r.by; one.creatorKey = String(r.key || ''); }
      if (g.members.indexOf(id) === -1) g.members.push(id);
      // goal/G29.21: code from the record (the handler decided it); an agent's add spends one of an "add item" grant.
      if (b.code === true) one.code = true;
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
    // FILES TOUCHED, ONE ROW A WRITE (goal/G40.3; goal/G8.8 for the list itself). Andy, 2026-10-24: "items are added
    // one-by one, and desk streams those items to its clients", and "same set of verbs for all sub-item-tables add,
    // remove, search." An add puts one path on the writer's own list and a remove takes one away, each one row on the
    // stream; no write carries a list, so none can outgrow a request. (The whole-list write of goal/G8.8 stood here: it
    // replaced the writer's list, and a late file added alone once dropped a listed red.)
    case 'item.files.add': {
      if (!it) return;
      if (!it.files) it.files = Object.create(null);
      const mine = (it.files[r.by] = it.files[r.by] || []);
      // A LIST IN ONE WRITE (goal/G41.11, for the desk only): paths, already cut at one payload by the verb; or one path.
      const adds = (Array.isArray(b.paths) ? b.paths : [b.path]).map(String);
      adds.forEach(function (p) {
        if (mine.indexOf(p) === -1) mine.push(p);
        // A FILE ADDED AFTER HIS GO IS MARKED LATE (goal/G41.11): allowed, and the item says so, as holder|path.
        if (it.go === true) { if (!Array.isArray(it.lateFiles)) it.lateFiles = []; if (it.lateFiles.indexOf(r.by + '|' + p) === -1) it.lateFiles.push(r.by + '|' + p); }
      });
      adds.forEach(function (p) { coreGrantAfter(it, r, p); });
      // goal/G40.13: the file's own product test joins the suites, and a shell file's ui rules join the attached.
      (Array.isArray(b.tests) ? b.tests : b.test ? [b.test] : []).forEach(function (t) {
        if (!Array.isArray(it.suites)) it.suites = [];
        if (it.suites.indexOf(String(t)) === -1) it.suites.push(String(t));
      });
      if (Array.isArray(b.uiRules)) {
        if (!Array.isArray(it.attached)) it.attached = [];
        b.uiRules.forEach(function (k) { if (it.attached.indexOf(String(k)) === -1) it.attached.push(String(k)); });
      }
      return;
    }
    case 'item.files.remove': {
      if (!it || !it.files || !Array.isArray(it.files[r.by])) return;
      it.files[r.by] = it.files[r.by].filter(function (p) { return p !== String(b.path); });
      if (!it.files[r.by].length) delete it.files[r.by];
      if (Array.isArray(it.lateFiles)) it.lateFiles = it.lateFiles.filter(function (k) { return k !== r.by + '|' + String(b.path); });
      coreGrantAfter(it, r, '');
      return;
    }
    // THE SUITES, ONE ROW A WRITE (goal/G40.3): the red writer adds or removes one suite, each streamed; the red claim
    // carries none of its own (Andy: "a red claim will fail if no suite-rows are registered with an item.").
    case 'item.suites.add':
      if (!it) return;
      if (!Array.isArray(it.suites)) it.suites = [];
      if (it.suites.indexOf(String(b.path)) === -1) it.suites.push(String(b.path));
      it.suitesKey = String(r.key || r.by || 'desk');
      return;
    // THE ATTACHED RULES, ONE ROW A WRITE (goal/G40.12, second set 1-3): a goal or an item keeps a list of rule keys;
    // item.rules.add puts one on, item.rules.remove takes it off.
    case 'item.rules.add':
      if (!it) return;
      if (!Array.isArray(it.attached)) it.attached = [];
      if (it.attached.indexOf(String(b.rule)) === -1) it.attached.push(String(b.rule));
      return;
    case 'item.rules.remove':
      if (!it || !Array.isArray(it.attached)) return;
      it.attached = it.attached.filter(function (k) { return k !== String(b.rule); });
      return;
    case 'item.suites.remove':
      if (!it || !Array.isArray(it.suites)) return;
      it.suites = it.suites.filter(function (p) { return p !== String(b.path); });
      return;
    case 'press': press(s, it, String(b.what), r, goalOf, b); return;
    // A CLAIM CARRIES ITS COMMIT (goal/G19.13). Andy, 2026-10-12: "these push things, when you report a claim on code,
    // it should be accompanied by the commit id, that way desk verify won't check something that hasn't arrived yet...
    // ?", and to one verb carrying both: "better. that closes the door on half-ass claims." A build claim IS the
    // claim-done, applied by the same press() so the two can never drift, and the item keeps the commit it was claimed
    // at; a red claim changes nothing but the commit kept ("they should be red. at the time"). The refusals are at the
    // verb, so a replay only records.
    case 'seen.set': if (it) it.seenAt = String(b.at || ''); return;
    case 'claim':
      if (!it) return;
      if (String(b.phase) === 'build') { press(s, it, 'claim-done', r, goalOf, b); it.claimCommit = String(b.commit || ''); }
      // A red claim keeps its commit; its suites are the item's suite rows, added one a write (goal/G40.3).
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
  // give me re-open and and on any open goal i want a button \"make current goal\"". Until now the current goal moved
  // for one reason only, a session.set, so switching meant an agent writing a session for him. It moves the goal and
  // nothing else: no item's state, neither goal's design mode, nothing closed or opened.
  else if (what === 'make-current' && it.goal) s.current = it.id;
  // HIS CODE TOGGLE (goal/G9.5). Andy, 2026-10-07: "the item Detail dialog has a check/toggle button, [Code✓], in it's
  // button bar, where the user can set the Code-state of an item". Never on a goal; the handler refuses it, and this
  // holds it too.
  // CODE MARKED AFTER HIS GO (goal/G8.10). His Go starts the red phase only on an item that is already a coding item,
  // so an item marked as code afterwards sat with no phase at all: nobody could take it, no Done was offered, and no
  // Close either (Close is offered before a Go alone), which held its goal's Done as well. Andy, 2026-10-09, "go" to
  // this line: marking the item starts its red, exactly as his Go would have.
  else if (what === 'code' && !it.goal) {
    it.code = !it.code;
    if (it.code && it.go && !it.phase) it.phase = 'red';
  }
  else if (what === 'design-complete') { it.designComplete = true; it.status = 'ready'; }
  // HIS GO IS ON RECORD (goal/G3.9): `go` is set by his go and go-all alone and by nothing else; `went` stays the
  // state of the item, which older records set in other ways.
  else if (what === 'go') { it.went = true; it.go = true; it.status = 'running'; if (it.code && !it.phase) it.phase = 'red'; }
  else if (what === 'go-all' && g) goable(s, g).forEach(function (m) { m.went = true; m.go = true; m.status = 'running'; if (m.code && !m.phase) m.phase = 'red'; });
  // HIS WAIVE (goal/G5.7). Andy: "absolutely. with only one agent this must be waved." One agent may take every phase.
  else if (what === 'waive') it.waived = true;
  // A CLAIM CONSUMES THE GO (goal/G2.13). Andy: "When Done is offered, Go will be considered pressed/consumed",
  // and "ok, too." to a Reopen without a Go: an item claimed before his Go counts as gone, as his Go would make it.
  // SINCE goal/G3.9 NO SUCH CLAIM IS TAKEN: the press refuses a claim-done on an item without his Go (Andy,
  // 2026-10-03: "yes, the desk may refuse a claim-done, on an item without 'go' on record", "the actual contract
  // is consumed between 'go' and 'done'"). The line below replays the records taken before that day as they were.
  else if (what === 'claim-done') {
    it.claims[r.by] = true;
    // When, for its claims row (goal/G33.4).
    (it.claimAt = it.claimAt || {})[r.by] = String(r.at || '');
    if (!it.goal && !it.went) { it.went = true; it.status = 'running'; }
  }
  else if (what === 'done') { it.done = true; it.alone = !Object.keys(it.claims).length; }
  // REOPEN TAKES BACK DONE AS WELL AS CLOSE (goal/G4.20 point 2). Andy: "agreed: \"Reopen takes back Done as well
  // as Close\"". His Go stays on record; the claims go, so Done is not offered again until an agent claims anew.
  else if (what === 'reopen') {
    it.done = false; it.closed = false; it.alone = false; it.claims = Object.create(null);
    // REOPEN IS DESIGN AGAIN (goal/G40.3; Andy: "oh, re-open should put an item back to design mode."): it waits for his
    // End design and a fresh Go. Its grant lived until his Done ("make sure that the grant lives until i click 'done'"),
    // so a granted one is spent and the list asks again.
    if (!it.goal) {
      it.design = true; it.go = false; it.went = false;
      it.checks.forEach(function (c) { if (isCoreGrant(c) && c.state === 'granted') { c.state = 'voided'; c.at = r.at; } });
      coreGrantAfter(it, r, '');
    }
    // A REOPENED GOAL WAITS FOR A FRESH RUN (goal/G19.2). Its deskVerify pass and its emptied mark survived the reopen,
    // so Done came straight back on the old run's word. Andy, 2026-10-12, to the four fixes that hold back an unearned
    // Done: "yes. with my addendum." Both go here, in the walk, so a replay agrees; with the mark gone the press below
    // writes a new goal.emptied when every item is still done or closed, and that is the fresh run.
    // A REOPENED GOAL IS IN DESIGN AGAIN (goal/G40.12, box v7, first set 7).
    if (it.goal) { it.checked = false; if (g) { g.emptied = false; g.design = true; } }
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
// as the desk itself. Since goal/G33.3 no run starts from it: the goal's run is his Verify on the goal.
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
  // goal/G33.4: no Go while the item itself is in design, nor while its goal is. An item in its own design while its
  // goal is out of it offers its End design (his alone, as the goal's is), so a new item can be built.
  if (!it.goal && it.design && g && !g.design) out.push('end-design');
  // DESIGN AT ANY TIME (goal/G40.12, box v7, first set 1: "You can turn design on for an item at any time.").
  if (!it.goal && !it.design && it.id !== GROUP_CHAT) out.push('start-design');
  if (!it.goal && !claimed && g && !g.design && !it.design && !it.went && !blockers(s, it).length) out.push('go');
  // A GOAL OFFERS DONE AT ANY TIME, AND NEVER ON A CLAIM (goal/G33.6, replacing goal/G2.10's "only when all items are
  // done"). Andy: "just in the list, a goal offers no done or closed while items are not done or closed, the goal
  // offers those only in the detail panel anytime". So the facts offer it; the List holds it back while the goal's
  // blocked (its items still open) is not empty, and the detail panel shows it. Done is never held back for
  // verification (goal/G33.3): the page marks it from the facts, and the desk keeps no arming.
  if (it.goal) {
    if (!grantsOpen && g && g.members.length > 0) out.push('done');
  // A CODE ITEM OFFERS DONE ON ITS VERIFIER'S PASS (goal/G5.7) OR A CLAIM; A PLAIN ITEM ON A CLAIM (goal/G33.3, as
  // above: Done is offered as soon as an agent claims done).
  } else if (!grantsOpen && ((it.code && it.verified === true) || Object.keys(it.claims).length > 0)) out.push('done');
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
  // HIS VERIFY (goal/G33.3), right next to Done (the box: "A Verify button on the item, right next to its Done
  // button"), on every open item and goal where a deskVerify answers on this node. It always tries; the answer is
  // shown on it, and holds nothing back.
  if (hasDeskVerify() && it.id !== GROUP_CHAT) {
    const at = out.indexOf('done');
    if (at === -1) out.push('verify'); else out.splice(at + 1, 0, 'verify');
  }
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
  // goal/G33.4: the item's own design mode as well as its goal's.
  const gd = s.goals[it.goalId];
  if ((gd && gd.design) || it.design) return 'not-offered';
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

// WHICH RULES APPLY (goal/G40.12, second set; it replaced goal/G5.8's rules stamped at his Go from the paths a box
// named, typesOf and rulesForGo). Andy: "each goal and item gets a list of attached rules", and the rules of an agent's
// work are "the combination of the goals applicable phase rules (test/design/code) the current items applicable phase
// rules", each once: design rules in design, test rules in red and verify, code rules in build; and "desk rules apply
// to ALL phases....". Only rules active now.
// The active auto-attach rules, at goal creation every type but ui; with type 'ui', the ui ones alone, which a shell file
// on an item brings (goal/G40.13, box v22, point 7: "Auto-attach ui rules never come at goal creation: a new goal cannot
// tell yet whether it will touch the UI").
function autoAttachKeys(type) {
  return newestRules.all().filter(function (r) {
    return r.status === 'active' && r.autoAttach === true && (type === 'ui' ? r.type === 'ui' : r.type !== 'ui');
  }).map(function (r) { return r.key; });
}
function phaseKind(s, it) {
  const g = s.goals[it.goal ? it.id : it.goalId];
  if (it.design || (g && g.design)) return 'design';
  if (it.phase === 'red' || it.phase === 'verify') return 'test';
  if (it.phase === 'build') return 'code';
  return '';
}
function phaseRulesOf(s, it) {
  const kind = phaseKind(s, it);
  const gi = s.items[it.goal ? it.id : it.goalId];
  const keys = [];
  [gi, it].forEach(function (x) { ((x && x.attached) || []).forEach(function (k) { if (keys.indexOf(k) === -1) keys.push(k); }); });
  return keys.filter(function (k) {
    const r = newestRule.get(k);
    // Desk rules and the ui rules attached ride on every take and wake (goal/G40.12 point 9, goal/G40.13 point 7).
    return r && r.status === 'active' && (r.type === 'desk' || r.type === 'ui' || (kind && r.type === kind));
  }).map(function (k) { return { key: k, version: newestRule.get(k).n }; });
}

// AN OPEN RED QUESTION (goal/G6.8). Andy: "i want mechanical tracking of design-greens. Yes i want opens to light up my
// list with ERROR icons." An item is design-green when none is open; his End design and a Go wait for green.
function openQ(it) { return !!it && it.checks.some(function (c) { return c.kind === 'Q' && c.state === 'open'; }); }
// FILES KNOWN IN DESIGN (goal/G41.11): a code item with an empty file list is not green, so his End design and his Go
// wait for it as they wait for an open red question. Why an item is not green, or '' when it is.
function redWhy(it) {
  if (openQ(it)) return 'carries an open red question; answer or close it first';
  if (it && it.code === true && !filesOf(it).length) return 'is a code item with an empty file list; list its files first (item.files.add)';
  return '';
}
function notGreen(s, ids) {
  return ids.filter(function (id) { const m = s.items[id]; return m && !m.closed && !m.done && !!redWhy(m); });
}

// LIMBO (goal/G5.4). Andy (andy/NOFACE.md): "when 'go' was pressed/consumed on an item, and no agent is working on
// that item, (all agents idle, ) and no 'Done' button is visible, no grants or red questions pending, then the item
// sits in 'limbo'. this limbo-state is actionable for agents.", and "limbo, when detected must be taken by an
// agent." Working on it: an agent that took it, live, whose last word is working. At once, with no grace time:
// Andy, to how long nobody must be working first: "it counts al limbo immediately."
function limboOf(s, it) {
  if (!it || it.goal || it.go !== true || it.done || it.closed) return false;
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

// THE BOX MEASURED AS ITS ONE ANSWER (goal/G2.2 note 1: "orange at 50%, red at 75%"): its bytes, and whether it is red,
// the one test the facts' full and the auto-cap of goal/G41.11 both read.
function boxSize(box, version) { return Buffer.byteLength(JSON.stringify({ box: String(box), version: version }), 'utf8'); }
function boxFull(box, version) { return boxSize(box, version) >= limits.ANSWER_MAX * 0.75; }
function isLate(it, by, p) { return Array.isArray(it.lateFiles) && it.lateFiles.indexOf(by + '|' + String(p)) !== -1; }
// THE ITEM'S FILE LIST, FLATTENED (goal/G8.8): every writer's paths as one list of { path, by, core }, sorted by path
// so the Details draws it the same way twice. core is coreFiles.isCore, never a second list of its own.
function filesOf(it) {
  const core = require('../../../spirit/coreFiles.js');
  const held = it.files || {};
  const out = [];
  Object.keys(held).forEach(function (by) {
    (Array.isArray(held[by]) ? held[by] : []).forEach(function (p) {
      const e = { path: String(p), by: by, core: core.isCore(String(p)) === true };
      // goal/G41.11: added after his Go; a file listed before it carries no mark.
      if (isLate(it, by, p)) e.late = true;
      out.push(e);
    });
  });
  return out.sort(function (a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : (a.by < b.by ? -1 : 1); });
}

function facts(s, it) {
  const f = { id: it.id, title: it.title, goal: it.goal ? '' : it.goalId, status: it.closed ? 'closed' : it.done ? 'done' : it.status,
    // goal/G33.11: the kind of file the status names, 'test' or 'code', '' when the status is not a file report.
    statusTone: !it.closed && !it.done && it.statusTone && it.toneWord === it.status ? it.statusTone : '',
    // goal/G33.4 (box v46): the box's version, so a client answers item.get from the facts the push brought.
    with: it.with, version: Number(it.version) || 0, buttons: buttons(s, it), blocking: it.blocks.slice(), blocked: blockers(s, it),
    // THE CODE TOGGLE, OFFERED OR NOT (goal/G27.3). Andy, 2026-10-17: "The code button should not be available in vision
    // items." The dialog draws its Code toggle from this: an item (never a goal or sub-goal) whose plugin, if any, does
    // not refuse the code press.
    codeOffered: !it.goal && !PLUGINS.some(function (p) { return !!pluginRefusal(p, 'press', { id: it.id, what: 'code' }); }),
    // His Go on record (goal/G3.9): true once he pressed go or go-all on it; an agent's claim never sets it.
    go: it.go === true,
    // THE STAR IS GONE (goal/G4.20 point 8). Andy: "ha ha, the red star has no function anymore. take it out."
    alone: it.alone, alert: it.alert === true,
    // DONE (n) (goal/G4.20 point 3): how many agents claimed done.
    claims: Object.keys(it.claims).length,
    // WHO HOLDS THE BOX (goal/G4.20 point 9), '' when nobody.
    boxTaken: it.boxTakenBy || '',
    // goal/G5.4: in limbo.
    limbo: limboOf(s, it),
    // goal/G33.4: design mode on item level, as a goal's row has carried it (a goal's is set below).
    design: it.design === true,
    // THE FILES TOUCHED (goal/G8.8) are item.files' own answer since goal/G32.2: a 142-file list in the facts made
    // every write to the item too large to come back. The facts say only how many.
    fileCount: filesOf(it).length,
    // DESIGN-GREEN (goal/G6.8): no open red question on it; goal/G41.11: and a code item has a file listed (redWhy).
    green: !redWhy(it),
    // goal/G5.7: the phase it is in, and who did each.
    code: it.code === true, phase: it.phase || '', red: it.red || '', builder: it.builder || '', verifier: it.verifier || '',
    // goal/G27.10: who created it, '' for an item from a session or before the creator was recorded.
    creator: it.creator || '',
    // goal/G19.13: the commits it was claimed at, the build's and the red's, '' while none was claimed with one.
    claimCommit: it.claimCommit || '', redCommit: it.redCommit || '',
    // goal/G2.22: whether the phase rules are lifted on it, so the dialog knows to stop offering Waive.
    waived: it.waived === true,
    // goal/G40.12: the rules attached to it, each { key }, and the rules its work carries now (phaseRules): its goal's
    // and its own for the phase it is in, each once, each { key, version }.
    rules: (Array.isArray(it.attached) ? it.attached : []).map(function (k) { return { key: k }; }),
    phaseRules: phaseRulesOf(s, it),
    // WHETHER IT IS VERIFIED (goal/G33.3), as the desk last read the verifier's search: 'green', 'red' (verifyFailures
    // the failure lines) or 'none' (no run yet); '' where no deskVerify answers on this node, so no mark is drawn.
    verified: hasDeskVerify() ? String(it.verifyState || 'none') : '', verifyFailures: boundFailures(it.verifyFailures).lines,
    // goal/G33.4: more failure lines than the row holds; the verifier's search has them all.
    verifyFailuresMore: it.verifyFailuresMore === true || boundFailures(it.verifyFailures).more,
    verifyRed: Number(it.verifyRed) || 0,
    // THE SWITCH (goal/G33.3): the verifier's last answer to a start request, taken or busy ('' before any); the Verify
    // button shows it.
    verifyAnswer: s.verifyAnswer || '', verifierBusy: !!s.verifyAnswer,
    // A RUN OF IT UNDER WAY (goal/G33.6): the verifier took it, and no read has seen that run end yet. The page joins it
    // with deskVerify's own publishes to show the run in the item's status (Andy: "why do i no longer see the verifier
    // run in the items status column?").
    verifyRunning: hasDeskVerify() && it.verifyRunning === true };
  // ITS AGENTS BY NAME (goal/G21.1): every label these facts show, mapped to its name where its key has one.
  // goal/G21.6: every agent with an open take of one of his lines.
  f.names = namesFor(s, [it.with, it.boxTakenBy, it.red, it.builder, it.verifier, it.phaseWith]
    .concat(openTakes(it).map(function (l) { return l.taken; }), Object.keys(it.takers), Object.keys(it.files || {}), it.goal ? Object.keys(s.agentKey) : []));
  // goal/G33.4: the holder's key beside its label, so a desk client knows its own item by key (Andy may relabel); only
  // on a held item, so an unheld row grows by nothing.
  if (it.with && it.withKey) f.withKey = String(it.withKey);
  f.asks = asksOf(s, it);
  // THE BOX CAP (goal/G2.2 note 1). Andy: "there will be no second box per item. absolutely not.", "orange at 50%,
  // red at 75%". The box measured as its one answer against limits.ANSWER_MAX: half from 50%, full from 75%;
  // nothing is refused below the answer limit, and the split is negotiated, never automated.
  f.half = boxSize(it.box, it.version) >= limits.ANSWER_MAX * 0.5;
  f.full = boxFull(it.box, it.version);
  if (it.goal) {
    const g = s.goals[it.id];
    const now = Date.now();
    // THE PLUGIN THAT GOVERNS IT (goal/G22.3), by name, on a plugin's private goal alone, and the name of its inner tab
    // under Apps (pluginTab): the face gives each plugin it finds that tab. Since Andy's Apps ruling (2026-10-13) the
    // List draws the goal's title as plain text; "Apps replaces the label button".
    if (PLUGIN_GOAL[it.id]) { f.plugin = PLUGIN_GOAL[it.id]; f.pluginTab = PLUGIN_TAB[it.id] || f.plugin; }
    f.design = g.design;
    // goal/G33.4: the group chat's and every plugin's goal row is marked special, and is always open.
    if (g.special) f.special = true;
    f.waiting = g.members.map(function (id) { return s.items[id]; }).concat([it]).filter(function (o) {
      // goal/G24.9: delete is on offer on running items now, and offering it is not Andy being waited on.
      // goal/G33.3: nor is his Verify, which every open item offers.
      return o && listed(s, o) && (buttons(s, o).filter(function (b) { return b !== 'delete' && b !== 'verify'; }).length > 0 || asksOf(s, o) > 0);
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
  // A ROW ALWAYS FITS ONE ANSWER (goal/G33.4, box v46: "Bound the facts themselves ... so a row always fits"). Measured
  // as it travels in item.get, JSON inside the answer's JSON; past FACTS_ROOM the lists that can grow give way, failure
  // lines first, then the attached rules, each saying more.
  const travel = function () { return Buffer.byteLength(JSON.stringify({ item: JSON.stringify(f), version: 0, change: 0 }), 'utf8'); };
  while (travel() > FACTS_ROOM && f.verifyFailures.length) { f.verifyFailures = f.verifyFailures.slice(0, -1); f.verifyFailuresMore = true; }
  while (travel() > FACTS_ROOM && f.rules.length) { f.rules = f.rules.slice(0, -1); f.rulesMore = true; }
  // A goal's agents (goal/G4.29: every agent the desk knows) give way too, the one heard from longest ago first, and
  // agentsMore says agents.search has them all (the approved list: "a goal row's lists of every agent ever seen").
  if (f.agents) {
    const byAge = Object.keys(f.agents).sort(function (x, y) { const ax = String(s.agentsAt[x] || ''); const ay = String(s.agentsAt[y] || ''); return ax < ay ? -1 : ax > ay ? 1 : 0; });
    while (travel() > FACTS_ROOM && byAge.length) { delete f.agents[byAge.shift()]; f.agentsMore = true; }
  }
  return f;
}
const FACTS_ROOM = ANSWER_ROOM - 512;

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
  // NO PLUGIN OR SPECIAL GOAL ON THE LIST (goal/G41.2; Andy: "plugin/special goals must never be show in the main list").
  // A plugin reads its own goal's items by their ids (item.get), never through this search.
  const goals = Object.keys(s.goals).filter(function (gid) { return (!a.currentGoalOnly || gid === s.current) && !PLUGIN_GOAL[gid] && !s.goals[gid].special; });
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


function refused(code) { const e = new Error(code); e.refusal = code; return e; }
// A REFUSAL SAYS WHY (goal/G10.10). Andy, 2026-10-12: "all refusals everywhere should say why." A bare bad-request
// reached his dialog as "text required", the code's first wording, for an 81-byte title. The reason rides in
// extra.why, as a refused press's does (notOffered below), in words a person can act on.
function refusedWhy(code, why) { const e = refused(code); e.extra = { why: String(why) }; return e; }
// A FIELD RULE'S ANSWER IN WORDS: what was wrong with which field, and its bytes against the limit when it is the size.
function fieldWhy(what, value, paragraph) {
  const fr = require('../../../spirit/fieldRules.js');
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
    const held = blockers(st, it);
    if (held.length) return it.id + ' is blocked by ' + held.join(', ');
    if (it.went) return 'Go is already on record for ' + it.id;
    if (!it.goal && Object.keys(it.claims).length) return it.id + ' is claimed, so it offers Done, not Go';
  }
  if (what === 'make-current' && it.closed) return it.id + ' is closed; Reopen comes first';
  if (what === 'make-current' && PLUGIN_GOAL[it.id]) return it.id + ' is a plugin goal, a standing scope of the desk, and is never made the current goal';
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
//                                                                     checks (one check), files (one file), claims
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
// appServer's streamPublisher (js/appServer.js, opts.publisher) keeps the subscribers: a deskClient subscribes as family
// deskClient, the node's grants deciding who may; every publish goes to each of them, a line his to some agents to those
// alone (the row's to, goal/G21.1). A new subscriber is handed the desk's bootstrap set: the current goal's row and its
// items' rows, and the group chat's, their facts alone; everything published afterwards has a home in its data set
// (box v8: "for the desk that may be no more than the bare goal row"). The desk never acts as a client of its clients
// and keeps nothing from them; it follows no stream itself (box v42).
const CLIENT_WAIT_MS = 10000;
// THE RULES COME WITH IT (goal/G41.2). Andy: "the deskClient is already supposed to have every fucking applicable rule
// in it's cache", as goal/G40.12's box has it: "The desk client caches ... the desk pushes them only when an attachment
// changes, so a wake carries no rule text it already holds." So a subscriber is handed every active rule first, each as
// the publish its writes make ({rule, row}), and from then on hears each rule write; it never asks for a rule's text.
function deskBootstrap(key, since) {
  if (!S || !S.current || !S.goals[S.current]) return [];
  const rules = newestRules.all().filter(function (r) { return r.status === 'active'; }).map(function (r) { return { rule: r.key, row: ruleRow(r.key) }; });
  const ids = [S.current].concat(S.goals[S.current].members, [GROUP_CHAT]).filter(function (id) { return !!S.items[id]; });
  // goal/G41.11: handed as bundles of rows (bundled).
  return bundled(rules.concat(ids.map(function (id) { return rowPublish(S, id, 'goal.whole', S.change); }), since > 0 ? changedSince(S, ids, String(key || ''), since) : []), S.change);
}
// WHAT CHANGED AFTER THE POSITION A SUBSCRIBER HOLDS (goal/G41.11). Andy: "(if it restarts or similar) it calls the
// "subscribe/(connect)" verb do desk, (re-use that verb) with the position number as argument". Every side row of these
// items whose change is after since, as the side row its write published, oldest first; his line addressed to others
// only to them (to). Every table keeps the change that wrote each row; the box keeps none, so an item whose own row
// changed after since hands its box too (a box write changes the item's version). A row deleted since is no row any more
// and is not handed.
const CHANGED_SINCE = {
  chat: db.prepare('SELECT seq AS k, change FROM chat WHERE goal = ? AND item = ? AND change > ?'),
  checks: db.prepare('SELECT number AS k, change FROM checks WHERE goal = ? AND item = ? AND change > ?'),
  files: db.prepare('SELECT holder || \'|\' || path AS k, change FROM files WHERE goal = ? AND item = ? AND change > ?'),
  claims: db.prepare('SELECT claimer AS k, change FROM claims WHERE goal = ? AND item = ? AND change > ?'),
  suites: db.prepare('SELECT path AS k, change FROM suites WHERE goal = ? AND item = ? AND change > ?'),
  items: db.prepare('SELECT change FROM items WHERE goal = ? AND item = ? AND change > ?'),
};
function changedSince(s, ids, key, since) {
  const out = [];
  ids.forEach(function (id) {
    const it = s.items[id];
    const k = numbersOf(id);
    if (!it || !k) return;
    const at = new Map();
    Object.keys(CHANGED_SINCE).forEach(function (table) {
      CHANGED_SINCE[table].all(k[0], k[1], since).forEach(function (row) { at.set(table === 'items' ? 'box' : table + '|' + row.k, Number(row.change)); });
    });
    rowsOf(s, it).forEach(function (x) {
      if (x.table === 'items' || !at.has(x.key)) return;
      if (Array.isArray(x.to) && x.to.indexOf(key) === -1) return;
      out.push(sidePublish(s, id, { table: x.table, key: x.key, x: x, removed: false }, at.get(x.key)));
    });
  });
  return out.sort(function (a, b) { return a.change - b.change; });
}
// An item's facts as a List row publish.
function rowPublish(s, id, verb, change) {
  const it = s.items[id];
  const k = numbersOf(id);
  const o = { change: change, verb: verb, item: it ? facts(s, it) : null, listed: it ? listed(s, it) : false, key: { goal: k ? k[0] : -1, item: k ? k[1] : -1 } };
  if (inSpecialGoal(s, k)) o.special = true;
  return o;
}
// A ROW OF A SPECIAL GOAL (goal/G33.11): a plugin's goal, such as Stacks. Its rows say so, so a deskClient takes what
// happens there as news, beside the current goal's. The group chat (goal 0) is in every client's view already.
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
  // HIS LINE ADDRESSED TO AGENTS (goal/G21.1) names them, so the stream carries it to them alone (appServer.publish).
  if (ch.x && Array.isArray(ch.x.to)) o.to = ch.x.to.slice();
  return o;
}
// A GOAL BECOMING CURRENT IS PUSHED (goal/G33.4). Andy, in the item's box: "when a goal becomes current, the desk pushes
// it whole onto every desk client; from then on it pushes only that goal's updates." Since box v46 that is the goal's and
// its items' facts, one publish each, and no part of an item. Andy: "getting it all at once, hmmm sounds like a bad idea,
// maybe a new deskClient connect should start a stream-push of the goal, and the items, the box and other parts will come
// when needed and stay". An item's box, chat, checks and files are each read by the client that needs them, each its own
// answer under the payload, and kept current by the side rows every write pushes. Also at start, the current goal: every
// client was away from a desk that was not there.
function pushGoalWhole(gid) {
  const s = S;
  const g = s.goals[gid];
  if (!g) return;
  // goal/G41.11: as bundles of rows, not one publish a row.
  bundled([gid].concat(g.members).filter(function (id) { return !!s.items[id]; })
    .map(function (id) { return rowPublish(s, id, 'goal.whole', s.change); }), s.change).forEach(publishOne);
}
// A LIST PUBLISHED AS BUNDLES, FOR THE DESK ONLY (goal/G41.11). Andy: "agreed to publishing lists, FOR DESK ONLY, this
// is NOT a general rule". A list of rows the desk publishes together (a goal pushed whole, a subscriber's bootstrap)
// goes out as { change, rows: [...] }, several rows a publish, each cut at one answer's room by a sized probability
// bucket (every row at probability 0, so the list's order stands). A row too large to share a bundle goes alone, as it
// went before; every row already fits one publish (box.write, largestPanel). Its readers take each row of rows as the
// row it is.
function bundled(rows, change) {
  const room = ANSWER_ROOM - Buffer.byteLength(JSON.stringify({ change: change, rows: [] }), 'utf8');
  const out = [];
  let rest = rows.slice();
  while (rest.length) {
    const bucket = createProbabilityBucket(rest.length);
    rest.forEach(function (row) { bucket.seatFor(0, row); });
    const n = Math.max(1, bucket.serialize(null, room).items.length);
    out.push({ change: change, rows: rest.slice(0, n) });
    rest = rest.slice(n);
  }
  return out;
}
// THE ROWS A WRITE MAY CHANGE: its goal's (the written item's, or the session's goal), and, for a write about an agent,
// every item where somebody holds something (signoff and his exclusion let go of what that agent held).
function goalIds(s, gid) { const g = s.goals[gid]; return g ? [gid].concat(g.members) : []; }
function heldSomewhere(s) {
  return Object.keys(s.items).filter(function (id) {
    const m = s.items[id];
    return m.with || m.phaseWith || m.boxTakenBy || (Array.isArray(m.capOffer) && m.capOffer.length) || openTakes(m).length;
  });
}
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
  if (verb === 'rule.chat') return writeRuleChat(s, body, a);
  const by = String(a.by || '');
  const key = String(a.key || '');
  const sessGoal = verb === 'session.set' && body.session && body.session.goal ? String(body.session.goal.id) : '';
  // The row the write names: its item, the session's goal, or what goal.add and item.add minted (set by their check).
  const writtenId = it ? it.id : sessGoal || String(body.minted || '');
  const gidW = it ? (it.goal ? it.id : it.goalId) : sessGoal || (verb === 'item.add' ? String(body.goal || '') : verb === 'goal.add' ? String(body.minted || '') : '');
  // The goals whose List rows may change: the written one's, and the current goal's for a word about an agent or the
  // verifier (the goal row's working list, every row's verifier switch).
  const shownGoals = [gidW].concat(['agent.state', 'signoff', 'profile.set', 'verify.answer'].indexOf(verb) !== -1 ? [s.current] : []).filter(function (g, i, all) { return g && all.indexOf(g) === i; });
  const seen = function (id) { const x = s.items[id]; return x ? JSON.stringify([facts(s, x), listed(s, x)]) : ''; };
  const before = Object.create(null);
  shownGoals.forEach(function (g) { goalIds(s, g).forEach(function (id) { before[id] = seen(id); }); });
  const holders = verb === 'signoff' || (verb === 'profile.set' && body.included === false) ? heldSomewhere(s) : [];
  const currentBefore = s.current;
  s.change += 1;
  const r = { n: s.change, at: new Date().toISOString(), verb: verb, by: by, key: key };
  // Writers other than him and the desk itself are agents, and a write is their liveness.
  if (by !== 'andy' && by !== 'desk') { s.agentsAt[by] = r.at; if (key) s.agentKey[by] = key; }
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
  // WRITTEN THROUGH, in one transaction: every row of the goal's items that changed, the agent's row, the desk's own.
  const dirty = goalIds(s, gidW).concat(holders).filter(function (id, i, all) { return all.indexOf(id) === i; });
  const side = [];
  db.exec('BEGIN');
  try {
    dirty.forEach(function (id) {
      const x = s.items[id];
      if (!x) return;
      persistItem(s, x, r, id === writtenId, body).forEach(function (ch) { if (ch.table !== 'items') side.push(sidePublish(s, id, ch, r.n)); });
    });
    if (by !== 'andy' && by !== 'desk') persistAgent(s, by);
    if (verb === 'profile.set') persistProfile(s, String(body.agent));
    persistDeskState(s);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    S = loadState();
    throw e;
  }
  // NO LIMBO LINE (goal/G29.10, point 1: "The limbo posts go."). Limbo stays a mark in the item's facts; the desk
  // posts nothing under the item when it enters it.
  // THE STALE RED QUESTION (goal/G5.7) STOOD HERE, and is gone (Andy, 2026-10-26: "i delete that shit from my code.",
  // "you go change that in my clone."): every clear was itself a write that raised the next one, 83 on one item.
  // THE CHANGE ITSELF TRAVELS (desk/G2.7, "no pulling"), one row at a time (goal/G33.4): the written item's facts and
  // whether it is still on the List, always; then every other row whose facts changed (desk/G3.10: a press changes more
  // than its own row), each its own publish; then each side row it changed.
  const now = writtenId ? s.items[writtenId] || null : null;
  const out = rowPublish(s, now ? now.id : '', verb, r.n);
  if (!now) { out.item = null; delete out.listed; delete out.key; }
  // THE SWITCH TRAVELS TO EVERY CLIENT (goal/G33.3): the verifier's answer is one desk fact, said with the publish.
  if (verb === 'verify.answer') out.verifier = { answer: s.verifyAnswer };
  // WHICH PRESS IT WAS (goal/G41.2), so a client wakes its agent on his Go, his End design, a new current goal.
  if (verb === 'press') out.what = String(body.what || '');
  // WHO WROTE IT (goal/G33.9, box v4): every row a write publishes names its writer, label and key, so a client tells a
  // change its own agent made from one made by Andy, another agent or the desk.
  // A FILE'S STATUS GOES TO HIS PAGE ALONE (goal/G41.2). Andy: "the file changes causing status updates, should not
  // stream via peerPost. because they're changing not persistent state.... file changes are only there so the user can
  // \"watch-water-boil\"", and "since you can target agents, can you target the UI alone as well?". A row addressed to
  // no subscriber reaches none of them (appServer.publish), and his page still hears it on its own node.
  const byWriter = function (o) { o.by = String(r.by || ''); o.byKey = String(r.key || ''); if (verb === 'item.status') o.to = []; return o; };
  publishOne(byWriter(out));
  shownGoals.forEach(function (g) {
    goalIds(s, g).forEach(function (id) {
      if (now && id === now.id) return;
      if (s.items[id] && seen(id) !== before[id]) publishOne(byWriter(rowPublish(s, id, verb, r.n)));
    });
  });
  side.forEach(function (o) { publishOne(byWriter(o)); });
  writeGoalFile(s, verb, a, s.change);
  // A GOAL BECOMING CURRENT IS PUSHED WHOLE (goal/G33.4).
  if (s.current && s.current !== currentBefore) pushGoalWhole(s.current);
  shed();
  return s;
}
// A LINE UNDER A RULE (goal/G5.5): a row of rule_chat, numbered like any write so `changes` hands it on; its publish
// names its rule, as rule.add, rule.draft and rule.version do: the open rule dialog repaints on it (goal/G2.18).
function writeRuleChat(s, body, a) {
  const rule = ruleNumber(body.rule);
  s.change += 1;
  db.exec('BEGIN');
  try {
    addRuleChat.run(rule, Number(ruleChatNext.get(rule).seq), new Date().toISOString(), String(a.by || ''), madeBy(a), String(body.text), s.change);
    persistDeskState(s);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); s.change -= 1; throw e; }
  publishOne({ change: s.change, verb: 'rule.chat', item: null, rule: String(body.rule) });
  return s;
}

// THE FILE (goal/G3.14): written whole on his status changes, go, go-all, done, reopen and close (goal/G4.21: "a
// re-open would be subject to the same rule?"), and on session.set (items appear and leave by it; his open point,
// taken as yes); a line, a box, a claim or any other press leave it as it was. One object:
// the two cursors as changes answers them at this moment (change, and line, 0 since the lines went with goal/G33.4),
// the current goal's id, and every item of that goal, the goal's row and the closed ones included, each with its facts
// as item.get gives them, its box and version, its checks and its chat lines {by, at, text}. The group chat goal/G0
// is no item of the goal and is not in it. Written at the end of the write, after the publish, into this server's
// own state folder, never the checkout; then goalShare.js commits it on the remote's master and pushes it, as a job
// the node runs (goal/G4.21: an automation beside its owner, started through its own node's jobs.create, so Jobs
// shows it under process/js/desk). A failure to write or to ask is said on stderr and fails no press.
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
  // it; the commit carries its own time, and change names the desk's moment (line, the log's cursor, went with the log in
  // goal/G33.4).
  const doc = { change: change, goal: s.current, items: items };
  try { fs.writeFileSync(GOAL_STATE_FILE, JSON.stringify(doc, null, 1) + '\n'); } catch (e) { console.error('desk: the goal file was not written: ' + ((e && e.message) || e)); return; }
  shareFile(GOAL_PATH, GOAL_STATE_FILE, 'currentGoal.json, shared by the desk (goal/G4.21)');
}
// The node runs goalShare.js as a job, asked through the one spirit object of this process (goal/G40.6) on its own
// node, with the verb the shell's Start Job uses.
function shareFile(repoPath, fromFile, message) {
  Promise.resolve().then(function () {
    // As {status, body}. A transient job (goal/G29.16): it leaves Jobs once it exited cleanly; a failed share stays.
    return spirit.outcome(spirit.require('spirit/jobs/api.js').then(function (jobs) {
      return jobs.create({ command: process.execPath,
        args: [path.join(__dirname, 'goalShare.js'), '--repo', GOAL_REPO, '--path', repoPath, '--from', fromFile, '--message', message] });
    }));
  }).then(function (r) {
    if (!r || r.status >= 300) console.error('desk: the node refused the goal share: ' + (r ? r.status + ' ' + JSON.stringify(r.body) : 'no answer'));
  }).catch(function (e) { console.error('desk: the goal share was not asked: ' + ((e && e.message) || e)); });
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
  const id = nextGoalId(st);
  return write('session.set', { session: { goal: { id: id, title: 'New goal' }, items: [] }, by: w.by, key: w.key });
}

// A RULE AS rule.get ANSWERS IT, and as its writes publish it (goal/G27.9, S1: "rule writes publish the rule row"); null
// when there is none.
function ruleRow(key) {
  const r = newestRule.get(String(key));
  if (!r) return null;
  const d = getDraft.get(r.key);
  return { key: r.key, label: r.label, type: r.type, status: r.status, text: r.text, draft: d ? d.text : '', at: r.at, by: r.by, autoAttach: r.autoAttach === true };
}
const PRESSES = ['go', 'go-all', 'claim-done', 'done', 'reopen', 'close', 'bring-back', 'abandon', 'start-design', 'end-design', 'design-complete', 'seen', 'waive', 'make-current', 'code', 'verify'];
// Andy's alone (G2.1 review). His presses carry the owner's caller (the
// mark the door forwards, apiAuth/G1.13); a member's are refused. The
// agents keep claim-done, design-complete and bring-back.
const OWNER_PRESSES = ['go', 'go-all', 'done', 'reopen', 'close', 'abandon', 'start-design', 'end-design', 'seen', 'waive', 'make-current', 'code', 'verify'];
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
    // This VM's node's port, as spirit.js read it from relay-state/environment.json (goal/G40.6).
    const p = Number(spirit.node && spirit.node.port);
    return Number.isInteger(p) && p > 0 ? p : 0;
  } catch (e) { return 0; }
}
function lookForDeskVerify() {
  const port = nodeNamedPort();
  if (!port) return;
  // The node's api tree, through the one spirit object (goal/G32.3, goal/G40.6).
  spirit.tree().then(function (body) {
    const apps = body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body) : [];
    VERIFY_SEEN = { at: Date.now(), there: apps.indexOf('deskVerify') !== -1 };
  }, function () { /* asked again on the next turn of the clock */ });
}
lookForDeskVerify();
const verifyWatch = setInterval(lookForDeskVerify, 60000);
if (verifyWatch && typeof verifyWatch.unref === 'function') verifyWatch.unref();

// ONE VERB OF THIS NODE'S deskVerify, by its name on the node's flat apiDoor (goal/G22.3, goal/G33.3): only a port its
// own node named, never the kernel default (goal/G8.3). Resolves deskVerify's answer, rejects with its why. The desk
// hands runs only to the verifier on its own node (the box: "The desk hands runs only to the verifier on its own node").
function askDeskVerify(verb, args) {
  const port = nodeNamedPort();
  if (!port) return Promise.reject(refusedWhy('bad-request', 'this desk\'s node named no port, so no deskVerify can be asked'));
  // Through the one spirit object (goal/G32.3, goal/G40.6), as {status, body}; bound when deskVerify first answers.
  return spirit.outcome(spirit.require('process/js/deskVerify/deskVerify.family/api.js').then(function (v) {
    if (typeof v[verb] !== 'function') throw Object.assign(new Error('deskVerify has no verb ' + verb), { code: 'no-such-verb' });
    return v[verb](args || {});
  })).then(function (r) {
    const b = r && r.body;
    if (r && r.status === 200 && b && typeof b === 'object' && b.ok !== false) return b;
    const why = b && b.extra && b.extra.why ? b.extra.why : (b && (b.error || b.code)) || ('status ' + (r && r.status));
    throw refusedWhy('bad-request', 'deskVerify did not take ' + verb + ': ' + why);
  }, function (e) { throw refusedWhy('bad-request', 'no deskVerify answers on this node: ' + ((e && e.message) || e)); });
}

// ── THE DESK DRIVES VERIFICATION (goal/G33.3) ────────────────────────────
//
//   Andy, in the item's box: "the desk knows the state of all items. so it can send them when verifier is not busy, and
//   i get a fucking button on the ITEM, not the verifier, to trigger a verifier RUN.", "make sure in the box that
//   deskVerify has no fucking clue about desk, desk goals or desk items. the goal itself can compile a list of suites
//   from its items, to trigger a goal-verifier-run.", "the verifier only is busy or not.", and "the desk can damn well
//   read the fucking results from the fucking verifiers database, through the verifiers db-search interface."
//
// DECIDED BY ANDY, in the box, not this file's to widen:
//   - Each item holds its own need for verification: from its verify-phase pass, or its claim, it waits.
//   - The desk compiles a run's suites (an item's from its file list, a goal's from its items' lists) and hands the run
//     to deskVerify.run. The answer, taken or busy, is the switch, verify-busy (a record, verify.answer, so every client
//     and a restart see it); it only informs the Verify button and never holds anything back.
//   - At each event (a claim, a Verify press, a run taken, a Done press) the desk reads the latest state of the waiting
//     items' suites through deskVerify's search, so each item's facts say green, red with the failures, or none.
//   - Only his Verify press hands a run over (an item's suites, or a goal's full check), whatever the switch says. Andy:
//     "verifies on the desk-node get only triggered by MY verify button. NOTHING ELSE.", and "the desk has no business
//     queuing verifications". A claim, an item coming to wait or a Done only reads the states.
//   - Done is never refused for it: the page marks and arms a Done that is not verified green. The line the desk wrote
//     under the item when Done went over a red or a missing run went with goal/G33.11. The desk keeps no arming.
// Do not put a list of work or a result report into deskVerify for this: it is a runner, busy or not.
const WAITING = 'waiting for deskVerify';
function testFilesOf(it) {
  return filesOf(it).map(function (f) { return f.path; }).filter(function (p) { return /^spirit\/test\/.+\.js$/.test(p); });
}
// An item's suites, or a goal's: its suites table, or the union of its items' tables, done and closed ones too (they
// are the goal's work). goal/G33.4 (box v44-45): "a Verify runs exactly the item's suites table, never a guess from the
// file list"; the file list only seeded the tables once (suitesFromFiles).
function suitesFor(s, it) {
  const out = Object.create(null);
  const items = it.goal ? ((s.goals[it.id] || { members: [] }).members.map(function (id) { return s.items[id]; })) : [it];
  items.forEach(function (m) { if (m && !m.leftOut && Array.isArray(m.suites)) m.suites.forEach(function (p) { out[p] = true; }); });
  return Object.keys(out).sort();
}
// THE ITEMS WAITING FOR VERIFICATION: open items an agent claimed or its verifier passed, and goals whose items are all
// done (their Done is offered). Their facts carry what the verifier says of their suites. The current goal's only:
// the work is scoped to the current goal (Andy, goal/G33.4), so a leftover claim in an older goal is never read.
function waitingItems(s) {
  return Object.keys(s.items).map(function (id) { return s.items[id]; }).filter(function (m) {
    if (!m || m.id === GROUP_CHAT || m.done || m.closed || m.leftOut) return false;
    if (!s.current || !inGoalOf(s.current, m.id)) return false;
    if (m.goal) { const g = s.goals[m.id]; return !!g && !g.abandoned && g.members.length > 0 && g.members.every(function (id) { const x = s.items[id]; return x && (x.done || x.closed); }); }
    return Object.keys(m.claims).length > 0 || m.verified === true || m.status === WAITING;
  });
}
// THE LATEST STATE OF SOME SUITES, from the verifier's search: for each, the newest run that ran it (by its row, never
// by time: the verifier's clock is not this one's).
const FAILURES_SHOWN = 10;
// THE FAILURE LINES AN ITEM'S ROW CARRIES ARE BOUNDED IN BYTES (goal/G33.4, live: goal/G33.4's item.get answered
// app-answer-too-large, 8457 bytes, its ten failure lines the bulk of it). Andy's rule: no row or answer past
// PAYLOAD_MAX; too big means split, never chunked. So the row keeps the first lines that fit FAILURES_BYTES, measured as
// they travel (the facts are JSON inside an answer's JSON, so twice escaped), and says more; the verifier's own search
// holds every line.
const FAILURES_BYTES = 1536;
function boundFailures(list) {
  const lines = [];
  const all = Array.isArray(list) ? list.map(String) : [];
  for (const l of all) {
    if (Buffer.byteLength(JSON.stringify(JSON.stringify(lines.concat([l]))), 'utf8') > FAILURES_BYTES) break;
    lines.push(l);
  }
  return { lines: lines, more: lines.length < all.length };
}
async function suiteStates(suites, cache) {
  const out = [];
  for (const suite of suites) {
    if (!cache[suite]) {
      const found = await askDeskVerify('search', { over: 'runs', suite: suite });
      const rows = ((found && found.items) || []).map(function (i) { let l = null; try { l = JSON.parse(i.label); } catch (e) { l = null; } return l ? { n: Number(i.key) || 0, row: l } : null; })
        .filter(Boolean).sort(function (a, b) { return b.n - a.n; });
      const newest = rows[0] ? rows[0].row : null;
      const one = newest ? (newest.suites || []).filter(function (x) { return x && x.path === suite; })[0] || {} : {};
      cache[suite] = !newest || newest.state !== 'ended' ? { outcome: 'none', failures: [] }
        : { outcome: String(one.outcome || 'not run'), failures: (one.failures || []).map(String) };
    }
    out.push({ suite: suite, outcome: cache[suite].outcome, failures: cache[suite].failures });
  }
  return out;
}
// AT EACH EVENT: every waiting item's state, written as verify.state where it changed (so its row travels).
async function readVerifyStates() {
  if (!hasDeskVerify()) return;
  const s = walkState();
  const cache = Object.create(null);
  // goal/G33.4 (Andy's word): the items waiting, and every item a run of his Verify was handed for, waiting or not.
  const reading = waitingItems(s);
  Object.keys(s.items).forEach(function (id) { const m = s.items[id]; if (m.verifyHanded === true && reading.indexOf(m) === -1) reading.push(m); });
  for (const it of reading) {
    const suites = suitesFor(s, it);
    let verified = 'green';
    let failures = [];
    let failuresMore = false;
    let redSuites = 0;
    let pending = false;
    if (suites.length) {
      let states;
      try { states = await suiteStates(suites, cache); } catch (e) { return; }
      pending = states.some(function (x) { return x.outcome === 'none'; });
      const red = states.filter(function (x) { return x.outcome !== 'green' && x.outcome !== 'none'; });
      if (red.length) {
        verified = 'red';
        redSuites = red.length;
        red.forEach(function (x) {
          (x.failures.length ? x.failures : ['']).forEach(function (f) { failures.push((x.suite + ' ' + x.outcome + (f ? ': ' + f : '')).slice(0, 300)); });
        });
        failures = failures.slice(0, FAILURES_SHOWN);
        const bounded = boundFailures(failures);
        failuresMore = bounded.more;
        failures = bounded.lines;
      } else if (states.some(function (x) { return x.outcome === 'none'; })) verified = 'none';
    }
    // Unchanged is not written, unless a run of it was under way and has now ended (goal/G33.6): the write is what ends
    // verifyRunning, so the run leaves the item's status.
    const ended = it.verifyRunning === true && !pending;
    if (!ended && String(it.verifyState || 'none') === verified && JSON.stringify(it.verifyFailures || []) === JSON.stringify(failures) && (it.verifyFailuresMore === true) === failuresMore && (Number(it.verifyRed) || 0) === redSuites) continue;
    // ran: the state came from runs of its suites (an item listing none is green with nothing run, and keeps its word).
    write('verify.state', { id: it.id, verified: verified, failures: failures, failuresMore: failuresMore, redSuites: redSuites, ran: suites.length > 0 && verified !== 'none', ended: !pending, by: 'desk', key: '' });
  }
}
// ONE START REQUEST, its answer written as verify.answer. Answers 'taken', 'busy', or null when nothing was asked.
function handOver(id) {
  const s = walkState();
  const it = s.items[String(id)];
  if (!it || !hasDeskVerify()) return Promise.resolve(null);
  const suites = suitesFor(s, it);
  if (!suites.length) return Promise.resolve(null);
  const commit = it.goal ? '' : String(it.claimCommit || '');
  return askDeskVerify('run', { suites: suites, commit: commit }).then(function (b) {
    const taken = b && b.taken === true;
    write('verify.answer', { id: it.id, taken: taken, by: 'desk', key: '' });
    return taken ? 'taken' : 'busy';
  }, function () { return null; });
}
// AN EVENT, one at a time (two at once would hand the same item over twice): the waiting items' state is read, and
// only his Verify press (id given) hands an item over, whatever the switch says; a run taken is an event of its own, so
// the state is read again. THE DESK QUEUES NO VERIFICATION AND STARTS NONE ON ITS OWN (Andy, goal/G33.3: "verifies on the
// desk-node get only triggered by MY verify button. NOTHING ELSE."): a claim, an item coming to wait or a Done only
// reads states.
let verifyEvents = Promise.resolve();
// THE RUN HIS VERIFY HANDED OVER IS READ UNTIL IT ENDS (goal/G33.4, Andy's word: "the desk shows the result of ANY run his
// Verify started, on that item"). The end of a run is no event the desk hears, so while an item handed over still waits
// for its run's end, its state is read through the verifier's search every VERIFY_WATCH_MS (manifest value
// verifyWatchMs): a read, never a run started or queued. It stops when no handed item is left.
const VERIFY_WATCH_MS = Number(values.verifyWatchMs) > 0 ? Number(values.verifyWatchMs) : 2000;
let handedWatch = null;
function watchHanded() {
  if (handedWatch) return;
  handedWatch = setInterval(function () {
    const s = walkState();
    if (!Object.keys(s.items).some(function (id) { return s.items[id].verifyHanded === true; })) { clearInterval(handedWatch); handedWatch = null; return; }
    verifyEvent('');
  }, VERIFY_WATCH_MS);
}
function verifyEvent(id) {
  const next = verifyEvents.then(async function () {
    if (!hasDeskVerify()) return;
    await readVerifyStates();
    const target = String(id || '');
    if (!target) return;
    if ((await handOver(target)) === 'taken') { await readVerifyStates(); watchHanded(); }
  });
  verifyEvents = next.catch(function () {});
  return next.catch(function () {});
}
// doneOver STOOD HERE: a Done that went over a red or a missing run said so in a line under the item. It went with
// goal/G33.11 (Andy: "no auto-chat-lines from deskVerify, only status updates."); the page still marks a Done that is
// not verified green.

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
// The item and goal ids a call names: id, goal and blocks (session.set, which named many, went with goal/G33.7).
function idsOfCall(verb, a) {
  const out = [];
  if (!a || typeof a !== 'object') return out;
  ['id', 'goal', 'blocks'].forEach(function (k) { if (typeof a[k] === 'string' && a[k]) out.push(a[k]); });
  return out;
}
// What a plugin is handed: its name and goal, and the desk's own writes and rules. write is the desk's write as the desk
// itself (as the limbo line is written); writeAs writes as the caller the door forwarded. A check given to either runs
// against the state as it stands, and may set fields of the body it was given before the record is kept (minted).
// SINCE goal/G22.3's "RUN the show" (Andy, 2026-10-13): stateDir, the plugin's own folder under the desk's --state
// (plugins/<name>/, never in git, as desk.db is not: D5 above), and publish(data), which says data on the desk's stream
// as { plugin: <name>, data }: no change, no item, no rows, so the face's List never paints it, and only the plugin's
// own UI, which subscribes itself, reads it.
function pluginDesk(name, manifest, goal) {
  return {
    name: name, goal: goal, manifest: manifest,
    stateDir: path.join(STATE, 'plugins', name),
    publish: function (data) { return appServer.publish({ plugin: name, data: data }); },
    state: walkState,
    inGoal: function (id) { return inGoalOf(goal, id); },
    write: function (verb, body, check) { body.by = 'desk'; body.key = ''; return write(verb, body, check); },
    writeAs: function (verb, body, caller, check) { const w = writerOf(caller); body.by = w.by; body.key = w.key; return write(verb, body, check); },
    writerOf: writerOf,
    refused: refusedWhy,
    fieldRules: require('../../../spirit/fieldRules.js'),
    fieldWhy: fieldWhy,
    nextItemId: nextItemId,
    // goal/G33.4: an id written before the ids became numbers (plugin/<name>.<n>, as a plugin's own list may still hold
    // it) read as this goal's: goal/G<k>.<n>. Any other id comes back as it is.
    idOf: function (id) { const m = /^plugin\/([^.]+)(?:\.(\d+))?$/.exec(String(id || '')); return m && m[1] === name ? (m[2] ? goal + '.' + m[2] : goal) : String(id || ''); },
    // SINCE goal/G22.3 (Andy, 2026-10-13: "every run here should report to deskVerify."): one verb of this node's
    // deskVerify, by its verbs on the node's flat apiDoor, as lookForDeskVerify asks the node; only a port its own node named,
    // never the kernel default (goal/G8.3). Resolves deskVerify's answer, rejects with its why.
    verify: askDeskVerify,
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
      try {
        // ITS PRIVATE GOAL, ON ITS FIRST MOUNT: the next goal number, the title its manifest gives, its row naming the
        // plugin and marked special (goal/G33.4); a later mount finds it by that name.
        let goal = pluginGoalOf(walkState(), name);
        if (!goal) {
          const args = { title: String((manifest && (manifest.goal || manifest.label)) || name), plugin: name, by: 'desk', key: '' };
          write('goal.add', args, function (st) { args.minted = nextGoalId(st); args.rules = autoAttachKeys(); });
          goal = args.minted;
        }
        PLUGIN_GOAL[goal] = name;
        PLUGIN_TAB[goal] = String((manifest && (manifest.tab || manifest.label)) || name).slice(0, 32);
        const made = require(js)(pluginDesk(name, manifest, goal)) || {};
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
// HIS LINES JOINED TO A PHASE HOLDER'S ANSWERS (goal/G29.10, point 2) WENT WITH goal/G33.7. Andy: "why? my lines are
// streamed to deskClient without any further assistance", and "the desk should answer what it was asked. period.
// don't get fancy, it always backfires." Every verb answers what it was asked; his lines reach the agent on the stream.
function withPlugins(verbs) {
  const all = {};
  Object.keys(verbs).forEach(function (verb) {
    const v = verbs[verb];
    all[verb] = Object.assign({}, v, { handler: function (a, caller) {
      // A PLUGIN'S GOAL BY ITS FIXED KEY (goal/G22.3: "its own private goal with a fixed key"): since goal/G33.4 the goal
      // is numbered, and plugin/<name> (or plugin/<name>.<n>, one of its items) names it still, so the page finds a
      // plugin's goal by the plugin's name.
      if (a && typeof a === 'object') {
        ['id', 'goal', 'blocks'].forEach(function (k) {
          if (typeof a[k] !== 'string') return;
          const m = /^plugin\/([^.]+)(?:\.(\d+))?$/.exec(a[k]);
          const gid = m ? Object.keys(PLUGIN_GOAL).filter(function (g) { return PLUGIN_GOAL[g] === m[1]; })[0] : '';
          if (gid) { a = Object.assign({}, a); a[k] = m[2] ? gid + '.' + m[2] : gid; }
        });
      }
      const ids = idsOfCall(verb, a);
      for (const p of PLUGINS) {
        const no = pluginRefusal(p, verb, a, ids);
        if (no) throw refusedWhy('not-offered', 'the ' + p.name + ' plugin governs ' + p.goal + ': ' + no);
        const took = typeof p.handles === 'function' ? p.handles(verb, a, caller) : undefined;
        if (took !== undefined) return took;
      }
      return caller === undefined ? v.handler(a) : v.handler(a, caller);
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
// AT START (goal/G33.4): the state read from its tables (the migration first, once), the plugins mounted, the database
// shed to its size; the current goal is pushed whole once the desk serves (below).
startState();
mountPlugins();
shed();

appServer.serve(withPlugins({
  // log.add, log.search AND pending.get WENT WITH goal/G33.4 (Andy: "log.add, log.search and pending.get: delete
  // them."): the old lines table they read and wrote was dumped at the migration. Do not bring them back.
  // changes WENT WITH goal/G33.4 (Andy, on it: "isn't that what this item does? implement the push/broadcast concept?"):
  // the desk streams each changed row to its subscribers (appServer.publish), and nothing is read back by a cursor.
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
  // items.find WENT WITH goal/G33.7 (the approved verb list: "agents only; items.search covers it").
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
  // goal/G33.7 (the approved list: "item.checks (more flag)"): the panel's checks in their order, as many as fill one
  // answer, and checksMore when some were left out.
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
  // ── EACH TABLE'S SEARCH (goal/G33.7), from tableSearch: an item's suites, checks, files, claims and box versions, and
  // the agents. Each answers {items: [{key, label}], more}, ranked by text, newest first among equals.
  'item.suites.search': tableSearch({
    request: { id: '' },
    rows: function (a, st) { const it = itemFor(st, a); return (it.suites || []).map(function (p, i) { return { key: String(p), fields: { path: String(p) }, label: { path: String(p), pos: i } }; }); },
  }),
  'item.checks.search': tableSearch({
    request: { id: '' },
    rows: function (a, st) {
      const it = itemFor(st, a);
      return (it.checks || []).slice().reverse().map(function (c) { return { key: String(c.number), fields: { number: String(c.number), kind: String(c.kind || ''), words: String(c.words || ''), state: String(c.state || '') }, label: c }; });
    },
  }),
  'item.files.search': tableSearch({
    request: { id: '' },
    rows: function (a, st) { const it = itemFor(st, a); return filesOf(it).map(function (e) { return { key: e.by + '|' + e.path, fields: { path: e.path, by: e.by }, label: e }; }); },
  }),
  'item.claims.search': tableSearch({
    request: { id: '' },
    rows: function (a, st) {
      const it = itemFor(st, a);
      return Object.keys(it.claims || {}).map(function (label) { const at = String((it.claimAt && it.claimAt[label]) || ''); return { key: label, fields: { by: label }, label: { by: label, at: at } }; })
        .sort(function (x, y) { return x.label.at < y.label.at ? 1 : x.label.at > y.label.at ? -1 : 0; });
    },
  }),
  'item.box.search': tableSearch({
    request: { id: '' },
    rows: function (a, st) {
      const it = itemFor(st, a);
      const k = numbersOf(it.id);
      return boxVersionsOf.all(k[0], k[1]).map(function (r) { return { key: String(r.version), fields: { text: String(r.text) }, label: { version: r.version, by: String(r.creator), at: String(r.at), text: String(r.text) } }; });
    },
  }),
  'agents.search': tableSearch({
    rows: function (a, st) {
      return Object.keys(st.agentKey).map(function (label) {
        const key = st.agentKey[label];
        const name = nameOfKey(st, key) || '';
        return { key: label, at: String(st.agentsAt[label] || ''), fields: { label: label, name: name }, label: { label: label, key: key, name: name, at: String(st.agentsAt[label] || ''), word: String(st.agentWord[label] || '') } };
      }).sort(function (x, y) { return x.at < y.at ? 1 : x.at > y.at ? -1 : 0; });
    },
  }),
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
        const lines = ruleChatOf.all(ruleNumber(a.id)).map(function (r) { return { by: r.by, at: r.at, text: String(r.text), taken: '', key: r.creator === r.by ? '' : String(r.creator) }; });
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
  'chat.search': tableSearch({
    request: { id: '', by: '', since: '', before: '', scope: '' },
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
          if (a.since && !(String(l.at) >= a.since)) continue;
          if (a.before && !(String(l.at) < a.before)) continue;
          lines.push({ item: c, i: i, l: l });
        }
      });
      if (across) lines.sort(function (x, y) { return x.l.at < y.l.at ? 1 : x.l.at > y.l.at ? -1 : 0; });
      // goal/G21.1: the writer's key and name ride with its label; with a scope, the item it was said in too.
      return lines.map(function (x) {
        const l = x.l;
        const label = { by: l.by, key: String(l.key || ''), name: nameOfKey(st, l.key), at: l.at, text: l.text };
        if (scope) label.item = x.item;
        return { key: across ? x.item + '#' + x.i : String(x.i), label: label, probability: lineProbability(text, l) };
      });
    },
  }),
  // ── THE WRITES: no verb takes `by` any more (apiAuth/G1.13) — the
  // writer is the caller the door forwarded and appServer handed in,
  // so nobody names their own writer. A by argument fails the request
  // shape and is refused no-such-argument, which is the point.
  // session.set WENT WITH goal/G33.7 (the approved verb list: "writes a whole goal at once; its callers use goal.add and
  // item.add"). A goal is made by goal.add, its items by item.add (a split: item.add blocking the parent), one each.
  // ONE GOAL, ONE ITEM, AND THE DESK NAMES IT (goal/G9.9). Andy, 2026-10-07: "the desk owns (is in charge of) goal and
  // item ID's.", and "why should the agents need to, they can use the same api's the user needs to create them." So the
  // same two verbs serve him and the agents, the id comes back in the answer, and nobody sends one: an `id` argument is
  // refused by the door as no-such-argument. Decided by Andy; the bulk session.set went with goal/G33.7.
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
        args.rules = autoAttachKeys();
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
      // RED OFFERS THE CAP (goal/G41.11). Andy: "red should trigger an auto-cap". A write that leaves the box red (the
      // facts' full, the dialog's red border) has the desk offer the cap itself, as his "cap" line does (addressOf):
      // to every included agent with cap on, decided at the write and kept in it (capOffer). Below red, nothing.
      const st0 = walkState();
      const capOffer = boxFull(String(a.text), (Number(a.version) || 0) + 1) ? addressOf(st0, 'cap', null).to : null;
      const s = write('box.write', Object.assign({}, a, { by: w.by, key: w.key }, capOffer ? { capOffer: capOffer } : {}), function (st, it) {
        // ONLY THE TAKER WRITES while a box take stands (goal/G4.20 point 9). ONE RULE FOR EVERYBODY SINCE goal/G9.3:
        // Andy, 2026-10-07, asked whether his own take refuses an agent until he leaves the box: "yes. so it shoule be
        // among agents as well, the box is taken, and released after edit. it also helps agents stay out of each others
        // way." So his write is refused over another's take as an agent's is; he was the exception until then.
        // By key since goal/G21.1: a hold his nick request started is that agent's one write, his own included.
        if (it.boxTakenBy && !holdsBox(it, w)) throw refused('taken');
        if (a.version !== it.version) throw refused('box-moved');
      });
      const written = { change: s.change, version: s.items[a.id].version };
      // AND WAKES THEM AS HIS LINE DOES (goal/G41.11): a desk line under the item, its record's to the very keys the cap
      // is offered to (the shape of his addressed lines), so each of their deskClients wakes its agent.
      if (capOffer && capOffer.length) {
        write('chat.add', { id: a.id, text: 'the box is red: the cap is offered to the agents with cap on (box.take, then one write)', to: capOffer, cap: true, by: 'desk', key: '' });
      }
      return written;
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
      // goal/G33.2 (box v6): his newest line under the item is an "all" line addressed to this agent: it may answer.
      const newestHis = it0 ? it0.chat.slice().reverse().filter(function (l) { return l.by === 'andy'; })[0] : null;
      const mine = !!(it0 && (holdsTake(it0, w) || (newestHis && newestHis.all === true && Array.isArray(newestHis.to) && newestHis.to.indexOf(w.key) !== -1)));
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
      const address = caller.owner === true && it0 && !clear ? addressOf(st0, a.text, it0) : null;
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
      // A VERIFY PASS CARRIES THE ITEM'S CLAIMED COMMIT (goal/G27.2, D11): the pass sets the item waiting for deskVerify,
      // and the run the desk hands over carries this commit (handOver), never whatever the verifier's tree holds.
      const claimed = a.phase === 'verify' && a.pass === true ? String(((walkState().items[String(a.id)]) || {}).claimCommit || '') : '';
      if (claimed) body.commit = claimed;
      const change = write('phase.done', body, function (st, it) {
        if (!it || !it.code || it.phaseWith !== w.by || it.phase !== String(a.phase)) throw refused('not-offered');
        const q = ownOpenQ(st, it, w);
        if (q) throw refusedWhy('not-offered', q.number + ' of ' + w.by + ' is open on ' + it.id + ': a red Q is resolved with Andy before the phase is done');
        // A RED FINISHES ONLY ONCE ITS RED CLAIM, WITH ITS SUITES, IS ON RECORD (goal/G33.11).
        if (a.phase === 'red' && !(it.redCommit && Array.isArray(it.suites) && it.suites.length)) throw refusedWhy('not-offered', 'the red of ' + it.id + ' finishes once its suite rows are added (item.suites.add) and a red claim is on record: claim {id, phase: red, commit}');
      }).change;
      // AN ITEM THAT COMES TO WAIT IS AN EVENT (goal/G33.3): the states are read; nothing is handed over (his Verify does).
      const comesToWait = a.phase === 'verify' && a.pass === true;
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
      if (comesToWait) return verifyEvent('').then(function () { return { change: change }; });
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
      const st = walkState();
      const it = st.items[String(a.id)];
      if (!it) throw refused('no-such-item');
      const q = ownOpenQ(st, it, w);
      if (q) return { allowed: false, why: 'red Q: ' + q.number + ' of ' + w.by + ' is open on ' + it.id + '; it is resolved with Andy before anything lands' };
      // NO COMMIT IN DESIGN (goal/G40.12, box v7, first set 2: "No commit lands while the current goal, or the item the
      // agent is on, is in design mode, granted or not.").
      const gd = st.goals[it.goal ? it.id : it.goalId];
      const cur = st.goals[st.current];
      if (it.design || (gd && gd.design)) return { allowed: false, why: 'design: ' + it.id + ' or its goal is in design, so no commit lands' };
      if (cur && cur.design) return { allowed: false, why: 'design: the current goal ' + st.current + ' is in design, so no commit lands' };
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
      // THE CURRENT GOAL'S WORK ALONE (goal/G33.8, box v14): a job left in an old goal (found live: goal/G29.17's build)
      // was offered to every listening agent, who skipped it by hand. The work is scoped to the current goal.
      Object.keys(s.goals).filter(function (gid) { return gid === s.current; }).forEach(function (gid) {
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
    request: { type: '', label: '', text: '', autoAttach: false }, reply: { key: '' },
    // autoAttach optional (goal/G40.12): left out, false.
    accepts: function (x) {
      if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
      const known = ['type', 'label', 'text', 'autoAttach'];
      return Object.keys(x).every(function (k) { return known.indexOf(k) !== -1; }) && typeof x.type === 'string' &&
        typeof x.label === 'string' && typeof x.text === 'string' && (x.autoAttach === undefined || typeof x.autoAttach === 'boolean');
    },
    handler: function (a, caller) {
      const w = writerOf(caller);
      mayWrite(walkState(), w);
      const fr = require('../../../spirit/fieldRules.js');
      if (RULE_TYPES.indexOf(a.type) === -1) throw refusedWhy('bad-request', 'a rule type is one of ' + RULE_TYPES.join(', '));
      // AUTO-ATTACH IS HIS (goal/G40.12; Andy, 2026-10-26: "it is I, the USER who controls auto-attach and the rules, NOT
      // the agents, not the desk"): an agent may propose a rule, never one that attaches itself.
      if (a.autoAttach === true && !(caller && caller.owner === true)) throw refusedWhy('not-owner', 'autoAttach is set by Andy alone');
      if (fieldWhy('label', a.label)) throw refusedWhy('bad-request', fieldWhy('label', a.label));
      if (fieldWhy('text', a.text, true)) throw refusedWhy('bad-request', fieldWhy('text', a.text, true));
      const key = 'rule/' + (Number(ruleCount.get().c) + 1);
      addRuleRow.run(key, new Date().toISOString(), w.by, a.type, fr.normalize(a.label), 'proposed', fr.normalizeParagraph(a.text), a.autoAttach === true);
      appServer.publish({ rule: key, row: ruleRow(key) });
      rulesChanged(key, 'added, proposed');
      return { key: key };
    },
  },
  'rule.get': {
    request: { key: '' }, reply: { key: '', label: '', type: '', status: '', text: '', draft: '', at: '', by: '', autoAttach: false },
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
      const fr = require('../../../spirit/fieldRules.js');
      if (!newestRule.get(String(a.key))) throw refused('no-such-item');
      if (fr.paragraphProblem(a.text)) throw refusedWhy('bad-request', fieldWhy('text', a.text, true));
      putDraft.run(String(a.key), new Date().toISOString(), fr.normalizeParagraph(a.text));
      appServer.publish({ rule: String(a.key), row: ruleRow(String(a.key)) });
      return { key: String(a.key) };
    },
  },
  'rule.version': {
    request: { key: '', text: '', status: '', autoAttach: false }, reply: { key: '' },
    // THE FULL RULE (goal/G40.12, Q1, Andy: "rule.version? carries the full rule."): autoAttach with it, optional; left
    // out, the rule keeps what it had.
    accepts: function (x) {
      if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
      const known = ['key', 'text', 'status', 'autoAttach'];
      return Object.keys(x).every(function (k) { return known.indexOf(k) !== -1; }) && typeof x.key === 'string' &&
        typeof x.text === 'string' && typeof x.status === 'string' && (x.autoAttach === undefined || typeof x.autoAttach === 'boolean');
    },
    handler: function (a, caller) {
      ownerOnly(caller);
      const fr = require('../../../spirit/fieldRules.js');
      const r = newestRule.get(String(a.key));
      if (!r) throw refused('no-such-item');
      if (RULE_STATUSES.indexOf(a.status) === -1) throw refusedWhy('bad-request', 'a rule status is one of ' + RULE_STATUSES.join(', '));
      if (fr.paragraphProblem(a.text)) throw refusedWhy('bad-request', fieldWhy('text', a.text, true));
      addRuleRow.run(r.key, new Date().toISOString(), 'andy', r.type, r.label, a.status, fr.normalizeParagraph(a.text),
        typeof a.autoAttach === 'boolean' ? a.autoAttach : r.autoAttach === true);
      appServer.publish({ rule: r.key, row: ruleRow(r.key) });
      rulesChanged(r.key, 'versioned, ' + a.status);
      return { key: r.key };
    },
  },
  // rule.history WENT WITH goal/G33.7 (the approved verb list: nothing calls it).
  // THE LIST'S SEARCH (FACE.md): "searchable for deskClient and UI, with the type and status values as filters,
  // and label and text being searched. search results with bring back key, label, type and status."
  'rules.search': tableSearch({
    request: { types: [''], statuses: [''] },
    rows: function (a) {
      // goal/G29.21: the text ranks the rules by title and text, the types and statuses still filter; newest first among
      // equals, so no words reads every rule newest first.
      const types = (Array.isArray(a.types) ? a.types : []).filter(Boolean);
      const statuses = (Array.isArray(a.statuses) ? a.statuses : []).filter(Boolean);
      return newestRules.all().filter(function (r) {
        if (types.length && types.indexOf(r.type) === -1) return false;
        return !(statuses.length && statuses.indexOf(r.status) === -1);
      }).map(function (r) { return { key: r.key, fields: { label: String(r.label), text: String(r.text || '') }, label: { label: r.label, type: r.type, status: r.status } }; });
    },
  }),
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
  // THE VERIFIER'S WORDS ON THE DESK WENT WITH goal/G33.3: verify.pass, verify.reject, verify.regress, verify.again.
  // Andy's yes, "box this and continue": deskVerify knows nothing of the desk, so nothing would write them; the desk
  // reads the verifier's search itself and keeps the outcome in each item's facts (verifyEvent).
  // tone (goal/G33.11), optional: 'test' or 'code' when the word is a file the agent's checkout changed (its deskClient).
  'item.status': {
    request: { id: '', word: '', tone: '' }, reply: { change: 0 },
    accepts: function (x) {
      if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
      return Object.keys(x).every(function (k) { return ['id', 'word', 'tone'].indexOf(k) !== -1; }) &&
        typeof x.id === 'string' && typeof x.word === 'string' && (x.tone === undefined || x.tone === '' || x.tone === 'test' || x.tone === 'code');
    },
    handler: function (a, caller) { const w = writerOf(caller); return { change: write('item.status', Object.assign({}, a, { by: w.by, key: w.key })).change }; } },
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
  // ONE ROW A WRITE (goal/G40.3; the verbs Andy approved: "yes to the named verbs"): item.files.add and .remove take one
  // path of the writer's own list; item.suites.add and .remove one suite of the item's. Each refuses a path already
  // there or not there, naming it.
  // goal/G41.11: or a list of paths in one write (filesAddVerb).
  'item.files.add': filesAddVerb(listRowVerb('item.files.add', function (it, w, p) { return !!(it.files && Array.isArray(it.files[w.by]) && it.files[w.by].indexOf(p) !== -1); }, true)),
  'item.files.remove': listRowVerb('item.files.remove', function (it, w, p) { return !!(it.files && Array.isArray(it.files[w.by]) && it.files[w.by].indexOf(p) !== -1); }, false),
  'item.suites.add': listRowVerb('item.suites.add', function (it, w, p) { return Array.isArray(it.suites) && it.suites.indexOf(p) !== -1; }, true, true),
  'item.suites.remove': listRowVerb('item.suites.remove', function (it, w, p) { return Array.isArray(it.suites) && it.suites.indexOf(p) !== -1; }, false, true),
  // THE RULES ATTACHED TO A GOAL OR AN ITEM (goal/G40.12, second set 1-3; the names Andy approved: "yes, that moves me
  // on"): item.rules.add {id, rule} puts one rule on, by its key, item.rules.remove takes it off; on a goal's id as on an
  // item's; his alone. Each refuses a rule that does not exist, one already there, or one not there.
  'item.rules.add': ruleRowVerb('item.rules.add', true),
  'item.rules.remove': ruleRowVerb('item.rules.remove', false),
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
      // HIS VERIFY (goal/G33.3): no record of its own; the item (a goal: its items' suites) is handed over whatever the
      // switch says, and the verifier's answer, written as verify.answer, is shown on the switch.
      if (a.what === 'verify') {
        const st = walkState();
        const it = st.items[String(a.id)];
        if (!it) throw refused('no-such-item');
        if (buttons(st, it).indexOf('verify') === -1) throw notOffered(hasDeskVerify() ? it.id + ' takes no verify' : 'no deskVerify answers on this node, so nothing can be verified');
        if (!suitesFor(st, it).length) throw notOffered(it.id + ' has no suites (its red writer adds them with item.suites.add), so there is nothing to run');
        return verifyEvent(it.id).then(function () { return { change: walkState().change }; });
      }
      const body = Object.assign({}, a, { by: w.by, key: w.key });
      const land = function () {
        const landed = write('press', body, pressCheck(a));
        // THE PRESS THAT EMPTIES THE GOAL WRITES IT (goal/G8.12), once, right after it has landed.
        emptiedByPress(a);
        return { change: landed.change };
      };
      // A CLAIM IS AN EVENT (goal/G33.3): the waiting items' state is read; nothing is handed over (only his Verify does).
      if (a.what === 'claim-done') { const out = land(); return verifyEvent('').then(function () { return out; }); }
      if (a.what !== 'done') return land();
      // HIS DONE IS NEVER REFUSED FOR VERIFICATION (goal/G33.3): the state is read first. It hands nothing over, and
      // since goal/G33.11 it posts no line under the item.
      return readVerifyStates().then(function () {
        const out = land();
        return verifyEvent('').then(function () { return out; });
      });
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
  //   suites       goal/G33.4 (box v44-45, Andy's yes on the verb change): the red claim carries the item's suites, the
  //                spirit/test/ paths a Verify of it runs; they fill its suites table. Optional; a build claim takes none.
  'claim': {
    // No suites of its own (goal/G40.3): a claim carrying them is refused; the item's suite rows are what a red names.
    request: { id: '', phase: '', commit: '' }, reply: { change: 0 },
    accepts: function (a) {
      if (!a || typeof a !== 'object' || Array.isArray(a)) return false;
      if (Object.keys(a).sort().join(',') !== 'commit,id,phase') return false;
      return typeof a.id === 'string' && typeof a.phase === 'string' && typeof a.commit === 'string';
    },
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
      // NO RED WITHOUT ITS SUITES (goal/G33.11, goal/G40.3; Andy: "a red claim will fail if no suite-rows are registered
      // with an item."): they are what a Verify of the item runs, added one a write with item.suites.add.
      if (phase === 'red' && !it0.closed && !(Array.isArray(it0.suites) && it0.suites.length)) throw refusedWhy('bad-request', 'no suite rows are registered with ' + id + ': add its spirit/test/ suites with item.suites.add before the red claim');
      const body = { id: id, phase: phase, commit: commit, by: w.by, key: w.key };
      // THE SAME CHECKS AS THE PRESS (goal/G19.13): a build claim is refused exactly where press claim-done is.
      const landed = write('claim', body, phase === 'build' ? pressCheck({ id: id, what: 'claim-done' }) : null);
      if (phase === 'build') emptiedByPress({ id: id });
      // A BUILD CLAIM IS AN EVENT (goal/G33.3), as the press claim-done is: the states are read, nothing handed over.
      if (phase === 'build') return verifyEvent('').then(function () { return { change: landed.change }; });
      return { change: landed.change };
    },
  },
  // state.get and state.set WENT WITH goal/G33.7 (the approved verb list: nothing calls them).
  // SEEN, ONE ROW PER ITEM (goal/G33.7, the approved list: "one row per item, not one growing document"): the arrival
  // time of the newest thing he has looked at under the item (the group chat's is goal/G0's), kept in the item's row.
  'seen.get': {
    request: { id: '' }, reply: { at: '' },
    handler: function (a) { return { at: String(itemFor(walkState(), a).seenAt || '') }; },
  },
  'seen.set': {
    request: { id: '', at: '' }, reply: { change: 0 },
    handler: function (a, caller) {
      const w = writerOf(caller);
      const it = itemFor(walkState(), a);
      // A time, as the desk writes them (ISO 8601), and nothing else: a seen value never grows. One past a time's size is
      // refused as too large, as every write of text is.
      const atBytes = Buffer.byteLength(String(a.at || ''), 'utf8');
      if (atBytes > 64) throw tooLarge(atBytes, 64);
      if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/.test(String(a.at || ''))) throw refusedWhy('bad-request', 'at is a time like 2026-10-23T12:00:00.000Z');
      if (String(a.at || '') <= String(it.seenAt || '')) return { change: walkState().change };
      return { change: write('seen.set', { id: it.id, at: String(a.at), by: w.by, key: w.key }).change };
    },
  },
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
// goal/G33.8: the desk publishes (opts.publisher: its subscribers are deskClients, each handed deskBootstrap first), and
// no opts.stream: the desk follows no stream (box v42).
{ dependencies: ['desk'], publisher: { family: 'deskClient', bootstrap: function (key, since) { return deskBootstrap(key, since); }, waitMs: CLIENT_WAIT_MS }, codes: {
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
    if (a.what === 'code' && it.goal) throw notOffered(it.id + ' is a goal, and a goal is never a code item');
    // DESIGN-GREEN GATES THEM (goal/G6.8): his End design while any item of the goal has an open red question, a Go
    // on an item with one, a go-all while any item of the goal has one: refused.
    const gOf = st.goals[it.goal ? it.id : it.goalId];
    const members = gOf ? gOf.members : [];
    // goal/G33.4: an item's own End design waits for its own green alone.
    const red = a.what === 'end-design' && !it.goal ? notGreen(st, [it.id])
      : (a.what === 'end-design' || a.what === 'go-all') ? notGreen(st, members.concat(it.goal ? [it.id] : [])) : [];
    // goal/G41.11: each one named with its own why (redWhy): an open red question, or a code item's empty file list.
    if (red.length) throw notOffered(red.map(function (id) { return id + ' ' + redWhy(st.items[id]); }).join('; '));
    if (a.what === 'go' && redWhy(it)) throw notOffered(it.id + ' ' + redWhy(it));
    // NO CLAIM BEFORE HIS GO (goal/G3.9). Andy, 2026-10-03: "yes, the desk may refuse a claim-done, on an item
    // without 'go' on record", "the actual contract is consumed between 'go' and 'done'". It replaces
    // goal/G2.13's "a claim consumes the Go" for that case. A goal takes the press as before (goal/G2.10).
    if (a.what === 'claim-done' && !it.goal && !it.go) throw notOffered('no Go is on record for ' + it.id + ', so nothing is claimable');
    // The group chat's anchor stays closed (goal/G3.10): nobody brings it back onto the List.
    if (a.what === 'bring-back' && it.id === GROUP_CHAT) throw notOffered('the group chat never comes back onto the List');
  };
}

// THE CURRENT GOAL, WHOLE, ONCE THE DESK SERVES (goal/G33.4). Andy, in the item's box: "a client that was away gets the
// current goal pushed whole again"; after this desk's own start every client is one that was away from it.
if (S.current) setImmediate(function () { pushGoalWhole(S.current); });
