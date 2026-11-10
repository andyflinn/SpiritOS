'use strict';
// spirit/run/spirit/auth/data.js
// WHAT A CLIENT KNOWS OF A NODE'S BUNDLES, BRANCHES AND GRANTS, IN THE auth FAMILY'S OWN FOLDER (goal/G41.28). Andy:
// "We're not done until every family of the API tree as a clientCacheManager, and clients can use that to organize their
// spirit.data". A page loads it through spirit.cacheManager('auth'); it runs the translator into that page's spirit.data,
// under the node that served the rows.
//
// THE BRANCHES ARE THIS FILE'S, AND ONLY THIS FILE NAMES THEM: every reader (the bundle, branch and grant rows and lists,
// the branch editor, the Grants app) asks spirit.data.auth.data (below), never a branch by name.
//   bundles    id -> { id, label, owner }, a row of node.db's bundle table
//   branches   id -> { id, bundle, family, verb }, a row of its branch table
//   grants     key + newline + path -> the grant row, a row of its grant table
// The rows come on the node's own job spirit.auth (spirit/server.js, goal/G43.20), each changed row of the three tables with its
// table's name, gone when it is removed (goal/G41.14; moved here from the three row elements). Every event ends in set
// or del; it asks nothing.
(function () {
  var BUNDLES = 'bundles';
  var BRANCHES = 'branches';
  var GRANTS = 'grants';
  function grantKey(key, path) { return String(key) + '\n' + String(path); }
  var D = typeof window !== 'undefined' ? window.spirit.data : require('../spirit.js').require('spirit/data.js');
  D.makeFamily('auth', function () {
    var HOME = D.viewAt(null, 'auth');
    D.addTranslator({
      onJob: function (job) {
        // THE AUTH TABLES' ROWS, news of spirit.auth (goal/G43.20): { table, row, gone }.
        var d = job && job.id === 'spirit.auth' ? job.data : null;
        if (!d || !d.row) return;
        var V = D.viewAt(job.fromNode || null, 'auth');
        var r = d.row;
        if (d.table === 'bundle' && r.id != null) {
          var b = BUNDLES + '/' + Number(r.id);
          if (d.gone === true) V.del(b);
          // The owner as the node said it (it always says one, goal/G41.25); a row that names none keeps none.
          else V.set(b, r.owner === undefined ? { id: Number(r.id), label: String(r.label || '') } : { id: Number(r.id), label: String(r.label || ''), owner: String(r.owner) });
        } else if (d.table === 'branch' && r.id != null) {
          var p = BRANCHES + '/' + Number(r.id);
          if (d.gone === true) V.del(p);
          else V.set(p, { id: Number(r.id), bundle: Number(r.bundle), family: String(r.family || ''), verb: String(r.verb || '') });
        } else if (d.table === 'grant' && r.key && r.path) {
          var g = GRANTS + '/' + grantKey(r.key, r.path);
          if (d.gone === true) V.del(g);
          else V.set(g, Object.assign({}, r));
        }
      },
    });
    // THE READS, ANSWERED HERE, one reader per table: bundles, branches, grants, each
    //   row(id)      a row, or null (a grant's id is grantKey(key, path))
    //   rows()       every row kept, id -> row
    //   watch(fn)    fn(id, row) on every change, row undefined once it is gone; answers its release
    //   branch       the table's whole path, for a list that is a view of it (probabilitySearch's data)
    function table(name) {
      return {
        row: function (id) { return id != null && id !== '' ? HOME.get(name + '/' + id) || null : null; },
        rows: function () { return HOME.branch(name); },
        watch: function (fn) { return HOME.watch(name, function (whole, v) { if (typeof fn === 'function') fn(HOME.row(whole, name), v); }); },
        get branch() { return HOME.path(name); },
      };
    }
    var authReads = { bundles: table(BUNDLES), branches: table(BRANCHES), grants: table(GRANTS), grantKey: grantKey };
    return authReads;
  });
}());
