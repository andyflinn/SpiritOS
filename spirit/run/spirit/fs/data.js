'use strict';
// spirit/run/spirit/fs/data.js
// WHAT A CLIENT KNOWS OF A NODE'S FILES, IN THE fs FAMILY'S OWN FOLDER (goal/G41.28). Andy: "We're not done until every
// family of the API tree as a clientCacheManager, and clients can use that to organize their spirit.data", and the box:
// "the clientCacheManager stores the in-RAM cache EXACTLY the same in spirit.data, in the browser AND in an appServer
// running in client mode." A page loads it through spirit.cacheManager('fs'); it runs the translator into that page's
// spirit.data, under the node that served the tree.
//
// THE BRANCH IS THIS FILE'S, AND ONLY THIS FILE NAMES IT: every reader (the files rows and list, the Apps, the Icons, the
// face's boot) asks spirit.data.fs.data (below), never a branch by name.
//   files   path -> { kind, size, modified, core }, the node's file tree as its spirit.fs streams it
//   icons   glyph -> { glyph, keywords }, the icon set, a file the family serves, as the icons list last read it
//           (goal/G41.28, moved here from the icons list element): a set read again replaces it whole
// The tree comes as updates of one job, the spirit.fs job's: a connecting page is handed the tree as create commands, then
// treeComplete: the branch fills quietly and its watchers hear one word at the end; after that each change is told by
// path (goal/G30.18, moved here from the files row element). Every event ends in set or del; it asks nothing.
(function () {
  var FILES = 'files';
  var ICONS = 'icons';
  var D = typeof window !== 'undefined' ? window.spirit.data : require('../spirit.js').require('spirit/data.js');
  D.makeFamily('fs', function () {
    // The fs family's view of the home node (a page's own); a stream's job is filed under the node that sent it.
    var HOME = D.viewAt(null, 'fs');
    D.addTranslator({
      onJob: function (job) {
        if (!job || job.id !== 'spirit.fs' || !job.data) return;
        var V = D.viewAt(job.fromNode || null, 'fs');
        if (job.data.treeComplete) { V.ready(FILES, true); return; }
        var cmd = job.data.command;
        if (!cmd || !cmd.path) return;
        if (!V.ready(FILES)) V.quietly(FILES, true);
        var p = String(cmd.path);
        if (cmd.op === 'deleteFile') V.del(FILES + '/' + p);
        else if (cmd.op === 'deleteDirectory') {
          V.del(FILES + '/' + p);
          Object.keys(V.branch(FILES)).forEach(function (k) { if (k.indexOf(p + '/') === 0) V.del(FILES + '/' + k); });
        } else {
          var was = V.branch(FILES)[p] || {};
          // core: the node's word that the file is core (goal/G30.21), painted yellow by its row.
          V.set(FILES + '/' + p, { kind: cmd.op === 'createDirectory' ? 'folder' : was.kind || 'file', size: cmd.size, modified: cmd.modified, core: cmd.core === true });
        }
      },
    });
    // THE READS, ANSWERED HERE:
    //   file(path)       a file's row, or null;  files()  every path kept, path -> row
    //   ready()          true once the whole tree has come
    //   watch(fn)        fn(path, row) on every change, row undefined once it is gone, path '' when the tree is whole
    //                    or forgotten; answers its release
    //   watch(p, fn)     fn(row) when that one file changes; answers its release. A branch's watch is watch, the branch
    //                    implied by the object it is on (Andy, goal/G43.32: "that's a decision: a BRANCHE's what is called
    //                    \"watch\"", "the branch is already implied in it's containing object.")
    //   branch          the tree's whole path, for a list that is a view of it (probabilitySearch's data)
    var fsReads = {
      file: function (p) { return p ? HOME.get(FILES + '/' + p) || null : null; },
      files: function () { return HOME.branch(FILES); },
      ready: function () { return !!HOME.ready(FILES); },
      watch: function (p, fn) {
        if (typeof p === 'function') { var all = p; return HOME.watch(FILES, function (whole, v) { all(HOME.row(whole, FILES), v); }); }
        return HOME.watch(FILES + '/' + p, function (whole, v) { if (typeof fn === 'function') fn(v); });
      },
      get branch() { return HOME.path(FILES); },
      // The icon set: keep(set) replaces it whole ({ glyph: [keywords] }); row(glyph); watch(glyph, fn(row)); branch.
      icons: {
        keep: function (set) {
          var s = set && typeof set === 'object' ? set : {};
          Object.keys(HOME.branch(ICONS)).forEach(function (g) { if (!Object.prototype.hasOwnProperty.call(s, g)) HOME.del(ICONS + '/' + g); });
          Object.keys(s).forEach(function (g) { HOME.set(ICONS + '/' + g, { glyph: g, keywords: Array.isArray(s[g]) ? s[g] : [] }); });
        },
        row: function (g) { return g ? HOME.get(ICONS + '/' + g) || null : null; },
        watch: function (g, fn) { return HOME.watch(ICONS + '/' + g, function (whole, v) { if (typeof fn === 'function') fn(v); }); },
        get branch() { return HOME.path(ICONS); },
      },
    };
    return fsReads;
  });
}());
