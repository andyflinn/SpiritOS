// Files (goal/G30.16, G30.20): a mountable wrapper over the files list element, shell/js/files/listElement.js, as a
// pane. A press opens the file in this pane, in the viewer for its kind (shell/js/textViewer.js, mediaViewer.js, both
// on fileViewer.js), at home and on the face alike; ← Files goes back.
//
// Intrinsic, so it sits in the Spirit group and its name, icon and place are locked. Its id is 'shell/files' (see
// APP_ID_RENAMES and INTRINSIC_APP_FOLDERS in js/client/shell.js).

var filesList = null;
var filesShown = null;                 // the media viewer open, dropped when another file or the list is shown

function filesShow(host, listHost, path, words, line) {
  var E = window.spiritElements;
  if (filesShown) { filesShown.destroy(); filesShown = null; }
  listHost.hidden = true;
  host.hidden = false;
  host.innerHTML = '<button type="button" class="cancel-btn" data-files="back">← Files</button><div data-files="viewer"></div>';
  var viewer = host.querySelector('[data-files="viewer"]');
  var kind = E.fileViewer.kindOf(E.fileViewer.mimeOf(path));
  if (kind === 'code') E.textViewer.create(viewer, { path: path, words: words, line: line, launcherId: 'text-file-launcher' });
  else if (kind) filesShown = E.mediaViewer.create(viewer, { path: path, launcherId: 'media-launcher' });
  else E.fileViewer.create(viewer, { path: path });
  host.querySelector('[data-files="back"]').addEventListener('click', function () {
    if (filesShown) { filesShown.destroy(); filesShown = null; }
    host.hidden = true;
    host.innerHTML = '';
    listHost.hidden = false;
  });
}

spirit.shell.activateApp({
  mount: function (container, api) {
    container.innerHTML = '<div data-files="list"></div><div data-files="file" hidden></div>';
    var listHost = container.querySelector('[data-files="list"]');
    var fileHost = container.querySelector('[data-files="file"]');
    filesList = window.spiritElements.fileList.create(listHost, {
      api: api,
      face: 'pane',
      // A file found by its contents opens at that line with the words marked (goal/G29.11).
      pick: function (row, key) { filesShow(fileHost, listHost, key, row.line > 0 ? filesList.words() : '', row.line || 0); },
    });
  },

  render: function () {},
});
