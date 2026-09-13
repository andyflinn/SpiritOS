'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const invites = require('../run/js/invites');
const { createRelay } = require('../run/js/relay');

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-invites-'));
}

test.startTest('Invites cycle 1 — consume on claim');

{
  const home = tmpHome();
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  fs.writeFileSync(
    path.join(home, 'relay-state', 'allow.json'),
    JSON.stringify({ names: ['andy'] })
  );

  const box = createRelay(home);
  const andy = auth.generateIdentity('andy');
  const saint = auth.generateIdentity('saint');

  const noTok = box.claim(
    'saint',
    auth.sign(saint.privateKey, auth.claimMessage('saint')),
    saint.publicKey,
    '10.0.0.1'
  );
  if (!noTok.ok && noTok.status === 403) {
    test.check('names-mode saint without invite is refused');
  } else {
    test.fail('no invite: ' + JSON.stringify(noTok));
  }

  const row = invites.add(home, {
    label: 'saint',
    invitedBy: 'andy',
    days: 7,
    token: 'tok-saint-1',
  });
  if (row.token === 'tok-saint-1' && row.consumedAt === undefined) {
    // No `consumedAt` field at all. It could only ever be null once a
    // claimed invite is deleted rather than stamped, and a field that is
    // always null is residue the next reader has to ask about.
    test.check('invite written with no consumed field to be null');
  } else {
    test.fail('add: ' + JSON.stringify(row));
  }

  const badLabel = box.claim(
    'eve',
    auth.sign(saint.privateKey, auth.claimMessage('eve')),
    saint.publicKey,
    '10.0.0.1',
    'tok-saint-1'
  );
  if (!badLabel.ok) {
    test.check('invite does not unlock a different label');
  } else {
    test.fail('eve with saint token: ' + JSON.stringify(badLabel));
  }

  const ok = box.claim(
    'saint',
    auth.sign(saint.privateKey, auth.claimMessage('saint')),
    saint.publicKey,
    '10.0.0.1',
    'tok-saint-1'
  );
  if (ok.ok && ok.status === 201) {
    test.check('names-mode saint with invite and key is accepted');
  } else {
    test.fail('saint invite claim: ' + JSON.stringify(ok));
  }

  const after = invites.load(home).find(function (r) { return r.token === 'tok-saint-1'; });
  if (!after) {
    test.check('invite is gone after a successful claim — a waiting room, not a guestbook');
  } else {
    test.fail('still on disk: ' + JSON.stringify(invites.load(home)));
  }

  const reuse = box.claim(
    'saint',
    auth.sign(saint.privateKey, auth.claimMessage('saint')),
    saint.publicKey,
    '10.0.0.2',
    'tok-saint-1'
  );
  if (!reuse.ok) {
    test.check('used invite cannot claim again');
  } else {
    test.fail('reuse: ' + JSON.stringify(reuse));
  }
}

{
  const home = tmpHome();
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  fs.writeFileSync(
    path.join(home, 'relay-state', 'allow.json'),
    JSON.stringify({ names: ['andy'] })
  );
  invites.add(home, {
    label: 'late',
    token: 'tok-expired',
    invitedBy: 'andy',
    expiresAt: '2020-01-01T00:00:00.000Z',
  });
  const box = createRelay(home);
  const late = auth.generateIdentity('late');
  const r = box.claim(
    'late',
    auth.sign(late.privateKey, auth.claimMessage('late')),
    late.publicKey,
    '10.0.0.3',
    'tok-expired'
  );
  if (!r.ok && r.status === 403) {
    test.check('expired invite is refused');
  } else {
    test.fail('expired: ' + JSON.stringify(r));
  }
}

{
  const home = tmpHome();
  const box = createRelay(home);
  const annie = auth.generateIdentity('annie');
  const first = box.claim(
    'annie',
    auth.sign(annie.privateKey, auth.claimMessage('annie')),
    annie.publicKey
  );
  // This block used to assert the opposite — that cycle 1 left keys-mode
  // open. Cycle 4 closed it, so what it guards now is that the names-mode
  // invite path above and the keys-mode lock are two different doors:
  // names mode still admits an allow-listed name with no token at all,
  // keys mode does not. inviteLock.js covers the lock itself.
  const john = auth.generateIdentity('john');
  const extra = box.claim(
    'john',
    auth.sign(john.privateKey, auth.claimMessage('john')),
    john.publicKey
  );
  if (first.ok && !extra.ok && extra.error === 'invite required') {
    test.check('keys-mode after owner needs an invite (cycle 4)');
  } else {
    test.fail('keys extra: ' + JSON.stringify({ first: first, extra: extra }));
  }
}

test.subHeading('Dead invites do not accumulate on a box nobody administers');

//   Andy: "when an invite is redeemed, the success should depend on an
//   expiry check, after any attempt to redeem token the invite list
//   should be cleaned up. anytime the UI askes for a list of pending
//   invites, the list should be cleaned up before its returned."
//
// The expiry check always decided the claim. What nothing did was sweep:
// sweepExpired ran only from removePeer, so a relay nobody administers —
// which is most of them, most of the time — kept every dead row for ever.
//
// Three moments, and the third is the one that makes it self-maintaining:
// a relay whose owner merely LOOKS at it stays tidy.
{
  const home = tmpHome();
  const andy = auth.generateIdentity('andy');
  const box = createRelay(home);
  box.claim('andy', auth.sign(andy.privateKey, auth.claimMessage('andy')), andy.publicKey);

  function plantExpired(label, token) {
    const rows = invites.load(home);
    rows.push({
      token: token, label: label, invitedBy: 'andy',
      expiresAt: new Date(Date.now() - 60000).toISOString(),
    });
    // Written straight in: invites.add clamps expiry to the future, which
    // is correct and makes an expired row unmakeable through the door.
    fs.writeFileSync(path.join(home, 'relay-state', 'invites.json'), JSON.stringify(rows));
  }

  // 1. A FAILED ATTEMPT STILL TIDIES. The claim is refused on expiry —
  //    that is the check that was already there — and the row goes.
  plantExpired('ghost', 'dead-token');
  const ghost = auth.generateIdentity('ghost');
  const refused = box.claim('ghost',
    auth.sign(ghost.privateKey, auth.claimMessage('ghost')),
    ghost.publicKey, '10.0.0.1', 'dead-token');

  if (!refused.ok && /expired/.test(String(refused.error || '')) &&
      invites.load(home).length === 0) {
    test.check('a claim on an expired token is refused for expiry, and sweeps the row it refused');
  } else {
    test.fail('expired claim: ' + JSON.stringify(refused) + ' left: ' + JSON.stringify(invites.load(home)));
  }

  // 2. AND SO DOES AN ATTEMPT THAT WAS NEVER ENTITLED TO ANYTHING. The
  //    point is that somebody touched the file, not that they were owed
  //    an answer — this is the unauthenticated path, and it is safe
  //    because sweepExpired writes only when a row actually goes.
  plantExpired('ghost2', 'another-dead-token');
  const stranger = auth.generateIdentity('stranger');
  box.claim('stranger',
    auth.sign(stranger.privateKey, auth.claimMessage('stranger')),
    stranger.publicKey, '10.0.0.2', 'no-such-token');

  if (invites.load(home).length === 0) {
    test.check('and a claim with a token that was never real sweeps just the same');
  } else {
    test.fail('after a bogus token: ' + JSON.stringify(invites.load(home)));
  }

  // 3. AND LOOKING IS ENOUGH. The owner's report is the only place
  //    invites are ever shown, so asking for it is "the UI asking for the
  //    pending list" — and a relay whose owner merely opens a panel
  //    cleans itself.
  plantExpired('ghost3', 'third-dead-token');
  const live = box.mint('andy', 'anna', 7, 'green-boat');
  const heard = [];
  box.streamOpen(andy.publicKey,
    auth.sign(andy.privateKey, auth.streamMessage(andy.publicKey)), {
      write: function (chunk) {
        const ev = /^event: (.+)$/m.exec(String(chunk));
        const da = /^data: (.+)$/m.exec(String(chunk));
        if (ev && ev[1] === 'relay-status' && da) {
          try { heard.push(JSON.parse(da[1])); } catch (e) { /* not it */ }
        }
      },
      close: function () {},
    });

  const onDisk = invites.load(home);
  const reported = heard.length ? heard[heard.length - 1].invites : null;
  if (live.ok && onDisk.length === 1 && onDisk[0].token === 'green-boat' &&
      reported && reported.length === 1 && reported[0].label === 'anna') {
    test.check('the owner opening a stream sweeps the file and is shown only what is live');
  } else {
    test.fail('on disk: ' + JSON.stringify(onDisk) + ' reported: ' + JSON.stringify(reported));
  }
}

test.subHeading('A box upgrading in place does not resurrect spent tokens');

// THE ONE DAY THIS MATTERS is the day a running relay takes the code that
// made `consume` delete instead of stamp — and it is the kind of hazard
// nothing else would ever exercise, because no new row can have the field.
//
// Before the guard: a spent-but-unexpired row from the old world had its
// `consumedAt` read by nobody, so `match` waved it through and every
// token anyone had already used worked again. Checked against a real
// spirit-3-shaped row, which is where the hazard was found.
{
  const home = tmpHome();
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  const soon = new Date(Date.now() + 86400000).toISOString();
  const stale = new Date(Date.now() - 86400000).toISOString();
  fs.writeFileSync(path.join(home, 'relay-state', 'invites.json'), JSON.stringify([
    // Spent under the old rules, and not yet expired: the dangerous one.
    { token: 'spent', label: 'saint', expiresAt: soon, invitedBy: 'andy', consumedAt: stale },
    // Never claimed, still good. Must survive all of this untouched.
    { token: 'live', label: 'anna', expiresAt: soon, invitedBy: 'andy' },
  ]));

  const spent = invites.match(home, 'spent', 'saint');
  if (!spent.ok && spent.error === 'invite not found') {
    test.check('a token spent before the upgrade stays spent, and says only `not found`');
  } else {
    test.fail('legacy spent token: ' + JSON.stringify(spent));
  }

  const live = invites.match(home, 'live', 'anna');
  if (live.ok) {
    test.check('and an unclaimed row from the same file is untouched');
  } else {
    test.fail('legacy live token: ' + JSON.stringify(live));
  }

  // AND IT DRAINS. The stamped row goes on sight whatever its expiry
  // says, so the old guestbook empties the first time anything writes.
  invites.sweepExpired(home);
  const left = invites.load(home);
  if (left.length === 1 && left[0].token === 'live') {
    test.check('the first sweep drops the old guestbook and keeps the waiting room');
  } else {
    test.fail('after sweep: ' + JSON.stringify(left));
  }
}

test.reportSuccessFailureCount();
