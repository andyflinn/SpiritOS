'use strict';

// spirit/run/process/js/agent/provider/anthropic/anthropic.js
// THE ANTHROPIC PLUGIN (goal/G41.18): Anthropic's model list. Andy, box v17: "built in this item - OpenAI plugin -
// Anthropic plugin"; a provider row labelled Anthropic, in any case, uses it.
//
//   models({ url, apiKey }) -> a promise of [{ modelName: id, label: display_name }], every page, in the provider's order
//     url      the provider's host, https://api.anthropic.com
//     apiKey   sent as x-api-key and as nothing else, with the fixed anthropic-version header (no secret)
// It asks GET <url>/v1/models, and again with after_id while an answer says has_more. A failed answer is refused, never
// taken for an empty list, and a refusal never carries the key.

const VERSION = '2023-06-01';
// Every page is given up inside the node's own wait for the agent (appClient's DOOR_WAIT_MS, 12 s): the whole list,
// so each page has its share of it.
const WAIT_MS = 10000;

function base(url) { return String(url || '').replace(/\/+$/, ''); }

function scrub(text, key) { return key ? String(text).split(String(key)).join('…') : String(text); }

async function page(url, key, until) {
  const headers = { accept: 'application/json', 'anthropic-version': VERSION };
  if (key) headers['x-api-key'] = key;
  let res = null;
  const left = until - Date.now();
  if (left <= 0) throw new Error('the provider did not answer within ' + (WAIT_MS / 1000) + ' seconds');
  try { res = await fetch(url, { method: 'GET', headers: headers, signal: AbortSignal.timeout(left) }); } catch (e) {
    if (e && e.name === 'TimeoutError') throw new Error('the provider did not answer within ' + (WAIT_MS / 1000) + ' seconds');
    throw new Error(scrub('the provider could not be reached: ' + ((e && e.cause && e.cause.code) || (e && e.message) || e), key));
  }
  if (res.status < 200 || res.status > 299) throw new Error('the provider answered ' + res.status);
  let body = null;
  try { body = JSON.parse(await res.text()); } catch (e) { throw new Error('the provider\'s answer is not JSON'); }
  if (!body || !Array.isArray(body.data)) throw new Error('the provider\'s answer has no model list');
  return body;
}

async function models(provider) {
  const p = provider || {};
  const key = p.apiKey ? String(p.apiKey) : '';
  const out = [];
  let after = '';
  const until = Date.now() + WAIT_MS;
  for (;;) {
    const body = await page(base(p.url) + '/v1/models' + (after ? '?after_id=' + encodeURIComponent(after) : ''), key, until);
    body.data.forEach(function (m) { if (m && m.id) out.push({ modelName: String(m.id), label: String(m.display_name || m.id) }); });
    if (body.has_more !== true) return out;
    // A further page with nothing to ask it from is refused, not asked for again and again.
    if (!body.last_id) throw new Error('the provider said there is more, and not where it starts');
    after = String(body.last_id);
  }
}

module.exports = { models: models };
