'use strict';
// spirit/run/spirit/element/search/job/list/script.js
// THE JOB MONITOR'S LIST, AN ELEMENT (goal/G43.29; Andy: "a wrapper for separate spirit/element/ files"): what the Jobs app
// (spirit/app/job/element.js) draws through the job selector (../script.js), moved from shell/job/job.js and working as it
// did. The job search's list since goal/G43.32 (Andy: "uniformity, in the search elements and their folders, contain list,
// row an detail elements."), spirit/element/job.js before; its row is ../row/script.js and its detail ./detail.js.
// Its contract and its test: ./test/script.md and ./test/list.js.
//
//   spirit.required.spirit.element.search.job.list.create(container, { open }) -> { destroy() }
//     open   the mounter's panel stack's open (the app selector's); with none, a stack of its own over its page
//     face   'dropdown' a closed field opening to the same list (box v123: "every search supports both pane and dropdown");
//            anything else, the pane it always was. placeholder and pick(row, key), the dropdown's, as probabilitySearch's
//
// ROWS ONLY (goal/G2.11). Andy, 2026-10-02: "the job monitor shell component. the folded "consoles" need to go into
// jobsDetails", "the form on top should be gone." A row opens its job's detail (../detail/script.js) OVER JOBS, as contact
// detail and icon detail do (goal/G43.29, Q1: "a job row opens detail panel overtop of jobs."), and that is all a row does.
//
// A VIEW OF THE NODE'S JOBS IN spirit.required.spirit.data (goal/G41.28): the probability search over the jobs branch the job family's cache
// manager keeps (spirit.required.spirit.data.job.data, spirit/job/client/script.js), each row a job row element. Words match the whole job; the
// kind filter is one choice (all, node, servers, transient, and failed last: goal/G29.16). Columns: the green dot, status,
// name (module, else type), kind, progress, updated.
//
// BY ID, STANDING STILL (goal/G29.14; Andy, 2026-10-18: "the re-sort makes clicking on a line very difficult, just sort them by
// ID when no search term is active"): with no words the list keeps its rows in the order they came, and the stream hands the
// jobs over in id order, a new job last; an update never moves a row.
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  // What it reads, it asks for itself, as it runs (goal/G49.9; rule/26).
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/search/job/script.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/panel/script.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/search/script.js');
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the list, its row and its detail, the panel stack, and the job family's
  // cache manager.
  var parts = Promise.all(['spirit/element/search/script.js', 'spirit/element/search/job/row/script.js', 'spirit/element/panel/script.js',
    'spirit/element/search/job/detail/script.js']
    .map(function (p) { return S.requireScript(p); }).concat([S.requireScript('spirit/job/script.js'),
      // THE DATA STORE IS spirit.dataStore (goal/G49.23; Andy: "spirit.dataStore is fine with me"), there once the page has started: the jobs are its job.data.
      Promise.resolve(window.spirit.readyPromise)]));

  function J() { return ANSWER['spirit/element/search/job/script.js']; }

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

    container.innerHTML = '<div data-jobs="list" class="fill" style="overflow:hidden"></div>';

    function rowOf(row) { return J().row.create(row, { latest: function () { return latest; } }); }

    // A JOB OPENED, OVER JOBS (Q1): its detail in a layer, titled by its status and id, closed when it is deleted.
    function openJob(job) {
      var id = String((job && job.id) || '');
      if (!id) return;
      var layer = null;
      Promise.resolve(openOver('job/' + id, { icon: J().row.STATUS_ICON[job.status] || '📋', label: id, fill: function (host) {
        return J().detail.create(host, {
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
      if (typeof o.open !== 'function') stack = ANSWER['spirit/element/panel/script.js'].create(container, box);
      var data = window.spirit.dataStore.job.data;
      var kindOf = J().row.kindOf;
      list = ANSWER['spirit/element/search/script.js'].create(box, {
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
        face: o.face === 'dropdown' ? 'dropdown' : 'pane',
        placeholder: o.placeholder || 'choose a job…',
        pick: function (row, key) { if (typeof o.pick === 'function') o.pick(row, key); },
        empty: '(no jobs)',
      });
      // The dot hops to the job that changed last; the list redraws itself from the branch.
      off = data.watch(function (id) {
        if (!id || id === latest) return;
        var was = latest;
        latest = id;
        J().row.mark(was);
        J().row.mark(id);
      });
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

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
