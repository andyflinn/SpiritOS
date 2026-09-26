'use strict';

// spirit/test/monitorWorld.js
// A RELAY WITH AN OWNER WATCHING IT — the fixture, in one place.
//
// EXTRACTED RATHER THAN COPIED. relayMonitor.js had built this and it is
// what cycle 10's R12 needs too: a claimed relay, two members, and the
// owner holding a stream. A second copy would have been the FIFTH
// hand-rolled relay fixture in this directory (peerPost.js,
// answerRelay.js, queueRestart.js, appShellGrant.js each grew their own),
// and the week's whole argument is that a job solved twice in two places
// is the defect the wire probe exists to find.
//
// NOT A SUITE. It asserts nothing; it builds a world and hands it over.

const os = require('os');
const fs = require('fs');
const path = require('path');
const { sealFor, sealedPost, openBody } = require('./openReply');
const nodeCard = require('../run/js/nodeCard');
const auth = require('../run/js/relayAuth');
const createRelay = require('../run/js/relay');

function sinkFor(bag) {
  return {
    write: function (chunk) {
      const ev = /^event: (.+)$/m.exec(String(chunk));
      const da = /^data: (.+)$/m.exec(String(chunk));
      if (!ev) return;
      let parsed = null;
      try { parsed = da ? JSON.parse(da[1]) : null; } catch (e) { parsed = null; }
      bag.push({ event: ev[1], data: parsed });
    },
    close: function () {},
  };
}

function world() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-monitor-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay'));

  const owner = auth.generateIdentity('andy');
  const bella = auth.generateIdentity('bella');
  const carl = auth.generateIdentity('carl');
  auth.writeAllowKeys(home, [{ name: 'andy', publicKey: owner.publicKey }]);

  const box = createRelay.createRelay(home);
  // WITH A CARD (cycle 10, R5): the relay seals its answers to the key
  // on it, and the owner is the one member who must always be answerable.
  box.claim('andy', auth.sign(owner.privateKey, auth.claimMessage('andy')), owner.publicKey,
    null, null, null, nodeCard.cardFrom(Object.assign({ name: 'andy' }, owner)));

  // The real way on, for the same reason relayStatus.js does it: a
  // fixture that writes the row directly proves the delivery rule against
  // a relay nobody could have joined.
  [['bella', bella], ['carl', carl]].forEach(function (pair) {
    const minted = box.mint('andy', pair[0], 7, '');
    box.claim(pair[0], auth.sign(pair[1].privateKey, auth.claimMessage(pair[0])),
      pair[1].publicKey, null, minted.invite.token, pair[0],
      nodeCard.cardFrom(Object.assign({ name: pair[0] }, pair[1])));
  });

  const heard = { andy: [], bella: [] };
  box.streamOpen(owner.publicKey, auth.sign(owner.privateKey, auth.streamMessage(owner.publicKey)), sinkFor(heard.andy));
  box.streamOpen(bella.publicKey, auth.sign(bella.privateKey, auth.streamMessage(bella.publicKey)), sinkFor(heard.bella));

  return { home: home, box: box, owner: owner, bella: bella, carl: carl, heard: heard };
}

function post(w, from, to, text) {
  const body = sealedPost(from, to, text);
  return w.box.routePost(body.from, body.to, body.text, body.sig);
}

function events(bag) {
  return bag.filter(function (m) { return m.event === 'relay-event'; });
}

// ASKED FOR AS A PACKET, because there is no other way to ask.
//
// This helper is the whole of decision 0010's first collapse: a verb that
// had its own route and its own signed format is now a post addressed to
// the relay, indistinguishable on the wire from a post to a person.
//
// Note what it does NOT take: a signature of its own. The post's carries
// it, over bytes that already bind sender, recipient and this exact text.
function askMonitor(w, who, on, filter) {
  const packet = JSON.stringify({
    app: 'relay', v: 1, body: { monitor: { on: !!on, filter: filter || null } },
  });
  const relayKey = w.box.relayPublicKey();
  const asker = who || w.owner;
  // SEALED TO THE RELAY, like every owner verb now (cycle 10, R9), and
  // signed over the bytes that travel (cycle 10's R11).
  const sending = sealFor(asker, w.box, packet);
  return w.box.routePost(asker.publicKey, relayKey, sending,
    auth.sign(asker.privateKey,
      auth.postMessage(asker.publicKey, relayKey, sending)));
}

// ── THE SAME, FOR THE DEBUG SWITCH ──────────────────────────────────
//
// One verb that READS and SETS, so a suite can establish its own
// precondition instead of trusting that something flipped it — which is
// what Andy's "returned and set by owner-only api" buys. Omit `on` to
// read; pass it to set and read the state that resulted.
//
// Beside askMonitor rather than inside the suite, because both are the
// same shape — an owner verb sealed to the relay and signed over the
// bytes that travel — and a second way of asking would be a second thing
// to keep right.
function askDebug(w, who, on) {
  const packet = JSON.stringify({
    app: 'relay', v: 1, body: { debug: on === undefined ? {} : { on: !!on } },
  });
  const relayKey = w.box.relayPublicKey();
  const asker = who || w.owner;
  const sending = sealFor(asker, w.box, packet);
  return w.box.routePost(asker.publicKey, relayKey, sending,
    auth.sign(asker.privateKey, auth.postMessage(asker.publicKey, relayKey, sending)));
}

// AN OWNER VERB'S ANSWER COMES BACK ON THE STREAM, not from routePost —
// which returns 202 "accepted" and a hash. A suite that reads the return
// value instead sees `null` and concludes the verb did nothing, which is
// the wrong answer arrived at honestly; it cost one debugging session.
function replies(w, who, from) {
  const asker = who || w.owner;
  const bag = asker === w.bella ? w.heard.bella : w.heard.andy;
  return bag.slice(from || 0)
    .filter(function (m) { return m.event === 'reply' && m.data && m.data.text; })
    .map(function (m) { return openBody(asker, w.box.relayPublicKey(), m.data.text); })
    .filter(Boolean);
}

module.exports = {
  askDebug: askDebug,
  replies: replies,
  sinkFor: sinkFor,
  world: world,
  post: post,
  events: events,
  askMonitor: askMonitor,
};
