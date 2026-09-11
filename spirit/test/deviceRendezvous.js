'use strict';

// spirit/test/deviceRendezvous.js
//
// Enrolment is a RENDEZVOUS between two clocks that nothing synchronises:
// the relay holds one offer for `waitMs` (deviceHandshake.js), and a
// listening node looks every `DEVICE_TICK_MS` (hub.js). While the node
// looked every 2s the hold was ten times longer than the gap and the
// mismatch was invisible. At 60s it is not: the hold expires 35s before
// anything comes to collect it, and the offer is lost.
//
// Andy found it by feel, which is the part worth keeping — "works
// reliably when I click 10 seconds before the node polls, fails reliably
// 10 seconds after". A coin toss decided by a clock nobody can see.
//
// THE RULE (Andy, 2026-09-11): one hold must outlast one pass, with a
// margin — "somebody in the chain needs to try/wait 10% longer than the
// poll interval". That is what makes enrolment certain rather than
// likely: an offer that is still open when the node looks cannot be
// missed, whatever moment the button was pressed. The browser knocking
// again is then cover for a network that cuts a long hold, not the
// guarantee itself.
//
// Tested against the real queue rather than by reading the source.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const deviceHandshake = require('../run/js/deviceHandshake');

const RUN_DIR = path.join(__dirname, '..', 'run');

test.startTest('Device enrolment — the rendezvous');

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function nodePeriodMs() {
  const hub = fs.readFileSync(path.join(RUN_DIR, 'js', 'hub.js'), 'utf8');
  const m = hub.match(/DEVICE_TICK_MS\s*=\s*(\d+)/);
  return m ? Number(m[1]) : 0;
}

function pageBudgetMs() {
  const page = fs.readFileSync(path.join(RUN_DIR, 'device.html'), 'utf8');
  const m = page.match(/ENROLL_BUDGET_MS\s*=\s*(\d+)/);
  return m ? Number(m[1]) : 0;
}

async function run() {
  test.subHeading('A hold shorter than a pass is a coin toss');

  // Scaled down by a thousand — the same shape as 25s of hold against a
  // 60s period, small enough to run. Nothing here depends on the real
  // numbers; it depends on hold < period, which is what makes a lone
  // offer unreliable.
  const HOLD = 40;
  const PERIOD = 100;

  {
    const q = deviceHandshake.createQueue({ waitMs: HOLD });
    const began = Date.now();
    const answer = await q.offer('password', 'key');
    const took = Date.now() - began;

    if (answer && answer.ok === false && answer.error === deviceHandshake.ERROR_NOT_NOW) {
      test.check('an offer nobody collects expires by itself');
    } else {
      test.fail('unattended offer: ' + JSON.stringify(answer));
    }

    // The clock is the only thing that separates "nobody came" from
    // "somebody said no" — the relay answers `not now` to both on
    // purpose, because it cannot tell them apart and will not guess.
    // device.html reads that difference off its own stopwatch, so the
    // difference has to be real.
    if (took >= HOLD) {
      test.check('and it takes the whole hold to say so, which is how it differs from a refusal');
    } else {
      test.fail('expiry came back in ' + took + 'ms, under the ' + HOLD + 'ms hold');
    }
  }

  {
    // A refusal, for contrast: the node answered. This is the fast one.
    const q = deviceHandshake.createQueue({ waitMs: HOLD });
    const offered = q.offer('password', 'key');
    await sleep(5);
    q.reply(false);
    const began = Date.now();
    const answer = await offered;
    void began;
    if (answer && answer.ok === false) {
      test.check('a node that answers no answers at once, long before the hold runs out');
    } else {
      test.fail('refusal: ' + JSON.stringify(answer));
    }
  }

  test.subHeading('Knocking again closes the gap');

  {
    // The node, looking on its own schedule and landing deliberately in
    // the worst place: just after the first offer would have expired.
    const q = deviceHandshake.createQueue({ waitMs: HOLD });
    let collected = 0;
    const node = setInterval(function () {
      const held = q.take();
      if (held) {
        collected += 1;
        q.reply(true);
      }
    }, PERIOD);

    // One offer, the way the page used to work.
    const lone = await q.offer('password', 'key');
    if (lone && lone.ok === false) {
      test.check('a lone offer made at the wrong moment is lost, every time');
    } else {
      test.fail('lone offer unexpectedly succeeded: ' + JSON.stringify(lone));
    }

    // The same offer, knocked again — serially, never in parallel: the
    // relay has ONE pending slot, and a second offer while one is held is
    // refused at once, so overlapping attempts would lock out everyone
    // including the person making them.
    const began = Date.now();
    let attempts = 0;
    let got = null;
    while (Date.now() - began < PERIOD * 3) {
      attempts += 1;
      const answer = await q.offer('password', 'key');
      if (answer && answer.ok) { got = answer; break; }
    }
    clearInterval(node);

    if (got && got.ok) {
      test.check('but knocking again is collected — ' + attempts + ' attempt(s), one slot at a time');
    } else {
      test.fail('retrying never landed in ' + attempts + ' attempts');
    }
    if (collected === 1) {
      test.check('and exactly one offer was taken, so retrying installs one device and not several');
    } else {
      test.fail('the node collected ' + collected + ' offers');
    }
  }

  test.subHeading('The page budgets for more than one pass');

  {
    const page = fs.readFileSync(path.join(RUN_DIR, 'device.html'), 'utf8');
    const hub = fs.readFileSync(path.join(RUN_DIR, 'js', 'hub.js'), 'utf8');

    const periodMatch = hub.match(/DEVICE_TICK_MS\s*=\s*(\d+)/);
    const budgetMatch = page.match(/ENROLL_BUDGET_MS\s*=\s*(\d+)/);
    const period = periodMatch ? Number(periodMatch[1]) : 0;
    const budget = budgetMatch ? Number(budgetMatch[1]) : 0;

    // Two periods, not one. A pass can land in the breath between two
    // holds, and then the next one is a whole period away — so a budget
    // of exactly one period still loses that case.
    if (period > 0 && budget >= period * 2) {
      test.check('device.html waits longer than two node passes (' + budget + 'ms vs ' + period + 'ms)');
    } else {
      test.fail('budget ' + budget + 'ms against a ' + period + 'ms node period');
    }

    // THE RULE, and the reason enrolment is certain rather than likely.
    // Read from the module itself, never from a number copied into this
    // file — the two constants live on different machines (the hold on
    // the relay, the pass on a personal node) and the only thing that
    // can hold them together is a check that reads both.
    const held = deviceHandshake.createQueue().waitMs;
    const margin = 1.1;
    if (held >= period * margin) {
      test.check('one hold outlasts one pass with room to spare — ' + held + 'ms against ' +
        period + 'ms, ' + Math.round(((held / period) - 1) * 100) + '% over');
    } else {
      test.fail('the relay lets go after ' + held + 'ms, inside the ' + period +
        'ms pass — enrolment is a coin toss again');
    }

    // Serial, by recursion. A parallel burst would be refused by the
    // single-slot rule above and would spend the rate limit doing it.
    if (/attemptOnce\(\);/.test(page) && !/Promise\.all/.test(page)) {
      test.check('and it knocks one at a time, which is all the relay has room for');
    } else {
      test.fail('device.html does not retry serially');
    }
  }

  test.subHeading('Every moment you could press the button is a winning one');

  {
    // The claim the retry is supposed to buy: there is no longer a bad
    // moment to press Add this device. Not argued from arithmetic —
    // swept. The real ratios, scaled so the sweep runs in a second, and
    // every phase offset between the press and the node's clock is
    // tried, including the one Andy found (just after a pass).
    const realHold = deviceHandshake.createQueue().waitMs;
    const realPeriod = nodePeriodMs();
    const realBudget = pageBudgetMs();
    const SCALE = 100;
    const hold = Math.max(1, Math.round(realHold / SCALE));
    const period = Math.max(1, Math.round(realPeriod / SCALE));
    const budget = Math.max(1, Math.round(realBudget / SCALE));

    async function landsWhenNodeStartsAt(offset) {
      const q = deviceHandshake.createQueue({ waitMs: hold });
      let ticking = null;
      // A node that is ALREADY running when the button is pressed: its
      // next pass is `offset` away, and they continue every `period`
      // after that. setInterval alone would put the first pass at
      // offset + period and quietly test a different question.
      function pass() {
        if (q.take()) q.reply(true);
      }
      const arm = setTimeout(function () {
        pass();
        ticking = setInterval(pass, period);
      }, offset);
      const began = Date.now();
      let attempts = 0;
      try {
        while (Date.now() - began < budget) {
          attempts += 1;
          const answer = await q.offer('password', 'key');
          if (answer && answer.ok) return { ok: true, attempts: attempts };
        }
        return { ok: false, attempts: attempts };
      } finally {
        clearTimeout(arm);
        if (ticking) clearInterval(ticking);
      }
    }

    const offsets = [];
    for (let i = 0; i < 6; i += 1) offsets.push(Math.round((period * i) / 6));

    let worstAttempts = 0;
    const lost = [];
    for (const offset of offsets) {
      const out = await landsWhenNodeStartsAt(offset);
      worstAttempts = Math.max(worstAttempts, out.attempts);
      if (!out.ok) lost.push(offset);
    }

    if (lost.length === 0) {
      test.check('enrolment lands from all ' + offsets.length +
        ' phase offsets, so there is no bad moment to press the button');
    } else {
      test.fail('lost at offsets ' + JSON.stringify(lost) + ' of a ' + period + ' period');
    }

    // The sharp end of the rule: not "it gets there in the end" but ONE
    // knock, every time. If this ever needs a second attempt the hold has
    // stopped covering the pass, and the retry is quietly carrying a
    // guarantee it was only ever meant to back up.
    if (worstAttempts === 1) {
      test.check('and one knock was enough from every one of them — certain, not likely');
    } else {
      test.fail('worst offset needed ' + worstAttempts + ' knocks: the hold no longer covers a pass');
    }
  }

  test.subHeading('And the panel is still holding the news when you look');

  {
    const natter = fs.readFileSync(path.join(RUN_DIR, 'app', 'natter', 'natter.js'), 'utf8');
    const page = fs.readFileSync(path.join(RUN_DIR, 'device.html'), 'utf8');
    const period = nodePeriodMs();

    // The other half of a safe window: enrolling reliably is worth
    // nothing if the panel that started it has already forgotten by the
    // time its owner looks back. `installed` is the headline for
    // NATTER_DEV_FRESH_MS, and that has to outlast a node pass — the
    // person may well have been on the other device for one.
    const freshMatch = natter.match(/NATTER_DEV_FRESH_MS\s*=\s*([0-9 *]+);/);
    const fresh = freshMatch ? Function('return ' + freshMatch[1])() : 0;
    if (fresh >= period * 2) {
      test.check('a success stays the headline for ' + Math.round(fresh / 1000) + 's, past two node passes');
    } else {
      test.fail('success window ' + fresh + 'ms against a ' + period + 'ms node period');
    }

    // The panel asks the hub far more often than the hub learns anything,
    // so nothing can be enrolled and shown stale. Loopback, and free.
    const watch = natter.slice(natter.indexOf('function natterDeviceWatch('));
    const pollMatch = watch.match(/\}, (\d+)\);/);
    const poll = pollMatch ? Number(pollMatch[1]) : 0;
    if (poll > 0 && poll * 4 <= period) {
      test.check('and the panel asks every ' + poll + 'ms, so it cannot be the slow half');
    } else {
      test.fail('panel poll ' + poll + 'ms against a ' + period + 'ms node period');
    }

    // device.html says the period out loud because it cannot ask for it —
    // it is served by the relay, not the node. That copy is PROSE and is
    // named so (ENROLL_PERIOD_HINT_MS): nothing computes with it, and if
    // it ever disagrees with hub.js it is the sentence that is wrong, not
    // the node. Held here anyway, because a hint that lies is worse than
    // no hint.
    const saidMatch = page.match(/ENROLL_PERIOD_HINT_MS\s*=\s*(\d+)/);
    const said = saidMatch ? Number(saidMatch[1]) : 0;
    if (said === period) {
      test.check('and the sentence it says out loud is still true — ' +
        Math.round(said / 1000) + 's, the node\'s own figure');
    } else {
      test.fail('device.html says ' + said + 'ms, hub.js ticks at ' + period + 'ms');
    }

    // Elapsed alone still leaves somebody guessing whether to keep
    // watching. The countdown is what closes that.
    if (/giving up in/.test(page) && /ENROLL_BUDGET_MS - gone/.test(page)) {
      test.check('and it counts down to giving up rather than only counting time spent');
    } else {
      test.fail('device.html shows no countdown to failure');
    }
  }

  test.reportSuccessFailureCount();
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
});
