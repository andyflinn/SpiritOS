'use strict';
// spirit/run/spirit/server/script.js
// THE ONE SERVER (goal/G49.25, box v16; Andy: "There is only ONE server, the relay differs only by the fact that it has a "relay"
// branch."): the node server, for node and relay alike. "spirit/server/script.js is THE server, for node and relay alike: the actual
// node server ... moves into it." "spirit.server.serveCommon goes: spirit/server/script.js takes ALL of
// its jobs" (Andy: "i mean "ALL" of serve common"). "spirit.server.app remains what it is."
//
// IT STARTS A SERVER ONLY WHEN NODE WAS STARTED WITH IT (box v16): required by another script (the peer post, the relay request,
// the relay server until its own move), it starts nothing and hands out its helpers, below. Started, it is the launcher (goal/G48.5):
//
//   node spirit/server/script.js [--node] [args]        a personal node, startNode() below
//   node spirit/server/script.js --relay [args]         a public relay, spirit/server/relay/script.js until it moves in here
//   node spirit/server/script.js --app <script> [args]  one server process, spirit/server/app/script.js, the app's script after it
//
// THE START COMMANDS IN USE STAY VALID (goal/G48.5: "no Flag Day"): a node starts with "node spirit/server/script.js", a relay with
// "node spirit/server/script.js --relay" (bash/systemd/spirit-relay.service), and --relay may stand anywhere among the arguments.
// --app stands first, so the node's start check reads it in a fixed place (spirit/job/engine/script.js, RH1). ONE MODE, AN UNKNOWN
// ONE REFUSED; every argument after the mode reaches the server unchanged (--port, --email, --help). A relay that refuses to start
// exits 78 by itself (STARTUP_REFUSED); nothing here catches it.
//
// The spirit object first, as the global spirit (goal/G40.1).
require('../script.js');

// ══ WHAT EVERY SERVER NEEDS: THE HELPERS (serveCommon's, goal/G49.25) ══════════════════════════════════════════════════════════
// ── WHAT BOTH SERVERS NEED, AND NOTHING EITHER ONE OWNS ──────────────
//
// Cycle 0 (design/principles/NODE-AND-RELAY.md, 2026-09-19): the node and
// the relay became separate startup modules — spirit/server/script.js and
// spirit/server/relay/script.js — so a relay stops loading node code at all. What is
// here is what both of them answer HTTP with: reading a body, sending a
// file, refusing too big or malformed, saying which build this is.
//
// It requires no transport. Each entry point makes its own server
// (oneDoor.js counts that); this module only handles the requests they
// hand it.

const fs = require('fs');
const path = require('path');
const limits = spirit.requireScript('spirit/limits/script.js');
// THE DEBUG TEST ROUTES (goal/G41.19, spirit/DEBUG/test/script.md): both servers hand every request to DEBUG.js first, as
// debugFirst below; with DEBUG off it answers nothing.
const DEBUG = spirit.requireScript('spirit/DEBUG/script.js');

const MIME_TYPES = spirit.MIME_TYPES;

// Job spawning (job.js's startProcessJob) passes relative script paths
// like "spirit/app/pushOrigin/pushOrigin.js" straight to
// child_process.spawn with no cwd unless its caller passes one, so it
// inherits whatever directory THIS process was started from. Every other
// path in the app is resolved off ROOT_DIR (__dirname-relative, always
// correct) — this is the one place actual process.cwd() matters, and
// starting the server from the wrong place (e.g. `cd spirit && node
// server.js` instead of `node spirit/server/script.js` from spirit/run) breaks job
// spawning silently: scripts fail in well under a second with no useful
// error, easy to mistake for a real bug in the spawned script itself.
// Fail loud and immediately instead.
//
// A relay spawns no jobs and loads neither shell/ nor process/, so it
// must not be refused for lacking them (goal/G16.9): each entry point
// names the folders IT needs, and the default is only spirit/, which
// both run from. The node passes its own longer list (server.js: shell,
// spirit, process).
function verifyStartupCwd(entry, requiredDirs) {
  var cwd = process.cwd();
  var errors = [];

  var needed = Array.isArray(requiredDirs) && requiredDirs.length ? requiredDirs : ['spirit'];
  var missing = needed.filter(function (name) {
    try { return !fs.statSync(path.join(cwd, name)).isDirectory(); }
    catch (err) { return true; }
  });
  if (missing.length > 0) {
    errors.push('expected ' + missing.join('/, ') + '/ under the current directory, but ' + (missing.length > 1 ? 'they weren\'t' : 'it wasn\'t') + ' found');
  }

  // Belt and suspenders: this project's own folder is always named
  // "spirit", one level up from wherever the server actually runs
  // (spirit/run) — catches starting from some unrelated folder that
  // happens to also have spirit/ or process/ children.
  if (path.basename(path.dirname(cwd)) !== 'spirit') {
    errors.push('expected the current directory\'s parent to be named "spirit" (i.e. running from spirit/run), but it\'s "' + path.basename(path.dirname(cwd)) + '"');
  }

  if (errors.length > 0) {
    console.error(
      'Refusing to start: ' + errors.join('; ') + '. Current directory: ' + cwd + '\n' +
      'Job spawning resolves script paths relative to wherever this process was started from — ' +
      'run this as `node ' + (entry || 'spirit/server/script.js') + '` from spirit/run, not from inside spirit/.'
    );
    process.exit(1);
  }
}

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

// --email <address> / --email=<address>: the user's email, given once at start, so an unseated node joins its kept
// relay by it (goal/G30.2). Optional: '' without the flag.
function emailFromArgs(argv) {
  const eqArg = argv.find((arg) => arg.startsWith('--email='));
  if (eqArg) return eqArg.slice('--email='.length).trim();
  const flagIndex = argv.indexOf('--email');
  if (flagIndex !== -1 && argv[flagIndex + 1] !== undefined) return String(argv[flagIndex + 1]).trim();
  return '';
}

// ONE STATIC ROUTE, THE NODE'S AND THE RELAY'S (goal/G49.15, box v16: "the static file serving logic should be the exact same on
// the relay as it is on the node."; "the relay list goes."): a GET for a file is answered from the run folder by the one gate,
// fileSystem's fileServable, which keeps spirit/state/, relay-state/, the server code and the sidecars out.
// "/" IS face.html (goal/G43.30; Andy: "make face.html the default for \"/\""), also asked at its own path; "/" is the one
// address that is not a file's (goal/G49.13: no address map). The tab's icon at home is served whatever the gate says
// (Q26, Andy: "the ghost one for loopback, the face one for the face."), at its own path.
// The relay serves what its run folder holds that the gate allows (box v16: "the fact that the relay will serve most files
// outsite of spirit.state will simply allow the relay owner to install a simple static website on the VPS").
const HOME_PAGE = 'spirit/shell/face.html';
const BOOT_ASSETS = ['spirit/shell/ghost.svg'];
function serveStatic(rootDir, pathname, res) {
  const fileSystem = spirit.requireScript('spirit/fs/fileSystem/script.js');
  const relativePath = pathname === '/' ? HOME_PAGE : String(pathname).replace(/^\/+/, '');
  const filePath = fileSystem.fsPath(rootDir, '/' + relativePath);
  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  if (BOOT_ASSETS.indexOf(relativePath) === -1 && !fileSystem.fileServable(relativePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  sendFile(res, filePath);
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME_TYPES[ext] || 'application/octet-stream';

  const notFound = () => {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  };
  // A path the file system cannot even take (a NUL in it) throws at once, before any callback: not found, never a
  // crash of the node (goal/G41.30).
  try {
    fs.readFile(filePath, (err, data) => {
      if (err) { notFound(); return; }
      res.writeHead(200, { 'Content-Type': type });
      res.end(data);
    });
  } catch (e) { notFound(); }
}

// ── READ ONCE, ANSWERABLE TWICE ──────────────────────────────────────
//
// A request body is a stream and a stream is consumed. That was fine
// while a path chose the handler, because exactly one thing ever read
// it.
//
// /spirit has to look at the body to know WHICH handler — the verb
// is in there — and the handler it picks then reads the same body for
// itself. So the promise is memoised on the request: the first caller
// drains the stream, every later caller gets the same answer, and a
// handler moving under the single door needs no change of its own.
//
// Memoised on `req` rather than in a table, because the lifetime is
// exactly the request's and nothing has to remember to clean up.
const BODY_PROMISE = Symbol('spiritJsonBody');
const BODY_BYTES = Symbol('bodyBytes');

// ── ONE BODY READER: BYTES COPIED, BYTES COUNTED (goal/G16.6) ────────
//
//   Andy, 2026-10-10: "in a max_BYTE environment, BYTES must be copied.
//   BYTES must be counted. that's a rule." And on where it belongs:
//   "one single piece of shared code must ensure that raw bytes are
//   copied. precisely", "ideally through a shared kernel utility or
//   similar."
//
// WHAT WAS WRONG. Every reader did `body += chunk`, which decodes each
// TCP chunk on its own. A character wider than one byte — any emoji,
// any accent, any kanji — split across two chunks became two U+FFFD,
// and the body was no longer the body that was sent. On a REQUEST that
// is a spurious 403, because the signature is over the real bytes; on a
// REPLY it is silent corruption, since nothing signs a reply until
// goal/G16.1. The cap was already counted in bytes correctly
// (`Buffer.byteLength`); it was the JOIN that lied, not the count.
//
// So the chunks are kept as Buffers and decoded ONCE over the whole
// body, which cannot split a character because there is nothing left to
// split it against. It is in serveCommon.js, the code the node and the relay share (goal/G40.6; it stood in
// the old kernel until then).
//
// `max` refuses by name at the first chunk that passes it and STOPS
// READING — a body refused for its size must not go on arriving, or the
// refusal costs what it was refusing (serveCommon's own reasoning, kept).
// `code` and `message` let a caller name its own refusal: the relay hop
// says `relay-answer-too-large`, the proxy says its reply is too large,
// and a caller that names neither gets `413 body-too-large`.
// `onBytes` is called with the running total as each chunk lands, for
// the one caller that must answer how much it has read even when it
// refused (serveCommon.bodyBytes, read by the node's door).
function readBody(stream, opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const max = Number(o.max) > 0 ? Number(o.max) : Infinity;
  return new Promise(function (resolve, reject) {
    let chunks = [];
    let seen = 0;
    let done = false;
    function refuse(err) {
      if (done) return;
      done = true;
      chunks = null;
      if (typeof stream.destroy === 'function') stream.destroy();
      reject(err);
    }
    stream.on('data', function (c) {
      if (done) return;
      const buf = Buffer.isBuffer(c) ? c : Buffer.from(c);
      seen += buf.length;
      if (typeof o.onBytes === 'function') o.onBytes(seen);
      if (seen > max) {
        const err = new Error(String(o.message || 'body too large'));
        err.statusCode = 413;
        err.code = String(o.code || 'body-too-large');
        err.bytes = seen;
        err.max = max;
        refuse(err);
        return;
      }
      chunks.push(buf);
    });
    stream.on('end', function () {
      if (done) return;
      done = true;
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    stream.on('error', function (e) { refuse(e); });
  });
}

// ── THE CAP THAT WAS MISSING, AND IT IS THE ONE THAT MATTERS ─────────
//
// This read `body += chunk` with no limit of any kind. The payload caps
// in relay.js are checked AFTER the body is whole and parsed, so they
// bounded what got ROUTED and never what got ACCEPTED — on a public box,
// on every POST.
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
// `opts.max` lifts the bound for ONE caller that has decided it may: the
// node's own door, which reads before it knows the verb and then applies
// BODY_MAX to every verb but net.fetch, fs.save and fs.load (server.js). Everybody
// else reads under BODY_MAX exactly as before. The bytes seen are kept on
// the request, so the door can judge the body it has already read.
function readJsonBody(req, opts) {
  if (req[BODY_PROMISE]) return req[BODY_PROMISE];
  const max = opts && typeof opts.max === 'number' ? opts.max : limits.BODY_MAX;
  const reading = new Promise((resolve, reject) => {
    const tooBig = () => {
      const err = new Error('body too large');
      err.statusCode = 413;
      req.destroy();
      reject(err);
    };

    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > max) {
      tooBig();
      return;
    }

    // ONE READER, AND IT COPIES BYTES (goal/G16.6). This loop used to do
    // `body += chunk`, which counted the bytes correctly and then joined
    // the body wrongly: a character split across two chunks became
    // U+FFFD, so a signed request failed its signature with a spurious
    // 403. The cap behaviour is unchanged — refused at the first chunk
    // past `max`, the socket destroyed, 413 — and the running total is
    // still kept on the request, because the node's door answers how much
    // it read even when it refused (`bodyBytes`).
    readBody(req, {
      max: max,
      onBytes: seen => { req[BODY_BYTES] = seen; },
    }).then(body => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    }, err => {
      if (err && err.statusCode === 413) tooBig();
      else reject(err);
    });
  });
  req[BODY_PROMISE] = reading;
  return reading;
}

// How many bytes of this request's body were read (0 before any).
function bodyBytes(req) { return req[BODY_BYTES] || 0; }

// THE BODY A HANDLER READS, SET BY THE DOOR (goal/G41.15). The node's door takes a call as { call, args } and reads it
// once; each handler behind it reads its body as it always did, and gets the call's args as that body, unchanged.
function useBody(req, value) { req[BODY_PROMISE] = Promise.resolve(value); }

// The connection's own address, used only as a rate-limiting bucket key —
// never as authority for anything. Rate limits used to key on the name in
// the request body, which the sender chooses, so rotating it reset the
// budget; this is the one thing about a request the caller can't restate
// at will.
// BEHIND CADDY, THE ADDRESS CADDY FORWARDS (goal/G22.7, Andy's decision): on a VPS every request reaches the relay
// from Caddy on the loopback, so the socket says 127.0.0.1 for every stranger and the address table would hold them
// all in one entry. A request that came from the loopback is counted by the last X-Forwarded-For entry, the one Caddy
// itself appended; earlier entries are whatever the sender wrote and are ignored. A request from anywhere else is
// counted by its socket address, whatever header it carries, since anyone reaching the relay directly could write one.
function isLoopbackSocket(address) {
  const a = String(address || '');
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1' || /^127\./.test(a) || /^::ffff:127\./.test(a);
}
function clientKeyFor(req) {
  const socketAddress = (req.socket && req.socket.remoteAddress) || '';
  if (!isLoopbackSocket(socketAddress)) return socketAddress;
  const forwarded = String((req.headers && req.headers['x-forwarded-for']) || '');
  const last = forwarded.split(',').map(function (s) { return s.trim(); }).filter(Boolean).pop();
  return last || socketAddress;
}

// One answer for every way this can fail, and it says nothing.
//
// Its callers are the relay's stream door (relayServer.js, /spirit/relay/stream):
// a bad signature or a refused open comes back as `not now` (a sender that
// is not a member is told so apart, before this). It was the device page's
// answer until the device enrolment went (goal/G16.2), where a form that
// distinguished wrong password from wrong moment would have told a guesser
// which one it had.
//
// The STATUS still varies (429 for the rate limit, which a client waits
// out); the STRING never varies.
// "not now" stays the sentence — Grok's review: "Do not drop "not now" to a
// code-only body" — and the code rides beside it (R36 phase B).
function nodeRefusal(res, status) {
  res.writeHead(status || 403, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'not now', code: 'node-not-now' }));
}

// ── TOO BIG IS ANSWERED ONCE, HERE, BEFORE ANY ROUTE ─────────────────
//
// One place for every POST, so no route carries its own opinion about
// it. Declared size only — the running total is enforced
// in readJsonBody, which is what catches a chunked body or a client
// that sends more than it said.
//
// It answers before dispatch so the refusal is a clean 413 rather than
// the `400 Invalid JSON body` every route's catch would otherwise
// report — which would name the wrong fault, and the wrong fault is
// what somebody debugs at three in the morning.
//
// Returns true when it has answered, and the caller must stop.
function refuseTooBig(req, res) {
  const declaredLength = Number(req.headers['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > limits.BODY_MAX) {
    res.writeHead(413, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Body too large: ' + declaredLength + ' of ' + limits.BODY_MAX);
    return true;
  }
  return false;
}

// Both of these parse caller-controlled bytes, and both can throw:
// decodeURIComponent on a malformed escape ('/%zz', '/%'), and the URL
// constructor on a Host header it can't make an origin out of. An
// uncaught throw HERE is not a bad response, it's a dead process — the
// handler runs outside any try, so the exception unwinds straight out of
// http's 'request' emit and ends Node.
//
// That mattered most on a relay, where this runs BEFORE
// isRelayPublicPath narrows anything: a single unauthenticated
// `GET /%zz` from the internet took the public relay down, and
// systemd's Restart=on-failure just made it a three-second outage per
// request rather than a permanent one. Answer 400 and stay up.
//
// A REQUEST NODE CANNOT EVEN PARSE (goal/G41.30; the red: "a header line with no colon: the connection failed:
// ECONNRESET"): Node's own answer writes a 400 and destroys the socket at once, so a client still sending its body gets a
// reset and the 400 is lost. Answered here instead: the 400 said, whatever the client still sends read and dropped, and
// the socket closed in order, so the client reads the answer. Both doors call it on their server.
function answerClientErrors(server) {
  server.on('clientError', function (err, socket) {
    if (!socket || socket.destroyed) return;
    if (err && err.code === 'ECONNRESET') { socket.destroy(); return; }
    socket.on('error', function () { /* the client went: nothing to answer */ });
    socket.resume();
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: 30\r\n\r\nBad request: malformed request');
    setTimeout(function () { if (!socket.destroyed) socket.destroy(); }, 2000).unref();
  });
}

// Returns { url, pathname }, or null when it has answered 400.
function parseRequestPath(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(url.pathname);
    // A NUL IN THE PATH IS REFUSED HERE, AT THE ENTRY (goal/G41.30; the red: "one GET /%00 kills the node"): no file
    // name holds one, and the file system throws on it instead of answering.
    if (pathname.indexOf('\0') !== -1) throw new Error('a NUL in the path');
    return { url: url, pathname: pathname };
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad request: malformed request path');
    return null;
  }
}

// Without this, a failed listen() (most commonly EADDRINUSE — another
// SpiritOS instance, or anything else, already on this port) surfaces as
// a raw unhandled 'error' event and a Node internals stack trace, same
// failure class verifyStartupCwd() already fails loud and clear for.
function refuseListenError(server, port, entry) {
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `Refusing to start: port ${port} is already in use — probably another SpiritOS instance (or anything else) already listening there.\n\n` +
        `Try a different port:\n` +
        `    node ${entry} --port ${Number(port) + 1}`
      );
    } else {
      console.error(`Refusing to start: ${err.message}`);
    }
    process.exit(1);
  });
}

// ── FIRST-RUN DEFAULTS, FOR A NODE AND A RELAY ALIKE (goal/G30.7) ────────
//
//   Andy, 2026-10-20: "shouldn't the relay: on boot, like a node, make sure it has a default description", and
//   "doesn't that kind of stuff belong in serverCommon?"
//
// The node's own rule, moved here from nodeCard (ensureDescription):
//   Andy: "on boot: the node should fill the description 'this node described for the first time [date / time
//   string].' this gives likely different strings by default."
// ONCE, AND ONLY INTO A GAP: it runs on every boot and writes only a blank, so nothing a person typed is ever
// overwritten by a restart. TO THE SECOND and in UTC, because it is read by a person and two boxes minted in one second
// are a collision worth having.
//
// A RELAY GETS A FIRST PUBLIC LABEL TOO: its identity's name, when it is empty or the installer's word 'relay' (a type,
// not a caption), becomes 'relay' and its machine's name, so no two relays read alike by default and no key's tail is
// shown (goal/G40.1; rule/13: "the machine name as its default name").
function firstDescription(kind, now) {
  const at = (now instanceof Date ? now : new Date()).toISOString();
  // 2026-09-17T14:23:07.123Z -> 2026-09-17 14:23:07 UTC
  return 'this ' + kind + ' described for the first time ' + at.slice(0, 10) + ' ' + at.slice(11, 19) + ' UTC';
}
function ensureFirstRun(rootDir, opts) {
  const auth = spirit.requireScript('spirit/relayAuth/script.js');
  const kind = opts && opts.kind === 'relay' ? 'relay' : 'node';
  const id = auth.loadIdentity(rootDir);
  if (!id || !id.publicKey) return null;
  // Through the ordinary setter, so the one thing written without a human present obeys every rule a human's would.
  if (!String(id.description || '').trim()) auth.setDescription(rootDir, firstDescription(kind, opts && opts.now));
  if (kind === 'relay') {
    const now = auth.loadIdentity(rootDir);
    const name = String(now.name || '').trim();
    if (!name || name === 'relay') auth.saveIdentity(rootDir, Object.assign({}, now, { name: 'relay ' + require('os').hostname() }));
  }
  return auth.loadIdentity(rootDir);
}

// THIS NODE'S PORT, FOR EVERY node.js PROCESS ON IT (goal/G40.6). Andy: "only a node.js servers listening on a loopback
// port writes that port to environment.json", "it really belongs in serverCommon", and "anytime a node.js process
// requires(spirit) spirit itself fetches the port from environment.json". Written before the node starts any server
// process, so each finds it; the folder first, since a fresh tree has no spirit/state/.
function writeEnvironment(rootDir, port) {
  const fs = require('fs');
  const file = path.join(rootDir, 'spirit', 'state', 'environment.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ PORT: Number(port) }, null, 2), 'utf8');
}

// THE PAGES' ADDRESS MAP (goal/G43.18, PAGE_FILES and pageFile) STOOD HERE: every page file is asked and served at its
// own run path, /spirit/script.js, /spirit/shell/boot/script.js and so on (goal/G49.13; Andy: "YOU FUCKING FIX THE
// CALLERS AND REMOVE THE MOTHERFUCKING SHIM").

// ── HOW BOTH SERVERS LOAD THE BRANCHES (goal/G49.25) ─────────────────
//
// Andy, the box v10: "serveCommon will load the spirit.fs branch explicitly, then load all trunk branches, using the fs-cache";
// "the existing logic is used to identify both old and new branches and apps"; and "WHY WOULD THE MOTHERFUCKING SERVER LOAD
// MOTHERFUCKING BRANCHES EXPLICITLY????". Both the node and the relay boot through these two, a relay with spirit.IS_RELAY true
// (the fs cache then keeps branch and app folders only, spirit/fs/server/script.js).
//
//   loadFs(rootDir, jobs)  spirit.fs first, by name: the branch, then its watcher started, which fills the fs cache the scan
//                          reads. jobs is the node's job table, null on a relay (it keeps none). Answers the watcher's job.
//   loadBranches(o)        every trunk branch the fs cache marks, spirit/<name> with the new branch mark or the old api one,
//                          spirit.fs first: its node work, spirit/<name>/server/script.js's verbs(o.node) (Q5, Andy: "WHY THE FUCK
//                          WOULD IT NOT???"), mounted by o.mount(name, folder, verbs). A new-shape branch is named by its path,
//                          spirit.<name>, and its verbs pass o.check(name, branch, verbs), its own script.js's arguments; an old-
//                          shape one keeps its own word, <name>, unchecked, as before. A branch with no node work is mounted with
//                          none, so its interface is still found by its folder. Answers a promise of the names mounted.
//     o: { rootDir, node, mount(name, folder, verbs), check(name, branch, verbs), root }; root is the trunk's own verbs, mounted
//     first under spirit (Andy: "spirit is always loaded"). A relay hands no node and no mount.
function loadFs(rootDir, jobs) {
  spirit.requireScript('spirit/fs/script.js');
  return spirit.requireScript('spirit/fs/server/script.js').start(rootDir, jobs || null);
}
function trunkBranches() {
  const files = spirit.requireScript('spirit/fs/dataset/script.js').files();
  return Object.keys(files).filter(function (p) {
    const row = files[p];
    return /^spirit\/[^/]+$/.test(p) && !!row && row.kind === 'folder' && (row.branch === true || row.api === true);
  }).sort(function (a, b) { return a === 'spirit/fs' ? -1 : b === 'spirit/fs' ? 1 : (a < b ? -1 : (a > b ? 1 : 0)); }).map(function (p) {
    return { dir: p, isNew: files[p].branch === true };
  });
}
function loadBranches(opts) {
  const o = opts || {};
  // THE TRUNK ITSELF FIRST (Andy: "spirit is always loaded"): its verbs are its server's own, handed in as o.root, mounted under
  // spirit at the trunk's folder and checked by spirit/script.js's (spirit.verbs).
  if (o.root && typeof o.mount === 'function') {
    o.mount('spirit', path.join(o.rootDir, 'spirit'), typeof o.check === 'function' ? o.check('spirit', { verbs: spirit.verbs }, o.root) : o.root);
  }
  return Promise.all(trunkBranches().map(function (t) {
    const word = t.dir.slice(t.dir.lastIndexOf('/') + 1);
    const name = t.isNew ? spirit.dottedPath(t.dir) : word;
    // The folder arrives whole from the fs cache (goal/G49.23, Q7: "a path that arrives whole at run time may be held in a
    // name"); its node work and its script are the two files every branch names the same.
    const workPath = t.dir + '/server/script.js';
    const scriptPath = t.dir + '/script.js';
    return Promise.resolve().then(function () {
      const work = fs.existsSync(path.join(o.rootDir, workPath)) ? spirit.requireScript(workPath) : null;
      const declared = work && typeof work.verbs === 'function' && o.node ? work.verbs(o.node) : {};
      return Promise.resolve(t.isNew ? spirit.requireScript(scriptPath) : null).then(function (branch) {
        const verbs = t.isNew && typeof o.check === 'function' ? o.check(name, branch, declared) : declared;
        if (typeof o.mount === 'function') o.mount(name, path.join(o.rootDir, t.dir), verbs);
        return name;
      });
    }).then(null, function (e) {
      console.error('the ' + name + ' branch could not be bound: ' + ((e && e.message) || e));
      return null;
    });
  })).then(function (names) { return names.filter(Boolean); });
}

module.exports = {
  loadFs: loadFs,
  loadBranches: loadBranches,
  writeEnvironment: writeEnvironment,
  ensureFirstRun: ensureFirstRun,
  firstDescription: firstDescription,
  bodyBytes: bodyBytes,
  verifyStartupCwd: verifyStartupCwd,
  portFromArgs: portFromArgs,
  emailFromArgs: emailFromArgs,
  sendFile: sendFile,
  serveStatic: serveStatic,
  readBody: readBody,
  readJsonBody: readJsonBody,
  useBody: useBody,
  clientKeyFor: clientKeyFor,
  nodeRefusal: nodeRefusal,
  refuseTooBig: refuseTooBig,
  parseRequestPath: parseRequestPath,
  answerClientErrors: answerClientErrors,
  refuseListenError: refuseListenError,
  // debugFirst(req, res, server): true when DEBUG.js answered, and the caller must stop. server.api() answers the
  // server's api tree, { <family>: { <verb>: { request, reply } } }.
  debugFirst: DEBUG.answer,
};

// ══ THE LAUNCHER (goal/G48.5) ═══════════════════════════════════════════════════════════════════════════════════════════════════
const MODES = ['--node', '--relay', '--app'];
// The options the node and the relay read (spirit/server/script.js, spirit/server/relay/script.js, spirit/server/script.js): any
// other argument that starts with a dash is an unknown mode, refused.
const OPTIONS = ['--port', '--email', '--help', '-h', '--ram', '--disc'];

function refuse(why) {
  console.error('spirit/server/script.js: ' + why + '. Modes: ' + MODES.join(', ') + ' (none is --node).');
  process.exit(2);
}

function launch() {
  const args = process.argv.slice(2);
  if (args[0] === '--app') {
    // One server process: its script is the argument after --app, and it reads its own arguments after that.
    const script = args[1];
    if (!script) refuse('--app needs the app\'s script after it');
    process.argv.splice(1, 2);
    spirit.requireScript('spirit/server/app/script.js').start(script);
  } else {
    const modes = args.filter(function (a) { return MODES.indexOf(a) !== -1; });
    if (modes.length > 1) refuse('one mode only, not ' + modes.join(' and '));
    if (modes[0] === '--app') refuse('--app stands first, the script after it');
    const unknown = args.filter(function (a) { return /^-/.test(a) && MODES.indexOf(a) === -1 && OPTIONS.indexOf(a.split('=')[0]) === -1; });
    if (unknown.length) refuse('no such mode or option: ' + unknown.join(' '));
    // The mode word itself is the launcher's; the module reads the rest as it always read its arguments.
    if (modes.length) process.argv.splice(2 + args.indexOf(modes[0]), 1);
    if (modes[0] === '--relay') spirit.requireScript('spirit/server/relay/script.js');
    else startNode();
  }
}

// ══ THE NODE (the personal node's server, until goal/G49.25 its own file) ═══════════════════════════════════════════════════════
// The node's whole start, run by launch() for --node or no mode.
function startNode() {

// Every server process is started by jobs.startNodeServers: an app of spirit/app/ whose node.mount is true and that is
// active (intrinsic, or active in spirit/state/<name>/node.json; goal/G43.12), as "node spirit/server/script.js --app <script>".

const http = require('http');
// The proxy's outbound calls (net.fetch) are the net branch's own since goal/G49.25: spirit/net/server/script.js.
const path = require('path');

// The node's file system: the files of the run folder and what may be served or written (goal/G40.6).
const fileSystem = spirit.requireScript('spirit/fs/fileSystem/script.js');
// The helpers this node shares with the relay's startup module — body
// reading, file sending, the 413 and malformed-path guards.
const common = module.exports;
// What this node answers about itself, and the one thing it writes there
// unasked — see the boot call in the personal-node block.
const nodeCard = spirit.requireScript('spirit/nodeCard/script.js');
// The address book, for one narrow purpose here: stashing a route a relay
// has PROVEN onto a contact row that already exists. Everything else that
// touches the book goes through hub; this does not, because it is a
// stream event with no request behind it and no response to build.
const contactBook = spirit.requireScript('spirit/contact/engine/script.js');
// The keys this node has accepted for the relays it uses. Turning the URL
// a packet arrived on into the relay KEY a route is made of.
const relayKeys = spirit.requireScript('spirit/peer/relay/key/script.js');
// The owner badge (ownerBadge.js). Required here for one call at boot:
// a node with no relay is given the kept one (ensureRelays, a relay row
// of node.db's one table through relayKeys).
const ownerBadge = spirit.requireScript('spirit/ownerBadge/script.js');
// THE BUILD STAMP AND GET /api/version STOOD HERE: the product reads no git and no stamp file of its tree
// (goal/G49.13; Andy: "THAT KIND OF SHIT IS NOT PART OF THE PRODUCT!!!").

//console.log(JSON.stringify(spirit,null,2));

// Checked before verifyStartupCwd below, on purpose — --help should work
// regardless of which directory this was launched from, not get refused
// alongside every other startup mistake.
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(
    'Usage: node spirit/server/script.js [--port <number>] [--email <address>]\n\n' +
    '  Runs a personal node: loopback HTTP only. A public relay is\n' +
    '  spirit/server/relay/script.js (`node spirit/server/script.js --relay` still starts one).\n\n' +
    '  --port <number>   Listen on this port instead of the default (' + spirit.DEFAULT_SPIRIT_PORT + ').\n' +
    '                    Same effect as the PORT environment variable; --port wins if both are given.\n' +
    '  --email <address> Join the kept relay by your email while this node holds no seat: a mail\n' +
    '                    arrives with a link that connects the node. Optional; ignored once seated.\n' +
    '  --help, -h        Show this message and exit.\n\n' +
    'Examples:\n' +
    '  node spirit/server/script.js\n' +
    '  node spirit/server/script.js --port 65431\n' +
    '  node spirit/server/script.js --email you@example.org\n' +
    '  PORT=65431 node spirit/server/script.js\n\n' +
    'Must be run from spirit/run/ (this directory\'s parent must be named "spirit") — see the startup check in serveCommon.js if that fails.'
  );
  process.exit(0);
}

// The node starts from spirit/run, which holds spirit/. shell/ is no longer
// asked for: it is gone (goal/G43.30; Andy: "can we delete run://shell/").
common.verifyStartupCwd('spirit/server/script.js', ['spirit']);

const ROOT_DIR = fileSystem.ROOT_DIR;

const hub =spirit.requireScript('spirit/hub/script.js').createHub(ROOT_DIR);

const port = common.portFromArgs(process.argv.slice(2)) || process.env.PORT || spirit.DEFAULT_SPIRIT_PORT;
// This node's port into spirit/state/environment.json, before any server process starts (goal/G40.6: serveCommon writes
// it, nothing else).
common.writeEnvironment(ROOT_DIR, port);

// "/" IS face.html, and every other file at its own path: serveCommon's serveStatic, the relay's too (goal/G49.15).
// (A relay's brochure, relay.html, is gone with the relay's public door: Andy's decision, goal/G22.6.)

// THE LOG, read as a table. One store for both directions, keyed by hash
// and ordered by arrival — and the thing the arrivals seam hands rows to,
// so a page that was closed can catch up from the same place a live page
// is fed from.
//
// `relayMode: false` always, now: a relay no longer loads this module at
// all (cycle 0), which turns trafficLog's own relay gate from a runtime
// promise into an absence.
const trafficLog = spirit.requireScript('spirit/trafficLog/script.js').createTrafficLog({
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
const relayEvents = spirit.requireScript('spirit/peer/arrivals/script.js').createFanOut();

const arrivals = spirit.requireScript('spirit/peer/arrivals/script.js').createArrivals({
  // A packet that lands while no page is open waits IN THE LOG — a row
  // that is admitted and not yet taken. The seam keeps nothing of its
  // own and reaches the log through its api block, never through the
  // file: production code reads through the API.
  traffic: trafficLog,
});


// Every identity, a relay's and a personal node's, is ensured by
// relayAuth.js on its first load, from its own position in spirit/run,
// before this file listens (goal/G22.5, Andy 2026-10-13).


const jobs = spirit.requireScript('spirit/job/engine/script.js').installJobs(port);
// THE spirit.fs BRANCH FIRST, BY NAME (goal/G49.25, box v10: "serveCommon will load the spirit.fs branch explicitly"): its watcher, the
// fs cache's writer (goal/G49.15), started with its job in this node's job table; every other branch is found in that cache below.
common.loadFs(ROOT_DIR, jobs);
// WHERE THE JOIN STEPS STAND (goal/G30.1, box v40): a permanent job the shell's Join tile and the Join app hear, so
// they draw when a seat, a contact or a face changes and never ask. Refreshed at /spirit after a relay, contact or
// peer verb has answered (below), the moment the node knows.
let joinStepsJob = null;
try { joinStepsJob = spirit.requireScript('spirit/job/joinStepsJob/script.js').create(ROOT_DIR, jobs); } catch (e) { joinStepsJob = null; }
// THE ONE TABLE ON THE STREAM (goal/G40.11; Andy, 2026-10-26: "yes." to "one job for the table, one changed row per
// update"): the permanent job 'shadow', published with each row of seen as it changed ({row}; {row: {publicKey, gone}}
// when it went). It replaced the relays-whole job of goal/G40.10: a screen holds its rows and takes
// the one that changed. The cost, stated: one update for every row written differently, so one per presence word and
// per arrival (nodeStore's onChange).
let shadowJob = null;
// A RELAY'S ROW CARRIES WHAT relay.get ANSWERS (goal/G41.32; Andy: "every row's data, wherever it's visible OR invisible must
// update instantly, and when visible, paint immediately."): its status, owned, claimed, services and roll, all the node's
// own. They change without a row of seen changing, so relayChanged publishes the row again at each moment one can: a stream
// open or closed, a card read, a report, a relay's rename. Only when one did change. The report is not on a row.
const relayFactsSaid = Object.create(null);
function relayFactsOf(row) {
  const known = spirit.requireScript('spirit/peer/relay/key/script.js').byKey(ROOT_DIR, row.publicKey);
  return known && known.url ? hub.relayFacts(peerRouter, known.url) : null;
}
function shadowRow(row) {
  if (!row || row.gone === true || row.relay !== true) return row;
  const facts = relayFactsOf(row);
  if (!facts) return row;
  relayFactsSaid[row.publicKey] = JSON.stringify(facts);
  return Object.assign({}, row, facts);
}
function relayChanged(url) {
  if (!shadowJob) return;
  try {
    const known = spirit.requireScript('spirit/peer/relay/key/script.js').byUrl(ROOT_DIR, url);
    const row = known ? spirit.requireScript('spirit/nodeStore/script.js').open(ROOT_DIR).seen.get(known.key) : null;
    const facts = row ? relayFactsOf(row) : null;
    if (!facts || relayFactsSaid[row.publicKey] === JSON.stringify(facts)) return;
    jobs.ownNews('spirit.contact', 'row', { row: shadowRow(row) });
  } catch (e) { /* the next change publishes again */ }
}
try {
  // A CONTACT ROW IS NEWS OF spirit.contact (goal/G43.20, Q1): { row }, nothing else in it.
  shadowJob = jobs.ownJob('spirit.contact');
  spirit.requireScript('spirit/nodeStore/script.js').open(ROOT_DIR).seen.onChange(function (row) {
    try { jobs.ownNews('spirit.contact', 'row', { row: shadowRow(row) }); } catch (e) { /* the next change publishes again */ }
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
// Declared here, filled at the foot of this file. A relay has no such door and does not load this module.
// THE NODE'S OWN BRANCHES, IN THE NODE (goal/G49.12, box v17; Andy: "spirit/verbTable.js will be deleted, handlers for
// node-branches are already inside the node process"): each branch's handlers, mounted at the foot of this file, are kept
// here by branch and verb, and the door below looks every call up here. No claim and no namespace rules ("Reserved names in
// the namespace are handled by the file system itself and by our naming conventions"), and no argument checks ("verbTables
// "argument" checks will go, and be later replaced by 49.10's architecture"): a handler reads its own arguments.
const loopbackVerbs = (function nodeBranches() {
  const answer = Object.create(null);   // 'branch.verb' -> its (req, res) handler
  const shapes = Object.create(null);   // branch -> {verb: {request, reply}}, the node's half of the flat table
  const folders = Object.create(null);  // branch -> the folder it was mounted with, where its api.js is (goal/G32.3)
  // mount(branch, dir, declarations): a module hands its verbs bare, {stat: {request, reply, handler}}, and its folder; the
  // node gives them the branch's name (Andy, 2026-10-20: "a module shouldn't know who mounted it").
  // A BRANCH WITH NO NODE WORK IS STILL A BRANCH (goal/G49.25): mounted with no verbs, it stands in the tree, empty, so the scan's
  // every trunk branch is found there.
  function mount(branch, dir, declarations) {
    const ns = String(branch || '');
    shapes[ns] = shapes[ns] || {};
    Object.keys(declarations || {}).forEach(function (v) {
      const d = declarations[v];
      answer[ns + '.' + v] = d.handler;
      shapes[ns][v] = { request: d.request, reply: d.reply };
    });
    if (dir) folders[ns] = String(dir);
  }
  function handlerFor(verb) {
    const name = String(verb || '');
    return Object.prototype.hasOwnProperty.call(answer, name) ? answer[name] : null;
  }
  function tree() {
    const out = {};
    Object.keys(shapes).sort().forEach(function (ns) { out[ns] = Object.assign({}, shapes[ns]); });
    return out;
  }
  // The branches mounted here, by name: the names no app may take, since branches and apps sit side by side in one table.
  function namespaces() { return Object.keys(shapes).sort().map(function (ns) { return { namespace: ns }; }); }
  // THE BODY THE DOOR ALREADY READ: serveCommon.readJsonBody keeps its promise on the request, so a second read answers at
  // once (a second reader on the stream would wait for an end that already passed).
  function readBody(rq) { return module.exports.readJsonBody(rq); }
  // ONE CALL, IN-PROCESS (goal/G30.4): the handler a loopback call reaches, called without the network, the args in as
  // its request body and the answer caught off the response; a handler failing at once or later resolves handler-failed, once.
  function call(verb, args) {
    return new Promise(function (resolve) {
      const handler = handlerFor(verb);
      if (!handler) { resolve({ ok: false, status: 400, code: 'no-such-verb', error: 'no such verb', verb: verb }); return; }
      const text = JSON.stringify(args && typeof args === 'object' && !Array.isArray(args) ? args : {});
      const req = require('stream').Readable.from([text]);
      req.headers = { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(text, 'utf8')) };
      let status = 200;
      const res = {
        writeHead: function (code) { status = Number(code) || 200; return res; },
        setHeader: function () {},
        write: function () { return true; },
        end: function (body) {
          let parsed = null;
          try { parsed = JSON.parse(String(body || '')); } catch (e) { parsed = null; }
          resolve({ ok: status < 400, status: status, body: parsed, text: parsed ? undefined : String(body || '') });
        },
      };
      const failed = function () { resolve({ ok: false, status: 500, code: 'handler-failed', error: 'the handler failed', verb: verb }); };
      let ran = null;
      try { ran = handler(req, res); } catch (e) { failed(); return; }
      if (ran && typeof ran.then === 'function') ran.then(null, failed);
    });
  }
  // THE ONE DOOR TO THE FLAT TABLE (goal/G30.4): 'api' is one flat object, this node's branches and its apps' side by side;
  // {branch: {verb: {args}}} runs a node branch through call and hands anything else to the apps. It gates nothing: the gate
  // is apiDoor's. opts.owner() is the caller the owner's own calls carry; opts.branchDir(name) a served app's folder.
  function door(apps, opts) {
    const ownerOf = opts && typeof opts.owner === 'function' ? opts.owner : function () { return { owner: true }; };
    const branchDirOf = opts && typeof opts.branchDir === 'function' ? opts.branchDir : function () { return ''; };
    // A BRANCH'S INTERFACE (goal/G32.3): api {branch} answers {branch, interface}, the text of its api.js.
    function interfaceOf(name) {
      const fam = String(name || '');
      const served = apps && typeof apps.apps === 'function' && apps.apps().indexOf(fam) !== -1;
      const dir = folders[fam] || (served ? branchDirOf(fam) : '');
      let text = null;
      // A new-shape branch's interface is its script.js, beside its client/script.js (goal/G49.15); an old one's its api.js.
      // Which shape is the fs cache's branch flag on the folder's row, never a look at the disc (goal/G49.2: "FROM THE ONE
      // FS DATASET, NEVER FROM THE DISC").
      const fileOf = function (d) {
        const row = spirit.requireScript('spirit/fs/dataset/script.js').file(path.relative(ROOT_DIR, d).split(path.sep).join('/'));
        return row && row.branch === true ? 'script.js' : 'api.js';
      };
      if (dir) { try { text = require('fs').readFileSync(path.join(dir, fileOf(dir)), 'utf8'); } catch (e) { text = null; } }
      if (text === null) return Promise.resolve({ status: 404, body: { ok: false, code: 'no-interface', error: 'no interface for the branch ' + fam } });
      return Promise.resolve({ status: 200, body: { branch: fam, interface: text } });
    }
    function asksInterface(body) {
      return !!body && typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length === 1 && body.api && typeof body.api === 'object' && typeof body.api.branch === 'string';
    }
    const d = {
      ask: function (body, caller) {
        if (asksInterface(body)) return interfaceOf(body.api.branch);
        if (body === 'api') {
          return Promise.resolve(apps && typeof apps.ask === 'function' ? apps.ask('api', caller) : { status: 200, body: {} }).then(function (r) {
            const flat = Object.assign({}, (r && r.body && typeof r.body === 'object') ? r.body : {});
            const own = tree();
            Object.keys(own).forEach(function (ns) { flat[ns] = own[ns]; });
            return { status: 200, body: flat };
          });
        }
        const isObj = body && typeof body === 'object' && !Array.isArray(body);
        const ns = isObj && Object.keys(body).length === 1 ? Object.keys(body)[0] : '';
        if (ns && shapes[ns]) {
          const inner = body[ns];
          if (!inner || typeof inner !== 'object' || Array.isArray(inner) || Object.keys(inner).length !== 1) {
            return Promise.resolve({ status: 400, body: { ok: false, code: 'bad-request', error: 'one verb, as {branch: {verb: {args}}}' } });
          }
          const v = Object.keys(inner)[0];
          return call(ns + '.' + v, inner[v]).then(function (a) {
            return { status: a.status, body: a.body !== null && a.body !== undefined ? a.body : { ok: a.ok, code: a.code, error: a.error || a.text } };
          });
        }
        return Promise.resolve(apps && typeof apps.ask === 'function' ? apps.ask(body, caller) : { status: 404, body: { ok: false, code: 'app-not-served' } });
      },
    };
    // THE DOOR'S OWN FRONT (goal/G30.5): the loopback door (/spirit) asks this for a verb's handler. A node branch's
    // verb keeps its own (req, res) handler; 'api' answers the flat table; 'branch.verb' goes through ask, args the call's
    // own (goal/G41.15). The caller is the owner, on loopback, so its answer is bound by no ANSWER_MAX (goal/G41.28).
    // AN APP'S CALL, BY THE APP'S ID (goal/G49.19, box: "ALL aspects of jobs/processes identify them by the full path of their
    // branch"; "no 'desk' on the wire when it MUST be spirit.app.desk"): an app is served under its folder's path in dots,
    // spirit.app.desk, and a call names the app and then its verb, spirit.app.desk.chat.add. The app is the longest served id
    // the call starts with, followed by a dot; '' when none serves it.
    function servedApp(name) {
      const ids = apps && typeof apps.apps === 'function' ? apps.apps() : [];
      let best = '';
      ids.forEach(function (id) { if (id.length > best.length && name.length > id.length + 1 && name.indexOf(id + '.') === 0) best = id; });
      return best;
    }
    function askOf(name, app, args) {
      const asked = {};
      asked[app] = {};
      asked[app][name.slice(app.length + 1)] = args;
      return asked;
    }
    d.handlerFor = function (verb) {
      const name = String(verb || '');
      const own = handlerFor(name);
      if (own) return own;
      // A branch nobody serves is no verb at all: the door refuses it.
      const app = name === 'api' ? '' : servedApp(name);
      if (name !== 'api' && !app) return null;
      return function (rq, rs) {
        return readBody(rq).then(function (body) {
          const args = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
          let asked = name;
          if (name === 'api' && typeof args.branch === 'string') asked = { api: { branch: args.branch } };
          else if (name !== 'api') asked = askOf(name, app, args);
          const own2 = ownerOf();
          own2.loopback = true;
          return d.ask(asked, own2);
        }).then(function (a) {
          rs.writeHead((a && a.status) || 500, { 'Content-Type': 'application/json; charset=utf-8' });
          rs.end(JSON.stringify(a && a.body !== undefined ? a.body : { ok: false, code: 'handler-failed' }));
        });
      };
    };
    // THE DOOR'S IN-PROCESS CALL (goal/G30.6): what the owner door runs, one verb by name, answered {ok, status, body}; a
    // branch nobody serves is no-such-verb, as the loopback door says it. An app gets the call's arguments as they came.
    d.call = function (verb, args) {
      const name = String(verb || '');
      if (handlerFor(name)) return call(name, args);
      if (name !== 'api' && !d.handlerFor(name)) return Promise.resolve({ ok: false, status: 400, code: 'no-such-verb', error: 'no such verb', verb: name });
      let asked = name;
      if (name === 'api' && args && typeof args.branch === 'string') asked = { api: { branch: args.branch } };
      else if (name !== 'api') asked = askOf(name, servedApp(name), args && typeof args === 'object' && !Array.isArray(args) ? args : {});
      return Promise.resolve(d.ask(asked, ownerOf())).then(function (a) {
        const status = (a && a.status) || 500;
        return { ok: status < 400, status: status, body: a ? a.body : null };
      });
    };
    return d;
  }
  return { mount: mount, call: call, tree: tree, door: door, handlerFor: handlerFor, namespaces: namespaces };
}());
// The flat apiDoor (goal/G30.4), set once the app client exists below; /spirit dispatches through it (goal/G30.5).
let nodeDoor = null;
// This node's face (goal/G30.13), built on nodeDoor once it exists; presence hands it the relay's face events.
let faceHome = null;
// THE DECLARATION FORM (goal/G10.5), MOUNTED (goal/G30.4): each module's verbs are {request, reply, handler},
// declared bare (stat, not fs.stat); loopbackVerbs.mount gives them their family name, and nothing beside them
// (goal/G43.20: no FS set). A module does not know the name it is mounted under
// (Andy, 2026-10-20).
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
// A PAGE'S CONNECT, PASSED ON (goal/G47.5, part 2; Andy: "the node forwards a loopback connect to the as server as a normal
// request", "it will reach the app server with the local node's ID, that's how the app server knows it's loopback"): every
// running server is asked subscribe under this node's own key, naming itself as the family, the existing verb a peer
// reconnects with (spirit/server/app/script.js, pushToPages). Set once the app client is (below); none is waited for.
let pageConnectedTo = null;
const events = spirit.requireScript('spirit/eventEngine/script.js').createEvents({
  jobs: jobs, relayEvents: relayEvents, arrivals: arrivals, renames: hub.contactRenames, pageStreams: pageStreams,
  readJsonBody: function (req) { return readJsonBody(req); }, bodyRefused: bodyRefused,
  pageConnected: function () { if (pageConnectedTo) pageConnectedTo(); },
});

// A FILE, AS THE BROWSER'S GET IS SERVED IT. One function, so the face asking its home node for a file (faceHome,
// goal/G30.13) passes the same gate as the browser on loopback.
function serveGet(pathname, res) {
  // THE ONE STATIC ROUTE (goal/G49.15): serveCommon's, the relay's too.
  common.serveStatic(ROOT_DIR, pathname, res);
}

// THE EVENT STREAM (handleSseConnection) STOOD HERE: it is spirit/eventEngine/script.js, the events family's subscribe.

// THE JOB, FS AND NET HANDLERS STOOD HERE until goal/G49.25: each is its branch's own node work now, spirit/job/server/script.js,
// spirit/fs/server/script.js and spirit/net/server/script.js.

// A BODY THAT WAS NOT READ, SAID FOR WHAT IT IS (goal/G33.10). Andy saw "not saved: Invalid JSON body" for a save that
// was only too large: every catch here named one fault for two. A body refused for its size is 413 and says so, with
// the bytes read; anything else is the bad JSON it always was. json answers the {ok, error} shape a verb answers.
function bodyRefused(req, res, e, json) {
  const big = !!e && e.statusCode === 413;
  const text = big ? 'Body too large: ' + common.bodyBytes(req) + ' of ' + spirit.requireScript('spirit/limits/script.js').BODY_MAX : 'Invalid JSON body';
  res.writeHead(big ? 413 : 400, { 'Content-Type': (json ? 'application/json' : 'text/plain') + '; charset=utf-8' });
  res.end(json ? JSON.stringify({ ok: false, code: big ? 'too-big' : 'bad-request', error: text }) : text);
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
// this box sends neither header and passes. Nothing here names an app: it is where a request came from, which
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

  // THE DEBUG TEST ROUTES FIRST, before every route and the api door (goal/G41.19, spirit/DEBUG/test/script.md): with DEBUG off
  // they answer nothing. The node's api tree is what its door answers to 'api'.
  if (common.debugFirst(req, res, {
    kind: 'node',
    api: function () { return nodeDoor ? nodeDoor.ask('api').then(function (r) { return (r && r.body) || {}; }, function () { return {}; }) : {}; },
  })) return;

  // Too big is answered once, before any route — see serveCommon.js.
  // THE PROXY CARRIES WHAT IT IS GIVEN (2026-09-22). Andy: "no limit on
  // size for proxy request, yes" — the 17 KB bound is the peer packet's,
  // and net.fetch inherited it only by sharing this door, which held a
  // review to four thousand tokens a message. So /spirit is read
  // unbounded and judged once its verb is known (below); every other path
  // is refused here, before routing, as it always was.
  if (String(req.url || '').split('?')[0] !== '/spirit' && common.refuseTooBig(req, res)) return;

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

  // THE RELAY ROUTES STOOD HERE — /spirit/relay/key, the device page and
  // /spirit/relay/stream, with the roll and ring tombstones beside them.
  // A node no longer answers any relay route (cycle 0, Andy 2026-09-19);
  // they are relayServer.js.

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


  // `GET /api/jobs` STOOD HERE and is `job.list` under the one door.
  // A read folding into a POST costs nothing on loopback — there is no
  // cache to honour and no intermediary to be polite to — and it buys
  // the thing the whole fold is for: one place that knows what this node
  // can be asked.

  if (req.method === 'GET') {
    serveGet(pathname, res);
    return;
  }

  if (req.method === 'POST') {
    

    // POST /spirit/relay/claim, /post, /reply AND /device STOOD HERE,
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
    // like any other peer.
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
    //   status             relay.status, gone since (a list is a search,
    //                      puppets/G2: contact.search, relay.get)
    //   who, handle        peer.list, peer.find, gone since: contact.search
    //   contact            peer.acquire
    //   post               peer.post
    //   peer  {action}     contact.block / .unblock / .accept / .label
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
    // DOES NOT: nothing since GET /api/version went (goal/G49.13).
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
    // and nothing on this node answers a path any more except the version
    // (the stream folded too, goal/G40.6, above).
    //
    // WHO ANSWERS WHAT IS NOT DECIDED HERE. A table of verb-to-function
    // stood on this spot for an hour and would have grown to nineteen
    // lines whose only content is a fact the answering module already
    // knows — the same thing said twice, kept in step by remembering,
    // which is what the four post-path doors were.
    //
    // Each module MOUNTS its branch instead (nodeBranches, above), at the foot of
    // this file where their dependencies exist. So this dispatch knows
    // how to find an answer and nothing about what the answers are.
    if (pathname === '/spirit') {
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
        if (['net.fetch', 'spirit.fs.save', 'spirit.fs.load'].indexOf(verb) === -1 && common.bodyBytes(req) > spirit.requireScript('spirit/limits/script.js').BODY_MAX) {
          res.writeHead(413, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Body too large: ' + common.bodyBytes(req) + ' of ' + spirit.requireScript('spirit/limits/script.js').BODY_MAX);
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
        // out, the join news on the spirit job is refreshed, and published only if that changed it (goal/G30.1, box v40).
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
    // `POST /api/job/<id>` and `POST /api/job/<id>/cancel` are
    // `spirit.job.create`, `job.update` and `spirit.job.cancel`, claimed by the
    // jobs module at the foot of this file (job.update is event.publish
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

  // `DELETE /api/job/<id>` STOOD HERE and is `spirit.job.delete` under the one
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
common.refuseListenError(server, port, 'spirit/server/script.js');

// A SIXTY-SECOND INBOX SWEEP STOOD HERE (packet 7) — the personal node
// pulling its own mail off a relay without being asked, so that per-peer
// counters advanced whether or not a chat window was open. Deleted with
// the ring by R8 on 2026-09-15.
//
// The per-peer counters it fed went too, with goal/G43.14 (Andy: "KILL those fields in shadow-roll, KILL the
// functionality, KILL it!").
//
// NOTHING REPLACES IT and nothing should. A node that polls is a node
// asking a relay to have kept something, and a relay keeps nothing
// (decision 0006).

// ── THE NODE'S MACHINE STATE IS ON DISC, OR THERE IS NO NODE (R26) ──
//
//   Andy: "we need no peer review for allowing a database to be used for
//   the shadow roll. That's a decision."
//
// The shadow roll lives in spirit/state/node.db through node:sqlite
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
const nodeStore = spirit.requireScript('spirit/nodeStore/script.js');
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
  const settings = spirit.requireScript('spirit/nodeSettings/script.js').load(ROOT_DIR);
  settings.problems.forEach(function (why) { console.warn('spirit/state/node.json: ' + why); });
}());

// CONTACTS ARE ROWS OF THE ONE TABLE (goal/G40.11), and a row's flags are its marks.

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
  // THE IDENTITY is relayAuth.js's, ensured on its first load (goal/G22.5); an old one is never mended there.
  try { module.exports.ensureFirstRun(ROOT_DIR, { kind: 'node' }); }
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
  // a relay row of node.db's one table since goal/G40.11, where this asserts
  // the one seed row, noderoutes.net, by key.
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
  // Published on the node's own job spirit.contact (goal/G43.20), so
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
  // Built in this file (trafficLog, near the top) rather than inside
  // peerPost so the gate is visible at the one place that knows which kind
  // of process this is. This file is personal-mode only, because the log would hold
  // everybody's messages on a relay — not metadata, the content — and that
  // is the worst thing in the system, not a softer version of the ring
  // 0006 deletes. A guard that only holds while the surrounding code stays
  // where it is, is not a guard: which is why, since cycle 0, a relay is a
  // different startup module that never loads trafficLog.js at all.
  // THE RELAYS' OWN KEYS, pinned on first use (answerRelay.relayKey) and
  // the key a post to each is sealed to. It no longer answers any request:
  // the device-offer it answered was removed by goal/G16.2.
  const answerer = spirit.requireScript('spirit/peer/relay/key/seal/script.js').createAnswerer({
    rootDir: ROOT_DIR,
    // THE RELAY'S CARD, through the router (goal/G22.6). Late-bound: the
    // router is built just below, and nothing asks before it exists.
    askKey: function (url) { return peerRouter.relayKey(url); },
  });

  peerRouter = spirit.requireScript('spirit/peer/post/script.js').createPeerPost({
    rootDir: ROOT_DIR,
    onRelayCard: function (url) { relayChanged(url); },
    request: spirit.requireScript('spirit/hub/script.js').relayRequest,
    // THE QUEUE OUTLIVES THE PROCESS (cycle R16). This is the one peerPost
    // the tree builds; a relay builds none since partnering went (goal/G22.6).
    store: nodeStore.open(ROOT_DIR),
    // Refuses at compose a packet that would not fit once wrapped for a
    // partner (cycle 2, SURFACE §8). No relay wraps one since goal/G22.6,
    // so this bound is stricter than the one door needs (peerPost.js).
    checkTunnel: true,
    // WHO THIS NODE WILL HEAR FROM. The same question listenSet has
    // always answered for the `inbox` read, asked on the path packets
    // actually arrive on — which until now asked nobody.
    //
    // Read per request rather than captured: the address book changes
    // while the process runs, and a node that acquired somebody an hour
    // ago must hear them now.
    door: function (from) {
      return spirit.requireScript('spirit/hub/script.js').frontDoor(ROOT_DIR, from);
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
      const book = spirit.requireScript('spirit/contact/engine/script.js');
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
    // Read per post rather than captured, for the same reason `door`
    // is: a card can arrive, and a key can rotate, while the process
    // runs. Empty means the post is refused — never sent plain.
    sealKeyFor: function (toKey) {
      var row = spirit.requireScript('spirit/contact/engine/script.js').byPublicKey(ROOT_DIR, toKey);
      var fromCard = row && spirit.requireScript('spirit/contact/engine/script.js').sealKeyOf(row);
      if (fromCard) return fromCard;
      return answerer.relaySealKeyByKey ? answerer.relaySealKeyByKey(toKey) : '';
    },
    // And what to write down about a stranger who got through the floor.
    // Separate from the judgement on purpose: the verdict is decided
    // before the budget is checked, the row is written after.
    // EVERY ARRIVAL IS SEEN, whatever the door decides about it; it is no route (goal/G47.1, box v69: "every write of a
    // route (an arrival ...)" goes): the row's lastSeen moves, nothing more.
    noteSeen: function (from, relayUrl) {
      spirit.requireScript('spirit/hub/script.js').shadow(ROOT_DIR).note(from, { rank: spirit.requireScript('spirit/seenPeers/script.js').ARRIVED });
      // AND THE DOT HEARS THE ARRIVAL (goal/G2.9). Andy: "and every incoming request?" — a packet the relay just
      // carried in is that relay saying its sender is there now, the strongest evidence there is; the live table
      // marks the sender at that relay as a broadcast would, and the Contacts dot paints. No unit mounts this
      // closure; it is verified live, a line between the agents' nodes.
      if (peerRouter && relayUrl) {
        try { peerRouter.heard(relayUrl, from); } catch (e) { /* a witness, never a reason to refuse the packet */ }
      }
    },
    remember: function (from, verdict) {
      return spirit.requireScript('spirit/hub/script.js').remember(ROOT_DIR, from, verdict);
    },
    // AND WHERE AN ADMITTED PACKET GOES. The hook has existed since the
    // router landed and had no caller but a test, so until 2026-09-13 a
    // peer's packet was admitted, logged, receipted and dropped — which
    // is the whole reason chat still polled a ring. See arrivals.js,
    // including what it deliberately does NOT do about a packet that
    // arrives while no browser is open.
    onArrival: arrivals.note,
    traffic: trafficLog,
  });

  // ── THE SERVER PROCESSES ON THIS BOX ──────────────────────────────
  //
  // ONE WAY TO START A PROCESS (goal/G13.2, Andy 2026-10-10): jobs.startNodeServers starts every
  // active spirit/app server (goal/G43.12), with the pipe the node names, and appClient knows each by that pipe
  // (register) and knocks on it for the api door. Nothing is loaded into this
  // process, nothing is started by any other branch, and the node opens no door for visitors:
  // a server that wants a port opens its own, and the node is not told.
  // Two branches stood here until then: nodeApps.mountAll, which loaded a shell app with
  // "boots": true into the node with seams of its own, and appClient.startAll, which spawned
  // spirit/server/script.js --app for a manifest with "serves": true; and puppetPost.js, the node's own
  // listener for Caddy, switched on by spirit/state/face.json. All three are gone.
  const appClient = spirit.requireScript('spirit/app/adapter/script.js').createAppClient({
    rootDir: ROOT_DIR,
    log: function (line) { console.log(line); },
    // No app named like a node family: they sit side by side in one flat table (goal/G30.4).
    reserved: function () { return loopbackVerbs.namespaces().map(function (n) { return n.namespace; }); },
  });
  pageConnectedTo = function () {
    let key = '';
    try { key = String(spirit.requireScript('spirit/relayAuth/script.js').loadIdentity(ROOT_DIR).publicKey || ''); } catch (e) { key = ''; }
    if (!key) return;
    appClient.servers().forEach(function (name) {
      Promise.resolve(appClient.ask({ [name]: { subscribe: { branch: name } } }, { key: key })).catch(function () { /* a server down is asked at the next connect */ });
    });
  };
  // THE ONE DOOR TO THE FLAT TABLE (goal/G30.4): this node's families and its apps' side by side. apiDoor (a
  // peer, gated by its grants) and /spirit (the owner, ungated) both ask it; a node family runs in-process
  // through the same handler the loopback door calls (Andy: "1 handler, grant-system covers all").
  nodeDoor = loopbackVerbs.door(appClient, {
    // The owner's own calls carry his key and name (apiAuth/G1.13), so a server tracks his records by key like anybody's.
    owner: function () {
      const me = spirit.requireScript('spirit/relayAuth/script.js').loadIdentity(ROOT_DIR);
      const own = { owner: true, key: me.publicKey };
      if (me.name) own.label = String(me.name);
      return own;
    },
    // A served app's folder, where its api.js is (goal/G32.3), at its top, beside its own <name>.js (goal/G43.27).
    // BY ITS ID, NEVER BY A NAME (goal/G49.19): the app folder of the tree whose path in dots is the id, spirit.app.desk for
    // spirit/app/desk, found among the folders the fs dataset flags app (goal/G49.2: never from the disc); '' for none.
    branchDir: function (id) {
      const files = spirit.requireScript('spirit/fs/dataset/script.js').files();
      const dir = Object.keys(files).filter(function (p) { return files[p].kind === 'folder' && files[p].app === true && spirit.dottedPath(p) === String(id); })[0];
      return dir ? path.join(ROOT_DIR, ...dir.split('/')) : '';
    },
  });
  jobs.startNodeServers(ROOT_DIR, appClient);

  // ── THE OWNER DOOR (puppets/G7, slice 1) ───────────────────────────
  //
  // Silent on a node that is not a puppet (no spirit/state/owner.json naming
  // another key), which is every node but a puppet. On a puppet, a command
  // its owner signed runs through the same handlers the loopback door uses.
  // puppetMode.puppetDoor says the rest.
  // The node builds the answer as a system packet and never reads an
  // app's. It is handed no decoder since goal/G16.5: arrivals.js reads the
  // envelope once and every witness is given what it read.
  {
    const wire = spirit.requireScript('spirit/peer/packet/script.js');
    arrivals.witness(spirit.requireScript('spirit/puppetMode/script.js').puppetDoor({
      rootDir: ROOT_DIR,
      call: function (verb, args) { return nodeDoor.call(verb, args); },
      post: function (relayUrl, toKey, text) { return peerRouter.post(relayUrl, toKey, text); },
      encode: wire.encode,
      auth: spirit.requireScript('spirit/relayAuth/script.js'),
      selfKey: function () {
        return spirit.requireScript('spirit/relayAuth/script.js').loadIdentity(ROOT_DIR).publicKey;
      },
      log: function (line) { console.log(line); },
    }));

    // ── THIS NODE'S FACE (goal/G30.13) ──────────────────────────────────
    //
    // A request from the owner's face runs through the door the puppeteer uses above (nodeDoor.call), a file through
    // the browser's own GET (serveGet); faceStream carries what the loopback shell gets. faceHome.js says the rest.
    faceHome = spirit.requireScript('spirit/faceHome/script.js').createFaceHome({
      call: function (verb, args) { return nodeDoor.call(verb, args); },
      serveFile: function (rel, res) { serveGet('/' + rel, res); },
      // A face's save in parts lands here (goal/G33.10): the work file copied to the target through the save gate.
      saveFrom: function (work, rel) {
        if (!fileSystem.fileWritable(rel)) return { ok: false, reason: 'forbidden' };
        const to = fsPath(ROOT_DIR, rel);
        if (!to) return { ok: false, reason: 'forbidden' };
        const disc = require('fs');
        try { disc.mkdirSync(path.dirname(to), { recursive: true }); disc.copyFileSync(work, to); return { ok: true }; } catch (e) { return { ok: false, reason: 'error' }; }
      },
      identity: function () { return spirit.requireScript('spirit/relayAuth/script.js').loadIdentity(ROOT_DIR); },
      relayKey: function (url) { return relayKeys.pinned(ROOT_DIR, url) || ''; },
      // Whether this node set a face on that relay (goal/G41.30, RC1): the name on the relay's row, the node's own fact.
      faceSet: function (url) { return !!relayKeys.faceOf(ROOT_DIR, url); },
      // 😏 opens the face (goal/G47.4, box v33: faceable "does what own did").
      faceOwned: function (url) { const row = relayKeys.byUrl(ROOT_DIR, url); return !!(row && row.faceable); },
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
    const puppetStream = spirit.requireScript('spirit/puppetStream/script.js').createPuppetStream({
      puppet: spirit.requireScript('spirit/puppetMode/script.js').puppetIn(ROOT_DIR, function () {}),
      route: function (to) { return hub.chooseRoute(peerRouter, to); },
      post: function (relayUrl, toKey, text) { return peerRouter.post(relayUrl, toKey, text); },
      encode: wire.encode,
      log: function (line) { console.log(line); },
    });
    jobs.events.on('job-updated', puppetStream.onJob);

    // ── 'api': A KNOWN SENDER ASKS WHAT THIS NODE'S APPS OFFER ────────
    //
    // appPair/G1.3, a node verb with Andy's yes on it ("yes to all of wsl
    // points"). apiDoor.js says the rest; appClient answers it. Only the
    // front door's 'known' counts.
    arrivals.witness(spirit.requireScript('spirit/peer/door/script.js').createApiDoor({
      servers: nodeDoor,
      // `how` carries a background answer's mark to the queue (fileTransfer goal/G1.3).
      post: function (relayUrl, toKey, text, how) { return peerRouter.post(relayUrl, toKey, text, how); },
      encode: wire.encode,
      isKnown: function (key) { return spirit.requireScript('spirit/hub/script.js').frontDoor(ROOT_DIR, key) === 'known'; },
      // THE GATE'S GRANTS (apiAuth/G1.2, G1.3): a member's paths from node.db, read through apiAuth.js;
      // a store that cannot be read throws, and the gate fails closed.
      auth: spirit.requireScript('spirit/grant/auth/script.js').createApiAuth({ rootDir: ROOT_DIR }),
      log: function (line) { console.log(line); },
    }));

    // ── peerOwnerPost: THE OWNER DOOR'S SENDING END (puppets/G4) ─────
    //
    // This node signing a command for one of its puppets and waiting for
    // the one answer that carries that command's hash. ownerPost.js says
    // which answers are taken. The route is hub's chooseRoute, the same
    // choice every post makes.
    const ownerPost = spirit.requireScript('spirit/ownerPost/script.js').createOwnerPost({
      identity: function () { return spirit.requireScript('spirit/relayAuth/script.js').loadIdentity(ROOT_DIR); },
      auth: spirit.requireScript('spirit/relayAuth/script.js'),
      encode: wire.encode,
      randomId: wire.randomId,
      route: function (to) { return hub.chooseRoute(peerRouter, to); },
      post: function (relayUrl, toKey, text) { return peerRouter.post(relayUrl, toKey, text); },
    });
    arrivals.witness(ownerPost.onArrival);

    // HIS SERVERS' BOX REPORTS, kept in memory and summed per box (G10).
    boxes = spirit.requireScript('spirit/fuckingGarbage/boxes.js').createBoxes({ rootDir: ROOT_DIR });
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
        spirit.requireScript('spirit/hub/script.js').shadow(ROOT_DIR).note(key, { present: what.present === true, seen: what.at });
        return;
      }
      // Its label and presence; where it is (at, url) is no route kept (goal/G47.1).
      spirit.requireScript('spirit/hub/script.js').shadow(ROOT_DIR).note(key, Object.assign({
        rank: spirit.requireScript('spirit/seenPeers/script.js').HOST,
      }, what || {}));
    },
    // A relay stream opened or closed: what is known of that relay has changed.
    onEdge: function (url) {
      relayChanged(url);
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
    // Somebody claiming a seat is news the relay already pushes to its
    // owner (relay.js, ownerEvent('claim')). It is done in onOwnerEvent,
    // below: hub.adoptClaim acquires that one key, on the event itself; no
    // roster sweep runs at boot any more.
    //
    // Nothing waits on it and a failure is silent.
    onRelayEvent: function (ev) {
      relayEvents.note(ev);
      if (ev && ev.kind === 'status') relayChanged(ev.relay);
      // A `kind: 'claim'` branch stood here and never fired: claims arrive
      // as `owner-event` (onOwnerEvent, below), not `relay-event`, since
      // R2 split the two. Adoption lives there now.
    },
    // This node's face (goal/G30.13): the relay's face, face-open and face-close events, answered by faceHome.
    onFace: function (url, data) { if (faceHome) faceHome.request(url, data); },
    onFaceOpen: function (url, data) { if (faceHome) faceHome.open(url, data && data.key); },
    onFaceClose: function (url) { if (faceHome) faceHome.close(url); },
    // A RELAY'S MEMBER ANNOUNCEMENT: ITS LABEL AND PRESENCE, NO ROUTE (goal/G47.1, box v69: "The relay sends no route
    // event after an exchange. Its announcement of a member stays for what the node still uses of it, the member's
    // label and presence, and the node writes no route from it"). Not logged: nobody addressed it to this node.
    // A RELAY MAY IMPROVE WHAT THIS NODE KNOWS ABOUT ITS OWN CONTACTS AND MAY NEVER ADD TO THEM: the label below
    // still keeps that rule. This replaces the ruling "the node must implicitly learn routes at EVERY opportunity".
    onRoute: function (url, body) {
      if (!body || !body.key) return;
      try {
        spirit.requireScript('spirit/hub/script.js').shadow(ROOT_DIR).note(body.key, {
          label: body.label || '',
          rank: spirit.requireScript('spirit/seenPeers/script.js').PROVED,
          // THE WHOLE ROW (R28): a relay announcing a claim or a rename says whether the member is connected right
          // now, and only says so when it is. Silence leaves what the node knew alone.
          present: body.present === true ? true : undefined,
        });
      } catch (e) { /* a cache that will not take a row is not a reason to stop listening */ }

      // AND THE LABEL, ON A ROW THAT ALREADY EXISTS.
      //
      //   Andy: "the (updated) public labels must be part of it."
      //
      // THEIR PUBLIC NAME went into the one table with the note above (goal/G40.11: the book is rows of it), so a
      // relay improving it is that note; the owner's myLabel is untouched.
    },

    onOwnerEvent: function (ev) {
      // A RELAY RENAMED: its card says so, read again, and the row follows (goal/G41.32).
      if (ev && ev.kind === 'relay-renamed' && ev.relay && peerRouter) Promise.resolve(peerRouter.relayKey(ev.relay)).catch(function () { /* the next card says it */ });
      // NOT WRITTEN DOWN (goal/G47.1, Q16; Andy, of the owner-event rows in the traffic log: "ALL OF THEM. KILL THEM.
      // NOBODY READ THAT SHIT, THEY SHOULD NOT EXIST."; "OTHERS CAN WRITE APPS TO SUBSCRIBE TO THAT STREAM AND DUMP THE SHIT
      // INTO THEIR OWN FILE"): the event goes on the stream below and is kept nowhere.

      // A new member of a relay this node owns becomes a contact, on the
      // event itself (hub.adoptClaim — it replaced a roster sweep that read
      // a list no relay may return, 2026-09-19).
      try { hub.adoptClaim(ev); } catch (e) { /* a contact list is not a reason to drop an event */ }
      // A face hears it, and the monitor (onRelayEvent), from relayEvents below (goal/G41.33): every face is a starred one
      // since goal/G43.18.
      return relayEvents.note(ev);
    },
    // WHO EACH RELAY IS, pinned as its stream opens. relayKey asks the
    // relay's card, accepts a key never seen before, and refuses one that
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
  // through this router (goal/G22.6: GET /spirit/relay/key is closed).
  peerRouter.startStreams(spirit.requireScript('spirit/hub/script.js').relayKeyAsk(peerRouter)).catch(() => {});

  // ── THE CLAIMS, WHERE WHAT THEY NEED IS ────────────────────────────
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
  // THE SHAPES ARE WRITTEN BY HAND FROM EACH HANDLER (goal/G10.5, point 4 of the box): a prototype cannot say which keys are
  // optional, so a verb's file in spirit/<namespace>/ carries that in words. Each branch's handlers are its own since goal/G49.25,
  // in spirit/<branch>/server/script.js; what this node hands them is branchNode, below.

  // THE PROXY VERBS WENT WITH goal/G29.20 (proxy.search, get, allow, remove, close, open): the owner's list they kept
  // is gone. proxyVerb stays: it is the plain body-in, answer-out wrapper every group below uses.
  // A RELAY ROW'S VERB, NAMED BY ITS KEY (goal/G49.11): the body as hub.js's relay work reads it, the url the row holds in
  // place of the key. A key naming no relay row is refused here, 404, so no work falls back to a url of its own (join's
  // relay asked last).
  function relayBody(b) {
    const out = Object.assign({}, b || {});
    const row = relayKeys.byKey(ROOT_DIR, out.key || '');
    delete out.key;
    out.url = row ? row.url : '';
    return out;
  }
  function onRelayRow(work) {
    return proxyVerb(function (b) {
      const body = relayBody(b);
      if (!body.url) return { ok: false, status: 404, error: 'no relay on this node under that key' };
      return work(body);
    });
  }
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
  // job.list is gone: a list is a search (puppets/G2, nodeSearches.js).
  // proxyVerb is the plain body-in, answer-out wrapper, whatever the group.
  const nodeSearches = spirit.requireScript('spirit/nodeSearches/script.js').createNodeSearches({ jobs: jobs, rootDir: ROOT_DIR, mimeTypes: spirit.MIME_TYPES });
  // auth (apiAuth/G1.4, its own family since goal/G30.6): the owner's allow-table, loopback only. An answer is the verb's object as is; a refusal is the catalogue's, by name.
  const apiAuth = spirit.requireScript('spirit/grant/auth/script.js').createApiAuth({
    rootDir: ROOT_DIR,
    tree: function () { return nodeDoor.ask('api').then(function (r) { return (r && r.body) || {}; }, function () { return {}; }); },
  });
  // THE BUNDLES ON THE STREAM (goal/G41.14; Andy: "EVERY FUCKING element MUST FUCKING LISTING to anything that changes
  // their data set. and the SHELL's spirit fucking object is supposed to hold ALL cached data, and propagate updates to
  // the fucking elements"): the permanent job 'bundles', published with each changed row of the bundle and branch tables
  // ({ table, row }, and { table, row: { id }, gone: true } for one deleted), as the shadow job publishes each contact
  // row. The bundle and branch list elements take them into the spirit object's data themselves.
  // THE GRANTS ON THE SAME JOB (Andy: "SO THE MOTHERFUCKING GRANS TABLE DOES NOT BUPLISH EITHER????", "FIX THAT FUCKING
  // SHIT NOW"): each grant row given or revoked, { table: 'grant', row }, gone when revoked; the job carries the auth
  // tables' rows, the table names which.
  try {
    // EACH AUTH TABLE'S ROWS ARE NEWS OF ITS OWN BRANCH (goal/G49.21, box v24: the grant, bundle and branch tables each "a new
    // branch"): a change of the grant table on the job spirit.grant, of the bundle table on spirit.bundle, of the branch table on
    // spirit.branch, { table, row, gone }, as each branch's client reads it.
    const TABLE_JOBS = { grant: 'spirit.grant', bundle: 'spirit.bundle', branch: 'spirit.branch' };
    Object.keys(TABLE_JOBS).forEach(function (t) { jobs.ownJob(TABLE_JOBS[t]); });
    apiAuth.onChange(function (change) {
      // EVERY FIELD, EVERY TIME: a job's update merges into what the job holds (jobs.updateJob), so a field left out
      // keeps its last value. Found on cw's face: after one revoke, gone stayed true, and every later grant was taken out.
      const c = change || {};
      const job = TABLE_JOBS[String(c.table || '')];
      if (!job) return;
      const data = { table: String(c.table), row: c.row || {}, gone: c.gone === true };
      try { jobs.ownNews(job, 'row', data); } catch (e) { /* the next change publishes again */ }
    });
    // A CONTACT FORGOTTEN TAKES ITS GRANTS (goal/G47.4, Q3): each the hub revoked is news here as a revoke is.
    hub.grantsRevoked.subscribe(function (g) {
      try { jobs.ownNews('spirit.grant', 'row', { table: 'grant', row: { key: String(g.key), path: String(g.path) }, gone: true }); } catch (e) { /* the next change publishes again */ }
    });
  } catch (e) { /* no job, no stream: the lists still search */ }
  function authVerb(work) {
    return function (rq, rs) {
      const send = function (status, body) {
        rs.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        rs.end(JSON.stringify(body));
      };
      // A REFUSAL SAYS WHY (goal/G10.10; Andy, 2026-10-12: "all refusals everywhere should say why."): the reason in
      // extra.why beside the code's own words.
      const refusal = function (code, why) {
        const e = spirit.requireScript('spirit/error/script.js').byCode(code);
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
  // A NEW-SHAPE BRANCH'S CALLS, CHECKED BY ITS OWN SCRIPT (goal/G49.15, box v23: "the node must use this same script as
  // require to validate incoming requests."): checkedByBranch(name, branch)(verb, handler) checks a call's arguments with
  // spirit.checkArgs against branch.verbs[verb] before the handler runs, and refuses 400 with the check's code. spirit.fs's
  // and spirit.job's alike.
  // A WHOLE MOUNT'S VERBS CHECKED SO (goal/G49.22): each verb's request is its branch script's, and its handler runs behind the check.
  function checkedVerbs(name, branch, verbs) {
    const checkedBy = checkedByBranch(name, branch);
    Object.keys(verbs).forEach(function (v) {
      verbs[v] = Object.assign({}, verbs[v], { request: (branch.verbs && branch.verbs[v]) || verbs[v].request, handler: checkedBy(v, verbs[v].handler) });
    });
    return verbs;
  }
  function checkedByBranch(name, branch) {
    return function (verb, handler) {
      return function (req, res) {
        return readJsonBody(req).then(function (body) {
          const bad = spirit.checkArgs(name + '.' + verb, branch.verbs[verb], body && typeof body === 'object' && !Array.isArray(body) ? body : {});
          if (bad) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, code: bad.code, error: bad.message, argument: bad.argument }));
            return null;
          }
          return handler(req, res);
        }, function () { return handler(req, res); });
      };
    };
  }
  // THE EVENTS FAMILY (goal/G40.6): the node's one dispatcher, owner only like fs. subscribe is a stream (its handler
  // keeps the response open); publish is a process's state or object on its own job, where job.update stood.
  // Since goal/G49.23 (box v22 Part 2) these two are the spirit branch's, mounted with the node's verbs below.
  const SPIRIT_STREAM_VERBS = {
    'subscribe': { request: {}, reply: {}, handler: events.handleSubscribe },
    'publish': { request: { id: '', status: '', data: {}, logMessage: '', app: {} }, reply: JOB, handler: events.handlePublish },
  };

  // THE app FAMILY'S TABLE (goal/G43.2), the plugins in its folder (spirit/app/manager/script.js), handed to the spirit.app branch's
  // node work (spirit/app/server/script.js). The config family, empty since goal/G30.20, is mounted as every trunk branch is.
  const appFamily = spirit.requireScript('spirit/app/manager/script.js').createApp({ rootDir: ROOT_DIR, jobs: jobs });

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
  // THE SPIRIT BRANCH (goal/G49.23, box v22 Part 2: "the node and event branches verbs move into the spirit branch"; "on the wire
  // they are spirit.card, ... spirit.publish, spirit.subscribe; node.* and event.* are gone"): mounted under its path's name,
  // spirit, its folder spirit/ where its <verb>.json stand, each verb's arguments from spirit/script.js (spirit.verbs) and every
  // call checked against them before its handler, which does what it did before.
  // THE TRUNK'S OWN NODE WORK IS THIS SERVER'S (goal/G49.25; Andy: "spirit is always loaded"): spirit's server folder is
  // spirit/server/, so its verbs stay here, handed to serveCommon, which mounts them first, before the scan.
  const rootVerbs = Object.assign(SPIRIT_STREAM_VERBS, {
    'card': { request: {}, reply: { ok: true, name: '', description: '', publicKey: '', descriptionMax: 0 }, handler: function (rq, rs) { hub.handleNodeCard(rq, rs); } },
    // THE NODE'S OWN DEBUG (desk/G2.5), shaped like relay.debug: {debug: {}} reads,
    // {debug: {on}} sets; both answer the state that resulted. "node.debug: yes."
    // RAM only, off at every start.
    'debug': { request: { debug: { on: false } }, reply: { ok: true, debug: false }, handler: proxyVerb(function (b) {
      const d = b && b.debug;
      return { ok: true, debug: spirit.debugLog(d && typeof d.on === 'boolean' ? d.on : undefined) };
    }) },
    'setName': { request: { name: '' }, reply: { ok: true, status: 0, name: '' }, handler: function (rq, rs) { hub.handleNodeName(rq, rs, readJsonBody); } },
    'setDescription': { request: { description: '' }, reply: { ok: true, status: 0, description: '' }, handler: function (rq, rs) {
      hub.handleNodeDescription(rq, rs, readJsonBody);
    } },
    // ROTATE THIS NODE'S CIPHER KEY (cycle-10/R13): nodeCard.rotate says
    // what changes and why there is no grace period. Then the new card goes
    // to every relay at once; the answer says when and to how many. No row is
    // written about it (goal/G47.1, Q16: the owner rows went, "NOBODY READ THAT
    // SHIT"). Reached from Info's rotate-key dialog, behind the shell's
    // two-press button.
    'rotateCipher': { request: {}, reply: { relays: 0, ok: true, at: 0 }, handler: function (rq, rs) {
      readJsonBody(rq).then(function () {
        const said = spirit.requireScript('spirit/nodeCard/script.js').rotate(ROOT_DIR);
        let relays = 0;
        if (said.ok) {
          try { relays = peerRouter ? peerRouter.handOverCardEverywhere() : 0; } catch (e) { relays = 0; }
        }
        rs.writeHead(said.ok ? 200 : said.status, { 'Content-Type': 'application/json; charset=utf-8' });
        rs.end(JSON.stringify(Object.assign({ relays: relays }, said)));
      }).catch(function (e) { bodyRefused(rq, rs, e, true); });
    } },
  });

  // ── WHAT THIS NODE HANDS EVERY BRANCH'S NODE WORK (goal/G49.25, Q5) ──
  //
  // Each trunk branch's handlers stand in its own spirit/<branch>/server/script.js since this item (Andy: "WHY WOULD THE
  // MOTHERFUCKING SERVER LOAD MOTHERFUCKING BRANCHES EXPLICITLY????"), and serveCommon finds them in the fs cache. What they work
  // with is built above, so it is handed over here: the router, the boxes and the puppet sender are made once the node is up, so
  // each is a function asked at every call, as the handlers asked them when they stood here.
  const branchNode = {
    rootDir: ROOT_DIR,
    port: port,
    jobs: jobs,
    hub: hub,
    apiAuth: apiAuth,
    appFamily: appFamily,
    nodeSearches: nodeSearches,
    router: function () { return peerRouter; },
    boxes: function () { return boxes; },
    ownerPost: function () { return peerOwnerPost; },
    readJsonBody: readJsonBody,
    bodyRefused: bodyRefused,
    proxyVerb: proxyVerb,
    authVerb: authVerb,
    relayBody: relayBody,
    onRelayRow: onRelayRow,
    LIST: LIST,
    JOB: JOB,
  };
  // THE BRANCHES LOAD THEMSELVES (goal/G49.25, box v10: "serveCommon will load the spirit.fs branch explicitly, then load all trunk
  // branches, using the fs-cache"; "the existing logic is used to identify both old and new branches and apps"): the trunk's own
  // verbs first (Andy: "spirit is always loaded"), then every spirit/<name> the fs cache marks, old shape or new, each mounted by
  // its name and, when new, checked by its own script; the door below looks every call up in what was mounted.
  common.loadBranches({ rootDir: ROOT_DIR, node: branchNode, mount: loopbackVerbs.mount, check: checkedVerbs, root: rootVerbs });
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
// its event stream to its own browser and can pace THAT reconnect the same way.
// (The second reason, a relay holding outbound streams to partners, went
// with partnering, goal/G22.6.)
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
    try { told += spirit.requireScript('spirit/presence/script.js').sayGoingAway(Array.from(pageStreams), 3000); }
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

// THE JOIN AT START (goal/G30.2): node spirit/server/script.js --email <address>. An unseated node asks its kept relay to join;
// what came of it is printed first, then the listening line (the box: "and then the line it listens on").
const startEmail = common.emailFromArgs(process.argv.slice(2));
// A request Node cannot parse is answered 400, never a reset (goal/G41.30, serveCommon.answerClientErrors).
common.answerClientErrors(server);
server.listen(port, BIND_HOST, () => {
  hub.joinAtStart(startEmail, { router: peerRouter, port: Number(port) || spirit.DEFAULT_SPIRIT_PORT, probe: spirit.requireScript('spirit/hub/script.js').relayKeyAsk(peerRouter) })
    .catch(function (e) { return { lines: ['The join at start broke: ' + ((e && e.message) || e) + '. Join from Contacts instead.'] }; })
    .then(function (r) {
      (r.lines || []).forEach(function (line) { console.log(line); });
      console.log(`node is listening on 127.0.0.1:${port}`);
    });
});
}

// Started, it launches; required, it only hands out its helpers.
if (require.main === module) launch();
