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
//
// A relay spawns no jobs, and runs it anyway: the check predates the
// split, and a relay started from the wrong place was refused before it.
function verifyStartupCwd(entry) {
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

// The connection's own address, used only as a rate-limiting bucket key —
// never as authority for anything. Rate limits used to key on the name in
// the request body, which the sender chooses, so rotating it reset the
// budget; this is the one thing about a request the caller can't restate
// at will.
function clientKeyFor(req) {
  return req.socket.remoteAddress || '';
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
function deviceRefusal(res, status) {
  res.writeHead(status || 403, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'not now', code: 'device-not-now' }));
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

module.exports = {
  verifyStartupCwd: verifyStartupCwd,
  portFromArgs: portFromArgs,
  sendFile: sendFile,
  readJsonBody: readJsonBody,
  clientKeyFor: clientKeyFor,
  deviceRefusal: deviceRefusal,
  refuseTooBig: refuseTooBig,
  parseRequestPath: parseRequestPath,
  sendVersion: sendVersion,
  refuseListenError: refuseListenError,
};
