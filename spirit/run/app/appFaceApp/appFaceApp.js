'use strict';

// spirit/run/app/appFaceApp/appFaceApp.js
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
//
// ── THE DATASET IS THE OWNER'S, AND IT STAYS HOME ────────────────────
//
//   Andy: "A name grant persists. true. but only on the owners node."
//   Andy: "the list is reserved by the appShellApp mapping dataset on
//   the owners personal node" — and, asked whether reserved names were
//   hardcoded: "not hardcoded".
//
// So there is no RESERVED array in this file and there must not be one.
// A name is taken because somebody was granted it, and for no other
// reason. `join` reserving its subdomain is a row written by the same
// exchange at install time, which is why the installer needs no
// privilege this file does not give every member.

// THE APP ENVELOPE, WHICH ALREADY EXISTED. A first draft of this file
// invented a second one — raw `{app, verb, …}` JSON with a hand-rolled
// `re` for correlating the reply — and `packet.js` had all three: the
// shape (`:13`), what `app` means (`:146`, "which app ON THE RECIPIENT
// NODE a packet is for"), and `re` (`:262`). Caught by reading
// `arrivals.js:384`, which has been encoding packets this way all along.
const packet = require('../../js/client/packet.js');

const NAME_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const DATASET = 'grants.json';

// The envelope this app answers to. Read by THIS file, never by the
// node — `nodeApps.js` hands every booted app every admitted arrival
// and looks at none of them, which is Andy's "nothing in node and relay
// should know about apps" kept literally.
const APP = 'appFaceApp';

function readGrants(api) {
  const raw = api.fs.read(DATASET);
  if (!raw) return {};
  try {
    const doc = JSON.parse(raw);
    return (doc && typeof doc.names === 'object' && doc.names) || {};
  } catch (e) {
    // A TORN OR HAND-EDITED FILE IS NOT AN EMPTY ONE. Returning {} here
    // would re-grant every name that is already out there, so this
    // refuses to answer instead — see `grant` below, which treats null
    // as "cannot say" rather than "nothing is taken".
    return null;
  }
}

function writeGrants(api, names) {
  api.fs.write(DATASET, JSON.stringify({ names: names }, null, 2) + '\n');
}

// The whole of the decision. Separated from the wire so the rule can be
// read without reading the plumbing, and so a later caller cannot reach
// the plumbing without passing through the rule.
function decide(api, name, asker) {
  if (!NAME_RE.test(String(name || ''))) {
    return { ok: false, code: 'bad-request', name: name, why: 'a name is 1-63 characters of a-z, 0-9 and -, not starting or ending with -' };
  }
  const names = readGrants(api);
  if (names === null) {
    return { ok: false, code: 'no-row', name: name, why: 'the grant dataset could not be read, and guessing would re-grant a live name' };
  }
  const held = names[name];
  if (held && held.to !== asker) {
    // THE ONE REFUSAL THIS FEATURE HAS, and it is in the catalogue
    // before this file emits it (`spiritErrors.js:513`) — a code living
    // only in the file that throws it is outside the closed set at the
    // one moment anybody needs to look it up.
    //
    // Permanent, not a reservation: `name-reserved` frees itself when
    // its invite expires, a grant does not.
    return { ok: false, code: 'name-already-granted', name: name };
  }
  if (held) {
    // The same asker asking twice gets the same answer, not a refusal.
    // An installer that retries after a lost reply must not be told the
    // name it owns is taken.
    return { ok: true, name: name, at: held.at, again: true };
  }
  const at = new Date().toISOString();
  names[name] = { to: asker, at: at };
  writeGrants(api, names);
  return { ok: true, name: name, at: at };
}


// ── THE FACE ROUTE: STEP 1 OF ANDY'S THREE (public-app-server/G17) ────
//
//   Andy, 2026-09-27: "step 1) build and prove the route from browser to
//   owner-of-subdomain, and back 2) design the last leg. 3) implement the
//   last leg". And of what the owner answers: "this the owner of the join
//   subdomain" or "this is NOT the owner of join".
//
// Two roles, one file, told apart by what the node hands this app:
//
//   ON THE OWNER'S NODE (it holds grants.json): answers 'route?' from
//   anyone with the truth from the row, "the owner of join is <key>", or
//   "none", and judges nothing about itself. Andy, asked what api.self()
//   was for: "so what's an api.self for then?" Nothing, it turned out: the
//   puppet knows its own owner's key and makes the comparison. It answers
//   'serve' for a granted name with the agreed stub, 501
//   last-leg-not-built, naming the row's key. The last leg, handing the
//   request to the app's process, waits for the server-process design.
//
//   ON THE VPS PUPPET (the node hands it api.face): claims the visitors,
//   asks its owner once per host, keeps the answer in RAM (faceRoute's
//   cache, "at restart, the dance starts anew"), and forwards each request
//   (appServerPost) to whoever owns the name, waiting for the answer by
//   hash (appServerReply).
//
// THE VPS MATCHES NOTHING: it never reads a name out of a host. Only the
// owner's node does, against its face domain (face-domain.json, beside
// grants.json, written at setup).
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

function replyTo(api, message, body) {
  const made = packet.encode(APP, body, { re: message.hash });
  if (!made || !made.text) { api.log(APP + ': an answer could not be packed: ' + ((made && made.error) || '')); return; }
  Promise.resolve(api.post('', message.fromKey, made.text, null, null))
    .catch(function (e) { api.log(APP + ': an answer could not be posted: ' + ((e && e.message) || e)); });
}

// The owner's side: which name a host is, and who holds it, from the row.
function ownerOf(api, host) {
  const name = faceRoute.nameOf(host, faceDomainOf(api));
  if (!name) return { route: 'none', name: '' };
  const rows = readGrants(api) || {};
  const row = Object.prototype.hasOwnProperty.call(rows, name) ? rows[name] : null;
  if (!row || !row.to) return { route: 'none', name: name };
  return { route: 'owner', name: name, to: row.to };
}

function ownerRole(api, message, body) {
  if (body.verb === 'route?') {
    replyTo(api, message, Object.assign({ verb: 'route' }, ownerOf(api, body.host)));
    return true;
  }
  if (body.verb === 'serve') {
    const o = ownerOf(api, body.host);
    // A puppet forwards 'serve' here only for a name whose row names its
    // owner, so the row's key is this node's own.
    const answer = o.route === 'owner'
      ? { status: 501, body: { ok: false, code: 'last-leg-not-built', name: o.name, node: o.to } }
      : { status: 404, body: { ok: false, code: 'no-such-route', name: o.name } };
    replyTo(api, message, Object.assign({ verb: 'served' }, answer));
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

  // Post a body to a key and wait for the one answer carrying its hash.
  function ask(to, body, ms) {
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

  api.face(function (req) {
    const owner = api.owner();
    const known = cache.lookup(req.host);
    const route = known ? Promise.resolve(known) : ask(owner, { verb: 'route?', host: req.host }, ROUTE_WAIT_MS).then(function (a) {
      if (a.refused) return { refused: a.refused };
      if (a.timedOut) return { timedOut: true };
      // "The owner of this name is <key>", and the puppet forwards there,
      // whoever it is. Andy: "why on earth would the appFaceApp actually
      // need that knowledge for?" It doesn't: whether to trust a visitor is
      // the receiving node's decision, not the face's.
      cache.take(a.body, a.from, a.re, a.hash, req.host);
      return cache.lookup(req.host) || { refused: 'the owner gave no usable route' };
    });
    return route.then(function (r) {
      if (r.refused) return { status: 502, body: { ok: false, code: 'owner-unreachable', why: String(r.refused) } };
      if (r.timedOut) return { status: 504, body: { ok: false, code: 'owner-did-not-answer' } };
      if (r.none) return { status: 404, body: { ok: false, code: 'no-such-route' } };
      // mine: the owner node owns it; a signed route: its owner does.
      const target = r.mine ? owner : r.to;
      return ask(target, { verb: 'serve', host: req.host, method: req.method, path: req.path, body: req.body }, SERVE_WAIT_MS)
        .then(function (a) {
          if (a.refused) { cache.drop(req.host); return { status: 502, body: { ok: false, code: 'owner-unreachable', why: String(a.refused) } }; }
          if (a.timedOut) return { status: 504, body: { ok: false, code: 'owner-did-not-answer' } };
          if (a.from !== target || !a.body || a.body.verb !== 'served') return { status: 502, body: { ok: false, code: 'bad-answer' } };
          return { status: Number(a.body.status) || 200, body: a.body.body };
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
    if (body.verb !== 'grant') return;

    // THE APP-OWNER'S GATE (Andy: "app provides 1 function, app-owner
    // manages permission list"). The node's front door has already said
    // this peer may reach the node; `allows` says whether they may use
    // THIS app. Absent list means nobody — nodeApps.js.
    if (!api.allows(message.fromKey)) {
      api.log(APP + ': not on the list, so no name was granted: ' + String(message.fromKey).slice(0, 8));
      return;
    }

    const answer = decide(api, body.name, message.fromKey);

    // `re` carries the asking packet's hash, which is what makes two
    // packets one exchange. Without it a reply is just another arrival
    // and the asker cannot tell which question it answers. Carried by
    // the envelope rather than by a field of ours — see the header.
    const made = packet.encode(APP, Object.assign({ verb: 'granted' }, answer), { re: message.hash });
    const reply = made && made.text;

    // A THROW HERE REACHES NOBODY — this runs inside peerPost's arrival
    // fan-out, which swallows it (arrivals.js:200) while the sender is
    // still owed a receipt for the ASK. The ask is receipted either way;
    // it is the grant that would be lost, so it is logged rather than
    // dropped in silence.
    // A GRANT THAT COULD NOT BE PACKED IS SAID, NOT POSTED AS NOTHING
    // (wsl-claude's sweep, puppets/G1). It cannot happen today, since a grant
    // is name-sized, and if it ever does it is logged here rather than
    // posting an undefined text. The post's own rejection is caught too:
    // try/catch sees only a synchronous throw.
    const lost = function (why) {
      api.log(APP + ': the grant for "' + body.name + '" could not be posted: ' + why);
    };
    if (!reply) { lost((made && made.error) || 'it could not be packed'); return; }
    try {
      if (api.post) {
        Promise.resolve(api.post('', message.fromKey, reply, null, null))
          .catch(function (e) { lost((e && e.message) || e); });
      }
    } catch (e) {
      lost((e && e.message) || e);
    }
  });
}

module.exports = { mount: mount, decide: decide, NAME_RE: NAME_RE };
