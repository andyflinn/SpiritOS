'use strict';

// spirit/test/sealedLayering.js
// THE ORDER OF THE LAYERS, AND THAT NOBODY IS EXEMPT FROM THEM.
// Cycle 10's R11 and R7.
//
//   Andy, 2026-09-23: "This also means: careful where the signing happens,
//   and, the relay cannot possibly hash check the payload unless it's the
//   target." — and "the hashing must sit outside of the cyphering."
//
// ── THE LAYERING, AND WHY EACH LAYER IS WHERE IT IS ──────────────────
//
//     plaintext
//       └─ sealed        X25519 + AES-GCM, sender and recipient as AAD
//            └─ signed   the sender's Ed25519 over the SEALED bytes
//                 └─ hashed   SHA-256 of what travels
//
// Every layer outside the seal operates on bytes it cannot read, which is
// what lets a relay do its whole job — verify, register, route, receipt —
// without ever holding a word. Put the hash inside and the relay would
// need the plaintext to compute it, which is the thing this cycle exists
// to prevent.
//
// A SIGNATURE OVER THE PLAINTEXT would be a signature nobody on the path
// could check: the relay verifies before it routes and will never hold the
// plaintext again, so it would be forwarding unauthenticated bytes.
//
// ── AND cycle 10's R7: NO EXEMPTIONS, WHICH IS A COUNT AND NOT AN OPINION ───────
//
//   "No special case, no exemption: the two Claudes' traffic is sealed
//   because all peer traffic is."
//
// The agents seal not because `agents.js` was taught to, but because it
// posts through the same door as everybody else. The way to assert that
// is to count the places where sealing can be turned OFF — one, with a
// reason — rather than to test the agents specifically, which would prove
// only that the agents are fine today.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const seal = require('../run/js/seal');
const nodeCard = require('../run/js/nodeCard');
const relayStore = require('../run/js/relayStore');
const { createRelay } = require('../run/js/relay');

test.startTest('Sealed, then signed, then hashed — and nobody is exempt');

const homes = [];

function world() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-layer-'));
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

test.subHeading('THE HASH IS OVER WHAT TRAVELS, which is the ciphertext');

{
  const w = world();
  const anna = join(w, 'anna');
  const bert = join(w, 'bert');
  w.box.streamOpen(bert.publicKey,
    auth.sign(bert.privateKey, auth.streamMessage(bert.publicKey)),
    { write: function () {}, close: function () {} });

  const plaintext = JSON.stringify({ app: 'natter', v: 1, body: { say: 'the layering' } });
  const card = nodeCard.verify(nodeCard.cardFrom(Object.assign({ name: 'bert' }, bert)));
  const sealed = JSON.stringify(
    seal.seal(card.sealKey, anna.publicKey, bert.publicKey, plaintext, Date.now()));

  const sent = w.box.routePost(anna.publicKey, bert.publicKey, sealed,
    auth.sign(anna.privateKey, auth.postMessage(anna.publicKey, bert.publicKey, sealed)));

  const overSealed = auth.requestHash(auth.postMessage(anna.publicKey, bert.publicKey, sealed));
  const overPlain = auth.requestHash(auth.postMessage(anna.publicKey, bert.publicKey, plaintext));

  if (sent && sent.ok && sent.hash === overSealed && sent.hash !== overPlain) {
    test.check('the hash the relay registered is of the SEALED bytes, not of the words — ' +
      'everything built on it (replay, receipts, the route table) works on what travelled');
  } else {
    test.fail('hash ' + (sent && sent.hash) + ' vs sealed ' + overSealed + ' vs plain ' + overPlain);
  }

  // The relay could not have computed the other one. Stated as an
  // assertion rather than a comment because it is the sentence Andy used:
  // "the relay cannot possibly hash check the payload unless it's the
  // target."
  if (seal.open(bert.sealPrivateKey, anna.publicKey, bert.publicKey, sealed).text === plaintext &&
      sealed.indexOf('the layering') === -1) {
    test.check('and the plaintext hash is one the relay could not have computed — the words are not in what it held');
  } else {
    test.fail('the sealed form leaked the plaintext, or did not open');
  }
}

test.subHeading('A SIGNATURE OVER THE PLAINTEXT is refused — sealed first, signed second');

{
  const w = world();
  const anna = join(w, 'anna');
  const bert = join(w, 'bert');
  w.box.streamOpen(bert.publicKey,
    auth.sign(bert.privateKey, auth.streamMessage(bert.publicKey)),
    { write: function () {}, close: function () {} });

  const plaintext = JSON.stringify({ app: 'natter', v: 1, body: { say: 'wrong order' } });
  const card = nodeCard.verify(nodeCard.cardFrom(Object.assign({ name: 'bert' }, bert)));
  const sealed = JSON.stringify(
    seal.seal(card.sealKey, anna.publicKey, bert.publicKey, plaintext, Date.now()));

  // THE LAYERS IN THE WRONG ORDER: the bytes that travel are sealed, but
  // the signature was made over the plaintext — a node that signed before
  // it sealed. Nothing on the path can check that signature, because
  // nothing on the path has the plaintext.
  const wrongOrder = w.box.routePost(anna.publicKey, bert.publicKey, sealed,
    auth.sign(anna.privateKey, auth.postMessage(anna.publicKey, bert.publicKey, plaintext)));

  if (wrongOrder && wrongOrder.ok === false) {
    test.check('a post whose signature was made before sealing is refused — the relay would ' +
      'otherwise be forwarding bytes nobody vouched for');
  } else {
    test.fail('a signature over the plaintext was accepted: ' + JSON.stringify(wrongOrder));
  }

  // THE CONTROL, without which the above proves only that something was
  // refused: the same packet signed in the right order goes through.
  const rightOrder = w.box.routePost(anna.publicKey, bert.publicKey, sealed,
    auth.sign(anna.privateKey, auth.postMessage(anna.publicKey, bert.publicKey, sealed)));

  if (rightOrder && rightOrder.ok) {
    test.check('and the same bytes signed AFTER sealing are carried — the refusal is about order, not content');
  } else {
    test.fail('the correctly signed post was refused: ' + JSON.stringify(rightOrder));
  }
}

test.subHeading("cycle 10's R7: exactly one place in the tree can turn sealing off");

{
  // Counted, not argued. The agents seal because they post through the
  // same door as everybody else — so what must be asserted is that the
  // door has ONE documented bypass, not that the agents are currently
  // fine.
  //
  // `oneDoor.js` counts implementations for the same reason (cycle 10's
  // R8 amended, same cycle). This is that discipline pointed at an exemption.
  const root = path.resolve(__dirname, '..', 'run', 'js');
  const found = [];
  (function walk(dir) {
    fs.readdirSync(dir).forEach(function (name) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) return walk(p);
      if (!name.endsWith('.js')) return;
      const text = fs.readFileSync(p, 'utf8');
      text.split(/\r?\n/).forEach(function (line, i) {
        // The switch being SET false — not its definition, and not a
        // comment about it.
        if (/sealsPosts\s*:\s*false/.test(line) && !/^\s*\/\//.test(line)) {
          found.push(path.relative(root, p) + ':' + (i + 1));
        }
      });
    });
  }(root));

  if (found.length === 1 && /relayServer\.js/.test(found[0])) {
    test.check('one bypass, in relayServer.js (' + found[0] + ') — the relay-to-relay partner ' +
      'wrapper, which carries a query and never a person\'s words');
  } else {
    test.fail('sealing can be turned off in ' + found.length + ' place(s): ' + found.join(', ') +
      '. Every one that is not the partner wrapper is an exemption somebody granted themselves.');
  }

  // AND THE AGENTS HAVE NO OPINION ABOUT SEALING AT ALL, which is the
  // point of that requirement: they are sealed by not being special. A mention of
  // sealing in the agents program would mean somebody had taught it a
  // rule it should have inherited.
  const agents = fs.readFileSync(
    path.join(__dirname, '..', 'run', 'process', 'js', 'agents', 'agents.js'), 'utf8');
  const codeLines = agents.split(/\r?\n/).filter(function (l) {
    return !/^\s*\/\//.test(l) && /\bseal|sealsPosts|cipher/i.test(l);
  });

  if (!codeLines.length) {
    test.check('and agents.js contains no sealing code whatsoever — the two Claudes are sealed ' +
      'because all peer traffic is, which is exactly what cycle 10 asks for');
  } else {
    test.fail('agents.js has grown its own opinion about sealing: ' + codeLines.join(' | '));
  }
}

try { relayStore.closeAll(); } catch (e) { /* leave it */ }
homes.forEach(function (h) {
  try { fs.rmSync(h, { recursive: true, force: true }); } catch (e) { /* sweeper */ }
});

test.reportSuccessFailureCount();
