'use strict';

// spirit/test/appFaceProcess.js
// goal/G13.2: appFaceApp runs as a process/js server, and the face machinery leaves the node.
// Written first, red on today's code (1ed9965e). The rulings are the goal's box (goal/G13),
// Andy's of 2026-10-10; the build list is the item's box.
//
//   "why the fuck is that thing still in shell?"
//   "appServers have the node's port, which gives them FULL access to peerPost"
//   "a second door has NOTHING to do with being a puppet."
//   "wh the fucdk does the node need a second fucking branch for opening a fucking process?"
//   "no \"face\" crap belongs into node."
//   "KILL faceProof completely and just let appFaceAppServer respond to that json request. DONE."
//
// WHAT IS ASSERTED
//   T1  the tree: the server exists under process/js, the shell app, faceProof, faceServer,
//       puppetPost and nodeApps are gone, puppetMode.js keeps the puppet machinery, server.js
//       has no --app and no mountAll, appServer listens on a pipe only, appClient keeps what
//       every process uses and nothing of the face, face-install writes the port into the
//       server's own config.
//   T2  the owner's side, a real process on a pipe: route asks grantFace through jobs.api on
//       its node; serve asks appFaceAppServer through jobs.api and hands the answer back.
//   T3  the face's side, the same script with a port in its config: it opens the port, serves
//       index.html and kernel.js itself, carries a browser's POST /api/spirit to the owner as
//       the serve ask over peerPost, asks the route once and remembers it, answers 404
//       no-such-route by name for a name nobody granted, and answers Caddy's loopback ask.
//   T4  appFaceAppServer answers the serve ask itself: a json ask gets the proof, typed json,
//       and nothing passes through a pipe to anything.
//
// THE ONE FAKE is the node: a loopback door answering peer.post and jobs.api, and an event
// stream carrying the owner's answer back, exactly as kernel.peerPost reads it. Everything
// else is the real thing: appServer, appClient, the packet codec, two spawned processes.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const test = require('./testSupport.js');

const REPO = path.join(__dirname, '..', '..');
const RUN = path.join(REPO, 'spirit', 'run');
const OWED = 'OWED by goal/G13.2: ';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function exists(rel) { return fs.existsSync(path.join(RUN, rel)); }
function code(rel) {
  try { return fs.readFileSync(path.join(RUN, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1'); }
  catch (e) { return ''; }
}
function freePort() {
  return new Promise(function (resolve) {
    const s = net.createServer().listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); });
  });
}
function httpAsk(port, method, pathname, host, body, type) {
  return new Promise(function (resolve) {
    const headers = { Host: host };
    if (type) headers['Content-Type'] = type;
    const req = http.request({ hostname: '127.0.0.1', port: port, path: pathname, method: method, headers: headers }, function (res) {
      let t = '';
      res.on('data', function (c) { t += c; });
      res.on('end', function () { let j = null; try { j = JSON.parse(t); } catch (e) { j = null; } resolve({ status: res.statusCode, type: res.headers['content-type'] || '', text: t, json: j }); });
    });
    req.on('error', function (e) { resolve({ status: 0, text: String(e) }); });
    req.setTimeout(30000, function () { req.destroy(new Error('timeout')); });
    req.end(body || '');
  });
}

test.startTest('goal/G13.2: appFaceApp as a process, the face machinery out of the node');

// ── T1: THE TREE ──────────────────────────────────────────────────────
test.subHeading('T1: the server is a process; the face machinery is gone from the node');
{
  const server = code('process/js/appFaceApp/appFaceApp.js');
  if (server && /appServer/.test(server) && /serve\(/.test(server)) test.check('process/js/appFaceApp/appFaceApp.js exists and serves through appServer');
  else test.fail(OWED + 'no process/js/appFaceApp/appFaceApp.js on appServer.serve');
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(path.join(RUN, 'process', 'js', 'appFaceApp', 'appFaceApp.json'), 'utf8')); } catch (e) { manifest = null; }
  if (manifest && manifest.kind === 'server' && manifest.operated === 'node') test.check('its manifest says kind server, operated node, so startNodeServers starts it like every process');
  else test.fail(OWED + 'process/js/appFaceApp/appFaceApp.json is not a node-operated server manifest');
  if (exists('process/js/appFaceApp/index.html') && exists('process/js/appFaceApp/faceRoute.js')) test.check('index.html and faceRoute.js live beside it: the page is the face\'s own, the cache moved with the app');
  else test.fail(OWED + 'index.html or faceRoute.js missing beside the server');
  const gone = ['shell/appFaceApp', 'process/js/faceProof', 'js/faceServer.js', 'js/puppetPost.js', 'js/nodeApps.js', 'js/faceRoute.js'].filter(exists);
  if (!gone.length) test.check('shell/appFaceApp, process/js/faceProof, faceServer.js, puppetPost.js, nodeApps.js and js/faceRoute.js are gone');
  else test.fail(OWED + 'still in the tree: ' + gone.join(', '));
  let pm = null;
  try { pm = require('../run/js/puppetMode'); } catch (e) { pm = null; }
  if (pm && typeof pm.puppetIn === 'function' && typeof pm.ownerCommandIn === 'function' && typeof pm.puppetDoor === 'function'
      && typeof pm.mountAll !== 'function' && typeof pm.scopedFs !== 'function' && typeof pm.boots !== 'function') {
    test.check('puppetMode.js keeps puppetIn, ownerCommandIn and puppetDoor, and has no mountAll, scopedFs or boots');
  } else test.fail(OWED + 'puppetMode.js: ' + (pm ? Object.keys(pm).sort().join(',') : 'missing'));
  const srv = code('js/server.js');
  if (srv && !/--app/.test(srv) && !/mountAll/.test(srv) && !/faceConfigIn|puppetPost/.test(srv) && /puppetMode/.test(srv)) {
    test.check('server.js has no --app dispatch, no mountAll, no face block; it requires puppetMode');
  } else test.fail(OWED + 'server.js still: --app ' + /--app/.test(srv) + ', mountAll ' + /mountAll/.test(srv) + ', face block ' + /faceConfigIn|puppetPost/.test(srv) + ', puppetMode ' + /puppetMode/.test(srv));
  const as = code('js/appServer.js');
  if (as && !/typeof target === 'number'/.test(as) && !/server\.listen\(target, '127\.0\.0\.1'/.test(as)) test.check('appServer listens on the pipe the node names, and on no number');
  else test.fail(OWED + 'appServer.js still has the number branch in listen');
  const ac = code('js/appClient.js');
  const faceHalf = ['readServers', 'servesOf', 'startAll', 'toLocalApp'].filter(function (n) { return new RegExp('\\b' + n + '\\b').test(ac); });
  const kept = ['pipePathFor', 'createAppClient', 'ANSWER_MAX'].every(function (n) { return new RegExp('\\b' + n + '\\b').test(ac); });
  if (ac && !faceHalf.length && kept) test.check('appClient keeps pipePathFor, createAppClient and ANSWER_MAX, and has no readServers, servesOf, startAll or toLocalApp');
  else test.fail(OWED + 'appClient.js: face half left ' + JSON.stringify(faceHalf) + ', kept ' + kept);
  const afs = code('process/js/appFaceAppServer/appFaceAppServer.js');
  if (afs && !/pipeRequest|faceProof/.test(afs) && /serve/.test(afs)) test.check('appFaceAppServer has no pass-through over a pipe and names no faceProof');
  else test.fail(OWED + 'appFaceAppServer.js still passes through: pipeRequest ' + /pipeRequest/.test(afs) + ', faceProof ' + /faceProof/.test(afs));
  let install = '';
  try { install = fs.readFileSync(path.join(REPO, 'bash', 'face-install'), 'utf8').replace(/^\s*#.*$/mg, ''); } catch (e) { install = ''; }
  if (install && /relay-state\/process\/appFaceApp/.test(install) && !/relay-state\/face\.json|\$STATE\/face\.json/.test(install) && /process\/js\/appFaceApp/.test(install)) {
    test.check('bash/face-install writes the port into the server\'s own state folder, lists process/js/appFaceApp, and writes no relay-state/face.json');
  } else test.fail(OWED + 'bash/face-install: server config ' + /relay-state\/process\/appFaceApp/.test(install) + ', include ' + /process\/js\/appFaceApp/.test(install) + ', still face.json ' + /relay-state\/face\.json|\$STATE\/face\.json/.test(install));
}

// ── THE FAKE NODE ─────────────────────────────────────────────────────
// A loopback door: peer.post takes a packet for a key and answers a hash; jobs.api hands an ask
// to a fake grantFace or a fake appFaceAppServer; /api/events streams packets to whoever listens.
// What the puppet posts is answered the way the owner's api door would: the owner's own
// appFaceApp server is asked (when `owner` names one) and its reply travels back as an 'api'
// packet carrying re.
function fakeNode(opts) {
  const o = opts || {};
  const packet = require('../run/js/client/packet.js');
  const listeners = [];
  const posted = [];
  const asked = [];
  function push(from, text) {
    const line = 'event: packet\ndata: ' + JSON.stringify({ from: from, text: text }) + '\n\n';
    listeners.slice().forEach(function (res) { try { res.write(line); } catch (e) { /* gone */ } });
  }
  function answerAsk(ask) {
    // jobs.api: { ask: 'api' } or { ask: { app: { verb: args } } }
    if (ask === 'api') return Promise.resolve({ grantFace: {}, appFaceAppServer: {} });
    const app = ask && typeof ask === 'object' ? Object.keys(ask)[0] : '';
    const verbs = app ? ask[app] : null;
    const verb = verbs && typeof verbs === 'object' ? Object.keys(verbs)[0] : '';
    const args = verb ? verbs[verb] : null;
    asked.push({ app: app, verb: verb, args: args });
    if (app === 'grantFace' && verb === 'get') {
      const name = String((args && args.name) || '');
      return Promise.resolve({ name: name, id: (o.holders && o.holders[name]) || '' });
    }
    if (app === 'appFaceAppServer' && verb === 'serve') {
      return Promise.resolve({ status: 200, type: 'application/json; charset=utf-8', body: JSON.stringify({ ok: true, app: 'appFaceAppServer', echo: args }) });
    }
    if (app === 'appFaceApp' && o.ownerAsk) return o.ownerAsk(verb, args);
    return Promise.resolve({ ok: false, code: 'app-not-served', error: 'no such app', extra: { app: app } });
  }
  const server = http.createServer(function (req, res) {
    if (req.method === 'GET' && req.url === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      res.write(': hello\n\n');
      listeners.push(res);
      req.on('close', function () { const i = listeners.indexOf(res); if (i !== -1) listeners.splice(i, 1); });
      return;
    }
    let b = '';
    req.on('data', function (c) { b += c; });
    req.on('end', function () {
      let body = null;
      try { body = JSON.parse(b || '{}'); } catch (e) { body = null; }
      function answer(status, obj) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }
      if (!body || req.url !== '/api/spirit') return answer(404, { ok: false, error: 'not found' });
      if (body.verb === 'peer.post') {
        const hash = crypto.randomBytes(16).toString('hex');
        const info = packet.decode(body.text);
        posted.push({ to: body.to, app: info && info.app, body: info && info.body, hash: hash });
        answer(200, { ok: true, hash: hash });
        // The owner's api door: the appFaceApp server on the owner's node answers, and its reply
        // comes back as an 'api' packet with re. Only the owner answers; anybody else is silence.
        if (body.to === o.ownerKey && info && info.app === 'api' && info.body && info.body.appFaceApp) {
          const verb = Object.keys(info.body.appFaceApp)[0];
          const args = info.body.appFaceApp[verb];
          Promise.resolve(o.ownerAsk ? o.ownerAsk(verb, args) : { ok: false, code: 'not-granted' }).then(function (reply) {
            const made = packet.encode('api', reply, { re: hash });
            setTimeout(function () { push(o.ownerKey, made.text); }, 10);
          });
        }
        return;
      }
      if (body.verb === 'jobs.api') {
        return answerAsk(body.ask).then(function (r) { answer(200, r); });
      }
      answer(400, { ok: false, error: 'no such verb', verb: body.verb });
    });
  });
  return new Promise(function (resolve) {
    server.listen(0, '127.0.0.1', function () {
      resolve({ port: server.address().port, posted: posted, asked: asked,
        close: function () { listeners.forEach(function (r) { try { r.end(); } catch (e) { /* gone */ } }); server.close(); if (server.closeAllConnections) server.closeAllConnections(); } });
    });
  });
}

// A root of its own for one appFaceApp process: the script copied beside a junction to the
// real js/, its state folder, the node's owner.json. The process reads its root from its own
// location, as every process does.
function plantRoot(label, nodePort, extra) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-appface-' + label + '-'));
  const dir = path.join(root, 'process', 'js', 'appFaceApp');
  fs.mkdirSync(dir, { recursive: true });
  const src = path.join(RUN, 'process', 'js', 'appFaceApp');
  if (fs.existsSync(src)) fs.cpSync(src, dir, { recursive: true });
  fs.symlinkSync(path.join(RUN, 'js'), path.join(root, 'js'), 'junction');
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  const state = path.join(root, 'relay-state', 'process', 'appFaceApp');
  fs.mkdirSync(state, { recursive: true });
  Object.keys(extra || {}).forEach(function (f) { fs.writeFileSync(path.join(state, f), extra[f]); });
  const appClient = require('../run/js/appClient.js');
  const pipe = appClient.pipePathFor(root, 'appFaceApp', process.platform, 'process');
  return { root: root, dir: dir, state: state, pipe: pipe, nodePort: nodePort };
}

function startServer(planted) {
  const script = path.join(planted.dir, 'appFaceApp.js');
  if (!fs.existsSync(script)) return null;
  return spawn(process.execPath, [script, '{}', '--pipe', planted.pipe, '--state', planted.state], {
    cwd: planted.root,
    env: Object.assign({}, process.env, { SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + planted.nodePort + '/api/spirit', SPIRIT_JOB_ID: 'test' }),
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  });
}

async function doorUp(client, name, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await client.ask('api');
      if (r && r.body && r.body[name] && r.body[name].ok !== false) return true;
    } catch (e) { /* not yet */ }
    await sleep(150);
  }
  return false;
}

(async function () {
  const auth = require('../run/js/relayAuth.js');
  const appClient = require('../run/js/appClient.js');
  const OWNER = auth.generateIdentity('owner').publicKey;
  const MEMBER = auth.generateIdentity('member').publicKey;
  const FACE_DOMAIN = 'face.spirit.test';
  const kids = [];
  const nodes = [];
  try {
    // ── T2: THE OWNER'S SIDE ───────────────────────────────────────────
    test.subHeading('T2: on the owner\'s node the server answers route and serve through jobs.api');
    const ownerNode = await fakeNode({ holders: { join: OWNER, joe: MEMBER } });
    nodes.push(ownerNode);
    const owner = plantRoot('owner', ownerNode.port, { 'face-domain.json': JSON.stringify({ faceDomain: FACE_DOMAIN }) });
    const ownerKid = startServer(owner);
    if (!ownerKid) {
      test.fail(OWED + 'no server to start on the owner\'s side');
    } else {
      kids.push(ownerKid);
      const client = appClient.createAppClient({ rootDir: owner.root, log: function () {} });
      client.register('appFaceApp', owner.pipe);
      if (!(await doorUp(client, 'appFaceApp', 10000))) test.fail(OWED + 'the owner\'s appFaceApp never answered api on its pipe');
      const tree = (await client.ask('api')).body;
      const verbs = tree && tree.appFaceApp ? Object.keys(tree.appFaceApp).sort() : [];
      if (verbs.indexOf('route') !== -1 && verbs.indexOf('serve') !== -1 && verbs.indexOf('DEBUG') !== -1) {
        test.check('its api declares route and serve, with DEBUG on it like every server\'s: ' + verbs.join(', '));
      } else test.fail(OWED + 'the verb tree reads ' + JSON.stringify(verbs));
      const r1 = await client.ask({ appFaceApp: { route: { host: 'join.' + FACE_DOMAIN } } });
      const r2 = await client.ask({ appFaceApp: { route: { host: 'nobody.' + FACE_DOMAIN } } });
      const r3 = await client.ask({ appFaceApp: { route: { host: 'join.' + FACE_DOMAIN + ':443' } } });
      if (r1.body && r1.body.route === 'owner' && r1.body.name === 'join' && r1.body.to === OWNER
          && r2.body && r2.body.route === 'none' && r2.body.name === 'nobody'
          && r3.body && r3.body.route === 'owner'
          && ownerNode.asked.filter(function (a) { return a.app === 'grantFace' && a.verb === 'get'; }).length === 3) {
        test.check('route asks grantFace through jobs.api for the name in the host: join is the owner\'s, nobody is none, a port on the host is ignored');
      } else test.fail(OWED + 'route answered ' + JSON.stringify([r1.body, r2.body, r3.body]).slice(0, 300) + '; grantFace asked ' + JSON.stringify(ownerNode.asked).slice(0, 200));
      const s1 = await client.ask({ appFaceApp: { serve: { host: 'join.' + FACE_DOMAIN, method: 'POST', path: '/api/spirit', body: '{"verb":"app.state"}', type: 'application/json' } } });
      let echoed = null;
      try { echoed = JSON.parse(s1.body && s1.body.body); } catch (e) { echoed = null; }
      const handed = ownerNode.asked.filter(function (a) { return a.app === 'appFaceAppServer' && a.verb === 'serve'; })[0];
      if (s1.body && s1.body.status === 200 && /json/.test(s1.body.type) && echoed && echoed.ok === true && handed && handed.args.path === '/api/spirit' && handed.args.body === '{"verb":"app.state"}') {
        test.check('serve hands host, method, path, body and type to appFaceAppServer through jobs.api and answers status, body and type as they came');
      } else test.fail(OWED + 'serve answered ' + JSON.stringify(s1.body).slice(0, 300) + '; handed ' + JSON.stringify(handed).slice(0, 200));
      const posts = ownerNode.posted.length;
      if (posts === 0) test.check('nothing left the owner\'s node over peerPost for either ask: the owner\'s side only answers');
      else test.fail(OWED + 'the owner\'s side posted ' + posts + ' packets');
    }

    // ── T3: THE FACE'S SIDE ────────────────────────────────────────────
    test.subHeading('T3: on the face node the same script opens its own port and carries a browser to the owner');
    const serves = [];
    const faceNode = await fakeNode({
      ownerKey: OWNER,
      ownerAsk: function (verb, args) {
        if (verb === 'route') {
          const name = String(args.host || '').split('.')[0];
          return Promise.resolve({ route: name === 'join' ? 'owner' : 'none', name: name, to: name === 'join' ? OWNER : '' });
        }
        if (verb === 'serve') {
          serves.push(args);
          return Promise.resolve({ status: 200, type: 'application/json; charset=utf-8', body: JSON.stringify({ ok: true, app: 'appFaceAppServer', path: args.path, body: args.body }) });
        }
        return Promise.resolve({ ok: false, code: 'no-such-verb' });
      },
    });
    nodes.push(faceNode);
    const facePort = await freePort();
    const face = plantRoot('face', faceNode.port, { 'face.json': JSON.stringify({ port: facePort }) });
    fs.writeFileSync(path.join(face.root, 'relay-state', 'owner.json'), JSON.stringify({ owner: OWNER }));
    const faceKid = startServer(face);
    if (!faceKid) {
      test.fail(OWED + 'no server to start on the face\'s side');
    } else {
      kids.push(faceKid);
      const client = appClient.createAppClient({ rootDir: face.root, log: function () {} });
      client.register('appFaceApp', face.pipe);
      if (!(await doorUp(client, 'appFaceApp', 10000))) test.fail(OWED + 'the face\'s appFaceApp never answered api on its pipe');
      let page = null;
      for (let i = 0; i < 40; i++) { page = await httpAsk(facePort, 'GET', '/', 'join.' + FACE_DOMAIN); if (page.status) break; await sleep(150); }
      if (page && page.status === 200 && /text\/html/.test(page.type) && /kernel\.js/.test(page.text) && /spirit\.core\.ask/.test(page.text)) {
        test.check('GET / on the face\'s own port is its index.html, which loads kernel.js and tells the visitor to call spirit.core.ask');
      } else test.fail(OWED + 'GET / on the face port: ' + JSON.stringify(page && { status: page.status, type: page.type, text: String(page.text).slice(0, 120) }));
      const kernel = await httpAsk(facePort, 'GET', '/kernel.js', 'join.' + FACE_DOMAIN);
      const real = fs.readFileSync(path.join(RUN, 'js', 'kernel.js'), 'utf8');
      if (kernel.status === 200 && /javascript/.test(kernel.type) && kernel.text === real) test.check('GET /kernel.js is the kernel itself, typed javascript, served by the face and not fetched from anywhere');
      else test.fail(OWED + 'GET /kernel.js: ' + kernel.status + ' ' + kernel.type + ', ' + String(kernel.text).length + ' bytes against ' + real.length);
      const ask1 = await httpAsk(facePort, 'POST', '/api/spirit', 'join.' + FACE_DOMAIN, '{"verb":"app.state"}', 'application/json');
      const routeAsks = faceNode.posted.filter(function (p) { return p.app === 'api' && p.body && p.body.appFaceApp && p.body.appFaceApp.route; });
      const serveAsks = faceNode.posted.filter(function (p) { return p.app === 'api' && p.body && p.body.appFaceApp && p.body.appFaceApp.serve; });
      if (ask1.status === 200 && ask1.json && ask1.json.ok === true && ask1.json.body === '{"verb":"app.state"}'
          && routeAsks.length === 1 && routeAsks[0].to === OWNER && serveAsks.length === 1 && serveAsks[0].to === OWNER
          && serveAsks[0].body.appFaceApp.serve.host === 'join.' + FACE_DOMAIN && serveAsks[0].body.appFaceApp.serve.path === '/api/spirit') {
        test.check('a browser\'s POST /api/spirit travels as the serve ask to the owner, an api packet over peerPost, and the owner\'s json answer comes back to the browser');
      } else test.fail(OWED + 'the ask through the face: ' + JSON.stringify(ask1).slice(0, 200) + '; routes ' + routeAsks.length + ', serves ' + serveAsks.length + ', posted ' + JSON.stringify(faceNode.posted).slice(0, 300));
      await httpAsk(facePort, 'POST', '/api/spirit', 'join.' + FACE_DOMAIN, '{"verb":"again"}', 'application/json');
      const routesAfter = faceNode.posted.filter(function (p) { return p.body && p.body.appFaceApp && p.body.appFaceApp.route; }).length;
      const servesAfter = faceNode.posted.filter(function (p) { return p.body && p.body.appFaceApp && p.body.appFaceApp.serve; }).length;
      if (routesAfter === 1 && servesAfter === 2) test.check('the route is asked once and remembered: a second ask for join goes straight on as a serve');
      else test.fail(OWED + 'after a second ask: routes ' + routesAfter + ' (want 1), serves ' + servesAfter + ' (want 2)');
      const nobody = await httpAsk(facePort, 'POST', '/api/spirit', 'nobody.' + FACE_DOMAIN, '{"verb":"x"}', 'application/json');
      const servesNobody = faceNode.posted.filter(function (p) { return p.body && p.body.appFaceApp && p.body.appFaceApp.serve; }).length;
      if (nobody.status === 404 && nobody.json && nobody.json.code === 'no-such-route' && servesNobody === 2) test.check('a name nobody granted is 404 no-such-route by name, and nothing is forwarded to be served');
      else test.fail(OWED + 'an ungranted name: ' + JSON.stringify(nobody).slice(0, 200) + ', serves ' + servesNobody);
      const loop = '127.0.0.1:' + facePort;
      const askJoin = await httpAsk(facePort, 'GET', '/.well-known/spirit-name?domain=join.' + FACE_DOMAIN, loop);
      const askNobody = await httpAsk(facePort, 'GET', '/.well-known/spirit-name?domain=nobody.' + FACE_DOMAIN, loop);
      // The same path from a visitor keeps the visitor's own Host, so it is an ordinary visit for
      // join, served by the owner, and says nothing about nobody: no directory of names.
      const servesBefore = faceNode.posted.filter(function (p) { return p.body && p.body.appFaceApp && p.body.appFaceApp.serve; }).length;
      const askPublic = await httpAsk(facePort, 'GET', '/.well-known/spirit-name?domain=nobody.' + FACE_DOMAIN, 'join.' + FACE_DOMAIN);
      const servesAfterAsk = faceNode.posted.filter(function (p) { return p.body && p.body.appFaceApp && p.body.appFaceApp.serve; }).length;
      if (askJoin.status === 200 && askNobody.status === 404 && askPublic.status === 200 && servesAfterAsk === servesBefore + 1) test.check('Caddy\'s loopback ask before a certificate: 200 for join, 404 for a name nobody granted; the same path from a visitor is an ordinary visit for the visitor\'s own name, served by the owner, no directory of names');
      else test.fail(OWED + 'the certificate ask: join ' + askJoin.status + ', nobody ' + askNobody.status + ', from a visitor ' + askPublic.status + ' with serves ' + servesBefore + ' -> ' + servesAfterAsk);
      const big = await httpAsk(facePort, 'POST', '/api/spirit', 'join.' + FACE_DOMAIN, 'x'.repeat(require('../run/js/limits.js').BODY_MAX + 1), 'application/json');
      if (big.status === 413) test.check('a body over BODY_MAX is refused 413 at the face, unread');
      else test.fail(OWED + 'an oversize body answered ' + big.status);
    }

    // ── T4: appFaceAppServer ANSWERS ITSELF ────────────────────────────
    test.subHeading('T4: appFaceAppServer answers the serve ask itself, and passes nothing through');
    const SERVER = path.join(RUN, 'process', 'js', 'appFaceAppServer');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-appfaceserver-'));
    fs.cpSync(SERVER, path.join(root, 'process', 'js', 'appFaceAppServer'), { recursive: true });
    fs.symlinkSync(path.join(RUN, 'js'), path.join(root, 'js'), 'junction');
    const state = path.join(root, 'relay-state', 'process', 'appFaceAppServer');
    fs.mkdirSync(state, { recursive: true });
    const pipe = appClient.pipePathFor(root, 'appFaceAppServer', process.platform, 'process');
    const kid = spawn(process.execPath, [path.join(root, 'process', 'js', 'appFaceAppServer', 'appFaceAppServer.js'), '{}', '--pipe', pipe, '--state', state],
      { cwd: root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    kids.push(kid);
    const client = appClient.createAppClient({ rootDir: root, log: function () {} });
    client.register('appFaceAppServer', pipe);
    if (!(await doorUp(client, 'appFaceAppServer', 10000))) test.fail(OWED + 'appFaceAppServer never answered api on its pipe');
    const tree = (await client.ask('api')).body;
    if (tree && tree.appFaceAppServer && tree.appFaceAppServer.serve) test.check('appFaceAppServer declares serve');
    else test.fail(OWED + 'appFaceAppServer\'s tree: ' + JSON.stringify(tree && tree.appFaceAppServer).slice(0, 200));
    const proof = await client.ask({ appFaceAppServer: { serve: { host: 'join.' + FACE_DOMAIN, method: 'POST', path: '/api/spirit', body: '{"verb":"app.state"}', type: 'application/json' } } });
    let said = null;
    try { said = JSON.parse(proof.body && proof.body.body); } catch (e) { said = null; }
    if (proof.body && proof.body.status === 200 && /json/.test(proof.body.type) && said && said.ok === true && said.app === 'appFaceAppServer' && said.verb === 'app.state') {
      test.check('a json ask for app.state is answered by appFaceAppServer itself, typed json, naming the app and the verb: the proof');
    } else test.fail(OWED + 'serve answered ' + JSON.stringify(proof.body).slice(0, 300));
    const other = await client.ask({ appFaceAppServer: { serve: { host: 'join.' + FACE_DOMAIN, method: 'GET', path: '/anything', body: '', type: '' } } });
    let saidOther = null;
    try { saidOther = JSON.parse(other.body && other.body.body); } catch (e) { saidOther = null; }
    if (other.body && other.body.status === 404 && saidOther && saidOther.ok === false) test.check('any other request is 404 by name: there is no page behind it and no pipe to pass it to');
    else test.fail(OWED + 'GET /anything answered ' + JSON.stringify(other.body).slice(0, 200));
  } catch (e) {
    test.fail('the suite itself failed: ' + ((e && e.stack) || e));
  } finally {
    kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
    nodes.forEach(function (n) { try { n.close(); } catch (e) { /* gone */ } });
    await sleep(200);
    test.reportSuccessFailureCount();
    process.exit(0);
  }
}());
