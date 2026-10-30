// spirit/run/process/js/agent/table/provider/elementRow.js
// ONE PROVIDER ROW IN THE PAGE (goal/G41.4): its fields to maintain and edit, Save and Delete, drawn from the server's
// answer and its stream only (rule/19). Built on the tables' shared element (../tableElement.js).
//   spirit.elements.providerRow.create(container, api, id, added, detail) -> { destroy }   added: just made by Add; detail: the
//   page's detail pane, whose look(table) gives the title row its icon and name
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  // THE PROVIDER TABLE ON THE STREAM, IN ITS OWN ELEMENT (goal/G41.16; G30.18; Andy: "get rid of thos FUCKING data.js
  // scripts"): the agent server publishes each row as it changes, its job's app { agent: { table, row } }, or
  // { agent: { table, id, removed } } for one gone (../rowTable.js). This file puts the provider table's into
  // agent.provider/<id> of spirit.data, merged, so the table's list and editors, views of that branch, follow it. Another
  // table's rows, another module's, or a row with no id write nothing. The data set it writes to, it loads itself
  // (rule/26).
  var dataSet = window.spirit.data ? Promise.resolve(window.spirit.data)
    : Promise.resolve(window.spirit.require ? window.spirit.require('shell/shared/js/spiritData.js') : null).then(function () { return window.spirit.data; });
  dataSet.then(function (D) {
    if (!D || typeof D.translate !== 'function') return;
    D.translate({
      onJob: function (job) {
        var a = job && job.module === 'process/js/agent' && job.app && job.app.agent;
        if (!a || a.table !== 'provider') return;
        if (a.removed) { if (a.id) D.del('agent.provider/' + String(a.id)); return; }
        if (a.row && typeof a.row === 'object' && a.row.id) D.merge('agent.provider/' + String(a.row.id), a.row);
      },
    });
  }, function () { /* no data set: the lists still search */ });
  var FIELDS = [{ field: 'label', label: 'Label', kind: 'name' }, { field: 'url', label: 'URL', kind: 'url' }, { field: 'apiKey', label: 'API key', kind: 'secret' },
    // goal/G41.21, box v17: "a Model field at the bottom. It is a pick field ... showing only the models whose provider is
    // this provider": of names the model table's field that holds this provider's id; hidden while it holds none.
    { field: 'model', label: 'Model', kind: 'pick', pick: 'model', of: 'providerId' }];
  E.providerRow = {
    create: function (container, api, id, added, detail) {
      var made = null;
      var gone = false;
      Promise.resolve(spirit.require('process/js/agent/table/tableElement.js')).then(function () {
        if (gone) return;
        made = window.spirit.elements.agentRow.create(container, {
          api: api, table: 'provider', id: id, added: added === true, look: detail && detail.look ? detail.look('provider') : null, fields: FIELDS,
          // Its mandatory fields, as its server names them (goal/G41.21: "# mandatory fields (server AND ui)").
          required: ['icon', 'label', 'url'],
        });
      });
      return { destroy: function () { gone = true; if (made) made.destroy(); } };
    },
  };
}());
