'use strict';

// spirit/test/payloadCeiling.js
// SIXTEEN KILOBYTES OF TEXT STILL FITS AFTER SEALING — cycle 10's R6.
//
// ── THE DEFECT, MEASURED BEFORE IT WAS FIXED ─────────────────────────
//
// Cycle 10 seals a packet before signing it, and base64 of the ciphertext
// grows it by about a third. `PAYLOAD_MAX` was 16,384 and `MAX_ROUTED_TEXT`
// was the same constant — so a packet at the documented ceiling sealed to
// **22,049 bytes** and the relay refused it by 5,665. A full-size message
// could not be sent AT ALL.
//
// That is why cycle 10's R6 blocks the flag day rather than tidying after it: the
// ceiling and the seal were incompatible, and no amount of updating boxes
// fixes a constant.
//
// ── AND WHY THERE ARE NOW TWO CONSTANTS ──────────────────────────────
//
// One number meant both "what an app may build" and "what may travel",
// and that was right until the two stopped being the same bytes. The
// trap, if they had stayed one: `MATCH_BUDGET` composes a search reply
// and `sendSelfAnswer` seals it afterwards. Raise the single constant to
// fit sealed bytes and that budget rises silently with it — the relay
// builds a 22 KB reply, seals it past the wire bound, and refuses a
// packet it wrote itself. **Every component suite stays green while that
// is true**, which is the whole reason this file checks the relationship
// and not just the number.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const seal = require('../run/js/seal');
const limits = require('../run/js/limits');
const nodeCard = require('../run/js/nodeCard');
const relayStore = require('../run/js/relayStore');
const { createRelay } = require('../run/js/relay');

test.startTest('A full-size message survives sealing and routing');

const homes = [];

function world() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-ceiling-'));
  homes.push(home);
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const owner = auth.generateIdentity('andy');
  auth.writeAllowKeys(home, [{ name: 'andy', publicKey: owner.publicKey }]);
  const box = createRelay(home);
  box.claim('andy', auth.sign(owner.privateKey, auth.claimMessage('andy')), owner.publicKey);
  return { home: home, box: box, owner: owner };
}

function join(w, name) {
  const id = auth.generateIdentity(name);
  const minted = w.box.mint('andy', name, 7, '');
  w.box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)),
    id.publicKey, null, minted.invite.token, name);
  return id;
}

// A packet of EXACTLY the plaintext ceiling, built the way an app builds
// one — measured and trimmed rather than assumed, because the JSON around
// the text is part of what the limit counts.
function packetOfExactly(bytes) {
  const pad = 'x'.repeat(bytes);
  const first = JSON.stringify({ app: 'natter', v: 1, body: { say: pad } });
  const over = first.length - bytes;
  return JSON.stringify({ app: 'natter', v: 1, body: { say: pad.slice(0, pad.length - over) } });
}

test.subHeading('The two bounds are two, and the sealed one is bigger');

{
  // ── A PROMISE GUARD, AND IT SAYS SO — NOT A CONSISTENCY CHECK ──────
  //
  //   Andy's method for this file, 2026-09-25: "adjusting the limit, see
  //   if anything breaks, and then resetting it to the current, agreed
  //   value."
  //
  // RUN, 16384 -> 20000: five red. Four of them are consistency and say
  // what the move BREAKS — the packet seals past the wire bound, the
  // headroom goes negative, the constants have drifted apart, and a relay
  // refuses a legal full-size post. THIS ONE IS NOT ONE OF THOSE. It
  // fires on any change at all, including the deliberate one he just
  // made, and its only content is "you did the thing you meant to do".
  //
  // It is still worth having: PLAINTEXT_MAX is the figure apps were
  // written against, so moving it by accident is a broken promise rather
  // than an inconsistency. But a reader counting reds must be able to
  // tell the two apart, or his experiment reports a failure every time it
  // succeeds.
  //
  // So the wording carries which kind it is. The assertion is unchanged.
  if (limits.PLAINTEXT_MAX === 16384) {
    test.check('PROMISE: PLAINTEXT_MAX is unchanged at 16 KB — the ceiling apps were written against');
  } else {
    test.fail('PROMISE MOVED, not a defect by itself: the app-facing ceiling is now ' +
      limits.PLAINTEXT_MAX + ' rather than 16384. If that was deliberate, the reds below are what it ' +
      'costs; if it was not, this is the only line that would have told you');
  }

  const packet = packetOfExactly(limits.PLAINTEXT_MAX);
  const A = auth.generateIdentity('a');
  const B = auth.generateIdentity('b');
  const wire = JSON.stringify(
    seal.seal(B.sealPublicKey, A.publicKey, B.publicKey, packet, Date.now()));

  // THE FIGURE IN limits.js IS CHECKED AGAINST A REAL SEAL, not restated.
  // A comment carrying a measurement nobody re-derives is how 197 bytes
  // sat on the front page for two days.
  if (packet.length === limits.PLAINTEXT_MAX && wire.length <= limits.PAYLOAD_MAX) {
    test.check('a packet at the plaintext ceiling seals to ' + wire.length +
      ' bytes and fits the wire bound of ' + limits.PAYLOAD_MAX);
  } else {
    test.fail('packet ' + packet.length + ' sealed to ' + wire.length +
      ' against PAYLOAD_MAX ' + limits.PAYLOAD_MAX);
  }

  // The margin is stated in limits.js as 479 bytes. If sealing ever grows
  // — a longer nonce, another field in the envelope — this says so before
  // a user finds out.
  const spare = limits.PAYLOAD_MAX - wire.length;
  if (spare >= 0 && spare < 2048) {
    test.check('and the headroom is ' + spare + ' bytes — close enough to be honest, ' +
      'far enough that one more envelope field is not an incident');
  } else {
    test.fail('headroom is ' + spare + ' bytes, which is either negative or no longer a margin');
  }
}

test.subHeading('THE JOIN: what a composer may build, sealed, still fits what may travel');

{
  // The relationship, asserted directly. This is the check that fires if
  // somebody raises one constant and not the other — and the one that
  // would have caught the single-constant version of cycle 10's R6.
  const A = auth.generateIdentity('a');
  const B = auth.generateIdentity('b');
  const biggest = JSON.stringify(
    seal.seal(B.sealPublicKey, A.publicKey, B.publicKey,
      packetOfExactly(limits.PLAINTEXT_MAX), Date.now())).length;

  if (biggest <= limits.PAYLOAD_MAX) {
    test.check('the largest thing a composer may build fits the wire once sealed — ' +
      'the two constants hold hands (' + limits.PLAINTEXT_MAX + ' -> ' + biggest +
      ' <= ' + limits.PAYLOAD_MAX + ')');
  } else {
    test.fail('THE CONSTANTS HAVE DRIFTED APART: PLAINTEXT_MAX ' + limits.PLAINTEXT_MAX +
      ' seals to ' + biggest + ', past PAYLOAD_MAX ' + limits.PAYLOAD_MAX +
      '. A composer can now build what the wire refuses.');
  }
}

test.subHeading('And it actually travels, through a relay');

{
  const w = world();
  const anna = join(w, 'anna');
  const bert = join(w, 'bert');

  w.box.streamOpen(bert.publicKey,
    auth.sign(bert.privateKey, auth.streamMessage(bert.publicKey)),
    { write: function () {}, close: function () {} });

  const bertCard = nodeCard.verify(nodeCard.cardFrom(Object.assign({ name: 'bert' }, bert)));
  const packet = packetOfExactly(limits.PLAINTEXT_MAX);
  const sending = JSON.stringify(
    seal.seal(bertCard.sealKey, anna.publicKey, bert.publicKey, packet, Date.now()));

  const sent = w.box.routePost(anna.publicKey, bert.publicKey, sending,
    auth.sign(anna.privateKey, auth.postMessage(anna.publicKey, bert.publicKey, sending)));

  if (sent && sent.ok) {
    test.check('a full-size sealed message is carried — ' + sending.length +
      ' bytes on the wire, which the relay refused by 5,665 before this requirement');
  } else {
    test.fail('the relay refused a legal full-size post: ' + JSON.stringify(sent));
  }

  // AND THE OTHER SIDE OF THE BOUND STILL REFUSES. A ceiling that only
  // ever accepts is not a ceiling, and this suite would pass with the
  // limit removed entirely.
  const tooBig = 'y'.repeat(limits.PAYLOAD_MAX + 1);
  const over = w.box.routePost(anna.publicKey, bert.publicKey, tooBig,
    auth.sign(anna.privateKey, auth.postMessage(anna.publicKey, bert.publicKey, tooBig)));

  if (over && over.ok === false) {
    test.check('and one byte past the wire bound is still refused — the ceiling is a ceiling');
  } else {
    test.fail('a packet past PAYLOAD_MAX was carried: ' + JSON.stringify(over));
  }
}

try { relayStore.closeAll(); } catch (e) { /* leave it */ }
homes.forEach(function (h) {
  try { fs.rmSync(h, { recursive: true, force: true }); } catch (e) { /* sweeper */ }
});

test.reportSuccessFailureCount();
