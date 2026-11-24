'use strict';
// spirit/run/spirit/element/search/file/script.js
// THE FILE SELECTOR, A THIN ELEMENT OVER ITS OWN LIST, spirit/element/search/file/list/script.js, WHICH IT LOADS ITSELF
// (rule/26), as spirit/element/search/bundle/script.js is over bundle/list.js. Every search the same shape (goal/G43.32, the
// box: "every branch's search is search/<branch>.js, the selector, and its folder holds list.js, row.js and
// detail.js"; Andy: "cw, we certainly want, in this item, uniformity, in the search elements and their folders,
// contain list, row an detail elements."). Its test: ./test/script.js, the list judged through it.
//
//   spirit.required.spirit.element.search.file.create(container, options) -> the list (value, row, words(), refresh(), redraw(), sort(), destroy())
//     options        handed to the list as they are (face, toggle, accept, placeholder, all, empty, name, pick); the list is drawn in the container itself, so a
//                    pane fills the box it is given
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): its list, as this file runs, so a caller's require waits for it.
  keepAnswer('spirit/element/search/file/list/script.js');
  function create(container, options) {
    return ANSWER['spirit/element/search/file/list/script.js'].create(container, options);
  }
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
