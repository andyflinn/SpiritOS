'use strict';
// spirit/run/spirit/app/agent/element/table/model/elementTable.js
// THE MODEL TABLE IN THE PAGE (goal/G41.4): a model of a provider, its rows in a search list, a row picked opening in its
// editor (./elementRow.js) in the page's detail pane. Built on the tables' shared element (../tableElement.js).
// THE ASK FORM AT THE TOP (goal/G41.26; Andy, box: "The form \"from [Pick a provider ▾] [Ask]\" moves to the top of the
// left pane (🧠Models) and replaces that panes [provider models] buttons. the center pane panel goes. the [Ask] button will
// no longer spit out a list, and simply update the agent.model table"): a rowForm since goal/G41.27, ❓
// [providerSelector:dropdown] [Ask], the model list below it following the updated table by the stream. A refusal is said on one line, the provider's reason.
//   spirit.element.spirit.app.agent.element.table.model.elementTable.create(container, detail) -> { refresh, destroy }   detail: the page's detail pane (../tableElement.js)
(function () {
  var made = 0;
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/agent/element/table/model/elementTable.js', {
    create: function (container, detail) {
      var pre = 'mt' + (++made) + '-';
      var table = null;
      var drop = null;
      var gone = false;
      // WHAT IT USES, IT LOADS ITSELF (rule/26): the shared element, its row, the search, the busyButton and the rowForm.
      Promise.all([spirit.require('spirit/app/agent/element/table/tableElement.js'), spirit.require('spirit/app/agent/element/table/model/elementRow.js'),
        spirit.require('spirit/element/search.js'), spirit.require('spirit/element/busyButton.js'),
        spirit.require('spirit/element/rowForm.js')]).then(function () {
        if (gone) return;
        container.innerHTML = '<div class="fill">' +
          '<div id="' + pre + 'form"></div>' +
          '<div id="' + pre + 'said" class="job-manifest-note"></div>' +
          '<div id="' + pre + 'list" class="fill"></div></div>';
        // A ROWFORM (goal/G41.27; Andy: "agent: left panel. \n\n[❓] [Pick a provider ▾] [Ask]"): ❓, the
        // providerSelector:dropdown in its span, the same the job detail has (../tableElement.js, agentDetail.search), Ask
        // its button; "from" gone.
        var form = window.spirit.element.spirit.element.rowForm.create(container.querySelector('#' + pre + 'form'), { icon: '❓', button: 'Ask' });
        drop = window.spirit.element.spirit.app.agent.element.table.tableElement.search(form.span, { table: 'provider' }, { face: 'dropdown', placeholder: 'Pick a provider' });
        var said = container.querySelector('#' + pre + 'said');
        // ASK WAITS AS A BUSY BUTTON (goal/G41.23): its request the provider table's ask, which updates the model table.
        window.spirit.element.spirit.element.busyButton.attach(form.button, { run: function () {
          var id = drop && drop.value ? String(drop.value) : '';
          if (!id) return null;
          said.textContent = '';
          return Promise.resolve(spirit.require(spirit.familyPath('agent'))).then(function (agent) { return agent.provider({ op: 'ask', id: id }); }).then(function () {}, function (e) {
            if (!gone) said.textContent = window.spirit.element.spirit.app.agent.element.table.tableElement.whyOf(e);
          });
        } });
        table = window.spirit.element.spirit.app.agent.element.table.tableElement.create(container.querySelector('#' + pre + 'list'), {
          table: 'model', detail: detail,
          row: function (box, id, added) { return window.spirit.element.spirit.app.agent.element.table.model.elementRow.create(box, id, added, detail); },
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
  }); });
}());
