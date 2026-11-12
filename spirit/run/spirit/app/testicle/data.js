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
  // The monitor's one node: what the stream last said of busy and of the last change.
  var MONITOR = 'monitor';
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
          mon.last = { table: a.table, key: k, change: String(a.change || 'updated'), at: Date.now() };
        }
        if (Object.keys(mon).length) V.merge(MONITOR, mon);
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
    return testicleReads;
  });
}());
