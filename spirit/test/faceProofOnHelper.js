'use strict';

// spirit/test/faceProofOnHelper.js
// faceProof ON THE HELPER — appPair/G1.4, written FIRST, red today.
//
//   Decided (Desk, appPair/G1): faceProof, the one app that serves, answers
//   through appServer.js, the passthrough only, for starters. It has no verb
//   of its own (its page asks app.state, faceServer's built-in), so the
//   helper properly returns {} for it (Andy: "the helper will properly
//   return {} then"). Its page and app.state behave as today.
//
// The real faceProof app server, started as the node starts it, on its pipe.

const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const { pipeRequest } = require('../run/js/relayRequest.js');

test.startTest('appPair/G1.4: faceProof answers through the appServer helper');

const OWED = 'OWED by appPair/G1.4: ';
const RUN = path.join(__dirname, '..', 'run');

(async function () {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-faceproof-helper-'));
  // A face is a process since slim/G1.4; ask.js stays in the shell.
  fs.cpSync(path.join(RUN, 'process', 'js', 'faceProof'), path.join(root, 'process', 'js', 'faceProof'), { recursive: true });
  fs.cpSync(path.join(RUN, 'shell', 'shared'), path.join(root, 'shell', 'shared'), { recursive: true });
  fs.mkdirSync(path.join(root, 'process'), { recursive: true });
  fs.symlinkSync(path.join(RUN, 'js'), path.join(root, 'js'), 'junction');
  const pipe = appClient.pipePathFor(root, 'faceProof', process.platform, 'process');
  if (process.platform !== 'win32') fs.mkdirSync(path.dirname(pipe), { recursive: true });
  const child = childProcess.spawn(process.execPath, [path.join('js', 'server.js'), '--app', 'faceProof', '--pipe', pipe],
    { cwd: root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });

  let page = null;
  for (let n = 0; n < 40; n++) {
    page = await pipeRequest(pipe, 'GET', '/', '', { timeoutMs: 2000 });
    if (page && page.status === 200) break;
    await new Promise(function (r) { setTimeout(r, 250); });
  }

  test.subHeading('T1: its page and app.state behave as today');
  const state = await pipeRequest(pipe, 'POST', '/api/spirit', JSON.stringify({ verb: 'app.state' }), { type: 'application/json', timeoutMs: 3000 });
  let s = null;
  try { s = JSON.parse(state.text); } catch (e) { s = null; }
  if (page && page.status === 200 && /Hello from an app server/.test(page.text) && s && s.appName === 'faceProof') {
    test.check('GET / is its page, and app.state answers with appName faceProof, as before');
  } else {
    test.fail('page ' + (page && (page.status || page.refused)) + ', app.state ' + (state && state.status) + ' ' + String(state && state.text).slice(0, 120));
  }

  test.subHeading("T2: api lists faceProof as {}: faceServer's built-in verbs are not its own");
  // A test node includes what it starts, for this run (slim/G1.3 T6).
  require('../run/js/includeList.js').add(root, 'process/js/faceProof');
  const client = appClient.createAppClient({ rootDir: root, startServerJob: function () { return null; }, log: function () {} });
  client.startAll();
  const api = typeof client.ask === 'function' ? await client.ask('api') : null;
  if (api && api.status === 200 && api.body && JSON.stringify(api.body.faceProof) === '{}') {
    test.check('the node\'s api answers {faceProof: {}}');
  } else {
    test.fail(OWED + 'api answered ' + JSON.stringify(api && api.body));
  }

  test.subHeading('T3: faceServer no longer opens its own listener; the helper is the one door');
  const src = fs.readFileSync(path.join(RUN, 'js', 'faceServer.js'), 'utf8');
  if (!/http\.createServer\s*\(/.test(src) && /require\(\s*'\.\/appServer'\s*\)/.test(src)) {
    test.check('faceServer.js calls no http.createServer and listens through appServer.js');
  } else {
    test.fail(OWED + 'faceServer.js still opens its own listener, or does not use appServer.js');
  }

  child.kill();
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* busy */ }
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 200);
}());
