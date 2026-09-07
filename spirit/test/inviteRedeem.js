'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const invites = require('../run/js/invites');
const { createRelay } = require('../run/js/relay');

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-redeem-'));
}

test.startTest('Invites cycle 3 — mint and redeem on one keys-mode box');

{
  const home = tmpHome();
  const box = createRelay(home);
  const andy = auth.generateIdentity('andy');
  const owner = box.claim(
    'andy',
    auth.sign(andy.privateKey, auth.claimMessage('andy')),
    andy.publicKey
  );
  if (!owner.ok) test.fail('owner: ' + JSON.stringify(owner));
  else test.check('owner claimed');

  const minted = box.mint(
    'andy',
    'saint',
    7,
    auth.sign(andy.privateKey, invites.mintMessage('saint', 7))
  );
  if (!minted.ok || !minted.invite) {
    test.fail('mint: ' + JSON.stringify(minted));
  } else {
    test.check('owner minted saint');
  }

  const saint = auth.generateIdentity('saint');
  const expired = box.claim(
    'saint',
    auth.sign(saint.privateKey, auth.claimMessage('saint')),
    saint.publicKey,
    '10.0.0.2',
    'no-such-token'
  );
  if (expired && expired.ok === false && /invite/.test(String(expired.error || ''))) {
    test.check('bad token on keys-mode claim is an invite error, not 201');
  } else {
    test.fail('bad token: ' + JSON.stringify(expired));
  }

  const rowBefore = invites.load(home).find(function (r) {
    return minted.invite && r.token === minted.invite.token;
  });
  if (rowBefore && !rowBefore.consumedAt) {
    test.check('token still live before redeem');
  } else {
    test.fail('before: ' + JSON.stringify(invites.load(home)));
  }

  const redeemed = box.claim(
    'saint',
    auth.sign(saint.privateKey, auth.claimMessage('saint')),
    saint.publicKey,
    '10.0.0.3',
    minted.invite.token
  );
  if (redeemed.ok && redeemed.status === 201) {
    test.check('keys-mode claim with live invite is 201');
  } else {
    test.fail('redeem: ' + JSON.stringify(redeemed));
  }

  const rowAfter = invites.load(home).find(function (r) {
    return minted.invite && r.token === minted.invite.token;
  });
  if (rowAfter && rowAfter.consumedAt) {
    test.check('same box burned the token it minted');
  } else {
    test.fail('after: ' + JSON.stringify(invites.load(home)));
  }

  const john = auth.generateIdentity('john');
  const open = box.claim(
    'john',
    auth.sign(john.privateKey, auth.claimMessage('john')),
    john.publicKey
  );
  if (open.ok) {
    test.check('keys-mode claim without token still open (cycle 4 not started)');
  } else {
    test.fail('open extra: ' + JSON.stringify(open));
  }
}

test.reportSuccessFailureCount();
