// spirit/run/app/deskDetails/deskDetails.js
// ONE ROW OF THE DESK, AS A DIALOG — design/shell/AGENTS-UI.md.
//
//   Andy, 2026-09-27: "we need a DeskDetails immediately, with inputs
//   specific to the item" — the issueDetails he saw "on the horizon" an
//   hour earlier, the Details pattern Natter and Contacts already use.
//
// WHAT FITS WHICH KIND:
//   to-do       say something; ask for an explanation; propose a title
//   dependency  Accept or Reject, then say something
//   question    answer it, then say something
// Every input leaves as an `agents` packet carrying the row's FULL id as
// `todo`, to every agent this node has heard from. The node signs.
//
// The thread is read the way Desk reads it: node.history, filtered HERE
// by `body.todo` — the node filters nothing (hub.js:1278).

var ddApi = null;
var ddRow = null;           // the board row, as Desk handed it over
var ddId = '';              // its full id — the thread key
var ddThread = [];
var ddAgents = Object.create(null);
var ddNote = '';

function ddEsc(s) { return ddApi.escapeHtml(String(s == null ? '' : s)); }

function ddDecode(row) {
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

// The whole record, a page at a time by position, keeping this row's
// messages and learning who the agents are on the way.
function ddLoad() {
  var byHash = Object.create(null);
  var list = [];
  function page(after) {
    return ddApi.verb('node.history', { after: after, limit: 200 }).then(function (r) {
      var body = r && r.body;
      if (!body || !body.ok) {
        throw new Error((body && body.error) || (r && r.status) || 'no answer');
      }
      body.rows.forEach(function (row) {
        var m = ddDecode(row);
        if (!m) return;
        if (m.dir === 'in' && m.from && m.peer) ddAgents[m.from] = m.peer;
        if (m.todo !== ddId) return;
        if (byHash[m.hash]) { byHash[m.hash].outcome = m.outcome; return; }
        byHash[m.hash] = m;
        list.push(m);
      });
      if (body.more && body.next > after) return page(body.next);
      return null;
    });
  }
  return page(0).then(function () {
    ddThread = list;
    ddNote = '';
    ddDraw();
  }, function (e) {
    ddNote = 'This node could not hand over its record: ' + e.message + '.';
    ddDraw();
  });
}

function ddFacts() {
  var r = ddRow || {};
  var waits = (r.waitsOn || []).map(function (w) { return typeof w === 'string' ? w : (w.id || ''); }).join(', ');
  var rows = [
    ['id', ddId],
    ['kind', r.kind],
    ['rank', r.rank],
    ['frees', r.frees],
    ['waits on', waits],
    ['there', r.there == null ? '' : r.there + '%'],
    ['owed since', r.owedSince],
    ['blocked', r.blocked],
  ].filter(function (p) { return p[1] !== undefined && p[1] !== null && p[1] !== ''; });
  var edges = (r.edges || []).map(function (e) {
    return '<div>' + ddEsc(e.fromHandle || e.from) + ' waits on ' + ddEsc(e.toHandle || e.to) + '</div>';
  }).join('');
  return '<table class="jobs-table"><tbody>' + rows.map(function (p) {
    return '<tr><td>' + ddEsc(p[0]) + '</td><td>' + ddEsc(p[1]) + '</td></tr>';
  }).join('') + '</tbody></table>' + (edges ? '<div class="job-manifest-note">' + edges + '</div>' : '');
}

function ddThreadHtml() {
  if (!ddThread.length) return '<div class="job-manifest-note">Nothing said about this row yet.</div>';
  return ddThread.map(function (m) {
    var who = m.dir === 'out' ? 'you' : m.from;
    var failed = m.dir === 'out' && m.outcome && m.outcome !== 'sent' && m.outcome !== 'delivered'
      ? ' <span class="job-start-error">(' + ddEsc(m.outcome) + ')</span>' : '';
    return '<div><b>' + ddEsc(who) + '</b> <span class="job-manifest-note">' + ddEsc(m.kind) +
      ' · ' + ddEsc(m.at) + '</span>' + failed + '<div>' + ddEsc(m.text) + '</div></div>';
  }).join('');
}

// THE INPUTS THAT FIT THIS KIND, above the general "say" box.
function ddInputs() {
  var kind = ddRow && ddRow.kind;
  var specific = '';
  if (kind === 'dependency') {
    specific =
      '<div class="start-job-form card">' +
        '<button type="button" id="dd-accept">Accept</button>' +
        '<button type="button" id="dd-reject">Reject</button>' +
      '</div>';
  } else if (kind === 'question') {
    specific =
      '<div class="start-job-form card"><label class="field-label grow">Answer' +
        '<input type="text" id="dd-answer" placeholder="your ruling on this question"></label>' +
        '<button type="button" id="dd-answer-send">Answer</button></div>';
  } else {
    specific =
      '<div class="start-job-form card">' +
        '<button type="button" id="dd-explain">Explain this to me</button>' +
      '</div>' +
      '<div class="start-job-form card"><label class="field-label grow">Better title' +
        '<input type="text" id="dd-title" placeholder="what you would call it"></label>' +
        '<button type="button" id="dd-title-send">Propose</button></div>';
  }
  return specific +
    '<div class="start-job-form card"><label class="field-label grow">Say' +
      '<input type="text" id="dd-say" placeholder="to every agent, under this row"></label>' +
      '<button type="button" id="dd-say-send">Send</button></div>';
}

// ── A REPAINT NEVER TOUCHES WHAT ANDY IS TYPING ─────────────────────
//
//   Andy, on Desk's first hour: "also my typing gets erased, everytime
//   somebody sends something"
//
// A reply arriving reloads the thread, and repainting the whole body took
// the input boxes with it. So the body is three parts: the facts and the
// thread are repainted on every load, and the inputs are drawn ONCE per
// open(), when the row changes and nothing is half-typed yet.
function ddFrame() {
  var el = document.getElementById('dd-body');
  if (!el) return;
  el.innerHTML =
    '<div class="stat-tile wide" id="dd-head"></div>' +
    '<div class="stat-tile wide"><div class="label">Thread</div><div id="dd-thread"></div></div>' +
    '<div class="stat-tile wide">' + ddInputs() +
      '<div id="dd-error" class="job-start-error"></div></div>';
}

function ddDraw() {
  var head = document.getElementById('dd-head');
  if (!head) return;
  var title = ddRow ? ddRow.title : ddId;
  head.innerHTML =
    '<div class="label">' + ddEsc(title) + ' <span class="job-manifest-note">(' +
      ddEsc(ddRow && ddRow.handle ? ddRow.handle : ddId) + ')</span></div>' + ddFacts();
  document.getElementById('dd-thread').innerHTML = ddThreadHtml();
  document.getElementById('dd-error').textContent = ddNote;
}

// Only what was sent is cleared, and only after it went.
function ddClear(id) { var el = document.getElementById(id); if (el) el.value = ''; }

function ddValue(id) {
  var el = document.getElementById(id);
  return el ? String(el.value || '').trim() : '';
}

function ddSend(kind, text, fieldId) {
  var said = String(text || '').trim();
  if (!said || !ddId) return;
  var names = Object.keys(ddAgents);
  if (!names.length) {
    ddNote = 'No agent has written to this node yet, so there is nobody to send to.';
    ddDraw();
    return;
  }
  var body = { from: 'andy', kind: kind, text: said, todo: ddId };
  Promise.all(names.map(function (n) { return ddApi.peerPost('agents', ddAgents[n], body); })).then(function () {
    if (fieldId) ddClear(fieldId);
    return ddLoad();
  }).catch(function (e) {
    ddNote = 'Not sent: ' + e.message;
    ddDraw();
  });
}

spirit.shell.activateApp({
  mount: function (container, api) {
    ddApi = api;
    container.innerHTML = '<div id="dd-body" class="stack"></div>';
    // Delegated, because the body is repainted after every send.
    document.getElementById('dd-body').addEventListener('click', function (event) {
      var id = event.target && event.target.id;
      if (id === 'dd-accept') { ddSend('answer', 'accepted.'); return; }
      if (id === 'dd-reject') { ddSend('answer', 'rejected.'); return; }
      if (id === 'dd-explain') { ddSend('ask', 'explain this to me: what is it, and why is it where it is?'); return; }
      if (id === 'dd-title-send') { var t = ddValue('dd-title'); if (t) ddSend('answer', 'retitle: ' + t, 'dd-title'); return; }
      if (id === 'dd-answer-send') { ddSend('answer', ddValue('dd-answer'), 'dd-answer'); return; }
      if (id === 'dd-say-send') { ddSend('note', ddValue('dd-say'), 'dd-say'); }
    });
    document.getElementById('dd-body').addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      var id = event.target && event.target.id;
      if (id === 'dd-say') { event.preventDefault(); ddSend('note', ddValue('dd-say'), 'dd-say'); }
      else if (id === 'dd-answer') { event.preventDefault(); ddSend('answer', ddValue('dd-answer'), 'dd-answer'); }
      else if (id === 'dd-title') { event.preventDefault(); var t = ddValue('dd-title'); if (t) ddSend('answer', 'retitle: ' + t, 'dd-title'); }
    });
    // A reply arriving while the dialog is open lands in the thread.
    api.onPacket('agents', function () { if (ddId) ddLoad(); });
  },

  // Every call: which row this is. Nothing stale from the last row.
  open: function (params) {
    ddRow = (params && params.row) || null;
    ddId = (params && params.id) || (ddRow && ddRow.id) || '';
    ddThread = [];
    ddNote = '';
    ddFrame();
    ddDraw();
    ddLoad();
  },
});
