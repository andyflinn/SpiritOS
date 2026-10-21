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
  var E = window.spiritElements = window.spiritElements || {};
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
      var I = (core().const && core().const.ICON) || {};
      host.innerHTML = '<div class="stat-tile wide">' +
        '<div class="panel-heading">' + esc(manifest.label || path) + '</div>' +
        '<div class="start-job-form card">' + (manifest.args || []).map(function (arg) {
          return '<label class="field-label">' + esc(arg.label || arg.name) + '<input type="' + (arg.type === 'number' ? 'number' : 'text') +
            '" data-arg-name="' + esc(arg.name) + '" value="' + esc(arg.default != null ? arg.default : '') + '"></label>';
        }).join('') +
        '<button type="button" data-job="start" style="display:none">' + (I.RUN || '') + ' Start Job</button>' +
        '<button type="button" data-job="include" style="display:none"></button>' +
        '</div><div data-job="note" class="job-manifest-note"></div></div>';
      var start = host.querySelector('[data-job="start"]');
      var toggle = host.querySelector('[data-job="include"]');
      var note = host.querySelector('[data-job="note"]');
      var modulePath = lang === 'js' ? 'process/js/' + match[2] : '';
      var included = false;
      function draw() {
        start.style.display = included ? '' : 'none';
        toggle.style.display = modulePath ? '' : 'none';
        toggle.removeAttribute('data-armed');
        toggle.textContent = included ? 'Exclude from this node' : 'Include on this node';
      }
      function asked() {
        if (!modulePath) return Promise.resolve();
        return Promise.resolve(core().ask('config.searchModules', { query: match[2] })).then(function (a) {
          var items = a && a.body && Array.isArray(a.body.items) ? a.body.items : [];
          included = items.some(function (i) { return i && i.key === modulePath; });
          draw();
        }, function () { included = false; draw(); });
      }
      // Asked twice, as a process change weighs more than an app's (Andy: "re-arm buttons").
      toggle.addEventListener('click', function () {
        if (!toggle.hasAttribute('data-armed')) {
          toggle.setAttribute('data-armed', '');
          toggle.textContent = included ? 'Press again to exclude' : 'Press again to include';
          return;
        }
        var on = !included;
        Promise.resolve(core().ask('config.setModules', { path: modulePath, on: on })).then(function (a) {
          note.textContent = a && a.status === 200 ? (on ? 'Included: it runs now if it is a server.' : 'Excluded: it stops at the next restart.')
            : 'Not changed: ' + ((a && a.text) || 'no answer');
          return asked();
        });
      });
      start.addEventListener('click', function () {
        var values = {};
        Array.prototype.forEach.call(host.querySelectorAll('[data-arg-name]'), function (input) {
          values[input.getAttribute('data-arg-name')] = input.type === 'number' ? Number(input.value) : input.value;
        });
        core().jobs.start({ command: lang === 'js' ? 'node' : lang, args: [path, JSON.stringify(values)], type: manifest.label || match[2] });
        var shell = window.spirit && window.spirit.shell;
        if (shell && typeof shell.launchApp === 'function') shell.launchApp('shell/jobs', null, { replace: true });
      });
      asked();
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
