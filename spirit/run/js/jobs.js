'use strict';

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const { EventEmitter } = require('events');

const MAX_LOG_ENTRIES = 200;
const RESCAN_DEBOUNCE_MS = 150;

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled', 'stopped']);

module.exports = function installJobs(spirit, port) {
  const scanFolder = spirit.core.node.util.scanFolder;

  const jobsMap = new Map();
  const events = new EventEmitter();
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
      job.log.push({ timestamp: Date.now(), message: patch.logMessage });
      if (job.log.length > MAX_LOG_ENTRIES) {
        job.log.splice(0, job.log.length - MAX_LOG_ENTRIES);
      }
    }

    job.updatedAt = Date.now();
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

  function mapEntry(entry) {
    return {
      name: entry.name,
      parentPath: entry.parentPath,
      fullPath: path.join(entry.parentPath, entry.name),
      kind: entry.isDirectory() ? 'folder' : 'file',
    };
  }

  function startFsWatcherJob(rootDir) {
    const files = scanFolder(rootDir).map(mapEntry);
    const job = createJob('permanent', 'fs-watcher', { files: files });

    let pending = null;
    function scheduleRescan(eventType, filename) {
      if (pending) return;
      pending = setTimeout(function() {
        pending = null;
        const rescannedFiles = scanFolder(rootDir).map(mapEntry);
        updateJob(job.id, { data: { files: rescannedFiles, lastEvent: { eventType: eventType, filename: filename } } });
      }, RESCAN_DEBOUNCE_MS);
    }

    const watcher = fs.watch(rootDir, { recursive: true }, function(eventType, filename) {
      scheduleRescan(eventType, filename);
    });

    watcher.on('error', function(err) {
      updateJob(job.id, { status: 'error', logMessage: String(err) });
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
        SPIRIT_CALLBACK_URL: 'http://localhost:' + port + '/api/jobs/' + job.id,
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

  spirit.core.node.jobs = {
    events: events,
    createJob: createJob,
    updateJob: updateJob,
    getJob: getJob,
    listJobs: listJobs,
    cancelJob: cancelJob,
    startFsWatcherJob: startFsWatcherJob,
    startProcessJob: startProcessJob,
  };

  return spirit.core.node.jobs;
};
