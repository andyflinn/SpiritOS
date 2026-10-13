// spirit/run/shell/desk/plugins/stackFrameChecks/stackFrameChecks.js
// THE STACK-FRAME CHECKS PLUGIN'S PRIVATE UI (goal/G22.3): its companion dialog, Desk's Stacks tab under Apps.
//
//   Andy, 2026-10-13, in the item's box: "It has a companion dialog where the gate and endpoint functions are entered.",
//   and "its dialog takes a gate and an endpoint and makes the goal/G22.2-type item". Since his Apps ruling the same
//   day, each plugin's private UI is its inner tab under Apps (this one Stacks, the tab field of its .json), and the
//   label button in the List is gone.
//
// Loaded once into the Desk page, the first time its tab opens (shell/desk/desk.js, deskOpenPlugin), into its own pane
// that stays for the page's life; it registers itself on
// window.spiritDeskPlugins.stackFrameChecks = { open(container, ctx) }. ctx.goal is its goal's id, ctx.ask the page's
// call to the desk server, ctx.onPublished the desk server's stream, ctx.chat(container) the face's chat of its goal,
// mounted below its items. The server half is
// process/js/desk/plugins/js/stackFrameChecks/: its verb stackFrameChecks.make does the work and refuses what is wrong;
// this page only spares the wire.
//
// THE FORMS, DECIDED BY ANDY (goal/G22.3's box, 2026-10-13), not this page's to loosen: the gate is narrow, one
// spirit/run/<file>.js::<function>, and a whole module named as the gate is cheating; the endpoint is wide, a whole
// module, spirit/run/<file>.js. The inputs carry data-field="gate" and data-field="endpoint" and are checked as typed
// against those forms, what is wrong said beside each, Make off while either is wrong. The plugin's verb checks them
// again against the tree (the file there, the function in it): this page only spares the wire. Since the list of doors
// (stackFrameList.json, the plugin's) the page shows it, read with stackFrameChecks.doors.

(function () {
  var win = typeof window !== 'undefined' ? window : {};
  var held = win.spiritDeskPlugins = win.spiritDeskPlugins || {};
  var ctx = null;
  var subscribed = false;
  var note = '';
  var FILE_RE = /^spirit\/run\/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.js$/;
  var GATE_RE = /^spirit\/run\/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.js::[A-Za-z_$][A-Za-z0-9_$]*$/;
  var FORM_MAX = 256;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function value(id) { var el = document.getElementById(id); return el ? String(el.value || '') : ''; }
  // What the form says of one field: '' when it may be sent.
  function why(id) {
    var v = value(id).trim();
    if (!v) return '';
    if (v.length > FORM_MAX) return v.length + ' characters, the limit is ' + FORM_MAX;
    if (id === 'sfc-gate') {
      if (FILE_RE.test(v)) return 'a whole module as the gate is cheating: name one function, ' + v + '::<function>';
      return GATE_RE.test(v) ? '' : 'a gate is spirit/run/<file>.js::<function>';
    }
    if (/::/.test(v)) return 'an endpoint is a whole module, spirit/run/<file>.js, not one function';
    if (/^node:/.test(v)) return 'a node: endpoint needs its paths, so an agent writes it into the list';
    return FILE_RE.test(v) ? '' : 'an endpoint is spirit/run/<file>.js, the whole module';
  }
  // What a right form names, beside it.
  function said(id) {
    var v = value(id).trim();
    if (!v) return id === 'sfc-gate' ? 'one function: spirit/run/<file>.js::<function>' : 'a whole module: spirit/run/<file>.js';
    return id === 'sfc-gate' ? 'one function, ' + v.split('::')[1] + ', in ' + v.split('::')[0] : 'the whole module ' + v + ', every function it exports';
  }
  // Both fields, every time one is typed in: what it names or what is wrong beside each, Make off while either is wrong.
  function check() {
    var wrong = false;
    ['sfc-gate', 'sfc-endpoint'].forEach(function (id) {
      var left = document.getElementById(id + '-left');
      var w = why(id);
      if (w) wrong = true;
      if (!left) return;
      left.textContent = w || said(id);
      left.className = w ? 'job-start-error' : 'job-manifest-note';
    });
    var make = document.getElementById('sfc-make');
    if (make) make.disabled = wrong;
  }
  function say(text) {
    note = String(text || '');
    var el = document.getElementById('sfc-note');
    if (el) el.textContent = note;
  }
  // Its goal's items, read from the desk server's own search; repainted when the stream names an item of its goal.
  function readItems() {
    if (!ctx) return;
    var goal = ctx.goal;
    Promise.resolve(ctx.ask('items.search', { text: '', currentGoalOnly: false, goalsOnly: false, includeClosed: false })).then(function (r) {
      var rows = ((r && r.items) || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return null; } })
        .filter(function (x) { return x && x.goal === goal; });
      var el = document.getElementById('sfc-items');
      if (!el) return;
      el.innerHTML = rows.length ? '<table class="jobs-table"><tbody>' + rows.map(function (x) {
        return '<tr><td>' + esc(x.title) + ' <span class="job-manifest-note">(' + esc(x.id) + ')</span></td><td>' + esc(x.status) + '</td></tr>';
      }).join('') + '</tbody></table>' : '<div class="job-manifest-note">No items yet.</div>';
    }, function () { /* the list stays as it was */ });
  }
  // THE LIST OF DOORS (goal/G22.3), as the plugin keeps it: each gate, its endpoint (with its paths), its suites or
  // that none are measured yet, and the item that asked for it.
  function readDoors() {
    if (!ctx) return;
    Promise.resolve(ctx.ask('stackFrameChecks.doors', {})).then(function (r) {
      var doors = (r && Array.isArray(r.doors)) ? r.doors : [];
      var el = document.getElementById('sfc-doors');
      if (!el) return;
      el.innerHTML = doors.length ? '<table class="jobs-table"><tbody>' + doors.map(function (d) {
        var paths = Array.isArray(d.paths) && d.paths.length ? ' <span class="job-manifest-note">on ' + esc(d.paths.join(', ')) + '</span>' : '';
        var suites = Array.isArray(d.suites) && d.suites.length ? esc(d.suites.join(', ')) : '<span class="job-start-error">no suites measured yet</span>';
        return '<tr><td>' + esc(d.gate) + '</td><td>' + esc(d.endpoint) + paths + '</td><td>' + suites + '</td><td>' + esc(d.item) + '</td></tr>';
      }).join('') + '</tbody></table>' : '<div class="job-manifest-note">No doors yet.</div>';
    }, function () { /* the list stays as it was */ });
  }
  function ofMyGoal(obj) {
    if (!ctx || !obj || typeof obj !== 'object') return false;
    var item = obj.item;
    if (typeof item === 'string') { try { item = JSON.parse(item); } catch (e) { item = null; } }
    var rows = (Array.isArray(obj.rows) ? obj.rows : []).concat(item ? [item] : []);
    return rows.some(function (x) { return x && (x.id === ctx.goal || x.goal === ctx.goal); });
  }
  function make() {
    var gate = value('sfc-gate').trim();
    var endpoint = value('sfc-endpoint').trim();
    if (!gate || !endpoint) { say('Not sent: a gate and an endpoint are both needed.'); return; }
    var wrong = why('sfc-gate') || why('sfc-endpoint');
    if (wrong) { say('Not sent: ' + wrong); return; }
    say('Sent; waiting for the desk.');
    Promise.resolve(ctx.ask('stackFrameChecks.make', { gate: gate, endpoint: endpoint })).then(function (r) {
      ['sfc-gate', 'sfc-endpoint'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
      check();
      say('Made ' + ((r && r.id) || 'the item') + ': nobody but ' + gate + ' reaches ' + endpoint + '. The door is in the list, with no suites yet.');
      readItems();
      readDoors();
    }, function (e) { say('Not made: ' + ((e && e.message) || e)); });
  }

  held.stackFrameChecks = {
    open: function (container, given) {
      ctx = given;
      note = '';
      // Every block carries a leading 1em; each button in a row 1em after itself (the desk's UI rules).
      container.innerHTML =
        '<div class="stat-tile wide" style="margin-top:1em"><div class="label">Stack-frame checks</div>' +
          '<div class="job-manifest-note">Name a gate, one function, and an endpoint, a whole module: the plugin adds the door to ' +
          'its list, which the stack-frame test reads, and makes the item "Nobody but &lt;gate&gt; reaches &lt;endpoint&gt;" in ' +
          'its goal, whose box states the rule every production stack reaching the endpoint passes through the gate. The door ' +
          'is red until an agent measures the suites that drive it.</div></div>' +
        '<div class="start-job-form card" style="margin-top:1em">' +
          '<label class="field-label grow">Gate<input type="text" id="sfc-gate" data-field="gate" placeholder="one function: spirit/run/js/peerPost.js::post"></label>' +
          '<span id="sfc-gate-left" class="job-manifest-note"></span>' +
          '<label class="field-label grow">Endpoint<input type="text" id="sfc-endpoint" data-field="endpoint" placeholder="a whole module: spirit/run/js/presenceNode.js"></label>' +
          '<span id="sfc-endpoint-left" class="job-manifest-note"></span>' +
          '<button type="button" id="sfc-make" style="margin-right:1em">Make the item</button>' +
        '</div>' +
        '<div id="sfc-note" class="job-start-error" style="margin-top:1em"></div>' +
        '<div class="stat-tile wide" style="margin-top:1em"><div class="label">The doors</div><div id="sfc-doors"></div></div>' +
        '<div class="stat-tile wide" style="margin-top:1em"><div class="label">Its items</div><div id="sfc-items"></div></div>' +
        // ITS GOAL'S CHAT, BELOW THE LIST (goal/G22.3). Andy, 2026-10-13: "in Stack: the chat is missing, below the
        // inputs, after what will be the list". The desk face draws it, Team's chat taking this goal (ctx.chat).
        '<div id="sfc-chat"></div>';
      // One listener of each on the container, which is repainted at every open: wired once.
      if (!container.sfcWired) {
        container.sfcWired = true;
        container.addEventListener('input', function (e) {
          var t = e && e.target;
          var f = t && t.getAttribute ? t.getAttribute('data-field') : null;
          if ((f === 'gate' || f === 'endpoint') && /^sfc-/.test(String(t.id))) check();
        });
        container.addEventListener('click', function (e) {
          var t = e && e.target;
          if (t && t.id === 'sfc-make') make();
        });
      }
      // ITS OWN STREAM (the desk's UI rule): subscribed once, for whichever goal it was last opened on.
      if (!subscribed && typeof given.onPublished === 'function') {
        subscribed = true;
        given.onPublished(function (obj) { if (ofMyGoal(obj)) { readItems(); readDoors(); } });
      }
      if (typeof given.chat === 'function') given.chat(document.getElementById('sfc-chat'));
      check();
      readItems();
      readDoors();
    },
  };
}());
