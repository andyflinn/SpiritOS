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
const auth = require('../run/spirit/relayAuth');
const nodeCard = require('../run/spirit/nodeCard');
const contactBook = require('../run/spirit/contacts');

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
// Since goal/G22.5: a node's own root always holds its identity, and the book
// reads it to mark a card's owner, so the holding node is given one.
auth.saveIdentity(me, auth.generateIdentity('me'));
const john = home('john', 1);
const mallory = home('mallory', 1);

contactBook.acquire(me, { publicKey: john.id.publicKey, publicLabel: 'john' });

test.subHeading('A verified card is kept');

{
  const stored = contactBook.setCard(me, john.id.publicKey, nodeCard.describe(john.dir));
  if (stored.ok && stored.first) {
    test.check('the card is stored, and said to be the first this row held');
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
  contactBook.acquire(me, { publicKey: mallory.id.publicKey, publicLabel: 'mallory' });
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
  const said = contactBook.setCard(me, john.id.publicKey, stolen);
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

  // NOTHING OF IT IS KEPT (goal/G40.11, box v24: "A card is valid only signed by the row's ID; any other is refused
  // and nothing of it kept"). cycle 10's cardDisputed, the refused card kept as evidence, went with that ruling; the
  // refusal names who signed it, which is what the caller is told.
  if (row.card !== stolen && !('cardDisputed' in row)) {
    test.check('and nothing of the refused card is kept on the row');
  } else {
    test.fail('the refused card left a trace: ' + JSON.stringify(row));
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

  const moved = contactBook.setCard(me, john.id.publicKey, after);
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

  const back = contactBook.setCard(me, john.id.publicKey, before);
  if (!back.ok && back.why === 'not newer' && back.held === moved.at && back.offered === beforeAt) {
    test.check('THE OLD CARD IS REFUSED — a copy is not a forgery, and it must not be enough');
  } else {
    test.fail('A ROLLBACK SUCCEEDED — the compromised key would be back in use: ' + JSON.stringify(back));
  }

  // Strictly greater, so re-serving the card we already hold is refused
  // too. Equal is not newer.
  const same = contactBook.setCard(me, john.id.publicKey, after);
  if (!same.ok && same.why === 'not newer') {
    test.check('and replaying the card already held is refused as well — equal is not newer');
  } else {
    test.fail('an identical card was taken as an update');
  }
}

// FIRST SIGHTING (cardVia: invite, reply or roll, recorded once) STOOD HERE. It went with acquiredVia in goal/G40.11
// (box v24: "Gone: ... cardVia, cardDisputed"): a row says what its card is, verified on every read, not how it came.
test.subHeading('No record of how a card arrived');

{
  const mine = contactBook.setCard(me, mallory.id.publicKey, nodeCard.describe(mallory.dir));
  const row = contactBook.byPublicKey(me, mallory.id.publicKey);
  if (mine.ok && !('cardVia' in row) && !('via' in mine)) {
    test.check('a card is taken with no word of where it came from, and the row keeps none');
  } else {
    test.fail('a source is still recorded: ' + JSON.stringify({ said: mine, row: row }));
  }
}

test.subHeading('What never reaches the row');

{
  const junk = ['', 'not json', JSON.stringify({ v: 1, body: { name: 'john', sig: 'x' } })];
  const got = junk.filter(function (j) { return contactBook.setCard(me, john.id.publicKey, j).ok; });
  if (!got.length) {
    test.check('nothing that fails the signature check is stored, whatever it is shaped like');
  } else {
    test.fail('unsigned junk was stored');
  }

  // A CARD FOR A KEY WITH NO ROW MAKES A ROW OF THE TABLE, NEVER A CONTACT (goal/G40.11): server.js asks a card before a
  // first post, and the row it sits on is unflagged — seen, not kept, not listened to.
  const stranger = home('stranger', 1);
  const took = contactBook.setCard(me, stranger.id.publicKey, nodeCard.describe(stranger.dir));
  const strangerRow = contactBook.byPublicKey(me, stranger.id.publicKey);
  if (took.ok && strangerRow && strangerRow.card && !strangerRow.keep && !strangerRow.held && !contactBook.listens(strangerRow)) {
    test.check('and a card for a key with no row sits on a new row that is not a contact');
  } else {
    test.fail('a card for a new key: ' + JSON.stringify({ said: took, row: strangerRow }));
  }

  // The card goes in through setCard and its signature check, and no other path: acquire takes named fields, so a
  // card handed to it is dropped — the intended answer, not an oversight. (upsert, the old door, is gone.)
  contactBook.acquire(me, { publicKey: mallory.id.publicKey, publicLabel: 'mallory', card: nodeCard.describe(john.dir) });
  const row = contactBook.byPublicKey(me, mallory.id.publicKey);
  if (contactBook.cardOf(row).publicKey === mallory.id.publicKey && typeof contactBook.upsert === 'undefined') {
    test.check('and acquire cannot smuggle one in — there is one door, and it verifies');
  } else {
    test.fail('a card was written around the check');
  }
}

dirs.forEach(function (d) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* leave it */ }
});

test.reportSuccessFailureCount();
