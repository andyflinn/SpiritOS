'use strict';

// spirit/test/appServers.js
// THE LAST LEG'S OWN PIECES — public-app-server/G17 (js/appServers.js).
//
// Which app serves a name, where its pipe is, the named refusals, and one
// real hop: a hello app server started on a pipe, asked for its page (html),
// its script (javascript) and one verb (a POST, json), the way appFaceApp on
// the owner's node asks it through api.toLocalApp. The whole route, browser
// to owner and back, is faceRouteWorld.js; the test list agreed for the last
// leg is wsl-claude's (faceRoutePending.js and what replaces it).

const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
const test = require('./testSupport.js');
const appServers = require('../run/js/appServers.js');
const limits = require('../run/js/limits.js');

const RUN = path.join(__dirname, '..', 'run');

function tempRoot(apps) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-appservers-'));
  Object.keys(apps).forEach(function (name) {
    fs.mkdirSync(path.join(root, 'app', name), { recursive: true });
    fs.writeFileSync(path.join(root, 'app', name, name + '.json'), JSON.stringify(apps[name]));
  });
  return root;
}

test.startTest('The last leg: the owner node and the app servers on its box');

test.subHeading('The node names each pipe, and two nodes on one box never share one');
(function () {
  const a = appServers.pipePathFor('D:/SpiritOS/spirit/run', 'hello', 'win32');
  const b = appServers.pipePathFor('D:/SpiritOS-agent-claude/spirit/run', 'hello', 'win32');
  const again = appServers.pipePathFor('D:/SpiritOS/spirit/run', 'hello', 'win32');
  if (/^\\\\\.\\pipe\\spirit-[0-9a-f]{12}-hello$/.test(a) && a !== b && a === again) {
    test.check('on Windows a named pipe carrying this checkout and the app: two checkouts, two names; one checkout, one name');
  } else {
    test.fail('pipe names: ' + JSON.stringify([a, b, again]));
  }
  const unix = appServers.pipePathFor('/root/SpiritOS/spirit/run', 'hello', 'linux');
  if (unix === path.join('/root/SpiritOS/spirit/run', 'app-state', 'hello', 'door.sock')) {
    test.check('elsewhere a socket file in the app\'s own state folder, which is gitignored');
  } else {
    test.fail('socket path: ' + unix);
  }
})();

test.subHeading('The manifest says which app serves a name, and nothing else does');
(function () {
  const root = tempRoot({
    alpha: { face: 'hello' },
    beta: { face: 'hello' },
    gamma: { face: 'Not A Label' },
    delta: { boots: true },
    epsilon: { face: 'shop' },
  });
  const said = [];
  const faces = appServers.readFaces(root, function (line) { said.push(line); });
  if (faces.hello === 'alpha' && faces.shop === 'epsilon' && Object.keys(faces).length === 2) {
    test.check('"face": "<name>" in an app\'s manifest serves that name; no face, or one no visitor could type, serves none');
  } else {
    test.fail('faces read: ' + JSON.stringify(faces));
  }
  if (said.some(function (l) { return /beta/.test(l) && /hello/.test(l) && /not started/.test(l); })) {
    test.check('a second app naming a face already served is not started, and the log says which');
  } else {
    test.fail('no line about the second claimant: ' + JSON.stringify(said));
  }
  fs.rmSync(root, { recursive: true, force: true });
})();

test.subHeading('None on a puppet, one server job per face elsewhere');
(function () {
  const root = tempRoot({ hello: { face: 'hello' } });
  const started = [];
  const s = appServers.createAppServers({
    rootDir: root, platform: 'linux', log: function () {},
    startServerJob: function (cmd, args, opts) { started.push({ cmd: cmd, args: args, opts: opts }); return {}; },
  });
  s.startAll();
  const one = started[0];
  if (started.length === 1 && one.args.indexOf('--app') !== -1 && one.args[one.args.indexOf('--app') + 1] === 'hello' &&
      one.args[one.args.indexOf('--pipe') + 1] === path.join(root, 'app-state', 'hello', 'door.sock') &&
      one.opts.cwd === root && one.args.some(function (a) { return /^--max-old-space-size=\d+$/.test(a); })) {
    test.check('the node starts js/server.js --app hello --pipe <its path>, from its run folder, with its heap capped');
  } else {
    test.fail('started: ' + JSON.stringify(started));
  }
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(root, 'relay-state', 'puppet.json'), '{}');
  const onPuppet = [];
  appServers.createAppServers({
    rootDir: root, platform: 'linux', log: function () {},
    startServerJob: function () { onPuppet.push(1); return {}; },
  }).startAll();
  if (onPuppet.length === 0) test.check('a puppet (relay-state/puppet.json) starts none: app servers live on the owner\'s box');
  else test.fail('a puppet started ' + onPuppet.length);
  fs.rmSync(root, { recursive: true, force: true });
})();

function refusalsByName() {
  test.subHeading('Every link that fails says which, by name');
  const root = tempRoot({ hello: { face: 'hello' } });
  let answer = null;
  const s = appServers.createAppServers({
    rootDir: root, platform: 'linux', log: function () {}, startServerJob: function () { return {}; },
    request: function () { return Promise.resolve(answer); },
  });
  s.startAll();
  const cases = [
    ['nobody', { refused: null }, {}, 404, 'app-not-served'],
    ['hello', null, { body: 'x'.repeat(limits.BODY_MAX + 1) }, 413, 'app-request-too-large'],
    ['hello', { refused: 'app-not-running' }, {}, 503, 'app-not-running'],
    ['hello', { refused: 'app-did-not-answer' }, {}, 504, 'app-did-not-answer'],
    ['hello', { refused: 'app-answer-too-large' }, {}, 502, 'app-answer-too-large'],
  ];
  return cases.reduce(function (p, c) {
    return p.then(function () {
      answer = c[1];
      return s.toLocalApp(c[0], c[2]).then(function (r) {
        if (r.status === c[3] && r.body && r.body.code === c[4]) test.check(c[4] + ' is ' + c[3] + ', by name');
        else test.fail(c[4] + ': ' + JSON.stringify(r));
      });
    });
  }, Promise.resolve()).then(function () {
    const codes = require('../run/js/spiritErrors.js');
    const known = cases.every(function (c) {
      const d = codes.byCode(c[4]);
      return !!d && d.code === c[4] && d.status === c[3];
    });
    if (known) test.check('each is a declared code in spiritErrors.js, with the same status');
    else test.fail('a code is not declared in spiritErrors.js');
    fs.rmSync(root, { recursive: true, force: true });
  });
}

// ONE REAL HOP. The hello sample, started the way the node starts it, on a
// pipe, and asked the three things a visitor's browser asks.
function aRealHop() {
  test.subHeading('A real app server on a pipe: its page, its script, and a verb');
  const s = appServers.createAppServers({
    rootDir: RUN, log: function () {},
    startServerJob: function (cmd, args, opts) {
      const child = childProcess.spawn(cmd, args, { cwd: opts.cwd, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
      hop.child = child;
      return {};
    },
  });
  const hop = { child: null };
  s.startAll();
  if (s.faces().indexOf('hello') === -1) {
    test.fail('app/faceProof does not name the face "hello"');
    return Promise.resolve();
  }
  function ready(tries) {
    return s.toLocalApp('hello', { method: 'GET', path: '/' }).then(function (r) {
      if (r.status === 200 || tries <= 0) return r;
      return new Promise(function (res) { setTimeout(res, 250); }).then(function () { return ready(tries - 1); });
    });
  }
  return ready(40).then(function (page) {
    if (page.status === 200 && /^text\/html/.test(page.type) && /Hello from an app server/.test(page.body)) {
      test.check('GET / is the app\'s page, typed text/html');
    } else {
      test.fail('GET /: ' + JSON.stringify({ status: page.status, type: page.type }));
    }
    return s.toLocalApp('hello', { method: 'GET', path: '/ask.js' });
  }).then(function (script) {
    if (script.status === 200 && /javascript/.test(script.type)) test.check('GET /ask.js is its script, typed as javascript');
    else test.fail('GET /ask.js: ' + JSON.stringify({ status: script.status, type: script.type }));
    return s.toLocalApp('hello', { method: 'POST', path: '/api/spirit', body: JSON.stringify({ verb: 'app.state' }), type: 'application/json' });
  }).then(function (verb) {
    let said = null;
    try { said = JSON.parse(verb.body); } catch (e) { said = null; }
    if (verb.status === 200 && /json/.test(verb.type) && said && said.ok === true && said.appName === 'faceProof') {
      test.check('POST /api/spirit app.state is the app\'s own answer, typed json');
    } else {
      test.fail('POST: ' + JSON.stringify(verb).slice(0, 300));
    }
    // THE SERVER ENDS WITH ITS NODE: closing the channel is the node dying.
    return new Promise(function (resolve) {
      const timer = setTimeout(function () { resolve(false); }, 5000);
      hop.child.on('exit', function () { clearTimeout(timer); resolve(true); });
      hop.child.disconnect();
    });
  }).then(function (ended) {
    if (ended) test.check('an app server exits when the channel to its node closes, so a dead node leaves no orphan on the pipe');
    else { test.fail('the app server outlived its node\'s channel'); hop.child.kill(); }
    return s.toLocalApp('hello', { method: 'GET', path: '/' });
  }).then(function (after) {
    if (after.status === 503 && after.body && after.body.code === 'app-not-running') {
      test.check('with nothing on the pipe, the node answers app-not-running at once');
    } else {
      test.fail('after the server ended: ' + JSON.stringify(after).slice(0, 200));
    }
  });
}

refusalsByName()
  .then(aRealHop)
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (e) {
    test.fail('the suite itself failed: ' + ((e && e.stack) || e));
    test.reportSuccessFailureCount();
  });

module.exports = test;
