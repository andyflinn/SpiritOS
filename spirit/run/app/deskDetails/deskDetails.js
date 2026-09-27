// spirit/run/app/deskDetails/deskDetails.js
// ONE ROW OF THE DESK, AS A DIALOG — design/shell/AGENTS-UI.md.
//
//   Andy, 2026-09-27: "we need a DeskDetails immediately, with inputs
//   specific to the item" — and then its layout, top to bottom: "1)
//   english blurb, 2) the summary of fields from the list (as is) 3) my
//   input for naming it. 4) acceptance buttons or go! buttons when ready
//   for such simple decisions- 5) a chat log tied to the item that is WAY
//   less noisy 6) my input to the chat..... if possible refresh only the
//   chat history, so my typing doesn't get wiped"
//
// WHAT COMES FROM WHERE, all of it out of this node's own record through
// node.history, filtered HERE by `body.todo` (the node filters nothing,
// hub.js:1278):
//   the blurb      the newest `explain` from an agent, or the board row's
//                  own `explain` until one arrives
//   the slots      each agent's newest `annotation`, above the chat — "i
//                  want to se every agents comment slot (if it is filled)"
//   his name       his newest `retitle:` answer — "I like that i get to
//                  relable the issue with my own words"
//   the chat       only what passed between Andy and an agent: no claims,
//                  no agent-to-agent reports, no blurbs or slots (those
//                  have their own places)
//
// OPENING IS ASKING. "as soon as i click on details, and no english
// explanation is visible, it implies that one is requested." So an open
// with no blurb sends one explain request, once per row.

var ddApi = null;
var ddRow = null;           // the board row, as Desk handed it over
var ddId = '';              // its full id — the thread key
var ddState = null;         // what the record says about this row
// WHO HEARS ANDY: agents heard from in the last day, newest key per name.
// A stand-in until the owner-edited allow list (AGENTS-UI.md) exists. It
// keeps drill identities from last week out of his conversation.
var DD_RECENT_MS = 24 * 60 * 60 * 1000;
var ddAgents = Object.create(null);
var ddNote = '';

var DD_RETITLE = /^retitle:\s*/;
var DD_EXPLAIN_ASK = /^explain\b/;

function ddEsc(s) { return ddApi.escapeHtml(String(s == null ? '' : s)); }

function ddDecode(row) {
  if (!row || typeof row.payload !== 'string') return null;
  var env;
  try { env = JSON.parse(row.payload); } catch (e) { return null; }
  if (!env || env.app !== 'agents' || !env.body) return null;
  // A report is a whole message between agents (agents.js reportOf). It
  // is kept so a claim still counts, and marked so the chat can leave it out.
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

// One pass over this row's messages, in order, into what each part shows.
function ddRead(list) {
  var st = { explain: '', explainFrom: '', slots: Object.create(null), label: '',
    asked: false, chat: [], openAsk: null };
  list.forEach(function (m) {
    var andy = m.dir === 'out';
    if (andy && m.kind === 'answer' && DD_RETITLE.test(m.text)) { st.label = m.text.replace(DD_RETITLE, ''); return; }
    if (andy && m.kind === 'ask' && DD_EXPLAIN_ASK.test(m.text)) { st.asked = true; return; }
    if (!andy && m.kind === 'explain') { st.explain = m.text; st.explainFrom = m.from; return; }
    if (!andy && m.kind === 'annotation') { st.slots[m.from] = { text: m.text, at: m.at }; return; }
    if (m.reported) return;
    if (m.kind === 'note' && /^taking(\s|$)/.test(m.text)) return;
    if (m.kind === 'board' || m.kind === 'report') return;
    // ONE LINE PER THING ANDY SAID. Andy: "I still get multibple echoes of
    // what appears in there". What he sends goes once per agent, so the
    // record holds a copy per recipient; the chat shows the first.
    var prev = st.chat[st.chat.length - 1];
    if (andy && prev && prev.dir === 'out' && prev.kind === m.kind && prev.text === m.text &&
      Math.abs((Date.parse(m.at) || 0) - (Date.parse(prev.at) || 0)) < 60000) return;
    st.chat.push(m);
    // A question from an agent is open until Andy answers after it.
    if (!andy && m.kind === 'ask') st.openAsk = m;
    // Only a DECISION closes it. Andy: "i have no go button on this": he
    // wrote four notes after an agent's ask, and a note is talk, not an
    // answer. So only his `answer` kind (go, no, accepted, rejected) does.
    else if (andy && st.openAsk && m.kind === 'answer') st.openAsk = null;
  });
  if (!st.explain && ddRow && ddRow.explain) { st.explain = ddRow.explain; st.explainFrom = 'the declaration'; }
  return st;
}

// The whole record, a page at a time by position, keeping this row's
// messages and learning who the agents are on the way.
function ddLoad() {
  var byHash = Object.create(null);
  var list = [];
  function page(after) {
    return ddApi.verb('node.history', { after: after, limit: 200 }).then(function (r) {
      var body = r && r.body;
      if (!body || !body.ok) throw new Error((body && body.error) || (r && r.status) || 'no answer');
      body.rows.forEach(function (row) {
        var m = ddDecode(row);
        if (!m) return;
        if (m.dir === 'in' && !m.reported && m.from && m.peer) {
          ddAgents[m.from] = { key: m.peer, at: Date.parse(m.at) || 0 };
        }
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
    ddState = ddRead(list);
    ddNote = '';
    ddDraw();
  }, function (e) {
    ddNote = 'This node could not hand over its record: ' + e.message + '.';
    ddDraw();
  });
}

// ── THE PARTS THAT REPAINT ────────────────────────────────────────────

function ddBlurbHtml() {
  var st = ddState;
  if (!st) return '<div class="job-manifest-note">Reading…</div>';
  return st.explain
    ? '<div>' + ddEsc(st.explain) + '</div><div class="job-manifest-note">— ' + ddEsc(st.explainFrom) + '</div>'
    : '<div class="job-manifest-note">No explanation yet. One has been asked for, and it will appear here.</div>';
}

// EACH AGENT'S CURRENT STATEMENT, ABOVE THE CHAT. Andy: "and we still need
// a spot for your (current) statements/recommendations" — "..above the
// chat interface". One slot per agent, its newest annotation; an empty
// slot is not drawn.
function ddSlotsHtml() {
  var st = ddState;
  if (!st) return '';
  var names = Object.keys(st.slots);
  if (!names.length) return '';
  return '<div class="stat-tile wide"><div class="label">What the agents recommend now</div>' +
    names.map(function (name) {
      return '<div><b>' + ddEsc(name) + '</b> <span class="job-manifest-note">' + ddEsc(st.slots[name].at) +
        '</span><div>' + ddEsc(st.slots[name].text) + '</div></div>';
    }).join('') + '</div>';
}

function ddFactsHtml() {
  var r = ddRow || {};
  var waits = (r.waitsOn || []).map(function (w) { return typeof w === 'string' ? w : (w.id || ''); }).join(', ');
  var rows = [
    ['your name', ddState && ddState.label],
    ['title', r.title],
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

// ACCEPT FOR A DEPENDENCY; GO! WHEN AN AGENT HAS ASKED AND IS WAITING.
function ddDecideHtml() {
  if (ddRow && ddRow.kind === 'dependency') {
    return '<div class="start-job-form card"><button type="button" id="dd-accept">Accept</button>' +
      '<button type="button" id="dd-reject">Reject</button></div>';
  }
  var ask = ddState && ddState.openAsk;
  if (!ask) return '';
  return '<div class="job-manifest-note">' + ddEsc(ask.from) + ' asks: ' + ddEsc(ask.text) + '</div>' +
    '<div class="start-job-form card"><button type="button" id="dd-go">Go!</button>' +
    '<button type="button" id="dd-no">No</button></div>';
}

function ddChatHtml() {
  var chat = ddState ? ddState.chat : [];
  if (!chat.length) return '<div class="job-manifest-note">Nothing said about this row yet.</div>';
  return chat.map(function (m) {
    var who = m.dir === 'out' ? 'you' : m.from;
    var failed = m.dir === 'out' && m.outcome && m.outcome !== 'sent' && m.outcome !== 'delivered'
      ? ' <span class="job-start-error">(' + ddEsc(m.outcome) + ')</span>' : '';
    // His lines black and full width, the agents' plain, as in Desk's lead
    // chat: "similar in the details chat."
    var look = m.dir === 'out'
      ? ' style="text-align:right;background:#000;color:#fff;padding:4px 8px;margin:4px 0"'
      : ' style="border-left:3px solid currentColor;padding-left:8px;margin:4px 0"';
    return '<div' + look + '><b>' + ddEsc(who) + '</b> <span class="job-manifest-note">' + ddEsc(m.at) + '</span>' +
      failed + ' ' + ddEsc(m.text) + '</div>';
  }).join('');
}

// ── A REPAINT NEVER TOUCHES WHAT ANDY IS TYPING ─────────────────────
//
//   Andy: "also my typing gets erased, everytime somebody sends
//   something", then "if possible refresh only the chat history, so my
//   typing doesn't get wiped".
//
// The frame is drawn ONCE per open(); the two inputs (3, his name for it;
// 6, the chat) live in it and are never repainted. Only the parts between
// them are.
function ddFrame() {
  var el = document.getElementById('dd-body');
  if (!el) return;
  el.innerHTML =
    '<div class="stat-tile wide"><div class="label" id="dd-title"></div><div id="dd-blurb"></div></div>' +
    '<div class="stat-tile wide" id="dd-facts"></div>' +
    '<div class="start-job-form card"><label class="field-label grow">Your name for it' +
      '<input type="text" id="dd-name" placeholder="in your own words"></label>' +
      '<button type="button" id="dd-name-save">Save</button></div>' +
    '<div id="dd-decide"></div>' +
    '<div id="dd-slots"></div>' +
    '<div class="stat-tile wide"><div class="label">Chat</div><div id="dd-chat"></div></div>' +
    '<div class="start-job-form card"><label class="field-label grow">Say' +
      '<input type="text" id="dd-say" placeholder="to every agent, under this row"></label>' +
      '<button type="button" id="dd-say-send">Send</button></div>' +
    '<div id="dd-error" class="job-start-error"></div>';
}

function ddDraw() {
  var title = document.getElementById('dd-title');
  if (!title) return;
  var label = ddState && ddState.label;
  // HIS NAME IS THE DIALOG'S TITLE TOO. Andy: "if i re-label the item, the
  // (a) title of the Details display should change".
  ddApi.setScreenTitle(label || (ddRow ? ddRow.title : ddId));
  title.innerHTML = ddEsc(label || (ddRow ? ddRow.title : ddId)) + ' <span class="job-manifest-note">(' +
    ddEsc(ddRow && ddRow.handle ? ddRow.handle : ddId) + ')</span>';
  document.getElementById('dd-blurb').innerHTML = ddBlurbHtml();
  document.getElementById('dd-facts').innerHTML = ddFactsHtml();
  document.getElementById('dd-decide').innerHTML = ddDecideHtml();
  document.getElementById('dd-slots').innerHTML = ddSlotsHtml();
  document.getElementById('dd-chat').innerHTML = ddChatHtml();
  document.getElementById('dd-error').textContent = ddNote;
}

function ddValue(id) {
  var el = document.getElementById(id);
  return el ? String(el.value || '').trim() : '';
}

// Only what was sent is cleared, and only after it went.
function ddClear(id) { var el = document.getElementById(id); if (el) el.value = ''; }

// ONE SEND PER BOX AT A TIME. Andy's half-typed line reached the lead EIGHT
// times in 1.6 s: eight distinct posts from this page, because a held or
// repeated Enter fired again before the first send had cleared the box. So
// key auto-repeat is ignored, and a box with a send in flight sends nothing
// more until it settles.
var ddSending = false;
function ddSend(kind, text, fieldId) {
  var said = String(text || '').trim();
  if (!said || !ddId || ddSending) return Promise.resolve();
  var names = Object.keys(ddAgents).filter(function (n) {
    return Date.now() - ddAgents[n].at < DD_RECENT_MS;
  });
  if (!names.length) {
    ddNote = 'No agent has written to this node in the last day, so there is nobody to send to.';
    ddDraw();
    return Promise.resolve();
  }
  var body = { from: 'andy', kind: kind, text: said, todo: ddId };
  ddSending = true;
  return Promise.all(names.map(function (n) { return ddApi.peerPost('agents', ddAgents[n].key, body); })).then(function () {
    ddSending = false;
    if (fieldId) ddClear(fieldId);
    return ddLoad();
  }).catch(function (e) {
    ddSending = false;
    ddNote = 'Not sent: ' + e.message;
    ddDraw();
  });
}

// OPENING IS ASKING, once per row: no blurb, and no request already in
// his record, means this open is the request.
function ddAskIfUnexplained() {
  if (!ddState || ddState.explain || ddState.asked) return;
  ddState.asked = true;
  ddSend('ask', 'explain this to me: what is it, and why is it where it is?');
}

spirit.shell.activateApp({
  mount: function (container, api) {
    ddApi = api;
    container.innerHTML = '<div id="dd-body" class="stack"></div>';
    // Delegated, because the parts between the inputs are repainted.
    document.getElementById('dd-body').addEventListener('click', function (event) {
      var id = event.target && event.target.id;
      if (id === 'dd-accept') { ddSend('answer', 'accepted.'); return; }
      if (id === 'dd-reject') { ddSend('answer', 'rejected.'); return; }
      if (id === 'dd-go') { ddSend('answer', 'go.'); return; }
      if (id === 'dd-no') { ddSend('answer', 'no.'); return; }
      if (id === 'dd-name-save') { var n = ddValue('dd-name'); if (n) ddSend('answer', 'retitle: ' + n, 'dd-name'); return; }
      if (id === 'dd-say-send') { ddSend('note', ddValue('dd-say'), 'dd-say'); }
    });
    document.getElementById('dd-body').addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' || event.repeat) return;
      var id = event.target && event.target.id;
      if (id === 'dd-say') { event.preventDefault(); ddSend('note', ddValue('dd-say'), 'dd-say'); }
      else if (id === 'dd-name') {
        event.preventDefault();
        var n = ddValue('dd-name');
        if (n) ddSend('answer', 'retitle: ' + n, 'dd-name');
      }
    });
    // A reply arriving while the dialog is open repaints the parts, never
    // the inputs.
    api.onPacket('agents', function () { if (ddId) ddLoad(); });
  },

  // Every call: which row this is. Nothing stale from the last row.
  open: function (params) {
    ddRow = (params && params.row) || null;
    ddId = (params && params.id) || (ddRow && ddRow.id) || '';
    ddState = null;
    ddNote = '';
    ddFrame();
    ddDraw();
    ddLoad().then(ddAskIfUnexplained);
  },
});
