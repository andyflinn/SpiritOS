// spirit/run/shell/js/fileViewer.js
// ONE FILE, SHOWN (goal/G30.16). The viewers left the old shell (index.html drew them inline, with js/client/shell.js's
// helpers, all reading synchronously) and are shell elements now, so the face has them too. This is what both share:
//
//   fileViewer.read(path, onPiece) -> Promise<{ status, type, bytes }>
//     A file of the home node. On a face it comes through the sealed link, window.spirit.transport.file, each piece
//     handed to onPiece as it opens; at home by the node's own GET, each chunk as it arrives. Asynchronous only.
//   fileViewer.fStatViewer(host, path)       the path in its own tile and the facts bubble: MIME type at once, then
//                                             size, changed and created when fs.stat answers (absent if it fails)
//   fileViewer.annotationManager(host, path)  "More Information": the file's annotations (fs.annotations, its client
//                                             part), each tool's payload drawn generically; nothing when there is none
//   fileViewer.create(host, { path, launcherId }) -> { path, slot(name) }
//     The frame both viewers fill: the stat bubble, the app this file is (old shell only), Open with (old shell only),
//     a body slot for the viewer, the annotations.
//   fileViewer.mimeOf(path), fileViewer.kindOf(mime)   'image' | 'audio' | 'video' | 'code' | null
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};

  function sp() { return window.spirit || {}; }
  function esc(s) {
    var f = sp().escapeHtml;
    return f ? f(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  // Through the spirit object (goal/G32.2): fs.stat and fs.annotations, null where the node refuses.
  function ask(verb, args) {
    var name = String(verb).replace(/^fs\./, '');
    return (window.spirit && window.spirit.ready ? window.spirit.ready : Promise.reject(new Error('no spirit object')))
      .then(function (s) { return s.fs[name](args); }).then(function (body) { return body; }, function () { return null; });
  }

  function mimeOf(path) {
    var name = String(path || '');
    var dot = name.lastIndexOf('.');
    var ext = dot >= 0 ? name.substring(dot).toLowerCase() : '';
    var types = sp().MIME_TYPES || {};
    return types[ext] || 'application/octet-stream';
  }
  function kindOf(mime) {
    var m = String(mime || '');
    if (m.indexOf('image/') === 0) return 'image';
    if (m.indexOf('audio/') === 0) return 'audio';
    if (m.indexOf('video/') === 0) return 'video';
    if (m.indexOf('text/') === 0 || m.indexOf('javascript') !== -1 || m.indexOf('json') !== -1) return 'code';
    return null;
  }

  function join(parts) {
    var size = parts.reduce(function (n, p) { return n + p.length; }, 0);
    var all = new Uint8Array(size);
    var at = 0;
    parts.forEach(function (p) { all.set(p, at); at += p.length; });
    return all;
  }
  function read(path, onPiece) {
    var clean = String(path || '').replace(/^\/+/, '');
    var each = typeof onPiece === 'function' ? onPiece : function () {};
    var t = window.spirit.transport;
    if (t && typeof t.file === 'function') return Promise.resolve(t.file(clean, each));
    return fetch('/' + encodeURI(clean), { credentials: 'same-origin' }).then(function (r) {
      var type = r.headers.get('Content-Type') || '';
      if (!r.body || typeof r.body.getReader !== 'function') {
        return r.arrayBuffer().then(function (b) { var bytes = new Uint8Array(b); each(bytes); return { status: r.status, type: type, bytes: bytes }; });
      }
      var reader = r.body.getReader();
      var parts = [];
      function pump() {
        return reader.read().then(function (step) {
          if (step.done) return { status: r.status, type: type, bytes: join(parts) };
          parts.push(step.value);
          each(step.value);
          return pump();
        });
      }
      return pump();
    });
  }

  // The path that always fits (one span a directory, a break after each slash), and a facts bubble: the old shell's
  // pathValue and factRow, the same markup and classes.
  function pathValue(path) {
    var parts = String(path == null ? '' : path).split('/');
    var file = parts.pop();
    return parts.map(function (dir) { return '<span class="path-dir">' + esc(dir) + '/</span><wbr>'; }).join('') +
      '<span class="path-file">' + esc(file) + '</span>';
  }
  function factRow(pairs) {
    return '<div class="fact-row">' + pairs.map(function (p) {
      return '<div class="fact"><span class="fact-label">' + esc(String(p[0])) + '</span><span class="fact-value">' + esc(String(p[1])) + '</span></div>';
    }).join('') + '</div>';
  }
  function fStatViewer(host, path) {
    var facts = [['MIME type', mimeOf(path)]];
    function draw() { host.innerHTML = '<div class="stat-tile wide file-path">' + pathValue(path) + '</div>' + factRow(facts); }
    draw();
    return ask('fs.stat', { path: path }).then(function (s) {
      if (!s || typeof s.size !== 'number') return;
      var bytes = sp().formatBytes ? sp().formatBytes(s.size) : s.size + ' B';
      facts.push(['Size', bytes], ['Changed', new Date(s.mtimeMs).toLocaleString()], ['Created', new Date(s.birthtimeMs).toLocaleString()]);
      draw();
    });
  }

  // Annotation keys are tools' camelCase; arrays fold behind a details; a number past 1e11 is a date in ms.
  function prettify(key) { return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, function (c) { return c.toUpperCase(); }); }
  function infoRow(label, value) { return '<div class="file-info-row"><span class="file-info-label">' + label + ':</span><span class="file-info-value">' + value + '</span></div>'; }
  function valueHtml(v) {
    if (v === null || v === undefined) return '<em>none</em>';
    if (Array.isArray(v)) return '<details class="annotation-raw"><summary>' + v.length + ' value' + (v.length === 1 ? '' : 's') + '</summary><pre class="code-view">' + esc(JSON.stringify(v, null, 2)) + '</pre></details>';
    if (typeof v === 'object') return '<div class="stat-tile nested">' + Object.keys(v).map(function (k) { return infoRow(esc(prettify(k)), valueHtml(v[k])); }).join('') + '</div>';
    if (typeof v === 'number' && v > 1e11) return esc(new Date(v).toLocaleString());
    return esc(String(v));
  }
  function annotationManager(host, path) {
    host.innerHTML = '';
    return ask('fs.annotations', { path: path }).then(function (a) {
      // The face part, the one part (goal/G41.1, box v15): the old shell's client part is gone.
      var client = a && a.face;
      if (!client || !Object.keys(client).length) return;
      host.innerHTML = '<h3>More Information</h3>' + Object.keys(client).map(function (k) {
        return '<div class="stat-tile wide"><h4>' + esc(prettify(k)) + '</h4>' + valueHtml(client[k]) + '</div>';
      }).join('');
    });
  }

  function create(host, opts) {
    var o = opts || {};
    var path = String(o.path || '');
    // SPACE GRANTED TOP-DOWN (rule/16, goal/G41.7): the frame is a fill column and its body slot a fill box, so a viewer's
    // text or media takes what the stat bubble and the notes leave it and scrolls inside itself.
    host.innerHTML = '<div class="stack fill">' +
      '<div data-part="stat"></div><div data-part="owner-app"></div><div data-part="open-with" class="open-with"></div>' +
      '<div data-part="body" class="fill"></div><div data-part="notes"></div></div>';
    function slot(name) { return host.querySelector('[data-part="' + name + '"]'); }
    fStatViewer(slot('stat'), path);
    annotationManager(slot('notes'), path);
    // The old shell's registry of apps and handlers: at home only (the face has no Open with yet).
    var shell = window.spirit && window.spirit.shell;
    if (shell && typeof shell.renderAppOfFile === 'function') shell.renderAppOfFile(slot('owner-app'), path);
    if (shell && typeof shell.renderOpenWith === 'function' && o.launcherId) shell.renderOpenWith(slot('open-with'), o.launcherId, path);
    return { path: path, slot: slot };
  }

  E.fileViewer = { create: create, read: read, mimeOf: mimeOf, kindOf: kindOf, fStatViewer: fStatViewer, annotationManager: annotationManager };
}());
