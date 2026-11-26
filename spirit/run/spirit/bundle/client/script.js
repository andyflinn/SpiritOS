'use strict';
// spirit/run/spirit/bundle/client/script.js
// WHAT A CLIENT KNOWS OF A NODE'S BUNDLES (goal/G49.21, box v24: "spirit/bundle/client/script.js (what was the bundle portion of
// spirit/auth/data.js)"). Loaded by its branch's script (spirit/bundle/script.js), the one file that requires it.
// THE BRANCH IS THIS FILE'S, AND ONLY THIS FILE NAMES IT: every reader asks spirit.required.spirit.data.bundle.data (below).
//   rows   id -> { id, label, owner }, a row of node.db's bundle table
// The rows come on the node's own job spirit.bundle, each changed row, gone when deleted. Every event ends in set or del.
(function family() {
  var ROWS = 'rows';
  var D = typeof require === 'function' ? require('../../script.js').requireScript('spirit/data/script.js') : window.spirit.required.spirit.data;
  if (!D) { window.spirit.requireScript('spirit/data/script.js').then(function () { if (window.spirit.required.spirit.data) family(); }); return; }
  D.makeFamily('bundle', function () {
    var HOME = D.viewAt(null, 'bundle');
    D.addTranslator({
      onJob: function (job) {
        var d = job && job.id === 'spirit.bundle' ? job.data : null;
        if (!d || !d.row || d.row.id == null) return;
        var V = D.viewAt(job.fromNode || null, 'bundle');
        var r = d.row;
        var b = ROWS + '/' + Number(r.id);
        if (d.gone === true) V.del(b);
        // The owner as the node said it (it always says one, goal/G41.25); a row that names none keeps none.
        else V.set(b, r.owner === undefined ? { id: Number(r.id), label: String(r.label || '') } : { id: Number(r.id), label: String(r.label || ''), owner: String(r.owner) });
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
