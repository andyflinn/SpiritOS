// spirit/run/process/js/agent/table/model/elementTable.js
// THE MODEL TABLE IN THE PAGE (goal/G41.4): a model of a provider, its rows in a search list, a row picked opening in its
// editor (./elementRow.js) in the page's detail pane. Built on the tables' shared element (../tableElement.js).
//   spirit.elements.modelTable.create(container, api, detail) -> { refresh, destroy }   detail: the page's detail pane (../tableElement.js)
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  E.modelTable = {
    create: function (container, api, detail) {
      var made = null;
      var gone = false;
      Promise.all([spirit.require('process/js/agent/table/tableElement.js'), spirit.require('process/js/agent/table/model/elementRow.js')]).then(function () {
        if (gone) return;
        E = window.spirit.elements;
        made = E.agentTable.create(container, {
          api: api, table: 'model', detail: detail,
          row: function (box, id, added) { return E.modelRow.create(box, api, id, added, detail); },
          // goal/G41.18, box v17: the list shows "[icon] \"model-name\"", the provider's icon the server sends with the
          // row; and the button row holds "provider models", opening the Update model list pane in the centre.
          columns: [{ field: 'icon', from: 'providerIcon', label: '' }, { field: 'label', from: 'modelName', label: 'Model', sort: 'text' }],
          buttons: [{ label: 'provider models', press: function () {
            if (!detail) return;
            detail.open(function (box) {
              var pane = null;
              var closed = false;
              Promise.resolve(spirit.require('process/js/agent/table/model/updatePanel.js')).then(function () {
                if (!closed) pane = window.spirit.elements.modelUpdate.create(box, api, detail);
              });
              return { destroy: function () { closed = true; if (pane) pane.destroy(); } };
            });
          } }],
        });
      });
      return {
        refresh: function () { if (made) made.refresh(); },
        destroy: function () { gone = true; if (made) made.destroy(); },
      };
    },
  };
}());
