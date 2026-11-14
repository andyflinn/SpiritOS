'use strict';
// spirit/run/spirit/app/agent/element/table/job/elementRow.js
// ONE JOB ROW IN THE PAGE (goal/G41.4): its fields to maintain and edit, each saved as it changes (no Save), and Delete, drawn from the server's
// answer and its stream only (rule/19). Built on the tables' row element (../rowElement.js).
//   spirit.element.spirit.app.agent.element.table.job.elementRow.create(container, id, added, detail) -> { destroy }   added: just made by Add; detail: the
//   page's detail pane, whose look(table) gives the title row its icon and name
// THE INTERFACES IT CALLS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1; Andy: "EVERY FUCKING ELEMENT REQUIRES THE FUCKING
// INTERFACES IT FUCKING NEEDS"): a require made while this file runs is part of its tree, so whoever requires it waits for them.
if (window.spirit && typeof window.spirit.require === 'function') ['spirit/app/agent/api.js'].forEach(function (p) { Promise.resolve(window.spirit.require(p)).catch(function () {}); });
(function () {
  // Its table's rows are the agent family's cache (goal/G41.28): the family's own data.js
  // (spirit/app/agent/data.js) translates them into the table's branch; it is loaded here, with
  // this element.
  window.spirit.cacheManager('agent');
  var FIELDS = [{ field: 'label', label: 'Label', kind: 'name' }, { field: 'loop', label: 'Loop (the agent app runs it again)', kind: 'bool' }, { field: 'job', label: 'Job, which may come with a prompt', kind: 'code' },
    // goal/G41.21, box v17: the bundle "with a bundleSelector in dropdown mode" (kind bundle), "That bundle is the job's
    // grant"; the provider and the persona each by a pick field of its table.
    { field: 'bundle', label: 'Bundle (its grant)', kind: 'bundle' }, { field: 'provider', label: 'Provider', kind: 'pick', pick: 'provider' },
    { field: 'persona', label: 'Persona', kind: 'pick', pick: 'persona' }];
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/agent/element/table/job/elementRow.js', {
    create: function (container, id, added, detail) {
      var made = null;
      var gone = false;
      Promise.resolve(spirit.require('spirit/app/agent/element/table/rowElement.js')).then(function () {
        if (gone) return;
        made = window.spirit.element.spirit.app.agent.element.table.rowElement.create(container, {
          table: 'job', id: id, added: added === true, look: detail && detail.look ? detail.look('job') : null, fields: FIELDS,
          // Its mandatory fields, as its server names them (goal/G41.21: "# mandatory fields (server AND ui)").
          required: ['icon', 'label'],
        });
      });
      return { destroy: function () { gone = true; if (made) made.destroy(); } };
    },
  }); });
}());
