'use strict';
// IN A FUNCTION OF ITS OWN (goal/G49.23; the browser rule "it does not pollute the window namespace"): a page may load this file by a
// plain script tag, so nothing it declares stands on the window; what it hands out goes through module.exports.
(function () {
// THE BRANCHES IT READS, AS spirit.requireScript HANDS THEM BACK (goal/G49.23, box v22 Part 1: "an element reads a branch's rows from
// the branch spirit.requireScript hands back; it asks for no client"): each kept once loaded, its rows on it, a new-shape branch's
// as client, an old-shape branch's as data.
var KEPT_BRANCHES = {};
if (typeof window !== 'undefined' && window.spirit && typeof window.spirit.requireScript === 'function') ['spirit/app/desk/api.js'].forEach(function (p) { Promise.resolve(window.spirit.requireScript(p)).then(function (b) { KEPT_BRANCHES[p] = b || null; }, function () { /* not there: no rows */ }); });
// A new-shape branch carries its rows as client, an old-shape one as data.
function keptRows(p) { var b = KEPT_BRANCHES[p]; return b ? b.client || b.data || null : null; }
// spirit/run/spirit/app/desk/element/deskDetails/deskDetails.js
// ONE ITEM OF THE DESK, AS A DIALOG — desk/G2.7.
//
//   Andy: "The server determines all the content to be drawn. buttons, the
//   text in the one text box, the status of items, the title of items etc."
//   "I want one box only." "All other text-output-boxes are removed."
//   "no pulling". "a press shouldn't post a line, it is not textual information."
//
// WHAT COMES FROM WHERE. open() asks the desk server item.get once, as
// desk.item.get; after that the dialog paints only from what the server publishes
// (api.onPublished). It decides nothing: its buttons are the item's
// `buttons`, and a press goes to the server as a press, the screen waiting
// for the server's publish. The id, title and status ride in the shell's title
// bar; under it the button row, then a workBench: the left strip of panels (box,
// red Qs with grants and checks), the chat in the centre, the right side blank.

// THE INTERFACE IT CALLS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1; Andy: "EVERY FUCKING ELEMENT REQUIRES THE FUCKING
// INTERFACES IT FUCKING NEEDS"; app-child-browser.js): the desk family's api.js, which brings its data.js.
// IT PUTS NO NAME ON THE WINDOW (goal/G47.1; Andy: "a test \"does NOT pullute the windows namespace\" NOW!!!!"): the whole
// file runs inside one function, so its names stay its own; what it shares is its element, on the spirit object.
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  // What it reads, it asks for itself, as it runs (goal/G49.9; rule/26).
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/type/string/label/script.js');
  // What it reads, it asks for itself, as it runs (goal/G49.9; rule/26).
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/codeMirror.js');
if (typeof window !== 'undefined' && window.spirit && typeof window.spirit.requireScript === 'function') Promise.resolve(keepAnswer('spirit/app/desk/api.js')).catch(function () {});
// ONE INSTANCE PER DETAIL (goal/G49.8, point 4: "an app's row details, each in its own panel, shown again as left"): all it holds
// is made anew for each create, and every part it draws is found inside its own container, never by id on the whole page, so
// two items open in two layers hold two of everything and neither draws into the other's parts.
function ddInstance() {
var ddRoot = null;
function ddEl(id) { return ddRoot ? ddRoot.querySelector('#' + id) : null; }
var ddRelease = null;
var ddApi = null;
var ddId = '';
var ddFacts = null;          // the item's facts, as the server last said them
var ddBox = '';
var ddVersion = 0;
var ddChecks = [];
var ddChat = [];
var ddChatMore = false;       // older lines the server left out (desk/G3.3)
// GRANTS SENT, NOT YET PUSHED BACK (goal/G33.8, box v11; Andy: "i had to grant appServer.js twice"): a confirmed grant
// shows granting… until the desk's pushed check row says granted; a refusal clears it. Never asked again (Andy's rule:
// a client's change lands only via the desk's push).
var ddPending = {};          // check number -> true
// THE NEWEST CHANGE SEEN, PER ROW (goal/G33.8, box v11): publishes travel as their own requests and can overtake each
// other; a row is never painted over by an older version of the same row, and an earlier write's other rows still land.
var ddRowChange = {};        // table|id|row key -> change
var ddRenaming = false;
var ddNote = '';

function ddEsc(s) { return ddApi.escapeHtml(String(s == null ? '' : s)); }

// The one way to the desk server: its verb by name on the flat apiDoor (desk.<verb>, goal/G30.6).
function ddAsk(verb, args) {
  return Promise.resolve(ddApi.verb('spirit/app/desk/api.js', verb, args)).then(function (r) {
    var body = (r && r.body) || {};
    if (body.ok === false) { var e = new Error(ddRefusalText(body)); e.refused = true; throw e; }
    return body;
  });
}
// A REFUSAL BY ITS NAME, SIZE AND LIMIT (Andy: "would have been diagnosed in an instant").
function ddRefusalText(body) {
  var x = body.extra || {};
  // A REFUSAL SAYS WHY (goal/G10.10): the server's reason, when it gives one, is what he reads, not the code's
  // default wording ("text required" for any bad-request).
  if (x.why) return String(x.why);
  return String(body.code || 'refused') + (typeof x.bytes === 'number' ? ': ' + x.bytes + ' bytes, the limit is ' + x.max : '') + (body.error ? ' (' + body.error + ')' : '');
}

// A write of Andy's. Nothing on screen changes until the server publishes.
// THE DIALOG NUDGES NOBODY (goal/G3.8): the desk server nudges each agent's
// deskClient itself on his writes (goal/G3.5).
// Answers whether the server took it. It sends no by: the desk takes its writer from the caller (apiAuth/G1.13).
function ddWrite(verb, args) {
  return ddAsk(verb, args).then(function () { ddNote = ''; return true; }, function (e) {
    ddNote = 'Not taken: ' + e.message;
    ddPaint();
    return false;
  });
}
function ddPress(what) { return ddWrite('press', { id: ddId, what: what }); }

// THE ARE-YOU-SURE IS THE SHELL'S (goal/G41.9; Andy, Q1: "absolutely"): every two-press button here is an armingButton
// (spirit/element/armingButton/script.js), which the dialog loads itself. A button drawn with data-arming="<what it says armed>" is
// made one after each paint; it arms, says so, and disarms itself on a click elsewhere; its second press is ddSecondPress.
// A CHAT LINE STOPS AT 1024 BYTES (goal/G41.27; Andy: "the desk should limit its chat line to 1024 bytes."): the say box
// held to its type by fieldInput, loaded here with the armingButton and attached after each paint.
var ddParts = Promise.resolve(typeof spirit !== 'undefined' && spirit.requireScript
  ? Promise.all([keepAnswer('spirit/element/armingButton/script.js'), keepAnswer('spirit/element/fieldInput/script.js')]) : null);
  // ITS FIELDS' TYPES, REQUIRED HERE BY THEIR FULL PATHS (goal/G49.13; Andy: "The UI elements need to know which spirit/type
  // their fields are and require that type"): the types fieldInput holds its fields to.
  if (window.spirit && typeof window.spirit.requireScript === 'function') { window.spirit.requireScript('spirit/type/string/paragraph/script.js'); window.spirit.requireScript('spirit/type/string/label/script.js'); window.spirit.requireScript('spirit/type/string/box/script.js'); }
function ddArming() {
  return ddParts.then(function () {
    var A = typeof window !== 'undefined' && ANSWER['spirit/element/armingButton/script.js'];
    var F = typeof window !== 'undefined' && ANSWER['spirit/element/fieldInput/script.js'];
    var say = ddEl('dd-say');
    if (F && say && !say.getAttribute('data-held')) { F.attach(say, 'spirit/type/string/paragraph/script.js'); say.setAttribute('data-held', 'paragraph'); }
    // Your name for the item, a label (goal/G48.4, box v22).
    var myName = ddEl('dd-name');
    if (F && myName && !myName.getAttribute('data-held')) { F.attach(myName, 'spirit/type/string/label/script.js'); myName.setAttribute('data-held', 'label'); }
    // The box's text, held to the type box.write takes (spirit/type/string/box/script.js).
    var boxText = ddEl('dd-box-input');
    if (F && boxText && !boxText.getAttribute('data-held')) { F.attach(boxText, 'spirit/type/string/box/script.js'); boxText.setAttribute('data-held', 'box'); }
    var body = ddEl('dd-body');
    if (!A || !body || typeof body.querySelectorAll !== 'function') return;
    Array.prototype.forEach.call(body.querySelectorAll('[data-arming]'), function (b) {
      if (typeof b.armed === 'function') return;
      A.attach(b, { label: b.textContent, armedLabel: b.getAttribute('data-arming'), run: function () { ddSecondPress(b); } });
    });
  }, function () { /* no armingButton, no second press */ });
}
// The second press, as each button wrote before.
function ddSecondPress(b) {
  var qclear = b.getAttribute('data-qclear');
  if (qclear) { ddWrite('chat.add', { id: ddId, text: qclear + ': clear' }); return; }
  var g = b.getAttribute('data-grant');
  if (g) {
    var sent = g === 'all' ? ddChecks.filter(function (c) { return c.kind === 'G' && c.state === 'open'; }).map(function (c) { return c.number; }) : [g];
    sent.forEach(function (n) { ddPending[n] = true; });
    ddPaint();
    ddWrite('check.set', { id: ddId, check: g, state: 'granted' }).then(function (ok) {
      if (ok) return;
      sent.forEach(function (n) { delete ddPending[n]; });
      ddPaint();
    });
    return;
  }
  // CLOSE LEAVES THE DIALOG TOO (desk/G3.8), only once the server took it.
  if (b.id === 'dd-close') { ddPress('close').then(function (taken) { if (taken) ddApi.closeDialog({}); }); return; }
  // DELETE IS A VERB, NOT A PRESS (goal/G9.7), and it takes the item off the List, so the dialog goes with it.
  if (b.id === 'dd-delete') { ddWrite('item.delete', { id: ddId }).then(function (taken) { if (taken) ddApi.closeDialog({}); }); return; }
  ddPress(b.id.slice(3));
}

// ── THE FRAME, DRAWN ONCE PER OPEN ────────────────────────────────────
//
// Andy: "if possible refresh only the chat history, so my typing doesn't get
// wiped". The inputs live in the frame and are never repainted.
// THE PANEL IS A workBench (goal/G41.22, box v15; Andy: "the item panel drops appHeader", "one row, the button row, at
// the top, using the whole width, like it is today", "just use workBench", "the left icons strip and panel, are what we
// have today", "the center panel us the chat", "the right panel, we leave blank"). The
// id, title and status stay in the shell's title bar (ddPaint). The left pane and the chat are written in a
// holder first, so the inputs are in the frame from the start; the workBench, once spirit.requireScript brings it, takes them.
// goal/G41.23: its panels' icons stand alone on the bench's strip, which paints them through the icon element; the panel
// loads that element too, as it draws with it (Andy: "this element will replace icons painting all shell elements and
// apps.").
var ddBenchParts = typeof spirit !== 'undefined' && spirit.requireScript
  ? Promise.all([keepAnswer('spirit/element/workBench/script.js'), keepAnswer('spirit/element/icon/script.js')])
  : Promise.resolve(null);
var ddBench = null;
var ddBenchBoxes = {};
var ddFrameN = 0;
function ddFrame() {
  var el = ddEl('dd-body');
  if (!el) return;
  if (ddBench && typeof ddBench.destroy === 'function') ddBench.destroy();
  ddBench = null;
  ddBenchBoxes = {};
  var n = ++ddFrameN;
  el.innerHTML =
    // FLAT, NO TITLE BUBBLE (goal/G9.6). Andy: "the deskDetail has the title already in the shells title bar", and
    // "no rounded corners", "no margins and no padding". The status the bubble carried rides in the title bar.
    '<div id="dd-bars" style="flex:none">' +
      '<div id="dd-name-row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center"></div>' +
    '</div>' +
    // A waiting icon blinks (goal/G30.8: "the icons on the left will blink if grants, or red Q's need my attention").
    '<style>.dd-blink{animation:ddBlink 1s step-start infinite}@keyframes ddBlink{50%{opacity:.2}}</style>' +
    '<div id="dd-bench" class="fill" style="min-height:0"></div>' +
    '<div id="dd-hold">' +
      // The left pane's content, a box of its own that scrolls (goal/G41.11: a long list is never cut off unseen).
      // The left pane's content: its rows on top, the panel taking the rest (each panel scrolls in itself, ddPanelHtml).
      '<div id="dd-left" class="fill" style="min-height:0;overflow:hidden">' +
        // THE PLUNGER'S ROWFORM (goal/G49) stands in the frame, so a title being typed survives every repaint; it shows with
        // the plunger's panel only (ddPaint).
        '<div id="dd-add-row" style="flex:none;display:none"></div>' +
        '<div id="dd-panel" class="fill" style="min-height:0"></div>' +
      '</div>' +
      // THE CENTRE IS THE CHAT (goal/G41.22; Andy: "newest lines at the bottom, pinned to the bottom, and older lines above"),
      // its input at the bottom. No search over it (goal/G43.22; Andy: "take out the chat-search do, it's not actually usable.").
      '<div id="dd-centre" class="fill" style="min-height:0">' +
        '<div id="dd-chat" style="flex:1 1 auto;min-height:0;overflow:auto"></div>' +
        '<div id="dd-error" class="job-start-error" style="flex:none"></div>' +
        '<div class="start-job-form card" style="flex:none"><label class="field-label grow">Say' +
          // Return is a new line; only Send sends (desk/G1.12). Sized up and down only (Andy: "the chat input can only be
          // sized vertially").
          '<textarea id="dd-say" rows="3" placeholder="under this item" style="resize:vertical"></textarea></label>' +
          '<button type="button" id="dd-say-send">Send</button></div>' +
      '</div>' +
    '</div>';
  ddBenchParts.then(function () { ddMakeBench(n); }, function () { /* no workBench: the holder shows it all, as written */ });
  ddAddParts.then(function () { ddMakeAdd(n); }, function () { /* no rowForm: no add */ });
}
// THE PLUNGER (goal/G49; Andy: "put the plunger back with one rowForm: ➕ \"Add blocking item\" [title-input] [Add-button],
// which will add an item with <Title> blocking the goal/item it was created from."): the shell's rowForm, its span holding
// the words and the title input (a label, fieldInput), its Add busy until the desk answers (busyButton). On a goal the new
// item is the goal's; on an item it is of the same goal and blocks that item (item.add blocks).
var ddAddParts = typeof spirit !== 'undefined' && spirit.requireScript
  ? Promise.all([keepAnswer('spirit/element/rowForm/script.js'), keepAnswer('spirit/element/fieldInput/script.js')])
  : Promise.resolve(null);
function ddMakeAdd(n) {
  var R = ANSWER['spirit/element/rowForm/script.js'];
  var F = ANSWER['spirit/element/fieldInput/script.js'];
  var row = ddEl('dd-add-row');
  if (n !== ddFrameN || !R || typeof R.create !== 'function' || !row || row.firstChild) return;
  var form = R.create(row, { icon: '➕', button: 'Add', press: function () { return ddAdd(); } });
  var words = document.createElement('span');
  words.textContent = 'Add blocking item';
  form.span.appendChild(words);
  var input = document.createElement('input');
  input.type = 'text';
  input.id = 'dd-add-title';
  input.placeholder = 'title';
  if (F && typeof F.attach === 'function') F.attach(input, 'spirit/type/string/label/script.js');
  form.span.appendChild(input);
}
function ddAdd() {
  var title = ddValue('dd-add-title');
  var f = ddFacts || {};
  if (!title) return Promise.resolve(false);
  var args = f.goal === '' ? { goal: ddId, title: title } : { goal: String(f.goal), title: title, blocks: ddId };
  return ddWrite('item.add', args).then(function (taken) {
    if (taken) { ddClear('dd-add-title'); ddLoad(); }
    return taken;
  });
}
// The left pane shows today's panel of the tool shown; the strip's tool is the panel's key (DD_PANELS).
function ddShowLeft(name) {
  var left = ddEl('dd-left');
  var box = ddBenchBoxes[name];
  if (left && box && left.parentNode !== box) box.appendChild(left);
}
function ddMakeBench(n) {
  var W = ANSWER['spirit/element/workBench/script.js'];
  var host = ddEl('dd-bench');
  var hold = ddEl('dd-hold');
  var centre = ddEl('dd-centre');
  if (n !== ddFrameN || !W || typeof W.create !== 'function' || !host || !centre) return;
  ddBench = W.create(host, {
    left: DD_PANELS.map(function (p) {
      // workBench says changed before it makes a tool's box, so the first show of a tool moves the panel here, once its
      // box is there (Andy: "i want to see the panel content THE FIRST TIME i pop in a panel, NOT the second time").
      return { name: p.key, icon: p.icon, title: p.title, mount: function (box) { ddBenchBoxes[p.key] = box; if (ddPanelSel === p.key) ddShowLeft(p.key); } };
    }),
    // goal/G41.22: the right side is blank.
    right: [],
    changed: function (side, name) {
      if (side !== 'left' || !name) return;
      ddShowLeft(name);
      if (name === ddPanelSel) return;
      ddPanelSel = name;
      ddPaint();
    },
  });
  ddBench.center.appendChild(centre);
  // The bench shows its first tool when it is made; a press of the tool shown would collapse the side (found by wsl in
  // the browser: no left panel until an icon was pressed), so only another tool is pressed.
  if (ddBench.shown('left') !== ddPanelSel) ddBench.press('left', ddPanelSel);
  ddShowLeft(ddPanelSel);
  if (hold && hold.parentNode) hold.parentNode.removeChild(hold);
  ddPaint();
}

// goal/G33.4: an item's own End design, while its goal is out of design.
// goal/G41.2: Start design too, which the desk offers on any item (goal/G40.12: "You can turn design on for an item
// at any time").
var DD_LABELS = { 'start-design': 'Start design', 'end-design': 'End design', go: 'Go!', done: 'Done', close: 'Close', reopen: 'Reopen' };

// CLOSE BEFORE HIS GO IS ARMED, AT THE RIGHT EDGE (goal/G3.9). Andy, 2026-10-03: "A close - with arm-button is
// available on the right edge of the button bar, before an item has received a 'go' or a 'done'", "the close-with
// arm is only visible on the item detail". EVERY CLOSE ARMS NOW (goal/G43.30; Andy: "make sure that all delete and close
// buttons are armingButton's"): a done item's Close too, which desk/G3.8 had press at once.
function ddEarlyClose(f) { return f.status !== 'done' && f.status !== 'closed' && (f.buttons || []).indexOf('close') !== -1; }
function ddButtonsHtml() {
  var f = ddFacts || {};
  var early = ddEarlyClose(f);
  var html = (f.buttons || []).filter(function (b) { return DD_LABELS[b] && !(early && b === 'close'); }).map(function (b) {
    var label = DD_LABELS[b];
    // START AND END DESIGN ASK ARE-YOU-SURE (goal/G41.11). Andy: "the start-design and end-design buttons in an item
    // must ask: are-you-sure". Armed like Waive (ddArming); the second press is ddSecondPress's.
    // AND CLOSE (goal/G43.30): every Close arms first.
    var design = b === 'start-design' || b === 'end-design' || b === 'close';
    return '<button type="button" id="dd-' + b + '"' + (design ? ' data-arming="' + label + ': sure?"' : '') + '>' + label + '</button>';
  }).join('');
  html += ddRenaming
    ? '<label class="field-label grow">Your name for it<input type="text" id="dd-name" data-field="label" placeholder="in your own words"></label>' +
      '<span class="job-manifest-note" id="dd-name-left"></span>' +
      '<button type="button" id="dd-name-save">Save</button>'
    : '<button type="button" id="dd-rename">Rename</button>';
  // THE GOAL'S ABANDON: "a red, arming-button ... with are-you-sure", "at the
  // very right of the button row". An armingButton (ddArming), as every
  // are-you-sure below.
  // GO ALL ON THE GOAL (desk/G3.7). Andy: "the goal-detail panel could offer the
  // go-all button if there is any go-able items". Armed like the List's (G3.4).
  if (f.goal === '' && (f.buttons || []).indexOf('go-all') !== -1) {
    html += '<button type="button" id="dd-go-all" data-arming="Go all: sure?">Go all</button>';
  }
  // DELETE (goal/G9.7). Andy: "the button bar of items will offer an arm-able [delete] while in design mode." The
  // server offers it only then (buttons), so the bar draws it from the facts and arms like Go all: the first click arms,
  // the second deletes. His decision that it closes rather than erases is the server's (goal/G9.7, goal/G4.24).
  if ((f.buttons || []).indexOf('delete') !== -1) {
    html += '<button type="button" id="dd-delete" data-arming="Delete: sure?">Delete</button>';
  }
  // MAKE CURRENT (goal/G2.19). Andy: "on any open goal i want a button \"make current goal\"". The server offers it on
  // an open goal that is not current; it presses at once, since switching goals undoes nothing.
  if ((f.buttons || []).indexOf('make-current') !== -1) {
    html += '<button type="button" id="dd-make-current">Make current goal</button>';
  }
  if (f.goal === '') {
    html += '<button type="button" id="dd-abandon" data-arming="Sure? Abandon the goal"' +
      ' style="margin-left:auto;background:#b00020;color:#fff">Abandon</button>';
  }
  // goal/G43.30: every Close is an armingButton (desk/G3.9). A goal's asks with the count of its items still open
  // (goal/G5.6: "if it has items still open it can ask me: are you sure?"), from the items the page holds.
  var goalOpen = f.goal === '' ? ddOpenItems(f.id) : 0;
  if (early) html += '<button type="button" id="dd-close" data-arming="' + (goalOpen ? 'are you sure? ' + goalOpen + ' open' : 'Close: sure?') + '" style="margin-left:auto">Close</button>';
  return html;
}

// THE C CHECKS ARE "HOW YOU CHECK IT": listed under the red Qs in their panel (ddQsHtml), each pressed to tick it
// ("it inspires diligence").
// THE STRIP AND ITS PANELS (goal/G30.8). Andy, 2026-10-20: "when i click on the box icon the box appears in the upper
// panel", "click on red Q's icon, it's the red Q's in the upper half", and "the icons on the left will blink if grants, or
// red Q's need my attention, i won't have to scroll around, and dialog elements can lazy-load". The box shows on open.
// A blinking icon (dd-blink) is read from the checks: an open red Q, an open grant.
var ddPanelSel = 'box';
var DD_PANELS = [
  { key: 'box', icon: '📃', title: 'the box' },
  { key: 'qs', icon: '❌', title: 'red Qs, grants and checks' },
  // goal/G49: the plunger, its rowForm in the frame (ddMakeAdd).
  { key: 'blocks', icon: '🪠', title: 'add a blocking item' },
];
function ddWaits(kind) { return ddChecks.some(function (c) { return c.kind === kind && c.state === 'open'; }); }
// The workBench draws the strip and marks the shown tool (goal/G41.22); a waiting icon on it blinks.
function ddBlinkIcons() {
  var body = ddEl('dd-body');
  if (!body || typeof body.querySelectorAll !== 'function') return;
  var blink = { qs: ddWaits('Q') || ddWaits('G') };
  Array.prototype.forEach.call(body.querySelectorAll('[data-side="left"][data-tool]'), function (b) {
    var on = !!blink[b.getAttribute('data-tool')];
    if (b.classList) b.classList.toggle('dd-blink', on);
  });
}
// The red Qs open on this item, each with his remove (his clear, "Q1: clear", desk clearOf), and the checks (C) to press.
function ddQsHtml() {
  var qs = ddChecks.filter(function (c) { return c.kind === 'Q' && c.state === 'open'; }).map(function (c) {
    return '<div><span data-question="' + ddEsc(c.number) + '" style="color:#d00;cursor:pointer" title="answer it below">' + ddEsc(c.number) + ': ' + ddEsc(c.words) + '</span> ' +
      // WHO ASKED (goal/G43.3; Andy, the box: "red Q's should indicate who posted them.").
      (c.placedBy ? '<span class="job-manifest-note">(' + ddEsc(String(c.placedBy)) + ')</span> ' : '') +
      // THE REMOVE ASKS ARE-YOU-SURE (goal/G41.11). Andy: "the remove button for red Q's must ask: are-you-sure?".
      '<button type="button" data-qclear="' + ddEsc(c.number) + '" data-arming="Remove: sure?" title="remove this red Q">remove</button></div>';
  }).join('');
  var cs = ddChecks.filter(function (c) { return c.kind === 'C'; }).map(function (c) {
    var done = c.state === 'passed';
    return '<div><button type="button" data-check="' + ddEsc(c.number) + '"' + (done ? ' disabled' : '') + '>' + (done ? '✓ ' : '') + ddEsc(c.number) + '</button> ' + ddEsc(c.words) + '</div>';
  }).join('');
  return (qs || '<div class="job-manifest-note">No red Q is open.</div>') + cs;
}
// The grants: the open ones as his armed buttons, FIRST (goal/G33.8, box v10), and the given ones in green under them.
// open says which.
function ddGrantsHtml(open) {
  // GRANT-ALL (goal/G32.2). Andy, 2026-10-22: "gimme a Grant-All, too". Armed like every grant; one write grants them all.
  var openCount = ddChecks.filter(function (c) { return c.kind === 'G' && c.state === 'open' && !ddPending[c.number]; }).length;
  var all = open && openCount > 1 ? '<div><button type="button" data-grant="all" data-arming="Grant all ' + openCount + ': sure?"' +
    ' style="background:#c00;color:#fff">Grant all ' + openCount + '</button></div>' : '';
  return all + ddChecks.map(function (c) {
    if (!open && c.kind === 'G' && c.state === 'granted') {
      return '<div data-granted="' + ddEsc(c.number) + '" style="color:#1a7f37" title="granted ' + ddEsc(c.at) + '">✓ ' + ddEsc(c.number) + ' ' + ddEsc(c.words) + '</div>';
    }
    if (open && c.kind === 'G' && c.state === 'open' && ddPending[c.number]) {
      return '<div data-pending="' + ddEsc(c.number) + '"><button type="button" disabled style="background:#888;color:#fff">granting…</button> ' + ddEsc(c.words) + '</div>';
    }
    if (open && c.kind === 'G' && c.state === 'open') {
      return '<div><button type="button" data-grant="' + ddEsc(c.number) + '" data-arming="Grant ' + ddEsc(c.number) + ': sure?"' +
        ' style="background:#c00;color:#fff">Grant ' + ddEsc(c.number) + '</button> ' + ddEsc(c.words) + '</div>';
    }
    return '';
  }).join('');
}
// EVERY LEFT PANEL USES ALL ITS PANE (goal/G41.22; Andy: "all left side panels must fucking use all available vertical
// space, especially the lists"): what stands on top stays put, the list under it takes the rest and scrolls in itself.
function ddScrolls(html) { return '<div class="fill" style="min-height:0;overflow:auto">' + html + '</div>'; }
function ddPanelHtml() {
  // The open grants pinned on top (goal/G33.8, box v10), the red Qs, the given grants and the checks under them.
  if (ddPanelSel === 'qs') return '<div style="flex:none">' + ddGrantsHtml(true) + '</div>' + ddScrolls(ddQsHtml() + ddGrantsHtml(false));
  // The plunger's panel is its rowForm alone, above it in the frame.
  if (ddPanelSel === 'blocks') return '';
  return ddBoxHtml();
}

// THE ONE BOX. An item with no text yet says so; an agent writes it.
// NO FOLD ANY MORE (goal/G30.8; Andy, 2026-10-20: "the box no longer needs to be foldable, it is now space-limited and
// contained"): the box fills its panel and scrolls inside it.
// HIS TIME IN THE BOX (goal/G9.3): on while he is in the textarea, with the text as it stood when he went in, so a
// blur that changed nothing writes nothing. Focus and blur arrive more than once (the element, the body), so the flag
// is what keeps one write.
var ddBoxFocused = false;
// THE ITEM THE BOX WAS FOCUSED ON (goal/G19.5): the blur writes there, whatever item is open by then. Andy: "yes." to
// "the dialog box write only to the item it was opened for".
var ddBoxFocusId = '';
var ddBoxAtFocus = '';
var ddBoxLoaded = false;  // true once item.box has answered for the open item (goal/G9.15)
// THE BOX ON SCREEN IS A CODEMIRROR (goal/G43.3; Andy, the box: "i want the UI to allow me to search the box currently
// displayed: the exact content of the box on my screen, also a codeMirror box on-screen would help because it show
// line-numbers?", and "above the box i want to see the the last-stored version number of the box."). One view for the open
// item, kept across repaints, or his words in the search and his place in the text would go with every row that comes.
// { id, el, view, find }; until it has loaded the textarea stands, so the box is never out of his reach.
var ddBoxView = null;
var ddBoxViewAsked = '';
function ddBoxText() {
  if (ddBoxView && ddBoxView.id === ddId) return ddBoxView.view.value();
  var el = ddEl('dd-box-input');
  return el ? String(el.value || '') : '';
}
function ddBoxMount() {
  var host = ddEl('dd-box-host');
  if (!host) return;
  if (!ddBoxView || ddBoxView.id !== ddId) {
    if (ddBoxViewAsked === ddId) return;
    var id = ddId;
    ddBoxViewAsked = id;
    ddNeed('spirit/element/codeMirror.js').then(function () {
      var el = document.createElement('div');
      el.className = 'fill';
      el.style.cssText = 'min-height:0;height:100%;display:flex;flex-direction:column';
      el.innerHTML = '<div style="display:flex;gap:1em;align-items:center;margin-bottom:0.25em"><span class="job-manifest-note" data-box-version></span>' +
        // No find field over the box (goal/G43.22; Andy: "the codeMirror search works better for editing purposes.").
        '</div><div data-box-editor style="flex:1 1 0;min-height:0;position:relative"></div>';
      return ANSWER['spirit/element/codeMirror.js'].create(el.querySelector('[data-box-editor]'), { mode: 'edit', text: ddBox }).then(function (view) {
        // He went into the textarea meanwhile, or left the item: it stays as it is, and the next item asks anew.
        if (ddId !== id || ddBoxFocused) { ddBoxViewAsked = ''; return; }
        // It fills what the version row leaves, and scrolls inside it (goal/G40.8: only a list or a viewer scrolls).
        view.cm.getWrapperElement().style.cssText += ';position:absolute;top:0;left:0;right:0;bottom:0;height:auto';
        view.cm.on('focus', ddBoxFocus);
        view.cm.on('blur', ddBoxBlur);
        ddBoxView = { id: id, el: el, view: view };
        ddPaint();
      });
    }).catch(function () { /* the textarea stands */ });
    return;
  }
  var v = ddBoxView;
  host.innerHTML = '';
  host.appendChild(v.el);
  v.el.querySelector('[data-box-version]').textContent = 'version ' + ddVersion;
  if (!ddBoxFocused && v.view.value() !== ddBox) v.view.cm.setValue(ddBox);
  v.view.cm.refresh();
}
function ddBoxHtml() {
  // ALWAYS AN INPUT (goal/G9.15). Andy, 2026-10-09: "a goal or item box is always visible and ready to edit by user or
  // agents." An empty box is the same textarea, so the first text of a goal or item he just made can be his; only
  // while the box has not yet come back from the server is there nothing to edit, or his typing could overwrite a
  // text he has not seen.
  if (!ddBoxLoaded) return '<div class="job-manifest-note">Reading the box.</div>';
  // HIS INPUT AREA (goal/G9.3): a textarea holding the whole text, as tall as its panel. It is never repainted while he
  // has it (ddPaint), so his typing cannot be wiped.
  // THE FULL HEIGHT OF ITS PANE (goal/G41.22; Andy: "the box must use the full vertical space").
  if (ddBoxView && ddBoxView.id === ddId) return '<div id="dd-box-host" class="fill" style="min-height:0;box-sizing:border-box"></div>';
  return '<div id="dd-box-host" class="fill" style="min-height:0;box-sizing:border-box">' +
    '<textarea id="dd-box-input" style="flex:1 1 auto;min-height:0;width:100%;box-sizing:border-box;white-space:pre-wrap;resize:none;overflow-y:auto">' + ddEsc(ddBox) + '</textarea></div>';
}

// WHAT WAITS ON HIM (goal/G4.20 points 10-11). Andy: "the Grants are red arm-buttons that turn green
// and are logged, and questions are red-text that disappears when you feel i answered usefully." The grants are the
// files panel's (ddGrantsHtml), the red Qs their own panel's (ddQsHtml, goal/G30.8). An open question shows its number
// and words ("the questions number and the text (for me)"); a click puts "Q1: <words>" in his input.
// A question clicked goes into his input as a line of its own, followed by two newlines (goal/G21.2). Andy, in the
// item's box: "A red Q clicked into Andy's chat box arrives followed by two newlines, so the question stands apart from
// the answer he writes below it."
function ddQuote(number) {
  var c = ddChecks.filter(function (x) { return x.number === number; })[0];
  var say = ddEl('dd-say');
  if (!c || !say) return;
  var had = String(say.value || '');
  say.value = (had && !/\n$/.test(had) ? had + '\n' : had) + c.number + ': ' + c.words + '\n\n';
  if (typeof say.focus === 'function') say.focus();
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
// EVERY LINE A BUBBLE, LEFT-ALIGNED, 1em APART (goal/G6.2). Andy, FACE.md: "I want all my chat-log entries to be
// left-aligned, not right-aligned." / "i want chat log entries for everybody to display in bubbles, separated
// vertically be 1em space."
function ddBubble(l) {
  var his = l.by === 'andy';
  var look = his
    ? ' style="margin:1em 0;padding:6px 10px;background:#000;color:#fff;border-radius:var(--spirit-radius,8px)"'
    : ' style="margin:1em 0;padding:6px 10px;background:rgba(255,255,255,0.08);border-radius:var(--spirit-radius,8px)"';
  return '<div' + look + '><b>' + ddEsc(his ? 'you' : l.by) + '</b> <span class="job-manifest-note">' + ddTime(l.at) + '</span> ' +
    ddLineHtml(l.text) + '</div>';
}
function ddChatHtml() {
  if (!ddChat.length) return '<div class="job-manifest-note">Nothing said here yet.</div>';
  var older = ddChatMore ? '<div class="job-manifest-note">Older lines are not shown.</div>' : '';
  return older + ddChat.map(ddBubble).join('');
}
// THE CHAT IS NEVER DRAWN AGAIN WHOLE BY A PAINT (goal/G41.11; Andy: "in ALL the chats, new lines are no added, THE WHOLE
// FUCKING THING IS REDRAWN, killing my attempted copies"): each bubble shown is kept by its line; a changed one replaces
// only its own bubble, a line gone takes its bubble with it. A new frame draws it once, whole.
// NEWEST AT THE BOTTOM, PINNED THERE (goal/G41.22; Andy: "newest lines at the bottom, pinned to the bottom, and older
// lines above"): the lines read oldest to newest, a new line goes in at the bottom, and the chat is scrolled to its end.
var ddChatShown = { host: null, items: [], more: false };
function ddChatKey(l) { return String(l.at) + '|' + String(l.key || l.by); }
// It stays pinned while the box changes size under it (the parts above it drawn late made it 44 pixels shorter after the
// pin, found in the browser by wsl): pinned is whether he is at the end, and a change of size keeps him there.
var ddChatPinned = true;
var ddChatWatched = null;
function ddChatPin(host) {
  host.scrollTop = host.scrollHeight;
  ddChatPinned = true;
  if (ddChatWatched === host || typeof ResizeObserver !== 'function' || typeof host.addEventListener !== 'function') return;
  ddChatWatched = host;
  host.addEventListener('scroll', function () { ddChatPinned = host.scrollTop >= host.scrollHeight - host.clientHeight - 2; });
  new ResizeObserver(function () { if (ddChatPinned) host.scrollTop = host.scrollHeight; }).observe(host);
}
function ddChatSync() {
  var host = ddEl('dd-chat');
  if (!host) return;
  var want = ddChat.map(function (l) { return { k: ddChatKey(l), h: ddBubble(l) }; });
  var whole = host !== ddChatShown.host || !want.length || !ddChatShown.items.length || ddChatMore !== ddChatShown.more;
  if (whole) {
    host.innerHTML = ddChatHtml();
    // The note over the lines, when older lines are left out, is the first child.
    var kids = Array.prototype.slice.call(host.children || [], ddChatMore ? 1 : 0);
    ddChatShown = { host: host, more: ddChatMore, items: want.length ? want.map(function (w, i) { return { k: w.k, h: w.h, node: kids[i] }; }) : [] };
    ddChatPin(host);
    return;
  }
  var grew = want.length && ddChatShown.items.length && want[want.length - 1].k !== ddChatShown.items[ddChatShown.items.length - 1].k;
  var drawn = Object.create(null);
  ddChatShown.items.forEach(function (d) { drawn[d.k] = d; });
  var wanted = Object.create(null);
  want.forEach(function (w) { wanted[w.k] = true; });
  ddChatShown.items.forEach(function (d) { if (!wanted[d.k] && d.node && d.node.parentNode === host) host.removeChild(d.node); });
  var foot = null;
  var next = [];
  // From the newest up: a kept bubble stays where it is; a changed one is replaced in place; a new one goes in just
  // above the bubble under it, or last.
  for (var i = want.length - 1; i >= 0; i--) {
    var w = want[i];
    var d = drawn[w.k];
    if (d && d.h === w.h) { next.unshift(d); continue; }
    var hold = document.createElement('div');
    hold.innerHTML = w.h;
    var node = hold.firstChild;
    if (d && d.node && d.node.parentNode === host) host.replaceChild(node, d.node);
    else host.insertBefore(node, next.length ? next[0].node : foot);
    next.unshift({ k: w.k, h: w.h, node: node });
  }
  ddChatShown = { host: host, more: ddChatMore, items: next };
  // A new line at the bottom keeps it pinned there; any other repaint leaves the scroll where he put it.
  if (grew) ddChatPin(host);
}

function ddSet(id, html) { var el = ddEl(id); if (el) el.innerHTML = html; }

// Repaints every part between the inputs; a name he is typing survives it.
function ddPaint() {
  var typed = ddRenaming ? ddValue('dd-name') : '';
  ddSet('dd-name-row', ddButtonsHtml());
  var box = ddRenaming && typed && ddEl('dd-name');
  if (box) box.value = typed;
  ddBlinkIcons();
  // NOT WHILE HE IS IN THE BOX (goal/G9.3): a repaint would throw away what he has typed.
  if (!(ddPanelSel === 'box' && ddBoxFocused)) { ddSet('dd-panel', ddPanelHtml()); if (ddPanelSel === 'box') ddBoxMount(); }
  // The plunger's rowForm stands in the frame; it shows with its panel only.
  var addRow = ddEl('dd-add-row');
  if (addRow && addRow.style) addRow.style.display = ddPanelSel === 'blocks' ? '' : 'none';
  ddChatSync();
  var err = ddEl('dd-error');
  if (err) err.textContent = ddNote;
  if (ddFacts && typeof ddApi.setScreenTitle === 'function') ddApi.setScreenTitle(ddId + ' — ' + (ddFacts.title || '') + (ddFacts.status ? ' (' + ddFacts.status + ')' : ''));
  ddArming();
}

function ddValue(id) {
  var el = ddEl(id);
  return el ? String(el.value || '').trim() : '';
}
function ddClear(id) { var el = ddEl(id); if (el) el.value = ''; }

// What the server published about this item, painted as it comes. A dropped publish (too large) reads the item again
// (desk/G3.10); a jump in change numbers does not (below).
var ddLastChange = 0;
// Which row a publish is: a side row by its table, item and own key (a check's number, a line's time and writer), a
// List row by its item.
function ddRowKeyOf(obj) {
  if (!obj.table) return 'item|' + String((obj.item && obj.item.id) || '');
  var r = obj.row || {};
  var own = obj.removed ? String(obj.at || '') : obj.table === 'checks' ? String(r.number || '') : obj.table === 'chat' ? String(r.at || '') + '|' + String(r.by || '') : '';
  return obj.table + '|' + String(obj.id || '') + '|' + own;
}
function ddTake(obj) {
  if (!obj) return;
  // AN UPDATE TOO LARGE TO PUBLISH was dropped, and said: reload what is shown.
  if (obj.dropped) { if (ddId) { ddForget(ddId); ddLoad(); } return; }
  var change = Number(obj.change) || 0;
  // AN OLDER UPDATE CHANGES NOTHING (goal/G2.1 note 7): publishes travel as their own requests and can
  // overtake each other; what is shown is never painted over by what came before it.
  var rowKey = ddRowKeyOf(obj);
  if (change && ddRowChange[rowKey] && change < ddRowChange[rowKey]) return;
  if (change) ddRowChange[rowKey] = change;
  if (change > ddLastChange) ddLastChange = change;
  // A JUMP IN CHANGE NUMBERS IS NO GAP (goal/G41.2): the desk numbers every record it writes, published or not (another
  // goal's rows), so the numbers a page hears jump all the time. A real gap in the stream is a
  // reconnect, and the page forgets what it kept then (desk.js deskForgetKept).
  // ONE ROW AT A TIME (goal/G33.4): a side row of an item, {table, id, row}, or its List row, {item: <facts>}.
  if (obj.table) { if (obj.id === ddId && ddTakeRow(obj)) ddPaint(); return; }
  if (!obj.item || obj.item.id !== ddId) return;
  ddFacts = obj.item;
  ddPaint();
}
// A side row of the open item: its box, a chat line, a check. Answers whether anything shown changed.
function ddTakeRow(obj) {
  // A CHANGED BOX: its text and version, shown at once (the box has no fold).
  if (obj.table === 'box') {
    if (!obj.row) return false;
    ddBox = String(obj.row.text || '');
    ddVersion = Number(obj.row.version) || ddVersion;
    ddBoxLoaded = true;
    return true;
  }
  if (obj.table === 'chat' && obj.row && !obj.removed) {
    var at = -1;
    ddChat.forEach(function (l, i) { if (l.at === obj.row.at && l.by === obj.row.by && l.text === obj.row.text) at = i; });
    if (at === -1) ddChat.push(obj.row); else ddChat[at] = obj.row;
    return true;
  }
  if (obj.table === 'checks') {
    var number = obj.removed ? String(obj.at || '') : String((obj.row && obj.row.number) || '');
    var was = -1;
    ddChecks.forEach(function (c, i) { if (c.number === number) was = i; });
    // The panel holds the open and the decided ones, never the answered or cleared (desk.js shownChecks).
    var gone = obj.removed || !obj.row || obj.row.state === 'answered' || obj.row.state === 'cleared';
    if (gone) { if (was !== -1) ddChecks.splice(was, 1); } else if (was === -1) ddChecks.push(obj.row); else ddChecks[was] = obj.row;
    if (gone || (obj.row && obj.row.state !== 'open')) delete ddPending[number];
    return true;
  }
  return false;
}

// EVERY PART THROUGH THE ONE LOADER (goal/G41.11; rule/21, and Andy, of a dropdown: "Sometimes the dropdown does NOT
// appear at ALL!"): spirit.requireScript, never a script tag of its own. It loads a part once and answers once it ran.
function ddNeed(p) {
  var req = typeof window !== 'undefined' && window.spirit && window.spirit.requireScript;
  if (typeof req !== 'function') return Promise.reject(new Error('no spirit.requireScript on this page'));
  return Promise.resolve(req.call(window.spirit, String(p).replace(/^\/+/, '')));
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
// ── INPUTS FOLLOW THE FIELD RULES (rule/12, goal/G10.10) ─────────────
//
//   rule/12: "every input in the shell, system or app level, whose value a field rule governs is marked with that rule
//   (data-field="label", ...) and validated as typed with the same rule the node uses: bytes left shown beside it, its action
//   refused while the rule says no." The rule is the label's type, required here by its full path (goal/G49.13).
// The title and the rename are labels. What is left, or over, shows beside each as it is typed; a value the rule
// refuses is not sent, and the reason is said. The node checks again: this spares the wire, it never replaces that.
var DD_FIELD_ACTION = { 'dd-name': 'dd-name-save' };
function ddFieldRule() { return (typeof window !== 'undefined' && window && window.spirit && ANSWER['spirit/type/string/label/script.js']) || null; }
function ddProblem(T, v) { try { T.isValid(v); return ''; } catch (e) { return (e && e.message) || 'not a label'; } }
function ddBytes(v) { return new TextEncoder().encode(window.spirit.normalizeString(v)).length; }
function ddFieldWhy(id) {
  var rule = ddFieldRule();
  var el = ddEl(id);
  var value = el ? String(el.value || '') : '';
  if (!rule || !value.trim()) return '';
  var problem = ddProblem(rule, value);
  if (!problem) return '';
  var bytes = ddBytes(value);
  return problem + (bytes > rule.MAX_BYTES ? ': ' + (bytes - rule.MAX_BYTES) + ' bytes over, the limit is ' + rule.MAX_BYTES : '');
}
function ddFieldCheck(id) {
  var rule = ddFieldRule();
  var el = ddEl(id);
  var left = ddEl(id + '-left');
  if (!rule || !el || !left) return;
  var bytes = ddBytes(String(el.value || ''));
  var why = ddFieldWhy(id);
  left.textContent = why || (rule.MAX_BYTES - bytes) + ' bytes left';
  left.className = why ? 'job-start-error' : 'job-manifest-note';
  var action = ddEl(DD_FIELD_ACTION[id]);
  if (action) action.disabled = !!why;
}
// HIS BLUR WRITES THE BOX (goal/G9.3): changed, box.write; unchanged, nothing. The version is the one the dialog read,
// so a box that moved under him is refused box-moved rather than overwritten.
function ddBoxFocus() {
  if (ddBoxFocused) return;
  ddBoxFocused = true;
  ddBoxFocusId = ddId;
  ddBoxAtFocus = ddBoxText();
  var id = ddBoxFocusId;
  // THE NEWEST TEXT AS HE GOES IN (goal/G43.3): a write that landed before he went in is not refused box-moved at the
  // end of his typing.
  Promise.resolve().then(function () {
    return ddAsk('item.box', { id: id }).then(function (b) {
      if (ddId !== id || !ddBoxFocused) return;
      ddVersion = Number(b.version) || ddVersion;
      if (ddBoxText() !== ddBoxAtFocus || String(b.box || '') === ddBoxAtFocus) { ddPaint(); return; }
      ddBox = String(b.box || '');
      ddBoxAtFocus = ddBox;
      if (ddBoxView && ddBoxView.id === id) ddBoxView.view.cm.setValue(ddBox);
      else { var el = ddEl('dd-box-input'); if (el) el.value = ddBox; }
      ddPaint();
    });
  }).catch(function () { /* the box stays as it was read */ });
}
function ddBoxBlur() {
  if (!ddBoxFocused) return;
  ddBoxFocused = false;
  var text = ddBoxText();
  var id = ddBoxFocusId || ddId;
  if (text !== ddBoxAtFocus) ddWrite('box.write', { id: id, text: text, version: ddVersion }).then(function () { ddLoad(); });
  else ddPaint();
}
function ddRename() {
  var title = ddValue('dd-name');
  if (!title) return;
  var why = ddFieldWhy('dd-name');
  if (why) { ddNote = 'Not sent: the name: ' + why; ddPaint(); return; }
  ddWrite('item.rename', { id: ddId, title: title }).then(function () { ddRenaming = false; ddPaint(); });
}

// The item as the server has it now: at open, and again after a dropped publish (desk/G3.10).
// EACH PANEL ITS OWN ANSWER. Andy: "lazy load the panels when thy open". The facts first, then the box, the
// checks and the chat, each asked on its own, so no answer carries the sum of them.
// THE ITEM KEPT WHOLE (goal/G33.3). Andy: Desk clients keep what they learned of the current goal "like face-apps do",
// one cache for deskClient and this page: spirit.required.spirit.data (spirit/client/script.js) with the desk's translator
// (the desk family's data.js), which the desk's publishes keep current. An item opened before is shown from it; its panels
// are asked once, when it is first opened, and after a gap.
// Asked of the cache's manager (goal/G41.28): spirit.required.spirit.data['spirit.app.desk'].data answers an item's parts; no branch is named here.
function ddKept() { var s = typeof window !== 'undefined' && window.spirit; return s && keptRows('spirit/app/desk/api.js') && typeof keptRows('spirit/app/desk/api.js').part === 'function' ? keptRows('spirit/app/desk/api.js') : null; }
function ddForget(id) { var K = ddKept(); if (K && id) K.forget(id); }
// How many items of a goal are still open (neither done nor closed), as the page holds their facts.
function ddOpenItems(goalId) {
  var K = ddKept();
  var rows = K && typeof K.items === 'function' ? K.items() || {} : {};
  return Object.keys(rows).filter(function (id) { var r = rows[id]; return r && r.goal === goalId && r.status !== 'done' && r.status !== 'closed'; }).length;
}
// A ROW IS TAKEN FROM THE CACHE WHEN THE CACHE HAS IT (goal/G49.8, point 4; Andy: "a row in a client is always fetched from
// the cache, it the cache already has it"): the desk branch's cache answers a read as the desk would (desk data.js, answer);
// only what it lacks goes to the server.
function ddCached(verb, args) {
  var K = ddKept();
  if (!K) return null;
  // On a page the item's facts the List draws from: item.get as the desk answers it.
  if (verb === 'item.get' && typeof K.item === 'function') {
    var row = K.item(String((args && args.id) || ''));
    // A List row leaves an empty value out (desk server, listRow), so a version of 0 is no field there; the box's own read
    // brings its version (item.box, below).
    if (row && row.id) return { item: JSON.stringify(row), version: Number(row.version) || 0, change: typeof K.change === 'function' ? K.change() : 0 };
  }
  if (typeof K.answer !== 'function') return null;
  try { return K.answer(verb, args, 7865) || null; } catch (e) { return null; }
}
function ddRead(verb, args) {
  var kept = ddCached(verb, args);
  return kept ? Promise.resolve(kept) : ddAsk(verb, args);
}
function ddLoad() {
  var id = ddId;
  return ddRead('item.get', { id: id }).then(function (got) {
    if (ddId !== id) return null;
    try { ddFacts = JSON.parse(got.item); } catch (e) { ddFacts = null; }
    ddVersion = Number(got.version) || 0;
    ddLastChange = Number(got.change) || ddLastChange;
    ddPaint();
    var K = ddKept();
    var whole = K ? K.part(id) : null;
    if (whole && typeof whole.box === 'string' && Array.isArray(whole.checks) && Array.isArray(whole.chat)) {
      ddBox = whole.box; ddVersion = Number(whole.version) || ddVersion; ddBoxLoaded = true;
      ddChecks = whole.checks; ddChat = whole.chat; ddChatMore = !!whole.chatMore;
      ddPaint();
      return null;
    }
    return Promise.all([
      ddAsk('item.box', { id: id }).then(function (b) { if (ddId !== id) return; ddBox = String(b.box || ''); ddVersion = Number(b.version) || ddVersion; ddBoxLoaded = true; ddPaint(); }),
      ddAsk('item.checks', { id: id }).then(function (k) { if (ddId !== id) return; ddChecks = k.checks || []; ddPaint(); }),
      ddAsk('item.chat', { id: id }).then(function (c) { if (ddId !== id) return; ddChat = c.chat || []; ddChatMore = !!c.chatMore; ddPaint(); }),
    ]).then(function () {
      if (K && ddId === id) K.keepPart(id, { box: ddBox, version: ddVersion, checks: ddChecks, chat: ddChat, chatMore: ddChatMore });
    });
  }).then(null, function (e) {
    ddNote = (e && e.refused ? 'Refused: ' : 'The desk server did not answer: ') + e.message;
    ddPaint();
  });
}

// AN ELEMENT OF THE DESK APP (goal/G43.27, requirement 23): spirit.required.spirit.app.desk.element.deskDetails.deskDetails, made in a layer over the Desk page,
// which hands it the page's own way to the node (opts.via: verb, escapeHtml, onPublished, closeDialog, setScreenTitle).
var ddApp = {
  mount: function (container, api) {
    ddApi = api;
    ddRoot = container;
    // Its box keeps what it holds inside (goal/G47.1, the box: "an element container always must constrain its children's
    // display to its own size"; overflow not visible).
    container.innerHTML = '<div id="dd-body" class="fill" style="min-height:0;overflow:auto"></div>';
    ddEl('dd-body').addEventListener('click', function (event) {
      var t = event.target;
      // THE STRIP IS THE workBench's (goal/G41.22): an icon shows its panel through the bench's changed (ddMakeBench).
      var question = t && t.closest ? t.closest('[data-question]') : null;
      if (question) { ddQuote(question.getAttribute('data-question')); return; }
      var check = t && t.getAttribute && t.getAttribute('data-check');
      if (check) { ddWrite('check.set', { id: ddId, check: check, state: 'passed' }); return; }
      // goal/G41.9: an are-you-sure is its armingButton's (ddArming), never this listener's.
      if (t && t.closest && t.closest('[data-arming]')) return;
      var id = t && t.id;
      if (id === 'dd-go' || id === 'dd-done' || id === 'dd-reopen') { ddPress(id.slice(3)); return; }
      // goal/G2.19: Make current goal presses at once, like Go and Reopen; it closes nothing and takes nothing back.
      if (id === 'dd-make-current') { ddPress('make-current'); return; }
      // THE RENAME OPENS HOLDING THE TITLE (goal/G41.11). Andy: "the rename input field on goal/item detail panel MUST
      // contain the current title when it's first displayed." Set once, here; a repaint keeps what he types (ddPaint).
      if (id === 'dd-rename') {
        ddRenaming = true;
        ddPaint();
        var nameBox = ddEl('dd-name');
        if (nameBox) nameBox.value = (ddFacts && ddFacts.title) || '';
        return;
      }
      if (id === 'dd-name-save') { ddRename(); return; }
      if (id === 'dd-say-send') ddSay();
    });
    // EVERY MARKED INPUT, CHECKED AS TYPED (rule/12): one listener on the body, which is repainted.
    ddEl('dd-body').addEventListener('input', function (event) {
      var t = event && event.target;
      if (!t || !t.getAttribute || t.getAttribute('data-field') !== 'label') return;
      if (DD_FIELD_ACTION[t.id]) ddFieldCheck(t.id);
    });
    ddEl('dd-body').addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.repeat && event.target && event.target.id === 'dd-name') {
        event.preventDefault();
        ddRename();
      }
    });
    // THE BOX'S FOCUS AND BLUR (goal/G9.3), on the body because the textarea is repainted: focus does not bubble, so
    // focusin and focusout are what the body hears. Leaving the dialog blurs the box first, which is the release on
    // close - the dialog cannot hear the shell's Back.
    ['focus', 'focusin'].forEach(function (type) {
      ddEl('dd-body').addEventListener(type, function (event) {
        if (event && event.target && event.target.id === 'dd-box-input') ddBoxFocus();
      });
    });
    ['blur', 'focusout'].forEach(function (type) {
      ddEl('dd-body').addEventListener(type, function (event) {
        if (event && event.target && event.target.id === 'dd-box-input') ddBoxBlur();
      });
    });
    // The desk server's changes, which the shell would otherwise hand only to Desk.
    if (api && typeof api.onPublished === 'function') ddRelease = api.onPublished(ddTake, 'desk');
  },

  // Every call: which item this is. Nothing stale from the last one.
  open: function (params) {
    ddId = String((params && params.id) || '');
    // Every item opens on its box (goal/G30.8).
    ddPanelSel = 'box';
    ddFacts = null;
    ddBox = '';
    ddBoxLoaded = false;
    ddBoxView = null;
    ddBoxViewAsked = '';
    ddVersion = 0;
    ddChecks = [];
    ddChat = [];
    ddChatMore = false;
    ddPending = {};
    ddRowChange = {};
    ddRenaming = false;
    ddNote = '';
    ddLastChange = 0;

    ddFrame();
    ddPaint();
    return ddLoad();
  },

  // Destroyed: what it listened to let go, its box emptied.
  destroy: function () {
    if (typeof ddRelease === 'function') ddRelease();
    ddRelease = null;
    if (ddRoot) ddRoot.innerHTML = '';
    ddRoot = null;
  },
};
return ddApp;
}
// What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
module.exports = { create: function (container, opts) {
  // MOUNTED EMPTY, NO THROW (goal/G47.1, the box: "an element that throws when mounted empty is a red at 0.8"): with no
  // page's way to the node (opts.via) or no item, it draws its empty body and opens nothing.
  var o = opts || {};
  var ddApp = ddInstance();
  ddApp.mount(container, o.via || null);
  if (o.via && o.id) ddApp.open(o);
  return { destroy: function () { ddApp.destroy(); } };
} };
}());
}());
