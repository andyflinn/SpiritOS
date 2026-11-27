'use strict';
// spirit/run/spirit/job/client/script.js
// WHAT A CLIENT KNOWS OF A NODE'S JOBS, IN THE jobs FAMILY'S OWN FOLDER (goal/G41.28). Andy: "anything not using the new
// spiritData.js and it's buddies clientCacheManager.js must do so in this item. no exceptions." A page loads it through
// its api.js (spirit/job/script.js), the one file that requires it; it keeps the node's jobs in that page's spirit.required.spirit.data, under the node that served them.
//
// THE BRANCH IS THIS FILE'S, AND ONLY THIS FILE NAMES IT: every reader (the Jobs app and its details dialog, Stats, the
// face's boot) asks spirit.required.spirit.data.job.data (below), never a branch by name.
//   jobs     id -> the job as the stream last handed it
//   events   id -> { lines: [{ at, json }] }, the job's last EVENT_WINDOW events, oldest falling off the top (moved here
//            from the job details dialog, goal/G29.14): an event is what a job publishes, its app object when it differs
//            from the one heard before; for spirit.fs the tree command each change carries (goal/G4.25), and for the
//            node's other jobs (spirit, spirit.contact) their data, each time it changes. Nothing is asked of the node.
// Every job the node's stream hands over is kept as it came, and one the stream deletes goes; a connect hands the whole
// set again (spirit.required.spirit.data forgets on a snapshot). It asks nothing.
(function family(given, out) {
  // WHAT IT PUTS OUT, ITS READS (goal/G49.23, box v22 Part 1: "they stand at <branch path>.client, where the loader puts the
  // branch's client/script.js by its path"; an old-shape data.js at <its folder>.data): the object is put out as the file runs, so
  // the loader places it, and filled with what the store made once it has come back.
  var OUT = out || {};
  if (!out && typeof module !== 'undefined' && module) module.exports = OUT;
  var JOBS = 'jobs';
  var EVENTS = 'events';
  var EVENT_WINDOW = 256;
  function eventOf(job) {
    var obj = job.id === 'spirit.fs' ? (job.data && job.data.command) : job.kind === 'permanent' ? job.data : job.app;
    if (!obj || typeof obj !== 'object') return '';
    try { return JSON.stringify(obj); } catch (e) { return ''; }
  }
  var D = typeof require === 'function' ? require('../../script.js').requireScript('spirit/client/script.js') : given;
  // ON A PAGE, THE DATA SET AS spirit.requireScript HANDS IT BACK (goal/G49.23; goal/G49.9: never read at its place): this file runs
  // again with it once it has loaded.
  // THE DATA SET IT FILES INTO, REQUIRED BY ITSELF (goal/G47.1, box v182: "It is loaded by that path with spirit.requireScript,
  // data.js exactly as api.js"): on a page that has not loaded spirit/client/script.js yet, this file loads it and runs again.
  if (!D) { window.spirit.requireScript('spirit/client/script.js').then(function (got) { if (got) family(got, OUT); }); return; }
  D.handOut(OUT, D.makeFamily('job', function () {
    var HOME = D.viewAt(null, 'job');
    D.addTranslator({
      onJob: function (job) {
        if (!job || !job.id) return;
        var V = D.viewAt(job.fromNode || null, 'job');
        var id = String(job.id);
        var row = Object.assign({}, job);
        delete row.fromNode;
        // THE NODE'S OWN JOBS CARRY ONE KIND OF NEWS PER EVENT (goal/G43.20): spirit its stats or its join steps, spirit.app its
        // app list, and so on. The cache keeps the newest of each kind on the one row, so a reader finds them all there.
        var had = V.get(JOBS + '/' + id);
        if (job.kind === 'permanent' && had && had.data && typeof had.data === 'object') row.data = Object.assign({}, had.data, job.data || {});
        // Its event first, so a reader of both that the job's write wakes sees the event already kept.
        var json = eventOf(job);
        var kept = V.get(EVENTS + '/' + id);
        var lines = kept && Array.isArray(kept.lines) ? kept.lines : [];
        if (json && (!lines.length || lines[lines.length - 1].json !== json)) {
          lines = lines.concat([{ at: job.updatedAt || Date.now(), json: json }]);
          if (lines.length > EVENT_WINDOW) lines = lines.slice(lines.length - EVENT_WINDOW);
          V.set(EVENTS + '/' + id, { lines: lines });
        }
        V.set(JOBS + '/' + id, row);
      },
      onDelete: function (gone) {
        if (!gone || !gone.id) return;
        var V = D.viewAt(gone.fromNode || null, 'job');
        V.del(EVENTS + '/' + String(gone.id));
        V.del(JOBS + '/' + String(gone.id));
      },
    });
    // THE READS, ANSWERED HERE:
    //   job(id)      a job, or null;  jobs()  every job kept, id -> job;  events(id)  its kept events, [{ at, json }]
    //   find(test)   the first job test(job) is true of, or null
    //   watch(fn)    fn(id, job) on every change, job undefined once it is gone, id '' when the set is forgotten; answers
    //                its release
    //   watch(id, fn) fn(job) each time that one job is written, undefined once it is gone; answers its release. As agent's
    //                tables have it (5aa68f95; Andy: "that's a decision: a BRANCHE's what is called \"watch\""); goal/G43.32,
    //                for monitor, which shows the spirit job alone (Andy: "wsl, the clean fix, do it.").
    //   branch       the jobs' whole path, for a list that is a view of it (probabilitySearch's data)
    // WHO HEARS EVERY JOB UPDATE (goal/G49.23, box v22 Part 1: an element hears the stream through the client that keeps those rows, never
    // through the store): hear(fn) fn(job) on each, as the stream brings it; answers its release.
    var hearers = [];
    D.addTranslator({ onJob: function (job) { if (!job) return; hearers.slice().forEach(function (h) { try { h(job); } catch (e) { /* one hearer's fault */ } }); } });
    function hear(fn) {
      if (typeof fn !== 'function') return function () {};
      hearers.push(fn);
      return function () { var i = hearers.indexOf(fn); if (i !== -1) hearers.splice(i, 1); };
    }
    var jobsReads = {
      hear: hear,
      job: function (id) { return id ? HOME.get(JOBS + '/' + id) || null : null; },
      jobs: function () { return HOME.branch(JOBS); },
      events: function (id) { var k = id ? HOME.get(EVENTS + '/' + id) : null; return k && Array.isArray(k.lines) ? k.lines : []; },
      eventWindow: EVENT_WINDOW,
      find: function (test) {
        var all = HOME.branch(JOBS);
        var k = Object.keys(all).filter(function (id) { return typeof test === 'function' && test(all[id]); })[0];
        return k ? all[k] : null;
      },
      watch: function (id, fn) {
        if (typeof id === 'function') { var all = id; return HOME.watch(JOBS, function (whole, v) { all(HOME.row(whole, JOBS), v); }); }
        if (!id) return function () {};
        return HOME.watch(JOBS + '/' + id, function (whole, v) { if (typeof fn === 'function') fn(v); });
      },
      get branch() { return HOME.path(JOBS); },
    };
    return jobsReads;
  }));
}());
