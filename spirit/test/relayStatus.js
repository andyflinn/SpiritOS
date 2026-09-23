'use strict';

// spirit/test/relayStatus.js
// A relay tells its OWNER how it is doing, and tells nobody else.
//
// ── THE CHECK THIS SUITE EXISTS FOR ──────────────────────────────────
//
// The report carries live invite LABELS. Those are in no roll, on no
// public route, and the console gated them behind an owner check that
// existed for that one word and nothing else.
//
// Every other event on this stream travels by presentNow.broadcast(),
// which walks every sink and cannot express a recipient at all. So the
// wrong function is the familiar one, it is one word away, and it would
// publish an owner's invites to every connected peer without failing
// anything.
//
// That is why the negative half below is not a nicety. A suite that only
// checked "the owner got it" would pass against a broadcast.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const relayStatus = require('../run/js/relayStatus');
const createRelay = require('../run/js/relay');
const invitesModule = require('../run/js/invites');

test.startTest('Relay status — the owner is told, and only the owner');

// ---------------------------------------------------------------------
test.subHeading('The report itself (pure, no relay)');
// ---------------------------------------------------------------------

const T0 = Date.parse('2026-09-13T12:00:00.000Z');

(function theFiguresTravel() {
  const r = relayStatus.report({
    now: T0,
    snapshot: {
      owner: 'andy', mode: 'keys', relayPublicKey: 'MBOXKEY',
      peers: [{ publicKey: 'a' }, { publicKey: 'b' }, { publicKey: 'c' }],
      messages: 7,
    },
    present: ['a', 'b'],
    routes: 2,
    version: '0.0.1 abc1234',
    invites: [],
    proc: { rss: 55 * 1024 * 1024, heapUsed: 9, heapTotal: 11, uptime: 3661.9 },
  });

  if (r.owner === 'andy' && r.mode === 'keys' && r.key === 'MBOXKEY') {
    test.check('the report names the box: owner, mode and the relay\'s own key');
  } else {
    test.fail(JSON.stringify(r));
  }

  // BOTH numbers, not a ratio. A relay saying "7 connected" against a
  // roster of 3 is telling its owner something is wrong, and a monitor
  // that had already divided them could not show it.
  if (r.peers === 3 && r.present === 2) {
    test.check('roster size and connected count travel separately, so a disagreement is visible');
  } else {
    test.fail('peers=' + r.peers + ' present=' + r.present);
  }

  // The first figure here that could never be had from the roll: not
  // how many people exist, but whether this box is BUSY.
  if (r.routes === 2) {
    test.check('requests in flight — the number that says busy, which no public route answers');
  } else {
    test.fail('routes=' + r.routes);
  }

  if (r.memory.rss === 55 * 1024 * 1024 && r.uptimeSec === 3661) {
    test.check('memory and uptime — decision 0007 made observable, rss rather than heap alone');
  } else {
    test.fail(JSON.stringify({ memory: r.memory, uptimeSec: r.uptimeSec }));
  }

  // Truncated, not rounded. 3661.9 seconds of uptime is 3661 whole
  // seconds; a report that rounded up would claim a second the box has
  // not been alive for.
  if (r.uptimeSec === Math.floor(3661.9)) {
    test.check('and uptime is whole seconds the box has actually been up, not rounded up to one it has not');
  } else {
    test.fail('uptimeSec=' + r.uptimeSec);
  }
})();

(function invitesAreTheOneThingOnlyThisCanSay() {
  const hour = 3600000;
  const r = relayStatus.report({
    now: T0,
    snapshot: { peers: [] },
    invites: [
      { label: 'bella', token: 'SECRETTOKEN', expiresAt: new Date(T0 + hour).toISOString() },
      { label: 'spent', token: 'T2', expiresAt: new Date(T0 + hour).toISOString(), consumedAt: '2026-09-12T00:00:00.000Z' },
      { label: 'stale', token: 'T3', expiresAt: new Date(T0 - hour).toISOString() },
    ],
  });

  if (r.invites.length === 1 && r.invites[0].label === 'bella') {
    test.check('live invites only — a consumed one and an expired one are not live');
  } else {
    test.fail(JSON.stringify(r.invites));
  }

  // THE TOKEN IS A CREDENTIAL. It is what somebody claims a row with, so
  // it must not ride in a report a person leaves open on a screen. The
  // label and the expiry are what an owner needs to know; the token they
  // already sent to whoever it was for.
  if (JSON.stringify(r).indexOf('SECRETTOKEN') === -1) {
    test.check('and the token itself never travels — a monitor is a view, not a place to keep secrets');
  } else {
    test.fail('the report carried a live invite token');
  }
})();

(function nothingIsInvented() {
  const r = relayStatus.report({ now: T0 });
  const shaped = r.peers === 0 && r.present === 0 && r.routes === 0 &&
    r.messages === 0 && Array.isArray(r.invites) && r.invites.length === 0 &&
    r.memory.rss === 0 && r.uptimeSec === 0;
  if (shaped) {
    test.check('handed nothing, it reports zeroes in the right shape rather than throwing or guessing');
  } else {
    test.fail(JSON.stringify(r));
  }
})();

// ---------------------------------------------------------------------
test.subHeading('Delivery: the owner\'s sink, and no other');
// ---------------------------------------------------------------------

(function onlyTheOwner() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-relaystatus-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay'));

  const owner = auth.generateIdentity('andy');
  const friend = auth.generateIdentity('bella');
  auth.writeAllowKeys(home, [{ name: 'andy', publicKey: owner.publicKey }]);

  const relay = createRelay.createRelay(home);

  // Both hold a row, so both are identities this relay will open a
  // stream for. The owner is a peer like any other — that is the point:
  // nothing about the SOCKET distinguishes them.
  //
  // bella comes in the real way, through an invite the owner minted. In
  // keys mode there is no other way onto a relay, which is itself worth
  // exercising here rather than shortcutting: a fixture that wrote the
  // row directly would prove the delivery rule against a relay nobody
  // could actually have joined.
  relay.claim('andy', auth.sign(owner.privateKey, auth.claimMessage('andy')), owner.publicKey);

  const minted = relay.mint('andy', 'bella', 7, '');
  if (!minted.ok) {
    test.fail('could not mint bella an invite: ' + JSON.stringify(minted));
    test.reportSuccessFailureCount();
    return;
  }
  relay.claim('bella', auth.sign(friend.privateKey, auth.claimMessage('bella')),
    friend.publicKey, null, minted.invite.token, 'bella');

  // A SECOND, still-live invite, so the report has something in it that
  // must not leak. bella's was consumed on the line above, which is also
  // why the count below is one and not two.
  invitesModule.add(home, { label: 'carlos', days: 7, invitedBy: 'andy' });

  // A sink is handed a raw SSE chunk, not (event, data) — presence.js
  // formats the frame itself. Parsed back here rather than asserted as a
  // string, so a check reads as "the owner got a relay-status carrying
  // these facts" instead of matching on punctuation.
  const heard = { andy: [], bella: [] };
  function sinkFor(who) {
    return {
      write: function (chunk) {
        const event = /^event: (.+)$/m.exec(String(chunk));
        const data = /^data: (.+)$/m.exec(String(chunk));
        if (!event) return;
        let parsed = null;
        try { parsed = data ? JSON.parse(data[1]) : null; } catch (e) { parsed = null; }
        heard[who].push({ event: event[1], data: parsed, raw: String(chunk) });
      },
      close: function () {},
    };
  }

  const ownerOpen = relay.streamOpen(owner.publicKey,
    auth.sign(owner.privateKey, auth.streamMessage(owner.publicKey)), sinkFor('andy'));
  const friendOpen = relay.streamOpen(friend.publicKey,
    auth.sign(friend.privateKey, auth.streamMessage(friend.publicKey)), sinkFor('bella'));

  if (!ownerOpen.ok || !friendOpen.ok) {
    test.fail('streams did not open: ' + JSON.stringify({ ownerOpen: ownerOpen, friendOpen: friendOpen }));
    test.reportSuccessFailureCount();
    return;
  }

  const ownerStatus = heard.andy.filter(function (m) { return m.event === 'relay-status'; });
  const friendStatus = heard.bella.filter(function (m) { return m.event === 'relay-status'; });

  if (ownerStatus.length >= 1) {
    test.check('the owner gets a report without asking, as soon as its stream is open');
  } else {
    test.fail('the owner heard: ' + heard.andy.map(function (m) { return m.event; }).join(', '));
  }

  // THE ONE THAT MATTERS. presentNow.broadcast would have put this in
  // bella's list too, and every other event on this stream travels that
  // way — so this is a one-word mistake away at all times.
  if (friendStatus.length === 0) {
    test.check('and a peer who is not the owner gets none at all — this is send(), never broadcast()');
  } else {
    test.fail('a non-owner received ' + friendStatus.length + ' report(s)');
  }

  // Said separately because "bella heard nothing" would also be true of
  // a relay whose stream is broken. She must be hearing the ordinary
  // traffic.
  const friendHeard = heard.bella.map(function (m) { return m.event; });
  // Presence alone since cycle 3: the roster (the whole roll, to every
  // member on connect) was deleted — 0012 widened.
  if (friendHeard.indexOf('presence') !== -1) {
    test.check('while still hearing presence, so this is silence about ONE thing, not a dead stream');
  } else {
    test.fail('bella heard: ' + friendHeard.join(', '));
  }

  const report = ownerStatus[ownerStatus.length - 1].data;
  if (report && report.owner === 'andy' && report.peers === 2) {
    test.check('and the report describes this relay: owner andy, two rows');
  } else {
    test.fail(JSON.stringify(report));
  }

  if (report && report.invites.length === 1 && report.invites[0].label === 'carlos') {
    test.check('carrying the live invite — the one thing the console could tell an owner that nothing else can');
  } else {
    test.fail('invites: ' + JSON.stringify(report && report.invites));
  }

  // And the negative half of THAT, in the place it would actually
  // matter: an invite label in a non-owner's stream is the leak.
  if (heard.bella.map(function (m) { return m.raw; }).join('').indexOf('carlos') === -1) {
    test.check("and no invite label anywhere in a non-owner's stream");
  } else {
    test.fail('an invite label reached a non-owner');
  }

  // A quiet relay with nobody watching must not be doing work. The
  // owner leaving is the common case — a laptop closing — and the
  // report has nowhere to go afterwards.
  relay.streamClose(owner.publicKey, null);
  const before = heard.andy.length;
  const sentWithNobodyHome = relay.statusToOwner();
  if (sentWithNobodyHome === false && heard.andy.length === before) {
    test.check('with the owner gone it reports to nobody and says so, rather than queueing');
  } else {
    test.fail('sent=' + sentWithNobodyHome + ' heard=' + (heard.andy.length - before));
  }

  test.reportSuccessFailureCount();
})();
