// spirit/run/spirit/element/appInstaller.js
// THE APP INSTALLER (goal/G41.1, box v14). Andy: "we need a new standard shell element, the shell/js/appInstaller.js".
// One activate/deactivate button for one app, drawn the same wherever it is used (the Apps list's column, the app's
// details panel); install and uninstall come later. Its contract and its test: ./test/appInstaller.md and .js.
//
//   create(host, { path }) -> { destroy() }; path is the app's script, shell/<name>/<name>.js or
//   process/js/<name>/<name>.js.
//
//   An app in spirit/app is on while its row says active: true; a press asks the node, spirit.app.activeApp, and the
//   button draws what the stream then brings (goal/G43.9).
//   A shell app is on while its face part says app: true; a press writes the face part with app turned over and tells
//   the face shell. An appServer is on while a server job of its module runs; a press writes its face part's home,
//   and the node starts or stops it (goal/G41.1: a server runs at home by its own sidecar). Either way the face part is
//   written whole, every other field kept, and the button draws only what the node answers or the stream says
//   (rule/19). An intrinsic app, and the Apps app itself, get no button: intrinsic is the development team's, by hand.
(function () {
  var E = (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  var SCRIPT = /^(shell|process\/js)\/([^/]+)\/\2\.js$/;
  var APP = /^spirit\/app\/([^/]+)\/\1\.js$/;

  function esc(s) {
    var f = window.spirit && window.spirit.escapeHtml;
    return f ? f(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function sp() { return window.spirit || {}; }
  function fsOf() { return Promise.resolve(sp().ready).then(function (s) { return (s && s.fs) || sp().fs; }); }

  // AN APP IN spirit/app: ONE STATE, THE ROW'S ACTIVE.
  function createForApp(host, key) {
    var gone = false;
    var off = function () {};
    var shown = null;
    function reads() { return ((sp().data || {}).app || {}).data; }
    function isOn() { var A = reads(); var row = A ? A.rows()[key] : null; return !!row && row.active === true; }
    // AN INTRINSIC APP GETS NO BUTTON (goal/G43.15): its row says so, and app.active would refuse it.
    function isIntrinsic() { var A = reads(); var row = A ? A.rows()[key] : null; return !!row && row.intrinsic === true; }
    function press(e) {
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      var want = !isOn();
      Promise.resolve(sp().ready).then(function (s) { return s.app.activeApp({ key: key, active: want }); }).then(null, function () { /* not written: the button stays as the node last said */ });
    }
    function render() {
      if (gone || !host) return;
      if (isIntrinsic()) { shown = null; host.innerHTML = ''; return; }
      var on = isOn();
      if (on === shown) return;
      shown = on;
      host.innerHTML = '<button type="button" class="app-installer" data-on="' + (on ? 'true' : 'false') + '">' + (on ? 'Deactivate' : 'Activate') + '</button>';
      var b = host.querySelector('button');
      if (b) b.addEventListener('click', press);
    }
    Promise.resolve(sp().cacheManager('app')).then(function () {
      if (gone) return;
      render();
      var A = reads();
      if (A) off = A.watchApp(key, render) || off;
    });
    return {
      destroy: function () {
        if (gone) return;
        gone = true;
        try { off(); } catch (e) { /* gone already */ }
      },
    };
  }

  function create(host, opts) {
    var path = String((opts && opts.path) || '');
    var app = APP.exec(path);
    if (app) return createForApp(host, app[1]);
    var m = SCRIPT.exec(path);
    var gone = false;
    var face = {};
    var on = false;
    var off = function () {};
    var isServer = !!m && m[1] === 'process/js';
    var module = m ? 'process/js/' + m[2] : '';

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
    // A SERVER IS ON WHILE A SERVER JOB OF ITS MODULE RUNS, or is pending between restarts (as goal/G27.16 counts it): the
    // jobs as the jobs family's cache keeps them (spirit.data.jobs.data, goal/G41.28).
    function serverOn() {
      var J = ((sp().data || {}).jobs || {}).data;
      return !!J && !!J.find(function (j) { return j.kind === 'server' && j.module === module && (j.status === 'running' || j.status === 'pending'); });
    }
    // ONE STATE, DRAWN WHEN IT CHANGES: exempt (intrinsic, or the Apps app), else on or off.
    var shown = '';
    function render() {
      var isExempt = face.intrinsic === true || (m[1] === 'shell' && m[2] === 'apps');
      on = !isExempt && (isServer ? serverOn() : face.app === true);
      var now = isExempt ? 'exempt' : (on ? 'on' : 'off');
      if (now === shown) return;
      shown = now;
      if (isExempt) exempt(); else draw();
    }
    // EVERY BUTTON LISTENS (box v15): its app's face part as the node streams it (an app-face job), and a server's job,
    // both through the jobs family's cache (spirit.data.jobs.data.watch, goal/G41.28).
    function heard(id, job) {
      if (!job) { if (isServer) render(); return; }
      if (job.type === 'app-face') {
        if (job.data && job.data.path === path) { face = (job.data.face && typeof job.data.face === 'object') ? job.data.face : {}; render(); }
        return;
      }
      if (isServer) render();
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
        return readFace().then(render);
      }, function () { /* not written: the button stays as the node last said */ });
    }

    if (!m || !host) return { destroy: function () {} };
    readFace().then(function () {
      if (gone) return;
      return Promise.resolve(sp().cacheManager('jobs')).then(function () {
        if (gone) return;
        render();
        var J = ((sp().data || {}).jobs || {}).data;
        if (J) off = J.watch(heard) || off;
      });
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
