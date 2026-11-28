'use strict';
// spirit/run/spirit/app/testicle/data.js
// WHAT A CLIENT KNOWS OF TESTICLE'S SERVER, IN THE testicle FAMILY'S OWN FOLDER (goal/G41.28, goal/G47.1). A page loads it
// through its api.js (spirit/app/testicle/api.js), the one file that requires it; it runs the translator into that page's spirit.required.spirit.data, under the node that served
// the rows.
//
// THE BRANCHES ARE THIS FILE'S, AND ONLY THIS FILE NAMES THEM: every reader (the suite search, testicle's face) asks
// spirit.required.spirit.data['spirit.app.testicle'].data (below), never a branch by name.
//   script         name -> the script row { name, hash, deleted, changed }
//   suite          script|suite -> the suite row { key, script, suite, test, status, deleted, outcome, changed }
//   testicle       script|suite|test|id -> each test row the server published, the replaced one and the
//                  current one of a flipped test each under its own key (goal/G47.1, the box) { key, id, script, suite,
//                  test, current, verified, tested, judged, severity, scriptName, suiteName }; tested its one date, id its
//                  name (goal/G48.4: "FLIPPED IS KILLED NOW")
// goal/G47.1, the UI cycle, the box: "The UI must listen to changes on all tables it interacts with, and the server, of
// course, publishes changes." The server publishes each row it writes, its job's app { testicle: { table, row } }
// (testicle.js), as the agent's tables publish theirs: the row is merged into its table's branch, so a list that is a view
// of the branch follows it. What a search answers is kept the same way (keep).
(function family(given, out) {
  // WHAT IT PUTS OUT, ITS READS (goal/G49.23, box v22 Part 1: "they stand at <branch path>.client, where the loader puts the
  // branch's client/script.js by its path"; an old-shape data.js at <its folder>.data): the object is put out as the file runs, so
  // the loader places it, and filled with what the store made once it has come back.
  var OUT = out || {};
  if (!out && typeof module !== 'undefined' && module) module.exports = OUT;
  var TABLES = ['script', 'suite', 'testicle'];
  // The monitor's one row, in its own branch (spirit.required.spirit.data keeps rows as branch/key): what the stream last said of busy and
  // of the last change.
  var MONITOR = 'monitor/now';
  // The preferences, one row of their own: what the preferences verb answered last, or the stream told since.
  var PREFERENCES = 'preferences/now';
  var D = typeof require === 'function' ? require('../../script.js').requireScript('spirit/client/script.js') : given;
  // ON A PAGE, THE DATA SET AS spirit.requireScript HANDS IT BACK (goal/G49.23; goal/G49.9: never read at its place): this file runs
  // again with it once it has loaded.
  // THE DATA SET IT FILES INTO, REQUIRED BY ITSELF (goal/G47.1, box v182: "It is loaded by that path with spirit.requireScript,
  // data.js exactly as api.js"): on a page that has not loaded spirit/client/script.js yet, this file loads it and runs again.
  if (!D) { window.spirit.requireScript('spirit/client/script.js').then(function (got) { if (got) family(got, OUT); }); return; }
  D.handOut(OUT, D.makeFamily('spirit.app.testicle', function () {
    var HOME = D.viewAt(null, 'spirit.app.testicle');
    // A TEST ROW KEPT WITH ITS FILE NAMES, scriptName and suiteName, the last part of each path: the testicle search shows and
    // sorts its script and suite columns by them (goal/G47.1, the search cycle, the box: "The script column and the suite
    // column show the file name only, no path", "The list is sortable by all its columns").
    function kept(table, row) {
      if (table !== 'testicle') return row;
      var last = function (p) { var s = String(p == null ? '' : p); return s.slice(s.lastIndexOf('/') + 1); };
      // A SCRIPT IN ITS OWN FOLDER IS NAMED BY THE FOLDER (goal/G49.27, box v4: "the script column in testicle's search shows the
      // folder name of a <folder>/script.js"; Andy: "the script column in testicle search needs to display the foldername in
      // <folder>/script.js"): spirit/contact/hub/script.js is hub, every other script its file name, as before.
      var scriptShown = function (p) { var s = String(p == null ? '' : p); var parts = s.split('/'); return parts.length > 1 && parts[parts.length - 1] === 'script.js' ? parts[parts.length - 2] : last(s); };
      return Object.assign({}, row, { scriptName: scriptShown(row.script), suiteName: last(row.suite) });
    }
    // EVERY SUITE, EACH ONCE, KEPT FROM THE STREAM (goal/G47.1, the box: "Every element of testicle's face updates itself in
    // response to the server stream"): the rows suite.search answers with no script, keyed |suite, are made again from the
    // suite rows the branch holds each time one of that suite streams in, as the server makes them: needs running if any of
    // its rows is flagged, deleted only when all of them are. So the testicle search's suite selector, with all scripts,
    // follows the stream as a script tab does.
    function everySuite(V, suite) {
      if (!suite) return;
      var b = V.branch ? V.branch('suite') : null;
      var all = Object.keys(b || {}).map(function (key) { return b[key]; }).filter(function (r) { return r && r.script && r.suite === suite; });
      if (!all.length) return;
      var test = all.some(function (r) { return !!r.test; });
      var deleted = all.every(function (r) { return !!r.deleted; });
      var changed = Math.max.apply(null, all.map(function (r) { return Number(r.changed) || 0; }));
      // Its outcome as the server's: red if any is, green if all are (testicle.js, everySuite and statusOf).
      var outcome = all.some(function (r) { return r.outcome === 'red'; }) ? 'red' : all.every(function (r) { return r.outcome === 'green'; }) ? 'green' : '';
      var status = test ? 'needs running' : outcome === 'red' ? 'still red' : outcome === 'green' ? 'green' : 'needs running';
      V.merge('suite/|' + suite, { key: '|' + suite, script: '', suite: suite, test: test, status: status, deleted: deleted, outcome: outcome, changed: changed });
    }
    function isOwed(o) { return !!o && typeof o === 'object' && typeof o.suites === 'number' && typeof o.classifications === 'number'; }
    // { test: { suite, test, n } | null, script: { script, n } | null }, as testicle.js leadersNow makes it.
    function isLeaders(l) { return !!l && typeof l === 'object' && 'test' in l && 'script' in l; }
    function keyOf(table, row) { return table === 'script' ? String(row.name || '') : String(row.key || (row.script && row.suite ? row.script + '|' + row.suite : '')); }
    D.addTranslator({
      onJob: function (job) {
        if (!job || job.module !== 'spirit.app.testicle') return;
        var V = D.viewAt(job.fromNode || null, 'spirit.app.testicle');
        // WHAT IS OWED, ON CONNECT (goal/G47.4, box v55: "a page that connects to testicle's stream is sent the current
        // suites-owed and classifications-owed numbers once"): the server keeps the last in its job's data, which the
        // snapshot a page connects with carries; after that the owed message of its own moves them.
        if (job.data && isOwed(job.data.owed)) V.merge(MONITOR, { owed: { suites: job.data.owed.suites, classifications: job.data.owed.classifications } });
        // THE NUMBER OF REDS (goal/G48.4), kept and sent as owed is: on connect from the job's data, then with owed's message.
        if (job.data && typeof job.data.reds === 'number') V.merge(MONITOR, { reds: job.data.reds });
        // ITS TWO LEADERS (goal/G48.4), the test and the script with the most reds, kept as reds is.
        if (job.data && isLeaders(job.data.leaders)) V.merge(MONITOR, { leaders: job.data.leaders });
        var a = job.app && job.app.testicle;
        if (!a || typeof a !== 'object') return;
        // THE MONITOR (goal/G47.1, the box: the monitor row's busy "as the server streams it" and "the last change: a row
        // added, deleted or updated in any of its three tables"): busy from whatever carries it; the last change from a row.
        var mon = {};
        if (typeof a.busy === 'boolean') mon.busy = a.busy;
        // What runs, as JSON (goal/G47.4, the box, ### status bar): {suite, scripts, started, tested, script} or, while the
        // classifier runs, {classifier, total, classified, script}; '' when no run is active.
        if (typeof a.running === 'string') mon.running = a.running;
        // What is owed, a message of its own sent when a number moves: { owed: { suites, classifications } }.
        if (isOwed(a.owed)) mon.owed = { suites: a.owed.suites, classifications: a.owed.classifications };
        if (typeof a.reds === 'number') mon.reds = a.reds;
        if (isLeaders(a.leaders)) mon.leaders = a.leaders;
        var row = TABLES.indexOf(a.table) !== -1 && a.row && typeof a.row === 'object' ? a.row : null;
        var k = row ? keyOf(a.table, row) : '';
        // A TEST ROW ERASED (goal/G47.4: a title a completed run did not report) leaves the mirror.
        if (k && a.table === 'testicle' && a.change === 'deleted') V.del(a.table + '/' + k);
        else if (k) {
          V.merge(a.table + '/' + k, kept(a.table, row));
          if (a.table === 'suite' && row.script) everySuite(V, String(row.suite || ''));
        }
        if (k) mon.last = { table: a.table, key: k, change: String(a.change || 'updated'), at: Date.now() };
        if (Object.keys(mon).length) V.merge(MONITOR, mon);
        // THE PREFERENCES (goal/G47.1, box v79, 4): "a set is published to testicle's subscribers, so the ⚙ panel and any
        // other page follow it".
        if (a.preferences && typeof a.preferences === 'object' && !Array.isArray(a.preferences)) V.merge(PREFERENCES, a.preferences);
      },
    });
    // THE READS AND THE WRITES:
    //   branch(table)      a table's whole path, for a list that is a view of it (probabilitySearch's data); '' for none
    //   keep(table, rows)  rows a verb answered (suite.search's items, parsed), merged into that table's branch
    //   suite.watch(fn), script.watch(fn)   fn(key, row) on every change of the table; answers its release. A branch's
    //                      watch is watch (goal/G43.32).
    var testicleReads = {
      tables: TABLES.slice(),
      branch: function (table) { return TABLES.indexOf(String(table)) === -1 ? '' : HOME.path(String(table)); },
      // A table's rows as kept, key -> row (goal/G49.23: read from the client, never from the store by a path).
      rows: function (table) { return TABLES.indexOf(String(table)) === -1 ? {} : HOME.branch(String(table)); },
      keep: function (table, rows) {
        if (TABLES.indexOf(String(table)) === -1) return;
        (Array.isArray(rows) ? rows : []).forEach(function (r) { var k = r && typeof r === 'object' ? keyOf(table, r) : ''; if (k) HOME.merge(table + '/' + k, kept(table, r)); });
      },
    };
    TABLES.forEach(function (t) {
      testicleReads[t] = { watch: function (fn) { return HOME.watch(t, function (whole, v) { if (typeof fn === 'function') fn(HOME.row(whole, t), v); }); } };
    });
    //   monitor.get()      { busy, running, owed: { suites, classifications }, reds, leaders: { test, script }, last: { table, key, change, at } } as the stream last
    //                      told it; {} before anything came
    //   monitor.watch(fn)  fn(monitor) on every change; answers its release
    testicleReads.monitor = {
      get: function () { return HOME.get(MONITOR) || {}; },
      watch: function (fn) { return HOME.watch(MONITOR, function () { if (typeof fn === 'function') fn(HOME.get(MONITOR) || {}); }); },
    };
    //   preferences.get()      { interactive } as last answered or streamed; {} before anything came
    //   preferences.keep(p)    what the preferences verb answered, kept
    //   preferences.watch(fn)  fn(preferences) on every change; answers its release
    testicleReads.preferences = {
      get: function () { return HOME.get(PREFERENCES) || {}; },
      keep: function (p) { if (p && typeof p === 'object' && !Array.isArray(p)) HOME.merge(PREFERENCES, p); },
      watch: function (fn) { return HOME.watch(PREFERENCES, function () { if (typeof fn === 'function') fn(HOME.get(PREFERENCES) || {}); }); },
    };
    return testicleReads;
  }));
}());
