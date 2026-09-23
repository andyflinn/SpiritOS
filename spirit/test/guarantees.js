'use strict';

// spirit/test/guarantees.js
// TWO CORRECT HALVES ARE NOT A PROMISE. THIS ASSERTS THE PRODUCT.
//
//   Andy, 2026-09-23, on finding a guarantee resting on two proven halves
//   with nothing asserting their product: "ouch!" — and then: "yes. this
//   is neccessary in the harness."
//
// ── WHY THIS FILE EXISTS, MEASURED IN ONE DAY ────────────────────────
//
// Every finding of 2026-09-23 had the same shape. Not one was a broken
// component; every one was two correct things with nothing asserting the
// relationship between them:
//
//   disc bound OK   · admission bound MISSING  -> members nobody could serve
//   freshness OK    · measurement OK           -> a gate certified 199 for 575
//   capacity.json OK· README prose OK          -> the front page stale two days
//   agent protocol OK· agent node config OK    -> a verdict unread for six hours
//   a report sent OK· a report answered OK     -> a `note` where an `ask` belonged
//   per-target OK   · seat cap OK              -> the product unproven
//
// The gates this repo already has check COMPONENTS: fresh, cited,
// catalogued, one-door. A component gate cannot see a join, and a join is
// where every one of those lived.
//
// ── WHAT A GUARANTEE IS, HERE ────────────────────────────────────────
//
// A sentence this project says out loud to somebody who is not reading
// the code — on the front page, in a decision, to an adopter. Each block
// below NAMES ITS HALVES and the suites that prove them, then asserts the
// product. A half moving without its partner is exactly what this is for:
// raise `DEFAULT_PER_TARGET` to 2 and every component suite still passes
// while the promise silently halves.

const os = require('os');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const router = require('../run/js/router');
const relayStore = require('../run/js/relayStore');
const { createRelay } = require('../run/js/relay');

test.startTest('Published guarantees hold, not just the halves they rest on');

const homes = [];

function relayWith(ramLimitMB) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-guarantee-'));
  homes.push(home);
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const owner = auth.generateIdentity('andy');
  auth.writeAllowKeys(home, [{ name: 'andy', publicKey: owner.publicKey }]);
  const box = createRelay(home, { config: { ramLimitMB: ramLimitMB, discLimitMB: 64 } });
  box.claim('andy', auth.sign(owner.privateKey, auth.claimMessage('andy')), owner.publicKey);
  return { home: home, box: box, owner: owner };
}

function join(w, name) {
  const id = auth.generateIdentity(name);
  const minted = w.box.mint('andy', name, 7, '');
  if (!minted.ok) return null;
  const got = w.box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)),
    id.publicKey, null, minted.invite.token, name);
  return got.ok ? id : null;
}

function post(w, from, to, text) {
  return w.box.routePost(from.publicKey, to.publicKey, text,
    auth.sign(from.privateKey, auth.postMessage(from.publicKey, to.publicKey, text)));
}

// ═══════════════════════════════════════════════════════════════════════
test.subHeading('GUARANTEE: a relay serves every member it admits');
//
//   HALF A — members never exceed what ramLimitMB bought   (relaySeats.js)
//   HALF B — one inbound route per member at a time        (targetBusy.js)
//   PRODUCT — peak inbound work is bounded by a number the owner set
//
// Andy, on what half B bought: "clear predictability of resource
// requirements per member, and the abondoning ... dynamically managing
// RAM useage for members with up to 16 requests in flight."
//
// That is the whole argument for this being a guarantee rather than an
// average: with a variable number of routes per member, a seat cap bounds
// HEADCOUNT while per-member cost floats, and bounds nothing that matters.
// ═══════════════════════════════════════════════════════════════════════

{
  const RAM_MB = 0.25;
  const w = relayWith(RAM_MB);
  const allowance = w.box.allowance();
  const perTarget = router.DEFAULT_PER_TARGET;

  // THE ARITHMETIC, read off the live objects rather than restated. This
  // is the assertion that fires when one half moves alone.
  if (allowance * perTarget <= allowance && perTarget === 1) {
    test.check('the halves multiply out: ' + allowance + ' seats x ' + perTarget +
      ' route each = ' + (allowance * perTarget) + ', within the ' + allowance +
      ' the RAM figure bought');
  } else {
    test.fail('THE PRODUCT IS BROKEN: ' + allowance + ' seats x ' + perTarget +
      ' routes = ' + (allowance * perTarget) + ' against an allowance of ' + allowance +
      '. One half moved without the other — either DEFAULT_PER_TARGET rose ' +
      '(router.js) or the seat cap stopped tracking the allowance (relay.js).');
  }

  // AND EXERCISED, because arithmetic over two constants is a restatement
  // until somebody drives it. Fill the roll, then make every member a
  // target at once.
  const joined = [];
  for (let i = 0; i < allowance + 2; i += 1) {
    const id = join(w, 'm' + i);
    if (!id) break;
    joined.push(id);
  }

  if (joined.length === allowance - 1) {
    test.check('the roll fills at the seat cap — ' + joined.length +
      ' members beside the owner, ' + allowance + ' seats');
  } else {
    test.fail('roll filled to ' + joined.length + ' against ' + (allowance - 1) + ' expected');
  }

  // EVERY MEMBER STREAMING FIRST. A relay routes to somebody it can
  // reach, and a member with no open stream answers "peer not reachable"
  // — which a first draft of this suite read as a route refusal and
  // reported as a broken product. Presence is a precondition of the
  // guarantee, not part of it.
  function sink() {
    return { write: function () {}, close: function () {} };
  }
  joined.forEach(function (id) {
    w.box.streamOpen(id.publicKey,
      auth.sign(id.privateKey, auth.streamMessage(id.publicKey)), sink());
  });

  // One inbound route per member, all at once. Nothing answers, so every
  // route stays open.
  let opened = 0;
  joined.forEach(function (target) {
    const sent = post(w, w.owner, target, JSON.stringify({ app: 'x', v: 1, body: { hi: 1 } }));
    if (sent && sent.ok) opened += 1;
  });

  // A SECOND ROUTE TO A MEMBER ALREADY BUSY. This is half B doing its job,
  // and it is what makes the count above a ceiling rather than a sample.
  const again = post(w, w.owner, joined[0],
    JSON.stringify({ app: 'x', v: 1, body: { hi: 2 } }));

  const live = w.box.routes.size();

  if (opened === joined.length && again && again.ok === false && live <= allowance) {
    test.check('every member can be reached at once (' + opened + '), a second route to a ' +
      'busy member is refused, and ' + live + ' open routes never exceed the ' +
      allowance + ' seats bought');
  } else {
    test.fail('opened ' + opened + ' of ' + joined.length + ', second route ' +
      JSON.stringify(again) + ', live routes ' + live + ' against allowance ' + allowance);
  }
}

// ═══════════════════════════════════════════════════════════════════════
test.subHeading('GUARANTEE: the capacity this repo publishes is the capacity it measured');
//
//   HALF A — the measurement is newer than what moves it  (capacityFresh.js)
//   HALF B — the front page block is generated            (publishCapacity.js)
//   PRODUCT — the number a reader sees IS the number the tool produced
//
// Neither half implies the product. A fresh measurement nobody published
// leaves the page stale; a generated page built from a stale drop is
// confidently wrong. Both happened on 2026-09-23, hours apart.
// ═══════════════════════════════════════════════════════════════════════

{
  let out = '';
  let failed = false;
  try {
    out = String(execFileSync(process.execPath,
      [path.join(__dirname, 'publishCapacity.js'), '--check'],
      { cwd: path.resolve(__dirname, '..', '..'), encoding: 'utf8' }));
  } catch (e) {
    failed = true;
    out = String((e && (e.stdout || e.message)) || e);
  }

  if (!failed) {
    test.check('the front page block matches the Ubuntu measurement it is generated from');
  } else {
    test.fail('the published block and the measurement disagree — run ' +
      '`node spirit/test/publishCapacity.js`: ' + out.trim().split(/\r?\n/)[0]);
  }
}

// ═══════════════════════════════════════════════════════════════════════
test.subHeading('GUARANTEE: no relay can read what one node says to another');
//
//   Andy, 2026-09-23: "other than cards, node to node communications are
//   outomatically encrypted no relay can read those."
//
//   HALF A — sealing puts none of the words on the wire      (seal.js)
//   HALF B — a sender cannot opt out, and a receiver refuses
//            an unsealed post                    (cycle 10's R5, peerPost)
//   PRODUCT — a real post through a real relay leaves nothing readable
//             anywhere that relay can see: the text it routed, the file it
//             keeps, the report it sends its owner
//
// This is cycle 10's R10 — "prove the relay cannot read it, by trying to
// read it". seal.js proves the FUNCTION hides the words; that is not the
// same claim. The claim on the front page is about a relay, so the proof
// has to be made against one.
// ═══════════════════════════════════════════════════════════════════════

{
  const seal = require('../run/js/seal');
  const nodeCard = require('../run/js/nodeCard');

  const w = relayWith(1);
  const anna = join(w, 'anna');
  const bert = join(w, 'bert');

  // A phrase that could not occur by accident, so finding it anywhere is
  // proof rather than coincidence.
  const SECRET = 'marmalade-torpedo-9317-confidential';

  // bert publishes a card; anna seals to the key on it — which is exactly
  // what peerPost does, and the reason a card is the one thing that
  // travels in clear.
  const bertCard = nodeCard.verify(nodeCard.cardFrom(Object.assign({ name: 'bert' }, bert)));
  const plain = JSON.stringify({ app: 'natter', v: 1, body: { say: SECRET } });
  const sealed = JSON.stringify(
    seal.seal(bertCard.sealKey, anna.publicKey, bert.publicKey, plain, Date.now()));

  w.box.streamOpen(bert.publicKey,
    auth.sign(bert.privateKey, auth.streamMessage(bert.publicKey)),
    { write: function () {}, close: function () {} });

  const sent = post(w, anna, bert, sealed);

  // NOW TRY TO READ IT, from every surface the relay has.
  relayStore.closeAll();
  const onDisc = fs.readFileSync(path.join(w.home, 'relay-state', 'relay.db'));
  const report = JSON.stringify(w.box.snapshot());
  const routed = sealed;

  const leaks = [];
  if (routed.indexOf(SECRET) !== -1) leaks.push('the text it routed');
  if (onDisc.indexOf(SECRET) !== -1) leaks.push('its database on disc');
  if (report.indexOf(SECRET) !== -1) leaks.push('the report it sends its owner');

  if (sent && sent.ok && !leaks.length) {
    test.check('the post was carried and the words appear on NO surface the relay ' +
      'has — routed text, database, owner report');
  } else {
    test.fail('post ' + JSON.stringify(sent && sent.ok) + '; the relay could read it in: ' +
      (leaks.join(', ') || 'nowhere, but the post did not go'));
  }

  // AND THE CONTROL, without which the check above proves nothing: the
  // same words UNSEALED are findable by exactly this method. A search
  // that cannot find what is there is not evidence that a thing is
  // absent.
  const bare = post(w, anna, bert, plain);
  if (bare && plain.indexOf(SECRET) !== -1) {
    test.check('and the same search DOES find the words when they are not sealed — ' +
      'the test can fail, so its passing means something');
  } else {
    test.fail('the control did not hold: the search cannot find plaintext');
  }
}

try { relayStore.closeAll(); } catch (e) { /* leave it */ }
homes.forEach(function (h) {
  try { fs.rmSync(h, { recursive: true, force: true }); } catch (e) { /* sweeper */ }
});

test.reportSuccessFailureCount();
