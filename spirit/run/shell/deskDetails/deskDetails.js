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
var ddAgents = {};           // name -> {key}, handed over by Desk, for the nudge
var ddArmed = false;         // the goal's abandon, pressed once
var ddRenaming = false;
var ddNote = '';

function ddEsc(s) { return ddApi.escapeHtml(String(s == null ? '' : s)); }

// The one way to the desk server: jobs.api on the loopback door.
function ddAsk(verb, args) {
  var desk = {};
  desk[verb] = args;
  return Promise.resolve(ddApi.verb('jobs.api', { ask: { desk: desk } })).then(function (r) {
    var body = (r && r.body) || {};
    if (body.ok === false) throw new Error(body.error || body.code || 'refused');
    return body;
  });
}

// A BARE NUDGE (Andy's pick (b)): after the server has a change, each agent
// Desk knows gets an empty 'changed' packet and reads the state itself.
function ddNudge() {
  Object.keys(ddAgents).forEach(function (name) {
    var who = ddAgents[name];
    if (who && who.key && typeof ddApi.peerPost === 'function') {
      Promise.resolve(ddApi.peerPost('agents', who.key, { kind: 'changed' })).catch(function () { /* the next change nudges again */ });
    }
  });
}

// A write of Andy's. Nothing on screen changes until the server publishes.
// His seen is his reading, not a change for the agents: it nudges nobody.
function ddWrite(verb, args) {
  args.by = 'andy';
  return ddAsk(verb, args).then(function () { ddNote = ''; if (args.what !== 'seen') ddNudge(); }, function (e) {
    ddNote = 'Not taken: ' + e.message;
    ddPaint();
  });
}
function ddPress(what) { return ddWrite('press', { id: ddId, what: what }); }
function ddDisarm() { ddArmed = false; ddPaint(); }

// ── THE FRAME, DRAWN ONCE PER OPEN ────────────────────────────────────
//
// Andy: "if possible refresh only the chat history, so my typing doesn't get
// wiped". The inputs live in the frame and are never repainted.
function ddFrame() {
  var el = document.getElementById('dd-body');
  if (!el) return;
  el.innerHTML =
    // His buttons and the strip stay pinned below the title bar while the
    // rest scrolls (desk/G1.12).
    '<div style="position:sticky;top:0;z-index:2;background:#1a1a2e;padding-bottom:2px">' +
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
  if (f.goal === '') {
    html += '<button type="button" id="dd-abandon"' + (ddArmed ? ' data-armed="1"' : '') +
      ' style="margin-left:auto;background:#b00020;color:#fff">' +
      (ddArmed ? 'Sure? Abandon the goal' : 'Abandon') + '</button>';
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
function ddBoxHtml() {
  if (!ddBox) return '<div class="job-manifest-note">No text yet: an agent writes it.</div>';
  return '<div style="white-space:pre-wrap">' + ddEsc(ddBox) + '</div>';
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
  return ddChat.slice().reverse().map(function (l) {
    var his = l.by === 'andy';
    // His lines black and full width, the agents' plain: "similar in the details chat."
    var look = his
      ? ' style="text-align:right;background:#000;color:#fff;padding:4px 8px;margin:4px 0"'
      : ' style="border-left:3px solid currentColor;padding-left:8px;margin:4px 0"';
    return '<div' + look + '><b>' + ddEsc(his ? 'you' : l.by) + '</b> <span class="job-manifest-note">' + ddTime(l.at) + '</span> ' +
      ddLineHtml(l.text) + '</div>';
  }).join('');
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
function ddTake(obj) {
  if (!obj || !obj.item || obj.item.id !== ddId) return;
  ddFacts = obj.item;
  if (typeof obj.box === 'string') { ddBox = obj.box; ddVersion = Number(obj.version) || ddVersion; }
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
      var check = t && t.getAttribute && t.getAttribute('data-check');
      if (check) { ddWrite('check.set', { id: ddId, check: check, state: 'passed' }); return; }
      var id = t && t.id;
      if (id === 'dd-go' || id === 'dd-done' || id === 'dd-close' || id === 'dd-reopen') { ddPress(id.slice(3)); return; }
      if (id === 'dd-abandon') {
        if (!ddArmed) {
          ddArmed = true;
          ddPaint();
          if (typeof ddApi.armUntilElsewhere === 'function') ddApi.armUntilElsewhere(ddDisarm);
          return;
        }
        ddArmed = false;
        ddPress('abandon');
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
    if (typeof api.onPublished === 'function') api.onPublished(ddTake);
  },

  // Every call: which item this is. Nothing stale from the last one.
  open: function (params) {
    ddId = String((params && params.id) || '');
    ddAgents = (params && params.agents) || {};
    ddFacts = null;
    ddBox = '';
    ddVersion = 0;
    ddChecks = [];
    ddChat = [];
    ddArmed = false;
    ddRenaming = false;
    ddNote = '';
    ddFrame();
    ddPaint();
    return ddAsk('item.get', { id: ddId }).then(function (got) {
      try { ddFacts = JSON.parse(got.item); } catch (e) { ddFacts = null; }
      ddBox = String(got.box || '');
      ddVersion = Number(got.version) || 0;
      ddChecks = got.checks || [];
      ddChat = got.chat || [];
      ddPaint();
      // Opening it is seeing it: his seen clears the item's star.
      if (ddFacts && ddFacts.star) ddPress('seen');
    }, function (e) {
      ddNote = 'The desk server did not answer: ' + e.message;
      ddPaint();
    });
  },
});
