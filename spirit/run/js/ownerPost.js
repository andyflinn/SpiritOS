'use strict';
// spirit/run/js/ownerPost.js
// peerOwnerPost() — THE OWNER DOOR'S SENDING END (puppets/G4).
//
//   Andy: "so node only a peerProxy() function that proxies the entire node
//   api", renamed "peerOwnerPost()" — "it's more true." Shape approved
//   2026-09-27 (design/principles/PUPPETS.md, G4), built on his Go!.
//
// One function on the OWNER's node that sends ONE command to ONE of his
// puppets and hands the caller the puppet's answer:
//
//   {verb, body} is signed with the owner's identity key over the bytes
//   relayAuth.commandMessage builds (recipient key and envelope id inside),
//   wrapped as a system packet addressed to no app, and posted through the
//   node's one relay chooser. The page never signs: "the node handles all
//   the signing. the shell doesn't worry about that."
//
//   The puppet answers with a second packet whose `re` is the command's
//   hash (nodeApps.puppetDoor). THE ANSWER IS TAKEN ONLY IF IT:
//     - carries the hash of a command THIS node sent and is still waiting
//       on ("where a hash must match", transport/R12);
//     - comes from the puppet the command went to, not a sibling;
//     - is the FIRST such answer: a reply answers once;
//     - arrives within the wait. After that the caller has a NAMED
//       timeout, and a late reply is dropped, never handed to whoever asks
//       next (the same rule as the face door's waiting table).
//
// Whatever the puppet answered (ok, not-carried-here, no-such-verb,
// handler-failed, bad command signature) is passed through as it came.
// Refusals from the way there (no route, peer not reachable) come back
// as the post's own answer, so a remote failure keeps its contract.
//
// The node decodes a SYSTEM packet here and never an app's: `decode` is
// handed in as a value, as ownerCommandIn takes it (test/nodeKnowsNoApps.js).

const DEFAULT_WAIT_MS = 20000;

function createOwnerPost(opts) {
  const o = opts || {};
  const setT = o.setTimeout || setTimeout;
  const clearT = o.clearTimeout || clearTimeout;
  const waitMs = Number(o.waitMs) > 0 ? Number(o.waitMs) : DEFAULT_WAIT_MS;
  const waiting = Object.create(null);   // command hash -> { puppet, settle }
  // AN ANSWER CAN BEAT ITS OWN QUESTION'S BOOKKEEPING. wsl-claude, testing
  // this (a45c07b): the command's post and the puppet's answer are separate
  // packets on one stream, so the answer can be handled before post()'s
  // continuation registers the wait. It found no slot and was dropped, and
  // the owner got no-reply-from-puppet for a command that ran. So an answer
  // with no slot yet is held here, briefly, and send() looks here first
  // when it registers. Held answers expire, so a stray one is never kept.
  const early = Object.create(null);     // command hash -> { from, body, at }
  const EARLY_MS = Number(o.earlyMs) > 0 ? Number(o.earlyMs) : 5000;
  const now = o.now || function () { return Date.now(); };

  function send(puppetKey, verb, body) {
    const to = String(puppetKey || '');
    const name = String(verb || '');
    const me = o.identity && o.identity();
    if (!me || !me.privateKey) return Promise.resolve({ ok: false, status: 409, error: 'this node has no key yet' });
    if (!to || !name) return Promise.resolve({ ok: false, status: 400, error: 'to required' });

    const id = o.randomId();
    const cmd = JSON.stringify({ verb: name, body: body || {} });
    const sig = o.auth.sign(me.privateKey, o.auth.commandMessage(me.publicKey, to, id, cmd));
    const made = o.encode('', { cmd: cmd, sig: sig }, { id: id });
    if (!made || !made.text) return Promise.resolve({ ok: false, status: 400, code: 'command-not-packed', error: 'the command could not be packed' });

    const route = o.route(to);
    if (!route || route.unreachable || !route.relayUrl) {
      return Promise.resolve({ ok: false, status: 503, error: 'peer not reachable' });
    }
    return Promise.resolve(o.post(route.relayUrl, to, made.text, route.hints)).then(function (answer) {
      if (!answer || !answer.ok || !answer.hash) return answer || { ok: false, status: 503, error: 'peer not reachable' };
      return new Promise(function (resolve) {
        const hash = String(answer.hash);
        const timer = setT(function () {
          if (!waiting[hash]) return;
          delete waiting[hash];
          resolve({ ok: false, status: 504, code: 'no-reply-from-puppet', error: 'the puppet did not answer in time', hash: hash });
        }, waitMs);
        waiting[hash] = {
          puppet: to,
          settle: function (reply) { clearT(timer); resolve(Object.assign({ hash: hash }, reply)); },
        };
        // The answer may already be here (see `early`). Taken only if it
        // came from this command's puppet, as a late arrival would be.
        const held = early[hash];
        if (held) {
          delete early[hash];
          if (held.from === to && now() - held.at <= EARLY_MS) {
            const slot = waiting[hash];
            delete waiting[hash];
            slot.settle(held.body);
          }
        }
      });
    });
  }

  // Every arrival, straight from arrivals.subscribe. Only a system packet
  // whose `re` names a command still waiting, from that command's puppet,
  // is taken; everything else passes by untouched.
  function onArrival(message) {
    const text = message && typeof message.text === 'string' ? message.text : '';
    if (!text || !o.isEnvelope(text)) return;
    const info = o.decode(text);
    if (!info || info.app || !info.re) return;
    const from = String((message && (message.fromKey || message.from)) || '');
    const slot = waiting[String(info.re)];
    if (!slot) {
      // Possibly early: kept for EARLY_MS, and only the first copy.
      Object.keys(early).forEach(function (h) { if (now() - early[h].at > EARLY_MS) delete early[h]; });
      if (!early[String(info.re)]) {
        early[String(info.re)] = { from: from, at: now(), body: info.body && typeof info.body === 'object' ? info.body : {} };
      }
      return;
    }
    if (from !== slot.puppet) return;
    delete waiting[String(info.re)];
    slot.settle(info.body && typeof info.body === 'object' ? info.body : {});
  }

  return { send: send, onArrival: onArrival };
}

module.exports = { createOwnerPost: createOwnerPost, DEFAULT_WAIT_MS: DEFAULT_WAIT_MS };
