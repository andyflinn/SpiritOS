'use strict';

// spirit/run/js/apiDoor.js
// A MEMBER ASKS THE NODE FOR 'api' — appPair/G1.3.
//
//   Andy, 2026-09-28: "peerPost is the wire to the api introspection", and
//   his yes on the verb itself, "yes to all of wsl points" (Desk, appPair/G1:
//   the node's 'api' verb over peerPost). A NEW NODE VERB: changing it needs
//   peer review and his yes again (CLAUDE.md, "You do not").
//
// An arrivals witness, as puppetDoor and appFaceApp are: it reads packets
// of app 'api' only, so app-less ones stay puppetDoor's. The body is 'api'
// or {app: {verb: {args}}} (D10); the node's appClient answers it
// (appClient.ask), and the answer goes back to the asker as a packet of app
// 'api' that answers the ask's hash, flat, exactly as it came (D11).
//
// ONLY A KNOWN SENDER IS ANSWERED. The front door admits a stranger when
// the node's policy is 'acquire' (hub.frontDoor), and that admission does
// not reach here: Andy, "why not just an exemption for aquire?". So isKnown
// is the front door's 'known' alone, and a stranger gets no reply at all.
// Gating by who asks, leaf by leaf, is deferred and missing on purpose (D5).

// THE ONE WAY IN (desk/G1 D4): a member's packet here and the local shell's
// jobs.api on the loopback door both end in this, so the gating layer that
// is deferred (appPair D5) has one place to go.
function answer(servers, ask) {
  return Promise.resolve(servers.ask(ask));
}

// opts: { servers: {ask}, post(relay, toKey, text), encode, decode, isKnown(key), log }
function asksDebug(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  return Object.keys(body).some(function (app) {
    const v = body[app];
    return v && typeof v === 'object' && Object.prototype.hasOwnProperty.call(v, 'DEBUG');
  });
}

function createApiDoor(opts) {
  const o = opts || {};
  const say = o.log || function () {};

  function reply(message, answer) {
    let made = o.encode('api', answer, { re: message.hash });
    // Too big for a packet is said, never dropped, as puppetDoor does.
    if (!made || !made.text) {
      made = o.encode('api', { ok: false, code: 'answer-too-large', error: 'answer too large for a packet' }, { re: message.hash });
      if (!made || !made.text) return Promise.resolve();
    }
    return Promise.resolve(o.post(message.relay || '', message.fromKey, made.text)).catch(function (e) {
      say('api door: the answer to ' + String(message.hash).slice(0, 8) + ' could not be sent: ' + e.message);
    });
  }

  return function (message) {
    if (!message || typeof message.text !== 'string') return;
    let info = null;
    try { info = o.decode(message.text); } catch (e) { info = null; }
    if (!info || info.app !== 'api') return;
    // AN ANSWER IS NEVER ASKED. A packet carrying 're' is a reply, and
    // answering it made two nodes (or one asking itself) answer each other
    // forever, about 9 a second (wsl-claude's hand check on a857b52).
    if (info.re) return;
    if (!o.isKnown(message.fromKey)) return;
    // 'DEBUG verb is never allowed through peerPost()' (Andy, desk/G2.5): a member's ask for any
    // server's DEBUG is refused here, by name, and never passed on. jobs.api (answer) still reaches it.
    if (asksDebug(info.body)) return reply(message, { ok: false, code: 'not-owner', error: 'DEBUG is for the owner, on loopback only' });
    return answer(o.servers, info.body).then(function (r) {
      return reply(message, r ? r.body : null);
    }, function (e) {
      say('api door: ' + e.message);
    });
  };
}

module.exports = { createApiDoor: createApiDoor, answer: answer };
