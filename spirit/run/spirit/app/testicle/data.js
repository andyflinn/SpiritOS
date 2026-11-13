'use strict';
// spirit/run/spirit/app/testicle/data.js
// WHAT A CLIENT KNOWS OF TESTICLE'S SERVER, IN THE testicle FAMILY'S OWN FOLDER (goal/G41.28, goal/G47.1). A page loads it
// through spirit.cacheManager('testicle'); it runs the translator into that page's spirit.data, under the node that served
// the rows.
//
// THE BRANCHES ARE THIS FILE'S, AND ONLY THIS FILE NAMES THEM: every reader (the suite search, testicle's face) asks
// spirit.data.testicle.data (below), never a branch by name.
//   script         name -> the script row { name, hash, deleted, changed }
//   suite          script|suite -> the suite row { key, script, suite, test, status, deleted, outcome, changed }
//   testicle       script|suite|test|flipped -> each test row the server published, the replaced one and the
//                  current one of a flipped test each under its own key (goal/G47.1, the box) { key, script, suite,
//                  test, flipped, current, verified, tested, judged, severity, scriptName, suiteName }
// goal/G47.1, the UI cycle, the box: "The UI must listen to changes on all tables it interacts with, and the server, of
// course, publishes changes." The server publishes each row it writes, its job's app { testicle: { table, row } }
// (testicle.js), as the agent's tables publish theirs: the row is merged into its table's branch, so a list that is a view
// of the branch follows it. What a search answers is kept the same way (keep).
(function () {
  var TABLES = ['script', 'suite', 'testicle'];
  // The monitor's one row, in its own branch (spirit.data keeps rows as branch/key): what the stream last said of busy and
  // of the last change.
  var MONITOR = 'monitor/now';
  // The preferences, one row of their own: what the preferences verb answered last, or the stream told since.
  var PREFERENCES = 'preferences/now';
  var D = typeof window !== 'undefined' ? window.spirit.data : require('../../spirit.js').require('spirit/data.js');
  D.makeFamily('testicle', function () {
    var HOME = D.viewAt(null, 'testicle');
    // A TEST ROW KEPT WITH ITS FILE NAMES, scriptName and suiteName, the last part of each path: the testicle search shows and
    // sorts its script and suite columns by them (goal/G47.1, the search cycle, the box: "The script column and the suite
    // column show the file name only, no path", "The list is sortable by all its columns").
    function kept(table, row) {
      if (table !== 'testicle') return row;
      var last = function (p) { var s = String(p == null ? '' : p); return s.slice(s.lastIndexOf('/') + 1); };
      return Object.assign({}, row, { scriptName: last(row.script), suiteName: last(row.suite) });
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
    function keyOf(table, row) { return table === 'script' ? String(row.name || '') : String(row.key || (row.script && row.suite ? row.script + '|' + row.suite : '')); }
    D.addTranslator({
      onJob: function (job) {
        var a = job && job.module === 'spirit.app.testicle' && job.app && job.app.testicle;
        if (!a || typeof a !== 'object') return;
        var V = D.viewAt(job.fromNode || null, 'testicle');
        // THE MONITOR (goal/G47.1, the box: the monitor row's busy "as the server streams it" and "the last change: a row
        // added, deleted or updated in any of its three tables"): busy from whatever carries it; the last change from a row.
        var mon = {};
        if (typeof a.busy === 'boolean') mon.busy = a.busy;
        var row = TABLES.indexOf(a.table) !== -1 && a.row && typeof a.row === 'object' ? a.row : null;
        var k = row ? keyOf(a.table, row) : '';
        if (k) {
          V.merge(a.table + '/' + k, kept(a.table, row));
          if (a.table === 'suite' && row.script) everySuite(V, String(row.suite || ''));
          mon.last = { table: a.table, key: k, change: String(a.change || 'updated'), at: Date.now() };
        }
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
      keep: function (table, rows) {
        if (TABLES.indexOf(String(table)) === -1) return;
        (Array.isArray(rows) ? rows : []).forEach(function (r) { var k = r && typeof r === 'object' ? keyOf(table, r) : ''; if (k) HOME.merge(table + '/' + k, kept(table, r)); });
      },
    };
    TABLES.forEach(function (t) {
      testicleReads[t] = { watch: function (fn) { return HOME.watch(t, function (whole, v) { if (typeof fn === 'function') fn(HOME.row(whole, t), v); }); } };
    });
    //   monitor.get()      { busy, last: { table, key, change, at } } as the stream last told it; {} before anything came
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
  });
}());
