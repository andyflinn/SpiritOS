'use strict';
require('../../script.js');

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
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
function installJobs(port) {

  const jobsMap = new Map();
  const events = new EventEmitter();
  // Every stream subscriber (the events family's subscribe, event/event.js) attaches two
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
  // app list), spirit.contact (contacts, peer search hits, presence), spirit.grant, spirit.bundle, spirit.branch. Whoever publishes on one asks
  // for it by its id; the first ask makes it.
  function ownJob(id) {
    const job = jobsMap.get(id);
    if (job && job.kind === 'permanent' && !TERMINAL_STATUSES.has(job.status)) return job;
    return createJob('permanent', id, {});
  }
  // EACH EVENT CARRIES ONLY ITS OWN NEWS (the box): what one kind of news says replaces the job's data whole, so no event
  // brings another kind along. The newest news of each kind is kept beside the job (news), never on it, so a page that
  // connects is handed each kind once as its own event (newsOf, event.js and faceHome.js), as one that was there heard it.
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
    if (patch.app && typeof patch.app === 'object' && Buffer.byteLength(JSON.stringify(patch.app), 'utf8') > spirit.requireScript('spirit/limits/script.js').PAYLOAD_MAX) return null;

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

  // THE FS DATASET (goal/G49.1): spirit/fs/dataset/script.js, which the watcher fills (spirit/fs/server/script.js since goal/G49.15).
  function fsDataset() { return spirit.requireScript('spirit/fs/dataset/script.js'); }

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
        // baked into the path — spirit/job/processJob/script.js reads SPIRIT_JOB_ID,
        // and a process that needs the node's port reads this URL.
        SPIRIT_CALLBACK_URL: 'http://localhost:' + port + '/spirit',
      }),
      // The IPC channel closes when this node dies however it dies, and a
      // server's appServer.serve ends its process then: no orphan ("who wants
      // dangeling processes"). (The old kernel did it for every process; it is
      // gone.)
      // ITS CONSOLE GOES TO NULL AT THE SOURCE (goal/G41.33, the box: "Console output goes to null by default, at the source,
      // for every process, except node and relay. Only DEBUG turns it on. A crash is no exception"). Read as it starts, so a
      // process started with DEBUG off stays silent until it is started again. Its published lines and exit code stay.
      stdio: require('../../script.js').debugLog() ? ['ignore', 'pipe', 'pipe', 'ipc'] : ['ignore', 'ignore', 'ignore', 'ipc'],
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
    // Its id is its app's id, its folder's path in dots, spirit.app.desk (goal/G43.20, goal/G49.19): a second start while it
    // runs is refused here.
    const p = appOf(appScriptOf(args, options.cwd), options.cwd);
    const route = p ? idOf(p.dir) : '';
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
  // spirit.job.create verb: the loopback door gains nothing (Andy, 2026-09-27).
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
    // Its id is its app's id, its folder's path in dots, read off its script's path (goal/G43.20, goal/G49.19).
    const p = appOf(appScriptOf(args, options.cwd), options.cwd);
    const route = p ? idOf(p.dir) : '';
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

  // ── WHAT spirit.job.create STARTS (goal/G43.20) ─────────────────────────────
  //
  // Andy: "cw, box that only jobs in the app folder with node:run:true can be started with jobs.create". Its command is
  // this node's executable (the word node, all a page can say, is read as it), its script an app's own
  // spirit/app/<name>/<name>.js of this node's tree, and that app's <name>.json says node run true. Anything else is refused
  // before anything runs: another command or another script, not-a-process; an app without node run, process-not-included.
  // Its job's id is the app's route, spirit.app.<name>, so a second start while one runs or waits is refused (createJob).
  // AN APP OF spirit/app/ (goal/G43.12). Andy: "active is exactly that: "running"", and "that's how the node knows, at
  // re-boot time, which servers it must autostart." active in spirit/state/app/<name>/node.json is the one switch for its server;
  // node.mount in spirit/app/<name>/<name>.json says it has a server at all.
  // AN APP'S STATE FOLDER, BY spirit.statePath (goal/G49.17, box v5: spirit/state/app/<name>/): its node.json, its data/ handed
  // over as --state. The app path is built from the name here, as all of the job's app paths are until the job's turn (Andy,
  // goal/G49.17: "we'll fix all of job when it's turn after fs finally starts").
  function appState(root, dir) { return path.join(root, ...spirit.statePath(dir).split('/')); }
  // AN APP IS KNOWN BY ITS FOLDER (goal/G49.19, box: "ALL aspects of jobs/processes identify them by the full path of their
  // branch, whereever they may be mounted"; "all translation from name to path or back is NOT PERMITTED"): dir is its folder's
  // run path, spirit/app/desk; its id the same path in dots, spirit.app.desk, its job's id and its name on the wire; its own
  // files are <dir>/<the folder's own name>.json and .js.
  function idOf(dir) { return spirit.dottedPath(dir); }
  function baseOf(dir) { const d = String(dir); return d.slice(d.lastIndexOf('/') + 1); }
  function manifestOf(root, dir) { try { return JSON.parse(fs.readFileSync(path.join(root, ...dir.split('/'), baseOf(dir) + '.json'), 'utf8')); } catch (e) { return null; } }
  function scriptOf(dir) { return dir + '/' + baseOf(dir) + '.js'; }
  function appActive(root, dir) {
    // An intrinsic app is always active (goal/G43.14): its <name>.json says so, and node.json is not asked.
    if (spirit.requireScript('spirit/fs/coreFiles/script.js').appIntrinsic(path.resolve(root, '..', '..'), dir) === true) return true;
    try { return JSON.parse(fs.readFileSync(path.join(appState(root, dir), 'node.json'), 'utf8')).active === true; } catch (e) { return false; }
  }
  // AN APP THAT IS RUN, NOT MOUNTED (goal/G43.21): node.run in its <name>.json.
  function appRuns(root, dir) { const own = manifestOf(root, dir); return !!(own && own.node && own.node.run === true); }
  function appServes(root, dir) {
    const own = manifestOf(root, dir);
    return !!(own && own.node && own.node.mount === true) && appActive(root, dir);
  }
  // The one reading of a script's path, for whether it may run and for the route its job is: appOf, below.
  // THE APP'S SCRIPT OF A START (goal/G43.32; goal/G48.5, the box: "the node starts every server process as \"node
  // spirit/server/script.js --app <script>\""): every server process runs as the launcher, then --app, then the app's script, so the
  // script is the argument after --app when the launcher comes first.
  // ONLY THIS NODE'S OWN LAUNCHER (RH1, the daily re-review, of the check before it: "A commit added a check that only looks at
  // how the first argument ends, and anyone who can call jobs.create can get arbitrary code past it. The fix is to require
  // that argument to be exactly the node's own" server file; goal/G48.5, the box: "the start check carries over exactly"):
  // the first argument exactly this node's own spirit/server/script.js and the second exactly --app; a first argument that merely
  // ends in server.js is no server process, so it is checked as the script itself, and refused.
  // THE LAUNCHER BY ITS RUN PATH, ONE STRING (goal/G49.12, box v17: "start server processes fully knowing that the server is at
  // ./spirit/server/script.js, relative to the current directory of all spirit processes"): every server process is started
  // with it as it stands, in the node's own run directory; OWN_LAUNCHER is that file where this node stands.
  const LAUNCHER = 'spirit/server/script.js';
  const OWN_LAUNCHER = path.resolve(__dirname, '..', '..', '..', LAUNCHER);
  function sameFile(a, b) { return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b; }
  function appScriptOf(args, cwd) {
    const a = args || [];
    return typeof a[0] === 'string' && sameFile(path.resolve(cwd || process.cwd(), a[0]), OWN_LAUNCHER) && a[1] === '--app' ? a[2] : a[0];
  }
  // Andy: "The node starts every app server, one-shot and long-running alike, as appServer.js with the app's path" (the box,
  // decided 9), through the launcher since goal/G48.5: spirit/server/app/script.js requires the app's script and checks each call by
  // its api.js, in the app's own process.
  function appServerArgs(rootDir, script) { return [LAUNCHER, '--app', script]; }
  // An app's own script, read as {root, dir}: <root>/<dir>/<base>.js where dir is an app folder of this node's tree and base
  // its own last name; null for anything else, a helper beside it included (goal/G49.19: any app folder, not only spirit/app/).
  function appOf(script, cwd) {
    if (typeof script !== 'string' || !/\.js$/.test(script)) return null;
    const abs = path.resolve(cwd || process.cwd(), script);
    const root = path.resolve(__dirname, '..', '..', '..');
    const rel = path.relative(root, abs).split(path.sep).join('/');
    if (!rel || rel.indexOf('..') === 0 || path.isAbsolute(rel)) return null;
    const dir = rel.slice(0, rel.lastIndexOf('/'));
    if (!dir || rel !== scriptOf(dir) || !((fsDataset().file(dir) || {}).app === true)) return null;
    return { root: root, dir: dir };
  }
  function refused(code, text, name) {
    const e = new Error(text);
    e.refusal = code;
    if (name) e.process = name;
    return e;
  }
  function startJob(command, args, options) {
    options = options || {};
    const p = appOf(appScriptOf(args, options.cwd), options.cwd);
    const own = (command === process.execPath || command === 'node') && !!p && path.relative(path.resolve(__dirname, '..', '..', '..'), p.root) === '';
    if (!own) throw refused('not-a-process', 'only an app\'s own script of this node starts');
    if (!appRuns(p.root, p.dir)) throw refused('process-not-included', 'process not included on this node: ' + idOf(p.dir), idOf(p.dir));
    return startProcessJob(process.execPath, args, options);
  }

  // ── THE APPS' SERVERS (goal/G43.12) ───────────────────────────────────
  //
  // Every app whose <name>.json says node mount true and which is switched on is started with the node, and kept
  // running. THE NODE NAMES ITS PIPE (desk/G1.6, appPair D15): each server starts with --pipe <the name the node chose>, and
  // is registered with `client` (appClient) so 'api' and calls reach it. ITS JOB KEPT BY NAME: at boot, and again whenever
  // its active is written (followApp, below). The node it runs on is the one startNodeServers was handed.
  const nodeServers = new Map();   // an app's folder -> its server job
  let serverHost = null;            // { rootDir, client }, from startNodeServers
  // ONE APP'S SERVER: spirit/app/<name>/<name>.js. ITS ARGUMENTS ARE ITS <name>.json's DEFAULTS; none without.
  function startAppServer(rootDir, client, dir) {
    // The app's script by its run path, as the app server requires it, as it is (goal/G49.13: no resolve).
    const script = scriptOf(dir);
    if (!inTree(script)) return null;
    const own = manifestOf(rootDir, dir);
    const values = {};
    ((own && Array.isArray(own.args)) ? own.args : []).forEach(function (a) { if (a && a.name) values[a.name] = a.default; });
    const pipe = spirit.requireScript('spirit/app/adapter/script.js').pipePathFor(rootDir, dir, process.platform);
    // ITS STATE IS THE NODE'S TO NAME (desk/G1 D5): spirit/state/app/<name>/data/ (goal/G43.10), handed over as --state, so a
    // process never works out its own folder. Its folder, spirit/state/app/<name>/, holds node.json, cache/, data/ and on Linux
    // door.sock (goal/G43.20).
    const state = path.join(appState(rootDir, dir), 'data');
    try { fs.mkdirSync(state, { recursive: true }); } catch (e) { /* the server says why */ }
    const args = appServerArgs(rootDir, script).concat([JSON.stringify(values), '--pipe', pipe, '--state', state], nodeArgOf(rootDir));
    // AN APP'S DEBUG, KEPT BY THE NODE (goal/G43.15, Q2, Q3: "only the new ones."): handed over at every start, a restart after a
    // crash included, since the job starts again from this same list.
    args.push('--debug', String(appDebug(rootDir, dir)));
    appArgs.set(dir, args);
    const job = startServerJob('node', args, { operated: 'node' });
    nodeServers.set(dir, job);
    if (client && typeof client.register === 'function') client.register(idOf(dir), pipe);
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
  // puts them on spirit.nodeFacts as it is required (the port from
  // spirit/state/environment.json).
  // Read as a server starts: a server learns a changed owner when the node
  // starts it again.
  function nodeArgOf(rootDir) {
    const me = spirit.requireScript('spirit/relayAuth/script.js').loadIdentity(rootDir);
    const owner = spirit.requireScript('spirit/relayAuth/script.js').loadOwner(rootDir, function () {});
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
  const oneShots = new Map();   // an app's folder -> its job
  // Whether the app is a one-shot app, by its folder and its <name>.json; switched on as well unless anyState.
  function appOneShot(root, dir, anyState) {
    const own = manifestOf(root, dir);
    if (!own) return false;
    if (own.node && own.node.mount === true) return false;
    if (!inTree(scriptOf(dir)) || !inTree(dir + '/api.js') || !inTree(dir + '/data.js')) return false;
    return anyState === true || appActive(root, dir);
  }
  function startOneShot(rootDir, client, dir) {
    if (!client || typeof client.registerOneShot !== 'function') return null;
    // The app's script by its run path, as the app server requires it, as it is (goal/G49.13: no resolve).
    const script = scriptOf(dir);
    const route = idOf(dir);
    const old = getJob(route);
    const job = old && !TERMINAL_STATUSES.has(old.status) ? old : createJob('server', route, { oneShot: true, command: process.execPath, args: appServerArgs(rootDir, script) }, route);
    updateJob(job.id, { status: 'running' });
    const state = path.join(appState(rootDir, dir), 'data');
    try { fs.mkdirSync(state, { recursive: true }); } catch (e) { /* the run says why */ }
    const pipe = spirit.requireScript('spirit/app/adapter/script.js').pipePathFor(rootDir, dir, process.platform);
    // One run of the script, handed what a permanent server is handed: its pipe, its state folder, the node's facts and its
    // DEBUG; launch() gives it its job's id. A socket left by the run before is cleared first (off Windows a pipe is a file).
    const start = function () {
      if (process.platform !== 'win32') { try { fs.rmSync(pipe, { force: true }); } catch (e) { /* none */ } }
      const args = appServerArgs(rootDir, script).concat(['{}', '--pipe', pipe, '--state', state], nodeArgOf(rootDir), ['--debug', String(appDebug(rootDir, dir))]);
      return launch(job, process.execPath, args, rootDir);
    };
    if (!client.registerOneShot(idOf(dir), pipe, start)) { cancelJob(job.id); return null; }
    oneShots.set(dir, job);
    return job;
  }
  function stopOneShot(client, dir) {
    const job = oneShots.get(dir);
    oneShots.delete(dir);
    if (client && typeof client.serve === 'function') client.serve(idOf(dir), false);
    if (job) cancelJob(job.id);
  }
  // An app found off at boot: remembered, its row marked not served, no job.
  function rememberOneShot(rootDir, client, dir) {
    if (!client || typeof client.registerOneShot !== 'function') return;
    const pipe = spirit.requireScript('spirit/app/adapter/script.js').pipePathFor(rootDir, dir, process.platform);
    if (client.registerOneShot(idOf(dir), pipe, function () { return null; }, path.join(rootDir, ...dir.split('/'), 'api.js'))) client.serve(idOf(dir), false);
  }

  // THE APPS FROM THE ONE FS DATASET, NEVER FROM THE DISC (goal/G49.2, "No more scanning folders outside new system"; Andy:
  // "fix job.js"): the folders directly in spirit/app/ and the files in them, as this process's spirit.required.spirit.data.fs holds them
  // (spirit/fs/dataset/script.js), fed by the watcher the node starts first (spirit/fs/server/script.js). A <name>.json is still read for what it says.
  function inTree(rel) { return !!fsDataset().file(rel); }
  // EVERY APP FOLDER OF THE TREE (goal/G49.19): the folders the dataset flags app, wherever they stand, by their run paths.
  function appFolders() {
    const files = fsDataset().files();
    return Object.keys(files).filter(function (p) { return files[p].kind === 'folder' && files[p].app === true; }).sort();
  }
  function startNodeServers(rootDir, client) {
    serverHost = { rootDir: rootDir, client: client };
    const apps = appFolders();
    apps.filter(function (dir) { return appOneShot(rootDir, dir, true); }).forEach(function (dir) {
      if (appActive(rootDir, dir)) startOneShot(rootDir, client, dir); else rememberOneShot(rootDir, client, dir);
    });
    return apps.filter(function (dir) { return appServes(rootDir, dir); })
      .map(function (dir) { return startAppServer(rootDir, client, dir); })
      .filter(Boolean);
  }
  // active WRITTEN STARTS OR STOPS ITS SERVER (goal/G43.12, Q4: "exactly."): told by the app family as it writes node.json.
  // DEBUG KEPT FOR AN APP (goal/G43.15): what its server reports on its job is written into its node.json, and handed back at
  // its next start. The server never writes the node's file.
  const appArgs = new Map();     // an app's folder -> the argument list its server job starts from
  function appDebug(root, dir) {
    try { return JSON.parse(fs.readFileSync(path.join(appState(root, dir), 'node.json'), 'utf8')).debug === true; } catch (e) { return false; }
  }
  function keepDebug(job, on) {
    if (job.kind !== 'server' || !serverHost) return;
    const dir = appFolders().filter(function (d) { return idOf(d) === String(job.module || ''); })[0];
    if (!dir) return;
    const file = path.join(appState(serverHost.rootDir, dir), 'node.json');
    let state = {};
    try { state = JSON.parse(fs.readFileSync(file, 'utf8')) || {}; } catch (e) { state = {}; }
    if (state.debug === on) return;
    state.debug = on;
    try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(state, null, 2) + '\n'); } catch (e) { /* kept next time */ }
    const args = appArgs.get(dir);
    const at = args ? args.indexOf('--debug') : -1;
    if (at !== -1) args[at + 1] = String(on);
  }
  // dir: the app's folder, as the app branch hands it (goal/G49.19).
  function followApp(rootDir, dir) {
    if (!serverHost || path.resolve(serverHost.rootDir) !== path.resolve(rootDir)) return;
    // A ONE-SHOT APP SWITCHED ON OR OFF (goal/G43.19, box v16, 4): registered or its row gone, no restart of the node.
    const oneShot = appOneShot(rootDir, dir);
    if (oneShot && !oneShots.has(dir)) startOneShot(rootDir, serverHost.client, dir);
    else if (!oneShot && oneShots.has(dir)) stopOneShot(serverHost.client, dir);
    const job = nodeServers.get(dir);
    const now = job && getJob(job.id);
    const live = !!now && !TERMINAL_STATUSES.has(now.status);
    const want = appServes(rootDir, dir);
    if (want && !live) startAppServer(rootDir, serverHost.client, dir);
    else if (!want && live) { cancelJob(job.id); nodeServers.delete(dir); }
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
        fsDataset().entries().forEach(function(entry) {
          if (entry.kind === 'folder') {
            filesystem.folders++;
          } else {
            filesystem.files++;
            const ext = path.extname(entry.name).toLowerCase();
            const mimeType = require('../../script.js').MIME_TYPES[ext] || 'application/octet-stream';
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
    startProcessJob: startProcessJob,
    startServerJob: startServerJob,
    followApp: followApp,
    startJob: startJob,
    startNodeServers: startNodeServers,
    startStatsJob: startStatsJob,
  };
}
// What it hands out: an object holding its function (goal/G49.16; Andy: "A FUNCTION MUST ALWAYS BE INSTALLED INSIDE A CONTAINING OBJECT. PERIOD!").
module.exports = { installJobs: installJobs };
