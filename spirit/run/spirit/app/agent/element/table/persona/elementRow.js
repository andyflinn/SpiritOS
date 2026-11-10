'use strict';
// spirit/run/spirit/app/agent/element/table/persona/elementRow.js
// ONE PERSONA ROW IN THE PAGE (goal/G41.4): its fields to maintain and edit, each saved as it changes (no Save), and Delete, drawn from the server's
// answer and its stream only (rule/19). Built on the tables' row element (../rowElement.js).
//   spirit.element.spirit.app.agent.element.table.persona.elementRow.create(container, id, added, detail) -> { destroy }   added: just made by Add; detail: the
//   page's detail pane, whose look(table) gives the title row its icon and name
(function () {
  // Its table's rows are the agent family's cache (goal/G41.28): the family's own data.js
  // (spirit/app/agent/data.js) translates them into the table's branch; it is loaded here, with
  // this element.
  window.spirit.cacheManager('agent');
  var FIELDS = [{ field: 'label', label: 'Label', kind: 'name' }, { field: 'persona', label: 'Persona, given with every prompt', kind: 'code' },
    // goal/G41.21, box v19: the persona's bundle, by the bundle selector as the job's (Andy: "and where the fuck is my bundle
    // field in persona-table and the fucking picker for a bundle with the persona?").
    { field: 'bundle', label: 'Bundle', kind: 'bundle' },
    // goal/G41.26: its provider by the providerSelector:dropdown, as the job detail's (Andy, box: "it's detail provides the
    // same provider-FUCKING-Selector in drop down mode, that the job detail panel provides for the agent.job.provider").
    { field: 'provider', label: 'Provider', kind: 'pick', pick: 'provider' }];
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/agent/element/table/persona/elementRow.js', {
    create: function (container, id, added, detail) {
      var made = null;
      var gone = false;
      Promise.resolve(spirit.require('spirit/app/agent/element/table/rowElement.js')).then(function () {
        if (gone) return;
        made = window.spirit.element.spirit.app.agent.element.table.rowElement.create(container, {
          table: 'persona', id: id, added: added === true, look: detail && detail.look ? detail.look('persona') : null, fields: FIELDS,
          // Its mandatory fields, as its server names them (goal/G41.21: "# mandatory fields (server AND ui)").
          required: ['icon', 'label'],
        });
      });
      return { destroy: function () { gone = true; if (made) made.destroy(); } };
    },
  }); });
}());
