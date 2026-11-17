'use strict';
// spirit/run/spirit/element/monitor/spirit.js
// THE SPIRIT JOB'S MONITOR, AS TILES (goal/G47.1, Q24). Andy: "one container, subscribed to "spirit" that draws a few pretty
// tiles with icon and a value pair. hard-coded, and drop about 50% of the stupid info it shows that interests NOBODY.", then
// "place the "monitor" element in run://spirit/element/monitor/spirit.js, where it'll be one of the elements that the "job" app
// later uses to decorate one of it's "job" details/monitors" and "keep it simple, with the values you suggested." Its
// contract and its test: ./test/spirit.md and ./test/spirit.js.
//
//   spirit.element.spirit.element.monitor.spirit.create(container) -> { destroy() }
//
// Six tiles, each an icon, a value and its name: memory, CPU, uptime, event loop delay (p99), connections, jobs running. The
// reading is the stats news of the node's spirit job, as the stream hands it to the jobs family's cache; each new reading
// writes the six values in place, nothing else redrawn. Until the first, it says it is waiting.
// THE INTERFACES IT CALLS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1): a require made while this file runs is part of its tree.
if (window.spirit && typeof window.spirit.require === 'function') ['spirit/job/api.js'].forEach(function (p) { Promise.resolve(window.spirit.require(p)).catch(function () {}); });
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
  var parts = Promise.all([S.require('spirit/job/api.js'), S.require('spirit/element/icon.js')]);

  function fixed(x, n) { return typeof x === 'number' && isFinite(x) ? x.toFixed(n) : '–'; }
  function uptime(seconds) {
    var total = Math.floor(Number(seconds) || 0);
    var d = Math.floor(total / 86400), h = Math.floor((total % 86400) / 3600), m = Math.floor((total % 3600) / 60);
    return d ? d + 'd ' + h + 'h' : h ? h + 'h ' + m + 'm' : m + 'm ' + (total % 60) + 's';
  }
  // THE SIX, HARD-CODED (Q24: "keep it simple, with the values you suggested").
  var TILES = [
    { glyph: '🧠', name: 'Memory', value: function (d) { return S.formatBytes(d.memory.rss); } },
    { glyph: '⚙️', name: 'CPU', value: function (d) { return fixed(d.cpu && d.cpu.percent, 1) + '%'; } },
    { glyph: '⏱️', name: 'Uptime', value: function (d) { return uptime(d.uptimeSeconds); } },
    { glyph: '🔁', name: 'Event loop delay', value: function (d) { return fixed(d.eventLoop && d.eventLoop.p99Ms, 1) + ' ms'; } },
    { glyph: '🔌', name: 'Connections', value: function (d) { return String(d.sseConnections == null ? '–' : d.sseConnections); } },
    { glyph: '🏃', name: 'Jobs running', value: function (d) { return String(((d.jobs || {}).byStatus || {}).running || 0); } },
  ];
  function reading() {
    // THE NODE'S STATS, news of spirit (goal/G43.20): { stats }.
    var job = S.data.job.data.job('spirit');
    return job && job.data && job.data.stats && job.data.stats.memory ? job.data.stats : null;
  }

  function create(container) {
    var gone = false;
    var off = null;
    var root = document.createElement('div');
    root.className = 'stats-grid';
    // Its box keeps what it holds inside, and scrolls when the container is smaller than its tiles.
    root.style.cssText = 'flex:1 1 auto;min-height:0;overflow:auto;align-content:start';
    root.textContent = 'waiting for stats';
    container.appendChild(root);
    var values = null;
    function build() {
      root.textContent = '';
      var I = S.element.spirit.element.icon;
      values = TILES.map(function (t) {
        var tile = root.appendChild(document.createElement('div'));
        tile.className = 'stat-tile';
        tile.style.overflow = 'hidden';
        tile.setAttribute('data-tile', t.name);
        I.create(tile, { glyph: t.glyph, size: 1.5 });
        var value = tile.appendChild(document.createElement('div'));
        value.className = 'value';
        var label = tile.appendChild(document.createElement('div'));
        label.className = 'label';
        label.textContent = t.name;
        return value;
      });
    }
    function paint() {
      if (gone) return;
      var d = reading();
      if (!d) return;
      if (!values) build();
      TILES.forEach(function (t, i) {
        var v = t.value(d);
        if (values[i].textContent !== v) values[i].textContent = v;
      });
    }
    parts.then(function () {
      if (gone) return;
      paint();
      // WHO PAINTS, LISTENS (Andy, G41.32): it shows the spirit job alone, so it watches that one row.
      off = S.data.job.data.watch('spirit', paint);
    });
    return {
      destroy: function () {
        gone = true;
        if (off) off();
        container.innerHTML = '';
      },
    };
  }

  S.require('spirit/element/installSpiritElement.js').then(function () { S.required.spirit.element.installSpiritElement(S, 'spirit/element/monitor/spirit.js', { create: create }); });
}());
