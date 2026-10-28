'use strict';

// spirit/run/process/js/agent/table/grant/server.js
// THE GRANT TABLE (goal/G41.4). Andy, box v22: "an grant/auth table, keyed by job-ID, structured exactly like the auth
// table in node", and why: "the jobs have their api requirements on the node. they are my ultimate target, agent-persona
// or underlying models may be subject to whim and experimentation". So a job holds grants as a peer does in node:
// (job_id, path), one row per grant, through the one interface to such a table (spirit/authTableInterface.js).
//
// THE VERB IS FLAT, AS THE OTHER TABLES' (rowTable.js): grant {op, ...}
//   add {job_id, path}      gives that job that path; answers { job_id, path }
//   delete {job_id, path}   takes that grant away; answers { job_id, path }
//   get {job_id}            that job's paths; answers { job_id, paths }
//   search {text}           the grants ranked against the words, cut to one answer; answers { items, more }, each
//                           { job_id, job (its label), path, icon (the job's), label (the job: the path) }
// A grant names a job that is there. Every change is published as { agent: { table: 'grant', row } }, removed on a delete.
const path = require('path');
const RUN = path.resolve(__dirname, '../../../../..');
const auth = require(path.join(RUN, 'spirit', 'authTableInterface.js'));
const { createProbabilityBucket } = require(path.join(RUN, 'spirit', 'probabilityBucket.js'));
const { probabilityStringObjectMatch } = require(path.join(RUN, 'spirit', 'probabilityStringObjectMatch.js'));
const limits = require(path.join(RUN, 'spirit', 'limits.js'));

const SEARCH_ROOM = limits.ANSWER_MAX - Buffer.byteLength(JSON.stringify({ items: [], more: false }), 'utf8');
function refuse(code, why) { const e = new Error(why); e.refusal = code; e.extra = { why: why }; return e; }

module.exports = function (ctx) {
  const grants = auth.open(ctx.dbFile, 'grant', 'job_id');
  const byOp = {
    add: { op: 'id', job_id: 'key', path: 'id' },
    delete: { op: 'id', job_id: 'key', path: 'id' },
    get: { op: 'id', job_id: 'key' },
    search: { op: 'id', text: 'text?' },
  };
  const verb = {
    request: { op: '' }, reply: {},
    accepts: function (a) { return !!a && typeof a === 'object' && !Array.isArray(a); },
    handler: function (a) {
      const spec = byOp[a.op];
      if (!spec) throw refuse('bad-request', 'grant: op is one of ' + Object.keys(byOp).join(', '));
      const bad = spirit.check('grant', spec, a);
      if (bad) throw refuse(bad.code === 'no-such-argument' ? 'no-such-argument' : 'bad-request', bad.message);
      if (a.op === 'add') {
        if (!ctx.tables.job.has(a.job_id)) throw refuse('no-such-row', 'job has no row ' + a.job_id);
        grants.grant(a.job_id, a.path);
        ctx.publish({ agent: { table: 'grant', row: { job_id: a.job_id, path: a.path } } });
        return { job_id: a.job_id, path: a.path };
      }
      if (a.op === 'delete') {
        if (!grants.revoke(a.job_id, a.path)) throw refuse('no-such-row', 'job ' + a.job_id + ' holds no grant ' + a.path);
        ctx.publish({ agent: { table: 'grant', row: { job_id: a.job_id, path: a.path }, removed: true } });
        return { job_id: a.job_id, path: a.path };
      }
      if (a.op === 'get') return { job_id: a.job_id, paths: grants.paths(a.job_id) };
      const words = String(a.text || '').trim();
      const bucket = createProbabilityBucket(Infinity);
      let n = 0;
      grants.all().forEach(function (g) {
        // The job's label and icon ride with the grant, so a list shows it as every list shows a row, its icon and its
        // label: the job's icon, and the job with the path.
        const job = ctx.tables.job.label(g.key);
        const row = { job_id: g.key, job: job, path: g.path, icon: ctx.tables.job.icon(g.key), label: (job || g.key) + ': ' + g.path };
        const score = words ? Number(probabilityStringObjectMatch(words, { job: row.job, path: g.path.split('.').join(' ') })) || 0 : 1;
        n += 1;
        if (score > 0) bucket.seatFor(score * (1 - 1e-9) + 1e-9 / (1 + n), { key: g.key + '|' + g.path, label: JSON.stringify(row) });
      });
      const r = bucket.serialize(null, SEARCH_ROOM);
      return { items: r.items, more: !!r.more };
    },
  };
  // A job deleted takes its grants with it (job/server.js).
  function dropJob(id) {
    grants.paths(id).forEach(function (p) {
      grants.revoke(id, p);
      ctx.publish({ agent: { table: 'grant', row: { job_id: id, path: p }, removed: true } });
    });
  }
  return { verb: verb, dropJob: dropJob };
};
