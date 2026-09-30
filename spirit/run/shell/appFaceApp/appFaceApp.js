'use strict';

// spirit/run/shell/appFaceApp/appFaceApp.js
// THE GRANT MECHANISM — one verb, no face.
//
// ── WHAT THIS IS FOR ─────────────────────────────────────────────────
//
//   Andy, 2026-09-25: "the feature of the appShellApp is: the
//   granting/associating member ID's with wildcard subdomain names.
//   that's all."
//
// And the bottom underneath two things that look different:
//
//   Andy: "so the bottom is the grant mechanism that underpins the
//   installation of join into the DNS namespace as well as member
//   subdomain assignments."
//
// So `join` asks for its name the same way Alice asks for hers. THERE IS
// NO SYSTEM-FACE SPECIAL CASE and none may be added: the moment the
// installer has a shortcut, the path this suite drives stops being the
// path that is used.
//
// ── FACELESS, AND WHY THAT IS THE LOAD-BEARING PART ──────────────────
//
//   Andy: "faceless, no shortcut."
//
// No page, no stylesheet, no HTTP surface, no control panel. Not an
// omission to be filled in later — it is what makes the assertions in
// `spirit/test/appFaceGrant.js` honest, because the exchange is the
// ONLY way to drive this, so a test drives exactly what the installer
// drives. `appFaceGrant.js:96-118` walks this directory and goes red on
// an .html, a .css, a `createServer(`, a `.listen(` or a `require('http')`.
//
// A control panel is the obvious next convenience. It belongs in a shell
// app that talks to this one over the wire, never in this folder.
//
// ── THE EXCHANGE IS TWO PACKETS, ON PURPOSE ──────────────────────────
//
// An ask arrives; the grant leaves as a SECOND packet addressed back to
// the asker, carrying the first packet's hash. It is not a synchronous
// answer, and it may not become one: `peerPost.js:1327` keeps the answer
// hook out of app hands because an answerer that hangs holds the
// sender's connection open, and this exchange has no held connection to
// justify changing that. Ruled 2026-09-25 (Andy: "if agreed by wsl,
// that's a go"), with the synchronous case left to G17 and `join`.
//
// Andy required the packet even where it is not needed for transport:
//
//   Andy: "yes to 'the negotiation should be a packet even when both
//   ends are on the same node.'"
//
// So there is no local call path, no in-process shortcut, and no branch
// that notices both ends are the same node. Two hashes and two receipts
// in the traffic log is the observable form of that, and the suite
// asserts it rather than trusting this comment.

// THE APP ENVELOPE, WHICH ALREADY EXISTED. A first draft of this file
// invented a second one — raw `{app, verb, …}` JSON with a hand-rolled
// `re` for correlating the reply — and `packet.js` had all three: the
// shape (`:13`), what `app` means (`:146`, "which app ON THE RECIPIENT
// NODE a packet is for"), and `re` (`:262`). Caught by reading
// `arrivals.js:384`, which has been encoding packets this way all along.
const packet = require('../../js/client/packet.js');

// The envelope this app answers to. Read by THIS file, never by the
// node — `nodeApps.js` hands every booted app every admitted arrival
// and looks at none of them, which is Andy's "nothing in node and relay
// should know about apps" kept literally.
const APP = 'appFaceApp';

// ── THE FACE ROUTE: STEP 1 OF ANDY'S THREE (public-app-server/G17) ────
//
//   Andy, 2026-09-27: "step 1) build and prove the route from browser to
//   owner-of-subdomain, and back 2) design the last leg. 3) implement the
//   last leg". And of what the owner answers: "this the owner of the join
//   subdomain" or "this is NOT the owner of join".
//
// Two roles, one file, told apart by what the node hands this app:
//
//   ON THE VPS PUPPET (the node hands it api.face): claims the visitors,
//   asks its owner once per host, keeps the answer in RAM (faceRoute's
//   cache, "at restart, the dance starts anew"), and forwards each request
//   (appServerPost) to whoever owns the name, waiting for the answer by
//   hash (appServerReply).
//
// THE VPS MATCHES NOTHING: it never reads a name out of a host. Only the
// owner's node does, against its face domain (face-domain.json).
const faceRoute = require('../../js/faceRoute.js');
const FACE_DOMAIN_FILE = 'face-domain.json';
// The time limits nest inside puppetPost's FACE_WAIT_MS (30 s), so the
// visitor hears this app's named answer, not the listener's generic one.
const ROUTE_WAIT_MS = 8000;
const SERVE_WAIT_MS = 18000;
// A reply that lands before its wait is registered is held this long
// (ownerPost's early-answer store, a207e8c).
const EARLY_KEEP_MS = 5000;
// Patience for a busy owner (peer.post's patienceMs): shorter than the waits.
const POST_PATIENCE = { patienceMs: 6000 };

function faceDomainOf(api) {
  try {
    const doc = JSON.parse(api.fs.read(FACE_DOMAIN_FILE) || 'null');
    return (doc && typeof doc.faceDomain === 'string' && doc.faceDomain) || '';
  } catch (e) { return ''; }
}

// appServerReply, Andy's name for the answer's way back: a second packet to
// the asker, carrying the question's hash. An answer too big for one packet
// becomes a small refusal by name, so the visitor is not left to time out.
function appServerReply(api, message, body) {
  let made = packet.encode(APP, body, { re: message.hash });
  if ((!made || !made.text) && body && body.verb === 'served') {
    made = packet.encode(APP, { verb: 'served', status: 502, body: { ok: false, code: 'app-answer-too-large' } }, { re: message.hash });
  }
  if (!made || !made.text) { api.log(APP + ': an answer could not be packed: ' + ((made && made.error) || '')); return; }
  Promise.resolve(api.post('', message.fromKey, made.text, null, null))
    .catch(function (e) { api.log(APP + ': an answer could not be posted: ' + ((e && e.message) || e)); });
}

function ownerOf(api, host) {
  const name = faceRoute.nameOf(host, faceDomainOf(api));
  if (!name) return Promise.resolve({ route: 'none', name: '' });
  if (typeof api.toLocalApp !== 'function') return Promise.resolve({ route: 'none', name: name });
  return Promise.resolve(api.toLocalApp('grantFace', { method: 'POST', path: '/', body: JSON.stringify({ get: { name: name } }), type: 'application/json' }))
    .then(function (a) {
      let got = null;
      try { got = a && a.status === 200 ? (typeof a.body === 'string' ? JSON.parse(a.body) : a.body) : null; } catch (e) { got = null; }
      if (!got || typeof got.id !== 'string' || !got.id) return { route: 'none', name: name };
      return { route: 'owner', name: name, to: got.id };
    }, function (e) {
      api.log(APP + ': grantFace could not be asked: ' + ((e && e.message) || e));
      return { route: 'none', name: name };
    });
}

function ownerRole(api, message, body) {
  if (body.verb === 'route?') {
    ownerOf(api, body.host).then(function (o) {
      appServerReply(api, message, o.route === 'owner'
        ? { verb: 'route', route: 'owner', name: o.name, to: o.to }
        : { verb: 'route', route: o.route, name: o.name });
    });
    return true;
  }
  if (body.verb === 'serve') {
    ownerOf(api, body.host).then(function (o) {
      appServerReply(api, message, { verb: 'served', status: 404, body: { ok: false, code: 'no-such-route', name: o.name, why: o.route === 'owner' ? 'no-handler' : 'not-granted' } });
    });
    return true;
  }
  return false;
}

// The VPS side: ask, remember, forward, wait by hash.
function puppetRole(api) {
  const waits = Object.create(null);
  const early = Object.create(null);
  // Signed redirects are not taken yet (no node signs them), so the cache
  // is handed a verify that holds nothing: "mine" and "none" are all it keeps.
  const cache = faceRoute.createRouteCache({ ownerKey: api.owner(), verify: function () { return false; } });

  function waitFor(hash, ms) {
    return new Promise(function (resolve) {
      const got = early[hash];
      if (got && Date.now() - got.at < EARLY_KEEP_MS) { delete early[hash]; resolve(got.message); return; }
      const timer = setTimeout(function () { delete waits[hash]; resolve(null); }, ms);
      waits[hash] = function (message) { clearTimeout(timer); delete waits[hash]; resolve(message); };
    });
  }

  function arrived(message, re) {
    if (!re) return false;
    if (waits[re]) { waits[re](message); return true; }
    early[re] = { message: message, at: Date.now() };
    Object.keys(early).forEach(function (h) { if (Date.now() - early[h].at > EARLY_KEEP_MS) delete early[h]; });
    return true;
  }

  // appServerPost, Andy's name for the request's way out: post a body to a
  // key and wait for the one answer carrying its hash.
  function appServerPost(to, body, ms) {
    const made = packet.encode(APP, body);
    if (!made || !made.text) return Promise.resolve({ refused: 'could not be packed' });
    return Promise.resolve(api.post('', to, made.text, null, POST_PATIENCE)).then(function (sent) {
      if (!sent || !sent.ok || !sent.hash) return { refused: (sent && (sent.error || sent.status)) || 'not sent' };
      return waitFor(sent.hash, ms).then(function (message) {
        if (!message) return { timedOut: true };
        const info = packet.decode(message.text);
        return { from: message.fromKey, re: info && info.re, body: info && info.body, hash: sent.hash };
      });
    }, function (e) { return { refused: (e && e.message) || String(e) }; });
  }

  // ── A BUDGET FOR NAMES NEVER SEEN (wsl-claude) ──────────────────────
  //
  // Every made-up <random>.face.spirit host, from a visitor or from Caddy
  // asking before a certificate, would otherwise be one question to the
  // owner over the relay; the minute's negative cache never hits a name
  // that does not repeat. So at most NEW_NAMES_PER_MINUTE questions about
  // hosts the cache does not hold; past that, "no such route" without
  // asking, and a line in the log. Cached hosts cost nothing.
  const NEW_NAMES_PER_MINUTE = 20;
  let asked = [];
  function mayAskAboutNewName() {
    const now = Date.now();
    asked = asked.filter(function (t) { return now - t < 60000; });
    if (asked.length >= NEW_NAMES_PER_MINUTE) return false;
    asked.push(now);
    return true;
  }

  // Where a host's requests go, from the cache or by asking the owner once.
  function resolve(host) {
    const owner = api.owner();
    const known = cache.lookup(host);
    if (known) return Promise.resolve(known);
    if (!mayAskAboutNewName()) {
      api.log(APP + ': new-name budget spent, not asking the owner about ' + String(host).slice(0, 80));
      return Promise.resolve({ none: true });
    }
    return appServerPost(owner, { verb: 'route?', host: host }, ROUTE_WAIT_MS).then(function (a) {
      if (a.refused) return { refused: a.refused };
      if (a.timedOut) return { timedOut: true };
      // "The owner of this name is <key>", and the puppet forwards there,
      // whoever it is. Andy: "why on earth would the appFaceApp actually
      // need that knowledge for?" It doesn't: whether to trust a visitor is
      // the receiving node's decision, not the face's.
      cache.take(a.body, a.from, a.re, a.hash, host);
      return cache.lookup(host) || { refused: 'the owner gave no usable route' };
    });
  }

  // ── CADDY'S QUESTION BEFORE A CERTIFICATE ───────────────────────────
  //
  // On-demand TLS (Andy's "yes" on wsl-claude's ask; the DreamHost DNS
  // module will not build, so no wildcard certificate): before Caddy takes
  // on a name it asks GET /.well-known/spirit-name?domain=<host> on this
  // listener, and only a granted name gets a certificate. ANSWERED ONLY ON
  // LOOPBACK, the address Caddy's ask uses: a public request keeps its own
  // Host, so the same path from the internet is an ordinary visit and never
  // a free directory of granted names (wsl-claude).
  const ASK_PATH = '/.well-known/spirit-name';
  function isLoopbackHost(host) {
    return /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(String(host || ''));
  }
  function askedDomain(path) {
    const q = String(path || '').split('?')[1] || '';
    const m = /(?:^|&)domain=([^&]*)/.exec(q);
    try { return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return ''; }
  }

  api.face(function (req) {
    if (isLoopbackHost(req.host) && String(req.path || '').split('?')[0] === ASK_PATH) {
      const domain = askedDomain(req.path);
      if (!domain) return { status: 404, body: '' };
      return resolve(domain).then(function (r) {
        return { status: (r.to || r.mine) ? 200 : 404, body: '' };
      });
    }
    const owner = api.owner();
    // A ROUTE THIS FACE CANNOT LEARN IS NOT FOUND. Andy, 2026-09-27, in Desk
    // under G17, asked whether an owner that cannot be asked (asleep, or
    // silent past the wait) should say 502/504, "try again": "404. not
    // found". So every way of not knowing where a name lives is one answer,
    // 404, and only the body's `why` tells an operator which it was.
    function notFound(why) {
      return { status: 404, body: { ok: false, code: 'no-such-route', why: why } };
    }
    return resolve(req.host).then(function (r) {
      if (r.refused) return notFound('owner-unreachable');
      if (r.timedOut) return notFound('owner-did-not-answer');
      if (r.none) return notFound('not-granted');
      // mine: the owner node owns it; a signed route: its owner does.
      const target = r.mine ? owner : r.to;
      return appServerPost(target, { verb: 'serve', host: req.host, method: req.method, path: req.path, body: req.body, type: req.type }, SERVE_WAIT_MS)
        .then(function (a) {
          if (a.refused) { cache.drop(req.host); return notFound('owner-unreachable'); }
          if (a.timedOut) return notFound('owner-did-not-answer');
          if (a.from !== target || !a.body || a.body.verb !== 'served') return { status: 502, body: { ok: false, code: 'bad-answer' } };
          return { status: Number(a.body.status) || 200, body: a.body.body,
            type: typeof a.body.type === 'string' && a.body.type ? a.body.type : undefined };
        });
    });
  });

  return arrived;
}

function mount(api) {
  // The VPS role exists only where the node hands this app the face.
  const puppetArrived = typeof api.face === 'function' ? puppetRole(api) : null;
  api.subscribe(function (message) {
    const ask = packet.decode(message && message.text);
    if (!ask || ask.app !== APP) return;
    const body = ask.body;
    if (!body) return;
    // An answer to something this node asked, on the VPS.
    if (puppetArrived && ask.re && puppetArrived(message, ask.re)) return;
    if (ownerRole(api, message, body)) return;
  });
}

module.exports = { mount: mount };
