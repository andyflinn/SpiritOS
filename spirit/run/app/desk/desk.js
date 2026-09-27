// spirit/run/app/desk/desk.js
// ANDY'S DESK FOR TALKING TO THE AGENTS — design/shell/AGENTS-UI.md.
//
//   Andy, 2026-09-27: "it would allow me to send input without
//   interrupting any of you, and your attention can thus be better
//   organized, too" — "my input will be queued, any agent can adress
//   issues in the table, respons to me under that heading".
//
// A REAL APP, and only the app contract: the board and every thread come
// out of this node's own record through `node.history`, and everything
// Andy writes leaves as an ordinary `agents` packet through `peerPost`.
// No reach of its own, no store of its own.
//
// ── THE THREAD KEY IS THE FULL ID ────────────────────────────────────
//
// A row is keyed by `id` (`puppets/G6`), never by the handle it prints:
// the handle is the shortest form unique today and can lengthen, which
// would orphan a thread keyed on it. Andy never types either — the app
// attaches the id to what he writes, which is what lets his text reach
// voice.jsonl clean (the lead's courier, never this page).
//
// ── THE NODE FILTERS NOTHING; THIS PAGE DOES ─────────────────────────
//
// `node.history` hands back rows with no filter on app or body
// (hub.js:1278). Sorting them into threads by `body.todo` is this page's
// job, done once on the first read — Andy: "the initial load is a
// "search" ... a lot of the traffic is random access on rows."

var DESK_PAGE = 200;

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

// One history row -> one agents message, or null when it is not one.
function deskDecode(row) {
  if (!row || typeof row.payload !== 'string') return null;
  var env;
  try { env = JSON.parse(row.payload); } catch (e) { return null; }
  if (!env || env.app !== 'agents' || !env.body) return null;
  // A REPORT CARRIES A WHOLE MESSAGE BETWEEN AGENTS (agents.js reportOf),
  // read here as that message, from its own sender. That is what makes
  // this node Andy's "overall record of our activities", and it is how
  // one agent's `taking`, sent to the other, still reaches the column.
  if (env.body.kind === 'report') {
    var inner = null;
    try { inner = JSON.parse(env.body.text); } catch (e) { inner = null; }
    if (!inner || inner.v !== 1 || !inner.kind) return null;
    return {
      hash: row.hash, at: row.at, dir: row.dir, peer: '', outcome: String(inner.outcome || ''),
      from: String(inner.from || ''), to: String(inner.to || ''), kind: String(inner.kind),
      text: String(inner.text || ''), todo: inner.todo ? String(inner.todo) : '', reported: true,
    };
  }
  return {
    hash: row.hash, at: row.at, dir: row.dir, peer: row.peer, outcome: row.outcome,
    from: String(env.body.from || ''), kind: String(env.body.kind || ''),
    text: String(env.body.text || ''), todo: env.body.todo ? String(env.body.todo) : '',
  };
}

// Folds one message in by hash: a later outcome for a message already
// held replaces its outcome and nothing else (trafficLog.history).
function deskFold(msg) {
  var held = deskByHash[msg.hash];
  if (held) { held.outcome = msg.outcome; return; }
  deskByHash[msg.hash] = msg;
  deskMessages.push(msg);
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
      ? ' style="text-align:right;opacity:0.8"'
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
function deskSend(kind, boxId, errId) {
  var box = document.getElementById(boxId);
  var said = box ? String(box.value || '').trim() : '';
  var err = document.getElementById(errId);
  if (!said) return;
  if (!deskLead) { if (err) err.textContent = 'No lead known yet.'; return; }
  // A MUSING SAYS WHAT IT IS. Andy: "\"note to self: \" should be a prefix in
  // the musings chat: I just typed that myself, and it highlights for your
  // compilers, what i usually would type into md files". Added once, and
  // never twice when he types it himself.
  if (kind === 'musing' && !/^note to self:/i.test(said)) said = 'note to self: ' + said;
  deskApi.peerPost('agents', deskLead.key, { from: 'andy', kind: kind, text: said }).then(function () {
    box.value = '';
    if (err) err.textContent = '';
    return deskLoadNew();
  }).catch(function (e) { if (err) err.textContent = 'Not sent: ' + e.message; });
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
      deskApi.peerPost('agents', ask.peer, { from: 'andy', kind: 'answer', text: 'go.', todo: id })
        .then(function () { return deskLoadNew(); })
        .catch(function (err) { b.disabled = false; deskError = 'Go! not sent: ' + err.message; deskDraw(); });
    });
  });
  Array.prototype.forEach.call(el.querySelectorAll('tr[data-id]'), function (tr) {
    tr.addEventListener('click', function () {
      var id = tr.getAttribute('data-id');
      // Read the record again when the dialog closes: what he did in it
      // (a new name, a decision) left as HIS post, and only arrivals wake
      // this page. Andy: "if i re-label the item ... the title in the list
      // should change."
      deskApi.callDialog('app/deskDetails', { id: id, row: deskRowOf(id) }).then(function () { return deskLoadNew(); });
    });
  });
}

// THE SEARCH, THEN THE CURSOR. From position 0 this reads the whole record
// once, a page at a time; after that `deskAfter` is where the record had
// got to, so a later call reads only what is new.
var deskAfter = 0;
function deskLoadNew() {
  return deskApi.verb('node.history', { after: deskAfter, limit: DESK_PAGE }).then(function (r) {
    var body = r && r.body;
    // A REFUSAL IS SAID, NEVER DRAWN AS AN EMPTY BOARD. A node older than
    // node.history answers "unknown verb", and a page that swallowed that
    // told Andy no board had arrived while five sat in his log.
    if (!body || !body.ok) {
      deskError = 'This node could not hand over its record: ' +
        ((body && body.error) || (r && r.status) || 'no answer') +
        '. A node started before node.history (a660e43) needs a restart.';
      deskDraw();
      return;
    }
    deskError = '';
    body.rows.forEach(function (row) { var m = deskDecode(row); if (m) deskFold(m); });
    deskAfter = body.next;
    deskDraw();
    if (body.more) return deskLoadNew();
    return null;
  });
}

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
        if (e.key !== 'Enter') return;
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
    deskDraw();
    // The first read is the search; after it, `deskAfter` follows the
    // record and a live arrival just asks for what is new.
    deskLoadNew().then(function () {
      deskApi.onPacket('agents', function () { deskLoadNew(); });
    }, function (e) {
      deskError = 'Could not read this node\'s record: ' + e.message;
      deskDraw();
    });
  },
});
