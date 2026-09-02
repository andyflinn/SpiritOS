// Dynamically loaded by index.html's discoverDynamicApps, on first launch
// only (see aiChat.json for the id/name/icon this app is already declared
// under before this script ever runs). Reaches the shell only through
// spirit.shell (activateApp/escapeHtml) and spirit.core.* (already globally
// reachable via window.spirit), never through index.html's own private
// closures — same pattern as textEditor.js.

if (!document.getElementById('ai-chat-styles')) {
  var styleEl = document.createElement('style');
  styleEl.id = 'ai-chat-styles';
  styleEl.textContent =
    '#ai-chat-history { max-height: 400px; overflow-y: auto; margin: 12px 0; }' +
    '.ai-chat-exchange { margin-bottom: 16px; }' +
    '.ai-chat-prompt { font-weight: 600; margin-bottom: 6px; }' +
    '.ai-chat-response { background: rgba(255,255,255,0.06); border-radius: 8px; padding: 8px 12px; margin-bottom: 6px; }' +
    '.ai-chat-target { font-size: 12px; opacity: 0.7; margin-bottom: 4px; }' +
    '.ai-chat-duration { opacity: 0.6; }' +
    '.ai-chat-pending { font-style: italic; opacity: 0.6; }' +
    '.ai-chat-error-text { color: #ff8080; }' +
    '.ai-chat-empty { opacity: 0.6; font-style: italic; }' +
    '.ai-chat-attached-image { max-width: 200px; display: block; margin-bottom: 6px; border-radius: 8px; }';
  document.head.appendChild(styleEl);
}

spirit.shell.activateApp({
  mount: function (container) {
    var escapeHtml = spirit.shell.escapeHtml;
    var scopedFs = spirit.core.fs.createScopedFs('aiChat');

    function loadConversation() {
      var raw = scopedFs.loadFile('conversation.json');
      if (raw == null) return { exchanges: [] };
      try { return JSON.parse(raw); } catch (e) { return { exchanges: [] }; }
    }

    var conversation = loadConversation();

    function saveConversation() {
      scopedFs.saveFile('conversation.json', JSON.stringify(conversation, null, 2));
    }

    // Each target sees only its OWN prior thread, reconstructed from the
    // exchange log rather than stored separately — so one model's answers
    // never leak into another's context, and a target that wasn't asked (or
    // whose answer errored) just leaves a gap rather than breaking the walk.
    // Historical turns stay text-only even if they had an image attached —
    // only the newest message ever includes one (see sendPrompt) — avoids
    // re-fetching and re-encoding a base64 blob on every later turn for no
    // real benefit once a model has already answered about it.
    function buildMessagesForTarget(target, newPrompt, imageDataUrl) {
      var messages = [];
      conversation.exchanges.forEach(function (exchange) {
        var response = exchange.responses.filter(function (r) { return r.target === target && r.text != null; })[0];
        if (!response) return;
        messages.push({ role: 'user', content: exchange.prompt });
        messages.push({ role: 'assistant', content: response.text });
      });
      messages.push({
        role: 'user',
        content: imageDataUrl
          ? [{ type: 'text', text: newPrompt }, { type: 'image_url', image_url: { url: imageDataUrl } }]
          : newPrompt,
      });
      return messages;
    }

    // Image attachment: conversation.json only ever stores the relative
    // path (e.g. "media/001.jpg") — never a copy of the bytes. A native
    // <input type="file"> can't produce that path at all (browsers never
    // expose the real filesystem path of a picked file), so this browses
    // media/ in-app instead, using the same fs-watcher data the Files app
    // already reads via /api/jobs (generic, not LM-Studio-specific).
    var attachedImagePath = null; // cleared after each send
    var IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

    function loadMediaImages() {
      return fetch('/api/jobs')
        .then(function (res) { return res.json(); })
        .then(function (jobs) {
          var fsWatcher = jobs.filter(function (j) { return j.type === 'fs-watcher'; })[0];
          var files = (fsWatcher && fsWatcher.data && fsWatcher.data.files) || [];
          var images = files.filter(function (f) {
            var ext = f.relativePath.substring(f.relativePath.lastIndexOf('.')).toLowerCase();
            return f.kind === 'file' && f.relativePath.indexOf('media/') === 0 && IMAGE_EXTENSIONS.indexOf(ext) !== -1;
          });
          var selectEl = document.getElementById('ai-chat-attach-select');
          selectEl.innerHTML = '<option value="">(none)</option>' + images.map(function (f) {
            return '<option value="' + escapeHtml(f.relativePath) + '">' + escapeHtml(f.relativePath) + '</option>';
          }).join('');
        });
    }

    function clearAttachment() {
      attachedImagePath = null;
      var selectEl = document.getElementById('ai-chat-attach-select');
      if (selectEl) selectEl.value = '';
      var previewEl = document.getElementById('ai-chat-attach-preview');
      if (previewEl) previewEl.style.display = 'none';
    }

    // Only visible when every currently checked target is vision-capable —
    // sending an image to a model that can't use it would be pointless.
    // Called on every checkbox change, including from the bulk-select
    // buttons below, which set .checked programmatically and don't fire a
    // native change event on their own.
    function updateAttachVisibility() {
      var checked = Array.prototype.slice.call(document.querySelectorAll('.ai-chat-model-checkbox:checked'));
      var allVisionCapable = checked.length > 0 && checked.every(function (cb) { return cb.dataset.visionCapable === 'true'; });
      var attachEl = document.getElementById('ai-chat-attach');
      if (attachEl) attachEl.hidden = !allVisionCapable;
      if (!allVisionCapable) clearAttachment();
    }

    function blobToDataUrl(blob) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve(reader.result); };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    container.innerHTML =
      '<div class="stat-tile wide"><div id="ai-chat-models">loading models…</div></div>' +
      '<div id="ai-chat-history"></div>' +
      '<div id="ai-chat-attach" hidden>' +
        '<label>Attach image: <select id="ai-chat-attach-select"><option value="">(none)</option></select></label> ' +
        '<img id="ai-chat-attach-preview" style="display:none; max-height:60px; vertical-align:middle; border-radius:4px;">' +
      '</div>' +
      '<form id="ai-chat-form" class="start-job-form">' +
        '<input type="text" id="ai-chat-prompt" placeholder="Ask something…" style="flex:1">' +
        '<button type="submit">Send</button>' +
      '</form>' +
      '<div id="ai-chat-error" class="job-start-error"></div>';

    document.getElementById('ai-chat-attach-select').addEventListener('change', function (event) {
      attachedImagePath = event.target.value || null;
      var previewEl = document.getElementById('ai-chat-attach-preview');
      if (attachedImagePath) {
        previewEl.src = '/' + attachedImagePath;
        previewEl.style.display = 'inline-block';
      } else {
        previewEl.style.display = 'none';
      }
    });

    // One-time delegated setup for everything inside #ai-chat-models — that
    // container persists across renderModelTable's repeated calls (only its
    // innerHTML is replaced), so binding here once, rather than per-render,
    // avoids stacking duplicate listeners.
    document.getElementById('ai-chat-models').addEventListener('click', function (event) {
      var selectBtn = event.target.closest('[data-select]');
      if (selectBtn) {
        var mode = selectBtn.dataset.select;
        document.querySelectorAll('.ai-chat-model-checkbox').forEach(function (cb) {
          cb.checked = mode === 'all' || (mode === 'vision' && cb.dataset.visionCapable === 'true');
        });
        updateAttachVisibility(); // bulk-select sets .checked programmatically — no native change event to catch this otherwise
        return;
      }

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

    document.getElementById('ai-chat-models').addEventListener('change', function (event) {
      if (event.target.classList.contains('ai-chat-model-checkbox')) updateAttachVisibility();
    });

    // Auto-refreshes the model table once a load/unload job this app
    // started finishes, so the "Loaded" state updates without a manual
    // reload. spirit.core.jobs.subscribe is already a generic, existing
    // browser API — every app can use it, not just the ones that built the
    // Jobs system.
    spirit.core.jobs.subscribe({
      onUpdate: function (job) {
        var isModelJob = job.type && (job.type.indexOf('Load LM Studio Model: ') === 0 || job.type.indexOf('Unload LM Studio Model: ') === 0);
        if (isModelJob && (job.status === 'completed' || job.status === 'failed')) {
          loadModels();
        }
      },
    });

    function formatDuration(ms) {
      if (ms == null) return '';
      return ms < 1000 ? (ms + 'ms') : ((ms / 1000).toFixed(1) + 's');
    }

    function renderHistory() {
      var historyEl = document.getElementById('ai-chat-history');
      historyEl.innerHTML = conversation.exchanges.map(function (exchange) {
        var responsesHtml = exchange.targets.map(function (target) {
          var response = exchange.responses.filter(function (r) { return r.target === target; })[0];
          var label = target.replace(/^lm-studio:/, '');
          if (!response) {
            return '<div class="ai-chat-response"><div class="ai-chat-target">' + escapeHtml(label) + '</div><div class="ai-chat-pending">thinking…</div></div>';
          }
          var targetLabel = escapeHtml(label) +
            (response.durationMs != null ? ' <span class="ai-chat-duration">(' + formatDuration(response.durationMs) + ')</span>' : '');
          var body = response.error
            ? '<div class="ai-chat-error-text">' + escapeHtml(response.error) + '</div>'
            : '<div class="ai-chat-text">' + escapeHtml(response.text) + '</div>';
          return '<div class="ai-chat-response"><div class="ai-chat-target">' + targetLabel + '</div>' + body + '</div>';
        }).join('');

        return '<div class="ai-chat-exchange">' +
          (exchange.image ? '<img class="ai-chat-attached-image" src="/' + escapeHtml(exchange.image) + '">' : '') +
          '<div class="ai-chat-prompt">' + escapeHtml(exchange.prompt) + '</div>' +
          responsesHtml +
          '</div>';
      }).join('') || '<div class="ai-chat-empty">(no messages yet)</div>';
      historyEl.scrollTop = historyEl.scrollHeight;
    }

    // Combines two independent signals: what LM Studio's own metadata
    // *proclaims* (type === 'vlm', from its native /api/v0/models — a
    // richer, LM-Studio-specific endpoint than the plain OpenAI-compatible
    // /v1/models used to actually talk to a model) versus what the vision
    // probe *actually tested* by attempting a real caption. Proclaimed
    // vision support has already been shown this session to sometimes just
    // be wrong, so these are shown as distinct states, not collapsed into one.
    function visionIconFor(liveEntry, probeEntry) {
      // The probe records a "not a vision model" skip as success:false too
      // (it never attempted a real test) — its own vision flag (from
      // `lms ls`, independent of the live /api/v0/models type field) is
      // what actually distinguishes that from a genuine tested failure.
      // Treating a correct skip as a warning would be a false alarm.
      if (probeEntry && probeEntry.vision === false) {
        return liveEntry.type === 'vlm' ? { icon: spirit.core.const.ICON.WARNING, title: 'proclaims vision, but lms ls disagrees' } : null;
      }
      if (probeEntry && probeEntry.success === true) {
        return { icon: spirit.core.const.ICON.OK, title: 'verified working (vision probe)' };
      }
      if (probeEntry && probeEntry.success === false) {
        return { icon: spirit.core.const.ICON.WARNING, title: 'tested, failed: ' + (probeEntry.reason || 'unknown') };
      }
      if (liveEntry.type === 'vlm') {
        return { icon: spirit.core.const.ICON.VIEW, title: 'proclaimed vision-capable, not verified' };
      }
      return null;
    }

    // Builds/replaces the table's HTML only — event wiring lives in one
    // delegated setup attached once in mount (below), not re-attached here.
    // modelsEl itself persists across calls (only its innerHTML is
    // replaced), so listeners bound directly to it here would otherwise
    // stack a duplicate on every re-render — and this now re-renders
    // repeatedly over a session's life (the "Load" auto-refresh below).
    function renderModelTable(liveModels, probeByModel) {
      var modelsEl = document.getElementById('ai-chat-models');
      var rows = liveModels.map(function (liveEntry) {
        var visionState = visionIconFor(liveEntry, probeByModel[liveEntry.id]);
        // LM Studio doesn't auto-load a model on request in this setup —
        // sending to an unloaded one errors immediately ("Model is
        // unloaded") rather than loading it. Repeated loads without
        // unloading also create numbered duplicate instances (confirmed
        // live: "model-name:2", "model-name:3", ...), each its own row here
        // and each consuming its own memory — Unload is what cleans those up.
        var loadedCell = liveEntry.state === 'loaded'
          ? spirit.core.const.ICON.ON + ' <button type="button" class="cancel-btn" data-unload-model="' + escapeHtml(liveEntry.id) + '">Unload</button>'
          : '<button type="button" class="cancel-btn" data-load-model="' + escapeHtml(liveEntry.id) + '">Load</button>';
        return '<tr>' +
          '<td><input type="checkbox" class="ai-chat-model-checkbox" value="' + escapeHtml(liveEntry.id) + '"' +
            (visionState ? ' data-vision-capable="true"' : '') + '></td>' +
          '<td>' + escapeHtml(liveEntry.id) + '</td>' +
          '<td title="' + (visionState ? escapeHtml(visionState.title) : '') + '">' + (visionState ? visionState.icon : '') + '</td>' +
          '<td title="' + (liveEntry.state === 'loaded' ? 'loaded, ready now' : 'not loaded') + '">' + loadedCell + '</td>' +
          '</tr>';
      }).join('');

      modelsEl.innerHTML =
        '<div id="ai-chat-model-toolbar">Select: ' +
          '<button type="button" class="cancel-btn" data-select="all">All</button> ' +
          '<button type="button" class="cancel-btn" data-select="none">None</button> ' +
          '<button type="button" class="cancel-btn" data-select="vision">Vision-capable</button>' +
        '</div>' +
        '<table class="jobs-table"><thead><tr><th></th><th>Model</th><th>Vision</th><th>Loaded</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table>';
    }

    function loadModels() {
      var modelsEl = document.getElementById('ai-chat-models');
      // Goes through the server's generic /api/proxy route (not LM Studio
      // directly — no Access-Control-Allow-Origin header, so a cross-origin
      // browser fetch would be silently blocked by CORS). The proxy knows
      // nothing about LM Studio; this caller owns parsing its raw response
      // shape ({data: [{id, type, ...}]}).
      fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'http://localhost:1234/api/v0/models', timeoutMs: 2000 }),
      })
        .then(function (res) { return res.json(); })
        .then(function (body) {
          var liveModels = body.data || [];
          if (liveModels.length === 0) throw new Error('no models currently loaded');

          var probeRaw = spirit.core.fs.loadFile('process/js/lmStudioVisionProbe/results.json');
          var probeByModel = {};
          if (probeRaw != null) {
            try {
              JSON.parse(probeRaw).results.forEach(function (r) { probeByModel[r.model] = r; });
            } catch (e) { /* malformed/missing probe data — proclaimed-only is fine */ }
          }

          renderModelTable(liveModels, probeByModel);
        })
        .catch(function () {
          modelsEl.textContent = 'LM Studio unreachable — start it and reload this app.';
        });
    }

    // Fires one request per checked target, concurrently — each resolves
    // (or errors) and updates its own response slot independently, so a
    // fast small model's answer shows up without waiting on a slow large
    // one. The question itself is persisted before any answer arrives, so
    // it's never lost even if every target then fails.
    function sendPrompt(prompt) {
      var checked = Array.prototype.slice.call(document.querySelectorAll('.ai-chat-model-checkbox:checked'));
      var errorEl = document.getElementById('ai-chat-error');
      errorEl.textContent = '';
      if (checked.length === 0) {
        errorEl.textContent = 'Check at least one model to send to.';
        return;
      }

      var targets = checked.map(function (cb) { return 'lm-studio:' + cb.value; });
      var exchange = {
        id: 'exchange_' + Date.now(),
        timestamp: Date.now(),
        prompt: prompt,
        targets: targets,
        responses: [],
      };
      if (attachedImagePath) exchange.image = attachedImagePath; // path only — never the bytes
      conversation.exchanges.push(exchange);
      saveConversation();
      renderHistory();
      clearAttachment();

      // Base64 conversion happens once here, in memory, only for this one
      // outgoing send — never persisted. Fetches the already-servable
      // static file (the same route Media Viewer already relies on) as a
      // blob and reads it as a data URL.
      var imageDataUrlPromise = exchange.image
        ? fetch('/' + exchange.image).then(function (r) { return r.blob(); }).then(blobToDataUrl)
        : Promise.resolve(null);

      imageDataUrlPromise.then(function (imageDataUrl) {
        targets.forEach(function (target) {
          var model = target.replace(/^lm-studio:/, '');
          var messages = buildMessagesForTarget(target, prompt, imageDataUrl);
          var startedAt = Date.now();

          // Same generic proxy as loadModels — this caller supplies the
          // target and owns extracting the reply from LM Studio's raw chat-
          // completion response shape.
          fetch('/api/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: 'http://localhost:1234/v1/chat/completions',
              method: 'POST',
              timeoutMs: 300000,
              body: { model: model, temperature: 0.7, messages: messages },
            }),
          })
            .then(function (res) { return res.json(); })
            .then(function (chatBody) {
              var responseEntry = { target: target, respondedAt: Date.now(), durationMs: Date.now() - startedAt };
              var choice = chatBody.choices && chatBody.choices[0];
              var text = choice && choice.message && choice.message.content;
              if (chatBody.error || !text) {
                responseEntry.error = chatBody.error || 'empty response';
              } else {
                responseEntry.text = text;
              }
              exchange.responses.push(responseEntry);
              saveConversation();
              renderHistory();
            })
            .catch(function (err) {
              exchange.responses.push({ target: target, error: err.message, respondedAt: Date.now(), durationMs: Date.now() - startedAt });
              saveConversation();
              renderHistory();
            });
        });
      });
    }

    document.getElementById('ai-chat-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var input = document.getElementById('ai-chat-prompt');
      var prompt = input.value.trim();
      if (!prompt) return;
      input.value = '';
      sendPrompt(prompt);
    });

    loadModels();
    loadMediaImages();
    renderHistory();
  },
  render: function () {}, // static once mounted, same as Code Viewer/Text Editor
});
