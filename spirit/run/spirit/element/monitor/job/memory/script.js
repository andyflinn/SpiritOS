'use strict';
// spirit/run/spirit/element/monitor/job/memory/script.js
// MEMORY, A VALUE TILE OF THE NODE'S SPIRIT JOB (goal/G47.1, the box, the monitor tiles: "spirit/element/monitor/job/: six
// variants of the value tile ... Each requires the jobs family's interface and fills itself from the stats the node's spirit
// job publishes."). Its contract and its test: ./test/script.md and ./test/memory.js.
//
//   spirit.required.spirit.element.monitor.job.memory.create(container, { mode }) -> { destroy() }
//     mode   handed on to the value tile (../../value/script.js): tile, the default
//
// Its value: the resident memory of the node (stats.memory.rss), as bytes made readable. Until the first reading, a dash. It watches the one row it reads, the spirit job of the
// page's node in the jobs family's cache, and writes its value on every change of that row.
// THE INTERFACE IT READS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1): a require made while this file runs is part of its tree.
if (window.spirit && typeof window.spirit.requireScript === 'function') ['spirit/job/api.js', 'spirit/element/monitor/value/script.js'].forEach(function (p) { Promise.resolve(window.spirit.requireScript(p)).catch(function () {}); });
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  var S = window.spirit = window.spirit || {};
  var parts = Promise.all([keepAnswer('spirit/job/api.js'), keepAnswer('spirit/element/monitor/value/script.js')]);
  function valueOf(d) { return d.memory ? S.formatBytes(d.memory.rss) : '–'; }

  function create(container, options) {
    var o = options || {};
    var gone = false;
    var off = null;
    var tile = null;
    function paint() {
      if (gone || !tile) return;
      var job = S.required.spirit.data.job.data.job('spirit');
      var d = job && job.data && job.data.stats;
      tile.set(d ? valueOf(d) : '–');
    }
    parts.then(function () {
      if (gone) return;
      tile = ANSWER['spirit/element/monitor/value/script.js'].create(container, { icon: '🧠', label: 'Memory', mode: o.mode });
      paint();
      off = S.required.spirit.data.job.data.watch('spirit', paint);
    });
    return {
      destroy: function () {
        gone = true;
        if (off) off();
        if (tile) tile.destroy();
      },
    };
  }

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
