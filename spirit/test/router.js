'use strict';

// spirit/test/router.js
// Register before you forward.
//
// Andy's rule: "every point in the reply chain is responsible for not
// forwarding a request, the reply to which it wouldn't know how to
// match." The tests below are about ORDER and about REFUSAL, because
// those are the two ways a hop breaks it.

const test = require('./testSupport.js');
const router = require('../run/js/router');

function clock() {
  let t = 1000;
  return { now: function () { return t; }, advance: function (ms) { t += ms; } };
}

test.startTest('Router — register before you forward');

function run() {
  test.subHeading('The entry exists before the request moves');

  // THE test of this file. The delivery is performed BY the table, so at
  // the moment the bytes go out the routing entry is already filed —
  // and that is observable from inside the delivery itself rather than
  // inferred from the order of two lines somebody might reorder.
  {
    const R = router.createRouter({});
    let filedWhenDelivered = null;
    const out = R.open('h1', 'req', 'tgt', function () {
      filedWhenDelivered = R.has('h1');
      return true;
    });
    if (out.ok && filedWhenDelivered === true) {
      test.check('the hash is already matchable at the instant the bytes leave');
    } else {
      test.fail('open: ' + JSON.stringify(out) + ' filed=' + filedWhenDelivered);
    }
  }

  // And the wrong order is not expressible: there is no way to obtain a
  // filed entry and send separately, because open() will not file
  // without being handed the delivery.
  {
    const R = router.createRouter({});
    const refused = R.open('h1', 'req', 'tgt');
    if (refused.ok === false && R.has('h1') === false) {
      test.check('and nothing can be filed without the delivery to go with it');
    } else {
      test.fail('filed without a delivery: ' + JSON.stringify(refused));
    }
  }

  test.subHeading('A delivery that failed leaves nothing behind');

  // Otherwise the hash stays occupied and every retry of a request that
  // never arrived is told "already in flight" — the caller waits for an
  // answer to something nobody ever received.
  {
    const R = router.createRouter({});
    const dead = R.open('h2', 'req', 'tgt', function () { return false; });
    if (dead.ok === false && dead.status === 502 && !R.has('h2')) {
      test.check('a target that could not be reached frees its hash again');
    } else {
      test.fail('dead: ' + JSON.stringify(dead) + ' has=' + R.has('h2'));
    }
  }

  {
    const R = router.createRouter({});
    const threw = R.open('h3', 'req', 'tgt', function () { throw new Error('socket gone'); });
    if (threw.ok === false && !R.has('h3')) {
      test.check('and so does one that threw on the way out');
    } else {
      test.fail('threw: ' + JSON.stringify(threw) + ' has=' + R.has('h3'));
    }
  }

  test.subHeading('Two live requests may never share a hash');

  // The one false positive this design could have had. A receipt is
  // signed over the hash and NOTHING ELSE, so if two live requests
  // shared one, a single receipt would be a valid signature for both —
  // and routing it to the wrong requester would verify perfectly.
  {
    const R = router.createRouter({});
    let secondDelivered = false;
    R.open('same', 'alice', 'tgt', function () { return true; });
    const clash = R.open('same', 'bob', 'tgt', function () {
      secondDelivered = true;
      return true;
    });
    if (clash.ok === false && clash.status === 409 && !secondDelivered) {
      test.check('a duplicate hash is refused, and the second never even goes out');
    } else {
      test.fail('clash: ' + JSON.stringify(clash) + ' delivered=' + secondDelivered);
    }

    // And the refusal is DISTINGUISHABLE, because the right answer to it
    // is to wait rather than to resend. A caller that reads it as a
    // rejection does the one thing that makes it worse.
    if (clash.inFlight === true) {
      test.check('and says "already in flight" rather than simply no');
    } else {
      test.fail('indistinguishable refusal: ' + JSON.stringify(clash));
    }

    // The original is untouched by the collision — it is still going to
    // be answered.
    const settled = R.answer('same', 'tgt');
    if (settled.ok && settled.requester === 'alice') {
      test.check('and the request already in flight still belongs to whoever sent it');
    } else {
      test.fail('answer went to: ' + JSON.stringify(settled));
    }
  }

  test.subHeading('Capacity is a refusal, never a drop');

  // A box under pressure that declines is alive and truthful. One that
  // accepts everything and loses the overflow is lying, in exactly the
  // direction this design spends its effort preventing.
  {
    const R = router.createRouter({ max: 3, maxPerRequester: 99 });
    let sent = 0;
    for (let n = 0; n < 3; n += 1) {
      R.open('f' + n, 'req', 'tgt', function () { sent += 1; return true; });
    }
    const full = R.open('f9', 'req', 'tgt', function () { sent += 1; return true; });
    if (full.ok === false && full.status === 503 && sent === 3) {
      test.check('a full table refuses at once, and nothing is forwarded into the dark');
    } else {
      test.fail('full: ' + JSON.stringify(full) + ' sent=' + sent);
    }
  }

  // Per requester too, so one peer cannot spend the table on everybody
  // else's behalf — the fairness B1 established for device slots.
  {
    const R = router.createRouter({ max: 100, maxPerRequester: 2 });
    R.open('a1', 'greedy', 'tgt', function () { return true; });
    R.open('a2', 'greedy', 'tgt', function () { return true; });
    const third = R.open('a3', 'greedy', 'tgt', function () { return true; });
    const other = R.open('b1', 'quiet', 'tgt', function () { return true; });
    if (third.ok === false && third.status === 429 && other.ok) {
      test.check("and one peer's flood does not spend another peer's room");
    } else {
      test.fail('third: ' + JSON.stringify(third) + ' other: ' + JSON.stringify(other));
    }
  }

  test.subHeading('Who may answer');

  {
    const R = router.createRouter({});
    R.open('h4', 'req', 'tgt', function () { return true; });

    // The hash finds the request; being its target is the permission.
    // Anyone who saw the bytes can compute the hash, so the two can
    // never be the same check.
    const impostor = R.answer('h4', 'someone-else');
    if (impostor.ok === false && impostor.status === 403 && R.has('h4')) {
      test.check('knowing the hash is not permission to answer');
    } else {
      test.fail('impostor: ' + JSON.stringify(impostor));
    }

    const proper = R.answer('h4', 'tgt');
    if (proper.ok && proper.requester === 'req' && !R.has('h4')) {
      test.check('the target answers once, and the entry is spent');
    } else {
      test.fail('proper: ' + JSON.stringify(proper));
    }

    const twice = R.answer('h4', 'tgt');
    if (twice.ok === false && twice.status === 404) {
      test.check('and cannot answer the same request twice');
    } else {
      test.fail('answered twice: ' + JSON.stringify(twice));
    }
  }

  test.subHeading('A request nobody answered goes away by itself');

  {
    const time = clock();
    const R = router.createRouter({ ttlMs: 5000, now: time.now });
    R.open('h5', 'req', 'tgt', function () { return true; });
    time.advance(4000);
    if (R.has('h5')) test.check('it waits as long as the caller was told it would');
    else test.fail('expired early');

    time.advance(2000);
    if (!R.has('h5') && R.size() === 0) {
      test.check('and then it is gone, so the hash can be used again');
    } else {
      test.fail('still pending after ttl: ' + R.size());
    }

    // Which is what makes a resend after expiry an ordinary new request
    // rather than a collision.
    let again = false;
    const fresh = R.open('h5', 'req', 'tgt', function () { again = true; return true; });
    if (fresh.ok && again) {
      test.check('so a resend after it expires is simply a new request');
    } else {
      test.fail('resend refused: ' + JSON.stringify(fresh));
    }
  }

  test.reportSuccessFailureCount();
}

try { run(); }
catch (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
}
