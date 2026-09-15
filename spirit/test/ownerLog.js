'use strict';

// spirit/test/ownerLog.js
// WHAT THE BOX DID ABOUT WHO BELONGS ON IT — R2.
//
//   Andy: "There is a category of events on the relay that the owner
//   should have a log of."
//
// design/cycles/2026-09-15-labels-are-not-identities.md
//
// ── WHAT WAS WRONG ───────────────────────────────────────────────────
//
// Every `relay-event` a relay could send was TRAFFIC — post, reply, two
// refusals — which is the one thing decision 0006 says a relay must not
// keep. Nothing at all fired for membership: `claim`, `forgetPeer`,
// `mint` and `revokeInvite` all returned silently. Exactly inverted.
//
// And the traffic half was monitor-gated and live-only, so even that
// vanished when a tab closed. A claim could happen, a slot could be
// taken by somebody who was not meant to have it, and the owner would
// learn nothing — not then, and not afterwards.
//
// ── THE TWO CHANNELS, AND WHY THEY ARE TWO ───────────────────────────
//
//   relay-event   traffic       opt-in, live, forgotten     monitorEvent
//   owner-event   membership    always on, and KEPT         ownerEvent
//
// One event name for two retention rules would put the decision about
// whether somebody's words reach disk inside a string comparison. Two
// names, two hooks, two reads.
//
// ── THE THREE THINGS THIS FILE REALLY GUARDS ─────────────────────────
//
//   1. ONE SINK. `presentNow.send(ownerKey, …)`, never `broadcast()`.
//      A claim notice carries a third party's key AND the owner's
//      out-of-band handle for them, which R1 established may be a phone
//      number. Broadcasting it publishes that to everyone connected.
//   2. THE RATE GATE BOUNDS IT. /api/relay/claim is a public POST, so a
//      notice fired before the gate lets a stranger drive the owner's
//      stream as fast as they can send.
//   3. NO PAYLOADS, EVER. Refused at both ends, so the rule holds even
//      if one end forgets.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const trafficLog = require('../run/js/trafficLog');
const world = require('./world');

function fakeSink() {
  const sink = { lines: [] };
  sink.write = function (chunk) { sink.lines.push(String(chunk)); };
  sink.close = function () {};
  sink.events = function () {
    return sink.lines.map(function (chunk) {
      const ev = /event: (.*)/.exec(chunk);
      const da = /data: (.*)/.exec(chunk);
      let parsed = null;
      try { parsed = da ? JSON.parse(da[1]) : null; } catch (e) { parsed = null; }
      return { event: ev ? ev[1] : '', data: parsed };
    });
  };
  sink.owned = function () {
    return sink.events().filter(function (e) { return e.event === 'owner-event'; })
      .map(function (e) { return e.data; });
  };
  return sink;
}

function openStream(box, id, sink) {
  return box.streamOpen(
    id.publicKey,
    auth.sign(id.privateKey, auth.streamMessage(id.publicKey)),
    sink
  );
}

test.startTest('The owner’s log — what the relay did about its membership');

// ---------------------------------------------------------------------
test.subHeading('A claim reaches the owner, and names both labels');
// ---------------------------------------------------------------------

// The owner knows this person by a phone number; the person will call
// themselves something else. R1 made those two different words, and this
// is why the notice has to carry both.
const PHONE = '07700900123';

{
  const L = world.build({ title: 'an owner alone', peers: [] });
  const box = L.box;
  const owner = L.owner;
  const ownerSink = fakeSink();
  openStream(box, owner, ownerSink);

  const before = ownerSink.owned().length;
  box.mint('andy', PHONE, 7, 'dog');
  const minted = ownerSink.owned().slice(before);
  if (minted.length === 1 && minted[0].kind === 'invite-minted' && minted[0].invite === PHONE) {
    test.check('minting a seat is reported, by the word the owner wrote');
  } else {
    test.fail('mint: ' + JSON.stringify(minted));
  }

  // NEVER THE TOKEN. It is the credential; a log carrying live tokens
  // would be a log worth stealing.
  if (JSON.stringify(minted).indexOf('dog') === -1) {
    test.check('and not the token, which is the credential and not a fact about membership');
  } else {
    test.fail('the token rode along: ' + JSON.stringify(minted));
  }

  const bella = auth.generateIdentity('bella');
  const at = ownerSink.owned().length;
  const took = box.claim(
    'bel', auth.sign(bella.privateKey, auth.claimMessage('bel')),
    bella.publicKey, '10.0.0.1', 'dog', PHONE
  );
  const notice = ownerSink.owned().slice(at);

  if (took.ok && notice.length === 1 && notice[0].kind === 'claim') {
    test.check('and the claim that spends it is reported too');
  } else {
    test.fail('claim: ' + JSON.stringify(took) + ' / ' + JSON.stringify(notice));
  }

  // BOTH LABELS. `invite` answers "who was this for" in the owner's own
  // terms; `label` answers "what will they be called", which the claimer
  // chose and the owner has never seen. An owner who minted 07700900123
  // and sees `bel` appear can only NOT read that as a bug if the notice
  // carries the pair.
  const n = notice[0] || {};
  if (n.invite === PHONE && n.label === 'bel') {
    test.check('carrying the owner’s word AND the claimer’s — ' +
      n.invite + ' became ' + n.label);
  } else {
    test.fail('labels: invite=' + n.invite + ' label=' + n.label);
  }

  // AND THE KEY, because a purge is by key and always was.
  //   Andy: "removePeer MUST be by ID"
  // A notice naming only labels is a notice you cannot act on.
  if (n.key === bella.publicKey) {
    test.check('and the key, because a purge is by key and a label cannot be purged');
  } else {
    test.fail('key: ' + JSON.stringify(n.key));
  }
}

// ---------------------------------------------------------------------
test.subHeading('A refused attempt is reported, with the reason');
// ---------------------------------------------------------------------

{
  const L = world.build({ title: 'an owner alone', peers: [] });
  const box = L.box;
  const ownerSink = fakeSink();
  openStream(box, L.owner, ownerSink);
  box.mint('andy', 'carl', 7, 'cat');

  const carl = auth.generateIdentity('carl');
  const at = ownerSink.owned().length;
  const refused = box.claim(
    'carl', auth.sign(carl.privateKey, auth.claimMessage('carl')),
    carl.publicKey, '10.0.0.2', 'wrong-token', 'carl'
  );
  const notice = ownerSink.owned().slice(at);

  if (!refused.ok && notice.length === 1 && notice[0].kind === 'claim-refused') {
    test.check('a failed attempt is reported, not only a successful one');
  } else {
    test.fail('refusal: ' + JSON.stringify(refused) + ' / ' + JSON.stringify(notice));
  }

  if (notice[0] && notice[0].why === refused.error && notice[0].invite === 'carl') {
    test.check('with the reason it was refused, and the invite it went for — ' + notice[0].why);
  } else {
    test.fail('why: ' + JSON.stringify(notice[0]));
  }

  // THE SECOND FACTOR, WATCHED FROM THE OWNER'S SIDE. R1 kept the invite
  // label binding because an invite is keyless and a spoken token may be
  // one guessable word. When it does its job, this is how the owner finds
  // out somebody tried.
  const at2 = ownerSink.owned().length;
  box.claim('carl', auth.sign(carl.privateKey, auth.claimMessage('carl')),
    carl.publicKey, '10.0.0.2', 'cat', 'not-the-word');
  const mismatch = ownerSink.owned().slice(at2);
  if (mismatch.length === 1 && /label mismatch/.test(String(mismatch[0].why))) {
    test.check('and a right token with the wrong word on the invite is reported as what it is');
  } else {
    test.fail('mismatch notice: ' + JSON.stringify(mismatch));
  }
}

// ---------------------------------------------------------------------
test.subHeading('To the owner’s sink, and to no other');
// ---------------------------------------------------------------------

{
  // The hazard relay.js already carries a warning about, for the status
  // report: `broadcast()` walks every sink and cannot express a
  // recipient. It is worse here, because this carries a phone number.
  const L = world.build({ title: 'an owner and a member', peers: ['bert'] });
  const box = L.box;
  const bert = L.peer('bert');

  const ownerSink = fakeSink();
  const bertSink = fakeSink();
  openStream(box, L.owner, ownerSink);
  openStream(box, bert, bertSink);

  box.mint('andy', PHONE, 7, 'dog');
  const bella = auth.generateIdentity('bella');
  box.claim('bel', auth.sign(bella.privateKey, auth.claimMessage('bel')),
    bella.publicKey, '10.0.0.3', 'dog', PHONE);

  if (ownerSink.owned().length >= 2) {
    test.check('the owner heard both, so this is not a check that nothing was sent');
  } else {
    test.fail('owner heard ' + ownerSink.owned().length);
  }

  if (bertSink.owned().length === 0) {
    test.check('and a member holding a stream heard none of it');
  } else {
    test.fail('a member received ' + bertSink.owned().length + ' owner events');
  }

  // The specific thing that must not leak, asserted as itself rather
  // than inferred from a count.
  if (JSON.stringify(bertSink.lines).indexOf(PHONE) === -1) {
    test.check('and the phone number on the invite is nowhere in a member’s stream');
  } else {
    test.fail('the invite label reached a member: ' + JSON.stringify(bertSink.lines));
  }
}

// ---------------------------------------------------------------------
test.subHeading('A stranger cannot drive the owner’s stream');
// ---------------------------------------------------------------------

{
  // /api/relay/claim is a public POST. Everything before the rate gate is
  // reachable without limit, so a notice fired there would be unbounded —
  // the cap refuses the CLAIM, never the attempt.
  const L = world.build({ title: 'an owner alone', peers: [] });
  const box = L.box;
  const ownerSink = fakeSink();
  openStream(box, L.owner, ownerSink);

  const before = ownerSink.owned().length;
  for (let i = 0; i < 100; i += 1) {
    const id = auth.generateIdentity('x' + i);
    box.claim('x' + i, auth.sign(id.privateKey, auth.claimMessage('x' + i)),
      id.publicKey, '198.51.100.1', 'bad-token', 'x' + i);
  }
  const cost = ownerSink.owned().length - before;
  if (cost <= 10) {
    test.check('a hundred refused attempts from one caller cost ' + cost +
      ' notices, not a hundred');
  } else {
    test.fail('a flood cost ' + cost + ' notices — the gate is not bounding this');
  }

  // Before the gate: a malformed name and the reserved name. Neither is
  // an attempt on a slot, and neither is rate-limited.
  const at = ownerSink.owned().length;
  box.claim('!!!not a name', 'sig', 'key', '203.0.113.5');
  box.claim(auth.RESERVED_NAME, 'sig', 'key', '203.0.113.5');
  if (ownerSink.owned().length === at) {
    test.check('and a refusal before the gate sends nothing at all');
  } else {
    test.fail('a pre-gate refusal notified: ' +
      JSON.stringify(ownerSink.owned().slice(at)));
  }
}

// ---------------------------------------------------------------------
test.subHeading('Leaving is membership too');
// ---------------------------------------------------------------------

{
  const L = world.build({ title: 'an owner and a member', peers: ['bert'] });
  const box = L.box;
  const bert = L.peer('bert');
  const ownerSink = fakeSink();
  openStream(box, L.owner, ownerSink);

  const at = ownerSink.owned().length;
  box.forgetPeer(bert.publicKey);
  const gone = ownerSink.owned().slice(at);
  if (gone.length === 1 && gone[0].kind === 'peer-removed' && gone[0].key === bert.publicKey) {
    test.check('a removal is reported, by key, so a roster cannot drift unnoticed');
  } else {
    test.fail('removal: ' + JSON.stringify(gone));
  }
}

// ---------------------------------------------------------------------
test.subHeading('And it goes to the log');
// ---------------------------------------------------------------------

{
  //   Andy: "This then enters the owners log (it should) and it can be
  //   reviewed." … "of the owner only."
  //
  // The shape server.js hands over, driven directly — the wire half is
  // asserted above, and this is the half that has to survive a restart.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-ownerlog-'));
  const log = trafficLog.createTrafficLog({ rootDir: home });

  log.note({
    dir: 'in', kind: 'owner', event: 'claim', peer: 'KEY-BELLA',
    relay: 'https://spirit.example', label: 'bel', invite: PHONE, owner: false,
  });
  log.note({
    dir: 'in', kind: 'owner', event: 'claim-refused', peer: 'KEY-EVE',
    relay: 'https://spirit.example', label: 'eve', invite: 'carl',
    why: 'invite not found',
  });
  // An ordinary packet, so the two reads can be shown to stay apart.
  log.note({
    dir: 'in', kind: 'request', peer: 'KEY-P', relay: 'r', hash: 'H1',
    outcome: 'delivered', admitted: true, payload: '{"app":"chat","v":1,"body":"hi"}',
  });

  const rows = log.ownerEvents();
  if (rows.length === 2 && rows[0].event === 'claim' && rows[1].event === 'claim-refused') {
    test.check('both notices are in the log, oldest first');
  } else {
    test.fail('ownerEvents: ' + JSON.stringify(rows));
  }

  if (rows[0].invite === PHONE && rows[0].label === 'bel' && rows[0].peer === 'KEY-BELLA') {
    test.check('with both labels and the key, which is what makes it reviewable');
  } else {
    test.fail('row: ' + JSON.stringify(rows[0]));
  }

  // A SECOND READ, NOT A FLAG ON THE FIRST. `arrivals` is the
  // app-delivery surface and every row it returns may be handed to a
  // page; an owner event is neither a packet nor addressed to an app.
  const arrived = log.arrivals();
  if (arrived.length === 1 && arrived[0].kind === 'request') {
    test.check('and arrivals still answers packets only — the two reads do not mix');
  } else {
    test.fail('arrivals: ' + JSON.stringify(arrived.map(function (r) { return r.kind; })));
  }

  // NO PAYLOADS, refused at this end too. The relay will not send one;
  // this will not keep one. Either alone would be a rule with one place
  // to forget it.
  log.note({
    dir: 'in', kind: 'owner', event: 'claim', peer: 'K', relay: 'r',
    label: 'x', invite: 'y', payload: 'SOMEBODY ELSE’S WORDS',
  });
  if (JSON.stringify(log.ownerEvents()).indexOf('WORDS') === -1) {
    test.check('a payload on an owner row is dropped, whatever the far end sent');
  } else {
    test.fail('a payload survived on an owner row');
  }

  // PERMANENT, like everything else in this file.
  //   Andy: "the log should be permanent. period."
  const reopened = trafficLog.createTrafficLog({ rootDir: home });
  if (reopened.ownerEvents().length === 3) {
    test.check('and it is all still there after a restart');
  } else {
    test.fail('after reopen: ' + reopened.ownerEvents().length);
  }

  // `since` is a POSITION, not a filter on content — R13's rule, which
  // this read follows because it is the same file.
  const first = reopened.ownerEvents()[0];
  const later = reopened.ownerEvents({ since: first.at });
  if (later.length === reopened.ownerEvents().length - 1) {
    test.check('`since` is a position, and moves past what has been read');
  } else {
    test.fail('since: ' + later.length + ' of ' + reopened.ownerEvents().length);
  }
}

// ---------------------------------------------------------------------
test.subHeading('And the relay still keeps nothing');
// ---------------------------------------------------------------------

{
  // Decision 0006, which this cycle must not spend. The relay EMITS; the
  // owner's node KEEPS. If a claim, a mint and a removal left anything
  // behind on the relay, this would be the ring in a new file.
  const L = world.build({ title: 'an owner and a member', peers: ['bert'] });
  const box = L.box;
  const ownerSink = fakeSink();
  openStream(box, L.owner, ownerSink);

  box.mint('andy', PHONE, 7, 'dog');
  const bella = auth.generateIdentity('bella');
  box.claim('bel', auth.sign(bella.privateKey, auth.claimMessage('bel')),
    bella.publicKey, '10.0.0.7', 'dog', PHONE);
  box.forgetPeer(L.peer('bert').publicKey);

  const dir = path.join(L.home, 'relay-state');
  const files = fs.readdirSync(dir).sort();
  const known = ['allow.json', 'identity.json', 'invites.json',
    'pending-owner.json', 'routingTable.json'];
  const unexpected = files.filter(function (f) { return known.indexOf(f) === -1; });
  if (!unexpected.length) {
    test.check('the relay grew no new file for any of it — ' + files.join(', '));
  } else {
    test.fail('the relay started keeping: ' + unexpected.join(', '));
  }

  // And the one file that could have quietly grown a history did not.
  const table = fs.readFileSync(path.join(dir, 'routingTable.json'), 'utf8');
  if (table.indexOf(PHONE) === -1 && Object.keys(JSON.parse(table)).join() === 'peers') {
    test.check('and routingTable.json still holds peers and nothing else');
  } else {
    test.fail('routingTable.json: ' + Object.keys(JSON.parse(table)).join(','));
  }
}

test.reportSuccessFailureCount();
