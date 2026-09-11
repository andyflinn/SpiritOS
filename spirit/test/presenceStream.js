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
const { createRelay } = require('../run/js/relay');

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

function lab() {
  const home = tmpHome();
  const box = createRelay(home);
  const house = auth.generateIdentity('andy');
  auth.saveIdentity(home, house);
  const claimed = box.claim(
    'andy',
    auth.sign(house.privateKey, auth.claimMessage('andy')),
    house.publicKey
  );
  if (!claimed.ok) throw new Error('owner claim: ' + JSON.stringify(claimed));

  function joinAs(label) {
    const who = auth.generateIdentity(label);
    const minted = box.mint(
      'andy', label, 7,
      auth.sign(house.privateKey, invites.mintMessage(label, 7))
    );
    if (!minted.ok) throw new Error('mint: ' + JSON.stringify(minted));
    const joined = box.claim(
      label,
      auth.sign(who.privateKey, auth.claimMessage(label)),
      who.publicKey,
      '10.0.0.1',
      minted.invite.token
    );
    if (!joined.ok) throw new Error('join: ' + JSON.stringify(joined));
    return who;
  }
  return { home: home, box: box, house: house, joinAs: joinAs };
}

function openFor(box, id, sink, atMs) {
  return box.streamOpen(
    id.publicKey,
    auth.sign(id.privateKey, auth.streamMessage(id.publicKey, atMs)),
    sink
  );
}

test.startTest('Presence 1 — the relay speaks presence');

function run() {
  let L;
  try { L = lab(); }
  catch (e) { test.fail('lab: ' + (e && e.message)); test.reportSuccessFailureCount(); return; }

  const bert = L.joinAs('bert');
  const john = L.joinAs('john');

  test.subHeading('Two members, and each sees the other');

  const bertSink = fakeSink();
  const johnSink = fakeSink();

  const b = openFor(L.box, bert, bertSink);
  if (b && b.ok) test.check('a member opens the wire with its own key');
  else test.fail('bert open: ' + JSON.stringify(b));

  const j = openFor(L.box, john, johnSink);
  if (j && j.ok) test.check('and so does another');
  else test.fail('john open: ' + JSON.stringify(j));

  // The newcomer must see ITSELF present in its own first snapshot — it
  // will never be sent the change that announced it.
  const johnRoster = johnSink.last('roster');
  const johnSelf = (johnRoster && johnRoster.members || []).filter(function (m) {
    return m.key === john.publicKey;
  })[0];
  if (johnSelf && johnSelf.present === true) {
    test.check('the newcomer sees itself present in its own first roster');
  } else {
    test.fail('john self: ' + JSON.stringify(johnSelf));
  }

  const bertHeard = bertSink.last('presence');
  if (bertHeard && bertHeard.key === john.publicKey && bertHeard.present === true) {
    test.check('and the one already there is told, carrying only the key that moved');
  } else {
    test.fail('bert heard: ' + JSON.stringify(bertHeard));
  }

  test.subHeading('The roster names the absent, or white and red collapse');

  // THE test of this stage. A roster of only the connected cannot tell a
  // member who is away from somebody this relay never heard of — the
  // first is red and the second white (PRESENCE.md section 4).
  const andyRow = (johnRoster && johnRoster.members || []).filter(function (m) {
    return m.key === L.house.publicKey;
  })[0];
  if (andyRow && andyRow.present === false) {
    test.check('a member who is not connected is IN the roster, marked absent');
  } else {
    test.fail('absent member missing from roster: ' + JSON.stringify(johnRoster));
  }
  if (andyRow && andyRow.label === 'andy') {
    test.check('and carries a label, so a node need not ask who it was');
  } else {
    test.fail('roster row has no label: ' + JSON.stringify(andyRow));
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
  if (second.last('roster')) {
    test.check('and the new one gets its roster');
  } else {
    test.fail('replacement got no roster');
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

  // The replay this verb exists to prevent. An inbox signature is one the
  // owner makes every two seconds and a status one every census.
  const wrongVerb = L.box.streamOpen(
    bert.publicKey,
    auth.sign(bert.privateKey, auth.inboxMessage(bert.publicKey)),
    fakeSink()
  );
  if (wrongVerb && wrongVerb.ok === false && wrongVerb.status === 403) {
    test.check('an inbox signature does not open a stream');
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
  const zoe = L.joinAs('zoe');
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

  test.subHeading('Nothing but presence travels on it');

  // The fence, asserted rather than trusted. If a later cycle puts a
  // message on this wire it will fail here first.
  const seen = {};
  bertSink.events().concat(johnSink.events()).forEach(function (e) {
    if (e.event) seen[e.event] = true;
  });
  const allowed = Object.keys(seen).every(function (name) {
    return name === 'roster' || name === 'presence';
  });
  if (allowed) {
    test.check('only roster and presence events were ever written: ' +
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

  test.reportSuccessFailureCount();
}

try {
  run();
} catch (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
}
