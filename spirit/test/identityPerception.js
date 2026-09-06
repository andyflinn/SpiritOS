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

  const publicJohns = whoBook.load(annie).filter(function (r) {
    return r.publicLabel === 'john';
  });
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

  whoBook.addRoute(annie, johnA.publicKey, 'http://127.0.0.1:65410');
  whoBook.addRoute(annie, johnA.publicKey, 'https://spirit.andyflinn.com');
  whoBook.addRoute(annie, johnA.publicKey, 'http://127.0.0.1:65410');
  const routed = whoBook.byPublicKey(annie, johnA.publicKey);
  if (routed.relays && routed.relays.length === 2) {
    test.check('routes append per key and do not duplicate');
  } else {
    test.fail('routes: ' + JSON.stringify(routed));
  }

  const bRoutes = whoBook.byPublicKey(annie, johnB.publicKey).relays || [];
  if (bRoutes.length === 0) {
    test.check('john-work has no routes until seen elsewhere');
  } else {
    test.fail('john B should start with no routes');
  }

  whoBook.handshake(annie, {
    publicKey: johnA.publicKey,
    publicLabel: 'jonathan',
    relay: 'http://127.0.0.1:65411',
  });
  const afterSeen = whoBook.byPublicKey(annie, johnA.publicKey);
  if (afterSeen.relays.length === 3 && afterSeen.myLabel === 'lovelyJohn') {
    test.check('handshake appends a new route and keeps my caption');
  } else {
    test.fail('after seen: ' + JSON.stringify(afterSeen));
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

  const johnA = auth.generateIdentity('john');
  const johnB = auth.generateIdentity('john');
  const a = box.claim(
    'john',
    auth.sign(johnA.privateKey, auth.claimMessage('john')),
    johnA.publicKey
  );
  const b = box.claim(
    'john',
    auth.sign(johnB.privateKey, auth.claimMessage('john')),
    johnB.publicKey
  );
  if (a.ok && b.ok && johnA.publicKey !== johnB.publicKey) {
    test.check('two johns claim the same public label on one mailbox');
  } else {
    test.fail('two johns: ' + JSON.stringify({ a: a, b: b }));
  }
  const listed = box.who().filter(function (p) { return p.publicLabel === 'john'; });
  if (listed.length === 2) {
    test.check('who lists two johns as two keys');
  } else {
    test.fail('who johns: ' + JSON.stringify(box.who()));
  }
  const again = box.claim(
    'john',
    auth.sign(johnA.privateKey, auth.claimMessage('john')),
    johnA.publicKey
  );
  if (!again.ok && again.status === 409) {
    test.check('same key cannot claim twice');
  } else {
    test.fail('reclaim john A: ' + JSON.stringify(again));
  }
}

test.reportSuccessFailureCount();
