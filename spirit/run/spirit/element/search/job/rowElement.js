'use strict';
// spirit/run/spirit/element/search/job/rowElement.js
// ONE JOB, AS A ROW ELEMENT (goal/G43.32; Andy: "uniformity, in the search elements and their folders, contain list, row an
// detail elements."): the row the job list drew itself before (spirit/element/job.js, goal/G43.29), its cells drawn from
// the job as kept. rowElement.js does the shared work; this file says what a job is. Its contract and its test:
// ./test/rowElement.md and ./test/rowElement.js.
//
//   spirit.element.spirit.element.search.job.rowElement.create(job, { latest }) -> the row element
//     latest()   the id of the job that changed last: its row carries the one green dot
//   .kindOf(job)    node, server or transient
//   .STATUS_ICON    a status's glyph
//
// The list watches the branch and draws its rows again from it (spirit/element/search.js), so a row has no dispatch.
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the shared row element, the icon element, the progress bar.
  ['spirit/element/rowElement.js', 'spirit/element/icon.js', 'spirit/element/progressBar.js'].forEach(function (p) { S.require(p); });

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
  // The canonical set lives in spirit/run/spirit/job.js (TERMINAL_STATUSES), node-side; ./detailElement.js keeps the same copy.
  var TERMINAL = ['completed', 'failed', 'cancelled', 'stopped'];

  function nameOf(job) { return String(job.module || job.id); }

  // THE KIND (goal/G29.14; Andy: "server-stats, relay-presence and fs-watcher are neither appServers nor transient"): the
  // node's own jobs (kind permanent in spirit/run/spirit/job.js) are node; appServers are servers; a process started for one
  // run is transient.
  function kindOf(job) { return job.kind === 'permanent' ? 'node' : job.kind === 'server' ? 'server' : 'transient'; }

  // ITS PROGRESS (goal/G29.14 on the job cycle of goal/G29.15): each process publishes {job: {state, name, done, total,
  // text}} as its job's app object; the bar is the shared progressBar, drawn from the job as kept. A job open (start or
  // progress) draws it, an ended one or a terminal job none.
  function progressOf(job) {
    var c = job && job.app && typeof job.app === 'object' ? job.app.job : null;
    var bar = S.element && S.element.spirit.element.progressBar;
    if (!c || typeof c !== 'object' || TERMINAL.indexOf(job.status) !== -1 || typeof bar !== 'function') return '';
    if (c.state === 'start') return bar(0, 0, String(c.name || ''));
    if (c.state === 'progress') return bar(Number(c.done) || 0, Number(c.total) || 0, String(c.text || ''));
    return '';
  }

  // THE STATUS MARK IS THE ICON ELEMENT (goal/G41.23): made by icon.create and handed on as its markup, since a cell is
  // painted as text. Its word beside it stays text.
  function glyphOf(glyph) {
    var I = S.element && S.element.spirit.element.icon;
    if (!I || typeof I.create !== 'function') return esc(glyph);
    var hold = document.createElement('span');
    I.create(hold, { glyph: glyph });
    return hold.innerHTML;
  }

  var index = null;
  function create(row, options) {
    var o = options || {};
    var R = S.element.spirit.element.rowElement;
    var job = row || {};
    var latest = typeof o.latest === 'function' ? o.latest : function () { return ''; };
    index = index || R.index(function () {});
    return R.create({
      kind: 'job',
      key: String(job.key || job.id || ''),
      index: index,
      row: job,
      fields: [
        // The one green dot (goal/G29.14; Andy: "make a left-most icon column, where a one green dot hops between rows, always
        // showing the most recent update").
        { name: 'latest', paint: function (j) { return j.id === latest() ? '<span class="job-latest" title="the most recent update" style="color:#3c3">●</span>' : ''; } },
        { name: 'status', paint: function (j) { return (STATUS_ICON[j.status] ? glyphOf(STATUS_ICON[j.status]) + ' ' : '') + esc(j.status); } },
        { name: 'name', paint: function (j) { return esc(nameOf(j)); } },
        { name: 'kind', paint: function (j) { return esc(kindOf(j)); } },
        { name: 'progress', paint: function (j) { return progressOf(j); } },
        { name: 'updated', paint: function (j) { return j.updatedAt ? esc(new Date(j.updatedAt).toLocaleTimeString()) : ''; } },
      ],
      actions: [],
    });
  }

  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search/job/rowElement.js', { create: create, kindOf: kindOf, STATUS_ICON: STATUS_ICON }); });
}());
