'use strict';

// spirit/run/process/js/agent/table/model/server.js
// THE MODEL TABLE (goal/G41.4): one model of one provider. Andy, box v22: "a model table, keyed by ID same as the
// shadow-roll (with Label and Description, provider-key, and model-name and capabilities)". providerId is a provider
// row's id, and a model naming a provider that is not there is refused; capabilities is a list, kept as JSON.
const { rowTable } = require('../rowTable.js');

module.exports = function (ctx) {
  return rowTable(ctx.db, {
    name: 'model',
    fields: { providerId: 'key?', modelName: 'text?', capabilities: 'list?' },
    check: function (a) { return a.providerId !== undefined && !ctx.tables.provider.has(a.providerId) ? 'no provider ' + a.providerId : ''; },
  }, ctx.publish);
};
