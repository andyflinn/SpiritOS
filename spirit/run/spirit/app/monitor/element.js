'use strict';
// spirit/run/spirit/app/monitor/element.js
// AN APP THAT READS AND DISPLAYS A STREAM (goal/G43.6). Andy, box: "An app that reads and displays a stream, called "monitor". It
// resides in spirit.app.monitor, in the new format of app plugins, under one namespace." Its contract and its test:
// ./test/element.md and ./test/element.js. Since goal/G43.32 it is the app's main element (rule 4).
//
//   spirit.element.spirit.app.monitor.element.create(container) -> { destroy() }
//
// It shows one element, the spirit job's monitor, spirit/element/monitor/job.js (it was ./spirit.js; goal/G47.1, the box, the
// monitor tiles): six tiles, each an element of its own (goal/G47.1, Q24; Andy: "one
// container, subscribed to "spirit" that draws a few pretty tiles with icon and a value pair", "throw out "valued" completely").
// THE ELEMENT IT SHOWS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1): a require made while this file runs is part of its tree.
if (window.spirit && typeof window.spirit.require === 'function') ['spirit/element/monitor/job.js'].forEach(function (p) { Promise.resolve(window.spirit.require(p)).catch(function () {}); });
(function () {
  var S = window.spirit = window.spirit || {};
  var parts = Promise.resolve(S.require('spirit/element/monitor/job.js'));

  function create(container) {
    var gone = false;
    var shown = null;
    parts.then(function () {
      if (gone) return;
      shown = S.element.spirit.element.monitor.job.create(container);
    });
    return {
      destroy: function () {
        gone = true;
        if (shown) shown.destroy();
        container.innerHTML = '';
      },
    };
  }

  S.require('spirit/element/installSpiritElement.js').then(function () { S.required.spirit.element.installSpiritElement(S, 'spirit/app/monitor/element.js', { create: create }); });
}());
