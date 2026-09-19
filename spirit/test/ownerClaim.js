'use strict';

// spirit/test/ownerClaim.js
// THE FIRST CLAIM, THE WAY A RELAY NOW TAKES IT — for suites only.
//
// Cycle 3, Part B: an unclaimed relay accepts exactly one claim, the one
// presenting the owner invite (0003 amended: first invited claim is owner).
// On a VPS install.js mints it over SSH. Lab and test relays mint it in
// process — decided, so they never run the installer (NODE-AND-RELAY, "The
// first claim needs a token", point 5). This is that, in one place.
//
// Until cycle 3 a suite claimed an empty relay with nothing but a signature
// and became its owner; that is exactly what the relay now refuses.
//
//   claimOwner(box, identity, label, clientKey)  in process, a createRelay box
//   mintOwnerInvite(home, label)                 a relay in another process:
//                                                write the invite into its
//                                                relay.db, then claim over HTTP

const auth = require('../run/js/relayAuth');
const invites = require('../run/js/invites');
const relayStore = require('../run/js/relayStore');

// For a relay running in ANOTHER process: the row goes into its relay.db,
// and this process's connection is closed at once, so it holds no handle on
// a file labMaster will want to delete (Windows refuses, EPERM). The body
// the claim route takes carries it as `invite` and `inviteLabel`.
function mintOwnerInvite(home, label) {
  const row = invites.mintOwner(home, label);
  relayStore.open(home).close();
  return row;
}

function claimOwner(box, identity, label, clientKey) {
  const home = box.rootDir();
  const row = invites.mintOwner(home, label);
  return box.claim(label,
    auth.sign(identity.privateKey, auth.claimMessage(label)),
    identity.publicKey, clientKey || '10.0.0.1', row.token, label);
}

module.exports = { claimOwner: claimOwner, mintOwnerInvite: mintOwnerInvite };
