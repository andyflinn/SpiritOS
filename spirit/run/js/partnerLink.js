'use strict';

// spirit/run/js/partnerLink.js
// A RELAY'S HELD STREAMS TO ITS PARTNERS. One each way.
//
//   Andy: "partners are the most permanent presences in practice: they are
//   designed to run indefinitely, browsers are not."
//   Andy: "Both partners must have the mutual sseClients alive in this
//   pass."
//
// ── WHY BOTH DIRECTIONS, AND NOT ONE ─────────────────────────────────
//
// A relay has a public address, so it looks as though one socket would do:
// either end could dial the other when it had something to say. It would
// not, because of what the stream IS in this system — the INBOUND HALF of
// the one interface (AGENT.md, Comms).
//
// A reply leaves a relay through `presentNow.send`, down a stream the
// asker holds. So the stream A holds to B is where B's answers to A land,
// and B's answers can only land there. If only A dialled, B could ask A
// nothing — the partnership would be a one-way mirror, and `search`
// happens to be the verb where that is invisible until somebody tries it
// from the other side.
//
// Two streams, therefore, and they are not redundant: each carries the
// answers to the questions its holder asked.
//
// ── WHAT IT IS NOT ───────────────────────────────────────────────────
//
// Not presence. This file routes `request` and `reply` and drops
// everything else on the floor. A relay does not want B's roster —
// PARTNERS.md's hard rule is that a relay NEVER persists a partner's
// members, and holding them in RAM because they happened to arrive is the
// same mistake with a shorter lifetime.
//
// Not a second transport. `sseClient` is the inbound half and `peerPost`
// owns the outbound; this file opens connections and hands what arrives to
// the router, exactly as presenceNode does for a node. Everything the node
// gained today — backoff, jitter, the idle watchdog, honouring `retry:` —
// applies here with no line of its own, which is the whole reason it was
// worth putting in one place.

const auth = require('./relayAuth');
const sseClient = require('./sseClient');

function streamUrl(relayUrl, key) {
  return String(relayUrl).replace(/\/+$/, '') +
    '/api/relay/stream?key=' + encodeURIComponent(key);
}

// opts: { rootDir, relay, router, connectImpl }
//
// `router` is the relay's own peerPost — the same instance it posts FROM,
// because an outbound request and the answer that matches it must meet in
// the same table. presenceNode learned that the expensive way and says so
// at its own construction.
function createPartnerLinks(opts) {
  opts = opts || {};
  const rootDir = opts.rootDir;
  const relay = opts.relay;
  const router = opts.router;
  const openStream = opts.connectImpl || sseClient.connect;

  if (!relay || typeof relay.partners !== 'function') {
    throw new Error('createPartnerLinks needs the relay it belongs to');
  }
  if (!router || typeof router.onReply !== 'function' || typeof router.onRequest !== 'function') {
    throw new Error(
      'createPartnerLinks needs `router`: a stream is the inbound half of one ' +
      'interface, and a reply arriving here has to settle in the table the ' +
      'post opened. Pass the peerPost this relay posts from.');
  }

  // url -> handle. One per partner: a second open to the same partner
  // would displace the first at the far end and lose whatever was in
  // flight.
  let held = Object.create(null);
  let identity = null;

  function openTo(partner) {
    if (!partner || !partner.url) return;
    if (held[partner.url]) return;

    held[partner.url] = openStream({
      url: streamUrl(partner.url, identity.publicKey),

      // A FUNCTION, not an object, and for the reason sseClient's own
      // header says: a signature computed once and reused for the life of
      // a reconnect loop is a signature that goes stale. Every reconnect
      // signs again.
      //
      // Signed as THIS RELAY, with the relay's own identity. The far end
      // resolves it through partnerIdentity — the pinned key its owner
      // wrote down at promotion — and admits it as a partner, never as a
      // member.
      headers: function () {
        return {
          'X-Spirit-Sig': auth.sign(
            identity.privateKey,
            auth.streamMessage(identity.publicKey)
          ),
        };
      },

      onEvent: function (msg) {
        // REQUEST AND REPLY, AND NOTHING ELSE. A partner's roster is not
        // this relay's to hold, even in RAM, even briefly.
        if (msg.event === 'request') router.onRequest(partner.url, msg.data);
        else if (msg.event === 'reply') router.onReply(msg.data);
      },

      // No forgetting to do: this file holds no state about the partner
      // beyond the socket itself, which is the point of not taking the
      // roster. sseClient reconnects on its own.
      onClose: function () {},
    });
  }

  return {
    // Opens a stream to every partner. Called at boot and again whenever a
    // partnership is added, so a promotion takes effect without a restart.
    start: function () {
      identity = auth.loadIdentity(rootDir);
      if (!identity || !identity.privateKey) return 0;
      const list = relay.partners() || [];
      list.forEach(openTo);
      return Object.keys(held).length;
    },

    // Which partners this relay currently holds a stream to. The honest
    // answer to "is the partnership alive", and the thing a two-relay test
    // reads to know both halves came up.
    held: function () { return Object.keys(held); },

    stop: function () {
      Object.keys(held).forEach(function (url) {
        try { held[url].close(); } catch (e) { /* already gone */ }
      });
      held = Object.create(null);
    },
  };
}

module.exports = { createPartnerLinks: createPartnerLinks };
