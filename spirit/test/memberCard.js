'use strict';

// spirit/test/memberCard.js
// A MEMBER ENROLLED BEFORE THE FLAG DAY HANDS OVER ITS CARD.
// Cycle 10's R20.
//
// ── THE DEFECT THIS EXISTS FOR ───────────────────────────────────────
//
// A relay seals its answers to the card on the member's roll row. The
// claim carries one — but a member enrolled before cycle 10 has none. For
// such a member a mint is a silent half-success: the post is accepted
// (202), the reply text is empty, the invite is on disc and the seat
// spent — and the owner never learns the token. **A flag day nobody can
// cross is not a flag day**, so a member may hand over its card.
//
// ── WHAT IS ASSERTED, AND WHY THE LAST ONE IS THE POINT ──────────────
//
// The first checks are about the door: a member may hand over a card, it
// is verified against the key that signed the post, somebody else's card
// is refused, and an older one cannot roll the row back.
//
// The last check is the defect itself: **the same mint that answered with
// silence answers with a token.** Everything above it could pass on a
// relay that still could not talk to its members.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const { sealFor, openBody } = require('./openReply');
const auth = require('../run/spirit/relayAuth');
const nodeCard = require('../run/spirit/nodeCard');
const seal = require('../run/spirit/seal');
const createRelay = require('../run/spirit/relay');
const invites = require('../run/spirit/invites');

test.startTest('A member hands the relay its card, and the relay can answer again');

function sinkFor(bag) {
  return {
    write: function (chunk) {
      const ev = /^event: (.+)$/m.exec(String(chunk));
      const da = /^data: (.+)$/m.exec(String(chunk));
      if (!ev) return;
      let parsed = null;
      try { parsed = da ? JSON.parse(da[1]) : null; } catch (e) { parsed = null; }
      bag.push({ event: ev[1], data: parsed });
    },
    close: function () {},
  };
}

// A relay with an owner and a member, BOTH ENROLLED WITHOUT A CARD —
// the state of a member enrolled before cycle 10.
function worldBeforeTheFlagDay() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-membercard-'));
  fs.mkdirSync(path.join(home, 'spirit', 'state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay'));

  const owner = auth.generateIdentity('andy');
  const bella = auth.generateIdentity('bella');
  auth.writeOwner(home, owner.publicKey);

  const box = createRelay.createRelay(home);
  box.claim('andy', auth.sign(owner.privateKey, auth.claimMessage('andy')), owner.publicKey);
  const minted = box.mint('andy', 'bella', 7, '');
  box.claim('bella', auth.sign(bella.privateKey, auth.claimMessage('bella')),
    bella.publicKey, null, minted.invite.token, 'bella');

  const heard = { andy: [], bella: [] };
  box.streamOpen(owner.publicKey, auth.sign(owner.privateKey, auth.streamMessage(owner.publicKey, box.relayPublicKey())), sinkFor(heard.andy));
  box.streamOpen(bella.publicKey, auth.sign(bella.privateKey, auth.streamMessage(bella.publicKey, box.relayPublicKey())), sinkFor(heard.bella));

  return { home: home, box: box, owner: owner, bella: bella, heard: heard };
}

// A post to the relay, sealed like every other (cycle 10, R9).
function ask(w, who, body) {
  const relayKey = w.box.relayPublicKey();
  const text = sealFor(who, w.box, JSON.stringify({ app: 'relay', v: 1, body: body }));
  return w.box.routePost(who.publicKey, relayKey, text,
    auth.sign(who.privateKey, auth.postMessage(who.publicKey, relayKey, text)));
}

function lastAnswer(w, who, bag, sent) {
  const reply = bag.filter(function (m) {
    return m.event === 'reply' && m.data && m.data.hash === sent.hash;
  }).pop();
  return reply ? openBody(who, w.box.relayPublicKey(), reply.data.text) : null;
}

test.subHeading('THE DEFECT: a relay mints in silence for a member it cannot seal to');

const w = worldBeforeTheFlagDay();

{
  const before = invites.load(w.home).length;
  const sent = ask(w, w.owner, { invite: { label: 'friend', days: 7, token: '' } });
  const answered = lastAnswer(w, w.owner, w.heard.andy, sent);
  const after = invites.load(w.home).length;

  // THE SEAT IS SPENT AND THE OWNER LEARNS NOTHING. Asserted rather than
  // described, because it is the thing being fixed and it must be visible
  // if it ever comes back.
  if (sent.ok && after === before + 1 && answered === null) {
    test.check('an invite is minted, the seat is spent, and the owner is answered with nothing');
  } else {
    test.fail('expected a silent half-success: sent ' + JSON.stringify(sent) +
      ', rows ' + before + '->' + after + ', answer ' + JSON.stringify(answered));
  }
}

test.subHeading('AND THE ONE PLAIN SENTENCE SAYS NOTHING ABOUT THE RELAY');

{
  // A refusal must still be heard when it cannot be sealed, or an old box
  // cannot tell a flag day from a broken relay. But the VERB'S own
  // sentence must not travel in clear: a SEALED asker with no card on file
  // reaches a verb, and refusal sentences in this tree name the relay's
  // condition (megabytes free and needed, the disc guard, the obstruction
  // on a full relay). Decision 0006 says that is the owner's business.
  //
  // bella is enrolled, sealed and cardless, and asks for an invite she
  // has no standing to mint. The VERB refuses her as not the owner.
  const sent = ask(w, w.bella, { invite: { label: 'cheeky', days: 7, token: '' } });
  const raw = w.heard.bella.filter(function (m) {
    return m.event === 'reply' && m.data && m.data.hash === sent.hash;
  }).pop();
  const said = raw ? JSON.parse(raw.data.text).body : null;

  if (said && said.ok === false && said.status === 428 &&
      said.error === 'this relay holds no card for you, so it cannot seal a reply') {
    test.check('the plain refusal is ONE fixed sentence and one fixed status, whatever the verb said');
  } else {
    test.fail('the plain refusal was not the fixed one: ' + JSON.stringify(said));
  }

  // The point stated as its own assertion, so it fails loudly rather than
  // as a string mismatch if the sentence ever passes through.
  if (said && !/owner|not your/i.test(String(said.error))) {
    test.check('and it carries no trace of the verb refusal underneath it');
  } else {
    test.fail('the verb\'s own sentence reached the wire: ' + JSON.stringify(said));
  }
}

test.subHeading('The member hands over its card');

{
  const card = nodeCard.cardFrom(Object.assign({ name: 'bella' }, w.bella));
  const sent = ask(w, w.bella, { card: card });
  const said = lastAnswer(w, w.bella, w.heard.bella, sent);

  // ANY MEMBER MAY, not only the owner: everybody needs a card on their
  // row or the relay can answer none of them.
  if (said && said.ok && said.card === 'taken') {
    test.check('a member — not the owner — hands over its card and the relay takes it');
  } else {
    test.fail('handover: ' + JSON.stringify(said));
  }
}

test.subHeading('And only its own, and only forward');

{
  // SOMEBODY ELSE'S CARD. It verifies perfectly — it is a real card — and
  // it is not this sender's, which is the only thing wrong with it. The
  // check is the same one the claim route makes, which is why it is the
  // same function.
  const notHers = nodeCard.cardFrom(Object.assign({ name: 'andy' }, w.owner));
  const sent = ask(w, w.bella, { card: notHers });
  const said = lastAnswer(w, w.bella, w.heard.bella, sent);
  if (said && said.ok === false && /not yours/.test(said.error || '')) {
    test.check('a valid card belonging to somebody else is refused — a member delivers only its own');
  } else {
    test.fail('somebody else\'s card: ' + JSON.stringify(said));
  }
}

{
  // A ROLLBACK (cycle 10, condition C1). bella rotates; then the OLD card is
  // re-served. It still verifies — a downgrade needs no forgery, only a
  // copy, possibly back to the very key whose compromise caused the
  // rotation.
  const old = nodeCard.cardFrom(Object.assign({ name: 'bella' }, w.bella));
  const fresh = auth.generateIdentity('bella');
  // THE IDENTITY KEY DOES NOT MOVE — only the cipher key does. That is
  // what a rotation IS, and it is why the roll can accept one: the card
  // still verifies against the key the row is filed under.
  const rotated = Object.assign({}, w.bella, {
    sealPublicKey: fresh.sealPublicKey,
    sealPrivateKey: fresh.sealPrivateKey,
    cardAt: 2,
  });
  const newer = nodeCard.cardFrom(rotated);

  // AND THE ANSWER COMES BACK SEALED TO THE NEW KEY, which is the whole
  // consequence of rotating: a node that rotates without holding the new
  // private key has made itself unreachable, politely.
  const up = lastAnswer(w, rotated, w.heard.bella, ask(w, w.bella, { card: newer }));
  if (up && up.ok && up.at === 2) {
    test.check('a card with a higher counter replaces the one on the row — which is where rotation will live');
  } else {
    test.fail('rotation: ' + JSON.stringify(up));
  }

  const back = lastAnswer(w, rotated, w.heard.bella, ask(w, w.bella, { card: old }));
  if (back && back.ok === false && /not newer/.test(back.error || '')) {
    test.check('and the old card is refused afterwards — a copy is not a forgery, and must not be enough');
  } else {
    test.fail('rollback: ' + JSON.stringify(back));
  }
}

test.subHeading('THE POINT: the silence is cured');

{
  // The owner had no card either — it enrolled before the flag day too.
  const ownerCard = nodeCard.cardFrom(Object.assign({ name: 'andy' }, w.owner));
  ask(w, w.owner, { card: ownerCard });

  const before = invites.load(w.home).length;
  const sent = ask(w, w.owner, { invite: { label: 'second', days: 7, token: '' } });
  const answered = lastAnswer(w, w.owner, w.heard.andy, sent);
  const after = invites.load(w.home).length;

  if (sent.ok && after === before + 1 && answered && answered.ok &&
      answered.invite && answered.invite.token) {
    test.check('the same mint that answered with silence now answers with the token — the flag day can be crossed');
  } else {
    test.fail('after the handover: ' + JSON.stringify(answered) + ', rows ' + before + '->' + after);
  }
}

try {
  require('../run/spirit/relayStore').closeAll();
  fs.rmSync(w.home, { recursive: true, force: true });
} catch (e) { /* leave it for the sweeper */ }

test.reportSuccessFailureCount();
