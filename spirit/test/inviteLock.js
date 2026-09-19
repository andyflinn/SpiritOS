'use strict';
const rollOf = require('./rollOf');

const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const { claimOwner } = require('./ownerClaim');
const invites = require('../run/js/invites');
// A relay nobody has claimed, which is the only world in which the act of
// claiming can be watched happening. The claims themselves stay written
// out below: they are the subject of this file, and a helper that made
// them would be a helper that hid them.
const UNCLAIMED = require('./scenario').UNCLAIMED;
const world = require('./world');

test.startTest('Invites cycle 4 — keys-mode extra claim needs invite');

{
  const made = world.build(UNCLAIMED);
  const home = made.home;
  const box = made.box;
  const andy = auth.generateIdentity('andy');
  // The first claim takes the owner invite (cycle 3, Part B; ownerClaim.js).
  const owner = claimOwner(box, andy, 'andy');
  if (owner.ok && owner.owner) test.check('the first owner claims with the owner invite, not an owner-minted one');
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
