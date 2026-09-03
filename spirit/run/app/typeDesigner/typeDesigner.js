// Dynamically loaded by index.html's discoverDynamicApps, on first launch
// only (see typeDesigner.json for the name/icon this app is already
// declared under before this script ever runs). Reaches the shell only
// through spirit.shell/spirit.core.*, same pattern as appBuilder.js.
//
// Designs a named data type (a tree of fields — primitives, nested
// objects, arrays; no inheritance/composition in this first build) via
// chat with Claude, then compiles a deterministic validate/serialize/
// deserialize/createEmpty module from it — never Claude-authored — for
// App Builder to concatenate into a generated app's fixed header. See
// design/decisions/0004-type-designer-and-codebuilders.md.

if (!document.getElementById('type-designer-styles')) {
  var styleEl = document.createElement('style');
  styleEl.id = 'type-designer-styles';
  styleEl.textContent =
    '#td-identity-error, #td-error { min-height: 1.2em; }' +
    '.td-file-block { margin-top: 16px; }' +
    '.td-file-path { font-weight: 600; margin-bottom: 4px; }';
  document.head.appendChild(styleEl);
}

// The only valid primitive leaf tokens — kept in sync by hand with
// preamble.md's prose (a short, stable, rarely-changing list; "extended
// only when a real app needs one" per ADR 0004).
var PRIMITIVE_TOKENS = ['string', 'number', 'boolean', 'date'];

// Same identifier-safe shape every dynamic app folder/file basename
// already uses (see appBuilder.js's FOLDER_NAME_PATTERN) — a type name
// becomes a JS identifier fragment (__TYPE_NAME__Type) and a filename.
var TYPE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9]*$/;

// Shared between mount and render (render is a sibling function, not
// nested inside mount, and receives no api argument at all) — hoisted to
// file scope so render can actually refresh these instead of them
// freezing at whatever mount saw the first time this app was opened.
var typeDesignerEscapeHtml = null;
var typeDesignerAvailable = [];
var typeDesignerIdentityOk = false;

function typeDesignerUpdateGenerateEnabled() {
  var generateBtn = document.getElementById('td-generate');
  if (generateBtn) generateBtn.disabled = typeDesignerAvailable.length === 0 || !typeDesignerIdentityOk;
}

// AI Manager owns backend availability — this app just reads the shared
// status file, same as App Builder/AI Chat. See design/decisions/
// 0005-ai-manager-and-titlebar-launchers.md. Both Claude and LM Studio
// entries are offered (same combined-target convention as AI Chat:
// dropdown value is "backend:id") — Type Designer's prompt is
// plain-text, so unlike AI Chat there's no per-backend message-shape
// branching needed, only the send/parse logic in mount below.
//
// Called at mount and again on every render (render fires on every visit
// to an already-mounted app, plus each live job tick) — mount() itself
// only ever runs once now that apps stay persistently mounted across
// navigation, so without this the list would freeze at whatever it was
// the first time this app was opened. Preserves the current selection
// across refreshes, same as renderTargetOptions inside mount.
function typeDesignerRefreshModels() {
  var modelEl = document.getElementById('td-model');
  if (!modelEl) return; // not mounted yet

  var aiStatus = null;
  try {
    var statusRaw = spirit.core.fs.loadFile('app/shared/aiStatus.json');
    aiStatus = statusRaw ? JSON.parse(statusRaw) : null;
  } catch (e) { aiStatus = null; }
  typeDesignerAvailable = (aiStatus && aiStatus.available) || [];

  var prior = modelEl.value;
  modelEl.innerHTML = typeDesignerAvailable.length === 0
    ? '<option value="">(none available)</option>'
    : typeDesignerAvailable.map(function (e) {
        return '<option value="' + typeDesignerEscapeHtml(e.backend + ':' + e.id) + '">' + typeDesignerEscapeHtml(e.label) + '</option>';
      }).join('');
  if (Array.prototype.some.call(modelEl.options, function (o) { return o.value === prior; })) {
    modelEl.value = prior;
  }
  var availabilityEl = document.getElementById('td-availability');
  if (availabilityEl) {
    availabilityEl.innerHTML = typeDesignerAvailable.length === 0
      ? '⚠ no AI model available — configure in AI Manager'
      : '';
  }
  typeDesignerUpdateGenerateEnabled();
}

spirit.shell.activateApp({
  mount: function (container, api) {
    var escapeHtml = api.escapeHtml;
    typeDesignerEscapeHtml = escapeHtml;

    // currentTarget is null for "+ New type", otherwise the real name of
    // an existing type being edited. currentTree is the in-memory draft —
    // nothing touches disk until Save.
    var currentTarget = null;
    var currentTree = {};

    // Types have no live shell-side registry the way apps do (spirit.
    // shell.listApps()) — scanned fresh from the same raw fs-watcher
    // snapshot AI Chat/App Builder already use elsewhere in this project.
    function existingTypeNames() {
      return fetch('/api/jobs')
        .then(function (res) { return res.json(); })
        .then(function (jobs) {
          var fsWatcher = jobs.filter(function (j) { return j.type === 'fs-watcher'; })[0];
          var files = (fsWatcher && fsWatcher.data && fsWatcher.data.files) || [];
          return files
            .filter(function (f) { return f.kind === 'file' && /^app\/shared\/types\/[^/]+\.json$/.test(f.relativePath); })
            .map(function (f) { return f.relativePath.replace(/^app\/shared\/types\//, '').replace(/\.json$/, ''); })
            .sort();
        });
    }

    container.innerHTML =
      '<div class="stat-tile wide">' +
        '<label>Type: <select id="td-target"></select></label>' +
        '<div id="td-identity-fields">' +
          '<div id="td-name-row"><label>New type name: <input type="text" id="td-name" placeholder="e.g. Contact"></label></div>' +
          '<div id="td-identity-error" class="job-start-error"></div>' +
        '</div>' +
      '</div>' +
      '<div class="stat-tile wide">' +
        '<label>Model: <select id="td-model"></select></label>' +
        '<div id="td-availability"></div>' +
      '</div>' +
      '<div class="stat-tile wide"><div class="td-file-path">Current type</div><pre class="code-view" id="td-current-tree"></pre></div>' +
      '<div class="stat-tile wide">' +
        '<form id="td-form" class="start-job-form">' +
          '<input type="text" id="td-prompt" placeholder="Describe the type, or what should change" style="flex:1">' +
          '<button type="submit" id="td-generate">Generate</button>' +
        '</form>' +
        '<div id="td-error" class="job-start-error"></div>' +
      '</div>' +
      '<div id="td-response"></div>';

    api.addTitlebarLink('app/aiManager');
    api.addTitlebarLink('app/appBuilder');

    // ---- model select ----
    var modelEl = document.getElementById('td-model');

    // ---- target select ----
    var targetEl = document.getElementById('td-target');
    var nameRowEl = document.getElementById('td-name-row');
    var nameInputEl = document.getElementById('td-name');
    var identityErrorEl = document.getElementById('td-identity-error');
    var currentTreeEl = document.getElementById('td-current-tree');
    var responseEl = document.getElementById('td-response');
    var errorEl = document.getElementById('td-error');

    function renderCurrentTree() {
      currentTreeEl.textContent = JSON.stringify(currentTree, null, 2);
    }

    function checkIdentity(existingNames) {
      if (currentTarget !== null) { typeDesignerIdentityOk = true; identityErrorEl.textContent = ''; typeDesignerUpdateGenerateEnabled(); return; }
      var name = nameInputEl.value.trim();
      if (!TYPE_NAME_PATTERN.test(name)) {
        typeDesignerIdentityOk = false;
        identityErrorEl.textContent = name ? 'type name must start with a letter and contain only letters/digits' : '';
        typeDesignerUpdateGenerateEnabled();
        return;
      }
      if (existingNames.indexOf(name) !== -1) {
        typeDesignerIdentityOk = false;
        identityErrorEl.textContent = 'a type named "' + name + '" already exists';
        typeDesignerUpdateGenerateEnabled();
        return;
      }
      typeDesignerIdentityOk = true;
      identityErrorEl.textContent = '';
      typeDesignerUpdateGenerateEnabled();
    }

    // No rename in v1 — same "immutable once chosen" precedent as an
    // app's own folder id (App Builder). Editing an existing type just
    // hides the name field; it's fixed to currentTarget.
    function loadTarget(name) {
      currentTarget = name;
      nameRowEl.hidden = name !== null;
      responseEl.innerHTML = '';
      errorEl.textContent = '';
      if (name === null) {
        currentTree = {};
        renderCurrentTree();
        nameInputEl.value = '';
        existingTypeNames().then(checkIdentity);
        return;
      }
      var raw = spirit.core.fs.loadFile('app/shared/types/' + name + '.json');
      try { currentTree = raw ? JSON.parse(raw) : {}; } catch (e) { currentTree = {}; }
      renderCurrentTree();
      typeDesignerIdentityOk = true;
      typeDesignerUpdateGenerateEnabled();
    }

    function renderTargetOptions() {
      existingTypeNames().then(function (names) {
        var prior = targetEl.value;
        targetEl.innerHTML = '<option value="">+ New type</option>' + names.map(function (n) {
          return '<option value="' + escapeHtml(n) + '">' + escapeHtml(n) + '</option>';
        }).join('');
        if (Array.prototype.some.call(targetEl.options, function (o) { return o.value === prior; })) {
          targetEl.value = prior;
        }
      });
    }

    targetEl.addEventListener('change', function () { loadTarget(targetEl.value || null); });
    // Same reasoning as App Builder's own target dropdown: refresh right
    // when it's about to be opened, not via a background subscription —
    // avoids the EventSource connection-starvation issue already
    // diagnosed live for that dropdown.
    targetEl.addEventListener('focus', renderTargetOptions);
    targetEl.addEventListener('mousedown', renderTargetOptions);
    nameInputEl.addEventListener('input', function () { existingTypeNames().then(checkIdentity); });

    typeDesignerRefreshModels();
    renderTargetOptions();
    loadTarget(null);

    // ---- format validation: structural, deterministic, never corrects ----
    // Rejects any leaf/key token containing "//" as a side effect of
    // walking every string value anyway — closes the (very unlikely)
    // theoretical case of a field name colliding with App Builder's
    // marker-search text before it could ever reach that far downstream.
    function validateTypeTree(value) {
      var MARKER_LIKE = /\/\//;
      function walk(node, path) {
        if (Array.isArray(node)) {
          if (node.length !== 1) return path + ': an array must contain exactly one element describing the item shape';
          return walk(node[0], path + '[0]');
        }
        if (node && typeof node === 'object') {
          var keys = Object.keys(node);
          for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (MARKER_LIKE.test(key)) return path + '.' + key + ': field names may not contain "//"';
            var err = walk(node[key], path + '.' + key);
            if (err) return err;
          }
          return null;
        }
        if (typeof node === 'string') {
          if (MARKER_LIKE.test(node)) return path + ': value may not contain "//"';
          if (PRIMITIVE_TOKENS.indexOf(node) === -1) return path + ': "' + node + '" is not a valid primitive token (' + PRIMITIVE_TOKENS.join('/') + ')';
          return null;
        }
        return path + ': expected a primitive token, object, or single-element array';
      }
      if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, reason: 'the top level must be a plain object' };
      var error = walk(value, '(root)');
      return error ? { ok: false, reason: error } : { ok: true };
    }

    // ---- compiler: substitutes the one hand-written, generic walker ----
    // Never Claude-authored — see walkerTemplate.js. Loaded fresh every
    // call (unscoped: app/typeDesigner/ is this app's own folder, but the
    // template is a sibling asset, not per-instance data).
    function compileModule(typeName, tree) {
      var template = spirit.core.fs.loadFile('app/typeDesigner/walkerTemplate.js');
      return template
        .replace(/__TYPE_NAME__/g, typeName)
        .replace('"__SHAPE_JSON__"', JSON.stringify(tree));
    }

    // ---- prompt construction: current tree + request, JSON back, no
    // markers (a type tree has no fixed wrapper the way an app file
    // does — the whole thing is what's being designed) ----
    function buildMessages(prompt) {
      var preamble = spirit.core.fs.loadFile('app/typeDesigner/preamble.md') || '';
      var content = preamble + '\n' + JSON.stringify(currentTree) + '\n\n' + prompt;
      return { messages: [{ role: 'user', content: content }] };
    }

    // Normalizes each backend's raw response shape into one {text}/{error}
    // result before the shared JSON-fence-stripping/parse logic below —
    // same split AI Chat uses (extractClaudeText/extractLmStudioText).
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

    function parseResponse(rawBody, backend) {
      var extracted = backend === 'claude' ? extractClaudeText(rawBody) : extractLmStudioText(rawBody);
      if (extracted.error) return { error: extracted.error };
      var text = extracted.text.trim();
      var fenceMatch = text.match(/^```(?:json)?\n([\s\S]*?)\n```$/);
      if (fenceMatch) text = fenceMatch[1];
      var parsed;
      try { parsed = JSON.parse(text); } catch (e) { return { error: 'response is not valid JSON: ' + e.message }; }
      return { tree: parsed };
    }

    function renderResponse(typeName, proposedTree) {
      var compiled = compileModule(typeName, proposedTree);
      responseEl.innerHTML =
        '<div class="stat-tile wide td-file-block">' +
          '<div class="td-file-path">Proposed type</div>' +
          '<pre class="code-view">' + escapeHtml(JSON.stringify(proposedTree, null, 2)) + '</pre>' +
          '<button type="button" class="cancel-btn" id="td-save">Save</button>' +
        '</div>' +
        '<div class="stat-tile wide td-file-block">' +
          '<div class="td-file-path">Compiled module preview — exactly what Save will write</div>' +
          '<pre class="code-view">' + escapeHtml(compiled) + '</pre>' +
        '</div>';

      document.getElementById('td-save').addEventListener('click', function () {
        Promise.all([
          spirit.core.fs.saveFile('app/shared/types/' + typeName + '.json', JSON.stringify(proposedTree, null, 2)),
          spirit.core.fs.saveFile('app/shared/types/' + typeName + '.compiled.js', compiled),
        ]).then(function () {
          currentTarget = typeName;
          currentTree = proposedTree;
          renderCurrentTree();
          renderTargetOptions();
          nameRowEl.hidden = true;
          document.getElementById('td-prompt').value = '';
          responseEl.innerHTML = '';
        });
      });
    }

    document.getElementById('td-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var promptInput = document.getElementById('td-prompt');
      var prompt = promptInput.value.trim();
      errorEl.textContent = '';
      if (!prompt) { errorEl.textContent = 'Describe the type, or what should change.'; return; }
      promptInput.value = '';
      promptInput.focus(); // stays ready for the next request immediately, no re-click needed

      var typeName = currentTarget !== null ? currentTarget : nameInputEl.value.trim();
      var colonIndex = modelEl.value.indexOf(':');
      var backend = modelEl.value.slice(0, colonIndex);
      var model = modelEl.value.slice(colonIndex + 1);
      var built = buildMessages(prompt);

      document.getElementById('td-generate').disabled = true;
      responseEl.innerHTML = '<div class="ai-chat-pending">Generating…</div>';

      // Same generic api.fetchExternal + per-backend request shape as AI
      // Chat's sendPrompt — Claude's secret never appears here:
      // ${ENV:ANTHROPIC_API_KEY} is a placeholder the server substitutes.
      var externalUrl = backend === 'claude' ? 'https://api.anthropic.com/v1/messages' : 'http://localhost:1234/v1/chat/completions';
      var proxyOptions = backend === 'claude'
        ? {
            method: 'POST',
            timeoutMs: 300000,
            headers: { 'x-api-key': '${ENV:ANTHROPIC_API_KEY}', 'anthropic-version': '2023-06-01' },
            body: { model: model, max_tokens: 4096, messages: built.messages },
          }
        : {
            method: 'POST',
            timeoutMs: 300000,
            body: { model: model, temperature: 0.7, messages: built.messages },
          };

      api.fetchExternal(externalUrl, proxyOptions)
        .then(function (rawBody) {
          var parsed = parseResponse(rawBody, backend);
          if (parsed.error) {
            errorEl.textContent = parsed.error;
            responseEl.innerHTML = '';
            return;
          }
          var validation = validateTypeTree(parsed.tree);
          if (!validation.ok) {
            errorEl.textContent = 'Rejected — ' + validation.reason;
            responseEl.innerHTML = '';
            return;
          }
          renderResponse(typeName, parsed.tree);
        })
        .catch(function (err) {
          errorEl.textContent = err.message;
          responseEl.innerHTML = '';
        })
        .finally(function () { typeDesignerUpdateGenerateEnabled(); });
    });
  },
  render: typeDesignerRefreshModels,
});
