'use strict';

// spirit/test/deviceSlots.js
// B1. Per-identity slot and per-identity rate. Together.

const test = require('./testSupport.js');
const handshake = require('../run/js/deviceHandshake');

test.startTest('Device B1 — slot and rate per identity');

function clock() {
  var t = 0;
  return {
    now: function () { return t; },
    advance: function (ms) { t += ms; }
  };
}

async function run() {
  {
    const q = handshake.createQueue({ waitMs: 1000 });
    if (q.offer.length >= 3) test.check('offer takes a name');
    else test.fail('offer arity');

    const empty = q.take('andy');
    if (empty == null) test.check('empty take is null');
    else test.fail('empty: ' + JSON.stringify(empty));
  }

  {
    const q = handshake.createQueue({ waitMs: 5000 });
    const a = q.offer('andy', 'pw-andy', 'key-andy');
    const b = q.offer('eve', 'pw-eve', 'key-eve');
    const heldA = q.take('andy');
    const heldB = q.take('eve');
    if (heldA && heldA.password === 'pw-andy' && heldA.devicePublicKey === 'key-andy') {
      test.check('andy slot holds andy');
    } else {
      test.fail('heldA: ' + JSON.stringify(heldA));
    }
    if (heldB && heldB.password === 'pw-eve') test.check('eve slot holds eve');
    else test.fail('heldB: ' + JSON.stringify(heldB));
    if (heldA.password !== heldB.password) test.check('two identities do not share a password');
    else test.fail('shared slot');

    q.reply('andy', true);
    q.reply('eve', false);
    const out = await Promise.all([a, b]);
    if (out[0] && out[0].ok) test.check('andy accepted');
    else test.fail('andy resolve: ' + JSON.stringify(out[0]));
    if (out[1] && out[1].ok === false) test.check('eve rejected');
    else test.fail('eve resolve: ' + JSON.stringify(out[1]));
  }

  {
    const q = handshake.createQueue({ waitMs: 5000 });
    const first = q.offer('andy', 'pw1', 'k1');
    const second = await q.offer('andy', 'pw2', 'k2');
    if (second && second.ok === false && second.status === 403) {
      test.check('second offer on same name is refused');
    } else {
      test.fail('second: ' + JSON.stringify(second));
    }
    const held = q.take('andy');
    if (held && held.password === 'pw1') test.check('first offer kept the slot');
    else test.fail('held first: ' + JSON.stringify(held));
    q.reply('andy', false);
    await first;
  }

  {
    const time = clock();
    // waitMs short, and it has to be. The first offer of each name TAKES
    // the slot and nothing here replies to it, so with a 60s hold this
    // suite sat on two real minutes of setTimeout and was killed by the
    // harness before it reported. The fake clock drives rateOk only —
    // the hold is a real timer. None of the rate assertions depend on
    // how long a held offer waits.
    const q = handshake.createQueue({ waitMs: 40, now: time.now, perMin: 10 });
    const andy = [];
    var i;
    for (i = 0; i < 12; i++) andy.push(q.offer('andy', 'pw', 'k' + i));
    const andyOut = await Promise.all(andy);
    var refused = andyOut.filter(function (r) { return r && r.status === 429; }).length;
    if (refused >= 2) test.check('andy offer bucket is per name');
    else test.fail('andy rate refused=' + refused);

    const eve = [];
    for (i = 0; i < 3; i++) eve.push(q.offer('eve', 'pw', 'e' + i));
    const eveOut = await Promise.all(eve);
    var eve429 = eveOut.filter(function (r) { return r && r.status === 429; }).length;
    if (eve429 === 0) test.check("eve's offers are not spent by andy's bucket");
    else test.fail('eve starved 429=' + eve429);
  }

  {
    const time = clock();
    const q = handshake.createQueue({ waitMs: 60000, now: time.now, perMin: 10 });
    var n;
    var pendingRefused = 0;
    for (n = 0; n < 12; n++) {
      if (!q.pendingRateOk('andy')) pendingRefused += 1;
    }
    if (pendingRefused >= 2) test.check('device-pending bucket is per name');
    else test.fail('pending refused=' + pendingRefused);

    if (q.pendingRateOk('eve')) test.check("eve's pending bucket is separate");
    else test.fail('eve pending starved');
  }

  {
    const r = await handshake.createQueue({ waitMs: 1000 }).offer('', 'pw', 'k');
    if (r && r.ok === false) test.check('empty name is not now');
    else test.fail('empty name: ' + JSON.stringify(r));
  }

  if (typeof test.reportSuccessFailureCount === 'function') {
    test.reportSuccessFailureCount();
  }
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  if (typeof test.reportSuccessFailureCount === 'function') {
    test.reportSuccessFailureCount();
  }
});
