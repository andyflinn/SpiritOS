// spirit/run/shell/js/files/data.js
// FILES' TRANSLATOR (goal/G30.20): what the fs-watcher's stream means for data.files, the page's mirror of the node's
// tree (shell/js/spiritData.js). A connecting page is handed the tree as create commands, then treeComplete: the branch
// fills quietly and its watchers hear one word at the end; after that each change is told by path. Every event ends in
// set or del. Runs in node too, for a suite.
(function (root) {
  var D = (root.spirit || {}).data;
  if (!D || typeof D.translate !== 'function') return;
  D.translate({
    onJob: function (job) {
      if (job.type !== 'fs-watcher') return;
      if (job.data.treeComplete) { D.ready('files', true); return; }
      var cmd = job.data.command;
      if (!cmd || !cmd.path) return;
      if (!D.ready('files')) D.quietly('files', true);
      var p = String(cmd.path);
      if (cmd.op === 'deleteFile') D.del('files/' + p);
      else if (cmd.op === 'deleteDirectory') {
        D.del('files/' + p);
        Object.keys(D.branch('files')).forEach(function (k) { if (k.indexOf(p + '/') === 0) D.del('files/' + k); });
      } else {
        var was = D.branch('files')[p] || {};
        // core: the node's word that the file is core (goal/G30.21), painted yellow by its row.
        D.set('files/' + p, { kind: cmd.op === 'createDirectory' ? 'folder' : was.kind || 'file', size: cmd.size, modified: cmd.modified, core: cmd.core === true });
      }
    },
  });
}(typeof window !== 'undefined' ? window : globalThis));
