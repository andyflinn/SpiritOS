// spirit/run/process/js/agent/table/grant/elementTable.js
// THE GRANT TABLE IN THE PAGE (goal/G41.4): each job's grants in a search list, named by the job's label and the path,
// an Add button above it as every table has. A grant picked, or Add, opens its editor (./elementRow.js) in the page's
// detail pane (Andy: "make the detail-panel take over the middle pane of the workBench UI"); detail.open(make) is the
// page's, as ../tableElement.js describes it.
//   spirit.elements.grantTable.create(container, api, detail) -> { refresh, destroy }
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  var COLUMNS = [{ field: 'job', label: 'Job', sort: 'text' }, { field: 'path', label: 'Path', sort: 'text' }];
  E.grantTable = {
    create: function (container, api, detail) {
      var gone = false;
      var list = null;
      container.innerHTML = '<div class="fill"><div><button type="button" class="grant-add">Add a grant</button></div>' +
        '<div class="fill grant-list" style="min-height:12em"></div></div>';
      var listBox = container.querySelector('.grant-list');
      function open(grant) {
        if (detail) detail.open(function (box) { return window.spirit.elements.grantRow.create(box, api, grant); });
      }
      Promise.all([spirit.require('shell/js/probabilitySearch.js'), spirit.require('process/js/agent/table/grant/elementRow.js')]).then(function () {
        if (gone) return;
        E = window.spirit.elements;
        container.querySelector('.grant-add').addEventListener('click', function () { open(null); });
        list = E.probabilitySearch.create(listBox, {
          api: api, server: 'agent', verb: 'grant',
          args: function (text) { return { op: 'search', text: text }; },
          columns: COLUMNS,
          matched: function (row) { return { job: row.job, path: String(row.path || '').split('.').join(' ') }; },
          pick: function (row) { open(row); },
          empty: 'No grant yet.',
        });
      });
      return {
        refresh: function () { if (list) list.refresh(); },
        destroy: function () { gone = true; if (list) list.destroy(); container.innerHTML = ''; },
      };
    },
  };
}());
