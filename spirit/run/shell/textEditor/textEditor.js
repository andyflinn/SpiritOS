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
var APP_ENTRY_SCRIPT_PATTERN = /^shell\/([^/]+)\/\1\.js$/;

// Hoisted out of mount() (rather than a closure inside it) so loadFile,
// below, can call the same loading logic — mount() only ever runs once
// per app now (shell.js keeps apps mounted across navigation), so a later
// "Open with" against a different file has to go through loadFile instead.
// THE FILE IS PICKED WITH THE FILE SELECTOR'S DROPDOWN (goal/G29.8; Andy, 2026-10-18: "on the file selector, yes it
// exists in textEditor as well, it will be replaced with the dropdown version of our \"Files\" control."). The path
// it picked, or the one "Open with" handed over, is the one loaded and saved.
var textEditorPath = '';
// THE TEXT ON CODEMIRROR (goal/G29.12): the file is edited in the shell's text view, its plain text area gone, and
// shown unmarked: the marks belong to the viewer (Andy, 2026-10-18), save one way in. A file its own picker found by
// its contents opens marked with the picker's words, at that line (goal/G29.11: "i go to text editor search for files
// with peerPost in them and them open the top candidates"). A file loaded makes a fresh view.
var textEditorApi = null;
var textEditorView = null;
function textEditorLoadPath(path, words, line) {
  // The file's text, when spirit.fs has it (goal/G40.8: the kernel's read waited in place).
  return spirit.fs.loadFile(path).then(function (content) { textEditorShow(path, words, line, content); });
}
function textEditorShow(path, words, line, content) {
  textEditorPath = path;
  var pathEl = document.getElementById('editor-path');
  if (pathEl) pathEl.textContent = path;
  var place = document.getElementById('editor-content');
  place.innerHTML = '';
  textEditorView = textEditorApi.ui.elements.createTextView(place, { text: content == null ? '' : content, words: words || '', line: line || 0, path: path });
  document.getElementById('editor-status').textContent = content == null ? 'not found (or empty) — you can still Save to create it' : 'loaded';
}

spirit.shell.activateApp({
  mount: function (container, api, params) {
    textEditorApi = api;
    var initialPath = (params && params.path) || 'shell/textEditor/notes.txt';
    textEditorPath = initialPath;
    container.innerHTML =
      '<div class="stat-tile wide">' +
        '<span id="editor-picker"></span> <span id="editor-path" class="file-path">' + api.escapeHtml(initialPath) + '</span> ' +
        '<button type="button" id="editor-load">Load</button>' +
        '<button type="button" id="editor-save">Save</button>' +
        '<span id="editor-status"></span>' +
      '</div>' +
      '<div id="editor-content" class="text-view"></div>';

    var statusEl = document.getElementById('editor-status');
    // Its text types only (goal/G29.8: "A file dropdown takes a hidden type filter the app configures").
    // The files list as a dropdown (goal/G30.20, shell/js/files/listElement.js).
    var picker = window.spirit.elements.fileList.create(document.getElementById('editor-picker'), {
      api: api,
      face: 'dropdown',
      accept: ['text/', 'application/json', 'application/javascript', '.md'],
      placeholder: 'open a file…',
      pick: function (row, key) {
        if (!row || row.kind !== 'file') return;
        // Found by its contents: opened marked with the picker's words, at its line.
        var contentsHit = row.line > 0;
        textEditorLoadPath(key, contentsHit ? picker.words() : '', contentsHit ? row.line : 0);
      },
    });

    document.getElementById('editor-load').addEventListener('click', function () {
      textEditorLoadPath(textEditorPath);
    });

    document.getElementById('editor-save').addEventListener('click', function () {
      var path = textEditorPath;
      if (APP_ENTRY_SCRIPT_PATTERN.test(path)) {
        statusEl.textContent = 'refusing to save over an app\'s own source (' + path + ') — the server would reject this anyway';
        return;
      }
      var content = textEditorView ? textEditorView.value() : '';
      statusEl.textContent = 'saving…';
      spirit.fs.saveFile(path, content)
        .then(function (r) { statusEl.textContent = r && r.ok === false ? 'save failed: ' + (r.reason || 'refused') : 'saved'; })
        .catch(function (err) { statusEl.textContent = 'save failed: ' + err.message; });
    });

    // Arrived via "Open with": loaded at once; else the starting file, so the editor is never empty.
    textEditorLoadPath(initialPath);
  },
  // Called by the shell when Text Editor is already mounted and gets
  // reopened against a different file — e.g. picked from Text File Launcher's
  // "Open with" a second time. mount() itself won't run again, so without
  // this the newly-picked file would never actually load.
  loadFile: function (path) {
    textEditorLoadPath(path);
  },
  render: function () {}, // static once mounted, same as Text File Launcher
});
