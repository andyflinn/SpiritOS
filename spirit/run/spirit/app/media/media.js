'use strict';
// spirit/run/spirit/app/media/media.js
// MEDIA, AN ELEMENT (goal/G43.17; the box: "Four elements: file, fstat, text and media", and "text and media take a file when
// mounted"; Andy, since: "please show the full media viewer or text editor (including the file picker) even when launched from
// files."). An image, a sound or a video, filling its box. It took
// over what the old media viewer element did, which is gone (Q7). Its contract and its test: ./test/media.md and ./test/media.js.
//
//   spirit.element.spirit.app.media.media.create(container, { path, title }) -> { destroy() }
//     title({ file, icon }): told the file shown and its kind's icon, for the title bar of whoever mounts it (Andy: "the medias
//     own icon or the media viewer's icon if no file is selcted yet").
//
// NOT ON fstat (Andy: "separate fstat from file and text"): the picture, sound or video alone. SIZED AS A LIST BOX IS (Andy:
// "remember how we size-constrain list boxes? THAT's HOW WE size constrain media content as well."): its box is a fill box,
// granted its room from above, and a picture or a video takes that room and no more, shrunk to fit both ways, not cropped.
//
// AT HOME the browser fetches the file from the node itself (src="/<path>"), streaming as it always has.
// ON A FACE there is no address for a file on the home node: its bytes come through the sealed link, piece by piece
// (fstat.read). It plays as the pieces arrive, each fed to the player as it opens. A sound or video in a format the browser can
// start from its first pieces goes through MediaSource; one it cannot (an MP4 with its index at the end) plays once complete,
// from memory. The pieces stay while it is open, so playing again plays from memory; destroy() (or the next file) drops them.
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
  var parts = Promise.all([S.require('spirit/element/fstat.js'), S.require('spirit/element/search/file.js'), S.require('spirit/element/icon.js')]);

  function tagFor(kind) { return kind === 'audio' ? 'audio' : kind === 'video' ? 'video' : 'img'; }

  // ONE FILE, FILLING ITS BOX.
  function view(host, path) {
    var FS = S.element.spirit.element.fstat;
    var body = host;
    var mime = FS.mimeOf(path);
    var tag = tagFor(FS.kindOf(mime));
    var urls = [];
    var live = true;
    var el = document.createElement(tag);
    el.className = 'media-view';
    // A picture or a video fills the box's room, the browser shrinking it inside to fit; a sound is its controls' row.
    if (tag !== 'audio') el.style.cssText = 'flex:1 1 0;min-height:0;min-width:0;width:100%;height:100%;object-fit:contain;margin:0;display:block';
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
    var title = typeof o.title === 'function' ? o.title : function () {};
    container.innerHTML = '';
    var box = document.createElement('div');
    box.className = 'fill';
    container.appendChild(box);
    parts.then(function () {
      if (gone) return;
      var FS = S.element.spirit.element.fstat;
      // THE FILE PICKER, the files list as a dropdown showing only what it plays, and under it the file
      // picked; a pick drops the one shown before. The picker sits in a row of rowForm's bubble (the box: "That row is a bubble
      // of the same kind as rowForm uses"), the viewer's icon first; it has nothing to press, so no button, and it folds as
      // rowForm's row does. ALWAYS WHOLE (Andy: "i changed my mind. please show the full media viewer or text editor (including the file picker) even when
      // launched from files."): the picker shows with a file handed in too, and that file is shown under it.
      var row = document.createElement('div');
      row.className = 'shell-bubble shell-row-form';
      S.element.spirit.element.icon.create(row, { glyph: '🎬' });
      var pick = document.createElement('span');
      pick.className = 'shell-row-form-span';
      row.appendChild(pick);
      var area = document.createElement('div');
      area.className = 'fill';
      area.style.marginTop = '1em';
      box.appendChild(row);
      box.appendChild(area);
      picker = S.element.spirit.element.search.file.create(pick, {
        face: 'dropdown',
        placeholder: 'choose a picture, song or video…',
        // Its field names no file: the title bar does.
        name: function () { return 'choose a picture, song or video…'; },
        accept: function (row) { var kind = FS.kindOf(FS.mimeOf(row.path)); return !!kind && kind !== 'code'; },
        pick: function (row, key) {
          if (!row || row.kind !== 'file') return;
          if (shown) shown.destroy();
          title({ file: key.split('/').pop(), icon: FS.iconOf(key) });
          shown = view(area, key);
        },
      });
      if (o.path) { title({ file: String(o.path).split('/').pop(), icon: FS.iconOf(String(o.path)) }); shown = view(area, String(o.path)); }
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

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/media/media.js', { create: create }); });
}());
