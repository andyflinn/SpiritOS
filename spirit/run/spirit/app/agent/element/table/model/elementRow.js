'use strict';
// spirit/run/spirit/app/agent/element/table/model/elementRow.js
// ONE MODEL ROW IN THE PAGE (goal/G41.4): its fields to maintain and edit, each saved as it changes (no Save), and Delete, drawn from the server's
// answer and its stream only (rule/19). Built on the tables' row element (../rowElement.js).
//   spirit.element.spirit.app.agent.element.table.model.elementRow.create(container, id, added, detail) -> { destroy }   added: just made by Add; detail: the
//   page's detail pane, whose look(table) gives the title row its icon and name
(function () {
  // Its table's rows are the agent family's cache (goal/G41.28): the family's own data.js
  // (spirit/app/agent/data.js) translates them into the table's branch; it is loaded here, with
  // this element.
  window.spirit.cacheManager('agent');
  // goal/G41.21: every field shown only. The label is the model name as the provider gives it (Andy: "the label hold the
  // model name as provided by the provider, and is output only in the models UI"); the capabilities ("model details,
  // capabilites, is output only").
  var FIELDS = [{ field: 'label', label: 'Model', kind: 'output' }, { field: 'providerId', label: 'Provider', kind: 'output', pick: 'provider' }, { field: 'capabilities', label: 'Capabilities', kind: 'output' }];
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/agent/element/table/model/elementRow.js', {
    create: function (container, id, added, detail) {
      var made = null;
      var gone = false;
      Promise.resolve(spirit.require('spirit/app/agent/element/table/rowElement.js')).then(function () {
        if (gone) return;
        made = window.spirit.element.spirit.app.agent.element.table.rowElement.create(container, {
          table: 'model', id: id, added: added === true, look: detail && detail.look ? detail.look('model') : null, fields: FIELDS,
        });
      });
      return { destroy: function () { gone = true; if (made) made.destroy(); } };
    },
  }); });
}());
