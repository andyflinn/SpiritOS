// Files: the shell's one file tree, in the fileSelector pane (goal/G29.8). The item's box: "the Files app is a
// container for its pane". The pane draws the tree with no words and the ranked list with words, each row with its
// mimetype icon, size and modified; a press on a file opens it with whatever handles it, or says what it is.
//
// Intrinsic, so it sits in the Spirit group and its name, icon and place are locked. Its id is 'shell/files' (see
// APP_ID_RENAMES and INTRINSIC_APP_FOLDERS in js/client/shell.js).
//
// The two launchers it opens, text-file-launcher and media-launcher, are reached through api.launchApp. The viewer
// lookup itself (mimeTypeForName, classifyMimeType, CATEGORY_APP_HANDLERS) is still on spirit.shell.

var filesEscapeHtml = spirit.core.util.escapeHtml;
var filesApi = null;      // handed in at mount, kept for the press
var filesPane = null;     // the fileSelector pane mounted last
// The version of the shell's one file tree this was last drawn from (goal/G4.25): it moves only when a command changed
// the tree, so a stats tick redraws nothing.
var lastFilesVersion = null;

function filesShowDetail(name, path, mimeType) {
  var detailEl = document.getElementById('file-detail');
  if (!detailEl) return;
  detailEl.innerHTML = '<div class="stat-tile wide">' +
    '<div class="label">Name</div><div class="rows">' + filesEscapeHtml(name) + '</div>' +
    '<div class="label">Path</div><div class="rows">' + filesEscapeHtml(path) + '</div>' +
    '<div class="label">MIME type</div><div class="rows">' + filesEscapeHtml(mimeType) + '</div>' +
    '</div>';
}

spirit.shell.activateApp({
  mount: function (container, api) {
    filesApi = api;
    // mount() always wipes the pane, so the next render draws it afresh.
    lastFilesVersion = null;
    container.innerHTML = '<div id="file-detail"></div>';
    filesPane = api.ui.elements.createFileSelector({ face: 'pane' });
    container.insertBefore(filesPane, container.firstChild);
    filesPane.addEventListener('change', function () {
      var path = filesPane.value;
      var name = path.slice(path.lastIndexOf('/') + 1);
      var mimeType = spirit.shell.mimeTypeForName(name);
      var handlerId = spirit.shell.CATEGORY_APP_HANDLERS[spirit.shell.classifyMimeType(mimeType)];
      // Through api, not the global: opening another app is what step 6 gave a system app a doorway for.
      // goal/G29.11: a file found by its contents opens at that line with the words marked.
      var row = filesPane.row || {};
      if (handlerId) { filesApi.launchApp(handlerId, { path: path, words: row.line > 0 ? filesPane.words() : '', line: row.line || 0 }); return; }
      filesShowDetail(name, path, mimeType);
    });
  },

  render: function () {
    if (!filesPane) return;
    var version = spirit.shell.filesVersion();
    if (version === lastFilesVersion) return;
    lastFilesVersion = version;
    filesPane.refresh();
  },
});
