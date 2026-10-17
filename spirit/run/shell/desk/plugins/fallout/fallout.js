// spirit/run/shell/desk/plugins/fallout/fallout.js
// THE FALLOUT PLUGIN'S PRIVATE UI (goal/G27.14): Desk's Fallout tab under Apps, in its reduced scope.
//
// DECIDED BY ANDY, 2026-10-17, in goal/G27.14's box: "I just want a Fallout app, that searches "reds" in verifier, and
// shows me a table of test items that match the search term", and "we can leave the tabs inside this desk-app, we just
// don't fill the second tab yet". So two inner tabs (F2): Reds, one search box and the table of the verifier's tests
// that are red now and match it (suite, test, the commit and time it went red, its failure line), through the plugin's
// verb fallout.reds; and Items, empty for now, saying so (F4).
//
// Loaded once into the Desk page the first time its tab opens (shell/desk/desk.js, deskOpenPlugin); it registers
// window.spiritDeskPlugins.fallout = { open(container, ctx) }, ctx.ask being the call to the desk server.

(function () {
  var win = typeof window !== 'undefined' ? window : {};
  var held = win.spiritDeskPlugins = win.spiritDeskPlugins || {};
  var ctx = null;
  var inner = 'reds';
  var searching = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function when(iso) { return iso ? String(iso).replace('T', ' ').replace(/\.\d+Z$/, 'Z') : ''; }
  function say(text) { var el = document.getElementById('fallout-note'); if (el) el.textContent = String(text || ''); }
  function tabButton(name, label) {
    var on = inner === name;
    return '<button type="button" data-fallout-tab="' + name + '" aria-selected="' + (on ? 'true' : 'false') + '" style="margin-right:1em' +
      (on ? ';font-weight:bold;text-decoration:underline' : '') + '">' + label + '</button>';
  }
  function drawTabs() {
    var row = document.getElementById('fallout-tabs');
    if (row) row.innerHTML = tabButton('reds', 'Reds') + tabButton('items', 'Items');
    var reds = document.getElementById('fallout-pane-reds');
    var items = document.getElementById('fallout-items');
    if (reds) reds.hidden = inner !== 'reds';
    // F4: Items, empty for now, saying so.
    if (items) {
      items.innerHTML = '<div class="label">Items</div><div class="job-manifest-note">Nothing yet: the Fallout items come later (goal/G27.14).</div>';
      items.hidden = inner !== 'items';
    }
  }
  // F2: the reds that match, one row each.
  function search() {
    if (!ctx || searching) return;
    var box = document.getElementById('fallout-text');
    var text = box ? String(box.value || '').trim() : '';
    // THE ✅/❌ FILTER (Andy, 2026-10-17: "do i get a filter for ✅ or ❌?"): red, green, or '' for both.
    var pick = document.getElementById('fallout-outcome');
    var outcome = pick ? String(pick.value == null ? 'red' : pick.value) : 'red';
    searching = true;
    say('Searching the verifier.');
    Promise.resolve(ctx.ask('fallout.reds', { text: text, outcome: outcome })).then(function (r) {
      searching = false;
      var rows = ((r && r.items) || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return null; } }).filter(Boolean);
      // HOW MANY (Andy: "how many red?"): every match, beside the rows one answer carries.
      var count = document.getElementById('fallout-count');
      var total = Number(r && r.total) || rows.length;
      if (count) count.textContent = total + ' ' + (outcome === 'red' ? '❌ red' : outcome === 'green' ? '✅ green' : 'tests') + ' now' + (total > rows.length ? ', the ' + rows.length + ' best shown' : '');
      var el = document.getElementById('fallout-reds');
      if (el) {
        // ONE NICE LINE PER TEST (Andy, 2026-10-17: "one nice line per failure / test-file-name | failure-description |
        // success or fail | since"). The description is the sentence of what is tested, the test's sub-heading (its key
        // without the number); what the suite printed on failing is for a debugging agent, so it is not on screen.
        // ONLY THE LATEST, ONE LINE PER TESTED THING (Andy, 2026-10-17: "i only want to see the latest, if you want to
        // show the history of one test, use a dialog."). A test file and its sub-heading are one tested thing: its
        // checks fold into one line, ❌ fail while any of them is red, its newest time.
        var groups = [];
        var byKey = Object.create(null);
        rows.forEach(function (x) {
          var what = String(x.title || '').replace(/\s+#\d+$/, '');
          var k = x.suite + '\n' + what;
          var g = byKey[k];
          if (!g) { g = byKey[k] = { suite: x.suite, what: what, red: false, at: '' }; groups.push(g); }
          if (x.outcome === 'red') g.red = true;
          if (String(x.at || '') > g.at) g.at = String(x.at || '');
        });
        el.innerHTML = groups.length ? '<table class="jobs-table"><thead><tr><th>Test file</th><th>What is tested</th><th>Status</th><th>Since</th></tr></thead><tbody>' +
          groups.map(function (g) {
            // F6: the line opens its history (data-suite, data-heading).
            // NO DETAIL ON SCREEN, NOT EVEN ON HOVER (Andy, 2026-10-17: "I know you can read those details, so it
            // doesn't need to be on-screen."): the failures stay in deskVerify for the agents.
            return '<tr data-suite="' + esc(g.suite) + '" data-heading="' + esc(g.what) + '" style="cursor:pointer">' +
              '<td>' + esc(g.suite) + '</td><td>' + esc(g.what) + '</td>' +
              '<td>' + (g.red ? '❌ fail' : '✅ success') + '</td><td>' + esc(when(g.at)) + '</td></tr>';
          }).join('') + '</tbody></table>' : '<div class="job-manifest-note">No test matches' + (text ? ' "' + esc(text) + '"' : '') + '.</div>';
      }
      say(r && r.more ? 'More match than one answer holds: narrow the search.' : '');
    }, function (e) { searching = false; say('The verifier could not be searched: ' + ((e && e.message) || e)); });
  }

  held.fallout = {
    open: function (container, given) {
      ctx = given;
      // Every block a leading 1em; each button 1em after itself (the desk's UI rules).
      container.innerHTML =
        '<div class="stat-tile wide" style="margin-top:1em"><div class="label">Fallout</div>' +
          '<div class="job-manifest-note">What a goal leaves red beyond its own scope. Reds searches the verifier\'s tests that are red now; ' +
          'Items will hold the work they cause.</div></div>' +
        '<div id="fallout-tabs" style="margin-top:1em"></div>' +
        '<div id="fallout-pane-reds">' +
          '<div class="start-job-form card" style="margin-top:1em"><label class="field-label grow">Search the reds' +
            '<input type="search" id="fallout-text" data-field="label" placeholder="words of a test\'s name, or a suite like deskServer.js"></label>' +
            '<select id="fallout-outcome" style="margin-right:1em"><option value="red" selected>❌ red</option><option value="green">✅ green</option><option value="">both</option></select>' +
            '<button type="button" id="fallout-search" style="margin-right:1em">Search</button></div>' +
          '<div id="fallout-note" class="job-start-error" style="margin-top:1em"></div>' +
          '<div class="stat-tile wide" style="margin-top:1em"><div class="label">Tests as they stand now: <span id="fallout-count"></span></div><div id="fallout-reds">' +
            '<div class="job-manifest-note">Search to see the reds; an empty search lists the newest.</div></div></div>' +
        '</div>' +
        '<div id="fallout-items" class="stat-tile wide" style="margin-top:1em" hidden></div>' +
        // THE GOAL CHAT AT THE BOTTOM (Andy, 2026-10-17: "add the goal chat at the bottom."), below both inner tabs,
        // the face's own chat of this goal (ctx.chat).
        '<div id="fallout-chat"></div>';
      if (!container.falloutWired) {
        container.falloutWired = true;
        container.addEventListener('click', function (e) {
          var t = e && e.target;
          if (!t) return;
          var tab = t.getAttribute ? t.getAttribute('data-fallout-tab') : null;
          if (tab === 'reds' || tab === 'items') { inner = tab; drawTabs(); return; }
          // F6: a line opens the history dialog of its tested thing.
          var line = t.closest ? t.closest('[data-suite]') : null;
          var suite = (line && line.getAttribute('data-suite')) || (t.getAttribute ? t.getAttribute('data-suite') : null);
          var heading = (line && line.getAttribute('data-heading')) || (t.getAttribute ? t.getAttribute('data-heading') : null);
          if (suite && heading && ctx && typeof ctx.callDialog === 'function') { ctx.callDialog('shell/falloutHistory', { suite: suite, heading: heading }); return; }
          if (t.id === 'fallout-search') search();
        });
        container.addEventListener('keydown', function (e) { var t = e && e.target; if (t && t.id === 'fallout-text' && e.key === 'Enter' && !e.repeat) search(); });
      }
      drawTabs();
      if (typeof given.chat === 'function') given.chat(document.getElementById('fallout-chat'));
    },
  };
}());
