'use strict';
const rollOf = require('./rollOf');

// spirit/test/relayMonitor.js
// A RELAY STREAMS ITS ACTIVITY ONLY WHILE SOMEBODY IS WATCHING.
//
//   Andy: "The relay needs an api startMonitorStream() and
//   stopMonitorStream(), triggered by this new panel opening and
//   closing."
//
//   Andy: "This entire panel should, of course, go through protocol."
//
// So there is no such api, and that is the point: both are posts to the
// relay, which is an addressable peer for its owner (R18). The route and
// the signed format this suite was first written against are gone —
// decision 0010's first collapse — and every check below still holds
// without them.
//
// ── WHAT THIS CORRECTS ───────────────────────────────────────────────
//
// R9 shipped a status push on a ten second timer that runs for ever,
// watched or not. A relay spending cycles on telemetry nobody reads is
// what decision 0007 says a relay must not do, and on-demand makes that
// standing timer indefensible rather than merely wasteful.
//
// ── WHAT IS LOAD-BEARING HERE ────────────────────────────────────────
//
// Three things, and the negatives are the ones worth the file:
//
//   nothing is pushed until somebody asks
//   it goes to the OWNER and to nobody else
//   it stops on its own when the watcher's stream drops
//
// The third is the one a test has to carry, because it only happens when
// something has already gone wrong: a browser that crashed must not leave
// a relay pushing into nothing, and the socket closing is the only notice
// there will ever be.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const { sealFor, sealedPost, openBody, openReply } = require('./openReply');
const nodeCard = require('../run/js/nodeCard');
const auth = require('../run/js/relayAuth');
const createRelay = require('../run/js/relay');

test.startTest('Relay monitor — activity, only while somebody watches');

// A sink is handed a raw SSE chunk; presence.js formats the frame. Parsed
// back so a check reads as "the owner got a relay-event carrying this"
// rather than matching on punctuation.
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

function world() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-monitor-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay'));

  const owner = auth.generateIdentity('andy');
  const bella = auth.generateIdentity('bella');
  const carl = auth.generateIdentity('carl');
  auth.writeAllowKeys(home, [{ name: 'andy', publicKey: owner.publicKey }]);

  const box = createRelay.createRelay(home);
  // WITH A CARD (cycle 10, R5): the relay seals its answers to the key
  // on it, and the owner is the one member who must always be answerable.
  box.claim('andy', auth.sign(owner.privateKey, auth.claimMessage('andy')), owner.publicKey,
    null, null, null, nodeCard.cardFrom(Object.assign({ name: 'andy' }, owner)));

  // The real way on, for the same reason relayStatus.js does it: a
  // fixture that writes the row directly proves the delivery rule against
  // a relay nobody could have joined.
  [['bella', bella], ['carl', carl]].forEach(function (pair) {
    const minted = box.mint('andy', pair[0], 7, '');
    box.claim(pair[0], auth.sign(pair[1].privateKey, auth.claimMessage(pair[0])),
      pair[1].publicKey, null, minted.invite.token, pair[0],
      nodeCard.cardFrom(Object.assign({ name: pair[0] }, pair[1])));
  });

  const heard = { andy: [], bella: [] };
  box.streamOpen(owner.publicKey, auth.sign(owner.privateKey, auth.streamMessage(owner.publicKey)), sinkFor(heard.andy));
  box.streamOpen(bella.publicKey, auth.sign(bella.privateKey, auth.streamMessage(bella.publicKey)), sinkFor(heard.bella));

  return { home: home, box: box, owner: owner, bella: bella, carl: carl, heard: heard };
}

// SEALED, like every post but a card (cycle 10, R5) — and here that is
// the point rather than an obligation: what the monitor is shown has to
// be the envelope of a packet nobody on this box can read.
function post(w, from, to, text) {
  const body = sealedPost(from, to, text);
  return w.box.routePost(body.from, body.to, body.text, body.sig);
}

function events(bag) {
  return bag.filter(function (m) { return m.event === 'relay-event'; });
}

// ASKED FOR AS A PACKET, because there is no other way to ask.
//
// This helper is the whole of decision 0010's first collapse: a verb that
// had its own route and its own signed format is now a post addressed to
// the relay, indistinguishable on the wire from a post to a person.
//
// Note what it does NOT take: a signature of its own. The post's carries
// it, over bytes that already bind sender, recipient and this exact text.
function askMonitor(w, who, on, filter) {
  const packet = JSON.stringify({
    app: 'relay', v: 1, body: { monitor: { on: !!on, filter: filter || null } },
  });
  const relayKey = w.box.relayPublicKey();
  const asker = who || w.owner;
  // SEALED TO THE RELAY, like every owner verb now (cycle 10, R9), and
  // signed over the bytes that travel (cycle 10's R11).
  const sending = sealFor(asker, w.box, packet);
  return w.box.routePost(asker.publicKey, relayKey, sending,
    auth.sign(asker.privateKey,
      auth.postMessage(asker.publicKey, relayKey, sending)));
}

function startMonitor(w, filter) {
  return askMonitor(w, w.owner, true, filter);
}

// ---------------------------------------------------------------------
test.subHeading('Silent until asked');
// ---------------------------------------------------------------------

(function nothingUntilStarted() {
  const w = world();
  post(w, w.bella, w.owner, 'hello');

  if (events(w.heard.andy).length === 0) {
    test.check('a relay routing traffic pushes no activity at all until somebody asks');
  } else {
    test.fail('unwatched relay pushed: ' + JSON.stringify(events(w.heard.andy)));
  }

  const started = startMonitor(w);
  if (started.ok && started.status === 202 && w.box.monitoring() === true) {
    test.check('and the owner starts it by posting to the relay — a packet, not a verb');
  } else {
    test.fail('start: ' + JSON.stringify(started));
  }

  post(w, w.bella, w.owner, 'again');
  const seen = events(w.heard.andy);
  if (seen.length === 1 && seen[0].data.kind === 'post') {
    test.check('after which one routed post is one event');
  } else {
    test.fail('after start: ' + JSON.stringify(seen.map(function (m) { return m.data; })));
  }

  // FACTS, NOT PAYLOADS. A monitor carrying the text would make the
  // owner's screen a place everybody else's words pass through, which is
  // exactly what 0006 emptied off this box.
  // AND THE SIZE IS THE SIZE OF WHAT TRAVELLED, which after cycle 10 is
  // the sealed bytes — bigger than the words, and no longer a measure of
  // them. This used to assert `bytes === 'again'.length`, which was a
  // true statement about a relay that held the plaintext. That it is no
  // longer true is the change working.
  const row = seen[0].data;
  if (row.bytes > 'again'.length && JSON.stringify(row).indexOf('again') === -1) {
    test.check('carrying the size of the sealed packet and not the words — a monitor is not a mailbox');
  } else {
    test.fail('row: ' + JSON.stringify(row));
  }

  require('../run/js/relayStore').closeAll();
  fs.rmSync(w.home, { recursive: true, force: true });
})();

(function onlyTheOwner() {
  const w = world();
  startMonitor(w);
  post(w, w.bella, w.owner, 'hello');

  // THE CHECK THE FEATURE RESTS ON. These rows say who is talking to whom
  // on this relay. presentNow.broadcast is one word away and would put
  // every peer's traffic on every peer's screen.
  if (events(w.heard.bella).length === 0 && events(w.heard.andy).length === 1) {
    test.check('the events go to the owner and to nobody else — send(), never broadcast()');
  } else {
    test.fail('bella heard ' + events(w.heard.bella).length +
      ', andy heard ' + events(w.heard.andy).length);
  }

  // A NON-OWNER CANNOT TOUCH IT, and note where the refusal now lives.
  //
  // The relay IS addressable by a peer — the destination opened so that
  // set-device and self-removal could stop being cheats — so the post
  // itself succeeds and comes back 202 with a hash. What refuses is the
  // VERB: monitor is an owner verb, and answerSelf checks that per verb.
  //
  // Asked as a STOP, because the owner's is already running here: the
  // interesting refusal is a peer reaching into somebody else's monitor,
  // not a peer failing to get their own.
  const theirs = askMonitor(w, w.bella, false);
  const bellaHeard = w.heard.bella.filter(function (m) { return m.event === 'reply'; });
  let refused = null;
  // OPENED: a relay seals its answers now (cycle 10, R5).
  try { refused = openBody(w.bella, w.box.relayPublicKey(), bellaHeard[bellaHeard.length - 1].data.text); }
  catch (e) { refused = null; }

  if (theirs.ok && w.box.monitoring() === true &&
      refused && refused.ok === false && refused.error === 'no such peer') {
    test.check("a peer's monitor request is refused per-verb, and the owner's keeps running");
  } else {
    test.fail('a peer reached the monitor: ' + JSON.stringify(theirs) +
      ' said: ' + JSON.stringify(refused) + ' monitoring=' + w.box.monitoring());
  }

  require('../run/js/relayStore').closeAll();
  fs.rmSync(w.home, { recursive: true, force: true });
})();

// ---------------------------------------------------------------------
test.subHeading('Stopping, both ways');
// ---------------------------------------------------------------------

(function stopsWhenTold() {
  const w = world();
  startMonitor(w);
  post(w, w.bella, w.owner, 'one');
  const before = events(w.heard.andy).length;

  const stopped = askMonitor(w, w.owner, false);
  post(w, w.bella, w.owner, 'two');

  if (stopped.ok && w.box.monitoring() === false && events(w.heard.andy).length === before) {
    test.check('stop means stop: the next routed post pushes nothing');
  } else {
    test.fail('after stop: ' + events(w.heard.andy).length + ' vs ' + before);
  }

  // THE FLAG IS IN THE SIGNED BYTES, and this is the check that used to
  // justify monitorMessage having a verb of its own — a captured `start`
  // must not be replayable as a `stop`, or the other way round.
  //
  // It still holds, and now nothing here arranges for it: postMessage
  // binds sender, recipient and the exact text, so the flag was covered
  // the moment the packet became the request. The hand-rolled format was
  // buying a property the transport already had.
  const onText = JSON.stringify({ app: 'relay', v: 1, body: { monitor: { on: true, filter: null } } });
  const offText = JSON.stringify({ app: 'relay', v: 1, body: { monitor: { on: false, filter: null } } });
  const relayKey = w.box.relayPublicKey();
  const capturedOff = auth.sign(w.owner.privateKey,
    auth.postMessage(w.owner.publicKey, relayKey, offText));

  const wrongWay = w.box.routePost(w.owner.publicKey, relayKey, onText, capturedOff);
  if (!wrongWay.ok && w.box.monitoring() === false) {
    test.check('and a signature captured off an `off` will not carry an `on` — the post covers the flag');
  } else {
    test.fail('a stop signature started a monitor: ' + JSON.stringify(wrongWay));
  }

  require('../run/js/relayStore').closeAll();
  fs.rmSync(w.home, { recursive: true, force: true });
})();

(function diesWithTheStream() {
  const w = world();
  startMonitor(w);

  // A BROWSER THAT CRASHED. There is no stop, and there never will be —
  // the socket closing is the only notice this relay gets.
  w.box.streamClose(w.owner.publicKey, null);
  post(w, w.bella, w.carl, 'while nobody watches');

  if (w.box.monitoring() === false) {
    test.check("a monitor dies with the stream it was watching on — no timer, no orphan");
  } else {
    test.fail('the monitor outlived its watcher');
  }

  require('../run/js/relayStore').closeAll();
  fs.rmSync(w.home, { recursive: true, force: true });
})();

// ---------------------------------------------------------------------
test.subHeading('Filtered at the source');
// ---------------------------------------------------------------------

(function filteredBeforeItCosts() {
  const w = world();

  //   Andy: "The monitoring api has filtering-at-the-source options, so
  //   the noise of the stream can be controlled and targeted."
  //
  // At the source, so a filtered event is not built, not serialised and
  // never touches a socket. A relay that pushed everything and let the
  // panel discard it would spend the work anyway.
  startMonitor(w, { peer: w.carl.publicKey });

  post(w, w.bella, w.owner, 'not about carl');
  if (events(w.heard.andy).length === 0) {
    test.check('a peer filter drops traffic between two other people, at the relay');
  } else {
    test.fail('filter leaked: ' + JSON.stringify(events(w.heard.andy)));
  }

  post(w, w.carl, w.owner, 'about carl');
  if (events(w.heard.andy).length === 1) {
    test.check('and keeps the traffic that touches the peer asked about');
  } else {
    test.fail('filter dropped what it should have kept');
  }

  require('../run/js/relayStore').closeAll();
  fs.rmSync(w.home, { recursive: true, force: true });
})();

(function kindFilter() {
  const w = world();
  startMonitor(w, { kinds: ['refused'] });

  post(w, w.bella, w.owner, 'delivered');
  const quiet = events(w.heard.andy).length;

  // A post to somebody with no stream open is refused at once (0006), and
  // a refusal is the kind an owner most often wants to watch for.
  post(w, w.bella, w.carl, 'to a peer who is not there');
  const after = events(w.heard.andy);

  if (quiet === 0 && after.length === 1 && after[0].data.kind === 'refused') {
    test.check('a kind filter watches refusals and ignores everything that worked');
  } else {
    test.fail('quiet=' + quiet + ' after=' + JSON.stringify(after.map(function (m) { return m.data; })));
  }

  // A FILTER IT DOES NOT UNDERSTAND IS NO FILTER, never an empty one.
  // Refusing everything because a field was misspelled looks exactly like
  // a quiet relay, which is the one thing a monitor must not look like.
  const w2 = world();
  startMonitor(w2, { kinds: ['nonsense'], somethingElse: true });
  post(w2, w2.bella, w2.owner, 'hello');
  if (events(w2.heard.andy).length === 1) {
    test.check('and a filter nobody can read is no filter, rather than silence');
  } else {
    test.fail('an unreadable filter silenced the stream');
  }

  require('../run/js/relayStore').closeAll();
  fs.rmSync(w.home, { recursive: true, force: true });
  fs.rmSync(w2.home, { recursive: true, force: true });
})();

(function theFilterChangesWhileItRuns() {
  //   Andy: "as the stream comes in, i want to check/uncheck filters
  //   while the stream runs"
  //
  // No new mechanism: posting again with a different filter replaces it,
  // and the stream never stops. Checked because it is now a promise the
  // panel's checkboxes depend on rather than a happy accident of how
  // answerSelf was written — a later tidy-up that made `start` refuse
  // while already started would break every checkbox and look like a
  // panel bug.
  const w = world();

  startMonitor(w, null);
  post(w, w.bella, w.owner, 'a');
  const wide = events(w.heard.andy).length;

  startMonitor(w, { peer: w.carl.publicKey });
  post(w, w.bella, w.owner, 'b');
  const narrowed = events(w.heard.andy).length;

  startMonitor(w, null);
  post(w, w.bella, w.owner, 'c');
  const widened = events(w.heard.andy).length;

  if (wide === 1 && narrowed === 1 && widened === 2 && w.box.monitoring() === true) {
    test.check('a filter can be narrowed and widened while the stream runs, without stopping it');
  } else {
    test.fail('wide=' + wide + ' narrowed=' + narrowed + ' widened=' + widened +
      ' monitoring=' + w.box.monitoring());
  }

  require('../run/js/relayStore').closeAll();
  fs.rmSync(w.home, { recursive: true, force: true });
})();

// ---------------------------------------------------------------------
test.subHeading('The relay as a peer, for its owner');
// ---------------------------------------------------------------------
//
//   Andy: "The relay must be an addressable peer for the owner… This
//   entire panel should, of course, go through protocol."
//
// R18. The narrowing is what makes it safe, and NOT because it hides
// anything: the relay's key is published unsigned in /api/relay/who.
// postedToSelf is the only gate on everything answerSelf can do — four
// owner verbs that verify nothing themselves, because the post's
// signature is their proof.

(function theOwnerCanPostToIt() {
  const w = world();
  const relayKey = w.box.relayPublicKey();
  const packet = JSON.stringify({
    app: 'relay', v: 1, body: { monitor: { on: true, filter: { kinds: ['refused'] } } },
  });

  const sending = sealFor(w.owner, w.box, packet);
  const sent = w.box.routePost(w.owner.publicKey, relayKey, sending,
    auth.sign(w.owner.privateKey, auth.postMessage(w.owner.publicKey, relayKey, sending)));

  if (sent.ok && sent.status === 202 && sent.hash) {
    test.check('the owner can post to the relay itself, and gets a hash like any other post');
  } else {
    test.fail('owner post: ' + JSON.stringify(sent));
  }

  // THE ANSWER COMES BACK THE ORDINARY WAY. Same table, same hash, signed
  // by the relay — a caller cannot tell the shape of this exchange from
  // any other, which is the point of making the relay a peer rather than
  // giving it a second kind of door.
  const replies = w.heard.andy.filter(function (m) { return m.event === 'reply'; });
  if (replies.length === 1 && replies[0].data.hash === sent.hash &&
      replies[0].data.from === relayKey) {
    test.check('and the reply arrives on its stream, same hash, signed by the relay');
  } else {
    test.fail('reply: ' + JSON.stringify(replies.map(function (m) { return m.data; })));
  }

  const answered = openReply(w.owner, w.box.relayPublicKey(), replies[0].data.text) || {};
  if (answered.body && answered.body.monitoring === true &&
      w.box.monitorFilter() && w.box.monitorFilter().kinds.join() === 'refused') {
    test.check('the packet did the work — monitoring on, filtered, entirely over protocol');
  } else {
    test.fail('answer: ' + replies[0].data.text);
  }

  require('../run/js/relayStore').closeAll();
  fs.rmSync(w.home, { recursive: true, force: true });
})();

(function andNobodyElseCan() {
  const w = world();
  const relayKey = w.box.relayPublicKey();
  const packet = JSON.stringify({ app: 'relay', v: 1, body: { monitor: { on: true } } });

  // SEALED, so the refusal that comes back is the VERB refusing and not
  // the seal check refusing — which would make this assertion pass while
  // proving nothing about who may ask for what.
  const theirPacket = sealFor(w.bella, w.box, packet);
  const theirs = w.box.routePost(w.bella.publicKey, relayKey, theirPacket,
    auth.sign(w.bella.privateKey, auth.postMessage(w.bella.publicKey, relayKey, theirPacket)));

  // THE CHECK THE GATING RESTS ON, and it is about the WORDING as much as
  // the refusal.
  //
  // The post lands — a peer may address the relay. The VERB is refused,
  // and it answers `no such peer`: exactly what a verb nobody has heard
  // of gets. So the set of things this box will do for somebody else
  // cannot be enumerated by asking it.
  const bellaSaw = w.heard.bella.filter(function (m) { return m.event === 'reply'; });
  let said = null;
  try { said = openBody(w.bella, w.box.relayPublicKey(), bellaSaw[bellaSaw.length - 1].data.text); }
  catch (e) { said = null; }

  if (theirs.ok && said && said.ok === false && said.error === 'no such peer') {
    test.check('a peer asking an owner verb gets `no such peer` — indistinguishable from an unknown verb');
  } else {
    test.fail('peer post: ' + JSON.stringify(theirs) + ' said: ' + JSON.stringify(said));
  }

  if (w.box.monitoring() === false) {
    test.check('and nothing happened: a peer cannot start a monitor by addressing the box');
  } else {
    test.fail('a peer turned the monitor on');
  }

  // ── AND IT IS IN EVERY MEMBER'S ROSTER (2026-09-15) ────────────────
  //
  // THIS ASSERTED THE OPPOSITE — "in the OWNER's roster and in no
  // peer's, a per-recipient roll, as agreed" — and the agreement was
  // sound when everything answerSelf could be asked was an owner verb.
  //
  // It stopped being sound when `rename` arrived: a peer renaming ITSELF
  // is an own-row verb, and so is giving up its own seat. Both are asked
  // of the relay directly. They worked anyway only because hub.askRelay
  // named a URL and posted to it, going around presence — and the moment
  // the post-path doors close and a member addresses the relay by KEY,
  // `presence.relaysNaming` answers from this roster. Owner-only would
  // have meant a member cannot rename itself: a gate nobody decided,
  // arrived at by omission.
  //
  // Nothing is given away by widening it. The key is already public at
  // /api/relay/who to anyone who asks — see the roll check below, which
  // is a DIFFERENT claim and still stands.
  //
  // THE ROSTER WAS DELETED IN CYCLE 3 (0012 widened: no member list served,
  // by request or by broadcast). What this guarded survives without it: a
  // node learns the relay's key from its pin (GET /api/relay/key, seeded by
  // presenceNode), and what matters HERE is that the relay answers any
  // member who addresses it by that key — not only its owner.
  const bellaAsks = JSON.stringify({ v: 1, body: { partners: true } });
  const toRelay = w.box.routePost(w.bella.publicKey, relayKey, bellaAsks,
    auth.sign(w.bella.privateKey, auth.postMessage(w.bella.publicKey, relayKey, bellaAsks)));
  const noRoster = !w.heard.bella.some(function (m) { return m.event === 'roster'; }) &&
    !w.heard.andy.some(function (m) { return m.event === 'roster'; });
  if (toRelay && toRelay.ok && noRoster) {
    test.check('a member who is not the owner addresses the relay by its key, and nobody is sent a roster');
  } else {
    test.fail('member to relay: ' + JSON.stringify(toRelay) + ', roster absent: ' + noRoster);
  }

  // AND THE KEY IS STILL IN NO ROLL. Addressable is not published — a
  // relay that listed itself would put its own key in every peer's roster.
  const roll = JSON.stringify(rollOf(w.box));
  if (roll.indexOf(relayKey) === -1) {
    test.check('while the relay key stays out of the roll — addressable is not published');
  } else {
    test.fail('the relay listed itself as a peer');
  }

  require('../run/js/relayStore').closeAll();
  fs.rmSync(w.home, { recursive: true, force: true });
})();

// ---------------------------------------------------------------------
test.subHeading('A post at a key nobody holds reaches the owner');
// ---------------------------------------------------------------------

(function unknownTargetIsReported() {
  // Found screenless against the live relay, 2026-09-23: four posts
  // deliberately aimed at a key on no roll produced NOTHING in the
  // owner's feed. Every other refusal on that path reports itself
  // ("minting incomplete", "peer not reachable"); this one returned in
  // silence, so the shape most worth an owner's attention — somebody
  // posting at addresses that do not exist — was the one he could not
  // see.
  //
  // Andy: "you both verify screenless first, that's the procedure." This
  // is the assertion that keeps the answer once a screen exists.
  const w = world();
  startMonitor(w);

  const nowhere = 'MCowBQYDK2VwAyEA' + 'A'.repeat(27) + '=';
  const probe = JSON.stringify({ app: 'probe', v: 1, body: { hello: true } });
  const out = w.box.routePost(w.bella.publicKey, nowhere, probe,
    auth.sign(w.bella.privateKey, auth.postMessage(w.bella.publicKey, nowhere, probe)));

  const seen = events(w.heard.andy).filter(function (m) {
    return m.data && m.data.kind === 'refused' && m.data.why === 'no such peer';
  });
  if (!out.ok && out.status === 404 && seen.length === 1 &&
      seen[0].data.from === w.bella.publicKey && seen[0].data.to === nowhere) {
    test.check('refused to the sender, and reported to the owner, naming the token it was aimed at');
  } else {
    test.fail('unknown target: ' + JSON.stringify(out) + ' events: ' +
      JSON.stringify(events(w.heard.andy).map(function (m) { return m.data; })));
  }

  // AND IT IS THE OWNER'S ALONE, like every other event here.
  if (events(w.heard.bella).length === 0) {
    test.check('and no member sees it — a refusal is the owner\'s business');
  } else {
    test.fail('a member heard the refusal: ' + JSON.stringify(events(w.heard.bella)));
  }

  require('../run/js/relayStore').closeAll();
  fs.rmSync(w.home, { recursive: true, force: true });
})();

test.reportSuccessFailureCount();
