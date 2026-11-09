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

  const jobsMap = new Map();
  const events = new EventEmitter();
  // Every stream subscriber (the events family's subscribe, events/events.js) attaches two
  // listeners here — job-updated and job-deleted — and detaches them when
  // the client goes away. Node's default ceiling of 10 therefore starts
  // printing MaxListenersExceededWarning at the sixth open tab, which
  // reads like a leak and isn't one. There is no fixed upper bound worth
  // guessing at, so remove the ceiling rather than raise it.
  events.setMaxListeners(0);

  // A JOB'S ID IS ITS ROUTE IN THE SPIRIT TREE (goal/G43.20; Andy: "they're supposed to identify a "route" in the
  // spirit-tree, NOT some invented number.", "ALL job id's will be routes to either a node supplied api (spirit.fs, etc...)
  // or an app supplied id (spirit.app.<name>)"): spirit, spirit.fs, spirit.app.desk. No type: the id says what it is.
  // ONE JOB PER ID (Q3: "a job cannot start if it is already running"): a start of an id that is running or pending is
  // refused, already-running; one that ended is replaced, so a new run takes its id over and runs on. `module` is the app
  // a server or run is an instance of, its route too.
  function createJob(kind, id, initialData, module) {
    const old = jobsMap.get(id);
    if (old && !TERMINAL_STATUSES.has(old.status)) {
      const e = new Error(id + ' is already running');
      e.refusal = 'already-running';
      throw e;
    }
    const now = Date.now();
    const job = {
      id: id,
      kind: kind,
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
  // THE NODE'S OWN JOBS, ONE PER FAMILY (goal/G43.20, Q1, Q2): spirit (its stats and join steps), spirit.fs, spirit.app (the
  // app list), spirit.contact (contacts, peer search hits, presence), spirit.auth. Whoever publishes on one asks
  // for it by its id; the first ask makes it.
  function ownJob(id) {
    const job = jobsMap.get(id);
    if (job && job.kind === 'permanent' && !TERMINAL_STATUSES.has(job.status)) return job;
    return createJob('permanent', id, {});
  }
  // EACH EVENT CARRIES ONLY ITS OWN NEWS (the box): what one kind of news says replaces the job's data whole, so no event
  // brings another kind along. The newest news of each kind is kept beside the job (news), never on it, so a page that
  // connects is handed each kind once as its own event (newsOf, events.js and faceHome.js), as one that was there heard it.
  const newsKept = new Map();      // id -> { kind: data }
  function ownNews(id, kind, data) {
    const job = ownJob(id);
    const kept = newsKept.get(id) || {};
    kept[kind] = data;
    newsKept.set(id, kept);
    job.data = data;
    job.updatedAt = Date.now();
    events.emit('job-updated', job);
    return job;
  }
  // A job as many times as it has kinds of news, each a copy carrying that one news: what a page that connects is handed.
  function newsOf(job) {
    const kept = job ? newsKept.get(job.id) : null;
    if (!kept) return job ? [job] : [];
    return Object.keys(kept).map(function (kind) { return Object.assign({}, job, { data: kept[kind] }); });
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
  // (fileSystem.js's vendored folders, .git, anything fileServable refuses, the node's state among them); chokidar is asked to ignore the same,
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
    // THE NODE'S FILES ARE spirit.fs (goal/G43.20).
    const job = ownJob('spirit.fs');
    // No face part is streamed: the old shell's face parts are gone (goal/G43.20; Andy: "drop the old shells face parts
    // altogether."), so spirit.app carries the app list alone.
    const relOf = function (full) { return path.relative(rootDir, full).split(path.sep).join('/'); };
    const ignored = function (full) {
      const rel = path.relative(RUN_ROOT, path.resolve(full)).split(path.sep).join('/');
      if (!rel || rel.indexOf('..') === 0) return false;
      if (rel.split('/').some(function (part) { return part === '.git'; }) || fileSystem.VENDORED_FOLDERS.holds(rel)) return true;
      return !fileSystem.fileServable(rel);
    };
    const watcher = require('./jobs/chokidar/index.js').watch(rootDir, { ignored: ignored, ignoreInitial: false, persistent: true });
    watcher.on('all', function (event, full) {
      const op = FS_OPS[event];
      const rel = full ? relOf(full) : '';
      if (!op || !rel || rel.indexOf('..') === 0) return;
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
      // dangeling processes"). (The old kernel did it for every process; it is
      // gone.)
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
    // Its id is its app's route, spirit.app.<name> (goal/G43.20): a second start while it runs is refused here.
    const p = appOf((args || [])[0], options.cwd);
    const route = 'spirit.app.' + (p ? p.name : '');
    const job = createJob('process', route, {
      command: command,
      args: args || [],
      progress: 0,
      exitCode: null,
    }, route);

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
    // Its id is its app's route, spirit.app.<name>, read off its script's path (goal/G43.20).
    const p = appOf((args || [])[0], options.cwd);
    const route = 'spirit.app.' + (p ? p.name : '');
    const job = createJob('server', route, {
      command: command,
      args: args || [],
      operated: operated,
      restarts: 0,
      exitCode: null,
    }, route);
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

  // ── WHAT jobs.create STARTS (goal/G43.20) ─────────────────────────────
  //
  // Andy: "cw, box that only jobs in the app folder with node:run:true can be started with jobs.create". Its command is
  // this node's executable (the word node, all a page can say, is read as it), its script an app's own
  // spirit/app/<name>/<name>.js of this node's tree, and that app's <name>.json says node run true. Anything else is refused
  // before anything runs: another command or another script, not-a-process; an app without node run, process-not-included.
  // Its job's id is the app's route, spirit.app.<name>, so a second start while one runs or waits is refused (createJob).
  // AN APP OF spirit/app/ (goal/G43.12). Andy: "active is exactly that: "running"", and "that's how the node knows, at
  // re-boot time, which servers it must autostart." active in spirit/state/<name>/node.json is the one switch for its server;
  // node.mount in spirit/app/<name>/<name>.json says it has a server at all.
  function appActive(root, name) {
    // An intrinsic app is always active (goal/G43.14): its <name>.json says so, and node.json is not asked.
    if (require('./coreFiles').appIntrinsic(path.resolve(root, '..', '..'), name) === true) return true;
    try { return JSON.parse(fs.readFileSync(path.join(root, 'spirit', 'state', name, 'node.json'), 'utf8')).active === true; } catch (e) { return false; }
  }
  // AN APP THAT IS RUN, NOT MOUNTED (goal/G43.21): node.run in its <name>.json.
  function appRuns(root, name) {
    try { const own = JSON.parse(fs.readFileSync(path.join(root, 'spirit', 'app', name, name + '.json'), 'utf8')); return !!(own && own.node && own.node.run === true); } catch (e) { return false; }
  }
  function appServes(root, name) {
    let own = null;
    try { own = JSON.parse(fs.readFileSync(path.join(root, 'spirit', 'app', name, name + '.json'), 'utf8')); } catch (e) { return false; }
    return !!(own && own.node && own.node.mount === true) && appActive(root, name);
  }
  // An app's own script, <root>/spirit/app/<name>/<name>.js, read as {root, name}; null for anything else, a helper beside
  // it included. The one reading of a script's path, for whether it may run and for the route its job is.
  function appOf(script, cwd) {
    if (typeof script !== 'string' || !/\.js$/.test(script)) return null;
    const abs = path.resolve(cwd || process.cwd(), script);
    const a = /^(.*)[\/\\]spirit[\/\\]app[\/\\]([^\/\\]+)[\/\\]([^\/\\]+)\.js$/.exec(abs);
    return a && a[2] === a[3] ? { root: a[1], name: a[2] } : null;
  }
  function refused(code, text, name) {
    const e = new Error(text);
    e.refusal = code;
    if (name) e.process = name;
    return e;
  }
  function startJob(command, args, options) {
    options = options || {};
    const p = appOf((args || [])[0], options.cwd);
    const own = (command === process.execPath || command === 'node') && !!p && path.relative(path.resolve(__dirname, '..'), p.root) === '';
    if (!own) throw refused('not-a-process', 'only an app\'s own script of this node starts');
    if (!appRuns(p.root, p.name)) throw refused('process-not-included', 'process not included on this node: ' + p.name, p.name);
    return startProcessJob(process.execPath, args, options);
  }

  // ── THE APPS' SERVERS (goal/G43.12) ───────────────────────────────────
  //
  // Every app whose <name>.json says node mount true and which is switched on is started with the node, and kept
  // running. THE NODE NAMES ITS PIPE (desk/G1.6, appPair D15): each server starts with --pipe <the name the node chose>, and
  // is registered with `client` (appClient) so 'api' and calls reach it. ITS JOB KEPT BY NAME: at boot, and again whenever
  // its active is written (followApp, below). The node it runs on is the one startNodeServers was handed.
  const nodeServers = new Map();   // name -> its server job
  let serverHost = null;            // { rootDir, client }, from startNodeServers
  // ONE APP'S SERVER: spirit/app/<name>/<name>.js. ITS ARGUMENTS ARE ITS <name>.json's DEFAULTS; none without.
  function startAppServer(rootDir, client, name) {
    const script = path.join(rootDir, 'spirit', 'app', name, name + '.js');
    if (!fs.existsSync(script)) return null;
    let own = null;
    try { own = JSON.parse(fs.readFileSync(path.join(rootDir, 'spirit', 'app', name, name + '.json'), 'utf8')); } catch (e) { own = null; }
    const values = {};
    ((own && Array.isArray(own.args)) ? own.args : []).forEach(function (a) { if (a && a.name) values[a.name] = a.default; });
    const pipe = require('./appClient').pipePathFor(rootDir, name, process.platform);
    // ITS STATE IS THE NODE'S TO NAME (desk/G1 D5): spirit/state/<name>/data/ (goal/G43.10), handed over as --state, so a
    // process never works out its own folder. Its folder, spirit/state/<name>/, holds node.json, cache/, data/ and on Linux
    // door.sock (goal/G43.20).
    const state = path.join(rootDir, 'spirit', 'state', name, 'data');
    try { fs.mkdirSync(state, { recursive: true }); } catch (e) { /* the server says why */ }
    const args = [script, JSON.stringify(values), '--pipe', pipe, '--state', state].concat(nodeArgOf(rootDir));
    // AN APP'S DEBUG, KEPT BY THE NODE (goal/G43.15, Q2, Q3: "only the new ones."): handed over at every start, a restart after a
    // crash included, since the job starts again from this same list.
    args.push('--debug', String(appDebug(rootDir, name)));
    appArgs.set(name, args);
    const job = startServerJob('node', args, { operated: 'node' });
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
  // ── ONE-SHOT APPS (goal/G43.19, box v16) ─────────────────────────────
  //
  // Andy: "for apps with only shell:mount:true and node:mount:false or missing, BUT with a api.js and data.js, the node must
  // execute spirit/app/<name>/<name>.js with the request, instead of routing it to a server, like a cgi-script, and that
  // process lives only as long as the request.", "there will simply be two kinds, permanent or one-shot processes."
  // 2: a one-shot app has api.js and data.js at its top, node mount false or missing, and is switched on. 4: it is
  // registered with the permanent ones, here; switched off it is remembered and not served (Andy: "the appClient is supposed
  // to fucking remember the icons app, because it will find it when it scans for appServers."): a call to it answers
  // app-not-served, and the scan at boot remembers one that is off too. 10: the node keeps one job for it,
  // spirit.app.<name>, open while it is on, and hands that id to every run, so a run publishes on it before it ends.
  const oneShots = new Map();   // name -> its job
  // Whether the app is a one-shot app, by its folder and its <name>.json; switched on as well unless anyState.
  function appOneShot(root, name, anyState) {
    let own = null;
    try { own = JSON.parse(fs.readFileSync(path.join(root, 'spirit', 'app', name, name + '.json'), 'utf8')); } catch (e) { return false; }
    if (own && own.node && own.node.mount === true) return false;
    const dir = path.join(root, 'spirit', 'app', name);
    if (!fs.existsSync(path.join(dir, name + '.js')) || !fs.existsSync(path.join(dir, 'api.js')) || !fs.existsSync(path.join(dir, 'data.js'))) return false;
    return anyState === true || appActive(root, name);
  }
  function startOneShot(rootDir, client, name) {
    if (!client || typeof client.registerOneShot !== 'function') return null;
    const script = path.join(rootDir, 'spirit', 'app', name, name + '.js');
    const route = 'spirit.app.' + name;
    const old = getJob(route);
    const job = old && !TERMINAL_STATUSES.has(old.status) ? old : createJob('server', route, { oneShot: true, command: process.execPath, args: [script] }, route);
    updateJob(job.id, { status: 'running' });
    const state = path.join(rootDir, 'spirit', 'state', name, 'data');
    try { fs.mkdirSync(state, { recursive: true }); } catch (e) { /* the run says why */ }
    const pipe = require('./appClient').pipePathFor(rootDir, name, process.platform);
    // One run of the script, handed what a permanent server is handed: its pipe, its state folder, the node's facts and its
    // DEBUG; launch() gives it its job's id. A socket left by the run before is cleared first (off Windows a pipe is a file).
    const start = function () {
      if (process.platform !== 'win32') { try { fs.rmSync(pipe, { force: true }); } catch (e) { /* none */ } }
      const args = [script, '{}', '--pipe', pipe, '--state', state].concat(nodeArgOf(rootDir), ['--debug', String(appDebug(rootDir, name))]);
      return launch(job, process.execPath, args, rootDir);
    };
    if (!client.registerOneShot(name, pipe, start, path.join(rootDir, 'spirit', 'app', name, 'api.js'))) { cancelJob(job.id); return null; }
    oneShots.set(name, job);
    return job;
  }
  function stopOneShot(client, name) {
    const job = oneShots.get(name);
    oneShots.delete(name);
    if (client && typeof client.serve === 'function') client.serve(name, false);
    if (job) cancelJob(job.id);
  }
  // An app found off at boot: remembered, its row marked not served, no job.
  function rememberOneShot(rootDir, client, name) {
    if (!client || typeof client.registerOneShot !== 'function') return;
    const pipe = require('./appClient').pipePathFor(rootDir, name, process.platform);
    if (client.registerOneShot(name, pipe, function () { return null; }, path.join(rootDir, 'spirit', 'app', name, 'api.js'))) client.serve(name, false);
  }

  function startNodeServers(rootDir, client) {
    serverHost = { rootDir: rootDir, client: client };
    let apps = [];
    try { apps = fs.readdirSync(path.join(rootDir, 'spirit', 'app')); } catch (e) { apps = []; }
    apps.filter(function (name) { return appOneShot(rootDir, name, true); }).forEach(function (name) {
      if (appActive(rootDir, name)) startOneShot(rootDir, client, name); else rememberOneShot(rootDir, client, name);
    });
    return apps.filter(function (name) { return appServes(rootDir, name); })
      .map(function (name) { return startAppServer(rootDir, client, name); })
      .filter(Boolean);
  }
  // active WRITTEN STARTS OR STOPS ITS SERVER (goal/G43.12, Q4: "exactly."): told by the app family as it writes node.json.
  // DEBUG KEPT FOR AN APP (goal/G43.15): what its server reports on its job is written into its node.json, and handed back at
  // its next start. The server never writes the node's file.
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
    // A ONE-SHOT APP SWITCHED ON OR OFF (goal/G43.19, box v16, 4): registered or its row gone, no restart of the node.
    const oneShot = appOneShot(rootDir, name);
    if (oneShot && !oneShots.has(name)) startOneShot(rootDir, serverHost.client, name);
    else if (!oneShot && oneShots.has(name)) stopOneShot(serverHost.client, name);
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

    // THE NODE'S STATS ARE ITS OWN NEWS, ON spirit (goal/G43.20): each tick one event, { stats }, nothing else in it.
    const job = ownJob('spirit');

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

      ownNews('spirit', 'stats', {
        stats: {
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
    ownJob: ownJob,
    ownNews: ownNews,
    newsOf: newsOf,
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
