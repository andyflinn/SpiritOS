'use strict';

// spirit/run/spirit/app/agent/provider/anthropic/test/anthropic.js
// The tests of spirit/app/agent/provider/anthropic/anthropic.js, and of no other module (spec: ./anthropic.md;
// goal/G41.18). The provider is a stand-in on 127.0.0.1 that answers as Anthropic's model list does, a page at a time,
// and keeps every request it was asked; nothing here reaches a real provider. One test.run per test (goal/G47.2).

const fs = require('fs');
const http = require('http');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'anthropic.js');
const KEY = 'sk-ant-api03-test-0123456789';

function standIn() {
  const s = { heard: [], answer: null };
  s.server = http.createServer(function (req, res) {
    s.heard.push({ method: req.method, url: req.url, headers: req.headers });
    const a = s.answer ? s.answer(req) : { status: 404, body: '' };
    res.writeHead(a.status, { 'content-type': 'application/json' });
    res.end(typeof a.body === 'string' ? a.body : JSON.stringify(a.body));
  });
  return new Promise(function (resolve) { s.server.listen(0, '127.0.0.1', function () { s.port = s.server.address().port; resolve(s); }); });
}
async function list(models, provider) {
  try { return { got: await models(provider) }; } catch (e) { return { threw: String((e && e.message) || e) }; }
}
const model = function (id, name) { return { type: 'model', id: id, display_name: name, created_at: '2026-10-01T00:00:00Z' }; };
// Anthropic's list, in two pages: the first says has_more and its last_id, the second is asked after_id that id.
function pages(req) {
  const u = new URL(req.url, 'http://x');
  if (u.pathname !== '/v1/models') return { status: 404, body: '' };
  if (u.searchParams.get('after_id') === 'claude-b') return { status: 200, body: { data: [model('claude-c', 'Claude C')], has_more: false, first_id: 'claude-c', last_id: 'claude-c' } };
  return { status: 200, body: { data: [model('claude-a', 'Claude A'), model('claude-b', 'Claude B')], has_more: true, first_id: 'claude-a', last_id: 'claude-b' } };
}

// What the tests make, for the tests after them.
const X = { plugin: null, s: null, base: '', all: null, h: { headers: {}, url: '' }, denied: null };
test.after(function () { if (X.s && X.s.server.listening) return new Promise(function (r) { X.s.server.close(r); }); });

// ── its file ──
test.run('it is a plugin whose models function answers a provider\'s model list', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { X.plugin = require(FILE); } catch (e) { return false; }
  return X.plugin && typeof X.plugin.models === 'function' ? true : false;
}, test.limit.quick);

// ── it asks GET <url>/v1/models, with its key header and its version header ──
test.run('it sends a GET of /v1/models to a provider at its host', 0.2, async function () {
  if (!X.plugin || typeof X.plugin.models !== 'function') return false;
  const s = X.s = await standIn();
  X.base = 'http://127.0.0.1:' + s.port;
  s.answer = pages;
  X.all = await list(X.plugin.models, { url: X.base, apiKey: KEY });
  const h = X.h = s.heard[0] || { headers: {}, url: '' };
  return h.method === 'GET' && new URL(h.url, 'http://x').pathname === '/v1/models' ? true : false;
}, test.limit.quick);
test.run('the API key goes as x-api-key', 0.2, function () {
  if (!X.s) return false;
  return X.h.headers['x-api-key'] === KEY ? true : false;
}, test.limit.quick);
test.run('the request carries anthropic-version 2023-06-01, a fixed string and no secret', 0.2, function () {
  if (!X.s) return false;
  return X.h.headers['anthropic-version'] === '2023-06-01' ? true : false;
}, test.limit.quick);
test.run('the request carries no Authorization header, so the key goes one way only', 0.2, function () {
  if (!X.s) return false;
  return !('authorization' in X.h.headers) ? true : false;
}, test.limit.quick);

// ── it reads every page ──
test.run('while the answer says has_more, it asks again with after_id set to the last_id', 0.2, function () {
  const s = X.s;
  if (!s) return false;
  return s.heard.length === 2 && new URL(s.heard[1].url, 'http://x').searchParams.get('after_id') === 'claude-b' ? true : false;
}, test.limit.quick);
test.run('it answers every model of every page, in the provider\'s order, with its id as modelName and its display_name as label', 0.2, function () {
  if (!X.s) return false;
  return X.all.got && JSON.stringify(X.all.got) === JSON.stringify([{ modelName: 'claude-a', label: 'Claude A' }, { modelName: 'claude-b', label: 'Claude B' }, { modelName: 'claude-c', label: 'Claude C' }])
    ? true : false;
}, test.limit.quick);

// ── a trailing slash ──
test.run('a url with a trailing slash asks the same path', 0.2, async function () {
  const s = X.s;
  if (!s) return false;
  s.heard.length = 0;
  const slash = await list(X.plugin.models, { url: X.base + '/', apiKey: KEY });
  return s.heard.length >= 1 && new URL(s.heard[0].url, 'http://x').pathname === '/v1/models' && slash.got && slash.got.length === 3 ? true : false;
}, test.limit.quick);

// ── a failed list is refused, and never carries the key ──
test.run('a provider answering 401 is refused', 0.2, async function () {
  if (!X.s) return false;
  X.s.answer = function () { return { status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key ' + KEY } } }; };
  X.denied = await list(X.plugin.models, { url: X.base, apiKey: KEY });
  return X.denied.threw !== undefined ? true : false;
}, test.limit.quick);
// A refusal carrying the key would leak the secret to whoever reads the error.
test.run('the refusal of a 401 does not carry the key, even when the provider echoes it', 0.8, function () {
  if (!X.denied) return false;
  return X.denied.threw !== undefined && X.denied.threw.indexOf(KEY) === -1 ? true : false;
}, test.limit.quick);
test.run('an answer that is not JSON is refused', 0.2, async function () {
  if (!X.s) return false;
  X.s.answer = function () { return { status: 200, body: 'not json' }; };
  return (await list(X.plugin.models, { url: X.base, apiKey: KEY })).threw !== undefined ? true : false;
}, test.limit.quick);
test.run('an answer with no data list is refused', 0.2, async function () {
  if (!X.s) return false;
  X.s.answer = function () { return { status: 200, body: { has_more: false } }; };
  return (await list(X.plugin.models, { url: X.base, apiKey: KEY })).threw !== undefined ? true : false;
}, test.limit.quick);
test.run('an empty list is answered as the empty list', 0.2, async function () {
  if (!X.s) return false;
  X.s.answer = function () { return { status: 200, body: { data: [], has_more: false } }; };
  const empty = await list(X.plugin.models, { url: X.base, apiKey: KEY });
  return empty.got && Array.isArray(empty.got) && empty.got.length === 0 ? true : false;
}, test.limit.quick);
// A page that says has_more and gives no next id would be asked forever: it is refused instead.
test.run('an answer saying has_more with no last_id is refused, not asked again and again', 0.2, async function () {
  const s = X.s;
  if (!s) return false;
  s.heard.length = 0;
  s.answer = function () { return { status: 200, body: { data: [model('claude-a', 'Claude A')], has_more: true } }; };
  const loop = await list(X.plugin.models, { url: X.base, apiKey: KEY });
  return loop.threw !== undefined && s.heard.length < 5 ? true : false;
}, test.limit.quick);
test.run('a provider that cannot be reached is refused', 0.2, async function () {
  if (!X.s) return false;
  await new Promise(function (r) { X.s.server.close(r); });
  return (await list(X.plugin.models, { url: X.base, apiKey: KEY })).threw !== undefined ? true : false;
}, test.limit.quick);
