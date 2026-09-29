'use strict';

// spirit/test/faceLastLeg.js
// THE LAST LEG, HELD TO WHAT WAS AGREED — public-app-server/G17.
//
//   Andy, 2026-09-27, under G17: "the go is officail. also: i explicitly
//   permit the two new/proposed interfaces/api' for communication from node
//   to appserver." claude-windows built it (62e2b96); its own suite,
//   appClient.js, proves the pieces and one real hop. This one holds the
//   limits wsl-claude listed before it was built, against REAL sockets
//   rather than a stubbed request, because a limit proven against a stub
//   is a limit on the stub:
//
//   (a) refused BEFORE the door: an unknown name and an oversize request
//       never reach a pipe at all;
//   (b) the limits nest: the hop's wait < appFaceApp's serve wait < the
//       face's own wait, so each link answers by its own name;
//   (c) a real server that never answers is app-did-not-answer, and one
//       whose answer outgrows the cap is app-answer-too-large;
//   (d) only the content type crosses: no cookie, no forwarded address, no
//       header the visitor sent reaches the app;
//   (e) no address on the wire: the pipe's path never appears in anything
//       toLocalApp hands back, answer or refusal.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const relayRequest = require('../run/js/relayRequest.js');
const puppetPost = require('../run/js/puppetPost.js');
const limits = require('../run/js/limits.js');

const RUN = path.join(__dirname, '..', 'run');

test.startTest('The last leg holds its limits against real sockets (G17)');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-lastleg-'));

// A root with one app that runs a server (serves: true), its pipe where the node
// would put it. `serve` is the fake app's handler.
function world(serve) {
  const root = path.join(scratch, 'root-' + Math.random().toString(36).slice(2, 8));
  fs.mkdirSync(path.join(root, 'process', 'js', 'faceProof'), { recursive: true });
  fs.writeFileSync(path.join(root, 'process', 'js', 'faceProof', 'faceProof.json'), JSON.stringify({ serves: true }));
  const pipe = appClient.pipePathFor(root, 'faceProof', process.platform, 'process');
  if (process.platform !== 'win32') fs.mkdirSync(path.dirname(pipe), { recursive: true });
  const seen = [];
  const server = http.createServer(function (req, res) {
    seen.push({ method: req.method, url: req.url, headers: req.headers });
    serve(req, res);
  });
  let knocked = 0;
  const servers = appClient.createAppClient({
    rootDir: root, log: function () {}, startServerJob: function () { return {}; },
    request: function () { knocked++; return relayRequest.pipeRequest.apply(null, arguments); },
  });
  servers.startAll();
  return new Promise(function (resolve) {
    server.listen(pipe, function () {
      resolve({ root: root, pipe: pipe, seen: seen, servers: servers, server: server,
        knocks: function () { return knocked; } });
    });
  });
}

// THE WHOLE ROUTE, as faceRouteWorld.js builds it, with ONE difference:
// the owner's node has app servers, so 'serve' goes through
// api.toLocalApp to a real socket instead of answering the step-1 stub.
// Real: puppetPost's listener, appFaceApp mounted twice by the real
// nodeApps.mountAll, the packet codec, arrivals, appClient and
// pipeRequest. Fake: the relay (a function), and the app (an http server
// on the socket the node names).
async function wholeRoute() {
  test.subHeading('A browser\'s request reaches the app server behind the owner\'s node, and its answer comes back');
  const nodeApps = require('../run/js/nodeApps');
  const arrivalsMod = require('../run/js/arrivals');
  const packet = require('../run/js/client/packet');
  const auth = require('../run/js/relayAuth');
  const crypto = require('crypto');
  const FACE_DOMAIN = 'face.spirit.test';

  function home(label) {
    const root = path.join(scratch, label);
    const app = path.join(root, 'shell', 'appFaceApp');
    fs.mkdirSync(app, { recursive: true });
    fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
    ['appFaceApp.js', 'appFaceApp.json'].forEach(function (f) {
      fs.copyFileSync(path.join(RUN, 'shell', 'appFaceApp', f), path.join(app, f));
    });
    fs.symlinkSync(path.join(RUN, 'js'), path.join(root, 'js'), 'junction');
    return { root: root, app: app };
  }
  const ownerId = auth.generateIdentity('owner');
  const puppetId = auth.generateIdentity('face');
  const nodes = {};
  const wire = [];
  function postFrom(fromKey) {
    return function (relayUrl, toKey, text) {
      const hash = crypto.randomBytes(16).toString('hex');
      const decoded = packet.decode(text);
      wire.push({ from: fromKey, to: toKey, body: decoded && decoded.body });
      const target = nodes[toKey];
      if (!target) return Promise.resolve({ ok: false, status: 503, error: 'that peer is not reachable right now' });
      setTimeout(function () {
        target.note({ item: hash, hash: hash, from: fromKey, text: text, at: new Date().toISOString(), relay: 'https://relay.test' });
      }, 5);
      return Promise.resolve({ ok: true, status: 200, hash: hash });
    };
  }

  // THE OWNER: the grant for 'hello' naming the app that serves it (appFaceApp's
  // own row, 5310ba7), and that app's manifest saying it runs a server.
  const owner = home('owner');
  fs.writeFileSync(path.join(owner.app, 'face-domain.json'), JSON.stringify({ faceDomain: FACE_DOMAIN }));
  fs.writeFileSync(path.join(owner.app, 'grants.json'), JSON.stringify({ names: { hello: { to: ownerId.publicKey, app: 'faceProof' } } }));
  fs.mkdirSync(path.join(owner.root, 'process', 'js', 'faceProof'), { recursive: true });
  fs.writeFileSync(path.join(owner.root, 'process', 'js', 'faceProof', 'faceProof.json'), JSON.stringify({ serves: true }));
  const servers = appClient.createAppClient({ rootDir: owner.root, log: function () {}, startServerJob: function () { return {}; } });
  servers.startAll();
  const pipe = appClient.pipePathFor(owner.root, 'faceProof', process.platform, 'process');
  if (process.platform !== 'win32') fs.mkdirSync(path.dirname(pipe), { recursive: true });
  const seen = [];
  const app = http.createServer(function (req, res) {
    let t = '';
    req.on('data', function (c) { t += c; });
    req.on('end', function () {
      seen.push({ method: req.method, url: req.url, type: req.headers['content-type'] || '', body: t });
      if (req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, echo: t }));
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<!doctype html><p>hello from the app</p>');
      }
    });
  });
  await new Promise(function (r) { app.listen(pipe, r); });
  nodes[ownerId.publicKey] = arrivalsMod.createArrivals({});
  nodeApps.mountAll({ rootDir: owner.root, arrivals: nodes[ownerId.publicKey], post: postFrom(ownerId.publicKey),
    servers: servers, log: function () {} });

  // THE PUPPET: owned by the owner, with the face.
  const puppet = home('puppet');
  fs.writeFileSync(path.join(puppet.root, 'relay-state', 'puppet.json'), JSON.stringify({ owner: ownerId.publicKey, carries: [] }));
  nodes[puppetId.publicKey] = arrivalsMod.createArrivals({});
  const face = puppetPost.createPuppetPost({ log: function () {} });
  const listener = await new Promise(function (r) { face.listen(0, r); });
  const port = listener.address().port;
  nodeApps.mountAll({ rootDir: puppet.root, arrivals: nodes[puppetId.publicKey], face: face,
    post: postFrom(puppetId.publicKey), log: function () {} });

  function browse(method, pathname, body, type) {
    return new Promise(function (resolve) {
      const headers = { Host: 'hello.' + FACE_DOMAIN, Cookie: 'session=visitor-secret' };
      if (type) headers['Content-Type'] = type;
      const req = http.request({ hostname: '127.0.0.1', port: port, path: pathname, method: method, headers: headers },
        function (res) {
          let t = '';
          res.on('data', function (c) { t += c; });
          res.on('end', function () { resolve({ status: res.statusCode, type: res.headers['content-type'] || '', text: t }); });
        });
      req.on('error', function (e) { resolve({ status: 0, text: String(e) }); });
      req.setTimeout(30000, function () { req.destroy(new Error('timeout')); });
      req.end(body || '');
    });
  }

  const page = await browse('GET', '/');
  if (page.status === 200 && /^text\/html/.test(page.type) && page.text === '<!doctype html><p>hello from the app</p>') {
    test.check('GET hello.' + FACE_DOMAIN + '/ is the app server\'s own page, typed text/html, as the browser needs to render it');
  } else {
    test.fail('the page through the whole route: ' + JSON.stringify(page).slice(0, 300));
  }

  const posted = await browse('POST', '/api/spirit', '{"verb":"app.state"}', 'application/json');
  const last = seen[seen.length - 1] || {};
  let echoed = null;
  try { echoed = JSON.parse(posted.text); } catch (e) { echoed = null; }
  if (posted.status === 200 && /^application\/json/.test(posted.type) && echoed && echoed.echo === '{"verb":"app.state"}'
      && last.method === 'POST' && last.url === '/api/spirit' && last.type === 'application/json') {
    test.check('a POST crosses with its body and content type to the app, and the app\'s json answer comes back typed json');
  } else {
    test.fail('the POST through the whole route: ' + JSON.stringify({ posted: posted, app: last }).slice(0, 300));
  }

  const onWire = JSON.stringify(wire);
  const leaks = [pipe, owner.root, scratch, 'visitor-secret'].filter(function (s) {
    return onWire.indexOf(JSON.stringify(s).slice(1, -1)) !== -1;
  });
  const served = wire.filter(function (x) { return x.body && x.body.verb === 'served'; }).length;
  if (served >= 2 && leaks.length === 0) {
    test.check('no packet between the two nodes carries the pipe, a folder, or the visitor\'s cookie (' + wire.length + ' packets read)');
  } else {
    test.fail('on the wire: ' + served + ' served answers; leaked: ' + JSON.stringify(leaks));
  }

  listener.close();
  app.close();
}

// G18, Andy 2026-09-27: "processes use named pipes to serve requests from
// the puppets". Its declaration (appServerBoundary.js) probed a name that
// was built elsewhere (appClient.pipePathFor, not faceServer's), so it
// could never flip; this is the assertion it was waiting to hand over. A
// real app server, started the way the node starts it (--app --pipe), is
// asked over its pipe, and the kernel's own socket table is read for any
// TCP listener that process holds. Linux only: /proc is the witness, and a
// Windows run says so rather than passing blind.
async function noTcpPort() {
  test.subHeading('G18: an app server started on a pipe holds no TCP port');
  if (process.platform !== 'linux') {
    test.check('(skipped off Linux: the socket table is read from /proc, which ' + process.platform + ' has not)');
    return;
  }
  const childProcess = require('child_process');
  const root = path.join(scratch, 'g18');
  // A face is a process since slim/G1.4; ask.js stays in the shell.
  fs.cpSync(path.join(RUN, 'process', 'js', 'faceProof'), path.join(root, 'process', 'js', 'faceProof'), { recursive: true });
  fs.cpSync(path.join(RUN, 'shell', 'shared'), path.join(root, 'shell', 'shared'), { recursive: true });
  fs.mkdirSync(path.join(root, 'process'), { recursive: true });
  fs.symlinkSync(path.join(RUN, 'js'), path.join(root, 'js'), 'junction');
  const pipe = appClient.pipePathFor(root, 'faceProof', process.platform, 'process');
  fs.mkdirSync(path.dirname(pipe), { recursive: true });
  const child = childProcess.spawn(process.execPath, [path.join('js', 'server.js'), '--app', 'faceProof', '--pipe', pipe],
    { cwd: root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  let page = null;
  for (let n = 0; n < 40; n++) {
    page = await relayRequest.pipeRequest(pipe, 'GET', '/', '', { timeoutMs: 2000 });
    if (page && page.status === 200) break;
    await new Promise(function (r) { setTimeout(r, 250); });
  }
  function listeningInodes() {
    const inodes = {};
    ['/proc/net/tcp', '/proc/net/tcp6'].forEach(function (f) {
      let rows = [];
      try { rows = fs.readFileSync(f, 'utf8').split('\n').slice(1); } catch (e) { rows = []; }
      rows.forEach(function (row) {
        const c = row.trim().split(/\s+/);
        if (c[3] === '0A') inodes[c[9]] = true;   // st 0A is LISTEN; column 9 is the inode
      });
    });
    return inodes;
  }
  const listening = listeningInodes();
  let held = [];
  try {
    held = fs.readdirSync('/proc/' + child.pid + '/fd').map(function (fd) {
      try { return fs.readlinkSync('/proc/' + child.pid + '/fd/' + fd); } catch (e) { return ''; }
    }).map(function (l) { const m = /^socket:\[(\d+)\]$/.exec(l); return m ? m[1] : ''; })
      .filter(function (i) { return i && listening[i]; });
  } catch (e) { held = ['(could not read /proc/' + child.pid + '/fd)']; }
  if (page && page.status === 200 && held.length === 0) {
    test.check('the app server answers GET / over its pipe, and the kernel shows it listening on no TCP port');
  } else {
    test.fail('over the pipe: ' + (page && (page.status || page.refused)) + '; TCP listeners held: ' + JSON.stringify(held));
  }
  child.kill();
}

function mentions(value, needle) {
  return JSON.stringify(value === undefined ? null : value).indexOf(JSON.stringify(needle).slice(1, -1)) !== -1;
}

(async function () {
  // ── (a) REFUSED BEFORE THE DOOR ───────────────────────────────────────
  test.subHeading('An unknown name and an oversize request never reach a pipe');
  const w = await world(function (req, res) { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('hi'); });
  const unknown = await w.servers.toLocalApp('nobody', { method: 'GET', path: '/' });
  const big = await w.servers.toLocalApp('faceProof', { method: 'POST', path: '/', body: 'x'.repeat(limits.BODY_MAX + 1) });
  if (unknown.status === 404 && unknown.body.code === 'app-not-served'
      && big.status === 413 && big.body.code === 'app-request-too-large'
      && w.knocks() === 0 && w.seen.length === 0) {
    test.check('app-not-served and app-request-too-large are answered by the node without knocking on any pipe');
  } else {
    test.fail('refused before the door: ' + JSON.stringify({ unknown: unknown, big: big.status, knocks: w.knocks(), seen: w.seen.length }));
  }

  // ── (b) THE LIMITS NEST ───────────────────────────────────────────────
  test.subHeading('Each link waits less than the one outside it');
  const faceSource = fs.readFileSync(path.join(RUN, 'shell', 'appFaceApp', 'appFaceApp.js'), 'utf8');
  const serveWait = Number((faceSource.match(/const SERVE_WAIT_MS = (\d+);/) || [])[1]);
  if (serveWait > 0 && appClient.DOOR_WAIT_MS < serveWait && serveWait < puppetPost.FACE_WAIT_MS) {
    test.check('the hop (' + appClient.DOOR_WAIT_MS + ' ms) < appFaceApp\'s serve (' + serveWait + ' ms) < the face ('
      + puppetPost.FACE_WAIT_MS + ' ms): a slow app is named app-did-not-answer, not owner-did-not-answer');
  } else {
    test.fail('the waits do not nest: hop ' + appClient.DOOR_WAIT_MS + ', serve ' + serveWait + ', face ' + puppetPost.FACE_WAIT_MS);
  }

  // ── (c) A REAL SILENT SERVER, A REAL OVERSIZE ANSWER ──────────────────
  test.subHeading('A real server that fails says which way, by name');
  const silent = await world(function () { /* never answers */ });
  const t0 = Date.now();
  const hung = await relayRequest.pipeRequest(silent.pipe, 'GET', '/', '', { timeoutMs: 300 });
  const took = Date.now() - t0;
  if (hung && hung.refused === 'app-did-not-answer' && took < 2000) {
    test.check('a server that never answers is app-did-not-answer at its limit (' + took + ' ms for 300), not a hang');
  } else {
    test.fail('a silent server: ' + JSON.stringify(hung) + ' after ' + took + ' ms');
  }
  silent.server.close();

  const huge = await world(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('y'.repeat(appClient.ANSWER_MAX + 1));
  });
  const tooBig = await huge.servers.toLocalApp('faceProof', { method: 'GET', path: '/' });
  if (tooBig.status === 502 && tooBig.body && tooBig.body.code === 'app-answer-too-large') {
    test.check('an answer one byte over ANSWER_MAX is app-answer-too-large, 502, never a page cut short');
  } else {
    test.fail('an oversize answer: ' + JSON.stringify(tooBig).slice(0, 200));
  }
  huge.server.close();

  // ── (d) ONLY THE CONTENT TYPE CROSSES ─────────────────────────────────
  test.subHeading('The content type crosses both ways, and nothing else the visitor sent');
  const typed = await w.servers.toLocalApp('faceProof', {
    method: 'POST', path: '/api/spirit', body: '{"verb":"app.state"}', type: 'application/json',
    headers: { cookie: 'session=secret', 'x-forwarded-for': '203.0.113.9', authorization: 'Bearer t' },
    cookie: 'session=secret',
  });
  const got = w.seen[w.seen.length - 1] || { headers: {} };
  const names = Object.keys(got.headers).sort();
  const allowed = ['connection', 'content-length', 'content-type', 'host'];
  const extra = names.filter(function (n) { return allowed.indexOf(n) === -1; });
  if (got.headers['content-type'] === 'application/json' && extra.length === 0) {
    test.check('the app sees the content type and only transport headers (' + names.join(', ') + '): no cookie, no auth, no forwarded address');
  } else {
    test.fail('headers the app saw: ' + JSON.stringify(got.headers));
  }
  if (typed.status === 200 && typed.type === 'text/plain' && typed.body === 'hi') {
    test.check('the app\'s own content type comes back with its answer');
  } else {
    test.fail('the answer: ' + JSON.stringify(typed));
  }

  // ── (e) NO ADDRESS ON THE WIRE ────────────────────────────────────────
  test.subHeading('The pipe\'s path is never in anything handed back');
  const dead = await world(function () {});
  dead.server.close();
  await new Promise(function (r) { setTimeout(r, 50); });
  const answers = [
    typed,
    tooBig,
    await dead.servers.toLocalApp('faceProof', { method: 'GET', path: '/' }),
    await w.servers.toLocalApp('nobody', { method: 'GET', path: '/' }),
  ];
  const leaked = answers.filter(function (a) {
    return [w.pipe, huge.pipe, dead.pipe, scratch].some(function (p) { return mentions(a, p); });
  });
  if (answers[2].status === 503 && answers[2].body.code === 'app-not-running' && leaked.length === 0) {
    test.check('an answer, and the refusals app-answer-too-large, app-not-running and app-not-served, carry no pipe path and no folder');
  } else {
    test.fail('leaked or wrong: ' + JSON.stringify({ dead: answers[2], leaked: leaked }).slice(0, 300));
  }

  w.server.close();

  // ── (f) THE WHOLE ROUTE, BROWSER TO APP SERVER AND BACK ───────────────
  await wholeRoute();

  // ── (h) G18: THE APP PROCESS OPENS NO TCP PORT ────────────────────────
  await noTcpPort();

  // ── (g) THE NODE KNOWS APPS, NOT FACES ────────────────────────────────
  //
  //   Andy, 2026-09-27: "the core only knows about puppets (nodes owned by
  //   nodes, not people). the face-name/app-or-member table must be owned
  //   by appFaceApp, not by the puppet-infrastructure." Built as 5310ba7.
  //   Code lines only: a comment may tell the history.
  test.subHeading('The node\'s app-server code has no face vocabulary');
  const faceWords = ['js/appClient.js', 'js/jobs.js'].filter(function (rel) {
    // /\r?\n/: on a Windows checkout every line ends in \r, and `.*$` then
    // never reached the end, so no comment was stripped. 'interface' and
    // 'surface' are not a face (both found on Windows, 2026-09-27), and are
    // removed rather than excluded by \b, which would let camelCase such as
    // readFaces slip past (wsl-claude).
    const code = fs.readFileSync(path.join(RUN, rel), 'utf8').split(/\r?\n/)
      .map(function (line) { return line.replace(/\/\/.*$/, ''); }).join('\n')
      .replace(/\b(inter|sur)face/gi, '');
    return /face/i.test(code);
  });
  if (faceWords.length === 0) {
    test.check('appClient.js and jobs.js name apps and servers, never a face: which app answers a name is appFaceApp\'s table');
  } else {
    test.fail('face vocabulary in the node\'s code: ' + faceWords.join(', '));
  }

  fs.rmSync(scratch, { recursive: true, force: true });
  test.reportSuccessFailureCount();
}()).catch(function (e) {
  test.fail('the suite itself failed: ' + (e && e.stack || e));
  test.reportSuccessFailureCount();
});
