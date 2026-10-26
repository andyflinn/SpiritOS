// spirit/run/shell/desk/plugins/fallout/fallout.js
// THE FALLOUT PLUGIN'S PRIVATE UI (goal/G27.14): Desk's Fallout tab under Apps, in its reduced scope.
//
// DECIDED BY ANDY, 2026-10-17, in goal/G27.14's box: "I just want a Fallout app, that searches "reds" in verifier, and
// shows me a table of test items that match the search term", and "we can leave the tabs inside this desk-app, we just
// don't fill the second tab yet". So two inner tabs: Reds, and Items, empty for now, saying so.
//
// FALLOUT TALKS TO DESKVERIFY ONLY (goal/G29.5; Andy, 2026-10-17: "correct. fallout talks to deskVerify only."). Its
// Reds list is the probability search (shell/js/probabilitySearch.js; goal/G40.12: "all searches in desk are of the new
// probability variety"), over deskVerify's own search verb and stream; the pane keeps no cache, no wire slot, no timer and no ranking of its
// own: the list does all of that the same way everywhere. Desk hands the pane its own call (ctx.verb) and stream
// (ctx.onPublished); they are the list's api. THE SUMMARY GOES THROUGH THE LIST'S ONE SLOT (list.ask): Andy, on
// goal/G27.14, "make SURE there's MAX one search in flight over the wire.... IMPORTANT."
//
// Loaded once into the Desk page the first time its tab opens (shell/desk/desk.js, deskOpenPlugin); it registers
// window.spirit.deskPlugins.fallout = { open(container, ctx) }.

(function () {
  var win = typeof window !== 'undefined' ? window : {};
  var held = (win.spirit = win.spirit || {}).deskPlugins = win.spirit.deskPlugins || {};
  var LIST_SCRIPT = '/shell/js/probabilitySearch.js';
  var ctx = null;
  var inner = 'reds';
  var list = null;

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
    if (items) {
      items.innerHTML = '<div class="label">Items</div><div class="job-manifest-note">Nothing yet: the Fallout items come later (goal/G27.14).</div>';
      items.hidden = inner !== 'items';
    }
  }

  // THE LIST'S CONFIGURATION (goal/G29.5's box): deskVerify's search over the tests that stand now, slim, one line per
  // test (Andy: "i WANT TO SEE ONE FUCKING LINE PER FUCKING TEST."); a suite's file name asks for that suite.
  function args(text, filters) {
    var a = { over: 'tests', current: 'yes', slim: 'yes' };
    if (filters && filters.outcome) a.outcome = filters.outcome;
    if (/^[A-Za-z0-9_][A-Za-z0-9_.-]*\.js$/.test(text)) a.suite = text;
    else if (text) a.test = text;
    return a;
  }
  // THE ✅/❌ FILTER (Andy, 2026-10-17: "do i get a filter for ✅ or ❌?"): red first, as the tab is the reds'.
  var FILTERS = [{
    name: 'outcome',
    choices: [{ value: 'red', icon: '❌', word: 'fail' }, { value: 'green', icon: '✅', word: 'success' }, { value: '', word: 'both' }],
    test: function (row, value) { return !value || row.outcome === value ? 1 : 0; },
  }];
  // ONE NICE LINE PER TEST (Andy: "test-file-name | failure-description | success or fail | since"), and NO DETAIL ON
  // SCREEN ("I know you can read those details, so it doesn't need to be on-screen."): the failure and the commit stay in
  // deskVerify. The probability search draws the columns from each row's own fields (outcome red or green, at the time);
  // matched words are marked there.
  var COLUMNS = [
    { field: 'suite', label: 'Suite', sort: 'text' },
    { field: 'title', label: 'Test', sort: 'text' },
    { field: 'outcome', label: 'Result', sort: 'text' },
    { field: 'at', label: 'Since', sort: 'date' },
  ];
  // A test's history in a dialog (Andy: "if you want to show the history of one test, use a dialog."): the list's details
  // hook, a press in its pane (goal/G29.9).
  function details(row) {
    if (ctx && typeof ctx.callDialog === 'function') ctx.callDialog('shell/falloutHistory', { suite: row.suite, heading: row.title });
  }

  // THE SIZE OF THE PROBLEM (Andy: "what I want to know is TOTAL OF ALL FAILURES. period"): how many tests are red now,
  // of all, two deskVerify searches through the list's one slot.
  function summary() {
    if (!list) return;
    var totals = {};
    var count = function (outcome) {
      return list.ask('search', { over: 'tests', current: 'yes', outcome: outcome }).then(function (r) { totals[outcome] = Number(r && r.total) || 0; });
    };
    count('red').then(function () { return count('green'); }).then(function () {
      var el = document.getElementById('fallout-summary');
      if (!el) return;
      var all = totals.red + totals.green;
      el.textContent = '❌ ' + totals.red + ' red of ' + all + ' tests now' + (all ? ' (' + Math.round(totals.red * 100 / all) + '%)' : '') + '.';
    }, function () { /* the line stays as it was */ });
  }

  function mountList() {
    var P = win.spirit.elements && win.spirit.elements.probabilitySearch;
    var el = document.getElementById('fallout-list');
    if (!P || typeof P.create !== 'function' || !el || !ctx) return;
    list = P.create(el, {
      api: { verb: ctx.verb, onPublished: ctx.onPublished },
      server: 'deskVerify',
      verb: 'search',
      args: args,
      columns: COLUMNS,
      matched: function (row) { return { suite: String((row && row.suite) || ''), title: String((row && row.title) || '') }; },
      filters: FILTERS,
      details: details,
      empty: 'No test matches.',
    });
    list.refresh();
    summary();
    // The summary follows deskVerify too: each of its publishes counts again, through the same slot.
    if (typeof ctx.onPublished === 'function') ctx.onPublished(function () { summary(); }, 'deskVerify');
  }
  // THE PROBABILITY SEARCH, LOADED ON DEMAND, as Desk loads its shared element (deskLoadSharedElement): once per page.
  function withList(done) {
    if (win.spirit.elements && win.spirit.elements.probabilitySearch) { done(); return; }
    if (typeof document.createElement !== 'function' || !document.body) return;
    var script = document.createElement('script');
    script.src = LIST_SCRIPT;
    script.onload = done;
    document.body.appendChild(script);
  }

  held.fallout = {
    open: function (container, given) {
      ctx = given;
      // Every block a leading 1em; each button 1em after itself (the desk's UI rules).
      container.innerHTML =
        '<div class="stat-tile wide" style="margin-top:1em"><div class="label">Fallout</div>' +
          '<div class="job-manifest-note">What a goal leaves red beyond its own scope. Reds searches the verifier\'s tests that stand now; ' +
          'Items will hold the work they cause.</div></div>' +
        '<div class="stat-tile wide" style="margin-top:1em"><div class="label">Now</div><div id="fallout-summary" class="job-manifest-note">Counting.</div></div>' +
        '<div id="fallout-tabs" style="margin-top:1em"></div>' +
        '<div id="fallout-pane-reds"><div id="fallout-list" class="stat-tile wide" style="margin-top:1em"></div></div>' +
        '<div id="fallout-items" class="stat-tile wide" style="margin-top:1em" hidden></div>' +
        // THE GOAL CHAT AT THE BOTTOM (Andy, 2026-10-17: "add the goal chat at the bottom."), below both inner tabs.
        '<div id="fallout-chat"></div>';
      if (!container.falloutWired) {
        container.falloutWired = true;
        container.addEventListener('click', function (e) {
          var t = e && e.target;
          var tab = t && t.getAttribute ? t.getAttribute('data-fallout-tab') : null;
          if (tab === 'reds' || tab === 'items') { inner = tab; drawTabs(); }
        });
      }
      drawTabs();
      withList(mountList);
      if (typeof given.chat === 'function') given.chat(document.getElementById('fallout-chat'));
    },
  };
}());
