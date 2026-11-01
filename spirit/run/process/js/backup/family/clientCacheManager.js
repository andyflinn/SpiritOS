// spirit/run/process/js/backup/family/clientCacheManager.js
// WHAT A CLIENT KNOWS OF THE BACKUP, IN THE backup FAMILY'S OWN FOLDER (goal/G41.28). Andy: "anything not using the
// new spiritData.js and it's buddies clientCacheManager.js must do so in this item. no exceptions." A page loads it
// through spirit.require; it keeps the backup server's status in that page's spirit.data, under the node that served it.
//
// THE BRANCH IS THIS FILE'S, AND ONLY THIS FILE NAMES IT: every reader (Desk's backup line) asks spirit.backupData
// (below), never a branch by name.
//   backupStatus   'now' -> the status as status.get last answered it { lastCheck, lastCopy, ... }
// The server publishes no row of its own, so it translates nothing: a reader keeps what its status.get answered (keep).
(function (root) {
  var STATUS = 'backupStatus';
  var NOW = 'now';
  var ATTACHED = typeof Symbol === 'function' ? Symbol.for('spirit.backup.clientCacheManager') : '__backupClientCacheManager';
  function attach(root) {
    var D = ((root || {}).spirit || {}).data;
    if (!D || typeof D.at !== 'function') return;
    if (D[ATTACHED]) { (root.spirit = root.spirit || {}).backupData = D[ATTACHED]; return; }
    var HOME = D.at(null, 'backup');
    // THE READS AND THE ONE WRITE:
    //   keep(status)   what status.get answered, kept as the server holds it; a refusal or nothing lets it go
    //   status()       the status kept, or null
    //   watch(fn)      fn(status) on every change; answers its release
    //   branch         the status's whole path
    var backupData = {
      keep: function (status) {
        if (status && typeof status === 'object' && status.ok !== false) HOME.set(STATUS + '/' + NOW, status);
        else HOME.del(STATUS + '/' + NOW);
      },
      status: function () { return HOME.get(STATUS + '/' + NOW) || null; },
      watch: function (fn) { return HOME.watch(STATUS, function () { if (typeof fn === 'function') fn(backupData.status()); }); },
      get branch() { return HOME.path(STATUS); },
    };
    try { Object.defineProperty(D, ATTACHED, { value: backupData }); } catch (e) { D[ATTACHED] = backupData; }
    (root.spirit = root.spirit || {}).backupData = backupData;
  }
  if (typeof module !== 'undefined' && module && module.exports) module.exports = { attach: attach };
  attach(root);
}(typeof window !== 'undefined' ? window : globalThis));
