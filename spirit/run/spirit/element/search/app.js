'use strict';
// spirit/run/spirit/element/search/app.js
// THE APP SELECTOR, A THIN ELEMENT OVER ITS OWN LIST, spirit/element/search/app/listElement.js, WHICH IT LOADS ITSELF
// (rule/26), as spirit/element/search/bundle.js is over bundle/listElement.js. Every search the same shape (goal/G43.32, the
// box: "every branch's search is search/<branch>.js, the selector, and its folder holds listElement.js, rowElement.js and
// detailElement.js"; Andy: "cw, we certainly want, in this item, uniformity, in the search elements and their folders,
// contain list, row an detail elements."). Its test: ./test/app.js, the list judged through it.
//
//   spirit.element.spirit.element.search.app.create(container, options) -> the list's { list, refresh(), destroy() }
//     options        handed to the list as they are (face, toggle, onFace, visible, pick, servers, shells); the list is drawn in the container itself, so a
//                    pane fills the box it is given
(function () {
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): its list, as this file runs, so a caller's require waits for it.
  window.spirit.require('spirit/element/search/app/listElement.js');
  function create(container, options) {
    return window.spirit.element.spirit.element.search.app.listElement.create(container, options);
  }
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search/app.js', { create: create }); });
}());
