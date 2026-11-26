'use strict';
// spirit/run/spirit/element/search/app/changeAppLabel/script.js
// ONE APP'S LABEL, ONE rowForm (goal/G43.15; Andy: "i thought you'd make the changeAppLabel and changeAppIcon form elements as
// well, in spirit/app/ then i can re-use them as is in the config right side panel of agent", Q4: "yes.").
//
//   spirit.required.spirit.element.search.app.changeAppLabel.create(host, { key }) -> { destroy() }
//
// Its input holds the row's label in spirit.required.spirit.data.app and follows it while it is not being typed in; Change asks the node,
// spirit.requireScript('spirit/app/script.js')'s answer.labelApp, and the row the stream then brings redraws it.
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  keepAnswer('spirit/element/rowForm/script.js');
  keepAnswer('spirit/element/fieldInput/script.js');
  // ITS FIELDS' TYPES, REQUIRED HERE BY THEIR FULL PATHS (goal/G49.13; Andy: "The UI elements need to know which spirit/type
  // their fields are and require that type"): the types fieldInput holds its fields to.
  if (window.spirit && typeof window.spirit.requireScript === 'function') { window.spirit.requireScript('spirit/type/string/label/script.js'); }
  keepAnswer('spirit/app/script.js');

  function create(host, options) {
    var S = window.spirit;
    var key = String((options && options.key) || '');
    var gone = false;
    // NO APP NAMED, NOTHING TO FOLLOW (goal/G41.19, box v23: an element missing its options "mounts and says it is not
    // configured"): it watches no row and asks nothing.
    if (!key) { host.textContent = 'No app named: not configured.'; return { destroy: function () { host.innerHTML = ''; } }; }
    function row() { var A = S.required.spirit.data.app && S.required.spirit.data.app.data; return A ? A.rows()[key] || null : null; }
    // ITS CHANGE IS THE ROWFORM'S TO HEAR (goal/G47.1, Q20; Andy: "mark the button busy from press until the mounter's answer
    // comes"): handed as press, so Change is busy until the node answers.
    var input = null;
    var form = ANSWER['spirit/element/rowForm/script.js'].create(host, { icon: '✏️', button: 'Change', press: function () {
      return S.readyPromise.then(function () { return keepAnswer('spirit/app/script.js'); }).then(function (s) { return s.labelApp({ key: key, label: input.value }); }).then(null, function () { /* not written: the row stays as the node last said */ });
    } });
    input = document.createElement('input');
    input.type = 'text';
    form.span.appendChild(document.createTextNode('Label '));
    form.span.appendChild(input);
    if (ANSWER['spirit/element/fieldInput/script.js']) ANSWER['spirit/element/fieldInput/script.js'].attach(input, 'spirit/type/string/label/script.js');
    function paint() {
      if (gone) return;
      var r = row();
      if (r && document.activeElement !== input) input.value = String(r.label || '');
    }
    function ask() {
      S.readyPromise.then(function () { return keepAnswer('spirit/app/script.js'); }).then(function (s) { return s.searchApp({ q: '' }); }).then(function (got) {
        if (!gone) S.required.spirit.data.seatRows(S.required.spirit.data.app.data.branch, got.items);
      }, function () { /* the row comes with the stream */ });
    }
    var offRow = S.required.spirit.data.app.data.watch(key, paint);
    var offAll = S.required.spirit.data.app.data.watch(function (k) { if (!k) ask(); });
    if (!row()) ask();
    paint();
    return { destroy: function () { gone = true; offRow(); offAll(); host.innerHTML = ''; } };
  }

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
