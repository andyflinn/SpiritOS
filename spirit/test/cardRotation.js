'use strict';

// spirit/test/cardRotation.js
// GET THE DAMN ROTATE-BUTTON INTO THE INFO APP (cycle 10's R13).
//
//   Andy's title for it, in Desk, 2026-09-27. And his rulings: "so rotation
//   is a crisis.measure and should not be used wastefully", "peers get it on
//   demand. good.", "the rotating node must hand its new card to every relay
//   straight away when it rotates".
//
// Built by claude-windows at 0a2a90b. This is the tester's suite, from the
// scheme agreed before a line was written. Two nodes and a relay from
// cardWorld.js, with the real contacts book: nothing planted that the code
// under test did not have to fetch and verify.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const nodeCard = require('../run/js/nodeCard');
const contacts = require('../run/js/contacts');
const trafficLog = require('../run/js/trafficLog');
const errors = require('../run/js/spiritErrors');
const { fakeRelay, nodeFor, plantCardOf } = require('./cardWorld.js');

test.startTest('A node rotates its cipher key, and every peer moves to the new one exactly once');

function cardAtOf(home) { const f = nodeCard.verify(nodeCard.describe(home)); return f ? f.at : 0; }
function sealKeyOf(home) { return auth.loadIdentity(home).sealPublicKey; }
function asksFrom(relay, key) {
  return relay.wire.filter(function (w) { return w.from === key && nodeCard.asks(w.text); }).length;
}
function postsFrom(relay, key, to) {
  return relay.wire.filter(function (w) {
    return w.from === key && w.to === to && /\/api\/relay\/post$/.test(w.pathname) && !nodeCard.asks(w.text);
  }).length;
}
function everyFileUnder(dir) {
  const out = [];
  (function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach(function (e) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else out.push(p);
    });
  }(dir));
  return out;
}

(async function () {
  // ── THE ROTATE ITSELF ──────────────────────────────────────────────
  {
    const relay = fakeRelay();
    const n = nodeFor('rotator', relay);
    const oldPrivate = auth.loadIdentity(n.home).sealPrivateKey;
    const oldPublic = sealKeyOf(n.home);
    const at0 = cardAtOf(n.home);
    const r1 = nodeCard.rotate(n.home);
    const at1 = cardAtOf(n.home);
    const r2 = nodeCard.rotate(n.home);
    const at2 = cardAtOf(n.home);
    if (r1.ok && r2.ok && sealKeyOf(n.home) !== oldPublic && at1 > at0 && at2 > at1) {
      test.check('rotate replaces the cipher key and the card counter rises strictly each time (' + at0
        + ' → ' + at1 + ' → ' + at2 + ') — the order that makes an old card lose');
    } else {
      test.fail('rotate: ' + JSON.stringify([r1, r2]) + ', counters ' + [at0, at1, at2].join(' → '));
    }
    // "Crisis measure, no grace": the old private key must not survive anywhere.
    const holders = everyFileUnder(path.join(n.home, 'relay-state')).filter(function (f) {
      try { return fs.readFileSync(f, 'utf8').indexOf(oldPrivate) !== -1; } catch (e) { return false; }
    });
    if (!holders.length) {
      test.check('the old private key is in no file under relay-state after rotating — no backup, no '
        + 'temp copy, nothing an intruder could take instead');
    } else {
      test.fail('the discarded private key survives in: ' + holders.join(', '));
    }
  }

  // ── HISTORY SURVIVES THE KEY ───────────────────────────────────────
  {
    const relay = fakeRelay();
    const n = nodeFor('historian', relay);
    const log = trafficLog.createTrafficLog({ rootDir: n.home });
    log.note({ dir: 'in', kind: 'request', peer: 'P', hash: 'before-rotation', outcome: 'delivered',
      admitted: true, payload: 'words received before the key changed' });
    nodeCard.rotate(n.home);
    const got = log.history({}).rows.filter(function (r) { return r.hash === 'before-rotation'; })[0];
    if (got && got.payload === 'words received before the key changed') {
      test.check('a message received before the rotation still reads in history afterwards — messages '
        + 'are kept opened, so discarding the old key loses nothing already received');
    } else {
      test.fail('history after rotation: ' + JSON.stringify(got));
    }
  }

  // ── A PEER HOLDING THE OLD CARD MOVES TO THE NEW ONE, ONCE ─────────
  {
    const relay = fakeRelay();
    const a = nodeFor('sender', relay);
    const b = nodeFor('rotated', relay);
    plantCardOf(a, b);
    const oldCard = nodeCard.describe(b.home);
    const oldKey = a.sealKeyHeldFor(b.id.publicKey);
    nodeCard.rotate(b.home);
    const newKey = sealKeyOf(b.home);

    const r = await a.P.post('http://relay', b.id.publicKey, 'sealed first to the key that was thrown away');
    const asks = asksFrom(relay, a.id.publicKey);
    const posts = postsFrom(relay, a.id.publicKey, b.id.publicKey);
    const held = a.sealKeyHeldFor(b.id.publicKey);
    if (r && r.ok && asks === 1 && posts === 2 && held === newKey && held !== oldKey) {
      test.check('after the peer rotates, a message sealed to its old key is refused once, the sender asks '
        + 'ONCE for the new card, keeps it, and re-sends ONCE — two posts and one ask on the wire');
    } else {
      // Say WHERE the refusal was, because the cause is not in the numbers.
      let inside = null;
      try { inside = JSON.parse(String(r && r.text || '')).body; } catch (e) { inside = null; }
      test.fail('THE SENDER WAS TOLD IT WAS DELIVERED: its answer reads ok=' + (r && r.ok) + ' status '
        + (r && r.status) + ', but the peer\'s refusal is INSIDE answer.text — '
        + JSON.stringify(inside) + '. staleCard reads answer.ok/code/error at the top level, which '
        + 'belong to the transport ("a reply arrived"), so the re-ask never fires: ' + asks + ' asks, '
        + posts + ' post, new key held ' + (held === newKey) + '. The checks below that depend on the '
        + 're-ask fail for this one reason');
    }

    // THE PAIR: the old card is dead now, not merely unused.
    const back = contacts.setCard(a.home, b.id.publicKey, oldCard, 'reply');
    if (back && !back.ok && back.why === 'not newer' && a.sealKeyHeldFor(b.id.publicKey) === newKey) {
      test.check('and the OLD card handed back later is refused as not newer — the new one being taken '
        + 'proves nothing on its own about the old one dying');
    } else {
      test.fail('old card after rotation: ' + JSON.stringify(back));
    }

    // AND NO FURTHER ASK once the current card is held.
    const before = asksFrom(relay, a.id.publicKey);
    const r2 = await a.P.post('http://relay', b.id.publicKey, 'now sealed to the current key');
    if (r2 && r2.ok && asksFrom(relay, a.id.publicKey) === before) {
      test.check('a sender already holding the current card asks nothing more');
    } else {
      test.fail('with the current card held: ok=' + (r2 && r2.ok) + ', asks went ' + before + ' → '
        + asksFrom(relay, a.id.publicKey));
    }
  }

  // ── A BURST AFTER ROTATION SHARES ONE ASK ──────────────────────────
  {
    const relay = fakeRelay();
    const a = nodeFor('burst-sender', relay);
    const b = nodeFor('burst-rotated', relay);
    plantCardOf(a, b);
    nodeCard.rotate(b.home);
    const posts = [];
    for (let i = 1; i <= 5; i += 1) posts.push(a.P.post('http://relay', b.id.publicKey, 'burst ' + i));
    const answers = await Promise.all(posts);
    const ok = answers.filter(function (x) { return x && x.ok; }).length;
    const asks = asksFrom(relay, a.id.publicKey);
    if (ok === 5 && asks === 1) {
      test.check('five messages fired together after the peer rotated all arrive, on ONE shared ask');
    } else {
      test.fail('burst after rotation: ' + ok + ' of 5 arrived on ' + asks + ' ask(s)');
    }
  }

  // ── NO LOOP: A PEER THAT ANSWERS WITH THE SAME CARD ────────────────
  //
  // Built by hand: the peer's private key is new (so the message will not
  // open) but its published card is put back to the old one (so the answer
  // to the ask is the same card). The refusal must stand, with one ask.
  {
    const relay = fakeRelay();
    const a = nodeFor('loop-sender', relay);
    const b = nodeFor('loop-peer', relay);
    plantCardOf(a, b);
    const before = auth.loadIdentity(b.home);
    nodeCard.rotate(b.home);
    const after = auth.loadIdentity(b.home);
    after.sealPublicKey = before.sealPublicKey;
    after.cardAt = before.cardAt;
    auth.saveIdentity(b.home, after);

    const r = await a.P.post('http://relay', b.id.publicKey, 'a peer that will not hand out a newer card');
    const asks = asksFrom(relay, a.id.publicKey);
    if (r && !r.ok && asks === 1) {
      test.check('when the peer answers the ask with the same card, the refusal stands after ONE ask — '
        + 'no second ask, no loop (' + (r.code || r.error) + ')');
    } else {
      test.fail('same-card answer: ok=' + (r && r.ok) + ', asks ' + asks + ' — '
        + (asks > 1 ? 'IT ASKED AGAIN' : 'unexpected outcome ' + JSON.stringify(r)));
    }
  }

  // ── "WILL NOT OPEN" IS A WAIT NOW, SO THE QUEUE KEEPS THE REPORT ───
  {
    const said = errors.classify(400, 'this did not open for me', {});
    if (said && said.code === 'will-not-open' && said.retry === 'after') {
      test.check('will-not-open is retry "after" now that a stale card can be replaced — so an agent\'s '
        + 'queued report meeting it is KEPT, not destroyed (the lost-reports bug, by another door)');
    } else {
      test.fail('will-not-open classified as ' + JSON.stringify(said && { code: said.code, retry: said.retry }));
    }
  }

  test.reportSuccessFailureCount();
}());
