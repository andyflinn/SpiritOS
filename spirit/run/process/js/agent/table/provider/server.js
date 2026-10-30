'use strict';

// spirit/run/process/js/agent/table/provider/server.js
// THE PROVIDER TABLE (goal/G41.4): a model provider, its url and its API key. Andy, box v22: "a provider table. keyed by
// ID same as the shadow-roll (with Label and Description, URL, and API_KEY which will never reach the browser or any
// place outside of the agent process except the model providers API)". So apiKey is secret: no answer and no row on the
// stream carries it, only apiKeySet (rowTable.js).
//
// ONE ROW PER URL (goal/G41.18; Andy, box v17: "a new provider row will not be added if the URL is the same as an
// existing URL in the provider table, nor will a change be allowed if the change would result in duplicate URL's,
// trailing slashes don't count as different").
//
// ASK, THE PROVIDER'S MODELS INTO THE MODEL TABLE (goal/G41.18; Andy, box v17: "the provider table gets a new verb:
// \"ask\", which does the model-list fetching and model-table updating"): provider { op: 'ask', id } answers
// { models, updated }. The plugin is the row's label in any case, ../../provider/<name>/<name>.js, and the OpenAI plugin
// for a label no plugin matches. Only a list of more than 0 models updates the table ("only if a provider answers with a
// list of more than 0 models"), adding the new and removing the ones no longer listed ("unavailable models from that
// provider will be removed, also"). A provider that fails is refused and its row flagged unusable ("if it fails, the
// provider row will be flagged as unusable"); a later answer clears the flag.
const fs = require('fs');
const path = require('path');
const { rowTable } = require('../rowTable.js');

const PLUGINS = path.join(__dirname, '..', '..', 'provider');
const FALLBACK = 'openai';

function sameUrl(u) { return String(u || '').replace(/\/+$/, ''); }

function refuse(code, why) { const e = new Error(why); e.refusal = code; e.extra = { why: why }; return e; }

// The plugin of a label: the folder of that name in any case, else the OpenAI plugin. Only a folder holding its own
// <name>/<name>.js counts, so a label never reaches outside the provider folder.
function pluginOf(label) {
  const want = String(label || '').trim().toLowerCase();
  let names = [];
  try { names = fs.readdirSync(PLUGINS); } catch (e) { names = []; }
  const name = names.filter(function (n) { return n.toLowerCase() === want && fs.existsSync(path.join(PLUGINS, n, n + '.js')); })[0] || FALLBACK;
  return require(path.join(PLUGINS, name, name + '.js'));
}

module.exports = function (ctx) {
  const table = rowTable(ctx.db, {
    name: 'provider',
    // goal/G41.21, box v17: "The provider table gains a field, model: the id of one row of the model table, the
    // provider's current model."
    fields: { url: 'url?', apiKey: 'text?', unusable: 'bool?', model: 'key?' },
    secret: ['apiKey'],
    check: function (a, db) {
      if ((a.op !== 'add' && a.op !== 'set') || !a.url) return '';
      const mine = a.op === 'set' ? String(a.id) : '';
      const clash = db.prepare('SELECT id, url FROM "provider"').all().some(function (r) { return r.id !== mine && r.url && sameUrl(r.url) === sameUrl(a.url); });
      return clash ? 'another provider row has the url ' + sameUrl(a.url) : '';
    },
  }, ctx.publish);

  const handler = table.verb.handler;
  table.verb.handler = function (a) {
    if (!a || a.op !== 'ask') return handler(a);
    const bad = spirit.check('provider', { op: 'id', id: 'key' }, a);
    if (bad) throw refuse(bad.code === 'no-such-argument' ? 'no-such-argument' : 'bad-request', bad.message);
    const row = ctx.db.prepare('SELECT * FROM "provider" WHERE id = ?').get(String(a.id));
    if (!row) throw refuse('no-such-row', 'provider has no row ' + a.id);
    const flag = function (on) { handler({ op: 'set', id: row.id, unusable: on }); };
    return Promise.resolve().then(function () { return pluginOf(row.label).models({ url: row.url, apiKey: row.apiKey }); }).then(function (models) {
      if (row.unusable) flag(false);
      if (!models.length) return { models: [], updated: false };
      ctx.tables.model.update(row.id, models);
      return { models: models, updated: true };
    }, function (e) {
      flag(true);
      // The plugin's words say why, and never carry the key (provider/<name>/test).
      throw refuse('provider-failed', String((e && e.message) || e).split(String(row.apiKey || '\u0000')).join('…'));
    });
  };
  return table;
};
