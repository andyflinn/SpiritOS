'use strict';
// spirit/run/spirit/app/jobs/element.js
// THE JOB MONITOR, AN APP OF spirit/app/ (goal/G43.29; Andy: "fill in the box, same icons, shell:mount only."), moved here
// from shell/jobs/. Its contract and its test: ./test/jobs.md and ./test/jobs.js.
//
//   spirit.element.spirit.app.jobs.element.create(container, { open }) -> { destroy() }
//
// A WRAPPER (Andy: "a wrapper for separate spirit/element/ files"): it only mounts. What it draws is spirit/element/jobs.js,
// the list, whose rows open spirit/element/jobDetail.js over it; it loads that and draws it once it is here, so a tile
// pressed while it is on its way waits for it. The app selector's tile opens it, handing its stack's open.
(function () {
  var S = window.spirit = window.spirit || {};
  var face = S.require('spirit/element/jobs.js');
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/jobs/element.js', {
    create: function (container, options) {
      var made = null;
      var gone = false;
      Promise.resolve(face).then(function () { if (!gone) made = S.element.spirit.element.jobs.create(container, options); });
      return { destroy: function () { gone = true; if (made) made.destroy(); made = null; } };
    },
  }); });
}());
