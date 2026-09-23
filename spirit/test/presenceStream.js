'use strict';

// spirit/test/presenceStream.js
// Presence Stage 1. The relay speaks presence, and nothing else travels
// on the wire.
//
// Driven in process with fake sinks — a sink is anything with write and
// close, which is the whole reason presence.js has no http in it.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const invites = require('../run/js/invites');
const presence = require('../run/js/presence');
const world = require('./world');

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-presence-'));
}

// Records what it was sent and whether it was closed. Parsing the SSE
// text rather than capturing objects, because the text IS the protocol
// and a test that skips it would not notice the framing breaking.
function fakeSink() {
  const sink = {
    lines: [],
    closed: false,
    write: function (chunk) { sink.lines.push(chunk); },
    close: function () { sink.closed = true; },
  };
  sink.events = function () {
    return sink.lines.map(function (chunk) {
      const ev = /event: (.*)/.exec(chunk);
      const data = /data: (.*)/.exec(chunk);
      let parsed = null;
      try { parsed = data ? JSON.parse(data[1]) : null; } catch (e) { parsed = null; }
      return { event: ev ? ev[1] : '', data: parsed };
    });
  };
  sink.last = function (name) {
    const hits = sink.events().filter(function (e) { return e.event === name; });
    return hits.length ? hits[hits.length - 1].data : null;
  };
  return sink;
}

// The cast this suite needs, in the shared vocabulary.
//
// `zoe` exists for one check that turns on a FRESH connect budget — the
// forged-connect test, which passed once while the ordering was wrong
// because the rate limit refused the attack before the authorisation
// check could fail to. Her budget is untouched because she is a
// different identity, not because she joins later.
const SCENARIO = {
  title: 'An owner and three members on one relay',
  peers: ['bert', 'john', 'zoe'],
};

function openFor(box, id, sink, atMs) {
  return box.streamOpen(
    id.publicKey,
    auth.sign(id.privateKey, auth.streamMessage(id.publicKey, atMs)),
    sink
  );
}

test.startTest('Presence 1 — the relay speaks presence');

function run() {
  const L = world.build(SCENARIO);
  if (!L.ok) { test.fail(L.error); test.reportSuccessFailureCount(); return; }

  const bert = L.peer('bert');
  const john = L.peer('john');

  test.subHeading('Two members, and each sees the other');

  const bertSink = fakeSink();
  const johnSink = fakeSink();

  const b = openFor(L.box, bert, bertSink);
  if (b && b.ok) test.check('a member opens the wire with its own key');
  else test.fail('bert open: ' + JSON.stringify(b));

  const j = openFor(L.box, john, johnSink);
  if (j && j.ok) test.check('and so does another');
  else test.fail('john open: ' + JSON.stringify(j));

  // NO ROSTER ON CONNECT, since cycle 3 — 0012 widened: no member list is
  // served, not by request and not by broadcast. This asserted the
  // newcomer's first roster named itself present; the node now seeds its
  // own presence and the relay's from the pinned relay key (presenceNode's
  // seedRelay), and learns everyone else from broadcasts it filters by its
  // own contacts. The relay broadcasts, the node filters.
  if (!johnSink.last('roster')) {
    test.check('the newcomer is sent no roster — no member list is served');
  } else {
    test.fail('a roster was sent: ' + JSON.stringify(johnSink.last('roster')));
  }

  const bertHeard = bertSink.last('presence');
  if (bertHeard && bertHeard.key === john.publicKey && bertHeard.present === true) {
    test.check('and the one already there is told, carrying only the key that moved');
  } else {
    test.fail('bert heard: ' + JSON.stringify(bertHeard));
  }

  test.subHeading('An absent member is never named to a newcomer');

  // This section asserted the opposite until cycle 3: that the roster named
  // the absent, with labels, so white and red did not collapse. Red versus
  // white is now the node's distinction, made against its own contacts —
  // the relay does not tell one member who else is on the roll.
  const namesAndy = johnSink.lines.some(function (chunk) {
    return chunk.indexOf(L.owner.publicKey) !== -1;
  });
  if (!namesAndy) {
    test.check('a member who is not connected is not mentioned to anyone');
  } else {
    test.fail('the absent owner was named on the wire');
  }
  if (bertHeard && bertHeard.label === undefined) {
    test.check('and a broadcast carries a key, never a label');
  } else {
    test.fail('broadcast carried a label: ' + JSON.stringify(bertHeard));
  }

  test.subHeading('Leaving is a change, and it is one key');

  L.box.streamClose(john.publicKey, johnSink);
  const gone = bertSink.last('presence');
  if (gone && gone.key === john.publicKey && gone.present === false) {
    test.check('a disconnect reaches the others');
  } else {
    test.fail('gone: ' + JSON.stringify(gone));
  }

  // Both close and error fire on a dying socket and both call this.
  const before = bertSink.events().length;
  L.box.streamClose(john.publicKey, johnSink);
  if (bertSink.events().length === before) {
    test.check('and calling it twice announces nothing twice');
  } else {
    test.fail('second streamClose broadcast again');
  }

  test.subHeading('Newest wins, because the relay is not the node');

  const first = fakeSink();
  const second = fakeSink();
  openFor(L.box, john, first);
  openFor(L.box, john, second);
  if (first.closed && !second.closed) {
    test.check('a second connection tosses the first for that identity');
  } else {
    test.fail('first.closed=' + first.closed + ' second.closed=' + second.closed);
  }
  if (L.box.presence.isPresent(john.publicKey) && !second.last('roster')) {
    test.check('and the new one is live, with no roster sent to it either');
  } else {
    test.fail('replacement: present=' + L.box.presence.isPresent(john.publicKey) +
      ' roster=' + JSON.stringify(second.last('roster')));
  }

  // A teardown arriving late, after the same identity reconnected, must
  // not evict the connection that replaced it.
  L.box.streamClose(john.publicKey, first);
  if (L.box.presence.isPresent(john.publicKey)) {
    test.check('and a late teardown for the old sink does not evict the new one');
  } else {
    test.fail('a stale teardown killed the live connection');
  }

  test.subHeading('The gate');

  // The replay this verb exists to prevent, asked with whatever other
  // signed format the tree still has.
  //
  // It has outlived two of them now. Written against an INBOX signature —
  // one the owner made every two seconds — which R8 deleted; moved to
  // `status`, which an owner signed for every roll, which R3 deleted a
  // few hours later. `claim` is what is left, and the claim is unchanged:
  // bytes signed for one verb must not open another.
  const wrongVerb = L.box.streamOpen(
    bert.publicKey,
    auth.sign(bert.privateKey, auth.claimMessage(bert.publicKey)),
    fakeSink()
  );
  if (wrongVerb && wrongVerb.ok === false && wrongVerb.status === 403) {
    test.check('a signature for another verb does not open a stream');
  } else {
    test.fail('wrong verb accepted: ' + JSON.stringify(wrongVerb));
  }

  const stale = openFor(L.box, bert, fakeSink(), Date.now() - 2 * 60000);
  if (stale && stale.ok === false) test.check('a signature two minutes old is refused');
  else test.fail('stale accepted: ' + JSON.stringify(stale));

  const nearly = openFor(L.box, bert, fakeSink(), Date.now() - 60000);
  if (nearly && nearly.ok) test.check('one minute out is fine, for two clocks that disagree');
  else test.fail('one minute refused: ' + JSON.stringify(nearly));

  // Somebody else's key is a perfectly good key and proves nothing here.
  const borrowed = L.box.streamOpen(
    bert.publicKey,
    auth.sign(john.privateKey, auth.streamMessage(bert.publicKey)),
    fakeSink()
  );
  if (borrowed && borrowed.ok === false) {
    test.check("and another member's signature does not open this row");
  } else {
    test.fail('borrowed key accepted: ' + JSON.stringify(borrowed));
  }

  // THE attack authenticate-then-toss exists to prevent, and the reason
  // the order in streamOpen is load-bearing rather than tidy. Bert is
  // connected. Anybody at all can send a connect naming bert's key with
  // a signature that is not bert's — and if connect() ran before the
  // verify, that alone would evict him. Knocking any peer offline would
  // cost one bad request.
  //
  // A FRESH identity, and that detail is not cosmetic. Written first
  // against bert, this passed while the ordering was wrong — bert's
  // connect budget was already spent by the gate checks above, so the
  // forged connect was refused by the rate limit before it ever reached
  // the registry, and the test was green for a reason it was not
  // testing. A rate limit is not an authorisation check and must never
  // be mistaken for one.
  const zoe = L.peer('zoe');
  const zoeLive = fakeSink();
  openFor(L.box, zoe, zoeLive);
  const impostor = L.box.streamOpen(
    zoe.publicKey,
    auth.sign(john.privateKey, auth.streamMessage(zoe.publicKey)),
    fakeSink()
  );
  if (impostor && impostor.ok === false && !zoeLive.closed &&
      L.box.presence.isPresent(zoe.publicKey)) {
    test.check('a forged connect cannot knock a live peer off the wire');
  } else {
    test.fail('impostor=' + JSON.stringify(impostor) + ' zoeClosed=' + zoeLive.closed +
      ' stillPresent=' + L.box.presence.isPresent(zoe.publicKey));
  }

  test.subHeading('A stranger reaches nothing, and leaves nothing behind');

  // Asserted on the REGISTRY, not on the status code. B1's lesson: a
  // registry keyed by caller-chosen input grows when a stranger reaches
  // it, and a check that only reads the refusal would not notice.
  const stranger = auth.generateIdentity('nobody');
  const strangerSink = fakeSink();
  const refused = L.box.streamOpen(
    stranger.publicKey,
    auth.sign(stranger.privateKey, auth.streamMessage(stranger.publicKey)),
    strangerSink
  );
  const grew = L.box.presence.present().indexOf(stranger.publicKey) !== -1;
  if (refused && refused.ok === false && !grew) {
    test.check('a key with no row is refused without the registry growing');
  } else {
    test.fail('refused=' + JSON.stringify(refused) + ' grew=' + grew);
  }

  test.subHeading('Connects are rated per identity');

  // The registry alone, so the count is about connects and not about
  // signatures. perMin 6 by default.
  const reg = presence.createRegistry();
  let refusals = 0;
  for (let n = 0; n < 9; n += 1) {
    const r = reg.connect('key-a', fakeSink());
    if (r && r.status === 429) refusals += 1;
  }
  if (refusals === 3 && reg.perMin === 6) {
    test.check('the seventh connect in a minute is refused — six, then 429');
  } else {
    test.fail('refusals=' + refusals + ' perMin=' + reg.perMin);
  }
  const other = reg.connect('key-b', fakeSink());
  if (other && other.ok) {
    test.check("and another identity's first connect is not spent by it");
  } else {
    test.fail('key-b starved: ' + JSON.stringify(other));
  }

  test.subHeading('Presence work puts nothing but presence on the wire');

  // THE FENCE MOVED, deliberately and once. PRESENCE.md §6 scoped this
  // wire to presence alone, and this check asserted it — so that a later
  // cycle could not put a message on it by accident. ROUTER.md is that
  // cycle, and it does so on purpose: `request` and `reply` now travel
  // here too.
  //
  // What this still guards, and it is worth keeping: PRESENCE operations
  // emit presence events and nothing else. A connect or a disconnect that
  // started carrying a body would fail here, which is the accident the
  // original fence was really about. `roster` left the allowed list with
  // cycle 3: its return would be a member list served, and fails here.
  const seen = {};
  bertSink.events().concat(johnSink.events()).forEach(function (e) {
    if (e.event) seen[e.event] = true;
  });
  const allowed = Object.keys(seen).every(function (name) {
    return name === 'presence';
  });
  if (allowed) {
    test.check('this suite drove only presence, and only presence was written: ' +
      Object.keys(seen).join(', '));
  } else {
    test.fail('unexpected events on the wire: ' + Object.keys(seen).join(', '));
  }

  const text = bertSink.lines.concat(johnSink.lines).join('');
  if (text.indexOf('password') === -1 && text.indexOf('sentAt') === -1) {
    test.check('and no message body or credential was anywhere near it');
  } else {
    test.fail('the wire carried more than presence');
  }

  test.subHeading('A relay that knows it is going says when to come back');

  {
    //   Andy: "can a relay that knows its shutting down (lab.andyflinn.com
    //   reboot by your request) send a message down the SSE connections to
    //   prepare its counterparts to re-connect?"
    //
    // It can, and it needs no message of its own: `retry:` is SSE's own
    // field for when to reconnect, so nothing new crosses the wire and no
    // client has to be taught a word. sseClient honours it, asserted in
    // presenceNode.js.
    //
    // A FRESH REGISTRY, deliberately: the purity check above asserts this
    // suite put nothing but presence on the wire, and a hint written into
    // those same sinks would be arguing with it.
    const bye = presence.createRegistry();
    const one = fakeSink();
    const two = fakeSink();
    bye.connect('one', one);
    bye.connect('two', two);

    const told = bye.goingAway(3000);
    if (told === 2) {
      test.check('every held stream is told, and the count says how many heard it');
    } else {
      test.fail('told ' + told + ' of 2');
    }

    const hint = one.lines.join('');
    if (/retry: 3000/.test(hint) && hint.indexOf('event:') === -1) {
      test.check('as a bare `retry:` frame — no event, so nothing has to understand it');
    } else {
      test.fail('wrote: ' + JSON.stringify(hint));
    }

    // CLOSED HERE, so the FIN is the relay's decision and lands BEHIND the
    // hint. Left to the process exiting, the kernel would reap the socket
    // and could race the write.
    if (one.closed && two.closed) {
      test.check('and the sockets close deliberately, after the hint rather than with it');
    } else {
      test.fail('sinks left open: ' + one.closed + ', ' + two.closed);
    }

    if (bye.present().length === 0) {
      test.check('and it believes nobody is there afterwards');
    } else {
      test.fail('still present: ' + bye.present().join(', '));
    }
  }

  test.reportSuccessFailureCount();
}

try {
  run();
} catch (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
}
