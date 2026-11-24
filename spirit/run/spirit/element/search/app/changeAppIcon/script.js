'use strict';
// spirit/run/spirit/element/search/app/changeAppIcon/script.js
// ONE APP'S ICON, ONE rowForm (goal/G43.15; Andy: "i thought you'd make the changeAppLabel and changeAppIcon form elements as
// well, in spirit/app/ then i can re-use them as is in the config right side panel of agent", Q4: "yes."). Its row as Andy drew
// it for the detail: "row 0: rowForm: [✏️] "Icon" [iconSelector:dropdown] [Change]".
//
//   spirit.required.spirit.element.search.app.changeAppIcon.create(host, { key }) -> { destroy() }
//
// It shows the row's icon in spirit.required.spirit.data.app and follows it; a pick is held until Change, which asks the node, spirit.requireScript('spirit/app/api.js')'s answer.iconApp,
// and the row the stream then brings redraws it.
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  keepAnswer('spirit/element/rowForm/script.js');
  keepAnswer('spirit/element/icon/script.js');
  keepAnswer('spirit/element/search/icon/list/script.js');
  keepAnswer('spirit/app/api.js');

  function create(host, options) {
    var S = window.spirit;
    var key = String((options && options.key) || '');
    var gone = false;
    var picked = '';
    // NO APP NAMED, NOTHING TO FOLLOW (goal/G41.19, box v23: an element missing its options "mounts and says it is not
    // configured"): it watches no row and asks nothing.
    if (!key) { host.textContent = 'No app named: not configured.'; return { destroy: function () { host.innerHTML = ''; } }; }
    function row() { var A = S.required.spirit.data.app && S.required.spirit.data.app.data; return A ? A.rows()[key] || null : null; }
    // ITS CHANGE IS THE ROWFORM'S TO HEAR (goal/G47.1, Q20; Andy: "mark the button busy from press until the mounter's answer
    // comes"): handed as press, so Change is busy until the node answers.
    var form = ANSWER['spirit/element/rowForm/script.js'].create(host, { icon: '✏️', button: 'Change', press: function () {
      if (!picked) return null;
      return S.readyPromise.then(function () { return keepAnswer('spirit/app/api.js'); }).then(function (s) { return s.iconApp({ key: key, icon: picked }); }).then(null, function () { /* the row stays */ });
    } });
    form.span.appendChild(document.createTextNode('Icon '));
    var shown = document.createElement('span');
    form.span.appendChild(shown);
    var listHost = document.createElement('span');
    form.span.appendChild(listHost);
    var list = ANSWER['spirit/element/search/icon/list/script.js'].create(listHost, { face: 'dropdown', pick: function (r, glyph) { picked = glyph || ''; } });
    function paint() {
      if (gone) return;
      var r = row();
      shown.innerHTML = '';
      if (r) ANSWER['spirit/element/icon/script.js'].create(shown, { glyph: r.icon });
    }
    function ask() {
      S.readyPromise.then(function () { return keepAnswer('spirit/app/api.js'); }).then(function (s) { return s.searchApp({ q: '' }); }).then(function (got) {
        if (!gone) S.required.spirit.data.seatRows(S.required.spirit.data.app.data.branch, got.items);
      }, function () { /* the row comes with the stream */ });
    }
    var offRow = S.required.spirit.data.app.data.watch(key, paint);
    var offAll = S.required.spirit.data.app.data.watch(function (k) { if (!k) ask(); });
    if (!row()) ask();
    paint();
    return { destroy: function () { gone = true; offRow(); offAll(); list.destroy(); host.innerHTML = ''; } };
  }

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
