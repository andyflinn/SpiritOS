'use strict';
// spirit/run/spirit/element/search/app/rowFormAppActive.js
// ACTIVATE OR DEACTIVATE ONE APP, A rowFormToggle THAT HIDES ITSELF FOR AN INTRINSIC APP (goal/G43.15). Andy: "the
// "activate/deacivate" should be an element, too, that self-hides if the app is intrinsic, that way nobody that uses that element
// can forget to hide it....". Its contract and its test: ./test/rowFormAppActive.md and ./test/rowFormAppActive.js.
//
//   spirit.required.spirit.element.search.app.rowFormAppActive.create(host, { key }) -> { destroy() }
//
// It follows the app's row in spirit.required.spirit.data.app (the row's active and intrinsic); a press asks the node, spirit.requireScript('spirit/app/api.js')'s answer.activeApp, and
// the row the stream then brings redraws it. Its words name what the app mounts, from its <name>.json: face, server, or both.
// THE INTERFACES IT CALLS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1; Andy: "EVERY FUCKING ELEMENT REQUIRES THE FUCKING
// INTERFACES IT FUCKING NEEDS"): a require made while this file runs is part of its tree, so whoever requires it waits for them.
if (window.spirit && typeof window.spirit.requireScript === 'function') ['spirit/fs/api.js','spirit/app/api.js'].forEach(function (p) { Promise.resolve(window.spirit.requireScript(p)).catch(function () {}); });
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  keepAnswer('spirit/element/search/app/rowFormToggle.js');
  keepAnswer('spirit/app/api.js');

  function create(host, options) {
    var S = window.spirit;
    var key = String((options && options.key) || '');
    var gone = false;
    var parts = [];
    function row() { var A = S.required.spirit.data.app && S.required.spirit.data.app.data; return A ? A.rows()[key] || null : null; }
    function press() {
      var r = row();
      if (!r) return null;
      // Its answer is the toggle's to wait on, busy (goal/G47.1, Q20).
      return S.readyPromise.then(function () { return keepAnswer('spirit/app/api.js'); }).then(function (s) { return s.activeApp({ key: key, active: r.active !== true }); }).then(null, function () { /* the row stays */ });
    }
    var t = ANSWER['spirit/element/search/app/rowFormToggle.js'].create(host, { on: false, words: '', press: press });
    t.root.hidden = true;
    // SHOWN OR HIDDEN ONLY WHEN THAT CHANGES (the -browser test's write watch: hidden set again to what it was is still a change of
    // the attribute, and it paints on every row change).
    function shown(on) { if (t.root.hidden === on) t.root.hidden = !on; }
    function paint() {
      if (gone) return;
      var r = row();
      // goal/G43.21, Andy: "an app that only has node:run and no node:mount or shell:mount cannot be "activated" show rowForms
      // should knows that.": the node says so on the row, runOnly, and the node refuses it too.
      if (!r || r.intrinsic === true || r.runOnly === true) { shown(false); return; }
      var on = r.active === true;
      t.set(on, [(on ? 'Deactivate' : 'Activate'), r.label].concat(parts.length ? [parts.join(' and ')] : []).join(' '));
      shown(true);
    }
    function ask() {
      S.readyPromise.then(function () { return keepAnswer('spirit/app/api.js'); }).then(function (s) { return s.searchApp({ q: '' }); }).then(function (got) {
        if (!gone) S.required.spirit.data.seatRows(S.required.spirit.data.app.data.branch, got.items);
      }, function () { /* the row comes with the stream */ });
    }
    // WHAT IT MOUNTS, read from <name>.json, again each time the row changes: a closed panel is kept, not made anew (goal/G43.17,
    // the box: "A closed layer is hidden, not destroyed"), so a read made once would show an old file when it is shown again.
    function readParts() {
      S.readyPromise.then(function () { return keepAnswer('spirit/fs/api.js'); }).then(function (s) { return s.loadFile('spirit/app/' + key + '/' + key + '.json'); }).then(function (text) {
        var j = JSON.parse(String(text));
        parts = (j.shell && j.shell.mount === true ? ['face'] : []).concat(j.node && j.node.mount === true ? ['server'] : []);
        paint();
      }).then(null, function () { /* a face that may not read the file: the words name no parts */ });
    }
    // WHO PAINTS, LISTENS (G41.32); a connect forgetting what is kept asks again.
    var offRow = S.required.spirit.data.app.data.watch(key, function () { paint(); readParts(); });
    var offAll = S.required.spirit.data.app.data.watch(function (k) { if (!k) ask(); });
    if (!row()) ask();
    paint();
    readParts();
    return { destroy: function () { gone = true; offRow(); offAll(); t.destroy(); } };
  }

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
