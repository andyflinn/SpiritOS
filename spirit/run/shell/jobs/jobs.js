// The second of the five to leave index.html (CLEANUP-PLAN step 5.2).
// Same app: the same table, the same throttle, the same spirit.core.jobs
// calls. Its id changed with its folder, 'jobs' to 'shell/jobs' — see
// APP_ID_RENAMES and INTRINSIC_APP_FOLDERS in js/client/shell.js, both
// updated in this same commit, and the three call sites that name it: the
// Spirit group's member list, the Process Browser's "start and go watch
// it", and the Stats app's Active jobs tile.
//
// The CSS stays in index.html: .jobs-table, .job-row and the log-panel
// rules are shell chrome that the Apps and Natter tables also use.
//
// ROWS ONLY (goal/G2.11). Andy, 2026-10-02: "the job monitor shell
// component. the folded "consoles" need to go into jobsDetails", "the form
// on top should be gone." The start form that stood at the top is gone —
// starting a job is the Process Browser's ("start and go watch it") — and
// the console that folded open under a row, with the Cancel and Delete
// that sat in the row, lives in shell/jobsDetails now: a row click opens
// it, and that is all a row does.

var JOBS_ICON = spirit.core.const.ICON;
var jobsEscapeHtml = spirit.core.util.escapeHtml;

var STATUS_ICON = {
  pending: JOBS_ICON.LOADING,
  running: JOBS_ICON.RUN,
  completed: JOBS_ICON.OK,
  failed: JOBS_ICON.ERROR,
  cancelled: JOBS_ICON.STOP,
  stopped: JOBS_ICON.STOP,
  error: JOBS_ICON.WARNING,
};

var jobsApi = null;

function renderJobRow(job) {
  var icon = STATUS_ICON[job.status] || '';
  return '<tr class="job-row" data-job-row="' + jobsEscapeHtml(job.id) + '">' +
    '<td>' + icon + ' ' + jobsEscapeHtml(job.status) + '</td>' +
    '<td>' + jobsEscapeHtml(job.id) + '</td>' +
    // The module it is an instance of, when it is one (slim/G1.5, Andy:
    // "each Jobs monitor row, names the id it is an instance of").
    '<td>' + jobsEscapeHtml(job.kind) + ' / ' + jobsEscapeHtml(job.type) +
      (job.module ? '<br><span class="job-module">' + jobsEscapeHtml(job.module) + '</span>' : '') + '</td>' +
    '<td>' + new Date(job.updatedAt).toLocaleTimeString() + '</td>' +
    '</tr>';
}

// Leading + trailing throttle: a burst of rapid job-updated events
// (e.g. a fast process logging hundreds of lines in ~1s) renders
// instantly on the first change, then at most once/sec while the
// burst continues, and always finishes with one render of the final
// state.
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
  // The sticky-scroll dance that stood here went with the folded panel it
  // kept in place: the console scrolls in jobsDetails now.
  var rows = [];
  jobsById.forEach(function (job) { rows.push(job); });
  rows.sort(function (a, b) { return a.createdAt - b.createdAt; });
  tbody.innerHTML = rows.map(renderJobRow).join('') ||
    '<tr><td colspan="4">(no jobs)</td></tr>';
}

spirit.shell.activateApp({
  mount: function (container, api) {
    jobsApi = api;
    container.innerHTML =
      '<table class="jobs-table"><thead><tr>' +
      '<th>Status</th><th>Id</th><th>Kind / Type</th><th>Updated</th>' +
      '</tr></thead><tbody id="jobs-tbody"></tbody></table>';

    // A row opens its job's screen (goal/G2.11): the console, the data and
    // the actions are there. Nothing folds here, nothing is cancelled here.
    document.getElementById('jobs-tbody').addEventListener('click', function (event) {
      var row = event.target && event.target.closest ? event.target.closest('[data-job-row]') : null;
      if (!row || !jobsApi || typeof jobsApi.callDialog !== 'function') return;
      jobsApi.callDialog('shell/jobsDetails', { id: row.dataset.jobRow });
    });
  },

  render: function (jobsById) {
    throttledRenderJobsTable(jobsById);
  },
});
