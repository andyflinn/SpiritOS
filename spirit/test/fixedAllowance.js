'use strict';

// spirit/test/fixedAllowance.js
// THE RELAY MANAGES ITSELF WITHIN FIXED LIMITS — cycle 8, the Governor gone.
//
//   Andy: "relay will self-manage within fixed/constant limits. i agree." —
//   "delete it is." And, for the owner: the full status report "whenever
//   events occur", with no coalescing.
//
// The allowance is set once at boot from the owner's RAM and never moves;
// it is reported as a read-only gauge; and the owner hears a fresh report
// with every event instead of on a timer.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const { createRelay } = require('../run/js/relay');
const { claimOwner } = require('./ownerClaim');

function sinkFor(bag) {
  return {
    write: function (chunk) {
      const ev = /event: ([^\n]+)/.exec(chunk);
      const da = /data: ([^\n]+)/.exec(chunk);
      if (!ev) return;
      let parsed = null;
      try { parsed = da ? JSON.parse(da[1]) : null; } catch (e) { parsed = null; }
      bag.push({ event: ev[1], data: parsed });
    },
    close: function () {},
  };
}

function relayWith(ramLimitMB) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-allowance-'));
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const box = createRelay(home, { config: { ramLimitMB: ramLimitMB, source: 'test' } });
  const owner = auth.generateIdentity('owner');
  claimOwner(box, owner, 'owner', 'fx-owner');
  return { home: home, box: box, owner: owner };
}

function member(R, name) {
  const id = auth.generateIdentity(name);
  const minted = R.box.mint('owner', name, 7, '');
  R.box.claim(name, auth.sign(id.privateKey, auth.claimMessage(name)), id.publicKey, 'fx-' + name, minted.invite.token, name);
  return id;
}

function open(box, id, bag) {
  return box.streamOpen(id.publicKey, auth.sign(id.privateKey, auth.streamMessage(id.publicKey)), sinkFor(bag || []));
}

test.startTest('The relay manages itself within fixed limits');

test.subHeading('The allowance is the owner\'s RAM, fixed at boot');

{
  const R = relayWith(8);
  if (R.box.allowance() === 128) {
    test.check('8 MB of configured RAM allows 128 streams (16 a megabyte), set once at boot');
  } else {
    test.fail('allowance: ' + R.box.allowance());
  }
  if (typeof R.box.governorTick === 'undefined' && typeof R.box.governor === 'undefined') {
    test.check('and there is no tick and no Governor left to move it');
  } else {
    test.fail('the Governor\'s surface survived');
  }
  const bare = createRelay(fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-allowance-bare-')));
  if (bare.allowance() === null) {
    test.check('a relay built without a configuration has no allowance, as before');
  } else {
    test.fail('an unconfigured relay has allowance ' + bare.allowance());
  }
}

test.subHeading('It holds: the owner always, members up to the allowance');

{
  // 1/8 MB → 2 streams: small enough to fill in a test.
  const R = relayWith(0.125);
  const a = member(R, 'anna');
  const b = member(R, 'bert');
  const c = member(R, 'cara');
  const ra = open(R.box, a);
  const rb = open(R.box, b);
  const rc = open(R.box, c);
  const ro = open(R.box, R.owner);
  if (R.box.allowance() === 2 && ra.ok !== false && rb.ok !== false &&
      rc && rc.ok === false && rc.status === 503 && ro.ok !== false) {
    test.check('two members fit, the third is refused 503 full, and the owner is admitted over the allowance');
  } else {
    test.fail('opens: ' + JSON.stringify([ra, rb, rc, ro]) + ', allowance ' + R.box.allowance());
  }
}

test.subHeading('The owner sees it as a gauge, and hears on every event');

{
  const R = relayWith(8);
  const bag = [];
  open(R.box, R.owner, bag);
  const status = bag.filter(function (m) { return m.event === 'relay-status'; }).pop();
  const g = status && status.data && status.data.levers && status.data.levers.connections1;
  if (g && g.value === 128 && g.ceiling === 128 && g.settable === false && g.lastMove === null &&
      status.data.decision === undefined) {
    test.check('the report carries the allowance as a read-only gauge — value 128, not settable, no last move, no decision');
  } else {
    test.fail('status: ' + JSON.stringify(status && status.data));
  }

  const before = bag.filter(function (m) { return m.event === 'relay-status'; }).length;
  R.box.mint('owner', 'later', 7, '');
  const after = bag.filter(function (m) { return m.event === 'relay-status'; }).length;
  const events = bag.filter(function (m) { return m.event === 'owner-event' && m.data && m.data.kind === 'invite-minted'; });
  if (events.length === 1 && after === before + 1) {
    test.check('an event the owner is told of (an invite minted) brings a fresh full report with it — no timer needed');
  } else {
    test.fail('reports ' + before + ' -> ' + after + ', events ' + events.length);
  }
}

test.reportSuccessFailureCount();
