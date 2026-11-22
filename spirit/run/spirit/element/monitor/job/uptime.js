'use strict';
// spirit/run/spirit/element/monitor/job/uptime.js
// UPTIME, A VALUE TILE OF THE NODE'S SPIRIT JOB (goal/G47.1, the box, the monitor tiles: "spirit/element/monitor/job/: six
// variants of the value tile ... Each requires the jobs family's interface and fills itself from the stats the node's spirit
// job publishes."). Its contract and its test: ./test/uptime.md and ./test/uptime.js.
//
//   spirit.required.spirit.element.monitor.job.uptime.create(container, { mode }) -> { destroy() }
//     mode   handed on to the value tile (../value.js): tile, the default
//
// Its value: how long the node has run (stats.uptimeSeconds): days and hours, hours and minutes, or minutes and seconds. Until the first reading, a dash. It watches the one row it reads, the spirit job of the
// page's node in the jobs family's cache, and writes its value on every change of that row.
// THE INTERFACE IT READS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1): a require made while this file runs is part of its tree.
if (window.spirit && typeof window.spirit.require === 'function') ['spirit/job/api.js', 'spirit/element/monitor/value.js'].forEach(function (p) { Promise.resolve(window.spirit.require(p)).catch(function () {}); });
(function () {
  var S = window.spirit = window.spirit || {};
  var parts = Promise.all([S.require('spirit/job/api.js'), S.require('spirit/element/monitor/value.js')]);
  function uptime(seconds) {
    var total = Math.floor(Number(seconds) || 0);
    var d = Math.floor(total / 86400), h = Math.floor((total % 86400) / 3600), m = Math.floor((total % 3600) / 60);
    return d ? d + 'd ' + h + 'h' : h ? h + 'h ' + m + 'm' : m + 'm ' + (total % 60) + 's';
  }
  function valueOf(d) { return uptime(d.uptimeSeconds); }

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
      tile = S.required.spirit.element.monitor.value.create(container, { icon: '⏱️', label: 'Uptime', mode: o.mode });
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

  S.require('spirit/element/installSpiritElement.js').then(function () { S.required.spirit.element.installSpiritElement(S, 'spirit/element/monitor/job/uptime.js', { create: create }); });
}());
