'use strict';
// spirit/run/spirit/app/agent/table/job/elementTable.js
// THE JOB TABLE IN THE PAGE (goal/G41.4): a job, its rows in a search list, a row picked opening in its
// editor (./elementRow.js) in the page's detail pane. Built on the tables' shared element (../tableElement.js).
//   spirit.elements.jobTable.create(container, detail) -> { refresh, destroy }   detail: the page's detail pane (../tableElement.js)
(function () {
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/agent/table/job/elementTable.js', {
    create: function (container, detail) {
      var made = null;
      var gone = false;
      Promise.all([spirit.require('spirit/app/agent/table/tableElement.js'), spirit.require('spirit/app/agent/table/job/elementRow.js')]).then(function () {
        if (gone) return;
        made = window.spirit.element.spirit.app.agent.table.tableElement.create(container, {
          table: 'job', detail: detail,
          row: function (box, id, added) { return window.spirit.element.spirit.app.agent.table.job.elementRow.create(box, id, added, detail); },
        });
      });
      return {
        refresh: function () { if (made) made.refresh(); },
        destroy: function () { gone = true; if (made) made.destroy(); },
      };
    },
  }); });
}());
