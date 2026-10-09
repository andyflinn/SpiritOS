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
// content to be drawn." "no pulling". Its rows are items.search's labels, in the
// server's order, kept only to be painted; each published change replaces its row.
var deskItems = [];
// The search bar and its two toggles. Andy: "When Desk opens: [Current Goal Only]
// on, [Goals Only] off". "The server does the searching AND the filtering."
var deskFilter = { text: '', currentGoalOnly: true, goalsOnly: false, includeClosed: false };
// THE ROW'S ICON (desk/G1.11): ERROR wherever Andy blocks ("the ERROR for
// anything i NEED to deal with", "wherever i block"), CODE on any other item.
// From the kernel's own set; a Desk mounted without it draws none.
function deskIcon(name) {
  var set = (typeof spirit !== 'undefined' && spirit.core && spirit.core.const && spirit.core.const.ICON) || {};
  return set[name] || '';
}
var deskMessages = [];      // decoded agents messages, in log order
var deskByHash = Object.create(null);
var deskError = '';
// THE LEAD (deskLead) stood here, learned from whoever posted the session: the direct chat to the lead was its
// home. Gone with the direct line (goal/G3.12); the desk server knows the agents by their keys.
// WHO THE AGENTS ARE, from the packets of the agents-app era still on record: newest key per name. Nothing on the
// page sends to these keys any more (goal/G3.8, G3.12); the bubbles are drawn from the goal row, not from here.
var deskAgents = Object.create(null);

// One arrival (onPacket's body and message) -> one agents message, or null
// when it is not one.
function deskArrival(body, message) {
  if (!body || !message) return null;
  var at = String(message.sentAt || new Date().toISOString());
  // A REPORT CARRIES A WHOLE MESSAGE BETWEEN AGENTS (agents.js reportOf),
  // read here as that message, from its own sender. That is what makes
  // this log Andy's "overall record of our activities", and it is how
  // one agent's `taking`, sent to the other, still reaches the column.
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

// One of Andy's own lines, as it went. Keyed by the hash the node signed
// it under, or by a key of its own when nothing crossed and there is no
// hash: folding failed sends by an empty hash would merge them into one.
var deskOutCount = 0;
function deskOutgoing(to, body, r, e) {
  deskOutCount += 1;
  return {
    key: (r && r.hash) || ('out-' + Date.now() + '-' + deskOutCount),
    at: new Date().toISOString(), dir: 'out', peer: String(to || ''),
    outcome: e ? 'undelivered: ' + e.message : (r && r.ok ? 'sent' : 'undelivered: ' + ((r && (r.error || r.status)) || 'no answer')),
    from: 'andy', kind: String(body.kind || ''), text: String(body.text || ''), todo: body.todo ? String(body.todo) : '',
  };
}

// ── DESK'S RECORD IS THE DESK SERVER'S (desk/G1.4) ──────────────────
//
//   Andy: "desk creates a lot of file-clutter", "SpiritOS list.load rules
//   are probably vialoated", "lazy-fill of pages seems appropriate", "the
//   list only loads key/title, and the rest lazy loads".
//
// DECIDED (desk/G1, D5 and O9), not this file's to undo: Desk keeps nothing
// in its own folder. Its log, what he typed, and its state and seen live in
// the desk server (process/js/desk), reached by jobs.api on the loopback
// door (D4). It reads only what it shows: the newest session, each open
// item's own lines, a chat's newest page, never the whole log. Desk still
// folds what it reads (deskFold); the server is storage and bounded search.
// Each id a link to its item, as the dialog's are (Andy: "the blocked and
// blocks lists link to the respective items").
function deskLinks(ids) {
  return (ids || []).map(function (id) {
    return '<a href="#" data-open="' + deskEsc(id) + '">' + deskEsc(id) + '</a>';
  }).join(', ');
}

function deskAsk(verb, args) {
  var ask = { desk: {} };
  ask.desk[verb] = args || {};
  return Promise.resolve(deskApi.verb('jobs.api', { ask: ask })).then(function (r) {
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
  return body.code + (typeof x.bytes === 'number' ? ': ' + x.bytes + ' bytes, the limit is ' + x.max : '') + (body.error ? ' (' + body.error + ')' : '');
}
// One bounded search; the server answers newest first in searchBucket's
// shape, {items: [{key, label}], more}, a line being its label (slim/G1.2).
// Every key is sent, as the server matches them exactly (appPair D8).
function deskSearch(q) {
  return deskAsk('log.search', { text: q.text || '', todo: q.todo || '', since: q.since || '', kind: q.kind || '', before: q.before || '' })
    .then(function (r) {
      var lines = (r.items || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return null; } }).filter(Boolean);
      return { lines: lines, partial: !!r.more };
    });
}
// Lines come newest first; they are folded oldest first, and the whole held
// record is kept in time order for the chats.
function deskTake(lines) {
  lines.slice().reverse().forEach(deskFold);
  deskMessages.sort(function (a, b) { return String(a.at) < String(b.at) ? -1 : String(a.at) > String(b.at) ? 1 : 0; });
}
function deskWriteError(what) {
  return function (e) { deskError = 'Desk could not ' + what + ': ' + ((e && e.message) || e); deskDraw(); };
}

// WHAT ANDY TYPES IS NO LONGER SENT TO A VOICE FILE (goal/G2.1 note 8). The desk server kept a plain file of
// his lines (desk/G1.4) for his vault; since apiAuth/G1's close the brain reads them through the desk api, and the
// vault's own tool (claude/voiceFromDesk.js) keeps his corpus. Nothing here writes it, and nothing may.

// Onto the screen and into the server's log. Only what is new to this page
// is added, and the server keeps a key once, so a replay writes nothing twice.
function deskRecord(msgs) {
  var fresh = msgs.filter(function (m) { return m && m.key && !deskByHash[m.key]; });
  fresh.forEach(deskFold);
  deskMessages.sort(function (a, b) { return String(a.at) < String(b.at) ? -1 : String(a.at) > String(b.at) ? 1 : 0; });
  deskDraw();
  return Promise.all(fresh.map(function (m) { return deskAsk('log.add', { json: JSON.stringify(m) }); }))
    // THE BACKUP LINE FOLLOWS THE RECORD: read once at load it went stale
    // (Andy: "last check 12:55" while it had copied at 13:26).
    .then(function () { if (fresh.length) return deskAskBackup(); })
    // Says whether it was kept, so a caller can hold on to what he typed (desk/G3.9 review).
    .then(function () { return true; }, function (e) { deskWriteError('keep its log')(e); return false; });
}

// Folds one message in by its key; one already held is not taken twice. It
// keeps the chats and who the agents are; the List is the desk server's (desk/G2.6).
function deskFold(msg) {
  if (!msg || !msg.key || deskByHash[msg.key]) return;
  deskByHash[msg.key] = msg;
  deskMessages.push(msg);
  if (msg.dir === 'in' && !msg.reported && msg.from && msg.peer) deskAgents[msg.from] = { key: msg.peer, at: Date.parse(msg.at) || 0 };
}

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
var DESK_ALERT = '<span style="color:#d00;font-weight:bold" title="brought back: needs your eye">❗</span>';
var deskSeen = { team: 0, agents: {} };
var deskTab = 'list';
// THE DIRECT TABS ARE GONE (goal/G3.12). Team is the group chat alone; there is no chat inside Team to pick, no
// line to one agent and no direct line's unseen mark. Andy, 2026-10-03: "the The team tab will only show the team
// chat interface (Chat of goal 'desk/G0.0')". deskSeen keeps its agents field so an older seen.json still parses.

function deskIsTeamLine(m) { return m.todo === DESK_TEAM && m.kind !== 'board'; }

// The newest arrival (never his own line) that `pred` accepts.
function deskNewest(pred) {
  var newest = 0;
  deskMessages.forEach(function (m) {
    if (m.dir !== 'in' || !pred(m)) return;
    var at = Date.parse(m.at) || 0;
    if (at > newest) newest = at;
  });
  return newest;
}
function deskSaveSeen() {
  if (!deskLoaded) return;
  deskAsk('seen.set', { json: JSON.stringify(deskSeen) }).catch(function () { /* only a marker */ });
}
function deskMarkTeamSeen() {
  var newest = deskNewest(deskIsTeamLine);
  if (newest <= (deskSeen.team || 0)) return;
  deskSeen.team = newest;
  deskSaveSeen();
}

// Applied once at mount, after the first reads. Absent: all held is seen.
function deskLoadSeen(raw) {
  var held = null;
  try { held = raw ? JSON.parse(raw) : null; } catch (e) { held = null; }
  if (held && typeof held === 'object') {
    deskSeen = { team: Number(held.team) || 0, agents: held.agents && typeof held.agents === 'object' ? held.agents : {} };
    return;
  }
  deskSeen = { team: deskNewest(deskIsTeamLine), agents: {} };
  deskSaveSeen();
}

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
  // EACH BUBBLE IS A TAB (goal/G4.23). Andy: "the red-bordered agent bubbles become tab-headers again, with their own
  // pane for scope-configuration." data-tab="agent:<name>" opens that agent's scope pane; the bubble keeps its state.
  return '<span class="job-manifest-note" style="margin-left:12px">Info</span>' + known.map(function (n) {
    var away = live.indexOf(n) === -1;
    var busy = !away && working.indexOf(n) !== -1;
    var on = deskTab === 'agent:' + n;
    return '<span data-bubble="' + deskEsc(n) + '" data-tab="agent:' + deskEsc(n) + '"' +
      (away ? ' data-away="1" title="away: not heard from in 10 minutes; open its scope"' : busy ? ' data-working="1" title="working: leave it alone until it listens again"' : ' title="listening: open its scope"') +
      ' style="display:inline-block;cursor:pointer;padding:2px 10px;margin-left:6px;border-radius:12px;font-weight:' + (on ? 'bold' : 'normal') +
      ';border:2px ' + (away ? 'dashed #888;opacity:0.6' : 'solid ' + (busy ? '#d00' : '#555')) + '">' + deskEsc(n) + '</span>';
  }).join('');
}

// ── AN AGENT'S SCOPE PANE (goal/G4.23) ───────────────────────────────
//
//   Andy: "i alone" set an agent's scope; "file/folder selector in it a shell element"; "i'll do the third when the
//   ui arrives"; and "you set one field: '' = nothing '/' = repo-root all that are selectable from drop-down". The pane
//   shows the agent's one scope (scope.get by its key, from the goal row's agents) and sets it: a folder from the
//   path selector on the shell's tree, or the repo root. Every edit is a scope.set, and the pane draws only the answer
//   of the scope.get after it, never what it guessed.
var deskAgentName = '';
var deskAgentScope = '';
// The root button and its words, offered only while the scope is not '/' already (Andy: "[set-to-repo-root] only needs
// to be offered if the agent doesn't already have that scope.").
var deskAgentRootParts = [];
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
  if (label) label.textContent = 'Scope of ' + deskAgentName + ': the one folder it may commit in (core files still need your grant)';
  // ONE FIELD, SHOWN AS IT IS: '' nothing, '/' the repo root, else the folder.
  var one = deskAgentScope;
  deskAgentRootParts.forEach(function (n) { n.hidden = one === '/'; });
  el.innerHTML = '<span data-scope-current>' + (one === '' ? '(nothing: this agent may commit nothing)' : one === '/' ? '/ (the repo root)' : deskEsc(one)) + '</span>' +
    (deskAgentNote ? '<div class="job-start-error">' + deskEsc(deskAgentNote) + '</div>' : '');
}
function deskAgentLoad() {
  var key = deskAgentKey();
  if (!key) { deskAgentScope = ''; deskAgentNote = 'No key known for ' + deskAgentName + '.'; deskAgentDraw(); return Promise.resolve(); }
  return deskAsk('scope.get', { agent: key }).then(function (r) {
    deskAgentScope = typeof r.folder === 'string' ? r.folder : '';
    deskAgentNote = '';
    deskAgentDraw();
  }, function (e) { deskAgentNote = 'Not read: ' + ((e && e.message) || e); deskAgentDraw(); });
}
function deskAgentSet(folder) {
  var key = deskAgentKey();
  if (!key) return;
  deskAsk('scope.set', { agent: key, folder: folder }).then(deskAgentLoad, function (e) {
    deskAgentNote = 'Not set: ' + ((e && e.message) || e);
    deskAgentDraw();
  });
}
function deskAgentOpen(name) {
  deskAgentName = name;
  deskAgentScope = '';
  deskAgentNote = '';
  deskAgentProfile = null;
  deskAgentDraw();
  var slot = document.getElementById('desk-agent-picker');
  var make = deskApi && deskApi.ui && deskApi.ui.elements && deskApi.ui.elements.createPathSelector;
  if (slot && typeof make === 'function') {
    var picker = make({
      foldersOnly: true,
      files: function () { return (spirit.shell && typeof spirit.shell.currentFiles === 'function' && spirit.shell.currentFiles()) || []; },
    });
    // ONE LINE (Andy: "The fs-scope should take only one line of agent configuration. [folder-dropdown] [set]
    // 'current/scope/'   'for advanced agents' [set-to-repo-root]"). A pick only selects ("one accidental click and a
    // folder is granted, just like that"); [set] replaces the one scope with the chosen folder, and with nothing chosen
    // sends nothing.
    var setOne = document.createElement('button');
    setOne.setAttribute('type', 'button');
    setOne.setAttribute('data-scope-set', '1');
    setOne.textContent = 'set';
    setOne.addEventListener('click', function () {
      if (picker.value) deskAgentSet('spirit/run/' + picker.value);
    });
    var advanced = document.createElement('span');
    advanced.className = 'job-manifest-note';
    advanced.textContent = ' for advanced agents ';
    slot.innerHTML = '';
    // ONE LINE WITH ROOM BETWEEN ITS PARTS (Andy: "misses horizontal spacing between items").
    slot.style.display = 'flex';
    slot.style.alignItems = 'center';
    slot.style.flexWrap = 'wrap';
    slot.style.gap = '12px';
    slot.appendChild(picker);
    slot.appendChild(setOne);
    slot.appendChild(advanced);
    // THE REPO ROOT, ARMED (Andy: "i need \"/\" as an option", "give me an arm-button", then "[set-to-repo-root]").
    // The shell's tree holds spirit/run only, so the root is a button of its own: the first click arms it, the second
    // sets the one scope to '/' (the whole repo); a click elsewhere disarms it.
    var whole = document.createElement('button');
    whole.setAttribute('type', 'button');
    whole.setAttribute('data-scope-root', '1');
    var armed = false;
    var paint = function () {
      whole.textContent = armed ? 'set-to-repo-root: sure?' : 'set-to-repo-root';
      if (armed) whole.setAttribute('data-armed', '1'); else whole.removeAttribute('data-armed');
    };
    paint();
    whole.addEventListener('click', function () {
      if (!armed) {
        armed = true;
        paint();
        if (deskApi && typeof deskApi.armUntilElsewhere === 'function') deskApi.armUntilElsewhere(function () { armed = false; paint(); });
        return;
      }
      armed = false;
      paint();
      deskAgentSet('/');
    });
    slot.appendChild(whole);
    deskAgentRootParts = [advanced, whole];
    // NAME AND NICK, KEPT BY THE DESK FOR ANDY (Andy: "so two more fields for repo-root-agents: / name <agent-name> /
    // nick: <wc | wsl | ubi>", and "the profiles are for me, in desk"). profile.set is owner-only on the server; the
    // nick is what makes a line of his starting "<nick>:" that agent's to take.
    var field = function (which, width) {
      var label = document.createElement('label');
      label.className = 'job-manifest-note';
      label.textContent = which + ' ';
      var input = document.createElement('input');
      input.setAttribute('type', 'text');
      input.setAttribute('data-profile', which);
      input.style.width = width;
      label.appendChild(input);
      slot.appendChild(label);
      return input;
    };
    deskAgentProfile = { name: field('name', '12em'), nick: field('nick', '5em') };
    var save = document.createElement('button');
    save.setAttribute('type', 'button');
    save.setAttribute('data-profile-save', '1');
    save.textContent = 'save';
    save.addEventListener('click', deskAgentProfileSave);
    slot.appendChild(save);
  }
  deskAgentProfileLoad();
  return deskAgentLoad();
}
function deskAgentProfileLoad() {
  var key = deskAgentKey();
  if (!key || !deskAgentProfile) return Promise.resolve();
  return deskAsk('profile.get', { agent: key }).then(function (r) {
    deskAgentProfile.name.value = (r && r.name) || '';
    deskAgentProfile.nick.value = (r && r.nick) || '';
  }, function (e) { deskAgentNote = 'Profile not read: ' + ((e && e.message) || e); deskAgentDraw(); });
}
function deskAgentProfileSave() {
  var key = deskAgentKey();
  if (!key || !deskAgentProfile) return;
  deskAsk('profile.set', { agent: key, name: deskAgentProfile.name.value, nick: deskAgentProfile.nick.value }).then(function () {
    deskAgentNote = '';
    deskAgentDraw();
    return deskAgentProfileLoad();
  }, function (e) { deskAgentNote = 'Profile not saved: ' + ((e && e.message) || e); deskAgentDraw(); });
}

// Drawn whole, as markup: List | Team | Musings, then the bubbles.
function deskDrawTabs() {
  var strip = document.getElementById('desk-tabs');
  if (!strip) return;
  var waiting = deskWaitingOnAndy();
  var design = deskDesignOn();
  strip.innerHTML =
    deskTabButton('data-tab="list"', deskTab === 'list', 'List' + (waiting ? ' (' + waiting + ')' : '')) +
    deskTabButton('data-tab="team"', deskTab === 'team', 'Team') +
    deskTabButton('data-tab="rules"', deskTab === 'rules', 'Rules') +
    deskTabButton('data-tab="musings"', deskTab === 'musings', 'Musings') +
    deskBubblesHtml() +
    // AT THE END OF THE TAB ROW, ONLY ON TEAM, AND LOOMING. Andy: "put the
    // end design mode button at the end of the tab-button-row, only
    // visible while in teh team tab. and make the button a different
    // color, so it loooms over the proceedings".
    '<button type="button" id="desk-end-design"' + (design && deskTab === 'team' ? '' : ' hidden') +
      (deskArmed === 'desk-end-design' ? ' data-armed="1"' : '') +
      ' style="margin-left:auto;background:#c00;color:#fff;font-weight:bold;border:2px solid #600">End design mode' +
      (deskArmed === 'desk-end-design' ? ': sure?' : '') + '</button>' +
    // Its twin, in the same spot while design mode is off.
    '<button type="button" id="desk-start-design"' + (!design && deskTab === 'team' ? '' : ' hidden') +
      (deskArmed === 'desk-start-design' ? ' data-armed="1"' : '') +
      ' style="margin-left:auto;background:#1a7f37;color:#fff;font-weight:bold;border:2px solid #0b4a1e">Start design mode' +
      (deskArmed === 'desk-start-design' ? ': sure?' : '') + '</button>';
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
  return deskItems.filter(function (r) { return r && r.goal === ''; })[0] || null;
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
function deskLabels(r) {
  return ((r && r.items) || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return null; } }).filter(Boolean);
}
function deskSearchItems() {
  return deskAsk('items.search', { text: deskFilter.text, currentGoalOnly: deskFilter.currentGoalOnly, goalsOnly: deskFilter.goalsOnly, includeClosed: deskFilter.includeClosed })
    .then(function (r) { deskItems = deskLabels(r); deskDraw(); }, deskWriteError('read its list'));
}
// A published change: {change, verb, item: <facts>, listed}. A new session
// asks again, since it adds and drops whole rows; so does a change to an item
// the List does not show, since only the server knows whether the search and
// toggles let it in (wsl-claude's review).
// A MISSED PUBLISH IS NOTICED (desk/G3.10): every publish goes out since fileTransfer goal/G1.4, but one can still
// go unseen here (an oversize drop notice, a stream reconnect); a change number that skips one means exactly that,
// and the List asks once.
var deskLastChange = 0;
function deskOnPublished(obj) {
  if (!obj || typeof obj !== 'object') return;
  // A RULE CHANGED (goal/G6.5): the desk server publishes {rule: key}; the Rules tab, if shown, asks again.
  if (obj.rule && !obj.item && !obj.verb) { if (deskTab === 'rules') deskRulesSearch(); return; }
  // AN UPDATE TOO LARGE TO PUBLISH was dropped, and said: ask again for what is shown.
  if (obj.dropped) { deskSearchItems(); return; }
  var change = Number(obj.change) || 0;
  // AN OLDER UPDATE CHANGES NOTHING (goal/G2.1 note 7). Andy: "let desk worry about its problems": publishes
  // travel as their own requests and can overtake each other; a row is never painted over by what came before.
  if (change && deskLastChange && change < deskLastChange) return;
  var gap = deskLastChange && change > deskLastChange + 1;
  if (change) deskLastChange = change;
  // A LINE OF THE GROUP CHAT IS DRAWN AS IT COMES (goal/G3.10): its goal is on no List, so it is no row. A gap
  // may have swallowed one, so the chat is read again with the List.
  if (gap) deskAskGroup().then(deskDraw, function () { /* shown as it stands */ });
  var said = obj.item;
  if (typeof said === 'string') { try { said = JSON.parse(said); } catch (e) { said = null; } }
  if (!gap && obj.verb === 'chat.add' && said && said.id === DESK_GROUP && obj.chat) {
    if (deskGroup && !deskGroup.some(function (l) { return deskSameLine(l, obj.chat); })) deskGroup.push(obj.chat);
    deskDraw();
    return;
  }
  if (gap || obj.verb === 'session.set') { deskSearchItems(); return; }
  // Every row it changed (desk/G3.10), else the one item as before.
  var rows = Array.isArray(obj.rows) && obj.rows.length ? obj.rows : null;
  if (!rows) {
    var it = obj.item;
    if (typeof it === 'string') { try { it = JSON.parse(it); } catch (e) { it = null; } }
    if (!it || !it.id) return;
    rows = [Object.assign({}, it, { listed: obj.listed !== false })];
  }
  var unknown = false;
  rows.forEach(function (row) {
    if (!row || !row.id) return;
    var at = -1;
    deskItems.forEach(function (r, i) { if (r.id === row.id) at = i; });
    if (row.listed === false) { if (at !== -1) deskItems.splice(at, 1); }
    else if (at !== -1) deskItems[at] = row;
    else unknown = true;
  });
  if (unknown) { deskSearchItems(); return; }
  deskDraw();
}
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

var DESK_PRESS_LABEL = { go: 'Go!', done: 'Done', close: 'Close', 'bring-back': 'Bring back' };
// NOT IN A ROW: Go all sits in the tab bar (desk/G3.4), and Reopen only in the item's dialog (desk/G3.6, Andy:
// "the Re-Open button should never be shown in the list").
var DESK_NOT_IN_ROW = ['go-all', 'reopen'];
// CLOSE BEFORE HIS GO IS THE DIALOG'S ALONE (goal/G3.9). Andy, 2026-10-03: "the close-with arm is only visible on
// the item detail". A done row keeps its Close as before.
// THE GOAL ROW KEEPS ITS CLOSE (goal/G6.6): the goal's Close appears in the List too, and asks "are you sure?" first
// while any of its items is open (deskGoalCloseClick, below).
function deskInRow(row, what) {
  if (DESK_NOT_IN_ROW.indexOf(what) !== -1) return false;
  if (what === 'close' && row.status !== 'done' && !(row.goal === '')) return false;
  return true;
}
function deskRowHtml(row) {
  var goal = row.goal === '';
  var presses = (row.buttons || []).filter(function (what) { return deskInRow(row, what); }).map(function (what) {
    // goal/G6.6: the Close on a goal row with open items is armed with "are you sure? N open"; the shell paints
    // data-armed red. A click on the armed button sends the press.
    var armed = goal && what === 'close' && deskArmed === 'desk-goal-close-' + row.id;
    var open = goal && what === 'close' ? (row.blocked || []).length : 0;
    var label = armed ? 'are you sure? ' + open + ' open' : (DESK_PRESS_LABEL[what] || what);
    return '<button type="button" data-press="' + deskEsc(what) + '" data-id="' + deskEsc(row.id) + '"' +
      (armed ? ' data-armed="1"' : '') + '>' + deskEsc(label) + '</button>';
  }).join(' ');
  return '<tr data-row="' + deskEsc(row.id) + '" style="cursor:pointer' + (goal ? ';font-weight:bold' : '') + '">' +
    // THE BROUGHT-BACK MARK, THEN THE TYPE (desk/G1.12): the server says both. ICON.ERROR EXACTLY WHILE SOMETHING
    // WAITS ON HIM (goal/G4.20 points 10-11). Andy: "if those two things would match at all times, id know exactly
    // where i need to navigate to."
    '<td>' + (row.alert ? DESK_ALERT : '') + '</td>' +
    '<td>' + (goal ? '' : deskIcon(Number(row.asks) > 0 ? 'ERROR' : 'CODE')) + '</td>' +
    '<td title="' + deskEsc(row.title) + '">' + deskEsc(row.title) + ' <span class="job-manifest-note">(' + deskEsc(row.id) + ')</span></td>' +
    '<td>' + deskEsc(row.with || '') + '</td>' +
    '<td>' + presses + '</td>' +
    '<td>' + deskLinks(row.blocking) + '</td>' +
    '<td>' + deskLinks(row.blocked) + '</td>' +
    '<td>' + deskEsc(row.status || '') + '</td>' +
  '</tr>';
}
// The toggles say how they stand; the server does the filtering.
function deskDrawToggles() {
  [['desk-current-goal', 'Current Goal Only', deskFilter.currentGoalOnly], ['desk-goals-only', 'Goals Only', deskFilter.goalsOnly],
    ['desk-include-closed', 'Include Closed', deskFilter.includeClosed]].forEach(function (t) {
    var b = document.getElementById(t[0]);
    if (!b) return;
    b.textContent = t[1] + (t[2] ? ' ✓' : '');
    b.style.fontWeight = t[2] ? 'bold' : 'normal';
  });
}
function deskTable() {
  if (!deskItems.length) return '<div class="job-manifest-note">Nothing to show.</div>';
  var head = '<tr><th></th><th></th><th>to-do</th><th>with</th><th>yours</th><th>blocks</th><th>waits on</th><th>status</th></tr>';
  return '<table class="jobs-table"><thead>' + head + '</thead><tbody>' + deskItems.map(deskRowHtml).join('') + '</tbody></table>';
}

// The bubble at the top of Team: the goal, by title, and a line that opens it.
function deskSessionBubble() {
  var g = deskGoalRow();
  if (!g) {
    return '<div class="stat-tile wide"><div class="label">Design session</div>' +
      '<div class="job-manifest-note">Blank. The lead fills in the goal as we talk.</div></div>';
  }
  return '<div class="stat-tile wide"><div class="label" data-open="' + deskEsc(g.id) + '" style="cursor:pointer">' +
    deskEsc(g.id) + ' — ' + deskEsc(g.title) + '</div></div>';
}


// ── THE DIRECT CHAT TO THE LEAD, BELOW THE LIST ─────────────────────
//
// What passed between Andy and the lead with NO row: his untagged lines to
// the lead's key, and the lead's untagged lines to him. Board posts, claims
// and reports are not conversation. Repainted on arrival, with the input
// box outside the repainted part so his typing survives.
// NEWEST FIRST, INPUT ON TOP. Andy, 2026-09-28: "i want my input at the top
// if the chat log, and the log shows the last message at the top, the second
// last shows second etc... then the most relevant chat entries will be at
// the top". Every chat in Desk and its dialogs is drawn this way.
// ── A CHAT LINE, DRAWN READABLY (desk/G1.10) ────────────────────────
//
//   Andy: "it would be nice if the chat log here would show some nicer
//   formatting", then "yes, that would make it much more readable."
//
// Escaped FIRST, then formatted, so a line's text never becomes markup.
// Line breaks kept; '- ' lines become a list; `backquoted` text is code; the
// time is the local HH:MM; a session post is one line naming its goal, never
// its JSON. Its twin is ddLineHtml in deskDetails.js: change both or neither.
function deskTime(at) {
  var d = new Date(at);
  if (isNaN(d.getTime())) return deskEsc(at);
  var two = function (n) { return (n < 10 ? '0' : '') + n; };
  return two(d.getHours()) + ':' + two(d.getMinutes());
}
function deskLineHtml(m) {
  if (m && m.kind === 'session') {
    var g = null;
    try { g = JSON.parse(String(m.text)).goal; } catch (e) { g = null; }
    return '<i>the goal record was updated' + (g ? ': ' + deskEsc(g.id) + ' — ' + deskEsc(g.title) : '') + '</i>';
  }
  var out = [];
  var list = [];
  var flush = function () { if (list.length) { out.push('<ul style="margin:2px 0 2px 18px">' + list.join('') + '</ul>'); list = []; } };
  String(m && m.text || '').split('\n').forEach(function (raw) {
    var line = deskEsc(raw).replace(/`([^`]+)`/g, '<code>$1</code>');
    if (/^- /.test(raw)) { list.push('<li>' + line.slice(2) + '</li>'); return; }
    flush();
    out.push(line);
  });
  flush();
  return out.join('<br>').replace(/<br>(<ul)/g, '$1').replace(/(<\/ul>)<br>/g, '$1');
}

// ── MUSINGS: HIS THOUGHTS FOR LATER, NOT A CONVERSATION ─────────────
//
// Andy: "now i need something that lets me pipe stuff to voice.jsonl
// bypassing scoreboard issues", "ideas deferred to close-time". So a
// musing belongs to no row and expects no reply: kind `musing`, sent to
// the lead, listed here in order, and gone through with him at close.
function deskMusings() {
  var lines = deskMessages.filter(function (m) { return m.dir === 'out' && m.kind === 'musing'; });
  if (!lines.length) return '<div class="job-manifest-note">Nothing logged yet. What you write here waits for close time; nobody answers it now.</div>';
  // EACH MUSING A BUBBLE (goal/G6.3). Andy, FACE.md: "each musing in the log should be in a separate bubble, possibly
  // with the same background color as the header area." and "vertical spacing between input text area and each bubble
  // in the log: 1em". The header area's background is #desk-bars' (#1a1a2e); 1em above every bubble.
  return lines.slice().reverse().map(function (m) {
    return '<div style="margin-top:1em;padding:6px 10px;background:#1a1a2e;border-radius:var(--spirit-radius,8px)">' +
      '<span class="job-manifest-note">' + deskTime(m.at) + '</span> ' + deskLineHtml(m) + '</div>';
  }).join('');
}

// ── TEAM: THE GROUP CHAT, ANDY AND EVERY AGENT ──────────────────────
//
//   Andy, 2026-09-27: "so one more chat we need in the tabs, that's
//   group-chat. there we can design and add requirements. just the group
//   chat for me and the agents for now. no contract agreement tracking
//   yet." — "call it "team"" — "so we don't pullute a requirement with
//   out-of scope talks".
//
// The design-mode proposal (AGENTS-UI.md) cut down to what he asked for:
// a chat and nothing else. It rides as an ordinary thread whose todo is
// DESK_TEAM, which is on no board, so the List never shows it. His line
// goes to every agent heard from in the last day. An agent answers under
// the same todo to Andy AND to the other agent, so its line reaches Andy
// twice (once direct, once as the report of the agent-to-agent copy), and
// the chat folds that to one.
var DESK_TEAM = 'team/chat';

// ── THE GROUP CHAT, UNDER ALL (goal/G3.10) ──────────────────────────
//
//   Andy, 2026-10-02: "This looks like a perfect team chat. Is it because
//   it has a coal/item to anchor it?", then "when deskServer Starts up, it
//   makes sure there is a closed goal with the id 'desk/G0.0', instead of
//   the team-chat box, the 'all' tab displays the chat box for
//   'desk/G0.0'", and "for now, we just show the chat box under all".
//
// The All tab is that goal's chat, held by the desk server: one record, in
// one order, that he and every agent write with chat.add. It replaced the
// team box, which drew the packets this page had recorded under DESK_TEAM
// and posted his line to each agent as a packet; with the agents app gone
// no agent could answer there. Read once (item.chat), then drawn from what
// the server publishes ("no pulling").
var DESK_GROUP = 'desk/G0.0';
var deskGroup = null;   // its lines as the server holds them, oldest first; null until read
function deskSameLine(a, b) { return a.by === b.by && a.at === b.at && a.text === b.text; }
function deskAskGroup() {
  return deskAsk('item.chat', { id: DESK_GROUP }).then(function (r) { deskGroup = Array.isArray(r.chat) ? r.chat : []; });
}
function deskGroupChat() {
  if (deskGroup === null) return '<div class="job-manifest-note">The group chat has not been read yet.</div>';
  if (!deskGroup.length) return '<div class="job-manifest-note">Nothing said yet. What you write here is read by every agent.</div>';
  // EVERY LINE A BUBBLE, LEFT-ALIGNED, 1em APART (goal/G6.2). Andy, FACE.md: "I want all my chat-log entries to be
  // left-aligned, not right-aligned." / "i want chat log entries for everybody to display in bubbles, separated
  // vertically be 1em space." His bubble black on white; everybody else's a filled bubble with the shell's radius.
  return deskGroup.slice().reverse().map(function (l) {
    var mine = l.by === 'andy';
    var look = mine
      ? ' style="margin:1em 0;padding:6px 10px;background:#000;color:#fff;border-radius:var(--spirit-radius,8px)"'
      : ' style="margin:1em 0;padding:6px 10px;background:rgba(255,255,255,0.08);border-radius:var(--spirit-radius,8px)"';
    return '<div' + look + '><b>' + deskEsc(mine ? 'you' : l.by) + '</b> <span class="job-manifest-note">' +
      deskTime(l.at) + '</span> ' + deskLineHtml({ text: l.text }) + '</div>';
  }).join('');
}
// His line under All: one chat.add on the group chat's goal, and no packet to
// anybody. The line is drawn when the server publishes it, like everybody's.
function deskGroupSay() {
  var box = document.getElementById('desk-team-say');
  var err = document.getElementById('desk-team-error');
  var said = box ? String(box.value || '').trim() : '';
  if (!said || deskSending['desk-team-say']) return;
  deskSending['desk-team-say'] = true;
  if (err) err.textContent = 'Sending…';
  deskAsk('chat.add', { id: DESK_GROUP, text: said }).then(function () {
    deskSending['desk-team-say'] = false;
    if (box) box.value = '';
    if (err) err.textContent = '';
  }, function (e) {
    // What he typed stays in the box: an unkept line is his to send again.
    deskSending['desk-team-say'] = false;
    if (err) err.textContent = 'Not kept: ' + ((e && e.message) || e);
  });
}

// Ending design mode is his decision, said in Team: an `answer` with the
// fixed words, which Desk reads back (deskDesignOn) and the agents obey.
// NEITHER BY ACCIDENT (desk/G1.12). Andy: "re-arm both design on and off,
// neither should be an accident." The first press arms the button and asks
// "sure?"; only a second press fires it. HIS HARD RULE FOR EVERY ARMED
// BUTTON (armedButtons.js, AGENT.md): it disarms the moment he clicks
// anywhere else, through the shell's one mechanism, and it carries
// data-armed so the shell paints it red.
var deskArmed = '';
function deskDisarm() { deskArmed = ''; deskDrawTabs(); deskDrawGoAll(); deskDraw(); }
// goal/G6.6: a goal's Close in the List, asking "are you sure?" while any of its items is open; nothing open sends
// at once. The arm pattern paints the button red (armedButtons.js) and clicking again sends.
function deskIsGoal(id) { return deskItems.some(function (r) { return r.id === id && r.goal === ''; }); }
function deskGoalCloseClick(gid) {
  var row = deskItems.filter(function (r) { return r.id === gid; })[0];
  var open = row ? (row.blocked || []).length : 0;
  var armId = 'desk-goal-close-' + gid;
  if (open === 0) { deskDisarm(); deskPress(gid, 'close'); return; }
  if (deskArmed === armId) { deskArmed = ''; deskDraw(); deskPress(gid, 'close'); return; }
  deskArmed = armId;
  deskDraw();
  if (deskApi && deskApi.armUntilElsewhere) deskApi.armUntilElsewhere(deskDisarm);
}
function deskArmOrFire(id, fire) {
  if (deskArmed === id) { deskDisarm(); fire(); return; }
  deskArmed = id;
  deskDrawTabs();
  deskDrawGoAll();
  if (deskApi && deskApi.armUntilElsewhere) deskApi.armUntilElsewhere(deskDisarm);
}
// GO ALL (desk/G3.4). Andy: "i should have a go-all button for fixing rounds",
// "the go all should be on the right side of the button bar in list", "and be the
// armed-type". Shown while the goal's buttons offer it; the server decides which
// items it goes.
function deskDrawGoAll() {
  var b = document.getElementById('desk-go-all');
  if (!b) return;
  var g = deskGoalRow();
  var armed = deskArmed === 'desk-go-all';
  b.hidden = !(deskTab === 'list' && g && (g.buttons || []).indexOf('go-all') !== -1);
  b.textContent = armed ? 'Go all: sure?' : 'Go all';
  if (b.setAttribute) b.setAttribute('data-armed', armed ? '1' : '');
}
function deskGoAll() { var g = deskGoalRow(); if (g) deskPress(g.id, 'go-all'); }
// A PRESS ON THE GOAL, NOT A LINE (desk/G2.6): design mode is the server's.
function deskEndDesign() { var g = deskGoalRow(); if (g) deskPress(g.id, 'end-design'); }
// With no goal on the List, Start design starts a new one (desk/G3.1): the server names it goal/G<n>.
// A closed goal row (shown at startup, desk/G3.2) is not an open goal: Start design starts a new one.
function deskStartDesign() { var g = deskGoalRow(); deskPress(g && g.status !== 'closed' ? g.id : '', 'start-design'); }
// ONE recipient, so one row in his record per line: nothing to fold.
// ONE SEND PER BOX AT A TIME. Andy's half-typed line reached the lead EIGHT
// times in 1.6 s: eight distinct posts from this page, because a held or
// repeated Enter fired again before the first send had cleared the box. So
// key auto-repeat is ignored, and a box with a send in flight sends nothing
// more until it settles.
var deskSending = Object.create(null);
// To the agent named, or to the lead.
// A MUSING NEEDS NO LEAD (desk/G3.9). Andy: "Why would it require a lead to
// update my musings?" It goes to the desk server alone, into its log
// (deskRecord); no agent is sent anything.
function deskMuse() {
  var box = document.getElementById('desk-muse');
  var err = document.getElementById('desk-muse-error');
  var said = box ? String(box.value || '').trim() : '';
  if (!said || deskSending['desk-muse']) return;
  // A MUSING SAYS WHAT IT IS. Andy: "\"note to self: \" should be a prefix in
  // the musings chat". Added once, and never twice when he types it himself.
  if (!/^note to self:/i.test(said)) said = 'note to self: ' + said;
  deskSending['desk-muse'] = true;
  var line = deskOutgoing('', { from: 'andy', kind: 'musing', text: said }, { ok: true });
  deskRecord([line]).then(function (kept) {
    deskSending['desk-muse'] = false;
    // Only a kept musing leaves the box; an unkept one stays for him to log again.
    if (!kept) { if (err) err.textContent = 'Not kept: the desk server did not take it.'; return; }
    box.value = '';
    if (err) err.textContent = '';
  });
}
// HIS DIRECT LINE TO ONE AGENT STOOD HERE (deskSend, with the desk's busy reply of goal/G2.5) and went with
// goal/G3.12: the page posts no agents packet any more. What he says to the team is one chat.add on the group
// chat (deskGroupSay); what he says about an item goes under the item. The desk server answers a line to a busy
// agent itself (desk.js chat.add).

// A ROW OPENS ITS OWN DIALOG. Andy: "we need a DeskDetails immediately,
// with inputs specific to the item" — and the inline thread this replaced
// erased his typing on every arrival ("also my typing gets erased,
// everytime somebody sends something"). The table holds no input, so a
// repaint on arrival costs him nothing.
function deskDraw() {
  deskDrawGoAll();
  var el = document.getElementById('desk-top');
  if (!el) return;
  var musings = document.getElementById('desk-musings');
  if (musings) musings.innerHTML = deskMusings();
  var backup = document.getElementById('desk-backup');
  if (backup) backup.innerHTML = deskBackupHtml();
  var team = document.getElementById('desk-team');
  if (team) team.innerHTML = deskGroupChat();
  var bubble = document.getElementById('desk-session');
  if (bubble) bubble.innerHTML = deskSessionBubble();
  var goal = document.getElementById('desk-goal');
  if (goal) {
    var g = deskGoalRow();
    goal.hidden = !g;
    goal.textContent = g ? g.title + ' (' + g.id + ')' : '';
  }
  var design = deskDesignOn();
  var banner = document.getElementById('desk-design');
  if (banner) banner.hidden = !design;
  // A chat on screen is being seen as it arrives.
  if (deskTab === 'team') deskMarkTeamSeen();
  deskDrawTabs();
  el.innerHTML = (deskError ? '<div class="job-start-error">' + deskEsc(deskError) + '</div>' : '') +
    deskTable();
}

// ── THE RULES TAB (goal/G6.5) ─────────────────────────────────────────
//
//   The box: "A new tab "Rules" between "Team" and "Musings": 1. The new bubble: type, label, text and a new button:
//   rule.add (the rule comes in proposed; agents may add one too). 2. The search bubble: a search box and 7 toggles
//   (ui, code, design, desk; proposed, active, deleted): rules.search {text, types, statuses}. 3. The list, a row per
//   rule: status (proposed ICON.EDIT, active ICON.LOCK, deleted ICON.DEAD), label, type, key; a row opens ruleDetails
//   (goal/G6.4)."
//
// The server does the searching and the filtering, as for the List. A toggle that is on narrows to its value; with
// none on in a group, that group is not narrowed (rules.search reads an empty list as all).
var DESK_RULE_TYPES = ['ui', 'code', 'design', 'desk'];
var DESK_RULE_STATUSES = ['proposed', 'active', 'deleted'];
var DESK_RULE_ICON = { proposed: 'EDIT', active: 'LOCK', deleted: 'DEAD' };
var deskRuleFilter = { text: '', types: [], statuses: [] };
var deskRules = [];
var deskRulesNote = '';
function deskRulesSearch() {
  var f = deskRuleFilter;
  return deskAsk('rules.search', { text: f.text, types: f.types.slice(), statuses: f.statuses.slice() }).then(function (r) {
    deskRules = (r.items || []).map(function (p) {
      var l = {};
      try { l = JSON.parse(p.label); } catch (e) { l = {}; }
      return { key: String(p.key), label: String(l.label || ''), type: String(l.type || ''), status: String(l.status || '') };
    });
    deskRulesNote = r.more ? 'More rules match than are shown: narrow the search.' : '';
    deskDrawRules();
  }, function (e) { deskRulesNote = 'Not searched: ' + e.message; deskDrawRules(); });
}
function deskDrawRules() {
  var toggles = document.getElementById('desk-rule-toggles');
  if (toggles) {
    toggles.innerHTML = DESK_RULE_TYPES.map(function (v) { return [v, 'types']; }).concat(DESK_RULE_STATUSES.map(function (v) { return [v, 'statuses']; }))
      .map(function (p) {
        var on = deskRuleFilter[p[1]].indexOf(p[0]) !== -1;
        return '<button type="button" data-rule-toggle="' + p[0] + '" style="font-weight:' + (on ? 'bold' : 'normal') + '">' + p[0] + (on ? ' ✓' : '') + '</button>';
      }).join(' ');
  }
  var note = document.getElementById('desk-rule-error');
  if (note) note.textContent = deskRulesNote;
  var list = document.getElementById('desk-rule-list');
  if (!list) return;
  if (!deskRules.length) { list.innerHTML = '<div class="job-manifest-note">No rule matches.</div>'; return; }
  list.innerHTML = '<table class="jobs-table"><thead><tr><th></th><th>Label</th><th>Type</th><th>Key</th></tr></thead><tbody>' +
    deskRules.map(function (r) {
      return '<tr data-rule="' + deskEsc(r.key) + '" style="cursor:pointer"><td title="' + deskEsc(r.status) + '">' + deskIcon(DESK_RULE_ICON[r.status] || '') + '</td>' +
        '<td>' + deskEsc(r.label) + '</td><td>' + deskEsc(r.type) + '</td><td>' + deskEsc(r.key) + '</td></tr>';
    }).join('') + '</tbody></table>';
}
function deskRuleToggle(v) {
  var group = DESK_RULE_TYPES.indexOf(v) !== -1 ? 'types' : DESK_RULE_STATUSES.indexOf(v) !== -1 ? 'statuses' : '';
  if (!group) return;
  var on = deskRuleFilter[group];
  var i = on.indexOf(v);
  if (i === -1) on.push(v); else on.splice(i, 1);
  deskDrawRules();
  deskRulesSearch();
}
// The text as he typed it: a rule is a paragraph with its line breaks (goal/G5.5); the server normalizes and limits it.
function deskRuleAdd() {
  var val = function (id) { var el = document.getElementById(id); return el ? String(el.value || '') : ''; };
  var type = val('desk-rule-type');
  var label = val('desk-rule-label');
  var text = val('desk-rule-text');
  if (!label.trim() || !text.trim()) { deskRulesNote = 'A rule needs a label and a text.'; deskDrawRules(); return; }
  deskAsk('rule.add', { type: type, label: label, text: text }).then(function () {
    ['desk-rule-label', 'desk-rule-text'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
    deskRulesNote = '';
    deskRulesSearch();
  }, function (e) { deskRulesNote = 'Not added: ' + e.message; deskDrawRules(); });
}
function deskOpenRule(key) { deskApi.callDialog('shell/ruleDetails', { key: key }).then(function () { deskRulesSearch(); }, function () {}); }

// ONE ROW'S DIALOG, from the List or from the Team bubble. Andy: "i want to
// be able to click on items in the bubble in team and see the details".
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
// The List is items.search's answer (deskSearchItems). The chats read their
// newest page. The lines under DESK_TEAM are still read, once: who the agents
// and the lead are is learned from them (deskFold); they are drawn nowhere
// since the All tab became the group chat (goal/G3.10), so nothing reads older
// ones any more.
var deskLoaded = false;
function deskLoad() {
  var seenRaw = '';
  var reads = [
    deskAsk('seen.get', {}).then(function (r) { seenRaw = r.json || ''; }, function () { seenRaw = ''; }),
    deskSearch({ todo: DESK_TEAM }).then(function (r) { deskTake(r.lines); }),
    deskAskGroup(),
    deskSearch({ kind: 'musing' }).then(function (r) { deskTake(r.lines); }),
    deskSearch({ todo: '-' }).then(function (r) { deskTake(r.lines); }),
    deskAskBackup(),
  ];
  return Promise.all(reads.map(function (p) { return p.catch(function (e) { deskError = 'Desk could not read: ' + ((e && e.message) || e); }); }))
    .then(function () {
      deskLoaded = true;
      deskLoadSeen(seenRaw);
      deskDraw();
    });
}
// AN AGENT'S QUEUE IN ITS TAB STOOD HERE (desk/G1.5 D1, pending.get) and went with the agent tabs (goal/G3.12):
// with no tab per agent there is no place that shows one agent's queue. His own queue is still the List.

// ── THE BACKUP, SEEN FROM DESK (desk/G1.7, T7) ───────────────────────
//
//   Andy: "how can i trust the copy mechanist when i cant see it working".
// The backup server's status.get: its last check and last copy, marked red
// when something was closed after the last check.
var deskBackup = null;
function deskAskBackup() {
  return Promise.resolve(deskApi.verb('jobs.api', { ask: { backup: { 'status.get': {} } } })).then(function (r) {
    deskBackup = r && r.status === 200 && r.body && r.body.ok !== false ? r.body : null;
    deskDraw();
  }, function () { deskBackup = null; });
}
function deskBackupHtml() {
  if (!deskBackup) return '';
  var stale = false;
  return '<div class="' + (stale ? 'job-start-error' : 'job-manifest-note') + '">Backup: last check ' +
    (deskBackup.lastCheck ? deskTime(deskBackup.lastCheck) : 'never') + ', last copy ' +
    (deskBackup.lastCopy ? deskTime(deskBackup.lastCopy) : 'never') +
    (stale ? '; something was closed since the last check' : '') + '</div>';
}

// THE HEADER AREA IS THE SHELL'S (goal/G6.1): the block written as #desk-bars moves into the app header, which sticks it
// under the titlebar, and takes its id.
function deskHeader(api) {
  var old = document.getElementById('desk-bars');
  var els = api && api.ui && api.ui.elements;
  if (!old || !els || typeof els.createAppHeader !== 'function') return;
  var head = els.createAppHeader();
  head.id = 'desk-bars';
  head.style.paddingBottom = '4px';
  while (old.firstChild) head.appendChild(old.firstChild);
  old.parentNode.replaceChild(head, old);
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
    container.innerHTML =
      // THE GOAL IS DESK'S TITLE. Andy: "the desk title bar should be synced
      // to the title of the goal, the game being: bring the goal item back up
      // to be ever closer to the title bar saying the same." Shown while a
      // design session's goal is open; the shell's own bar is not Desk's.
      '<div id="desk-design" class="stat-tile wide" style="background:#fff3c4;color:#000" hidden>' +
        '<b>Design mode.</b> Nothing is built until it ends, and it ends only in the Team tab.</div>' +
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
      '<div id="desk-bars" style="padding-bottom:4px">' +
        // The goal line is pinned with the tabs (desk/G1.12). Andy: "this part
        // of the list page should be attached below the title bar, and not
        // scroll away."
        '<div id="desk-goal" class="stat-tile wide" style="font-size:1.25em;font-weight:bold;cursor:pointer" title="Open the goal: talk about it under its own id" hidden></div>' +
        // GO ALL at the right of the tab bar, on the List tab only, as the design
        // buttons are on Team's (desk/G3.4, Andy: "same as design buttons when team is active").
        '<div style="display:flex;align-items:center"><div class="start-job-form card" id="desk-tabs" style="flex:1"></div>' +
          '<button type="button" id="desk-go-all" hidden>Go all</button></div>' +
      '</div>' +
      '<div id="desk-root">' +
        // THE SEARCH BAR TOPS THE LIST (desk/G2.6). Andy: "all list displays in
        // the UI now must be topped by a search input bar", "The server does the
        // searching AND the filtering", "When Desk opens: [Current Goal Only] on,
        // [Goals Only] off". Outside the repainted table, so typing survives.
        '<div data-pane="list"><div id="desk-backup"></div>' +
          '<div class="start-job-form card"><input id="desk-search" placeholder="search">' +
          '<button type="button" id="desk-current-goal"></button>' +
          '<button type="button" id="desk-goals-only"></button>' +
          // [INCLUDE CLOSED] (goal/G4.20 point 1), off when Desk opens.
          '<button type="button" id="desk-include-closed"></button>' +
          '</div>' +
          '<div id="desk-top"></div></div>' +
        '<div data-pane="team" hidden>' +
          '<div id="desk-session"></div>' +
          '<div class="start-job-form card"><label class="field-label grow">Say' +
            // SEVERAL LINES, AND RETURN IS A NEW LINE (desk/G1.12): only Send sends.
            '<textarea id="desk-team-say" rows="3" placeholder="to every agent; design talk that belongs to no row"></textarea></label>' +
          '<button type="button" id="desk-team-send">Send</button></div>' +
          '<div id="desk-team-error" class="job-start-error"></div>' +
          '<div class="stat-tile wide"><div class="label" id="desk-team-label">Team: you and every agent, newest first</div><div id="desk-team"></div></div>' +
        '</div>' +
        // THE RULES TAB (goal/G6.5): the new bubble, the search bubble, the list. #desk-rules takes every click and input.
        '<div data-pane="rules" hidden><div id="desk-rules">' +
          '<div class="start-job-form card">' +
            '<label class="field-label">Type<select id="desk-rule-type">' +
              DESK_RULE_TYPES.map(function (v) { return '<option value="' + v + '">' + v + '</option>'; }).join('') + '</select></label>' +
            '<label class="field-label grow">Label<input id="desk-rule-label" placeholder="the rule in a few words"></label>' +
            '<label class="field-label grow">Text<textarea id="desk-rule-text" rows="3" placeholder="the rule; up to 2048 bytes, line breaks kept"></textarea></label>' +
            '<button type="button" id="desk-rule-add">New</button></div>' +
          '<div class="start-job-form card"><input id="desk-rule-search" placeholder="search rules"><span id="desk-rule-toggles"></span></div>' +
          '<div id="desk-rule-error" class="job-start-error"></div>' +
          '<div id="desk-rule-list"></div>' +
        '</div></div>' +
        '<div data-pane="musings" hidden>' +
          '<div class="start-job-form card"><label class="field-label grow">Muse' +
            '<textarea id="desk-muse" rows="3" placeholder="a thought for later; nobody answers it now"></textarea></label>' +
          '<button type="button" id="desk-muse-send">Log</button></div>' +
          '<div id="desk-muse-error" class="job-start-error"></div>' +
          '<div class="stat-tile wide"><div class="label">Musings, for close time, newest first</div><div id="desk-musings"></div></div>' +
        '</div>' +
        // AN AGENT'S SCOPE (goal/G4.23), opened from its bubble.
        '<div data-pane="agent" hidden>' +
          '<div class="stat-tile wide"><div class="label" id="desk-agent-label"></div><div id="desk-agent"></div></div>' +
          '<div class="stat-tile wide"><div class="label">Add a folder</div><div id="desk-agent-picker"></div></div>' +
        '</div>' +
      '</div>';
    deskHeader(api);
    function show(tab) {
      var pane = tab.indexOf('agent:') === 0 ? 'agent' : tab;
      Array.prototype.forEach.call(container.querySelectorAll('[data-pane]'), function (p) {
        p.hidden = p.getAttribute('data-pane') !== pane;
      });
      if (pane === 'agent') deskAgentOpen(tab.slice('agent:'.length));
      // HIGHLIGHTED, NOT DISABLED. Andy: "on the desk app, the current tab
      // should be highlighted." A disabled button read as greyed out.
      deskTab = tab;
      deskDrawGoAll();
      if (tab === 'team') deskMarkTeamSeen();
      if (tab === 'rules') deskRulesSearch();
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
      if (!el) return;
      if (el.id === 'desk-end-design') deskArmOrFire(el.id, deskEndDesign);
      else if (el.id === 'desk-start-design') deskArmOrFire(el.id, deskStartDesign);
      else if (el.getAttribute && el.getAttribute('data-tab')) show(el.getAttribute('data-tab'));
    });
    show('list');
    // ONE LISTENER ON THE LIST, which is repainted: a press, a link, a row.
    document.getElementById('desk-top').addEventListener('click', function (e) {
      var t = e && e.target;
      var press = t && t.closest && t.closest('[data-press]');
      if (press) {
        if (e.stopPropagation) e.stopPropagation();
        var what = press.getAttribute('data-press');
        var id = press.getAttribute('data-id');
        // goal/G6.6: Close on a goal with open items asks "are you sure?" first; nothing open sends at once.
        if (what === 'close' && deskIsGoal(id)) { deskGoalCloseClick(id); return; }
        deskPress(id, what);
        return;
      }
      var link = t && t.closest && t.closest('[data-open]');
      if (link) { if (e.preventDefault) e.preventDefault(); deskOpenRow(link.getAttribute('data-open')); return; }
      var row = t && t.closest && t.closest('[data-row]');
      if (row) deskOpenRow(row.getAttribute('data-row'));
    });
    document.getElementById('desk-search').addEventListener('input', function () {
      deskFilter.text = String(document.getElementById('desk-search').value || '');
      deskSearchItems();
    });
    document.getElementById('desk-current-goal').addEventListener('click', function () {
      deskFilter.currentGoalOnly = !deskFilter.currentGoalOnly;
      // EXCLUSIVE, goal/G9.2. Andy: "only one of the two buttons ... may be selected at the same time."
      if (deskFilter.currentGoalOnly) deskFilter.goalsOnly = false;
      deskDrawToggles();
      deskSearchItems();
    });
    document.getElementById('desk-goals-only').addEventListener('click', function () {
      deskFilter.goalsOnly = !deskFilter.goalsOnly;
      if (deskFilter.goalsOnly) deskFilter.currentGoalOnly = false;
      deskDrawToggles();
      deskSearchItems();
    });
    document.getElementById('desk-include-closed').addEventListener('click', function () {
      deskFilter.includeClosed = !deskFilter.includeClosed;
      deskDrawToggles();
      deskSearchItems();
    });
    deskDrawToggles();
    document.getElementById('desk-rules').addEventListener('click', function (e) {
      var t = e && e.target;
      if (!t) return;
      var toggle = t.closest && t.closest('[data-rule-toggle]');
      if (toggle) { deskRuleToggle(toggle.getAttribute('data-rule-toggle')); return; }
      if (t.id === 'desk-rule-add') { deskRuleAdd(); return; }
      var row = t.closest && t.closest('[data-rule]');
      if (row) deskOpenRule(row.getAttribute('data-rule'));
    });
    document.getElementById('desk-rules').addEventListener('input', function (e) {
      if (!e || !e.target || e.target.id !== 'desk-rule-search') return;
      var el = document.getElementById('desk-rule-search');
      deskRuleFilter.text = String((el && el.value) || e.target.value || '');
      deskRulesSearch();
    });
    document.getElementById('desk-go-all').addEventListener('click', function () { deskArmOrFire('desk-go-all', deskGoAll); });
    document.getElementById('desk-muse-send').addEventListener('click', deskMuse);
    document.getElementById('desk-team-send').addEventListener('click', deskGroupSay);
    // The bubble is repainted on every arrival, so one listener on its box.
    document.getElementById('desk-session').addEventListener('click', function (e) {
      var el = e.target;
      while (el && el !== e.currentTarget && !(el.getAttribute && el.getAttribute('data-open'))) el = el.parentNode;
      var id = el && el.getAttribute && el.getAttribute('data-open');
      if (id) deskOpenRow(id);
    });
    // THE TITLE LINE OPENS THE GOAL. Andy: "if i could also click on the
    // title to move the discussion to the detail of the requirement, then
    // our discussion would be logged under that requirement".
    document.getElementById('desk-goal').addEventListener('click', function () {
      var g = deskGoalRow();
      if (g) deskOpenRow(g.id);
    });
    // Its own log first, then every arrival into it. Subscribed once, at
    // mount, and kept while Desk is hidden behind its dialog, so what
    // arrives while a row is open is logged too.
    // Scrolled to its top, Team reads the page before (T6).
    deskApi.onPacket('agents', function (body, message) { deskRecord([deskArrival(body, message)]); });
    // NO PULLING. Andy: "no pulling". The List asks once, then repaints from
    // what the desk server publishes.
    deskApi.onPublished(deskOnPublished);
    // BACK AFTER A GAP (Andy: "this should work without a hickup"): what was
    // published or said while the stream was down was never heard, so the
    // List and the chats are asked for again. Lines already held are not taken twice.
    if (typeof deskApi.onReconnect === 'function') deskApi.onReconnect(function () { deskSearchItems(); deskLoad(); });
    deskDraw();
    deskSearchItems();
    deskLoad();
  },
});
