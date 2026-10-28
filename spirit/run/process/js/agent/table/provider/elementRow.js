// spirit/run/process/js/agent/table/provider/elementRow.js
// ONE PROVIDER ROW IN THE PAGE (goal/G41.4): its fields to maintain and edit, Save and Delete, drawn from the server's
// answer and its stream only (rule/19). Built on the tables' shared element (../tableElement.js).
//   spirit.elements.providerRow.create(container, api, id) -> { destroy }
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  var FIELDS = [{ field: 'label', label: 'Label', kind: 'name' }, { field: 'description', label: 'Description', kind: 'description' }, { field: 'url', label: 'URL', kind: 'url' }, { field: 'apiKey', label: 'API key', kind: 'secret' }];
  E.providerRow = {
    create: function (container, api, id) {
      var made = null;
      var gone = false;
      Promise.resolve(spirit.require('process/js/agent/table/tableElement.js')).then(function () {
        if (gone) return;
        made = window.spirit.elements.agentRow.create(container, { api: api, table: 'provider', id: id, fields: FIELDS });
      });
      return { destroy: function () { gone = true; if (made) made.destroy(); } };
    },
  };
}());
