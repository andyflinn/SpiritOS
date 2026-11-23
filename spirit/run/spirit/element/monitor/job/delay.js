'use strict';
// spirit/run/spirit/element/monitor/job/delay.js
// EVENT LOOP DELAY, A VALUE TILE OF THE NODE'S SPIRIT JOB (goal/G47.1, the box, the monitor tiles: "spirit/element/monitor/job/: six
// variants of the value tile ... Each requires the jobs family's interface and fills itself from the stats the node's spirit
// job publishes."). Its contract and its test: ./test/delay.md and ./test/delay.js.
//
//   spirit.required.spirit.element.monitor.job.delay.create(container, { mode }) -> { destroy() }
//     mode   handed on to the value tile (../value.js): tile, the default
//
// Its value: the node's event loop delay, its 99th percentile (stats.eventLoop.p99Ms), one decimal and ms. Until the first reading, a dash. It watches the one row it reads, the spirit job of the
// page's node in the jobs family's cache, and writes its value on every change of that row.
// THE INTERFACE IT READS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1): a require made while this file runs is part of its tree.
if (window.spirit && typeof window.spirit.requireScript === 'function') ['spirit/job/api.js', 'spirit/element/monitor/value.js'].forEach(function (p) { Promise.resolve(window.spirit.requireScript(p)).catch(function () {}); });
(function () {
  var S = window.spirit = window.spirit || {};
  var parts = Promise.all([S.requireScript('spirit/job/api.js'), S.requireScript('spirit/element/monitor/value.js')]);
  function fixed(x, n) { return typeof x === 'number' && isFinite(x) ? x.toFixed(n) : '–'; }
  function valueOf(d) { return fixed(d.eventLoop && d.eventLoop.p99Ms, 1) + ' ms'; }

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
      tile = S.required.spirit.element.monitor.value.create(container, { icon: '🔁', label: 'Event loop delay', mode: o.mode });
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

  S.requireScript('spirit/element/installSpiritElement.js').then(function () { S.required.spirit.element.installSpiritElement(S, 'spirit/element/monitor/job/delay.js', { create: create }); });
}());
