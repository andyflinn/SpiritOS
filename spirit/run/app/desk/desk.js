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
// WHICH AGENT HAS A ROW. Andy: "a column for the agent label would be
// appropriate". Nothing in the tree records it; the claims do, in this
// node's own record: the newest `taking` note per full id.
var deskTaken = Object.create(null);

// One history row -> one agents message, or null when it is not one.
function deskDecode(row) {
  if (!row || typeof row.payload !== 'string') return null;
  var env;
  try { env = JSON.parse(row.payload); } catch (e) { return null; }
  if (!env || env.app !== 'agents' || !env.body) return null;
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
  if (msg.kind === 'board') {
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
  var head = '<tr><th>#</th><th>to-do</th><th>with</th><th>frees</th><th>waits on</th><th>there</th><th>owed since</th></tr>';
  var body = deskBoard.rows.map(function (row) {
    var waits = (row.waitsOn || []).map(function (w) { return typeof w === 'string' ? w : (w.id || ''); }).join(', ');
    return '<tr data-id="' + deskEsc(row.id) + '" style="cursor:pointer">' +
      '<td>' + deskEsc(row.rank) + '</td>' +
      '<td>' + deskEsc(row.title) + ' <span class="job-manifest-note">(' + deskEsc(row.handle) + ')</span></td>' +
      '<td>' + deskEsc(deskTaken[row.id] || '') + '</td>' +
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

// A ROW OPENS ITS OWN DIALOG. Andy: "we need a DeskDetails immediately,
// with inputs specific to the item" — and the inline thread this replaced
// erased his typing on every arrival ("also my typing gets erased,
// everytime somebody sends something"). The table holds no input, so a
// repaint on arrival costs him nothing.
function deskDraw() {
  var el = document.getElementById('desk-root');
  if (!el) return;
  el.innerHTML = (deskError ? '<div class="job-start-error">' + deskEsc(deskError) + '</div>' : '') +
    deskTable();
  Array.prototype.forEach.call(el.querySelectorAll('tr[data-id]'), function (tr) {
    tr.addEventListener('click', function () {
      var id = tr.getAttribute('data-id');
      deskApi.callDialog('app/deskDetails', { id: id, row: deskRowOf(id) });
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
    container.innerHTML = '<div id="desk-root"></div>';
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
