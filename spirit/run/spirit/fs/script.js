'use strict';
// spirit/run/spirit/fs/script.js
// THE FS DATASET'S ONE ENTRY IN A NODE PROCESS (goal/G49.1, box v17: "spirit/fs/script.js is the one entry for a node process
// that wants the fs dataset: it wraps spirit/fs/data.js and, in a child process, adds the followStream call opaquely. A
// caller never knows how the dataset is created or updated"). It answers spirit.required.spirit.data.fs's reads: file(path), files(),
// ready(), watch(fn) / watch(path, fn), branch.
//
// WHO FEEDS IT: in the node's main process the file watcher (spirit/job/script.js) writes every change into spirit.required.spirit.data.fs and
// says so with FedHere(); in any other process nothing does, so spirit.required.spirit.data follows the node's stream, which hands the
// whole tree and then each change into the same fs/data.js translator a page uses.
//
// Node only. It changes no caller (box v17, "OUT OF SCOPE OF THIS ITEM: changing any future client of spirit/fs/script.js").
require('../script.js');
// The branch's api.js, which brings its companion spirit/fs/data.js, which makes spirit.required.spirit.data.fs. In node spirit.requireScript
// loads the file at once and then binds spirit.fs; a process with no port to bind to (the node's own main process on a
// fresh tree) is refused the binding, never the file, so that refusal is let go.
Promise.resolve(spirit.requireScript('spirit/fs/api.js')).then(null, function () { /* the binding; the dataset is here */ });
const D = spirit.requireScript('spirit/data/script.js');

let fed = false;
let following = false;
function fill() {
  if (fed || following) return;
  following = true;
  D.followStream();
}
function reads() { return D.fs.data; }
// Required is asked: a process that only requires this file holds the dataset. The writer says FedHere in the same turn it
// requires this file, so the stream is followed on the next turn only where no watcher writes.
setImmediate(fill);

// ONE FILE ROW AS A TREE COMMAND (goal/G4.25, G29.8, G49.1): {op, path, at} with the row's size, modified, and core, api and app
// when true; the watcher sends each change so, and a connect is handed the whole tree so.
function CommandOf(op, p, at, row) {
  const c = { op: op, path: p, at: at };
  if (row && row.size !== undefined) c.size = row.size;
  if (row && row.modified !== undefined) c.modified = row.modified;
  if (row && row.core === true) c.core = true;
  if (row && row.api === true) c.api = true;
  if (row && row.app === true) c.app = true;
  return c;
}

module.exports = {
  file: function (p) { fill(); return reads().file(p); },
  files: function () { fill(); return reads().files(); },
  ready: function () { fill(); return reads().ready(); },
  watch: function (p, fn) { fill(); return reads().watch(p, fn); },
  get branch() { fill(); return reads().branch; },
  // THE WHOLE TREE, READ FROM THE DATASET (goal/G49.2; Andy: "go on the five!"; G49.1's box: "event.js, faceHome.js and
  // nodeSearches.js read spirit.required.spirit.data.fs"): as create commands for a connect, a folder before what is inside it, and as
  // entries { name, relativePath, kind } for the counts and fs.search.
  commands: function () {
    fill();
    const files = reads().files();
    const at = new Date().toISOString();
    return Object.keys(files).sort().map(function (p) { return CommandOf(files[p].kind === 'folder' ? 'createDirectory' : 'createFile', p, at, files[p]); });
  },
  entries: function () {
    fill();
    const files = reads().files();
    return Object.keys(files).sort().map(function (p) { return { name: p.slice(p.lastIndexOf('/') + 1), relativePath: p, kind: files[p].kind }; });
  },
  CommandOf: CommandOf,
  // The writer's word, said once by the node's file watcher before it writes: this process is fed here, not by a stream.
  FedHere: function () { fed = true; },
};
