// spirit/run/shell/js/appInstaller.js
// THE APP INSTALLER (goal/G41.1, box v14). Andy: "we need a new standard shell element, the shell/js/appInstaller.js".
// One activate/deactivate button for one app, drawn the same wherever it is used (the Apps list's column, the app's
// details panel); install and uninstall come later. Its contract and its test: ./test/appInstaller.md and .js.
//
//   create(host, { path }) -> { destroy() }; path is the app's script, shell/<name>/<name>.js or
//   process/js/<name>/<name>.js.
//
//   A shell app is on while its face part says app: true; a press writes the face part with app turned over and tells
//   the face shell. An appServer is on while a server job of its module runs; a press writes its face part's home,
//   and the node starts or stops it (goal/G41.1: a server runs at home by its own sidecar). Either way the face part is
//   written whole, every other field kept, and the button draws only what the node answers or the stream says
//   (rule/19). An intrinsic app, and the Apps app itself, get no button: intrinsic is the development team's, by hand.
(function () {
  var E = (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  var SCRIPT = /^(shell|process\/js)\/([^/]+)\/\2\.js$/;

  function esc(s) {
    var f = window.spirit && window.spirit.escapeHtml;
    return f ? f(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function sp() { return window.spirit || {}; }
  function fsOf() { return Promise.resolve(sp().ready).then(function (s) { return (s && s.fs) || sp().fs; }); }

  function create(host, opts) {
    var path = String((opts && opts.path) || '');
    var m = SCRIPT.exec(path);
    var gone = false;
    var face = {};
    var on = false;
    var off = function () {};
    var isServer = !!m && m[1] === 'process/js';
    var module = m ? 'process/js/' + m[2] : '';
    var jobs = {};

    function draw() {
      if (gone || !host) return;
      host.innerHTML = '<button type="button" class="app-installer" data-on="' + (on ? 'true' : 'false') + '">' + (on ? 'Deactivate' : 'Activate') + '</button>';
      var b = host.querySelector('button');
      if (b) b.addEventListener('click', press);
    }
    function exempt() {
      if (gone || !host) return;
      host.innerHTML = '<span class="job-manifest-note">always on</span>';
    }
    // A SERVER IS ON WHILE A SERVER JOB OF ITS MODULE RUNS, or is pending between restarts (as goal/G27.16 counts it).
    function serverOn() {
      return Object.keys(jobs).some(function (id) { var j = jobs[id]; return j.kind === 'server' && j.module === module && (j.status === 'running' || j.status === 'pending'); });
    }
    function heard(job) {
      if (!job || !job.id) return;
      jobs[job.id] = job;
      var now = serverOn();
      if (now !== on) { on = now; draw(); }
    }
    function readFace() {
      return fsOf().then(function (f) { return f.getAnnotations(path); }).then(function (a) { face = (a && a.face) || {}; return face; });
    }
    // The face part written whole, with the one switch turned over.
    function press(e) {
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      var key = isServer ? 'home' : 'app';
      readFace().then(function (now) {
        var payload = Object.assign({}, now);
        payload[key] = !(now[key] === true);
        return fsOf().then(function (f) { return f.annotate({ path: path, payload: payload }); });
      }).then(function () {
        // A shell app: the face shell shows or hides it at once, and the button draws the node's answer.
        if (isServer) return;
        if (sp().shell && typeof sp().shell.faceApp === 'function') sp().shell.faceApp(m[1] + '/' + m[2]);
        return readFace().then(function () { on = face.app === true; draw(); });
      }, function () { /* not written: the button stays as the node last said */ });
    }

    if (!m || !host) return { destroy: function () {} };
    readFace().then(function () {
      if (gone) return;
      if (face.intrinsic === true || (m[1] === 'shell' && m[2] === 'apps')) { exempt(); return; }
      if (!isServer) { on = face.app === true; draw(); return; }
      draw();
      var ev = sp().events;
      if (ev && typeof ev.subscribe === 'function') {
        off = ev.subscribe({
          onSnapshot: function (list) { (list || []).forEach(heard); },
          onUpdate: heard,
          onDelete: function (id) { if (jobs[id]) { delete jobs[id]; var now = serverOn(); if (now !== on) { on = now; draw(); } } },
        }) || off;
      }
    }, function () { if (!gone && host) host.innerHTML = '<span class="job-manifest-note">' + esc('could not read ' + path) + '</span>'; });

    return {
      destroy: function () {
        if (gone) return;
        gone = true;
        try { off(); } catch (e) { /* gone already */ }
      },
    };
  }

  E.appInstaller = { create: create };
}());
