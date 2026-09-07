'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const invites = require('../run/js/invites');
const { createRelay } = require('../run/js/relay');

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-lock-'));
}

test.startTest('Invites cycle 4 — keys-mode extra claim needs invite');

{
  const home = tmpHome();
  const box = createRelay(home);
  const andy = auth.generateIdentity('andy');
  const owner = box.claim(
    'andy',
    auth.sign(andy.privateKey, auth.claimMessage('andy')),
    andy.publicKey
  );
  if (owner.ok && owner.owner) test.check('first owner still needs no invite');
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
    7,
    auth.sign(andy.privateKey, invites.mintMessage('john', 7))
  );
  const m2 = box.mint(
    'andy',
    'john',
    7,
    auth.sign(andy.privateKey, invites.mintMessage('john', 7))
  );
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
  );
  const johnB = auth.generateIdentity('john');
  const b = box.claim(
    'john',
    auth.sign(johnB.privateKey, auth.claimMessage('john')),
    johnB.publicKey,
    '10.0.0.5',
    m2.invite.token
  );
  if (a.ok && b.ok) {
    test.check('two johns redeem two invites');
  } else {
    test.fail('johns: ' + JSON.stringify({ a: a, b: b }));
  }

  const listed = box.who().filter(function (p) { return p.publicLabel === 'john'; });
  if (listed.length === 2) test.check('who still lists two johns');
  else test.fail('who: ' + JSON.stringify(box.who()));
}

test.reportSuccessFailureCount();
