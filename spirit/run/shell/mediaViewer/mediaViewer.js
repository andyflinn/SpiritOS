// Media Viewer (goal/G30.20): a mountable wrapper over two shell elements, the files list as a dropdown
// (shell/js/files/listElement.js) showing only what the mediaViewer plays (images, audio, video), and the mediaViewer
// element (shell/js/mediaViewer.js) under it. A pick drops the file shown before and plays the new one.

var mediaViewerShown = null;

spirit.shell.activateApp({
  mount: function (container, api) {
    var E = window.spiritElements;
    container.innerHTML = '<div class="stat-tile wide"><div data-media="pick"></div><div data-media="viewer" style="margin-top:1em"></div></div>';
    var viewer = container.querySelector('[data-media="viewer"]');
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
  },

  render: function () {},
});
