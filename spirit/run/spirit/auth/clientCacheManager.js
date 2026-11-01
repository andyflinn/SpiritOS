// spirit/run/spirit/auth/clientCacheManager.js
// WHAT A CLIENT KNOWS OF A NODE'S BUNDLES, BRANCHES AND GRANTS, IN THE auth FAMILY'S OWN FOLDER (goal/G41.28). Andy:
// "We're not done until every family of the API tree as a clientCacheManager, and clients can use that to organize their
// spirit.data". A page loads it through spirit.cacheManager('auth'); it runs the translator into that page's spirit.data,
// under the node that served the rows.
//
// THE BRANCHES ARE THIS FILE'S, AND ONLY THIS FILE NAMES THEM: every reader (the bundle, branch and grant rows and lists,
// the branch editor, the Grants app) asks spirit.authData (below), never a branch by name.
//   bundles    id -> { id, label, owner }, a row of node.db's bundle table
//   branches   id -> { id, bundle, family, verb }, a row of its branch table
//   grants     key + newline + path -> the grant row, a row of its grant table
// The rows come on the node's permanent job 'bundles' (spirit/server.js), each changed row of the three tables with its
// table's name, gone when it is removed (goal/G41.14; moved here from the three row elements). Every event ends in set
// or del; it asks nothing.
(function (root) {
  var BUNDLES = 'bundles';
  var BRANCHES = 'branches';
  var GRANTS = 'grants';
  var ATTACHED = typeof Symbol === 'function' ? Symbol.for('spirit.auth.clientCacheManager') : '__authClientCacheManager';
  function grantKey(key, path) { return String(key) + '\n' + String(path); }
  function attach(root) {
    var D = ((root || {}).spirit || {}).data;
    if (!D || typeof D.translate !== 'function') return;
    if (D[ATTACHED]) { (root.spirit = root.spirit || {}).authData = D[ATTACHED]; return; }
    var HOME = D.at(null, 'auth');
    D.translate({
      onJob: function (job) {
        var d = job && job.type === 'bundles' ? job.data : null;
        if (!d || !d.row) return;
        var V = D.at(job.fromNode || null, 'auth');
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
    var authData = { bundles: table(BUNDLES), branches: table(BRANCHES), grants: table(GRANTS), grantKey: grantKey };
    try { Object.defineProperty(D, ATTACHED, { value: authData }); } catch (e) { D[ATTACHED] = authData; }
    (root.spirit = root.spirit || {}).authData = authData;
  }
  if (typeof module !== 'undefined' && module && module.exports) module.exports = { attach: attach };
  // A page without the data set yet loads it first, as part of this file's tree.
  var sp = root.spirit;
  if (sp && !sp.data && typeof sp.require === 'function' && typeof sp.isBrowser === 'function' && sp.isBrowser()) {
    Promise.resolve(sp.require('spirit/spiritData.js')).then(function () { attach(root); }, function () { /* no data set: nothing kept */ });
  } else attach(root);
}(typeof window !== 'undefined' ? window : globalThis));
