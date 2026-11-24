'use strict';
// spirit/run/spirit/app/info/element.js
// WHAT THIS NODE SAYS ABOUT ITSELF — the owner's screen, an app of spirit/app/ (goal/G43.24). Its contract and its test:
// ./test/info.md and ./test/info.js.
//
//   Andy: "i want an intrinsic app info, in which, for now the user can maintain both fields in this file, more to come.",
//   and on G43.24: "no i want those apps to basically be wrappers for spirit/element/ things....", "box that these apps must
//   mount in the new format of the new shell."
//
//   spirit.required.spirit.app.info.element.create(container, { open }) -> { destroy() }
//
// A WRAPPER, MOUNTED THE NEW SHELL'S WAY, as spirit/app/file/element.js is: it loads nodeInfo (spirit/element/nodeInfo/script.js),
// which holds all of Info, and mounts it, handing on the stack its mounter opens layers in.
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
  var parts = keepAnswer('spirit/element/nodeInfo/script.js');

  function create(container, opts) {
    var o = opts || {};
    var gone = false;
    var made = null;
    container.innerHTML = '';
    parts.then(function () {
      if (gone) return;
      made = ANSWER['spirit/element/nodeInfo/script.js'].create(container, { open: o.open });
    }, function () { if (!gone) container.textContent = 'Info could not be loaded.'; });
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
