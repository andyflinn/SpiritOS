'use strict';

// spirit/run/process/js/agent/table/job/server.js
// THE JOB TABLE (goal/G41.4). Andy, box v22: "a job table. keyed by ID same as the shadow-roll (with Label and
// Description, boolean loop-flag (not for the model, for the agent-app), and a codeMirror-field for the job-description
// that may come with a prompt)": loop and job. A job's grants are keyed by its id (the grant table), so a job deleted
// takes its grants with it.
const { rowTable } = require('../rowTable.js');

module.exports = function (ctx) {
  return rowTable(ctx.db, {
    name: 'job',
    fields: { loop: 'bool?', job: 'text?' },
    deleted: function (id) { if (ctx.tables.grant) ctx.tables.grant.dropJob(id); },
  }, ctx.publish);
};
