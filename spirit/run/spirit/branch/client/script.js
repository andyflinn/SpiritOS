'use strict';
// spirit/run/spirit/branch/client/script.js
// WHAT A CLIENT KNOWS OF WHAT A NODE'S BUNDLES HOLD (goal/G49.21, box v24: "spirit/branch/client/script.js (what was the branch
// portion of spirit/auth/data.js)"). Loaded by its branch's script (spirit/branch/script.js), the one file that requires it.
// THE BRANCH IS THIS FILE'S, AND ONLY THIS FILE NAMES IT: every reader asks spirit.required.spirit.data.branch.data (below).
//   rows   id -> { id, bundle, family, verb }, a row of node.db's branch table
// The rows come on the node's own job spirit.branch, each changed row, gone when deleted. Every event ends in set or del.
(function family(given) {
  var ROWS = 'rows';
  var D = typeof require === 'function' ? require('../../script.js').requireScript('spirit/data/script.js') : given;
  // ON A PAGE, THE DATA SET AS spirit.requireScript HANDS IT BACK (goal/G49.23; goal/G49.9: never read at its place): this file runs
  // again with it once it has loaded.
  if (!D) { window.spirit.requireScript('spirit/data/script.js').then(function (got) { if (got) family(got); }); return; }
  D.makeFamily('branch', function () {
    var HOME = D.viewAt(null, 'branch');
    D.addTranslator({
      onJob: function (job) {
        var d = job && job.id === 'spirit.branch' ? job.data : null;
        if (!d || !d.row || d.row.id == null) return;
        var V = D.viewAt(job.fromNode || null, 'branch');
        var r = d.row;
        var p = ROWS + '/' + Number(r.id);
        if (d.gone === true) V.del(p);
        else V.set(p, { id: Number(r.id), bundle: Number(r.bundle), family: String(r.family || ''), verb: String(r.verb || '') });
      },
    });
    // THE READS: row(id), rows(), watch(fn), branch, as every table's client answers them.
    return {
      row: function (id) { return id != null && id !== '' ? HOME.get(ROWS + '/' + id) || null : null; },
      rows: function () { return HOME.branch(ROWS); },
      watch: function (fn) { return HOME.watch(ROWS, function (whole, v) { if (typeof fn === 'function') fn(HOME.row(whole, ROWS), v); }); },
      get branch() { return HOME.path(ROWS); },
    };
  });
}());
