// spirit/run/spirit/app/monitor/monitor.js
// AN APP THAT READS AND DISPLAYS A STREAM (goal/G43.6). Andy, box: "An app that reads and displays a stream, called "monitor". It
// resides in spirit.app.monitor, in the new format of app plugins, under one namespace." Its contract and its test:
// ./test/monitor.md and ./test/monitor.js.
//
//   spirit.app.monitor.createApp(container) -> { destroy() }
//
// One valued that fills the app: the node's server-stats job as the stream hands it to the jobs family's cache, each number
// and count one row. "Jobs by status replaces old Stats' Active jobs, so no list of finished statuses is copied."
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
  var parts = Promise.all([S.require('spirit/element/search/valued.js'), S.cacheManager('jobs')]);
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
    var job = S.data.jobs.data.find(function (j) { return j && j.type === 'server-stats'; });
    return job && job.data && job.data.memory ? job.data : null;
  }
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
    number('CPU', d.cpu.percent.toFixed(1) + '%');
    number('Uptime', uptime(d.uptimeSeconds));
    number('Event loop mean', d.eventLoop.meanMs.toFixed(2) + ' ms');
    number('Event loop max', d.eventLoop.maxMs.toFixed(2) + ' ms');
    number('Event loop p99', d.eventLoop.p99Ms.toFixed(2) + ' ms');
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
      list = S.element.valued.create(container, { rows: rows, columns: COLUMNS });
      // WHO PAINTS, LISTENS (Andy, G41.32): each new reading repaints. A forgotten set or a job gone may be the reading's.
      off = S.data.jobs.data.watch(function (id, job) { if (!id || !job || job.type === 'server-stats') list.redraw(); });
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

  (S.app = S.app || {}).monitor = { createApp: create };
}());
