// The second of the five to leave index.html (CLEANUP-PLAN step 5.2).
// Its id changed with its folder, 'jobs' to 'shell/jobs' — see APP_ID_RENAMES and INTRINSIC_APP_FOLDERS in
// js/client/shell.js — and the call sites that name it: the Spirit group's member list, the file viewer's "start and
// go watch it", and the Stats app's Active jobs tile.
//
// ROWS ONLY (goal/G2.11). Andy, 2026-10-02: "the job monitor shell component. the folded "consoles" need to go into
// jobsDetails", "the form on top should be gone." A row click opens shell/jobsDetails, and that is all a row does.
//
// A VIEW OF THE NODE'S JOBS IN spirit.data (goal/G41.28; Andy: "anything not using the new spiritData.js and it's buddies
// clientCacheManager.js must do so in this item. no exceptions."): the probability search over the jobs branch the jobs
// family's cache manager keeps (spirit.data.jobs.data), each row the shared row element. Words match the whole job; the kind
// filter is one choice (all, node, servers, transient, and failed last: goal/G29.16). Columns: the green dot, status,
// name (module, else type), kind, progress, updated.
//
// ITS PROGRESS (goal/G29.14 on the job cycle of goal/G29.15): each process publishes {job: {state, name, done, total,
// text}} as its job's app object; the bar is the shared progressBar (spirit/element/progressBar.js), drawn from the job
// as kept. A server between jobs shows idle, no bar; a transient process IS its job, so its progress alone draws the bar.

var jobsEscapeHtml = spirit.escapeHtml;

var STATUS_ICON = {
  pending: '⏳',
  running: '🏃‍♂️',
  completed: '✅',
  failed: '❌',
  cancelled: '🟠',
  stopped: '🟠',
  error: '⚠️',
};
// The canonical set lives in js/jobs.js, node-side; jobsDetails and app/stats keep the same copy.
var JOBS_TERMINAL = ['completed', 'failed', 'cancelled', 'stopped'];

var jobsApi = null;
var jobsList = null;
var jobsRowIndex = null;

// WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the list, the shared row and icon elements, the progress bar, and the
// jobs family's cache manager.
var jobsParts = Promise.all(['spirit/element/search.js', 'spirit/element/rowElement.js', 'spirit/element/icon.js', 'spirit/element/progressBar.js']
  .map(function (p) { return spirit.require(p); }).concat([spirit.cacheManager('jobs')]));

function jobsName(job) { return String(job.module || job.type || job.kind || job.id); }

// The job that changed last, from the jobs branch: the one green dot (goal/G29.14; Andy: "make a left-most icon column,
// where a one green dot hops between rows, always showing the most recent update").
var jobsLatest = '';

// THE KIND (goal/G29.14; Andy: "server-stats, relay-presence and fs-watcher are neither appServers nor transient"): the
// node's own jobs (kind permanent in js/jobs.js) are node; appServers are servers; a process started for one run is
// transient.
function jobsKind(job) { return job.kind === 'permanent' ? 'node' : job.kind === 'server' ? 'server' : 'transient'; }

// The bar from the job's own app object: a job open (start or progress) draws it, an ended one or a terminal job none.
function jobsProgress(job) {
  var c = job && job.app && typeof job.app === 'object' ? job.app.job : null;
  var bar = window.spirit && window.spirit.element && window.spirit.element.progressBar;
  if (!c || typeof c !== 'object' || JOBS_TERMINAL.indexOf(job.status) !== -1 || typeof bar !== 'function') return '';
  if (c.state === 'start') return bar(0, 0, String(c.name || ''));
  if (c.state === 'progress') return bar(Number(c.done) || 0, Number(c.total) || 0, String(c.text || ''));
  return '';
}

// THE STATUS MARK IS THE ICON ELEMENT (goal/G41.23; Andy: "this element will replace icons painting all shell elements
// and apps."): made by icon.create and handed on as its markup, since a cell is painted as text. Its word beside it
// stays text.
function jobsGlyph(glyph) {
  var I = window.spirit && window.spirit.element && window.spirit.element.icon;
  if (!I || typeof I.create !== 'function') return jobsEscapeHtml(glyph);
  var hold = document.createElement('span');
  I.create(hold, { glyph: glyph });
  return hold.innerHTML;
}

// EACH JOB A ROW ELEMENT (goal/G41.21: the row element paints every list's rows): its cells drawn from the job as kept.
function jobsRow(row) {
  var R = window.spirit.element.rowElement;
  var job = row || {};
  jobsRowIndex = jobsRowIndex || R.index(function () {});
  return R.create({
    kind: 'job',
    key: String(job.key || job.id || ''),
    index: jobsRowIndex,
    row: job,
    fields: [
      { name: 'latest', paint: function (j) { return j.id === jobsLatest ? '<span class="job-latest" title="the most recent update" style="color:#3c3">●</span>' : ''; } },
      { name: 'status', paint: function (j) { return (STATUS_ICON[j.status] ? jobsGlyph(STATUS_ICON[j.status]) + ' ' : '') + jobsEscapeHtml(j.status); } },
      { name: 'name', paint: function (j) { return jobsEscapeHtml(jobsName(j)); } },
      { name: 'kind', paint: function (j) { return jobsEscapeHtml(jobsKind(j)); } },
      { name: 'progress', paint: function (j) { return jobsProgress(j); } },
      { name: 'updated', paint: function (j) { return j.updatedAt ? jobsEscapeHtml(new Date(j.updatedAt).toLocaleTimeString()) : ''; } },
    ],
    actions: [],
  });
}

// BY ID, STANDING STILL (goal/G29.14; Andy, 2026-10-18: "the re-sort makes clicking on a line very difficult, just sort
// them by ID when no search term is active"): with no words the list keeps its rows in the order they came, and the
// stream hands the jobs over in id order, a new job last; an update never moves a row.

spirit.shell.activateApp({
  mount: function (container, api) {
    jobsApi = api;
    container.innerHTML = '';
    return jobsParts.then(function () {
      var J = ((window.spirit.data || {}).jobs || {}).data;
      jobsList = window.spirit.element.search.create(container, {
        data: J.branch,
        columns: [
          { field: 'latest', label: '' },
          { field: 'status', label: 'Status', sort: 'text' },
          { field: 'name', label: 'Name', sort: 'text' },
          { field: 'kind', label: 'Kind', sort: 'text' },
          { field: 'progress', label: 'Progress' },
          { field: 'updated', label: 'Updated', sort: 'number' },
        ],
        // FAILED, THE LAST FILTER (goal/G29.16; Andy: "the last filter in the jobs search should be "failed" and the
        // "running" filter means little?"): a transient job that ends is removed, so what is listed runs, or failed.
        filters: [{ name: 'kind', choices: [{ value: 'all', word: 'all' }, { value: 'node', word: 'node' }, { value: 'server', word: 'servers' }, { value: 'transient', word: 'transient' }, { value: 'failed', word: 'failed' }],
          test: function (job, v) { return !v || v === 'all' || (v === 'failed' ? job.status === 'failed' : jobsKind(job) === v) ? 1 : 0; } }],
        element: jobsRow,
        // A row opens its job's screen (goal/G2.11): the events, the data and the actions are there.
        details: function (job) {
          if (jobsApi && typeof jobsApi.callDialog === 'function') jobsApi.callDialog('shell/jobsDetails', { id: job.id });
        },
        empty: '(no jobs)',
      });
      // The dot hops to the job that changed last; the list redraws itself from the branch.
      var off = J.watch(function (id) { if (id) jobsLatest = id; });
      var destroy = jobsList.destroy;
      jobsList.destroy = function () { if (typeof off === 'function') off(); destroy(); };
    }, function () { container.textContent = 'Jobs could not be loaded.'; });
  },
});
