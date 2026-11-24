'use strict';
// spirit/run/spirit/app/agent/element/table/persona/elementRow.js
// ONE PERSONA ROW IN THE PAGE (goal/G41.4): its fields to maintain and edit, each saved as it changes (no Save), and Delete, drawn from the server's
// answer and its stream only (rule/19). Built on the tables' row element (../row.js).
//   spirit.required.spirit.app.agent.element.table.persona.elementRow.create(container, id, added, detail) -> { destroy }   added: just made by Add; detail: the
//   page's detail pane, whose look(table) gives the title row its icon and name
// THE INTERFACES IT CALLS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1; Andy: "EVERY FUCKING ELEMENT REQUIRES THE FUCKING
// INTERFACES IT FUCKING NEEDS"): a require made while this file runs is part of its tree, so whoever requires it waits for them.
if (window.spirit && typeof window.spirit.requireScript === 'function') ['spirit/app/agent/api.js'].forEach(function (p) { Promise.resolve(window.spirit.requireScript(p)).catch(function () {}); });
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  // Its table's rows are the agent family's cache (goal/G41.28): the family's own data.js
  // (spirit/app/agent/data.js) translates them into the table's branch; it is loaded here, with
  // this element.
  keepAnswer('spirit/app/agent/api.js');
  var FIELDS = [{ field: 'label', label: 'Label', kind: 'name' }, { field: 'persona', label: 'Persona, given with every prompt', kind: 'code' },
    // goal/G41.21, box v19: the persona's bundle, by the bundle selector as the job's (Andy: "and where the fuck is my bundle
    // field in persona-table and the fucking picker for a bundle with the persona?").
    { field: 'bundle', label: 'Bundle', kind: 'bundle' },
    // goal/G41.26: its provider by the providerSelector:dropdown, as the job detail's (Andy, box: "it's detail provides the
    // same provider-FUCKING-Selector in drop down mode, that the job detail panel provides for the agent.job.provider").
    { field: 'provider', label: 'Provider', kind: 'pick', pick: 'provider' }];
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = {
    create: function (container, id, added, detail) {
      var made = null;
      var gone = false;
      Promise.resolve(keepAnswer('spirit/app/agent/element/table/row.js')).then(function () {
        if (gone) return;
        made = ANSWER['spirit/app/agent/element/table/row.js'].create(container, {
          table: 'persona', id: id, added: added === true, look: detail && detail.look ? detail.look('persona') : null, fields: FIELDS,
          // Its mandatory fields, as its server names them (goal/G41.21: "# mandatory fields (server AND ui)").
          required: ['icon', 'label'],
        });
      });
      return { destroy: function () { gone = true; if (made) made.destroy(); } };
    },
  };
}());
