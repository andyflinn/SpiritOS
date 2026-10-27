// spirit/run/shell/desk/plugins/stackFrameChecks/stackFrameChecks.js
// THE STACK-FRAME CHECKS PLUGIN'S PRIVATE UI (goal/G22.3): Desk's Stacks tab under Apps.
//
//   Andy, 2026-10-13, in the item's box: "It has a companion dialog where the gate and endpoint functions are entered.",
//   and "its dialog takes a gate and an endpoint and makes the goal/G22.2-type item". Since his Apps ruling the same
//   day, each plugin's private UI is its inner tab under Apps (this one Stacks, the tab field of its .json), and the
//   label button in the List is gone.
//
// IT RUNS THE SHOW, DECIDED BY ANDY (goal/G22.3's box, 2026-10-13), not this page's to shrink: "now this list here
// shows me garbage. i want to see a list that i can maintain, and control from here.", "I want this plugin to RUN the
// show, so you give me the complete toolset. add/remove rows (add with validation) and you will give me a run
// button/link for each one of them, or even better, a run-dialog", "with a way to modify a row as well." So, top to
// bottom: the add form (gate, endpoint, paths, suites); THE DOOR LIST, the main list, one row per door with its last
// verdict and one button, Open; then the goal's items (the work the doors cause); then the goal's chat.
//
// THE DOOR'S DETAIL IS A SHELL DIALOG, DECIDED BY ANDY (goal/G27.2's box, 2026-10-17): Open calls
// callDialog('shell/stackFrameCheckDetail', { id }) through the ctx the Desk face hands this page, and that dialog holds
// the door's values to edit, its Run (at once, in the plugin: deskVerify only records the verdict), its verdict, its
// Remove (the only place a door is deleted), and the chat of the door's item. This page draws no detail of its own.
//
// Loaded once into the Desk page, the first time its tab opens (shell/desk/desk.js, deskOpenPlugin), into its own pane
// that stays for the page's life; it registers itself on
// window.spirit.deskPlugins.stackFrameChecks = { open(container, ctx) }. ctx.goal is its goal's id, ctx.ask the page's
// call to the desk server, ctx.onPublished the desk server's stream, ctx.chat(container) the face's chat of its goal,
// mounted below its items, ctx.callDialog(app, params) the shell's dialog. The server half is
// process/js/desk/plugins/js/stackFrameChecks/: its verbs do the work and refuse what is wrong; this page only spares
// the wire.
//
// The add form's four fields are the shared door fields (shell/shared/js/deskDoorFields.js), as the door dialog's are,
// loaded on demand (Andy, 2026-10-17: "it is ok for apps to know about other apps and their shared elements").

(function () {
  var win = typeof window !== 'undefined' ? window : {};
  var held = (win.spirit = win.spirit || {}).deskPlugins = win.spirit.deskPlugins || {};
  var ctx = null;
  var subscribed = false;
  var doors = [];
  var PRE = 'sfc-';
  var FIELDS_SRC = '/shell/shared/js/deskDoorFields.js';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fields() { return (win.spirit.elements || {}).deskDoorFields || null; }
  // The shared door fields, loaded once per page when they are not there yet.
  function needFields(done) {
    if (fields()) { done(); return; }
    if (typeof document === 'undefined' || typeof document.createElement !== 'function' || !document.body) return;
    var script = document.createElement('script');
    script.src = FIELDS_SRC;
    script.onload = done;
    document.body.appendChild(script);
  }
  function say(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = String(text || '');
  }
  function errText(e) { return (e && e.message) || String(e); }
  function when(iso) { return iso ? String(iso).replace('T', ' ').replace(/\.\d+Z$/, 'Z') : ''; }

  // Its goal's items, read by their ids: the goal's facts name them (blocked), each item's facts are its row. A plugin
  // goal is on no List (goal/G41.2), so the desk's search does not find it. Repainted when the stream names an item of
  // its goal.
  function readItems() {
    if (!ctx) return;
    var goal = ctx.goal;
    var factsOf = function (id) {
      return Promise.resolve(ctx.ask('item.get', { id: id })).then(function (r) { try { return JSON.parse(r && r.item); } catch (e) { return null; } }, function () { return null; });
    };
    factsOf(goal).then(function (g) {
      return Promise.all(((g && g.blocked) || []).map(factsOf));
    }).then(function (all) {
      var rows = (all || []).filter(function (x) { return x && x.goal === goal; });
      var el = document.getElementById('sfc-items');
      if (!el) return;
      el.innerHTML = rows.length ? '<table class="jobs-table"><tbody>' + rows.map(function (x) {
        return '<tr><td>' + esc(x.title) + ' <span class="job-manifest-note">(' + esc(x.id) + ')</span></td><td>' + esc(x.status) + '</td></tr>';
      }).join('') + '</tbody></table>' : '<div class="job-manifest-note">No items yet.</div>';
    }, function () { /* the list stays as it was */ });
  }
  // A door's last run, in a word or two for its row.
  function lastHtml(l) {
    if (!l) return '<span class="job-manifest-note">never run</span>';
    if (l.running) return '<span class="job-manifest-note">running since ' + esc(when(l.startedAt)) + '</span>';
    if (!l.ran) return '<span class="job-manifest-note">' + (l.stopped ? 'stopped ' + esc(when(l.endedAt)) : l.endedAt ? 'no verdict, ' + esc(when(l.endedAt)) : 'never run') + '</span>';
    return l.green ? '<span class="job-manifest-note">green: ' + l.of + ' call(s) through the gate, ' + esc(when(l.endedAt)) + '</span>'
      : '<span class="job-start-error">red: ' + l.around + ' path(s) around the gate, of ' + l.of + ', ' + esc(when(l.endedAt)) + '</span>';
  }
  // THE DOOR LIST (goal/G22.3), the main list: each door's gate, endpoint (with its paths), suites, last verdict and the
  // item that asked for it, and one button, Open, for its dialog.
  // A BOUNDED SEARCH SINCE goal/G33.7 (Andy's approved verb list: "the Stacks door list (a door search with a more flag,
  // and a read per door)"): the doors that fit one answer, ranked by the text in its field; more says there are others.
  function readDoors() {
    if (!ctx) return;
    var box = document.getElementById('sfc-door-text');
    var text = box && typeof box.value === 'string' ? box.value : '';
    Promise.resolve(ctx.ask('stackFrameChecks.doors.search', { text: text })).then(function (r) {
      doors = ((r && Array.isArray(r.items)) ? r.items : []).map(function (x) { try { return JSON.parse(x.label); } catch (e) { return null; } }).filter(Boolean);
      var el = document.getElementById('sfc-doors');
      if (!el) return;
      var more = r && r.more ? '<div class="job-manifest-note">More doors than one answer holds: search to find the others.</div>' : '';
      el.innerHTML = (doors.length ? '<table class="jobs-table"><tbody>' + doors.map(function (d) {
        var paths = Array.isArray(d.paths) && d.paths.length ? ' <span class="job-manifest-note">on ' + esc(d.paths.join(', ')) + '</span>' : '';
        var suites = Array.isArray(d.suites) && d.suites.length ? esc(d.suites.join(', ')) : '<span class="job-start-error">no suites measured yet</span>';
        return '<tr data-door="' + esc(d.id) + '"><td>' + esc(d.gate) + '</td><td>' + esc(d.endpoint) + paths + '</td><td>' + suites + '</td><td>' +
          lastHtml(d.last) + '</td><td>' + esc(d.item) + '</td><td><button type="button" data-open="' + esc(d.id) + '" style="margin-right:1em">Open</button></td></tr>';
      }).join('') + '</tbody></table>' : '<div class="job-manifest-note">' + (text ? 'No door matches.' : 'No doors yet.') + '</div>') + more;
    }, function () { /* the list stays as it was */ });
  }
  // THE DOOR'S DIALOG (goal/G27.2, D1): the shell's, opened through the face's ctx; the list is read again when it closes.
  function openDoor(id) {
    if (!ctx || typeof ctx.callDialog !== 'function') { say('sfc-note', 'This Desk page hands its plugins no dialog to open door ' + id + ' in.'); return; }
    Promise.resolve(ctx.callDialog('shell/stackFrameCheckDetail', { id: id })).then(function () { readDoors(); readItems(); }, function () { readDoors(); });
  }

  function ofMyGoal(obj) {
    if (!ctx || !obj || typeof obj !== 'object') return false;
    var item = obj.item;
    if (typeof item === 'string') { try { item = JSON.parse(item); } catch (e) { item = null; } }
    // goal/G33.4: one row per publish.
    var rows = item ? [item] : [];
    return rows.some(function (x) { return x && (x.id === ctx.goal || x.goal === ctx.goal); });
  }
  function make() {
    var F = fields();
    if (!F) return;
    var d = F.door(PRE);
    if (!d.gate || !d.endpoint) { say('sfc-note', 'Not sent: a gate and an endpoint are both needed.'); return; }
    var wrong = F.FIELDS.map(function (f) { return F.why(PRE, f); }).filter(Boolean)[0];
    if (wrong) { say('sfc-note', 'Not sent: ' + wrong); return; }
    say('sfc-note', 'Sent; waiting for the desk.');
    // One row a write (goal/G40.3): the door from its gate and endpoint, then each path and each suite on its own.
    var made = null;
    var rows = (d.paths || []).map(function (p) { return ['stackFrameChecks.paths.add', p]; })
      .concat((d.suites || []).map(function (s) { return ['stackFrameChecks.suites.add', s]; }));
    Promise.resolve(ctx.ask('stackFrameChecks.make', { gate: d.gate, endpoint: d.endpoint })).then(function (r) {
      made = r;
      var doorId = r && r.door ? r.door : '';
      return rows.reduce(function (chain, row) {
        return chain.then(function () { return doorId ? ctx.ask(row[0], { id: doorId, path: row[1] }) : null; });
      }, Promise.resolve());
    }).then(function () {
      var r = made;
      F.fill(PRE, null);
      F.check(PRE, 'sfc-make');
      say('sfc-note', 'Made ' + ((r && r.id) || 'the item') + ': nobody but ' + d.gate + ' reaches ' + d.endpoint + '. The door is in the list' + (d.suites.length ? '.' : ', with no suites yet.'));
      readItems();
      readDoors();
    }, function (e) { say('sfc-note', 'Not made: ' + errText(e)); });
  }
  // The add form: the shared fields and Add; while they load, a line saying so.
  function formHtml() {
    var F = fields();
    return F ? F.html(PRE) + '<div style="margin-top:1em"><button type="button" id="sfc-make" style="margin-right:1em">Add the door</button></div>'
      : '<div class="job-manifest-note">Loading the door\'s fields.</div>';
  }

  held.stackFrameChecks = {
    open: function (container, given) {
      ctx = given;
      // Every block carries a leading 1em; each button in a row 1em after itself (the desk's UI rules).
      container.innerHTML =
        '<div class="stat-tile wide" style="margin-top:1em"><div class="label">Stack-frame checks</div>' +
          '<div class="job-manifest-note">The doors the stack-frame test checks: each says every production stack reaching ' +
          'its endpoint passes through its gate. Add one below (the plugin also makes its item "Nobody but &lt;gate&gt; reaches ' +
          '&lt;endpoint&gt;"); open one to edit it, run its check alone, read the paths around its gate, or remove it.</div></div>' +
        '<div id="sfc-form" class="start-job-form card" style="margin-top:1em">' + formHtml() + '</div>' +
        '<div id="sfc-note" class="job-start-error" style="margin-top:1em"></div>' +
        '<div class="stat-tile wide" style="margin-top:1em"><div class="label">The doors</div>' +
          '<input id="sfc-door-text" type="search" placeholder="Search the doors" style="margin-bottom:0.5em"><div id="sfc-doors"></div></div>' +
        '<div class="stat-tile wide" style="margin-top:1em"><div class="label">Its items</div><div id="sfc-items"></div></div>' +
        // ITS GOAL'S CHAT, BELOW THE LIST (goal/G22.3). Andy, 2026-10-13: "in Stack: the chat is missing, below the
        // inputs, after what will be the list". The desk face draws it, Team's chat taking this goal (ctx.chat).
        '<div id="sfc-chat"></div>';
      // One listener of each on the container, which is repainted at every open: wired once.
      if (!container.sfcWired) {
        container.sfcWired = true;
        container.addEventListener('input', function (e) {
          var t = e && e.target;
          var F = fields();
          var f = t && t.getAttribute ? t.getAttribute('data-field') : null;
          if (t && t.id === 'sfc-door-text') { readDoors(); return; }
          if (F && F.FIELDS.indexOf(f) !== -1) F.check(PRE, 'sfc-make');
        });
        container.addEventListener('click', function (e) {
          var t = e && e.target;
          if (!t) return;
          var door = t.getAttribute ? t.getAttribute('data-open') : null;
          if (door) { openDoor(door); return; }
          if (t.id === 'sfc-make') make();
        });
      }
      // ITS OWN STREAM (the desk's UI rule): subscribed once, for whichever goal it was last opened on. The plugin's
      // own publishes ({ plugin: 'stackFrameChecks', data: { what, id } }), a door changed or its run started or
      // ended, read the doors again; a row of its goal reads its items and doors again.
      if (!subscribed && typeof given.onPublished === 'function') {
        subscribed = true;
        given.onPublished(function (obj) {
          if (obj && obj.plugin === 'stackFrameChecks') { readDoors(); return; }
          if (ofMyGoal(obj)) { readItems(); readDoors(); }
        });
      }
      if (typeof given.chat === 'function') given.chat(document.getElementById('sfc-chat'));
      if (fields()) fields().check(PRE, 'sfc-make');
      else needFields(function () { var el = document.getElementById('sfc-form'); if (el) el.innerHTML = formHtml(); fields().check(PRE, 'sfc-make'); });
      readItems();
      readDoors();
    },
  };
}());
