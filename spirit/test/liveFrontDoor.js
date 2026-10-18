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
//
// ── .jsonl, AND READING THE WRONG ONE COST THIS WHOLE FILE ───────────
//
// This read `traffic.json` and JSON.parse'd it whole. That file is the
// READ-ONCE LEGACY SHAPE (trafficLog.legacyPath — "Never written
// again"); the live log is traffic.jsonl, one object per line.
//
// So every read here returned [] — and an empty array is not an error,
// it is an answer. Seven of this file's checks were asserting things
// about a log they never saw: what bravo recorded, what it ignored,
// what it refused, whether rationing held. They failed quietly as "0 of
// 10 landed" while the posts had in fact all landed, and the checks
// beside them went on passing, which is what made it look like rot
// rather than one wrong filename.
//
// A malformed line is skipped rather than fatal, the same property
// trafficLog itself is built on: a torn write at the end of the file
// costs the row being written, never the history behind it.
// THROUGH THE LOG, NOT ITS FILE (transport/R19.2). This read traffic.jsonl
// line by line; the log is moving into node.db (transport/R19), and reading
// a file that no longer grows is exactly the failure recorded above: checks
// asserting about a log they never saw. read() answers the same rows
// wherever they live (torn lines are the log's own business).
function traffic(home) {
  try { return require('../run/js/trafficLog').createTrafficLog({ rootDir: home }).read(); }
  catch (e) { return []; }
}

function inbound(home, fromKey) {
  return traffic(home).filter(function (e) {
    return e && e.dir === 'in' && e.kind === 'request' && (!fromKey || e.peer === fromKey);
  });
}

// `contacts.json` since 2026-09-18 — it was `who.json`, which was the
// roll's word for a file that exists precisely to not be the roll.
// Read off disk rather than through the module because what this suite
// checks is that a REAL node wrote a row, not that a function returns one.
function contactsOf(home) {
  try {
    return JSON.parse(fs.readFileSync(path.join(home, 'relay-state', 'contacts.json'), 'utf8'));
  } catch (e) {
    return [];
  }
}

function rowFor(home, key) {
  return contactsOf(home).filter(function (r) { return r.publicKey === key; })[0] || null;
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
    // A labMaster from another checkout is the machine's condition, not
    // this tree's: stand down with the sentence rather than claim a
    // fault. Anything else that stops a world being built is still red.
    if (built.foreign) { test.standsDown(built.error); test.reportSuccessFailureCount(); return; }
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

    // ── AND EACH DESCRIBED ITSELF ON THE WAY UP ──────────────────────
    //
    //   Andy: "on boot: the node should fill the description 'this node
    //   described for the first time [date / time string]'."
    //
    // nodeCard's own suite proves the function; this proves the WIRING —
    // that server.js actually calls it, in the personal-node branch,
    // against the right directory, on a process that really booted. A
    // boot hook nobody calls and a boot hook that works look identical
    // from a unit test.
    const described = [alfa, bravo, charlie].map(function (peer) {
      let id = null;
      try {
        id = JSON.parse(fs.readFileSync(
          path.join(homeOf(peer), 'relay-state', 'identity.json'), 'utf8'));
      } catch (e) { id = null; }
      return String((id && id.description) || '');
    });

    if (described.every(function (d) { return /^this node described for the first time /.test(d); })) {
      test.check('and each wrote itself a description on the way up, rather than booting blank');
    } else {
      test.fail('descriptions: ' + JSON.stringify(described));
    }

    // ── AND A SEARCH SAYS WHO IS HOME ───────────────────────────────
    //
    //   Andy: "the search might need a filter argument (onlineOnly =
    //   true)… discuss?"
    //
    // The discussion found the field already existed and was being thrown
    // away: the relay computes presence per row and the ranker weighs it
    // at a quarter of an exact match, while hub.handleSearch dropped it
    // before the browser saw it.
    //
    // ASKED OF A REAL NODE AGAINST A REAL RELAY, because that is the only
    // place the SHAPING can be caught. The relay's own reply is asserted
    // in partnerWire; the app's use of the field in contacts.js. Neither
    // sees this node's hand between them — a fixture answers the shape it
    // was given, so a suite driving the app can be green about a field
    // the node never sends.
    const searched = await hub(portOf(alfa), 'POST', '/api/spirit',
      { verb: 'peer.search', q: '*' });
    // The shared shape since goal/G29.17: items, each label the row as json.
    const seenRows = ((searched.body && searched.body.items) || []).map(function (i) {
      try { return JSON.parse(i.label); } catch (e) { return {}; }
    });

    if (seenRows.length) {
      test.check('a member searching its own relay gets seenRows back');
    } else {
      test.fail('search: ' + JSON.stringify(searched.body));
    }

    // A BOOLEAN ON EVERY ROW. Not truthy, not absent: a bseenRowser that
    // cannot tell "absent" from "nobody said" draws the wrong dot, and
    // those are the two states the mark exists to keep apart.
    if (seenRows.length && seenRows.every(function (r) { return typeof r.present === 'boolean'; })) {
      test.check('and every row says whether the relay sees that peer connected');
    } else {
      test.fail('presence missing from a row: ' + JSON.stringify(seenRows.slice(0, 2)));
    }

    // AND IT IS THE TRUTH, not a constant. These three nodes are up and
    // streaming, so the relay must say so about at least one of them —
    // `present: false` everywhere would satisfy the check above while
    // meaning the field was never wired to anything.
    if (seenRows.some(function (r) { return r.present === true; })) {
      test.check('and says TRUE of somebody, which a hardcoded false would not');
    } else {
      test.fail('nobody present among ' + seenRows.length + ' seenRows: ' +
        JSON.stringify(seenRows.map(function (r) { return [r.publicLabel, r.present]; })));
    }


    test.subHeading('A stranger with a perfect signature, and a node that has not heard of them');

    // NOTHING HAS BEEN FAKED HERE. alfa and bravo are both on the relay
    // and neither has acquired the other — which is the ordinary state of
    // two people who happen to share a relay, and exactly the case the
    // door exists for.
    //
    // A fresh node has no preferences.json, so unknownPolicy answers
    // `silent`: the tightest setting, and the default for the same reason.
    // ── THE CARD COMES FIRST, BECAUSE IT HAS TO (cycle 10, R5) ──────
    //
    //   Andy: "if you can't get the card, you can't post anyways."
    //
    // A node refuses to post to somebody whose cipher key it does not
    // hold, and the card request is the one packet that travels plain —
    // so this is the real order a caller works in, not a step added to
    // satisfy a test. alfa asks bravo who it is; bravo answers in front
    // of its own front door; alfa can then seal to it.
    //
    // WHICH IS THE POINT OF THE CASE BELOW. bravo will still ignore what
    // arrives: holding somebody's card is not being introduced to them.
    const card = await hub(portOf(alfa), 'POST', '/api/spirit', {
      verb: 'peer.post', to: bravoKey, text: JSON.stringify({ v: 1, body: { card: true } }),
    });
    if (card.status === 200 && card.body && card.body.card && card.body.card.ok) {
      test.check('alfa asks bravo for its card and gets one — the only unsealed post there is');
    } else {
      test.fail('card: ' + card.status + ' ' + JSON.stringify(card.body));
    }

    const first = await hub(portOf(alfa), 'POST', '/api/spirit', {
      verb: 'peer.post', to: bravoKey, text: 'unsolicited hello',
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
    const set = await hub(portOf(bravo), 'POST', '/api/spirit', { verb: 'contact.setSenders', policy: 'acquire' });
    if (set.status === 200 && set.body && set.body.policy === 'acquire') {
      test.check('bravo sets its own policy to acquire, and the node confirms what it will do');
    } else {
      test.fail('unknown-senders: ' + set.status + ' ' + JSON.stringify(set.body));
    }

    const second = await hub(portOf(alfa), 'POST', '/api/spirit', {
      verb: 'peer.post', to: bravoKey, text: 'hello again',
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
    // contactBook's ACQUIRED_LISTENING and 'roll' is not — so writing is
    // what makes somebody heard next time, and being merely seen in a
    // roll would not have.
    const row = rowFor(homeOf(bravo), alfaKey);
    if (row && row.acquiredVia === 'message') {
      test.check("and alfa now has a row acquired by 'message', which is what listening means");
    } else {
      test.fail('row: ' + JSON.stringify(row));
    }

    // ── THE LOG, READ BACK AS A TABLE ─────────────────────────────────
    //
    // This asked bravo over the wire, through GET /api/hub/arrivals. That
    // door is gone: it had no caller, because catch-up was already solved
    // one layer down — createArrivals.subscribe hands a page the un-taken
    // backlog on the SAME live channel a new packet arrives on.
    //
    // So the questions move to the module that answers them, which is
    // where they were always really being asked. What was being tested
    // was never the route: it was that the log can be read as a table,
    // that the table means ADMITTED, and that a row is addressable by its
    // hash. All three still hold and all three still matter.
    const log = require('../run/js/trafficLog').createTrafficLog({
      rootDir: homeOf(bravo),
    });
    const rows = log.arrivals({});
    const mine = rows.filter(function (r) { return r.peer === alfaKey; });

    if (mine.length === 1) {
      test.check("bravo's log reads back as a table with the one line it agreed to hear");
    } else {
      test.fail('arrivals: ' + JSON.stringify(rows));
    }

    // THE IGNORED ONE IS NOT IN IT, and that is the check the read
    // surface rests on. Both posts are in bravo's log with the same
    // outcome word; only one of them was admitted, and a reader that
    // could not tell them apart would hand an unaccepted stranger's line
    // to an app and walk the front door back.
    const texts = mine.map(function (r) { return r.payload; });
    if (texts.length === 1 && /hello again/.test(String(texts[0]))) {
      test.check('and the post it IGNORED is absent from that table, though both are in its log');
    } else {
      test.fail('table carried: ' + JSON.stringify(texts));
    }

    // ADDRESSABLE BY HASH — the other primary key, and what `re` points
    // at when a packet says which packet it is about.
    const one = log.byHash(mine[0].hash);
    if (one && one.hash === mine[0].hash) {
      test.check('and one row comes back by its hash alone');
    } else {
      test.fail('byHash: ' + JSON.stringify(one));
    }

    // ── AND THE PEER'S OWN NUMBERS MOVED (R11) ────────────────────────
    //
    // countInbound did this on the `inbox` path and nothing did it on the
    // router, so a node moved across would have stopped counting in
    // silence — and a frozen figure looks like the truth while a zero
    // looks like a bug.
    const stats = require('../run/js/peerStats').readSummary(homeOf(bravo), alfaKey);
    if (stats && stats.unansweredInbound >= 1) {
      test.check('and alfa is counted in the per-peer numbers bravo keeps — the router moves them now, as the ring did');
    } else {
      test.fail('peerStats: ' + JSON.stringify(stats));
    }

    test.subHeading('A contact is not rationed; a stranger is');

    // ALFA IS A CONTACT NOW, so the floor does not apply. Ten posts that
    // would have spent a stranger's whole budget.
    const before = inbound(homeOf(bravo), alfaKey).length;
    for (let n = 0; n < 10; n += 1) {
      /* eslint-disable no-await-in-loop */
      await hub(portOf(alfa), 'POST', '/api/spirit', { verb: 'peer.post', to: bravoKey, text: 'x'.repeat(4000) });
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
    await hub(portOf(bravo), 'POST', '/api/spirit', { verb: 'contact.setSenders', policy: 'silent' });
    // Charlie fetches the card first, like any sender must (cycle 10,
    // cycle 10 R5) — and note what that does NOT buy: holding somebody's card is
    // not being introduced to them, so every knock below is still
    // ignored and then refused outright. The floor is unchanged.
    await hub(portOf(charlie), 'POST', '/api/spirit',
      { verb: 'peer.post', to: bravoKey, text: JSON.stringify({ v: 1, body: { card: true } }) });
    for (let n = 0; n < 9; n += 1) {
      /* eslint-disable no-await-in-loop */
      await hub(portOf(charlie), 'POST', '/api/spirit', { verb: 'peer.post', to: bravoKey, text: 'knock ' + n });
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
    const relayPort = require('./labMaster/labPaths').labPort(25);
    // Its card, asked on its one door (goal/G22.6 closed GET /api/relay/key).
    const said = await require('./relayDoor').relayKeyOf('http://127.0.0.1:' + relayPort);
    const relayKey = said && said.relayPublicKey;
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
    // THIS PROCESS OPENED BRAVO'S node.db to read its log, and Windows will
    // not remove an open file: the home survived every destroy, and the
    // next run's bravo booted on the old log (2026-09-29). Closed first,
    // as arrivals.js's removeHome does.
    try { const b = W.peer('bravo'); if (b) require('../run/js/nodeStore.js').open(homeOf(b)).close(); } catch (e) { /* no store */ }
    // A lab is deletable, which is the whole reason this runs locally.
    await W.destroy();
  }

  test.reportSuccessFailureCount();
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
});
