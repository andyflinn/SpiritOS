'use strict';

// spirit/test/seal.js
// THE RELAY CARRIES WHAT IT CANNOT READ — cycle 10, R4 and R11.
//
// A round trip is one assertion. The rest of this suite is the things a
// working AEAD does NOT give you for free, and each of them is a real
// attack that a construction missing one line would allow:
//
//   - the same blob RE-ADDRESSED to somebody else, and opened there
//   - the same blob replayed as if from a different sender
//   - a ciphertext altered in flight and opened anyway
//   - two identical messages recognisable as identical on the wire
//
// The relay is the adversary throughout, because after this cycle that is
// the honest model: it holds every byte, it chooses the route, and the
// only thing it must not have is meaning.

const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const seal = require('../run/js/seal');

test.startTest('A sealed post opens for one recipient and nobody else');

const andy = auth.generateIdentity('andy');
const bert = auth.generateIdentity('bert');
const carol = auth.generateIdentity('carol');

const WORDS = 'the lab relay is at one megabyte and refuses the ninth member';

test.subHeading('It opens, once, for the person it was sealed to');

const packet = seal.seal(bert.sealPublicKey, andy.publicKey, bert.publicKey, WORDS);

{
  const got = seal.open(bert.sealPrivateKey, andy.publicKey, bert.publicKey, packet);
  if (got && got.text === WORDS) {
    test.check('a round trip gives back exactly the words that went in');
  } else {
    test.fail('the round trip failed: ' + JSON.stringify(got));
  }

  // C2: the timestamp is INSIDE the seal, not in the envelope, where it
  // would leak when a message was written and be forgeable by whoever
  // carried it. It is stamped here rather than by each caller, because a
  // timestamp every caller has to remember is one that goes missing.
  if (got && /^\d{4}-\d{2}-\d{2}T/.test(got.at)) {
    test.check('and a sender timestamp comes out with it, which the envelope never carried');
  } else {
    test.fail('no timestamp inside the seal: ' + JSON.stringify(got));
  }

  if (seal.isSealed(packet) && !seal.isSealed(JSON.stringify({ v: 1, body: { card: true } }))) {
    test.check('a sealed packet is recognisable as one without being opened');
  } else {
    test.fail('isSealed cannot tell the two apart');
  }
}

test.subHeading('THE WORDS ARE NOT ON THE WIRE');

{
  // The claim the cycle actually makes, tested the way Andy asked for it
  // to be tested: "listen to the monitor stream... and make sure you
  // cannot parse the package content."
  const onWire = JSON.stringify(packet);
  const words = WORDS.split(' ').filter(function (w) { return w.length > 3; });
  const leaked = words.filter(function (w) { return onWire.indexOf(w) !== -1; });
  if (!leaked.length) {
    test.check('not one word of ' + words.length + ' appears anywhere in what travels');
  } else {
    test.fail('THE PAYLOAD IS READABLE: ' + leaked.join(', '));
  }

  // And nothing else is in there either — the envelope is three fields
  // and a marker, and a field added later that carried meaning would be
  // a leak nobody noticed.
  const fields = Object.keys(packet).sort().join(',');
  if (fields === 'c,e,n,sealed') {
    test.check('and what travels is only the throwaway key, the nonce and the ciphertext');
  } else {
    test.fail('the sealed envelope grew a field: ' + fields);
  }
}

test.subHeading('THE RE-ADDRESSING ATTACK, which signing does not stop');

{
  // A sealed blob that names nobody can be lifted off the wire, signed by
  // the lifter as their own, and sent on to a third party — whose node
  // opens it, because the maths works. The signature is real and it is
  // the attacker's. Only binding the parties into the AEAD stops this.
  const toCarol = seal.open(carol.sealPrivateKey, andy.publicKey, carol.publicKey, packet);
  if (toCarol === null) {
    test.check('carol cannot open a blob sealed to bert, even with her own key and a valid signature');
  } else {
    test.fail('RE-ADDRESSING WORKED — a lifted blob opened for a third party');
  }

  // The same blob, delivered to the right person, but claiming to be from
  // somebody else. Without the sender in the associated data this opens
  // fine, and bert reads andy's words believing carol wrote them.
  const wrongSender = seal.open(bert.sealPrivateKey, carol.publicKey, bert.publicKey, packet);
  if (wrongSender === null) {
    test.check('and a blob re-labelled as being from somebody else does not open either');
  } else {
    test.fail('THE SENDER IS NOT BOUND — authorship could be rewritten in flight');
  }

  // Bert's own key is still the only thing that opens it. Said so the two
  // refusals above cannot be passing for the boring reason.
  if (seal.open(bert.sealPrivateKey, andy.publicKey, bert.publicKey, packet).text === WORDS) {
    test.check('while the person it was addressed to still opens it — the refusals are the binding, not a broken packet');
  } else {
    test.fail('the good path broke');
  }
}

test.subHeading('Anything altered in flight fails to open');

{
  const bad = [];
  ['e', 'n', 'c'].forEach(function (f) {
    const t = JSON.parse(JSON.stringify(packet));
    const raw = Buffer.from(t[f], 'base64');
    raw[0] = raw[0] ^ 0xff;                     // one bit is enough
    t[f] = raw.toString('base64');
    if (seal.open(bert.sealPrivateKey, andy.publicKey, bert.publicKey, t) !== null) bad.push(f);
  });
  if (!bad.length) {
    test.check('one flipped byte in the throwaway key, the nonce or the ciphertext, and it will not open');
  } else {
    test.fail('these were altered and opened anyway: ' + bad.join(', '));
  }

  // A truncated ciphertext must not be mistaken for a short message: the
  // tag is the last sixteen bytes, and taking them off is exactly what an
  // attacker who wants an unauthenticated decrypt would try.
  const cut = JSON.parse(JSON.stringify(packet));
  cut.c = Buffer.from(cut.c, 'base64').slice(0, 8).toString('base64');
  if (seal.open(bert.sealPrivateKey, andy.publicKey, bert.publicKey, cut) === null) {
    test.check('and a ciphertext short of its tag is refused rather than half-read');
  } else {
    test.fail('a truncated packet opened');
  }
}

test.subHeading('The same words twice are not the same bytes');

{
  const again = seal.seal(bert.sealPublicKey, andy.publicKey, bert.publicKey, WORDS);
  if (JSON.stringify(again) !== JSON.stringify(packet) && again.e !== packet.e && again.n !== packet.n) {
    test.check('a fresh throwaway key and a fresh nonce each time — the relay cannot tell a repeat from new traffic');
  } else {
    test.fail('two sealings of the same text produced matching bytes');
  }

  if (seal.open(bert.sealPrivateKey, andy.publicKey, bert.publicKey, again).text === WORDS) {
    test.check('and both still open');
  } else {
    test.fail('the second sealing did not open');
  }
}

test.subHeading('What it refuses to seal, rather than sealing badly');

{
  // No card means no seal key, and no seal key means NO POST — Andy: "if
  // you can't get the card, you can't post anyways." Never a plaintext
  // fallback, which would hand everything to an attacker who can simply
  // withhold a card.
  const refused = [
    seal.seal('', andy.publicKey, bert.publicKey, WORDS),
    seal.seal(null, andy.publicKey, bert.publicKey, WORDS),
    seal.seal('not-a-key', andy.publicKey, bert.publicKey, WORDS),
    seal.seal(bert.sealPublicKey, '', bert.publicKey, WORDS),
    seal.seal(bert.sealPublicKey, andy.publicKey, '', WORDS),
  ];
  const slipped = refused.filter(function (r) { return r !== null; });
  if (!slipped.length) {
    test.check('a missing or unusable key answers null — there is no plaintext fallback to fall back to');
  } else {
    test.fail('something was sealed anyway: ' + JSON.stringify(slipped));
  }

  const junk = ['', 'not json', '{}', JSON.stringify({ sealed: 1 }), JSON.stringify({ sealed: 1, e: 'a', n: 'b', c: 'c' })];
  const opened = junk.filter(function (j) {
    return seal.open(bert.sealPrivateKey, andy.publicKey, bert.publicKey, j) !== null;
  });
  if (!opened.length && !junk.slice(0, 4).some(seal.isSealed)) {
    test.check('and nothing shaped like a seal but empty opens, or even counts as sealed');
  } else {
    test.fail('junk got through: ' + JSON.stringify(opened));
  }
}

test.subHeading('A message that waited days still opens');

{
  // No session and no handshake, which is a requirement rather than a
  // simplification: a post may be queued for days — Andy, on patience,
  // "could be days for a text message" — and both ends may restart in
  // between. Anything with a session would make store-and-forward a
  // liveness problem.
  const old = seal.seal(bert.sealPublicKey, andy.publicKey, bert.publicKey, WORDS,
    new Date(Date.now() - 1000 * 60 * 60 * 24 * 9));
  const got = seal.open(bert.sealPrivateKey, andy.publicKey, bert.publicKey, old);
  if (got && got.text === WORDS && Date.now() - Date.parse(got.at) > 1000 * 60 * 60 * 24 * 8) {
    test.check('a nine-day-old sealed message opens, and says how old it is so age can be judged above');
  } else {
    test.fail('a queued message did not survive: ' + JSON.stringify(got));
  }
}

test.reportSuccessFailureCount();
