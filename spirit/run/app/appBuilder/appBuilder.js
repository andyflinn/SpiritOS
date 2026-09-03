// Dynamically loaded by index.html's discoverDynamicApps, on first launch
// only (see appBuilder.json for the name/icon this app is already declared
// under before this script ever runs). Reaches the shell only through
// spirit.shell/spirit.core.*, never through index.html's own private
// closures — same pattern as aiChat.js/textEditor.js.

if (!document.getElementById('app-builder-styles')) {
  var styleEl = document.createElement('style');
  styleEl.id = 'app-builder-styles';
  styleEl.textContent =
    '#ab-identity-error, #ab-error { min-height: 1.2em; }' +
    '.ab-file-block { margin-top: 16px; }' +
    '.ab-file-path { font-weight: 600; margin-bottom: 4px; }' +
    '.ab-confirm-banner { background: rgba(255,128,0,0.12); border-radius: 8px; padding: 10px 12px; margin-top: 8px; }' +
    '#ab-key-status { margin-top: 6px; }';
  document.head.appendChild(styleEl);
}

// A safe app folder/file basename — same camelCase shape every existing
// dynamic app already uses (aiChat, textEditor, appBuilder).
var FOLDER_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9]*$/;

// Shared between mount and render (render is a sibling function, not
// nested inside mount, and receives no api argument at all) — hoisted to
// file scope, same reasoning/pattern as typeDesigner.js, so render can
// actually refresh these instead of them freezing at whatever mount saw
// the first time this app was opened.
var appBuilderEscapeHtml = null;
var appBuilderAvailable = [];
var appBuilderIdentityOk = false;
var appBuilderTargetConfirmed = true;

function appBuilderUpdateGenerateEnabled() {
  var generateBtn = document.getElementById('ab-generate');
  if (generateBtn) generateBtn.disabled = appBuilderAvailable.length === 0 || !appBuilderIdentityOk || !appBuilderTargetConfirmed;
}

// AI Manager owns backend availability — this app just reads the shared
// status file, same as Type Designer/AI Chat. See design/decisions/
// 0005-ai-manager-and-titlebar-launchers.md. Both Claude and LM Studio
// entries are offered (same combined-target convention as AI Chat/Type
// Designer: dropdown value is "backend:id").
//
// Called at mount and again on every render (render fires on every visit
// to an already-mounted app, plus each live job tick) — mount() itself
// only ever runs once now that apps stay persistently mounted across
// navigation, so without this the list would freeze at whatever it was
// the first time this app was opened. Preserves the current selection
// across refreshes, same as renderTargetOptions inside mount.
function appBuilderRefreshModels() {
  var modelEl = document.getElementById('ab-model');
  if (!modelEl) return; // not mounted yet

  var aiStatus = null;
  try {
    var statusRaw = spirit.core.fs.loadFile('app/shared/aiStatus.json');
    aiStatus = statusRaw ? JSON.parse(statusRaw) : null;
  } catch (e) { aiStatus = null; }
  appBuilderAvailable = (aiStatus && aiStatus.available) || [];

  var prior = modelEl.value;
  modelEl.innerHTML = appBuilderAvailable.length === 0
    ? '<option value="">(none available)</option>'
    : appBuilderAvailable.map(function (e) {
        return '<option value="' + appBuilderEscapeHtml(e.backend + ':' + e.id) + '">' + appBuilderEscapeHtml(e.label) + '</option>';
      }).join('');
  if (Array.prototype.some.call(modelEl.options, function (o) { return o.value === prior; })) {
    modelEl.value = prior;
  }
  var keyStatusEl = document.getElementById('ab-key-status');
  if (keyStatusEl) {
    keyStatusEl.innerHTML = appBuilderAvailable.length === 0
      ? '⚠ no AI model available — configure in AI Manager'
      : '';
  }
  appBuilderUpdateGenerateEnabled();
}

spirit.shell.activateApp({
  mount: function (container, api) {
    var escapeHtml = api.escapeHtml;
    appBuilderEscapeHtml = escapeHtml;
    var scopedFs = api.fs;

    function loadHistory() {
      var raw = scopedFs.loadFile('history.json');
      if (raw == null) return {};
      try { return JSON.parse(raw); } catch (e) { return {}; }
    }
    // { [appId]: [{prompt, explanation, appliedAt}, ...] } — a local record
    // only (which apps this tool has touched, for the "not built with App
    // Builder" safety check), never replayed back to Claude — see
    // buildMessages, below, for why the real current file makes that
    // unnecessary.
    var history = loadHistory();
    function saveHistory() { scopedFs.saveFile('history.json', JSON.stringify(history, null, 2)); }

    // A full debug log, separate from history.json above — history is a
    // sparse, successful-Apply-only record for the safety-check; this is
    // every single Generate call, applied or not, with the complete sent
    // prompt and the complete raw API response, for tracing exactly why a
    // given generation went wrong. JSON Lines (one JSON object per line,
    // appended) rather than one growing JSON array — appending is just
    // "load current text, add a line, save," no need to parse/re-stringify
    // the whole history to add one entry.
    function appendLog(entry) {
      var raw = scopedFs.loadFile('log.jsonl') || '';
      scopedFs.saveFile('log.jsonl', raw + JSON.stringify(entry) + '\n');
    }

    // currentTarget is null for "+ New app", otherwise the real app id
    // ("app/<folder>") of an existing dynamic app being edited.
    var currentTarget = null;
    var currentFolder = null; // technical id segment — user-chosen for a new app, derived from currentTarget otherwise

    function dynamicApps() {
      return spirit.shell.listApps().filter(function (a) { return a.dynamic; });
    }

    function folderFromTargetId(id) {
      var m = /^app\/([^/]+)$/.exec(id || '');
      return m ? m[1] : null;
    }

    container.innerHTML =
      '<div class="stat-tile wide">' +
        '<label>Target app: <select id="ab-target"></select></label>' +
        '<div id="ab-confirm-banner" class="ab-confirm-banner" hidden>' +
          'This app wasn\'t built with App Builder — Claude will be editing hand-written code. ' +
          '<button type="button" class="cancel-btn" data-confirm-edit>Continue</button> ' +
          '<button type="button" class="cancel-btn" data-cancel-edit>Cancel</button>' +
        '</div>' +
        '<div id="ab-identity-fields">' +
          '<div id="ab-folder-row"><label>Folder name: <input type="text" id="ab-folder" placeholder="e.g. helloCounter"></label></div>' +
          '<label>Display name: <input type="text" id="ab-name"></label> ' +
          '<label>Icon: <input type="text" id="ab-icon" size="4"></label>' +
          '<div id="ab-identity-error" class="job-start-error"></div>' +
        '</div>' +
      '</div>' +
      '<div class="stat-tile wide">' +
        '<div class="ab-file-path">Uses types</div>' +
        '<div id="ab-types-list">(none defined yet — see Type Designer)</div>' +
      '</div>' +
      '<div class="stat-tile wide">' +
        '<label>Model: <select id="ab-model"></select></label>' +
        '<div id="ab-key-status"></div>' +
      '</div>' +
      '<div class="stat-tile wide">' +
        '<textarea id="ab-prompt" placeholder="What should this app do? Or what should change?" style="width:100%; min-height:60px; box-sizing:border-box;"></textarea>' +
        '<button type="button" id="ab-generate">Generate</button>' +
        '<div id="ab-error" class="job-start-error"></div>' +
      '</div>' +
      '<div id="ab-response"></div>' +
      '<div class="stat-tile wide"><div class="ab-file-path">Sent to Claude</div><pre class="code-view" id="ab-sent"></pre></div>';

    // ---- model select ----
    var modelEl = document.getElementById('ab-model');

    // ---- uses-types checkboxes ----
    // Types have no live shell-side registry (unlike apps, via spirit.
    // shell.listApps()) — scanned once at mount from the same raw
    // fs-watcher snapshot Type Designer itself uses. Not refreshed on
    // every target switch (matches the project's existing "not
    // live-reactive" convention for dynamic discovery elsewhere) — a
    // type created while this app stays open needs a reload to appear.
    var typesListEl = document.getElementById('ab-types-list');
    function renderTypeCheckboxes(names) {
      if (names.length === 0) return; // leave the "(none defined yet)" placeholder
      typesListEl.innerHTML = names.map(function (n) {
        return '<label style="margin-right:12px;"><input type="checkbox" class="ab-type-checkbox" value="' + escapeHtml(n) + '"> ' + escapeHtml(n) + '</label>';
      }).join('');
    }
    fetch('/api/jobs')
      .then(function (res) { return res.json(); })
      .then(function (jobs) {
        var fsWatcher = jobs.filter(function (j) { return j.type === 'fs-watcher'; })[0];
        var files = (fsWatcher && fsWatcher.data && fsWatcher.data.files) || [];
        var names = files
          .filter(function (f) { return f.kind === 'file' && /^app\/shared\/types\/[^/]+\.json$/.test(f.relativePath); })
          .map(function (f) { return f.relativePath.replace(/^app\/shared\/types\//, '').replace(/\.json$/, ''); })
          .sort();
        renderTypeCheckboxes(names);
      });

    function checkedTypes() {
      return Array.prototype.slice.call(document.querySelectorAll('.ab-type-checkbox:checked')).map(function (cb) { return cb.value; });
    }
    function setCheckedTypes(usesTypes) {
      document.querySelectorAll('.ab-type-checkbox').forEach(function (cb) {
        cb.checked = usesTypes.indexOf(cb.value) !== -1;
      });
    }

    // ---- target select ----
    var targetEl = document.getElementById('ab-target');
    function renderTargetOptions() {
      var prior = targetEl.value;
      targetEl.innerHTML = '<option value="">+ New app</option>' + dynamicApps().map(function (a) {
        return '<option value="' + escapeHtml(a.id) + '">' + escapeHtml(a.name) + '</option>';
      }).join('');
      if (Array.prototype.some.call(targetEl.options, function (o) { return o.value === prior; })) {
        targetEl.value = prior;
      }
    }
    renderTargetOptions();
    api.addTitlebarLink('app/aiManager');
    api.addTitlebarLink('app/typeDesigner');

    // Refresh right when the dropdown is about to be opened, not via a
    // background subscription — spirit.core.jobs.subscribe opens its own
    // persistent EventSource, and this page can already have several
    // (kernel.js's own debug one, shell.js's, AI Chat's if it's ever been
    // opened this session — dynamic apps stay mounted, and subscribed,
    // even while not visible). Browsers cap concurrent connections per
    // origin; a fifth one added here risks silently never getting a slot,
    // which is exactly what this replaces — it was diagnosed live: the
    // desktop icon (driven by shell.js's own, earlier-opened subscription)
    // updated correctly, but this dropdown never did. A focus-triggered,
    // connectionless refresh can't starve the same way.
    targetEl.addEventListener('focus', renderTargetOptions);
    targetEl.addEventListener('mousedown', renderTargetOptions);

    var folderRowEl = document.getElementById('ab-folder-row');
    var folderInputEl = document.getElementById('ab-folder');
    var nameInputEl = document.getElementById('ab-name');
    var iconInputEl = document.getElementById('ab-icon');
    var confirmBannerEl = document.getElementById('ab-confirm-banner');
    var identityErrorEl = document.getElementById('ab-identity-error');

    function setFormEnabled(enabled) {
      [nameInputEl, iconInputEl, folderInputEl, document.getElementById('ab-prompt')].forEach(function (el) {
        el.disabled = !enabled;
      });
      appBuilderUpdateGenerateEnabled();
    }

    function checkIdentity() {
      var name = nameInputEl.value.trim();
      var icon = iconInputEl.value.trim();
      if (!name || !icon) {
        appBuilderIdentityOk = false;
        identityErrorEl.textContent = '';
        appBuilderUpdateGenerateEnabled();
        return;
      }
      if (currentTarget === null) {
        var folder = folderInputEl.value.trim();
        if (!FOLDER_NAME_PATTERN.test(folder)) {
          appBuilderIdentityOk = false;
          identityErrorEl.textContent = folder ? 'folder name must start with a letter and contain only letters/digits' : '';
          appBuilderUpdateGenerateEnabled();
          return;
        }
        var newId = 'app/' + folder;
        if (dynamicApps().some(function (a) { return a.id === newId; })) {
          appBuilderIdentityOk = false;
          identityErrorEl.textContent = 'an app already exists at ' + newId;
          appBuilderUpdateGenerateEnabled();
          return;
        }
        currentFolder = folder;
      }
      var result = spirit.shell.checkIdentityAvailable(name, icon, currentTarget || '');
      appBuilderIdentityOk = result.ok;
      identityErrorEl.textContent = result.ok ? '' :
        (result.reason === 'name-collision' ? 'name "' + name + '" is already used by another app' : 'icon "' + icon + '" is already used by another app');
      appBuilderUpdateGenerateEnabled();
    }

    [folderInputEl, nameInputEl, iconInputEl].forEach(function (el) {
      el.addEventListener('input', checkIdentity);
    });

    // Remembers the last selection that didn't need (or already cleared)
    // the confirm banner, so Cancel can restore it rather than always
    // bouncing back to "+ New app".
    var lastGoodTarget = '';

    function loadTarget(id) {
      currentTarget = id || null;
      confirmBannerEl.hidden = true;
      appBuilderTargetConfirmed = true;

      if (currentTarget === null) {
        currentFolder = null;
        folderRowEl.hidden = false;
        folderInputEl.value = '';
        nameInputEl.value = '';
        iconInputEl.value = '';
        setCheckedTypes([]);
        setFormEnabled(true);
        checkIdentity();
        lastGoodTarget = '';
        return;
      }

      currentFolder = folderFromTargetId(currentTarget);
      folderRowEl.hidden = true;
      // Only overwrite name/icon when the app is actually found in the
      // live registry — right after a brand-new app's first Apply, the
      // fs-watcher may not have discovered it yet (this same function
      // gets called immediately post-Apply to re-sync form state), and
      // blanking already-correct fields because of that lag would be a
      // real regression, not a no-op.
      var app = dynamicApps().filter(function (a) { return a.id === currentTarget; })[0];
      if (app) {
        nameInputEl.value = app.name;
        iconInputEl.value = app.icon;
      }
      // usesTypes isn't part of the live app registry (declareDynamicApp
      // only forwards id/name/icon/hidden/handlesExtensions) — read it off
      // the raw manifest directly. Same lag-tolerance as above: only set
      // it when the manifest actually loads, never blank on a lag.
      var manifestRaw = spirit.core.fs.loadFile(currentTarget + '/' + currentFolder + '.json');
      if (manifestRaw) {
        try { setCheckedTypes(JSON.parse(manifestRaw).usesTypes || []); } catch (e) { /* malformed manifest — leave checkboxes as-is */ }
      }

      if (!history[currentTarget]) {
        appBuilderTargetConfirmed = false;
        confirmBannerEl.hidden = false;
        setFormEnabled(false);
        return; // deliberately doesn't update lastGoodTarget — Cancel should NOT land back on the unconfirmed target
      }
      setFormEnabled(true);
      checkIdentity();
      lastGoodTarget = currentTarget;
    }

    targetEl.addEventListener('change', function () { loadTarget(targetEl.value); });

    confirmBannerEl.addEventListener('click', function (event) {
      if (event.target.hasAttribute('data-confirm-edit')) {
        appBuilderTargetConfirmed = true;
        confirmBannerEl.hidden = true;
        setFormEnabled(true);
        checkIdentity();
        lastGoodTarget = currentTarget;
      } else if (event.target.hasAttribute('data-cancel-edit')) {
        targetEl.value = lastGoodTarget;
        loadTarget(lastGoodTarget);
      }
    });

    appBuilderRefreshModels();
    loadTarget('');

    // ---- prompt construction ----
    // The full contract (mount's signature, api.fs's exact shape, the
    // //FILE_BEGINNING/START/END convention, the response format) now
    // lives in one place only: preamble.md, a real, git-tracked, human-
    // readable doc — not a hand-maintained JS string here that could say
    // something different from what preamble.md says. It's loaded fresh
    // and sent verbatim; this file no longer contains its own copy of
    // that documentation at all.
    //
    // The skeleton below is just the minimal starting file for a new app —
    // still self-documenting on its own (a few inline comments on api.fs,
    // for a human who opens the generated file later and never reads
    // preamble.md), but the exhaustive spec lives in the doc, not here.
    // The modifiable zone wraps BOTH mount and render entirely (their own
    // signatures included), not just mount's inner body — a single
    // contiguous zone still, just moved outward, so validateResponse's
    // before-START/after-END check needs no change at all to cover both
    // functions. Only the surrounding activateApp({ ... }); call itself
    // is fixed.
    var SKELETON_JS = [
      '//FILE_BEGINNING',
      '//TYPE_MODULES_BEGIN',
      '//TYPE_MODULES_END',
      'spirit.shell.activateApp({',
      '',
      '//START_OF_MODIFIABLE_SECTION',
      '',
      '  // api.fs.loadFile(filename): string or null. Synchronous.',
      '  // api.fs.saveFile(filename, content): returns a Promise.',
      '  // api.fs.deleteFile(filename): returns a Promise.',
      '  // api.fs.fileStats(filename): {size, mtimeMs, birthtimeMs} or null.',
      '  // api.fs.scanDirectory(): returns a Promise of this app\'s own files.',
      '  // api.escapeHtml(str): returns str, safe to insert into innerHTML.',
      '  // api.fetchExternal(url, {method, headers, body, timeoutMs}):',
      '  //   returns a Promise of the parsed JSON response.',
      '  // Full spec: app/appBuilder/preamble.md.',
      '  mount: function (container, api, params) {',
      '    // This is where you implement the app\'s UI. The container is a',
      '    // real DOM element to render into — you may expand this with',
      '    // as much code as needed (variables, event listeners, multiple',
      '    // statements); you are not limited to replacing just this line.',
      '    container.innerHTML = \'<div class="stat-tile"><p>Do Nothing</p></div>\';',
      '  },',
      '',
      '  // Runs again on every later background live-update tick — not in',
      '  // response to anything the user did (mount\'s own event listeners',
      '  // already handle that). Almost always stays empty; give it real',
      '  // behavior only if the task genuinely needs to react to state',
      '  // changing on its own, independent of user interaction.',
      '  render: function (jobsById, params) {}',
      '',
      '//END_OF_MODIFIABLE_SECTION',
      '',
      '});',
    ].join('\n');

    // Claude never sees or produces the manifest — name/icon are already
    // fully decided (and collision-checked) by the form fields before
    // Generate is even clickable, and hidden/handlesExtensions aren't
    // something a chat request like "add a counter" has any business
    // touching. App Builder writes the manifest itself, deterministically,
    // every time Apply runs — one less thing for Claude to get wrong, and
    // one less thing for the user to ever see or think about.
    //
    // owner: 'user' here is documentation, not enforcement — saveAppManifest
    // (kernel.js) force-sets this field unconditionally server-side and
    // would silently override any other value sent here anyway. It's
    // included explicitly so this function's output is self-explanatory on
    // its own, without requiring a reader to also know what the kernel does
    // to it afterward.
    function buildManifestContent(name, icon, usesTypes) {
      return JSON.stringify({ name: name, icon: icon, hidden: false, owner: 'user', usesTypes: usesTypes }, null, 2);
    }

    // Marks the span, inside the fixed (Claude-immutable) header, where a
    // chosen type's compiled module gets concatenated — a third marker
    // pair, distinct from START/END_OF_MODIFIABLE_SECTION below, which
    // governs what Claude may edit. Placed between //FILE_BEGINNING and
    // spirit.shell.activateApp({ in SKELETON_JS (above), so it's already
    // part of the "header" validateResponse (below) diffs as one opaque
    // string — no changes needed there at all; composing this span before
    // validateResponse ever runs is what makes the diff enforce "the type
    // module came back unchanged" for free.
    var TYPE_MODULES_BEGIN = '//TYPE_MODULES_BEGIN';
    var TYPE_MODULES_END = '//TYPE_MODULES_END';

    // Replaces whatever currently sits between the markers with the
    // concatenation (alphabetical by type name, so the composed header is
    // deterministic regardless of checkbox-click order) of each checked
    // type's already-compiled module. Re-run on every Generate call, not
    // just at creation — an app's header always reflects the CURRENT
    // compiled version of whatever types it uses, never a frozen copy.
    // Falls back to inserting the marker pair fresh, right after
    // //FILE_BEGINNING, for a real file that predates this feature and
    // has no markers yet.
    // Strips comments and now-blank lines from a compiled type module
    // before it ever reaches a Claude prompt or a generated app's file.
    // Those comments explain the walker template's design to whoever
    // reads walkerTemplate.js by hand (realm-crossing instanceof, why
    // this file is a template not real code, etc.) — meaningless to
    // Claude, pure token cost once spliced in. The canonical file under
    // app/shared/types/ keeps its comments; only the copy used here is
    // trimmed. Safe as a plain per-line "//" truncation only because the
    // embedded SHAPE JSON is already guaranteed "//"-free
    // (typeDesigner.js's validateTypeTree rejects it) and the walker
    // template's own code has no "//" inside a string literal.
    function stripComments(code) {
      return code
        .split('\n')
        .map(function (line) {
          var idx = line.indexOf('//');
          return (idx === -1 ? line : line.slice(0, idx)).replace(/\s+$/, '');
        })
        .filter(function (line) { return line.trim() !== ''; })
        .join('\n');
    }

    function composeTypeModules(fileText, typeNames) {
      var sorted = typeNames.slice().sort();
      var moduleText = sorted.map(function (name) {
        var compiled = spirit.core.fs.loadFile('app/shared/types/' + name + '.compiled.js') || '';
        return stripComments(compiled);
      }).join('\n');

      var beginIdx = fileText.indexOf(TYPE_MODULES_BEGIN);
      var endIdx = fileText.indexOf(TYPE_MODULES_END);
      if (beginIdx === -1 || endIdx === -1) {
        var firstNewline = fileText.indexOf('\n');
        var insertAt = firstNewline === -1 ? fileText.length : firstNewline + 1;
        return fileText.slice(0, insertAt) + TYPE_MODULES_BEGIN + '\n' + moduleText + '\n' + TYPE_MODULES_END + '\n' + fileText.slice(insertAt);
      }
      var before = fileText.slice(0, beginIdx + TYPE_MODULES_BEGIN.length);
      var after = fileText.slice(endIdx);
      return before + '\n' + moduleText + '\n' + after;
    }

    // One uniform frame for both new and existing apps, no distinction —
    // "the file" is the skeleton for a new app, or the app's own real
    // current file (markers and all, since a prior turn's output should
    // already carry them) for an existing one. No system prompt, no JSON
    // envelope, no prior-turn history replayed: the real current file
    // already IS the authoritative record of everything previously
    // applied, so re-narrating old prompts on top of it would be
    // redundant (and, on a heavily-iterated app, an unbounded cost/
    // context-growth risk for no benefit).
    //
    // preamble.md is loaded fresh on every call (not cached in a
    // variable) so an edit to that file takes effect on the very next
    // Generate click, no reload of App Builder itself needed — the doc
    // and the prompt are the same file, not synced copies. It's expected
    // to end with a "## Current Task" heading; the live request and file
    // are appended directly after that, so the whole thing reads as one
    // continuous document, not a doc plus bolted-on scaffolding.
    //
    // Returns { messages, program } — program (the exact file text that
    // was sent) is exposed separately from the full prompt so
    // validateResponse (below) can compare the response against exactly
    // what was sent, not the whole prompt (preamble + request included).
    // program's header always carries the CURRENT compiled module for
    // every checked type (composeTypeModules, above) — recomposed on
    // every call, not just once at creation.
    function buildMessages(prompt) {
      var preamble = spirit.core.fs.loadFile('app/appBuilder/preamble.md') || '';
      var scriptPath = 'app/' + currentFolder + '/' + currentFolder + '.js';
      var program = currentTarget ? (spirit.core.fs.loadFile(scriptPath) || SKELETON_JS) : SKELETON_JS;
      program = composeTypeModules(program, checkedTypes());
      var content = preamble + '\n' + prompt + '\n\n' + program;
      return { messages: [{ role: 'user', content: content }], program: program };
    }

    // ---- response parsing ----
    // No JSON envelope in this prompt frame — Claude's response IS the
    // file, directly. Deliberately NOT post-processed or corrected beyond
    // stripping an incidental markdown code fence (a model habit, not
    // something asked for) — whatever's left is exactly what gets shown
    // and, if applied, exactly what gets written.
    // Normalizes each backend's raw response shape into one {text}/{error}
    // result before the shared fence-stripping logic below — same split
    // AI Chat/Type Designer use (extractClaudeText/extractLmStudioText).
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
      var fenceMatch = text.match(/^```(?:javascript|js)?\n([\s\S]*?)\n```$/);
      if (fenceMatch) text = fenceMatch[1];
      return { explanation: '', content: text };
    }

    // ---- validation (detect-and-block, never correct) ----
    // Verifies the response against exactly what was sent (sentProgram),
    // not a rewritten/idealized version — three checks, all pure string
    // comparison, no rewriting: the region before START_OF_MODIFIABLE_
    // SECTION must match byte-for-byte (the header didn't get dropped or
    // altered), the region from END_OF_MODIFIABLE_SECTION onward must
    // match byte-for-byte (the closing structure is intact), and the
    // response's total line count must be at least the sent header's own
    // line count (a wildly short response — song lyrics instead of a
    // file — fails this immediately). Any failure disables Apply and
    // states which check failed; it never patches the response to make
    // it pass. This is the safety net for the case the adversarial
    // testing doesn't catch, not a substitute for it.
    var START_MARKER = '//START_OF_MODIFIABLE_SECTION';
    var END_MARKER = '//END_OF_MODIFIABLE_SECTION';
    // A missing or extra blank line at either edge of these regions is not
    // a substantive change (models routinely add/drop a trailing newline)
    // — trim only leading/trailing newlines before comparing, so the
    // check still catches any real content difference in between.
    function trimEdgeNewlines(str) {
      return str.replace(/^[\r\n]+/, '').replace(/[\r\n]+$/, '');
    }
    function validateResponse(sentProgram, content) {
      var sentStartIdx = sentProgram.indexOf(START_MARKER);
      var sentEndIdx = sentProgram.indexOf(END_MARKER);
      var sentHeader = sentProgram.slice(0, sentStartIdx);
      var sentFooter = sentProgram.slice(sentEndIdx);

      var respStartIdx = content.indexOf(START_MARKER);
      var respEndIdx = content.indexOf(END_MARKER);
      if (respStartIdx === -1) return { ok: false, reason: START_MARKER + ' is missing from the response' };
      if (respEndIdx === -1) return { ok: false, reason: END_MARKER + ' is missing from the response' };

      var respHeader = content.slice(0, respStartIdx);
      var respFooter = content.slice(respEndIdx);
      if (trimEdgeNewlines(respHeader) !== trimEdgeNewlines(sentHeader)) return { ok: false, reason: 'the part before ' + START_MARKER + ' does not match what was sent' };
      if (trimEdgeNewlines(respFooter) !== trimEdgeNewlines(sentFooter)) return { ok: false, reason: 'the part from ' + END_MARKER + ' onward does not match what was sent' };

      var sentHeaderLineCount = sentHeader.split('\n').length;
      var responseLineCount = content.split('\n').length;
      if (responseLineCount < sentHeaderLineCount) return { ok: false, reason: 'the response (' + responseLineCount + ' lines) is implausibly shorter than just the header (' + sentHeaderLineCount + ' lines) — it likely isn\'t the file at all' };

      // Everything above only checks what's OUTSIDE the modifiable zone —
      // by design, nothing constrains what happens inside it. Widening
      // that zone to cover mount AND render (so both can be fully
      // customized, not just mount's inner body) means there's now
      // nothing stopping a response from silently dropping one of them
      // entirely — the shell calls app.render(...) unconditionally
      // (shell.js's switchTo), so a response missing it would still pass
      // every check above and only fail at runtime, when the app is
      // actually opened. Caught by testing this exact change before
      // asking anyone to rely on it.
      if (content.indexOf('mount:') === -1) return { ok: false, reason: 'the response has no "mount" function — the app would fail to open' };
      if (content.indexOf('render:') === -1) return { ok: false, reason: 'the response has no "render" function — the app would fail to open' };

      return { ok: true };
    }

    // ---- generate ----
    var errorEl = document.getElementById('ab-error');
    var responseEl = document.getElementById('ab-response');
    var sentEl = document.getElementById('ab-sent');

    // Wet run — the prompt frame has been reviewed and approved; real
    // calls to Claude are back on.
    var DRY_RUN = false;

    var generateBtn = document.getElementById('ab-generate');

    generateBtn.addEventListener('click', function () {
      var prompt = document.getElementById('ab-prompt').value.trim();
      errorEl.textContent = '';
      if (!prompt) { errorEl.textContent = 'Describe what the app should do.'; return; }

      var folder = currentFolder;
      var name = nameInputEl.value.trim();
      var icon = iconInputEl.value.trim();
      var colonIndex = modelEl.value.indexOf(':');
      var backend = modelEl.value.slice(0, colonIndex);
      var model = modelEl.value.slice(colonIndex + 1);

      var built = buildMessages(prompt);
      // Exactly what would be sent, no summary/reconstruction — one
      // single message, no system prompt in this frame.
      sentEl.textContent = built.messages[0].content;

      if (DRY_RUN) {
        responseEl.innerHTML = '<div class="job-manifest-note">Dry run — not sent to Claude. Review the "Sent to Claude" block above.</div>';
        return;
      }

      generateBtn.disabled = true;
      responseEl.innerHTML = '<div class="ai-chat-pending">Generating…</div>';

      // Same generic api.fetchExternal + per-backend request shape as AI
      // Chat/Type Designer — Claude's secret never appears here:
      // ${ENV:ANTHROPIC_API_KEY} is a placeholder the server substitutes.
      var externalUrl = backend === 'claude' ? 'https://api.anthropic.com/v1/messages' : 'http://localhost:1234/v1/chat/completions';
      var proxyOptions = backend === 'claude'
        ? {
            method: 'POST',
            timeoutMs: 300000,
            headers: { 'x-api-key': '${ENV:ANTHROPIC_API_KEY}', 'anthropic-version': '2023-06-01' },
            body: { model: model, max_tokens: 8192, messages: built.messages },
          }
        : {
            method: 'POST',
            timeoutMs: 300000,
            body: { model: model, temperature: 0.7, messages: built.messages },
          };

      api.fetchExternal(externalUrl, proxyOptions)
        .then(function (rawBody) {
          var parsed = parseResponse(rawBody, backend);
          var validation = parsed.error ? null : validateResponse(built.program, parsed.content);
          appendLog({
            at: Date.now(),
            target: currentTarget,
            folder: folder,
            model: model,
            sentPrompt: built.messages[0].content,
            rawResponse: rawBody,
            parseError: parsed.error || null,
            content: parsed.error ? null : parsed.content,
            validation: validation,
          });
          if (parsed.error) {
            errorEl.textContent = parsed.error;
            responseEl.innerHTML = '';
            return;
          }
          renderResponse(prompt, folder, name, icon, parsed, validation);
        })
        .catch(function (err) {
          appendLog({
            at: Date.now(),
            target: currentTarget,
            folder: folder,
            model: model,
            sentPrompt: built.messages[0].content,
            fetchError: err.message,
          });
          errorEl.textContent = err.message;
          responseEl.innerHTML = '';
        })
        .finally(function () { appBuilderUpdateGenerateEnabled(); });
    });

    // One file, one Apply — Claude only ever produces the entry script;
    // the manifest is written alongside it from the (already-validated)
    // form fields, not from anything Claude said. The response preview is
    // a plain <pre>, not an editable textarea, and not height-limited —
    // this shows Claude's raw, unedited answer for evaluation; Apply
    // writes exactly that content, untouched.
    function renderResponse(prompt, folder, name, icon, parsed, validation) {
      var scriptPath = 'app/' + folder + '/' + folder + '.js';
      responseEl.innerHTML =
        '<div class="stat-tile wide">' +
        '<div class="ab-file-path">Response from Claude</div>' +
        '<pre class="code-view">' + escapeHtml(parsed.content) + '</pre>' +
        (validation.ok ? '' : '<div class="job-start-error">Apply blocked — ' + escapeHtml(validation.reason) + '</div>') +
        '<div style="margin-top:12px;">' +
          '<button type="button" class="cancel-btn" id="ab-apply"' + (validation.ok ? '' : ' disabled') + '>Apply</button> ' +
          '<button type="button" class="cancel-btn" id="ab-reload" title="Dynamic apps only mount once per page load — reload to test selecting this app fresh from the dropdown">Reload page</button>' +
        '</div>' +
        '</div>';

      document.getElementById('ab-reload').addEventListener('click', function () { window.location.reload(); });

      if (!validation.ok) return;

      document.getElementById('ab-apply').addEventListener('click', function (event) {
        var content = parsed.content;
        var manifestPath = 'app/' + folder + '/' + folder + '.json';
        // NOTE: this write goes through saveAppManifest, which force-sets
        // owner:'user' on whatever lands on disk — including when the folder
        // already belongs to an existing system-tier app the user pointed
        // App Builder at via the confirm-banner flow. That's intentional: an
        // AI-driven edit resets an app's trust tier back to 'user' regardless
        // of what it was before; only a direct human hand-edit to the
        // manifest (outside this running server) can re-promote it to
        // 'system'.
        Promise.all([
          spirit.core.fs.saveAppScript(scriptPath, content),
          spirit.core.fs.saveAppManifest(manifestPath, buildManifestContent(name, icon, checkedTypes())),
        ]).then(function () {
          var id = currentTarget || ('app/' + folder);
          if (!history[id]) history[id] = [];
          history[id].push({ prompt: prompt, explanation: parsed.explanation, appliedAt: Date.now() });
          saveHistory();
          // Re-sync the form as if this app had just been freshly selected
          // from the dropdown — not just patching the displayed value —
          // so a second Generate click in the same session (no need to
          // leave and re-enter App Builder) is grounded on properly
          // reset state: the folder-name field hidden again (it's no
          // longer a new app), history[id] now existing so loadTarget
          // won't show the confirm banner, and identity re-validated
          // against this app's own now-real id.
          renderTargetOptions();
          targetEl.value = id;
          loadTarget(id);
          document.getElementById('ab-prompt').value = '';
          event.target.textContent = 'Applied ✓';
          event.target.disabled = true;
        });
      });
    }
  },
  render: appBuilderRefreshModels,
});
