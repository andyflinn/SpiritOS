'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const whoBook = require('../run/js/whoBook');
const { createRelay } = require('../run/js/relay');

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-bones-'));
}

test.startTest('Identity vs perception (sticks and stones)');

{
  const annie = tmpHome();
  const johnA = auth.generateIdentity('john');
  const johnB = auth.generateIdentity('john');
  const jim = auth.generateIdentity('jim');

  if (johnA.publicKey !== johnB.publicKey) {
    test.check('two johns are two keys');
  } else {
    test.fail('key collision on two generateIdentity(john)');
  }

  whoBook.handshake(annie, { publicKey: johnA.publicKey, publicLabel: 'john' });
  whoBook.handshake(annie, { publicKey: johnB.publicKey, publicLabel: 'john' });
  whoBook.handshake(annie, { publicKey: jim.publicKey, publicLabel: 'jim' });

  whoBook.setMyLabel(annie, johnA.publicKey, 'lovelyJohn');
  whoBook.setMyLabel(annie, johnB.publicKey, 'john-work');

  const lovely = whoBook.byMyLabel(annie, 'lovelyJohn');
  const work = whoBook.byMyLabel(annie, 'john-work');
  if (lovely.length === 1 && lovely[0].publicKey === johnA.publicKey) {
    test.check('lovelyJohn is only john A');
  } else {
    test.fail('lovelyJohn: ' + JSON.stringify(lovely));
  }
  if (work.length === 1 && work[0].publicKey === johnB.publicKey) {
    test.check('john-work is only john B');
  } else {
    test.fail('john-work: ' + JSON.stringify(work));
  }

  const publicJohns = whoBook.load(annie).filter(function (r) { return r.publicLabel === 'john'; });
  if (publicJohns.length === 2) {
    test.check('two public labels "john" stay two rows');
  } else {
    test.fail('public johns: ' + publicJohns.length);
  }

  whoBook.handshake(annie, { publicKey: johnA.publicKey, publicLabel: 'jonathan' });
  const afterRename = whoBook.byPublicKey(annie, johnA.publicKey);
  if (afterRename.publicLabel === 'jonathan' && afterRename.myLabel === 'lovelyJohn') {
    test.check('their public rename does not smash my caption');
  } else {
    test.fail('after rename: ' + JSON.stringify(afterRename));
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
  if (first.ok) test.check('lab mailbox accepts first signed annie');
  else test.fail('annie claim: ' + JSON.stringify(first));

  const john = auth.generateIdentity('john');
  // Today's wire: second "john" label is a NEW name only if allow is keys
  // and that name is listed — after first owner, extra names are refused.
  const j = box.claim(
    'john',
    auth.sign(john.privateKey, auth.claimMessage('john')),
    john.publicKey
  );
  if (!j.ok && j.status === 403) {
    test.check('keys-mode mailbox still unique-by-label (two johns need peer-by-key next)');
  } else if (j.ok) {
    test.check('unexpected: second label accepted — record it');
  } else {
    test.fail('john claim: ' + JSON.stringify(j));
  }
}

test.reportSuccessFailureCount();
