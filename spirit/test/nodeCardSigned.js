'use strict';

// spirit/test/nodeCardSigned.js
// A CARD PROVES ITSELF, OR IT PROVES NOTHING — cycle 10, R1.
//
//   Andy, 2026-09-23: "why have two calls for what could be one only?" —
//   "card & description" — and, on what a card must carry: "it must say:
//   these two keys, this name".
//
// ── WHY THE SIGNATURE IS NOT OPTIONAL ────────────────────────────────
//
// After this cycle a card introduces the key that everything ever sent to
// that node will be sealed to. And a reply's signature covers
// `receiptMessage(hash, minute)` — the hash and a clock minute, NOT the
// reply's text (relayAuth.js). So without a signature of its own, a card
// could be rewritten in flight by whatever carried it: a relay would hand
// over ITS cipher key, the sender would seal to that, and it would read
// everything and re-seal onward, with every check passing.
//
// wsl-claude, reviewing the cycle: "encryption built on an unsigned card
// is encryption addressed to whoever forwards it."
//
// So this suite is mostly about a card FAILING. The happy path is one
// line; the rest is every way a card can lie.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const nodeCard = require('../run/js/nodeCard');

test.startTest('A node card carries both keys and proves itself');

function home(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-card-'));
  const id = auth.generateIdentity(name);
  id.description = 'a node that belongs to ' + name;
  auth.saveIdentity(dir, id);
  return { dir: dir, id: id };
}

const andy = home('andy');
const mallory = home('mallory');
const text = nodeCard.describe(andy.dir);
const body = JSON.parse(text).body;

test.subHeading('It carries these two keys and this name');

if (body.publicKey === andy.id.publicKey && body.sealKey === andy.id.sealPublicKey &&
    body.name === 'andy' && typeof body.description === 'string' && body.at > 0 && body.sig) {
  test.check('the identity key, the cipher key, the name, a counter and a signature');
} else {
  test.fail('the card is missing something: ' + JSON.stringify(body));
}

// The identity key is IN the signed bytes on purpose: the blob must be
// checkable without the envelope that carried it, because the whole point
// is that no carrier is trusted.
const checked = nodeCard.verify(text);
if (checked && checked.publicKey === andy.id.publicKey && checked.sealKey === andy.id.sealPublicKey) {
  test.check('and it verifies from its own bytes, with no envelope and no carrier');
} else {
  test.fail('a good card did not verify: ' + JSON.stringify(checked));
}

test.subHeading('Change any field and it stops being a card');

const fields = ['name', 'description', 'publicKey', 'sealKey', 'at'];
const survived = fields.filter(function (f) {
  const t = JSON.parse(text);
  t.body[f] = f === 'at' ? t.body.at + 1 : t.body[f] + 'x';
  return nodeCard.verify(JSON.stringify(t)) !== null;
});
if (!survived.length) {
  test.check('all five fields are inside the signature: ' + fields.join(', '));
} else {
  test.fail('these could be altered undetected: ' + survived.join(', '));
}

test.subHeading('THE ATTACK: a carrier swapping in its own cipher key');

// This is the one the cycle exists for. A relay wants to read what is
// sent to andy, so it puts its own cipher key on andy's card — and, since
// it must, signs the result with the only key it has: its own.
{
  const t = JSON.parse(text);
  t.body.sealKey = mallory.id.sealPublicKey;
  t.body.sig = auth.sign(mallory.id.privateKey, nodeCard.signable({
    name: t.body.name,
    description: t.body.description,
    publicKey: t.body.publicKey,
    sealKey: t.body.sealKey,
    at: t.body.at,
  }));
  if (nodeCard.verify(JSON.stringify(t)) === null) {
    test.check('a cipher key swapped and re-signed by the carrier is refused — it cannot sign as andy');
  } else {
    test.fail('THE CARD WAS SWAPPED AND ACCEPTED — messages would be sealed to the carrier');
  }
}

// And the same trick with the identity key changed to match, which is a
// DIFFERENT node rather than a forgery. It verifies, correctly — and it is
// the shadow roll's job to notice that this is not the andy it knows
// (cycle 10's R13). A card cannot answer "is this the right person", only "are these
// the fields their owner signed".
{
  const whole = JSON.parse(nodeCard.describe(mallory.dir));
  const verified = nodeCard.verify(JSON.stringify(whole));
  if (verified && verified.publicKey === mallory.id.publicKey) {
    test.check('a card that is wholly mallory\'s verifies as mallory\'s — introduction is the roll\'s question, not the card\'s');
  } else {
    test.fail('a legitimate card failed: ' + JSON.stringify(verified));
  }
}

test.subHeading('A card from before this cycle does not travel');

{
  // No counter: the flag day says old nodes update. Refused rather than
  // defaulted, because a default would be a number the signer never chose
  // — and the counter is what stops an old card being replayed after a
  // rotation (cycle 10, C1).
  const t = JSON.parse(text);
  delete t.body.at;
  const t2 = JSON.parse(text);
  t2.body.at = 0;
  if (nodeCard.verify(JSON.stringify(t)) === null && nodeCard.verify(JSON.stringify(t2)) === null) {
    test.check('a card with no counter, or a counter of zero, is refused');
  } else {
    test.fail('a card without a usable counter was accepted');
  }
}

{
  const broken = ['', 'not json at all', '{}', JSON.stringify({ v: 1 }), JSON.stringify({ v: 1, body: {} })];
  const accepted = broken.filter(function (b) { return nodeCard.verify(b) !== null; });
  if (!accepted.length) {
    test.check('and nothing shaped like a card but empty gets through');
  } else {
    test.fail('these were accepted: ' + JSON.stringify(accepted));
  }
}

test.subHeading('One name for one thing');

// It was one call wearing two names: the request said `describe`, the
// answer was composed by `answerCard`. Andy: "card & description" — the
// description was always a FIELD of the card.
if (nodeCard.asks(JSON.stringify({ v: 1, body: { card: true } })) === true &&
    nodeCard.asks(JSON.stringify({ v: 1, body: { describe: true } })) === false) {
  test.check('a card is asked for by the word `card`, and the old word answers nothing');
} else {
  test.fail('the rename did not take');
}

if (nodeCard.asks(JSON.stringify({ app: 'natter', v: 1, body: { card: true } })) === false) {
  test.check('and an app\'s packet is still an app\'s — a card belongs to no app on either end');
} else {
  test.fail('an app packet was answered as a card request');
}

[andy.dir, mallory.dir].forEach(function (d) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* leave it */ }
});

test.reportSuccessFailureCount();
