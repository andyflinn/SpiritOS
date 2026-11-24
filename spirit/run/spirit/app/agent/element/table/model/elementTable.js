'use strict';
// spirit/run/spirit/app/agent/element/table/model/elementTable.js
// THE MODEL TABLE IN THE PAGE (goal/G41.4): a model of a provider, its rows in a search list, a row picked opening in its
// editor (./elementRow.js) in the page's detail pane. Built on the tables' shared element (../tableElement.js).
// THE ASK FORM AT THE TOP (goal/G41.26; Andy, box: "The form \"from [Pick a provider ▾] [Ask]\" moves to the top of the
// left pane (🧠Models) and replaces that panes [provider models] buttons. the center pane panel goes. the [Ask] button will
// no longer spit out a list, and simply update the agent.model table"): a rowForm since goal/G41.27, ❓
// [providerSelector:dropdown] [Ask], the model list below it following the updated table by the stream. A refusal is said on one line, the provider's reason.
//   spirit.required.spirit.app.agent.element.table.model.elementTable.create(container, detail) -> { refresh, destroy }   detail: the page's detail pane (../tableElement.js)
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
  var made = 0;
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = {
    create: function (container, detail) {
      var pre = 'mt' + (++made) + '-';
      var table = null;
      var drop = null;
      var gone = false;
      // WHAT IT USES, IT LOADS ITSELF (rule/26): the shared element, its row, the search and the rowForm.
      Promise.all([keepAnswer('spirit/app/agent/element/table/tableElement.js'), keepAnswer('spirit/app/agent/element/table/model/elementRow.js'),
        keepAnswer('spirit/element/search.js'), keepAnswer('spirit/element/rowForm.js')]).then(function () {
        if (gone) return;
        // ITS BOX KEEPS WHAT IT HOLDS INSIDE IT (goal/G47.1, -browser: the box declares overflow not visible).
        container.innerHTML = '<div class="fill" style="overflow:hidden">' +
          '<div id="' + pre + 'form"></div>' +
          '<div id="' + pre + 'said" class="job-manifest-note"></div>' +
          '<div id="' + pre + 'list" class="fill"></div></div>';
        // A ROWFORM (goal/G41.27; Andy: "agent: left panel. \n\n[❓] [Pick a provider ▾] [Ask]"): ❓, the
        // providerSelector:dropdown in its span, the same the job detail has (../tableElement.js, agentDetail.search), Ask
        // its button; "from" gone.
        // ASK WAITS BUSY (goal/G41.23; goal/G47.1, Q20, Andy: "mark the button busy from press until the mounter's answer
        // comes"): its request, the provider table's ask, which updates the model table, is the rowForm's press, so the
        // rowForm's own busy button waits on it. A second busy button of its own on that button would fight the first.
        var said = null;
        var form = ANSWER['spirit/element/rowForm.js'].create(container.querySelector('#' + pre + 'form'), { icon: '❓', button: 'Ask', press: function () {
          var id = drop && drop.value ? String(drop.value) : '';
          if (!id) return null;
          said.textContent = '';
          return Promise.resolve(keepAnswer('spirit/app/agent/api.js')).then(function (agent) { return agent.provider({ op: 'ask', id: id }); }).then(function () {}, function (e) {
            if (!gone) said.textContent = ANSWER['spirit/app/agent/element/table/tableElement.js'].whyOf(e);
          });
        } });
        drop = ANSWER['spirit/app/agent/element/table/tableElement.js'].search(form.span, { table: 'provider' }, { face: 'dropdown', placeholder: 'Pick a provider' });
        said = container.querySelector('#' + pre + 'said');
        table = ANSWER['spirit/app/agent/element/table/tableElement.js'].create(container.querySelector('#' + pre + 'list'), {
          table: 'model', detail: detail,
          row: function (box, id, added) { return ANSWER['spirit/app/agent/element/table/model/elementRow.js'].create(box, id, added, detail); },
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
        // Its own box emptied too: the outer fill is its own, not the shared table's (goal/G47.1, -browser: "destroyed, its box is empty").
        destroy: function () { gone = true; if (drop) drop.destroy(); if (table) table.destroy(); container.innerHTML = ''; },
      };
    },
  };
}());
