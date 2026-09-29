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
// WHAT COMES FROM WHERE. Desk keeps the log (desk.js, "IT KEEPS ITS OWN
// LOG, BY RULING") and hands this dialog the row's thread when it opens.
// What arrives while it is open comes through onPacket, and what Andy sends
// from here goes back to Desk as the dialog's result. It never asks the
// node for a record:
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
var ddDesign = false;        // design mode, as Desk passed it in
var ddSession = [];          // the design session's rows, as Desk passed them in
var ddRules = [];            // the plan's rules, which hold for every item in it
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

// One arrival -> one agents message, in the shape Desk logs
// (desk.js deskArrival). A report is a whole message between agents
// (agents.js reportOf), kept so a claim still counts and marked so the
// chat can leave it out.
function ddArrival(body, message) {
  if (!body || !message) return null;
  var at = String(message.sentAt || new Date().toISOString());
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

// This row's thread, as Desk handed it over plus what came since.
var ddThread = [];
var ddSeen = Object.create(null);
// What Andy sent from this dialog, for Desk to log. Set as it happens
// (setDialogResult), because the way out is usually Back.
var ddSent = [];
var ddOutCount = 0;

function ddTake(m) {
  if (!m || !m.key || ddSeen[m.key]) return false;
  ddSeen[m.key] = true;
  if (m.dir === 'in' && !m.reported && m.from && m.peer) ddAgents[m.from] = { key: m.peer, at: Date.parse(m.at) || 0 };
  if (m.todo !== ddId) return false;
  ddThread.push(m);
  return true;
}

// One pass over this row's messages, in order, into what each part shows.
function ddRead(list) {
  var st = { explain: '', explainFrom: '', slots: Object.create(null), label: '',
    asked: false, chat: [], openAsk: null, ready: false, readyBy: {} };
  list.forEach(function (m) {
    var andy = m.dir === 'out';
    if (andy && m.kind === 'answer' && DD_RETITLE.test(m.text)) { st.label = m.text.replace(DD_RETITLE, ''); return; }
    if (andy && m.kind === 'ask' && DD_EXPLAIN_ASK.test(m.text)) { st.asked = true; return; }
    if (!andy && m.kind === 'explain') { st.explain = m.text; st.explainFrom = m.from; return; }
    if (!andy && m.kind === 'annotation') { st.slots[m.from] = { text: m.text, at: m.at }; return; }
    if (m.reported) return;
    if (m.kind === 'note' && /^taking(\s|$)/.test(m.text)) return;
    // An agent saying the item can be closed, with its evidence.
    // A claim opens the note; a mention mid-sentence is not one (desk.js, DESK_READY_CLAIM).
    // Both agents, not one (desk.js, deskReadyBy).
    if (!andy && /^(?:[\w.-]+[,:]\s*)?(?:[\w.\/-]+\s+is\s+)?READY TO CLOSE\b/.test(String(m.text || ''))) {
      st.readyBy[String(m.from || m.peer || '')] = true;
      st.ready = Object.keys(st.readyBy).length >= 2;
    }
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
    // His latest go. or no. says whether it is running.
    if (andy && m.kind === 'answer' && (m.text === 'go.' || m.text === 'no.')) st.running = m.text === 'go.';
  });
  if (!st.explain && ddRow && ddRow.explain) { st.explain = ddRow.explain; st.explainFrom = 'the declaration'; }
  return st;
}

// Re-reads this row's thread into what each part shows.
function ddLoad() {
  ddState = ddRead(ddThread);
  ddDraw();
}

// ── THE PARTS THAT REPAINT ────────────────────────────────────────────

// It folds, and IT OPENS BY ITSELF when an agent fills or changes it
// (desk/G1.14, Andy: "when it's filled by the agent (changed) it should open
// automatically"), even after he folded it.
var ddExplainFolded = false;
var ddExplainShown = null;
function ddBlurbHtml() {
  var st = ddState;
  if (!st) return '<div class="job-manifest-note">Reading…</div>';
  if (!st.explain) return '<div class="job-manifest-note">No explanation yet. One has been asked for, and it will appear here.</div>';
  if (st.explain !== ddExplainShown) { ddExplainShown = st.explain; ddExplainFolded = false; }
  var toggle = '<button type="button" data-fold="explain" title="' + (ddExplainFolded ? 'Unfold' : 'Fold') + '">' +
    (ddExplainFolded ? '▸' : '▾') + '</button> ';
  if (ddExplainFolded) return '<div>' + toggle + '<span class="job-manifest-note">explanation by ' + ddEsc(st.explainFrom) + '</span></div>';
  return '<div>' + toggle + ddLineHtml({ text: st.explain }) + '</div><div class="job-manifest-note">— ' + ddEsc(st.explainFrom) + '</div>';
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
// HIS BUTTONS ON ONE LINE, BEFORE RENAME (desk/G1.12). Andy: "all buttons
// offered to me for Go, Done etc, should be on the same line as "Rename",
// but before Rename". What explains them stays here, in #dd-decide; the
// buttons themselves are drawn by ddButtonsHtml into #dd-name-row.
function ddDecideHtml() { return ddDecide().note; }
function ddButtonsHtml() {
  var mine = ddSession.filter(function (r) { return r.id === ddId; })[0];
  var ready = ddState && ddState.ready;
  var close = mine && mine.done ? '<button type="button" id="dd-reopen">Reopen</button>'
    : mine && ready ? '<button type="button" id="dd-done" style="background:#1a7f37;color:#fff;font-weight:bold">Done</button>' : '';
  return ddDecide().buttons + close;
}
function ddDecide() {
  if (ddRow && ddRow.kind === 'dependency') {
    return { note: '', buttons: '<button type="button" id="dd-accept">Accept</button><button type="button" id="dd-reject">Reject</button>' };
  }
  var r = ddDecideNote();
  return typeof r === 'string' ? { note: r, buttons: '' } : r;
}
function ddDecideNote() {
  var ask = ddState && ddState.openAsk;
  // A closed item asks nothing (Andy: "this one still shows go button while
  // market as done").
  var mine = ddSession.filter(function (r) { return r.id === ddId; })[0];
  if (mine && mine.done) return '';
  // NO GO BEFORE WHAT IS ALREADY THERE IS VERIFIED (desk.js,
  // DESK_VERIFIED_CLAIM). Andy: "The already in place list must be verified
  // before any go button can appear."
  if (ask && mine && !mine.goal && !mine.verified) {
    return '<div class="job-manifest-note">' + ddEsc(ask.from) + ' asks: ' + ddEsc(ask.text) + '</div>' +
      '<div class="job-manifest-note"><b>No Go yet:</b> its Already-in-place list has not been verified.</div>';
  }
  if (!ask) return ddState && ddState.running ? '<div class="job-manifest-note"><b>Status: running.</b> You said go.</div>' : '';
  // No Go! while the row waits on open work, and none in design mode (Andy,
  // 2026-09-29; the List holds the same rule, desk.js).
  var waits = (mine && mine.waitsOn) || [];
  if (waits.length || ddDesign) {
    return '<div class="job-manifest-note">' + ddEsc(ask.from) + ' asks: ' + ddEsc(ask.text) + '</div>' +
      '<div class="job-manifest-note"><b>No Go yet:</b> ' + (waits.length ? 'it waits on ' + ddEsc(waits.join(', ')) : 'design mode is on') + '.</div>';
  }
  return { note: '<div class="job-manifest-note">' + ddEsc(ask.from) + ' asks: ' + ddEsc(ask.text) + '</div>',
    buttons: '<button type="button" id="dd-go">Go!</button><button type="button" id="dd-no">No</button>' };
}

// NEWEST FIRST, INPUT ON TOP. Andy, 2026-09-28: "i want my input at the top
// if the chat log, and the log shows the last message at the top, the second
// last shows second etc... then the most relevant chat entries will be at
// the top". Every chat in Desk and its dialogs is drawn this way.
// A CHAT LINE, DRAWN READABLY (desk/G1.10): the twin of deskLineHtml and
// deskTime in desk.js; change both or neither. Escaped first, then
// formatted: line breaks kept, '- ' lines a list, `backquoted` text code,
// the local HH:MM, a session post one line naming its goal.
function ddTime(at) {
  var d = new Date(at);
  if (isNaN(d.getTime())) return ddEsc(at);
  var two = function (n) { return (n < 10 ? '0' : '') + n; };
  return two(d.getHours()) + ':' + two(d.getMinutes());
}
function ddLineHtml(m) {
  if (m && m.kind === 'session') {
    var g = null;
    try { g = JSON.parse(String(m.text)).goal; } catch (e) { g = null; }
    return '<i>the goal record was updated' + (g ? ': ' + ddEsc(g.id) + ' — ' + ddEsc(g.title) : '') + '</i>';
  }
  var out = [];
  var list = [];
  var flush = function () { if (list.length) { out.push('<ul style="margin:2px 0 2px 18px">' + list.join('') + '</ul>'); list = []; } };
  String(m && m.text || '').split('\n').forEach(function (raw) {
    var line = ddEsc(raw).replace(/`([^`]+)`/g, '<code>$1</code>');
    if (/^- /.test(raw)) { list.push('<li>' + line.slice(2) + '</li>'); return; }
    flush();
    out.push(line);
  });
  flush();
  return out.join('<br>').replace(/<br>(<ul)/g, '$1').replace(/(<\/ul>)<br>/g, '$1');
}

function ddChatHtml() {
  var chat = ddState ? ddState.chat : [];
  if (!chat.length) return '<div class="job-manifest-note">Nothing said about this row yet.</div>';
  return chat.slice().reverse().map(function (m) {
    var who = m.dir === 'out' ? 'you' : m.from;
    var failed = m.dir === 'out' && m.outcome && m.outcome !== 'sent' && m.outcome !== 'delivered'
      ? ' <span class="job-start-error">(' + ddEsc(m.outcome) + ')</span>' : '';
    // His lines black and full width, the agents' plain, as in Desk's lead
    // chat: "similar in the details chat."
    var look = m.dir === 'out'
      ? ' style="text-align:right;background:#000;color:#fff;padding:4px 8px;margin:4px 0"'
      : ' style="border-left:3px solid currentColor;padding-left:8px;margin:4px 0"';
    return '<div' + look + '><b>' + ddEsc(who) + '</b> <span class="job-manifest-note">' + ddTime(m.at) + '</span>' +
      failed + ' ' + ddLineHtml(m) + '</div>';
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
    // DESIGN MODE, SHOWN AND NEVER ENDED HERE. Andy: "design mode for the
    // Desk app and its detail apps, can only be ended from within the team
    // tab", so this dialog carries no button for it. Desk passes it in.
    '<div id="dd-design" class="stat-tile wide" style="background:#fff3c4;color:#000"' + (ddDesign ? '' : ' hidden') + '>' +
      '<b>Design mode.</b> Nothing is built until it ends, and it ends only in the Team tab of Desk.</div>' +
    // THE NAME FIRST, AT THE VERY TOP, as far from Say as the dialog allows.
    // Andy: "the "Your name for it" box should go just underneath the Close
    // button row, far away from my chat input. i still type into the wrong box".
    // RENAMING IS ITS OWN BUTTON (desk/G1, D7). His lines kept landing in
    // the name box, so no box is drawn until he presses Rename.
    // HIS BUTTONS AND THE CHECK, PINNED (desk/G1.12). Andy: "same for this
    // part Done Rename How you can check": they stay below the title bar
    // while the rest scrolls. Opaque, in the shell's own background.
    '<div style="position:sticky;top:0;z-index:2;background:#1a1a2e;padding-bottom:2px">' +
    '<div class="start-job-form card" id="dd-name-row"></div>' +
    // HOW HE CAN CHECK, CLOSE TO DONE (desk/G1.12). Andy: "the "how i can
    // check" should be a separate line, outside of the large text", "so how
    // i can check will be close to "Done"".
    ddCheckHtml() +
    '</div>' +
    // THE EXPLANATION ABOVE THE RECORD (desk/G1.14). Andy: "the text an agent
    // provided to me because he saw me looking at the item, that one belongs
    // into the upper position".
    '<div class="stat-tile wide"><div class="label" id="dd-title" style="font-size:1.25em;font-weight:bold"></div><div id="dd-blurb"></div></div>' +
    '<div id="dd-item"></div>' +
    '<div class="stat-tile wide" id="dd-facts"></div>' +
    '<div id="dd-decide"></div>' +
    '<div id="dd-slots"></div>' +
    '<div class="start-job-form card"><label class="field-label grow">Say' +
      // SEVERAL LINES, AND RETURN IS A NEW LINE (desk/G1.12). Andy: "This
      // entry box should let me type with linefeeds, and not post when i hit
      // return. i want to finish thinking before i bother you".
      '<textarea id="dd-say" rows="3" placeholder="to every agent, under this row"></textarea></label>' +
      '<button type="button" id="dd-say-send">Send</button></div>' +
    '<div id="dd-error" class="job-start-error"></div>' +
    '<div class="stat-tile wide"><div class="label">Chat, newest first</div><div id="dd-chat"></div></div>';
}

// THIS ITEM AS THE TITLE BLOCK, AND WHAT IT NEEDS. Andy: "clicking on an
// item will ring us to the details dialog, where the detail is the Title
// item in a similar display block at the top, where we can add items
// required to make that detail happen. this is all in design mode." The
// same block as Team's bubble, for this item: its title, its description,
// and every item that blocks it. Items are added by talking, as in Team.
//
// TWO LISTS, ONE LAYER EACH, AND EVERY LINE IS A WAY THERE. Andy: "tow
// lists: blocking and blocked by", each line "number: title", and "if i
// click on any of those, we close that detail-dialog and navigate to the
// one clicket". So the tree is walked one step at a time, up or down,
// and never drawn whole.
function ddItemLine(r) {
  // Light blue, Andy: "The links are too dark, to little contrast, make them light blue".
  return '<li><a href="#" data-open="' + ddEsc(r.id) + '" style="color:#cfe2ff">' + (r.done ? '<s>' : '') +
    ddEsc(r.id) + ': ' + ddEsc(r.title) + (r.done ? '</s>' : '') + '</a></li>';
}
// FOLDED, THE TITLE AND THE DONE ROW (desk/G1.8): the one button he closes
// with is never hidden (claude-windows' contract, deskFold.js).
var ddFolded = true;  // every foldable box starts folded (desk/G1.12); open() folds it again
function ddItemHtml() {
  var me = ddSession.filter(function (r) { return r.id === ddId; })[0];
  if (!me) return '';
  var byId = {};
  ddSession.forEach(function (r) { byId[r.id] = r; });
  var blockedBy = ddSession.filter(function (r) { return (r.blocks || []).indexOf(ddId) !== -1; }).map(ddItemLine).join('');
  var blocking = (me.blocks || []).map(function (id) { return ddItemLine(byId[id] || { id: id, title: '' }); }).join('');
  // DONE IS HIS BUTTON. Andy: "how do those damn items get closed?", then
  // "let's close that gap." Pressing it sends "done." under this item, and
  // Desk reads his own latest done/reopen as the item's state.
  // ONLY WHEN THERE IS SOMETHING TO CLOSE. Andy: "if it's not built why give
  // me a done button?" So Done appears once an agent has said READY TO CLOSE
  // under this item, with the evidence; before that the state is words.
  var ready = ddState && ddState.ready;
  // Its words stay here; its button sits in the row above (ddButtonsHtml).
  var close = me.done
    ? '<span class="job-manifest-note">Done.</span>'
    : ready
      ? '<span class="job-manifest-note">Both agents say this is ready to close: Done is in the row above; read why below.</span>'
      : '<span class="job-manifest-note">Open: not ready to close yet. Done appears above when both agents say it is, with the evidence.</span>';
  var head = '<div style="display:flex;gap:8px;align-items:baseline"><button type="button" data-fold="item" title="' +
    (ddFolded ? 'Unfold' : 'Fold') + '">' + (ddFolded ? '▸' : '▾') + '</button><div class="label" style="font-size:1.25em;font-weight:bold">' + ddEsc(me.id) + ' — ' + ddEsc(me.title) + '</div></div>' +
    '<div style="margin:6px 0">' + close + '</div>';
  if (ddFolded) return '<div class="stat-tile wide">' + head + '</div>';
  return '<div class="stat-tile wide">' + head +
    (me.description ? '<div>' + ddEsc(me.description) + '</div>' : '') +
    // HOW YOU CAN CHECK, HIGHLIGHTED, AND THE TESTS THAT PROVE IT. Andy:
    // "there should be a highlighted section on if and how i can check. same
    // as wsl test requirements should be enumarated under requirements".

    // WHAT IS ALREADY THERE, so nothing is built twice. Andy: "a list per
    // requirement that names support already in place, as reminder to NOT
    // re-invent what is already there."
    (me.goal ? '' : '<div class="label" style="margin-top:8px">Already in place' +
      (me.verified ? ' (verified)' : ' (not verified yet)') + '</div>' +
      (me.inPlace && me.inPlace.length
        ? '<ul style="margin:6px 0 0 18px">' + me.inPlace.map(function (p) {
            return '<li>' + ddEsc(p.what || '') + (p.where ? ' <span class="job-manifest-note">' + ddEsc(p.where) + '</span>' : '') + '</li>';
          }).join('') + '</ul>'
        : '<div class="job-manifest-note">None listed yet.</div>')) +
    '<div class="label" style="margin-top:8px">Proved by these tests</div>' +
    (me.tests && me.tests.length
      ? '<ul style="margin:6px 0 0 18px">' + me.tests.map(function (t) { return '<li>' + ddEsc(t) + '</li>'; }).join('') + '</ul>'
      : '<div class="job-manifest-note">None named yet.</div>') +
    // A GROUP WITH NOTHING IN IT DRAWS NOTHING (desk/G1.12). Andy: "groups
    // like blocking should disappear completely."
    (blockedBy ? '<div class="label" style="margin-top:8px">Blocked by</div><ul style="margin:6px 0 0 18px">' + blockedBy + '</ul>' : '') +
    (blocking ? '<div class="label" style="margin-top:8px">Blocking</div><ul style="margin:6px 0 0 18px">' + blocking + '</ul>' : '') +
    // The plan's rules hold here too (desk.js, deskSessionRules).
    (ddRules.length ? '<div style="margin-top:8px;padding:6px 10px;border:1px dashed currentColor;border-radius:6px">' +
      '<div class="label">Rules — hold for every requirement, never done</div><ul style="margin:6px 0 0 18px">' +
      ddRules.map(function (r) { return '<li>' + ddEsc(r.id) + ': ' + ddEsc(r.text) + '</li>'; }).join('') + '</ul></div>' : '') +
    '</div>';
}

function ddDraw() {
  var item = document.getElementById('dd-item');
  if (item) item.innerHTML = ddItemHtml();
  ddDrawNameRow();
  var title = document.getElementById('dd-title');
  if (!title) return;
  var label = ddState && ddState.label;
  // HIS NAME IS THE DIALOG'S TITLE TOO. Andy: "if i re-label the item, the
  // (a) title of the Details display should change".
  // THE ID FIRST (desk/G1.12). Andy: "the title bar should show the G1.2
  // tags before the title".
  ddApi.setScreenTitle(ddId + ' — ' + (label || (ddRow ? ddRow.title : ddId)));
  title.innerHTML = ddEsc(label || (ddRow ? ddRow.title : ddId)) + ' <span class="job-manifest-note">(' +
    ddEsc(ddRow && ddRow.handle ? ddRow.handle : ddId) + ')</span>';
  document.getElementById('dd-blurb').innerHTML = ddBlurbHtml();
  document.getElementById('dd-facts').innerHTML = ddFactsHtml();
  document.getElementById('dd-decide').innerHTML = ddDecideHtml();
  document.getElementById('dd-slots').innerHTML = ddSlotsHtml();
  document.getElementById('dd-chat').innerHTML = ddChatHtml();
  document.getElementById('dd-error').textContent = ddNote;
}

var DD_RENAME = '<button type="button" id="dd-rename">Rename</button>';
var DD_NAME_BOX = '<label class="field-label grow">Your name for it' +
  '<input type="text" id="dd-name" placeholder="in your own words"></label>' +
  '<button type="button" id="dd-name-save">Save</button>';
var ddRenaming = false;
function ddNameRow(open) {
  ddRenaming = !!open;
  ddDrawNameRow();
  var box = open && document.getElementById('dd-name');
  if (box && box.focus) box.focus();
}
// Redrawn with every draw, so his buttons follow the thread; a name he is
// typing survives it.
function ddDrawNameRow() {
  var row = document.getElementById('dd-name-row');
  if (!row) return;
  var typed = ddRenaming ? ddValue('dd-name') : '';
  row.innerHTML = ddButtonsHtml() + (ddRenaming ? DD_NAME_BOX : DD_RENAME);
  var box = ddRenaming && typed && document.getElementById('dd-name');
  if (box) box.value = typed;
}
function ddCheckHtml() {
  var me = ddSession.filter(function (r) { return r.id === ddId; })[0] || ddRow || {};
  // Clear space above and below, so it never reads as part of a box
  // (Andy: "the yellow part is not separate from the the large text block").
  return '<div style="margin:12px 0;padding:6px 10px;background:#fff3c4;color:#000;border-radius:6px">' +
    '<b>How you can check:</b> ' + (me.check ? ddEsc(me.check) : 'not stated yet; the agents owe you this line.') + '</div>';
}
// His name for it goes, then the box folds back into its button.
function ddRename() {
  var n = ddValue('dd-name');
  if (n) ddSend('answer', 'retitle: ' + n, 'dd-name').then(function () { ddNameRow(false); });
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

// One of Andy's lines as it went, in Desk's log shape (desk.js
// deskOutgoing): keyed by its hash, or by a key of its own when nothing
// crossed.
function ddOutgoing(to, body, r, e) {
  ddOutCount += 1;
  return {
    key: (r && r.hash) || ('out-' + Date.now() + '-' + ddOutCount + '-' + String(to).slice(-8)),
    at: new Date().toISOString(), dir: 'out', peer: String(to || ''),
    outcome: e ? 'undelivered: ' + e.message : (r && r.ok ? 'sent' : 'undelivered: ' + ((r && (r.error || r.status)) || 'no answer')),
    from: 'andy', kind: String(body.kind || ''), text: String(body.text || ''), todo: String(body.todo || ''),
  };
}

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
  return Promise.all(names.map(function (n) {
    var to = ddAgents[n].key;
    // A busy agent is waited for a minute (see desk.js, DESK_PATIENCE).
    return ddApi.peerPost('agents', to, body, { patienceMs: 60000 }).then(function (r) { return ddOutgoing(to, body, r, null); },
      function (e) { return ddOutgoing(to, body, null, e); });
  })).then(function (msgs) {
    ddSending = false;
    if (fieldId) ddClear(fieldId);
    ddNote = '';
    msgs.forEach(function (m) { ddTake(m); ddSent.push(m); });
    ddApi.setDialogResult({ sent: ddSent.slice() });
    ddLoad();
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
      // Leaving for another item: Desk opens it once this one is closed.
      var link = event.target && event.target.closest && event.target.closest('[data-open]');
      if (link) {
        event.preventDefault();
        ddApi.closeDialog({ sent: ddSent.slice(), open: link.getAttribute('data-open') });
        return;
      }
      if (event.target && event.target.getAttribute && event.target.getAttribute('data-fold') === 'item') {
        ddFolded = !ddFolded;
        ddDraw();
        return;
      }
      if (event.target && event.target.getAttribute && event.target.getAttribute('data-fold') === 'explain') {
        ddExplainFolded = !ddExplainFolded;
        ddDraw();
        return;
      }
      var id = event.target && event.target.id;
      if (id === 'dd-accept') { ddSend('answer', 'accepted.'); return; }
      if (id === 'dd-reject') { ddSend('answer', 'rejected.'); return; }
      // Gone at once, and running (desk.js, the list's Go does the same).
      if (id === 'dd-go') {
        if (ddState) { ddState.openAsk = null; ddState.running = true; }
        ddDraw();
        ddSend('answer', 'go.');
        return;
      }
      if (id === 'dd-done' || id === 'dd-reopen') {
        var mine = ddSession.filter(function (r) { return r.id === ddId; })[0];
        if (mine) mine.done = id === 'dd-done';
        ddSend('answer', id === 'dd-done' ? 'done.' : 'reopen.');
        ddDraw();
        return;
      }
      if (id === 'dd-no') { ddSend('answer', 'no.'); return; }
      if (id === 'dd-rename') { ddNameRow(true); return; }
      if (id === 'dd-name-save') { ddRename(); return; }
      if (id === 'dd-say-send') { ddSend('note', ddValue('dd-say'), 'dd-say'); }
    });
    document.getElementById('dd-body').addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' || event.repeat) return;
      var id = event.target && event.target.id;
      // Return in the say box is a new line; only Send sends (desk/G1.12).
      if (id === 'dd-name') { event.preventDefault(); ddRename(); }
    });
    // A reply arriving while the dialog is open repaints the parts, never
    // the inputs.
    // Desk logs the same arrival through its own subscription; this one
    // only keeps the open row's thread current.
    api.onPacket('agents', function (body, message) {
      if (ddTake(ddArrival(body, message))) ddLoad();
    });
  },

  // Every call: which row this is, and its thread from Desk. Nothing stale
  // from the last row.
  open: function (params) {
    ddRow = (params && params.row) || null;
    ddDesign = !!(params && params.designMode);
    ddSession = (params && Array.isArray(params.session)) ? params.session : [];
    ddRules = (params && Array.isArray(params.rules)) ? params.rules : [];
    ddId = (params && params.id) || (ddRow && ddRow.id) || '';
    ddThread = [];
    ddSeen = Object.create(null);
    ddSent = [];
    ddAgents = Object.create(null);
    var agents = (params && params.agents) || {};
    Object.keys(agents).forEach(function (n) { ddAgents[n] = agents[n]; });
    ((params && params.thread) || []).forEach(ddTake);
    ddState = null;
    ddNote = '';
    ddFolded = true;
    ddRenaming = false;
    ddFrame();
    ddLoad();
    ddAskIfUnexplained();
  },
});
