'use strict';
// spirit/run/spirit/fs/server/script.js
// THE FS CACHE'S ONE WRITER, THE FILE WATCHER (goal/G49.15, box v16: "The watcher leaves spirit/job/script.js for the fs
// branch, with the flags. job/script.js keeps the jobs and the app starts."; "the watcher lands in spirit/fs/server/script.js
// and is required by the node."). Moved whole from job's script, where it was goal/G4.25's watcher:
//
//   Andy, 2026-10-02: "the current design is horrid. for lazy load the stream can send createDirectory run /
//   createDirectory media / createFile index.html etc... just send \"commands up the stream to modify the tree.\"",
//   "so that s our replacement then. quick and free and maintained by others....", "forget about batching"; and
//   2026-10-04, "local copy it is" (chokidar, under spirit/fs/chokidar/ since goal/G49.15).
//
// The watcher keeps the tree (path -> {kind, size, modified}) and sends what changed, one command per job-updated:
// data.command {op, path, at}, op createDirectory, createFile, changeFile, deleteFile or deleteDirectory, path
// relative to the watched root. The whole list never travels again: a page that connects gets the tree as create
// commands read from spirit/fs/dataset/script.js (commands(), in event/event.js and faceHome.js). THE TREE IS COMPLETE (goal/G49.2;
// Andy: "the shared dataset needs to be complete, period", "it is at publish-to-clients time that !fileServable be the
// filter"): seeded from scanFolder's whole walk and watched whole, .git alone left out; only what is published to a page is
// cut by fileServable (event/event.js, faceHome.js). chokidar reports at startup what the seed already holds, which sends
// nothing.
//
// A FOLDER'S FLAGS (goal/G49.15): each a condition of its own in spirit/fs/filter/<flag>/script.js, asked here for each
// folder, the answer kept on the folder's row: api (an old-shape branch), branch (a new-shape branch), app (an app's
// folder), live (an app the owner switched on, from spirit/state/<app>/node.json). Files carry none.
//
//   start(rootDir, jobs) -> the watcher's job, spirit.fs, in the node's job table (spirit/job/script.js's installJobs);
//                           its updates carry each command, which is how pages get the tree
require('../../script.js');

const fs = require('fs');
const path = require('path');
const fileSystem = spirit.requireScript('spirit/fs/fileSystem/script.js');
const FLAG_API = spirit.requireScript('spirit/fs/filter/api/script.js').api;
const FLAG_BRANCH = spirit.requireScript('spirit/fs/filter/branch/script.js').branch;
const FLAG_APP = spirit.requireScript('spirit/fs/filter/app/script.js').app;
const FLAG_LIVE = spirit.requireScript('spirit/fs/filter/live/script.js').live;

const FS_OPS = { add: 'createFile', addDir: 'createDirectory', change: 'changeFile', unlink: 'deleteFile', unlinkDir: 'deleteDirectory' };
const RUN_ROOT = path.join(__dirname, '..', '..', '..');
// THE TREE IS spirit.required.spirit.data.fs (goal/G49.1, box v17: "chokidar --> (node: spirit.required.spirit.data.fs) -->
// spirit.eventStream --> browsers and node processes"): the watcher writes each command into this process's
// spirit.required.spirit.data, where spirit/fs/client/script.js files it as it does a page's stream, and reads it back from there.
// fsWatching is the watcher whose tree it is, null once it stopped.
const FS_HOME = 'local'; // the node's own name in its spirit.required.spirit.data, as a child that follows the stream names it (spirit/data/script.js)
let fsWatching = null;
function fsDataset() { return spirit.requireScript('spirit/fs/dataset/script.js'); }
function fsWrite(command) {
  spirit.requireScript('spirit/data/script.js').takeJob({ id: 'spirit.fs', data: { command: command } }, FS_HOME);
}
// A FOLDER'S FLAGS, EACH ITS FILTER'S ANSWER (goal/G49.15). has(path): the tree holds that path; read(path): that file's
// text from disc, or null (live reads an app's node.json).
function readRun(rootDir) {
  return function (rel) { try { return fs.readFileSync(path.join(rootDir, rel), 'utf8'); } catch (e) { return null; } };
}
function folderFlags(dir, has, read) {
  return { api: FLAG_API(dir, has), branch: FLAG_BRANCH(dir, has), app: FLAG_APP(dir, has), live: FLAG_LIVE(dir, read) };
}
function sameFlags(a, row) {
  return a.api === (row.api === true) && a.branch === (row.branch === true) && a.app === (row.app === true) && a.live === (row.live === true);
}

// THE STAT RIDES WITH EVERY CREATE AND CHANGE (goal/G29.8). The item's box: "The node streams the tree to the page as
// it does, the watcher's updates, now each with its stat: size and modified, for every create and change; a delete
// carries none." A file's size in bytes; modified an ISO time; a folder carries its modified alone. A path gone
// before it could be read carries none.
function statOf(full, kind) {
  let st = null;
  try { st = fs.statSync(full); } catch (e) { return { kind: kind }; }
  return kind === 'folder' ? { kind: kind, modified: st.mtime.toISOString() } : { kind: kind, size: st.size, modified: st.mtime.toISOString() };
}
// A CORE FILE SAYS SO (goal/G30.21: "the files list thing should display core files with yellow typeface"), by the one
// rule the commit check reads (coreFiles.js); the run folder is spirit/run of the checkout two folders up.
// THE FLAG IS KEPT ON THE LIST (goal/G47.1; Andy: "stick that flag on the fucking file list, then you have to check each
// file once with isCore()"): worked out once, when the file enters the kept list, and again for an app's files when its
// <name>.json changes, never as the list is sent.
function heldOf(p, full, kind) {
  const held = statOf(full, kind);
  if (kind === 'file' && spirit.requireScript('spirit/coreFiles/script.js').isCore('spirit/run/' + p, path.resolve(RUN_ROOT, '..', '..'))) held.core = true;
  return held;
}
// A file row as a tree command: spirit/fs/dataset/script.js's, where a connect's whole tree is read too (goal/G49.2).
function commandOf(op, p, at, held) { return fsDataset().CommandOf(op, p, at, held); }
function mapEntry(entry, rootDir) {
  const full = path.join(entry.parentPath, entry.name);
  return { fullPath: full, relativePath: path.relative(rootDir, full).replace(/\\/g, '/'), kind: entry.isDirectory() ? 'folder' : 'file' };
}

function start(rootDir, jobs) {
  const tree = fsDataset();
  tree.FedHere();
  const own = {};
  fsWatching = own;
  const read = readRun(rootDir);
  // The tree as it was, gone (a watcher started again), then the seed: each path filed as a create, the folder flags
  // worked out from the seed itself, then the tree's end.
  Object.keys(tree.files()).sort().reverse().forEach(function (p) { const was = tree.file(p); if (was) fsWrite({ op: was.kind === 'folder' ? 'deleteDirectory' : 'deleteFile', path: p }); });
  const seed = new Map();
  fileSystem.scanFolder(rootDir, [], true).forEach(function (entry) { const m = mapEntry(entry, rootDir); seed.set(m.relativePath, heldOf(m.relativePath, m.fullPath, m.kind)); });
  const seedAt = new Date().toISOString();
  Array.from(seed.keys()).sort().forEach(function (p) {
    const held = seed.get(p);
    if (held.kind === 'folder') Object.assign(held, folderFlags(p, function (q) { return seed.has(q); }, read));
    fsWrite(commandOf(held.kind === 'folder' ? 'createDirectory' : 'createFile', p, seedAt, held));
  });
  spirit.requireScript('spirit/data/script.js').takeJob({ id: 'spirit.fs', data: { treeComplete: true } }, FS_HOME);
  const has = function (q) { return !!tree.file(q); };
  // THE NODE'S FILES ARE spirit.fs (goal/G43.20).
  const job = jobs.ownJob('spirit.fs');
  const relOf = function (full) { return path.relative(rootDir, full).split(path.sep).join('/'); };
  const ignored = function (full) {
    const rel = path.relative(RUN_ROOT, path.resolve(full)).split(path.sep).join('/');
    if (!rel || rel.indexOf('..') === 0) return false;
    return rel.split('/').some(function (part) { return part === '.git'; });
  };
  const watcher = spirit.requireScript('spirit/fs/chokidar/index.js').watch(rootDir, { ignored: ignored, ignoreInitial: false, persistent: true });
  // Each command goes into spirit.required.spirit.data.fs first, then up the stream, so what a page is handed is what the node holds.
  const send = function (command) { fsWrite(command); jobs.updateJob(job.id, { data: { command: command } }); };
  // A folder whose flags turned is sent again as a createDirectory with its new row.
  const reflag = function (dir) {
    const row = tree.file(dir);
    if (!row || row.kind !== 'folder') return;
    const flags = folderFlags(dir, has, read);
    if (!sameFlags(flags, row)) send(commandOf('createDirectory', dir, new Date().toISOString(), Object.assign({}, row, flags)));
  };
  watcher.on('all', function (event, full) {
    const op = FS_OPS[event];
    const rel = full ? relOf(full) : '';
    if (!op || !rel || rel.indexOf('..') === 0 || fsWatching !== own) return;
    let held = null;
    if (op === 'createFile' || op === 'createDirectory') {
      const kind = op === 'createDirectory' ? 'folder' : 'file';
      const was = tree.file(rel);
      if (was && was.kind === kind) return; // already held: the startup report, or a repeat
      held = heldOf(rel, full, kind);
      if (kind === 'folder') Object.assign(held, folderFlags(rel, has, read));
    } else if (op === 'deleteFile' || op === 'deleteDirectory') {
      if (!tree.file(rel)) return;
    } else held = heldOf(rel, full, 'file'); // a change: the new stat (a file never seen is made by it)
    send(commandOf(op, rel, new Date().toISOString(), held));
    // A FOLDER'S FLAGS FOLLOW ITS FILES (goal/G49.1): a file made or gone inside a folder works the folder's flags out
    // again, and its parent's (client/script.js is a level down); a changed file changes no flag of its own folder's.
    const cut = rel.lastIndexOf('/');
    const dir = cut > 0 ? rel.slice(0, cut) : '';
    if (dir && op !== 'changeFile') {
      reflag(dir);
      const up = dir.lastIndexOf('/');
      if (up > 0) reflag(dir.slice(0, up));
    }
    // AN APP SWITCHED ON OR OFF (goal/G49.15): spirit/state/<app>/node.json made, changed or gone turns that app's live.
    const state = /^spirit\/state\/([^/]+)\/node\.json$/.exec(rel);
    if (state && op !== 'createDirectory' && op !== 'deleteDirectory') reflag('spirit/app/' + state[1]);
    // AN APP'S <name>.json CHANGED, MADE OR GONE: whether its files are core may have changed with it (coreFiles.js reads
    // its identity.intrinsic), so its files' flags are worked out again, and each one that turned is sent as a change.
    const app = /^spirit\/app\/([^/]+)\/([^/]+)\.json$/.exec(rel);
    if (app && app[1] === app[2] && op !== 'createDirectory' && op !== 'deleteDirectory') {
      const under = 'spirit/app/' + app[1] + '/';
      const files = tree.files();
      Object.keys(files).forEach(function (p) {
        const h = files[p];
        if (h.kind !== 'file' || p.indexOf(under) !== 0 || p === rel) return;
        const core = spirit.requireScript('spirit/coreFiles/script.js').isCore('spirit/run/' + p, path.resolve(RUN_ROOT, '..', '..'));
        if (core === (h.core === true)) return;
        send(commandOf('changeFile', p, new Date().toISOString(), Object.assign({}, h, { core: core })));
      });
    }
  });

  watcher.on('error', function (err) {
    // 'failed', not 'error': only a terminal status can be deleted, and a watcher that died left a row in Jobs that
    // deleteJob refused forever, with no way to clear it short of restarting the server.
    jobs.updateJob(job.id, { status: 'failed', logMessage: String(err) });
  });

  job._stop = function () {
    watcher.close();
    if (fsWatching === own) fsWatching = null;
  };

  return job;
}

module.exports = { start: start };
