'use strict';
// spirit/run/spirit/app/desk/element/desk/desk.js
// ANDY'S DESK FOR TALKING TO THE AGENTS — design/shell/AGENTS-UI.md.
//
//   Andy, 2026-09-27: "it would allow me to send input without
//   interrupting any of you, and your attention can thus be better
//   organized, too" — "my input will be queued, any agent can adress
//   issues in the table, respons to me under that heading".
//
// The face of the desk server (spirit/run/spirit/app/desk): the List tab. Every read and every press is a desk.<verb> ask on the flat
// apiDoor (deskAsk); what changes arrives as the desk server's publish, kept by the desk family's cache manager in
// spirit.required.spirit.data['spirit.app.desk'].data, and the page draws from there. It keeps nothing in its own folder. A row is keyed by its full
// id (goal/G<n> or goal/G<n>.<m>) and opens the item's dialog (spirit/app/desk/element/deskDetails).

// WHAT IT NEEDS, IT GETS ITSELF (goal/G43.24, requirement 9; goal/G43.27, requirement 23): the page is an element of the new
// shell, spirit.required.spirit.app.desk.element.desk.desk, mounted by the Desk app (spirit/app/desk/deskBrowser.js). It is handed no api: deskVia is
// built here from the one spirit object, a family's verb asked through it, its escape, the desk server's publishes heard on
// the stream through the data set's translator (the desk family's cache manager keeps them first), and a dialog opened as a
// layer over the page through panel.js (the mounter's open, or the page's own stack).
// ITS APP'S INTERFACE AND DATA, IT LOADS ITSELF (goal/G47.1, box v142: "all of testicle's elements must subscribe to the
// data they display", and spirit/test/app-child-browser.js for every element under spirit/app/; rule/26): desk's api.js and its
// cache manager, data.js, which the page's one stream feeds; mounted alone, on a page nothing else loaded them on, it has them.
// THE INTERFACES IT CALLS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1; Andy: "EVERY FUCKING ELEMENT REQUIRES THE FUCKING
// INTERFACES IT FUCKING NEEDS"): a require made while this file runs is part of its tree, so whoever requires it waits for them.
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
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/icon/script.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/row/script.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/search/script.js');
if (window.spirit && typeof window.spirit.requireScript === 'function') ['spirit/app/backup/api.js'].forEach(function (p) { Promise.resolve(window.spirit.requireScript(p)).catch(function () {}); });
if (window.spirit && typeof window.spirit.requireScript === 'function') Promise.resolve(keepAnswer('spirit/app/desk/api.js')).catch(function () {});
// Its fields' limits, fieldInput's (rule/26: what it draws with, it loads itself), in its tree so it is in before create.
if (window.spirit && typeof window.spirit.requireScript === 'function') Promise.resolve(keepAnswer('spirit/element/fieldInput/script.js')).catch(function () {});
// ITS FIELDS' TYPES, REQUIRED HERE BY THEIR FULL PATHS (goal/G49.13; Andy: "The UI elements need to know which spirit/type
// their fields are and require that type"): the types fieldInput holds its fields to.
if (window.spirit && typeof window.spirit.requireScript === 'function') { window.spirit.requireScript('spirit/type/string/label/script.js'); }
var deskOpts = {};
var deskStack = null;
// A verb of the branch at its api.js path (goal/G49.6; Andy: "ASKING FOR THE API BY FUCKING NAME MUST BE FUCKING FORBIDDEN"),
// once the page is ready; a dotted verb is a path into it.
function deskVerbCall(api, verb, args) {
  var S = window.spirit;
  return S.callOutcome(Promise.resolve(S.readyPromise).then(function () { return S.requireScript(String(api)); }).then(function (fam) {
    var n = String(verb || '');
    var rest = n;
    var fn = fam && fam[rest];
    if (typeof fn !== 'function') fn = rest.split('.').reduce(function (at, k) { return at ? at[k] : undefined; }, fam);
    if (typeof fn !== 'function') throw new Error('no verb ' + n);
    return fn(args || {});
  }));
}
var deskHeard = [];
var deskHearing = null;
function deskHear(fn) {
  var S = window.spirit;
  deskHeard.push(fn);
  if (!deskHearing) {
    deskHearing = Promise.resolve(keepAnswer('spirit/app/desk/api.js')).then(function () {
      S.required.spirit.data.addTranslator({
        onJob: function (job) {
          if (!(job && job.module === 'spirit.app.desk' && job.app && typeof job.app === 'object')) return;
          deskHeard.slice().forEach(function (h) { try { h(job.app); } catch (e) { /* one listener's fault */ } });
        },
      });
    }, function () { deskHearing = null; });
  }
  return function () { var i = deskHeard.indexOf(fn); if (i !== -1) deskHeard.splice(i, 1); };
}
// A dialog over the page: the element at file, made in a layer of its own kind; its close answers the dialog.
// ONE LAYER PER KIND, FILLED AGAIN FOR EACH ROW (Andy: "after i closed "Fix api branches" the other items won't open for me",
// "all i see, when opening another item is the titlebar of that item"): a closed layer is hidden, not destroyed (panel.js,
// goal/G43.17 Q2/Q3), and the details find their parts by id on the page, so a second layer of the same kind drew into the
// first one's hidden parts and showed only its title bar. So every item opens in the one 'item' layer, and opening
// another row fills that layer again with it.
var deskPanes = {};
function deskDialog(key, label, file, element, params) {
  var S = window.spirit;
  return new Promise(function (resolve) {
    var layer = null;
    var made = null;
    function fillWith(pane) {
      return S.requireScript(file).then(function (dialog) {
        // The dialog asks through the page's own way to the node; its close and its title are its layer's.
        var via = Object.assign({}, deskVia, {
          closeDialog: function (result) { if (layer && typeof layer.hide === 'function') layer.hide(); resolve(result || {}); },
          setScreenTitle: function (text) { if (layer && typeof layer.set === 'function') layer.set({ icon: '🗂️', label: String(text || label) }); },
        });
        return dialog.create(pane, Object.assign({}, params, { via: via }));
      });
    }
    var spec = { icon: '🗂️', label: label, fill: function (pane, closed) {
      deskPanes[key] = pane;
      made = fillWith(pane);
      return made.then(function (m) { return closed() ? null : m; });
    } };
    var opened = typeof deskOpts.open === 'function' ? deskOpts.open(key, spec) : (deskStack ? deskStack.open(key, spec) : null);
    Promise.resolve(opened).then(function (l) {
      layer = l;
      if (!layer) return;
      // The layer was there already: shown as it was left, so it is filled again with this row, under this row's title.
      if (!made && deskPanes[key]) {
        if (typeof layer.set === 'function') layer.set({ icon: '🗂️', label: label });
        fillWith(deskPanes[key]);
      }
      if (typeof layer.show === 'function') layer.show();
    });
  });
}
var deskVia = {
  verb: deskVerbCall,
  escapeHtml: function (t) { return window.spirit.escapeHtml(t); },
  onPublished: function (fn) { return deskHear(fn); },
  callDialog: function (target, params) {
    return deskDialog('item', String(params && params.id), 'spirit/app/desk/element/deskDetails/deskDetails.js', 'deskDetails', params);
  },
};
// THE LIST IS THE DESK SERVER'S (desk/G2.6). Andy: "The server determines all the
// content to be drawn." "no pulling". ITS ROWS ARE spirit.data's (goal/G41.28; Andy: "the FUCKING desk cache is NOT to
// be found in spirit.required.spirit.data.data.desk... something keeps throwing out that shit", and "doesn't the fucking ...
// clientCacheManager.js take care of that"): the desk's rows the cache manager keeps, every goal pushed and every
// search answer seated there, read through spirit.required.spirit.data['spirit.app.desk'].data. The page keeps no rows of its own, so a search that answers
// few rows drops none; what the toggles leave out is decided here, in the order goal, then its members.
function deskKept() { return (typeof window !== 'undefined' && window.spirit && ((window.spirit.required.spirit.data || {}).desk || {}).data) || null; }
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
// The search words and the List's three toggles. Andy: "When Desk opens: [Current Goal Only]
// on, [Goals Only] off"; Include Closed opens off.
var deskFilter = { text: '', currentGoalOnly: true, goalsOnly: false, includeClosed: false };
// THE ROW'S ICON (desk/G1.11): ❌ while something on the item asks Andy ("the ERROR for
// anything i NEED to deal with", "wherever i block"), 💻 on any other item, 📁 on a goal.
// ICONS ARE GLYPHS (goal/G41.1): written as they are, from no icon table.
var deskError = '';

// ── DESK'S RECORD IS THE DESK SERVER'S (desk/G1.4) ──────────────────
//
//   Andy: "desk creates a lot of file-clutter", "lazy-fill of pages seems appropriate", "the
//   list only loads key/title, and the rest lazy loads".
//
// DECIDED (desk/G1, D5 and O9), not this file's to undo: Desk keeps nothing
// in its own folder. The record lives in the desk server (spirit/run/spirit/app/desk, its state in
// spirit/state/desk/data/desk.db), reached by its verbs (desk.<verb>) on the flat apiDoor. The page reads only what
// it shows: the List's search, and each item's own facts and chat in its dialog.

function deskAsk(verb, args) {
  return Promise.resolve(deskVia.verb('spirit/app/desk/api.js', verb, args || {})).then(function (r) {
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
  // THE WHY TOO (goal/G18.10, goal/G10.10): every refusal carries its reason, and the page shows it.
  return body.code + (typeof x.bytes === 'number' ? ': ' + x.bytes + ' bytes, the limit is ' + x.max : '') + (x.why ? ': ' + x.why : '') + (body.error ? ' (' + body.error + ')' : '');
}
function deskWriteError(what) {
  return function (e) { deskError = 'Desk could not ' + what + ': ' + ((e && e.message) || e); deskDraw(); };
}

function deskEsc(s) { return deskVia.escapeHtml(String(s == null ? '' : s)); }

// ── WHAT NEEDS ANDY'S EYE ─────────────────────────────────────────────
//
// What waits on him is the row's ICON.ERROR (facts.asks). An item the desk server marks alert (brought back, or a line
// from the agent holding it: goal/G2.1 note 6, "the attention-grabbing error icon") carries a red ! beside its title
// and id (goal/G33.8, box v13; Andy: "it's enough to put a red ! next to the item"); the row keeps its colour.
var DESK_ALERT = '<span data-alert-mark="1" style="color:#d00;font-weight:bold" title="needs your eye: brought back, or a line from the agent holding it">!</span>';
// The main tab the page opens on, and falls back to: the List.
var deskTab = 'list';

// A tab button: the one showing is marked.
function deskTabButton(attrs, on, label) {
  return '<button type="button" ' + attrs + ' aria-selected="' + (on ? 'true' : 'false') + '" style="font-weight:' +
    (on ? 'bold' : 'normal') + ';text-decoration:' + (on ? 'underline' : 'none') + '">' +
    deskEsc(label) + '</button>';
}

// Drawn whole, as markup: List, then the design button. No Rules tab (goal/G47.4, box v36). No Team or
// Apps tab (goal/G43.22; Andy, the box, Q5: "G0 goes, from ui and server, kept in database.").
function deskDrawTabs() {
  var strip = document.getElementById('desk-tabs');
  if (!strip) return;
  var waiting = deskWaitingOnAndy();
  var design = deskDesignOn();
  strip.innerHTML =
    deskTabButton('data-tab="list"', deskTab === 'list', 'List' + (waiting ? ' (' + waiting + ')' : '')) +
    // ON EVERY TAB, AFTER THE TAB HEADERS (goal/G9.8; Andy: "The [Start/End design] buttons should be displayed always").
    // Its own colour, so it looms (Andy: "so it loooms over the proceedings").
    // ITS COLOUR IS shell.css's, AND ONLY WHILE UNARMED (goal/G41.9, box v3: armed is red): an inline colour won over the
    // shell's armed red.
    '<button type="button" id="desk-end-design" class="desk-design-end"' + (design ? '' : ' hidden') + '>End design mode</button>' +
    // Its twin, in the same spot while design mode is off.
    '<button type="button" id="desk-start-design" class="desk-design-start"' + (!design ? '' : ' hidden') + '>Start design mode</button>';
  // NEITHER BY ACCIDENT (desk/G1.12): each an armingButton, made again after each draw.
  deskArming(document.getElementById('desk-end-design'), 'End design mode: sure?', deskEndDesign);
  deskArming(document.getElementById('desk-start-design'), 'Start design mode: sure?', deskStartDesign);
}

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
      // The answer seated in the desk's branch of spirit.required.spirit.data, beside what is there: nothing held is dropped.
      var D = window.spirit && window.spirit.required.spirit.data;
      var K = deskKept();
      if (forCurrent) ((r && r.items) || []).forEach(function (it) { try { var row = JSON.parse(it.label); if (row.goal === '' && !deskSearchedGoal) deskSearchedGoal = row.id; } catch (e) { /* not a row */ } });
      if (D && K && typeof D.seatRows === 'function') D.seatRows(K.branch, (r && r.items) || []);
      deskDraw();
      // The List may have drawn its own answer before this one named the goal.
      if (deskList) deskList.redraw();
      done();
    }, function (e) { done(); deskWriteError('read its list')(e); });
}
// A published row: {change, verb, item: <facts>, listed, key} (goal/G33.4: one publish per row), or an item's side row
// {table, id, row}. A session.set asks the List again once per write, since it adds and drops whole rows; any other
// row is drawn from the publish (below). A dropped publish (too large) asks again; a jump in change numbers is no gap
// (goal/G41.2) and asks nothing. deskLastChange is the newest write heard, for the backup line.
var deskLastChange = 0;
var deskSearchedAt = -1;
// THE NEWEST CHANGE SEEN, PER ROW (goal/G33.8, box v11): an older version of a row never paints over a newer one, and an
// earlier write's rows still land when a later write's overtook them.
var deskRowChange = {};
function deskRowKeyOf(obj) {
  if (!obj.table) { var it = obj.item; if (typeof it === 'string') { try { it = JSON.parse(it); } catch (e) { it = null; } } return 'item|' + String((it && it.id) || ''); }
  var r = obj.row || {};
  var own = obj.removed ? String(obj.at || '') : obj.table === 'checks' ? String(r.number || '') : obj.table === 'chat' ? String(r.at || '') + '|' + String(r.by || '') : '';
  return obj.table + '|' + String(obj.id || '') + '|' + own;
}
function deskOnPublished(obj) {
  if (!obj || typeof obj !== 'object') return;
  // What is kept of the current goal took this publish first: the desk family's own cache manager hears the stream
  // (spirit/app/desk/data.js, goal/G33.3), so the page does not feed it again.
  // AN UPDATE TOO LARGE TO PUBLISH was dropped, and said: ask again for what is shown.
  if (obj.dropped) { deskSearchItems(); return; }
  // THE CURRENT SELECTION (goal/G49.8, box v4): the desk family's data.js keeps it, so the List, filtered to the current goal
  // by default, is drawn again now, from what is kept, without waiting for any answer.
  if (typeof obj.current === 'string' && !obj.item && !obj.table) { deskDraw(); if (deskList) deskList.redraw(); return; }
  var change = Number(obj.change) || 0;
  // AN OLDER UPDATE CHANGES NOTHING (goal/G2.1 note 7). Andy: "let desk worry about its problems": publishes
  // travel as their own requests and can overtake each other; a row is never painted over by what came before.
  var rowKey = deskRowKeyOf(obj);
  if (change && deskRowChange[rowKey] && change < deskRowChange[rowKey]) return;
  if (change) deskRowChange[rowKey] = change;
  // THE BACKUP LINE FOLLOWS THE RECORD: read again once per write the desk made, since the backup copies desk.db after a
  // change.
  if (change && change > deskLastChange) deskAskBackup();
  if (change > deskLastChange) deskLastChange = change;
  // EACH ROW ON ITS OWN (goal/G33.4): a side row of an item ({table, id, row}) is no List row; it is the dialog's and
  // the kept items' (the desk family's data.js).
  if (obj.table) return;
  // A session's rows each come as their own publish (goal/G33.4): the List asks again once for the write.
  if (obj.verb === 'session.set') { if (deskSearchedAt !== change || !change) { deskSearchedAt = change; deskSearchItems(); } return; }
  // ITS ONE ROW (goal/G33.4: every row a write changed is its own publish).
  var it = obj.item;
  if (typeof it === 'string') { try { it = JSON.parse(it); } catch (e) { it = null; } }
  if (!it || !it.id) return;
  // THE LIST TAKES ADDITIONS FROM THE STREAM (goal/G24.6). Andy: "no pulling". The row is the cache manager's to keep
  // (its translator writes it into the desk's branch as the publish arrives); the List, a view of that branch, draws it
  // where the toggles and the goal's order put it (deskHeld). Nothing is placed here by hand.
  // ONE ROW CHANGED, ONE ROW REPAINTED (goal/G27.9, B; goal/G40.12): the List takes the
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
//   Once per page: a second app finds each there.
// THE DESK'S TRANSLATOR (goal/G33.3, goal/G41.24): the desk family's data.js, from the node that served this page;
// spirit.required.spirit.data keeps the current goal for this page and the item dialog, as deskClient keeps it in node. Loaded once.
var DESK_DATA = '/spirit/app/desk/data.js';
// EVERY PART THROUGH THE ONE LOADER (goal/G41.11; rule/21: "always look for existing code", and Andy, on the add-rule
// dropdown that sometimes never appeared: "FIX IT"): spirit.requireScript, never a script tag of its own. It loads a part once
// for the page and answers when it has run.
function deskNeed(p) {
  var req = typeof window !== 'undefined' && window.spirit && window.spirit.requireScript;
  if (typeof req !== 'function') return Promise.reject(new Error('no spirit.requireScript on this page'));
  return Promise.resolve(req.call(window.spirit, String(p).replace(/^\/+/, '')));
}
// AN ICON THAT STANDS ALONE IS THE ICON ELEMENT (goal/G41.23; Andy: "this element will replace icons painting all shell
// elements and apps.", and "isn't a glyph inside flowing text just like another inline character? ... they don't need
// special handling"): the row's type, the sword, a rule's status. Written as a placeholder holding its glyph, so the
// markup is never empty; once spirit/element/icon/script.js is on the page each one in the container is made the icon element
// (deskPaintIcons, watching the container). A glyph among words stays text.
// Its own escape: the sword is made as the file loads, before deskVia is there.
function deskGlyph(glyph, title) {
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  return '<span data-icon="' + esc(glyph) + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + esc(glyph) + '</span>';
}
var deskIconReady = null;
function deskPaintIcons(root) {
  var I = typeof window !== 'undefined' && ANSWER['spirit/element/icon/script.js'];
  if (!I || !root || typeof root.querySelectorAll !== 'function') return;
  Array.prototype.forEach.call(root.querySelectorAll('[data-icon]'), function (p) {
    if (p.querySelector('.shell-icon')) return;
    p.textContent = '';
    I.create(p, { glyph: p.getAttribute('data-icon') });
  });
}
function deskWatchIcons(root) {
  if (!deskIconReady) deskIconReady = deskNeed('/spirit/element/icon/script.js').then(null, function () { /* the glyphs stay text */ });
  deskIconReady.then(function () { deskPaintIcons(root); });
  if (typeof MutationObserver === 'function' && root) new MutationObserver(function () { deskPaintIcons(root); }).observe(root, { childList: true, subtree: true });
}
function deskLoadData() {
  if (typeof window === 'undefined' || (window.spirit && ((window.spirit.required.spirit.data || {}).desk || {}).data)) return;
  deskNeed(DESK_DATA);
}
// Everything kept of whole items is forgotten after a gap: what was published while the stream was down was never heard.
function deskForgetKept() {
  // Asked of the cache's manager (goal/G41.28): it names its branches, this page does not.
  var K = typeof window !== 'undefined' && window.spirit && ((window.spirit.required.spirit.data || {}).desk || {}).data;
  if (K && typeof K.forgetAll === 'function') K.forgetAll();
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
// each agent's deskClient itself on his writes (goal/G3.5).
function deskPress(id, what) {
  // No by (apiAuth/G1.13): the press is the owner's because it comes
  // through the owner's door, and desk reads that from the caller.
  return deskAsk('press', { id: id, what: what }).then(function () { /* the server publishes, and nudges */ },
    function (e) { deskError = 'Not pressed: ' + ((e && e.message) || e); deskDraw(); });
}

var DESK_PRESS_LABEL = { go: 'Go!', done: 'Done', close: 'Close', 'bring-back': 'Bring back' };
// NOT IN A ROW: Go all sits in the tab bar (desk/G3.4), and Reopen only in the item's dialog (desk/G3.6, Andy:
// "the Re-Open button should never be shown in the list").
// MAKE CURRENT IS NOT IN THE ROW, THE SWORD IS (goal/G9.1). Andy, 2026-10-07: "the [make-current] button will not be
// displayed in the List, only in the goals Details. in the list, an item that has a [make-current] button, the item
// will be marked with an ICON.SWORD (⚔️), indicating: \"There is a battle to be fought\"." His decision: the press
// itself stays in the goal's Details (deskDetails), and the row only says there is one to make.
// DELETE IS NEVER IN THE ROW (goal/G8.8). Andy, 2026-10-09: "oh, and the Delete button never should show in the
// list. only in the detals."
// goal/G33.4: an item's own End design is its Details' alone.
var DESK_NOT_IN_ROW = ['go-all', 'reopen', 'make-current', 'delete', 'end-design'];
var DESK_SWORD = deskGlyph('⚔️', 'There is a battle to be fought: make it the current goal in its Details');
// CLOSE BEFORE HIS GO IS THE DIALOG'S ALONE (goal/G3.9). Andy, 2026-10-03: "the close-with arm is only visible on
// the item detail". A done row keeps its Close.
// THE GOAL ROW KEEPS ITS CLOSE (goal/G6.6): the goal's Close appears in the List too. It shows only once nothing under
// the goal is open (deskNextPress). It arms first all the same, as a done row's Close does (goal/G43.30; Andy: "make sure
// that all delete and close buttons are armingButton's"), which reverses goal/G41.9's press at once.
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
// order of steps, the rest after them in the item's own order. No Verify any more: the desk has no verifier.
var DESK_STEP_ORDER = ['go', 'done', 'close'];
function deskNextPress(row) {
  var offered = (row.buttons || []).filter(function (what) { return deskInRow(row, what); });
  var stepped = DESK_STEP_ORDER.filter(function (w) { return offered.indexOf(w) !== -1; });
  return stepped.length ? stepped[0] : (offered[0] || '');
}
function deskRowPresses(row) {
  var next = deskNextPress(row);
  return (next ? [next] : []).map(function (what) {
    var label = DESK_PRESS_LABEL[what] || what;
    var title = '';
    // data-arming is what its armingButton says armed (deskArmRow).
    var arming = '';
    // EVERY CLOSE ARMS (goal/G43.30): the first press arms it, the second closes.
    if (what === 'close') arming = 'Close: sure?';
    // data-action: the List (probabilitySearch) leaves a press inside a row to its owner, this page, and opens nothing.
    return '<button type="button" data-action="press" data-press="' + deskEsc(what) + '" data-id="' + deskEsc(row.id) + '"' +
      (arming ? ' data-arming="' + deskEsc(arming) + '"' : '') + (title ? ' title="' + deskEsc(title) + '"' : '') + '>' + deskEsc(label) + '</button>';
  }).join(' ');
}
// THE CELLS OF A ROW, each its own part, so the row's own element paints and repaints them one by one (goal/G27.9;
// the List is the probability search, goal/G40.12, and a row is its row element, deskListElement).
var DESK_LIST_FIELDS = ['mark', 'type', 'todo', 'yours', 'status'];
// THE GOAL ROW STANDS OUT (goal/G33.8, box v12; Andy: "it's really hard to tell the goal from it's items in the list"):
// its icon cell holds the goal sign, and its to-do cell is bold (the row tag is the element's, goal/G40.12).
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
    '<td>' + presses + '</td>' +
    '<td style="width:16em">' + deskStatusCell(row) + '</td>');
}
// THE STATUS BOX (goal/G18.5): the server's status word, green when it says passed, red when rejected or red.
function deskStatusCell(row) {
  var word = String(row.status || '');
  var colour = /passed/i.test(word) ? '#1a7f37' : /rejected|\bred\b|failed/i.test(word) ? '#c00' : '';
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
// The element in its pane face (spirit/element/search/script.js): the search box, the filters in the row above it, its
// one call on the wire. IT IS A VIEW OF THE DESK'S BRANCH OF spirit.required.spirit.data (goal/G41.28), the cache manager's (its data
// option, deskKept().branch), which every publish keeps current; items.search's answers to the words are seated in it. Each row is a row element
// (spirit/element/row/script.js) painting the List's cells (deskRowCellParts); a publish redraws the list, and a row's element
// repaints the cells that changed. A press in a row is the page's (data-press), a press on the row opens it.
//
// THE TOGGLES (goal/G9.2, goal/G4.20 point 1): Current Goal Only, on when Desk opens (a multi filter: on until pressed
// off), Goals Only and Include Closed, off (toggles). The first two exclude each other (Andy: "only one of the two
// buttons ... may be selected at the same time"; below): Goals Only on means every goal's.
var deskList = null;
var deskListIndex = null;
function deskListElement(row, key) {
  deskListIndex = deskListIndex || ANSWER['spirit/element/row/script.js'].index(function () { /* a publish redraws the list; each element applies its row */ });
  var el = ANSWER['spirit/element/row/script.js'].create({
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
    var P = ANSWER['spirit/element/search/script.js'] && ANSWER['spirit/element/search/script.js'].create ? ANSWER['spirit/element/search/script.js'] : null;
    var K = deskKept();
    if (!P || typeof P.create !== 'function' || deskList || !K) return;
    deskList = P.create(el, {
      data: K.branch,
      // ITS OWN DATA SOURCE, over this page's api (goal/G43.24: the search is handed no api): desk.<verb>, and the desk's
      // publishes, which ask again.
      search: function (args, verb) { return deskVia.verb('spirit/app/desk/api.js', verb, args); },
      published: function (fn) { return typeof deskVia.onPublished === 'function' ? deskVia.onPublished(fn, 'desk') : function () {}; },
      api: 'spirit/app/desk/api.js', verb: 'items.search',
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
        { field: 'yours', label: 'yours' }, { field: 'status', label: 'status', width: '16em' },
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
// armingButton (spirit/element/armingButton/script.js), which the page loads itself. It arms, says so, and disarms
// itself the moment he clicks anywhere else (AGENT.md); a button made one already is left as it is.
var deskParts = Promise.resolve(typeof spirit !== 'undefined' && spirit.requireScript
  ? keepAnswer('spirit/element/armingButton/script.js') : null);
function deskArming(button, armedLabel, run) {
  if (!button) return;
  deskParts.then(function () {
    var A = typeof window !== 'undefined' && ANSWER['spirit/element/armingButton/script.js'];
    if (!A || typeof button.armed === 'function') return;
    A.attach(button, { label: button.textContent, armedLabel: armedLabel, run: run });
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

// The List's search element and the row it draws rows with, through the one loader (it loads each once).
var DESK_SEARCH = '/spirit/element/search/script.js';
var DESK_ROW_ELEMENT = '/spirit/element/row/script.js';
function deskLoadSearch(done) {
  Promise.all([deskNeed(DESK_ROW_ELEMENT), deskNeed(DESK_SEARCH)]).then(function () { done(); }, function () { /* no search on this page */ });
}

// ONE ROW'S DIALOG, from the List.
function deskOpenRow(id) {
  // THE DIALOG ASKS THE DESK SERVER ITSELF (desk/G2.7): Desk hands it the id.
  // It writes its own chat, and nudges nobody (goal/G3.8).
  deskVia.callDialog('spirit/app/desk/element/deskDetails', { id: id });
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
// ── THE BACKUP, SEEN FROM DESK (desk/G1.7, T7) ───────────────────────
//
//   Andy: "how can i trust the copy mechanist when i cant see it working".
// The backup server's status.get: its last check and last copy, marked red
// when something was closed after the last check. Kept by the backup family's
// cache manager (goal/G41.28), spirit.required.spirit.data['spirit.app.backup'].data; the line follows its watch.
// THROUGH ITS INTERFACE (goal/G47.1; Andy: "every api.js requires it's companion data.js, and is the only script to require
// that data.js"): the backup family's api.js, which brings its data.js. A node with no backup server serves no interface
// for it: then nothing is asked and no line is drawn.
var DESK_BACKUP_API = '/spirit/app/backup/api.js';
var deskBackupWatched = null;
function deskBackupPaint() {
  // Its own line alone once the page is drawn (goal/G27.9: one change, one element repainted).
  var el = typeof document !== 'undefined' && document.getElementById ? document.getElementById('desk-backup') : null;
  if (el && deskLoaded) el.innerHTML = deskBackupHtml(); else deskDraw();
}
function deskAskBackup() {
  return deskNeed(DESK_BACKUP_API).then(function () {
    var B = ((window.spirit.required.spirit.data || {}).backup || {}).data;
    if (!B) return;
    if (!deskBackupWatched) deskBackupWatched = B.watch(deskBackupPaint);
    return Promise.resolve(deskVia.verb('spirit/app/backup/api.js', 'status.get', {})).then(function (r) {
      B.keep(r && r.status === 200 ? r.body : null);
    }, function () { B.keep(null); });
  }, function () { /* no backup server on this node: no line */ });
}
function deskBackupHtml() {
  var B = typeof window !== 'undefined' && window.spirit && ((window.spirit.required.spirit.data || {}).backup || {}).data;
  var deskBackup = B ? B.status() : null;
  if (!deskBackup) return '';
  var stale = false;
  return '<div class="' + (stale ? 'job-start-error' : 'job-manifest-note') + '">Backup: last check ' +
    (deskBackup.lastCheck ? deskTime(deskBackup.lastCheck) : 'never') + ', last copy ' +
    (deskBackup.lastCopy ? deskTime(deskBackup.lastCopy) : 'never') +
    (stale ? '; something was closed since the last check' : '') + '</div>';
}

// THE HEADER AREA IS THE SHELL'S (goal/G6.1): the block written as #desk-bars moves into the app header, which sticks it
// under the titlebar, and takes its id.
function deskHeader() {
  // What it draws with, it loads itself (rule/26).
  keepAnswer('spirit/element/appHeader/appHeader/script.js').then(deskHeaderMove, function () { /* the bars stay plain */ });
}
function deskHeaderMove() {
  var old = document.getElementById('desk-bars');
  var AH = ANSWER['spirit/element/appHeader/appHeader/script.js'];
  if (!old || !old.parentNode || !AH) return;
  // Made in the old block's parent, then put in its place (the element shape, goal/G41.19).
  var head = AH.create(old.parentNode);
  old.parentNode.insertBefore(head, old);
  head.id = 'desk-bars';
  // ITS OWN HEIGHT, ALWAYS (goal/G47.1, -browser: "it keeps its height and its width when given far more than it holds"):
  // a full list below it never squeezes the bars; the panes take only what they leave.
  head.style.flex = 'none';
  while (old.firstChild) head.appendChild(old.firstChild);
  old.parentNode.removeChild(old);
}

// What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
module.exports = { create: function (container, opts) {
    deskOpts = opts || {};
    {
    // ── THE TABS ───────────────────────────────────────────────────
    //
    //   Andy: "tabs would be a more standard approach, methinks".
    //
    // Switching shows one pane and hides the others; nothing is repainted,
    // so a half-typed line in any pane survives a switch. The inputs live
    // outside the repainted parts. No design-mode banner (goal/G9.8; Andy: "it is useless.").
    container.innerHTML =
      // Drawn by deskDrawTabs.
      // PINNED BELOW THE TITLE BAR (desk/G1.12; goal/G2.1 note 4). Andy: "they should leave the app or dialog visible,
      // and stay sticky below those title bars". The shell's app header does the sticking (goal/G6.1): this block is
      // moved into it right after this markup lands (deskHeader).
      // ONE BOX, KEEPING WHAT IT HOLDS INSIDE IT (goal/G47.1, -browser: every box it puts into its container declares
      // overflow not visible, and it keeps the size it is given): the bars and the panes in one fill box, which is
      // also what a panel covers while it is open.
      '<div class="fill" style="overflow:hidden">' +
      // FLAT AND JOINED TO THE TITLE BAR (goal/G9.6). Andy: "the header area should not contain rounded corners. and
      // its container should have no margins and no padding." No goal bubble either: the List's goal row opens the
      // goal (his answer to G9.6 Q1).
      '<div id="desk-bars" style="flex:none">' +
        // GO ALL at the right of the tab bar, on the List tab only (desk/G3.4).
        '<div style="display:flex;align-items:center"><div id="desk-tabs" style="flex:1;display:flex;flex-wrap:wrap;align-items:center"></div>' +
          '<button type="button" id="desk-go-all" hidden>Go all</button></div>' +
      '</div>' +
      // EVERY LIST IN A BOX OF A STATED SIZE (goal/G41.11, rule/16): the List in a fill box, and
      // every box up to the app a fill box too.
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
          // same. That is part of the whole probability search frame work"): spirit/element/search/script.js in its pane
          // face over items.search, its toggles the element's filters in the row above the box, each row a row element
          // (deskMountList). The error line above it.
          '<div id="desk-top" class="fill"><div id="desk-list-error"></div><div id="desk-list" class="fill"></div></div></div>' +
      '</div>' +
      '</div>';
    // EVERY FIELD STOPS AT ITS LIMIT (goal/G47.1, -browser): the goal title "subject to label rules" (goal/G9.11).
    var FI = ANSWER['spirit/element/fieldInput/script.js'];
    // Held to its type (goal/G48.4, box v22), the label a goal title is.
    var goalTitle = FI ? container.querySelector('#desk-goal-title') : null;
    if (goalTitle) FI.attach(goalTitle, 'spirit/type/string/label/script.js');
    deskHeader();
    // goal/G41.23: every icon that stands alone in the page, through the icon element (deskGlyph).
    deskWatchIcons(container);
    function show(tab) {
      var pane = tab;
      // A TAB THE PAGE DOES NOT HAVE FALLS BACK TO THE LIST, its main tab.
      var panes = container.querySelectorAll('[data-pane]');
      if (!Array.prototype.some.call(panes, function (p) { return p.getAttribute('data-pane') === pane; })) { tab = 'list'; pane = 'list'; }
      Array.prototype.forEach.call(panes, function (p) {
        p.hidden = p.getAttribute('data-pane') !== pane;
      });
      // HIGHLIGHTED, NOT DISABLED. Andy: "on the desk app, the current tab
      // should be highlighted." A disabled button read as greyed out.
      deskTab = tab;
      deskDrawGoAll();
      deskDrawTabs();
    }
    // The strip is redrawn, so one listener on it, and the click may
    // land on a part inside a button.
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
        // goal/G41.9: an are-you-sure (a Close, goal/G43.30) is its armingButton's, never this listener's.
        if (press.hasAttribute && press.hasAttribute('data-arming')) return;
        deskPress(press.getAttribute('data-id'), press.getAttribute('data-press'));
        return;
      }
      var row = t && t.closest && t.closest('[data-row]');
      if (row) deskOpenRow(row.getAttribute('data-row'));
    });
    document.getElementById('desk-goal-add').addEventListener('click', function () { deskAddGoal(); });
    deskDrawToggles();
    deskMountList();
    deskArming(document.getElementById('desk-go-all'), 'Go all: sure?', deskGoAll);
    // NO PULLING. Andy: "no pulling". The List asks once, then repaints from
    // what the desk server publishes. A shell whose api carries no onPublished (the face's) mounts it all the same,
    // without the live repaint (goal/G41.19: it mounts cleanly, "no throw even unconfigured").
    if (typeof deskVia.onPublished === 'function') deskVia.onPublished(deskOnPublished);
    deskLoadData();
    // BACK AFTER A GAP (Andy: "this should work without a hickup"): what was
    // published or said while the stream was down was never heard, so the
    // List and the backup line are asked for again.
    if (typeof deskVia.onReconnect === 'function') deskVia.onReconnect(function () { deskForgetKept(); deskSearchItems(); deskLoad(); });
    deskDraw();
    deskSearchItems();
    deskLoad();
    }
    // Its own stack when its mounter hands none (panel.js), so a dialog opens over the page either way.
    if (typeof deskOpts.open !== 'function') keepAnswer('spirit/element/panel/script.js').then(function () { if (!deskStack && container.firstElementChild && ANSWER['spirit/element/panel/script.js']) deskStack = ANSWER['spirit/element/panel/script.js'].create(container, container.firstElementChild); });
    return { destroy: function () {
      deskHeard = [];
      // Its watch let go (rule/8): the backup line's.
      if (typeof deskBackupWatched === 'function') deskBackupWatched();
      deskBackupWatched = null;
      container.innerHTML = '';
    } };
} };
}());
