'use strict';
// spirit/run/spirit/app/join/join.js
// THE JOIN APP, an app of spirit/app/ (goal/G43.26). Andy: "JOIN IS A FUCKING APP and DOES NOT FUCKING DRAG HALF OF THE OLD
// SHIT INTO THE NEW!", and "the join icon sits next to all other icons on a shell (SO IT's A FCUKING APP, LIKE IT ALWAYS
// WAS)". Its contract and its test: ./test/join.md and ./test/join.js.
//
//   spirit.element.spirit.app.join.join.create(container, {}) -> { destroy() }
//
// A WRAPPER, MOUNTED THE NEW SHELL'S WAY, as spirit/app/info/info.js is: it loads joinList (spirit/element/joinList.js),
// which holds all of Join, and mounts it. Its steps are its manifest's, join.json.
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
  var parts = S.require('spirit/element/joinList.js');

  function create(container) {
    var gone = false;
    var made = null;
    container.innerHTML = '';
    parts.then(function () {
      if (gone) return;
      made = S.element.spirit.element.joinList.create(container, {});
    }, function () { if (!gone) container.textContent = 'Join could not be loaded.'; });
    return {
      destroy: function () {
        gone = true;
        if (made) made.destroy();
        made = null;
        container.innerHTML = '';
      },
    };
  }

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/join/join.js', { create: create }); });
}());
