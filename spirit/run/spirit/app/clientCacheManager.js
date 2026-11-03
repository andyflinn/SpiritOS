// spirit/run/spirit/app/clientCacheManager.js
// WHAT A CLIENT KNOWS OF A NODE'S APPS, IN THE app FAMILY'S OWN FOLDER (goal/G43.2). A page loads it through
// spirit.cacheManager('app'); it runs the translator into that page's spirit.data, under the node that served the rows.
//
// THE BRANCH IS THIS FILE'S, AND ONLY THIS FILE NAMES IT: every reader (the app row and list) asks spirit.appData
// (below), never a branch by name.
//   apps   key -> { key, label, icon }, what app.search answered (seated by the list that is a view of it), and the
//          whole table the node's permanent job 'apps' holds (spirit/app.js): a key it no longer names is gone.
// Every event ends in set or del; it asks nothing.
(function (root) {
  var APPS = 'apps';
  var ATTACHED = typeof Symbol === 'function' ? Symbol.for('spirit.app.clientCacheManager') : '__appClientCacheManager';
  function attach(root) {
    var D = ((root || {}).spirit || {}).data;
    if (!D || typeof D.translate !== 'function') return;
    if (D[ATTACHED]) { (root.spirit = root.spirit || {}).appData = D[ATTACHED]; return; }
    var HOME = D.at(null, 'app');
    D.translate({
      onJob: function (job) {
        var all = job && job.type === 'apps' && job.data ? job.data.apps : null;
        if (!all || typeof all !== 'object') return;
        var V = D.at(job.fromNode || null, 'app');
        Object.keys(V.branch(APPS)).forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(all, k)) V.del(APPS + '/' + k); });
        Object.keys(all).forEach(function (k) {
          var r = all[k] || {};
          V.set(APPS + '/' + k, { key: k, label: String(r.label || ''), icon: String(r.icon || '') });
        });
      },
    });
    // THE READS, ANSWERED HERE:
    //   rows()      every app kept, key -> row
    //   watch(fn)   fn(key, row) on every change, row undefined once it is gone; answers its release
    //   watchApp(key, fn)   fn(row) when that one app changes; answers its release
    //   branch      the apps' whole path, for a list that is a view of it (probabilitySearch's data)
    var appData = {
      rows: function () { return HOME.branch(APPS); },
      watch: function (fn) { return HOME.watch(APPS, function (whole, v) { if (typeof fn === 'function') fn(HOME.row(whole, APPS), v); }); },
      watchApp: function (key, fn) { return HOME.watch(APPS + '/' + key, function (whole, v) { if (typeof fn === 'function') fn(v); }); },
      get branch() { return HOME.path(APPS); },
    };
    try { Object.defineProperty(D, ATTACHED, { value: appData }); } catch (e) { D[ATTACHED] = appData; }
    (root.spirit = root.spirit || {}).appData = appData;
  }
  if (typeof module !== 'undefined' && module && module.exports) module.exports = { attach: attach };
  // A page without the data set yet loads it first, as part of this file's tree.
  var sp = root.spirit;
  if (sp && !sp.data && typeof sp.require === 'function' && typeof sp.isBrowser === 'function' && sp.isBrowser()) {
    Promise.resolve(sp.require('spirit/spiritData.js')).then(function () { attach(root); }, function () { /* no data set: nothing kept */ });
  } else attach(root);
}(typeof window !== 'undefined' ? window : globalThis));
