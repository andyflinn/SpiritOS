// spirit/run/shell/js/textViewer.js
// A TEXT FILE, SHOWN (goal/G30.16), on fileViewer: in the codeMirror element's read mode (shell/js/codeMirror.js,
// goal/G41.7), the search words marked and the first in view. Editing stays the handler's (the textEditor app, through Open with). A process
// script with a manifest also gets its job form: Start Job, and the switch to include or exclude it on this node.
//
//   textViewer.create(host, { path, words, line, launcherId })
//
// CODEMIRROR IS THE ELEMENT'S TO LOAD (goal/G41.7): this viewer reads nothing of index.html and loads no library itself.
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (goal/G41.3; Andy: "lazy-load, is a tree...."): its tree, through spirit.require.
  if (window.spirit.require) ['shell/js/fileViewer.js', 'shell/js/codeMirror.js'].forEach(function (p) { window.spirit.require(p); });

  function sp() { return window.spirit || {}; }
  function esc(s) {
    var f = sp().escapeHtml;
    return f ? f(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function text(r) { return new TextDecoder().decode(r.bytes); }


  // A process script with a manifest: its job form (moved from index.html, now asking only asynchronously).
  function jobForm(host, path) {
    var match = String(path).match(/^process\/([^/]+)\/([^/]+)\/(.+)\.js$/);
    if (!match) return;
    var lang = match[1];
    E.fileViewer.read(path.replace(/\.js$/, '.json')).then(function (r) {
      if (r.status !== 200) return;
      var manifest = null;
      try { manifest = JSON.parse(text(r)); } catch (e) { return; }
      host.innerHTML = '<div class="stat-tile wide">' +
        '<div class="panel-heading">' + esc(manifest.label || path) + '</div>' +
        '<div class="start-job-form card">' + (manifest.args || []).map(function (arg) {
          return '<label class="field-label">' + esc(arg.label || arg.name) + '<input type="' + (arg.type === 'number' ? 'number' : 'text') +
            '" data-arg-name="' + esc(arg.name) + '" value="' + esc(arg.default != null ? arg.default : '') + '"></label>';
        }).join('') +
        '<button type="button" data-job="start" style="display:none">' + '🏃‍♂️ Start Job</button>' +
        '</div><div data-job="note" class="job-manifest-note"></div></div>';
      var start = host.querySelector('[data-job="start"]');
      var note = host.querySelector('[data-job="note"]');
      // WHERE IT RUNS IS ITS OWN SIDECAR'S (goal/G41.1, box v13): a server whose sidecar's face part says home true (or
      // an intrinsic one) can be started; any other says so. The switch is the Apps app's checkbox.
      // A sidecar is never served as a file: its annotations are asked for.
      Promise.resolve(sp().ready).then(function (s) { return s.fs.getAnnotations(path); }).then(null, function () { return null; }).then(function (side) {
        // Intrinsic is the coded list's, on the face part the node hands out (goal/G41.1, box v17).
        var included = !!(side && side.face && (side.face.intrinsic === true || side.face.home === true));
        start.style.display = included ? '' : 'none';
        if (!included) note.textContent = 'Not run on this node: its sidecar does not say home (the Apps app switches it).';
      });
      start.addEventListener('click', function () {
        var values = {};
        Array.prototype.forEach.call(host.querySelectorAll('[data-arg-name]'), function (input) {
          values[input.getAttribute('data-arg-name')] = input.type === 'number' ? Number(input.value) : input.value;
        });
        sp().jobs.create({ command: lang === 'js' ? 'node' : lang, args: [path, JSON.stringify(values)], type: manifest.label || match[2] });
        var shell = window.spirit && window.spirit.shell;
        if (shell && typeof shell.launchApp === 'function') shell.launchApp('shell/jobs', null, { replace: true });
      });
    });
  }

  function create(host, opts) {
    var o = opts || {};
    var path = String(o.path || '');
    var frame = E.fileViewer.create(host, { path: path, launcherId: o.launcherId });
    var body = frame.slot('body');
    // THE TEXT IN A FILL BOX (rule/16; Andy, on G41.7: the text viewer "same problem"): it takes what the frame's body
    // leaves it and scrolls inside itself, never growing the page past its bottom.
    body.innerHTML = '<div data-part="job"></div><div class="text-view fill"></div>';
    jobForm(body.querySelector('[data-part="job"]'), path);
    var view = body.querySelector('.text-view');
    return E.fileViewer.read(path).then(function (r) {
      return E.codeMirror.create(view, { mode: 'read', text: r.status === 200 ? text(r) : '(could not load file)', words: o.words || '', line: o.line || 0, path: path });
    }).then(function () { return frame; }, function (e) { view.textContent = '(could not load file: ' + ((e && e.message) || e) + ')'; return frame; });
  }

  E.textViewer = { create: create };
}());
