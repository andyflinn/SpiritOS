'use strict';

// spirit/run/process/js/appFaceApp/appFaceApp.js
// THE FACE, AS A PROCESS — goal/G13.2 (the goal's box, Andy's rulings of 2026-10-10).
//
// One script, started by the node like every process/js server (startNodeServers: the pipe the
// node names, --state its own folder). It plays two parts, told apart by what its state folder
// holds, and neither part is the node's business:
//
//   ON THE FACE NODE (face.json names a port): it opens its own listener on that port, where
//   Caddy sends visitors. It serves index.html and kernel.js itself, and carries every other
//   request over the relay to the node that owns the name, as the serve ask; first it asks that
//   node's owner where the name lives (route), once per subdomain, and keeps the answer in RAM.
//   The owner's key is the puppet's, relay-state/owner.json ("The owners key is already in the
//   puppet."). Andy: "a second door has NOTHING to do with being a puppet." and "why would the
//   node need to know if an appServer opens a port listener?" — it does not; the port is this
//   server's own ("a configuration file that identifies the port, or any other means suitable").
//
//   ON THE OWNER'S NODE: it answers route and serve as verbs on its pipe. A face reaches them
//   through the api door, gated by apiAuth; the local shell through jobs.api. route asks
//   grantFace for the name's holder, serve hands the visitor's request to appFaceAppServer, both
//   through jobs.api on the node's own port ("appServers have the node's port, which gives them
//   FULL access to peerPost"). The face domain is face-domain.json in its state folder.
//
// NOTHING NEW ON THE NODE. The face posts with spirit.peerPost and reads the answer off the
// node's event stream, as any process does; the owner's answer is the api door's. What was
// nodeApps.mountAll, puppetPost.js, faceServer.js, --app and the serves flag is gone with this
// file's arrival ("no \"face\" crap belongs into node.").
//
// The face's answer to a browser is bounded by PAYLOAD_MAX like everything that goes out; a body
// over BODY_MAX is refused unread; one request fails alone (504 at FACE_WAIT_MS, 502 on a throw).
// Only the content type crosses with a request, each way: no cookie, no forwarded address.

const fs = require('fs');
const path = require('path');
const http = require('http');
const spirit = require('../../../js/kernel.js');
const appServer = require('../../../js/appServer.js');
const limits = require('../../../js/limits.js');
const auth = require('../../../js/relayAuth.js');
const errors = require('../../../js/spiritErrors.js');
const faceRoute = require('./faceRoute.js');

const APP = 'appFaceApp';

// THE REFUSALS THIS FACE EMITS, declared by the face itself (Andy, 2026-10-10: define exported
// from the register, 39985ed2): a refusal is a member of a declared set, and the set an app emits
// lives beside the app, not in the node. Each one a visitor can read; none carries a figure.
function declare(code, e) { if (!errors.byCode(code)) errors.define(code, e); }
declare('no-such-route', { status: 404, retry: 'no', fault: 'caller', texts: ['no such route'],
  note: 'A name this face cannot learn is not found (Andy, 2026-09-27: "404. not found"); `why` says which way it was not known.' });
declare('not-found', { status: 404, retry: 'no', fault: 'caller', texts: ['not found'] });
declare('bad-answer', { status: 502, retry: 'after', fault: 'target', texts: ['the owner of the name gave no usable answer'] });
declare('face-body-too-large', { status: 413, retry: 'no', fault: 'caller', texts: ['the request body is larger than a packet can carry'] });
declare('face-answer-too-large', { status: 502, retry: 'no', fault: 'target', texts: ['the answer is larger than a packet can carry'] });
declare('face-timeout', { status: 504, retry: 'after', fault: 'target', texts: ['the owner of the name did not answer in time'] });
declare('face-failed', { status: 502, retry: 'after', fault: 'node', texts: ['the face failed to answer'] });
const ROOT = path.join(__dirname, '..', '..', '..');
const JSON_TYPE = 'application/json; charset=utf-8';

// Its state folder, named by the node (--state): face.json {port} on the face node,
// face-domain.json {faceDomain} on the owner's. Never worked out here.
const argv = process.argv;
const at = argv.indexOf('--state');
const STATE = at !== -1 ? String(argv[at + 1] || '') : '';
if (!STATE) {
  console.error('appFaceApp: no --state; the node that starts this names its state folder');
  process.exit(2);
}

// The time limits nest: the route ask inside the serve ask inside the face's own wait, so the
// visitor hears the named answer, not the generic one.
const FACE_WAIT_MS = 30000;
const SERVE_WAIT_MS = 18000;
const ROUTE_WAIT_MS = 8000;
// Patience for a busy owner (peer.post's patienceMs): shorter than the waits.
const POST_PATIENCE_MS = 6000;
// A budget for names never seen (wsl-claude): every made-up host would otherwise be one question
// to the owner over the relay. Past it, "no such route" without asking.
const NEW_NAMES_PER_MINUTE = 20;
const FACE_BIND = '127.0.0.1';
const ASK_PATH = '/.well-known/spirit-name';

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
}
function faceDomain() {
  const doc = readJson(path.join(STATE, 'face-domain.json'));
  return doc && typeof doc.faceDomain === 'string' ? doc.faceDomain : '';
}
function facePort() {
  const doc = readJson(path.join(STATE, 'face.json'));
  const port = doc && Number(doc.port);
  return Number.isInteger(port) && port >= 0 && port <= 65535 ? port : null;
}
// WHOSE PUPPET THIS NODE IS, read on every call so an owner edit is seen at once; a node owning
// itself, or owned by nobody, has no owner to ask (as puppetMode.puppetIn reads it).
function ownerKey() {
  const owner = auth.loadOwner(ROOT, function () {});
  if (!owner) return '';
  const self = auth.loadIdentity(ROOT);
  if (self && self.publicKey === owner) return '';
  return owner;
}
// The node that started this process: the origin of SPIRIT_CALLBACK_URL (jobs.js launch).
function nodeBase() {
  try { return new URL(String(process.env.SPIRIT_CALLBACK_URL || '')).origin; } catch (e) { return ''; }
}

// ── THE OWNER'S SIDE: jobs.api ON THE NODE'S OWN PORT ─────────────────
function askNode(app, verb, args) {
  const base = nodeBase();
  if (!base) return Promise.resolve(null);
  const ask = {};
  ask[app] = {};
  ask[app][verb] = args;
  return spirit.core.ask('jobs.api', { ask: ask }, base).then(function (r) {
    return r && r.status === 200 ? r.body : null;
  }, function () { return null; });
}

const verbs = {
  // Where a name lives: the name in the host, asked of grantFace. 'owner' names the holder;
  // 'none' is no grant, no name in the host, or grantFace not answering.
  route: {
    request: { host: '' }, reply: { route: '', name: '', to: '' },
    handler: function (a) {
      const name = faceRoute.nameOf(a.host, faceDomain());
      if (!name) return { route: 'none', name: '', to: '' };
      return askNode('grantFace', 'get', { name: name }).then(function (got) {
        if (!got || typeof got.id !== 'string' || !got.id) return { route: 'none', name: name, to: '' };
        return { route: 'owner', name: name, to: got.id };
      });
    },
  },
  // A visitor's request, handed to appFaceAppServer as it came; its answer handed back as it came.
  serve: {
    request: { host: '', method: '', path: '', body: '', type: '' },
    reply: { status: 0, body: '', type: '' },
    handler: function (a) {
      return askNode('appFaceAppServer', 'serve', { host: a.host, method: a.method, path: a.path, body: a.body, type: a.type }).then(function (r) {
        if (!r || r.ok === false || typeof r.status !== 'number') {
          return { status: 503, body: JSON.stringify({ ok: false, code: 'app-not-running', app: 'appFaceAppServer' }), type: JSON_TYPE };
        }
        return { status: r.status, body: typeof r.body === 'string' ? r.body : JSON.stringify(r.body == null ? '' : r.body), type: String(r.type || '') };
      });
    },
  },
};

// ── THE FACE'S SIDE: ITS OWN PORT, AND THE ROUTE OVER THE RELAY ───────
//
// post: one api ask to a node over peerPost, answered on the ask's hash by that node's api door.
// A refusal by the door (not granted, no such app) is a refusal; silence is a timeout.
function post(to, verb, args, waitMs) {
  const body = {};
  body[APP] = {};
  body[APP][verb] = args;
  return spirit.peerPost(to, 'api', body, { waitMs: waitMs, patienceMs: POST_PATIENCE_MS }).then(function (a) {
    if (!a || typeof a !== 'object') return { refused: 'no answer' };
    if (a.ok === false && a.code === 'no-answer') return { timedOut: true };
    if (a.ok === false) return { refused: String(a.code || a.error || 'refused') };
    return { body: a };
  }, function (e) { return { refused: (e && e.message) || String(e) }; });
}

function createFace() {
  // The routes in RAM, for the owner whose key stands now; a changed owner starts afresh.
  let cacheOwner = '';
  let cache = null;
  function cacheFor(owner) {
    if (!cache || cacheOwner !== owner) {
      cacheOwner = owner;
      // Signed redirects are not taken yet (no node signs them): 'owner', 'mine' and 'none' are all it keeps.
      cache = faceRoute.createRouteCache({ ownerKey: owner, verify: function () { return false; } });
    }
    return cache;
  }
  let asked = [];
  function mayAskAboutNewName() {
    const now = Date.now();
    asked = asked.filter(function (t) { return now - t < 60000; });
    if (asked.length >= NEW_NAMES_PER_MINUTE) return false;
    asked.push(now);
    return true;
  }
  // Where a host's requests go: from the cache, or by asking the owner once.
  function resolve(host) {
    const owner = ownerKey();
    if (!owner) return Promise.resolve({ refused: 'no-owner' });
    const known = cacheFor(owner).lookup(host);
    if (known) return Promise.resolve(known);
    if (!mayAskAboutNewName()) {
      console.log(APP + ': new-name budget spent, not asking the owner about ' + String(host).slice(0, 80));
      return Promise.resolve({ none: true });
    }
    return post(owner, 'route', { host: host }, ROUTE_WAIT_MS).then(function (a) {
      if (a.refused) return { refused: a.refused };
      if (a.timedOut) return { timedOut: true };
      // peerPost already took the answer from the owner's key and on this ask's hash.
      cacheFor(owner).take(a.body, owner, 'ask', 'ask', host);
      return cacheFor(owner).lookup(host) || { refused: 'the owner gave no usable route' };
    });
  }
  function isLoopbackHost(host) {
    return /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(String(host || ''));
  }
  function askedDomain(pathname) {
    const q = String(pathname || '').split('?')[1] || '';
    const m = /(?:^|&)domain=([^&]*)/.exec(q);
    try { return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return ''; }
  }
  // A ROUTE THIS FACE CANNOT LEARN IS NOT FOUND (Andy, 2026-09-27, G17: "404. not found"); the
  // body's `why` tells an operator which way it was not known.
  function notFound(why) {
    return { status: 404, body: { ok: false, code: 'no-such-route', error: errors.byCode('no-such-route').text, why: why } };
  }
  // A file of the face's own, read here and never carried over the relay: the one answer that is
  // not bounded by PAYLOAD_MAX, because no packet ever holds it (kernel.js is three times the cap
  // today; the kernel split that would bring it under is its own goal).
  function file(rel, type) {
    try { return { status: 200, body: fs.readFileSync(rel, 'utf8'), type: type, local: true }; }
    catch (e) { return { status: 404, body: { ok: false, code: 'not-found', error: errors.byCode('not-found').text } }; }
  }
  function visit(req) {
    const pathname = String(req.path || '').split('?')[0];
    // Caddy's question before a certificate, answered only on loopback: a public request keeps
    // its own Host, so the same path from the internet is never a directory of granted names.
    if (isLoopbackHost(req.host) && pathname === ASK_PATH) {
      const domain = askedDomain(req.path);
      if (!domain) return Promise.resolve({ status: 404, body: '' });
      return resolve(domain).then(function (r) { return { status: (r.to || r.mine) ? 200 : 404, body: '' }; });
    }
    // THE FACE'S OWN PAGE AND THE KERNEL, served here: "appFaceApp servers an index.html that
    // loads kernel.js, also from appFaceApp" (Andy, 2026-10-10).
    if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
      return Promise.resolve(file(path.join(__dirname, 'index.html'), 'text/html; charset=utf-8'));
    }
    if (req.method === 'GET' && pathname === '/kernel.js') {
      return Promise.resolve(file(path.join(ROOT, 'js', 'kernel.js'), 'text/javascript; charset=utf-8'));
    }
    // Everything else goes to whoever owns the name, as the serve ask.
    return resolve(req.host).then(function (r) {
      if (r.refused) return notFound('owner-unreachable');
      if (r.timedOut) return notFound('owner-did-not-answer');
      if (r.none) return notFound('not-granted');
      const target = r.mine ? ownerKey() : r.to;
      return post(target, 'serve', { host: req.host, method: req.method, path: req.path, body: req.body, type: req.type }, SERVE_WAIT_MS)
        .then(function (a) {
          if (a.refused) { cacheFor(ownerKey()).drop(req.host); return notFound('owner-unreachable'); }
          if (a.timedOut) return notFound('owner-did-not-answer');
          const b = a.body;
          if (!b || typeof b.status !== 'number') return { status: 502, body: { ok: false, code: 'bad-answer', error: errors.byCode('bad-answer').text } };
          return { status: b.status, body: b.body, type: typeof b.type === 'string' && b.type ? b.type : undefined };
        });
    });
  }

  // THE ANSWER IS BOUNDED TOO (Andy, 2026-09-27, G17: "Everything, everywhere that goes out, is
  // bounded by MAX_PAYLOAD"): what came over the relay is capped at PAYLOAD_MAX, and over it the
  // visitor gets a refusal by name, never a page cut off partway.
  function answer(res, status, body, type, local) {
    if (res.headersSent) return;
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    if (!local && Buffer.byteLength(text, 'utf8') > limits.PAYLOAD_MAX) {
      res.writeHead(502, { 'Content-Type': JSON_TYPE });
      res.end(JSON.stringify({ ok: false, code: 'face-answer-too-large', error: errors.byCode('face-answer-too-large').text }));
      return;
    }
    res.writeHead(status, { 'Content-Type': type || JSON_TYPE });
    res.end(text);
  }
  // A refusal by code, with the declared sentence (D12: every error is {ok, code, error}).
  function refuse(res, status, code) {
    const e = errors.byCode(code);
    answer(res, status, { ok: false, code: code, error: e ? e.text : code });
  }

  function handle(req, res) {
    const chunks = [];
    let size = 0;
    let over = false;
    req.on('data', function (chunk) {
      if (over) return;
      size += chunk.length;
      if (size > limits.BODY_MAX) {
        over = true;
        refuse(res, 413, 'face-body-too-large');
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', function () {
      if (over) return;
      const visitor = {
        host: String(req.headers.host || ''),
        method: String(req.method || ''),
        path: String(req.url || ''),
        body: Buffer.concat(chunks).toString('utf8'),
        type: String(req.headers['content-type'] || ''),
      };
      let settled = false;
      const timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        refuse(res, 504, 'face-timeout');
      }, FACE_WAIT_MS);
      let pending;
      try { pending = Promise.resolve(visit(visitor)); }
      catch (e) { pending = Promise.reject(e); }
      pending.then(function (out) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const o = out || {};
        const status = Number.isInteger(o.status) && o.status >= 100 && o.status < 600 ? o.status : 200;
        answer(res, status, o.body === undefined ? '' : o.body, typeof o.type === 'string' ? o.type : undefined, o.local === true);
      }, function (e) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        console.log(APP + ': the face failed: ' + ((e && e.message) || e));
        refuse(res, 502, 'face-failed');
      });
    });
  }

  function listen(port) {
    const server = http.createServer(handle);
    server.on('error', function (e) {
      console.error(APP + ': could not listen on ' + FACE_BIND + ':' + port + ': ' + ((e && e.code) || e));
    });
    server.listen(port, FACE_BIND, function () {
      console.log(APP + ': the face listens on ' + FACE_BIND + ':' + server.address().port);
    });
    return server;
  }
  return { listen: listen, handle: handle };
}

// THE WHOLE START: the verbs on the node's pipe, as every server; the face's own port beside it
// when its config names one. "appFaceAppServer needs no grant" holds for this one too: a face
// reaches the owner's verbs by apiAuth's grant on the face's key, nothing of its own.
appServer.serve(verbs, { dependencies: [] });
const port = facePort();
if (port !== null) createFace().listen(port);
