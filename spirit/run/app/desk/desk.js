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

var DESK_LOG = 'log.json';

// A BUSY AGENT IS WAITED FOR, NOT BOUNCED. Andy's line came back
// "(undelivered: target is busy)" because a post got one attempt. With
// his go, peer.post takes a patience and the node retries a busy target
// with backoff; Desk asks for a minute. What the log records is the final
// outcome, after that minute, never the first refusal.
var DESK_PATIENCE = { patienceMs: 60000 };

var deskApi = null;
var deskBoard = null;       // the newest `board` packet's JSON
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
function deskChunkName(i) { return i === 0 ? DESK_LOG : 'log-' + i + '.json'; }
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
var DESK_VOICE = 'voice.jsonl';
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
      var name = i === 1 ? DESK_VOICE : 'voice-' + i + '.jsonl';
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
  return deskSave();
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
  }
  if (msg.todo && !msg.reported && msg.dir === 'in' && msg.kind === 'ask' && msg.peer) deskOpenAsk[msg.todo] = msg;
  if (msg.todo && msg.dir === 'out' && msg.kind === 'answer') delete deskOpenAsk[msg.todo];
  if (msg.dir === 'out' && msg.todo && msg.kind === 'answer' && DESK_DECISIONS[msg.text]) {
    deskDecision[msg.todo] = DESK_DECISIONS[msg.text];
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
var deskSeen = { rows: {}, lead: 0, team: 0 };
var deskTab = 'list';

function deskIsLeadLine(m) {
  if (!deskLead) return false;
  if (m.todo || m.reported || m.kind === 'board' || m.kind === 'report') return false;
  if (m.kind === 'note' && /^taking(\s|$)/.test(m.text)) return false;
  return (m.dir === 'out' && m.peer === deskLead.key) || (m.dir === 'in' && m.from === deskLead.name);
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
function deskChatNews(which) {
  return deskNewest(which === 'lead' ? deskIsLeadLine : deskIsTeamLine) > (deskSeen[which] || 0);
}

function deskSaveSeen() {
  try { deskApi.fs.saveFile(DESK_SEEN, JSON.stringify(deskSeen)); } catch (e) { /* only a marker */ }
}
function deskMarkRowSeen(id) {
  var newest = deskNewest(deskIsRowLine(id));
  if (newest > (deskSeen.rows[id] || 0)) { deskSeen.rows[id] = newest; deskSaveSeen(); }
}
function deskMarkChatSeen(which) {
  var newest = deskNewest(which === 'lead' ? deskIsLeadLine : deskIsTeamLine);
  if (newest > (deskSeen[which] || 0)) { deskSeen[which] = newest; deskSaveSeen(); }
}

// Read once at mount, after the log. Absent: all already held is seen.
function deskLoadSeen() {
  var raw = null;
  try { raw = deskApi.fs.loadFile(DESK_SEEN); } catch (e) { raw = null; }
  var held = null;
  try { held = raw ? JSON.parse(raw) : null; } catch (e) { held = null; }
  if (held && typeof held === 'object') {
    deskSeen = { rows: held.rows && typeof held.rows === 'object' ? held.rows : {}, lead: Number(held.lead) || 0, team: Number(held.team) || 0 };
    return;
  }
  var ids = Object.create(null);
  deskMessages.forEach(function (m) { if (m.todo && m.todo !== DESK_TEAM) ids[m.todo] = true; });
  Object.keys(ids).forEach(function (id) { deskSeen.rows[id] = deskNewest(deskIsRowLine(id)); });
  deskSeen.lead = deskNewest(deskIsLeadLine);
  deskSeen.team = deskNewest(deskIsTeamLine);
  deskSaveSeen();
}

// The tab strip: the one showing is marked, and a red * before a title
// says something arrived there that he has not seen.
function deskDrawTabs() {
  var strip = document.getElementById('desk-tabs');
  if (!strip || !strip.querySelectorAll) return;
  var listNews = deskBoard ? deskBoard.rows.some(function (r) { return deskRowNews(r.id); }) : false;
  var news = { list: listNews, lead: deskChatNews('lead'), team: deskChatNews('team'), musings: false };
  var names = { list: 'List', lead: 'Lead', team: 'Team', musings: 'Musings' };
  Array.prototype.forEach.call(strip.querySelectorAll('[data-tab]'), function (b) {
    var tab = b.getAttribute('data-tab');
    var on = tab === deskTab;
    b.innerHTML = (news[tab] ? DESK_UNSEEN + ' ' : '') + deskEsc(names[tab] || tab);
    b.style.fontWeight = on ? 'bold' : 'normal';
    b.style.textDecoration = on ? 'underline' : 'none';
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

function deskTable() {
  if (!deskBoard) {
    return '<div class="job-manifest-note">No board has reached this node yet. The lead ' +
      'posts one whenever its test run changes it.</div>';
  }
  var head = '<tr><th></th><th>#</th><th>to-do</th><th>with</th><th>your decision</th><th>frees</th><th>waits on</th><th>there</th><th>owed since</th></tr>';
  var body = deskBoard.rows.map(function (row) {
    var waits = (row.waitsOn || []).map(function (w) { return typeof w === 'string' ? w : (w.id || ''); }).join(', ');
    return '<tr data-id="' + deskEsc(row.id) + '" style="cursor:pointer">' +
      '<td>' + (deskRowNews(row.id) ? DESK_UNSEEN : '') + '</td>' +
      '<td>' + deskEsc(row.rank) + '</td>' +
      '<td title="' + deskEsc(row.title) + '">' + deskEsc(deskLabel[row.id] || row.title) +
        ' <span class="job-manifest-note">(' + deskEsc(row.handle) + ')</span></td>' +
      '<td>' + deskEsc(deskTaken[row.id] || '') + '</td>' +
      '<td>' + (deskOpenAsk[row.id]
        ? '<button type="button" data-go="' + deskEsc(row.id) + '" title="' + deskEsc(deskOpenAsk[row.id].text) + '">Go!</button>'
        : deskEsc(deskDecision[row.id] || '')) + '</td>' +
      '<td>' + deskEsc(row.frees == null ? '' : row.frees) + '</td>' +
      '<td>' + deskEsc(waits) + '</td>' +
      '<td>' + deskEsc(row.there == null ? '' : row.there + '%') + '</td>' +
      '<td>' + deskEsc(row.owedSince || '') + '</td>' +
    '</tr>';
  }).join('');
  var stale = deskBoard.stale ? ' — measured at ' + deskEsc(deskBoard.commit) + ', behind ' + deskEsc(deskBoard.head) : '';
  return '<div class="job-manifest-note">Board from ' + deskEsc(deskBoard.box) + stale + '</div>' +
    '<table class="jobs-table"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
}

function deskRowOf(id) {
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
function deskLeadChat() {
  if (!deskLead) return '<div class="job-manifest-note">No lead has posted a board here yet, so there is nobody to talk to.</div>';
  var lines = deskMessages.filter(deskIsLeadLine);
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
    return '<div' + look + '><b>' + deskEsc(who) + '</b> <span class="job-manifest-note">' + deskEsc(m.at) +
      '</span> ' + deskEsc(m.text) + '</div>';
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
    return '<div><span class="job-manifest-note">' + deskEsc(m.at) + '</span> ' + deskEsc(m.text) + '</div>';
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
      deskEsc(m.at) + '</span> ' + deskEsc(m.text) + '</div>';
  }).join('');
}

function deskSendTeam() {
  var box = document.getElementById('desk-team-say');
  var err = document.getElementById('desk-team-error');
  var said = box ? String(box.value || '').trim() : '';
  if (!said || deskSending['desk-team-say']) return;
  var to = Object.keys(deskAgents).filter(function (n) { return Date.now() - deskAgents[n].at < DESK_RECENT_MS; })
    .map(function (n) { return deskAgents[n].key; });
  if (!to.length) { if (err) err.textContent = 'No agent has written here in the last day, so there is nobody to send to.'; return; }
  deskSending['desk-team-say'] = true;
  if (err) err.textContent = 'Sending…';
  var body = { from: 'andy', kind: 'note', text: said, todo: DESK_TEAM };
  Promise.all(to.map(function (key) {
    return deskApi.peerPost('agents', key, body, DESK_PATIENCE).then(function (r) { return deskOutgoing(key, body, r); },
      function (e) { return deskOutgoing(key, body, null, e); });
  })).then(function (msgs) {
    deskSending['desk-team-say'] = false;
    box.value = '';
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
function deskSend(kind, boxId, errId) {
  var box = document.getElementById(boxId);
  var said = box ? String(box.value || '').trim() : '';
  var err = document.getElementById(errId);
  if (!said || deskSending[boxId]) return;
  if (!deskLead) { if (err) err.textContent = 'No lead known yet.'; return; }
  // A MUSING SAYS WHAT IT IS. Andy: "\"note to self: \" should be a prefix in
  // the musings chat: I just typed that myself, and it highlights for your
  // compilers, what i usually would type into md files". Added once, and
  // never twice when he types it himself.
  if (kind === 'musing' && !/^note to self:/i.test(said)) said = 'note to self: ' + said;
  deskSending[boxId] = true;
  // It may wait up to a minute for a busy agent, so it says so.
  if (err) err.textContent = 'Sending…';
  var body = { from: 'andy', kind: kind, text: said };
  deskApi.peerPost('agents', deskLead.key, body, DESK_PATIENCE).then(function (r) {
    deskSending[boxId] = false;
    box.value = '';
    if (err) err.textContent = '';
    return deskRecord([deskOutgoing(deskLead.key, body, r)]);
  }).catch(function (e) { deskSending[boxId] = false; if (err) err.textContent = 'Not sent: ' + e.message; });
}

// A ROW OPENS ITS OWN DIALOG. Andy: "we need a DeskDetails immediately,
// with inputs specific to the item" — and the inline thread this replaced
// erased his typing on every arrival ("also my typing gets erased,
// everytime somebody sends something"). The table holds no input, so a
// repaint on arrival costs him nothing.
function deskDraw() {
  var el = document.getElementById('desk-top');
  if (!el) return;
  var chat = document.getElementById('desk-chat');
  if (chat) chat.innerHTML = deskLeadChat();
  var musings = document.getElementById('desk-musings');
  if (musings) musings.innerHTML = deskMusings();
  var team = document.getElementById('desk-team');
  if (team) team.innerHTML = deskTeamChat();
  // A chat on screen is being seen as it arrives.
  if (deskTab === 'lead' || deskTab === 'team') deskMarkChatSeen(deskTab);
  deskDrawTabs();
  el.innerHTML = (deskError ? '<div class="job-start-error">' + deskEsc(deskError) + '</div>' : '') +
    deskTable();
  Array.prototype.forEach.call(el.querySelectorAll('button[data-go]'), function (b) {
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var id = b.getAttribute('data-go');
      var ask = deskOpenAsk[id];
      if (!ask) return;
      b.disabled = true;
      var body = { from: 'andy', kind: 'answer', text: 'go.', todo: id };
      deskApi.peerPost('agents', ask.peer, body, DESK_PATIENCE)
        .then(function (r) {
          // Answering is reacting, so the row's * clears as if opened. Andy:
          // "the red "*" should of course disappear once i reacted to them".
          deskMarkRowSeen(id);
          return deskRecord([deskOutgoing(ask.peer, body, r)]);
        })
        .catch(function (err) { b.disabled = false; deskError = 'Go! not sent: ' + err.message; deskDraw(); });
    });
  });
  Array.prototype.forEach.call(el.querySelectorAll('tr[data-id]'), function (tr) {
    tr.addEventListener('click', function () {
      var id = tr.getAttribute('data-id');
      // THE DIALOG READS ONLY ITS OWN FOLDER, so Desk hands it this row's
      // thread and the agents it can talk to, and takes back what Andy
      // sent from it (a new name, a decision, a line) when it closes, into
      // this log. Andy: "if i re-label the item ... the title in the list
      // should change."
      var thread = deskMessages.filter(function (m) { return m.todo === id; });
      // Opening a row is seeing it, and so is what arrived while it was open.
      deskMarkRowSeen(id);
      deskApi.callDialog('app/deskDetails', { id: id, row: deskRowOf(id), thread: thread, agents: deskAgents })
        .then(function (result) {
          deskMarkRowSeen(id);
          return deskRecord((result && result.sent) || []);
        });
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
    // ── THREE TABS ─────────────────────────────────────────────────
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
      '<div class="start-job-form card" id="desk-tabs">' +
        '<button type="button" data-tab="list">List</button>' +
        '<button type="button" data-tab="lead">Lead</button>' +
        '<button type="button" data-tab="team">Team</button>' +
        '<button type="button" data-tab="musings">Musings</button>' +
      '</div>' +
      '<div id="desk-root">' +
        '<div data-pane="list"><div id="desk-top"></div></div>' +
        '<div data-pane="lead" hidden>' +
          '<div class="start-job-form card"><label class="field-label grow">Say' +
            '<input type="text" id="desk-say" placeholder="to the lead, about anything that is not one row"></label>' +
          '<button type="button" id="desk-say-send">Send</button></div>' +
          '<div id="desk-say-error" class="job-start-error"></div>' +
          '<div class="stat-tile wide"><div class="label">Talk to the lead, newest first</div><div id="desk-chat"></div></div>' +
        '</div>' +
        '<div data-pane="team" hidden>' +
          '<div class="start-job-form card"><label class="field-label grow">Say' +
            '<input type="text" id="desk-team-say" placeholder="to every agent; design talk that belongs to no row"></label>' +
          '<button type="button" id="desk-team-send">Send</button></div>' +
          '<div id="desk-team-error" class="job-start-error"></div>' +
          '<div class="stat-tile wide"><div class="label">Team: you and every agent, newest first</div><div id="desk-team"></div></div>' +
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
      if (tab === 'lead' || tab === 'team') deskMarkChatSeen(tab);
      deskDrawTabs();
    }
    document.getElementById('desk-tabs').addEventListener('click', function (e) {
      // The click may land on the red * inside the button.
      var el = e.target;
      while (el && el !== e.currentTarget && !(el.getAttribute && el.getAttribute('data-tab'))) el = el.parentNode;
      var tab = el && el.getAttribute && el.getAttribute('data-tab');
      if (tab) show(tab);
    });
    show('list');
    function onEnter(id, go) {
      document.getElementById(id).addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' || e.repeat) return;
        e.preventDefault();
        go();
      });
    }
    function say() { deskSend('note', 'desk-say', 'desk-say-error'); }
    function muse() { deskSend('musing', 'desk-muse', 'desk-muse-error'); }
    document.getElementById('desk-say-send').addEventListener('click', say);
    document.getElementById('desk-muse-send').addEventListener('click', muse);
    onEnter('desk-say', say);
    onEnter('desk-muse', muse);
    document.getElementById('desk-team-send').addEventListener('click', deskSendTeam);
    onEnter('desk-team-say', deskSendTeam);
    // Its own log first, then every arrival into it. Subscribed once, at
    // mount, and kept while Desk is hidden behind its dialog, so what
    // arrives while a row is open is logged too.
    deskLoadLog();
    deskLoadSeen();
    deskDraw();
    deskApi.onPacket('agents', function (body, message) { deskRecord([deskArrival(body, message)]); });
  },
});
