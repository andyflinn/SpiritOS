// spirit/run/process/js/agent/table/data.js
// THE AGENT TABLES' TRANSLATOR (goal/G41.4): what the agent server's stream means for spirit.data (shell/js/spiritData.js),
// the way shell/js/contacts/data.js and shell/shared/js/deskData.js say it for theirs. Andy, on G41.4: "make sure that
// all element LISTEN to what needs listening to, by themselves, automatically. This should also be a general
// implementation. if those table searches and list were make properly from a probability framework, this should not
// have happened". So nothing in a table's page listens by hand: each table is a branch, agent.<table>, and its list and
// its editors are views of it (../tableElement.js); a search's answer is seated in the same branch (probabilitySearch
// with data), and the stream keeps it current.
//
//   agent.<table>/<id>          a provider, model, persona or job row, as the server shows it (no secret)
//   agent.grant/<job_id>|<path> a grant, { job_id, job, path }, keyed as the grant search keys it
//
// The rows come as the jobs of module process/js/agent, { agent: { table, row } } for a row added or changed and
// { agent: { table, id, removed } } (a grant's: { table: 'grant', row, removed }) for one gone (rowTable.js,
// grant/server.js). Every event ends in set or del; it asks nothing and keeps nothing of its own.
(function (root) {
  var D = (root.spirit || {}).data;
  if (!D || typeof D.translate !== 'function') return;
  function branchOf(table) { return 'agent.' + table; }
  function keyOf(table, row) { return table === 'grant' ? String(row.job_id) + '|' + String(row.path) : String(row.id || ''); }
  function published(a) {
    if (!a || typeof a !== 'object' || typeof a.table !== 'string' || !a.table) return;
    var b = branchOf(a.table);
    if (a.removed) {
      var gone = a.row ? keyOf(a.table, a.row) : String(a.id || '');
      if (gone) D.del(b + '/' + gone);
      return;
    }
    if (!a.row || typeof a.row !== 'object') return;
    var key = keyOf(a.table, a.row);
    if (!key || key === '|') return;
    // A grant's row from the stream lacks its job's label; the label a search seated stays.
    D.merge(b + '/' + key, a.row);
  }
  D.translate({
    onJob: function (job) {
      if (job && job.module === 'process/js/agent' && job.app && typeof job.app === 'object') published(job.app.agent);
    },
  });
  (root.spirit = root.spirit || {}).agentData = { branchOf: branchOf, keyOf: keyOf, published: published };
}(typeof window !== 'undefined' ? window : globalThis));
