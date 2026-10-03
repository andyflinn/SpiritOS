// spirit/run/shell/deskDetails/deskDetails.js
// ONE ITEM OF THE DESK, AS A DIALOG — desk/G2.7.
//
//   Andy: "The server determines all the content to be drawn. buttons, the
//   text in the one text box, the status of items, the title of items etc."
//   "I want one box only." "All other text-output-boxes are removed."
//   "no pulling". "a press shouldn't post a line, it is not textual information."
//
// WHAT COMES FROM WHERE. open() asks the desk server item.get once, through
// jobs.api; after that the dialog paints only from what the server publishes
// (api.onPublished). It decides nothing: its buttons are the item's
// `buttons`, and a press goes to the server as a press, the screen waiting
// for the server's publish. The order, top to bottom (Andy, desk/G2.7): ID,
// title, status and buttons; the yellow strip; the one box; blocked-by and
// blocking; chat.

var ddApi = null;
var ddId = '';
var ddFacts = null;          // the item's facts, as the server last said them
var ddBox = '';
var ddVersion = 0;
var ddChecks = [];
var ddChat = [];
var ddChatMore = false;       // older lines the server left out (desk/G3.3)
var ddArmed = '';            // the id of the armed button (abandon, go all), pressed once
var ddRenaming = false;
var ddNote = '';

function ddEsc(s) { return ddApi.escapeHtml(String(s == null ? '' : s)); }

// The one way to the desk server: jobs.api on the loopback door.
function ddAsk(verb, args) {
  var desk = {};
  desk[verb] = args;
  return Promise.resolve(ddApi.verb('jobs.api', { ask: { desk: desk } })).then(function (r) {
    var body = (r && r.body) || {};
    if (body.ok === false) { var e = new Error(ddRefusalText(body)); e.refused = true; throw e; }
    return body;
  });
}
// A REFUSAL BY ITS NAME, SIZE AND LIMIT (Andy: "would have been diagnosed in an instant").
function ddRefusalText(body) {
  var x = body.extra || {};
  return String(body.code || 'refused') + (typeof x.bytes === 'number' ? ': ' + x.bytes + ' bytes, the limit is ' + x.max : '') + (body.error ? ' (' + body.error + ')' : '');
}

// A write of Andy's. Nothing on screen changes until the server publishes.
// THE DIALOG NUDGES NOBODY (goal/G3.8): the bare 'changed' packet it posted to
// each agent after a write went with the agents app; the desk server nudges
// each agent's deskClient itself on his writes (goal/G3.5).
// Answers whether the server took it. It sends no by: the desk takes its writer from the caller (apiAuth/G1.13).
function ddWrite(verb, args) {
  return ddAsk(verb, args).then(function () { ddNote = ''; return true; }, function (e) {
    ddNote = 'Not taken: ' + e.message;
    ddPaint();
    return false;
  });
}
function ddPress(what) { return ddWrite('press', { id: ddId, what: what }); }
function ddDisarm() { ddArmed = ''; ddPaint(); }

// ── THE FRAME, DRAWN ONCE PER OPEN ────────────────────────────────────
//
// Andy: "if possible refresh only the chat history, so my typing doesn't get
// wiped". The inputs live in the frame and are never repainted.
function ddFrame() {
  var el = document.getElementById('dd-body');
  if (!el) return;
  el.innerHTML =
    // His buttons and the strip stay pinned BELOW the title bar while the
    // rest scrolls (desk/G1.12; goal/G2.1 note 4). The shell's #app-header is
    // sticky at the top of the same scroll, so this block sticks at its
    // height, measured below, never at 0 where it would cover Back and Close.
    '<div id="dd-bars" style="position:sticky;top:var(--desk-bar-top,52px);z-index:2;background:#1a1a2e;padding-bottom:2px">' +
      '<div id="dd-head" style="font-size:1.25em;font-weight:bold"></div>' +
      '<div class="start-job-form card" id="dd-name-row"></div>' +
      '<div id="dd-strip"></div>' +
    '</div>' +
    '<div class="stat-tile wide" id="dd-box"></div>' +
    '<div id="dd-links"></div>' +
    '<div class="start-job-form card"><label class="field-label grow">Say' +
      // Return is a new line; only Send sends (desk/G1.12).
      '<textarea id="dd-say" rows="3" placeholder="under this item"></textarea></label>' +
      '<button type="button" id="dd-say-send">Send</button></div>' +
    '<div id="dd-error" class="job-start-error"></div>' +
    '<div class="stat-tile wide"><div class="label">Chat, newest first</div><div id="dd-chat"></div></div>';
  ddBarTop();
}
// The title bar's height, as it is on this screen: the offset the pinned block sticks at.
function ddBarTop() {
  var header = document.getElementById('app-header');
  var bars = document.getElementById('dd-bars');
  var h = header && Number(header.offsetHeight);
  if (bars && bars.style && h > 0) bars.style.setProperty('--desk-bar-top', h + 'px');
}

var DD_LABELS = { go: 'Go!', done: 'Done', close: 'Close', reopen: 'Reopen' };

function ddHeadHtml() {
  var f = ddFacts || {};
  // THE ID FIRST (desk/G1.12): "the title bar should show the G1.2 tags before the title".
  return ddEsc(ddId) + ' — ' + ddEsc(f.title || '') +
    (f.status ? ' <span class="job-manifest-note">(' + ddEsc(f.status) + ')</span>' : '');
}

function ddButtonsHtml() {
  var f = ddFacts || {};
  var html = (f.buttons || []).filter(function (b) { return DD_LABELS[b]; }).map(function (b) {
    return '<button type="button" id="dd-' + b + '">' + DD_LABELS[b] + '</button>';
  }).join('');
  html += ddRenaming
    ? '<label class="field-label grow">Your name for it<input type="text" id="dd-name" placeholder="in your own words"></label>' +
      '<button type="button" id="dd-name-save">Save</button>'
    : '<button type="button" id="dd-rename">Rename</button>';
  // THE GOAL'S ABANDON: "a red, arming-button ... with are-you-sure", "at the
  // very right of the button row". The first press arms it, the second goes;
  // it disarms the moment he clicks elsewhere (armedButtons.js, the shell's
  // armUntilElsewhere), and data-armed has the shell paint it.
  // GO ALL ON THE GOAL (desk/G3.7). Andy: "the goal-detail panel could offer the
  // go-all button if there is any go-able items". Armed like the List's (G3.4).
  if (f.goal === '' && (f.buttons || []).indexOf('go-all') !== -1) {
    html += '<button type="button" id="dd-go-all"' + (ddArmed === 'dd-go-all' ? ' data-armed="1"' : '') + '>' +
      (ddArmed === 'dd-go-all' ? 'Go all: sure?' : 'Go all') + '</button>';
  }
  if (f.goal === '') {
    html += '<button type="button" id="dd-abandon"' + (ddArmed === 'dd-abandon' ? ' data-armed="1"' : '') +
      ' style="margin-left:auto;background:#b00020;color:#fff">' +
      (ddArmed === 'dd-abandon' ? 'Sure? Abandon the goal' : 'Abandon') + '</button>';
  }
  return html;
}

// THE YELLOW STRIP IS "HOW YOU CHECK IT", offered only while Done is (Andy:
// "the yellow box should only be offered when the agents claim 'done'"). Each
// C check is pressed to tick it; "it inspires diligence".
function ddStripHtml() {
  var f = ddFacts || {};
  if ((f.buttons || []).indexOf('done') === -1) return '';
  var cs = ddChecks.filter(function (c) { return c.kind === 'C'; });
  return '<div style="margin:12px 0;padding:6px 10px;background:#fff3c4;color:#000;border-radius:6px">' +
    '<b>How you check it:</b>' + (cs.length ? '<ul style="margin:6px 0 0 18px">' + cs.map(function (c) {
      var done = c.state === 'passed';
      return '<li><button type="button" data-check="' + ddEsc(c.number) + '"' + (done ? ' disabled' : '') + '>' +
        (done ? '✓ ' : '') + ddEsc(c.number) + '</button> ' + ddEsc(c.words) + '</li>';
    }).join('') + '</ul>' : ' <span>no checks written yet.</span>') + '</div>';
}

// THE ONE BOX. An item with no text yet says so; an agent writes it.
// IT FOLDS AGAIN (goal/G2.1 note 1; the fold was lost in desk/G2.7). Andy: "BIG complaint: the text bubble
// no longer folds." Folded shows its first line; the state is kept here, so a repaint keeps his fold.
var ddFolded = true;  // every open starts folded, as before desk/G2.7
function ddBoxHtml() {
  if (!ddBox) return '<div class="job-manifest-note">No text yet: an agent writes it.</div>';
  // THE BOX CAP, SEEN (goal/G2.2 note 1). Andy: "orange at 50%, red at 75%" — the server says half and full; the
  // border is the only automatic part, the split into items is negotiated ("never automated").
  var cap = ddFacts && ddFacts.full ? 'border:2px solid red;padding:4px;' : ddFacts && ddFacts.half ? 'border:2px solid orange;padding:4px;' : '';
  var toggle = '<button type="button" data-fold="item" title="' + (ddFolded ? 'Unfold' : 'Fold') + '">' + (ddFolded ? '▸' : '▾') + '</button> ';
  if (ddFolded) return '<div style="' + cap + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + toggle + ddEsc(ddBox.split('\n')[0]) + '</div>';
  return '<div style="' + cap + '"><div>' + toggle + '</div><div style="white-space:pre-wrap">' + ddEsc(ddBox) + '</div></div>';
}

// Each id a way there (Andy: "the blocked and blocks lists link to the respective items").
function ddLinksHtml() {
  var f = ddFacts || {};
  var line = function (id) { return '<a href="#" data-open="' + ddEsc(id) + '" style="color:#cfe2ff">' + ddEsc(id) + '</a>'; };
  var by = (f.blocked || []).map(line).join(', ');
  var blocking = (f.blocking || []).map(line).join(', ');
  if (!by && !blocking) return '';
  return '<div class="stat-tile wide">' +
    (by ? '<div><span class="label">Blocked by</span> ' + by + '</div>' : '') +
    (blocking ? '<div><span class="label">Blocking</span> ' + blocking + '</div>' : '') + '</div>';
}

// CHAT LINES DRAWN READABLY (desk/G1.10): line breaks kept, short times
// (05:49), '- ' lines as a list, backquoted text as code. Still escaped.
function ddTime(at) {
  var d = new Date(at);
  if (isNaN(d.getTime())) return ddEsc(at);
  var two = function (n) { return (n < 10 ? '0' : '') + n; };
  return two(d.getHours()) + ':' + two(d.getMinutes());
}
function ddLineHtml(text) {
  var out = [];
  var list = [];
  var flush = function () { if (list.length) { out.push('<ul style="margin:2px 0 2px 18px">' + list.join('') + '</ul>'); list = []; } };
  String(text || '').split('\n').forEach(function (raw) {
    var line = ddEsc(raw).replace(/`([^`]+)`/g, '<code>$1</code>');
    if (/^- /.test(raw)) { list.push('<li>' + line.slice(2) + '</li>'); return; }
    flush();
    out.push(line);
  });
  flush();
  return out.join('<br>').replace(/<br>(<ul)/g, '$1').replace(/(<\/ul>)<br>/g, '$1');
}
function ddChatHtml() {
  if (!ddChat.length) return '<div class="job-manifest-note">Nothing said here yet.</div>';
  var older = ddChatMore ? '<div class="job-manifest-note">Older lines are not shown.</div>' : '';
  return ddChat.slice().reverse().map(function (l) {
    var his = l.by === 'andy';
    // His lines black and full width, the agents' plain: "similar in the details chat."
    var look = his
      ? ' style="text-align:right;background:#000;color:#fff;padding:4px 8px;margin:4px 0"'
      : ' style="border-left:3px solid currentColor;padding-left:8px;margin:4px 0"';
    return '<div' + look + '><b>' + ddEsc(his ? 'you' : l.by) + '</b> <span class="job-manifest-note">' + ddTime(l.at) + '</span> ' +
      ddLineHtml(l.text) + '</div>';
  }).join('') + older;
}

function ddSet(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; }

// Repaints every part between the inputs; a name he is typing survives it.
function ddPaint() {
  var typed = ddRenaming ? ddValue('dd-name') : '';
  ddSet('dd-head', ddHeadHtml());
  ddSet('dd-name-row', ddButtonsHtml());
  var box = ddRenaming && typed && document.getElementById('dd-name');
  if (box) box.value = typed;
  ddSet('dd-strip', ddStripHtml());
  ddSet('dd-box', ddBoxHtml());
  ddSet('dd-links', ddLinksHtml());
  ddSet('dd-chat', ddChatHtml());
  var err = document.getElementById('dd-error');
  if (err) err.textContent = ddNote;
  if (ddFacts && typeof ddApi.setScreenTitle === 'function') ddApi.setScreenTitle(ddId + ' — ' + (ddFacts.title || ''));
}

function ddValue(id) {
  var el = document.getElementById(id);
  return el ? String(el.value || '').trim() : '';
}
function ddClear(id) { var el = document.getElementById(id); if (el) el.value = ''; }

// What the server published about this item, painted as it comes.
// A change number that skips one means a publish went by unseen (desk/G3.10): the dialog asks item.get once.
var ddLastChange = 0;
function ddTake(obj) {
  if (!obj) return;
  // AN UPDATE TOO LARGE TO PUBLISH was dropped, and said: reload what is shown.
  if (obj.dropped) { if (ddId) ddLoad(); return; }
  var change = Number(obj.change) || 0;
  // AN OLDER UPDATE CHANGES NOTHING (goal/G2.1 note 7): publishes travel as their own requests and can
  // overtake each other; what is shown is never painted over by what came before it.
  if (change && ddLastChange && change < ddLastChange) return;
  var gap = ddLastChange && change > ddLastChange + 1;
  if (change) ddLastChange = change;
  if (gap && ddId) { ddLoad(); return; }
  if (!obj.item || obj.item.id !== ddId) return;
  ddFacts = obj.item;
  // A CHANGED BOX UNFOLDS (slim/G1.6 D6: "a changed block opens; his fold is his ack"): an agent's write while
  // his dialog is open must not hide behind his fold; he folds it again when he has read it.
  if (typeof obj.box === 'string') { ddBox = obj.box; ddVersion = Number(obj.version) || ddVersion; ddFolded = false; }
  if (obj.chat) ddChat.push(obj.chat);
  if (Array.isArray(obj.checks)) ddChecks = obj.checks;
  ddPaint();
}

var ddSending = false;
function ddSay() {
  var text = ddValue('dd-say');
  if (!text || ddSending) return;
  ddSending = true;
  ddWrite('chat.add', { id: ddId, text: text }).then(function () {
    ddSending = false;
    if (!ddNote) ddClear('dd-say');
  });
}
function ddRename() {
  var title = ddValue('dd-name');
  if (!title) return;
  ddWrite('item.rename', { id: ddId, title: title }).then(function () { ddRenaming = false; ddPaint(); });
}

// The item as the server has it now: at open, and again after a dropped publish (desk/G3.10).
// EACH PANEL ITS OWN ANSWER. Andy: "lazy load the panels when thy open". The facts first, then the box, the
// checks and the chat, each asked on its own, so no answer carries the sum of them.
function ddLoad() {
  var id = ddId;
  return ddAsk('item.get', { id: id }).then(function (got) {
    if (ddId !== id) return null;
    try { ddFacts = JSON.parse(got.item); } catch (e) { ddFacts = null; }
    ddVersion = Number(got.version) || 0;
    ddLastChange = Number(got.change) || ddLastChange;
    ddPaint();
    return Promise.all([
      ddAsk('item.box', { id: id }).then(function (b) { if (ddId !== id) return; ddBox = String(b.box || ''); ddVersion = Number(b.version) || ddVersion; ddPaint(); }),
      ddAsk('item.checks', { id: id }).then(function (k) { if (ddId !== id) return; ddChecks = k.checks || []; ddPaint(); }),
      ddAsk('item.chat', { id: id }).then(function (c) { if (ddId !== id) return; ddChat = c.chat || []; ddChatMore = !!c.chatMore; ddPaint(); }),
    ]);
  }).then(null, function (e) {
    ddNote = (e && e.refused ? 'Refused: ' : 'The desk server did not answer: ') + e.message;
    ddPaint();
  });
}

spirit.shell.activateApp({
  mount: function (container, api) {
    ddApi = api;
    container.innerHTML = '<div id="dd-body" class="stack"></div>';
    document.getElementById('dd-body').addEventListener('click', function (event) {
      var t = event.target;
      // Leaving for another item: Desk opens it once this one is closed.
      var link = t && t.closest && t.closest('[data-open]');
      if (link) {
        if (event.preventDefault) event.preventDefault();
        ddApi.closeDialog({ open: link.getAttribute('data-open') });
        return;
      }
      if (t && t.getAttribute && t.getAttribute('data-fold') === 'item') { ddFolded = !ddFolded; ddPaint(); return; }
      var check = t && t.getAttribute && t.getAttribute('data-check');
      if (check) { ddWrite('check.set', { id: ddId, check: check, state: 'passed' }); return; }
      var id = t && t.id;
      // CLOSE LEAVES THE DIALOG TOO (desk/G3.8). Andy: "when i click on Close in the Detail dialog, the Dialog
      // should close, since it doesn't exist in the list anymore either." Only once the server took it.
      if (id === 'dd-close') { ddPress('close').then(function (taken) { if (taken) ddApi.closeDialog({}); }); return; }
      if (id === 'dd-go' || id === 'dd-done' || id === 'dd-reopen') { ddPress(id.slice(3)); return; }
      if (id === 'dd-abandon' || id === 'dd-go-all') {
        if (ddArmed !== id) {
          ddArmed = id;
          ddPaint();
          if (typeof ddApi.armUntilElsewhere === 'function') ddApi.armUntilElsewhere(ddDisarm);
          return;
        }
        ddArmed = '';
        ddPress(id.slice(3));
        return;
      }
      if (id === 'dd-rename') { ddRenaming = true; ddPaint(); return; }
      if (id === 'dd-name-save') { ddRename(); return; }
      if (id === 'dd-say-send') ddSay();
    });
    document.getElementById('dd-body').addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.repeat && event.target && event.target.id === 'dd-name') {
        event.preventDefault();
        ddRename();
      }
    });
    // The desk server's changes, which the shell would otherwise hand only to Desk.
    if (typeof api.onPublished === 'function') api.onPublished(ddTake, 'desk');
  },

  // Every call: which item this is. Nothing stale from the last one.
  open: function (params) {
    ddId = String((params && params.id) || '');
    ddFacts = null;
    ddBox = '';
    ddVersion = 0;
    ddChecks = [];
    ddChat = [];
    ddChatMore = false;
    ddArmed = '';
    ddRenaming = false;
    ddNote = '';
    ddLastChange = 0;
    ddFolded = true;
    ddFrame();
    ddPaint();
    return ddLoad().then(function () {
      // Opening it is seeing it: his seen clears the item's star.
      if (ddFacts && ddFacts.star) ddPress('seen');
    });
  },
});
