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
    // DISTINCT TARGETS, because one member may be asked one thing at a
    // time (0016) and this check is about the TABLE's ceiling, not the
    // target's. Aimed at one peer it would be refused per-target long
    // before the table filled, and would pass while proving nothing.
    for (let n = 0; n < 3; n += 1) {
      R.open('f' + n, 'req', 'tgt' + n, function () { sent += 1; return true; });
    }
    const full = R.open('f9', 'req', 'tgt9', function () { sent += 1; return true; });
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
    // One target each, for the same reason: this is about what ONE
    // REQUESTER may hold, and a shared target would refuse first.
    R.open('a1', 'greedy', 'tgtA', function () { return true; });
    R.open('a2', 'greedy', 'tgtB', function () { return true; });
    const third = R.open('a3', 'greedy', 'tgtC', function () { return true; });
    const other = R.open('b1', 'quiet', 'tgtD', function () { return true; });
    if (third.ok === false && third.status === 429 && other.ok) {
      test.check("and one peer's flood does not spend another peer's room");
    } else {
      test.fail('third: ' + JSON.stringify(third) + ' other: ' + JSON.stringify(other));
    }
  }

  test.subHeading('One budget, because there is one population');

  // Decision 0016 kept a member's budget and a partner relay's apart. The
  // partner budget went with partnering as a permission (Andy's decision,
  // goal/G22.6); a stranger's post is held by the relay's address table and,
  // here, by the same cap as a member's. (The RELAY class, for device
  // offers, was removed by goal/G16.2.)
  {
    const R = router.createRouter({ max: 100, maxPerRequester: { member: 1 } });

    const first = R.open('m1', 'alice', 'tgt', function () { return true; }, null, router.MEMBER);
    const second = R.open('m2', 'alice', 'tgt2', function () { return true; }, null, router.MEMBER);
    if (first.ok && second.ok === false && second.status === 429) {
      test.check('a requester gets one in flight and the second is refused');
    } else {
      test.fail('member: ' + JSON.stringify(first) + ' / ' + JSON.stringify(second));
    }

    const p = R.open('p1', 'alice', 'tgt5', function () { return true; }, null, 'partner');
    if (router.KINDS.length === 1 && router.KINDS[0] === 'member' && router.PARTNER === undefined &&
        router.RELAY === undefined && p.ok === false && p.status === 500) {
      test.check('there is one requester class; the partner class is gone (goal/G22.6) and refused as unknown');
    } else {
      test.fail('classes: ' + JSON.stringify(router.KINDS) + ' partner open: ' + JSON.stringify(p));
    }
  }

  // THE NUMBER ITSELF, AS THE RELAY RUNS IT: 1 in, 1 out. Decision 0016:
  // "Caps of 1, in two directions. One in flight per member as requester;
  // one per member as target." The target half was built 2026-09-21; the
  // requester half stood at the unargued 16 until Andy, 2026-10-02, in
  // Desk: "experiment 1: change relay on spirit-3 to be 1 <--> 1 no 16
  // concurrent inputs ... you will chane 1 thing in the relay: and that's
  // 1 in 1 out." relay.js creates its router with no options, so the
  // defaults ARE the live relay's numbers and this block asserts them.
  {
    const R = router.createRouter();
    const first = R.open('d1', 'alice', 'tgt1', function () { return true; }, null, router.MEMBER);
    const second = R.open('d2', 'alice', 'tgt2', function () { return true; }, null, router.MEMBER);
    const other = R.open('d3', 'bob', 'tgt3', function () { return true; }, null, router.MEMBER);
    if (R.caps.member === 1 && R.maxPerRequester === 1 && R.maxPerTarget === 1
        && first.ok && second.ok === false && second.status === 429 && second.kind === router.MEMBER && other.ok) {
      test.check('by default a member has ONE request in flight: the second is refused 429, and another member is not');
    } else {
      test.fail('OWED by Andy\'s experiment 1 (2026-10-02): default caps ' + JSON.stringify(R.caps)
        + ', second ' + JSON.stringify(second) + ', other ' + JSON.stringify(other));
    }
    // The partner class's own budget stood checked here; it is gone with
    // partnering (goal/G22.6).
    // The live relay passes only its own key (selfKey, goal/G16.2): no cap
    // option, so the defaults above are still the numbers it runs.
    const live = require('fs').readFileSync(require('path').join(__dirname, '..', 'run', 'js', 'relay.js'), 'utf8');
    const made = live.match(/routerTable\.createRouter\((.*)\);/);
    if (made && !/max|ttl/i.test(made[1])) test.check('relay.js creates its router with no cap options, so these defaults are what a live relay runs');
    else test.fail('relay.js no longer creates its router with the defaults; assert the numbers where it now sets them');
  }

  // countFor WITHOUT a class still counts everything, and that is not an
  // accident of the default. Its other caller asks "is this identity
  // busy?" to spare a live stream from eviction (relay.js) — a question
  // about the peer, not about a budget.
  {
    const R = router.createRouter({ max: 100, maxPerRequester: 9 });
    R.open('c1', 'bob', 't1', function () { return true; }, null, router.MEMBER);
    R.open('c2', 'bob', 't2', function () { return true; }, null, router.MEMBER);
    if (R.countFor('bob') === 2 && R.countFor('bob', router.MEMBER) === 2) {
      test.check('countFor sees every entry of a requester, with or without the class named');
    } else {
      test.fail('all: ' + R.countFor('bob') + ' member: ' + R.countFor('bob', router.MEMBER));
    }
  }

  // A NUMBER STILL MEANS WHAT IT MEANT, so nothing that passed one has
  // changed underneath it.
  {
    const R = router.createRouter({ max: 100, maxPerRequester: 2 });
    if (R.caps.member === 2 && R.caps.partner === undefined
        && R.maxPerRequester === 2) {
      test.check('a plain number sets the cap, exactly as it did before');
    } else {
      test.fail('caps from a number: ' + JSON.stringify(R.caps));
    }
  }

  // An unknown class is a programming error and says so, rather than
  // quietly putting relay traffic on a member's budget with every suite
  // green.
  {
    const R = router.createRouter({});
    const bad = R.open('x1', 'who', 'tgt', function () { return true; }, null, 'memebr');
    if (bad.ok === false && bad.status === 500 && /unknown requester class/.test(bad.error)) {
      test.check('a misspelled class is refused, not defaulted');
    } else {
      test.fail('typo class: ' + JSON.stringify(bad));
    }
  }

  test.subHeading('One target, one slot per sender — a different kind of no');

  // Andy: "cap the requests for a specific target at one, respond with
  // (not available), if this causes the calling node to keep the request
  // queued, nothing is lost."
  //
  // COUNTED PER SENDER since goal/G22.6 (Andy's decision, taking M5 of the
  // review of 2026-10-10): "the member's one slot in flight counted per
  // sender ... so no stranger can keep a member busy". The slot was bob's
  // alone, so whoever held it made bob busy for everybody.
  {
    const R = router.createRouter({ max: 100, maxPerRequester: 99, maxPerTarget: 1 });

    const mine = R.open('t1', 'alice', 'bob', function () { return true; });
    const again = R.open('t2', 'alice', 'bob', function () { return true; });
    const theirs = R.open('t2b', 'carol', 'bob', function () { return true; });

    if (mine.ok && again.ok === false && again.status === 503 && theirs.ok) {
      test.check('one request from alice reaches bob, her second is refused, and carol is not held by alice\'s slot');
    } else {
      test.fail('per target per sender: ' + JSON.stringify(mine) + ' / ' + JSON.stringify(again) + ' / ' + JSON.stringify(theirs));
    }
    // The checks below read `theirs` as the refused one: it is alice's second.
    const theirsRefused = again;

    // THE POINT OF THE WHOLE REFUSAL. "peer not reachable" is the same
    // 503 and the opposite situation, so a scheduler that could only read
    // the status would back off a perfectly healthy peer.
    if (theirsRefused.busy === true && typeof theirsRefused.retryAfterMs === 'number' && theirsRefused.retryAfterMs > 0) {
      test.check('and it says busy, with when to come back — not merely 503');
    } else {
      test.fail('busy marker: ' + JSON.stringify(theirsRefused));
    }

    // A DIFFERENT TARGET IS UNAFFECTED. The cap is a slot at bob, so one
    // popular member must not make the relay look full to everybody else.
    const other = R.open('t3', 'carol', 'dave', function () { return true; });
    if (other.ok) {
      test.check('and carol reaches dave meanwhile — the cap is a slot at bob, not the table’s');
    } else {
      test.fail('other target refused: ' + JSON.stringify(other));
    }

    // The slot is the ANSWER's to free, exactly as with every other entry.
    R.answer('t1', 'bob');
    const after = R.open('t4', 'alice', 'bob', function () { return true; });
    if (after.ok && R.countForTarget('bob', 'alice') === 1 && R.countForTarget('bob') === 2) {
      test.check('once bob answers alice, her next request gets in; carol\'s slot at bob was never hers');
    } else {
      test.fail('after answer: ' + JSON.stringify(after) + ' count=' + R.countForTarget('bob'));
    }
  }

  // THE DEFAULT IS ONE (0016, landed 2026-09-21). It was "no tighter than
  // the table" while a node could not queue; the node can queue now
  // (postQueue.js), so the cap that needs no cooperation from anybody is
  // on by default.
  //
  //   Andy: "cap the requests for a specific target at one, respond with
  //   (not available), if this causes the calling node to keep the
  //   request queued, nothing is lost."
  {
    const R = router.createRouter({ max: 100, maxPerRequester: 99 });
    const first = R.open('d1', 'asker1', 'popular', function () { return true; });
    const second = R.open('d2', 'asker2', 'popular', function () { return true; });
    const again = R.open('d3', 'asker1', 'popular', function () { return true; });

    if (R.maxPerTarget === 1 && router.DEFAULT_PER_TARGET === 1) {
      test.check('unconfigured, a member may be asked one thing at a time by each sender');
    } else {
      test.fail('default per-target is ' + R.maxPerTarget);
    }
    if (first.ok && second.ok && again.ok === false && again.busy === true) {
      test.check('so a second asker gets in and the first asker\'s second request is told busy, with no configuration at all');
    } else {
      test.fail('second asker: ' + JSON.stringify(second) + ' / first asker again: ' + JSON.stringify(again));
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

  test.subHeading('What a request holds expires with it');

  // CYCLE 3. A forward's half-finished business — the partner's answer and
  // the route back — lived in a map beside this table, emptied only by a
  // reply. A member who never answered left it in RAM for good. It rides in
  // the entry now, as `carry`, so one ttl bounds everything a request holds.
  {
    const time = clock();
    const R = router.createRouter({ ttlMs: 5000, now: time.now });
    const carry = { answer: function () {}, from: 'N1', at: 'A' };
    R.open('h6', 'req', 'tgt', function () { return true; }, carry);
    const got = R.answer('h6', 'tgt');
    if (got.ok && got.carry === carry) {
      test.check('the answer hands back what the request carried');
    } else {
      test.fail('carry: ' + JSON.stringify(got));
    }

    // Unanswered: the carry must be unreachable once the entry expires —
    // asked of the garbage collector, not of the table's own opinion.
    const v8 = require('v8');
    const vm = require('vm');
    v8.setFlagsFromString('--expose-gc');
    const gc = vm.runInNewContext('gc');
    let ref = null;
    (function () {
      const lost = { answer: function () {}, from: 'N1', at: 'A' };
      ref = new WeakRef(lost);
      R.open('h7', 'req', 'tgt', function () { return true; }, lost);
    })();
    time.advance(6000);
    R.size();   // sweeps
    // A WeakRef's target is kept alive to the end of the job that made it,
    // so the question is asked on a later tick.
    setTimeout(function () {
      gc(); gc();
      if (R.answer('h7', 'tgt').ok === false && ref.deref() === undefined) {
        test.check('and an unanswered request\'s carry is freed when the entry expires');
      } else {
        test.fail('the carry outlived its entry');
      }
      test.reportSuccessFailureCount();
    }, 0);
    return;
  }
}

try { run(); }
catch (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
}
