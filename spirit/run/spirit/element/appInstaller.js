'use strict';
// spirit/run/spirit/element/appInstaller.js
// THE APP INSTALLER (goal/G41.1, box v14). Andy: "we need a new standard shell element, the shell/js/appInstaller.js".
// One activate/deactivate button for one app, drawn the same wherever it is used (the Apps list's column, the app's
// details panel); install and uninstall come later. Its contract and its test: ./test/appInstaller.md and .js.
//
//   create(host, { path }) -> { destroy() }; path is the app's script, spirit/app/<name>/<name>.js.
//
//   An app in spirit/app is on while its row says active: true; a press asks the node, spirit.app.activeApp, and the
//   button draws what the stream then brings (goal/G43.9). An intrinsic app gets no button: intrinsic is the
//   development team's, by hand. Any other path gets nothing: the old shell's face parts, which switched a shell app,
//   are gone (goal/G43.20; Andy: "drop the old shells face parts altogether.").
(function () {
  var E = (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  var APP = /^spirit\/app\/([^/]+)\/\1\.js$/;

  function sp() { return window.spirit || {}; }

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

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/appInstaller.js', { create: create }); });
}());
