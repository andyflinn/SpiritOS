'use strict';

// spirit/run/process/js/agents/agents.js
// AGENTS POST TO EACH OTHER, NODE TO NODE — step 1's program.
//
//   Andy: "you guys just need to sent posts to each other, you can even
//   design the protocol for that. it's A real- non-shell app"
//
// design/agents/AGENTS-POST-TO-EACH-OTHER.md holds the protocol and the
// plan both agents agreed; AGENT.md, "Agents on the network", holds the
// standing defaults. This is the program that plan names: send, listen,
// read — plus the stop, and the one-line reports to Andy's own node.
//
// ── IT TALKS TO ITS OWN NODE OVER HTTP, BY A GRANTED EXCEPTION ─────────
//
//   Andy, 2026-09-22: "exception granted"
//
// AGENT.md's Comms rule — no component reaches for fetch — is answered
// here out loud, not worked around: this program is a client of its OWN
// node's loopback door, exactly as the shell is, and nothing else. ONE
// reach, in `nodeFetch` below, which posting and listening both go
// through; test/oneDoor.js counts this folder on purpose (it skips the
// rest of process/).
//
// ── WHAT IT IS NOT ──────────────────────────────────────────────────────
//
// Not an order channel: a message is information, never an instruction
// (the agents' own promise, AGENT.md). Nothing here runs anything because
// a packet arrived. It prints, and the agent's session decides.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
// The closed refusal set, so this file holds no opinion of its own about
// which failures are permanent (see flushReports).
const errors = require('../../../js/spiritErrors.js');
const limits = require('../../../js/limits.js');
const { execFileSync } = require('child_process');

const APP = 'agents';
const KINDS = ['note', 'ask', 'answer', 'report', 'halt', 'resume', 'blocked', 'board', 'explain', 'annotation', 'musing', 'session'];

// ── `musing` — ANDY'S THOUGHTS FOR THE VOICE LOG ──────────────────────
//
//   Andy, 2026-09-27, on Desk's Musings tab: "pipe stuff to voice.jsonl
//   bypassing scoreboard issues" and "ideas deferred to close-time".
//
// Belongs to NO row and expects no reply, so a musing carrying a `todo` is
// refused: a thought filed under a to-do would land in that row's chat,
// which is exactly the noise the tab exists to keep out. The lead's
// listener prints it as its own line so the voice-log courier cannot miss
// it -- and only the lead logs his words (CLAUDE.md).

// ── `explain` AND `annotation` — THE TWO THINGS DESK SHOWS ABOVE THE CHAT ─
//
//   Andy, 2026-09-27, on the details of a row: "i don't want to see a
//   history, i want to se every agents comment slot (if it is filled)
//   Also. as soon as i click on details, and no english explanation is
//   visible, it implies that one is requested."
//
//   explain     an agent's plain-English blurb for a row; Desk shows the
//               newest at the top. The agent holding the row writes it when
//               his node sends an `ask` beginning "explain".
//   annotation  an agent's ONE comment slot on a row; the newest from each
//               agent wins, and superseded ones stay in the log. Andy: "one
//               slot for annotations, if all are filled, listen" and "you
//               may revise you annotation when your viewpoint changes".
//
// BOTH BELONG TO A ROW, so both are refused without a `todo`: a blurb for
// no row is a message nobody can place.
const NEEDS_TODO = ['explain', 'annotation'];

// ── `board` — THE SCOREBOARD, AS DATA, FOR ANDY'S DESK ───────────────
//
//   Andy, 2026-09-27, moving his UI to the agents app ahead of the shell
//   overhaul: "move it ahead." Decided in design/shell/AGENTS-UI.md: the
//   lead box posts SCOREBOARD.json to his node when it changes, `kind`
//   'board', no `todo`, the JSON in `text`, and Desk renders the newest.
//
// Refused at the sender unless `text` IS the board, for the reason every
// other kind here is: a Desk handed something that only claims to be a
// board would render garbage and nobody would know which side lied.

// ── `blocked` — WHAT STOPPED, IN A SHAPE THE LEAD CAN COLLATE ─────────
//
//   Andy, 2026-09-23, answering the bundle: *"3 decisions above: 1. yes.
//   2. yes. 3. yes."* — the first being this.
//
// AGENT.md already forbids waiting: an agent that meets something needing
// Andy finishes what it can, puts the decision in the digest, and returns
// to its node. What it had no way to say was WHAT it is parked on, in a
// form anything could sort — so blocks arrived as prose in a report, and
// Andy got two agents' obstacles unsorted in his window.
//
// The fields are wsl-claude's, taken verbatim rather than improved:
//
//   what   one plain sentence, written FOR ANDY — never the command
//   needs  decision | credential | permission | access | information
//   who    who can clear it: andy | lead | either
//   state  parked | abandoned | worked-around
//   since  when it started, ISO
//
// plus `re` from the envelope, so a block lands on the TASK that caused
// it rather than on the agent that hit it.
//
// `who` is the one that decides whether this is worth having. A digest
// that mixes "only Andy can clear this" with "the lead could have" hands
// him other people's work; a `who: lead` block never reaches him at all.
//
// `worked-around` is a real report, not an apology: an agent that got
// past a block still spent the hour, and the hour is the finding.
const NEEDS = ['decision', 'credential', 'permission', 'access', 'information'];
const WHO = ['andy', 'lead', 'either'];
const STATES = ['parked', 'abandoned', 'worked-around'];

// ── CONFIGURATION, FROM THE ENVIRONMENT ────────────────────────────────
//
// AGENTS_NODE     this agent's node door         (REQUIRED — no default)
// AGENTS_ROOT     that node's spirit/run         (default: this checkout's)
// AGENTS_SELF     this agent's name              (default claude-windows)
// AGENTS_PEERS    name=key,name=key              the other agents
// AGENTS_CONTROL  the key of the node Andy keeps; halt and resume are
//                 obeyed from it and nothing else, and reports go to it
// ── AGENTS_NODE HAS NO DEFAULT, AND THAT IS THE FIX ────────────────────
//
// It defaulted to http://127.0.0.1:65432, which is not "a node" — it is
// ANDY'S node, the one his shell and his apps use. So an agent that was
// never configured did not fail; it quietly spoke and listened on the
// human's door, and every message a peer sent to the agent's own node sat
// unread.
//
// MEASURED, not imagined (2026-09-23): wsl-claude's review verdict was
// delivered to claude-windows on port 45440 and read as missing, because
// this agent was reading 65432. Nothing errored. A default that is wrong
// and silent costs more than no default at all.
//
// So it is refused here, at the sender, where the mistake is and where it
// costs one failed command — the same rule cycle 10's R19 applies to an
// empty send. The message names the variable and the door, because an
// agent that cannot find its own node cannot ask anybody.
function config(env) {
  const e = env || process.env;
  const node = String(e.AGENTS_NODE || '').trim();
  if (!node) {
    throw new Error(
      'AGENTS_NODE is not set. An agent talks on its OWN node, never on ' +
      "Andy's (http://127.0.0.1:65432). Set AGENTS_NODE, and AGENTS_ROOT " +
      'to that node\'s spirit/run.');
  }
  return {
    node: node,
    root: e.AGENTS_ROOT || path.resolve(__dirname, '..', '..', '..'),
    self: e.AGENTS_SELF || 'claude-windows',
    peers: parsePeers(e.AGENTS_PEERS || ''),
    control: String(e.AGENTS_CONTROL || '').trim(),
    retryMs: Number(e.AGENTS_RETRY_MS) >= 0 && e.AGENTS_RETRY_MS !== undefined
      ? Number(e.AGENTS_RETRY_MS) : 5 * 60 * 1000,
  };
}

function parsePeers(s) {
  const out = Object.create(null);
  String(s || '').split(',').forEach(function (pair) {
    const i = pair.indexOf('=');
    if (i <= 0) return;
    const name = pair.slice(0, i).trim();
    const key = pair.slice(i + 1).trim();
    if (name && key) out[name] = key;
  });
  return out;
}

// A name from AGENTS_PEERS, the word "control", or a key given as is.
function resolvePeer(cfg, to) {
  if (to === 'control') return cfg.control;
  return cfg.peers[to] || to;
}

// ── THE ENVELOPE — protocol v1 ─────────────────────────────────────────
// ── `todo` — WHICH ROW OF THE BOARD THIS MESSAGE BELONGS TO ─────────
//
// Decided in design/shell/AGENTS-UI.md: the FULL id (area/number, e.g.
// cycle-10/R13), never a short handle — a handle is the shortest form
// unique TODAY and can lengthen, and a thread keyed on it would lose its
// row. `re` keeps its one meaning. Refused here if it is not a full id.
const TODO_ID = /^[^\s{},\/]+\/[^\s{},\/]+$/;

function makeEnvelope(from, kind, text, re, idFn, block, todo) {
  if (KINDS.indexOf(kind) === -1) throw new Error('unknown kind: ' + kind);
  if (todo !== undefined && todo !== null && todo !== '' && !TODO_ID.test(String(todo))) {
    throw new Error('todo must be a full to-do id like cycle-10/R13, not ' + JSON.stringify(todo));
  }
  if (NEEDS_TODO.indexOf(kind) !== -1 && !todo) {
    throw new Error('a ' + kind + ' belongs to a row — give it --todo <full id>');
  }
  if (kind === 'musing' && todo) {
    throw new Error('a musing belongs to no row — send it without --todo');
  }
  // ── AND NOTHING EMPTY LEAVES (cycle 10's R19) ───────────────────────
  //
  // Found by being committed: wsl-claude piped a cleared scratchpad into a
  // send and it went — a post, a route and a receipt spent carrying
  // nothing, and a peer given an empty message to make sense of. A
  // `blocked` already refuses a missing `what` at the sender for the same
  // reason: an agent that believes it has reported and has not is worse
  // off than one that was told no.
  //
  // AT THE SENDER, where the mistake is, and where the fix costs one
  // failed command rather than a message nobody can answer.
  // THREE KINDS CARRY THEIR MEANING SOMEWHERE ELSE and are exempt:
  // `halt` and `resume` are control verbs whose whole content is the kind,
  // and a `blocked` says what it needs in `block.what`, which is refused
  // below if it is missing. Everything else is somebody talking, and
  // somebody talking with nothing to say is the defect.
  const CARRIES_NO_TEXT = ['halt', 'resume', 'blocked'];
  if (CARRIES_NO_TEXT.indexOf(kind) === -1 && !String(text || '').trim()) {
    throw new Error('a send with no text is refused — ' + kind + ' needs something to say');
  }
  // THE DESIGN SESSION'S ITEM, filled by the lead as the Team chat goes.
  // Andy, 2026-09-28: "the team chat will have at the top a blank requirement
  // bubble. while we chat, lead fills the fields in that requirement. first
  // line is the ID and the title. blow it is a short discription i define",
  // then the list of what he requires before it is done, each "an item that
  // blocks the title item". Refused at the sender unless it has that shape:
  // { goal: { id, title, description }, items: [ { id, title, blocks? } ] },
  // where blocks names the item (or the goal, when absent) it must come before.
  if (kind === 'session') {
    let parsed = null;
    try { parsed = JSON.parse(String(text || '')); } catch (e) { parsed = null; }
    if (!parsed || !parsed.goal || !parsed.goal.id || !parsed.goal.title || !Array.isArray(parsed.items)) {
      throw new Error('a session must be JSON: { goal: { id, title, description }, items: [ { id, title } ] }');
    }
  }
  if (kind === 'board') {
    let parsed = null;
    try { parsed = JSON.parse(String(text || '')); } catch (e) { parsed = null; }
    if (!parsed || !Array.isArray(parsed.rows)) {
      throw new Error('a board must be the scoreboard JSON, with a rows array');
    }
  }
  const env = {
    app: APP, v: 1,
    id: (idFn || function () { return crypto.randomBytes(12).toString('hex'); })(),
    body: { from: String(from), kind: kind, text: String(text || '') },
  };
  if (re) env.re = String(re);
  if (todo) env.body.todo = String(todo);
  if (kind === 'blocked') {
    // REFUSED AT THE SENDER, not tidied there. A block with a `needs` or a
    // `who` nobody can read would be sorted into the wrong pile of Andy's
    // digest, or silently into none — worse than not sending it, because
    // the agent believes it has reported.
    const b = block || {};
    const one = function (name, value, allowed) {
      const v = String(value || '').trim().toLowerCase();
      if (allowed.indexOf(v) === -1) {
        throw new Error('blocked needs ' + name + ' to be one of ' + allowed.join(' | ') + ', got ' + JSON.stringify(value));
      }
      return v;
    };
    if (!String(b.what || '').trim()) throw new Error('blocked needs `what`: one plain sentence, written for Andy');
    env.body.block = {
      what: String(b.what).trim(),
      needs: one('needs', b.needs, NEEDS),
      who: one('who', b.who, WHO),
      state: one('state', b.state || 'parked', STATES),
      since: b.since || new Date().toISOString(),
    };
  }
  return env;
}

// ── ONE LINE, AND NOTHING MORE ───────────────────────────────────────
//
// wsl-claude, agreeing the split: "when you build it, print a block as
// `<who> | <needs> | <what>` and nothing more — if the one-line form is
// right, my digest is assembly, and if it is wrong no digest can rescue
// it." So the listener prints exactly that, and the digest page under
// design/agents/ says what the lead does with a set of them.
function blockLine(env) {
  const b = (env && env.body && env.body.block) || {};
  return [b.who, b.needs, b.what].join(' | ');
}

// ── THE STOP — soft half; the hard half is Andy's relay ─────────────────
//
// A flag in the node's own relay-state. Set only by a `halt` from the
// control key, cleared only by a `resume` from it — never by another
// agent. Before the agents have nodes of their own the control key IS the
// node this program runs on, and a halt from it would be indistinguishable
// from the agent itself; which is why the plan puts the nodes first.
function haltPath(cfg) { return path.join(cfg.root, 'relay-state', 'agents-halt.json'); }

function halted(cfg) {
  try { return JSON.parse(fs.readFileSync(haltPath(cfg), 'utf8')); } catch (e) { return null; }
}

// ── A CONTROL MESSAGE IS OBEYED ONCE, AND A REPLAY IS KNOWN BY ITS ID ───
//
// The node holds a packet that arrived while nobody listened and hands it
// to the next listener (arrivals.js) — the catch-up is right, a message
// sent while a listener was down must not be lost. But a halt or resume
// handed over AGAIN is old news, and obeying it as new would let a restart
// re-halt on a halt Andy already lifted. Found by wsl-claude over this
// channel, 2026-09-22.
//
// NOT BY THE CLOCK. This compared the message's time with the last one
// applied, and wsl-claude found the flaw the same day: two messages in one
// millisecond made a resume "stale", and a clock that steps BACK (NTP, a
// WSL resume) would make a LATER halt look older and be ignored — the
// agent running on after Andy stopped it. Andy's stop must not depend on
// two clocks agreeing. So the envelope's own id is the test: the ids of
// the control messages applied are kept (the newest CONTROL_MEMORY), a
// seen id is a replay and reported 'stale', and every new one is obeyed
// in the order it arrives.
var CONTROL_MEMORY = 256;

function controlPath(cfg) { return path.join(cfg.root, 'relay-state', 'agents-control.json'); }

function appliedControlIds(cfg) {
  try {
    var ids = JSON.parse(fs.readFileSync(controlPath(cfg), 'utf8')).ids;
    return Array.isArray(ids) ? ids : [];
  } catch (e) { return []; }
}

function obeyControl(cfg, fromKey, env, atIso) {
  if (!env || env.app !== APP || !env.body) return null;
  const kind = env.body.kind;
  if (kind !== 'halt' && kind !== 'resume') return null;
  if (!cfg.control || fromKey !== cfg.control) return 'ignored';
  const at = atIso || new Date().toISOString();
  const id = typeof env.id === 'string' ? env.id : '';
  const ids = appliedControlIds(cfg);
  if (id && ids.indexOf(id) !== -1) return 'stale';
  if (id) ids.push(id);
  fs.mkdirSync(path.dirname(controlPath(cfg)), { recursive: true });
  fs.writeFileSync(controlPath(cfg), JSON.stringify({
    at: at, kind: kind, ids: ids.slice(-CONTROL_MEMORY),
  }));
  if (kind === 'halt') {
    fs.writeFileSync(haltPath(cfg), JSON.stringify({ at: at, text: env.body.text || '' }));
    return 'halted';
  }
  try { fs.unlinkSync(haltPath(cfg)); } catch (e) { /* not halted */ }
  return 'resumed';
}

// ── THE ONE DOOR ────────────────────────────────────────────────────────
// THE ONE REACH, written so test/oneDoor.js SEES it. `(fetchFn || fetch)(…)`
// would do the same and slip past the roll's pattern — which would be
// working around the exception instead of taking it. A suite passes its
// own function; everything else goes through this line.
function nodeFetch(cfg, pathname, init, fetchFn) {
  if (typeof fetchFn === 'function') return fetchFn(cfg.node + pathname, init);
  return fetch(cfg.node + pathname, init);
}

function post(cfg, toKey, env, fetchFn) {
  return nodeFetch(cfg, '/api/spirit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verb: 'peer.post', to: toKey, text: JSON.stringify(env) }),
  }, fetchFn).then(function (r) {
    return r.text().then(function (t) {
      let body = null;
      try { body = JSON.parse(t); } catch (e) { body = { error: t }; }
      return { status: r.status, body: body || {} };
    });
  });
}

// ── ASKING ANDY'S DESK SERVER (desk/G2.8) ──────────────────────────────
//
//   Andy: "lead: 1 and 2 agreed." The box: a claim, a box write, a check are
//   writes, not text lines, and "Agents read state over peerPost with the
//   same verbs the List reads (apiDoor.answer)".
//
// One 'api' packet {desk: {<verb>: args}} to his node, through this node's
// peer.post, and its answer is the 'api' packet that comes back down this
// node's own stream with re = that post's hash. The stream is opened before
// the post, so an answer quicker than the post's own reply is not missed.
// `by` IS ALWAYS THIS AGENT: his node's apiDoor refuses a member writing as
// andy, and one given here is replaced rather than sent to be refused.
const packet = require('../../../js/client/packet');
const DESK_WAIT_MS = 30000;
// The desk server's writes, each carrying who wrote it; every other verb takes
// no `by` and refuses one.
// DESK_WRITES STOOD HERE and set `by` on every write — gone with
// apiAuth/G1.13: the desk takes its writer from the verified key the
// door forwards, and a by argument is refused no-such-argument. Nobody
// names their own writer any more.
function deskAsk(cfg, verb, json, fetchFn) {
  let args = {};
  if (json) {
    try { args = JSON.parse(json); } catch (e) { return Promise.reject(new Error('the args are not JSON: ' + e.message)); }
    if (!args || typeof args !== 'object' || Array.isArray(args)) return Promise.reject(new Error('the args must be a JSON object'));
  }
  // No verb carries `by` since apiAuth/G1.13; one that slipped in from an
  // old caller is stripped rather than sent to be refused.
  delete args.by;
  if (!verb) return Promise.reject(new Error('usage: agents.js desk <verb> [json]'));
  // HALTED MEANS SILENT, as for send(): a desk write is a post like any other.
  const h = halted(cfg);
  if (h) return Promise.resolve({ ok: false, halted: true, error: 'halted by Andy at ' + h.at + ' — nothing is sent until he resumes' });
  if (!cfg.control) return Promise.reject(new Error('AGENTS_CONTROL is not set: no node of Andy\'s to ask'));
  const ask = { desk: {} };
  ask.desk[verb] = args;
  // THE KNOT LIVES IN kernel.js NOW (fileTransfer goal/G1.3; Andy: "should
  // be done via the spirit object, no?"): spirit.peerPost posts and awaits
  // the answer whose re matches, the one copy for every process. This file
  // only translates its two transport outcomes into the errors callers
  // already handle; a desk refusal ({ok: false, code}) passes through.
  return require('../../../js/kernel.js').peerPost(cfg.control, 'api', ask, { node: cfg.node, waitMs: DESK_WAIT_MS }).then(function (got) {
    if (got && got.ok === false && got.code === 'not-posted') throw new Error('not posted: ' + (got.error || ''));
    if (got && got.ok === false && got.code === 'no-answer') throw new Error('no answer from Andy\'s desk server in ' + DESK_WAIT_MS / 1000 + ' s');
    return got;
  });
}

function commitOf(cfg) {
  try {
    return execFileSync('git', ['-C', cfg.root, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch (e) { return '?'; }
}

// ── REPORTS — THE WHOLE MESSAGE, TO THE NODE ANDY KEEPS ────────────────
//
//   Andy, 2026-09-27: "yeah, my node should contain the overall record of
//   our activities."
//
// A report was a 100-character gist in prose, with "the full message stays
// in the logs" — the SENDER's logs, which is exactly where his record was
// not. It is now the message itself, as data, so his node holds what we
// said to each other and Desk can show it under the row it belongs to.
// `outcome` keeps its old wording ("delivered", "undelivered: <why>").
function reportOf(self, toName, toKey, env, outcome, hash, commit) {
  const b = env.body || {};
  return JSON.stringify({
    v: 1, from: String(self), to: String(toName), toKey: String(toKey || ''),
    kind: b.kind, text: b.text || '', todo: b.todo || null,
    re: env.re || null, id: env.id, hash: hash || null,
    outcome: String(outcome), commit: String(commit),
  });
}

// WHAT A REPORT OF THIS MESSAGE WOULD WEIGH, before anything is sent. The
// report carries the whole text escaped once more inside its envelope, so
// a message near the limit makes a report that cannot travel. That is
// refused HERE, at the sender, with the numbers: nothing reaches a peer
// that could not also reach Andy's record, and nothing is cut to fit.
//
// MEASURED AGAINST THE COMPOSER'S LIMIT, limits.PLAINTEXT_MAX — "what a
// composer may BUILD" — and nothing below the node. The report's text is
// measured ESCAPED, so it is held to the stricter of the two: whatever
// passes here passes the node's own check, and this file keeps no opinion
// about what the node does to a packet afterwards (sealedLayering.js).
const REPORT_PROBE_OUTCOME = 'undelivered: ' + 'x'.repeat(240);
function reportFits(cfg, toName, toKey, env) {
  const probe = makeEnvelope(cfg.self, 'report',
    reportOf(cfg.self, toName, toKey, env, REPORT_PROBE_OUTCOME, 'f'.repeat(64), 'ffffffff'));
  const bytes = Buffer.byteLength(JSON.stringify(JSON.stringify(probe)), 'utf8');
  return { fits: bytes <= limits.PLAINTEXT_MAX, bytes: bytes };
}

// WOULD ANDY'S DESK KEEP IT (slim/G1.2 T5)? His desk server refuses a line
// that could not come back in one answer (line-too-large), after the peer
// has already said ok. So the sender is told first: the line his Desk would
// store, in its larger (reported) shape, measured as the desk server
// measures it (desk.js fitsOneAnswer), against the same room.
const DESK_ROOM = require('../../../js/appClient.js').ANSWER_MAX - 512;
function deskLineFits(cfg, toName, env) {
  const b = (env && env.body) || {};
  const line = {
    key: 'f'.repeat(64), at: new Date().toISOString(), dir: 'in', peer: ownKey(cfg) || '', outcome: 'received',
    from: String(b.from || cfg.self || ''), to: String(toName || ''), kind: String(b.kind || ''),
    text: String(b.text || ''), todo: b.todo ? String(b.todo) : '', reported: true,
  };
  const bytes = Buffer.byteLength(JSON.stringify({ items: [{ key: line.key, label: JSON.stringify(line) }], more: false }), 'utf8');
  return { fits: bytes <= DESK_ROOM, bytes: bytes };
}

function outboxPath(cfg) { return path.join(cfg.root, 'relay-state', 'agents-outbox.jsonl'); }

// ── THE AGENTS' OWN LOG ─────────────────────────────────────────────────
//
//   Andy, 2026-09-27: "they must keep their own logs", then "after
//   correcting agents and desk, we will remove the new verb" (node.history,
//   which went into the node's interface for an app, without his approval).
//
// So this program writes down what it sends and what its listener hears,
// and `read` reads that and nothing of the node's. The node's traffic.jsonl
// is the node's; no path in this file names it (agentsApp.js checks).
//
// One row per event: { at, dir, peer, key, hash, env, outcome }. `key` is
// what the reader folds on: an 'out' row's is the envelope id, because a
// send that never went has no hash and would otherwise merge with every
// other failed send (claude-windows' catch); an 'in' row's is its hash.
//
// UNBOUNDED, for now: a local file that nothing sends anywhere. Its bound is
// its own to-do, agreed with claude-windows.
function logPath(cfg) { return path.join(cfg.root, 'relay-state', 'agents-log.jsonl'); }

function logRow(cfg, row) {
  try {
    fs.mkdirSync(path.dirname(logPath(cfg)), { recursive: true });
    fs.appendFileSync(logPath(cfg), JSON.stringify(row) + '\n');
  } catch (e) { /* the message went or arrived either way; the log is best effort */ }
}

// A report that could not land is kept, and sent the next time anything
// is (the plan: "your node down: the program keeps the reports and sends
// them when your node is back").
function queueReport(cfg, line) {
  fs.mkdirSync(path.dirname(outboxPath(cfg)), { recursive: true });
  fs.appendFileSync(outboxPath(cfg), JSON.stringify({ line: line }) + '\n');
}

function flushReports(cfg, fetchFn, ownKey) {
  if (!cfg.control || cfg.control === ownKey) return Promise.resolve(0);
  let rows = [];
  try { rows = fs.readFileSync(outboxPath(cfg), 'utf8').split('\n').filter(Boolean); } catch (e) { return Promise.resolve(0); }
  const left = [];
  const dropped = [];
  let sent = 0;
  return rows.reduce(function (p, row) {
    return p.then(function () {
      let line; try { line = JSON.parse(row).line; } catch (e) { return; }
      return post(cfg, cfg.control, makeEnvelope(cfg.self, 'report', line), fetchFn)
        .then(function (r) {
          // A 200 is a reply ARRIVING; the verdict is inside it (see send). If
          // Andy's node rotates its key, every queued report comes back "this
          // did not open for me" inside a 200 -- and would have been counted
          // as sent and deleted.
          if (r.status === 200) {
            const verdict = peerVerdict(r.body && r.body.text);
            if (!verdict || verdict.ok !== false) { sent++; return; }
            r = { status: Number(verdict.status) || 400, body: { error: verdict.error || 'refused' } };
          }
          // ── A REFUSAL WAITING CANNOT FIX IS NOT STILL OWED ──────────
          //
          //   Andy, 2026-09-26: "the agent app is special, a post is
          //   implicitely coupled with a delete in the sent-log."
          //
          // The sent-log is what is STILL OWED, so a row that can never
          // be delivered does not belong in it. 158 rows became 11,628
          // refusals because `no cipher key for that peer` — a fact
          // about the destination — was re-posted on every send exactly
          // like a 503.
          //
          // THE JUDGEMENT IS THE CATALOGUE'S, NOT THIS FILE'S. A second
          // opinion here about which failures are permanent is the
          // duplication the whole week has been about.
          const said = errors.classify(r.status,
            (r.body && (r.body.error || r.body.message)) || '', r.body || {});
          // AND "UNKNOWN" IS NOT A VERDICT. Its own note says it
          // "deliberately claims nothing" — yet it carries retry 'no',
          // so `retry === 'no'` alone would DISCARD EVERY UNRECOGNISED
          // FAILURE, silently, including transient ones. Reading silence
          // as a ruling is how a fix becomes data loss. Drop only when
          // the catalogue NAMES the code and says waiting will not help.
          if (said && said.code !== 'unknown' && said.retry === 'no') {
            dropped.push({ code: said.code, status: r.status });
            return;
          }
          left.push(row);
        })
        .catch(function () { left.push(row); });
    });
  }, Promise.resolve()).then(function () {
    fs.writeFileSync(outboxPath(cfg), left.map(function (r) { return r + '\n'; }).join(''));
    // SAID OUT LOUD, because a queue that empties itself quietly is the
    // same blindness as one that grows quietly. trafficLog already holds
    // each refusal with its payload, so nothing is lost — but nobody
    // reads a log they were not told to look at.
    if (dropped.length) {
      const by = Object.create(null);
      dropped.forEach(function (d) { by[d.code] = (by[d.code] || 0) + 1; });
      console.log('agents: ' + dropped.length + ' pending report(s) dropped as undeliverable — ' +
        Object.keys(by).map(function (c) { return by[c] + ' x ' + c; }).join(', ') +
        '. The refusal and its payload are in the traffic log.');
    }
    return sent;
  });
}

function ownKey(cfg) {
  try { return JSON.parse(fs.readFileSync(path.join(cfg.root, 'relay-state', 'identity.json'), 'utf8')).publicKey; }
  catch (e) { return ''; }
}

// ── SEND ────────────────────────────────────────────────────────────────
//
// Refused while halted. A 503 from the relay (peer not reachable, busy) is
// retried with a growing wait for up to retryMs, because the core makes
// one attempt (R40 is outside the core). A refusal by THIS node — a 4xx —
// is returned at once and said out loud: the node's log keeps no row for
// it, so this is the only place it is visible.
// The peer's reply, as it wrote it: `{ v, body: { ok, status, error } }`.
// Anything unparseable is not a verdict, and a plain receipt has none.
function peerVerdict(text) {
  if (typeof text !== 'string' || !text) return null;
  try {
    const said = JSON.parse(text);
    return said && said.body && typeof said.body === 'object' && 'ok' in said.body ? said.body : null;
  } catch (e) { return null; }
}

function send(cfg, to, kind, text, re, opts) {
  const o = opts || {};
  const fetchFn = o.fetch;
  const sleep = o.sleep || function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  const now = o.now || Date.now;
  const toKey = resolvePeer(cfg, to);
  const isControlVerb = kind === 'halt' || kind === 'resume';

  const h = halted(cfg);
  // HALTED MEANS SILENT — halt and resume included, unless this IS the node
  // Andy keeps. The exemption was for his node only; as first written it let
  // a halted agent still post control kinds (harmless, since nobody obeys
  // them from an agent's key, but not "stops posting"). Found by wsl-claude.
  if (h && !(isControlVerb && cfg.control && ownKey(cfg) === cfg.control)) {
    return Promise.resolve({ ok: false, halted: true, error: 'halted by Andy at ' + h.at + ' — nothing is sent until he resumes' });
  }
  if (!toKey) return Promise.resolve({ ok: false, error: 'no key for ' + to });

  // A REFUSAL IS AN ANSWER, NOT A THROW. makeEnvelope refuses by throwing,
  // and send used to let that escape — so a bad `todo` or a malformed
  // `blocked` crashed the caller instead of being told no, and a caller
  // awaiting the promise never heard anything at all. Found by the suite
  // that tests the todo refusal: it stopped mid-run with no summary.
  let env;
  try { env = makeEnvelope(cfg.self, kind, text, re, null, o.block, o.todo); }
  catch (e) { return Promise.resolve({ ok: false, error: e.message, refused: true }); }
  if (!isControlVerb && kind !== 'report' && kind !== 'board') {
    const d = deskLineFits(cfg, to, env);
    if (!d.fits) {
      return Promise.resolve({ ok: false, error: 'too long for one answer on Andy\'s Desk (its line would be ' +
        d.bytes + ' bytes, over ' + DESK_ROOM + ') — split it into shorter messages', tooLong: true });
    }
  }
  const mine0 = ownKey(cfg);
  // NOT WHEN THE MESSAGE IS ALREADY HIS. A message sent TO Andy's node is in
  // his record as itself; a report of it made a second copy of every answer
  // he was sent, and Desk showed both. Found by claude-windows reading his
  // own 00:56:06 answer twice in one thread.
  const reported = kind !== 'report' && kind !== 'board' && !isControlVerb && cfg.control &&
    cfg.control !== mine0 && toKey !== cfg.control;
  if (reported) {
    const f = reportFits(cfg, to, toKey, env);
    if (!f.fits) {
      return Promise.resolve({ ok: false, error: 'too long to be recorded on Andy\'s node (its report would be ' +
        f.bytes + ' bytes, over ' + limits.PLAINTEXT_MAX + ') — split it into shorter messages', tooLong: true });
    }
  }
  const deadline = now() + cfg.retryMs;
  let wait = 5000;

  function attempt() {
    return post(cfg, toKey, env, fetchFn).then(function (r) {
      // A 200 MEANS A REPLY ARRIVED, NOT THAT THE PEER TOOK THE MESSAGE. The
      // peer's own verdict is the body of its reply, in r.body.text; one that
      // says ok:false -- "this did not open for me", after it rotated its key
      // -- was being reported "delivered". Found by cardRotation.js, where
      // peerPost's staleCard had the same blind spot one layer down.
      if (r.status === 200) {
        const verdict = peerVerdict(r.body && r.body.text);
        if (verdict && verdict.ok === false) {
          return { ok: false, status: Number(verdict.status) || 400, hash: r.body.hash,
            error: verdict.error || 'refused by the peer', byPeer: true };
        }
        return { ok: true, status: 200, hash: r.body.hash, receipt: !!r.body.receipt };
      }
      if (r.status === 503 && now() + wait <= deadline) {
        return sleep(wait).then(function () { wait = Math.min(wait * 2, 60000); return attempt(); });
      }
      return {
        ok: false, status: r.status, hash: r.body.hash, error: r.body.error || 'refused',
        byNode: r.status >= 400 && r.status < 500,
      };
    });
  }

  return attempt().then(function (result) {
    logRow(cfg, {
      at: new Date(now()).toISOString(), dir: 'out', peer: toKey, key: env.id, hash: result.hash || null, env: env,
      outcome: result.ok ? 'delivered' : 'undelivered: ' + (result.error || 'refused'),
    });
    const mine = ownKey(cfg);
    // A BOARD IS NOT REPORTED: it is already addressed to Andy's node, and
    // a report of it would be a second copy of the same fact in his log.
    if (reported) {
      const outcome = result.ok ? 'delivered' : 'undelivered: ' + result.error + (result.byNode ? ' (refused by my own node — not in any log)' : '');
      queueReport(cfg, reportOf(cfg.self, to, toKey, env, outcome, result.hash, commitOf(cfg)));
      return flushReports(cfg, fetchFn, mine).then(function () { return result; });
    }
    return result;
  });
}

// ── READ — the conversation, from the agents' OWN log ───────────────────
//
// Rows are folded by `key`, and the LAST outcome for a key is the one
// shown, so a message recorded twice reads once. It used to read the
// node's traffic.jsonl, which is the node's record and not this program's.
function conversation(lines, peerKey) {
  const byKey = Object.create(null);
  const order = [];
  lines.forEach(function (l) {
    let row; try { row = JSON.parse(l); } catch (e) { return; }
    if (!row || !row.key || !row.env || row.env.app !== APP) return;
    if (peerKey && row.peer !== peerKey) return;
    let entry = byKey[row.key];
    if (!entry) { entry = byKey[row.key] = { key: row.key }; order.push(entry); }
    entry.at = row.at; entry.dir = row.dir; entry.peer = row.peer; entry.env = row.env;
    entry.hash = row.hash || entry.hash || '';
    if (row.outcome) entry.outcome = row.outcome;
  });
  return order;
}

function read(cfg, peerName, n) {
  let lines = [];
  try { lines = fs.readFileSync(logPath(cfg), 'utf8').split('\n').filter(Boolean); }
  catch (e) { return []; }
  const key = peerName ? resolvePeer(cfg, peerName) : '';
  return conversation(lines, key).slice(-(n || 20));
}

function formatEntry(e) {
  const b = (e.env && e.env.body) || {};
  // A board is kilobytes of JSON; one line says what it is. Computed for
  // display only — the entry itself is left as it arrived.
  let shown = b.text || '';
  if (b.kind === 'board') {
    let n = '?';
    try { n = JSON.parse(b.text).rows.length; } catch (x) { /* shown as ? */ }
    shown = 'the scoreboard, ' + n + ' rows';
  }
  return e.at + ' ' + (e.dir === 'in' ? '<-' : '->') + ' ' + (b.from || '?') + ' ' + (b.kind || '?') +
    ' [' + e.outcome + '] ' + String(e.hash).slice(0, 12) +
    (e.env && e.env.re ? ' re ' + String(e.env.re).slice(0, 12) : '') + '\n    ' + shown;
}

// ── LISTEN — every arriving agents packet, one line each ────────────────
function listen(cfg, onLine, fetchFn) {
  return nodeFetch(cfg, '/api/events', {}, fetchFn).then(function (r) {
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    onLine('listening on ' + cfg.node + ' as ' + cfg.self + (halted(cfg) ? ' — HALTED' : ''));
    function pump() {
      return reader.read().then(function (chunk) {
        if (chunk.done) { onLine('stream closed'); return; }
        buf += dec.decode(chunk.value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) !== -1) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2);
          const ev = /event: (.*)/.exec(block); const da = /data: (.*)/.exec(block);
          if (!ev || ev[1] !== 'packet' || !da) continue;
          let msg; try { msg = JSON.parse(da[1]); } catch (e) { continue; }
          let env = null; try { env = JSON.parse(msg.text); } catch (e) { continue; }
          if (!env || env.app !== APP) continue;
          // WRITTEN DOWN BEFORE ANYTHING IS DONE WITH IT, Andy's messages
          // included: "so your end needs to store my messages on their own."
          logRow(cfg, {
            at: String(msg.sentAt || msg.at || new Date().toISOString()), dir: 'in', peer: String(msg.from || ''),
            key: String(msg.hash || env.id || ''), hash: String(msg.hash || ''), env: env, outcome: 'received',
          });
          // `at` is when this node received it — a replayed packet keeps
          // its own time, which is what lets a stale halt be told apart.
          const control = obeyControl(cfg, msg.from, env, msg.sentAt || msg.at);
          const b = env.body || {};
          // A BLOCK PRINTS AS ONE LINE AND NOTHING MORE. The form is
          // wsl-claude's: `<who> | <needs> | <what>`, so a lead watching
          // its listener can lift blocks straight into Andy's digest
          // without reading prose for them. Everything else keeps the
          // conversational shape it has always had.
          // A DECISION FROM ANDY ON A DEPENDENCY IS ITS OWN LINE, so the lead
          // watching its listener cannot read past it: his accept or reject
          // is what makes the board re-rank. Andy: "a re-shuffeling of the
          // board triggers a reload of the board. (mostly cause by accepting
          // dependencies)".
          if (b.kind === 'answer' && /^dependency\//.test(String(b.todo || ''))) {
            onLine('AGENTS DECISION ' + (b.from || '?') + ' ' + String(b.text || '').trim() + ' on ' + b.todo);
          }
          // HIS REQUEST FOR AN EXPLANATION, as its own line: the agent holding
          // the row answers it with kind `explain`, and it is the one line
          // that asks for writing rather than for work.
          if (b.kind === 'ask' && b.todo && /^\s*explain/i.test(String(b.text || ''))) {
            onLine('AGENTS EXPLAIN-REQUEST ' + (b.from || '?') + ' on ' + b.todo);
          }
          // HIS MUSING, as its own line: the lead's courier to voice.jsonl
          // reads it here, and it needs no answer.
          if (b.kind === 'musing') {
            onLine('AGENTS MUSING ' + (b.from || '?') + ': ' + String(b.text || '').replace(/\s+/g, ' '));
          }
          let said = b.kind === 'blocked' ? blockLine(env) : String(b.text || '').replace(/\s+/g, ' ');
          if (b.kind === 'board') {
            let n = '?';
            try { n = JSON.parse(b.text).rows.length; } catch (x) { /* shown as ? */ }
            said = 'the scoreboard, ' + n + ' rows';
          }
          onLine('AGENTS ' + (b.from || '?') + ' ' + (b.kind || '?') +
            (env.re ? ' re ' + String(env.re).slice(0, 12) : '') +
            (b.todo ? ' todo ' + b.todo : '') +
            (control ? ' [' + control + ']' : '') + ': ' + said);
        }
        return pump();
      });
    }
    return pump();
  });
}

module.exports = {
  config: config, parsePeers: parsePeers, resolvePeer: resolvePeer,
  makeEnvelope: makeEnvelope, halted: halted, obeyControl: obeyControl,
  send: send, conversation: conversation, read: read, formatEntry: formatEntry,
  reportOf: reportOf, reportFits: reportFits, flushReports: flushReports, listen: listen, deskAsk: deskAsk,
  TODO_ID: TODO_ID,
  KINDS: KINDS, NEEDS: NEEDS, WHO: WHO, STATES: STATES, blockLine: blockLine,
};

// ── THE COMMAND LINE ────────────────────────────────────────────────────
//
//   node agents.js send <to> <note|ask|answer> <text…> [--re <hash>] [--todo <area/number>]
//   node agents.js blocked <to> <needs> <who> [--state <s>] <what…>
//   node agents.js chatter <to> [n] [--every <ms>]   a batch, to watch
//   node agents.js halt <to> [reason…]      (Andy's node only)
//   node agents.js resume <to>              (Andy's node only)
//   node agents.js listen
//   node agents.js read [peer] [n]
//   node agents.js status
//   node agents.js verb <verb> [arg]        any loopback verb on its own node (desk/G1.13)
//   node agents.js desk <verb> [json]       Andy's desk server, by an api packet (desk/G2.8)
if (require.main === module) {
  const cfg = config();
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  // FLAGS COME OUT WHEREVER THEY SIT, not only at the end.
  function flag(name) {
    const at = argv.indexOf(name);
    if (at === -1) return '';
    const v = argv[at + 1] || '';
    argv.splice(at, 2);
    return v;
  }
  const re = flag('--re');
  const todo = flag('--todo');
  const rest = argv;
  const done = function (r) { console.log(JSON.stringify(r)); process.exit(r && r.ok ? 0 : 1); };
  if (cmd === 'verb') {
    // ── THE ONE STANDARD WAY IN (desk/G1.13) ─────────────────────────
    //
    //   Andy: "agents should use a standard helper script to access the
    //   loopback api of their node and the resident app-servers, no?"
    //
    // node agents.js verb <verb> [arg]: any loopback verb, jobs.api
    // included, so a node's server processes are reached the same way.
    // Through nodeFetch, the one reach this file has; no new door. An object
    // arg is merged into the body; anything else is its 'ask' (JSON when it
    // parses), so 'verb jobs.api api' asks every server process for api.
    const body = { verb: String(rest[1] || '') };
    if (rest.length > 2) {
      const raw = rest.slice(2).join(' ');
      let arg = raw;
      try { arg = JSON.parse(raw); } catch (e) { arg = raw; }
      if (arg && typeof arg === 'object' && !Array.isArray(arg)) Object.assign(body, arg);
      else body.ask = arg;
    }
    nodeFetch(cfg, '/api/spirit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(function (r) {
      return r.text().then(function (t) {
        let out = null;
        try { out = JSON.parse(t); } catch (e) { out = { error: t }; }
        console.log(JSON.stringify(out));
        process.exit(r.status >= 200 && r.status < 300 ? 0 : 1);
      });
    }, function (e) { console.log(JSON.stringify({ error: e.message })); process.exit(1); });
  } else if (cmd === 'desk') {
    // node agents.js desk <verb> [json]: Andy's desk server, by an api packet.
    deskAsk(cfg, String(rest[1] || ''), rest.slice(2).join(' ')).then(function (body) {
      console.log(JSON.stringify(body));
      process.exit(body && body.ok === false ? 1 : 0);
    }, function (e) { console.log(JSON.stringify({ ok: false, error: e.message })); process.exit(1); });
  } else if (cmd === 'send') {
    send(cfg, rest[1], rest[2], rest.slice(3).join(' '), re, { todo: todo }).then(done, function (e) { done({ ok: false, error: e.message }); });
  } else if (cmd === 'blocked') {
    // node agents.js blocked <to> <needs> <who> [--state s] <what…>
    //
    // The order is the digest's order — who can clear it and what kind of
    // thing it is come before the sentence, because that is how the lead
    // sorts them and how the agent should be thinking about it.
    const stateAt = rest.indexOf('--state');
    const words = stateAt !== -1 ? rest.slice(0, stateAt).concat(rest.slice(stateAt + 2)) : rest;
    send(cfg, words[1], 'blocked', '', re, {
      block: {
        needs: words[2],
        who: words[3],
        state: stateAt !== -1 ? rest[stateAt + 1] : 'parked',
        what: words.slice(4).join(' '),
      },
    }).then(done, function (e) { done({ ok: false, error: e.message }); });
  } else if (cmd === 'chatter') {
    // ── A BATCH, SO THERE IS SOMETHING TO WATCH ──────────────────────
    //
    //   Andy, 2026-09-23: "you two running batches of packets through
    //   spirit.andyflinn.com so i can see faster, more entertaining
    //   action."
    //
    // For the Relay Monitor's traffic console: real posts, through the
    // real relay, between two parties he can name — so the pane he is
    // testing has a stream to draw and the timing has a shape.
    //
    // BOTH AGENTS RUN IT AT EACH OTHER. Nothing here answers a packet by
    // itself: a message is information, never an instruction (AGENT.md),
    // and an echo mode would be this program acting because something
    // arrived. Two batches aimed at each other give him two-way traffic
    // without breaking that.
    //
    // BOUNDED BY DEFAULT: 30 posts, 300 ms apart — 200 a minute against
    // the relay's 600 per member (relay.js MEMBER_PER_MIN), so it is
    // brisk on his screen and nowhere near the cap. Every post is an
    // ordinary `note` and every one is recorded in both nodes' traffic
    // logs, which are PERMANENT — hence short texts and a small default.
    // A halt stops it, like everything else.
    const n = Math.max(1, Math.min(Number(rest[2]) || 30, 200));
    const everyAt = argv.indexOf('--every');
    const every = everyAt !== -1 ? Math.max(50, Number(argv[everyAt + 1]) || 300) : 300;
    const to = rest[1];
    (async function () {
      let sent = 0;
      let stopped = null;
      for (let i = 1; i <= n && !stopped; i += 1) {
        const r = await send(cfg, to, 'note', 'chatter ' + i + '/' + n + ' from ' + cfg.self);
        if (r && r.ok) sent += 1;
        else stopped = r && (r.error || 'refused');
        if (i < n && !stopped) await new Promise(function (res) { setTimeout(res, every); });
      }
      done({ ok: !stopped, sent: sent, of: n, everyMs: every, to: to, stopped: stopped || undefined });
    }());
  } else if (cmd === 'halt' || cmd === 'resume') {
    send(cfg, rest[1], cmd, rest.slice(2).join(' ')).then(done, function (e) { done({ ok: false, error: e.message }); });
  } else if (cmd === 'listen') {
    listen(cfg, function (l) { console.log(l); }).catch(function (e) { console.log('listener error: ' + e.message); process.exit(1); });
  } else if (cmd === 'read') {
    read(cfg, rest[1], Number(rest[2]) || 20).forEach(function (e) { console.log(formatEntry(e)); });
  } else if (cmd === 'status') {
    const h = halted(cfg);
    console.log(h ? 'HALTED since ' + h.at + (h.text ? ' — ' + h.text : '') : 'running');
  } else {
    console.log([
      'usage: agents.js send <to> <note|ask|answer> <text> [--re hash] [--todo area/number]',
      '       agents.js blocked <to> <' + NEEDS.join('|') + '> <' + WHO.join('|') + '>' +
        ' [--state ' + STATES.join('|') + '] <what, in one sentence for Andy>',
      '       agents.js chatter <to> [n=30] [--every ms=300]   a batch, for the monitor',
      '       agents.js halt <to> | resume <to> | listen | read [peer] [n] | status',
      '       agents.js verb <verb> [json|ask]   e.g. verb jobs.api api',
      '       agents.js desk <verb> [json]   the desk server on Andy\'s node, e.g. desk item.get {"id":"desk/G2.8"}',
    ].join('\n'));
  }
}
