'use strict';

// apiAuth/G1.13: the door forwards the caller's verified key, and its label, to the server. Red on today's code.
//   Andy: "ok, the verified key is forwarded to the appServer. i revise my ruling.", "it doesn't violate: "the
//   node knows nothing about what apps do, or what apps packages contain."", "agreed." to the header shape,
//   "my key will at least confirm it came from my node...", and "yes. the label will only be used for labeling in
//   chat, and for referencing members, internally desk server will use keys for tracking."
// The contract the builder follows (G1.13's box):
//   - pipeRequest(pipe, method, path, body, opts) sends opts.headers with the request.
//   - appClient.ask(body, caller): caller.key sets X-Spirit-Caller, caller.label X-Spirit-Label, caller.owner
//     X-Spirit-Owner: 1. The body stays the app's ask, untouched.
//   - appServer hands every handler a second argument built from them: { key, label } for a member,
//     { owner: true, key, label } for the owner, nothing when none came; a handler that takes (args) alone is
//     unchanged.
//   - apiDoor.answer passes the caller on: a member's ask goes to servers.ask(ask, { key, label }), the label read
//     through auth.labelOf(key) (apiAuth.js, the peers row); the owner's to servers.ask(ask, caller) as handed
//     (jobs.api hands { owner: true, key: the node's own key, label: the owner's name }).
//   Desk's half is deskWriterKey.js.

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
const OWNKEY = 'MCowBQYDK2VwAyEAforwardKeyTestOwnerAAAAAAAAAAAAAAAAAA=';
const APPSERVER = path.join(__dirname, '..', 'run', 'js', 'appServer.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test.startTest('apiAuth/G1.13: the caller\'s verified key and label reach the server, out of band');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-fwdkey-'));
const kids = [];
const servers = [];

function pipeFor(name) {
  const p = appClient.pipePathFor(scratch, name, process.platform, 'process');
  if (process.platform !== 'win32') fs.mkdirSync(path.dirname(p), { recursive: true });
  return p;
}

(async function () {
  test.subHeading('pipeRequest and appClient.ask carry the caller as headers');
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
  await client.ask({ capture: { ping: {} } }, { key: KEY, label: 'alice' });
  await client.ask({ capture: { ping: {} } }, { owner: true, key: OWNKEY, label: 'andy' });
  const m = seen[0] || { headers: {} };
  const o = seen[1] || { headers: {} };
  if (m.headers['x-spirit-caller'] === KEY && m.headers['x-spirit-label'] === 'alice' && !m.headers['x-spirit-owner'] &&
      o.headers['x-spirit-owner'] === '1' && o.headers['x-spirit-caller'] === OWNKEY && o.headers['x-spirit-label'] === 'andy' &&
      m.body === JSON.stringify({ ping: {} })) {
    test.check('a member\'s ask carries its key and label; the owner\'s the owner mark, his key and his label; the body is the ask alone');
  } else test.fail(OWED + 'appClient.ask sent ' + JSON.stringify(seen.map(function (s) {
    return { caller: s.headers['x-spirit-caller'], label: s.headers['x-spirit-label'], owner: s.headers['x-spirit-owner'], body: s.body };
  })).slice(0, 260));

  test.subHeading('appServer hands the handler the caller as its second argument');
  const echo = path.join(scratch, 'echoCaller.js');
  fs.writeFileSync(echo, 'require(' + JSON.stringify(APPSERVER) + ').serve({ who: { request: {}, reply: { who: "" }, handler: function (a, caller) {\n' +
    '  return { who: !caller ? "none" : (caller.owner === true ? "owner:" : "member:") + caller.key + "/" + caller.label }; } } });\n');
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
  const asMember = await ask({ 'X-Spirit-Caller': KEY, 'X-Spirit-Label': 'alice' });
  const asOwner = await ask({ 'X-Spirit-Owner': '1', 'X-Spirit-Caller': OWNKEY, 'X-Spirit-Label': 'andy' });
  const asNobody = await ask({});
  if (asMember === 'member:' + KEY + '/alice' && asOwner === 'owner:' + OWNKEY + '/andy' && asNobody === 'none') {
    test.check('the headers give the handler {key, label}, {owner: true, key, label}, or nothing');
  } else test.fail(OWED + 'the handler saw ' + JSON.stringify([asMember, asOwner, asNobody]));

  test.subHeading('the door passes its caller on');
  const calls = [];
  const fake = { ask: function (body, caller) { calls.push(caller); return Promise.resolve({ status: 200, body: { ok: true } }); } };
  await apiDoor.answer(fake, { desk: { 'items.search': {} } }, { key: KEY, auth: { pathsOf: function () { return ['desk']; }, labelOf: function () { return 'alice'; } } });
  await apiDoor.answer(fake, { desk: { 'items.search': {} } }, { owner: true, key: OWNKEY, label: 'andy' });
  const c0 = calls[0] || {};
  const c1 = calls[1] || {};
  if (c0.key === KEY && c0.label === 'alice' && c0.auth === undefined && c1.owner === true && c1.key === OWNKEY && c1.label === 'andy') {
    test.check('a member\'s ask reaches the servers with {key, label} (the label from auth.labelOf), the owner\'s with his caller as handed');
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
