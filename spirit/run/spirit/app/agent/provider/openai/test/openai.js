'use strict';

// spirit/run/spirit/app/agent/provider/openai/test/openai.js
// The tests of spirit/app/agent/provider/openai/openai.js, and of no other module (spec: ./openai.md; goal/G41.18). The
// provider is a stand-in on 127.0.0.1 that answers as an OpenAI-compatible server does and keeps every request it was
// asked; nothing here reaches a real provider.

const fs = require('fs');
const http = require('http');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'openai.js');
const KEY = 'sk-openai-test-0123456789';
// One test.run per test (goal/G47.2).
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// The stand-in: answer(req) -> { status, body } decides each reply; heard keeps { method, url, headers }.
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
// What a model list call answers, or the refusal it threw, its words kept.
async function list(models, provider) {
  try { return { got: await models(provider) }; } catch (e) { return { threw: String((e && e.message) || e) }; }
}

// What the tests make, for the tests after them.
const X = { plugin: null, s: null, base: '', one: null, h: { headers: {} }, denied: null };
const NO_PLUGIN = 'no plugin: it did not load';
const NO_STANDIN = 'no stand-in provider: it was not started';
test.after(function () { if (X.s && X.s.server.listening) return new Promise(function (r) { X.s.server.close(r); }); });

// ── its file ──
test.run('it is a plugin: models(provider) -> the provider\'s model list', 0.2, function () {
  if (!fs.existsSync(FILE)) return 'spirit/app/agent/provider/openai/openai.js is not there';
  try { X.plugin = require(FILE); } catch (e) { return 'it does not load: ' + e.message; }
  return X.plugin && typeof X.plugin.models === 'function' ? true : 'exports: ' + short(X.plugin && Object.keys(X.plugin));
}, 1000);

// ── it asks GET <url>/models, with the key as a bearer ──
test.run('one GET of /v1/models for a provider at <host>/v1', 0.2, async function () {
  if (!X.plugin || typeof X.plugin.models !== 'function') return NO_PLUGIN;
  const s = X.s = await standIn();
  X.base = 'http://127.0.0.1:' + s.port + '/v1';
  s.answer = function (req) {
    return req.url === '/v1/models' ? { status: 200, body: { object: 'list', data: [{ id: 'gpt-a', object: 'model', owned_by: 'x' }, { id: 'gpt-b', object: 'model', owned_by: 'x' }] } } : { status: 404, body: '' };
  };
  X.one = await list(X.plugin.models, { url: X.base, apiKey: KEY });
  const h = X.h = s.heard[0] || { headers: {} };
  return s.heard.length === 1 && h.method === 'GET' && h.url === '/v1/models' ? true : 'heard: ' + short(s.heard.map(function (x) { return x.method + ' ' + x.url; }));
}, 1000);
test.run('the API key goes as Authorization: Bearer <key>', 0.2, function () {
  if (!X.s) return NO_STANDIN;
  return X.h.headers.authorization === 'Bearer ' + KEY ? true : 'authorization: ' + short(X.h.headers.authorization);
}, 1000);
test.run('it answers each model as { modelName, label }, both the model\'s id, in the provider\'s order', 0.2, function () {
  if (!X.s) return NO_STANDIN;
  return X.one.got && JSON.stringify(X.one.got) === JSON.stringify([{ modelName: 'gpt-a', label: 'gpt-a' }, { modelName: 'gpt-b', label: 'gpt-b' }]) ? true : 'answered: ' + short(X.one);
}, 1000);

// ── a trailing slash, and a provider with no key ──
test.run('a url with a trailing slash asks the same path, no double slash', 0.2, async function () {
  const s = X.s;
  if (!s) return NO_STANDIN;
  s.heard.length = 0;
  const slash = await list(X.plugin.models, { url: X.base + '/' });
  return s.heard.length === 1 && s.heard[0].url === '/v1/models' && slash.got && slash.got.length === 2 ? true : 'heard: ' + short(s.heard.map(function (x) { return x.url; }));
}, 1000);
// A local server (Unsloth Studio, the box's test case) takes no key: none is sent.
test.run('with no key, no Authorization header is sent', 0.2, function () {
  const s = X.s;
  if (!s) return NO_STANDIN;
  return s.heard[0] && !('authorization' in s.heard[0].headers) ? true : 'headers: ' + short(s.heard[0] && s.heard[0].headers);
}, 1000);

// ── a failed list is refused, and never carries the key ──
test.run('a provider answering 401 is refused', 0.2, async function () {
  if (!X.s) return NO_STANDIN;
  X.s.answer = function () { return { status: 401, body: { error: { message: 'bad key ' + KEY } } }; };
  X.denied = await list(X.plugin.models, { url: X.base, apiKey: KEY });
  return X.denied.threw !== undefined ? true : 'answered: ' + short(X.denied);
}, 1000);
// A refusal carrying the key would leak the secret to whoever reads the error.
test.run('and the refusal does not carry the key, even when the provider echoes it', 0.8, function () {
  if (!X.denied) return NO_STANDIN;
  return X.denied.threw !== undefined && X.denied.threw.indexOf(KEY) === -1 ? true : 'refusal: ' + short(X.denied.threw);
}, 1000);
test.run('an answer that is not JSON is refused', 0.2, async function () {
  if (!X.s) return NO_STANDIN;
  X.s.answer = function () { return { status: 200, body: 'not json' }; };
  return (await list(X.plugin.models, { url: X.base, apiKey: KEY })).threw !== undefined ? true : 'not json answered';
}, 1000);
test.run('an answer with no data list is refused', 0.2, async function () {
  if (!X.s) return NO_STANDIN;
  X.s.answer = function () { return { status: 200, body: { object: 'list' } }; };
  return (await list(X.plugin.models, { url: X.base, apiKey: KEY })).threw !== undefined ? true : 'no data answered';
}, 1000);
test.run('an empty list is an answer, the empty list', 0.2, async function () {
  if (!X.s) return NO_STANDIN;
  X.s.answer = function () { return { status: 200, body: { object: 'list', data: [] } }; };
  const empty = await list(X.plugin.models, { url: X.base, apiKey: KEY });
  return empty.got && Array.isArray(empty.got) && empty.got.length === 0 ? true : 'answered: ' + short(empty);
}, 1000);
test.run('a provider that cannot be reached is refused', 0.2, async function () {
  if (!X.s) return NO_STANDIN;
  await new Promise(function (r) { X.s.server.close(r); });
  const gone = await list(X.plugin.models, { url: X.base, apiKey: KEY });
  return gone.threw !== undefined ? true : 'answered: ' + short(gone);
}, 1000);
