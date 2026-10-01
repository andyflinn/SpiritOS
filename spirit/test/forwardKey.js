'use strict';

// apiAuth/G1.13: the door forwards the caller's verified key to the server. Red on today's code.
//   Andy: "ok, the verified key is forwarded to the appServer. i revise my ruling.", "it doesn't violate: "the
//   node knows nothing about what apps do, or what apps packages contain."", and "agreed." to the shape.
// The contract the builder follows (G1.13's box):
//   - pipeRequest(pipe, method, path, body, opts) sends opts.headers with the request.
//   - appClient.ask(body, caller): caller { key } sets X-Spirit-Caller: <key>; caller { owner: true } sets
//     X-Spirit-Owner: 1. The body stays the app's ask, untouched.
//   - appServer hands every handler a second argument: { key } from X-Spirit-Caller, { owner: true } from
//     X-Spirit-Owner, nothing when neither came; a handler that takes (args) alone is unchanged.
//   - apiDoor.answer passes the caller on: a member's ask goes to servers.ask(ask, { key }), the owner's (jobs.api,
//     puppeteering) to servers.ask(ask, { owner: true }).
//   Not here yet: how desk turns that caller into a writer (G1.13's box, open, team meeting).

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const { pipeRequest } = require('../run/js/relayRequest.js');
const apiDoor = require('../run/js/apiDoor.js');

const OWED = 'OWED by apiAuth/G1.13: ';
const KEY = 'MCowBQYDK2VwAyEAforwardKeyTestPeerAAAAAAAAAAAAAAAAAAA=';
const APPSERVER = path.join(__dirname, '..', 'run', 'js', 'appServer.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test.startTest('apiAuth/G1.13: the caller\'s verified key reaches the server, out of band');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-fwdkey-'));
const kids = [];
const servers = [];

function pipeFor(name) {
  const p = appClient.pipePathFor(scratch, name, process.platform, 'process');
  if (process.platform !== 'win32') fs.mkdirSync(path.dirname(p), { recursive: true });
  return p;
}

(async function () {
  test.subHeading('pipeRequest and appClient.ask carry the caller as a header');
  const seen = [];
  const capPipe = pipeFor('capture');
  const cap = http.createServer(function (req, res) {
    let body = '';
    req.on('data', function (c) { body += c; });
    req.on('end', function () {
      seen.push({ headers: req.headers, body: body });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  });
  servers.push(cap);
  await new Promise(function (r) { cap.listen(capPipe, r); });

  await pipeRequest(capPipe, 'POST', '/', '{}', { type: 'application/json', headers: { 'X-Test': 'yes' } });
  if (seen[0] && seen[0].headers['x-test'] === 'yes') test.check('pipeRequest sends opts.headers');
  else test.fail(OWED + 'pipeRequest dropped opts.headers: ' + JSON.stringify(seen[0] && seen[0].headers).slice(0, 160));

  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('capture', capPipe);
  seen.length = 0;
  await client.ask({ capture: { ping: {} } }, { key: KEY });
  await client.ask({ capture: { ping: {} } }, { owner: true });
  const m = seen[0] || { headers: {} };
  const o = seen[1] || { headers: {} };
  if (m.headers['x-spirit-caller'] === KEY && !m.headers['x-spirit-owner'] && o.headers['x-spirit-owner'] === '1' && !o.headers['x-spirit-caller'] &&
      m.body === JSON.stringify({ ping: {} })) {
    test.check('ask(body, {key}) sends X-Spirit-Caller, ask(body, {owner: true}) X-Spirit-Owner: 1, and the body is the ask alone');
  } else test.fail(OWED + 'appClient.ask sent ' + JSON.stringify(seen.map(function (s) { return { caller: s.headers['x-spirit-caller'], owner: s.headers['x-spirit-owner'], body: s.body }; })).slice(0, 220));

  test.subHeading('appServer hands the handler the caller as its second argument');
  const echo = path.join(scratch, 'echoCaller.js');
  fs.writeFileSync(echo, 'require(' + JSON.stringify(APPSERVER) + ').serve({ who: { request: {}, reply: { who: "" }, handler: function (a, caller) {\n' +
    '  return { who: caller && caller.key ? "key:" + caller.key : caller && caller.owner === true ? "owner" : "none" }; } } });\n');
  const echoPipe = pipeFor('echoCaller');
  const kid = spawn(process.execPath, [echo, '--pipe', echoPipe], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  kids.push(kid);
  for (let i = 0; i < 40; i++) {
    const r = await pipeRequest(echoPipe, 'POST', '/', '"api"', { type: 'application/json', timeoutMs: 1000 }).catch(function () { return null; });
    if (r && r.status === 200) break;
    await sleep(150);
  }
  const ask = function (headers) {
    return pipeRequest(echoPipe, 'POST', '/', JSON.stringify({ who: {} }), { type: 'application/json', headers: headers, timeoutMs: 4000 })
      .then(function (r) { try { return JSON.parse(r.text).who; } catch (e) { return null; } }, function () { return null; });
  };
  const asMember = await ask({ 'X-Spirit-Caller': KEY });
  const asOwner = await ask({ 'X-Spirit-Owner': '1' });
  const asNobody = await ask({});
  if (asMember === 'key:' + KEY && asOwner === 'owner' && asNobody === 'none') {
    test.check('X-Spirit-Caller gives {key}, X-Spirit-Owner gives {owner: true}, neither gives nothing');
  } else test.fail(OWED + 'the handler saw ' + JSON.stringify([asMember, asOwner, asNobody]));

  test.subHeading('the door passes its caller on');
  const calls = [];
  const fake = { ask: function (body, caller) { calls.push(caller); return Promise.resolve({ status: 200, body: { ok: true } }); } };
  await apiDoor.answer(fake, { desk: { 'items.search': {} } }, { key: KEY, auth: { pathsOf: function () { return ['desk']; } } });
  await apiDoor.answer(fake, { desk: { 'items.search': {} } }, { owner: true });
  if (calls[0] && calls[0].key === KEY && calls[1] && calls[1].owner === true) {
    test.check('a member\'s ask reaches the servers with {key}, the owner\'s with {owner: true}');
  } else test.fail(OWED + 'the door passed ' + JSON.stringify(calls));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  servers.forEach(function (s) { try { s.close(); } catch (e) { /* gone */ } });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
