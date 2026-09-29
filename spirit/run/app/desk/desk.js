// spirit/run/app/desk/desk.js
// ANDY'S DESK FOR TALKING TO THE AGENTS — design/shell/AGENTS-UI.md.
//
//   Andy, 2026-09-27: "it would allow me to send input without
//   interrupting any of you, and your attention can thus be better
//   organized, too" — "my input will be queued, any agent can adress
//   issues in the table, respons to me under that heading".
//
// A REAL APP, and only the app contract: what arrives comes through
// `onPacket`, everything Andy writes leaves as an ordinary `agents` packet
// through `peerPost`, and both are kept in Desk's OWN log, `log.json` in
// its own folder (`api.fs`). The board and every thread are read from it.
//
// ── IT KEEPS ITS OWN LOG, BY RULING ───────────────────────────────────
//
//   Andy, 2026-09-27, when Desk read his node's record through a node
//   verb added for it: "that's a boundary crossed that requires peer
//   review AND my approval", then "they must keep their own logs" and
//   "after correcting agents and desk, we will remove the new verb."
//
// So Desk asks the node for no record, and for nothing beyond what every
// app has (onPacket, peerPost, its own folder). What passed
// before this log existed, or while no Desk was mounted in an open page,
// is not in it. That is the price of the ruling, not a bug to fix by
// reaching into the node's record again.
//
// ── THE THREAD KEY IS THE FULL ID ────────────────────────────────────
//
// A row is keyed by `id` (`puppets/G6`), never by the handle it prints:
// the handle is the shortest form unique today and can lengthen, which
// would orphan a thread keyed on it. Andy never types either — the app
// attaches the id to what he writes, which is what lets his text reach
// voice.jsonl clean. Nothing here writes voice.jsonl, and nothing may:
// Andy, 2026-09-27, "that hook into my voice.jsonl is a hack and will have
// to be removed if the agents app is ever to ship."

// IN TWO FOLDERS, NOT LOOSE. Andy, 2026-09-29: 'desk creates a lot of
// file-clutter, can we clean that up', and on the stopgap until a
// process/js/desk owns a desk.db: 'that'd be pogress, yes!'. The log's
// chunks live in log/, his typed lines in voice/.
var DESK_LOG = 'log/log.json';

// A BUSY AGENT IS WAITED FOR, NOT BOUNCED. Andy's line came back
// "(undelivered: target is busy)" because a post got one attempt. With
// his go, peer.post takes a patience and the node retries a busy target
// with backoff; Desk asks for a minute. What the log records is the final
// outcome, after that minute, never the first refusal.
var DESK_PATIENCE = { patienceMs: 60000 };

var deskApi = null;
var deskBoard = null;       // the newest `board` packet's JSON
var deskSession = null;     // the board's session: the newest `session` packet's JSON, unless a new design cleared it
var deskSessionPosted = null, deskSessionAt = 0;
var deskDone = {};           // item id -> true/false, from Andy's own "done." / "reopen."
var deskReady = {};          // item id -> true once two agents have each said READY TO CLOSE under it
var deskReadyBy = {};        // item id -> { agent name: true } for each READY TO CLOSE claim
var deskClosed = {};         // item id -> true once Andy closed its done line away
var deskFrom = { done: {}, title: {}, pressed: {} };  // item id -> { at, key } of Andy's answer that set it
var DESK_READY_CLAIM = /^(?:[\w.-]+[,:]\s*)?(?:[\w.\/-]+\s+is\s+)?READY TO CLOSE\b/;
// NO GO BEFORE WHAT IS ALREADY THERE IS CHECKED. Andy: "The already in place
// list must be verified before any go button can appear." The check is a
// note under the item that opens with VERIFIED (or IN PLACE VERIFIED),
// posted by the agent who did not write the list and naming the commit
// (wsl-claude's shape, the same as READY TO CLOSE).
var DESK_VERIFIED_CLAIM = /^(?:[\w.-]+[,:]\s*)?(?:IN PLACE )?VERIFIED\b/;
var deskVerified = {};       // item id -> true once its Already-in-place list was verified
var DESK_UNVERIFIED_CLAIM = /^(?:[\w.-]+[,:]\s*)?(?:UNVERIFIED|IN PLACE WITHDRAWN)\b/;  // the newest `session` packet as it arrived, and when
var deskMessages = [];      // decoded agents messages, in log order
var deskByHash = Object.create(null);
var deskError = '';
// THE LEAD, learned from whoever posts the board: only the lead box posts
// one (runAll, lead = yes). Andy: "below the list in desk i'd like a direct
// chat to lead". It is also the home for what belongs to no row.
var deskLead = null;
// WHICH AGENT HAS A ROW. Andy: "a column for the agent label would be
// appropriate". Nothing in the tree records it; the claims do, in this
// node's own record: the newest `taking` note per full id.
var deskTaken = Object.create(null);
// HIS NAME FOR A ROW, when he has given one. Andy: "I like that i get to
// relable the issue with my own words". The newest `retitle:` he sent.
var deskLabel = Object.create(null);
// HIS LAST DECISION ON A ROW. Andy: "the list should display my decision
// (go,accept)". The newest of go / no / accepted / rejected he sent.
var deskDecision = Object.create(null);
// A GO! ON THE LIST ITSELF. Andy: "gimme a go button right on the list, if
// it really just implementation of something agreed upon during a design
// session". An agent that is ready asks under the row (kind ask), and the
// row carries Go! until he answers it. The newest open ask per full id.
var deskOpenAsk = Object.create(null);
var DESK_DECISIONS = { 'go.': 'go', 'no.': 'no', 'accepted.': 'accepted', 'rejected.': 'rejected' };
// WHO HEARS ANDY FROM A ROW'S DIALOG: agents heard from, newest key per
// name. Handed to DeskDetails, which can read only its own folder.
var deskAgents = Object.create(null);

// One arrival (onPacket's body and message) -> one agents message, or null
// when it is not one.
function deskArrival(body, message) {
  if (!body || !message) return null;
  var at = String(message.sentAt || new Date().toISOString());
  // A REPORT CARRIES A WHOLE MESSAGE BETWEEN AGENTS (agents.js reportOf),
  // read here as that message, from its own sender. That is what makes
  // this log Andy's "overall record of our activities", and it is how
  // one agent's `taking`, sent to the other, still reaches the column.
  if (body.kind === 'report') {
    var inner = null;
    try { inner = JSON.parse(body.text); } catch (e) { inner = null; }
    if (!inner || inner.v !== 1 || !inner.kind) return null;
    return {
      key: String(message.hash || ''), at: at, dir: 'in', peer: '', outcome: String(inner.outcome || ''),
      from: String(inner.from || ''), to: String(inner.to || ''), kind: String(inner.kind),
      text: String(inner.text || ''), todo: inner.todo ? String(inner.todo) : '', reported: true,
    };
  }
  return {
    key: String(message.hash || ''), at: at, dir: 'in', peer: String(message.fromKey || ''), outcome: 'received',
    from: String(body.from || ''), kind: String(body.kind || ''),
    text: String(body.text || ''), todo: body.todo ? String(body.todo) : '',
  };
}

// One of Andy's own lines, as it went. Keyed by the hash the node signed
// it under, or by a key of its own when nothing crossed and there is no
// hash: folding failed sends by an empty hash would merge them into one.
var deskOutCount = 0;
function deskOutgoing(to, body, r, e) {
  deskOutCount += 1;
  return {
    key: (r && r.hash) || ('out-' + Date.now() + '-' + deskOutCount),
    at: new Date().toISOString(), dir: 'out', peer: String(to || ''),
    outcome: e ? 'undelivered: ' + e.message : (r && r.ok ? 'sent' : 'undelivered: ' + ((r && (r.error || r.status)) || 'no answer')),
    from: 'andy', kind: String(body.kind || ''), text: String(body.text || ''), todo: body.todo ? String(body.todo) : '',
  };
}

// WRITTEN WHOLE, ONE WRITE AT A TIME. The scoped fs saves a file, it does
// not append, so two saves in flight could land out of order and the
// older list would win.
var deskSaving = Promise.resolve();
//
// MERGED BEFORE IT IS WRITTEN (wsl-claude's review): two Desk tabs each
// hold a list, and a plain rewrite would let the last save drop the other
// tab's lines. So a save first folds in whatever the file holds that this
// page does not.
//
// ── IN CHUNKS, BECAUSE A SAVE IS ONE REQUEST AND A REQUEST IS BOUNDED ──
//
// Found live, Andy's Desk, 2026-09-27: "Desk could not write its log:
// failed to save file: 413". The whole log was rewritten on every
// arrival, and at 21 KB it no longer fitted in one request (BODY_MAX,
// 23552 bytes, with the save's own envelope and escaping on top). So the
// log is a run of files: log.json, then log-1.json, log-2.json, ... Only
// the LAST is ever rewritten, and a chunk is sealed once it holds about
// DESK_CHUNK_BYTES; the next line starts the next file. Every save is
// then small, however long the conversation gets.
var DESK_CHUNK_BYTES = 9000;
function deskChunkName(i) { return i === 0 ? DESK_LOG : 'log/log-' + i + '.json'; }
var deskLastChunk = 0;                          // the one still being written
var deskSealedKeys = Object.create(null);       // keys living in earlier chunks

function deskUtf8(text) {
  var n = 0;
  for (var i = 0; i < text.length; i += 1) {
    var c = text.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c < 0xdc00) { n += 4; i += 1; }
    else n += 3;
  }
  return n;
}

function deskSave() {
  if (deskReadOnly) return deskSaving;
  deskSaving = deskSaving.then(function () {
    deskLoadLog();
    if (deskReadOnly) return null;
    var open = deskMessages.filter(function (m) { return !deskSealedKeys[m.key]; });
    var writes = Promise.resolve();
    // Seal full chunks first, oldest lines first, each holding at least
    // one line, so a single long line still lands somewhere.
    while (deskUtf8(JSON.stringify(open)) > DESK_CHUNK_BYTES && open.length > 1) {
      var take = 1;
      while (take < open.length && deskUtf8(JSON.stringify(open.slice(0, take + 1))) <= DESK_CHUNK_BYTES) take += 1;
      var sealed = open.slice(0, take);
      writes = writes.then(deskWriteChunk(deskChunkName(deskLastChunk), JSON.stringify(sealed)));
      sealed.forEach(function (m) { deskSealedKeys[m.key] = true; });
      deskLastChunk += 1;
      open = open.slice(take);
    }
    return writes.then(deskWriteChunk(deskChunkName(deskLastChunk), JSON.stringify(open)));
  }).catch(function (e) { deskError = 'Desk could not write its log: ' + e.message; deskDraw(); });
  return deskSaving;
}
function deskWriteChunk(name, text) {
  return function () { return deskApi.fs.saveFile(name, text); };
}

// ── WHAT ANDY TYPED, FOR HIS VAULT, IN THIS APP'S OWN FOLDER ──────────
//
//   Andy, 2026-09-27: "that hook into my voice.jsonl is a hack and will
//   have to be removed if the agents app is ever to ship" — "it's a
//   dependence on a private repo" — and then "I'll live with an
//   alternative way, by copying the json.l file manualy to my brain
//   input, and deleting the one in the app folder".
//
// So Desk never touches the vault. It appends each line he TYPED to
// `voice.jsonl` here, in the vault's row shape ({text, day}, the day and
// never finer), and he moves the file himself. A file he has taken is
// simply started again. Button presses (Go!, No, Accept, Reject) and the
// explain request a dialog sends on opening are not his words, so they
// stay out.
var DESK_VOICE = 'voice/voice.jsonl';
var DESK_TYPED = /^(note|musing)$/;
function deskVoiceText(m) {
  if (!m || m.dir !== 'out') return '';
  if (DESK_TYPED.test(m.kind)) return m.text;
  if (m.kind === 'answer' && /^retitle:\s*/.test(m.text)) return m.text.replace(/^retitle:\s*/, '');
  return '';
}
function deskVoice(msgs) {
  // One line per thing he typed: a dialog line goes once per agent, so
  // the copies are dropped here.
  var seen = Object.create(null);
  var lines = [];
  msgs.forEach(function (m) {
    var t = deskVoiceText(m);
    if (!t || seen[m.kind + '\n' + t]) return;
    seen[m.kind + '\n' + t] = true;
    lines.push(JSON.stringify({ text: t, day: String(m.at || new Date().toISOString()).slice(0, 10) }));
  });
  if (!lines.length) return;
  // THE SAME BOUND AS THE LOG: voice.jsonl, then voice-2.jsonl, ... when
  // one is full. He moves every voice*.jsonl he finds.
  deskSaving = deskSaving.then(function () {
    var add = lines.join('\n') + '\n';
    for (var i = 1; ; i += 1) {
      var name = i === 1 ? DESK_VOICE : 'voice/voice-' + i + '.jsonl';
      var held = '';
      try { held = deskApi.fs.loadFile(name) || ''; } catch (e) { held = ''; }
      if (held && held.charAt(held.length - 1) !== '\n') held += '\n';
      if (!held || deskUtf8(held + add) <= DESK_CHUNK_BYTES) return deskApi.fs.saveFile(name, held + add);
    }
  }).catch(function (e) { deskError = 'Desk could not write ' + DESK_VOICE + ': ' + e.message; deskDraw(); });
}

// Into the log and onto the screen. Only what is new to the log reaches
// his voice file, so a replay writes nothing twice.
function deskRecord(msgs) {
  var fresh = msgs.filter(function (m) { return m && m.key && !deskByHash[m.key]; });
  fresh.forEach(deskFold);
  deskVoice(fresh);
  deskDraw();
  deskSaveState();
  return deskSave();
}

// ── WHAT DESK HAS DECIDED, KEPT AS A FILE ───────────────────────────
//
//   Andy, 2026-09-28: "change the desk app, to persist following items:
//   1) design mode 2) Andy's latest "done"! 3) Open question. 4) andy's
//   personal titles for items."
//
// state.json, in Desk's own folder and so in git: the four things, each
// with the time and the log key of the message that set it, so any entry
// can be traced to his own press. Written by Desk only, whenever it
// changes; no agent edits it. The log stays the record it is drawn from.
var DESK_STATE = 'state.json';
var deskStateText = '';
function deskStateJson() {
  var d = deskDesignMarks();
  var done = {}, title = {}, open = {};
  // His latest Done or Reopen per item, and whether it counts: a Done
  // counts only after an agent's READY TO CLOSE claim under that item.
  Object.keys(deskFrom.pressed).forEach(function (id) {
    var f = deskFrom.pressed[id];
    done[id] = { pressed: f.text, at: f.at || '', key: f.key || '', counts: deskDone[id] === true, claimed: !!deskReady[id] };
  });
  Object.keys(deskLabel).forEach(function (id) {
    var f = deskFrom.title[id] || {};
    title[id] = { title: deskLabel[id], at: f.at || '', key: f.key || '' };
  });
  Object.keys(deskOpenAsk).forEach(function (id) {
    var m = deskOpenAsk[id];
    open[id] = { from: m.from || '', text: m.text || '', at: m.at || '', key: m.key || '' };
  });
  return JSON.stringify({
    designMode: { on: d.started > d.ended,
      started: d.started ? new Date(d.started).toISOString() : '',
      ended: d.ended ? new Date(d.ended).toISOString() : '' },
    done: done, openQuestions: open, titles: title, closed: Object.keys(deskClosed),
  }, null, 2) + '\n';
}
function deskSaveState() {
  var text = deskStateJson();
  if (text === deskStateText || deskReadOnly) return;
  deskStateText = text;
  try { deskApi.fs.saveFile(DESK_STATE, text); } catch (e) { /* the log still holds it all */ }
}

// Folds one message in by its key; one already held is not taken twice.
function deskFold(msg) {
  if (!msg || !msg.key || deskByHash[msg.key]) return;
  deskByHash[msg.key] = msg;
  deskMessages.push(msg);
  if (msg.dir === 'in' && !msg.reported && msg.from && msg.peer) deskAgents[msg.from] = { key: msg.peer, at: Date.parse(msg.at) || 0 };
  if (msg.todo && msg.kind === 'note' && /^taking(\s|$)/.test(msg.text) && msg.from) {
    deskTaken[msg.todo] = msg.from;
  }
  if (msg.dir === 'out' && msg.todo && msg.kind === 'answer' && /^retitle:\s*/.test(msg.text)) {
    deskLabel[msg.todo] = msg.text.replace(/^retitle:\s*/, '');
    deskFrom.title[msg.todo] = { at: msg.at, key: msg.key };
  }
  if (msg.todo && !msg.reported && msg.dir === 'in' && msg.kind === 'ask' && msg.peer) deskOpenAsk[msg.todo] = msg;
  if (msg.todo && msg.dir === 'out' && msg.kind === 'answer') delete deskOpenAsk[msg.todo];
  if (msg.dir === 'out' && msg.todo && msg.kind === 'answer' && DESK_DECISIONS[msg.text]) {
    deskDecision[msg.todo] = DESK_DECISIONS[msg.text];
  }
  // HE CLOSES AN ITEM, NOBODY ELSE. Andy: "how do those damn items get
  // closed?", then "let's close that gap." His own latest "done." or
  // "reopen." under an item is its state, and a board the lead reposts
  // never un-closes it (wsl-claude's pitfall).
  // AND ONLY AFTER A CLAIM. Andy: "when you claim completeness, that's when
  // i want to see the close button, not before." A "done." counts only if an
  // agent had said READY TO CLOSE under that item first.
  // A CLAIM, not a mention: the note must open with it ("READY TO CLOSE", or
  // "<id> is READY TO CLOSE", after an optional "<agent>:" or "<agent>,").
  // An explanation that merely names the phrase mid-sentence is not one.
  // BOTH AGENTS, NOT ONE. Andy: "so i get a done button and the two of you
  // haven't even both tested it yet?", then go. An item is ready to close
  // only once two different agents have each claimed it.
  if (msg.dir === 'in' && msg.todo && DESK_READY_CLAIM.test(String(msg.text || ''))) {
    var by = deskReadyBy[msg.todo] || (deskReadyBy[msg.todo] = {});
    by[String(msg.from || msg.peer || '')] = true;
    deskReady[msg.todo] = Object.keys(by).length >= 2;
  }
  if (msg.dir === 'in' && msg.todo && DESK_VERIFIED_CLAIM.test(String(msg.text || ''))) deskVerified[msg.todo] = true;
  // A VERIFICATION CAN BE WITHDRAWN, and the Go goes with it: a note opening
  // with UNVERIFIED. Found when Andy spotted that G1.3's list claimed a Cancel
  // button the Jobs app does not have, after it had been verified.
  if (msg.dir === 'in' && msg.todo && DESK_UNVERIFIED_CLAIM.test(String(msg.text || ''))) deskVerified[msg.todo] = false;
  // A line he closed away stays away (his "closed." under it).
  if (msg.dir === 'out' && msg.todo && msg.kind === 'answer' && msg.text === 'closed.') deskClosed[msg.todo] = true;
  // His latest press is kept whether or not it counts yet.
  if (msg.dir === 'out' && msg.todo && msg.kind === 'answer' && (msg.text === 'done.' || msg.text === 'reopen.')) {
    deskFrom.pressed[msg.todo] = { text: msg.text, at: msg.at, key: msg.key };
  }
  if (msg.dir === 'out' && msg.todo && msg.kind === 'answer' && msg.text === 'reopen.') {
    deskDone[msg.todo] = false;
    deskFrom.done[msg.todo] = { at: msg.at, key: msg.key };
  }
  if (msg.dir === 'out' && msg.todo && msg.kind === 'answer' && msg.text === 'done.' && deskReady[msg.todo]) {
    deskDone[msg.todo] = true;
    deskFrom.done[msg.todo] = { at: msg.at, key: msg.key };
  }
  // THE LEAD IS WHOEVER POSTS THE SESSION. It was learned only from the old
  // board's packets, which stopped with the old tracking (2026-09-28), and the
  // Lead chat then had nobody to talk to. The session comes from the lead too.
  if (msg.kind === 'session' && msg.dir === 'in' && msg.peer && msg.from) deskLead = { name: msg.from, key: msg.peer };
  if (msg.kind === 'session' && msg.dir === 'in') {
    try {
      var sess = JSON.parse(msg.text);
      if (sess && sess.goal && Array.isArray(sess.items)) { deskSessionPosted = sess; deskSessionAt = Date.parse(msg.at) || 0; }
    } catch (e) { /* a session that does not parse is not a session */ }
  }
  if (msg.kind === 'board') {
    if (msg.dir === 'in' && msg.peer && msg.from) deskLead = { name: msg.from, key: msg.peer };
    try {
      var b = JSON.parse(msg.text);
      if (b && Array.isArray(b.rows)) deskBoard = b;
    } catch (e) { /* a board that does not parse is not a board */ }
  }
}

function deskEsc(s) { return deskApi.escapeHtml(String(s == null ? '' : s)); }

// ── WHAT ANDY HAS NOT SEEN YET ────────────────────────────────────────
//
//   Andy, 2026-09-27: "list items in the list should show a red "news" in
//   a unlabeled column, indicating that new stuff has arrived for that
//   item, and the list, lead, and team tabls should also show a red "*"
//   befor the tab title when new activity has taken place that I havent
//   seen yet. (attention-direction)" — then "or use the red "*" do
//   indicate "unseen changes have occured"". One mark, everywhere.
//
// Seen is kept per row and per chat in `seen.json`, in Desk's own folder,
// as the arrival time of the newest thing he has looked at: arrival times
// rather than his clock, so a sender's skew cannot hide anything. A row is
// seen when he opens it, a chat while its tab is showing. A Desk with no
// seen.json yet counts all it holds as seen, so the first open is not a
// wall of red.
var DESK_SEEN = 'seen.json';
var DESK_UNSEEN = '<span style="color:#d00;font-weight:bold" title="unseen changes">*</span>';
var deskSeen = { rows: {}, team: 0, agents: {}, folds: {} };
var deskTab = 'list';
// WHICH CHAT INSIDE TEAM: '*' for All, else an agent's name (desk/G1, D2).
var deskAgentTab = '*';

// What passed between Andy and one agent with NO row: his untagged lines to
// its key, its untagged lines to him. The lead's is today's Lead chat.
function deskIsDirectLine(name) {
  return function (m) {
    var who = deskAgents[name];
    if (m.todo || m.reported || m.kind === 'board' || m.kind === 'report') return false;
    if (m.kind === 'note' && /^taking(\s|$)/.test(m.text)) return false;
    return (m.dir === 'out' && !!who && m.peer === who.key) || (m.dir === 'in' && m.from === name);
  };
}
function deskIsTeamLine(m) { return m.todo === DESK_TEAM && m.kind !== 'board'; }
function deskIsRowLine(id) { return function (m) { return m.todo === id && m.kind !== 'board'; }; }

// The newest arrival (never his own line) that `pred` accepts.
function deskNewest(pred) {
  var newest = 0;
  deskMessages.forEach(function (m) {
    if (m.dir !== 'in' || !pred(m)) return;
    var at = Date.parse(m.at) || 0;
    if (at > newest) newest = at;
  });
  return newest;
}
function deskRowNews(id) { return deskNewest(deskIsRowLine(id)) > (deskSeen.rows[id] || 0); }
// A chat is 'team' (All) or an agent's name.
function deskChatPred(which) { return which === 'team' ? deskIsTeamLine : deskIsDirectLine(which); }
function deskChatSeenAt(which) { return (which === 'team' ? deskSeen.team : deskSeen.agents[which]) || 0; }
function deskChatNews(which) { return deskNewest(deskChatPred(which)) > deskChatSeenAt(which); }

function deskSaveSeen() {
  try { deskApi.fs.saveFile(DESK_SEEN, JSON.stringify(deskSeen)); } catch (e) { /* only a marker */ }
}
function deskMarkRowSeen(id) {
  var newest = deskNewest(deskIsRowLine(id));
  if (newest > (deskSeen.rows[id] || 0)) { deskSeen.rows[id] = newest; deskSaveSeen(); }
}
function deskMarkChatSeen(which) {
  var newest = deskNewest(deskChatPred(which));
  if (newest <= deskChatSeenAt(which)) return;
  if (which === 'team') deskSeen.team = newest; else deskSeen.agents[which] = newest;
  deskSaveSeen();
}
// The chat showing inside Team.
function deskTeamWhich() { return deskAgentTab === '*' ? 'team' : deskAgentTab; }

// Read once at mount, after the log. Absent: all already held is seen.
function deskLoadSeen() {
  var raw = null;
  try { raw = deskApi.fs.loadFile(DESK_SEEN); } catch (e) { raw = null; }
  var held = null;
  try { held = raw ? JSON.parse(raw) : null; } catch (e) { held = null; }
  if (held && typeof held === 'object') {
    deskSeen = { rows: held.rows && typeof held.rows === 'object' ? held.rows : {}, team: Number(held.team) || 0,
      agents: held.agents && typeof held.agents === 'object' ? held.agents : null,
      folds: held.folds && typeof held.folds === 'object' ? held.folds : {} };
    if (deskSeen.agents) return;
    // A seen.json from before the agent tabs: the lead keeps its old Lead
    // mark, and what the others said so far counts as seen.
    deskSeen.agents = {};
    Object.keys(deskAgents).forEach(function (n) {
      deskSeen.agents[n] = deskLead && n === deskLead.name ? Number(held.lead) || 0 : deskNewest(deskIsDirectLine(n));
    });
    deskSaveSeen();
    return;
  }
  var ids = Object.create(null);
  deskMessages.forEach(function (m) { if (m.todo && m.todo !== DESK_TEAM) ids[m.todo] = true; });
  Object.keys(ids).forEach(function (id) { deskSeen.rows[id] = deskNewest(deskIsRowLine(id)); });
  Object.keys(deskAgents).forEach(function (n) { deskSeen.agents[n] = deskNewest(deskIsDirectLine(n)); });
  deskSeen.team = deskNewest(deskIsTeamLine);
  deskSaveSeen();
}

// A tab button: the one showing is marked, and a red * before its title
// says something arrived there that he has not seen.
function deskTabButton(attrs, on, news, label) {
  return '<button type="button" ' + attrs + ' aria-selected="' + (on ? 'true' : 'false') + '" style="font-weight:' +
    (on ? 'bold' : 'normal') + ';text-decoration:' + (on ? 'underline' : 'none') + '">' +
    (news ? DESK_UNSEEN + ' ' : '') + deskEsc(label) + '</button>';
}

// WHAT WAITS ON HIM, COUNTED ON THE LIST TAB (desk/G1, D7): a Go! he can
// press, a row both agents claimed ready for his Done, an open point.
function deskWaitingOnAndy() {
  return deskSessionRows().filter(function (row) {
    if (deskClosed[row.id] || row.done) return false;
    return deskGoState(row) === 'go' || !!deskReady[row.id] || !!row.open;
  }).length;
}

// Drawn whole, as markup: List | Team | Musings. The Lead tab moved into
// Team as the lead's own tab (desk/G1, D2).
function deskDrawTabs() {
  var strip = document.getElementById('desk-tabs');
  if (!strip) return;
  var listNews = deskBoard ? deskBoard.rows.some(function (r) { return deskRowNews(r.id); }) : false;
  var teamNews = deskChatNews('team') || Object.keys(deskAgents).some(deskChatNews);
  var waiting = deskWaitingOnAndy();
  var design = deskDesignOn();
  strip.innerHTML =
    deskTabButton('data-tab="list"', deskTab === 'list', listNews, 'List' + (waiting ? ' (' + waiting + ')' : '')) +
    deskTabButton('data-tab="team"', deskTab === 'team', teamNews, 'Team') +
    deskTabButton('data-tab="musings"', deskTab === 'musings', false, 'Musings') +
    // AT THE END OF THE TAB ROW, ONLY ON TEAM, AND LOOMING. Andy: "put the
    // end design mode button at the end of the tab-button-row, only
    // visible while in teh team tab. and make the button a different
    // color, so it loooms over the proceedings".
    '<button type="button" id="desk-end-design"' + (design && deskTab === 'team' ? '' : ' hidden') +
      ' style="margin-left:auto;background:#c00;color:#fff;font-weight:bold;border:2px solid #600">End design mode</button>' +
    // Its twin, in the same spot while design mode is off.
    '<button type="button" id="desk-start-design"' + (!design && deskTab === 'team' ? '' : ' hidden') +
      ' style="margin-left:auto;background:#1a7f37;color:#fff;font-weight:bold;border:2px solid #0b4a1e">Start design mode</button>';
}

// INSIDE TEAM, ONE TAB PER AGENT (desk/G1, D2): All is the team chat, every
// other tab a channel between Andy and that agent alone, the lead first and
// marked. Andy: "the top level [lead] tab moves into [team] as
// [agent-name], karked as lead".
function deskAgentNames() {
  var lead = deskLead ? deskLead.name : '';
  return Object.keys(deskAgents).sort(function (a, b) {
    if ((a === lead) !== (b === lead)) return a === lead ? -1 : 1;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}
function deskDrawAgentTabs() {
  var strip = document.getElementById('desk-agent-tabs');
  if (!strip) return;
  strip.innerHTML = deskTabButton('data-agent="*"', deskAgentTab === '*', deskChatNews('team'), 'All') +
    deskAgentNames().map(function (n) {
      var lead = !!deskLead && n === deskLead.name;
      return deskTabButton('data-agent="' + deskEsc(n) + '"' + (lead ? ' data-lead="1" title="the lead"' : ''),
        deskAgentTab === n, deskChatNews(n), n + (lead ? ' (lead)' : ''));
    }).join('');
}

// ── DESIGN MODE, AND THE DESIGN SESSION'S BOARD ─────────────────────
//
//   Andy, 2026-09-28: "when i sent anything to team chat, we're all in
//   design mode", and "design mode for the Desk app and its detail apps,
//   can only be ended from within the team tab. Why? so that we can
//   navigate anywhere in desk and desk detail to observe the effect of the
//   design session."
//
// STARTED BY A BUTTON, NOT BY TALKING. It was on whenever his newest Team
// line was newer than his last "end design mode.", so every word he typed
// in Team after ending it switched it back on and cleared the board. Andy:
// "the "End design mode" button keeps oming back", then "i guess i need a
// start design mode button instead." So it is on when his newest "start
// design mode." in Team is newer than his newest "end design mode.", read
// from Desk's own log: nothing new is stored.
var DESK_END_DESIGN = 'end design mode.';
var DESK_START_DESIGN = 'start design mode.';
function deskDesignMarks() {
  var started = 0, ended = 0;
  deskMessages.forEach(function (m) {
    if (m.dir !== 'out' || m.todo !== DESK_TEAM || m.kind !== 'answer') return;
    var at = Date.parse(m.at) || 0;
    if (m.text === DESK_END_DESIGN && at > ended) ended = at;
    if (m.text === DESK_START_DESIGN && at > started) started = at;
  });
  return { started: started, ended: ended };
}
function deskDesignOn() {
  var d = deskDesignMarks();
  return d.started > d.ended;
}

// ENDING KEEPS THE BOARD; STARTING CLEARS IT. Andy: "if i End design mode
// the board stays, if i start a new one the board clears." A session posted
// before the press of Start belongs to the design he ended, and a new design
// shows none until the lead posts its goal.
function deskSessionSync() {
  var d = deskDesignMarks();
  var cleared = d.started > d.ended && deskSessionAt < d.started;
  deskSession = (deskSessionPosted && !cleared) ? deskSessionPosted : null;
}

// THE SESSION'S BOARD. Andy: "the Title item will become the first ond only
// item on the board. every item in the indentede list below, will become an
// item that blocks the title item from being complete", "The indentation
// doesn't nest", and "the goal moves downward because it will become
// dependent on more and more items being completed". So the list is every
// required item, then the goal last, blocked by each one still open.
// EVERY ITEM MAY HAVE ITS OWN REQUIREMENTS. Andy: "clicking on an item will
// ring us to the details dialog, where the detail is the Title item in a
// similar display block at the top, where we can add items required to make
// that detail happen". So an item names what it blocks (`blocks`, the goal
// when absent), and an item waits on every open item that blocks it.
function deskSessionRows() {
  if (!deskSession) return [];
  var goalId = String(deskSession.goal.id);
  var items = deskSession.items.map(function (it, i) {
    return { id: String(it.id || ('item-' + (i + 1))), title: String(it.title || ''), done: deskIsDone(String(it.id || ('item-' + (i + 1))), it.done),
      // ONE ITEM MAY BLOCK SEVERAL (RUN blocks both grantFace and ACT):
      // `blocks` is a string or a list, and always a list here.
      description: String(it.description || ''), refs: it.refs || [],
      // HOW HE CAN CHECK IT, AND WHAT PROVES IT. Andy: "there should be a
      // highlighted section on if and how i can check. same as wsl test
      // requirements should be enumarated under requirements".
      check: String(it.check || ''), tests: Array.isArray(it.tests) ? it.tests.map(String) : [],
      // WHAT IS ALREADY THERE, so nothing is built twice: [{ what, where }],
      // `where` being path:line and the text quoted there.
      inPlace: Array.isArray(it.inPlace) ? it.inPlace : [],
      verified: !!deskVerified[String(it.id || ('item-' + (i + 1)))],
      // AN OPEN POINT IS AN ITEM (desk/G1 D6). Andy: "i keep missing my O's
      // because the don't have a prioritized slot. perceive them as item
      // other things depend on". The lead marks it open; it names what it
      // blocks like any item, and it is his to answer.
      open: !!it.open,
      blocks: (Array.isArray(it.blocks) ? it.blocks : [it.blocks || goalId]).map(String) };
  });
  var waiting = function (id) {
    return items.filter(function (it) { return !it.done && it.blocks.indexOf(id) !== -1; }).map(function (it) { return it.id; });
  };
  items.forEach(function (it) { it.waitsOn = waiting(it.id); });
  return items.concat([{ id: goalId, title: String(deskSession.goal.title), goal: true,
    description: String(deskSession.goal.description || ''), done: deskIsDone(goalId, deskSession.goal.done), waitsOn: waiting(goalId),
    check: String(deskSession.goal.check || ''), tests: Array.isArray(deskSession.goal.tests) ? deskSession.goal.tests.map(String) : [] }]);
}
function deskIsDone(id, posted) {
  return Object.prototype.hasOwnProperty.call(deskDone, id) ? deskDone[id] : !!posted;
}
function deskGoalDone() {
  return !!deskSession && deskIsDone(String(deskSession.goal.id), deskSession.goal.done);
}
// Where a row's ask stands: '' none, 'unverified', 'held' (blocked or in
// design mode), or 'go' when his Go! button shows.
function deskGoState(row) {
  if (!deskOpenAsk[row.id] || row.done) return '';
  if (!row.goal && !deskVerified[row.id]) return 'unverified';
  if ((row.waitsOn || []).length || deskDesignOn()) return 'held';
  return 'go';
}
function deskSessionTable() {
  var head = '<tr><th></th><th>to-do</th><th>with</th><th>your decision</th><th>blocks</th><th>waits on</th><th>state</th></tr>';
  // A PRIORITIZED SLOT (desk/G1 D6): an open point he has not answered sits
  // above everything else; the rest keep the session's order.
  var rows = deskSessionRows().filter(function (row) { return !deskClosed[row.id]; });
  var mine = function (row) { return row.open && !row.done; };
  rows = rows.filter(mine).concat(rows.filter(function (row) { return !mine(row); }));
  var body = rows.map(function (row) {
    return '<tr data-id="' + deskEsc(row.id) + '" style="cursor:pointer' + (row.goal ? ';font-weight:bold' : '') + '">' +
      '<td>' + (deskRowNews(row.id) ? DESK_UNSEEN : '') + '</td>' +
      '<td title="' + deskEsc(row.title) + '">' + deskEsc(deskLabel[row.id] || row.title) +
        ' <span class="job-manifest-note">(' + deskEsc(row.id) + ')</span></td>' +
      '<td>' + deskEsc(deskTaken[row.id] || '') + '</td>' +
      // A CLOSED ITEM ASKS NOTHING. Andy: "this one still shows go button
      // while market as done".
      '<td>' + (deskGoState(row) === 'unverified'
        ? '<span class="job-manifest-note">asks; not verified yet</span>'
        // NO GO! WHILE BLOCKED, NONE IN DESIGN MODE. Andy, 2026-09-29: "Two
        // items in the list show a Go button, even though they're blocked,
        // And we're in design mode". The ask stays; only its button waits.
        : deskGoState(row) === 'held'
        ? '<span class="job-manifest-note">asks; ' + ((row.waitsOn || []).length ? 'waits on ' + deskEsc(row.waitsOn.join(', ')) : 'design mode') + '</span>'
        : deskGoState(row) === 'go'
        ? '<button type="button" data-go="' + deskEsc(row.id) + '" title="' + deskEsc(deskOpenAsk[row.id].text) + '">Go!</button>'
        : deskEsc(deskDecision[row.id] || '')) + '</td>' +
      '<td>' + deskEsc((row.blocks || []).join(', ')) + '</td>' +
      '<td>' + deskEsc((row.waitsOn || []).join(', ')) + '</td>' +
      // A DONE LINE CAN BE CLOSED AWAY. Andy: "done lines in the list should
      // offer me a close button which will make the line disappear."
      // The button says it; the word beside it went (Andy, 2026-09-29: "don't
      // show "done" anymore").
      '<td>' + (row.done ? '<button type="button" data-close="' + deskEsc(row.id) + '">Close</button>'
        : row.open ? '<b>yours</b>'
        : deskDecision[row.id] === 'go' ? 'running' : 'open') + '</td>' +
    '</tr>';
  }).join('');
  return '<div class="job-manifest-note">Design session: ' + deskEsc(deskSession.goal.id) + '</div>' + deskRulesHtml() +
    '<table class="jobs-table"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
}

// The bubble at the top of Team: the goal and what it waits on, filled by
// the lead as the chat goes. Blank until the first session arrives.
// THE PLAN'S RULES. Andy, of "nothing above trafficLog.js changes": "that's
// a rule for this plan, we should find a way to insert it as such". A rule
// is not an item: nothing is built to close it, and it holds for every item
// in the session. So it sits under the goal, above the items, and is added
// the way an item is: argued, then agreed.
function deskSessionRules() {
  return (deskSession && Array.isArray(deskSession.rules)) ? deskSession.rules.map(function (r, i) {
    return typeof r === 'string' ? { id: 'rule-' + (i + 1), text: r } : { id: String(r.id || ('rule-' + (i + 1))), text: String(r.text || '') };
  }) : [];
}
function deskRulesHtml() {
  var rules = deskSessionRules();
  // Gone with the goal they belong to. Andy: "the rules should also
  // disappear with the requirement they were attached to."
  if (!rules.length || deskClosed[String(deskSession.goal.id)]) return '';
  // A BOX OF ITS OWN. Andy: "can we have a clearer separation between rules
  // and requirements?" Rules sit in a dashed frame, named for what they are,
  // so they never read as more items on the list.
  return '<div style="margin-top:8px;padding:6px 10px;border:1px dashed currentColor;border-radius:6px">' +
    '<div class="label">Rules — hold for every requirement, never done</div><ul style="margin:6px 0 0 18px">' +
    rules.map(function (r) { return '<li>' + deskEsc(r.id) + ': ' + deskEsc(r.text) + '</li>'; }).join('') + '</ul></div>';
}

// A box's fold toggle: open it points down, folded it points right.
function deskFoldToggle(name, folded) {
  return '<button type="button" data-fold="' + name + '" title="' + (folded ? 'Unfold' : 'Fold') + '">' + (folded ? '▸' : '▾') + '</button>';
}
function deskSessionBubble() {
  // Blank once its goal is closed, rules and all (deskSessionOpen).
  if (!deskSessionOpen()) {
    return '<div class="stat-tile wide"><div class="label">Design session</div>' +
      '<div class="job-manifest-note">Blank. The lead fills in the goal (id and title), your description, and ' +
      'the list of what must be done before it is, as we talk.</div></div>';
  }
  var g = deskSession.goal;
  // FOLDED, ONE LINE (desk/G1.8). Andy: "the large text containers,
  // especially the one at the top, should be foldable, in desk and details."
  // Kept per viewer in seen.json, as what he has seen is.
  var folded = !!deskSeen.folds.session;
  var head = '<div style="display:flex;gap:8px;align-items:baseline">' + deskFoldToggle('session', folded) +
    '<div class="label" data-open="' + deskEsc(g.id) + '" style="cursor:pointer">' + deskEsc(g.id) + ' — ' + deskEsc(g.title) + '</div></div>';
  if (folded) return '<div class="stat-tile wide">' + head + '</div>';
  // A closed line leaves the bubble as it leaves the List (wsl-claude).
  var items = deskSession.items.filter(function (it, i) {
    return !deskClosed[String(it.id || ('item-' + (i + 1)))];
  }).map(function (it, i) {
    return '<li data-open="' + deskEsc(it.id || ('item-' + (i + 1))) + '" style="cursor:pointer">' +
      (deskIsDone(String(it.id || ('item-' + (i + 1))), it.done) ? '<s>' : '') + deskEsc(it.title) +
      (deskIsDone(String(it.id || ('item-' + (i + 1))), it.done) ? '</s>' : '') +
      ' <span class="job-manifest-note">(' + deskEsc(it.id || ('item-' + (i + 1))) + ')</span></li>';
  }).join('');
  return '<div class="stat-tile wide">' + head +
    (g.description ? '<div>' + deskEsc(g.description) + '</div>' : '') + deskRulesHtml() +
    // THE GOAL IS A REQUIREMENT TOO, the root one. Andy: "Isn't the title of
    // this project (the goal) a requirement?" So the bubble reads like an
    // item's dialog: the goal as the title block, then what it is blocked by.
    '<div class="label" style="margin-top:8px">Blocked by</div>' +
    (items ? '<ul style="margin:6px 0 0 18px">' + items + '</ul>'
      : '<div class="job-manifest-note">Nothing required yet.</div>') + '</div>';
}

function deskTable() {
  // THE SESSION, DONE OR NOT; NEVER THE OLD BOARD. Andy: "this IS the
  // official project governance. NOW." and the old tracking is forbidden;
  // then, when a finished goal brought its rows back: "why are all the lines
  // back again. i made most of them disappear with close". A done goal stays
  // on its own board, closable like any line.
  // A CLOSED GOAL TAKES ITS WHOLE SESSION WITH IT, RULES INCLUDED. Andy:
  // "the rules should also disappear with the requirement they were attached to."
  if (deskSessionOpen()) return deskSessionTable();
  return '<div class="job-manifest-note">No design session is open. Press Start design mode in the Team tab to begin one.</div>';
}
// Open while any of its lines is not closed away: a closed goal takes its
// rules with it, but a line still open is never hidden with it (wsl-claude's
// deskClosed.js), so unfinished work cannot vanish.
function deskSessionOpen() {
  return !!deskSession && deskSessionRows().some(function (row) { return !deskClosed[row.id]; });
}

function deskRowOf(id) {
  var sessionRow = deskSessionRows().filter(function (r) { return r.id === id; })[0];
  if (sessionRow) return sessionRow;
  if (!deskBoard) return null;
  for (var i = 0; i < deskBoard.rows.length; i += 1) if (deskBoard.rows[i].id === id) return deskBoard.rows[i];
  return null;
}

// ── THE DIRECT CHAT TO THE LEAD, BELOW THE LIST ─────────────────────
//
// What passed between Andy and the lead with NO row: his untagged lines to
// the lead's key, and the lead's untagged lines to him. Board posts, claims
// and reports are not conversation. Repainted on arrival, with the input
// box outside the repainted part so his typing survives.
// NEWEST FIRST, INPUT ON TOP. Andy, 2026-09-28: "i want my input at the top
// if the chat log, and the log shows the last message at the top, the second
// last shows second etc... then the most relevant chat entries will be at
// the top". Every chat in Desk and its dialogs is drawn this way.
// ── A CHAT LINE, DRAWN READABLY (desk/G1.10) ────────────────────────
//
//   Andy: "it would be nice if the chat log here would show some nicer
//   formatting", then "yes, that would make it much more readable."
//
// Escaped FIRST, then formatted, so a line's text never becomes markup.
// Line breaks kept; '- ' lines become a list; `backquoted` text is code; the
// time is the local HH:MM; a session post is one line naming its goal, never
// its JSON. Its twin is ddLineHtml in deskDetails.js: change both or neither.
function deskTime(at) {
  var d = new Date(at);
  if (isNaN(d.getTime())) return deskEsc(at);
  var two = function (n) { return (n < 10 ? '0' : '') + n; };
  return two(d.getHours()) + ':' + two(d.getMinutes());
}
function deskLineHtml(m) {
  if (m && m.kind === 'session') {
    var g = null;
    try { g = JSON.parse(String(m.text)).goal; } catch (e) { g = null; }
    return '<i>the goal record was updated' + (g ? ': ' + deskEsc(g.id) + ' — ' + deskEsc(g.title) : '') + '</i>';
  }
  var out = [];
  var list = [];
  var flush = function () { if (list.length) { out.push('<ul style="margin:2px 0 2px 18px">' + list.join('') + '</ul>'); list = []; } };
  String(m && m.text || '').split('\n').forEach(function (raw) {
    var line = deskEsc(raw).replace(/`([^`]+)`/g, '<code>$1</code>');
    if (/^- /.test(raw)) { list.push('<li>' + line.slice(2) + '</li>'); return; }
    flush();
    out.push(line);
  });
  flush();
  return out.join('<br>').replace(/<br>(<ul)/g, '$1').replace(/(<\/ul>)<br>/g, '$1');
}

function deskDirectChat(name) {
  var lines = deskMessages.filter(deskIsDirectLine(name));
  if (!lines.length) return '<div class="job-manifest-note">Nothing said yet.</div>';
  return lines.slice().reverse().map(function (m) {
    var who = m.dir === 'out' ? 'you' : m.from;
    // Andy: "in this chat, could you change the appearance of your messages
    // from mine a bit?" His lines sit to the right and quieter; the lead's
    // carry a rule down their left edge.
    var look = m.dir === 'out'
      // Andy: "a differen background color (black) for my lines ... if mine had
      // black background all across, then i could see all you responses as a
      // block. similar in the details chat."
      ? ' style="text-align:right;background:#000;color:#fff;padding:4px 8px;margin:4px 0"'
      : ' style="border-left:3px solid currentColor;padding-left:8px;margin:4px 0"';
    return '<div' + look + '><b>' + deskEsc(who) + '</b> <span class="job-manifest-note">' + deskTime(m.at) +
      '</span> ' + deskLineHtml(m) + '</div>';
  }).join('');
}

// ── MUSINGS: HIS THOUGHTS FOR LATER, NOT A CONVERSATION ─────────────
//
// Andy: "now i need something that lets me pipe stuff to voice.jsonl
// bypassing scoreboard issues", "ideas deferred to close-time". So a
// musing belongs to no row and expects no reply: kind `musing`, sent to
// the lead, listed here in order, and gone through with him at close.
function deskMusings() {
  var lines = deskMessages.filter(function (m) { return m.dir === 'out' && m.kind === 'musing'; });
  if (!lines.length) return '<div class="job-manifest-note">Nothing logged yet. What you write here waits for close time; nobody answers it now.</div>';
  return lines.slice().reverse().map(function (m) {
    return '<div><span class="job-manifest-note">' + deskTime(m.at) + '</span> ' + deskLineHtml(m) + '</div>';
  }).join('');
}

// ── TEAM: THE GROUP CHAT, ANDY AND EVERY AGENT ──────────────────────
//
//   Andy, 2026-09-27: "so one more chat we need in the tabs, that's
//   group-chat. there we can design and add requirements. just the group
//   chat for me and the agents for now. no contract agreement tracking
//   yet." — "call it "team"" — "so we don't pullute a requirement with
//   out-of scope talks".
//
// The design-mode proposal (AGENTS-UI.md) cut down to what he asked for:
// a chat and nothing else. It rides as an ordinary thread whose todo is
// DESK_TEAM, which is on no board, so the List never shows it. His line
// goes to every agent heard from in the last day. An agent answers under
// the same todo to Andy AND to the other agent, so its line reaches Andy
// twice (once direct, once as the report of the agent-to-agent copy), and
// the chat folds that to one.
var DESK_TEAM = 'team/chat';
var DESK_RECENT_MS = 24 * 60 * 60 * 1000;
function deskTeamChat() {
  var lines = [];
  var seen = Object.create(null);
  deskMessages.forEach(function (m) {
    if (m.todo !== DESK_TEAM || m.kind === 'board') return;
    var who = m.dir === 'out' ? 'andy' : m.from;
    var fold = who + '\n' + m.kind + '\n' + m.text;
    var at = Date.parse(m.at) || 0;
    if (seen[fold] !== undefined && Math.abs(at - seen[fold]) < 60000) return;
    seen[fold] = at;
    lines.push(m);
  });
  if (!lines.length) return '<div class="job-manifest-note">Nothing said yet. What you write here goes to every agent.</div>';
  return lines.slice().reverse().map(function (m) {
    var look = m.dir === 'out'
      ? ' style="text-align:right;background:#000;color:#fff;padding:4px 8px;margin:4px 0"'
      : ' style="border-left:3px solid currentColor;padding-left:8px;margin:4px 0"';
    return '<div' + look + '><b>' + deskEsc(m.dir === 'out' ? 'you' : m.from) + '</b> <span class="job-manifest-note">' +
      deskTime(m.at) + '</span> ' + deskLineHtml(m) + '</div>';
  }).join('');
}

// All goes to every agent under the team todo; an agent's tab to that
// agent alone, with no todo.
function deskSendTeam() {
  if (deskAgentTab === '*') deskTeamPost('note');
  else deskSend('note', 'desk-team-say', 'desk-team-error', deskAgentTab);
}
// Ending design mode is his decision, said in Team: an `answer` with the
// fixed words, which Desk reads back (deskDesignOn) and the agents obey.
function deskEndDesign() { deskTeamPost('answer', DESK_END_DESIGN); }
function deskStartDesign() { deskTeamPost('answer', DESK_START_DESIGN); }
function deskTeamPost(kind, fixed) {
  var box = document.getElementById('desk-team-say');
  var err = document.getElementById('desk-team-error');
  var said = fixed || (box ? String(box.value || '').trim() : '');
  if (!said || deskSending['desk-team-say']) return;
  var to = Object.keys(deskAgents).filter(function (n) { return Date.now() - deskAgents[n].at < DESK_RECENT_MS; })
    .map(function (n) { return deskAgents[n].key; });
  if (!to.length) { if (err) err.textContent = 'No agent has written here in the last day, so there is nobody to send to.'; return; }
  deskSending['desk-team-say'] = true;
  if (err) err.textContent = 'Sending…';
  var body = { from: 'andy', kind: kind, text: said, todo: DESK_TEAM };
  Promise.all(to.map(function (key) {
    return deskApi.peerPost('agents', key, body, DESK_PATIENCE).then(function (r) { return deskOutgoing(key, body, r); },
      function (e) { return deskOutgoing(key, body, null, e); });
  })).then(function (msgs) {
    deskSending['desk-team-say'] = false;
    if (!fixed && box) box.value = '';
    if (err) err.textContent = '';
    return deskRecord(msgs);
  });
}

// ONE recipient, so one row in his record per line: nothing to fold.
// ONE SEND PER BOX AT A TIME. Andy's half-typed line reached the lead EIGHT
// times in 1.6 s: eight distinct posts from this page, because a held or
// repeated Enter fired again before the first send had cleared the box. So
// key auto-repeat is ignored, and a box with a send in flight sends nothing
// more until it settles.
var deskSending = Object.create(null);
// To the agent named, or to the lead.
function deskSend(kind, boxId, errId, name) {
  var box = document.getElementById(boxId);
  var said = box ? String(box.value || '').trim() : '';
  var err = document.getElementById(errId);
  if (!said || deskSending[boxId]) return;
  var to = name ? deskAgents[name] && deskAgents[name].key : deskLead && deskLead.key;
  if (!to) { if (err) err.textContent = name ? 'No key known for ' + name + '.' : 'No lead known yet.'; return; }
  // A MUSING SAYS WHAT IT IS. Andy: "\"note to self: \" should be a prefix in
  // the musings chat: I just typed that myself, and it highlights for your
  // compilers, what i usually would type into md files". Added once, and
  // never twice when he types it himself.
  if (kind === 'musing' && !/^note to self:/i.test(said)) said = 'note to self: ' + said;
  deskSending[boxId] = true;
  // It may wait up to a minute for a busy agent, so it says so.
  if (err) err.textContent = 'Sending…';
  var body = { from: 'andy', kind: kind, text: said };
  deskApi.peerPost('agents', to, body, DESK_PATIENCE).then(function (r) {
    deskSending[boxId] = false;
    box.value = '';
    if (err) err.textContent = '';
    return deskRecord([deskOutgoing(to, body, r)]);
  }).catch(function (e) { deskSending[boxId] = false; if (err) err.textContent = 'Not sent: ' + e.message; });
}

// A ROW OPENS ITS OWN DIALOG. Andy: "we need a DeskDetails immediately,
// with inputs specific to the item" — and the inline thread this replaced
// erased his typing on every arrival ("also my typing gets erased,
// everytime somebody sends something"). The table holds no input, so a
// repaint on arrival costs him nothing.
function deskDraw() {
  deskSessionSync();
  var el = document.getElementById('desk-top');
  if (!el) return;
  var musings = document.getElementById('desk-musings');
  if (musings) musings.innerHTML = deskMusings();
  var team = document.getElementById('desk-team');
  if (team) team.innerHTML = deskAgentTab === '*' ? deskTeamChat() : deskDirectChat(deskAgentTab);
  var label = document.getElementById('desk-team-label');
  if (label) label.textContent = deskAgentTab === '*' ? 'Team: you and every agent, newest first' : 'You and ' + deskAgentTab + ' alone, newest first';
  var bubble = document.getElementById('desk-session');
  if (bubble) bubble.innerHTML = deskSessionBubble();
  var goal = document.getElementById('desk-goal');
  if (goal) {
    var open = deskSession && !deskGoalDone();
    goal.hidden = !open;
    goal.textContent = open ? deskSession.goal.title + ' (' + deskSession.goal.id + ')' : '';
  }
  var design = deskDesignOn();
  var banner = document.getElementById('desk-design');
  if (banner) banner.hidden = !design;
  // A chat on screen is being seen as it arrives.
  if (deskTab === 'team') deskMarkChatSeen(deskTeamWhich());
  deskDrawTabs();
  deskDrawAgentTabs();
  el.innerHTML = (deskError ? '<div class="job-start-error">' + deskEsc(deskError) + '</div>' : '') +
    deskTable();
  // CLOSE: the line disappears at once; his "closed." goes to the agents
  // under that item and into Desk's log, so it stays away after a reload.
  Array.prototype.forEach.call(el.querySelectorAll('button[data-close]'), function (b) {
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var id = b.getAttribute('data-close');
      deskClosed[id] = true;
      deskDraw();
      var to = Object.keys(deskAgents).filter(function (n) { return Date.now() - deskAgents[n].at < DESK_RECENT_MS; })
        .map(function (n) { return deskAgents[n].key; });
      var body = { from: 'andy', kind: 'answer', text: 'closed.', todo: id };
      Promise.all(to.map(function (key) {
        return deskApi.peerPost('agents', key, body, DESK_PATIENCE).then(function (r) { return deskOutgoing(key, body, r); },
          function (err) { return deskOutgoing(key, body, null, err); });
      })).then(function (msgs) {
        // Kept in his log even when nobody could be reached: it is his decision.
        return deskRecord(msgs.length ? msgs : [deskOutgoing('', body, null, new Error('no agent reachable'))]);
      });
    });
  });
  Array.prototype.forEach.call(el.querySelectorAll('button[data-go]'), function (b) {
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var id = b.getAttribute('data-go');
      var ask = deskOpenAsk[id];
      if (!ask) return;
      // GONE AT ONCE, AND RUNNING. Andy: "when i say go. the go button on the
      // list and the detail become invisible immeadiately and are marked with
      // status "running"". Put back only if the send fails.
      delete deskOpenAsk[id];
      var before = deskDecision[id];
      deskDecision[id] = 'go';
      deskDraw();
      var body = { from: 'andy', kind: 'answer', text: 'go.', todo: id };
      deskApi.peerPost('agents', ask.peer, body, DESK_PATIENCE)
        .then(function (r) {
          // Answering is reacting, so the row's * clears as if opened. Andy:
          // "the red "*" should of course disappear once i reacted to them".
          deskMarkRowSeen(id);
          return deskRecord([deskOutgoing(ask.peer, body, r)]);
        })
        .catch(function (err) {
          deskOpenAsk[id] = ask;
          if (before === undefined) delete deskDecision[id]; else deskDecision[id] = before;
          deskError = 'Go! not sent: ' + err.message; deskDraw();
        });
    });
  });
  Array.prototype.forEach.call(el.querySelectorAll('tr[data-id]'), function (tr) {
    tr.addEventListener('click', function () { deskOpenRow(tr.getAttribute('data-id')); });
  });
}

// ONE ROW'S DIALOG, from the List or from the Team bubble. Andy: "i want to
// be able to click on items in the bubble in team and see the details".
function deskOpenRow(id) {
  // THE DIALOG READS ONLY ITS OWN FOLDER, so Desk hands it this row's
  // thread and the agents it can talk to, and takes back what Andy
  // sent from it (a new name, a decision, a line) when it closes, into
  // this log. Andy: "if i re-label the item ... the title in the list
  // should change."
  var thread = deskMessages.filter(function (m) { return m.todo === id; });
  // Opening a row is seeing it, and so is what arrived while it was open.
  deskMarkRowSeen(id);
  // DESIGN MODE RIDES IN THE CALL. Andy: "you can force the design mode
  // into the details dialog by paramet calling". The dialog shows it and
  // cannot end it; only Team can.
  deskApi.callDialog('app/deskDetails', { id: id, row: deskRowOf(id), thread: thread, agents: deskAgents,
    designMode: deskDesignOn(), session: deskSessionRows(), rules: deskSessionRules() })
    .then(function (result) {
      deskMarkRowSeen(id);
      return deskRecord((result && result.sent) || []).then(function () {
        // A line in its Blocked by / Blocking lists was clicked: go there.
        if (result && result.open && deskRowOf(result.open)) deskOpenRow(result.open);
      });
    });
}

// READ ONCE, AT MOUNT. The log is Desk's own file; a missing one is a Desk
// that has not heard anything yet, and a broken one is said, not drawn as
// an empty board.
//
// From the chunk still being written onward, until a file is missing: at
// mount that is every chunk, and before a save it is only what another
// tab may have added since. Every chunk before the last one found is
// sealed, and its lines are never written again.
function deskLoadLog() {
  for (var i = deskLastChunk; ; i += 1) {
    var name = deskChunkName(i);
    var raw = null;
    try { raw = deskApi.fs.loadFile(name); } catch (e) { raw = null; }
    if (!raw) return;
    var held = null;
    try { held = JSON.parse(raw); } catch (e) { held = null; }
    if (!Array.isArray(held)) { deskError = 'Desk\'s log (' + name + ') does not parse; it was left as it is.'; deskReadOnly = true; return; }
    held.forEach(deskFold);
    var next = null;
    try { next = deskApi.fs.loadFile(deskChunkName(i + 1)); } catch (e) { next = null; }
    if (!next) { deskLastChunk = i; return; }
    // A later chunk exists only once this one was sealed.
    held.forEach(function (m) { if (m && m.key) deskSealedKeys[m.key] = true; });
  }
}
// A LOG THAT DID NOT PARSE IS NEVER OVERWRITTEN by the next arrival's save.
var deskReadOnly = false;

spirit.shell.activateApp({
  mount: function (container, api) {
    deskApi = api;
    // ── THE TABS ───────────────────────────────────────────────────
    //
    //   Andy: "could the be, at the top of the window a set of tabs that
    //   allow me to switch from the list display, to chat with lead, to
    //   \"log musings\", so the vertical space here doesn't get annoying?"
    //   and "tabs would be a more standard approach, methinks".
    //
    // Switching shows one pane and hides the others; nothing is repainted,
    // so a half-typed line in any pane survives a switch. The inputs live
    // outside the repainted parts.
    container.innerHTML =
      // THE GOAL IS DESK'S TITLE. Andy: "the desk title bar should be synced
      // to the title of the goal, the game being: bring the goal item back up
      // to be ever closer to the title bar saying the same." Shown while a
      // design session's goal is open; the shell's own bar is not Desk's.
      '<div id="desk-goal" class="stat-tile wide" style="font-size:1.25em;font-weight:bold;cursor:pointer" title="Open the goal: talk about it under its own id" hidden></div>' +
      '<div id="desk-design" class="stat-tile wide" style="background:#fff3c4;color:#000" hidden>' +
        '<b>Design mode.</b> Nothing is built until it ends, and it ends only in the Team tab.</div>' +
      // Drawn by deskDrawTabs.
      '<div class="start-job-form card" id="desk-tabs"></div>' +
      '<div id="desk-root">' +
        '<div data-pane="list"><div id="desk-top"></div></div>' +
        '<div data-pane="team" hidden>' +
          // Drawn by deskDrawAgentTabs.
          '<div class="start-job-form card" id="desk-agent-tabs"></div>' +
          '<div id="desk-session"></div>' +
          '<div class="start-job-form card"><label class="field-label grow">Say' +
            '<input type="text" id="desk-team-say" placeholder="to every agent; design talk that belongs to no row"></label>' +
          '<button type="button" id="desk-team-send">Send</button></div>' +
          '<div id="desk-team-error" class="job-start-error"></div>' +
          '<div class="stat-tile wide"><div class="label" id="desk-team-label">Team: you and every agent, newest first</div><div id="desk-team"></div></div>' +
        '</div>' +
        '<div data-pane="musings" hidden>' +
          '<div class="start-job-form card"><label class="field-label grow">Muse' +
            '<input type="text" id="desk-muse" placeholder="a thought for later; nobody answers it now"></label>' +
          '<button type="button" id="desk-muse-send">Log</button></div>' +
          '<div id="desk-muse-error" class="job-start-error"></div>' +
          '<div class="stat-tile wide"><div class="label">Musings, for close time, newest first</div><div id="desk-musings"></div></div>' +
        '</div>' +
      '</div>';
    function show(tab) {
      Array.prototype.forEach.call(container.querySelectorAll('[data-pane]'), function (p) {
        p.hidden = p.getAttribute('data-pane') !== tab;
      });
      // HIGHLIGHTED, NOT DISABLED. Andy: "on the desk app, the current tab
      // should be highlighted." A disabled button read as greyed out.
      deskTab = tab;
      if (tab === 'team') deskMarkChatSeen(deskTeamWhich());
      deskDrawTabs();
    }
    // The strips are redrawn, so one listener on each, and the click may
    // land on the red * inside a button.
    function clicked(e, attr) {
      var el = e.target;
      while (el && el !== e.currentTarget && !(el.getAttribute && el.getAttribute(attr)) && !(el.id)) el = el.parentNode;
      return el && el !== e.currentTarget ? el : null;
    }
    document.getElementById('desk-tabs').addEventListener('click', function (e) {
      var el = clicked(e, 'data-tab');
      if (!el) return;
      if (el.id === 'desk-end-design') deskEndDesign();
      else if (el.id === 'desk-start-design') deskStartDesign();
      else if (el.getAttribute && el.getAttribute('data-tab')) show(el.getAttribute('data-tab'));
    });
    document.getElementById('desk-agent-tabs').addEventListener('click', function (e) {
      var el = clicked(e, 'data-agent');
      var who = el && el.getAttribute && el.getAttribute('data-agent');
      if (!who) return;
      deskAgentTab = who;
      var box = document.getElementById('desk-team-say');
      if (box) box.placeholder = who === '*' ? 'to every agent; design talk that belongs to no row' : 'to ' + who + ' alone, about anything that is not one row';
      deskDraw();
    });
    show('list');
    function onEnter(id, go) {
      document.getElementById(id).addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' || e.repeat) return;
        e.preventDefault();
        go();
      });
    }
    function muse() { deskSend('musing', 'desk-muse', 'desk-muse-error'); }
    document.getElementById('desk-muse-send').addEventListener('click', muse);
    onEnter('desk-muse', muse);
    document.getElementById('desk-team-send').addEventListener('click', deskSendTeam);
    // The bubble is repainted on every arrival, so one listener on its box.
    document.getElementById('desk-session').addEventListener('click', function (e) {
      if (e.target && e.target.getAttribute && e.target.getAttribute('data-fold') === 'session') {
        deskSeen.folds.session = !deskSeen.folds.session;
        deskSaveSeen();
        deskDraw();
        return;
      }
      var el = e.target;
      while (el && el !== e.currentTarget && !(el.getAttribute && el.getAttribute('data-open'))) el = el.parentNode;
      var id = el && el.getAttribute && el.getAttribute('data-open');
      if (id) deskOpenRow(id);
    });
    // THE TITLE LINE OPENS THE GOAL. Andy: "if i could also click on the
    // title to move the discussion to the detail of the requirement, then
    // our discussion would be logged under that requirement".
    document.getElementById('desk-goal').addEventListener('click', function () {
      if (deskSession && !deskGoalDone()) deskOpenRow(String(deskSession.goal.id));
    });
    onEnter('desk-team-say', deskSendTeam);
    // Its own log first, then every arrival into it. Subscribed once, at
    // mount, and kept while Desk is hidden behind its dialog, so what
    // arrives while a row is open is logged too.
    deskLoadLog();
    deskLoadSeen();
    deskDraw();
    deskSaveState();
    deskApi.onPacket('agents', function (body, message) { deskRecord([deskArrival(body, message)]); });
  },
});
