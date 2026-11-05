// spirit/run/spirit/app/appSelector/rowFormAppShell.js
// ALLOW ONE APP AS SHELL, A rowFormToggle THAT HIDES ITSELF FOR AN APP THAT DOES NOT MOUNT ON THE SHELL (goal/G43.15; Andy:
// "correct, so does, allow mount-as-shell.."). Its contract and its test: ./test/rowFormAppShell.md and ./test/rowFormAppShell.js.
//
//   spirit.elements.rowFormAppShell.create(host, { key }) -> { destroy() }
//
// Shown only when the app's <name>.json says shell.mount true. It follows the row's shell in spirit.data.app; a press asks the
// node, spirit.app.shellApp, and the row the stream then brings redraws it.
(function () {
  window.spirit.require('spirit/app/appSelector/rowFormToggle.js');
  window.spirit.cacheManager('app');

  function create(host, options) {
    var S = window.spirit;
    var key = String((options && options.key) || '');
    var gone = false;
    var mounts = false;
    function row() { var A = S.data.app && S.data.app.data; return A ? A.rows()[key] || null : null; }
    function press() {
      var r = row();
      if (!r) return;
      S.ready.then(function (s) { return s.app.shellApp({ key: key, shell: r.shell !== true }); }).then(null, function () { /* the row stays */ });
    }
    var t = S.elements.rowFormToggle.create(host, { on: false, words: '', press: press });
    t.root.hidden = true;
    function paint() {
      if (gone) return;
      var r = row();
      if (!r || !mounts) { t.root.hidden = true; return; }
      var may = r.shell === true;
      t.set(may, (may ? "Don't allow " : 'Allow ') + r.label + ' as shell');
      t.root.hidden = false;
    }
    function ask() {
      S.ready.then(function (s) { return s.app.searchApp({ q: '' }); }).then(function (got) {
        if (!gone) S.data.seatRows(S.data.app.data.branch, got.items);
      }, function () { /* the row comes with the stream */ });
    }
    var offRow = S.data.app.data.watchApp(key, paint);
    var offAll = S.data.app.data.watch(function (k) { if (!k) ask(); });
    if (!row()) ask();
    S.ready.then(function (s) { return s.fs.loadFile('spirit/app/' + key + '/' + key + '.json'); }).then(function (text) {
      var j = JSON.parse(String(text));
      mounts = !!(j.shell && j.shell.mount === true);
      paint();
    }).then(null, function () { /* a face that may not read the file: nothing to allow */ });
    return { destroy: function () { gone = true; offRow(); offAll(); t.destroy(); } };
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.rowFormAppShell = { create: create };
}());
