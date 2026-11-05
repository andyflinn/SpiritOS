'use strict';

// spirit/run/process/js/agent/provider/anthropic/test/anthropic.js
// The tests of process/js/agent/provider/anthropic/anthropic.js, and of no other module (spec: ./anthropic.md;
// goal/G41.18). The provider is a stand-in on 127.0.0.1 that answers as Anthropic's model list does, a page at a time,
// and keeps every request it was asked; nothing here reaches a real provider.

const fs = require('fs');
const http = require('http');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'anthropic.js');
const KEY = 'sk-ant-api03-test-0123456789';
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

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

test.startTest('provider/anthropic/anthropic.js: the model list of Anthropic');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  test.subHeading('its file');
  if (!fs.existsSync(FILE)) { test.fail('process/js/agent/provider/anthropic/anthropic.js is not there'); return; }
  let plugin = null;
  try { plugin = require(FILE); } catch (e) { test.fail('it does not load: ' + e.message); return; }
  ok(plugin && typeof plugin.models === 'function', 'it is a plugin: models(provider) -> the provider\'s model list', 'exports: ' + short(plugin && Object.keys(plugin)));
  if (!plugin || typeof plugin.models !== 'function') return;
  const s = await standIn();
  const base = 'http://127.0.0.1:' + s.port;

  test.subHeading('it asks GET <url>/v1/models, with its key header and its version header');
  s.answer = pages;
  const all = await list(plugin.models, { url: base, apiKey: KEY });
  const h = s.heard[0] || { headers: {}, url: '' };
  ok(h.method === 'GET' && new URL(h.url, 'http://x').pathname === '/v1/models', 'a GET of /v1/models for a provider at its host', 'heard: ' + short(s.heard.map(function (x) { return x.method + ' ' + x.url; })));
  ok(h.headers['x-api-key'] === KEY, 'the API key goes as x-api-key', 'x-api-key: ' + short(h.headers['x-api-key']));
  ok(h.headers['anthropic-version'] === '2023-06-01', 'with anthropic-version: 2023-06-01, a fixed string and no secret', 'anthropic-version: ' + short(h.headers['anthropic-version']));
  ok(!('authorization' in h.headers), 'and no Authorization header: the key goes one way only', 'authorization: ' + short(h.headers.authorization));

  test.subHeading('it reads every page');
  ok(s.heard.length === 2 && new URL(s.heard[1].url, 'http://x').searchParams.get('after_id') === 'claude-b', 'while the answer has_more, it asks again after_id the last_id', 'heard: ' + short(s.heard.map(function (x) { return x.url; })));
  ok(all.got && JSON.stringify(all.got) === JSON.stringify([{ modelName: 'claude-a', label: 'Claude A' }, { modelName: 'claude-b', label: 'Claude B' }, { modelName: 'claude-c', label: 'Claude C' }]),
    'it answers every model of every page as { modelName: id, label: display_name }, in the provider\'s order', 'answered: ' + short(all));

  test.subHeading('a trailing slash');
  s.heard.length = 0;
  const slash = await list(plugin.models, { url: base + '/', apiKey: KEY });
  ok(s.heard.length >= 1 && new URL(s.heard[0].url, 'http://x').pathname === '/v1/models' && slash.got && slash.got.length === 3, 'a url with a trailing slash asks the same path', 'heard: ' + short(s.heard.map(function (x) { return x.url; })));

  test.subHeading('a failed list is refused, and never carries the key');
  s.answer = function () { return { status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key ' + KEY } } }; };
  const denied = await list(plugin.models, { url: base, apiKey: KEY });
  ok(denied.threw !== undefined, 'a provider answering 401 is refused', 'answered: ' + short(denied));
  ok(denied.threw !== undefined && denied.threw.indexOf(KEY) === -1, 'and the refusal does not carry the key, even when the provider echoes it', 'refusal: ' + short(denied.threw));
  s.answer = function () { return { status: 200, body: 'not json' }; };
  ok((await list(plugin.models, { url: base, apiKey: KEY })).threw !== undefined, 'an answer that is not JSON is refused', 'not json answered');
  s.answer = function () { return { status: 200, body: { has_more: false } }; };
  ok((await list(plugin.models, { url: base, apiKey: KEY })).threw !== undefined, 'an answer with no data list is refused', 'no data answered');
  s.answer = function () { return { status: 200, body: { data: [], has_more: false } }; };
  const empty = await list(plugin.models, { url: base, apiKey: KEY });
  ok(empty.got && Array.isArray(empty.got) && empty.got.length === 0, 'an empty list is an answer, the empty list', 'answered: ' + short(empty));
  // A page that says has_more and gives no next id would be asked forever: it is refused instead.
  s.heard.length = 0;
  s.answer = function () { return { status: 200, body: { data: [model('claude-a', 'Claude A')], has_more: true } }; };
  const loop = await list(plugin.models, { url: base, apiKey: KEY });
  ok(loop.threw !== undefined && s.heard.length < 5, 'has_more with no last_id is refused, not asked again and again', 'answered ' + short(loop) + ', asked ' + s.heard.length + ' times');
  await new Promise(function (r) { s.server.close(r); });
  ok((await list(plugin.models, { url: base, apiKey: KEY })).threw !== undefined, 'a provider that cannot be reached is refused', 'unreachable answered');
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
