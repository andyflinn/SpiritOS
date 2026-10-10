'use strict';

// spirit/test/appClient.js
// THE NODE'S SIDE OF ITS SERVER PROCESSES (js/appClient.js).
//
// Where each pipe is, the named refusals, and one real knock: appFaceAppServer
// started on a pipe the way the node starts it, asked its tree and its one
// verb. Since goal/G13.2 there is no face half here: no readServers, no
// startAll, no toLocalApp; a face is a process/js server like any other, and
// the whole route, browser to owner and back, is appFaceProcess.js.

const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const RUN = path.join(__dirname, '..', 'run');

test.startTest('The node\'s side of its server processes: pipes, refusals, one real knock');

test.subHeading('The node names each pipe, and two nodes on one box never share one');
(function () {
  const a = appClient.pipePathFor('D:/SpiritOS/spirit/run', 'hello', 'win32');
  const b = appClient.pipePathFor('D:/SpiritOS-agent-claude/spirit/run', 'hello', 'win32');
  const again = appClient.pipePathFor('D:/SpiritOS/spirit/run', 'hello', 'win32');
  if (/^\\\\\.\\pipe\\spirit-[0-9a-f]{12}-hello$/.test(a) && a !== b && a === again) {
    test.check('on Windows a named pipe carrying this checkout and the app: two checkouts, two names; one checkout, one name');
  } else {
    test.fail('pipe names: ' + JSON.stringify([a, b, again]));
  }
  const unix = appClient.pipePathFor('/root/SpiritOS/spirit/run', 'hello', 'linux');
  if (unix === path.join('/root/SpiritOS/spirit/run', 'app-state', 'hello', 'door.sock')) {
    test.check('elsewhere a socket file in the app\'s own state folder, which is gitignored');
  } else {
    test.fail('socket path: ' + unix);
  }
  const proc = appClient.pipePathFor('/root/SpiritOS/spirit/run', 'desk', 'linux', 'process');
  if (proc === path.join('/root/SpiritOS/spirit/run', 'relay-state', 'process', 'desk', 'door.sock')) {
    test.check('a process\'s socket sits in its own state folder under relay-state/process/');
  } else {
    test.fail('process socket path: ' + proc);
  }
})();

// THE NODE HAS NO FACE VOCABULARY. Andy, 2026-09-27: "the core only knows
// about puppets (nodes owned by nodes, not people). the face-name/app-or-member
// table must be owned by appFaceApp". And 2026-10-10: "no \"face\" crap belongs
// into node." The first version read a 'face' field out of every manifest; this
// keeps it from drifting back.
test.subHeading('The node knows servers by name and pipe, never a face');
(function () {
  const src = fs.readFileSync(path.join(RUN, 'js', 'appClient.js'), 'utf8')
    .split(/\r?\n/).filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n');
  if (!/face/i.test(src)) test.check('appClient.js has no face vocabulary outside its comments');
  else test.fail('appClient.js code mentions a face: ' + (src.match(/.*face.*/i) || [''])[0].trim());
  const gone = ['readServers', 'servesOf', 'startAll', 'toLocalApp'].filter(function (n) { return typeof appClient[n] === 'function' || new RegExp('\\b' + n + '\\b').test(src); });
  if (!gone.length) test.check('no readServers, servesOf, startAll or toLocalApp: a server is started one way, by startNodeServers, and known here by its pipe');
  else test.fail('still in appClient.js: ' + gone.join(', '));
})();

function refusalsByName() {
  test.subHeading('Every link that fails says which, by name');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-appservers-'));
  let answer = null;
  const s = appClient.createAppClient({
    rootDir: root, log: function () {},
    request: function () { return Promise.resolve(answer); },
  });
  s.register('hello', appClient.pipePathFor(root, 'hello', 'linux', 'process'));
  const cases = [
    ['nobody', { refused: null }, 404, 'app-not-served'],
    ['hello', { refused: 'app-not-running' }, 503, 'app-not-running'],
    ['hello', { refused: 'app-did-not-answer' }, 504, 'app-did-not-answer'],
    ['hello', { refused: 'app-answer-too-large', bytes: 99999, max: 1 }, 502, 'app-answer-too-large'],
  ];
  return cases.reduce(function (p, c) {
    return p.then(function () {
      answer = c[1];
      const ask = {};
      ask[c[0]] = { greet: {} };
      return s.ask(ask).then(function (r) {
        if (r.status === c[2] && r.body && r.body.code === c[3]) test.check(c[3] + ' is ' + c[2] + ', by name');
        else test.fail(c[3] + ': ' + JSON.stringify(r));
      });
    });
  }, Promise.resolve()).then(function () {
    const codes = require('../run/js/spiritErrors.js');
    const known = cases.every(function (c) {
      const d = codes.byCode(c[3]);
      return !!d && d.code === c[3] && d.status === c[2];
    });
    if (known) test.check('each is a declared code in spiritErrors.js, with the same status');
    else test.fail('a code is not declared in spiritErrors.js');
    fs.rmSync(root, { recursive: true, force: true });
  });
}

// ONE REAL KNOCK. appFaceAppServer, started the way the node starts a process,
// on a pipe, asked its tree and its one verb.
function aRealKnock() {
  test.subHeading('A real server on a pipe: its tree, its verb, and its end with the node');
  // ITS OWN RUN FOLDER, NOT THE CHECKOUT'S. The pipe name comes from the
  // root, and on a checkout that is somebody's node that node already serves
  // on it: the first version of this asked Andy's live server and passed for
  // the wrong reason.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-hop-'));
  fs.cpSync(path.join(RUN, 'process', 'js', 'appFaceAppServer'), path.join(root, 'process', 'js', 'appFaceAppServer'), { recursive: true });
  fs.symlinkSync(path.join(RUN, 'js'), path.join(root, 'js'), 'junction');
  const state = path.join(root, 'relay-state', 'process', 'appFaceAppServer');
  fs.mkdirSync(state, { recursive: true });
  const pipe = appClient.pipePathFor(root, 'appFaceAppServer', process.platform, 'process');
  const s = appClient.createAppClient({ rootDir: root, log: function () {} });
  s.register('appFaceAppServer', pipe);
  const child = childProcess.spawn(process.execPath,
    [path.join(root, 'process', 'js', 'appFaceAppServer', 'appFaceAppServer.js'), '{}', '--pipe', pipe, '--state', state],
    { cwd: root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  function ready(tries) {
    return s.ask('api').then(function (r) {
      const up = r.body && r.body.appFaceAppServer && r.body.appFaceAppServer.ok !== false;
      if (up || tries <= 0) return r;
      return new Promise(function (res) { setTimeout(res, 250); }).then(function () { return ready(tries - 1); });
    });
  }
  return ready(40).then(function (tree) {
    const branch = tree.body && tree.body.appFaceAppServer;
    if (branch && branch.serve && branch.DEBUG) test.check('ask \'api\': its tree names serve, with DEBUG on it like every server\'s');
    else test.fail('ask api: ' + JSON.stringify(tree).slice(0, 200));
    return s.ask({ appFaceAppServer: { serve: { host: 'join.face.test', method: 'POST', path: '/api/spirit', body: '{"verb":"app.state"}', type: 'application/json' } } });
  }).then(function (verb) {
    let said = null;
    try { said = JSON.parse(verb.body && verb.body.body); } catch (e) { said = null; }
    if (verb.status === 200 && verb.body && verb.body.status === 200 && /json/.test(verb.body.type) && said && said.ok === true && said.app === 'appFaceAppServer') {
      test.check('serve answers a json ask with the proof, typed json, as the verb\'s own reply');
    } else {
      test.fail('serve: ' + JSON.stringify(verb).slice(0, 300));
    }
    // THE SERVER ENDS WITH ITS NODE: closing the channel is the node dying.
    return new Promise(function (resolve) {
      const timer = setTimeout(function () { resolve(false); }, 5000);
      child.on('exit', function () { clearTimeout(timer); resolve(true); });
      child.disconnect();
    });
  }).then(function (ended) {
    if (ended) test.check('a server exits when the channel to its node closes, so a dead node leaves no orphan on the pipe');
    else { test.fail('the server outlived its node\'s channel'); child.kill(); }
    return s.ask({ appFaceAppServer: { serve: { host: '', method: 'GET', path: '/', body: '', type: '' } } });
  }).then(function (after) {
    if (after.status === 503 && after.body && after.body.code === 'app-not-running') {
      test.check('with nothing on the pipe, the node answers app-not-running at once');
    } else {
      test.fail('after the server ended: ' + JSON.stringify(after).slice(0, 200));
    }
  });
}

// A DEADLINE, NOT AN IDLE TIMER (wsl-claude's finding on 62e2b96): an app
// that sends a byte every 100 ms must still be cut off at the limit, or it
// outruns the door's wait and breaks the nesting under the face's.
function aTrickleIsCutOff() {
  test.subHeading('A slow app is cut off at the deadline, however it trickles');
  const http = require('http');
  const pipe = appClient.pipePathFor(fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-trickle-')), 'trickle');
  if (process.platform !== 'win32') fs.mkdirSync(path.dirname(pipe), { recursive: true });
  const server = http.createServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    const t = setInterval(function () { res.write('x'); }, 100);
    res.on('close', function () { clearInterval(t); });
  });
  return new Promise(function (resolve) { server.listen(pipe, resolve); }).then(function () {
    const began = Date.now();
    // A GUARD OF ITS OWN, so a missing deadline fails here by name rather
    // than hanging the suite until the harness kills it.
    const guard = new Promise(function (resolve) { setTimeout(function () { resolve({ hung: true }); }, 3000); });
    return Promise.race([
      require('../run/js/relayRequest.js').pipeRequest(pipe, 'GET', '/', '', { timeoutMs: 500 }),
      guard,
    ]).then(function (r) {
      const took = Date.now() - began;
      if (r.refused === 'app-did-not-answer' && took < 1500) test.check('refused as app-did-not-answer after ' + took + ' ms, against a 500 ms limit');
      else test.fail('a trickling app came back ' + JSON.stringify(r).slice(0, 120) + ' after ' + took + ' ms');
      return new Promise(function (resolve) { server.close(resolve); if (server.closeAllConnections) server.closeAllConnections(); });
    });
  });
}

refusalsByName()
  .then(aTrickleIsCutOff)
  .then(aRealKnock)
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (e) {
    test.fail('the suite itself failed: ' + ((e && e.stack) || e));
    test.reportSuccessFailureCount();
  });

module.exports = test;
