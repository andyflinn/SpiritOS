'use strict';
// spirit/run/spirit/app/backup/data.js
// WHAT A CLIENT KNOWS OF THE BACKUP, IN THE backup FAMILY'S OWN FOLDER (goal/G41.28). Andy: "anything not using the
// new spiritData.js and it's buddies clientCacheManager.js must do so in this item. no exceptions." A page loads it
// through spirit.require; it keeps the backup server's status in that page's spirit.data, under the node that served it.
//
// THE BRANCH IS THIS FILE'S, AND ONLY THIS FILE NAMES IT: every reader (Desk's backup line) asks spirit.data.backup.data
// (below), never a branch by name.
//   backupStatus   'now' -> the status as status.get last answered it { lastCheck, lastCopy, ... }
// The server publishes no row of its own, so it translates nothing: a reader keeps what its status.get answered (keep).
(function () {
  var STATUS = 'backupStatus';
  var NOW = 'now';
  var D = typeof window !== 'undefined' ? window.spirit.data : require('../../spirit.js').require('spirit/data.js');
  D.makeFamily('backup', function () {
    var HOME = D.viewAt(null, 'backup');
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
      watch: function (fn) { return HOME.watch(STATUS, function () { if (typeof fn === 'function') fn(backupReads.status()); }); },
      get branch() { return HOME.path(STATUS); },
    };
    return backupReads;
  });
}());
