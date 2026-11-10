'use strict';
// spirit/run/spirit/app/monitor/element.js
// AN APP THAT READS AND DISPLAYS A STREAM (goal/G43.6). Andy, box: "An app that reads and displays a stream, called "monitor". It
// resides in spirit.app.monitor, in the new format of app plugins, under one namespace." Its contract and its test:
// ./test/element.md and ./test/element.js. Since goal/G43.32 it is the app's main element (rule 4; the box: "Monitor too: its
// createApp becomes its element.js"), placed at its path like every other.
//
//   spirit.element.spirit.app.monitor.element.create(container) -> { destroy() }
//
// One valued that fills the app: the stats news of the node's spirit job as the stream hands it to the jobs family's cache, each number
// and count one row. "Jobs by status replaces old Stats' Active jobs, so no list of finished statuses is copied."
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
  var parts = Promise.all([S.require('spirit/element/search/valued.js'), S.cacheManager('job')]);
  var COLUMNS = [
    { field: 'group', label: 'Group', sort: 'text' },
    { field: 'name', label: 'Name', sort: 'text' },
    { field: 'value', label: 'Value' },
  ];

  function uptime(seconds) {
    var total = Math.floor(seconds);
    return Math.floor(total / 3600) + 'h ' + Math.floor((total % 3600) / 60) + 'm ' + (total % 60) + 's';
  }
  function reading() {
    // THE NODE'S STATS, news of spirit (goal/G43.20): { stats }.
    var job = S.data.job.data.job('spirit');
    return job && job.data && job.data.stats && job.data.stats.memory ? job.data.stats : null;
  }
  // A number the reading leaves out (null before its first sample) shows as a dash, never throws.
  function fixed(x, n) { return typeof x === 'number' && isFinite(x) ? x.toFixed(n) : '–'; }
  function rowsOf(d) {
    var rows = [];
    function number(name, value) { rows.push({ group: 'Server', name: name, value: String(value) }); }
    function counts(group, all) {
      var keys = Object.keys(all || {});
      if (!keys.length) rows.push({ group: group, name: '(none)', value: '' });
      keys.forEach(function (k) { rows.push({ group: group, name: k, value: String(all[k]) }); });
    }
    number('Memory (RSS)', S.formatBytes(d.memory.rss));
    number('Heap used', S.formatBytes(d.memory.heapUsed));
    number('CPU', fixed(d.cpu && d.cpu.percent, 1) + '%');
    number('Uptime', uptime(d.uptimeSeconds));
    number('Event loop mean', fixed(d.eventLoop && d.eventLoop.meanMs, 2) + ' ms');
    number('Event loop max', fixed(d.eventLoop && d.eventLoop.maxMs, 2) + ' ms');
    number('Event loop p99', fixed(d.eventLoop && d.eventLoop.p99Ms, 2) + ' ms');
    number('Files', d.filesystem.files);
    number('Folders', d.filesystem.folders);
    number('SSE connections', d.sseConnections);
    number('Requests total', d.requests.total);
    counts('Jobs by status', d.jobs.byStatus);
    counts('Files by MIME type', d.filesystem.byMimeType);
    counts('Requests by method', d.requests.byMethod);
    counts('Requests by status class', d.requests.byStatusClass);
    return rows;
  }
  function rows() {
    var d = reading();
    return d ? rowsOf(d) : [{ group: 'Monitor', name: 'waiting for stats', value: '' }];
  }

  function create(container) {
    var gone = false;
    var list = null;
    var off = null;
    parts.then(function () {
      if (gone) return;
      list = S.element.spirit.element.search.valued.create(container, { rows: rows, columns: COLUMNS });
      // WHO PAINTS, LISTENS (Andy, G41.32): each new reading repaints. It shows the spirit job alone, so it watches that one
      // row (goal/G43.32; Andy: "wsl, the clean fix, do it.").
      off = S.data.job.data.watch('spirit', function () { list.redraw(); });
    });
    return {
      destroy: function () {
        gone = true;
        if (off) off();
        if (list) list.destroy();
        container.innerHTML = '';
      },
    };
  }

  S.require('spirit/element/installSpiritElement.js').then(function () { S.required.spirit.element.installSpiritElement(S, 'spirit/app/monitor/element.js', { create: create }); });
}());
