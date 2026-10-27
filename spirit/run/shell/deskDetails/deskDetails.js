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
var ddArmed = '';            // the id of the armed button (abandon, go all), pressed once
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
    // rest scrolls (desk/G1.12; goal/G2.1 note 4). SINCE goal/G6.1 the shell's
    // app header does the sticking: ddHeader moves this block into it.
    // FLAT, NO TITLE BUBBLE (goal/G9.6). Andy: "the deskDetail has the title already in the shells title bar", and
    // "no rounded corners", "no margins and no padding". The status the bubble carried rides in the title bar.
    '<div id="dd-bars">' +
      '<div id="dd-name-row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center"></div>' +
      // THE RUN, WHILE THE VERIFIER RUNS THIS ITEM (goal/G33.6): the same rendering as the List's status column.
      '<div id="dd-run"></div>' +
    '</div>' +
    // THE UPPER HALF (goal/G30.8; Andy, 2026-10-20: "an Icon strip down the left side of the detail panel. and an upper
    // and a lower half"): fixed at 30% of the page, so nothing arriving late moves the page; the icons down its left
    // edge, one panel at a time to their right. The yellow "How you check it" bubble that stood in the header is gone.
    // A waiting icon blinks; the open one is marked.
    '<style>.dd-icon{font-size:20px;padding:4px 6px;opacity:.55}.dd-icon-on{opacity:1;outline:1px solid currentColor}' +
      '.dd-blink{opacity:1;animation:ddBlink 1s step-start infinite}@keyframes ddBlink{50%{opacity:.2}}</style>' +
    '<div id="dd-upper" style="display:flex;gap:8px;height:30vh;overflow:hidden">' +
      '<div id="dd-icons" style="display:flex;flex-direction:column;gap:6px"></div>' +
      '<div style="flex:1;overflow:auto">' +
        '<div id="dd-panel"></div>' +
    // ADD BLOCKING ITEM (goal/G9.10). Andy, 2026-10-07: "there will be a new section bubble, immediately following the
    // \"Blocked by/Blocking\" section, and right before the users chat input... \"Title\" [Title String, subject to
    // label rules] [add-button]. When the user presses the [add-button], The desk will add a blocking item with the
    // entered title and a blank text box. The blocked-by section will be updated immediately." It lives in the frame,
    // so what he has typed survives every repaint, as the chat input does.
    '<div class="start-job-form card" id="dd-add-row"><label class="field-label grow">Title' +
      '<input type="text" id="dd-add-title" data-field="label" placeholder="an item this one waits on"></label>' +
      '<span class="job-manifest-note" id="dd-add-title-left"></span>' +
      '<button type="button" id="dd-add">Add blocking item</button></div>' +
    // ATTACH A RULE (goal/G40.12, second set 3): a probability search of the rules as a dropdown; a pick attaches it.
    // In the frame, as the add row is, so the search survives every repaint; it shows with the rules panel only.
    '<div class="start-job-form card" id="dd-rule-add-row" style="display:none"><div id="dd-rule-pick" style="flex:1"></div></div>' +
      '</div>' +
    '</div>' +
    // THE CHAT SEARCH (goal/G18.5). Andy: "chats for items/goals are searchable in the UI, right above the chat input
    // box.", then "yes, add it here." The probability search over chat.search (goal/G40.12: "all searches in desk are of
    // the new probability variety"): a dropdown that ranks the lines as he types and marks the words; a line said in
    // another item opens that item. In the frame, so it survives every repaint.
    '<div class="start-job-form card"><div id="dd-chat-find" style="flex:1"></div></div>' +
    '<div class="start-job-form card"><label class="field-label grow">Say' +
      // Return is a new line; only Send sends (desk/G1.12).
      '<textarea id="dd-say" rows="3" placeholder="under this item"></textarea></label>' +
      '<button type="button" id="dd-say-send">Send</button></div>' +
    '<div id="dd-error" class="job-start-error"></div>' +
    '<div class="stat-tile wide"><div class="label">Chat, newest first</div><div id="dd-chat"></div></div>';
  ddHeader();
}
// THE HEADER AREA IS THE SHELL'S (goal/G6.1): the block written as #dd-bars moves into the app header, which sticks it
// under the titlebar, and takes its id.
function ddHeader() {
  var old = document.getElementById('dd-bars');
  var els = ddApi && ddApi.ui && ddApi.ui.elements;
  if (!old || !els || typeof els.createAppHeader !== 'function') return;
  var head = els.createAppHeader();
  head.id = 'dd-bars';
  while (old.firstChild) head.appendChild(old.firstChild);
  old.parentNode.replaceChild(head, old);
}

// goal/G33.4: an item's own End design, while its goal is out of design.
// goal/G41.2: Start design too, which the desk offers on any item since goal/G40.12 ("You can turn design on for an item
// at any time"); a press missing here was dropped from the dialog unseen.
var DD_LABELS = { 'start-design': 'Start design', 'end-design': 'End design', go: 'Go!', done: 'Done', close: 'Close', reopen: 'Reopen' };

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
  if (typeof document === 'undefined' || typeof document.createElement !== 'function' || !document.body) return;
  var script = document.createElement('script');
  script.src = DD_RUN_STATUS;
  script.onload = function () { ddSet('dd-run', ddRunHtml()); };
  document.body.appendChild(script);
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
    if (b !== 'done') return '<button type="button" id="dd-' + b + '">' + label + '</button>';
    var warned = ddDoneWarned(f);
    var armed = warned && ddArmed === 'dd-done';
    var done = '<button type="button" id="dd-done"' + (armed ? ' data-armed="1"' : '') + (warned ? ' title="' + ddEsc(ddDoneWhy(f)) + '"' : '') + '>' +
      (armed ? 'Done anyway: sure?' : label + (warned ? ' ' + DD_WARN : '')) + '</button>';
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
  // very right of the button row". The first press arms it, the second goes;
  // it disarms the moment he clicks elsewhere (armedButtons.js, the shell's
  // armUntilElsewhere), and data-armed has the shell paint it.
  // GO ALL ON THE GOAL (desk/G3.7). Andy: "the goal-detail panel could offer the
  // go-all button if there is any go-able items". Armed like the List's (G3.4).
  if (f.goal === '' && (f.buttons || []).indexOf('go-all') !== -1) {
    html += '<button type="button" id="dd-go-all"' + (ddArmed === 'dd-go-all' ? ' data-armed="1"' : '') + '>' +
      (ddArmed === 'dd-go-all' ? 'Go all: sure?' : 'Go all') + '</button>';
  }
  // WAIVE (goal/G2.22). Andy: "there is no Waive in the G2.18 dialog" — the server has had the press since
  // goal/G5.7 and never had a button. Armed like Go all: the first click arms, the second lifts the phase rules on
  // this item, so one agent can carry it from red to verify.
  if ((f.buttons || []).indexOf('waive') !== -1) {
    html += '<button type="button" id="dd-waive"' + (ddArmed === 'dd-waive' ? ' data-armed="1"' : '') + '>' +
      (ddArmed === 'dd-waive' ? 'Waive: sure?' : 'Waive') + '</button>';
  }
  // DELETE (goal/G9.7). Andy: "the button bar of items will offer an arm-able [delete] while in design mode." The
  // server offers it only then (buttons), so the bar draws it from the facts and arms like Waive: the first click arms,
  // the second deletes. His decision that it closes rather than erases is the server's (goal/G9.7, goal/G4.24).
  if ((f.buttons || []).indexOf('delete') !== -1) {
    html += '<button type="button" id="dd-delete"' + (ddArmed === 'dd-delete' ? ' data-armed="1"' : '') + '>' +
      (ddArmed === 'dd-delete' ? 'Delete: sure?' : 'Delete') + '</button>';
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
    html += '<button type="button" id="dd-abandon"' + (ddArmed === 'dd-abandon' ? ' data-armed="1"' : '') +
      ' style="margin-left:auto;background:#b00020;color:#fff">' +
      (ddArmed === 'dd-abandon' ? 'Sure? Abandon the goal' : 'Abandon') + '</button>';
  }
  if (early) {
    // goal/G6.6: a goal's Close asks "are you sure? N open" while any of its items is open; nothing open presses at
    // once. On a non-goal item (an open code item) the existing "Close: sure?" arm stands (desk/G3.9).
    var goalOpen = f.goal === '' && (f.blocked || []).length;
    var label = ddArmed === 'dd-close'
      ? (goalOpen ? 'are you sure? ' + goalOpen + ' open' : 'Close: sure?')
      : 'Close';
    html += '<button type="button" id="dd-close"' + (ddArmed === 'dd-close' ? ' data-armed="1"' : '') + ' style="margin-left:auto">' +
      label + '</button>';
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
  { key: 'box', icon: 'PAGE', title: 'the box' },
  // goal/G33.11: the suites attached to the item, read only, informational for now.
  { key: 'suites', icon: 'CHECKED', title: 'the suites attached to this item' },
  { key: 'qs', icon: 'NO', title: 'red Qs and checks' },
  { key: 'blocks', icon: 'PLUNGER', title: 'blocks' },
  { key: 'files', icon: 'OPENFOLDER', title: 'files and grants' },
  // goal/G40.12, second set 2: "the icons strip to the left of a goal has an icon for the list of attached rules".
  { key: 'rules', icon: 'BOOK', title: 'the rules attached' },
];
function ddWaits(kind) { return ddChecks.some(function (c) { return c.kind === kind && c.state === 'open'; }); }
function ddIconsHtml() {
  var ICON = (window.spirit && window.spirit.iconIndex && window.spirit.iconIndex.ICON) || {};
  var blink = { qs: ddWaits('Q'), files: ddWaits('G') };
  return DD_PANELS.map(function (p) {
    var cls = (p.key === ddPanelSel ? 'dd-icon dd-icon-on' : 'dd-icon') + (blink[p.key] ? ' dd-blink' : '');
    return '<button type="button" data-panel="' + p.key + '" class="' + cls + '" title="' + ddEsc(p.title) + '">' + ICON[p.icon] + '</button>';
  }).join('');
}
// The red Qs open on this item, each with his remove (his clear, "Q1: clear", desk clearOf), and the checks (C) to press.
function ddQsHtml() {
  var qs = ddChecks.filter(function (c) { return c.kind === 'Q' && c.state === 'open'; }).map(function (c) {
    return '<div><span data-question="' + ddEsc(c.number) + '" style="color:#d00;cursor:pointer" title="answer it below">' + ddEsc(c.number) + ': ' + ddEsc(c.words) + '</span> ' +
      '<button type="button" data-qclear="' + ddEsc(c.number) + '" title="remove this red Q">remove</button></div>';
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
  var armedAll = ddArmed === 'grant:all';
  var all = open && openCount > 1 ? '<div><button type="button" data-grant="all"' + (armedAll ? ' data-armed="1"' : '') +
    ' style="background:#c00;color:#fff">' + (armedAll ? 'Grant all ' + openCount + ': sure?' : 'Grant all ' + openCount) + '</button></div>' : '';
  return all + ddChecks.map(function (c) {
    if (!open && c.kind === 'G' && c.state === 'granted') {
      return '<div data-granted="' + ddEsc(c.number) + '" style="color:#1a7f37" title="granted ' + ddEsc(c.at) + '">✓ ' + ddEsc(c.number) + ' ' + ddEsc(c.words) + '</div>';
    }
    if (open && c.kind === 'G' && c.state === 'open' && ddPending[c.number]) {
      return '<div data-pending="' + ddEsc(c.number) + '"><button type="button" disabled style="background:#888;color:#fff">granting…</button> ' + ddEsc(c.words) + '</div>';
    }
    if (open && c.kind === 'G' && c.state === 'open') {
      var armed = ddArmed === 'grant:' + c.number;
      return '<div><button type="button" data-grant="' + ddEsc(c.number) + '"' + (armed ? ' data-armed="1"' : '') +
        ' style="background:#c00;color:#fff">' + (armed ? 'Grant ' + ddEsc(c.number) + ': sure?' : 'Grant ' + ddEsc(c.number)) + '</button> ' + ddEsc(c.words) + '</div>';
    }
    return '';
  }).join('');
}
function ddPanelHtml() {
  if (ddPanelSel === 'qs') return ddQsHtml();
  if (ddPanelSel === 'blocks') return ddLinksHtml() || '<div class="job-manifest-note">A goal blocks nothing.</div>';
  if (ddPanelSel === 'suites') return ddSuitesHtml();
  if (ddPanelSel === 'rules') return ddRulesHtml();
  if (ddPanelSel === 'files') return ddGrantsHtml(true) + (ddFilesHtml() || '<div class="job-manifest-note">No files touched yet.</div>') + ddGrantsHtml(false);
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
  return '<div' + taken + ' style="' + cap + 'height:100%;box-sizing:border-box">' +
    '<textarea id="dd-box-input" style="width:100%;height:calc(30vh - 12px);box-sizing:border-box;white-space:pre-wrap;resize:none;overflow-y:auto">' + ddEsc(ddBox) + '</textarea></div>';
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
  return ddChat.slice().reverse().map(ddBubble).join('') + older;
}

function ddSet(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; }

// Repaints every part between the inputs; a name he is typing survives it.
function ddPaint() {
  var typed = ddRenaming ? ddValue('dd-name') : '';
  ddSet('dd-name-row', ddButtonsHtml());
  ddSet('dd-run', ddRunHtml());
  var box = ddRenaming && typed && document.getElementById('dd-name');
  if (box) box.value = typed;
  ddSet('dd-icons', ddIconsHtml());
  // The chat search stands in the frame; it is made once the frame is drawn (ddMountChatFind), never again by a paint.
  if (!ddChatFind) ddMountChatFind();
  // NOT WHILE HE IS IN THE BOX (goal/G9.3): a repaint would throw away what he has typed, and he holds the take anyway.
  if (!(ddPanelSel === 'box' && ddBoxFocused)) ddSet('dd-panel', ddPanelHtml());
  // The add-blocking form stands in the frame, so what he types survives; it shows with the blocks panel only.
  var addRow = document.getElementById('dd-add-row');
  if (addRow && addRow.style) addRow.style.display = ddPanelSel === 'blocks' ? '' : 'none';
  var ruleRow = document.getElementById('dd-rule-add-row');
  if (ruleRow && ruleRow.style) ruleRow.style.display = ddPanelSel === 'rules' ? '' : 'none';
  ddSet('dd-chat', ddChatHtml());
  var err = document.getElementById('dd-error');
  if (err) err.textContent = ddNote;
  if (ddFacts && typeof ddApi.setScreenTitle === 'function') ddApi.setScreenTitle(ddId + ' — ' + (ddFacts.title || '') + (ddFacts.status ? ' (' + ddFacts.status + ')' : ''));
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
var DD_SEARCH = '/shell/js/probabilitySearch.js';
var ddRulePick = null;
// The rule types, as the desk server's RULE_TYPES (goal/G40.12 added test).
var DD_RULE_TYPES = ['ui', 'code', 'design', 'desk', 'test'];
// probabilitySearch.js, loaded once for the page however many asks wait on it.
var ddSearchWaiting = null;
function ddLoadSearch(done) {
  if (ddSearchWaiting) { ddSearchWaiting.push(done); return; }
  if (typeof document.createElement !== 'function' || !document.body) return;
  ddSearchWaiting = [done];
  var script = document.createElement('script');
  script.src = DD_SEARCH;
  script.onload = function () { var w = ddSearchWaiting; ddSearchWaiting = null; w.forEach(function (fn) { fn(); }); };
  document.body.appendChild(script);
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
function ddMountRulePick() {
  var el = document.getElementById('dd-rule-pick');
  if (!el || ddRulePick) return;
  var make = function () {
    var P = window.spirit && window.spirit.elements && window.spirit.elements.probabilitySearch;
    if (!P || typeof P.create !== 'function' || ddRulePick) return;
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
  ddLoadSearch(make);
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
function ddMountChatFind() {
  var el = document.getElementById('dd-chat-find');
  if (!el) return;
  if (ddChatFind) { ddChatFind.refresh(); return; }
  var make = function () {
    var P = window.spirit && window.spirit.elements && window.spirit.elements.probabilitySearch;
    if (!P || typeof P.create !== 'function' || ddChatFind) return;
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
  ddLoadSearch(make);
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
// one cache for deskClient and this page: spirit.data (shell/js/spiritData.js) with the desk's translator
// (shell/js/desk/data.js), which the desk's publishes keep current. An item opened before is shown from it; its panels
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
    container.innerHTML = '<div id="dd-body" class="stack"></div>';
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
      // THE STRIP (goal/G30.8): an icon shows its panel; the blocks ask their targets then. A red Q's remove is his clear.
      var attr = function (name) {
        if (t && t.getAttribute && t.getAttribute(name) != null) return t.getAttribute(name);
        var up = t && t.closest ? t.closest('[' + name + ']') : null;
        return up && up.getAttribute ? up.getAttribute(name) : null;
      };
      var panel = attr('data-panel');
      if (panel) {
        ddPanelSel = panel;
        ddPaint();
        if (panel === 'blocks') ddLoadTargets();
        if (panel === 'suites') ddLoadSuites(ddId);
        if (panel === 'rules') { ddLoadRuleNames(); ddMountRulePick(); }
        return;
      }
      var ruleOff = attr('data-rule-remove');
      if (ruleOff) { ddWrite('item.rules.remove', { id: ddId, rule: ruleOff }); return; }
      var qclear = attr('data-qclear');
      if (qclear) { ddWrite('chat.add', { id: ddId, text: qclear + ': clear' }); return; }
      if (t && t.getAttribute && t.getAttribute('data-fold') === 'blocks') { ddBlocksFolded = !ddBlocksFolded; ddPaint(); return; }
      // Leaving for another item: Desk opens it once this one is closed.
      var link = t && t.closest && t.closest('[data-open],[data-open-item]');
      var to = link && link.getAttribute ? (link.getAttribute('data-open') || link.getAttribute('data-open-item')) : '';
      if (to) {
        if (event.preventDefault) event.preventDefault();
        ddApi.closeDialog({ open: to });
        return;
      }

      var grantEl = t && t.closest ? t.closest('[data-grant]') : null;
      if (grantEl) {
        var g = grantEl.getAttribute('data-grant');
        if (ddArmed !== 'grant:' + g) {
          ddArmed = 'grant:' + g;
          ddPaint();
          if (typeof ddApi.armUntilElsewhere === 'function') ddApi.armUntilElsewhere(ddDisarm);
          return;
        }
        ddArmed = '';
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
      var question = t && t.closest ? t.closest('[data-question]') : null;
      if (question) { ddQuote(question.getAttribute('data-question')); return; }
      var check = t && t.getAttribute && t.getAttribute('data-check');
      if (check) { ddWrite('check.set', { id: ddId, check: check, state: 'passed' }); return; }
      var id = t && t.id;
      // CLOSE LEAVES THE DIALOG TOO (desk/G3.8). Andy: "when i click on Close in the Detail dialog, the Dialog
      // should close, since it doesn't exist in the list anymore either." Only once the server took it.
      var f = ddFacts || {};
      // goal/G6.6: a goal's Close asks "are you sure? N open" while any of its items is open; nothing open presses at
      // once. On a non-goal item (an open code item) the existing early-close arm stands (desk/G3.9).
      var armedClose = id === 'dd-close' && ddEarlyClose(f) && (f.goal !== '' || (f.blocked || []).length > 0);
      if (id === 'dd-close' && !armedClose) { ddPress('close').then(function (taken) { if (taken) ddApi.closeDialog({}); }); return; }
      // goal/G33.3: Done not verified green arms first and says why; the second press sends it.
      if (id === 'dd-done' && ddDoneWarned(f) && ddArmed !== 'dd-done') {
        ddArmed = 'dd-done';
        ddNote = ddDoneWhy(f);
        ddPaint();
        if (typeof ddApi.armUntilElsewhere === 'function') ddApi.armUntilElsewhere(function () { ddNote = ''; ddDisarm(); });
        return;
      }
      if (id === 'dd-done') { ddArmed = ''; ddNote = ''; }
      if (id === 'dd-go' || id === 'dd-done' || id === 'dd-reopen' || id === 'dd-end-design' || id === 'dd-start-design') { ddPress(id.slice(3)); return; }
      // goal/G2.19: Make current goal presses at once, like Go and Reopen; it closes nothing and takes nothing back.
      if (id === 'dd-make-current') { ddPress('make-current'); return; }
      if (id === 'dd-code') { ddPress('code'); return; }
      // goal/G33.3: Verify presses at once, whatever the switch says.
      if (id === 'dd-verify') { ddPress('verify'); return; }
      if (id === 'dd-abandon' || id === 'dd-go-all' || id === 'dd-waive' || id === 'dd-delete' || armedClose) {
        if (ddArmed !== id) {
          ddArmed = id;
          ddPaint();
          if (typeof ddApi.armUntilElsewhere === 'function') ddApi.armUntilElsewhere(ddDisarm);
          return;
        }
        ddArmed = '';
        if (armedClose) { ddPress('close').then(function (taken) { if (taken) ddApi.closeDialog({}); }); return; }
        // DELETE IS A VERB, NOT A PRESS (goal/G9.7), and it takes the item off the List, so the dialog goes with it.
        if (id === 'dd-delete') {
          ddWrite('item.delete', { id: ddId }).then(function (taken) { if (taken) ddApi.closeDialog({}); });
          return;
        }
        ddPress(id.slice(3));
        return;
      }
      if (id === 'dd-rename') { ddRenaming = true; ddPaint(); return; }
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
    ddArmed = '';
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
