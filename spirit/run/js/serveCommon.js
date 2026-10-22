// ── WHAT BOTH SERVERS NEED, AND NOTHING EITHER ONE OWNS ──────────────
//
// Cycle 0 (design/principles/NODE-AND-RELAY.md, 2026-09-19): the node and
// the relay became separate startup modules — js/server.js and
// js/relayServer.js — so a relay stops loading node code at all. What is
// here is what both of them answer HTTP with: reading a body, sending a
// file, refusing too big or malformed, saying which build this is.
//
// It requires no transport. Each entry point makes its own server
// (oneDoor.js counts that); this module only handles the requests they
// hand it.
'use strict';

const fs = require('fs');
const path = require('path');
const spirit = require('./kernel');
const limits = require('./limits.js');

const MIME_TYPES = spirit.core.const.MIME_TYPES;

// Job spawning (jobs.js's startProcessJob) passes relative script paths
// like "process/js/imageStats/imageStats.js" straight to
// child_process.spawn without ever setting an explicit cwd, so it
// inherits whatever directory THIS process was started from. Every other
// path in the app is resolved off ROOT_DIR (__dirname-relative, always
// correct) — this is the one place actual process.cwd() matters, and
// starting the server from the wrong place (e.g. `cd js && node
// server.js` instead of `node js/server.js` from spirit/run) breaks job
// spawning silently: scripts fail in well under a second with no useful
// error, easy to mistake for a real bug in the spawned script itself.
// Fail loud and immediately instead.
//
// A relay spawns no jobs and loads neither shell/ nor process/, so it
// must not be refused for lacking them (goal/G16.9): each entry point
// names the folders IT needs, and the default is only js/, which both
// run from. The node passes its own longer list (server.js).
function verifyStartupCwd(entry, requiredDirs) {
  var cwd = process.cwd();
  var errors = [];

  var needed = Array.isArray(requiredDirs) && requiredDirs.length ? requiredDirs : ['js'];
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
  // happens to also have app/js/process children.
  if (path.basename(path.dirname(cwd)) !== 'spirit') {
    errors.push('expected the current directory\'s parent to be named "spirit" (i.e. running from spirit/run), but it\'s "' + path.basename(path.dirname(cwd)) + '"');
  }

  if (errors.length > 0) {
    console.error(
      'Refusing to start: ' + errors.join('; ') + '. Current directory: ' + cwd + '\n' +
      'Job spawning resolves script paths relative to wherever this process was started from — ' +
      'run this as `node ' + (entry || 'js/server.js') + '` from spirit/run, not from inside js/.'
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
    // face.html, served by the home node too, carries the spirit object inline (goal/G32.1).
    if (path.basename(filePath) === 'face.html') { res.end(inlineSpirit(data.toString('utf8'), path.dirname(filePath))); return; }
    res.end(data);
  });
}

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
const BODY_BYTES = Symbol('bodyBytes');

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
// `opts.max` lifts the bound for ONE caller that has decided it may: the
// node's own door, which reads before it knows the verb and then applies
// BODY_MAX to every verb but net.fetch (server.js, 2026-09-22). Everybody
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
    spirit.core.readBody(req, {
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
// Wrong password, a node that is not connected, a node that took the
// offer and went quiet — all of it comes back as `not now`. A form that
// distinguished them would answer questions nobody standing at it is
// entitled to ask: "is this the right password but the wrong moment" is
// exactly what a caller with the wrong password wants to know.
//
// The STATUS still varies, and only for the rate limit — 429, which the
// page waits out rather than gives up on. The STRING never varies
// (DEVICE-CYCLE3.md).
// "not now" stays the sentence — Grok's review: "Do not drop "not now" to a
// code-only body" — and the code rides beside it (R36 phase B).
function nodeRefusal(res, status) {
  res.writeHead(status || 403, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'not now', code: 'node-not-now' }));
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
// Returns { url, pathname }, or null when it has answered 400.
function parseRequestPath(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    return { url: url, pathname: decodeURIComponent(url.pathname) };
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad request: malformed request path');
    return null;
  }
}

// Answers in both modes and needs nothing. `startedAt` rides along
// because "which commit" and "since when" are the two halves of the
// same question: a matching commit with an old start time means the
// code landed and nothing picked it up.
function sendVersion(res, build, startedAt, isRelay) {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    version: spirit.core.const.VERSION,
    commit: build.commit,
    dirty: build.dirty,
    committedAt: build.at,
    source: build.source,
    // Only ever non-zero on a COPIED tree, and then it is a warning
    // about this very process: files existed that a copy could not
    // carry, so something it needs may simply not be here.
    untracked: build.untracked || 0,
    startedAt: startedAt,
    relay: !!isRelay,
  }));
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
// not a caption), becomes 'relay' and its key tail (kernel keyTail), so no two relays read alike by default.
function firstDescription(kind, now) {
  const at = (now instanceof Date ? now : new Date()).toISOString();
  // 2026-09-17T14:23:07.123Z -> 2026-09-17 14:23:07 UTC
  return 'this ' + kind + ' described for the first time ' + at.slice(0, 10) + ' ' + at.slice(11, 19) + ' UTC';
}
function ensureFirstRun(rootDir, opts) {
  const auth = require('./relayAuth');
  const kind = opts && opts.kind === 'relay' ? 'relay' : 'node';
  const id = auth.loadIdentity(rootDir);
  if (!id || !id.publicKey) return null;
  // Through the ordinary setter, so the one thing written without a human present obeys every rule a human's would.
  if (!String(id.description || '').trim()) auth.setDescription(rootDir, firstDescription(kind, opts && opts.now));
  if (kind === 'relay') {
    const now = auth.loadIdentity(rootDir);
    const name = String(now.name || '').trim();
    if (!name || name === 'relay') auth.saveIdentity(rootDir, Object.assign({}, now, { name: 'relay ' + spirit.keyTail(now.publicKey) }));
  }
  return auth.loadIdentity(rootDir);
}

// THE SPIRIT OBJECT, INLINE AND FIRST (goal/G32.1; Andy: "the very first script it serves should be right in a script
// tab in the very only html file it servers"): face.html marks the place with <!-- spirit.js -->, and whoever serves the
// page, the relay or the home node, puts face/spirit.js there inline. One source, so the page and a server process run
// the same file.
function inlineSpirit(html, runDir) {
  let src = '';
  try { src = require('fs').readFileSync(require('path').join(runDir, 'face', 'spirit.js'), 'utf8'); } catch (e) { return html; }
  // A '</script' inside the source would end the tag early.
  const safe = src.replace(/<\/script/gi, '<\\/script');
  return String(html).replace('<!-- spirit.js -->', function () { return '<script>\n' + safe + '\n</script>'; });
}

module.exports = {
  inlineSpirit: inlineSpirit,
  ensureFirstRun: ensureFirstRun,
  firstDescription: firstDescription,
  bodyBytes: bodyBytes,
  verifyStartupCwd: verifyStartupCwd,
  portFromArgs: portFromArgs,
  emailFromArgs: emailFromArgs,
  sendFile: sendFile,
  readJsonBody: readJsonBody,
  clientKeyFor: clientKeyFor,
  nodeRefusal: nodeRefusal,
  refuseTooBig: refuseTooBig,
  parseRequestPath: parseRequestPath,
  sendVersion: sendVersion,
  refuseListenError: refuseListenError,
};
