// spirit/run/shell/desk/desk.js
// ANDY'S DESK FOR TALKING TO THE AGENTS — design/shell/AGENTS-UI.md.
//
//   Andy, 2026-09-27: "it would allow me to send input without
//   interrupting any of you, and your attention can thus be better
//   organized, too" — "my input will be queued, any agent can adress
//   issues in the table, respons to me under that heading".
//
// A REAL APP, and only the app contract: what arrives comes through
// `onPacket`, everything Andy writes leaves as an ordinary `agents` packet
// through `peerPost`, and both are kept in Desk's OWN log, `log.json` in
// its own folder (`api.fs`). The board and every thread are read from it.
//
// ── IT KEEPS ITS OWN LOG, BY RULING ───────────────────────────────────
//
//   Andy, 2026-09-27, when Desk read his node's record through a node
//   verb added for it: "that's a boundary crossed that requires peer
//   review AND my approval", then "they must keep their own logs" and
//   "after correcting agents and desk, we will remove the new verb."
//
// So Desk asks the node for no record, and for nothing beyond what every
// app has (onPacket, peerPost, its own folder). What passed
// before this log existed, or while no Desk was mounted in an open page,
// is not in it. That is the price of the ruling, not a bug to fix by
// reaching into the node's record again.
//
// ── THE THREAD KEY IS THE FULL ID ────────────────────────────────────
//
// A row is keyed by `id` (`puppets/G6`), never by the handle it prints:
// the handle is the shortest form unique today and can lengthen, which
// would orphan a thread keyed on it. Andy never types either — the app
// attaches the id to what he writes, which is what lets his text reach
// voice.jsonl clean. Nothing here writes voice.jsonl, and nothing may:
// Andy, 2026-09-27, "that hook into my voice.jsonl is a hack and will have
// to be removed if the agents app is ever to ship."


// A BUSY AGENT IS WAITED FOR, NOT BOUNCED. Andy's line came back
// "(undelivered: target is busy)" because a post got one attempt. With
// his go, peer.post takes a patience and the node retries a busy target
// with backoff; Desk asks for a minute. What the log records is the final
// outcome, after that minute, never the first refusal.
// DESK_PATIENCE stood here: the minute the page gave a busy agent when it posted him a line. No line leaves the
// page as a packet since goal/G3.12.

var deskApi = null;
// THE LIST IS THE DESK SERVER'S (desk/G2.6). Andy: "The server determines all the
// content to be drawn." "no pulling". ITS ROWS ARE spirit.data's (goal/G41.28; Andy: "the FUCKING desk cache is NOT to
// be found in spirit.data.data.desk... something keeps throwing out that shit", and "doesn't the fucking ...
// clientCacheManager.js take care of that"): the desk's rows the cache manager keeps, every goal pushed and every
// search answer seated there, read through spirit.data.desk.data. The page keeps no rows of its own, so a search that answers
// few rows drops none; what the toggles leave out is decided here, in the order goal, then its members.
function deskKept() { return (typeof window !== 'undefined' && window.spirit && ((window.spirit.data || {}).desk || {}).data) || null; }
function deskIdOrder(a, b) {
  var x = String(a.id).match(/\d+/g) || [];
  var y = String(b.id).match(/\d+/g) || [];
  for (var i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] === undefined) return -1;
    if (y[i] === undefined) return 1;
    if (Number(x[i]) !== Number(y[i])) return Number(x[i]) - Number(y[i]);
  }
  return 0;
}
// A row the toggles let onto the List: Goals Only, goal rows alone; Current Goal Only, the current goal and its items;
// Include Closed off, no closed row.
function deskRowShown(row) {
  if (!row || !row.id) return false;
  if (deskFilter.goalsOnly && row.goal !== '') return false;
  if (!deskFilter.includeClosed && row.status === 'closed') return false;
  var K = deskKept();
  if (deskFilter.currentGoalOnly && !deskFilter.goalsOnly && deskGoalOf(row) !== deskCurrentGoal()) return false;
  return true;
}
function deskHeld() {
  var K = deskKept();
  var all = K ? K.items() : {};
  return Object.keys(all).map(function (id) { return all[id]; }).filter(deskRowShown).sort(deskIdOrder);
}
// The search bar and its two toggles. Andy: "When Desk opens: [Current Goal Only]
// on, [Goals Only] off". "The server does the searching AND the filtering."
var deskFilter = { text: '', currentGoalOnly: true, goalsOnly: false, includeClosed: false };
// THE ROW'S ICON (desk/G1.11): ❌ wherever Andy blocks ("the ERROR for
// anything i NEED to deal with", "wherever i block"), 💻 on any other item.
// ICONS ARE GLYPHS (goal/G41.1): written as they are, from no icon table.
var deskError = '';
// THE LEGACY AGENTS-PACKET LOG WENT WITH goal/G33.4 (Andy: "log.add, log.search and pending.get: delete them."): the page
// no longer records arrivals of the agents app's era nor reads them back; the desk server knows the agents by their keys
// (the goal row's agents).

// ── DESK'S RECORD IS THE DESK SERVER'S (desk/G1.4) ──────────────────
//
//   Andy: "desk creates a lot of file-clutter", "SpiritOS list.load rules
//   are probably vialoated", "lazy-fill of pages seems appropriate", "the
//   list only loads key/title, and the rest lazy loads".
//
// DECIDED (desk/G1, D5 and O9), not this file's to undo: Desk keeps nothing
// in its own folder. Its log, what he typed, and its state and seen live in
// the desk server (process/js/desk), reached by its verbs (desk.<verb>) on the loopback
// door (D4; through the flat apiDoor since goal/G30.6). It reads only what it shows: the newest session, each open
// item's own lines, a chat's newest page, never the whole log. Desk still
// keeps only what it shows; the server is storage and bounded search.
// Each id a link to its item, as the dialog's are (Andy: "the blocked and
// blocks lists link to the respective items").
function deskLinks(ids) {
  return (ids || []).map(function (id) {
    return '<a href="#" data-action="open" data-open="' + deskEsc(id) + '">' + deskEsc(id) + '</a>';
  }).join(', ');
}

function deskAsk(verb, args) {
  return Promise.resolve(deskApi.verb('desk.' + verb, args || {})).then(function (r) {
    var body = r && r.body;
    if (!r || r.status !== 200 || !body || body.ok === false) throw new Error(deskRefusalText(body) || 'the desk server did not answer');
    return body;
  });
}
// A REFUSAL BY ITS NAME, SIZE AND LIMIT (Andy: "would have been diagnosed in an instant"): the code, and for a size
// refusal how large and the limit, never only a sentence.
function deskRefusalText(body) {
  if (!body || !body.code) return body && body.error ? String(body.error) : '';
  var x = body.extra || {};
  // THE WHY TOO (goal/G18.10): every refusal carries its reason since goal/G10.10, and the page showed the code alone.
  return body.code + (typeof x.bytes === 'number' ? ': ' + x.bytes + ' bytes, the limit is ' + x.max : '') + (x.why ? ': ' + x.why : '') + (body.error ? ' (' + body.error + ')' : '');
}
function deskWriteError(what) {
  return function (e) { deskError = 'Desk could not ' + what + ': ' + ((e && e.message) || e); deskDraw(); };
}

// WHAT ANDY TYPES IS NO LONGER SENT TO A VOICE FILE (goal/G2.1 note 8). The desk server kept a plain file of
// his lines (desk/G1.4) for his vault; since apiAuth/G1's close the brain reads them through the desk api, and the
// vault's own tool (claude/voiceFromDesk.js) keeps his corpus. Nothing here writes it, and nothing may.

function deskEsc(s) { return deskApi.escapeHtml(String(s == null ? '' : s)); }

// ── WHAT ANDY HAS NOT SEEN YET ────────────────────────────────────────
//
//   Andy, 2026-09-27: "list items in the list should show a red "news" in
//   a unlabeled column, indicating that new stuff has arrived for that
//   item, and the list, lead, and team tabls should also show a red "*"
//   befor the tab title when new activity has taken place that I havent
//   seen yet. (attention-direction)" — then "or use the red "*" do
//   indicate "unseen changes have occured"". One mark, everywhere.
//
// Seen is kept per row and per chat by the desk server (seen.set, G1.4),
// as the arrival time of the newest thing he has looked at: arrival times
// rather than his clock, so a sender's skew cannot hide anything. A row is
// seen when he opens it, a chat while its tab is showing. A Desk with no
// seen.json yet counts all it holds as seen, so the first open is not a
// wall of red. THE STAR IS GONE (goal/G4.20 point 8), from the rows and the tabs alike. Andy: "ha ha, the red
// star has no function anymore. take it out." What waits on him is the row's ICON.ERROR (facts.asks).
// A brought-back item's mark (goal/G2.1 note 6): "the attention-grabbing error icon"; his seen clears it.
// goal/G33.8 (box v13; Andy: "it's enough to put a red ! next to the item"): the mark stands beside the item's title and
// id; the row keeps its colour.
var DESK_ALERT = '<span data-alert-mark="1" style="color:#d00;font-weight:bold" title="needs your eye: brought back, or a line from the agent holding it">!</span>';
// The main tab the page opens on, and falls back to: the List.
var deskTab = 'list';

// A tab button: the one showing is marked.
function deskTabButton(attrs, on, label) {
  return '<button type="button" ' + attrs + ' aria-selected="' + (on ? 'true' : 'false') + '" style="font-weight:' +
    (on ? 'bold' : 'normal') + ';text-decoration:' + (on ? 'underline' : 'none') + '">' +
    deskEsc(label) + '</button>';
}

// THE AGENT BUBBLES, BESIDE THE TABS (goal/G3.12). Andy, 2026-10-03: "the main botton row now reads: [List]
// [Team] [Musings], those are buttons, and Info [Agent1-status] [Agent2-status]... Where the Agent - bubbles are
// highlighted with a red-blinking border when busy." One bubble per agent the goal row says is live, the working
// one marked data-working (the blink is declared on that mark, goal/G2.4); state only, a click does nothing. They
// follow the goal row's publish, nothing is pulled.
function deskBubblesHtml() {
  var g = deskGoalRow();
  var live = g && Array.isArray(g.live) ? g.live.slice() : [];
  // EVERY AGENT THE DESK KNOWS (goal/G4.29; Andy: "can't reach it because ollama is gone"): the live ones and every
  // one in agents; an away one keeps its bubble and its pane, marked data-away, never working.
  var known = live.concat(Object.keys((g && g.agents) || {}).filter(function (a) { return live.indexOf(a) === -1; })).sort();
  if (!known.length) return '';
  var working = deskWorkingAgents();
  // NOT INCLUDED IS ABSENT (goal/G21.1). Andy: "Off: the agent still reads everything, every write of it is refused, and
  // its bubble shows absent." The server names them in excluded and keeps them out of live.
  var excluded = g && Array.isArray(g.excluded) ? g.excluded : [];
  // EACH BUBBLE IS A TAB (goal/G4.23). Andy: "the red-bordered agent bubbles become tab-headers again, with their own
  // pane for scope-configuration." data-tab="agent:<name>" opens that agent's pane (its profile since goal/G10.8); the bubble keeps its state.
  // ITS NAME ON IT (goal/G21.1): the label stays the bubble's handle in the markup, the name is what he reads.
  return '<span class="job-manifest-note" style="margin-left:12px">Info</span>' + known.map(function (n) {
    var absent = excluded.indexOf(n) !== -1;
    var away = live.indexOf(n) === -1;
    var busy = !away && working.indexOf(n) !== -1;
    var on = deskTab === 'agent:' + n;
    return '<span data-bubble="' + deskEsc(n) + '" data-tab="agent:' + deskEsc(n) + '"' +
      (absent ? ' data-absent="1" title="absent: not included at the desk; open its profile"'
        : away ? ' data-away="1" title="away: not heard from in 10 minutes; open its profile"' : busy ? ' data-working="1" title="working: leave it alone until it listens again"' : ' title="listening: open its profile"') +
      ' style="display:inline-block;cursor:pointer;padding:2px 10px;margin-left:6px;border-radius:12px;font-weight:' + (on ? 'bold' : 'normal') +
      ';border:2px ' + (absent ? 'dotted #888;opacity:0.4' : away ? 'dashed #888;opacity:0.6' : 'solid ' + (busy ? '#d00' : '#555')) + '">' + deskEsc(deskNameOf(n)) + '</span>';
  }).join('');
}

// AN AGENT BY ITS NAME (goal/G21.1). Andy: "The page shows the agent's name everywhere it shows the agent ... The name
// is looked up by the agent's key; the node's label is shown only when no name is set. Keys are never shown on the
// page." The desk looks the name up by key and hands it beside the label (a row's names, a chat line's name); the page
// shows it, and the label where none is set.
function deskNameOf(label, row) {
  var g = deskGoalRow();
  var own = row && row.names ? row.names[label] : '';
  return own || (g && g.names && g.names[label]) || label;
}

// ── AN AGENT'S PANE: ITS PROFILE (goal/G4.23) ────────────────────────
//
//   The pane showed the agent's scope and set it until goal/G10.8. Andy, 2026-10-12: "all agents in desk have "/" file
//   scope", the per-agent setting removed from desk and commitCheck ("b"). What stays is the profile, name and nick.
var deskAgentName = '';
var deskAgentProfile = null;
var deskAgentNote = '';
function deskAgentKey() {
  var g = deskGoalRow();
  return (g && g.agents && g.agents[deskAgentName]) || '';
}
function deskAgentDraw() {
  var el = document.getElementById('desk-agent');
  if (!el) return;
  var label = document.getElementById('desk-agent-label');
  if (label) label.textContent = deskNameOf(deskAgentName) + ': every agent may commit anywhere in the repo; core files still need your grant';
  el.innerHTML = (deskAgentKey() ? '' : '<div class="job-start-error">No key known for ' + deskEsc(deskAgentName) + '.</div>') +
    (deskAgentNote ? '<div class="job-start-error">' + deskEsc(deskAgentNote) + '</div>' : '');
}
function deskAgentOpen(name) {
  deskAgentName = name;
  deskAgentNote = '';
  deskAgentProfile = null;
  deskAgentDraw();
  var slot = document.getElementById('desk-agent-picker');
  if (slot) {
    slot.innerHTML = '';
    // TWO ROWS (goal/G21.1). Andy, in the item's box: "Row one: name and nick (text inputs). Row two: the toggles
    // included and cap; more toggles may follow. Written by Andy alone; every agent may read every pane."
    // Each row one line with room between its parts (Andy: "misses horizontal spacing between items").
    slot.style.display = 'block';
    var row = function (n) {
      var r = document.createElement('div');
      r.setAttribute('data-profile-row', String(n));
      r.style.display = 'flex';
      r.style.alignItems = 'center';
      r.style.flexWrap = 'wrap';
      r.style.gap = '12px';
      slot.appendChild(r);
      return r;
    };
    var one = row(1);
    var two = row(2);
    // NAME AND NICK, KEPT BY THE DESK FOR ANDY (Andy: "so two more fields for repo-root-agents: / name <agent-name> /
    // nick: <wc | wsl | ubi>", and "the profiles are for me, in desk"). profile.set is owner-only on the server; the
    // nick addresses a line of his to that agent alone (goal/G21.1: the nick and any punctuation or a space).
    var field = function (where, which, type, width) {
      var label = document.createElement('label');
      label.className = 'job-manifest-note';
      label.textContent = which + ' ';
      var input = document.createElement('input');
      input.setAttribute('type', type);
      input.setAttribute('data-profile', which);
      if (width) input.style.width = width;
      label.appendChild(input);
      where.appendChild(label);
      return input;
    };
    deskAgentProfile = { name: field(one, 'name', 'text', '12em'), nick: field(one, 'nick', 'text', '5em') };
    var save = document.createElement('button');
    save.setAttribute('type', 'button');
    save.setAttribute('data-profile-save', '1');
    save.textContent = 'save';
    save.addEventListener('click', deskAgentProfileSave);
    one.appendChild(save);
    // A TOGGLE IS WRITTEN AS IT IS TURNED: included (off, the desk refuses every write of it) and cap (on, his bare
    // "cap" is offered to it).
    deskAgentProfile.included = field(two, 'included', 'checkbox', '');
    deskAgentProfile.cap = field(two, 'cap', 'checkbox', '');
    deskAgentProfile.included.addEventListener('change', deskAgentProfileSave);
    deskAgentProfile.cap.addEventListener('change', deskAgentProfileSave);
  }
  return deskAgentProfileLoad();
}
function deskAgentProfileLoad() {
  var key = deskAgentKey();
  if (!key || !deskAgentProfile) return Promise.resolve();
  return deskAsk('profile.get', { agent: key }).then(function (r) {
    deskAgentProfile.name.value = (r && r.name) || '';
    deskAgentProfile.nick.value = (r && r.nick) || '';
    deskAgentProfile.included.checked = !(r && r.included === false);
    deskAgentProfile.cap.checked = !(r && r.cap === false);
  }, function (e) { deskAgentNote = 'Profile not read: ' + ((e && e.message) || e); deskAgentDraw(); });
}
function deskAgentProfileSave() {
  var key = deskAgentKey();
  if (!key || !deskAgentProfile) return;
  deskAsk('profile.set', { agent: key, name: deskAgentProfile.name.value, nick: deskAgentProfile.nick.value,
    included: deskAgentProfile.included.checked === true, cap: deskAgentProfile.cap.checked === true }).then(function () {
    deskAgentNote = '';
    deskAgentDraw();
    return deskAgentProfileLoad();
  }, function (e) { deskAgentNote = 'Profile not saved: ' + ((e && e.message) || e); deskAgentDraw(); });
}

// Drawn whole, as markup: List | Rules, then the bubbles. The Team tab, the Apps tab and its inner tabs went with
// goal/G43.22 (Andy, the box, Q5: "G0 goes, from ui and server, kept in database.").
function deskDrawTabs() {
  var strip = document.getElementById('desk-tabs');
  if (!strip) return;
  var waiting = deskWaitingOnAndy();
  var design = deskDesignOn();
  strip.innerHTML =
    deskTabButton('data-tab="list"', deskTab === 'list', 'List' + (waiting ? ' (' + waiting + ')' : '')) +
    deskTabButton('data-tab="rules"', deskTab === 'rules', 'Rules') +
    // THE MUSINGS TAB STOOD HERE, and went with goal/G27.3.
    // WHERE MUSINGS STOOD, AND ONLY WHERE ONE RUNS (goal/G8.11): his words were "right after [musings]", and the tab
    // is absent on a node with no deskVerify, as the backup bubble is.
    (deskVerifier ? deskTabButton('data-tab="verifier"', deskTab === 'verifier', 'Verifier') : '') +
    // ON EVERY TAB, WHERE MUSINGS STOOD (goal/G9.8). Andy: "The [Start/End design] buttons should be displayed always,
    // not only when the team tab is active, and it should be placed right after the [Musings] tab header". Still its
    // own colour, so it looms (Andy, earlier: "so it loooms over the proceedings").
    // ITS COLOUR IS shell.css's, AND ONLY WHILE UNARMED (goal/G41.9, box v3: armed is red): an inline colour won over the
    // shell's armed red.
    '<button type="button" id="desk-end-design" class="desk-design-end"' + (design ? '' : ' hidden') + '>End design mode</button>' +
    // Its twin, in the same spot while design mode is off.
    '<button type="button" id="desk-start-design" class="desk-design-start"' + (!design ? '' : ' hidden') + '>Start design mode</button>' +
    deskBubblesHtml();
  // NEITHER BY ACCIDENT (desk/G1.12): each an armingButton, made again after each draw.
  deskArming(document.getElementById('desk-end-design'), 'End design mode: sure?', deskEndDesign);
  deskArming(document.getElementById('desk-start-design'), 'Start design mode: sure?', deskStartDesign);
}

// THE AGENT TABS INSIDE TEAM STOOD HERE (desk/G1 D2, goal/G2.4) and went with goal/G3.12: one tab per agent, a
// channel between Andy and that agent alone, drawn from packets of the agents app. The working blink moved to the
// bubbles above; the direct line has no place on the page any more.

// ── THE LIST, AS THE DESK SERVER SAYS IT (desk/G2.6) ──────────────────
//
//   Andy: "The server determines all the content to be drawn. buttons, the
//   text in the one text box, the status of items, the title of items etc.
//   the UI's inputs will first go to the server, and only when the server
//   has changed it's data/state will the UI be able to get the updated
//   content to draw, from the server." And: "no pulling".
//
// The List asks items.search once when it opens and again only when the
// search or a toggle changes, or a new session is published. Everything else
// arrives as the desk server's published change and replaces its row. It
// decides nothing: which buttons a row has, its status, whether it waits on
// Andy, all come in the label.
function deskGoalRow() {
  return deskHeld().filter(function (r) { return r && r.goal === ''; })[0] || null;
}
// The agents the server holds as working (goal/G2.3): the goal row's working, live agents only.
function deskWorkingAgents() {
  var g = deskGoalRow();
  return g && Array.isArray(g.working) ? g.working : [];
}
function deskWaitingOnAndy() {
  var g = deskGoalRow();
  return g ? Number(g.waiting) || 0 : 0;
}
function deskDesignOn() {
  var g = deskGoalRow();
  return !!(g && g.design);
}
// THE PROBABILITY SEARCH FRAMEWORK ON THE LIST (goal/G40.12; Andy: "ALL desk clients need to cache search results, the
// same."): the rows the page holds are its cache, kept by id. With no words the desk's answer is the List as the toggles
// have it; with words the answer only adds to the cache, and what is drawn is the cache ranked against the words as
// they stand now (the List, deskMountList). One call on the wire at a time: words typed while one is out ask once more
// after it.
var deskSearching = false;
var deskSearchAgain = false;
// THE CURRENT GOAL AT OPEN (goal/G43.3; Andy, the box: "[Current Goal only] is the only filter On by default, and it MUST
// show the current goal when the page opens."): the stream's push names it, and it may not have come yet, or at all; the
// answer to the first search asked for the current goal names it too, so the List does not wait for the stream.
var deskSearchedGoal = '';
function deskCurrentGoal() {
  var K = deskKept();
  return (K && K.current()) || deskSearchedGoal;
}
function deskSearchItems() {
  if (deskSearching) { deskSearchAgain = true; return Promise.resolve(); }
  deskSearching = true;
  var text = String(deskFilter.text || '');
  var forCurrent = deskFilter.currentGoalOnly && !deskFilter.goalsOnly && !text;
  var done = function () {
    deskSearching = false;
    if (deskSearchAgain) { deskSearchAgain = false; deskSearchItems(); }
  };
  return deskAsk('items.search', { text: text, currentGoalOnly: deskFilter.currentGoalOnly, goalsOnly: deskFilter.goalsOnly, includeClosed: deskFilter.includeClosed })
    .then(function (r) {
      // The answer seated in the desk's branch of spirit.data, beside what is there: nothing held is dropped.
      var D = window.spirit && window.spirit.data;
      var K = deskKept();
      if (forCurrent) ((r && r.items) || []).forEach(function (it) { try { var row = JSON.parse(it.label); if (row.goal === '' && !deskSearchedGoal) deskSearchedGoal = row.id; } catch (e) { /* not a row */ } });
      if (D && K && typeof D.seatRows === 'function') D.seatRows(K.branch, (r && r.items) || []);
      deskDraw();
      // The List may have drawn its own answer before this one named the goal.
      if (deskList) deskList.redraw();
      done();
    }, function (e) { done(); deskWriteError('read its list')(e); });
}
// A published row: {change, verb, item: <facts>, listed, key} (goal/G33.4: one publish per row). A new session
// asks again, since it adds and drops whole rows. A row the List does not hold
// is drawn from the publish since goal/G24.6 (below); only while text is in the
// search box does it still ask again.
// A MISSED PUBLISH IS NOTICED (desk/G3.10): every publish goes out since fileTransfer goal/G1.4, but one can still
// go unseen here (an oversize drop notice, a stream reconnect); a change number that skips one means exactly that,
// and the List asks once.
var deskLastChange = 0;
var deskSearchedAt = -1;
// THE NEWEST CHANGE SEEN, PER ROW (goal/G33.8, box v11): an older version of a row never paints over a newer one, and an
// earlier write's rows still land when a later write's overtook them.
var deskRowChange = {};
function deskRowKeyOf(obj) {
  if (!obj.table) { var it = obj.item; if (typeof it === 'string') { try { it = JSON.parse(it); } catch (e) { it = null; } } return 'item|' + String((it && it.id) || ''); }
  var r = obj.row || {};
  var own = obj.removed ? String(obj.at || '') : obj.table === 'checks' ? String(r.number || '') : obj.table === 'chat' ? String(r.at || '') + '|' + String(r.by || '')
    : obj.table === 'files' ? String(r.by || '') + '|' + String(r.path || '') : obj.table === 'claims' ? String(r.by || '') : obj.table === 'suites' ? String(r.path || '') : '';
  return obj.table + '|' + String(obj.id || '') + '|' + own;
}
function deskOnPublished(obj) {
  if (!obj || typeof obj !== 'object') return;
  // What is kept of the current goal takes every publish first (goal/G33.3).
  if (typeof window !== 'undefined' && window.spirit && ((window.spirit.data || {}).desk || {}).data) window.spirit.data.desk.data.published(obj);
  // A RULE CHANGED (goal/G6.5): the desk server publishes {rule: key}; the Rules tab, if shown, asks again.
  // goal/G27.9 (S1): the rule's row travels with it, so the list takes it without asking again; the rule list's own
  // element repaints it. A search typed in the Rules box still asks, since the server ranks by text.
  if (obj.rule && !obj.item && !obj.verb) {
    if (deskRulesList) deskRulesList.refresh();
    return;
  }
  // AN UPDATE TOO LARGE TO PUBLISH was dropped, and said: ask again for what is shown.
  if (obj.dropped) { deskSearchItems(); return; }
  var change = Number(obj.change) || 0;
  // AN OLDER UPDATE CHANGES NOTHING (goal/G2.1 note 7). Andy: "let desk worry about its problems": publishes
  // travel as their own requests and can overtake each other; a row is never painted over by what came before.
  var rowKey = deskRowKeyOf(obj);
  if (change && deskRowChange[rowKey] && change < deskRowChange[rowKey]) return;
  if (change) deskRowChange[rowKey] = change;
  // THE BACKUP LINE FOLLOWS THE RECORD (the stale-backup-line finding): read again once per write the desk made, since
  // the backup copies desk.db after a change. Until goal/G33.4 it followed the page's own log line.
  if (change && change > deskLastChange) deskAskBackup();
  if (change > deskLastChange) deskLastChange = change;
  // EACH ROW ON ITS OWN (goal/G33.4): a side row of an item ({table, id, row}) is no List row; it is the dialog's and
  // the kept items' (the desk family's data.js).
  if (obj.table) return;
  // A session's rows each come as their own publish (goal/G33.4): the List asks again once for the write. A jump in
  // change numbers is no gap (goal/G41.2), so it no longer searches the List again.
  if (obj.verb === 'session.set') { if (deskSearchedAt !== change || !change) { deskSearchedAt = change; deskSearchItems(); } return; }
  // ITS ONE ROW (goal/G33.4: every row a write changed is its own publish).
  var it = obj.item;
  if (typeof it === 'string') { try { it = JSON.parse(it); } catch (e) { it = null; } }
  if (!it || !it.id) return;
  // THE LIST TAKES ADDITIONS FROM THE STREAM (goal/G24.6). Andy: "no pulling". The row is the cache manager's to keep
  // (its translator writes it into the desk's branch as the publish arrives); the List, a view of that branch, draws it
  // where the toggles and the goal's order put it (deskHeld). Nothing is placed here by hand.
  // ONE ROW CHANGED, ONE ROW REPAINTED (goal/G27.9, B; on the probability search since goal/G40.12): the List takes the
  // rows the store now holds, and a row that stays is repainted by its own element, the cells that changed alone. What
  // sits outside the List and reads the rows (the tabs' count, Go-All) is redrawn too.
  if (!deskList) { deskDraw(); return; }
  deskList.redraw();
  deskDrawTabs();
  deskDrawGoAll();
}

// ── THE ELEMENTS THAT CARRY THEIR STREAM (goal/G27.9) ─────────────────
//
//   Desk rule 8 (Andy): "Shell and application elements, should bring their subscriptions with them, so that they're
//   automatically subscribed to the events that update them." Andy, 2026-10-17, on the shared parts: the app loads
//   them itself at mount: "it is ok for apps to know about other apps and their shared elements. i like this solution."
//   Once per page: a second app finds each there. The team chat's element went with goal/G43.22.
// THE DESK'S TRANSLATOR (goal/G33.3): spirit.data keeps the current goal for this page and the item dialog, as
// deskClient keeps it in node; loaded once by the app. Since goal/G41.24 it is the desk
// family's data.js, from the node that served this page.
var DESK_DATA = '/process/js/desk/data.js';
// The verifier's cache manager, its own family's (goal/G41.28).
var DESK_VERIFY_DATA = '/process/js/deskVerify/data.js';
// EVERY PART THROUGH THE ONE LOADER (goal/G41.11; rule/21: "always look for existing code", and Andy, on the add-rule
// dropdown that sometimes never appeared: "FIX IT"): spirit.require, never a script tag of its own. It loads a part once
// for the page and answers when it has run.
function deskNeed(p) {
  var req = typeof window !== 'undefined' && window.spirit && window.spirit.require;
  if (typeof req !== 'function') return Promise.reject(new Error('no spirit.require on this page'));
  return Promise.resolve(req.call(window.spirit, String(p).replace(/^\/+/, '')));
}
// AN ICON THAT STANDS ALONE IS THE ICON ELEMENT (goal/G41.23; Andy: "this element will replace icons painting all shell
// elements and apps.", and "isn't a glyph inside flowing text just like another inline character? ... they don't need
// special handling"): the row's type, the sword, a rule's status. Written as a placeholder holding its glyph, so the
// markup is never empty; once spirit/element/icon.js is on the page each one in the container is made the icon element
// (deskPaintIcons, watching the container). A glyph among words stays text.
// Its own escape: the sword is made as the file loads, before deskApi is there.
function deskGlyph(glyph, title) {
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  return '<span data-icon="' + esc(glyph) + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + esc(glyph) + '</span>';
}
var deskIconReady = null;
function deskPaintIcons(root) {
  var I = typeof window !== 'undefined' && window.spirit && window.spirit.element && window.spirit.element.icon;
  if (!I || !root || typeof root.querySelectorAll !== 'function') return;
  Array.prototype.forEach.call(root.querySelectorAll('[data-icon]'), function (p) {
    if (p.querySelector('.shell-icon')) return;
    p.textContent = '';
    I.create(p, { glyph: p.getAttribute('data-icon') });
  });
}
function deskWatchIcons(root) {
  if (!deskIconReady) deskIconReady = deskNeed('/spirit/element/icon.js').then(null, function () { /* the glyphs stay text */ });
  deskIconReady.then(function () { deskPaintIcons(root); });
  if (typeof MutationObserver === 'function' && root) new MutationObserver(function () { deskPaintIcons(root); }).observe(root, { childList: true, subtree: true });
}
function deskLoadData() {
  if (typeof window === 'undefined' || (window.spirit && ((window.spirit.data || {}).desk || {}).data)) return;
  deskNeed(DESK_DATA);
}
// Everything kept of whole items is forgotten after a gap: what was published while the stream was down was never heard.
function deskForgetKept() {
  // Asked of the cache's manager (goal/G41.28): it names its branches, this page does not.
  var K = typeof window !== 'undefined' && window.spirit && ((window.spirit.data || {}).desk || {}).data;
  if (K && typeof K.forgetAll === 'function') K.forgetAll();
}
// THE RUN IN THE STATUS COLUMN (goal/G33.6): the shared rendering the dialog uses too, loaded once by the app; a page
// without it draws the status word alone.
var DESK_RUN_STATUS = '/shell/shared/js/deskRunStatus.js';
function deskLoadRunStatus() {
  var have = typeof window !== 'undefined' && window.spirit && window.spirit.elements && window.spirit.elements.deskRunStatus;
  if (typeof have === 'function') return;
  deskNeed(DESK_RUN_STATUS).then(function () { deskDraw(); }, function () { /* the status word alone */ });
}
// The ids a publish changes rows of.
function deskRowIdsOf(obj) {
  if (!obj || typeof obj !== 'object') return [];
  var it = obj.item;
  if (typeof it === 'string') { try { it = JSON.parse(it); } catch (e) { it = null; } }
  return it && it.id ? [it.id] : [];
}
function deskGoalOf(row) { return row.goal === '' ? String(row.id) : String(row.goal); }
// A PRESS IS NOT A LINE. Andy: "a press shouldn't post a line, it is not
// textual information." It goes to the desk server; the row changes when the
// server publishes. THE PAGE NUDGES NOBODY (goal/G3.8): the desk server nudges
// each agent's deskClient itself on his writes (goal/G3.5), so the tiny
// 'changed' packet the page posted to every live agent after a press is gone,
// with the agents app it was addressed to.
function deskPress(id, what) {
  // No by since apiAuth/G1.13: the press is the owner's because it comes
  // through the owner's door, and desk reads that from the caller.
  return deskAsk('press', { id: id, what: what }).then(function () { /* the server publishes, and nudges */ },
    function (e) { deskError = 'Not pressed: ' + ((e && e.message) || e); deskDraw(); });
}

var DESK_PRESS_LABEL = { go: 'Go!', done: 'Done', close: 'Close', 'bring-back': 'Bring back', verify: 'Verify' };
// DONE, NOT VERIFIED GREEN, CARRIES A WARNING MARK AND ARMS HERE (goal/G33.3), as the item dialog does, from the same
// facts (verified, verifyFailures). The box: "the first press arms it and says why, the second sends Done ... Verified
// green, one press does it. The desk keeps no arming." '' where no deskVerify answers: no mark.
var DESK_WARN = '\u26a0';
function deskWarnOnDone(row) { return row.verified === 'red' || row.verified === 'none'; }
function deskWarnWhy(row) {
  return row.verified === 'red' ? 'not verified, red: ' + (row.verifyFailures || []).join(' | ') : 'not verified: no run of its suites yet';
}
// NOT IN A ROW: Go all sits in the tab bar (desk/G3.4), and Reopen only in the item's dialog (desk/G3.6, Andy:
// "the Re-Open button should never be shown in the list").
// MAKE CURRENT IS NOT IN THE ROW, THE SWORD IS (goal/G9.1). Andy, 2026-10-07: "the [make-current] button will not be
// displayed in the List, only in the goals Details. in the list, an item that has a [make-current] button, the item
// will be marked with an ICON.SWORD (⚔️), indicating: \"There is a battle to be fought\"." His decision: the press
// itself stays in the goal's Details (deskDetails), and the row only says there is one to make.
// DELETE IS NEVER IN THE ROW (goal/G8.8). Andy, 2026-10-09: "oh, and the Delete button never should show in the
// list. only in the detals." It was drawn in every row of a goal in design mode until then, which was G9.7's miss.
// goal/G33.4: an item's own End design is its Details' alone.
var DESK_NOT_IN_ROW = ['go-all', 'reopen', 'make-current', 'delete', 'end-design'];
var DESK_SWORD = deskGlyph('⚔️', 'There is a battle to be fought: make it the current goal in its Details');
// CLOSE BEFORE HIS GO IS THE DIALOG'S ALONE (goal/G3.9). Andy, 2026-10-03: "the close-with arm is only visible on
// the item detail". A done row keeps its Close as before.
// THE GOAL ROW KEEPS ITS CLOSE (goal/G6.6): the goal's Close appears in the List too. It shows only once nothing under
// the goal is open (deskNextPress), so it presses at once (goal/G41.9): an are-you-sure there could never fire.
function deskInRow(row, what) {
  if (DESK_NOT_IN_ROW.indexOf(what) !== -1) return false;
  if (what === 'close' && row.status !== 'done' && !(row.goal === '')) return false;
  return true;
}
// ONE BUTTON IN A ROW, THE NEXT ONE WANTED (goal/G33.6). Andy: "the main list may only show one single button, and it
// is the button for the next wanted user-action, so verify button for any done button, a done button before any close
// button. the detail shows all available buttons.", "and go before done etc....", and "just in the list, a goal offers
// no done or closed while items are not done or closed, the goal offers those only in the detail panel anytime". The
// buttons offered are the item's facts, one shared state with the dialog; the row only picks the first of them in this
// order of steps, the rest after them in the item's own order.
var DESK_STEP_ORDER = ['go', 'verify', 'done', 'close'];
function deskNextPress(row) {
  var goal = row.goal === '';
  var offered = (row.buttons || []).filter(function (what) {
    if (!deskInRow(row, what)) return false;
    // A goal's Done and Close wait in the List until its items are done or closed (blocked: those still open).
    if (goal && (what === 'done' || what === 'close') && (row.blocked || []).length) return false;
    return true;
  });
  var stepped = DESK_STEP_ORDER.filter(function (w) { return offered.indexOf(w) !== -1; });
  return stepped.length ? stepped[0] : (offered[0] || '');
}
function deskRowPresses(row) {
  var next = deskNextPress(row);
  return (next ? [next] : []).map(function (what) {
    var label = DESK_PRESS_LABEL[what] || what;
    var title = '';
    // goal/G33.3: Done not verified green: the mark, and once armed the why in its own words. data-arming is what its
    // armingButton says armed (deskArmRow).
    var arming = '';
    if (what === 'done' && deskWarnOnDone(row)) {
      title = deskWarnWhy(row);
      label = 'Done ' + DESK_WARN;
      arming = 'Done anyway? ' + title;
    }
    // goal/G33.6: no Verify shows the verifier's busy state (Andy: "please don't show verifier-busy an any verify
    // button, i can check that for myself").
    // data-action: the List (probabilitySearch) leaves a press inside a row to its owner, this page, and opens nothing.
    return '<button type="button" data-action="press" data-press="' + deskEsc(what) + '" data-id="' + deskEsc(row.id) + '"' +
      (arming ? ' data-arming="' + deskEsc(arming) + '"' : '') + (title ? ' title="' + deskEsc(title) + '"' : '') + '>' + deskEsc(label) + '</button>';
  }).join(' ');
}
// THE CELLS OF A ROW, each its own part, so the row's own element paints and repaints them one by one (goal/G27.9;
// since goal/G40.12 the List is the probability search, and a row is its row element, deskListElement).
var DESK_LIST_FIELDS = ['mark', 'type', 'todo', 'with', 'yours', 'blocks', 'waits', 'status'];
// THE GOAL ROW STANDS OUT (goal/G33.8, box v12; Andy: "it's really hard to tell the goal from it's items in the list"):
// its icon cell holds the goal sign, and its to-do cell is bold (the row tag is the element's since goal/G40.12).
function deskRowCellParts(row) {
  var parts = deskRowCells(row).replace(/^<td[^>]*>/, '').replace(/<\/td>$/, '').split(/<\/td><td[^>]*>/);
  if (row && row.goal === '' && parts[2] !== undefined) parts[2] = '<b>' + parts[2] + '</b>';
  return parts;
}
function deskRowCells(row, presses) {
  var goal = row.goal === '';
  if (presses === undefined) presses = deskRowPresses(row);
  return (
    // THE BROUGHT-BACK MARK, THEN THE TYPE (desk/G1.12): the server says both. ICON.ERROR EXACTLY WHILE SOMETHING
    // WAITS ON HIM (goal/G4.20 points 10-11). Andy: "if those two things would match at all times, id know exactly
    // where i need to navigate to."
    '<td>' + ((row.buttons || []).indexOf('make-current') !== -1 ? DESK_SWORD : '') + '</td>' +
    '<td>' + (goal ? deskGlyph('📁', 'a goal') : deskGlyph(Number(row.asks) > 0 ? '❌' : '💻')) + '</td>' +
    '<td title="' + deskEsc(row.title) + '">' + deskEsc(row.title) + ' <span class="job-manifest-note">(' + deskEsc(row.id) + ')</span>' + (row.alert ? ' ' + DESK_ALERT : '') + '</td>' +
    '<td>' + deskEsc(row.with ? deskNameOf(row.with, row) : '') + '</td>' +
    '<td>' + presses + '</td>' +
    // NO LINK TO ITS OWN GOAL (goal/G33.8, box v12): his Done meant for goal/G33.8 went to goal/G33, opened from such a
    // link; an item's row names what else it blocks, never the goal it belongs to.
    '<td>' + deskLinks((row.blocking || []).filter(function (b) { return goal || b !== row.goal; })) + '</td>' +
    '<td>' + deskLinks(row.blocked) + '</td>' +
    '<td style="width:16em">' + deskStatusCell(row) + '</td>');
}
// THE STATUS BOX (goal/G18.5, back with goal/G33.6): while the verifier runs this item, its run; otherwise the server's
// status word, green when it says passed, red when rejected or red. Andy: "why do i no longer see the verifier run in
// the items status column?" deskVerify knows no item, so the row joins the desk's fact (verifyRunning) with the
// verifier's own publish (deskVerifyRun), through the one rendering the dialog uses too (shell/shared/js/deskRunStatus.js).
function deskStatusCell(row) {
  var els = typeof window !== 'undefined' && window.spirit && window.spirit.elements;
  var run = els && typeof els.deskRunStatus === 'function' ? els.deskRunStatus(row, deskVerifyRun, deskEsc) : '';
  if (run) return run;
  var word = String(row.status || '');
  // A FILE THE AGENT'S CHECKOUT CHANGED (goal/G33.11), by its statusTone: red a test file, white a production file.
  var tone = String(row.statusTone || '');
  var colour = tone === 'test' ? '#c00' : tone === 'code' ? '#fff'
    : /passed/i.test(word) ? '#1a7f37' : /rejected|\bred\b|failed/i.test(word) ? '#c00' : '';
  return colour ? '<span style="color:' + colour + '">' + deskEsc(word) + '</span>' : deskEsc(word);
}
// The toggles say how they stand; the server does the filtering.
// The toggles are the List's own filters (deskMountList); what follows them here is the Add Goal bubble.
function deskDrawToggles() {
  var add = document.getElementById('desk-add-goal');
  if (add) add.hidden = !deskFilter.goalsOnly;
}
// goal.add, then his make-current on the id the desk answered: an add never moves the current goal (goal/G9.13),
// and the goal he adds by hand becomes current (goal/G9.11), so the bubble does what he would do by hand.
function deskAddGoal() {
  var input = document.getElementById('desk-goal-title');
  var title = String((input && input.value) || '').trim();
  if (!title) return Promise.resolve();
  return deskAsk('goal.add', { title: title }).then(function (r) {
    if (!r || !r.id) return;
    input.value = '';
    return deskPress(r.id, 'make-current');
  }, function (e) { deskError = 'Goal not added: ' + ((e && e.message) || e); deskDraw(); });
}
// ── THE LIST, ON THE PROBABILITY SEARCH (goal/G40.12) ─────────────────
//
// The element in its pane face (spirit/element/search.js): the search box, the filters in the row above it, its
// one call on the wire. IT IS A VIEW OF THE DESK'S BRANCH OF spirit.data (goal/G41.28), the cache manager's (its data
// option, deskKept().branch), which every publish keeps current; items.search's answers to the words are seated in it. Each row is a row element
// (spirit/element/rowElement.js) painting the List's cells (deskRowCellParts); a publish redraws the list, and a row's element
// repaints the cells that changed. A press in a row is the page's (data-press), a press on the row opens it.
//
// THE TOGGLES (goal/G9.2, goal/G4.20 point 1): Current Goal Only, on when Desk opens (a multi filter: on until pressed
// off), Goals Only and Include Closed, off (toggles). Exclusive as before (Andy: "only one of the two buttons ... may be
// selected at the same time"): Goals Only on means every goal's.
var deskList = null;
var deskListIndex = null;
function deskListElement(row, key) {
  var E = window.spirit.element;
  deskListIndex = deskListIndex || E.rowElement.index(function () { /* a publish redraws the list; each element applies its row */ });
  var el = E.rowElement.create({
    kind: 'deskRow', key: key, index: deskListIndex, row: row,
    fields: DESK_LIST_FIELDS.map(function (name, i) { return { name: name, paint: function (r) { return deskRowCellParts(r)[i] || ''; } }; }),
  });
  // goal/G41.9: a press its row draws as an are-you-sure is made an armingButton after each paint of the row.
  var hosts = null;
  var mount = el.mount;
  var apply = el.apply;
  el.mount = function (h) { hosts = h; var out = mount.apply(el, arguments); deskArmRow(hosts); return out; };
  el.apply = function () { var out = apply.apply(el, arguments); deskArmRow(hosts); return out; };
  return el;
}
function deskArmRow(hosts) {
  var cell = hosts && hosts.yours;
  var b = cell && typeof cell.querySelector === 'function' ? cell.querySelector('[data-arming]') : null;
  if (!b) return;
  var id = b.getAttribute('data-id');
  var what = b.getAttribute('data-press');
  deskArming(b, b.getAttribute('data-arming'), function () { deskPress(id, what); });
}
// [CURRENT GOAL ONLY] AND [GOALS ONLY] EXCLUDE EACH OTHER (goal/G43.3; Andy, the box: "MUST be mutually exclusive, both can be
// off, but only one of them can be active at once."): the one he just pressed on wins, and the other's own button is pressed
// off, so what the buttons show is what is asked. The element holds their values; a press is the one way to move them.
var deskFiltersOn = { current: true, goalsOnly: false };
function deskPressFilter(name) {
  setTimeout(function () {
    var b = document.querySelector('#desk-list button[data-filter="' + name + '"]');
    if (b) b.click();
  }, 0);
}
function deskListFilter(values) {
  var v = values || {};
  var goalsOnly = v.goalsOnly === true;
  var current = !(v.current || {}).on;
  if (goalsOnly && current) {
    if (deskFiltersOn.current) { current = false; deskPressFilter('current'); } else { goalsOnly = false; deskPressFilter('goalsOnly'); }
  }
  deskFiltersOn = { current: current, goalsOnly: goalsOnly };
  return { currentGoalOnly: current, goalsOnly: goalsOnly, includeClosed: v.includeClosed === true };
}
function deskMountList() {
  var el = document.getElementById('desk-list');
  if (!el || deskList) return;
  deskLoadSearch(function () {
    // The List is drawn once the cache manager is there, its branch the List's (goal/G41.28).
    deskNeed(DESK_DATA).then(function () {
    var P = window.spirit && window.spirit.element && window.spirit.element.search && window.spirit.element.search.create ? window.spirit.element.search : null;
    var K = deskKept();
    if (!P || typeof P.create !== 'function' || deskList || !K) return;
    deskList = P.create(el, {
      data: K.branch,
      api: deskApi, server: 'desk', verb: 'items.search',
      args: function (text, values) {
        var want = deskListFilter(values);
        var moved = want.currentGoalOnly !== deskFilter.currentGoalOnly || want.goalsOnly !== deskFilter.goalsOnly || want.includeClosed !== deskFilter.includeClosed;
        deskFilter.currentGoalOnly = want.currentGoalOnly; deskFilter.goalsOnly = want.goalsOnly; deskFilter.includeClosed = want.includeClosed;
        // A toggle changed: the rows the page holds are read again for it.
        if (moved) { deskDrawToggles(); deskFilter.text = ''; deskSearchItems(); }
        return { text: text, currentGoalOnly: want.currentGoalOnly, goalsOnly: want.goalsOnly, includeClosed: want.includeClosed };
      },
      columns: [
        { field: 'mark', label: '' }, { field: 'type', label: '' }, { field: 'todo', label: 'to-do' },
        { field: 'with', label: 'with' }, { field: 'yours', label: 'yours' }, { field: 'blocks', label: 'blocks' },
        { field: 'waits', label: 'waits on' }, { field: 'status', label: 'status', width: '16em' },
      ],
      filters: [
        // The branch holds every goal the desk sent (goal/G41.12), so Current Goal Only is decided here: the current goal
        // and its items, unless Goals Only is on (a multi filter, on until pressed off).
        { name: 'current', multi: true, choices: [{ value: 'on', word: 'Current Goal Only' }], test: function (row, v) {
          var only = !(v && v.on) && !deskFilter.goalsOnly;
          return !only || deskGoalOf(row) === deskCurrentGoal() ? 1 : 0;
        } },
        { name: 'goalsOnly', toggle: true, word: 'Goals Only', test: function (row, on) { return !on || row.goal === '' ? 1 : 0; } },
        { name: 'includeClosed', toggle: true, word: 'Include Closed', test: function (row, on) { return on || row.status !== 'closed' ? 1 : 0; } },
      ],
      element: function (row, key) { return deskListElement(row, key); },
      details: function (row, key) { deskOpenRow(String(key)); },
      empty: 'Nothing to show.',
    });
    // ITS FIRST SEARCH IS ASKED NOW (goal/G43.3): the page's own, at mount, came back before the cache manager had loaded,
    // and an answer with nowhere to sit left the List empty until the stream pushed something.
    deskSearchItems();
    deskList.redraw();
    });
  });
}

// The local HH:MM of an arrival time.
function deskTime(at) {
  var d = new Date(at);
  if (isNaN(d.getTime())) return deskEsc(at);
  var two = function (n) { return (n < 10 ? '0' : '') + n; };
  return two(d.getHours()) + ':' + two(d.getMinutes());
}
// Ending design mode is his decision: a press on the goal, which Desk reads back (deskDesignOn) and the agents obey.
// NEITHER BY ACCIDENT (desk/G1.12). Andy: "re-arm both design on and off,
// neither should be an accident." The first press arms the button and asks
// "sure?"; only a second press fires it.
// THE ARE-YOU-SURE IS THE SHELL'S (goal/G41.9; Andy, Q1: "absolutely"): every two-press button on the page is an
// armingButton (spirit/element/armingButton.js), which the page loads itself. It arms, says so, and hands the shell its
// disarm, so it disarms the moment he clicks anywhere else (AGENT.md); a button made one already is left as it is.
var deskParts = Promise.resolve(typeof spirit !== 'undefined' && spirit.require
  ? spirit.require('spirit/element/armingButton.js') : null);
function deskArming(button, armedLabel, run) {
  if (!button) return;
  deskParts.then(function () {
    var A = typeof window !== 'undefined' && window.spirit && window.spirit.element && window.spirit.element.armingButton;
    if (!A || typeof button.armed === 'function') return;
    A.attach(button, { label: button.textContent, armedLabel: armedLabel, run: run, api: deskApi });
  }, function () { /* no armingButton, no second press */ });
}
// GO ALL (desk/G3.4). Andy: "i should have a go-all button for fixing rounds",
// "the go all should be on the right side of the button bar in list", "and be the
// armed-type". Shown while the goal's buttons offer it; the server decides which
// items it goes. Drawn once, at mount, and made an armingButton there.
function deskDrawGoAll() {
  var b = document.getElementById('desk-go-all');
  if (!b) return;
  var g = deskGoalRow();
  b.hidden = !(deskTab === 'list' && g && (g.buttons || []).indexOf('go-all') !== -1);
}
function deskGoAll() { var g = deskGoalRow(); if (g) deskPress(g.id, 'go-all'); }
// A PRESS ON THE GOAL, NOT A LINE (desk/G2.6): design mode is the server's.
function deskEndDesign() { var g = deskGoalRow(); if (g) deskPress(g.id, 'end-design'); }
// With no goal on the List, Start design starts a new one (desk/G3.1): the server names it goal/G<n>.
// A closed goal row (shown at startup, desk/G3.2) is not an open goal: Start design starts a new one.
function deskStartDesign() { var g = deskGoalRow(); deskPress(g && g.status !== 'closed' ? g.id : '', 'start-design'); }
// A ROW OPENS ITS OWN DIALOG. Andy: "we need a DeskDetails immediately,
// with inputs specific to the item" — and the inline thread this replaced
// erased his typing on every arrival ("also my typing gets erased,
// everytime somebody sends something"). The table holds no input, so a
// repaint on arrival costs him nothing.
function deskDraw() {
  deskDrawGoAll();
  var el = document.getElementById('desk-top');
  if (!el) return;
  var backup = document.getElementById('desk-backup');
  if (backup) backup.innerHTML = deskBackupHtml();
  deskDrawTabs();
  var err = document.getElementById('desk-list-error');
  if (err) err.innerHTML = deskError ? '<div class="job-start-error">' + deskEsc(deskError) + '</div>' : '';
  if (deskList) deskList.redraw(); else deskMountList();
}

// ── THE RULES TAB (goal/G6.5) ─────────────────────────────────────────
//
//   The box: "A new tab "Rules" between "Team" and "Musings": 1. The new bubble: type, label, text and a new button:
//   rule.add (the rule comes in proposed; agents may add one too). 2. The search bubble: a search box and 7 toggles
//   (ui, code, design, desk, test; proposed, active, deleted): rules.search {text, types, statuses}. 3. The list, a row per
//   rule: status (proposed ICON.EDIT, active ICON.LOCK, deleted ICON.DEAD), label, type, key; a row opens ruleDetails
//   (goal/G6.4)."
//
// THE PROBABILITY SEARCH (goal/G40.12, box v7, first set 3: "all searches in desk are of the new probability variety"):
// the list is spirit/element/search.js over rules.search, ranking as he types with the matched words marked, a type
// filter and a status filter beside the words; a row opens ruleDetails. A rule's publish asks it again.
// The test type since goal/G40.12 (box v7, first set 4), as the desk server's RULE_TYPES.
var DESK_RULE_TYPES = ['ui', 'code', 'design', 'desk', 'test'];
var DESK_RULE_STATUSES = ['proposed', 'active', 'deleted'];
var DESK_RULE_ICON = { proposed: '✏️', active: '🔒', deleted: '💀' };
var deskRulesNote = '';
var deskRulesList = null;
var DESK_SEARCH = '/spirit/element/search.js';
function deskRulesSearch() {
  if (deskRulesList) { deskRulesList.refresh(); return; }
  var el = document.getElementById('desk-rule-list');
  if (!el) return;
  var make = function () {
    var P = window.spirit && window.spirit.element && window.spirit.element.search && window.spirit.element.search.create ? window.spirit.element.search : null;
    var K = deskKept();
    if (!P || typeof P.create !== 'function' || deskRulesList || !K) return;
    // THE TOGGLES OF THE RULES LIST, as they always were (goal/G6.5): a button per type and per status, each on until he
    // presses it off (probabilitySearch's multi filter, which keeps the ones pressed off); all on asks every rule.
    var choices = function (values) { return values.map(function (v) { return { value: v, word: v }; }); };
    var kept = function (all, off) { var on = all.filter(function (v) { return !(off || {})[v]; }); return on.length === all.length ? [] : on; };
    deskRulesList = P.create(el, {
      // A VIEW OF THE RULES THE CACHE MANAGER KEEPS (goal/G41.28): every rule the push brought and every answer, seated.
      data: K.rulesBranch,
      api: deskApi, server: 'desk', verb: 'rules.search',
      args: function (text, values) {
        var v = values || {};
        return { text: text, types: kept(DESK_RULE_TYPES, v.type), statuses: kept(DESK_RULE_STATUSES, v.status) };
      },
      // A RULE ROW IS A ROW ELEMENT (spirit/element/rowElement.js, the element's own element(row, key)): it paints its status as
      // its icon, as the Rules list always drew it (proposed ICON.EDIT, active ICON.LOCK, deleted ICON.DEAD), and its key.
      columns: [{ field: 'status', label: '', sort: 'text' }, { field: 'label', label: 'Label', sort: 'text' },
        { field: 'type', label: 'Type', sort: 'text' }, { field: 'key', label: 'Key' }],
      element: function (row, key) { return deskRuleElement(row, key); },
      filters: [
        { name: 'type', multi: true, choices: choices(DESK_RULE_TYPES), test: function (row, off) { return (off || {})[row.type] ? 0 : 1; } },
        { name: 'status', multi: true, choices: choices(DESK_RULE_STATUSES), test: function (row, off) { return (off || {})[row.status] ? 0 : 1; } },
      ],
      details: function (row, key) { deskOpenRule(key); },
      empty: 'No rule matches.',
    });
    deskRulesList.refresh();
  };
  deskLoadSearch(function () { deskNeed(DESK_DATA).then(make); });
}
// One rule row's element: its four cells, the status drawn as its icon.
var deskRuleIndex = null;
function deskRuleElement(row, key) {
  var E = window.spirit.element;
  deskRuleIndex = deskRuleIndex || E.rowElement.index(function () { /* the list asks again on a rule's publish */ });
  return E.rowElement.create({
    kind: 'rule', key: key, index: deskRuleIndex,
    row: { status: String((row && row.status) || ''), label: String((row && row.label) || ''), type: String((row && row.type) || ''), key: String(key) },
    fields: [
      { name: 'status', paint: function (v) { return DESK_RULE_ICON[v.status] ? deskGlyph(DESK_RULE_ICON[v.status], v.status) : '<span title="' + deskEsc(v.status) + '"></span>'; } },
      { name: 'label', paint: function (v) { return deskEsc(v.label); } },
      { name: 'type', paint: function (v) { return deskEsc(v.type); } },
      { name: 'key', paint: function (v) { return deskEsc(v.key); } },
    ],
  });
}
// probabilitySearch.js and the rowElement it draws rule rows with, through the one loader (it loads each once).
var DESK_ROW_ELEMENT = '/spirit/element/rowElement.js';
function deskLoadSearch(done) {
  Promise.all([deskNeed(DESK_ROW_ELEMENT), deskNeed(DESK_SEARCH)]).then(function () { done(); }, function () { /* no search on this page */ });
}
function deskDrawRules() {
  var note = document.getElementById('desk-rule-error');
  if (note) note.textContent = deskRulesNote;
}
// The text as he typed it: a rule is a paragraph with its line breaks (goal/G5.5); the server normalizes and limits it.
function deskRuleAdd() {
  var val = function (id) { var el = document.getElementById(id); return el ? String(el.value || '') : ''; };
  var type = val('desk-rule-type');
  var label = val('desk-rule-label');
  var text = val('desk-rule-text');
  if (!label.trim() || !text.trim()) { deskRulesNote = 'A rule needs a label and a text.'; deskDrawRules(); return; }
  var autoBox = document.getElementById('desk-rule-auto');
  deskAsk('rule.add', { type: type, label: label, text: text, autoAttach: !!(autoBox && autoBox.checked) }).then(function () {
    ['desk-rule-label', 'desk-rule-text'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
    if (autoBox) autoBox.checked = false;
    deskRulesNote = '';
    deskRulesSearch();
  }, function (e) { deskRulesNote = 'Not added: ' + e.message; deskDrawRules(); });
}
function deskOpenRule(key) { deskApi.callDialog('shell/ruleDetails', { key: key }).then(function () { deskRulesSearch(); }, function () {}); }

// ONE ROW'S DIALOG, from the List.
function deskOpenRow(id) {
  // THE DIALOG ASKS THE DESK SERVER ITSELF (desk/G2.7): Desk hands it the id.
  // It presses seen and writes its own chat, and nudges nobody (goal/G3.8).
  deskApi.callDialog('shell/deskDetails', { id: id })
    .then(function (result) {
      // A line in its Blocked by / Blocking lists was clicked: go there.
      if (result && result.open) deskOpenRow(result.open);
    });
}

// ── READING WHAT IS SHOWN, AND NO MORE (desk/G1.4, O9) ─────────────
//
//   Andy: "desk loads down the dependency tree ... it skips closed items",
//   "the list only loads key/title, and the rest lazy loads".
//
// The List is items.search's answer (deskSearchItems); an item's chat is its dialog's.
var deskLoaded = false;
function deskLoad() {
  var reads = [
    deskAskBackup(),
  ];
  return Promise.all(reads.map(function (p) { return p.catch(function (e) { deskError = 'Desk could not read: ' + ((e && e.message) || e); }); }))
    .then(function () {
      deskLoaded = true;
      deskDraw();
    });
}
// AN AGENT'S QUEUE IN ITS TAB STOOD HERE (desk/G1.5 D1, pending.get) and went with the agent tabs (goal/G3.12):
// with no tab per agent there is no place that shows one agent's queue. His own queue is still the List.

// ── THE BACKUP, SEEN FROM DESK (desk/G1.7, T7) ───────────────────────
//
//   Andy: "how can i trust the copy mechanist when i cant see it working".
// The backup server's status.get: its last check and last copy, marked red
// when something was closed after the last check. Kept by the backup family's
// cache manager (goal/G41.28), spirit.data.backup.data; the line follows its watch.
var DESK_BACKUP_DATA = '/process/js/backup/data.js';
var deskBackupWatched = null;
function deskBackupPaint() {
  // Its own line alone once the page is drawn (goal/G27.9: one change, one element repainted).
  var el = typeof document !== 'undefined' && document.getElementById ? document.getElementById('desk-backup') : null;
  if (el && deskLoaded) el.innerHTML = deskBackupHtml(); else deskDraw();
}
function deskAskBackup() {
  return deskNeed(DESK_BACKUP_DATA).then(function () {
    var B = ((window.spirit.data || {}).backup || {}).data;
    if (!deskBackupWatched) deskBackupWatched = B.watch(deskBackupPaint);
    return Promise.resolve(deskApi.verb('backup.status.get', {})).then(function (r) {
      B.keep(r && r.status === 200 ? r.body : null);
    }, function () { B.keep(null); });
  });
}
function deskBackupHtml() {
  var B = typeof window !== 'undefined' && window.spirit && ((window.spirit.data || {}).backup || {}).data;
  var deskBackup = B ? B.status() : null;
  if (!deskBackup) return '';
  var stale = false;
  return '<div class="' + (stale ? 'job-start-error' : 'job-manifest-note') + '">Backup: last check ' +
    (deskBackup.lastCheck ? deskTime(deskBackup.lastCheck) : 'never') + ', last copy ' +
    (deskBackup.lastCopy ? deskTime(deskBackup.lastCopy) : 'never') +
    (stale ? '; something was closed since the last check' : '') + '</div>';
}

// ── THE VERIFIER TAB (goal/G8.11) ────────────────────────────────────
//
//   Andy, 2026-10-09: "shouldn't i have, if the desk verifier is mounted
//   and running, a verifier tab in desk, right after [musings], that
//   allows me to monitor a) status and progress of the running verifier,
//   and if/when necessary, allow intervention?", then "add it".
//
// Drawn only where a deskVerify answers, as backup's status is: on a node
// without one the tab is not there at all. SINCE goal/G33.3 it shows only
// what runs now (the suite, since when), its console, and Stop (the box:
// "The Verifier tab shows only what runs now, its console, and Stop."). A
// run is started from the item: his Verify button there, or the desk itself.
var deskVerifier = null;
// THE RE-VERIFY'S ANSWER (goal/G18.10). Andy: "verify, when idling, does not react to my attempts of pushing it's
// re-verify button." The desk refused it and the page swallowed the refusal; now its outcome is said in the tab.
var deskVerifyNote = '';
function deskVerifyAsk(verb, args) {
  return Promise.resolve(deskApi.verb('deskVerify.' + verb, args || {})).then(function (r) {
    // A refusal says why where deskVerify gave one (Chores now, goal/G33.11).
    if (!r || r.status !== 200 || !r.body || r.body.ok === false) throw new Error((r && r.body && r.body.extra && r.body.extra.why) || 'deskVerify did not answer');
    return r.body;
  });
}
// Asked once at mount and on every open of the tab: a node either runs one or does not.
// THE TAB STAYS (goal/G21.3). Andy's box: "The Verifier tab stays once the page has loaded; only the first ask at load
// decides whether a verifier runs here. A later missed answer keeps the tab and shows "not answering"." Any failed ask
// set deskVerifier to null and redrew the tabs, so one slow answer made the tab vanish under him. Now a failed ask
// changes nothing while a verifier is known; it only marks it not answering until the next answer.
var deskVerifyMissed = false;
var DESK_STOP_NOTE = 'deskVerify answered: stop asked;';
function deskAskVerifier() {
  return deskVerifyAsk('now', {}).then(function (body) {
    deskVerifier = body;
    deskVerifyMissed = false;
    deskDrawTabs();
    deskDrawVerifier();
  }, function () {
    // THE TAB OPENS AT ANY TIME (goal/G40.13, box v22, point 10): a first ask that finds the verifier busy with a run still
    // draws the tab, saying it did not answer; its next publish fills it in.
    if (!deskVerifier) { deskVerifier = { running: { suite: '', since: '' } }; deskDrawTabs(); }
    deskVerifyMissed = true;
    deskDrawVerifier();
  });
}
// EVERY PRESS SAYS IT WAS SENT, THEN WHAT CAME BACK (goal/G21.3). Andy's box: "Every press in the tab shows at once
// that it was sent, then what deskVerify answered." The note is drawn before the ask goes out and replaced by the answer.
function deskVerifyPressed(sent) {
  deskVerifyNote = sent;
  deskDrawVerifier();
}
function deskVerifyAnswered(text) {
  deskVerifyNote = text;
  deskDrawVerifier();
}
// goal/G8.12: opening the tab reads what runs; the records list it used to fetch is gone with Andy's "only show the
// latest status", so nothing here asks for rows any more.
function deskVerifyRefresh() {
  deskVerifyTail();
  return deskAskVerifier();
}
// ── THE CONSOLE (goal/G22.3) ──────────────────────────────────────────
//
//   Andy, 2026-10-13: "it be even better if the verify tab showed the detailed results in a console like fashion,
//   cleared before every new run."
//
// DECIDED BY ANDY: the tab shows the current run's output as deskVerify keeps it, cleared when a new run starts. Every
// object deskVerify publishes carries consoleRun and consoleTo; when the run is new the text here is cleared, and while
// consoleTo is past what is held here the rest is asked with `console {from}`, one answer at a time, never on a clock.
// Kept here to DESK_CONSOLE_MAX characters, the front dropped, as deskVerify drops its own.
var DESK_CONSOLE_MAX = 262144;
var deskVerifyCon = { run: '', text: '', to: 0, asking: false, want: 0 };
function deskVerifyTail() {
  if (deskVerifyCon.asking) return;
  deskVerifyCon.asking = true;
  var askedRun = deskVerifyCon.run;
  var askedFrom = deskVerifyCon.to;
  deskVerifyAsk('console', { from: askedFrom }).then(function (b) {
    deskVerifyCon.asking = false;
    if (!b || typeof b.text !== 'string') return;
    // Cleared for a new run while this ask was out: the answer is of the old one, so ask again.
    if (deskVerifyCon.run !== askedRun) { deskVerifyTail(); return; }
    if (String(b.run) !== askedRun) {
      // deskVerify holds another run than this page knew: cleared, and read from its start.
      deskVerifyCon = { run: String(b.run), text: '', to: 0, asking: false, want: 0 };
      if (askedFrom !== 0) { deskDrawVerifier(); deskVerifyTail(); return; }
    }
    deskVerifyCon.text += b.text;
    if (deskVerifyCon.text.length > DESK_CONSOLE_MAX) deskVerifyCon.text = deskVerifyCon.text.slice(deskVerifyCon.text.length - DESK_CONSOLE_MAX);
    deskVerifyCon.to = Number(b.to) || deskVerifyCon.to;
    deskDrawVerifier();
    if (b.more === true || deskVerifyCon.want > deskVerifyCon.to) deskVerifyTail();
  }, function () { deskVerifyCon.asking = false; });
}
// What the published object says of the console: a new run clears it at once, and output past what is held is asked.
function deskVerifyConsoleHeard(obj) {
  if (typeof obj.consoleRun !== 'string' || !obj.consoleRun) return;
  if (obj.consoleRun !== deskVerifyCon.run) { deskVerifyCon = { run: obj.consoleRun, text: '', to: 0, asking: deskVerifyCon.asking, want: 0 }; deskDrawVerifier(); }
  deskVerifyCon.want = Number(obj.consoleTo) || 0;
  if (deskVerifyCon.want > deskVerifyCon.to) deskVerifyTail();
}
// THE CONSOLE IS DRAWN ONCE AND WRITTEN IN PLACE (goal/G40.13). Andy: "the rolling console area keeps jumping out of
// sight, maybe redrawn of every waiting tick of the verifier, even if nothing changes???": the tile above it repaints
// on every publish and tick, the console only when its text grew, and it follows the newest line only while he is
// at its end; scrolled up, it stays where he is. It takes the height the window leaves below it ("why does not the
// console pane use up all the space it can").
function deskVerifyConsoleHtml() {
  return '<div class="stat-tile wide"><div class="label">Console</div>' +
    '<pre id="desk-verify-console" style="font-family:monospace;white-space:pre-wrap;min-height:12em;overflow:auto;margin:0.5em 0 0"></pre></div>';
}
function deskVerifyConsoleFit() {
  var con = document.getElementById('desk-verify-console');
  if (!con || typeof con.getBoundingClientRect !== 'function' || typeof window === 'undefined' || !window.innerHeight) return;
  var scroller = document.getElementById('app-container');
  var top = con.getBoundingClientRect().top + (scroller ? scroller.scrollTop : 0);
  con.style.height = Math.max(192, Math.floor(window.innerHeight - top - 32)) + 'px';
}
function deskVerifyConsoleWrite() {
  var con = document.getElementById('desk-verify-console');
  if (!con || con.textContent === deskVerifyCon.text) return;
  var atEnd = con.scrollTop + con.clientHeight >= con.scrollHeight - 8;
  con.textContent = deskVerifyCon.text;
  if (atEnd) con.scrollTop = con.scrollHeight;
}
// THE LIVE RUN (goal/G8.12), as deskVerify publishes it: the newest object only, never a log. Andy, 2026-10-09: "what
// now is displayed as a log.. should be an updated status message underneath a progress bar", and the bar is suites
// done plus the tests of the one running, against what that suite reported last time. A suite never measured before
// has no total, so it shows its count and the bar stands on the suites alone - a guessed percentage would be a lie.
var deskVerifyRun = null;
var DESK_IDLE_MIN = 60; // the idle hour (goal/G8.4), which the countdown counts down.
// THE BAR IS ALWAYS THERE (goal/G8.12). Andy, 2026-10-09: "just gray out the progress bar so i can see the layout,
// and the progress bar can show the countdown live, and only go gray when that's done. but the progress bar stays
// visible." So one bar, three states:
//   a run      how far through the run: suites done plus the tests of the one running
//   idle       the idle hour filling, live, from the newest desk write deskVerify published
//   spent      the hour reached, or nothing known yet: grey, and it says why
// A suite never measured before has no total, so the bar stands on the suites alone - a guessed percentage is a lie.
function deskVerifyIdlePct(since) {
  var ms = Date.now() - Date.parse(since);
  if (isNaN(ms)) return null;
  return Math.max(0, Math.min(100, Math.round((ms / 60000) / deskVerifyIdleMin() * 100)));
}
// The phase is on the bar itself, as `data-phase`: run while a check runs, countdown while the idle hour fills, done
// when it is spent or nothing has been published - which is also when it is grey. Grey is a muted look and not a
// hidden bar: it stays in the layout, so the tab never changes shape under him.
function deskVerifyBarHtml(pct, phase) {
  var grey = phase === 'done';
  return '<div><progress id="desk-verify-bar" data-phase="' + phase + '" max="100" value="' + pct + '" style="width:100%' +
    (grey ? ';filter:grayscale(1);opacity:0.45' : '') + '"></progress></div>';
}
// THE SERVER'S OWN HOUR (goal/G21.3): deskVerify publishes idleMs with every object; DESK_IDLE_MIN stands only for a
// verifier that does not say.
function deskVerifyIdleMin() {
  var ms = deskVerifyRun && Number(deskVerifyRun.idleMs);
  return ms > 0 ? ms / 60000 : DESK_IDLE_MIN;
}
// WHAT THE CHORES DID (goal/G21.3): the idle hour is the verifier's own since goal/G33.3, counted from the last run
// handed to it, so the tab says what its chores did.
function deskVerifyIdleSaid() {
  var r = deskVerifyRun || {};
  if (r.chores) return 'Idle time reached; the chores: ' + deskEsc(String(r.chores));
  return 'Idle time reached; the chores are starting.';
}
function deskVerifyBar() {
  var r = deskVerifyRun;
  if (!r) return deskVerifyBarHtml(0, 'done') + '<div>Nothing measured yet on this node.</div>';
  // IDLE IS NO RUN (goal/G33.6). Andy: "The desk verifier still thinks 'idling' is a run". Idle, the bar stands grey
  // and empty and the tile says so; the idle hour is counted in words, below, and only on a verifier with chores.
  if (r.doing === 'idle') return deskVerifyBarHtml(0, 'done') + '<div id="desk-verify-idle">Idle, nothing running</div>';
  var of = Number(r.of) || 0;
  var index = Number(r.index) || 0;
  var done = of ? (index - 1) / of : 0;
  var inOne = (of && Number(r.expected) > 0) ? Math.min(1, (Number(r.tests) || 0) / Number(r.expected)) / of : 0;
  var runPct = Math.max(0, Math.min(100, Math.round((done + inOne) * 100)));
  return deskVerifyBarHtml(runPct, 'run') +
    '<div>Run' + (of ? ' · suite ' + index + ' of ' + of : '') + (r.suite ? ' · ' + deskEsc(r.suite) : '') + '</div>';
}
// IDLE, IT COUNTS DOWN (goal/G8.12). Andy: "after all is done, it should count down idle time, before it starts
// documentation runs." The hour is measured from the last run handed to deskVerify, which it publishes as `since`.
function deskVerifyCountdown(since) {
  if (!since) return '';
  var ms = Date.now() - Date.parse(since);
  if (isNaN(ms)) return '';
  var left = Math.ceil(deskVerifyIdleMin() - ms / 60000);
  if (left <= 0) return '<div>' + deskVerifyIdleSaid() + '</div>';
  return '<div>Idle in ' + left + ' min of quiet.</div>';
}
function deskVerifyHtml(more) {
  if (!deskVerifier) return '<div class="job-manifest-note">No verifier runs on this node.</div>';
  var run = deskVerifier.running || { suite: '', since: '' };
  var live = deskVerifyRun;
  // A RUN IS A RUN, IDLE IS NOT (goal/G33.6): the newest published object says which, else the last now.
  var running = live ? live.doing !== 'idle' : (deskVerifier.busy === true || !!run.suite);
  // STOP ASKED UNTIL THE RUN ENDS (goal/G21.3): the newest published object says it, else the last now.
  var stopAsked = live ? live.stopAsked === true : deskVerifier.stopAsked === true;
  var out = '<div class="stat-tile wide"><div class="label">' + (running ? 'Running now' : 'Verifier') + '</div>' +
    (deskVerifyMissed ? '<div id="desk-verify-missing" class="job-manifest-note">deskVerify is not answering; the tab stays, and the next answer replaces this.</div>' : '') +
    deskVerifyBar() +
    (stopAsked ? '<div id="desk-verify-stopasked">Stop asked: the run ends before its next suite.</div>' : '') +
    // ONE STATUS LINE, REPLACED (goal/G8.12): the newest published line, and nothing kept behind it.
    (live && running ? '<div id="desk-verify-line">' + deskEsc(live.line) + '</div>' : '') +
    // THE IDLE HOUR ONLY WHERE IT LEADS SOMEWHERE (goal/G33.6): the verifier says whether its manifest names chores.
    (live && !running && live.hasChores === true ? deskVerifyCountdown(live.since) : '') +
    (live && !running && live.chores ? '<div>' + deskEsc(String(live.chores)) + '</div>' : '') +
    (!live && !running ? '<div id="desk-verify-idle">Idle, nothing running</div>' : '') +
    (running && !live && run.suite ? '<div>Suite ' + deskEsc(run.suite) + (run.since ? ' · since ' + deskTime(run.since) : '') + '</div>' : '') +
    (deskVerifyNote ? '<div class="job-manifest-note">' + deskEsc(deskVerifyNote) + '</div>' : '') +
    // STOP (goal/G33.3): pressable whenever anything runs. A run is started from the item.
    // CHORES NOW (goal/G33.11): the idle chores at once, chores.run; pressable while nothing runs, where chores are named.
    '<div><button type="button" id="desk-verify-stop"' + (run.suite || deskVerifier.busy === true ? '' : ' disabled') + '>Stop the run</button>' +
    ' <button type="button" id="desk-verify-chores"' + (!running && (!live || live.hasChores === true) ? '' : ' disabled') + '>Chores now</button>' +
    (more ? ' ' + more(running) : '') + '</div>' +
    '</div>';
  // THE RECORDS LIST IS GONE (goal/G8.12). Andy, 2026-10-09: "i want that damn log display gone. and only show the
  // latest status." It listed the dataset's newest rows, which read as a log beside a live run; the tab now shows the
  // run and nothing else. records.search was a verb of deskVerify's until goal/G19.11, when it went for want of any
  // caller but a suite; the dataset is read on his clone's disc (verify.db), never through the tab.
  return out;
}
// THE FULL PRODUCT TEST TREE (goal/G40.13, box v22, point 9): a button in the tab's own row (Andy: "[Stop the run]
// [Chores now] [Run the product tests]"), a run of every test the product tree holds (the suite 'spirit/run', which the
// verifier names through testModule.js); pressable while nothing runs.
function deskVerifyProductButton(running) {
  return '<button type="button" id="desk-verify-product"' + (running ? ' disabled' : '') + '>Run the product tests</button>';
}
var deskVerifyHeadDrawn = null;
function deskDrawVerifier() {
  var box = document.getElementById('desk-verifier');
  if (!box) return;
  var head = document.getElementById('desk-verify-head');
  // THE CONSOLE, BELOW (goal/G22.3): the current run's output, cleared at each new run.
  if (!head || !!deskVerifier !== !!document.getElementById('desk-verify-console')) {
    box.innerHTML = '<div id="desk-verify-head"></div>' + (deskVerifier ? deskVerifyConsoleHtml() : '');
    head = document.getElementById('desk-verify-head');
    deskVerifyHeadDrawn = null;
  }
  var html = deskVerifyHtml(deskVerifyProductButton);
  if (html !== deskVerifyHeadDrawn) { head.innerHTML = html; deskVerifyHeadDrawn = html; deskVerifyConsoleFit(); }
  deskVerifyConsoleWrite();
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('resize', deskVerifyConsoleFit);
// THE COUNTDOWN MOVES ON ITS OWN (goal/G8.12). Andy: "the progress bar can show the countdown live". Nothing is asked
// of anybody for this - the clock is local, which is the one thing a page may read without pulling; it repaints only
// while the tab is open and the verifier is idle, so a running verifier's bar is only ever what it published.
var deskVerifyTick = null;
function deskVerifyTicking(on) {
  if (!on) {
    if (deskVerifyTick && typeof clearInterval === 'function') clearInterval(deskVerifyTick);
    deskVerifyTick = null;
    return;
  }
  if (deskVerifyTick || typeof setInterval !== 'function') return;
  deskVerifyTick = setInterval(function () {
    if (deskTab !== 'verifier' || !deskVerifyRun || deskVerifyRun.doing !== 'idle') return;
    deskDrawVerifier();
  }, 15000);
}
// WHAT DESKVERIFY PUBLISHES (goal/G8.12), subscribed at mount: each object replaces the last and repaints. A run that
// starts while the tab is closed is still the newest object when he opens it, so he sees where it stands, not nothing.
// The tab also appears on the first object from a verifier that was not yet answering when the page opened.
function deskVerifyEvent(obj) {
  if (!obj || typeof obj !== 'object' || typeof obj.doing !== 'string') return;
  deskVerifyRun = obj;
  // A published object is an answer too: the verifier is there (goal/G21.3). The Stop's note goes once the run it
  // stopped has ended.
  deskVerifyMissed = false;
  if (obj.doing === 'idle' && obj.stopAsked !== true && deskVerifyNote.indexOf(DESK_STOP_NOTE) === 0) deskVerifyNote = '';
  if (!deskVerifier) { deskVerifier = { running: { suite: '', since: '' } }; deskDrawTabs(); }
  deskDrawVerifier();
  deskVerifyConsoleHeard(obj);
  // AND THE LIST'S STATUS BOX FOLLOWS IT (goal/G18.5): the row it runs for shows the progress, and is itself again
  // once the run is idle.
  if (deskTab === 'list') deskDraw();
}

// THE HEADER AREA IS THE SHELL'S (goal/G6.1): the block written as #desk-bars moves into the app header, which sticks it
// under the titlebar, and takes its id.
function deskHeader(api) {
  var old = document.getElementById('desk-bars');
  var els = api && api.ui && api.ui.elements;
  if (!old || !els || !window.spirit.element.appHeader) return;
  // Made in the old block's parent, then put in its place (the element shape, goal/G41.19).
  var head = window.spirit.element.appHeader.create(old.parentNode);
  old.parentNode.insertBefore(head, old);
  head.id = 'desk-bars';
  while (old.firstChild) head.appendChild(old.firstChild);
  old.parentNode.removeChild(old);
}

spirit.shell.activateApp({
  mount: function (container, api) {
    deskApi = api;
    // ── THE TABS ───────────────────────────────────────────────────
    //
    //   Andy: "could the be, at the top of the window a set of tabs that
    //   allow me to switch from the list display, to chat with lead, to
    //   \"log musings\", so the vertical space here doesn't get annoying?"
    //   and "tabs would be a more standard approach, methinks".
    //
    // Switching shows one pane and hides the others; nothing is repainted,
    // so a half-typed line in any pane survives a switch. The inputs live
    // outside the repainted parts.
    // THE YELLOW DESIGN BUBBLE STOOD FIRST HERE, and went with goal/G9.8. Andy: "get rid of the yellow bubble that
    // says \"Design mode. Nothing is built until it ends, and it ends only in the Team tab.\". it is useless."
    container.innerHTML =
      // Drawn by deskDrawTabs.
      // PINNED BELOW THE TITLE BAR (desk/G1.12; goal/G2.1 note 4). Andy: "the tabs should stick
      // top the top like the title bar", then "they should leave the app or dialog visible, and stay
      // sticky below those title bars". ONE sticky block holding both rows (claude-windows' review):
      // two rows each stuck at top 0 slid the agent row under the main one. The shell's #app-header is
      // sticky at the top of the same scroll, so this block sticks at its height, never at 0 where it covered Back and
      // Home. Opaque, in the shell's own background. SINCE goal/G6.1 the shell's app header does the sticking: the
      // block is moved into the shell's app header right after this markup lands (deskHeader).
      // THE BLINK, DECLARED ONCE (goal/G2.4): a working agent's tab border blinks; the mark is data-working.
      '<style>@keyframes desk-blink { 50% { border-color: transparent; } } ' +
        '#desk-tabs [data-bubble][data-working="1"] { animation: desk-blink 1s step-start infinite; }</style>' +
      // FLAT AND JOINED TO THE TITLE BAR (goal/G9.6). Andy: "the header area should not contain rounded corners. and
      // its container should have no margins and no padding." No goal bubble either: the List's goal row opens the
      // goal (his answer to G9.6 Q1).
      '<div id="desk-bars">' +
        // GO ALL at the right of the tab bar, on the List tab only (desk/G3.4).
        '<div style="display:flex;align-items:center"><div id="desk-tabs" style="flex:1;display:flex;gap:12px;flex-wrap:wrap;align-items:center"></div>' +
          '<button type="button" id="desk-go-all" hidden>Go all</button></div>' +
      '</div>' +
      // EVERY LIST IN A BOX OF A STATED SIZE (goal/G41.11, rule/16): the List and the Rules list each in a fill box, and
      // every box up to the app a fill box too, as the Apps and Icons face apps do.
      '<div id="desk-root" class="fill">' +
        // THE SEARCH BAR TOPS THE LIST (desk/G2.6). Andy: "all list displays in
        // the UI now must be topped by a search input bar", "The server does the
        // searching AND the filtering", "When Desk opens: [Current Goal Only] on,
        // [Goals Only] off". Outside the repainted table, so typing survives.
        '<div data-pane="list" class="fill"><div id="desk-backup"></div>' +
          // ADD GOAL, DIRECTLY ABOVE THE SEARCH, WHILE GOALS ONLY IS ON (goal/G9.11). Andy: "a new bubble will appear
          // directly above the search bubble for the list: \"Add Goal\" [Title String, subject to label rules]
          // [add-button]", and "The new goal will automatically become the current goal." Shown by deskDrawToggles.
          '<div class="start-job-form card" id="desk-add-goal" hidden><label class="field-label grow">Add Goal' +
            '<input type="text" id="desk-goal-title" placeholder="title"></label>' +
            '<button type="button" id="desk-goal-add">Add</button></div>' +
          // THE LIST IS THE PROBABILITY SEARCH (goal/G40.12; Andy: "ALL desk clients need to cache search results, the
          // same. That is part of the whole probability search frame work"): spirit/element/search.js in its pane
          // face over items.search, its toggles the element's filters in the row above the box, each row a row element
          // (deskMountList). The error line above it.
          '<div id="desk-top" class="fill"><div id="desk-list-error"></div><div id="desk-list" class="fill"></div></div></div>' +
        // THE RULES TAB (goal/G6.5): the new bubble, the search bubble, the list. #desk-rules takes every click and input.
        '<div data-pane="rules" class="fill" hidden><div id="desk-rules" class="fill">' +
          '<div class="start-job-form card">' +
            '<label class="field-label">Type<select id="desk-rule-type">' +
              DESK_RULE_TYPES.map(function (v) { return '<option value="' + v + '">' + v + '</option>'; }).join('') + '</select></label>' +
            '<label class="field-label grow">Label<input id="desk-rule-label" placeholder="the rule in a few words"></label>' +
            '<label class="field-label grow">Text<textarea id="desk-rule-text" rows="3" placeholder="the rule; up to 2048 bytes, line breaks kept"></textarea></label>' +
            // goal/G40.12: autoAttach, off unless ticked: the rule is attached to every goal made from then on.
            '<label class="field-label"><input type="checkbox" id="desk-rule-auto"> auto-attach to new goals</label>' +
            '<button type="button" id="desk-rule-add">New</button></div>' +
          '<div id="desk-rule-error" class="job-start-error"></div>' +
          '<div id="desk-rule-list" class="fill"></div>' +
        '</div></div>' +
        // THE VERIFIER TAB'S PANE (goal/G8.11): #desk-verifier takes the whole body and every click in it.
        '<div data-pane="verifier" hidden><div id="desk-verifier"></div></div>' +
        // AN AGENT'S SCOPE (goal/G4.23), opened from its bubble.
        '<div data-pane="agent" hidden>' +
          '<div class="stat-tile wide"><div class="label" id="desk-agent-label"></div><div id="desk-agent"></div></div>' +
          '<div class="stat-tile wide"><div class="label">Profile</div><div id="desk-agent-picker"></div></div>' +
        '</div>' +
      '</div>';
    deskHeader(api);
    // goal/G41.23: every icon that stands alone in the page, through the icon element (deskGlyph).
    deskWatchIcons(container);
    function show(tab) {
      var pane = tab.indexOf('agent:') === 0 ? 'agent' : tab;
      // A TAB THE PAGE DOES NOT HAVE (Team and Apps went with goal/G43.22) FALLS BACK TO THE LIST, its main tab.
      var panes = container.querySelectorAll('[data-pane]');
      if (!Array.prototype.some.call(panes, function (p) { return p.getAttribute('data-pane') === pane; })) { tab = 'list'; pane = 'list'; }
      Array.prototype.forEach.call(panes, function (p) {
        p.hidden = p.getAttribute('data-pane') !== pane;
      });
      if (pane === 'agent') deskAgentOpen(tab.slice('agent:'.length));
      // HIGHLIGHTED, NOT DISABLED. Andy: "on the desk app, the current tab
      // should be highlighted." A disabled button read as greyed out.
      deskTab = tab;
      deskDrawGoAll();
      if (tab === 'rules') deskRulesSearch();
      // goal/G8.11: opening the tab reads what runs and the newest records; it is not pulled while it is closed.
      if (tab === 'verifier') { deskVerifyRefresh(); deskVerifyTicking(true); deskVerifyConsoleFit(); } else deskVerifyTicking(false);
      deskDrawTabs();
    }
    // The strips are redrawn, so one listener on each, and the click may
    // land on the red * inside a button.
    function clicked(e, attr) {
      var el = e.target;
      while (el && el !== e.currentTarget && !(el.getAttribute && el.getAttribute(attr)) && !(el.id)) el = el.parentNode;
      return el && el !== e.currentTarget ? el : null;
    }
    document.getElementById('desk-tabs').addEventListener('click', function (e) {
      var el = clicked(e, 'data-tab');
      if (el && el.getAttribute && el.getAttribute('data-tab')) show(el.getAttribute('data-tab'));
    });
    show('list');
    // ONE LISTENER ON THE LIST, which is repainted: a press, a link, a row.
    document.getElementById('desk-top').addEventListener('click', function (e) {
      var t = e && e.target;
      var press = t && t.closest && t.closest('[data-press]');
      if (press) {
        if (e.stopPropagation) e.stopPropagation();
        // goal/G41.9: an are-you-sure (Done not verified green, goal/G33.3) is its armingButton's, never this listener's.
        if (press.hasAttribute && press.hasAttribute('data-arming')) return;
        deskPress(press.getAttribute('data-id'), press.getAttribute('data-press'));
        return;
      }
      var link = t && t.closest && t.closest('[data-open]');
      if (link) { if (e.preventDefault) e.preventDefault(); deskOpenRow(link.getAttribute('data-open')); return; }
      var row = t && t.closest && t.closest('[data-row]');
      if (row) deskOpenRow(row.getAttribute('data-row'));
    });
    document.getElementById('desk-goal-add').addEventListener('click', function () { deskAddGoal(); });
    deskDrawToggles();
    deskMountList();
    document.getElementById('desk-rules').addEventListener('click', function (e) {
      var t = e && e.target;
      if (!t) return;
      if (t.id === 'desk-rule-add') { deskRuleAdd(); return; }
    });
    // ONE LISTENER ON THE VERIFIER'S BODY (goal/G8.11), which is repainted: Stop, and Chores now (goal/G33.11).
    document.getElementById('desk-verifier').addEventListener('click', function (e) {
      var t = e && e.target;
      if (!t) return;
      if (t.id === 'desk-verify-chores') {
        deskVerifyPressed('Chores now sent; waiting for deskVerify\'s answer.');
        deskVerifyAsk('chores.run', {}).then(function () {
          deskVerifyAnswered('deskVerify answered: the chores are running; the idle line says what they did.');
          return deskVerifyRefresh();
        }, function (e) {
          deskVerifyAnswered('Chores now was not taken: ' + ((e && e.message) || e) + '.');
          return deskVerifyRefresh();
        });
        return;
      }
      if (t.id === 'desk-verify-product') {
        deskVerifyPressed('The product tests sent; waiting for deskVerify\'s answer.');
        deskVerifyAsk('run', { suites: ['spirit/run'], commit: '' }).then(function () {
          deskVerifyAnswered('deskVerify answered: the product test tree is running.');
          return deskVerifyRefresh();
        }, function (e) {
          deskVerifyAnswered('The product tests were not taken: ' + ((e && e.message) || e) + '.');
          return deskVerifyRefresh();
        });
        return;
      }
      if (t.id === 'desk-verify-stop') {
        deskVerifyPressed('Stop sent; waiting for deskVerify\'s answer.');
        deskVerifyAsk('stop', {}).then(function (b) {
          deskVerifyAnswered(b && b.stopped ? DESK_STOP_NOTE + ' the run ends before its next suite.' : 'deskVerify answered: nothing was running to stop.');
          return deskVerifyRefresh();
        }, function (e) {
          deskVerifyAnswered('The Stop was not taken: ' + ((e && e.message) || e) + '.');
          return deskVerifyRefresh();
        });
        return;
      }
    });
    deskArming(document.getElementById('desk-go-all'), 'Go all: sure?', deskGoAll);
    // NO PULLING. Andy: "no pulling". The List asks once, then repaints from
    // what the desk server publishes. A shell whose api carries no onPublished (the face's) mounts it all the same,
    // without the live repaint (goal/G41.19: it mounts cleanly, "no throw even unconfigured").
    if (typeof deskApi.onPublished === 'function') deskApi.onPublished(deskOnPublished);
    deskLoadData();
    deskLoadRunStatus();
    // BACK AFTER A GAP (Andy: "this should work without a hickup"): what was
    // published or said while the stream was down was never heard, so the
    // List and the backup line are asked for again.
    if (typeof deskApi.onReconnect === 'function') deskApi.onReconnect(function () { deskForgetKept(); deskSearchItems(); deskLoad(); });
    deskDraw();
    deskSearchItems();
    deskLoad();
    // goal/G8.11: whether a verifier runs here decides whether the tab exists at all, so it is asked at mount.
    // goal/G8.12: and from then on it listens - deskVerify publishes every change of its run, so the tab never pulls.
    // THROUGH spirit.data (goal/G41.28; Andy: "These rules apply to ALL clients. including deskVerify"): the verifier's
    // own cache manager keeps what it publishes, and the tab follows that (spirit.data.deskVerify.data.watch).
    deskNeed(DESK_VERIFY_DATA).then(function () {
      var V = window.spirit && ((window.spirit.data || {}).deskVerify || {}).data;
      if (!V) return;
      V.watch(deskVerifyEvent);
      if (V.state()) deskVerifyEvent(V.state());
    });
    deskAskVerifier();
  },
});
