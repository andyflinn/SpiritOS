'use strict';
// spirit/run/spirit/fs/server/script.js
// THE FS CACHE'S ONE WRITER, THE FILE WATCHER (goal/G49.15, box v16: "The watcher leaves spirit/job/engine/script.js for the fs
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
//   start(rootDir, jobs) -> the watcher's job, spirit.fs, in the node's job table (spirit/job/engine/script.js's installJobs);
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
const FS_HOME = 'local'; // the node's own name in its spirit.required.spirit.data, as a child that follows the stream names it (spirit/client/script.js)
let fsWatching = null;
function fsDataset() { return spirit.requireScript('spirit/fs/dataset/script.js'); }
function fsWrite(command) {
  spirit.requireScript('spirit/client/script.js').takeJob({ id: 'spirit.fs', data: { command: command } }, FS_HOME);
}
// A FOLDER'S FLAGS, EACH ITS FILTER'S ANSWER (goal/G49.15). has(path): the tree holds that path; read(path): that file's
// text from disc, or null (live reads an app's node.json).
function readRun(rootDir) {
  return function (rel) { try { return fs.readFileSync(path.join(rootDir, rel), 'utf8'); } catch (e) { return null; } };
}
// THE RELAY BRANCH IS A RELAY'S ONLY (goal/G49.25, box v16: "the fs watcher, when !spirit.IS_RELAY, will never mark spirit.relay as
// a branch, and spirit.relay will not be exposed as such"): on a node spirit/relay carries neither branch mark.
const RELAY_BRANCH = 'spirit/relay';
// NO APP SERVER ON A RELAY (goal/G49.25; Andy: "a node, when spirit.IS_RELAY will not mark app servers as app or branch, too much
// weight."): an app whose manifest, its manifest.json or its old <name>.json, says node mount or node run carries neither mark there.
function appServer(dir, read) {
  const name = dir.slice(dir.lastIndexOf('/') + 1);
  const text = read(dir + '/manifest.json') || read(dir + '/' + name + '.json');
  let m = null;
  try { m = JSON.parse(String(text)); } catch (e) { m = null; }
  const node = m && m.node && typeof m.node === 'object' ? m.node : {};
  return node.mount === true || node.run === true;
}
function folderFlags(dir, has, read) {
  const relayHidden = !spirit.IS_RELAY && dir === RELAY_BRANCH;
  const app = FLAG_APP(dir, has, read);
  const heavy = spirit.IS_RELAY && app && appServer(dir, read);
  return { api: !relayHidden && FLAG_API(dir, has), branch: !relayHidden && !heavy && FLAG_BRANCH(dir, has), app: app && !heavy, live: FLAG_LIVE(dir, read) };
}
function sameFlags(a, row) {
  return a.api === (row.api === true) && a.branch === (row.branch === true) && a.app === (row.app === true) && a.live === (row.live === true);
}
// ON A RELAY, BRANCH AND APP FOLDERS ONLY (goal/G49.25, box v10: "if spirit.IS_RELAY, the fs cache will cache branch and app folders
// only."; "the existing logic is used to identify both old and new branches and apps"; Q6, "does the cache hold only spirit/<branch>/
// and spirit/app/<name>/ folders with what is under them", Andy: "spirit is always loaded."). A HOME is a trunk folder spirit/<name>
// with the old branch mark (api) or the new one (branch), or any folder with the app mark, by the same filters as on a node; kept is
// spirit/ and the files right in it, each home and everything under it, and OUTSIDE spirit/ EVERYTHING (Andy, v12: "it will still
// cache everything outside of run://spirit/"). Every other path stays on the disc, where the marks are worked out from (a relay's
// RAM is the most expensive thing it has). homeAt(dir): whether that folder is a home.
function isHome(p, held) {
  return !!held && held.kind === 'folder' && ((/^spirit\/[^/]+$/.test(p) && (held.api === true || held.branch === true)) || held.app === true);
}
function kept(p, held, homeAt) {
  if (!spirit.IS_RELAY) return true;
  const q = String(p);
  if (q === 'spirit' || q.indexOf('spirit/') !== 0) return true;
  if (/^spirit\/[^/]+$/.test(q) && !!held && held.kind === 'file') return true;
  if (isHome(q, held)) return true;
  for (let d = q, i = d.lastIndexOf('/'); i > 0; i = d.lastIndexOf('/')) {
    d = d.slice(0, i);
    if (homeAt(d)) return true;
  }
  return false;
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
  if (kind === 'file' && spirit.requireScript('spirit/fs/coreFiles/script.js').isCore('spirit/run/' + p, path.resolve(RUN_ROOT, '..', '..'))) held.core = true;
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
  // In path order a folder comes before what is under it, so its flags, and whether it is a home, are known first.
  const homes = new Set();
  Array.from(seed.keys()).sort().forEach(function (p) {
    const held = seed.get(p);
    if (held.kind === 'folder') Object.assign(held, folderFlags(p, function (q) { return seed.has(q); }, read));
    if (isHome(p, held)) homes.add(p);
    if (kept(p, held, function (d) { return homes.has(d); })) fsWrite(commandOf(held.kind === 'folder' ? 'createDirectory' : 'createFile', p, seedAt, held));
  });
  spirit.requireScript('spirit/client/script.js').takeJob({ id: 'spirit.fs', data: { treeComplete: true } }, FS_HOME);
  // Whether the tree holds a path: the kept rows on a node, the disc on a relay, which keeps only some.
  const has = spirit.IS_RELAY ? function (q) { return fs.existsSync(path.join(rootDir, q)); } : function (q) { return !!tree.file(q); };
  const homeAt = function (d) { return isHome(d, tree.file(d)); };
  // A FOLDER THAT TURNED A HOME ON A RELAY BRINGS WHAT IS UNDER IT, and one that stopped being one takes it (goal/G49.25): read
  // from the disc, as the seed was; a path still kept by another home stays.
  const under = function (dir) {
    const out = [];
    const walk = function (rel) {
      let names = [];
      try { names = fs.readdirSync(path.join(rootDir, rel), { withFileTypes: true }); } catch (e) { return; }
      names.forEach(function (e) {
        const p = rel + '/' + e.name;
        if (e.name === '.git') return;
        out.push({ p: p, kind: e.isDirectory() ? 'folder' : 'file' });
        if (e.isDirectory()) walk(p);
      });
    };
    walk(dir);
    return out;
  };
  // THE NODE'S FILES ARE spirit.fs (goal/G43.20).
  // A RELAY KEEPS NO JOB TABLE (goal/G49.25): there the cache is fed and nothing is published; job is a plain row to stop by.
  const job = jobs ? jobs.ownJob('spirit.fs') : { id: 'spirit.fs' };
  const relOf = function (full) { return path.relative(rootDir, full).split(path.sep).join('/'); };
  const ignored = function (full) {
    const rel = path.relative(RUN_ROOT, path.resolve(full)).split(path.sep).join('/');
    if (!rel || rel.indexOf('..') === 0) return false;
    return rel.split('/').some(function (part) { return part === '.git'; });
  };
  // ON A RELAY NO STARTUP REPORT (goal/G49.25): chokidar reports every path it finds as it starts, which a node answers with nothing,
  // each already held; a relay holds no row for most of them under spirit/, and would work every one out again from the disc, in
  // the moments its first requests come. The seed has them already.
  const watcher = spirit.requireScript('spirit/fs/chokidar/index.js').watch(rootDir, { ignored: ignored, ignoreInitial: spirit.IS_RELAY, persistent: true });
  // Each command goes into spirit.required.spirit.data.fs first, then up the stream, so what a page is handed is what the node holds.
  const send = function (command) { fsWrite(command); if (jobs) jobs.updateJob(job.id, { data: { command: command } }); };
  // A folder whose flags turned is sent again as a createDirectory with its new row. On a relay a folder that gained a mark
  // comes in as a new row, and one that lost its last goes (kept above).
  const reflag = function (dir) {
    const row = tree.file(dir);
    if (spirit.IS_RELAY) {
      const flags = folderFlags(dir, has, read);
      const now = Object.assign(row ? Object.assign({}, row) : statOf(path.join(rootDir, dir), 'folder'), flags);
      const wasHome = isHome(dir, row);
      const keep = kept(dir, now, homeAt);
      const at = new Date().toISOString();
      if (keep && (!row || !sameFlags(flags, row))) send(commandOf('createDirectory', dir, at, now));
      if (!wasHome && isHome(dir, now)) {
        under(dir).forEach(function (u) {
          if (tree.file(u.p)) return;
          const h = heldOf(u.p, path.join(rootDir, u.p), u.kind);
          if (u.kind === 'folder') Object.assign(h, folderFlags(u.p, has, read));
          send(commandOf(u.kind === 'folder' ? 'createDirectory' : 'createFile', u.p, at, h));
        });
      } else if (wasHome && !isHome(dir, now)) {
        Object.keys(tree.files()).filter(function (p) { return p.indexOf(dir + '/') === 0; }).sort().reverse().forEach(function (p) {
          if (kept(p, tree.file(p), function (d) { return d !== dir && homeAt(d); })) return;
          send(commandOf(tree.file(p).kind === 'folder' ? 'deleteDirectory' : 'deleteFile', p, at, null));
        });
      }
      if (!keep && row) send(commandOf('deleteDirectory', dir, at, null));
      return;
    }
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
      if (!tree.file(rel)) held = undefined;
    } else held = heldOf(rel, full, 'file'); // a change: the new stat (a file never seen is made by it)
    // On a relay only a kept row is sent, and only a held row is deleted; on a node every path is, as before.
    const sendable = op === 'deleteFile' || op === 'deleteDirectory' ? held !== undefined : kept(rel, held, homeAt);
    if (!sendable && !spirit.IS_RELAY) return;
    if (sendable) send(commandOf(op, rel, new Date().toISOString(), held));
    // A FOLDER'S FLAGS FOLLOW ITS FILES (goal/G49.1): a file made or gone inside a folder works the folder's flags out
    // again, and its parent's (client/script.js is a level down); a changed file changes no flag of its own folder's.
    const cut = rel.lastIndexOf('/');
    const dir = cut > 0 ? rel.slice(0, cut) : '';
    if (dir && op !== 'changeFile') {
      reflag(dir);
      const up = dir.lastIndexOf('/');
      if (up > 0) reflag(dir.slice(0, up));
    }
    // A NEW-STYLE APP'S manifest.json CHANGED (goal/G49.20, box v31): its validity is the app mark, so a change to its text
    // works its folder's flags out again, as a file made or gone does.
    if (dir && op === 'changeFile' && /\/manifest\.json$/.test(rel)) reflag(dir);
    // AN APP SWITCHED ON OR OFF (goal/G49.15): its node.json in its state folder made, changed or gone turns that app's
    // live. Which app: the app folder whose spirit.statePath is that folder (goal/G49.17), found among the tree's apps.
    if (/^spirit\/state\/app\/[^/]+\/node\.json$/.test(rel) && op !== 'createDirectory' && op !== 'deleteDirectory') {
      const home = rel.slice(0, rel.lastIndexOf('/'));
      Object.keys(tree.files()).forEach(function (p) {
        if (/^spirit\/app\/[^/]+$/.test(p) && tree.file(p).kind === 'folder' && spirit.statePath(p) === home) reflag(p);
      });
    }
    // AN APP'S <name>.json CHANGED, MADE OR GONE: whether its files are core may have changed with it (coreFiles.js reads
    // its identity.intrinsic), so its files' flags are worked out again, and each one that turned is sent as a change.
    // The manifest is <dir>/<the folder's own name>.json, for any app folder (goal/G49.19); its folder read off its own path.
    const app = /^(.+\/([^/]+))\/([^/]+)\.json$/.exec(rel);
    if (app && app[2] === app[3] && op !== 'createDirectory' && op !== 'deleteDirectory') {
      const under = app[1] + '/';
      const files = tree.files();
      Object.keys(files).forEach(function (p) {
        const h = files[p];
        if (h.kind !== 'file' || p.indexOf(under) !== 0 || p === rel) return;
        const core = spirit.requireScript('spirit/fs/coreFiles/script.js').isCore('spirit/run/' + p, path.resolve(RUN_ROOT, '..', '..'));
        if (core === (h.core === true)) return;
        send(commandOf('changeFile', p, new Date().toISOString(), Object.assign({}, h, { core: core })));
      });
    }
  });

  // A FILE ALREADY GONE IS NO FAILURE (goal/G49.19; Andy: "cw, go" to "an error about a file that is already gone, EPERM,
  // ENOENT or EBUSY on a path no longer there, is no failure; the watcher goes on, and only a real error fails the job"):
  // on Windows a file made and deleted within moments, such as SQLite's testicle.db-journal, can answer the watch with an
  // EPERM, and that one error had stopped the whole file cache's feed.
  const GONE_CODES = ['EPERM', 'ENOENT', 'EBUSY'];
  watcher.on('error', function (err) {
    if (err && GONE_CODES.indexOf(err.code) !== -1 && err.path && !fs.existsSync(err.path)) return;
    // 'failed', not 'error': only a terminal status can be deleted, and a watcher that died left a row in Jobs that
    // deleteJob refused forever, with no way to clear it short of restarting the server.
    if (jobs) jobs.updateJob(job.id, { status: 'failed', logMessage: String(err) });
    else console.error('the fs cache\'s watcher failed: ' + String(err));
  });

  job._stop = function () {
    watcher.close();
    if (fsWatching === own) fsWatching = null;
  };

  return job;
}

// THE spirit.fs BRANCH'S NODE WORK (goal/G49.25, Q5; Andy: "WHY THE FUCK WOULD IT NOT???" to "Does a branch's node work live at
// spirit/<branch>/server/script.js, handing its verbs' answers to the scan"): verbs(node) -> { <verb>: { reply, handler } }, the
// answers the node server held until this item, moved whole. serveCommon's scan mounts them under spirit.fs, each call checked by
// spirit/fs/script.js first. node is what the node server hands every branch (spirit/server/script.js, branchNode). A relay
// answers none of them here: its file verbs are its processor's.
//
// THE GATE IS NOT IN HERE, and that is the point of this branch. Every one of these goes through fileSystem.js, which asks
// fileWritable or fileServable about the path.
function verbs(node) {
  if (spirit.IS_RELAY) return {};
  const readJsonBody = node.readJsonBody;
  const bodyRefused = node.bodyRefused;
  function writeFsResult(res, result) {
    if (result.ok) {
      res.writeHead(204);
      res.end();
      return;
    }
    if (result.reason === 'forbidden') {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }
    if (result.reason === 'file-not-found') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    // A path the file system will not take (goal/G41.30): the caller's, so a 400.
    if (result.reason === 'bad-path') {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad request: the file system refused this path');
      return;
    }
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal error');
  }
  // fs.save AND fs.load HAVE NO SIZE LIMIT (goal/G33.10, Andy: "i want fs to be hard-coded owner only, with no size
  // limits on it's loadFile and saveFile...."). The owner's alone (apiDoor, apiAuth), so the packet's bound is not theirs.
  const FS_UNBOUNDED = { max: Infinity };
  return {
    // The node's files by path (puppets/G2). spirit.fs.stat stays the "get".
    'search': { reply: node.LIST, handler: node.proxyVerb(function (b) { return node.nodeSearches.fsSearch(b); }) },
    'stat': { reply: { size: 0, mtimeMs: 0, birthtimeMs: 0 }, handler: function (req, res) {
      return readJsonBody(req).then(function (body) {
        const stats = fileSystem.statFile(String((body && body.path) || ''));
        if (!stats) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(stats));
      }).catch(function (e) { bodyRefused(req, res, e); });
    } },
    // THE READ AS A VERB (goal/G14.8): a file's text by path, through loadFile, so fileServable decides as it does for the
    // static route; 404 by name when there is none. Andy, 2026-10-10: "i'm more inclined to deny URL fetch, and allow
    // loadFile, it's much narrower."
    'load': { reply: { path: '', text: '' }, handler: function (req, res) {
      return readJsonBody(req, FS_UNBOUNDED).then(function (body) {
        const filePath = String((body && body.path) || '');
        const text = fileSystem.loadFile(filePath);
        if (text === null) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ path: filePath, text: text }));
      }).catch(function (e) { bodyRefused(req, res, e); });
    } },
    // No annotations and no annotate: ANNOTATIONS ARE THE NODE'S ONLY (goal/G43.20). The two writes answer 204, no body.
    'save': { reply: {}, handler: function (req, res) {
      readJsonBody(req, FS_UNBOUNDED).then(function (body) {
        writeFsResult(res, fileSystem.saveFile(body.path, body.content));
      }).catch(function (e) { bodyRefused(req, res, e); });
    } },
    'delete': { reply: {}, handler: function (req, res) {
      readJsonBody(req).then(function (body) {
        writeFsResult(res, fileSystem.deleteFile(body.path));
      }).catch(function (e) { bodyRefused(req, res, e); });
    } },
    // LOCAL: this node's own disk.
  };
}

module.exports = { start: start, verbs: verbs };
