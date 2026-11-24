'use strict';
// spirit/run/spirit/app/desk/element.js
// THE DESK ON A PAGE (goal/G43.27, requirement 23): the page half of ./desk.js, as spirit/app/agent/element.js is the
// agent's. Andy: "look at agent.js, that's how it's done...", "NO FUCKING HACKS.".
//
//   spirit.required.spirit.app.desk.element.create(container, { title, open }) -> { destroy() }
//
// The shell's app selector launches it (spirit/element/script.js). It draws the Desk page, spirit.required.spirit.app.desk.element.desk.desk
// (./element/desk/desk.js), which it requires itself, so it is loaded once desk.js is (spirit.requireScript answers once its tree
// has). A dialog the page opens goes in the mounter's stack through open.
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  // ITS APP'S INTERFACE AND DATA, IT LOADS ITSELF (goal/G47.1, box v142: "all of testicle's elements must subscribe to the
  // data they display", and spirit/test/app-child-browser.js for every element under spirit/app/; rule/26): desk's api.js and its
  // cache manager, data.js, which the page's one stream feeds; mounted alone, on a page nothing else loaded them on, it has them.
  if (window.spirit && typeof window.spirit.requireScript === 'function') Promise.resolve(keepAnswer('spirit/app/desk/api.js')).catch(function () {});
  if (window.spirit && typeof window.spirit.requireScript === 'function') Promise.resolve(keepAnswer('spirit/app/desk/api.js')).catch(function () {});
  var S = window.spirit;
  keepAnswer('spirit/app/desk/element/desk/desk.js');
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = {
    create: function (container, opts) {
      return ANSWER['spirit/app/desk/element/desk/desk.js'].create(container, opts || {});
    },
  };
}());
