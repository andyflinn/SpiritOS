// spirit/run/spirit/app/media/media.js
// MEDIA, AN ELEMENT (goal/G43.17; the box: "Four elements: file, fstat, text and media", and "text and media take a file when
// mounted: with one they show no file picker, without one they show it"). An image, a sound or a video, in fstat's pane. It took
// over what the old media viewer element did, which is gone (Q7). Its contract and its test: ./test/media.md and ./test/media.js.
//
//   spirit.elements.media.create(container, { path }) -> { destroy() }
//
// AT HOME the browser fetches the file from the node itself (src="/<path>"), streaming as it always has.
// ON A FACE there is no address for a file on the home node: its bytes come through the sealed link, piece by piece
// (fstat.read). It plays as the pieces arrive, each fed to the player as it opens. A sound or video in a format the browser can
// start from its first pieces goes through MediaSource; one it cannot (an MP4 with its index at the end) plays once complete,
// from memory. The pieces stay while it is open, so playing again plays from memory; destroy() (or the next file) drops them.
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
  var parts = Promise.all([S.require('spirit/element/fstat.js'), S.require('spirit/element/files/listElement.js')]);

  function tagFor(kind) { return kind === 'audio' ? 'audio' : kind === 'video' ? 'video' : 'img'; }

  // ONE FILE, IN fstat'S PANE.
  function view(host, path) {
    var FS = S.element.fstat;
    var frame = FS.create(host, { path: path });
    var body = frame.slot('body');
    var mime = FS.mimeOf(path);
    var tag = tagFor(FS.kindOf(mime));
    var urls = [];
    var live = true;
    var el = document.createElement(tag);
    el.className = 'media-view';
    if (tag !== 'img') el.controls = true;
    body.appendChild(el);
    function url(blobOrSource) { var u = URL.createObjectURL(blobOrSource); urls.push(u); return u; }

    if (!S.transport || typeof S.transport.file !== 'function') {
      el.src = '/' + encodeURI(path);
    } else if (tag !== 'img' && window.MediaSource && MediaSource.isTypeSupported(mime)) {
      // PLAYED AS IT ARRIVES: each opened piece appended in order; a format MediaSource refuses part-way falls back to the
      // whole file, from memory, when the last piece is in.
      var source = new MediaSource();
      var queue = [];
      var buffer = null;
      var failed = false;
      var ended = false;
      el.src = url(source);
      var feed = function () {
        if (!buffer || buffer.updating || failed) return;
        if (queue.length) { try { buffer.appendBuffer(queue.shift()); } catch (e) { failed = true; } return; }
        if (ended && source.readyState === 'open') { try { source.endOfStream(); } catch (e) { /* already ended */ } }
      };
      source.addEventListener('sourceopen', function () {
        try { buffer = source.addSourceBuffer(mime); } catch (e) { failed = true; return; }
        buffer.addEventListener('updateend', feed);
        buffer.addEventListener('error', function () { failed = true; });
        feed();
      });
      FS.read(path, function (piece) { if (live) { queue.push(piece); feed(); } }).then(function (r) {
        ended = true;
        if (!live) return;
        if (failed) el.src = url(new Blob([r.bytes], { type: mime }));
        else feed();
      });
    } else {
      // An image, or a format MediaSource cannot take: shown once the last piece is in.
      FS.read(path).then(function (r) { if (live && r.status === 200) el.src = url(new Blob([r.bytes], { type: mime })); });
    }
    return {
      destroy: function () {
        live = false;
        try { el.removeAttribute('src'); if (typeof el.load === 'function') el.load(); } catch (e) { /* gone */ }
        urls.forEach(function (u) { URL.revokeObjectURL(u); });
        urls = [];
        host.innerHTML = '';
      },
    };
  }

  function create(container, opts) {
    var o = opts || {};
    var gone = false;
    var shown = null;
    var picker = null;
    container.innerHTML = '';
    var box = document.createElement('div');
    box.className = 'fill';
    container.appendChild(box);
    parts.then(function () {
      if (gone) return;
      var FS = S.element.fstat;
      if (o.path) { shown = view(box, String(o.path)); return; }
      // NO FILE HANDED IN: the file picker, the files list as a dropdown showing only what it plays, and under it the file
      // picked; a pick drops the one shown before.
      var pick = document.createElement('div');
      var area = document.createElement('div');
      area.className = 'fill';
      area.style.marginTop = '1em';
      box.appendChild(pick);
      box.appendChild(area);
      picker = S.element.fileList.create(pick, {
        face: 'dropdown',
        placeholder: 'choose a picture, song or video…',
        accept: function (row) { var kind = FS.kindOf(FS.mimeOf(row.path)); return !!kind && kind !== 'code'; },
        pick: function (row, key) {
          if (!row || row.kind !== 'file') return;
          if (shown) shown.destroy();
          shown = view(area, key);
        },
      });
    }, function () { box.textContent = 'Media could not be loaded.'; });
    return {
      destroy: function () {
        gone = true;
        if (shown) shown.destroy();
        if (picker) picker.destroy();
        shown = null;
        picker = null;
        container.innerHTML = '';
      },
    };
  }

  S.elements = S.elements || {};
  S.elements.media = { create: create };
}());
