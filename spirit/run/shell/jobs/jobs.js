// The second of the five to leave index.html (CLEANUP-PLAN step 5.2).
// Its id changed with its folder, 'jobs' to 'shell/jobs' — see APP_ID_RENAMES and INTRINSIC_APP_FOLDERS in
// js/client/shell.js — and the call sites that name it: the Spirit group's member list, the file viewer's "start and
// go watch it", and the Stats app's Active jobs tile.
//
// ROWS ONLY (goal/G2.11). Andy, 2026-10-02: "the job monitor shell component. the folded "consoles" need to go into
// jobsDetails", "the form on top should be gone." A row click opens shell/jobsDetails, and that is all a row does.
//
// ON THE SHARED LIST (goal/G29.14). The item's box: "The table moves onto the shared list: filters on row 1, the search
// on row 2, then the rows." Words match the job's name, type, module and id; with no words the newest updated is on
// top. The kind filter is one choice (all, servers, transient); the status filter one toggle per status the list holds,
// each in or out. Columns: rank bar, status, name (module, else type), kind, progress, updated.
//
// ITS PROGRESS (goal/G29.14 on the job cycle of goal/G29.15): each process publishes {job: {state, name, done, total,
// text}}; the bar is the shared progressBar (shell/shared/js/progressBar.js), fed here from those events. A server
// between jobs shows idle, no bar; a transient process IS its job, so its progress alone draws the bar.

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
// The canonical set lives in js/jobs.js, node-side; jobsDetails and app/stats keep the same copy.
var JOBS_TERMINAL = ['completed', 'failed', 'cancelled', 'stopped'];

var jobsApi = null;
var jobsList = null;
var jobsMap = null;                       // the shell's live Map, as it last handed it over
var jobsOpen = Object.create(null);       // job id -> {done, total, text}: the job a process has open
var jobsSeen = Object.create(null);       // job id -> the json of the app object heard last

function jobsName(job) { return String(job.module || job.type || job.kind || job.id); }

// ONE EVENT HEARD (goal/G29.14): a job event whose app object changed and carries {job}. A job-updated for a log line
// carries the same app object again, so an object equal to the last one heard is no new event.
function jobsHear(job) {
  if (!job || !job.app || typeof job.app !== 'object') return false;
  var seen = '';
  try { seen = JSON.stringify(job.app); } catch (e) { return false; }
  if (jobsSeen[job.id] === seen) return false;
  jobsSeen[job.id] = seen;
  var c = job.app.job;
  if (!c || typeof c !== 'object') return false;
  if (c.state === 'end') delete jobsOpen[job.id];
  else if (c.state === 'start') jobsOpen[job.id] = { done: 0, total: 0, text: String(c.name || '') };
  else if (c.state === 'progress') jobsOpen[job.id] = { done: Number(c.done) || 0, total: Number(c.total) || 0, text: String(c.text || '') };
  else return false;
  return true;
}

function jobsRows() {
  var rows = [];
  if (jobsMap && typeof jobsMap.forEach === 'function') jobsMap.forEach(function (job) { rows.push(Object.assign({ key: job.id }, job)); });
  // With no words the newest updated is on top; the shared list keeps this order for ties.
  rows.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
  return rows;
}

function jobsProgress(job) {
  var open = jobsOpen[job.id];
  var bar = window.spiritElements && window.spiritElements.progressBar;
  if (!open || JOBS_TERMINAL.indexOf(job.status) !== -1 || typeof bar !== 'function') return '';
  return bar(open.done, open.total, open.text);
}

function jobsPaint(job, mark) {
  return '<td>' + (STATUS_ICON[job.status] || '') + ' ' + jobsEscapeHtml(job.status) + '</td>' +
    '<td>' + mark(jobsName(job)) + '</td>' +
    '<td>' + jobsEscapeHtml(job.kind === 'server' ? 'server' : 'transient') + '</td>' +
    '<td>' + jobsProgress(job) + '</td>' +
    '<td>' + (job.updatedAt ? new Date(job.updatedAt).toLocaleTimeString() : '') + '</td>';
}

// Leading + trailing throttle: a burst of rapid job-updated events (e.g. a fast process logging hundreds of lines in
// ~1s) redraws at once on the first change, then at most once/sec while the burst continues, and always finishes with
// one redraw of the final state. A {job} event redraws at once: the bar is what it is for.
var JOBS_RENDER_THROTTLE_MS = 1000;
var jobsRenderTimer = null;
var jobsRenderPending = false;

function jobsRedraw() { if (jobsList) jobsList.redraw(); }
function throttledRedraw() {
  if (jobsRenderTimer) { jobsRenderPending = true; return; }
  jobsRedraw();
  jobsRenderTimer = setTimeout(function () {
    jobsRenderTimer = null;
    if (jobsRenderPending) {
      jobsRenderPending = false;
      jobsRedraw();
    }
  }, JOBS_RENDER_THROTTLE_MS);
}

spirit.shell.activateApp({
  mount: function (container, api) {
    jobsApi = api;
    container.innerHTML = '';
    jobsList = window.spiritElements.shellCreateListSearch(container, {
      rows: jobsRows,
      filters: [
        { name: 'kind', choices: [{ value: 'all', word: 'all' }, { value: 'server', word: 'servers' }, { value: 'transient', word: 'transient' }],
          test: function (job, v) { return v === 'server' ? job.kind === 'server' : v === 'transient' ? job.kind !== 'server' : true; } },
        { name: 'status', multi: true,
          choices: function (rows) {
            return rows.map(function (j) { return String(j.status || ''); }).filter(function (s, i, a) { return s && a.indexOf(s) === i; }).sort()
              .map(function (s) { return { value: s, icon: STATUS_ICON[s] || '', word: s }; });
          },
          test: function (job, off) { return off && off[job.status] ? 0 : 1; } },
      ],
      matched: function (job) { return { name: jobsName(job), type: String(job.type || ''), module: String(job.module || ''), id: String(job.id) }; },
      paint: jobsPaint,
      // A row opens its job's screen (goal/G2.11): the events, the data and the actions are there.
      details: function (job) {
        if (jobsApi && typeof jobsApi.callDialog === 'function') jobsApi.callDialog('shell/jobsDetails', { id: job.id });
      },
      empty: '(no jobs)',
    });

    // EVERY JOB EVENT, with the job that moved (null on a snapshot): its {job} events feed the bar.
    if (typeof api.onJobs === 'function') api.onJobs(function (jobsById, changed) {
      jobsMap = jobsById;
      if (changed) { if (jobsHear(changed)) jobsRedraw(); else throttledRedraw(); return; }
      if (jobsById && typeof jobsById.forEach === 'function') jobsById.forEach(jobsHear);
      throttledRedraw();
    });
  },

  render: function (jobsById) {
    jobsMap = jobsById;
    throttledRedraw();
  },
});
