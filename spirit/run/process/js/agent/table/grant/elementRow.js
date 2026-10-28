// spirit/run/process/js/agent/table/grant/elementRow.js
// ONE GRANT IN THE PAGE (goal/G41.4): a grant is a job and a path (the grant table, keyed as node's grants are), so its
// panel either shows one, with Delete, or makes one: a job picked from a dropdown search of the jobs, a path typed, Add.
// What it shows after either is the server's answer (rule/19). Its title row and its field lines are every table
// editor's, from the one place they are made (../tableElement.js, E.agentDetail): Add for a new grant, Change for one
// shown.
//   spirit.elements.grantRow.create(container, api, grant, detail) -> { destroy }   grant { job_id, job, path }, or null
//   for a new one; detail: the page's detail pane, whose look('grant') gives the title row its icon and name
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  var AGENT = spirit.familyPath('agent');
  var made = 0;
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function call(args) {
    return Promise.resolve(spirit.require(AGENT)).then(function (a) { return a.grant(args); })
      .then(function (body) { return body || {}; }, function (e) { return { refused: (e && e.message) || 'refused' }; });
  }
  E.grantRow = {
    create: function (container, api, grant, detail) {
      var pre = 'gr' + (++made) + '-';
      var gone = false;
      var pickJob = null;
      var look = detail && detail.look ? detail.look('grant') : null;
      var D = window.spirit.elements.agentDetail;
      function note(text) { var n = container.querySelector('#' + pre + 'note'); if (n) n.textContent = text; }
      function shown(g) {
        if (pickJob) { pickJob.destroy(); pickJob = null; }
        container.innerHTML = '<div class="fill">' + D.titleRow(look, ['Change', (look && look.name) || 'grant']) +
          D.fieldLine('Job', esc(g.job || g.job_id)) + D.fieldLine('Path', '<b>' + esc(g.path) + '</b>') +
          '<div style="margin-top:1em"><button type="button" id="' + pre + 'delete">Delete</button> <span id="' + pre + 'note"></span></div></div>';
        container.querySelector('#' + pre + 'delete').addEventListener('click', function () {
          call({ op: 'delete', job_id: g.job_id, path: g.path }).then(function (r) {
            if (gone) return;
            if (r.refused) { note('Not deleted: ' + r.refused); return; }
            fresh('Deleted.');
          });
        });
      }
      function fresh(said) {
        container.innerHTML = '<div class="fill">' + D.titleRow(look, ['Add', (look && look.name) || 'grant']) +
          D.fieldLine('Job', '<div id="' + pre + 'job"></div>') +
          D.fieldLine('<label for="' + pre + 'path">Path</label>', '<input type="text" id="' + pre + 'path" style="' + D.stretch + '" placeholder="server.verb">') +
          '<div style="margin-top:1em"><button type="button" id="' + pre + 'add">Add</button> <span id="' + pre + 'note">' + esc(said || '') + '</span></div></div>';
        // The jobs from their branch of spirit.data, by the one table search (../tableElement.js).
        Promise.resolve(spirit.require('shell/js/probabilitySearch.js')).then(function () {
          if (gone) return;
          pickJob = D.search(container.querySelector('#' + pre + 'job'), { api: api, table: 'job' }, {
            face: 'dropdown', placeholder: 'Pick a job',
            columns: [{ field: 'label', label: 'Job', sort: 'text' }],
            name: function (r) { return r.label || r.key; },
          });
        });
        container.querySelector('#' + pre + 'add').addEventListener('click', function () {
          var job = pickJob && pickJob.value;
          var p = String((container.querySelector('#' + pre + 'path') || {}).value || '').trim();
          if (!job || !p) { note(!job ? 'Pick a job first.' : 'Type the path first.'); return; }
          call({ op: 'add', job_id: job, path: p }).then(function (r) {
            if (gone) return;
            if (r.refused) { note('Not added: ' + r.refused); return; }
            shown({ job_id: r.job_id, job: pickJob && pickJob.row ? pickJob.row.label : '', path: r.path });
          });
        });
      }
      if (grant && grant.job_id) shown(grant); else fresh('');
      return { destroy: function () { gone = true; if (pickJob) pickJob.destroy(); container.innerHTML = ''; } };
    },
  };
}());
