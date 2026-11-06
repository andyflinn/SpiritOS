// The first of the five shell apps to leave index.html (CLEANUP-PLAN
// step 5). Same app, same tiles, same server-stats job — only its home
// changed: app/stats/stats.js with a sibling manifest, discovered like
// any other app, declared eagerly at boot because it is intrinsic, and
// fetched only when its tile is opened.
//
// Its id changed with its folder, 'stats' to 'shell/stats'. Three places
// know that: the manifest here, INTRINSIC_APP_FOLDERS and APP_ID_RENAMES
// in shell.js, and the Spirit group's member list in index.html. They
// moved in this same commit — a rename map that lands later is a map
// that lands after pruneStalePreferences has already thrown the
// operator's overrides away.
//
// formatUptime, tileHtml and countsHtml came with it: nothing else in
// index.html used them.

// Duplicated from app/jobs/jobs.js, which has its own copy for the same
// reason — the canonical set lives in js/jobs.js, node-side, and never
// reaches the browser. Two copies is one too many: worth an isomorphic
// kernel constant both this and js/jobs.js read, in a sitting allowed to
// touch the kernel.
var STATS_TERMINAL_STATUSES = ['completed', 'failed', 'cancelled', 'stopped'];

function statsFormatUptime(seconds) {
  var total = Math.floor(seconds);
  var h = Math.floor(total / 3600);
  var m = Math.floor((total % 3600) / 60);
  var s = total % 60;
  return h + 'h ' + m + 'm ' + s + 's';
}

function statsTileHtml(value, label, wide, launchAppId) {
  var classes = 'stat-tile' + (wide ? ' wide' : '') + (launchAppId ? ' clickable' : '');
  var attr = launchAppId ? ' data-launch-app="' + launchAppId + '"' : '';
  return '<div class="' + classes + '"' + attr + '>' +
    '<div class="value">' + value + '</div>' +
    '<div class="label">' + label + '</div>' +
    '</div>';
}

// The same rows the launchers show a file's Path and Size in
// (.file-info-row, renderFileInfoBubble in shell.js): a label and its
// value on one line, at reading size. These used to be 13px text joined
// with <br> — "text/plain: 4" as a run-on line, where the count is the
// part being read and it sat wherever the label happened to end. One row
// type, one voice (UI_DESIGN_STYLE.md).
//
// Escaped, which the <br> version was not: byMethod is keyed by whatever
// verb a request arrived with, so a client on loopback chooses that
// string, and it was going into innerHTML as it stood.
function statsCountsHtml(counts) {
  var keys = Object.keys(counts);
  var escape = spirit.escapeHtml;
  if (keys.length === 0) return '<div class="file-info-row">(none)</div>';
  return keys.map(function (k) {
    return '<div class="file-info-row">' +
      '<span class="file-info-label">' + escape(k) + '</span>' +
      '<span>' + escape(String(counts[k])) + '</span>' +
      '</div>';
  }).join('');
}

// THE NODE'S server-stats JOB, AS spirit.data KEEPS IT (goal/G41.28; Andy: "anything not using the new spiritData.js and
// it's buddies clientCacheManager.js must do so in this item. no exceptions."): the jobs family's cache manager
// (spirit.data.jobs.data), loaded here; the tiles are drawn again each time that job changes there.
var statsParts = Promise.resolve(spirit.cacheManager('jobs'));
function statsJob() {
  var J = ((window.spirit.data || {}).jobs || {}).data;
  return J ? J.find(function (job) { return job && job.type === 'server-stats'; }) : null;
}
function statsDraw() { statsRender(); }

spirit.shell.activateApp({
  mount: function (container) {
    statsParts.then(function () {
      var J = ((window.spirit.data || {}).jobs || {}).data;
      if (J) J.watch(function (id, job) { if (!id || (job && job.type === 'server-stats')) statsDraw(); });
      statsDraw();
    }, function () { /* the tiles wait for stats */ });
    container.innerHTML = '<div class="stats-grid" id="stats-grid"></div>';
    document.getElementById('stats-grid').addEventListener('click', function (event) {
      var tile = event.target.closest('[data-launch-app]');
      if (!tile) return;
      // Still the shell's launcher: an app opening another app is shell
      // business, and `api` has no method for it yet. CLEANUP-PLAN step 6
      // is where the system-app api surface gets decided; until then this
      // is the same call index.html made, from a different file.
      spirit.shell.launchApp(tile.dataset.launchApp);
    });
  },

  render: function () { statsRender(); },
});

function statsRender() {
    var grid = document.getElementById('stats-grid');
    if (!grid) return;

    var job = statsJob();
    if (!job || !job.data || !job.data.memory) {
      grid.innerHTML = statsTileHtml('…', 'waiting for stats', true);
      return;
    }

    var d = job.data;
    var html = '';
    html += statsTileHtml(spirit.formatBytes(d.memory.rss), 'Memory (RSS)');
    html += statsTileHtml(spirit.formatBytes(d.memory.heapUsed), 'Heap used');
    html += statsTileHtml(d.cpu.percent.toFixed(1) + '%', 'CPU');
    html += statsTileHtml(statsFormatUptime(d.uptimeSeconds), 'Uptime');
    html += statsTileHtml(d.eventLoop.meanMs.toFixed(2) + ' ms', 'Event loop mean');
    html += statsTileHtml(d.eventLoop.maxMs.toFixed(2) + ' ms', 'Event loop max');
    html += statsTileHtml(d.eventLoop.p99Ms.toFixed(2) + ' ms', 'Event loop p99');
    // No launch since Files moved to spirit/app/file/ (goal/G43.17), which the old shell does not open.
    html += statsTileHtml(d.filesystem.files, 'Files');
    html += statsTileHtml(d.filesystem.folders, 'Folders');
    html += statsTileHtml(d.sseConnections, 'SSE connections');
    html += statsTileHtml(d.requests.total, 'Requests total');

    var activeJobs = 0;
    Object.keys(d.jobs.byStatus).forEach(function (status) {
      if (STATS_TERMINAL_STATUSES.indexOf(status) === -1) activeJobs += d.jobs.byStatus[status];
    });
    html += statsTileHtml(activeJobs, 'Active jobs', false, 'shell/jobs');

    html += '<div class="stat-tile wide"><div class="label">Files by MIME type</div>' +
      statsCountsHtml(d.filesystem.byMimeType) + '</div>';
    html += '<div class="stat-tile wide"><div class="label">Requests by method</div>' +
      statsCountsHtml(d.requests.byMethod) + '</div>';
    html += '<div class="stat-tile wide"><div class="label">Requests by status class</div>' +
      statsCountsHtml(d.requests.byStatusClass) + '</div>';

    grid.innerHTML = html;
}
