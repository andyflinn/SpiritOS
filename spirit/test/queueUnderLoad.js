'use strict';

// spirit/test/queueUnderLoad.js
// ONE NODE, FIRING WIDE, AT TARGETS THAT SAY NOTHING — OVER A REAL SOCKET.
//
//   Andy: "massive load through one node will test the scheduler best."
//   Andy: "if you fire all at once, the queing and scheduling will be put
//   to the test."
//   Andy: "i see node request q-ing/scheduling, verification that
//   not-available errors causes re-scheduling of the request."
//
// The verification the whole gap cycle was scoped around (R19), and the
// companion to targetBusy.js. They test opposite halves and neither
// substitutes for the other:
//
//   targetBusy.js       TWO nodes at ONE target — the RELAY's refusal
//   this file           ONE node at MANY targets — the NODE's queue
//
// ── WHY THIS IS NOT postQueue.js ─────────────────────────────────────
//
// postQueue.js proves the decision structure in memory, across ten
// sections: ordering, ties, class before age, per-pair backoff, patience,
// head-of-line, the monotonic clock, refusal at the door. All of it
// passes with no socket in sight, and all of it would pass with this
// shipped broken.
//
// What it cannot reach is the wiring: that peerPost actually consults the
// queue before going, actually releases the slot when an attempt ends,
// and actually lets the next one go. Those are three chances for a queue
// to be perfect and unused — which is precisely how the tree found R8
// built and R21 misdiagnosed three times. So every byte here crosses a
// loopback socket, and the targets are real members holding real streams.
//
// ── WHAT A GREEN RUN PROVES ──────────────────────────────────────────
//
//   1. one request in flight at a time, from this node, whatever the
//      caller asks for — asserted from the far side, by what the targets
//      actually receive
//   2. a target that never answers does not keep the node: the attempt
//      ends on its own budget and the slot is returned
//   3. every intent is attempted — a burst does not starve its own tail
//   4. a target that ANSWERS is served even though it was asked for last,
//      because a stalled pair backs off and stops holding the slot
//   5. the node survives its own burst: nothing throws, nothing hangs,
//      and every promise settles
//
// ── PATIENCE COMES FROM THE NODE, NOT FROM AN APP ────────────────────
//
// 0020: the scheduler is not a client surface. `hub.js` posts with no
// options today, so the retry path is built and unreachable in a running
// node, and the repair is an OWNER's setting rather than an argument
// every caller must think about. This fixture therefore sets patience the
// way a node will — once, for the whole run — and does not invent an
// app-facing knob in order to test itself.

const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const { rememberKeys, sealKeyFor } = require('./openReply');
const nodeCard = require('../run/js/nodeCard');
const auth = require('../run/js/relayAuth');
const { claimOwner } = require('./ownerClaim');
const hub = require('../run/js/hub');
const buildStamp = require('../run/js/buildStamp');
const plantRun = require('./plantRun');
const sseClient = require('../run/js/sseClient');
const peerPost = require('../run/js/peerPost');
const { createRelay } = require('../run/js/relay');

// Below 49152, outside Windows' ephemeral range — see presenceWire.js:41
// for what a port inside it costs, and targetBusy.js for the neighbour.
const PORT = 48783;

// SHORT ON PURPOSE, AND IT IS THE NODE ASKING. R5 made the timeout a
// diminishing duration carried in the envelope, so a node that asks for
// 900ms gets 900ms and the relay's 5s ceiling never applies. That is what
// keeps a suite with three stalling targets under a few seconds instead
// of under a minute — and it exercises the budget rather than avoiding it.
const BUDGET_MS = 900;
const PATIENCE_MS = 6000;

let kids = [];
let streams = [];
function cleanup() {
  streams.forEach(function (s) { try { s.close(); } catch (e) { /* gone */ } });
  streams = [];
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  kids = [];
}
process.on('exit', cleanup);

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function buildRelay(memberNames) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-qul-'));
  const box = createRelay(home);
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const owner = auth.generateIdentity('owner');
  claimOwner(box, owner, 'owner', 'fx-owner');
  const members = {};
  memberNames.forEach(function (name) {
    // Registered so this node can seal to them (cycle 10, R5), and
    // enrolled with a card so the relay can seal back.
    const id = rememberKeys(auth.generateIdentity(name));
    const minted = box.mint('owner', name, 7, '');
    box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)),
      id.publicKey, 'fx-' + name, minted.invite.token, name,
      nodeCard.cardFrom(Object.assign({ name: name }, id)));
    members[name] = id;
  });
  return { home: home, box: box, owner: owner, members: members };
}

function plant(w) {
  const runDir = path.join(w.home, 'spirit', 'run');
  plantRun.plantRunTree(runDir);
  fs.rmSync(path.join(runDir, 'relay-state'), { recursive: true, force: true });
  fs.cpSync(path.join(w.home, 'relay-state'), path.join(runDir, 'relay-state'),
    { recursive: true });
  const mine = buildStamp.fromGit(path.join(__dirname, '..', '..'));
  if (mine) buildStamp.write(runDir, mine);
  w.runDir = runDir;
}

// stderr is kept, not ignored — partnerWire.js records what discarding it
// cost: `listen EACCES` was invisible and read as a regression.
async function startRelay(w, port) {
  const kid = spawn(process.execPath, ['js/server.js', '--port', String(port), '--relay'],
    { cwd: w.runDir, stdio: ['ignore', 'ignore', 'pipe'] });
  kids.push(kid);
  w.why = '';
  kid.stderr.on('data', function (b) { w.why += String(b); });
  const base = 'http://127.0.0.1:' + port;
  for (let n = 0; n < 40; n += 1) {
    await sleep(200);
    try {
      const r = await hub.relayRequest(base, 'GET', '/api/relay/key', null);
      if (r.status === 200) {
        // ── IS THIS THE RELAY WE STARTED? ───────────────────────────
        //
        // A 200 on the port is not the same question. Measured
        // 2026-09-23: a relay leaked by an INTERRUPTED earlier run of
        // this same suite was still holding the port, so the suite
        // started its own relay (which could not bind), talked to the
        // squatter, and every post came back "no such identity" —
        // because the squatter had never heard of these members.
        //
        // That diagnosis cost a bisect across two commits and a wrong
        // hypothesis about a production change. The port collision was
        // reported as an identity failure, which is the least helpful
        // true thing it could have said.
        //
        // So: the key is compared. A stranger on the port fails HERE,
        // by name, with the thing an operator has to do.
        let said = null;
        try { said = JSON.parse(r.text).relayPublicKey; } catch (e) { said = null; }
        const mine = w.box.relayPublicKey();
        if (said && mine && said !== mine) {
          w.why = 'port ' + port + ' is held by a DIFFERENT relay (' +
            String(said).slice(0, 16) + '… not ' + String(mine).slice(0, 16) +
            '…) — almost certainly one leaked by an interrupted run. ' +
            'Stop that process and run again; nothing in the tree is wrong.';
          return null;
        }
        w.base = base;
        return base;
      }
    } catch (e) { /* not up yet */ }
  }
  return null;
}

// A MEMBER WHO IS PRESENT AND SAYS NOTHING — targetBusy.js's fixture, and
// the reason it is the right one: an ABSENT target is refused before the
// router is ever consulted (0006, "peer not reachable"), so loading a
// queue needs people who are unquestionably there and simply slow.
//
// `answers` makes one of them cooperative, which is how claim 4 is
// observed: the stalled pairs back off, and the one that replies gets the
// slot even though it was asked for last.
function member(w, identity, answers) {
  const seen = { arrived: [], at: [] };
  const s = sseClient.connect({
    url: w.base + '/api/relay/stream?key=' + encodeURIComponent(identity.publicKey),
    headers: function () {
      return {
        'X-Spirit-Sig': auth.sign(identity.privateKey, auth.streamMessage(identity.publicKey)),
      };
    },
    onEvent: function (msg) {
      if (msg.event !== 'request') return;
      seen.arrived.push(msg.data);
      seen.at.push(Date.now());
      if (!answers) return;

      // ── THE HASH IS DERIVED, NEVER RECEIVED ──────────────────
      //
      // relay.js:3123: "NO HASH IS SENT. The target derives it from the
      // bytes it holds, which is what makes it evidence rather than an
      // echo (ROUTER.md §2)."
      //
      // So this does what peerPost.onRequest does: recover the signed
      // message the signature was made over, then hash that. A fixture
      // that took a hash off the wire would be testing an echo, and would
      // have passed against a relay that sent the wrong one.
      const verified = auth.postSignatureFor(
        msg.data.from, msg.data.from, msg.data.to, msg.data.text, msg.data.sig
      );
      if (!verified) return;
      const hash = auth.requestHash(verified);
      hub.relayRequest(w.base, 'POST', '/api/relay/reply', {
        from: identity.publicKey,
        hash: hash,
        text: 'ok',
        sig: auth.sign(identity.privateKey, auth.receiptMessage(hash)),
      }).catch(function () { /* the assertion is what arrived, not what landed */ });
    },
  });
  seen.close = function () { try { s.close(); } catch (e) { /* gone */ } };
  streams.push(seen);
  return seen;
}

// The sending node, built the way server.js builds it: a real peerPost
// whose `request` is the real HTTP client, and a real stream carrying the
// replies back. Nothing here is a stub except the traffic log's absence.
function sender(w, identity) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-qul-node-'));
  auth.saveIdentity(home, identity);
  const P = peerPost.createPeerPost({
    sealKeyFor: sealKeyFor,
    rootDir: home,
    request: hub.relayRequest,
    waitMs: 2000,
  });
  const s = sseClient.connect({
    url: w.base + '/api/relay/stream?key=' + encodeURIComponent(identity.publicKey),
    headers: function () {
      return {
        'X-Spirit-Sig': auth.sign(identity.privateKey, auth.streamMessage(identity.publicKey)),
      };
    },
    onEvent: function (msg) {
      if (msg.event === 'reply') P.onReply(msg.data);
      else if (msg.event === 'request') P.onRequest(w.base, msg.data);
    },
  });
  streams.push({ close: function () { try { s.close(); } catch (e) { /* gone */ } } });
  return P;
}

async function until(fn, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return true; await sleep(50); }
  return !!fn();
}

test.startTest('One node firing wide — the scheduler, over a socket');

async function run() {
  const W = buildRelay(['sender', 'stall1', 'stall2', 'stall3', 'quick']);
  plant(W);
  if (!(await startRelay(W, PORT))) {
    test.fail('the relay did not come up on ' + PORT +
      (String(W.why || '').trim()
        ? ' — it said: ' + String(W.why).trim()
        : ' — and said nothing on stderr'));
    cleanup();
    test.reportSuccessFailureCount();
    return;
  }

  const stalls = [
    member(W, W.members.stall1, false),
    member(W, W.members.stall2, false),
    member(W, W.members.stall3, false),
  ];
  const quick = member(W, W.members.quick, true);
  const P = sender(W, W.members.sender);
  await sleep(400);   // every stream open before anything is posted

  test.subHeading('A burst of five, and one in flight at a time');

  // FIRED ALL AT ONCE, which is the instruction: "if you fire all at
  // once, the queing and scheduling will be put to the test." Nothing is
  // awaited between them, so the queue receives them as a burst and the
  // sequence — not the clock — is what orders the ties.
  //
  // The cooperative target is asked LAST on purpose. Under a cap of one
  // it has four ahead of it, every one of which will stall.
  const targets = [
    W.members.stall1, W.members.stall2, W.members.stall3,
    W.members.stall1, W.members.quick,
  ];
  const fired = targets.map(function (to, i) {
    return P.post(
      W.base, to.publicKey, JSON.stringify({ v: 1, body: { note: 'burst-' + i } }),
      null, { budgetMs: BUDGET_MS, patienceMs: PATIENCE_MS }
    );
  });

  // ── ONE AT A TIME, ASSERTED FROM THE FAR SIDE ──────────────────────
  //
  // Not by reading the node's queue, which 0020 keeps opaque, and not by
  // trusting it either: this counts what the TARGETS received. A request
  // that has arrived at a silent member is a slot that is still held, so
  // two arrivals whose windows overlap would mean two in flight.
  //
  // Sampled while the burst runs, because the interesting state does not
  // survive to the end.
  let worst = 0;
  const watching = (async function () {
    const end = Date.now() + 9000;
    while (Date.now() < end) {
      const open = stalls.reduce(function (n, m) { return n + m.arrived.length; }, 0)
        + quick.arrived.length;
      // Arrivals that have not been answered. The stalls never answer, so
      // each of theirs is only released by its own budget expiring — which
      // is why this is sampled rather than summed at the end.
      const live = stalls.reduce(function (n, m) {
        return n + m.at.filter(function (t) { return Date.now() - t < BUDGET_MS; }).length;
      }, 0);
      if (live > worst) worst = live;
      if (open >= targets.length) break;
      await sleep(40);
    }
  }());

  const settled = await Promise.all(fired.map(function (p) {
    return p.then(function (r) { return r; }, function (e) { return { threw: String(e) }; });
  }));
  await watching;

  if (worst <= 1) {
    test.check('never more than one request in flight at the relay — the cap held under a burst of ' + targets.length);
  } else {
    test.fail('two or more were in flight at once: ' + worst);
  }

  test.subHeading('A target that says nothing does not keep the node');

  // THE ATTEMPT ENDS ON ITS OWN BUDGET. Before R5 the relay held a route
  // for 15s whatever the node asked, so a node that gave up at 8s left
  // seven seconds of guaranteed refusal behind it. The node's own asking
  // time is what bounds this now.
  const arrivals = stalls.reduce(function (n, m) { return n + m.arrived.length; }, 0);
  if (arrivals >= 3) {
    test.check('each stalled attempt released the slot and the next went — ' + arrivals + ' reached silent targets');
  } else {
    test.fail('only ' + arrivals + ' attempts got out; the first stall kept the node');
  }

  test.subHeading('Every intent is answered to its caller — a burst does not starve its tail');

  // NOT "every intent succeeds" — four of these were sent to people who
  // will never reply, and a failure is the correct outcome for those. The
  // claim is that every caller gets an answer rather than a promise that
  // never settles, which is the failure mode a queue introduces and the
  // one nothing else here would catch.
  const unsettled = settled.filter(function (r) { return !r || typeof r !== 'object'; });
  const threw = settled.filter(function (r) { return r && r.threw; });
  if (settled.length === targets.length && !unsettled.length && !threw.length) {
    test.check('all ' + targets.length + ' settled, none threw, none was left hanging');
  } else {
    test.fail('unsettled ' + unsettled.length + ', threw ' + threw.length +
      ': ' + JSON.stringify(threw.slice(0, 2)));
  }

  test.subHeading('A target that answers is served, though it was asked for last');

  // THE HEAD-OF-LINE CLAIM, and the one that needed a socket. postQueue
  // skips what cannot move — "a backed-off target does not hold up a
  // reachable one behind it" — and a cap of one plus four stalling pairs
  // is exactly the arrangement that would prove it wrong if the skip were
  // not wired in.
  const served = await until(function () { return quick.arrived.length > 0; }, 2000);
  if (served) {
    test.check('the cooperative target was reached despite four stalls queued ahead of it');
  } else {
    test.fail('the live target never got the slot — a stalled pair is holding the line');
  }

  const last = settled[settled.length - 1];
  if (last && last.ok === true) {
    test.check('and its caller got the reply, not a timeout');
  } else {
    test.fail('the cooperative post did not succeed: ' + JSON.stringify(last));
  }

  test.subHeading('And the node is still working afterwards');

  // A QUEUE THAT DRAINS INTO A WEDGE would pass everything above and be
  // useless: the interesting failure is a slot that is never returned
  // after the burst, which shows up only on the NEXT post.
  const after = await P.post(
    W.base, W.members.quick.publicKey, JSON.stringify({ v: 1, body: { note: 'after' } }),
    null, { budgetMs: BUDGET_MS }
  );
  if (after && after.ok === true) {
    test.check('a post made after the burst goes straight through — no slot was left held');
  } else {
    test.fail('the node was wedged after the burst: ' + JSON.stringify(after));
  }

  cleanup();
  test.reportSuccessFailureCount();
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  cleanup();
  test.reportSuccessFailureCount();
});
