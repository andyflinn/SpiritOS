// spirit/run/spirit/element/jobs.js
// THE JOB MONITOR'S LIST, AN ELEMENT (goal/G43.29; Andy: "a wrapper for separate spirit/element/ files"): what the Jobs app
// (spirit/app/jobs/jobs.js) draws, moved here from shell/jobs/jobs.js and working as it did. Its contract and its test:
// ./test/jobs.md and ./test/jobs.js.
//
//   spirit.element.jobs.create(container, { open }) -> { destroy() }
//     open   the mounter's panel stack's open (the app selector's); with none, a stack of its own over its page
//
// ROWS ONLY (goal/G2.11). Andy, 2026-10-02: "the job monitor shell component. the folded "consoles" need to go into
// jobsDetails", "the form on top should be gone." A row opens its job's detail (./jobDetail.js) OVER JOBS, as contact detail
// and icon detail do (goal/G43.29, Q1: "a job row opens detail panel overtop of jobs."), and that is all a row does.
//
// A VIEW OF THE NODE'S JOBS IN spirit.data (goal/G41.28): the probability search over the jobs branch the jobs family's cache
// manager keeps (spirit.data.jobs.data, spirit/jobs/data.js), each row the shared row element. Words match the whole job; the
// kind filter is one choice (all, node, servers, transient, and failed last: goal/G29.16). Columns: the green dot, status,
// name (module, else type), kind, progress, updated.
//
// ITS PROGRESS (goal/G29.14 on the job cycle of goal/G29.15): each process publishes {job: {state, name, done, total, text}}
// as its job's app object; the bar is the shared progressBar (./progressBar.js), drawn from the job as kept. A server between
// jobs shows idle, no bar; a transient process IS its job, so its progress alone draws the bar.
//
// BY ID, STANDING STILL (goal/G29.14; Andy, 2026-10-18: "the re-sort makes clicking on a line very difficult, just sort them by
// ID when no search term is active"): with no words the list keeps its rows in the order they came, and the stream hands the
// jobs over in id order, a new job last; an update never moves a row.
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the list, the shared row and icon elements, the progress bar, the panel
  // stack, the detail, and the jobs family's cache manager.
  var parts = Promise.all(['spirit/element/search.js', 'spirit/element/rowElement.js', 'spirit/element/icon.js',
    'spirit/element/progressBar.js', 'spirit/element/panel.js', 'spirit/element/jobDetail.js']
    .map(function (p) { return S.require(p); }).concat([S.cacheManager('jobs')]));

  function esc(s) { return S.escapeHtml(String(s == null ? '' : s)); }

  var STATUS_ICON = {
    pending: '⏳',
    running: '🏃‍♂️',
    completed: '✅',
    failed: '❌',
    cancelled: '🟠',
    stopped: '🟠',
    error: '⚠️',
  };
  // The canonical set lives in spirit/run/spirit/jobs.js (TERMINAL_STATUSES), node-side; ./jobDetail.js keeps the same copy.
  var TERMINAL = ['completed', 'failed', 'cancelled', 'stopped'];

  function nameOf(job) { return String(job.module || job.id); }

  // THE KIND (goal/G29.14; Andy: "server-stats, relay-presence and fs-watcher are neither appServers nor transient"): the
  // node's own jobs (kind permanent in spirit/run/spirit/jobs.js) are node; appServers are servers; a process started for one
  // run is transient.
  function kindOf(job) { return job.kind === 'permanent' ? 'node' : job.kind === 'server' ? 'server' : 'transient'; }

  // The bar from the job's own app object: a job open (start or progress) draws it, an ended one or a terminal job none.
  function progressOf(job) {
    var c = job && job.app && typeof job.app === 'object' ? job.app.job : null;
    var bar = S.element && S.element.progressBar;
    if (!c || typeof c !== 'object' || TERMINAL.indexOf(job.status) !== -1 || typeof bar !== 'function') return '';
    if (c.state === 'start') return bar(0, 0, String(c.name || ''));
    if (c.state === 'progress') return bar(Number(c.done) || 0, Number(c.total) || 0, String(c.text || ''));
    return '';
  }

  // THE STATUS MARK IS THE ICON ELEMENT (goal/G41.23): made by icon.create and handed on as its markup, since a cell is
  // painted as text. Its word beside it stays text.
  function glyphOf(glyph) {
    var I = S.element && S.element.icon;
    if (!I || typeof I.create !== 'function') return esc(glyph);
    var hold = document.createElement('span');
    I.create(hold, { glyph: glyph });
    return hold.innerHTML;
  }

  function create(container, options) {
    var o = options || {};
    var gone = false;
    var list = null;
    var off = null;
    var index = null;
    // The job that changed last, from the jobs branch: the one green dot (goal/G29.14; Andy: "make a left-most icon column,
    // where a one green dot hops between rows, always showing the most recent update").
    var latest = '';
    // WHERE A JOB OPENS (as contact.js and icons): over Jobs, in the mounter's stack, or in one of its own over its page.
    var stack = null;
    var openOver = typeof o.open === 'function' ? o.open : function (k, spec) { return stack ? stack.open(k, spec) : Promise.resolve(null); };

    container.innerHTML = '<div data-jobs="list" class="fill"></div>';

    // EACH JOB A ROW ELEMENT (goal/G41.21: the row element paints every list's rows): its cells drawn from the job as kept.
    function rowOf(row) {
      var R = S.element.rowElement;
      var job = row || {};
      index = index || R.index(function () {});
      return R.create({
        kind: 'job',
        key: String(job.key || job.id || ''),
        index: index,
        row: job,
        fields: [
          { name: 'latest', paint: function (j) { return j.id === latest ? '<span class="job-latest" title="the most recent update" style="color:#3c3">●</span>' : ''; } },
          { name: 'status', paint: function (j) { return (STATUS_ICON[j.status] ? glyphOf(STATUS_ICON[j.status]) + ' ' : '') + esc(j.status); } },
          { name: 'name', paint: function (j) { return esc(nameOf(j)); } },
          { name: 'kind', paint: function (j) { return esc(kindOf(j)); } },
          { name: 'progress', paint: function (j) { return progressOf(j); } },
          { name: 'updated', paint: function (j) { return j.updatedAt ? esc(new Date(j.updatedAt).toLocaleTimeString()) : ''; } },
        ],
        actions: [],
      });
    }

    // A JOB OPENED, OVER JOBS (Q1): its detail in a layer, titled by its status and id, closed when it is deleted.
    function openJob(job) {
      var id = String((job && job.id) || '');
      if (!id) return;
      var layer = null;
      Promise.resolve(openOver('job/' + id, { icon: STATUS_ICON[job.status] || '📋', label: id, fill: function (host) {
        return S.element.jobDetail.create(host, {
          id: id,
          title: function (t) { if (layer) layer.set(t); },
          close: function () { if (layer) layer.hide(); },
        });
      } })).then(function (l) { layer = l; });
    }

    parts.then(function () {
      if (gone) return;
      var box = container.firstElementChild;
      // ITS OWN STACK when the mounter hands none, over its page (as contact.js).
      if (typeof o.open !== 'function') stack = S.elements.panel.create(container, box);
      var J = S.data.jobs.data;
      list = S.element.search.create(box, {
        data: J.branch,
        columns: [
          { field: 'latest', label: '' },
          { field: 'status', label: 'Status', sort: 'text' },
          { field: 'name', label: 'Name', sort: 'text' },
          { field: 'kind', label: 'Kind', sort: 'text' },
          { field: 'progress', label: 'Progress' },
          { field: 'updated', label: 'Updated', sort: 'number' },
        ],
        // FAILED, THE LAST FILTER (goal/G29.16; Andy: "the last filter in the jobs search should be "failed" and the "running"
        // filter means little?"): a transient job that ends is removed, so what is listed runs, or failed.
        filters: [{ name: 'kind', choices: [{ value: 'all', word: 'all' }, { value: 'node', word: 'node' }, { value: 'server', word: 'servers' }, { value: 'transient', word: 'transient' }, { value: 'failed', word: 'failed' }],
          test: function (job, v) { return !v || v === 'all' || (v === 'failed' ? job.status === 'failed' : kindOf(job) === v) ? 1 : 0; } }],
        element: rowOf,
        details: openJob,
        empty: '(no jobs)',
      });
      // The dot hops to the job that changed last; the list redraws itself from the branch.
      off = J.watch(function (id) { if (id) latest = id; });
    }, function () { container.textContent = 'Jobs could not be loaded.'; });

    return {
      destroy: function () {
        gone = true;
        if (typeof off === 'function') off();
        off = null;
        if (list && typeof list.destroy === 'function') list.destroy();
        list = null;
        if (stack) stack.destroy();
        stack = null;
        container.innerHTML = '';
      },
    };
  }

  S.element = S.element || {};
  S.element.jobs = { create: create };
}());
