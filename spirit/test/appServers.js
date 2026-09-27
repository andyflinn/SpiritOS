'use strict';

// spirit/test/appServers.js
// THE LAST LEG'S OWN PIECES — public-app-server/G17 (js/appServers.js).
//
// Which app serves a name, where its pipe is, the named refusals, and one
// real hop: a hello app server started on a pipe, asked for its page (html),
// its script (javascript) and one verb (a POST, json), the way appFaceApp on
// the owner's node asks it through api.toLocalApp. The whole route, browser
// to owner and back, is faceRouteWorld.js; the test list agreed for the last
// leg is wsl-claude's (faceLastLeg.js).

const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
// One for the suite: the stand-in servers below are HTTP on a pipe (oneDoor counts it once).
const http = require('http');
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

test.subHeading('An app says it serves, and the node knows it by its own name only');
(function () {
  const root = tempRoot({
    alpha: { serves: true },
    beta: { serves: 'yes' },
    gamma: { boots: true },
    delta: { serves: true, face: 'hello' },
  });
  const apps = appServers.readServers(root);
  if (apps.join(',') === 'alpha,delta') {
    test.check('"serves": true starts a server; anything else, "yes" included, starts none');
  } else {
    test.fail('servers read: ' + JSON.stringify(apps));
  }
  fs.rmSync(root, { recursive: true, force: true });
})();

// THE NODE HAS NO FACE VOCABULARY. Andy, 2026-09-27: "the core only knows
// about puppets (nodes owned by nodes, not people). the face-name/app-or-member
// table must be owned by appFaceApp". The first version read a 'face' field
// out of every manifest; this keeps it from drifting back.
(function () {
  const src = fs.readFileSync(path.join(RUN, 'js', 'appServers.js'), 'utf8')
    .split(/\r?\n/).filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n');
  if (!/face/i.test(src)) test.check('appServers.js has no face vocabulary outside its comments');
  else test.fail('appServers.js code mentions a face: ' + (src.match(/.*face.*/i) || [''])[0].trim());
})();

test.subHeading('None on a puppet, one server job per serving app elsewhere');
(function () {
  const root = tempRoot({ hello: { serves: true } });
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
  // AN APP'S OWN SERVER CODE (G19.1): "server": "<file>" runs that file from
  // the app's folder, told its app and its pipe; a name that could leave the
  // folder is not a server.
  const ownRoot = tempRoot({ grantish: { server: 'grantish.server.js' }, sneaky: { server: '../../x.js' } });
  const ownStarted = [];
  appServers.createAppServers({
    rootDir: ownRoot, platform: 'linux', log: function () {},
    startServerJob: function (cmd, args, opts) { ownStarted.push({ args: args, opts: opts }); return {}; },
  }).startAll();
  const own = ownStarted[0];
  if (ownStarted.length === 1 && own.args[own.args.length - 1] === path.join('app', 'grantish', 'grantish.server.js') &&
      own.opts.env && own.opts.env.SPIRIT_APP === 'grantish' &&
      own.opts.env.SPIRIT_PIPE === path.join(ownRoot, 'app-state', 'grantish', 'door.sock')) {
    test.check('"server": "<file>" runs the app\'s own code from its folder, told SPIRIT_APP and SPIRIT_PIPE; "../../x.js" starts nothing');
  } else {
    test.fail('own server code: ' + JSON.stringify(ownStarted));
  }
  fs.rmSync(ownRoot, { recursive: true, force: true });

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
  const root = tempRoot({ hello: { serves: true } });
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
  // ITS OWN RUN FOLDER, NOT THE CHECKOUT'S. The pipe name comes from the
  // root, and on a checkout that is somebody's node that node already serves
  // faceProof on it: the first version of this asked Andy's live server and
  // passed for the wrong reason, which showed only when the test's own
  // server ended and the page still came back.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-hop-'));
  ['faceProof', 'shared'].forEach(function (d) {
    fs.cpSync(path.join(RUN, 'app', d), path.join(root, 'app', d), { recursive: true });
  });
  fs.mkdirSync(path.join(root, 'process'), { recursive: true });
  fs.symlinkSync(path.join(RUN, 'js'), path.join(root, 'js'), 'junction');
  const s = appServers.createAppServers({
    rootDir: root, log: function () {},
    startServerJob: function (cmd, args, opts) {
      const child = childProcess.spawn(cmd, args, { cwd: opts.cwd, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
      hop.child = child;
      return {};
    },
  });
  const hop = { child: null };
  s.startAll();
  if (s.apps().indexOf('faceProof') === -1) {
    test.fail('app/faceProof does not say "serves": true');
    return Promise.resolve();
  }
  function ready(tries) {
    return s.toLocalApp('faceProof', { method: 'GET', path: '/' }).then(function (r) {
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
    return s.toLocalApp('faceProof', { method: 'GET', path: '/ask.js' });
  }).then(function (script) {
    if (script.status === 200 && /javascript/.test(script.type)) test.check('GET /ask.js is its script, typed as javascript');
    else test.fail('GET /ask.js: ' + JSON.stringify({ status: script.status, type: script.type }));
    return s.toLocalApp('faceProof', { method: 'POST', path: '/api/spirit', body: JSON.stringify({ verb: 'app.state' }), type: 'application/json' });
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
    return s.toLocalApp('faceProof', { method: 'GET', path: '/' });
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
// outruns the door's wait and breaks the nesting under appFaceApp's.
function aTrickleIsCutOff() {
  test.subHeading('A slow app is cut off at the deadline, however it trickles');
  const pipe = appServers.pipePathFor(fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-trickle-')), 'trickle');
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

// THE PASSTHROUGH (G19.2). A member's packet for an app with its own server
// goes down that app's pipe unread, and the app's JSON answer comes back as
// the node's reply packet with re = the packet's hash. A key outside the
// contacts never reaches the pipe; an app with no code of its own is not
// passed to; a dead server and a non-JSON answer are refused by name.
function thePassthrough() {
  test.subHeading('The passthrough: a member\'s packet reaches an app\'s own server, and its answer comes back');
  const packet = require('../run/js/client/packet.js');
  const root = tempRoot({ owned: { server: 'owned.server.js' }, pagey: { serves: true } });
  const s = appServers.createAppServers({ rootDir: root, log: function () {}, startServerJob: function () { return {}; } });
  s.startAll();
  const pipe = appServers.pipePathFor(root, 'owned');
  if (process.platform !== 'win32') fs.mkdirSync(path.dirname(pipe), { recursive: true });
  const heard = [];
  let answerWith = function (body) { return JSON.stringify({ ok: true, echo: body.body }); };
  const server = http.createServer(function (req, res) {
    let text = '';
    req.on('data', function (c) { text += c; });
    req.on('end', function () {
      let body = null;
      try { body = JSON.parse(text); } catch (e) { body = null; }
      heard.push(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(answerWith(body));
    });
  });
  const posted = [];
  const opts = {
    decode: packet.decode,
    encode: packet.encode,
    post: function (relayUrl, toKey, text) { posted.push({ relayUrl: relayUrl, toKey: toKey, text: text }); return Promise.resolve({ ok: true }); },
    isMember: function (key) { return key === 'MEMBER'; },
  };
  function arrive(app, body, from, hash) {
    const made = packet.encode(app, body);
    return { text: made.text, fromKey: from, hash: hash, relay: 'https://relay.example' };
  }
  return new Promise(function (resolve) { server.listen(pipe, resolve); }).then(function () {
    const took = s.passthrough(arrive('owned', { verb: 'grant', name: 'hello' }, 'MEMBER', 'h1'), opts);
    return waitMs(600).then(function () {
      const got = posted[0] ? packet.decode(posted[0].text) : null;
      if (took === true && heard.length === 1 && heard[0].from === 'MEMBER' && Object.keys(heard[0]).sort().join(',') === 'body,from' &&
          heard[0].body && heard[0].body.name === 'hello' && got && got.app === 'owned' && got.re === 'h1' &&
          got.body && got.body.ok === true && got.body.echo && got.body.echo.name === 'hello' &&
          posted[0].toKey === 'MEMBER' && posted[0].relayUrl === 'https://relay.example') {
        test.check('down the pipe as { from, body } and nothing else, and back as a reply packet for the same app with re = its hash, via the relay it came on');
      } else {
        test.fail('passthrough: ' + JSON.stringify({ took: took, heard: heard, got: got }).slice(0, 300));
      }
      heard.length = 0; posted.length = 0;
      const stranger = s.passthrough(arrive('owned', { verb: 'grant' }, 'STRANGER', 'h2'), opts);
      const paged = s.passthrough(arrive('pagey', { verb: 'x' }, 'MEMBER', 'h3'), opts);
      const other = s.passthrough(arrive('nobody', { verb: 'x' }, 'MEMBER', 'h4'), opts);
      return waitMs(300).then(function () {
        if (stranger === true && paged === false && other === false && heard.length === 0 && posted.length === 0) {
          test.check('a key outside the contacts never reaches the pipe; an app with no code of its own, or no server, is not passed to');
        } else {
          test.fail('gates: ' + JSON.stringify({ stranger: stranger, paged: paged, other: other, heard: heard.length, posted: posted.length }));
        }
        answerWith = function () { return 'not json'; };
        s.passthrough(arrive('owned', { verb: 'grant' }, 'MEMBER', 'h5'), opts);
        return waitMs(600);
      });
    }).then(function () {
      const got = posted[0] ? packet.decode(posted[0].text) : null;
      if (got && got.body && got.body.code === 'app-answer-not-json' && got.re === 'h5') {
        test.check('an answer that is not JSON is refused by name, to the sender');
      } else {
        test.fail('not-json: ' + JSON.stringify(got));
      }
      posted.length = 0;
      return new Promise(function (resolve) { server.close(resolve); });
    }).then(function () {
      s.passthrough(arrive('owned', { verb: 'grant' }, 'MEMBER', 'h6'), opts);
      return waitMs(800);
    }).then(function () {
      const got = posted[0] ? packet.decode(posted[0].text) : null;
      if (got && got.body && got.body.code === 'app-not-running' && got.re === 'h6') {
        test.check('with nothing on the pipe, the sender hears app-not-running, not silence');
      } else {
        test.fail('dead server: ' + JSON.stringify(got));
      }
      try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* reclaimed later */ }
    });
  });
}
function waitMs(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

refusalsByName()
  .then(thePassthrough)
  .then(aTrickleIsCutOff)
  .then(aRealHop)
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (e) {
    test.fail('the suite itself failed: ' + ((e && e.stack) || e));
    test.reportSuccessFailureCount();
  });

module.exports = test;
