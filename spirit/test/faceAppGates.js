'use strict';

// apiAuth/G1.1: appFaceAppServer serves through appServer. Red on today's code.
//   Found 2026-10-01: it builds its own http.createServer (appFaceAppServer.js:28), so it answers no
//   api, has no DEBUG, and none of the shared gates apply. Andy: "gruesome! fixed in this cycle,
//   thanks!", and "correction: 'appFaceAppServer' is subject to all rules that appServers must obey".
// The shape the builder follows (the item's box):
//   - appFaceAppServer serves its verbs through appServer (createAppServer's opts.fallback is the
//     pass-through, appServer.js:94-136; no new server code), so api, DEBUG — and with G1.10,
//     DEPENDENCIES — answer like every server's, and the shared caps apply.
//   - The pass-through itself stays what it is: a request that is not appClient's JSON POST to '/'
//     goes to faceProof untouched. No grant names it (Andy: "appFaceAppServer needs no grant. it is
//     run by the owner"); the serve path is out of scope (Andy, under G1.6).
//   - An oversized pass-through answer is never streamed: Andy, "That needs to be rectified." and
//     "appServer will convert any oversized reply into an error and stream that error to the shell".
//     So over ANSWER_MAX it becomes app-answer-too-large, carrying the size and the limit, as a
//     verb's oversized reply does.

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

test.subHeading('the second door is gone from the source');
const src = fs.readFileSync(FILE, 'utf8');
if (/appServer/.test(src) && !/http\.createServer/.test(src)) {
  test.check('appFaceAppServer.js serves through appServer and builds no http server of its own');
} else {
  test.fail(OWED + 'appFaceAppServer.js: uses appServer ' + /appServer/.test(src) + ', own http.createServer ' + /http\.createServer/.test(src));
}

// The real faceProof pipe path, as the process computes it from its own root.
const facePipe = appClient.pipePathFor(root, 'faceProof', process.platform, 'process');
const myPipe = appClient.pipePathFor(root, 'appFaceAppServer', process.platform, 'process');
const BIG = 'B'.repeat(appClient.ANSWER_MAX + 1024);

const http = require('http');
if (process.platform !== 'win32') { try { fs.unlinkSync(facePipe); } catch (e) { /* none */ } }
fs.mkdirSync(path.dirname(facePipe), { recursive: true });
fs.mkdirSync(path.dirname(myPipe), { recursive: true });
const face = http.createServer(function (req, res) {
  if (req.url === '/big') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end(BIG); return; }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('FACE-PAGE ' + req.method + ' ' + req.url);
});
let kid = null;

(async function () {
  await new Promise(function (r) { face.listen(facePipe, r); });
  if (process.platform !== 'win32') { try { fs.unlinkSync(myPipe); } catch (e) { /* none */ } }
  kid = spawn(process.execPath, [FILE, '--pipe', myPipe], { cwd: root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });

  // The door answers raw before the client is built: an ask that fires
  // before the server listens is remembered as down and poisons the rest.
  const doorUp = await until(function () {
    return pipeRequest(myPipe, 'GET', '/door-up', '', { timeoutMs: 2000, answerMax: 100000 })
      .then(function (r) { return r && r.status > 0 && !r.refused; }, function () { return false; });
  }, 10000);
  if (!doorUp) test.fail('appFaceAppServer never listened on its pipe');
  const client = appClient.createAppClient({ rootDir: root });
  client.register('appFaceAppServer', myPipe);
  const call = function (verb, args) {
    const b = {}; b[verb] = args;
    return client.ask({ appFaceAppServer: b }).then(function (r) { return (r && r.body) || {}; }, function () { return {}; });
  };

  test.subHeading('it answers api and DEBUG, as every appServer must');
  const up = await until(function () {
    return client.ask('api').then(function (r) { return r && r.body && r.body.appFaceAppServer; }, function () { return null; });
  }, 10000);
  const tree = up && !Array.isArray(up) && typeof up === 'object' && up.ok !== false;
  if (tree) test.check('ask \'api\': appFaceAppServer answers a verb tree, not an error');
  else test.fail(OWED + '\'api\' answered ' + JSON.stringify(up).slice(0, 160));
  const dbg = await call('DEBUG', {});
  if (dbg.debug === false) test.check('DEBUG {} reads false, the shared switch (desk/G2.5)');
  else test.fail(OWED + 'DEBUG answered ' + JSON.stringify(dbg).slice(0, 120));

  test.subHeading('the pass-through still hands everything else to faceProof untouched');
  const page = await pipeRequest(myPipe, 'GET', '/whoBook/page.html', '', { timeoutMs: 8000, answerMax: appClient.ANSWER_MAX }).catch(function () { return null; });
  if (page && page.status === 200 && /FACE-PAGE GET \/whoBook\/page\.html/.test(String(page.text))) {
    test.check('a GET that is not appClient\'s JSON POST reaches faceProof and its answer comes back');
  } else test.fail(OWED + 'the pass-through answered ' + JSON.stringify(page && { status: page.status, text: String(page.text).slice(0, 80) }));

  test.subHeading('an oversized pass-through answer becomes an error, never a stream');
  const big = await pipeRequest(myPipe, 'GET', '/big', '', { timeoutMs: 8000, answerMax: appClient.ANSWER_MAX + 4096 }).catch(function () { return null; });
  let body = null;
  try { body = JSON.parse(big && big.text); } catch (e) { body = null; }
  // extra.bytes and extra.max, the shape every size refusal in the tree
  // says (appClient.js knock; claude-windows' build review, 2026-10-01).
  const ex = (body && body.extra) || {};
  if (body && body.ok === false && body.code === 'app-answer-too-large' && ex.bytes > appClient.ANSWER_MAX && ex.max === appClient.ANSWER_MAX) {
    test.check('over ANSWER_MAX: app-answer-too-large with extra.bytes and extra.max, as a verb\'s reply would be');
  } else {
    const got = big ? (body ? JSON.stringify(body).slice(0, 140) : String(big.text == null ? '' : big.text).length + ' bytes streamed') : 'no answer';
    test.fail(OWED + 'an oversized pass-through answered ' + got);
  }
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  if (kid) kid.kill();
  face.close();
  setTimeout(function () { test.reportSuccessFailureCount(); process.exit(0); }, 300);
});
