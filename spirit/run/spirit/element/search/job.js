'use strict';
// spirit/run/spirit/element/search/job.js
// ONE SHELL ELEMENT: the job selector, the search of the job branch (goal/G43.32; Andy: "uniformity, in the search elements
// and their folders, contain list, row an detail elements.", "all the others should adhere to the directory structure, as
// implied by MANY design decisions."). Its contract and its test: ./test/job.md and ./test/job.js.
//
// A THIN SELECTOR OVER ITS OWN LIST, spirit/element/search/job/listElement.js, WHICH IT LOADS ITSELF (rule/26), as the
// bundle selector is over its list. The list draws the node's jobs from spirit.data, each row ./job/rowElement.js, and a
// press opens ./job/detailElement.js over it.
//
//   spirit.element.spirit.element.search.job.create(container, options) -> root
//     options.open   the mounter's panel stack's open, where a job's detail opens; with none, the list's own stack
//     root.destroy() lets its list go, and takes itself out of its container
(function () {
  function createJobSelector(options) {
    var o = options || {};
    var root = document.createElement('div');
    root.className = 'job-selector fill';
    var made = null;
    var gone = false;
    // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
    Promise.resolve(window.spirit.require('spirit/element/search/job/listElement.js')).then(function () {
      if (gone) return;
      made = window.spirit.element.spirit.element.search.job.listElement.create(root, { open: o.open });
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
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search/job.js', { create: function (container, options) { var root = createJobSelector(options); container.appendChild(root); return root; } }); });
})();
