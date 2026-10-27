// Media Viewer (goal/G30.20): a mountable wrapper over two shell elements, the files list as a dropdown
// (shell/js/files/listElement.js) showing only what the mediaViewer plays (images, audio, video), and the mediaViewer
// element (shell/js/mediaViewer.js) under it. A pick drops the file shown before and plays the new one.

var mediaViewerShown = null;
// WHAT IT USES, IT LOADS ITSELF (goal/G41.3; Andy: every app bootstraps its own components, "lazy-load, is a tree...."):
// through spirit.require, each element bringing its own.
var mediaViewerParts = Promise.all(['shell/js/files/listElement.js', 'shell/js/mediaViewer.js', 'shell/js/fileViewer.js']
  .map(function (p) { return spirit.require(p); }));

spirit.shell.activateApp({
  mount: function (container, api) {
    container.innerHTML = '<div class="stat-tile wide"><div data-media="pick"></div><div data-media="viewer" style="margin-top:1em"></div></div>';
    var viewer = container.querySelector('[data-media="viewer"]');
    return mediaViewerParts.then(function () {
      var E = window.spirit.elements;
      E.fileList.create(container.querySelector('[data-media="pick"]'), {
        api: api,
        face: 'dropdown',
        placeholder: 'choose a picture, song or video…',
        accept: function (row) { var kind = E.fileViewer.kindOf(E.fileViewer.mimeOf(row.path)); return !!kind && kind !== 'code'; },
        pick: function (row, key) {
          if (!row || row.kind !== 'file') return;
          if (mediaViewerShown) { mediaViewerShown.destroy(); mediaViewerShown = null; }
          mediaViewerShown = E.mediaViewer.create(viewer, { path: key, launcherId: 'media-launcher' });
        },
      });
    }, function () { viewer.textContent = 'The media viewer could not be loaded.'; });
  },

  render: function () {},
});
