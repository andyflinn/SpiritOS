'use strict';
// spirit/run/spirit/app/data.js
// WHAT A CLIENT KNOWS OF A NODE'S APPS, IN THE app FAMILY'S OWN FOLDER (goal/G43.2). A page loads it through
// spirit.cacheManager('app'); it runs the translator into that page's spirit.data, under the node that served the rows.
//
// THE BRANCH IS THIS FILE'S, AND ONLY THIS FILE NAMES IT: every reader (the app row and list) asks spirit.data.app.data
// (below), never a branch by name.
//   apps   key -> { key, label, icon, active, shell, intrinsic, nodeMount }, what app.search answered (seated by the list that is a view of it), and the
//          whole table the apps news of the node's own job spirit.app holds (spirit/app.js): a key it no longer names is gone.
// Every event ends in set or del; it asks nothing.
(function () {
  var APPS = 'apps';
  var D = typeof window !== 'undefined' ? window.spirit.data : require('../spirit.js').require('spirit/data.js');
  D.makeFamily('app', function () {
    var HOME = D.viewAt(null, 'app');
    D.addTranslator({
      onJob: function (job) {
        // THE APP LIST, news of spirit.app (goal/G43.20): { apps }.
        var all = job && job.id === 'spirit.app' && job.data ? job.data.apps : null;
        if (!all || typeof all !== 'object') return;
        var V = D.viewAt(job.fromNode || null, 'app');
        Object.keys(V.branch(APPS)).forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(all, k)) V.del(APPS + '/' + k); });
        // Every field the node's row carries (spirit/app.js rowOf), run and runOnly among them (goal/G43.21: a node:run app
        // is listed in pane mode only, and shows Run, not Activate).
        Object.keys(all).forEach(function (k) {
          var r = all[k] || {};
          V.set(APPS + '/' + k, { key: k, label: String(r.label || ''), icon: String(r.icon || ''), active: r.active === true, shell: r.shell === true, intrinsic: r.intrinsic === true, nodeMount: r.nodeMount === true, api: r.api === true, run: r.run === true, runOnly: r.runOnly === true, shellMount: r.shellMount === true });
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
  });
}());
