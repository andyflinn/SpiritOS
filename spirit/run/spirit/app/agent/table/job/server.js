'use strict';

// spirit/run/process/js/agent/table/job/server.js
// THE JOB TABLE (goal/G41.4). Andy, box v22: "a job table. keyed by ID same as the shadow-roll (with Label and
// Description, boolean loop-flag (not for the model, for the agent-app), and a codeMirror-field for the job-description
// that may come with a prompt)": loop and job. SINCE goal/G41.21 (box v17) a job names its bundle ("That bundle is the
// job's grant"), its provider and its persona; the grant table, and the delete hook that dropped a job's grants, are gone.
// Enforcing the bundle when a job runs is out of scope (Andy: "oos."): it is stored.
const { rowTable } = require('../rowTable.js');

module.exports = function (ctx) {
  return rowTable(ctx.db, {
    name: 'job',
    fields: { loop: 'bool?', job: 'text?', bundle: 'text?', provider: 'key?', persona: 'key?' },
    // goal/G41.21: "# mandatory fields (server AND ui)"; "job: icon, label".
    required: ['icon', 'label'],
  }, ctx.publish);
};
