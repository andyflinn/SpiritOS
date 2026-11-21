'use strict';
// spirit/run/spirit/fs.js
// THE FS DATASET'S ONE ENTRY IN A NODE PROCESS (goal/G49.1, box v17: "spirit/fs.js is the one entry for a node process
// that wants the fs dataset: it wraps spirit/fs/data.js and, in a child process, adds the followStream call opaquely. A
// caller never knows how the dataset is created or updated"). It answers spirit.data.fs's reads: file(path), files(),
// ready(), watch(fn) / watch(path, fn), branch.
//
// WHO FEEDS IT: in the node's main process the file watcher (spirit/job.js) writes every change into spirit.data.fs and
// says so with FedHere(); in any other process nothing does, so spirit.data follows the node's stream, which hands the
// whole tree and then each change into the same fs/data.js translator a page uses.
//
// Node only. It changes no caller (box v17, "OUT OF SCOPE OF THIS ITEM: changing any future client of spirit/fs.js").
require('./spirit.js');
// The branch's api.js, which brings its companion spirit/fs/data.js, which makes spirit.data.fs. In node spirit.require
// loads the file at once and then binds spirit.fs; a process with no port to bind to (the node's own main process on a
// fresh tree) is refused the binding, never the file, so that refusal is let go.
Promise.resolve(spirit.require('spirit/fs/api.js')).then(null, function () { /* the binding; the dataset is here */ });
const D = spirit.require('spirit/data.js');

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

module.exports = {
  file: function (p) { fill(); return reads().file(p); },
  files: function () { fill(); return reads().files(); },
  ready: function () { fill(); return reads().ready(); },
  watch: function (p, fn) { fill(); return reads().watch(p, fn); },
  get branch() { fill(); return reads().branch; },
  // The writer's word, said once by the node's file watcher before it writes: this process is fed here, not by a stream.
  FedHere: function () { fed = true; },
};
