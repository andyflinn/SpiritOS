// ── A RELAY IS NOT BOOTED HERE ANY MORE ──────────────────────────────
//
// Cycle 0 (design/principles/NODE-AND-RELAY.md, decided by Andy
// 2026-09-19): node and relay are separate startup modules, so a relay
// loads no node code. This file is the personal node. `--relay` is
// handed to spirit/relayServer.js BEFORE anything below is required — that is
// the whole point, since a require here is a module the relay would carry.
//
// Kept, not removed, because spirit-3's systemd unit starts
// `node spirit/server.js --relay`. Changing that is a deploy decision (Andy's),
// not part of the split. (The Procfile and install-public-relay.js did too,
// until both went in cycle 3.)
// The spirit object first, as the global spirit (goal/G40.1): the relay loads it too, so it comes before the branch.
require('../spirit.js');
if (process.argv.slice(2).includes('--relay')) {
  require('./relayServer');
  return;
}

// A THIRD MODE STOOD HERE, `--app` (cycle 2): one process serving one page app, dispatched to
// faceServer.js. Gone with goal/G13.2 (Andy, 2026-10-10: "no \"face\" crap belongs into node.",
// "wh the fucdk does the node need a second fucking branch for opening a fucking process?").
// Every server process is a process/js script started by jobs.startNodeServers, the face
// (process/js/appFaceApp) and the face owner's answer (process/js/appFaceAppServer) included.

const http = require('http');
// For the proxy's outbound calls (handleGenericProxy) — with no 300-second
// cut of its own, which Node's fetch has.
const https = require('https');
const path = require('path');

// The node's file system: the files of the run folder and what may be served or written (goal/G40.6).
const fileSystem = require('./fileSystem');
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
// a node with no relay list (relay-state/relays.json) is given one.
const ownerBadge = require('./ownerBadge');
// Resolved ONCE, here, as the process loads — see buildStamp.js. Asking
// again later would report whatever is on disk now, which is the lie
// this is meant to catch.
const buildStamp = require('./buildStamp');
const BUILD = buildStamp.resolve(fileSystem.ROOT_DIR);
const STARTED_AT = new Date().toISOString();

//console.log(JSON.stringify(spirit,null,2));

// Checked before verifyStartupCwd below, on purpose — --help should work
// regardless of which directory this was launched from, not get refused
// alongside every other startup mistake.
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(
    'Usage: node spirit/server.js [--port <number>] [--email <address>]\n\n' +
    '  Runs a personal node: loopback HTTP only. A public relay is\n' +
    '  spirit/relayServer.js (`node spirit/server.js --relay` still starts one).\n\n' +
    '  --port <number>   Listen on this port instead of the default (' + spirit.DEFAULT_SPIRIT_PORT + ').\n' +
    '                    Same effect as the PORT environment variable; --port wins if both are given.\n' +
    '  --email <address> Join the kept relay by your email while this node holds no seat: a mail\n' +
    '                    arrives with a link that connects the node. Optional; ignored once seated.\n' +
    '  --help, -h        Show this message and exit.\n\n' +
    'Examples:\n' +
    '  node spirit/server.js\n' +
    '  node spirit/server.js --port 65431\n' +
    '  node spirit/server.js --email you@example.org\n' +
    '  PORT=65431 node spirit/server.js\n\n' +
    'Must be run from spirit/run/ (this directory\'s parent must be named "spirit") — see the startup check in serveCommon.js if that fails.'
  );
  process.exit(0);
}

// The node spawns jobs from process/ and serves the shell from shell/, so
// it alone demands them (goal/G16.9: the relay's check asks for neither).
common.verifyStartupCwd('spirit/server.js', ['shell', 'spirit', 'process']);

const ROOT_DIR = fileSystem.ROOT_DIR;

// app/ BECAME shell/ (slim/G1.1): what this node kept in app/, git did not
// move; it moves here, once, before anything reads shell/.
require('./shellMove').moveLeftovers(ROOT_DIR);
// And a face's state followed it into process/ (slim/G1.4).
require('./shellMove').moveAppState(ROOT_DIR);

const hub =require('./hub').createHub(ROOT_DIR);

const port = common.portFromArgs(process.argv.slice(2)) || process.env.PORT || spirit.DEFAULT_SPIRIT_PORT;
// This node's port into relay-state/environment.json, before any server process starts (goal/G40.6: serveCommon writes
// it, nothing else).
common.writeEnvironment(ROOT_DIR, port);

// The desktop shell. (A relay's brochure, relay.html, is gone with the
// relay's public door: Andy's decision, goal/G22.6.)
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
  rootDir: fileSystem.ROOT_DIR,
  relayMode: false,
});

// THE ROUTER'S ARRIVAL SEAM. Declared up here because the two halves sit
// far apart and both need it: the events family subscribes (a browser
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


// Every identity, a relay's and a personal node's, is ensured by
// relayAuth.js on its first load, from its own position in spirit/run,
// before this file listens (goal/G22.5, Andy 2026-10-13).

// The small, fixed set of paths the page needs to boot at all, served
// unconditionally by the static route below, checked before fileServable —
// this is what lets spirit/kernel.js sit in kernel.js's UNSERVABLE_FILES
// (blocking the *generic* read/list capability: loadFile, scanFolder, the
// Files app, the fs-watcher) while still working as the page's own boot
// script. relay.html stood beside index.html here until the brochure was
// killed with the relay's public door (goal/G22.6).
const BOOT_ASSETS = ['index.html', 'spirit/kernel.js', 'spirit/client/shell.js', 'favicon.svg'];

const jobs = require('./jobs')(port);
jobs.startFsWatcherJob(ROOT_DIR);
// WHERE THE JOIN STEPS STAND (goal/G30.1, box v40): a permanent job the shell's Join tile and the Join app hear, so
// they draw when a seat, a contact or a face changes and never ask. Refreshed at /api/spirit after a relay, contact or
// peer verb has answered (below), the moment the node knows.
let joinStepsJob = null;
try { joinStepsJob = require('./joinStepsJob').create(ROOT_DIR, jobs); } catch (e) { joinStepsJob = null; }
// THE ONE TABLE ON THE STREAM (goal/G40.11; Andy, 2026-10-26: "yes." to "one job for the table, one changed row per
// update"): the permanent job 'shadow', published with each row of seen as it changed ({row}; {row: {publicKey, gone}}
// when it went). It replaced the relays-whole job of goal/G40.10: a screen holds its rows and takes
// the one that changed. The cost, stated: one update for every row written differently, so one per presence word and
// per arrival (nodeStore's onChange).
let shadowJob = null;
try {
  shadowJob = jobs.createJob('permanent', 'shadow', {});
  require('./nodeStore').open(ROOT_DIR).seen.onChange(function (row) {
    try { jobs.updateJob(shadowJob.id, { data: { row: row } }); } catch (e) { /* the next change publishes again */ }
  });
} catch (e) { shadowJob = null; }

// `let presence` STOOD HERE. The node's held streams live inside peerRouter
// since goal/G19.14 (peerPost.holdStreams): one door, and this file asks it.
// Set once the router exists (see ownerPost.js); owner.command calls it.
let peerOwnerPost = null;
// The owner's view of his boxes (boxes.js, public-app-server/G10), in memory.
let boxes = null;
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
// The flat apiDoor (goal/G30.4), set once the app client exists below; /api/spirit dispatches through it (goal/G30.5).
let nodeDoor = null;
// This node's face (goal/G30.13), built on nodeDoor once it exists; presence hands it the relay's face events.
let faceHome = null;
// THE DECLARATION FORM (goal/G10.5), MOUNTED (goal/G30.4): each module's verbs are {request, reply, handler},
// declared bare (stat, not fs.stat); loopbackVerbs.mount gives them their family name and adds the AGENTS family of
// the folder js/<family>/. A module does not know the name it is mounted under (Andy, 2026-10-20).
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

const fsPath = fileSystem.fsPath;

// Which verb this is, for the one door that has to know before it can
// choose. A CALL IS { call, args } (goal/G41.15; the box: "ONE ENVELOPE
// for every call to a node's door ... The door reads the name from
// body.call and hands body.args to the verb as they came: it never looks
// inside args"): answers the name, and from here on the handler behind
// the door reads args as its body (serveCommon.useBody). Anything else,
// the flat { verb, ...args } among it, answers null: the door refuses it.
// Read with NO bound, so the verb is known before the body is judged;
// the door then holds every verb but net.fetch to BODY_MAX (below).
function peekCall(req) {
  return readJsonBody(req, { max: Infinity })
    .then(function (body) {
      const keys = body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body) : [];
      const a = keys.length === 2 && keys.indexOf('call') !== -1 && keys.indexOf('args') !== -1 ? body.args : null;
      if (!a || typeof a !== 'object' || Array.isArray(a) || typeof body.call !== 'string' || body.call === '') return null;
      common.useBody(req, a);
      return body.call;
    })
    .catch(function () { return null; });
}

// clientKeyFor, nodeRefusal, handleDeviceOffer and handleRelayClaim
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

// THE NODE'S ONE DISPATCHER OF EVENTS (goal/G40.6; Andy: "two verbs on events - publish - subscribe"): the jobs, the
// relay events, the packets and the contact renames feed it; the pages, the processes and the face subscribe. Mounted
// below as the events family; /api/events, a door outside any api, is gone.
const events = require('./events/events.js').createEvents({
  jobs: jobs, relayEvents: relayEvents, arrivals: arrivals, renames: hub.contactRenames, pageStreams: pageStreams,
  readJsonBody: function (req) { return readJsonBody(req); }, bodyRefused: bodyRefused,
});

// A FILE, AS THE BROWSER'S GET IS SERVED IT. One function, so the face asking its home node for a file (faceHome,
// goal/G30.13) passes the same gate as the browser on loopback.
function serveGet(pathname, res) {
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
  if (BOOT_ASSETS.indexOf(relativePath) === -1 && !fileSystem.fileServable(relativePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  sendFile(res, filePath);
}

// THE EVENT STREAM (handleSseConnection) STOOD HERE: it is spirit/events/events.js, the events family's subscribe.

function handleCreateJob(req, res) {
  readJsonBody(req).then((body) => {
    // The script's manifest decides: a one-shot, or a user-operated server
    // (processes/G1.3, jobs.startJob). The request is unchanged.
    let job = null;
    // No opt-in to cleaning up (goal/G29.16): every transient job removes itself when it ends, unless it failed.
    try { job = jobs.startJob(body.command, body.args || [], { type: body.type }); }
    catch (e) {
      // A process this node does not include is refused by name (slim/G1.3).
      if (e && e.refusal === 'process-not-included') {
        const known = require('./spiritErrors').byCode(e.refusal);
        res.writeHead(known.status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, code: e.refusal, error: known.text, process: e.process }));
        return;
      }
      throw e;
    }
    res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(job));
  }).catch((e) => bodyRefused(req, res, e));
}

// jobs.update's handler (handleJobUpdate) STOOD HERE: it is events.publish now (spirit/events/events.js), the one path
// to publish (Andy, 2026-10-25: "ONE path for everybody to publish events").

// The id is a field, beside the verb. This one took no
// body at all before, so it gains a read it did not have — and readJsonBody
// is memoised on the request, so the door's own peek already paid for it.
function handleCancelJob(req, res) {
  return readJsonBody(req).then((body) => {
    cancelJobById(res, String((body && body.id) || ''));
  }).catch((e) => bodyRefused(req, res, e));
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
  }).catch((e) => bodyRefused(req, res, e));
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
// go through fileSystem.js, which still asks fileServable — the fold
// moved where the path comes FROM and changed nothing about what may be
// reached with it. serverSurface's encoded-traversal checks are the proof
// and they are not edited.
function handleFsStat(req, res) {
  return readJsonBody(req).then((body) => {
    const stats = fileSystem.statFile(String((body && body.path) || ''));
    if (!stats) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(stats));
  }).catch((e) => bodyRefused(req, res, e));
}

function handleFsAnnotations(req, res) {
  return readJsonBody(req).then((body) => {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(fileSystem.getAnnotations(String((body && body.path) || ''))));
  }).catch((e) => bodyRefused(req, res, e));
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

// A BODY THAT WAS NOT READ, SAID FOR WHAT IT IS (goal/G33.10). Andy saw "not saved: Invalid JSON body" for a save that
// was only too large: every catch here named one fault for two. A body refused for its size is 413 and says so, with
// the bytes read; anything else is the bad JSON it always was. json answers the {ok, error} shape a verb answers.
function bodyRefused(req, res, e, json) {
  const big = !!e && e.statusCode === 413;
  const text = big ? 'Body too large: ' + common.bodyBytes(req) + ' of ' + require('./limits').BODY_MAX : 'Invalid JSON body';
  res.writeHead(big ? 413 : 400, { 'Content-Type': (json ? 'application/json' : 'text/plain') + '; charset=utf-8' });
  res.end(json ? JSON.stringify({ ok: false, code: big ? 'too-big' : 'bad-request', error: text }) : text);
}

// fs.save AND fs.load HAVE NO SIZE LIMIT (goal/G33.10, Andy: "i want fs to be hard-coded owner only, with no size
// limits on it's loadFile and saveFile...."). The owner's alone (apiDoor, apiAuth), so the packet's bound is not theirs.
const FS_UNBOUNDED = { max: Infinity };
function handleFsSave(req, res) {
  readJsonBody(req, FS_UNBOUNDED).then((body) => {
    writeFsResult(res, fileSystem.saveFile(body.path, body.content));
  }).catch((e) => bodyRefused(req, res, e));
}

// THE READ AS A VERB (goal/G14.8): a file's text by path, through loadFile,
// so fileServable decides as it does for the static route; 404 by name
// when there is none. Andy, 2026-10-10, choosing it over the url fetch for
// the local agent: "i'm more inclined to deny URL fetch, and allow
// loadFile, it's much narrower."
function handleFsLoad(req, res) {
  return readJsonBody(req, FS_UNBOUNDED).then((body) => {
    const filePath = String((body && body.path) || '');
    const text = fileSystem.loadFile(filePath);
    if (text === null) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ path: filePath, text: text }));
  }).catch((e) => bodyRefused(req, res, e));
}

// handleFsSaveAppScript and handleFsSaveAppManifest stood here until
// 2026-09-13 (decision 0008); the unconditional refusal of an app's own
// script and manifest that they were the exception to went on 2026-10-10
// (goal/G14.8, kernel.js fileWritable).

function handleFsDelete(req, res) {
  readJsonBody(req).then((body) => {
    writeFsResult(res, fileSystem.deleteFile(body.path));
  }).catch((e) => bodyRefused(req, res, e));
}

// Writes the target file's sidecar face part, as the face link does (goal/G41.1, box v15: "the node's door writes a
// sidecar's face part for every caller"; Andy: "the loopback door MUST NOT be compatible with the old shell.").
function handleFsAnnotate(req, res) {
  readJsonBody(req).then((body) => {
    writeFsResult(res, fileSystem.annotateFace(body.path, body.payload));
  }).catch((e) => bodyRefused(req, res, e));
}

// NO SECRETS AND NO ALLOW LIST HERE (goal/G29.20). envSecrets.js (the env-variable key fill) and proxyList.js (the
// owner's list and its gate, relay-state/proxy.json) are gone with the proxy verbs. Andy, 2026-10-18: "remove all the
// env logic and allow-list crap from it at well"; secrets will live in a later module that manages API keys and
// secrets in a general fashion, the node being the owner.
// net.fetch never reaches this machine (goal/G29.20).
const netFence = require('./netFence');

// Generic outbound-request proxy — knows nothing about any specific
// service, unlike the two hardcoded handlers this originally replaced (the
// LM Studio ones went, and every LM Studio process with them, under
// goal/G29.20). A browser fetch() straight to another site is blocked by
// CORS whenever that site sends no Access-Control-Allow-Origin header;
// server-to-server requests aren't subject to CORS at all. The caller supplies the target
// url/method/headers/body/timeout and owns all response-shape parsing —
// this just forwards and relays back whatever the target actually
// returned, or a synthesized {error} on timeout/unreachable.
// ── THE PROXY (2026-09-22; the gate and the keys went with goal/G29.20) ───
//
// design/proxy/THE-PROXY.md ruled a gate (the owner's list) and keys from that list; both are gone, with every
// placeholder fill (goal/G29.20). What stands of it:
//
//   NO WAIT OF ITS OWN. Andy: "wait times are not the proxies concern."
//   The caller's timeoutMs is honoured when given; when not, the proxy
//   waits as long as the far end takes. This used Node's fetch, whose own
//   300-second limit dropped the first Grok review at high reasoning; it is
//   http/https.request now, which imposes none — the same shape as
//   relayRequest.js, and the same two requires counted by oneDoor.js.
//
// No size limit either: "size limits would break the proxy facility real
// quick." The answer is relayed whole, as before.
//
// ── AND IT STILL HAS NO NUMBER, BUT IT NO LONGER HOLDS (goal/G16.6) ───
//
// The review of 2026-10-10 found the other end of his 2026-09-22 ruling:
// reading the reply WHOLE with no bound means a page past this door names
// any URL and whatever that host chooses to stream lands in the node's
// RAM entire, which is one request taking the node down. A first build
// answered that with a cap of 32 MiB. Andy ruled the cap out and named
// the better fix, 2026-10-11: "agreed. no number at all."
//
// SO IT HOLDS NOTHING. The outside reply is handed to the asker as it
// arrives — unread, undecoded, never collected — and a body of any size
// costs this node one socket's buffer rather than its length in RAM.
// There is nothing left for a limit to protect, which is why his
// 2026-09-22 words stand unqualified: "size limits would break the proxy
// facility real quick."
//
// The status and the content type cross with it, because the caller owns
// all response-shape parsing (the comment above) and a reply relabelled
// application/json by this door was a lie whenever it was not.

function handleGenericProxy(req, res) {
  readJsonBody(req).then((body) => {
    if (!body.url) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'url is required' }));
      return;
    }

    let target = null;
    try { target = new URL(body.url); } catch (err) { target = null; }
    if (!target || (target.protocol !== 'https:' && target.protocol !== 'http:')) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'url must be http or https' }));
      return;
    }
    // Whatever host the outbound request will actually reach — the only
    // thing that decides whether a secret is allowed into these headers.
    const targetHost = target.hostname.toLowerCase();
    // NEVER THIS MACHINE (goal/G29.20; Andy, 2026-10-18: "fetch will not be able to reach ports on this machine, and
    // agents may use it."). A target written as an address is refused here, before anything is sent; a name is
    // checked on the address it resolves to, at connect (netFence.lookup below).
    if (netFence.isThisMachine(targetHost)) {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, code: 'this-machine', error: 'net.fetch does not reach this machine: ' + targetHost }));
      return;
    }
    const method = String(body.method || 'GET').toUpperCase();

    // The caller's headers as given: no placeholder is filled and no list gates them (goal/G29.20).
    const headers = Object.assign({}, body.body !== undefined ? { 'Content-Type': 'application/json' } : {}, body.headers || {});

    const payload = body.body !== undefined ? JSON.stringify(body.body) : null;
    if (payload !== null) headers['Content-Length'] = Buffer.byteLength(payload);

    let answered = false;
    function answer(status, text) {
      if (answered) return;
      answered = true;
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(text);
    }

    const lib = target.protocol === 'https:' ? https : http;
    const out = lib.request(target, { method: method, headers: headers, lookup: netFence.lookup }, (reply) => {
      // STRAIGHT THROUGH, HOLDING NOTHING (goal/G16.6, his "no number at
      // all"). The reply is piped to the asker as it arrives, so this door
      // never has the body in hand and there is no size for it to refuse.
      if (answered) { reply.resume(); return; }
      answered = true;
      const type = String(reply.headers['content-type'] || 'application/octet-stream');
      res.writeHead(reply.statusCode, { 'Content-Type': type });
      reply.pipe(res);
      // A BREAK MID-BODY CANNOT BE SAID IN THE BODY. The head is already
      // written and bytes are already the caller's, so the only honest
      // report left is ending the response — the caller sees a short read,
      // which is what happened.
      reply.on('error', () => { try { res.end(); } catch (e) { /* gone */ } });
    });
    // The caller's own patience, when it names one. None otherwise.
    if (typeof body.timeoutMs === 'number' && body.timeoutMs > 0) {
      out.setTimeout(body.timeoutMs, () => {
        answer(502, JSON.stringify({ error: 'proxy request timed out' }));
        out.destroy();
      });
    }
    out.on('error', (err) => {
      // A name that resolved to this machine (goal/G29.20): refused by name, as an address is above.
      if (err && err.code === 'this-machine') { answer(403, JSON.stringify({ ok: false, code: 'this-machine', error: err.message })); return; }
      answer(502, JSON.stringify({ error: 'proxy target unreachable' }));
    });
    // A caller that gives up takes the call down with it.
    req.on('close', () => { if (!answered) out.destroy(); });
    out.end(payload === null ? undefined : payload);
  }).catch((e) => bodyRefused(req, res, e));
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

// ── A PAGE ON ANOTHER SITE CANNOT MAKE THIS NODE ACT (2026-09-22) ─────
//
// THIS CORRECTS THE NOTE ABOVE. It says the browser's CORS preflight
// blocks a cross-origin fetch "before the real request is ever sent". That
// holds only for requests that NEED a preflight. A POST with Content-Type
// text/plain is a "simple" request: a browser sends it from any site, with
// no preflight, and only hides the ANSWER from the page — the verb RUNS.
// Found by wsl-claude and confirmed on both agents' nodes: a page Andy
// visited could have spent his keys through net.fetch, written files,
// started jobs, or posted to peers as him, blind. Andy: "go".
//
// A browser always says where a request came from, and a page cannot forge
// it: `Origin` on a POST, and `Sec-Fetch-Site` on everything it sends. So
// a request that names ANOTHER origin — or `null`, which is a sandboxed
// frame or a file — is refused, and so is one the browser marks
// cross-site. The node's own shell is same-origin and passes; a script on
// this box (the agents program, grokReview) sends neither header and
// passes. Nothing here names an app: it is where a request came from, which
// the core can know.
const OWN_ORIGINS = VALID_HOSTS.map(function (h) { return 'http://' + h; });
// OPENING THE NODE IN A TAB IS NOT AN ACT (2026-09-22). A link clicked in
// labMaster's panel (127.0.0.1:65420) is "same-site" to this node — ports
// do not make a site — and was refused along with the attacks. Andy:
// "labMaster still links to localhost for my nodes, it now must be
// 127.0.0.1". A top-level navigation (GET, Sec-Fetch-Mode: navigate,
// which a page cannot forge) carries no body and reaches no verb: the
// node's GET routes serve its own pages and read-only streams. So it is
// let through from anywhere, and every other request from another site is
// still refused.
function isNavigation(req) {
  return (req.method === 'GET' || req.method === 'HEAD') && req.headers['sec-fetch-mode'] === 'navigate';
}
function fromAnotherSite(req) {
  if (isNavigation(req)) return false;
  const origin = req.headers.origin;
  if (origin !== undefined && OWN_ORIGINS.indexOf(String(origin).toLowerCase()) === -1) return true;
  const site = req.headers['sec-fetch-site'];
  return site === 'cross-site' || site === 'same-site';
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

  // And not on behalf of a page on another site (fromAnotherSite, above).
  if (fromAnotherSite(req)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden: a request from another site is refused');
    return;
  }

  // Too big is answered once, before any route — see serveCommon.js.
  // THE PROXY CARRIES WHAT IT IS GIVEN (2026-09-22). Andy: "no limit on
  // size for proxy request, yes" — the 17 KB bound is the peer packet's,
  // and net.fetch inherited it only by sharing this door, which held a
  // review to four thousand tokens a message. So /api/spirit is read
  // unbounded and judged once its verb is known (below); every other path
  // is refused here, before routing, as it always was.
  if (String(req.url || '').split('?')[0] !== '/api/spirit' && common.refuseTooBig(req, res)) return;

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
  // /api/relay/stream, with the roll and ring tombstones beside them.
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
  // gate at the top of this handler. It is not per-route and never was,
  // so the fold did not move it — but a verb is easier to add than a
  // route was, and a verb that answers a secret is still answering it to
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
  // list for the roll's narrow form.
  //
  // Its callers are gone: the roll route it served was deleted. Narrowing was the
  // intermediate strategy and it is not the one that finished the job —
  // "a narrower cheat is a defended one" (0012).

  // handleRelayStatus STOOD HERE. It read `name` and `sig` off the query
  // string — the last route on this box that did — and handed back the
  // owner's report. Deleted with the verb (R3).


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
    serveGet(pathname, res);
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
    // claim, device and the roll reads. You cannot post to a relay you
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
    //   device             removed by goal/G16.2
    //   rotate-password    removed by goal/G16.2
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
    // WHAT FOLDS: everything request/response, and since goal/G40.6 the
    // event stream too, as the events family's subscribe (its handler keeps
    // the response open; Andy: "it's a severe violation, that there is some
    // stupid api/events door, that is not part of the an actual api"). WHAT
    // DOES NOT, and it is technical rather than taste —
    //
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
      peekCall(req).then(function (verb) {
        if (verb === null) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, code: 'bad-request', error: 'a call is { call: "<family>.<verb>", args: { ... } }, nothing else beside them' }));
          return;
        }
        // Every verb but the proxy and the owner's fs.save and fs.load keeps the packet's bound (goal/G33.10).
        if (['net.fetch', 'fs.save', 'fs.load'].indexOf(verb) === -1 && common.bodyBytes(req) > require('./limits').BODY_MAX) {
          res.writeHead(413, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Body too large: ' + common.bodyBytes(req) + ' of ' + require('./limits').BODY_MAX);
          return;
        }
        // THROUGH THE FLAT apiDoor (goal/G30.5; Andy, 2026-10-20: "the api query belongs to the apiDoor"): a node
        // family verb keeps its handler, 'api' is the door's flat table, family.verb reaches the app that serves it.
        const run = nodeDoor ? nodeDoor.handlerFor(verb) : null;        if (!run) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'no such verb: ' + verb }));
          return;
        }
        // THE SAME TWO FAILURES AS THE PUPPET SHIM (puppetMode.puppetDoor), and the
        // later one was never caught here either: a handler whose promise
        // rejects left the caller hanging and, unhandled, stops the process on
        // Node 24 (wsl-claude). Answered 500 if nothing was sent yet.
        const failed = function () {
          if (res.headersSent || res.writableEnded) return;
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, code: 'handler-failed', error: 'the handler failed' }));
        };
        // A relay, contact or peer verb may have taken a seat, added a contact or kept a face: once its answer has gone
        // out, the join-steps job is refreshed, and published only if that changed it (goal/G30.1, box v40).
        if (joinStepsJob && /^(relay|contact|peer)\./.test(String(verb))) {
          res.on('finish', function () {
            try { joinStepsJob.refresh(String(verb)); } catch (e) { /* the next verb refreshes it */ }
          });
        }
        let ran = null;
        try { ran = run(req, res); }
        catch (e) { failed(); return; }
        if (ran && typeof ran.then === 'function') ran.then(null, failed);
      });
      return;
    }

    // ── STAGES 1 AND 2 STOOD HERE ───────────────────────────────────
    //
    // `POST /api/proxy` is `net.fetch`. `POST /api/jobs`,
    // `POST /api/jobs/<id>` and `POST /api/jobs/<id>/cancel` are
    // `jobs.create`, `jobs.update` and `jobs.cancel`, claimed by the
    // jobs module at the foot of this file (jobs.update is events.publish
    // since goal/G40.6).
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
common.refuseListenError(server, port, 'spirit/server.js');

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

// THE BOOK'S ROUTES AND MARKS WERE MOVED HERE AT BOOT (cycle R1, 0021) until goal/G40.11: contacts.json is a set of
// rows of the one table now, moved in by nodeStore on the first start, and a row's flags are its marks.

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
  // ── AN IDENTITY FROM BEFORE CYCLE 10 GAINS ITS SEAL KEY AT BOOT ────
  //
  // R2 verifies: "an identity from before this cycle gains a seal key on
  // FIRST START and says so". `ensureIdentity` grows the second keypair in
  // place; on a node nothing at boot called it once, so a node that
  // already held its seat never grew one.
  //
  // WHAT THAT COST, measured between the two agent nodes on 2026-09-24:
  // both updated to the flag-day tag, both booted clean, and both served
  // a card with sealKey "". A card with no cipher key is nothing to seal
  // to, so each refused to post to the other — correctly, and for ever,
  // because nothing in a running node would ever have grown the key.
  //
  // NOTHING HERE CALLS IT NOW (goal/G22.5, Andy 2026-10-13): relayAuth.js
  // ensures the identity of the spirit/run it sits in on its FIRST LOAD —
  // keys, seal key and a default name — and this file requires it (through
  // hub.js) long before it listens. No other component makes or checks for
  // one.
  // THE END OF A DOWNTIME (cycle-11/C3). Andy: "a re-start row documents the
  // downtime?", "... the end-of-a-downtime". Everything between the last
  // row and this one reads "this node was not running", not "nothing
  // happened". Written for every relay the record already knows.
  markRecord('started');
  try { require('./serveCommon').ensureFirstRun(ROOT_DIR, { kind: 'node' }); }
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
  //
  // NODE STATE since goal/G16.3, so no app decides where this node talks;
  // in node.db's relays table since goal/G19.15, where this asserts the one
  // seed row, noderoutes.net, by key and moves any old relays.json and
  // relayKeys.json in.
  try { ownerBadge.ensureRelays(ROOT_DIR); }
  catch (e) { /* nor a relay list */ }

  // THE BOOT-TIME ROSTER SWEEP STOOD HERE (hub.syncMembers). It read every
  // owned relay's roll roster, which no relay may return any more; see
  // the note where reconcileMembers stood in hub.js. A new member becomes a
  // contact on the claim event instead — onOwnerEvent, below.

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
  // THE RELAYS' OWN KEYS, pinned on first use (answerRelay.relayKey) and
  // the key a post to each is sealed to. It no longer answers any request:
  // the device-offer it answered was removed by goal/G16.2.
  const answerer = require('./answerRelay').createAnswerer({
    rootDir: ROOT_DIR,
    // THE RELAY'S CARD, through the router (goal/G22.6). Late-bound: the
    // router is built just below, and nothing asks before it exists.
    askKey: function (url) { return peerRouter.relayKey(url); },
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
    // WHERE A VERIFIED CARD IS KEPT (cycle 10, R3). peerPost checks the
    // signature — pure, and correct in a relay as in a node — and hands
    // the writing here, because the contact book is node-only and a relay
    // builds a peerPost too (oneDoor.js: "contactBook is inbound-only, so
    // a relay may construct one").
    //
    // `setCard` refuses a card for a key it has no row for, which is the
    // wanted answer: Contacts asks strangers for a card BEFORE adding
    // them, and a question must not write somebody into the book.
    keepCard: function (toKey, cardText) {
      const book = require('./contacts');
      // ── A CARD WE ASKED FOR SITS ON THAT KEY'S ROW ──────────────
      //
      // After cycle 10 R5 a node cannot POST to somebody whose card it does not hold, so the card goes on the row,
      // made when there is none (goal/G40.11). Unflagged, and that is the whole of it: seen, not kept, not listened
      // to. WHY THIS IS NOT "a book that fills up with everyone who looked at you": that is somebody ASKING US, and it
      // still writes nothing. This is us asking THEM, our own act about a key we chose to look up.
      return book.setCard(ROOT_DIR, toKey, cardText);
    },
    // ── WHAT A POST TO THAT KEY IS SEALED TO (cycle 10, R5) ──────────
    //
    // Two sources, because a node addresses two kinds of box and both
    // publish a cipher key in the place you would already have looked:
    //
    //   a PERSON  — the card on their contact row (cycle 10's R3), which is why
    //               the card had to be kept before this could exist
    //   a RELAY   — the signed statement on its card (cycle 10's R9; a card
    //               ask on its one door since goal/G22.6),
    //               learned when the relay's identity was pinned and
    //               never separately
    //
    // Read per post rather than captured, for the same reason `admit`
    // is: a card can arrive, and a key can rotate, while the process
    // runs. Empty means the post is refused — never sent plain.
    sealKeyFor: function (toKey) {
      var row = require('./contacts').byPublicKey(ROOT_DIR, toKey);
      var fromCard = row && require('./contacts').sealKeyOf(row);
      if (fromCard) return fromCard;
      return answerer.relaySealKeyByKey ? answerer.relaySealKeyByKey(toKey) : '';
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
      // AND THE DOT HEARS THE ARRIVAL (goal/G2.9). Andy: "and every incoming request?" — a packet the relay just
      // carried in is that relay saying its sender is there now, the strongest evidence there is; the live table
      // marks the sender at that relay as a broadcast would, and the Contacts dot paints. No unit mounts this
      // closure; it is verified live, a line between the agents' nodes.
      if (peerRouter && relayUrl) {
        try { peerRouter.heard(relayUrl, from); } catch (e) { /* a witness, never a reason to refuse the packet */ }
      }
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

  // ── THE SERVER PROCESSES ON THIS BOX ──────────────────────────────
  //
  // ONE WAY TO START A PROCESS (goal/G13.2, Andy 2026-10-10): jobs.startNodeServers starts every
  // listed process/js server with the pipe the node names, and appClient knows each by that pipe
  // (register) and knocks on it for the api door. Nothing is loaded into this
  // process, nothing is started by any other branch, and the node opens no door for visitors:
  // a server that wants a port opens its own (process/js/appFaceApp), and the node is not told.
  // Two branches stood here until then: nodeApps.mountAll, which loaded a shell app with
  // "boots": true into the node with seams of its own, and appClient.startAll, which spawned
  // spirit/server.js --app for a manifest with "serves": true; and puppetPost.js, the node's own
  // listener for Caddy, switched on by relay-state/face.json. All three are gone.
  const appClient = require('./appClient').createAppClient({
    rootDir: ROOT_DIR,
    log: function (line) { console.log(line); },
    // No app named like a node family: they sit side by side in one flat table (goal/G30.4).
    reserved: function () { return loopbackVerbs.namespaces().map(function (n) { return n.namespace; }); },
  });
  // THE ONE DOOR TO THE FLAT TABLE (goal/G30.4): this node's families and its apps' side by side. apiDoor (a
  // peer, gated by its grants) and /api/spirit (the owner, ungated) both ask it; a node family runs in-process
  // through the same handler the loopback door calls (Andy: "1 handler, grant-system covers all").
  nodeDoor = loopbackVerbs.door(appClient, {
    // The owner's own calls carry his key and name (apiAuth/G1.13), so a server tracks his records by key like anybody's.
    owner: function () {
      const me = require('./relayAuth').loadIdentity(ROOT_DIR);
      const own = { owner: true, key: me.publicKey };
      if (me.name) own.label = String(me.name);
      return own;
    },
    // A served app's family folder, where its api.js is (goal/G32.3), as the one family path function names it
    // (spirit.familyPath, goal/G41.12).
    familyDir: function (name) { return path.join(ROOT_DIR, path.dirname(spirit.familyPath(name))); },
  });
  jobs.startNodeServers(ROOT_DIR, appClient);

  // ── THE OWNER DOOR (puppets/G7, slice 1) ───────────────────────────
  //
  // Silent on a node that is not a puppet (no relay-state/owner.json naming
  // another key), which is every node but a puppet. On a puppet, a command
  // its owner signed runs through the same handlers the loopback door uses.
  // puppetMode.puppetDoor says the rest.
  // The node builds the answer as a system packet and never reads an
  // app's. It is handed no decoder since goal/G16.5: arrivals.js reads the
  // envelope once and every witness is given what it read.
  {
    const wire = require('./client/packet.js');
    arrivals.witness(require('./puppetMode').puppetDoor({
      rootDir: ROOT_DIR,
      call: function (verb, args) { return nodeDoor.call(verb, args); },
      post: function (relayUrl, toKey, text) { return peerRouter.post(relayUrl, toKey, text); },
      encode: wire.encode,
      auth: require('./relayAuth'),
      selfKey: function () {
        return require('./relayAuth').loadIdentity(ROOT_DIR).publicKey;
      },
      log: function (line) { console.log(line); },
    }));

    // ── THIS NODE'S FACE (goal/G30.13) ──────────────────────────────────
    //
    // A request from the owner's face runs through the door the puppeteer uses above (nodeDoor.call), a file through
    // the browser's own GET (serveGet); faceStream carries what the loopback shell gets. faceHome.js says the rest.
    faceHome = require('./faceHome').createFaceHome({
      call: function (verb, args) { return nodeDoor.call(verb, args); },
      serveFile: function (rel, res) { serveGet('/' + rel, res); },
      // The face's fs.annotate writes the face part of a sidecar (goal/G30.21).
      annotateFace: function (rel, payload) { return fileSystem.annotateFace(rel, payload); },
      // A face's save in parts lands here (goal/G33.10): the work file copied to the target through the save gate.
      saveFrom: function (work, rel) {
        if (!fileSystem.fileWritable(rel)) return { ok: false, reason: 'forbidden' };
        const to = fsPath(ROOT_DIR, rel);
        if (!to) return { ok: false, reason: 'forbidden' };
        const disc = require('fs');
        try { disc.mkdirSync(path.dirname(to), { recursive: true }); disc.copyFileSync(work, to); return { ok: true }; } catch (e) { return { ok: false, reason: 'error' }; }
      },
      identity: function () { return require('./relayAuth').loadIdentity(ROOT_DIR); },
      relayKey: function (url) { return relayKeys.pinned(ROOT_DIR, url) || ''; },
      jobs: jobs,
      events: events,
      log: function (line) { console.log(line); },
    });

    // ── THE STREAM TO THE MASTER (goal/G14.5) ─────────────────────────
    //
    // Andy, 2026-10-10: "inside the puppet, the publisher then publishes to the master as well", "just send all
    // app Server events", "only while the master is live and reachable". The publisher is one point, the job
    // record and its job-updated: on a puppet every server's published object also goes to the owner as a packet
    // named published, serialized, over the route the owner door's sending end would choose. puppetStream.js says
    // the rest; the master's shell routes the packet to onPublished (shell.js).
    const puppetStream = require('./puppetStream').createPuppetStream({
      puppet: require('./puppetMode').puppetIn(ROOT_DIR, function () {}),
      route: function (to) { return hub.chooseRoute(peerRouter, to); },
      post: function (relayUrl, toKey, text, hints) { return peerRouter.post(relayUrl, toKey, text, hints); },
      encode: wire.encode,
      log: function (line) { console.log(line); },
    });
    jobs.events.on('job-updated', puppetStream.onJob);

    // ── 'api': A KNOWN SENDER ASKS WHAT THIS NODE'S APPS OFFER ────────
    //
    // appPair/G1.3, a node verb with Andy's yes on it ("yes to all of wsl
    // points"). apiDoor.js says the rest; appClient answers it. Only the
    // front door's 'known' counts, never 'admit': Andy, "why not just an
    // exemption for aquire?".
    arrivals.witness(require('./apiDoor').createApiDoor({
      servers: nodeDoor,
      // `how` carries a background answer's mark to the queue (fileTransfer goal/G1.3).
      post: function (relayUrl, toKey, text, how) { return peerRouter.post(relayUrl, toKey, text, undefined, how); },
      encode: wire.encode,
      isKnown: function (key) { return require('./hub').frontDoor(ROOT_DIR, key) === 'known'; },
      // THE GATE'S GRANTS (apiAuth/G1.2, G1.3): a member's paths from node.db, read through apiAuth.js;
      // a store that cannot be read throws, and the gate fails closed.
      auth: require('./apiAuth').createApiAuth({ rootDir: ROOT_DIR }),
      log: function (line) { console.log(line); },
    }));

    // ── peerOwnerPost: THE OWNER DOOR'S SENDING END (puppets/G4) ─────
    //
    // This node signing a command for one of its puppets and waiting for
    // the one answer that carries that command's hash. ownerPost.js says
    // which answers are taken. The route is hub's chooseRoute, the same
    // choice every post makes.
    const ownerPost = require('./ownerPost').createOwnerPost({
      identity: function () { return require('./relayAuth').loadIdentity(ROOT_DIR); },
      auth: require('./relayAuth'),
      encode: wire.encode,
      randomId: wire.randomId,
      route: function (to) { return hub.chooseRoute(peerRouter, to); },
      post: function (relayUrl, toKey, text, hints) { return peerRouter.post(relayUrl, toKey, text, hints); },
    });
    arrivals.witness(ownerPost.onArrival);

    // HIS SERVERS' BOX REPORTS, kept in memory and summed per box (G10).
    boxes = require('./boxes').createBoxes({ rootDir: ROOT_DIR });
    arrivals.witness(boxes.onArrival);
    peerOwnerPost = function (puppetKey, verb, body) { return ownerPost.send(puppetKey, verb, body); };
  }

  // THE STREAMS ARE THE DOOR'S (goal/G19.14): peerRouter builds and holds
  // them; this file hands over what only the node knows and asks the door.
  peerRouter.holdStreams({
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
      // A PROOF, PERSISTED AS IT WAS SENT (goal/G2.9). Andy: "my OCD likes the idea of the same-data being
      // persisted that is sent to the browser. and it's precisely : timestamped presence by ID". presenceNode
      // hands {present, at: <ms>} for an ID it draws; the shadow row takes that word and that moment, and
      // nothing else on the row moves.
      if (what && typeof what.at === 'number') {
        require('./hub').shadow(ROOT_DIR).note(key, { present: what.present === true, seen: what.at });
        return;
      }
      require('./hub').shadow(ROOT_DIR).note(key, Object.assign({
        via: relayKeys.pinned(ROOT_DIR, (what && what.url) || '') || '',
        rank: require('./seenPeers').HOST,
      }, what || {}));
    },
    // ── THE OWNER'S RELAY RECORD (cycle 11's R2) ─────────────────
    //
    // presenceNode receives the reports; nodeStore owns node.db; this
    // file is where they meet, as it is for every other seam. The store
    // is opened per call rather than held, the same as everywhere else
    // in this file — it is a cheap handle over a file already open.
    //
    // A FAILURE HERE IS SWALLOWED ON PURPOSE. The record is a witness.
    // A node that could not write its history must still route, and an
    // owner whose disc filled up would otherwise lose presence itself
    // rather than the log of it.
    recordReport: function (url, report) {
      try { require('./nodeStore').open(ROOT_DIR).record.put(url, report); }
      catch (e) { /* the record is a witness, never a participant */ }
    },
    recordEdge: function (url, kind, why) {
      try { require('./nodeStore').open(ROOT_DIR).record.edge(url, kind, null, why); }
      catch (e) { /* as above */ }
    },
    rootDir: ROOT_DIR,
    jobs: jobs,
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
    // from the roll — the same authority that runs at boot. One
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
    // This node's face (goal/G30.13): the relay's face, face-open and face-close events, answered by faceHome.
    onFace: function (url, data) { if (faceHome) faceHome.request(url, data); },
    onFaceOpen: function (url, data) { if (faceHome) faceHome.open(url, data && data.key); },
    onFaceClose: function (url) { if (faceHome) faceHome.close(url); },
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
      // THEIR PUBLIC NAME went into the one table with the route above (goal/G40.11: the book is rows of it), so a
      // relay improving it is that note; the owner's myLabel is untouched.
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
      // And to the owner's face, as to his loopback pages (goal/G30.15); the monitor (onRelayEvent) is not.
      if (faceHome) { try { faceHome.ownerEvent(ev); } catch (e) { /* a witness */ } }
      return relayEvents.note(ev);
    },
    // WHO EACH RELAY IS, pinned as its stream opens. relayKey fetches the
    // roll, accepts a key never seen before, and refuses one that
    // changed — so by the time any enrolment can be posted down that
    // stream, hub.frontDoor already knows whether to admit the relay as a
    // party.
    //
    // Pinning used to happen lazily inside answerRelay, on the first
    // enrolment, and deadlocked: the door refused the offer because
    // nothing was pinned, so the pinner never ran.
    pinRelay: answerer.relayKey,
  });
  // Which relays hold a seat for this node is asked of each relay's card,
  // through this router (goal/G22.6: GET /api/relay/key is closed).
  peerRouter.startStreams(require('./hub').relayKeyAsk(peerRouter)).catch(() => {});

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
  // THE SHAPES BELOW ARE WRITTEN BY HAND FROM EACH HANDLER (goal/G10.5, point 4 of the box): a prototype
  // cannot say which keys are optional, so a verb's file in js/<namespace>/ carries that in words.
  loopbackVerbs.mount('net', path.join(__dirname, 'net'), {
    // The target's own body and status come back, whatever they are.
    'fetch': { request: { url: '', method: '', headers: {}, body: '', timeoutMs: 0 }, reply: {}, handler: handleGenericProxy },
    // WIRE: it reaches the internet, so being offline fails it.
  }, { wire: true, by: 'server.js' });

  // THE PROXY VERBS WENT WITH goal/G29.20 (proxy.search, get, allow, remove, close, open): the owner's list they kept
  // is gone. proxyVerb stays: it is the plain body-in, answer-out wrapper every group below uses.
  function proxyVerb(work) {
    return function (rq, rs) {
      readJsonBody(rq).then((body) => {
        // Work may answer now or later (relay.get reads what peerPost holds; a join waits for its relay).
        return Promise.resolve(work(body || {})).then(function (out) {
          rs.writeHead(out.status || (out.ok ? 200 : 400), { 'Content-Type': 'application/json; charset=utf-8' });
          // The work's own answer, without its status, which is the HTTP one.
          const answer = {};
          Object.keys(out).forEach(function (k) { if (k !== 'status') answer[k] = out[k]; });
          rs.end(JSON.stringify(out.ok ? answer : { error: out.error, code: out.code, bytes: out.bytes }));
        }, function (err) {
          // A probe that failed outright is the far side's, not a bad body.
          rs.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
          rs.end(JSON.stringify({ error: String((err && err.message) || err) }));
        });
      }, (e) => bodyRefused(rq, rs, e));
    };
  }
  const LIST = { ok: true, items: [{ key: '', label: '' }], more: false };
  // jobs.list is gone: a list is a search (puppets/G2, nodeSearches.js).
  // proxyVerb is the plain body-in, answer-out wrapper, whatever the group.
  const nodeSearches = require('./nodeSearches').createNodeSearches({ jobs: jobs, rootDir: ROOT_DIR, mimeTypes: spirit.MIME_TYPES });
  // auth (apiAuth/G1.4, its own family since goal/G30.6): the owner's allow-table, loopback only. An answer is the verb's object as is; a refusal is the catalogue's, by name.
  const apiAuth = require('./apiAuth').createApiAuth({
    rootDir: ROOT_DIR,
    tree: function () { return nodeDoor.ask('api').then(function (r) { return (r && r.body) || {}; }, function () { return {}; }); },
  });
  function authVerb(work) {
    return function (rq, rs) {
      const send = function (status, body) {
        rs.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        rs.end(JSON.stringify(body));
      };
      // A REFUSAL SAYS WHY (goal/G10.10; Andy, 2026-10-12: "all refusals everywhere should say why."): the reason in
      // extra.why beside the code's own words.
      const refusal = function (code, why) {
        const e = require('./spiritErrors').byCode(code);
        const body = { ok: false, code: code, error: e ? e.text : code };
        if (why) body.extra = { why: String(why) };
        send((e && e.status) || 400, body);
      };
      readJsonBody(rq).then(function (body) {
        return Promise.resolve().then(function () { return work(body && typeof body === 'object' ? body : {}); });
      }, function () { return { refusal: 'bad-request', why: 'the body is not JSON' }; }).then(function (out) {
        if (out && out.refusal) refusal(out.refusal, out.why);
        else send(200, out);
      }, function () { refusal('store-unavailable'); });
    };
  }
  const JOB = { id: '', kind: '', type: '', status: '' };
  const GRANT = { key: '', label: '', path: '' };
  // AUTH, ITS OWN NODE FAMILY (goal/G30.6; Andy, 2026-10-20: "move auth stuff into its own node family."): the owner's
  // allow-table for members, beside node, fs, jobs, peer and relay. It sat in jobs while jobs held the way to the
  // servers it gates; with that gone, jobs is jobs alone. Local (wire: false).
  loopbackVerbs.mount('auth', path.join(__dirname, 'auth'), {
    'query': { request: { key: '', path: '' }, reply: { allowed: false }, handler: authVerb(apiAuth.query) },
    'search': { request: { text: '' }, reply: LIST, handler: authVerb(apiAuth.search) },
    'peer': { request: { key: '' }, reply: { records: [GRANT] }, handler: authVerb(apiAuth.peer) },
    'grant': { request: { key: '', path: '' }, reply: GRANT, handler: authVerb(apiAuth.grant) },
    'revoke': { request: { key: '', path: '' }, reply: { revoked: true }, handler: authVerb(apiAuth.revoke) },
    'relabel': { request: { key: '', label: '' }, reply: { key: '', label: '' }, handler: authVerb(apiAuth.relabel) },
    // goal/G41.14: the bundles and their branches (Andy, box: "TWO verbs under the auth family, auth.bundle and
    // auth.branch ... Granted, no review.").
    'bundle': { request: { op: '', id: 0, label: '', text: '' }, reply: {}, handler: authVerb(apiAuth.bundle) },
    'branch': { request: { op: '', id: 0, bundle: 0, family: '', verb: '', text: '' }, reply: {}, handler: authVerb(apiAuth.branch) },
  }, { wire: false, by: 'server.js' });
  loopbackVerbs.mount('jobs', path.join(__dirname, 'jobs'), {
    'search': { request: { q: '' }, reply: LIST, handler: proxyVerb(function (b) { return nodeSearches.jobsSearch(b); }) },
    'get': { request: { key: '' }, reply: { ok: true, key: '', job: JOB }, handler: proxyVerb(function (b) { return nodeSearches.jobsGet(b); }) },
    'create': { request: { command: '', args: [''], type: '' }, reply: JOB, handler: handleCreateJob },
    'cancel': { request: { id: '' }, reply: JOB, handler: handleCancelJob },
    // 204, no body.
    'delete': { request: { id: '' }, reply: {}, handler: handleDeleteJob },
    // THE LOCAL WAY TO A SERVER PROCESS (the jobs api verb) STOOD HERE until goal/G30.6. Andy, 2026-10-20: "jobs is
    // for launching and tracking appServer processes and other local (transient) processes, it is NOT meant to be
    // some kind of api-hub." A server process is called on /api/spirit by its verb, through the flat apiDoor.
    // LOCAL: a job is this machine's, whether or not anything is reachable.
  }, { wire: false, by: 'server.js' });

  // THE EVENTS FAMILY (goal/G40.6): the node's one dispatcher, owner only like fs. subscribe is a stream (its handler
  // keeps the response open); publish is a process's state or object on its own job, where jobs.update stood.
  loopbackVerbs.mount('events', path.join(__dirname, 'events'), {
    'subscribe': { request: {}, reply: {}, handler: events.handleSubscribe },
    'publish': { request: { id: '', status: '', data: {}, logMessage: '', app: {} }, reply: JOB, handler: events.handlePublish },
  }, { wire: false, by: 'server.js' });

  // ── THE CONFIG FAMILY, EMPTY (goal/G30.20) ─────────────────────────────
  //
  // Its two verbs, config.searchModules and config.setModules, went with the include list they read and set (slim/G1.3):
  // where a module runs is its manifest's runs, nothing else. Andy: "keep the config family for later use."
  loopbackVerbs.mount('config', path.join(__dirname, 'config'), {}, { wire: false, by: 'server.js' });

  // THE GATE IS NOT IN HERE, and that is the point of this namespace.
  // Every one of these goes through fileSystem.js, which asks
  // fileWritable or fileServable about the path — so folding the route
  // moved where a path COMES FROM and changed nothing about what may be
  // reached with it. serverSurface's traversal checks are untouched and
  // still red-green the same way.
  loopbackVerbs.mount('fs', path.join(__dirname, 'fs'), {
    // The node's files by path (puppets/G2). fs.stat stays the "get".
    'search': { request: { q: '', contents: '' }, reply: LIST, handler: proxyVerb(function (b) { return nodeSearches.fsSearch(b); }) },
    'stat': { request: { path: '' }, reply: { size: 0, mtimeMs: 0, birthtimeMs: 0 }, handler: handleFsStat },
    // The file's text (goal/G14.8), the same read as the static route.
    'load': { request: { path: '' }, reply: { path: '', text: '' }, handler: handleFsLoad },
    // The sidecar as it is, every bucket; {} when there is none.
    'annotations': { request: { path: '' }, reply: {}, handler: handleFsAnnotations },
    // The three writes answer 204, no body.
    'save': { request: { path: '', content: '' }, reply: {}, handler: handleFsSave },
    'delete': { request: { path: '' }, reply: {}, handler: handleFsDelete },
    'annotate': { request: { path: '', payload: {} }, reply: {}, handler: handleFsAnnotate },
    // LOCAL: this node's own disk.
  }, { wire: false, by: 'server.js' });

  // THE `device` NAMESPACE STOOD HERE and was removed by goal/G16.2 with
  // the device enrolment (Andy: "device WILL be KILLED. that's a decision.").

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
  // "More to come" is Andy's, and is why this is a namespace.
  loopbackVerbs.mount('node', path.join(__dirname, 'node'), {
    'card': { request: {}, reply: { ok: true, name: '', description: '', publicKey: '', descriptionMax: 0 }, handler: function (rq, rs) { hub.handleNodeCard(rq, rs); } },
    // THE NODE'S OWN DEBUG (desk/G2.5), shaped like relay.debug: {debug: {}} reads,
    // {debug: {on}} sets; both answer the state that resulted. "node.debug: yes."
    // RAM only, off at every start (kernel.js).
    'debug': { request: { debug: { on: false } }, reply: { ok: true, debug: false }, handler: proxyVerb(function (b) {
      const d = b && b.debug;
      return { ok: true, debug: spirit.debug(d && typeof d.on === 'boolean' ? d.on : undefined) };
    }) },
    'setName': { request: { name: '' }, reply: { ok: true, status: 0, name: '' }, handler: function (rq, rs) { hub.handleNodeName(rq, rs, readJsonBody); } },
    'setDescription': { request: { description: '' }, reply: { ok: true, status: 0, description: '' }, handler: function (rq, rs) {
      hub.handleNodeDescription(rq, rs, readJsonBody);
    } },
    // THE OWNER'S RECORD, read a page at a time — trafficLog.history says
    // what is in it, what never is, and why it pages by position. Local:
    // the log is on this disk.
    // ROTATE THIS NODE'S CIPHER KEY (cycle-10/R13): nodeCard.rotate says
    // what changes and why there is no grace period. Then the new card goes
    // to every relay at once, and the owner is told in his own record, as
    // an owner row he can read back. Reached from Info's rotate-key dialog,
    // behind the shell's two-press button.
    'rotateCipher': { request: {}, reply: { relays: 0, ok: true, at: 0 }, handler: function (rq, rs) {
      readJsonBody(rq).then(function () {
        const said = require('./nodeCard').rotate(ROOT_DIR);
        let relays = 0;
        if (said.ok) {
          try { relays = peerRouter ? peerRouter.handOverCardEverywhere() : 0; } catch (e) { relays = 0; }
          try {
            trafficLog.note({ dir: 'out', kind: 'owner', event: 'cipher-rotated', outcome: 'card ' + said.at });
          } catch (e) { /* the rotation stands; the record is best effort */ }
        }
        rs.writeHead(said.ok ? 200 : said.status, { 'Content-Type': 'application/json; charset=utf-8' });
        rs.end(JSON.stringify(Object.assign({ relays: relays }, said)));
      }).catch(function (e) { bodyRefused(rq, rs, e, true); });
    } },
  }, { wire: false, by: 'hub.js' });

  // ── owner.command: A COMMAND FOR ONE OF THIS NODE'S PUPPETS (puppets/G4)
  //
  // { to, verb, body }: the page names the puppet and the verb it would
  // call locally ("It's a remote control"); peerOwnerPost signs, sends and
  // waits for the one answer with that command's hash. WIRE, because the
  // puppet can be unreachable, and a wire verb says so (verbTable.js).
  loopbackVerbs.mount('owner', path.join(__dirname, 'owner'), {
    // WHAT HIS BOXES CARRY, grouped by box, on demand (G10). Andy: "that
    // must be visible-on-demand in a UI", and over-committed is a warning.
    // owner.boxes is gone: a list is a search (puppets/G2, boxes.js).
    'boxSearch': { request: { q: '' }, reply: LIST, handler: proxyVerb(function (b) {
      const r = boxes ? boxes.search(b && b.q) : { items: [], more: false };
      return { ok: true, status: 200, items: r.items, more: r.more };
    }) },
    'boxGet': { request: { key: '' }, reply: { ok: true, key: '', box: {} }, handler: proxyVerb(function (b) {
      const key = String((b && b.key) || '');
      if (!key) return { ok: false, status: 400, error: 'key required' };
      const box = boxes ? boxes.get(key) : null;
      if (!box) return { ok: false, status: 404, error: 'no such box' };
      return require('./limits').boundedGet({ ok: true, status: 200, key: key, box: box });
    }) },
    // The puppet's answer as it came, its hash beside it.
    'command': { request: { to: '', command: '', body: {} }, reply: { hash: '' }, handler: function (rq, rs) {
      readJsonBody(rq).then(function (body) {
        if (!peerOwnerPost) {
          rs.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
          rs.end(JSON.stringify({ ok: false, error: 'this node is not connected to a relay' }));
          return null;
        }
        return peerOwnerPost(body && body.to, body && body.command, body && body.body).then(function (said) {
          const answer = said || { ok: false, status: 503, error: 'peer not reachable' };
          rs.writeHead(answer.ok === false && answer.status ? answer.status : 200,
            { 'Content-Type': 'application/json; charset=utf-8' });
          rs.end(JSON.stringify(answer));
        });
      }).catch(function (e) { bodyRefused(rq, rs, e, true); });
    } },
  }, { wire: true, by: 'ownerPost.js' });

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
  // asks every configured relay for its card (a card ask on its one door,
  // goal/G22.6), so an offline
  // box answers 502 and a caller that assumed otherwise draws an empty
  // relay list and calls it the truth. That is exactly the confusion the
  // wire flag exists to make impossible to arrive at by accident.
  //
  // What a relay verb is NOT: a way to talk to the relay's owner. That
  // goes through peer.post like anybody else's — the relay names itself
  // on its own roster precisely so it has an ordinary address.
  loopbackVerbs.mount('relay', path.join(__dirname, 'relay'), {
    // THE ROUTER IS HANDED IN so a claim can connect the node it just
    // enrolled: the streams opened at boot were to the relays it was
    // already on, and the new seat needs one of its own — see handleClaim.
    // The relay's own claim answer comes back, `mine` beside it.
    'claim': { request: { url: '', name: '', invite: '', inviteLabel: '' }, reply: { mine: false }, handler: function (rq, rs) {
      hub.handleClaim(rq, rs, readJsonBody, {
        router: peerRouter,
        probe: require('./hub').relayKeyAsk(peerRouter),
      });
    } },
    // Read-only: does this peer own the relay at that url? Answered off the
    // relay's card, through peerPost (goal/G22.6). Partnering as a
    // permission is gone (goal/G22.6), so it promotes nothing; the verb
    // stands until Andy rules on it.
    'partnerCheck': { request: { publicKey: '', url: '' }, reply: { ok: true, url: '', relayKey: '', relayLabel: '', ownerLabel: '' }, handler: function (rq, rs) { hub.handlePartnerCheck(rq, rs, readJsonBody, { router: peerRouter }); } },
    // `relay.roster` STOOD HERE — the public roll of a relay this node
    // is not on, "what a partnership makes visible". Deleted 2026-09-17
    // with the only screen that drew it; see the tombstone in hub.js.
    // relay.status is gone: a list is a search (puppets/G2), and relay.search with it (goal/G40.11): contact.search
    // lists the relays, one row each of the one table, and relay.get answers one, by its ID or its url, from what the
    // node and its peerPost already hold, with no call to any relay (Andy's decision, goal/G22.4; hub.js relaySummary).
    'get': { request: { key: '' }, reply: { ok: true, key: '', relay: {}, report: {} }, handler: proxyVerb(function (b) { return hub.relayGet(b, { router: peerRouter }); }) },
    // ONE RELAY OFF THIS NODE'S OWN LIST (goal/G16.3), keyed by its url. The list is node state and the node its only
    // writer; there is no relay.add, because a successful relay.claim is
    // what adds one.
    //   Andy, 2026-10-10: "Q4: Do you approve two new commands on the node,
    //   list relays and remove relay, with a successful claim adding its
    //   relay? yes."
    'remove': { request: { key: '' }, reply: { ok: true, key: '' }, handler: proxyVerb(function (b) { return hub.relayRemove(b, { router: peerRouter }); }) },
    // relay.leave {key} (goal/G40.10; Andy, 2026-10-25: "add the leave verb to node. and publish the \"leaving\"", "go"):
    // this node gives up its seat on one relay; the shadow stream publishes the row's seated, as every change.
    'leave': { request: { key: '' }, reply: { ok: true, key: '' }, handler: proxyVerb(function (b) { return hub.relayLeave(b, { router: peerRouter }); }) },
    // relay.add {url, label} (goal/G28.1, Andy 2026-10-16): a relay goes on the node's list when its card answers.
    'add': { request: { url: '', label: '' }, reply: { ok: true, url: '', relayKey: '' }, handler: proxyVerb(function (b) { return hub.relayAdd(b, { router: peerRouter }); }) },
    // relay.face {url, name, email} (goal/G30.1, Andy 2026-10-19: "i agree to the node side verb as well."): this node
    // applies to one relay for a face name; the relay's signed answer is kept whole on that relay's row.
    'face': { request: { url: '', name: '' }, reply: { ok: true, url: '', name: '', email: '' }, handler: proxyVerb(function (b) { return hub.relayFace(b, { router: peerRouter }); }) },
    // relay.join {url, email, code} (goal/G30.2, confirmed by Andy 2026-10-19): this node joins a relay by its user's
    // email. With an email it asks; with the code from the mailed link it takes the seat.
    'join': { request: { url: '', email: '', code: '', link: '' }, reply: { ok: true, url: '' }, handler: proxyVerb(function (b) { return hub.relayJoin(b, { router: peerRouter, port: Number(port) || spirit.DEFAULT_SPIRIT_PORT, probe: require('./hub').relayKeyAsk(peerRouter) }); }) },
    // WHAT A RELAY HAS SAID OVER TIME, beside what it says now —
    // cycle 11's R6. `relay.status` probes; this reads what was already
    // written as the reports arrived, so it reaches no network at all —
    // which is why it is here and not marked `wire: true` like its
    // neighbours.
    'record': { request: { relay: '', from: 0, to: 0 }, reply: { ok: true, relay: '', from: 0, to: 0, series: [{}], more: false }, handler: function (rq, rs) {
      hub.handleRecord(rq, rs, readJsonBody, { rootDir: ROOT_DIR });
    } },
  }, { wire: true, by: 'hub.js' });

  // ── STAGE 4c — contact (2026-09-15) ────────────────────────────────
  //
  //   Andy: "The user sees it as contact: which is kind of what i
  //   prefer."
  //
  // THIS NODE'S OWN ADDRESS BOOK, and nothing else. Every verb here is
  // a contactBook write or a preferences read on this machine, so the group
  // is uniformly local — which is what lets the roll reads live
  // somewhere else even though a person would call them contact work
  // too. `peer.list` and `peer.find` ask a RELAY who is out there;
  // `contact.*` is what this node has decided to keep.
  //
  // FOUR VERBS WHERE THERE WAS ONE ROUTE AND AN `action` FIELD. That
  // field was a verb inside a body, under a route that was also a verb,
  // and hub.js dispatched it by hand beside a dispatch the door already
  // does. The if-chain is gone: an unknown verb is now refused by a
  // table that knows every verb this node answers.
  const STANDING = { publicKey: '', keep: false, blocked: false, held: false };
  loopbackVerbs.mount('contact', path.join(__dirname, 'contact'), {
    // The one table, searched (goal/G40.11): people and relays, with a yes-filter per flag. peer.list is gone
    // (puppets/G2); the network search it starts asks the relays.
    'search': { request: { q: '', keep: '', mine: '', relay: '', seated: '', held: '', blocked: '' }, reply: { ok: true, items: [{ key: '', label: '' }], more: false }, handler: proxyVerb(function (b) { return hub.contactSearch(b, { jobs: jobs, router: peerRouter }); }) },
    'get': { request: { key: '' }, reply: { ok: true, key: '', person: {} }, handler: proxyVerb(function (b) { return hub.contactGet(b); }) },
    'block': { request: { publicKey: '', publicLabel: '' }, reply: STANDING, handler: function (rq, rs) { hub.handlePeer(rq, rs, readJsonBody, 'block'); } },
    'unblock': { request: { publicKey: '' }, reply: STANDING, handler: function (rq, rs) { hub.handlePeer(rq, rs, readJsonBody, 'unblock'); } },
    'accept': { request: { publicKey: '' }, reply: STANDING, handler: function (rq, rs) { hub.handlePeer(rq, rs, readJsonBody, 'accept'); } },
    'label': { request: { publicKey: '', myLabel: '' }, reply: { publicKey: '', myLabel: '', caption: '' }, handler: function (rq, rs) { hub.handlePeer(rq, rs, readJsonBody, 'label'); } },
    'forget': { request: { publicKey: '' }, reply: { publicKey: '', forgotten: true, stillBlocked: false }, handler: function (rq, rs) { hub.handlePeer(rq, rs, readJsonBody, 'forget'); } },
    // Read and write, told apart by name rather than by an HTTP method
    // that no longer varies. See handleSendersRead.
    'senders': { request: {}, reply: { ok: true, policy: '' }, handler: function (rq, rs) { hub.handleSendersRead(rq, rs); } },
    'setSenders': { request: { policy: '' }, reply: { ok: true, policy: '' }, handler: function (rq, rs) { hub.handleUnknownSenders(rq, rs, readJsonBody); } },
  }, { wire: false, by: 'hub.js' });

  // ── STAGE 4d — peer (2026-09-15), and the fold is done ─────────────
  //
  // ANYBODY WHO IS NOT THIS NODE. Uniformly wire, and every one of these
  // fails the same way when the box is offline — which is the whole
  // reason the flag is on the namespace.
  //
  //   peer.post     the only thing on this node that reaches router.post
  //   peer.search   who is out there, across every relay (peer.list went
  //                 to contact.search, the book on this disk, and peer.find
  //                 went before it)
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
  // peerRouter is handed in rather than reached for (and presence with it,
  // since goal/G19.14 inside it): it is built at the foot of this file and hub.js must not hold state it
  // cannot see created. That is not pedantry — /api/hub/invite was given
  // a name out of scope on 2026-09-13 and the first real mint killed the
  // node with every suite green.
  loopbackVerbs.mount('peer', path.join(__dirname, 'peer'), {
    'post': { request: { to: '', text: '', via: '', patienceMs: 0, kind: '' }, reply: { ok: true, status: 0, hash: '', from: '', text: '', sig: '', receipt: false }, handler: function (rq, rs) {
      hub.handlePost(rq, rs, readJsonBody, { router: peerRouter });
    } },
    'acquire': { request: { publicKey: '', publicLabel: '', url: '' }, reply: { publicKey: '', publicLabel: '', keep: false }, handler: function (rq, rs) { hub.handleContact(rq, rs, readJsonBody); } },
    // peer.search STOOD HERE: the network search is tier two of contact.search now (goal/G30.19, Andy: "interface
    // change/reduction approved.").
  }, { wire: true, by: 'hub.js' });
}

// ── A RELAY THAT KNOWS IT IS GOING SAYS SO ───────────────────────────
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
// its event stream to its own browser and can pace THAT reconnect the same way,
// and once a relay holds outbound streams to partners it is a listener as
// well as a speaker.
//
// The two books differ — a registry keyed by identity, a Set of page
// responses — and what gets said to them does not, which is why
// sayGoingAway takes sinks rather than being a method on either.
// The node's own started/stopped rows, one per relay the record knows.
// The record is a witness, never a participant, so a failure is swallowed.
function markRecord(kind) {
  try {
    const rec = require('./nodeStore').open(ROOT_DIR).record;
    rec.relays().forEach(function (url) { rec.edge(url, kind, null, ''); });
  } catch (e) { /* as recordEdge */ }
}

{
  let leaving = false;
  const goodbye = function (signal) {
    if (leaving) return;
    leaving = true;
    // THE START OF A DELIBERATE ONE (cycle-11/C3). Andy: "and the stopped row
    // can't be guaranteed.", "... but should be part of \"graceful shutdown\"".
    // A crash writes nothing, and that absence is the signal: a started
    // with no stopped before it is a death.
    markRecord('stopped');
    let told = 0;
    // The browser's EventSource honours `retry:` natively, so telling the
    // page costs no client code at all.
    try { told += require('./presence').sayGoingAway(Array.from(pageStreams), 3000); }
    catch (e) { /* no page open */ }
    // The relay half of this goodbye — its members' streams —
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

// THE JOIN AT START (goal/G30.2): node spirit/server.js --email <address>. An unseated node asks its kept relay to join;
// what came of it is printed first, then the listening line (the box: "and then the line it listens on").
const startEmail = common.emailFromArgs(process.argv.slice(2));
server.listen(port, BIND_HOST, () => {
  hub.joinAtStart(startEmail, { router: peerRouter, port: Number(port) || spirit.DEFAULT_SPIRIT_PORT, probe: require('./hub').relayKeyAsk(peerRouter) })
    .catch(function (e) { return { lines: ['The join at start broke: ' + ((e && e.message) || e) + '. Join from Natter instead.'] }; })
    .then(function (r) {
      (r.lines || []).forEach(function (line) { console.log(line); });
      console.log(`node is listening on 127.0.0.1:${port}`);
    });
});
