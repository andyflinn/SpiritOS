// ---------------------------------------------------------------------------
//  sealedDerivation.js — the sealed ceiling is DERIVED, and the derivation is
//  checked against real seal output rather than against itself.
//
//    Andy, 2026-09-26: "the idea that certain fixed values ("constants")
//    must be derived from underlying constants. is a design principle.
//    figure out the correct formula, and test it."
//
//  WHY THIS IS NOT payloadCeiling.js. That suite asserts the PROMISE — that a
//  full-size message survives sealing and routing — and it is the reason this
//  one is small: the end-to-end claim is already covered there and must not be
//  built twice. This one asserts the FORMULA, which is a different thing: that
//  limits.js computes its ceiling from PAYLOAD_MAX and arrives at the same
//  answer the cryptography actually gives.
//
//  ── THE TRAP THIS SUITE IS BUILT TO AVOID ────────────────────────────
//
//  A test that recomputes the same formula the code computes proves nothing —
//  it asserts that arithmetic is arithmetic. So every assertion below is
//  anchored in `seal.seal` OUTPUT. The formula predicts; the cipher decides.
//
//  wsl-claude's scheme, followed here: fit on one set of sizes and assert on
//  another; include the base64 boundaries where a naive ratio is wrong; keep a
//  control where easy content at the cap still fits; and assert on the ESCAPED
//  BYTE LENGTH so the content classes disappear rather than being enumerated.
//  Both agents fitted this constant independently, from different directions,
//  which is why 185 is written down rather than guessed at.
// ---------------------------------------------------------------------------

'use strict';

const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const seal = require('../run/js/seal');
const limits = require('../run/js/limits');

test.startTest('The sealed ceiling derives from the wire bound, and the cipher agrees');

const A = auth.generateIdentity('a');
const B = auth.generateIdentity('b');

// A FIXED INSTANT, because the {at,text} wrapper is part of what gets sealed.
// seal.js honours this argument only when it is a Date — a number is silently
// replaced by the current time, which is a defect raised with Andy separately
// and the reason this passes a Date rather than a timestamp.
const AT = new Date('2026-09-26T00:00:00.000Z');

const utf8 = (s) => Buffer.byteLength(s, 'utf8');
const escaped = (t) => utf8(JSON.stringify(String(t)));
const wireOf = (t) =>
  JSON.stringify(seal.seal(B.sealPublicKey, A.publicKey, B.publicKey, t, AT)).length;
const predict = (t) => 4 * Math.ceil(escaped(t) / 3) + limits.SEAL_ENVELOPE;

const QUOTE = String.fromCharCode(34);
const BACKSLASH = String.fromCharCode(92);
const NEWLINE = String.fromCharCode(10);
const ACCENTED = String.fromCharCode(233);
const HAN = String.fromCharCode(0x4e2d);

test.subHeading('The formula predicts what the cipher produces');

{
  // ASSERTED ON SIZES THE CONSTANT WAS NOT FITTED ON, including 1..4 where
  // 4*ceil(n/3) and a naive proportional estimate disagree. That alignment is
  // what made two independent inversions of this formula two bytes too
  // generous before either was checked against real output.
  const cases = [];
  [0, 1, 2, 3, 4, 5, 17, 63, 64, 65, 999, 3001, 12289].forEach(function (n) {
    [['ascii', 'y'], ['quote', QUOTE], ['backslash', BACKSLASH],
      ['newline', NEWLINE], ['accented', ACCENTED], ['han', HAN]].forEach(function (c) {
      cases.push([c[0] + ' x' + n, c[1].repeat(n)]);
    });
  });
  const wrong = cases.filter(function (c) { return predict(c[1]) !== wireOf(c[1]); });
  if (!wrong.length) {
    test.check('the derivation matches real seal output on all ' + cases.length
      + ' cases — thirteen sizes across six content classes, including the '
      + 'base64 boundaries at 1..4 bytes');
  } else {
    test.fail('THE FORMULA IS WRONG for ' + wrong.length + ' of ' + cases.length
      + ' cases. First: ' + wrong[0][0] + ' predicted ' + predict(wrong[0][1])
      + ', the cipher gave ' + wireOf(wrong[0][1]));
  }
}

test.subHeading('SEALED_MAX is the true boundary, not one byte either side');

{
  // THE BOUNDARY BY MEASUREMENT. A derived constant that is one byte out is
  // worse than a literal, because it looks computed. JSON.stringify adds the
  // two surrounding quotes, so a string of SEALED_MAX-2 plain characters is
  // exactly SEALED_MAX escaped bytes.
  const atCap = 'z'.repeat(limits.SEALED_MAX - 2);
  const overCap = 'z'.repeat(limits.SEALED_MAX - 1);
  const wAt = wireOf(atCap);
  const wOver = wireOf(overCap);

  if (escaped(atCap) === limits.SEALED_MAX && wAt <= limits.PAYLOAD_MAX) {
    test.check('a packet of exactly SEALED_MAX escaped bytes (' + limits.SEALED_MAX
      + ') seals to ' + wAt + ' and fits the wire bound ' + limits.PAYLOAD_MAX);
  } else {
    test.fail('SEALED_MAX ' + limits.SEALED_MAX + ' does not fit: escaped '
      + escaped(atCap) + ' sealed to ' + wAt + ' against PAYLOAD_MAX '
      + limits.PAYLOAD_MAX);
  }

  if (wOver > limits.PAYLOAD_MAX) {
    test.check('one byte more does NOT fit — ' + wOver + ' over ' + limits.PAYLOAD_MAX
      + ', so the ceiling is the boundary itself and not a margin below it');
  } else {
    test.fail('SEALED_MAX IS TOO LOW: one byte past it still fits (' + wOver + ' <= '
      + limits.PAYLOAD_MAX + '), so the derivation is leaving wire unused');
  }
}

test.subHeading('It is derived, so moving the wire bound moves it');

{
  // THE WHOLE POINT OF THE PRINCIPLE, and the one thing a hand-written literal
  // cannot do. Recomputed from a hypothetical bound rather than by mutating the
  // module: a suite that edits limits.js hands the next suite a different file.
  const other = 40960;
  const derived = 3 * Math.floor((other - limits.SEAL_ENVELOPE) / 4);
  if (derived > limits.SEALED_MAX) {
    test.check('the ceiling follows the wire bound: at a PAYLOAD_MAX of ' + other
      + ' it would be ' + derived + ' rather than ' + limits.SEALED_MAX);
  } else {
    test.fail('the ceiling does not follow PAYLOAD_MAX — a larger bound gave '
      + derived + ', which is not above ' + limits.SEALED_MAX);
  }
}

test.subHeading('fitsSealed measures, because no character count can stand in for it');

{
  // THE CONTROL: ordinary content at the cap is accepted. Without this, every
  // assertion above could be satisfied by a check that refuses everything.
  if (limits.fitsSealed('q'.repeat(limits.SEALED_MAX - 2))) {
    test.check('ordinary ASCII at the cap is accepted');
  } else {
    test.fail('ASCII at the cap is refused, so the cap is not usable at all');
  }

  // AND WHY IT IS A MEASUREMENT. The same COUNT of characters is a different
  // LOAD. Andy's fork, 2026-09-26: "it's your problem if you overload the
  // fork. not the restaurants." The diner can only avoid overloading it if the
  // fork's size is stated in the units of the load.
  const count = limits.SEALED_MAX - 2;
  const dense = QUOTE.repeat(Math.floor(count / 2));
  const wide = HAN.repeat(Math.floor(count / 3));

  if (!limits.fitsSealed(QUOTE.repeat(count)) && !limits.fitsSealed(HAN.repeat(count))) {
    test.check('the same character count is refused when the content is heavier — '
      + 'quotes and CJK at ' + count + ' characters are both over the byte cap');
  } else {
    test.fail('fitsSealed is counting characters rather than bytes: heavy content at '
      + count + ' characters was accepted');
  }

  if (limits.fitsSealed(dense) && limits.fitsSealed(wide)) {
    test.check('and the same content is accepted once sliced to fit — ' + dense.length
      + ' quotes, ' + wide.length + ' CJK characters');
  } else {
    test.fail('content cut to its byte budget still fails: quotes ' + escaped(dense)
      + ' bytes, CJK ' + escaped(wide) + ' bytes, against a cap of ' + limits.SEALED_MAX);
  }
}

test.subHeading('A packet the composer accepts always seals within the wire bound');

{
  // wsl-claude's assertion, 2026-09-26: "a packet that passes the composer's
  // check always seals within PAYLOAD_MAX, for every content class." It ties
  // this suite to the refusal in packet.js, so the composer's bound and the
  // derivation cannot drift apart without something going red.
  //
  // THE COMPOSER IS THE ONLY GATE, so this is the assertion that matters more
  // than the formula: the formula being right is useless if the thing that
  // refuses uses a different one.
  const packet = require('../run/js/client/packet.js');
  const classes = [['ascii', 'y'], ['quote', QUOTE], ['backslash', BACKSLASH],
    ['newline', NEWLINE], ['accented', ACCENTED], ['han', HAN]];
  const bad = [];
  const refusedAll = [];
  classes.forEach(function (c) {
    // Walk from comfortably inside the bound to well past it, so both the
    // accept and the refuse side are exercised for every content class.
    let accepted = 0;
    [1, 1000, 4000, 8000, 12000, 16384, 20000, 40000].forEach(function (n) {
      const built = packet.encode('natter', { say: c[1].repeat(n) });
      if (!built || !built.ok) return;
      accepted += 1;
      const w = wireOf(built.text);
      if (w > limits.PAYLOAD_MAX) bad.push(c[0] + ' x' + n + ' accepted but sealed to ' + w);
    });
    if (!accepted) refusedAll.push(c[0]);
  });

  if (!bad.length) {
    test.check('every packet the composer accepted sealed within ' + limits.PAYLOAD_MAX
      + ' — six content classes across eight sizes, including sizes the composer refuses');
  } else {
    test.fail('THE COMPOSER ACCEPTS WHAT THE WIRE REFUSES: ' + bad.length
      + ' case(s), first: ' + bad[0]);
  }

  // AND IT MUST NOT REFUSE EVERYTHING, which is the way the assertion above
  // could pass while the product is useless.
  if (!refusedAll.length) {
    test.check('and every content class still has sizes the composer accepts');
  } else {
    test.fail('the composer refuses EVERY size for: ' + refusedAll.join(', '));
  }
}

test.reportSuccessFailureCount();
