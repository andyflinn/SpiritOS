// spirit/run/process/js/agent/table/persona/elementTable.js
// THE PERSONA TABLE IN THE PAGE (goal/G41.4): a persona, its rows in a search list, a row picked opening in its
// editor (./elementRow.js) in the page's detail pane. Built on the tables' shared element (../tableElement.js).
//   spirit.elements.personaTable.create(container, api, detail) -> { refresh, destroy }   detail: the page's detail pane (../tableElement.js)
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  var COLUMNS = [{ field: 'label', label: 'Label', sort: 'text' }, { field: 'description', label: 'Description', sort: 'text' }];
  E.personaTable = {
    create: function (container, api, detail) {
      var made = null;
      var gone = false;
      Promise.all([spirit.require('process/js/agent/table/tableElement.js'), spirit.require('process/js/agent/table/persona/elementRow.js')]).then(function () {
        if (gone) return;
        E = window.spirit.elements;
        made = E.agentTable.create(container, {
          api: api, table: 'persona', columns: COLUMNS, detail: detail,
          row: function (box, id) { return E.personaRow.create(box, api, id); },
        });
      });
      return {
        refresh: function () { if (made) made.refresh(); },
        destroy: function () { gone = true; if (made) made.destroy(); },
      };
    },
  };
}());
