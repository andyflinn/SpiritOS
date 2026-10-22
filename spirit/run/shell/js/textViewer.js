// spirit/run/shell/js/textViewer.js
// A TEXT FILE, SHOWN (goal/G30.16), on fileViewer: read-only in CodeMirror (shell/js/textView.js), the search words
// marked and the first in view. Editing stays the handler's (the textEditor app, through Open with). A process
// script with a manifest also gets its job form: Start Job, and the switch to include or exclude it on this node.
//
//   textViewer.create(host, { path, words, line, launcherId })
//
// CODEMIRROR LOADS WHEN FIRST NEEDED. At home index.html has loaded it already; on a face it is read through the link,
// the same files index.html names, in its order, once.
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  var codeMirror = null;

  function core() { return (window.spirit && window.spirit.core) || {}; }
  function esc(s) {
    var f = core().util && core().util.escapeHtml;
    return f ? f(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function text(r) { return new TextDecoder().decode(r.bytes); }

  function ensureCodeMirror() {
    if (window.CodeMirror) return Promise.resolve();
    if (codeMirror) return codeMirror;
    var read = E.fileViewer.read;
    codeMirror = read('index.html').then(function (r) {
      var doc = new DOMParser().parseFromString(text(r), 'text/html');
      var parts = Array.prototype.map.call(doc.querySelectorAll('link[rel="stylesheet"][href], script[src]'), function (el) {
        return String(el.getAttribute('href') || el.getAttribute('src') || '').replace(/^\/+/, '');
      }).filter(function (p) { return p.indexOf('shell/node_modules/codemirror/') === 0; });
      return parts.reduce(function (chain, p) {
        return chain.then(function () { return read(p); }).then(function (f) {
          var el = document.createElement(/\.css$/.test(p) ? 'style' : 'script');
          el.textContent = text(f) + (/\.css$/.test(p) ? '' : '\n//# sourceURL=' + p);
          (/\.css$/.test(p) ? document.head : document.body).appendChild(el);
        });
      }, Promise.resolve());
    });
    return codeMirror;
  }

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
      // WHERE IT RUNS IS ITS MANIFEST'S (goal/G30.20): a server whose runs names 'home' (or an intrinsic one) can be
      // started; any other says so. The include switch that stood here is deleted with the include list: runs is edited
      // in the manifest's text.
      var included = manifest.intrinsic === true || (Array.isArray(manifest.runs) && manifest.runs.indexOf('home') !== -1);
      start.style.display = included ? '' : 'none';
      if (!included) note.textContent = 'Not run on this node: the runs in its manifest does not name home.';
      start.addEventListener('click', function () {
        var values = {};
        Array.prototype.forEach.call(host.querySelectorAll('[data-arg-name]'), function (input) {
          values[input.getAttribute('data-arg-name')] = input.type === 'number' ? Number(input.value) : input.value;
        });
        core().jobs.start({ command: lang === 'js' ? 'node' : lang, args: [path, JSON.stringify(values)], type: manifest.label || match[2] });
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
    body.innerHTML = '<div data-part="job"></div><div class="text-view"></div>';
    jobForm(body.querySelector('[data-part="job"]'), path);
    var view = body.querySelector('.text-view');
    return Promise.all([ensureCodeMirror(), E.fileViewer.read(path)]).then(function (got) {
      var r = got[1];
      E.createTextView(view, { text: r.status === 200 ? text(r) : '(could not load file)', words: o.words || '', line: o.line || 0, readOnly: true, path: path });
      return frame;
    }, function (e) { view.textContent = '(could not load file: ' + ((e && e.message) || e) + ')'; return frame; });
  }

  E.textViewer = { create: create };
}());
