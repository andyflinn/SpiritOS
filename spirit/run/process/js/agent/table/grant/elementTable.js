// spirit/run/process/js/agent/table/grant/elementTable.js
// THE GRANT TABLE IN THE PAGE (goal/G41.4): each job's grants in a search list, named by the job's label and the path,
// a grant picked opening in its editor (./elementRow.js), and the editor below for a new one. Built on the tables'
// shared element (../tableElement.js); its Add opens an empty editor, since a grant is made from a job and a path.
//   spirit.elements.grantTable.create(container, api) -> { refresh, destroy }
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  var COLUMNS = [{ field: 'job', label: 'Job', sort: 'text' }, { field: 'path', label: 'Path', sort: 'text' }];
  E.grantTable = {
    create: function (container, api) {
      var gone = false;
      var list = null;
      var rowEl = null;
      container.innerHTML = '<div class="fill"><div class="fill grant-list" style="min-height:12em"></div><div class="grant-row"></div></div>';
      var listBox = container.querySelector('.grant-list');
      var rowBox = container.querySelector('.grant-row');
      function open(grant) {
        if (rowEl) rowEl.destroy();
        rowEl = E.grantRow.create(rowBox, api, grant);
      }
      Promise.all([spirit.require('shell/js/probabilitySearch.js'), spirit.require('process/js/agent/table/grant/elementRow.js')]).then(function () {
        if (gone) return;
        E = window.spirit.elements;
        list = E.probabilitySearch.create(listBox, {
          api: api, server: 'agent', verb: 'grant',
          args: function (text) { return { op: 'search', text: text }; },
          columns: COLUMNS,
          matched: function (row) { return { job: row.job, path: String(row.path || '').split('.').join(' ') }; },
          pick: function (row) { open(row); },
          empty: 'No grant yet.',
        });
        open(null);
      });
      return {
        refresh: function () { if (list) list.refresh(); },
        destroy: function () { gone = true; if (rowEl) rowEl.destroy(); if (list) list.destroy(); container.innerHTML = ''; },
      };
    },
  };
}());
