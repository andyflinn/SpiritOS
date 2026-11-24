'use strict';
// spirit/run/spirit/app/testicle/element/search/suite.js
// THE SUITE SELECTOR, A THIN ELEMENT OVER ITS OWN LIST, ./suite/list.js, WHICH IT LOADS ITSELF (rule/26), as ./job.js is
// over job/list.js. testicle's (goal/G47.1, the UI cycle, the box: "Since testicle is intrinsic, its elements go into
// spirit/element/ in the standard way: the suite search is spirit/app/testicle/element/search/suite.js and its folder").
//
//   spirit.required.spirit.app.testicle.element.search.suite.create(container, { script, face, placeholder, all, pick }) -> { destroy() }
//     script   the production script whose suites it lists, scoped to run://
//     face, placeholder, all, pick   handed to its list as they are (./suite/list.js)
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  // ITS APP'S INTERFACE AND DATA, IT LOADS ITSELF (goal/G47.1, box v142: "all of testicle's elements must subscribe to the data they
  // display"; box v140; rule 26): testicle's api.js and its cache manager, data.js, which the page's one stream feeds; mounted
  // alone, on a page nothing else loaded them on, it has them.
  if (window.spirit && typeof window.spirit.requireScript === 'function') Promise.resolve(keepAnswer('spirit/app/testicle/api.js')).catch(function () {});
  if (window.spirit && typeof window.spirit.requireScript === 'function') Promise.resolve(keepAnswer('spirit/app/testicle/api.js')).catch(function () {});
  function createSuiteSelector(options) {
    var o = options || {};
    var root = document.createElement('div');
    root.className = 'suite-selector fill';
    // Its box keeps what it holds inside (goal/G47.1, the box: "an element container always must constrain its children's display to
    // its own size"; overflow not visible): its list scrolls in itself, a dropdown's pop-up stands in the page's top layer.
    root.style.overflow = 'hidden';
    var made = null;
    var gone = false;
    // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
    Promise.resolve(keepAnswer('spirit/app/testicle/element/search/suite/list.js')).then(function () {
      if (gone) return;
      made = ANSWER['spirit/app/testicle/element/search/suite/list.js'].create(root, { script: o.script, face: o.face, placeholder: o.placeholder, all: o.all, pick: o.pick });
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
  module.exports = { create: function (container, options) { var root = createSuiteSelector(options); container.appendChild(root); return root; } };
})();
