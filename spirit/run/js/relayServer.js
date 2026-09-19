// ── THE PUBLIC RELAY'S OWN STARTUP MODULE ────────────────────────────
//
// Cycle 0 (design/principles/NODE-AND-RELAY.md, decided by Andy
// 2026-09-19): a node and a relay are two different things, and the first
// step of separating them is two startup modules. Until then one
// js/server.js booted either, and a --relay process loaded the node's half
// and left it sitting in memory — hub, the traffic log, the jobs module
// with an fs-watcher scanning the whole root for a Files app a relay never
// serves. A relay's RAM is the most expensive thing it has (standing rule,
// same document), so it no longer loads any of that.
//
// `node js/server.js --relay` still works: server.js hands off to this
// file before it loads anything (the systemd unit, Procfile and
// install-public-relay.js all start it that way). `node js/relayServer.js`
// is the same process without the hand-off.
//
// What a relay IS stays in relay.js. This file is only the HTTP in front
// of it: the public surface, the bind, the partner streams and the
// goodbye.
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const relayConfig = require('./relayConfig');
const spirit = require('./kernel');
const createRelay = require('./relay');
// For keyFromUrl only — translating a URL segment back to the stored key
// form. No secret reaches this side of the wire.
const deviceAuth = require('./deviceAuth');
// Resolved ONCE, here, as the process loads — see buildStamp.js. Asking
// again later would report whatever is on disk now, which is the lie
// this is meant to catch.
const buildStamp = require('./buildStamp');
const common = require('./serveCommon');
const readJsonBody = common.readJsonBody;
const deviceRefusal = common.deviceRefusal;

// THE RELAY'S PORT, which is not the node's (65432). Caddy proxies :443 to
// 127.0.0.1:65430 on spirit-3 (bash/caddy/Caddyfile, bash/lib.sh), so a
// bare `node js/relayServer.js` lands where Caddy looks. Andy, 2026-09-19.
// --port and PORT still override it, and every deploy script passes one.
const DEFAULT_RELAY_PORT = 65430;

// How often the Governor looks. A few seconds is fast enough to catch a
// rise in connections and slow enough to cost nothing; one step per tick
// means a full swing takes a minute, which is readable on a monitor.
const GOVERNOR_TICK_MS = 5000;

const BUILD = buildStamp.resolve(spirit.core.node.const.ROOT_DIR);
const STARTED_AT = new Date().toISOString();

// A relay's half: the peerPost it posts to partners from, and the streams
// it holds to them. Built after the server is listening.
let partnerRouter = null;
let partnerLinks = null;

// Checked before verifyStartupCwd, on purpose — --help should work
// regardless of which directory this was launched from.
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(
    'Usage: node js/relayServer.js [--port <number>]\n' +
    '   or: node js/server.js --relay [--port <number>]   (the same process)\n\n' +
    '  Runs a public relay: serves relay.html at / and /index.html, answers only\n' +
    '  the relay routes (/api/relay/*) and 404s everything else.\n' +
    '  Binds 0.0.0.0 (not loopback) and accepts any Host, since a relay is meant\n' +
    '  to be reached from the internet. A personal node is js/server.js.\n\n' +
    '  --port <number>   Listen on this port instead of the default (' + DEFAULT_RELAY_PORT + ').\n' +
    '                    Same effect as the PORT environment variable; --port wins if both are given.\n' +
    '  --help, -h        Show this message and exit.\n\n' +
    'Must be run from spirit/run/ (this directory\'s parent must be named "spirit").'
  );
  process.exit(0);
}

common.verifyStartupCwd('js/relayServer.js');

const ROOT_DIR = spirit.core.node.const.ROOT_DIR;
const port = common.portFromArgs(process.argv.slice(2)) || process.env.PORT || DEFAULT_RELAY_PORT;

// ── THE OWNER'S BOUND, READ ONCE (cycle 1) ───────────────────────────
//
// relay-state/config.json, beside allow.json. Bounded by the box: a
// ceiling larger than this machine refuses to start rather than being
// honoured (relayConfig.js). Never re-read — the configuration is not a
// real-time tool (NODE-AND-RELAY §5, scope).
const CONFIG = (function () {
  let text = null;
  try { text = fs.readFileSync(path.join(ROOT_DIR, 'relay-state', 'config.json'), 'utf8'); }
  catch (e) { text = null; }
  const read = relayConfig.parse(text, os.totalmem() / (1024 * 1024));
  if (!read.ok) {
    console.error('Refusing to start: ' + read.error);
    process.exit(1);
  }
  return read.config;
}());

// HOW THIS RELAY ASKS A PARTNER, injected rather than reached for.
//
// LATE-BOUND on purpose: createRelay runs at module load and partnerRouter
// is built after the server is listening, so this closes over the variable
// rather than the value. A relay still booting answers from its own
// members and propagates nothing.
//
// `post` is peerPost's, so the hash, the proof the partner read it, and
// the dispatch of the answer back to this exact question are all the
// interface's and none of relay.js's (AGENT.md, Comms).
const relay = createRelay.createRelay(undefined, {
  askPartner: function (url, relayKey, text) {
    if (!partnerRouter) return Promise.resolve(null);
    return partnerRouter.post(url, relayKey, text);
  },
  config: CONFIG,
});

// A relay is a party to conversations, and `relay` is the caption it
// answers to, not an identity. A node that keeps one file per peer cannot
// file the relay anywhere without a key, so the relay gets one: made
// once, on the first relay boot, into this process's own relay-state
// beside allow.json. It is handed out through /api/relay/key
// (relay.relayPublicKey), and it is NOT the owner's key — the owner is a
// peer who claimed, the relay is the box.
require('./relayAuth').ensureIdentity(ROOT_DIR, 'relay');

// The browser's half. This request is HELD — the relay does not answer
// until the personal node has been posted to and replied, or the wait
// runs out. It used to be held past a poll; it is now held for a round
// trip, which is under a second when the node is there.
//
// Nothing here reads the password: it is carried to the node and the node
// compares it (DEVICE-CYCLE2.md).
function handleDeviceOffer(req, res) {
  readJsonBody(req).then(function (body) {
    // The name may be absent, and is on the bare /device page: relay.js
    // resolves an omitted one to the owner label, which is who that page
    // enrols. A per-key page sends its own segment, which is decoded to
    // the stored key form here — the one place that translation happens.
    const asked = (body && body.name) || '';
    const asKey = deviceAuth.keyFromUrl(asked);
    return relay.deviceOffer(
      asKey && relay.deviceIdentityPublic(asKey) ? asKey : asked,
      body && body.password,
      body && body.devicePublicKey
    );
  }).then(function (result) {
    if (!result || !result.ok) {
      deviceRefusal(res, result && result.status);
      return;
    }
    // THE ENROLLED IDENTITY'S label goes back with the yes, because from
    // here the page has to sign as somebody: every line it sends is
    // `send\n<from>\nrelay\n<text>`, and `from` is whoever this device
    // now belongs to.
    //
    // It said the relay's OWNER until 2026-09-12, and that was true
    // when it was written — the bare /device page enrolled the owner and
    // nobody else, so there was only one answer it could be. B2 gave
    // every identity with a row its own /<key>/device page and its own
    // slot, and this did not follow: every page on the box came back
    // "signed in as andy", bella's included.
    //
    // Nothing is given away by saying it: this answer only ever follows a
    // password the node itself accepted. An empty name simply leaves the
    // page unable to sign, which is the honest outcome for an enrolment
    // that named nobody.
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      devicePublicKey: result.devicePublicKey,
      // WHOEVER WAS ENROLLED, which is not the same as whoever owns this
      // relay. It read `snapshot().owner` and therefore said "andy" to
      // every page on the box, bella's included.
      name: result.name || '',
    }));
  }).catch(function () {
    deviceRefusal(res, 403);
  });
}

// handleSetDevice STOOD HERE, and POST /api/relay/set-device with it.
// Enrolment is a post now — relay.answerSelf, body.setDevice — because
// installing a key on your own row was never an owner verb and so could
// never have gone through a door only the owner may knock on.

function handleRelayClaim(req, res) {
  readJsonBody(req).then(function (body) {
    const result = relay.claim(
      body && body.name,
      body && body.sig,
      body && body.publicKey,
      common.clientKeyFor(req),
      body && body.invite,
      // THE WORD ON THE INVITE, which is not the name being claimed.
      // `name` is what this key wants to be called; `inviteLabel` is what
      // the owner wrote down to identify the person they were inviting,
      // and it is matched and then forgotten (R1, 2026-09-15). A caller
      // that sends only `name` gets the old behaviour, where the two were
      // one string.
      body && body.inviteLabel
    );
    res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8' });
    // A 409 carries the peer that is already there so the caller can tell
    // "that name is mine already" from "that name is someone else's". The
    // key is public.
    var payload = result.ok
      ? result.peer
      : (result.peer ? { error: result.error, peer: result.peer } : { error: result.error });
    res.end(JSON.stringify(payload));
  }).catch(function () {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid JSON body');
  });
}

// `/<key>/device`, and nothing else beneath `/<key>/`. A CLOSED set of
// surfaces, deliberately: if an arbitrary suffix resolved to a file, the
// URL would be building a filesystem path out of input a stranger picked,
// which is where directory traversal lives. Shared assets stay at the
// root, where they are literals and belong to nobody.
//
// Returns the stored-form key, or '' — the caller still has to ask the
// relay whether anybody owns it.
const DEVICE_PAGE_PATH = /^\/([A-Za-z0-9_-]{16,512})\/device$/;
function devicePageKey(pathname) {
  const m = DEVICE_PAGE_PATH.exec(pathname || '');
  if (!m) return '';
  return deviceAuth.keyFromUrl(m[1]);
}

function isRelayPublicPath(method, pathname) {
  if (pathname === '/' || pathname === '/index.html' || pathname === '/relay.html' || pathname === '/favicon.svg') {
    return method === 'GET';
  }
  // The enroll page, and ONLY addressed by whose it is. The bare /device
  // is gone from a relay (Andy, 2026-09-11: "should /device still work?
  // I think not"): it meant "the owner" by implication, which is the one
  // thing the key-addressed form removes. Two ways to reach one page is
  // drift waiting to happen, and the implicit one names nobody.
  //
  // /device.html goes with it, for the same reason and by the same
  // reasoning that made it public in the first place — it is the same
  // page without an identity.
  //
  // Unlisted rather than hidden: nothing links to these, they carry
  // noindex, and they are reachable by anyone who types one. What
  // protects them is the password and the window, not obscurity. The key
  // in the path is a LOCATOR, and holding one grants nothing.
  if (method === 'GET' && devicePageKey(pathname)) return true;
  // ── WHO THIS RELAY IS, AND NOTHING ELSE (2026-09-18) ───────────────
  //
  //   Andy: "the first two are easily replaced with GET /api/relay/key
  //   or whatever."
  //
  // The two being the front door's "is this sender a relay?" and search's
  // "which key do I address this box as" — both of which need a PIN, and
  // the pin was being derived from the whole census, once per relay per
  // boot. ~147 KB at a thousand members to learn 44 bytes.
  //
  // Fixed cost per request, with no membership term in it, which is what
  // earns it the exemption the census is losing (0013, and 0010's
  // granted-GET table).
  if (method === 'GET' && pathname === '/api/relay/key') return true;
  // The presence wire. Public in the same sense the rest is: reachable
  // from the internet, and gated inside relay.streamOpen, which refuses
  // an identity this box does not hold before it allocates anything.
  if (method === 'GET' && pathname === '/api/relay/stream') return true;
  // WHAT IS THIS BOX MADE OF. Public, deliberately: the question a
  // deploy check asks must not need a private key, or the check cannot
  // run from anywhere but the owner's own machine — and a relay you
  // cannot identify is one you cannot harden. What it gives away is a
  // commit id for code the repository already holds.
  if (method === 'GET' && pathname === '/api/version') return true;
  if (method === 'POST' && pathname === '/api/relay/device') return true;
  if (method === 'POST' && pathname === '/api/relay/claim') return true;
  // The router, and now the only way onto this box. Public in the sense
  // the rest is: reachable from the internet, gated inside relay.js by a
  // signature, and refused instantly if the peer is not there to receive
  // it (decision 0006).
  if (method === 'POST' && (pathname === '/api/relay/post' || pathname === '/api/relay/reply')) return true;
  return false;
}

// The brochure: what a browser gets at a relay's own address. relay.html
// loads no scripts, so these four are the whole of it.
const BROCHURE = {
  '/': 'relay.html',
  '/index.html': 'relay.html',
  '/relay.html': 'relay.html',
  '/favicon.svg': 'favicon.svg',
};

const server = http.createServer((req, res) => {
  // NO LOOPBACK OR HOST GATE, which is the node's first line and not this
  // one's: a relay is meant to be reached from the internet, and a
  // deployed relay is reached by whatever name the platform gave it. What
  // stands in for that gate is not "nothing": isRelayPublicPath (below)
  // reduces the answerable surface to the relay routes and the brochure,
  // and the relay routes themselves are gated by the allow list and
  // signature checks in relayAuth.js.
  if (common.refuseTooBig(req, res)) return;

  const parsed = common.parseRequestPath(req, res);
  if (!parsed) return;
  const url = parsed.url;
  const pathname = parsed.pathname;

  if (!isRelayPublicPath(req.method, pathname)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  if (req.method === 'GET' && pathname === '/api/relay/key') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    // KEY AND LABEL ARE A PAIR (Andy), so a caller that reads one reads
    // both, and nothing has to learn a second shape. Null on a relay that
    // has not been restarted since it grew a key of its own.
    // AND WHO RUNS IT, which a caller can ask for without asking for a
    // membership list. It is what `relay.partnerCheck` needed the census
    // for, and the last thing it needed it for.
    var own = relay.ownerPublic();
    res.end(JSON.stringify({
      relayPublicKey: relay.relayPublicKey(),
      relayLabel: relay.relayLabel(),
      ownerKey: own.ownerKey,
      ownerLabel: own.ownerLabel,
    }));
    return;
  }

  // GET /api/relay/who STOOD HERE — THE CENSUS, DELETED 2026-09-18. See
  // the tombstone in server.js's history and decision 0012: no party may
  // ask a relay for its whole enrolment list.

  // THE DEVICE PAGE. One file for everybody: the key lives only in the
  // URL, and the page reads it off its own address — nothing is templated
  // and nothing is generated per person.
  //
  // An identity nobody holds is a 404 here rather than a working-looking
  // form that can never succeed.
  //
  // RESTORED 2026-09-12. It was deleted by accident in the same commit
  // that removed the poll — the cut ran from the `device-pending` route to
  // the next one and this sat between them, so every keyed device URL
  // 404'd from that moment. Nothing caught it: no suite asks for the page,
  // and relayProbe's surface list does not name it. Andy found it by
  // clicking the link in natterDetails.
  if (req.method === 'GET' && devicePageKey(pathname)) {
    if (!relay.deviceIdentityPublic(devicePageKey(pathname))) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('no such identity here');
      return;
    }
    common.sendFile(res, path.join(ROOT_DIR, 'device.html'));
    return;
  }

  // One held connection per identity, carrying who is reachable. The
  // signature is a HEADER for the same reason device-pending's is: a
  // query string is written to every access log the request passes, and
  // this one buys a STANDING grant rather than a single read. Same
  // function enforces it, so there is one rule and not two.
  if (req.method === 'GET' && pathname === '/api/relay/stream') {
    const from = createRelay.streamSignatureFrom(url.searchParams.get('sig'), req.headers);
    if (!from.ok) {
      deviceRefusal(res, from.status);
      return;
    }
    const token = url.searchParams.get('key') || '';

    // A sink, not a response: relay.js and presence.js hold this and
    // neither knows what http is.
    //
    // THE HEAD IS WRITTEN LAZILY, on the first write, and that is not a
    // micro-optimisation. It shipped the other way — head first, so the
    // roster had somewhere to go — and a refusal then had to travel as
    // an event inside a 200, because the status line was already spent.
    // A client cannot see a status the server has committed to, so every
    // refusal looked to it like a connection that opened and closed, it
    // reset its backoff on that, and a stale credential became a
    // one-per-second hammer against a relay that was refusing it.
    //
    // Written this way the gate answers first and a refusal is a 403 that
    // says so.
    let headed = false;
    const sink = {
      write: function (chunk) {
        if (!headed) {
          headed = true;
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });
        }
        res.write(chunk);
      },
      close: function () { try { res.end(); } catch (e) { /* gone */ } },
    };

    const opened = relay.streamOpen(token, from.sig, sink);
    if (!opened || !opened.ok) {
      // SAY HOW LONG, because this box is the only one that knows. A 429
      // here is the connect allowance — six a minute, one per ten seconds
      // — and a client left to guess will guess with a constant that has
      // no idea what this relay allows.
      //
      // RFC 9110 Retry-After, in seconds. sseClient honours it over its
      // own backoff, so the number that governs the retry is the number
      // that governs the refusal.
      if (opened && opened.status === 429) {
        try { res.setHeader('Retry-After', String(Math.ceil(60 / relay.presence.perMin) + 5)); }
        catch (e) { /* headers already sent */ }
      }
      // FULL (cycle 1): the Governor has the connection allowance below
      // the number of streams wanting in. Come back after a few ticks,
      // when the lever may have moved up again — not in a second.
      if (opened && opened.status === 503) {
        try { res.setHeader('Retry-After', String(Math.ceil(GOVERNOR_TICK_MS * 6 / 1000))); }
        catch (e) { /* headers already sent */ }
      }
      deviceRefusal(res, opened && opened.status);
      return;
    }

    const heartbeat = setInterval(() => {
      try { res.write(':\n\n'); } catch (e) { /* teardown will follow */ }
    }, 20000);

    // Bound to 'error' as well as 'close', and once-guarded. The bug
    // that guards against is worse here than anywhere: a socket that
    // dies without a clean close would leave a peer reading as PRESENT
    // forever, which is the relay lying — and lying is the one thing this
    // design cannot afford.
    let torndown = false;
    function teardown() {
      if (torndown) return;
      torndown = true;
      clearInterval(heartbeat);
      relay.streamClose(token, sink);
    }
    req.on('close', teardown);
    req.on('error', teardown);
    return;
  }

  if (req.method === 'GET' && pathname === '/api/version') {
    common.sendVersion(res, BUILD, STARTED_AT, true);
    return;
  }

  if (req.method === 'GET' && BROCHURE[pathname]) {
    common.sendFile(res, path.join(ROOT_DIR, BROCHURE[pathname]));
    return;
  }

  if (req.method === 'POST') {
    if (pathname === '/api/relay/claim') {
      handleRelayClaim(req, res);
      return;
    }

    if (pathname === '/api/relay/post') {
      readJsonBody(req).then(function (body) {
        const result = relay.routePost(
          body && body.from, body && body.to, body && body.text, body && body.sig
        );
        res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result.ok ? result : { error: result.error, inFlight: !!result.inFlight }));
      }).catch(function () {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Invalid JSON body');
      });
      return;
    }

    if (pathname === '/api/relay/reply') {
      readJsonBody(req).then(function (body) {
        const result = relay.routeReply(
          body && body.from, body && body.hash, body && body.text, body && body.sig
        );
        res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result.ok ? result : { error: result.error }));
      }).catch(function () {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Invalid JSON body');
      });
      return;
    }

    if (pathname === '/api/relay/device') {
      handleDeviceOffer(req, res);
      return;
    }
  }

  // Unreachable while isRelayPublicPath and the branches above agree; a
  // 404 rather than a hang if they ever stop agreeing.
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

// A relay binds 0.0.0.0: it is the one server that genuinely needs to be
// reachable from another machine — required by every platform that
// health-checks the port it assigned (Heroku, Fly, a plain VPS). Bind
// loopback there and the health check fails, the dyno is killed, and it
// reads as "SpiritOS is broken" rather than as a bind mistake.
const BIND_HOST = '0.0.0.0';

common.refuseListenError(server, port, 'js/relayServer.js');

// ── A RELAY THAT KNOWS IT IS GOING SAYS SO ───────────────────────────
//
//   Andy: "can a relay that knows its shutting down (lab.andyflinn.com
//   reboot by your request) send a message down the SSE connections to
//   prepare its counterparts to re-connect?"
//
// It spends its moment on `retry:`, which is SSE's own field for when to
// come back. So a hundred members do not all reconnect one second later
// into a box that is still booting, get refused, and back off further
// than they needed to. `bash/update` restarts a relay every time it takes
// a tag: this is a routine Tuesday, not an outage.
//
// THREE SECONDS is a guess at a node boot, and a cheap one to be wrong
// about: too low and a member is refused once and retries on its own
// backoff, which is where it would have been anyway.
//
// The node's own goodbye (server.js) tells its browser pages the same
// thing, through the same presence.sayGoingAway.
{
  let leaving = false;
  const goodbye = function (signal) {
    if (leaving) return;
    leaving = true;
    let told = 0;
    try { told += relay.presence.goingAway(3000); }
    catch (e) { /* nothing to tell, or already gone */ }
    // The streams this relay HOLDS, as opposed to the ones it serves.
    // Closed rather than left to the process exiting, so a partner sees
    // a clean end and reconnects on its own clock instead of waiting out
    // the idle watchdog.
    try { if (partnerLinks) partnerLinks.stop(); }
    catch (e) { /* already gone */ }
    console.log(`${signal} — told ${told} stream(s) to come back in 3s`);
    try { server.close(); } catch (e) { /* not listening */ }
    process.exit(0);
  };
  process.on('SIGTERM', function () { goodbye('SIGTERM'); });
  process.on('SIGINT', function () { goodbye('SIGINT'); });
}

server.listen(port, BIND_HOST, () => {
  console.log(`Relay listening on ${BIND_HOST}:${port} — PUBLIC, no loopback or Host restriction`);
  // relayAuth.loadAllow treats a missing or unreadable allow.json as
  // mode 'open': any name claimable by anyone, any sender accepted, no
  // signature required. That is the right default for a lab relay and
  // the wrong one for a public box, and until now the two were
  // indistinguishable from the console — an open relay looked exactly
  // like a working one right up until someone else claimed your name.
  // Say which one this is.
  if (require('./relayAuth').loadAllow(ROOT_DIR).mode === 'open') {
    console.warn(
      // WHAT AN OPEN RELAY ACTUALLY RISKS, which is one thing now and
      // was three. "send as anyone, and read any relay" went with the
      // ring (R8): there is nothing to read and no way to send. What is
      // left is the one that matters — the first claim takes the box.
      '    WARNING: no relay-state/allow.json — this relay is OPEN. Anyone who can reach it\n' +
      '    may take the first claim, and the first claim is the OWNER (decision 0003).\n' +
      '    Run install-public-relay.js to reserve a name, or create relay-state/allow.json\n' +
      '    (a { "keys": [...] } list) by hand.'
    );
  }

  // THE HEARTBEAT STOOD HERE, and it was wrong from the day it shipped.
  // R9 pushed a status report every ten seconds for ever, watched or not.
  // What replaced it: the owner POSTS to the relay and the relay answers
  // by hash on their own stream. A relay nobody is watching now does
  // exactly nothing about being watched.

  // -- AND IT DIALS ITS PARTNERS ------------------------------------
  //
  //   Andy: "Both partners must have the mutual sseClients alive in
  //   this pass."
  //
  // ONE STREAM EACH WAY, because the stream is the INBOUND half of the
  // interface: B's answers to A land on the stream A holds, so if only
  // one end dialled, the other could ask nothing. Both ends run this,
  // so both ends can ask.
  //
  // Its own peerPost, signing as this relay's identity, with
  // relayRequest injected — the same interface a node uses, which is why
  // this needed no new transport and inherits the backoff, jitter, idle
  // watchdog and `retry:` handling without a line of its own.
  partnerRouter = require('./peerPost').createPeerPost({
    rootDir: ROOT_DIR,
    request: require('./relayRequest').relayRequest,
    // NO TRAFFIC LOG. peerPost takes it injected precisely so a relay
    // can omit it: that file is correct on a personal node and is "the
    // worst thing in the system on a relay" (peerPost.js).
  });
  partnerLinks = require('./partnerLink').createPartnerLinks({
    rootDir: ROOT_DIR,
    relay: relay,
    router: partnerRouter,
  });
  const dialled = partnerLinks.start();
  if (dialled) console.log(`    holding ${dialled} partner stream(s)`);

  // -- AND IT GOVERNS ITSELF (cycle 1) -------------------------------
  //
  // One tick every few seconds: read heap, move the one lever at most one
  // twelfth, carry it out, tell the owner. Cheap by construction — it
  // reads numbers the process already has.
  console.log(`    RAM limit ${CONFIG.ramLimitMB} MB (${CONFIG.source}); governor ticking every ${GOVERNOR_TICK_MS / 1000}s`);
  setInterval(function () {
    try { relay.governorTick(); }
    catch (e) { console.error('governor tick failed: ' + e.message); }
  }, GOVERNOR_TICK_MS);
});
