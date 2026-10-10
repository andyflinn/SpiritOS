'use strict';

// apiAuth/G1.1: appFaceAppServer serves through appServer, so every shared gate applies.
//   Found 2026-10-01: it built its own http.createServer, so it answered no api, had no DEBUG,
//   and none of the shared gates applied. Andy: "gruesome! fixed in this cycle, thanks!", and his
//   correction under G1.1: appFaceAppServer is subject to every rule an app server must obey.
// Since goal/G13.2 (Andy, 2026-10-10: "KILL faceProof completely and just let appFaceAppServer
// respond to that json request. DONE.") it has no pass-through either: serve is its one verb,
// answered itself, and a request that is not appClient's JSON POST to '/' is refused by the
// shared layer like everywhere else, never handed to a pipe.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const { setupRelayFakes } = require('./setupRelayFakes');

const OWED = 'OWED by apiAuth/G1.1: ';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function until(fn, ms) { const end = Date.now() + ms; while (Date.now() < end) { const v = await fn(); if (v) return v; await sleep(150); } return fn(); }

test.startTest('apiAuth/G1.1: appFaceAppServer serves through appServer, so every shared gate applies');

const root = setupRelayFakes('faceAppGates').andy;
const FILE = path.join(root, 'process', 'js', 'appFaceAppServer', 'appFaceAppServer.js');
const appClient = require(path.join(root, 'js', 'appClient.js'));
const pipeRequest = require(path.join(root, 'js', 'relayRequest.js')).pipeRequest;

test.subHeading('the second door is gone from the source, and so is the pass-through');
const src = fs.readFileSync(FILE, 'utf8');
if (/appServer/.test(src) && !/http\.createServer/.test(src)) {
  test.check('appFaceAppServer.js serves through appServer and builds no http server of its own');
} else {
  test.fail(OWED + 'appFaceAppServer.js: uses appServer ' + /appServer/.test(src) + ', own http.createServer ' + /http\.createServer/.test(src));
}
if (!/pipeRequest|fallback/.test(src)) test.check('and passes nothing through: no pipeRequest, no fallback (goal/G13.2)');
else test.fail('OWED by goal/G13.2: appFaceAppServer.js still passes requests through');

const myPipe = appClient.pipePathFor(root, 'appFaceAppServer', process.platform, 'process');
const state = path.join(root, 'relay-state', 'process', 'appFaceAppServer');
fs.mkdirSync(state, { recursive: true });
fs.mkdirSync(path.dirname(myPipe), { recursive: true });
let kid = null;

(async function () {
  if (process.platform !== 'win32') { try { fs.unlinkSync(myPipe); } catch (e) { /* none */ } }
  kid = spawn(process.execPath, [FILE, '{}', '--pipe', myPipe, '--state', state], { cwd: root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });

  const client = appClient.createAppClient({ rootDir: root });
  client.register('appFaceAppServer', myPipe);
  const call = function (verb, args) {
    const b = {}; b[verb] = args;
    return client.ask({ appFaceAppServer: b }).then(function (r) { return (r && r.body) || {}; }, function () { return {}; });
  };

  test.subHeading('it answers api and DEBUG, as every appServer must');
  const up = await until(function () {
    return client.ask('api').then(function (r) { return r && r.body && r.body.appFaceAppServer && r.body.appFaceAppServer.ok !== false ? r.body.appFaceAppServer : null; }, function () { return null; });
  }, 10000);
  // DEBUG in the tree proves the answer is appFaceAppServer's own shared
  // layer, not a forward: only serve() puts DEBUG on every server.
  const tree = up && !Array.isArray(up) && typeof up === 'object' && up.DEBUG;
  if (tree) test.check('ask \'api\': appFaceAppServer answers its own verb tree, DEBUG on it like every server\'s');
  else test.fail(OWED + '\'api\' answered ' + JSON.stringify(up).slice(0, 160));
  const dbg = await call('DEBUG', {});
  if (dbg.debug === false) test.check('DEBUG {} reads false, the shared switch (desk/G2.5)');
  else test.fail(OWED + 'DEBUG answered ' + JSON.stringify(dbg).slice(0, 120));

  test.subHeading('serve is answered by appFaceAppServer itself');
  const proof = await call('serve', { host: 'join.face.test', method: 'POST', path: '/api/spirit', body: '{"verb":"app.state"}', type: 'application/json' });
  let said = null;
  try { said = JSON.parse(proof.body); } catch (e) { said = null; }
  if (proof.status === 200 && /json/.test(proof.type) && said && said.ok === true && said.app === 'appFaceAppServer' && said.verb === 'app.state') {
    test.check('a json ask on /api/spirit is answered with the proof, typed json, naming the app and the verb');
  } else test.fail('OWED by goal/G13.2: serve answered ' + JSON.stringify(proof).slice(0, 200));

  test.subHeading('nothing passes through: a request that is not the JSON POST is refused by the shared layer');
  const page = await pipeRequest(myPipe, 'GET', '/whoBook/page.html', '', { timeoutMs: 8000, answerMax: appClient.ANSWER_MAX }).catch(function () { return null; });
  let body = null;
  try { body = JSON.parse(page && page.text); } catch (e) { body = null; }
  if (page && page.status === 400 && body && body.ok === false && body.code === 'bad-request') {
    test.check('a GET on the pipe is bad-request from appServer, never a page from anywhere');
  } else test.fail('OWED by goal/G13.2: a GET on the pipe answered ' + JSON.stringify(page && { status: page.status, text: String(page.text).slice(0, 80) }));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  if (kid) kid.kill();
  setTimeout(function () { test.reportSuccessFailureCount(); process.exit(0); }, 300);
});
