'use strict';

// spirit/test/liveFrontDoor.js
// The front door, proved with real peers on real processes.
//
//   node spirit/test/liveFrontDoor.js
//
// NOT PART OF THE HARNESS. It spawns a relay and three nodes through
// labMaster, waits for streams to settle, and takes seconds rather than
// milliseconds. Named in runAll's NOT_A_SUITE for it.
//
// ── WHY THIS EXISTS, AND IT IS NOT REDUNDANT ─────────────────────────
//
// frontDoor.js proves the same rules in process, in milliseconds, and it
// is where the edge cases live. This proves the one thing it cannot: that
// the rules are WIRED.
//
// On 2026-09-12 a bug shipped that every suite missed, including the live
// one. hub.frontDoor admits a relay as a party only if its key is pinned;
// the pin was established by answerRelay, which frontDoor ran before. The
// door refused the offer, so the pinner never ran, so nothing was ever
// pinned. liveRelay.js passed all 23 checks against that build, because
// it calls answerRelay.answer() directly and never goes through
// peerPost.onRequest.
//
// A suite that drives each module cannot see the wiring between two of
// them. This one drives nothing: it posts from one real node to another
// through a real relay and reads what the receiving node wrote down.
//
// ── WHAT THE EVIDENCE IS ─────────────────────────────────────────────
//
// The receiving node's own traffic log. `outcome` on an inbound request
// IS the front door's verdict:
//
//   delivered  admitted — 'known' or 'admit'
//   ignored    a stranger under `silent`, filed nowhere, no app told
//   refused    over the floor — not filed at all, and not even receipted
//
// Read off disk rather than asked for over HTTP, because no route
// publishes the router's arrivals — and reading the record the node kept
// for its own purposes is better evidence than a report it composed for
// a test.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const labWorld = require('./labWorld');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function hub(port, method, pathname, body) {
  try {
    const res = await fetch('http://127.0.0.1:' + port + pathname, {
      method: method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    let parsed = null;
    try { parsed = await res.json(); } catch (e) { parsed = null; }
    return { status: res.status, body: parsed };
  } catch (e) {
    return { status: 0, body: null, error: String(e.message || e) };
  }
}

// What a node wrote down about its own WAN traffic. Missing reads as
// nothing, which is the honest answer for a node that has had none.
function traffic(home) {
  try {
    const raw = fs.readFileSync(path.join(home, 'relay-state', 'traffic.json'), 'utf8');
    const doc = JSON.parse(raw);
    return Array.isArray(doc) ? doc : (doc.entries || []);
  } catch (e) {
    return [];
  }
}

function inbound(home, fromKey) {
  return traffic(home).filter(function (e) {
    return e && e.dir === 'in' && e.kind === 'request' && (!fromKey || e.peer === fromKey);
  });
}

function whoBookOf(home) {
  try {
    return JSON.parse(fs.readFileSync(path.join(home, 'relay-state', 'who.json'), 'utf8'));
  } catch (e) {
    return [];
  }
}

function rowFor(home, key) {
  return whoBookOf(home).filter(function (r) { return r.publicKey === key; })[0] || null;
}

// A labWorld peer is { name, id, node, url } -- the home and the port
// live on `.node`, which is what labMaster handed back. Named here so the
// rest of this file can read as though a peer simply has them.
function homeOf(peer) { return peer && peer.node && peer.node.home; }
function portOf(peer) { return peer && peer.node && peer.node.port; }

function keyOf(peer) {
  try {
    return JSON.parse(fs.readFileSync(
      path.join(homeOf(peer), 'relay-state', 'identity.json'), 'utf8'
    )).publicKey;
  } catch (e) {
    return '';
  }
}

test.startTest('The front door — real peers, real relay, real processes');

async function run() {
  const W = labWorld.createWorld({ peers: 3, peerNames: ['alfa', 'bravo', 'charlie'] });
  const built = await W.build();
  if (!built.ok) {
    test.fail('could not build the lab: ' + built.error);
    test.reportSuccessFailureCount();
    return;
  }

  try {
    const alfa = W.peer('alfa');
    const bravo = W.peer('bravo');
    const charlie = W.peer('charlie');
    const alfaKey = keyOf(alfa);
    const bravoKey = keyOf(bravo);
    const charlieKey = keyOf(charlie);

    if (alfaKey && bravoKey && charlieKey) {
      test.check('three nodes and a relay are up, each with an identity of its own');
    } else {
      test.fail('keys: ' + [alfaKey, bravoKey, charlieKey].map(function (k) { return !!k; }).join(','));
      return;
    }

    // Streams take a moment to settle, and a post to a peer the relay
    // does not yet see present is refused for the wrong reason.
    await sleep(2500);

    test.subHeading('A stranger with a perfect signature, and a node that has not heard of them');

    // NOTHING HAS BEEN FAKED HERE. alfa and bravo are both on the relay
    // and neither has acquired the other — which is the ordinary state of
    // two people who happen to share a relay, and exactly the case the
    // door exists for.
    //
    // A fresh node has no preferences.json, so unknownPolicy answers
    // `silent`: the tightest setting, and the default for the same reason.
    const first = await hub(portOf(alfa), 'POST', '/api/hub/post', {
      to: bravoKey, text: 'unsolicited hello',
    });

    // THE SENDER IS NOT TOLD. It got a receipt, because the bytes did
    // arrive — a stranger being ignored is not owed the difference
    // between "ignored" and "unreachable".
    if (first.status === 200 && first.body && first.body.ok) {
      test.check("alfa's post is receipted, so it cannot tell it was ignored");
    } else {
      test.fail('post: ' + first.status + ' ' + JSON.stringify(first.body));
    }

    await sleep(600);

    const ignored = inbound(homeOf(bravo), alfaKey).filter(function (e) { return e.outcome === 'ignored'; });
    if (ignored.length === 1) {
      test.check('and bravo wrote it down as ignored — the door judged it, and said so');
    } else {
      test.fail('bravo logged: ' + JSON.stringify(inbound(homeOf(bravo), alfaKey)));
    }

    // WITHOUT THE LINE. That something was ignored is bravo's own
    // business to know; keeping the text of a line its operator asked not
    // to keep would be the log contradicting the setting.
    if (ignored.length && ignored[0].payload === undefined) {
      test.check('and kept no payload, so being ignored costs bravo nothing but a line');
    } else {
      test.fail('the ignored entry kept a payload');
    }

    // AND NO ROW. `silent` means no row, and the row is what would make
    // alfa heard next time.
    if (!rowFor(homeOf(bravo), alfaKey)) {
      test.check('and gave alfa no row in the book — silent means silent');
    } else {
      test.fail('a row appeared under silent: ' + JSON.stringify(rowFor(homeOf(bravo), alfaKey)));
    }

    test.subHeading('And the same stranger, once bravo decides to hear strangers');

    // THROUGH THE REAL VERB, not by writing a file. This is the route
    // built the same day: the node holds the setting, validates it, and
    // answers with what it will actually do.
    const set = await hub(portOf(bravo), 'POST', '/api/hub/unknown-senders', { policy: 'acquire' });
    if (set.status === 200 && set.body && set.body.policy === 'acquire') {
      test.check('bravo sets its own policy to acquire, and the node confirms what it will do');
    } else {
      test.fail('unknown-senders: ' + set.status + ' ' + JSON.stringify(set.body));
    }

    const second = await hub(portOf(alfa), 'POST', '/api/hub/post', {
      to: bravoKey, text: 'hello again',
    });
    await sleep(600);

    const delivered = inbound(homeOf(bravo), alfaKey).filter(function (e) { return e.outcome === 'delivered'; });
    if (second.status === 200 && delivered.length === 1) {
      test.check('the same key, the same post, now delivered — the door is the only thing that changed');
    } else {
      test.fail('after acquire: ' + JSON.stringify(inbound(homeOf(bravo), alfaKey)));
    }

    if (delivered.length && delivered[0].payload === 'hello again') {
      test.check('and this one is kept whole, because bravo chose to hear it');
    } else {
      test.fail('delivered payload: ' + JSON.stringify(delivered[0] && delivered[0].payload));
    }

    // THE ROW, and the route it was acquired BY. 'message' is in
    // whoBook's ACQUIRED_LISTENING and 'census' is not — so writing is
    // what makes somebody heard next time, and being merely seen in a
    // census would not have.
    const row = rowFor(homeOf(bravo), alfaKey);
    if (row && row.acquiredVia === 'message') {
      test.check("and alfa now has a row acquired by 'message', which is what listening means");
    } else {
      test.fail('row: ' + JSON.stringify(row));
    }

    test.subHeading('A contact is not rationed; a stranger is');

    // ALFA IS A CONTACT NOW, so the floor does not apply. Ten posts that
    // would have spent a stranger's whole budget.
    const before = inbound(homeOf(bravo), alfaKey).length;
    for (let n = 0; n < 10; n += 1) {
      /* eslint-disable no-await-in-loop */
      await hub(portOf(alfa), 'POST', '/api/hub/post', { to: bravoKey, text: 'x'.repeat(4000) });
    }
    await sleep(1200);
    const after = inbound(homeOf(bravo), alfaKey);
    const grew = after.length - before;
    const refusedFromAlfa = after.filter(function (e) { return e.outcome === 'refused'; }).length;
    if (grew === 10 && refusedFromAlfa === 0) {
      test.check('ten 4KB posts from a contact all land — 40KB, and the floor never looks at them');
    } else {
      test.fail('contact posts: ' + grew + ' of 10 landed, ' + refusedFromAlfa + ' refused');
    }

    // AND THE STRANGER. Back to silent, so charlie stays one — under
    // acquire a stranger becomes a contact on their first message and has
    // exactly one rationed request in them.
    await hub(portOf(bravo), 'POST', '/api/hub/unknown-senders', { policy: 'silent' });
    for (let n = 0; n < 9; n += 1) {
      /* eslint-disable no-await-in-loop */
      await hub(portOf(charlie), 'POST', '/api/hub/post', { to: bravoKey, text: 'knock ' + n });
    }
    await sleep(1200);

    const fromCharlie = inbound(homeOf(bravo), charlieKey);
    const charlieIgnored = fromCharlie.filter(function (e) { return e.outcome === 'ignored'; }).length;
    const charlieRefused = fromCharlie.filter(function (e) { return e.outcome === 'refused'; }).length;
    if (charlieIgnored === 6 && charlieRefused >= 1) {
      test.check('while a stranger gets six a minute and is then refused outright — ' +
        charlieIgnored + ' ignored, ' + charlieRefused + ' refused');
    } else {
      test.fail('charlie: ' + charlieIgnored + ' ignored, ' + charlieRefused + ' refused of 9');
    }

    // Over the floor NOTHING is filed, so the refusal entries carry no
    // payload either — a stranger cannot make bravo store their bytes by
    // sending enough of them.
    const overFloor = fromCharlie.filter(function (e) { return e.outcome === 'refused'; });
    if (overFloor.length && overFloor.every(function (e) { return e.payload === undefined; })) {
      test.check('and nothing over the floor is stored — refused before the log, payload and all');
    } else {
      test.fail('a refused entry kept a payload');
    }

    test.subHeading('And the relay is known, which is what lets an enrolment through');

    // THE BUG THAT MOTIVATED THIS FILE. bravo holds a stream to the
    // relay, so by the time anything can be posted down it the relay's
    // key must already be pinned — pinned at stream-open, not lazily by
    // the code the door would have blocked.
    const relayPort = 65425;
    const census = await hub(relayPort, 'GET', '/api/relay/who');
    const relayKey = census.body && census.body.mailboxPublicKey;
    let pins = {};
    try {
      pins = JSON.parse(fs.readFileSync(
        path.join(homeOf(bravo), 'relay-state', 'relayKeys.json'), 'utf8'
      ));
    } catch (e) { pins = {}; }
    const pinnedKeys = Object.keys(pins).map(function (u) { return pins[u].publicKey; });

    if (relayKey && pinnedKeys.indexOf(relayKey) !== -1) {
      test.check("bravo pinned the relay's own key by holding a stream to it, before any offer could arrive");
    } else {
      test.fail('pins: ' + JSON.stringify(Object.keys(pins)) +
        ' relayKey=' + String(relayKey).slice(-12));
    }
  } finally {
    // A lab is deletable, which is the whole reason this runs locally.
    await W.destroy();
  }

  test.reportSuccessFailureCount();
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
});
