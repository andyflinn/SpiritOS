// spirit/run/process/js/agent/table/job/elementRow.js
// ONE JOB ROW IN THE PAGE (goal/G41.4): its fields to maintain and edit, Save and Delete, drawn from the server's
// answer and its stream only (rule/19). Built on the tables' shared element (../tableElement.js).
//   spirit.elements.jobRow.create(container, api, id) -> { destroy }
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  var FIELDS = [{ field: 'label', label: 'Label', kind: 'name' }, { field: 'description', label: 'Description', kind: 'description' }, { field: 'loop', label: 'Loop (the agent app runs it again)', kind: 'bool' }, { field: 'job', label: 'Job, which may come with a prompt', kind: 'code' }];
  E.jobRow = {
    create: function (container, api, id) {
      var made = null;
      var gone = false;
      Promise.resolve(spirit.require('process/js/agent/table/tableElement.js')).then(function () {
        if (gone) return;
        made = window.spirit.elements.agentRow.create(container, { api: api, table: 'job', id: id, fields: FIELDS });
      });
      return { destroy: function () { gone = true; if (made) made.destroy(); } };
    },
  };
}());
