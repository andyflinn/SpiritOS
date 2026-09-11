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

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const deviceAuth = require('../run/js/deviceAuth');
const world = require('./world');

// TWO JOHNS, and the scenario says so in one line. Both wear the label
// `john`; neither can share a name, because a name is how this suite
// refers to somebody and a label is what goes on the wire. That
// distinction is the whole subject of this file.
const SCENARIO = {
  title: 'Two peers wearing one label',
  peers: [
    { name: 'johnA', label: 'john' },
    { name: 'johnB', label: 'john' },
  ],
};

test.startTest('Device B2 — a device for any identity');

// The owner mints an invite for each, which is the only way a second key
// wearing a label already on the box gets on it — world.build does that
// for every peer in the scenario.

async function run() {
  const L = world.build(SCENARIO);
  if (!L.ok) { test.fail(L.error); test.reportSuccessFailureCount(); return; }

  const johnA = L.peer('johnA');
  const johnB = L.peer('johnB');
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
    auth.sign(L.owner.privateKey, deviceAuth.setDeviceMessage(phoneB.publicKey))
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

  test.subHeading('The owner is an identity like any other');

  const ownerPhone = auth.generateIdentity('owner-phone');

  // No implicit owner any more. The bare /device page resolved an
  // omitted token to whoever owned the box; B3 gave every page a key in
  // its address and the page was retired, so this is the last way to
  // enrol without naming anybody — and it refuses.
  const nameless = await L.box.deviceOffer('', 'pw-owner', ownerPhone.publicKey);
  if (nameless && nameless.ok === false) {
    test.check('an offer that names nobody reaches nobody');
  } else {
    test.fail('nameless offer: ' + JSON.stringify(nameless));
  }

  const ownerOffer = L.box.deviceOffer('andy', 'pw-owner', ownerPhone.publicKey);
  const ownerHeld = L.box.deviceTake('andy');
  if (ownerHeld && ownerHeld.password === 'pw-owner') {
    test.check('and the owner, named, gets a slot like everybody else');
  } else {
    test.fail('owner held: ' + JSON.stringify(ownerHeld));
  }
  const ownerInstall = L.box.setDevice(
    'andy',
    ownerPhone.publicKey,
    auth.sign(L.owner.privateKey, deviceAuth.setDeviceMessage(ownerPhone.publicKey))
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

  L.box.deviceReply('andy', false);
  await ownerOffer;

  test.subHeading('A key survives being a URL segment');

  // The reason this exists: keys are STANDARD base64, and that alphabet
  // contains `/`. A `/` in a path segment is not in the segment — it
  // splits it — so `/<raw key>/device` would be two segments for roughly
  // one key in sixteen. Built, not assumed: a key is searched for until
  // one turns up with a slash in it.
  let slashed = null;
  for (let n = 0; n < 200 && !slashed; n += 1) {
    const k = auth.generateIdentity('probe').publicKey;
    if (k.indexOf('/') !== -1) slashed = k;
  }
  if (slashed) {
    const seg = deviceAuth.keyToUrl(slashed);
    if (seg.indexOf('/') === -1 && deviceAuth.keyFromUrl(seg) === slashed) {
      test.check('a key containing a slash survives the round trip, and carries none');
    } else {
      test.fail('slashed key: ' + slashed + ' -> ' + seg + ' -> ' + deviceAuth.keyFromUrl(seg));
    }
  } else {
    test.check('(no slash-bearing key in 200 tries — the encoding is still what protects it)');
  }

  // Canonical: one key, one segment, and nothing else decodes to it.
  const segA = deviceAuth.keyToUrl(johnA.publicKey);
  if (deviceAuth.keyFromUrl(segA) === johnA.publicKey && deviceAuth.keyToUrl(
    deviceAuth.keyFromUrl(segA)
  ) === segA) {
    test.check('and the segment is canonical — one key, one address');
  } else {
    test.fail('not canonical: ' + segA);
  }

  // A segment that is not base64url at all is not a near-miss to be
  // guessed at. It is nothing.
  if (deviceAuth.keyFromUrl('../../etc/passwd') === '' && deviceAuth.keyFromUrl('') === '') {
    test.check('and anything that is not a key decodes to nothing');
  } else {
    test.fail('keyFromUrl accepted a non-key');
  }

  test.subHeading('The relay will say whether an identity exists, and no more');

  const pub = L.box.deviceIdentityPublic(johnA.publicKey);
  if (pub && pub.label === 'john' && pub.owner === false) {
    test.check('a peer key resolves to a label the router can use');
  } else {
    test.fail('public identity: ' + JSON.stringify(pub));
  }
  // What it must NOT hand back. Everything here is public already, but a
  // routing helper that returns keys is one refactor away from being the
  // thing that hands out a device key.
  if (pub && !pub.publicKey && !pub.devicePublicKey && !pub.peer) {
    test.check('and carries no key of any kind back to the router');
  } else {
    test.fail('public identity leaked a key: ' + JSON.stringify(pub));
  }
  if (L.box.deviceIdentityPublic('MCowBQYDK2VwAyEAnobodyhasthiskeyatallxxxxxxxxxxxxxxxxxxxxxx=') === null) {
    test.check('and a key nobody holds is nobody — which is the 404');
  } else {
    test.fail('a stranger key resolved');
  }

  test.subHeading('A peer knows which relays it holds a row on');

  // The badge answers "do I OWN this" with a signed status. A peer owns
  // nothing, so before B2 its device timer got an empty list and never
  // polled — the feature stopped at the owner for want of one word.
  // `claimed` is the other question, asked of the PUBLIC census.
  const ownerBadge = require('../run/js/ownerBadge');
  const nodeHome = world.tmpHome();
  fs.mkdirSync(path.join(nodeHome, 'app', 'natter'), { recursive: true });
  fs.writeFileSync(
    path.join(nodeHome, 'app', 'natter', 'relays.json'),
    JSON.stringify([{ label: 'lab', url: 'http://relay' }])
  );
  auth.saveIdentity(nodeHome, johnA);

  function labRequest(url, method, pathname) {
    if (/\/api\/relay\/status/.test(pathname)) {
      return Promise.resolve({ status: 403, text: JSON.stringify({ error: 'not owner' }) });
    }
    if (/\/api\/relay\/who/.test(pathname)) {
      // The WIRE shape, which wraps the list — relay.who() is an array
      // in process and `{ peers: [...] }` over HTTP (server.js). A fake
      // that answers the in-process shape tests nothing the node will
      // ever receive.
      return Promise.resolve({
        status: 200,
        text: JSON.stringify({ peers: L.box.who() }),
      });
    }
    return Promise.resolve({ status: 404, text: '{}' });
  }

  const mine = await ownerBadge.probe(nodeHome, 'john', labRequest, johnA.publicKey);
  if (mine && mine.ownedUrls.length === 0 && mine.claimedUrls.length === 1) {
    test.check('a peer owns nothing and still holds a row — 0 owned, 1 claimed');
  } else {
    test.fail('probe: owned=' + JSON.stringify(mine && mine.ownedUrls) +
      ' claimed=' + JSON.stringify(mine && mine.claimedUrls));
  }

  const stranger = auth.generateIdentity('nobody');
  const none = await ownerBadge.probe(nodeHome, 'nobody', labRequest, stranger.publicKey);
  if (none && none.claimedUrls.length === 0) {
    test.check('and a key with no row anywhere claims nothing');
  } else {
    test.fail('stranger claimed: ' + JSON.stringify(none && none.claimedUrls));
  }

  test.reportSuccessFailureCount();
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
});
