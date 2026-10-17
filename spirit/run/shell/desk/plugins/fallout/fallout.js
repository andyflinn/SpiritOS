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
  var cache = Object.create(null);   // every line any search brought, by test file and sub-heading
  // MAX ONE REQUEST ON THE WIRE (goal/G27.14). Andy, 2026-10-17: "and make sure that only one typing update is in
  // flight at the time....", and "make SURE there's MAX one search in flight over the wire.... IMPORTANT.". Every
  // request of this pane goes through this one slot: while one is out, each kind (the search, the summary) keeps only
  // its latest call waiting, and when the one out returns the next goes, the search before the summary. A call folded
  // into a later one gets that later one's answer.
  var wireBusy = false;
  var wireWaiting = Object.create(null);   // verb -> { args, waiters: [{ resolve, reject }] }
  var WIRE_ORDER = ['fallout.reds', 'fallout.summary'];
  function wire(verb, args) {
    return new Promise(function (resolve, reject) {
      var w = wireWaiting[verb] || (wireWaiting[verb] = { args: args, waiters: [] });
      w.args = args;
      w.waiters.push({ resolve: resolve, reject: reject });
      pump();
    });
  }
  function pump() {
    if (wireBusy || !ctx) return;
    var verb = WIRE_ORDER.filter(function (v) { return wireWaiting[v]; })[0];
    if (!verb) return;
    var w = wireWaiting[verb];
    delete wireWaiting[verb];
    wireBusy = true;
    Promise.resolve(ctx.ask(verb, w.args)).then(function (r) {
      wireBusy = false;
      w.waiters.forEach(function (x) { x.resolve(r); });
      pump();
    }, function (e) {
      wireBusy = false;
      w.waiters.forEach(function (x) { x.reject(e); });
      pump();
    });
  }
  // THE PROBABILITY MODULES are the shell's (index.html loads them, goal/G27.14): window.spiritProbability.

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
  // THE SIZE OF THE PROBLEM: how many tests are red now, of all, read on opening and after each search.
  function summary() {
    if (!ctx) return;
    wire('fallout.summary', {}).then(function (r) {
      var el = document.getElementById('fallout-summary');
      if (!el) return;
      var red = Number(r && r.red) || 0;
      var all = red + (Number(r && r.green) || 0);
      el.textContent = '❌ ' + red + ' red of ' + all + ' tests now' + (all ? ' (' + Math.round(red * 100 / all) + '%)' : '') + '.';
    }, function () { /* the line stays as it was */ });
  }
  // F2: the lines that match, one per tested thing.
  // The form as it stands: the words, and THE ✅/❌ FILTER (Andy, 2026-10-17: "do i get a filter for ✅ or ❌?"): red,
  // green, or '' for both.
  function form() {
    var box = document.getElementById('fallout-text');
    var pick = document.getElementById('fallout-outcome');
    return { text: box ? String(box.value || '').trim() : '', outcome: pick ? String(pick.value == null ? 'red' : pick.value) : 'red' };
  }
  // ONE NICE LINE PER TEST (Andy, 2026-10-17: "one nice line per failure / test-file-name | failure-description |
  // success or fail | since"). The description is the sentence of what is tested, the test's sub-heading (its key
  // without the number); what the suite printed on failing is for a debugging agent, so it is not on screen.
  // ONLY THE LATEST, ONE LINE PER TESTED THING (Andy, 2026-10-17: "i only want to see the latest, if you want to
  // show the history of one test, use a dialog."). A test file and its sub-heading are one tested thing: its checks
  // fold into one line, ❌ fail while any of them is red, its newest time.
  function foldRows(rows) {
    var answer = Object.create(null);
    rows.forEach(function (x) {
      // deskVerify folds the lines itself (fold: yes, {suite, what, red, at}); plain rows are folded here alike.
      var what = x.what !== undefined ? String(x.what) : String(x.title || '').replace(/\s+#\d+$/, '');
      var k = x.suite + '\n' + what;
      var g = answer[k] || (answer[k] = { suite: x.suite, what: what, red: false, at: '' });
      if (x.outcome === 'red' || x.red === true) g.red = true;
      if (String(x.at || '') > g.at) g.at = String(x.at || '');
    });
    return answer;
  }
  // DRAWN FROM THE CACHE (Andy, 2026-10-17: "and the UI still doesn't cache every search result, and then display what
  // matches the search term among all cached rows...."): every cached line the words and the ✅/❌ filter match, and
  // the lines the last answer brought (answer), ranked by THE SAME SEARCH CODE AS THE SERVERS (Andy: "why down't the UI
  // run the exact same search code in the shell? ... it's a pattern...."): probabilityStringMatch, the very one
  // deskVerify ranks with, the lines seated in a probabilityBucket, best first; with no words, newest first. The
  // modules are the shell's (index.html); a plain word match stands in only where a page lacks them. total is what
  // the server counted for this search, 0 when only the cache was asked.
  function draw(answer, total) {
    var f = form();
    var text = f.text;
    var outcome = f.outcome;
    answer = answer || Object.create(null);
    var P = win.spiritProbability || {};
    var words = text.toLowerCase().split(/\s+/).filter(Boolean);
    var bySuite = /^[A-Za-z0-9_][A-Za-z0-9_.-]*\.js$/.test(text);
    var probability = function (g) {
      if (outcome === 'red' && !g.red) return -1;
      if (outcome === 'green' && g.red) return -1;
      if (!text) return 0;
      if (bySuite) return g.suite === text ? 1 : -1;
      var hay = g.suite + ' ' + g.what;
      if (typeof P.probabilityStringMatch === 'function') { var p = P.probabilityStringMatch(text, hay); return p > 0 ? p : -1; }
      return words.every(function (w) { return hay.toLowerCase().indexOf(w) !== -1; }) ? 0.5 : -1;
    };
    var newestFirst = Object.keys(cache).map(function (k) { return { k: k, g: cache[k] }; })
      .sort(function (a, b) { return String(b.g.at).localeCompare(String(a.g.at)); });
    var seated = newestFirst.map(function (x) { return { g: x.g, p: answer[x.k] ? Math.max(probability(x.g), 0) : probability(x.g) }; })
      .filter(function (x) { return x.p >= 0; });
    var groups;
    if (text && typeof P.createProbabilityBucket === 'function') {
      var bucket = P.createProbabilityBucket(seated.length || 1);
      seated.forEach(function (x) { bucket.seatFor(x.p, x.g); });
      groups = bucket.serialize(null, 0).items;
    } else groups = seated.map(function (x) { return x.g; });
    // THE SEARCH'S COUNT, said as such (Andy, 2026-10-17: "what I want to know is TOTAL OF ALL FAILURES. period"): the
    // size of the problem is the Now line above; this counts only what matches the search.
    var count = document.getElementById('fallout-count');
    var n = Math.max(Number(total) || 0, groups.length);
    if (count) count.textContent = n + ' ' + (outcome === 'red' ? '❌' : outcome === 'green' ? '✅' : '') + ' match this search' + (n > groups.length ? ', the ' + groups.length + ' best shown' : '');
    var el = document.getElementById('fallout-reds');
    if (!el) return;
    el.innerHTML = groups.length ? '<table class="jobs-table"><thead><tr><th>Test file</th><th>What is tested</th><th>Status</th><th>Since</th></tr></thead><tbody>' +
      groups.map(function (g) {
        // F6: the line opens its history (data-suite, data-heading).
        // NO DETAIL ON SCREEN, NOT EVEN ON HOVER (Andy, 2026-10-17: "I know you can read those details, so it doesn't
        // need to be on-screen."): the failures stay in deskVerify for the agents.
        return '<tr data-suite="' + esc(g.suite) + '" data-heading="' + esc(g.what) + '" style="cursor:pointer">' +
          '<td>' + esc(g.suite) + '</td><td>' + esc(g.what) + '</td>' +
          '<td>' + (g.red ? '❌ fail' : '✅ success') + '</td><td>' + esc(when(g.at)) + '</td></tr>';
      }).join('') + '</tbody></table>' : '<div class="job-manifest-note">No test matches' + (text ? ' "' + esc(text) + '"' : '') + '.</div>';
  }
  // THE SERVER ASKED, through the one wire slot (wire, above): a search asked while one is out folds into the latest,
  // which goes when the one out returns. Its answer joins the cache (the newest answer winning for a line), then the
  // list is drawn.
  function search() {
    if (!ctx) return;
    // A search asked outright takes the place of one the typing still owes: it asks with the latest words already.
    if (typedTimer) { clearTimeout(typedTimer); typedTimer = null; }
    var f = form();
    say('Searching the verifier.');
    wire('fallout.reds', { text: f.text, outcome: f.outcome }).then(function (r) {
      summary();
      var rows = ((r && r.items) || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return null; } }).filter(Boolean);
      var answer = foldRows(rows);
      Object.keys(answer).forEach(function (k) { cache[k] = answer[k]; });
      draw(answer, Number(r && r.total) || rows.length);
      say(r && r.more ? 'More match than one answer holds: narrow the search.' : '');
    }, function (e) { say('The verifier could not be searched: ' + ((e && e.message) || e)); });
  }
  // AS TYPED (Andy, 2026-10-17: "so why doesn't the fallout list update with each character typed or erased in the
  // search box?"): every character typed or erased redraws the list from the cache at once; once the typing pauses,
  // the server is asked too, so the cache grows with what it adds.
  var typedTimer = null;
  var TYPED_PAUSE_MS = 400;
  function typed() {
    draw(null, 0);
    if (typedTimer) clearTimeout(typedTimer);
    typedTimer = setTimeout(function () { typedTimer = null; search(); }, TYPED_PAUSE_MS);
  }

  held.fallout = {
    open: function (container, given) {
      ctx = given;
      if (typedTimer) { clearTimeout(typedTimer); typedTimer = null; }
      // Every block a leading 1em; each button 1em after itself (the desk's UI rules).
      container.innerHTML =
        '<div class="stat-tile wide" style="margin-top:1em"><div class="label">Fallout</div>' +
          '<div class="job-manifest-note">What a goal leaves red beyond its own scope. Reds searches the verifier\'s tests that are red now; ' +
          'Items will hold the work they cause.</div></div>' +
        // THE SIZE OF THE PROBLEM (Andy, 2026-10-17: "how many red in total"), whatever the search, above the tabs.
        '<div class="stat-tile wide" style="margin-top:1em"><div class="label">Now</div><div id="fallout-summary" class="job-manifest-note">Counting.</div></div>' +
        '<div id="fallout-tabs" style="margin-top:1em"></div>' +
        '<div id="fallout-pane-reds">' +
          '<div class="start-job-form card" style="margin-top:1em"><label class="field-label grow">Search the reds' +
            '<input type="search" id="fallout-text" data-field="label" placeholder="words of a test\'s name, or a suite like deskServer.js"></label>' +
            '<select id="fallout-outcome" style="margin-right:1em"><option value="red" selected>❌ red</option><option value="green">✅ green</option><option value="">both</option></select>' +
            '<button type="button" id="fallout-search" style="margin-right:1em">Search</button></div>' +
          '<div id="fallout-note" class="job-start-error" style="margin-top:1em"></div>' +
          '<div class="stat-tile wide" style="margin-top:1em"><div class="label">Search results: <span id="fallout-count"></span></div><div id="fallout-reds">' +
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
        // Each character typed or erased, and each change of the ✅/❌ filter, redraws at once (typed).
        container.addEventListener('input', function (e) { var t = e && e.target; if (t && t.id === 'fallout-text') typed(); });
        container.addEventListener('change', function (e) { var t = e && e.target; if (t && t.id === 'fallout-outcome') typed(); });
      }
      drawTabs();
      summary();
      if (typeof given.chat === 'function') given.chat(document.getElementById('fallout-chat'));
    },
  };
}());
