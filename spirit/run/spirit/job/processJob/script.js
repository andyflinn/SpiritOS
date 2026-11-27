'use strict';
// spirit/run/spirit/job/processJob/script.js
// THIS PROCESS'S JOB (goal/G29.15), REPORTED BY THE ONE PATH TO PUBLISH (goal/G40.6; Andy, 2026-10-25: "ONE path for
// everybody to publish events"): a process the node started as a job publishes on it with its own id (SPIRIT_JOB_ID, set
// by the node at the start), through the event branch's publish; the node changes the job and every subscriber hears it.
// Out of the spirit object since goal/G49.19 (Andy: "anything that can move out of spirit/script.js should move out. so put
// processJob into spirit/job/processJob/script.js"). Node only: a page has no job of its own. Required by its path by every
// caller; the spirit object's eventStream.publish requires it too and keeps no copy.
//
//   publish(obj)                       the object as the job's app, every page hears it; over PAYLOAD_MAX it is not sent,
//                                      and the pages hear that one was dropped, with its size (fileTransfer goal/G1.4)
//   start(name), progress(done, total, text), end(result)   one step at a time: a start while one is open refuses job-open;
//                                      each resolves once the node has it, so awaited calls arrive in order
//   report(patch), log(text), complete(data), fail(error)   the job's own state, and its three common forms
//   cycle(job)                         one step's record as the job's app
require('../../script.js');

const PAYLOAD_MAX = spirit.requireScript('spirit/limits/script.js').PAYLOAD_MAX;
const JOB = String(process.env.SPIRIT_JOB_ID || '');
let openJob = null;

function refusal(code, why) { const e = new Error(why); e.code = code; return e; }
function bytesOf(o) { try { return Buffer.byteLength(JSON.stringify(o), 'utf8'); } catch (e) { return -1; } }

function report(patch) {
  if (!JOB) return Promise.reject(refusal('no-job', 'this process was not started by a node as a job (SPIRIT_JOB_ID is unset)'));
  return Promise.resolve(spirit.requireScript('spirit/script.js')).then(function (event) { return event.publish(Object.assign({ id: JOB }, patch)); });
}
function log(message) { return report({ logMessage: message }); }
function complete(data) { return report({ status: 'completed', data: data }); }
function fail(e) { return report({ status: 'failed', data: { error: String(e) } }); }
function publish(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const size = bytesOf(obj);
  if (size < 0) return false;
  const send = function (o) { Promise.resolve(report({ app: o })).catch(function () { /* not started by a node */ }); };
  if (size > PAYLOAD_MAX) {
    process.stderr.write('publish-too-large: ' + size + ' bytes, the limit is ' + PAYLOAD_MAX + '\n');
    send({ dropped: { bytes: size, max: PAYLOAD_MAX } });
    return false;
  }
  send(obj);
  return true;
}
function cycle(job) {
  const one = { job: job };
  const size = bytesOf(one);
  if (size < 0) return Promise.resolve(false);
  if (size > PAYLOAD_MAX) return Promise.resolve(publish(one));
  return report({ app: one }).then(function () { return true; }, function () { return false; });
}
function start(name) {
  if (openJob !== null) return Promise.reject(refusal('job-open', 'a job is open: ' + openJob + '; end it before starting ' + String(name || '')));
  openJob = String(name || '');
  return cycle({ state: 'start', name: openJob });
}
function progress(done, total, text) {
  return cycle({ state: 'progress', name: openJob === null ? '' : openJob, done: Number(done) || 0, total: Number(total) || 0, text: String(text || '') });
}
function end(result) {
  const one = { state: 'end', name: openJob === null ? '' : openJob };
  openJob = null;
  if (result instanceof Error) one.logError = String(result.message || result);
  else if (result !== undefined) one.result = result;
  return cycle(one);
}

module.exports = { report: report, log: log, complete: complete, fail: fail, publish: publish, cycle: cycle, start: start, progress: progress, end: end };
