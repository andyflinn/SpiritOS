'use strict';
// spirit/run/spirit/grant/client/script.js
// WHAT A CLIENT KNOWS OF A NODE'S GRANTS (goal/G49.21, box v24: "spirit/grant/client/script.js (what was the grant portion of
// spirit/auth/data.js)"). Loaded by its branch's script (spirit/grant/script.js), the one file that requires it; it runs the
// translator into that page's spirit.required.spirit.data, under the node that served the rows.
// THE BRANCH IS THIS FILE'S, AND ONLY THIS FILE NAMES IT: every reader asks spirit.required.spirit.data.grant.data (below).
//   rows   key + newline + path -> the grant row, a row of node.db's grant table
// The rows come on the node's own job spirit.grant, each grant given or taken back, gone when taken back.
// Every event ends in set or del; it asks nothing.
(function family() {
  var ROWS = 'rows';
  function grantKey(key, path) { return String(key) + '\n' + String(path); }
  var D = typeof require === 'function' ? require('../../script.js').requireScript('spirit/data/script.js') : window.spirit.required.spirit.data;
  // THE DATA SET IT FILES INTO, REQUIRED BY ITSELF (goal/G47.1): on a page that has not loaded it yet, this file loads it and
  // runs again.
  if (!D) { window.spirit.requireScript('spirit/data/script.js').then(function () { if (window.spirit.required.spirit.data) family(); }); return; }
  D.makeFamily('grant', function () {
    var HOME = D.viewAt(null, 'grant');
    D.addTranslator({
      onJob: function (job) {
        var d = job && job.id === 'spirit.grant' ? job.data : null;
        if (!d || !d.row || !d.row.key || !d.row.path) return;
        var V = D.viewAt(job.fromNode || null, 'grant');
        var g = ROWS + '/' + grantKey(d.row.key, d.row.path);
        if (d.gone === true) V.del(g);
        else V.set(g, Object.assign({}, d.row));
      },
    });
    // THE READS: row(id) a row or null (a grant's id is grantKey(key, path)); rows() every row kept, id -> row; watch(fn)
    // fn(id, row) on every change, row undefined once it is gone, answers its release; branch the table's whole path, for a
    // list that is a view of it.
    return {
      row: function (id) { return id != null && id !== '' ? HOME.get(ROWS + '/' + id) || null : null; },
      rows: function () { return HOME.branch(ROWS); },
      watch: function (fn) { return HOME.watch(ROWS, function (whole, v) { if (typeof fn === 'function') fn(HOME.row(whole, ROWS), v); }); },
      get branch() { return HOME.path(ROWS); },
      grantKey: grantKey,
    };
  });
}());
