// spirit/run/process/js/agent/table/grant/elementTable.js
// THE GRANT TABLE IN THE PAGE (goal/G41.4): each job's grants in a search list, each by its job's icon and its label
// (the job: the path, as the grant search labels it),
// a grant picked opening in its editor (./elementRow.js) in the page's detail pane. Built on the tables' shared element
// (../tableElement.js), as every table is; its Add opens an empty editor, since a grant is made from a job and a path.
//   spirit.elements.grantTable.create(container, api, detail) -> { refresh, destroy }   detail: the page's detail pane
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  E.grantTable = {
    create: function (container, api, detail) {
      var made = null;
      var gone = false;
      Promise.all([spirit.require('process/js/agent/table/tableElement.js'), spirit.require('process/js/agent/table/grant/elementRow.js')]).then(function () {
        if (gone) return;
        E = window.spirit.elements;
        made = E.agentTable.create(container, {
          api: api, table: 'grant', detail: detail,
          matched: function (row) { return { job: row.job, path: String(row.path || '').split('.').join(' ') }; },
          row: function (box, key, added, row) { return E.grantRow.create(box, api, row, detail); },
          add: function (open) { open('', true, null); },
        });
      });
      return {
        refresh: function () { if (made) made.refresh(); },
        destroy: function () { gone = true; if (made) made.destroy(); },
      };
    },
  };
}());
