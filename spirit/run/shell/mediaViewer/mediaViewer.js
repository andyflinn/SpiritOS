// Media Viewer (goal/G30.20): a mountable wrapper over the media app's element, spirit/app/media/media.js (goal/G43.17), which
// with no file handed in shows the files list as a dropdown of what it plays, and under it the file picked. Old may require
// new; G43.16 moves this app there.

var mediaViewerShown = null;
// WHAT IT USES, IT LOADS ITSELF (goal/G41.3; Andy: every app bootstraps its own components, "lazy-load, is a tree....").
var mediaViewerParts = spirit.require('spirit/app/media/media.js');

spirit.shell.activateApp({
  mount: function (container) {
    container.innerHTML = '<div class="stat-tile wide fill"></div>';
    var box = container.firstChild;
    return Promise.resolve(mediaViewerParts).then(function () {
      if (mediaViewerShown) mediaViewerShown.destroy();
      mediaViewerShown = window.spirit.elements.media.create(box);
    }, function () { box.textContent = 'The media viewer could not be loaded.'; });
  },

  render: function () {},
});
