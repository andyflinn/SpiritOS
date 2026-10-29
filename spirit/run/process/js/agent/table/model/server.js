'use strict';

// spirit/run/process/js/agent/table/model/server.js
// THE MODEL TABLE (goal/G41.4): one model of one provider. Andy, box v22: "a model table, keyed by ID same as the
// shadow-roll (with Label and Description, provider-key, and model-name and capabilities)". providerId is a provider
// row's id, and a model naming a provider that is not there is refused; capabilities is a list, kept as JSON.
//
// A MODEL IS SHOWN WITH ITS PROVIDER'S ICON (goal/G41.18; Andy, box v17: "the model will [icon] \"model-name\", where the
// [icon] will be the provider-icon, associated with the provider-key on the model row"): every row shown carries
// providerIcon, said by the server and kept nowhere, so the list draws only what the server sends (rule/19).
//
// update(providerId, models): the provider table's ask (../provider/server.js) puts a provider's list here: a model not
// yet there is added, with the provider's name of it as label; one no longer listed is removed; one still listed keeps
// its row as he set it. Another provider's models are not touched. Every change goes through the verb, so it is published.
const { rowTable } = require('../rowTable.js');

module.exports = function (ctx) {
  const table = rowTable(ctx.db, {
    name: 'model',
    fields: { providerId: 'key?', modelName: 'text?', capabilities: 'list?' },
    check: function (a) { return a.providerId !== undefined && !ctx.tables.provider.has(a.providerId) ? 'no provider ' + a.providerId : ''; },
    shows: function (row) { return { providerIcon: row.providerId ? ctx.tables.provider.icon(row.providerId) : '' }; },
  }, ctx.publish);

  table.update = function (providerId, models) {
    const pid = String(providerId);
    const have = ctx.db.prepare('SELECT id, modelName FROM "model" WHERE providerId = ?').all(pid);
    const listed = {};
    models.forEach(function (m) { listed[String(m.modelName)] = m; });
    const known = {};
    have.forEach(function (r) {
      known[r.modelName] = true;
      if (!listed[r.modelName]) table.verb.handler({ op: 'delete', id: r.id });
    });
    models.forEach(function (m) {
      const name = String(m.modelName);
      if (known[name]) return;
      known[name] = true;
      table.verb.handler({ op: 'add', providerId: pid, modelName: name, label: String(m.label || name) });
    });
  };
  return table;
};
