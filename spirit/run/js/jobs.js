'use strict';

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const { EventEmitter } = require('events');
const { monitorEventLoopDelay } = require('perf_hooks');

const MAX_LOG_ENTRIES = 200;
const RESCAN_DEBOUNCE_MS = 150;
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

module.exports = function installJobs(spirit, port) {
  const scanFolder = spirit.core.node.util.scanFolder;

  spirit.core.server = spirit.core.server || { stats: {} };

  const jobsMap = new Map();
  const events = new EventEmitter();
  // Every SSE connection (server.js's handleSseConnection) attaches two
  // listeners here — job-updated and job-deleted — and detaches them when
  // the client goes away. Node's default ceiling of 10 therefore starts
  // printing MaxListenersExceededWarning at the sixth open tab, which
  // reads like a leak and isn't one. There is no fixed upper bound worth
  // guessing at, so remove the ceiling rather than raise it.
  events.setMaxListeners(0);
  let nextId = 1;

  function createJob(kind, type, initialData) {
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

    if (patch.status) {
      job.status = patch.status;
    }

    if (patch.data) {
      Object.assign(job.data, patch.data);
    }

    if (typeof patch.logMessage === 'string') {
      appendLog(job, patch.logMessage);
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

  function startFsWatcherJob(rootDir) {
    const files = scanFolder(rootDir).map(function(entry) { return mapEntry(entry, rootDir); });
    const job = createJob('permanent', 'fs-watcher', { files: files });

    let pending = null;
    // What the last emitted list said. A rescan that says the same thing
    // is not news: the payload carries name/parentPath/fullPath/
    // relativePath/kind and no mtime or size, so rewriting a file that
    // already existed produces a byte-identical list.
    //
    // That happens constantly. Relay Chat polls its inbox every two
    // seconds and each poll rewrites relay-state/who.json, which is
    // inside rootDir, which wakes this watcher, which rescans and — until
    // now — emitted an update every two seconds forever. Every subscriber
    // repainted from it: the Files tree rebuilt its markup and every open
    // folder in it collapsed, because a <details> built fresh is a
    // <details> that is closed.
    //
    // So the comparison happens once, here, rather than in each consumer
    // (and each consumer that forgot). Note this makes lastEvent trail
    // the truth when a write changes no names — nothing reads it, and a
    // record of "somebody touched a file we cannot see the effect of" is
    // not worth waking every app in the page for.
    let lastFilesJson = JSON.stringify(job.data.files);
    function scheduleRescan(eventType, filename) {
      if (pending) return;
      pending = setTimeout(function() {
        pending = null;
        const rescannedFiles = scanFolder(rootDir).map(function(entry) { return mapEntry(entry, rootDir); });
        const asJson = JSON.stringify(rescannedFiles);
        if (asJson === lastFilesJson) return;
        lastFilesJson = asJson;
        updateJob(job.id, { data: { files: rescannedFiles, lastEvent: { eventType: eventType, filename: filename } } });
      }, RESCAN_DEBOUNCE_MS);
    }

    const watcher = fs.watch(rootDir, { recursive: true }, function(eventType, filename) {
      scheduleRescan(eventType, filename);
    });

    watcher.on('error', function(err) {
      // 'failed', not 'error': only TERMINAL_STATUSES can be deleted, and
      // 'error' was in neither that set nor anything the UI renders — a
      // watcher that died left a row in Jobs that deleteJob refused
      // forever, with no way to clear it short of restarting the server.
      updateJob(job.id, { status: 'failed', logMessage: String(err) });
    });

    job._stop = function() {
      if (pending) clearTimeout(pending);
      watcher.close();
    };

    return job;
  }

  function startProcessJob(command, args, options) {
    options = options || {};
    const job = createJob('process', options.type || command, {
      command: command,
      args: args || [],
      progress: 0,
      exitCode: null,
    });

    const child = child_process.spawn(command, args || [], {
      env: Object.assign({}, process.env, {
        SPIRIT_JOB_ID: job.id,
        // THE ONE DOOR, and the id travels beside the verb rather than
        // baked into the path — see spirit.core.jobs.report in kernel.js,
        // which is the only thing that reads this.
        SPIRIT_CALLBACK_URL: 'http://localhost:' + port + '/api/spirit',
      }),
    });

    job._stop = function() {
      child.kill();
    };

    updateJob(job.id, { status: 'running', data: { pid: child.pid } });

    child.on('exit', function(code) {
      const current = getJob(job.id);
      if (current && !TERMINAL_STATUSES.has(current.status)) {
        updateJob(job.id, {
          status: code === 0 ? 'completed' : 'failed',
          data: { exitCode: code },
          logMessage: 'process exited with code ' + code,
        });
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
  // Started by the node itself at boot (appServers.js), never through the
  // jobs.create verb: the loopback door gains nothing (Andy, 2026-09-27).
  // cancelJob stops it for good.
  const RESTART_MIN_MS = 1000;
  const RESTART_MAX_MS = 60000;
  const STEADY_MS = 60000;
  function startServerJob(command, args, options) {
    options = options || {};
    const spawn = options.spawn || child_process.spawn;
    const job = createJob('server', options.type || command, {
      command: command,
      args: args || [],
      restarts: 0,
      exitCode: null,
    });
    let child = null;
    let stopped = false;
    let wait = RESTART_MIN_MS;
    let timer = null;

    function run() {
      timer = null;
      if (stopped) return;
      const startedAt = Date.now();
      try {
        // AN IPC CHANNEL, so the server exits when this node does: a node
        // killed outright leaves no orphan holding its pipe (appServer.js,
        // fromArgv, 'disconnect'). Its output goes to this job's log.
        child = spawn(command, args || [], { cwd: options.cwd, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
      } catch (e) {
        updateJob(job.id, { status: 'failed', data: { error: String(e) } });
        return;
      }
      updateJob(job.id, { status: 'running', data: { pid: child.pid } });
      [child.stdout, child.stderr].forEach(function (stream) {
        if (!stream) return;
        stream.setEncoding('utf8');
        stream.on('data', function (text) {
          String(text).split(/\r?\n/).forEach(function (line) { if (line) appendLog(job, line); });
        });
      });
      child.on('error', function (err) { appendLog(job, 'could not start: ' + String(err)); });
      child.on('exit', function (code) {
        child = null;
        if (stopped) return;
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

  function startStatsJob(options) {
    options = options || {};
    const intervalMs = options.intervalMs || DEFAULT_STATS_INTERVAL_MS;
    const requestCounters = options.requestCounters || { total: 0, byMethod: {}, byStatusClass: {} };

    const job = createJob('permanent', 'server-stats', spirit.core.server.stats);
    // job.data === spirit.core.server.stats from here on (createJob assigns the reference as-is)

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
      let fsWatcherJob = null;
      listJobs().forEach(function(j) {
        jobCounts.total++;
        jobCounts.byStatus[j.status] = (jobCounts.byStatus[j.status] || 0) + 1;
        if (j.type === 'fs-watcher') fsWatcherJob = j;
      });

      // Derived from the fs-watcher job's already-in-memory file list —
      // no extra filesystem I/O, just tallying what it already scanned.
      const filesystem = { files: 0, folders: 0, byMimeType: {} };
      if (fsWatcherJob && Array.isArray(fsWatcherJob.data.files)) {
        fsWatcherJob.data.files.forEach(function(entry) {
          if (entry.kind === 'folder') {
            filesystem.folders++;
          } else {
            filesystem.files++;
            const ext = path.extname(entry.name).toLowerCase();
            const mimeType = spirit.core.const.MIME_TYPES[ext] || 'application/octet-stream';
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

  spirit.core.node.jobs = {
    events: events,
    createJob: createJob,
    updateJob: updateJob,
    getJob: getJob,
    listJobs: listJobs,
    cancelJob: cancelJob,
    deleteJob: deleteJob,
    startFsWatcherJob: startFsWatcherJob,
    startProcessJob: startProcessJob,
    startServerJob: startServerJob,
    startStatsJob: startStatsJob,
  };

  return spirit.core.node.jobs;
};
