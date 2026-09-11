'use strict';

// spirit/test/devicePeers.js
// B2. One device for ANYONE with a row, not only the owner.
//
// The thing this exists to prove is the one B1 could not: two peers
// wearing the SAME LABEL and different keys are two identities, and the
// device flow must never confuse them. Labels duplicate on purpose —
// relay.js says it at the claim path, "two johns is still two keys" —
// so a slot keyed by label cannot tell them apart, and the id is the
// public key instead.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const deviceAuth = require('../run/js/deviceAuth');
const invites = require('../run/js/invites');
const { createRelay } = require('../run/js/relay');

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-device-peers-'));
}

test.startTest('Device B2 — a device for any identity');

// Two johns, one relay. The owner mints an invite for each, which is the
// only way a second key wearing a label already on the box gets on it.
function lab() {
  const home = tmpHome();
  const box = createRelay(home);

  const house = auth.generateIdentity('andy');
  auth.saveIdentity(home, house);
  const claimed = box.claim(
    'andy',
    auth.sign(house.privateKey, auth.claimMessage('andy')),
    house.publicKey
  );
  if (!claimed.ok) throw new Error('owner claim: ' + JSON.stringify(claimed));

  function joinAs(label) {
    const who = auth.generateIdentity(label);
    const minted = box.mint(
      'andy',
      label,
      7,
      auth.sign(house.privateKey, invites.mintMessage(label, 7))
    );
    if (!minted || !minted.ok) throw new Error('mint: ' + JSON.stringify(minted));
    // claim(name, sig, publicKey, ip, inviteToken) — the token is last.
    const joined = box.claim(
      label,
      auth.sign(who.privateKey, auth.claimMessage(label)),
      who.publicKey,
      '10.0.0.1',
      minted.invite.token
    );
    if (!joined || !joined.ok) throw new Error('join ' + label + ': ' + JSON.stringify(joined));
    return who;
  }

  return { home: home, box: box, house: house, joinAs: joinAs };
}

async function run() {
  let L;
  try {
    L = lab();
  } catch (e) {
    test.fail('lab setup: ' + (e && e.message ? e.message : e));
    test.reportSuccessFailureCount();
    return;
  }

  const johnA = L.joinAs('john');
  const johnB = L.joinAs('john');
  if (johnA.publicKey !== johnB.publicKey) {
    test.check('two peers share a label and differ by key');
  } else {
    test.fail('the two johns got the same key');
  }

  test.subHeading('Each john has a slot of their own');

  const phoneA = auth.generateIdentity('phone-a');
  const phoneB = auth.generateIdentity('phone-b');

  // Addressed by KEY, which is what the per-key URL will carry.
  const offerA = L.box.deviceOffer(johnA.publicKey, 'pw-a', phoneA.publicKey);
  const offerB = L.box.deviceOffer(johnB.publicKey, 'pw-b', phoneB.publicKey);

  const heldA = L.box.deviceTake(johnA.publicKey);
  const heldB = L.box.deviceTake(johnB.publicKey);
  if (heldA && heldA.password === 'pw-a' && heldB && heldB.password === 'pw-b') {
    test.check('each slot holds its own offer, though the labels are identical');
  } else {
    test.fail('A: ' + JSON.stringify(heldA) + ' B: ' + JSON.stringify(heldB));
  }

  // The label is ambiguous, so it must resolve to nobody rather than to
  // whichever john happens to be first — the same answer resolveParty
  // gives the inbox, and the reason a duplicate label 409s there.
  const byLabel = L.box.deviceTake('john');
  if (byLabel == null) {
    test.check('and the shared label reaches neither of them');
  } else {
    test.fail('a duplicate label resolved to a slot: ' + JSON.stringify(byLabel));
  }

  test.subHeading('A peer installs its own device, with its own key');

  // The node's half: it took the offer, compared the password at home,
  // and now installs the key it was given.
  const installed = L.box.setDevice(
    johnA.publicKey,
    heldA.devicePublicKey,
    auth.sign(johnA.privateKey, deviceAuth.setDeviceMessage(heldA.devicePublicKey))
  );
  if (installed && installed.ok) test.check('john A installed a device on his own row');
  else test.fail('install A: ' + JSON.stringify(installed));

  // The signature is the whole gate. B's own key is a perfectly good key
  // and proves nothing about A's row.
  const crossed = L.box.setDevice(
    johnA.publicKey,
    phoneB.publicKey,
    auth.sign(johnB.privateKey, deviceAuth.setDeviceMessage(phoneB.publicKey))
  );
  if (crossed && crossed.ok === false && crossed.status === 403) {
    test.check('and john B cannot install one on it');
  } else {
    test.fail('cross-install: ' + JSON.stringify(crossed));
  }

  // The owner is not privileged here either. Owning the relay is not
  // owning a peer's row.
  const byOwner = L.box.setDevice(
    johnA.publicKey,
    phoneB.publicKey,
    auth.sign(L.house.privateKey, deviceAuth.setDeviceMessage(phoneB.publicKey))
  );
  if (byOwner && byOwner.ok === false) {
    test.check('and neither can the owner of the relay');
  } else {
    test.fail('owner installed on a peer row: ' + JSON.stringify(byOwner));
  }

  L.box.deviceReply(johnA.publicKey, true);
  L.box.deviceReply(johnB.publicKey, false);
  const settled = await Promise.all([offerA, offerB]);
  if (settled[0] && settled[0].ok && settled[1] && settled[1].ok === false) {
    test.check('each browser hears its own answer');
  } else {
    test.fail('settled: ' + JSON.stringify(settled));
  }

  test.subHeading('The installed device reads that row, and only that row');

  const readA = L.box.inbox(
    'john',
    auth.sign(phoneA.privateKey, auth.inboxMessage('john'))
  );
  // A duplicate label cannot be read by NAME at all — that is the
  // ambiguity rule, and it predates devices. The key is the way in.
  const readByKey = L.box.inbox(
    johnA.publicKey,
    auth.sign(phoneA.privateKey, auth.inboxMessage(johnA.publicKey))
  );
  if (readByKey && readByKey.ok) {
    test.check("john A's phone reads john A's mail");
  } else {
    test.fail('device inbox: ' + JSON.stringify(readByKey) + ' (by label: ' +
      JSON.stringify(readA && readA.error) + ')');
  }

  const stolen = L.box.inbox(
    johnB.publicKey,
    auth.sign(phoneA.privateKey, auth.inboxMessage(johnB.publicKey))
  );
  if (stolen && stolen.ok === false) {
    test.check("and cannot read john B's");
  } else {
    test.fail('a device read another row: ' + JSON.stringify(stolen));
  }

  test.subHeading('The owner path is where it was');

  const ownerPhone = auth.generateIdentity('owner-phone');
  const ownerOffer = L.box.deviceOffer(null, 'pw-owner', ownerPhone.publicKey);
  const ownerHeld = L.box.deviceTake(null);
  if (ownerHeld && ownerHeld.password === 'pw-owner') {
    test.check('an omitted name still means the owner, so the frozen page still works');
  } else {
    test.fail('owner held: ' + JSON.stringify(ownerHeld));
  }
  const ownerInstall = L.box.setDevice(
    'andy',
    ownerPhone.publicKey,
    auth.sign(L.house.privateKey, deviceAuth.setDeviceMessage(ownerPhone.publicKey))
  );
  if (ownerInstall && ownerInstall.ok) test.check('and the owner still lands in allow.json');
  else test.fail('owner install: ' + JSON.stringify(ownerInstall));

  const allowRaw = fs.readFileSync(path.join(L.home, 'relay-state', 'allow.json'), 'utf8');
  if (allowRaw.indexOf(ownerPhone.publicKey) !== -1 &&
      allowRaw.indexOf(phoneA.publicKey) === -1) {
    test.check("and a peer's device is NOT written into the owner's room");
  } else {
    test.fail('allow.json holds the wrong keys');
  }

  L.box.deviceReply(null, false);
  await ownerOffer;

  test.reportSuccessFailureCount();
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
});
