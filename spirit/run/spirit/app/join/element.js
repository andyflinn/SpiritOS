'use strict';
// spirit/run/spirit/app/join/element.js
// THE JOIN APP, an app of spirit/app/ (goal/G43.26). Andy: "JOIN IS A FUCKING APP and DOES NOT FUCKING DRAG HALF OF THE OLD
// SHIT INTO THE NEW!", and "the join icon sits next to all other icons on a shell (SO IT's A FCUKING APP, LIKE IT ALWAYS
// WAS)". Its contract and its test: ./test/join.md and ./test/join.js.
//
//   spirit.required.spirit.app.join.element.create(container, {}) -> { destroy() }
//
// A WRAPPER, MOUNTED THE NEW SHELL'S WAY, as spirit/app/info/element.js is: it loads joinList (spirit/element/joinList.js),
// which holds all of Join, and mounts it. Its steps are its manifest's, join.json.
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
  var parts = keepAnswer('spirit/element/joinList.js');

  function create(container) {
    var gone = false;
    var made = null;
    container.innerHTML = '';
    parts.then(function () {
      if (gone) return;
      made = ANSWER['spirit/element/joinList.js'].create(container, {});
    }, function () { if (!gone) container.textContent = 'Join could not be loaded.'; });
    return {
      destroy: function () {
        gone = true;
        if (made) made.destroy();
        made = null;
        container.innerHTML = '';
      },
    };
  }

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
