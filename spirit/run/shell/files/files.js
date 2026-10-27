// Files (goal/G30.16, G30.20): a mountable wrapper over the files list element, shell/js/files/listElement.js, as a
// pane. A press opens the file in this pane, in the viewer for its kind (shell/js/textViewer.js, mediaViewer.js, both
// on fileViewer.js), at home and on the face alike; ← Files goes back.
//
// Intrinsic, so it sits in the Spirit group and its name, icon and place are locked. Its id is 'shell/files' (see
// APP_ID_RENAMES and INTRINSIC_APP_FOLDERS in js/client/shell.js).

var filesList = null;
var filesShown = null;                 // the media viewer open, dropped when another file or the list is shown
// WHAT IT USES, IT LOADS ITSELF (goal/G41.3; Andy: every app bootstraps its own components, "lazy-load, is a tree...."):
// through spirit.require, each element bringing its own.
var filesParts = Promise.all(['shell/js/files/listElement.js', 'shell/js/textViewer.js', 'shell/js/mediaViewer.js', 'shell/js/fileViewer.js']
  .map(function (p) { return spirit.require(p); }));

// A FILE OPENED IS A PAGE (goal/G40.8: back is the same for everything, the frame's): pushed on the navigation, the
// file's name the title, its viewer the whole page; no back row of its own. Popped, its media viewer is let go.
function filesShow(path, words, line) {
  var name = String(path).split('/').pop();
  window.spirit.elements.navigation.push({ title: name, mount: function (viewer) { filesView(viewer, path, words, line); },
    unmount: function () { if (filesShown) { filesShown.destroy(); filesShown = null; } } });
}
function filesView(viewer, path, words, line) {
  var E = window.spirit.elements;
  if (filesShown) { filesShown.destroy(); filesShown = null; }
  var kind = E.fileViewer.kindOf(E.fileViewer.mimeOf(path));
  if (kind === 'code') E.textViewer.create(viewer, { path: path, words: words, line: line, launcherId: 'text-file-launcher' });
  else if (kind) filesShown = E.mediaViewer.create(viewer, { path: path, launcherId: 'media-launcher' });
  else E.fileViewer.create(viewer, { path: path });

}

spirit.shell.activateApp({
  mount: function (container, api) {
    // Its list box takes the whole of its pane (goal/G40.8: space granted top-down).
    container.innerHTML = '<div data-files="list" class="fill"></div>';
    var listHost = container.querySelector('[data-files="list"]');
    return filesParts.then(function () {
      filesList = window.spirit.elements.fileList.create(listHost, {
        api: api,
        face: 'pane',
        // A file found by its contents opens at that line with the words marked (goal/G29.11).
        pick: function (row, key) { filesShow(key, row.line > 0 ? filesList.words() : '', row.line || 0); },
      });
    }, function () { listHost.textContent = 'Files could not be loaded.'; });
  },

  render: function () {},
});
