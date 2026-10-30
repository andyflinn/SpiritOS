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
  }, {
    // PRODUCT TESTS ONLY (goal/G41.22; Andy: "fallout needs a filter that show me product tests only"; agreed: "product
    // tests are the tests under spirit/run; the repo's spirit/test is hidden by the filter"). The reporter sends a product
    // test's suite as /<path>/<module> (test/testReport.js, SUITE); a spirit/test suite comes as its bare file name. The
    // list's own filter, as deskVerify's search has no key for it; it goes with the outcome filter.
    name: 'scope',
    choices: [{ value: '', word: 'all tests' }, { value: 'product', word: 'product tests only' }],
    test: function (row, value) { return !value || String((row && row.suite) || '').charAt(0) === '/' ? 1 : 0; },
  }];
  // THE OUTCOME AS ITS ICON (goal/G41.22; Andy: "the "green"/"red" column must use icons"; agreed: "the icons are the
  // reporter's own: ✅ green, ❌ red"). deskVerify answers the words; each row it answers carries its icon too, as the
  // field the Result column shows (result), and the filter still reads the words (outcome).
  var ICONS = { green: '✅', red: '❌' };
  function withIcons(answer) {
    var b = answer && answer.body;
    if (!b || !Array.isArray(b.items)) return answer;
    b.items = b.items.map(function (it) {
      var row = null;
      try { row = JSON.parse(it.label); } catch (e) { row = null; }
      if (!row || typeof row !== 'object') return it;
      row.result = ICONS[row.outcome] || String(row.outcome || '');
      return Object.assign({}, it, { label: JSON.stringify(row) });
    });
    return answer;
  }
  // THE RESULT CELL'S ICON IS THE ICON ELEMENT (goal/G41.23; Andy: "this element will replace icons painting all shell
  // elements and apps."): the list draws each cell as text from its row's field, so once shell/js/icon.js is here a cell
  // of the Result column holding only its ✅ or ❌ is made the element in place, as the list draws it (watched). The
  // words of the filter buttons and the summary line are text beside a glyph, and stay as they are.
  function paintResults(root) {
    var I = win.spirit.elements && win.spirit.elements.icon;
    if (!I || !root || typeof root.querySelectorAll !== 'function') return;
    Array.prototype.forEach.call(root.querySelectorAll('td[data-field="result"]'), function (td) {
      var glyph = String(td.textContent || '').trim();
      if (!glyph || td.querySelector('.shell-icon')) return;
      td.textContent = '';
      I.create(td, { glyph: glyph });
    });
  }
  function watchResults(root) {
    var loaded = typeof win.spirit.require === 'function' ? Promise.resolve(win.spirit.require('shell/js/icon.js')).then(null, function () { /* the glyphs stay text */ }) : Promise.resolve();
    loaded.then(function () { paintResults(root); });
    if (typeof MutationObserver === 'function' && root) new MutationObserver(function () { paintResults(root); }).observe(root, { childList: true, subtree: true });
  }
  // ONE NICE LINE PER TEST (Andy: "test-file-name | failure-description | success or fail | since"), and NO DETAIL ON
  // SCREEN ("I know you can read those details, so it doesn't need to be on-screen."): the failure and the commit stay in
  // deskVerify. The probability search draws the columns from each row's own fields (outcome red or green, at the time);
  // matched words are marked there.
  var COLUMNS = [
    { field: 'suite', label: 'Suite', sort: 'text' },
    { field: 'title', label: 'Test', sort: 'text' },
    { field: 'result', label: 'Result', sort: 'text' },
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
      api: { verb: function (name, a) { return Promise.resolve(ctx.verb(name, a)).then(withIcons); }, onPublished: ctx.onPublished },
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
  // THE PROBABILITY SEARCH, LOADED ON DEMAND through the one loader (goal/G41.11; rule/21): spirit.require, once per page.
  function withList(done) {
    if (win.spirit.elements && win.spirit.elements.probabilitySearch) { done(); return; }
    Promise.resolve(win.spirit.require(String(LIST_SCRIPT).replace(/^\/+/, ''))).then(function () { done(); }, function () { /* no list */ });
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
        // THE REDS LIST IN A BOX OF A STATED SIZE (goal/G41.11, rule/16): a fill box in a fill pane, no stat-tile.
        '<div id="fallout-pane-reds" class="fill"><div id="fallout-list" class="fill" style="margin-top:1em"></div></div>' +
        // NO CHAT (goal/G41.22, box v25; Andy: "The chat needs to be removed from fallout"): the goal chat it carried
        // since goal/G27.14 is gone, and ctx.chat is never asked for one.
        '<div id="fallout-items" class="stat-tile wide" style="margin-top:1em" hidden></div>';
      if (!container.falloutWired) {
        container.falloutWired = true;
        container.addEventListener('click', function (e) {
          var t = e && e.target;
          var tab = t && t.getAttribute ? t.getAttribute('data-fallout-tab') : null;
          if (tab === 'reds' || tab === 'items') { inner = tab; drawTabs(); }
        });
        // Once per container, as the click is.
        watchResults(container);
      }
      drawTabs();
      withList(mountList);
    },
  };
}());
