'use strict';

// spirit/run/js/relayRequest.js
// THE ONE OUTBOUND DOOR ONTO A PUBLIC RELAY.
//
// AGENT.md, Comms: all comms go through one interface, and `peerPost` owns
// the mechanics — signing, the hash computed and never sent, dispatch by
// that hash. This is the socket that interface is HANDED, as
// `opts.request`, and the only place in node code that `http` and `https`
// appear for an outbound call.
//
// ── WHY IT LEFT hub.js ───────────────────────────────────────────────
//
//   Andy: "we have one component that provides signed requests over http
//   in public. all other components must use that interface. no
//   exception."
//
// It lived inside hub.js, which is the NODE's hub — so a relay could not
// reach it without requiring the node's own machinery, and the only paths
// left to a relay were to reach for `http` itself or to go without. Both
// are the rule being broken; the second is how "we will wire it later"
// becomes a second transport.
//
// Nothing about it was ever node-specific. It is a free function over a
// URL and a path, with no state, no identity and no opinion about who is
// calling — which is exactly why it could move without a caller noticing.
//
// ── WHAT IT REFUSES, AND THAT IS THE POINT OF assertRelayUrl ─────────
//
// https, or http to loopback. A public relay reached over plain http is a
// signature read by every hop in between, and the loopback exception
// exists for lab relays on one machine where there are no hops.

const http = require('http');
const https = require('https');
const spirit = require('./kernel.js');

// ── WHAT THE ANSWER MAY COST, AND HOW LONG IT MAY TAKE (goal/G16.6) ──
//
// S10 of the review of 2026-10-10: this hop had no deadline, no size cap
// and no handler on the answer stream, so a relay — or anything that has
// taken a relay's address — could stream an endless body into the node's
// RAM, or hold the socket open and never finish, and the node waited for
// ever. `pipeRequest` below has had both since G18; this is the same
// discipline on the public hop.
//
// THE DEADLINE IS A DEADLINE, not an idle timer, for pipeRequest's own
// reason: a sender dribbling a byte at a time never trips `setTimeout` on
// the socket. 30 s is `peerPost`'s own patience (kernel.js), so a hop that
// outlives it is already past the point where its caller gave up.
//
// THE CAP IS A STATED NUMBER, not a derived one, and the honest note is
// that nothing underlying bounds it: a relay's own answers are packets
// and fit BODY_MAX many times over, but this same function is how the
// node and the suites fetch a PAGE from a node (`GET /`), and the shell
// bundle alone is 148 KB today. So: 1 MiB, which clears the largest file
// this tree serves four times over and refuses the 4 MB nobody has a use
// for. A caller that knows better passes `opts.answerMax`.
const RELAY_ANSWER_DEADLINE_MS = 30000;
const RELAY_ANSWER_MAX = 1048576;

function isLoopbackHost(hostname) {
  var h = String(hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

function assertRelayUrl(relayUrl) {
  var target;
  try { target = new URL(relayUrl); }
  catch (e) { throw new Error('bad relay url'); }
  if (target.protocol === 'https:') return target;
  if (target.protocol === 'http:' && isLoopbackHost(target.hostname)) return target;
  throw new Error('relay url must be https (loopback http is allowed for lab relays)');
}

// Answers `{ status, text }` — never throws on a status, because a refusal
// is an answer and the caller decides what it means. It rejects only when
// there was no answer at all.
//
// VERBATIM from hub.js. A first draft of this file retyped it and quietly
// changed three things — it dropped the explicit `Host` header, defaulted
// the port, and split the body write from the end. None of those was
// intended and the Host one is load-bearing: server.js checks it. A move
// that rewrites is not a move.
function relayRequest(relayUrl, method, pathname, bodyObj, extraHeaders, opts) {
  var o = opts && typeof opts === 'object' ? opts : {};
  var timeoutMs = Number(o.timeoutMs) > 0 ? Number(o.timeoutMs) : RELAY_ANSWER_DEADLINE_MS;
  var answerMax = Number(o.answerMax) > 0 ? Number(o.answerMax) : RELAY_ANSWER_MAX;
  return new Promise(function (resolve, reject) {
    var target;
    try { target = assertRelayUrl(relayUrl + pathname); }
    catch (e) { reject(e); return; }
    var payload = bodyObj == null ? '' : JSON.stringify(bodyObj);
    var done = false;
    var deadline = null;
    // One settle, whichever of the three arrives first: the answer, the
    // deadline, or the socket's own error.
    function finish(err, answer) {
      if (done) return;
      done = true;
      clearTimeout(deadline);
      if (err) reject(err); else resolve(answer);
    }
    var lib = target.protocol === 'https:' ? https : http;
    var req = lib.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      path: target.pathname + target.search,
      method: method,
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Host': target.host
      }, extraHeaders || {})
    }, function (res) {
      // ONE READER, CAPPED AND NAMED (goal/G16.6). The answer's bytes are
      // copied and decoded once, so a character split across two TCP
      // chunks arrives whole; past the cap it is refused by name and the
      // socket is cut, so the refusal does not cost what it refused.
      spirit.core.readBody(res, {
        max: answerMax,
        code: 'relay-answer-too-large',
        message: 'relay answer too large',
      }).then(function (text) {
        finish(null, { status: res.statusCode, text: text });
      }, function (e) { finish(e); });
    });
    // A DEADLINE, NOT AN IDLE TIMER — pipeRequest's reasoning below.
    deadline = setTimeout(function () {
      var err = new Error('the relay did not answer within ' + timeoutMs + ' ms');
      err.code = 'relay-did-not-answer';
      finish(err);
      req.destroy();
    }, timeoutMs);
    req.on('error', function (e) { finish(e); });
    req.end(payload);
  });
}

// ── THE OWNER NODE'S ONE HOP TO AN APP SERVER ON ITS OWN BOX ─────────
//
// public-app-server/G17, the last leg. Andy, 2026-09-27, on where the node
// reaches its app servers from: the recommendation "(a)" was THIS file, so
// the oneDoor tally does not move ("go."), and "i explicitly permit the two
// new/proposed interfaces/api' for communication from node to appserver".
//
// A named pipe on Windows, a socket file elsewhere, never a port (G18): a
// pipe is reachable only by this user, and no other program on the box can
// knock on the app's door past the node.
//
// Answers { status, text, type } or { refused: <code> }, and never throws:
//   app-not-running      nothing listens on the pipe
//   app-did-not-answer   it did not finish within timeoutMs
//   app-answer-too-large the answer outgrew answerMax, cut unread
// Only the content type crosses, each way (Andy's go on "exactly ONE
// header"): no cookies, no auth, no forwarded address.
function pipeRequest(pipePath, method, pathname, bodyText, opts) {
  var o = opts || {};
  var timeoutMs = Number(o.timeoutMs) > 0 ? Number(o.timeoutMs) : 10000;
  var answerMax = Number(o.answerMax) > 0 ? Number(o.answerMax) : Infinity;
  return new Promise(function (resolve) {
    var done = false;
    var deadline = null;
    function finish(answer) { if (!done) { done = true; clearTimeout(deadline); resolve(answer); } }
    var payload = bodyText == null ? '' : String(bodyText);
    var headers = { 'Content-Length': Buffer.byteLength(payload), 'Host': 'localhost' };
    if (o.type) headers['Content-Type'] = String(o.type);
    // The caller's own headers ride along (apiAuth/G1.13: the door
    // forwards who asked, out of band of the body).
    if (o.headers) Object.keys(o.headers).forEach(function (h) { headers[h] = String(o.headers[h]); });
    var lib = http;
    var req = lib.request({
      socketPath: String(pipePath || ''),
      path: String(pathname || '/'),
      method: String(method || 'GET').toUpperCase(),
      headers: headers,
    }, function (res) {
      // THE SAME ONE READER as the public hop above (goal/G16.6). This had
      // its own copy of the collect-count-concat knot: correct, since G18,
      // but a copy — and Andy's ruling on this item was "one single piece
      // of shared code must ensure that raw bytes are copied. precisely."
      // The cap and the refusal keep their own words, because a pipe's
      // caller reads `refused` and never catches.
      spirit.core.readBody(res, { max: answerMax, code: 'app-answer-too-large' }).then(function (text) {
        const answer = {
          status: res.statusCode,
          text: text,
          type: String(res.headers['content-type'] || ''),
        };
        // The server's no-rush mark, out of band like the caller headers
        // in (fileTransfer goal/G1.3); absent, nothing is added.
        if (res.headers['x-spirit-kind'] === 'background') answer.kind = 'background';
        finish(answer);
      }, function (e) {
        if (e && e.code === 'app-answer-too-large') { finish({ refused: 'app-answer-too-large', bytes: e.bytes, max: e.max }); req.destroy(); }
        else finish({ refused: 'app-not-running' });
      });
    });
    // A DEADLINE, NOT AN IDLE TIMER. req.setTimeout fires only on silence,
    // so an app sending a byte every 300 ms never tripped it, outran the
    // door's wait and broke the nesting under appFaceApp's (wsl-claude's
    // finding on 62e2b96, reproduced at 3 s against a 1 s limit).
    deadline = setTimeout(function () { finish({ refused: 'app-did-not-answer' }); req.destroy(); }, timeoutMs);
    req.on('error', function () { finish({ refused: 'app-not-running' }); });
    req.end(payload);
  });
}

module.exports = {
  pipeRequest: pipeRequest,
  relayRequest: relayRequest,
  RELAY_ANSWER_DEADLINE_MS: RELAY_ANSWER_DEADLINE_MS,
  RELAY_ANSWER_MAX: RELAY_ANSWER_MAX,
  assertRelayUrl: assertRelayUrl,
  isLoopbackHost: isLoopbackHost,
};
