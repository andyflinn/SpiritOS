'use strict';
require('../../../../script.js');

// spirit/run/spirit/app/agent/table/model/server.js
// THE MODEL TABLE (goal/G41.4): one model of one provider. Andy, box v22: "a model table, keyed by ID same as the
// shadow-roll (with Label and Description, provider-key, and model-name and capabilities)". providerId is a provider
// row's id, and a model naming a provider that is not there is refused; capabilities is a list in JSON, kept as it comes.
// SINCE goal/G41.21 THE LABEL IS THE MODEL NAME (Andy: "i decided that model, does NOT need a name field, which i also
// NEVER FUCKING ASKED FOR, and the label hold the model name as provided by the provider, and is output only in the
// models UI."): no modelName column, and a model the provider lists is labelled with its name, never its display name.
// No description since goal/G41.21 (Andy: "ALL, drop the description for ALL tables. it does NOTHING AND IS USELESS.").
//
// A MODEL IS SHOWN WITH ITS PROVIDER'S ICON (goal/G41.18; Andy, box v17: "the model will [icon] \"model-name\", where the
// [icon] will be the provider-icon, associated with the provider-key on the model row"): every row shown carries
// providerIcon, said by the server and kept nowhere, so the list draws only what the server sends (rule/19).
//
// update(providerId, models): the provider table's ask (../provider/server.js) puts a provider's list here: a model not
// yet there is added, labelled with its model name as the provider gives it; one no longer listed is removed; one still
// listed keeps its row. Another provider's models are not touched. Every change goes through the verb, so it is published.
const { rowTable } = spirit.requireScript('spirit/app/agent/table/rowTable.js');

// The capabilities, a list of strings in JSON (goal/G48.4, Q6, Andy: lists are "spirit.type.string.json").
function listOfWords(json) {
  let v = null;
  try { v = JSON.parse(json); } catch (e) { return false; }
  return Array.isArray(v) && v.every(function (w) { return typeof w === 'string'; });
}

module.exports = function (ctx) {
  const table = rowTable(ctx.db, {
    name: 'model',
    fields: { providerId: 'key?', capabilities: 'spirit.type.string.json?' },
    check: function (a) {
      if (a.providerId !== undefined && !ctx.tables.provider.has(a.providerId)) return 'no provider ' + a.providerId;
      return a.capabilities !== undefined && !listOfWords(a.capabilities) ? 'capabilities is a list of words in JSON, such as ["text","tools"]' : '';
    },
    shows: function (row) { return { providerIcon: row.providerId ? ctx.tables.provider.icon(row.providerId) : '' }; },
    // Its list shows the provider's icon and the label, the model name (./elementTable.js), so a search answers those.
    listed: ['providerIcon', 'label'],
  }, ctx.publish);

  table.update = function (providerId, models) {
    const pid = String(providerId);
    const have = ctx.db.prepare('SELECT id, label FROM "model" WHERE providerId = ?').all(pid);
    const listed = {};
    models.forEach(function (m) { listed[String(m.modelName)] = m; });
    const known = {};
    have.forEach(function (r) {
      known[r.label] = true;
      if (!listed[r.label]) table.verb.handler({ op: 'delete', id: r.id });
    });
    models.forEach(function (m) {
      const name = String(m.modelName);
      if (known[name]) return;
      known[name] = true;
      table.verb.handler({ op: 'add', providerId: pid, label: name });
    });
  };
  return table;
};
