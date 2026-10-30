// spirit/run/process/js/agent/table/model/elementRow.js
// ONE MODEL ROW IN THE PAGE (goal/G41.4): its fields to maintain and edit, Save and Delete, drawn from the server's
// answer and its stream only (rule/19). Built on the tables' shared element (../tableElement.js).
//   spirit.elements.modelRow.create(container, api, id, added, detail) -> { destroy }   added: just made by Add; detail: the
//   page's detail pane, whose look(table) gives the title row its icon and name
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  // THE MODEL TABLE ON THE STREAM, IN ITS OWN ELEMENT (goal/G41.16; G30.18; Andy: "get rid of thos FUCKING data.js
  // scripts"): the agent server publishes each row as it changes, its job's app { agent: { table, row } }, or
  // { agent: { table, id, removed } } for one gone (../rowTable.js). This file puts the model table's into
  // agent.model/<id> of spirit.data, merged, so the table's list and editors, views of that branch, follow it. Another
  // table's rows, another module's, or a row with no id write nothing. The data set it writes to, it loads itself
  // (rule/26).
  var dataSet = window.spirit.data ? Promise.resolve(window.spirit.data)
    : Promise.resolve(window.spirit.require ? window.spirit.require('shell/shared/js/spiritData.js') : null).then(function () { return window.spirit.data; });
  dataSet.then(function (D) {
    if (!D || typeof D.translate !== 'function') return;
    D.translate({
      onJob: function (job) {
        var a = job && job.module === 'process/js/agent' && job.app && job.app.agent;
        if (!a || a.table !== 'model') return;
        if (a.removed) { if (a.id) D.del('agent.model/' + String(a.id)); return; }
        if (a.row && typeof a.row === 'object' && a.row.id) D.merge('agent.model/' + String(a.row.id), a.row);
      },
    });
  }, function () { /* no data set: the lists still search */ });
  // goal/G41.21: every field shown only. The label is the model name as the provider gives it (Andy: "the label hold the
  // model name as provided by the provider, and is output only in the models UI"); the capabilities ("model details,
  // capabilites, is output only").
  var FIELDS = [{ field: 'label', label: 'Model', kind: 'output' }, { field: 'providerId', label: 'Provider', kind: 'output', pick: 'provider' }, { field: 'capabilities', label: 'Capabilities', kind: 'output' }];
  E.modelRow = {
    create: function (container, api, id, added, detail) {
      var made = null;
      var gone = false;
      Promise.resolve(spirit.require('process/js/agent/table/tableElement.js')).then(function () {
        if (gone) return;
        made = window.spirit.elements.agentRow.create(container, {
          api: api, table: 'model', id: id, added: added === true, look: detail && detail.look ? detail.look('model') : null, fields: FIELDS,
        });
      });
      return { destroy: function () { gone = true; if (made) made.destroy(); } };
    },
  };
}());
