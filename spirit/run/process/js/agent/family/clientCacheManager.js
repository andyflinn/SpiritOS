// spirit/run/process/js/agent/family/clientCacheManager.js
// WHAT A CLIENT KNOWS OF THE AGENT SERVER'S TABLES, IN THE agent FAMILY'S OWN FOLDER (goal/G41.28). Andy: "We're not done
// until every family of the API tree as a clientCacheManager, and clients can use that to organize their spirit.data". A
// page loads it through spirit.cacheManager('agent'); it runs the translator into that page's spirit.data, under the
// node that served the rows.
//
// THE BRANCHES ARE THIS FILE'S, AND ONLY THIS FILE NAMES THEM: every reader (the agent tables' lists and editors) asks
// spirit.agentData (below), never a branch by name.
//   job, model, persona, provider   id -> the row, one branch per table of the agent server
// The agent server publishes each row as it changes, its job's app { agent: { table, row } }, or { agent: { table, id,
// removed } } for one gone (../table/rowTable.js), moved here from the four tables' row elements (goal/G41.16): the row is
// merged into its table's branch, so the table's list and editors, views of that branch, follow it. Another table's
// rows, another module's, or a row with no id write nothing. It asks nothing.
(function (root) {
  var TABLES = ['job', 'model', 'persona', 'provider'];
  var ATTACHED = typeof Symbol === 'function' ? Symbol.for('spirit.agent.clientCacheManager') : '__agentClientCacheManager';
  function attach(root) {
    var D = ((root || {}).spirit || {}).data;
    if (!D || typeof D.translate !== 'function') return;
    if (D[ATTACHED]) { (root.spirit = root.spirit || {}).agentData = D[ATTACHED]; return; }
    var HOME = D.at(null, 'agent');
    D.translate({
      onJob: function (job) {
        var a = job && job.module === 'process/js/agent' && job.app && job.app.agent;
        if (!a || TABLES.indexOf(a.table) === -1) return;
        var V = D.at(job.fromNode || null, 'agent');
        if (a.removed) { if (a.id) V.del(a.table + '/' + String(a.id)); return; }
        if (a.row && typeof a.row === 'object' && a.row.id) V.merge(a.table + '/' + String(a.row.id), a.row);
      },
    });
    // THE READS, ANSWERED HERE:
    //   branch(table)    a table's whole path, for a list that is a view of it (probabilitySearch's data) and for an
    //                    editor's row (branch + '/' + id); '' for a table the agent server has not
    //   row(table, id)   a row, or null
    var agentData = {
      tables: TABLES.slice(),
      branch: function (table) { return TABLES.indexOf(String(table)) === -1 ? '' : HOME.path(String(table)); },
      row: function (table, id) { return TABLES.indexOf(String(table)) !== -1 && id ? HOME.get(String(table) + '/' + id) || null : null; },
    };
    try { Object.defineProperty(D, ATTACHED, { value: agentData }); } catch (e) { D[ATTACHED] = agentData; }
    (root.spirit = root.spirit || {}).agentData = agentData;
  }
  if (typeof module !== 'undefined' && module && module.exports) module.exports = { attach: attach };
  // A page without the data set yet loads it first, as part of this file's tree.
  var sp = root.spirit;
  if (sp && !sp.data && typeof sp.require === 'function' && typeof sp.isBrowser === 'function' && sp.isBrowser()) {
    Promise.resolve(sp.require('spirit/spiritData.js')).then(function () { attach(root); }, function () { /* no data set: nothing kept */ });
  } else attach(root);
}(typeof window !== 'undefined' ? window : globalThis));
