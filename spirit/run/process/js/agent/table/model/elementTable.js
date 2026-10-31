// spirit/run/process/js/agent/table/model/elementTable.js
// THE MODEL TABLE IN THE PAGE (goal/G41.4): a model of a provider, its rows in a search list, a row picked opening in its
// editor (./elementRow.js) in the page's detail pane. Built on the tables' shared element (../tableElement.js).
// THE ASK FORM AT THE TOP (goal/G41.26; Andy, box: "The form \"from [Pick a provider ▾] [Ask]\" moves to the top of the
// left pane (🧠Models) and replaces that panes [provider models] buttons. the center pane panel goes. the [Ask] button will
// no longer spit out a list, and simply update the agent.model table"): from [providerSelector:dropdown] [Ask], the
// model list below it following the updated table by the stream. A refusal is said on one line, the provider's reason.
//   spirit.elements.modelTable.create(container, api, detail) -> { refresh, destroy }   detail: the page's detail pane (../tableElement.js)
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  var made = 0;
  E.modelTable = {
    create: function (container, api, detail) {
      var pre = 'mt' + (++made) + '-';
      var table = null;
      var drop = null;
      var gone = false;
      // WHAT IT USES, IT LOADS ITSELF (rule/26): the shared element, its row, the search and the busyButton of the form.
      Promise.all([spirit.require('process/js/agent/table/tableElement.js'), spirit.require('process/js/agent/table/model/elementRow.js'),
        spirit.require('shell/js/probabilitySearch.js'), spirit.require('shell/js/busyButton.js')]).then(function () {
        if (gone) return;
        E = window.spirit.elements;
        container.innerHTML = '<div class="fill">' +
          '<div id="' + pre + 'form" style="display:flex;align-items:center;gap:1em"><span>from</span><div id="' + pre + 'from" style="flex:1 1 0;min-width:0"></div>' +
          '<button type="button" id="' + pre + 'ask">Ask</button></div>' +
          '<div id="' + pre + 'said" class="job-manifest-note"></div>' +
          '<div id="' + pre + 'list" class="fill"></div></div>';
        // The providerSelector:dropdown, the same the job detail has (../tableElement.js, agentDetail.search).
        drop = E.agentDetail.search(container.querySelector('#' + pre + 'from'), { api: api, table: 'provider' }, { face: 'dropdown', placeholder: 'Pick a provider' });
        var said = container.querySelector('#' + pre + 'said');
        // ASK WAITS AS A BUSY BUTTON (goal/G41.23): its request the provider table's ask, which updates the model table.
        E.busyButton.attach(container.querySelector('#' + pre + 'ask'), { run: function () {
          var id = drop && drop.value ? String(drop.value) : '';
          if (!id) return null;
          said.textContent = '';
          return Promise.resolve(spirit.require(spirit.familyPath('agent'))).then(function (agent) { return agent.provider({ op: 'ask', id: id }); }).then(function () {}, function (e) {
            if (!gone) said.textContent = E.agentDetail.whyOf(e);
          });
        } });
        table = E.agentTable.create(container.querySelector('#' + pre + 'list'), {
          api: api, table: 'model', detail: detail,
          row: function (box, id, added) { return E.modelRow.create(box, api, id, added, detail); },
          // NO ADD: a model comes from its provider's list (Andy, on G41.18: "get RID of [Add a Model] button in the left
          // panes model mode. NOT required.").
          add: false,
          // goal/G41.18, box v17: the list shows "[icon] \"model-name\"", the provider's icon the server sends with the row.
          columns: [{ field: 'icon', from: 'providerIcon', label: '' }, { field: 'label', label: 'Model', sort: 'text' }],
        });
        // THE TITLE ROW FIRST (Andy, on G41.26: "the title row \"🧠Models\" must come before the \"from [🛖 Unsloth Studio ▾] [Ask]
        // row."): the form and its note moved in under the title the shared table draws.
        var title = container.querySelector('#' + pre + 'list .agent-title');
        if (title) title.parentNode.insertBefore(container.querySelector('#' + pre + 'said'), title.nextSibling);
        if (title) title.parentNode.insertBefore(container.querySelector('#' + pre + 'form'), title.nextSibling);
      });
      return {
        refresh: function () { if (table) table.refresh(); },
        destroy: function () { gone = true; if (drop) drop.destroy(); if (table) table.destroy(); },
      };
    },
  };
}());
