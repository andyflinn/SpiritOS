'use strict';
const rollOf = require('./rollOf');

const test = require('./testSupport.js');
const auth = require('../run/spirit/relayAuth');
const { claimOwner, installedRelay } = require('./ownerClaim');
const invites = require('../run/spirit/invites');
// A relay installed for its owner with nobody on its roll yet, which is the
// only world in which the act of claiming can be watched happening. Since
// goal/G16.8 the install names the owner (ownerClaim.installedRelay), so the
// owner's key is known before the box is built. The claims themselves stay
// written out below: they are the subject of this file, and a helper that
// made them would be a helper that hid them.

test.startTest('Invites cycle 4 — keys-mode extra claim needs invite');

{
  const andy = auth.generateIdentity('andy');
  const made = installedRelay(andy);
  const home = made.home;
  const box = made.box;
  // The owner was named at install (goal/G16.8) and claims with no invite.
  const owner = claimOwner(box, andy, 'andy');
  if (owner.ok && owner.owner) test.check('the owner named at install claims with no invite, and no owner-minted one');
  else test.fail('owner: ' + JSON.stringify(owner));

  const johnA = auth.generateIdentity('john');
  const bare = box.claim(
    'john',
    auth.sign(johnA.privateKey, auth.claimMessage('john')),
    johnA.publicKey
  );
  if (!bare.ok && /invite/.test(String(bare.error || ''))) {
    test.check('second key without invite is refused');
  } else {
    test.fail('bare john: ' + JSON.stringify(bare));
  }

  const m1 = box.mint(
    'andy',
    'john',
    7);
  const m2 = box.mint(
    'andy',
    'john',
    7);
  if (m1.ok && m2.ok && m1.invite.token !== m2.invite.token) {
    test.check('owner can mint two invites for the same label');
  } else {
    test.fail('mints: ' + JSON.stringify({ m1: m1, m2: m2 }));
  }

  const a = box.claim(
    'john',
    auth.sign(johnA.privateKey, auth.claimMessage('john')),
    johnA.publicKey,
    '10.0.0.4',
    m1.invite.token
  ,
    'john');
  const johnB = auth.generateIdentity('john');
  const b = box.claim(
    'john',
    auth.sign(johnB.privateKey, auth.claimMessage('john')),
    johnB.publicKey,
    '10.0.0.5',
    m2.invite.token
  ,
    'john');
  if (a.ok && b.ok) {
    test.check('two johns redeem two invites');
  } else {
    test.fail('johns: ' + JSON.stringify({ a: a, b: b }));
  }

  const listed = rollOf(box).filter(function (p) { return p.publicLabel === 'john'; });
  if (listed.length === 2) test.check('who still lists two johns');
  else test.fail('who: ' + JSON.stringify(rollOf(box)));
}

test.reportSuccessFailureCount();
