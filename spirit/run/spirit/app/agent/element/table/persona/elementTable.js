'use strict';
// spirit/run/spirit/app/agent/element/table/persona/elementTable.js
// THE PERSONA TABLE IN THE PAGE (goal/G41.4): a persona, its rows in a search list, a row picked opening in its
// editor (./elementRow.js) in the page's detail pane. Built on the tables' shared element (../tableElement.js).
//   spirit.required.spirit.app.agent.element.table.persona.elementTable.create(container, detail) -> { refresh, destroy }   detail: the page's detail pane (../tableElement.js)
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
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = {
    create: function (container, detail) {
      var made = null;
      var gone = false;
      Promise.all([keepAnswer('spirit/app/agent/element/table/tableElement.js'), keepAnswer('spirit/app/agent/element/table/persona/elementRow.js')]).then(function () {
        if (gone) return;
        made = ANSWER['spirit/app/agent/element/table/tableElement.js'].create(container, {
          table: 'persona', detail: detail,
          row: function (box, id, added) { return ANSWER['spirit/app/agent/element/table/persona/elementRow.js'].create(box, id, added, detail); },
        });
      });
      return {
        refresh: function () { if (made) made.refresh(); },
        destroy: function () { gone = true; if (made) made.destroy(); },
      };
    },
  };
}());
