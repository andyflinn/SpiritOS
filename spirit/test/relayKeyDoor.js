'use strict';
const rollOf = require('./rollOf');

// spirit/test/relayKeyDoor.js
// WHO THIS RELAY IS, FROM THE SMALLEST THING THAT KNOWS.
//
//   Andy: "the first two are easily replaced with GET /api/relay/key or
//   whatever."
//
// The two being the front door's "is this sender a relay?"
// (hub.frontDoor) and search's "which key do I address this box as"
// (hub.handleSearch). Both need a PIN, and the pin was derived from the
// whole roll — once per relay, per node boot, at 151 bytes a member.
//
// ── WHY A NEW DOOR RATHER THAN A NARROWER QUESTION ───────────────────
//
// `?key=` cannot help here. It filters the PEERS; the relay's own key is
// on the envelope, so narrowing to a key nobody holds would still be
// asking the roll a question about its membership in order to read a
// field beside it. A caller that wants one fixed fact should ask for one
// fixed fact.
//
// And it is what makes the roll demotable. 0010 grants `who` a GET
// exemption for exactly one reason — "it is where a node learns the
// relay's KEY. You cannot post to an address you are still asking for" —
// and while that is true of `who`, `who` can never require a signature,
// because the first caller has nothing to sign with. Move key-learning
// and the sentence moves with it.
//
// ── FIXED COST, WHICH IS WHAT EARNS THE EXEMPTION ────────────────────
//
// 0013: a relay is fixed-cost per time-unit. This answer has no
// membership term in it at all, so it is the same size on a relay with
// one member and on a relay with a million. That is the test, and the
// roll fails it.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const relayKeys = require('../run/js/relayKeys');
const answerRelay = require('../run/js/answerRelay');
const { createRelay } = require('../run/js/relay');

function boxWith(count) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-keydoor-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay'));

  const owner = auth.generateIdentity('owner');
  auth.writeAllowKeys(home, [{ name: 'owner', publicKey: owner.publicKey }]);
  const box = createRelay(home);
  box.claim('owner', auth.sign(owner.privateKey, auth.claimMessage('owner')), owner.publicKey);

  for (let i = 0; i < count; i += 1) {
    const id = auth.generateIdentity('m' + i);
    const minted = box.mint('owner', 'm' + i, 7, '');
    box.claim('m' + i, auth.sign(id.privateKey, auth.claimMessage('m' + i)),
      id.publicKey, 'client-' + i, minted.invite.token, 'm' + i);
  }
  return { home: home, box: box };
}

// A node's home, and a request function that answers out of `box` the way
// the routes in server.js do. Not a socket: what is under test is which
// DOOR gets asked and how often, which a fake answers better than a port.
function nodeAgainst(box, opts) {
  opts = opts || {};
  // `opts.home` reuses an existing node home, which is how a RESTART is
  // spelled here: a fresh answerer (so the RAM cache is cold) reading a
  // relay-state that already holds a pin.
  const home = opts.home || fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-keynode-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  if (!opts.home) auth.saveIdentity(home, auth.generateIdentity('node'));

  const asked = [];
  const answerer = answerRelay.createAnswerer({
    rootDir: home,
    request: function (url, method, pathname) {
      asked.push(pathname);
      // AN OLD RELAY HAS NO SUCH DOOR. `oldRelay` makes this fake answer
      // the way a box that has not been updated does — 404, which asJson
      // turns into an unreadable answer — so the fallback is exercised
      // rather than assumed.
      if (pathname === '/api/relay/key') {
        if (opts.oldRelay) return Promise.resolve({ status: 404, text: 'Not found' });
        // SIGNED, since cycle 10's R9 — the same answer now carries the
        // key every post to this box is sealed to, so an unsigned one is
        // refused and yields no key at all. Built from the real box so
        // this fake cannot drift from what a relay actually says.
        return Promise.resolve({
          status: 200,
          text: JSON.stringify({
            relayPublicKey: box.relayPublicKey(),
            relaySealKey: box.relaySealKey(),
            keySig: box.relayKeyStatement(),
            relayLabel: box.relayLabel(),
          }),
        });
      }
      if (pathname === '/api/relay/who') {
        return Promise.resolve({
          status: 200,
          text: JSON.stringify({
            peers: rollOf(box),
            relayPublicKey: box.relayPublicKey(),
            relayLabel: box.relayLabel(),
          }),
        });
      }
      return Promise.resolve({ status: 404, text: 'Not found' });
    },
    urls: function () { return ['https://relay.example']; },
  });
  return { home: home, answerer: answerer, asked: asked };
}

test.startTest('The relay answers who it is, without answering who is on it');

const R = boxWith(12);

// ── 1. THE DOOR ──────────────────────────────────────────────────────

test.subHeading('One fixed fact, asked for directly');

const N = nodeAgainst(R.box);

N.answerer.relayKey('https://relay.example').then(function (key) {
  if (key === R.box.relayPublicKey()) {
    test.check('a node with no pin learns the relay key');
  } else {
    test.fail('got ' + JSON.stringify(key));
  }

  if (N.asked.length === 1 && N.asked[0] === '/api/relay/key') {
    test.check('and it asked /api/relay/key — the roll was not read at all');
  } else {
    test.fail('asked ' + JSON.stringify(N.asked));
  }

  // IT WROTE THE PIN. The whole point of the fetch is that the next
  // boot does not need one.
  if (relayKeys.pinned(N.home, 'https://relay.example') === R.box.relayPublicKey()) {
    test.check('and pinned it, which is what the next boot reads');
  } else {
    test.fail('nothing was pinned');
  }

  // ── 2. AND IT STILL RE-CHECKS, WHICH IS NOT THE SAME COST ──────────
  //
  // A pin-first short-circuit was written here and backed out the same
  // hour: returning the pinned key without asking makes steady state free
  // and makes a REBUILT relay silent. A rebuilt box answers honestly with
  // a new key, and the check is the only thing that notices — an attacker
  // can echo the pinned key back, but an honest rebuild cannot.
  //
  // So the saving is the DOOR, not the skipping. What used to cost a
  // whole roll now costs two fields, and the behaviour is unchanged.

  test.subHeading('And it still asks each boot — cheaply, not never');

  // Same home, cold answerer — the restarted-node case.
  const again = nodeAgainst(R.box, { home: N.home });

  return again.answerer.relayKey('https://relay.example').then(function (k2) {
    if (k2 === R.box.relayPublicKey()) {
      test.check('a restarted node with a pin still gets the key');
    } else {
      test.fail('the pinned path broke: ' + JSON.stringify(k2));
    }

    if (again.asked.length === 1 && again.asked[0] === '/api/relay/key') {
      test.check('and re-checks it against the small door, never the roll');
    } else {
      test.fail('asked ' + JSON.stringify(again.asked));
    }

    // ── 3. AND AN OLD RELAY IS REFUSED, NOT WORKED AROUND ────────────
    //
    //   Andy: "why not: the suite asserts the order — small door first,
    //   or else fail."
    //
    // A roll fallback was written here and cut the same hour. Two
    // reasons, and the second is the one that settles it: a fallback is a
    // path nobody exercises (four such were deleted the day before), and
    // **a fallback is a reader** — while anything reaches for `who`, the
    // roll has a caller that is not a list and cannot be demoted to a
    // signed post. It would have preserved the thing this door removes.
    //
    // The cost is a deploy order: relay before node. A node updated first
    // simply cannot pin that relay, which is visible — search reports it
    // `silent` — rather than quietly working at 300x the price.

    test.subHeading('And a relay without the door is refused, not worked around');

    const O = nodeAgainst(R.box, { oldRelay: true });
    return O.answerer.relayKey('https://relay.example').then(function (k3) {
      if (!k3) {
        test.check('a relay with no /api/relay/key yields no key — the node does not go looking');
      } else {
        test.fail('it found a key anyway: ' + JSON.stringify(k3));
      }

      if (O.asked.length === 1 && O.asked[0] === '/api/relay/key') {
        test.check('and asked once, at the small door, and stopped');
      } else {
        test.fail('asked ' + JSON.stringify(O.asked));
      }

      // NOTHING WAS PINNED, which matters: a failed lookup must not leave
      // a half-answer on disk for the next boot to believe.
      if (!relayKeys.pinned(O.home, 'https://relay.example')) {
        test.check('and pinned nothing, so a failed lookup leaves no residue');
      } else {
        test.fail('a pin was written from a failed lookup');
      }

      // ── 4. FIXED COST, WHICH IS THE POINT ──────────────────────────

      test.subHeading('Fixed cost, which is what earns it an exemption');

      const small = JSON.stringify({
        relayPublicKey: R.box.relayPublicKey(),
        relayLabel: R.box.relayLabel(),
      }).length;

      const big = boxWith(200);
      const bigSmall = JSON.stringify({
        relayPublicKey: big.box.relayPublicKey(),
        relayLabel: big.box.relayLabel(),
      }).length;

      if (small === bigSmall) {
        test.check('the answer is ' + small + ' bytes at 13 members and ' +
          bigSmall + ' at 201 — no membership term (0013)');
      } else {
        test.fail('it grew: ' + small + ' then ' + bigSmall);
      }

      const roll = JSON.stringify({
        peers: rollOf(big.box),
        relayPublicKey: big.box.relayPublicKey(),
        relayLabel: big.box.relayLabel(),
      }).length;

      if (roll > bigSmall * 20) {
        test.check('against ' + roll + ' bytes for the roll it replaces — ' +
          Math.round(roll / bigSmall) + 'x at 201 members, and the gap is the membership');
      } else {
        test.fail('roll ' + roll + ' vs door ' + bigSmall);
      }

      // ── 5. IT REVEALS NOTHING THE ROLL DID NOT ───────────────────
      //
      // A new public door has to be argued for on what it hands out, not
      // only on what it costs. This answers two fields that were already
      // on a route open to anyone, and no third thing.

      test.subHeading('And says nothing the roll did not already say');

      const keys = Object.keys(JSON.parse(JSON.stringify({
        relayPublicKey: R.box.relayPublicKey(),
        relaySealKey: R.box.relaySealKey(),
        relayLabel: R.box.relayLabel(),
      })));

      if (keys.length === 3 && keys.indexOf('peers') === -1) {
        test.check('three fields, and none of them names a member');
      } else {
        test.fail('the door answers ' + JSON.stringify(keys));
      }

      // ── AND THE STATEMENT IS SIGNED (cycle 10, R9) ────────────────
      //
      // The comment on `fetchKey` used to admit what this answer was
      // worth: the re-check "compares against an UNSIGNED answer and so
      // catches nothing an attacker could not forge". Fair while the
      // answer was an identity to pin. Not fair once it carries the key
      // every owner verb — invite tokens included — is sealed to.
      test.subHeading('What the relay says its keys are, it signs');

      {
        const pub = R.box.relayPublicKey();
        const sealKey = R.box.relaySealKey();
        const label = R.box.relayLabel();
        const sig = R.box.relayKeyStatement();

        if (sealKey && sig && auth.relayKeySigned(pub, sealKey, label, sig)) {
          test.check('the box publishes a cipher key and signs it with the identity key beside it');
        } else {
          test.fail('the statement does not verify: ' + JSON.stringify({ sealKey: sealKey, sig: sig }));
        }

        // THE ATTACK: a carrier swapping in its own cipher key so that
        // every post to this relay is sealed to it instead. It cannot
        // sign as the relay, so the statement stops verifying.
        const mallory = auth.generateIdentity('mallory');
        if (!auth.relayKeySigned(pub, mallory.sealPublicKey, label, sig)) {
          test.check('swap the cipher key and the signature no longer holds');
        } else {
          test.fail('THE CIPHER KEY COULD BE SWAPPED — every owner verb would be readable');
        }

        // All three fields are signed together on purpose: a signature
        // over the cipher key alone could be lifted onto another relay's
        // answer, and key and label are a pair besides.
        const lifted = [
          auth.relayKeySigned(mallory.publicKey, sealKey, label, sig),
          auth.relayKeySigned(pub, sealKey, label + 'x', sig),
          auth.relayKeySigned(pub, sealKey, label, ''),
        ].filter(Boolean);
        if (!lifted.length) {
          test.check('and it cannot be lifted onto another identity, another label, or dropped');
        } else {
          test.fail('the statement survived being moved: ' + lifted.length);
        }
      }

      test.reportSuccessFailureCount();
    });
  });
}).catch(function (e) {
  test.fail('threw: ' + (e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
});
