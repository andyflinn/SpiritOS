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
// So Desk asks the node for nothing but what every app has. What passed
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
function deskSave() {
  if (deskReadOnly) return deskSaving;
  deskSaving = deskSaving.then(function () {
    return deskApi.fs.saveFile(DESK_LOG, JSON.stringify(deskMessages));
  }).catch(function (e) { deskError = 'Desk could not write its log: ' + e.message; deskDraw(); });
  return deskSaving;
}

// Into the log and onto the screen.
function deskRecord(msgs) {
  msgs.forEach(function (m) { if (m) deskFold(m); });
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

function deskTable() {
  if (!deskBoard) {
    return '<div class="job-manifest-note">No board has reached this node yet. The lead ' +
      'posts one whenever its test run changes it.</div>';
  }
  var head = '<tr><th>#</th><th>to-do</th><th>with</th><th>your decision</th><th>frees</th><th>waits on</th><th>there</th><th>owed since</th></tr>';
  var body = deskBoard.rows.map(function (row) {
    var waits = (row.waitsOn || []).map(function (w) { return typeof w === 'string' ? w : (w.id || ''); }).join(', ');
    return '<tr data-id="' + deskEsc(row.id) + '" style="cursor:pointer">' +
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
function deskLeadChat() {
  if (!deskLead) return '<div class="job-manifest-note">No lead has posted a board here yet, so there is nobody to talk to.</div>';
  var lines = [];
  deskMessages.forEach(function (m) {
    if (m.todo || m.reported || m.kind === 'board' || m.kind === 'report') return;
    if (m.kind === 'note' && /^taking(\s|$)/.test(m.text)) return;
    var mine = m.dir === 'out' && m.peer === deskLead.key;
    var theirs = m.dir === 'in' && m.from === deskLead.name;
    if (!mine && !theirs) return;
    lines.push(m);
  });
  if (!lines.length) return '<div class="job-manifest-note">Nothing said yet.</div>';
  return lines.map(function (m) {
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
  return lines.map(function (m) {
    return '<div><span class="job-manifest-note">' + deskEsc(m.at) + '</span> ' + deskEsc(m.text) + '</div>';
  }).join('');
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
  var body = { from: 'andy', kind: kind, text: said };
  deskApi.peerPost('agents', deskLead.key, body).then(function (r) {
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
      deskApi.peerPost('agents', ask.peer, body)
        .then(function (r) { return deskRecord([deskOutgoing(ask.peer, body, r)]); })
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
      deskApi.callDialog('app/deskDetails', { id: id, row: deskRowOf(id), thread: thread, agents: deskAgents })
        .then(function (result) { return deskRecord((result && result.sent) || []); });
    });
  });
}

// READ ONCE, AT MOUNT. The log is Desk's own file; a missing one is a Desk
// that has not heard anything yet, and a broken one is said, not drawn as
// an empty board.
function deskLoadLog() {
  var raw = null;
  try { raw = deskApi.fs.loadFile(DESK_LOG); } catch (e) { raw = null; }
  if (!raw) return;
  var held = null;
  try { held = JSON.parse(raw); } catch (e) { held = null; }
  if (!Array.isArray(held)) { deskError = 'Desk\'s log (' + DESK_LOG + ') does not parse; it was left as it is.'; deskReadOnly = true; return; }
  held.forEach(deskFold);
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
        '<button type="button" data-tab="musings">Musings</button>' +
      '</div>' +
      '<div id="desk-root">' +
        '<div data-pane="list"><div id="desk-top"></div></div>' +
        '<div data-pane="lead" hidden>' +
          '<div class="stat-tile wide"><div class="label">Talk to the lead</div><div id="desk-chat"></div></div>' +
          '<div class="start-job-form card"><label class="field-label grow">Say' +
            '<input type="text" id="desk-say" placeholder="to the lead, about anything that is not one row"></label>' +
          '<button type="button" id="desk-say-send">Send</button></div>' +
          '<div id="desk-say-error" class="job-start-error"></div>' +
        '</div>' +
        '<div data-pane="musings" hidden>' +
          '<div class="stat-tile wide"><div class="label">Musings, for close time</div><div id="desk-musings"></div></div>' +
          '<div class="start-job-form card"><label class="field-label grow">Muse' +
            '<input type="text" id="desk-muse" placeholder="a thought for later; nobody answers it now"></label>' +
          '<button type="button" id="desk-muse-send">Log</button></div>' +
          '<div id="desk-muse-error" class="job-start-error"></div>' +
        '</div>' +
      '</div>';
    function show(tab) {
      Array.prototype.forEach.call(container.querySelectorAll('[data-pane]'), function (p) {
        p.hidden = p.getAttribute('data-pane') !== tab;
      });
      Array.prototype.forEach.call(container.querySelectorAll('[data-tab]'), function (b) {
        b.disabled = b.getAttribute('data-tab') === tab;
      });
    }
    document.getElementById('desk-tabs').addEventListener('click', function (e) {
      var tab = e.target && e.target.getAttribute && e.target.getAttribute('data-tab');
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
    // Its own log first, then every arrival into it. Subscribed once, at
    // mount, and kept while Desk is hidden behind its dialog, so what
    // arrives while a row is open is logged too.
    deskLoadLog();
    deskDraw();
    deskApi.onPacket('agents', function (body, message) { deskRecord([deskArrival(body, message)]); });
  },
});
