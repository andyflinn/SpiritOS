'use strict';
// spirit/run/spirit/app/introSpector/introSpector.js
// INTROSPECTOR, AN APP OF spirit/app/ (goal/G43.29; Andy: "fill in the box, same icons, shell:mount only."), moved here from
// shell/introSpector/. Its contract and its test: ./test/introSpector.md and ./test/introSpector.js.
//
//   spirit.element.spirit.app.introSpector.introSpector.create(container, { open }) -> { destroy() }
//
// A WRAPPER (Andy: "a wrapper for separate spirit/element/ files"): it only mounts. What it draws is
// spirit/element/introSpector.js; it loads that and draws it once it is here, so a tile pressed while it is on its way
// waits for it. The app selector's tile opens it.
(function () {
  var S = window.spirit = window.spirit || {};
  var face = S.require('spirit/element/introSpector.js');
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/introSpector/introSpector.js', {
    create: function (container, options) {
      var made = null;
      var gone = false;
      Promise.resolve(face).then(function () { if (!gone) made = S.element.spirit.element.introSpector.create(container, options); });
      return { destroy: function () { gone = true; if (made) made.destroy(); made = null; } };
    },
  }); });
}());
