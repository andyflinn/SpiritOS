// spirit/run/spirit/element/fstat.js
// A FILE'S INFO (goal/G43.17; Andy: "fstat is a file-info viewer"). It replaced the old file viewer, renamed and trimmed into
// it (Q7). Since Andy's "separate fstat from file and text, in file, let fstat pop up for unknows file types (❔) only", text
// and media no longer build on it, and file opens it for a ❔ file alone; and "drop the title in fstat, the name of the file is
// already in the "shells" titlebar". Its contract and its test: ./test/fstat.md and ./test/fstat.js.
//
//   fstat.create(host, { path }) -> { path, slot(name) }
//     Top down: the hidden pane (slot 'body', shown once a viewer asks for it), the facts (MIME type at once, then size,
//     changed and created when fs.stat answers). No annotations: they are the node's only (goal/G43.20; Andy:
//     "ANNOTATIONS WILL BE NODE ONLY.").
//     It asks nothing of the old shell (Q9: "the new stuff MUST NOT require old stuff.").
//   fstat.read(path, onPiece) -> Promise<{ status, type, bytes }>
//     A file of the home node. On a face it comes through the sealed link, window.spirit.transport.file, each piece
//     handed to onPiece as it opens; at home by the node's own GET, each chunk as it arrives. Asynchronous only.
//   fstat.mimeOf(path), fstat.kindOf(mime)   'image' | 'audio' | 'video' | 'code' | null
//   fstat.iconOf(path)   the icon of its kind, the box: "text 📜, video 📹, image 🌇, audio 🔊", any other ❔
(function () {
  var E = (window.spirit = window.spirit || {}).element = window.spirit.element || {};

  function sp() { return window.spirit || {}; }
  function esc(s) {
    var f = sp().escapeHtml;
    return f ? f(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  // Through the spirit object (goal/G32.2): fs.stat, null where the node refuses.
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

  // A facts bubble: the old shell's factRow, the same markup and classes.
  function factRow(pairs) {
    return '<div class="fact-row">' + pairs.map(function (p) {
      return '<div class="fact"><span class="fact-label">' + esc(String(p[0])) + '</span><span class="fact-value">' + esc(String(p[1])) + '</span></div>';
    }).join('') + '</div>';
  }
  // A FILE'S ICON BY ITS KIND (goal/G43.17), in a list's rows and tiles alike.
  var ICONS = { code: '📜', video: '📹', image: '🌇', audio: '🔊' };
  function iconOf(path) { return ICONS[kindOf(mimeOf(path))] || '❔'; }

  function factsView(host, path) {
    var facts = [['MIME type', mimeOf(path)]];
    function draw() { host.innerHTML = factRow(facts); }
    draw();
    return ask('fs.stat', { path: path }).then(function (s) {
      if (!s || typeof s.size !== 'number') return;
      var bytes = sp().formatBytes ? sp().formatBytes(s.size) : s.size + ' B';
      facts.push(['Size', bytes], ['Changed', new Date(s.mtimeMs).toLocaleString()], ['Created', new Date(s.birthtimeMs).toLocaleString()]);
      draw();
    });
  }

  function create(host, opts) {
    var o = opts || {};
    var path = String(o.path || '');
    // SPACE GRANTED TOP-DOWN (rule/16, goal/G41.7): the frame is a fill column and its pane a fill box, so what fills it takes
    // what the facts leave it and scrolls inside itself.
    host.innerHTML = '<div class="stack fill">' +
      '<div data-part="body" class="fill"></div><div data-part="facts"></div></div>';
    function part(name) { return host.querySelector('[data-part="' + name + '"]'); }
    // THE PANE STAYS INVISIBLE UNTIL FILLED (the box): a viewer that asks for it shows it.
    var body = part('body');
    if (body) body.hidden = true;
    function slot(name) { var s = part(name); if (s && name === 'body') s.hidden = false; return s; }
    factsView(part('facts'), path);
    return { path: path, slot: slot };
  }

  E.fstat = { create: create, read: read, mimeOf: mimeOf, kindOf: kindOf, iconOf: iconOf };
}());
