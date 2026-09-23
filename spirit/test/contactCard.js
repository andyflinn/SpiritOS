'use strict';

// spirit/test/contactCard.js
// THE CARD ON THE ROW — cycle 10, R3, with C1 and C3.
//
// A contact's card is kept so that sealing needs no second fetch: the key
// a message is sealed to sits beside the key it is verified against.
//
// What this suite is really about is the three ways a card can be WRONG
// after it has already verified, because `nodeCardSigned.js` proved the
// signature holds and that is not the same as the card being the right
// card:
//
//   - it verifies, but as SOMEBODY ELSE     (the relay swapping keys)
//   - it verifies, but it is OLD            (a rollback needing no forgery)
//   - it verifies, and it is the first one this node ever saw, which is
//     the case nothing here can check — named, not defended.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const nodeCard = require('../run/js/nodeCard');
const contactBook = require('../run/js/contacts');

test.startTest('A contact keeps the card it was introduced by');

const dirs = [];
function home(name, at) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-card-row-'));
  dirs.push(dir);
  const id = auth.generateIdentity(name);
  id.description = name + ' at home';
  if (at) id.cardAt = at;
  auth.saveIdentity(dir, id);
  return { dir: dir, id: id };
}

const me = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-card-me-'));
dirs.push(me);
const john = home('john', 1);
const mallory = home('mallory', 1);

contactBook.upsert(me, { publicKey: john.id.publicKey, publicLabel: 'john', acquiredVia: 'invite' });

test.subHeading('A verified card is kept, with how it arrived');

{
  const stored = contactBook.setCard(me, john.id.publicKey, nodeCard.describe(john.dir), 'invite');
  if (stored.ok && stored.first && stored.via === 'invite') {
    test.check('the card is stored, and the row records that it came by invite');
  } else {
    test.fail('a good card was not stored: ' + JSON.stringify(stored));
  }

  const row = contactBook.byPublicKey(me, john.id.publicKey);
  const read = contactBook.cardOf(row);
  if (read && read.sealKey === john.id.sealPublicKey && read.publicKey === john.id.publicKey) {
    test.check('and both keys are read back off the row — sealing needs no second fetch');
  } else {
    test.fail('the stored card did not read back: ' + JSON.stringify(read));
  }

  if (contactBook.sealKeyOf(row) === john.id.sealPublicKey) {
    test.check('sealKeyOf answers the key a message to them is sealed to');
  } else {
    test.fail('sealKeyOf did not answer the seal key');
  }

  // THE SIGNED BLOB, not the two keys read out of it (C3). wsl-claude:
  // accountability exists only if somebody can produce the contradiction
  // — keep the keys alone and the victim holds a key and a memory while
  // the relay holds everything.
  if (typeof row.card === 'string' && nodeCard.verify(row.card)) {
    test.check('what is stored is the signed blob itself, so the contradiction can be produced later');
  } else {
    test.fail('the row kept fields rather than evidence');
  }
}

test.subHeading('A row that has never seen a card seals to nobody');

{
  contactBook.upsert(me, { publicKey: mallory.id.publicKey, publicLabel: 'mallory', acquiredVia: 'message' });
  const row = contactBook.byPublicKey(me, mallory.id.publicKey);
  if (contactBook.cardOf(row) === null && contactBook.sealKeyOf(row) === null) {
    test.check('no card means no seal key — which is the sender\'s refusal, not a fallback');
  } else {
    test.fail('a cardless row offered a key');
  }
}

test.subHeading('THE SWAP: a card that verifies, as somebody else');

// A hostile relay answers the card request with its OWN card, correctly
// signed by its own key. Every signature check passes. The only thing
// wrong with it is that it is not who we asked.
{
  const stolen = nodeCard.describe(mallory.dir);
  const said = contactBook.setCard(me, john.id.publicKey, stolen, 'reply');
  if (!said.ok && said.why === 'wrong key' && said.signedBy === mallory.id.publicKey) {
    test.check('a perfectly valid card signed by another identity is REFUSED for this row');
  } else {
    test.fail('A SWAPPED CARD WAS ACCEPTED — messages to john would be sealed to mallory: ' + JSON.stringify(said));
  }

  const row = contactBook.byPublicKey(me, john.id.publicKey);
  if (contactBook.cardOf(row).publicKey === john.id.publicKey) {
    test.check('and the card already held is untouched — a refusal does not cost you the good card');
  } else {
    test.fail('the refused card replaced the held one');
  }

  // KEPT, AND THE OWNER TOLD (cycle 10's R3, amended). This is the only moment a node
  // can notice a relay swapping keys underneath it; a refusal nobody sees
  // is a swap that succeeds on the second attempt.
  if (Array.isArray(row.cardDisputed) && row.cardDisputed.length === 1 &&
      row.cardDisputed[0].why === 'wrong key' && row.cardDisputed[0].card === stolen) {
    test.check('the refused card is KEPT on the row as evidence, with why and when');
  } else {
    test.fail('the refused card was dropped: ' + JSON.stringify(row.cardDisputed));
  }
}

test.subHeading('THE ROLLBACK: a card that verifies, and is old');

{
  // john rotates. A validly signed OLD card can be re-served afterwards
  // and it will verify — a downgrade needing no forgery, only a copy, and
  // possibly back to the very key whose compromise caused the rotation.
  const before = nodeCard.describe(john.dir);
  const beforeAt = nodeCard.verify(before).at;
  const rotated = auth.loadIdentity(john.dir);
  const fresh = auth.generateIdentity('john');
  rotated.sealPublicKey = fresh.sealPublicKey;
  rotated.sealPrivateKey = fresh.sealPrivateKey;
  // THE COUNTER IS NO LONGER SET BY HAND HERE. It used to read
  // `rotated.cardAt = 2`, which was the suite supplying the one thing the
  // tree never did — describe() now advances it because the seal key
  // changed. Asserting the RELATION rather than the literal is also the
  // honest test: what cycle 10's R13 needs is strictly-greater, not the number 2.
  auth.saveIdentity(john.dir, rotated);
  const after = nodeCard.describe(john.dir);

  const moved = contactBook.setCard(me, john.id.publicKey, after, 'reply');
  if (moved.ok && !moved.first && moved.at > beforeAt) {
    test.check('a strictly newer card replaces the one held — which is where rotation lives');
  } else {
    test.fail('a newer card was not taken: ' + JSON.stringify(moved));
  }
  if (contactBook.sealKeyOf(contactBook.byPublicKey(me, john.id.publicKey)) === rotated.sealPublicKey) {
    test.check('and the seal key moves with it, so the next message goes to the new one');
  } else {
    test.fail('the seal key did not rotate');
  }

  const back = contactBook.setCard(me, john.id.publicKey, before, 'roll');
  if (!back.ok && back.why === 'not newer' && back.held === moved.at && back.offered === beforeAt) {
    test.check('THE OLD CARD IS REFUSED — a copy is not a forgery, and it must not be enough');
  } else {
    test.fail('A ROLLBACK SUCCEEDED — the compromised key would be back in use: ' + JSON.stringify(back));
  }

  // Strictly greater, so re-serving the card we already hold is refused
  // too. Equal is not newer.
  const same = contactBook.setCard(me, john.id.publicKey, after, 'roll');
  if (!same.ok && same.why === 'not newer') {
    test.check('and replaying the card already held is refused as well — equal is not newer');
  } else {
    test.fail('an identical card was taken as an update');
  }
}

test.subHeading('First sighting is recorded once, and never laundered');

{
  // A contact first met by invite does not become roll-sighted because a
  // roll mentioned them again. The weak source must never overwrite the
  // strong one — a screen that shows them alike launders one into the
  // other.
  const row = contactBook.byPublicKey(me, john.id.publicKey);
  if (row.cardVia === 'invite') {
    test.check('two later cards arrived by reply and by roll, and the row still says invite');
  } else {
    test.fail('the first sighting was overwritten: ' + row.cardVia);
  }

  // An unknown source is treated as the WEAKEST, not rejected: a caller
  // that forgets to say gets the claim it can defend.
  contactBook.upsert(me, { publicKey: mallory.id.publicKey, publicLabel: 'mallory' });
  contactBook.setCard(me, mallory.id.publicKey, nodeCard.describe(mallory.dir), 'somewhere');
  if (contactBook.byPublicKey(me, mallory.id.publicKey).cardVia === 'roll') {
    test.check('and a source nobody named is recorded as the weakest one there is');
  } else {
    test.fail('an unnamed source was not treated as weak');
  }
}

test.subHeading('What never reaches the row');

{
  const junk = ['', 'not json', JSON.stringify({ v: 1, body: { name: 'john', sig: 'x' } })];
  const got = junk.filter(function (j) { return contactBook.setCard(me, john.id.publicKey, j, 'reply').ok; });
  if (!got.length) {
    test.check('nothing that fails the signature check is stored, whatever it is shaped like');
  } else {
    test.fail('unsigned junk was stored');
  }

  if (contactBook.setCard(me, 'a-key-with-no-row', nodeCard.describe(john.dir), 'reply').why === 'no such contact') {
    test.check('and a card for somebody this node has no row for creates no row');
  } else {
    test.fail('a card conjured a contact');
  }

  // The card goes in through setCard and its signature check, and no
  // other path. upsert builds its row from named fields, so a card handed
  // to it is dropped — the intended answer, not an oversight.
  contactBook.upsert(me, { publicKey: mallory.id.publicKey, publicLabel: 'mallory', card: nodeCard.describe(john.dir) });
  const row = contactBook.byPublicKey(me, mallory.id.publicKey);
  if (contactBook.cardOf(row).publicKey === mallory.id.publicKey) {
    test.check('and upsert cannot smuggle one in — there is one door, and it verifies');
  } else {
    test.fail('upsert wrote a card around the check');
  }
}

dirs.forEach(function (d) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* leave it */ }
});

test.reportSuccessFailureCount();
