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
//                  test, flipped, current, verified, tested, judged, severity }
// goal/G47.1, the UI cycle, the box: "The UI must listen to changes on all tables it interacts with, and the server, of
// course, publishes changes." The server publishes each row it writes, its job's app { testicle: { table, row } }
// (testicle.js), as the agent's tables publish theirs: the row is merged into its table's branch, so a list that is a view
// of the branch follows it. What a search answers is kept the same way (keep).
(function () {
  var TABLES = ['script', 'suite', 'testicle'];
  var D = typeof window !== 'undefined' ? window.spirit.data : require('../../spirit.js').require('spirit/data.js');
  D.makeFamily('testicle', function () {
    var HOME = D.viewAt(null, 'testicle');
    function keyOf(table, row) { return table === 'script' ? String(row.name || '') : String(row.key || (row.script && row.suite ? row.script + '|' + row.suite : '')); }
    D.addTranslator({
      onJob: function (job) {
        var a = job && job.module === 'spirit.app.testicle' && job.app && job.app.testicle;
        if (!a || TABLES.indexOf(a.table) === -1 || !a.row || typeof a.row !== 'object') return;
        var k = keyOf(a.table, a.row);
        if (k) D.viewAt(job.fromNode || null, 'testicle').merge(a.table + '/' + k, a.row);
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
        (Array.isArray(rows) ? rows : []).forEach(function (r) { var k = r && typeof r === 'object' ? keyOf(table, r) : ''; if (k) HOME.merge(table + '/' + k, r); });
      },
    };
    TABLES.forEach(function (t) {
      testicleReads[t] = { watch: function (fn) { return HOME.watch(t, function (whole, v) { if (typeof fn === 'function') fn(HOME.row(whole, t), v); }); } };
    });
    return testicleReads;
  });
}());
