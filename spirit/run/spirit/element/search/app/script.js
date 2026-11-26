'use strict';
// spirit/run/spirit/element/search/app/script.js
// THE APP SELECTOR, A THIN ELEMENT OVER ITS OWN LIST, spirit/element/search/app/list/script.js, WHICH IT LOADS ITSELF
// (rule/26), as spirit/element/search/bundle/script.js is over bundle/list.js. Every search the same shape (goal/G43.32, the
// box: "every branch's search is search/<branch>.js, the selector, and its folder holds list.js, row.js and
// detail.js"; Andy: "cw, we certainly want, in this item, uniformity, in the search elements and their folders,
// contain list, row an detail elements."). Its test: ./test/script.js, the list judged through it.
//
//   spirit.required.spirit.element.search.app.create(container, options) -> the list's { list, refresh(), destroy() }
//     options        handed to the list as they are (face, toggle, onFace, visible, pick, servers, shells); the list is drawn in the container itself, so a
//                    pane fills the box it is given
// THE INTERFACES IT CALLS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1; Andy: "EVERY FUCKING ELEMENT REQUIRES THE FUCKING
// INTERFACES IT FUCKING NEEDS"): a require made while this file runs is part of its tree, so whoever requires it waits for them.
if (window.spirit && typeof window.spirit.requireScript === 'function') ['spirit/app/script.js'].forEach(function (p) { Promise.resolve(window.spirit.requireScript(p)).catch(function () {}); });
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): its list, as this file runs, so a caller's require waits for it.
  keepAnswer('spirit/element/search/app/list/script.js');
  function create(container, options) {
    return ANSWER['spirit/element/search/app/list/script.js'].create(container, options);
  }
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
