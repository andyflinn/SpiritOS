'use strict';
// spirit/run/spirit/element/appInstaller/script.js
// THE APP INSTALLER (goal/G41.1, box v14). Andy: "we need a new standard shell element, the shell/js/appInstaller.js".
// One activate/deactivate button for one app, drawn the same wherever it is used (the Apps list's column, the app's
// details panel); install and uninstall come later. Its contract and its test: ./test/script.md and .js.
//
//   create(host, { path }) -> { destroy() }; path is the app's script, spirit/app/<name>/<name>.js.
//
//   An app in spirit/app is on while its row says active: true; a press asks the node, spirit.requireScript('spirit/app/api.js')'s answer.activeApp, and the
//   button draws what the stream then brings (goal/G43.9). An intrinsic app gets no button: intrinsic is the
//   development team's, by hand. Any other path gets nothing: the old shell's face parts, which switched a shell app,
//   are gone (goal/G43.20; Andy: "drop the old shells face parts altogether.").
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  var E = ((window.spirit = window.spirit || {}).required = window.spirit.required || {});
  var APP = /^spirit\/app\/([^/]+)\/\1\.js$/;

  function sp() { return window.spirit || {}; }

  // AN APP IN spirit/app: ONE STATE, THE ROW'S ACTIVE.
  function createForApp(host, key) {
    var gone = false;
    var off = function () {};
    var shown = null;
    function reads() { return ((((sp().required || {}).spirit || {}).data || {}).app || {}).data; }
    function isOn() { var A = reads(); var row = A ? A.rows()[key] : null; return !!row && row.active === true; }
    // AN INTRINSIC APP GETS NO BUTTON (goal/G43.15): its row says so, and app.active would refuse it.
    function isIntrinsic() { var A = reads(); var row = A ? A.rows()[key] : null; return !!row && row.intrinsic === true; }
    function press(e) {
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      var want = !isOn();
      // The app branch by its api.js path, once the page is ready (goal/G49.6: never by a name).
      Promise.resolve(sp().readyPromise).then(function () { return sp().requireScript('spirit/app/api.js'); }).then(function (a) { return a.activeApp({ key: key, active: want }); }).then(null, function () { /* not written: the button stays as the node last said */ });
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
    Promise.resolve(sp().requireScript('spirit/app/api.js')).then(function () {
      if (gone) return;
      render();
      var A = reads();
      if (A) off = A.watch(key, render) || off;
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
    var app = APP.exec(String((opts && opts.path) || ''));
    if (!app || !host) return { destroy: function () {} };
    return createForApp(host, app[1]);
  }

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
