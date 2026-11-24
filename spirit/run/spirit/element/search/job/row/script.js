'use strict';
// spirit/run/spirit/element/search/job/row/script.js
// ONE JOB, AS A ROW ELEMENT (goal/G43.32; Andy: "uniformity, in the search elements and their folders, contain list, row an
// detail elements."): the row the job list drew itself before (spirit/element/job.js, goal/G43.29), its cells drawn from
// the job as kept. row.js does the shared work; this file says what a job is. Its contract and its test:
// ./test/script.md and ./test/row.js.
//
//   spirit.required.spirit.element.search.job.row.create(job, { latest }) -> the row element
//     latest()   the id of the job that changed last: its row carries the one green dot
//   spirit.required.spirit.element.search.job.row.mark(id) repaints the dot of every row of that job: the list marks the job
//     that was last and the one that is now, as the dot hops (a row repaints only what changed in its own job, so the row the dot
//     leaves would keep it)
//   .kindOf(job)    node, server or transient
//   .STATUS_ICON    a status's glyph
//   .actionOf(job)  'cancel', 'delete' or '': the one button a job offers, for the jobs detail and the task row
//
// The list watches the branch and draws its rows again from it (spirit/element/search/script.js), so a row has no dispatch.
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the shared row element, the icon element, the progress bar.
  ['spirit/element/row/script.js', 'spirit/element/icon/script.js', 'spirit/element/progressBar/script.js'].forEach(function (p) { S.requireScript(p); });

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
  // The canonical set lives in spirit/run/spirit/job.js (TERMINAL_STATUSES), node-side; its copy here is the only one on a page.
  var TERMINAL = ['completed', 'failed', 'cancelled', 'stopped'];

  // CANCEL OR DELETE, ONE RULE (goal/G47.1; wsl: "the Jobs detail already decides Cancel against Delete from a job's state, so
  // task.js should take that rule from there, not write a second one"; moved here from ../detail/script.js, which uses it, as
  // spirit/element/monitor/task/script.js does). Cancel for a one-shot process and for a user-operated server, never for a
  // node-operated one, which lives and dies with the node (Andy: "would allow cancel for servers - user but not for servers -
  // node"); Delete once the job is terminal; else nothing.
  function actionOf(job) {
    var j = job || {};
    if (TERMINAL.indexOf(j.status) !== -1) return 'delete';
    return j.kind === 'process' || (j.kind === 'server' && j.data && j.data.operated === 'user') ? 'cancel' : '';
  }

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
    var bar = S.required && S.required.spirit.element.progressBar;
    if (!c || typeof c !== 'object' || TERMINAL.indexOf(job.status) !== -1 || typeof bar !== 'function') return '';
    if (c.state === 'start') return bar(0, 0, String(c.name || ''));
    if (c.state === 'progress') return bar(Number(c.done) || 0, Number(c.total) || 0, String(c.text || ''));
    return '';
  }

  // THE STATUS MARK IS THE ICON ELEMENT (goal/G41.23): made by icon.create and handed on as its markup, since a cell is
  // painted as text. Its word beside it stays text.
  function glyphOf(glyph) {
    var I = S.required && S.required.spirit.element.icon;
    if (!I || typeof I.create !== 'function') return esc(glyph);
    var hold = document.createElement('span');
    I.create(hold, { glyph: glyph });
    return hold.innerHTML;
  }

  var index = null;
  // The dot asked again on every row of job id: its field repaints when its own value changes, the row's copy alone.
  function mark(id) {
    if (!index || !id) return;
    index.forKey(String(id)).forEach(function (el) { el.apply({ latest: !el.row.latest }); });
  }
  function create(row, options) {
    var o = options || {};
    var R = S.required.spirit.element.row;
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
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create, kindOf: kindOf, STATUS_ICON: STATUS_ICON, mark: mark, actionOf: actionOf };
}());
