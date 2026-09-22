'use strict';

// spirit/test/discBound.js
// THE SECOND BOUND — cycle 9, B4.
//
//   Andy, 2026-09-22: "DISC boundaries must be set also." — "disc bound
//   must be in place for completeness."
//
// `ramLimitMB` bounds how many members may be CONNECTED; `discLimitMB`
// bounds how many there may BE. A full relay refuses new claims, keeps
// serving the members it has, and evicts nobody — Andy: "the owner must
// evict before shrinkage."
//
// The figure is measured off relay-state/relay.db, so these cases work by
// setting a limit the file is already past rather than by writing a
// thousand members.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const { createRelay } = require('../run/js/relay');
const { claimOwner } = require('./ownerClaim');

function relayWith(config) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-disc-'));
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const box = createRelay(home, { config: config });
  return { home: home, box: box };
}

function claimAs(R, name, ownerName) {
  const id = auth.generateIdentity(name);
  const minted = R.box.mint(ownerName || 'owner', name, 7, '');
  const out = R.box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)),
    id.publicKey, 'disc-' + name, minted.invite.token, name);
  return { id: id, out: out, token: minted.invite.token };
}

test.startTest('The relay is bounded by its disc as well as its RAM');

test.subHeading('A relay with room takes members as it always did');

{
  const R = relayWith({ ramLimitMB: 64, discLimitMB: 64, source: 'test' });
  const owner = auth.generateIdentity('owner');
  claimOwner(R.box, owner, 'owner', 'disc-owner');
  const joined = claimAs(R, 'alice');
  if (joined.out && joined.out.ok) {
    test.check('64 MB of disc is room enough for a member');
  } else {
    test.fail('a claim inside the limit was refused: ' + JSON.stringify(joined.out));
  }
}

test.subHeading('A full relay refuses the next claim, and says what the owner can do');

{
  // A fresh store with one owner on it measures about 40 KB on disc, so
  // a limit of 0.02 MB is already passed before anybody else knocks. No
  // owner would configure a twentieth of a megabyte — relayConfig only
  // insists it is positive — but it is how the mechanism is driven
  // without writing a thousand members to reach a realistic figure.
  const R = relayWith({ ramLimitMB: 64, discLimitMB: 0.02, source: 'test' });
  const owner = auth.generateIdentity('owner');
  claimOwner(R.box, owner, 'owner', 'disc-owner');
  const refused = claimAs(R, 'bob');
  if (refused.out && !refused.out.ok && refused.out.status === 507 &&
      /full/.test(refused.out.error) && /discLimitMB/.test(refused.out.error)) {
    test.check('507, and the sentence names the figure and the two ways out');
  } else {
    test.fail('a claim past the disc limit was not refused properly: ' + JSON.stringify(refused.out));
  }

  test.subHeading('…and the invite is NOT burned, so the seat is not lost to nobody');
  const stillThere = R.box.inviteRows ? R.box.inviteRows() : null;
  const live = require('../run/js/invites').load(R.home).filter(function (row) {
    return row.token === refused.token && !row.consumedAt;
  });
  if (live.length === 1) {
    test.check('the token is still live after the refusal');
  } else {
    test.fail('the invite burned on a refused claim: ' + JSON.stringify(stillThere || live));
  }

  test.subHeading('…and the members it already has are untouched');
  if (require('../run/js/relayStore').open(R.home).members.count() === 1) {
    test.check('the owner is still on the roll — full means no new claims, never an eviction');
  } else {
    test.fail('the roll changed when a claim was refused');
  }
}

test.subHeading('The owner is never turned away by the figure');

{
  // A relay whose limit is already passed, with no owner yet: the first
  // owner claim must go through, or a number would lock out the one
  // account that can raise it.
  const R = relayWith({ ramLimitMB: 64, discLimitMB: 0.02, source: 'test' });
  const owner = auth.generateIdentity('owner');
  let ok = false;
  try {
    claimOwner(R.box, owner, 'owner', 'disc-owner');
    ok = require('../run/js/relayStore').open(R.home).members.count() === 1;
  } catch (e) { ok = false; }
  if (ok) {
    test.check('the first owner claims a box that is already over its disc figure');
  } else {
    test.fail('a full relay locked out its own owner');
  }
}

test.subHeading('The owner\'s report carries both bounds, and which one is biting');

{
  const R = relayWith({ ramLimitMB: 64, discLimitMB: 0.02, source: 'test' });
  const owner = auth.generateIdentity('owner');
  claimOwner(R.box, owner, 'owner', 'disc-owner');
  const seen = [];
  R.box.streamOpen(owner.publicKey, auth.sign(owner.privateKey, auth.streamMessage(owner.publicKey)), {
    write: function (chunk) {
      const ev = /event: ([^\n]+)/.exec(chunk);
      const da = /data: ([^\n]+)/.exec(chunk);
      if (!ev || !da) return;
      try { seen.push({ event: ev[1], data: JSON.parse(da[1]) }); } catch (e) { /* not this one */ }
    },
    close: function () {},
  });
  R.box.statusToOwner();
  const report = seen.filter(function (m) { return m.event === 'relay-status'; }).pop();
  if (report && report.data.ramLimitMB === 64 && report.data.discLimitMB === 0.02 &&
      typeof report.data.discUsedMB === 'number' && report.data.discUsedMB > 0) {
    test.check('the report says 64 MB of RAM, the disc figure, and what the roll occupies now');
  } else {
    test.fail('the report is missing the disc figures: ' + JSON.stringify(report && report.data));
  }
  if (report && report.data.binding === 'disc') {
    test.check('`binding` names disc on a relay whose roll is at its figure');
  } else {
    test.fail('binding was ' + JSON.stringify(report && report.data.binding));
  }
}

{
  const R = relayWith({ ramLimitMB: 64, discLimitMB: 64, source: 'test' });
  const owner = auth.generateIdentity('owner');
  claimOwner(R.box, owner, 'owner', 'disc-owner');
  const seen = [];
  R.box.streamOpen(owner.publicKey, auth.sign(owner.privateKey, auth.streamMessage(owner.publicKey)), {
    write: function (chunk) {
      const ev = /event: ([^\n]+)/.exec(chunk);
      const da = /data: ([^\n]+)/.exec(chunk);
      if (!ev || !da) return;
      try { seen.push({ event: ev[1], data: JSON.parse(da[1]) }); } catch (e) { /* not this one */ }
    },
    close: function () {},
  });
  R.box.statusToOwner();
  const report = seen.filter(function (m) { return m.event === 'relay-status'; }).pop();
  if (report && report.data.binding === 'ram') {
    test.check('…and RAM on one with disc to spare, so the owner knows which will stop the next person');
  } else {
    test.fail('binding on a roomy relay was ' + JSON.stringify(report && report.data.binding));
  }
}

test.subHeading('A relay built with no configuration has no disc bound at all');

{
  const R = relayWith(null);
  const owner = auth.generateIdentity('owner');
  claimOwner(R.box, owner, 'owner', 'disc-owner');
  const joined = claimAs(R, 'carol');
  if (joined.out && joined.out.ok) {
    test.check('every in-process suite is unaffected — no configuration, no refusal');
  } else {
    test.fail('an unconfigured relay refused a claim: ' + JSON.stringify(joined.out));
  }
}

test.reportSuccessFailureCount();
