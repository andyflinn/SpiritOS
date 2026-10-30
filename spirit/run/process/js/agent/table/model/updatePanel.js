// spirit/run/process/js/agent/table/model/updatePanel.js
// THE UPDATE MODEL LIST PANE (goal/G41.18), opened in the workBench's centre by the model table's "provider models"
// button (./elementTable.js). Andy, box v17: "the title of the new center-pane is: \"🧠 Update model list\"", "then a form
// row: from [provider-dropdown] [ask-Button]", and "when a provider is selected. The ask button will ask the provider for
// a model-list, which is then shown below the the ask form above, with a remark \"model list updated.\"".
// The asking and the updating are the provider table's ask (../provider/server.js); this pane draws its answer and writes
// no row: the model list in the left pane follows by the stream (rule/19).
//   spirit.elements.modelUpdate.create(container, api, detail) -> { destroy }   detail: the page's detail pane (../tableElement.js)
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  var made = 0;
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  E.modelUpdate = {
    create: function (container, api, detail) {
      var pre = 'mu' + (++made) + '-';
      var gone = false;
      var drop = null;
      // WHAT IT USES, IT LOADS ITSELF (rule/26).
      // goal/G41.23: Ask is a busyButton (shell/js/busyButton.js), loaded here too.
      Promise.all([spirit.require('process/js/agent/table/tableElement.js'), spirit.require('shell/js/probabilitySearch.js'), spirit.require('shell/js/busyButton.js')]).then(function () {
        if (gone) return;
        E = window.spirit.elements;
        var D = E.agentDetail;
        var look = detail && detail.look ? detail.look('model') : { icon: '🧠' };
        container.innerHTML = '<div class="fill">' + D.titleRow(look, ['Update model list']) +
          '<div style="margin-top:1em;display:flex;align-items:center;gap:1em"><span>from</span><div id="' + pre + 'from" style="flex:1 1 0;min-width:0"></div>' +
          '<button type="button" id="' + pre + 'ask">Ask</button></div>' +
          // The answered list scrolls in its own box, the title and the form staying in view (rule/16).
          '<div id="' + pre + 'said" class="fill" style="margin-top:1em;overflow:auto"></div></div>';
        drop = D.search(container.querySelector('#' + pre + 'from'), { api: api, table: 'provider' }, { face: 'dropdown', placeholder: 'Pick a provider' });
        var said = container.querySelector('#' + pre + 'said');
        // ASK WAITS AS A BUSY BUTTON (goal/G41.23; Andy, goal/G41.18: "for all buttons that wait for potentially long requests"):
        // greyed and turning until the provider has answered.
        E.busyButton.attach(container.querySelector('#' + pre + 'ask'), { run: function () {
          var id = drop && drop.value ? String(drop.value) : '';
          if (!id) return null;
          return Promise.resolve(spirit.require(spirit.familyPath('agent'))).then(function (agent) { return agent.provider({ op: 'ask', id: id }); }).then(function (r) {
            if (gone) return;
            var models = (r && Array.isArray(r.models)) ? r.models : [];
            said.innerHTML = models.map(function (m) { return '<div>' + esc(m.label) + ' <span class="job-manifest-note">' + esc(m.modelName) + '</span></div>'; }).join('') +
              (r && r.updated === true ? '<div style="margin-top:1em">model list updated.</div>' : (models.length ? '' : '<div>The provider listed no models.</div>'));
          }, function (e) {
            if (gone) return;
            said.innerHTML = '<div>' + esc(D.whyOf(e)) + '</div>';
          });
        } });
      });
      return { destroy: function () { gone = true; if (drop) drop.destroy(); container.innerHTML = ''; } };
    },
  };
}());
