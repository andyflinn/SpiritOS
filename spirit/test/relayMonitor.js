'use strict';

// spirit/test/relayMonitor.js
// A RELAY STREAMS ITS ACTIVITY ONLY WHILE SOMEBODY IS WATCHING.
//
//   Andy: "The relay needs an api startMonitorStream() and
//   stopMonitorStream(), triggered by this new panel opening and
//   closing."
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
  box.claim('andy', auth.sign(owner.privateKey, auth.claimMessage('andy')), owner.publicKey);

  // The real way on, for the same reason relayStatus.js does it: a
  // fixture that writes the row directly proves the delivery rule against
  // a relay nobody could have joined.
  [['bella', bella], ['carl', carl]].forEach(function (pair) {
    const minted = box.mint('andy', pair[0], 7,
      auth.sign(owner.privateKey, require('../run/js/invites').mintMessage(pair[0], 7, '')), '');
    box.claim(pair[0], auth.sign(pair[1].privateKey, auth.claimMessage(pair[0])),
      pair[1].publicKey, null, minted.invite.token);
  });

  const heard = { andy: [], bella: [] };
  box.streamOpen('andy', auth.sign(owner.privateKey, auth.streamMessage(owner.publicKey)), sinkFor(heard.andy));
  box.streamOpen('bella', auth.sign(bella.privateKey, auth.streamMessage(bella.publicKey)), sinkFor(heard.bella));

  return { home: home, box: box, owner: owner, bella: bella, carl: carl, heard: heard };
}

function post(w, from, to, text) {
  const signed = auth.postMessage(from.publicKey, to.publicKey, text);
  return w.box.routePost(from.publicKey, to.publicKey, text,
    auth.sign(from.privateKey, signed));
}

function events(bag) {
  return bag.filter(function (m) { return m.event === 'relay-event'; });
}

function startMonitor(w, filter) {
  return w.box.setMonitor(true, auth.sign(w.owner.privateKey, auth.monitorMessage(true)), filter);
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
  if (started.ok && w.box.monitoring() === true) {
    test.check('and the owner can start it with a signature over the flag');
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
  const row = seen[0].data;
  if (row.bytes === 'again'.length && JSON.stringify(row).indexOf('again') === -1) {
    test.check('carrying the size and not the words — a monitor is not a mailbox');
  } else {
    test.fail('row: ' + JSON.stringify(row));
  }

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

  // A non-owner cannot turn it on for themselves either.
  const theirs = w.box.setMonitor(true, auth.sign(w.bella.privateKey, auth.monitorMessage(true)));
  if (!theirs.ok && theirs.status === 403) {
    test.check('and a peer cannot start one — the house key alone');
  } else {
    test.fail('a peer started a monitor: ' + JSON.stringify(theirs));
  }

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

  const stopped = w.box.setMonitor(false, auth.sign(w.owner.privateKey, auth.monitorMessage(false)));
  post(w, w.bella, w.owner, 'two');

  if (stopped.ok && w.box.monitoring() === false && events(w.heard.andy).length === before) {
    test.check('stop means stop: the next routed post pushes nothing');
  } else {
    test.fail('after stop: ' + events(w.heard.andy).length + ' vs ' + before);
  }

  // THE FLAG IS IN THE SIGNED BYTES, so a captured `start` cannot be
  // replayed as a `stop`, or the other way round.
  const wrongWay = w.box.setMonitor(true, auth.sign(w.owner.privateKey, auth.monitorMessage(false)));
  if (!wrongWay.ok) {
    test.check('and a signature for `off` will not turn it on');
  } else {
    test.fail('a stop signature started a monitor');
  }

  fs.rmSync(w.home, { recursive: true, force: true });
})();

(function diesWithTheStream() {
  const w = world();
  startMonitor(w);

  // A BROWSER THAT CRASHED. There is no stop, and there never will be —
  // the socket closing is the only notice this relay gets.
  w.box.streamClose('andy', null);
  post(w, w.bella, w.carl, 'while nobody watches');

  if (w.box.monitoring() === false) {
    test.check("a monitor dies with the stream it was watching on — no timer, no orphan");
  } else {
    test.fail('the monitor outlived its watcher');
  }

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

  fs.rmSync(w.home, { recursive: true, force: true });
  fs.rmSync(w2.home, { recursive: true, force: true });
})();

(function theFilterChangesWhileItRuns() {
  //   Andy: "as the stream comes in, i want to check/uncheck filters
  //   while the stream runs"
  //
  // No new mechanism: asking again with a different filter replaces it,
  // and the stream never stops. Checked because it is now a promise the
  // panel's checkboxes depend on rather than a happy accident of how
  // setMonitor was written — a later tidy-up that made `start` refuse
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

  fs.rmSync(w.home, { recursive: true, force: true });
})();

// ---------------------------------------------------------------------
test.subHeading('The relay as a peer, for its owner');
// ---------------------------------------------------------------------
//
//   Andy: "The relay must be an addressable peer for the owner… This
//   entire panel should, of course, go through protocol."
//
// R18. The narrowing is what makes it safe: every other sender keeps the
// answer they get today, so no caller learns this key means anything
// here.

(function theOwnerCanPostToIt() {
  const w = world();
  const relayKey = w.box.mailboxPublicKey();
  const packet = JSON.stringify({
    app: 'relay', v: 1, body: { monitor: { on: true, filter: { kinds: ['refused'] } } },
  });

  const sent = w.box.routePost(w.owner.publicKey, relayKey, packet,
    auth.sign(w.owner.privateKey, auth.postMessage(w.owner.publicKey, relayKey, packet)));

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

  const answered = JSON.parse(replies[0].data.text);
  if (answered.body && answered.body.monitoring === true &&
      w.box.monitorFilter() && w.box.monitorFilter().kinds.join() === 'refused') {
    test.check('the packet did the work — monitoring on, filtered, entirely over protocol');
  } else {
    test.fail('answer: ' + replies[0].data.text);
  }

  fs.rmSync(w.home, { recursive: true, force: true });
})();

(function andNobodyElseCan() {
  const w = world();
  const relayKey = w.box.mailboxPublicKey();
  const packet = JSON.stringify({ app: 'relay', v: 1, body: { monitor: { on: true } } });

  const theirs = w.box.routePost(w.bella.publicKey, relayKey, packet,
    auth.sign(w.bella.privateKey, auth.postMessage(w.bella.publicKey, relayKey, packet)));

  // THE CHECK THE NARROWING RESTS ON, and it is about the WORDING as much
  // as the refusal: a peer gets `no such peer`, which is exactly what an
  // unknown key gets. A distinct error here would tell any peer that this
  // key means something on this box.
  if (!theirs.ok && theirs.status === 404 && theirs.error === 'no such peer') {
    test.check('a peer posting to the relay gets `no such peer` — the same answer an unknown key gets');
  } else {
    test.fail('peer post: ' + JSON.stringify(theirs));
  }

  if (w.box.monitoring() === false) {
    test.check('and nothing happened: a peer cannot start a monitor by addressing the box');
  } else {
    test.fail('a peer turned the monitor on');
  }

  // AND IT IS IN NO PEER'S ROSTER EITHER. The owner learns the relay's
  // address through the ordinary presence mechanism — the same
  // per-recipient rule the device census needed — so a peer must not be
  // told what the owner was told.
  const peerRoster = w.heard.bella.filter(function (m) { return m.event === 'roster'; });
  const ownerRoster = w.heard.andy.filter(function (m) { return m.event === 'roster'; });
  const inPeers = JSON.stringify(peerRoster).indexOf(relayKey) !== -1;
  const inOwners = JSON.stringify(ownerRoster).indexOf(relayKey) !== -1;
  if (inOwners && !inPeers) {
    test.check("the relay is in the OWNER's roster and in no peer's — a per-recipient census, as agreed");
  } else {
    test.fail('owner has it: ' + inOwners + ', peer has it: ' + inPeers);
  }

  // AND THE KEY IS STILL IN NO CENSUS. Addressable is not published — a
  // relay that listed itself would put its own key in every peer's roster.
  const census = JSON.stringify(w.box.who());
  if (census.indexOf(relayKey) === -1) {
    test.check('while the relay key stays out of the census — addressable is not published');
  } else {
    test.fail('the relay listed itself as a peer');
  }

  fs.rmSync(w.home, { recursive: true, force: true });
})();

test.reportSuccessFailureCount();
