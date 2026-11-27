'use strict';
// spirit/run/spirit/app/backup/data.js
// WHAT A CLIENT KNOWS OF THE BACKUP, IN THE backup FAMILY'S OWN FOLDER (goal/G41.28). Andy: "anything not using the
// new spiritData.js and it's buddies clientCacheManager.js must do so in this item. no exceptions." A page loads it
// through spirit.requireScript; it keeps the backup server's status in that page's spirit.required.spirit.data, under the node that served it.
//
// THE BRANCH IS THIS FILE'S, AND ONLY THIS FILE NAMES IT: every reader (Desk's backup line) asks spirit.required.spirit.data['spirit.app.backup'].data
// (below), never a branch by name.
//   backupStatus   'now' -> the status as status.get last answered it { lastCheck, lastCopy, ... }
// The server publishes no row of its own, so it translates nothing: a reader keeps what its status.get answered (keep).
(function family(given) {
  var STATUS = 'backupStatus';
  var NOW = 'now';
  var D = typeof require === 'function' ? require('../../script.js').requireScript('spirit/client/script.js') : given;
  // ON A PAGE, THE DATA SET AS spirit.requireScript HANDS IT BACK (goal/G49.23; goal/G49.9: never read at its place): this file runs
  // again with it once it has loaded.
  // THE DATA SET IT FILES INTO, REQUIRED BY ITSELF (goal/G47.1, box v182: "It is loaded by that path with spirit.requireScript,
  // data.js exactly as api.js"): on a page that has not loaded spirit/client/script.js yet, this file loads it and runs again.
  if (!D) { window.spirit.requireScript('spirit/client/script.js').then(function (got) { if (got) family(got); }); return; }
  D.makeFamily('spirit.app.backup', function () {
    var HOME = D.viewAt(null, 'spirit.app.backup');
    // THE READS AND THE ONE WRITE:
    //   keep(status)   what status.get answered, kept as the server holds it; a refusal or nothing lets it go
    //   status()       the status kept, or null
    //   watch(fn)      fn(status) on every change; answers its release
    //   branch         the status's whole path
    var backupReads = {
      keep: function (status) {
        if (status && typeof status === 'object' && status.ok !== false) HOME.set(STATUS + '/' + NOW, status);
        else HOME.del(STATUS + '/' + NOW);
      },
      status: function () { return HOME.get(STATUS + '/' + NOW) || null; },
      // The row status() reads, and only that: what it watches is what it answers.
      watch: function (fn) { return HOME.watch(STATUS + '/' + NOW, function () { if (typeof fn === 'function') fn(backupReads.status()); }); },
      get branch() { return HOME.path(STATUS); },
    };
    return backupReads;
  });
}());
