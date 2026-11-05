// spirit/run/spirit/app/appSelector/rowFormAppActive.js
// ACTIVATE OR DEACTIVATE ONE APP, A rowFormToggle THAT HIDES ITSELF FOR AN INTRINSIC APP (goal/G43.15). Andy: "the
// "activate/deacivate" should be an element, too, that self-hides if the app is intrinsic, that way nobody that uses that element
// can forget to hide it....". Its contract and its test: ./test/rowFormAppActive.md and ./test/rowFormAppActive.js.
//
//   spirit.elements.rowFormAppActive.create(host, { key }) -> { destroy() }
//
// It follows the app's row in spirit.data.app (the row's active and intrinsic); a press asks the node, spirit.app.activeApp, and
// the row the stream then brings redraws it. Its words name what the app mounts, from its <name>.json: face, server, or both.
(function () {
  window.spirit.require('spirit/app/appSelector/rowFormToggle.js');
  window.spirit.cacheManager('app');

  function create(host, options) {
    var S = window.spirit;
    var key = String((options && options.key) || '');
    var gone = false;
    var parts = [];
    function row() { var A = S.data.app && S.data.app.data; return A ? A.rows()[key] || null : null; }
    function press() {
      var r = row();
      if (!r) return;
      S.ready.then(function (s) { return s.app.activeApp({ key: key, active: r.active !== true }); }).then(null, function () { /* the row stays */ });
    }
    var t = S.elements.rowFormToggle.create(host, { on: false, words: '', press: press });
    t.root.hidden = true;
    function paint() {
      if (gone) return;
      var r = row();
      if (!r || r.intrinsic === true) { t.root.hidden = true; return; }
      var on = r.active === true;
      t.set(on, [(on ? 'Deactivate' : 'Activate'), r.label].concat(parts.length ? [parts.join(' and ')] : []).join(' '));
      t.root.hidden = false;
    }
    function ask() {
      S.ready.then(function (s) { return s.app.searchApp({ q: '' }); }).then(function (got) {
        if (!gone) S.data.seatRows(S.data.app.data.branch, got.items);
      }, function () { /* the row comes with the stream */ });
    }
    // WHO PAINTS, LISTENS (G41.32); a connect forgetting what is kept asks again.
    var offRow = S.data.app.data.watchApp(key, paint);
    var offAll = S.data.app.data.watch(function (k) { if (!k) ask(); });
    if (!row()) ask();
    paint();
    S.ready.then(function (s) { return s.fs.loadFile('spirit/app/' + key + '/' + key + '.json'); }).then(function (text) {
      var j = JSON.parse(String(text));
      parts = (j.shell && j.shell.mount === true ? ['face'] : []).concat(j.node && j.node.mount === true ? ['server'] : []);
      paint();
    }).then(null, function () { /* a face that may not read the file: the words name no parts */ });
    return { destroy: function () { gone = true; offRow(); offAll(); t.destroy(); } };
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.rowFormAppActive = { create: create };
}());
