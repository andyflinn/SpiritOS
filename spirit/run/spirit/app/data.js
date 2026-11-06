// spirit/run/spirit/app/data.js
// WHAT A CLIENT KNOWS OF A NODE'S APPS, IN THE app FAMILY'S OWN FOLDER (goal/G43.2). A page loads it through
// spirit.cacheManager('app'); it runs the translator into that page's spirit.data, under the node that served the rows.
//
// THE BRANCH IS THIS FILE'S, AND ONLY THIS FILE NAMES IT: every reader (the app row and list) asks spirit.data.app.data
// (below), never a branch by name.
//   apps   key -> { key, label, icon, active, shell, intrinsic, nodeMount }, what app.search answered (seated by the list that is a view of it), and the
//          whole table the node's permanent job 'apps' holds (spirit/app.js): a key it no longer names is gone.
// Every event ends in set or del; it asks nothing.
(function () {
  var APPS = 'apps';
  var D = typeof window !== 'undefined' ? window.spirit.data : require('../data.js');
  D.makeFamily('app', function () {
    var HOME = D.viewAt(null, 'app');
    D.addTranslator({
      onJob: function (job) {
        var all = job && job.type === 'apps' && job.data ? job.data.apps : null;
        if (!all || typeof all !== 'object') return;
        var V = D.viewAt(job.fromNode || null, 'app');
        Object.keys(V.branch(APPS)).forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(all, k)) V.del(APPS + '/' + k); });
        Object.keys(all).forEach(function (k) {
          var r = all[k] || {};
          V.set(APPS + '/' + k, { key: k, label: String(r.label || ''), icon: String(r.icon || ''), active: r.active === true, shell: r.shell === true, intrinsic: r.intrinsic === true, nodeMount: r.nodeMount === true });
        });
      },
    });
    // THE READS, ANSWERED HERE:
    //   rows()      every app kept, key -> row
    //   watch(fn)   fn(key, row) on every change, row undefined once it is gone; answers its release
    //   watchApp(key, fn)   fn(row) when that one app changes; answers its release
    //   branch      the apps' whole path, for a list that is a view of it (probabilitySearch's data)
    var appReads = {
      rows: function () { return HOME.branch(APPS); },
      watch: function (fn) { return HOME.watch(APPS, function (whole, v) { if (typeof fn === 'function') fn(HOME.row(whole, APPS), v); }); },
      watchApp: function (key, fn) { return HOME.watch(APPS + '/' + key, function (whole, v) { if (typeof fn === 'function') fn(v); }); },
      get branch() { return HOME.path(APPS); },
    };
    return appReads;
  });
}());
