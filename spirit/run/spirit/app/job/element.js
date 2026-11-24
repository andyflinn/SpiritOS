'use strict';
// spirit/run/spirit/app/job/element.js
// THE JOB MONITOR, AN APP OF spirit/app/ (goal/G43.29; Andy: "fill in the box, same icons, shell:mount only."), moved here
// from shell/job/. Its contract and its test: ./test/element.md and ./test/element.js.
//
//   spirit.required.spirit.app.job.element.create(container, { open }) -> { destroy() }
//
// A WRAPPER (Andy: "a wrapper for separate spirit/element/ files"): it only mounts. What it draws is the job search,
// spirit/element/search/job/script.js (goal/G43.32), whose list's rows open the job's detail over it; it loads that and draws it
// once it is here, so a tile pressed while it is on its way waits for it. The app selector's tile opens it, handing its
// stack's open.
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  var S = window.spirit = window.spirit || {};
  var face = keepAnswer('spirit/element/search/job/script.js');
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = {
    create: function (container, options) {
      var made = null;
      var gone = false;
      Promise.resolve(face).then(function () { if (!gone) made = ANSWER['spirit/element/search/job/script.js'].create(container, { open: (options || {}).open }); });
      return { destroy: function () { gone = true; if (made) made.destroy(); made = null; } };
    },
  };
}());
