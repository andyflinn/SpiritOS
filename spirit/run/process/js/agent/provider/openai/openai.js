'use strict';

// spirit/run/process/js/agent/provider/openai/openai.js
// THE OPENAI PLUGIN (goal/G41.18): the model list of an OpenAI-compatible provider. Andy, box v17: "if a provider row has
// no matching plugin (case-insensitive), the OpenAPI plugin will be used", and "Unsloth will be the test case for
// \"no-matching-plugin\"". So it serves a row labelled OpenAI and every row no other plugin matches.
//
//   models({ url, apiKey }) -> a promise of [{ modelName, label }], both the model's id, in the provider's order
//     url      the provider's base, /v1 included (https://api.openai.com/v1, http://<host>:<port>/v1)
//     apiKey   sent as a bearer; with none, no Authorization header (a local server takes none)
// It asks GET <url>/models. A failed answer is refused, never taken for an empty list, and a refusal never carries the
// key: its words are the status or what went wrong, never the provider's own answer.

function base(url) { return String(url || '').replace(/\/+$/, ''); }

function scrub(text, key) { return key ? String(text).split(String(key)).join('…') : String(text); }

async function models(provider) {
  const p = provider || {};
  const key = p.apiKey ? String(p.apiKey) : '';
  const headers = { accept: 'application/json' };
  if (key) headers.authorization = 'Bearer ' + key;
  let res = null;
  try { res = await fetch(base(p.url) + '/models', { method: 'GET', headers: headers }); } catch (e) {
    throw new Error(scrub('the provider could not be reached: ' + ((e && e.cause && e.cause.code) || (e && e.message) || e), key));
  }
  if (res.status < 200 || res.status > 299) throw new Error('the provider answered ' + res.status);
  let body = null;
  try { body = JSON.parse(await res.text()); } catch (e) { throw new Error('the provider\'s answer is not JSON'); }
  if (!body || !Array.isArray(body.data)) throw new Error('the provider\'s answer has no model list');
  return body.data.filter(function (m) { return m && m.id; }).map(function (m) { return { modelName: String(m.id), label: String(m.id) }; });
}

module.exports = { models: models };
