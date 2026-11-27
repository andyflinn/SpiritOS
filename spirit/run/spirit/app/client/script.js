'use strict';
// spirit/run/spirit/app/client/script.js
// WHAT A CLIENT KNOWS OF A NODE'S APPS, IN THE app FAMILY'S OWN FOLDER (goal/G43.2). A page loads it through
// its api.js (spirit/app/script.js), the one file that requires it; it runs the translator into that page's spirit.required.spirit.data, under the node that served the rows.
//
// THE BRANCH IS THIS FILE'S, AND ONLY THIS FILE NAMES IT: every reader (the app row and list) asks spirit.required.spirit.data.app.data
// (below), never a branch by name.
//   apps   key -> { key, label, icon, active, shell, intrinsic, nodeMount, nodeRemote }, what app.search answered (seated by the list that is a view of it), and the
//          whole table the apps news of the node's own job spirit.app holds (spirit/app/manager/script.js): a key it no longer names is gone.
// Every event ends in set or del; it asks nothing.
(function family(given, out) {
  // WHAT IT PUTS OUT, ITS READS (goal/G49.23, box v22 Part 1: "they stand at <branch path>.client, where the loader puts the
  // branch's client/script.js by its path"; an old-shape data.js at <its folder>.data): the object is put out as the file runs, so
  // the loader places it, and filled with what the store made once it has come back.
  var OUT = out || {};
  if (!out && typeof module !== 'undefined' && module) module.exports = OUT;
  var APPS = 'apps';
  var D = typeof require === 'function' ? require('../../script.js').requireScript('spirit/client/script.js') : given;
  // ON A PAGE, THE DATA SET AS spirit.requireScript HANDS IT BACK (goal/G49.23; goal/G49.9: never read at its place): this file runs
  // again with it once it has loaded.
  // THE DATA SET IT FILES INTO, REQUIRED BY ITSELF (goal/G47.1, box v182: "It is loaded by that path with spirit.requireScript,
  // data.js exactly as api.js"): on a page that has not loaded spirit/client/script.js yet, this file loads it and runs again.
  if (!D) { window.spirit.requireScript('spirit/client/script.js').then(function (got) { if (got) family(got, OUT); }); return; }
  D.handOut(OUT, D.makeFamily('spirit.app', function () {
    var HOME = D.viewAt(null, 'spirit.app');
    D.addTranslator({
      onJob: function (job) {
        // THE APP LIST, news of spirit.app (goal/G43.20): { apps }.
        var all = job && job.id === 'spirit.app' && job.data ? job.data.apps : null;
        if (!all || typeof all !== 'object') return;
        var V = D.viewAt(job.fromNode || null, 'spirit.app');
        Object.keys(V.branch(APPS)).forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(all, k)) V.del(APPS + '/' + k); });
        // Every field the node's row carries (spirit/app/manager/script.js rowOf), run and runOnly among them (goal/G43.21: a node:run app
        // is listed in pane mode only, and shows Run, not Activate).
        Object.keys(all).forEach(function (k) {
          var r = all[k] || {};
          V.set(APPS + '/' + k, { key: k, label: String(r.label || ''), icon: String(r.icon || ''), active: r.active === true, shell: r.shell === true, intrinsic: r.intrinsic === true, nodeMount: r.nodeMount === true, nodeRemote: r.nodeRemote !== false, api: r.api === true, run: r.run === true, runOnly: r.runOnly === true, shellMount: r.shellMount === true });
        });
      },
    });
    // THE READS, ANSWERED HERE:
    //   rows()      every app kept, key -> row
    //   watch(fn)   fn(key, row) on every change, row undefined once it is gone; answers its release
    //   watch(key, fn)      fn(row) when that one app changes; answers its release. A branch's watch is watch, the
    //                       branch implied by the object it is on (Andy, goal/G43.32: "that's a decision: a BRANCHE's
    //                       what is called \"watch\"", "the branch is already implied in it's containing object.")
    //   branch      the apps' whole path, for a list that is a view of it (probabilitySearch's data)
    var appReads = {
      rows: function () { return HOME.branch(APPS); },
      watch: function (key, fn) {
        if (typeof key === 'function') { var all = key; return HOME.watch(APPS, function (whole, v) { all(HOME.row(whole, APPS), v); }); }
        return HOME.watch(APPS + '/' + key, function (whole, v) { if (typeof fn === 'function') fn(v); });
      },
      get branch() { return HOME.path(APPS); },
    };
    return appReads;
  }));
}());
