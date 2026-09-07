// The second of the five to leave index.html (CLEANUP-PLAN step 5.2).
// Same app: the same table, the same throttle, the same sticky log
// scroll, the same spirit.core.jobs calls. Its id changed with its
// folder, 'jobs' to 'app/jobs' — see APP_ID_RENAMES and
// INTRINSIC_APP_FOLDERS in js/client/shell.js, both updated in this same
// commit, and the three call sites that name it: the Spirit group's
// member list, the Process Browser's "start and go watch it", and the
// Stats app's Active jobs tile.
//
// The CSS stays in index.html: .jobs-table, .job-row and the log-panel
// rules are shell chrome that the Apps and Natter tables also use.

var JOBS_ICON = spirit.core.const.ICON;
var jobsEscapeHtml = spirit.core.util.escapeHtml;

// The canonical set lives in js/jobs.js, node-side, and never reaches
// the browser; app/stats/stats.js keeps its own copy for the same
// reason. Two copies is one too many — worth an isomorphic constant in
// the kernel that both this and js/jobs.js read, in a sitting that is
// allowed to touch the kernel.
var TERMINAL_STATUSES = ['completed', 'failed', 'cancelled', 'stopped'];

var STATUS_ICON = {
  pending: JOBS_ICON.LOADING,
  running: JOBS_ICON.RUN,
  completed: JOBS_ICON.OK,
  failed: JOBS_ICON.ERROR,
  cancelled: JOBS_ICON.STOP,
  stopped: JOBS_ICON.STOP,
  error: JOBS_ICON.WARNING,
};

var expandedJobId = null; // the one job row currently expanded to show its full log, or null
var currentJobsById = null; // same Map reference every render() call — cached so the expand/collapse click handler (in mount, no render args) can still re-render on demand

function formatLogEntries(job) {
  if (!job.log || job.log.length === 0) return '<div class="job-log-empty">(no log entries yet)</div>';
  return job.log.map(function (entry) {
    return '<div class="job-log-entry"><span class="job-log-time">' +
      new Date(entry.timestamp).toLocaleTimeString() + '</span>' + jobsEscapeHtml(entry.message) + '</div>';
  }).join('');
}

function renderJobRow(job) {
  var icon = STATUS_ICON[job.status] || '';
  var lastLog = job.log && job.log.length ? job.log[job.log.length - 1].message : '';
  var isTerminal = TERMINAL_STATUSES.indexOf(job.status) !== -1;
  var canCancel = job.kind === 'process' && !isTerminal;
  var isExpanded = job.id === expandedJobId;

  var actionHtml = canCancel
    ? '<button type="button" class="cancel-btn" data-job-id="' + jobsEscapeHtml(job.id) + '">Cancel</button>'
    : (isTerminal
      ? '<button type="button" class="cancel-btn" data-delete-job-id="' + jobsEscapeHtml(job.id) + '">Delete</button>'
      : '');

  var mainRow = '<tr class="job-row" data-job-row="' + jobsEscapeHtml(job.id) + '">' +
    '<td>' + (isExpanded ? JOBS_ICON.POINTDOWN : JOBS_ICON.POINTRIGHT) + ' ' + icon + ' ' + jobsEscapeHtml(job.status) + '</td>' +
    '<td>' + jobsEscapeHtml(job.id) + '</td>' +
    '<td>' + jobsEscapeHtml(job.kind) + ' / ' + jobsEscapeHtml(job.type) + '</td>' +
    '<td>' + new Date(job.updatedAt).toLocaleTimeString() + '</td>' +
    '<td><div class="job-last-log">' + jobsEscapeHtml(lastLog) + '</div></td>' +
    '<td>' + actionHtml + '</td>' +
    '</tr>';

  if (!isExpanded) return mainRow;

  return mainRow + '<tr class="job-log-row"><td colspan="6"><div class="job-log-panel">' +
    formatLogEntries(job) + '</div></td></tr>';
}

// Leading + trailing throttle: a burst of rapid job-updated events
// (e.g. a fast process logging hundreds of lines in ~1s) renders
// instantly on the first change, then at most once/sec while the
// burst continues, and always finishes with one render of the final
// state. Manual expand/collapse clicks bypass this and call
// renderJobsTable() directly, so toggling still feels instant.
var JOBS_RENDER_THROTTLE_MS = 1000;
var jobsRenderTimer = null;
var jobsRenderPending = false;

function throttledRenderJobsTable(jobsById) {
  if (jobsRenderTimer) { jobsRenderPending = true; return; }
  renderJobsTable(jobsById);
  jobsRenderTimer = setTimeout(function () {
    jobsRenderTimer = null;
    if (jobsRenderPending) {
      jobsRenderPending = false;
      renderJobsTable(jobsById);
    }
  }, JOBS_RENDER_THROTTLE_MS);
}

function renderJobsTable(jobsById) {
  var tbody = document.getElementById('jobs-tbody');
  if (!tbody) return;

  // Sticky scroll (same pattern as chat UIs): rebuilding tbody.innerHTML
  // destroys and recreates the log panel's DOM node, which would
  // otherwise silently reset its scroll position on every update —
  // exactly what made watching a live log fight the fs-watcher/
  // server-stats noise. Capture whether the panel was at (or near)
  // the bottom before rebuilding, then either pin it back to the new
  // bottom (so live-streaming logs stay watchable) or restore the
  // exact same scrollTop (so scrolling up to read history isn't
  // disturbed by unrelated updates). A freshly opened panel (no prior
  // panel to measure) defaults to pinned-to-bottom.
  var existingPanel = tbody.querySelector('.job-log-panel');
  var stickToBottom = true;
  var previousScrollTop = 0;
  if (existingPanel) {
    var distanceFromBottom = existingPanel.scrollHeight - existingPanel.scrollTop - existingPanel.clientHeight;
    stickToBottom = distanceFromBottom < 20; // small threshold for sub-pixel rounding
    previousScrollTop = existingPanel.scrollTop;
  }

  var rows = [];
  jobsById.forEach(function (job) { rows.push(job); });
  rows.sort(function (a, b) { return a.createdAt - b.createdAt; });

  tbody.innerHTML = rows.map(renderJobRow).join('') ||
    '<tr><td colspan="6">(no jobs)</td></tr>';

  var newPanel = tbody.querySelector('.job-log-panel');
  if (newPanel) {
    newPanel.scrollTop = stickToBottom ? newPanel.scrollHeight : previousScrollTop;
  }
}

spirit.shell.activateApp({
  mount: function (container) {
    expandedJobId = null; // fresh visit starts fully collapsed

    container.innerHTML =
      '<form id="start-job-form" class="start-job-form">' +
      '<input type="text" id="job-command" placeholder="command (e.g. node)" required>' +
      '<input type="text" id="job-args" placeholder="args (space-separated)">' +
      '<input type="text" id="job-type" placeholder="label (optional)">' +
      '<button type="submit">Start</button>' +
      '</form>' +
      '<div id="job-start-error" class="job-start-error"></div>' +
      '<table class="jobs-table"><thead><tr>' +
      '<th>Status</th><th>Id</th><th>Kind / Type</th><th>Updated</th><th>Last log</th><th></th>' +
      '</tr></thead><tbody id="jobs-tbody"></tbody></table>';

    document.getElementById('start-job-form').addEventListener('submit', function (event) {
      event.preventDefault();

      var command = document.getElementById('job-command').value.trim();
      var argsRaw = document.getElementById('job-args').value.trim();
      var type = document.getElementById('job-type').value.trim();
      var args = argsRaw ? argsRaw.split(/\s+/) : [];
      var errorEl = document.getElementById('job-start-error');
      errorEl.textContent = '';

      spirit.core.jobs.start({ command: command, args: args, type: type || undefined })
        .then(function () {
          document.getElementById('start-job-form').reset();
        })
        .catch(function (err) {
          errorEl.textContent = 'Failed to start job: ' + err.message;
        });
    });

    document.getElementById('jobs-tbody').addEventListener('click', function (event) {
      var cancelBtn = event.target.closest('[data-job-id]');
      if (cancelBtn) {
        spirit.core.jobs.cancel(cancelBtn.dataset.jobId).catch(function (err) {
          console.error('cancel failed', err);
        });
        return;
      }

      var deleteBtn = event.target.closest('[data-delete-job-id]');
      if (deleteBtn) {
        spirit.core.jobs.delete(deleteBtn.dataset.deleteJobId).catch(function (err) {
          console.error('delete failed', err);
        });
        return;
      }

      var row = event.target.closest('[data-job-row]');
      if (row) {
        var jobId = row.dataset.jobRow;
        expandedJobId = (expandedJobId === jobId) ? null : jobId; // opening one closes any other
        renderJobsTable(currentJobsById); // re-render immediately — don't wait for the next live update to reflect the toggle
      }
    });
  },

  render: function (jobsById) {
    currentJobsById = jobsById;
    throttledRenderJobsTable(jobsById);
  },
});
