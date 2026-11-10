'use strict';
// spirit/run/spirit/app/server/element.js
// A FACE-APP SKELETON, AN ELEMENT (goal/G43.2). Andy, box: "both these apps will just be shell elements <name>.js, which paint
// their name in big letters in the center of their container". Its contract and its test: ./test/server.md and
// ./test/server.js. Its name is its identity.label, as the app family's cache holds it.
//
//   spirit.element.spirit.app.server.element.create(container) -> { destroy() }
(function () {
  var NAME = 'server';
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
  window.spirit.cacheManager('app');

  function create(container) {
    var box = document.createElement('div');
    box.style.cssText = 'display:flex;align-items:center;justify-content:center;flex:1;min-height:0;height:100%;font-size:4em';
    container.appendChild(box);
    function paint() {
      var row = window.spirit.data.app.data.rows()[NAME];
      box.textContent = row ? row.label : '';
    }
    function ask() {
      spirit.ready.then(function (s) { return s.app.searchApp({ q: '' }); }).then(function (got) {
        if (box.parentNode) window.spirit.data.seatRows(window.spirit.data.app.data.branch, got.items);
      });
    }
    // WHO PAINTS, LISTENS (Andy, G41.32); a connect forgetting what is kept, a word with no row, asks again.
    var offRow = window.spirit.data.app.data.watch(NAME, paint);
    var offAll = window.spirit.data.app.data.watch(function (key) { if (!key) ask(); });
    paint();
    if (!box.textContent) ask();
    return { destroy: function () { offRow(); offAll(); container.innerHTML = ''; } };
  }

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/server/element.js', { create: create }); });
}());
