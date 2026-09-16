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
function relayRequest(relayUrl, method, pathname, bodyObj, extraHeaders) {
  return new Promise(function (resolve, reject) {
    var target;
    try { target = assertRelayUrl(relayUrl + pathname); }
    catch (e) { reject(e); return; }
    var payload = bodyObj == null ? '' : JSON.stringify(bodyObj);
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
      var chunks = '';
      res.on('data', function (c) { chunks += c; });
      res.on('end', function () {
        resolve({ status: res.statusCode, text: chunks });
      });
    });
    req.on('error', reject);
    req.end(payload);
  });
}

module.exports = {
  relayRequest: relayRequest,
  assertRelayUrl: assertRelayUrl,
  isLoopbackHost: isLoopbackHost,
};
