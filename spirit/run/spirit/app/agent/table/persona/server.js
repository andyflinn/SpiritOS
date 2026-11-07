'use strict';

// spirit/run/spirit/app/agent/table/persona/server.js
// THE PERSONA TABLE (goal/G41.4). Andy, box v22: "a persona table. keyed by ID same as the shadow-roll (with Label and
// Description, and a codeMirror-field for the persona-description i give it with every prompt)": persona is that text.
// SINCE goal/G41.26 a persona names its provider, kept as the job keeps its own (Andy, box: "agent.persona gains a provider
// field"); not mandatory. Its bundle is kept as the job's is.
// No description since goal/G41.21 (Andy: "ALL, drop the description for ALL tables. it does NOTHING AND IS USELESS.").
const { rowTable } = require('../rowTable.js');

module.exports = function (ctx) {
  return rowTable(ctx.db, {
    name: 'persona', fields: { persona: 'text?', bundle: 'text?', provider: 'key?' },
    // goal/G41.21: "# mandatory fields (server AND ui)"; "persona: icon, label".
    required: ['icon', 'label'],
  }, ctx.publish);
};
