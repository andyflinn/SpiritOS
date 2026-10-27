// spirit/run/shell/textEditor/textEditor.js
// THE TEXT EDITOR (goal/G41.7): any writable text file, picked, edited on the codeMirror element's edit mode, saved.
// Declared by its textEditor.json (its id, name, icon and handlesExtensions), and mounted by either shell through
// spirit.shell.activateApp, reaching it only through that and the api object mount() receives.
//
// It writes the same files on the face as at home (Andy, Q1: "same."): what the node lets it write.
//
// Client-side mirror of the node's own app-entry-script protection: catches ANY app's own script (not just this one)
// before a wasted round-trip, with a specific message instead of a generic "Forbidden".
var APP_ENTRY_SCRIPT_PATTERN = /^shell\/([^/]+)\/\1\.js$/;

// WHAT IT USES, IT LOADS ITSELF (goal/G41.3, goal/G41.7; Andy: every app bootstraps its own components, "lazy-load, is
// a tree...."): the files list and the codeMirror element, through spirit.require.
var textEditorParts = Promise.all(['shell/js/files/listElement.js', 'shell/js/codeMirror.js'].map(function (p) { return spirit.require(p); }));

// Hoisted out of mount() (rather than a closure inside it) so loadFile, below, can call the same loading logic: an app
// stays mounted across navigation, so a later "Open with" against a different file goes through loadFile instead.
// THE FILE IS PICKED WITH THE FILE SELECTOR'S DROPDOWN (goal/G29.8; Andy, 2026-10-18: "on the file selector, yes it
// exists in textEditor as well, it will be replaced with the dropdown version of our \"Files\" control."). The path
// it picked, or the one "Open with" handed over, is the one loaded and saved.
var textEditorPath = '';
// THE TEXT ON CODEMIRROR (goal/G29.12, goal/G41.7): the file is edited in the codeMirror element's edit mode, and shown
// unmarked: the marks belong to the viewer (Andy, 2026-10-18), save one way in. A file its own picker found by its
// contents opens marked with the picker's words, at that line (goal/G29.11: "i go to text editor search for files with
// peerPost in them and them open the top candidates"). A file loaded makes a fresh view.
var textEditorView = null;
function textEditorLoadPath(path, words, line) {
  // The file's text, when spirit.fs has it (goal/G40.8: the kernel's read waited in place).
  return spirit.fs.loadFile(path).then(function (content) { return textEditorShow(path, words, line, content); });
}
function textEditorShow(path, words, line, content) {
  textEditorPath = path;
  var pathEl = document.getElementById('editor-path');
  if (pathEl) pathEl.textContent = path;
  var place = document.getElementById('editor-content');
  place.innerHTML = '';
  textEditorView = null;
  return textEditorParts.then(function () {
    return window.spirit.elements.codeMirror.create(place, { mode: 'edit', text: content == null ? '' : content, words: words || '', line: line || 0, path: path });
  }).then(function (view) {
    textEditorView = view;
    document.getElementById('editor-status').textContent = content == null ? 'not found (or empty) — you can still Save to create it' : 'loaded';
  });
}

spirit.shell.activateApp({
  mount: function (container, api, params) {
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
    document.getElementById('editor-load').addEventListener('click', function () {
      textEditorLoadPath(textEditorPath);
    });

    // WHAT THE NODE ANSWERED, AND ONLY THAT (rule/19): saved once it says ok, else its own words.
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

    return textEditorParts.then(function () {
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
      // Arrived via "Open with": loaded at once; else the starting file, so the editor is never empty.
      return textEditorLoadPath(initialPath);
    });
  },
  // Called by the shell when Text Editor is already mounted and gets reopened against a different file, e.g. picked
  // from Text File Launcher's "Open with" a second time. mount() itself won't run again, so without this the newly-picked
  // file would never actually load.
  loadFile: function (path) {
    return textEditorLoadPath(path);
  },
  render: function () {}, // static once mounted
});
