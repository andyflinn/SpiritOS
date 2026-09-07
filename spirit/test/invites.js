'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const invites = require('../run/js/invites');
const { createRelay } = require('../run/js/relay');

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-invites-'));
}

test.startTest('Invites cycle 1 — consume on claim');

{
  const home = tmpHome();
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  fs.writeFileSync(
    path.join(home, 'relay-state', 'allow.json'),
    JSON.stringify({ names: ['andy'] })
  );

  const box = createRelay(home);
  const andy = auth.generateIdentity('andy');
  const saint = auth.generateIdentity('saint');

  const noTok = box.claim(
    'saint',
    auth.sign(saint.privateKey, auth.claimMessage('saint')),
    saint.publicKey,
    '10.0.0.1'
  );
  if (!noTok.ok && noTok.status === 403) {
    test.check('names-mode saint without invite is refused');
  } else {
    test.fail('no invite: ' + JSON.stringify(noTok));
  }

  const row = invites.add(home, {
    label: 'saint',
    invitedBy: 'andy',
    days: 7,
    token: 'tok-saint-1',
  });
  if (row.token === 'tok-saint-1' && !row.consumedAt) {
    test.check('invite written unconsumed');
  } else {
    test.fail('add: ' + JSON.stringify(row));
  }

  const badLabel = box.claim(
    'eve',
    auth.sign(saint.privateKey, auth.claimMessage('eve')),
    saint.publicKey,
    '10.0.0.1',
    'tok-saint-1'
  );
  if (!badLabel.ok) {
    test.check('invite does not unlock a different label');
  } else {
    test.fail('eve with saint token: ' + JSON.stringify(badLabel));
  }

  const ok = box.claim(
    'saint',
    auth.sign(saint.privateKey, auth.claimMessage('saint')),
    saint.publicKey,
    '10.0.0.1',
    'tok-saint-1'
  );
  if (ok.ok && ok.status === 201) {
    test.check('names-mode saint with invite and key is accepted');
  } else {
    test.fail('saint invite claim: ' + JSON.stringify(ok));
  }

  const after = invites.load(home).find(function (r) { return r.token === 'tok-saint-1'; });
  if (after && after.consumedAt) {
    test.check('invite consumed after successful claim');
  } else {
    test.fail('not consumed: ' + JSON.stringify(invites.load(home)));
  }

  const reuse = box.claim(
    'saint',
    auth.sign(saint.privateKey, auth.claimMessage('saint')),
    saint.publicKey,
    '10.0.0.2',
    'tok-saint-1'
  );
  if (!reuse.ok) {
    test.check('used invite cannot claim again');
  } else {
    test.fail('reuse: ' + JSON.stringify(reuse));
  }
}

{
  const home = tmpHome();
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  fs.writeFileSync(
    path.join(home, 'relay-state', 'allow.json'),
    JSON.stringify({ names: ['andy'] })
  );
  invites.add(home, {
    label: 'late',
    token: 'tok-expired',
    invitedBy: 'andy',
    expiresAt: '2020-01-01T00:00:00.000Z',
  });
  const box = createRelay(home);
  const late = auth.generateIdentity('late');
  const r = box.claim(
    'late',
    auth.sign(late.privateKey, auth.claimMessage('late')),
    late.publicKey,
    '10.0.0.3',
    'tok-expired'
  );
  if (!r.ok && r.status === 403) {
    test.check('expired invite is refused');
  } else {
    test.fail('expired: ' + JSON.stringify(r));
  }
}

{
  const home = tmpHome();
  const box = createRelay(home);
  const annie = auth.generateIdentity('annie');
  const first = box.claim(
    'annie',
    auth.sign(annie.privateKey, auth.claimMessage('annie')),
    annie.publicKey
  );
  const john = auth.generateIdentity('john');
  const extra = box.claim(
    'john',
    auth.sign(john.privateKey, auth.claimMessage('john')),
    john.publicKey
  );
  if (first.ok && extra.ok) {
    test.check('cycle 1 does not require an invite in keys-mode after owner');
  } else {
    test.fail('keys extra: ' + JSON.stringify({ first: first, extra: extra }));
  }
}

test.reportSuccessFailureCount();
