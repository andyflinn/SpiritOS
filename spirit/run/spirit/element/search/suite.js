'use strict';
// spirit/run/spirit/element/search/suite.js
// THE SUITE SELECTOR, A THIN ELEMENT OVER ITS OWN LIST, ./suite/listElement.js, WHICH IT LOADS ITSELF (rule/26), as ./job.js is
// over job/listElement.js. testicle's (goal/G47.1, the UI cycle, the box: "Since testicle is intrinsic, its elements go into
// spirit/element/ in the standard way: the suite search is spirit/element/search/suite.js and its folder").
//
//   spirit.element.spirit.element.search.suite.create(container, { file }) -> { destroy() }
//     file   the production file whose suites it lists, scoped to run://
(function () {
  function createSuiteSelector(options) {
    var o = options || {};
    var root = document.createElement('div');
    root.className = 'suite-selector fill';
    var made = null;
    var gone = false;
    // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
    Promise.resolve(window.spirit.require('spirit/element/search/suite/listElement.js')).then(function () {
      if (gone) return;
      made = window.spirit.element.spirit.element.search.suite.listElement.create(root, { file: o.file });
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
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search/suite.js', { create: function (container, options) { var root = createSuiteSelector(options); container.appendChild(root); return root; } }); });
})();
