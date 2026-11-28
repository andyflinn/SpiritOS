'use strict';
// spirit/run/spirit/job/server/script.js
// THE spirit.job BRANCH'S NODE WORK (goal/G49.25, Q5; Andy: "WHY THE FUCK WOULD IT NOT???" to "Does a branch's node work live at
// spirit/<branch>/server/script.js, handing its verbs' answers to the scan"): the answers the node server held until this item,
// moved whole. serveCommon's scan mounts them under spirit.job, each call checked against spirit/job/script.js first.
//
//   verbs(node) -> { <verb>: { reply, handler } }; node is what the node server hands every branch (spirit/server/script.js,
//                  branchNode): here its job table, its body reader and its refusals. A relay keeps no jobs: none there.
//
// THE LOCAL WAY TO A SERVER PROCESS (the jobs api verb) STOOD HERE until goal/G30.6. Andy, 2026-10-20: "jobs is for launching and
// tracking appServer processes and other local (transient) processes, it is NOT meant to be some kind of api-hub." LOCAL: a job is
// this machine's, whether or not anything is reachable.
require('../../script.js');

function verbs(node) {
  if (spirit.IS_RELAY) return {};
  const jobs = node.jobs;
  const readJsonBody = node.readJsonBody;
  const bodyRefused = node.bodyRefused;
  function json(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
  }
  function notFound(res, text) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(text);
  }
  return {
    'search': { reply: node.LIST, handler: node.proxyVerb(function (b) { return node.nodeSearches.jobsSearch(b); }) },
    'get': { reply: { ok: true, key: '', job: node.JOB }, handler: node.proxyVerb(function (b) { return node.nodeSearches.jobsGet(b); }) },
    'create': { reply: node.JOB, handler: function (req, res) {
      readJsonBody(req).then(function (body) {
        // The script's manifest decides: a one-shot, or a user-operated server (processes/G1.3, jobs.startJob). No opt-in to
        // cleaning up (goal/G29.16): every transient job removes itself when it ends, unless it failed.
        // ITS ARGS A JSON LIST IN A STRING (goal/G48.4, Q6, Andy: lists are "spirit.type.string.json").
        let args = [];
        try { args = body.args ? JSON.parse(String(body.args)) : []; } catch (e) { args = null; }
        if (!Array.isArray(args) || !args.every(function (x) { return typeof x === 'string'; })) {
          json(res, 400, { ok: false, code: 'bad-request', error: 'args is a JSON list of strings' });
          return;
        }
        let job = null;
        try { job = jobs.startJob(body.command, args, { type: body.type }); }
        catch (e) {
          // A process this node does not include is refused by name (slim/G1.3).
          if (e && (e.refusal === 'process-not-included' || e.refusal === 'not-a-process' || e.refusal === 'already-running')) {
            const known = spirit.requireScript('spirit/error/script.js').byCode(e.refusal);
            json(res, known.status, { ok: false, code: e.refusal, error: known.text, process: e.process });
            return;
          }
          throw e;
        }
        json(res, 201, job);
      }).catch(function (e) { bodyRefused(req, res, e); });
    } },
    // The id is a field, beside the verb.
    'cancel': { reply: node.JOB, handler: function (req, res) {
      return readJsonBody(req).then(function (body) {
        const job = jobs.cancelJob(String((body && body.id) || ''));
        if (!job) { notFound(res, 'Not found'); return; }
        json(res, 200, job);
      }).catch(function (e) { bodyRefused(req, res, e); });
    } },
    // 204, no body.
    'delete': { reply: {}, handler: function (req, res) {
      return readJsonBody(req).then(function (body) {
        if (!jobs.deleteJob(String((body && body.id) || ''))) { notFound(res, 'Not found, or job is not yet in a terminal state'); return; }
        res.writeHead(204);
        res.end();
      }).catch(function (e) { bodyRefused(req, res, e); });
    } },
  };
}

// What it hands out: an object holding its function (goal/G49.16; Andy: "A FUNCTION MUST ALWAYS BE INSTALLED INSIDE A CONTAINING OBJECT. PERIOD!").
module.exports = { verbs: verbs };
