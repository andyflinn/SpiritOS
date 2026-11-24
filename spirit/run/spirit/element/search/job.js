'use strict';
// spirit/run/spirit/element/search/job.js
// ONE SHELL ELEMENT: the job selector, the search of the job branch (goal/G43.32; Andy: "uniformity, in the search elements
// and their folders, contain list, row an detail elements.", "all the others should adhere to the directory structure, as
// implied by MANY design decisions."). Its contract and its test: ./test/job.md and ./test/job.js.
//
// A THIN SELECTOR OVER ITS OWN LIST, spirit/element/search/job/list.js, WHICH IT LOADS ITSELF (rule/26), as the
// bundle selector is over its list. The list draws the node's jobs from spirit.required.spirit.data, each row ./job/row.js, and a
// press opens ./job/detail.js over it.
//
//   spirit.required.spirit.element.search.job.create(container, options) -> root
//     options.open   the mounter's panel stack's open, where a job's detail opens; with none, the list's own stack
//     options.face, options.placeholder, options.pick   handed to the list: 'dropdown' a closed field (box v123), else the pane
//     root.destroy() lets its list go, and takes itself out of its container
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  function createJobSelector(options) {
    var o = options || {};
    var root = document.createElement('div');
    root.className = 'job-selector fill';
    // Its box keeps what it holds inside (the box: "an element container always must constrain its children's display to its own
    // size"; spirit-sibling-browser.js: overflow not visible).
    root.style.overflow = 'hidden';
    var made = null;
    var gone = false;
    // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
    Promise.resolve(keepAnswer('spirit/element/search/job/list.js')).then(function () {
      if (gone) return;
      made = ANSWER['spirit/element/search/job/list.js'].create(root, { open: o.open, face: o.face, placeholder: o.placeholder, pick: o.pick });
    });
    root.destroy = function () {
      gone = true;
      if (made) made.destroy();
      made = null;
      if (root.parentNode) root.parentNode.removeChild(root);
    };
    return root;
  }

  // THE SHELL'S ELEMENT SHAPE (goal/G41.19, box v23: "every element gets a container and appends itself").
  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: function (container, options) { var root = createJobSelector(options); container.appendChild(root); return root; } };
})();
