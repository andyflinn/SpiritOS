// ── A RELAY IS NOT BOOTED HERE ANY MORE ──────────────────────────────
//
// Cycle 0 (design/principles/NODE-AND-RELAY.md, decided by Andy
// 2026-09-19): node and relay are separate startup modules, so a relay
// loads no node code. This file is the personal node. `--relay` is
// handed to js/relayServer.js BEFORE anything below is required — that is
// the whole point, since a require here is a module the relay would carry.
//
// Kept, not removed, because spirit-3's systemd unit starts
// `node js/server.js --relay`. Changing that is a deploy decision (Andy's),
// not part of the split. (The Procfile and install-public-relay.js did too,
// until both went in cycle 3.)
if (process.argv.slice(2).includes('--relay')) {
  require('./relayServer');
  return;
}

const http = require('http');
const fs = require('fs');
const path = require('path');
const spirit = require('./kernel');
// The helpers this node shares with the relay's startup module — body
// reading, file sending, the 413 and malformed-path guards, /api/version.
const common = require('./serveCommon');
// What this node answers about itself, and the one thing it writes there
// unasked — see the boot call in the personal-node block.
const nodeCard = require('./nodeCard');
// The address book, for one narrow purpose here: stashing a route a relay
// has PROVEN onto a contact row that already exists. Everything else that
// touches the book goes through hub; this does not, because it is a
// stream event with no request behind it and no response to build.
const contactBook = require('./contacts');
// The keys this node has accepted for the relays it uses. Turning the URL
// a packet arrived on into the relay KEY a route is made of.
const relayKeys = require('./relayKeys');
// Where this node keeps its mail. Required here for one call at boot:
// a node with no relays.json is given one.
const ownerBadge = require('./ownerBadge');
// Resolved ONCE, here, as the process loads — see buildStamp.js. Asking
// again later would report whatever is on disk now, which is the lie
// this is meant to catch.
const buildStamp = require('./buildStamp');
const BUILD = buildStamp.resolve(spirit.core.node.const.ROOT_DIR);
const STARTED_AT = new Date().toISOString();

//console.log(JSON.stringify(spirit,null,2));

// Checked before verifyStartupCwd below, on purpose — --help should work
// regardless of which directory this was launched from, not get refused
// alongside every other startup mistake.
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(
    'Usage: node js/server.js [--port <number>]\n\n' +
    '  Runs a personal node: loopback HTTP only. A public relay is\n' +
    '  js/relayServer.js (`node js/server.js --relay` still starts one).\n\n' +
    '  --port <number>   Listen on this port instead of the default (' + spirit.core.node.const.DEFAULT_SPIRIT_PORT + ').\n' +
    '                    Same effect as the PORT environment variable; --port wins if both are given.\n' +
    '  --help, -h        Show this message and exit.\n\n' +
    'Examples:\n' +
    '  node js/server.js\n' +
    '  node js/server.js --port 65431\n' +
    '  PORT=65431 node js/server.js\n\n' +
    'Must be run from spirit/run/ (this directory\'s parent must be named "spirit") — see the startup check in serveCommon.js if that fails.'
  );
  process.exit(0);
}

common.verifyStartupCwd('js/server.js');

const ROOT_DIR = spirit.core.node.const.ROOT_DIR;

const hub = require('./hub').createHub(ROOT_DIR);

const port = common.portFromArgs(process.argv.slice(2)) || process.env.PORT || spirit.core.node.const.DEFAULT_SPIRIT_PORT;

// The desktop shell. A relay's brochure (relay.html) is served by
// relayServer.js; this node serves it only by its literal path, as a
// boot asset.
const HOME_PAGE = 'index.html';

// THE LOG, read as a table. One store for both directions, keyed by hash
// and ordered by arrival — and the thing the arrivals seam hands rows to,
// so a page that was closed can catch up from the same place a live page
// is fed from.
//
// `relayMode: false` always, now: a relay no longer loads this module at
// all (cycle 0), which turns trafficLog's own relay gate from a runtime
// promise into an absence.
const trafficLog = require('./trafficLog').createTrafficLog({
  rootDir: spirit.core.node.const.ROOT_DIR,
  relayMode: false,
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


// A relay's own identity is made in relayServer.js. A personal node's
// identity is made on its first claim (hub.js).

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
// has something to close.
let presence = null;
let peerRouter = null;

// ── WHAT THE LOOPBACK CLIENT DOOR CAN BE ASKED ───────────────────────
//
// Declared here, filled at the foot of this file. Modules claim their
// own namespace where their dependencies exist — see js/verbTable.js for
// why claiming beats a table, and why it happens after boot rather than
// on require.
//
// A relay has no such door and does not load this module (relayServer.js).
const loopbackVerbs = require('./verbTable').createVerbTable();
// `pinnedRelayKey` STOOD HERE, DELETED 2026-09-17 — assigned at boot and
// read by nothing.
//
// It was hoisted out of the boot block because a REQUEST needed it:
// /api/hub/invite had started posting to the relay instead of calling a
// route on it, and a route handler runs long after the block declaring a
// const inside it has finished. The failure was a ReferenceError that
// killed the process on the first mint.
//
// That route is gone (there is no /api/hub/* any more — see the verb
// table below), and the fix outlived the caller. The lesson did not:
// `peerRouter` is still hoisted for exactly this reason.

const requestCounters = { total: 0, byMethod: {}, byStatusClass: {} };
jobs.startStatsJob({ requestCounters: requestCounters });

// Moved to serveCommon.js (cycle 0) — the relay answers HTTP the same way,
// and these carry the lessons both sides paid for: the body cap, the
// once-read memo, the 404 on a missing file.
const sendFile = common.sendFile;
const readJsonBody = common.readJsonBody;

const fsPath = spirit.core.node.util.fsPath;

// Which verb this is, for the one door that has to know before it can
// choose. A body that will not parse is not a verb — the handler that
// would have been chosen is the one that reports that, so this answers
// empty and lets the dispatch below say "no such verb".
function peekVerb(req) {
  return readJsonBody(req)
    .then(function (body) { return String((body && body.verb) || ''); })
    .catch(function () { return ''; });
}

// clientKeyFor, deviceRefusal, handleDeviceOffer and handleRelayClaim
// STOOD HERE. They answer the relay routes, which a node no longer serves
// (cycle 0, Andy 2026-09-19): they live in relayServer.js and serveCommon.js.

// EVERY PAGE STREAM THIS PROCESS IS SERVING.
//
//   Andy: "node and relay must have these safeguards, from the same code?"
//
// A relay's listeners live in a presence registry, keyed by identity and
// rate limited. A node's listener is its own browser, which has no identity
// and needs none — so it is a plain Set, and the only thing the two books
// share is what gets SAID to them on the way out (presence.sayGoingAway).
//
// Existing only so the shutdown handler has somebody to tell. Nothing else
// reads it, and a stream removes itself in teardown below.
const pageStreams = new Set();

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

  pageStreams.add(res);

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
    pageStreams.delete(res);
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
const VALID_HOSTS = ['localhost:' + port, '127.0.0.1:' + port, '[::1]:' + port];
function isValidHost(hostHeader) {
  return !!hostHeader && VALID_HOSTS.indexOf(hostHeader.toLowerCase()) !== -1;
}

const server = http.createServer((req, res) => {
  // Both halves of this gate are what make this a PERSONAL node: the
  // connection must come from this machine, and name it. A relay has no
  // such gate and is a different startup module (relayServer.js, cycle 0).
  if (!isLoopbackAddress(req.socket.remoteAddress) || !isValidHost(req.headers.host)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden: this server only accepts connections from localhost');
    return;
  }

  // Too big is answered once, before any route — see serveCommon.js.
  if (common.refuseTooBig(req, res)) return;

  requestCounters.total++;
  requestCounters.byMethod[req.method] = (requestCounters.byMethod[req.method] || 0) + 1;
  res.on('finish', () => {
    const bucket = Math.floor(res.statusCode / 100) + 'xx';
    requestCounters.byStatusClass[bucket] = (requestCounters.byStatusClass[bucket] || 0) + 1;
  });

  // A malformed path is a 400, never a dead process — see serveCommon.js.
  const parsed = common.parseRequestPath(req, res);
  if (!parsed) return;
  const pathname = parsed.pathname;

  // THE RELAY ROUTES STOOD HERE — /api/relay/key, the device page and
  // /api/relay/stream, with the census and ring tombstones beside them.
  // A node no longer answers any relay route (cycle 0, Andy 2026-09-19);
  // they are relayServer.js.

  if (req.method === 'GET' && pathname === '/api/version') {
    common.sendVersion(res, BUILD, STARTED_AT, false);
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

  // expandKeys STOOD HERE. It turned `?key=a&key=b` or `?key=a,b` into a
  // list for the census's narrow form, and normalised the device page's
  // url-safe spelling through deviceAuth.keyFromUrl so a page holding one
  // could ask about itself without converting it back.
  //
  // Both callers are gone: the device page asks the relay nothing, and the
  // census route it served was deleted the same day. Narrowing was the
  // intermediate strategy and it is not the one that finished the job —
  // "a narrower cheat is a defended one" (0012).

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
    

    // POST /api/relay/claim, /post, /reply AND /device STOOD HERE,
    // answered on loopback by a node that was never a relay. Removed by
    // cycle 0 (Andy, 2026-09-19): relay routes live only in relayServer.js.

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
// (A relay binds 0.0.0.0, in relayServer.js.)
const BIND_HOST = '127.0.0.1';

// A failed listen() — most commonly EADDRINUSE — answered loud and clear,
// not as a Node internals stack trace. See serveCommon.js.
common.refuseListenError(server, port, 'js/server.js');

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

// ── THE NODE'S MACHINE STATE IS ON DISC, OR THERE IS NO NODE (R26) ──
//
//   Andy: "we need no peer review for allowing a database to be used for
//   the shadow roll. That's a decision."
//
// The shadow roll lives in relay-state/node.db through node:sqlite
// (nodeStore.js), and there is no in-memory copy to fall back on — a
// second implementation would be a code path the product never runs and
// every suite would silently test instead.
//
// SO THE FLOOR MOVES, AND IT IS SAID HERE RATHER THAN DISCOVERED. Until
// now only a RELAY needed 22.13; this makes it every user's minimum, on a
// machine they own and install themselves. That follows from the grant
// above rather than being a second ruling (0018), and package.json says
// the same number.
//
// Refused at boot, the way relayServer.js refuses, so a node too old says
// so now instead of on the first search.
const nodeStore = require('./nodeStore');
if (!nodeStore.available()) {
  console.error('node:sqlite is not available in Node ' + process.version +
    ' — a node needs 22.13 or later (nodeStore.js)');
  process.exit(1);
}
try { nodeStore.open(ROOT_DIR); }
catch (e) {
  console.error('the node store could not be opened: ' + String(e && e.message || e));
  process.exit(1);
}

// THE OWNER'S SETTINGS, read once at startup and said out loud when they
// were not usable (R31). A number the owner typed that the node quietly
// ignored would be worse than no setting at all — so a bad value boots
// on the default and SAYS so, rather than refusing to start over a cache
// size.
(function () {
  const settings = require('./nodeSettings').load(ROOT_DIR);
  settings.problems.forEach(function (why) { console.warn('relay-state/node.json: ' + why); });
}());

// ── THE ROUTES A CONTACT ROW STILL HOLDS, MOVED ONCE (cycle R1) ──────
//
//   Andy: "the hints are removed from the users contacts."
//
// `routes` left the contact row with 0018, and a node that ran before
// today has them sitting in contacts.json. Dropping them silently would
// throw away the only routes such a node has for its foreign contacts —
// exactly what 0018 said to wait for the store to avoid.
//
// AT HEARSAY, because nothing in the book recorded who said them. Any
// better-sourced route outranks them the moment one arrives, which is the
// honest standing for a claim with no provenance.
//
// IDEMPOTENT, so it needs no "have I done this" flag: a note is a merge,
// and once `upsert` stops carrying `routes` the rows fall away on their
// own. Silent, because a node with none — every node made from today —
// should not be told about a migration that did nothing.
try {
  const held = contactBook.everyRouteHeld(ROOT_DIR);
  if (held.length) {
    const shadow = require('./hub').shadow(ROOT_DIR);
    const seenPeersRanks = require('./seenPeers');
    held.forEach(function (r) {
      try { shadow.note(r.publicKey, { at: r.at, rank: seenPeersRanks.HEARSAY }); }
      catch (e) { /* one row that will not take is not a reason to stop */ }
    });
  }
} catch (e) { /* a book that cannot be read is not a reason to refuse to boot */ }

// ── THE BOOK'S MARKS, ONCE AT BOOT (0021) ─────────────────────────────
//
// Every save marks the memory, but a book written before marks existed —
// or edited by hand while the node was down — has not been saved since.
// One pass, so a node's added people are protected from its first sweep.
contactBook.syncMarks(ROOT_DIR);

// THE PERSONAL NODE'S BOOT. It read `if (!relayMode)` until cycle 0; a
// relay is booted by relayServer.js now, so this block always runs.
{
  // ── A NODE THAT HAS NEVER BEEN DESCRIBED DESCRIBES ITSELF ──────────
  //
  //   Andy: "lots of empty node-descriptions right now ... on boot: the
  //   node should fill the description 'this node described for the first
  //   time [date / time string].' this gives likely different strings by
  //   default."
  //
  // WHAT IS BEING FIXED IS SAMENESS. A card that says nothing is honest
  // and useless: a list of strangers reading the same blank is the list
  // key endings existed to make readable, and this field was built to
  // take that job over. A timestamp describes nothing — it is simply
  // DIFFERENT from the next node's, which is the whole property asked
  // for, and it is something a person will then want to replace.
  //
  // FIRST THING, before any relay is dialled: the first thing that can
  // ask for this card is a peer on the far end of a stream opened a few
  // lines below, and a node that answered blank once has already made the
  // impression this exists to prevent.
  //
  // Personal mode only, which is what this block is. A relay's
  // identity.json holds its public label and it answers `answerSelf`; it
  // has no card and must not grow one by accident.
  try { nodeCard.ensureDescription(ROOT_DIR); }
  catch (e) { /* a caption must never be the reason a node will not boot */ }

  // ── AND A NODE WITH NO RELAY LIST GETS ONE ─────────────────────────
  //
  //   Andy: "for node boot. if relays.json doesn't exist, initialize with
  //   spirit.andyflinn.com only (where we auto-initialize description as
  //   well)."
  //
  // Beside the description, and for the same reason: both are things a
  // fresh node needs before anybody looks at it, and neither is something
  // a person should have to supply before the box is useful. Both write
  // into a GAP and never over an answer.
  //
  // This one replaces a list that used to ship in git — see
  // ownerBadge.ensureRelays for why a file the node writes and a file git
  // carries are different things, and why untracking it is what made this
  // necessary.
  //
  // BEFORE PRESENCE, which is the reason it is here and not later: the
  // relay list is what presenceNode dials, a few lines below.
  try { ownerBadge.ensureRelays(ROOT_DIR); }
  catch (e) { /* nor a relay list */ }

  // THE BOOT-TIME ROSTER SWEEP STOOD HERE (hub.syncMembers). It read every
  // owned relay's census roster, which no relay may return any more; see
  // the note where reconcileMembers stood in hub.js. A new member becomes a
  // contact on the claim event instead — onOwnerEvent, below.

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
  // sits in is personal-mode only, because the file it writes would hold
  // everybody's messages on a relay — not metadata, the content — and that
  // is the worst thing in the system, not a softer version of the ring
  // 0006 deletes. A guard that only holds while the surrounding code stays
  // where it is, is not a guard: which is why, since cycle 0, a relay is a
  // different startup module that never loads trafficLog.js at all.
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
    // THE QUEUE OUTLIVES THE PROCESS (cycle R16). Only here: the relay's
    // own peerPost (relayServer.js) is built without a store, because a
    // relay has no node.db and keeps nobody's intentions.
    store: nodeStore.open(ROOT_DIR),
    // A node cannot know whether a packet will be tunnelled, so it refuses
    // at compose one that would not fit once wrapped (cycle 2, SURFACE §8).
    checkTunnel: true,
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
    // EVERY ARRIVAL IS A ROUTE, whatever the door decides about it. The
    // URL is turned into a relay KEY here, because that is what a route
    // is made of and this is the half that knows which keys this node has
    // pinned.
    noteSeen: function (from, relayUrl) {
      var at = relayUrl ? relayKeys.pinned(ROOT_DIR, relayUrl) : '';
      if (!at && !relayUrl) return;
      // RANK ARRIVED: a packet demonstrably came from there, which proves
      // the road and says nothing about the name.
      require('./hub').shadow(ROOT_DIR).note(from, {
        at: at || '', url: relayUrl || '',
        via: relayKeys.pinned(ROOT_DIR, relayUrl || '') || '',
        rank: require('./seenPeers').ARRIVED,
      });
    },
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
    // The node filters what the relay broadcasts (cycle 3): only its own
    // contacts are kept on its presence picture.
    knows: function (key) { return !!contactBook.byPublicKey(ROOT_DIR, key); },
    // AND WHAT THE FILTER ABOVE USED TO DESTROY (cycle R27). The module's
    // cache, not this hub instance's — one node, one answer to "where have
    // I lately been told somebody lives", the same reason onRoute below
    // takes it from the module.
    // RANK HOST, and presence with it. A relay saying a key is present is
    // that relay speaking about ITS OWN MEMBER — the highest standing
    // there is, for the name and for the route both (cycle R29).
    noteSeen: function (key, what) {
      require('./hub').shadow(ROOT_DIR).note(key, Object.assign({
        via: relayKeys.pinned(ROOT_DIR, (what && what.url) || '') || '',
        rank: require('./seenPeers').HOST,
      }, what || {}));
    },
    rootDir: ROOT_DIR,
    jobs: jobs,
    router: peerRouter,
    // Straight onto the page's stream. presenceNode receives it, this
    // hands it to whoever has a panel open.
    //
    // ── AND A CLAIM ON MY OWN RELAY MAKES A CONTACT ─────────────────
    //
    //   Andy: "when someone binds to a peer i own, it's because i want
    //   them in my network, so i want a contact auto-generated."
    //
    // The fast path. Somebody claiming a seat is news the relay already
    // pushes to its owner (relay.js, ownerEvent('claim')) and nothing
    // was done with it but draw a line on a panel.
    //
    // A FULL RECONCILE RATHER THAN AN ACQUIRE OF THAT ONE KEY, and the
    // extra probe is worth it: the event says a key claimed, it does not
    // say on which of this node's relays, and a reconcile answers that
    // from the census — the same authority that runs at boot. One
    // mechanism, exercised twice, rather than two that can disagree.
    //
    // Nothing waits on it and a failure is silent: this is a convenience
    // on top of the sweep, never the only way a member is noticed.
    onRelayEvent: function (ev) {
      relayEvents.note(ev);
      // A `kind: 'claim'` branch stood here and never fired: claims arrive
      // as `owner-event` (onOwnerEvent, below), not `relay-event`, since
      // R2 split the two. Adoption lives there now.
    },
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
    // -- A PROVEN ROUTE, STASHED AND NOT LOGGED ----------------------
    //
    //   Andy: "streamed routes should be exempt from the log, they just
    //   miraculously get stashed on the correct contact-row."
    //
    // NOT CORRESPONDENCE. trafficLog is what this node sent and what it
    // received; nobody addressed this to us. Presence is handled the same
    // way and writes nothing either. And the log is permanent, so route
    // chatter would grow a file that never shrinks with infrastructure
    // nobody will read — and would leave, on every member's disk, a lasting
    // record of what a relay's members have been looking up.
    //
    // A RELAY MAY IMPROVE WHAT THIS NODE KNOWS ABOUT ITS OWN CONTACTS
    // AND MAY NEVER ADD TO THEM. `learnRoute` enforced that until
    // 2026-09-21; routes left the book with 0018, so the route half is
    // structural now and only the label below still needs the rule.
    onRoute: function (url, body) {
      if (!body || !body.key || !body.at) return;
      // KEPT EVEN WHEN IT IS ABOUT A STRANGER.
      //
      //   Andy: "the node must implicitly learn routes at EVERY
      //   opportunity."
      //
      // The book never gained a row from a relay, which is right — a
      // relay must not be able to write into somebody's address book. But
      // that made a route about anybody not already held simply vanish,
      // and a relay now announces to BOTH ends of an exchange
      // (relay.js, 2026-09-21), so a node answering a stranger learned
      // where they live and threw it away in the same breath.
      //
      // So it goes to the node's own cache as well, which is bounded and
      // is not the book (seenPeers.js). It waits there until the moment
      // somebody is added — by hand or by writing to this node — and is
      // spent then.
      // The MODULE's cache, not this hub instance's — one node, one
      // answer to "where have I lately been told somebody lives", the
      // same reason relayRequest is taken from the module below.
      //
      // ── AND `via`, WHICH THIS DOOR KNEW ALL ALONG (cycle R1) ─────
      //
      // `onRoute(url, body)` has always been handed the relay the
      // announcement CAME IN ON, and passed it no further. So a node on
      // three relays could not tell which of its own doors proved a
      // route — and a route is through MY door to THEIR relay, not an
      // address.
      //
      // RANK PROVED, because this is the announcement a relay makes only
      // after a reply signed by the target key came back through it
      // (relay.js: "a false route cannot be verified... the bar is the
      // signed reply"). It outranks a packet merely arriving and is
      // outranked by the relay that holds the person.
      try {
        require('./hub').shadow(ROOT_DIR).note(body.key, {
          at: body.at, url: url, label: body.label || '',
          via: relayKeys.pinned(ROOT_DIR, url) || '',
          rank: require('./seenPeers').PROVED,
          // THE WHOLE ROW (R28): a relay announcing a claim or a rename says
          // whether the member is connected right now, and only says so
          // when it is. Silence leaves what the node knew alone.
          present: body.present === true ? true : undefined,
        });
      } catch (e) { /* a cache that will not take a row is not a reason to stop listening */ }

      // AND THE LABEL, ON A ROW THAT ALREADY EXISTS.
      //
      //   Andy: "the (updated) public labels must be part of it."
      //
      // `publicLabel` is what that person calls themselves in public, so
      // a relay saying it has changed is a relay improving what this node
      // knows — which is exactly what it may do. What it may NOT do is
      // create the row, so this asks first and writes nothing if the
      // person is a stranger; the cache above already kept it for them.
      //
      // `myLabel` is untouched: a name the owner typed is the owner's and
      // no relay's business.
      if (body.label) {
        try {
          var known = contactBook.byPublicKey(ROOT_DIR, body.key);
          if (known && known.publicLabel !== body.label) {
            contactBook.upsert(ROOT_DIR, { publicKey: body.key, publicLabel: body.label });
          }
        } catch (e) { /* the route landed; the name can wait */ }
      }
    },

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

      // A new member of a relay this node owns becomes a contact, on the
      // event itself (hub.adoptClaim — it replaced a roster sweep that read
      // a list no relay may return, 2026-09-19).
      try { hub.adoptClaim(ev); } catch (e) { /* a contact list is not a reason to drop an event */ }
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

  // ── node (2026-09-16) ──────────────────────────────────────────────
  //
  //   Andy: "i want an intrinsic app info, in which, for now the user can
  //   maintain both fields in this file, more to come."
  //
  // THIS BOX ITSELF. Not what it says to a relay (`relay.*`), not what it
  // says to a person (`peer.*`), not the book it keeps about others
  // (`contact.*`) — the two fields it answers about ITSELF, which is a
  // subject none of those namespaces was about.
  //
  // LOCAL, all three: identity.json on this disk. The description travels
  // to strangers, but only ever as the ANSWER to a question somebody else
  // asked (nodeCard.js), and never because it was edited here. So the box
  // being offline cannot fail any of these, which is what `wire: false`
  // promises a caller.
  //
  // "More to come" is Andy's, and is why this is a namespace rather than
  // two verbs bolted onto `device`.
  loopbackVerbs.claim('node', 'hub.js', {
    'node.card': function (rq, rs) { hub.handleNodeCard(rq, rs); },
    'node.setName': function (rq, rs) { hub.handleNodeName(rq, rs, readJsonBody); },
    'node.setDescription': function (rq, rs) {
      hub.handleNodeDescription(rq, rs, readJsonBody);
    },
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
    // PRESENCE IS HANDED IN so a claim can connect the node it just
    // enrolled. A brand-new node has no key at boot, so presence bailed
    // and never tried again — see handleClaim.
    'relay.claim': function (rq, rs) {
      hub.handleClaim(rq, rs, readJsonBody, {
        presence: presence,
        probe: require('./hub').relayRequest,
      });
    },
    // Eligibility, read-only: does this peer own the relay at that url?
    // Answered off a PUBLIC census, so it grants nothing — the promotion
    // itself is an owner verb posted to the relay like any other.
    'relay.partnerCheck': function (rq, rs) { hub.handlePartnerCheck(rq, rs, readJsonBody); },
    // `relay.roster` STOOD HERE — the public census of a relay this node
    // is not on, "what a partnership makes visible". Deleted 2026-09-17
    // with the only screen that drew it; see the tombstone in hub.js.
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
  // a contactBook write or a preferences read on this machine, so the group
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
    'contact.forget': function (rq, rs) { hub.handlePeer(rq, rs, readJsonBody, 'forget'); },
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
    'peer.acquire': function (rq, rs) { hub.handleContact(rq, rs, readJsonBody); },
    // Ask every relay who matches, rather than downloading every
    // census to find out. See hub.handleSearch.
    //
    // `peer.candidates` STOOD BESIDE THIS and answered the same question
    // by downloading every census on every relay and partner. Deleted
    // 2026-09-17 with no caller — see the tombstone in hub.js.
    'peer.search': function (rq, rs) {
      hub.handleSearch(rq, rs, readJsonBody, { router: peerRouter, presence: presence });
    },
  }, { wire: true });
}

// ── A RELAY THAT KNOWS IT IS GOING SAYS SO ───────────────────────────
//
//   Andy: "can a relay that knows its shutting down (lab.andyflinn.com
//   reboot by your request) send a message down the SSE connections to
//   prepare its counterparts to re-connect?"
//
// THERE WAS NO SHUTDOWN HANDLER AT ALL. systemd sends SIGTERM, node's
// default terminates the process, and the *kernel* closes the sockets. It
// works — clients see the stream end and come back — but nothing about it
// was this relay's decision, and it had no moment in which to say
// anything.
//
// It has one now, and spends it on `retry:`, which is SSE's own field for
// when to come back. So a hundred members do not all reconnect one second
// later into a box that is still booting, get refused, and back off
// further than they needed to. `bash/update` restarts a relay every time
// it takes a tag: this is a routine Tuesday, not an outage.
//
// THREE SECONDS is a guess at a node boot, and a cheap one to be wrong
// about: too low and a member is refused once and retries on its own
// backoff, which is where it would have been anyway.
//
// BOTH MODES, FROM THE SAME CODE.
//
//   Andy: "node and relay must have these safeguards, from the same code?"
//
// A first draft registered this for a relay only, on the reasoning that a
// node has no members to tell. Wrong twice over: a node serves
// /api/events to its own browser and can pace THAT reconnect the same way,
// and once a relay holds outbound streams to partners it is a listener as
// well as a speaker.
//
// The two books differ — a registry keyed by identity, a Set of page
// responses — and what gets said to them does not, which is why
// sayGoingAway takes sinks rather than being a method on either.
{
  let leaving = false;
  const goodbye = function (signal) {
    if (leaving) return;
    leaving = true;
    let told = 0;
    // The browser's EventSource honours `retry:` natively, so telling the
    // page costs no client code at all.
    try { told += require('./presence').sayGoingAway(Array.from(pageStreams), 3000); }
    catch (e) { /* no page open */ }
    // The relay half of this goodbye — its members and partner streams —
    // is relayServer.js since cycle 0. Same sayGoingAway, same three seconds.
    console.log(`${signal} — told ${told} stream(s) to come back in 3s`);
    // The sockets are closed by sayGoingAway, so what is left is this
    // process. Exit rather than waiting for the default handler, which
    // would race the writes just made.
    try { server.close(); } catch (e) { /* not listening */ }
    process.exit(0);
  };
  process.on('SIGTERM', function () { goodbye('SIGTERM'); });
  process.on('SIGINT', function () { goodbye('SIGINT'); });
}

server.listen(port, BIND_HOST, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
