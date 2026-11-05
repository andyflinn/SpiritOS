'use strict';

// spirit/run/process/js/agent/provider/openai/test/openai.js
// The tests of process/js/agent/provider/openai/openai.js, and of no other module (spec: ./openai.md; goal/G41.18). The
// provider is a stand-in on 127.0.0.1 that answers as an OpenAI-compatible server does and keeps every request it was
// asked; nothing here reaches a real provider.

const fs = require('fs');
const http = require('http');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'openai.js');
const KEY = 'sk-openai-test-0123456789';
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
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

test.startTest('provider/openai/openai.js: the model list of an OpenAI-compatible provider');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  test.subHeading('its file');
  if (!fs.existsSync(FILE)) { test.fail('process/js/agent/provider/openai/openai.js is not there'); return; }
  let plugin = null;
  try { plugin = require(FILE); } catch (e) { test.fail('it does not load: ' + e.message); return; }
  ok(plugin && typeof plugin.models === 'function', 'it is a plugin: models(provider) -> the provider\'s model list', 'exports: ' + short(plugin && Object.keys(plugin)));
  if (!plugin || typeof plugin.models !== 'function') return;
  const s = await standIn();
  const base = 'http://127.0.0.1:' + s.port + '/v1';

  test.subHeading('it asks GET <url>/models, with the key as a bearer');
  s.answer = function (req) {
    return req.url === '/v1/models' ? { status: 200, body: { object: 'list', data: [{ id: 'gpt-a', object: 'model', owned_by: 'x' }, { id: 'gpt-b', object: 'model', owned_by: 'x' }] } } : { status: 404, body: '' };
  };
  const one = await list(plugin.models, { url: base, apiKey: KEY });
  const h = s.heard[0] || { headers: {} };
  ok(s.heard.length === 1 && h.method === 'GET' && h.url === '/v1/models', 'one GET of /v1/models for a provider at <host>/v1', 'heard: ' + short(s.heard.map(function (x) { return x.method + ' ' + x.url; })));
  ok(h.headers.authorization === 'Bearer ' + KEY, 'the API key goes as Authorization: Bearer <key>', 'authorization: ' + short(h.headers.authorization));
  ok(one.got && JSON.stringify(one.got) === JSON.stringify([{ modelName: 'gpt-a', label: 'gpt-a' }, { modelName: 'gpt-b', label: 'gpt-b' }]),
    'it answers each model as { modelName, label }, both the model\'s id, in the provider\'s order', 'answered: ' + short(one));

  test.subHeading('a trailing slash, and a provider with no key');
  s.heard.length = 0;
  const slash = await list(plugin.models, { url: base + '/' });
  ok(s.heard.length === 1 && s.heard[0].url === '/v1/models' && slash.got && slash.got.length === 2, 'a url with a trailing slash asks the same path, no double slash', 'heard: ' + short(s.heard.map(function (x) { return x.url; })));
  // A local server (Unsloth Studio, the box's test case) takes no key: none is sent.
  ok(s.heard[0] && !('authorization' in s.heard[0].headers), 'with no key, no Authorization header is sent', 'headers: ' + short(s.heard[0] && s.heard[0].headers));

  test.subHeading('a failed list is refused, and never carries the key');
  s.answer = function () { return { status: 401, body: { error: { message: 'bad key ' + KEY } } }; };
  const denied = await list(plugin.models, { url: base, apiKey: KEY });
  ok(denied.threw !== undefined, 'a provider answering 401 is refused', 'answered: ' + short(denied));
  ok(denied.threw !== undefined && denied.threw.indexOf(KEY) === -1, 'and the refusal does not carry the key, even when the provider echoes it', 'refusal: ' + short(denied.threw));
  s.answer = function () { return { status: 200, body: 'not json' }; };
  ok((await list(plugin.models, { url: base, apiKey: KEY })).threw !== undefined, 'an answer that is not JSON is refused', 'not json answered');
  s.answer = function () { return { status: 200, body: { object: 'list' } }; };
  ok((await list(plugin.models, { url: base, apiKey: KEY })).threw !== undefined, 'an answer with no data list is refused', 'no data answered');
  s.answer = function () { return { status: 200, body: { object: 'list', data: [] } }; };
  const empty = await list(plugin.models, { url: base, apiKey: KEY });
  ok(empty.got && Array.isArray(empty.got) && empty.got.length === 0, 'an empty list is an answer, the empty list', 'answered: ' + short(empty));
  await new Promise(function (r) { s.server.close(r); });
  const gone = await list(plugin.models, { url: base, apiKey: KEY });
  ok(gone.threw !== undefined, 'a provider that cannot be reached is refused', 'answered: ' + short(gone));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
