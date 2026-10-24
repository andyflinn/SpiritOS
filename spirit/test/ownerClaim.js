'use strict';

// spirit/test/ownerClaim.js
// AN OWNED RELAY, THE WAY A RELAY NOW GETS ITS OWNER — for suites only.
//
// goal/G16.8: a relay is owned at install time and in no other way. On a
// real box bash/install-units writes relay-state/owner.json from the
// OWNER_KEY it is given, before the relay ever serves; no claim, token or
// invite makes an owner over the wire. Andy: "the relays should do
// first-claim, it should happen at install time. that's the only \"safe\"
// way." and "the invite path to ownership MUST be gone. it is a security
// gap, from the time of install until the time of first claim."
//
// So a suite does what the install does: it WRITES the owner file, and only
// then builds the relay, because a relay reads its owner once, when it is
// created. The owner then claims his own box with no invite.
//
//   ownHome(home, identity)                       what install-units does:
//                                                 owner.json names the key.
//                                                 Call it BEFORE createRelay
//                                                 (or before the relay
//                                                 process starts).
//   claimOwner(box, identity, label, clientKey)   the owner's own claim on a
//                                                 box built on that home
//   installedRelay(identity)                      { home, box }: a fresh relay
//                                                 installed for that owner,
//                                                 nobody on its roll yet —
//                                                 where the owner's own claim
//                                                 can be watched happening
//   installOwner(relayHome, nodeHome, name)       a relay in ANOTHER process:
//                                                 the owner node's identity is
//                                                 made and saved in its home,
//                                                 and its key written into the
//                                                 relay's owner.json, before
//                                                 either starts. The node then
//                                                 claims with no invite.
//
// Until goal/G16.8 this file minted an owner invite and the first claim
// presenting it became the owner; that path is gone from the relay.

const auth = require('../run/spirit/relayAuth');
const nodeCard = require('../run/spirit/nodeCard');
const os = require('os');
const fs = require('fs');
const path = require('path');

function ownHome(home, identity) {
  auth.writeOwner(home, identity.publicKey);
}

function claimOwner(box, identity, label, clientKey) {
  // SAID PLAINLY rather than answered with the relay's refusal: a suite
  // that built its box before naming the owner gets "relay has no owner",
  // which is true but does not say which line of the suite to move.
  const named = box.ownerPublic().ownerKey;
  if (named !== identity.publicKey) {
    throw new Error('ownerClaim: this box was not built on a home naming ' + (identity.name || 'that key') +
      ' as owner — call ownHome(home, identity) before createRelay (goal/G16.8: the owner is written at install)');
  }
  return box.claim(label,
    auth.sign(identity.privateKey, auth.claimMessage(label)),
    identity.publicKey, clientKey || '10.0.0.1', '', '',
    // THE OWNER'S CARD (cycle 10, R5). The owner is the one member who
    // must always be answerable — every owner verb's reply is sealed to
    // the key on this card — so a suite that claimed without one would
    // build a relay that cannot answer its own owner.
    nodeCard.cardFrom(Object.assign({ name: label }, identity)));
}

function installedRelay(identity) {
  // Required here, not at the top: relay.js is heavy, and the suites that
  // only want ownHome should not pay for it.
  const { createRelay } = require('../run/spirit/relay');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-installed-'));
  // The mailbox's own key, which is not the owner's, made before
  // createRelay reads it (world.js does the same).
  // Since goal/G22.5 made the way a relay makes it: relayAuth's first load,
  // then named 'relay' (plantIdentity.js).
  require('./plantIdentity.js').ensureAt(home, 'relay');
  ownHome(home, identity);
  return { home: home, box: createRelay(home) };
}

function installOwner(relayHome, nodeHome, name) {
  const id = auth.generateIdentity(name);
  auth.saveIdentity(nodeHome, id);
  ownHome(relayHome, id);
  return id;
}

module.exports = { ownHome: ownHome, claimOwner: claimOwner, installedRelay: installedRelay, installOwner: installOwner };
