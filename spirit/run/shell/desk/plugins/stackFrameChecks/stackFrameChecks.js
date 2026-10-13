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
// button/link for each one of them, or even better, a run-dialog", "with a way to modify a row as well." and "put that
// in the dialog if you want." So, top to bottom: the add form (gate, endpoint, paths, suites); THE DOOR LIST, the
// main list, one row per door with its last verdict and one button, Open; the door's dialog, which holds the door's
// values to edit and Save, Remove, and Run with Stop, its running time, then its verdict, one line per violator of the
// gate, and the raw paths folded below them; then the goal's items (the work the doors cause); then the goal's chat.
//
// Loaded once into the Desk page, the first time its tab opens (shell/desk/desk.js, deskOpenPlugin), into its own pane
// that stays for the page's life; it registers itself on
// window.spiritDeskPlugins.stackFrameChecks = { open(container, ctx) }. ctx.goal is its goal's id, ctx.ask the page's
// call to the desk server, ctx.onPublished the desk server's stream, ctx.chat(container) the face's chat of its goal,
// mounted below its items. The server half is process/js/desk/plugins/js/stackFrameChecks/: its verbs do the work and
// refuse what is wrong (each suite there, the gate's function in its file); this page only spares the wire.
//
// THE FORMS, DECIDED BY ANDY (goal/G22.3's box, 2026-10-13), not this page's to loosen: the gate is narrow, one
// spirit/run/<file>.js::<function>, and a whole module named as the gate is cheating; the endpoint is wide, a whole
// module, spirit/run/<file>.js, or Node's own, node:<http|https|fetch joined by +>, which takes its request paths.
// Every input carries its data-field (gate, endpoint, paths, suites) and is checked as typed, what is wrong said below
// it inside its framed block, the button off while any is wrong.

(function () {
  var win = typeof window !== 'undefined' ? window : {};
  var held = win.spiritDeskPlugins = win.spiritDeskPlugins || {};
  var ctx = null;
  var subscribed = false;
  var doors = [];
  var openId = '';      // the door whose dialog shows, '' when none
  var runInfo = null;   // its last runState
  var ticker = null;    // the elapsed-time tick while its run is under way
  var ticks = 0;
  var FILE_RE = /^spirit\/run\/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.js$/;
  var GATE_RE = /^spirit\/run\/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.js::[A-Za-z_$][A-Za-z0-9_$]*$/;
  var SUITE_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]*\.js$/;
  var PATH_RE = /^\/[A-Za-z0-9_.~%\/-]*$/;
  var KINDS = ['http', 'https', 'fetch'];
  var FIELDS = ['gate', 'endpoint', 'paths', 'suites'];
  var FORM_MAX = 256;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function value(id) { var el = document.getElementById(id); return el ? String(el.value || '') : ''; }
  function listOf(v) { return String(v || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean); }
  // What one field of a form says: '' when it may be sent. pre is the form's prefix: sfc- the add form, sfc-d- the dialog.
  function why(pre, field) {
    var v = value(pre + field).trim();
    var end = value(pre + 'endpoint').trim();
    var node = /^node:/.test(end);
    if (v.length > FORM_MAX) return v.length + ' characters, the limit is ' + FORM_MAX;
    if (field === 'gate') {
      if (!v) return '';
      if (FILE_RE.test(v)) return 'a whole module as the gate is cheating: name one function, ' + v + '::<function>';
      return GATE_RE.test(v) ? '' : 'a gate is spirit/run/<file>.js::<function>';
    }
    if (field === 'endpoint') {
      if (!v) return '';
      if (/::/.test(v)) return 'an endpoint is a whole module, spirit/run/<file>.js, not one function';
      if (node) {
        var kinds = v.slice(5).split('+');
        var bad = kinds.filter(function (k) { return KINDS.indexOf(k) === -1; });
        return bad.length ? 'Node\'s own are ' + KINDS.join(', ') + ', joined by +; not ' + bad.join(', ') : '';
      }
      return FILE_RE.test(v) ? '' : 'an endpoint is spirit/run/<file>.js, the whole module, or node:<kinds>';
    }
    var list = listOf(v);
    if (field === 'paths') {
      if (node && !list.length) return 'a node: endpoint needs its request paths, e.g. /api/relay/';
      if (!node && list.length) return 'paths belong to a node: endpoint; a module takes none';
      var p = list.filter(function (x) { return !PATH_RE.test(x); })[0];
      return p ? 'the path ' + p + ' is no request path: it starts with / and holds no space' : '';
    }
    var s = list.filter(function (x) { return !SUITE_RE.test(x); })[0];
    // Said without naming the harness's folder: nothing under spirit/run names it in code (runStandsAlone.js).
    if (s) return s + ' is not a suite\'s file name, <name>.js, with no folder';
    return list.some(function (x, i) { return list.indexOf(x) !== i; }) ? 'a suite is named twice' : '';
  }
  // What goes in a field, in words, on its block's first line: for an empty or wrong field what goes in it, for a right
  // one what its value means (goal/G22.3).
  var EMPTY = {
    gate: 'the one function every call must pass through: spirit/run/<file>.js::<function>',
    endpoint: 'what the gate guards: a whole module, spirit/run/<file>.js, or Node\'s own network calls, node:http+https+fetch',
    paths: 'the request paths a node: endpoint is watched on, comma-separated; a module takes none',
    suites: 'the test suites run while the probe watches, comma-separated file names',
  };
  function says(pre, field) {
    var v = value(pre + field).trim();
    if (!v || why(pre, field)) return EMPTY[field];
    if (field === 'gate') return 'one function, ' + v.split('::')[1] + ', in ' + v.split('::')[0];
    if (field === 'endpoint') return /^node:/.test(v) ? 'Node\'s own network calls: ' + v.slice(5).split('+').join(', ') : 'every function of ' + v;
    if (field === 'paths') return 'only the requests to ' + listOf(v).join(', ');
    return 'the test suites run while the probe watches: ' + listOf(v).join(', ');
  }
  // Every field of a form, every time one is typed in: what it means on its block's first line, what is wrong below its
  // input, its button off while any is wrong.
  function check(pre) {
    var wrong = false;
    FIELDS.forEach(function (f) {
      var w = why(pre, f);
      if (w) wrong = true;
      var head = document.getElementById(pre + f + '-says');
      if (head) head.textContent = says(pre, f);
      var left = document.getElementById(pre + f + '-left');
      if (!left) return;
      left.textContent = w;
      left.className = 'job-start-error';
    });
    var b = document.getElementById(pre === 'sfc-' ? 'sfc-make' : 'sfc-d-save');
    if (b) b.disabled = wrong;
  }
  // EACH INPUT IN ITS OWN FRAMED BLOCK (goal/G22.3). Andy, 2026-10-13: "input fields will look less crappy if arranged
  // in a block, that itself act's like an inline element". So a block per field, inline-block, framed and padded, with
  // its leading 1em: its name in bold and what goes in it in words, then the input, then what is wrong with it.
  function fieldsHtml(pre) {
    var place = { gate: 'spirit/run/js/peerPost.js::createPeerPost', endpoint: 'spirit/run/js/presenceNode.js, or node:http+https+fetch',
      paths: '/api/relay/', suites: 'serverSurface.js, everyVerb.js' };
    var label = { gate: 'Gate', endpoint: 'Endpoint', paths: 'Paths', suites: 'Suites' };
    return FIELDS.map(function (f) {
      return '<div class="sfc-field" data-block="' + pre + f + '" style="display:inline-block;vertical-align:top;box-sizing:border-box;width:30em;max-width:100%;' +
          'margin-top:1em;margin-right:1em;padding:0.5em 0.75em;border:1px solid var(--spirit-line, #e2e5e9);border-radius:var(--spirit-radius, 8px)">' +
          '<div><b>' + label[f] + ':</b> <span id="' + pre + f + '-says" class="job-manifest-note">' + esc(EMPTY[f]) + '</span></div>' +
          '<input type="text" id="' + pre + f + '" data-field="' + f + '" placeholder="' + esc(place[f]) + '" style="box-sizing:border-box;width:100%;margin-top:0.5em">' +
          '<div id="' + pre + f + '-left" class="job-start-error"></div>' +
        '</div>';
    }).join('');
  }
  function doorOf(pre) {
    return { gate: value(pre + 'gate').trim(), endpoint: value(pre + 'endpoint').trim(), paths: listOf(value(pre + 'paths')), suites: listOf(value(pre + 'suites')) };
  }
  function say(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = String(text || '');
  }
  function errText(e) { return (e && e.message) || String(e); }
  function when(iso) { return iso ? String(iso).replace('T', ' ').replace(/\.\d+Z$/, 'Z') : ''; }

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
  function readDoors() {
    if (!ctx) return;
    Promise.resolve(ctx.ask('stackFrameChecks.doors', {})).then(function (r) {
      doors = (r && Array.isArray(r.doors)) ? r.doors : [];
      var el = document.getElementById('sfc-doors');
      if (!el) return;
      el.innerHTML = doors.length ? '<table class="jobs-table"><tbody>' + doors.map(function (d) {
        var paths = Array.isArray(d.paths) && d.paths.length ? ' <span class="job-manifest-note">on ' + esc(d.paths.join(', ')) + '</span>' : '';
        var suites = Array.isArray(d.suites) && d.suites.length ? esc(d.suites.join(', ')) : '<span class="job-start-error">no suites measured yet</span>';
        return '<tr data-door="' + esc(d.id) + '"><td>' + esc(d.gate) + '</td><td>' + esc(d.endpoint) + paths + '</td><td>' + suites + '</td><td>' +
          lastHtml(d.last) + '</td><td>' + esc(d.item) + '</td><td><button type="button" data-open="' + esc(d.id) + '" style="margin-right:1em">Open</button></td></tr>';
      }).join('') + '</tbody></table>' : '<div class="job-manifest-note">No doors yet.</div>';
    }, function () { /* the list stays as it was */ });
  }

  // ── THE DOOR'S DIALOG: EDIT, REMOVE, RUN ───────────────────────────
  function stopTicking() { if (ticker) { clearTimeout(ticker); ticker = null; } }
  function drawRun() {
    var el = document.getElementById('sfc-d-state');
    if (!el) return;
    var r = runInfo;
    if (!r) { el.innerHTML = '<div class="job-manifest-note">Reading its last run.</div>'; return; }
    if (r.running) {
      var secs = Math.max(0, Math.round((Date.now() - Date.parse(r.startedAt)) / 1000)) || 0;
      el.innerHTML = '<div class="label">Its run</div><div>running, ' + secs + ' s, since ' + esc(when(r.startedAt)) + '</div>' +
        (r.tail ? '<pre class="job-manifest-note" style="margin-top:1em">' + esc(r.tail) + '</pre>' : '');
      return;
    }
    var v = r.verdict || {};
    var head;
    if (!r.endedAt) head = '<div class="job-manifest-note">never run</div>';
    else if (!v.ran) head = '<div class="job-start-error">' + (r.stopped ? 'stopped' : 'no verdict') + (v.why ? ': ' + esc(v.why) : '') + ', ' + esc(when(r.endedAt)) + '</div>';
    else if (v.green) head = '<div class="job-manifest-note">green: ' + v.of + ' production call(s), every one through the gate, ' + esc(when(r.endedAt)) + '</div>';
    else head = '<div class="job-start-error">red: ' + v.around + ' path(s) around the gate, of ' + v.of + ' production call(s), ' + esc(when(r.endedAt)) + '</div>';
    // ONE LINE PER VIOLATOR (goal/G22.3). Andy, 2026-10-13: "much better, gimme that when i press run:", lines such as
    // "hub.js:300 sealedClaim (from handleClaim) ---> GET /api/relay/key, bypassing createPeerPost", made by the server
    // half (violators.js). The raw paths stay one click away, folded under their own details.
    var said = (Array.isArray(v.violators) ? v.violators : []).map(function (p) { return '<div class="sfc-violator" style="margin-top:0.25em">' + esc(p) + '</div>'; }).join('');
    var saidLeft = Number(v.violatorsLeft) > 0 ? '<div class="job-manifest-note">and ' + v.violatorsLeft + ' more violator(s)</div>' : '';
    var raw = Array.isArray(v.paths) ? v.paths : [];
    var paths = raw.map(function (p) { return '<div class="sfc-path" style="margin-top:0.25em">' + esc(p) + '</div>'; }).join('');
    var left = Number(v.pathsLeft) > 0 ? '<div class="job-manifest-note">and ' + v.pathsLeft + ' more, kept with the run</div>' : '';
    var folded = raw.length ? '<details style="margin-top:1em"><summary class="job-manifest-note">raw paths (' + (raw.length + (Number(v.pathsLeft) || 0)) + ')</summary>' + paths + left + '</details>' : '';
    el.innerHTML = '<div class="label">Its run</div>' + head + (v.ran && v.why ? '<div class="job-manifest-note">' + esc(v.why) + '</div>' : '') + said + saidLeft + folded +
      (r.tail ? '<pre class="job-manifest-note" style="margin-top:1em">' + esc(r.tail) + '</pre>' : '');
  }
  // While its run is under way the elapsed time ticks each second, and every fifth tick asks again in case a published
  // end was missed; the stream is what normally says it ended.
  function tick() {
    stopTicking();
    if (!runInfo || !runInfo.running || !openId) return;
    ticker = setTimeout(function () {
      ticker = null;
      ticks++;
      if (ticks % 5 === 0) readRunState(); else { drawRun(); tick(); }
    }, 1000);
  }
  function readRunState() {
    if (!ctx || !openId) return;
    var id = openId;
    Promise.resolve(ctx.ask('stackFrameChecks.runState', { id: id })).then(function (r) {
      if (openId !== id) return;
      runInfo = r || null;
      drawRun();
      tick();
    }, function (e) { if (openId === id) say('sfc-d-note', 'Its run could not be read: ' + errText(e)); });
  }
  function openDialog(id) {
    var d = doors.filter(function (x) { return x.id === id; })[0];
    var dlg = document.getElementById('sfc-dialog');
    if (!d || !dlg) return;
    openId = id;
    runInfo = null;
    stopTicking();
    // Every block a leading 1em; each button 1em after itself (the desk's UI rules).
    dlg.innerHTML =
      '<div id="sfc-dialog-body" class="stat-tile wide" style="margin-top:1em"><div class="label">Door ' + esc(d.id) + ', asked by ' + esc(d.item) + '</div>' +
        '<div class="start-job-form card" style="margin-top:1em">' + fieldsHtml('sfc-d-') +
          '<div style="margin-top:1em"><button type="button" id="sfc-d-save" style="margin-right:1em">Save</button>' +
          '<button type="button" id="sfc-d-remove" style="margin-right:1em">Remove</button></div></div>' +
        '<div class="start-job-form card" style="margin-top:1em">' +
          '<button type="button" id="sfc-d-run" style="margin-right:1em">Run</button>' +
          '<button type="button" id="sfc-d-stop" style="margin-right:1em">Stop</button>' +
          '<button type="button" id="sfc-d-close" style="margin-right:1em">Close</button></div>' +
        '<div id="sfc-d-note" class="job-start-error" style="margin-top:1em"></div>' +
        '<div id="sfc-d-state" style="margin-top:1em"></div>' +
      '</div>';
    dlg.hidden = false;
    var set = function (f, v) { var el = document.getElementById('sfc-d-' + f); if (el) el.value = v; };
    set('gate', d.gate);
    set('endpoint', d.endpoint);
    set('paths', Array.isArray(d.paths) ? d.paths.join(', ') : '');
    set('suites', Array.isArray(d.suites) ? d.suites.join(', ') : '');
    check('sfc-d-');
    drawRun();
    readRunState();
  }
  function closeDialog() {
    openId = '';
    runInfo = null;
    stopTicking();
    var dlg = document.getElementById('sfc-dialog');
    if (dlg) { dlg.innerHTML = ''; dlg.hidden = true; }
  }
  function save() {
    var id = openId;
    var wrong = FIELDS.map(function (f) { return why('sfc-d-', f); }).filter(Boolean)[0];
    if (wrong) { say('sfc-d-note', 'Not saved: ' + wrong); return; }
    var d = doorOf('sfc-d-');
    say('sfc-d-note', 'Sent; waiting for the desk.');
    Promise.resolve(ctx.ask('stackFrameChecks.update', { id: id, gate: d.gate, endpoint: d.endpoint, paths: d.paths, suites: d.suites })).then(function () {
      say('sfc-d-note', 'Saved. Its last verdict is cleared: it described the door as it was.');
      readDoors();
      readRunState();
    }, function (e) { say('sfc-d-note', 'Not saved: ' + errText(e)); });
  }
  function remove() {
    var id = openId;
    Promise.resolve(ctx.ask('stackFrameChecks.remove', { id: id })).then(function () {
      closeDialog();
      say('sfc-note', 'Door ' + id + ' is struck from the list; its item stays.');
      readDoors();
    }, function (e) { say('sfc-d-note', 'Not removed: ' + errText(e)); });
  }
  function run() {
    var id = openId;
    say('sfc-d-note', 'Starting.');
    Promise.resolve(ctx.ask('stackFrameChecks.run', { id: id })).then(function () {
      say('sfc-d-note', '');
      readRunState();
    }, function (e) { say('sfc-d-note', 'Not started: ' + errText(e)); });
  }
  function stop() {
    var id = openId;
    Promise.resolve(ctx.ask('stackFrameChecks.stop', { id: id })).then(function () {
      say('sfc-d-note', 'Stopped.');
      readRunState();
    }, function (e) { say('sfc-d-note', 'Not stopped: ' + errText(e)); });
  }

  function ofMyGoal(obj) {
    if (!ctx || !obj || typeof obj !== 'object') return false;
    var item = obj.item;
    if (typeof item === 'string') { try { item = JSON.parse(item); } catch (e) { item = null; } }
    var rows = (Array.isArray(obj.rows) ? obj.rows : []).concat(item ? [item] : []);
    return rows.some(function (x) { return x && (x.id === ctx.goal || x.goal === ctx.goal); });
  }
  function make() {
    var d = doorOf('sfc-');
    if (!d.gate || !d.endpoint) { say('sfc-note', 'Not sent: a gate and an endpoint are both needed.'); return; }
    var wrong = FIELDS.map(function (f) { return why('sfc-', f); }).filter(Boolean)[0];
    if (wrong) { say('sfc-note', 'Not sent: ' + wrong); return; }
    say('sfc-note', 'Sent; waiting for the desk.');
    Promise.resolve(ctx.ask('stackFrameChecks.make', d)).then(function (r) {
      FIELDS.forEach(function (f) { var el = document.getElementById('sfc-' + f); if (el) el.value = ''; });
      check('sfc-');
      say('sfc-note', 'Made ' + ((r && r.id) || 'the item') + ': nobody but ' + d.gate + ' reaches ' + d.endpoint + '. The door is in the list' + (d.suites.length ? '.' : ', with no suites yet.'));
      readItems();
      readDoors();
    }, function (e) { say('sfc-note', 'Not made: ' + errText(e)); });
  }

  held.stackFrameChecks = {
    open: function (container, given) {
      ctx = given;
      openId = '';
      runInfo = null;
      stopTicking();
      // Every block carries a leading 1em; each button in a row 1em after itself (the desk's UI rules).
      container.innerHTML =
        '<div class="stat-tile wide" style="margin-top:1em"><div class="label">Stack-frame checks</div>' +
          '<div class="job-manifest-note">The doors the stack-frame test checks: each says every production stack reaching ' +
          'its endpoint passes through its gate. Add one below (the plugin also makes its item "Nobody but &lt;gate&gt; reaches ' +
          '&lt;endpoint&gt;"); open one to edit it, remove it, or run its check alone and read the paths around its gate.</div></div>' +
        '<div class="start-job-form card" style="margin-top:1em">' + fieldsHtml('sfc-') +
          '<div style="margin-top:1em"><button type="button" id="sfc-make" style="margin-right:1em">Add the door</button></div>' +
        '</div>' +
        '<div id="sfc-note" class="job-start-error" style="margin-top:1em"></div>' +
        '<div class="stat-tile wide" style="margin-top:1em"><div class="label">The doors</div><div id="sfc-doors"></div></div>' +
        '<div id="sfc-dialog" hidden></div>' +
        '<div class="stat-tile wide" style="margin-top:1em"><div class="label">Its items</div><div id="sfc-items"></div></div>' +
        // ITS GOAL'S CHAT, BELOW THE LIST (goal/G22.3). Andy, 2026-10-13: "in Stack: the chat is missing, below the
        // inputs, after what will be the list". The desk face draws it, Team's chat taking this goal (ctx.chat).
        '<div id="sfc-chat"></div>';
      var dlg = document.getElementById('sfc-dialog');
      if (dlg) dlg.hidden = true;
      // One listener of each on the container, which is repainted at every open: wired once.
      if (!container.sfcWired) {
        container.sfcWired = true;
        container.addEventListener('input', function (e) {
          var t = e && e.target;
          var f = t && t.getAttribute ? t.getAttribute('data-field') : null;
          if (FIELDS.indexOf(f) === -1) return;
          if (/^sfc-d-/.test(String(t.id))) check('sfc-d-');
          else if (/^sfc-/.test(String(t.id))) check('sfc-');
        });
        container.addEventListener('click', function (e) {
          var t = e && e.target;
          if (!t) return;
          var door = t.getAttribute ? t.getAttribute('data-open') : null;
          if (door) { openDialog(door); return; }
          if (t.id === 'sfc-make') make();
          else if (t.id === 'sfc-d-save') save();
          else if (t.id === 'sfc-d-remove') remove();
          else if (t.id === 'sfc-d-run') run();
          else if (t.id === 'sfc-d-stop') stop();
          else if (t.id === 'sfc-d-close') closeDialog();
        });
      }
      // ITS OWN STREAM (the desk's UI rule): subscribed once, for whichever goal it was last opened on. The plugin's
      // own publishes ({ plugin: 'stackFrameChecks', data: { what, id } }) read the doors again, and the open dialog's
      // run when they name its door.
      if (!subscribed && typeof given.onPublished === 'function') {
        subscribed = true;
        given.onPublished(function (obj) {
          if (obj && obj.plugin === 'stackFrameChecks') {
            readDoors();
            var data = obj.data || {};
            if (openId && (!data.id || data.id === openId)) readRunState();
            return;
          }
          if (ofMyGoal(obj)) { readItems(); readDoors(); }
        });
      }
      if (typeof given.chat === 'function') given.chat(document.getElementById('sfc-chat'));
      check('sfc-');
      readItems();
      readDoors();
    },
  };
}());
