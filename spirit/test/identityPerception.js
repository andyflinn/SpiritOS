'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const whoBook = require('../run/js/whoBook');
const invites = require('../run/js/invites');
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

  // Since cycle 4 a second key needs an invite, so two johns is two keys
  // AND two tokens. The label is not what is scarce — annie can mint
  // 'john' as often as she likes — the token is.
  function inviteFor(label) {
    const minted = box.mint(
      'annie',
      label,
      7,
      auth.sign(annie.privateKey, invites.mintMessage(label, 7))
    );
    if (!minted.ok) throw new Error('mint ' + label + ': ' + JSON.stringify(minted));
    return minted.invite.token;
  }

  const johnA = auth.generateIdentity('john');
  const johnB = auth.generateIdentity('john');
  const a = box.claim(
    'john',
    auth.sign(johnA.privateKey, auth.claimMessage('john')),
    johnA.publicKey,
    '10.0.0.1',
    inviteFor('john')
  );
  const b = box.claim(
    'john',
    auth.sign(johnB.privateKey, auth.claimMessage('john')),
    johnB.publicKey,
    '10.0.0.2',
    inviteFor('john')
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
  // A fresh, valid token does not buy a key a second seat: the duplicate
  // check runs after the invite check, and the token is not burned by the
  // claim it fails.
  const thirdToken = inviteFor('john');
  const again = box.claim(
    'john',
    auth.sign(johnA.privateKey, auth.claimMessage('john')),
    johnA.publicKey,
    '10.0.0.3',
    thirdToken
  );
  if (!again.ok && again.status === 409) {
    test.check('same key cannot claim twice, even with a live invite');
  } else {
    test.fail('reclaim john A: ' + JSON.stringify(again));
  }
  const unburned = invites.load(home).find(function (r) { return r.token === thirdToken; });
  if (unburned && !unburned.consumedAt) {
    test.check('the refused claim did not spend its invite');
  } else {
    test.fail('third token: ' + JSON.stringify(unburned));
  }
}

test.subHeading('Knowing somebody, and merely seeing them');

{
  const annie2 = tmpHome();
  const seen = auth.generateIdentity('stranger').publicKey;
  const wrote = auth.generateIdentity('bert').publicKey;

  whoBook.handshake(annie2, { publicKey: seen, publicLabel: 'stranger' });
  whoBook.acquire(annie2, { publicKey: wrote, publicLabel: 'bert' }, 'message');

  const known = whoBook.contacts(annie2).map(function (r) { return r.publicKey; });
  if (known.length === 1 && known[0] === wrote) {
    test.check('a census row is not a contact; a message is');
  } else {
    test.fail('contacts: ' + JSON.stringify(known));
  }

  // Every row written before the field is exactly what a census row is,
  // so it reads as one without anything being migrated.
  if (whoBook.acquiredVia({ publicKey: 'x', publicLabel: 'old' }) === 'census') {
    test.check('a row with no acquiredVia reads as census');
  } else {
    test.fail('a fieldless row was treated as acquired');
  }

  // Perception is still the caption and never the identity: renaming a
  // contact does not change what the mailbox calls them, and seeing them
  // again in a census does not unknow them.
  whoBook.setMyLabel(annie2, wrote, 'bertie');
  whoBook.handshake(annie2, { publicKey: wrote, publicLabel: 'bertram' });
  const row = whoBook.byPublicKey(annie2, wrote);
  if (row.myLabel === 'bertie' && row.publicLabel === 'bertram' && whoBook.acquiredVia(row) === 'message') {
    test.check('a census sync corrects the public label and leaves the rest alone');
  } else {
    test.fail('after sync: ' + JSON.stringify(row));
  }
}


test.subHeading('Waiting to be let in, and shut out again');

{
  const home = tmpHome('hold');

  // Held: a row exists so somebody can be seen waiting, and that is all
  // it is. Not somebody this node listens to.
  whoBook.hold(home, { publicKey: 'KEY-CAROL', publicLabel: 'carol', relay: 'https://spirit.example' });
  const carol = whoBook.byPublicKey(home, 'KEY-CAROL');
  if (whoBook.acquiredVia(carol) === 'hold' && whoBook.listens(carol) === false) {
    test.check('a held row is a name, not a correspondent');
  } else {
    test.fail('held row: ' + JSON.stringify(carol));
  }

  // Visible in the address book, absent from the people this node hears.
  if (whoBook.addressBook(home).length === 1 && whoBook.contacts(home).length === 0) {
    test.check('and it is in the list you can see, not the list you can write to');
  } else {
    test.fail('book ' + whoBook.addressBook(home).length + ', contacts ' + whoBook.contacts(home).length);
  }

  // Accepting is saying yes to somebody who wrote: that is what
  // `message` means. It does not inflate into `handle`, which is a key
  // confirmed out of band and nothing else.
  whoBook.accept(home, 'KEY-CAROL');
  const accepted = whoBook.byPublicKey(home, 'KEY-CAROL');
  if (whoBook.acquiredVia(accepted) === 'message' && whoBook.listens(accepted)) {
    test.check('accepting makes them somebody you hear, at the rank that is true');
  } else {
    test.fail('after accept: ' + JSON.stringify(accepted));
  }

  // Blocking a contact keeps how they were acquired. Unblocking has to
  // put something back, and inventing it later would be a guess.
  whoBook.acquire(home, { publicKey: 'KEY-BERT', publicLabel: 'bert' }, 'handle');
  whoBook.setBlocked(home, 'KEY-BERT', true);
  const blocked = whoBook.byPublicKey(home, 'KEY-BERT');
  if (whoBook.acquiredVia(blocked) === 'handle' && whoBook.listens(blocked) === false) {
    test.check('blocking silences a contact without forgetting how they got in');
  } else {
    test.fail('blocked row: ' + JSON.stringify(blocked));
  }

  // The path that would quietly undo it: they write again.
  whoBook.acquire(home, { publicKey: 'KEY-BERT', publicLabel: 'bert' }, 'message');
  if (whoBook.isBlocked(whoBook.byPublicKey(home, 'KEY-BERT'))) {
    test.check('and writing again does not unblock anybody');
  } else {
    test.fail('a message cleared the block');
  }

  // Still listed, or there would be no way back.
  if (whoBook.addressBook(home).some(function (r) { return r.publicKey === 'KEY-BERT'; })) {
    test.check('a blocked row stays visible, because a block must be undoable');
  } else {
    test.fail('blocked row vanished from the address book');
  }

  whoBook.accept(home, 'KEY-BERT');
  const unblocked = whoBook.byPublicKey(home, 'KEY-BERT');
  if (!whoBook.isBlocked(unblocked) && whoBook.acquiredVia(unblocked) === 'handle') {
    test.check('and unblocking gives back exactly what was there before');
  } else {
    test.fail('after unblock: ' + JSON.stringify(unblocked));
  }
}

test.reportSuccessFailureCount();
