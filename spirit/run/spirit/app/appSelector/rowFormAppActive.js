'use strict';
// spirit/run/spirit/app/appSelector/rowFormAppActive.js
// ACTIVATE OR DEACTIVATE ONE APP, A rowFormToggle THAT HIDES ITSELF FOR AN INTRINSIC APP (goal/G43.15). Andy: "the
// "activate/deacivate" should be an element, too, that self-hides if the app is intrinsic, that way nobody that uses that element
// can forget to hide it....". Its contract and its test: ./test/rowFormAppActive.md and ./test/rowFormAppActive.js.
//
//   spirit.element.spirit.app.appSelector.rowFormAppActive.create(host, { key }) -> { destroy() }
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
    var t = S.element.spirit.app.appSelector.rowFormToggle.create(host, { on: false, words: '', press: press });
    t.root.hidden = true;
    function paint() {
      if (gone) return;
      var r = row();
      // goal/G43.21, Andy: "an app that only has node:run and no node:mount or shell:mount cannot be "activated" show rowForms
      // should knows that.": the node says so on the row, runOnly, and the node refuses it too.
      if (!r || r.intrinsic === true || r.runOnly === true) { t.root.hidden = true; return; }
      var on = r.active === true;
      t.set(on, [(on ? 'Deactivate' : 'Activate'), r.label].concat(parts.length ? [parts.join(' and ')] : []).join(' '));
      t.root.hidden = false;
    }
    function ask() {
      S.ready.then(function (s) { return s.app.searchApp({ q: '' }); }).then(function (got) {
        if (!gone) S.data.seatRows(S.data.app.data.branch, got.items);
      }, function () { /* the row comes with the stream */ });
    }
    // WHAT IT MOUNTS, read from <name>.json, again each time the row changes: a closed panel is kept, not made anew (goal/G43.17,
    // the box: "A closed layer is hidden, not destroyed"), so a read made once would show an old file when it is shown again.
    function readParts() {
      S.ready.then(function (s) { return s.fs.loadFile('spirit/app/' + key + '/' + key + '.json'); }).then(function (text) {
        var j = JSON.parse(String(text));
        parts = (j.shell && j.shell.mount === true ? ['face'] : []).concat(j.node && j.node.mount === true ? ['server'] : []);
        paint();
      }).then(null, function () { /* a face that may not read the file: the words name no parts */ });
    }
    // WHO PAINTS, LISTENS (G41.32); a connect forgetting what is kept asks again.
    var offRow = S.data.app.data.watchApp(key, function () { paint(); readParts(); });
    var offAll = S.data.app.data.watch(function (k) { if (!k) ask(); });
    if (!row()) ask();
    paint();
    readParts();
    return { destroy: function () { gone = true; offRow(); offAll(); t.destroy(); } };
  }

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/appSelector/rowFormAppActive.js', { create: create }); });
}());
