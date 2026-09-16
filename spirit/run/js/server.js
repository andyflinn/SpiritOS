const http = require('http');
const fs = require('fs');
const path = require('path');
const spirit = require('./kernel');
const createRelay = require('./relay');
// For keyFromUrl only — translating a URL segment back to the stored key
// form. No secret reaches this side of the wire.
const deviceAuth = require('./deviceAuth');
// Resolved ONCE, here, as the process loads — see buildStamp.js. Asking
// again later would report whatever is on disk now, which is the lie
// this is meant to catch.
const buildStamp = require('./buildStamp');
// How big a thing may be — one file, shared with the relay and the page.
const limits = require('./limits.js');
const BUILD = buildStamp.resolve(spirit.core.node.const.ROOT_DIR);
const STARTED_AT = new Date().toISOString();
const relay = createRelay.createRelay();


//console.log(JSON.stringify(spirit,null,2));

// Checked before verifyStartupCwd below, on purpose — --help should work
// regardless of which directory this was launched from, not get refused
// alongside every other startup mistake.
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(
    'Usage: node js/server.js [--port <number>] [--relay]\n\n' +
    '  --port <number>   Listen on this port instead of the default (' + spirit.core.node.const.DEFAULT_SPIRIT_PORT + ').\n' +
    '                    Same effect as the PORT environment variable; --port wins if both are given.\n' +
    '  --relay           Run as a public relay: serve relay.html at / and /index.html, answer\n' +
    '                    only the relay routes (/api/relay/*) and 404 everything else —\n' +
    '                    /api/spirit, /api/events and the desktop shell.\n' +
    '                    Binds 0.0.0.0 (not loopback) and accepts any Host, since a relay is\n' +
    '                    meant to be reached from the internet. Do NOT pass this to a personal\n' +
    '                    node; those stay loopback-only.\n' +
    '  --help, -h        Show this message and exit.\n\n' +
    'Examples:\n' +
    '  node js/server.js\n' +
    '  node js/server.js --port 65431\n' +
    '  node js/server.js --port 65430 --relay\n' +
    '  PORT=65431 node js/server.js\n\n' +
    'Must be run from spirit/run/ (this directory\'s parent must be named "spirit") — see the startup check below if that fails.'
  );
  process.exit(0);
}

// Job spawning (jobs.js's startProcessJob) passes relative script paths
// like "process/js/lmStudioLoadModel/lmStudioLoadModel.js" straight to
// child_process.spawn without ever setting an explicit cwd, so it
// inherits whatever directory THIS process was started from. Every other
// path in the app is resolved off ROOT_DIR (__dirname-relative, always
// correct) — this is the one place actual process.cwd() matters, and
// starting the server from the wrong place (e.g. `cd js && node
// server.js` instead of `node js/server.js` from spirit/run) breaks job
// spawning silently: scripts fail in well under a second with no useful
// error, easy to mistake for a real bug in the spawned script itself.
// Fail loud and immediately instead.
(function verifyStartupCwd() {
  var cwd = process.cwd();
  var errors = [];

  var REQUIRED_DIRS = ['app', 'js', 'process'];
  var missing = REQUIRED_DIRS.filter(function (name) {
    try { return !fs.statSync(path.join(cwd, name)).isDirectory(); }
    catch (err) { return true; }
  });
  if (missing.length > 0) {
    errors.push('expected ' + missing.join('/, ') + '/ under the current directory, but ' + (missing.length > 1 ? 'they weren\'t' : 'it wasn\'t') + ' found');
  }

  // Belt and suspenders: this project's own folder is always named
  // "spirit", one level up from wherever the server actually runs
  // (spirit/run) — catches starting from some unrelated folder that
  // happens to also have app/js/process children.
  if (path.basename(path.dirname(cwd)) !== 'spirit') {
    errors.push('expected the current directory\'s parent to be named "spirit" (i.e. running from spirit/run), but it\'s "' + path.basename(path.dirname(cwd)) + '"');
  }

  if (errors.length > 0) {
    console.error(
      'Refusing to start: ' + errors.join('; ') + '. Current directory: ' + cwd + '\n' +
      'Job spawning resolves script paths relative to wherever this process was started from — ' +
      'run this as `node js/server.js` from spirit/run, not from inside js/.'
    );
    process.exit(1);
  }
})();

const ROOT_DIR = spirit.core.node.const.ROOT_DIR;
const MIME_TYPES = spirit.core.const.MIME_TYPES;

const hub = require('./hub').createHub(ROOT_DIR);


// --port <n> / --port=<n> takes precedence over PORT, for running a
// second instance ad hoc (e.g. an installer/reinstall test alongside a
// dev instance already holding the default port) without having to set
// an environment variable first.
function portFromArgs(argv) {
  const eqArg = argv.find((arg) => arg.startsWith('--port='));
  if (eqArg) return Number(eqArg.slice('--port='.length));
  const flagIndex = argv.indexOf('--port');
  if (flagIndex !== -1 && argv[flagIndex + 1] !== undefined) return Number(argv[flagIndex + 1]);
  return null;
}

const port = portFromArgs(process.argv.slice(2)) || process.env.PORT || spirit.core.node.const.DEFAULT_SPIRIT_PORT;

// First step toward the public relay/hub vision (server #3) — deliberately
// just a routing switch for now. The actual relay protocol (signed-
// challenge auth against an allowed-public-keys list, message delivery) is
// separate, later work.
//
// This started as nothing but a routing switch for GET / — everything else
// stayed reachable. It isn't that any more. Phase B narrowed a --relay
// process to the relay routes plus the brochure (isRelayPublicPath,
// below; labRelaySurface.js proves Jobs/fs/proxy/hub/the desktop all
// 404), and Phase F takes the last step: a --relay process binds 0.0.0.0
// and drops the loopback + Host gate, because it is meant to be reached
// from the internet.
//
// So this one flag is now the whole difference between "a personal node,
// unroutable from outside this machine" and "a public server". A personal
// node must never be started with it.
const relayMode = process.argv.slice(2).includes('--relay');
const HOME_PAGE = relayMode ? 'relay.html' : 'index.html';

// THE LOG, read as a table. One store for both directions, keyed by hash
// and ordered by arrival — and the thing the arrivals seam hands rows to,
// so a page that was closed can catch up from the same place a live page
// is fed from.
const trafficLog = require('./trafficLog').createTrafficLog({
  rootDir: spirit.core.node.const.ROOT_DIR,
  relayMode: relayMode,
});

// THE ROUTER'S ARRIVAL SEAM. Declared up here because the two halves sit
// far apart and both need it: handleSseConnection subscribes (a browser
// opening a page), and the peerRouter built at the foot of this file
// notes into it (a packet landing off the stream). Neither knows about
// the other, which is the point of putting a seam between them.
// A RELAY'S OWN ACTIVITY, ON ITS WAY TO A PANEL. The same seam shape as
// arrivals and for the same reason: presenceNode receives, server.js
// fans out, and neither knows about the other.
const relayEvents = require('./arrivals').createFanOut();

const arrivals = require('./arrivals').createArrivals({
  // A packet that lands while no page is open waits IN THE LOG — a row
  // that is admitted and not yet taken. The seam keeps nothing of its
  // own and reaches the log through its api block, never through the
  // file: production code reads through the API.
  traffic: trafficLog,
});


// A relay is a party to conversations — the census reply comes FROM
// it — and `relay` is the caption it answers to, not an identity. A node
// that keeps one file per peer cannot file the relay anywhere without
// a key, so the relay gets one: made once, on the first --relay boot,
// into this process's own relay-state beside allow.json. It is handed
// out through who and status (relay.mailboxPublicKey), and it is NOT the
// owner's key — the owner is a peer who claimed, the relay is the box.
// A personal node never reaches this line; its identity is made on its
// first claim (hub.js).
if (relayMode) {
  require('./relayAuth').ensureIdentity(ROOT_DIR, 'relay');
}

// The small, fixed set of paths the page needs to boot at all, served
// unconditionally by the static route below, checked before fileServable —
// this is what lets js/kernel.js sit in kernel.js's UNSERVABLE_FILES
// (blocking the *generic* read/list capability: loadFile, scanFolder, the
// Files app, the fs-watcher) while still working as the page's own boot
// script. Both index.html and relay.html are listed unconditionally
// (not just whichever HOME_PAGE resolved to) — either is reachable by its
// own literal path regardless of mode, this just keeps both bootable.
const BOOT_ASSETS = ['index.html', 'relay.html', 'js/kernel.js', 'js/client/shell.js', 'favicon.svg'];

const jobs = require('./jobs')(spirit, port);
jobs.startFsWatcherJob(ROOT_DIR);

// Held here rather than inside the boot block so a later shutdown path
// has something to close. Null on a relay, which holds no streams.
let presence = null;
let peerRouter = null;

// ── WHAT THE LOOPBACK CLIENT DOOR CAN BE ASKED ───────────────────────
//
// Declared here, filled at the foot of this file. Modules claim their
// own namespace where their dependencies exist — see js/verbTable.js for
// why claiming beats a table, and why it happens after boot rather than
// on require.
//
// Empty on a relay, and that is correct rather than incidental: a relay
// answers only isRelayPublicPath, and /api/spirit is not on it.
const loopbackVerbs = require('./verbTable').createVerbTable();
// AND THE URL→KEY PIN, out here for a different reason: a REQUEST needs
// it. The answerer itself is built inside the boot block and was only
// ever read from inside it, so `const answerer` was enough — until
// /api/hub/invite started posting to the relay instead of calling a route
// on it, and needed to know which key that url is.
//
// The failure was a ReferenceError that killed the process on the first
// mint, because a route handler runs long after the block that declares
// a const inside it has finished. `peerRouter` is up here for exactly
// this reason and has been since the router landed.
let pinnedRelayKey = null;

const requestCounters = { total: 0, byMethod: {}, byStatusClass: {} };
jobs.startStatsJob({ requestCounters: requestCounters });

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

const fsPath = spirit.core.node.util.fsPath;

// ── READ ONCE, ANSWERABLE TWICE ──────────────────────────────────────
//
// A request body is a stream and a stream is consumed. That was fine
// while a path chose the handler, because exactly one thing ever read
// it.
//
// /api/spirit has to look at the body to know WHICH handler — the verb
// is in there — and the handler it picks then reads the same body for
// itself. So the promise is memoised on the request: the first caller
// drains the stream, every later caller gets the same answer, and a
// handler moving under the single door needs no change of its own.
//
// Memoised on `req` rather than in a table, because the lifetime is
// exactly the request's and nothing has to remember to clean up.
const BODY_PROMISE = Symbol('spiritJsonBody');

// ── THE CAP THAT WAS MISSING, AND IT IS THE ONE THAT MATTERS ─────────
//
// This read `body += chunk` with no limit of any kind. The payload caps
// in relay.js are checked AFTER the body is whole and parsed, so they
// bounded what got ROUTED and never what got ACCEPTED — on a public box,
// on every POST, /claim and /device included.
//
// So the memory arithmetic everybody reasoned from was an intention:
//
//   router: 256 concurrent, 16 per requester, no bodies held
//   256 × 16 KB ≈ 4 MB in flight, ~12 MB peak through parse
//
// True of routed requests. Meanwhile real exposure was concurrent
// sockets × whatever they cared to send, with `body += chunk` holding the
// old string and the new one, and JSON.parse making a third copy.
//
// TWO CHECKS, BECAUSE Content-Length IS A CLAIM.
//
//   1. the header, when there is one — refuse before reading a byte
//   2. the running total, always — because `Transfer-Encoding: chunked`
//      carries no Content-Length at all, and a client that sends one can
//      send more than it promised
//
// (1) alone is bypassed by omitting the header. (2) alone works and
// wastes a cap's worth of reading on every abuser. Neither is redundant.
//
// The socket is DESTROYED rather than left to finish: a request refused
// for size must not go on arriving, or the refusal costs what it was
// refusing.
function readJsonBody(req) {
  if (req[BODY_PROMISE]) return req[BODY_PROMISE];
  const reading = new Promise((resolve, reject) => {
    const tooBig = () => {
      const err = new Error('body too large');
      err.statusCode = 413;
      req.destroy();
      reject(err);
    };

    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > limits.BODY_MAX) {
      tooBig();
      return;
    }

    let body = '';
    let seen = 0;
    req.on('data', chunk => {
      // Bytes, not characters — Content-Length is bytes, and a multi-byte
      // body would otherwise be measured smaller than it arrives.
      seen += Buffer.byteLength(chunk);
      if (seen > limits.BODY_MAX) {
        tooBig();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
  req[BODY_PROMISE] = reading;
  return reading;
}

// Which verb this is, for the one door that has to know before it can
// choose. A body that will not parse is not a verb — the handler that
// would have been chosen is the one that reports that, so this answers
// empty and lets the dispatch below say "no such verb".
function peekVerb(req) {
  return readJsonBody(req)
    .then(function (body) { return String((body && body.verb) || ''); })
    .catch(function () { return ''; });
}

// The connection's own address, used only as a rate-limiting bucket key —
// never as authority for anything. Rate limits used to key on the name in
// the request body, which the sender chooses, so rotating it reset the
// budget; this is the one thing about a request the caller can't restate
// at will.
function clientKeyFor(req) {
  return req.socket.remoteAddress || '';
}

// handleRelayInvite STOOD HERE. See hub.handleInvite for what a node
// does instead: the browser's door is unchanged, the wire underneath it
// is a post to the relay.

// One answer for every way this can fail, and it says nothing.
//
// Wrong password, a node that is not connected, a node that took the
// offer and went quiet — all of it comes back as `not now`. A form that
// distinguished them would answer questions nobody standing at it is
// entitled to ask: "is this the right password but the wrong moment" is
// exactly what a caller with the wrong password wants to know.
//
// The STATUS still varies, and only for the rate limit — 429, which the
// page waits out rather than gives up on. The STRING never varies
// (DEVICE-CYCLE3.md).
function deviceRefusal(res, status) {
  res.writeHead(status || 403, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'not now' }));
}

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
    // Nothing is given away by saying it. The label is already public —
    // /api/relay/who hands the whole peer list, names and keys, to anyone
    // who asks — and this answer only ever follows a password the node
    // itself accepted. An empty name simply leaves the page unable to
    // sign, which is the honest outcome for an enrolment that named
    // nobody.
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
      clientKeyFor(req),
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
    // key is public — /api/relay/who hands out the same thing.
    var payload = result.ok
      ? result.peer
      : (result.peer ? { error: result.error, peer: result.peer } : { error: result.error });
    res.end(JSON.stringify(payload));
  }).catch(function () {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid JSON body');
  });
}

function handleSseConnection(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  res.write('event: snapshot\ndata: ' + JSON.stringify({ jobs: jobs.listJobs() }) + '\n\n');

  const onJobUpdated = (job) => {
    res.write('event: job-updated\ndata: ' + JSON.stringify(job) + '\n\n');
  };
  jobs.events.on('job-updated', onJobUpdated);

  const onJobDeleted = (id) => {
    res.write('event: job-deleted\ndata: ' + JSON.stringify(id) + '\n\n');
  };
  jobs.events.on('job-deleted', onJobDeleted);

  // A PACKET FROM A PEER, arriving over the router. This connection is
  // already open, already per-page and already torn down properly, so
  // the alternative — a second EventSource for packets — would have
  // bought nothing but another socket per tab.
  //
  // The route is named `/api/events` and not `/api/jobs/events` for
  // exactly this reason: it is the node's event stream, and jobs were
  // only its first customer.
  //
  // Nothing is filtered here. peerPost's front door decided who may be
  // heard before this was ever called, and the shell decides which app
  // wants it; a third opinion in the middle would be a third thing to
  // get wrong.
  // WHAT A WATCHED RELAY IS DOING. Rides the one stream the page already
  // holds, like `packet` does — a second EventSource per tab to watch a
  // relay would be a second socket for a panel somebody has open for a
  // minute.
  const offRelayEvent = relayEvents.subscribe((row) => {
    res.write('event: relay-event\ndata: ' + JSON.stringify(row) + '\n\n');
  });

  const offArrival = arrivals.subscribe((message) => {
    res.write('event: packet\ndata: ' + JSON.stringify(message) + '\n\n');
  });

  const heartbeat = setInterval(() => {
    res.write(':\n\n');
  }, 20000);

  // Bound to 'error' as well as 'close': a socket that dies without a
  // clean close (a killed browser, a dropped network) never fired 'close',
  // leaving the 20-second heartbeat writing to a dead response forever and
  // both listeners attached. Guarded so it runs once whichever fires first.
  let torndown = false;
  function teardown() {
    if (torndown) return;
    torndown = true;
    clearInterval(heartbeat);
    jobs.events.off('job-updated', onJobUpdated);
    jobs.events.off('job-deleted', onJobDeleted);
    // Same reason the heartbeat is cleared, and the same failure if it
    // is not: a subscriber that outlives its socket writes packets into
    // a dead response for ever, and holds the message in memory to do it.
    offArrival();
    offRelayEvent();
  }
  req.on('close', teardown);
  req.on('error', teardown);
  res.on('error', teardown);
}

function handleCreateJob(req, res) {
  readJsonBody(req).then((body) => {
    const job = jobs.startProcessJob(body.command, body.args || [], { type: body.type });
    res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(job));
  }).catch(() => {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid JSON body');
  });
}

// ── THE ID CAME OUT OF THE PATH ──────────────────────────────────────
//
// `POST /api/jobs/<id>` carried it as a path segment, matched by a
// regexp. Under one door it is a field: `{verb:'jobs.update', id, ...}`.
//
// This is the case stage 2 exists to prove, because fs and hub both have
// parameters too — and a parameter in a path is a parameter a type
// system cannot see, matched by a regexp that has to agree with a route
// by hand.
//
// `id` is read from the body and the REST of the body is still the
// patch, which is why it is deleted from the copy rather than passed
// alongside: jobs.updateJob takes a patch, and a patch carrying the id
// of the thing it patches would be a field that means nothing to it.
function handleJobUpdate(req, res) {
  readJsonBody(req).then((whole) => {
    const id = String((whole && whole.id) || '');
    const body = Object.assign({}, whole);
    delete body.id;
    delete body.verb;
    const job = jobs.updateJob(id, body);
    if (!job) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(job));
  }).catch(() => {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid JSON body');
  });
}

// Same move as handleJobUpdate: the id is a field now. This one took no
// body at all before, so it gains a read it did not have — and readJsonBody
// is memoised on the request, so the door's own peek already paid for it.
function handleCancelJob(req, res) {
  return readJsonBody(req).then((body) => {
    cancelJobById(res, String((body && body.id) || ''));
  }).catch(() => {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid JSON body');
  });
}

function cancelJobById(res, id) {
  const job = jobs.cancelJob(id);
  if (!job) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(job));
}

// The fifth jobs verb, and the one my own route scan missed: it was
// `DELETE /api/jobs/<id>`, matched by a regexp INSIDE a method guard, so
// a scan looking for `pathname === '/api/...'` never saw it. Found by
// grepping the callers instead of the routes — which is the better
// direction, because a route with no caller is dead and a caller with no
// route is broken.
function handleDeleteJob(req, res) {
  return readJsonBody(req).then((body) => {
    deleteJobById(res, String((body && body.id) || ''));
  }).catch(() => {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid JSON body');
  });
}

function deleteJobById(res, id) {
  const deleted = jobs.deleteJob(id);
  if (!deleted) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found, or job is not yet in a terminal state');
    return;
  }
  res.writeHead(204);
  res.end();
}

// ── THE TWO READS, NOW VERBS ─────────────────────────────────────────
//
// Both took their path off a query string and answered GET. Under the
// one door they read it from the body like everything else.
//
// THE GATE IS UNTOUCHED, which is what stage 3 exists to show. Both still
// go through spirit.core.fs, which still asks fileServable — the fold
// moved where the path comes FROM and changed nothing about what may be
// reached with it. serverSurface's encoded-traversal checks are the proof
// and they are not edited.
function handleFsStat(req, res) {
  return readJsonBody(req).then((body) => {
    const stats = spirit.core.fs.statFile(String((body && body.path) || ''));
    if (!stats) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(stats));
  }).catch(() => {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid JSON body');
  });
}

function handleFsAnnotations(req, res) {
  return readJsonBody(req).then((body) => {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(spirit.core.fs.getAnnotations(String((body && body.path) || ''))));
  }).catch(() => {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid JSON body');
  });
}

function writeFsResult(res, result) {
  if (result.ok) {
    res.writeHead(204);
    res.end();
    return;
  }
  if (result.reason === 'forbidden') {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  // Five branches stood here for the two app-building routes until
  // 2026-09-13 (decision 0008). Two of them --
  // 'app-entry-script-protected' and 'app-manifest-protected' -- were
  // ALREADY dead: those checks moved behind fileWritable when it became
  // a shared predicate, and saveFile has answered every refusal with
  // plain 'forbidden' ever since. They were known dead (writableRoots.js
  // says so in a comment) and left anyway, which is how a handler grows
  // branches nothing can reach.
  if (result.reason === 'file-not-found') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Internal error');
}

function handleFsSave(req, res) {
  readJsonBody(req).then((body) => {
    writeFsResult(res, spirit.core.fs.saveFile(body.path, body.content));
  }).catch(() => {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid JSON body');
  });
}

// handleFsSaveAppScript and handleFsSaveAppManifest stood here until
// 2026-09-13. They were four-line wrappers over the kernel functions of
// the same name, kept as their own routes rather than a flag on
// /api/fs/save so THAT route could keep refusing entry scripts and
// manifests unconditionally for every other caller.
//
// With them gone the refusal has no exceptions at all, which is a
// stronger guarantee than the one this comment used to describe.

function handleFsDelete(req, res) {
  readJsonBody(req).then((body) => {
    writeFsResult(res, spirit.core.fs.deleteFile(body.path));
  }).catch(() => {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid JSON body');
  });
}

// Writes into the target file's sidecar 'client' bucket only — see
// spirit.core.fs.annotateFile (kernel.js) for why no bucket argument is
// accepted here even in principle.
function handleFsAnnotate(req, res) {
  readJsonBody(req).then((body) => {
    writeFsResult(res, spirit.core.fs.annotateFile(body.path, body.payload));
  }).catch(() => {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid JSON body');
  });
}

// Small, explicit allowlist of env var NAMES that net.fetch is willing to
// substitute into an outgoing header value, via a ${ENV:NAME} placeholder
// (see substituteEnvPlaceholders, below) — e.g. a caller can send
// {"headers": {"x-api-key": "${ENV:ANTHROPIC_API_KEY}"}} and the real
// secret is filled in here, server-side, right before the outbound fetch,
// so it never has to exist in browser-visible code. This is credential-
// SCOPING infrastructure, not app-specific knowledge — the proxy still
// knows nothing about what any particular API looks like or does; it just
// knows which secrets this one mechanism is allowed to touch at all, so it
// can't be used to leak an unrelated server env var to an arbitrary URL a
// caller names. Add a name here only when something genuinely needs to
// reference it this way.
// Each entry pairs a variable NAME with the destination hosts it may be
// sent to. The name alone was not enough: gating which env var could be
// substituted, without gating where it went, meant any caller could post
// {"url":"https://somewhere-else","headers":{"x-api-key":"${ENV:ANTHROPIC_API_KEY}"}}
// and the server would faithfully hand the real key to a host of the
// caller's choosing. The allow-list stopped an UNRELATED variable reaching
// an arbitrary URL; it did nothing for the one variable it allowed. A
// secret is scoped by name AND by recipient or it isn't scoped.
const PROXY_ENV_SUBSTITUTION_ALLOWLIST = [
  { name: 'ANTHROPIC_API_KEY', hosts: ['api.anthropic.com'] },
];

function substituteEnvPlaceholders(value, targetHost) {
  if (typeof value !== 'string') return value;
  return value.replace(/\$\{ENV:([A-Z0-9_]+)\}/g, (match, varName) => {
    // Not allowlisted, or allowlisted but pointed somewhere it isn't meant
    // to go — leave the literal placeholder either way, and let the target
    // reject the bad auth rather than silently substituting nothing.
    const entry = PROXY_ENV_SUBSTITUTION_ALLOWLIST.find((row) => row.name === varName);
    if (!entry) return match;
    if (entry.hosts.indexOf(targetHost) === -1) return match;
    return process.env[varName] !== undefined ? process.env[varName] : match;
  });
}

// Generic outbound-request proxy — knows nothing about LM Studio, Claude,
// or any other specific service, unlike the two hardcoded handlers this
// originally replaced. A local service (LM Studio's included) sends no
// Access-Control-Allow-Origin header, so a browser fetch() straight to it
// is silently blocked by CORS even though it's reachable (server-to-server
// requests aren't subject to CORS at all). The caller supplies the target
// url/method/headers/body/timeout and owns all response-shape parsing —
// this just forwards and relays back whatever the target actually
// returned, or a synthesized {error} on timeout/unreachable.
function handleGenericProxy(req, res) {
  readJsonBody(req).then((body) => {
    if (!body.url) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'url is required' }));
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), body.timeoutMs || 10000);

    // Whatever host the outbound request will actually reach — the only
    // thing that decides whether a secret is allowed into these headers.
    let targetHost = '';
    try { targetHost = new URL(body.url).hostname.toLowerCase(); }
    catch (err) { /* unparseable — no host matches, so nothing substitutes; fetch fails below on its own */ }

    const fetchOptions = { method: body.method || 'GET', signal: controller.signal };
    const headers = Object.assign({}, body.body !== undefined ? { 'Content-Type': 'application/json' } : {}, body.headers || {});
    Object.keys(headers).forEach((key) => { headers[key] = substituteEnvPlaceholders(headers[key], targetHost); });
    if (Object.keys(headers).length > 0) fetchOptions.headers = headers;
    if (body.body !== undefined) fetchOptions.body = JSON.stringify(body.body);

    fetch(body.url, fetchOptions)
      .then((response) => response.text().then((text) => ({ status: response.status, text })))
      .then(({ status, text }) => {
        clearTimeout(timeoutId);
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(text);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.name === 'AbortError' ? 'proxy request timed out' : 'proxy target unreachable' }));
      });
  }).catch(() => {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid JSON body');
  });
}

// server.listen below has no host argument, so Node binds to all network
// interfaces by default — reachable from other devices on the same LAN, not
// just this machine. That matters once any route makes outbound requests on
// the caller's behalf (the generic proxy, below): without this check,
// another device on the network could use this server to reach whatever it
// can reach. Checked first, before any routing.
function isLoopbackAddress(address) {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

// The loopback check above only proves the TCP connection came from this
// machine — it does NOT prove the request came from this app's own page.
// This check earns its keep against exactly one attack: DNS rebinding,
// where a page at (say) evil.com has that hostname's DNS re-pointed to
// 127.0.0.1 after load, so its own-origin fetch() calls land on this
// server while the browser still treats it as same-origin with evil.com —
// bypassing CORS entirely. That request's Host header still says
// "evil.com:<port>" (the attacker can't also forge it to say "localhost"
// without giving up the same-origin premise the whole trick depends on),
// so this check catches it.
// This is NOT "only our UI can talk to us" in general — a plain cross-
// origin fetch('http://localhost:<port>/...') from any other tab sends a
// correct Host: localhost:<port> and passes this check untouched. What
// stops THAT today is that this server never sends
// Access-Control-Allow-Origin, so the browser's own CORS preflight blocks
// it before the real request is ever sent (verified: OPTIONS here returns
// a plain 405, no CORS grant) — same "you don't run random pages against
// your own node" trust boundary already accepted for /api/jobs's spawn
// capability. If that stronger claim is ever wanted, the next lock is
// validating Origin/Referer, not this Host check.
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

const VALID_HOSTS = ['localhost:' + port, '127.0.0.1:' + port, '[::1]:' + port];
function isValidHost(hostHeader) {
  return !!hostHeader && VALID_HOSTS.indexOf(hostHeader.toLowerCase()) !== -1;
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
  // in the path is a LOCATOR — every one is already public at
  // /api/relay/who, and holding one grants nothing.
  if (method === 'GET' && devicePageKey(pathname)) return true;
  // `who` alone. `/api/relay/status` was beside it until R3 deleted the
  // badge that called it — and with it the last signed GET on this box
  // apart from the stream.
  if (method === 'GET' && pathname === '/api/relay/who') return true;
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

const server = http.createServer((req, res) => {
  // Both halves of this gate are personal-node-only, and both have to be
  // skipped together for a relay — fixing only the Host half would leave
  // every external request dying on the loopback half instead, since
  // remoteAddress is now a real client IP rather than 127.0.0.1. The Host
  // half is equally meaningless there: VALID_HOSTS is built from
  // localhost:<port>, but a deployed relay is reached as
  // foo.herokuapp.com, and the platform assigns the internal port anyway.
  //
  // What stands in for this on a relay is not "nothing": isRelayPublicPath
  // (below) reduces the answerable surface to the relay routes and the
  // brochure, and the relay routes themselves are gated by the allow
  // list and signature checks in relayAuth.js. The brochure does not hide
  // those routes from curl and was never meant to — H/I/E are the gates.
  if (!relayMode && (!isLoopbackAddress(req.socket.remoteAddress) || !isValidHost(req.headers.host))) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden: this server only accepts connections from localhost');
    return;
  }

  // ── TOO BIG IS ANSWERED ONCE, HERE, BEFORE ANY ROUTE ─────────────────
  //
  // One place for every POST, because /claim and /device were as
  // unbounded as /post and none of them should each carry their own
  // opinion about it. Declared size only — the running total is enforced
  // in readJsonBody, which is what catches a chunked body or a client
  // that sends more than it said.
  //
  // It answers before dispatch so the refusal is a clean 413 rather than
  // the `400 Invalid JSON body` every route's catch would otherwise
  // report — which would name the wrong fault, and the wrong fault is
  // what somebody debugs at three in the morning.
  const declaredLength = Number(req.headers['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > limits.BODY_MAX) {
    res.writeHead(413, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Body too large: ' + declaredLength + ' of ' + limits.BODY_MAX);
    return;
  }

  requestCounters.total++;
  requestCounters.byMethod[req.method] = (requestCounters.byMethod[req.method] || 0) + 1;
  res.on('finish', () => {
    const bucket = Math.floor(res.statusCode / 100) + 'xx';
    requestCounters.byStatusClass[bucket] = (requestCounters.byStatusClass[bucket] || 0) + 1;
  });

  // Both of these parse caller-controlled bytes, and both can throw:
  // decodeURIComponent on a malformed escape ('/%zz', '/%'), and the URL
  // constructor on a Host header it can't make an origin out of. An
  // uncaught throw HERE is not a bad response, it's a dead process — the
  // handler runs outside any try, so the exception unwinds straight out of
  // http's 'request' emit and ends Node.
  //
  // That mattered most on a --relay, where this runs BEFORE
  // isRelayPublicPath narrows anything: a single unauthenticated
  // `GET /%zz` from the internet took the public relay down, and
  // systemd's Restart=on-failure just made it a three-second outage per
  // request rather than a permanent one. Answer 400 and stay up.
  let url;
  let pathname;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    pathname = decodeURIComponent(url.pathname);
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad request: malformed request path');
    return;
  }

  if (relayMode && !isRelayPublicPath(req.method, pathname)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  if (req.method === 'GET' && pathname === '/api/relay/who') {
    handleRelayWho(res);
    return;
  }

  // GET /api/relay/inbox AND GET /api/hub/inbox STOOD HERE — the ring's
  // read half on the relay and the node's proxy onto it. Both deleted by
  // R8 on 2026-09-15. A packet arrives on the held stream now
  // (arrivals.js), and what a page missed while it was shut comes off
  // this node's own traffic log rather than off somebody else's box.

  // GET /api/relay/status STOOD HERE and went with the owner badge that
  // was its only caller (R3, 2026-09-15). The owner's report is pushed
  // down the owner's own stream instead — relay.statusToOwner — and
  // "am I the owner here?" is answered off the public census, by key,
  // with no credential at all.

  // One held connection per identity, carrying who is reachable. The
  // signature is a HEADER for the same reason device-pending's is: a
  // query string is written to every access log the request passes, and
  // this one buys a STANDING grant rather than a single read. Same
  // function enforces it, so there is one rule and not two.
  //
  // Headers, heartbeat and teardown are handleSseConnection's, because
  // it is the same protocol and that handler has already paid for its
  // lessons — especially the last one.
  // THE DEVICE PAGE. One file for everybody: the key lives only in the
  // URL, and the page reads it off its own address — nothing is templated
  // and nothing is generated per person.
  //
  // An identity nobody holds is a 404 here rather than a working-looking
  // form that can never succeed. It leaks nothing: /api/relay/who already
  // hands out every key to anyone who asks.
  //
  // RESTORED 2026-09-12. It was deleted by accident in the same commit
  // that removed the poll — the cut ran from the `device-pending` route to
  // the next one and this sat between them, so every keyed device URL
  // 404'd from that moment. Nothing caught it: no suite asks for the page,
  // and relayProbe's surface list does not name it. Andy found it by
  // clicking the link in natterDetails.
  if (relayMode && req.method === 'GET' && devicePageKey(pathname)) {
    if (!relay.deviceIdentityPublic(devicePageKey(pathname))) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('no such identity here');
      return;
    }
    sendFile(res, path.join(ROOT_DIR, 'device.html'));
    return;
  }

  if (relayMode && req.method === 'GET' && pathname === '/api/relay/stream') {
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
      deviceRefusal(res, opened && opened.status);
      return;
    }

    const heartbeat = setInterval(() => {
      try { res.write(':\n\n'); } catch (e) { /* teardown will follow */ }
    }, 20000);

    // Bound to 'error' as well as 'close', and once-guarded, exactly as
    // the jobs stream is. The bug that comment records is worse here: a
    // socket that dies without a clean close would leave a peer reading
    // as PRESENT forever, which is the relay lying — and lying is the
    // one thing this design cannot afford.
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

  // Answers in both modes and needs nothing. `startedAt` rides along
  // because "which commit" and "since when" are the two halves of the
  // same question: a matching commit with an old start time means the
  // code landed and nothing picked it up.
  if (req.method === 'GET' && pathname === '/api/version') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      version: spirit.core.const.VERSION,
      commit: BUILD.commit,
      dirty: BUILD.dirty,
      committedAt: BUILD.at,
      source: BUILD.source,
      // Only ever non-zero on a COPIED tree, and then it is a warning
      // about this very process: files existed that a copy could not
      // carry, so something it needs may simply not be here.
      untracked: BUILD.untracked || 0,
      startedAt: STARTED_AT,
      relay: relayMode,
    }));
    return;
  }

  // SIX GET ROUTES STOOD HERE — status, who, device, handle,
  // unknown-senders, and arrivals. Five are verbs at the one door now
  // (the map is beside the POST block below); arrivals is the one that
  // was deleted rather than moved.
  //
  // GET /api/hub/arrivals was the log as a table, and it had no caller:
  // a page that was closed catches up on the SAME live channel
  // (createArrivals.subscribe hands it the un-taken backlog before
  // anything new), so it was a second door asking a weaker version of an
  // answered question.
  //
  // ONE THING THE ROUTES CARRIED THAT THE VERBS MUST KEEP: the loopback
  // gate at the top of this handler is what let `device.info` answer a
  // door password in the clear. It is not per-route and never was, so
  // the fold did not move it — but a verb is easier to add than a route
  // was, and a verb that answers a secret is still answering it to
  // whatever can reach this port.


  // handleRelaySend AND handleRelayInbox STOOD HERE, the two routes that
  // served the ring. Deleted by R8 on 2026-09-15 along with relay.send
  // and relay.inbox themselves.
  //
  // The rule handleRelayInbox enforced is the one thing worth keeping and
  // it did not belong to the ring: the proof of a GET arrives in a header
  // and nowhere else, because a signature on a query string is already in
  // an access log. It now lives on the only signed GET left — see
  // relay.streamSignatureFrom, and the stream route above that calls it.

  function handleRelayWho(res) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    // The relay names itself here as well as listing its peers: it is a
    // party to conversations (the census reply comes from it), and a
    // party with no key is a party nothing can file (CYCLE-CHAT-5.1).
    // Null on a relay that has not been restarted since it grew one.
    res.end(JSON.stringify({
      peers: relay.who(),
      relayPublicKey: relay.relayPublicKey(),
      // KEY AND LABEL ARE A PAIR (Andy), so the public census carries
      // both. A member reads this to see what the box calls itself
      // rather than only what their own relays.json calls it — the same
      // distinction `publicLabel` draws for a peer.
      relayLabel: relay.relayLabel(),
    }));
  }

  // handleRelayStatus STOOD HERE. It read `name` and `sig` off the query
  // string — the last route on this box that did — and handed back the
  // owner's report. Deleted with the verb (R3).

  if (req.method === 'GET' && pathname === '/api/events') {
    handleSseConnection(req, res);
    return;
  }

  // `GET /api/jobs` STOOD HERE and is `jobs.list` under the one door.
  // A read folding into a POST costs nothing on loopback — there is no
  // cache to honour and no intermediary to be polite to — and it buys
  // the thing the whole fold is for: one place that knows what this node
  // can be asked.

  // `GET /api/fs/stat` and `GET /api/fs/annotations` STOOD HERE, each
  // taking its path from a QUERY STRING. They are `fs.stat` and
  // `fs.annotations` under the one door, and the path is a field — which
  // is the last of the three ways this node used to carry a parameter
  // (path segment, query string, body) collapsing into the one that a
  // type system can see.

  if (req.method === 'GET') {
    const isHomeRequest = pathname === '/' || pathname === '/index.html';
    const relativePath = isHomeRequest ? HOME_PAGE : pathname.replace(/^\/+/, '');
    const filePath = isHomeRequest
      ? path.join(ROOT_DIR, HOME_PAGE)
      : fsPath(ROOT_DIR, pathname);

    if (!filePath) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    // This route is a completely independent path to the filesystem from
    // kernel.js's own loadFile — it's the raw route the browser's
    // synchronous loadFile XHR hits directly. Boot assets bypass the
    // generic gate unconditionally; everything else goes through the same
    // fileServable check loadFile/scanFolder use.
    if (BOOT_ASSETS.indexOf(relativePath) === -1 && !spirit.core.fs.fileServable(relativePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    sendFile(res, filePath);
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

    // ── ALL FOUR POST-PATH DOORS STOOD HERE. ALL FOUR ARE GONE. ──────
    //
    //   Andy: "I am aiming to close all post-path doors on node"
    //   Andy: "all of natter really can and must go through the shell ->
    //   clientLayer -> node -> relay"
    //
    // invite, rename, revoke, remove-peer. Each built one packet body —
    // { invite: {...} }, { rename: {...} }, { revoke: {...} },
    // { removePeer: {...} } — and handed it to router.post. That is what
    // a peerPost IS, so each was a second way of saying a thing the
    // protocol already said, and each had to be written, wired, given
    // deps, and remembered.
    //
    // The browser addresses the relay by KEY through `peer.post` now,
    // like any other peer (app/natterDetails).
    //
    // WHAT THIS MAKES TRUE, and it is the point of the whole exercise:
    // `peer.post` is the only verb on this node that puts anything on
    // the wire, and A NEW RELAY VERB NEEDS NO CHANGE HERE AT ALL. The
    // relay grows a verb in answerSelf, the browser names it, and there
    // is nowhere left for a door to be missing from — which is the gap
    // remove-peer sat in for months and revoke shipped with this
    // morning.
    //
    // What does NOT fold into a post, because 0010 says it cannot:
    // claim, device and the census reads. You cannot post to a relay you
    // have no row on, and you cannot post to an address you are still
    // asking for. They are verbs at the same door now, which is a
    // different thing — the door is one, the plumbing behind it is not.

    // ── THERE IS NO /api/hub/* ANY MORE ──────────────────────────────
    //
    // Every one of them is a verb at the door below, and this is the one
    // place that says where each went, so the next reader of an old app
    // or an old comment can find it:
    //
    //   claim              relay.claim
    //   status             relay.status
    //   who                peer.list
    //   handle             peer.find
    //   contact            peer.acquire
    //   post               peer.post
    //   peer  {action}     contact.block / .unblock / .accept / .label
    //   unknown-senders    contact.senders (GET) / contact.setSenders
    //   device             device.info
    //   rotate-password    device.rotate
    //
    // Two are not on that list because they were deleted rather than
    // moved. `POST /api/hub/send` went on 2026-09-13 and `GET
    // /api/hub/inbox` on 2026-09-15, both with the ring: there is nothing
    // left of it on this node, and an app posts through `peer.post` and
    // receives on the stream.
    //
    // And four were never routes to begin with by the time they mattered
    // — invite, rename, revoke, remove-peer, above.

    // ── THE LOOPBACK CLIENT API — ONE DOOR, VERBS IN THE BODY ────────
    //
    //   Andy: "Do we maximally fold as much as possible into one single
    //   interface (route)?" — agreed, 2026-09-15.
    //
    // The same collapse the relay's post-path doors just had, one layer
    // up and for the same reason: every route below this line reads a
    // JSON body and dispatches on nothing but its own path. A path IS a
    // verb, spelled in a place a type system cannot see.
    //
    // WHAT FOLDS: everything request/response. WHAT DOES NOT, and both
    // are technical rather than taste —
    //
    //   GET /api/events   a long-lived server-push connection. A
    //                     different transport shape, not a different
    //                     verb, and no body can express it.
    //   GET /api/version  must answer a client that knows nothing,
    //                     including one running older code, which is the
    //                     case it exists for.
    //
    // NAMESPACE.VERB, so which side of this node a verb lives on is
    // readable in the verb itself: `fs.*` and `jobs.*` are this machine,
    // `peer.*` reaches the wire. The plumbing behind the door is NOT
    // folded — a local call must never acquire a wire, and a post must
    // never be answered locally (Andy: "folding of the plumbing behind
    // the API is for future consideration").
    //
    // STAGED, smallest first, and no verb is ever reachable two ways: a
    // namespace moves with its callers and its old route is deleted in
    // the same breath. A transition where both work would be a fallback
    // wearing a schedule.
    //
    //   1. net.fetch   (was /api/proxy)
    //   2. jobs.*      (was /api/jobs)
    //   3. fs.*        (was /api/fs/*)
    //   4. device, relay, contact, peer — all of /api/hub/*
    //
    // DONE, 2026-09-15. Twelve routes, seventeen verbs, six namespaces,
    // and nothing on this node answers a path any more except the stream
    // and the version.
    //
    // WHO ANSWERS WHAT IS NOT DECIDED HERE. A table of verb-to-function
    // stood on this spot for an hour and would have grown to nineteen
    // lines whose only content is a fact the answering module already
    // knows — the same thing said twice, kept in step by remembering,
    // which is what the four post-path doors were.
    //
    // Modules CLAIM a namespace instead (js/verbTable.js), at the foot of
    // this file where their dependencies exist. So this dispatch knows
    // how to find an answer and nothing about what the answers are.
    if (pathname === '/api/spirit') {
      // The verb is read off the body without consuming it: each handler
      // still reads the body it was written to read, so a handler moving
      // under this door needs no change of its own.
      peekVerb(req).then(function (verb) {
        const run = loopbackVerbs.handlerFor(verb);
        if (!run) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'no such verb: ' + verb }));
          return;
        }
        run(req, res);
      });
      return;
    }

    // ── STAGES 1 AND 2 STOOD HERE ───────────────────────────────────
    //
    // `POST /api/proxy` is `net.fetch`. `POST /api/jobs`,
    // `POST /api/jobs/<id>` and `POST /api/jobs/<id>/cancel` are
    // `jobs.create`, `jobs.update` and `jobs.cancel`, claimed by the
    // jobs module at the foot of this file.
    //
    // The last two were matched by REGEXPS that had to agree with two
    // routes by hand, and their id was a path segment — which is a
    // parameter a type system cannot see. It is a field now, and that is
    // the half of this stage worth proving before fs and hub, because
    // both of those have parameters too.

    if (pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('POST accepted');
      return;
    }

    res.writeHead(405, { 'Allow': 'POST /' });
    res.end('POST only permitted at /');
    return;
  }

  // `DELETE /api/jobs/<id>` STOOD HERE and is `jobs.delete` under the one
  // door. It was the last method this server answered besides GET and
  // POST, so DELETE goes out of the Allow header with it.

  res.writeHead(405, { 'Allow': 'GET, POST' });
  res.end('Method not allowed');
});

// A personal node binds 127.0.0.1 explicitly: belt-and-suspenders
// alongside the loopback + Host checks above. Without it, Node binds all
// interfaces by default, so a LAN request would still reach
// isLoopbackAddress and get rejected with a 403 — this just makes it fail
// at the TCP level instead, with the same net result. That is the whole
// reason a phone on the same wifi cannot reach :65432, and it stays true.
//
// A --relay process is the one case that genuinely needs to be reachable
// from another machine, so it binds 0.0.0.0 — required by every platform
// that health-checks the port it assigned (Heroku, Fly, a plain VPS).
// Bind loopback there and the health check fails, the dyno is killed, and
// it reads as "SpiritOS is broken" rather than as a bind mistake.
const BIND_HOST = relayMode ? '0.0.0.0' : '127.0.0.1';

// Without the handler below, a failed listen() (most commonly EADDRINUSE — another
// SpiritOS instance, or anything else, already on this port) surfaces as
// a raw unhandled 'error' event and a Node internals stack trace, same
// failure class verifyStartupCwd() above already fails loud and clear
// for instead.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Refusing to start: port ${port} is already in use — probably another SpiritOS instance (or anything else) already listening there.\n\n` +
      `Try a different port:\n` +
      `    node js/server.js --port ${port + 1}`
    );
  } else {
    console.error(`Refusing to start: ${err.message}`);
  }
  process.exit(1);
});

// A SIXTY-SECOND INBOX SWEEP STOOD HERE (packet 7) — the personal node
// pulling its own mail off a relay without being asked, so that per-peer
// counters advanced whether or not a chat window was open. Deleted with
// the ring by R8 on 2026-09-15.
//
// The thing it was protecting is still protected, one layer down and
// without a timer: peerPost calls peerStats.noteIn on arrival, keyed by
// the request hash. Counters now move when a packet actually lands
// rather than when somebody remembers to poll, which is what the sweep
// was approximating. See R11 in
// design/cycles/2026-09-12-transport-below-the-boundary.md.
//
// NOTHING REPLACES IT and nothing should. A node that polls is a node
// asking a relay to have kept something, and a relay keeps nothing
// (decision 0006).

if (!relayMode) {
  // The device window, if it was left open. The flag has always survived
  // a restart in relay-state/device.json; until now nothing read it at
  // startup, so every restart shut the door without saying so — and the
  // owner of that door is routinely nowhere near this machine
  // (design/relay/DEVICE-PANEL.md section 7). A power cut must not cost a
  // flight home.
  //
  // Personal mode only. A --relay has no device of its own to enrol and
  // must never poll anybody.
  // NOTHING TO RESUME. This asked the node to reopen a device window
  // that had been left open across a restart — the window is gone, and
  // an offer now arrives on a stream rather than being waited for.

  // Presence: one held connection to every relay this node holds a ROW
  // on — not only the ones it owns, since B2 gave every identity its own
  // standing on a relay. The connection's existence IS the presence,
  // so there is nothing to announce and nothing to expire.
  //
  // Published as a permanent job, beside fs-watcher and server-stats, so
  // the shell receives it on the channel it already has. Personal mode
  // only: a relay serves this wire, it does not hold one.
  // ONE router per node, shared. An outbound request and the answer that
  // matches it must meet in the same table, so the thing that posts and
  // the thing that hears the reply are the same object — presence owns
  // the socket, this owns the correlation.
  // THIS NODE'S OWN RECORD OF WHAT CROSSED THE WAN. Decision 0006 takes
  // the relay out of the business of remembering anything, and this is
  // what is left when it does — a refusal nobody wrote down cannot be
  // told apart from nothing having been tried.
  //
  // Built HERE rather than inside peerPost so the gate is visible at the
  // one place that knows which kind of process this is. The block it
  // sits in is already personal-mode only; `relayMode` is passed anyway,
  // because the file it writes would hold everybody's messages on a
  // relay — not metadata, the content — and that is the worst thing in
  // the system, not a softer version of the ring 0006 deletes. A guard
  // that only holds while the surrounding code stays where it is, is not
  // a guard.
  // WHAT THIS NODE ANSWERS WHEN ITS RELAY ASKS.
  //
  // Almost everything on that stream is a peer's request and gets the
  // plain receipt. The exception is a device enrolment, which the relay
  // posts as itself because the browser doing the enrolling has no
  // identity yet — and answerRelay is where that is checked against the
  // key of the relay it arrived on before anything is acted on.
  //
  // `urls` is a function because which relays this node holds a row on
  // is presence's answer and changes while the process runs — and
  // because presence does not exist yet on this line.
  const answerer = require('./answerRelay').createAnswerer({
    rootDir: ROOT_DIR,
    request: require('./hub').relayRequest,
    urls: function () {
      const me = require('./relayAuth').loadIdentity(ROOT_DIR);
      if (!me || !me.publicKey || !presence) return [];
      return presence.relaysNaming(me.publicKey);
    },
  });

  peerRouter = require('./peerPost').createPeerPost({
    rootDir: ROOT_DIR,
    request: require('./hub').relayRequest,
    answer: answerer.answer,
    // WHO THIS NODE WILL HEAR FROM. The same question listenSet has
    // always answered for the `inbox` read, asked on the path packets
    // actually arrive on — which until now asked nobody.
    //
    // Read per request rather than captured: the address book changes
    // while the process runs, and a node that acquired somebody an hour
    // ago must hear them now.
    admit: function (from) {
      return require('./hub').frontDoor(ROOT_DIR, from);
    },
    // And what to write down about a stranger who got through the floor.
    // Separate from the judgement on purpose: the verdict is decided
    // before the budget is checked, the row is written after.
    remember: function (from, verdict, relayUrl) {
      return require('./hub').remember(ROOT_DIR, from, verdict, relayUrl);
    },
    // AND WHERE AN ADMITTED PACKET GOES. The hook has existed since the
    // router landed and had no caller but a test, so until 2026-09-13 a
    // peer's packet was admitted, logged, receipted and dropped — which
    // is the whole reason chat still polled a ring. See arrivals.js,
    // including what it deliberately does NOT do about a packet that
    // arrives while no browser is open.
    onArrival: arrivals.note,
    traffic: trafficLog,
    // The peer's own numbers, on the transport that did not move them.
    // countInbound did it on the `inbox` path and nothing did it here, so
    // a node fully on the router would have stopped counting silently.
    stats: require('./peerStats'),
  });

  presence = require('./presenceNode').createPresence({
    rootDir: ROOT_DIR,
    jobs: jobs,
    router: peerRouter,
    // Straight onto the page's stream. presenceNode receives it, this
    // hands it to whoever has a panel open.
    onRelayEvent: relayEvents.note,
    // AND THE MEMBERSHIP HALF, WHICH IS KEPT (R2).
    //
    //   Andy: "There is a category of events on the relay that the owner
    //   should have a log of... They should go to the log."
    //
    // Two things happen and the order is the point: it is WRITTEN first
    // and shown second. `relayEvents.note` above only fans out to open
    // tabs, which is right for traffic and wrong for this — an owner is
    // usually not watching when somebody claims a slot, and a record
    // that depended on a tab being open would be the same nothing this
    // replaces.
    //
    // `dir: 'in'` because it crossed the WAN inward, on the stream this
    // node holds to a relay it owns.
    onOwnerEvent: function (ev) {
      try {
        trafficLog.note({
          dir: 'in',
          kind: 'owner',
          event: ev && ev.kind,
          // WHICH POST CAUSED IT, where one did. This is what joins the
          // request and reply rows this node already wrote to the event
          // the relay pushed back about them — see relay.ownerEvent.
          cause: ev && ev.cause,
          peer: (ev && ev.key) || '',
          relay: (ev && ev.relay) || '',
          label: ev && ev.label,
          invite: ev && ev.invite,
          why: ev && ev.why,
          owner: ev && ev.owner,
          revoked: ev && ev.revoked,
          invitesRevoked: ev && ev.invitesRevoked,
          expiresAt: ev && ev.expiresAt,
        });
      } catch (e) { /* a witness must not break the stream it watches */ }
      return relayEvents.note(ev);
    },
    // WHO EACH RELAY IS, pinned as its stream opens. relayKey fetches the
    // census, accepts a key never seen before, and refuses one that
    // changed — so by the time any enrolment can be posted down that
    // stream, hub.frontDoor already knows whether to admit the relay as a
    // party.
    //
    // Pinning used to happen lazily inside answerRelay, on the first
    // enrolment, and deadlocked: the door refused the offer because
    // nothing was pinned, so the pinner never ran.
    pinRelay: answerer.relayKey,
  });
  // The same function, reachable from a request. See the declaration for
  // why a const inside this block was not enough.
  pinnedRelayKey = answerer.relayKey;
  presence.start(require('./hub').relayRequest).catch(() => {});

  // ── THE CLAIMS, WHERE THE DEPENDENCIES ARE ─────────────────────────
  //
  //   Andy: "registration after boot. it avoids dependency messes."
  //
  // Everything a verb needs is built above this line — peerRouter,
  // presence, the pinned relay key — so a module can close over what it
  // uses instead of being handed deps at every call, and nothing has to
  // be declared before the thing it depends on exists. That is the
  // failure this file already carries a comment about: a const inside
  // this block, read from a request handler that runs long afterwards.
  //
  // ONE LINE PER MODULE, not one per verb. A verb added later touches
  // the file that answers it and nothing here.
  //
  // Inside the personal-node branch on purpose: a relay claims nothing,
  // because a relay does not serve this door.
  loopbackVerbs.claim('net', 'server.js', {
    'net.fetch': handleGenericProxy,
    // WIRE: it reaches the internet, so being offline fails it.
  }, { wire: true });

  loopbackVerbs.claim('jobs', 'server.js', {
    'jobs.list': function (rq, rs) {
      rs.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      rs.end(JSON.stringify(jobs.listJobs()));
    },
    'jobs.create': handleCreateJob,
    'jobs.update': handleJobUpdate,
    'jobs.cancel': handleCancelJob,
    'jobs.delete': handleDeleteJob,
    // LOCAL: a job is this machine's, whether or not anything is reachable.
  }, { wire: false });

  // THE GATE IS NOT IN HERE, and that is the point of this namespace.
  // Every one of these goes through spirit.core.fs, which asks
  // fileWritable or fileServable about the path — so folding the route
  // moved where a path COMES FROM and changed nothing about what may be
  // reached with it. serverSurface's traversal checks are untouched and
  // still red-green the same way.
  loopbackVerbs.claim('fs', 'server.js', {
    'fs.stat': handleFsStat,
    'fs.annotations': handleFsAnnotations,
    'fs.save': handleFsSave,
    'fs.delete': handleFsDelete,
    'fs.annotate': handleFsAnnotate,
    // LOCAL: this node's own disk.
  }, { wire: false });

  // ── STAGE 4a — device (2026-09-15) ─────────────────────────────────
  //
  // LOCAL, and I had this wrong once. I called `device` two-party because
  // the password exists so a phone can attach — but the second party
  // never touches THIS call: they hit /api/relay/device on the relay.
  // The purpose is two-party; the operation reads a file on this box.
  // The namespace follows the operation, because what a caller needs to
  // know is whether being offline can fail it.
  //
  // `device.rotate` has no caller, and that is NOT the remove-peer gap
  // wearing another hat:
  //
  //   Andy: "rotate-password is standing in line with device support
  //   with a js-support framework."
  //
  // It is waiting for named work, not forgotten by accident. Worth the
  // distinction — a verb nobody remembered and a verb ahead of its own
  // UI look identical from a grep, and only one of them is a defect.
  loopbackVerbs.claim('device', 'hub.js', {
    'device.info': function (rq, rs) { hub.handleDevice(rq, rs); },
    'device.rotate': function (rq, rs) { hub.handleRotatePassword(rq, rs, readJsonBody); },
  }, { wire: false });

  // ── STAGE 4b — relay (2026-09-15) ──────────────────────────────────
  //
  // THE NODE'S RELATIONSHIP WITH A RELAY, which is a different subject
  // from what it says to a peer THROUGH one. `relay.claim` asks a relay
  // for a row; `relay.status` asks every configured relay what it thinks
  // of this node's key. Neither is addressed to a person, which is what
  // keeps them out of `peer.*` and `contact.*`.
  //
  // WIRE, both of them, and uniformly — which is not an accident of who
  // happened to land in the same group. `relay.claim` obviously reaches
  // out. `relay.status` is less obvious and matters more: it LOOKS like
  // a read of local configuration, and it is not. ownerBadge.probe
  // fetches /api/relay/who from every configured relay, so an offline
  // box answers 502 and a caller that assumed otherwise draws an empty
  // relay list and calls it the truth. That is exactly the confusion the
  // wire flag exists to make impossible to arrive at by accident.
  //
  // What a relay verb is NOT: a way to talk to the relay's owner. That
  // goes through peer.post like anybody else's — the relay names itself
  // on its own roster precisely so it has an ordinary address.
  loopbackVerbs.claim('relay', 'hub.js', {
    'relay.claim': function (rq, rs) { hub.handleClaim(rq, rs, readJsonBody); },
    // Eligibility, read-only: does this peer own the relay at that url?
    // Answered off a PUBLIC census, so it grants nothing — the promotion
    // itself is an owner verb posted to the relay like any other.
    'relay.partnerCheck': function (rq, rs) { hub.handlePartnerCheck(rq, rs, readJsonBody); },
    'relay.status': function (rq, rs) {
      hub.handleStatus(rq, rs, readJsonBody, { presence: presence });
    },
  }, { wire: true });

  // ── STAGE 4c — contact (2026-09-15) ────────────────────────────────
  //
  //   Andy: "The user sees it as contact: which is kind of what i
  //   prefer."
  //
  // THIS NODE'S OWN ADDRESS BOOK, and nothing else. Every verb here is
  // a whoBook write or a preferences read on this machine, so the group
  // is uniformly local — which is what lets the census reads live
  // somewhere else even though a person would call them contact work
  // too. `peer.list` and `peer.find` ask a RELAY who is out there;
  // `contact.*` is what this node has decided to keep.
  //
  // FOUR VERBS WHERE THERE WAS ONE ROUTE AND AN `action` FIELD. That
  // field was a verb inside a body, under a route that was also a verb,
  // and hub.js dispatched it by hand beside a dispatch the door already
  // does. The if-chain is gone: an unknown verb is now refused by a
  // table that knows every verb this node answers.
  loopbackVerbs.claim('contact', 'hub.js', {
    'contact.block': function (rq, rs) { hub.handlePeer(rq, rs, readJsonBody, 'block'); },
    'contact.unblock': function (rq, rs) { hub.handlePeer(rq, rs, readJsonBody, 'unblock'); },
    'contact.accept': function (rq, rs) { hub.handlePeer(rq, rs, readJsonBody, 'accept'); },
    'contact.label': function (rq, rs) { hub.handlePeer(rq, rs, readJsonBody, 'label'); },
    // Read and write, told apart by name rather than by an HTTP method
    // that no longer varies. See handleSendersRead.
    'contact.senders': function (rq, rs) { hub.handleSendersRead(rq, rs); },
    'contact.setSenders': function (rq, rs) { hub.handleUnknownSenders(rq, rs, readJsonBody); },
  }, { wire: false });

  // ── STAGE 4d — peer (2026-09-15), and the fold is done ─────────────
  //
  // ANYBODY WHO IS NOT THIS NODE. Uniformly wire, and every one of these
  // fails the same way when the box is offline — which is the whole
  // reason the flag is on the namespace.
  //
  //   peer.post     the only thing on this node that reaches router.post
  //   peer.list     the relay's census, captioned by this node's book
  //   peer.find     the keys behind one spoken handle
  //   peer.acquire  a human confirmed one of those keys
  //
  // WHY THESE ARE NOT `contact.*` even though a person doing them is
  // doing contact work: `contact.*` edits the book on this disk and
  // cannot be unreachable. These three ask a RELAY. Grouping by what the
  // user calls it would have put a 502 and a file write in one namespace
  // and made the wire flag a lie for half of it.
  //
  // `peer.acquire` is the seam between the two: it asks the relay whether
  // that key is really there, and only then writes a row. It is wire
  // because the asking can fail, and the write never happens when it
  // does.
  //
  // peerRouter and presence are handed in rather than reached for: they
  // are built at the foot of this file and hub.js must not hold state it
  // cannot see created. That is not pedantry — /api/hub/invite was given
  // a name out of scope on 2026-09-13 and the first real mint killed the
  // node with every suite green.
  loopbackVerbs.claim('peer', 'hub.js', {
    'peer.post': function (rq, rs) {
      hub.handlePost(rq, rs, readJsonBody, { router: peerRouter, presence: presence });
    },
    'peer.list': function (rq, rs) { hub.handleWho(rq, rs); },
    'peer.find': function (rq, rs) { hub.handleHandle(rq, rs, readJsonBody); },
    'peer.acquire': function (rq, rs) { hub.handleContact(rq, rs, readJsonBody); },
  }, { wire: true });
}

server.listen(port, BIND_HOST, () => {
  if (relayMode) {
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
    //
    // R9 pushed a status report every ten seconds for ever, watched or
    // not, so a relay with nobody looking at it spent cycles on telemetry
    // for an empty room. A box that must survive and earn its keep (0007)
    // has no business doing that, and the monitor verbs make it
    // indefensible rather than merely wasteful.
    //
    // What replaced it: the owner POSTS to the relay — it is an
    // addressable peer for them and nobody else — and the relay answers
    // by hash on their own stream. The panel asks when it opens and again
    // when it closes, and the whole thing dies on its own if that stream
    // drops. A relay nobody is watching now does exactly nothing about
    // being watched, and there is no verb here for it to do it with.
  } else {
    console.log(`Server listening on http://localhost:${port}`);
  }
});
