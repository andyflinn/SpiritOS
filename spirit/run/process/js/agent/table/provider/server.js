'use strict';

// spirit/run/process/js/agent/table/provider/server.js
// THE PROVIDER TABLE (goal/G41.4): a model provider, its url and its API key. Andy, box v22: "a provider table. keyed by
// ID same as the shadow-roll (with Label and Description, URL, and API_KEY which will never reach the browser or any
// place outside of the agent process except the model providers API)". So apiKey is secret: no answer and no row on the
// stream carries it, only apiKeySet (rowTable.js).
const { rowTable } = require('../rowTable.js');

module.exports = function (ctx) {
  return rowTable(ctx.db, { name: 'provider', fields: { url: 'url?', apiKey: 'text?' }, secret: ['apiKey'] }, ctx.publish);
};
