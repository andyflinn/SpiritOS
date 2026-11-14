'use strict';
// spirit/run/spirit/element/search/testicle.js
// THE TESTICLE SEARCH, A THIN ELEMENT OVER ITS OWN LIST, ./testicle/listElement.js, WHICH IT LOADS ITSELF (rule/26), as
// ./suite.js is over suite/listElement.js. Its folder holds listElement.js, rowElement.js and detailElement.js (goal/G43.32:
// "every branch's search is search/<branch>.js, the selector, and its folder holds listElement.js, rowElement.js and
// detailElement.js").
//
// goal/G47.1, the search cycle, the box: "The UI gets its first non-closable tab in the workbench centre pane: the testicle
// search, spirit/element/search/testicle.js, with its companion folder holding its rowElement and detailElement."
//
//   spirit.element.spirit.element.search.testicle.create(container, { pick }) -> { destroy() }
//     pick   called with (row, key) when a test row is clicked: testicle's face opens its detail in a closable tab
(function () {
  function createTesticleSearch(options) {
    var o = options || {};
    var root = document.createElement('div');
    root.className = 'testicle-search fill';
    var made = null;
    var gone = false;
    // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
    Promise.resolve(window.spirit.require('spirit/element/search/testicle/listElement.js')).then(function () {
      if (gone) return;
      made = window.spirit.element.spirit.element.search.testicle.listElement.create(root, { pick: o.pick });
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
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search/testicle.js', { create: function (container, options) { var root = createTesticleSearch(options); container.appendChild(root); return root; } }); });
})();
