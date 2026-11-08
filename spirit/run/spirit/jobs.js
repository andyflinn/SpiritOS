'use strict';

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
// The node's file system: the files of the run folder and what may be served or written (goal/G40.6).
const fileSystem = require('./fileSystem');
const { EventEmitter } = require('events');
const { monitorEventLoopDelay } = require('perf_hooks');

const MAX_LOG_ENTRIES = 200;
const DEFAULT_STATS_INTERVAL_MS = 2000;

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled', 'stopped']);

function formatDuration(ms) {
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return hours + 'h ' + minutes + 'm ' + seconds + 's';
  if (minutes > 0) return minutes + 'm ' + seconds + 's';
  return seconds + 's';
}

// ITS OWN STATE, ON NO KERNEL (goal/G40.6). Andy, 2026-10-25: "let jobs.js take care of its own shit." The server's
// statistics and the job functions are this module's; the node server gets the functions back from this call.
module.exports = function installJobs(port) {
  const scanFolder = fileSystem.scanFolder;
  const serverStats = {};

  const jobsMap = new Map();
  const events = new EventEmitter();
  // Every stream subscriber (the events family's subscribe, events/events.js) attaches two
  // listeners here — job-updated and job-deleted — and detaches them when
  // the client goes away. Node's default ceiling of 10 therefore starts
  // printing MaxListenersExceededWarning at the sixth open tab, which
  // reads like a leak and isn't one. There is no fixed upper bound worth
  // guessing at, so remove the ceiling rather than raise it.
  events.setMaxListeners(0);
  let nextId = 1;

  // `module`: the module this job is an instance of (slim/G1.5), its path,
  // 'process/js/<name>'. Absent on the node's own jobs, which are no module's.
  function createJob(kind, type, initialData, module) {
    const id = 'job_' + (nextId++);
    const now = Date.now();
    const job = {
      id: id,
      kind: kind,
      type: type,
      status: kind === 'permanent' ? 'running' : 'pending',
      createdAt: now,
      updatedAt: now,
      log: [{ timestamp: now, message: 'job created' }],
      data: initialData || {},
    };
    if (module) job.module = module;
    jobsMap.set(id, job);
    events.emit('job-updated', job);
    return job;
  }

  function appendLog(job, message) {
    job.log.push({ timestamp: Date.now(), message: message });
    if (job.log.length > MAX_LOG_ENTRIES) {
      job.log.splice(0, job.log.length - MAX_LOG_ENTRIES);
    }
  }

  function updateJob(id, patch) {
    const job = jobsMap.get(id);
    if (!job) return null;
    if (TERMINAL_STATUSES.has(job.status)) return null;

    patch = patch || {};

    // NOTHING OVERSIZED ENTERS A PAGE'S STREAM (Andy: "the shared layer MUST instantly reject a payload, when the
    // json exceeds the maximum size"). A server's published object over PAYLOAD_MAX is refused whole: the job keeps
    // what it had, and no job-updated is emitted.
    if (patch.app && typeof patch.app === 'object' && Buffer.byteLength(JSON.stringify(patch.app), 'utf8') > require('./limits').PAYLOAD_MAX) return null;

    if (patch.status) {
      job.status = patch.status;
    }

    if (patch.data) {
      Object.assign(job.data, patch.data);
      if (typeof patch.data.debug === 'boolean') keepDebug(job, patch.data.debug);
    }

    if (typeof patch.logMessage === 'string') {
      appendLog(job, patch.logMessage);
    }

    if (patch.app && typeof patch.app === 'object' && !Array.isArray(patch.app)) {
      job.app = patch.app;
    }

    job.updatedAt = Date.now();

    // The server's own record of completion, independent of whatever the job
    // itself logged — covers every path to a terminal state uniformly
    // (explicit complete()/fail() calls, the child-exit-code fallback for
    // scripts that never report their own status, and cancellation), so a
    // performance figure is always present regardless of how the job ended.
    if (patch.status && TERMINAL_STATUSES.has(patch.status)) {
      const durationMs = job.updatedAt - job.createdAt;
      appendLog(job, 'Job ' + job.status + ' at ' + new Date(job.updatedAt).toLocaleString() +
        ', running for ' + formatDuration(durationMs));
    }

    events.emit('job-updated', job);

    // TRANSIENT JOBS REMOVE THEMSELVES (goal/G29.16; Andy, 2026-10-18: "it shouldn't be opt-in per caller. it should be
    // automatic, and failed jobs remain automatically", and on a cancelled one: "i support the idea that jobs cancelled
    // by me are also removed automatically"). A process job that completes, by its exit or by its own word, or that the
    // owner cancels, is deleted once its last update has gone out; a failed one stays until the node restarts, for
    // what it can tell. Servers and the node's own jobs are not transient and stay.
    if (job.kind === 'process' && (job.status === 'completed' || job.status === 'cancelled')) deleteJob(id);
    return job;
  }

  function getJob(id) {
    return jobsMap.get(id) || null;
  }

  function listJobs() {
    return Array.from(jobsMap.values());
  }

  function cancelJob(id) {
    const job = jobsMap.get(id);
    if (!job) return null;
    if (TERMINAL_STATUSES.has(job.status)) return job;
    if (typeof job._stop === 'function') job._stop();
    const nextStatus = job.kind === 'permanent' ? 'stopped' : 'cancelled';
    return updateJob(id, { status: nextStatus, logMessage: 'cancelled' });
  }

  function deleteJob(id) {
    const job = jobsMap.get(id);
    if (!job) return false;
    if (!TERMINAL_STATUSES.has(job.status)) return false; // must be cancelled/completed/failed/stopped first
    jobsMap.delete(id);
    events.emit('job-deleted', id);
    return true;
  }

  function mapEntry(entry, rootDir) {
    const full = path.join(entry.parentPath, entry.name);
    return {
      name: entry.name,
      parentPath: entry.parentPath,
      fullPath: full,
      relativePath: path.relative(rootDir, full).replace(/\\/g, '/'),
      kind: entry.isDirectory() ? 'folder' : 'file',
    };
  }

  // ── THE FILE WATCHER ON CHOKIDAR, STREAMING TREE COMMANDS (goal/G4.25) ──
  //
  //   Andy, 2026-10-02: "the current design is horrid. for lazy load the stream can send createDirectory run /
  //   createDirectory media / createFile index.html etc... just send \"commands up the stream to modify the tree.\"",
  //   "so that s our replacement then. quick and free and maintained by others....", "forget about batching"; and
  //   2026-10-04, "local copy it is" (chokidar, now under spirit/jobs/chokidar/, goal/G43.25). His grant G1 on this file.
  //
  // The watcher keeps the tree (path -> {kind, size, modified}) and sends what changed, one command per job-updated:
  // data.command {op, path, at}, op createDirectory, createFile, changeFile, deleteFile or deleteDirectory, path
  // relative to the watched root. The whole list never travels again: a page that connects gets the tree as create
  // commands from fsTreeCommands (events/events.js, faceHome.js). The tree is seeded from scanFolder, so it skips what that skips
  // (fileSystem.js's vendored folders, .git, anything fileServable refuses, relay-state among them); chokidar is asked to ignore the same,
  // and reports at startup what the seed already holds, which sends nothing.
  const FS_OPS = { add: 'createFile', addDir: 'createDirectory', change: 'changeFile', unlink: 'deleteFile', unlinkDir: 'deleteDirectory' };
  const RUN_ROOT = path.join(__dirname, '..');
  let fsTree = null; // the tree of the latest watcher this module started: Map relativePath -> {kind, size, modified}

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
  function commandOf(op, p, at, held) {
    const c = { op: op, path: p, at: at };
    if (held && held.size !== undefined) c.size = held.size;
    if (held && held.modified !== undefined) c.modified = held.modified;
    if (held && held.kind === 'file' && require('./coreFiles').isCore('spirit/run/' + p, path.resolve(RUN_ROOT, '..', '..'))) c.core = true;
    return c;
  }

  function fsTreeCommands() {
    if (!fsTree) return [];
    const at = new Date().toISOString();
    // A folder sorts before everything inside it: its path is a prefix of theirs.
    return Array.from(fsTree.keys()).sort().map(function (p) {
      const held = fsTree.get(p);
      return commandOf(held.kind === 'folder' ? 'createDirectory' : 'createFile', p, at, held);
    });
  }
  // The tree as entries {name, relativePath, kind}, for the counts and fs.search, which read it in place.
  function fsTreeEntries() {
    if (!fsTree) return [];
    return Array.from(fsTree.keys()).sort().map(function (p) {
      return { name: p.slice(p.lastIndexOf('/') + 1), relativePath: p, kind: fsTree.get(p).kind };
    });
  }

  function startFsWatcherJob(rootDir) {
    const tree = new Map();
    scanFolder(rootDir).forEach(function (entry) { const m = mapEntry(entry, rootDir); tree.set(m.relativePath, statOf(m.fullPath, m.kind)); });
    fsTree = tree;
    const job = createJob('permanent', 'fs-watcher', {});
    // AN APP'S FACE PART, STREAMED (goal/G41.1, box v15: "the node streams an app's face part whenever its sidecar
    // changes, and every app installer button listens to it"): one job, its data the app's script and its face part as
    // the sidecar now holds it ({} once the sidecar is gone).
    const faces = createJob('permanent', 'app-face', {});
    const publishFace = function (rel, full, op) {
      let side = null;
      if (op !== 'deleteFile') { try { side = JSON.parse(fs.readFileSync(full, 'utf8')); } catch (e) { side = null; } }
      const script = scriptOfSidecar(rel);
      const face = Object.assign({}, (side && side.face && typeof side.face === 'object') ? side.face : {}, { intrinsic: require('./coreFiles').intrinsic(script) });
      updateJob(faces.id, { data: { path: script, face: face } });
    };
    const relOf = function (full) { return path.relative(rootDir, full).split(path.sep).join('/'); };
    const ignored = function (full) {
      const rel = path.relative(RUN_ROOT, path.resolve(full)).split(path.sep).join('/');
      if (!rel || rel.indexOf('..') === 0) return false;
      if (rel.split('/').some(function (part) { return part === '.git'; }) || fileSystem.VENDORED_FOLDERS.holds(rel)) return true;
      // A NODE'S OWN SIDECARS ARE HEARD (goal/G41.1): the folders of the node's state down to them, and the sidecars,
      // never served and kept out of the tree.
      if (APP_SIDECAR.test(rel) || STATE_DIR.test(rel)) return false;
      return !fileSystem.fileServable(rel);
    };
    const watcher = require('./jobs/chokidar/index.js').watch(rootDir, { ignored: ignored, ignoreInitial: false, persistent: true });
    watcher.on('all', function (event, full) {
      const op = FS_OPS[event];
      const rel = full ? relOf(full) : '';
      if (!op || !rel || rel.indexOf('..') === 0) return;
      if (APP_SIDECAR.test(rel)) { publishFace(rel, full, op); if (SIDECAR.test(rel)) followHome(rootDir, rel); return; }
      if (STATE_DIR.test(rel) && !fileSystem.fileServable(rel)) return;
      if (op === 'createFile' || op === 'createDirectory') {
        const kind = op === 'createDirectory' ? 'folder' : 'file';
        if (tree.has(rel) && tree.get(rel).kind === kind) return; // already held: the startup report, or a repeat
        tree.set(rel, statOf(full, kind));
      } else if (op === 'deleteFile') {
        if (!tree.has(rel)) return;
        tree.delete(rel);
      } else if (op === 'deleteDirectory') {
        if (!tree.has(rel)) return;
        Array.from(tree.keys()).forEach(function (p) { if (p === rel || p.indexOf(rel + '/') === 0) tree.delete(p); });
      } else tree.set(rel, statOf(full, 'file')); // a change: the new stat (a file never seen is made by it)
      const held = op === 'deleteFile' || op === 'deleteDirectory' ? null : tree.get(rel);
      updateJob(job.id, { data: { command: commandOf(op, rel, new Date().toISOString(), held) } });
    });

    watcher.on('error', function(err) {
      // 'failed', not 'error': only TERMINAL_STATUSES can be deleted, and
      // 'error' was in neither that set nor anything the UI renders — a
      // watcher that died left a row in Jobs that deleteJob refused
      // forever, with no way to clear it short of restarting the server.
      updateJob(job.id, { status: 'failed', logMessage: String(err) });
    });

    job._stop = function() {
      watcher.close();
      cancelJob(faces.id);
      if (fsTree === tree) fsTree = null;
    };

    return job;
  }

  // THE ONE LAUNCHER (desk/G2.2). Andy: "if a server is a process, it should
  // get the perks of a process, that's no stretch." and "can those not
  // collapse into one interface, that can't drift?" Every process, one-shot
  // or server, is spawned here and nowhere else, with the same contract.
  function launch(job, command, args, cwd) {
    const child = child_process.spawn(command, args || [], {
      cwd: cwd,
      env: Object.assign({}, process.env, {
        SPIRIT_JOB_ID: job.id,
        // THE ONE DOOR, and the id travels beside the verb rather than
        // baked into the path — spirit.js's spirit.jobs reads SPIRIT_JOB_ID,
        // and a process that needs the node's port reads this URL.
        SPIRIT_CALLBACK_URL: 'http://localhost:' + port + '/api/spirit',
      }),
      // The IPC channel closes when this node dies however it dies, and a
      // server's appServer.serve ends its process then: no orphan ("who wants
      // dangeling processes"). (kernel.js did it for every process; no node
      // process loads kernel.js any more.)
      // ITS CONSOLE GOES TO NULL AT THE SOURCE (goal/G41.33, the box: "Console output goes to null by default, at the source,
      // for every process, except node and relay. Only DEBUG turns it on. A crash is no exception"). Read as it starts, so a
      // process started with DEBUG off stays silent until it is started again. Its published lines and exit code stay.
      stdio: require('./spirit.js').debug() ? ['ignore', 'pipe', 'pipe', 'ipc'] : ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    [child.stdout, child.stderr].forEach(function (stream) {
      if (!stream) return;
      stream.setEncoding('utf8');
      stream.on('data', function (text) {
        String(text).split(/\r?\n/).forEach(function (line) { if (line) appendLog(job, line); });
      });
    });
    updateJob(job.id, { status: 'running', data: { pid: child.pid } });
    return child;
  }

  function startProcessJob(command, args, options) {
    options = options || {};
    const job = createJob('process', options.type || command, {
      command: command,
      args: args || [],
      progress: 0,
      exitCode: null,
    }, moduleOf((args || [])[0], options.cwd));

    const child = launch(job, command, args, options.cwd);

    job._stop = function() {
      child.kill();
    };

    child.on('exit', function(code) {
      const current = getJob(job.id);
      if (current && !TERMINAL_STATUSES.has(current.status)) {
        updateJob(job.id, {
          status: code === 0 ? 'completed' : 'failed',
          data: { exitCode: code },
          logMessage: 'process exited with code ' + code,
        });
        // A clean exit is removed by updateJob itself, a failed one stays (goal/G29.16, which made goal/G4.34's
        // per-caller opt-in the rule for every transient job).
      }
    });

    child.on('error', function(err) {
      updateJob(job.id, { status: 'failed', data: { error: String(err) } });
    });

    return job;
  }

  // ── THE THIRD KIND: A PROCESS THE NODE KEEPS RUNNING ─────────────────
  //
  // public-app-server/G17, the last leg. Andy: "i expect them to run in the
  // SpiritOS-proccess subsystem". 'permanent' lives inside the node and
  // 'process' runs and ends; a 'server' is spawned like a process and
  // started again when it exits, so a visitor never has to be the one who
  // notices it died. The wait doubles from RESTART_MIN_MS to RESTART_MAX_MS
  // while it keeps dying, and starts over once a run lasted a minute.
  //
  // Started by the node itself at boot (startNodeServers, below), never through the
  // jobs.create verb: the loopback door gains nothing (Andy, 2026-09-27).
  // cancelJob stops it for good.
  const RESTART_MIN_MS = 1000;
  const RESTART_MAX_MS = 60000;
  const STEADY_MS = 60000;
  function startServerJob(command, args, options) {
    options = options || {};
    // WHO OPERATES IT (processes/G1.3). Andy: 'node' is started with the
    // node and comes back when it exits; 'user' is started from Processes,
    // ended with Cancel, and "a manually started/stopped server has already
    // a restart method", so it does not come back by itself.
    const operated = options.operated === 'user' ? 'user' : 'node';
    const restart = operated === 'node';
    // Its module is read off its script's path. (options.module, which only
    // appClient.startAll ever passed, left with it: goal/G19.10.)
    const job = createJob('server', options.type || command, {
      command: command,
      args: args || [],
      operated: operated,
      restarts: 0,
      exitCode: null,
    }, moduleOf((args || [])[0], options.cwd));
    let child = null;
    let stopped = false;
    let wait = RESTART_MIN_MS;
    let timer = null;

    function run() {
      timer = null;
      if (stopped) return;
      const startedAt = Date.now();
      try {
        child = launch(job, command, args, options.cwd);
      } catch (e) {
        updateJob(job.id, { status: 'failed', data: { error: String(e) } });
        return;
      }
      child.on('error', function (err) { appendLog(job, 'could not start: ' + String(err)); });
      child.on('exit', function (code) {
        child = null;
        if (stopped) return;
        // A user-operated server that ends by itself stays ended: completed
        // on a clean exit, failed otherwise, and you start it again.
        if (!restart) {
          stopped = true;
          updateJob(job.id, { status: code === 0 ? 'completed' : 'failed', data: { exitCode: code },
            logMessage: 'exited with code ' + code });
          return;
        }
        if (Date.now() - startedAt >= STEADY_MS) wait = RESTART_MIN_MS;
        const current = getJob(job.id);
        updateJob(job.id, {
          // 'pending', not a new status: a job in a status that is neither
          // live nor terminal could never be deleted (jobsLifecycle.js).
          status: 'pending',
          data: { exitCode: code, restarts: ((current && current.data.restarts) || 0) + 1 },
          logMessage: 'exited with code ' + code + ', starting again in ' + Math.round(wait / 1000) + 's',
        });
        timer = setTimeout(run, wait);
        wait = Math.min(wait * 2, RESTART_MAX_MS);
      });
    }

    job._stop = function () {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (child) child.kill();
    };
    run();
    return job;
  }

  // ── WHAT jobs.create STARTS (processes/G1.3) ──────────────────────────
  //
  //   Andy's yes on the verb: "YES it's the only existing user door to
  //   server launch, so we use it." The request is the same as ever
  //   (command, args, type); the script's own manifest decides. 'kind':
  //   'server' with 'operated': 'user' starts a user-operated server job;
  //   anything else is the one-shot process it always was.
  function manifestOf(script, cwd) {
    if (typeof script !== 'string' || !/\.js$/.test(script)) return null;
    const file = path.resolve(cwd || process.cwd(), script).replace(/\.js$/, '.json');
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
  }
  // ── A SERVER RUNS AT HOME BY ITS OWN SIDECAR (goal/G41.1, box v13) ──────
  //
  // Andy: "that clash comes from unauthorized decisions from agents to move the FUCKING manifest shit to a central
  // list", and the box: "a server's home switch is home: true in its own sidecar, beside its .js
  // (process/js/<name>/<name>.js.sidecar.json), the only place" (since box v16 that sidecar sits in the node's state,
  // below). A script under <root>/process/js/<name>/ belongs to the
  // process <name>, and runs only if the face part of its sidecar says home: true (or its manifest says intrinsic): a
  // process that does not never runs, so Jobs never shows it. Refused by name, process-not-included, before anything is
  // spawned. No central list says it: spirit/state/node.json's servers section, and the manifest's runs, are gone.
  function runsHome(root, name) {
    try {
      JSON.parse(fs.readFileSync(path.join(root, 'process', 'js', name, name + '.json'), 'utf8'));
    } catch (e) { return false; }
    // AN INTRINSIC SERVER ALWAYS RUNS, by the coded list (goal/G41.1, box v17); any other by the node's own sidecar, in
    // its state folder (box v16): relay-state/process/<name>/<name>.js.sidecar.json.
    if (require('./coreFiles').intrinsic('process/js/' + name)) return true;
    let side = null;
    try { side = JSON.parse(fs.readFileSync(path.join(root, 'relay-state', 'process', name, name + '.js.sidecar.json'), 'utf8')); } catch (e) { side = null; }
    return !!(side && side.face && side.face.home === true);
  }
  // AN APP OF THE NEW NAMESPACE (goal/G43.12). Andy: "active is exactly that: "running"", and "that's how the node knows, at
  // re-boot time, which servers it must autostart." active in spirit/state/<name>/node.json is the one switch, for its server
  // and for every script of its folder. node.mount in spirit/app/<name>/<name>.json says it has a server at all; the old kind
  // and operated stay with process/js.
  function appActive(root, name) {
    // An intrinsic app is always active (goal/G43.14): its <name>.json says so, and node.json is not asked.
    if (require('./coreFiles').appIntrinsic(path.resolve(root, '..', '..'), name) === true) return true;
    try { return JSON.parse(fs.readFileSync(path.join(root, 'spirit', 'state', name, 'node.json'), 'utf8')).active === true; } catch (e) { return false; }
  }
  // AN APP THAT IS RUN, NOT MOUNTED (goal/G43.21; Andy, the box: "the Andy user on each box will run those scripts when he feels
  // like it"): node.run in its <name>.json. It has nothing to activate, so a start of it is not refused for being inactive.
  function appRuns(root, name) {
    try { const own = JSON.parse(fs.readFileSync(path.join(root, 'spirit', 'app', name, name + '.json'), 'utf8')); return !!(own && own.node && own.node.run === true); } catch (e) { return false; }
  }
  function appServes(root, name) {
    let own = null;
    try { own = JSON.parse(fs.readFileSync(path.join(root, 'spirit', 'app', name, name + '.json'), 'utf8')); } catch (e) { return false; }
    return !!(own && own.node && own.node.mount === true) && appActive(root, name);
  }
  // A script under <root>/process/js/<name>/ or <root>/spirit/app/<name>/, read as {root, name}, the second with app: true; null
  // for anything else. The one reading of a script's path, for where it runs and for the module a job is an instance of
  // (slim/G1.5). THE SECOND PLACE IS FOR THE MIGRATION (goal/G43.12, Q3; Andy: "it widens until all processes are migrated, then
  // it tightens back to the new side...").
  function processOf(script, cwd) {
    if (typeof script !== 'string' || !/\.js$/.test(script)) return null;
    const abs = path.resolve(cwd || process.cwd(), script);
    const m = /^(.*)[\/\\]process[\/\\]js[\/\\]([^\/\\]+)[\/\\][^\/\\]+\.js$/.exec(abs);
    if (m) return { root: m[1], name: m[2] };
    const a = /^(.*)[\/\\]spirit[\/\\]app[\/\\]([^\/\\]+)[\/\\][^\/\\]+\.js$/.exec(abs);
    return a ? { root: a[1], name: a[2], app: true } : null;
  }
  // THE NODE OWNS EVERY MODULE ID, BY PATH (slim/G1.5). Andy: "what we see in
  // jobs monitor are ID-instances". The id is the module's path.
  function moduleOf(script, cwd) {
    const p = processOf(script, cwd);
    // Andy: "the id of modules in the new framework is: "spirit.app.<name>" (goal/G43.12).
    if (p && p.app) return 'spirit.app.' + p.name;
    return p ? 'process/js/' + p.name : '';
  }
  function refuseUnlisted(script, cwd) {
    const p = processOf(script, cwd);
    if (!p || (p.app ? (appActive(p.root, p.name) || appRuns(p.root, p.name)) : runsHome(p.root, p.name))) return;
    const e = new Error('process not included on this node: ' + p.name);
    e.refusal = 'process-not-included';
    e.process = p.name;
    throw e;
  }
  // ONLY THIS NODE'S OWN PROCESSES START (goal/G41.30, the review's RH1: "refuse unless command is process.execPath and
  // args[0] resolves to an included process/js/<name>/<name>.js"; Andy, Q3: "yes."). This node's executable on a script in a
  // process folder of this node's own tree: <name>.js or a helper beside it, as the desk and deskClient start theirs. The
  // word node, all a page can say (the file viewer's Start Job), is that executable, and never whatever the path finds.
  function refuseOther(command, script, cwd) {
    const p = processOf(script, cwd);
    const own = (command === process.execPath || command === 'node') && !!p && path.relative(path.resolve(__dirname, '..'), p.root) === '';
    if (own) return;
    const e = new Error('only this node\'s own processes start');
    e.refusal = 'not-a-process';
    throw e;
  }
  function startJob(command, args, options) {
    options = options || {};
    refuseOther(command, (args || [])[0], options.cwd);
    refuseUnlisted((args || [])[0], options.cwd);
    command = process.execPath;
    const m = manifestOf((args || [])[0], options.cwd);
    if (m && m.kind === 'server' && m.operated === 'user') {
      return startServerJob(command, args, { type: options.type, cwd: options.cwd, operated: 'user' });
    }
    return startProcessJob(command, args, options);
  }

  // ── THE BOOT'S SCAN OF process/js (processes/G1.3) ────────────────────
  //
  // Every process whose manifest says 'kind': 'server', 'operated': 'node'
  // is started with the node, its arguments the manifest's defaults, and
  // kept running. User-operated ones are left for the user: a node restart
  // does not bring them back (Andy: "NO").
  // THE NODE NAMES ITS PIPE (desk/G1.6, appPair D15): each node-operated
  // server process starts with --pipe <the name the node chose>, and is
  // registered with `client` (appClient) so 'api' and calls reach it: a
  // process/js server (desk/G1 D11), and since goal/G43.12 an app of
  // spirit/app/ too, its door kind 'app'.
  // ONE SERVER STARTED, ITS JOB KEPT BY NAME (goal/G41.1): at boot for every server that runs at home, and again whenever
  // its sidecar is written to say so (followHome, below). The node it runs on is the one startNodeServers was handed.
  const nodeServers = new Map();   // name -> its server job
  let serverHost = null;            // { rootDir, client }, from startNodeServers
  function startNodeServer(rootDir, client, name) {
    const base = path.join(rootDir, 'process', 'js');
    const script = path.join(base, name, name + '.js');
    const m = manifestOf(script);
    if (!m || m.kind !== 'server' || m.operated !== 'node' || !fs.existsSync(script)) return null;
    // ITS ARGUMENTS ARE ITS MANIFEST'S DEFAULTS: no central list overrides them (goal/G41.1, box v13).
    const values = {};
    (m.args || []).forEach(function (a) { if (a && a.name) values[a.name] = a.default; });
    return runServer(rootDir, client, name, script, 'process', m.label || name, values);
  }
  // ONE APP'S SERVER (goal/G43.12): spirit/app/<name>/<name>.js, with no arguments.
  function startAppServer(rootDir, client, name) {
    const script = path.join(rootDir, 'spirit', 'app', name, name + '.js');
    if (!fs.existsSync(script)) return null;
    return runServer(rootDir, client, name, script, 'app', name, {});
  }
  function runServer(rootDir, client, name, script, kind, type, values) {
    const pipe = require('./appClient').pipePathFor(rootDir, name, process.platform, kind);
    // ITS STATE IS THE NODE'S TO NAME (desk/G1 D5): spirit/state/<name>/data/ (goal/G43.10),
    // handed over as --state, so a process never works out its own folder.
    const state = path.join(rootDir, 'spirit', 'state', name, 'data');
    try { fs.mkdirSync(state, { recursive: true }); } catch (e) { /* the server says why */ }
    if (process.platform !== 'win32') {
      try { fs.mkdirSync(path.dirname(pipe), { recursive: true }); } catch (e) { /* the server says why */ }
    }
    const args = [script, JSON.stringify(values), '--pipe', pipe, '--state', state].concat(nodeArgOf(rootDir));
    // AN APP'S DEBUG, KEPT BY THE NODE (goal/G43.15, Q2, Q3: "only the new ones."): handed over at every start, a restart after a
    // crash included, since the job starts again from this same list.
    if (kind === 'app') { args.push('--debug', String(appDebug(rootDir, name))); appArgs.set(name, args); }
    const job = startServerJob('node', args, { type: type, operated: 'node' });
    nodeServers.set(name, job);
    if (client && typeof client.register === 'function') client.register(name, pipe);
    return job;
  }
  // THE NODE'S PUBLIC FACTS, HANDED OVER (desk/G1.7): a server that needs
  // to know whose node it runs on gets --node {name, publicKey, ownerKey}.
  // It never opens identity.json, which holds the private keys; nothing
  // private is ever in a server's arguments.
  // The node's identity exists, named by the machine name at the least,
  // from relayAuth's first load (goal/G22.5), so --node is always handed
  // over.
  //
  // THE OWNER'S PUBLIC KEY RIDES ALONG (goal/G19.10). Andy, 2026-10-12:
  // "The appServer have a definite need/use for all 3: the node/puppets
  // key, the owners public key, and the nodes port: if they are not
  // allowed to read the files, they should have that stuff passted with
  // the spirit object that comes with the appServers passed interface."
  // ownerKey is owner.json's key as loadOwner reads it, or '' when the
  // node owns itself or nobody owns it: no owner to ask (puppetMode's
  // puppetIn rule, compared here against the key read above). spirit.js
  // puts them on spirit.node as it is required (the port from
  // spirit/state/environment.json).
  // Read as a server starts: a server learns a changed owner when the node
  // starts it again.
  function nodeArgOf(rootDir) {
    const me = require('./relayAuth').loadIdentity(rootDir);
    const owner = require('./relayAuth').loadOwner(rootDir, function () {});
    return ['--node', JSON.stringify({
      name: String(me.name || ''), publicKey: String(me.publicKey),
      ownerKey: owner && owner !== String(me.publicKey) ? owner : '',
    })];
  }
  function startNodeServers(rootDir, client) {
    const base = path.join(rootDir, 'process', 'js');
    let names = [];
    try { names = fs.readdirSync(base); } catch (e) { return []; }
    serverHost = { rootDir: rootDir, client: client };
    // ONLY WHAT RUNS AT HOME: its sidecar says so (goal/G41.1).
    let apps = [];
    try { apps = fs.readdirSync(path.join(rootDir, 'spirit', 'app')); } catch (e) { apps = []; }
    return names.filter(function (name) { return runsHome(rootDir, name); })
      .map(function (name) { return startNodeServer(rootDir, client, name); })
      .concat(apps.filter(function (name) { return appServes(rootDir, name); }).map(function (name) { return startAppServer(rootDir, client, name); }))
      .filter(Boolean);
  }
  // A SIDECAR WRITTEN STARTS OR STOPS ITS SERVER (goal/G41.1, box v13: "the node starts or stops the server when that
  // sidecar changes"): heard by the fs watcher, on the node startNodeServers was handed.
  // A NODE'S OWN SIDECARS, in its state (goal/G41.1, box v16): a server's, a shell app's or either's, and the folders down
  // to them; the app's script is the mirror's path back.
  const SIDECAR = /^relay-state\/process\/([^/]+)\/\1\.js\.sidecar\.json$/;
  const APP_SIDECAR = /^relay-state\/(shell|process)\/([^/]+)\/\2\.js\.sidecar\.json$/;
  const STATE_DIR = /^relay-state(\/(shell|process)(\/[^/]+)?)?$/;
  function scriptOfSidecar(rel) {
    const m = APP_SIDECAR.exec(rel);
    return m ? (m[1] === 'shell' ? 'shell/' : 'process/js/') + m[2] + '/' + m[2] + '.js' : '';
  }
  function followHome(rootDir, rel) {
    const m = SIDECAR.exec(rel);
    if (!m || !serverHost || path.resolve(serverHost.rootDir) !== path.resolve(rootDir)) return;
    const name = m[1];
    const job = nodeServers.get(name);
    const now = job && getJob(job.id);
    const live = !!now && !TERMINAL_STATUSES.has(now.status);
    const want = runsHome(rootDir, name);
    if (want && !live) startNodeServer(rootDir, serverHost.client, name);
    else if (!want && live) { cancelJob(job.id); nodeServers.delete(name); }
  }
  // active WRITTEN STARTS OR STOPS ITS SERVER (goal/G43.12, Q4: "exactly.", "that's why sidecars will go out-of style."): told
  // by the app family as it writes node.json. Its name stays in the table, as a stopped process/js server's does.
  // DEBUG KEPT FOR AN APP OF spirit/app/ (goal/G43.15): what its server reports on its job is written into its node.json, and
  // handed back at its next start. The server never writes the node's file; an old process/js server keeps nothing (Q3).
  const appArgs = new Map();     // name -> the argument list its server job starts from
  function appDebug(root, name) {
    try { return JSON.parse(fs.readFileSync(path.join(root, 'spirit', 'state', name, 'node.json'), 'utf8')).debug === true; } catch (e) { return false; }
  }
  function keepDebug(job, on) {
    const m = /^spirit\.app\.([^/]+)$/.exec(String(job.module || ''));
    if (!m || job.kind !== 'server' || !serverHost) return;
    const file = path.join(serverHost.rootDir, 'spirit', 'state', m[1], 'node.json');
    let state = {};
    try { state = JSON.parse(fs.readFileSync(file, 'utf8')) || {}; } catch (e) { state = {}; }
    if (state.debug === on) return;
    state.debug = on;
    try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(state, null, 2) + '\n'); } catch (e) { /* kept next time */ }
    const args = appArgs.get(m[1]);
    const at = args ? args.indexOf('--debug') : -1;
    if (at !== -1) args[at + 1] = String(on);
  }
  function followApp(rootDir, name) {
    if (!serverHost || path.resolve(serverHost.rootDir) !== path.resolve(rootDir)) return;
    const job = nodeServers.get(name);
    const now = job && getJob(job.id);
    const live = !!now && !TERMINAL_STATUSES.has(now.status);
    const want = appServes(rootDir, name);
    if (want && !live) startAppServer(rootDir, serverHost.client, name);
    else if (!want && live) { cancelJob(job.id); nodeServers.delete(name); }
  }

  function startStatsJob(options) {
    options = options || {};
    const intervalMs = options.intervalMs || DEFAULT_STATS_INTERVAL_MS;
    const requestCounters = options.requestCounters || { total: 0, byMethod: {}, byStatusClass: {} };

    const job = createJob('permanent', 'server-stats', serverStats);
    // job.data === serverStats from here on (createJob assigns the reference as-is)

    const histogram = monitorEventLoopDelay({ resolution: 10 });
    histogram.enable();
    let lastCpuUsage = process.cpuUsage();
    let lastTickTime = Date.now();

    function tick() {
      const now = Date.now();
      const elapsedMs = now - lastTickTime;
      const cpuDelta = process.cpuUsage(lastCpuUsage);
      lastCpuUsage = process.cpuUsage();
      lastTickTime = now;

      const jobCounts = { total: 0, byStatus: {} };
      listJobs().forEach(function(j) {
        jobCounts.total++;
        jobCounts.byStatus[j.status] = (jobCounts.byStatus[j.status] || 0) + 1;
      });

      // Derived from the watcher's tree, already in memory (goal/G4.25) —
      // no extra filesystem I/O, just tallying what it already holds.
      const filesystem = { files: 0, folders: 0, byMimeType: {} };
      {
        fsTreeEntries().forEach(function(entry) {
          if (entry.kind === 'folder') {
            filesystem.folders++;
          } else {
            filesystem.files++;
            const ext = path.extname(entry.name).toLowerCase();
            const mimeType = require('./spirit.js').MIME_TYPES[ext] || 'application/octet-stream';
            filesystem.byMimeType[mimeType] = (filesystem.byMimeType[mimeType] || 0) + 1;
          }
        });
      }

      updateJob(job.id, {
        data: {
          timestamp: now,
          memory: process.memoryUsage(),
          eventLoop: {
            meanMs: histogram.mean / 1e6,
            maxMs: histogram.max / 1e6,
            p99Ms: histogram.percentile(99) / 1e6,
          },
          cpu: { percent: elapsedMs > 0 ? (cpuDelta.user + cpuDelta.system) / 1000 / elapsedMs * 100 : 0 },
          uptimeSeconds: process.uptime(),
          requests: requestCounters,
          jobs: jobCounts,
          filesystem: filesystem,
          sseConnections: events.listenerCount('job-updated'),
        },
      });
      histogram.reset();
    }

    tick(); // populate immediately rather than leaving data empty for the first intervalMs
    const timer = setInterval(tick, intervalMs);

    job._stop = function() {
      clearInterval(timer);
      histogram.disable();
    };

    return job;
  }

  return {
    events: events,
    createJob: createJob,
    updateJob: updateJob,
    getJob: getJob,
    listJobs: listJobs,
    cancelJob: cancelJob,
    deleteJob: deleteJob,
    startFsWatcherJob: startFsWatcherJob,
    fsTreeCommands: fsTreeCommands,
    fsTreeEntries: fsTreeEntries,
    startProcessJob: startProcessJob,
    startServerJob: startServerJob,
    followApp: followApp,
    startJob: startJob,
    startNodeServers: startNodeServers,
    startStatsJob: startStatsJob,
  };
};
