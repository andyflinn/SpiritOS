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
const { sealFor, sealedPost } = require('./openReply');
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

module.exports = {
  sinkFor: sinkFor,
  world: world,
  post: post,
  events: events,
  askMonitor: askMonitor,
};
