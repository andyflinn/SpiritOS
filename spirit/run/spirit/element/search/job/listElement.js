'use strict';
// spirit/run/spirit/element/search/job/listElement.js
// THE JOB MONITOR'S LIST, AN ELEMENT (goal/G43.29; Andy: "a wrapper for separate spirit/element/ files"): what the Jobs app
// (spirit/app/job/element.js) draws through the job selector (../job.js), moved from shell/job/job.js and working as it
// did. The job search's list since goal/G43.32 (Andy: "uniformity, in the search elements and their folders, contain list,
// row an detail elements."), spirit/element/job.js before; its row is ./rowElement.js and its detail ./detailElement.js.
// Its contract and its test: ./test/listElement.md and ./test/listElement.js.
//
//   spirit.element.spirit.element.search.job.listElement.create(container, { open }) -> { destroy() }
//     open   the mounter's panel stack's open (the app selector's); with none, a stack of its own over its page
//
// ROWS ONLY (goal/G2.11). Andy, 2026-10-02: "the job monitor shell component. the folded "consoles" need to go into
// jobsDetails", "the form on top should be gone." A row opens its job's detail (./detailElement.js) OVER JOBS, as contact
// detail and icon detail do (goal/G43.29, Q1: "a job row opens detail panel overtop of jobs."), and that is all a row does.
//
// A VIEW OF THE NODE'S JOBS IN spirit.data (goal/G41.28): the probability search over the jobs branch the job family's cache
// manager keeps (spirit.data.job.data, spirit/job/data.js), each row a job row element. Words match the whole job; the
// kind filter is one choice (all, node, servers, transient, and failed last: goal/G29.16). Columns: the green dot, status,
// name (module, else type), kind, progress, updated.
//
// BY ID, STANDING STILL (goal/G29.14; Andy, 2026-10-18: "the re-sort makes clicking on a line very difficult, just sort them by
// ID when no search term is active"): with no words the list keeps its rows in the order they came, and the stream hands the
// jobs over in id order, a new job last; an update never moves a row.
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the list, its row and its detail, the panel stack, and the job family's
  // cache manager.
  var parts = Promise.all(['spirit/element/search.js', 'spirit/element/search/job/rowElement.js', 'spirit/element/panel.js',
    'spirit/element/search/job/detailElement.js']
    .map(function (p) { return S.require(p); }).concat([S.cacheManager('job')]));

  function J() { return S.element.spirit.element.search.job; }

  function create(container, options) {
    var o = options || {};
    var gone = false;
    var list = null;
    var off = null;
    // The job that changed last, from the jobs branch: the one green dot its row draws.
    var latest = '';
    // WHERE A JOB OPENS (as contact.js and icons): over Jobs, in the mounter's stack, or in one of its own over its page.
    var stack = null;
    var openOver = typeof o.open === 'function' ? o.open : function (k, spec) { return stack ? stack.open(k, spec) : Promise.resolve(null); };

    container.innerHTML = '<div data-jobs="list" class="fill"></div>';

    function rowOf(row) { return J().rowElement.create(row, { latest: function () { return latest; } }); }

    // A JOB OPENED, OVER JOBS (Q1): its detail in a layer, titled by its status and id, closed when it is deleted.
    function openJob(job) {
      var id = String((job && job.id) || '');
      if (!id) return;
      var layer = null;
      Promise.resolve(openOver('job/' + id, { icon: J().rowElement.STATUS_ICON[job.status] || '📋', label: id, fill: function (host) {
        return J().detailElement.create(host, {
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
      if (typeof o.open !== 'function') stack = S.element.spirit.element.panel.create(container, box);
      var data = S.data.job.data;
      var kindOf = J().rowElement.kindOf;
      list = S.element.spirit.element.search.create(box, {
        data: data.branch,
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
      off = data.watch(function (id) { if (id) latest = id; });
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

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search/job/listElement.js', { create: create }); });
}());
