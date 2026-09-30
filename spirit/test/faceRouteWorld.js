'use strict';

// spirit/test/faceRouteWorld.js
// THE FACE ROUTE, END TO END, IN ONE PROCESS: A BROWSER'S REQUEST REACHES
// THE NODE THAT OWNS THE NAME, AND ITS ANSWER COMES BACK (G17, step 1).
//
//   Andy, 2026-09-27: "step 1) build and prove the route from browser to
//   owner-of-subdomain, and back". Proven live the same day
//   (join.face.spirit.andyflinn.com -> 501 last-leg-not-built naming his
//   key). This is the same route, kept proven on every harness run.
//
// Real parts: puppetPost's HTTP listener, appFaceApp mounted twice through
// the real nodeApps.mountAll (the puppet, handed the face; the owner,
// holding face-domain.json, asking a grantFace stand-in), the real packet codec and the
// real arrivals seam. The ONE fake is the relay: a function that hands a
// posted packet to the other node's arrivals, with a hash, as peerPost's
// arrival record would. The relay's transport is proven by its own suites.

const os = require('os');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const test = require('./testSupport.js');
const nodeApps = require('../run/js/nodeApps');
const arrivalsMod = require('../run/js/arrivals');
const puppetPost = require('../run/js/puppetPost');
const packet = require('../run/js/client/packet');
const auth = require('../run/js/relayAuth');

test.startTest('A browser request for a face name reaches the node that owns it, and the answer comes back');

const RUN = path.join(__dirname, '..', 'run');
const FACE_DOMAIN = 'face.spirit.test';

// A node's home: its own copy of appFaceApp (so two mounts are two
// modules), the real js/ beside it for the app's requires.
function home(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-face-' + label + '-'));
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
const nodes = {};          // publicKey -> arrivals
const wire = [];           // every packet posted: { from, to, body }

// The relay: deliver to the other node's arrivals, a tick later, as a
// real post's answer arrives after the post itself returns.
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

function request(port, host, pathname) {
  return new Promise(function (resolve) {
    const req = http.request({ hostname: '127.0.0.1', port: port, path: pathname || '/', method: 'GET', headers: { Host: host } },
      function (res) {
        let t = '';
        res.on('data', function (c) { t += c; });
        res.on('end', function () { let j = null; try { j = JSON.parse(t); } catch (e) { j = null; } resolve({ status: res.statusCode, json: j, text: t }); });
      });
    req.on('error', function (e) { resolve({ status: 0, error: String(e) }); });
    req.setTimeout(30000, function () { req.destroy(new Error('timeout')); });
    req.end();
  });
}
function grantFaceStandIn(holders, rest) {
  return { toLocalApp: function (app, req) {
    if (app !== 'grantFace') return rest ? rest.toLocalApp(app, req) : Promise.resolve({ status: 404, body: '{}' });
    let b = {};
    try { b = JSON.parse(req.body); } catch (e) { b = {}; }
    const name = (b.get && b.get.name) || '';
    return Promise.resolve({ status: 200, type: 'application/json', body: JSON.stringify({ name: name, id: holders[name] || '' }) });
  } };
}
function verbs(to, verb) {
  return wire.filter(function (w) { return w.to === to && w.body && w.body.verb === verb; });
}

(async function () {
  // THE OWNER'S NODE: holds the face domain and the grant for 'join'.
  const owner = home('owner');
  fs.writeFileSync(path.join(owner.app, 'face-domain.json'), JSON.stringify({ faceDomain: FACE_DOMAIN }));
  nodes[ownerId.publicKey] = arrivalsMod.createArrivals({});
  nodeApps.mountAll({ rootDir: owner.root, arrivals: nodes[ownerId.publicKey], post: postFrom(ownerId.publicKey),
    servers: grantFaceStandIn({ join: ownerId.publicKey }), log: function () {} });

  // THE PUPPET ON THE VPS: owned by the owner, with the face.
  const puppet = home('puppet');
  fs.writeFileSync(path.join(puppet.root, 'relay-state', 'puppet.json'),
    JSON.stringify({ owner: ownerId.publicKey, carries: [] }));
  nodes[puppetId.publicKey] = arrivalsMod.createArrivals({});
  const face = puppetPost.createPuppetPost({ log: function () {} });
  const server = await new Promise(function (r) { face.listen(0, r); });
  const port = server.address().port;
  nodeApps.mountAll({ rootDir: puppet.root, arrivals: nodes[puppetId.publicKey], face: face,
    post: postFrom(puppetId.publicKey), log: function () {} });

  // ── (a) THE ROUTE, THERE AND BACK ─────────────────────────────────────
  const first = await request(port, 'join.' + FACE_DOMAIN, '/');
  if (first.status === 404 && first.json && first.json.why === 'no-handler' && first.json.name === 'join') {
    test.check('a browser request for join.' + FACE_DOMAIN + ' reaches the owner\'s node and its answer comes back: '
      + '404 no-handler, which only the owner\'s node gives, until G1.10');
  } else {
    test.fail('the route did not come back: ' + JSON.stringify(first));
  }

  // ── (b) WHAT REACHED THE OWNER ────────────────────────────────────────
  const served = verbs(ownerId.publicKey, 'serve')[0];
  if (served && served.from === puppetId.publicKey && served.body.host === 'join.' + FACE_DOMAIN && served.body.path === '/') {
    test.check('the owner received the visitor\'s request from its own puppet, carrying the host and the path');
  } else {
    test.fail('what reached the owner: ' + JSON.stringify(verbs(ownerId.publicKey, 'serve')));
  }

  // ── (c) ASKED ONCE, THEN REMEMBERED ───────────────────────────────────
  await request(port, 'join.' + FACE_DOMAIN, '/again');
  const asked = verbs(ownerId.publicKey, 'route?').filter(function (w) { return w.body.host === 'join.' + FACE_DOMAIN; });
  const serves = verbs(ownerId.publicKey, 'serve').length;
  if (asked.length === 1 && serves === 2) {
    test.check('the puppet asks its owner where "join" lives once, and the second request goes straight on from its cache');
  } else {
    test.fail('route questions for join: ' + asked.length + ' (want 1); serve posts: ' + serves + ' (want 2)');
  }

  // ── (d) A NAME NOBODY GRANTED ─────────────────────────────────────────
  const beforeServes = verbs(ownerId.publicKey, 'serve').length;
  const unknown = await request(port, 'nobody.' + FACE_DOMAIN, '/');
  if (unknown.status === 404 && unknown.json && unknown.json.code === 'no-such-route'
      && verbs(ownerId.publicKey, 'serve').length === beforeServes) {
    test.check('a name nobody granted is answered 404 no-such-route by name, and nothing is forwarded to be served');
  } else {
    test.fail('an ungranted name: ' + JSON.stringify(unknown) + ', serve posts went ' + beforeServes + ' -> '
      + verbs(ownerId.publicKey, 'serve').length);
  }

  // ── (e) CADDY'S QUESTION, ONLY ON LOOPBACK ────────────────────────────
  const loop = '127.0.0.1:' + port;
  const askJoin = await request(port, loop, '/.well-known/spirit-name?domain=join.' + FACE_DOMAIN);
  const askNobody = await request(port, loop, '/.well-known/spirit-name?domain=nobody.' + FACE_DOMAIN);
  if (askJoin.status === 200 && askNobody.status === 404) {
    test.check('Caddy\'s "is this name real?" on loopback says 200 for join and 404 for a name nobody granted, so '
      + 'only granted names ever get a certificate');
  } else {
    test.fail('the ask: join ' + askJoin.status + ', nobody ' + askNobody.status);
  }

  server.close();
  test.reportSuccessFailureCount();
}()).catch(function (e) {
  test.fail('the world itself failed: ' + (e && e.stack || e));
  test.reportSuccessFailureCount();
});
