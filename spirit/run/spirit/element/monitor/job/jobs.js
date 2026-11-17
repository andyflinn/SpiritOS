'use strict';
// spirit/run/spirit/element/monitor/job/jobs.js
// JOBS RUNNING, A VALUE TILE OF THE NODE'S SPIRIT JOB (goal/G47.1, the box, the monitor tiles: "spirit/element/monitor/job/: six
// variants of the value tile ... Each requires the jobs family's interface and fills itself from the stats the node's spirit
// job publishes."). Its contract and its test: ./test/jobs.md and ./test/jobs.js.
//
//   spirit.element.spirit.element.monitor.job.jobs.create(container, { mode }) -> { destroy() }
//     mode   handed on to the value tile (../value.js): tile, the default
//
// Its value: the node's jobs running now (stats.jobs.byStatus.running). Until the first reading, a dash. It watches the one row it reads, the spirit job of the
// page's node in the jobs family's cache, and writes its value on every change of that row.
// THE INTERFACE IT READS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1): a require made while this file runs is part of its tree.
if (window.spirit && typeof window.spirit.require === 'function') ['spirit/job/api.js', 'spirit/element/monitor/value.js'].forEach(function (p) { Promise.resolve(window.spirit.require(p)).catch(function () {}); });
(function () {
  var S = window.spirit = window.spirit || {};
  var parts = Promise.all([S.require('spirit/job/api.js'), S.require('spirit/element/monitor/value.js')]);
  function valueOf(d) { return String(((d.jobs || {}).byStatus || {}).running || 0); }

  function create(container, options) {
    var o = options || {};
    var gone = false;
    var off = null;
    var tile = null;
    function paint() {
      if (gone || !tile) return;
      var job = S.data.job.data.job('spirit');
      var d = job && job.data && job.data.stats;
      tile.set(d ? valueOf(d) : '–');
    }
    parts.then(function () {
      if (gone) return;
      tile = S.element.spirit.element.monitor.value.create(container, { icon: '🏃', label: 'Jobs running', mode: o.mode });
      paint();
      off = S.data.job.data.watch('spirit', paint);
    });
    return {
      destroy: function () {
        gone = true;
        if (off) off();
        if (tile) tile.destroy();
      },
    };
  }

  S.require('spirit/element/installSpiritElement.js').then(function () { S.required.spirit.element.installSpiritElement(S, 'spirit/element/monitor/job/jobs.js', { create: create }); });
}());
