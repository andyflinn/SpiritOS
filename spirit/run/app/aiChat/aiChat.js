// Dynamically loaded by index.html's discoverDynamicApps, on first launch
// only (see aiChat.json for the id/name/icon this app is already declared
// under before this script ever runs). Reaches the shell only through
// spirit.shell (activateApp/escapeHtml) and spirit.core.* (already globally
// reachable via window.spirit), never through index.html's own private
// closures — same pattern as textEditor.js.
//
// Model availability (which Claude/LM Studio models can currently be used)
// is no longer this app's concern — AI Manager (app/aiManager) owns the key
// check, the LM Studio connection/load state, and writes the merged list to
// app/shared/aiStatus.json. This app just reads that file and offers a
// single-select dropdown; see design/decisions/0005-ai-manager-and-titlebar-launchers.md.

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
  mount: function (container, api) {
    var escapeHtml = api.escapeHtml;
    var scopedFs = api.fs;

    // AI Manager's merged status file — read once at mount, unscoped since
    // app/shared/ is outside this app's own folder (same pattern already
    // used for app/shared/claudeModels.json before this change).
    var aiStatus = null;
    try {
      var statusRaw = spirit.core.fs.loadFile('app/shared/aiStatus.json');
      aiStatus = statusRaw ? JSON.parse(statusRaw) : null;
    } catch (e) { aiStatus = null; }
    var AVAILABLE = (aiStatus && aiStatus.available) || [];

    function loadConversation() {
      var raw = scopedFs.loadFile('conversation.json');
      if (raw == null) return { exchanges: [] };
      try { return JSON.parse(raw); } catch (e) { return { exchanges: [] }; }
    }

    var conversation = loadConversation();

    function saveConversation() {
      scopedFs.saveFile('conversation.json', JSON.stringify(conversation, null, 2));
    }

    // Reconstructs this target's own prior thread from the exchange log.
    // Tolerates both the current single-target exchange shape and the
    // pre-single-select shape (targets[]/responses[]) already on disk from
    // before this app moved off multi-select — old history keeps working,
    // it's just never added to going forward. Historical turns stay
    // text-only even if they had an image attached — only the newest
    // message ever includes one (see sendPrompt).
    function buildMessagesForTarget(target, newPrompt, imageDataUrl, backend) {
      var messages = [];
      conversation.exchanges.forEach(function (exchange) {
        var response = exchange.responses
          ? exchange.responses.filter(function (r) { return r.target === target && r.text != null; })[0]
          : (exchange.target === target && exchange.response && exchange.response.text != null ? exchange.response : null);
        if (!response) return;
        messages.push({ role: 'user', content: exchange.prompt });
        messages.push({ role: 'assistant', content: response.text });
      });

      var newContent = newPrompt;
      if (imageDataUrl) {
        if (backend === 'claude') {
          var match = imageDataUrl.match(/^data:([^;]+);base64,(.*)$/);
          newContent = [
            { type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } },
            { type: 'text', text: newPrompt },
          ];
        } else {
          newContent = [{ type: 'text', text: newPrompt }, { type: 'image_url', image_url: { url: imageDataUrl } }];
        }
      }
      messages.push({ role: 'user', content: newContent });
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

    function currentTargetEntry() {
      var selectEl = document.getElementById('ai-chat-target');
      if (!selectEl || !selectEl.value) return null;
      var colonIndex = selectEl.value.indexOf(':');
      var backend = selectEl.value.slice(0, colonIndex);
      var id = selectEl.value.slice(colonIndex + 1);
      return AVAILABLE.filter(function (e) { return e.backend === backend && e.id === id; })[0] || null;
    }

    // Only visible when the currently selected model is vision-capable —
    // sending an image to a model that can't use it would be pointless.
    function updateAttachVisibility() {
      var entry = currentTargetEntry();
      var attachEl = document.getElementById('ai-chat-attach');
      var visionCapable = !!(entry && entry.visionCapable);
      if (attachEl) attachEl.hidden = !visionCapable;
      if (!visionCapable) clearAttachment();
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
      '<div id="ai-chat-target-row" class="stat-tile wide">' +
        '<label>Model: <select id="ai-chat-target">' +
          (AVAILABLE.length === 0
            ? '<option value="">(none available)</option>'
            : AVAILABLE.map(function (e) {
                return '<option value="' + escapeHtml(e.backend + ':' + e.id) + '">' + escapeHtml(e.label) + '</option>';
              }).join('')) +
        '</select></label>' +
        (AVAILABLE.length === 0 ? ' <span class="job-start-error">No AI backend available — configure one in AI Manager.</span>' : '') +
      '</div>' +
      '<div id="ai-chat-history"></div>' +
      '<div id="ai-chat-attach" hidden>' +
        '<label>Attach image: <select id="ai-chat-attach-select"><option value="">(none)</option></select></label> ' +
        '<img id="ai-chat-attach-preview" style="display:none; max-height:60px; vertical-align:middle; border-radius:4px;">' +
      '</div>' +
      '<form id="ai-chat-form" class="start-job-form">' +
        '<input type="text" id="ai-chat-prompt" placeholder="Ask something…" style="flex:1">' +
        '<button type="submit"' + (AVAILABLE.length === 0 ? ' disabled' : '') + '>Send</button>' +
      '</form>' +
      '<div id="ai-chat-error" class="job-start-error"></div>';

    api.addTitlebarLink('app/aiManager');

    document.getElementById('ai-chat-target').addEventListener('change', updateAttachVisibility);

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

    function formatDuration(ms) {
      if (ms == null) return '';
      return ms < 1000 ? (ms + 'ms') : ((ms / 1000).toFixed(1) + 's');
    }

    function renderHistory() {
      var historyEl = document.getElementById('ai-chat-history');
      historyEl.innerHTML = conversation.exchanges.map(function (exchange) {
        // Old exchanges (pre-single-select) had multiple targets/responses
        // per exchange — rendered exactly as before so existing history
        // stays readable; only new exchanges use the single-target shape.
        if (exchange.targets) {
          var responsesHtml = exchange.targets.map(function (target) {
            var response = exchange.responses.filter(function (r) { return r.target === target; })[0];
            var label = target.replace(/^[^:]+:/, '');
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
        }

        var label = (exchange.target || '').replace(/^[^:]+:/, '');
        var response = exchange.response;
        var body = !response
          ? '<div class="ai-chat-pending">thinking…</div>'
          : response.error
            ? '<div class="ai-chat-error-text">' + escapeHtml(response.error) + '</div>'
            : '<div class="ai-chat-text">' + escapeHtml(response.text) + '</div>';
        var targetLabel = escapeHtml(label) +
          (response && response.durationMs != null ? ' <span class="ai-chat-duration">(' + formatDuration(response.durationMs) + ')</span>' : '');

        return '<div class="ai-chat-exchange">' +
          (exchange.image ? '<img class="ai-chat-attached-image" src="/' + escapeHtml(exchange.image) + '">' : '') +
          '<div class="ai-chat-prompt">' + escapeHtml(exchange.prompt) + '</div>' +
          '<div class="ai-chat-response"><div class="ai-chat-target">' + targetLabel + '</div>' + body + '</div>' +
          '</div>';
      }).join('') || '<div class="ai-chat-empty">(no messages yet)</div>';
      historyEl.scrollTop = historyEl.scrollHeight;
    }

    // Normalizes each backend's raw response shape into one consistent
    // {text} or {error} result, so sendPrompt's dispatch doesn't need to
    // know either shape.
    function extractLmStudioText(chatBody) {
      var choice = chatBody.choices && chatBody.choices[0];
      var text = choice && choice.message && choice.message.content;
      if (chatBody.error || !text) return { error: chatBody.error || 'empty response' };
      return { text: text };
    }

    function extractClaudeText(body) {
      if (body.error) return { error: body.error.message || JSON.stringify(body.error) };
      var block = (body.content || []).filter(function (b) { return b.type === 'text'; })[0];
      if (!block || !block.text) return { error: 'empty response' };
      return { text: block.text };
    }

    function sendPrompt(prompt) {
      var target = document.getElementById('ai-chat-target').value;
      var errorEl = document.getElementById('ai-chat-error');
      errorEl.textContent = '';
      if (!target) {
        errorEl.textContent = 'No model available to send to — configure one in AI Manager.';
        return;
      }

      var colonIndex = target.indexOf(':');
      var backend = target.slice(0, colonIndex);
      var model = target.slice(colonIndex + 1);

      var exchange = {
        id: 'exchange_' + Date.now(),
        timestamp: Date.now(),
        prompt: prompt,
        target: target,
      };
      if (attachedImagePath) exchange.image = attachedImagePath; // path only — never the bytes
      conversation.exchanges.push(exchange);
      saveConversation();
      renderHistory();
      clearAttachment();

      // Base64 conversion happens once here, in memory, only for this one
      // outgoing send — never persisted. Fetches the already-servable
      // static file (the same route Media Launcher already relies on) as a
      // blob and reads it as a data URL.
      var imageDataUrlPromise = exchange.image
        ? fetch('/' + exchange.image).then(function (r) { return r.blob(); }).then(blobToDataUrl)
        : Promise.resolve(null);

      imageDataUrlPromise.then(function (imageDataUrl) {
        var messages = buildMessagesForTarget(target, prompt, imageDataUrl, backend);
        var startedAt = Date.now();

        // Same generic api.fetchExternal either way — this caller supplies
        // the target, the per-backend request shape, and owns extracting
        // the reply from whichever raw response shape comes back. Claude's
        // secret never appears here: ${ENV:ANTHROPIC_API_KEY} is a
        // placeholder the server substitutes, allowlisted in server.js.
        var externalUrl = backend === 'claude' ? 'https://api.anthropic.com/v1/messages' : 'http://localhost:1234/v1/chat/completions';
        var proxyOptions = backend === 'claude'
          ? {
              method: 'POST',
              timeoutMs: 300000,
              headers: { 'x-api-key': '${ENV:ANTHROPIC_API_KEY}', 'anthropic-version': '2023-06-01' },
              body: { model: model, max_tokens: 1024, messages: messages },
            }
          : {
              method: 'POST',
              timeoutMs: 300000,
              body: { model: model, temperature: 0.7, messages: messages },
            };

        api.fetchExternal(externalUrl, proxyOptions)
          .then(function (rawBody) {
            var extracted = backend === 'claude' ? extractClaudeText(rawBody) : extractLmStudioText(rawBody);
            exchange.response = extracted.error
              ? { error: extracted.error, respondedAt: Date.now(), durationMs: Date.now() - startedAt }
              : { text: extracted.text, respondedAt: Date.now(), durationMs: Date.now() - startedAt };
            saveConversation();
            renderHistory();
          })
          .catch(function (err) {
            exchange.response = { error: err.message, respondedAt: Date.now(), durationMs: Date.now() - startedAt };
            saveConversation();
            renderHistory();
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

    loadMediaImages();
    renderHistory();
    updateAttachVisibility();
  },
  render: function () {}, // static once mounted, same as Text File Launcher/Text Editor
});
