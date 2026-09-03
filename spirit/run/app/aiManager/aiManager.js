// Dynamically loaded by index.html's discoverDynamicApps, on first launch
// only (see aiManager.json for the name/icon this app is already declared
// under before this script ever runs). Reaches the shell only through
// spirit.shell/spirit.core.*, same pattern as aiChat.js/appBuilder.js.
//
// Owns AI backend availability for the whole system: the Claude key check,
// the canonical Claude model list, and LM Studio's connection/model state
// (including load/unload). Every consumer (AI Chat, App Builder, and future
// codeBuilders) just reads the merged result from app/shared/aiStatus.json
// rather than performing any of this itself — see
// design/decisions/0005-ai-manager-and-titlebar-launchers.md.

if (!document.getElementById('ai-manager-styles')) {
  var styleEl = document.createElement('style');
  styleEl.id = 'ai-manager-styles';
  styleEl.textContent =
    '#ai-manager-claude-status, #ai-manager-lmstudio-status { margin: 6px 0 10px; }';
  document.head.appendChild(styleEl);
}

spirit.shell.activateApp({
  mount: function (container, api) {
    var escapeHtml = api.escapeHtml;

    // Same fixed list App Builder/AI Chat previously read directly — now
    // only this app touches it. Unscoped: app/shared/ is outside this
    // app's own folder.
    var CLAUDE_MODELS = JSON.parse(spirit.core.fs.loadFile('app/shared/claudeModels.json'));

    // Cheap key-validity check: count_tokens is documented as free (no
    // token billing) and has its own rate limit separate from the Messages
    // API, but still requires real auth — an invalid/missing key 401s here
    // exactly as it would on a real message call.
    function checkClaudeKeyValidity() {
      return api.fetchExternal('https://api.anthropic.com/v1/messages/count_tokens', {
        method: 'POST',
        timeoutMs: 15000,
        headers: { 'x-api-key': '${ENV:ANTHROPIC_API_KEY}', 'anthropic-version': '2023-06-01' },
        body: { model: 'claude-haiku-4-5', messages: [{ role: 'user', content: 'hi' }] },
      })
        .then(function (body) { return !body.error; })
        .catch(function () { return false; });
    }

    // Combines two independent signals: what LM Studio's own metadata
    // *proclaims* (type === 'vlm', from its native /api/v0/models) versus
    // what the vision probe *actually tested* by attempting a real caption.
    // Proclaimed vision support has already been shown to sometimes just be
    // wrong, so these are distinct states, not collapsed into one.
    function visionIconFor(liveEntry, probeEntry) {
      if (probeEntry && probeEntry.vision === false) {
        return liveEntry.type === 'vlm'
          ? { icon: spirit.core.const.ICON.WARNING, title: 'proclaims vision, but lms ls disagrees', capable: false }
          : null;
      }
      if (probeEntry && probeEntry.success === true) {
        return { icon: spirit.core.const.ICON.OK, title: 'verified working (vision probe)', capable: true };
      }
      if (probeEntry && probeEntry.success === false) {
        return { icon: spirit.core.const.ICON.WARNING, title: 'tested, failed: ' + (probeEntry.reason || 'unknown'), capable: false };
      }
      if (liveEntry.type === 'vlm') {
        return { icon: spirit.core.const.ICON.VIEW, title: 'proclaimed vision-capable, not verified', capable: true };
      }
      return null;
    }

    var claudeKeyValid = false;
    var liveLmStudioModels = [];
    var probeByModel = {};
    var lmStudioError = null;

    // Rebuilds app/shared/aiStatus.json from current in-memory state —
    // called after every check/load/unload, so every consumer always reads
    // a fresh snapshot rather than something this app forgot to update.
    // Unscoped spirit.core.fs.saveFile: app/shared/ is outside this app's
    // own folder, same pattern already used for the unscoped read above.
    function writeStatus() {
      var available = [];
      if (claudeKeyValid) {
        CLAUDE_MODELS.forEach(function (m) {
          available.push({ id: m.id, label: m.label, backend: 'claude', visionCapable: true });
        });
      }
      liveLmStudioModels.forEach(function (liveEntry) {
        if (liveEntry.state !== 'loaded') return;
        var visionState = visionIconFor(liveEntry, probeByModel[liveEntry.id]);
        available.push({
          id: liveEntry.id,
          label: liveEntry.id,
          backend: 'lmStudio',
          visionCapable: !!(visionState && visionState.capable),
        });
      });
      spirit.core.fs.saveFile('app/shared/aiStatus.json', JSON.stringify({ lastChecked: Date.now(), available: available }, null, 2));
    }

    function renderClaudeStatus() {
      var el = document.getElementById('ai-manager-claude-status');
      el.innerHTML = claudeKeyValid
        ? spirit.core.const.ICON.OK + ' key valid — ' + CLAUDE_MODELS.length + ' model(s) available'
        : spirit.core.const.ICON.WARNING + ' invalid API key — <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noopener">add credit ↗</a>';
    }

    function checkClaude() {
      document.getElementById('ai-manager-claude-status').textContent = 'checking…';
      return checkClaudeKeyValidity().then(function (valid) {
        claudeKeyValid = valid;
        renderClaudeStatus();
        writeStatus();
      });
    }

    function renderLmStudioTable() {
      var el = document.getElementById('ai-manager-lmstudio-table');
      if (lmStudioError) {
        el.innerHTML = '<div class="job-manifest-note">' + escapeHtml(lmStudioError) + '</div>';
        return;
      }
      var rows = liveLmStudioModels.map(function (liveEntry) {
        var visionState = visionIconFor(liveEntry, probeByModel[liveEntry.id]);
        var loadedCell = liveEntry.state === 'loaded'
          ? spirit.core.const.ICON.ON + ' <button type="button" class="cancel-btn" data-unload-model="' + escapeHtml(liveEntry.id) + '">Unload</button>'
          : '<button type="button" class="cancel-btn" data-load-model="' + escapeHtml(liveEntry.id) + '">Load</button>';
        return '<tr>' +
          '<td>' + escapeHtml(liveEntry.id) + '</td>' +
          '<td title="' + (visionState ? escapeHtml(visionState.title) : '') + '">' + (visionState ? visionState.icon : '') + '</td>' +
          '<td title="' + (liveEntry.state === 'loaded' ? 'loaded, ready now' : 'not loaded') + '">' + loadedCell + '</td>' +
          '</tr>';
      }).join('');
      el.innerHTML = '<table class="jobs-table"><thead><tr><th>Model</th><th>Vision</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';
    }

    function checkLmStudio() {
      document.getElementById('ai-manager-lmstudio-status').textContent = 'checking…';
      return api.fetchExternal('http://localhost:1234/api/v0/models', { timeoutMs: 2000 })
        .then(function (body) {
          liveLmStudioModels = body.data || [];
          lmStudioError = liveLmStudioModels.length === 0 ? 'no models currently loaded' : null;

          var probeRaw = spirit.core.fs.loadFile('process/js/lmStudioVisionProbe/results.json');
          probeByModel = {};
          if (probeRaw != null) {
            try {
              JSON.parse(probeRaw).results.forEach(function (r) { probeByModel[r.model] = r; });
            } catch (e) { /* malformed/missing probe data — proclaimed-only is fine */ }
          }

          document.getElementById('ai-manager-lmstudio-status').textContent = '';
          renderLmStudioTable();
          writeStatus();
        })
        .catch(function () {
          liveLmStudioModels = [];
          lmStudioError = 'LM Studio unreachable — start it and recheck.';
          document.getElementById('ai-manager-lmstudio-status').textContent = '';
          renderLmStudioTable();
          writeStatus();
        });
    }

    container.innerHTML =
      '<div class="stat-tile wide">' +
        '<div class="ab-file-path">Claude</div>' +
        '<div id="ai-manager-claude-status">checking…</div>' +
        '<button type="button" class="cancel-btn" id="ai-manager-recheck-claude">Recheck</button>' +
      '</div>' +
      '<div class="stat-tile wide">' +
        '<div class="ab-file-path">LM Studio</div>' +
        '<div id="ai-manager-lmstudio-status">checking…</div>' +
        '<div id="ai-manager-lmstudio-table"></div>' +
        '<button type="button" class="cancel-btn" id="ai-manager-recheck-lmstudio">Recheck</button>' +
      '</div>';

    api.addTitlebarLink('app/aiChat');
    api.addTitlebarLink('app/appBuilder');
    api.addTitlebarLink('app/typeDesigner');

    document.getElementById('ai-manager-recheck-claude').addEventListener('click', checkClaude);
    document.getElementById('ai-manager-recheck-lmstudio').addEventListener('click', checkLmStudio);

    document.getElementById('ai-manager-lmstudio-table').addEventListener('click', function (event) {
      var loadBtn = event.target.closest('[data-load-model]');
      if (loadBtn) {
        var loadModel = loadBtn.dataset.loadModel;
        loadBtn.disabled = true;
        loadBtn.textContent = 'Loading…';
        // spirit.core.jobs.start is already fully generic (spawns any
        // command) — no new server route needed for this, same mechanism
        // every other process script in this project uses.
        spirit.core.jobs.start({
          command: 'node',
          args: ['process/js/lmStudioLoadModel/lmStudioLoadModel.js', JSON.stringify({ model: loadModel })],
          type: 'Load LM Studio Model: ' + loadModel,
        });
        return;
      }
      var unloadBtn = event.target.closest('[data-unload-model]');
      if (unloadBtn) {
        var unloadModel = unloadBtn.dataset.unloadModel;
        unloadBtn.disabled = true;
        unloadBtn.textContent = 'Unloading…';
        spirit.core.jobs.start({
          command: 'node',
          args: ['process/js/lmStudioUnloadModel/lmStudioUnloadModel.js', JSON.stringify({ model: unloadModel })],
          type: 'Unload LM Studio Model: ' + unloadModel,
        });
      }
    });

    // Auto-refreshes once a load/unload job this app started finishes, so
    // the table (and the shared status file) update without a manual
    // Recheck click.
    spirit.core.jobs.subscribe({
      onUpdate: function (job) {
        var isModelJob = job.type && (job.type.indexOf('Load LM Studio Model: ') === 0 || job.type.indexOf('Unload LM Studio Model: ') === 0);
        if (isModelJob && (job.status === 'completed' || job.status === 'failed')) {
          checkLmStudio();
        }
      },
    });

    checkClaude();
    checkLmStudio();
  },
  render: function () {},
});
