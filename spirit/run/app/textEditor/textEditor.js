// Dynamically loaded by index.html's discoverDynamicApps, on first launch
// only (see textEditor.json for the id/name/icon/handlesExtensions this app
// is already declared under before this script ever runs). Runs as a
// separate top-level script, so it reaches the shell only through
// spirit.shell.activateApp and the api object mount() receives (fs,
// escapeHtml, fetchExternal) — never through index.html's own private
// closures.
//
// Client-side mirror of the kernel's own app-entry-script protection
// (kernel.js's APP_ENTRY_SCRIPT_PATTERN) — catches ANY app's own script
// (not just this one) before a wasted network round-trip, with a specific
// message instead of a generic "Forbidden".
var APP_ENTRY_SCRIPT_PATTERN = /^app\/([^/]+)\/\1\.js$/;

spirit.shell.activateApp({
  mount: function (container, api, params) {
    var initialPath = (params && params.path) || 'app/textEditor/notes.txt';
    container.innerHTML =
      '<div class="stat-tile wide">' +
        '<label>Path (relative to project root)<input type="text" id="editor-path" placeholder="e.g. app/notes/todo.txt" value="' + api.escapeHtml(initialPath) + '"></label>' +
        '<button type="button" id="editor-load">Load</button>' +
        '<button type="button" id="editor-save">Save</button>' +
        '<span id="editor-status"></span>' +
      '</div>' +
      '<textarea id="editor-content" class="code-view" rows="24"></textarea>';

    var statusEl = document.getElementById('editor-status');

    function loadPath(path) {
      var content = spirit.core.fs.loadFile(path);
      document.getElementById('editor-content').value = content == null ? '' : content;
      statusEl.textContent = content == null ? 'not found (or empty) — you can still Save to create it' : 'loaded';
    }

    document.getElementById('editor-load').addEventListener('click', function () {
      loadPath(document.getElementById('editor-path').value.trim());
    });

    document.getElementById('editor-save').addEventListener('click', function () {
      var path = document.getElementById('editor-path').value.trim();
      if (APP_ENTRY_SCRIPT_PATTERN.test(path)) {
        statusEl.textContent = 'refusing to save over an app\'s own source (' + path + ') — the server would reject this anyway';
        return;
      }
      var content = document.getElementById('editor-content').value;
      statusEl.textContent = 'saving…';
      spirit.core.fs.saveFile(path, content)
        .then(function () { statusEl.textContent = 'saved'; })
        .catch(function (err) { statusEl.textContent = 'save failed: ' + err.message; });
    });

    if (params && params.path) loadPath(params.path); // arrived via "Open with" — load immediately, don't wait for a manual click
  },
  render: function () {}, // static once mounted, same as Code Viewer
});
