// spirit/run/shell/deskDetails/deskDetails.js
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
// for the server's publish. The order, top to bottom (Andy, desk/G2.7): ID,
// title, status and buttons; the yellow strip; the one box; blocked-by and
// blocking; chat.

var ddApi = null;
var ddId = '';
var ddFacts = null;          // the item's facts, as the server last said them
var ddBox = '';
var ddVersion = 0;
var ddChecks = [];
var ddFiles = [];            // item.files, its own answer since goal/G32.2: core first, as many as fit
var ddFilesMore = false;
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

// The one way to the desk server: its verb by name on the loopback door (desk.<verb>, goal/G30.6).
function ddAsk(verb, args) {
  return Promise.resolve(ddApi.verb('desk.' + verb, args)).then(function (r) {
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

// THE ARE-YOU-SURE IS THE SHELL'S (goal/G41.9; Andy, Q1: "absolutely"): every two-press button here is an armingButton
// (shell/js/armingButton.js), which the dialog loads itself. A button drawn with data-arming="<what it says armed>" is
// made one after each paint; it arms, says so, and hands the shell its disarm, and its second press is ddSecondPress.
var ddParts = Promise.resolve(typeof spirit !== 'undefined' && spirit.require ? spirit.require('shell/js/armingButton.js') : null);
function ddArming() {
  return ddParts.then(function () {
    var A = typeof window !== 'undefined' && window.spirit && window.spirit.elements && window.spirit.elements.armingButton;
    var body = document.getElementById('dd-body');
    if (!A || !body || typeof body.querySelectorAll !== 'function') return;
    Array.prototype.forEach.call(body.querySelectorAll('[data-arming]'), function (b) {
      if (typeof b.armed === 'function') return;
      A.attach(b, { label: b.textContent, armedLabel: b.getAttribute('data-arming'), run: function () { ddSecondPress(b); }, api: ddApi });
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
// have today", "the center panel us the chat", "the right panel, we leave blank, but will carry plugin-desk-apps"). The
// id, title and status stay in the shell's title bar (ddPaint), as before. The left pane and the chat are written in a
// holder first, so the inputs are in the frame from the start; the workBench, once spirit.require brings it, takes them.
// goal/G41.23: its panels' icons stand alone on the bench's strip, which paints them through the icon element; the panel
// loads that element too, as it draws with it (Andy: "this element will replace icons painting all shell elements and
// apps."). The lock before a core file's path is a glyph among words, and stays text.
var ddBenchParts = typeof spirit !== 'undefined' && spirit.require
  ? Promise.all([spirit.require('shell/js/workBench.js'), spirit.require('shell/js/icon.js')])
  : Promise.resolve(null);
var ddBench = null;
var ddBenchBoxes = {};
var ddFrameN = 0;
function ddFrame() {
  var el = document.getElementById('dd-body');
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
      // THE RUN, WHILE THE VERIFIER RUNS THIS ITEM (goal/G33.6): the same rendering as the List's status column.
      '<div id="dd-run"></div>' +
    '</div>' +
    // A waiting icon blinks (goal/G30.8: "the icons on the left will blink if grants, or red Q's need my attention").
    '<style>.dd-blink{animation:ddBlink 1s step-start infinite}@keyframes ddBlink{50%{opacity:.2}}</style>' +
    '<div id="dd-bench" class="fill" style="min-height:0"></div>' +
    '<div id="dd-hold">' +
      // The left pane's content, a box of its own that scrolls (goal/G41.11: a long list is never cut off unseen).
      // The left pane's content: its rows on top, the panel taking the rest (each panel scrolls in itself, ddPanelHtml).
      '<div id="dd-left" class="fill" style="min-height:0;overflow:hidden">' +
        // ATTACH A RULE, ON TOP OF THE RULES (goal/G41.11; Andy: "the add-rule dropdown is at the bottom of a (sometimes
        // LONG) list, and it must be on top"): a probability search of the rules as a dropdown; a pick attaches it. In
        // the frame, so the search survives every repaint; it shows with the rules panel only.
        '<div class="start-job-form card" id="dd-rule-add-row" style="display:none"><div id="dd-rule-pick" style="flex:1"></div></div>' +
        '<div id="dd-panel" class="fill" style="min-height:0"></div>' +
    // ADD BLOCKING ITEM (goal/G9.10). Andy, 2026-10-07: "there will be a new section bubble, immediately following the
    // \"Blocked by/Blocking\" section, and right before the users chat input... \"Title\" [Title String, subject to
    // label rules] [add-button]. When the user presses the [add-button], The desk will add a blocking item with the
    // entered title and a blank text box. The blocked-by section will be updated immediately." It lives in the frame,
    // so what he has typed survives every repaint, as the chat input does.
    '<div class="start-job-form card" id="dd-add-row"><label class="field-label grow">Title' +
      '<input type="text" id="dd-add-title" data-field="label" placeholder="an item this one waits on"></label>' +
      '<span class="job-manifest-note" id="dd-add-title-left"></span>' +
      '<button type="button" id="dd-add">Add blocking item</button></div>' +
      '</div>' +
      // THE CENTRE IS THE CHAT (goal/G41.22; Andy: "the chat has it's search at the top and it's input at the bottom, and
      // scolls upward, not downward", "newest lines at the bottom, pinned to the bottom, and older lines above").
      '<div id="dd-centre" class="fill" style="min-height:0">' +
        // THE CHAT SEARCH (goal/G18.5, G40.12): the probability search over chat.search, a dropdown; a line said in
        // another item opens that item. In the frame, so it survives every repaint.
        '<div class="start-job-form card" style="flex:none"><div id="dd-chat-find" style="flex:1"></div></div>' +
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
}
// The left pane shows today's panel of the tool shown; the strip's tool is the panel's key (DD_PANELS).
function ddShowLeft(name) {
  var left = document.getElementById('dd-left');
  var box = ddBenchBoxes[name];
  if (left && box && left.parentNode !== box) box.appendChild(left);
}
function ddMakeBench(n) {
  var W = window.spirit && window.spirit.elements && window.spirit.elements.workBench;
  var host = document.getElementById('dd-bench');
  var hold = document.getElementById('dd-hold');
  var centre = document.getElementById('dd-centre');
  if (n !== ddFrameN || !W || typeof W.create !== 'function' || !host || !centre) return;
  ddBench = W.create(host, {
    left: DD_PANELS.map(function (p) {
      // workBench says changed before it makes a tool's box, so the first show of a tool moves the panel here, once its
      // box is there (Andy: "i want to see the panel content THE FIRST TIME i pop in a panel, NOT the second time").
      return { name: p.key, icon: p.icon, title: p.title, mount: function (box) { ddBenchBoxes[p.key] = box; if (ddPanelSel === p.key) ddShowLeft(p.key); } };
    }),
    // goal/G41.22: blank until a desk plugin app gives it a tool.
    right: [],
    changed: function (side, name) {
      if (side !== 'left' || !name) return;
      ddShowLeft(name);
      if (name === ddPanelSel) return;
      ddPanelSel = name;
      ddPaint();
      if (name === 'blocks') ddLoadTargets();
      if (name === 'suites') ddLoadSuites(ddId);
      if (name === 'rules') { ddLoadRuleNames(); ddMountRulePick(); }
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
// goal/G41.2: Start design too, which the desk offers on any item since goal/G40.12 ("You can turn design on for an item
// at any time"); a press missing here was dropped from the dialog unseen.
// goal/G41.22: push Goal, on the current goal and its items as the desk offers it; its press is the verb pushgoal.
var DD_LABELS = { 'start-design': 'Start design', 'end-design': 'End design', go: 'Go!', done: 'Done', close: 'Close', reopen: 'Reopen', pushgoal: 'push Goal' };

// THE VERIFIER'S RUN OF THIS ITEM (goal/G33.6), as the List's status column shows it: the desk's fact (verifyRunning)
// joined with deskVerify's own publish (ddRun), through the one shared rendering (shell/shared/js/deskRunStatus.js).
var ddRun = null;
var DD_RUN_STATUS = '/shell/shared/js/deskRunStatus.js';
function ddRunHtml() {
  var els = typeof window !== 'undefined' && window.spirit && window.spirit.elements;
  return els && typeof els.deskRunStatus === 'function' ? els.deskRunStatus(ddFacts || {}, ddRun, ddEsc) : '';
}
function ddHearVerifier(obj) {
  if (!obj || typeof obj !== 'object' || typeof obj.doing !== 'string') return;
  ddRun = obj;
  ddSet('dd-run', ddRunHtml());
}
function ddLoadRunStatus() {
  var have = typeof window !== 'undefined' && window.spirit && window.spirit.elements && window.spirit.elements.deskRunStatus;
  if (typeof have === 'function') return;
  ddNeed(DD_RUN_STATUS).then(function () { ddSet('dd-run', ddRunHtml()); }, function () { /* the run is not drawn */ });
}

// DONE, NOT VERIFIED GREEN, CARRIES A WARNING MARK AND ARMS HERE (goal/G33.3). The box: "not verified (its suites red,
// or no run of them yet), the Done button carries a warning mark and re-arms in the page: the first press arms it and
// says why, the second sends Done ... Verified green, one press does it. The desk keeps no arming." The facts say it
// (verified, verifyFailures); '' where no deskVerify answers, and then nothing is marked.
var DD_WARN = '\u26a0';
function ddDoneWarned(f) { return f.verified === 'red' || f.verified === 'none'; }
function ddDoneWhy(f) {
  return f.verified === 'red' ? 'Not verified: its suites are red: ' + (f.verifyFailures || []).join(' | ')
    : 'Not verified: there is no run of its suites yet. Press Done again to send it anyway.';
}
// HIS VERIFY (goal/G33.3), right next to Done (the box: "A Verify button on the item, right next to its Done button").
// It is never disabled: the desk asks the verifier anyway. On a goal it runs the goal's suites. It shows no busy state
// (goal/G33.6, Andy: "please don't show verifier-busy an any verify button, i can check that for myself").
function ddVerifyHtml(f) {
  return '<button type="button" id="dd-verify" title="hand this to the verifier">Verify</button>';
}


// CLOSE BEFORE HIS GO IS ARMED, AT THE RIGHT EDGE (goal/G3.9). Andy, 2026-10-03: "A close - with arm-button is
// available on the right edge of the button bar, before an item has received a 'go' or a 'done'", "the close-with
// arm is only visible on the item detail". On a done item Close presses at once, as desk/G3.8 built it.
function ddEarlyClose(f) { return f.status !== 'done' && f.status !== 'closed' && (f.buttons || []).indexOf('close') !== -1; }
function ddButtonsHtml() {
  var f = ddFacts || {};
  var early = ddEarlyClose(f);
  var verifyDrawn = false;
  var html = (f.buttons || []).filter(function (b) { return DD_LABELS[b] && !(early && b === 'close'); }).map(function (b) {
    // DONE (n) (goal/G4.20 point 3). Andy: "when the done button appears it also shows number of claims [Done (2)]".
    var label = b === 'done' && Number(f.claims) > 0 ? 'Done (' + Number(f.claims) + ')' : DD_LABELS[b];
    // START AND END DESIGN ASK ARE-YOU-SURE (goal/G41.11). Andy: "the start-design and end-design buttons in an item
    // must ask: are-you-sure". Armed like Waive (ddArming); the second press is ddSecondPress's.
    var design = b === 'start-design' || b === 'end-design';
    if (b !== 'done') return '<button type="button" id="dd-' + b + '"' + (design ? ' data-arming="' + label + ': sure?"' : '') + '>' + label + '</button>';
    var warned = ddDoneWarned(f);
    var done = '<button type="button" id="dd-done"' + (warned ? ' data-arming="Done anyway: sure?" title="' + ddEsc(ddDoneWhy(f)) + '"' : '') + '>' +
      label + (warned ? ' ' + DD_WARN : '') + '</button>';
    if ((f.buttons || []).indexOf('verify') === -1) return done;
    verifyDrawn = true;
    return done + ddVerifyHtml(f);
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
  // WAIVE (goal/G2.22). Andy: "there is no Waive in the G2.18 dialog" — the server has had the press since
  // goal/G5.7 and never had a button. Armed like Go all: the first click arms, the second lifts the phase rules on
  // this item, so one agent can carry it from red to verify.
  if ((f.buttons || []).indexOf('waive') !== -1) {
    html += '<button type="button" id="dd-waive" data-arming="Waive: sure?">Waive</button>';
  }
  // DELETE (goal/G9.7). Andy: "the button bar of items will offer an arm-able [delete] while in design mode." The
  // server offers it only then (buttons), so the bar draws it from the facts and arms like Waive: the first click arms,
  // the second deletes. His decision that it closes rather than erases is the server's (goal/G9.7, goal/G4.24).
  if ((f.buttons || []).indexOf('delete') !== -1) {
    html += '<button type="button" id="dd-delete" data-arming="Delete: sure?">Delete</button>';
  }
  // CODE ✓ (goal/G9.5). Andy: "the item Detail dialog has a check/toggle button, [Code✓], in it's button bar, where the
  // user can set the Code-state of an item". Items only: a goal has no code state, and the server refuses a sub-goal.
  // NOT WHERE IT IS NOT OFFERED (goal/G27.3). Andy, 2026-10-17: "The code button should not be available in vision
  // items." The server says so in the facts (codeOffered false where the item's plugin refuses the code press).
  if (f.goal !== '' && f.codeOffered !== false) {
    html += '<button type="button" id="dd-code">Code' + (f.code ? ' ✓' : '') + '</button>';
  }
  // MAKE CURRENT (goal/G2.19). Andy: "on any open goal i want a button \"make current goal\"". The server offers it on
  // an open goal that is not current; it presses at once, since switching goals undoes nothing.
  if ((f.buttons || []).indexOf('make-current') !== -1) {
    html += '<button type="button" id="dd-make-current">Make current goal</button>';
  }
  // VERIFY WHERE NO DONE IS SHOWN (a goal before its items are done): at the end of the row.
  if (!verifyDrawn && (f.buttons || []).indexOf('verify') !== -1) html += ddVerifyHtml(f);
  if (f.goal === '') {
    html += '<button type="button" id="dd-abandon" data-arming="Sure? Abandon the goal"' +
      ' style="margin-left:auto;background:#b00020;color:#fff">Abandon</button>';
  }
  if (early) {
    // goal/G6.6: a goal's Close asks "are you sure? N open" while any of its items is open; nothing open presses at
    // once. On a non-goal item (an open code item) the "Close: sure?" arm stands (desk/G3.9).
    var goalOpen = f.goal === '' && (f.blocked || []).length;
    var asks = f.goal !== '' || goalOpen > 0;
    html += '<button type="button" id="dd-close"' +
      (asks ? ' data-arming="' + (goalOpen ? 'are you sure? ' + goalOpen + ' open' : 'Close: sure?') + '"' : '') +
      ' style="margin-left:auto">Close</button>';
  }
  return html;
}

// THE YELLOW STRIP IS "HOW YOU CHECK IT", offered only while Done is (Andy:
// "the yellow box should only be offered when the agents claim 'done'"). Each
// C check is pressed to tick it; "it inspires diligence".
// THE STRIP AND ITS PANELS (goal/G30.8). Andy, 2026-10-20: "when i click on the box icon the box appears in the upper
// panel", "click on red Q's icon, it's the red Q's in the upper half", "click on the files icon, it'll be the file list and
// grants", "one for the blocks", and "the icons on the left will blink if grants, or red Q's need my attention, i won't
// have to scroll around, and dialog elements can lazy-load". The box shows on open; the blocks ask block.targets when
// their icon is pressed. A blinking icon (dd-blink) is read from the checks: an open red Q, an open grant.
var ddPanelSel = 'box';
var DD_PANELS = [
  { key: 'box', icon: '📃', title: 'the box' },
  // goal/G33.11: the suites attached to the item, read only, informational for now.
  { key: 'suites', icon: '☑️', title: 'the suites attached to this item' },
  { key: 'qs', icon: '❌', title: 'red Qs and checks' },
  { key: 'blocks', icon: '🪠', title: 'blocks' },
  { key: 'files', icon: '📂', title: 'files and grants' },
  // goal/G40.12, second set 2: "the icons strip to the left of a goal has an icon for the list of attached rules".
  { key: 'rules', icon: '📖', title: 'the rules attached' },
];
function ddWaits(kind) { return ddChecks.some(function (c) { return c.kind === kind && c.state === 'open'; }); }
// The workBench draws the strip and marks the shown tool (goal/G41.22); a waiting icon on it blinks.
function ddBlinkIcons() {
  var body = document.getElementById('dd-body');
  if (!body || typeof body.querySelectorAll !== 'function') return;
  var blink = { qs: ddWaits('Q'), files: ddWaits('G') };
  Array.prototype.forEach.call(body.querySelectorAll('[data-side="left"][data-tool]'), function (b) {
    var on = !!blink[b.getAttribute('data-tool')];
    if (b.classList) b.classList.toggle('dd-blink', on);
  });
}
// The red Qs open on this item, each with his remove (his clear, "Q1: clear", desk clearOf), and the checks (C) to press.
function ddQsHtml() {
  var qs = ddChecks.filter(function (c) { return c.kind === 'Q' && c.state === 'open'; }).map(function (c) {
    return '<div><span data-question="' + ddEsc(c.number) + '" style="color:#d00;cursor:pointer" title="answer it below">' + ddEsc(c.number) + ': ' + ddEsc(c.words) + '</span> ' +
      // THE REMOVE ASKS ARE-YOU-SURE (goal/G41.11). Andy: "the remove button for red Q's must ask: are-you-sure?".
      '<button type="button" data-qclear="' + ddEsc(c.number) + '" data-arming="Remove: sure?" title="remove this red Q">remove</button></div>';
  }).join('');
  var cs = ddChecks.filter(function (c) { return c.kind === 'C'; }).map(function (c) {
    var done = c.state === 'passed';
    return '<div><button type="button" data-check="' + ddEsc(c.number) + '"' + (done ? ' disabled' : '') + '>' + (done ? '✓ ' : '') + ddEsc(c.number) + '</button> ' + ddEsc(c.words) + '</div>';
  }).join('');
  return (qs || '<div class="job-manifest-note">No red Q is open.</div>') + cs;
}
// The grants: the open ones as his armed buttons, FIRST, above the files they cover (goal/G33.8, box v10, Andy: "the red
// grant buttons are still at the bottom of the file list"), and the given ones in green under the files. open says which.
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
  if (ddPanelSel === 'qs') return ddScrolls(ddQsHtml());
  if (ddPanelSel === 'blocks') return ddScrolls(ddLinksHtml() || '<div class="job-manifest-note">A goal blocks nothing.</div>');
  if (ddPanelSel === 'suites') return ddScrolls(ddSuitesHtml());
  if (ddPanelSel === 'rules') return ddScrolls(ddRulesHtml());
  // Andy: "the file panel must have the red gran button row pinned to the top and the file list only using the
  // remaining vertical space".
  if (ddPanelSel === 'files') return '<div style="flex:none">' + ddGrantsHtml(true) + '</div>' +
    ddScrolls((ddFilesHtml() || '<div class="job-manifest-note">No files touched yet.</div>') + ddGrantsHtml(false));
  return ddBoxHtml();
}

// THE ONE BOX. An item with no text yet says so; an agent writes it.
// NO FOLD ANY MORE (goal/G30.8; Andy, 2026-10-20: "the box no longer needs to be foldable, it is now space-limited and
// contained"): the textarea fills the upper half's panel and scrolls inside it. The fold (goal/G2.1, G9.17) stood here.
// HIS TAKE OF THE BOX (goal/G9.3): on while he is in the textarea, with the text as it stood when he went in, so a
// blur that changed nothing releases instead of writing. Focus and blur arrive more than once (the element, the body),
// so the flag is what keeps one take and one release.
var ddBoxFocused = false;
// THE ITEM THE BOX WAS FOCUSED ON (goal/G19.5): the blur writes there, whatever item is open by then. Andy: "yes." to
// "the dialog box write only to the item it was opened for".
var ddBoxFocusId = '';
var ddBoxAtFocus = '';
var ddBoxLoaded = false;  // true once item.box has answered for the open item (goal/G9.15)
function ddBoxHtml() {
  // A TAKEN BOX IS RED (goal/G4.20 point 9). Andy: "anybody that takes somethings that affects the box, and the box
  // is red. cap also." Red until the taker writes it; the taker's name is on it.
  var taker = ddFacts && ddFacts.boxTaken ? ddName(String(ddFacts.boxTaken)) : '';
  var taken = taker ? ' data-taken="' + ddEsc(taker) + '" title="' + ddEsc(taker) + ' is changing this box"' : '';
  // ALWAYS AN INPUT (goal/G9.15). Andy, 2026-10-09: "a goal or item box is always visible and ready to edit by user or
  // agents." An empty box is the same textarea, so the first text of a goal or item he just made can be his; only
  // while the box has not yet come back from the server is there nothing to edit, or his typing could overwrite a
  // text he has not seen.
  if (!ddBoxLoaded) return '<div class="job-manifest-note"' + taken + '>Reading the box.</div>';
  // THE BOX CAP, SEEN (goal/G2.2 note 1). Andy: "orange at 50%, red at 75%" — the server says half and full; the
  // border is the only automatic part, the split into items is negotiated ("never automated").
  var cap = taker || (ddFacts && ddFacts.full) ? 'border:2px solid red;padding:4px;' : ddFacts && ddFacts.half ? 'border:2px solid orange;padding:4px;' : '';
  // HIS INPUT AREA (goal/G9.3). Andy, 2026-10-07: "the text box in item/goal detail must be an input area for the
  // user. When the user activates that input area, the area is \"taken\" by the user, and not modifiable for agents.
  // When the user clicks outside of that text box, and deactivates the input, also by leaving the details dialog, the
  // box input is released from the take. When a details dialog is opened, the text box is never taken."
  // So the box is a textarea holding the whole text, as tall as its panel; the take happens on focus, never on open. It is never repainted while he has it (ddPaint), so his typing cannot be wiped.
  // THE FULL HEIGHT OF ITS PANE (goal/G41.22; Andy: "the box must use the full vertical space"): the old upper half's
  // 30% is gone with the half itself.
  return '<div' + taken + ' class="fill" style="' + cap + 'min-height:0;box-sizing:border-box">' +
    '<textarea id="dd-box-input" style="flex:1 1 auto;min-height:0;width:100%;box-sizing:border-box;white-space:pre-wrap;resize:none;overflow-y:auto">' + ddEsc(ddBox) + '</textarea></div>';
}

// WHAT WAITS ON HIM, UNDER THE BOX (goal/G4.20 points 10-11). Andy: "the Grants are red arm-buttons that turn green
// and are logged, and questions are red-text that disappears when you feel i answered usefully." An open grant arms
// on the first click and is granted on the second; a granted one stays, green. An open question shows its number and
// words ("the questions number and the text (for me)"); a click puts "Q1: <words>" in his input; the agent marks it
// answered and it goes.
// ddWaitingHtml STOOD HERE: the open grants and red Qs under the box. They are the files panel's and the red Qs' panel's
// now (goal/G30.8).
// A question clicked goes into his input as a line of its own, followed by two newlines (goal/G21.2). Andy, in the
// item's box: "A red Q clicked into Andy's chat box arrives followed by two newlines, so the question stands apart from
// the answer he writes below it."
function ddQuote(number) {
  var c = ddChecks.filter(function (x) { return x.number === number; })[0];
  var say = document.getElementById('dd-say');
  if (!c || !say) return;
  var had = String(say.value || '');
  say.value = (had && !/\n$/.test(had) ? had + '\n' : had) + c.number + ': ' + c.words + '\n\n';
  if (typeof say.focus === 'function') say.focus();
}

// Each id a way there (Andy: "the blocked and blocks lists link to the respective items").
// THE BLOCK BUBBLE (goal/G27.5, R7). Andy, 2026-10-17: "the UI should offer only blocking relation ships per item for add
// or delete, the blocked-by section would be implicit, a drop-down for Adding blockages that only offers valid items",
// and of the delete: "i agree" to: one on each block the item states, none on the goal fallback. Foldable. The
// drop-down holds what the desk's block.targets answered: only what block would take.
var ddBlockTargets = [];
var ddBlocksFolded = false;
function ddLoadTargets() {
  var id = ddId;
  if (!id) return Promise.resolve();
  return ddAsk('block.targets', { id: id }).then(function (r) {
    if (ddId !== id) return;
    ddBlockTargets = Array.isArray(r && r.items) ? r.items : [];
    ddPaint();
  }, function () { ddBlockTargets = []; });
}
function ddLinksHtml() {
  var f = ddFacts || {};
  if (!f.id || f.goal === '') return '';
  var line = function (id) { return '<a href="#" data-open="' + ddEsc(id) + '" style="color:#cfe2ff">' + ddEsc(id) + '</a>'; };
  var by = (f.blocked || []).map(line).join(', ');
  var states = (f.blocking || []).filter(function (x) { return x !== f.goal; });
  var blocking = states.length
    ? states.map(function (x) { return line(x) + ' <button type="button" data-unblock="' + ddEsc(x) + '" title="unblock">✕</button>'; }).join(', ')
    // goal/G33.8 (box v12): never a link to its own goal; that it blocks its goal goes without saying.
    : '';
  var toggle = '<button type="button" data-fold="blocks" title="' + (ddBlocksFolded ? 'Unfold' : 'Fold') + '">' + (ddBlocksFolded ? '▸' : '▾') + '</button> ';
  if (ddBlocksFolded) return '<div class="stat-tile wide">' + toggle + '<span class="label">Blocks</span></div>';
  var add = '<div class="start-job-form"><label class="field-label grow">Also blocks<select id="dd-block-add">' +
    (ddBlockTargets.length ? ddBlockTargets.map(function (p) { return '<option value="' + ddEsc(p.key) + '">' + ddEsc(p.key) + ' ' + ddEsc(p.label) + '</option>'; }).join('') : '<option value="">nothing it could block</option>') +
    '</select></label><button type="button" id="dd-block-go"' + (ddBlockTargets.length ? '' : ' disabled') + '>Add block</button></div>';
  return '<div class="stat-tile wide">' + toggle + '<span class="label">Blocks</span>' +
    (by ? '<div><span class="label">Blocked by</span> ' + by + '</div>' : '') +
    (blocking ? '<div><span class="label">Blocking</span> ' + blocking + '</div>' : '') + add + '</div>';
}

// THE FILES TOUCHED (goal/G8.8). Andy, 2026-10-09: "that file list should be visible in desk ui per item, core files
// market as requiring grants." One line per path with the agent that wrote it; a core path is marked data-core="1"
// and says it needs his grant. The server decides which is core (js/coreFiles.js), never this page.
function ddFilesHtml() {
  var files = ddFiles;
  if (!files.length) return '';
  return '<div class="stat-tile wide"><div class="label">Files touched</div>' + files.map(function (e) {
    var core = e && e.core === true;
    return '<div data-file="' + ddEsc(e.path) + '"' + (core ? ' data-core="1" title="a core file: it needs your grant"' : '') + '>' +
      (core ? '🔒 ' : '') + ddEsc(e.path) + ' <span class="job-manifest-note">(' + ddEsc(e.by ? ddName(e.by) : '') + ')</span></div>';
  }).join('') + (ddFilesMore ? '<div class="job-manifest-note">' + ddEsc(String((ddFacts && ddFacts.fileCount) || '')) + ' files in all; the core ones are shown first.</div>' : '') + '</div>';
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
// vertically be 1em space." Same shape as desk.js' deskGroupChat (goal/G6.2): change both or neither.
function ddBubble(l) {
  var his = l.by === 'andy';
  var look = his
    ? ' style="margin:1em 0;padding:6px 10px;background:#000;color:#fff;border-radius:var(--spirit-radius,8px)"'
    : ' style="margin:1em 0;padding:6px 10px;background:rgba(255,255,255,0.08);border-radius:var(--spirit-radius,8px)"';
  // goal/G21.1: the writer's name, looked up by the desk from the line's key; its label where none is set.
  return '<div' + look + '><b>' + ddEsc(his ? 'you' : (l.name || l.by)) + '</b> <span class="job-manifest-note">' + ddTime(l.at) + '</span> ' +
    ddLineHtml(l.text) + '</div>';
}
// AN AGENT BY ITS NAME (goal/G21.1). Andy: "The page shows the agent's name everywhere it shows the agent ... the node's
// label is shown only when no name is set. Keys are never shown on the page." The item's facts carry names, label to
// name, looked up by key at the desk; the label where none is set.
function ddName(label) {
  var names = ddFacts && ddFacts.names ? ddFacts.names : {};
  return names[label] || label;
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
  var host = document.getElementById('dd-chat');
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

function ddSet(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; }

// Repaints every part between the inputs; a name he is typing survives it.
function ddPaint() {
  var typed = ddRenaming ? ddValue('dd-name') : '';
  ddSet('dd-name-row', ddButtonsHtml());
  ddSet('dd-run', ddRunHtml());
  var box = ddRenaming && typed && document.getElementById('dd-name');
  if (box) box.value = typed;
  ddBlinkIcons();
  // The chat search stands in the frame; it is made once the frame is drawn (ddMountChatFind), never again by a paint.
  if (!ddChatFind || ddChatFindHost !== document.getElementById('dd-chat-find')) ddMountChatFind();
  // NOT WHILE HE IS IN THE BOX (goal/G9.3): a repaint would throw away what he has typed, and he holds the take anyway.
  if (!(ddPanelSel === 'box' && ddBoxFocused)) ddSet('dd-panel', ddPanelHtml());
  // The add-blocking form stands in the frame, so what he types survives; it shows with the blocks panel only.
  var addRow = document.getElementById('dd-add-row');
  if (addRow && addRow.style) addRow.style.display = ddPanelSel === 'blocks' ? '' : 'none';
  var ruleRow = document.getElementById('dd-rule-add-row');
  if (ruleRow && ruleRow.style) ruleRow.style.display = ddPanelSel === 'rules' ? '' : 'none';
  // Whenever the rules panel shows, its dropdown is there: made for this frame if it has none yet.
  if (ddPanelSel === 'rules') ddMountRulePick();
  ddChatSync();
  var err = document.getElementById('dd-error');
  if (err) err.textContent = ddNote;
  if (ddFacts && typeof ddApi.setScreenTitle === 'function') ddApi.setScreenTitle(ddId + ' — ' + (ddFacts.title || '') + (ddFacts.status ? ' (' + ddFacts.status + ')' : ''));
  ddArming();
}

function ddValue(id) {
  var el = document.getElementById(id);
  return el ? String(el.value || '').trim() : '';
}
function ddClear(id) { var el = document.getElementById(id); if (el) el.value = ''; }

// What the server published about this item, painted as it comes.
// A change number that skips one means a publish went by unseen (desk/G3.10): the dialog asks item.get once.
var ddLastChange = 0;
// Which row a publish is: a side row by its table, item and own key (a check's number, a line's time and writer, a
// file's holder and path), a List row by its item.
function ddRowKeyOf(obj) {
  if (!obj.table) return 'item|' + String((obj.item && obj.item.id) || '');
  var r = obj.row || {};
  var own = obj.removed ? String(obj.at || '') : obj.table === 'checks' ? String(r.number || '') : obj.table === 'chat' ? String(r.at || '') + '|' + String(r.by || '')
    : obj.table === 'files' ? String(r.by || '') + '|' + String(r.path || '') : obj.table === 'claims' ? String(r.by || '') : obj.table === 'suites' ? String(r.path || '') : '';
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
  // A JUMP IN CHANGE NUMBERS IS NO GAP (goal/G41.2): the desk numbers every record it writes, published or not (a take,
  // an agent's state, another goal's rows), so the numbers a page hears jump all the time. Reading the open item again
  // on each jump re-asked the desk four times per row. A real gap in the stream is a reconnect, and the page forgets
  // what it kept then (desk.js deskForgetKept).
  // ONE ROW AT A TIME (goal/G33.4): a side row of an item, {table, id, row}, or its List row, {item: <facts>}.
  if (obj.table) { if (obj.id === ddId && ddTakeRow(obj)) ddPaint(); return; }
  if (!obj.item || obj.item.id !== ddId) return;
  ddFacts = obj.item;
  ddPaint();
}
// A side row of the open item: its box, a chat line, a check, a changed file list. Answers whether anything shown
// changed.
function ddTakeRow(obj) {
  // A CHANGED BOX UNFOLDS (slim/G1.6 D6: "a changed block opens; his fold is his ack"): an agent's write while
  // his dialog is open must not hide behind his fold; he folds it again when he has read it.
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
  // One write's file rows ask the list once.
  if (obj.table === 'files') { if (ddFilesAt !== obj.change) { ddFilesAt = obj.change; ddLoadFiles(ddId); } return false; }
  return false;
}
var ddFilesAt = -1;

// THE SUITES PANEL (goal/G33.11; Andy, in the box: "An icon left of the box opens the list of suites attached to the
// item, read only, informational for now."): item.suites.search, asked each time the icon is pressed.
var ddSuites = null;
var ddSuitesMore = false;
function ddLoadSuites(id) {
  return ddAsk('item.suites.search', { id: id, text: '' }).then(function (r) {
    if (ddId !== id) return;
    ddSuites = (r.items || []).map(function (p) { try { return JSON.parse(p.label).path; } catch (e) { return String(p.key); } });
    ddSuitesMore = !!r.more;
    ddPaint();
  }, function () { ddSuites = []; ddSuitesMore = false; ddPaint(); });
}
// THE RULES PANEL (goal/G40.12, second set 1-3): the rules attached to this goal or item, each named and with its
// delete (item.rules.remove), read from the facts; their names from the rules search, asked when the icon is pressed. The
// add is the dropdown in the frame (dd-rule-pick), a probability search of rules.search; a pick is item.rules.add.
var ddRuleNames = Object.create(null);
var DD_SEARCH = 'shell/js/probabilitySearch.js';
var ddRulePick = null;
var ddRulePickHost = null;   // the box the dropdown was made in: a frame drawn again is a new box, so a new dropdown
// The rule types, as the desk server's RULE_TYPES (goal/G40.12 added test).
var DD_RULE_TYPES = ['ui', 'code', 'design', 'desk', 'test'];
// EVERY PART THROUGH THE ONE LOADER (goal/G41.11; rule/21, and Andy, of the add-rule dropdown: "Sometimes the dropdown
// does NOT appear at ALL!"): spirit.require, never a script tag of its own. It loads a part once and answers once it ran.
function ddNeed(p) {
  var req = typeof window !== 'undefined' && window.spirit && window.spirit.require;
  if (typeof req !== 'function') return Promise.reject(new Error('no spirit.require on this page'));
  return Promise.resolve(req.call(window.spirit, String(p).replace(/^\/+/, '')));
}
function ddLoadRuleNames() {
  return ddAsk('rules.search', { text: '', types: [], statuses: [] }).then(function (r) {
    (r.items || []).forEach(function (i) { try { var l = JSON.parse(i.label); ddRuleNames[i.key] = l.label + ' (' + l.type + ')'; } catch (e) { /* named by its key */ } });
    ddPaint();
  }, function () { /* the keys stand for the names */ });
}
function ddRulesHtml() {
  var rules = (ddFacts && Array.isArray(ddFacts.rules)) ? ddFacts.rules : [];
  if (!rules.length) return '<div class="job-manifest-note">No rule is attached here.</div>';
  return rules.map(function (r) {
    var key = String((r && r.key) || r);
    return '<div>' + ddEsc(key) + ' ' + ddEsc(ddRuleNames[key] || '') + ' <button type="button" data-rule-remove="' + ddEsc(key) + '" title="take this rule off">delete</button></div>';
  }).join('') + (ddFacts && ddFacts.rulesMore ? '<div class="job-manifest-note">More rules than shown.</div>' : '');
}
// MADE EVERY TIME THE RULES PANEL SHOWS IN A FRAME THAT HAS NONE (goal/G41.11): the dropdown made for an earlier frame is
// no dropdown in this one, so a new frame gets its own.
function ddMountRulePick() {
  var el = document.getElementById('dd-rule-pick');
  if (!el) return;
  if (ddRulePick && ddRulePickHost === el) return;
  if (ddRulePick && typeof ddRulePick.destroy === 'function') ddRulePick.destroy();
  ddRulePick = null;
  ddRulePickHost = el;
  var make = function () {
    var P = window.spirit && window.spirit.elements && window.spirit.elements.probabilitySearch;
    if (!P || typeof P.create !== 'function' || ddRulePickHost !== el || ddRulePick) return;
    ddRulePick = P.create(el, {
      api: ddApi, server: 'desk', verb: 'rules.search',
      // A TYPE FILTER BESIDE THE WORDS, as the Rules list has (Andy: "where are my type filters, when i search for rules
      // to attach to a goal or item?"). Active rules only: a proposed rule is not yet a rule to attach.
      // THE SAME TOGGLES AS ON THE RULES LIST (Andy, quoting: "the type toggles (ui, code, design, desk, test) beside the
      // dropdown, sent as its types filter, the same toggles as on the Rules list"): a button per type, each on until
      // pressed off (the multi filter keeps the ones pressed off); all on asks every type.
      args: function (text, values) {
        var off = (values || {}).type || {};
        var on = DD_RULE_TYPES.filter(function (t) { return !off[t]; });
        return { text: text, types: on.length === DD_RULE_TYPES.length ? [] : on, statuses: ['active'] };
      },
      filters: [{ name: 'type', multi: true, choices: DD_RULE_TYPES.map(function (t) { return { value: t, word: t }; }),
        test: function (row, off) { return (off || {})[row.type] ? 0 : 1; } }],
      columns: [{ field: 'label', label: 'Rule', sort: 'text' }, { field: 'type', label: 'Type', sort: 'text' }],
      face: 'dropdown', placeholder: 'attach a rule…',
      matched: function (row) { return { label: String((row && row.label) || '') }; },
      pick: function (row, key) { if (key) ddWrite('item.rules.add', { id: ddId, rule: String(key) }); },
      empty: 'No rule matches.',
    });
    ddRulePick.refresh();
  };
  if (window.spirit && window.spirit.elements && window.spirit.elements.probabilitySearch) { make(); return; }
  ddNeed(DD_SEARCH).then(make, function () { el.textContent = 'The search could not be loaded.'; });
}
function ddSuitesHtml() {
  if (ddSuites === null) return '<div class="job-manifest-note">Reading the suites.</div>';
  if (!ddSuites.length) return '<div class="job-manifest-note">No suite is attached to this item.</div>';
  return ddSuites.map(function (p) { return '<div>' + ddEsc(p) + '</div>'; }).join('') +
    (ddSuitesMore ? '<div class="job-manifest-note">More suites than shown.</div>' : '');
}

// The files panel's list, asked on its own (goal/G32.2), and again when a write changed it.
function ddLoadFiles(id) {
  return ddAsk('item.files', { id: id }).then(function (f) { if (ddId !== id) return; ddFiles = f.files || []; ddFilesMore = !!f.filesMore; ddPaint(); }, function () { /* the panel says no files */ });
}

// THE CHAT SEARCH (goal/G18.5, on the probability search since goal/G40.12): chat.search for the item on screen; on a
// goal (goal/G29.21) the scope is items, the goal's chat and its items' chats ranked together.
var ddChatFind = null;
var ddChatFindHost = null;   // as the rule dropdown: a frame drawn again is a new box, so it gets its own search
function ddMountChatFind() {
  var el = document.getElementById('dd-chat-find');
  if (!el) return;
  if (ddChatFind && ddChatFindHost === el) { ddChatFind.refresh(); return; }
  if (ddChatFind && typeof ddChatFind.destroy === 'function') ddChatFind.destroy();
  ddChatFind = null;
  ddChatFindHost = el;
  var make = function () {
    var P = window.spirit && window.spirit.elements && window.spirit.elements.probabilitySearch;
    if (!P || typeof P.create !== 'function' || ddChatFindHost !== el || ddChatFind) return;
    ddChatFind = P.create(el, {
      api: ddApi, server: 'desk', verb: 'chat.search',
      args: function (text) { return { id: ddId, text: text, by: '', since: '', before: '', scope: ddFacts && ddFacts.goal === '' ? 'items' : '' }; },
      columns: [{ field: 'at', label: 'When', sort: 'date' }, { field: 'by', label: 'Who', sort: 'text' }, { field: 'text', label: 'Line', sort: 'text' }],
      face: 'dropdown', placeholder: 'search the chat…',
      matched: function (row) { return { text: String((row && row.text) || ''), by: String((row && row.by) || '') }; },
      pick: function (row) { if (row && row.item && row.item !== ddId) ddApi.closeDialog({ open: row.item }); },
      empty: 'No lines found.',
    });
    ddChatFind.refresh();
  };
  if (window.spirit && window.spirit.elements && window.spirit.elements.probabilitySearch) { make(); return; }
  ddNeed(DD_SEARCH).then(make, function () { el.textContent = 'The search could not be loaded.'; });
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
// ADD BLOCKING ITEM (goal/G9.10): the desk names the id (goal/G9.9), the new item blocks the one on screen, and the
// dialog reads itself again so Blocked by shows it at once. The title stays in the box if the desk refused it, so a
// title the label rules turn down is not lost.
// ── INPUTS FOLLOW THE FIELD RULES (rule/12, goal/G10.10) ─────────────
//
//   rule/12: "every input in the shell, system or app level, whose value a field rule governs is marked with that rule
//   (data-field="label", ...) and validated as typed with the same rule the node uses (fieldRules.js,
//   window.spirit.fieldRules in the browser): bytes left shown beside it, its action refused while the rule says no."
// The title and the rename are labels. What is left, or over, shows beside each as it is typed; a value the rule
// refuses is not sent, and the reason is said. The node checks again: this spares the wire, it never replaces that.
var DD_FIELD_ACTION = { 'dd-add-title': 'dd-add', 'dd-name': 'dd-name-save' };
function ddFieldRule() { return (typeof window !== 'undefined' && window && window.spirit && window.spirit.fieldRules) || null; }
function ddFieldWhy(id) {
  var rule = ddFieldRule();
  var el = document.getElementById(id);
  var value = el ? String(el.value || '') : '';
  if (!rule || !value.trim()) return '';
  var problem = rule.problem(value);
  if (!problem) return '';
  var bytes = rule.byteLength(rule.normalize(value));
  return problem + (bytes > rule.MAX_BYTES ? ': ' + (bytes - rule.MAX_BYTES) + ' bytes over, the limit is ' + rule.MAX_BYTES : '');
}
function ddFieldCheck(id) {
  var rule = ddFieldRule();
  var el = document.getElementById(id);
  var left = document.getElementById(id + '-left');
  if (!rule || !el || !left) return;
  var bytes = rule.byteLength(rule.normalize(String(el.value || '')));
  var why = ddFieldWhy(id);
  left.textContent = why || (rule.MAX_BYTES - bytes) + ' bytes left';
  left.className = why ? 'job-start-error' : 'job-manifest-note';
  var action = document.getElementById(DD_FIELD_ACTION[id]);
  if (action) action.disabled = !!why;
}
function ddAdd() {
  var title = ddValue('dd-add-title');
  var f = ddFacts || {};
  if (!title || ddSending) return;
  var why = ddFieldWhy('dd-add-title');
  if (why) { ddNote = 'Not sent: the title: ' + why; ddPaint(); return; }
  ddSending = true;
  ddWrite('item.add', { goal: f.goal === '' ? ddId : String(f.goal), title: title, blocks: ddId }).then(function (taken) {
    ddSending = false;
    if (!taken) return;
    ddClear('dd-add-title');
    ddLoad();
  });
}
// HIS FOCUS TAKES THE BOX, HIS BLUR LETS IT GO (goal/G9.3): unchanged, box.release; changed, box.write, which frees
// the take itself. The version is the one the dialog read, so a box that moved under him is refused box-moved rather
// than overwritten.
function ddBoxFocus() {
  if (ddBoxFocused) return;
  ddBoxFocused = true;
  ddBoxFocusId = ddId;
  var el = document.getElementById('dd-box-input');
  ddBoxAtFocus = el ? String(el.value || '') : '';
  ddWrite('box.take', { id: ddBoxFocusId });
}
function ddBoxBlur() {
  if (!ddBoxFocused) return;
  ddBoxFocused = false;
  var el = document.getElementById('dd-box-input');
  var text = el ? String(el.value || '') : '';
  var id = ddBoxFocusId || ddId;
  if (text !== ddBoxAtFocus) ddWrite('box.write', { id: id, text: text, version: ddVersion }).then(function () { ddLoad(); });
  else ddWrite('box.release', { id: id }).then(function () { ddPaint(); });
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
// one cache for deskClient and this page: spirit.data (shell/shared/js/spiritData.js) with the desk's translator
// (the desk family's clientCacheManager.js), which the desk's publishes keep current. An item opened before is shown from it; its panels
// are asked once, when it is first opened, and after a gap.
function ddKept() { var s = typeof window !== 'undefined' && window.spirit; return s && s.data && typeof s.data.get === 'function' && s.deskData ? s.data : null; }
function ddForget(id) { var K = ddKept(); if (K && id) K.del('deskItem/' + id); }
function ddLoad() {
  var id = ddId;
  return ddAsk('item.get', { id: id }).then(function (got) {
    if (ddId !== id) return null;
    try { ddFacts = JSON.parse(got.item); } catch (e) { ddFacts = null; }
    ddVersion = Number(got.version) || 0;
    ddLastChange = Number(got.change) || ddLastChange;
    ddPaint();
    var K = ddKept();
    var whole = K ? K.get('deskItem/' + id) : null;
    if (whole && typeof whole.box === 'string' && Array.isArray(whole.checks) && Array.isArray(whole.chat) && Array.isArray(whole.files)) {
      ddBox = whole.box; ddVersion = Number(whole.version) || ddVersion; ddBoxLoaded = true;
      ddChecks = whole.checks; ddChat = whole.chat; ddChatMore = !!whole.chatMore; ddFiles = whole.files; ddFilesMore = !!whole.filesMore;
      ddPaint();
      return null;
    }
    // block.targets is the blocks panel's, asked when 🪠 is pressed (goal/G30.8).
    return Promise.all([
      ddAsk('item.box', { id: id }).then(function (b) { if (ddId !== id) return; ddBox = String(b.box || ''); ddVersion = Number(b.version) || ddVersion; ddBoxLoaded = true; ddPaint(); }),
      ddAsk('item.checks', { id: id }).then(function (k) { if (ddId !== id) return; ddChecks = k.checks || []; ddPaint(); }),
      ddLoadFiles(id),
      ddAsk('item.chat', { id: id }).then(function (c) { if (ddId !== id) return; ddChat = c.chat || []; ddChatMore = !!c.chatMore; ddPaint(); }),
    ]).then(function () {
      if (K && ddId === id) K.set('deskItem/' + id, { box: ddBox, version: ddVersion, checks: ddChecks, chat: ddChat, chatMore: ddChatMore, files: ddFiles, filesMore: ddFilesMore });
    });
  }).then(null, function (e) {
    ddNote = (e && e.refused ? 'Refused: ' : 'The desk server did not answer: ') + e.message;
    ddPaint();
  });
}

spirit.shell.activateApp({
  mount: function (container, api) {
    ddApi = api;
    container.innerHTML = '<div id="dd-body" class="fill" style="min-height:0"></div>';
    document.getElementById('dd-body').addEventListener('click', function (event) {
      var t = event.target;
      // THE BLOCK BUBBLE (goal/G27.5): a delete on a stated block, the add, its fold.
      var unblockEl = t && t.closest ? t.closest('[data-unblock]') : null;
      var unblockOf = unblockEl && unblockEl.getAttribute ? unblockEl.getAttribute('data-unblock') : null;
      if (unblockOf) { ddWrite('unblock', { id: ddId, blocks: unblockOf }).then(ddLoadTargets); return; }
      if (t && t.id === 'dd-block-go') {
        var pick = document.getElementById('dd-block-add');
        var to = pick ? String(pick.value || '') : '';
        if (to) ddWrite('block', { id: ddId, blocks: to }).then(ddLoadTargets);
        return;
      }
      // THE STRIP IS THE workBench's (goal/G41.22): an icon shows its panel through the bench's changed (ddMakeBench).
      var attr = function (name) {
        if (t && t.getAttribute && t.getAttribute(name) != null) return t.getAttribute(name);
        var up = t && t.closest ? t.closest('[' + name + ']') : null;
        return up && up.getAttribute ? up.getAttribute(name) : null;
      };
      var ruleOff = attr('data-rule-remove');
      if (ruleOff) { ddWrite('item.rules.remove', { id: ddId, rule: ruleOff }); return; }
      if (t && t.getAttribute && t.getAttribute('data-fold') === 'blocks') { ddBlocksFolded = !ddBlocksFolded; ddPaint(); return; }
      // Leaving for another item: Desk opens it once this one is closed.
      var link = t && t.closest && t.closest('[data-open],[data-open-item]');
      var to = link && link.getAttribute ? (link.getAttribute('data-open') || link.getAttribute('data-open-item')) : '';
      if (to) {
        if (event.preventDefault) event.preventDefault();
        ddApi.closeDialog({ open: to });
        return;
      }

      var question = t && t.closest ? t.closest('[data-question]') : null;
      if (question) { ddQuote(question.getAttribute('data-question')); return; }
      var check = t && t.getAttribute && t.getAttribute('data-check');
      if (check) { ddWrite('check.set', { id: ddId, check: check, state: 'passed' }); return; }
      // goal/G41.9: an are-you-sure is its armingButton's (ddArming), never this listener's.
      if (t && t.closest && t.closest('[data-arming]')) return;
      var id = t && t.id;
      // CLOSE LEAVES THE DIALOG TOO (desk/G3.8). Andy: "when i click on Close in the Detail dialog, the Dialog
      // should close, since it doesn't exist in the list anymore either." Only once the server took it.
      if (id === 'dd-close') { ddPress('close').then(function (taken) { if (taken) ddApi.closeDialog({}); }); return; }
      if (id === 'dd-go' || id === 'dd-done' || id === 'dd-reopen') { ddPress(id.slice(3)); return; }
      // goal/G2.19: Make current goal presses at once, like Go and Reopen; it closes nothing and takes nothing back.
      if (id === 'dd-make-current') { ddPress('make-current'); return; }
      // goal/G41.22: a verb of the desk, not a press.
      if (id === 'dd-pushgoal') { ddWrite('pushgoal', {}); return; }
      if (id === 'dd-code') { ddPress('code'); return; }
      // goal/G33.3: Verify presses at once, whatever the switch says.
      if (id === 'dd-verify') { ddPress('verify'); return; }
      // THE RENAME OPENS HOLDING THE TITLE (goal/G41.11). Andy: "the rename input field on goal/item detail panel MUST
      // contain the current title when it's first displayed." Set once, here; a repaint keeps what he types (ddPaint).
      if (id === 'dd-rename') {
        ddRenaming = true;
        ddPaint();
        var nameBox = document.getElementById('dd-name');
        if (nameBox) nameBox.value = (ddFacts && ddFacts.title) || '';
        return;
      }
      if (id === 'dd-name-save') { ddRename(); return; }
      if (id === 'dd-add') { ddAdd(); return; }
      if (id === 'dd-say-send') ddSay();
    });
    // EVERY MARKED INPUT, CHECKED AS TYPED (rule/12): one listener on the body, which is repainted.
    document.getElementById('dd-body').addEventListener('input', function (event) {
      var t = event && event.target;
      if (!t || !t.getAttribute || t.getAttribute('data-field') !== 'label') return;
      if (DD_FIELD_ACTION[t.id]) ddFieldCheck(t.id);
    });
    document.getElementById('dd-body').addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.repeat && event.target && event.target.id === 'dd-name') {
        event.preventDefault();
        ddRename();
      }
    });
    // THE BOX'S FOCUS AND BLUR (goal/G9.3), on the body because the textarea is repainted: focus does not bubble, so
    // focusin and focusout are what the body hears. Leaving the dialog blurs the box first, which is the release on
    // close - the dialog cannot hear the shell's Back.
    ['focus', 'focusin'].forEach(function (type) {
      document.getElementById('dd-body').addEventListener(type, function (event) {
        if (event && event.target && event.target.id === 'dd-box-input') ddBoxFocus();
      });
    });
    ['blur', 'focusout'].forEach(function (type) {
      document.getElementById('dd-body').addEventListener(type, function (event) {
        if (event && event.target && event.target.id === 'dd-box-input') ddBoxBlur();
      });
    });
    // The desk server's changes, which the shell would otherwise hand only to Desk.
    if (typeof api.onPublished === 'function') api.onPublished(ddTake, 'desk');
    // deskVerify's own run objects, for the run of this item (goal/G33.6).
    if (typeof api.onPublished === 'function') api.onPublished(ddHearVerifier, 'deskVerify');
    ddLoadRunStatus();
  },

  // Every call: which item this is. Nothing stale from the last one.
  open: function (params) {
    ddId = String((params && params.id) || '');
    // Every item opens on its box (goal/G30.8).
    ddPanelSel = 'box';
    ddSuites = null;
    ddSuitesMore = false;
    ddFacts = null;
    ddBox = '';
    ddBoxLoaded = false;
    ddVersion = 0;
    ddChecks = [];
    ddFiles = [];
    ddFilesMore = false;
    ddChat = [];
    ddChatMore = false;
    // The chat search reads the item on screen; its rows are asked again for it.
    ddMountChatFind();
    ddPending = {};
    ddRowChange = {};
    ddRenaming = false;
    ddNote = '';
    ddLastChange = 0;

    ddFrame();
    ddPaint();
    return ddLoad().then(function () {
      // Opening it is seeing it: his seen clears a brought-back item's mark (goal/G2.1 note 6). The star it
      // also cleared is gone (goal/G4.20 point 8).
      if (ddFacts && ddFacts.alert) ddPress('seen');
    });
  },
});
