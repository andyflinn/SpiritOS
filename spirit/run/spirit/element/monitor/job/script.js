'use strict';
// spirit/run/spirit/element/monitor/job/script.js (it was spirit/element/monitor/spirit.js)
// THE SPIRIT JOB'S MONITOR, ITS SIX TILES LAID OUT (goal/G47.1, the box, the monitor tiles: "spirit/element/monitor/job/script.js
// replaces spirit/element/monitor/spirit.js: it lays out the six job tiles. The monitor app's wrapper mounts it, and the old
// file goes."). Its contract and its test: ./test/script.md and ./test/job.js.
//
//   spirit.required.spirit.element.monitor.job.create(container) -> { destroy() }
//
// The six, in this order, each an element of its own in ./job/ that fills itself from the node's spirit job: memory, CPU,
// uptime, event loop delay (p99), connections, jobs running. It reads nothing itself; each tile watches what it shows.
// THE ELEMENTS IT LAYS OUT, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1): a require made while this file runs is part of its tree.
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  var S = window.spirit = window.spirit || {};
  var TILES = ['memory', 'cpu', 'uptime', 'delay', 'connections', 'running'];
  var parts = Promise.all(TILES.map(function (n) { return S.requireScript('spirit/element/monitor/job/' + n + '/script.js'); }));

  function create(container) {
    var gone = false;
    var made = [];
    var root = document.createElement('div');
    root.className = 'stats-grid';
    // Its box keeps what it holds inside, and scrolls when the container is smaller than its tiles.
    root.style.cssText = 'flex:1 1 auto;min-height:0;overflow:auto;align-content:start';
    container.appendChild(root);
    parts.then(function () {
      if (gone) return;
      var J = module.exports;
      made = TILES.map(function (n) { return J[n].create(root); });
    });
    return {
      destroy: function () {
        gone = true;
        made.forEach(function (m) { m.destroy(); });
        made = [];
        if (root.parentNode) root.parentNode.removeChild(root);
      },
    };
  }

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
