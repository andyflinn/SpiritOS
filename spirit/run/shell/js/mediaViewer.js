// spirit/run/shell/js/mediaViewer.js
// AN IMAGE, A SOUND OR A VIDEO, SHOWN (goal/G30.16), on fileViewer.
//
//   mediaViewer.create(host, { path, launcherId }) -> { destroy() }
//
// AT HOME the browser fetches the file from the node itself (src="/<path>"), streaming as it always has.
// ON A FACE there is no address for a file on the home node: its bytes come through the sealed link, piece by piece
// (fileViewer.read). The box: it plays as the pieces arrive, each fed to the player as it opens. A sound or video in a
// format the browser can start from its first pieces goes through MediaSource; one it cannot (an MP4 with its index at
// the end) plays once complete, from memory. The pieces stay while the viewer is open, so playing again plays from
// memory; destroy() (or the next file) drops them.
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (goal/G41.3; Andy: "lazy-load, is a tree...."): its tree, through spirit.require.
  if (window.spirit.require) ['shell/js/fileViewer.js'].forEach(function (p) { window.spirit.require(p); });

  function tagFor(kind) { return kind === 'audio' ? 'audio' : kind === 'video' ? 'video' : 'img'; }

  function create(host, opts) {
    var o = opts || {};
    var path = String(o.path || '');
    var FV = E.fileViewer;
    var frame = FV.create(host, { path: path, launcherId: o.launcherId });
    var body = frame.slot('body');
    var mime = FV.mimeOf(path);
    var tag = tagFor(FV.kindOf(mime));
    var urls = [];
    var live = true;
    var el = document.createElement(tag);
    el.className = 'media-view';
    if (tag !== 'img') el.controls = true;
    body.appendChild(el);
    function url(blobOrSource) { var u = URL.createObjectURL(blobOrSource); urls.push(u); return u; }

    if (!window.spirit.transport || typeof window.spirit.transport.file !== 'function') {
      el.src = '/' + encodeURI(path);
    } else if (tag !== 'img' && window.MediaSource && MediaSource.isTypeSupported(mime)) {
      // PLAYED AS IT ARRIVES: each opened piece appended in order; a format MediaSource refuses part-way falls back to
      // the whole file, from memory, when the last piece is in.
      var source = new MediaSource();
      var queue = [];
      var buffer = null;
      var failed = false;
      var ended = false;
      el.src = url(source);
      function feed() {
        if (!buffer || buffer.updating || failed) return;
        if (queue.length) { try { buffer.appendBuffer(queue.shift()); } catch (e) { failed = true; } return; }
        if (ended && source.readyState === 'open') { try { source.endOfStream(); } catch (e) { /* already ended */ } }
      }
      source.addEventListener('sourceopen', function () {
        try { buffer = source.addSourceBuffer(mime); } catch (e) { failed = true; return; }
        buffer.addEventListener('updateend', feed);
        buffer.addEventListener('error', function () { failed = true; });
        feed();
      });
      FV.read(path, function (piece) { if (live) { queue.push(piece); feed(); } }).then(function (r) {
        ended = true;
        if (!live) return;
        if (failed) el.src = url(new Blob([r.bytes], { type: mime }));
        else feed();
      });
    } else {
      // An image, or a format MediaSource cannot take: shown once the last piece is in.
      FV.read(path).then(function (r) { if (live && r.status === 200) el.src = url(new Blob([r.bytes], { type: mime })); });
    }

    return {
      slot: frame.slot,
      destroy: function () {
        live = false;
        try { el.removeAttribute('src'); if (typeof el.load === 'function') el.load(); } catch (e) { /* gone */ }
        urls.forEach(function (u) { URL.revokeObjectURL(u); });
        urls = [];
      },
    };
  }

  E.mediaViewer = { create: create };
}());
